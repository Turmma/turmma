import { createHash } from 'node:crypto'
import {
  CABECALHOS_DA_PLANILHA,
  chaveDaTurma,
  InvariantException,
  matriculaDigitadaSchema,
  matriculasQueParecemDocumento,
  nomeDigitadoSchema,
  serieDaChave,
  type CriarSerieRequest,
  type Etapa,
  type PreviaDaPlanilhaRow,
  type ResumoDaImportacao,
} from '@educa/shared'
import { z } from 'zod'
import { AuditoriaRecorder } from '../../auditoria/auditoria-recorder.js'
import type { TurmaDoAno } from '../../estrutura/turma.repository.js'
import type { ImportacaoRepository } from '../importacao.repository.js'
import { lerTabela, normalizarTexto } from '../leitor.js'
import type { PlanoDaImportacao, PreviaDoTipo, TipoDeImportacao } from '../tipo.js'

/**
 * A planilha de alunos (F2, 7.0, RF2 e RF3; Tech Spec, seção 5, "Planilha" e "Gravar", "Alunos"): turma, nome e matrícula de cada
 * aluno, até 3.000 linhas. Esta tarefa traz a entrada: a turma é achada pela `chave` do nome ("8ºA", "8 A" e "8a" são a mesma), a
 * turma que a escola não tem nasce na série que o nome diz, e quem tem matrícula nova entra na lista de nomes da turma, `livre`,
 * para reivindicar o próprio nome (regra 60, item 7). O aluno não ganha usuário aqui. A matrícula que já é de alguém da escola neste
 * ano (na lista ou com credencial) é "já existe" e não grava nada: o que ela diz de nome e turma (nome corrigido, muda de turma,
 * fora da planilha) é da 8.0, 9.0 e 10.0.
 *
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

/** A linha completa da planilha, com os campos sem espaço nas pontas: o que o gravar guarda até o job, e o job relê. */
const linhaGuardadaSchema = z.strictObject({
  linha: z.number().int().positive(),
  turma: z.string(),
  nome: z.string(),
  matricula: z.string(),
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

/** Para onde a linha vai: uma turma da escola neste ano, ou a que a planilha cria, com a série que a chave diz. */
type Destino = { readonly tipo: 'existente'; readonly turmaId: string } | { readonly tipo: 'nova'; readonly chave: string; readonly serie: Serie }

interface ClassificadaRow {
  readonly linha: number
  readonly resultado: 'entra' | 'ja_existe' | 'erro'
  readonly erro?: ErroDaLinhaDeAluno
  readonly destino?: Destino
  readonly nome: string
  readonly matricula: string
}

/** A série que o nome da turma diz: 6º ao 9º do Ensino Fundamental, 1º ao 3º do Médio. */
interface Serie {
  readonly etapa: Etapa
  readonly ano: number
}

/** A turma que a planilha cria: a chave, o nome na grafia da primeira linha que a pediu e a série que a chave diz. */
interface TurmaNova {
  readonly chave: string
  readonly nome: string
  readonly serie: Serie
}

interface Classificacao {
  readonly linhas: readonly ClassificadaRow[]
  readonly novas: readonly TurmaNova[]
  readonly resumo: ResumoDaImportacao
  readonly assinatura: string
}

/** O nome da turma como a planilha o escreveu: sem espaço a mais. */
function nomeDaTurma(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

/**
 * Por onde a turma se acha: a `chave` do nome ("8ºA" → `8a`), ou, se o nome não tem o padrão, o próprio nome sem acento nem
 * caixa (`n:turma azul`). A turma da escola usa a `chave` gravada, ou a calculada pelo nome quando ela é nula.
 */
function indiceDaTurma(nome: string, chave: string | null): string {
  const doNome = chaveDaTurma(nome)
  return chave ?? doNome ?? `n:${normalizarTexto(nome)}`
}

/** O erro da linha que se vê sem o banco, na posição dela, ou `undefined`. A ordem é a em que a coordenação corrige. */
function errosDoTexto(lidas: readonly LidaRow[]): Array<ErroDaLinhaDeAluno | undefined> {
  const parecemDocumento = matriculasQueParecemDocumento(lidas.map((lida) => lida.matricula))
  const doCampo = lidas.map(({ turma, nome, matricula }, posicao): ErroDaLinhaDeAluno | undefined => {
    if (turma === '') return 'turma_vazia'
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
 * O nome que passa pela `chave` é curto: o formato tem um dígito, o ordinal, "ano" e uma letra.
 */
function destinoDaLinha(texto: string, porIndice: ReadonlyMap<string, readonly TurmaDoAno[]>): Destino | ErroDaLinhaDeAluno {
  const indice = indiceDaTurma(texto, null)
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

/** O que a coordenação viu, resumido: cada linha com o resultado, o erro e a turma de destino. É a assinatura que o job confere no passo (3). */
function assinaturaDe(anoLetivoId: string, linhas: readonly ClassificadaRow[]): string {
  const destinoDe = (destino: Destino | undefined) => (destino === undefined ? null : destino.tipo === 'existente' ? destino.turmaId : `nova:${destino.chave}`)
  const vistas = linhas.map(({ linha, resultado, erro, destino }) => [linha, resultado, erro ?? null, destinoDe(destino)])
  return createHash('sha256').update(JSON.stringify({ ano: anoLetivoId, linhas: vistas })).digest('hex')
}

/**
 * O que a planilha faria neste ano contra as turmas dele e as matrículas que a escola já tem. A `assinatura` resume o que a
 * coordenação viu (cada linha com o resultado e a turma de destino): o job só grava se, no passo (3), ela é a mesma.
 */
export function classificar(anoLetivoId: string, lidas: readonly LidaRow[], turmas: readonly TurmaDoAno[], emUso: ReadonlySet<string>): Classificacao {
  const porIndice = new Map<string, TurmaDoAno[]>()
  for (const turma of turmas) {
    const indice = indiceDaTurma(turma.nome, turma.chave)
    porIndice.set(indice, [...(porIndice.get(indice) ?? []), turma])
  }
  const doTexto = errosDoTexto(lidas)
  const novasPorChave = new Map<string, TurmaNova>()
  const linhas = lidas.map(({ linha, turma, nome, matricula }, posicao): ClassificadaRow => {
    const erroDoTexto = doTexto[posicao]
    if (erroDoTexto !== undefined) return { linha, resultado: 'erro', erro: erroDoTexto, nome, matricula }
    const destino = destinoDaLinha(turma, porIndice)
    if (typeof destino === 'string') return { linha, resultado: 'erro', erro: destino, nome, matricula }
    if (emUso.has(matricula)) return { linha, resultado: 'ja_existe', destino, nome, matricula }
    if (destino.tipo === 'nova' && !novasPorChave.has(destino.chave)) novasPorChave.set(destino.chave, turmaNova(destino, turma))
    return { linha, resultado: 'entra', destino, nome, matricula }
  })
  const entram = linhas.filter((linha) => linha.resultado === 'entra').length
  const novas = [...novasPorChave.values()].sort((a, b) => (a.chave < b.chave ? -1 : 1))
  const resumo = { entram, ja_existem: linhas.filter((linha) => linha.resultado === 'ja_existe').length, turmas_novas: novas.length }
  return { linhas, novas, resumo, assinatura: assinaturaDe(anoLetivoId, linhas) }
}

/** Lê o que o gravar guardou e o classifica contra o banco de agora: três consultas, qualquer que seja o número de linhas. */
async function classificarAgora(repositorio: ImportacaoRepository, anoLetivoId: string, lidas: readonly LidaRow[]): Promise<Classificacao> {
  const turmas = await repositorio.turmasDoAno(anoLetivoId)
  const emUso = await repositorio.matriculasEmUso(anoLetivoId, [...new Set(lidas.map((lida) => lida.matricula).filter((matricula) => matricula !== ''))])
  return classificar(anoLetivoId, lidas, turmas, emUso)
}

/** O id da turma de destino da linha que entra: a da escola, ou a que acabou de nascer. */
function idDaTurma(destino: Destino | undefined, novas: ReadonlyMap<string, string>): string {
  const id = destino?.tipo === 'existente' ? destino.turmaId : novas.get(destino?.chave ?? '')
  if (id === undefined) throw new InvariantException('linha que entra sem turma de destino')
  return id
}

/** O pedido de série para a etapa e o ano que o nome da turma disse. */
function pedidoDaSerie({ etapa, ano }: Serie): CriarSerieRequest {
  return etapa === 'em' ? { etapa: 'em', ano } : { etapa: 'ef_anos_finais', ano }
}

function planoDe(anoLetivoId: string, classificacao: Classificacao): PlanoDaImportacao {
  return {
    assinatura: classificacao.assinatura,
    resumo: classificacao.resumo,
    aplicar: async (gravacao, { tx }) => {
      const series = new Map((await gravacao.seriesDaEscola()).map((serie) => [`${serie.etapa}:${String(serie.ano)}`, serie.id]))
      const novas = new Map<string, string>()
      for (const nova of classificacao.novas) {
        const chaveDaSerie = `${nova.serie.etapa}:${String(nova.serie.ano)}`
        const serieId = series.get(chaveDaSerie) ?? (await gravacao.criarSerie(pedidoDaSerie(nova.serie)))
        series.set(chaveDaSerie, serieId)
        const turmaId = await gravacao.criarTurma(anoLetivoId, { serieId, nome: nova.nome })
        novas.set(nova.chave, turmaId)
        await registro.gravar(tx, 'turma.criada', { entidadeId: turmaId, depois: { serie: nova.serie, origem: 'planilha' } })
      }
      const entram = classificacao.linhas.filter((linha) => linha.resultado === 'entra')
      await gravacao.inserirNomes(anoLetivoId, entram.map(({ destino, nome, matricula }) => ({ turmaId: idDaTurma(destino, novas), nome, matricula })))
    },
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
    const classificacao = await classificarAgora(repositorio, ano.id, completas)
    const doNumero = new Map(classificacao.linhas.map((classificada) => [classificada.linha, classificada]))
    const linhas = tabela.linhas.map(({ linha }): PreviaDaPlanilhaRow => {
      const classificada = doNumero.get(linha)
      if (classificada === undefined) return { linha, resultado: 'erro', erro: 'linha_incompleta' }
      if (classificada.erro !== undefined) return { linha, resultado: 'erro', erro: classificada.erro }
      return { linha, resultado: classificada.resultado === 'entra' ? 'entra' : 'ja_existe' }
    })
    return { linhas, contagens: classificacao.resumo, candidatos: [], guardado: completas, assinatura: classificacao.assinatura }
  },

  /**
   * Trava as turmas que as linhas guardadas pedem, todas, também as das linhas com erro e as de "já existe": trava a mais de
   * propósito, sem escrita nelas e curta (a transação é curta), mais simples do que repetir a classificação para escolher.
   */
  async travar(repositorio, ano, guardado) {
    const lido = guardadoSchema.safeParse(guardado)
    if (!lido.success) return
    const pedidas = new Set(lido.data.map(({ turma }) => indiceDaTurma(turma, null)))
    const tocadas = (await repositorio.turmasDoAno(ano.id)).filter((turma) => pedidas.has(indiceDaTurma(turma.nome, turma.chave)))
    await repositorio.travarTurmas(ano.id, tocadas.map((turma) => turma.id))
  },

  async planejar(repositorio, ano, guardado) {
    const lido = guardadoSchema.safeParse(guardado)
    return lido.success ? planoDe(ano.id, await classificarAgora(repositorio, ano.id, lido.data)) : undefined
  },
}
