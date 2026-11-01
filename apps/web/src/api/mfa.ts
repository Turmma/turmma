import { ErrorCode, ativarMfaResponseSchema, configurarMfaResponseSchema, type AtivarMfaResponse, type ConfigurarMfaResponse } from '@educa/shared'
import { apiRequest, ApiError } from './client'
import { desafioDaEtapa, esquecerDesafio } from './sessao'

export const CAMINHO_DA_CONFIGURACAO_DE_MFA = '/v1/conta/mfa/configurar'
export const CAMINHO_DA_ATIVACAO_DE_MFA = '/v1/conta/mfa/ativar'

/** O desafio `configurar_mfa` desta aba, ou a recusa que manda a pessoa entrar de novo. */
function desafioDaConfiguracao(): string {
  const desafio = desafioDaEtapa('configurar_mfa')
  if (desafio === undefined) throw new ApiError(ErrorCode.NAO_AUTENTICADO)
  return desafio
}

/**
 * `POST /v1/conta/mfa/configurar` (RF12): o segredo novo do aplicativo autenticador, em base32 e como URI `otpauth://`.
 *
 * As duas respostas desta tela saem com `Cache-Control: no-store` e **não passam pelo TanStack Query**: segredo e
 * códigos de recuperação não podem ficar num cache que sobrevive à tela, que outra aba lê e que o `/v1/eu` da pessoa
 * seguinte no mesmo Chromebook encontraria. Eles vivem no estado do componente e somem quando a tela sai.
 */
export async function configurarMfa(): Promise<ConfigurarMfaResponse> {
  // `async` para a falta do desafio virar promessa recusada, e não uma exceção no meio do efeito que chamou.
  return apiRequest(CAMINHO_DA_CONFIGURACAO_DE_MFA, configurarMfaResponseSchema, { metodo: 'POST', token: desafioDaConfiguracao() })
}

/**
 * `POST /v1/conta/mfa/ativar`: o código que o aplicativo mostra prova que o segredo foi guardado, e a resposta traz os
 * dez códigos de recuperação, uma vez só. A ativação consome o desafio na API e não abre sessão (Tech Spec, seção 5,
 * "TOTP"): esta aba o esquece junto, e a pessoa entra de novo com a senha e o código.
 */
export async function ativarMfa(codigo: string): Promise<AtivarMfaResponse> {
  const resposta = await apiRequest(CAMINHO_DA_ATIVACAO_DE_MFA, ativarMfaResponseSchema, { metodo: 'POST', corpo: { codigo }, token: desafioDaConfiguracao() })
  esquecerDesafio()
  return resposta
}
