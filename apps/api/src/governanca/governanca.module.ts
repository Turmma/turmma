import type { Database } from '@educa/nucleo'
import { Module } from '@nestjs/common'
import { LimiteDePedidosDeIa } from '../assistente/limite-de-pedidos-de-ia.js'
import { BANCO } from '../banco.module.js'
import { AgendadorDeExecucoes } from '../ia/agendador-de-execucoes.js'
import { AnalistaController } from './analista.controller.js'
import { AnalistaService } from './analista.service.js'
import { GovernancaController } from './governanca.controller.js'
import { GovernancaService } from './governanca.service.js'

/**
 * A governança de IA e o Analista de desempenho escolar (MVP, A5; D9, D34, D45, D60, D61, D64): o que a IA gerou e que
 * uma pessoa decidiu, o que cada função faz sozinha, a suspensão por função, o consumo e o resumo em agregado. Só a
 * coordenação alcança estas rotas.
 *
 * O `AgendadorDeExecucoes` vem do `IaModule`, e o `LimiteDePedidosDeIa`, do `AssistenteModule`, os dois globais. A
 * suspensão que este módulo grava é a que o agendador, o provedor e a `ConferenciaDeFuncao` conferem a cada execução.
 */
@Module({
  controllers: [GovernancaController, AnalistaController],
  providers: [
    { provide: GovernancaService, useFactory: (banco: Database) => new GovernancaService(banco), inject: [BANCO] },
    {
      provide: AnalistaService,
      useFactory: (banco: Database, agendador: AgendadorDeExecucoes, limite: LimiteDePedidosDeIa) => new AnalistaService(banco, agendador, limite),
      inject: [BANCO, AgendadorDeExecucoes, LimiteDePedidosDeIa],
    },
  ],
})
export class GovernancaModule {}
