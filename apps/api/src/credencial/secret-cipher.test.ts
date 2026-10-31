import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CifraDoSegredo, SegredoNaoDecifra } from './secret-cipher.js'

const CONTA_A = '0190f5a0-0000-7000-8000-0000000000a1'
const CONTA_B = '0190f5a0-0000-7000-8000-0000000000b1'
const CHAVE_V1 = new Uint8Array(randomBytes(32))
const CHAVE_V2 = new Uint8Array(randomBytes(32))

describe('CifraDoSegredo: AES-256-GCM com o conta_id como AAD e a versão da chave ao lado', () => {
  it('o segredo volta igual para a conta dele, e o gravado não contém o segredo em claro', () => {
    const cifra = new CifraDoSegredo(1, new Map([[1, CHAVE_V1]]))
    const segredo = new Uint8Array(randomBytes(20))
    const gravado = cifra.cifrar(segredo, CONTA_A)
    expect(gravado.versao).toBe(1)
    expect(gravado.cifrado.includes(Buffer.from(segredo))).toBe(false)
    expect(cifra.decifrar(gravado, CONTA_A)).toEqual(segredo)
    // O mesmo UUID em maiúsculas é a mesma conta.
    expect(cifra.decifrar(gravado, CONTA_A.toUpperCase())).toEqual(segredo)
  })

  it('borda: o segredo cifrado copiado de uma conta para outra não decifra', () => {
    const cifra = new CifraDoSegredo(1, new Map([[1, CHAVE_V1]]))
    const gravadoDeA = cifra.cifrar(new Uint8Array(randomBytes(20)), CONTA_A)
    expect(() => cifra.decifrar(gravadoDeA, CONTA_B)).toThrow(SegredoNaoDecifra)
  })

  it('borda: um byte alterado, a versão trocada ou a chave de outra versão não decifram', () => {
    const cifra = new CifraDoSegredo(1, new Map([[1, CHAVE_V1]]))
    const gravado = cifra.cifrar(new Uint8Array(randomBytes(20)), CONTA_A)
    const alterado = Buffer.from(gravado.cifrado)
    alterado[alterado.length - 1] = (alterado[alterado.length - 1] ?? 0) ^ 1
    expect(() => cifra.decifrar({ ...gravado, cifrado: alterado }, CONTA_A)).toThrow(SegredoNaoDecifra)
    expect(() => cifra.decifrar({ ...gravado, versao: 2 }, CONTA_A)).toThrow(SegredoNaoDecifra)
    expect(() => new CifraDoSegredo(1, new Map([[1, CHAVE_V2]])).decifrar(gravado, CONTA_A)).toThrow(SegredoNaoDecifra)
    expect(() => cifra.decifrar({ cifrado: Buffer.alloc(28), versao: 1 }, CONTA_A)).toThrow(SegredoNaoDecifra)
  })

  it('troca de chave: o segredo novo sai com a versão atual, e o antigo decifra com a chave da versão dele', () => {
    const segredo = new Uint8Array(randomBytes(20))
    const antigo = new CifraDoSegredo(1, new Map([[1, CHAVE_V1]])).cifrar(segredo, CONTA_A)
    const depoisDaTroca = new CifraDoSegredo(
      2,
      new Map([
        [1, CHAVE_V1],
        [2, CHAVE_V2],
      ]),
    )
    expect(depoisDaTroca.cifrar(segredo, CONTA_A).versao).toBe(2)
    expect(depoisDaTroca.decifrar(antigo, CONTA_A)).toEqual(segredo)
  })

  it('não nasce sem a chave da versão atual', () => {
    expect(() => new CifraDoSegredo(2, new Map([[1, CHAVE_V1]]))).toThrow('chave de cifra da versão atual ausente')
  })

  it('cada cifra sorteia o próprio IV: o mesmo segredo não gera o mesmo gravado', () => {
    const cifra = new CifraDoSegredo(1, new Map([[1, CHAVE_V1]]))
    const segredo = new Uint8Array(randomBytes(20))
    expect(cifra.cifrar(segredo, CONTA_A).cifrado.equals(cifra.cifrar(segredo, CONTA_A).cifrado)).toBe(false)
  })
})
