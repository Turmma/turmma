import { runInContext, type RequestContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { LeituraDoLote } from './leitura-do-lote.js'

/** Um Redis de mentira, só com `set` e `get`: o que a leitura do lote usa. */
function redisEmMemoria(): { cliente: ConstructorParameters<typeof LeituraDoLote>[0]; chaves: Map<string, string> } {
  const chaves = new Map<string, string>()
  const cliente = {
    set: async (chave: string, valor: string) => {
      chaves.set(chave, valor)
      return 'OK' as const
    },
    get: async (chave: string) => chaves.get(chave) ?? null,
  }
  return { cliente: cliente as unknown as ConstructorParameters<typeof LeituraDoLote>[0], chaves }
}

const comoProfessora = <T>(escolaId: string, usuarioId: string, funcao: () => Promise<T>): Promise<T> => {
  const contexto: RequestContext = { requisicaoId: randomUUID(), escolaId, usuarioId, papel: 'professor', sessaoId: randomUUID(), anoLetivoId: randomUUID() }
  return runInContext(contexto, funcao)
}

describe('a marca de leitura do lote no Redis (D56)', () => {
  it('a chave tem a escola: a mesma pessoa e o mesmo lote, noutra escola, não acham a leitura', async () => {
    const { cliente } = redisEmMemoria()
    const leitura = new LeituraDoLote(cliente)
    const [escolaA, escolaB, usuarioId, entregaId] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
    await comoProfessora(escolaA, usuarioId, () => leitura.registrar(entregaId, 'marca-do-apresentado'))
    expect(await comoProfessora(escolaA, usuarioId, () => leitura.marcaLida(entregaId))).toBe('marca-do-apresentado')
    expect(await comoProfessora(escolaB, usuarioId, () => leitura.marcaLida(entregaId))).toBeUndefined()
  })

  it('a chave tem a pessoa e o lote, e não leva nenhum id em claro', async () => {
    const { cliente, chaves } = redisEmMemoria()
    const leitura = new LeituraDoLote(cliente)
    const [escolaId, usuarioId, outraPessoa, entregaId] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
    await comoProfessora(escolaId, usuarioId, () => leitura.registrar(entregaId, 'marca'))
    expect(await comoProfessora(escolaId, outraPessoa, () => leitura.marcaLida(entregaId))).toBeUndefined()
    expect(await comoProfessora(escolaId, usuarioId, () => leitura.marcaLida(randomUUID()))).toBeUndefined()
    const [chave] = [...chaves.keys()]
    for (const id of [escolaId, usuarioId, entregaId]) expect(chave).not.toContain(id)
  })
})
