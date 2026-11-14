import type pg from 'pg'

/**
 * Conferência do cenário "300 apostilas numa noite" (ingestao-do-material, tarefa 9.0; Tech Spec, seção 7c; PRD, RF15) depois do envio:
 * o que o k6 e o driver não veem, lido no banco do projeto de carga. `npm run carga:ingestao` chama `julgarIngestao` com o que lê aqui.
 *
 * - **A vazão por PDF**, de `job_registro` (fila `pdf`, tipo `material.extrair-pdf`) da escola A: do primeiro `iniciado_em` ao último `concluido_em`,
 *   dividido pelos PDFs que ficaram prontos. As 300 apostilas, projetadas **com uma réplica** do `worker-pdf` (o compose de carga sobe uma), precisam
 *   caber nas 10 h entre 19h e 5h.
 * - **O PDF da escola B espera até duas extrações**: quantas extrações da A **começaram** entre o `criado_em` e o `iniciado_em` do job da B. É o que a vaga
 *   por escola da fila `pdf` garante, e o que o controle negativo (`VAGAS_POR_ESCOLA_DESLIGADAS`) tira.
 * - **Nenhum PDF da A ficou `falhou`**, e todos os 300 foram aceitos pela rota (201): o guard de envio (100 por hora por pessoa, 300 por escola) deixa passar o
 *   onboarding de três coordenadores.
 *
 * Só contagens e instantes: nada de pessoa, nada do conteúdo do PDF (regra 20, item 9). Rotina nossa de teste, sem contexto de requisição, e por isso
 * consulta as tabelas direto, sem repository (regra 10, item 9).
 */

type Consultavel = Pick<pg.ClientBase, 'query'>

/** Quantas apostilas o onboarding da escola envia (RF15). */
export const TOTAL_DE_PDFS = 300
/** Os coordenadores que enviam, e quantos cada um: o guard aceita 100 por hora por pessoa e 300 por escola. */
export const COORDENADORES_DA_A = 3
export const PDFS_POR_COORDENADOR = TOTAL_DE_PDFS / COORDENADORES_DA_A
/** A noite do lote: das 19h às 5h. */
export const NOITE_EM_SEGUNDOS = 10 * 3_600
/** O que a ingestão pode acrescentar ao p95 do turno do Tutor da B sobre a base, a mesma margem do PRD, RF18. */
export const MARGEM_SOBRE_A_BASE_MS = 500
/** Nenhum statement do cenário passa daqui: um quarto abaixo do `statement_timeout` de 2 s. */
export const TETO_DO_STATEMENT_MS = 1_500
/** Quantas extrações da A podem começar enquanto o PDF da B espera. */
export const EXTRACOES_QUE_A_B_ESPERA = 2
/** Quantos turnos do Tutor da B a janela precisa ter, para o p95 dizer alguma coisa. */
export const AMOSTRAS_MINIMAS_DO_TURNO = 20

export const TIPO_DO_JOB_DE_EXTRACAO = 'material.extrair-pdf'

/** O que o driver mediu do lado de fora: o que a rota respondeu a cada envio e quando o PDF da B foi enviado. */
export interface EnviosDaA {
  readonly aceitos: number
  /** `status:quantidade` do que não foi 201, como o driver viu. */
  readonly recusados: Readonly<Record<string, number>>
}

export interface ExtracoesDaA {
  readonly prontos: number
  readonly falhos: number
  readonly pendentes: number
  readonly primeiroInicioMs: number | null
  readonly ultimoFimMs: number | null
}

export interface EsperaDoPdfDaB {
  /** `null` quando o job da B não foi achado ou não começou. */
  readonly esperaMs: number | null
  readonly extracoesDaAAntes: number | null
}

export interface TurnoDaB {
  readonly amostras: number
  readonly p95Ms: number | null
}

export interface MedidaDaIngestao {
  readonly envios: EnviosDaA
  readonly extracoes: ExtracoesDaA
  readonly pdfDaB: EsperaDoPdfDaB
  readonly turnoDaBNaBase: TurnoDaB
  readonly turnoDaBNaIngestao: TurnoDaB
  /** O maior `max_exec_time` do `pg_stat_statements` na janela, e a forma dele; `undefined` quando o módulo não respondeu. */
  readonly piorStatement: { readonly forma: string; readonly maximoMs: number } | undefined
}

export interface Reprovacao {
  readonly criterio: (typeof CRITERIOS)[number]
  readonly detalhe: string
}

/** Os critérios, na ordem em que o relatório os lista. O controle negativo precisa reprovar pelo `espera_do_pdf_da_b`. */
export const CRITERIOS = ['envio', 'extracao', 'vazao', 'turno_da_b', 'statement', 'espera_do_pdf_da_b'] as const

/** Quanto tempo uma extração leva em média, na vazão medida, e quanto levariam as 300 com uma réplica. */
export function projetarAsTrezentas(extracoes: Pick<ExtracoesDaA, 'prontos' | 'primeiroInicioMs' | 'ultimoFimMs'>): { vazaoPorPdfMs: number | null; projecaoEmSegundos: number | null } {
  if (extracoes.prontos === 0 || extracoes.primeiroInicioMs === null || extracoes.ultimoFimMs === null) return { vazaoPorPdfMs: null, projecaoEmSegundos: null }
  const vazaoPorPdfMs = Math.max(0, extracoes.ultimoFimMs - extracoes.primeiroInicioMs) / extracoes.prontos
  return { vazaoPorPdfMs, projecaoEmSegundos: (vazaoPorPdfMs * TOTAL_DE_PDFS) / 1_000 }
}

interface Julgamento {
  readonly linhas: string[]
  readonly reprovacoes: Reprovacao[]
}

const n = (valor: number): string => String(valor)

function julgarEnvios(envios: EnviosDaA): Julgamento {
  const recusados = Object.values(envios.recusados).reduce((soma, quantos) => soma + quantos, 0)
  const linhas = [`  envios da A: ${n(envios.aceitos)} aceitos (201) de ${n(TOTAL_DE_PDFS)}${recusados === 0 ? '' : `; recusados ${JSON.stringify(envios.recusados)}`}`]
  const reprovacoes: Reprovacao[] = envios.aceitos === TOTAL_DE_PDFS ? [] : [{ criterio: 'envio', detalhe: `só ${n(envios.aceitos)} dos ${n(TOTAL_DE_PDFS)} envios foram aceitos` }]
  return { linhas, reprovacoes }
}

function julgarExtracoes(extracoes: ExtracoesDaA, aceitos: number): Julgamento {
  const linhas = [`  extrações da A: ${n(extracoes.prontos)} prontas, ${n(extracoes.falhos)} falhas, ${n(extracoes.pendentes)} pendentes`]
  const certo = extracoes.prontos === aceitos && extracoes.falhos === 0 && extracoes.pendentes === 0
  const detalhe = `${n(extracoes.prontos)} prontas, ${n(extracoes.falhos)} falhas e ${n(extracoes.pendentes)} pendentes para ${n(aceitos)} aceitos`
  return { linhas, reprovacoes: certo ? [] : [{ criterio: 'extracao', detalhe }] }
}

function julgarVazao(extracoes: ExtracoesDaA): Julgamento {
  const { vazaoPorPdfMs, projecaoEmSegundos } = projetarAsTrezentas(extracoes)
  if (vazaoPorPdfMs === null || projecaoEmSegundos === null) {
    return { linhas: ['  vazão: sem extração pronta para medir'], reprovacoes: [{ criterio: 'vazao', detalhe: 'nenhuma extração pronta: não há vazão para projetar' }] }
  }
  const linhas = [`  vazão: ${n(Math.round(vazaoPorPdfMs))} ms por PDF; as ${n(TOTAL_DE_PDFS)} projetadas levam ${n(Math.round(projecaoEmSegundos))} s de ${n(NOITE_EM_SEGUNDOS)} s da noite (uma réplica)`]
  const detalhe = `as ${n(TOTAL_DE_PDFS)} levariam ${n(Math.round(projecaoEmSegundos))} s, e a noite tem ${n(NOITE_EM_SEGUNDOS)} s`
  return { linhas, reprovacoes: projecaoEmSegundos > NOITE_EM_SEGUNDOS ? [{ criterio: 'vazao', detalhe }] : [] }
}

function julgarTurnoDaB(naBase: TurnoDaB, naIngestao: TurnoDaB): Julgamento {
  const base = naBase.p95Ms
  const com = naIngestao.p95Ms
  const texto = (valor: number | null): string => (valor === null ? '-' : `${n(valor)} ms`)
  const linhas = [`  turno do Tutor da B: p95 ${texto(com)} com a ingestão (${n(naIngestao.amostras)} turnos), ${texto(base)} na base (${n(naBase.amostras)} turnos)`]
  const poucas = naBase.amostras < AMOSTRAS_MINIMAS_DO_TURNO || naIngestao.amostras < AMOSTRAS_MINIMAS_DO_TURNO
  if (base === null || com === null || poucas) {
    return { linhas, reprovacoes: [{ criterio: 'turno_da_b', detalhe: `turnos da B a menos que ${n(AMOSTRAS_MINIMAS_DO_TURNO)} na base ou na ingestão: o p95 não diz nada` }] }
  }
  const detalhe = `p95 do turno da B ${n(com)} ms, acima da base ${n(base)} ms mais ${n(MARGEM_SOBRE_A_BASE_MS)} ms`
  return { linhas, reprovacoes: com > base + MARGEM_SOBRE_A_BASE_MS ? [{ criterio: 'turno_da_b', detalhe }] : [] }
}

function julgarStatement(pior: MedidaDaIngestao['piorStatement']): Julgamento {
  if (pior === undefined) return { linhas: ['  statements: o pg_stat_statements não respondeu'], reprovacoes: [{ criterio: 'statement', detalhe: 'sem a medição de statements' }] }
  const linhas = [`  pior statement: ${n(Math.round(pior.maximoMs))} ms (${pior.forma})`]
  const detalhe = `um statement levou ${n(Math.round(pior.maximoMs))} ms: ${pior.forma}`
  return { linhas, reprovacoes: pior.maximoMs > TETO_DO_STATEMENT_MS ? [{ criterio: 'statement', detalhe }] : [] }
}

function julgarPdfDaB(pdfDaB: EsperaDoPdfDaB): Julgamento {
  if (pdfDaB.esperaMs === null || pdfDaB.extracoesDaAAntes === null) {
    return { linhas: ['  PDF da B: não foi extraído'], reprovacoes: [{ criterio: 'espera_do_pdf_da_b', detalhe: 'o PDF da B não começou a ser extraído' }] }
  }
  const linhas = [`  PDF da B: esperou ${n(Math.round(pdfDaB.esperaMs))} ms, atrás de ${n(pdfDaB.extracoesDaAAntes)} extrações da A (o limite é ${n(EXTRACOES_QUE_A_B_ESPERA)})`]
  const detalhe = `o PDF da B esperou ${n(pdfDaB.extracoesDaAAntes)} extrações da A, e o limite é ${n(EXTRACOES_QUE_A_B_ESPERA)}`
  return { linhas, reprovacoes: pdfDaB.extracoesDaAAntes > EXTRACOES_QUE_A_B_ESPERA ? [{ criterio: 'espera_do_pdf_da_b', detalhe }] : [] }
}

/** Junta o que foi medido num veredito. Cada critério reprova sozinho, com o número que o reprovou. */
export function julgarIngestao(medida: MedidaDaIngestao): { passou: boolean; reprovacoes: Reprovacao[]; linhas: string[] } {
  const julgamentos = [
    julgarEnvios(medida.envios),
    julgarExtracoes(medida.extracoes, medida.envios.aceitos),
    julgarVazao(medida.extracoes),
    julgarTurnoDaB(medida.turnoDaBNaBase, medida.turnoDaBNaIngestao),
    julgarStatement(medida.piorStatement),
    julgarPdfDaB(medida.pdfDaB),
  ]
  const reprovacoes = julgamentos.flatMap((julgamento) => julgamento.reprovacoes)
  return { passou: reprovacoes.length === 0, reprovacoes, linhas: julgamentos.flatMap((julgamento) => julgamento.linhas) }
}

/** Zero quando o cenário faz o que se espera dele: passar com a vaga por escola, e reprovar pela espera do PDF da B sem ela. */
export function codigoDeSaidaDaIngestao(reprovacoes: readonly Reprovacao[], controleNegativo: boolean): number {
  if (!controleNegativo) return reprovacoes.length === 0 ? 0 : 1
  // Só vale se a reprovação for a da justiça: as outras (envio, extração) mostrariam um ambiente que não funcionou, e não a vaga fazendo falta.
  const criterios = new Set(reprovacoes.map((reprovacao) => reprovacao.criterio))
  const ambienteLimpo = !criterios.has('envio') && !criterios.has('extracao')
  return ambienteLimpo && criterios.has('espera_do_pdf_da_b') ? 0 : 1
}

const ms = (valor: unknown): number | null => (valor === null || valor === undefined ? null : Math.round(Number(valor)))

/** As extrações da escola A, de `job_registro`: quantas ficaram prontas, falhas ou pendentes, e a janela delas. */
export async function lerExtracoesDaA(banco: Consultavel, escolaA: string): Promise<ExtracoesDaA> {
  const { rows } = await banco.query<Record<string, unknown>>(
    `select count(*) filter (where estado = 'concluido') as prontos,
            count(*) filter (where estado = 'falhou') as falhos,
            count(*) filter (where estado not in ('concluido', 'falhou')) as pendentes,
            extract(epoch from min(iniciado_em)) * 1000 as inicio,
            extract(epoch from max(concluido_em)) * 1000 as fim
       from job_registro where escola_id = $1 and fila = 'pdf' and tipo = $2`,
    [escolaA, TIPO_DO_JOB_DE_EXTRACAO],
  )
  const linha = rows[0] ?? {}
  return { prontos: Number(linha['prontos'] ?? 0), falhos: Number(linha['falhos'] ?? 0), pendentes: Number(linha['pendentes'] ?? 0), primeiroInicioMs: ms(linha['inicio']), ultimoFimMs: ms(linha['fim']) }
}

/** O job de extração mais recente da escola B (o único que o cenário envia) e quantas extrações da A começaram enquanto ele esperava. */
export async function lerEsperaDoPdfDaB(banco: Consultavel, escolaA: string, escolaB: string): Promise<EsperaDoPdfDaB> {
  const { rows } = await banco.query<Record<string, unknown>>(
    `select b.id, extract(epoch from (b.iniciado_em - b.criado_em)) * 1000 as espera,
            (select count(*) from job_registro a
              where a.escola_id = $1 and a.fila = 'pdf' and a.tipo = $3 and a.iniciado_em > b.criado_em and a.iniciado_em <= b.iniciado_em) as antes
       from job_registro b where b.escola_id = $2 and b.fila = 'pdf' and b.tipo = $3 and b.iniciado_em is not null order by b.criado_em desc limit 1`,
    [escolaA, escolaB, TIPO_DO_JOB_DE_EXTRACAO],
  )
  const linha = rows[0]
  if (linha === undefined) return { esperaMs: null, extracoesDaAAntes: null }
  return { esperaMs: ms(linha['espera']), extracoesDaAAntes: Number(linha['antes'] ?? 0) }
}

/** Espera as extrações da A terminarem (`concluido` ou `falhou`), até o prazo; devolve a leitura final. */
export async function aguardarExtracoesDaA(banco: Consultavel, escolaA: string, prazoMs: number, esperarUmPouco: () => Promise<void>): Promise<ExtracoesDaA> {
  const limite = performance.now() + prazoMs
  for (;;) {
    const lidas = await lerExtracoesDaA(banco, escolaA)
    if (lidas.pendentes === 0 && lidas.prontos + lidas.falhos > 0) return lidas
    if (performance.now() > limite) return lidas
    await esperarUmPouco()
  }
}
