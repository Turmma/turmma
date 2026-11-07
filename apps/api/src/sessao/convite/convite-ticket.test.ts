import { EMISSOR_TOKEN, TokenIssuer, verifyToken } from '@educa/core'
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TICKET_AUDIENCE, TICKET_CLOCK_TOLERANCE_SECONDS, ConviteTicket, TICKET_TYPE, TICKET_TTL_SECONDS } from './convite-ticket.js'
import { ChallengeIssuer, verifyChallenge } from '../../credencial/challenge.js'

const CHAVE = new TextEncoder().encode('chave-de-teste-da-assinatura-com-32-bytes')
const CONTA = '0190f5a0-0000-7000-8000-0000000000c1'
const CONVITE = '0190f5a0-0000-7000-8000-0000000000d1'

describe('bilhete do convite aceito por conta que já tem senha', () => {
  it('leva typ convite+jwt, aud sessao, a conta e o convite, vence em 30 min, e nada da pessoa', async () => {
    const bilhete = await new ConviteTicket(CHAVE).emitir({ contaId: CONTA, conviteId: CONVITE })
    expect(decodeProtectedHeader(bilhete)).toEqual({ alg: 'HS256', typ: TICKET_TYPE })
    const claims = decodeJwt(bilhete)
    expect(Object.keys(claims).sort()).toEqual(['aud', 'conta_id', 'convite_id', 'exp', 'iat', 'iss'])
    expect(claims).toMatchObject({ aud: TICKET_AUDIENCE, conta_id: CONTA, convite_id: CONVITE })
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(TICKET_TTL_SECONDS)
    expect(await new ConviteTicket(CHAVE).verificar(bilhete)).toEqual({ contaId: CONTA, conviteId: CONVITE })
  })

  it('borda: 30 min e 1 s depois de emitido, de outra chave, ou quebrado, não vale, sem erro', async () => {
    const emitidoEm = new Date('2026-09-18T10:00:00Z')
    const bilhete = await new ConviteTicket(CHAVE, { agora: () => emitidoEm }).emitir({ contaId: CONTA, conviteId: CONVITE })
    const aos = (segundos: number) => new ConviteTicket(CHAVE, { agora: () => new Date(emitidoEm.getTime() + segundos * 1_000) })
    expect(await aos(TICKET_TTL_SECONDS - 1).verificar(bilhete)).toEqual({ contaId: CONTA, conviteId: CONVITE })
    expect(await aos(TICKET_TTL_SECONDS + 1).verificar(bilhete)).toBeUndefined()
    expect(await new ConviteTicket(new TextEncoder().encode('outra-chave-de-teste-com-32-bytes-xx')).verificar(await aos(0).emitir({ contaId: CONTA, conviteId: CONVITE }))).toBeUndefined()
    expect(await new ConviteTicket(CHAVE).verificar('nao-e-um-jwt')).toBeUndefined()
  })

  it('borda: o relógio que recua depois de emitir não derruba o bilhete, até a folga; o prazo de 30 min segue exato', async () => {
    const emitidoEm = new Date('2026-09-18T10:00:00Z')
    const bilhete = await new ConviteTicket(CHAVE, { agora: () => emitidoEm }).emitir({ contaId: CONTA, conviteId: CONVITE })
    const aos = (segundos: number) => new ConviteTicket(CHAVE, { agora: () => new Date(emitidoEm.getTime() + segundos * 1_000) })
    // O `iat` fica 1 s, e 30 s, à frente do relógio de quem confere: vale. Com 31 s, não.
    expect(await aos(-1).verificar(bilhete)).toEqual({ contaId: CONTA, conviteId: CONVITE })
    expect(await aos(-TICKET_CLOCK_TOLERANCE_SECONDS).verificar(bilhete)).toEqual({ contaId: CONTA, conviteId: CONVITE })
    expect(await aos(-TICKET_CLOCK_TOLERANCE_SECONDS - 1).verificar(bilhete)).toBeUndefined()
    // A folga não alonga o prazo: no segundo do `exp` já não vale, e dentro da folga do `jose` também não.
    expect(await aos(TICKET_TTL_SECONDS).verificar(bilhete)).toBeUndefined()
    expect(await aos(TICKET_TTL_SECONDS + TICKET_CLOCK_TOLERANCE_SECONDS - 1).verificar(bilhete)).toBeUndefined()
  })

  it('borda: bilhete assinado com a nossa chave e um `exp` maior que o prazo vale só até 30 min depois do `iat`', async () => {
    const emitidoEm = new Date('2026-09-18T10:00:00Z')
    const iat = Math.floor(emitidoEm.getTime() / 1_000)
    const longo = await new SignJWT({ conta_id: CONTA, convite_id: CONVITE })
      .setProtectedHeader({ alg: 'HS256', typ: TICKET_TYPE })
      .setIssuer(EMISSOR_TOKEN)
      .setAudience(TICKET_AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 2 * TICKET_TTL_SECONDS)
      .sign(CHAVE)
    const aos = (segundos: number) => new ConviteTicket(CHAVE, { agora: () => new Date(emitidoEm.getTime() + segundos * 1_000) })
    expect(await aos(TICKET_TTL_SECONDS).verificar(longo)).toEqual({ contaId: CONTA, conviteId: CONVITE })
    expect(await aos(TICKET_TTL_SECONDS + 1).verificar(longo)).toBeUndefined()
  })

  it('permissão: o desafio e o token de acesso não servem de bilhete, e o bilhete não serve de desafio nem de token de acesso', async () => {
    const bilhetes = new ConviteTicket(CHAVE)
    const desafio = await new ChallengeIssuer(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    const { token } = await new TokenIssuer(CHAVE).emitir({ escolaId: randomUUID(), usuarioId: randomUUID(), sessaoId: randomUUID() })
    expect(await bilhetes.verificar(desafio)).toBeUndefined()
    expect(await bilhetes.verificar(token)).toBeUndefined()
    const bilhete = await bilhetes.emitir({ contaId: CONTA, conviteId: CONVITE })
    await expect(verifyChallenge(bilhete, CHAVE, ['mfa', 'escolher', 'configurar_mfa'])).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' })
    await expect(verifyToken(bilhete, { ambiente: 'local', chaveAssinatura: CHAVE })).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' })
  })
})
