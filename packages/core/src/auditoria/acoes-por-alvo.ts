import type { PapelQueGeraASenhaProvisoria } from '@educa/shared'

/**
 * A lista fechada do que o arquivo do titular traz "por alvo" (D85; acesso-e-convites, tarefa 11.0): os atos de outra pessoa sobre o titular, só com o papel de
 * quem fez. **É escrita aqui uma vez**: o índice parcial `auditoria_por_alvo_idx` (`db/schema/auditoria.ts`) e as duas leituras de `LEITURAS_DO_ARQUIVO.auditoria`
 * (`titular/leitura-do-titular.ts`) a leem daqui, e as migrations `0046_auditoria_por_alvo.sql` (as seis) e `0048_auditoria_por_alvo_email.sql` (as sete), que não importam nada, levam o texto da lista (o
 * `auditoria-por-alvo.int.test.ts` confere a última contra esta lista). Ação nova entra aqui, na migration que recria o índice e no teste que fixa a lista
 * (`leitura-do-titular.test.ts`), e em lugar nenhum mais. Sem aspas nem espaço: os valores vão ao SQL como literal.
 */

/** As ações cujo `entidade_id` é o próprio usuário titular. */
export const ACOES_DO_USUARIO_POR_ALVO = ['aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada', 'usuario.email_corrigido'] as const

/** As ações cujo `entidade_id` é a linha da lista de nomes, que só é do titular depois de aprovada (`lista_nome.usuario_id`). */
export const ACOES_DA_LISTA_POR_ALVO = ['lista.transferida', 'lista.nome_corrigido'] as const

export const ACOES_DO_ARQUIVO_POR_ALVO = [...ACOES_DO_USUARIO_POR_ALVO, ...ACOES_DA_LISTA_POR_ALVO] as const

/**
 * O papel de quem gerou a senha provisória, como o arquivo o escreve para o aluno. A chave é o papel que a auditoria guarda no `depois` da geração, e o tipo `Record`
 * exige uma entrada por papel de `PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA`: papel novo na lista de quem gera é erro de tipo aqui, e não uma linha sem papel no arquivo.
 */
export const PAPEL_NO_ARQUIVO_DA_GERACAO: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'coordenação', professor: 'professor' }

/** A lista como literais de SQL, `'a', 'b'`. Os valores são constantes do código (acima), nunca entrada de fora. */
export function literaisDeSql(valores: readonly string[]): string {
  return valores.map((valor) => `'${valor}'`).join(', ')
}
