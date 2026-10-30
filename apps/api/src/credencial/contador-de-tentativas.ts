import { avisoEspacado, ProporcaoEmJanela, relogioDoSistema, type Relogio } from '@educa/nucleo'
import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { createHmac } from 'node:crypto'
import { InvariantException } from '@educa/shared'

/** Falhas seguidas antes de a conta ser segurada (Tech Spec, seção 5, "Tentativas"). */
export const FALHAS_ANTES_DE_SEGURAR = 5
/** Espera na quinta falha; dobra a cada falha seguinte. */
export const ESPERA_INICIAL_MS = 30_000
/** Teto da espera. */
export const ESPERA_MAXIMA_MS = 15 * 60_000
/** Quanto o contador vive sem falha nova: é a retenção do `docs/lgpd.md` ("Contador de tentativas de login"). */
export const VALIDADE_DO_CONTADOR_MS = 15 * 60_000
/** Com o Redis fora, quantas contas o seguro em memória guarda antes de varrer as vencidas. */
export const TAMANHO_PARA_VARRER_O_SEGURO = 10_000
/** Intervalo mínimo entre duas varreduras: sob ataque com milhares de e-mails vivos, varrer a cada tentativa custaria O(n) cada. */
export const INTERVALO_ENTRE_VARREDURAS_MS = 60_000

/** De onde vem a tentativa: do navegador que já entrou nesta conta (`educa_dispositivo`) ou de qualquer outro. */
export type OrigemDaTentativa = 'conhecido' | 'outro'

/**
 * O prefixo da chave do contador: `login` para as contas da escola (F1) e `login-op` para o operador Turmma (A0, Tech
 * Spec, seção 5, "Entrada"). Com prefixos diferentes, o mesmo e-mail como coordenador e como operador tem dois
 * contadores: errar a senha num não segura o outro (C24).
 */
export type PrefixoDoContador = 'login' | 'login-op'

/**
 * A espera que a falha de número `falhas` impõe: nada até a quarta, 30 s na quinta, e o dobro a cada falha seguinte,
 * até 15 min.
 */
export function esperaDaFalha(falhas: number): number {
  if (falhas < FALHAS_ANTES_DE_SEGURAR) return 0
  return Math.min(ESPERA_INICIAL_MS * 2 ** (falhas - FALHAS_ANTES_DE_SEGURAR), ESPERA_MAXIMA_MS)
}

/**
 * O resultado de reservar uma tentativa, antes do hash:
 * - `segurada`: a conta está segurada, e a senha nem é conferida; `esperaMs` é o que falta;
 * - `liberada`: a tentativa já foi contada como falha, e `esperaSeFalharMs` é a espera que ela impôs se a senha
 *   estiver errada (0 enquanto não chegou à quinta). Se a senha estiver certa, quem chamou zera o contador.
 */
export type Reserva = { readonly liberada: false; readonly esperaMs: number } | { readonly liberada: true; readonly esperaSeFalharMs: number }

/**
 * Reserva no Redis, numa operação só: lê o estado, recusa se a conta está segurada, conta a falha e, a partir da
 * quinta, grava até quando ela fica segurada. Dois pedidos ao mesmo tempo nunca leem o mesmo número de falhas, e
 * por isso dez senhas erradas em paralelo avaliam no máximo cinco hashes (regra 80, item 7).
 */
const SCRIPT_RESERVAR = `
local agora = tonumber(ARGV[1])
local limite = tonumber(ARGV[2])
local inicial = tonumber(ARGV[3])
local maxima = tonumber(ARGV[4])
local validade = tonumber(ARGV[5])
local estado = redis.call('HMGET', KEYS[1], 'falhas', 'ate')
local falhas = tonumber(estado[1]) or 0
local ate = tonumber(estado[2]) or 0
if ate > agora then
  return {0, ate - agora}
end
falhas = falhas + 1
local espera = 0
if falhas >= limite then
  espera = math.min(inicial * (2 ^ (falhas - limite)), maxima)
  ate = agora + espera
end
redis.call('HSET', KEYS[1], 'falhas', falhas, 'ate', ate)
redis.call('PEXPIRE', KEYS[1], math.max(validade, espera))
return {1, espera}
`

/**
 * Desfaz uma reserva, numa operação só: tira a falha que ela contou e, se foi ela que segurou a conta (a quinta, ou a
 * seguinte depois da espera), solta a espera que ela gravou. Enquanto a conta está segurada nenhuma outra reserva é
 * contada, e por isso a espera que existe é a desta. Sem falha nenhuma, apaga a chave.
 */
const SCRIPT_DESFAZER = `
local soltar = tonumber(ARGV[1])
local falhas = tonumber(redis.call('HGET', KEYS[1], 'falhas'))
if not falhas then
  return 0
end
falhas = falhas - 1
if falhas <= 0 then
  redis.call('DEL', KEYS[1])
  return 0
end
if soltar == 1 then
  redis.call('HSET', KEYS[1], 'falhas', falhas, 'ate', 0)
else
  redis.call('HSET', KEYS[1], 'falhas', falhas)
end
return falhas
`

interface EstadoEmMemoria {
  falhas: number
  ate: number
  venceEm: number
}

/**
 * O mesmo contador, em memória, para quando o Redis de fila não responde: a mesma regra, contada por instância
 * (Tech Spec, seção 5). Nunca libera sem contar. Varre as entradas vencidas quando cresce, para um ataque com
 * milhares de e-mails diferentes não crescer sem limite.
 *
 * Com o Redis de pé, guarda também a espera de toda conta que ele segurou (15.3): se o Redis cair no meio do ataque, a
 * conta segurada continua segurada nesta instância, em vez de recomeçar do zero em memória.
 */
class SeguroEmMemoria {
  readonly #estados = new Map<string, EstadoEmMemoria>()
  #ultimaVarredura = Number.NEGATIVE_INFINITY

  /** A conta que o Redis segurou até `ate`: a quinta falha já foi, e a próxima, depois da espera, dobra. */
  espelhar(chave: string, ate: number, agora: number): void {
    const atual = this.#estados.get(chave)
    const falhas = Math.max(atual !== undefined && atual.venceEm > agora ? atual.falhas : 0, FALHAS_ANTES_DE_SEGURAR)
    this.#estados.set(chave, { falhas, ate, venceEm: Math.max(ate, agora + VALIDADE_DO_CONTADOR_MS) })
    this.#varrerSeCresceu(agora)
  }

  reservar(chave: string, agora: number): Reserva {
    const atual = this.#estados.get(chave)
    const vivo = atual !== undefined && atual.venceEm > agora ? atual : { falhas: 0, ate: 0, venceEm: 0 }
    if (vivo.ate > agora) return { liberada: false, esperaMs: vivo.ate - agora }
    const falhas = vivo.falhas + 1
    const espera = esperaDaFalha(falhas)
    this.#estados.set(chave, { falhas, ate: espera > 0 ? agora + espera : vivo.ate, venceEm: agora + Math.max(VALIDADE_DO_CONTADOR_MS, espera) })
    this.#varrerSeCresceu(agora)
    return { liberada: true, esperaSeFalharMs: espera }
  }

  #varrerSeCresceu(agora: number): void {
    if (this.#estados.size > TAMANHO_PARA_VARRER_O_SEGURO && agora - this.#ultimaVarredura >= INTERVALO_ENTRE_VARREDURAS_MS) this.#varrer(agora)
  }

  zerar(chave: string): void {
    this.#estados.delete(chave)
  }

  /** A mesma regra do `SCRIPT_DESFAZER`, em memória. */
  desfazer(chave: string, soltarEspera: boolean): void {
    const atual = this.#estados.get(chave)
    if (atual === undefined) return
    const falhas = atual.falhas - 1
    if (falhas <= 0) this.#estados.delete(chave)
    else this.#estados.set(chave, { ...atual, falhas, ate: soltarEspera ? 0 : atual.ate })
  }

  #varrer(agora: number): void {
    this.#ultimaVarredura = agora
    for (const [chave, estado] of this.#estados) if (estado.venceEm <= agora) this.#estados.delete(chave)
  }
}

/**
 * O contador de tentativas de login (Tech Spec, seção 5, "Tentativas"), no Redis de fila, que não expulsa chave:
 * no Redis de cache (`allkeys-lru`), a expulsão zeraria o contador no meio de um ataque.
 *
 * - **Chave:** `{prefixo}:{HMAC(chave, identificador)}:{conhecido|outro}`, com o prefixo `login` da escola ou o
 *   `login-op` do operador. O Redis nunca vê o e-mail, e o script que erra a senha de outro navegador segura só o
 *   contador `outro`: a professora no computador dela continua entrando.
 * - **Antes do hash:** a tentativa é reservada, e contada, antes de a senha ser conferida.
 * - **Por conta, nunca por IP** (regra 80, item 1): a escola inteira sai por um IP só.
 * - **Redis fora ou lento:** o seguro em memória atende com a mesma regra, e `proporcaoDoSeguro` alimenta
 *   `limite.seguro_ativo`, como no rate limit do F0. A conta que o Redis já tinha segurado continua segurada nesta
 *   instância (15.3).
 */
export class ContadorDeTentativas {
  readonly #logger = new Logger('login')
  readonly #seguro = new SeguroEmMemoria()
  readonly #proporcaoDoSeguro: ProporcaoEmJanela
  readonly #avisarSeguro = avisoEspacado(() => this.#logger.warn('login.contador_no_seguro'))

  /** @param proporcaoDoSeguro só o teste troca, para mover a janela sem esperar 30 s. */
  constructor(
    private readonly cliente: Redis,
    private readonly chave: Uint8Array,
    private readonly relogio: Relogio = relogioDoSistema,
    proporcaoDoSeguro = new ProporcaoEmJanela(),
  ) {
    this.#proporcaoDoSeguro = proporcaoDoSeguro
  }

  /** Das reservas dos últimos 30 s, a proporção que o seguro em memória atendeu, de 0 a 1 (`limite.seguro_ativo`). */
  get proporcaoDoSeguro(): number {
    return this.#proporcaoDoSeguro.valor()
  }

  /** A chave de uma conta, pelo HMAC do identificador já normalizado; sem prefixo, a da escola (`login`). */
  chaveDe(identificador: string, origem: OrigemDaTentativa, prefixo: PrefixoDoContador = 'login'): string {
    return `${prefixo}:${createHmac('sha256', this.chave).update(identificador).digest('base64url')}:${origem}`
  }

  async reservar(chave: string): Promise<Reserva> {
    const agora = this.relogio.agora().getTime()
    if (this.cliente.status === 'ready') {
      try {
        const resposta = await this.cliente.eval(SCRIPT_RESERVAR, 1, chave, agora, FALHAS_ANTES_DE_SEGURAR, ESPERA_INICIAL_MS, ESPERA_MAXIMA_MS, VALIDADE_DO_CONTADOR_MS)
        const [liberada, espera] = Array.isArray(resposta) ? resposta.map(Number) : []
        if (espera === undefined || !Number.isFinite(espera)) throw new InvariantException('resposta do contador fora do formato')
        this.#proporcaoDoSeguro.registrar(false)
        // A conta que o Redis segurou (agora, ou por esta falha) fica também no seguro desta instância.
        if (espera > 0) this.#seguro.espelhar(chave, agora + espera, agora)
        return liberada === 1 ? { liberada: true, esperaSeFalharMs: espera } : { liberada: false, esperaMs: espera }
      } catch {
        // Redis travado ou caindo no meio: o seguro conta esta tentativa. Se o script rodou e só a resposta passou
        // dos 100 ms, ela fica contada duas vezes (no Redis e aqui): o erro é para o lado de segurar, nunca de liberar.
      }
    }
    this.#proporcaoDoSeguro.registrar(true)
    this.#avisarSeguro()
    return this.#seguro.reservar(chave, agora)
  }

  /**
   * Desfaz a reserva de uma tentativa que não foi de senha (ou código) errado: a senha certa com o convite que já não
   * ativa (Tech Spec da A0b, seção 5), ou a ativação que esperou a trava da escola além do prazo. O contador volta ao que
   * era antes dela, e não a zero: as falhas de antes continuam contando. No Redis e no seguro, como o `zerar`; falha ao
   * desfazer só deixa a tentativa contada, para o lado de segurar. Se o Redis caiu ou voltou entre a reserva e aqui, o
   * lugar que desfaz pode não ser o que contou, e o contador fica com uma falha a menos: só depois de uma senha (ou
   * código) certa, e por isso aceito.
   */
  async desfazer(chave: string, reserva: Extract<Reserva, { liberada: true }>): Promise<void> {
    const soltarEspera = reserva.esperaSeFalharMs > 0
    this.#seguro.desfazer(chave, soltarEspera)
    if (this.cliente.status !== 'ready') return
    try {
      await this.cliente.eval(SCRIPT_DESFAZER, 1, chave, soltarEspera ? 1 : 0)
    } catch {
      // A tentativa fica contada, e o contador vence sozinho em 15 min.
    }
  }

  /**
   * O acerto zera o contador daquela origem, no Redis e no seguro. Nunca lança: falha ao zerar só deixa a conta contando
   * até o contador vencer sozinho, em 15 min. Devolve se o Redis confirmou (`false` com ele fora ou recusando), para quem
   * já gravou alguma coisa antes, como a sessão do operador, registrar a falha sem desfazer nada (tarefa 9.0 da A0b).
   */
  async zerar(chave: string): Promise<boolean> {
    this.#seguro.zerar(chave)
    if (this.cliente.status !== 'ready') return false
    try {
      await this.cliente.del(chave)
      return true
    } catch {
      return false
    }
  }
}
