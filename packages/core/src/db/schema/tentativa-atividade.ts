import { sql } from 'drizzle-orm'
import { check, foreignKey, index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { atividadeAplicada } from './atividade-aplicada.js'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

/**
 * A tentativa de um aluno numa atividade aplicada (MVP, A3). É a "Aplicação" do modelo definitivo: nasce quando o aluno
 * abre a prova, e `enviada_em` marca a entrega dele. As respostas e a correção penduram nela.
 *
 * - `unique (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id)`: uma tentativa por aluno e atividade. Abrir a
 *   prova em duas abas, ou o duplo clique, cria uma só (`on conflict do nothing`; regra 80, item 7). O ano vem da
 *   aplicação pela FK, então o par (aplicação, aluno) não se repete em ano nenhum. É também o alvo da resposta e da
 *   correção, e por ele se leem as tentativas de uma aplicação e a do aluno, sempre a partir do escopo (regra 80, item 8).
 * - A aplicação por FK composta `(escola_id, ano_letivo_id, atividade_aplicada_id)`: a tentativa nunca aponta para a
 *   atividade de outra escola nem de outro ano.
 * - O aluno por FK composta com a escola, `on delete cascade`: a eliminação do aluno apaga de fato a tentativa e, por
 *   ela, as respostas e a correção dele (regra 20, item 15). O que fica no registro da validação é só o id.
 * - O relógio é o do servidor (`now()`): a tela não manda hora (regra 80, item 6).
 * - Sem `saidas_da_aba` (D70): a prova online com relógio não é desta fatia.
 */
export const tentativaAtividade = pgTable(
  'tentativa_atividade',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    atividadeAplicadaId: uuid().notNull(),
    alunoId: uuid().notNull(),
    iniciadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    enviadaEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('tentativa_atividade_uma_por_aluno').on(tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId, tabela.alunoId),
    foreignKey({
      name: 'tentativa_atividade_aplicacao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId],
      foreignColumns: [atividadeAplicada.escolaId, atividadeAplicada.anoLetivoId, atividadeAplicada.id],
    }),
    foreignKey({ name: 'tentativa_atividade_aluno_da_escola_fk', columns: [tabela.escolaId, tabela.alunoId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    // Por aluno: a eliminação dele (o `on delete cascade` da FK acima acha as tentativas por aqui) e o arquivo do titular. A
    // chave única começa pelo ano e pela aplicação, e não serve a quem só tem o aluno (F3, tarefa 5.0).
    index('tentativa_atividade_aluno_idx').on(tabela.escolaId, tabela.alunoId),
    check('tentativa_atividade_envio_depois_do_inicio', sql`${tabela.enviadaEm} is null or ${tabela.enviadaEm} >= ${tabela.iniciadaEm}`),
  ],
)
