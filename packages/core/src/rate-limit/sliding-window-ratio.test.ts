import { describe, expect, it } from 'vitest'
import { SlidingWindowRatio } from './sliding-window-ratio.js'

describe('ProporcaoEmJanela (limite.seguro_ativo)', () => {
  // Janela de 30 s em 6 fatias de 5 s, com relógio na mão.
  function janela(): { proporcao: SlidingWindowRatio; avancar: (ms: number) => void } {
    let agora = 1_000_000
    return { proporcao: new SlidingWindowRatio(30_000, 6, () => agora), avancar: (ms) => (agora += ms) }
  }

  it('Redis de cache fora: toda requisição pelo seguro dá 1; sem requisição na janela, 0', () => {
    const { proporcao, avancar } = janela()
    expect(proporcao.valor()).toBe(0)
    for (let pedido = 0; pedido < 10; pedido++) proporcao.registrar(true)
    expect(proporcao.valor()).toBe(1)
    avancar(35_000)
    expect(proporcao.valor()).toBe(0)
  })

  it('Redis oscilando: a proporção fica entre 0 e 1, sem pular para 0 ou 1 a cada requisição', () => {
    const { proporcao } = janela()
    for (let pedido = 0; pedido < 8; pedido++) proporcao.registrar(pedido % 4 === 0)
    expect(proporcao.valor()).toBe(0.25)
    proporcao.registrar(false)
    expect(proporcao.valor()).toBeCloseTo(2 / 9)
  })

  it('amortecimento: o Redis volta, e o seguro sai da proporção fatia a fatia, não de uma vez', () => {
    const { proporcao, avancar } = janela()
    for (let pedido = 0; pedido < 10; pedido++) proporcao.registrar(true)
    avancar(5_000)
    for (let pedido = 0; pedido < 10; pedido++) proporcao.registrar(false)
    expect(proporcao.valor()).toBe(0.5)
    avancar(20_000)
    proporcao.registrar(false)
    // A primeira fatia (a do seguro) ainda está na janela de 30 s.
    expect(proporcao.valor()).toBeCloseTo(10 / 21)
    avancar(5_000)
    expect(proporcao.valor()).toBe(0)
  })
})
