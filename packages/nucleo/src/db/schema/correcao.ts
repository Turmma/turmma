import { sql } from 'drizzle-orm'
import { check, foreignKey, index, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { DiagnosticoGravado, MotivoDeDestaque } from '@educa/shared'
import { entrega } from './entrega.js'
import { escola } from './escola.js'
import { tentativaAtividade } from './tentativa-atividade.js'

/**
 * A correção de objetiva de um aluno numa atividade aplicada, dentro de um lote (glossário, "Correção" e "Diagnóstico";
 * MVP, A3; D33, D46). É **determinística**, pelo gabarito: `acertos`, `total` e `em_branco` são contagens de questões, e
 * `por_habilidade` é o diagnóstico formativo (`diagnosticoGravadoSchema`: código do catálogo, acertos e total).
 *
 * - **Não é `Nota`, e não existe tabela `nota` nesta fatia** (D46). Nenhuma coluna guarda nota, conceito, pontuação
 *   convertida nem devolutiva em texto, e nada aqui é sobre resposta discursiva (D55). O que a IA escreve entra no
 *   relatório do lote, nunca na conta.
 * - A correção pertence ao lote (`entrega_id`), que nasce pendente. **O aluno só a alcança com o lote `aprovada`**: a
 *   leitura do aluno junta a entrega pelo estado, e a turma e a coordenação só somam lote aprovado.
 * - `destaques` são os motivos, de lista fechada, pelos quais esta correção precisa ser aberta antes da aprovação (D33):
 *   fato sobre o trabalho, sem texto. `destaque_aberto_em` e `destaque_aberto_por` registram a abertura pelo professor
 *   (D56), uma vez só (`update … where destaque_aberto_em is null`); só o que tem destaque se abre (check). Quem abriu é
 *   conferido pelo gatilho `correcao_destaque_aberto_por_da_equipe` (0023: professor ou coordenação da escola), sem FK.
 *   **A validação do lote só entra com todo destaque daqui aberto** (gatilho da `validacao_do_lote`, 0023).
 * - Índice único `(escola_id, entrega_id, aluno_id)`: o job de correção que roda duas vezes não cria duas correções do
 *   mesmo aluno no lote (regra 80, item 7), e é por ele que se lê o lote inteiro, pelo escopo.
 * - FK composta `(escola_id, entrega_id, atividade_aplicada_id)` para a entrega: a correção só existe em entrega que é
 *   lote, e da mesma atividade aplicada. FK composta para a tentativa, `on delete cascade`: some com a tentativa, que
 *   some com o aluno eliminado; o registro da validação guarda a cópia do que foi apresentado.
 * - Índice `(escola_id, aluno_id, id)`: o histórico do próprio aluno, para o `fora_do_historico` e a memória do Tutor.
 */
export const correcao = pgTable(
  'correcao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    entregaId: uuid().notNull(),
    atividadeAplicadaId: uuid().notNull(),
    alunoId: uuid().notNull(),
    acertos: smallint().notNull(),
    total: smallint().notNull(),
    emBranco: smallint().notNull(),
    porHabilidade: jsonb().$type<DiagnosticoGravado>().notNull(),
    destaques: text().array().$type<MotivoDeDestaque[]>().notNull().default(sql`'{}'::text[]`),
    destaqueAbertoEm: timestamp({ withTimezone: true }),
    destaqueAbertoPor: uuid(),
    corrigidaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    foreignKey({
      name: 'correcao_lote_da_aplicacao_da_escola_fk',
      columns: [tabela.escolaId, tabela.entregaId, tabela.atividadeAplicadaId],
      foreignColumns: [entrega.escolaId, entrega.id, entrega.atividadeAplicadaId],
    }),
    foreignKey({
      name: 'correcao_tentativa_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.atividadeAplicadaId, tabela.alunoId],
      foreignColumns: [tentativaAtividade.escolaId, tentativaAtividade.anoLetivoId, tentativaAtividade.atividadeAplicadaId, tentativaAtividade.alunoId],
    }).onDelete('cascade'),
    uniqueIndex('correcao_uma_por_aluno_no_lote').on(tabela.escolaId, tabela.entregaId, tabela.alunoId),
    index('correcao_aluno_idx').on(tabela.escolaId, tabela.alunoId, tabela.id),
    // O que o arquivo do professor lê: os destaques que ele abriu (F3, 13.0; regra 80, item 8). Parcial: a maioria é nula.
    index('correcao_destaque_aberto_por_idx').on(tabela.escolaId, tabela.destaqueAbertoPor).where(sql`${tabela.destaqueAbertoPor} is not null`),
    check('correcao_contagem_valida', sql`${tabela.total} between 1 and 20 and ${tabela.acertos} >= 0 and ${tabela.emBranco} >= 0 and ${tabela.acertos} + ${tabela.emBranco} <= ${tabela.total}`),
    check('correcao_por_habilidade_e_lista', sql`jsonb_typeof(${tabela.porHabilidade}) = 'array'`),
    check('correcao_destaques_validos', sql`${tabela.destaques} <@ array['em_branco', 'fora_do_historico', 'padrao_de_erro']::text[]`),
    check(
      'correcao_abertura_so_de_destaque',
      sql`(${tabela.destaqueAbertoEm} is null) = (${tabela.destaqueAbertoPor} is null) and (${tabela.destaqueAbertoEm} is null or cardinality(${tabela.destaques}) > 0)`,
    ),
  ],
)
