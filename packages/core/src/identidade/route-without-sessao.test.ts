import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { SetMetadata } from '@nestjs/common'
import { AcceptsChallenge, Public } from '../rate-limit/route-markers.decorator.js'
import { operacaoMarker, OPERACAO_ENTRY_KEY, OPERACAO_ROUTE_KEY } from './operacao-markers.js'
import { isChallengeBearer, isRouteWithoutSessao } from './route-without-sessao.js'
import { TIPO_DESAFIO, TIPO_TOKEN } from './verify-token.js'

const CHAVE = new TextEncoder().encode('chave-sintetica-de-teste-com-32-bytes!!')

class Rotas {
  @AcceptsChallenge()
  aceitaDesafio(): void {}

  comum(): void {}

  @Public()
  anonima(): void {}

  // Os marcadores da operação, pelas chaves que os decoradores de `apps/api/src/operacao/decorators.ts` gravam.
  @SetMetadata(OPERACAO_ROUTE_KEY, true)
  daOperacao(): void {}

  @SetMetadata(OPERACAO_ENTRY_KEY, true)
  entradaDaOperacao(): void {}
}

/** Controller inteiro marcado na classe: o método herda o marcador. */
@SetMetadata(OPERACAO_ROUTE_KEY, true)
class RotasDaOperacao {
  qualquer(): void {}
}

function execucao(metodo: keyof Rotas, authorization?: string, tipo = 'http'): ExecutionContext {
  const requisicao = { headers: authorization === undefined ? {} : { authorization } }
  return {
    getHandler: () => Rotas.prototype[metodo],
    getClass: () => Rotas,
    getType: () => tipo,
    switchToHttp: () => ({ getRequest: () => requisicao }),
  } as unknown as ExecutionContext
}

async function jwt(typ: string): Promise<string> {
  return new SignJWT({ sub: 'x' }).setProtectedHeader({ alg: 'HS256', typ }).setIssuedAt().setExpirationTime('5m').sign(CHAVE)
}

describe('rotaSemSessao: quando as guardas tratam a requisição como anônima', () => {
  const reflector = new Reflector()

  it('rota @AceitaDesafio com desafio no Authorization: anônima para as guardas', async () => {
    expect(isRouteWithoutSessao(reflector, execucao('aceitaDesafio', `Bearer ${await jwt(TIPO_DESAFIO)}`))).toBe(true)
  })

  it('rota @AceitaDesafio com token de acesso, sem bearer ou com bearer que não é JWT: segue o caminho autenticado', async () => {
    expect(isRouteWithoutSessao(reflector, execucao('aceitaDesafio', `Bearer ${await jwt(TIPO_TOKEN)}`))).toBe(false)
    expect(isRouteWithoutSessao(reflector, execucao('aceitaDesafio'))).toBe(false)
    expect(isRouteWithoutSessao(reflector, execucao('aceitaDesafio', 'Bearer nao-e-jwt'))).toBe(false)
    expect(isRouteWithoutSessao(reflector, execucao('aceitaDesafio', `Basic ${await jwt(TIPO_DESAFIO)}`))).toBe(false)
  })

  it('rota sem @AceitaDesafio com desafio no Authorization: não vira anônima, e a autenticação o recusa', async () => {
    expect(isRouteWithoutSessao(reflector, execucao('comum', `Bearer ${await jwt(TIPO_DESAFIO)}`))).toBe(false)
  })

  it('execução que não é HTTP nunca vira anônima pelo desafio', async () => {
    expect(isRouteWithoutSessao(reflector, execucao('aceitaDesafio', `Bearer ${await jwt(TIPO_DESAFIO)}`, 'ws'))).toBe(false)
  })

  it('rota @RotaAnonima continua anônima, com ou sem token', () => {
    expect(isRouteWithoutSessao(reflector, execucao('anonima'))).toBe(true)
  })

  it('rota da operação, no método ou na classe, e entrada da operação: sem sessão de escola, com ou sem bearer de escola', async () => {
    expect(isRouteWithoutSessao(reflector, execucao('daOperacao'))).toBe(true)
    expect(isRouteWithoutSessao(reflector, execucao('daOperacao', `Bearer ${await jwt(TIPO_TOKEN)}`))).toBe(true)
    expect(isRouteWithoutSessao(reflector, execucao('entradaDaOperacao', `Bearer ${await jwt(TIPO_TOKEN)}`))).toBe(true)
    const naClasse = { getHandler: () => RotasDaOperacao.prototype.qualquer, getClass: () => RotasDaOperacao, getType: () => 'http' } as unknown as ExecutionContext
    expect(isRouteWithoutSessao(reflector, naClasse)).toBe(true)
    expect(operacaoMarker(reflector, naClasse)).toBe('rota')
  })

  it('marcadorDeOperacao separa a rota da entrada, e a rota da escola não tem marcador', () => {
    expect(operacaoMarker(reflector, execucao('daOperacao'))).toBe('rota')
    expect(operacaoMarker(reflector, execucao('entradaDaOperacao'))).toBe('entrada')
    expect(operacaoMarker(reflector, execucao('comum'))).toBeUndefined()
    expect(operacaoMarker(reflector, execucao('anonima'))).toBeUndefined()
  })

  it('bearerDeDesafio só lê o typ do cabeçalho do JWT, sem verificar a assinatura', async () => {
    const outraChave = await new SignJWT({}).setProtectedHeader({ alg: 'HS256', typ: TIPO_DESAFIO }).sign(new TextEncoder().encode('outra-chave-sintetica-com-32-bytes!!!'))
    expect(isChallengeBearer(`Bearer ${outraChave}`)).toBe(true)
    expect(isChallengeBearer(['Bearer a.b.c'])).toBe(false)
    expect(isChallengeBearer(undefined)).toBe(false)
  })
})
