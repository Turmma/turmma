import { z } from 'zod'
import { PROVEDORES_DE_CONTA_DA_ESCOLA } from '../sessao/acesso-da-escola.js'

/**
 * O tenant que a Microsoft põe no `tid` de toda conta pessoal (Outlook, Hotmail, Xbox). Nunca é o tenant de uma escola,
 * e por isso a escola não o cadastra: cadastrá-lo abriria a porta a qualquer conta pessoal.
 */
export const TENANT_DE_CONTA_PESSOAL_MICROSOFT = '9188040d-6c67-4c5b-b112-36a304b66dad'

/** Quantos domínios e tenants uma escola cadastra, somando os dois provedores. */
export const MAXIMO_DE_PROVEDORES_DA_ESCOLA = 10

/** Tamanho máximo de um domínio (RFC 1035). */
const TAMANHO_MAXIMO_DOMINIO = 253

/** Domínio de conta Google da escola (o `hd`): rótulos de letra, dígito e hífen, com pelo menos um ponto. */
const FORMATO_DOMINIO = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

const dominioGoogle = z
  .string()
  .trim()
  .toLowerCase()
  .max(TAMANHO_MAXIMO_DOMINIO)
  .regex(FORMATO_DOMINIO)
  // Conta gmail.com não traz `hd`: cadastrar o domínio não aceitaria ninguém, e só confundiria quem lê a lista.
  .refine((dominio) => dominio !== 'gmail.com' && dominio !== 'googlemail.com')

const tenantMicrosoft = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.uuid())
  .refine((tenant) => tenant !== TENANT_DE_CONTA_PESSOAL_MICROSOFT)

/**
 * Um domínio Google (`hd`) ou um tenant Microsoft (`tid`) que a escola libera para o login pela conta dela (RF8). O
 * valor volta normalizado em minúsculas.
 */
export const provedorDaEscolaSchema = z.discriminatedUnion('provedor', [
  z.object({ provedor: z.literal('google'), valor: dominioGoogle }).strict(),
  z.object({ provedor: z.literal('microsoft'), valor: tenantMicrosoft }).strict(),
])

export type ProvedorDaEscola = z.infer<typeof provedorDaEscolaSchema>

/**
 * Corpo de `PUT /v1/escola/provedores`: a lista inteira dos domínios e tenants liberados, que substitui a anterior.
 * Lista vazia desliga o login pela conta da escola. Estrito, e nunca a escola, que vem da sessão. Valor repetido é
 * recusado.
 */
export const provedoresDaEscolaRequestSchema = z
  .object({
    provedores: z
      .array(provedorDaEscolaSchema)
      .max(MAXIMO_DE_PROVEDORES_DA_ESCOLA)
      .refine((lista) => new Set(lista.map((item) => `${item.provedor}|${item.valor}`)).size === lista.length),
  })
  .strict()

export type ProvedoresDaEscolaRequest = z.infer<typeof provedoresDaEscolaRequestSchema>

/** Resposta de `PUT /v1/escola/provedores`: a lista como ficou gravada, só provedor e valor. */
export const provedoresDaEscolaResponseSchema = z
  .object({
    provedores: z.array(z.object({ provedor: z.enum(PROVEDORES_DE_CONTA_DA_ESCOLA), valor: z.string().min(1) }).strict()),
  })
  .strict()

export type ProvedoresDaEscolaResponse = z.infer<typeof provedoresDaEscolaResponseSchema>
