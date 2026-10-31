import 'reflect-metadata'
import { createLogger, startTelemetry, RateLimiter, observeDatabasePool, observeRedis, observeInsuranceLimiter, registerProcessErrorHandlers } from '@educa/core'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { DB_POOL } from './database.module.js'
import { loadConfig } from './config.js'
import { configureApp } from './configure-app.js'
import { REDIS_CACHE_CLIENT } from './rate-limit.module.js'
import { REDIS_LOGIN_CLIENT, LoginFallbackTracker } from './credencial/index.js'
import { SalaRateLimits } from './sala/sala-rate-limits.js'
import { REDIS_USAGE_CLIENT } from './usage.module.js'

const config = loadConfig(process.env)
const logger = createLogger({ servico: 'api' })
registerProcessErrorHandlers(logger)
// Antes da aplicação: toda métrica nasce do medidor que exporta.
const { medidor } = startTelemetry('api', config.telemetria)
// `bufferLogs` segura o log do boot até o logger JSON estar ligado.
const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config, { logger }), { bufferLogs: true })
configureApp(app, logger, medidor)
observeDatabasePool(medidor, app.get(DB_POOL))
observeRedis(medidor, { cache: [app.get(REDIS_CACHE_CLIENT)], fila: [app.get(REDIS_USAGE_CLIENT), app.get(REDIS_LOGIN_CLIENT)] })
// O rate limit no Redis de cache e, no Redis de fila, os contadores e o desafio do login e os limites da sala: vale o que
// estiver no seguro.
observeInsuranceLimiter(medidor, app.get(RateLimiter), app.get(LoginFallbackTracker), app.get(SalaRateLimits))
app.disable('x-powered-by')
// SIGTERM drena antes de sair (GracefulShutdown, em @educa/core). `useProcessExit`: o Node é o PID 1 do
// container e ignoraria o sinal que o Nest reenvia a si mesmo no fim.
app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true })
await app.listen(config.porta, '0.0.0.0')
