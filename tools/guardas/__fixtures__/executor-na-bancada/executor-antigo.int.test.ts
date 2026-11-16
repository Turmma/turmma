import { type InProcessAgenteExecutor } from '@educa/core'

export const antigo = (app: { get: <T>(token: symbol) => T }, token: symbol) => app.get<InProcessAgenteExecutor>(token)
