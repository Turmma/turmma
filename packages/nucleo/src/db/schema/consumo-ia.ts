import { sql } from 'drizzle-orm'
import { bigint, boolean, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { ChaveDeFuncao, ErrorCode, EstadoDeConsumoDeIa, OrigemDaSaidaDeIa, PerfilDeIa } from '@educa/shared'
import { escola } from './escola.js'
import { execucaoAgente } from './execucao-agente.js'
import { usuario } from './usuario.js'

/**
 * Uma chamada à camada de IA, medida (glossário, "Orçamento de IA"; regra 30, item 4; D14): é a tabela da porta
 * `RegistroDeConsumo` (`packages/nucleo/src/ia/consumo.ts`). Guarda a tarefa, a função, o perfil, quem atendeu, o
 * modelo, a versão do prompt, os tokens de entrada e de saída, o custo, a duração, as tentativas, se saiu para provedor
 * externo e como terminou. Sustenta a governança (`GET /v1/governanca/consumo`), a precificação e a resposta à escola
 * sobre o que foi enviado para fora. Uma execução pode ter mais de uma chamada.
 *
 * - **`entrada` e `saida` (regra 20 contra regra 30, item 4).** Guardam o que foi ao modelo e o que voltou, para a escola
 *   poder perguntar por que a IA disse algo. **Ficam nulas onde a chamada leva conversa de pessoa**, e o check
 *   `consumo_ia_sem_conversa_de_pessoa` (0023) garante: nas funções do Tutor, em que o texto é do aluno, e na tarefa
 *   `propor_ferramenta`, em que é a mensagem do professor ao Assistente. A conversa já está em `mensagem_tutor` e em
 *   `mensagem_agente`, com a retenção e o acesso de lá, e não se duplica numa tabela de métrica. Nas outras tarefas
 *   (atividade, plano, adaptação, relatório da correção, resumo do Analista) vão o tema, os parâmetros, os trechos do
 *   material e números. **O schema estrito da tarefa barra chave, não texto**: o tema é texto livre do professor, e
 *   nada impede que ele escreva um nome ali; por isso a retenção é a da conversa dele (`docs/lgpd.md`). Nunca vão a log
 *   (regra 20, item 9), e nenhuma rota as devolve: a governança só soma números.
 * - **Não existe consumo por professor** (D64): a tabela não tem coluna de usuário. `aluno_id` só existe nas funções do
 *   Tutor (check), e vira nulo se o aluno for eliminado (`on delete set null (aluno_id)`, escrito à mão na 0022): o custo
 *   da escola fica, sem a pessoa.
 * - **O freio diário do Tutor (D38)** conta as chamadas do aluno no dia, uma por troca, inclusive a de regra fixa: o
 *   índice parcial `(escola_id, aluno_id, em)` é dele. O limite vem de `configuracao_operacional_escola.tutor_trocas_por_dia`,
 *   nunca de constante. O pacote do mês da turma conta as mensagens do aluno em `mensagem_tutor`, que tem a turma.
 * - `custo_micros` é o custo em **milionésimos de real**, inteiro: a soma de milhares de chamadas de fração de centavo
 *   não perde nada. Zero no adaptador falso, no modelo local e na regra fixa, e é o padrão da coluna.
 * - `codigo_de_erro` é um `ErrorCode` da camada de IA, e o check só aceita o formato de código: a mensagem do provedor
 *   não cabe.
 * - Sem `ano_letivo_id`: é série no tempo, somada por mês, como `uso_infra_diario`.
 * - Índice `(escola_id, funcao, em)`: o consumo do mês por função começa pelo escopo (regra 80, item 8).
 * - **Anonimizado no prazo** (F3, tarefa 4.0): o expurgo noturno da escola anula `entrada` e `saida` na categoria
 *   `texto_do_modelo` e `aluno_id` na `consumo_por_aluno`, contadas de `em`, cada uma pelo seu índice parcial
 *   `(escola_id, em)`. A linha e os números ficam: a soma da governança não muda.
 */
export const consumoIa = pgTable(
  'consumo_ia',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    alunoId: uuid(),
    execucaoId: uuid(),
    tarefa: text().notNull(),
    funcao: text().$type<ChaveDeFuncao>().notNull(),
    perfil: text().$type<PerfilDeIa>().notNull(),
    origem: text().$type<OrigemDaSaidaDeIa>().notNull(),
    modelo: text().notNull(),
    promptVersao: text().notNull(),
    tokensDeEntrada: integer().notNull(),
    tokensDeSaida: integer().notNull(),
    custoMicros: bigint({ mode: 'number' }).notNull().default(0),
    duracaoMs: integer().notNull(),
    envioExterno: boolean().notNull(),
    provedor: text(),
    tentativas: integer().notNull(),
    estado: text().$type<EstadoDeConsumoDeIa>().notNull(),
    codigoDeErro: text().$type<ErrorCode>(),
    entrada: jsonb().$type<unknown>(),
    saida: jsonb().$type<unknown>(),
    em: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    foreignKey({ name: 'consumo_ia_execucao_da_escola_fk', columns: [tabela.escolaId, tabela.execucaoId], foreignColumns: [execucaoAgente.escolaId, execucaoAgente.id] }),
    // A migration escreve `on delete set null ("aluno_id")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'consumo_ia_aluno_da_escola_fk', columns: [tabela.escolaId, tabela.alunoId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    index('consumo_ia_funcao_idx').on(tabela.escolaId, tabela.funcao, tabela.em),
    index('consumo_ia_aluno_idx').on(tabela.escolaId, tabela.alunoId, tabela.em).where(sql`${tabela.alunoId} is not null`),
    // O ramo da execução do rastro e da contagem do texto do modelo, que descem pelas execuções que a pessoa pediu (F3, 13.0):
    // sem ele, a consulta lê o consumo da escola inteira (regra 80, item 8).
    index('consumo_ia_execucao_idx').on(tabela.escolaId, tabela.execucaoId).where(sql`${tabela.execucaoId} is not null`),
    // Os dois lotes do expurgo da escola (F3, tarefa 4.0): o texto do modelo e o aluno, cada um pela idade da chamada.
    index('consumo_ia_texto_a_anular_idx').on(tabela.escolaId, tabela.em).where(sql`${tabela.entrada} is not null or ${tabela.saida} is not null`),
    index('consumo_ia_aluno_a_anular_idx').on(tabela.escolaId, tabela.em).where(sql`${tabela.alunoId} is not null`),
    // A troca do nome do titular percorre cada coluna de texto em faixas de 1.000 linhas por `id` (F3, tarefa 15.0): sem estes,
    // a faixa leria o consumo da escola inteira para achar o que tem texto (regra 80, item 8). Parciais: o Tutor e a proposta
    // de ferramenta não guardam texto, e o texto anulado pelo expurgo sai do índice.
    index('consumo_ia_entrada_idx').on(tabela.escolaId, tabela.id).where(sql`${tabela.entrada} is not null`),
    index('consumo_ia_saida_idx').on(tabela.escolaId, tabela.id).where(sql`${tabela.saida} is not null`),
    check(
      'consumo_ia_funcao_valida',
      sql`${tabela.funcao} in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')`,
    ),
    check('consumo_ia_perfil_valido', sql`${tabela.perfil} in ('rapido', 'padrao', 'complexo', 'visao')`),
    check('consumo_ia_origem_valida', sql`${tabela.origem} in ('falso', 'openai_compat', 'regra_fixa')`),
    check('consumo_ia_estado_valido', sql`${tabela.estado} in ('concluida', 'falhou')`),
    // O nome da tarefa é o do catálogo da camada de IA: minúsculas e sublinhado, nunca texto livre.
    check('consumo_ia_tarefa_e_nome', sql`${tabela.tarefa} ~ '^[a-z][a-z0-9_]{2,63}$'`),
    check('consumo_ia_modelo_preenchido', sql`char_length(btrim(${tabela.modelo})) between 1 and 120`),
    check('consumo_ia_prompt_versao_preenchida', sql`char_length(btrim(${tabela.promptVersao})) between 1 and 60`),
    check(
      'consumo_ia_numeros_validos',
      sql`${tabela.tokensDeEntrada} >= 0 and ${tabela.tokensDeSaida} >= 0 and ${tabela.custoMicros} >= 0 and ${tabela.duracaoMs} >= 0 and ${tabela.tentativas} >= 0`,
    ),
    // Quem recebeu o conteúdo só existe onde ele saiu. A exigência no sentido contrário (envio externo sempre com
    // provedor) fica para um release posterior ao do F3: ela quebraria o rollback (Tech Spec do F3, seção 3).
    check('consumo_ia_provedor_so_no_envio_externo', sql`${tabela.provedor} is null or ${tabela.envioExterno}`),
    // `FORMATO_DO_CODIGO_DE_ERRO` do contrato (`packages/shared`).
    check('consumo_ia_erro_e_codigo', sql`${tabela.codigoDeErro} is null or ${tabela.codigoDeErro} ~ '^[A-Z][A-Z0-9_]{2,63}$'`),
    check('consumo_ia_erro_so_no_que_falhou', sql`(${tabela.estado} = 'falhou') = (${tabela.codigoDeErro} is not null)`),
    check('consumo_ia_aluno_so_no_tutor', sql`${tabela.alunoId} is null or ${tabela.funcao} in ('tutor_com_o_aluno', 'sinais_para_o_professor')`),
    check(
      'consumo_ia_sem_conversa_de_pessoa',
      sql`(${tabela.funcao} not in ('tutor_com_o_aluno', 'sinais_para_o_professor') and ${tabela.tarefa} <> 'propor_ferramenta') or (${tabela.entrada} is null and ${tabela.saida} is null)`,
    ),
  ],
)
