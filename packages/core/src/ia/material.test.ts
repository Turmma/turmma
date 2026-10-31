import { describe, expect, it } from 'vitest'
import { MATERIAL_DE_ESTEQUIOMETRIA } from './__fixtures__/estequiometria.js'
import { extrairFatos, fatoCitadoNoTexto, termoComArtigo } from './material.js'

const fatosDe = (texto: string) => extrairFatos([{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 3, texto }])
const termosDe = (texto: string): string[] => fatosDe(texto).map((fato) => fato.termo)

describe('extrairFatos: o que é frase definitória', () => {
  it('aceita a definição sem artigo, como o material de demonstração escreve, e põe o termo em minúscula', () => {
    const [fato] = fatosDe('Reagente limitante é o reagente que acaba primeiro e determina quanto produto se forma.')
    expect(fato).toMatchObject({
      artigo: '',
      termo: 'reagente limitante',
      copula: 'é',
      complemento: 'o reagente que acaba primeiro e determina quanto produto se forma',
      numerico: false,
      pagina: 3,
      frase: 'Reagente limitante é o reagente que acaba primeiro e determina quanto produto se forma.',
    })
    expect(fato === undefined ? '' : termoComArtigo(fato)).toBe('reagente limitante')
  })

  it('continua aceitando a definição com artigo, e a relação com número', () => {
    const fatos = fatosDe('O mol é a unidade de quantidade de matéria do Sistema Internacional. A massa molar da água é 18 g/mol. Uma equação balanceada é aquela em que cada elemento tem o mesmo número de átomos nos dois lados.')
    expect(fatos.map((fato) => [fato.artigo, fato.termo, fato.numerico])).toEqual([
      ['o', 'mol', false],
      ['a', 'massa molar da água', true],
      ['uma', 'equação balanceada', false],
    ])
    expect(fatos.map(termoComArtigo)).toEqual(['o mol', 'a massa molar da água', 'uma equação balanceada'])
  })

  it('a relação com número em item de lista vira fato de valor: o nome, a fórmula e a massa molar', () => {
    const fatos = fatosDe('H = 1; C = 12; O = 16.\nÁgua, H2O: 2 × 1 + 16 = 18 g/mol.\nCarbonato de cálcio, CaCO3: 40 + 12 + 3 × 16 = 100 g/mol.\nCloreto de sódio, NaCl: 23 + 35,5 = 58,5 g/mol.')
    expect(fatos.map((fato) => [termoComArtigo(fato), fato.complemento, fato.numerico])).toEqual([
      ['a massa molar de água (H2O)', '18 g/mol', true],
      ['a massa molar de carbonato de cálcio (CaCO3)', '100 g/mol', true],
      ['a massa molar de cloreto de sódio (NaCl)', '58,5 g/mol', true],
    ])
    expect(fatos[0]?.frase).toBe('Água, H2O: 2 × 1 + 16 = 18 g/mol.')
    // Conta de exemplo e passo de resolução não são relação do material.
    expect(fatosDe('Passo 2: a massa molar do metano é 12 + 4 × 1 = 16 g/mol. Passo 4: m = 8 mol × 18 g/mol = 144 g de água.')).toEqual([])
  })

  it('nome próprio no meio do termo fica como está, e termo com travessão é termo', () => {
    expect(termosDe('Constante de Avogadro é o número de entidades que existem em 1 mol: 6,02 × 10²³ por mol. Cálculo mol–mol é o cálculo em que a quantidade dada e a quantidade pedida estão em mols.')).toEqual(['constante de Avogadro', 'cálculo mol–mol'])
  })

  it('"corresponde a" e "equivale a" definem sem depender da forma do complemento', () => {
    expect(termosDe('O rendimento percentual corresponde a cem vezes a razão entre o rendimento real e o rendimento teórico.')).toEqual(['rendimento percentual'])
  })

  it('o que vem depois do ponto e vírgula é outra informação, e não entra na definição', () => {
    const [fato] = fatosDe('Quantidade de matéria é a grandeza que indica quantas entidades há em uma amostra; seu símbolo é n e sua unidade é o mol.')
    expect(fato?.complemento).toBe('a grandeza que indica quantas entidades há em uma amostra')
  })

  it.each([
    ['verbo que não define', 'A equação está balanceada: há 2 átomos de nitrogênio e 6 átomos de hidrogênio de cada lado da seta.'],
    ['comparação', 'O raciocínio é o mesmo de uma receita.'],
    ['item de lista', 'Erro 1: calcular com a equação sem balancear.'],
    ['retoma o que veio antes', 'Esse valor é um arredondamento de 6,02214076 × 10²³, o número exato que define o mol.'],
    ['pergunta', 'Qual é o reagente limitante, que massa de água se forma e quanto sobra do reagente em excesso?'],
    ['negação', 'O reagente limitante não é o reagente de menor massa.'],
    ['pergunta com cara de definição', 'Reagente limitante é o reagente que acaba primeiro e determina quanto produto se forma?'],
    ['particípio no lugar da definição', 'A quantidade de produto é sempre calculada a partir do reagente limitante.'],
    ['particípio sem advérbio', 'A massa de cada elemento é multiplicada pelo índice dele.'],
    ['duas orações', 'O queijo é o limitante e o pão está em excesso, embora haja mais fatias de pão do que de queijo.'],
    ['retoma outro nome', 'O menor resultado é o do O2, que é o reagente limitante.'],
    ['predicado curto demais', 'O pacote da química é o mol.'],
    ['conta de exemplo', 'A massa pura é 250 g × 80 / 100 = 200 g de CaCO3, ou 2 mol.'],
    ['conta entre parênteses', 'O rendimento percentual é (89,6 g / 112 g) × 100 = 80%.'],
    ['oração com vírgula antes do verbo', 'Na química, a receita é a equação balanceada, e a unidade de contagem é o mol.'],
    ['equação colada na frase', 'CaCO3 -> CaO + CO2 A massa molar do CaCO3 é 100 g/mol, e a do CaO é 56 g/mol.'],
    ['predicado que não é nome', 'Um problema é de reagente limitante quando o enunciado informa a quantidade de dois reagentes.'],
    ['sujeito no plural sem definição', 'Átomos e moléculas são pequenos demais para serem contados um a um.'],
  ])('não aceita %s: "%s"', (_caso, frase) => {
    expect(fatosDe(frase)).toEqual([])
  })

  it('o título de seção que a extração do PDF cola na frase sai do termo e do trecho citado', () => {
    const [fato] = fatosDe('Texto original, sem relação com nenhuma escola real.\n7.1 O que a estequiometria responde\nEstequiometria é o cálculo das quantidades de reagentes e de produtos que participam de uma reação química.')
    expect(fato?.termo).toBe('estequiometria')
    expect(fato?.frase).toBe('Estequiometria é o cálculo das quantidades de reagentes e de produtos que participam de uma reação química.')
    expect(termosDe('7.3 Massa molar\nMassa atômica de um elemento é a massa média dos seus átomos, expressa em unidade de massa atômica (u).')).toEqual(['massa atômica de um elemento'])
    // Título colado em frase que não define continua não definindo.
    expect(fatosDe('7.2 Mol e constante de Avogadro\nÁtomos e moléculas são pequenos demais para serem contados um a um.')).toEqual([])
  })

  it('a linha de fórmula depois da definição não entra nela, mesmo começando em minúscula', () => {
    const [fato] = fatosDe('Rendimento percentual é a razão entre o rendimento real e o rendimento teórico, multiplicada por 100.\nrendimento (%) = (massa obtida / massa teórica) × 100\nO rendimento real costuma ser menor que o teórico por três motivos.')
    expect(fato?.frase).toBe('Rendimento percentual é a razão entre o rendimento real e o rendimento teórico, multiplicada por 100.')
  })

  it('a quebra de linha do PDF no meio da frase não quebra a definição', () => {
    const [fato] = fatosDe('Reagente limitante é o reagente que acaba\nprimeiro e determina quanto produto se\nforma. Reagente em excesso é o reagente que sobra quando a reação termina.')
    expect(fato?.complemento).toBe('o reagente que acaba primeiro e determina quanto produto se forma')
  })

  it('um termo, um fato: a segunda frase sobre o mesmo termo não vira outra questão', () => {
    expect(termosDe('Rendimento percentual é a razão entre o rendimento real e o rendimento teórico. O rendimento percentual é a medida de quanto se aproveitou.')).toEqual(['rendimento percentual'])
  })
})

describe('fatoCitadoNoTexto', () => {
  const fatos = fatosDe('Reagente é a substância que existe antes da reação e é consumida por ela. Reagente limitante é o reagente que acaba primeiro e determina quanto produto se forma.')

  it('acha o conceito que o texto nomeia, e entre dois fica com o de nome mais comprido', () => {
    expect(fatoCitadoNoTexto(fatos, 'o que é reagente limitante?')?.termo).toBe('reagente limitante')
    expect(fatoCitadoNoTexto(fatos, 'O QUE É UM REAGENTE')?.termo).toBe('reagente')
  })

  it('não confunde pedaço de palavra com o termo, e devolve nada quando o texto não nomeia conceito nenhum', () => {
    expect(fatoCitadoNoTexto(fatos, 'quais são os reagentes dessa reação?')).toBeUndefined()
    expect(fatoCitadoNoTexto(fatos, 'não entendi nada')).toBeUndefined()
  })
})
