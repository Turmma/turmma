import { z } from 'zod'
import { TAMANHO_MAXIMO_SENHA } from './login.js'

/** Maior matrícula aceita, a mesma do check de `credencial_matricula` no banco: sobra para o RA das redes estaduais. */
export const TAMANHO_MAXIMO_MATRICULA = 40
/** Maior endereço de escola aceito, o mesmo do check de `escola.slug`. */
export const TAMANHO_MAXIMO_SLUG_NO_LOGIN = 63

/**
 * Corpo de `POST /v1/sessao/matricula` (RF7): o endereço da escola, a matrícula e a senha. Estrito: nada além dos três,
 * e nunca a escola, que vem só do slug. A matrícula chega sem espaço nas pontas, como o banco a guarda.
 */
export const loginMatriculaRequestSchema = z
  .object({
    slug: z.string().trim().min(1).max(TAMANHO_MAXIMO_SLUG_NO_LOGIN),
    matricula: z.string().trim().min(1).max(TAMANHO_MAXIMO_MATRICULA),
    senha: z.string().min(1).max(TAMANHO_MAXIMO_SENHA),
  })
  .strict()

export type LoginMatriculaRequest = z.infer<typeof loginMatriculaRequestSchema>
