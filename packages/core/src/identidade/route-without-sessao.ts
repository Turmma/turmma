import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { decodeProtectedHeader } from 'jose'
import type { IncomingMessage } from 'node:http'
import { ACCEPTS_CHALLENGE_KEY, IS_PUBLIC_KEY } from '../rate-limit/route-markers.decorator.js'
import { operacaoMarker } from './operacao-markers.js'
import { extractBearerToken, TIPO_DESAFIO } from './verify-token.js'

/** Se o bearer do cabeçalho diz, no cabeçalho do JWT, ser um desafio de login. Não verifica nada: só separa o caminho. */
export function isChallengeBearer(cabecalho: string | string[] | undefined): boolean {
  try {
    return decodeProtectedHeader(extractBearerToken(cabecalho)).typ === TIPO_DESAFIO
  } catch {
    return false
  }
}

/**
 * Se as guardas de autenticação, limite, sessão e permissão tratam a requisição como sem sessão de escola: a rota
 * `@Public`, a rota da área da operação (`@RotaDeOperacao` ou `@EntradaDeOperacao`, Tech Spec da A0, seção 1), ou
 * a rota `@AcceptsChallenge` chamada com um desafio de login no `Authorization`. Toda outra rota exige token de acesso e
 * sessão de escola, e a rota `@AcceptsChallenge` chamada com o token de acesso também.
 *
 * Tratar como sem sessão não autentica ninguém: não há escola, usuário nem sessão no contexto. O service da rota
 * verifica o desafio antes de qualquer coisa, e a rota `@RotaDeOperacao` só roda depois da `GuardaDeOperador`.
 */
export function isRouteWithoutSessao(reflector: Reflector, execucao: ExecutionContext): boolean {
  const alvos = [execucao.getHandler(), execucao.getClass()]
  if (reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, alvos) === true) return true
  if (operacaoMarker(reflector, execucao) !== undefined) return true
  if (reflector.getAllAndOverride<boolean | undefined>(ACCEPTS_CHALLENGE_KEY, alvos) !== true) return false
  if (execucao.getType() !== 'http') return false
  const requisicao = execucao.switchToHttp().getRequest<Partial<IncomingMessage>>()
  return isChallengeBearer(requisicao.headers?.authorization)
}
