import 'reflect-metadata'
import { createLogger, startTelemetry, RateLimiter, observeDatabasePool, observeRedis, observeInsuranceLimiter, registerProcessErrorHandlers } from '@educa/core'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { POOL_BANCO } from './banco.module.js'
import { lerConfiguracao } from './config.js'
import { configurarAplicacao } from './configurar-app.js'
import { CLIENTE_REDIS_CACHE } from './limite.module.js'
import { CLIENTE_REDIS_LOGIN, SeguroDoLogin } from './credencial/index.js'
import { LimitesDaSala } from './sala/limites-da-sala.js'
import { CLIENTE_REDIS_USO } from './uso.module.js'

const config = lerConfiguracao(process.env)
const logger = createLogger({ servico: 'api' })
registerProcessErrorHandlers(logger)
// Antes da aplicação: toda métrica nasce do medidor que exporta.
const { medidor } = startTelemetry('api', config.telemetria)
// `bufferLogs` segura o log do boot até o logger JSON estar ligado.
const app = await NestFactory.create<NestExpressApplication>(AppModule.com(config, { logger }), { bufferLogs: true })
configurarAplicacao(app, logger, medidor)
observeDatabasePool(medidor, app.get(POOL_BANCO))
observeRedis(medidor, { cache: [app.get(CLIENTE_REDIS_CACHE)], fila: [app.get(CLIENTE_REDIS_USO), app.get(CLIENTE_REDIS_LOGIN)] })
// O rate limit no Redis de cache e, no Redis de fila, os contadores e o desafio do login e os limites da sala: vale o que
// estiver no seguro.
observeInsuranceLimiter(medidor, app.get(RateLimiter), app.get(SeguroDoLogin), app.get(LimitesDaSala))
app.disable('x-powered-by')
// SIGTERM drena antes de sair (GracefulShutdown, em @educa/core). `useProcessExit`: o Node é o PID 1 do
// container e ignoraria o sinal que o Nest reenvia a si mesmo no fim.
app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true })
await app.listen(config.porta, '0.0.0.0')
