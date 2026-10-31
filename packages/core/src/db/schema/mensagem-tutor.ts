import { sql } from 'drizzle-orm'
import { check, foreignKey, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { AutorDeMensagemDoTutor, Citacao, TipoDeMensagemDoTutor } from '@educa/shared'
import { atividadeAplicada } from './atividade-aplicada.js'
import { escola } from './escola.js'
import { execucaoAgente } from './execucao-agente.js'
import { material } from './material.js'
import { turma } from './turma.js'
import { usuario } from './usuario.js'

/**
 * Uma mensagem da conversa do aluno com o Tutor (glossário, "Tutor"; MVP, A4; D8, D47): o que o aluno escreveu, ou o que
 * o Tutor respondeu. É "Conversa com o tutor" em `docs/lgpd.md`: **12 meses**. É dado sensível na prática: o texto nunca
 * vai a log, a auditoria, a métrica nem a outra tabela, e a rede e a coordenação nunca o alcançam (regra 20, item 14).
 *
 * - **Quem lê o quê.** Nesta fatia, o **texto** só o próprio aluno lê (`GET /v1/tutor/conversa`): não há rota que o
 *   entregue a outra pessoa. O **uso** o professor com vínculo confirmado na turma vê (`GET /v1/tutor/uso`): por aluno, as
 *   trocas do dia, a hora da última e em que ele estava. É o que faz não existir uso do Tutor invisível ao professor
 *   (D8, D47; regra 70, item 4), mesmo de quem nunca gerou sinal. Sem conteúdo, sem tempo ocioso e sem histórico de
 *   navegação (regra 70, item 7).
 * - `questao` e `pagina` (0023) dizem em que o aluno estava quando perguntou: o número da questão da atividade aplicada,
 *   ou a página do material. Só existem com a atividade ou o material (checks), e só na mensagem do aluno. São
 *   referência ao trabalho, como no sinal, e a rota de uso devolve só a da última troca.
 * - `tipo`: `texto`, ou `assunto_delicado`, a mensagem fixa da D36, que só o Tutor escreve (check). O texto dela é
 *   gravado como foi dito, para o registro mostrar exatamente o que o aluno leu.
 * - `citacoes` é a página do material que o Tutor citou (`Citacao[]`), e só existe em mensagem dele.
 * - **O pacote do mês da turma (D38) conta as mensagens do aluno daqui**, que têm a turma; o freio do dia por aluno
 *   conta as chamadas dele em `consumo_ia`. Os dois limites vêm de `configuracao_operacional_escola`
 *   (`tutor_trocas_por_mes`, `tutor_trocas_por_dia`), nunca de constante. Para a conta não furar com duas mensagens ao
 *   mesmo tempo, quem grava pega `pg_advisory_xact_lock` do aluno antes de contar (regra 80, item 7). Índice parcial
 *   `(escola_id, turma_id, criada_em, aluno_id) where autor = 'aluno'`: serve à conta e ao uso por turma.
 * - Toda mensagem pertence a uma execução: a do aluno a dispara, a do Tutor é o que ela produz. Índice único
 *   `(escola_id, execucao_id, autor)`: o reenvio não grava a pergunta de novo nem conta outra troca, e a reexecução não
 *   responde duas vezes (D49).
 * - O aluno por FK composta com a escola, `on delete cascade`: a eliminação apaga a conversa de fato. A turma, com a
 *   escola e o ano; a atividade aplicada, com a escola, o ano e **a turma da mensagem** (0023); a execução, com a escola e
 *   o ano; o material, com a escola.
 * - Índice `(escola_id, aluno_id, id)`: a conversa do aluno, paginada para trás, começa pelo escopo (regra 80, item 8).
 * - **A memória do Tutor não é tabela** (D66): é leitura das tentativas, das correções de lote aprovado e dos sinais.
 *   Não existe coluna, aqui nem em lugar nenhum, com texto sobre o jeito, o humor ou o comportamento do aluno.
 */
export const mensagemTutor = pgTable(
  'mensagem_tutor',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    turmaId: uuid().notNull(),
    alunoId: uuid().notNull(),
    execucaoId: uuid().notNull(),
    atividadeAplicadaId: uuid(),
    /** O número da questão em que o aluno estava, a partir de 1. */
    questao: smallint(),
    materialId: uuid(),
    /** A página do material em que o aluno estava, a partir de 1. */
    pagina: integer(),
    autor: text().$type<AutorDeMensagemDoTutor>().notNull(),
    tipo: text().$type<TipoDeMensagemDoTutor>().notNull().default('texto'),
    texto: text().notNull(),
    citacoes: jsonb().$type<Citacao[]>(),
    criadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    foreignKey({
      name: 'mensagem_tutor_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    foreignKey({ name: 'mensagem_tutor_aluno_da_escola_fk', columns: [tabela.escolaId, tabela.alunoId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    foreignKey({
      name: 'mensagem_tutor_execucao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.execucaoId],
      foreignColumns: [execucaoAgente.escolaId, execucaoAgente.anoLetivoId, execucaoAgente.id],
    }),
    foreignKey({
      name: 'mensagem_tutor_atividade_aplicada_da_turma_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.atividadeAplicadaId],
      foreignColumns: [atividadeAplicada.escolaId, atividadeAplicada.anoLetivoId, atividadeAplicada.turmaId, atividadeAplicada.id],
    }),
    foreignKey({ name: 'mensagem_tutor_material_da_escola_fk', columns: [tabela.escolaId, tabela.materialId], foreignColumns: [material.escolaId, material.id] }),
    uniqueIndex('mensagem_tutor_uma_por_execucao').on(tabela.escolaId, tabela.execucaoId, tabela.autor),
    index('mensagem_tutor_aluno_idx').on(tabela.escolaId, tabela.alunoId, tabela.id),
    // O expurgo da escola (F3, tarefa 3.0) apaga a conversa vencida pela data, em lotes: desce por aqui, do escopo à idade.
    index('mensagem_tutor_criada_em_idx').on(tabela.escolaId, tabela.criadaEm),
    // A FK para o material, sem ação: apagar o material excluído (F3, tarefa 5.0) a confere por aqui.
    index('mensagem_tutor_material_idx').on(tabela.escolaId, tabela.materialId).where(sql`${tabela.materialId} is not null`),
    index('mensagem_tutor_trocas_idx').on(tabela.escolaId, tabela.turmaId, tabela.criadaEm, tabela.alunoId).where(sql`${tabela.autor} = 'aluno'`),
    check('mensagem_tutor_autor_valido', sql`${tabela.autor} in ('aluno', 'tutor')`),
    check('mensagem_tutor_tipo_valido', sql`${tabela.tipo} in ('texto', 'assunto_delicado')`),
    check('mensagem_tutor_fixa_so_do_tutor', sql`${tabela.tipo} = 'texto' or ${tabela.autor} = 'tutor'`),
    // 2000 é `TAMANHO_MAXIMO_DA_PERGUNTA_AO_TUTOR` do contrato; a resposta do Tutor tem teto maior.
    check('mensagem_tutor_texto_preenchido', sql`char_length(${tabela.texto}) between 1 and (case when ${tabela.autor} = 'aluno' then 2000 else 8000 end)`),
    check('mensagem_tutor_questao_valida', sql`${tabela.questao} is null or (${tabela.questao} between 1 and 20 and ${tabela.atividadeAplicadaId} is not null and ${tabela.autor} = 'aluno')`),
    check('mensagem_tutor_pagina_valida', sql`${tabela.pagina} is null or (${tabela.pagina} >= 1 and ${tabela.materialId} is not null and ${tabela.autor} = 'aluno')`),
    check('mensagem_tutor_citacoes_so_do_tutor', sql`${tabela.citacoes} is null or (${tabela.autor} = 'tutor' and jsonb_typeof(${tabela.citacoes}) = 'array')`),
  ],
)
