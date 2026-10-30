import 'reflect-metadata'
import { createLogger, startTelemetry, NestLogger, registerProcessErrorHandlers } from '@educa/nucleo'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { lerConfiguracao } from './config.js'

const config = lerConfiguracao(process.env)
const logger = createLogger({ servico: 'despachante' })
registerProcessErrorHandlers(logger)
// Antes da montagem: toda métrica nasce do medidor que exporta.
const telemetria = startTelemetry('despachante', config.telemetria)
// Sem HTTP: o healthcheck do compose lê o batimento que o laço grava a cada rodada.
const app = await NestFactory.createApplicationContext(AppModule.com(config, logger, telemetria.medidor), { bufferLogs: true })
app.useLogger(new NestLogger(logger))
// `useProcessExit`: o Node é o PID 1 do container e ignoraria o sinal que o Nest reenvia a si mesmo.
app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true })
logger.info({ evento: 'despachante.iniciado' })
