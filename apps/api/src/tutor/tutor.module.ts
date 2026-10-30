import type { Database, OrcamentoDeIa, SuspensaoDeFuncao } from '@educa/nucleo'
import { Module } from '@nestjs/common'
import { LimiteDePedidosDeIa } from '../assistente/limite-de-pedidos-de-ia.js'
import { BANCO } from '../banco.module.js'
import { AgendadorDeExecucoes } from '../ia/agendador-de-execucoes.js'
import { ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO } from '../ia/ia.module.js'
import { BuscaDeTrechos } from '../material/busca-de-trechos.js'
import { SinaisController } from './sinais.controller.js'
import { SupervisaoDoTutorService } from './supervisao.service.js'
import { TutorController } from './tutor.controller.js'
import { TutorService } from './tutor.service.js'

/**
 * O Tutor e os sinais (MVP, A4; D8, D34, D36, D38, D47, D66): a conversa e a memória do aluno, e o que o professor da
 * turma vê dela (sinais e uso). O limite dos pedidos de IA vem do `AssistenteModule`, a busca de trechos, do
 * `MaterialModule`, e o agendador, o orçamento e a suspensão, do `IaModule`, todos globais.
 */
@Module({
  controllers: [TutorController, SinaisController],
  providers: [
    {
      provide: TutorService,
      useFactory: (banco: Database, agendador: AgendadorDeExecucoes, limite: LimiteDePedidosDeIa, trechos: BuscaDeTrechos, orcamento: OrcamentoDeIa, suspensao: SuspensaoDeFuncao) =>
        new TutorService(banco, agendador, limite, trechos, orcamento, suspensao),
      inject: [BANCO, AgendadorDeExecucoes, LimiteDePedidosDeIa, BuscaDeTrechos, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO],
    },
    { provide: SupervisaoDoTutorService, useFactory: (banco: Database) => new SupervisaoDoTutorService(banco), inject: [BANCO] },
  ],
})
export class TutorModule {}
