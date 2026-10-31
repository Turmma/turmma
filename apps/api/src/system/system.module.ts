import { JobOutbox, JobOutboxRepository, type Environment, type Database } from '@educa/core'
import type { Aviso } from '@educa/shared'
import { Module, type DynamicModule } from '@nestjs/common'
import { DB } from '../database.module.js'
import { SYSTEM_NOTICES, NoticesController } from './notices.controller.js'
import { ContextController } from './context.controller.js'
import { StatusController } from './status.controller.js'
import { SYSTEM_ENVIRONMENT, StatusService, STATUS_CLOCK, SYSTEM_VERSION } from './status.service.js'
import { SyntheticJobsQueryController, SyntheticJobsController } from './synthetic-jobs.controller.js'
import { SyntheticJobsService } from './synthetic-jobs.service.js'
import { HealthController } from './health.controller.js'
import { HealthService } from './health.service.js'

@Module({})
export class SystemModule {
  /**
   * Com `rotasSinteticas` desligado, o `POST` de job sintético nem é registrado: a rota responde o
   * mesmo 404 de qualquer rota inexistente, com ou sem token.
   */
  static forRoot(opcoes: { rotasSinteticas: boolean; versao: string; ambiente: Environment; avisos: readonly Aviso[] }): DynamicModule {
    return {
      module: SystemModule,
      controllers: [
        HealthController,
        StatusController,
        NoticesController,
        ContextController,
        SyntheticJobsQueryController,
        ...(opcoes.rotasSinteticas ? [SyntheticJobsController] : []),
      ],
      providers: [
        HealthService,
        StatusService,
        { provide: SYSTEM_VERSION, useValue: opcoes.versao },
        { provide: SYSTEM_ENVIRONMENT, useValue: opcoes.ambiente },
        { provide: STATUS_CLOCK, useValue: () => new Date() },
        { provide: SYSTEM_NOTICES, useValue: opcoes.avisos },
        SyntheticJobsService,
        { provide: JobOutboxRepository, useFactory: (banco: Database) => new JobOutboxRepository(banco), inject: [DB] },
        { provide: JobOutbox, useFactory: (repositorio: JobOutboxRepository) => new JobOutbox(repositorio), inject: [JobOutboxRepository] },
      ],
    }
  }
}
