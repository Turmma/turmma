import { sql } from 'drizzle-orm'
import { check, foreignKey, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { ErroDaImportacao, EstadoDaImportacao, TipoDePlanilha } from '@educa/shared'
import { anoLetivo } from './ano-letivo.js'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

/**
 * Uma planilha que a coordenação gravou e o job `estrutura.gravar-planilha` aplica (F2, tarefa 2.0; Tech Spec, seção 3). É
 * a fila e o rastro da importação: quem grava a linha é o gravar (4.0 em diante), e a 2.0 só entrega a tabela.
 *
 * - `linhas` e `marcas` são o dado pessoal da planilha em trânsito (nome e matrícula do aluno, nome e e-mail do professor, os ids
 *   marcados): ficam só enquanto a importação está `na_fila` e são apagadas em toda troca de estado (`docs/lgpd.md`, "Planilha em
 *   gravação"). Sobram o tipo, o estado, as contagens e o código do erro, sem nome nem matrícula.
 * - `resumo` só tem contagens (contrato `resumoDaImportacaoSchema`); `erro` é de lista fechada, nunca o texto do Postgres.
 * - Único parcial `(escola_id) where estado = 'na_fila'`: uma importação na fila por escola, e a segunda é `CONFLITO` (regra 80,
 *   item 7). O índice parcial `(criado_em) where estado = 'na_fila'` é do expurgo da importação parada, que varre as escolas.
 * - `ano_letivo_id` é nulo só na planilha de professores, que não é de um ano (check `importacao_planilha_ano_ou_professores`);
 *   com ele, FK composta com a escola: nunca o ano de outra.
 * - `criado_por` por FK composta com a escola, `on delete set null (criado_por)` (escrito à mão na 0040): a eliminação de quem
 *   gravou não apaga a importação, e a autoria fica na auditoria `planilha.gravada`.
 */
export const importacaoPlanilha = pgTable(
  'importacao_planilha',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid(),
    tipo: text().$type<TipoDePlanilha>().notNull(),
    estado: text().$type<EstadoDaImportacao>().notNull().default('na_fila'),
    linhas: jsonb(),
    marcas: jsonb(),
    assinatura: text().notNull(),
    resumo: jsonb(),
    erro: text().$type<ErroDaImportacao>(),
    criadoPor: uuid(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    concluidaEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('importacao_planilha_escola_id_unico').on(tabela.escolaId, tabela.id),
    foreignKey({ name: 'importacao_planilha_ano_letivo_da_escola_fk', columns: [tabela.escolaId, tabela.anoLetivoId], foreignColumns: [anoLetivo.escolaId, anoLetivo.id] }),
    // A migration escreve `on delete set null ("criado_por")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'importacao_planilha_criado_por_da_escola_fk', columns: [tabela.escolaId, tabela.criadoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    uniqueIndex('importacao_planilha_uma_na_fila_por_escola').on(tabela.escolaId).where(sql`${tabela.estado} = 'na_fila'`),
    index('importacao_planilha_na_fila_idx').on(tabela.criadoEm).where(sql`${tabela.estado} = 'na_fila'`),
    check('importacao_planilha_tipo_valido', sql`${tabela.tipo} in ('alunos', 'professores', 'grade', 'calendario')`),
    check('importacao_planilha_estado_valido', sql`${tabela.estado} in ('na_fila', 'concluida', 'desatualizada', 'falhou')`),
    check('importacao_planilha_erro_valido', sql`${tabela.erro} is null or ${tabela.erro} in ('expirou', 'trava_esgotada', 'erro_interno')`),
    check('importacao_planilha_ano_ou_professores', sql`${tabela.anoLetivoId} is not null or ${tabela.tipo} = 'professores'`),
  ],
)
