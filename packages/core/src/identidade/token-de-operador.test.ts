import { ErrorCode } from '@educa/shared'
import { decodeJwt, decodeProtectedHeader, SignJWT, type JWTPayload } from 'jose'
import { describe, expect, it } from 'vitest'
import { EMISSOR_TOKEN, type AuthConfig } from '../config/validate-config.js'
import { DomainException } from '../error/domain.exception.js'
import { TokenIssuer, OperadorTokenIssuer, VALIDADE_TOKEN_ACESSO_SEGUNDOS } from './token-issuer.js'
import { operadorBearer, COOKIE_SESSAO_DE_OPERADOR, operadorCookie, TIPO_DESAFIO, TIPO_DESAFIO_DE_OPERADOR, TIPO_TOKEN_DE_OPERADOR, VALIDADE_MAXIMA_TOKEN_SEGUNDOS, verifyToken, verifyOperadorToken } from './verify-token.js'

const OPERADOR = '0190f5a0-0000-7000-8000-0000000000e1'
const SESSAO = '0190f5a0-0000-7000-8000-0000000000f1'
const ESCOLA = '0190f5a0-0000-7000-8000-00000000000a'
const codificar = (texto: string) => new TextEncoder().encode(texto)
const CHAVE = codificar('chave_sintetica_de_teste_com_32_caracteres')
const OUTRA_CHAVE = codificar('outra_chave_sintetica_com_32_caracteres')
const config: AuthConfig = { ambiente: 'local', chaveAssinatura: CHAVE }
const agora = () => Math.floor(Date.now() / 1000)

interface TokenOptions {
  claims?: JWTPayload
  semClaims?: string[]
  chave?: Uint8Array
  typ?: string
}

async function assinar(opcoes: TokenOptions = {}): Promise<string> {
  const todas: JWTPayload = { sub: OPERADOR, sid: SESSAO, iss: EMISSOR_TOKEN, iat: agora(), exp: agora() + 600, ...opcoes.claims }
  const claims = Object.fromEntries(Object.entries(todas).filter(([claim]) => !(opcoes.semClaims ?? []).includes(claim)))
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256', typ: opcoes.typ ?? TIPO_TOKEN_DE_OPERADOR }).sign(opcoes.chave ?? CHAVE)
}

async function recusa(promessa: Promise<unknown>): Promise<DomainException> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof DomainException) return erro
    throw erro
  }
  throw new Error('o token deveria ter sido recusado')
}

describe('EmissorDeTokenDeOperador', () => {
  it('emite JWT HS256 de 10 min, typ operador+jwt, emissor educa, com sub e sid e sem esc', async () => {
    const emitidoEm = new Date('2026-09-23T13:00:00Z')
    const { token, expiraEm } = await new OperadorTokenIssuer(CHAVE).emitir({ operadorId: OPERADOR, sessaoId: SESSAO }, emitidoEm)
    expect(decodeProtectedHeader(token)).toStrictEqual({ alg: 'HS256', typ: TIPO_TOKEN_DE_OPERADOR })
    const iat = emitidoEm.getTime() / 1000
    expect(decodeJwt(token)).toStrictEqual({ sub: OPERADOR, sid: SESSAO, iss: EMISSOR_TOKEN, iat, exp: iat + VALIDADE_TOKEN_ACESSO_SEGUNDOS })
    expect(expiraEm).toEqual(new Date((iat + VALIDADE_TOKEN_ACESSO_SEGUNDOS) * 1000))
  })
})

describe('verificarTokenDeOperador', () => {
  it('devolve o operador e a sessão do token do emissor, sem vencer, e nada além disso', async () => {
    const { token } = await new OperadorTokenIssuer(CHAVE).emitir({ operadorId: OPERADOR, sessaoId: SESSAO })
    expect(await verifyOperadorToken(token, config)).toStrictEqual({ operadorId: OPERADOR, sessaoId: SESSAO, vencido: false })
  })

  it('o token com o prazo vencido, e todo o resto certo, volta como vencido, e não recusado', async () => {
    const { token } = await new OperadorTokenIssuer(CHAVE, { agora: () => new Date(Date.now() - 11 * 60_000) }).emitir({ operadorId: OPERADOR, sessaoId: SESSAO })
    expect(await verifyOperadorToken(token, config)).toStrictEqual({ operadorId: OPERADOR, sessaoId: SESSAO, vencido: true })
  })

  it('vencido não esconde outra falha: o token vencido com outra chave, outro emissor, outro typ ou esc é recusado', async () => {
    const vencido = { iat: agora() - 7200, exp: agora() - 60 }
    for (const opcoes of [{ chave: OUTRA_CHAVE }, { claims: { iss: 'login-real' } }, { typ: 'JWT' }, { claims: { esc: ESCOLA } }, { claims: { sid: 'sessao-1' } }] satisfies TokenOptions[]) {
      const token = await assinar({ ...opcoes, claims: { ...vencido, ...opcoes.claims } })
      expect(await recusa(verifyOperadorToken(token, config)), JSON.stringify(opcoes)).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    }
  })

  const recusados: Array<[string, () => Promise<string>]> = [
    ['o token de acesso da escola (typ JWT, com esc)', async () => (await new TokenIssuer(CHAVE).emitir({ escolaId: ESCOLA, usuarioId: OPERADOR, sessaoId: SESSAO })).token],
    ['o typ da escola, mesmo sem esc', () => assinar({ typ: 'JWT' })],
    ['o desafio de login', () => assinar({ typ: 'desafio+jwt' })],
    ['typ de operador com esc', () => assinar({ claims: { esc: ESCOLA } })],
    ['assinatura com outra chave', () => assinar({ chave: OUTRA_CHAVE })],
    ['emissor não aceito', () => assinar({ claims: { iss: 'login-real' } })],
    ['sem exp', () => assinar({ semClaims: ['exp'] })],
    ['sem sid', () => assinar({ semClaims: ['sid'] })],
    ['sub fora do formato UUID', () => assinar({ claims: { sub: 'ana-ops' } })],
    ['validade além de 24 horas', () => assinar({ claims: { exp: agora() + VALIDADE_MAXIMA_TOKEN_SEGUNDOS + 120 } })],
  ]

  it.each(recusados)('recusa %s com NAO_AUTENTICADO', async (_caso, gerar) => {
    expect(await recusa(verifyOperadorToken(await gerar(), config))).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO, status: 401 })
  })

  it('o verificarToken da escola recusa o token de operador pelo typ, com a mesma chave', async () => {
    const { token } = await new OperadorTokenIssuer(CHAVE).emitir({ operadorId: OPERADOR, sessaoId: SESSAO })
    expect(await recusa(verifyToken(token, config))).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
  })
})

describe('bearerDeOperador', () => {
  it('só lê o typ do cabeçalho do JWT, sem verificar a assinatura', async () => {
    expect(operadorBearer(`Bearer ${await assinar({ chave: OUTRA_CHAVE })}`)).toBe(true)
    expect(operadorBearer(`Bearer ${await assinar({ typ: 'JWT' })}`)).toBe(false)
    // O desafio do operador também é da operação (C21): numa rota de escola, igual a uma rota inexistente.
    expect(operadorBearer(`Bearer ${await assinar({ typ: TIPO_DESAFIO_DE_OPERADOR })}`)).toBe(true)
    // O desafio de login da escola não é: segue o caminho dele.
    expect(operadorBearer(`Bearer ${await assinar({ typ: TIPO_DESAFIO })}`)).toBe(false)
    expect(operadorBearer('Bearer a.b.c')).toBe(false)
    expect(operadorBearer(undefined)).toBe(false)
  })
})

describe('cookieDeOperador (tarefa 7.0)', () => {
  it('reconhece o cookie de sessão do operador pelo nome, em qualquer posição, e só ele', () => {
    expect(COOKIE_SESSAO_DE_OPERADOR).toBe('turmma_operacao')
    expect(operadorCookie('turmma_operacao=abc')).toBe(true)
    expect(operadorCookie('educa_dispositivo=x; turmma_operacao=abc')).toBe(true)
    expect(operadorCookie(' turmma_operacao =abc')).toBe(true)
    // O de dispositivo do operador não é credencial, e o da escola segue o caminho dele.
    expect(operadorCookie('turmma_operacao_dispositivo=abc')).toBe(false)
    expect(operadorCookie('educa_sessao=abc; xturmma_operacao=abc')).toBe(false)
    expect(operadorCookie('turmma_operacao')).toBe(false)
    expect(operadorCookie(undefined)).toBe(false)
  })
})
