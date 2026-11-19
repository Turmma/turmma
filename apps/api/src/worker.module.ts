import { Heartbeat, OperationalSettings, OperationalSettingsRepository, resolverJanela, SoberaniaNaSubida, systemClock, throttledWarn, type JanelaLetiva, type Database, type DatabasePool, type DestinoDoAdaptador, type LLMProvider, type LoggerBase, type Meter, type SuspensaoDeFuncao } from '@educa/core'
import { Global, Inject, Module, type DynamicModule, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common'
import { ComandosDeIaModule } from './ia/comandos-de-ia.module.js'
import { DB, DB_POOL, DatabaseModule } from './database.module.js'
import { ExecucaoProcessor } from './ia/execucao.processor.js'
import { DESTINO_DO_ADAPTADOR, IaDoWorkerModule } from './ia/ia-do-worker.module.js'
import { LLM_PROVIDER, SUSPENSAO_DE_FUNCAO } from './ia/ia.module.js'
import { RegistroDeComandos } from './ia/registro-de-comandos.js'
import { VarreduraDeExecucoes } from './ia/varredura-de-execucoes.js'
import { createWorkerDeIa, type WorkerDeIa } from './ia/worker-de-ia.js'
import { TrechoSearch } from './material/trecho-search.js'
import type { MainWorkerConfig } from './worker-config.js'

/** De quanto em quanto tempo o `main-worker` grava o batimento que o healthcheck do compose lê. */
export const INTERVALO_DO_BATIMENTO_MS = 5_000

/** A busca de trechos que os comandos usam: aqui, sem o `MaterialModule` (que traz controller e armazém), só a classe sobre o banco. */
@Global()
@Module({})
class BuscaDoWorkerModule {
  static forRoot(): DynamicModule {
    return {
      module: BuscaDoWorkerModule,
      providers: [{ provide: TrechoSearch, useFactory: (banco: Database) => new TrechoSearch(banco), inject: [DB] }],
      exports: [TrechoSearch],
    }
  }
}

interface Montagem {
  readonly config: MainWorkerConfig
  readonly logger: LoggerBase
  readonly medidor: Meter
  readonly batimento: Heartbeat
}

/**
 * Liga o `ExecucaoProcessor` às filas `api-*` na subida e o desliga com graça no SIGTERM (X6, 5.0). É o que o `main-worker` faz de
 * útil: não há controller, nem porta, nem HTTP.
 */
export class CicloDoWorkerDeIa implements OnApplicationBootstrap, OnApplicationShutdown {
  #worker: WorkerDeIa | undefined
  #pulso: NodeJS.Timeout | undefined
  #encerrado = false
  readonly #varredura: VarreduraDeExecucoes

  constructor(
    private readonly montagem: Montagem,
    @Inject(DB) private readonly banco: Database,
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(LLM_PROVIDER) private readonly ia: LLMProvider,
    @Inject(SUSPENSAO_DE_FUNCAO) private readonly suspensao: SuspensaoDeFuncao,
    @Inject(RegistroDeComandos) private readonly comandos: RegistroDeComandos,
    @Inject(DESTINO_DO_ADAPTADOR) private readonly destino: DestinoDoAdaptador,
    @Inject(SoberaniaNaSubida) private readonly soberania: SoberaniaNaSubida,
  ) {
    this.#varredura = new VarreduraDeExecucoes(banco, montagem.logger, destino, montagem.medidor)
  }

  /**
   * Com provedor externo, o consumo das filas, a varredura e o batimento esperam a D62 conferida (8.0): sem o suboperador vigente que a cobre,
   * ou com o banco fora, o `worker-ia` não consome nada, e o healthcheck do compose, que lê o batimento, o mostra parado. Sem envio externo (o falso e o
   * local) a conferência já nasce feita e o consumo começa logo em seguida.
   */
  onApplicationBootstrap(): void {
    void this.soberania.aguardarConferida().then((conferida) => {
      // O desligamento pode vir entre o fim da leitura do cadastro e este `then`: o consumidor não nasce depois do `onApplicationShutdown`, qualquer que seja a ordem em que o Nest desliga os módulos.
      if (conferida && !this.#encerrado) this.#consume()
    })
  }

  #consume(): void {
    const { config, logger, medidor, batimento } = this.montagem
    // O horário letivo da escola, lido como o despachante e o worker comum o leem: o lote que volta dentro dele espera até o fim (regra 80, item 2).
    const avisarJanelaDescartada = throttledWarn(() => logger.warn({ evento: 'worker_ia.janela_da_escola_invalida' }))
    const janelaDaEscola = new OperationalSettings<JanelaLetiva>(new OperationalSettingsRepository(this.banco), (linha) => resolverJanela(config.janelaPadrao, linha, avisarJanelaDescartada), {
      aoFalhar: throttledWarn(() => logger.warn({ evento: 'worker_ia.configuracao_indisponivel' })),
    })
    const processador = new ExecucaoProcessor({ banco: this.banco, ia: this.ia, comandos: this.comandos, suspensao: this.suspensao, destino: this.destino, logger, medidor, janelaDaEscola, relogio: systemClock })
    this.#worker = createWorkerDeIa(config, { banco: this.banco, pool: this.pool }, { 'ia.executar': processador.processar, 'ia.executar-lote': processador.processar }, logger, { medidor })
    this.#varredura.start()
    batimento.bater()
    this.#pulso = setInterval(() => batimento.bater(), INTERVALO_DO_BATIMENTO_MS)
    this.#pulso.unref()
  }

  async onApplicationShutdown(): Promise<void> {
    this.#encerrado = true
    clearInterval(this.#pulso)
    this.#varredura.encerrar()
    await this.#worker?.encerrar()
  }
}

/**
 * O módulo do `main-worker` (X6, 5.0): o domínio da IA sem a API. Monta o banco, o provedor (`LLM_PROVIDER`, só aqui), os seis comandos
 * e o consumo das filas `api-interativa`, `api-ferramenta`, `api-normal` e `api-lote`. Nenhum controller: o contexto de aplicação do Nest sobe sem
 * HTTP, e a prontidão é o batimento em arquivo.
 */
@Module({})
export class WorkerModule {
  static forRoot(config: MainWorkerConfig, logger: LoggerBase, medidor: Meter, batimento: Heartbeat = new Heartbeat()): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        DatabaseModule.forRoot(config.banco),
        BuscaDoWorkerModule.forRoot(),
        IaDoWorkerModule.forRoot({ config: config.ia, redisFilaUrl: config.redisFilaUrl, logger, medidor }),
        ComandosDeIaModule.forRoot({ medidor }),
      ],
      providers: [
        {
          provide: CicloDoWorkerDeIa,
          useFactory: (banco: Database, pool: DatabasePool, ia: LLMProvider, suspensao: SuspensaoDeFuncao, comandos: RegistroDeComandos, destino: DestinoDoAdaptador, soberania: SoberaniaNaSubida) =>
            new CicloDoWorkerDeIa({ config, logger, medidor, batimento }, banco, pool, ia, suspensao, comandos, destino, soberania),
          inject: [DB, DB_POOL, LLM_PROVIDER, SUSPENSAO_DE_FUNCAO, RegistroDeComandos, DESTINO_DO_ADAPTADOR, SoberaniaNaSubida],
        },
      ],
    }
  }
}
