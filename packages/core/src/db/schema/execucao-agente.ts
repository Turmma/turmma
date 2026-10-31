import { sql } from 'drizzle-orm'
import { check, foreignKey, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { ChaveDeFuncao, ErrorCode, ExecucaoInput, EstadoDeExecucao, ResultadoGravado, TarefaDeIa } from '@educa/shared'
import { anoLetivo } from './ano-letivo.js'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

/**
 * Uma execução de agente (MVP, seção 4, item 1; `docs/agentes.md`, "Requisitos de runtime"; D49): todo `POST` que
 * dispara IA grava a linha `pendente` e responde na hora; a execução roda depois e termina `concluida` ou `falhou`. Nesta
 * fatia ela roda no processo da API, atrás do `AgenteExecutor` (`packages/core/src/ia`), e não na fila: dívida
 * declarada, `TODO(fila)`. É a tabela da porta `ExecucaoRepository`.
 *
 * - `chave_envio` é a chave de idempotência (a `chave` da `ExecucaoAgendada`), que a tela sorteia a cada envio. Índice
 *   único `(escola_id, chave_envio)`: o reenvio, o clique duplo e a reexecução caem no 23505, e quem grava relê a execução
 *   pela chave e devolve a mesma, **depois de conferir que é de quem pede** (a chave de outra pessoa responde como
 *   inexistente).
 * - `tarefa` é o nome da tarefa de IA (`TAREFAS_DE_IA`), e `funcao`, a chave do catálogo `FUNCOES`: é por ela que a
 *   suspensão da coordenação alcança a execução (D60). O check `execucao_agente_tarefa_da_funcao` prende cada tarefa à
 *   função dela (`FUNCAO_DA_TAREFA_DE_IA`).
 * - As passagens de estado são um `update` condicional (`pendente` → `rodando` → `concluida` ou `falhou`): duas instâncias
 *   não rodam a mesma execução (regra 80, item 7). Os checks prendem o resultado à concluída, o erro à que falhou e a data
 *   do fim às duas.
 * - `resultado` (`resultadoGravadoSchema`) é **só a referência** ao que a execução gravou: o id da mensagem, do artefato,
 *   da entrega ou do resumo. O texto da resposta do Assistente e do Tutor não é copiado para cá. Cada uma dessas linhas
 *   aponta de volta para a execução por `execucao_id`, com índice único: executar duas vezes não cria dois artefatos nem
 *   duas respostas (D49).
 * - `entrada` leva só o que não está em outra linha (os parâmetros da ferramenta, os tipos de adaptação), validada por
 *   `execucaoInputSchema`. O texto do professor e o do aluno ficam em `mensagem_agente` e `mensagem_tutor`, e nunca
 *   são copiados para cá. Os ids da entrada são conferidos pelo repository, no escopo, na hora de executar.
 * - `erro` é um `ErrorCode` (`IA_INDISPONIVEL`, `EXECUCAO_INTERROMPIDA`...), e o check só aceita o formato de código:
 *   a mensagem do provedor, que pode repetir o prompt, não cabe (regra 20, item 9).
 * - `solicitada_por` é quem pediu, por FK composta com a escola, `on delete set null (solicitada_por)` (escrito à mão na
 *   0022): só quem pediu consulta a execução, e a de quem foi eliminado não responde a mais ninguém.
 * - `unique (escola_id, ano_letivo_id, id)` (0023) é o alvo do que a execução produz (mensagem, artefato, entrega, sinal,
 *   resumo): o produto nunca aponta para a execução de outra escola nem de outro ano letivo. `unique (escola_id, id)` fica
 *   para o consumo, que não tem ano.
 * - O consumo de cada chamada ao modelo fica em `consumo_ia`, com tokens, custo e duração (regra 30, item 4).
 * - Cresce com o Tutor (uma por troca). Lê-se por id ou pela chave. O índice parcial das abertas, `(escola_id, estado,
 *   criada_em)`, só tem as `pendente` e `rodando`: é por ele que a varredura da subida do processo (`falharInterrompidas`,
 *   rotina nossa entre escolas, `@Unscoped`) encerra as que ficaram para trás, sem ler a tabela.
 * - **Anonimizada no prazo** (F3, tarefa 4.0; categoria `execucao_agente` da retenção): o expurgo noturno da escola troca
 *   a `entrada` por `{ tarefa }` (o que o check `execucao_agente_entrada_da_tarefa` exige), anula `solicitada_por` e
 *   grava `anonimizada_em`. A linha, o estado, o `resultado` e o `erro` ficam, e com eles as FKs de quem aponta para ela:
 *   o que a IA gerou continua ligado ao que foi aprovado (regra 70, item 6). O índice parcial `(escola_id, criada_em)`
 *   onde `anonimizada_em is null` é o do lote, e a linha anonimizada sai dele: a noite seguinte não a relê. A execução do
 *   Tutor tem o aluno em `solicitada_por`, e o consumo dela aponta para ela: ela é anonimizada também no prazo de
 *   `consumo_por_aluno`, que nunca passa da conversa do Tutor, pelo índice parcial dela (`funcao = 'tutor_com_o_aluno'`).
 *   Anonimizada, ela não responde a ninguém: a releitura pela chave filtra por `solicitada_por` e dá `NAO_ENCONTRADO`.
 */
export const execucaoAgente = pgTable(
  'execucao_agente',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    funcao: text().$type<ChaveDeFuncao>().notNull(),
    tarefa: text().$type<TarefaDeIa>().notNull(),
    solicitadaPor: uuid(),
    chaveEnvio: uuid().notNull(),
    estado: text().$type<EstadoDeExecucao>().notNull().default('pendente'),
    entrada: jsonb().$type<ExecucaoInput>().notNull(),
    resultado: jsonb().$type<ResultadoGravado>(),
    erro: text().$type<ErrorCode>(),
    criadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    iniciadaEm: timestamp({ withTimezone: true }),
    concluidaEm: timestamp({ withTimezone: true }),
    anonimizadaEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('execucao_agente_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('execucao_agente_escola_ano_id_unico').on(tabela.escolaId, tabela.anoLetivoId, tabela.id),
    foreignKey({ name: 'execucao_agente_ano_letivo_da_escola_fk', columns: [tabela.escolaId, tabela.anoLetivoId], foreignColumns: [anoLetivo.escolaId, anoLetivo.id] }),
    // A migration escreve `on delete set null ("solicitada_por")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'execucao_agente_solicitada_por_da_escola_fk', columns: [tabela.escolaId, tabela.solicitadaPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    uniqueIndex('execucao_agente_chave_na_escola_unica').on(tabela.escolaId, tabela.chaveEnvio),
    // Por pessoa: a eliminação dela (o `on delete set null` da FK `execucao_agente_solicitada_por_da_escola_fk`) acha as execuções por aqui (F3, tarefa 5.0).
    index('execucao_agente_solicitada_por_idx').on(tabela.escolaId, tabela.solicitadaPor).where(sql`${tabela.solicitadaPor} is not null`),
    index('execucao_agente_abertas_idx').on(tabela.escolaId, tabela.estado, tabela.criadaEm).where(sql`${tabela.estado} in ('pendente', 'rodando')`),
    index('execucao_agente_a_anonimizar_idx').on(tabela.escolaId, tabela.criadaEm).where(sql`${tabela.anonimizadaEm} is null`),
    index('execucao_agente_do_tutor_a_anonimizar_idx')
      .on(tabela.escolaId, tabela.criadaEm)
      .where(sql`${tabela.anonimizadaEm} is null and ${tabela.funcao} = 'tutor_com_o_aluno'`),
    check(
      'execucao_agente_funcao_valida',
      sql`${tabela.funcao} in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')`,
    ),
    check(
      'execucao_agente_tarefa_valida',
      sql`${tabela.tarefa} in ('propor_ferramenta', 'gerar_atividade_objetiva', 'gerar_plano_de_aula', 'adaptar_atividade', 'turno_do_tutor', 'relatorio_da_correcao', 'resumo_do_analista')`,
    ),
    check(
      'execucao_agente_tarefa_da_funcao',
      sql`(${tabela.tarefa}, ${tabela.funcao}) in (('propor_ferramenta', 'conversa_e_ferramentas'), ('gerar_atividade_objetiva', 'conversa_e_ferramentas'), ('gerar_plano_de_aula', 'conversa_e_ferramentas'), ('adaptar_atividade', 'adaptacao'), ('turno_do_tutor', 'tutor_com_o_aluno'), ('relatorio_da_correcao', 'correcao_de_objetiva'), ('resumo_do_analista', 'resumo_e_alerta'))`,
    ),
    check('execucao_agente_estado_valido', sql`${tabela.estado} in ('pendente', 'rodando', 'concluida', 'falhou')`),
    check('execucao_agente_entrada_da_tarefa', sql`jsonb_typeof(${tabela.entrada}) = 'object' and coalesce(${tabela.entrada} ->> 'tarefa', '') = ${tabela.tarefa}`),
    check(
      'execucao_agente_resultado_so_na_concluida',
      sql`(${tabela.estado} = 'concluida') = (${tabela.resultado} is not null) and (${tabela.resultado} is null or (jsonb_typeof(${tabela.resultado}) = 'object' and coalesce(${tabela.resultado} ->> 'tipo', '') in ('mensagem', 'artefato', 'mensagem_do_tutor', 'lote_de_correcao', 'resumo_do_analista')))`,
    ),
    // `FORMATO_DO_CODIGO_DE_ERRO` do contrato (`packages/shared`): código nosso, nunca a mensagem do provedor.
    check('execucao_agente_erro_e_codigo', sql`${tabela.erro} is null or ${tabela.erro} ~ '^[A-Z][A-Z0-9_]{2,63}$'`),
    check('execucao_agente_erro_so_na_que_falhou', sql`(${tabela.estado} = 'falhou') = (${tabela.erro} is not null)`),
    check('execucao_agente_rodando_tem_inicio', sql`${tabela.estado} <> 'rodando' or ${tabela.iniciadaEm} is not null`),
    check('execucao_agente_fim_so_na_terminada', sql`(${tabela.estado} in ('concluida', 'falhou')) = (${tabela.concluidaEm} is not null)`),
  ],
)
