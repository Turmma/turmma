import { ErrorCode, memoriaDoTutorResponseSchema, type MemoriaDoTutorResponse } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { ApiError } from './client'
import { MEMORIA_DO_TUTOR_QUERY_KEY } from './chaves-do-aluno'
import { authedGet } from './sessao'

/** Um trabalho que o professor já aprovou: o `resultado` deixa de ser opcional, e é o que "Como estou indo" mostra. */
export type TrabalhoCorrigido = Omit<MemoriaDoTutorResponse['trabalhos'][number], 'resultado'> & {
  readonly resultado: NonNullable<MemoriaDoTutorResponse['trabalhos'][number]['resultado']>
}

/**
 * Do que a API entrega, só os trabalhos de **correção aprovada** (`resultado` não nulo). O trabalho enviado e ainda sem
 * aprovação fica de fora, e a contagem dele também (regra 70, item 3); os `sinais` não entram (D66: ficam para o F9).
 */
export function trabalhosCorrigidos(memoria: MemoriaDoTutorResponse): TrabalhoCorrigido[] {
  const corrigidos: TrabalhoCorrigido[] = []
  for (const trabalho of memoria.trabalhos) if (trabalho.resultado !== null) corrigidos.push({ ...trabalho, resultado: trabalho.resultado })
  return corrigidos
}

/**
 * `GET /v1/tutor/memoria`, para "Como estou indo" em Eu (telas do aluno e primeiro acesso, 7.0; RF9): o que o Tutor lembra
 * do **trabalho** do aluno, que ele vê (D66). A escola, o ano e o aluno vêm do token, e a resposta é só dele.
 *
 * **O filtro está na `queryFn`, e não no `select`**: o `select` roda depois de a resposta entrar no cache, e os `sinais`
 * (onde ele travou com o Tutor) iriam junto. Aqui o cache só guarda os trabalhos corrigidos, e vive em memória: a troca de
 * sessão o esvazia (`main.tsx`), e nada vai a `localStorage`.
 *
 * Aluno sem turma no ano (`NAO_ENCONTRADO`) não é erro: é "nada corrigido", e a lista vem vazia. Dura 5 minutos e não relê
 * ao voltar para a aba: a correção só muda quando o professor aprova, e o aluno não está esperando por ela diante da tela.
 */
export const memoriaDoTutorQueryOptions = queryOptions({
  queryKey: MEMORIA_DO_TUTOR_QUERY_KEY,
  queryFn: async ({ signal }): Promise<TrabalhoCorrigido[]> => {
    try {
      return trabalhosCorrigidos(await authedGet('/v1/tutor/memoria', memoriaDoTutorResponseSchema, signal))
    } catch (erro) {
      if (erro instanceof ApiError && erro.codigo === ErrorCode.NAO_ENCONTRADO) return []
      throw erro
    }
  },
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
})
