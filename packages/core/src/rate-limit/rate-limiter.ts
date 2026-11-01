import { LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO } from '@educa/shared'
import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { z } from 'zod'
import { validateEnvironment } from '../config/validate-config.js'
import { throttledWarn } from '../log/throttled-warn.js'
import type { RateLimits } from '../settings/operational-settings.js'
import type { Identity } from '../identidade/verify-token.js'
import {
  JANELA_LIMITE_SEGUNDOS,
  insuranceLimit,
  PREFIXO_LIMITE_BUSCA_TITULAR,
  PREFIXO_LIMITE_ESCOLA,
  PREFIXO_LIMITE_IP,
  PREFIXO_LIMITE_IP_LOGIN,
  PREFIXO_LIMITE_IP_OPERACAO,
  PREFIXO_LIMITE_OPERADOR,
  PREFIXO_LIMITE_USUARIO,
} from './keys.js'
import { SlidingWindowRatio } from './sliding-window-ratio.js'

export interface RateLimitConfig {
  /** Redis de cache (`allkeys-lru`): toda chave de limite tem TTL da janela. */
  readonly redisCacheUrl: string
  readonly porUsuarioMin: number
  readonly porEscolaMin: number
  readonly porIpAnonimoMin: number
  /** Requisições por minuto de cada operador Turmma nas rotas `@OperacaoRoute` (`rl:op`, Tech Spec da A0, seção 5). */
  readonly porOperadorMin: number
  /** Quantas instâncias da API dividem o limite. O seguro em memória de cada uma usa limite ÷ instâncias. */
  readonly instancias: number
  /** Nome ou IP dos proxies cujo `X-Forwarded-For` vale (a borda). */
  readonly proxiesConfiaveis: readonly string[]
}

const inteiroPositivo = z.coerce.number().int().positive()
// Nome de host do compose ou IP: nada de URL, porta nem texto livre.
const entradaDeProxy = z.string().regex(/^[A-Za-z0-9.:-]+$/)

const rateLimitEnvSchema = z.object({
  REDIS_CACHE_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/),
  LIMITE_REQ_USUARIO_MIN: inteiroPositivo,
  LIMITE_REQ_ESCOLA_MIN: inteiroPositivo,
  LIMITE_REQ_IP_ANONIMO_MIN: inteiroPositivo,
  LIMITE_REQ_OPERADOR_MIN: inteiroPositivo,
  LIMITE_INSTANCIAS_API: inteiroPositivo,
  LIMITE_PROXIES_CONFIAVEIS: z
    .string()
    .transform((texto) => texto.split(',').map((entrada) => entrada.trim()).filter((entrada) => entrada !== ''))
    .pipe(z.array(entradaDeProxy).min(1)),
})

/**
 * Limites do ambiente. São o padrão de toda escola que não configurou o próprio em
 * `configuracao_operacional_escola`. Nenhum valor tem padrão escondido no código (D41).
 */
export function loadRateLimitConfig(ambiente: Record<string, string | undefined>): RateLimitConfig {
  const valores = validateEnvironment(rateLimitEnvSchema, ambiente)
  return {
    redisCacheUrl: valores.REDIS_CACHE_URL,
    porUsuarioMin: valores.LIMITE_REQ_USUARIO_MIN,
    porEscolaMin: valores.LIMITE_REQ_ESCOLA_MIN,
    porIpAnonimoMin: valores.LIMITE_REQ_IP_ANONIMO_MIN,
    porOperadorMin: valores.LIMITE_REQ_OPERADOR_MIN,
    instancias: valores.LIMITE_INSTANCIAS_API,
    proxiesConfiaveis: valores.LIMITE_PROXIES_CONFIAVEIS,
  }
}

export type RateLimitResult = { readonly aceita: true } | { readonly aceita: false; readonly msAteLiberar: number }

type ConsumoOptions = Parameters<RateLimiterMemory['consume']>[2]

/**
 * Seguro em memória de um limite. Marca cada resposta que ele deu, para o limitador saber, por
 * requisição, se o Redis atendeu ou se o seguro entrou no lugar.
 */
class InMemoryFallback extends RateLimiterMemory {
  readonly #respostasDoSeguro = new WeakSet<RateLimiterRes>()

  override async consume(chave: string | number, pontos?: number, opcoes?: ConsumoOptions): Promise<RateLimiterRes> {
    try {
      const resposta = await super.consume(chave, pontos, opcoes)
      this.#respostasDoSeguro.add(resposta)
      return resposta
    } catch (recusa) {
      if (recusa instanceof RateLimiterRes) this.#respostasDoSeguro.add(recusa)
      throw recusa
    }
  }

  respondeu(resposta: RateLimiterRes): boolean {
    return this.#respostasDoSeguro.has(resposta)
  }
}

interface Limite {
  readonly redis: RateLimiterRedis
  readonly seguro: InMemoryFallback
}

/**
 * Os limites de um prefixo, um por valor de pontos. A contagem no Redis é da chave (`rl:e:{escola}`),
 * não do limitador: a escola com limite próprio conta na mesma chave, e só o teto da recusa muda.
 */
class LimitesDoPrefixo {
  readonly #porPontos = new Map<number, Limite>()

  constructor(
    private readonly cliente: Redis,
    private readonly prefixo: string,
    private readonly instancias: number,
  ) {}

  com(pontos: number): Limite {
    let limite = this.#porPontos.get(pontos)
    if (limite === undefined) {
      limite = criarLimite(this.cliente, this.prefixo, pontos, this.instancias)
      this.#porPontos.set(pontos, limite)
    }
    return limite
  }
}

type Consumo = { aceita: boolean; resposta: RateLimiterRes; doSeguro: boolean }

function criarLimite(cliente: Redis, prefixo: string, pontos: number, instancias: number): Limite {
  const seguro = new InMemoryFallback({ keyPrefix: prefixo, points: insuranceLimit(pontos, instancias), duration: JANELA_LIMITE_SEGUNDOS })
  const redis = new RateLimiterRedis({
    storeClient: cliente,
    keyPrefix: prefixo,
    points: pontos,
    duration: JANELA_LIMITE_SEGUNDOS,
    // Cliente que não está pronto (Redis fora, reconectando) vai direto ao seguro, sem tentar o comando.
    rejectIfRedisNotReady: true,
    insuranceLimiter: seguro,
  })
  return { redis, seguro }
}

/**
 * Rate limit da API, no Redis de cache e somado entre as instâncias: por usuário e por escola na
 * rota autenticada, por IP só na anônima (regra 80, item 1). Com o Redis fora ou travado, cada
 * instância segue limitando sozinha, em memória, com limite ÷ instâncias, e `seguroAtivo` vira 1.
 * Nunca libera sem limite, nunca devolve erro por causa do Redis.
 *
 * A troca entre Redis e seguro vai para o log no máximo uma vez a cada 30 s em cada sentido: com o
 * Redis oscilando, uma linha por troca seria uma por requisição. O que mostra a oscilação é a métrica
 * `limite.seguro_ativo`, pela `proporcaoDoSeguro`.
 */
export class RateLimiter {
  readonly #logger = new Logger('limite')
  readonly #usuario: LimitesDoPrefixo
  readonly #escola: LimitesDoPrefixo
  readonly #ipAnonimo: Limite
  readonly #ipDoLogin: Limite
  readonly #ipDaOperacao: Limite
  readonly #operador: Limite
  readonly #buscaDeTitulares: Limite
  readonly #proporcaoDoSeguro: SlidingWindowRatio
  readonly #avisarAtivado = throttledWarn(() => this.#logger.warn('limite.seguro_ativado'))
  readonly #avisarDesativado = throttledWarn(() => this.#logger.log('limite.seguro_desativado'))
  #seguroAtivo = false

  /** @param proporcaoDoSeguro só o teste troca, para mover o relógio da janela sem esperar 30 s. */
  constructor(cliente: Redis, config: RateLimitConfig, proporcaoDoSeguro = new SlidingWindowRatio()) {
    this.#proporcaoDoSeguro = proporcaoDoSeguro
    this.#usuario = new LimitesDoPrefixo(cliente, PREFIXO_LIMITE_USUARIO, config.instancias)
    this.#escola = new LimitesDoPrefixo(cliente, PREFIXO_LIMITE_ESCOLA, config.instancias)
    this.#ipAnonimo = criarLimite(cliente, PREFIXO_LIMITE_IP, config.porIpAnonimoMin, config.instancias)
    this.#ipDoLogin = criarLimite(cliente, PREFIXO_LIMITE_IP_LOGIN, config.porIpAnonimoMin, config.instancias)
    this.#ipDaOperacao = criarLimite(cliente, PREFIXO_LIMITE_IP_OPERACAO, config.porIpAnonimoMin, config.instancias)
    this.#operador = criarLimite(cliente, PREFIXO_LIMITE_OPERADOR, config.porOperadorMin, config.instancias)
    this.#buscaDeTitulares = criarLimite(cliente, PREFIXO_LIMITE_BUSCA_TITULAR, LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO, config.instancias)
  }

  /** 1 enquanto a última requisição limitada foi contada pelo seguro em memória. */
  get seguroAtivo(): 0 | 1 {
    return this.#seguroAtivo ? 1 : 0
  }

  /**
   * Das requisições limitadas nos últimos 30 s, a proporção contada pelo seguro, de 0 a 1. É a métrica
   * `limite.seguro_ativo`: com o Redis fora, chega a 1; com ele oscilando, fica entre 0 e 1, sem pular a
   * cada requisição.
   */
  get proporcaoDoSeguro(): number {
    return this.#proporcaoDoSeguro.valor()
  }

  /**
   * Conta a requisição no limite do usuário e no da escola, as duas em paralelo: com o Redis
   * travado, a espera é um só `commandTimeout`, e não dois.
   *
   * O limite de usuário vale entre escolas (o mesmo `sub` em duas escolas é uma pessoa só); o de
   * escola é de cada escola. Requisição recusada pelo limite do usuário é devolvida ao da escola:
   * um aluno com o script em laço não gasta a cota dos outros 399.
   *
   * Os `limites` são os da escola do token, lidos da configuração dela por quem chama.
   */
  async consumirAutenticada(identidade: Identity, limites: RateLimits): Promise<RateLimitResult> {
    const limiteDaEscola = this.#escola.com(limites.porEscolaMin)
    const [usuario, escola] = await Promise.all([
      this.#consumir(this.#usuario.com(limites.porUsuarioMin), identidade.usuarioId),
      this.#consumir(limiteDaEscola, identidade.escolaId),
    ])
    this.#registrarSeguro(usuario.doSeguro || escola.doSeguro)
    if (!usuario.aceita) {
      await this.#devolver(limiteDaEscola, identidade.escolaId, escola)
      return { aceita: false, msAteLiberar: usuario.resposta.msBeforeNext }
    }
    if (!escola.aceita) return { aceita: false, msAteLiberar: escola.resposta.msBeforeNext }
    return { aceita: true }
  }

  async consumirAnonima(ip: string): Promise<RateLimitResult> {
    return this.#consumirUmaChave(this.#ipAnonimo, ip)
  }

  /**
   * O limite por IP das rotas de login por senha (`@DowngradeRateLimit()`), com o mesmo teto do anônimo e balde próprio.
   * Quem chama não recusa acima dele: só rebaixa a tentativa.
   */
  async consumirDoLogin(ip: string): Promise<RateLimitResult> {
    return this.#consumirUmaChave(this.#ipDoLogin, ip)
  }

  /**
   * O limite por IP das rotas de entrada da operação (`@OperacaoLoginRoute`, `rl:ip:op`), com o mesmo teto do anônimo e
   * balde próprio: nem a escola atrás do mesmo IP gasta o do operador, nem o contrário. Quem chama recusa acima dele, ou
   * só rebaixa, nas rotas `@DowngradeRateLimit`.
   */
  async consumirDaOperacao(ip: string): Promise<RateLimitResult> {
    return this.#consumirUmaChave(this.#ipDaOperacao, ip)
  }

  /**
   * O limite do operador Turmma nas rotas `@OperacaoRoute` (`rl:op:{operadorId}`), pelo `sub` do token de operador
   * verificado. Com o Redis fora, o mesmo seguro em memória dos outros limites.
   */
  async consumirDeOperador(operadorId: string): Promise<RateLimitResult> {
    return this.#consumirUmaChave(this.#operador, operadorId)
  }

  /**
   * O limite da busca de titulares (`rl:busca-titular:{usuarioId}`, F3, tarefa 11.0), por usuário: 30 por minuto,
   * balde próprio. Conta **além** do limite do usuário e do da escola, que continuam valendo; duas coordenações da
   * mesma escola, atrás do mesmo IP, têm 30 cada (regra 80, item 1).
   */
  async consumirDaBuscaDeTitulares(usuarioId: string): Promise<RateLimitResult> {
    return this.#consumirUmaChave(this.#buscaDeTitulares, usuarioId)
  }

  async #consumirUmaChave(limite: Limite, chave: string): Promise<RateLimitResult> {
    const consumo = await this.#consumir(limite, chave)
    this.#registrarSeguro(consumo.doSeguro)
    return consumo.aceita ? { aceita: true } : { aceita: false, msAteLiberar: consumo.resposta.msBeforeNext }
  }

  async #consumir(limite: Limite, chave: string): Promise<Consumo> {
    try {
      const resposta = await limite.redis.consume(chave)
      return { aceita: true, resposta, doSeguro: limite.seguro.respondeu(resposta) }
    } catch (recusa) {
      // O seguro sempre responde com RateLimiterRes; outra coisa é defeito nosso, e sobe como erro.
      if (!(recusa instanceof RateLimiterRes)) throw recusa
      return { aceita: false, resposta: recusa, doSeguro: limite.seguro.respondeu(recusa) }
    }
  }

  /** Devolve o ponto a quem o contou: ao seguro, se foi ele, sem esperar outra vez pelo Redis fora. */
  async #devolver(limite: Limite, chave: string, consumo: Consumo): Promise<void> {
    try {
      await (consumo.doSeguro ? limite.seguro.reward(chave) : limite.redis.reward(chave))
    } catch {
      // Devolução que falhou só deixa a cota da escola um pouco menor até o fim da janela.
    }
  }

  #registrarSeguro(ativo: boolean): void {
    this.#proporcaoDoSeguro.registrar(ativo)
    if (ativo === this.#seguroAtivo) return
    this.#seguroAtivo = ativo
    if (ativo) this.#avisarAtivado()
    else this.#avisarDesativado()
  }
}
