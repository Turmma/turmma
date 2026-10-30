import { ErrorCode } from '@educa/shared'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { IncomingMessage } from 'node:http'
import type { AuthConfig } from '../config/validar-config.js'
import { currentContext, type RequestSessao } from '../contexto/contexto.js'
import { DomainException } from '../erro/erro-de-dominio.js'
import { isRouteWithoutSessao } from './rota-sem-sessao.js'
import { storeRequestToken } from './token-da-requisicao.js'
import { operadorBearer, operadorCookie, extractBearerToken, verifyToken, type Identity } from './verificar-token.js'

/**
 * Primeira guarda global da API: só verifica o JWT (assinatura, emissor, tipo, prazo e os ids) e o prende à
 * requisição. Não toca o banco nem o Redis: token inválido é recusado aqui, antes do limite e da leitura de sessão
 * (Tech Spec, seção 1). Quem grava a escola e o usuário no contexto é a `SessaoGuard`, depois de conferir a
 * sessão; nenhum cabeçalho, query ou corpo do cliente chega lá (regra 10, item 3).
 */
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AuthConfig,
  ) {}

  async canActivate(execucao: ExecutionContext): Promise<boolean> {
    if (isRouteWithoutSessao(this.reflector, execucao)) return true
    // Só HTTP; o realtime autentica no handshake. Outro tipo não passa sem token.
    if (execucao.getType() !== 'http') throw new DomainException(ErrorCode.NAO_AUTENTICADO)

    const requisicao = execucao.switchToHttp().getRequest<IncomingMessage>()
    // Credencial de operador em rota de escola responde igual a uma rota inexistente (Tech Spec da A0, seções 5 e 6;
    // C47): um 401 diria que a rota existe e só faltou a credencial certa. Basta o `typ` do bearer, ou o nome do cookie
    // de sessão do operador, sem verificar nada: nenhum dos dois passaria de qualquer jeito, e quem os forja só ganha o
    // 404 que já teria numa rota que não existe.
    if (operadorBearer(requisicao.headers.authorization) || operadorCookie(requisicao.headers.cookie)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const token = await verifyToken(extractBearerToken(requisicao.headers.authorization), this.config)
    storeRequestToken(requisicao, token)
    return true
  }
}

/**
 * Escola e usuário da requisição em andamento, lidos do contexto que a `SessaoGuard` preencheu. Recusa com
 * `NAO_AUTENTICADO` quando não há: rota marcada anônima por engano não devolve escopo vazio.
 */
export function requestIdentity(): Identity {
  const contexto = currentContext()
  if (contexto?.escolaId === undefined || contexto.usuarioId === undefined) {
    throw new DomainException(ErrorCode.NAO_AUTENTICADO)
  }
  return { escolaId: contexto.escolaId, usuarioId: contexto.usuarioId }
}

/** A sessão da requisição em andamento, com papel e ano letivo. Sem sessão conferida no contexto, `NAO_AUTENTICADO`. */
export function requestSessao(): RequestSessao {
  const contexto = currentContext()
  if (
    contexto?.escolaId === undefined ||
    contexto.usuarioId === undefined ||
    contexto.papel === undefined ||
    contexto.sessaoId === undefined ||
    contexto.anoLetivoId === undefined
  ) {
    throw new DomainException(ErrorCode.NAO_AUTENTICADO)
  }
  return { escolaId: contexto.escolaId, usuarioId: contexto.usuarioId, papel: contexto.papel, sessaoId: contexto.sessaoId, anoLetivoId: contexto.anoLetivoId }
}
