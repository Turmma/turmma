import { Heartbeat, type LoggerBase, type Meter } from '@educa/core'
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { WorkerConfig } from './config.js'
import { createWorker, type WorkerRuntime } from './composition.js'

/** No SIGTERM, fecha o worker com graça antes de o processo sair. */
class WorkerLifecycle implements OnApplicationShutdown {
  constructor(private readonly montado: WorkerRuntime) {}

  onApplicationShutdown(): Promise<void> {
    return this.montado.encerrar()
  }
}

@Module({})
export class AppModule {
  static forRoot(config: WorkerConfig, logger: LoggerBase, medidor: Meter): DynamicModule {
    const montado = createWorker(config, logger, { batimento: new Heartbeat(), medidor })
    return {
      module: AppModule,
      providers: [{ provide: WorkerLifecycle, useValue: new WorkerLifecycle(montado) }],
    }
  }
}
