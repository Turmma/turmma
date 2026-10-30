import { sql } from 'drizzle-orm'
import { check, foreignKey, jsonb, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { DestaquesAbertos, LoteApresentado } from '@educa/shared'
import { atividadeAplicada } from './atividade-aplicada.js'
import { entrega } from './entrega.js'
import { escola } from './escola.js'

/**
 * O registro da validação humana do lote de correção (glossário, "Validação qualificada e documentada"; D33, D56; regra
 * 70): **o que foi apresentado ao professor, o que ele abriu, quem confirmou e quando.** É o que a escola mostra à
 * fiscalização para provar que a validação foi efetiva, e não um clique em "aprovar". Retenção igual à da auditoria
 * (`docs/lgpd.md`): vigência mais cinco anos.
 *
 * - `apresentado` (`loteApresentadoSchema`) é a **cópia** do resumo do lote (corrigidos, média de acertos, distribuição,
 *   por habilidade e por questão) e dos destaques que a tela mostrou, cada um com o id do aluno e os motivos. `aberto`
 *   (`destaquesAbertosSchema`) é cada destaque que o professor abriu, com a hora. É cópia, e não referência: a correção
 *   sai do banco se o aluno for eliminado, e a prova do que foi apresentado precisa ficar. Só ids, números e códigos:
 *   sem nome, e sem texto.
 * - **O banco recusa a validação com caso destacado sem abrir** (`DESTAQUES_NAO_ABERTOS`), mesmo por fora da API, por
 *   duas travas. O check `validacao_do_lote_destaques_todos_abertos` compara o registro com ele mesmo: todo destaque de
 *   `apresentado` está em `aberto`. O gatilho `validacao_do_lote_destaques_do_lote` (0023) compara o registro com as
 *   **correções do lote**: toda `correcao` com destaque precisa estar aberta (`destaque_aberto_em`) e constar de
 *   `apresentado.destaques`. Sem ele, um registro com a lista de destaques vazia aprovaria um lote com caso destacado
 *   que ninguém abriu.
 * - Índice único `(escola_id, entrega_id)`: uma validação por lote. O duplo clique em aprovar grava uma, e o segundo cai
 *   no 23505 (regra 80, item 7).
 * - FK composta `(escola_id, entrega_id, atividade_aplicada_id)` para a entrega, com a aplicação obrigatória: a
 *   validação só existe para entrega que é lote de correção. É ela que o gatilho adiado da `entrega` procura antes de
 *   deixar o lote ficar `aprovada`.
 * - FK composta `(escola_id, ano_letivo_id, atividade_aplicada_id)` para a aplicação: o ano da validação é o dela.
 * - `confirmada_por` é conferido pelo gatilho `validacao_do_lote_confirmada_por_da_equipe` (a função
 *   `exigir_equipe_da_escola`, da 0023: professor ou coordenação da escola), sem FK: a eliminação do professor não apaga
 *   quem confirmou.
 * - Não se altera nem se apaga: nenhuma rota faz `update` ou `delete` aqui.
 */
export const validacaoDoLote = pgTable(
  'validacao_do_lote',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    entregaId: uuid().notNull(),
    atividadeAplicadaId: uuid().notNull(),
    apresentado: jsonb().$type<LoteApresentado>().notNull(),
    aberto: jsonb().$type<DestaquesAbertos>().notNull(),
    confirmadaPor: uuid().notNull(),
    confirmadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    foreignKey({
      name: 'validacao_do_lote_lote_da_aplicacao_da_escola_fk',
      columns: [tabela.escolaId, tabela.entregaId, tabela.atividadeAplicadaId],
      foreignColumns: [entrega.escolaId, entrega.id, entrega.atividadeAplicadaId],
    }),
    foreignKey({
      name: 'validacao_do_lote_aplicacao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId],
      foreignColumns: [atividadeAplicada.escolaId, atividadeAplicada.anoLetivoId, atividadeAplicada.id],
    }),
    uniqueIndex('validacao_do_lote_uma_por_lote').on(tabela.escolaId, tabela.entregaId),
    check(
      'validacao_do_lote_formato',
      sql`jsonb_typeof(${tabela.apresentado}) = 'object' and coalesce(jsonb_typeof(${tabela.apresentado} -> 'resumo'), '') = 'object' and coalesce(jsonb_typeof(${tabela.apresentado} -> 'destaques'), '') = 'array' and jsonb_typeof(${tabela.aberto}) = 'array'`,
    ),
    check(
      'validacao_do_lote_destaques_todos_abertos',
      sql`jsonb_path_query_array(${tabela.apresentado}, '$.destaques[*].alunoId') <@ jsonb_path_query_array(${tabela.aberto}, '$[*].alunoId')`,
    ),
  ],
)
