import { describe, expect, it } from 'vitest'
import { anuncioDoItem, fimDaRodada } from './use-lote-de-material'
import type { SituacaoDoItem } from './material-envio'

/** O que o diálogo do lote faz quando a rodada acaba e o que o leitor de tela ouve de cada arquivo (ingestao-do-material, 7.0; RF14), sem React. */

const situacoes = (...lista: SituacaoDoItem[]) => lista.map((situacao) => ({ situacao }))

describe('fimDaRodada: o que o diálogo faz quando a rodada acaba', () => {
  it('o 429 espera o horário; qualquer outra parada deixa o botão "Continuar o envio"', () => {
    expect(fimDaRodada({ tipo: 'limite', esperaSegundos: 30 }, situacoes('enviado', 'pendente'))).toBe('limite')
    expect(fimDaRodada({ tipo: 'limite', esperaSegundos: undefined }, situacoes('pendente'))).toBe('limite')
    expect(fimDaRodada({ tipo: 'licenca_vencida' }, situacoes('enviado', 'pendente'))).toBe('parou')
    expect(fimDaRodada({ tipo: 'cancelado' }, situacoes('enviado', 'pendente'))).toBe('parou')
  })

  it('o lote que saiu inteiro conclui e fecha, com o repetido contando como feito', () => {
    expect(fimDaRodada(undefined, situacoes('enviado', 'enviado'))).toBe('concluir')
    expect(fimDaRodada(undefined, situacoes('enviado', 'ja_enviado'))).toBe('concluir')
    expect(fimDaRodada(undefined, situacoes('ja_enviado', 'enviado'))).toBe('concluir')
  })

  it('o lote com falha, ou em que nada novo saiu, fica aberto com o resumo', () => {
    expect(fimDaRodada(undefined, situacoes('enviado', 'falhou'))).toBe('resumir')
    expect(fimDaRodada(undefined, situacoes('enviado', 'pendente'))).toBe('resumir')
    expect(fimDaRodada(undefined, situacoes('ja_enviado', 'ja_enviado'))).toBe('resumir')
    expect(fimDaRodada(undefined, [])).toBe('resumir')
  })
})

describe('anuncioDoItem: o nome do arquivo e o que aconteceu com ele', () => {
  it('diz o arquivo que saiu, o que já estava lá e o que falhou, com o texto da falha', () => {
    expect(anuncioDoItem('cap-1.pdf', { situacao: 'enviado' })).toBe('cap-1.pdf: Enviado. A leitura das páginas começa agora.')
    expect(anuncioDoItem('cap-2.pdf', { situacao: 'ja_enviado' })).toBe('cap-2.pdf: Já enviado nesta escola')
    expect(anuncioDoItem('cap-3.pdf', { situacao: 'falhou', texto: 'O arquivo não abre.' })).toBe('cap-3.pdf: O arquivo não abre.')
    expect(anuncioDoItem('cap-3.pdf', { situacao: 'falhou' })).toBe('cap-3.pdf: Não foi enviado')
  })

  it('não diz nada quando o arquivo só entra em envio ou volta à fila, quando não mudou a situação, ou sem arquivo', () => {
    expect(anuncioDoItem('cap-1.pdf', { situacao: 'enviando' })).toBeUndefined()
    expect(anuncioDoItem('cap-1.pdf', { situacao: 'pendente' })).toBeUndefined()
    expect(anuncioDoItem('cap-1.pdf', { texto: 'só o texto' })).toBeUndefined()
    expect(anuncioDoItem(undefined, { situacao: 'enviado' })).toBeUndefined()
  })
})
