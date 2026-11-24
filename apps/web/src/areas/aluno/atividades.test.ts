import { SITUACOES_DA_MINHA_ATIVIDADE, type MinhaAtividade } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { AVISO_DA_AVALIACAO, detalheDaSituacao, estaParaResponder, resumoDaAtividade, separarAtividades, TEXTO_DA_ESPERA_PELA_CORRECAO, TEXTO_DA_SITUACAO, VAZIO_DE_CADA_GRUPO } from './atividades'

const atividade = (final: string, campos: Partial<MinhaAtividade> = {}): MinhaAtividade => ({
  id: `0190f5a0-0000-7000-8000-0000000000${final}`,
  titulo: `Atividade ${final}`,
  disciplina: { id: '0190f5a0-0000-7000-8000-0000000000c1', nome: 'Química' },
  avaliativa: false,
  situacao: 'para_fazer',
  questoes: 8,
  respondidas: 0,
  aplicadaEm: '2026-10-05T13:00:00.000Z',
  enviadaEm: null,
  janela: null,
  duracaoMin: null,
  ...campos,
})

describe('a lista de atividades do aluno', () => {
  it('diz o estado de cada atividade em texto: para fazer, entregue, encerrada, corrigida', () => {
    expect(TEXTO_DA_SITUACAO).toEqual({ para_fazer: 'Para fazer', em_andamento: 'Para fazer', enviada: 'Entregue', encerrada: 'Encerrada', com_diagnostico: 'Corrigida' })
  })

  it('só a atividade com o lote aprovado fala de resultado; enviada e encerrada dizem que a correção ainda vai ser revista', () => {
    expect(detalheDaSituacao(atividade('01', { situacao: 'enviada', respondidas: 8 }))).toBe(TEXTO_DA_ESPERA_PELA_CORRECAO)
    expect(detalheDaSituacao(atividade('02', { situacao: 'encerrada', respondidas: 3 }))).toContain(TEXTO_DA_ESPERA_PELA_CORRECAO)
    for (const situacao of SITUACOES_DA_MINHA_ATIVIDADE) {
      const texto = `${TEXTO_DA_SITUACAO[situacao]} ${detalheDaSituacao(atividade('03', { situacao, respondidas: 6 }))}`
      // Antes da aprovação a tela não diz "resultado" nem "acertos": nada do que a correção pendente achou.
      expect(/resultado|acert/i.test(texto), situacao).toBe(situacao === 'com_diagnostico')
    }
  })

  it('nenhum texto da lista fala em nota, conceito, colega, turma ou posição, nem cobra com urgência (D46, D59; regra 50, item 9)', () => {
    for (const situacao of SITUACOES_DA_MINHA_ATIVIDADE) {
      const texto = `${TEXTO_DA_SITUACAO[situacao]} ${detalheDaSituacao(atividade('04', { situacao, respondidas: 2 }))} ${resumoDaAtividade(atividade('04'))} ${AVISO_DA_AVALIACAO}`
      expect(texto).not.toMatch(/\bnotas?\b|conceito|colega|média|posição|ranking|atrasad|corra|rápido|!/i)
    }
  })

  it('quem começou vê quantas respondeu e que dá para continuar, sem contagem de tempo', () => {
    expect(detalheDaSituacao(atividade('05', { situacao: 'em_andamento', respondidas: 2 }))).toBe('Você respondeu 2 de 8. Dá para continuar de onde parou.')
    expect(resumoDaAtividade(atividade('05'))).toBe('Química · 8 questões')
    expect(resumoDaAtividade(atividade('05', { questoes: 1 }))).toBe('Química · 1 questão')
  })

  it('"Corrigida" é só da atividade com a correção aprovada: nenhum outro estado a diz (regra 70, item 3)', () => {
    for (const situacao of SITUACOES_DA_MINHA_ATIVIDADE) expect(/corrigid/i.test(TEXTO_DA_SITUACAO[situacao]), situacao).toBe(situacao === 'com_diagnostico')
  })

  it('separa em três grupos, na ordem em que a API entregou; só com_diagnostico fica em "Corrigidas"', () => {
    const itens = [
      atividade('01', { situacao: 'enviada' }),
      atividade('02'),
      atividade('03', { situacao: 'com_diagnostico' }),
      atividade('04', { situacao: 'em_andamento' }),
      atividade('05', { situacao: 'encerrada' }),
      atividade('06', { situacao: 'com_diagnostico' }),
    ]
    const { paraFazer, entregues, corrigidas } = separarAtividades(itens)
    expect(paraFazer.map((item) => item.titulo)).toEqual(['Atividade 02', 'Atividade 04'])
    expect(entregues.map((item) => item.titulo)).toEqual(['Atividade 01', 'Atividade 05'])
    expect(corrigidas.map((item) => item.titulo)).toEqual(['Atividade 03', 'Atividade 06'])
    expect(estaParaResponder(atividade('07', { situacao: 'encerrada' }))).toBe(false)
  })

  it('cada atividade cai em exatamente um grupo, seja qual for a situação', () => {
    const itens = SITUACOES_DA_MINHA_ATIVIDADE.map((situacao, indice) => atividade(`0${String(indice + 1)}`, { situacao }))
    const { paraFazer, entregues, corrigidas } = separarAtividades(itens)
    expect(paraFazer.length + entregues.length + corrigidas.length).toBe(itens.length)
  })

  it('o vazio de cada grupo diz um fato, sem cobrar nem desculpar (D59)', () => {
    expect(VAZIO_DE_CADA_GRUPO).toEqual({ paraFazer: 'Nada para fazer agora.', entregues: 'Nada esperando quem dá a aula.', corrigidas: 'Nenhuma corrigida ainda.' })
  })
})
