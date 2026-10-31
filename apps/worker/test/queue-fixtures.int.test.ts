import 'reflect-metadata'
import { afterEach, describe, expect, it } from 'vitest'
import { BancadaDeFila } from './queue.fixture.js'

// A bancada prepara o cenário dos testes de fila. `semear` precisa de fato passar dos dois prazos do pool
// (2 s no servidor, 2 s + 2 s no cliente), senão a preparação de volume volta a cair na esteira; e o pool
// normal, por onde passa o que os testes medem, precisa continuar cortando nos 2 s.
describe('bancada de fila', () => {
  let bancada: BancadaDeFila | undefined

  afterEach(async () => {
    await bancada?.fechar()
    bancada = undefined
  })

  it('semear passa dos 4 s do cliente e dos 2 s do servidor, e o pool normal continua cortando em 2 s', async () => {
    bancada = new BancadaDeFila()
    await expect(bancada.pool.query('select pg_sleep(2.5)')).rejects.toMatchObject({ code: '57014' })
    await expect(bancada.semear('select pg_sleep(4.5)')).resolves.toBeUndefined()
  }, 20_000)
})
