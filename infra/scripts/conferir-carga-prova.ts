import type { Reprovacao } from './carga.ts'

/**
 * O veredito do cenário "a prova da manhã" (avaliacao-e-correcao, tarefa 6.0; `cenarios.md`, seção 5; Tech Spec, seção 7c), sem subir nada: o que o k6 mediu e o que o banco guardou, critério por
 * critério. O cenário é `infra/k6/prova-online.js` e o driver é `infra/scripts/carga-prova.ts`.
 */

/** O que o k6 tem escrito nas constantes dele, e que `infra/test/carga-prova.test.ts` confere contra estas. */
export const ESCOLAS_DA_PROVA = 10
export const TURMAS_POR_ESCOLA_DA_PROVA = 6
export const ALUNOS_POR_TURMA_DA_PROVA = 35
export const ITENS_DA_PROVA = 20
export const LIMITE_P95_DO_PUT_MS = 500
/** A fila de cada aluno que atravessou a queda esvazia em até isto depois do fim previsto dela (`cenarios.md` §5). */
export const LIMITE_DA_VOLTA_S = 60
export const QUEDA_INICIO_S = 180
export const QUEDA_DURACAO_S = 90
export const REDE_CAI_APOS_S = 120
export const REDE_CAI_DURACAO_S = 60
/** Uma fração dos alunos fica sem rede, por 1 min: um em cada dez. */
export const UM_ALUNO_EM_CADA_SEM_REDE = 10
/** O tempo que a queda anda do limite de quem estava em prova: no mínimo isto, dos 90 s. */
export const AVANCO_MINIMO_DO_LIMITE_S = 30
/** A lacuna que o pulso grava tem de ser da duração da queda, menos a folga do primeiro pulso depois do `unpause`. */
export const FOLGA_DA_LACUNA_S = 15

export const ALUNOS_DA_PROVA = ESCOLAS_DA_PROVA * TURMAS_POR_ESCOLA_DA_PROVA * ALUNOS_POR_TURMA_DA_PROVA
export const RESPOSTAS_ESPERADAS = ALUNOS_DA_PROVA * ITENS_DA_PROVA

/** O que o k6 escreveu no `--summary-export`, no que o veredito usa. */
export interface ResumoDaProva {
  /** O p95 do PUT do aluno que não está se recuperando (`put_fluxo_normal_ms`): o do critério. */
  readonly putFluxoNormalP95Ms: number | undefined
  /** O p95 do PUT de quem se recupera (`put_da_volta_ms`): só para ler, sem limite. */
  readonly putDaVoltaP95Ms: number | undefined
  /** O maior tempo que uma fila levou para esvaziar depois do fim previsto da queda (`fila_esvaziada_na_volta_s`); `undefined` se nenhuma atravessou a queda. */
  readonly filaDaVoltaMaxS: number | undefined
  readonly respostasEnviadas: number
  readonly putFalhasForaDaQueda: number
  readonly respostasInesperadas: number
}

/** A prova que vence durante a queda e que a rotina não pode encerrar até o pulso voltar: o que o banco guardou dela. */
export interface CanarioDaQueda {
  readonly fechaEm: Date
  readonly encerradaEm: Date | null
  /** O `enviada_em` que o encerramento gravou na tentativa dela: o limite, andado pela queda. */
  readonly limiteGravadoEm: Date | null
}

export interface MedidaDaProva {
  readonly k6: ResumoDaProva | undefined
  readonly respostasGravadas: number
  /** A lacuna que o pulso gravou ao voltar da queda: duração, início e fim. */
  readonly lacuna: { readonly duracaoS: number; readonly inicio: Date; readonly fim: Date } | undefined
  /** Quantas provas foram encerradas entre o início e o fim da queda. */
  readonly encerradasNaQueda: number
  readonly canario: CanarioDaQueda | undefined
}

const reprovar = (criterio: string, detalhe: string): Reprovacao => ({ criterio, detalhe })

/** Lê o `--summary-export` do k6 (o `p(95)` do PUT do fluxo normal e o da volta, o `max` da fila da volta, o `count` de cada contador). Sem o arquivo, ou sem a métrica, o resumo não existe. */
export function lerResumoDaProva(resumo: unknown): ResumoDaProva | undefined {
  if (typeof resumo !== 'object' || resumo === null || !('metrics' in resumo)) return undefined
  const metricas = resumo.metrics as Record<string, Record<string, unknown> | undefined>
  const numero = (valor: unknown): number | undefined => (typeof valor === 'number' && Number.isFinite(valor) ? valor : undefined)
  const contagem = (nome: string): number => numero(metricas[nome]?.['count']) ?? 0
  return {
    putFluxoNormalP95Ms: numero(metricas['put_fluxo_normal_ms']?.['p(95)']),
    putDaVoltaP95Ms: numero(metricas['put_da_volta_ms']?.['p(95)']),
    filaDaVoltaMaxS: numero(metricas['fila_esvaziada_na_volta_s']?.['max']),
    respostasEnviadas: contagem('respostas_enviadas'),
    putFalhasForaDaQueda: contagem('put_falhas_fora_da_queda'),
    respostasInesperadas: contagem('respostas_inesperadas'),
  }
}

/** O p95 do PUT do fluxo normal e a fila da volta: os dois números que a decisão de 27/11/2026 separou. */
function julgarOTempo(putFluxoNormalP95Ms: number, filaDaVoltaMaxS: number | undefined): Reprovacao[] {
  const reprovacoes: Reprovacao[] = []
  if (putFluxoNormalP95Ms >= LIMITE_P95_DO_PUT_MS) {
    reprovacoes.push(reprovar('put_p95', `o p95 do PUT de resposta no fluxo normal foi de ${String(Math.round(putFluxoNormalP95Ms))} ms, e o teto é ${String(LIMITE_P95_DO_PUT_MS)} ms`))
  }
  if (filaDaVoltaMaxS === undefined) {
    reprovacoes.push(reprovar('sem_amostra', 'nenhuma fila de aluno atravessou a queda: a volta não foi medida'))
  } else if (filaDaVoltaMaxS >= LIMITE_DA_VOLTA_S) {
    reprovacoes.push(reprovar('fila_da_volta', `a fila de um aluno levou ${String(Math.round(filaDaVoltaMaxS))} s para esvaziar depois do fim da queda, e o teto é ${String(LIMITE_DA_VOLTA_S)} s`))
  }
  return reprovacoes
}

function julgarOK6(k6: ResumoDaProva | undefined, respostasGravadas: number): Reprovacao[] {
  if (k6 === undefined || k6.putFluxoNormalP95Ms === undefined || k6.respostasEnviadas === 0) return [reprovar('sem_amostra', 'o k6 não deixou resumo, ou nenhuma resposta foi enviada: a medida não diz nada')]
  const reprovacoes: Reprovacao[] = []
  reprovacoes.push(...julgarOTempo(k6.putFluxoNormalP95Ms, k6.filaDaVoltaMaxS))
  if (k6.respostasEnviadas !== respostasGravadas) {
    reprovacoes.push(reprovar('resposta_perdida', `o cliente deu ${String(k6.respostasEnviadas)} respostas como enviadas e o banco tem ${String(respostasGravadas)}: resposta de prova não se perde nem se duplica`))
  }
  if (k6.respostasEnviadas !== RESPOSTAS_ESPERADAS) {
    reprovacoes.push(reprovar('resposta_nao_enviada', `eram ${String(RESPOSTAS_ESPERADAS)} respostas e o cliente enviou ${String(k6.respostasEnviadas)}: algum aluno não conseguiu terminar a prova`))
  }
  if (k6.putFalhasForaDaQueda > 0) reprovacoes.push(reprovar('put_falhou_fora_da_queda', `${String(k6.putFalhasForaDaQueda)} PUT falharam fora da janela da queda`))
  if (k6.respostasInesperadas > 0) reprovacoes.push(reprovar('resposta_inesperada', `${String(k6.respostasInesperadas)} chamadas (começar, tempo ou enviar) falharam fora da janela da queda`))
  return reprovacoes
}

function julgarOCanario(canario: CanarioDaQueda | undefined, lacuna: MedidaDaProva['lacuna']): Reprovacao[] {
  if (canario?.encerradaEm == null || canario.limiteGravadoEm === null) {
    return [reprovar('canario_nao_encerrado', 'a prova que venceu durante a queda não foi encerrada depois dela: a rotina não voltou a rodar')]
  }
  const reprovacoes: Reprovacao[] = []
  if (lacuna !== undefined && canario.encerradaEm.getTime() < lacuna.fim.getTime()) {
    reprovacoes.push(reprovar('encerrada_na_queda', 'a prova que venceu durante a queda foi encerrada antes de a queda terminar'))
  }
  const avancoS = (canario.limiteGravadoEm.getTime() - canario.fechaEm.getTime()) / 1_000
  if (avancoS < AVANCO_MINIMO_DO_LIMITE_S) {
    reprovacoes.push(reprovar('limite_nao_andou', `a queda devia andar o limite de quem estava em prova em pelo menos ${String(AVANCO_MINIMO_DO_LIMITE_S)} s, e andou ${String(Math.round(avancoS))} s`))
  }
  return reprovacoes
}

function julgarAQueda(medida: MedidaDaProva): Reprovacao[] {
  const { lacuna } = medida
  const reprovacoes: Reprovacao[] = []
  if (lacuna === undefined || lacuna.duracaoS < QUEDA_DURACAO_S - FOLGA_DA_LACUNA_S) {
    reprovacoes.push(reprovar('queda_nao_gravada', `o pulso devia gravar uma lacuna de ~${String(QUEDA_DURACAO_S)} s, e gravou ${lacuna === undefined ? 'nenhuma' : `${String(Math.round(lacuna.duracaoS))} s`}`))
  }
  if (medida.encerradasNaQueda > 0) {
    reprovacoes.push(reprovar('encerrada_na_queda', `${String(medida.encerradasNaQueda)} provas foram encerradas durante a queda: com a API parada nada encerra, porque o tempo dos alunos ainda vai andar`))
  }
  return [...reprovacoes, ...julgarOCanario(medida.canario, lacuna)]
}

/** Os critérios da prova da manhã, na ordem do `cenarios.md`: o p95 do fluxo normal, a fila que esvazia na volta, a resposta que não se perde, e a queda que anda o limite sem encerrar. Vazio, o cenário passou. */
export function julgarProva(medida: MedidaDaProva): Reprovacao[] {
  return [...julgarOK6(medida.k6, medida.respostasGravadas), ...julgarAQueda(medida)]
}

/**
 * Os controles negativos, e o critério pelo qual cada um precisa reprovar: o PUT atrasado em 600 ms reprova pelo p95 do fluxo normal; as APIs fora por 150 s em vez de 90 (o k6 sem saber)
 * reprovam pela volta. Reprovar porque o ambiente não funcionou não prova que o limite importa.
 */
export type ControleNegativoDaProva = 'put_p95' | 'fila_da_volta'

export function codigoDeSaidaDaProva(reprovacoes: readonly Reprovacao[], controleNegativo: ControleNegativoDaProva | undefined): number {
  if (controleNegativo !== undefined) return reprovacoes.some((reprovacao) => reprovacao.criterio === controleNegativo) ? 0 : 1
  return reprovacoes.length === 0 ? 0 : 1
}

const em = (valor: number | undefined, unidade: string): string => (valor === undefined ? '-' : `${String(Math.round(valor))} ${unidade}`)

function descreverOCanario(canario: CanarioDaQueda | undefined): string {
  if (canario?.encerradaEm == null) return '  prova que venceu na queda: não encerrada'
  const avancoS = ((canario.limiteGravadoEm?.getTime() ?? 0) - canario.fechaEm.getTime()) / 1_000
  return `  prova que venceu na queda: encerrada ${canario.encerradaEm.toISOString()}, limite andou ${String(Math.round(avancoS))} s`
}

export function descreverProva(medida: MedidaDaProva): string[] {
  const { k6, lacuna } = medida
  return [
    `  PUT de resposta no fluxo normal: p95 ${em(k6?.putFluxoNormalP95Ms, 'ms')} (teto ${String(LIMITE_P95_DO_PUT_MS)} ms); na volta (sem teto): p95 ${em(k6?.putDaVoltaP95Ms, 'ms')}`,
    `  volta da queda: a fila mais lenta esvaziou ${em(k6?.filaDaVoltaMaxS, 's')} depois do fim dela (teto ${String(LIMITE_DA_VOLTA_S)} s)`,
    `  respostas: ${String(k6?.respostasEnviadas ?? 0)} enviadas pelo cliente, ${String(medida.respostasGravadas)} gravadas, ${String(RESPOSTAS_ESPERADAS)} esperadas`,
    `  queda: lacuna de ${em(lacuna?.duracaoS, 's')}, ${String(medida.encerradasNaQueda)} provas encerradas durante ela`,
    descreverOCanario(medida.canario),
  ]
}
