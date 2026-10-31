import { sql } from 'drizzle-orm'
import { bigint, check, foreignKey, index, pgTable, smallint, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { tentativaAtividade } from './tentativa-atividade.js'

/**
 * A alternativa que o aluno marcou numa questão (glossário, "Resposta"; MVP, A3). É "Resposta de avaliação" em
 * `docs/lgpd.md`: ano letivo mais um ano. Questão em branco não tem linha.
 *
 * - **Nenhuma resposta se perde nem se duplica** (regra 80, item 6): o índice único `(escola_id, ano_letivo_id,
 *   atividade_aplicada_id, aluno_id, questao)` é o alvo do `on conflict do update`. O `PUT` repetido, o reenvio da tela
 *   quando a rede volta e as duas abas gravam uma linha só, com a última alternativa. É o índice que começa pelo escopo
 *   (regra 80, item 8): a correção lê por ele todas as respostas de uma aplicação.
 * - **Só a escolha mais nova vale** (regra 80, itens 6 e 7; RF21): `sequencia` é a ordem das escolhas do aluno naquela
 *   questão, e o `on conflict do update` só grava com `excluded.sequencia > resposta_atividade.sequencia`. O reenvio
 *   atrasado, o F5 e a outra aba não trocam a escolha mais recente. As linhas anteriores à coluna ficam em 0. Sem índice
 *   próprio: a escrita já vai pelo índice único acima.
 * - `questao` é o **número** da questão, a partir de 1 (a posição em `conteudo.questoes` mais um); `alternativa` é o
 *   **índice**, de 0 a 3, como o `gabarito`. Os checks seguram os dois intervalos.
 * - A tentativa por FK composta `(escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id)`, `on delete cascade`: não
 *   existe resposta sem tentativa, nem de aluno ou atividade de outra escola, e ela some com a tentativa (que some com
 *   o aluno eliminado).
 * - **Não guarda se está certa.** O certo e o errado saem da comparação com o gabarito, na correção, e só chegam ao
 *   aluno depois da aprovação do lote. Só objetiva: não existe coluna de texto, e nada aqui é discursiva (D55).
 */
export const respostaAtividade = pgTable(
  'resposta_atividade',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    atividadeAplicadaId: uuid().notNull(),
    alunoId: uuid().notNull(),
    questao: smallint().notNull(),
    alternativa: smallint().notNull(),
    sequencia: bigint({ mode: 'number' }).notNull().default(0),
    respondidaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    foreignKey({
      name: 'resposta_atividade_tentativa_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId, tabela.alunoId],
      foreignColumns: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId],
    }).onDelete('cascade'),
    uniqueIndex('resposta_atividade_uma_por_questao').on(tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId, tabela.alunoId, tabela.questao),
    // O que o arquivo do titular lê: as respostas de um aluno, pela escola e pela pessoa (F3, 13.0; regra 80, item 8).
    index('resposta_atividade_aluno_idx').on(tabela.escolaId, tabela.alunoId),
    // 20 é `MAXIMO_DE_QUESTOES_POR_ATIVIDADE`, e 0 a 3, as `ALTERNATIVAS_POR_QUESTAO` do contrato (`packages/shared`).
    check('resposta_atividade_questao_valida', sql`${tabela.questao} between 1 and 20`),
    check('resposta_atividade_alternativa_valida', sql`${tabela.alternativa} between 0 and 3`),
  ],
)
