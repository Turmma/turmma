import { sql } from 'drizzle-orm'
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { conta } from './conta.js'

/**
 * Os códigos de recuperação do segundo fator (tarefa 6.0; Tech Spec, seção 3): dez por conta, gerados na ativação do
 * MFA e de uso único.
 *
 * - Guarda só o HMAC do código, com chave própria (`IDENTIDADE_CHAVE_RECUPERACAO`), separada da chave da cifra do
 *   segredo: quem lê o banco não tem o código, e quem tem uma chave não tem a outra (`docs/lgpd.md`, seção 2).
 * - Não tem `escola_id`: é da `conta`, que é global (desvio declarado da regra 10, itens 1 e 9; Tech Spec, seção 6).
 *   Toda operação nela passa pelo repository de resolução de tenant do módulo de sessão, pelo repository da conta
 *   global em `nucleo/ciclo-de-vida` (F3, tarefa 1.0) ou pela limpeza do expurgo de acesso, com `@Unscoped` justificado.
 * - `usado_em` marca o uso, num `update … where usado_em is null`: dois pedidos com o mesmo código ao mesmo tempo
 *   passam uma vez só (regra 80, item 7).
 * - `unique (conta_id, hmac)` é também o índice da busca do código de uma conta.
 * - Sai com a conta (`on delete cascade`): sem a conta, o código não tem de quem ser. A redefinição do MFA apaga os
 *   códigos da conta.
 */
export const codigoRecuperacao = pgTable(
  'codigo_recuperacao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    contaId: uuid()
      .notNull()
      .references(() => conta.id, { onDelete: 'cascade' }),
    hmac: text().notNull(),
    usadoEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('codigo_recuperacao_conta_hmac_unico').on(tabela.contaId, tabela.hmac),
    // HMAC-SHA256 em base64url: 43 caracteres, nunca o código em si.
    check('codigo_recuperacao_hmac_formato', sql`char_length(${tabela.hmac}) = 43`),
  ],
)
