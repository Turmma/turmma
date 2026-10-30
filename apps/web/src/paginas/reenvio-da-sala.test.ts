import { ErrorCode } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ErroDaApi } from '../api/cliente'
import { enviarComReenvio, ESPERA_SEM_RETRY_AFTER_SEGUNDOS, esperaDoReenvio, MAXIMO_DE_REENVIOS, VARIACAO_MAXIMA_MS, type OpcoesDoReenvio } from './reenvio-da-sala'

/**
 * O reenvio da reivindicação no 503 (A1, 17.0; W8): a mesma chave, até três vezes, cada uma depois do `Retry-After` com a
 * variação aleatória, e depois "Tentar de novo". A parte do navegador (o relógio falso, a tela) está em
 * `e2e/turma-publica.spec.ts`.
 */

const cheio = (segundos?: number) => new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, segundos)

/** As opções com um relógio de mentira: guarda cada espera pedida, e quantas vezes a tela foi avisada. */
function relogio(aleatorios: readonly number[] = [0.5]) {
  const esperas: number[] = []
  let avisos = 0
  let sorteio = 0
  let valendo = true
  const opcoes: OpcoesDoReenvio = {
    esperar: (ms) => {
      esperas.push(ms)
      return Promise.resolve()
    },
    aleatorio: () => aleatorios[sorteio++ % aleatorios.length] ?? 0,
    aoEsperar: () => {
      avisos++
    },
    valendo: () => valendo,
  }
  return {
    opcoes,
    esperas,
    avisos: () => avisos,
    largar: () => {
      valendo = false
    },
  }
}

/** Um envio de mentira que responde, na ordem, o que estiver na fila, e guarda o pedido de cada chamada. */
function servidor(respostas: ReadonlyArray<'ok' | ErroDaApi>, pedido: { readonly chaveEnvio: string }) {
  const pedidos: string[] = []
  let vez = 0
  const enviar = () => {
    pedidos.push(pedido.chaveEnvio)
    const resposta = respostas[vez++] ?? 'ok'
    return resposta === 'ok' ? Promise.resolve({ resultado: 'enviado' }) : Promise.reject(resposta)
  }
  return { enviar, pedidos }
}

describe('esperaDoReenvio', () => {
  it('nunca sai antes do Retry-After: a variação só soma', () => {
    expect(esperaDoReenvio(5, 0)).toBe(5000)
    expect(esperaDoReenvio(5, 0.999)).toBeGreaterThanOrEqual(5000)
    expect(esperaDoReenvio(5, 0.999)).toBeLessThan(5000 + VARIACAO_MAXIMA_MS)
  })

  it('dois computadores com sorteios diferentes não voltam no mesmo instante', () => {
    expect(esperaDoReenvio(3, 0.1)).toBe(3100)
    expect(esperaDoReenvio(3, 0.9)).toBe(3900)
  })

  it('sem Retry-After, ou com um valor que não é número, espera o padrão, e não zero', () => {
    expect(esperaDoReenvio(undefined, 0)).toBe(ESPERA_SEM_RETRY_AFTER_SEGUNDOS * 1000)
    expect(esperaDoReenvio(Number.NaN, 0)).toBe(ESPERA_SEM_RETRY_AFTER_SEGUNDOS * 1000)
    expect(esperaDoReenvio(-1, 0)).toBe(ESPERA_SEM_RETRY_AFTER_SEGUNDOS * 1000)
  })
})

describe('enviarComReenvio', () => {
  it('repete o 503 com a mesma chave até três vezes, pelo Retry-After de cada resposta, e entra no quarto envio', async () => {
    const { opcoes, esperas, avisos } = relogio([0.25])
    const { enviar, pedidos } = servidor([cheio(5), cheio(7), cheio(2), 'ok'], { chaveEnvio: 'chave-1' })
    expect(await enviarComReenvio(enviar, opcoes)).toEqual({ tipo: 'enviado' })
    expect(pedidos).toEqual(['chave-1', 'chave-1', 'chave-1', 'chave-1'])
    expect(esperas).toEqual([5250, 7250, 2250])
    expect(avisos()).toBe(3)
  })

  it('o quarto 503 para: nenhum reenvio sozinho depois do terceiro', async () => {
    const { opcoes, esperas } = relogio()
    const { enviar, pedidos } = servidor([cheio(1), cheio(1), cheio(1), cheio(1), 'ok'], { chaveEnvio: 'chave-1' })
    expect(await enviarComReenvio(enviar, opcoes)).toEqual({ tipo: 'cheio' })
    expect(pedidos).toHaveLength(MAXIMO_DE_REENVIOS + 1)
    expect(esperas).toHaveLength(MAXIMO_DE_REENVIOS)
  })

  it('a recusa e o limite não se repetem: voltam na hora, com o erro', async () => {
    for (const erro of [new ErroDaApi(ErrorCode.REIVINDICACAO_RECUSADA), new ErroDaApi(ErrorCode.LIMITE_EXCEDIDO, 600), new ErroDaApi(ErrorCode.NAO_ENCONTRADO)]) {
      const { opcoes, esperas } = relogio()
      const { enviar, pedidos } = servidor([erro], { chaveEnvio: 'chave-1' })
      expect(await enviarComReenvio(enviar, opcoes)).toEqual({ tipo: 'falhou', erro })
      expect(pedidos).toHaveLength(1)
      expect(esperas).toEqual([])
    }
  })

  it('o 503 depois de um reenvio que achou a recusa para na recusa', async () => {
    const recusa = new ErroDaApi(ErrorCode.REIVINDICACAO_RECUSADA)
    const { opcoes } = relogio()
    const { enviar, pedidos } = servidor([cheio(1), recusa], { chaveEnvio: 'chave-1' })
    expect(await enviarComReenvio(enviar, opcoes)).toEqual({ tipo: 'falhou', erro: recusa })
    expect(pedidos).toHaveLength(2)
  })

  it('a tela que mudou durante a espera não reenvia, e a que mudou com o envio no ar descarta a resposta', async () => {
    const durante = relogio()
    const esperarELargar = durante.opcoes.esperar
    const opcoes: OpcoesDoReenvio = {
      ...durante.opcoes,
      esperar: async (ms) => {
        await esperarELargar(ms)
        durante.largar()
      },
    }
    const primeiro = servidor([cheio(1), 'ok'], { chaveEnvio: 'chave-1' })
    expect(await enviarComReenvio(primeiro.enviar, opcoes)).toEqual({ tipo: 'descartado' })
    expect(primeiro.pedidos).toHaveLength(1)

    for (const resposta of ['ok', cheio(1), new ErroDaApi(ErrorCode.REIVINDICACAO_RECUSADA)] as const) {
      const noAr = relogio()
      noAr.largar()
      const segundo = servidor([resposta], { chaveEnvio: 'chave-2' })
      expect(await enviarComReenvio(segundo.enviar, noAr.opcoes)).toEqual({ tipo: 'descartado' })
      expect(noAr.esperas).toEqual([])
    }
  })
})
