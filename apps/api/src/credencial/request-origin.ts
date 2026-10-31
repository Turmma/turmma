import { IP_DESCONHECIDO } from '@educa/core'
import type { LoginResponse } from '@educa/shared'

/** O que o controller tira da requisição HTTP: o IP (o da borda, quando vem dela) e o cabeçalho `Cookie`. */
export interface OrigemDaRequisicao {
  readonly ip: string
  readonly cabecalhoCookie: string | undefined
  /**
   * Só nas rotas de login por senha (`@DowngradeRateLimit()`, 15.0): o IP passou do limite por IP delas. A tentativa não é
   * recusada: vai para o fim do balde, salvo quem traz o `educa_dispositivo` da conta.
   */
  readonly acimaDoLimiteDoIp?: boolean
}

/** A resposta do login e os `Set-Cookie` que vão com ela. */
export interface ResultadoDoLogin {
  readonly resposta: LoginResponse
  readonly cookies: readonly string[]
}

/** O registro de acesso guarda o IP como `inet`: o endereço que não foi lido (socket já fechado) vira o não roteável. */
const IP_NAO_LIDO = '0.0.0.0'

/** O IP como o registro de acesso o grava: o que não foi lido vira o não roteável. */
export function ipParaRegistro(ip: string): string {
  return ip === IP_DESCONHECIDO ? IP_NAO_LIDO : ip
}
