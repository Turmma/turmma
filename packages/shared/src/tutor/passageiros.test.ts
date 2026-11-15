import { describe, expect, it } from 'vitest'
import { ErrorCode } from '../errors/error-code.js'
import { PASSAGEIROS } from './passageiros.js'

describe('PASSAGEIROS: os erros que a tela deixa tentar de novo', () => {
  it('é a lista inteira, com os três de entrada e de teto da IA', () => {
    expect([...PASSAGEIROS].sort()).toEqual(
      [
        ErrorCode.IA_INDISPONIVEL,
        ErrorCode.IA_TEMPO_ESGOTADO,
        ErrorCode.IA_SAIDA_INVALIDA,
        ErrorCode.IA_ENTRADA_INVALIDA,
        ErrorCode.PEDIDO_ACIMA_DO_TETO,
        ErrorCode.EXECUCAO_INTERROMPIDA,
        ErrorCode.INDISPONIVEL_TENTE_DE_NOVO,
        ErrorCode.TEMPO_ESGOTADO,
        ErrorCode.ERRO_INTERNO,
      ].sort(),
    )
  })

  it('o que pede mudança antes não passa sozinho: orçamento, função suspensa, tema sem material', () => {
    for (const codigo of [ErrorCode.IA_ORCAMENTO_ESGOTADO, ErrorCode.FUNCAO_SUSPENSA, ErrorCode.MATERIAL_INSUFICIENTE, ErrorCode.LIMITE_DIARIO_DO_TUTOR]) {
      expect(PASSAGEIROS).not.toContain(codigo)
    }
  })

  it('não repete código', () => {
    expect(new Set(PASSAGEIROS).size).toBe(PASSAGEIROS.length)
  })
})
