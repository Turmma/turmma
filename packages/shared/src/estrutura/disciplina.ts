import { z } from 'zod'
import { pageSchema } from './pagination.js'

/** As áreas do conhecimento da BNCC, para agrupar a disciplina. Opcional: a escola pode não informar. */
export const AREAS_DO_CONHECIMENTO = ['linguagens', 'matematica', 'ciencias_da_natureza', 'ciencias_humanas', 'ensino_religioso'] as const
export type AreaDoConhecimento = (typeof AREAS_DO_CONHECIMENTO)[number]

export const TAMANHO_MAXIMO_NOME_DISCIPLINA = 80

/**
 * Corpo de `POST /v1/disciplinas`: o nome ("Química") e, se a escola quiser, a área. O nome é único na escola sem
 * diferenciar maiúscula ("Química" e "química" conflitam). Estrito: nada de escola, que vem da sessão.
 */
export const criarDisciplinaRequestSchema = z
  .object({
    nome: z.string().trim().min(1).max(TAMANHO_MAXIMO_NOME_DISCIPLINA),
    area: z.enum(AREAS_DO_CONHECIMENTO).optional(),
  })
  .strict()

export type CriarDisciplinaRequest = z.infer<typeof criarDisciplinaRequestSchema>

/**
 * Corpo de `PATCH /v1/disciplinas/:id`: só o nome novo, com a mesma regra do criar. Estrito: nada de área, escola ou id,
 * que não mudam por aqui. O nome de outra disciplina da escola, sem diferenciar maiúscula, é `CONFLITO`.
 */
export const renomearDisciplinaRequestSchema = z.object({ nome: criarDisciplinaRequestSchema.shape.nome }).strict()

export type RenomearDisciplinaRequest = z.infer<typeof renomearDisciplinaRequestSchema>

export const disciplinaSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    area: z.enum(AREAS_DO_CONHECIMENTO).nullable(),
  })
  .strict()

export type Disciplina = z.infer<typeof disciplinaSchema>

/** Resposta de `POST /v1/disciplinas` e de `PATCH /v1/disciplinas/:id`. */
export const disciplinaResponseSchema = disciplinaSchema
export type DisciplinaResponse = Disciplina

/** Resposta de `GET /v1/disciplinas`. */
export const listaDeDisciplinasResponseSchema = pageSchema(disciplinaSchema)
export type ListaDeDisciplinasResponse = z.infer<typeof listaDeDisciplinasResponseSchema>
