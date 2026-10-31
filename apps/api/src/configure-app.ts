import { GracefulShutdown, AllExceptionsFilter, NestLogger, globalMeter, contextMiddleware, httpMetricsMiddleware, type LoggerBase, type Meter } from '@educa/core'
import type { INestApplication } from '@nestjs/common'

/**
 * Tudo que toda instância da API precisa antes de atender: contexto da requisição, log JSON,
 * erro tipado, duração por rota e servidor HTTP pronto para a drenagem. Os testes de integração montam a aplicação
 * por aqui, para provar a mesma ligação que sobe em produção.
 */
export function configureApp(app: INestApplication, logger: LoggerBase, medidor: Meter = globalMeter()): void {
  // Primeiro middleware: o contexto precisa existir antes do body parser, cujo erro também
  // chega ao filtro com o `requisicaoId`.
  app.use(contextMiddleware)
  // Logo depois: toda requisição é medida, inclusive a recusada pela guarda e a que não casou rota.
  app.use(httpMetricsMiddleware(medidor))
  app.useLogger(new NestLogger(logger))
  app.useGlobalFilters(new AllExceptionsFilter(logger))
  // Atrás da borda, e com o fechamento dentro do prazo da drenagem.
  app.get(GracefulShutdown).prepararServidor(app.getHttpServer())
}
