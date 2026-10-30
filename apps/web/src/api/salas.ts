import { reivindicacaoResponseSchema, salaAbertaResponseSchema, type AbrirSalaRequest, type ReivindicarSalaRequest, type ReivindicacaoResponse, type SalaAbertaResponse } from '@educa/shared'
import { chamarApi } from './cliente'

/**
 * A página pública da turma (A1, 17.0; as rotas são da 5.0 e da 6.0): sem sessão e sem token de acesso. O slug, o token
 * do link ou o código, a matrícula e a senha vão no corpo, nunca no endereço. O cookie de renovação de quem estiver com a
 * sessão aberta neste computador não vai junto: ele é preso a `/v1/sessao` (`apps/api/src/credencial/cookies.ts`).
 *
 * As respostas não passam pelo cache do TanStack Query: a página guarda os nomes e a chave de envio só no estado dela, e
 * nada desta conversa fica no navegador quando a tela sai (Tech Spec da A1, seção 7).
 */

/** `POST /v1/salas/abrir`: o nome da turma e os nomes livres da lista. Acesso que não vale responde `NAO_ENCONTRADO`. */
export function abrirSala(pedido: AbrirSalaRequest): Promise<SalaAbertaResponse> {
  return chamarApi('/v1/salas/abrir', salaAbertaResponseSchema, { metodo: 'POST', corpo: pedido })
}

/**
 * `POST /v1/salas/reivindicar`: o pedido do nome, que espera a decisão do professor. O mesmo `chaveEnvio` reenviado
 * responde `enviado` sem pedido novo; a recusa é `REIVINDICACAO_RECUSADA`.
 */
export function reivindicarNome(pedido: ReivindicarSalaRequest): Promise<ReivindicacaoResponse> {
  return chamarApi('/v1/salas/reivindicar', reivindicacaoResponseSchema, { metodo: 'POST', corpo: pedido })
}
