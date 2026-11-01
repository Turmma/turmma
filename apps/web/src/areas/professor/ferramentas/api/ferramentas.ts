import { execucaoAceitaResponseSchema, type FerramentaGeradora, type GerarComFerramentaRequest, type ExecucaoAceitaResponse } from '@educa/shared'
import { authedRequest } from '../../../../api/sessao'

/**
 * `POST /v1/ferramentas/:ferramenta/gerar`: o mesmo caso de uso para o formulário de Ferramentas e para o cartão dentro
 * da conversa (D18). Responde 202 com a execução, e o resultado dela traz o artefato.
 */
export function gerarComFerramenta(ferramenta: FerramentaGeradora, pedido: GerarComFerramentaRequest): Promise<ExecucaoAceitaResponse> {
  return authedRequest(`/v1/ferramentas/${encodeURIComponent(ferramenta)}/gerar`, execucaoAceitaResponseSchema, { metodo: 'POST', corpo: pedido })
}
