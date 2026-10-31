import { TokenIssuer, verifyToken } from '@educa/core'
import { decodeJwt, decodeProtectedHeader } from 'jose'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AUDIENCIA_BILHETE, BilheteDeConvite, TIPO_BILHETE, VALIDADE_BILHETE_SEGUNDOS } from './bilhete-de-convite.js'
import { EmissorDeDesafio, verificarDesafio } from '../../credencial/desafio.js'

const CHAVE = new TextEncoder().encode('chave-de-teste-da-assinatura-com-32-bytes')
const CONTA = '0190f5a0-0000-7000-8000-0000000000c1'
const CONVITE = '0190f5a0-0000-7000-8000-0000000000d1'

describe('bilhete do convite aceito por conta que já tem senha', () => {
  it('leva typ convite+jwt, aud sessao, a conta e o convite, vence em 30 min, e nada da pessoa', async () => {
    const bilhete = await new BilheteDeConvite(CHAVE).emitir({ contaId: CONTA, conviteId: CONVITE })
    expect(decodeProtectedHeader(bilhete)).toEqual({ alg: 'HS256', typ: TIPO_BILHETE })
    const claims = decodeJwt(bilhete)
    expect(Object.keys(claims).sort()).toEqual(['aud', 'conta_id', 'convite_id', 'exp', 'iat', 'iss'])
    expect(claims).toMatchObject({ aud: AUDIENCIA_BILHETE, conta_id: CONTA, convite_id: CONVITE })
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(VALIDADE_BILHETE_SEGUNDOS)
    expect(await new BilheteDeConvite(CHAVE).verificar(bilhete)).toEqual({ contaId: CONTA, conviteId: CONVITE })
  })

  it('borda: 30 min e 1 s depois de emitido, de outra chave, ou quebrado, não vale, sem erro', async () => {
    const emitidoEm = new Date('2026-09-18T10:00:00Z')
    const bilhete = await new BilheteDeConvite(CHAVE, { agora: () => emitidoEm }).emitir({ contaId: CONTA, conviteId: CONVITE })
    const aos = (segundos: number) => new BilheteDeConvite(CHAVE, { agora: () => new Date(emitidoEm.getTime() + segundos * 1_000) })
    expect(await aos(VALIDADE_BILHETE_SEGUNDOS - 1).verificar(bilhete)).toEqual({ contaId: CONTA, conviteId: CONVITE })
    expect(await aos(VALIDADE_BILHETE_SEGUNDOS + 1).verificar(bilhete)).toBeUndefined()
    expect(await new BilheteDeConvite(new TextEncoder().encode('outra-chave-de-teste-com-32-bytes-xx')).verificar(await aos(0).emitir({ contaId: CONTA, conviteId: CONVITE }))).toBeUndefined()
    expect(await new BilheteDeConvite(CHAVE).verificar('nao-e-um-jwt')).toBeUndefined()
  })

  it('permissão: o desafio e o token de acesso não servem de bilhete, e o bilhete não serve de desafio nem de token de acesso', async () => {
    const bilhetes = new BilheteDeConvite(CHAVE)
    const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false })
    const { token } = await new TokenIssuer(CHAVE).emitir({ escolaId: randomUUID(), usuarioId: randomUUID(), sessaoId: randomUUID() })
    expect(await bilhetes.verificar(desafio)).toBeUndefined()
    expect(await bilhetes.verificar(token)).toBeUndefined()
    const bilhete = await bilhetes.emitir({ contaId: CONTA, conviteId: CONVITE })
    await expect(verificarDesafio(bilhete, CHAVE, ['mfa', 'escolher', 'configurar_mfa'])).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' })
    await expect(verifyToken(bilhete, { ambiente: 'local', chaveAssinatura: CHAVE })).rejects.toMatchObject({ codigo: 'NAO_AUTENTICADO' })
  })
})
