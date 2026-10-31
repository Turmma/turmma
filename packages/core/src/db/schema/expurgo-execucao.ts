import type { CategoriaDeRetencao } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/**
 * O que o expurgo da escola fez em cada categoria, numa execução (F3, RF5; Tech Spec do F3, seções 3 e 5). Uma linha por
 * categoria percorrida, inclusive quando nada saiu (`linhas = 0`): é o que a operação lê para saber que a rotina rodou,
 * e o que o alerta de duas noites (`expurgo.noites_incompletas`) conta.
 *
 * - **Só ids e números.** Nenhuma coluna diz de quem era o que saiu: `linhas` é a contagem, nunca a lista.
 * - `concluida` é `true` só quando a categoria terminou, e `false` quando a janela letiva abriu e o job parou no meio
 *   dela, com `linhas` parcial. A categoria em que o job nem chegou não tem linha naquela noite, e o alerta a conta
 *   como não concluída. A noite seguinte começa pela categoria da última linha, se ela ficou `false`.
 * - `categoria` só aceita as doze do catálogo, por extenso no check, como a `retencao_escola`.
 * - `em` é o relógio do job quando a linha foi gravada: é por ele que a noite é contada, no fuso da escola.
 * - Índice `(escola_id, em)`: a categoria pendente (a última linha) e as noites do alerta descem por ele, do escopo à data.
 * - Fica 5 anos, pelo próprio expurgo da escola (tarefa 5.0).
 */
export const expurgoExecucao = pgTable(
  'expurgo_execucao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    categoria: text().$type<CategoriaDeRetencao>().notNull(),
    linhas: integer().notNull(),
    concluida: boolean().notNull(),
    em: timestamp({ withTimezone: true }).notNull(),
  },
  (tabela) => [
    index('expurgo_execucao_escola_em_idx').on(tabela.escolaId, tabela.em),
    check(
      'expurgo_execucao_categoria_valida',
      sql`${tabela.categoria} in ('conversa_tutor', 'sinal_tutor', 'conversa_professor', 'execucao_agente', 'texto_do_modelo', 'consumo_por_aluno', 'trabalho_do_aluno', 'reivindicacao_decidida', 'autoria_de_artefato', 'material_excluido', 'vinculo_encerrado', 'pessoa_desativada')`,
    ),
    check('expurgo_execucao_linhas_nao_negativas', sql`${tabela.linhas} >= 0`),
  ],
)
