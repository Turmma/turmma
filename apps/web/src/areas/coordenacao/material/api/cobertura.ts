import { coberturaResponseSchema } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { authedGet } from '../../../../api/sessao'
import { MATERIAL_QUERY_KEY } from './material'

/**
 * A cobertura da BNCC de uma série pela coordenação (classificacao-bncc, 13.0; RF19; Tech Spec, seções 4 e 9): por componente (área, no Médio), as habilidades que nenhum material em uso cobre, e quantas seções ainda estão
 * sem classificação. A escola vem do token, nunca da tela (regra 10, item 3).
 */

/** A chave da cobertura, sob a de Material: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`), e a cobertura da anterior não passa à seguinte. A série vai na chave, uma consulta por série. */
export const COBERTURA_QUERY_KEY = [...MATERIAL_QUERY_KEY, 'cobertura'] as const

/**
 * A cobertura de uma série. **Não tem laço próprio** (regra 80, item 10): relê-se quando a pessoa pede ("Tentar de novo") ou escolhe a série; a classificação roda à noite, e uma cobertura de hoje não muda sozinha em minutos.
 * Uma chave por série: a resposta atrasada de uma série nunca cai na tela da outra.
 */
export function coberturaQueryOptions(serieId: string) {
  return queryOptions({
    queryKey: [...COBERTURA_QUERY_KEY, serieId],
    queryFn: ({ signal }) => authedGet(`/v1/materiais/cobertura?serieId=${encodeURIComponent(serieId)}`, coberturaResponseSchema, signal),
  })
}
