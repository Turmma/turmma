import { FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS, TokenIssuer, DomainException, verifyToken } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CHALLENGE_AUDIENCE, ChallengeIssuer, TIPO_DESAFIO, CHALLENGE_TTL_SECONDS, verifyChallenge } from './challenge.js'

const CHAVE = new TextEncoder().encode('chave-de-teste-da-assinatura-com-32-bytes')
const CONTA = '0190f5a0-0000-7000-8000-0000000000c1'

async function recusado(promessa: Promise<unknown>): Promise<void> {
  await expect(promessa).rejects.toBeInstanceOf(DomainException)
  await expect(promessa).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
}

describe('desafio de login', () => {
  it('leva typ desafio+jwt, aud sessao, jti, conta, etapa e MFA, vence em 5 min, e nada da pessoa', async () => {
    const desafio = await new ChallengeIssuer(CHAVE).emitir({ contaId: CONTA, etapa: 'escolher', mfaCumprido: false })
    expect(decodeProtectedHeader(desafio)).toEqual({ alg: 'HS256', typ: TIPO_DESAFIO })
    const claims = decodeJwt(desafio)
    expect(Object.keys(claims).sort()).toEqual(['aud', 'conta_id', 'etapa', 'exp', 'iat', 'iss', 'jti', 'mfa_cumprido'])
    expect(claims).toMatchObject({ aud: CHALLENGE_AUDIENCE, conta_id: CONTA, etapa: 'escolher', mfa_cumprido: false })
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(CHALLENGE_TTL_SECONDS)
    const verificado = await verifyChallenge(desafio, CHAVE, ['escolher'])
    expect(verificado).toMatchObject({ contaId: CONTA, etapa: 'escolher', mfaCumprido: false, jti: claims.jti })
  })

  it('o desafio mfa do convite (7.0) leva o id do convite, e ele volta na verificação; sem convite, a claim não existe', async () => {
    const conviteId = randomUUID()
    const desafio = await new ChallengeIssuer(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false, conviteId })
    expect(decodeJwt(desafio)['convite_id']).toBe(conviteId)
    expect(await verifyChallenge(desafio, CHAVE, ['mfa'])).toMatchObject({ contaId: CONTA, etapa: 'mfa', conviteId })
    const semConvite = await verifyChallenge(await new ChallengeIssuer(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false }), CHAVE, ['mfa'])
    expect(semConvite).not.toHaveProperty('conviteId')
  })

  it('o desafio mfa da troca de escola (12.0) leva o destino e a sessão de origem, e os dois voltam na verificação', async () => {
    const destinoUsuarioId = randomUUID()
    const origem = { escolaId: randomUUID(), sessaoId: randomUUID() }
    const desafio = await new ChallengeIssuer(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false, destinoUsuarioId, origem })
    expect(decodeJwt(desafio)).toMatchObject({ usuario_id: destinoUsuarioId, origem_esc: origem.escolaId, origem_sid: origem.sessaoId })
    expect(await verifyChallenge(desafio, CHAVE, ['mfa'])).toMatchObject({ destinoUsuarioId, origem })
    const semOrigem = await verifyChallenge(await new ChallengeIssuer(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false, destinoUsuarioId }), CHAVE, ['mfa'])
    expect(semOrigem).not.toHaveProperty('origem')
    expect(semOrigem.destinoUsuarioId).toBe(destinoUsuarioId)
  })

  it('borda: desafio assinado com só metade da origem (escola sem sessão) é recusado', async () => {
    const metade = await new SignJWT({ conta_id: CONTA, etapa: 'mfa', mfa_cumprido: false, usuario_id: randomUUID(), origem_esc: randomUUID() })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO })
      .setIssuer('educa')
      .setAudience(CHALLENGE_AUDIENCE)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(CHAVE)
    await recusado(verifyChallenge(metade, CHAVE, ['mfa']))
  })

  it('permissão: o desafio não serve de token de acesso (a guarda recusa o typ)', async () => {
    const desafio = await new ChallengeIssuer(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    await recusado(verifyToken(desafio, { ambiente: 'local', chaveAssinatura: CHAVE }))
  })

  it('permissão: o token de acesso não serve de desafio (sem typ nem aud de desafio)', async () => {
    const { token } = await new TokenIssuer(CHAVE).emitir({ escolaId: randomUUID(), usuarioId: randomUUID(), sessaoId: randomUUID() })
    await recusado(verifyChallenge(token, CHAVE, ['escolher', 'mfa', 'configurar_mfa']))
  })

  it('permissão: o desafio de uma etapa não vale em outra', async () => {
    const desafio = await new ChallengeIssuer(CHAVE).emitir({ contaId: CONTA, etapa: 'configurar_mfa', mfaCumprido: false })
    await recusado(verifyChallenge(desafio, CHAVE, ['mfa']))
  })

  it('folga de relógio: o iat à frente de quem confere passa até a folga, que cobre a outra instância e o relógio que recua, e é recusado além dela; o prazo segue exato', async () => {
    const emitidoComRelogio = (deslocamentoSegundos: number) =>
      new ChallengeIssuer(CHAVE, { agora: () => new Date(Date.now() + deslocamentoSegundos * 1_000) }).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    // Na folga passa; os até 2 s do portão da 4.0 estão dentro dela. A borda exata (10 s) fica em `verify-token.test.ts`, que não lê o relógio:
    // aqui o `verifyChallenge` lê o `new Date()` por dentro, e um relógio que recua entre emitir e conferir derrubaria o caso na borda.
    await expect(verifyChallenge(await emitidoComRelogio(3), CHAVE, ['mfa'])).resolves.toMatchObject({ contaId: CONTA, etapa: 'mfa' })
    await expect(verifyChallenge(await emitidoComRelogio(FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS - 2), CHAVE, ['mfa'])).resolves.toMatchObject({ contaId: CONTA })
    // Além dela (2 s a mais, para a virada do segundo entre emitir e conferir não encostar na borda), a recusa de sempre.
    await expect(verifyChallenge(await emitidoComRelogio(FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS + 2), CHAVE, ['mfa'])).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    // O prazo não ganha folga: o de 5 min + 1 s atrás vence, e o que ainda tem 10 s de vida passa.
    await recusado(verifyChallenge(await emitidoComRelogio(-(CHALLENGE_TTL_SECONDS + 1)), CHAVE, ['mfa']))
    await expect(verifyChallenge(await emitidoComRelogio(-(CHALLENGE_TTL_SECONDS - 10)), CHAVE, ['mfa'])).resolves.toMatchObject({ contaId: CONTA })
  })

  it('borda: o desafio sem iat, ou com a validade maior que o prazo do desafio, é recusado', async () => {
    const assinado = (iat: number | undefined, exp: number) => {
      const jwt = new SignJWT({ conta_id: CONTA, etapa: 'mfa', mfa_cumprido: false })
        .setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO })
        .setIssuer('educa')
        .setAudience(CHALLENGE_AUDIENCE)
        .setJti(randomUUID())
        .setExpirationTime(exp)
      return (iat === undefined ? jwt : jwt.setIssuedAt(iat)).sign(CHAVE)
    }
    const agora = Math.floor(Date.now() / 1_000)
    await expect(verifyChallenge(await assinado(agora, agora + CHALLENGE_TTL_SECONDS), CHAVE, ['mfa'])).resolves.toMatchObject({ contaId: CONTA })
    await recusado(verifyChallenge(await assinado(undefined, agora + CHALLENGE_TTL_SECONDS), CHAVE, ['mfa']))
    // Emitido há 6 min com `exp` de um dia: o `exp` sozinho o deixaria passar, a idade não.
    await recusado(verifyChallenge(await assinado(agora - (CHALLENGE_TTL_SECONDS + 60), agora + 24 * 60 * 60), CHAVE, ['mfa']))
  })

  it('borda: vencido, com outra chave, ou com typ certo e sem aud, é recusado', async () => {
    const antigo = await new ChallengeIssuer(CHAVE, { agora: () => new Date(Date.now() - (CHALLENGE_TTL_SECONDS + 1) * 1_000) }).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    await recusado(verifyChallenge(antigo, CHAVE, ['mfa']))
    const deOutraChave = await new ChallengeIssuer(new TextEncoder().encode('outra-chave-de-teste-com-32-bytes-xx')).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    await recusado(verifyChallenge(deOutraChave, CHAVE, ['mfa']))
    const semAudiencia = await new SignJWT({ conta_id: CONTA, etapa: 'mfa', mfa_cumprido: false })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO })
      .setIssuer('educa')
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(CHAVE)
    await recusado(verifyChallenge(semAudiencia, CHAVE, ['mfa']))
  })
})
