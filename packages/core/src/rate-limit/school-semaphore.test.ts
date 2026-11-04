import { describe, expect, it } from 'vitest'
import { SchoolSemaphore } from './school-semaphore.js'

/**
 * As vagas de planilha por escola, no caminho em que o Redis não responde (F2, tarefa 5.0; regra 80, itens 3 e 5): o seguro em
 * memória conta sozinho, com máximo ÷ instâncias, e nunca libera sem limite nem devolve erro. O caminho do Redis, com o `TIME`
 * dele, está em `apps/api/test/importacao.int.test.ts`.
 */

interface ClienteFalso {
  status: string
  eval: () => Promise<unknown>
  zrem: () => Promise<number>
}

const foraDoAr = (): ClienteFalso => ({ status: 'reconnecting', eval: () => Promise.reject(new Error('Redis fora')), zrem: () => Promise.reject(new Error('Redis fora')) })

function vagas(opcoes: { maximo: number; instancias: number }, cliente: ClienteFalso, relogio: { agora: number }): SchoolSemaphore {
  return new SchoolSemaphore(cliente as never, { prefixo: 'sem:teste', validadeMs: 30_000, ...opcoes }, () => relogio.agora)
}

describe('SchoolSemaphore com o Redis fora (F2, tarefa 5.0)', () => {
  it('conta sozinha com máximo ÷ instâncias: com 2 vagas e 2 instâncias, cada uma dá 1 e recusa a segunda', async () => {
    const semaforo = vagas({ maximo: 2, instancias: 2 }, foraDoAr(), { agora: 0 })
    expect(await semaforo.ocupar('escola-a')).toBeDefined()
    expect(await semaforo.ocupar('escola-a')).toBeUndefined()
  })

  it('uma escola cheia não recusa a outra', async () => {
    const semaforo = vagas({ maximo: 2, instancias: 2 }, foraDoAr(), { agora: 0 })
    await semaforo.ocupar('escola-a')
    expect(await semaforo.ocupar('escola-a')).toBeUndefined()
    expect(await semaforo.ocupar('escola-b')).toBeDefined()
  })

  it('devolver a vaga a libera; devolver duas vezes não libera a do vizinho', async () => {
    const semaforo = vagas({ maximo: 2, instancias: 1 }, foraDoAr(), { agora: 0 })
    const primeira = await semaforo.ocupar('escola-a')
    await semaforo.ocupar('escola-a')
    expect(await semaforo.ocupar('escola-a')).toBeUndefined()

    await primeira?.liberar()
    await primeira?.liberar()

    expect(await semaforo.ocupar('escola-a')).toBeDefined()
    expect(await semaforo.ocupar('escola-a')).toBeUndefined()
  })

  it('a vaga que ninguém devolve vence pelo prazo de validade: aos 29 s ainda está ocupada, aos 30 s volta', async () => {
    const relogio = { agora: 1_000 }
    const semaforo = vagas({ maximo: 1, instancias: 1 }, foraDoAr(), relogio)
    await semaforo.ocupar('escola-a')

    relogio.agora = 1_000 + 29_999
    expect(await semaforo.ocupar('escola-a')).toBeUndefined()
    relogio.agora = 1_000 + 30_000
    expect(await semaforo.ocupar('escola-a')).toBeDefined()
  })

  it('o cliente que não está pronto nem é consultado: quem conta é o seguro, mesmo que o comando respondesse que há vaga', async () => {
    const chamadas: unknown[] = []
    const cliente: ClienteFalso = {
      status: 'reconnecting',
      eval: () => {
        chamadas.push('eval')
        return Promise.resolve(1)
      },
      zrem: () => Promise.resolve(1),
    }
    const semaforo = vagas({ maximo: 1, instancias: 1 }, cliente, { agora: 0 })
    expect(await semaforo.ocupar('escola-a')).toBeDefined()
    expect(await semaforo.ocupar('escola-a')).toBeUndefined()
    expect(chamadas).toEqual([])
  })

  it('o cliente "pronto" cujo comando falha cai no seguro, sem lançar erro', async () => {
    const cliente: ClienteFalso = { ...foraDoAr(), status: 'ready' }
    const semaforo = vagas({ maximo: 2, instancias: 1 }, cliente, { agora: 0 })
    await expect(semaforo.ocupar('escola-a')).resolves.toBeDefined()
  })

  it('o Redis que responde 0 recusa, sem cair no seguro; responder 1 dá a vaga, e devolvê-la tira o membro do conjunto', async () => {
    const respostas = [1, 0]
    const removidos: unknown[][] = []
    const cliente = {
      status: 'ready',
      eval: () => Promise.resolve(respostas.shift()),
      zrem: (...args: unknown[]) => {
        removidos.push(args)
        return Promise.resolve(1)
      },
    }
    const semaforo = new SchoolSemaphore(cliente as never, { prefixo: 'sem:teste', maximo: 1, validadeMs: 30_000, instancias: 1 })

    const vaga = await semaforo.ocupar('escola-a')
    expect(vaga).toBeDefined()
    expect(await semaforo.ocupar('escola-a')).toBeUndefined()
    await vaga?.liberar()

    expect(removidos).toHaveLength(1)
    expect(removidos[0]?.[0]).toBe('sem:teste:escola-a')
  })
})
