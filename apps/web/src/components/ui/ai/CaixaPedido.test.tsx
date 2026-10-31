// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classesDo, tokenDe } from '../../../__fixtures__/class-colors'
import { CaixaPedido } from './CaixaPedido'

/**
 * A caixa de pedido na pele da D80 (`docs/interface.md` 10.2 e 11.2): canto de 16 px e borda de 2 px, o enviar redondo de
 * 44 px em laranja e o "Parar" `secundario`. O que o `jsdom` não faz é medir texto: ele devolve `scrollHeight` 0, e por
 * isso o teste da altura do exemplo o substitui por uma conta que diz **quanto o navegador mediria** com o valor que o
 * campo tem naquele instante. O exemplo quebrado a 360 px, visto de verdade, é do e2e (`e2e/components-ai.spec.ts`).
 */
const EXEMPLO = 'Peça uma atividade, um plano de aula ou uma lista de exercícios para a sua turma'
const UMA_LINHA = 45
const DUAS_LINHAS = 70

function medirComo(altura: (valor: string) => number, largura: () => number = () => 300): void {
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return altura(this.value)
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return largura()
    },
  })
}

/** A conta do navegador: o exemplo, quebrado, ocupa duas linhas; o que se digita cabe em uma. */
const conta = (valor: string): number => (valor === EXEMPLO ? DUAS_LINHAS : UMA_LINHA)

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLTextAreaElement.prototype, 'scrollHeight')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
})

const props = { rotulo: 'Pedido ao Assistente de ensino', aoMudar: () => undefined, aoEnviar: () => undefined } as const

describe('CaixaPedido, a altura do campo', () => {
  it('vazio, o campo mede o exemplo: ele aparece inteiro, e o valor da peça continua vazio', () => {
    medirComo(conta)
    render(<CaixaPedido {...props} exemplo={EXEMPLO} valor="" />)
    const campo = screen.getByLabelText('Pedido ao Assistente de ensino') as HTMLTextAreaElement
    expect(campo.style.height).toBe(`${String(DUAS_LINHAS)}px`)
    // A medida é do espelho, fora do campo: o exemplo não vira texto do campo, e o espelho não é lido nem focado.
    expect(campo.value).toBe('')
    expect(campo.placeholder).toBe(EXEMPLO)
  })

  it('com texto, o campo cresce pelo que foi digitado, e o texto digitado fica', () => {
    medirComo(conta)
    render(<CaixaPedido {...props} exemplo={EXEMPLO} valor="monta uma atividade" />)
    const campo = screen.getByLabelText('Pedido ao Assistente de ensino') as HTMLTextAreaElement
    expect(campo.style.height).toBe(`${String(UMA_LINHA)}px`)
    expect(campo.value).toBe('monta uma atividade')
  })

  it('sem exemplo, o campo vazio mede o que tem, e não existe espelho nem texto inventado', () => {
    // `'undefined'` é o que um exemplo ausente viraria se fosse posto como valor: a conta o faz crescer, e o teste vê.
    medirComo((valor) => (valor === 'undefined' ? 200 : UMA_LINHA))
    const { container } = render(<CaixaPedido {...props} valor="" />)
    const campo = screen.getByLabelText('Pedido ao Assistente de ensino') as HTMLTextAreaElement
    expect(campo.style.height).toBe(`${String(UMA_LINHA)}px`)
    expect(campo.value).toBe('')
    expect(container.querySelector('[data-espelho-do-exemplo]')).toBeNull()
  })

  it('o espelho é só para medir: escondido do leitor de tela, fora da ordem de foco, sem edição e do mesmo tamanho de letra', () => {
    medirComo(conta)
    const { container } = render(<CaixaPedido {...props} exemplo={EXEMPLO} valor="" />)
    const espelho = container.querySelector('[data-espelho-do-exemplo]') as HTMLTextAreaElement
    const campo = screen.getByLabelText('Pedido ao Assistente de ensino') as HTMLTextAreaElement
    expect(espelho).not.toBe(campo)
    expect(espelho.value).toBe(EXEMPLO)
    expect(espelho.getAttribute('aria-hidden')).toBe('true')
    expect(espelho.tabIndex).toBe(-1)
    expect(espelho.readOnly).toBe(true)
    expect(classesDo(espelho).has('invisible')).toBe(true)
    expect(classesDo(espelho).has('absolute')).toBe(true)
    // O mesmo tamanho de letra e o mesmo respiro do campo: senão o exemplo quebra em outro lugar e a medida mente.
    for (const classe of ['t-corpo', 'px-3', 'py-2.5', 'min-h-11', 'w-full']) {
      expect(classesDo(espelho).has(classe), classe).toBe(true)
      expect(classesDo(campo).has(classe), classe).toBe(true)
    }
    // O leitor de tela não o encontra, e o campo continua sendo o único com o nome do pedido.
    expect(screen.getAllByRole('textbox')).toEqual([campo])
  })

  it('apagar o pedido não escreve no campo: a medida do exemplo não leva o histórico do desfazer', () => {
    medirComo(conta)
    const original = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value') as PropertyDescriptor & {
      get: () => string
      set: (valor: string) => void
    }
    const { rerender } = render(<CaixaPedido {...props} exemplo={EXEMPLO} valor="monta uma atividade" />)
    const campo = screen.getByLabelText('Pedido ao Assistente de ensino') as HTMLTextAreaElement
    const escritas: string[] = []
    Object.defineProperty(campo, 'value', {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        return original.get.call(this)
      },
      set(this: HTMLTextAreaElement, valor: string) {
        escritas.push(valor)
        original.set.call(this, valor)
      },
    })
    rerender(<CaixaPedido {...props} exemplo={EXEMPLO} valor="" />)
    // Só o React escreve no campo, uma vez, o vazio. A medida do exemplo (o antigo "põe o exemplo e devolve") não aparece.
    expect(escritas).not.toContain(EXEMPLO)
    expect(escritas.length).toBeLessThanOrEqual(1)
    expect(campo.style.height).toBe(`${String(DUAS_LINHAS)}px`)
  })

  it('o campo para de crescer em 192 px e rola por dentro', () => {
    medirComo(() => 500)
    render(<CaixaPedido {...props} exemplo={EXEMPLO} valor={'linha\n'.repeat(30)} />)
    expect((screen.getByLabelText('Pedido ao Assistente de ensino') as HTMLTextAreaElement).style.height).toBe('192px')
  })

  it('o exemplo é medido de novo quando a largura da caixa muda, e só quando ela muda', () => {
    let largura = 300
    let alturaDoExemplo = DUAS_LINHAS
    const avisos: (() => void)[] = []
    const observados: Element[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(aviso: () => void) {
          avisos.push(aviso)
        }
        observe(alvo: Element): void {
          observados.push(alvo)
        }
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    medirComo((valor) => (valor === EXEMPLO ? alturaDoExemplo : UMA_LINHA), () => largura)
    const { container } = render(<CaixaPedido {...props} exemplo={EXEMPLO} valor="" />)
    const campo = screen.getByLabelText('Pedido ao Assistente de ensino') as HTMLTextAreaElement
    expect(campo.style.height).toBe(`${String(DUAS_LINHAS)}px`)
    expect(avisos).toHaveLength(1)
    // Quem se observa é o espelho, que não muda de altura com o campo: a caixa mudaria, e o ajuste a observaria de novo.
    expect(observados).toEqual([container.querySelector('[data-espelho-do-exemplo]')])

    // A caixa foi ouvida, mas a largura é a mesma (a altura mudou por causa do próprio campo): nada a medir de novo.
    alturaDoExemplo = UMA_LINHA + 5
    for (const avisar of avisos) avisar()
    expect(campo.style.height).toBe(`${String(DUAS_LINHAS)}px`)

    // A lateral recolheu, a caixa alargou, e o exemplo cabe em menos linhas.
    largura = 600
    for (const avisar of avisos) avisar()
    expect(campo.style.height).toBe(`${String(UMA_LINHA + 5)}px`)

    // A largura nova passou a ser a de referência: ouvir de novo, sem mudança, não mede outra vez.
    alturaDoExemplo = DUAS_LINHAS
    for (const avisar of avisos) avisar()
    expect(campo.style.height).toBe(`${String(UMA_LINHA + 5)}px`)
  })
})

describe('CaixaPedido, o desenho', () => {
  it('a caixa tem canto de 16 px e borda de 2 px em `borda-campo`, sem sombra, e o campo é do mesmo chão', () => {
    medirComo(conta)
    const { container } = render(<CaixaPedido {...props} exemplo={EXEMPLO} valor="" />)
    const caixa = container.querySelector('[data-caixa-pedido]') as HTMLElement
    const classes = classesDo(caixa)
    expect(classes.has('rounded-caixa')).toBe(true)
    expect(classes.has('border-2')).toBe(true)
    expect(tokenDe(caixa, 'border')).toBe('borda-campo')
    expect(tokenDe(caixa, 'bg')).toBe('campo')
    expect([...classes].filter((classe) => classe.startsWith('shadow'))).toEqual([])
    const campo = screen.getByLabelText('Pedido ao Assistente de ensino')
    expect(tokenDe(campo, 'bg')).toBe('campo')
    // Desligado, o campo é outro desenho e continua legível: `fundo-suave` com texto `apoio`, e não o `inativo`.
    expect(tokenDe(campo, 'bg', 'disabled:')).toBe('fundo-suave')
    expect(tokenDe(campo, 'text', 'disabled:')).toBe('apoio')
  })

  it('o anel de foco é da caixa, por focus-within, e o campo de dentro não desenha contorno', () => {
    medirComo(conta)
    for (const variante of ['completa', 'so-texto'] as const) {
      const { container } = render(<CaixaPedido {...props} variante={variante} exemplo={EXEMPLO} valor="" />)
      const caixa = container.querySelector('[data-caixa-pedido]') as HTMLElement
      // O mesmo anel do produto (foco, 3 px, sólido), colado à borda da caixa, e não afastado dentro dela (`Opcao`, 10.1).
      expect([...classesDo(caixa)].filter((classe) => classe.startsWith('focus-within:outline')).sort(), variante).toEqual([
        'focus-within:outline-3',
        'focus-within:outline-foco',
        'focus-within:outline-offset-0',
        'focus-within:outline-solid',
      ])
      // O contorno global (`:focus-visible` do `index.css`) cairia no `textarea`, dentro da moldura: ele não desenha o seu.
      const campo = screen.getByLabelText('Pedido ao Assistente de ensino')
      expect(classesDo(campo).has('outline-none'), variante).toBe(true)
      cleanup()
    }
  })

  it('o enviar é o primário redondo de 44 px; enquanto a resposta chega, o "Parar" é o secundário e não o oficial', () => {
    medirComo(conta)
    const { rerender } = render(<CaixaPedido {...props} exemplo={EXEMPLO} valor="oi" />)
    const enviar = screen.getByRole('button', { name: 'Enviar' })
    expect(tokenDe(enviar, 'bg')).toBe('laranja')
    expect(classesDo(enviar).has('size-11')).toBe(true)
    expect(classesDo(enviar).has('rounded-full')).toBe(true)

    rerender(<CaixaPedido {...props} exemplo={EXEMPLO} valor="" estado="gerando" aoParar={() => undefined} />)
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull()
    const parar = screen.getByRole('button', { name: 'Parar' })
    expect(tokenDe(parar, 'bg')).toBe('superficie')
    expect(classesDo(parar).has('degrau-borda')).toBe(true)
    for (const proibida of ['laranja', 'grafite', 'noite']) expect(tokenDe(parar, 'bg'), proibida).not.toBe(proibida)
    expect(classesDo(parar).has('degrau-grafite')).toBe(false)
  })
})
