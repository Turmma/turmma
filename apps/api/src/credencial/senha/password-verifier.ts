import { DomainException, METRICS, ROTULO_ESCOLA, type Meter } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import type { ContadorDeTentativas, Reserva } from '../login-lockout.js'
import type { HashDeSenha } from '../password-hasher.js'
import type { BaldeDeLogin } from './login-buckets.js'
import type { SemaforoDeHash } from './hash-bulkhead.js'

export interface DependenciasDaConferencia {
  readonly semaforo: SemaforoDeHash
  readonly contador: ContadorDeTentativas
  readonly hash: HashDeSenha
  readonly medidor: Meter
}

/** Uma tentativa de login por senha: onde ela espera a vez, que contador ela gasta e como a credencial é lida. */
export interface TentativaDeSenha<Credencial extends { readonly senhaHash: string | null } | undefined> {
  /** O balde do semáforo, resolvido antes e sem olhar se a credencial existe (e, na 15.0, se ela foi rebaixada). */
  readonly balde: BaldeDeLogin
  /** A chave do contador de tentativas da conta, com a origem (`conhecido` ou `outro`). */
  readonly chave: string
  readonly senha: string
  /** A leitura da credencial, dentro da vez: `undefined` quando não existe, e aí o hash é o fixo. */
  readonly lerCredencial: () => Promise<Credencial>
  /** O que mais toda falha conta antes da resposta: na matrícula, a falha do IP naquela escola (15.1). */
  readonly aoFalhar?: () => Promise<void>
}

/** O que a resposta de falha precisa da tentativa: o balde (o rótulo de `login.falhas`) e o que mais contar. */
type FalhaDaTentativa = Pick<TentativaDeSenha<undefined>, 'balde' | 'aoFalhar'>

/** A tentativa que passou pelo contador e pelo hash: a reserva liberada, a credencial lida e se a senha confere. */
export interface SenhaConferida<Credencial> {
  readonly reserva: Extract<Reserva, { liberada: true }>
  readonly credencial: Credencial
  readonly confere: boolean
}

/**
 * O trecho que o login por e-mail, o por matrícula e o do endereço que não existe têm em comum (15.6): a reserva no
 * contador, a leitura da credencial e o hash, os três dentro da vez do semáforo, e a resposta de falha.
 *
 * - **A vez vem antes da tentativa** (14.0, ratificado em 18/09/2026): o 503 de quem esperou demais não conta como senha
 *   errada, e a web que repete no 503 não segura a conta de ninguém.
 * - **Conta segurada:** responde 429 `CONTA_SEGURADA` com `Retry-After`, sem ler a credencial nem fazer o hash.
 * - **Falha:** senha errada, identificador que não existe e conta segurada são falhas iguais. Cada uma soma em
 *   `login.falhas{escola_id}` (o rótulo do balde: a escola, `equipe` ou `desconhecida`) e chama `aoFalhar`.
 */
export class ConferenciaNaVez {
  readonly #contaSegurada: ReturnType<Meter['createCounter']>
  readonly #falhas: ReturnType<Meter['createCounter']>

  constructor(private readonly dependencias: DependenciasDaConferencia) {
    this.#contaSegurada = dependencias.medidor.createCounter(METRICS.contaSegurada, { description: 'Tentativas de login respondidas com CONTA_SEGURADA' })
    this.#falhas = dependencias.medidor.createCounter(METRICS.falhasDeLogin, { description: 'Logins por e-mail ou matrícula que falharam, por escola do endereço, equipe ou desconhecida' })
  }

  /** Espera a vez, reserva a tentativa, lê a credencial e confere a senha. Conta segurada sai daqui com o 429. */
  async conferir<Credencial extends { readonly senhaHash: string | null } | undefined>(tentativa: TentativaDeSenha<Credencial>): Promise<SenhaConferida<Credencial>> {
    const { semaforo, contador, hash } = this.dependencias
    const resultado = await semaforo.executar(tentativa.balde, async (): Promise<SenhaConferida<Credencial> | { readonly seguradaPorMs: number }> => {
      const reserva = await contador.reservar(tentativa.chave)
      if (!reserva.liberada) return { seguradaPorMs: reserva.esperaMs }
      const credencial = await tentativa.lerCredencial()
      return { reserva, credencial, confere: await hash.verificar(credencial?.senhaHash, tentativa.senha) }
    })
    if ('seguradaPorMs' in resultado) return this.#falhar(tentativa, resultado.seguradaPorMs)
    return resultado
  }

  /** A resposta da tentativa que não entrou: `CONTA_SEGURADA`, se esta falha segurou a conta, ou `NAO_AUTENTICADO`. */
  recusar(tentativa: FalhaDaTentativa, reserva: SenhaConferida<unknown>['reserva']): Promise<never> {
    return this.#falhar(tentativa, reserva.esperaSeFalharMs)
  }

  async #falhar(tentativa: FalhaDaTentativa, esperaMs: number): Promise<never> {
    this.#falhas.add(1, { [ROTULO_ESCOLA]: tentativa.balde.rotulo })
    await tentativa.aoFalhar?.()
    if (esperaMs <= 0) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    this.#contaSegurada.add(1)
    throw new DomainException(ErrorCode.CONTA_SEGURADA, undefined, Math.max(1, Math.ceil(esperaMs / 1_000)))
  }
}
