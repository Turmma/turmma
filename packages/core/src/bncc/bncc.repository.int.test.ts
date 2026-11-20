import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../tools/testes/integracao.setup.ts'
import { createDatabase, type Database } from '../db/database.js'
import { createPool, type DatabasePool } from '../db/pool.js'
import { BnccRepository } from './bncc.repository.js'

/**
 * A leitura única da tabela pública da BNCC (correção `bncc-repository-unico`; regra 10, item 1): contra a carga `dados-2026.08` que a migration `0059_habilidade_bncc` fez no banco de teste. Por etapa, por série
 * (o Fundamental pelo ano, o Médio sem ano) e por código, na ordem do código, e com o grupo que a cobertura usa (o componente no Fundamental, a área no Médio).
 */
describe('BnccRepository: as habilidades da tabela pública', () => {
  let pool: DatabasePool
  let banco: Database

  beforeAll(() => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    banco = createDatabase(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('por etapa: só as da etapa pedida, na ordem do código, e o Médio e o Fundamental juntos quando os dois são pedidos', async () => {
    const repositorio = new BnccRepository(banco)
    const medio = await repositorio.habilidades({ etapas: ['em'] })
    expect(medio.length).toBeGreaterThan(100)
    expect(medio.every((habilidade) => habilidade.codigo.startsWith('EM13'))).toBe(true)
    expect(medio.map((habilidade) => habilidade.codigo)).toEqual(medio.map((habilidade) => habilidade.codigo).sort())
    const ambas = await repositorio.habilidades({ etapas: ['em', 'ef_anos_finais'] })
    expect(ambas.length).toBeGreaterThan(medio.length)
    expect(ambas.some((habilidade) => habilidade.codigo.startsWith('EF'))).toBe(true)
    expect(await repositorio.habilidades({ etapas: [] })).toEqual([])
  })

  it('por série: no Fundamental só as que listam o ano, e no Médio todas, sem olhar o ano', async () => {
    const repositorio = new BnccRepository(banco)
    const setimo = await repositorio.habilidades({ etapa: 'ef_anos_finais', ano: 7 })
    expect(setimo.map((habilidade) => habilidade.codigo)).toContain('EF07CI01')
    expect(setimo.map((habilidade) => habilidade.codigo)).toContain('EF69LP01')
    expect(setimo.map((habilidade) => habilidade.codigo)).not.toContain('EF06CI01')
    expect(setimo.map((habilidade) => habilidade.codigo)).not.toContain('EF08CI01')
    const todoOMedio = await repositorio.habilidades({ etapas: ['em'] })
    expect((await repositorio.habilidades({ etapa: 'em', ano: 1 })).length).toBe(todoOMedio.length)
    expect((await repositorio.habilidades({ etapa: 'em', ano: 3 })).length).toBe(todoOMedio.length)
  })

  it('por código: o texto oficial de uma habilidade, e nada para o código que a tabela não tem', async () => {
    const repositorio = new BnccRepository(banco)
    const [achada] = await repositorio.habilidades({ codigo: 'EF07CI01' })
    expect(achada?.codigo).toBe('EF07CI01')
    expect(achada?.descricao.length).toBeGreaterThan(20)
    expect(await repositorio.habilidades({ codigo: 'EF07CI99' })).toEqual([])
  })

  it('o grupo é o componente no Fundamental e a área no Médio (as `EM13LP` têm os dois, e a área vence)', async () => {
    const repositorio = new BnccRepository(banco)
    const [fundamental] = await repositorio.habilidades({ codigo: 'EF07CI01' })
    expect(fundamental?.grupo).toBe('ciencias')
    const [medio] = await repositorio.habilidades({ codigo: 'EM13CNT101' })
    expect(medio?.grupo).toBe('ciencias_da_natureza')
    const [portugues] = await repositorio.habilidades({ codigo: 'EM13LP01' })
    expect(portugues?.grupo).toBe('linguagens')
  })

  it('só devolve código, texto e grupo: nenhuma coluna a mais sai da tabela', async () => {
    const [habilidade] = await new BnccRepository(banco).habilidades({ codigo: 'EF07CI01' })
    expect(Object.keys(habilidade ?? {}).sort()).toEqual(['codigo', 'descricao', 'grupo'])
  })
})
