import type pg from 'pg'

/**
 * Conferência do cenário "300 apostilas, classificadas numa noite" (classificacao-bncc, tarefa 5.0; Tech Spec, seção 7c; PRD, RF5 e RF15) depois do agendamento: o que o k6 e o driver não veem, lido no banco do
 * projeto de carga. `npm run carga:classificacao` chama `julgarClassificacao` com o que lê aqui.
 *
 * - **O agendamento**: as 300 apostilas de 25 seções são 7.500 seções, e o job `material.agendar-classificacao` da escola A as põe em 630 execuções de até 12, cada uma com o seu job `ia.executar-lote`.
 * - **A vazão por execução**, de `execucao_agente` da escola A: do primeiro `iniciada_em` ao último `concluida_em`, **descontada a parada do provedor**, dividido pelas execuções concluídas. As 630, projetadas com as
 *   réplicas e o balde do compose de carga, precisam caber nas 10 h entre 19h e 5h.
 * - **Nenhuma seção sem classificação na abertura da janela**: toda seção da A termina com `classificada_em`, e nenhuma execução fica `falhou` nem `pendente` ao fim.
 * - **A parada do provedor** (10 min no meio): o `worker-ia` fica fora e volta; as execuções que esperavam voltam a andar sozinhas, e nenhuma é perdida.
 * - **O Tutor da escola B** continua dentro da margem sobre a base: o lote da A não tira o interativo da B.
 * - **O plano da cobertura e do join da busca**, com o volume do cenário (`EXPLAIN (ANALYZE)`): o tempo de execução fica abaixo do teto.
 *
 * Só contagens e instantes: nada de pessoa, nada do conteúdo do material (regra 20, item 9). Rotina nossa de teste, sem contexto de requisição, e por isso consulta as tabelas direto, sem repository (regra 10, item 9),
 * só nas escolas sintéticas que o cenário criou.
 */

type Consultavel = Pick<pg.ClientBase, 'query'>

/** Quantas apostilas o onboarding da escola envia (RF15), e as seções de cada uma (~25 capítulos). */
export const TOTAL_DE_MATERIAIS = 300
export const SECOES_POR_MATERIAL = 25
export const TOTAL_DE_SECOES = TOTAL_DE_MATERIAIS * SECOES_POR_MATERIAL
/** As seções por execução (`SECOES_POR_EXECUCAO`) e por lote do agendamento (`SECOES_POR_LOTE_DO_AGENDAMENTO`), do `core`: a conta das execuções esperadas. */
export const SECOES_POR_EXECUCAO_DO_CENARIO = 12
export const SECOES_POR_LOTE_DO_CENARIO = 500
/**
 * Cada lote de 500 seções do mesmo recorte vira 42 execuções (41 de 12 e uma de 8), e as 7.500 seções são 15 lotes: 630, e não as 625 de 7.500 ÷ 12. O resto de cada lote não espera o seguinte, porque cada lote é
 * uma transação que agenda tudo o que leu (a corrida P9 não deixa execução sem seção); o custo são cinco execuções a mais na noite. A primeira corrida (159 min) contou 630.
 */
export const EXECUCOES_ESPERADAS = Math.ceil(TOTAL_DE_SECOES / SECOES_POR_LOTE_DO_CENARIO) * Math.ceil(SECOES_POR_LOTE_DO_CENARIO / SECOES_POR_EXECUCAO_DO_CENARIO)
/** A noite do lote: das 19h às 5h. */
export const NOITE_EM_SEGUNDOS = 10 * 3_600
/** O que o lote pode acrescentar ao p95 do turno do Tutor da B sobre a base, a mesma margem do PRD, RF18. */
export const MARGEM_SOBRE_A_BASE_MS = 500
/** Quantos turnos do Tutor da B a janela precisa ter, para o p95 dizer alguma coisa. */
export const AMOSTRAS_MINIMAS_DO_TURNO = 20
/** O tempo que cada consulta do plano pode levar no volume do cenário. */
export const TETO_DO_PLANO_MS = 200
/** Quanto o provedor fica fora no meio do lote, e quanto do lote já tem de ter andado antes (a fração das execuções concluídas). */
export const PARADA_DO_PROVEDOR_EM_MINUTOS = 10
export const FRACAO_ANTES_DA_PARADA = 0.2

/** O que o driver agendou e o que o banco diz do agendamento. */
export interface AgendamentoDaA {
  readonly secoes: number
  readonly execucoes: number
  /** Os jobs `ia.executar-lote` gravados para essas execuções. */
  readonly jobs: number
}

export interface ClassificacaoDaA {
  readonly secoesClassificadas: number
  readonly secoesSemClassificacao: number
  readonly concluidas: number
  readonly falhas: number
  readonly pendentes: number
  readonly primeiroInicioMs: number | null
  readonly ultimoFimMs: number | null
}

/** A parada do `worker-ia`, medida pelo driver: quando começou e acabou, e as execuções concluídas em cada ponto. */
export interface ParadaDoProvedor {
  readonly minutos: number
  readonly inicioMs: number | null
  readonly fimMs: number | null
  readonly concluidasAntes: number
  readonly concluidasNaParada: number
}

export interface TurnoDaB {
  readonly amostras: number
  readonly p95Ms: number | null
}

export interface PlanoMedido {
  readonly consulta: string
  readonly tempoMs: number | null
  readonly plano: readonly string[]
}

/** O compose de carga, escrito no relatório: o que dá a vazão ao lote. */
export interface ConfiguracaoDoCenario {
  readonly replicasDaIa: number
  readonly poolLotePorReplica: number
  readonly vagasDaEscolaNoLote: number
  readonly tokensPorMinuto: number
  readonly baldeDoLotePorMinuto: number
  readonly tokensPorExecucao: number
  readonly latenciaDoModeloMs: number
}

export interface MedidaDaClassificacao {
  readonly configuracao: ConfiguracaoDoCenario
  readonly agendamento: AgendamentoDaA
  readonly classificacao: ClassificacaoDaA
  readonly parada: ParadaDoProvedor
  readonly turnoDaBNaBase: TurnoDaB
  readonly turnoDaBNoLote: TurnoDaB
  readonly planos: readonly PlanoMedido[]
}

export interface Reprovacao {
  readonly criterio: (typeof CRITERIOS)[number]
  readonly detalhe: string
}

export const CRITERIOS = ['agendamento', 'classificacao', 'vazao', 'parada', 'turno_da_b', 'plano'] as const

/**
 * A vazão por execução e a projeção das 630 na noite: do primeiro início ao último fim, **menos a parada do provedor** (a noite de verdade também tem as suas), dividido pelas execuções concluídas, vezes as
 * esperadas. Sem execução concluída ou sem o primeiro início, não há medida.
 */
export function projetarAsExecucoes(
  classificacao: Pick<ClassificacaoDaA, 'concluidas' | 'primeiroInicioMs' | 'ultimoFimMs'>,
  paradaMs = 0,
): { vazaoPorExecucaoMs: number | null; projecaoEmSegundos: number | null; execucoesPorMinuto: number | null } {
  const { concluidas, primeiroInicioMs, ultimoFimMs } = classificacao
  if (concluidas === 0 || primeiroInicioMs === null || ultimoFimMs === null) return { vazaoPorExecucaoMs: null, projecaoEmSegundos: null, execucoesPorMinuto: null }
  const andandoMs = Math.max(1, ultimoFimMs - primeiroInicioMs - paradaMs)
  const vazaoPorExecucaoMs = andandoMs / concluidas
  return {
    vazaoPorExecucaoMs: Math.round(vazaoPorExecucaoMs),
    projecaoEmSegundos: Math.round((vazaoPorExecucaoMs * EXECUCOES_ESPERADAS) / 1_000),
    execucoesPorMinuto: Math.round((60_000 / vazaoPorExecucaoMs) * 10) / 10,
  }
}

const horas = (segundos: number): string => `${(segundos / 3_600).toFixed(1)} h`

function julgarAgendamento({ agendamento }: MedidaDaClassificacao): Reprovacao[] {
  const { secoes, execucoes, jobs } = agendamento
  if (secoes === TOTAL_DE_SECOES && execucoes === EXECUCOES_ESPERADAS && jobs === EXECUCOES_ESPERADAS) return []
  return [{ criterio: 'agendamento', detalhe: `${String(secoes)} seções em ${String(execucoes)} execuções com ${String(jobs)} jobs; esperado ${String(TOTAL_DE_SECOES)}, ${String(EXECUCOES_ESPERADAS)} e ${String(EXECUCOES_ESPERADAS)}` }]
}

function julgarClassificacaoDasSecoes({ classificacao }: MedidaDaClassificacao): Reprovacao[] {
  const { secoesSemClassificacao, falhas, pendentes, concluidas } = classificacao
  if (secoesSemClassificacao === 0 && falhas === 0 && pendentes === 0 && concluidas === EXECUCOES_ESPERADAS) return []
  return [
    {
      criterio: 'classificacao',
      detalhe: `${String(secoesSemClassificacao)} seções sem classificação na abertura da janela (${String(concluidas)} execuções concluídas de ${String(EXECUCOES_ESPERADAS)}, ${String(falhas)} falhas, ${String(pendentes)} pendentes)`,
    },
  ]
}

function julgarVazao({ classificacao, parada }: MedidaDaClassificacao): Reprovacao[] {
  const paradaMs = parada.inicioMs === null || parada.fimMs === null ? 0 : parada.fimMs - parada.inicioMs
  const { projecaoEmSegundos } = projetarAsExecucoes(classificacao, paradaMs)
  if (projecaoEmSegundos === null) return [{ criterio: 'vazao', detalhe: 'nenhuma execução concluída: sem vazão para projetar' }]
  if (projecaoEmSegundos <= NOITE_EM_SEGUNDOS) return []
  return [{ criterio: 'vazao', detalhe: `as ${String(EXECUCOES_ESPERADAS)} execuções levam ${horas(projecaoEmSegundos)} (${String(projecaoEmSegundos)} s), acima das ${horas(NOITE_EM_SEGUNDOS)} da noite` }]
}

function julgarParada({ parada, classificacao }: MedidaDaClassificacao): Reprovacao[] {
  if (parada.inicioMs === null || parada.fimMs === null) return [{ criterio: 'parada', detalhe: 'o provedor não foi parado: o cenário não provou a retomada' }]
  // A execução que estava em andamento termina no prazo de graça do worker: a parada tem de ter ficado quase parada, e o lote tem de ter voltado a andar.
  const concluidasDepois = classificacao.concluidas - parada.concluidasAntes - parada.concluidasNaParada
  if (parada.concluidasNaParada > 2) return [{ criterio: 'parada', detalhe: `${String(parada.concluidasNaParada)} execuções concluídas com o worker-ia parado` }]
  if (concluidasDepois <= 0) return [{ criterio: 'parada', detalhe: 'o lote não voltou a andar depois da parada' }]
  return []
}

function julgarTurno({ turnoDaBNaBase, turnoDaBNoLote }: MedidaDaClassificacao): Reprovacao[] {
  const { amostras, p95Ms } = turnoDaBNoLote
  if (turnoDaBNaBase.p95Ms === null || turnoDaBNaBase.amostras < AMOSTRAS_MINIMAS_DO_TURNO) return [{ criterio: 'turno_da_b', detalhe: `a base do turno da B tem ${String(turnoDaBNaBase.amostras)} amostras: sem régua` }]
  if (p95Ms === null || amostras < AMOSTRAS_MINIMAS_DO_TURNO) return [{ criterio: 'turno_da_b', detalhe: `o turno da B com o lote tem ${String(amostras)} amostras, abaixo das ${String(AMOSTRAS_MINIMAS_DO_TURNO)}` }]
  if (p95Ms <= turnoDaBNaBase.p95Ms + MARGEM_SOBRE_A_BASE_MS) return []
  return [{ criterio: 'turno_da_b', detalhe: `o p95 do turno da B com o lote é ${String(p95Ms)} ms, acima da base ${String(turnoDaBNaBase.p95Ms)} ms mais ${String(MARGEM_SOBRE_A_BASE_MS)} ms` }]
}

function julgarPlanos({ planos }: MedidaDaClassificacao): Reprovacao[] {
  if (planos.length === 0) return [{ criterio: 'plano', detalhe: 'nenhum plano medido' }]
  return planos
    .filter((plano) => plano.tempoMs === null || plano.tempoMs > TETO_DO_PLANO_MS)
    .map((plano) => ({ criterio: 'plano' as const, detalhe: `${plano.consulta} levou ${plano.tempoMs === null ? 'tempo desconhecido' : `${String(plano.tempoMs)} ms`}, acima de ${String(TETO_DO_PLANO_MS)} ms` }))
}

function descrever(medida: MedidaDaClassificacao): string[] {
  const { configuracao, agendamento, classificacao, parada, turnoDaBNaBase, turnoDaBNoLote, planos } = medida
  const paradaMs = parada.inicioMs === null || parada.fimMs === null ? 0 : parada.fimMs - parada.inicioMs
  const projecao = projetarAsExecucoes(classificacao, paradaMs)
  return [
    `configuração: ${String(configuracao.replicasDaIa)} réplicas do worker-ia com pool \`lote\` de ${String(configuracao.poolLotePorReplica)}, vaga da escola no lote ${String(configuracao.vagasDaEscolaNoLote)}, balde do lote ${String(configuracao.baldeDoLotePorMinuto)} tokens/min (de ${String(configuracao.tokensPorMinuto)}), ${String(configuracao.tokensPorExecucao)} tokens por execução e ${String(configuracao.latenciaDoModeloMs)} ms por chamada`,
    `agendamento: ${String(agendamento.secoes)} seções em ${String(agendamento.execucoes)} execuções, ${String(agendamento.jobs)} jobs`,
    `classificação: ${String(classificacao.concluidas)} execuções concluídas, ${String(classificacao.secoesClassificadas)} seções classificadas, ${String(classificacao.secoesSemClassificacao)} sem classificação, ${String(classificacao.falhas)} falhas, ${String(classificacao.pendentes)} pendentes`,
    `vazão: ${projecao.vazaoPorExecucaoMs === null ? '-' : `${String(projecao.vazaoPorExecucaoMs)} ms por execução (${String(projecao.execucoesPorMinuto)} por minuto)`}; as ${String(EXECUCOES_ESPERADAS)} levam ${projecao.projecaoEmSegundos === null ? '-' : horas(projecao.projecaoEmSegundos)} de ${horas(NOITE_EM_SEGUNDOS)}`,
    `parada do provedor: ${String(parada.minutos)} min, ${String(parada.concluidasAntes)} execuções concluídas antes, ${String(parada.concluidasNaParada)} durante`,
    `Tutor da B: p95 ${turnoDaBNoLote.p95Ms === null ? '-' : `${String(turnoDaBNoLote.p95Ms)} ms`} com o lote (${String(turnoDaBNoLote.amostras)} turnos), base ${turnoDaBNaBase.p95Ms === null ? '-' : `${String(turnoDaBNaBase.p95Ms)} ms`} (${String(turnoDaBNaBase.amostras)} turnos)`,
    ...planos.map((plano) => `plano — ${plano.consulta}: ${plano.tempoMs === null ? '-' : `${String(plano.tempoMs)} ms`}\n${plano.plano.map((linha) => `    ${linha}`).join('\n')}`),
  ]
}

/** O veredito, critério por critério. Passa só sem nenhuma reprovação. */
export function julgarClassificacao(medida: MedidaDaClassificacao): { passou: boolean; reprovacoes: Reprovacao[]; linhas: string[] } {
  const reprovacoes = [...julgarAgendamento(medida), ...julgarClassificacaoDasSecoes(medida), ...julgarVazao(medida), ...julgarParada(medida), ...julgarTurno(medida), ...julgarPlanos(medida)]
  return { passou: reprovacoes.length === 0, reprovacoes, linhas: descrever(medida) }
}

export function codigoDeSaidaDaClassificacao(reprovacoes: readonly Reprovacao[]): number {
  return reprovacoes.length === 0 ? 0 : 1
}

const talvez = (valor: unknown): number | null => (valor === null || valor === undefined ? null : Number(valor))

/** O que a rotina agendou na escola A: as seções com execução, as execuções e os jobs delas. */
export async function lerAgendamentoDaA(banco: Consultavel, escolaA: string): Promise<AgendamentoDaA> {
  const { rows } = await banco.query<Record<string, unknown>>(
    `select (select count(*) from secao_do_material where escola_id = $1 and execucao_id is not null) as secoes,
            (select count(*) from execucao_agente where escola_id = $1 and tarefa = 'classificar_secoes') as execucoes,
            (select count(*) from job_registro where escola_id = $1 and tipo = 'ia.executar-lote') as jobs`,
    [escolaA],
  )
  const linha = rows[0] ?? {}
  return { secoes: Number(linha['secoes'] ?? 0), execucoes: Number(linha['execucoes'] ?? 0), jobs: Number(linha['jobs'] ?? 0) }
}

/** O estado da classificação da A: as execuções por estado, as seções com e sem `classificada_em`, e o primeiro início e o último fim, em ms desde a época. */
export async function lerClassificacaoDaA(banco: Consultavel, escolaA: string): Promise<ClassificacaoDaA> {
  const { rows } = await banco.query<Record<string, unknown>>(
    `select count(*) filter (where estado = 'concluida') as concluidas,
            count(*) filter (where estado = 'falhou') as falhas,
            count(*) filter (where estado in ('pendente', 'rodando')) as pendentes,
            extract(epoch from min(iniciada_em)) * 1000 as "primeiroInicioMs",
            extract(epoch from max(concluida_em)) * 1000 as "ultimoFimMs"
       from execucao_agente where escola_id = $1 and tarefa = 'classificar_secoes'`,
    [escolaA],
  )
  const secoes = await banco.query<Record<string, unknown>>(
    `select count(*) filter (where classificada_em is not null) as classificadas, count(*) filter (where classificada_em is null and corrigida_em is null) as sem from secao_do_material where escola_id = $1`,
    [escolaA],
  )
  const linha = rows[0] ?? {}
  const daSecao = secoes.rows[0] ?? {}
  return {
    concluidas: Number(linha['concluidas'] ?? 0),
    falhas: Number(linha['falhas'] ?? 0),
    pendentes: Number(linha['pendentes'] ?? 0),
    primeiroInicioMs: talvez(linha['primeiroInicioMs']),
    ultimoFimMs: talvez(linha['ultimoFimMs']),
    secoesClassificadas: Number(daSecao['classificadas'] ?? 0),
    secoesSemClassificacao: Number(daSecao['sem'] ?? 0),
  }
}

/** As execuções concluídas da A até agora: o driver as lê para dizer quando o lote já andou o bastante para parar o provedor, e para medir a parada. */
export async function contarConcluidasDaA(banco: Consultavel, escolaA: string): Promise<number> {
  const { rows } = await banco.query<{ total: string }>("select count(*) as total from execucao_agente where escola_id = $1 and tarefa = 'classificar_secoes' and estado = 'concluida'", [escolaA])
  return Number(rows[0]?.total ?? 0)
}

/**
 * Espera as execuções da A terminarem (nenhuma `pendente` nem `rodando`), até o prazo. Devolve o estado lido no fim, que é o do veredito: o prazo estourado
 * deixa execuções pendentes, e o critério `classificacao` reprova com a contagem.
 */
export async function aguardarClassificacaoDaA(banco: Consultavel, escolaA: string, prazoMs: number, esperarUmPouco: () => Promise<void>, aoLer?: (lida: ClassificacaoDaA) => void): Promise<ClassificacaoDaA> {
  const limite = Date.now() + prazoMs
  for (;;) {
    const lida = await lerClassificacaoDaA(banco, escolaA)
    aoLer?.(lida)
    if (lida.pendentes === 0 || Date.now() > limite) return lida
    await esperarUmPouco()
  }
}

/** O turno do Tutor da B nas execuções criadas entre `inicioMs` e `fimMs`, só as concluídas: de `criada_em` a `concluida_em`. O mesmo que a fase do expurgo lê. */
export async function lerTurnoDaB(banco: Consultavel, escolaB: string, janela: { inicioMs: number; fimMs: number }): Promise<TurnoDaB> {
  const { rows } = await banco.query<Record<string, unknown>>(
    `select count(*) as amostras, percentile_cont(0.95) within group (order by extract(epoch from concluida_em - criada_em)::float8 * 1000) as "p95Ms"
       from execucao_agente
      where escola_id = $1 and funcao = 'tutor_com_o_aluno' and estado = 'concluida'
        and criada_em between to_timestamp($2::float8 / 1000) and to_timestamp($3::float8 / 1000)`,
    [escolaB, janela.inicioMs, janela.fimMs],
  )
  const linha = rows[0] ?? {}
  const p95 = talvez(linha['p95Ms'])
  return { amostras: Number(linha['amostras'] ?? 0), p95Ms: p95 === null ? null : Math.round(p95) }
}

/** `EXPLAIN (ANALYZE)` de uma consulta do volume do cenário: o tempo de execução e as linhas do plano. */
export async function medirPlano(banco: Consultavel, consulta: string, texto: string, valores: unknown[]): Promise<PlanoMedido> {
  const { rows } = await banco.query<Record<string, string>>(`explain (analyze, costs off, timing on) ${texto}`, valores)
  const plano = rows.map((linha) => Object.values(linha)[0] ?? '')
  const execucao = plano.find((linha) => linha.startsWith('Execution Time:'))
  const tempo = execucao === undefined ? null : Number.parseFloat(execucao.replace('Execution Time:', ''))
  return { consulta, tempoMs: tempo === null || Number.isNaN(tempo) ? null : Math.round(tempo), plano }
}
