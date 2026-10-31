// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesDo } from '../../__fixtures__/class-colors'
import { Abas, type Aba } from './Abas'

/**
 * As abas da D80 (`docs/interface.md` 10.2; Tech Spec da X1, seção 9): o teclado é o de hoje, e a pele é nova. O que o
 * `jsdom` sabe fica aqui (papel, `aria-*`, ordem do Tab, a forma da aba ativa); a cor resolvida por tema, a altura de 44
 * px e o sublinhado desenhado são do e2e da galeria (`e2e/components-states.spec.ts`). Os cinco casos da regra do teclado
 * (`tabs-keyboard.test.ts`) continuam onde estavam.
 */
afterEach(cleanup)

const ABAS: readonly Aba[] = [
  { id: 'visao-geral', rotulo: 'Visão geral' },
  { id: 'alunos', rotulo: 'Alunos', contador: 2, oQueConta: 'pedidos de nome' },
  { id: 'atividades', rotulo: 'Atividades' },
]

/** A peça é controlada: a mesma ligação que a tela faz, com o painel dizendo qual aba está aberta. */
function Montada({ inicial = 'visao-geral', abas = ABAS }: { inicial?: string; abas?: readonly Aba[] }) {
  const [ativa, definirAtiva] = useState(inicial)
  return (
    <>
      <Abas rotulo="Seções da turma" abas={abas} ativa={ativa} aoMudar={definirAtiva}>
        <p data-painel>Conteúdo de {ativa}.</p>
      </Abas>
      <button type="button">Depois das abas</button>
    </>
  )
}

const abas = () => screen.getAllByRole('tab')

describe('Abas', () => {
  it('a ativa diz que é por três pistas, e não só pela cor: o texto da família azul, o sublinhado e o aria-selected', () => {
    render(<Montada inicial="alunos" />)
    const [primeira, ativa, ultima] = abas() as [HTMLElement, HTMLElement, HTMLElement]
    expect(ativa.getAttribute('aria-selected')).toBe('true')
    expect(classesDo(ativa).has('text-azul-texto')).toBe(true)
    // O sublinhado é um desenho à parte, de 3 px, na face `azul`, só na ativa.
    const sublinhado = ativa.querySelector('[aria-hidden="true"]')
    expect(sublinhado).not.toBeNull()
    expect(classesDo(sublinhado as Element).has('bg-azul')).toBe(true)
    expect(classesDo(sublinhado as Element).has('h-0.75')).toBe(true)
    for (const outra of [primeira, ultima]) {
      expect(outra.getAttribute('aria-selected')).toBe('false')
      expect(classesDo(outra).has('text-azul-texto')).toBe(false)
      expect(outra.querySelector('[aria-hidden="true"]')).toBeNull()
    }
  })

  it('a aba tem 44 px de altura em qualquer largura, e a lista tem o fio de 2 px', () => {
    render(<Montada />)
    for (const aba of abas()) {
      const classes = classesDo(aba)
      expect(classes.has('min-h-11'), aba.textContent ?? '').toBe(true)
      // A de 36 px do computador era a barra de controles de antes da D80.
      expect(classes.has('md:min-h-9'), aba.textContent ?? '').toBe(false)
    }
    const lista = screen.getByRole('tablist', { name: 'Seções da turma' })
    expect(classesDo(lista).has('border-b-2')).toBe(true)
    expect(classesDo(lista).has('border-borda')).toBe(true)
  })

  it('o rótulo da aba é `t-rotulo`, a tipografia de rótulo da D80, na ativa e nas outras', () => {
    render(<Montada inicial="alunos" />)
    for (const aba of abas()) expect(classesDo(aba).has('t-rotulo'), aba.textContent ?? '').toBe(true)
  })

  it('uma parada só no Tab: a ativa; o Tab seguinte entra no painel e não na aba ao lado', async () => {
    const usuario = userEvent.setup()
    render(<Montada inicial="alunos" />)
    expect(abas().map((aba) => aba.tabIndex)).toEqual([-1, 0, -1])
    await usuario.tab()
    expect(document.activeElement).toBe(abas()[1])
    await usuario.tab()
    expect(document.activeElement).toBe(screen.getByRole('tabpanel'))
    await usuario.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Depois das abas' }))
  })

  it('as setas trocam de aba, levam o foco junto e dão a volta; Home e End vão às pontas', async () => {
    const usuario = userEvent.setup()
    render(<Montada />)
    await usuario.tab()
    expect(document.activeElement).toBe(abas()[0])

    await usuario.keyboard('{ArrowRight}')
    expect(abas()[1]?.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(abas()[1])
    expect(screen.getByText('Conteúdo de alunos.')).toBeTruthy()

    await usuario.keyboard('{End}')
    expect(abas()[2]?.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(abas()[2])

    // Depois da última, a seta vai à primeira; antes da primeira, à última.
    await usuario.keyboard('{ArrowRight}')
    expect(abas()[0]?.getAttribute('aria-selected')).toBe('true')
    await usuario.keyboard('{ArrowLeft}')
    expect(abas()[2]?.getAttribute('aria-selected')).toBe('true')

    await usuario.keyboard('{Home}')
    expect(abas()[0]?.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(abas()[0])
  })

  it('o clique troca de aba, e toda aba aponta para o painel com `aria-controls`, que aponta de volta para a ativa', async () => {
    const usuario = userEvent.setup()
    render(<Montada />)
    await usuario.click(screen.getByRole('tab', { name: /Atividades/ }))
    const painel = screen.getByRole('tabpanel')
    const ativa = screen.getByRole('tab', { selected: true })
    expect(ativa.textContent).toContain('Atividades')
    for (const aba of abas()) expect(aba.getAttribute('aria-controls')).toBe(painel.id)
    expect(painel.getAttribute('aria-labelledby')).toBe(ativa.id)
  })

  it('com a ativa fora da lista, nenhuma está selecionada, a primeira continua na ordem do Tab e o painel leva o nome da lista', async () => {
    const usuario = userEvent.setup()
    render(<Montada inicial="aba-que-sumiu" />)
    expect(abas().map((aba) => aba.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false'])
    expect(abas().map((aba) => aba.tabIndex)).toEqual([0, -1, -1])
    await usuario.tab()
    expect(document.activeElement).toBe(abas()[0])
    const painel = screen.getByRole('tabpanel')
    expect(painel.getAttribute('aria-labelledby')).toBeNull()
    expect(painel.getAttribute('aria-label')).toBe('Seções da turma')
  })

  it('o número ao lado do rótulo diz o que conta, em texto; zero não desenha, e sem `oQueConta` diz "esperando você"', () => {
    render(
      <Abas
        rotulo="Filtro por função"
        abas={[
          { id: 'tudo', rotulo: 'Tudo', contador: 0, oQueConta: 'itens' },
          { id: 'esperando', rotulo: 'Esperando', contador: 3 },
          { id: 'pedidos', rotulo: 'Pedidos', contador: 2, oQueConta: 'pedidos de nome' },
          { id: 'sem', rotulo: 'Sem número' },
        ]}
        ativa="tudo"
        aoMudar={() => undefined}
      >
        <p>painel</p>
      </Abas>,
    )
    const aba = (nome: string) => screen.getByRole('tab', { name: new RegExp(nome) })
    expect(aba('Pedidos').textContent).toBe('Pedidos2 pedidos de nome')
    expect(aba('Esperando').textContent).toBe('Esperando3 esperando você')
    // Zero e ausente: só o rótulo, sem pílula e sem o texto escondido.
    expect(aba('Tudo').textContent).toBe('Tudo')
    expect(aba('Tudo').querySelector('[data-contador]')).toBeNull()
    expect(aba('Sem número').textContent).toBe('Sem número')
    // A aba, por inteiro, entra no nome: o rótulo, o número e o que ele conta (o `jsdom` junta as palavras sem o espaço
    // que o navegador põe entre os itens da aba).
    expect(screen.getByRole('tab', { name: /Pedidos.*2.*pedidos de nome/ })).toBe(aba('Pedidos'))
  })
})
