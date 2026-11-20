import { LLMError } from '@educa/core'
import type { AdaptacaoAplicada, ConteudoDeAtividade, ConteudoDePlanoDeAula, QuestaoObjetiva } from '@educa/shared'
import type { TrechoComHabilidades } from '../material/trecho-search.js'
import { describe, expect, it } from 'vitest'
import { exigirCitacoesEntregues } from '../assistente/citacoes.js'
import { anularHabilidadesForaDaSecao, citacoesDoConteudo, exigirAdaptacaoFiel } from './conferencia.js'

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
    ['a descrição da habilidade mudou', adaptada(trocarQuestao(0, { habilidade: { codigo: 'QUI.EM.05', descricao: 'outra descrição' } }))],
    ['a questão perdeu a habilidade (virou `null`)', adaptada(trocarQuestao(0, { habilidade: null }))],
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

describe('exigirAdaptacaoFiel: a questão sem habilidade (classificacao-bncc, 10.0)', () => {
  const semHabilidade: ConteudoDeAtividade = { ...structuredClone(original), questoes: [{ ...questao(1, 0), habilidade: null }, questao(2, 3)] }
  const adaptadaDe = (base: ConteudoDeAtividade, mudanca: Partial<QuestaoObjetiva>): ConteudoDeAtividade => ({
    ...structuredClone(base),
    titulo: 'Atividade (versão adaptada)',
    questoes: base.questoes.map((item, posicao) => (posicao === 0 ? { ...item, ...mudanca } : item)),
    adaptacao: { tipos: ['tempo_adicional', 'fonte_ampliada'], tempoExtraPercentual: 25 },
  })

  it('a questão sem habilidade continua sem ela na versão adaptada', () => {
    expect(recusa(() => exigirAdaptacaoFiel(semHabilidade, adaptadaDe(semHabilidade, {}), pedida))).toBeUndefined()
  })

  it('a versão adaptada não dá habilidade à questão que não tinha', () => {
    const erro = recusa(() => exigirAdaptacaoFiel(semHabilidade, adaptadaDe(semHabilidade, { habilidade: { codigo: 'EM13CNT101', descricao: 'Habilidade do capítulo 3.' } }), pedida))
    expect(erro).toBeInstanceOf(LLMError)
    expect((erro as LLMError).codigo).toBe('IA_SAIDA_INVALIDA')
  })
})

describe('anularHabilidadesForaDaSecao (classificacao-bncc, 10.0)', () => {
  const CAP_3 = { codigo: 'EM13CNT101', descricao: 'Habilidade do capítulo 3.' }
  const CAP_7 = { codigo: 'EM13CNT203', descricao: 'Habilidade do capítulo 7.' }
  const trecho = (pagina: number, habilidades: TrechoComHabilidades['habilidades']): TrechoComHabilidades => ({ materialId: MATERIAL, disciplinaId: 'd', titulo: 'Material', pagina, texto: 'texto', habilidades })
  const entregues = [trecho(1, [CAP_3]), trecho(2, [CAP_7])]
  const com = (pagina: number, habilidade: QuestaoObjetiva['habilidade']): QuestaoObjetiva => ({ ...questao(pagina, 0), habilidade })

  it('a questão com a habilidade da seção da página que cita fica como está', () => {
    const conteudo: ConteudoDeAtividade = { ...original, questoes: [com(1, CAP_3), com(2, CAP_7)] }
    expect(anularHabilidadesForaDaSecao(conteudo, entregues)).toEqual({ conteudo, anuladas: 0 })
  })

  it('a questão que cita o capítulo 7 com a habilidade do 3 sai sem habilidade, e a conta soma', () => {
    const conteudo: ConteudoDeAtividade = { ...original, questoes: [com(2, CAP_3), com(1, CAP_3)] }
    const { conteudo: gravado, anuladas } = anularHabilidadesForaDaSecao(conteudo, entregues)
    expect(anuladas).toBe(1)
    expect((gravado as ConteudoDeAtividade).questoes.map((q) => q.habilidade)).toEqual([null, CAP_3])
  })

  it('a questão sem habilidade não conta como anulada, e a página sem seção anula a que o modelo pôs', () => {
    const conteudo: ConteudoDeAtividade = { ...original, questoes: [com(1, null), com(3, CAP_3)] }
    const { conteudo: gravado, anuladas } = anularHabilidadesForaDaSecao(conteudo, entregues)
    expect(anuladas).toBe(1)
    expect((gravado as ConteudoDeAtividade).questoes.map((q) => q.habilidade)).toEqual([null, null])
  })

  it('a página de mesmo número em outro material não vale: a habilidade é a da seção do material que a questão cita', () => {
    const doOutro: TrechoComHabilidades = { ...trecho(2, [CAP_3]), materialId: OUTRO_MATERIAL }
    const conteudo: ConteudoDeAtividade = { ...original, questoes: [com(2, CAP_3)] }
    // A página 2 do material citado é do capítulo 7: a do 3 só existe na página 2 do outro material, que a questão não cita.
    const { conteudo: gravado, anuladas } = anularHabilidadesForaDaSecao(conteudo, [doOutro, trecho(2, [CAP_7])])
    expect(anuladas).toBe(1)
    expect((gravado as ConteudoDeAtividade).questoes.map((q) => q.habilidade)).toEqual([null])
  })

  it('o plano guarda só a união das seções que cita', () => {
    const citacao = { materialId: MATERIAL, pagina: 2, trecho: 'trecho da página' }
    const plano: ConteudoDePlanoDeAula = {
      tipo: 'plano_de_aula',
      titulo: 'Plano',
      objetivos: ['Entender o capítulo 7'],
      habilidades: [CAP_3, CAP_7],
      duracaoMinutos: 50,
      etapas: [{ titulo: 'Abertura', minutos: 10, descricao: 'Retoma o capítulo.', citacao }],
      avaliacao: 'Pergunta de fechamento.',
      citacoes: [citacao],
    }
    const { conteudo: gravado, anuladas } = anularHabilidadesForaDaSecao(plano, entregues)
    expect(anuladas).toBe(1)
    expect((gravado as ConteudoDePlanoDeAula).habilidades).toEqual([CAP_7])
  })
})
