import 'reflect-metadata'
import {
  createPool,
  GracefulShutdown,
  AllExceptionsFilter,
  NestLogger,
  globalMeter,
  contextMiddleware,
  httpMetricsMiddleware,
  observeRealtimeConnections,
  observeDatabasePool,
  observeRedis,
  summarizeError,
  type LoggerBase,
  type Meter,
} from '@educa/core'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AdaptadorSocketIoComRedis, criarClienteRedisDoRealtime } from './redis-adapter.js'
import { AppModule } from './app.module.js'
import type { ConfiguracaoRealtime } from './config.js'

/**
 * Monta uma instância do realtime: Redis de fila conectado, pool do Postgres para o handshake ler a
 * sessão, socket.io com o adaptador de streams, contexto de requisição, log JSON, erro tipado e métricas
 * (duração por rota, conexões abertas, Redis, pool do banco). O boot e os testes de integração passam por
 * aqui, para provar a mesma ligação que sobe no container.
 */
export async function criarAplicacaoRealtime(config: ConfiguracaoRealtime, logger: LoggerBase, medidor: Meter = globalMeter()): Promise<NestExpressApplication> {
  const cliente = criarClienteRedisDoRealtime(config.redis.url, (erro) =>
    logger.warn({ evento: 'realtime.redis_indisponivel', erro: summarizeError(erro) }),
  )
  await cliente.connect()
  const pool = createPool(config.banco, () => logger.warn({ evento: 'realtime.conexao_ociosa_perdida' }))
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config, cliente, pool, logger), { bufferLogs: true })
  app.use(contextMiddleware)
  app.use(httpMetricsMiddleware(medidor))
  app.useLogger(new NestLogger(logger))
  app.useGlobalFilters(new AllExceptionsFilter(logger))
  const adaptador = new AdaptadorSocketIoComRedis(app, cliente, config.redis.tamanhoMaximoDoStream)
  app.useWebSocketAdapter(adaptador)
  observeRealtimeConnections(medidor, () => adaptador.conexoesAbertas())
  observeRedis(medidor, { fila: [cliente] })
  observeDatabasePool(medidor, pool)
  app.disable('x-powered-by')
  app.get(GracefulShutdown).prepararServidor(app.getHttpServer())
  return app
}
