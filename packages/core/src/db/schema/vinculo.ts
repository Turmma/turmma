import { sql } from 'drizzle-orm'
import { check, foreignKey, index, pgTable, text, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import type { ContestacaoDeVinculo, EstadoDeVinculo, MotivoDeEncerramentoDeVinculo, PapelDeVinculo } from '@educa/shared'
import { disciplina } from './disciplina.js'
import { escola } from './escola.js'
import { turma } from './turma.js'
import { usuario } from './usuario.js'

/** O id que ocupa o lugar da disciplina ausente no índice único: vínculo sem disciplina também não se repete. */
const SEM_DISCIPLINA = '00000000-0000-0000-0000-000000000000'

/**
 * A ligação de uma pessoa a uma turma, e a uma disciplina quando é de professor, num ano letivo (glossário, "Vínculo";
 * regra 60, item 8a; tarefa 9.0; Tech Spec, seção 3). É o vínculo `confirmado` que responde "esta turma é dele?".
 *
 * - A escola cria (`criado_por`), e nasce `pendente`. O professor confirma ou contesta; a coordenação encerra.
 * - FK composta `(escola_id, ano_letivo_id, turma_id)` para a turma: o vínculo é do ano da turma, e nunca aponta para a
 *   turma de outra escola nem de outro ano. Usuário e disciplina também vão por FK composta com a escola. O autor
 *   (`criado_por`) é conferido na gravação pelo gatilho `vinculo_criado_por_da_escola_fk` (migration 0013), e não por
 *   FK: a eliminação do coordenador que criou o vínculo não apaga o vínculo de outra pessoa (17.0).
 * - Índice único parcial `(escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id)` fora do `encerrado`: o mesmo
 *   vínculo criado duas vezes ao mesmo tempo resulta em um só (regra 80, item 7). A disciplina ausente conta como uma
 *   só (`coalesce`), porque no índice comum dois nulos não colidem.
 * - `complemento` é texto do professor, até 140 caracteres: só a coordenação o lê, nunca vai a log nem a auditoria, e
 *   é apagado na virada do ano (10.0; `docs/lgpd.md`).
 * - Índices `(escola_id, ano_letivo_id, usuario_id, estado)` para os vínculos da pessoa e `(escola_id, ano_letivo_id,
 *   turma_id, estado)` para a turma e os alunos dela: começam pelo escopo (regra 80, item 8).
 */
export const vinculo = pgTable(
  'vinculo',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    usuarioId: uuid().notNull(),
    turmaId: uuid().notNull(),
    disciplinaId: uuid(),
    papel: text().$type<PapelDeVinculo>().notNull(),
    estado: text().$type<EstadoDeVinculo>().notNull().default('pendente'),
    contestacao: text().$type<ContestacaoDeVinculo>(),
    complemento: varchar({ length: 140 }),
    motivoEncerramento: text().$type<MotivoDeEncerramentoDeVinculo>(),
    criadoPor: uuid().notNull(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decididoEm: timestamp({ withTimezone: true }),
    encerradoEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('vinculo_escola_id_unico').on(tabela.escolaId, tabela.id),
    foreignKey({
      name: 'vinculo_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    foreignKey({ name: 'vinculo_usuario_da_escola_fk', columns: [tabela.escolaId, tabela.usuarioId], foreignColumns: [usuario.escolaId, usuario.id] }),
    foreignKey({ name: 'vinculo_disciplina_da_escola_fk', columns: [tabela.escolaId, tabela.disciplinaId], foreignColumns: [disciplina.escolaId, disciplina.id] }),
    uniqueIndex('vinculo_ativo_unico')
      .on(tabela.escolaId, tabela.anoLetivoId, tabela.usuarioId, tabela.turmaId, sql`coalesce(${tabela.disciplinaId}, ${sql.raw(`'${SEM_DISCIPLINA}'::uuid`)})`)
      .where(sql`${tabela.estado} <> 'encerrado'`),
    index('vinculo_usuario_idx').on(tabela.escolaId, tabela.anoLetivoId, tabela.usuarioId, tabela.estado),
    index('vinculo_turma_idx').on(tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.estado),
    // O expurgo do `vinculo_encerrado` (F3, tarefa 5.0): só o encerrado, do mais antigo.
    index('vinculo_encerrado_idx').on(tabela.escolaId, tabela.encerradoEm).where(sql`${tabela.estado} = 'encerrado'`),
    check('vinculo_papel_valido', sql`${tabela.papel} in ('professor', 'aluno')`),
    check('vinculo_estado_valido', sql`${tabela.estado} in ('pendente', 'confirmado', 'contestado', 'encerrado')`),
    check(
      'vinculo_contestacao_valida',
      sql`${tabela.contestacao} is null or ${tabela.contestacao} in ('nao_leciono', 'turma_errada', 'disciplina_errada', 'outro')`,
    ),
    check('vinculo_contestado_tem_codigo', sql`${tabela.estado} <> 'contestado' or ${tabela.contestacao} is not null`),
    check('vinculo_complemento_so_com_codigo', sql`${tabela.complemento} is null or ${tabela.contestacao} is not null`),
    check('vinculo_complemento_preenchido', sql`${tabela.complemento} is null or char_length(btrim(${tabela.complemento})) between 1 and 140`),
    check(
      'vinculo_motivo_encerramento_valido',
      sql`${tabela.motivoEncerramento} is null or ${tabela.motivoEncerramento} in ('fim_do_ano', 'desligamento', 'realocacao')`,
    ),
    check('vinculo_encerrado_tem_motivo', sql`(${tabela.estado} = 'encerrado') = (${tabela.motivoEncerramento} is not null and ${tabela.encerradoEm} is not null)`),
  ],
)
