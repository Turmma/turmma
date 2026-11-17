import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O `globalSetup` da integração contra um Docker falso: o que se prova é a fiação (quem recusa, quem não recusa, e o que
// roda depois), e o Docker de verdade está fora (regra 40). A regra de recusa em si está em `workers-de-pe.test.ts`.
const { spawnSync, migrate } = vi.hoisted(() => ({ spawnSync: vi.fn(), migrate: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync }))
vi.mock('../../packages/core/src/db/migrate.ts', () => ({ migrate }))

const { default: subirInfra } = await import('./integracao.setup.ts')

/** O `ps` de um ambiente que o `e2e --manter-ambiente` deixou de pé. */
const E2E_DE_PE = 'api-1\npostgres\nworker-pdf\n'

function dockerComServicosDePe(saida: string): void {
  spawnSync.mockImplementation((_comando: string, argumentos: string[]) => ({ status: 0, stdout: argumentos.includes('ps') ? saida : '', stderr: '' }))
}

/** Os argumentos de cada chamada ao Docker, na ordem em que saíram. */
function comandosDoDocker(): string[][] {
  return spawnSync.mock.calls.map((chamada) => chamada[1] as string[])
}

describe('subirInfra: a recusa dos workers de pé', () => {
  beforeEach(() => {
    spawnSync.mockReset()
    migrate.mockReset()
    // O portão roda o `npm run test` com `EDUCA_BANCO_NOVO=1`: o ambiente é fixado, e cada caso escolhe o seu.
    vi.stubEnv('EDUCA_BANCO_NOVO', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('na integração recusa com worker de pé, e não migra nem derruba nada depois do `ps`', async () => {
    dockerComServicosDePe(E2E_DE_PE)

    await expect(subirInfra({ name: 'integracao' })).rejects.toThrow('worker-pdf')

    expect(migrate).not.toHaveBeenCalled()
    const comandos = comandosDoDocker()
    const depoisDoPs = comandos.slice(comandos.findIndex((argumentos) => argumentos.includes('ps')) + 1)
    expect(depoisDoPs.some((argumentos) => argumentos.includes('stop') || argumentos.includes('down'))).toBe(false)
  })

  it('com `EDUCA_BANCO_NOVO=1` o `down` vem antes do `ps`: a conferência é depois da subida', async () => {
    vi.stubEnv('EDUCA_BANCO_NOVO', '1')
    dockerComServicosDePe('postgres\n')

    await subirInfra({ name: 'integracao' })

    const comandos = comandosDoDocker()
    const posicaoDoDown = comandos.findIndex((argumentos) => argumentos.includes('down'))
    const posicaoDoPs = comandos.findIndex((argumentos) => argumentos.includes('ps'))
    expect(posicaoDoDown).toBeGreaterThanOrEqual(0)
    expect(posicaoDoPs).toBeGreaterThan(posicaoDoDown)
  })

  it('sem o projeto no argumento recusa do mesmo jeito: o lado que não deixa passar', async () => {
    dockerComServicosDePe(E2E_DE_PE)

    await expect(subirInfra()).rejects.toThrow('worker-pdf')
  })

  it('no infra convive com os workers: sobe e migra', async () => {
    dockerComServicosDePe(E2E_DE_PE)

    await subirInfra({ name: 'infra' })

    expect(migrate).toHaveBeenCalledTimes(1)
  })

  it('o `ps` que o sinal matou (status nulo, saída vazia) é falha, e não "nada de pé"', async () => {
    spawnSync.mockImplementation((_comando: string, argumentos: string[]) =>
      argumentos.includes('ps') ? { status: null, signal: 'SIGKILL', stdout: '', stderr: '' } : { status: 0, stdout: '', stderr: '' },
    )

    await expect(subirInfra({ name: 'integracao' })).rejects.toThrow('Não foi possível listar')

    expect(migrate).not.toHaveBeenCalled()
  })

  it('o Docker ausente (status, saída e erro nulos) também diz que não conseguiu listar', async () => {
    spawnSync.mockImplementation((_comando: string, argumentos: string[]) =>
      argumentos.includes('ps') ? { status: null, stdout: null, stderr: null } : { status: 0, stdout: '', stderr: '' },
    )

    await expect(subirInfra({ name: 'integracao' })).rejects.toThrow('Não foi possível listar')
  })

  it('na integração sem worker de pé sobe e migra', async () => {
    dockerComServicosDePe('postgres\nredis-fila\n')

    await subirInfra({ name: 'integracao' })

    expect(migrate).toHaveBeenCalledTimes(1)
  })
})
