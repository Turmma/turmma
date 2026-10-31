import { afterEach, describe, expect, it, vi } from 'vitest'
import { codigoDoAutenticador, codigoDoPassoAnterior, esperaPelaViradaDoPasso } from '../../e2e/support/seed.ts'
import { gerarSegredo, passoDoCodigo, PERIODO_TOTP_SEGUNDOS } from '../../apps/api/src/credencial/totp.ts'

/**
 * O código que o e2e digita no lugar do aplicativo autenticador (`e2e/support/seed.ts`). O caso que ativa o segundo
 * fator com o código do passo anterior caiu na esteira (run 39062201162) porque a virada do passo de 30 s veio entre a geração
 * do código e a conferência da API, que aceita só um passo para cada lado. Aqui o relógio é falso: a virada cai onde o teste
 * a põe, e a conferência é a `passoDoCodigo` da própria API.
 */

const PASSO_MS = PERIODO_TOTP_SEGUNDOS * 1_000
/** Uma virada de passo qualquer, longe de 1970 e de hoje. */
const VIRADA = 1_800_000_000_000 - (1_800_000_000_000 % PASSO_MS)

afterEach(() => {
  vi.useRealTimers()
})

describe('o código do autenticador no e2e (e2e/__fixtures__/sessao.ts)', () => {
  it('o código do passo anterior, gerado a 100 ms da virada, ainda vale quando a API o confere 1 s depois', async () => {
    const segredo = gerarSegredo()
    vi.useFakeTimers({ now: VIRADA - 100 })

    const pendente = codigoDoPassoAnterior(segredo.base32)
    // O relógio falso anda só o que a fixture esperar (o único temporizador pendente): a conferência acontece 1 s depois de o
    // código sair da mão do teste, e não 1 s depois de um avanço maior.
    await vi.runAllTimersAsync()
    const codigo = await pendente
    vi.setSystemTime(Date.now() + 1_000)

    expect(passoDoCodigo(segredo.bytes, codigo, new Date())).toBeDefined()
  })

  it('o código do passo anterior é o do passo anterior ao da hora em que a conferência acontece, e anda para trás só um passo', async () => {
    const segredo = gerarSegredo()
    vi.useFakeTimers({ now: VIRADA + 10_000 })

    const codigo = await codigoDoPassoAnterior(segredo.base32)

    // Sem espera, no meio do passo: o passo da conferência menos um, e o `0` que vem depois é um passo maior.
    expect(passoDoCodigo(segredo.bytes, codigo, new Date())).toBe(VIRADA / PASSO_MS - 1)
    expect(passoDoCodigo(segredo.bytes, codigoDoAutenticador(segredo.base32), new Date())).toBe(VIRADA / PASSO_MS)
    expect(passoDoCodigo(segredo.bytes, codigoDoAutenticador(segredo.base32, 30), new Date())).toBe(VIRADA / PASSO_MS + 1)
  })

  it('só espera quando a virada está a 5 s ou menos: no começo e no meio do passo a espera é zero', () => {
    expect(esperaPelaViradaDoPasso(VIRADA)).toBe(0)
    expect(esperaPelaViradaDoPasso(VIRADA + 1_000)).toBe(0)
    expect(esperaPelaViradaDoPasso(VIRADA + 24_999)).toBe(0)
    // O limite exato: faltando 5 000 ms, espera (a comparação é `<=`).
    expect(esperaPelaViradaDoPasso(VIRADA + 25_000)).toBeGreaterThanOrEqual(5_000)
    expect(esperaPelaViradaDoPasso(VIRADA + 25_001)).toBeGreaterThanOrEqual(4_999)
    expect(esperaPelaViradaDoPasso(VIRADA + PASSO_MS - 100)).toBeGreaterThanOrEqual(100)
  })

  it('a espera passa da virada, e não para antes dela: a hora de depois da espera já é do passo seguinte', () => {
    for (const antes of [25_001, 27_000, 29_000, 29_900, 29_999]) {
      const agora = VIRADA + antes
      expect(esperaPelaViradaDoPasso(agora) + agora, `a ${String(antes)} ms do passo`).toBeGreaterThan(VIRADA + PASSO_MS)
    }
  })
})
