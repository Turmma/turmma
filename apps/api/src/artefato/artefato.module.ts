import type { Database } from '@educa/core'
import { Module } from '@nestjs/common'
import { LimiteDePedidosDeIa } from '../assistente/ai-request-rate-limit.js'
import { BANCO } from '../database.module.js'
import { AgendadorDeExecucoes } from '../ia/execucao.scheduler.js'
import { BuscaDeTrechos } from '../material/trecho-search.js'
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
      useFactory: (banco: Database, agendador: AgendadorDeExecucoes, limite: LimiteDePedidosDeIa, trechos: BuscaDeTrechos) => new FerramentasService(banco, agendador, limite, trechos),
      inject: [BANCO, AgendadorDeExecucoes, LimiteDePedidosDeIa, BuscaDeTrechos],
    },
    {
      provide: ArtefatoService,
      useFactory: (banco: Database, agendador: AgendadorDeExecucoes, limite: LimiteDePedidosDeIa) => new ArtefatoService(banco, agendador, limite),
      inject: [BANCO, AgendadorDeExecucoes, LimiteDePedidosDeIa],
    },
  ],
})
export class ArtefatoModule {}
