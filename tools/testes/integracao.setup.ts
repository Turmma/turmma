import { spawnSync } from 'node:child_process'
import { createLogger } from '../../packages/core/src/log/logger.ts'
import { migrate } from '../../packages/core/src/db/migrate.ts'
import { ARGUMENTOS_COMPOSE, comandosDaSubidaDeTeste, servicosDeJob, urlDoBancoDeTeste } from '../ci/compose.ts'
import { raizRepositorio } from '../ci/executar.ts'
import { recusarJobDePe, type ResultadoDoPs } from './workers-de-pe.ts'

// A URL do banco de teste mora em `tools/ci/compose.ts` desde a 18.0: o seed do e2e também precisa dela, e o
// Playwright não carrega este arquivo, que sobe o compose.
export { urlDoBancoDeTeste }

const NOME_DO_PROJETO_DA_INFRA = 'infra'

function listarServicosDePe(): ResultadoDoPs {
  const resultado = spawnSync('docker', [...ARGUMENTOS_COMPOSE, 'ps', '--status', 'running', '--services'], { cwd: raizRepositorio, encoding: 'utf8' })
  // Sem `status` o Docker nem rodou (não está instalado, ou o processo morreu por sinal): é falha, e não "nada de pé".
  // Sem o Docker, o `spawnSync` devolve `stderr` nulo, apesar do tipo.
  return { codigo: resultado.status ?? 1, saida: resultado.stdout, erro: resultado.stderr ?? '' }
}

/**
 * Garante Postgres, Redis e storage de pé antes da integração, e o banco com as migrations
 * aplicadas pelo mesmo `migrar` do serviço do compose. Idempotente se já estiverem; com
 * `EDUCA_BANCO_NOVO=1` (o portão local), derruba o projeto de teste com os volumes antes.
 *
 * No projeto `integracao`, recusa com despachante ou worker de pé (`recusarJobDePe`): eles consomem o job que o teste
 * enfileirou. O `infra` não recusa: vem depois do e2e, que deixa o ambiente completo de pé (`--manter-ambiente`), e os
 * testes dele convivem com os workers. Quando o projeto não vem no argumento, recusa: é o lado que não deixa passar.
 */
export default async function subirInfra(projeto?: { name?: string }): Promise<void> {
  for (const argumentos of comandosDaSubidaDeTeste(process.env)) {
    const resultado = spawnSync('docker', [...ARGUMENTOS_COMPOSE, ...argumentos], { cwd: raizRepositorio, stdio: 'inherit' })
    if (resultado.status !== 0) {
      throw new Error(`Não foi possível rodar \`docker compose ${argumentos[0] ?? ''}\` na infraestrutura de teste.`)
    }
  }
  if (projeto?.name !== NOME_DO_PROJETO_DA_INFRA) recusarJobDePe({ ps: listarServicosDePe, servicosDeJob: servicosDeJob(), docker: ['docker', ...ARGUMENTOS_COMPOSE] })
  await migrate({ url: urlDoBancoDeTeste(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 60_000 }, createLogger({ servico: 'migrar-teste', nivel: 'warn' }))
}
