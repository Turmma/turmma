import { avisoEspacado, EMISSOR_TOKEN, ErroDeDominio, ProporcaoEmJanela, relogioDoSistema, TIPO_DESAFIO, type Relogio } from '@educa/nucleo'
import { ErrorCode, ETAPAS_COM_DESAFIO, type EtapaComDesafio } from '@educa/shared'
import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { errors, jwtVerify, SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

/**
 * O desafio de login (Tech Spec, seção 4): o JWT que leva a pessoa de uma etapa do login à seguinte, sem sessão.
 * `typ` e `aud` o separam do token de acesso: a guarda de acesso só aceita `typ: JWT` e recusa o desafio, e as rotas
 * de etapa só aceitam `typ: desafio+jwt` com `aud: sessao` e recusam o token de acesso.
 */
export { TIPO_DESAFIO }
export const AUDIENCIA_DESAFIO = 'sessao'
export const VALIDADE_DESAFIO_SEGUNDOS = 5 * 60
/** Prefixo da marca de desafio já usado, no Redis de fila (que não expulsa chave). */
export const PREFIXO_DESAFIO_USADO = 'desafio:usado:'

export interface PedidoDeDesafio {
  readonly contaId: string
  readonly etapa: EtapaComDesafio
  /** Se o segundo fator já foi cumprido nesta entrada: a troca para uma escola em que a pessoa é coordenadora o exige. */
  readonly mfaCumprido: boolean
  /**
   * O convite cujo bilhete veio no login desta conta (7.0): o usuário que espera por ele só é ativado depois do código.
   * Só existe no desafio `mfa`, e só quando o bilhete conferia com a conta.
   */
  readonly conviteId?: string
  /**
   * O usuário escolhido na troca de escola (12.0), quando o destino é a coordenação e o segundo fator ainda falta: o
   * código conclui a entrada direto nele, sem voltar a `escolher`. Só existe no desafio `mfa`.
   */
  readonly destinoUsuarioId?: string
  /**
   * A sessão de e-mail de onde a troca partiu (12.0): ela só é encerrada quando o segundo fator do destino é concluído,
   * e até lá continua valendo. Só existe no desafio `mfa`, junto com o destino.
   */
  readonly origem?: SessaoDeOrigemDaTroca
}

/** A sessão de origem de uma troca de escola: a escola e o id, lidos da sessão verificada, nunca do cliente. */
export interface SessaoDeOrigemDaTroca {
  readonly escolaId: string
  readonly sessaoId: string
}

export interface DesafioVerificado extends PedidoDeDesafio {
  readonly jti: string
  readonly expiraEm: Date
}

const esquemaClaims = z.object({
  jti: z.uuid(),
  exp: z.number().int(),
  conta_id: z.uuid(),
  etapa: z.enum(ETAPAS_COM_DESAFIO),
  mfa_cumprido: z.boolean(),
  convite_id: z.uuid().optional(),
  usuario_id: z.uuid().optional(),
  origem_esc: z.uuid().optional(),
  origem_sid: z.uuid().optional(),
})

/**
 * Emite o desafio de 5 min. Leva só ids, a etapa, o MFA e, no `mfa`, o convite ou o destino e a origem da troca de
 * escola: nada da pessoa (regra 20).
 */
export class EmissorDeDesafio {
  constructor(
    private readonly chaveAssinatura: Uint8Array,
    private readonly relogio: Relogio = relogioDoSistema,
  ) {}

  async emitir(pedido: PedidoDeDesafio): Promise<string> {
    const emitidoEm = Math.floor(this.relogio.agora().getTime() / 1_000)
    const convite = pedido.conviteId === undefined ? {} : { convite_id: pedido.conviteId }
    const destino = pedido.destinoUsuarioId === undefined ? {} : { usuario_id: pedido.destinoUsuarioId }
    const origem = pedido.origem === undefined ? {} : { origem_esc: pedido.origem.escolaId, origem_sid: pedido.origem.sessaoId }
    return new SignJWT({ conta_id: pedido.contaId, etapa: pedido.etapa, mfa_cumprido: pedido.mfaCumprido, ...convite, ...destino, ...origem })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO })
      .setIssuer(EMISSOR_TOKEN)
      .setAudience(AUDIENCIA_DESAFIO)
      .setJti(randomUUID())
      .setIssuedAt(emitidoEm)
      .setExpirationTime(emitidoEm + VALIDADE_DESAFIO_SEGUNDOS)
      .sign(this.chaveAssinatura)
  }
}

/**
 * Confere o desafio para as etapas que a rota aceita. Toda recusa é `NAO_AUTENTICADO`, sem dizer qual parte falhou:
 * token de acesso (`typ: JWT`, sem `aud`), desafio vencido, de outra etapa ou com assinatura que não confere.
 * Não consome o `jti`: quem conclui a etapa chama `ConsumoDeDesafio.consumir`.
 */
export async function verificarDesafio(desafio: string, chaveAssinatura: Uint8Array, etapas: readonly EtapaComDesafio[]): Promise<DesafioVerificado> {
  let claims: unknown
  try {
    const verificado = await jwtVerify(desafio, chaveAssinatura, {
      algorithms: ['HS256'],
      typ: TIPO_DESAFIO,
      issuer: EMISSOR_TOKEN,
      audience: AUDIENCIA_DESAFIO,
      requiredClaims: ['exp', 'jti'],
      maxTokenAge: VALIDADE_DESAFIO_SEGUNDOS,
    })
    claims = verificado.payload
  } catch (erro) {
    if (erro instanceof errors.JOSEError) throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
    throw erro
  }
  const resultado = esquemaClaims.safeParse(claims)
  if (!resultado.success || !etapas.includes(resultado.data.etapa)) throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
  const { jti, exp, conta_id: contaId, etapa, mfa_cumprido: mfaCumprido, convite_id: conviteId, usuario_id: destinoUsuarioId, origem_esc: origemEsc, origem_sid: origemSid } = resultado.data
  // A origem vem inteira ou não vem: metade dela não encerra sessão nenhuma.
  if ((origemEsc === undefined) !== (origemSid === undefined)) throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
  const convite = conviteId === undefined ? {} : { conviteId: conviteId.toLowerCase() }
  const destino = destinoUsuarioId === undefined ? {} : { destinoUsuarioId: destinoUsuarioId.toLowerCase() }
  const origem = origemEsc === undefined || origemSid === undefined ? {} : { origem: { escolaId: origemEsc.toLowerCase(), sessaoId: origemSid.toLowerCase() } }
  return { jti, expiraEm: new Date(exp * 1_000), contaId: contaId.toLowerCase(), etapa, mfaCumprido, ...convite, ...destino, ...origem }
}

/**
 * Marca o desafio como usado, uma vez só: `SET NX` no Redis de fila, com prazo até o desafio vencer. A segunda
 * conclusão da mesma etapa com o mesmo desafio (clique duplo, reenvio, cópia do desafio) é recusada, e as duas nunca
 * passam juntas (regra 80, item 7).
 *
 * Com o Redis fora, recusa: sem a marca, o desafio poderia ser reusado, e quem perde é só quem tem MFA ou mais de uma
 * escola, que entra de novo (Tech Spec, seção 4).
 *
 * **Recusa pelo Redis com rastro** (15.5): a recusa porque o Redis de fila está fora, ou não respondeu no prazo do
 * cliente (`LOGIN_REDIS_PRAZO_MS`: 100 ms em produção e no staging, 2 s em `local`, onde uma resposta mais lenta é da
 * máquina), vai para o log como `login.desafio_sem_redis`, no máximo uma linha a cada 30 s e sem nada da pessoa,
 * e entra em `proporcaoDoSeguro`, que soma no `limite.seguro_ativo`: o coordenador que cai de volta ao login deixa a
 * causa à vista, e o alerta "Seguro de limite ativo" avisa.
 */
export class ConsumoDeDesafio {
  readonly #logger = new Logger('login')
  readonly #proporcaoDoSeguro: ProporcaoEmJanela
  readonly #avisarSemRedis = avisoEspacado(() => this.#logger.warn('login.desafio_sem_redis'))

  /** @param proporcaoDoSeguro só o teste troca, para mover a janela sem esperar 30 s. */
  constructor(
    private readonly cliente: Redis,
    private readonly relogio: Relogio = relogioDoSistema,
    proporcaoDoSeguro = new ProporcaoEmJanela(),
  ) {
    this.#proporcaoDoSeguro = proporcaoDoSeguro
  }

  /** Das conferências e consumos dos últimos 30 s, a proporção recusada porque o Redis de fila não respondeu, de 0 a 1. */
  get proporcaoDoSeguro(): number {
    return this.#proporcaoDoSeguro.valor()
  }

  /**
   * Antes de conferir o fator: recusa o desafio já usado (concluído, ou consumido pelo quinto erro), e recusa também
   * com o Redis fora ou sem resposta, sem esperar: sem a marca, não dá para saber se ele ainda vale. Não consome.
   */
  async conferirLivre(desafio: Pick<DesafioVerificado, 'jti'>): Promise<void> {
    if (this.cliente.status !== 'ready') throw this.#semRedis()
    let usado: number
    try {
      usado = await this.cliente.exists(`${PREFIXO_DESAFIO_USADO}${desafio.jti}`)
    } catch {
      throw this.#semRedis()
    }
    this.#proporcaoDoSeguro.registrar(false)
    if (usado !== 0) throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
  }

  async consumir(desafio: Pick<DesafioVerificado, 'jti' | 'expiraEm'>): Promise<void> {
    const prazoMs = Math.max(1, desafio.expiraEm.getTime() - this.relogio.agora().getTime())
    let marcado: string | null
    try {
      marcado = await this.cliente.set(`${PREFIXO_DESAFIO_USADO}${desafio.jti}`, '1', 'PX', prazoMs, 'NX')
    } catch {
      throw this.#semRedis()
    }
    this.#proporcaoDoSeguro.registrar(false)
    if (marcado !== 'OK') throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
  }

  /** A recusa porque o Redis de fila não respondeu: a mesma resposta ao cliente, com rastro para quem opera. */
  #semRedis(): ErroDeDominio {
    this.#proporcaoDoSeguro.registrar(true)
    this.#avisarSemRedis()
    return new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
  }
}
