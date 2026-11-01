import 'reflect-metadata'
import { createLogger, startTelemetry, NestLogger, registerProcessErrorHandlers } from '@educa/core'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { loadConfig } from './config.js'

const config = loadConfig(process.env)
const logger = createLogger({ servico: 'worker' })
registerProcessErrorHandlers(logger)
// Antes da montagem: toda métrica nasce do medidor que exporta.
const telemetria = startTelemetry('worker', config.telemetria)
// Sem HTTP: o healthcheck do compose lê o batimento que o worker grava enquanto o event loop anda.
const app = await NestFactory.createApplicationContext(AppModule.forRoot(config, logger, telemetria.medidor), { bufferLogs: true })
app.useLogger(new NestLogger(logger))
// `useProcessExit`: o Node é o PID 1 do container e ignoraria o sinal que o Nest reenvia a si mesmo.
app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true })
logger.info({ evento: 'worker.iniciado' })
