import { sql, type SQL } from 'drizzle-orm'
import { check, customType, foreignKey, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { material } from './material.js'

/** `tsvector` do Postgres: o drizzle não tem a coluna pronta. Só o banco a escreve (coluna gerada), e ninguém a lê. */
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })

/**
 * O texto de uma página do material (glossário, "Trecho indexado"; MVP, A2; D6): é o que a busca acha e o que toda
 * citação aponta, com material e página. Um trecho por página que tem texto. Sem `embedding` nesta fatia: a busca é por
 * texto completo do Postgres, em português (`docs/mvp-rapido.md`, seção 4, item 2).
 *
 * - `busca` é coluna gerada, `to_tsvector('portuguese', texto)`: "reagentes" acha "reagente", e a busca não depende de o
 *   código lembrar de atualizar nada.
 * - Índice GIN `(escola_id, disciplina_id, busca)`, com `btree_gin` (a 0022 cria a extensão): **começa pelo escopo**
 *   (regra 80, item 8). A busca de uma escola não percorre o texto das outras, e o filtro por disciplina usa o mesmo
 *   índice. Toda consulta filtra por `escola_id` do contexto (regra 10, item 3): o índice não substitui o filtro.
 * - FK composta `(escola_id, disciplina_id, material_id)` para o material, `on delete cascade`: o trecho nunca aponta
 *   para o material de outra escola, a disciplina dele é sempre a do material, e some com ele. Na exclusão lógica do
 *   material os trechos são apagados na mesma transação: texto de material excluído não continua na busca.
 * - Único `(escola_id, material_id, pagina)`: extrair a mesma página duas vezes não cria dois trechos (regra 80, item 7),
 *   e é por ele que se leem as páginas de um material em ordem.
 * - Sem dado de pessoa: é texto de material didático. Não varia por ano letivo, como o material.
 */
export const trecho = pgTable(
  'trecho',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    disciplinaId: uuid().notNull(),
    materialId: uuid().notNull(),
    /** Página do PDF, a partir de 1. */
    pagina: integer().notNull(),
    texto: text().notNull(),
    busca: tsvector().generatedAlwaysAs((): SQL => sql`to_tsvector('portuguese', ${trecho.texto})`),
  },
  (tabela) => [
    foreignKey({
      name: 'trecho_material_da_disciplina_da_escola_fk',
      columns: [tabela.escolaId, tabela.disciplinaId, tabela.materialId],
      foreignColumns: [material.escolaId, material.disciplinaId, material.id],
    }).onDelete('cascade'),
    uniqueIndex('trecho_pagina_do_material_unica').on(tabela.escolaId, tabela.materialId, tabela.pagina),
    index('trecho_busca_idx').using('gin', tabela.escolaId, tabela.disciplinaId, tabela.busca),
    check('trecho_pagina_valida', sql`${tabela.pagina} >= 1`),
    check('trecho_texto_preenchido', sql`char_length(${tabela.texto}) between 1 and 20000`),
  ],
)
