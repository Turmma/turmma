import { ESTADOS_DO_PEDIDO } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserTab } from '../../../components/pedidos/atualizacao-dos-pedidos'
import { agendarPreparacao, INTERVALO_DA_PREPARACAO_MS, relerEnquantoPrepara } from './preparacao-do-arquivo'

/**
 * RF16 e W13 (F3, 17.0; `tasks/prd-lgpd-e-titular/cenarios.md`): o detalhe do pedido em preparação se relê a cada 10 s e
 * para com a aba escondida. Relógio falso e `visibilitychange`; a página que vira "pronto" sem recarregar é do e2e.
 */
function abaDeMentira(inicio: 'visible' | 'hidden' = 'visible') {
  const ouvintes = new Set<() => void>()
  const aba = {
    visibilityState: inicio,
    addEventListener: (_tipo: 'visibilitychange', ouvinte: () => void) => void ouvintes.add(ouvinte),
    removeEventListener: (_tipo: 'visibilitychange', ouvinte: () => void) => void ouvintes.delete(ouvinte),
  } satisfies BrowserTab as {
    visibilityState: 'visible' | 'hidden'
  } & BrowserTab
  return {
    aba,
    ouvintes,
    mudarPara(estado: 'visible' | 'hidden'): void {
      aba.visibilityState = estado
      for (const ouvinte of ouvintes) ouvinte()
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('o detalhe do pedido em preparação se relê a cada 10 s, só com a aba à vista', () => {
  it('o intervalo é de 10 segundos', () => {
    expect(INTERVALO_DA_PREPARACAO_MS).toBe(10_000)
  })

  it('só o pedido em preparação se relê sozinho: cada leitura é auditada, e nenhum outro estado muda por conta própria', () => {
    const relem = ESTADOS_DO_PEDIDO.filter((estado) => relerEnquantoPrepara(estado))
    expect(relem).toEqual(['em_preparacao'])
  })

  it('em preparação, uma leitura a cada 10 s: nenhuma antes, três em meio minuto', () => {
    const atualizar = vi.fn()
    const { aba } = abaDeMentira()
    agendarPreparacao('em_preparacao', atualizar, aba)
    vi.advanceTimersByTime(9_999)
    expect(atualizar).toHaveBeenCalledTimes(0)
    vi.advanceTimersByTime(1)
    expect(atualizar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(20_000)
    expect(atualizar).toHaveBeenCalledTimes(3)
  })

  it('fora de em preparação nada é agendado: nem relógio, nem ouvinte da aba', () => {
    for (const estado of ESTADOS_DO_PEDIDO.filter((estado) => estado !== 'em_preparacao')) {
      const atualizar = vi.fn()
      const { aba, ouvintes } = abaDeMentira()
      const parar = agendarPreparacao(estado, atualizar, aba)
      vi.advanceTimersByTime(60_000)
      expect(atualizar, estado).toHaveBeenCalledTimes(0)
      expect(ouvintes.size, estado).toBe(0)
      parar()
    }
  })

  it('com a aba escondida, para; ao voltar, relê na hora e recomeça a contagem', () => {
    const atualizar = vi.fn()
    const { aba, mudarPara } = abaDeMentira()
    agendarPreparacao('em_preparacao', atualizar, aba)
    vi.advanceTimersByTime(10_000)
    expect(atualizar).toHaveBeenCalledTimes(1)

    mudarPara('hidden')
    vi.advanceTimersByTime(120_000)
    expect(atualizar).toHaveBeenCalledTimes(1)

    mudarPara('visible')
    expect(atualizar).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(9_999)
    expect(atualizar).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    expect(atualizar).toHaveBeenCalledTimes(3)
  })

  it('a aba que já abre escondida não agenda leitura nenhuma até aparecer', () => {
    const atualizar = vi.fn()
    const { aba, mudarPara } = abaDeMentira('hidden')
    agendarPreparacao('em_preparacao', atualizar, aba)
    vi.advanceTimersByTime(60_000)
    expect(atualizar).toHaveBeenCalledTimes(0)
    mudarPara('visible')
    expect(atualizar).toHaveBeenCalledTimes(1)
  })

  it('ao parar (a tela saiu, ou o estado mudou), o relógio e o ouvinte da aba saem junto', () => {
    const atualizar = vi.fn()
    const { aba, ouvintes } = abaDeMentira()
    const parar = agendarPreparacao('em_preparacao', atualizar, aba)
    expect(ouvintes.size).toBe(1)
    parar()
    expect(ouvintes.size).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(atualizar).toHaveBeenCalledTimes(0)
  })
})
