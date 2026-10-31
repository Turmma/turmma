// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesDo, contraste, corDoToken, TEMAS } from '../../__fixtures__/class-colors'
import { FAMILIAS_DE_COR } from './Contador'
import { Icone } from './Icone'
import { Ladrilho, type TamanhoDoLadrilho } from './Ladrilho'

/**
 * O ladrilho da D80 (`docs/interface.md` 10.2; Tech Spec da X1, seção 9): a moldura de família do ícone, ilustrado ou do
 * `lucide`. A cor resolvida, a medida de cada tamanho e o ícone a 72% do lado são do e2e da galeria
 * (`e2e/components-brand-icons.spec.ts`); aqui está o que o `jsdom` sabe: o nome, a família e as classes que carregam a regra.
 */
afterEach(cleanup)

const TAMANHOS: readonly TamanhoDoLadrilho[] = [32, 36, 40, 44, 48, 56]
const LADO: Readonly<Record<TamanhoDoLadrilho, string>> = { 32: 'size-8', 36: 'size-9', 40: 'size-10', 44: 'size-11', 48: 'size-12', 56: 'size-14' }

function ladrilhoDe(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-ladrilho]') as HTMLElement
}

describe('Ladrilho', () => {
  it('com `rotulo` é uma imagem com esse nome, e o ícone dentro dele é parte da imagem', () => {
    render(
      <Ladrilho familia="turquesa" tamanho={44} rotulo="Turmas">
        <Icone nome="turmas" tamanho={24} />
      </Ladrilho>,
    )
    const imagem = screen.getByRole('img', { name: 'Turmas' })
    expect(imagem.hasAttribute('data-ladrilho')).toBe(true)
    expect(imagem.getAttribute('aria-hidden')).toBeNull()
    // O `svg` de dentro é decoração: um nome só, e não dois.
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('sem `rotulo` some da leitura de tela: `aria-hidden`, sem papel e sem nome', () => {
    const { container } = render(
      <Ladrilho familia="verde" tamanho={36}>
        <BookOpen aria-hidden="true" />
      </Ladrilho>,
    )
    const ladrilho = ladrilhoDe(container)
    expect(ladrilho.getAttribute('aria-hidden')).toBe('true')
    expect(ladrilho.getAttribute('role')).toBeNull()
    expect(ladrilho.getAttribute('aria-label')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('`rotulo` vazio é o mesmo que sem rótulo', () => {
    const { container } = render(
      <Ladrilho familia="verde" tamanho={36} rotulo="">
        <BookOpen aria-hidden="true" />
      </Ladrilho>,
    )
    const ladrilho = ladrilhoDe(container)
    expect(ladrilho.getAttribute('aria-hidden')).toBe('true')
    expect(ladrilho.getAttribute('role')).toBeNull()
    expect(ladrilho.getAttribute('aria-label')).toBeNull()
  })

  it('serve ao ícone ilustrado e ao do `lucide`: o filho aparece dentro, uma vez, e o ícone preenche a caixa de 72%', () => {
    const { container: ilustrado } = render(
      <Ladrilho familia="laranja" tamanho={40}>
        <Icone nome="inicio" tamanho={24} />
      </Ladrilho>,
    )
    expect(ladrilhoDe(ilustrado).querySelectorAll('svg[data-icone="inicio"]')).toHaveLength(1)
    const { container: lucide } = render(
      <Ladrilho familia="azul" tamanho={40}>
        <BookOpen aria-hidden="true" />
      </Ladrilho>,
    )
    expect(ladrilhoDe(lucide).querySelectorAll('svg')).toHaveLength(1)
    for (const container of [ilustrado, lucide]) {
      const caixa = ladrilhoDe(container).firstElementChild as HTMLElement
      const classes = classesDo(caixa)
      // 72% do lado, e o `svg` de dentro (qualquer um) preenche essa caixa por CSS.
      expect(classes.has('size-[72%]')).toBe(true)
      expect(classes.has('[&>svg]:size-full')).toBe(true)
      expect(caixa.querySelector('svg')?.parentElement).toBe(caixa)
    }
  })

  it('cada uma das dez famílias tem o fundo `claro` e o texto `texto` dela, e nenhuma classe repete', () => {
    const vistos = new Set<string>()
    for (const familia of FAMILIAS_DE_COR) {
      const { container, unmount } = render(
        <Ladrilho familia={familia} tamanho={40}>
          <BookOpen aria-hidden="true" />
        </Ladrilho>,
      )
      const classes = classesDo(ladrilhoDe(container))
      expect(classes.has(`bg-${familia}-claro`), familia).toBe(true)
      expect(classes.has(`text-${familia}-texto`), familia).toBe(true)
      expect(ladrilhoDe(container).getAttribute('data-ladrilho'), familia).toBe(familia)
      vistos.add(`bg-${familia}-claro`)
      unmount()
    }
    expect(vistos.size).toBe(FAMILIAS_DE_COR.length)
  })

  it('o texto da família tem 4,5:1 sobre o `claro` dela nos dois temas (o `lucide` desenha com esse `currentColor`)', () => {
    for (const tema of TEMAS) {
      for (const familia of FAMILIAS_DE_COR) {
        expect(contraste(corDoToken(tema, `${familia}-texto`), corDoToken(tema, `${familia}-claro`)), `${familia} no ${tema}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('cada tamanho é o lado dele, por classe literal, e dois tamanhos não dão a mesma classe', () => {
    const lados = new Set<string>()
    for (const tamanho of TAMANHOS) {
      const { container, unmount } = render(
        <Ladrilho familia="azul" tamanho={tamanho}>
          <BookOpen aria-hidden="true" />
        </Ladrilho>,
      )
      const classes = classesDo(ladrilhoDe(container))
      expect(classes.has(LADO[tamanho]), String(tamanho)).toBe(true)
      lados.add(LADO[tamanho])
      unmount()
    }
    expect(lados.size).toBe(TAMANHOS.length)
  })

  it('é o quadrado de canto 12 que não encolhe, centrado, e não é controle: nada que receba foco', () => {
    const { container } = render(
      <Ladrilho familia="roxo" tamanho={48}>
        <Icone nome="ferramentas" tamanho={24} />
      </Ladrilho>,
    )
    const classes = classesDo(ladrilhoDe(container))
    for (const classe of ['rounded-controle', 'shrink-0', 'inline-flex', 'items-center', 'justify-center']) expect(classes.has(classe), classe).toBe(true)
    expect(container.querySelector('button, a, input, [tabindex]')).toBeNull()
  })

  it('parado: nenhuma animação nem transição, e nenhum estilo em linha', () => {
    const { container } = render(
      <Ladrilho familia="rosa" tamanho={56}>
        <BookOpen aria-hidden="true" />
      </Ladrilho>,
    )
    const todos = [ladrilhoDe(container), ...ladrilhoDe(container).querySelectorAll('*')]
    for (const elemento of todos) {
      expect(elemento.getAttribute('style'), elemento.tagName).toBeNull()
      expect([...classesDo(elemento)].filter((classe) => /^(animate|transition|duration|motion)/.test(classe))).toEqual([])
    }
  })
})
