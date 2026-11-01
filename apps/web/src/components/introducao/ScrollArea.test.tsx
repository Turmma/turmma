// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollArea } from './ScrollArea'

/**
 * A região que rola das introduções (telas do aluno e primeiro acesso, 9.0 e 10.0; RF20): o nome, o Tab e a faixa "Role para ler
 * mais", que só fica enquanto há o que ler abaixo. O jsdom não desenha: a medida da região é posta à mão em cada caso.
 */
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const FAIXA = 'Role para ler mais'

function abrir() {
  render(
    <ScrollArea nome="Leia até o fim" alturaMaxima="max-h-[28dvh]">
      <p>Conteúdo longo</p>
    </ScrollArea>,
  )
  return screen.getByRole('region', { name: 'Leia até o fim' })
}

function medir(regiao: HTMLElement, medida: { clientHeight: number; scrollHeight: number; scrollTop?: number }): void {
  Object.defineProperty(regiao, 'clientHeight', { configurable: true, value: medida.clientHeight })
  Object.defineProperty(regiao, 'scrollHeight', { configurable: true, value: medida.scrollHeight })
  regiao.scrollTop = medida.scrollTop ?? 0
}

describe('RegiaoQueRola', () => {
  it('é uma região com nome, que entra no Tab, e a altura máxima vem de quem a usa', () => {
    const regiao = abrir()

    expect(regiao.getAttribute('tabindex')).toBe('0')
    expect(regiao.className).toContain('max-h-[28dvh]')
    expect(regiao.className).toContain('overflow-y-auto')
    expect(screen.getByText('Conteúdo longo')).toBeTruthy()
  })

  it('sem medida (o ambiente não desenha) a faixa "Role para ler mais" fica: avisa a mais, nunca a menos', () => {
    abrir()

    expect(screen.getByText(FAIXA)).toBeTruthy()
  })

  it('a faixa vai com a rolagem: fica enquanto há o que ler abaixo e sai ao chegar ao fim', () => {
    const regiao = abrir()
    const rolarPara = (topo: number) => {
      medir(regiao, { clientHeight: 200, scrollHeight: 1000, scrollTop: topo })
      fireEvent.scroll(regiao)
    }

    rolarPara(300)
    expect(screen.getByText(FAIXA)).toBeTruthy()
    rolarPara(800)
    expect(screen.queryByText(FAIXA)).toBeNull()
    rolarPara(100)
    expect(screen.getByText(FAIXA)).toBeTruthy()
  })

  it('quando o conteúdo cabe inteiro, a faixa sai sem ninguém rolar: a medida vem quando a região muda de tamanho', () => {
    let aoMudarDeTamanho: () => void = () => undefined
    const desligar = vi.fn()
    class ObservadorFalso {
      constructor(chamada: () => void) {
        aoMudarDeTamanho = chamada
      }
      observe = vi.fn()
      disconnect = desligar
    }
    vi.stubGlobal('ResizeObserver', ObservadorFalso)
    const regiao = abrir()
    expect(screen.getByText(FAIXA)).toBeTruthy()

    medir(regiao, { clientHeight: 300, scrollHeight: 300 })
    act(() => aoMudarDeTamanho())
    expect(screen.queryByText(FAIXA)).toBeNull()

    medir(regiao, { clientHeight: 300, scrollHeight: 900 })
    act(() => aoMudarDeTamanho())
    expect(screen.getByText(FAIXA)).toBeTruthy()
  })

  it('ao sair da tela, para de observar o tamanho', () => {
    const desligar = vi.fn()
    class ObservadorFalso {
      observe = vi.fn()
      disconnect = desligar
    }
    vi.stubGlobal('ResizeObserver', ObservadorFalso)
    abrir()

    cleanup()

    expect(desligar).toHaveBeenCalledTimes(1)
  })
})
