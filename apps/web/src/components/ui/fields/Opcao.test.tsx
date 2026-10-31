// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classesDo, contraste, corDoToken, TEMAS, tokenOuFalha } from '../../../__fixtures__/class-colors'
import { Opcao } from './Opcao'

/**
 * A opção da D80 (`docs/interface.md` 10.2): um `<label>` com o `<input>` nativo dentro, e por isso o teclado é o do
 * navegador. O que se prova aqui é o que o componente promete (grupo, uma parada de Tab, aviso uma vez, caixa de marcar,
 * desligada) e as cores por tema; o anel desenhado no rótulo e a medida de 64 px são do e2e da galeria, que mede o
 * estilo calculado.
 */
afterEach(cleanup)

const ENTREGAS = [
  { valor: 'papel', rotulo: 'Em papel' },
  { valor: 'tela', rotulo: 'Na tela' },
  { valor: 'foto', rotulo: 'Por foto da folha' },
] as const

function GrupoDeRadio({ inicial = 'papel', aoMudar = () => undefined }: { inicial?: string; aoMudar?: (valor: string) => void }) {
  const [entrega, definirEntrega] = useState(inicial)
  return (
    <>
      <button type="button">antes</button>
      <fieldset>
        <legend>Como a turma entrega</legend>
        {ENTREGAS.map((opcao) => (
          <Opcao
            key={opcao.valor}
            tipo="radio"
            nome="entrega"
            valor={opcao.valor}
            rotulo={opcao.rotulo}
            marcada={entrega === opcao.valor}
            aoMudar={(marcada) => {
              if (!marcada) return
              definirEntrega(opcao.valor)
              aoMudar(opcao.valor)
            }}
          />
        ))}
      </fieldset>
      <button type="button">depois</button>
    </>
  )
}

function Caixa({ desligada = false, aoMudar = () => undefined }: { desligada?: boolean; aoMudar?: (marcada: boolean) => void }) {
  const [marcada, definirMarcada] = useState(false)
  return (
    <Opcao
      tipo="checkbox"
      nome="colunas"
      valor="prazo"
      rotulo="O prazo"
      marcada={marcada}
      desligada={desligada}
      aoMudar={(nova) => {
        definirMarcada(nova)
        aoMudar(nova)
      }}
    />
  )
}

const radio = (nome: string) => screen.getByRole('radio', { name: nome }) as HTMLInputElement

describe('Opcao em grupo de rádio', () => {
  it('o grupo é o fieldset, cada opção é um rádio nomeado pelo texto, e só a marcada está marcada', () => {
    render(<GrupoDeRadio inicial="tela" />)
    expect(screen.getByRole('group', { name: 'Como a turma entrega' })).toBeTruthy()
    expect(screen.getAllByRole('radio').map((opcao) => [opcao.parentElement?.textContent, (opcao as HTMLInputElement).checked])).toEqual([
      ['Em papel', false],
      ['Na tela', true],
      ['Por foto da folha', false],
    ])
  })

  it('é uma parada só no Tab: a marcada entra, e o Tab seguinte sai do grupo', async () => {
    const usuario = userEvent.setup()
    render(<GrupoDeRadio inicial="tela" />)
    await usuario.click(screen.getByRole('button', { name: 'antes' }))
    await usuario.tab()
    expect(document.activeElement).toBe(radio('Na tela'))
    await usuario.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'depois' }))
  })

  it('as setas trocam a marcada e levam o foco junto, e cada troca avisa uma vez só', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<GrupoDeRadio aoMudar={aoMudar} />)
    await usuario.click(screen.getByRole('button', { name: 'antes' }))
    await usuario.tab()
    expect(document.activeElement).toBe(radio('Em papel'))
    await usuario.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(radio('Na tela'))
    expect(radio('Na tela').checked).toBe(true)
    expect(radio('Em papel').checked).toBe(false)
    expect(aoMudar.mock.calls).toEqual([['tela']])
    await usuario.keyboard('{ArrowDown}')
    expect(radio('Por foto da folha').checked).toBe(true)
    await usuario.keyboard('{ArrowUp}')
    expect(radio('Na tela').checked).toBe(true)
    expect(aoMudar.mock.calls).toEqual([['tela'], ['foto'], ['tela']])
  })

  it('o clique no texto marca a opção, e marcar a que já está marcada não avisa de novo', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<GrupoDeRadio aoMudar={aoMudar} />)
    await usuario.click(screen.getByText('Por foto da folha'))
    expect(radio('Por foto da folha').checked).toBe(true)
    await usuario.click(screen.getByText('Por foto da folha'))
    expect(aoMudar.mock.calls).toEqual([['foto']])
  })
})

describe('Opcao como caixa de marcar', () => {
  it('o Espaço marca e desmarca, e cada troca avisa o estado novo', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Caixa aoMudar={aoMudar} />)
    await usuario.tab()
    const caixa = screen.getByRole('checkbox', { name: 'O prazo' }) as HTMLInputElement
    expect(document.activeElement).toBe(caixa)
    await usuario.keyboard(' ')
    expect(caixa.checked).toBe(true)
    await usuario.keyboard(' ')
    expect(caixa.checked).toBe(false)
    expect(aoMudar.mock.calls).toEqual([[true], [false]])
  })

  it('desligada não troca com o clique, não recebe o foco e perde o degrau (aria-disabled)', async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    render(<Caixa desligada aoMudar={aoMudar} />)
    const caixa = screen.getByRole('checkbox', { name: 'O prazo' }) as HTMLInputElement
    expect(caixa.disabled).toBe(true)
    await usuario.click(screen.getByText('O prazo'))
    expect(caixa.checked).toBe(false)
    expect(aoMudar).not.toHaveBeenCalled()
    await usuario.tab()
    expect(document.activeElement).not.toBe(caixa)
    expect(caixa.closest('label')?.getAttribute('aria-disabled')).toBe('true')
  })

  it('o ícone é decoração: fica fora do nome da opção', () => {
    render(<Opcao tipo="checkbox" nome="x" valor="a" rotulo="A turma" marcada={false} aoMudar={() => undefined} icone={<svg data-testid="desenho" />} />)
    expect(screen.getByTestId('desenho').parentElement?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('checkbox', { name: 'A turma' })).toBeTruthy()
  })
})

describe('Opcao desligada', () => {
  const desligadaMarcada = (marcada: boolean) =>
    render(<Opcao tipo="checkbox" nome="colunas" valor="nota" rotulo="A nota" marcada={marcada} desligada aoMudar={() => undefined} />)
  const rotuloDaNota = () => screen.getByRole('checkbox', { name: 'A nota' }).closest('label') as HTMLElement

  it('é apoio sobre fundo-suave, com 4,5:1 nos dois temas, sem degrau de ação e sem a cor da marcada', () => {
    desligadaMarcada(false)
    const rotulo = rotuloDaNota()
    expect([tokenOuFalha(rotulo, 'text'), tokenOuFalha(rotulo, 'bg'), tokenOuFalha(rotulo, 'border')]).toEqual(['apoio', 'fundo-suave', 'borda'])
    const classes = classesDo(rotulo)
    expect(classes.has('degrau-azul')).toBe(false)
    expect(classes.has('degrau-borda')).toBe(false)
    expect(classes.has('cursor-not-allowed')).toBe(true)
    for (const tema of TEMAS) {
      expect(contraste(corDoToken(tema, 'apoio'), corDoToken(tema, 'fundo-suave')), tema).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('marcada e desligada ao mesmo tempo: o visto fica, e o círculo não leva a cor de ação', () => {
    desligadaMarcada(true)
    const circulo = rotuloDaNota().lastElementChild as HTMLElement
    expect(circulo.querySelector('svg')).not.toBeNull()
    expect([tokenOuFalha(circulo, 'bg'), tokenOuFalha(circulo, 'text'), tokenOuFalha(circulo, 'border')]).toEqual(['campo', 'apoio', 'borda-campo'])
    for (const tema of TEMAS) {
      expect(contraste(corDoToken(tema, 'apoio'), corDoToken(tema, 'campo')), `${tema}: o visto sobre o círculo`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('Opcao: a marcada não é só cor, e a caixa vazia se vê', () => {
  const circulo = (rotulo: HTMLElement) => rotulo.lastElementChild as HTMLElement

  it('marcada leva o visto à direita e as cores da família azul; a desmarcada, o círculo vazio', () => {
    render(<GrupoDeRadio inicial="tela" />)
    const marcada = radio('Na tela').closest('label') as HTMLElement
    const vazia = radio('Em papel').closest('label') as HTMLElement
    expect(circulo(marcada).querySelector('svg')).not.toBeNull()
    expect(circulo(vazia).querySelector('svg')).toBeNull()
    expect([tokenOuFalha(marcada, 'bg'), tokenOuFalha(marcada, 'border'), tokenOuFalha(marcada, 'text')]).toEqual(['azul-claro', 'azul-borda', 'azul-texto'])
    for (const tema of TEMAS) {
      expect(contraste(corDoToken(tema, 'azul-texto'), corDoToken(tema, 'azul-claro')), `${tema}: texto da marcada`).toBeGreaterThanOrEqual(4.5)
      // O visto é `sobre-cor` sobre a face `azul` do círculo: o mesmo par "sobre a face" da 9.1.
      expect(contraste(corDoToken(tema, tokenOuFalha(circulo(marcada), 'text')), corDoToken(tema, tokenOuFalha(circulo(marcada), 'bg'))), `${tema}: visto`).toBeGreaterThanOrEqual(4.5)
    }
    expect(marcada.className).not.toBe(vazia.className)
  })

  it('a caixa vazia tem a borda borda-campo, de 3:1 contra o chão e contra o fundo dela, nos dois temas', () => {
    render(<GrupoDeRadio inicial="tela" />)
    const vazia = circulo(radio('Em papel').closest('label') as HTMLElement)
    expect(classesDo(vazia).has('border-2')).toBe(true)
    const borda = tokenOuFalha(vazia, 'border')
    expect(borda).toBe('borda-campo')
    for (const tema of TEMAS) {
      expect(contraste(corDoToken(tema, borda), corDoToken(tema, 'fundo')), `${tema}: contra o chão`).toBeGreaterThanOrEqual(3)
      expect(contraste(corDoToken(tema, borda), corDoToken(tema, tokenOuFalha(vazia, 'bg'))), `${tema}: contra o fundo da caixa`).toBeGreaterThanOrEqual(3)
    }
  })

  it('o anel é do rótulo, por focus-within, e nenhuma classe depende de :has()', () => {
    render(<GrupoDeRadio />)
    const rotulo = radio('Em papel').closest('label') as HTMLElement
    const classes = [...classesDo(rotulo)]
    expect(classes.some((classe) => classe.startsWith('focus-within:outline-foco'))).toBe(true)
    expect(classes.filter((classe) => classe.includes('has-') || classe.includes(':has('))).toEqual([])
  })
})
