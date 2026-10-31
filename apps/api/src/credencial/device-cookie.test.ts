import { describe, expect, it } from 'vitest'
import { CookieDeDispositivo, MAXIMO_DE_ENTRADAS_DO_DISPOSITIVO, VALIDADE_DA_ENTRADA_DO_DISPOSITIVO_MS } from './device-cookie.js'

const CHAVE_V1 = new TextEncoder().encode('chave-de-teste-do-dispositivo-v1-32b')
const CHAVE_V2 = new TextEncoder().encode('chave-de-teste-do-dispositivo-v2-32b')

function relogioParado(inicio = Date.parse('2026-09-21T07:30:00Z')) {
  let agora = inicio
  return { agora: () => new Date(agora), avancar: (ms: number) => (agora += ms) }
}

describe('cookie educa_dispositivo', () => {
  it('depois do login, o navegador passa a ser conhecido daquela conta e de nenhuma outra', () => {
    const cookie = new CookieDeDispositivo(1, CHAVE_V1)
    const valor = cookie.comEntrada(undefined, 'camila@escola.invalid')
    expect(cookie.conhece(valor, 'camila@escola.invalid')).toBe(true)
    expect(cookie.conhece(valor, 'renata@escola.invalid')).toBe(false)
    expect(cookie.conhece(undefined, 'camila@escola.invalid')).toBe(false)
  })

  it('privacidade: o valor leva a versão e HMACs com data, e nunca o e-mail', () => {
    const cookie = new CookieDeDispositivo(1, CHAVE_V1)
    const valor = cookie.comEntrada(undefined, 'camila@escola.invalid')
    expect(valor).toMatch(/^1\.[\w-]{22}:[0-9a-z]+$/)
    expect(valor).not.toContain('camila')
  })

  it('borda: cookie com chave antiga (outra versão) é ignorado, e o login seguinte o troca por um só com a versão nova', () => {
    const antigo = new CookieDeDispositivo(1, CHAVE_V1).comEntrada(undefined, 'camila@escola.invalid')
    const novo = new CookieDeDispositivo(2, CHAVE_V2)
    expect(novo.conhece(antigo, 'camila@escola.invalid')).toBe(false)
    const regravado = novo.comEntrada(antigo, 'renata@escola.invalid')
    expect(regravado.startsWith('2.')).toBe(true)
    expect(regravado.split('.')).toHaveLength(2)
  })

  it('segurança: sem a chave, ninguém fabrica a entrada de uma conta; com a mesma versão e outra chave, não conhece', () => {
    const verdadeiro = new CookieDeDispositivo(1, CHAVE_V1)
    const forjado = new CookieDeDispositivo(1, CHAVE_V2).comEntrada(undefined, 'camila@escola.invalid')
    expect(verdadeiro.conhece(forjado, 'camila@escola.invalid')).toBe(false)
    expect(verdadeiro.conhece('1.AAAAAAAAAAAAAAAAAAAAAA:zzzzzz', 'camila@escola.invalid')).toBe(false)
    expect(verdadeiro.conhece('lixo;"quebrado', 'camila@escola.invalid')).toBe(false)
  })

  it('borda: a entrada vence 30 dias depois do último login da conta naquele navegador', () => {
    const relogio = relogioParado()
    const cookie = new CookieDeDispositivo(1, CHAVE_V1, relogio)
    const valor = cookie.comEntrada(undefined, 'camila@escola.invalid')
    relogio.avancar(VALIDADE_DA_ENTRADA_DO_DISPOSITIVO_MS - 1_000)
    expect(cookie.conhece(valor, 'camila@escola.invalid')).toBe(true)
    relogio.avancar(1_000)
    expect(cookie.conhece(valor, 'camila@escola.invalid')).toBe(false)
  })

  it('borda (Chromebook do carrinho): com 50 contas, a 51ª tira a mais antiga, e o login de novo põe a conta no topo', () => {
    const relogio = relogioParado()
    const cookie = new CookieDeDispositivo(1, CHAVE_V1, relogio)
    let valor: string | undefined
    for (let indice = 0; indice < MAXIMO_DE_ENTRADAS_DO_DISPOSITIVO; indice++) {
      valor = cookie.comEntrada(valor, `professor-${String(indice)}@escola.invalid`)
      relogio.avancar(1_000)
    }
    // A primeira volta a entrar: vai para o topo, e a mais antiga passa a ser a segunda.
    valor = cookie.comEntrada(valor, 'professor-0@escola.invalid')
    relogio.avancar(1_000)
    valor = cookie.comEntrada(valor, 'nova@escola.invalid')
    expect(valor.split('.')).toHaveLength(MAXIMO_DE_ENTRADAS_DO_DISPOSITIVO + 1)
    expect(cookie.conhece(valor, 'nova@escola.invalid')).toBe(true)
    expect(cookie.conhece(valor, 'professor-0@escola.invalid')).toBe(true)
    expect(cookie.conhece(valor, 'professor-1@escola.invalid')).toBe(false)
    expect(cookie.conhece(valor, 'professor-2@escola.invalid')).toBe(true)
    // Cabe no limite de 4 kB de um cookie, com nome e atributos.
    expect(valor.length).toBeLessThan(3_500)
  })
})
