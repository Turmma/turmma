// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classesDo } from '../../__fixtures__/class-colors'
import { BarraPresa } from './BarraPresa'
import { BarraRotulada } from './BarraRotulada'
import { Cartao } from './Cartao'
import { NumeroPainel } from './NumeroPainel'

/**
 * As quatro peças que a 5.0 da X1 só reveste, sem mudar props (`docs/interface.md` 9.3 e 10.2): cartão, número de painel,
 * barra rotulada e barra presa. O `jsdom` não carrega o CSS, então o teste lê a classe que carrega a regra; o que o
 * navegador calcula (borda de 2 px na cor `borda`, o preenchimento resolvido por tema, a altura) é do e2e da galeria
 * (`e2e/components-surfaces.spec.ts`), e as duas barras neutras continuam provadas por `aluno-tutor` e `professor-turma`.
 */
beforeEach(() => {
  // A barra presa mede a altura dela e a reserva no bloco que rola.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly aoMedir: () => void) {}
      observe(): void {
        this.aoMedir()
      }
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Borda de 2 px na cor `borda`, canto de 16, e nenhuma sombra nem degrau: peça de leitura. */
function conferirCaixaDeLeitura(elemento: Element, nome: string): void {
  const classes = classesDo(elemento)
  for (const classe of ['border-2', 'border-borda', 'rounded-cartao']) expect(classes.has(classe), `${nome}: ${classe}`).toBe(true)
  // A borda de 1 px em `linha` é a de antes da D80: não pode sobrar nenhuma das duas.
  expect(classes.has('border'), `${nome}: borda de 1 px`).toBe(false)
  expect(classes.has('border-linha'), `${nome}: border-linha`).toBe(false)
  expect([...classes].filter((classe) => /^(degrau|shadow)/.test(classe)), `${nome}: sem sombra nem degrau`).toEqual([])
}

describe('Cartao', () => {
  it('sem título é só a caixa, com a borda de 2 px em borda, o canto de 16 e nenhuma sombra', () => {
    const { container } = render(<Cartao>conteúdo</Cartao>)
    const caixa = container.firstElementChild as Element
    expect(caixa.tagName).toBe('DIV')
    conferirCaixaDeLeitura(caixa, 'cartão')
  })

  it('com título, é uma região com nome, com a mesma caixa e o título em `t-cartao` no nível pedido', () => {
    render(
      <Cartao titulo="Atividades da semana" nivel={3} acao={<button type="button">Ver todas</button>}>
        conteúdo
      </Cartao>,
    )
    const regiao = screen.getByRole('region', { name: 'Atividades da semana' })
    conferirCaixaDeLeitura(regiao, 'cartão com título')
    const titulo = screen.getByRole('heading', { level: 3, name: 'Atividades da semana' })
    expect(classesDo(titulo).has('t-cartao')).toBe(true)
    // A ação fica ao lado do título, dentro do cartão.
    expect(regiao.contains(screen.getByRole('button', { name: 'Ver todas' }))).toBe(true)
  })

  it('o título só é focável por programa quando quem usa pede a ref, e então recebe o foco sem entrar no Tab', () => {
    const ref = createRef<HTMLHeadingElement>()
    render(
      <>
        <Cartao titulo="Sem ref">conteúdo</Cartao>
        <Cartao titulo="Com ref" refDoTitulo={ref}>
          conteúdo
        </Cartao>
      </>,
    )
    // Sem a ref o título é só texto: não vira parada no Tab nem aceita foco.
    const semRef = screen.getByRole('heading', { name: 'Sem ref' })
    expect(semRef.hasAttribute('tabindex')).toBe(false)
    // Com ela, `tabindex=-1` (alcançável por `focus()`, fora da ordem do Tab) e a ref é o próprio título.
    const comRef = screen.getByRole('heading', { name: 'Com ref' })
    expect(comRef.getAttribute('tabindex')).toBe('-1')
    expect(ref.current).toBe(comRef)
    ref.current?.focus()
    expect(document.activeElement).toBe(comRef)
  })

  it('o `className` de quem usa se soma à caixa, sem trocar a borda', () => {
    const { container } = render(<Cartao className="mt-4">conteúdo</Cartao>)
    const caixa = container.firstElementChild as Element
    expect(classesDo(caixa).has('mt-4')).toBe(true)
    conferirCaixaDeLeitura(caixa, 'cartão com className')
  })
})

describe('NumeroPainel', () => {
  it('é um cartão de leitura: borda de 2 px, o rótulo em `t-selo` e `sutil`, e o número em `t-numero`', () => {
    const { container } = render(<NumeroPainel rotulo="Gerado por IA" valor={1284} apoio="Atividades, planos e correções" />)
    conferirCaixaDeLeitura(container.firstElementChild as Element, 'número de painel')
    const rotulo = screen.getByText('Gerado por IA')
    expect(classesDo(rotulo).has('t-selo')).toBe(true)
    expect(classesDo(rotulo).has('text-sutil')).toBe(true)
    const numero = screen.getByText('1.284')
    expect(classesDo(numero).has('t-numero')).toBe(true)
    expect(classesDo(numero).has('text-tinta')).toBe(true)
    // O rótulo vem antes do número no documento: quem ouve "1.284" já ouviu de quê.
    expect(rotulo.compareDocumentPosition(numero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('o texto vai como veio, sem formatar', () => {
    render(<NumeroPainel rotulo="Média de acertos" valor="61%" />)
    expect(screen.getByText('61%')).toBeTruthy()
  })
})

describe('BarraRotulada', () => {
  const retangulosDe = (container: HTMLElement) => [...container.querySelectorAll('svg rect')]

  it('é neutra: trilho `ia-cx` e enchimento `sutil`, sem família de cor, vazia, no meio ou cheia', () => {
    for (const valor of [0, 50, 100]) {
      const { container, unmount } = render(<BarraRotulada rotulo="Hoje" valor={valor} texto={`${String(valor)}%`} />)
      const [trilho, enchimento] = retangulosDe(container)
      expect(retangulosDe(container), `valor ${String(valor)}`).toHaveLength(2)
      expect([...classesDo(trilho as Element)], `trilho com ${String(valor)}`).toEqual(['fill-ia-cx'])
      expect([...classesDo(enchimento as Element)], `enchimento com ${String(valor)}`).toEqual(['fill-sutil'])
      unmount()
    }
  })

  it('a forma é de 12 px de altura com a ponta redonda, e o enchimento acompanha o valor', () => {
    const { container } = render(<BarraRotulada rotulo="Consumo do mês" valor={188} maximo={300} texto="188 de 300 trocas" />)
    const svg = container.querySelector('svg') as SVGElement
    expect(classesDo(svg).has('h-3')).toBe(true)
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    const [trilho, enchimento] = retangulosDe(container)
    expect(trilho?.getAttribute('rx')).toBe('6')
    expect(enchimento?.getAttribute('rx')).toBe('6')
    expect(trilho?.getAttribute('width')).toBe('100%')
    expect(enchimento?.getAttribute('width')).toBe('62.66666666666667%')
  })

  it('o valor está escrito: a barra é só desenho, e o leitor de tela lê o texto', () => {
    render(<BarraRotulada rotulo="Habilidade EM13CNT101" valor={72} texto="72%" detalhe="3 questões" />)
    expect(screen.getByText('Habilidade EM13CNT101')).toBeTruthy()
    expect(screen.getByText('72%')).toBeTruthy()
    expect(screen.getByText('3 questões')).toBeTruthy()
  })
})

describe('BarraPresa', () => {
  it('tem o fio de 2 px em borda em cima, o fundo cheio e fica presa no pé', () => {
    render(
      <BarraPresa rotulo="Aprovação do lote" informacao="3 de 5 destaques abertos">
        <button type="button">Aprovar</button>
      </BarraPresa>,
    )
    const barra = screen.getByRole('group', { name: 'Aprovação do lote' })
    const classes = classesDo(barra)
    // Presa no pé da janela, ou acima da barra de baixo do celular (`--barra-baixo`, zero onde não há barra: 13.0).
    for (const classe of ['border-t-2', 'border-borda', 'bg-fundo', 'sticky', 'bottom-[var(--barra-baixo,0px)]']) expect(classes.has(classe), classe).toBe(true)
    expect(classes.has('bottom-0'), 'presa no pé da janela, atrás da barra de baixo').toBe(false)
    expect(classes.has('border-t'), 'o fio de 1 px de antes').toBe(false)
    expect(classes.has('border-linha')).toBe(false)
  })

  it('a barra da caixa de pedido (`semLinha`) não leva o fio', () => {
    render(
      <BarraPresa rotulo="Novo pedido" semLinha>
        <button type="button">Enviar</button>
      </BarraPresa>,
    )
    const classes = classesDo(screen.getByRole('group', { name: 'Novo pedido' }))
    expect(classes.has('border-t-2')).toBe(false)
    expect(classes.has('border-borda')).toBe(false)
  })

  it('reserva a altura dela no bloco que rola e a devolve ao sair', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 71.2 } as DOMRect)
    const { unmount } = render(
      <div data-bloco="" style={{ overflowY: 'auto' }}>
        <BarraPresa rotulo="Aprovação do lote">
          <button type="button">Aprovar</button>
        </BarraPresa>
      </div>,
    )
    // O `jsdom` lê o `overflow-y` do estilo em linha como o do ancestral que rola.
    const bloco = document.querySelector('[data-bloco]') as HTMLElement
    expect(bloco.style.scrollPaddingBottom).toBe('72px')
    unmount()
    expect(bloco.style.scrollPaddingBottom).toBe('')
  })

  /**
   * Os estilos que o `jsdom` não calcula: o bloco rola, e a barra sobe `sobe` do pé da janela (o `bottom` calculado, que é a
   * `--barra-baixo` do celular). O resto do `getComputedStyle` fica como o `jsdom` o devolve.
   */
  function barraQueSobe(sobe: { valor: string }): void {
    const real = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((elemento, pseudo) => {
      const estilo = real(elemento, pseudo)
      if (elemento.hasAttribute('data-barra-presa')) return new Proxy(estilo, { get: (alvo, nome) => (nome === 'bottom' ? sobe.valor : Reflect.get(alvo, nome) as unknown) })
      if (elemento.hasAttribute('data-bloco')) return new Proxy(estilo, { get: (alvo, nome) => (nome === 'overflowY' ? 'auto' : Reflect.get(alvo, nome) as unknown) })
      return estilo
    })
  }

  it('acima da barra de baixo, reserva também o quanto sobe: o foco não para atrás da barra do celular', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 71.2 } as DOMRect)
    barraQueSobe({ valor: '68px' })
    render(
      <div data-bloco="">
        <BarraPresa rotulo="Aprovação do lote">
          <button type="button">Aprovar</button>
        </BarraPresa>
      </div>,
    )
    const bloco = document.querySelector('[data-bloco]') as HTMLElement
    // 71,2 de altura mais 68 de barra de baixo, para cima.
    expect(bloco.style.scrollPaddingBottom).toBe('140px')
  })

  it('a barra de baixo nasce depois dela (o `/v1/eu` chega) e some com a largura: a reserva acompanha, e para ao sair', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 71.2 } as DOMRect)
    const sobe = { valor: '0px' }
    barraQueSobe(sobe)
    const { unmount } = render(
      <div data-bloco="">
        <BarraPresa rotulo="Aprovação do lote">
          <button type="button">Aprovar</button>
        </BarraPresa>
      </div>,
    )
    const bloco = document.querySelector('[data-bloco]') as HTMLElement
    expect(bloco.style.scrollPaddingBottom).toBe('72px')

    // A barra de baixo entra na página: o atributo do `<html>` muda, e o tamanho da barra presa, não.
    sobe.valor = '68px'
    document.documentElement.setAttribute('data-barra-de-baixo', '')
    await vi.waitFor(() => {
      expect(bloco.style.scrollPaddingBottom).toBe('140px')
    })

    sobe.valor = '0px'
    document.documentElement.removeAttribute('data-barra-de-baixo')
    await vi.waitFor(() => {
      expect(bloco.style.scrollPaddingBottom).toBe('72px')
    })

    // Depois de sair, a barra de baixo não mexe mais no bloco: o observador foi desligado.
    unmount()
    sobe.valor = '68px'
    document.documentElement.setAttribute('data-barra-de-baixo', '')
    await new Promise((resolver) => setTimeout(resolver, 20))
    document.documentElement.removeAttribute('data-barra-de-baixo')
    expect(bloco.style.scrollPaddingBottom).toBe('')
  })
})
