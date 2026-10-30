import { spawnSync } from 'node:child_process'
import { createLogger } from '../../packages/nucleo/src/log/logger.ts'
import { migrate } from '../../packages/nucleo/src/db/migrar.ts'
import { ARGUMENTOS_COMPOSE, comandosDaSubidaDeTeste, urlDoBancoDeTeste } from '../ci/compose.ts'
import { raizRepositorio } from '../ci/executar.ts'

// A URL do banco de teste mora em `tools/ci/compose.ts` desde a 18.0: o seed do e2e também precisa dela, e o
// Playwright não carrega este arquivo, que sobe o compose.
export { urlDoBancoDeTeste }

/**
 * Garante Postgres, Redis e storage de pé antes da integração, e o banco com as migrations
 * aplicadas pelo mesmo `migrar` do serviço do compose. Idempotente se já estiverem; com
 * `EDUCA_BANCO_NOVO=1` (o portão local), derruba o projeto de teste com os volumes antes.
 */
export default async function subirInfra(): Promise<void> {
  for (const argumentos of comandosDaSubidaDeTeste(process.env)) {
    const resultado = spawnSync('docker', [...ARGUMENTOS_COMPOSE, ...argumentos], { cwd: raizRepositorio, stdio: 'inherit' })
    if (resultado.status !== 0) {
      throw new Error(`Não foi possível rodar \`docker compose ${argumentos[0] ?? ''}\` na infraestrutura de teste.`)
    }
  }
  await migrate({ url: urlDoBancoDeTeste(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 60_000 }, createLogger({ servico: 'migrar-teste', nivel: 'warn' }))
}
