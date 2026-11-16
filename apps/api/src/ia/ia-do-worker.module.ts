import { createLLMGateway, destinoDoAdaptador, globalMeter, type Database, type DestinoDoAdaptador, type LLMConfig, type LoggerBase, type Meter, type OrcamentoDeIa, type SuspensaoDeFuncao } from '@educa/core'
import { Global, Module, type DynamicModule } from '@nestjs/common'
import { DB } from '../database.module.js'
import { ConsumoRepository } from './consumo.repository.js'
import { LLM_PROVIDER, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO } from './ia.module.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { RegistroDeComandos } from './registro-de-comandos.js'
import { SuspensaoRepository } from './suspensao.repository.js'

/** Para onde o adaptador configurado manda o conteúdo (X6, 6.0): a linha estimada da execução interrompida leva o envio e o modelo dele. */
export const DESTINO_DO_ADAPTADOR = Symbol('DESTINO_DO_ADAPTADOR')

export interface IaDoWorkerOptions {
  /** A configuração de IA que o `loadWorkerConfig` leu e validou (`IA_ADAPTADOR`, `LLM_*`, `IA_REPLICAS`). */
  readonly config: LLMConfig
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
export class IaDoWorkerModule {
  static forRoot({ config, logger, medidor }: IaDoWorkerOptions): DynamicModule {
    return {
      module: IaDoWorkerModule,
      providers: [
        { provide: SUSPENSAO_DE_FUNCAO, useFactory: (banco: Database) => new SuspensaoRepository(banco), inject: [DB] },
        { provide: ORCAMENTO_DE_IA, useFactory: (banco: Database) => new OrcamentoRepository(banco), inject: [DB] },
        {
          provide: LLM_PROVIDER,
          useFactory: (banco: Database, orcamento: OrcamentoDeIa, suspensao: SuspensaoDeFuncao) =>
            createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, logger, medidor: medidor ?? globalMeter() }),
          inject: [DB, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO],
        },
        { provide: RegistroDeComandos, useFactory: () => new RegistroDeComandos() },
        { provide: DESTINO_DO_ADAPTADOR, useFactory: (): DestinoDoAdaptador => destinoDoAdaptador(config) },
      ],
      exports: [LLM_PROVIDER, SUSPENSAO_DE_FUNCAO, ORCAMENTO_DE_IA, RegistroDeComandos, DESTINO_DO_ADAPTADOR],
    }
  }
}
