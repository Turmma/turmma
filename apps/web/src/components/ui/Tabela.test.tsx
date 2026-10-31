// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classesDo } from '../../__fixtures__/class-colors'
import { Tabela, type ColunaDaTabela } from './Tabela'

/**
 * A tabela que vira lista (regra 50, item 2a; `docs/interface.md` 10.2; Tech Spec da X1, seção 9): uma estrutura de cada
 * vez no documento, escolhida pela largura, com o nome de cada valor dito em texto na lista, e a região que rola só
 * recebendo foco quando sobra. O `jsdom` não tem `matchMedia` nem `ResizeObserver`: o teste põe os dois, que são API do
 * navegador e não peça nossa. A medida, a cor calculada e o anel de verdade são do e2e da galeria
 * (`e2e/components-surfaces.spec.ts`).
 */
interface Registro {
  readonly id: string
  readonly oQue: string
  readonly turma: string
  readonly quando: string
}

const REGISTROS: readonly Registro[] = [
  { id: 'r1', oQue: 'Correção da lista 3', turma: '2ºB', quando: '19/09' },
  { id: 'r2', oQue: 'Versão com fonte ampliada', turma: '1ºA', quando: '20/09' },
]

const COLUNAS: readonly [ColunaDaTabela<Registro>, ...ColunaDaTabela<Registro>[]] = [
  { chave: 'oQue', titulo: 'O quê', celula: (registro) => registro.oQue },
  { chave: 'turma', titulo: 'Turma', celula: (registro) => registro.turma },
  { chave: 'quando', titulo: 'Quando', alinhamento: 'fim', celula: (registro) => registro.quando },
]

/** A largura da janela, para a consulta `(min-width: 768px)`. */
function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

/** O `ResizeObserver` que avisa uma vez, ao observar, e depois não faz nada. */
function observadorQueAvisa(): void {
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
}

/** O `jsdom` não calcula medida: a tabela "passa" do contêiner quando o teste diz que passa. */
function larguraDaTabela(conteudo: number, janela: number): void {
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(conteudo)
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(janela)
}

beforeEach(() => {
  observadorQueAvisa()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const desenhar = () => render(<Tabela rotulo="O que a IA gerou e quem aprovou" colunas={COLUNAS} linhas={REGISTROS} chaveDaLinha={(registro) => registro.id} />)

describe('Tabela', () => {
  it('abaixo de 768 px só a lista existe, com o nome de cada valor em `dt` e `dd`; nenhuma tabela no documento', () => {
    janelaDe(360)
    const { container } = desenhar()
    expect(container.querySelector('table')).toBeNull()
    const lista = screen.getByRole('list', { name: 'O que a IA gerou e quem aprovou' })
    expect(lista.getAttribute('data-tabela')).toBe('lista')
    const itens = within(lista).getAllByRole('listitem')
    expect(itens).toHaveLength(2)
    const primeiro = itens[0] as HTMLElement
    // A primeira coluna é o título do item, com o nome da coluna só para o leitor de tela; as outras, `dt` e `dd`.
    expect(primeiro.querySelector('.sr-only')?.textContent).toBe('O quê: ')
    expect(primeiro.textContent).toContain('Correção da lista 3')
    expect([...primeiro.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Turma', 'Quando'])
    expect([...primeiro.querySelectorAll('dd')].map((dd) => dd.textContent)).toEqual(['2ºB', '19/09'])
  })

  it('a partir de 768 px só a tabela existe, com `caption`, `th` de coluna e a primeira célula como `th` de linha', () => {
    janelaDe(768)
    const { container } = desenhar()
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelector('dl')).toBeNull()
    const tabela = screen.getByRole('table', { name: 'O que a IA gerou e quem aprovou' })
    expect(tabela.querySelector('caption')?.textContent).toBe('O que a IA gerou e quem aprovou')
    expect(screen.getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)).toEqual(['O quê', 'Turma', 'Quando'])
    expect(screen.getAllByRole('rowheader').map((cabecalho) => cabecalho.textContent)).toEqual(['Correção da lista 3', 'Versão com fonte ampliada'])
    for (const cabecalho of screen.getAllByRole('columnheader')) expect(cabecalho.getAttribute('scope')).toBe('col')
    expect(screen.getAllByRole('cell').map((celula) => celula.textContent)).toEqual(['2ºB', '19/09', '1ºA', '20/09'])
  })

  it('acompanha a janela: a mesma tela vira lista quando encolhe, sem as duas estruturas ao mesmo tempo', () => {
    janelaDe(1024)
    const { container, rerender } = desenhar()
    expect(container.querySelectorAll('[data-tabela]')).toHaveLength(1)
    expect(container.querySelector('[data-tabela]')?.getAttribute('data-tabela')).toBe('tabela')
    janelaDe(360)
    rerender(<Tabela rotulo="O que a IA gerou e quem aprovou" colunas={COLUNAS} linhas={REGISTROS} chaveDaLinha={(registro) => registro.id} />)
    expect(container.querySelectorAll('[data-tabela]')).toHaveLength(1)
    expect(container.querySelector('[data-tabela]')?.getAttribute('data-tabela')).toBe('lista')
  })

  it('a tabela que cabe não é uma parada a mais no Tab: sem foco e sem papel de região', () => {
    janelaDe(1024)
    larguraDaTabela(600, 800)
    desenhar()
    const regiao = document.querySelector('[data-tabela="tabela"]') as HTMLElement
    expect(regiao.hasAttribute('tabindex')).toBe(false)
    expect(regiao.hasAttribute('role')).toBe(false)
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('a tabela que não cabe rola dentro dela, e aí, e só aí, a região ganha foco e o nome', () => {
    janelaDe(1024)
    larguraDaTabela(900, 300)
    desenhar()
    const regiao = screen.getByRole('region', { name: 'O que a IA gerou e quem aprovou' })
    expect(regiao.getAttribute('tabindex')).toBe('0')
    expect(regiao.getAttribute('data-tabela')).toBe('tabela')
    // Rola por dentro: a moldura corta no eixo horizontal.
    expect(classesDo(regiao).has('overflow-x-auto')).toBe(true)
  })

  it('tem a pele da D80: moldura de 2 px em borda e canto de 16, cabeçalho de 44 px em `t-selo` e linha de 64 px com fio de 2 px', () => {
    janelaDe(1024)
    larguraDaTabela(600, 800)
    desenhar()
    const moldura = document.querySelector('[data-tabela="tabela"]') as HTMLElement
    for (const classe of ['rounded-cartao', 'border-2', 'border-borda']) expect(classesDo(moldura).has(classe), `moldura: ${classe}`).toBe(true)

    const [cabecalho, ...corpo] = [...moldura.querySelectorAll('tr')]
    expect(corpo).toHaveLength(2)
    for (const classe of ['h-11', 'border-b-2', 'border-borda']) expect(classesDo(cabecalho as Element).has(classe), `cabeçalho: ${classe}`).toBe(true)
    for (const th of moldura.querySelectorAll('thead th')) expect(classesDo(th).has('t-selo'), 'cabeçalho em t-selo').toBe(true)
    for (const linha of corpo) for (const classe of ['h-16', 'border-b-2', 'border-borda']) expect(classesDo(linha).has(classe), `linha: ${classe}`).toBe(true)
    // A última linha não leva fio embaixo: a moldura já fecha.
    expect(classesDo(corpo[1] as Element).has('last:border-b-0')).toBe(true)
    // O texto da linha é `t-apoio` (15 px, 500): a célula de linha e as de valor.
    for (const celula of moldura.querySelectorAll('tbody th, tbody td')) expect(classesDo(celula).has('t-apoio'), 'célula em t-apoio').toBe(true)
    // Sem degrau nem sombra: peça de leitura.
    expect(moldura.outerHTML).not.toMatch(/degrau|shadow/)
  })

  it('na lista, cada item é um cartão da mesma borda, com o título em `t-cartao` e o nome do valor em `t-selo`', () => {
    janelaDe(360)
    desenhar()
    const item = screen.getAllByRole('listitem')[0] as HTMLElement
    for (const classe of ['rounded-cartao', 'border-2', 'border-borda']) expect(classesDo(item).has(classe), classe).toBe(true)
    expect(classesDo(item.firstElementChild as Element).has('t-cartao')).toBe(true)
    for (const dt of item.querySelectorAll('dt')) expect(classesDo(dt).has('t-selo')).toBe(true)
    for (const dd of item.querySelectorAll('dd')) expect(classesDo(dd).has('t-apoio')).toBe(true)
    expect(item.outerHTML).not.toMatch(/degrau|shadow/)
  })

  it('o número e a data alinham à direita na tabela, com algarismos de largura igual', () => {
    janelaDe(1024)
    larguraDaTabela(600, 800)
    desenhar()
    const celula = screen.getAllByRole('cell')[1] as HTMLElement
    expect(celula.textContent).toBe('19/09')
    expect(classesDo(celula).has('text-right')).toBe(true)
    expect(classesDo(celula).has('tabular-nums')).toBe(true)
    expect(classesDo(screen.getAllByRole('columnheader')[2] as Element).has('text-right')).toBe(true)
  })
})
