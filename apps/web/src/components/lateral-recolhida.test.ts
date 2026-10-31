// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_DA_LATERAL_RECOLHIDA, guardarRecolhida, lerRecolhida } from './lateral-recolhida'

/**
 * A lateral recolhida por escolha (`docs/interface.md` 11.1; RF13, RF24 da X1): o que o navegador guarda é só `sim`, sob
 * a chave que nunca mudou, e o armazenamento recusado deixa a lateral aberta, sem erro. O reload e o foco da lateral
 * de verdade são do e2e (`e2e/casca.spec.ts`).
 */
beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('lateral recolhida', () => {
  it('a chave é a de sempre, e o valor guardado é só `sim`', () => {
    expect(CHAVE_DA_LATERAL_RECOLHIDA).toBe('educa.lateral-recolhida')
    guardarRecolhida(true)
    expect(window.localStorage.getItem('educa.lateral-recolhida')).toBe('sim')
    expect(window.localStorage.length).toBe(1)
  })

  it('abrir apaga a chave, e a leitura volta a aberta; sem nada guardado a lateral abre aberta', () => {
    expect(lerRecolhida()).toBe(false)
    guardarRecolhida(true)
    expect(lerRecolhida()).toBe(true)
    guardarRecolhida(false)
    expect(window.localStorage.getItem('educa.lateral-recolhida')).toBeNull()
    expect(lerRecolhida()).toBe(false)
  })

  it('só `sim` recolhe: outro valor guardado é lateral aberta', () => {
    window.localStorage.setItem('educa.lateral-recolhida', 'true')
    expect(lerRecolhida()).toBe(false)
    window.localStorage.setItem('educa.lateral-recolhida', 'sim')
    expect(lerRecolhida()).toBe(true)
  })

  it('`getItem` que lança: abre aberta, sem erro', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('recusado', 'SecurityError')
    })
    expect(lerRecolhida()).toBe(false)
  })

  it('`setItem` e `removeItem` que lançam: a escolha não derruba a tela', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('recusado', 'SecurityError')
    })
    expect(() => guardarRecolhida(true)).not.toThrow()
    expect(() => guardarRecolhida(false)).not.toThrow()
  })

  it('o acesso a `localStorage` que lança (navegação anônima, política do Chromebook gerenciado) também é calado', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('recusado', 'SecurityError')
    })
    expect(lerRecolhida()).toBe(false)
    expect(() => guardarRecolhida(true)).not.toThrow()
    expect(() => guardarRecolhida(false)).not.toThrow()
  })
})
