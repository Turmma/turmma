import type { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'
import { WindowCounter, JANELA_DO_CONTADOR_POR_IP_MS } from './window-counter.js'

/**
 * L8 (A1, tarefa 7.0; `tasks/prd-apresentacao-escola/cenarios.md`): a janela do `WindowCounter` é parâmetro. Os
 * limites da sala contam em 10 min; o login continua com 1 min. Sem Redis: o cliente fora do ar leva a contagem ao
 * seguro em memória, que segue a mesma janela, e o relógio parado a move sem esperar. O caminho do Redis, com o prazo da
 * chave, está em `window-counter.int.test.ts`.
 */

const CHAVE = new TextEncoder().encode('chave-de-teste-do-contador-com-32-bytes')
const DEZ_MINUTOS_MS = 10 * 60_000
/** Um cliente que nunca fica pronto: toda soma e toda leitura vão ao seguro. */
const FORA = { status: 'end' } as unknown as Redis

function relogioParado(inicio = Date.parse('2026-09-21T07:30:00Z')) {
  let agora = inicio
  return { agora: () => new Date(agora), avancar: (ms: number) => (agora += ms) }
}

describe('ContadorEmJanela: a janela por parâmetro (L8)', () => {
  it('com janela de 10 min, a chave vale os 10 min inteiros e o restante do Retry-After acompanha; no 10º minuto ela sai', async () => {
    const relogio = relogioParado()
    const contador = new WindowCounter(FORA, CHAVE, { janelaMs: DEZ_MINUTOS_MS, relogio, avisarSeguro: () => undefined })
    expect(contador.janelaMs).toBe(DEZ_MINUTOS_MS)
    const chave = contador.chaveDe('sala:teste', 'escola')
    for (let soma = 1; soma <= 3; soma++) expect(await contador.somar(chave)).toEqual({ valor: soma, doSeguro: true })
    expect(await contador.restanteMs(chave)).toBe(DEZ_MINUTOS_MS)

    // Passado o minuto do login, a contagem da sala continua.
    relogio.avancar(JANELA_DO_CONTADOR_POR_IP_MS)
    expect(await contador.ler(chave)).toEqual({ valor: 3, doSeguro: true })
    expect(await contador.restanteMs(chave)).toBe(DEZ_MINUTOS_MS - JANELA_DO_CONTADOR_POR_IP_MS)

    relogio.avancar(DEZ_MINUTOS_MS - JANELA_DO_CONTADOR_POR_IP_MS - 1)
    expect(await contador.ler(chave)).toEqual({ valor: 3, doSeguro: true })
    expect(await contador.restanteMs(chave)).toBe(1)
    relogio.avancar(1)
    expect(await contador.ler(chave)).toEqual({ valor: 0, doSeguro: true })
    expect(await contador.restanteMs(chave)).toBe(0)
    // A soma seguinte abre uma janela nova, também de 10 min.
    expect(await contador.somar(chave)).toEqual({ valor: 1, doSeguro: true })
    expect(await contador.restanteMs(chave)).toBe(DEZ_MINUTOS_MS)
  })

  it('sem a opção, a janela é a do login: 1 min', async () => {
    const relogio = relogioParado()
    const contador = new WindowCounter(FORA, CHAVE, { relogio, avisarSeguro: () => undefined })
    expect(contador.janelaMs).toBe(JANELA_DO_CONTADOR_POR_IP_MS)
    expect(JANELA_DO_CONTADOR_POR_IP_MS).toBe(60_000)
    const chave = contador.chaveDe('login:teste', 'ip')
    await contador.somar(chave)
    relogio.avancar(JANELA_DO_CONTADOR_POR_IP_MS - 1)
    expect(await contador.ler(chave)).toEqual({ valor: 1, doSeguro: true })
    relogio.avancar(1)
    expect(await contador.ler(chave)).toEqual({ valor: 0, doSeguro: true })
  })

  it('o aviso do seguro é o que a instância recebeu: a da sala avisa como sala, e o aviso sai espaçado', async () => {
    const avisos: string[] = []
    const contador = new WindowCounter(FORA, CHAVE, { janelaMs: DEZ_MINUTOS_MS, avisarSeguro: () => avisos.push('sala.limite_no_seguro') })
    await contador.somar(contador.chaveDe('sala:teste', 'a'))
    await contador.somar(contador.chaveDe('sala:teste', 'b'))
    expect(avisos).toEqual(['sala.limite_no_seguro'])
  })

  it('janela que não é inteiro positivo não monta', () => {
    for (const janelaMs of [0, -1, 1.5]) expect(() => new WindowCounter(FORA, CHAVE, { janelaMs })).toThrow(RangeError)
  })
})
