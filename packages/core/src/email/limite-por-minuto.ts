import { InvariantException } from '@educa/shared'
import type { Redis } from 'ioredis'
import { createHash } from 'node:crypto'
import type { Clock } from '../clock.js'

/**
 * Quem consome o `EMAIL_POR_MINUTO`: o convite da escola ou o link da conta (esqueci, verificar). O teto é um só, global; o convite
 * pode usar até `tetoDoConvite(porMinuto)` dele, e o resto fica reservado ao link da conta (Tech Spec, seção 5, "E-mail").
 */
export type ClasseDoEmail = 'convite' | 'conta'

/** O ponto que um envio gastou: a janela de um minuto em que foi gasto e quem o gastou. Só com ele o ponto volta. */
export interface PontoDeEmail {
  readonly classe: ClasseDoEmail
  readonly janela: number
}

export type ConsumoDeEmail =
  | { readonly resultado: 'concedido'; readonly ponto: PontoDeEmail }
  /** O teto do minuto (ou a metade do convite) está gasto: `msBeforeNext` é o que falta para a janela seguinte abrir. */
  | { readonly resultado: 'sem_vaga'; readonly msBeforeNext: number }

/** O que o job de e-mail pede ao limite: gastar um ponto antes de falar com o provedor, e devolvê-lo se nada foi enviado. */
export interface LimiteDeEmail {
  consumir(classe: ClasseDoEmail): Promise<ConsumoDeEmail>
  devolver(ponto: PontoDeEmail): Promise<boolean>
}

const MS_DA_JANELA = 60_000
/** As chaves vivem duas janelas: a atual e a que acabou de fechar, para o `devolver` do fim do minuto não achar a chave sumida. */
const VALIDADE_DA_CHAVE_MS = 2 * MS_DA_JANELA

/** O convite usa no máximo a outra metade do teto; o link da conta tem a sua metade só para ele (com `porMinuto` ímpar, a conta fica com a menor). */
export function tetoDoConvite(porMinuto: number): number {
  return porMinuto - Math.floor(porMinuto / 2)
}

/**
 * `consumir <agora> <porMinuto> <tetoDoConvite> <classe>`: a janela é `floor(agora / 60 s)`, e o total e o do convite são dois contadores
 * da janela. `agora` negativo manda ler o `TIME` do Redis, o mesmo relógio para toda instância; só o teste passa um relógio seu.
 * `devolver <agora> <janela> <classe>`: tira o ponto se, e só se, a janela de agora é a mesma em que ele foi gasto.
 * Tudo no script: a conta e a gravação são atômicas, e dois workers nunca passam do teto.
 */
const SCRIPT = `
local base = KEYS[1]
local operacao = ARGV[1]
local agora = tonumber(ARGV[2])
if agora < 0 then
  local tempo = redis.call('TIME')
  agora = tonumber(tempo[1]) * 1000 + math.floor(tonumber(tempo[2]) / 1000)
end
local janelaAtual = math.floor(agora / ${MS_DA_JANELA})

if operacao == 'consumir' then
  local porMinuto = tonumber(ARGV[3])
  local tetoDoConvite = tonumber(ARGV[4])
  local classe = ARGV[5]
  local chaveTotal = base .. ':' .. janelaAtual .. ':total'
  local chaveConvite = base .. ':' .. janelaAtual .. ':convite'
  local total = tonumber(redis.call('GET', chaveTotal) or '0')
  local convite = tonumber(redis.call('GET', chaveConvite) or '0')
  if total >= porMinuto or (classe == 'convite' and convite >= tetoDoConvite) then
    return {0, janelaAtual, (janelaAtual + 1) * ${MS_DA_JANELA} - agora}
  end
  redis.call('INCR', chaveTotal)
  redis.call('PEXPIRE', chaveTotal, ${VALIDADE_DA_CHAVE_MS})
  if classe == 'convite' then
    redis.call('INCR', chaveConvite)
    redis.call('PEXPIRE', chaveConvite, ${VALIDADE_DA_CHAVE_MS})
  end
  return {1, janelaAtual, 0}
end

if operacao == 'devolver' then
  local janela = tonumber(ARGV[3])
  local classe = ARGV[4]
  if janela ~= janelaAtual then
    return 0
  end
  local chaveTotal = base .. ':' .. janela .. ':total'
  local chaveConvite = base .. ':' .. janela .. ':convite'
  if tonumber(redis.call('GET', chaveTotal) or '0') > 0 then
    redis.call('DECR', chaveTotal)
  end
  if classe == 'convite' and tonumber(redis.call('GET', chaveConvite) or '0') > 0 then
    redis.call('DECR', chaveConvite)
  end
  return 1
end

return redis.error_reply('operacao do limite de e-mail desconhecida')
`

const SHA_DO_SCRIPT = createHash('sha1').update(SCRIPT).digest('hex')

/**
 * O `EMAIL_POR_MINUTO` (acesso-e-convites, tarefa 2.0; Tech Spec, seção 5, "E-mail"): o teto de mensagens por minuto de todas as
 * escolas, abaixo do que o provedor aceita, gasto **antes** de falar com ele e guardado no Redis de fila, atômico entre workers.
 *
 * - **Sem seguro em memória.** Redis fora ou travado, `consumir` falha, e o job adia: mandar sem contar estouraria o teto do provedor
 *   justamente quando mais de um worker cai no mesmo erro.
 * - **O ponto de um envio que não aconteceu volta**, mas só na janela em que foi gasto: o que sobra de outro minuto já não é o ponto de
 *   ninguém.
 * - **O convite usa a metade de cima do teto**, e o link da conta nunca fica sem a de baixo.
 */
export class LimiteDeEmailPorMinuto implements LimiteDeEmail {
  readonly #chave: string
  readonly #tetoDoConvite: number
  /** O relógio da janela em ms, ou -1 para o script ler o `TIME` do Redis. */
  readonly #agora: () => number

  /**
   * @param redis cliente do Redis de fila sem fila offline e com `commandTimeout` (`createQueueRedisClient`).
   * @param relogio só o teste passa: sem ele a janela é a do `TIME` do Redis.
   * @param prefixo só o teste passa, para não disputar o teto com outro teste.
   */
  constructor(
    private readonly redis: Redis,
    private readonly porMinuto: number,
    opcoes: { readonly prefixo?: string | undefined; readonly relogio?: Clock | undefined } = {},
  ) {
    if (!Number.isInteger(porMinuto) || porMinuto < 1) throw new InvariantException('EMAIL_POR_MINUTO precisa ser um inteiro positivo')
    this.#chave = `${opcoes.prefixo === undefined ? '' : `${opcoes.prefixo}:`}email:minuto`
    this.#tetoDoConvite = tetoDoConvite(porMinuto)
    const { relogio } = opcoes
    this.#agora = relogio === undefined ? () => -1 : () => relogio.agora().getTime()
  }

  /** Gasta um ponto da janela de agora, ou diz quantos milissegundos faltam para a próxima. */
  async consumir(classe: ClasseDoEmail): Promise<ConsumoDeEmail> {
    const resposta = await this.executar('consumir', this.#agora(), this.porMinuto, this.#tetoDoConvite, classe)
    if (!Array.isArray(resposta) || resposta.length !== 3) throw new InvariantException('o script do limite de e-mail devolveu resposta inesperada')
    const [concedido, janela, msBeforeNext] = resposta.map(Number) as [number, number, number]
    return concedido === 1 ? { resultado: 'concedido', ponto: { classe, janela } } : { resultado: 'sem_vaga', msBeforeNext }
  }

  /** Devolve o ponto se a janela dele ainda é a de agora. `false`: o minuto virou, e o ponto não volta. */
  async devolver(ponto: PontoDeEmail): Promise<boolean> {
    return Number(await this.executar('devolver', this.#agora(), ponto.janela, ponto.classe)) === 1
  }

  /** `EVALSHA`, e `EVAL` só na primeira vez que este Redis vê o script (ou depois de ele reiniciar sem o cache). */
  private async executar(...argumentos: Array<string | number>): Promise<unknown> {
    try {
      return await this.redis.evalsha(SHA_DO_SCRIPT, 1, this.#chave, ...argumentos)
    } catch (erro) {
      if (!(erro instanceof Error) || !erro.message.startsWith('NOSCRIPT')) throw erro
      return this.redis.eval(SCRIPT, 1, this.#chave, ...argumentos)
    }
  }
}
