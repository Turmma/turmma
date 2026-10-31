import { describe, expect, it } from 'vitest'
import { descartarRaciocinio, limparSaidaDoModelo, semMarcacao, tirarCercaDeCodigo, tirarMarcacao } from './clean-output.js'

const JSON_BOM = '{"ok":true}'

describe('descartarRaciocinio', () => {
  it('tira o bloco de raciocínio, onde quer que esteja, e quantos forem', () => {
    expect(descartarRaciocinio(`<think>primeiro penso {"ok":false}</think>${JSON_BOM}`)).toBe(JSON_BOM)
    expect(descartarRaciocinio(`<think>um</think>\n${JSON_BOM}\n<think>dois</think>`)).toBe(JSON_BOM)
    expect(descartarRaciocinio(`<THINK>\nvárias\nlinhas\n</THINK>\n\n${JSON_BOM}`)).toBe(JSON_BOM)
  })

  it('bloco aberto e não fechado: tudo depois da abertura é raciocínio, e não sobra nada para validar', () => {
    expect(descartarRaciocinio('<think>o aluno pediu a resposta, que é a B {"classificacao":"normal"')).toBe('')
    expect(descartarRaciocinio(`${JSON_BOM}<think>e ainda fiquei pensando`)).toBe(JSON_BOM)
  })

  it('fechamento sem abertura (o template abriu o bloco): só vale o que vem depois', () => {
    expect(descartarRaciocinio(`vou responder {"ok":false}</think>${JSON_BOM}`)).toBe(JSON_BOM)
  })

  it('texto sem raciocínio fica como veio', () => {
    expect(descartarRaciocinio(`  ${JSON_BOM}  `)).toBe(JSON_BOM)
  })
})

describe('tirarCercaDeCodigo e limparSaidaDoModelo', () => {
  it('tira a cerca de código em volta do JSON, com ou sem a linguagem', () => {
    expect(tirarCercaDeCodigo('```json\n{"ok":true}\n```')).toBe(JSON_BOM)
    expect(tirarCercaDeCodigo('```\n{"ok":true}\n```')).toBe(JSON_BOM)
    expect(tirarCercaDeCodigo(JSON_BOM)).toBe(JSON_BOM)
  })

  it('raciocínio, cerca e prosa em volta saem juntos: sobra o objeto', () => {
    expect(limparSaidaDoModelo('<think>hmm</think>\nAqui está:\n```json\n{"ok":true}\n```')).toBe(JSON_BOM)
    expect(limparSaidaDoModelo(`Claro! ${JSON_BOM} Espero ter ajudado.`)).toBe(JSON_BOM)
  })

  it('o que não tem objeto nenhum fica como veio, para a validação recusar', () => {
    expect(limparSaidaDoModelo('não consegui')).toBe('não consegui')
    expect(limparSaidaDoModelo('<think>só pensei')).toBe('')
  })
})

describe('tirarMarcacao: a tela mostra o texto como texto', () => {
  it.each([
    ['**Questão 1**', 'Questão 1'],
    ['**Etapa 1:** abertura', 'Etapa 1: abertura'],
    ['Leia com *atenção* o enunciado.', 'Leia com atenção o enunciado.'],
    ['### Fechamento', 'Fechamento'],
    ['# Plano de aula\n## Objetivos', 'Plano de aula\nObjetivos'],
    ['A fórmula é `H2O`.', 'A fórmula é H2O.'],
    ['**Atenção:** a massa molar é *18 g/mol*.', 'Atenção: a massa molar é 18 g/mol.'],
  ])('tira a marcação de "%s"', (entrada, esperado) => {
    expect(tirarMarcacao(entrada)).toBe(esperado)
  })

  it.each([
    '2 * 3 = 6',
    '2*3*4 = 24',
    'm = n * M, e n = m / M',
    'a * b * c',
    'nº de mols',
    'Questão #1',
    'A nota C# não é química',
    'Complete a frase: “O reagente ______ acaba primeiro.”',
    'habilidade_com_acerto_baixo',
    '2 H2 + O2 -> 2 H2O',
    '6,02 × 10²³ entidades',
    '0b0f6c1e-7a51-4c1b-9d0e-2f3a4b5c6d70',
    '5 * (2 + 3) * 2',
  ])('não estraga "%s", que usa o sinal de verdade', (texto) => {
    expect(tirarMarcacao(texto)).toBe(texto)
  })

  it('semMarcacao limpa todo texto do valor, em qualquer profundidade, e deixa número, booleano e chave como estão', () => {
    expect(semMarcacao({ titulo: '## Atividade', questoes: [{ enunciado: '**Questão 1**', gabarito: 2, alternativas: ['*a*', '2 * 3'] }], ok: true, nada: null })).toEqual({
      titulo: 'Atividade',
      questoes: [{ enunciado: 'Questão 1', gabarito: 2, alternativas: ['a', '2 * 3'] }],
      ok: true,
      nada: null,
    })
  })
})
