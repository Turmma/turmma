import { describe, expect, it } from 'vitest'
import { rebaixarColorMix } from './downlevel-color'

// O CSS como o Tailwind 4.3 gera: a cor fixa fora do bloco e a mistura dentro dele.
const PREFLIGHT =
  '::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){::placeholder{color:currentColor}@supports (color:color-mix(in lab, red, red)){::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}}'

describe('rebaixar color-mix() no CSS do build', () => {
  it('tira o bloco @supports do preflight e deixa a cor fixa que vem antes dele', () => {
    expect(rebaixarColorMix(PREFLIGHT)).toBe(
      '::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){::placeholder{color:currentColor}}',
    )
  })

  it('tira o bloco do modificador de opacidade, também dentro de @media, e não mexe no resto', () => {
    const css =
      '.bg-tinta\\/40{background-color:#0d0d0d66}@supports (color:color-mix(in lab, red, red)){.bg-tinta\\/40{background-color:color-mix(in oklab, var(--color-tinta) 40%, transparent)}}' +
      '@media (hover:hover){.a:hover{color:#e8732e}@supports (color:color-mix(in lab, red, red)){.a:hover{color:color-mix(in oklab, var(--color-tinta) 50%, transparent)}}}.b{content:"}"}'
    expect(rebaixarColorMix(css)).toBe('.bg-tinta\\/40{background-color:#0d0d0d66}@media (hover:hover){.a:hover{color:#e8732e}}.b{content:"}"}')
  })

  it('CSS sem color-mix() sai igual', () => {
    const css = '.bg-caramelo{background-color:var(--color-caramelo)}@supports (display:grid){.c{display:grid}}'
    expect(rebaixarColorMix(css)).toBe(css)
  })

  it('para o build com color-mix() ou oklch() fora do @supports, que o Chrome 109 descartaria', () => {
    expect(() => rebaixarColorMix('.x{color:color-mix(in oklab, red 50%, blue)}')).toThrow(/color-mix\(\) fora de @supports/)
    expect(() => rebaixarColorMix('.x{color:oklch(62% .2 40)}')).toThrow(/oklch\(\) fora de @supports/)
  })
})
