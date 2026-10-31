import type { Database, LoggerBase } from '@educa/core'
import { Global, Module, type DynamicModule } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { DB } from '../database.module.js'
import { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { REDIS_LOGIN_CLIENT, WindowCounter } from '../credencial/index.js'
import { AssistenteController } from './assistente.controller.js'
import { AssistenteService } from './assistente.service.js'
import { avisarSeguroDosPedidosDeIa, JANELA_DOS_PEDIDOS_DE_IA_MS, IaRequestRateLimit } from './ai-request-rate-limit.js'
import { TimeController } from './time.controller.js'
import { TimeService } from './time.service.js'
import { TrechoSearch } from '../material/trecho-search.js'

export interface AssistenteModuleOptions {
  /** A chave de HMAC dos contadores (`LOGIN_CHAVE_CONTADOR`): a chave do contador nunca é o id em texto. */
  readonly chaveContador: Uint8Array
  /** Quantas instâncias da API dividem os tetos quando o Redis de fila está fora (`LIMITE_INSTANCIAS_API`). */
  readonly instancias: number
  /** O logger JSON do processo, para a linha `ia.limite_de_pedidos_atingido` com a escola e a pessoa por id. */
  readonly logger: LoggerBase
}

/**
 * O Assistente de ensino na API (MVP, A2): o time (`GET /v1/time`) e a conversa do professor. Exporta o que os outros
 * módulos de IA reusam: o `IaRequestRateLimit` (todo `POST` que dispara IA conta por pessoa e por escola). Os trechos do
 * material vêm da `TrechoSearch`, do `MaterialModule`: há uma busca só para as tarefas. O cliente do Redis de
 * fila vem do `SessaoModule`, e o `ExecucaoScheduler`, do `IaModule`, os dois globais. É global pelo mesmo motivo: o
 * módulo de domínio que dispara IA só injeta.
 */
@Global()
@Module({})
export class AssistenteModule {
  static forRoot({ chaveContador, instancias, logger }: AssistenteModuleOptions): DynamicModule {
    return {
      module: AssistenteModule,
      controllers: [TimeController, AssistenteController],
      providers: [
        {
          provide: IaRequestRateLimit,
          useFactory: (cliente: Redis) => new IaRequestRateLimit({ janela: new WindowCounter(cliente, chaveContador, { janelaMs: JANELA_DOS_PEDIDOS_DE_IA_MS, avisarSeguro: avisarSeguroDosPedidosDeIa }), instancias, logger }),
          inject: [REDIS_LOGIN_CLIENT],
        },
        { provide: TimeService, useFactory: (banco: Database) => new TimeService(banco), inject: [DB] },
        {
          provide: AssistenteService,
          useFactory: (banco: Database, agendador: ExecucaoScheduler, limite: IaRequestRateLimit, trechos: TrechoSearch) => new AssistenteService(banco, agendador, limite, trechos),
          inject: [DB, ExecucaoScheduler, IaRequestRateLimit, TrechoSearch],
        },
      ],
      exports: [IaRequestRateLimit],
    }
  }
}
