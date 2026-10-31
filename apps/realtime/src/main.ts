import 'reflect-metadata'
import { createLogger, startTelemetry, registerProcessErrorHandlers } from '@educa/core'
import { loadConfig } from './config.js'
import { createRealtimeApp } from './configure-app.js'

const config = loadConfig(process.env)
const logger = createLogger({ servico: 'realtime' })
registerProcessErrorHandlers(logger)
// Antes da aplicação: toda métrica nasce do medidor que exporta.
const { medidor } = startTelemetry('realtime', config.telemetria)
const app = await createRealtimeApp(config, logger, medidor)
// SIGTERM drena antes de sair (GracefulShutdown, em @educa/core): a borda tira a instância, e só então o
// socket.io fecha e os clientes reconectam na outra. `useProcessExit`: o Node é o PID 1 do container.
app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true })
await app.listen(config.porta, '0.0.0.0')
