import { InvariantException } from '@educa/shared'
import type { Redis } from 'ioredis'
import { createHash } from 'node:crypto'
import type { Clock } from '../clock.js'
import { insuranceLimit } from './keys.js'

/** A janela da cota: uma hora, contada do primeiro ponto gasto (não da hora de relógio). */
export const MS_DA_JANELA_DA_COTA = 3_600_000
/** A chave vive duas janelas: o `devolver` do fim da janela não acha a chave sumida, e a que ninguém mais usa expira sozinha. */
const VALIDADE_DA_CHAVE_MS = 2 * MS_DA_JANELA_DA_COTA

/** Os pontos que um pedido gastou: de quem, quantos, em que janela e onde (Redis ou seguro). Só com esta reserva os pontos voltam. */
export interface PontosGastos {
  readonly dono: string
  readonly pontos: number
  /** O instante em que a janela abriu (ms). Ponto de uma janela que já fechou não volta: já não é ponto de ninguém. */
  readonly janela: number
  readonly origem: 'redis' | 'memoria'
}

export type ConsumoDaCota = { readonly resultado: 'concedido'; readonly gasto: PontosGastos } | { readonly resultado: 'recusado'; readonly msAteLiberar: number }

/**
 * `consumir <agora> <pontos> <teto>`: abre a janela no primeiro ponto (ou quando a anterior fechou), recusa o pedido inteiro que não cabe no que
 * resta, e senão grava os `pontos` de uma vez. `devolver <agora> <pontos> <janela>`: tira os pontos se, e só se, a janela ainda é a mesma em que foram
 * gastos. `agora` negativo manda ler o `TIME` do Redis, o mesmo relógio para toda instância; só o teste passa um relógio seu.
 * Tudo no script: o conferir e o gastar são atômicos, e dois pedidos nunca passam do teto juntos.
 */
const SCRIPT = `
local chave = KEYS[1]
local operacao = ARGV[1]
local agora = tonumber(ARGV[2])
if agora < 0 then
  local tempo = redis.call('TIME')
  agora = tonumber(tempo[1]) * 1000 + math.floor(tonumber(tempo[2]) / 1000)
end
local inicio = tonumber(redis.call('HGET', chave, 'inicio') or '-1')
local usados = tonumber(redis.call('HGET', chave, 'usados') or '0')

if operacao == 'consumir' then
  local pontos = tonumber(ARGV[3])
  local teto = tonumber(ARGV[4])
  if inicio < 0 or agora - inicio >= ${MS_DA_JANELA_DA_COTA} then
    inicio = agora
    usados = 0
  end
  if usados + pontos > teto then
    return {0, inicio, inicio + ${MS_DA_JANELA_DA_COTA} - agora}
  end
  redis.call('HSET', chave, 'inicio', inicio, 'usados', usados + pontos)
  redis.call('PEXPIRE', chave, ${VALIDADE_DA_CHAVE_MS})
  return {1, inicio, 0}
end

if operacao == 'devolver' then
  local pontos = tonumber(ARGV[3])
  local janela = tonumber(ARGV[4])
  if inicio ~= janela then
    return 0
  end
  redis.call('HSET', chave, 'usados', math.max(0, usados - pontos))
  return 1
end

return redis.error_reply('operacao da cota por hora desconhecida')
`

const SHA_DO_SCRIPT = createHash('sha1').update(SCRIPT).digest('hex')

export interface CotaPorHoraOpcoes {
  /** Quantos pontos o dono tem por janela de uma hora. */
  readonly porHora: number
  /** Quantas instâncias da API dividem a cota quando o Redis está fora: o seguro de cada uma é `porHora ÷ instâncias`, nunca abaixo de 1. */
  readonly instancias: number
  /** Só o teste passa: sem ele a janela é a do `TIME` do Redis (e a do relógio do processo no seguro). */
  readonly relogio?: Clock | undefined
  /** Só o teste passa, para não dividir a cota com outro teste. */
  readonly prefixo?: string | undefined
  /** Chamado a cada vez que o seguro em memória atende no lugar do Redis; quem passa limita o log. */
  readonly aoUsarOSeguro?: (() => void) | undefined
}

/**
 * Uma cota de pontos por hora para cada dono (a escola), no Redis de fila (acesso-e-convites, tarefa 3.0; Tech Spec, seção 5, "Enviar"): o "Enviar convites"
 * gasta, de uma vez e atomicamente, um ponto por convite que entra. O pedido que não cabe no que resta é recusado **inteiro**, sem gastar nada; o que
 * foi gasto e não virou convite (a transação desfeita) volta, só na janela em que foi gasto.
 *
 * - **A janela abre no primeiro ponto** e dura uma hora: cota esgotada às 10h02 libera às 11h02, e não a cada hora cheia.
 * - **Redis fora**: o seguro em memória de cada instância vale `porHora ÷ instâncias` (como o limite de requisições), e a soma das instâncias não passa da
 *   cota. Nunca recusa por causa do Redis, nem deixa passar sem contar.
 * - Um dono não enxerga a cota de outro: a chave leva o id dele (a escola), nunca o do pedido.
 */
export class CotaPorHora {
  readonly #chaveBase: string
  readonly #seguro = new Map<string, { inicio: number; usados: number }>()

  constructor(
    private readonly redis: Redis,
    private readonly opcoes: CotaPorHoraOpcoes,
  ) {
    if (!Number.isInteger(opcoes.porHora) || opcoes.porHora < 1) throw new InvariantException('a cota por hora precisa ser um inteiro positivo')
    if (!Number.isInteger(opcoes.instancias) || opcoes.instancias < 1) throw new InvariantException('as instâncias da cota por hora precisam ser um inteiro positivo')
    this.#chaveBase = `${opcoes.prefixo === undefined ? '' : `${opcoes.prefixo}:`}cota:hora`
  }

  /** Gasta `pontos` do dono, ou diz em quantos milissegundos a janela fecha. Pedido maior que a cota inteira também é recusado. */
  async consumir(dono: string, pontos: number): Promise<ConsumoDaCota> {
    if (!Number.isInteger(pontos) || pontos < 1) throw new InvariantException('pontos da cota precisam ser um inteiro positivo')
    try {
      const resposta = await this.executar(dono, 'consumir', this.#agora(), pontos, this.opcoes.porHora)
      if (!Array.isArray(resposta) || resposta.length !== 3) throw new InvariantException('o script da cota por hora devolveu resposta inesperada')
      const [concedido, janela, msAteLiberar] = resposta.map(Number) as [number, number, number]
      return concedido === 1 ? { resultado: 'concedido', gasto: { dono, pontos, janela, origem: 'redis' } } : { resultado: 'recusado', msAteLiberar }
    } catch (erro) {
      if (erro instanceof InvariantException) throw erro
      return this.consumirNoSeguro(dono, pontos)
    }
  }

  /** Devolve os pontos se a janela deles ainda é a de agora. `false`: a janela fechou, ou o Redis não atendeu, e nada volta. */
  async devolver(gasto: PontosGastos): Promise<boolean> {
    if (gasto.origem === 'memoria') return this.devolverAoSeguro(gasto)
    try {
      return Number(await this.executar(gasto.dono, 'devolver', this.#agora(), gasto.pontos, gasto.janela)) === 1
    } catch {
      return false
    }
  }

  #agora(): number {
    return this.opcoes.relogio === undefined ? -1 : this.opcoes.relogio.agora().getTime()
  }

  #agoraNoSeguro(): number {
    return this.opcoes.relogio === undefined ? Date.now() : this.opcoes.relogio.agora().getTime()
  }

  private consumirNoSeguro(dono: string, pontos: number): ConsumoDaCota {
    this.opcoes.aoUsarOSeguro?.()
    const agora = this.#agoraNoSeguro()
    const teto = insuranceLimit(this.opcoes.porHora, this.opcoes.instancias)
    let estado = this.#seguro.get(dono)
    if (estado === undefined || agora - estado.inicio >= MS_DA_JANELA_DA_COTA) {
      estado = { inicio: agora, usados: 0 }
      this.#seguro.set(dono, estado)
    }
    if (estado.usados + pontos > teto) return { resultado: 'recusado', msAteLiberar: estado.inicio + MS_DA_JANELA_DA_COTA - agora }
    estado.usados += pontos
    return { resultado: 'concedido', gasto: { dono, pontos, janela: estado.inicio, origem: 'memoria' } }
  }

  private devolverAoSeguro(gasto: PontosGastos): boolean {
    const estado = this.#seguro.get(gasto.dono)
    if (estado === undefined || estado.inicio !== gasto.janela) return false
    estado.usados = Math.max(0, estado.usados - gasto.pontos)
    return true
  }

  /** `EVALSHA`, e `EVAL` só na primeira vez que este Redis vê o script (ou depois de ele reiniciar sem o cache). */
  private async executar(dono: string, ...argumentos: Array<string | number>): Promise<unknown> {
    const chave = `${this.#chaveBase}:${dono}`
    try {
      return await this.redis.evalsha(SHA_DO_SCRIPT, 1, chave, ...argumentos)
    } catch (erro) {
      if (!(erro instanceof Error) || !erro.message.startsWith('NOSCRIPT')) throw erro
      return this.redis.eval(SCRIPT, 1, chave, ...argumentos)
    }
  }
}
