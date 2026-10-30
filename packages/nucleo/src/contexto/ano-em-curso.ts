import { ErrorCode } from '@educa/shared'
import { ErroDeDominio } from '../erro/erro-de-dominio.js'
import { contextoAtual } from './contexto.js'

/**
 * O ano letivo em curso da escola da sessão, gravado no contexto pela `GuardaDeSessao`. Sem ano em curso, ou sem
 * sessão no contexto, responde `NAO_ENCONTRADO`: turma e vínculo falham fechados, como objeto que não existe, e nunca
 * caem num ano qualquer (regra 10, item 2). Criar e abrir ano letivo não passam por aqui.
 */
export function exigirAnoEmCurso(): string {
  const anoLetivoId = contextoAtual()?.anoLetivoId
  if (typeof anoLetivoId !== 'string') throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
  return anoLetivoId
}
