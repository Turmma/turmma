import { conversaDoAssistenteResponseSchema, execucaoAceitaResponseSchema, type MensagemDaConversa, type MensagemAoAssistenteRequest, type ConversaDoAssistenteResponse, type ExecucaoAceitaResponse } from '@educa/shared'
import { infiniteQueryOptions } from '@tanstack/react-query'
import { CHAVE_DA_CONVERSA } from '../../../../api/chaves-do-professor'
import { buscarComSessao, chamarComSessao } from '../../../../api/sessao'

const CAMINHO_DA_CONVERSA = '/v1/assistente/conversa'

/**
 * A conversa da professora com o Assistente de ensino (`GET /v1/assistente/conversa`): uma thread só, dela, no ano em
 * curso. **Só ela lê** (regra 70, item 8): a escola, o ano e a dona vêm do token, e a consulta não tem como pedir a de
 * outra pessoa. Fica só na memória da aba, no cache que toda troca de sessão esvazia (`main.tsx`): nunca em
 * `localStorage`.
 *
 * A primeira página são as mensagens mais recentes; cada página seguinte, as anteriores (`?antes=<id>`).
 */
export const consultaConversaDoAssistente = infiniteQueryOptions({
  queryKey: CHAVE_DA_CONVERSA,
  queryFn: ({ pageParam, signal }) =>
    buscarComSessao(pageParam === undefined ? CAMINHO_DA_CONVERSA : `${CAMINHO_DA_CONVERSA}?antes=${encodeURIComponent(pageParam)}`, conversaDoAssistenteResponseSchema, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (ultima) => ultima.anterior,
})

/**
 * As mensagens das páginas lidas, **da mais antiga para a mais nova**: cada página vem nessa ordem, e as páginas vêm da
 * mais recente para a mais antiga. A mensagem que aparecer em duas páginas (uma chegou entre uma leitura e outra) fica
 * uma vez só.
 */
export function mensagensEmOrdem(paginas: readonly ConversaDoAssistenteResponse[]): MensagemDaConversa[] {
  const vistas = new Set<string>()
  const mensagens: MensagemDaConversa[] = []
  for (const pagina of [...paginas].reverse())
    for (const mensagem of pagina.mensagens) {
      if (vistas.has(mensagem.id)) continue
      vistas.add(mensagem.id)
      mensagens.push(mensagem)
    }
  return mensagens
}

/** `POST /v1/assistente/mensagens`: responde 202 com a execução. A resposta do Assistente chega pela execução. */
export function enviarMensagemAoAssistente(pedido: MensagemAoAssistenteRequest): Promise<ExecucaoAceitaResponse> {
  return chamarComSessao('/v1/assistente/mensagens', execucaoAceitaResponseSchema, { metodo: 'POST', corpo: pedido })
}
