import type { AuthConfig, SessaoReader, LoggerBase } from '@educa/core'
import { SYSTEM_REALTIME_NAMESPACE } from '@educa/shared'
import { Inject } from '@nestjs/common'
import { WebSocketGateway, type OnGatewayConnection, type OnGatewayInit } from '@nestjs/websockets'
import type { Namespace } from 'socket.io'
import { handshakeAuth, type RealtimeSocket } from './handshake-auth.js'

export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG')
export const SESSAO_READER = Symbol('SESSAO_READER')
export const REALTIME_LOGGER = Symbol('REALTIME_LOGGER')

/** Sala de todos os clientes de uma escola. O nome só é montado aqui, a partir do token verificado. */
export function escolaRoom(escolaId: string): string {
  return `escola:${escolaId}`
}

/**
 * Namespace `/sistema`. Todo cliente entra autenticado pelo JWT e pela sessão gravada, e cai na sala
 * da escola dessa sessão. Não há evento para entrar em sala, e a sala não vem de nada que o cliente
 * mande (regra 10, item 3). Sem handler de mensagem no F0: a emissão chega pelo adaptador Redis.
 */
@WebSocketGateway({ namespace: SYSTEM_REALTIME_NAMESPACE })
export class SystemGateway implements OnGatewayInit<Namespace>, OnGatewayConnection<RealtimeSocket> {
  constructor(
    @Inject(IDENTITY_CONFIG) private readonly identidade: AuthConfig,
    @Inject(SESSAO_READER) private readonly sessoes: SessaoReader,
    @Inject(REALTIME_LOGGER) private readonly logger: LoggerBase,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use(handshakeAuth(this.identidade, this.sessoes, this.logger))
  }

  async handleConnection(socket: RealtimeSocket): Promise<void> {
    const identidade = socket.data.identidade
    // O middleware só deixa passar socket autenticado; sem identidade aqui, falha fechada.
    if (identidade === undefined) {
      socket.disconnect(true)
      return
    }
    await socket.join(escolaRoom(identidade.escolaId))
  }
}
