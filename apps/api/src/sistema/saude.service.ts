import { bancoResponde, type PoolBanco } from '@educa/nucleo'
import type { HealthResponse } from '@educa/shared'
import { Inject, Injectable } from '@nestjs/common'
import { POOL_BANCO } from '../banco.module.js'

@Injectable()
export class SaudeService {
  constructor(@Inject(POOL_BANCO) private readonly pool: PoolBanco) {}

  async verificar(): Promise<HealthResponse> {
    return { ok: await bancoResponde(this.pool) }
  }
}
