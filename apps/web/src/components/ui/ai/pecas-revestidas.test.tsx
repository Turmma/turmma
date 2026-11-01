// @vitest-environment jsdom
import type { Citacao } from '@educa/shared'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classesDo, tokenDe } from '../../../__fixtures__/class-colors'
import { CitationChip } from './CitationChip'
import { Sources } from './Sources'
import type { DescricaoDeFerramenta, ValoresValidados } from './schema-form'
import { SchemaForm } from './SchemaForm'
import { PageThumbnail } from './PageThumbnail'

/**
 * As peças de IA que a 10.0 reveste sem mudar o que dizem nem a ordem do foco (`docs/interface.md` 9.3 e 10.2): o chip de
 * fonte, a lista de fontes, a página de origem e o motor de formulário. O `jsdom` vê as classes; a medida (28 px, 44 px,
 * o canto e a cor resolvida por tema) é do e2e da galeria (`e2e/components-ai.spec.ts`).
 */
const MATERIAL = '0190a1b2-0000-7000-8000-000000000001'
const MATERIAIS = { [MATERIAL]: 'Química 2, cap. 7' }
const CITACAO: Citacao = { materialId: MATERIAL, pagina: 142, trecho: 'A proporção entre as quantidades de matéria é dada pelos coeficientes da equação.' }

beforeEach(() => {
  // O cartão flutuante do chip mede a janela quando abre, e o `jsdom` não tem `ResizeObserver` nem `matchMedia`.
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ChipFonte', () => {
  it('é a pílula de 28 px, com a borda de 2 px, em família `ia`, e sem degrau: ele corre dentro de uma linha de texto', () => {
    render(<CitationChip citacao={CITACAO} materiais={MATERIAIS} />)
    // O `jsdom` junta o texto escondido ao visível sem o espaço do fim (`cap. 7,p. 142`); o navegador o mantém.
    const chip = screen.getByRole('button', { name: /^Fonte: Química 2, cap\. 7,\s?p\. 142$/ })
    const classes = classesDo(chip)
    expect(classes.has('min-h-7') && classes.has('min-w-7'), '28 px').toBe(true)
    expect(classes.has('rounded-full')).toBe(true)
    expect(classes.has('border-2')).toBe(true)
    expect(tokenDe(chip, 'border')).toBe('borda')
    expect(tokenDe(chip, 'bg')).toBe('ia-cx')
    expect(tokenDe(chip, 'text')).toBe('ia')
    expect(classes.has('font-bold')).toBe(true)
    // A letra é a de apoio da 9.2 (15 px, acima do piso de 14), e não uma medida escrita à mão.
    expect(classes.has('t-apoio'), 'tipografia de apoio').toBe(true)
    expect([...classes].filter((classe) => /^text-\[\d+px\]$/.test(classe)), 'sem tamanho escrito à mão').toEqual([])
    // Sem degrau: a margem do degrau abriria a linha do parágrafo.
    expect([...classes].filter((classe) => classe.startsWith('degrau'))).toEqual([])
    // O texto visível é só "p. 142": o material vai para o leitor de tela.
    expect(chip.textContent).toBe('Fonte: Química 2, cap. 7, p. 142')
  })

  it('aberto, o cartão é a caixa flutuante da pele (borda de 2 px e degrau, `shadow-flutua`), e o texto não desce de 14 px', async () => {
    render(<CitationChip citacao={CITACAO} materiais={MATERIAIS} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /^Fonte:/ }))
    const cartao = screen.getByRole('group', { name: 'Fonte: Química 2, cap. 7, p. 142' })
    expect(classesDo(cartao).has('shadow-flutua')).toBe(true)
    expect(classesDo(cartao).has('rounded-cartao')).toBe(true)
    expect(tokenDe(cartao, 'bg')).toBe('superficie')
    const tamanhos = [...cartao.querySelectorAll('span')].flatMap((no) => [...classesDo(no)].filter((classe) => /^text-\[1[0-3]px\]$|^text-xs$/.test(classe)))
    expect(tamanhos, 'texto abaixo do piso de 14 px').toEqual([])
    expect(within(cartao).getByText('Página 142')).toBeTruthy()
  })
})

describe('Fontes', () => {
  it('a linha recolhida tem 44 px de alvo, e cada fonte aberta é uma caixa de 2 px em família `ia`', () => {
    const { container } = render(<Sources citacoes={[CITACAO]} materiais={MATERIAIS} />)
    const resumo = container.querySelector('summary') as HTMLElement
    expect(classesDo(resumo).has('min-h-11')).toBe(true)
    expect(tokenDe(resumo, 'text')).toBe('apoio')
    expect(tokenDe(resumo, 'bg', 'hover:')).toBe('fundo-suave')
    const fonte = container.querySelector('li') as HTMLElement
    expect(classesDo(fonte).has('border-2')).toBe(true)
    expect(tokenDe(fonte, 'border')).toBe('borda')
    expect(tokenDe(fonte, 'bg')).toBe('ia-cx')
    expect(tokenDe(fonte, 'text')).toBe('ia')
  })
})

describe('PaginaMini', () => {
  it('a folha tem a borda de 2 px, e nada nela desce de 14 px', () => {
    const { container } = render(<PageThumbnail citacao={CITACAO} materiais={MATERIAIS} />)
    const folha = container.querySelector('figure > div') as HTMLElement
    expect(classesDo(folha).has('border-2')).toBe(true)
    expect(tokenDe(folha, 'border')).toBe('borda')
    const abaixoDoPiso = [...container.querySelectorAll('*')].flatMap((no) => [...classesDo(no)].filter((classe) => /^text-(xs|\[1[0-3]px\])$/.test(classe)))
    expect(abaixoDoPiso).toEqual([])
    // O cabeçalho da folha tem o fio de 2 px, como o resto da peça.
    expect(classesDo(container.querySelector('figure p') as HTMLElement).has('border-b-2')).toBe(true)
    // O trecho de verdade, e a página no pé e na legenda.
    expect(container.textContent).toContain('A proporção entre as quantidades de matéria')
    expect(screen.getByText('Página 142 · Química 2, cap. 7')).toBeTruthy()
  })
})

const ADAPTACAO: DescricaoDeFerramenta = {
  ferramenta: 'adaptacao',
  nome: 'Adaptação',
  verbo: 'Gerar versão adaptada',
  campos: [
    {
      tipo: 'multipla',
      chave: 'tipos',
      rotulo: 'Tipo de adaptação',
      dica: 'Escolha o que a versão precisa ter. Não escreva nada sobre o aluno.',
      minimo: 1,
      opcoes: [
        { valor: 'tempo_adicional', rotulo: 'Tempo adicional' },
        { valor: 'fonte_ampliada', rotulo: 'Fonte ampliada' },
      ],
    },
  ],
}

describe('MotorFormulario', () => {
  it('gerar é o primário, cancelar é o secundário, e os dois têm a mesma altura mínima', () => {
    render(<SchemaForm descricao={ADAPTACAO} estado="formulario" aoGerar={() => undefined} aoCancelar={() => undefined} />)
    const gerar = screen.getByRole('button', { name: 'Gerar versão adaptada' })
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    expect(tokenDe(gerar, 'bg')).toBe('laranja')
    expect(classesDo(cancelar).has('degrau-borda')).toBe(true)
    expect(tokenDe(cancelar, 'bg')).toBe('superficie')
    for (const botao of [gerar, cancelar]) expect(classesDo(botao).has('min-h-11'), botao.textContent ?? '').toBe(true)
  })

  it('a lista de tipos é uma caixa por tipo (borda de 2 px, degrau e 64 px, com o `checkbox` nativo), e marcar entrega os tipos na ordem da lista', async () => {
    const aoGerar = vi.fn<(valores: ValoresValidados) => void>()
    const usuario = userEvent.setup()
    render(<SchemaForm descricao={ADAPTACAO} estado="formulario" aoGerar={aoGerar} />)
    const grupo = screen.getByRole('group', { name: /Tipo de adaptação/ })
    const caixas = within(grupo).getAllByRole('checkbox')
    expect(caixas).toHaveLength(2)
    for (const caixa of caixas) {
      const rotulo = caixa.closest('label') as HTMLElement
      expect(classesDo(rotulo).has('degrau'), 'o degrau').toBe(true)
      expect(classesDo(rotulo).has('min-h-16'), '64 px').toBe(true)
      expect(classesDo(rotulo).has('border-2')).toBe(true)
      expect(classesDo(rotulo).has('degrau-borda'), 'desmarcada, o degrau é o da borda').toBe(true)
      // O anel é do rótulo, por `focus-within`, como o da `OptionCard` (4.0: aparece também no clique, decisão registrada). Nada de
      // `has-*` (`has-[...]`, `has-checked:`, `group-has-*`): o Tailwind o gera como `:has()`, que não existe antes do Chrome 105 e que o E5 do `casca.spec.ts` proíbe.
      const classesDoRotulo = [...classesDo(rotulo)]
      expect(classesDoRotulo.filter((classe) => classe.startsWith('focus-within:outline')).sort(), 'o anel por focus-within').toEqual([
        'focus-within:outline-3',
        'focus-within:outline-foco',
        'focus-within:outline-offset-2',
        'focus-within:outline-solid',
      ])
      expect(classesDoRotulo.filter((classe) => classe.includes('has-') || classe.includes(':has(')), 'sem `:has()`').toEqual([])
    }
    // Marcada, a caixa vira azul (borda, fundo e texto da família) e leva o degrau azul, além do visto nativo.
    await usuario.click(caixas[0] as HTMLElement)
    const marcada = (caixas[0] as HTMLElement).closest('label') as HTMLElement
    expect(tokenDe(marcada, 'border')).toBe('azul-borda')
    expect(tokenDe(marcada, 'bg')).toBe('azul-claro')
    expect(classesDo(marcada).has('degrau-azul')).toBe(true)
    await usuario.click(caixas[0] as HTMLElement)
    // A pessoa marca na ordem inversa da lista; o pedido sai na da lista.
    await usuario.click(screen.getByRole('checkbox', { name: 'Fonte ampliada' }))
    await usuario.click(screen.getByRole('checkbox', { name: 'Tempo adicional' }))
    await usuario.click(screen.getByRole('button', { name: 'Gerar versão adaptada' }))
    expect(aoGerar).toHaveBeenLastCalledWith({ tipos: ['tempo_adicional', 'fonte_ampliada'] })
    // Desmarcar tira só aquele tipo.
    await usuario.click(screen.getByRole('checkbox', { name: 'Fonte ampliada' }))
    await usuario.click(screen.getByRole('button', { name: 'Gerar versão adaptada' }))
    expect(aoGerar).toHaveBeenLastCalledWith({ tipos: ['tempo_adicional'] })
    // Nenhum campo de texto: a Adaptação recebe o tipo, nunca o diagnóstico (D35, D67).
    expect(document.querySelectorAll('textarea, input:not([type="checkbox"])')).toHaveLength(0)
  })

  it('o que falta é dito com o ícone ao lado do texto, ligado ao grupo, e o aviso do envio tem a borda do erro', async () => {
    const usuario = userEvent.setup()
    render(<SchemaForm descricao={ADAPTACAO} estado="formulario" aoGerar={() => undefined} />)
    await usuario.click(screen.getByRole('button', { name: 'Gerar versão adaptada' }))
    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toBe('Para gerar, confira: Tipo de adaptação.')
    expect(classesDo(aviso).has('border-2')).toBe(true)
    expect(tokenDe(aviso, 'border')).toBe('vermelho-borda')
    const grupo = screen.getByRole('group', { name: /Tipo de adaptação/ })
    // O nome do grupo e o título do formulário na tipografia da pele: 15 px em 700 e 17 px em 700.
    expect([...classesDo(grupo.querySelector('legend') as HTMLElement)].sort()).toEqual(['font-bold', 't-apoio', 'text-tinta'])
    expect(classesDo(screen.getByRole('heading', { level: 3, name: 'Adaptação' })).has('t-cartao')).toBe(true)
    const erro = document.getElementById((grupo.getAttribute('aria-describedby') ?? '').split(' ').at(-1) ?? '') as HTMLElement
    expect(erro.textContent).toBe('Marque pelo menos uma opção em "Tipo de adaptação".')
    expect(erro.querySelector('svg')).not.toBeNull()
    // É descrição do grupo, e não um segundo alerta: o aviso do envio é a região viva.
    expect(erro.getAttribute('role')).toBeNull()
  })

  it('a descrição com campo de texto na Adaptação não abre: a caixa de erro tem a borda do erro e o aviso vai ao leitor de tela', () => {
    // O tipo já barra isto em TypeScript; a descrição que chega como dado é o caso que a peça ainda recusa.
    const comTexto = { ...ADAPTACAO, campos: [{ tipo: 'texto', chave: 'sobre', rotulo: 'Sobre o aluno' }] } as unknown as DescricaoDeFerramenta
    render(<SchemaForm descricao={comTexto} estado="formulario" aoGerar={() => undefined} />)
    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toBe('Esta ferramenta não pôde ser aberta. Avise a equipe Turmma.')
    expect(classesDo(alerta).has('border-2')).toBe(true)
    expect(tokenDe(alerta, 'border')).toBe('vermelho-borda')
    expect(screen.queryByLabelText('Sobre o aluno')).toBeNull()
  })

  it('pedido recolhido e gerando: a linha e o status têm a borda de 2 px, e "preparando" não tem nada em laço', () => {
    const { container } = render(<SchemaForm descricao={ADAPTACAO} estado="gerando" aoGerar={() => undefined} />)
    const gerando = screen.getByRole('status')
    expect(gerando.textContent).toBe('Gerando… Isso leva alguns instantes.')
    expect(classesDo(gerando).has('border-2')).toBe(true)
    expect(tokenDe(gerando, 'border')).toBe('borda')
    const linha = container.querySelector('[data-motor="gerando"] > div') as HTMLElement
    expect(classesDo(linha).has('border-2')).toBe(true)
    for (const no of container.querySelectorAll('*')) expect([...classesDo(no)].filter((classe) => /^(animate-|duration-)/.test(classe))).toEqual([])
  })
})
