import { createDatabase, GracefulShutdown, AuthGuard, SessaoRepository, type LoggerBase, type DatabasePool } from '@educa/core'
import { Inject, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import { APP_GUARD, Reflector } from '@nestjs/core'
import type { Redis } from 'ioredis'
import type { RealtimeConfig } from './config.js'
import { ReadinessController } from './readiness.controller.js'
import { IDENTITY_CONFIG, SESSAO_READER, REALTIME_LOGGER, SystemGateway } from './system.gateway.js'

export const REALTIME_REDIS_CLIENT = Symbol('REALTIME_REDIS_CLIENT')
export const REALTIME_DB_POOL = Symbol('REALTIME_DB_POOL')

@Module({})
export class AppModule implements OnApplicationShutdown {
  static forRoot(config: RealtimeConfig, cliente: Redis, pool: DatabasePool, logger: LoggerBase): DynamicModule {
    return {
      module: AppModule,
      controllers: [ReadinessController],
      providers: [
        SystemGateway,
        { provide: IDENTITY_CONFIG, useValue: config.identidade },
        // A mesma leitura da `SessaoGuard` da API, no pool do realtime: um caminho de identidade só.
        { provide: SESSAO_READER, useValue: new SessaoRepository(createDatabase(pool)) },
        { provide: REALTIME_LOGGER, useValue: logger },
        { provide: REALTIME_REDIS_CLIENT, useValue: cliente },
        { provide: REALTIME_DB_POOL, useValue: pool },
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
    @Inject(REALTIME_REDIS_CLIENT) private readonly cliente: Redis,
    @Inject(REALTIME_DB_POOL) private readonly pool: DatabasePool,
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
