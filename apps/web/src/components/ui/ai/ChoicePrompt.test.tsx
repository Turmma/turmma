// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayoutGrid, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classesOf, tokenOf } from '../../../__fixtures__/class-colors'
import { ChoicePrompt, type ChoiceOption } from './ChoicePrompt'

/**
 * A pergunta da D18 na pele da D80 (`docs/interface.md` 10.2; D59): duas opções do mesmo peso, e nenhuma é a "certa". O
 * `jsdom` não calcula cor, tamanho nem degrau: o que ele prova é que as duas opções são **a mesma classe** (uma constante
 * só), que nenhuma delas é a face do primário nem a do oficial, e o que muda quando a escolha sai. A largura, a altura e a
 * cor resolvida, nos dois temas, são do e2e da galeria (`e2e/components-ai.spec.ts`).
 */
afterEach(cleanup)

const OPCOES: readonly [ChoiceOption, ChoiceOption] = [
  { id: 'ferramenta', titulo: 'Usar a ferramenta Atividade', descricao: 'Salva na biblioteca e liga à turma.', icone: LayoutGrid },
  { id: 'conversa', titulo: 'Só conversar', descricao: 'Respondo aqui, sem salvar nada.', icone: MessageSquare },
]
const PERGUNTA = 'Posso fazer isso com a ferramenta Atividade, ou só conversar.'

function StatefulChoicePrompt({ desligada = false, inicial }: { desligada?: boolean; inicial?: string }) {
  const [escolhida, definirEscolhida] = useState<string | undefined>(inicial)
  return <ChoicePrompt pergunta={PERGUNTA} opcoes={OPCOES} escolhida={escolhida} aoEscolher={definirEscolhida} desligada={desligada} />
}

const opcoesAbertas = () => within(screen.getByRole('group', { name: PERGUNTA })).getAllByRole('button')

describe('Escolha', () => {
  it('as duas opções são a mesma classe, com borda de 2 px e o degrau da borda, e nenhuma é a face do primário nem a do oficial', () => {
    render(<StatefulChoicePrompt />)
    const [primeira, segunda] = opcoesAbertas()
    if (primeira === undefined || segunda === undefined) throw new Error('a pergunta tem duas opções')

    // Uma constante só: as duas classes são iguais, e a ordem não importa.
    expect([...classesOf(primeira)].sort()).toEqual([...classesOf(segunda)].sort())
    for (const opcao of [primeira, segunda]) {
      const classes = classesOf(opcao)
      expect(classes.has('border-2'), 'a borda de 2 px').toBe(true)
      expect(tokenOf(opcao, 'border'), 'a borda é a `borda`').toBe('borda')
      expect(classes.has('degrau') && classes.has('degrau-borda'), 'o degrau da borda').toBe(true)
      expect(tokenOf(opcao, 'bg'), 'a face é o chão da peça').toBe('superficie')
      // Nenhuma é a ação primária (laranja) nem a decisão oficial (grafite, e a `noite` de antes): D59 e regra 50, item 8.
      for (const proibida of ['laranja', 'grafite', 'noite', 'caramelo', 'vermelho', 'azul']) expect(tokenOf(opcao, 'bg'), `a face é ${proibida}`).not.toBe(proibida)
      expect(tokenOf(opcao, 'bg', 'enabled:hover:'), 'o hover clareia, e não vira primária').toBe('fundo-suave')
      // A frase de baixo é `sutil` enquanto a opção está ligada.
      expect(classesOf(opcao.querySelector('.t-apoio') as Element).has('text-sutil')).toBe(true)
    }
    // Nenhuma abre com o foco: o Enter de quem chega não escolhe por ela.
    expect(document.activeElement === primeira || document.activeElement === segunda).toBe(false)
  })

  it('o cartão da pergunta tem a borda de 2 px na `borda`, e não a linha de 1 px de antes', () => {
    render(<StatefulChoicePrompt />)
    const cartao = screen.getByRole('group', { name: PERGUNTA })
    expect(classesOf(cartao).has('border-2'), 'a borda de 2 px').toBe(true)
    expect(classesOf(cartao).has('border'), 'nem a de 1 px').toBe(false)
    expect(tokenOf(cartao, 'border'), 'a borda é a `borda`').toBe('borda')
    expect(tokenOf(cartao, 'bg')).toBe('superficie')
  })

  it('a opção desligada perde o degrau e a cor de ação, e as duas desligam juntas: o segundo clique não escolhe de novo', async () => {
    const aoEscolher = vi.fn()
    render(<ChoicePrompt pergunta={PERGUNTA} opcoes={OPCOES} aoEscolher={aoEscolher} desligada />)
    const opcoes = opcoesAbertas()
    expect(opcoes).toHaveLength(2)
    for (const opcao of opcoes) {
      expect(opcao).toHaveProperty('disabled', true)
      expect(tokenOf(opcao, 'bg', 'disabled:'), 'a face desligada é a `borda`').toBe('borda')
      expect(tokenOf(opcao, 'text', 'disabled:'), 'o texto desligado é o `apoio`').toBe('apoio')
      expect(tokenOf(opcao, 'border', 'disabled:')).toBe('borda')
      // A frase de baixo herda o `apoio` da face desligada: o `sutil` sobre a `borda` não chega a 4,5:1.
      expect(classesOf(opcao.querySelector('.t-apoio') as Element).has('text-sutil')).toBe(false)
    }
    await userEvent.setup().click(opcoes[0] as HTMLElement)
    expect(aoEscolher).not.toHaveBeenCalled()
  })

  it('escolher aqui leva o foco à linha do que foi escolhido, e a conversa que abre com a escolha já feita não puxa o foco', async () => {
    const usuario = userEvent.setup()
    const { unmount } = render(<StatefulChoicePrompt />)
    await usuario.click(screen.getByRole('button', { name: /Só conversar/ }))
    const linha = screen.getByText(/Você escolheu:/).closest('p')
    expect(linha?.textContent).toBe('Você escolheu: Só conversar')
    expect(document.activeElement).toBe(linha)
    // O cartão encolheu para a linha: as opções saíram, e a pergunta com elas.
    expect(screen.queryByRole('group', { name: PERGUNTA })).toBeNull()
    unmount()

    render(<StatefulChoicePrompt inicial="ferramenta" />)
    expect(screen.getByText(/Você escolheu:/).textContent).toBe('Você escolheu: Usar a ferramenta Atividade')
    expect(document.activeElement).toBe(document.body)
  })

  it('a linha da escolha feita tem a borda de 2 px e é mais curta que a opção, que a gente aperta', () => {
    render(<StatefulChoicePrompt inicial="conversa" />)
    const linha = screen.getByText(/Você escolheu:/).closest('p') as HTMLElement
    expect(classesOf(linha).has('border-2')).toBe(true)
    expect(tokenOf(linha, 'border')).toBe('borda')
    // Uma linha só, e não o cartão de duas opções: nenhum botão sobrou.
    expect(within(linha).queryAllByRole('button')).toHaveLength(0)
  })
})
