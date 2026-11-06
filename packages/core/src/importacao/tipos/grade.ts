import { createHash } from 'node:crypto'
import {
  CABECALHOS_DA_PLANILHA,
  chaveDaDisciplina,
  ESTADOS_DO_PROFESSOR_ALOCAVEIS,
  emailConvidadoSchema,
  InvariantException,
  MAXIMO_DE_LINHAS_DA_PLANILHA,
  serieDaChave,
  TAMANHO_MAXIMO_DA_SALA_DA_AULA,
  TAMANHO_MAXIMO_NOME_DIGITADO,
  type EstadoDeVinculo,
  type EstadoDoProfessor,
  type MarcasDaPlanilha,
  type OrigemDeVinculo,
  type PreviaDaPlanilhaRow,
  type CandidatoDaMarca,
  type ResumoDaImportacao,
} from '@educa/shared'
import { z } from 'zod'
import { convidarProfessorDaPlanilha } from '../../convite/convidar-professor-da-planilha.js'
import { AuditoriaRecorder } from '../../auditoria/auditoria-recorder.js'
import { CicloDeVidaRepository } from '../../ciclo-de-vida/ciclo-de-vida.repository.js'
import type { TurmaDoAno } from '../../estrutura/turma.repository.js'
import type { DatabaseTransaction } from '../../db/database.js'
import type { AulaGravada, AulaNova } from '../alocacao.repository.js'
import { ContaDaPlanilhaPerdidaError, DiferencaNaPlanilhaError } from '../erros.js'
import type { ImportacaoRepository, ProfessorDaEscola } from '../importacao.repository.js'
import { lerTabela, normalizarTexto } from '../leitor.js'
import type { ContasDoJob, PlanoDaImportacao, PreviaDoTipo, TipoDeImportacao } from '../tipo.js'
import { criarTurmasNovas, indexarTurmas, indiceDaTurma, nomeDaTurma, type Serie, type TurmaNova } from './alunos.js'

/**
 * A planilha da grade (F2, 11.0, RF7 e RF8; Tech Spec, seção 5, "Gravar", "Grade"): por aula, a turma, a disciplina, o nome e o e-mail do
 * professor, o dia, o início, o fim e a sala (opcional), até 3.000 linhas. Gravar faz três coisas no ano de destino, o em curso ou o planejado:
 * grava a aula (`alocacao`), cria o que a escola ainda não tem (turma, disciplina e professor, "novo" na prévia) e, para cada turma × disciplina ×
 * professor sem vínculo aberto, cria um vínculo `pendente` de `origem = grade`, que o professor confirma ou contesta (A1; regra 60, item 8a). Só
 * o confirmado dá acesso à turma.
 *
 * - **O vínculo aberto da mesma tripla é reaproveitado**, em qualquer estado que não seja `encerrado`: o confirmado não muda, o contestado não
 *   volta a pendente (reimportar não o reabre), o feito à mão ganha a aula. O `encerrado` não reabre: nasce um pendente.
 * - **O professor é o do e-mail**, achado pelo `usuario` da escola, nunca pela `conta`: e-mail com conta só em outra escola aparece "novo", como
 *   na planilha de professores (E11 da A1). Quem tem o convite em aberto, o `aceito` e o `ativo` recebem o vínculo; o `revogado` e o `desativado`
 *   são chamados de volta pelo `convidar`, como na planilha de professores; o convite `vencido` é erro, porque a coordenação não aloca professor
 *   nesse estado (`ESTADOS_DO_PROFESSOR_ALOCAVEIS`): ela renova o convite pela lista antes.
 * - **Professor em duas turmas no mesmo horário e turma com duas aulas no mesmo horário são aviso** (aula conjunta e turma dividida existem);
 *   horário impossível, linha sem professor e a mesma aula duas vezes são erro.
 * - **A aula que já existe para (vínculo, dia, início) muda de fim e de sala e mantém o id** (a `Aula` da F2b aponta para ela). Reimportar
 *   **substitui** a grade do ano (12.0, RF9): a aula gravada que nenhuma linha traz sai do ano, no gravar.
 * - **O vínculo que perdeu as aulas é candidato a "sai da grade" e só encerra marcado** (12.0): o vínculo de professor aberto que nenhuma linha
 *   reaproveita e que tem aula gravada ou nasceu da grade. O criado à mão sem aula fica, e não é candidato. A marca encerra pelo mesmo caminho do
 *   `encerrar` da coordenação (motivo `realocacao`, `vinculo.encerrado` com a origem `grade`, e o acesso que o professor gerou na turma, revogado).
 *   Com erro em alguma linha a planilha não grava, e por isso a prévia não oferece candidato nem conta aula que sai.
 * - **A prévia não mostra nome nem e-mail do banco**: o e-mail só serve para casar a linha, e nunca sai.
 */

const registro = new AuditoriaRecorder()

const horarioDaAulaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/** A aula de uma linha, já lida e sem espaço a mais: o que o gravar guarda até o job, e o job relê. */
const aulaGuardadaSchema = z.strictObject({
  linha: z.number().int().positive(),
  turma: z.string().min(1),
  disciplina: z.string().min(1),
  nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DIGITADO),
  email: z.string().min(3),
  dia: z.number().int().min(1).max(7),
  inicio: horarioDaAulaSchema,
  fim: horarioDaAulaSchema,
  sala: z.string().min(1).max(TAMANHO_MAXIMO_DA_SALA_DA_AULA).nullable(),
})
const guardadoSchema = z.array(aulaGuardadaSchema).max(MAXIMO_DE_LINHAS_DA_PLANILHA)

type AulaLida = z.infer<typeof aulaGuardadaSchema>

/** Os códigos de erro de linha: palavra de lista fechada, nunca texto com o dado da linha. */
type ErroDaLinhaDeGrade =
  | 'linha_incompleta'
  | 'turma_vazia'
  | 'turma_invalida'
  | 'turma_ambigua'
  | 'disciplina_vazia'
  | 'disciplina_invalida'
  | 'disciplina_ambigua'
  | 'sem_professor'
  | 'nome_vazio'
  | 'nome_invalido'
  | 'email_invalido'
  | 'professor_com_convite_vencido'
  | 'dia_invalido'
  | 'horario_invalido'
  | 'fim_antes_do_inicio'
  | 'sala_longa'
  | 'aula_repetida'

/** Os dois avisos: a aula não deixa de gravar. */
type AvisoDaLinhaDeGrade = 'professor_em_duas_turmas' | 'turma_com_duas_aulas'

type DestinoDaTurma = { readonly tipo: 'existente'; readonly turmaId: string } | { readonly tipo: 'nova'; readonly chave: string; readonly serie: Serie; readonly nome: string }
type DestinoDaDisciplina = { readonly tipo: 'existente'; readonly id: string } | { readonly tipo: 'nova'; readonly chave: string; readonly nome: string }
/** O professor: o da escola, que recebe o vínculo, ou o "novo", que o job cadastra (o `usuarioId` só existe no que volta, `revogado` ou `desativado`). */
type DestinoDoProfessor =
  | { readonly tipo: 'existente'; readonly usuarioId: string; readonly estado: EstadoDoProfessor }
  | { readonly tipo: 'novo'; readonly email: string; readonly nome: string; readonly usuarioId: string | null; readonly estado: EstadoDoProfessor | null }

/** O vínculo da tripla: o aberto que a grade reaproveita, ou o pendente que ela cria (pela chave da tripla). */
type VinculoDaLinha = { readonly tipo: 'existente'; readonly id: string; readonly estado: EstadoDeVinculo } | { readonly tipo: 'novo'; readonly chave: string }

/** O que a linha faria: `novo` (traz turma, disciplina ou professor que a escola não tem), `entra` (aula nova ou com outro fim ou sala), `ja_existe` ou `erro`. */
type ResultadoDaLinha = 'novo' | 'entra' | 'ja_existe' | 'erro'

interface ClassificadaRow {
  readonly linha: number
  readonly resultado: ResultadoDaLinha
  readonly erro?: ErroDaLinhaDeGrade
  readonly aviso?: AvisoDaLinhaDeGrade
  readonly aula?: AulaLida
  readonly turma?: DestinoDaTurma
  readonly disciplina?: DestinoDaDisciplina
  readonly professor?: DestinoDoProfessor
  readonly vinculo?: VinculoDaLinha
  /** A aula gravada para (vínculo, dia, início), que a linha confirma ou muda. */
  readonly gravada?: AulaGravada
}

/** O que a escola já tem, para as linhas da planilha: lido em cinco consultas, qualquer que seja o número de linhas. */
interface DadosDaGrade {
  readonly turmas: readonly TurmaDoAno[]
  readonly disciplinas: ReadonlyArray<{ readonly id: string; readonly nome: string }>
  readonly professores: readonly ProfessorDaEscola[]
  readonly vinculos: ReadonlyArray<{ readonly id: string; readonly usuarioId: string; readonly turmaId: string; readonly disciplinaId: string | null; readonly estado: EstadoDeVinculo; readonly origem: OrigemDeVinculo }>
  readonly aulas: readonly AulaGravada[]
}

interface Classificacao {
  readonly linhas: readonly ClassificadaRow[]
  /** Os ids das aulas gravadas do ano que nenhuma linha traz: saem no gravar. */
  readonly aulasQueSaem: readonly string[]
  /** Os vínculos que perderam as aulas ("sai da grade"): só a marca da coordenação os encerra. */
  readonly candidatos: readonly CandidatoDaMarca[]
  readonly turmasNovas: readonly TurmaNova[]
  readonly disciplinasNovas: ReadonlyArray<{ readonly chave: string; readonly nome: string }>
  readonly professoresNovos: ReadonlyArray<{ readonly email: string; readonly nome: string }>
  readonly vinculosNovos: ReadonlyArray<{ readonly chave: string; readonly turma: DestinoDaTurma; readonly disciplina: DestinoDaDisciplina; readonly email: string }>
  readonly resumo: ResumoDaImportacao
  readonly assinatura: string
}

/** Os estados em que o e-mail da planilha chama o professor de volta, como na planilha de professores: o convite `revogado` e o `desativado`. */
const ESTADOS_QUE_VOLTAM: ReadonlySet<EstadoDoProfessor> = new Set(['revogado', 'desativado'])
const ESTADOS_ALOCAVEIS: ReadonlySet<EstadoDoProfessor> = new Set(ESTADOS_DO_PROFESSOR_ALOCAVEIS)

/** O dia da semana pelo número (1, segunda, a 7, domingo) ou pelo nome ("segunda", "Seg", "terça-feira"): sem acento nem caixa. */
const DIAS_PELO_NOME = new Map<string, number>([
  ['seg', 1], ['segunda', 1], ['ter', 2], ['terca', 2], ['qua', 3], ['quarta', 3], ['qui', 4], ['quinta', 4], ['sex', 5], ['sexta', 5], ['sab', 6], ['sabado', 6], ['dom', 7], ['domingo', 7],
])

function lerDia(texto: string): number | null {
  const limpo = normalizarTexto(texto).replace(/[\s-]?feira$/, '')
  return /^[1-7]$/.test(limpo) ? Number(limpo) : (DIAS_PELO_NOME.get(limpo) ?? null)
}

/** O horário como `HH:MM`: aceita `8:50`, `08:50`, `08:50:00`, `8h50` e `8h`. Hora ou minuto que não existe é `null`. */
function lerHorario(texto: string): string | null {
  const achado = /^(\d{1,2})(?:h(\d{2})?|:(\d{2})(?::\d{2})?)$/.exec(normalizarTexto(texto))
  if (achado === null) return null
  const [hora, minuto] = [Number(achado[1]), Number(achado[2] ?? achado[3] ?? '0')]
  return hora > 23 || minuto > 59 ? null : `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

/** Texto de uma linha: sem espaço a mais, e sem caractere de controle. */
const compactar = (texto: string): string => texto.replace(/\s+/g, ' ').trim()
const temControle = (texto: string): boolean => /\p{Cc}/u.test(texto)

/** O campo de uma linha, ou texto vazio. */
const campoDe = (campos: Readonly<Record<string, string>>, nome: string): string => campos[nome] ?? ''

/** O professor da linha (nome e e-mail), ou o código do erro. O nome vem antes do e-mail: é a ordem em que a coordenação os lê. */
function lerProfessor(campos: Readonly<Record<string, string>>): { readonly nome: string; readonly email: string } | ErroDaLinhaDeGrade {
  const nome = compactar(campoDe(campos, 'professor'))
  const digitado = campoDe(campos, 'email').trim()
  if (nome === '' && digitado === '') return 'sem_professor'
  if (nome === '') return 'nome_vazio'
  if (nome.length > TAMANHO_MAXIMO_NOME_DIGITADO || temControle(nome)) return 'nome_invalido'
  const email = emailConvidadoSchema.safeParse(digitado)
  return email.success ? { nome, email: email.data } : 'email_invalido'
}

/** A turma e a disciplina da linha, ou o código do erro: a turma vem antes. */
function lerOndeEh(campos: Readonly<Record<string, string>>): { readonly turma: string; readonly disciplina: string } | ErroDaLinhaDeGrade {
  const turma = nomeDaTurma(campoDe(campos, 'turma'))
  if (turma === '') return 'turma_vazia'
  if (turma.length > 40 || temControle(turma)) return 'turma_invalida'
  const disciplina = compactar(campoDe(campos, 'disciplina'))
  if (disciplina === '') return 'disciplina_vazia'
  if (disciplina.length > 80 || temControle(disciplina)) return 'disciplina_invalida'
  return { turma, disciplina }
}

/** O dia e o horário da linha, ou o código do erro: o dia vem antes. */
function lerQuando(campos: Readonly<Record<string, string>>): { readonly dia: number; readonly inicio: string; readonly fim: string } | ErroDaLinhaDeGrade {
  const dia = lerDia(campoDe(campos, 'dia'))
  if (dia === null) return 'dia_invalido'
  const inicio = lerHorario(campoDe(campos, 'inicio'))
  const fim = lerHorario(campoDe(campos, 'fim'))
  if (inicio === null || fim === null) return 'horario_invalido'
  return inicio >= fim ? 'fim_antes_do_inicio' : { dia, inicio, fim }
}

/** A aula de uma linha, ou o código do primeiro erro dela, na ordem em que a coordenação os corrige: turma, disciplina, professor, dia, horário e sala. */
function lerLinha(linha: number, campos: Readonly<Record<string, string>>): AulaLida | ErroDaLinhaDeGrade {
  const onde = lerOndeEh(campos)
  if (typeof onde === 'string') return onde
  const professor = lerProfessor(campos)
  if (typeof professor === 'string') return professor
  const quando = lerQuando(campos)
  if (typeof quando === 'string') return quando
  const sala = compactar(campoDe(campos, 'sala'))
  if (sala.length > TAMANHO_MAXIMO_DA_SALA_DA_AULA || temControle(sala)) return 'sala_longa'
  return { linha, ...onde, nome: professor.nome, email: professor.email, ...quando, sala: sala === '' ? null : sala }
}

/** A turma que a linha pede: a da escola neste ano, a que nasce na série que o nome diz, ou o erro (nome sem série, duas turmas de mesma chave). */
function destinoDaTurma(nome: string, porIndice: ReadonlyMap<string, readonly TurmaDoAno[]>): DestinoDaTurma | ErroDaLinhaDeGrade {
  const indice = indiceDaTurma(nome, null)
  const achadas = porIndice.get(indice) ?? []
  if (achadas.length > 1) return 'turma_ambigua'
  const [unica] = achadas
  if (unica !== undefined) return { tipo: 'existente', turmaId: unica.id }
  const serie = serieDaChave(indice)
  return serie === null ? 'turma_invalida' : { tipo: 'nova', chave: indice, serie, nome }
}

/** A disciplina da escola de mesmo nome (sem acento nem caixa), ou a que nasce; duas da escola com a mesma chave ("Química" e "Quimica") são ambíguas. */
function destinoDaDisciplina(nome: string, porChave: ReadonlyMap<string, ReadonlyArray<{ readonly id: string }>>): DestinoDaDisciplina | ErroDaLinhaDeGrade {
  const chave = chaveDaDisciplina(nome)
  const achadas = porChave.get(chave) ?? []
  if (achadas.length > 1) return 'disciplina_ambigua'
  const [unica] = achadas
  return unica === undefined ? { tipo: 'nova', chave, nome } : { tipo: 'existente', id: unica.id }
}

function destinoDoProfessor(aula: AulaLida, porEmail: ReadonlyMap<string, ProfessorDaEscola>): DestinoDoProfessor | ErroDaLinhaDeGrade {
  const { email, nome } = aula
  const existente = porEmail.get(email)
  if (existente === undefined) return { tipo: 'novo', email, nome, usuarioId: null, estado: null }
  if (ESTADOS_QUE_VOLTAM.has(existente.estado)) return { tipo: 'novo', email, nome, usuarioId: existente.usuarioId, estado: existente.estado }
  return ESTADOS_ALOCAVEIS.has(existente.estado) ? { tipo: 'existente', usuarioId: existente.usuarioId, estado: existente.estado } : 'professor_com_convite_vencido'
}

const refDaTurma = (destino: DestinoDaTurma): string => (destino.tipo === 'existente' ? destino.turmaId : `nova:${destino.chave}`)
const refDaDisciplina = (destino: DestinoDaDisciplina): string => (destino.tipo === 'existente' ? destino.id : `nova:${destino.chave}`)

/** A tripla turma × disciplina × professor, que é o vínculo: pelo que cada um é (o id, ou a chave do que nasce) e pelo e-mail do professor. */
const chaveDaTripla = (turma: DestinoDaTurma, disciplina: DestinoDaDisciplina, email: string): string => JSON.stringify([refDaTurma(turma), refDaDisciplina(disciplina), email])

/** Se os dois horários (`HH:MM`) têm minuto em comum: o que termina às 9h e o que começa às 9h não se sobrepõem. */
const sobrepoe = (a: AulaLida, b: AulaLida): boolean => a.inicio < b.fim && b.inicio < a.fim

/**
 * Os avisos de sobreposição, no mesmo dia: o professor em duas turmas no mesmo horário (aula conjunta) e a turma com duas aulas no mesmo
 * horário (turma dividida). As duas linhas de cada par levam o aviso; o do professor vem antes. Só as linhas sem erro entram.
 */
function avisosDe(linhas: readonly ClassificadaRow[]): Map<number, AvisoDaLinhaDeGrade> {
  const avisos = new Map<number, AvisoDaLinhaDeGrade>()
  const doProfessor = new Map<string, ClassificadaRow[]>()
  const daTurma = new Map<string, ClassificadaRow[]>()
  for (const linha of linhas) {
    if (linha.aula === undefined || linha.turma === undefined) continue
    const { dia, email } = linha.aula
    doProfessor.set(`${email}|${String(dia)}`, [...(doProfessor.get(`${email}|${String(dia)}`) ?? []), linha])
    daTurma.set(`${refDaTurma(linha.turma)}|${String(dia)}`, [...(daTurma.get(`${refDaTurma(linha.turma)}|${String(dia)}`) ?? []), linha])
  }
  const cruzar = (grupos: ReadonlyMap<string, readonly ClassificadaRow[]>, aviso: AvisoDaLinhaDeGrade, valeParaOPar: (a: ClassificadaRow, b: ClassificadaRow) => boolean): void => {
    for (const grupo of grupos.values()) {
      grupo.forEach((a, posicao) => {
        for (const b of grupo.slice(posicao + 1)) {
          if (a.aula === undefined || b.aula === undefined || !sobrepoe(a.aula, b.aula) || !valeParaOPar(a, b)) continue
          for (const { linha } of [a, b]) if (!avisos.has(linha)) avisos.set(linha, aviso)
        }
      })
    }
  }
  cruzar(doProfessor, 'professor_em_duas_turmas', (a, b) => a.turma !== undefined && b.turma !== undefined && refDaTurma(a.turma) !== refDaTurma(b.turma))
  cruzar(daTurma, 'turma_com_duas_aulas', () => true)
  return avisos
}

/** O que a escola já tem, indexado para achar cada parte da linha sem percorrer a lista. */
interface Indices {
  readonly turmasPorIndice: ReturnType<typeof indexarTurmas>
  readonly disciplinasPorChave: ReadonlyMap<string, Array<{ readonly id: string; readonly nome: string }>>
  readonly professoresPorEmail: ReadonlyMap<string, ProfessorDaEscola>
  readonly vinculosAbertos: ReadonlyMap<string, DadosDaGrade['vinculos'][number]>
  readonly aulasGravadas: ReadonlyMap<string, AulaGravada>
}

function indexar(dados: DadosDaGrade): Indices {
  const disciplinasPorChave = new Map<string, Array<{ readonly id: string; readonly nome: string }>>()
  for (const disciplina of dados.disciplinas) {
    const chave = chaveDaDisciplina(disciplina.nome)
    disciplinasPorChave.set(chave, [...(disciplinasPorChave.get(chave) ?? []), disciplina])
  }
  return {
    turmasPorIndice: indexarTurmas(dados.turmas),
    disciplinasPorChave,
    professoresPorEmail: new Map(dados.professores.flatMap((professor) => (professor.email === null ? [] : [[professor.email, professor] as const]))),
    vinculosAbertos: new Map(dados.vinculos.map((vinculo) => [JSON.stringify([vinculo.usuarioId, vinculo.turmaId, vinculo.disciplinaId]), vinculo])),
    aulasGravadas: new Map(dados.aulas.map((aula) => [JSON.stringify([aula.vinculoId, aula.diaSemana, aula.inicio]), aula])),
  }
}

interface Destinos {
  readonly turma: DestinoDaTurma
  readonly disciplina: DestinoDaDisciplina
  readonly professor: DestinoDoProfessor
}

/** O que cada uma das três partes da linha é no banco, ou o erro da primeira que não se resolve (turma, disciplina, professor). */
function destinosDaLinha(aula: AulaLida, indices: Indices): Destinos | ErroDaLinhaDeGrade {
  const turma = destinoDaTurma(aula.turma, indices.turmasPorIndice)
  if (typeof turma === 'string') return turma
  const disciplina = destinoDaDisciplina(aula.disciplina, indices.disciplinasPorChave)
  if (typeof disciplina === 'string') return disciplina
  const professor = destinoDoProfessor(aula, indices.professoresPorEmail)
  if (typeof professor === 'string') return professor
  return { turma, disciplina, professor }
}

/** O vínculo aberto da tripla, se as três partes já existem e há um; senão, o que nasce. */
function vinculoDaLinha({ turma, disciplina, professor }: Destinos, email: string, indices: Indices): VinculoDaLinha {
  const { usuarioId } = professor
  const existe = turma.tipo === 'existente' && disciplina.tipo === 'existente' && usuarioId !== null
  const aberto = existe ? indices.vinculosAbertos.get(JSON.stringify([usuarioId, turma.turmaId, disciplina.id])) : undefined
  return aberto === undefined ? { tipo: 'novo', chave: chaveDaTripla(turma, disciplina, email) } : { tipo: 'existente', id: aberto.id, estado: aberto.estado }
}

const trazAlgoNovo = ({ turma, disciplina, professor }: Destinos): boolean => turma.tipo === 'nova' || disciplina.tipo === 'nova' || professor.tipo === 'novo'

/** `novo` se a linha traz turma, disciplina ou professor que nasce; `ja_existe` se a aula gravada é a mesma; senão `entra` (nova aula, ou muda fim e sala). */
function resultadoDaLinha(destinos: Destinos, vinculo: VinculoDaLinha, aula: AulaLida, indices: Indices): Pick<ClassificadaRow, 'resultado' | 'gravada'> {
  const gravada = vinculo.tipo === 'existente' ? indices.aulasGravadas.get(JSON.stringify([vinculo.id, aula.dia, aula.inicio])) : undefined
  const igual = gravada !== undefined && gravada.fim === aula.fim && gravada.sala === aula.sala
  const resultado = trazAlgoNovo(destinos) ? 'novo' : igual ? 'ja_existe' : 'entra'
  return gravada === undefined ? { resultado } : { resultado, gravada }
}

function classificarLinha(aula: AulaLida, indices: Indices, vistas: Set<string>): ClassificadaRow {
  const { linha } = aula
  const destinos = destinosDaLinha(aula, indices)
  if (typeof destinos === 'string') return { linha, resultado: 'erro', erro: destinos }
  const vinculo = vinculoDaLinha(destinos, aula.email, indices)
  const chaveDaAula = JSON.stringify([vinculo.tipo === 'existente' ? vinculo.id : vinculo.chave, aula.dia, aula.inicio])
  if (vistas.has(chaveDaAula)) return { linha, resultado: 'erro', erro: 'aula_repetida' }
  vistas.add(chaveDaAula)
  return { linha, aula, ...destinos, vinculo, ...resultadoDaLinha(destinos, vinculo, aula, indices) }
}

type ResolvidaRow = ClassificadaRow & Required<Pick<ClassificadaRow, 'aula' | 'turma' | 'disciplina' | 'professor' | 'vinculo'>>

const resolvida = (linha: ClassificadaRow): linha is ResolvidaRow =>
  linha.aula !== undefined && linha.turma !== undefined && linha.disciplina !== undefined && linha.professor !== undefined && linha.vinculo !== undefined

const guardarSeNovo = <T>(mapa: Map<string, T>, chave: string, valor: T): void => {
  if (!mapa.has(chave)) mapa.set(chave, valor)
}

const emOrdemDe = <T extends { readonly chave: string }>(itens: Map<string, T>): T[] => [...itens.values()].sort((a, b) => (a.chave < b.chave ? -1 : 1))

/** O que nasce com a planilha, uma vez cada, em ordem estável: turmas, disciplinas, professores e vínculos. */
function novosDe(linhas: readonly ClassificadaRow[]): Pick<Classificacao, 'turmasNovas' | 'disciplinasNovas' | 'professoresNovos' | 'vinculosNovos'> {
  const turmas = new Map<string, TurmaNova>()
  const disciplinas = new Map<string, { readonly chave: string; readonly nome: string }>()
  const professores = new Map<string, { readonly email: string; readonly nome: string }>()
  const vinculos = new Map<string, { readonly chave: string; readonly turma: DestinoDaTurma; readonly disciplina: DestinoDaDisciplina; readonly email: string }>()
  for (const linha of linhas) {
    if (!resolvida(linha)) continue
    const { turma, disciplina, professor, vinculo, aula } = linha
    if (turma.tipo === 'nova') guardarSeNovo(turmas, turma.chave, { chave: turma.chave, nome: turma.nome, serie: turma.serie })
    if (disciplina.tipo === 'nova') guardarSeNovo(disciplinas, disciplina.chave, { chave: disciplina.chave, nome: disciplina.nome })
    if (professor.tipo === 'novo') guardarSeNovo(professores, professor.email, { email: professor.email, nome: professor.nome })
    if (vinculo.tipo === 'novo') guardarSeNovo(vinculos, vinculo.chave, { chave: vinculo.chave, turma, disciplina, email: aula.email })
  }
  return {
    turmasNovas: emOrdemDe(turmas),
    disciplinasNovas: emOrdemDe(disciplinas),
    professoresNovos: [...professores.values()].sort((a, b) => (a.email < b.email ? -1 : 1)),
    vinculosNovos: emOrdemDe(vinculos),
  }
}

/**
 * O que a planilha tira do ano (12.0, RF9): as aulas gravadas que nenhuma linha traz e os vínculos que ficaram sem aula. A aula que uma linha confirma ou
 * muda é a `gravada` dela; o vínculo que alguma linha reaproveita não sai. Candidato é o vínculo de professor aberto que nenhuma linha cita e que tem
 * aula gravada ou veio da grade: o criado à mão sem aula não é da grade e fica. O rótulo (professor, turma e disciplina) é só para a coordenação conferir.
 */
function saidasDe(linhas: readonly ClassificadaRow[], dados: DadosDaGrade): Pick<Classificacao, 'aulasQueSaem' | 'candidatos'> {
  const mantidas = new Set(linhas.flatMap(({ gravada }) => (gravada === undefined ? [] : [gravada.id])))
  const citados = new Set(linhas.flatMap(({ vinculo }) => (vinculo?.tipo === 'existente' ? [vinculo.id] : [])))
  const comAula = new Set(dados.aulas.map(({ vinculoId }) => vinculoId))
  const professores = new Map(dados.professores.map(({ usuarioId, nome }) => [usuarioId, nome]))
  const turmas = new Map(dados.turmas.map(({ id, nome }) => [id, nome]))
  const disciplinas = new Map(dados.disciplinas.map(({ id, nome }) => [id, nome]))
  const rotuloDe = ({ usuarioId, turmaId, disciplinaId }: DadosDaGrade['vinculos'][number]): string =>
    [professores.get(usuarioId), turmas.get(turmaId), disciplinaId === null ? undefined : disciplinas.get(disciplinaId)].filter((parte) => parte !== undefined).join(' · ')
  const candidatos = dados.vinculos.filter(({ id, origem }) => !citados.has(id) && (origem === 'grade' || comAula.has(id)))
  return {
    aulasQueSaem: dados.aulas.filter(({ id }) => !mantidas.has(id)).map(({ id }) => id),
    candidatos: candidatos.map((vinculo) => ({ id: vinculo.id, acao: 'encerrar', rotulo: rotuloDe(vinculo) })),
  }
}

/** A linha como a coordenação a viu: o resultado e o que cada parte é no banco. O erro e o aviso saem do resultado e da própria linha. */
function linhaVista({ linha, resultado, turma, disciplina, professor, vinculo, gravada }: ClassificadaRow): unknown[] {
  return [
    linha,
    resultado,
    turma === undefined ? null : refDaTurma(turma),
    disciplina === undefined ? null : refDaDisciplina(disciplina),
    professor === undefined ? null : [professor.tipo, professor.usuarioId, professor.estado],
    vinculo === undefined ? null : vinculo.tipo === 'existente' ? [vinculo.id, vinculo.estado] : vinculo.chave,
    gravada === undefined ? null : [gravada.id, gravada.fim, gravada.sala],
  ]
}

/**
 * O que a planilha faria neste ano contra o que a escola tem. A `assinatura` resume o que a coordenação viu (cada linha com o resultado, o
 * que cada uma das três partes é no banco, o vínculo e a aula que ela confirma ou muda): o job só grava se, no passo (3), ela é a mesma.
 * O desativar do professor, o vínculo encerrado ou criado à mão, a turma renomeada, a aula que entra ou sai do ano e o candidato a "sai da grade"
 * entre a prévia e o job mudam a assinatura. `semLeitura` é quantas linhas o texto trouxe e a leitura recusou: com elas, ou com erro de classificação, a
 * planilha não grava, e a prévia não diz o que sairia do ano.
 */
export function classificar(anoLetivoId: string, lidas: readonly AulaLida[], dados: DadosDaGrade, semLeitura = 0): Classificacao {
  const indices = indexar(dados)
  const vistas = new Set<string>()
  const classificadas = lidas.map((aula) => classificarLinha(aula, indices, vistas))
  const avisos = avisosDe(classificadas)
  const linhas = classificadas.map((linha): ClassificadaRow => {
    const aviso = avisos.get(linha.linha)
    return aviso === undefined ? linha : { ...linha, aviso }
  })
  const novos = novosDe(linhas)
  const { aulasQueSaem, candidatos } = semLeitura === 0 && linhas.every(({ resultado }) => resultado !== 'erro') ? saidasDe(linhas, dados) : { aulasQueSaem: [], candidatos: [] }
  const resumo = {
    aulas: linhas.filter(({ resultado }) => resultado === 'novo' || resultado === 'entra').length,
    ja_existem: linhas.filter(({ resultado }) => resultado === 'ja_existe').length,
    turmas_novas: novos.turmasNovas.length,
    disciplinas_novas: novos.disciplinasNovas.length,
    professores_novos: novos.professoresNovos.length,
    vinculos_criados: novos.vinculosNovos.length,
    ...(aulasQueSaem.length === 0 ? {} : { aulas_removidas: aulasQueSaem.length }),
  }
  const assinatura = createHash('sha256').update(JSON.stringify({ ano: anoLetivoId, linhas: linhas.map(linhaVista), saem: aulasQueSaem, candidatos: candidatos.map(({ id }) => id) })).digest('hex')
  return { linhas, aulasQueSaem, candidatos, ...novos, resumo, assinatura }
}

/** A linha como a coordenação a vê: o resultado, o erro (que a troca por `erro`) ou o aviso. */
function linhaDaPrevia({ linha, resultado, erro, aviso }: ClassificadaRow): PreviaDaPlanilhaRow {
  if (erro !== undefined) return { linha, resultado: 'erro', erro }
  return { linha, resultado, ...(aviso === undefined ? {} : { aviso }) }
}

/** O que a escola já tem para classificar a grade no ano: as turmas, as disciplinas, os professores, os vínculos de professor abertos e as aulas. */
async function lerDados(repositorio: ImportacaoRepository, anoLetivoId: string): Promise<DadosDaGrade> {
  return {
    turmas: await repositorio.turmasDoAno(anoLetivoId),
    disciplinas: await repositorio.disciplinasDaEscola(),
    professores: await repositorio.professoresDaEscola(),
    vinculos: await repositorio.vinculosDeProfessorDoAno(anoLetivoId),
    aulas: await repositorio.aulasDoAno(anoLetivoId),
  }
}

/** O plano do que o job grava, com o `aplicar` na transação do passo (3). As contas são as do passo (1): o `convidar` do professor novo usa a de cada e-mail. */
function planoDe(anoLetivoId: string, classificacao: Classificacao, contas: ContasDoJob, marcas: MarcasDaPlanilha): PlanoDaImportacao {
  const aEncerrar = [...marcas.encerrar].sort()
  return {
    assinatura: classificacao.assinatura,
    resumo: { ...classificacao.resumo, ...(aEncerrar.length === 0 ? {} : { vinculos_encerrados: aEncerrar.length }) },
    aplicar: async (gravacao, { tx }) => {
      const turmas = await criarTurmasNovas(gravacao, tx, anoLetivoId, classificacao.turmasNovas)
      const disciplinas = new Map<string, string>()
      for (const nova of classificacao.disciplinasNovas) disciplinas.set(nova.chave, await gravacao.criarDisciplina(nova.nome))
      for (const novo of classificacao.professoresNovos) {
        const contaId = contas.get(novo.email)
        if (contaId === undefined) throw new ContaDaPlanilhaPerdidaError()
        if (!(await convidarProfessorDaPlanilha(tx, { contaId, nome: novo.nome }))) throw new DiferencaNaPlanilhaError()
      }
      const usuarios = new Map((await gravacao.professoresDaEscola()).flatMap((professor) => (professor.email === null ? [] : [[professor.email, professor.usuarioId] as const])))
      const idDe = (id: string | undefined): string => {
        if (id === undefined) throw new InvariantException('grade com turma, disciplina ou professor sem id depois de criados')
        return id
      }
      const aCriar = classificacao.vinculosNovos.map(({ chave, turma, disciplina, email }) => ({
        chave,
        usuarioId: idDe(usuarios.get(email)),
        turmaId: turma.tipo === 'existente' ? turma.turmaId : idDe(turmas.get(turma.chave)),
        disciplinaId: disciplina.tipo === 'existente' ? disciplina.id : idDe(disciplinas.get(disciplina.chave)),
      }))
      const criados = await gravacao.criarVinculosDeProfessorDaGrade(anoLetivoId, aCriar)
      const idDaTripla = new Map(criados.map(({ id, usuarioId, turmaId, disciplinaId }) => [JSON.stringify([usuarioId, turmaId, disciplinaId]), id]))
      for (const { id, usuarioId, turmaId, disciplinaId } of criados) {
        await registro.gravar(tx, 'vinculo.criado', { entidadeId: id, depois: { usuarioId, turmaId, disciplinaId, papel: 'professor', estado: 'pendente', origem: 'grade' } })
      }
      const idDoVinculoNovo = new Map(aCriar.map(({ chave, usuarioId, turmaId, disciplinaId }) => [chave, idDe(idDaTripla.get(JSON.stringify([usuarioId, turmaId, disciplinaId])))]))
      const aulas = classificacao.linhas.flatMap(({ aula, vinculo, resultado }): AulaNova[] => {
        if (aula === undefined || vinculo === undefined || resultado === 'ja_existe') return []
        return [{ vinculoId: vinculo.tipo === 'existente' ? vinculo.id : idDe(idDoVinculoNovo.get(vinculo.chave)), diaSemana: aula.dia, inicio: aula.inicio, fim: aula.fim, sala: aula.sala }]
      })
      // A grade do ano é a da planilha: a aula que nenhuma linha traz sai antes de as outras entrarem. Menos apagadas que lidas é diferença.
      if ((await gravacao.apagarAulas(anoLetivoId, classificacao.aulasQueSaem)) !== classificacao.aulasQueSaem.length) throw new DiferencaNaPlanilhaError()
      await gravacao.gravarAulas(anoLetivoId, aulas)
      await encerrarOsMarcados(gravacao, tx, anoLetivoId, aEncerrar)
    },
  }
}

/**
 * O "sai da grade" que a coordenação marcou: o mesmo caminho do `encerrar` (Tech Spec, seção 5, "Gravar"). O vínculo vai a `encerrado` por `realocacao`
 * (`vinculo.encerrado`, com a origem `grade`), e o acesso que o professor gerou naquela turma cai, a menos que outro vínculo confirmado dele a segure
 * (`acesso_turma.revogado`). As turmas já estão travadas pelo `travar`. Vínculo que já não está aberto (encerrado à mão entre o (2) e o (3)) é diferença.
 */
async function encerrarOsMarcados(gravacao: ImportacaoRepository, tx: DatabaseTransaction, anoLetivoId: string, ids: readonly string[]): Promise<void> {
  const encerrados = await gravacao.encerrarVinculosDeProfessorDaGrade(anoLetivoId, ids, 'realocacao')
  if (encerrados.length !== ids.length) throw new DiferencaNaPlanilhaError()
  const ciclo = new CicloDeVidaRepository(tx)
  for (const { id, usuarioId, turmaId, estadoAntes } of encerrados) {
    await registro.gravar(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: estadoAntes }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'grade' } })
    for (const revogado of await ciclo.revogarDeQuemSaiu(usuarioId, turmaId)) await registro.gravar(tx, 'acesso_turma.revogado', { entidadeId: revogado.id, depois: { turmaId: revogado.turmaId } })
  }
}

/** Todas as turmas do ano que as linhas pedem, também a ambígua: é o que o passo (3) trava. */
function turmasTocadas(lidas: readonly AulaLida[], turmas: readonly TurmaDoAno[]): string[] {
  const porIndice = indexarTurmas(turmas)
  const ids = new Set<string>()
  for (const { turma } of lidas) for (const achada of porIndice.get(indiceDaTurma(turma, null)) ?? []) ids.add(achada.id)
  return [...ids].sort()
}

export const tipoGrade: TipoDeImportacao = {
  tipo: 'grade',
  usaTurma: false,
  usaAno: true,
  cadastraProfessores: true,

  async previa(repositorio, ano, texto): Promise<PreviaDoTipo> {
    const tabela = lerTabela(texto, CABECALHOS_DA_PLANILHA.grade)
    const lidas = tabela.linhas.map(({ linha, campos }) => ({ linha, lido: campos === null ? ('linha_incompleta' as const) : lerLinha(linha, campos) }))
    const validas = lidas.flatMap(({ lido }) => (typeof lido === 'string' ? [] : [lido]))
    const classificacao = classificar(ano.id, validas, await lerDados(repositorio, ano.id), lidas.length - validas.length)
    const dosErros = lidas.flatMap(({ linha, lido }): PreviaDaPlanilhaRow[] => (typeof lido === 'string' ? [{ linha, resultado: 'erro', erro: lido }] : []))
    const linhas = [...dosErros, ...classificacao.linhas.map(linhaDaPrevia)].sort((a, b) => a.linha - b.linha)
    return { linhas, contagens: classificacao.resumo, candidatos: classificacao.candidatos, guardado: validas, assinatura: classificacao.assinatura }
  },

  /** Os professores das linhas que a escola ainda não tem, ou chama de volta (`revogado`, `desativado`): as contas que o passo (1) acha ou cria. */
  async emailsDasContas(repositorio, guardado) {
    const lido = guardadoSchema.safeParse(guardado)
    if (!lido.success) return undefined
    const porEmail = new Map((await repositorio.professoresDaEscola()).flatMap((professor) => (professor.email === null ? [] : [[professor.email, professor.estado] as const])))
    const emails = new Set(lido.data.map(({ email }) => email))
    return [...emails].filter((email) => {
      const estado = porEmail.get(email)
      return estado === undefined || ESTADOS_QUE_VOLTAM.has(estado)
    })
  },

  /**
   * A trava do passo (3), depois do ano e na ordem global (o convite da escola veio antes, pelo motor): os professores que as linhas citam
   * (`FOR NO KEY UPDATE`, em ordem de id: o `desativar` e o aceite esperam), as contas dos novos (`FOR SHARE`, com o e-mail conferido) e as turmas que as
   * linhas tocam, em ordem de id e num comando só, como o `desativar` as trava. O professor e a turma de cada vínculo marcado "sai da grade" entram nas
   * mesmas travas (a turma antes do vínculo, como o `encerrar`). O `planejar` lê depois, sob as travas.
   */
  async travar(repositorio, ano, guardado, marcas, { contas, travarContas }) {
    const lido = guardadoSchema.safeParse(guardado)
    if (!lido.success) return
    const emails = new Set(lido.data.map(({ email }) => email))
    const marcados = new Set(marcas.encerrar)
    const aEncerrar = marcados.size === 0 ? [] : (await repositorio.vinculosDeProfessorDoAno(ano.id)).filter(({ id }) => marcados.has(id))
    const professores = await repositorio.professoresDaEscola()
    const usuarios = new Set([...professores.filter(({ email }) => email !== null && emails.has(email)).map(({ usuarioId }) => usuarioId), ...aEncerrar.map(({ usuarioId }) => usuarioId)])
    await repositorio.travarUsuarios([...usuarios])
    if (contas.size > 0 && !(await travarContas(contas))) throw new ContaDaPlanilhaPerdidaError()
    const turmas = new Set([...turmasTocadas(lido.data, await repositorio.turmasDoAno(ano.id)), ...aEncerrar.map(({ turmaId }) => turmaId)])
    await repositorio.travarTurmas(ano.id, [...turmas].sort())
  },

  async planejar(repositorio, ano, guardado, marcas, contas = new Map()) {
    const lido = guardadoSchema.safeParse(guardado)
    return lido.success ? planoDe(ano.id, classificar(ano.id, lido.data, await lerDados(repositorio, ano.id)), contas, marcas) : undefined
  },
}
