import { describe, expect, it } from 'vitest'
import { percentualDaBarra, preenchimentoDaBarra } from './progress'

describe('a barra rotulada', () => {
  it('preenche na proporção do valor sobre o máximo', () => {
    expect(preenchimentoDaBarra(72)).toBe(72)
    expect(preenchimentoDaBarra(12, 60)).toBe(20)
    expect(preenchimentoDaBarra(0, 60)).toBe(0)
  })

  it('o valor acima do máximo é barra cheia, e o abaixo de zero é barra vazia: a barra nunca estoura a trilha', () => {
    expect(preenchimentoDaBarra(70, 60)).toBe(100)
    expect(preenchimentoDaBarra(-5, 60)).toBe(0)
  })

  it('máximo zero, negativo ou inválido é barra vazia, e não NaN no desenho', () => {
    expect(preenchimentoDaBarra(10, 0)).toBe(0)
    expect(preenchimentoDaBarra(10, -3)).toBe(0)
    expect(preenchimentoDaBarra(Number.NaN, 60)).toBe(0)
    expect(preenchimentoDaBarra(10, Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('o texto padrão é o percentual inteiro', () => {
    expect(percentualDaBarra(72)).toBe('72%')
    expect(percentualDaBarra(1, 3)).toBe('33%')
    expect(percentualDaBarra(70, 60)).toBe('100%')
  })
})
