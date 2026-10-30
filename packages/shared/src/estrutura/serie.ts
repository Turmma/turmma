import { z } from 'zod'
import { pageSchema } from './pagination.js'

/** As etapas do recorte (D43): anos finais do Ensino Fundamental e Ensino Médio. */
export const ETAPAS = ['ef_anos_finais', 'em'] as const
export type Etapa = (typeof ETAPAS)[number]

/** Os anos de cada etapa: 6º ao 9º nos anos finais, 1º ao 3º no Ensino Médio. O check `serie_no_recorte` repete isto no banco. */
export const ANOS_DA_ETAPA = {
  ef_anos_finais: { menor: 6, maior: 9 },
  em: { menor: 1, maior: 3 },
} as const satisfies Record<Etapa, { menor: number; maior: number }>

/** O nome de cada etapa como a escola escreve (glossário, "Série"). */
export const NOME_DA_ETAPA: Readonly<Record<Etapa, string>> = { ef_anos_finais: 'Ensino Fundamental', em: 'Ensino Médio' }

/**
 * A série por extenso, para a tela: `{ etapa: 'ef_anos_finais', ano: 7 }` → "7º ano do Ensino Fundamental", e
 * `{ etapa: 'em', ano: 2 }` → "2º ano do Ensino Médio" (glossário, "Série"). Um lugar só, para a "Minha turma" do aluno
 * (A1, 12.0) e a Estrutura da coordenação (13.0) não escreverem a mesma série de dois jeitos.
 */
export function nomeDaSerie(serie: { readonly etapa: Etapa; readonly ano: number }): string {
  return `${String(serie.ano)}º ano do ${NOME_DA_ETAPA[serie.etapa]}`
}

/**
 * Corpo de `POST /v1/series`: a etapa e o ano dentro dela. "5º ano" e "4º do Ensino Médio" são recusados aqui, e de novo
 * pelo check do banco. Estrito: nada de escola, que vem da sessão.
 */
export const criarSerieRequestSchema = z.discriminatedUnion('etapa', [
  z
    .object({ etapa: z.literal('ef_anos_finais'), ano: z.number().int().min(ANOS_DA_ETAPA.ef_anos_finais.menor).max(ANOS_DA_ETAPA.ef_anos_finais.maior) })
    .strict(),
  z.object({ etapa: z.literal('em'), ano: z.number().int().min(ANOS_DA_ETAPA.em.menor).max(ANOS_DA_ETAPA.em.maior) }).strict(),
])

export type CriarSerieRequest = z.infer<typeof criarSerieRequestSchema>

export const serieSchema = z
  .object({
    id: z.uuid(),
    etapa: z.enum(ETAPAS),
    ano: z.number().int(),
  })
  .strict()

export type Serie = z.infer<typeof serieSchema>

/** Resposta de `POST /v1/series`. */
export const serieResponseSchema = serieSchema
export type SerieResponse = Serie

/** Resposta de `GET /v1/series`. */
export const listaDeSeriesResponseSchema = pageSchema(serieSchema)
export type ListaDeSeriesResponse = z.infer<typeof listaDeSeriesResponseSchema>
