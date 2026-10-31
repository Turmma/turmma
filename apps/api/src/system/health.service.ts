import { pingDatabase, type DatabasePool } from '@educa/core'
import type { HealthResponse } from '@educa/shared'
import { Inject, Injectable } from '@nestjs/common'
import { POOL_BANCO } from '../database.module.js'

@Injectable()
export class SaudeService {
  constructor(@Inject(POOL_BANCO) private readonly pool: DatabasePool) {}

  async verificar(): Promise<HealthResponse> {
    return { ok: await pingDatabase(this.pool) }
  }
}
