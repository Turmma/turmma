import { z } from 'zod'

/** Menor inatividade que a escola pode configurar, em minutos: abaixo disso, a pessoa perde a sessão no meio da aula. */
export const INATIVIDADE_MINIMA_MIN = 5
/** Maior inatividade que a escola pode configurar, em minutos: oito horas, um turno inteiro. */
export const INATIVIDADE_MAXIMA_MIN = 480

const minutosDeInatividade = z.number().int().min(INATIVIDADE_MINIMA_MIN).max(INATIVIDADE_MAXIMA_MIN)

/**
 * Corpo de `PUT /v1/escola/sessao`: os minutos sem uso até a sessão vencer, do aluno e da equipe (RF13). Estrito: nada
 * além dos dois números, e nunca a escola, que vem da sessão.
 */
export const escolaSessaoRequestSchema = z
  .object({
    inatividadeAlunoMin: minutosDeInatividade,
    inatividadeEquipeMin: minutosDeInatividade,
  })
  .strict()

export type EscolaSessaoRequest = z.infer<typeof escolaSessaoRequestSchema>

/** Resposta de `PUT /v1/escola/sessao`: os dois números como ficaram gravados. */
export const escolaSessaoResponseSchema = z
  .object({
    inatividadeAlunoMin: z.number().int().positive(),
    inatividadeEquipeMin: z.number().int().positive(),
  })
  .strict()

export type EscolaSessaoResponse = z.infer<typeof escolaSessaoResponseSchema>
