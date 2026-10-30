import { throttledWarn, EMISSOR_TOKEN, DomainException, systemClock, DEFAULT_RETRY_AFTER_SECONDS, TIPO_DESAFIO_DE_OPERADOR, type Clock } from '@educa/nucleo'
import { ErrorCode, InvariantException } from '@educa/shared'
import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { errors, jwtVerify, SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

/**
 * O desafio do operador (Tech Spec da A0, seções 4 e 5, "Etapas"): o JWT de 5 min que leva do aceite do convite e da
 * entrada por e-mail ao segundo fator, sem sessão. `typ: desafio-operador+jwt` e `aud: operacao` o separam de tudo o
 * mais: o desafio de login da escola (`desafio+jwt`, `aud: sessao`) não passa aqui, e este não passa lá; como bearer,
 * nenhuma rota o aceita (C21).
 *
 * Leva só o id do operador, a etapa, o `jti` e, no desafio `mfa` que o `configurar` devolve, a versão do segredo que
 * ele gravou (`ver`): a ativação só aceita o código com o segredo daquela versão. O `jti` vale uma vez: a rota da etapa
 * o consome antes de qualquer outra coisa (`ConsumoDeDesafioDeOperador`).
 */
export const AUDIENCIA_DESAFIO_DE_OPERADOR = 'operacao'
export const VALIDADE_DESAFIO_DE_OPERADOR_SEGUNDOS = 5 * 60

/** As etapas do desafio do operador: configurar o segundo fator, ou informar o código. Cada rota aceita só a sua. */
export const ETAPAS_DO_DESAFIO_DE_OPERADOR = ['configurar_mfa', 'mfa'] as const
export type EtapaDoDesafioDeOperador = (typeof ETAPAS_DO_DESAFIO_DE_OPERADOR)[number]

export interface PedidoDeDesafioDeOperador {
  readonly operadorId: string
  readonly etapa: EtapaDoDesafioDeOperador
  /**
   * Só no desafio `mfa` que o `configurar` devolve: o `mfa_versao` do segredo gravado. O `mfa` da entrada por e-mail
   * (segundo fator já ativo) não leva versão.
   */
  readonly versao?: number
}

export interface DesafioDeOperadorVerificado extends PedidoDeDesafioDeOperador {
  readonly jti: string
  readonly expiraEm: Date
}

const esquemaClaims = z.object({
  jti: z.uuid(),
  exp: z.number().int(),
  sub: z.uuid(),
  etapa: z.enum(ETAPAS_DO_DESAFIO_DE_OPERADOR),
  ver: z.number().int().positive().optional(),
})

export class EmissorDeDesafioDeOperador {
  constructor(
    private readonly chaveAssinatura: Uint8Array,
    private readonly relogio: Clock = systemClock,
  ) {}

  async emitir(pedido: PedidoDeDesafioDeOperador): Promise<string> {
    const emitidoEm = Math.floor(this.relogio.agora().getTime() / 1_000)
    if (pedido.versao !== undefined && pedido.etapa !== 'mfa') throw new InvariantException('só o desafio mfa leva a versão do segredo')
    return new SignJWT({ etapa: pedido.etapa, ...(pedido.versao === undefined ? {} : { ver: pedido.versao }) })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO_DE_OPERADOR })
      .setIssuer(EMISSOR_TOKEN)
      .setAudience(AUDIENCIA_DESAFIO_DE_OPERADOR)
      .setSubject(pedido.operadorId)
      .setJti(randomUUID())
      .setIssuedAt(emitidoEm)
      .setExpirationTime(emitidoEm + VALIDADE_DESAFIO_DE_OPERADOR_SEGUNDOS)
      .sign(this.chaveAssinatura)
  }
}

/**
 * Confere o desafio do operador para a etapa da rota. Toda recusa é `NAO_AUTENTICADO`, sem dizer o que falhou: outro
 * `typ` (o token de acesso, o desafio da escola), outra audiência, vencido, de outra etapa ou com assinatura que não
 * confere. Não consome o `jti`: quem conclui a etapa chama `ConsumoDeDesafioDeOperador.consumir`.
 */
export async function verificarDesafioDeOperador(desafio: string, chaveAssinatura: Uint8Array, etapa: EtapaDoDesafioDeOperador): Promise<DesafioDeOperadorVerificado> {
  let claims: unknown
  try {
    const verificado = await jwtVerify(desafio, chaveAssinatura, {
      algorithms: ['HS256'],
      typ: TIPO_DESAFIO_DE_OPERADOR,
      issuer: EMISSOR_TOKEN,
      audience: AUDIENCIA_DESAFIO_DE_OPERADOR,
      requiredClaims: ['exp', 'jti', 'sub'],
      maxTokenAge: VALIDADE_DESAFIO_DE_OPERADOR_SEGUNDOS,
    })
    claims = verificado.payload
  } catch (erro) {
    if (erro instanceof errors.JOSEError) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    throw erro
  }
  const resultado = esquemaClaims.safeParse(claims)
  if (!resultado.success || resultado.data.etapa !== etapa) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
  const { jti, exp, sub, ver } = resultado.data
  // A versão só existe no desafio `mfa`: um `configurar_mfa` com versão não saiu do emissor.
  if (ver !== undefined && etapa !== 'mfa') throw new DomainException(ErrorCode.NAO_AUTENTICADO)
  return { jti, expiraEm: new Date(exp * 1_000), operadorId: sub.toLowerCase(), etapa, ...(ver === undefined ? {} : { versao: ver }) }
}

/** Prefixo da marca de desafio de operador já usado, no Redis de fila (que não expulsa chave); separado do da escola. */
export const PREFIXO_DESAFIO_DE_OPERADOR_USADO = 'desafio-op:usado:'

/**
 * Marca o desafio do operador como usado, uma vez só (Tech Spec da A0, seção 5, "Travas no banco", desafio): `SET NX`
 * no Redis de fila, com prazo até o desafio vencer, **antes** da transação e fora dela. Duas conclusões com o mesmo
 * desafio (clique duplo, reenvio, cópia) nunca passam juntas; a segunda recebe `NAO_AUTENTICADO`, a mesma resposta do
 * desafio inválido.
 *
 * Queimado não volta: o desafio consumido por um código errado, por uma versão que não confere ou por um operador
 * desativado no meio não vale de novo, e o operador pede outro (entra de novo com e-mail e senha).
 *
 * **Redis fora ou sem resposta: 503 `INDISPONIVEL_TENTE_DE_NOVO`**, nunca aceito (C13): sem a marca, não dá para saber
 * se o desafio já foi usado. O rastro vai ao log como `operacao.desafio_sem_redis`, no máximo uma linha a cada 30 s e
 * sem nada da pessoa, e o `docs/runbook.md` diz que, com o Redis fora, o caminho do operador é o `ops:*` (tarefa 9.0).
 */
export class ConsumoDeDesafioDeOperador {
  readonly #logger = new Logger('operacao')
  readonly #avisarSemRedis = throttledWarn(() => this.#logger.warn('operacao.desafio_sem_redis'))

  constructor(
    private readonly cliente: Redis,
    private readonly relogio: Clock = systemClock,
  ) {}

  async consumir(desafio: Pick<DesafioDeOperadorVerificado, 'jti' | 'expiraEm'>): Promise<void> {
    if (this.cliente.status !== 'ready') throw this.#semRedis()
    const prazoMs = Math.max(1, desafio.expiraEm.getTime() - this.relogio.agora().getTime())
    let marcado: string | null
    try {
      marcado = await this.cliente.set(`${PREFIXO_DESAFIO_DE_OPERADOR_USADO}${desafio.jti}`, '1', 'PX', prazoMs, 'NX')
    } catch {
      throw this.#semRedis()
    }
    if (marcado !== 'OK') throw new DomainException(ErrorCode.NAO_AUTENTICADO)
  }

  #semRedis(): DomainException {
    this.#avisarSemRedis()
    return new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
  }
}
