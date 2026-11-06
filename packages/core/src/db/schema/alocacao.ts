import { sql } from 'drizzle-orm'
import { check, foreignKey, index, pgTable, smallint, text, time, unique, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { vinculo } from './vinculo.js'

/**
 * Uma aula da grade horária: o vínculo (turma, disciplina e professor) num dia da semana e num horário (glossário, "Grade horária";
 * F2, tarefa 2.0; Tech Spec, seção 3). Substitui as três tabelas da grade que o `docs/modelo-de-dados.md` desenhava, e a `Aula`
 * concreta da F2b aponta para ela. Quem grava é o job da grade (11.0).
 *
 * - `vinculo_id` por FK composta `(escola_id, ano_letivo_id, vinculo_id)` com o ano do vínculo, `on delete cascade`: a aula nunca
 *   aponta para o vínculo de outra escola nem de outro ano, e sai com ele (a eliminação do professor, o prazo do vínculo encerrado).
 *   Essa FK já é a FK composta com o ano da aula: o vínculo só existe num ano da própria escola (a FK dele com a turma), então uma
 *   segunda FK `(escola_id, ano_letivo_id)` para `ano_letivo` nunca seria a única a recusar uma linha.
 * - `dia_semana` de 1 a 7 e `inicio < fim`, no banco: o job, a mão e o seed não passam horário impossível.
 * - Único `(vinculo_id, dia_semana, inicio)`: a reimportação **mantém o id** da aula que continua (mesmo vínculo, dia e início).
 * - Índice `(escola_id, ano_letivo_id)` para a grade do ano: começa pelo escopo (regra 80, item 8).
 * - Dado pessoal do professor, pelo vínculo (`docs/lgpd.md`, "Aula da grade"); nunca em log nem em auditoria.
 */
export const alocacao = pgTable(
  'alocacao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    vinculoId: uuid().notNull(),
    diaSemana: smallint().notNull(),
    inicio: time().notNull(),
    fim: time().notNull(),
    sala: text(),
  },
  (tabela) => [
    unique('alocacao_vinculo_dia_inicio_unico').on(tabela.vinculoId, tabela.diaSemana, tabela.inicio),
    foreignKey({
      name: 'alocacao_vinculo_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.vinculoId],
      foreignColumns: [vinculo.escolaId, vinculo.anoLetivoId, vinculo.id],
    }).onDelete('cascade'),
    index('alocacao_ano_idx').on(tabela.escolaId, tabela.anoLetivoId),
    check('alocacao_dia_da_semana_valido', sql`${tabela.diaSemana} between 1 and 7`),
    check('alocacao_horario_valido', sql`${tabela.inicio} < ${tabela.fim}`),
  ],
)
