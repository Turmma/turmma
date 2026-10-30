import { minhaTurmaResponseSchema } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { buscarComSessao } from './sessao'

/**
 * A turma do aluno da sessão (`GET /v1/minha-turma`, A1 8.0): a escola, a turma e a série, pelo vínculo confirmado dele
 * no ano em curso. Escola, ano e aluno vêm do token, nunca da tela: esta consulta não tem como pedir a turma de outro
 * aluno nem de outra escola.
 */
export const consultaMinhaTurma = queryOptions({
  queryKey: ['minha-turma'],
  queryFn: ({ signal }) => buscarComSessao('/v1/minha-turma', minhaTurmaResponseSchema, signal),
})
