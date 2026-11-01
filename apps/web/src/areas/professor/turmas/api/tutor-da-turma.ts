import { sinaisResponseSchema, usoDoTutorResponseSchema, TAMANHO_MAXIMO_DA_PAGINA } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { USO_DO_TUTOR_QUERY_KEY, SINAIS_QUERY_KEY } from '../../../../api/chaves-do-professor'
import { authedGet } from '../../../../api/sessao'

/**
 * O que o Tutor mostra à professora da turma (A4; D8, D47; regra 70, itens 4 e 7): os **sinais** e o **uso**. Nenhuma
 * destas leituras traz conteúdo de conversa, e não existe aqui rota que abra a conversa de um aluno. O nome do aluno só
 * chega ao professor com vínculo confirmado na turma (D34), e não fica guardado depois de a tela sair (`gcTime: 0`).
 */

/** Os sinais da turma (`GET /v1/sinais?turmaId=`): os mais recentes e os grupos ("oito travaram na questão 3"). */
export function sinaisQueryOptions(turmaId: string) {
  return queryOptions({
    queryKey: [...SINAIS_QUERY_KEY, turmaId],
    queryFn: ({ signal }) => authedGet(`/v1/sinais?turmaId=${encodeURIComponent(turmaId)}&limite=${String(TAMANHO_MAXIMO_DA_PAGINA)}`, sinaisResponseSchema, signal),
    gcTime: 0,
  })
}

/**
 * O uso do Tutor pela turma (`GET /v1/tutor/uso?turmaId=`): por aluno que já usou, as trocas de hoje, a última troca e em
 * que ele estava. É o que faz não existir uso do Tutor invisível ao professor. Sem tempo ocioso e sem lista de quem não
 * usou: o contrato nem tem esses campos.
 */
export function usoDoTutorQueryOptions(turmaId: string) {
  return queryOptions({
    queryKey: [...USO_DO_TUTOR_QUERY_KEY, turmaId],
    queryFn: ({ signal }) => authedGet(`/v1/tutor/uso?turmaId=${encodeURIComponent(turmaId)}`, usoDoTutorResponseSchema, signal),
    gcTime: 0,
  })
}
