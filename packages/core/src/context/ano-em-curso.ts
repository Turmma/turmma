import { ErrorCode } from '@educa/shared'
import { DomainException } from '../error/domain.exception.js'
import { currentContext } from './context.js'

/**
 * O ano letivo em curso da escola da sessão, gravado no contexto pela `SessaoGuard`. Sem ano em curso, ou sem
 * sessão no contexto, responde `NAO_ENCONTRADO`: turma e vínculo falham fechados, como objeto que não existe, e nunca
 * caem num ano qualquer (regra 10, item 2). Criar e abrir ano letivo não passam por aqui.
 */
export function requireAnoEmCurso(): string {
  const anoLetivoId = currentContext()?.anoLetivoId
  if (typeof anoLetivoId !== 'string') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  return anoLetivoId
}
