import type { EsqueciSenhaRequest, RedefinirSenhaRequest, VerificarContaRequest } from '@educa/shared'
import { EMPTY_BODY, apiRequest } from './client'

const CAMINHO_DO_ESQUECI = '/v1/senha/esqueci'
const CAMINHO_DO_REDEFINIR = '/v1/senha/redefinir'
const CAMINHO_DO_VERIFICAR = '/v1/conta/verificar'

/**
 * `POST /v1/senha/esqueci` (acesso-e-convites, 6.0; RF12): pede o link por e-mail. A resposta é 202 e igual exista ou não a
 * conta, então não há corpo a ler, e a tela diz a mesma frase para todos. O pedido é o tipo do `@educa/shared` (regra 50, item 4):
 * se o contrato mudar, a web deixa de compilar. O e-mail vai no corpo, nunca na URL da API (regra 20, item 9), e a chamada não passa pelo TanStack Query: o e-mail digitado é o argumento, e uma chave de cache com ele dentro é o
 * que não pode existir.
 */
export function pedirLinkDeSenha(pedido: EsqueciSenhaRequest): Promise<void> {
  return apiRequest(CAMINHO_DO_ESQUECI, EMPTY_BODY, { metodo: 'POST', corpo: pedido })
}

/**
 * `POST /v1/senha/redefinir`: troca a senha com o token do link, lido pela tela do fragmento `#` e mandado no corpo (regra 20,
 * item 8; regra 50, item 7). Responde 204. Vencido, usado, substituído e inexistente chegam iguais, em `NAO_ENCONTRADO`; a
 * senha fora da regra, em `ENTRADA_INVALIDA`. O pedido é o tipo do `@educa/shared`. Não abre sessão: o segundo fator da coordenação continua exigido na entrada.
 */
export function redefinirSenha(pedido: RedefinirSenhaRequest): Promise<void> {
  return apiRequest(CAMINHO_DO_REDEFINIR, EMPTY_BODY, { metodo: 'POST', corpo: pedido })
}

/**
 * `POST /v1/conta/verificar` (acesso-e-convites, 8.0; RF12): prova a posse do e-mail com o token do link de verificar, lido pela
 * tela do fragmento `#` e mandado no corpo (regra 20, item 8; regra 50, item 7). Responde 204. Vencido, usado, substituído e
 * inexistente chegam iguais, em `NAO_ENCONTRADO`. O pedido é o tipo do `@educa/shared`. Não abre sessão nem aceita convite: a
 * pessoa volta ao convite e aceita de novo.
 */
export function verificarConta(pedido: VerificarContaRequest): Promise<void> {
  return apiRequest(CAMINHO_DO_VERIFICAR, EMPTY_BODY, { metodo: 'POST', corpo: pedido })
}
