import { randomUUID } from 'node:crypto'
import type { Redis } from 'ioredis'
import { insuranceLimit } from './keys.js'

/** Uma vaga ocupada. Quem a tem a devolve no `finally`; se o processo morre antes, o prazo de validade a devolve. */
export interface Vaga {
  liberar(): Promise<void>
}

/**
 * Por quanto tempo a vaga da planilha vale se o processo morrer antes de devolvê-la: bem acima do p95 de 2 s da prévia e do gravar
 * de 3.000 linhas, e curto o bastante para a escola não ficar presa (F2, 5.0; Tech Spec, seção 7c).
 */
export const VALIDADE_DA_VAGA_DA_PLANILHA_MS = 30_000

export interface SchoolSemaphoreOptions {
  /** O prefixo da chave no Redis: `{prefixo}:{escolaId}`. */
  readonly prefixo: string
  /** Quantas vagas cada escola tem ao mesmo tempo. */
  readonly maximo: number
  /** Por quanto tempo uma vaga vale se ninguém a devolver: o processo que morre no meio não prende a escola. */
  readonly validadeMs: number
  /** Quantas instâncias da API dividem o limite. O seguro em memória de cada uma usa máximo ÷ instâncias. */
  readonly instancias: number
}

/**
 * Confere e ocupa numa só ida ao Redis (nada de "verifica e depois grava": regra 80, item 7). A hora é a do Redis (`TIME`), e
 * não a da API: duas instâncias com relógios diferentes não estendem nem encurtam a vaga uma da outra. O conjunto é por
 * escola, e cada vaga é um membro com a própria validade como pontuação; a vaga vencida sai antes da conta.
 */
const OCUPAR = `
local agora = redis.call('TIME')
local ms = tonumber(agora[1]) * 1000 + math.floor(tonumber(agora[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ms)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then return 0 end
redis.call('ZADD', KEYS[1], ms + tonumber(ARGV[2]), ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
`

/**
 * Um semáforo por escola no Redis de cache (F2, 5.0; Tech Spec, seção 4 e `cenarios.md`, "Limites"): a escola que enche as vagas
 * é recusada, e a outra segue (regra 80, item 3). Serve ao trabalho que não pode correr em paralelo dentro da mesma escola sem
 * custar a manhã de segunda: a classificação de uma planilha de 3.000 linhas.
 *
 * Com o Redis fora, cada instância conta sozinha em memória com máximo ÷ instâncias, no mesmo prazo de validade: nunca libera
 * sem limite e nunca devolve erro por causa do Redis (a mesma regra do `RateLimiter`).
 */
export class SchoolSemaphore {
  readonly #seguro = new Map<string, Map<string, number>>()
  readonly #maximoDoSeguro: number

  constructor(
    private readonly cliente: Pick<Redis, 'eval' | 'zrem' | 'status'>,
    private readonly opcoes: SchoolSemaphoreOptions,
    private readonly relogioMs: () => number = Date.now,
  ) {
    this.#maximoDoSeguro = insuranceLimit(opcoes.maximo, opcoes.instancias)
  }

  /** Ocupa uma vaga da escola, ou devolve `undefined` se as vagas dela estão cheias. */
  async ocupar(escolaId: string): Promise<Vaga | undefined> {
    const chave = `${this.opcoes.prefixo}:${escolaId}`
    const token = randomUUID()
    try {
      if (this.cliente.status !== 'ready') return this.#ocuparNoSeguro(escolaId, token)
      const ocupou = await this.cliente.eval(OCUPAR, 1, chave, this.opcoes.maximo, this.opcoes.validadeMs, token)
      return ocupou === 1 ? { liberar: () => this.#liberarNoRedis(chave, token) } : undefined
    } catch {
      return this.#ocuparNoSeguro(escolaId, token)
    }
  }

  async #liberarNoRedis(chave: string, token: string): Promise<void> {
    try {
      await this.cliente.zrem(chave, token)
    } catch {
      // A vaga que não pôde ser devolvida vence pela validade; o pedido já terminou e não falha por isso.
    }
  }

  #ocuparNoSeguro(escolaId: string, token: string): Vaga | undefined {
    const agora = this.relogioMs()
    const vagas = this.#seguro.get(escolaId) ?? new Map<string, number>()
    for (const [outra, venceEm] of vagas) {
      if (venceEm <= agora) vagas.delete(outra)
    }
    if (vagas.size >= this.#maximoDoSeguro) return undefined
    vagas.set(token, agora + this.opcoes.validadeMs)
    this.#seguro.set(escolaId, vagas)
    return {
      liberar: () => {
        vagas.delete(token)
        if (vagas.size === 0) this.#seguro.delete(escolaId)
        return Promise.resolve()
      },
    }
  }
}
