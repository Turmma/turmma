import { LLMError } from '@educa/nucleo'
import type { AdaptacaoAplicada, ConteudoDeAtividade, QuestaoObjetiva } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { exigirCitacoesEntregues } from '../assistente/citacoes.js'
import { citacoesDoConteudo, exigirAdaptacaoFiel, habilidadesParaOTema } from './conferencia.js'

const MATERIAL = '0190f5a0-0000-7000-8000-0000000000a1'
const OUTRO_MATERIAL = '0190f5a0-0000-7000-8000-0000000000a2'

const questao = (pagina: number, gabarito: number): QuestaoObjetiva => ({
  enunciado: `Segundo o material, o que diz a página ${String(pagina)}?`,
  alternativas: ['a', 'b', 'c', 'd'],
  gabarito,
  habilidade: { codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' },
  citacao: { materialId: MATERIAL, pagina, trecho: 'trecho da página' },
  explicacao: 'porque sim',
})
const original: ConteudoDeAtividade = { tipo: 'atividade_objetiva', titulo: 'Atividade', questoes: [questao(1, 0), questao(2, 3)] }
const pedida: AdaptacaoAplicada = { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 25 }
const adaptada = (mudanca: (conteudo: ConteudoDeAtividade) => ConteudoDeAtividade = (conteudo) => conteudo): ConteudoDeAtividade =>
  mudanca({ ...structuredClone(original), titulo: 'Atividade (versão adaptada)', adaptacao: { tipos: ['tempo_adicional', 'fonte_ampliada'], tempoExtraPercentual: 25 } })
const trocarQuestao = (indice: number, mudanca: Partial<QuestaoObjetiva>) => (conteudo: ConteudoDeAtividade): ConteudoDeAtividade => ({
  ...conteudo,
  questoes: conteudo.questoes.map((item, posicao) => (posicao === indice ? { ...item, ...mudanca } : item)),
})
const recusa = (funcao: () => void): unknown => {
  try {
    funcao()
  } catch (erro) {
    return erro
  }
  return undefined
}

describe('exigirCitacoesEntregues', () => {
  const entregues = [{ materialId: MATERIAL, pagina: 1 }, { materialId: MATERIAL, pagina: 2 }]

  it('aceita a citação de página que foi entregue, e recusa a página que não veio e o material que não veio', () => {
    expect(recusa(() => exigirCitacoesEntregues(citacoesDoConteudo(original), entregues))).toBeUndefined()
    for (const fora of [{ materialId: MATERIAL, pagina: 3 }, { materialId: OUTRO_MATERIAL, pagina: 1 }]) {
      const erro = recusa(() => exigirCitacoesEntregues([...citacoesDoConteudo(original), fora], entregues))
      expect(erro).toBeInstanceOf(LLMError)
      expect((erro as LLMError).codigo).toBe('IA_SAIDA_INVALIDA')
    }
  })

  it('no plano de aula, confere a lista de citações e a de cada etapa', () => {
    const citacao = { materialId: MATERIAL, pagina: 1, trecho: 't' }
    const citadas = citacoesDoConteudo({
      tipo: 'plano_de_aula',
      titulo: 'Plano',
      objetivos: ['o'],
      habilidades: [{ codigo: 'QUI.EM.05', descricao: 'd' }],
      duracaoMinutos: 50,
      etapas: [{ titulo: 'e', minutos: 10, descricao: 'd', citacao: { ...citacao, pagina: 9 } }, { titulo: 'f', minutos: 10, descricao: 'd' }],
      avaliacao: 'a',
      citacoes: [citacao],
    })
    expect(citadas.map((citada) => citada.pagina)).toEqual([1, 9])
    expect(recusa(() => exigirCitacoesEntregues(citadas, entregues))).toBeInstanceOf(LLMError)
  })
})

describe('exigirAdaptacaoFiel: a versão adaptada muda a forma, nunca o que é cobrado', () => {
  it('aceita o enunciado reescrito, com os tipos pedidos em qualquer ordem', () => {
    expect(recusa(() => exigirAdaptacaoFiel(original, adaptada(trocarQuestao(0, { enunciado: 'O que diz a página 1?\nMarque uma alternativa.' })), pedida))).toBeUndefined()
  })

  it.each([
    ['o gabarito mudou', adaptada(trocarQuestao(1, { gabarito: 0 }))],
    ['a habilidade mudou', adaptada(trocarQuestao(0, { habilidade: { codigo: 'QUI.EM.02', descricao: 'outra' } }))],
    ['a página citada mudou', adaptada(trocarQuestao(0, { citacao: { materialId: MATERIAL, pagina: 5, trecho: 'trecho da página' } }))],
    ['o material citado mudou', adaptada(trocarQuestao(0, { citacao: { materialId: OUTRO_MATERIAL, pagina: 1, trecho: 'trecho da página' } }))],
    ['uma questão sumiu', adaptada((conteudo) => ({ ...conteudo, questoes: conteudo.questoes.slice(0, 1) }))],
    ['as questões trocaram de ordem', adaptada((conteudo) => ({ ...conteudo, questoes: [...conteudo.questoes].reverse() }))],
    ['veio um tipo que não foi pedido', adaptada((conteudo) => ({ ...conteudo, adaptacao: { tipos: ['fonte_ampliada', 'tempo_adicional', 'leitura_de_apoio'], tempoExtraPercentual: 25 } }))],
    ['o tempo extra mudou', adaptada((conteudo) => ({ ...conteudo, adaptacao: { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50 } }))],
    ['veio sem a adaptação', { ...structuredClone(original) }],
  ])('recusa quando %s', (_caso, saida) => {
    const erro = recusa(() => exigirAdaptacaoFiel(original, saida, pedida))
    expect(erro).toBeInstanceOf(LLMError)
    expect((erro as LLMError).codigo).toBe('IA_SAIDA_INVALIDA')
  })
})

describe('habilidadesParaOTema', () => {
  it('no máximo seis, só código e descrição, com as do tema pedido na frente', () => {
    const habilidades = habilidadesParaOTema('Química', 'em', 'estequiometria e reagente limitante')
    expect(habilidades).toHaveLength(6)
    expect(habilidades[0]).toEqual({ codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' })
    expect(habilidades.map((habilidade) => habilidade.codigo).sort()).toEqual(['QUI.EM.01', 'QUI.EM.02', 'QUI.EM.03', 'QUI.EM.04', 'QUI.EM.05', 'QUI.EM.06'])
    expect(habilidades.every((habilidade) => Object.keys(habilidade).join() === 'codigo,descricao')).toBe(true)
  })

  it('disciplina sem catálogo recebe a habilidade geral, nunca lista vazia', () => {
    expect(habilidadesParaOTema('Filosofia', 'em', 'ética')).toEqual([{ codigo: 'GERAL.01', descricao: 'Compreender e aplicar o conteúdo estudado no material da turma.' }])
  })
})
