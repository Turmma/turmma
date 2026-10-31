import { ALFABETO_DO_CODIGO_DE_RECUPERACAO } from '@educa/shared'
import { Secret, TOTP } from 'otpauth'
import { describe, expect, it } from 'vitest'
import { gerarCodigosDeRecuperacao, gerarSegredo, hmacDaRecuperacao, normalizarRecuperacao, passoDoCodigo } from './totp.js'

const INSTANTE = new Date('2026-09-18T10:00:10Z')
const PASSO = Math.floor(INSTANTE.getTime() / 30_000)

function codigoDoPasso(segredo: Uint8Array, passo: number): string {
  return TOTP.generate({ secret: new Secret({ buffer: segredo.slice().buffer }), algorithm: 'SHA1', digits: 6, period: 30, timestamp: passo * 30_000 })
}

describe('TOTP: SHA1, 6 dígitos, 30 s, janela de um passo', () => {
  it('o segredo novo tem 160 bits, sai em base32 e na URI otpauth, sem nada da pessoa', () => {
    const novo = gerarSegredo()
    expect(novo.bytes).toHaveLength(20)
    expect(novo.base32).toMatch(/^[A-Z2-7]{32}$/)
    expect(novo.uri).toMatch(/^otpauth:\/\/totp\//)
    const uri = new URL(novo.uri)
    expect(uri.searchParams.get('secret')).toBe(novo.base32)
    expect(uri.searchParams.get('algorithm')).toBe('SHA1')
    expect(uri.searchParams.get('digits')).toBe('6')
    expect(uri.searchParams.get('period')).toBe('30')
    expect(uri.searchParams.get('issuer')).toBe('Educa.ia')
    expect(novo.uri).not.toMatch(/@/)
    expect(gerarSegredo().base32).not.toBe(novo.base32)
  })

  it('o código do passo atual e o de um passo para cada lado valem, com o passo de cada um; dois passos fora, não', () => {
    const { bytes } = gerarSegredo()
    expect(passoDoCodigo(bytes, codigoDoPasso(bytes, PASSO), INSTANTE)).toBe(PASSO)
    expect(passoDoCodigo(bytes, codigoDoPasso(bytes, PASSO - 1), INSTANTE)).toBe(PASSO - 1)
    expect(passoDoCodigo(bytes, codigoDoPasso(bytes, PASSO + 1), INSTANTE)).toBe(PASSO + 1)
    expect(passoDoCodigo(bytes, codigoDoPasso(bytes, PASSO + 2), INSTANTE)).toBeUndefined()
    expect(passoDoCodigo(bytes, codigoDoPasso(bytes, PASSO - 2), INSTANTE)).toBeUndefined()
  })

  it('o código de outro segredo não vale', () => {
    const { bytes } = gerarSegredo()
    const outro = gerarSegredo().bytes
    expect(passoDoCodigo(bytes, codigoDoPasso(outro, PASSO), INSTANTE)).toBeUndefined()
  })
})

describe('códigos de recuperação', () => {
  it('são dez, de 12 caracteres do alfabeto sem símbolo que se confunde, todos diferentes', () => {
    const codigos = gerarCodigosDeRecuperacao()
    expect(codigos).toHaveLength(10)
    for (const codigo of codigos) expect(codigo).toMatch(new RegExp(`^[${ALFABETO_DO_CODIGO_DE_RECUPERACAO}]{12}$`))
    expect(new Set(codigos).size).toBe(10)
    expect(ALFABETO_DO_CODIGO_DE_RECUPERACAO).not.toMatch(/[01IO]/)
  })

  it('o digitado com minúsculas, espaço e hífen vira o código gerado; fora do alfabeto ou do tamanho, não há código', () => {
    expect(normalizarRecuperacao('abcd-efgh 2345')).toBe('ABCDEFGH2345')
    expect(normalizarRecuperacao('ABCD-EFGH-234')).toBeUndefined()
    expect(normalizarRecuperacao('ABCD-EFGH-2340')).toBeUndefined()
    expect(normalizarRecuperacao('ABCD-EFGH-23456')).toBeUndefined()
  })

  it('o banco guarda o HMAC de 43 caracteres, que muda com a chave e nunca é o código', () => {
    const chave = new TextEncoder().encode('chave_sintetica_da_recuperacao_com_32_caracteres')
    const outraChave = new TextEncoder().encode('outra_chave_sintetica_da_recuperacao_com_32')
    const hmac = hmacDaRecuperacao(chave, 'ABCDEFGH2345')
    expect(hmac).toHaveLength(43)
    expect(hmac).not.toContain('ABCDEFGH2345')
    expect(hmacDaRecuperacao(chave, 'ABCDEFGH2345')).toBe(hmac)
    expect(hmacDaRecuperacao(outraChave, 'ABCDEFGH2345')).not.toBe(hmac)
  })
})
