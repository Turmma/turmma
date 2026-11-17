import { describe, expect, it } from 'vitest'
import { diaCurto, prazoNaTela } from '../../e2e/support/prazo-do-pedido.ts'

/**
 * O prazo do pedido, no e2e, cruza três relógios: o do banco (que grava a chegada na semeadura), o da tela (que conta `Faltam N`
 * no dia em que é lida) e o do teste. O vencimento (chegada + 15) é fixo desde a semeadura; só o `Faltam N` anda um dia na
 * meia-noite de São Paulo. O ajudante recebe o dia da semeadura e aceita as duas leituras: a do mesmo dia e a do dia seguinte.
 *
 * A semeadura é sempre 3/11/2026; a unidade declara o fuso do computador como Tóquio (`vitest.config.ts`), e o dia aqui é dado, não lido.
 */
const SEMEADURA = '2026-11-03'

describe('prazoNaTela: o texto do prazo, com a semeadura de um dia e a leitura do mesmo dia ou do seguinte', () => {
  it('aceita a leitura do mesmo dia e a da virada, com o mesmo vencimento', () => {
    // Chegou há 11 dias: vence em 7/11, a 4 dias da semeadura.
    const esperado = prazoNaTela(SEMEADURA, 11)
    expect(esperado.test('Faltam 4 dias, até 07/11/2026')).toBe(true)
    expect(esperado.test('Faltam 3 dias, até 07/11/2026')).toBe(true)
  })

  it('recusa a combinação que a conta antiga esperava depois da virada: o vencimento não anda com o relógio', () => {
    const esperado = prazoNaTela(SEMEADURA, 11)
    // O teste somava 4 ao dia de depois da virada (4/11) e esperava um vencimento de 8/11, que o pedido nunca teve.
    expect(esperado.test('Faltam 4 dias, até 08/11/2026')).toBe(false)
    expect(esperado.test('Faltam 5 dias, até 07/11/2026')).toBe(false)
    expect(esperado.test('Faltam 2 dias, até 07/11/2026')).toBe(false)
  })

  it('o vencido diz há quantos dias, e a virada soma um', () => {
    // Chegou há 20 dias: venceu em 29/10 (3/11 - 20 + 15), 5 dias antes da semeadura.
    const esperado = prazoNaTela(SEMEADURA, 20)
    expect(esperado.test('Prazo vencido há 5 dias (venceu em 29/10/2026)')).toBe(true)
    expect(esperado.test('Prazo vencido há 6 dias (venceu em 29/10/2026)')).toBe(true)
    // O vencimento é fixo: o dia de depois da virada (30/10) é o que a conta antiga escreveria.
    expect(esperado.test('Prazo vencido há 6 dias (venceu em 30/10/2026)')).toBe(false)
    expect(esperado.test('Prazo vencido há 7 dias (venceu em 29/10/2026)')).toBe(false)
  })

  it('o dia do vencimento ainda é prazo, e um dia só é no singular', () => {
    // Chegou há 14 dias: vence em 4/11, um dia depois da semeadura; na virada, vence hoje.
    expect(prazoNaTela(SEMEADURA, 14).test('Falta 1 dia, até 04/11/2026')).toBe(true)
    expect(prazoNaTela(SEMEADURA, 14).test('O prazo vence hoje, 04/11/2026')).toBe(true)
    // Chegou há 15 dias: vence na semeadura; na virada, venceu há 1 dia.
    expect(prazoNaTela(SEMEADURA, 15).test('O prazo vence hoje, 03/11/2026')).toBe(true)
    expect(prazoNaTela(SEMEADURA, 15).test('Prazo vencido há 1 dia (venceu em 03/11/2026)')).toBe(true)
  })

  it('diaCurto escreve o dia como a tela', () => {
    expect(diaCurto('2026-10-09')).toBe('09/10/2026')
  })
})
