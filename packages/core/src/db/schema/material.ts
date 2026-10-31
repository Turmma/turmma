import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { EstadoDeMaterial, FalhaDeMaterial, LicencaDeMaterial, TitularidadeDeMaterial } from '@educa/shared'
import { disciplina } from './disciplina.js'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

/**
 * O material que a coordenação sobe (glossário, "Material"; MVP, A2; D5, D22, D75). **O arquivo não é guardado**: aqui
 * ficam os metadados, a titularidade, a licença, a declaração e o estado; o texto, por página, vai para `trecho`
 * (`docs/mvp-rapido.md`, seção 4, item 3). Pertence ao tenant e nunca cruza para outra escola (regra 60, item 10). Não
 * varia por ano letivo: a apostila de 2026 continua valendo em 2027.
 *
 * - Check `material_com_declaracao`: não existe material sem a declaração de que a escola pode usá-lo. O envio sem
 *   licença ou sem declaração **não grava linha aqui**: grava auditoria (`material.recusado`) e responde
 *   `MATERIAL_SEM_LICENCA` antes de abrir o arquivo. O check segura o caminho que não passa pela API (seed, job, insert à mão).
 * - `licenca` só aceita as quatro com que um material entra; `sem_licenca`, que o formulário manda, não cabe na coluna.
 * - `licenciante` é o nome do dono do direito, e existe só, e sempre, no material de terceiro (check).
 * - `sha256` é o resumo do arquivo, que não fica: o índice único parcial `(escola_id, sha256)` entre os não excluídos e
 *   não falhos faz o mesmo PDF enviado duas vezes, mesmo ao mesmo tempo, entrar uma vez (regra 80, item 7). O que falhou
 *   pode ser enviado de novo, e o mesmo arquivo em outra escola é outro material.
 * - A disciplina por FK composta com a escola, sem ação: a disciplina com material não se exclui. `unique (escola_id,
 *   disciplina_id, id)` é o alvo do trecho, que carrega a disciplina para a busca.
 * - Exclusão lógica (`excluido_em`; regra 20, item 15): a linha fica enquanto a conversa do Tutor ou um sinal ainda a
 *   cita e até o prazo de `material_excluido` (F3, tarefa 5.0), e os trechos saem na mesma transação; depois disso a linha
 *   sai, e o artefato que a citava mostra «material da escola». Quem enviou e quem excluiu viram nulo se a pessoa for eliminada (`on delete set null
 *   (coluna)`, escrito à mão na 0022), e a autoria fica na auditoria (`material.enviado`, `material.excluido`).
 * - Índice `(escola_id, disciplina_id, id)`: a listagem paginada, da coordenação e do professor pela disciplina dele.
 */
export const material = pgTable(
  'material',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    disciplinaId: uuid().notNull(),
    titulo: text().notNull(),
    titularidade: text().$type<TitularidadeDeMaterial>().notNull(),
    licenciante: text(),
    licenca: text().$type<LicencaDeMaterial>().notNull(),
    declaracao: boolean().notNull(),
    sha256: text().notNull(),
    tamanhoBytes: integer().notNull(),
    paginas: integer(),
    estado: text().$type<EstadoDeMaterial>().notNull().default('processando'),
    falha: text().$type<FalhaDeMaterial>(),
    enviadoPor: uuid(),
    enviadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    excluidoPor: uuid(),
    excluidoEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('material_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('material_escola_disciplina_id_unico').on(tabela.escolaId, tabela.disciplinaId, tabela.id),
    foreignKey({ name: 'material_disciplina_da_escola_fk', columns: [tabela.escolaId, tabela.disciplinaId], foreignColumns: [disciplina.escolaId, disciplina.id] }),
    // A migration escreve `on delete set null ("enviado_por")` e `("excluido_por")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'material_enviado_por_da_escola_fk', columns: [tabela.escolaId, tabela.enviadoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    foreignKey({ name: 'material_excluido_por_da_escola_fk', columns: [tabela.escolaId, tabela.excluidoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    uniqueIndex('material_arquivo_na_escola_unico').on(tabela.escolaId, tabela.sha256).where(sql`${tabela.excluidoEm} is null and ${tabela.estado} <> 'falhou'`),
    index('material_disciplina_idx').on(tabela.escolaId, tabela.disciplinaId, tabela.id),
    // O expurgo do `material_excluido` (F3, tarefa 5.0): só o excluído, do mais antigo.
    index('material_excluido_idx').on(tabela.escolaId, tabela.excluidoEm).where(sql`${tabela.excluidoEm} is not null`),
    // 160 e 120 são `TAMANHO_MAXIMO_TITULO_DO_MATERIAL` e `TAMANHO_MAXIMO_DO_LICENCIANTE` do contrato (`packages/shared`).
    check('material_titulo_preenchido', sql`char_length(btrim(${tabela.titulo})) between 1 and 160`),
    check('material_titularidade_valida', sql`${tabela.titularidade} in ('escola', 'professor', 'terceiro_com_licenca', 'dominio_publico')`),
    check('material_licenca_valida', sql`${tabela.licenca} in ('dominio_publico', 'autoria_da_escola', 'licenca_aberta', 'licenca_comercial_autorizada')`),
    check('material_com_declaracao', sql`${tabela.declaracao}`),
    check('material_licenciante_so_de_terceiro', sql`(${tabela.titularidade} = 'terceiro_com_licenca') = (${tabela.licenciante} is not null)`),
    check('material_licenciante_preenchido', sql`${tabela.licenciante} is null or char_length(btrim(${tabela.licenciante})) between 1 and 120`),
    check('material_sha256_formato', sql`${tabela.sha256} ~ '^[0-9a-f]{64}$'`),
    // 20 MB, `MAXIMO_DE_BYTES_DO_MATERIAL` do contrato.
    check('material_tamanho_valido', sql`${tabela.tamanhoBytes} between 1 and 20971520`),
    check('material_paginas_validas', sql`${tabela.paginas} is null or ${tabela.paginas} >= 1`),
    check('material_estado_valido', sql`${tabela.estado} in ('processando', 'pronto', 'falhou')`),
    check('material_falha_valida', sql`${tabela.falha} is null or ${tabela.falha} in ('arquivo_invalido', 'sem_texto', 'extracao_falhou')`),
    check('material_falha_so_no_que_falhou', sql`(${tabela.estado} = 'falhou') = (${tabela.falha} is not null)`),
    check('material_pronto_tem_paginas', sql`${tabela.estado} <> 'pronto' or ${tabela.paginas} is not null`),
    check('material_excluido_por_so_no_excluido', sql`${tabela.excluidoPor} is null or ${tabela.excluidoEm} is not null`),
  ],
)
