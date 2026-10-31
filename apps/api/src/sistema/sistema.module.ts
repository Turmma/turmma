import { JobOutbox, JobOutboxRepository, type Environment, type Database } from '@educa/core'
import type { Aviso } from '@educa/shared'
import { Module, type DynamicModule } from '@nestjs/common'
import { BANCO } from '../banco.module.js'
import { AVISOS_DO_SISTEMA, AvisosController } from './avisos.controller.js'
import { ContextoController } from './contexto.controller.js'
import { EstadoController } from './estado.controller.js'
import { AMBIENTE_DO_SISTEMA, EstadoService, RELOGIO_DO_ESTADO, VERSAO_DO_SISTEMA } from './estado.service.js'
import { JobsSinteticosConsultaController, JobsSinteticosController } from './jobs-sinteticos.controller.js'
import { JobsSinteticosService } from './jobs-sinteticos.service.js'
import { SaudeController } from './saude.controller.js'
import { SaudeService } from './saude.service.js'

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
