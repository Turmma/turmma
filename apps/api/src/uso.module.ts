import { throttledWarn, UsageMeter, createApiRedisClient } from '@educa/core'
import { Global, Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'

export const CLIENTE_REDIS_USO = Symbol('CLIENTE_REDIS_USO')

/**
 * O contador de uso por escola (D30, RF17), no Redis de fila. O cliente é o da API: sem fila offline e
 * com prazo de 100 ms por comando, e a marcação nem espera por ele. Com o Redis de fila fora ou
 * travado, a API atende igual; perde-se só a contagem.
 *
 * O interceptor que marca fica no módulo raiz, como as guardas.
 */
@Global()
@Module({})
export class UsoModule implements OnApplicationShutdown {
  private static readonly logger = new Logger('uso')

  static com(redisFilaUrl: string): DynamicModule {
    const avisar = throttledWarn(() => UsoModule.logger.warn('uso.contador_indisponivel'))
    return {
      module: UsoModule,
      providers: [
        { provide: CLIENTE_REDIS_USO, useFactory: () => createApiRedisClient(redisFilaUrl, 'api-uso', avisar) },
        { provide: UsageMeter, useFactory: (cliente: Redis) => new UsageMeter(cliente, { aoFalhar: avisar }), inject: [CLIENTE_REDIS_USO] },
      ],
      exports: [UsageMeter],
    }
  }

  constructor(@Inject(CLIENTE_REDIS_USO) private readonly cliente: Redis) {}

  /** Depois de o servidor fechar: a requisição que termina durante a drenagem ainda é contada. */
  onApplicationShutdown(): void {
    this.cliente.disconnect()
  }
}
