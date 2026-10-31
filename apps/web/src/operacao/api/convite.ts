import {
  ErrorCode,
  aceitarConviteDeOperadorResponseSchema,
  consultarConviteDeOperadorResponseSchema,
  type AceitarConviteDeOperadorRequest,
  type ConsultarConviteDeOperadorResponse,
} from '@educa/shared'
import { chamarApi, ErroDaApi } from '../../api/client'
import { esquecerDesafioDeOperador, guardarDesafioDeOperador } from './sessao'

export const CAMINHO_DA_CONSULTA_DE_CONVITE_DE_OPERADOR = '/v1/operacao/convite/consultar'
export const CAMINHO_DO_ACEITE_DE_CONVITE_DE_OPERADOR = '/v1/operacao/convite/aceitar'

/**
 * `POST /v1/operacao/convite/consultar`: só se o convite vale (Tech Spec da A0, seção 4). O token vai no corpo, nunca
 * na URL da API (regra 20, item 8). Usado, vencido, revogado, de operador desativado e inexistente chegam iguais, no
 * mesmo `NAO_ENCONTRADO` (C9).
 *
 * Não passa pelo TanStack Query: o token é o argumento, e uma chave de cache com ele dentro é o que não pode existir.
 */
export function consultarConviteDeOperador(token: string): Promise<ConsultarConviteDeOperadorResponse> {
  return chamarApi(CAMINHO_DA_CONSULTA_DE_CONVITE_DE_OPERADOR, consultarConviteDeOperadorResponseSchema, { metodo: 'POST', corpo: { token } })
}

/**
 * `POST /v1/operacao/convite/aceitar`, com o token e a senha nova. A resposta é o desafio `configurar_mfa` (5 min), que
 * fica só na memória desta aba, no módulo da sessão do operador, para a tela de configurar o segundo fator. O desafio
 * de qualquer tentativa anterior sai antes: o de outra pessoa nunca sobra na aba.
 */
export async function aceitarConviteDeOperador(pedido: AceitarConviteDeOperadorRequest): Promise<void> {
  esquecerDesafioDeOperador()
  const resposta = await chamarApi(CAMINHO_DO_ACEITE_DE_CONVITE_DE_OPERADOR, aceitarConviteDeOperadorResponseSchema, { metodo: 'POST', corpo: pedido })
  guardarDesafioDeOperador(resposta.etapa, resposta.desafio)
}

/** O convite que não vale chega como `NAO_ENCONTRADO`, igual nos cinco casos (C9). */
export function ehConviteInvalido(erro: unknown): boolean {
  return erro instanceof ErroDaApi && erro.codigo === ErrorCode.NAO_ENCONTRADO
}

/** O que a tela do convite faz com a resposta do aceite. */
export type DesfechoDoAceite =
  | { readonly tipo: 'aceito' }
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'falhou'; readonly erro: unknown }
  | { readonly tipo: 'descartado' }

/**
 * O aceite, conferido contra o link que está na tela quando a resposta volta. `vezDoLink` sobe a cada link novo colado
 * na aba (o `hashchange`); se ela mudou enquanto o aceite estava no ar, a resposta é de um link que a tela já largou, e
 * é **descartada**: não navega nem muda a tela, e o desafio que ela trouxe sai da memória, porque é da conta do link
 * anterior e a tela agora mostra outro (tarefa 10.0 da A0b). Quando o aceite anterior deu certo no servidor, a senha
 * daquela conta já está criada: quem a criou entra depois com o e-mail e a senha, e configura o segundo fator por lá.
 */
export async function aceitarConviteDeOperadorNaVez(pedido: AceitarConviteDeOperadorRequest, vezDoLink: () => number): Promise<DesfechoDoAceite> {
  const vez = vezDoLink()
  try {
    await aceitarConviteDeOperador(pedido)
  } catch (erro) {
    if (vezDoLink() !== vez) return { tipo: 'descartado' }
    return ehConviteInvalido(erro) ? { tipo: 'invalido' } : { tipo: 'falhou', erro }
  }
  if (vezDoLink() !== vez) {
    esquecerDesafioDeOperador()
    return { tipo: 'descartado' }
  }
  return { tipo: 'aceito' }
}
