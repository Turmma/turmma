/**
 * Contrato do realtime (socket.io) entre servidor e cliente.
 *
 * O cliente se autentica com o mesmo JWT da API, enviado no pacote de conexão do socket.io
 * (`auth`), nunca na URL: query de URL vai parar em log de borda, histórico e cabeçalho
 * `Referer`. A sala de escola é definida pelo servidor a partir do token; não existe evento para
 * o cliente escolher sala.
 */

/** Namespace do F0. As salas ao vivo do modo sala (F10) entram em namespace próprio. */
export const SYSTEM_REALTIME_NAMESPACE = '/sistema'

/** Caminho HTTP do socket.io, o mesmo que a borda encaminha para as instâncias de realtime. */
export const REALTIME_PATH = '/socket.io'

/**
 * Reconexão com espalhamento aleatório. Quando uma instância cai, todos os clientes dela perdem a
 * conexão no mesmo instante; sem o espalhamento, voltariam todos no mesmo milissegundo, e a
 * outra instância receberia a sala inteira de uma vez.
 *
 * Com estes valores a primeira tentativa cai entre 0,5 s e 1,5 s, e as seguintes dobram até 10 s,
 * sempre com ±50% de sorteio.
 */
export const REALTIME_RECONNECTION = {
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 10_000,
  randomizationFactor: 0.5,
} as const

/** O que o cliente manda no pacote de conexão. */
export interface RealtimeAuth {
  token: string
}

export interface RealtimeClientOptions {
  path: typeof REALTIME_PATH
  reconnection: boolean
  reconnectionDelay: number
  reconnectionDelayMax: number
  randomizationFactor: number
  /** Leva o cookie de afinidade da borda, que prende o polling do socket.io a uma instância. */
  withCredentials: true
  /** Lido a cada tentativa: a reconexão usa o token vigente, não o do primeiro acesso. */
  auth: (entregar: (dados: RealtimeAuth) => void) => void
}

/** Opções de `io(url + SYSTEM_REALTIME_NAMESPACE, opcoes)` para todo cliente do realtime. */
export function realtimeClientOptions(obterToken: () => string): RealtimeClientOptions {
  return {
    path: REALTIME_PATH,
    ...REALTIME_RECONNECTION,
    withCredentials: true,
    auth: (entregar) => entregar({ token: obterToken() }),
  }
}
