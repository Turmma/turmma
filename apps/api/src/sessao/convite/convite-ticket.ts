import { EMISSOR_TOKEN, systemClock, type Clock } from '@educa/core'
import { errors, jwtVerify, SignJWT } from 'jose'
import { z } from 'zod'

/**
 * O bilhete do convite aceito por conta que já tem senha (7.0): o JWT que liga o link aceito ao login seguinte. Sem ele,
 * o login rotineiro da conta dona do e-mail nunca ativa o usuário que espera o convite: se o operador digitou o e-mail
 * de outra pessoa, quem aceitou o link (a pessoa certa) não tem a senha dessa conta, e a dona da conta não tem o
 * bilhete.
 *
 * `typ` e `aud` o separam do token de acesso e do desafio: a guarda de acesso só aceita `typ: JWT`, as rotas de etapa
 * só `desafio+jwt`, e este só vale no corpo do login por e-mail.
 */
export const TICKET_TYPE = 'convite+jwt'
export const TICKET_AUDIENCE = 'sessao'
/** A pessoa aceita o link e entra logo em seguida: meia hora cobre o caminho, e o bilhete não vira porta dias depois. */
export const TICKET_TTL_SECONDS = 30 * 60

export interface VerifiedConviteTicket {
  readonly contaId: string
  readonly conviteId: string
}

const claimsSchema = z.object({ conta_id: z.uuid(), convite_id: z.uuid() })

export class ConviteTicket {
  constructor(
    private readonly chaveAssinatura: Uint8Array,
    private readonly relogio: Clock = systemClock,
  ) {}

  /** Leva só a conta e o convite, nunca nada da pessoa (regra 20). */
  async emitir(bilhete: VerifiedConviteTicket): Promise<string> {
    const emitidoEm = Math.floor(this.relogio.agora().getTime() / 1_000)
    return new SignJWT({ conta_id: bilhete.contaId, convite_id: bilhete.conviteId })
      .setProtectedHeader({ alg: 'HS256', typ: TICKET_TYPE })
      .setIssuer(EMISSOR_TOKEN)
      .setAudience(TICKET_AUDIENCE)
      .setIssuedAt(emitidoEm)
      .setExpirationTime(emitidoEm + TICKET_TTL_SECONDS)
      .sign(this.chaveAssinatura)
  }

  /**
   * O bilhete conferido (assinatura, `typ`, `aud`, prazo), ou `undefined` quando não vale: o login segue como se ele não
   * tivesse vindo, sem dizer por quê.
   */
  async verificar(bilhete: string): Promise<VerifiedConviteTicket | undefined> {
    let claims: unknown
    try {
      const verificado = await jwtVerify(bilhete, this.chaveAssinatura, {
        algorithms: ['HS256'],
        typ: TICKET_TYPE,
        issuer: EMISSOR_TOKEN,
        audience: TICKET_AUDIENCE,
        requiredClaims: ['exp'],
        maxTokenAge: TICKET_TTL_SECONDS,
        currentDate: this.relogio.agora(),
      })
      claims = verificado.payload
    } catch (erro) {
      if (erro instanceof errors.JOSEError) return undefined
      throw erro
    }
    const resultado = claimsSchema.safeParse(claims)
    if (!resultado.success) return undefined
    return { contaId: resultado.data.conta_id.toLowerCase(), conviteId: resultado.data.convite_id.toLowerCase() }
  }
}
