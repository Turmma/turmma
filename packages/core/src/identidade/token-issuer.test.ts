import { ErrorCode } from '@educa/shared'
import { decodeJwt, decodeProtectedHeader } from 'jose'
import { describe, expect, it } from 'vitest'
import { EMISSOR_TOKEN, type AuthConfig } from '../config/validate-config.js'
import { TokenIssuer, VALIDADE_TOKEN_ACESSO_SEGUNDOS } from './token-issuer.js'
import { verifyToken } from './verify-token.js'

const CHAVE = new TextEncoder().encode('chave_sintetica_de_teste_com_32_caracteres')
const pedido = {
  escolaId: '0190f5a0-0000-7000-8000-00000000000a',
  usuarioId: '0190f5a0-0000-7000-8000-0000000000a1',
  sessaoId: '0190f5a0-0000-7000-8000-0000000000d1',
}
const config: AuthConfig = { ambiente: 'local', chaveAssinatura: CHAVE }

describe('EmissorDeToken', () => {
  it('emite JWT HS256 de 10 min, typ JWT, emissor educa, só com sub, esc, sid, iat e exp', async () => {
    const agora = new Date('2026-09-15T10:00:00-03:00')
    const { token, expiraEm } = await new TokenIssuer(CHAVE, { agora: () => agora }).emitir(pedido)
    const emitidoEm = agora.getTime() / 1000
    expect(decodeProtectedHeader(token)).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(decodeJwt(token)).toEqual({
      sub: pedido.usuarioId,
      esc: pedido.escolaId,
      sid: pedido.sessaoId,
      iss: EMISSOR_TOKEN,
      iat: emitidoEm,
      exp: emitidoEm + VALIDADE_TOKEN_ACESSO_SEGUNDOS,
    })
    expect(VALIDADE_TOKEN_ACESSO_SEGUNDOS).toBe(600)
    expect(expiraEm).toEqual(new Date(agora.getTime() + 600_000))
  })

  it('a verificação da API aceita o token emitido e devolve a escola, o usuário, a sessão pedidos e o iat', async () => {
    const { token } = await new TokenIssuer(CHAVE).emitir(pedido)
    expect(await verifyToken(token, config)).toEqual({ ...pedido, emitidoEm: decodeJwt(token).iat })
  })

  it('com o instante pedido, o iat e o exp saem dele e não do relógio: a renovação emite o token no segundo depois da rotação', async () => {
    const depoisDaRotacao = new Date((Math.floor(Date.now() / 1000) + 1) * 1000)
    const relogio = new Date(depoisDaRotacao.getTime() - 300)
    const { token, expiraEm } = await new TokenIssuer(CHAVE, { agora: () => relogio }).emitir(pedido, depoisDaRotacao)
    expect(decodeJwt(token)).toMatchObject({ iat: depoisDaRotacao.getTime() / 1000, exp: depoisDaRotacao.getTime() / 1000 + VALIDADE_TOKEN_ACESSO_SEGUNDOS })
    expect(expiraEm).toEqual(new Date(depoisDaRotacao.getTime() + 600_000))
    expect((await verifyToken(token, config)).emitidoEm).toBe(depoisDaRotacao.getTime() / 1000)
  })

  it('passados os 10 min, o token é recusado', async () => {
    const onzeMinutosAtras = new Date(Date.now() - 11 * 60_000)
    const { token } = await new TokenIssuer(CHAVE, { agora: () => onzeMinutosAtras }).emitir(pedido)
    await expect(verifyToken(token, config)).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
  })
})
