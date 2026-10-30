import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ErroDaApi } from '../../api/cliente'
import {
  EFEITO_DA_DECISAO,
  quantidadeDePedidos,
  rotuloDaDecisao,
  TEXTO_DA_AUDITORIA_DA_DECISAO,
  TEXTO_DA_MATRICULA_ERRADA,
  TEXTO_DE_COMO_DECIDIR,
  TEXTO_DO_LIMITE,
  textoDaFalhaDaDecisao,
  textoDoQueVaiSerDecidido,
  textoDoResultado,
  textoDosNovos,
  textoDosQueSairam,
} from './textos'

/** W6 (A1, 16.0): os textos da decisão sobre os pedidos, por extenso. */
describe('W6: o que a tela dos pedidos diz', () => {
  it('a marca da matrícula errada é um fato sobre o pedido, sem número, sem hora e sem suspeita sobre o aluno', () => {
    expect(TEXTO_DA_MATRICULA_ERRADA).toBe('Houve tentativa com matrícula errada neste nome; pode ter sido erro de digitação')
    expect(TEXTO_DA_MATRICULA_ERRADA).not.toMatch(/\d/)
    expect(TEXTO_DA_MATRICULA_ERRADA).not.toMatch(/aluno|suspeit|fraude|vezes|tentativas/i)
  })

  it('o resultado de cada pedido: ja_decidida e nao_encontrada com os textos da spec, e o decidida pelo que a decisão fez', () => {
    for (const decisao of ['aprovar', 'recusar'] as const) {
      expect(textoDoResultado(decisao, 'ja_decidida')).toBe('Já decidido por outra pessoa')
      expect(textoDoResultado(decisao, 'nao_encontrada')).toBe('Este pedido não está mais disponível')
    }
    expect(textoDoResultado('aprovar', 'decidida')).toBe('Aprovado: já pode entrar com a matrícula e a senha')
    expect(textoDoResultado('recusar', 'decidida')).toBe('Recusado: o nome voltou à lista')
  })

  it('o limite é explicado antes de marcar e quando os 40 estão marcados, e a tela diz que não há aprovar todos', () => {
    expect(TEXTO_DE_COMO_DECIDIR).toBe('Marque os pedidos que você conferiu para aprovar ou recusar, até 40 por vez. Cada nome é conferido: não há como aprovar todos de uma vez.')
    expect(TEXTO_DO_LIMITE).toBe('Você marcou 40 pedidos, o máximo de uma decisão. Decida estes para marcar os outros.')
  })

  it('antes de confirmar: a decisão, a quantidade e a turma; o efeito de aprovar e o de recusar, que diz que o nome volta', () => {
    expect(textoDoQueVaiSerDecidido('aprovar', 3, '7ºA')).toBe('Você vai aprovar 3 pedidos da turma 7ºA.')
    expect(textoDoQueVaiSerDecidido('recusar', 1, '2ºB')).toBe('Você vai recusar 1 pedido da turma 2ºB.')
    expect(EFEITO_DA_DECISAO.aprovar).toContain('vira a conta do aluno')
    expect(EFEITO_DA_DECISAO.recusar).toContain('o nome volta à lista da turma')
    expect(TEXTO_DA_AUDITORIA_DA_DECISAO).toBe('Esta decisão fica registrada na auditoria, em seu nome, como decisão da coordenação.')
  })

  it('os botões dizem a decisão e quantos pedidos, no singular e no plural', () => {
    expect(rotuloDaDecisao('aprovar', 1)).toBe('Aprovar 1 pedido')
    expect(rotuloDaDecisao('aprovar', 40)).toBe('Aprovar 40 pedidos')
    expect(rotuloDaDecisao('recusar', 2)).toBe('Recusar 2 pedidos')
    expect(quantidadeDePedidos(1)).toBe('1 pedido')
  })

  it('os pedidos novos e os que saíram do diálogo, no singular e no plural', () => {
    expect(textoDosNovos(1)).toBe('1 pedido novo na lista.')
    expect(textoDosNovos(3)).toBe('3 pedidos novos na lista.')
    expect(textoDosQueSairam(1)).toBe('1 pedido saiu desta decisão: outra pessoa decidiu antes.')
    expect(textoDosQueSairam(2)).toBe('2 pedidos saíram desta decisão: outra pessoa decidiu antes.')
  })

  it('a falha diz o que fazer e o que houve com a lista de cada papel, sem o código do erro', () => {
    const indisponivel = new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    const doProfessor = textoDaFalhaDaDecisao(indisponivel, 'professor')
    const daCoordenacao = textoDaFalhaDaDecisao(indisponivel, 'coordenacao')
    expect(doProfessor).toBe(`${MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO} Alguns pedidos podem já ter sido decididos: a lista foi atualizada, e os que continuam aqui ainda esperam.`)
    expect(daCoordenacao).toBe(`${MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO} Alguns pedidos podem já ter sido decididos. Feche e clique em Atualizar para ver os que continuam esperando.`)
    const semAno = textoDaFalhaDaDecisao(new ErroDaApi(ErrorCode.NAO_ENCONTRADO), 'professor')
    expect(semAno).toContain('a escola está sem ano letivo em curso')
    for (const texto of [doProfessor, daCoordenacao, semAno]) expect(texto).not.toMatch(/INDISPONIVEL|NAO_ENCONTRADO|\b[45]\d\d\b/)
  })
})
