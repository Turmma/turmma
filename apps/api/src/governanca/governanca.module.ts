import type { Database } from '@educa/core'
import { Module } from '@nestjs/common'
import { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { DB } from '../database.module.js'
import { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { AnalistaController } from './analista.controller.js'
import { AnalistaService } from './analista.service.js'
import { GovernancaController } from './governanca.controller.js'
import { GovernancaService } from './governanca.service.js'

/**
 * A governança de IA e o Analista de desempenho escolar (MVP, A5; D9, D34, D45, D60, D61, D64): o que a IA gerou e que
 * uma pessoa decidiu, o que cada função faz sozinha, a suspensão por função, o consumo e o resumo em agregado. Só a
 * coordenação alcança estas rotas.
 *
 * O `ExecucaoScheduler` vem do `IaModule`, e o `IaRequestRateLimit`, do `AssistenteModule`, os dois globais. A
 * suspensão que este módulo grava é a que o agendador, o provedor e a `FuncaoSuspensionCheck` conferem a cada execução.
 */
@Module({
  controllers: [GovernancaController, AnalistaController],
  providers: [
    { provide: GovernancaService, useFactory: (banco: Database) => new GovernancaService(banco), inject: [DB] },
    {
      provide: AnalistaService,
      useFactory: (banco: Database, agendador: ExecucaoScheduler, limite: IaRequestRateLimit) => new AnalistaService(banco, agendador, limite),
      inject: [DB, ExecucaoScheduler, IaRequestRateLimit],
    },
  ],
})
export class GovernancaModule {}
