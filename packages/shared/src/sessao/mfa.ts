import { z } from 'zod'

/** Dígitos do código do app autenticador (TOTP, SHA1, 30 s; Tech Spec, seção 5, "TOTP"). */
export const DIGITOS_DO_CODIGO_MFA = 6
/** Quantos códigos de recuperação a ativação do MFA entrega, uma vez só. */
export const QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO = 10
/** Caracteres de cada código de recuperação, sem separador. */
export const TAMANHO_DO_CODIGO_DE_RECUPERACAO = 12
/**
 * O alfabeto dos códigos de recuperação: dígitos e letras maiúsculas sem `0`, `1`, `I` e `O`, que se confundem ao
 * copiar do papel. São 32 símbolos, 60 bits por código.
 */
export const ALFABETO_DO_CODIGO_DE_RECUPERACAO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const codigoDoAutenticador = z.string().regex(new RegExp(`^\\d{${String(DIGITOS_DO_CODIGO_MFA)}}$`))

/**
 * Corpo de `POST /v1/sessao/mfa`, com o desafio de etapa `mfa` no `Authorization`: o código do app autenticador ou um
 * código de recuperação, nunca os dois. O de recuperação aceita minúsculas, espaço e hífen, que a pessoa copia do
 * papel; o servidor normaliza.
 */
export const mfaRequestSchema = z.union([
  z.object({ codigo: codigoDoAutenticador }).strict(),
  z
    .object({
      recuperacao: z
        .string()
        .min(TAMANHO_DO_CODIGO_DE_RECUPERACAO)
        .max(TAMANHO_DO_CODIGO_DE_RECUPERACAO + 8)
        .regex(/^[A-Za-z0-9 -]+$/),
    })
    .strict(),
])

export type MfaRequest = z.infer<typeof mfaRequestSchema>

/**
 * Resposta de `POST /v1/conta/mfa/configurar`, com o desafio de etapa `configurar_mfa` e o MFA ainda inativo: a URI
 * `otpauth://` (para o QR) e o segredo em base32, em texto, para colar num gerenciador de senhas do computador
 * (KeePassXC, Bitwarden, 1Password), sem precisar de celular (regra 50, item 2). Sai com `Cache-Control: no-store`, e
 * é a exceção nominal da varredura de contratos (Tech Spec, seção 7).
 */
export const configurarMfaResponseSchema = z
  .object({
    uri: z.string().startsWith('otpauth://totp/'),
    segredo: z.string().regex(/^[A-Z2-7]+$/),
  })
  .strict()

export type ConfigurarMfaResponse = z.infer<typeof configurarMfaResponseSchema>

/** Corpo de `POST /v1/conta/mfa/ativar`: o código que o app autenticador mostra, provando que o segredo foi guardado. */
export const ativarMfaRequestSchema = z.object({ codigo: codigoDoAutenticador }).strict()

export type AtivarMfaRequest = z.infer<typeof ativarMfaRequestSchema>

/**
 * Resposta de `POST /v1/conta/mfa/ativar`: os dez códigos de recuperação, mostrados uma vez só (o banco guarda só o
 * HMAC), com `Cache-Control: no-store`. A ativação não abre sessão: a pessoa entra de novo, com a senha e o código.
 */
export const ativarMfaResponseSchema = z
  .object({
    codigosRecuperacao: z
      .array(z.string().regex(new RegExp(`^[${ALFABETO_DO_CODIGO_DE_RECUPERACAO}]{${String(TAMANHO_DO_CODIGO_DE_RECUPERACAO)}}$`)))
      .length(QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO),
  })
  .strict()

export type AtivarMfaResponse = z.infer<typeof ativarMfaResponseSchema>

/**
 * Por que a coordenação redefine o MFA de outro coordenador. Códigos fixos, nunca texto livre: a auditoria fica cinco
 * anos, e texto livre é onde o nome entra (Tech Spec, seção 3, "Auditoria").
 */
export const FINALIDADES_DA_REDEFINICAO_DE_MFA = ['autenticador_perdido', 'codigos_perdidos', 'suspeita_de_acesso_indevido'] as const
export type FinalidadeDaRedefinicaoDeMfa = (typeof FINALIDADES_DA_REDEFINICAO_DE_MFA)[number]

/** A finalidade que só o operador grava, com `ops:redefinir-mfa`: o pedido formal da escola. */
export const FINALIDADE_DA_REDEFINICAO_PELO_OPERADOR = 'pedido_formal_da_escola'

/**
 * Corpo de `POST /v1/usuarios/:id/mfa/redefinir`: só a finalidade. A resposta é 202 sem corpo, sempre, tenha a
 * redefinição agido ou não (Tech Spec, seção 5, "TOTP").
 */
export const redefinirMfaRequestSchema = z.object({ finalidade: z.enum(FINALIDADES_DA_REDEFINICAO_DE_MFA) }).strict()

export type RedefinirMfaRequest = z.infer<typeof redefinirMfaRequestSchema>
