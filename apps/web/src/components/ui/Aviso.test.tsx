// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesDo } from '../../__fixtures__/class-colors'
import { Aviso, TONS_DE_AVISO, type TomDeAviso } from './Aviso'

/**
 * O aviso da D80 (`docs/interface.md` 10.2; Tech Spec da X1, seção 9): o tom diz-se por glifo e por texto, só o erro é
 * região viva, e nada fecha. A cor da borda e do fundo por tom e o contraste do corpo são do e2e da galeria
 * (`e2e/components-states.spec.ts`), que mede o que o navegador calcula; aqui está o que o `jsdom` sabe.
 */
afterEach(cleanup)

const REGIAO_VIVA = '[role="alert"], [role="status"], [role="log"], [aria-live]'

function desenhar(tom: TomDeAviso, extra: { titulo?: string; acao?: boolean } = {}) {
  return render(
    <Aviso tom={tom} {...(extra.titulo === undefined ? {} : { titulo: extra.titulo })} {...(extra.acao === true ? { acao: <button type="button">Tentar de novo</button> } : {})}>
      O que aconteceu e o que fazer.
    </Aviso>,
  )
}

describe('Aviso', () => {
  it('cada tom tem o glifo dele, e o glifo é decoração: o estado está no texto e na forma, e não na cor', () => {
    const glifos = new Map<TomDeAviso, string>()
    for (const tom of TONS_DE_AVISO) {
      const { container, unmount } = desenhar(tom, { titulo: 'Título do aviso' })
      const aviso = container.querySelector(`[data-aviso="${tom}"]`) as HTMLElement
      const svg = aviso.querySelector('svg') as SVGElement
      expect(svg, tom).not.toBeNull()
      // O círculo que leva o glifo some da leitura de tela: o título e o corpo dizem tudo o que o glifo diria.
      expect(svg.closest('[aria-hidden="true"]'), tom).not.toBeNull()
      glifos.set(tom, [...classesDo(svg)].find((classe) => classe.startsWith('lucide-')) ?? '')
      expect(aviso.textContent, tom).toContain('Título do aviso')
      expect(aviso.textContent, tom).toContain('O que aconteceu e o que fazer.')
      unmount()
    }
    // Quatro formas diferentes: o aviso de erro não se confunde com o de atenção para quem não distingue as cores.
    expect(new Set(glifos.values()).size).toBe(TONS_DE_AVISO.length)
    expect([...glifos.values()].filter((glifo) => glifo === '')).toEqual([])
  })

  it('só o erro é `alert`; informação, atenção e certo não têm nenhum papel vivo', () => {
    for (const tom of TONS_DE_AVISO) {
      const { container, unmount } = desenhar(tom, { titulo: 'Título' })
      const vivas = container.querySelectorAll(REGIAO_VIVA)
      if (tom === 'erro') {
        expect(vivas, tom).toHaveLength(1)
        expect(vivas[0]?.getAttribute('role')).toBe('alert')
      } else {
        expect(vivas, tom).toHaveLength(0)
      }
      unmount()
    }
  })

  it('o `alert` é só a mensagem: o título e o corpo entram, e o botão da ação fica fora dele', () => {
    desenhar('erro', { titulo: 'Não foi possível salvar', acao: true })
    const alerta = screen.getByRole('alert')
    expect(within(alerta).getByText('Não foi possível salvar')).toBeTruthy()
    expect(within(alerta).getByText('O que aconteceu e o que fazer.')).toBeTruthy()
    expect(within(alerta).queryByRole('button')).toBeNull()
    // A ação existe, e está dentro do aviso.
    const botao = screen.getByRole('button', { name: 'Tentar de novo' })
    expect(alerta.contains(botao)).toBe(false)
    expect((alerta.closest('[data-aviso]') as HTMLElement).contains(botao)).toBe(true)
  })

  it('não fecha: sem ação, nenhum botão, nenhum link e nada que se alcance pelo Tab, em tom nenhum', () => {
    for (const tom of TONS_DE_AVISO) {
      const { container, unmount } = desenhar(tom, { titulo: 'Título' })
      expect(container.querySelector('button, a[href], input, [tabindex]'), tom).toBeNull()
      unmount()
    }
  })

  it('o título é opcional, em `t-cartao`; o corpo é `tinta`, e sem título só o corpo aparece', () => {
    desenhar('info', { titulo: 'Título' })
    const titulo = screen.getByText('Título')
    expect(classesDo(titulo).has('t-cartao')).toBe(true)
    expect(classesDo(titulo).has('text-tinta')).toBe(true)
    expect(classesDo(screen.getByText('O que aconteceu e o que fazer.')).has('text-tinta')).toBe(true)
    cleanup()
    const { container: semTitulo } = desenhar('info')
    expect(semTitulo.querySelector('.t-cartao')).toBeNull()
    expect(semTitulo.querySelector('[data-aviso]')?.textContent).toBe('O que aconteceu e o que fazer.')
  })

  it('a caixa é de leitura: borda de 2 px, canto de 12 e nenhum degrau nem sombra', () => {
    for (const tom of TONS_DE_AVISO) {
      const { container, unmount } = desenhar(tom)
      const classes = classesDo(container.querySelector('[data-aviso]') as Element)
      for (const classe of ['border-2', 'rounded-controle']) expect(classes.has(classe), `${tom}: ${classe}`).toBe(true)
      expect([...classes].filter((classe) => /^(degrau|shadow)/.test(classe)), `${tom}: sem sombra nem degrau`).toEqual([])
      unmount()
    }
  })

  it('cada tom usa a borda e o fundo da família dele: informação azul, atenção amarelo, erro vermelho, certo verde', () => {
    const familias: Record<TomDeAviso, string> = { info: 'azul', atencao: 'amarelo', erro: 'vermelho', certo: 'verde' }
    for (const tom of TONS_DE_AVISO) {
      const { container, unmount } = desenhar(tom)
      const classes = classesDo(container.querySelector('[data-aviso]') as Element)
      expect(classes.has(`border-${familias[tom]}-borda`), tom).toBe(true)
      expect(classes.has(`bg-${familias[tom]}-claro`), tom).toBe(true)
      unmount()
    }
  })
})
