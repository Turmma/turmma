// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Textarea } from './Textarea'

afterEach(cleanup)

describe('Textarea: o contador', () => {
  it('é lido ao chegar no campo e não é região viva, a menos que o campo peça', () => {
    render(<Textarea rotulo="Texto" valor="abc" aoMudar={() => undefined} maximo={500} />)
    const contador = screen.getByText('3 de 500', { exact: false })
    expect(contador.getAttribute('aria-live')).toBeNull()
    expect(screen.getByLabelText('Texto').getAttribute('aria-describedby')).toContain(contador.id)
  })

  it('com `contadorAnunciado`, o contador é uma região `aria-live="polite"` ligada ao campo', () => {
    render(<Textarea rotulo="Texto" valor="abc" aoMudar={() => undefined} maximo={500} contadorAnunciado />)
    const contador = screen.getByText('3 de 500', { exact: false })
    expect(contador.getAttribute('aria-live')).toBe('polite')
    expect(screen.getByLabelText('Texto').getAttribute('aria-describedby')).toContain(contador.id)
  })
})
