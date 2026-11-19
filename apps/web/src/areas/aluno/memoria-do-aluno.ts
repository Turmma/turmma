import type { ExecucaoAceitaResponse } from '@educa/shared'
import type { CicloDeExecucao } from '../../api/ciclo-de-execucao'
import { createTabStore } from '../../api/tab-store'
import { sendMensagemAoTutor } from '../../api/tutor'
import type { PedidoAoTutor } from './tutor'

/**
 * O que a tela do Tutor lembra entre uma rota e outra (`api/tab-store.ts`): **só em memória**, e esvaziado com a
 * sessão. A conversa não mora aqui: ela é da API (`api/tutor.ts`). Aqui fica só a pergunta que saiu e ainda está sendo
 * respondida — uma por vez, em qualquer atividade.
 */
export const CICLO_DO_TUTOR = createTabStore<CicloDeExecucao<PedidoAoTutor>>()

export function sendPerguntaAoTutor(pedido: PedidoAoTutor, chaveEnvio: string): Promise<ExecucaoAceitaResponse> {
  return sendMensagemAoTutor({ ...pedido, chaveEnvio })
}
