import { z } from 'zod'
import { pageSchema } from './pagination.js'

export const SITUACOES_DO_ANO_LETIVO = ['planejado', 'em_curso', 'encerrado'] as const
export type SituacaoDoAnoLetivo = (typeof SITUACOES_DO_ANO_LETIVO)[number]

/** Os anos aceitos, os mesmos do check `ano_letivo_ano_valido`. */
export const MENOR_ANO_LETIVO = 2000
export const MAIOR_ANO_LETIVO = 2100

/** O fim vem depois do início. As datas são ISO (`AAAA-MM-DD`), e a ordem do texto é a do calendário. */
export function fimDepoisDoInicio(inicio: string, fim: string): boolean {
  return fim > inicio
}

/** O início do ano letivo cai no ano dele: o de 2027 começa em 2027. */
export function inicioCaiNoAnoLetivo(ano: number, inicio: string): boolean {
  return inicio.startsWith(`${String(ano)}-`)
}

/**
 * O fim cai no ano letivo ou no seguinte: a rede que termina o ano letivo em janeiro do ano seguinte é normal; 2207
 * digitado no lugar de 2027, não. As datas são ISO (`AAAA-MM-DD`), e a ordem do texto é a do calendário.
 */
export function fimCaiAteOAnoSeguinte(ano: number, fim: string): boolean {
  return fim <= `${String(ano + 1)}-12-31`
}

/**
 * Corpo de `POST /v1/anos-letivos`: o ano e o período. Nasce `planejado`; abrir é outra rota. Estrito: nada de escola
 * nem de situação, que não se escolhem pelo corpo.
 *
 * O período não contradiz o ano (A1, 13.0): o início cai no ano, e o fim, nele ou no seguinte. O ano letivo não se
 * altera nem se exclui depois de criado (não há rota para isso), e um 2027 com o período de 2026 ficaria na escola para
 * sempre. A tela mostra o erro no campo, com as mesmas três funções; quem recusa é a API (regra 00, item 1).
 */
export const criarAnoLetivoRequestSchema = z
  .object({
    ano: z.number().int().min(MENOR_ANO_LETIVO).max(MAIOR_ANO_LETIVO),
    inicio: z.iso.date(),
    fim: z.iso.date(),
  })
  .strict()
  .refine((pedido) => fimDepoisDoInicio(pedido.inicio, pedido.fim), { path: ['fim'] })
  .refine((pedido) => inicioCaiNoAnoLetivo(pedido.ano, pedido.inicio), { path: ['inicio'] })
  .refine((pedido) => fimCaiAteOAnoSeguinte(pedido.ano, pedido.fim), { path: ['fim'] })

export type CriarAnoLetivoRequest = z.infer<typeof criarAnoLetivoRequestSchema>

export const anoLetivoSchema = z
  .object({
    id: z.uuid(),
    ano: z.number().int(),
    inicio: z.iso.date(),
    fim: z.iso.date(),
    situacao: z.enum(SITUACOES_DO_ANO_LETIVO),
  })
  .strict()

export type AnoLetivo = z.infer<typeof anoLetivoSchema>

/** Resposta de criar, abrir e encerrar um ano letivo. */
export const anoLetivoResponseSchema = anoLetivoSchema
export type AnoLetivoResponse = AnoLetivo

/** Resposta de `GET /v1/anos-letivos`. */
export const listaDeAnosLetivosResponseSchema = pageSchema(anoLetivoSchema)
export type ListaDeAnosLetivosResponse = z.infer<typeof listaDeAnosLetivosResponseSchema>
