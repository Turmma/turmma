import {
  throttledWarn,
  OperationalSettings,
  OperationalSettingsRepository,
  createApiRedisClient,
  RateLimiter,
  TrustedProxies,
  resolverLimites,
  type Database,
  type RateLimitConfig,
  type RateLimits,
} from '@educa/core'
import { Global, Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { BANCO } from './database.module.js'

export const CLIENTE_REDIS_CACHE = Symbol('CLIENTE_REDIS_CACHE')
/** Os limites de requisição da escola do token: os da `configuracao_operacional_escola`, ou o padrão do ambiente. */
export const LIMITES_DA_ESCOLA = Symbol('LIMITES_DA_ESCOLA')

/**
 * Rate limit da API: o cliente do Redis de cache, o limitador, os limites de cada escola e os
 * proxies confiáveis. A guarda
 * fica no módulo raiz, logo depois da autenticação, porque a ordem das guardas globais é a ordem
 * de registro.
 */
@Global()
@Module({})
export class LimiteModule implements OnApplicationShutdown {
  private static readonly logger = new Logger('limite')

  static com(config: RateLimitConfig): DynamicModule {
    let ultimoErroRegistradoEm = Number.NEGATIVE_INFINITY
    return {
      module: LimiteModule,
      providers: [
        {
          provide: CLIENTE_REDIS_CACHE,
          useFactory: () =>
            createApiRedisClient(config.redisCacheUrl, 'api-limite', () => {
              // Com o Redis fora, o ioredis erra a cada tentativa de reconexão: uma linha a cada 30 s basta.
              if (performance.now() - ultimoErroRegistradoEm < 30_000) return
              ultimoErroRegistradoEm = performance.now()
              LimiteModule.logger.warn('limite.redis_indisponivel')
            }),
        },
        {
          provide: RateLimiter,
          useFactory: (cliente: Redis) => new RateLimiter(cliente, config),
          inject: [CLIENTE_REDIS_CACHE],
        },
        {
          provide: LIMITES_DA_ESCOLA,
          useFactory: (banco: Database): OperationalSettings<RateLimits> => {
            const padrao = { porUsuarioMin: config.porUsuarioMin, porEscolaMin: config.porEscolaMin }
            const avisarFalha = throttledWarn(() => LimiteModule.logger.warn('limite.configuracao_indisponivel'))
            return new OperationalSettings(new OperationalSettingsRepository(banco), (linha) => resolverLimites(padrao, linha), {
              aoFalhar: avisarFalha,
            })
          },
          inject: [BANCO],
        },
        { provide: TrustedProxies, useValue: new TrustedProxies(config.proxiesConfiaveis) },
      ],
      exports: [RateLimiter, TrustedProxies, LIMITES_DA_ESCOLA],
    }
  }

  constructor(@Inject(CLIENTE_REDIS_CACHE) private readonly cliente: Redis) {}

  /** Depois de o servidor fechar: requisição em andamento durante a drenagem ainda passa pelo limite. */
  onApplicationShutdown(): void {
    this.cliente.disconnect()
  }
}
