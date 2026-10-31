import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, index, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { DecisorDaReivindicacao, EstadoDaReivindicacao } from '@educa/shared'
import { escola } from './escola.js'
import { listaNome } from './lista-nome.js'
import { turma } from './turma.js'
import { usuario } from './usuario.js'

/**
 * O pedido de reivindicação (glossário, "Reivindicação"; A1, tarefa 6.0; Tech Spec da A1, seção 3): o aluno disse, pela
 * página pública da sala, "este nome da lista sou eu", com a matrícula e a senha que criou. O pedido fica `pendente` até
 * uma pessoa decidir (8.0); só a aprovação cria o aluno (D4, regra 60, item 7).
 *
 * - `estado`: `pendente`, `aprovada`, `recusada` ou `encerrada` (a virada do ano fecha o pendente sem decisão, 10.0).
 * - Check `reivindicacao_segredo_so_pendente`: o hash da senha, a `chave_envio` e o `teve_matricula_errada` existem só
 *   no pendente, e o pendente tem os três. A decisão e o encerramento os apagam na mesma escrita (`docs/lgpd.md`).
 * - Check `reivindicacao_pendente_com_nome`: o pendente sempre aponta para o nome. O `set null` da FK num pendente falha,
 *   e o caminho que apagar o nome antes de fechar o pedido (encerramento, eliminação) quebra, em vez de deixar o hash de
 *   uma senha num pedido sem nome.
 * - `lista_nome_id` por FK composta com a escola, `on delete set null (lista_nome_id)` (escrito à mão na 0021): o nome
 *   que sai da lista não apaga o pedido decidido, que fica sem nome. O nome de outra escola, ou inexistente, é recusado
 *   pela FK no `insert`.
 * - A turma por FK composta `(escola_id, ano_letivo_id, turma_id)`, sem ação: a turma com pedido não se exclui (o 23503
 *   vira `CONFLITO` em `apps/api/src/estrutura/exclusao.ts`).
 * - `decidida_por` por FK composta com a escola, `on delete set null (decidida_por)` (escrito à mão na 0021): a
 *   eliminação de quem decidiu não apaga o pedido, e a autoria fica na auditoria (`reivindicacao.decidida`, 8.0).
 * - Índice único parcial `(escola_id, chave_envio) where chave_envio is not null`: a mesma chave não grava dois pedidos
 *   na escola (o reenvio, C2). Índice único parcial `(escola_id, lista_nome_id) where estado = 'pendente'`: um pendente
 *   por nome (C1). Os dois recusam com 23505, e quem grava relê a chave, sem ler o nome da restrição (Tech Spec, seção 5).
 * - Índice `(escola_id, turma_id, estado, solicitada_em)`: os pedidos da turma (8.0) começam pelo escopo (regra 80,
 *   item 8). Índice `(escola_id, lista_nome_id)`: o `set null` da FK, quando o nome sai da lista, acha os pedidos dele
 *   sem varrer os da escola.
 * - Sem `dispositivo` (PRD, 10.2): nada liga o pedido ao navegador nem ao IP. A senha, a chave e a matrícula nunca vão a
 *   log, a auditoria nem a métrica.
 */
export const reivindicacao = pgTable(
  'reivindicacao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    turmaId: uuid().notNull(),
    listaNomeId: uuid(),
    chaveEnvio: uuid(),
    senhaHash: text(),
    teveMatriculaErrada: boolean(),
    estado: text().$type<EstadoDaReivindicacao>().notNull().default('pendente'),
    solicitadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decididaEm: timestamp({ withTimezone: true }),
    decididaPor: uuid(),
    decididaComo: text().$type<DecisorDaReivindicacao>(),
  },
  (tabela) => [
    unique('reivindicacao_escola_id_unico').on(tabela.escolaId, tabela.id),
    foreignKey({
      name: 'reivindicacao_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    // A migration escreve `on delete set null ("lista_nome_id")` e `("decidida_por")`: o `set null` inteiro anularia
    // também a escola, que é `not null`.
    foreignKey({ name: 'reivindicacao_nome_da_escola_fk', columns: [tabela.escolaId, tabela.listaNomeId], foreignColumns: [listaNome.escolaId, listaNome.id] }).onDelete('set null'),
    foreignKey({ name: 'reivindicacao_decidida_por_da_escola_fk', columns: [tabela.escolaId, tabela.decididaPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    uniqueIndex('reivindicacao_chave_na_escola_unica').on(tabela.escolaId, tabela.chaveEnvio).where(sql`${tabela.chaveEnvio} is not null`),
    uniqueIndex('reivindicacao_pendente_por_nome').on(tabela.escolaId, tabela.listaNomeId).where(sql`${tabela.estado} = 'pendente'`),
    index('reivindicacao_turma_idx').on(tabela.escolaId, tabela.turmaId, tabela.estado, tabela.solicitadaEm),
    index('reivindicacao_nome_idx').on(tabela.escolaId, tabela.listaNomeId),
    // O expurgo da `reivindicacao_decidida` (F3, tarefa 5.0): o pedido decidido ou encerrado, pela data da decisão (ou, no
    // encerrado, que não tem decisão, da solicitação), do mais antigo.
    index('reivindicacao_decidida_idx')
      .on(tabela.escolaId, sql`coalesce(${tabela.decididaEm}, ${tabela.solicitadaEm})`)
      .where(sql`${tabela.estado} <> 'pendente'`),
    check('reivindicacao_estado_valido', sql`${tabela.estado} in ('pendente', 'aprovada', 'recusada', 'encerrada')`),
    check('reivindicacao_pendente_com_nome', sql`${tabela.estado} <> 'pendente' or ${tabela.listaNomeId} is not null`),
    check('reivindicacao_decidida_como_valida', sql`${tabela.decididaComo} is null or ${tabela.decididaComo} in ('professor', 'coordenacao')`),
    check(
      'reivindicacao_segredo_so_pendente',
      sql`(${tabela.estado} = 'pendente') = (${tabela.senhaHash} is not null) and (${tabela.senhaHash} is not null) = (${tabela.chaveEnvio} is not null) and (${tabela.chaveEnvio} is not null) = (${tabela.teveMatriculaErrada} is not null)`,
    ),
  ],
)
