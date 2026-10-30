import { createDatabase, createPool, type DatabaseConfig, type DatabasePool } from '@educa/nucleo'
import { Global, Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'

export const POOL_BANCO = Symbol('POOL_BANCO')
/** Drizzle sobre o mesmo pool. Só repository o recebe (regra 00, item 3). */
export const BANCO = Symbol('BANCO')

@Global()
@Module({})
export class BancoModule implements OnApplicationShutdown {
  private static readonly logger = new Logger('banco')

  static com(config: DatabaseConfig): DynamicModule {
    return {
      module: BancoModule,
      providers: [
        {
          provide: POOL_BANCO,
          useFactory: () => createPool(config, () => BancoModule.logger.warn('banco.conexao_ociosa_perdida')),
        },
        { provide: BANCO, useFactory: createDatabase, inject: [POOL_BANCO] },
      ],
      exports: [POOL_BANCO, BANCO],
    }
  }

  constructor(@Inject(POOL_BANCO) private readonly pool: DatabasePool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}
