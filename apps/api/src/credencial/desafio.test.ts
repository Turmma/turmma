import { EmissorDeToken, ErroDeDominio, verificarToken } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AUDIENCIA_DESAFIO, EmissorDeDesafio, TIPO_DESAFIO, VALIDADE_DESAFIO_SEGUNDOS, verificarDesafio } from './desafio.js'

const CHAVE = new TextEncoder().encode('chave-de-teste-da-assinatura-com-32-bytes')
const CONTA = '0190f5a0-0000-7000-8000-0000000000c1'

async function recusado(promessa: Promise<unknown>): Promise<void> {
  await expect(promessa).rejects.toBeInstanceOf(ErroDeDominio)
  await expect(promessa).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
}

describe('desafio de login', () => {
  it('leva typ desafio+jwt, aud sessao, jti, conta, etapa e MFA, vence em 5 min, e nada da pessoa', async () => {
    const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'escolher', mfaCumprido: false })
    expect(decodeProtectedHeader(desafio)).toEqual({ alg: 'HS256', typ: TIPO_DESAFIO })
    const claims = decodeJwt(desafio)
    expect(Object.keys(claims).sort()).toEqual(['aud', 'conta_id', 'etapa', 'exp', 'iat', 'iss', 'jti', 'mfa_cumprido'])
    expect(claims).toMatchObject({ aud: AUDIENCIA_DESAFIO, conta_id: CONTA, etapa: 'escolher', mfa_cumprido: false })
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(VALIDADE_DESAFIO_SEGUNDOS)
    const verificado = await verificarDesafio(desafio, CHAVE, ['escolher'])
    expect(verificado).toMatchObject({ contaId: CONTA, etapa: 'escolher', mfaCumprido: false, jti: claims.jti })
  })

  it('o desafio mfa do convite (7.0) leva o id do convite, e ele volta na verificação; sem convite, a claim não existe', async () => {
    const conviteId = randomUUID()
    const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false, conviteId })
    expect(decodeJwt(desafio)['convite_id']).toBe(conviteId)
    expect(await verificarDesafio(desafio, CHAVE, ['mfa'])).toMatchObject({ contaId: CONTA, etapa: 'mfa', conviteId })
    const semConvite = await verificarDesafio(await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false }), CHAVE, ['mfa'])
    expect(semConvite).not.toHaveProperty('conviteId')
  })

  it('o desafio mfa da troca de escola (12.0) leva o destino e a sessão de origem, e os dois voltam na verificação', async () => {
    const destinoUsuarioId = randomUUID()
    const origem = { escolaId: randomUUID(), sessaoId: randomUUID() }
    const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false, destinoUsuarioId, origem })
    expect(decodeJwt(desafio)).toMatchObject({ usuario_id: destinoUsuarioId, origem_esc: origem.escolaId, origem_sid: origem.sessaoId })
    expect(await verificarDesafio(desafio, CHAVE, ['mfa'])).toMatchObject({ destinoUsuarioId, origem })
    const semOrigem = await verificarDesafio(await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false, destinoUsuarioId }), CHAVE, ['mfa'])
    expect(semOrigem).not.toHaveProperty('origem')
    expect(semOrigem.destinoUsuarioId).toBe(destinoUsuarioId)
  })

  it('borda: desafio assinado com só metade da origem (escola sem sessão) é recusado', async () => {
    const metade = await new SignJWT({ conta_id: CONTA, etapa: 'mfa', mfa_cumprido: false, usuario_id: randomUUID(), origem_esc: randomUUID() })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO })
      .setIssuer('educa')
      .setAudience(AUDIENCIA_DESAFIO)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(CHAVE)
    await recusado(verificarDesafio(metade, CHAVE, ['mfa']))
  })

  it('permissão: o desafio não serve de token de acesso (a guarda recusa o typ)', async () => {
    const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    await recusado(verificarToken(desafio, { ambiente: 'local', chaveAssinatura: CHAVE }))
  })

  it('permissão: o token de acesso não serve de desafio (sem typ nem aud de desafio)', async () => {
    const { token } = await new EmissorDeToken(CHAVE).emitir({ escolaId: randomUUID(), usuarioId: randomUUID(), sessaoId: randomUUID() })
    await recusado(verificarDesafio(token, CHAVE, ['escolher', 'mfa', 'configurar_mfa']))
  })

  it('permissão: o desafio de uma etapa não vale em outra', async () => {
    const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'configurar_mfa', mfaCumprido: false })
    await recusado(verificarDesafio(desafio, CHAVE, ['mfa']))
  })

  it('borda: vencido, com outra chave, ou com typ certo e sem aud, é recusado', async () => {
    const antigo = await new EmissorDeDesafio(CHAVE, { agora: () => new Date(Date.now() - (VALIDADE_DESAFIO_SEGUNDOS + 1) * 1_000) }).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    await recusado(verificarDesafio(antigo, CHAVE, ['mfa']))
    const deOutraChave = await new EmissorDeDesafio(new TextEncoder().encode('outra-chave-de-teste-com-32-bytes-xx')).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    await recusado(verificarDesafio(deOutraChave, CHAVE, ['mfa']))
    const semAudiencia = await new SignJWT({ conta_id: CONTA, etapa: 'mfa', mfa_cumprido: false })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO })
      .setIssuer('educa')
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(CHAVE)
    await recusado(verificarDesafio(semAudiencia, CHAVE, ['mfa']))
  })
})
