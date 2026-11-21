import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { INVENTARIOS_DO_PORTAO, inventariosDosAlterados } from './inventarios-do-portao.ts'
import { alvosDoPortao } from './portao.ts'

const raiz = join(import.meta.dirname, '..', '..')
const INVENTARIO_DO_BANCO = 'packages/core/src/db/schema/mvp/mvp-tables.int.test.ts'
const INVENTARIO_DO_COMPOSE = 'tools/ci/compose.int.test.ts'

describe('inventários que o portão da tarefa roda quando o diff toca o inventariado', () => {
  it('migration nova ou mexida em packages/core/drizzle/ puxa o inventário das tabelas, mesmo com ele intacto', () => {
    for (const arquivo of ['packages/core/drizzle/0066_catalogo.sql', 'packages/core/drizzle/meta/_journal.json', 'packages/core/drizzle/meta/0066_snapshot.json']) {
      expect(inventariosDosAlterados([arquivo])).toEqual([INVENTARIO_DO_BANCO])
    }
  })

  it('infra/compose.yml puxa o inventário dos serviços, e só ele: o compose de carga e outros yml não o puxam', () => {
    expect(inventariosDosAlterados(['infra/compose.yml'])).toEqual([INVENTARIO_DO_COMPOSE])
    expect(inventariosDosAlterados(['infra/compose.carga.yml', 'infra/alertas/regras.yml', 'packages/core/src/db/schema/mvp/tabela.ts', 'docs/infra.md'])).toEqual([])
  })

  it('o inventário entra nos alvos de integração, uma vez, e não se repete quando o próprio teste também mudou', () => {
    expect(alvosDoPortao(['packages/core/drizzle/0066_catalogo.sql', 'infra/compose.yml'])).toEqual({
      integracao: [INVENTARIO_DO_BANCO, INVENTARIO_DO_COMPOSE],
      e2e: [],
      infra: [],
      processo: [],
    })
    expect(alvosDoPortao(['packages/core/drizzle/0066_catalogo.sql', INVENTARIO_DO_BANCO]).integracao).toEqual([INVENTARIO_DO_BANCO])
  })

  it('quem não toca o inventariado não ganha alvo nenhum', () => {
    expect(alvosDoPortao(['apps/api/src/x.ts', 'docs/modelo-de-dados.md', 'infra/compose.carga.yml'])).toEqual({ integracao: [], e2e: [], infra: [], processo: [] })
  })

  it('toda linha da tabela aponta um teste de integração que existe na árvore, e a tabela não repete caminho', () => {
    for (const { inventario } of INVENTARIOS_DO_PORTAO) {
      expect(inventario).toMatch(/\.int\.test\.ts$/)
      expect(existsSync(join(raiz, inventario)), inventario).toBe(true)
    }
    const inventarios = INVENTARIOS_DO_PORTAO.map((linha) => linha.inventario)
    expect(new Set(inventarios).size).toBe(inventarios.length)
  })
})
