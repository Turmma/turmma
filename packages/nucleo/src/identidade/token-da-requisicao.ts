import { InvariantException } from '@educa/shared'
import type { TokenVerificado } from './verificar-token.js'

/**
 * O token verificado de cada requisição, entre a `GuardaDeAutenticacao`, que o grava, e as guardas de limite e de
 * sessão, que o leem. Fica preso ao objeto da requisição, fora do alcance do cliente, e some com ela: nada fica em
 * memória entre requisições (regra 80, item 5).
 *
 * Não vai para o contexto: o contexto só recebe escola e usuário depois de a sessão ser conferida, e nenhum código
 * que rode antes disso trata um token verificado como sessão válida.
 */
const tokens = new WeakMap<object, TokenVerificado>()

export function guardarTokenDaRequisicao(requisicao: object, token: TokenVerificado): void {
  if (tokens.has(requisicao)) throw new InvariantException('token da requisição já definido')
  tokens.set(requisicao, token)
}

/** O token que a autenticação verificou nesta requisição, ou `undefined` se ela não verificou nenhum. */
export function tokenDaRequisicao(requisicao: object): TokenVerificado | undefined {
  return tokens.get(requisicao)
}
