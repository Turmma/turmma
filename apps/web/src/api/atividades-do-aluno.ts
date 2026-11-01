import {
  atividadeEnviadaResponseSchema,
  meuDiagnosticoResponseSchema,
  minhasAtividadesResponseSchema,
  provaResponseSchema,
  questaoSalvaResponseSchema,
  type AtividadeEnviadaResponse,
  type QuestaoSalvaResponse,
} from '@educa/shared'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { PROVA_QUERY_KEY, MINHAS_ATIVIDADES_QUERY_KEY, MEU_DIAGNOSTICO_QUERY_KEY } from './chaves-do-aluno'
import { authedGet, authedRequest } from './sessao'

/**
 * O lado do aluno na atividade (MVP, A3; `docs/mvp-contratos.md`, "Atividade e correção"). A escola, o ano, a turma e o
 * aluno vêm do token: nenhuma chamada daqui tem como pedir a atividade, a resposta ou o diagnóstico de outra pessoa, e
 * nenhuma resposta traz colega (regra 50, item 9). Tudo fica só no cache de consultas, que toda troca de sessão esvazia
 * (`main.tsx`): nada de resposta nem de resultado em `localStorage`.
 */

const CAMINHO_DAS_ATIVIDADES = '/v1/minhas-atividades'

function caminhoDaAtividade(atividadeAplicadaId: string): string {
  return `/v1/atividades-aplicadas/${encodeURIComponent(atividadeAplicadaId)}`
}

/** `GET /v1/minhas-atividades`: o que foi atribuído à turma do aluno, paginado como a API entrega (`?pagina=`). */
export const minhasAtividadesInfiniteQueryOptions = infiniteQueryOptions({
  queryKey: MINHAS_ATIVIDADES_QUERY_KEY,
  queryFn: ({ pageParam, signal }) =>
    authedGet(pageParam === undefined ? CAMINHO_DAS_ATIVIDADES : `${CAMINHO_DAS_ATIVIDADES}?pagina=${encodeURIComponent(pageParam)}`, minhasAtividadesResponseSchema, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (ultima) => ultima.proxima,
})

/**
 * `GET /v1/atividades-aplicadas/:id/prova`: a atividade como o aluno a faz, com o que ele já respondeu. Sem gabarito nem
 * explicação: o contrato é estrito. **Não envelhece sozinha**: enquanto o aluno responde, quem muda as respostas é ele,
 * e a tela as acerta no cache a cada "Resposta salva"; reler no meio (ao voltar para a aba) trocaria a escolha que ainda
 * está sendo salva pela anterior.
 */
export function provaQueryOptions(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...PROVA_QUERY_KEY, atividadeAplicadaId],
    queryFn: ({ signal }) => authedGet(`${caminhoDaAtividade(atividadeAplicadaId)}/prova`, provaResponseSchema, signal),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/**
 * `GET /v1/atividades-aplicadas/:id/meu-diagnostico`: o diagnóstico do próprio aluno, **que só existe depois de a
 * professora aprovar a correção**. Antes disso a rota responde `NAO_ENCONTRADO`, e a tela diz que a correção ainda vai
 * ser revista (regra 70, item 3). Quem está esperando relê ao voltar para a tela.
 */
export function meuDiagnosticoQueryOptions(atividadeAplicadaId: string) {
  return queryOptions({
    queryKey: [...MEU_DIAGNOSTICO_QUERY_KEY, atividadeAplicadaId],
    queryFn: ({ signal }) => authedGet(`${caminhoDaAtividade(atividadeAplicadaId)}/meu-diagnostico`, meuDiagnosticoResponseSchema, signal),
    staleTime: 0,
  })
}

/**
 * `PUT /v1/atividades-aplicadas/:id/respostas/:questao`: a alternativa marcada e a `sequencia` dela. A gravação é
 * idempotente (regra 80, item 6): mandar a mesma escolha de novo, quando a rede volta, não muda nada no servidor, e a de
 * `sequencia` menor que a gravada perde: a resposta traz o que ficou gravado, e a fila não reenvia (RF21).
 */
export function responderQuestao(atividadeAplicadaId: string, questao: number, alternativa: number, sequencia: number): Promise<QuestaoSalvaResponse> {
  return authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/respostas/${String(questao)}`, questaoSalvaResponseSchema, { metodo: 'PUT', corpo: { alternativa, sequencia } })
}

/** `POST /v1/atividades-aplicadas/:id/enviar`: corpo vazio e estrito. Enviar de novo devolve o mesmo. */
export function enviarAtividade(atividadeAplicadaId: string): Promise<AtividadeEnviadaResponse> {
  return authedRequest(`${caminhoDaAtividade(atividadeAplicadaId)}/enviar`, atividadeEnviadaResponseSchema, { metodo: 'POST', corpo: {} })
}
