import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { UsageMeter } from './usage-meter.js'

/**
 * Conta a requisição na escola do token, antes de o handler rodar e sem esperar o Redis. Interceptor
 * roda depois das guardas: a rota anônima não tem escola e não conta, e a requisição recusada pela
 * autenticação ou pelo rate limit não chega aqui.
 */
export class UsageInterceptor implements NestInterceptor {
  constructor(private readonly contador: Pick<UsageMeter, 'marcar'>) {}

  intercept(_contexto: ExecutionContext, proximo: CallHandler): ReturnType<CallHandler['handle']> {
    this.contador.marcar('req')
    return proximo.handle()
  }
}
