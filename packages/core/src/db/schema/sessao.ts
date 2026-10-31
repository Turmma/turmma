import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { conta } from './conta.js'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

export const METODOS_DE_SESSAO = ['email', 'matricula', 'externo'] as const
export type MetodoDeSessao = (typeof METODOS_DE_SESSAO)[number]

/** Por que a sessão terminou antes de expirar. As tarefas de saída, troca e desativação acrescentam os delas. */
export const MOTIVOS_DE_ENCERRAMENTO = ['saida', 'troca_de_escola', 'reuso_de_refresh', 'desativacao', 'mfa_redefinido', 'conta_limpa', 'eliminacao_agendada'] as const
export type MotivoDeEncerramento = (typeof MOTIVOS_DE_ENCERRAMENTO)[number]

/** Duração absoluta de uma sessão, renovada ou não (Tech Spec, seção 3). */
export const DURACAO_DA_SESSAO_HORAS = 12

/**
 * A sessão de uma pessoa numa escola, no Postgres (Tech Spec, seção 11: não no Redis de cache, que expulsaria
 * sessão no meio da aula). A `SessaoGuard` lê esta linha em toda requisição autenticada, por `(escola_id, id)`.
 *
 * - `(escola_id, usuario_id)` é FK composta para `usuario (escola_id, id)`: a sessão nunca aponta para usuário de
 *   outra escola.
 * - `refresh_hash` e `refresh_hash_anterior` são hashes do cookie de renovação (tarefa 5.0), nunca o valor.
 * - `ultimo_uso_em` muda com a atividade, e é por isso que não tem índice e a tabela tem `fillfactor = 70`
 *   (na migration, que o drizzle-kit não declara): a atualização fica HOT, sem reescrever índice.
 * - Sem nome, e-mail ou IP: horários, método e motivo (`docs/lgpd.md`, "Sessão").
 */
export const sessao = pgTable(
  'sessao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    contaId: uuid().references(() => conta.id),
    usuarioId: uuid().notNull(),
    metodo: text().$type<MetodoDeSessao>().notNull(),
    familia: uuid().notNull(),
    refreshHash: text().notNull().unique('sessao_refresh_hash_unico'),
    refreshHashAnterior: text(),
    atualApresentado: boolean().notNull().default(false),
    rotacionadoEm: timestamp({ withTimezone: true }),
    ultimoUsoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiraEm: timestamp({ withTimezone: true }).notNull(),
    encerradaEm: timestamp({ withTimezone: true }),
    motivo: text().$type<MotivoDeEncerramento>(),
  },
  (tabela) => [
    unique('sessao_escola_id_unico').on(tabela.escolaId, tabela.id),
    foreignKey({ name: 'sessao_usuario_da_escola_fk', columns: [tabela.escolaId, tabela.usuarioId], foreignColumns: [usuario.escolaId, usuario.id] }),
    index('sessao_refresh_hash_anterior_idx').on(tabela.refreshHashAnterior),
    // Encerrar as sessões de um usuário (saída de todas, desativação) e a FK composta descem por aqui.
    index('sessao_escola_usuario_idx').on(tabela.escolaId, tabela.usuarioId),
    // O expurgo de 30 dias (17.0) desce pelo fim da sessão: encerrada, ou só expirada. Encerrar deixa de ser HOT, uma vez
    // por sessão; a atividade (`ultimo_uso_em`), que é a escrita frequente, continua HOT.
    index('sessao_fim_idx').on(sql`coalesce(${tabela.encerradaEm}, ${tabela.expiraEm})`),
    // Encerrar as sessões abertas de uma conta, em todas as escolas (a redefinição do MFA e a limpeza da conta, 17.0),
    // desce por aqui: só as abertas e só as que têm conta, então o índice fica pequeno.
    index('sessao_conta_aberta_idx').on(tabela.contaId).where(sql`conta_id is not null and encerrada_em is null`),
    check('sessao_metodo_valido', sql`${tabela.metodo} in ('email', 'matricula', 'externo')`),
    check('sessao_motivo_valido', sql`${tabela.motivo} is null or ${tabela.motivo} in ('saida', 'troca_de_escola', 'reuso_de_refresh', 'desativacao', 'mfa_redefinido', 'conta_limpa', 'eliminacao_agendada')`),
    check('sessao_motivo_so_encerrada', sql`${tabela.motivo} is null or ${tabela.encerradaEm} is not null`),
  ],
)
