// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classesDo, contraste, corDoToken, TEMAS, tokenOuFalha } from '../../../__fixtures__/class-colors'
import { Switch } from './Switch'

/**
 * O interruptor da D80 (`docs/interface.md` 10.2): `role="switch"`, que troca na hora com o clique, o Espaço e o Enter, e
 * que desligado não troca. A medida (52 × 32 px, 44 de área de toque abaixo de 768) e o anel são do e2e da galeria.
 */
afterEach(cleanup)

function Controlado({ inicial = false, desligado = false, aoMudar = () => undefined }: { inicial?: boolean; desligado?: boolean; aoMudar?: (ligado: boolean) => void }) {
  const [ligado, definirLigado] = useState(inicial)
  return (
    <>
      <button type="button">antes</button>
      <Switch
        rotulo="Avisar a turma"
        ligado={ligado}
        desligado={desligado}
        aoMudar={(novo) => {
          definirLigado(novo)
          aoMudar(novo)
        }}
      />
    </>
  )
}

const interruptor = () => screen.getByRole('switch', { name: 'Avisar a turma' })

describe('Interruptor', () => {
  it('é um switch com o rótulo por nome, e aria-checked diz se está ligado', () => {
    render(<Controlado inicial />)
    expect(interruptor().getAttribute('aria-checked')).toBe('true')
    cleanup()
    render(<Controlado />)
    expect(interruptor().getAttribute('aria-checked')).toBe('false')
  })

  it('o clique troca na hora, nos dois sentidos, e avisa o valor novo', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Controlado aoMudar={aoMudar} />)
    await usuario.click(interruptor())
    expect(interruptor().getAttribute('aria-checked')).toBe('true')
    await usuario.click(interruptor())
    expect(interruptor().getAttribute('aria-checked')).toBe('false')
    expect(aoMudar.mock.calls).toEqual([[true], [false]])
  })

  it('o Espaço e o Enter trocam quando o foco está nele, um de cada vez', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Controlado aoMudar={aoMudar} />)
    await usuario.click(screen.getByRole('button', { name: 'antes' }))
    await usuario.tab()
    expect(document.activeElement).toBe(interruptor())
    await usuario.keyboard(' ')
    expect(interruptor().getAttribute('aria-checked')).toBe('true')
    await usuario.keyboard('{Enter}')
    expect(interruptor().getAttribute('aria-checked')).toBe('false')
    expect(aoMudar.mock.calls).toEqual([[true], [false]])
  })

  it('desligado (fora de uso) não troca com o clique nem com a tecla, e o Tab passa por ele', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Controlado inicial desligado aoMudar={aoMudar} />)
    const peca = interruptor()
    expect(peca).toHaveProperty('disabled', true)
    await usuario.click(peca)
    peca.focus()
    await usuario.keyboard(' ')
    await usuario.keyboard('{Enter}')
    expect(peca.getAttribute('aria-checked')).toBe('true')
    expect(aoMudar).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'antes' }))
    await usuario.tab()
    expect(document.activeElement).not.toBe(peca)
  })

  it('os dois estados diferem pela posição da bolinha, e não só pela cor', () => {
    render(<Controlado />)
    const trilho = interruptor().firstElementChild as HTMLElement
    expect(classesDo(trilho).has('justify-start')).toBe(true)
    expect(classesDo(trilho).has('justify-end')).toBe(false)
    cleanup()
    render(<Controlado inicial />)
    const ligado = interruptor().firstElementChild as HTMLElement
    expect(classesDo(ligado).has('justify-end')).toBe(true)
    expect(classesDo(ligado).has('justify-start')).toBe(false)
  })

  it('fora de uso o trilho é fundo-suave com borda borda e a bolinha borda-campo, sem opacidade, e a posição ainda diz o estado', () => {
    for (const inicial of [false, true]) {
      render(<Controlado inicial={inicial} desligado />)
      const peca = interruptor()
      const trilho = peca.firstElementChild as HTMLElement
      const bolinha = trilho.firstElementChild as HTMLElement
      expect([tokenOuFalha(trilho, 'bg'), tokenOuFalha(trilho, 'border'), tokenOuFalha(bolinha, 'bg')], `ligado ${String(inicial)}`).toEqual(['fundo-suave', 'borda', 'borda-campo'])
      expect(classesDo(trilho).has(inicial ? 'justify-end' : 'justify-start'), `ligado ${String(inicial)}: a bolinha`).toBe(true)
      expect(classesDo(trilho).has(inicial ? 'justify-start' : 'justify-end')).toBe(false)
      for (const elemento of [peca, trilho, bolinha]) {
        expect([...classesDo(elemento)].filter((classe) => classe.includes('opacity')), `ligado ${String(inicial)}: um jeito só de mostrar o desligado`).toEqual([])
      }
      cleanup()
    }
  })

  it('o trilho desligado tem a borda borda-campo, de 3:1 contra o chão, nos dois temas', () => {
    render(<Controlado />)
    const trilho = interruptor().firstElementChild as HTMLElement
    expect(classesDo(trilho).has('border-2')).toBe(true)
    const borda = tokenOuFalha(trilho, 'border')
    expect(borda).toBe('borda-campo')
    for (const tema of TEMAS) expect(contraste(corDoToken(tema, borda), corDoToken(tema, 'fundo')), tema).toBeGreaterThanOrEqual(3)
  })

  it('o trilho ligado é azul com a borda azul-degrau, de 3:1 contra o chão, nos dois temas', () => {
    render(<Controlado inicial />)
    const trilho = interruptor().firstElementChild as HTMLElement
    expect(tokenOuFalha(trilho, 'bg')).toBe('azul')
    const borda = tokenOuFalha(trilho, 'border')
    expect(borda).toBe('azul-degrau')
    for (const tema of TEMAS) expect(contraste(corDoToken(tema, borda), corDoToken(tema, 'fundo')), tema).toBeGreaterThanOrEqual(3)
  })
})
