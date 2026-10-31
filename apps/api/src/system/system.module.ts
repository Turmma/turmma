import { JobOutbox, JobOutboxRepository, type Environment, type Database } from '@educa/core'
import type { Aviso } from '@educa/shared'
import { Module, type DynamicModule } from '@nestjs/common'
import { BANCO } from '../database.module.js'
import { AVISOS_DO_SISTEMA, AvisosController } from './notices.controller.js'
import { ContextoController } from './context.controller.js'
import { EstadoController } from './status.controller.js'
import { AMBIENTE_DO_SISTEMA, EstadoService, RELOGIO_DO_ESTADO, VERSAO_DO_SISTEMA } from './status.service.js'
import { JobsSinteticosConsultaController, JobsSinteticosController } from './synthetic-jobs.controller.js'
import { JobsSinteticosService } from './synthetic-jobs.service.js'
import { SaudeController } from './health.controller.js'
import { SaudeService } from './health.service.js'

@Module({})
export class SistemaModule {
  /**
   * Com `rotasSinteticas` desligado, o `POST` de job sintético nem é registrado: a rota responde o
   * mesmo 404 de qualquer rota inexistente, com ou sem token.
   */
  static com(opcoes: { rotasSinteticas: boolean; versao: string; ambiente: Environment; avisos: readonly Aviso[] }): DynamicModule {
    return {
      module: SistemaModule,
      controllers: [
        SaudeController,
        EstadoController,
        AvisosController,
        ContextoController,
        JobsSinteticosConsultaController,
        ...(opcoes.rotasSinteticas ? [JobsSinteticosController] : []),
      ],
      providers: [
        SaudeService,
        EstadoService,
        { provide: VERSAO_DO_SISTEMA, useValue: opcoes.versao },
        { provide: AMBIENTE_DO_SISTEMA, useValue: opcoes.ambiente },
        { provide: RELOGIO_DO_ESTADO, useValue: () => new Date() },
        { provide: AVISOS_DO_SISTEMA, useValue: opcoes.avisos },
        JobsSinteticosService,
        { provide: JobOutboxRepository, useFactory: (banco: Database) => new JobOutboxRepository(banco), inject: [BANCO] },
        { provide: JobOutbox, useFactory: (repositorio: JobOutboxRepository) => new JobOutbox(repositorio), inject: [JobOutboxRepository] },
      ],
    }
  }
}
