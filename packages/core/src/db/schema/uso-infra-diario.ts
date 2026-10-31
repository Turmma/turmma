import { sql } from 'drizzle-orm'
import { bigint, check, date, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/**
 * Uso de infraestrutura de cada escola por dia (D30, RF17): requisições atendidas, execuções de job
 * e bytes guardados no storage. É o número que diz quanto cada escola custa de infra, antes de haver
 * staging para medir o custo em reais.
 *
 * - `dia` é o dia civil em `America/Sao_Paulo`, nunca o de UTC: a requisição das 23h59 de 31/12 é de
 *   dezembro.
 * - Os valores são absolutos, gravados pela consolidação noturna a partir dos contadores do Redis de
 *   fila: repetir a consolidação regrava o mesmo número, e não soma de novo.
 * - `bytes_storage` é o total medido no fechamento do dia (a medição de cada noite vai para o dia
 *   que acabou de fechar), não um acumulado. Dia sem medição fica com zero.
 * - Nenhum dado de pessoa: só a escola e contagens.
 * - A chave primária começa pela escola (regra 80, item 8): a consulta do dia e a do mês descem por ela.
 * - A FK de `escola_id` entrou `NOT VALID` na tarefa 3.0 do F1, e a validação das linhas antigas é uma
 *   pendência de deploy (`TODO.md`).
 */
export const usoInfraDiario = pgTable(
  'uso_infra_diario',
  {
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    dia: date({ mode: 'string' }).notNull(),
    requisicoes: bigint({ mode: 'number' }).notNull().default(0),
    jobs: bigint({ mode: 'number' }).notNull().default(0),
    bytesStorage: bigint({ mode: 'number' }).notNull().default(0),
  },
  (tabela) => [
    primaryKey({ columns: [tabela.escolaId, tabela.dia] }),
    check('uso_infra_diario_valores_nao_negativos', sql`${tabela.requisicoes} >= 0 and ${tabela.jobs} >= 0 and ${tabela.bytesStorage} >= 0`),
  ],
)
