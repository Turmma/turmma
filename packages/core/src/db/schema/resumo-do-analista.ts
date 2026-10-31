import { sql } from 'drizzle-orm'
import { check, foreignKey, index, jsonb, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { ConteudoDoResumoDoAnalista } from '@educa/shared'
import { anoLetivo } from './ano-letivo.js'
import { escola } from './escola.js'
import { execucaoAgente } from './execucao-agente.js'

/**
 * O resumo do Analista de desempenho escolar para a coordenação (MVP, A5; D34, D45, D57; regra 70, itens 7 e 8):
 * **agregado por série e disciplina**, e só de lote aprovado.
 *
 * - `conteudo` é o objeto estrito de `conteudoDoResumoDoAnalistaSchema`, validado na saída do modelo e antes de gravar:
 *   números, ids de série e disciplina e códigos de lista fechada. **Não tem campo de pessoa nem texto livre**: nenhum
 *   nome, nenhum id de aluno ou de professor, nenhuma frase escrita pelo modelo sobre alguém. O recorte com menos de dois
 *   professores não entra com número (D45): o schema o recusa, e ele aparece só como recorte nominal, que abre pela
 *   leitura com finalidade e auditoria. O check do banco só garante a forma de fora; o resto é do schema.
 * - Sem aprovação prévia: é a função `resumo_e_alerta`, que faz e avisa (autonomia 2), e vai só à coordenação. Não
 *   decide nada sobre aluno nem sobre professor, e não chega a nenhum dos dois.
 * - Índice único parcial `(escola_id, execucao_id)`: uma execução produz um resumo, e a reexecução não cria dois (D49).
 * - Índice `(escola_id, ano_letivo_id, id)`: o mais recente da escola no ano, que é o que a tela lê.
 * - Sem dado de pessoa, e por isso sem linha no mapa de `docs/lgpd.md`.
 */
export const resumoDoAnalista = pgTable(
  'resumo_do_analista',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    execucaoId: uuid(),
    conteudo: jsonb().$type<ConteudoDoResumoDoAnalista>().notNull(),
    geradoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    foreignKey({ name: 'resumo_do_analista_ano_letivo_da_escola_fk', columns: [tabela.escolaId, tabela.anoLetivoId], foreignColumns: [anoLetivo.escolaId, anoLetivo.id] }),
    foreignKey({
      name: 'resumo_do_analista_execucao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.execucaoId],
      foreignColumns: [execucaoAgente.escolaId, execucaoAgente.anoLetivoId, execucaoAgente.id],
    }),
    uniqueIndex('resumo_do_analista_um_por_execucao').on(tabela.escolaId, tabela.execucaoId).where(sql`${tabela.execucaoId} is not null`),
    index('resumo_do_analista_escola_idx').on(tabela.escolaId, tabela.anoLetivoId, tabela.id),
    check(
      'resumo_do_analista_conteudo_formato',
      sql`jsonb_typeof(${tabela.conteudo}) = 'object' and coalesce(jsonb_typeof(${tabela.conteudo} -> 'recortes'), '') = 'array' and coalesce(jsonb_typeof(${tabela.conteudo} -> 'alertas'), '') = 'array'`,
    ),
  ],
)
