import type { Database } from '@educa/core'
import { Module } from '@nestjs/common'
import { BANCO } from '../banco.module.js'
import { EntregaController } from './entrega.controller.js'
import { EntregaService } from './entrega.service.js'

/** As entregas pendentes e a decisão do professor sobre elas (MVP, A2; regra 70, item 3). */
@Module({
  controllers: [EntregaController],
  providers: [{ provide: EntregaService, useFactory: (banco: Database) => new EntregaService(banco), inject: [BANCO] }],
})
export class EntregaModule {}
