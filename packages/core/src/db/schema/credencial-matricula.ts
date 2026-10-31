import { sql } from 'drizzle-orm'
import { check, foreignKey, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

/**
 * A credencial do aluno que entra pelo endereço da escola com matrícula e senha (tarefa 11.0; Tech Spec, seção 3). O
 * aluno não tem `conta` nem e-mail (regra 20, item 2): a credencial é da escola.
 *
 * - `unique (escola_id, matricula)`: a matrícula é única na escola, nunca no sistema (regra 60, item 6). A mesma
 *   matrícula em outra escola é outra credencial, de outro usuário. É também o índice da leitura do login.
 * - `unique (escola_id, usuario_id)`: uma credencial por aluno.
 * - `(escola_id, usuario_id)` é FK composta para `usuario (escola_id, id)`: a credencial nunca aponta para usuário de
 *   outra escola. Sai com o usuário (`on delete cascade`), que é de quem ela é.
 * - `senha_hash` é argon2id e fica nulo quando a escola desativa o aluno (17.0). Nunca sai em resposta nem em log.
 * - A matrícula é dado pessoal (`docs/lgpd.md`): nunca em log, em auditoria nem em métrica.
 */
export const credencialMatricula = pgTable(
  'credencial_matricula',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    usuarioId: uuid().notNull(),
    matricula: text().notNull(),
    senhaHash: text(),
    criadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('credencial_matricula_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('credencial_matricula_matricula_unica').on(tabela.escolaId, tabela.matricula),
    unique('credencial_matricula_usuario_unico').on(tabela.escolaId, tabela.usuarioId),
    foreignKey({ name: 'credencial_matricula_usuario_da_escola_fk', columns: [tabela.escolaId, tabela.usuarioId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    // 40 é `TAMANHO_MAXIMO_MATRICULA` do contrato (`packages/shared`), o mesmo que o login aceita.
    check('credencial_matricula_formato', sql`char_length(${tabela.matricula}) between 1 and 40 and ${tabela.matricula} = btrim(${tabela.matricula})`),
  ],
)
