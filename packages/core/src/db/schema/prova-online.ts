import { sql } from 'drizzle-orm'
import { check, foreignKey, index, pgTable, primaryKey, smallint, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { atividadeAplicada } from './atividade-aplicada.js'
import { escola } from './escola.js'
import { tentativaAtividade } from './tentativa-atividade.js'
import { usuario } from './usuario.js'

/**
 * As tabelas da prova online (avaliacao-e-correcao, 1.0; Tech Spec, seção 3). Todas as de aluno são **trabalho do aluno**
 * (`trabalho_do_aluno`, `docs/lgpd.md`): saem no expurgo do ano encerrado e na eliminação do aluno (`on delete cascade`), e
 * entram no arquivo do titular pelo `aluno_id`. Cada uma tem `escola_id` e `anoLetivoId`, FK composta com a escola e o ano, e
 * só um repository com `requireEscolaId()` as toca (regra 10).
 *
 * - **`saida_da_aba`**: uma linha por saída contada, **sem `id` e sem tempo** (D70): a chave é um uuid v4 gerado pela tela, só para
 *   a mesma saída reenviada não contar duas vezes. Nenhuma coluna de horário, de qualquer tipo, e nenhum `uuidv7()`, porque o
 *   v7 carrega o milissegundo e refaria a linha do tempo do aluno. A contagem fica em `tentativa_atividade.saidas_da_aba`.
 * - **`tempo_adicional`**: o percentual (25, 50 ou 100) que o professor concedeu a um aluno **naquela prova**, sem motivo. É adaptação,
 *   dado sensível (regra 20, item 3; D35): só o percentual, preso à aplicação, e nunca vai para log, métrica, auditoria por aluno nem
 *   memória do Tutor. O autor é conferido pelo gatilho `exigir_equipe_da_escola`.
 * - **`extensao_de_tempo`**: os minutos a mais que o professor deu durante a prova, a um aluno ou, com `aluno_id` nulo, à turma. A
 *   `chave` (uuid do cliente) é por aplicação: o clique duplo e o reenvio gravam uma extensão só.
 * - **`convocado_da_segunda_chamada`**: quem pode começar a segunda chamada.
 * - **`pulso_da_api`**: a linha única, criada pela migration, que a API atualiza a cada 10 s; e **`indisponibilidade`**: as lacunas do pulso
 *   (a queda do nosso sistema), que o limite da tentativa devolve ao aluno. Sem `escola_id` e sem pessoa: fato global, sem dono
 *   (exceção do item 1 de `docs/modelo-de-dados.md`); a indisponibilidade sai aos 13 meses.
 */
export const saidaDaAba = pgTable(
  'saida_da_aba',
  {
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    atividadeAplicadaId: uuid().notNull(),
    alunoId: uuid().notNull(),
    chave: uuid().notNull(),
  },
  (tabela) => [
    primaryKey({ name: 'saida_da_aba_pk', columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId, tabela.alunoId, tabela.chave] }),
    foreignKey({
      name: 'saida_da_aba_tentativa_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId, tabela.alunoId],
      foreignColumns: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId],
    }).onDelete('cascade'),
    // A chave é uuid v4 (o dígito da versão): o v7 traz o instante da saída.
    check('saida_da_aba_chave_v4', sql`substring(${tabela.chave}::text from 15 for 1) = '4'`),
  ],
)

export const tempoAdicional = pgTable(
  'tempo_adicional',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    atividadeAplicadaId: uuid().notNull(),
    alunoId: uuid().notNull(),
    percentual: smallint().notNull(),
    concedidoPor: uuid().notNull(),
    concedidoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('tempo_adicional_um_por_aluno').on(tabela.escolaId, tabela.atividadeAplicadaId, tabela.alunoId),
    foreignKey({
      name: 'tempo_adicional_aplicacao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId],
      foreignColumns: [atividadeAplicada.escolaId, atividadeAplicada.anoLetivoId, atividadeAplicada.id],
    }),
    foreignKey({ name: 'tempo_adicional_aluno_da_escola_fk', columns: [tabela.escolaId, tabela.alunoId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    // Por aluno: a eliminação dele (o `on delete cascade` acha as linhas por aqui) e o arquivo do titular.
    index('tempo_adicional_aluno_idx').on(tabela.escolaId, tabela.alunoId),
    check('tempo_adicional_percentual_valido', sql`${tabela.percentual} in (25, 50, 100)`),
  ],
)

export const extensaoDeTempo = pgTable(
  'extensao_de_tempo',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    atividadeAplicadaId: uuid().notNull(),
    /** Nulo é a turma toda. */
    alunoId: uuid(),
    minutos: smallint().notNull(),
    concedidaPor: uuid().notNull(),
    concedidaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    chave: uuid().notNull(),
  },
  (tabela) => [
    unique('extensao_de_tempo_chave_por_aplicacao').on(tabela.escolaId, tabela.atividadeAplicadaId, tabela.chave),
    foreignKey({
      name: 'extensao_de_tempo_aplicacao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId],
      foreignColumns: [atividadeAplicada.escolaId, atividadeAplicada.anoLetivoId, atividadeAplicada.id],
    }),
    foreignKey({ name: 'extensao_de_tempo_aluno_da_escola_fk', columns: [tabela.escolaId, tabela.alunoId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    index('extensao_de_tempo_aluno_idx').on(tabela.escolaId, tabela.alunoId),
    check('extensao_de_tempo_minutos_validos', sql`${tabela.minutos} between 1 and 120`),
  ],
)

export const convocadoDaSegundaChamada = pgTable(
  'convocado_da_segunda_chamada',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    atividadeAplicadaId: uuid().notNull(),
    alunoId: uuid().notNull(),
  },
  (tabela) => [
    unique('convocado_da_segunda_chamada_um_por_aluno').on(tabela.escolaId, tabela.atividadeAplicadaId, tabela.alunoId),
    foreignKey({
      name: 'convocado_da_segunda_chamada_aplicacao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId],
      foreignColumns: [atividadeAplicada.escolaId, atividadeAplicada.anoLetivoId, atividadeAplicada.id],
    }),
    foreignKey({ name: 'convocado_da_segunda_chamada_aluno_da_escola_fk', columns: [tabela.escolaId, tabela.alunoId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    index('convocado_da_segunda_chamada_aluno_idx').on(tabela.escolaId, tabela.alunoId),
  ],
)

export const pulsoDaApi = pgTable(
  'pulso_da_api',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    ultimoEm: timestamp({ withTimezone: true }).notNull(),
  },
  () => [
    // Uma linha só: o índice sobre uma constante recusa a segunda.
    uniqueIndex('pulso_da_api_linha_unica').on(sql`(true)`),
  ],
)

export const indisponibilidade = pgTable(
  'indisponibilidade',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    inicio: timestamp({ withTimezone: true }).notNull(),
    fim: timestamp({ withTimezone: true }).notNull(),
  },
  (tabela) => [index('indisponibilidade_fim_idx').on(tabela.fim), check('indisponibilidade_ordenada', sql`${tabela.inicio} < ${tabela.fim}`)],
)
