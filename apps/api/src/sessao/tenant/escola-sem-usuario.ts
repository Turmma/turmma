import { currentContext, runInContext } from '@educa/core'
import { randomUUID } from 'node:crypto'

/**
 * Roda `funcao` num contexto que tem só a escola, sem usuário (Tech Spec, seção 1, "Antes do contexto"): a escola que
 * a `ResolucaoDeTenantRepository` achou pelo slug, nunca uma escola vinda do cliente. Os repositories com escopo leem
 * a escola daqui, e a requisição continua com o mesmo `requisicaoId`. Com `anoLetivoId`, o ano em curso também entra no
 * contexto: o da linha do acesso da sala (A1, tarefa 5.0), achada com o ano `em_curso`.
 */
export function naEscolaSemUsuario<T>({ escolaId, anoLetivoId }: { readonly escolaId: string; readonly anoLetivoId?: string }, funcao: () => Promise<T>): Promise<T> {
  const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
  return runInContext({ requisicaoId, escolaId, ...(anoLetivoId === undefined ? {} : { anoLetivoId }) }, funcao)
}
