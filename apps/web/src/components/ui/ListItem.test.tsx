// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classesDo } from '../../__fixtures__/class-colors'
import { ListItem } from './ListItem'

/**
 * A linha de lista da D80 (`docs/interface.md` 10.2; Tech Spec da X1, seção 9, "Foco" e "Alvo de toque"): a linha inteira
 * é **um** alvo, e o que o teclado e o leitor de tela veem é isso. A altura de 64 px, o anel por dentro e a reticência são
 * do e2e da galeria (`e2e/components-surfaces.spec.ts`), que mede o que o navegador calcula; aqui está o que o `jsdom`
 * sabe: o elemento, o nome, o teclado e as classes que carregam a regra.
 */
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

/** Tudo o que o Tab alcança dentro do elemento. */
const FOCAVEL = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
const focaveisDe = (raiz: Element) => [...raiz.querySelectorAll(FOCAVEL)]

function linhaDe(texto: string | RegExp): HTMLElement {
  const alvo = screen.getByText(texto).closest('a, button, div')
  if (!(alvo instanceof HTMLElement)) throw new Error('a linha não está na tela')
  return alvo
}

describe('Linha', () => {
  it('com `para`, a linha inteira é um link só, e o título, a segunda linha e o fim entram no nome dele', () => {
    render(
      <ul>
        <li>
          <ListItem para="/turmas/2b" titulo="Atividade de estequiometria" abaixo="2ºB · entregas até 24/10" fim={<span>Esperando você</span>} />
        </li>
      </ul>,
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/turmas/2b')
    expect(link.textContent).toContain('Atividade de estequiometria')
    expect(screen.getByRole('link', { name: /Atividade de estequiometria.*2ºB · entregas até 24\/10.*Esperando você/ })).toBe(link)
    // Um alvo só: nada focável dentro dele, e a lista inteira tem um.
    expect(focaveisDe(link)).toEqual([])
    expect(focaveisDe(screen.getByRole('list'))).toEqual([link])
  })

  it('com `aoAcionar`, é um botão só: o clique, o Enter e o Espaço acionam, cada um uma vez', async () => {
    const usuario = userEvent.setup()
    const aoAcionar = vi.fn()
    render(<ListItem aoAcionar={aoAcionar} titulo="Resultado da lista 3" abaixo="Corrigida em 19/09" />)
    const botao = screen.getByRole('button', { name: /Resultado da lista 3/ })
    expect(botao.getAttribute('type')).toBe('button')
    expect(screen.queryByRole('link')).toBeNull()

    await usuario.click(botao)
    expect(aoAcionar).toHaveBeenCalledTimes(1)
    // O clique já deu o foco ao botão: o teclado age sobre a linha inteira.
    expect(document.activeElement).toBe(botao)
    await usuario.keyboard('{Enter}')
    expect(aoAcionar).toHaveBeenCalledTimes(2)
    await usuario.keyboard(' ')
    expect(aoAcionar).toHaveBeenCalledTimes(3)
  })

  it('`para` e `aoAcionar` não vão juntos: a linha é um link ou um botão, e o tipo recusa os dois', () => {
    // A exclusão é do tipo (`never`), e quem a prova é o `tsc` do portão: se a união deixasse passar as duas props, o
    // `@ts-expect-error` abaixo ficaria sem erro para esperar e o typecheck falharia.
    // @ts-expect-error -- `para` e `aoAcionar` juntos
    const duas = <ListItem para="/a" aoAcionar={() => undefined} titulo="Duas ações" />
    expect(duas.type).toBe(ListItem)
  })

  it('com `para`, o Enter navega', async () => {
    const usuario = userEvent.setup()
    render(<ListItem para="/turmas/2b" titulo="Turma 2ºB" />)
    await usuario.tab()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Turma 2ºB' }))
    await usuario.keyboard('{Enter}')
    expect(window.location.pathname).toBe('/turmas/2b')
  })

  it('sem ação, é só leitura: nenhum focável, nenhum chevron e nada que a leitura de tela anuncie como link ou botão', async () => {
    const usuario = userEvent.setup()
    const { container } = render(<ListItem titulo="Camila Souza" abaixo="Professora de Química" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(focaveisDe(container)).toEqual([])
    expect(container.querySelector('svg')).toBeNull()
    await usuario.tab()
    expect(document.activeElement).toBe(document.body)
    // O texto continua lá, para ler.
    expect(screen.getByText('Camila Souza')).toBeTruthy()
    expect(screen.getByText('Professora de Química')).toBeTruthy()
    // E a linha de leitura não finge que se aperta: sem o realce do hover.
    expect(classesDo(linhaDe('Camila Souza')).has('hover:bg-fundo-suave')).toBe(false)
  })

  it('o chevron do fim é decoração e só existe quando há ação', () => {
    const { container } = render(
      <>
        <ListItem para="/a" titulo="Com link" />
        <ListItem aoAcionar={() => undefined} titulo="Com botão" />
        <ListItem titulo="Só leitura" />
      </>,
    )
    const chevrons = [...container.querySelectorAll('svg')]
    expect(chevrons).toHaveLength(2)
    for (const chevron of chevrons) {
      expect(chevron.getAttribute('aria-hidden')).toBe('true')
      expect(classesDo(chevron).has('text-apagado')).toBe(true)
      expect(classesDo(chevron).has('size-5'), 'chevron de 20 px').toBe(true)
      expect(chevron.closest('a, button')).not.toBeNull()
    }
    // O chevron é o último do alvo: no fim, depois do que a linha diz.
    const link = screen.getByRole('link')
    expect(link.lastElementChild).toBe(chevrons[0])
  })

  it('o título é de uma linha, com reticências, e o `title` guarda o texto inteiro', () => {
    const comprido = 'Relatório de laboratório sobre a titulação ácido-base com indicador de repolho roxo, entregue em três partes'
    render(<ListItem para="/a" titulo={comprido} abaixo="1ºA · Química" />)
    const titulo = screen.getByText(comprido)
    expect(titulo.getAttribute('title')).toBe(comprido)
    const classes = classesDo(titulo)
    expect(classes.has('truncate')).toBe(true)
    expect(classes.has('t-cartao')).toBe(true)
    // A segunda linha não corta: quebra, para o texto inteiro continuar à mão, e é `t-apoio` em `sutil`.
    const abaixo = classesDo(screen.getByText('1ºA · Química'))
    expect(abaixo.has('truncate')).toBe(false)
    expect(abaixo.has('break-words')).toBe(true)
    expect(abaixo.has('t-apoio')).toBe(true)
    expect(abaixo.has('text-sutil')).toBe(true)
  })

  it('o título que pede `tituloEmDuasLinhas` quebra em até duas linhas, sem reticência de uma só', () => {
    render(<ListItem para="/a" titulo="Rever a introdução" tituloEmDuasLinhas />)
    const classes = classesDo(screen.getByText('Rever a introdução'))
    expect(classes.has('line-clamp-2')).toBe(true)
    expect(classes.has('break-words')).toBe(true)
    expect(classes.has('truncate')).toBe(false)
  })

  it('a linha tem 64 px no mínimo, ocupa a largura toda e desenha o anel por dentro', () => {
    render(
      <>
        <ListItem para="/a" titulo="Link" />
        <ListItem aoAcionar={() => undefined} titulo="Botão" />
      </>,
    )
    for (const alvo of [screen.getByRole('link'), screen.getByRole('button')]) {
      const classes = classesDo(alvo)
      expect(classes.has('min-h-16'), 'altura mínima de 64 px').toBe(true)
      expect(classes.has('w-full')).toBe(true)
      expect(classes.has('focus-visible:-outline-offset-3'), 'o anel por dentro').toBe(true)
      expect(classes.has('hover:bg-fundo-suave')).toBe(true)
    }
    expect(classesDo(linhaDe('Link')).has('min-h-16')).toBe(true)
  })

  it('a linha só de leitura também tem 64 px, para a lista não mudar de altura entre uma e outra', () => {
    render(<ListItem titulo="Só leitura" />)
    expect(classesDo(linhaDe('Só leitura')).has('min-h-16')).toBe(true)
  })

  it('o fim desce para baixo do texto no celular e fica à direita dele a partir de 640 px, sem duplicar o conteúdo', () => {
    render(<ListItem para="/a" titulo="Lista de estequiometria" abaixo="2ºB" fim={<span data-teste="fim">Esperando você</span>} />)
    const link = screen.getByRole('link')
    // Uma vez só no documento: o nome do alvo não leva o selo dito duas vezes.
    expect(link.querySelectorAll('[data-teste="fim"]')).toHaveLength(1)
    expect(link.textContent?.match(/Esperando você/g)).toHaveLength(1)
    const fim = link.querySelector('[data-teste="fim"]')?.parentElement as Element
    const corpo = fim.parentElement as Element
    for (const classe of ['flex-col', 'sm:flex-row', 'sm:items-center']) expect(classesDo(corpo).has(classe), `corpo: ${classe}`).toBe(true)
    for (const classe of ['self-start', 'sm:self-center']) expect(classesDo(fim).has(classe), `fim: ${classe}`).toBe(true)
  })

  it('o `inicio` e o `fim` ficam dentro do alvo e não encolhem o título', () => {
    render(<ListItem para="/a" titulo="Com ícone" inicio={<svg data-teste="inicio" aria-hidden="true" />} fim={<span data-teste="fim">Selo</span>} />)
    const link = screen.getByRole('link')
    const inicio = link.querySelector('[data-teste="inicio"]')?.parentElement
    const fim = link.querySelector('[data-teste="fim"]')?.parentElement
    expect(inicio).toBeTruthy()
    expect(fim).toBeTruthy()
    expect(classesDo(inicio as Element).has('shrink-0')).toBe(true)
    expect(classesDo(fim as Element).has('shrink-0')).toBe(true)
    // O título, que é o que encolhe, está entre os dois.
    const titulo = screen.getByText('Com ícone').parentElement as Element
    expect(classesDo(titulo).has('min-w-0')).toBe(true)
    expect(classesDo(titulo).has('flex-1')).toBe(true)
  })
})
