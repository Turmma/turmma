import type { Database, OrcamentoDeIa } from '@educa/core'
import { Module, type DynamicModule } from '@nestjs/common'
import { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { DB } from '../database.module.js'
import { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { ORCAMENTO_DE_IA } from '../ia/ia.module.js'
import { SinaisController } from './sinais.controller.js'
import { SupervisaoDoTutorService } from './supervisao.service.js'
import { TutorController } from './tutor.controller.js'
import { AlcanceDoAluno } from './turno.command.js'
import { TutorService } from './tutor.service.js'

/**
 * O Tutor e os sinais (MVP, A4; D8, D34, D36, D38, D47, D66): a conversa e a memória do aluno, e o que o professor da
 * turma vê dela (sinais e uso). O limite dos pedidos de IA vem do `AssistenteModule`, o agendador, o orçamento e a suspensão, do
 * `IaModule`, e o comando do turno e a `AlcanceDoAluno`, do `ComandosDeIaModule`, todos globais.
 */
@Module({})
export class TutorModule {
  static forRoot(): DynamicModule {
    return {
      module: TutorModule,
      controllers: [TutorController, SinaisController],
      providers: [
        {
          provide: TutorService,
          useFactory: (banco: Database, agendador: ExecucaoScheduler, limite: IaRequestRateLimit, orcamento: OrcamentoDeIa, alcance: AlcanceDoAluno) => new TutorService(banco, agendador, limite, orcamento, alcance),
          inject: [DB, ExecucaoScheduler, IaRequestRateLimit, ORCAMENTO_DE_IA, AlcanceDoAluno],
        },
        { provide: SupervisaoDoTutorService, useFactory: (banco: Database) => new SupervisaoDoTutorService(banco), inject: [DB] },
      ],
    }
  }
}
