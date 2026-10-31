import { ALFABETO_DO_CODIGO_DA_TURMA, codigoDaTurmaValido } from '@educa/shared'
import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { lerAmbienteExemplo } from '../../../../tools/ci/compose.ts'
import { hashDoToken, lerConfiguracaoLogin } from '../credencial/index.js'
import { hmacDoCodigoDaTurma, sortearCodigoDaTurma, sortearTokenDaSala } from './codigo-da-sala.js'
import { lerConfiguracaoSala } from './sala-config.js'

describe('código da turma e token do link (A1, 4.0, E15)', () => {
  it('o sorteio dá 8 caracteres do alfabeto de 31, e em mil sorteios aparecem todos os 31 e nenhum repete', () => {
    const sorteados = Array.from({ length: 1_000 }, () => sortearCodigoDaTurma())
    for (const codigo of sorteados) expect(codigoDaTurmaValido(codigo), codigo).toBe(true)
    expect(new Set(sorteados.join(''))).toEqual(new Set(ALFABETO_DO_CODIGO_DA_TURMA))
    expect(new Set(sorteados).size).toBe(sorteados.length)
  })

  it('o HMAC é o HMAC-SHA256 da chave da sala sobre o código normalizado: espaço, hífen e minúscula dão o mesmo', () => {
    const chave = new TextEncoder().encode('chave_sintetica_do_codigo_da_turma_com_32_caracteres')
    const esperado = createHmac('sha256', chave).update('ABCD2345').digest('base64url')
    for (const digitado of ['ABCD2345', 'ABCD 2345', 'abcd-2345']) expect(hmacDoCodigoDaTurma(chave, digitado), digitado).toBe(esperado)
    expect(hmacDoCodigoDaTurma(chave, 'ABCD2346')).not.toBe(esperado)
  })

  it('com as chaves do .env.example, o HMAC do código difere do HMAC da mesma entrada com a chave dos contadores', () => {
    const ambiente = lerAmbienteExemplo()
    const sala = lerConfiguracaoSala(ambiente)
    const { chaveContador } = lerConfiguracaoLogin(ambiente)
    expect(sala.chaveCodigo).not.toEqual(chaveContador)
    const comAChaveDosContadores = createHmac('sha256', chaveContador).update('ABCD2345').digest('base64url')
    expect(hmacDoCodigoDaTurma(sala.chaveCodigo, 'ABCD2345')).not.toBe(comAChaveDosContadores)
  })

  it('o token do link tem 256 bits em base64url, e o hash é o SHA-256 em hex, como o do convite', () => {
    const token = sortearTokenDaSala()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(sortearTokenDaSala()).not.toBe(token)
    expect(hashDoToken(token)).toBe(createHash('sha256').update(token).digest('hex'))
  })
})
