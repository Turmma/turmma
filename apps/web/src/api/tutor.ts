import { conversaDoTutorResponseSchema, execucaoAceitaResponseSchema, type MensagemDoTutor, type MensagemAoTutorRequest, type ConversaDoTutorResponse, type ExecucaoAceitaResponse } from '@educa/shared'
import { infiniteQueryOptions } from '@tanstack/react-query'
import { CONVERSA_DO_TUTOR_QUERY_KEY } from './chaves-do-aluno'
import { authedGet, authedRequest } from './sessao'

const CAMINHO_DA_CONVERSA = '/v1/tutor/conversa'

/**
 * A conversa do aluno com o Tutor numa atividade (`GET /v1/tutor/conversa?atividadeAplicadaId=`), com o estado do Tutor
 * para ele agora e quanto do dia já usou. **Só o próprio aluno lê**: a escola, a turma e o aluno vêm do token. Fica só
 * no cache de consultas, que toda troca de sessão esvazia (`main.tsx`): nunca em `localStorage` (regra 20, item 14).
 *
 * A primeira página são as mensagens mais recentes; cada página seguinte, as anteriores (`?antes=<id>`). O estado e o
 * uso valem os da primeira página, que é a lida por último.
 */
export function conversaDoTutorQueryOptions(atividadeAplicadaId: string) {
  return infiniteQueryOptions({
    queryKey: [...CONVERSA_DO_TUTOR_QUERY_KEY, atividadeAplicadaId],
    queryFn: ({ pageParam, signal }) => {
      const consulta = new URLSearchParams({ atividadeAplicadaId })
      if (pageParam !== undefined) consulta.set('antes', pageParam)
      return authedGet(`${CAMINHO_DA_CONVERSA}?${consulta.toString()}`, conversaDoTutorResponseSchema, signal)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.anterior,
    // O estado do Tutor muda sem o aluno fazer nada (a professora abre ou encerra uma avaliação): quem volta à tela relê.
    staleTime: 0,
  })
}

/**
 * As mensagens das páginas lidas, **da mais antiga para a mais nova**: cada página vem nessa ordem, e as páginas vêm da
 * mais recente para a mais antiga. A mensagem que aparecer em duas páginas fica uma vez só.
 */
export function mensagensDoTutorEmOrdem(paginas: readonly ConversaDoTutorResponse[]): MensagemDoTutor[] {
  const vistas = new Set<string>()
  const mensagens: MensagemDoTutor[] = []
  for (const pagina of [...paginas].reverse())
    for (const mensagem of pagina.mensagens) {
      if (vistas.has(mensagem.id)) continue
      vistas.add(mensagem.id)
      mensagens.push(mensagem)
    }
  return mensagens
}

/** `POST /v1/tutor/mensagens`: responde 202 com a execução. A resposta do Tutor chega pela execução. */
export function enviarMensagemAoTutor(pedido: MensagemAoTutorRequest): Promise<ExecucaoAceitaResponse> {
  return authedRequest('/v1/tutor/mensagens', execucaoAceitaResponseSchema, { metodo: 'POST', corpo: pedido })
}
