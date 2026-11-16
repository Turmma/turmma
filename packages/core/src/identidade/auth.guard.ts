import { ErrorCode } from '@educa/shared'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { IncomingMessage } from 'node:http'
import type { AuthConfig } from '../config/validate-config.js'
import { currentContext, type RequestSessao, type RequestSessaoDeRequisicao } from '../context/context.js'
import { DomainException } from '../error/domain.exception.js'
import { isRouteWithoutSessao } from './route-without-sessao.js'
import { storeRequestToken } from './request-token.js'
import { operadorBearer, operadorCookie, extractBearerToken, verifyToken, type Identity } from './verify-token.js'

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

/**
 * A pessoa da requisição ou da execução em andamento, com papel e ano letivo. Sem escola, pessoa, papel ou ano no contexto, `NAO_AUTENTICADO`.
 * Serve a quem roda também no worker (a execução de IA, X6 5.0), onde a pessoa é a que pediu e **não há sessão**: quem precisa da sessão em si
 * (sair, trocar de escola, renovar a atividade) chama `requestSessaoDeRequisicao`.
 */
export function requestSessao(): RequestSessao {
  const contexto = currentContext()
  if (contexto?.escolaId === undefined || contexto.usuarioId === undefined || contexto.papel === undefined || contexto.anoLetivoId === undefined) {
    throw new DomainException(ErrorCode.NAO_AUTENTICADO)
  }
  return { escolaId: contexto.escolaId, usuarioId: contexto.usuarioId, papel: contexto.papel, anoLetivoId: contexto.anoLetivoId, ...(contexto.sessaoId === undefined ? {} : { sessaoId: contexto.sessaoId }) }
}

/** A sessão da requisição HTTP em andamento, com o `sessaoId`. Sem sessão conferida no contexto (job, execução em segundo plano), `NAO_AUTENTICADO`. */
export function requestSessaoDeRequisicao(): RequestSessaoDeRequisicao {
  const sessao = requestSessao()
  if (sessao.sessaoId === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
  return { ...sessao, sessaoId: sessao.sessaoId }
}
