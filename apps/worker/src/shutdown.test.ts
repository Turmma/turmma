import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { SHUTDOWN_GRACE_MS } from './composition.js'

// O desligamento do worker depende de dois números que moram em arquivos diferentes: a graça que o `encerrar` dá aos jobs em
// andamento (código) e o tempo que o Docker espera antes do SIGKILL (`infra/compose.yml`). Se o segundo for menor que o primeiro,
// o SIGKILL chega antes de o `interromper()` gravar `EXECUCAO_INTERROMPIDA` e liberar a vaga, e o job fica `ativo` sem ninguém
// que o retome além do stalled (R55, RF17).

const compose = parse(readFileSync(new URL('../../../infra/compose.yml', import.meta.url), 'utf8'), { merge: true }) as {
  services: Record<string, { stop_grace_period?: string }>
}

const segundos = (duracao: string): number => {
  const lida = /^(\d+)s$/.exec(duracao)
  expect(lida, `duração "${duracao}" não está em segundos`).not.toBeNull()
  return Number(lida?.[1])
}

describe('o desligamento do worker', () => {
  it('a graça é de 20 s: o job que passa dela é interrompido, e a espera por ele não prende o deploy', () => {
    expect(SHUTDOWN_GRACE_MS).toBe(20_000)
  })

  it('o Docker espera mais que a graça antes do SIGKILL, em toda réplica do worker', () => {
    const workers = Object.entries(compose.services).filter(([nome]) => nome.startsWith('worker-'))
    expect(workers.map(([nome]) => nome).sort()).toEqual(['worker-interativo-1', 'worker-interativo-2', 'worker-lote-1', 'worker-lote-2'])
    for (const [nome, servico] of workers) {
      expect(servico.stop_grace_period, `${nome} declara o stop_grace_period`).toBeDefined()
      expect(segundos(servico.stop_grace_period ?? ''), nome).toBeGreaterThan(SHUTDOWN_GRACE_MS / 1_000)
    }
  })
})
