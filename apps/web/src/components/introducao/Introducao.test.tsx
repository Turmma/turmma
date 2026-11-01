// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignOutContext } from '../sign-out-context'
import { Introducao, type PassoDaIntroducao } from './Introducao'

/**
 * A introdução passo a passo (tarefa 5.0 da X4; RF3, RF13, RF16, RF19; mockup 2.8): a ordem e o foco, os botões iguais, o
 * passo obrigatório e o rever, a onça de cada passo e a moldura de foco. Os textos são de nome inventado: os dos três papéis
 * são das tarefas 9.0 a 11.0. A casca em foco está em `CascaEmFoco.test.tsx`.
 */
afterEach(cleanup)

const PASSOS: readonly PassoDaIntroducao[] = [
  { pose: 'acenando', fala: 'Primeira fala de exemplo.', obrigatorio: true, conteudo: <p>Conteúdo um</p> },
  { pose: 'apontando', fala: 'Segunda fala de exemplo.', obrigatorio: true, conteudo: <p>Conteúdo dois</p> },
  { pose: 'apontando', fala: 'Terceira fala de exemplo.', obrigatorio: false },
  { pose: 'acenando', fala: 'Quarta fala de exemplo.', obrigatorio: false },
]

function abrir(opcoes: { revendo?: boolean; passos?: readonly PassoDaIntroducao[]; focarNaAbertura?: boolean; sair?: () => void; saindo?: boolean } = {}) {
  const aoConcluir = vi.fn()
  const aoPular = vi.fn()
  const sair = opcoes.sair ?? vi.fn()
  const peca = (
    <SignOutContext value={{ sair, saindo: opcoes.saindo ?? false }}>
      <Introducao
        passos={opcoes.passos ?? PASSOS}
        agente="tutor"
        {...(opcoes.revendo === undefined ? {} : { revendo: opcoes.revendo })}
        {...(opcoes.focarNaAbertura === undefined ? {} : { focarNaAbertura: opcoes.focarNaAbertura })}
        aoConcluir={aoConcluir}
        aoPular={aoPular}
      />
    </SignOutContext>
  )
  return { aoConcluir, aoPular, sair, ...render(peca) }
}

const continuar = () => fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
const fala = () => screen.getByRole('heading', { level: 1 })

/** Avança até o passo `n` (a partir de 1) pelo botão. */
function irAoPasso(n: number): void {
  for (let passo = 1; passo < n; passo++) continuar()
}

describe('Introducao: ordem e foco', () => {
  it('abre no passo 1 com a fala como `h1`, o foco nela e o leitor ouvindo "Passo 1 de 4"', () => {
    abrir()
    expect(fala().textContent).toBe('Primeira fala de exemplo.')
    expect(document.activeElement).toBe(fala())
    const descricao = document.getElementById(fala().getAttribute('aria-describedby') ?? '')
    expect(descricao?.textContent).toBe('Passo 1 de 4')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('cada "Continuar" mostra o passo seguinte, leva o foco à fala nova e o leitor ouve "Passo 2 de 4"', () => {
    abrir()
    continuar()
    expect(fala().textContent).toBe('Segunda fala de exemplo.')
    expect(document.activeElement).toBe(fala())
    expect(document.getElementById(fala().getAttribute('aria-describedby') ?? '')?.textContent).toBe('Passo 2 de 4')
    expect(screen.getByText('Conteúdo dois')).toBeTruthy()
    expect(screen.queryByText('Conteúdo um')).toBeNull()
    continuar()
    expect(document.activeElement).toBe(fala())
    expect(document.getElementById(fala().getAttribute('aria-describedby') ?? '')?.textContent).toBe('Passo 3 de 4')
  })

  it('a barra enche conforme o passo: um quarto, depois metade', () => {
    const { container } = abrir()
    const barra = () => container.querySelector('[data-barra-do-passo]')?.getAttribute('width')
    expect(barra()).toBe('25%')
    continuar()
    expect(barra()).toBe('50%')
  })

  it('o último "Continuar" conclui, e só ele', () => {
    const { aoConcluir, aoPular } = abrir()
    irAoPasso(4)
    expect(aoConcluir).not.toHaveBeenCalled()
    continuar()
    expect(aoConcluir).toHaveBeenCalledTimes(1)
    expect(aoPular).not.toHaveBeenCalled()
  })

  it('na galeria, com focarNaAbertura desligado, a abertura não leva o foco, mas o passo seguinte leva', () => {
    abrir({ focarNaAbertura: false })
    expect(document.activeElement).toBe(document.body)
    continuar()
    expect(document.activeElement).toBe(fala())
  })

  it('sem passos não desenha nada', () => {
    const { container } = abrir({ passos: [] })
    expect(container.textContent).toBe('')
  })
})

describe('Introducao: Enter continua', () => {
  it('Enter com o foco na fala avança um passo; no último, conclui', () => {
    const { aoConcluir } = abrir()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' })
    expect(fala().textContent).toBe('Segunda fala de exemplo.')
    irAoPasso(4 - 1)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' })
    expect(aoConcluir).toHaveBeenCalledTimes(1)
  })

  it('Enter com o foco no corpo da página também avança', () => {
    abrir()
    ;(document.activeElement as HTMLElement).blur()
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(fala().textContent).toBe('Segunda fala de exemplo.')
  })

  it('Enter num botão é do botão: não avança por cima dele', () => {
    const { aoPular } = abrir({ passos: [{ pose: 'acenando', fala: 'Livre.', obrigatorio: false }, ...PASSOS] })
    const pular = screen.getByRole('button', { name: 'Pular' })
    pular.focus()
    fireEvent.keyDown(pular, { key: 'Enter' })
    expect(fala().textContent).toBe('Livre.')
    expect(aoPular).not.toHaveBeenCalled()
    const sair = screen.getByRole('button', { name: 'Sair' })
    fireEvent.keyDown(sair, { key: 'Enter' })
    expect(fala().textContent).toBe('Livre.')
  })

  it('segurar a tecla avança um passo só', () => {
    abrir()
    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.keyDown(document.body, { key: 'Enter', repeat: true })
    fireEvent.keyDown(document.body, { key: 'Enter', repeat: true })
    expect(fala().textContent).toBe('Segunda fala de exemplo.')
  })

  it('Enter que outra peça já tratou com preventDefault não avança', () => {
    abrir()
    const tratou = (evento: Event) => evento.preventDefault()
    document.body.addEventListener('keydown', tratou)
    fireEvent.keyDown(document.body, { key: 'Enter' })
    document.body.removeEventListener('keydown', tratou)
    expect(fala().textContent).toBe('Primeira fala de exemplo.')
  })

  it('outra tecla não avança', () => {
    abrir()
    fireEvent.keyDown(document.body, { key: ' ' })
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(fala().textContent).toBe('Primeira fala de exemplo.')
  })

  it('depois de desmontar, Enter e Esc não fazem nada', () => {
    const { aoConcluir, aoPular, unmount } = abrir({ revendo: true })
    unmount()
    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(aoConcluir).not.toHaveBeenCalled()
    expect(aoPular).not.toHaveBeenCalled()
  })
})

describe('Introducao: botões iguais (RF16)', () => {
  it('"Continuar" e "Pular" saem com a mesma classe, o mesmo tamanho e o mesmo peso, e 44 px de toque', () => {
    abrir({ passos: [{ pose: 'acenando', fala: 'Livre.', obrigatorio: false }] })
    const continuarBotao = screen.getByRole('button', { name: 'Continuar' })
    const pular = screen.getByRole('button', { name: 'Pular' })
    expect(pular.className).toBe(continuarBotao.className)
    expect(continuarBotao.className).toMatch(/\bmin-h-11\b/)
    expect(continuarBotao.className).toMatch(/\bt-rotulo\b/)
    // O "Sair" não é menor que o "Continuar" (D59): o mesmo desenho secundário, com a mesma altura.
    const sair = screen.getByRole('button', { name: 'Sair' })
    expect(sair.className).toMatch(/\bmin-h-11\b/)
    expect(sair.className).toMatch(/\bt-rotulo\b/)
  })
})

describe('Introducao: o passo obrigatório e o rever', () => {
  it('passo obrigatório: sem "Pular", sem "Fechar", e o Esc não sai', () => {
    const { aoPular } = abrir()
    expect(screen.queryByRole('button', { name: 'Pular' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.keyDown(fala(), { key: 'Escape' })
    expect(aoPular).not.toHaveBeenCalled()
    // O "Sair" e o "Continuar" continuam à vista.
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy()
  })

  it('passo livre na primeira vez: tem "Pular", que avisa quem chama; não tem "Fechar" nem Esc', () => {
    const { aoPular } = abrir()
    irAoPasso(3)
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(aoPular).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Pular' }))
    expect(aoPular).toHaveBeenCalledTimes(1)
  })

  it('revendo, todo passo fecha: "Fechar" em cada um, e o Esc também; o passo obrigatório deixa de o ser', () => {
    const { aoPular } = abrir({ revendo: true })
    for (let passo = 1; passo <= PASSOS.length; passo++) {
      expect(document.getElementById(fala().getAttribute('aria-describedby') ?? '')?.textContent).toBe(`Passo ${String(passo)} de 4`)
      expect(screen.getAllByRole('button', { name: 'Fechar' }), `passo ${String(passo)}`).toHaveLength(1)
      // Revendo, o que "Pular" marcaria já está marcado: só "Fechar".
      expect(screen.queryByRole('button', { name: 'Pular' }), `passo ${String(passo)}`).toBeNull()
      if (passo < PASSOS.length) continuar()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(aoPular).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(aoPular).toHaveBeenCalledTimes(2)
  })

  it('revendo que chega depois: a peça já aberta, ao receber `revendo`, passa a fechar em todo passo, inclusive no obrigatório', () => {
    // É o que a `BemVindo` faz quando o `['eu']` vem do cache, ou volta depois do erro e do "Tentar de novo": a primeira
    // pintura é a da primeira vez, e a data chega com a introdução já aberta.
    const aoConcluir = vi.fn()
    const aoPular = vi.fn()
    const desenho = (revendo: boolean) => (
      <SignOutContext value={{ sair: vi.fn(), saindo: false }}>
        <Introducao passos={PASSOS} agente="tutor" revendo={revendo} aoConcluir={aoConcluir} aoPular={aoPular} />
      </SignOutContext>
    )
    const { rerender } = render(desenho(false))
    expect(fala().textContent).toBe('Primeira fala de exemplo.')
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(aoPular).not.toHaveBeenCalled()

    rerender(desenho(true))
    // O passo em que a pessoa está não muda: só os botões.
    expect(fala().textContent).toBe('Primeira fala de exemplo.')
    for (let passo = 1; passo <= PASSOS.length; passo++) {
      expect(screen.getAllByRole('button', { name: 'Fechar' }), `passo ${String(passo)}`).toHaveLength(1)
      expect(screen.queryByRole('button', { name: 'Pular' }), `passo ${String(passo)}`).toBeNull()
      if (passo < PASSOS.length) continuar()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(aoPular).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(aoPular).toHaveBeenCalledTimes(2)
    expect(aoConcluir).not.toHaveBeenCalled()
  })

  it('o "Fechar" tem o desenho do "Sair" e do "Continuar"', () => {
    abrir({ revendo: true })
    const fechar = screen.getByRole('button', { name: 'Fechar' })
    expect(fechar.className).toBe(screen.getByRole('button', { name: 'Sair' }).className)
  })
})

describe('Introducao: a moldura de foco e o "Sair"', () => {
  it('"Sair" está à vista em todo passo, e é o da casca (o contexto)', () => {
    const { sair } = abrir()
    for (let passo = 1; passo <= PASSOS.length; passo++) {
      expect(screen.getAllByRole('button', { name: 'Sair' }), `passo ${String(passo)}`).toHaveLength(1)
      if (passo < PASSOS.length) continuar()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(sair).toHaveBeenCalledTimes(1)
  })

  it('saindo, o botão diz "Saindo…" e não repete o clique', () => {
    const { sair } = abrir({ saindo: true })
    const botao = screen.getByRole('button', { name: 'Saindo…' }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
    fireEvent.click(botao)
    expect(sair).not.toHaveBeenCalled()
  })

  it('não desenha `<main>`: o da casca é o único da página', () => {
    const { container } = abrir()
    expect(container.querySelectorAll('main')).toHaveLength(0)
  })
})

describe('Introducao: a onça de cada passo (RF19)', () => {
  it('desenha a pose do passo, com a função e o selo "IA", e nunca a comemorando', () => {
    const { container } = abrir()
    const poses = []
    for (let passo = 1; passo <= PASSOS.length; passo++) {
      const onca = container.querySelectorAll('[data-onca]')
      expect(onca, `passo ${String(passo)}`).toHaveLength(1)
      poses.push(onca[0]?.getAttribute('data-pose'))
      expect(onca[0]?.querySelector('figcaption')?.textContent).toMatch(/^Tutor/)
      expect(onca[0]?.querySelectorAll('[data-selo-ia]')).toHaveLength(1)
      if (passo < PASSOS.length) continuar()
    }
    expect(poses).toEqual(PASSOS.map((passo) => passo.pose))
    expect(poses).not.toContain('comemorando')
  })

  it('o passo só aceita acenando, apontando ou pensando', () => {
    const passo: PassoDaIntroducao = {
      // @ts-expect-error a pose de festa é da `Comemoracao`: a introdução nunca comemora
      pose: 'comemorando',
      fala: 'x',
      obrigatorio: false,
    }
    expect(passo.fala).toBe('x')
    const invalido: PassoDaIntroducao = {
      // @ts-expect-error a expressão de preocupação não existe
      pose: 'acolhendo',
      fala: 'x',
      obrigatorio: false,
    }
    expect(invalido.fala).toBe('x')
  })

  it('a onça não se mexe: nenhum temporizador entre um passo e outro', () => {
    vi.useFakeTimers()
    abrir()
    const antes = vi.getTimerCount()
    continuar()
    expect(vi.getTimerCount()).toBe(antes)
    vi.useRealTimers()
  })
})
