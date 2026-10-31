import { throttledWarn, SlidingWindowRatio, systemClock, type Clock } from '@educa/core'
import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { createHmac } from 'node:crypto'
import { InvariantException } from '@educa/shared'

/** A janela dos contadores por IP do login: "por minuto" (Tech Spec da identidade, seção 5, "Baldes do semáforo"). */
export const JANELA_DO_CONTADOR_POR_IP_MS = 60_000
const loggerDoLogin = new Logger('login')

/** O aviso de contagem no seguro em memória dos contadores por IP do login. */
const avisarSeguroDoLogin = () => loggerDoLogin.warn('login.limite_por_ip_no_seguro')

/** O que muda de uma instância do contador para outra: a janela e o aviso do seguro (A1, tarefa 7.0). */
export interface WindowCounterOptions {
  /** Quanto cada chave vive desde a primeira soma: 1 min no login (o padrão), 10 min nos limites da sala. */
  readonly janelaMs?: number
  /** O aviso de contagem no seguro, um evento fixo, que o contador espaça; o padrão é o do login. */
  readonly avisarSeguro?: () => void
  /** Só o teste troca, para mover a janela sem esperar. */
  readonly relogio?: Clock
  /** Só o teste troca, para mover a janela da proporção sem esperar 30 s. */
  readonly proporcaoDoSeguro?: SlidingWindowRatio
}

/** O que o contador diz: o valor na janela e se quem contou foi o seguro em memória (o limite é dividido pelas instâncias). */
export interface WindowCount {
  readonly valor: number
  readonly doSeguro: boolean
}

/**
 * Soma um na janela, numa operação só: a primeira soma da janela dá o prazo à chave, e as seguintes não o empurram.
 * Duas instâncias somando ao mesmo tempo nunca leem o mesmo número (regra 80, item 7).
 */
const SCRIPT_SOMAR = `
local valor = redis.call('INCR', KEYS[1])
if valor == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return valor
`

interface InMemoryWindowEntry {
  valor: number
  venceEm: number
}

/**
 * Contadores numa janela fixa, no Redis de fila, que não expulsa chave. Duas instâncias usam isto:
 *
 * - **Os contadores por IP do login** (tarefa 15.0): as falhas de um IP numa escola (matrícula) e as tentativas de um IP
 *   na rota de e-mail, cada um numa janela de 1 min. Nenhuma chave é o IP: é o HMAC dele (e da escola), com a chave do
 *   contador de tentativas, e vive só a janela (regra 20; `docs/lgpd.md`, "Contador de tentativas de login").
 * - **Os limites da sala** (A1, tarefa 7.0; `apps/api/src/sala/sala-rate-limits.ts`): código errado por escola, matrícula
 *   errada por nome e hash sem pedido por turma, numa janela de 10 min, com a mesma chave de HMAC
 *   (`docs/lgpd.md`, "Contadores da sala").
 *
 * **Redis fora ou travado** (Tech Spec, seção 5, "Redis de fila fora"): cada instância conta em memória, com a mesma
 * janela, e diz que a contagem é do seguro, para quem compara dividir o limite pelas instâncias (`insuranceLimit`). A
 * proporção do seguro alimenta `limite.seguro_ativo`. Nunca responde "zero" por não saber: conta sempre, em algum lugar.
 */
export class WindowCounter {
  readonly #seguro = new Map<string, InMemoryWindowEntry>()
  readonly #proporcaoDoSeguro: SlidingWindowRatio
  readonly #avisarSeguro: () => void
  readonly #relogio: Clock
  /** Quanto cada chave vive desde a primeira soma. */
  readonly janelaMs: number
  #ultimaVarredura = Number.NEGATIVE_INFINITY

  /** Quantas chaves o seguro em memória guarda agora (vivas ou à espera da varredura do minuto). */
  get noSeguro(): number {
    return this.#seguro.size
  }

  constructor(
    private readonly cliente: Redis,
    private readonly chave: Uint8Array,
    { janelaMs = JANELA_DO_CONTADOR_POR_IP_MS, avisarSeguro = avisarSeguroDoLogin, relogio = systemClock, proporcaoDoSeguro = new SlidingWindowRatio() }: WindowCounterOptions = {},
  ) {
    if (!Number.isInteger(janelaMs) || janelaMs < 1) throw new RangeError('a janela do contador precisa ser um inteiro positivo de milissegundos')
    this.janelaMs = janelaMs
    this.#relogio = relogio
    this.#proporcaoDoSeguro = proporcaoDoSeguro
    this.#avisarSeguro = throttledWarn(avisarSeguro)
  }

  /** Das contagens dos últimos 30 s, a proporção que o seguro em memória atendeu, de 0 a 1 (`limite.seguro_ativo`). */
  get proporcaoDoSeguro(): number {
    return this.#proporcaoDoSeguro.valor()
  }

  /** A chave de um contador: o prefixo do uso e o HMAC do identificador (o IP, ou a escola e o IP). */
  chaveDe(prefixo: string, identificador: string): string {
    return `${prefixo}:${createHmac('sha256', this.chave).update(identificador).digest('base64url')}`
  }

  /** Soma um e devolve o valor na janela. */
  async somar(chave: string): Promise<WindowCount> {
    if (this.cliente.status === 'ready') {
      try {
        const valor = Number(await this.cliente.eval(SCRIPT_SOMAR, 1, chave, this.janelaMs))
        if (!Number.isFinite(valor)) throw new InvariantException('resposta do contador fora do formato')
        this.#proporcaoDoSeguro.registrar(false)
        return { valor, doSeguro: false }
      } catch {
        // Redis travado ou caindo no meio: o seguro conta esta. Se o script rodou e só a resposta passou do prazo, ela
        // fica contada nos dois lugares, para o lado de rebaixar, nunca de liberar.
      }
    }
    return { valor: this.#somarNoSeguro(chave), doSeguro: true }
  }

  /** O valor na janela, sem somar. */
  async ler(chave: string): Promise<WindowCount> {
    if (this.cliente.status === 'ready') {
      try {
        const valor = Number((await this.cliente.get(chave)) ?? 0)
        if (!Number.isFinite(valor)) throw new InvariantException('resposta do contador fora do formato')
        this.#proporcaoDoSeguro.registrar(false)
        return { valor, doSeguro: false }
      } catch {
        // Idem: a leitura vai ao seguro.
      }
    }
    this.#usouSeguro()
    return { valor: this.#vivo(chave, this.#relogio.agora().getTime())?.valor ?? 0, doSeguro: true }
  }

  /**
   * Quanto falta, em ms, para a chave sair da janela: 0 quando ela não existe (ou venceu). É o `Retry-After` de quem o
   * limite segurou. Com o Redis fora, o do seguro em memória.
   */
  async restanteMs(chave: string): Promise<number> {
    if (this.cliente.status === 'ready') {
      try {
        const restante = Number(await this.cliente.pttl(chave))
        if (!Number.isFinite(restante)) throw new InvariantException('resposta do contador fora do formato')
        // -2 (sem a chave) e -1 (sem prazo, que o script nunca deixa) não seguram ninguém.
        return Math.max(0, restante)
      } catch {
        // Idem: o prazo vem do seguro.
      }
    }
    const agora = this.#relogio.agora().getTime()
    return Math.max(0, (this.#vivo(chave, agora)?.venceEm ?? agora) - agora)
  }

  #somarNoSeguro(chave: string): number {
    this.#usouSeguro()
    const agora = this.#relogio.agora().getTime()
    const entrada = this.#vivo(chave, agora) ?? { valor: 0, venceEm: agora + this.janelaMs }
    entrada.valor++
    this.#seguro.set(chave, entrada)
    // A cada janela, e não só quando cresce: o HMAC do IP vencido não fica na memória além da janela seguinte.
    if (agora - this.#ultimaVarredura >= this.janelaMs) this.#varrer(agora)
    return entrada.valor
  }

  #vivo(chave: string, agora: number): InMemoryWindowEntry | undefined {
    const entrada = this.#seguro.get(chave)
    return entrada !== undefined && entrada.venceEm > agora ? entrada : undefined
  }

  #usouSeguro(): void {
    this.#proporcaoDoSeguro.registrar(true)
    this.#avisarSeguro()
  }

  #varrer(agora: number): void {
    this.#ultimaVarredura = agora
    for (const [chave, entrada] of this.#seguro) if (entrada.venceEm <= agora) this.#seguro.delete(chave)
  }
}
