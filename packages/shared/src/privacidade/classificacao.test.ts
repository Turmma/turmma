import { describe, expect, it } from 'vitest'
import { COLUNAS_FORA_DO_ARQUIVO } from './classificacao.js'

describe('COLUNAS_FORA_DO_ARQUIVO', () => {
  it('o token e o endereço cifrados do convite que espera o e-mail nunca entram no arquivo do titular', () => {
    expect(COLUNAS_FORA_DO_ARQUIVO).toContain('convite.token_cifrado')
    expect(COLUNAS_FORA_DO_ARQUIVO).toContain('convite.destino_cifrado')
  })

  it('cada coluna aparece uma vez só', () => {
    expect(new Set(COLUNAS_FORA_DO_ARQUIVO).size).toBe(COLUNAS_FORA_DO_ARQUIVO.length)
  })
})
