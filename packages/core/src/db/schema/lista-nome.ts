import { sql } from 'drizzle-orm'
import { check, foreignKey, index, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { EstadoDoNomeDaLista } from '@educa/shared'
import { escola } from './escola.js'
import { turma } from './turma.js'
import { usuario } from './usuario.js'

/**
 * A lista de nomes da turma (glossário, "Lista de nomes"; A1, tarefa 2.0; Tech Spec da A1, seção 3): o nome e a
 * matrícula que a coordenação sobe antes de o aluno entrar, e que ele reivindica pelo link ou pelo código da turma.
 *
 * - `estado`: `livre` (ninguém pediu), `reivindicado` (há pedido pendente, 6.0) e `aprovado` (virou usuário, 8.0).
 * - Check `lista_nome_aprovado_sem_nome`: `aprovado ⇔ usuario_id ⇔ nome e matrícula nulos`. O aprovado guarda só o
 *   estado e o usuário: o nome e a matrícula passam a viver no `usuario` e na `credencial_matricula`
 *   (`docs/lgpd.md`, "Lista de nomes da turma"); o livre e o reivindicado têm os dois, e nenhum usuário.
 * - FK composta `(escola_id, ano_letivo_id, turma_id)` para a turma, sem ação: a turma com nome na lista não se exclui
 *   (o 23503 vira `CONFLITO` em `apps/api/src/estrutura/exclusao.ts`), e a linha nunca aponta para a turma de outra
 *   escola nem de outro ano.
 * - `usuario_id` por FK composta com a escola, sem ação: a eliminação do aluno apaga antes a linha dele (10.0).
 * - `criado_por` por FK composta com a escola, `on delete set null (criado_por)` (escrito à mão na 0019): a eliminação
 *   de quem subiu a lista não apaga a lista, e a autoria fica na auditoria (`lista.gravada`).
 * - Índice único `(escola_id, ano_letivo_id, btrim(matricula))`: a matrícula é única na escola e no ano, nunca no
 *   sistema (regra 60, item 6); a mesma lista gravada duas vezes ao mesmo tempo entra uma vez (`on conflict do
 *   nothing`, C8). O aprovado, sem matrícula, não colide.
 * - Índice `(escola_id, ano_letivo_id, turma_id, estado)`: a lista da turma e os nomes livres dela começam pelo escopo
 *   (regra 80, item 8).
 * - Nome e matrícula são dado pessoal de aluno (`docs/lgpd.md`): nunca em log, em auditoria nem em métrica.
 */
export const listaNome = pgTable(
  'lista_nome',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    turmaId: uuid().notNull(),
    nome: text(),
    matricula: text(),
    estado: text().$type<EstadoDoNomeDaLista>().notNull().default('livre'),
    usuarioId: uuid(),
    criadoPor: uuid(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('lista_nome_escola_id_unico').on(tabela.escolaId, tabela.id),
    foreignKey({
      name: 'lista_nome_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    foreignKey({ name: 'lista_nome_usuario_da_escola_fk', columns: [tabela.escolaId, tabela.usuarioId], foreignColumns: [usuario.escolaId, usuario.id] }),
    // A migration escreve `on delete set null ("criado_por")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'lista_nome_criado_por_da_escola_fk', columns: [tabela.escolaId, tabela.criadoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    uniqueIndex('lista_nome_matricula_no_ano_unica').on(tabela.escolaId, tabela.anoLetivoId, sql`btrim(${tabela.matricula})`),
    index('lista_nome_turma_idx').on(tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.estado),
    check('lista_nome_estado_valido', sql`${tabela.estado} in ('livre', 'reivindicado', 'aprovado')`),
    check(
      'lista_nome_aprovado_sem_nome',
      sql`(${tabela.estado} = 'aprovado') = (${tabela.usuarioId} is not null) and (${tabela.usuarioId} is not null) = (${tabela.nome} is null) and (${tabela.nome} is null) = (${tabela.matricula} is null)`,
    ),
    // 200 e 40 são `TAMANHO_MAXIMO_NOME_DIGITADO` e `TAMANHO_MAXIMO_MATRICULA` do contrato (`packages/shared`).
    check('lista_nome_nome_formato', sql`${tabela.nome} is null or (char_length(${tabela.nome}) between 1 and 200 and ${tabela.nome} = btrim(${tabela.nome}))`),
    check(
      'lista_nome_matricula_formato',
      sql`${tabela.matricula} is null or (char_length(${tabela.matricula}) between 1 and 40 and ${tabela.matricula} = btrim(${tabela.matricula}))`,
    ),
  ],
)
