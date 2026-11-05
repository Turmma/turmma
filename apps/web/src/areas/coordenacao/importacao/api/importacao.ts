import {
  ErrorCode,
  gravarPlanilhaResponseSchema,
  importacaoSchema,
  INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS,
  previaDaPlanilhaResponseSchema,
  type ErroDaImportacao,
  type GravarPlanilhaResponse,
  type Importacao,
  type MarcasDaPlanilha,
  type PreviaDaPlanilhaResponse,
  type TipoDePlanilha,
} from '@educa/shared'
import { ApiError } from '../../../../api/client'
import { authedGet, authedRequest } from '../../../../api/sessao'

/**
 * A API de importação de planilha (F2, 13.0; Tech Spec, seção 4): a prévia, o gravar (202 com o id da importação) e a leitura da
 * importação até o job terminar. O texto da planilha, com nome e matrícula, só passa por aqui no corpo da requisição e na memória da
 * página: nunca no endereço, em `localStorage` ou em `sessionStorage` (regra 20; regra 50, item 7).
 */

/** As duas rotas de uma planilha: a prévia e o gravar. A lista da turma tem as dela (`/v1/turmas/:id/lista/previa` e `/lista`), com o mesmo contrato. */
export interface RotasDaPlanilha {
  readonly previa: string
  readonly gravar: string
}

export function rotasDaPlanilha(tipo: TipoDePlanilha): RotasDaPlanilha {
  return { previa: `/v1/importacoes/${tipo}/previa`, gravar: `/v1/importacoes/${tipo}` }
}

/** `POST …/previa`: o que aconteceria com cada linha, sem gravar nada. O sinal cancela a prévia que um arquivo novo deixou para trás. */
export function previaDaPlanilha(rotas: RotasDaPlanilha, texto: string, sinal?: AbortSignal): Promise<PreviaDaPlanilhaResponse> {
  return authedRequest(rotas.previa, previaDaPlanilhaResponseSchema, { metodo: 'POST', corpo: { texto }, sinal })
}

/** `POST …`: enfileira a gravação (202). O gravar refaz a prévia, e o que a coordenação não marcou não muda ninguém. */
export function gravarPlanilha(rotas: RotasDaPlanilha, texto: string, marcas: MarcasDaPlanilha): Promise<GravarPlanilhaResponse> {
  return authedRequest(rotas.gravar, gravarPlanilhaResponseSchema, { metodo: 'POST', corpo: { texto, marcas } })
}

/** `GET /v1/importacoes/:id`, com o sinal que cancela a leitura quando a tela sai. */
export function lerImportacao(id: string, sinal?: AbortSignal): Promise<Importacao> {
  return authedGet(`/v1/importacoes/${encodeURIComponent(id)}`, importacaoSchema, sinal)
}

/**
 * A importação que terminou sem gravar: `desatualizada` (a escola mudou desde a prévia) ou `falhou` (com o código, de lista fechada).
 * Não é erro de rede nem de contrato, e por isso tem classe própria: a tela diz a causa de cada uma em texto diferente.
 */
export class ImportacaoNaoConcluidaError extends Error {
  constructor(
    readonly estado: 'desatualizada' | 'falhou',
    readonly erro: ErroDaImportacao | null,
  ) {
    super(estado)
    this.name = 'ImportacaoNaoConcluidaError'
  }
}

/**
 * Quanto esperar entre uma leitura da importação e a seguinte, e por quanto tempo antes de avisar. O job leva segundos, e o prazo
 * dele na fila é de 300 s. A espera começa no intervalo que a casa usa para acompanhar uma execução (1 s) e cresce 1,5 vez a cada
 * leitura até 3 s: em 60 s são umas 22 leituras, bem abaixo do limite por usuário (120 por minuto), que a coordenadora divide com tudo
 * o mais que faz (regra 80, item 1).
 */
export const ESPERA_ENTRE_LEITURAS_DA_IMPORTACAO_MS = INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS
export const ESPERA_MAXIMA_ENTRE_LEITURAS_DA_IMPORTACAO_MS = 3_000
/** Depois disto a tela diz que a fila está mais cheia que o normal, e **continua** acompanhando: desistir aos 60 s, com o job ainda vivo por até 300 s, mostraria "falhou" para uma gravação que depois conclui. */
export const PRAZO_PARA_AVISAR_DA_FILA_MS = 60_000

export interface AcompanhamentoOptions {
  /** Cancela a espera e a leitura em andamento: a tela que sai não deixa leitura pendurada (regra 80). */
  readonly sinal?: AbortSignal | undefined
  readonly esperaMs?: number
  readonly esperaMaximaMs?: number
  readonly avisarDepoisDeMs?: number
  /** Chamado uma vez, quando a importação passa de `avisarDepoisDeMs` ainda na fila. */
  readonly aoDemorar?: () => void
  /** O relógio e a espera, trocáveis no teste. */
  readonly agora?: () => number
  readonly esperar?: (ms: number, sinal?: AbortSignal) => Promise<void>
}

/** Espera `ms`, ou termina com o motivo do cancelamento se o sinal disparar antes. */
function esperarComSinal(ms: number, sinal?: AbortSignal): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    if (sinal?.aborted === true) {
      rejeitar(sinal.reason)
      return
    }
    const parar = (): void => {
      clearTimeout(relogio)
      rejeitar(sinal?.reason)
    }
    const relogio = setTimeout(() => {
      sinal?.removeEventListener('abort', parar)
      resolver()
    }, ms)
    sinal?.addEventListener('abort', parar, { once: true })
  })
}

/** O erro de leitura que não derruba o acompanhamento: o job segue na fila, e quem leu é que ficou sem resposta agora. */
const ehEsperavel = (erro: unknown): erro is ApiError => erro instanceof ApiError && (erro.codigo === ErrorCode.LIMITE_EXCEDIDO || erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)

type Leitura = { readonly concluida: Importacao } | { readonly esperaMinimaMs: number }

/**
 * Uma leitura da importação: concluída, ou ainda na fila (com a espera mínima até a próxima). `desatualizada` e `falhou` sobem como
 * `ImportacaoNaoConcluidaError`. O 429 e o 503 contam como "ainda na fila", e no 429 a espera é o `Retry-After` ou mais, nunca menos.
 */
async function lerUmaVez(ler: (sinal?: AbortSignal) => Promise<Importacao>, sinal: AbortSignal | undefined, espera: number): Promise<Leitura> {
  try {
    const lida = await ler(sinal)
    if (lida.estado === 'concluida') return { concluida: lida }
    if (lida.estado !== 'na_fila') throw new ImportacaoNaoConcluidaError(lida.estado, lida.erro)
    return { esperaMinimaMs: espera }
  } catch (erro) {
    if (!ehEsperavel(erro) || sinal?.aborted === true) throw erro
    return { esperaMinimaMs: Math.max(espera, (erro.esperaSegundos ?? 0) * 1000) }
  }
}

const PADROES = {
  esperaMs: ESPERA_ENTRE_LEITURAS_DA_IMPORTACAO_MS,
  esperaMaximaMs: ESPERA_MAXIMA_ENTRE_LEITURAS_DA_IMPORTACAO_MS,
  avisarDepoisDeMs: PRAZO_PARA_AVISAR_DA_FILA_MS,
  agora: Date.now,
  esperar: esperarComSinal,
}

/**
 * Lê a importação até ela sair da fila e devolve a `concluida`. Sem prazo para desistir: o job pode levar até 300 s e a tela diz que
 * está demorando (`aoDemorar`), em vez de dar a gravação por perdida. Qualquer erro que não seja o "ainda na fila", e o cancelamento
 * pelo sinal, sobem.
 */
export async function acompanharImportacao(ler: (sinal?: AbortSignal) => Promise<Importacao>, opcoes: AcompanhamentoOptions = {}): Promise<Importacao> {
  const { sinal, aoDemorar } = opcoes
  const { esperaMs, esperaMaximaMs, avisarDepoisDeMs, agora, esperar } = { ...PADROES, ...opcoes }
  const comeco = agora()
  let espera = esperaMs
  let avisou = false
  for (;;) {
    sinal?.throwIfAborted()
    const leitura = await lerUmaVez(ler, sinal, espera)
    if ('concluida' in leitura) return leitura.concluida
    if (!avisou && agora() - comeco >= avisarDepoisDeMs) {
      avisou = true
      aoDemorar?.()
    }
    await esperar(leitura.esperaMinimaMs, sinal)
    espera = Math.min(espera * 1.5, esperaMaximaMs)
  }
}
