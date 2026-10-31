// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { classesDo, contraste, corDoToken, TEMAS, tokenDe, tokenOuFalha } from '../../../__fixtures__/class-colors'
import { Campo } from './Campo'
import { CampoDeSenha } from './CampoDeSenha'
import { CampoLongo } from './CampoLongo'
import { Selecao } from './Selecao'

/**
 * Os campos de formulário da D80 (`docs/interface.md` 10.2; X1, 4.0): o que cada um promete sem depender de medida. Ligar
 * rótulo, dica e erro ao campo e mostrar o erro com ícone é o que o leitor de tela e a pessoa que não vê a cor precisam
 * (regra 50, item 11). A cor da caixa sai das classes e do `index.css`, por tema (`class-colors.ts`); o tamanho, o
 * anel desenhado e o alvo de toque são do e2e da galeria (`e2e/components-fields.spec.ts`), porque o `jsdom` não os calcula.
 */
afterEach(cleanup)

const idsDaDescricao = (elemento: HTMLElement): string[] => (elemento.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id !== '')
const textosDaDescricao = (elemento: HTMLElement): (string | undefined)[] => idsDaDescricao(elemento).map((id) => document.getElementById(id)?.textContent?.trim())

describe('rótulo, dica e erro ligados ao campo', () => {
  it('Campo: o rótulo dá o nome, e a dica, o erro e o aviso de fora o descrevem, nessa ordem', () => {
    render(
      <>
        <Campo rotulo="Código" dica="Seis letras." erro="Faltam letras." descritoTambemPor="aviso-do-envio" obrigatorio />
        <p id="aviso-do-envio" role="alert">
          Não foi possível enviar.
        </p>
      </>,
    )
    const campo = screen.getByRole('textbox', { name: 'Código' })
    expect(textosDaDescricao(campo)).toEqual(['Seis letras.', 'Faltam letras.', 'Não foi possível enviar.'])
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(campo.getAttribute('aria-required')).toBe('true')
  })

  it('Campo sem erro nem obrigatório não é inválido nem exigido, e sem dica não descreve nada', () => {
    render(<Campo rotulo="Nome" />)
    const campo = screen.getByRole('textbox', { name: 'Nome' })
    expect(campo.hasAttribute('aria-invalid')).toBe(false)
    expect(campo.hasAttribute('aria-required')).toBe(false)
    expect(campo.hasAttribute('aria-describedby')).toBe(false)
    // Sem erro não há mensagem nem ícone de erro na tela.
    expect(document.querySelector('svg')).toBeNull()
  })

  it('CampoDeSenha: o botão "Mostrar a senha" continua um interruptor com aria-pressed, fora do nome do campo', () => {
    render(<CampoDeSenha rotulo="Senha nova" dica="Pelo menos 12 caracteres." />)
    const botao = screen.getByRole('button', { name: 'Mostrar a senha' })
    expect(botao.getAttribute('aria-pressed')).toBe('false')
    const campo = screen.getByLabelText('Senha nova')
    expect(campo.getAttribute('type')).toBe('password')
    expect(textosDaDescricao(campo as HTMLElement)).toEqual(['Pelo menos 12 caracteres.'])
  })

  it('CampoLongo: a dica, o erro e o contador descrevem o campo, nessa ordem', () => {
    render(<CampoLongo rotulo="Justificativa" dica="De 8 a 200 caracteres." valor="curta" aoMudar={() => undefined} minimo={8} maximo={200} erro="Escreva pelo menos 8 caracteres." obrigatorio />)
    const campo = screen.getByRole('textbox', { name: 'Justificativa' })
    expect(textosDaDescricao(campo).map((texto) => texto?.replace(/\s+/g, ' '))).toEqual(['De 8 a 200 caracteres.', 'Escreva pelo menos 8 caracteres.', '5 de 200 caracteres'])
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(campo.getAttribute('aria-required')).toBe('true')
  })

  it('CampoLongo sem erro não desenha mensagem nem ícone, e o campo não é inválido', () => {
    render(<CampoLongo rotulo="Observação" valor="" aoMudar={() => undefined} maximo={200} />)
    const campo = screen.getByRole('textbox', { name: 'Observação' })
    expect(campo.hasAttribute('aria-invalid')).toBe(false)
    // Só o contador descreve o campo: sem erro, nenhum parágrafo de erro com ícone.
    expect(idsDaDescricao(campo)).toHaveLength(1)
    expect(document.querySelector('svg')).toBeNull()
  })

  it('Selecao: a dica e o erro descrevem a seleção, nessa ordem, e o obrigatório vai em aria-required', () => {
    render(<Selecao rotulo="Disciplina" dica="A da prova." erro="Escolha uma disciplina." marcador="Escolha" opcoes={[{ valor: 'q', rotulo: 'Química' }]} valor="" aoMudar={() => undefined} obrigatoria />)
    const selecao = screen.getByRole('combobox', { name: 'Disciplina' })
    expect(textosDaDescricao(selecao)).toEqual(['A da prova.', 'Escolha uma disciplina.'])
    expect(selecao.getAttribute('aria-invalid')).toBe('true')
    expect(selecao.getAttribute('aria-required')).toBe('true')
  })
})

describe('Selecao sem erro', () => {
  it('não é inválida nem desenha mensagem de erro com ícone', () => {
    render(<Selecao rotulo="Disciplina" marcador="Escolha" opcoes={[{ valor: 'q', rotulo: 'Química' }]} valor="" aoMudar={() => undefined} />)
    expect(screen.getByRole('combobox', { name: 'Disciplina' }).hasAttribute('aria-invalid')).toBe(false)
    expect(document.querySelector('svg')).toBeNull()
  })
})

describe('o erro diz o que está errado com ícone e texto, e o ícone não é lido', () => {
  function campoComErro(): HTMLElement {
    render(<Campo rotulo="Código" erro="Faltam letras." />)
    return screen.getByRole('textbox', { name: 'Código' })
  }
  function campoLongoComErro(): HTMLElement {
    render(<CampoLongo rotulo="Código" valor="" aoMudar={() => undefined} maximo={50} erro="Faltam letras." />)
    return screen.getByRole('textbox', { name: 'Código' })
  }
  function selecaoComErro(): HTMLElement {
    render(<Selecao rotulo="Código" opcoes={[]} valor="" aoMudar={() => undefined} erro="Faltam letras." />)
    return screen.getByRole('combobox', { name: 'Código' })
  }
  const montagens: readonly [string, () => HTMLElement][] = [
    ['Campo', campoComErro],
    ['CampoLongo', campoLongoComErro],
    ['Selecao', selecaoComErro],
  ]
  it.each(montagens)('%s: o texto do erro acompanha um ícone de decoração, e o campo o aponta por aria-describedby', (_nome, montar) => {
    const campo = montar()
    const mensagem = idsDaDescricao(campo)
      .map((id) => document.getElementById(id))
      .find((elemento) => elemento?.textContent?.includes('Faltam letras.') === true)
    expect(mensagem, 'a mensagem de erro está no aria-describedby').not.toBeUndefined()
    expect(mensagem?.textContent?.trim()).toBe('Faltam letras.')
    const icone = mensagem?.querySelector('svg')
    expect(icone, 'o erro tem ícone ao lado do texto').not.toBeNull()
    expect(icone?.getAttribute('aria-hidden')).toBe('true')
  })
})

/**
 * A caixa é uma só: o `Campo`, o `CampoLongo` e a `Selecao` usam a mesma, e a `Busca` também (`Busca.test.tsx`). A cor
 * de cada estado é lida das classes do elemento, e o 3:1 e o 4,5:1 são calculados com os valores do `index.css`.
 */
function campo(): HTMLElement {
  render(<Campo rotulo="Nome" />)
  return screen.getByRole('textbox', { name: 'Nome' })
}
function campoLongo(): HTMLElement {
  render(<CampoLongo rotulo="Nome" valor="" aoMudar={() => undefined} maximo={50} />)
  return screen.getByRole('textbox', { name: 'Nome' })
}
function selecao(): HTMLElement {
  render(<Selecao rotulo="Nome" opcoes={[]} valor="" aoMudar={() => undefined} />)
  return screen.getByRole('combobox', { name: 'Nome' })
}
const CAIXAS: readonly [string, () => HTMLElement][] = [
  ['Campo', campo],
  ['CampoLongo', campoLongo],
  ['Selecao', selecao],
]

describe.each(CAIXAS)('a caixa de %s, nos dois temas', (_nome, montar) => {
  it('tem a borda de 2 px que se vê: borda-campo com 3:1 contra o chão e contra o fundo do campo', () => {
    const caixa = montar()
    expect(classesDo(caixa).has('border-2')).toBe(true)
    const borda = tokenOuFalha(caixa, 'border')
    expect(borda).toBe('borda-campo')
    const fundo = tokenOuFalha(caixa, 'bg')
    expect(fundo).toBe('campo')
    for (const tema of TEMAS) {
      expect(contraste(corDoToken(tema, borda), corDoToken(tema, 'fundo')), `${tema}: borda contra o chão`).toBeGreaterThanOrEqual(3)
      expect(contraste(corDoToken(tema, borda), corDoToken(tema, fundo)), `${tema}: borda contra o campo`).toBeGreaterThanOrEqual(3)
    }
  })

  it('o texto digitado é legível sobre o campo (4,5:1)', () => {
    const caixa = montar()
    for (const tema of TEMAS) {
      expect(contraste(corDoToken(tema, tokenOuFalha(caixa, 'text')), corDoToken(tema, tokenOuFalha(caixa, 'bg'))), tema).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('em foco o anel de 3 px fica colado na borda: o afastamento é zero, e a borda continua', () => {
    const classes = classesDo(montar())
    expect(classes.has('focus-visible:outline-offset-0')).toBe(true)
    // O anel vem a mais da borda: nenhuma classe de foco troca a cor da borda.
    expect([...classes].filter((classe) => classe.startsWith('focus-visible:border') || classe.startsWith('focus:border'))).toEqual([])
  })

  it('inválido, a borda é vermelho-texto e se vê contra o chão e contra o campo (3:1)', () => {
    const caixa = montar()
    const borda = tokenOuFalha(caixa, 'border', 'aria-invalid:')
    expect(borda).toBe('vermelho-texto')
    for (const tema of TEMAS) {
      expect(contraste(corDoToken(tema, borda), corDoToken(tema, 'fundo')), `${tema}: contra o chão`).toBeGreaterThanOrEqual(3)
      expect(contraste(corDoToken(tema, borda), corDoToken(tema, 'campo')), `${tema}: contra o campo`).toBeGreaterThanOrEqual(3)
    }
  })

  it('desligado, o fundo é fundo-suave e o texto é apoio, com 4,5:1 (o inativo de antes não chega)', () => {
    const caixa = montar()
    const fundo = tokenOuFalha(caixa, 'bg', 'disabled:')
    const texto = tokenOuFalha(caixa, 'text', 'disabled:')
    expect([fundo, texto]).toEqual(['fundo-suave', 'apoio'])
    for (const tema of TEMAS) expect(contraste(corDoToken(tema, texto), corDoToken(tema, fundo)), tema).toBeGreaterThanOrEqual(4.5)
  })
})

describe('a seleção em pílula da caixa de pedido', () => {
  it('é redonda e tem a mesma face do campo: a borda de 2 px em borda-campo e o fundo campo', () => {
    render(<Selecao rotulo="Turma" variante="pilula" opcoes={[{ valor: 'a', rotulo: '2ºB' }]} valor="a" aoMudar={() => undefined} />)
    const pilula = screen.getByRole('combobox', { name: 'Turma' })
    expect(classesDo(pilula).has('rounded-full')).toBe(true)
    expect(classesDo(pilula).has('border-2')).toBe(true)
    expect(tokenDe(pilula, 'border')).toBe('borda-campo')
    expect(tokenDe(pilula, 'bg')).toBe('campo')
  })
})
