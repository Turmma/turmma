import type { Database } from '@educa/core'
import { Module } from '@nestjs/common'
import { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { DB } from '../database.module.js'
import { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { TrechoSearch } from '../material/trecho-search.js'
import { ArtefatoController } from './artefato.controller.js'
import { ArtefatoService } from './artefato.service.js'
import { FerramentasController } from './ferramentas.controller.js'
import { FerramentasService } from './ferramentas.service.js'

/**
 * As ferramentas e o artefato (MVP, A2; D18, D67): gerar atividade objetiva e plano de aula, abrir, renomear, exportar
 * em PDF e pedir a versão adaptada. O limite dos pedidos de IA vem do `AssistenteModule`, a busca de trechos, do
 * `MaterialModule`, e o agendador, do `IaModule`, os três globais.
 */
@Module({
  controllers: [FerramentasController, ArtefatoController],
  providers: [
    {
      provide: FerramentasService,
      useFactory: (banco: Database, agendador: ExecucaoScheduler, limite: IaRequestRateLimit, trechos: TrechoSearch) => new FerramentasService(banco, agendador, limite, trechos),
      inject: [DB, ExecucaoScheduler, IaRequestRateLimit, TrechoSearch],
    },
    {
      provide: ArtefatoService,
      useFactory: (banco: Database, agendador: ExecucaoScheduler, limite: IaRequestRateLimit) => new ArtefatoService(banco, agendador, limite),
      inject: [DB, ExecucaoScheduler, IaRequestRateLimit],
    },
  ],
})
export class ArtefatoModule {}
