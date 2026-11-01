// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileDown, Trash2 } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesOf } from '../../../__fixtures__/class-colors'
import { Menu, type MenuItem } from './Menu'

/**
 * A caixa do menu na D80 (X1, tarefa 7.0; `docs/interface.md` 10.2): canto de 16 px, a borda de 2 px e o degrau sólido em
 * `borda` (`shadow-flutua`), item de 44 px com canto de 10, realce em `fundo-suave` e o perigo em `vermelho-texto`. O que
 * o navegador calcula (a cor resolvida, o canto de 20 px do item, que o menu da linha da tabela não corta) é do e2e da
 * galeria (`e2e/components-overlays.spec.ts`); o teclado é de `menu-keyboard.test.ts`, e a posição, de `floating.test.ts`.
 */
afterEach(cleanup)

const ITENS: readonly MenuItem[] = [
  { id: 'exportar', rotulo: 'Exportar em PDF', descricao: 'Baixa a atividade pronta', icone: FileDown },
  { id: 'aplicar', rotulo: 'Aplicar à turma', desabilitado: true },
  { id: 'excluir', rotulo: 'Excluir', perigo: true, icone: Trash2 },
]

async function abrir(escolhido?: string) {
  const usuario = userEvent.setup()
  render(<Menu rotulo="Ações da atividade" itens={ITENS} aoEscolher={() => undefined} titulo="Ações" {...(escolhido === undefined ? {} : { escolhido })} />)
  await usuario.click(screen.getByRole('button', { name: 'Ações da atividade' }))
  return screen.getByRole('menu')
}

/** O item pelo texto do rótulo: o botão que o leva, de qualquer papel (`menuitem` ou `menuitemradio`). */
function item(rotulo: string): HTMLElement {
  const botao = screen.getByText(rotulo).closest<HTMLElement>('[data-item]')
  if (botao === null) throw new Error(`o item "${rotulo}" não está no menu`)
  return botao
}

describe('Menu na pele da D80', () => {
  it('a caixa tem canto de 16 px e a borda de 2 px com o degrau sólido, sem sombra borrada', async () => {
    const caixa = classesOf(await abrir())
    expect(caixa.has('rounded-cartao')).toBe(true)
    expect(caixa.has('shadow-flutua')).toBe(true)
    expect(caixa.has('bg-superficie')).toBe(true)
    // `shadow-flutua` é o anel de 2 px com o degrau de 4 (`index.css`); nenhuma sombra com desfoque entra por cima.
    expect([...caixa].filter((classe) => /^shadow-(?!flutua$)/.test(classe))).toEqual([])
  })

  it('cada item tem 44 px no mínimo, canto de 10 e a letra de 15 px em 500 (t-apoio)', async () => {
    await abrir()
    for (const nome of ['Exportar em PDF', 'Aplicar à turma', 'Excluir']) {
      const classes = classesOf(item(nome))
      expect(classes.has('min-h-11'), nome).toBe(true)
      expect(classes.has('rounded-linha'), nome).toBe(true)
      expect(classes.has('t-apoio'), nome).toBe(true)
    }
  })

  it('o item comum realça em fundo-suave no hover e no foco, e escreve em tinta', async () => {
    await abrir()
    const classes = classesOf(item('Exportar em PDF'))
    expect(classes.has('hover:bg-fundo-suave')).toBe(true)
    expect(classes.has('focus-visible:bg-fundo-suave')).toBe(true)
    expect(classes.has('text-tinta')).toBe(true)
  })

  it('a ação de perigo escreve em vermelho-texto, e não no `erro` de antes', async () => {
    await abrir()
    const classes = classesOf(item('Excluir'))
    expect(classes.has('text-vermelho-texto')).toBe(true)
    expect(classes.has('text-erro')).toBe(false)
    expect(classes.has('hover:bg-fundo-suave')).toBe(true)
  })

  it('o item desligado diz que está desligado em ARIA, escreve em sutil e não realça', async () => {
    await abrir()
    const desligado = item('Aplicar à turma')
    expect(desligado.getAttribute('aria-disabled')).toBe('true')
    expect(desligado.getAttribute('tabindex')).toBe('-1')
    const classes = classesOf(desligado)
    expect(classes.has('text-sutil')).toBe(true)
    expect(classes.has('text-inativo')).toBe(false)
    expect([...classes].filter((classe) => classe.startsWith('hover:') || classe.startsWith('focus-visible:'))).toEqual([])
  })

  it('o glifo do item é `sutil`, menos o da ação de perigo, que leva o vermelho do texto', async () => {
    await abrir()
    const glifoComum = item('Exportar em PDF').querySelector('svg')
    const glifoDePerigo = item('Excluir').querySelector('svg')
    expect(glifoComum, 'o glifo do item comum').not.toBeNull()
    expect(glifoDePerigo, 'o glifo do item de perigo').not.toBeNull()
    expect(glifoComum?.getAttribute('aria-hidden')).toBe('true')
    expect(classesOf(glifoComum as Element).has('text-sutil')).toBe(true)
    expect(classesOf(glifoDePerigo as Element).has('text-sutil')).toBe(false)
  })

  it('o título do menu é um selo em caixa-alta, escondido do leitor de tela, e a frase do item fica em sutil', async () => {
    await abrir()
    const titulo = screen.getByText('Ações')
    expect(classesOf(titulo).has('t-selo')).toBe(true)
    expect(titulo.getAttribute('aria-hidden')).toBe('true')
    const frase = screen.getByText('Baixa a atividade pronta')
    expect(classesOf(frase).has('text-sutil')).toBe(true)
  })

  it('o item escolhido, no menu de escolha única, é marcado em ARIA e em peso 700', async () => {
    await abrir('exportar')
    const escolhido = item('Exportar em PDF')
    expect(escolhido.getAttribute('aria-checked')).toBe('true')
    expect(classesOf(escolhido).has('font-bold')).toBe(true)
    expect(classesOf(item('Excluir')).has('font-bold')).toBe(false)
  })
})
