import type { Database, OrcamentoDeIa, SuspensaoDeFuncao } from '@educa/core'
import { Module } from '@nestjs/common'
import { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { DB } from '../database.module.js'
import { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO } from '../ia/ia.module.js'
import { TrechoSearch } from '../material/trecho-search.js'
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
      useFactory: (banco: Database, agendador: ExecucaoScheduler, limite: IaRequestRateLimit, trechos: TrechoSearch, orcamento: OrcamentoDeIa, suspensao: SuspensaoDeFuncao) =>
        new TutorService(banco, agendador, limite, trechos, orcamento, suspensao),
      inject: [DB, ExecucaoScheduler, IaRequestRateLimit, TrechoSearch, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO],
    },
    { provide: SupervisaoDoTutorService, useFactory: (banco: Database) => new SupervisaoDoTutorService(banco), inject: [DB] },
  ],
})
export class TutorModule {}
