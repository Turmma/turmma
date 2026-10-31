import { sql } from 'drizzle-orm'
import { check, foreignKey, index, integer, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { TipoDeSinal } from '@educa/shared'
import { atividadeAplicada } from './atividade-aplicada.js'
import { escola } from './escola.js'
import { execucaoAgente } from './execucao-agente.js'
import { material } from './material.js'
import { turma } from './turma.js'
import { usuario } from './usuario.js'

/**
 * O sinal do Tutor para o professor da turma (glossário, "Sinal"; MVP, A4; D34, D36, D57; regra 70, item 7): um **tipo
 * fechado** (`travou`, `resposta_pronta`, `duvida_repetida`, `atencao_humana`) mais a **referência ao trabalho** (a
 * atividade aplicada e a questão, ou o material e a página). É "Sinais de uso de IA" em `docs/lgpd.md`: 12 meses.
 *
 * - **Não existe coluna de texto.** Nada aqui descreve o aluno, o que ele escreveu, o humor, a atenção ou o
 *   comportamento dele, por modelo ou por pessoa (D57, D66). O sinal deriva de fato declarado no uso.
 * - Check `sinal_tutor_atencao_humana_sem_referencia`: o `atencao_humana` (D36) **não carrega nada da conversa**, nem a
 *   atividade, a questão, o material ou a página. O professor fica sabendo que precisa procurar o aluno, e só.
 * - `execucao_id` é a troca que gerou o sinal, e serve só à idempotência: índice único `(escola_id, execucao_id, tipo)`,
 *   para a reexecução não avisar o professor duas vezes (D49). Nenhuma rota do professor o devolve, e por ele não se
 *   chega à conversa.
 * - `questao` é o número da questão, a partir de 1, como em `resposta_atividade`.
 * - O aluno por FK composta com a escola, `on delete cascade`: a eliminação apaga os sinais dele. A turma, com a escola e
 *   o ano; a atividade aplicada, com a escola, o ano e **a turma do sinal** (0023): o sinal lido pelo professor da turma X
 *   nunca aponta para a aplicação da turma Y. A execução, com a escola e o ano; o material, com a escola.
 * - Só o professor com vínculo confirmado na turma lê o sinal nomeado (D34). A coordenação vê a soma por tipo, no resumo
 *   do Analista, nunca a linha.
 * - Índices pelo escopo (regra 80, item 8): `(escola_id, turma_id, id)` para a listagem e o agrupado de "Seu time", e
 *   `(escola_id, aluno_id, id)` para a memória do Tutor.
 */
export const sinalTutor = pgTable(
  'sinal_tutor',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    turmaId: uuid().notNull(),
    alunoId: uuid().notNull(),
    execucaoId: uuid(),
    tipo: text().$type<TipoDeSinal>().notNull(),
    atividadeAplicadaId: uuid(),
    questao: smallint(),
    materialId: uuid(),
    pagina: integer(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    foreignKey({
      name: 'sinal_tutor_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    foreignKey({ name: 'sinal_tutor_aluno_da_escola_fk', columns: [tabela.escolaId, tabela.alunoId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    foreignKey({
      name: 'sinal_tutor_execucao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.execucaoId],
      foreignColumns: [execucaoAgente.escolaId, execucaoAgente.anoLetivoId, execucaoAgente.id],
    }),
    foreignKey({
      name: 'sinal_tutor_atividade_aplicada_da_turma_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.atividadeAplicadaId],
      foreignColumns: [atividadeAplicada.escolaId, atividadeAplicada.anoLetivoId, atividadeAplicada.turmaId, atividadeAplicada.id],
    }),
    foreignKey({ name: 'sinal_tutor_material_da_escola_fk', columns: [tabela.escolaId, tabela.materialId], foreignColumns: [material.escolaId, material.id] }),
    uniqueIndex('sinal_tutor_um_por_execucao').on(tabela.escolaId, tabela.execucaoId, tabela.tipo).where(sql`${tabela.execucaoId} is not null`),
    index('sinal_tutor_turma_idx').on(tabela.escolaId, tabela.turmaId, tabela.id),
    index('sinal_tutor_aluno_idx').on(tabela.escolaId, tabela.alunoId, tabela.id),
    // O expurgo da escola (F3, tarefa 3.0) apaga o sinal vencido pela data, em lotes.
    index('sinal_tutor_criado_em_idx').on(tabela.escolaId, tabela.criadoEm),
    // A FK para o material, sem ação: apagar o material excluído (F3, tarefa 5.0) a confere por aqui.
    index('sinal_tutor_material_idx').on(tabela.escolaId, tabela.materialId).where(sql`${tabela.materialId} is not null`),
    check('sinal_tutor_tipo_valido', sql`${tabela.tipo} in ('travou', 'resposta_pronta', 'duvida_repetida', 'atencao_humana')`),
    check(
      'sinal_tutor_atencao_humana_sem_referencia',
      sql`${tabela.tipo} <> 'atencao_humana' or (${tabela.atividadeAplicadaId} is null and ${tabela.questao} is null and ${tabela.materialId} is null and ${tabela.pagina} is null)`,
    ),
    check('sinal_tutor_questao_valida', sql`${tabela.questao} is null or (${tabela.questao} between 1 and 20 and ${tabela.atividadeAplicadaId} is not null)`),
    check('sinal_tutor_pagina_valida', sql`${tabela.pagina} is null or (${tabela.pagina} >= 1 and ${tabela.materialId} is not null)`),
  ],
)
