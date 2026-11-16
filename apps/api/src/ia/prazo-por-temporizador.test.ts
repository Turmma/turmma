import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prazoPorTemporizador } from './prazo-por-temporizador.js'

// O temporizador é o que aplica o prazo único de cada perfil em produção (reengenharia-continuacao, 5.0); os testes de integração trocam a fábrica.
describe('o prazo por temporizador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('o sinal não está abortado um milissegundo antes do prazo, e está abortado nele', () => {
    const prazo = prazoPorTemporizador(60_000)
    vi.advanceTimersByTime(59_999)
    expect(prazo.sinal.aborted).toBe(false)
    vi.advanceTimersByTime(1)
    expect(prazo.sinal.aborted).toBe(true)
  })

  it('o prazo de 140 s do perfil padrão não aborta aos 60 s', () => {
    const prazo = prazoPorTemporizador(140_000)
    vi.advanceTimersByTime(60_000)
    expect(prazo.sinal.aborted).toBe(false)
    vi.advanceTimersByTime(80_000)
    expect(prazo.sinal.aborted).toBe(true)
  })

  it('depois do `cancelar`, o sinal não aborta mais, e não fica temporizador pendente', () => {
    const prazo = prazoPorTemporizador(60_000)
    prazo.cancelar()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(120_000)
    expect(prazo.sinal.aborted).toBe(false)
  })

  it('o temporizador não segura o processo aberto, por causa do `unref`', () => {
    prazoPorTemporizador(60_000)
    // Com os timers falsos, o `unref` do temporizador falso é o que o código chamou: o temporizador pendente é um só e já vem desreferenciado.
    expect(vi.getTimerCount()).toBe(1)
    const espiado = vi.spyOn(globalThis, 'setTimeout')
    prazoPorTemporizador(1_000)
    const devolvido = espiado.mock.results[0]?.value as { hasRef?: () => boolean } | undefined
    expect(devolvido?.hasRef?.()).toBe(false)
    espiado.mockRestore()
  })
})
