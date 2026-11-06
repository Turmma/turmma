import { calendarioResponseSchema, gradeResponseSchema, type CalendarioResponse, type GradeResponse } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { ESTRUTURA_QUERY_KEY } from '../../../../api/estrutura'
import { authedGet } from '../../../../api/sessao'

/**
 * A grade e o calendário da escola pela coordenação (F2, 14.0; Tech Spec, seção 4). A escola vem do token, nunca da tela (regra 10,
 * item 3): o que a tela escolhe é a turma e, no calendário, o ano **planejado**; sem ele a API devolve o ano em curso. As chaves
 * começam por `ESTRUTURA_QUERY_KEY`, e por isso o que a coordenação grava (ou a troca de escola) as recarrega junto com a estrutura.
 * Nenhuma das duas respostas traz e-mail de professor (`docs/lgpd.md`, "Aula da grade").
 */

/** `GET /v1/grade?turmaId=`: as aulas da turma no ano em curso. Não é paginada: o teto é o das 3.000 linhas da planilha. */
export function gradeDaTurmaQueryOptions(turmaId: string) {
  return queryOptions({
    queryKey: [...ESTRUTURA_QUERY_KEY, 'grade', turmaId],
    queryFn: ({ signal }): Promise<GradeResponse> => authedGet(`/v1/grade?turmaId=${encodeURIComponent(turmaId)}`, gradeResponseSchema, signal),
  })
}

/**
 * `GET /v1/calendario`: os eventos do ano em curso, ou do planejado que a coordenação escolheu. O `anoLetivoId` só vai quando é o do
 * planejado: a API o confere na escola da sessão e responde igual a ano de outra escola e a ano que não existe.
 */
export function calendarioQueryOptions(anoLetivoId: string | undefined) {
  return queryOptions({
    queryKey: [...ESTRUTURA_QUERY_KEY, 'calendario', anoLetivoId ?? 'em-curso'],
    queryFn: ({ signal }): Promise<CalendarioResponse> => authedGet(anoLetivoId === undefined ? '/v1/calendario' : `/v1/calendario?anoLetivoId=${encodeURIComponent(anoLetivoId)}`, calendarioResponseSchema, signal),
  })
}
