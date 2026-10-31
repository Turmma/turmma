import { currentContext } from '../context/context.js'
import { auditoria } from '../db/schema/auditoria.js'
import { AuditoriaRejectedError } from './auditoria-rejected.error.js'
import type { DatabaseExecutor } from './auditoria.repository.js'

/** O que o registro já conferiu e manda gravar. Escola e requisição vêm do contexto, aqui dentro. */
export interface AuditoriaInsertRow {
  acao: string
  entidade: string
  entidadeId: string
  autorUsuarioId: string | null
  autorOperador: string | null
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  finalidade: string | null
}

/**
 * O único `insert` em `auditoria` do sistema, e ele não confere nada: quem confere é o
 * `AuditoriaRecorder`, o único que importa este módulo. Fica fora do `index.ts` do pacote de propósito,
 * e um teste varre o código atrás de outra escrita na tabela.
 *
 * Grava na escola do contexto, com o `requisicaoId` dele. Sem escola no contexto, a linha sai com escola
 * nula, e o check `auditoria_escola_ou_operacao_global` só a aceita para a rede criada e para o suboperador cadastrado ou
 * encerrado, sempre pelo operador.
 */
export async function insertAuditoria(executor: DatabaseExecutor, linha: AuditoriaInsertRow): Promise<void> {
  const contexto = currentContext()
  if (contexto === undefined) throw new AuditoriaRejectedError('sem_contexto')
  await executor.insert(auditoria).values({ ...linha, escolaId: contexto.escolaId ?? null, requisicaoId: contexto.requisicaoId })
}
