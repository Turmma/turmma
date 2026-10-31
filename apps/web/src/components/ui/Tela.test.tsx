// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesDo } from '../../__fixtures__/class-colors'
import { Tela, type LarguraDaTela } from './Tela'

/**
 * A moldura de toda tela (RF12, RF23; `docs/interface.md` 9.3 e 11.2; Tech Spec da X1, seção 9, "Página"). O `jsdom` não
 * tem a folha de estilo: o que se mede aqui é o que a `Tela` escreve (o elemento, a classe e o atributo). A caixa que o
 * navegador desenha, de 24 px, com 64 px de cabeçalho, é do e2e (`e2e/titulo-da-tela.spec.ts`).
 */
afterEach(cleanup)

const titulo = () => screen.getByRole('heading', { level: 1 })

describe('Tela: o título', () => {
  it('o `h1` é o título dado, visível, em `t-titulo`, dentro do cabeçalho; a descrição e as ações ficam ao lado dele', () => {
    render(
      <Tela titulo="Estrutura" descricao="A escola, montada" acoes={<button type="button">Nova turma</button>}>
        <p>miolo</p>
      </Tela>,
    )

    const h1 = titulo()
    expect(h1.textContent).toBe('Estrutura')
    expect(classesDo(h1).has('sr-only')).toBe(false)
    expect(classesDo(h1).has('t-titulo')).toBe(true)
    const cabecalho = h1.closest('header') as HTMLElement
    expect(cabecalho).not.toBeNull()
    // No mínimo 64 px: a classe que o diz.
    expect(classesDo(cabecalho).has('min-h-16')).toBe(true)
    expect(cabecalho.textContent).toContain('A escola, montada')
    expect(cabecalho.querySelector('button')?.textContent).toBe('Nova turma')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('`tituloSoParaLeitor` esconde só o `h1`: a conversa não ganha cabeçalho, e as ações continuam na tela', () => {
    const { container } = render(
      <Tela titulo="Nova conversa" tituloSoParaLeitor descricao="Uma linha de apoio" acoes={<button type="button">Filtrar</button>}>
        <p>miolo</p>
      </Tela>,
    )

    const h1 = titulo()
    expect(h1.textContent).toBe('Nova conversa')
    expect(classesDo(h1).has('sr-only')).toBe(true)
    expect(classesDo(h1).has('t-titulo')).toBe(false)
    expect(container.querySelector('header')).toBeNull()
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeTruthy()
    // A descrição mora no cabeçalho, que a conversa não tem: ela some com o título, e não fica solta na tela.
    expect(screen.queryByText('Uma linha de apoio')).toBeNull()
  })

  it('`idDoTitulo` chega ao `h1`, nas duas formas, e a `section` que aponta para ele ganha o nome da tela', () => {
    const visivel = render(
      <Tela titulo="Professores" idDoTitulo="titulo-da-tela">
        <section aria-labelledby="titulo-da-tela">miolo</section>
      </Tela>,
    )
    expect(titulo().id).toBe('titulo-da-tela')
    expect(screen.getByRole('region', { name: 'Professores' })).toBeTruthy()
    visivel.unmount()

    render(
      <Tela titulo="Tutor" tituloSoParaLeitor idDoTitulo="titulo-do-tutor">
        miolo
      </Tela>,
    )
    expect(titulo().id).toBe('titulo-do-tutor')
  })

  it('`refDoTitulo` chega ao `h1`, que passa a poder receber o foco por código; sem ele, o `h1` fica fora da ordem de foco', () => {
    const ref = createRef<HTMLHeadingElement>()
    const comRef = render(
      <Tela titulo="Professores" refDoTitulo={ref}>
        miolo
      </Tela>,
    )
    expect(ref.current).toBe(titulo())
    ref.current?.focus()
    expect(document.activeElement).toBe(titulo())
    comRef.unmount()

    render(<Tela titulo="Professores">miolo</Tela>)
    expect(titulo().hasAttribute('tabindex')).toBe(false)
  })

  it('`refDoTitulo` também chega ao `h1` escondido da conversa', () => {
    const ref = createRef<HTMLHeadingElement>()
    render(
      <Tela titulo="Tutor" tituloSoParaLeitor refDoTitulo={ref}>
        miolo
      </Tela>,
    )
    expect(ref.current).toBe(titulo())
    ref.current?.focus()
    expect(document.activeElement).toBe(titulo())
  })
})

describe('Tela: a coluna', () => {
  const LARGURAS: readonly (readonly [LarguraDaTela, string])[] = [
    ['conversa', 'max-w-[768px]'],
    ['leitura', 'max-w-[880px]'],
    ['formulario', 'max-w-[1040px]'],
    ['grade', 'max-w-[1200px]'],
  ]

  it.each(LARGURAS)('a largura `%s` limita a coluna a %s, e só a ela', (largura, classe) => {
    const { container } = render(
      <Tela titulo="Tela" largura={largura}>
        miolo
      </Tela>,
    )
    const coluna = container.querySelector('[data-tela]') as HTMLElement
    expect(coluna.getAttribute('data-tela')).toBe(largura)
    const teto = [...classesDo(coluna)].filter((classe) => classe.startsWith('max-w-'))
    expect(teto).toEqual([classe])
  })

  it('sem largura, a tela é a grade, a moldura inteira', () => {
    const { container } = render(<Tela titulo="Tela">miolo</Tela>)
    expect((container.querySelector('[data-tela]') as HTMLElement).getAttribute('data-tela')).toBe('grade')
  })

  it('`comMargem` põe 16 px dos lados e, a partir de 768 px, 32 px; sem ele, a tela não põe margem nenhuma', () => {
    const com = render(
      <Tela titulo="Tela" comMargem>
        miolo
      </Tela>,
    )
    const colunaComMargem = classesDo(com.container.querySelector('[data-tela]') as HTMLElement)
    expect(colunaComMargem.has('px-4')).toBe(true)
    expect(colunaComMargem.has('md:px-8')).toBe(true)
    // Do topo ao cabeçalho, 24 px, e 32 px no fim do corpo (9.3).
    expect(colunaComMargem.has('pt-6')).toBe(true)
    expect(colunaComMargem.has('pb-8')).toBe(true)
    // A margem antiga, de 24 px, não sobra ao lado da nova.
    expect(colunaComMargem.has('md:px-6')).toBe(false)
    com.unmount()

    const sem = render(<Tela titulo="Tela">miolo</Tela>)
    const colunaSemMargem = [...classesDo(sem.container.querySelector('[data-tela]') as HTMLElement)]
    expect(colunaSemMargem.filter((classe) => /^(md:)?p[xtb]?-\d/.test(classe))).toEqual([])
  })
})
