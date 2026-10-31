import { createDatabase, GracefulShutdown, AuthGuard, SessaoRepository, type LoggerBase, type DatabasePool } from '@educa/core'
import { Inject, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import { APP_GUARD, Reflector } from '@nestjs/core'
import type { Redis } from 'ioredis'
import type { ConfiguracaoRealtime } from './config.js'
import { ProntidaoController } from './readiness.controller.js'
import { CONFIGURACAO_IDENTIDADE, LEITURA_DE_SESSAO, LOGGER_REALTIME, SistemaGateway } from './system.gateway.js'

export const CLIENTE_REDIS_REALTIME = Symbol('CLIENTE_REDIS_REALTIME')
export const POOL_BANCO_REALTIME = Symbol('POOL_BANCO_REALTIME')

@Module({})
export class AppModule implements OnApplicationShutdown {
  static forRoot(config: ConfiguracaoRealtime, cliente: Redis, pool: DatabasePool, logger: LoggerBase): DynamicModule {
    return {
      module: AppModule,
      controllers: [ProntidaoController],
      providers: [
        SistemaGateway,
        { provide: CONFIGURACAO_IDENTIDADE, useValue: config.identidade },
        // A mesma leitura da `SessaoGuard` da API, no pool do realtime: um caminho de identidade só.
        { provide: LEITURA_DE_SESSAO, useValue: new SessaoRepository(createDatabase(pool)) },
        { provide: LOGGER_REALTIME, useValue: logger },
        { provide: CLIENTE_REDIS_REALTIME, useValue: cliente },
        { provide: POOL_BANCO_REALTIME, useValue: pool },
        { provide: GracefulShutdown, useValue: new GracefulShutdown(config.drenagem) },
        {
          // Toda rota HTTP exige token, salvo `@Public()`: rota nova nasce fechada.
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new AuthGuard(reflector, config.identidade),
          inject: [Reflector],
        },
      ],
    }
  }

  constructor(
    @Inject(CLIENTE_REDIS_REALTIME) private readonly cliente: Redis,
    @Inject(POOL_BANCO_REALTIME) private readonly pool: DatabasePool,
  ) {}

  /**
   * O socket.io já fechou quando o Nest chega aqui (o adaptador parou de ler o stream e desligou
   * as cópias do cliente). Só então saem o cliente que publica e o pool do banco, que nenhum
   * handshake em andamento ainda usa.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.cliente.status !== 'end') await this.cliente.quit().catch(() => this.cliente.disconnect())
    await this.pool.end()
  }
}
