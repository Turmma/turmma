import { createHash } from 'node:crypto'
import {
  CABECALHOS_DA_PLANILHA,
  chaveDaTurma,
  ErrorCode,
  InvariantException,
  matriculaDigitadaSchema,
  matriculasQueParecemDocumento,
  nomeDigitadoSchema,
  serieDaChave,
  type CandidatoDaMarca,
  type CriarSerieRequest,
  type Etapa,
  type MarcasDaPlanilha,
  type PreviaDaPlanilhaRow,
  type ResumoDaImportacao,
} from '@educa/shared'
import { z } from 'zod'
import type { CicloDeVidaService } from '../../ciclo-de-vida/ciclo-de-vida.service.js'
import { AuditoriaRecorder } from '../../auditoria/auditoria-recorder.js'
import { CicloDeVidaRepository } from '../../ciclo-de-vida/ciclo-de-vida.repository.js'
import type { DatabaseTransaction } from '../../db/database.js'
import { DomainException } from '../../error/domain.exception.js'
import type { AlunoAprovado, AlunoDaVirada, AlunosParaReimportar, NomeNaoAprovado } from '../../estrutura/lista.repository.js'
import type { TurmaDoAno } from '../../estrutura/turma.repository.js'
import { DiferencaNaPlanilhaError } from '../erros.js'
import type { AnoDeDestino, ImportacaoRepository } from '../importacao.repository.js'
import { lerTabela, normalizarTexto } from '../leitor.js'
import type { PlanoDaImportacao, PreviaDoTipo, TipoDeImportacao } from '../tipo.js'

/**
 * A planilha de alunos (F2, 7.0 e 8.0, RF2 a RF4; Tech Spec, seção 5, "Planilha" e "Gravar", "Alunos"): turma, nome e matrícula de
 * cada aluno, até 3.000 linhas. A turma é achada pela `chave` do nome ("8ºA", "8 A" e "8a" são a mesma), a turma que a escola não
 * tem nasce na série que o nome diz, e quem tem matrícula nova entra na lista de nomes da turma, `livre`, para reivindicar o
 * próprio nome (regra 60, item 7). O aluno não ganha usuário aqui.
 *
 * - **Reimportar atualiza sem duplicar, pela matrícula (8.0).** A matrícula que a escola já tem neste ano diz o que a linha faria:
 *   "já existe" (mesmo nome, mesma turma), "nome corrigido" (mesma turma, outro nome: o do aprovado vai ao `usuario.nome`, o do não
 *   aprovado à `lista_nome`) ou "muda de turma" (outra turma: candidato a marca; com a marca da coordenação, a transferência da 9.0:
 *   o vínculo antigo é encerrado por `realocacao`, o novo nasce confirmado, a linha da lista vai à turma nova e o pedido pendente é
 *   encerrado sem decisão; o trabalho feito fica na turma antiga). O aluno da turma que a
 *   planilha cita e que ela não traz é candidato a "fora da planilha" (marca de desligar): só os das turmas citadas, para a planilha
 *   de uma série não oferecer a escola inteira. Com a marca (10.0), o aprovado é desligado pelo `desativar` do ciclo de vida (vínculos
 *   encerrados, sessões derrubadas, senha apagada), na transação do passo (3); o não aprovado sai da lista de nomes, depois de o
 *   pedido pendente dele ser encerrado sem decisão. Sem marca nada muda, a não ser o nome corrigido.
 * - **A virada de ano (10.0).** Na planilha do ano **planejado**, a matrícula de aluno que a escola já tem pela credencial e que não
 *   tem linha `aprovado` neste ano "volta": ganha vínculo confirmado na turma da linha (origem `lista`) e a linha `aprovado` da lista,
 *   com o mesmo `usuario` e a mesma credencial (o mesmo login), sem a marca da coordenação, porque não tira nada de ninguém. Quem já
 *   tem vínculo aberto no ano segue "já existe", e o aluno desativado sem linha no ano é erro de linha (`aluno_desativado`): a
 *   coordenação decide, fora da planilha, se ele deixa de estar desligado. O vínculo do ano encerrado não é tocado. No ano em curso a
 *   regra não vale: o aluno sem linha ali segue "já existe" (a 8.0).
 * - **A lista de uma turma (A1) é a mesma planilha com a turma dada** (`previaDaLista`): as linhas vêm do formato da A1, sem coluna
 *   de turma, e a turma é a do caminho, conferida na escola e no ano.
 * - **A turma é achada pela `chave`; sem ela, pelo nome.** A `chave` da turma é nula onde a migration encontrou duas de mesma chave
 *   no ano: a classificação a calcula pelo nome, e as duas aparecem juntas, "turma ambígua" (erro na linha). Nome fora do padrão
 *   ("Turma Azul") só casa com turma de mesmo nome; "10A", "4A" e nome sem série que a escola não tem são erro, nunca "turma nova".
 * - **Turma renomeada deixa de casar pelo nome antigo**: "8A" renomeada para "9B" tem a chave `9b`, a planilha com "8A" cria uma
 *   turma nova e a com "9B" casa com ela (a chave é recalculada na renomeação).
 * - **A matrícula é a do documento da escola, nunca a do Excel**: notação científica (`1,2345E+11`) e a que parece CPF ou data são
 *   erro de linha (regra 20, item 2); a matrícula repetida na planilha é erro nas duas linhas.
 * - **Nada grava com erro** (o motor recusa o gravar), e o que o erro diz é código de lista fechada, nunca o dado da linha.
 */

const registro = new AuditoriaRecorder()

/** A matrícula que o Excel gravou como número grande: `1,2345E+11`, `1.2345e11`. No XLSX o leitor devolve texto; no CSV chega assim. */
const NOTACAO_CIENTIFICA = /^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i

/**
 * A linha completa da planilha, com os campos sem espaço nas pontas: o que o gravar guarda até o job, e o job relê. Na lista de uma
 * turma (A1) a linha traz o `turmaId` dado no caminho, e `turma` fica vazia.
 */
const linhaGuardadaSchema = z.strictObject({
  linha: z.number().int().positive(),
  turma: z.string(),
  nome: z.string(),
  matricula: z.string(),
  turmaId: z.uuid().optional(),
})
const guardadoSchema = z.array(linhaGuardadaSchema)

type LidaRow = z.infer<typeof linhaGuardadaSchema>

/** Os códigos de erro de linha: palavra de lista fechada, nunca texto com o dado da linha. */
type ErroDaLinhaDeAluno =
  | 'linha_incompleta'
  | 'turma_vazia'
  | 'sem_nome'
  | 'nome_invalido'
  | 'sem_matricula'
  | 'matricula_invalida'
  | 'matricula_notacao_cientifica'
  | 'matricula_parece_documento'
  | 'matricula_repetida'
  | 'turma_invalida'
  | 'turma_ambigua'
  | 'aluno_desativado'

/** Para onde a linha vai: uma turma da escola neste ano, ou a que a planilha cria, com a série que a chave diz. */
type Destino = { readonly tipo: 'existente'; readonly turmaId: string } | { readonly tipo: 'nova'; readonly chave: string; readonly serie: Serie }

/**
 * O que a linha faria: `entra` (matrícula nova), `ja_existe`, `nome_corrigido`, `muda_de_turma` (candidato a marca), `volta` (o aluno
 * do ano anterior na planilha do planejado) ou `erro`.
 */
type ResultadoDaLinha = 'entra' | 'ja_existe' | 'nome_corrigido' | 'muda_de_turma' | 'volta' | 'erro'

/**
 * Quem a matrícula é hoje na escola, neste ano: o nome ainda não aprovado (a linha da lista, no `estado` que a escrita confere) ou o
 * aluno aprovado (o `usuario`). O `nome` é o do banco, e é com ele que a planilha se compara.
 */
type Alvo =
  | { readonly tipo: 'lista'; readonly id: string; readonly estado: 'livre' | 'reivindicado'; readonly nome: string; readonly turmaId: string }
  | { readonly tipo: 'usuario'; readonly id: string; readonly nome: string; readonly turmaId: string }

interface ClassificadaRow {
  readonly linha: number
  readonly resultado: ResultadoDaLinha
  readonly erro?: ErroDaLinhaDeAluno
  readonly destino?: Destino
  readonly alvo?: Alvo
  /** O aluno que `volta`: o `usuario` que a credencial da matrícula achou. */
  readonly volta?: string
  readonly nome: string
  readonly matricula: string
}

/** A série que o nome da turma diz: 6º ao 9º do Ensino Fundamental, 1º ao 3º do Médio. */
export interface Serie {
  readonly etapa: Etapa
  readonly ano: number
}

/** A turma que a planilha cria: a chave, o nome na grafia da primeira linha que a pediu e a série que a chave diz. */
export interface TurmaNova {
  readonly chave: string
  readonly nome: string
  readonly serie: Serie
}

/**
 * O candidato a marca com a turma de onde o nome foi lido, que a auditoria da prévia conta, e quem ele é no banco (`alvo`): o estado
 * lido do nome ainda não aprovado é a condição da escrita que o tira da lista.
 */
interface CandidatoLido extends CandidatoDaMarca {
  readonly turmaId: string
  readonly alvo: Alvo
}

interface Classificacao {
  readonly linhas: readonly ClassificadaRow[]
  readonly novas: readonly TurmaNova[]
  /** As turmas que só uma linha "muda de turma" pede: nascem se, e só se, a coordenação marcou uma transferência para elas. */
  readonly novasDeTransferencia: readonly TurmaNova[]
  readonly candidatos: readonly CandidatoLido[]
  readonly resumo: ResumoDaImportacao
  readonly assinatura: string
}

/** O que a escola já tem de aluno neste ano, para as matrículas e as turmas da planilha. Vazio quando a classificação não precisa dele. */
const SEM_ALUNOS: AlunosParaReimportar = { naoAprovados: [], aprovados: [] }

/** O nome da turma como a planilha o escreveu: sem espaço a mais. */
export function nomeDaTurma(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

/**
 * Por onde a turma se acha: a `chave` do nome ("8ºA" → `8a`), ou, se o nome não tem o padrão, o próprio nome sem acento nem
 * caixa (`n:turma azul`). A turma da escola usa a `chave` gravada, ou a calculada pelo nome quando ela é nula.
 */
export function indiceDaTurma(nome: string, chave: string | null): string {
  const doNome = chaveDaTurma(nome)
  return chave ?? doNome ?? `n:${normalizarTexto(nome)}`
}

export function indexarTurmas(turmas: readonly TurmaDoAno[]): Map<string, TurmaDoAno[]> {
  const porIndice = new Map<string, TurmaDoAno[]>()
  for (const turma of turmas) {
    const indice = indiceDaTurma(turma.nome, turma.chave)
    porIndice.set(indice, [...(porIndice.get(indice) ?? []), turma])
  }
  return porIndice
}

/**
 * Todas as turmas do ano que as linhas pedem, também as das linhas com erro e as de duas turmas de mesma chave: é o que se trava
 * e o que se lê de aluno. Na lista de uma turma, a turma dada.
 */
function turmasTocadas(lidas: readonly LidaRow[], turmas: readonly TurmaDoAno[]): string[] {
  const porIndice = indexarTurmas(turmas)
  const ids = new Set<string>()
  for (const { turma, turmaId } of lidas) {
    if (turmaId !== undefined) {
      if (turmas.some((conhecida) => conhecida.id === turmaId)) ids.add(turmaId)
    } else for (const achada of porIndice.get(indiceDaTurma(turma, null)) ?? []) ids.add(achada.id)
  }
  return [...ids].sort()
}

/** O erro da linha que se vê sem o banco, na posição dela, ou `undefined`. A ordem é a em que a coordenação corrige. */
function errosDoTexto(lidas: readonly LidaRow[]): Array<ErroDaLinhaDeAluno | undefined> {
  const parecemDocumento = matriculasQueParecemDocumento(lidas.map((lida) => lida.matricula))
  const doCampo = lidas.map(({ turma, turmaId, nome, matricula }, posicao): ErroDaLinhaDeAluno | undefined => {
    if (turma === '' && turmaId === undefined) return 'turma_vazia'
    if (nome === '') return 'sem_nome'
    if (!nomeDigitadoSchema.safeParse(nome).success) return 'nome_invalido'
    if (matricula === '') return 'sem_matricula'
    if (!matriculaDigitadaSchema.safeParse(matricula).success) return 'matricula_invalida'
    if (NOTACAO_CIENTIFICA.test(matricula)) return 'matricula_notacao_cientifica'
    return parecemDocumento[posicao] === true ? 'matricula_parece_documento' : undefined
  })
  const vezes = new Map<string, number>()
  for (const { matricula } of lidas) vezes.set(matricula, (vezes.get(matricula) ?? 0) + 1)
  return lidas.map(({ matricula }, posicao) => doCampo[posicao] ?? ((vezes.get(matricula) ?? 0) > 1 ? 'matricula_repetida' : undefined))
}

/**
 * A turma que a linha pede: a da escola neste ano, a que nasce, ou o erro (nome sem turma e sem série, duas turmas de mesma chave).
 * O nome que passa pela `chave` é curto: o formato tem um dígito, o ordinal, "ano" e uma letra. Na lista de uma turma, a turma
 * dada, que some da escola ou do ano (`turma_invalida`) só entre a prévia e o job.
 */
function destinoDaLinha(lida: LidaRow, porIndice: ReadonlyMap<string, readonly TurmaDoAno[]>, turmas: readonly TurmaDoAno[]): Destino | ErroDaLinhaDeAluno {
  if (lida.turmaId !== undefined) return turmas.some((turma) => turma.id === lida.turmaId) ? { tipo: 'existente', turmaId: lida.turmaId } : 'turma_invalida'
  const indice = indiceDaTurma(lida.turma, null)
  const achadas = porIndice.get(indice) ?? []
  if (achadas.length > 1) return 'turma_ambigua'
  const [unica] = achadas
  if (unica !== undefined) return { tipo: 'existente', turmaId: unica.id }
  const serie = serieDaChave(indice)
  return serie === null ? 'turma_invalida' : { tipo: 'nova', chave: indice, serie }
}

/** A turma que a planilha cria para esse destino, com o nome na grafia da linha que a pediu primeiro. */
function turmaNova(destino: Extract<Destino, { tipo: 'nova' }>, escrita: string): TurmaNova {
  return { chave: destino.chave, nome: nomeDaTurma(escrita), serie: destino.serie }
}

/** Guarda a turma que a linha pede criar, na grafia da primeira linha que a pediu; o destino que já existe não cria nada. */
function lembrarTurmaNova(porChave: Map<string, TurmaNova>, destino: Destino, escrita: string): void {
  if (destino.tipo === 'nova' && !porChave.has(destino.chave)) porChave.set(destino.chave, turmaNova(destino, escrita))
}

/**
 * A linha de quem já tem conta na escola mas não está na lista do ano. A virada de ano: só o ano planejado traz `daVirada`. O aluno
 * desativado sem linha no ano é erro; o ativo sem vínculo aberto "volta"; os demais já existem.
 */
function linhaDeQuemTemConta(lida: LidaRow, destino: Destino, doAno: AlunoDaVirada | undefined, novasPorChave: Map<string, TurmaNova>): ClassificadaRow {
  const { linha, turma, nome, matricula } = lida
  if (doAno?.desativado === true) return { linha, resultado: 'erro', erro: 'aluno_desativado', nome, matricula }
  if (doAno === undefined || doAno.comVinculo) return { linha, resultado: 'ja_existe', destino, nome, matricula }
  lembrarTurmaNova(novasPorChave, destino, turma)
  return { linha, resultado: 'volta', destino, volta: doAno.usuarioId, nome, matricula }
}

/**
 * O que a coordenação viu, resumido: cada linha com o resultado, o erro, a turma de destino e quem a matrícula é no banco (o id, o
 * estado, o nome e a turma). É a assinatura que o job confere no passo (3): a aprovação do mesmo nome, o pedido novo ou o nome
 * trocado à mão entre a prévia e o job mudam o alvo, e a importação sai `desatualizada`.
 */
function assinaturaDe(anoLetivoId: string, linhas: readonly ClassificadaRow[]): string {
  const destinoDe = (destino: Destino | undefined) => (destino === undefined ? null : destino.tipo === 'existente' ? destino.turmaId : `nova:${destino.chave}`)
  const alvoDe = (alvo: Alvo | undefined) => (alvo === undefined ? null : [alvo.tipo, alvo.id, alvo.tipo === 'lista' ? alvo.estado : null, alvo.nome, alvo.turmaId])
  // O aluno que volta entra na assinatura só quando há um, e as linhas sem ele guardam a mesma forma de antes.
  const vistas = linhas.map(({ linha, resultado, erro, destino, alvo, volta }) => [linha, resultado, erro ?? null, destinoDe(destino), alvoDe(alvo), ...(volta === undefined ? [] : [volta])])
  return createHash('sha256').update(JSON.stringify({ ano: anoLetivoId, linhas: vistas })).digest('hex')
}

/** Quem a matrícula é hoje: o aprovado primeiro (a credencial é de quem já entrou), senão o nome ainda não aprovado. */
function alvoDaMatricula(matricula: string, naLista: ReadonlyMap<string, NomeNaoAprovado>, aprovados: ReadonlyMap<string, AlunoAprovado>): Alvo | undefined {
  const aprovado = aprovados.get(matricula)
  if (aprovado !== undefined) return { tipo: 'usuario', id: aprovado.usuarioId, nome: aprovado.nome, turmaId: aprovado.turmaId }
  const nao = naLista.get(matricula)
  return nao === undefined ? undefined : { tipo: 'lista', id: nao.id, estado: nao.estado, nome: nao.nome, turmaId: nao.turmaId }
}

/** O que uma linha com alvo faz: outra turma é candidato a marca; na mesma turma, o nome diferente é corrigido, e o igual já existe. */
function resultadoComAlvo(destino: Destino, alvo: Alvo, nome: string): ResultadoDaLinha {
  if (destino.tipo !== 'existente' || destino.turmaId !== alvo.turmaId) return 'muda_de_turma'
  return nome === alvo.nome ? 'ja_existe' : 'nome_corrigido'
}

/**
 * Os candidatos a marca (PRD, RF4): quem a planilha põe em outra turma (`transferir`) e quem é das turmas que ela cita e não está
 * nela (`desligar`). O rótulo traz o nome do banco e a matrícula, só para a coordenação conferir; o id é o que ela devolve em
 * `marcas`. Sem marca, nada disto grava (a 9.0 e a 10.0 dão efeito à marca).
 */
function candidatosDe(linhas: readonly ClassificadaRow[], alunos: AlunosParaReimportar, matriculasDaPlanilha: ReadonlySet<string>): CandidatoLido[] {
  const rotulo = (nome: string, matricula: string) => `${nome} (${matricula})`
  const transferir = linhas.flatMap(({ resultado, alvo, matricula }): CandidatoLido[] =>
    resultado === 'muda_de_turma' && alvo !== undefined ? [{ id: alvo.id, acao: 'transferir', rotulo: rotulo(alvo.nome, matricula), turmaId: alvo.turmaId, alvo }] : [],
  )
  const citadas = new Set(linhas.flatMap(({ destino }) => (destino?.tipo === 'existente' ? [destino.turmaId] : [])))
  const ausentes = [
    ...alunos.naoAprovados.flatMap(({ id, turmaId, nome, matricula, estado }): CandidatoLido[] =>
      citadas.has(turmaId) && !matriculasDaPlanilha.has(matricula) ? [{ id, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId, alvo: { tipo: 'lista', id, estado, nome, turmaId } }] : [],
    ),
    ...alunos.aprovados.flatMap(({ usuarioId, turmaId, nome, matricula }): CandidatoLido[] =>
      citadas.has(turmaId) && !matriculasDaPlanilha.has(matricula) ? [{ id: usuarioId, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId, alvo: { tipo: 'usuario', id: usuarioId, nome, turmaId } }] : [],
    ),
  ]
  return [...transferir, ...ausentes.sort((a, b) => (a.id < b.id ? -1 : 1))]
}

/**
 * O que a planilha faria neste ano contra as turmas dele e o que a escola já tem de aluno. A `assinatura` resume o que a
 * coordenação viu (cada linha com o resultado, a turma de destino e quem a matrícula é): o job só grava se, no passo (3), ela é a mesma.
 */
export function classificar(
  anoLetivoId: string,
  lidas: readonly LidaRow[],
  turmas: readonly TurmaDoAno[],
  emUso: ReadonlySet<string>,
  alunos: AlunosParaReimportar = SEM_ALUNOS,
  daVirada?: ReadonlyMap<string, AlunoDaVirada>,
): Classificacao {
  const porIndice = indexarTurmas(turmas)
  const naLista = new Map(alunos.naoAprovados.map((nome) => [nome.matricula, nome]))
  const aprovados = new Map(alunos.aprovados.map((aluno) => [aluno.matricula, aluno]))
  const doTexto = errosDoTexto(lidas)
  const novasPorChave = new Map<string, TurmaNova>()
  const daTransferenciaPorChave = new Map<string, TurmaNova>()
  const linhas = lidas.map((lida, posicao): ClassificadaRow => {
    const { linha, turma, nome, matricula } = lida
    const erroDoTexto = doTexto[posicao]
    if (erroDoTexto !== undefined) return { linha, resultado: 'erro', erro: erroDoTexto, nome, matricula }
    const destino = destinoDaLinha(lida, porIndice, turmas)
    if (typeof destino === 'string') return { linha, resultado: 'erro', erro: destino, nome, matricula }
    const alvo = alvoDaMatricula(matricula, naLista, aprovados)
    if (alvo !== undefined) {
      const resultado = resultadoComAlvo(destino, alvo, nome)
      if (resultado === 'muda_de_turma') lembrarTurmaNova(daTransferenciaPorChave, destino, turma)
      return { linha, resultado, destino, alvo, nome, matricula }
    }
    if (emUso.has(matricula)) return linhaDeQuemTemConta(lida, destino, daVirada?.get(matricula), novasPorChave)
    lembrarTurmaNova(novasPorChave, destino, turma)
    return { linha, resultado: 'entra', destino, nome, matricula }
  })
  const quantas = (resultado: ResultadoDaLinha) => linhas.filter((linha) => linha.resultado === resultado).length
  const novas = [...novasPorChave.values()].sort((a, b) => (a.chave < b.chave ? -1 : 1))
  const novasDeTransferencia = [...daTransferenciaPorChave.values()].filter(({ chave }) => !novasPorChave.has(chave)).sort((a, b) => (a.chave < b.chave ? -1 : 1))
  const corrigidos = quantas('nome_corrigido')
  const voltam = quantas('volta')
  // A contagem que não houve não entra: o `resumo` guarda só o que a planilha fez (a chave ausente vale zero).
  const resumo = { entram: quantas('entra'), ja_existem: quantas('ja_existe'), ...(corrigidos > 0 ? { nomes_corrigidos: corrigidos } : {}), ...(voltam > 0 ? { voltam } : {}), turmas_novas: novas.length }
  const candidatos = candidatosDe(linhas, alunos, new Set(lidas.map((lida) => lida.matricula)))
  return { linhas, novas, novasDeTransferencia, candidatos, resumo, assinatura: assinaturaDe(anoLetivoId, linhas) }
}

/**
 * Lê o que o gravar guardou e o classifica contra o banco de agora: seis consultas no máximo (turmas, as matrículas em uso, os nomes, os
 * aprovados e, no ano planejado, os alunos da virada), qualquer que seja o número de linhas. `turmas` já lidas, quando quem chama as tinha.
 */
async function classificarAgora(repositorio: ImportacaoRepository, ano: AnoDeDestino, lidas: readonly LidaRow[], turmasLidas?: readonly TurmaDoAno[]): Promise<Classificacao> {
  const turmas = turmasLidas ?? (await repositorio.turmasDoAno(ano.id))
  const matriculas = [...new Set(lidas.map((lida) => lida.matricula).filter((matricula) => matricula !== ''))]
  const emUso = await repositorio.matriculasEmUso(ano.id, matriculas)
  const alunos = await repositorio.alunosParaReimportar(ano.id, matriculas, turmasTocadas(lidas, turmas))
  // A virada de ano só existe no ano planejado: no em curso a consulta nem é feita, e a matrícula sem linha no ano segue "já existe".
  const daVirada = ano.situacao === 'planejado' ? new Map((await repositorio.alunosDaVirada(ano.id, matriculas)).map((aluno) => [aluno.matricula, aluno])) : undefined
  return classificar(ano.id, lidas, turmas, emUso, alunos, daVirada)
}

/** O id da turma de destino da linha que entra: a da escola, ou a que acabou de nascer. */
function idDaTurma(destino: Destino | undefined, novas: ReadonlyMap<string, string>): string {
  const id = destino?.tipo === 'existente' ? destino.turmaId : novas.get(destino?.chave ?? '')
  if (id === undefined) throw new InvariantException('linha que entra sem turma de destino')
  return id
}

/** O pedido de série para a etapa e o ano que o nome da turma disse. */
export function pedidoDaSerie({ etapa, ano }: Serie): CriarSerieRequest {
  return etapa === 'em' ? { etapa: 'em', ano } : { etapa: 'ef_anos_finais', ano }
}

/**
 * Corrige os nomes que a planilha trouxe diferentes (RF4), em lote, cada um só se o banco segue como a planilha o leu: o aprovado
 * no `usuario`, o não aprovado na `lista_nome` com o estado lido. Menos linhas mudadas que pedidas é diferença (a aprovação do mesmo
 * nome, a desativação ou a troca à mão chegaram antes), e o motor fecha a importação `desatualizada`. Audita por aluno, sem nome.
 */
async function corrigirNomes(gravacao: ImportacaoRepository, tx: DatabaseTransaction, anoLetivoId: string, linhas: readonly ClassificadaRow[]): Promise<void> {
  const corrigidas = linhas.flatMap(({ alvo, nome, resultado }) => (resultado === 'nome_corrigido' && alvo !== undefined ? [{ alvo, nome }] : []))
  const daLista = corrigidas.flatMap(({ alvo, nome }) => (alvo.tipo === 'lista' ? [{ id: alvo.id, estadoLido: alvo.estado, nome }] : []))
  const dosAlunos = corrigidas.flatMap(({ alvo, nome }) => (alvo.tipo === 'usuario' ? [{ usuarioId: alvo.id, nomeLido: alvo.nome, nome }] : []))
  if ((await gravacao.corrigirNomesNaLista(anoLetivoId, daLista)) !== daLista.length) throw new DiferencaNaPlanilhaError()
  if ((await gravacao.corrigirNomesDosAlunos(dosAlunos)) !== dosAlunos.length) throw new DiferencaNaPlanilhaError()
  for (const { id } of daLista) await registro.gravar(tx, 'lista.nome_corrigido', { entidadeId: id })
  for (const { usuarioId } of dosAlunos) await registro.gravar(tx, 'usuario.nome_corrigido', { entidadeId: usuarioId })
}

/** Uma transferência marcada: a matrícula "muda de turma" que a coordenação marcou, com quem ela é no banco e a turma para onde vai. */
interface Transferencia {
  readonly alvo: Alvo
  readonly destino: Destino
}

/** As linhas "muda de turma" cujo alvo a coordenação marcou em `transferir`: sem a marca, a linha não grava nada. */
function transferenciasDe(linhas: readonly ClassificadaRow[], marcas: MarcasDaPlanilha): Transferencia[] {
  const marcadas = new Set(marcas.transferir)
  return linhas.flatMap(({ resultado, alvo, destino }) => (resultado === 'muda_de_turma' && alvo !== undefined && destino !== undefined && marcadas.has(alvo.id) ? [{ alvo, destino }] : []))
}

/**
 * Passa os marcados à turma de destino (RF5; Tech Spec, seção 5, "Gravar"), na transação do passo (3), com as turmas, os usuários e os
 * pedidos já travados. O nome ainda não aprovado vai `livre` à turma nova, e o pedido pendente dele é encerrado antes (a
 * escrita confere o estado e a turma que a planilha leu). O aluno aprovado tem o vínculo encerrado por `realocacao`, o novo
 * confirmado na turma nova e a linha da lista levada junto; o trabalho que ele fez fica na turma antiga, onde foi feito. Menos linhas
 * mudadas que pedidas (o nome tomado por uma reivindicação, o vínculo encerrado à mão) é diferença: o motor fecha `desatualizada`.
 * Audita por aluno e por nome, só com as duas turmas.
 */
async function transferir(gravacao: ImportacaoRepository, tx: DatabaseTransaction, anoLetivoId: string, transferencias: readonly Transferencia[], turmasNovas: ReadonlyMap<string, string>): Promise<void> {
  const nomes = transferencias.flatMap(({ alvo, destino }) => (alvo.tipo === 'lista' ? [{ id: alvo.id, estadoLido: alvo.estado, turmaLidaId: alvo.turmaId, turmaId: idDaTurma(destino, turmasNovas) }] : []))
  const alunos = transferencias.flatMap(({ alvo, destino }) => (alvo.tipo === 'usuario' ? [{ usuarioId: alvo.id, turmaLidaId: alvo.turmaId, turmaId: idDaTurma(destino, turmasNovas) }] : []))
  await gravacao.encerrarPedidosDosNomes(nomes.filter(({ estadoLido }) => estadoLido === 'reivindicado').map(({ id }) => id))
  if ((await gravacao.transferirNomes(anoLetivoId, nomes)) !== nomes.length) throw new DiferencaNaPlanilhaError()
  for (const { id, turmaLidaId, turmaId } of nomes) await registro.gravar(tx, 'lista.transferida', { entidadeId: id, depois: { turmaOrigemId: turmaLidaId, turmaDestinoId: turmaId } })

  const encerrados = await gravacao.encerrarVinculosDosAlunos(anoLetivoId, alunos.map(({ usuarioId, turmaLidaId }) => ({ usuarioId, turmaId: turmaLidaId })), 'realocacao')
  if (encerrados.length !== alunos.length) throw new DiferencaNaPlanilhaError()
  for (const { id, estadoAntes } of encerrados) await registro.gravar(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: estadoAntes }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'lista' } })
  const criados = await gravacao.criarVinculosDosAlunos(anoLetivoId, alunos.map(({ usuarioId, turmaId }) => ({ usuarioId, turmaId })))
  const destinoDe = new Map(alunos.map(({ usuarioId, turmaId }) => [usuarioId, turmaId]))
  for (const { id, usuarioId } of criados) {
    await registro.gravar(tx, 'vinculo.criado', { entidadeId: id, depois: { usuarioId, turmaId: destinoDe.get(usuarioId) ?? '', disciplinaId: null, papel: 'aluno', estado: 'confirmado', origem: 'lista' } })
  }
  if ((await gravacao.transferirAprovados(anoLetivoId, alunos)) !== alunos.length) throw new DiferencaNaPlanilhaError()
  for (const { usuarioId, turmaLidaId, turmaId } of alunos) await registro.gravar(tx, 'aluno.transferido', { entidadeId: usuarioId, depois: { turmaOrigemId: turmaLidaId, turmaDestinoId: turmaId } })
}

/**
 * Os candidatos a desligar que a coordenação marcou, com quem cada um é no banco **agora**, sob a trava do passo (3). Marca cujo
 * candidato deixou de existir (o aluno desativado à mão, o nome aprovado ou levado a outra turma, a planilha que passou a trazê-lo) é
 * diferença: o motor fecha a importação `desatualizada`, sem gravar nada.
 */
function desligamentosDe(candidatos: readonly CandidatoLido[], marcas: MarcasDaPlanilha): { readonly aprovados: string[]; readonly nomes: Array<Extract<Alvo, { tipo: 'lista' }>> } {
  const doBanco = new Map(candidatos.filter(({ acao }) => acao === 'desligar').map((candidato) => [candidato.id, candidato.alvo]))
  const alvos = [...new Set(marcas.desligar)].map((id) => doBanco.get(id))
  if (alvos.some((alvo) => alvo === undefined)) throw new DiferencaNaPlanilhaError()
  return {
    aprovados: alvos.flatMap((alvo) => (alvo?.tipo === 'usuario' ? [alvo.id] : [])).sort(),
    nomes: alvos.flatMap((alvo) => (alvo?.tipo === 'lista' ? [alvo] : [])).sort((a, b) => (a.id < b.id ? -1 : 1)),
  }
}

/**
 * Desliga os marcados (RF4 e RF5; Tech Spec, seção 5, "Gravar"), na transação do passo (3), com os anos, os usuários, as turmas e os
 * pedidos já travados. O aprovado passa pelo `desativar` do ciclo de vida, na transação do job e na ordem global (vínculos encerrados por
 * `desligamento`, sessões derrubadas, senha apagada, `usuario.desativado` na auditoria); o `NAO_ENCONTRADO` dele (já desativado à mão) é
 * diferença. O nome ainda não aprovado tem o pedido pendente encerrado antes, sem decisão (o check `reivindicacao_pendente_com_nome`
 * não deixa o pedido pendente sem nome), e só então sai da lista, na condição do estado e da turma que a planilha leu. Audita
 * `lista_nome.retirado` por nome, só com a turma e o estado.
 */
async function desligar(gravacao: ImportacaoRepository, tx: DatabaseTransaction, ciclo: CicloDeVidaService, anoLetivoId: string, desligamentos: ReturnType<typeof desligamentosDe>): Promise<void> {
  if (desligamentos.aprovados.length === 0 && desligamentos.nomes.length === 0) return
  for (const usuarioId of desligamentos.aprovados) {
    try {
      await ciclo.desativar(usuarioId, {}, tx)
    } catch (erro) {
      if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) throw new DiferencaNaPlanilhaError()
      throw erro
    }
  }
  await gravacao.encerrarPedidosDosNomes(desligamentos.nomes.filter(({ estado }) => estado === 'reivindicado').map(({ id }) => id))
  const retirados = await gravacao.retirarNomes(
    anoLetivoId,
    desligamentos.nomes.map(({ id, estado, turmaId }) => ({ id, estadoLido: estado, turmaLidaId: turmaId })),
  )
  if (retirados.length !== desligamentos.nomes.length) throw new DiferencaNaPlanilhaError()
  for (const { id, estado, turmaId } of desligamentos.nomes) await registro.gravar(tx, 'lista_nome.retirado', { entidadeId: id, antes: { turmaId, estado } })
}

/** O aluno que volta: o `usuario` da credencial e a turma da linha, na planilha do ano planejado. */
interface Volta {
  readonly usuarioId: string
  readonly turmaId: string
}

function voltasDe(linhas: readonly ClassificadaRow[], turmasNovas: ReadonlyMap<string, string>): Volta[] {
  return linhas.flatMap(({ resultado, volta, destino }) => (resultado === 'volta' && volta !== undefined ? [{ usuarioId: volta, turmaId: idDaTurma(destino, turmasNovas) }] : []))
}

/**
 * Faz voltar o aluno do ano anterior (a virada de ano, RF4; Tech Spec, seção 5, "Gravar"): o vínculo confirmado na turma da linha, com
 * origem `lista` e `vinculo.criado` na auditoria, e a linha `aprovado` da lista do ano, para a reimportação seguinte achá-lo. O `usuario` e a
 * credencial são os mesmos (o mesmo login), e os vínculos dos outros anos não são tocados. O vínculo único do ano violado (23505) é
 * diferença: o motor fecha `desatualizada`.
 */
async function voltar(gravacao: ImportacaoRepository, tx: DatabaseTransaction, anoLetivoId: string, voltas: readonly Volta[]): Promise<void> {
  if (voltas.length === 0) return
  const criados = await gravacao.criarVinculosDosAlunos(anoLetivoId, voltas)
  const turmaDe = new Map(voltas.map(({ usuarioId, turmaId }) => [usuarioId, turmaId]))
  for (const { id, usuarioId } of criados) {
    const turmaId = turmaDe.get(usuarioId)
    if (turmaId === undefined) throw new InvariantException('vínculo criado para quem não volta')
    await registro.gravar(tx, 'vinculo.criado', { entidadeId: id, depois: { usuarioId, turmaId, disciplinaId: null, papel: 'aluno', estado: 'confirmado', origem: 'lista' } })
  }
  await gravacao.inserirAprovados(anoLetivoId, voltas)
}

/**
 * Cria as turmas que a planilha trouxe e a escola ainda não tinha (alunos, 7.0, e grade, 11.0), cada uma na série que o nome diz, criada
 * se faltar, com a ação `turma.criada` (série e origem `planilha`). Devolve o id de cada turma pela `chave`.
 */
export async function criarTurmasNovas(gravacao: ImportacaoRepository, tx: DatabaseTransaction, anoLetivoId: string, turmasACriar: readonly TurmaNova[]): Promise<Map<string, string>> {
  const series = new Map((await gravacao.seriesDaEscola()).map((serie) => [`${serie.etapa}:${String(serie.ano)}`, serie.id]))
  const novas = new Map<string, string>()
  for (const nova of turmasACriar) {
    const chaveDaSerie = `${nova.serie.etapa}:${String(nova.serie.ano)}`
    const serieId = series.get(chaveDaSerie) ?? (await gravacao.criarSerie(pedidoDaSerie(nova.serie)))
    series.set(chaveDaSerie, serieId)
    const turmaId = await gravacao.criarTurma(anoLetivoId, { serieId, nome: nova.nome })
    novas.set(nova.chave, turmaId)
    await registro.gravar(tx, 'turma.criada', { entidadeId: turmaId, depois: { serie: nova.serie, origem: 'planilha' } })
  }
  return novas
}

function planoDe(anoLetivoId: string, classificacao: Classificacao, marcas: MarcasDaPlanilha): PlanoDaImportacao {
  const transferencias = transferenciasDe(classificacao.linhas, marcas)
  const chavesDaTransferencia = new Set(transferencias.flatMap(({ destino }) => (destino.tipo === 'nova' ? [destino.chave] : [])))
  const turmasACriar = [...classificacao.novas, ...classificacao.novasDeTransferencia.filter(({ chave }) => chavesDaTransferencia.has(chave))]
  // As contagens que não houve não entram: a chave ausente vale zero.
  const marcados = new Set(marcas.desligar)
  const aDesligar = classificacao.candidatos.filter(({ acao, id }) => acao === 'desligar' && marcados.has(id))
  const desligados = aDesligar.filter(({ alvo }) => alvo.tipo === 'usuario').length
  const retirados = aDesligar.length - desligados
  const resumo = {
    ...classificacao.resumo,
    turmas_novas: turmasACriar.length,
    ...(transferencias.length > 0 ? { transferidos: transferencias.length } : {}),
    ...(desligados > 0 ? { desligados } : {}),
    ...(retirados > 0 ? { retirados } : {}),
  }
  return {
    assinatura: classificacao.assinatura,
    resumo,
    aplicar: async (gravacao, { tx, ciclo }) => {
      // Marca sem candidato é diferença (o passo (2) só compara a assinatura): o `desatualizada` sai aqui, antes de qualquer escrita.
      const aDesligarAgora = desligamentosDe(classificacao.candidatos, marcas)
      const novas = await criarTurmasNovas(gravacao, tx, anoLetivoId, turmasACriar)
      const entram = classificacao.linhas.filter((linha) => linha.resultado === 'entra')
      await gravacao.inserirNomes(anoLetivoId, entram.map(({ destino, nome, matricula }) => ({ turmaId: idDaTurma(destino, novas), nome, matricula })))
      await corrigirNomes(gravacao, tx, anoLetivoId, classificacao.linhas)
      await transferir(gravacao, tx, anoLetivoId, transferencias, novas)
      await voltar(gravacao, tx, anoLetivoId, voltasDe(classificacao.linhas, novas))
      await desligar(gravacao, tx, ciclo, anoLetivoId, aDesligarAgora)
    },
  }
}

/** A prévia que a coordenação vê: cada linha com o resultado e o erro, as contagens, os candidatos a marca e os nomes lidos do banco por turma. */
function previaDe(lidas: ReadonlyArray<{ readonly linha: number }>, completas: readonly LidaRow[], classificacao: Classificacao): PreviaDoTipo {
  const doNumero = new Map(classificacao.linhas.map((classificada) => [classificada.linha, classificada]))
  const linhas = lidas.map(({ linha }): PreviaDaPlanilhaRow => {
    const classificada = doNumero.get(linha)
    if (classificada === undefined) return { linha, resultado: 'erro', erro: 'linha_incompleta' }
    if (classificada.erro !== undefined) return { linha, resultado: 'erro', erro: classificada.erro }
    return { linha, resultado: classificada.resultado }
  })
  const porTurma = new Map<string, number>()
  for (const { turmaId } of classificacao.candidatos) porTurma.set(turmaId, (porTurma.get(turmaId) ?? 0) + 1)
  return {
    linhas,
    contagens: classificacao.resumo,
    candidatos: classificacao.candidatos.map(({ id, acao, rotulo }) => ({ id, acao, rotulo })),
    guardado: completas,
    assinatura: classificacao.assinatura,
    leituras: [...porTurma].map(([turmaId, quantidade]) => ({ turmaId, quantidade })),
  }
}

export const tipoAlunos: TipoDeImportacao = {
  tipo: 'alunos',
  usaTurma: false,
  usaAno: true,

  async previa(repositorio, ano, texto): Promise<PreviaDoTipo> {
    const tabela = lerTabela(texto, CABECALHOS_DA_PLANILHA.alunos)
    const completas: LidaRow[] = []
    for (const { linha, campos } of tabela.linhas) {
      if (campos !== null) completas.push({ linha, turma: (campos['turma'] ?? '').trim(), nome: (campos['nome'] ?? '').trim(), matricula: (campos['matricula'] ?? '').trim() })
    }
    return previaDe(tabela.linhas, completas, await classificarAgora(repositorio, ano, completas))
  },

  async previaDaLista(repositorio, ano, { turmaId, linhas }): Promise<PreviaDoTipo> {
    const turmas = await repositorio.turmasDoAno(ano.id)
    if (!turmas.some((turma) => turma.id === turmaId)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const completas = linhas.map(({ linha, nome, matricula }): LidaRow => ({ linha, turma: '', turmaId, nome, matricula }))
    return previaDe(linhas, completas, await classificarAgora(repositorio, ano, completas, turmas))
  },

  /**
   * A trava do passo (3), na ordem global da Tech Spec (seção 5), depois do ano: os anos dos vínculos de quem vai ser desligado (o que o
   * `desativar` trava primeiro), os usuários que vão ser escritos (nome corrigido, transferido, desligado ou que volta; achados por uma
   * classificação sem trava, e se mudarem a escrita sai `desatualizada`), as turmas que as linhas tocam e os pedidos pendentes delas.
   * **Não trava conta:** o aluno aprovado entra por matrícula e não tem conta global até a F2c (a conta da escola do aluno); quando
   * tiver, o `desativar` trava a conta dele depois das turmas, e a trava da conta passa a vir aqui, antes delas. Trava
   * as turmas todas, também as das linhas com erro e as de "já existe": trava a mais de propósito, sem escrita nelas e curta,
   * mais simples do que repetir a classificação para escolher. Os pedidos pendentes presos, o `planejar` lê o nome da lista já sem
   * que uma aprovação possa passar o nome antigo ao `usuario`.
   */
  async travar(repositorio, ano, guardado, marcas, _passo3, tx) {
    const lido = guardadoSchema.safeParse(guardado)
    if (!lido.success) return
    const turmas = await repositorio.turmasDoAno(ano.id)
    const antes = await classificarAgora(repositorio, ano, lido.data, turmas)
    const transferidos = transferenciasDe(antes.linhas, marcas)
    const marcadosParaDesligar = new Set(marcas.desligar)
    const desligados = antes.candidatos.flatMap(({ acao, id, alvo }) => (acao === 'desligar' && alvo.tipo === 'usuario' && marcadosParaDesligar.has(id) ? [id] : [])).sort()
    // Os anos em que cada desligado tem vínculo aberto: o `desativar` os trava primeiro, e a ordem global tem o ano antes do usuário.
    const ciclo = new CicloDeVidaRepository(tx)
    for (const usuarioId of desligados) await ciclo.travarAnosDosVinculos(usuarioId, true)
    const aTravar = [
      ...antes.linhas.flatMap(({ resultado, alvo, volta }) => (resultado === 'nome_corrigido' && alvo?.tipo === 'usuario' ? [alvo.id] : resultado === 'volta' && volta !== undefined ? [volta] : [])),
      ...transferidos.flatMap(({ alvo }) => (alvo.tipo === 'usuario' ? [alvo.id] : [])),
      ...desligados,
    ]
    await repositorio.travarUsuarios(aTravar)
    // Destino e origem de todo marcado: o gerar acesso e a decisão em sala da turma antiga esperam, como os da nova.
    const tocadas = [...new Set([...turmasTocadas(lido.data, turmas), ...transferidos.map(({ alvo }) => alvo.turmaId)])].sort()
    await repositorio.travarTurmas(ano.id, tocadas)
    await repositorio.travarPedidosPendentes(ano.id, tocadas)
  },

  async planejar(repositorio, ano, guardado, marcas) {
    const lido = guardadoSchema.safeParse(guardado)
    return lido.success ? planoDe(ano.id, await classificarAgora(repositorio, ano, lido.data), marcas) : undefined
  },
}
