import { gravarAulaResponseSchema, type GravarAulaRequest, type GravarAulaResponse } from '@educa/shared'
import { authedRequest } from '../../../../api/sessao'

/**
 * Grava o texto de uma aula (`PUT /v1/aulas`, F2b): o que a professora vai dar, ou deu. A escola, o ano e a professora vêm da sessão, nunca do
 * pedido (regra 10, item 3); o corpo leva o vínculo, a data, o início e o texto. Texto vazio apaga o registro (`texto: null` na resposta). O texto é
 * da professora: não vai a log, a endereço nem a lugar nenhum além desta chamada (regra 20, item 9).
 */
export function gravarAula(pedido: GravarAulaRequest): Promise<GravarAulaResponse> {
  return authedRequest('/v1/aulas', gravarAulaResponseSchema, { metodo: 'PUT', corpo: pedido })
}
