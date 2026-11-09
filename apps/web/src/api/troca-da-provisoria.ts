import { ErrorCode, trocasDaProvisoriaResponseSchema, type PapelQueGeraASenhaProvisoria, type TrocasDaProvisoriaResponse } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { formatDayAtTime } from '../format'
import { apiRequest, ApiError } from './client'
import { bilheteDaTroca } from './sessao'

export const CAMINHO_DAS_TROCAS = '/v1/sessao/matricula/trocas'

/**
 * `GET /v1/sessao/matricula/trocas` (acesso-e-convites, 13.0; RF13): as provisórias geradas antes da que o aluno acabou de usar, com a data, o papel de quem gerou e se foi usada.
 * Como a troca, só vale com o bilhete, no `Authorization`: o bilhete é lido da memória na hora da chamada e **não** entra na chave nem no resultado.
 *
 * A chave leva o `numero` do bilhete, que sobe a cada aluno que chega ao computador: a lista de um nunca é a do outro, e a resposta que chega depois de o aluno ter saído cai na chave
 * dele, que ninguém mais lê. `gcTime: 0` tira a lista do cache de consultas assim que a tela sai; `staleTime` infinito e sem refazer ao voltar o foco, porque a lista não muda e cada leitura
 * é uma chamada a mais na manhã das 7h30 (regra 80). Sem bilhete, a leitura falha como o bilhete que não vale.
 */
export function trocasDaProvisoriaQueryOptions(numeroDoBilhete: number) {
  return queryOptions({
    queryKey: ['troca-da-provisoria', 'anteriores', numeroDoBilhete] as const,
    queryFn: ({ signal }): Promise<TrocasDaProvisoriaResponse> => {
      const bilhete = bilheteDaTroca()
      if (bilhete === undefined) return Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
      return apiRequest(CAMINHO_DAS_TROCAS, trocasDaProvisoriaResponseSchema, { sinal: signal, token: bilhete.valor })
    },
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** Quem gerou, como o aluno o reconhece: o papel, nunca o nome nem o id (a API não os devolve). */
const QUEM_GEROU: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'pela coordenação', professor: 'pelo professor' }

/** "Gerada pela coordenação em 12/11/2026 às 14:05 · usada": uma linha da lista de antes. */
export function textoDaProvisoriaAnterior(anterior: TrocasDaProvisoriaResponse['anteriores'][number]): string {
  return `Gerada ${QUEM_GEROU[anterior.papel]} em ${formatDayAtTime(anterior.geradaEm)} · ${anterior.usada ? 'usada' : 'não usada'}`
}
