import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { ChaveDeFuncao, MotivoDeSuspensao } from '@educa/shared'
import { escola } from './escola.js'

/**
 * A suspensão de uma função de IA numa escola (MVP, A5; D60 revista; `docs/agentes.md`): a coordenação desliga **a
 * função**, e não o agente. Suspender a correção de objetiva não desliga a conversa do professor.
 *
 * - **Vale no servidor**: quem executa confere se há suspensão vigente da função antes de gravar a execução, e recusa
 *   com `FUNCAO_SUSPENSA`. O que a função já produziu continua onde estava.
 * - Vigente é a que não foi retomada (`retomada_em is null`). Índice único parcial `(escola_id, funcao)` entre as
 *   vigentes: **no máximo uma suspensão vigente por escola e função**. Dois cliques em suspender gravam uma, e o segundo
 *   cai no 23505 (regra 80, item 7). Retomar é um `update` da vigente; a linha fica, como histórico.
 * - `funcao` é a chave do catálogo `FUNCOES`. `motivo` é código de lista fechada, opcional, nunca texto livre.
 * - Quem suspendeu e quem retomou são conferidos na gravação pelos gatilhos `suspensao_de_funcao_suspensa_por_da_escola`
 *   e `suspensao_de_funcao_retomada_por_da_escola` (a função `exigir_usuario_da_escola`, da 0013), sem FK: a eliminação
 *   de um coordenador não apaga o registro de quem suspendeu. A auditoria também guarda (`funcao.suspensa`,
 *   `funcao.retomada`).
 * - Não varia por ano letivo: a suspensão é da escola e atravessa a virada.
 * - Índice `(escola_id, suspensa_em)`: o histórico da escola. A leitura das vigentes usa o único parcial.
 */
export const suspensaoDeFuncao = pgTable(
  'suspensao_de_funcao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    funcao: text().$type<ChaveDeFuncao>().notNull(),
    motivo: text().$type<MotivoDeSuspensao>(),
    suspensaPor: uuid().notNull(),
    suspensaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    retomadaPor: uuid(),
    retomadaEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    uniqueIndex('suspensao_de_funcao_uma_vigente').on(tabela.escolaId, tabela.funcao).where(sql`${tabela.retomadaEm} is null`),
    index('suspensao_de_funcao_escola_idx').on(tabela.escolaId, tabela.suspensaEm),
    check(
      'suspensao_de_funcao_funcao_valida',
      sql`${tabela.funcao} in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')`,
    ),
    check(
      'suspensao_de_funcao_motivo_valido',
      sql`${tabela.motivo} is null or ${tabela.motivo} in ('erro_recorrente', 'revisao_pedagogica', 'pedido_da_comunidade', 'incidente', 'decisao_da_escola')`,
    ),
    check('suspensao_de_funcao_retomada_registrada', sql`(${tabela.retomadaEm} is null) = (${tabela.retomadaPor} is null)`),
    check('suspensao_de_funcao_retomada_depois', sql`${tabela.retomadaEm} is null or ${tabela.retomadaEm} >= ${tabela.suspensaEm}`),
  ],
)
