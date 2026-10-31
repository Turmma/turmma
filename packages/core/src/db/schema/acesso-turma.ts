import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { turma } from './turma.js'
import { usuario } from './usuario.js'

/**
 * O acesso da turma (A1, tarefa 4.0, RF9; Tech Spec da A1, seção 3): o link da sala e o código da turma que o professor
 * com vínculo confirmado gera, e que o aluno usa para reivindicar o nome (5.0 e 6.0). O link e o código aparecem uma
 * vez, na resposta que os cria; aqui ficam só o SHA-256 do token (`token_hash`, pelo `hashDoToken`) e o HMAC do código
 * com a chave própria (`codigo_hmac`, `SALA_CHAVE_CODIGO`).
 *
 * - Vigente é o que não foi revogado e ainda não venceu (`expira_em > now()`). "Gerar novo" revoga todo acesso não
 *   revogado da turma, vencido ou não, na mesma transação do novo.
 * - Índice único parcial `(escola_id, turma_id) where revogado_em is null`: um acesso não revogado por turma. Dois gerar
 *   ao mesmo tempo gravam um, e o outro sai `CONFLITO` (C5).
 * - Índice único parcial `(escola_id, codigo_hmac) where revogado_em is null`: o código não se repete entre os não
 *   revogados da escola, que é onde a página pública o procura (pelo slug). A colisão do sorteio sorteia de novo (C6).
 * - `token_hash` único no sistema: o link não diz a escola, e a busca pelo token é uma só (5.0).
 * - FK composta `(escola_id, ano_letivo_id, turma_id)` para a turma, `on delete cascade`: a turma só sai sem acesso
 *   vigente (a exclusão confere), e o revogado ou vencido sai com ela.
 * - `criado_por` por FK composta com a escola, `on delete set null (criado_por)` (escrito à mão na 0020): a eliminação
 *   do professor não apaga o acesso, e a autoria fica na auditoria (`acesso_turma.gerado`).
 * - `validade_dias` em 1, 7 ou 30 (`VALIDADES_DO_ACESSO_DIAS`, de `@educa/shared`).
 */
export const acessoTurma = pgTable(
  'acesso_turma',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    turmaId: uuid().notNull(),
    tokenHash: text().notNull(),
    codigoHmac: text().notNull(),
    validadeDias: integer().notNull(),
    expiraEm: timestamp({ withTimezone: true }).notNull(),
    revogadoEm: timestamp({ withTimezone: true }),
    criadoPor: uuid(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('acesso_turma_escola_id_unico').on(tabela.escolaId, tabela.id),
    foreignKey({
      name: 'acesso_turma_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }).onDelete('cascade'),
    // A migration escreve `on delete set null ("criado_por")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'acesso_turma_criado_por_da_escola_fk', columns: [tabela.escolaId, tabela.criadoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    uniqueIndex('acesso_turma_token_hash_unico').on(tabela.tokenHash),
    uniqueIndex('acesso_turma_um_por_turma').on(tabela.escolaId, tabela.turmaId).where(sql`${tabela.revogadoEm} is null`),
    uniqueIndex('acesso_turma_codigo_na_escola_unico').on(tabela.escolaId, tabela.codigoHmac).where(sql`${tabela.revogadoEm} is null`),
    check('acesso_turma_validade_valida', sql`${tabela.validadeDias} in (1, 7, 30)`),
  ],
)
