import { pingDatabase, type DatabasePool } from '@educa/core'
import type { HealthResponse } from '@educa/shared'
import { Inject, Injectable } from '@nestjs/common'
import { DB_POOL } from '../database.module.js'

@Injectable()
export class HealthService {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  async verify(): Promise<HealthResponse> {
    return { ok: await pingDatabase(this.pool) }
  }
}
