import { alcanceDe, ErrorCode, type Alcance } from '@educa/shared'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { currentContext } from '../contexto/contexto.js'
import { DomainException } from '../erro/erro-de-dominio.js'
import { isRouteWithoutSessao } from '../identidade/rota-sem-sessao.js'
import { PERMISSAO_KEY, type PermittedCell } from './permite.decorator.js'

/**
 * Quarta guarda global da API, depois da sessão: com o papel que a sessão gravou no contexto, lê a célula que a rota
 * declarou em `@RequirePermissao` e barra o alcance `nunca`.
 *
 * - Papel sem permissão responde `NAO_ENCONTRADO` (404), igual a rota inexistente: um 403 confirmaria que a rota
 *   existe para outro papel (regra 10, item 6).
 * - Rota autenticada sem `@RequirePermissao` também é recusada. O boot já não sobe com ela (`PermissaoBootCheck`); aqui
 *   é a segunda trava, para nunca liberar por omissão.
 * - Sem papel no contexto (guarda fora de ordem), `NAO_AUTENTICADO`.
 */
export class PermissaoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(execucao: ExecutionContext): boolean {
    const alvos = [execucao.getHandler(), execucao.getClass()]
    if (isRouteWithoutSessao(this.reflector, execucao)) return true
    const papel = currentContext()?.papel
    if (papel === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    const celula = this.reflector.getAllAndOverride<PermittedCell | undefined>(PERMISSAO_KEY, alvos)
    const alcance: Alcance = celula === undefined ? 'nunca' : alcanceDe(papel, celula.recurso, celula.acao)
    if (alcance === 'nunca') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return true
  }
}
