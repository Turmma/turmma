import type { Database } from '@educa/core'
import { Module } from '@nestjs/common'
import { BANCO } from '../database.module.js'
import { ProfessoresController } from './professores.controller.js'
import { ProfessoresService } from './professores.service.js'

/** Os professores da escola que a coordenação cadastra e convida (A1, tarefa 3.0). */
@Module({
  controllers: [ProfessoresController],
  providers: [{ provide: ProfessoresService, useFactory: (banco: Database) => new ProfessoresService(banco), inject: [BANCO] }],
})
export class ProfessoresModule {}
