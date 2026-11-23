import { adaptadorDaReserva, createLLMGateway, createQueueRedisClient, destinoDoAdaptador, globalMeter, observeProvedorDeReserva, SoberaniaNaSubida, tarefasAprovadasParaAReserva, throttledWarn, TokenLimiter, SuboperadorDaEscolaRepository, type Database, type DestinoDoAdaptador, type LimiteDeTokens, type LLMConfig, type LoggerBase, type Meter, type OrcamentoDeIa, type SuspensaoDeFuncao } from '@educa/core'
import { Global, Inject, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { DB } from '../database.module.js'
import { ConsumoRepository } from './consumo.repository.js'
import { LLM_PROVIDER, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO } from './ia.module.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { RegistroDeComandos } from './registro-de-comandos.js'
import { SuspensaoRepository } from './suspensao.repository.js'

/** O cliente Redis do limite de tokens (49.0): o de fila, sem fila offline e com prazo por comando, como o das vagas. `null` quando a configuração não tem `LLM_TOKENS_POR_MINUTO` nem `LLM_RESERVA_TOKENS_POR_MINUTO` (só em `AMBIENTE=local`). É um só para o limitador do principal e o da reserva. */
export const REDIS_DOS_TOKENS = Symbol('REDIS_DOS_TOKENS')
/** O limite de tokens por minuto (49.0) que o gateway lê. `null` sem `LLM_TOKENS_POR_MINUTO`: a chamada não espera nem desce de degrau. */
export const LIMITE_DE_TOKENS = Symbol('LIMITE_DE_TOKENS')

/** O limitador de tokens **da reserva** (F5b, 2.0): o `TokenLimiter` com o `LLM_RESERVA_TOKENS_POR_MINUTO` dela e os mesmos baldes por fila. `null` sem reserva, ou sem o contratado (só em `AMBIENTE=local`). */
export const LIMITE_DE_TOKENS_DA_RESERVA = Symbol('LIMITE_DE_TOKENS_DA_RESERVA')
/**
 * A conferência da D62 **da reserva** (F5b, 2.0): uma `SoberaniaNaSubida` própria, pela chave da `IA_RESERVA_PROVEDOR_ID`, que **não** segura o consumo das filas (o `CicloDoWorkerDeIa` só espera a do
 * principal). `null` sem reserva configurada.
 */
export const SOBERANIA_DA_RESERVA = Symbol('SOBERANIA_DA_RESERVA')

/** Para onde o adaptador configurado manda o conteúdo (X6, 6.0): a linha estimada da execução interrompida leva o envio e o modelo dele. */
export const DESTINO_DO_ADAPTADOR = Symbol('DESTINO_DO_ADAPTADOR')
/** Para onde o provedor de reserva configurado manda o conteúdo (F5b, 8.0): o destino que a linha estimada da execução interrompida leva quando a tarefa tem aprovação para ele. `null` sem reserva. */
export const DESTINO_DA_RESERVA = Symbol('DESTINO_DA_RESERVA')

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
          useFactory: (): Redis | null => (config.tokensPorMinuto === undefined && config.reserva?.tokensPorMinuto === undefined ? null : createQueueRedisClient(redisFilaUrl, 'worker-ia-tokens', throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_dos_tokens_indisponivel' })))),
        },
        {
          provide: LIMITE_DE_TOKENS,
          useFactory: (redis: Redis | null): LimiteDeTokens | null => (redis === null || config.tokensPorMinuto === undefined ? null : new TokenLimiter(redis, { tokensPorMinuto: config.tokensPorMinuto, replicas: config.replicas })),
          inject: [REDIS_DOS_TOKENS],
        },
        {
          provide: LIMITE_DE_TOKENS_DA_RESERVA,
          useFactory: (redis: Redis | null): LimiteDeTokens | null =>
            redis === null || config.reserva?.tokensPorMinuto === undefined ? null : new TokenLimiter(redis, { tokensPorMinuto: config.reserva.tokensPorMinuto, replicas: config.replicas }),
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
          // A reserva (F5b, 2.0): o mesmo contrato conferido pela D62, com a chave e as categorias dela. Nada espera por esta conferência, e a série `ia.provedor_de_reserva.conferido` só existe com ela.
          provide: SOBERANIA_DA_RESERVA,
          useFactory: (banco: Database): SoberaniaNaSubida | null => {
            const reserva = adaptadorDaReserva(config)
            if (reserva === undefined || config.reserva === undefined) return null
            const soberania = new SoberaniaNaSubida({
              config,
              leitura: new SuboperadorDaEscolaRepository(banco),
              logger,
              daReserva: { envio: reserva.envio, tarefas: tarefasAprovadasParaAReserva(reserva, config.reserva.ambiente) },
            })
            // Um callback por montagem do módulo: em produção é um por processo. Quem monta o módulo várias vezes no mesmo medidor (os testes) acumula callbacks, que leem cada um a sua conferência.
            observeProvedorDeReserva(medidor ?? globalMeter(), reserva.identidade, () => soberania.conferida)
            return soberania
          },
          inject: [DB],
        },
        {
          provide: LLM_PROVIDER,
          useFactory: (
            banco: Database,
            orcamento: OrcamentoDeIa,
            suspensao: SuspensaoDeFuncao,
            soberania: SoberaniaNaSubida,
            limiteDeTokens: LimiteDeTokens | null,
            limiteDeTokensDaReserva: LimiteDeTokens | null,
            soberaniaDaReserva: SoberaniaNaSubida | null,
          ) =>
            createLLMGateway(config, {
              registro: new ConsumoRepository(banco),
              orcamento,
              suspensao,
              soberania,
              logger,
              medidor: medidor ?? globalMeter(),
              ...(limiteDeTokens === null ? {} : { limiteDeTokens }),
              ...(limiteDeTokensDaReserva === null ? {} : { limiteDeTokensDaReserva }),
              ...(soberaniaDaReserva === null ? {} : { soberaniaDaReserva }),
            }),
          inject: [DB, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO, SoberaniaNaSubida, LIMITE_DE_TOKENS, LIMITE_DE_TOKENS_DA_RESERVA, SOBERANIA_DA_RESERVA],
        },
        { provide: RegistroDeComandos, useFactory: () => new RegistroDeComandos() },
        { provide: DESTINO_DO_ADAPTADOR, useFactory: (): DestinoDoAdaptador => destinoDoAdaptador(config) },
        {
          provide: DESTINO_DA_RESERVA,
          useFactory: (): DestinoDoAdaptador | null => {
            const reserva = adaptadorDaReserva(config)
            return reserva === undefined ? null : { origem: reserva.origem, envio: reserva.envio, identidade: reserva.identidade, modeloDoPerfil: (perfil) => reserva.modeloDoPerfil(perfil) }
          },
        },
      ],
      exports: [LLM_PROVIDER, SUSPENSAO_DE_FUNCAO, ORCAMENTO_DE_IA, RegistroDeComandos, DESTINO_DO_ADAPTADOR, DESTINO_DA_RESERVA, SoberaniaNaSubida, SOBERANIA_DA_RESERVA, LIMITE_DE_TOKENS_DA_RESERVA],
    }
  }

  constructor(@Inject(REDIS_DOS_TOKENS) private readonly redisDosTokens: Redis | null) {}

  /** Fecha o cliente do limite de tokens: o contexto de aplicação do worker não fica preso a ele no desligamento. */
  onApplicationShutdown(): void {
    this.redisDosTokens?.disconnect()
  }
}
