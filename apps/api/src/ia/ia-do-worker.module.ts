import { createLLMGateway, createQueueRedisClient, destinoDoAdaptador, globalMeter, SoberaniaNaSubida, throttledWarn, TokenLimiter, SuboperadorDaEscolaRepository, type Database, type DestinoDoAdaptador, type LimiteDeTokens, type LLMConfig, type LoggerBase, type Meter, type OrcamentoDeIa, type SuspensaoDeFuncao } from '@educa/core'
import { Global, Inject, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { DB } from '../database.module.js'
import { ConsumoRepository } from './consumo.repository.js'
import { LLM_PROVIDER, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO } from './ia.module.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { RegistroDeComandos } from './registro-de-comandos.js'
import { SuspensaoRepository } from './suspensao.repository.js'

/** O cliente Redis do limite de tokens (49.0): o de fila, sem fila offline e com prazo por comando, como o das vagas. `null` quando a configuração não tem `LLM_TOKENS_POR_MINUTO` (só em `AMBIENTE=local`). */
export const REDIS_DOS_TOKENS = Symbol('REDIS_DOS_TOKENS')
/** O limite de tokens por minuto (49.0) que o gateway lê. `null` sem `LLM_TOKENS_POR_MINUTO`: a chamada não espera nem desce de degrau. */
export const LIMITE_DE_TOKENS = Symbol('LIMITE_DE_TOKENS')

/** Para onde o adaptador configurado manda o conteúdo (X6, 6.0): a linha estimada da execução interrompida leva o envio e o modelo dele. */
export const DESTINO_DO_ADAPTADOR = Symbol('DESTINO_DO_ADAPTADOR')

export interface IaDoWorkerOptions {
  /** A configuração de IA que o `loadWorkerConfig` leu e validou (`IA_ADAPTADOR`, `LLM_*`, `IA_REPLICAS`). */
  readonly config: LLMConfig
  /** O Redis de fila (`REDIS_FILA_URL`): o limite de tokens é somado entre as réplicas nele. */
  readonly redisFilaUrl: string
  readonly logger: LoggerBase
  /** Só do teste; sem ele vale o medidor global do processo. */
  readonly medidor?: Meter
}

/**
 * A camada de IA **no `main-worker`** (X6, 5.0): o único lugar do sistema que monta o provedor (`createLLMGateway`), com as portas em
 * Postgres. O registro de comandos é o mesmo que a API monta, com os mesmos seis comandos (`ComandosDeIaModule`); aqui o
 * `ExecucaoProcessor` os executa. Global, como o `IaModule`, para o `ComandosDeIaModule` achar a suspensão e o registro nos dois processos.
 */
@Global()
@Module({})
export class IaDoWorkerModule implements OnApplicationShutdown {
  static forRoot({ config, redisFilaUrl, logger, medidor }: IaDoWorkerOptions): DynamicModule {
    return {
      module: IaDoWorkerModule,
      providers: [
        {
          provide: REDIS_DOS_TOKENS,
          useFactory: (): Redis | null => (config.tokensPorMinuto === undefined ? null : createQueueRedisClient(redisFilaUrl, 'worker-ia-tokens', throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_dos_tokens_indisponivel' })))),
        },
        {
          provide: LIMITE_DE_TOKENS,
          useFactory: (redis: Redis | null): LimiteDeTokens | null => (redis === null || config.tokensPorMinuto === undefined ? null : new TokenLimiter(redis, { tokensPorMinuto: config.tokensPorMinuto, replicas: config.replicas })),
          inject: [REDIS_DOS_TOKENS],
        },
        { provide: SUSPENSAO_DE_FUNCAO, useFactory: (banco: Database) => new SuspensaoRepository(banco), inject: [DB] },
        { provide: ORCAMENTO_DE_IA, useFactory: (banco: Database) => new OrcamentoRepository(banco), inject: [DB] },
        {
          // A D62 na subida (8.0): o `main-worker` só consome fila com ela conferida (`CicloDoWorkerDeIa`), e o gateway a lê a cada chamada.
          provide: SoberaniaNaSubida,
          useFactory: (banco: Database) => new SoberaniaNaSubida({ config, leitura: new SuboperadorDaEscolaRepository(banco), logger }),
          inject: [DB],
        },
        {
          provide: LLM_PROVIDER,
          useFactory: (banco: Database, orcamento: OrcamentoDeIa, suspensao: SuspensaoDeFuncao, soberania: SoberaniaNaSubida, limiteDeTokens: LimiteDeTokens | null) =>
            createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, soberania, logger, medidor: medidor ?? globalMeter(), ...(limiteDeTokens === null ? {} : { limiteDeTokens }) }),
          inject: [DB, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO, SoberaniaNaSubida, LIMITE_DE_TOKENS],
        },
        { provide: RegistroDeComandos, useFactory: () => new RegistroDeComandos() },
        { provide: DESTINO_DO_ADAPTADOR, useFactory: (): DestinoDoAdaptador => destinoDoAdaptador(config) },
      ],
      exports: [LLM_PROVIDER, SUSPENSAO_DE_FUNCAO, ORCAMENTO_DE_IA, RegistroDeComandos, DESTINO_DO_ADAPTADOR, SoberaniaNaSubida],
    }
  }

  constructor(@Inject(REDIS_DOS_TOKENS) private readonly redisDosTokens: Redis | null) {}

  /** Fecha o cliente do limite de tokens: o contexto de aplicação do worker não fica preso a ele no desligamento. */
  onApplicationShutdown(): void {
    this.redisDosTokens?.disconnect()
  }
}
