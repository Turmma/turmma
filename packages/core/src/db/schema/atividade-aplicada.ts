import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, index, pgTable, smallint, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { EstadoDeAtividadeAplicada } from '@educa/shared'
import { artefato } from './artefato.js'
import { escola } from './escola.js'
import { turma } from './turma.js'

/**
 * A atividade que o professor aplicou a uma turma (MVP, A3). É a "Avaliação" do modelo definitivo, fina: só o modo online
 * objetiva, sem item nem peso próprios, porque as questões são as do artefato, que não muda depois de gravado.
 *
 * - **Aplicar é a aprovação registrada que leva a saída da IA ao aluno** (regra 70, item 3): `aplicada_por` e
 *   `aplicada_em` são obrigatórios. O autor é conferido na gravação pelo gatilho `atividade_aplicada_aplicada_por_da_equipe`
 *   (a função `exigir_equipe_da_escola`, da 0023), e não por FK: a eliminação do professor não apaga quem liberou a
 *   atividade nem a atividade (como na auditoria).
 * - Gatilho `atividade_aplicada_so_do_que_pode_ir_ao_aluno` (escrito à mão na 0022): só atividade objetiva se aplica, e a
 *   **versão adaptada só com a entrega dela `aprovada`**. É o que impede, por estrutura, a versão pendente ou rejeitada
 *   de chegar à turma, mesmo por fora da API. A recusa sai como 23514, com o nome da regra.
 * - `avaliativa`: enquanto a avaliativa está `aberta`, o Tutor da turma fica travado (regra 30, item 10).
 * - Índice único parcial `(escola_id, turma_id, artefato_id)` entre as abertas: o clique duplo em "aplicar" não cria duas
 *   (regra 80, item 7), e é por ele que o Tutor acha a avaliativa aberta da turma.
 * - A turma e o artefato por FK composta com a escola e o ano (o do artefato, desde a 0023): não se aplica artefato de
 *   outro ano letivo. A turma do artefato não precisa ser a da aplicação: o professor aplica a mesma atividade a outra
 *   turma dele, do mesmo ano (a tarefa confere o vínculo nas duas).
 * - `unique (escola_id, ano_letivo_id, id)` é o alvo da tentativa, que carrega o ano da aplicação;
 *   `unique (escola_id, ano_letivo_id, turma_id, id)` (0023), o da entrega do lote, da mensagem e do sinal do Tutor, que
 *   levam a turma: nenhum deles aponta para a aplicação de outra turma.
 * - O gatilho de autor (0023) exige que quem aplica seja professor ou coordenação da escola: id de aluno é recusado.
 * - Índice `(escola_id, turma_id, id)`: as atividades da turma, para o professor e para o aluno, paginadas.
 * - Sem dado de pessoa além de quem aplicou.
 *
 * **A prova online** (avaliacao-e-correcao, 1.0; Tech Spec, seção 3): a avaliativa ganha janela (`abre_em`, `fecha_em`), duração
 * (`duracao_min`, 5 a 300) e o embaralhamento, que é só de apresentação. Os checks valem só em `avaliativa`, e a API exige a
 * janela na avaliativa nova (a antiga segue sem, sem backfill). `segunda_chamada_de` aponta a original, da mesma escola, ano,
 * turma e artefato: o índice das abertas deixa a segunda chamada de fora (a original e ela convivem), e outro índice garante
 * uma segunda chamada aberta por original. O índice `(fecha_em)` das provas abertas é o da rotina que encerra a vencida
 * (não começa por escola: a rotina varre todas, só ids).
 */
export const atividadeAplicada = pgTable(
  'atividade_aplicada',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    turmaId: uuid().notNull(),
    artefatoId: uuid().notNull(),
    avaliativa: boolean().notNull(),
    estado: text().$type<EstadoDeAtividadeAplicada>().notNull().default('aberta'),
    aplicadaPor: uuid().notNull(),
    aplicadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    encerradaEm: timestamp({ withTimezone: true }),
    abreEm: timestamp({ withTimezone: true }),
    fechaEm: timestamp({ withTimezone: true }),
    duracaoMin: smallint(),
    embaralharQuestoes: boolean().notNull().default(false),
    embaralharAlternativas: boolean().notNull().default(false),
    segundaChamadaDe: uuid(),
  },
  (tabela) => [
    unique('atividade_aplicada_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('atividade_aplicada_escola_ano_id_unico').on(tabela.escolaId, tabela.anoLetivoId, tabela.id),
    unique('atividade_aplicada_escola_ano_turma_id_unico').on(tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.id),
    unique('atividade_aplicada_escola_ano_turma_artefato_id_unico').on(tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.artefatoId, tabela.id),
    foreignKey({
      name: 'atividade_aplicada_segunda_chamada_da_original_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.artefatoId, tabela.segundaChamadaDe],
      foreignColumns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.artefatoId, tabela.id],
    }),
    foreignKey({
      name: 'atividade_aplicada_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    foreignKey({
      name: 'atividade_aplicada_artefato_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.artefatoId],
      foreignColumns: [artefato.escolaId, artefato.anoLetivoId, artefato.id],
    }),
    uniqueIndex('atividade_aplicada_aberta_unica').on(tabela.escolaId, tabela.turmaId, tabela.artefatoId).where(sql`${tabela.estado} = 'aberta' and ${tabela.segundaChamadaDe} is null`),
    uniqueIndex('atividade_aplicada_segunda_chamada_aberta_unica').on(tabela.escolaId, tabela.segundaChamadaDe).where(sql`${tabela.estado} = 'aberta' and ${tabela.segundaChamadaDe} is not null`),
    index('atividade_aplicada_prova_aberta_idx').on(tabela.fechaEm).where(sql`${tabela.avaliativa} and ${tabela.estado} = 'aberta' and ${tabela.fechaEm} is not null`),
    index('atividade_aplicada_turma_idx').on(tabela.escolaId, tabela.turmaId, tabela.id),
    check('atividade_aplicada_estado_valido', sql`${tabela.estado} in ('aberta', 'encerrada')`),
    check('atividade_aplicada_janela_inteira', sql`(${tabela.abreEm} is null) = (${tabela.fechaEm} is null)`),
    check('atividade_aplicada_janela_ordenada', sql`${tabela.abreEm} is null or ${tabela.abreEm} < ${tabela.fechaEm}`),
    check('atividade_aplicada_duracao_valida', sql`${tabela.duracaoMin} is null or (${tabela.duracaoMin} between 5 and 300 and ${tabela.abreEm} is not null)`),
    check('atividade_aplicada_prova_so_na_avaliativa', sql`${tabela.avaliativa} or (${tabela.abreEm} is null and ${tabela.duracaoMin} is null and not ${tabela.embaralharQuestoes} and not ${tabela.embaralharAlternativas} and ${tabela.segundaChamadaDe} is null)`),
    check('atividade_aplicada_encerrada_tem_data', sql`(${tabela.estado} = 'encerrada') = (${tabela.encerradaEm} is not null)`),
  ],
)
