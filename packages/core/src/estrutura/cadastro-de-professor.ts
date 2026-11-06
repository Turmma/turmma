import { ContaGlobalRepository } from '../ciclo-de-vida/conta-global.repository.js'
import type { DatabaseTransaction } from '../db/database.js'

/**
 * O cadastro do professor pela escola (onboarding-por-convite, tarefa 1.0): a API (`POST /v1/professores`) e, na 4.0 em
 * diante, o worker da planilha cadastram pelo mesmo caminho. Este **arquivo** é a única exceção cercada ao escopo de
 * tenant que o cadastro traz (regra 10, item 9; Tech Spec, seção 6): a conta é global e não tem escola, e só aqui, fora
 * de `sessao/` e do ciclo de vida, se chega à `ContaGlobalRepository`. As duas guardas cercam o arquivo, não a pasta:
 * `ZONAS_DAS_CLASSES_CERCADAS`, em `apps/api/test/architecture.test.ts`, e `cerca-conta-global`, em
 * `tools/guardas/camadas.cjs`. A função `contaDoProfessor` repassa a conta sem escopo, e por isso também tem cerca em quem
 * a chama (só `sessao/`): a entrada `contaDoProfessor` da mesma lista e a regra `cerca-cadastro-de-professor`, e o
 * subcaminho próprio `@educa/core/cadastro-de-professor`, fora do barril `estrutura`.
 */

/**
 * A conta do e-mail do professor, achada ou criada (conta nova nasce sem senha), na transação de quem cadastra. Devolve só
 * o id: o `nova` fica na classe, e a coordenação nunca fica sabendo se o e-mail já tinha conta em outra escola (E11 da A1).
 * O e-mail já vem normalizado de quem chama.
 */
export async function contaDoProfessor(tx: DatabaseTransaction, email: string): Promise<{ id: string }> {
  const { id } = await new ContaGlobalRepository(tx).contaParaConvite(email)
  return { id }
}

/**
 * Trava as contas que o passo (1) da planilha de professores achou ou criou (`FOR SHARE`, em ordem de id) e confere que cada
 * uma ainda tem o e-mail da linha: `false` se alguma perdeu o e-mail ou sumiu, e o job pede nova tentativa (onboarding-por-convite,
 * 6.0). Sai pelo mesmo arquivo cercado, e o processor do job a repassa ao motor, que não alcança a conta global.
 */
export function travarContasDoProfessor(tx: DatabaseTransaction, contas: ReadonlyMap<string, string>): Promise<boolean> {
  return new ContaGlobalRepository(tx).travarEConferir(contas)
}
