import { describe, expect, it } from 'vitest'
import { HABILIDADES_NA_MEMORIA_DA_TAREFA, memoriaDoTrabalho, questaoSemGabarito } from './turno.command.js'
import type { TrabalhoDoAluno } from './tutor.repository.js'

const habilidade = (codigo: string) => ({ codigo, descricao: `Descrição de ${codigo}` })

/** O conteúdo que o artefato grava: quatro alternativas, o gabarito e a explicação, que o Tutor nunca recebe. */
const conteudo = (codigos: readonly string[]) => ({
  tipo: 'atividade_objetiva',
  titulo: 'Lista sintética',
  questoes: codigos.map((codigo, indice) => ({
    enunciado: `Enunciado ${String(indice + 1)}`,
    alternativas: ['A', 'B', 'C', 'D'],
    gabarito: 2,
    habilidade: habilidade(codigo),
    citacao: { materialId: '6f1c1a58-5d79-4d3f-8c4e-3f7a2f1b0c11', pagina: 1, trecho: 'trecho do material' },
    explicacao: 'Explicação que o aluno não vê antes da aprovação',
  })),
})

const trabalho = (codigos: readonly string[], porHabilidade: unknown, extra: Partial<TrabalhoDoAluno> = {}): TrabalhoDoAluno => ({
  atividadeAplicadaId: '0b7c9a3e-7f0a-4f6e-9d3e-2a6f6c2d9e10',
  titulo: 'Lista sintética',
  conteudo: conteudo(codigos),
  enviadaEm: null,
  acertos: null,
  total: null,
  porHabilidade,
  ...extra,
})

describe('questaoSemGabarito: o que o Tutor recebe da questão em que o aluno está', () => {
  it('leva número, enunciado, alternativas e habilidade, e nunca o gabarito, a explicação nem a citação', () => {
    const questao = questaoSemGabarito(conteudo(['EM13CNT101', 'EM13CNT102']), 2)
    expect(questao).toEqual({ numero: 2, enunciado: 'Enunciado 2', alternativas: ['A', 'B', 'C', 'D'], habilidade: habilidade('EM13CNT102') })
    expect(JSON.stringify(questao)).not.toMatch(/gabarito|explicacao|citacao/u)
  })

  it('a questão que a atividade não tem, o número zero e o conteúdo que não lê como atividade não devolvem nada', () => {
    expect(questaoSemGabarito(conteudo(['EM13CNT101']), 2)).toBeUndefined()
    expect(questaoSemGabarito(conteudo(['EM13CNT101']), 0)).toBeUndefined()
    expect(questaoSemGabarito({ tipo: 'plano_de_aula' }, 1)).toBeUndefined()
    expect(questaoSemGabarito(null, 1)).toBeUndefined()
  })
})

describe('memoriaDoTrabalho: só o diagnóstico por habilidade, de lote aprovado (D66)', () => {
  it('soma acertos e erros por habilidade do catálogo, e põe na frente a que mais errou, com o código desempatando', () => {
    const memoria = memoriaDoTrabalho([
      trabalho(['QUI.1', 'QUI.2', 'QUI.3', 'QUI.4'], [{ codigo: 'QUI.1', acertos: 1, total: 2 }, { codigo: 'QUI.2', acertos: 0, total: 4 }, { codigo: 'QUI.4', acertos: 1, total: 2 }, { codigo: 'QUI.3', acertos: 1, total: 2 }]),
      trabalho(['QUI.1'], [{ codigo: 'QUI.1', acertos: 0, total: 2 }]),
    ])
    // QUI.2 erra mais (4); QUI.1 soma 1 + 2 = 3 erros; QUI.3 e QUI.4 empatam em 1, e o código desempata.
    expect(memoria.map(({ habilidade: { codigo }, acertos, erros }) => [codigo, acertos, erros])).toEqual([
      ['QUI.2', 0, 4],
      ['QUI.1', 1, 3],
      ['QUI.3', 1, 1],
      ['QUI.4', 1, 1],
    ])
  })

  it('o trabalho sem lote aprovado (diagnóstico nulo) e a habilidade que a atividade não tem não entram', () => {
    const memoria = memoriaDoTrabalho([trabalho(['QUI.1'], null), trabalho(['QUI.1'], [{ codigo: 'QUI.1', acertos: 1, total: 2 }, { codigo: 'FIS.9', acertos: 0, total: 4 }])])
    expect(memoria).toEqual([{ habilidade: habilidade('QUI.1'), acertos: 1, erros: 1 }])
    expect(memoriaDoTrabalho([])).toEqual([])
  })

  it('leva no máximo as habilidades que a tarefa aceita', () => {
    const codigos = Array.from({ length: HABILIDADES_NA_MEMORIA_DA_TAREFA + 3 }, (_, indice) => `H.${String(indice).padStart(2, '0')}`)
    const unica = trabalho(codigos.slice(0, 20), codigos.slice(0, 20).map((codigo) => ({ codigo, acertos: 0, total: 1 })))
    expect(memoriaDoTrabalho([unica])).toHaveLength(HABILIDADES_NA_MEMORIA_DA_TAREFA)
  })
})
