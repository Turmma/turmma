import { sql } from 'drizzle-orm'
import { bigint, check, date, integer, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/**
 * O retrato do orçamento de IA da escola num mês (camada-ia, tarefa 2.0; Tech Spec, seções 3 e 5; D39, D41): quantos alunos ativos, o valor por aluno, o teto e de onde veio o valor, no mês de São Paulo.
 * A medida regrava o do **mês corrente** a cada 5 minutos (`insert … on conflict do update`), e o mês que fechou fica com o último: é com ele que a Operação lê "os 12 meses anteriores" sem recalcular com o valor e os
 * alunos de hoje. O mês corrente nunca se lê daqui: é calculado na hora.
 *
 * - `mes` é o **dia 1** do mês civil de `America/Sao_Paulo` (check), nunca um instante.
 * - `valor_por_aluno_micros` é o valor vigente (o da escola, senão o da rede) em milionésimos de real; nulo é "sem orçamento" e só convive com `origem_do_valor = 'nenhuma'` (check). `teto_percentual` é o vigente, de 100 a 1000.
 * - **Sem `ano_letivo_id`, de propósito:** é série no tempo, somada por mês, como `uso_infra_diario` e `consumo_ia`. O retrato de fevereiro é de fevereiro mesmo que o ano letivo vire; amarrá-lo a um ano o faria sumir
 *   de "os 12 meses" na virada.
 * - Nenhum dado de pessoa: só a escola, o mês e números. A chave primária começa pela escola (regra 80, item 8).
 */
export const orcamentoIaDoMes = pgTable(
  'orcamento_ia_do_mes',
  {
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    mes: date({ mode: 'string' }).notNull(),
    alunosAtivos: integer().notNull(),
    valorPorAlunoMicros: bigint({ mode: 'number' }),
    tetoPercentual: smallint().notNull(),
    origemDoValor: text().$type<'escola' | 'rede' | 'nenhuma'>().notNull(),
    atualizadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    primaryKey({ columns: [tabela.escolaId, tabela.mes] }),
    check('orcamento_ia_do_mes_mes_e_dia_1', sql`extract(day from ${tabela.mes}) = 1`),
    check('orcamento_ia_do_mes_alunos_nao_negativo', sql`${tabela.alunosAtivos} >= 0`),
    check('orcamento_ia_do_mes_valor_positivo', sql`${tabela.valorPorAlunoMicros} > 0`),
    check('orcamento_ia_do_mes_teto_valido', sql`${tabela.tetoPercentual} between 100 and 1000`),
    check('orcamento_ia_do_mes_origem_valida', sql`${tabela.origemDoValor} in ('escola', 'rede', 'nenhuma')`),
    check('orcamento_ia_do_mes_origem_diz_o_valor', sql`(${tabela.origemDoValor} = 'nenhuma') = (${tabela.valorPorAlunoMicros} is null)`),
  ],
)
