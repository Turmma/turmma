// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { Eye } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesDo } from '../../__fixtures__/class-colors'
import { Banner } from './Banner'
import { StatusBadge, STATUS_FAMILIES, TEXTO_DO_PENDENTE } from './StatusBadge'

/**
 * O selo e a faixa da D80 (`docs/interface.md` 10.2; Tech Spec da X1, seção 9), com as props e os tokens de hoje. A cor
 * resolvida por tema, os 24 px e o contraste são do e2e da galeria (`e2e/components-states.spec.ts`), que mede o que o
 * navegador calcula; aqui está o que o `jsdom` sabe: o texto, o glifo, o papel e a classe que carrega cada regra.
 */
afterEach(cleanup)

function selo(familia: (typeof STATUS_FAMILIES)[number]) {
  const { container, unmount } =
    familia === 'pendente' ? render(<StatusBadge familia="pendente" />) : render(<StatusBadge familia={familia}>Texto do selo</StatusBadge>)
  return { alvo: container.querySelector('[data-estado]') as HTMLElement, unmount }
}

describe('Estado', () => {
  it('diz o estado em texto e em glifo, uma forma por família: nunca só a cor', () => {
    const formas = new Set<string>()
    for (const familia of STATUS_FAMILIES) {
      const { alvo, unmount } = selo(familia)
      expect(alvo.getAttribute('data-estado')).toBe(familia)
      expect((alvo.textContent ?? '').trim().length, familia).toBeGreaterThan(0)
      const glifo = alvo.querySelector('svg') as SVGElement
      expect(glifo.getAttribute('aria-hidden'), `${familia}: o glifo é decoração`).toBe('true')
      formas.add(glifo.innerHTML)
      unmount()
    }
    // Quem não distingue o verde do vermelho distingue a forma.
    expect(formas.size).toBe(STATUS_FAMILIES.length)
  })

  it('o `pendente` sem texto diz "Esperando você", e o texto de quem usa vale nas outras famílias', () => {
    expect(selo('pendente').alvo.textContent).toBe(TEXTO_DO_PENDENTE)
    expect(selo('ok').alvo.textContent).toBe('Texto do selo')
  })

  it('tem a pele da D80: `t-selo`, canto de 8, 24 px de altura mínima e o fundo e o texto da família de hoje', () => {
    const esperado = { pendente: ['bg-pendente-cx', 'text-pendente'], ok: ['bg-ok-cx', 'text-ok'], erro: ['bg-erro-cx', 'text-erro'], info: ['bg-info-cx', 'text-info'] } as const
    for (const familia of STATUS_FAMILIES) {
      const classes = classesDo(selo(familia).alvo)
      for (const classe of ['t-selo', 'rounded-selo', 'min-h-6', 'inline-flex', ...esperado[familia]]) expect(classes.has(classe), `${familia}: ${classe}`).toBe(true)
      // O selo é uma pílula de fundo, sem borda: a borda de 2 px é das caixas, e não deste.
      expect([...classes].filter((classe) => /^border/.test(classe)), familia).toEqual([])
    }
  })

  it('não é controle: nenhum botão, link nem papel dentro', () => {
    const { container } = render(<StatusBadge familia="ok">Aprovado</StatusBadge>)
    expect(container.querySelector('button, a, [role], [tabindex]')).toBeNull()
  })
})

describe('Faixa', () => {
  it('é uma nota, e não uma região viva: `note`, sem `alert` nem `status`', () => {
    render(<Banner>Seu professor acompanha como você usa o Tutor.</Banner>)
    expect(screen.getByRole('note').textContent).toBe('Seu professor acompanha como você usa o Tutor.')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('não fecha: nenhum botão, nenhum link e nada que se alcance pelo Tab', () => {
    const { container } = render(<Banner icone={Eye}>Seu professor acompanha como você usa o Tutor.</Banner>)
    expect(container.querySelector('button, a, input, [tabindex]')).toBeNull()
  })

  it('tem o glifo decorativo e a pele da D80: a borda de 2 px em `borda`, o fundo e o texto da família `info`', () => {
    const { container } = render(<Banner>Aviso.</Banner>)
    const glifo = container.querySelector('svg') as SVGElement
    expect(glifo.getAttribute('aria-hidden')).toBe('true')
    const classes = classesDo(screen.getByRole('note'))
    for (const classe of ['border-2', 'border-borda', 'rounded-controle', 'bg-info-cx', 'text-info', 't-apoio']) expect(classes.has(classe), classe).toBe(true)
  })
})
