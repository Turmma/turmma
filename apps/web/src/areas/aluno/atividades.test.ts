import { SITUACOES_DA_MINHA_ATIVIDADE, type MinhaAtividade } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { AVISO_DA_AVALIACAO, AVISO_DA_PROVA, avisoDaAvaliacao, detalheDaSituacao, diaEHoraNaEscola, estaParaResponder, horaNaEscola, resumoDaAtividade, separarAtividades, situacaoDaJanela, TEXTO_DA_ESPERA_PELA_CORRECAO, TEXTO_DA_SITUACAO, textoDaJanelaNaLista, VAZIO_DE_CADA_GRUPO } from './atividades'

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
      const texto = `${TEXTO_DA_SITUACAO[situacao]} ${detalheDaSituacao(atividade('04', { situacao, respondidas: 2 }))} ${resumoDaAtividade(atividade('04'))} ${AVISO_DA_AVALIACAO} ${AVISO_DA_PROVA}`
      expect(texto).not.toMatch(/\bnotas?\b|conceito|colega|média|posição|ranking|atrasad|corra|rápido|!/i)
    }
  })

  it('o aviso da avaliação com janela diz que o Tutor pausa só durante a prova, da abertura até o fim do tempo dele; sem janela, o texto de antes da F6 (Tech Spec §5.10)', () => {
    const janela = { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-24T14:40:00.000Z' }
    expect(avisoDaAvaliacao(atividade('06', { avaliativa: true, janela }))).toBe(AVISO_DA_PROVA)
    expect(AVISO_DA_PROVA).toContain('durante a prova')
    expect(AVISO_DA_PROVA).toContain('da abertura até ela fechar')
    expect(AVISO_DA_PROVA).not.toMatch(/seu tempo|adicional/i)
    expect(AVISO_DA_PROVA).not.toContain('até quem dá a aula encerrar')
    expect(avisoDaAvaliacao(atividade('07', { avaliativa: true, janela: null }))).toBe(AVISO_DA_AVALIACAO)
    expect(AVISO_DA_AVALIACAO).toContain('até quem dá a aula encerrar')
    // Nem pressa nem cobrança, nem fala de colega ou de nota (D46, D59; regra 50, item 9).
    expect(AVISO_DA_PROVA).not.toMatch(/\bnotas?\b|conceito|colega|média|posição|ranking|atrasad|corra|rápido|!/i)
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

describe('a janela da prova na lista do aluno (avaliacao-e-correcao, 12.1)', () => {
  const janela = { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-24T14:40:00.000Z' }
  const antes = Date.parse('2026-11-24T12:59:00.000Z')
  const dentro = Date.parse('2026-11-24T13:30:00.000Z')
  const depois = Date.parse('2026-11-24T14:40:00.000Z')

  it('escreve o dia e a hora na parede da escola, e não na do computador', () => {
    // 13:00 UTC é 10:00 em São Paulo.
    expect(diaEHoraNaEscola(janela.abreEm)).toBe('24/11 às 10:00')
    expect(horaNaEscola(janela.fechaEm)).toBe('11:40')
  })

  it('"Abre em 24/11 às 10:00" antes de abrir, "Fechou" depois de fechar, e nada enquanto está aberta', () => {
    const paraFazer = atividade('01', { avaliativa: true, janela })
    expect(textoDaJanelaNaLista(paraFazer, antes)).toBe('Abre em 24/11 às 10:00')
    expect(textoDaJanelaNaLista(paraFazer, dentro)).toBeUndefined()
    expect(textoDaJanelaNaLista(paraFazer, depois)).toBe('Fechou')
  })

  it('a atividade sem janela não diz nada, e quem já começou não "fechou" (a extensão e a queda andam o tempo dele)', () => {
    expect(textoDaJanelaNaLista(atividade('02'), depois)).toBeUndefined()
    expect(textoDaJanelaNaLista(atividade('03', { avaliativa: true, janela, situacao: 'em_andamento' }), depois)).toBeUndefined()
    expect(textoDaJanelaNaLista(atividade('04', { avaliativa: true, janela, situacao: 'enviada' }), antes)).toBeUndefined()
  })

  it('a situação da janela: o instante exato da abertura está dentro, e o do fechamento já é depois', () => {
    expect(situacaoDaJanela(janela, Date.parse(janela.abreEm))).toBe('aberta')
    expect(situacaoDaJanela(janela, Date.parse(janela.fechaEm))).toBe('depois')
    expect(situacaoDaJanela(null, 0)).toBe('aberta')
  })
})
