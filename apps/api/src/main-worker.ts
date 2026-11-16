import 'reflect-metadata'
import { createLogger, startTelemetry, NestLogger, registerProcessErrorHandlers } from '@educa/core'
import { NestFactory } from '@nestjs/core'
import { loadWorkerConfig } from './worker-config.js'
import { WorkerModule } from './worker.module.js'

/**
 * O `main-worker` (X6, 5.0): a IA roda aqui, não na API. Consome os jobs `ia.executar` das filas `api-*` e conclui cada execução
 * uma vez só. Não tem controller nem porta: o healthcheck do compose lê o batimento que o processo grava enquanto o event loop anda.
 */
const config = loadWorkerConfig(process.env)
const logger = createLogger({ servico: 'worker-ia' })
registerProcessErrorHandlers(logger)
// Antes da montagem: toda métrica nasce do medidor que exporta.
const telemetria = startTelemetry('worker', config.telemetria)
const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config, logger, telemetria.medidor), { bufferLogs: true })
app.useLogger(new NestLogger(logger))
// `useProcessExit`: o Node é o PID 1 do container e ignoraria o sinal que o Nest reenvia a si mesmo.
app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true })
logger.info({ evento: 'worker_ia.iniciado' })
