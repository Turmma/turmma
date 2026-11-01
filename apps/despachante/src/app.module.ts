import { Heartbeat, type LoggerBase, type Meter } from '@educa/core'
import { Module, type DynamicModule, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common'
import type { DespachanteConfig } from './config.js'
import { createOutboxRelay, type OutboxRelayRuntime } from './composition.js'

/** Liga os laços ao ciclo do Nest: começam depois do boot, e no SIGTERM terminam a rodada antes de sair. */
class OutboxRelayLifecycle implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(private readonly montado: OutboxRelayRuntime) {}

  onApplicationBootstrap(): void {
    this.montado.iniciar()
  }

  onApplicationShutdown(): Promise<void> {
    return this.montado.encerrar()
  }
}

@Module({})
export class AppModule {
  static forRoot(config: DespachanteConfig, logger: LoggerBase, medidor: Meter): DynamicModule {
    return {
      module: AppModule,
      providers: [{ provide: OutboxRelayLifecycle, useValue: new OutboxRelayLifecycle(createOutboxRelay(config, logger, { batimento: new Heartbeat(), medidor })) }],
    }
  }
}
