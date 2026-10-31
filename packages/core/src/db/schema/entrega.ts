import { sql } from 'drizzle-orm'
import { check, foreignKey, index, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { ChaveDeFuncao, EstadoDeEntrega, TipoDeEntrega } from '@educa/shared'
import { artefato } from './artefato.js'
import { atividadeAplicada } from './atividade-aplicada.js'
import { escola } from './escola.js'
import { execucaoAgente } from './execucao-agente.js'
import { turma } from './turma.js'

/**
 * O que a IA produziu e que espera a decisão de uma pessoa (glossário, "Entrega"; regra 70, item 3; D9): a versão
 * adaptada de uma atividade, ou o lote de correção de objetiva. **Nasce `pendente`**, e nada dela chega ao aluno antes
 * da aprovação registrada.
 *
 * - Check `entrega_decisao_registrada`: a pendente não tem quem decidiu nem data; a aprovada e a rejeitada têm os dois.
 *   **Não existe aprovada sem `decidida_por` e `decidida_em`.** Check `entrega_rejeitada_com_justificativa`: a rejeitada
 *   tem justificativa, e só ela.
 * - Decidir é um `update … where estado = 'pendente'`: a segunda decisão não acha linha, não grava nada e responde
 *   `ENTREGA_JA_DECIDIDA`. A decisão fica na própria linha: não há tabela de decisões onde uma segunda caberia.
 * - **A turma da entrega é a do que ela decide** (0023): o artefato e a atividade aplicada vão por FK composta com a
 *   escola, o ano e a turma. É pela `turma_id` que o professor é autorizado, e uma entrega da turma X apontando para a
 *   aplicação da turma Y entregaria a decisão a quem não é professor dela.
 * - `decidida_por` é conferido na gravação pelo gatilho `entrega_decidida_por_da_equipe` (a função
 *   `exigir_equipe_da_escola`, da 0023: professor ou coordenação da escola, nunca aluno), e não por FK: a eliminação do professor não apaga quem aprovou, que é o que a
 *   governança responde (regra 70, item 6), e o `set null` quebraria o check da aprovada.
 * - Check `entrega_alvo_do_tipo`: a `versao_adaptada` aponta para o artefato adaptado, e o `lote_de_correcao`, para a
 *   atividade aplicada; nunca os dois. `funcao` é a do catálogo (`adaptacao` ou `correcao_de_objetiva`), e o check
 *   `entrega_funcao_do_tipo` prende um ao outro.
 * - **O lote só fica `aprovada` com o registro da validação** (D56): gatilho de restrição adiado
 *   `entrega_lote_aprovado_com_validacao` (escrito à mão na 0022; desde a 0023 relê a entrega pela escola e pelo id), conferido no commit, quando a `validacao_do_lote` da
 *   mesma transação já existe. Aprovar o lote sem ela falha com 23514, mesmo por fora da API.
 * - Índices únicos parciais: uma entrega por versão adaptada, e um lote não rejeitado por atividade aplicada. Encerrar
 *   duas vezes, ou o job de correção rodar duas vezes, não cria dois lotes (regra 80, item 7); o rejeitado deixa corrigir
 *   de novo.
 * - **Suspender a função não mexe na entrega**: a suspensão recusa execução nova e não apaga o que foi produzido. A
 *   entrega pendente de função suspensa continua podendo ser aprovada ou rejeitada pelo professor.
 * - `justificativa` é texto do professor sobre a saída da IA (`docs/lgpd.md`): nunca em log nem em auditoria.
 * - `unique (escola_id, id, atividade_aplicada_id)` é o alvo da correção e da validação, que só existem para lote.
 * - Índices pelo escopo (regra 80, item 8): `(escola_id, turma_id, estado, id)` para "Seu time", e
 *   `(escola_id, ano_letivo_id, id)` para a governança da escola, da mais nova para a mais antiga.
 */
export const entrega = pgTable(
  'entrega',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    turmaId: uuid().notNull(),
    funcao: text().$type<ChaveDeFuncao>().notNull(),
    tipo: text().$type<TipoDeEntrega>().notNull(),
    artefatoId: uuid(),
    atividadeAplicadaId: uuid(),
    execucaoId: uuid(),
    estado: text().$type<EstadoDeEntrega>().notNull().default('pendente'),
    decididaPor: uuid(),
    decididaEm: timestamp({ withTimezone: true }),
    justificativa: text(),
    criadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('entrega_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('entrega_escola_id_aplicacao_unico').on(tabela.escolaId, tabela.id, tabela.atividadeAplicadaId),
    foreignKey({
      name: 'entrega_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    foreignKey({
      name: 'entrega_artefato_da_turma_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.artefatoId],
      foreignColumns: [artefato.escolaId, artefato.anoLetivoId, artefato.turmaId, artefato.id],
    }),
    foreignKey({
      name: 'entrega_atividade_aplicada_da_turma_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.atividadeAplicadaId],
      foreignColumns: [atividadeAplicada.escolaId, atividadeAplicada.anoLetivoId, atividadeAplicada.turmaId, atividadeAplicada.id],
    }),
    foreignKey({
      name: 'entrega_execucao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.execucaoId],
      foreignColumns: [execucaoAgente.escolaId, execucaoAgente.anoLetivoId, execucaoAgente.id],
    }),
    uniqueIndex('entrega_uma_por_versao_adaptada').on(tabela.escolaId, tabela.artefatoId).where(sql`${tabela.artefatoId} is not null`),
    uniqueIndex('entrega_um_lote_por_aplicacao')
      .on(tabela.escolaId, tabela.atividadeAplicadaId)
      .where(sql`${tabela.atividadeAplicadaId} is not null and ${tabela.estado} <> 'rejeitada'`),
    index('entrega_turma_idx').on(tabela.escolaId, tabela.turmaId, tabela.estado, tabela.id),
    index('entrega_ano_idx').on(tabela.escolaId, tabela.anoLetivoId, tabela.id),
    // A faixa da troca de nome (F3, tarefa 15.0) lê só as entregas rejeitadas, que são as que têm justificativa.
    index('entrega_justificativa_idx').on(tabela.escolaId, tabela.id).where(sql`${tabela.justificativa} is not null`),
    check('entrega_estado_valido', sql`${tabela.estado} in ('pendente', 'aprovada', 'rejeitada')`),
    check('entrega_tipo_valido', sql`${tabela.tipo} in ('versao_adaptada', 'lote_de_correcao')`),
    check('entrega_funcao_do_tipo', sql`(${tabela.tipo}, ${tabela.funcao}) in (('versao_adaptada', 'adaptacao'), ('lote_de_correcao', 'correcao_de_objetiva'))`),
    check(
      'entrega_alvo_do_tipo',
      sql`(${tabela.tipo} = 'versao_adaptada') = (${tabela.artefatoId} is not null) and (${tabela.tipo} = 'lote_de_correcao') = (${tabela.atividadeAplicadaId} is not null)`,
    ),
    check(
      'entrega_decisao_registrada',
      sql`(${tabela.estado} = 'pendente') = (${tabela.decididaPor} is null) and (${tabela.decididaPor} is null) = (${tabela.decididaEm} is null)`,
    ),
    check('entrega_rejeitada_com_justificativa', sql`(${tabela.estado} = 'rejeitada') = (${tabela.justificativa} is not null)`),
    // 8 e 500 são `TAMANHO_MINIMO_DA_JUSTIFICATIVA` e `TAMANHO_MAXIMO_DA_JUSTIFICATIVA` do contrato (`packages/shared`).
    check('entrega_justificativa_preenchida', sql`${tabela.justificativa} is null or char_length(btrim(${tabela.justificativa})) between 8 and 500`),
  ],
)
