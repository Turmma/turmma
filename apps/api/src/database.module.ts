import { createDatabase, createPool, type DatabaseConfig, type DatabasePool } from '@educa/core'
import { Global, Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'

export const DB_POOL = Symbol('DB_POOL')
/** Drizzle sobre o mesmo pool. Só repository o recebe (regra 00, item 3). */
export const DB = Symbol('DB')

@Global()
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  private static readonly logger = new Logger('banco')

  static forRoot(config: DatabaseConfig): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DB_POOL,
          useFactory: () => createPool(config, () => DatabaseModule.logger.warn('banco.conexao_ociosa_perdida')),
        },
        { provide: DB, useFactory: createDatabase, inject: [DB_POOL] },
      ],
      exports: [DB_POOL, DB],
    }
  }

  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}
