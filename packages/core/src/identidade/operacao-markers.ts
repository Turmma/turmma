import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'

/**
 * As chaves dos dois marcadores da área da operação (Tech Spec da A0, seção 1). Os decoradores que as gravam,
 * `@OperacaoRoute()` e `@OperacaoLoginRoute()`, vivem só em `apps/api/src/operacao/decorators.ts`; aqui ficam as chaves,
 * para as guardas globais da escola (autenticação, limite, sessão, permissão) e a conferência do boot as reconhecerem
 * sem depender da API.
 *
 * - `@OperacaoRoute()`: a rota da operação com sessão de operador. Aplica a `OperadorGuard`, que responde a toda
 *   credencial que não é de operador igual a uma rota inexistente.
 * - `@OperacaoLoginRoute()`: a rota que leva à sessão de operador (convite, entrada, segundo fator, renovar, sair), numa
 *   lista fechada (C43, tarefa 8.0). Não tem sessão; o service confere o que recebe.
 *
 * As guardas da escola tratam as duas como sem sessão: nenhuma sessão de escola é lida nem vai para o contexto.
 */
export const OPERACAO_ROUTE_KEY = 'educa:rota-de-operacao'
export const OPERACAO_ENTRY_KEY = 'educa:entrada-de-operacao'

export type OperacaoMarker = 'rota' | 'entrada'

/** O marcador da área da operação que a rota tem, no método ou na classe, ou `undefined` se ela é da escola. */
export function operacaoMarker(reflector: Reflector, execucao: ExecutionContext): OperacaoMarker | undefined {
  const alvos = [execucao.getHandler(), execucao.getClass()]
  if (reflector.getAllAndOverride<boolean | undefined>(OPERACAO_ROUTE_KEY, alvos) === true) return 'rota'
  if (reflector.getAllAndOverride<boolean | undefined>(OPERACAO_ENTRY_KEY, alvos) === true) return 'entrada'
  return undefined
}
