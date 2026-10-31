import { sql } from 'drizzle-orm'
import { check, foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { AutorDeMensagemDeAgente, ConteudoDaMensagemDoAgente, ConteudoDaMensagemDoUsuario } from '@educa/shared'
import { disciplina } from './disciplina.js'
import { escola } from './escola.js'
import { execucaoAgente } from './execucao-agente.js'
import { threadAgente } from './thread-agente.js'
import { turma } from './turma.js'

/**
 * Uma mensagem da thread (MVP, A2; D18): o que o professor escreveu ao Assistente de ensino, ou o que o Assistente
 * respondeu. É a "conversa do professor com o chat" de `docs/lgpd.md`: 12 meses, e nunca visível à coordenação.
 *
 * - `conteudo` é validado por `conteudoDaMensagemDoUsuarioSchema` ou `conteudoDaMensagemDoAgenteSchema`: o texto do
 *   professor; ou a resposta do agente, que é texto com as páginas citadas ou a **proposta de ferramenta** da D18. O
 *   check garante no banco o tipo, e que só o agente propõe ferramenta. O texto nunca vai a log nem a auditoria.
 * - `turma_id` e `disciplina_id` são o contexto que o professor escolheu ao escrever, e existem só, e sempre, na
 *   mensagem dele (check). Vão por FK composta com a escola e o ano: a mensagem nunca aponta para a turma de outra escola.
 * - Toda mensagem pertence a uma execução: a do professor é a que a disparou, e a do agente, a que ela produziu. Índice
 *   único `(escola_id, execucao_id, autor)`: o reenvio com a mesma chave não grava a pergunta de novo, e a reexecução não
 *   grava duas respostas (D49; regra 80, item 7).
 * - A thread por FK composta `(escola_id, ano_letivo_id, thread_id)`, `on delete cascade`: some com a thread, que some
 *   com o dono.
 * - Índice `(escola_id, thread_id, id)`: a conversa paginada para trás, pelo id (v7, na ordem do tempo), começa pelo
 *   escopo (regra 80, item 8).
 */
export const mensagemAgente = pgTable(
  'mensagem_agente',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    threadId: uuid().notNull(),
    execucaoId: uuid().notNull(),
    autor: text().$type<AutorDeMensagemDeAgente>().notNull(),
    conteudo: jsonb().$type<ConteudoDaMensagemDoUsuario | ConteudoDaMensagemDoAgente>().notNull(),
    turmaId: uuid(),
    disciplinaId: uuid(),
    criadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    foreignKey({
      name: 'mensagem_agente_thread_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.threadId],
      foreignColumns: [threadAgente.escolaId, threadAgente.anoLetivoId, threadAgente.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'mensagem_agente_execucao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.execucaoId],
      foreignColumns: [execucaoAgente.escolaId, execucaoAgente.anoLetivoId, execucaoAgente.id],
    }),
    foreignKey({
      name: 'mensagem_agente_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    foreignKey({ name: 'mensagem_agente_disciplina_da_escola_fk', columns: [tabela.escolaId, tabela.disciplinaId], foreignColumns: [disciplina.escolaId, disciplina.id] }),
    uniqueIndex('mensagem_agente_uma_por_execucao').on(tabela.escolaId, tabela.execucaoId, tabela.autor),
    index('mensagem_agente_thread_idx').on(tabela.escolaId, tabela.threadId, tabela.id),
    // A faixa da troca de nome (F3, tarefa 15.0) percorre a escola por `id`; `conteudo` nunca é nulo, então o índice é inteiro.
    index('mensagem_agente_escola_id_idx').on(tabela.escolaId, tabela.id),
    // O expurgo da escola (F3, tarefa 3.0) apaga a conversa vencida pela data, em lotes.
    index('mensagem_agente_criada_em_idx').on(tabela.escolaId, tabela.criadaEm),
    check('mensagem_agente_autor_valido', sql`${tabela.autor} in ('usuario', 'agente')`),
    check(
      'mensagem_agente_conteudo_do_autor',
      sql`jsonb_typeof(${tabela.conteudo}) = 'object' and (coalesce(${tabela.conteudo} ->> 'tipo', '') = 'texto' or (${tabela.autor} = 'agente' and coalesce(${tabela.conteudo} ->> 'tipo', '') = 'proposta_de_ferramenta'))`,
    ),
    check(
      'mensagem_agente_contexto_so_do_usuario',
      sql`(${tabela.autor} = 'usuario') = (${tabela.turmaId} is not null) and (${tabela.turmaId} is not null) = (${tabela.disciplinaId} is not null)`,
    ),
  ],
)
