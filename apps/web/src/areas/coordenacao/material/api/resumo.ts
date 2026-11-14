import { resumoDoMaterialResponseSchema } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { authedGet } from '../../../../api/sessao'
import { MATERIAL_QUERY_KEY } from './material'

/**
 * O resumo do material da escola pela coordenação (ingestao-do-material, 11.0; RF18; Tech Spec, seções 4 e 9): por disciplina e série, o que está pronto, processando e com falha, os envios recusados em 30 dias
 * e quantos materiais estão sem série. A escola vem do token, nunca da tela (regra 10, item 3).
 */

/** A chave do resumo, sob a de Material: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`), e o resumo da anterior não passa à seguinte. */
export const RESUMO_DO_MATERIAL_QUERY_KEY = [...MATERIAL_QUERY_KEY, 'resumo'] as const

/**
 * O resumo **não tem laço próprio** (regra 80, itens 1 e 10): a lista da aba já se relê a cada 1,5 s enquanto um material está `processando`, e o resumo só se relê quando a lista mostra que um estado mudou
 * (`useRelerOResumoQuandoUmEstadoMuda`), e quando a pessoa envia, exclui, recusa ou pede "Tentar de novo". A conta de pedidos por minuto está na Tech Spec, seção 11, linha "11.0".
 */
export const resumoDoMaterialQueryOptions = queryOptions({
  queryKey: RESUMO_DO_MATERIAL_QUERY_KEY,
  queryFn: ({ signal }) => authedGet('/v1/materiais/resumo', resumoDoMaterialResponseSchema, signal),
})
