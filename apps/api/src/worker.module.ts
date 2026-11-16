import { Heartbeat, type Database, type DatabasePool, type DestinoDoAdaptador, type LLMProvider, type LoggerBase, type Meter, type SuspensaoDeFuncao } from '@educa/core'
import { Global, Inject, Module, type DynamicModule, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common'
import { ComandosDeIaModule } from './ia/comandos-de-ia.module.js'
import { DB, DB_POOL, DatabaseModule } from './database.module.js'
import { ExecucaoProcessor } from './ia/execucao.processor.js'
import { DESTINO_DO_ADAPTADOR, IaDoWorkerModule } from './ia/ia-do-worker.module.js'
import { LLM_PROVIDER, SUSPENSAO_DE_FUNCAO } from './ia/ia.module.js'
import { RegistroDeComandos } from './ia/registro-de-comandos.js'
import { VarreduraDeExecucoes } from './ia/varredura-de-execucoes.js'
import { criarWorkerDeIa, type WorkerDeIa } from './ia/worker-de-ia.js'
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
class CicloDoWorkerDeIa implements OnApplicationBootstrap, OnApplicationShutdown {
  #worker: WorkerDeIa | undefined
  #pulso: NodeJS.Timeout | undefined
  readonly #varredura: VarreduraDeExecucoes

  constructor(
    private readonly montagem: Montagem,
    @Inject(DB) private readonly banco: Database,
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    @Inject(LLM_PROVIDER) private readonly ia: LLMProvider,
    @Inject(SUSPENSAO_DE_FUNCAO) private readonly suspensao: SuspensaoDeFuncao,
    @Inject(RegistroDeComandos) private readonly comandos: RegistroDeComandos,
    @Inject(DESTINO_DO_ADAPTADOR) private readonly destino: DestinoDoAdaptador,
  ) {
    this.#varredura = new VarreduraDeExecucoes(banco, montagem.logger, destino, montagem.medidor)
  }

  onApplicationBootstrap(): void {
    const { config, logger, medidor, batimento } = this.montagem
    const processador = new ExecucaoProcessor({ banco: this.banco, ia: this.ia, comandos: this.comandos, suspensao: this.suspensao, destino: this.destino, logger, medidor })
    this.#worker = criarWorkerDeIa(config, { banco: this.banco, pool: this.pool }, { 'ia.executar': processador.processar }, logger, { medidor })
    this.#varredura.iniciar()
    batimento.bater()
    this.#pulso = setInterval(() => batimento.bater(), INTERVALO_DO_BATIMENTO_MS)
    this.#pulso.unref()
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.#pulso)
    this.#varredura.encerrar()
    await this.#worker?.encerrar()
  }
}

/**
 * O módulo do `main-worker` (X6, 5.0): o domínio da IA sem a API. Monta o banco, o provedor (`LLM_PROVIDER`, só aqui), os seis comandos
 * e o consumo das filas `api-interativa`, `api-ferramenta` e `api-normal`. Nenhum controller: o contexto de aplicação do Nest sobe sem
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
        IaDoWorkerModule.forRoot({ config: config.ia, logger, medidor }),
        ComandosDeIaModule.forRoot({ medidor }),
      ],
      providers: [
        {
          provide: CicloDoWorkerDeIa,
          useFactory: (banco: Database, pool: DatabasePool, ia: LLMProvider, suspensao: SuspensaoDeFuncao, comandos: RegistroDeComandos, destino: DestinoDoAdaptador) =>
            new CicloDoWorkerDeIa({ config, logger, medidor, batimento }, banco, pool, ia, suspensao, comandos, destino),
          inject: [DB, DB_POOL, LLM_PROVIDER, SUSPENSAO_DE_FUNCAO, RegistroDeComandos, DESTINO_DO_ADAPTADOR],
        },
      ],
    }
  }
}
