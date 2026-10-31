import { throttledWarn, UsageMeter, createApiRedisClient } from '@educa/core'
import { Global, Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'

export const REDIS_USAGE_CLIENT = Symbol('REDIS_USAGE_CLIENT')

/**
 * O contador de uso por escola (D30, RF17), no Redis de fila. O cliente é o da API: sem fila offline e
 * com prazo de 100 ms por comando, e a marcação nem espera por ele. Com o Redis de fila fora ou
 * travado, a API atende igual; perde-se só a contagem.
 *
 * O interceptor que marca fica no módulo raiz, como as guardas.
 */
@Global()
@Module({})
export class UsageModule implements OnApplicationShutdown {
  private static readonly logger = new Logger('uso')

  static forRoot(redisFilaUrl: string): DynamicModule {
    const avisar = throttledWarn(() => UsageModule.logger.warn('uso.contador_indisponivel'))
    return {
      module: UsageModule,
      providers: [
        { provide: REDIS_USAGE_CLIENT, useFactory: () => createApiRedisClient(redisFilaUrl, 'api-uso', avisar) },
        { provide: UsageMeter, useFactory: (cliente: Redis) => new UsageMeter(cliente, { aoFalhar: avisar }), inject: [REDIS_USAGE_CLIENT] },
      ],
      exports: [UsageMeter],
    }
  }

  constructor(@Inject(REDIS_USAGE_CLIENT) private readonly cliente: Redis) {}

  /** Depois de o servidor fechar: a requisição que termina durante a drenagem ainda é contada. */
  onApplicationShutdown(): void {
    this.cliente.disconnect()
  }
}
