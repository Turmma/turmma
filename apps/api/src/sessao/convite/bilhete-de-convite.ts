import { EMISSOR_TOKEN, systemClock, type Clock } from '@educa/nucleo'
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
export const TIPO_BILHETE = 'convite+jwt'
export const AUDIENCIA_BILHETE = 'sessao'
/** A pessoa aceita o link e entra logo em seguida: meia hora cobre o caminho, e o bilhete não vira porta dias depois. */
export const VALIDADE_BILHETE_SEGUNDOS = 30 * 60

export interface BilheteVerificado {
  readonly contaId: string
  readonly conviteId: string
}

const esquemaClaims = z.object({ conta_id: z.uuid(), convite_id: z.uuid() })

export class BilheteDeConvite {
  constructor(
    private readonly chaveAssinatura: Uint8Array,
    private readonly relogio: Clock = systemClock,
  ) {}

  /** Leva só a conta e o convite, nunca nada da pessoa (regra 20). */
  async emitir(bilhete: BilheteVerificado): Promise<string> {
    const emitidoEm = Math.floor(this.relogio.agora().getTime() / 1_000)
    return new SignJWT({ conta_id: bilhete.contaId, convite_id: bilhete.conviteId })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_BILHETE })
      .setIssuer(EMISSOR_TOKEN)
      .setAudience(AUDIENCIA_BILHETE)
      .setIssuedAt(emitidoEm)
      .setExpirationTime(emitidoEm + VALIDADE_BILHETE_SEGUNDOS)
      .sign(this.chaveAssinatura)
  }

  /**
   * O bilhete conferido (assinatura, `typ`, `aud`, prazo), ou `undefined` quando não vale: o login segue como se ele não
   * tivesse vindo, sem dizer por quê.
   */
  async verificar(bilhete: string): Promise<BilheteVerificado | undefined> {
    let claims: unknown
    try {
      const verificado = await jwtVerify(bilhete, this.chaveAssinatura, {
        algorithms: ['HS256'],
        typ: TIPO_BILHETE,
        issuer: EMISSOR_TOKEN,
        audience: AUDIENCIA_BILHETE,
        requiredClaims: ['exp'],
        maxTokenAge: VALIDADE_BILHETE_SEGUNDOS,
        currentDate: this.relogio.agora(),
      })
      claims = verificado.payload
    } catch (erro) {
      if (erro instanceof errors.JOSEError) return undefined
      throw erro
    }
    const resultado = esquemaClaims.safeParse(claims)
    if (!resultado.success) return undefined
    return { contaId: resultado.data.conta_id.toLowerCase(), conviteId: resultado.data.convite_id.toLowerCase() }
  }
}
