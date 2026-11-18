import type { Redis } from 'ioredis'
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { insuranceLimit, JANELA_LIMITE_SEGUNDOS } from '../rate-limit/keys.js'

/**
 * A fila de onde o pedido vem. A `interativa` é o Tutor com o aluno esperando; a `ferramenta`, o professor esperando; a `normal`, o resto (o Analista); o `lote`, o trabalho da noite sem ninguém esperando (a classificação do material).
 * O mesmo nome das filas da IA (`apps/api/src/ia/execucao-command.ts`): o limitador só precisa saber em qual balde reservar antes.
 */
export type FilaDeTokens = 'interativa' | 'ferramenta' | 'normal' | 'lote'

/** O balde geral de cada `provedor:modelo`: 80 % do contratado (`LLM_TOKENS_POR_MINUTO`), a folga que a regra 80, item 4, pede abaixo do contratado. */
export const PARTE_DO_BALDE_GERAL = 0.8
/** A `ferramenta` reserva antes num balde de 15 % do contratado, abaixo do geral: o teto dela é menor que o do Tutor (RF7). */
export const PARTE_DO_BALDE_DA_FERRAMENTA = 0.15
/** A `normal` reserva antes num balde de 10 % do contratado: o "até metade" do geral que o RF7 dá ao que não é do Tutor nem da ferramenta. */
export const PARTE_DO_BALDE_DA_NORMAL = 0.1

/** O `lote` reserva antes num balde de 5 % do contratado: a classificação noturna nunca leva o que a ferramenta e o Tutor esperam (classificacao-bncc, Tech Spec §7c). */
export const PARTE_DO_BALDE_DO_LOTE = 0.05

/** O prefixo de cada balde no Redis. A chave final é `{prefixo}:{provedor:modelo}`: nenhum id de escola, de aluno ou de execução entra nela. */
export const PREFIXO_DO_BALDE_GERAL = 'ia:tok'
export const PREFIXO_DO_BALDE_DA_FERRAMENTA = 'ia:tok:ferramenta'
export const PREFIXO_DO_BALDE_DA_NORMAL = 'ia:tok:normal'
export const PREFIXO_DO_BALDE_DO_LOTE = 'ia:tok:lote'

/** Uma reserva concedida. O uso real só chega depois da chamada: `acertar` troca a estimativa por ele. */
export interface ReservaDeTokens {
  /** Troca a estimativa pelo uso real da chamada, nos dois baldes. Nunca falha: o que o Redis não alcançar fica como estava (superestima, nunca subestima). */
  acertar(usoReal: number): Promise<void>
}

export type ResultadoDaReserva =
  /** `usoDoTeto`: quanto do **contratado** o balde geral ocupa neste minuto, de 0 a 0,8 (a medida de `ia.tokens.uso_do_teto`); a reserva recusada pelo geral vale 0,8, o balde cheio para aquele pedido. Ausente quando o balde da fila recusou antes: o geral nem foi consultado. */
  | { readonly concedida: true; readonly reserva: ReservaDeTokens; readonly usoDoTeto: number }
  | { readonly concedida: false; readonly msAteLiberar: number; readonly usoDoTeto?: number }

/** A porta que o gateway lê: reservar tokens do minuto, para um `provedor:modelo`, na fila de quem pede. */
export interface LimiteDeTokens {
  reservar(modelo: string, estimativa: number, fila: FilaDeTokens): Promise<ResultadoDaReserva>
}

export interface TokenLimiterOptions {
  /** O contratado com o provedor, em tokens por minuto (`LLM_TOKENS_POR_MINUTO`). Os baldes são frações dele. */
  readonly tokensPorMinuto: number
  /** As réplicas do `worker-ia` (`IA_REPLICAS`): com o Redis fora, cada réplica segura o teto dividido por este número. */
  readonly replicas: number
  /** O relógio de quando a reserva vence, só para o teste mover. */
  readonly relogioMs?: () => number
}

interface Balde {
  readonly limitador: RateLimiterRedis
  readonly pontos: number
}

interface Consumo {
  readonly aceita: boolean
  /** O que foi pedido ao balde: a estimativa, no máximo o tamanho dele. */
  readonly pontos: number
  readonly msAteLiberar: number
  readonly consumidos: number
  /** Quando o minuto desta reserva termina: depois disso o ajuste não vale, os pontos já saíram com a janela. */
  readonly venceEm: number
}

/** Chama o `rate-limiter-flexible` por balde: o limite e o seguro em memória (`limite ÷ réplicas`), nunca sem teto. */
function criarBalde(cliente: Redis, prefixo: string, pontos: number, replicas: number): Balde {
  const seguro = new RateLimiterMemory({ keyPrefix: prefixo, points: insuranceLimit(pontos, replicas), duration: JANELA_LIMITE_SEGUNDOS })
  const limitador = new RateLimiterRedis({
    storeClient: cliente,
    keyPrefix: prefixo,
    points: pontos,
    duration: JANELA_LIMITE_SEGUNDOS,
    // Cliente que não está pronto (Redis fora, reconectando) vai direto ao seguro, sem tentar o comando.
    rejectIfRedisNotReady: true,
    insuranceLimiter: seguro,
  })
  return { limitador, pontos }
}

/**
 * O limite de tokens por minuto de toda chamada de modelo (reengenharia-continuacao, 49.0; regra 80, item 4), no Redis e somado entre as réplicas do
 * `worker-ia` (o `RateLimiterRedis`, D81). A reserva é a estimativa da chamada (`estimarTokens` do pedido mais o `maximoDeTokensDeSaida`), feita antes de ela
 * sair e acertada pelo uso real depois.
 *
 * - **O balde geral** de cada `provedor:modelo` tem 80 % do contratado e vale para toda fila.
 * - **A `ferramenta`, a `normal` e o `lote`** reservam antes num balde só delas (15 %, 10 % e 5 %), e o devolvem (`reward`) se o geral recusar. Cheio o balde da fila, quem
 *   espera é ela, e o Tutor, que só olha o geral, segue.
 * - **Com o Redis fora** (cliente não pronto, ou comando que falha), cada réplica conta sozinha em memória com o teto dividido por `IA_REPLICAS`: nunca libera
 *   sem teto e nunca devolve erro por causa do Redis.
 * - **A estimativa maior que o balde** é reservada pelo tamanho dele: o pedido que nunca caberia (o Analista, no pior caso) esperaria 8 s à toa e cairia no
 *   degrau. Ele ocupa o minuto inteiro do balde, e é o que o teto quer dizer.
 *
 * A espera é de quem chama: aqui só se diz em quantos milissegundos o balde libera (`msBeforeNext`).
 */
export class TokenLimiter implements LimiteDeTokens {
  readonly #geral: Balde
  readonly #filas: Readonly<Record<Exclude<FilaDeTokens, 'interativa'>, Balde>>
  readonly #relogioMs: () => number

  constructor(cliente: Redis, opcoes: TokenLimiterOptions) {
    this.#relogioMs = opcoes.relogioMs ?? Date.now
    const parte = (fracao: number): number => Math.max(1, Math.floor(opcoes.tokensPorMinuto * fracao))
    this.#geral = criarBalde(cliente, PREFIXO_DO_BALDE_GERAL, parte(PARTE_DO_BALDE_GERAL), opcoes.replicas)
    this.#filas = {
      ferramenta: criarBalde(cliente, PREFIXO_DO_BALDE_DA_FERRAMENTA, parte(PARTE_DO_BALDE_DA_FERRAMENTA), opcoes.replicas),
      normal: criarBalde(cliente, PREFIXO_DO_BALDE_DA_NORMAL, parte(PARTE_DO_BALDE_DA_NORMAL), opcoes.replicas),
      lote: criarBalde(cliente, PREFIXO_DO_BALDE_DO_LOTE, parte(PARTE_DO_BALDE_DO_LOTE), opcoes.replicas),
    }
  }

  async reservar(modelo: string, estimativa: number, fila: FilaDeTokens): Promise<ResultadoDaReserva> {
    const pedido = Math.max(1, Math.ceil(estimativa))
    const baldeDaFila = fila === 'interativa' ? undefined : this.#filas[fila]
    const naFila = baldeDaFila === undefined ? undefined : await this.#consumir(baldeDaFila, modelo, pedido)
    if (naFila !== undefined && !naFila.aceita) return { concedida: false, msAteLiberar: naFila.msAteLiberar }
    const noGeral = await this.#consumir(this.#geral, modelo, pedido)
    const usoDoTeto = this.#usoDoTeto(noGeral)
    if (!noGeral.aceita) {
      // O geral recusou: o que o balde da fila reservou volta, ou a fila gastaria o teto dela com chamada que não saiu.
      if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, -naFila.pontos, naFila.venceEm)
      return { concedida: false, msAteLiberar: noGeral.msAteLiberar, usoDoTeto }
    }
    const reserva: ReservaDeTokens = {
      acertar: async (usoReal) => {
        const real = Math.max(0, Math.round(usoReal))
        await this.#ajustar(this.#geral, modelo, real - noGeral.pontos, noGeral.venceEm)
        if (baldeDaFila !== undefined && naFila !== undefined) await this.#ajustar(baldeDaFila, modelo, real - naFila.pontos, naFila.venceEm)
      },
    }
    return { concedida: true, reserva, usoDoTeto }
  }

  /**
   * Quanto do contratado o balde geral ocupa, de 0 a `PARTE_DO_BALDE_GERAL`: a ocupação do balde, e não `consumidos / contratado`, porque o balde é o `floor` de 80 % e o contratado
   * não redondo o deixaria abaixo de 0,8 mesmo lotado. A reserva recusada diz que o balde está cheio **para aquele pedido**: na saturação de verdade o balde para logo abaixo do topo
   * (o pedido seguinte não cabe), e é aí que a espera e o modelo menor já estão acontecendo e o alerta tem de acender.
   */
  #usoDoTeto(noGeral: Consumo): number {
    const ocupado = Math.min(noGeral.consumidos, this.#geral.pontos)
    return (ocupado / this.#geral.pontos) * PARTE_DO_BALDE_GERAL
  }

  async #consumir(balde: Balde, modelo: string, pedido: number): Promise<Consumo> {
    const pontos = Math.min(pedido, balde.pontos)
    const agora = this.#relogioMs()
    try {
      const resposta = await balde.limitador.consume(modelo, pontos)
      return { aceita: true, pontos, msAteLiberar: 0, consumidos: resposta.consumedPoints, venceEm: agora + resposta.msBeforeNext }
    } catch (recusa) {
      // O seguro e o limitador sempre respondem com `RateLimiterRes`; outra coisa é defeito nosso, e sobe como erro.
      if (!(recusa instanceof RateLimiterRes)) throw recusa
      // O `rate-limiter-flexible` soma os pontos mesmo ao recusar: sem devolvê-los, cada tentativa de quem espera encheria o balde que ele espera liberar.
      await this.#devolverARecusada(balde, modelo, pontos)
      // Recusada, o balde está cheio **para este pedido**: `consumidos` é o tamanho dele, e não o que havia antes (o balde para logo abaixo do topo, onde o pedido seguinte não cabe).
      return { aceita: false, pontos, msAteLiberar: Math.max(1, recusa.msBeforeNext), consumidos: balde.pontos, venceEm: agora + recusa.msBeforeNext }
    }
  }

  async #devolverARecusada(balde: Balde, modelo: string, pontos: number): Promise<void> {
    try {
      await balde.limitador.reward(modelo, pontos)
    } catch {
      // Sem o Redis, o seguro em memória é o balde: o que ele não devolver vence com o minuto.
    }
  }

  /**
   * Soma (`penalty`) ou devolve (`reward`) a diferença entre o que foi reservado e o que valeu. Só dentro do minuto em que a reserva foi feita: a janela
   * seguinte começa vazia, e devolver nela daria crédito que ninguém gastou. O que o Redis não alcançar fica como estava.
   */
  async #ajustar(balde: Balde, modelo: string, diferenca: number, venceEm: number): Promise<void> {
    if (diferenca === 0 || this.#relogioMs() >= venceEm) return
    try {
      if (diferenca > 0) await balde.limitador.penalty(modelo, diferenca)
      else await balde.limitador.reward(modelo, -diferenca)
    } catch {
      // Ajuste que falhou só deixa o balde com a estimativa até o fim do minuto.
    }
  }
}
