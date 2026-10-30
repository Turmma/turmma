import { z } from 'zod'
import { ALFABETO_DO_CODIGO_DE_RECUPERACAO, DIGITOS_DO_CODIGO_MFA, QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO, TAMANHO_DO_CODIGO_DE_RECUPERACAO } from '../sessao/mfa.js'

/**
 * O desafio de operador (`desafio-operador+jwt`, 5 min) vai **no corpo**, nunca no `Authorization`: ele não serve de
 * bearer em rota nenhuma (C21). O teto é folgado para um JWT HS256 com os três claims dele.
 */
const desafio = z.string().min(1).max(2_048)

const codigoDoAutenticador = z.string().regex(new RegExp(`^\\d{${String(DIGITOS_DO_CODIGO_MFA)}}$`))

/** O código de recuperação como a pessoa copia do papel: minúsculas, espaço e hífen valem; o servidor normaliza. */
const recuperacaoDigitada = z
  .string()
  .min(TAMANHO_DO_CODIGO_DE_RECUPERACAO)
  .max(TAMANHO_DO_CODIGO_DE_RECUPERACAO + 8)
  .regex(/^[A-Za-z0-9 -]+$/)

const codigoDeRecuperacao = z.string().regex(new RegExp(`^[${ALFABETO_DO_CODIGO_DE_RECUPERACAO}]{${String(TAMANHO_DO_CODIGO_DE_RECUPERACAO)}}$`))

/** Corpo de `POST /v1/operacao/sessao/mfa/configurar` (Tech Spec da A0, seção 4): só o desafio `configurar_mfa`. */
export const configurarSegundoFatorDeOperadorRequestSchema = z.object({ desafio }).strict()

export type ConfigurarSegundoFatorDeOperadorRequest = z.infer<typeof configurarSegundoFatorDeOperadorRequestSchema>

/**
 * Resposta de `configurar`, com `Cache-Control: no-store` e uma vez só: a URI `otpauth://` (para o QR), o segredo em
 * base32 em texto (para colar no gerenciador de senhas do computador, sem celular), os dez códigos de recuperação (o
 * banco guarda só o HMAC) e o desafio de etapa `mfa` com a versão deste segredo. O segundo fator só fica ativo no
 * primeiro `POST /v1/operacao/sessao/mfa` com um código deste segredo; antes disso, os códigos de recuperação não valem.
 */
export const configurarSegundoFatorDeOperadorResponseSchema = z
  .object({
    uri: z.string().startsWith('otpauth://totp/'),
    segredo: z.string().regex(/^[A-Z2-7]+$/),
    codigosRecuperacao: z.array(codigoDeRecuperacao).length(QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO),
    etapa: z.literal('mfa'),
    desafio,
  })
  .strict()

export type ConfigurarSegundoFatorDeOperadorResponse = z.infer<typeof configurarSegundoFatorDeOperadorResponseSchema>

/**
 * Corpo de `POST /v1/operacao/sessao/mfa`: o desafio `mfa` e o código do app autenticador **ou** um código de
 * recuperação, nunca os dois. Estrito: nada além disso.
 */
export const segundoFatorDeOperadorRequestSchema = z.union([
  z.object({ desafio, codigo: codigoDoAutenticador }).strict(),
  z.object({ desafio, recuperacao: recuperacaoDigitada }).strict(),
])

export type SegundoFatorDeOperadorRequest = z.infer<typeof segundoFatorDeOperadorRequestSchema>

/**
 * Resposta 200 de `POST /v1/operacao/sessao/mfa`: o token de acesso de operador (`operador+jwt`, 10 min), que a web
 * guarda só em memória. O cookie `turmma_operacao` de renovação vai no cabeçalho, nunca no corpo. Sai com `no-store`.
 */
export const segundoFatorDeOperadorResponseSchema = z.object({ token: z.string().min(1), expiraEm: z.iso.datetime() }).strict()

export type SegundoFatorDeOperadorResponse = z.infer<typeof segundoFatorDeOperadorResponseSchema>
