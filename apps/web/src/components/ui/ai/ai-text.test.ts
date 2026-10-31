import { describe, expect, it } from 'vitest'
import { limparMarcacao, paragrafosDoTexto } from './ai-text'

describe('texto da IA em parágrafos', () => {
  it('a linha em branco separa os parágrafos, e a quebra simples fica dentro deles', () => {
    expect(paragrafosDoTexto('Primeiro parágrafo.\n\nSegundo, com lista:\n1. um\n2. dois\n\n\n\nTerceiro.')).toEqual(['Primeiro parágrafo.', 'Segundo, com lista:\n1. um\n2. dois', 'Terceiro.'])
  })

  it('linha só com espaço também separa, e as pontas em branco somem', () => {
    expect(paragrafosDoTexto('\n\n  Um.  \n \t \nDois.\r\n\r\nTrês.\n')).toEqual(['Um.', 'Dois.', 'Três.'])
  })

  it('texto vazio ou só de espaço não tem parágrafo', () => {
    expect(paragrafosDoTexto('')).toEqual([])
    expect(paragrafosDoTexto(' \n\n \t ')).toEqual([])
  })

  it('o que parece HTML continua sendo o texto que veio, e o link de Markdown não vira link', () => {
    const texto = '<img src=x onerror="alert(1)">\n\n[link](javascript:alert(1))'
    expect(paragrafosDoTexto(texto)).toEqual(['<img src=x onerror="alert(1)">', '[link](javascript:alert(1))'])
  })

  it('o item de lista vira parágrafo, e a lista numerada fica dentro do parágrafo dela', () => {
    expect(paragrafosDoTexto('Você vai precisar de:\n- balança\n- béquer\n* proveta\n\n1. Pese.\n2. Anote.')).toEqual(['Você vai precisar de:', 'balança', 'béquer', 'proveta', '1. Pese.\n2. Anote.'])
  })
})

describe('marcação de Markdown no texto da IA', () => {
  it('negrito, itálico e título perdem o sinal e ficam com o texto', () => {
    expect(limparMarcacao('**Questão 1**')).toBe('Questão 1')
    expect(limparMarcacao('### Gabarito')).toBe('Gabarito')
    expect(limparMarcacao('# Lista 3\n## Parte A')).toBe('Lista 3\nParte A')
    expect(limparMarcacao('Use **massa molar** e a *proporção* da equação, __sempre__ e _com calma_.')).toBe('Use massa molar e a proporção da equação, sempre e com calma.')
    expect(limparMarcacao('**Questão 1** (p. 142): **a)** 44 g')).toBe('Questão 1 (p. 142): a) 44 g')
  })

  it('a cerca de código sai, com a linguagem que vier nela, e o que está dentro fica', () => {
    expect(limparMarcacao('Veja:\n```\nC + O2 -> CO2\n```\nPronto.')).toBe('Veja:\n\nC + O2 -> CO2\n\nPronto.')
    expect(paragrafosDoTexto('Veja:\n```text\nC + O2 -> CO2\n```\nPronto.')).toEqual(['Veja:', 'C + O2 -> CO2', 'Pronto.'])
  })

  it('o asterisco que é conteúdo fica: conta com espaço, conta sem espaço, e o sinal solto', () => {
    for (const conta of ['2 * 3 = 6', '2*3*4 = 24', 'a * b * c', 'x**2 e y**3', '5 * (2 + 1) * 4', 'nota: * ver p. 142', '3 ** 2'])
      expect(limparMarcacao(conta), conta).toBe(conta)
  })

  it('fórmula, nome com sublinhado e hashtag no meio da linha ficam como vieram', () => {
    for (const texto of ['H2O e CO2', 'massa_molar_do_gas', '_ sozinho _', 'a questão #3', 'C#', '1. Qual a massa de CO₂?', '10 - 4 = 6', '-3 + 5'])
      expect(limparMarcacao(texto), texto).toBe(texto)
  })

  it('ênfase e conta na mesma linha: sai o sinal da ênfase, fica o da conta', () => {
    expect(limparMarcacao('**Resposta:** 2 * 3 = 6')).toBe('Resposta: 2 * 3 = 6')
    expect(limparMarcacao('*Dica:* use 2*n*M')).toBe('Dica: use 2*n*M')
  })
})
