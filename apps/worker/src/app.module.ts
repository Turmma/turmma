import { Heartbeat, type LoggerBase, type Meter } from '@educa/core'
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { ConfiguracaoWorker } from './config.js'
import { montarWorker, type WorkerMontado } from './composition.js'

/** No SIGTERM, fecha o worker com graça antes de o processo sair. */
class CicloDoWorker implements OnApplicationShutdown {
  constructor(private readonly montado: WorkerMontado) {}

  onApplicationShutdown(): Promise<void> {
    return this.montado.encerrar()
  }
}

@Module({})
export class AppModule {
  static forRoot(config: ConfiguracaoWorker, logger: LoggerBase, medidor: Meter): DynamicModule {
    const montado = montarWorker(config, logger, { batimento: new Heartbeat(), medidor })
    return {
      module: AppModule,
      providers: [{ provide: CicloDoWorker, useValue: new CicloDoWorker(montado) }],
    }
  }
}
