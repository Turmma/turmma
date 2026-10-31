import type { CategoriaDeDadoDoIncidente, RiscoDoIncidente } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { check, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

/**
 * O incidente de segurança que afetou escolas (F3, RF8; Tech Spec do F3, seções 3 e 6; Resolução CD/ANPD 15/2024, art. 10).
 * É da nossa operação, não de escola: **sem `escola_id`**, uma das exceções declaradas da regra 10, item 1
 * (`docs/modelo-de-dados.md`). O mesmo incidente alcança várias escolas, e o que cada uma vê, com números e textos dela, mora
 * na `incidente_escola`. Só o `OperacaoPrivacidadeRepository` o escreve (`ops:incidente registrar`), e a escola o lê só pela
 * junção com a ligação dela, no `IncidenteDaEscolaRepository`; um teste de arquitetura procura outro uso.
 *
 * - `conhecido_em` é quando a Turmma soube, e é daí que contam as 24 h para a escola confirmar o recebimento. Não passa do
 *   `registrado_em`: o registro não conta um incidente que ainda vai ser conhecido.
 * - `registrado_por` é o apelido do operador, no formato de `FORMATO_OPERADOR`, como o `auditoria.autor_operador`.
 * - **Nenhum dado de titular**: o registro guarda o que aconteceu e quantos titulares se estima, nunca quais.
 * - Retenção: 5 anos do `registrado_em` (Resolução CD/ANPD 15/2024, art. 10), apagado pelo `sistema.expurgar-acesso`, que leva
 *   as ligações em cascata.
 */
export const incidente = pgTable(
  'incidente',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    conhecidoEm: timestamp({ withTimezone: true }).notNull(),
    registradoPor: text().notNull(),
    registradoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    check('incidente_conhecido_antes_do_registro', sql`${tabela.conhecidoEm} <= ${tabela.registradoEm}`),
    check('incidente_registrado_por_formato', sql`${tabela.registradoPor} ~ '^[a-z][a-z0-9-]{1,31}$'`),
  ],
)

/**
 * A seção do incidente de uma escola (F3, RF8 e RF9; Tech Spec do F3, seções 3, 4 e 5): o que **só ela** lê, com os números e os
 * textos dela, e a confirmação de quem, da coordenação, recebeu o aviso. Tem `escola_id` e é escrita no contexto da escola, que o
 * comando abre antes (regra 10, item 3).
 *
 * - `id` é o da seção, e é ele que a escola vê e confirma: o `incidente_id` é compartilhado entre as escolas afetadas, e mostrá-lo
 *   diria a uma que a outra foi alcançada. Único junto com a escola, a que cada leitura começa.
 * - `categorias` é a lista fechada de `CATEGORIAS_DE_DADO_DO_INCIDENTE`, escrita por extenso no check (o drizzle-kit lê o pacote pelo
 *   `dist`); o teste de integração compara com a constante. `titulares_estimados` é um número, e `risco` a escala da ANPD.
 * - `avisado_em` é quando a seção ficou visível à escola. `confirmado_em` e `confirmado_por` são do primeiro que confirma: a
 *   confirmação é `update … where confirmado_em is null`, e a segunda não muda nada.
 * - `confirmado_por` por FK composta com a escola, `on delete set null ("confirmado_por")` (escrito à mão na migration): a
 *   eliminação de quem confirmou não apaga a seção, e a data da confirmação fica. Quem confirmou é pessoa da coordenação, no mapa
 *   de dados de `docs/lgpd.md`.
 * - Índices: o único `(escola_id, incidente_id)` serve à leitura da escola, que começa pelo escopo; o parcial dos pendentes
 *   `(escola_id, incidente_id) where confirmado_em is null` serve à medição do alerta de 24 h; o do `incidente_id` serve à cascata do
 *   expurgo, que apaga o incidente e leva as seções.
 */
export const incidenteEscola = pgTable(
  'incidente_escola',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    incidenteId: uuid()
      .notNull()
      .references(() => incidente.id, { onDelete: 'cascade' }),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    circunstancias: text().notNull(),
    categorias: text().array().$type<CategoriaDeDadoDoIncidente[]>().notNull(),
    titularesEstimados: integer().notNull(),
    risco: text().$type<RiscoDoIncidente>().notNull(),
    contencao: text().notNull(),
    correcao: text().notNull(),
    avisadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    confirmadoEm: timestamp({ withTimezone: true }),
    confirmadoPor: uuid(),
  },
  (tabela) => [
    unique('incidente_escola_da_escola_unico').on(tabela.escolaId, tabela.incidenteId),
    // A migration escreve `on delete set null ("confirmado_por")`: o `set null` inteiro anularia também a escola, que é `not null`.
    foreignKey({ name: 'incidente_escola_confirmado_por_da_escola_fk', columns: [tabela.escolaId, tabela.confirmadoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    index('incidente_escola_pendente_idx').on(tabela.escolaId, tabela.incidenteId).where(sql`${tabela.confirmadoEm} is null`),
    index('incidente_escola_incidente_idx').on(tabela.incidenteId),
    check('incidente_escola_circunstancias_tamanho', sql`char_length(${tabela.circunstancias}) between 1 and 1000`),
    check('incidente_escola_contencao_tamanho', sql`char_length(${tabela.contencao}) between 1 and 1000`),
    check('incidente_escola_correcao_tamanho', sql`char_length(${tabela.correcao}) between 1 and 1000`),
    check('incidente_escola_titulares_estimados_validos', sql`${tabela.titularesEstimados} between 0 and 100000000`),
    check('incidente_escola_risco_valido', sql`${tabela.risco} in ('baixo', 'relevante', 'alto')`),
    check(
      'incidente_escola_categorias_validas',
      sql`cardinality(${tabela.categorias}) between 1 and 8 and ${tabela.categorias} <@ array['cadastro', 'conta_de_acesso', 'registro_de_acesso', 'conversa_do_aluno', 'conversa_do_professor', 'trabalho_do_aluno', 'material_da_escola', 'consulta_de_busca']`,
    ),
    check('incidente_escola_confirmado_por_so_no_confirmado', sql`${tabela.confirmadoPor} is null or ${tabela.confirmadoEm} is not null`),
  ],
)
