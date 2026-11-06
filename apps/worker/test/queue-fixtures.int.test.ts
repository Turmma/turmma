import 'reflect-metadata'
import { afterEach, describe, expect, it } from 'vitest'
import { QueueFixtures } from './queue.fixture.js'

// A bancada prepara o cenário dos testes de fila. `semear` precisa de fato passar dos dois prazos do pool
// (2 s no servidor, 2 s + 2 s no cliente), senão a preparação de volume volta a cair na esteira; e o pool
// normal, por onde passa o que os testes medem, precisa continuar cortando nos 2 s.
describe('bancada de fila', () => {
  let bancada: QueueFixtures | undefined

  afterEach(async () => {
    await bancada?.fechar()
    bancada = undefined
  })

  it('semear passa dos 4 s do cliente e dos 2 s do servidor, e o pool normal continua cortando em 2 s', async () => {
    bancada = new QueueFixtures()
    await expect(bancada.pool.query('select pg_sleep(2.5)')).rejects.toMatchObject({ code: '57014' })
    // `semear` devolve as linhas da instrução; `pg_sleep` devolve `void`, que o `pg` lê como texto vazio.
    await expect(bancada.semear('select pg_sleep(4.5)')).resolves.toEqual([{ pg_sleep: '' }])
  }, 20_000)

  it('explicar passa dos 4 s do cliente e dos 2 s do servidor, e devolve o nó raiz do plano', async () => {
    bancada = new QueueFixtures()
    await expect(bancada.pool.query('select pg_sleep(2.5)')).rejects.toMatchObject({ code: '57014' })
    await expect(bancada.explicar<{ 'Node Type': string }>('select pg_sleep(4.5)')).resolves.toMatchObject({ 'Node Type': 'Result' })
  }, 20_000)

  it('explicar de uma escrita roda a instrução de verdade e desfaz: a linha segue como estava', async () => {
    bancada = new QueueFixtures()
    const escolaId = await bancada.escola()
    const id = await bancada.enfileirar(escolaId, { fila: 'lote' })
    try {
      const plano = await bancada.explicar<{ 'Node Type': string }>(`update job_registro set estado = 'concluido' where id = $1`, [id])
      // O plano é o do `update`, e a linha seguiu `aguardando`: o rollback é da fixture, não de quem a chama.
      expect(plano).toMatchObject({ 'Node Type': 'ModifyTable' })
      expect((await bancada.estado(id))?.estado).toBe('aguardando')
    } finally {
      await bancada.pool.query('delete from job_registro where id = $1', [id])
    }
  }, 20_000)
})
