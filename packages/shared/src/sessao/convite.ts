import { z } from 'zod'
import { TAMANHO_MAXIMO_SENHA } from './login.js'

/**
 * Menor senha aceita quando a pessoa define a dela, no aceite do convite. É mais que o mínimo de 8 do NIST para senha
 * com segundo fator, e o coordenador ainda configura o MFA logo depois. O login não tem mínimo: ele só confere.
 */
export const TAMANHO_MINIMO_SENHA_NOVA = 12

/**
 * Maior token aceito no corpo. O token de verdade tem 43 caracteres (32 bytes em base64url); o teto só impede que um
 * corpo enorme chegue ao hash. Token de outro formato é tratado como inexistente, com a mesma resposta.
 */
export const TAMANHO_MAXIMO_TOKEN_DE_CONVITE = 128

/**
 * Os tipos de convite: o da primeira coordenação, que o operador gera (F1, A0b), e o do professor, que a coordenação da
 * escola gera ao cadastrá-lo (A1, tarefa 3.0). O check `convite_tipo_valido` do banco aceita os mesmos.
 */
export const TIPOS_DE_CONVITE = ['coordenador', 'professor'] as const

export type TipoDeConvite = (typeof TIPOS_DE_CONVITE)[number]

/**
 * Validade do convite por tipo, contada da criação, num lugar só (Tech Spec da A1, seção 3; RF6): 72 h o da coordenação
 * (Tech Spec do F1, seção 3), 7 dias o do professor. Aqui, e não só na API, porque a tela mostra o prazo no resumo antes
 * de gerar (A0b, tarefa 7.0; A1, tarefa 14.0): o número dito é o mesmo que a API grava em `expira_em`.
 */
export const VALIDADE_DO_CONVITE_HORAS_POR_TIPO = {
  coordenador: 72,
  professor: 7 * 24,
} as const satisfies Readonly<Record<TipoDeConvite, number>>

/** A validade do convite da coordenação, a que o painel da operação mostra (A0b, tarefa 7.0). */
export const VALIDADE_DO_CONVITE_HORAS = VALIDADE_DO_CONVITE_HORAS_POR_TIPO.coordenador

const token = z.string().min(1).max(TAMANHO_MAXIMO_TOKEN_DE_CONVITE)

/**
 * Corpo de `POST /v1/convites/consultar`. O token vai sempre no corpo, nunca na URL da API, que fica em log de borda e
 * no histórico (regra 20, item 8).
 */
export const consultarConviteRequestSchema = z.object({ token }).strict()

export type ConsultarConviteRequest = z.infer<typeof consultarConviteRequestSchema>

/** Resposta de `consultar`: só o nome da escola que convida. Nunca o nome nem o e-mail do convidado. */
export const consultarConviteResponseSchema = z.object({ escolaNome: z.string().min(1) }).strict()

export type ConsultarConviteResponse = z.infer<typeof consultarConviteResponseSchema>

/**
 * Corpo de `POST /v1/convites/aceitar`: o token e, para quem ainda não tem conta com senha, a senha nova. Para quem já
 * tem (trabalha em outra escola cliente), a senha é ignorada: o link nunca troca a senha de uma conta existente.
 */
export const aceitarConviteRequestSchema = z
  .object({
    token,
    senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA).max(TAMANHO_MAXIMO_SENHA).optional(),
  })
  .strict()

export type AceitarConviteRequest = z.infer<typeof aceitarConviteRequestSchema>

/**
 * Resposta de `aceitar` (Tech Spec, seção 5, "Convite"):
 * - `configurar_mfa`: a conta era nova, a senha foi definida e o usuário ativado; o desafio leva à configuração do MFA
 *   (RF12), sem sessão e sem cookie;
 * - `entrar`: a conta já tinha senha; a web leva ao `/entrar` com o `bilhete` (30 min), que vai no corpo do login por
 *   e-mail. O usuário da escola só é ativado pelo login com a senha e o segundo fator que a conta já tem e com esse
 *   bilhete: sem ele, o login da conta nunca ativa o convite.
 */
export const aceitarConviteResponseSchema = z.discriminatedUnion('etapa', [
  z.object({ etapa: z.literal('configurar_mfa'), desafio: z.string().min(1) }).strict(),
  z.object({ etapa: z.literal('entrar'), bilhete: z.string().min(1) }).strict(),
])

export type AceitarConviteResponse = z.infer<typeof aceitarConviteResponseSchema>
