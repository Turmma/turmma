import { ErrorCode } from '@educa/shared'
import { SignJWT, UnsecuredJWT, type JWTPayload } from 'jose'
import { describe, expect, it } from 'vitest'
import { EMISSOR_TOKEN, type AuthConfig } from '../config/validate-config.js'
import { DomainException } from '../error/domain.exception.js'
import { extractBearerToken, VALIDADE_MAXIMA_TOKEN_SEGUNDOS, verifyToken } from './verify-token.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
const USUARIO = '0190f5a0-0000-7000-8000-0000000000c1'
const SESSAO = '0190f5a0-0000-7000-8000-0000000000d1'
const codificar = (texto: string) => new TextEncoder().encode(texto)
const CHAVE = codificar('chave_sintetica_de_teste_com_32_caracteres')

const config: AuthConfig = { ambiente: 'local', chaveAssinatura: CHAVE }

/** O emissor do token sintético do F0, que saiu na tarefa 3.0: nenhum ambiente volta a aceitá-lo. */
const EMISSOR_SINTETICO_DO_F0 = 'sintetico'

const agora = () => Math.floor(Date.now() / 1000)

interface TokenOptions {
  claims?: JWTPayload
  semClaims?: string[]
  chave?: Uint8Array
  alg?: string
  semTyp?: boolean
  typ?: string
}

async function assinar(opcoes: TokenOptions = {}): Promise<string> {
  const todas: JWTPayload = {
    esc: ESCOLA_A,
    sub: USUARIO,
    sid: SESSAO,
    iss: EMISSOR_TOKEN,
    iat: agora(),
    exp: agora() + 3600,
    ...opcoes.claims,
  }
  const claims = Object.fromEntries(Object.entries(todas).filter(([claim]) => !(opcoes.semClaims ?? []).includes(claim)))
  const cabecalho = { alg: opcoes.alg ?? 'HS256', ...(opcoes.semTyp === true ? {} : { typ: opcoes.typ ?? 'JWT' }) }
  return new SignJWT(claims).setProtectedHeader(cabecalho).sign(opcoes.chave ?? CHAVE)
}

async function recusa(token: string, configuracao: AuthConfig = config): Promise<DomainException> {
  try {
    await verifyToken(token, configuracao)
  } catch (erro) {
    if (erro instanceof DomainException) return erro
    throw erro
  }
  throw new Error('o token deveria ter sido recusado')
}

describe('verificarToken', () => {
  it('devolve a escola, o usuário, a sessão e o `iat` do token válido, e nada além deles', async () => {
    const emitidoEm = agora() - 7
    expect(await verifyToken(await assinar({ claims: { iat: emitidoEm } }), config)).toStrictEqual({ escolaId: ESCOLA_A, usuarioId: USUARIO, sessaoId: SESSAO, emitidoEm })
  })

  it('token sem `iat` passa sem `emitidoEm`: ele nunca conta como o token da última renovação', async () => {
    expect(await verifyToken(await assinar({ semClaims: ['iat'] }), config)).toStrictEqual({ escolaId: ESCOLA_A, usuarioId: USUARIO, sessaoId: SESSAO })
  })

  it('devolve os ids em minúsculas: a mesma escola não vira outra chave por causa da caixa', async () => {
    const token = await assinar({ claims: { esc: ESCOLA_A.toUpperCase(), sub: USUARIO.toUpperCase(), sid: SESSAO.toUpperCase() } })
    expect(await verifyToken(token, config)).toEqual({ escolaId: ESCOLA_A, usuarioId: USUARIO, sessaoId: SESSAO, emitidoEm: expect.any(Number) })
  })

  it('aceita o token com a validade máxima de 24 horas pela frente', async () => {
    const token = await assinar({ claims: { exp: agora() + VALIDADE_MAXIMA_TOKEN_SEGUNDOS } })
    expect(await verifyToken(token, config)).toEqual({ escolaId: ESCOLA_A, usuarioId: USUARIO, sessaoId: SESSAO, emitidoEm: expect.any(Number) })
  })

  it('recusa o token do emissor sintético do F0, assinado com a mesma chave e no prazo: o emissor é constante, não configuração', async () => {
    const token = await assinar({ claims: { iss: EMISSOR_SINTETICO_DO_F0 } })
    expect(await recusa(token)).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO, status: 401 })
    // A `AuthConfig` não tem por onde aceitar outro emissor: `validate-config.test.ts` fecha a forma dela.
    expect(Object.keys(config).sort()).toEqual(['ambiente', 'chaveAssinatura'])
  })

  const recusados: Array<[string, () => Promise<string>]> = [
    ['assinatura com outra chave', () => assinar({ chave: codificar('outra_chave_sintetica_com_32_caracteres') })],
    ['validade além de 24 horas, mesmo com assinatura certa', () => assinar({ claims: { exp: agora() + VALIDADE_MAXIMA_TOKEN_SEGUNDOS + 120 } })],
    ['token vencido', () => assinar({ claims: { iat: agora() - 7200, exp: agora() - 60 } })],
    ['sem exp', () => assinar({ semClaims: ['exp'] })],
    ['sem esc', () => assinar({ semClaims: ['esc'] })],
    ['sem sub', () => assinar({ semClaims: ['sub'] })],
    ['sem sid: token sem sessão não chega à guarda', () => assinar({ semClaims: ['sid'] })],
    ['sid fora do formato UUID', () => assinar({ claims: { sid: 'sessao-1' } })],
    ['typ desafio+jwt: o desafio de login não vale como token de acesso', () => assinar({ typ: 'desafio+jwt' })],
    ['sem iss', () => assinar({ semClaims: ['iss'] })],
    ['emissor não aceito', () => assinar({ claims: { iss: 'login-real' } })],
    ['esc fora do formato UUID', () => assinar({ claims: { esc: 'escola-a' } })],
    ['esc como número', () => assinar({ claims: { esc: 42 } })],
    ['sub fora do formato UUID', () => assinar({ claims: { sub: 'Enzo Martins' } })],
    ['nbf no futuro', () => assinar({ claims: { nbf: agora() + 600 } })],
    ['algoritmo HS512 com a mesma chave', () => assinar({ alg: 'HS512' })],
    ['sem typ', () => assinar({ semTyp: true })],
    ['alg none, sem assinatura', async () => new UnsecuredJWT({ esc: ESCOLA_A, sub: USUARIO, sid: SESSAO, iss: EMISSOR_TOKEN, exp: agora() + 3600 }).encode()],
    ['assinatura de um token colada no corpo de outro', async () => {
      const [cabecalho, , assinatura] = (await assinar()).split('.')
      const [, corpoDeOutraEscola] = (await assinar({ claims: { esc: '0190f5a0-0000-7000-8000-00000000000b' } })).split('.')
      return `${cabecalho}.${corpoDeOutraEscola}.${assinatura}`
    }],
    ['texto que não é JWT', async () => 'nao.e.jwt'],
  ]

  it.each(recusados)('recusa %s com NAO_AUTENTICADO 401', async (_caso, gerar) => {
    expect(await recusa(await gerar())).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO, status: 401 })
  })
})

describe('extrairTokenBearer', () => {
  it('extrai o token do esquema Bearer, com o nome do esquema em qualquer caixa', () => {
    expect(extractBearerToken('Bearer aaa.bbb.ccc')).toBe('aaa.bbb.ccc')
    expect(extractBearerToken('bearer aaa.bbb.ccc')).toBe('aaa.bbb.ccc')
  })

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['outro esquema', 'Basic dXN1YXJpbzpzZW5oYQ=='],
    ['sem esquema', 'aaa.bbb.ccc'],
    ['duas partes', 'Bearer aaa.bbb'],
    ['texto depois do token', 'Bearer aaa.bbb.ccc extra'],
    ['repetido', ['Bearer aaa.bbb.ccc', 'Bearer ddd.eee.fff']],
  ])('recusa cabeçalho %s com NAO_AUTENTICADO', (_caso, cabecalho) => {
    expect(() => extractBearerToken(cabecalho)).toThrow(expect.objectContaining({ codigo: ErrorCode.NAO_AUTENTICADO }))
  })
})
