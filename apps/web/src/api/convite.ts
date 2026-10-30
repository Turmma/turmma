import {
  aceitarConviteResponseSchema,
  consultarConviteResponseSchema,
  type AceitarConviteRequest,
  type AceitarConviteResponse,
  type ConsultarConviteResponse,
} from '@educa/shared'
import { chamarApi } from './cliente'
import { guardarBilheteDeConvite, guardarDesafio } from './sessao'

export const CAMINHO_DA_CONSULTA_DE_CONVITE = '/v1/convites/consultar'
export const CAMINHO_DO_ACEITE_DE_CONVITE = '/v1/convites/aceitar'

/**
 * `POST /v1/convites/consultar`: o nome da escola que convida. O token vai sempre no corpo, nunca na URL da API, que
 * fica no log de borda e no histórico do navegador (regra 20, item 8). Expirado, revogado, usado e inexistente chegam
 * iguais.
 *
 * A consulta não passa pelo TanStack Query: o token é o argumento, e uma chave de cache com ele dentro é justamente o
 * que não pode existir.
 */
export function consultarConvite(token: string): Promise<ConsultarConviteResponse> {
  return chamarApi(CAMINHO_DA_CONSULTA_DE_CONVITE, consultarConviteResponseSchema, { metodo: 'POST', corpo: { token } })
}

/** O que a tela do convite faz com a resposta do aceite. */
export type DesfechoDoAceite =
  | { readonly tipo: 'aceito'; readonly resposta: AceitarConviteResponse }
  | { readonly tipo: 'falhou'; readonly erro: unknown }
  | { readonly tipo: 'descartado' }

/**
 * `POST /v1/convites/aceitar` (Tech Spec, seção 5, "Convite"):
 *
 * - **conta nova:** com a senha, a resposta é `configurar_mfa`, e o desafio fica guardado em memória para a tela do
 *   segundo fator. Sem a senha, a API responde `ENTRADA_INVALIDA` **sem gastar o convite**, e é por isso que a tela
 *   tenta primeiro sem ela: assim ninguém digita uma senha nova para descobrir depois que a conta já existia;
 * - **conta que já existe:** a senha é ignorada pela API e a resposta é `entrar`, com o bilhete de 30 min, que fica
 *   só na memória desta aba e vai no corpo do próximo login por e-mail;
 * - **professor com a conta nova** (A1, tarefa 3.0): com a senha, a resposta também é `entrar`, com o bilhete. O
 *   professor não tem segundo fator, e o que falta é entrar com a senha que acabou de criar.
 *
 * O aceite é conferido contra o link que está na tela quando a resposta volta (A1, 14.0; o "recomeço da tela").
 * `vezDoLink` sobe a cada link colado na aba (o `hashchange`); se ela mudou enquanto o aceite estava no ar, a resposta é
 * de um link que a tela já largou, e é **descartada**: não navega, não muda a tela, e o bilhete ou o desafio que ela
 * trouxe **nem chegam a ser guardados** — são da conta do link anterior, e a tela agora mostra outro. Por não guardar
 * nada, o descarte não apaga o que o aceite do link novo tenha guardado nesse meio tempo.
 *
 * Quando o aceite descartado deu certo no servidor, aquele convite está usado: quem o aceitou entra depois com o e-mail
 * e a senha, ou pede outro convite, se o bilhete era o que faltava.
 */
export async function aceitarConviteNaVez(pedido: AceitarConviteRequest, vezDoLink: () => number): Promise<DesfechoDoAceite> {
  const vez = vezDoLink()
  let resposta: AceitarConviteResponse
  try {
    resposta = await chamarApi(CAMINHO_DO_ACEITE_DE_CONVITE, aceitarConviteResponseSchema, { metodo: 'POST', corpo: pedido })
  } catch (erro) {
    return vezDoLink() === vez ? { tipo: 'falhou', erro } : { tipo: 'descartado' }
  }
  if (vezDoLink() !== vez) return { tipo: 'descartado' }
  if (resposta.etapa === 'entrar') guardarBilheteDeConvite(resposta.bilhete)
  else guardarDesafio(resposta.etapa, resposta.desafio)
  return { tipo: 'aceito', resposta }
}
