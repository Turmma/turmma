import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import type { PapelDeUsuario } from '@educa/shared'
import { conta } from './conta.js'
import { escola } from './escola.js'

/**
 * A pessoa numa escola, com o papel dela ali (Tech Spec, seção 3). É o `sub` do token: toda autorização parte
 * deste id e da escola dele.
 *
 * - `conta_id` só é nulo para aluno, que não tem e-mail (regra 20, item 2); o check garante no banco.
 * - `unique (escola_id, id)` é o alvo das FKs compostas (sessão, vínculo, auditoria): nenhuma referência chega
 *   ao usuário de outra escola.
 * - `unique (escola_id, conta_id, papel)`: a mesma conta não é duas vezes professora na mesma escola.
 * - O índice por `conta_id` serve à resolução de tenant (os usuários ativos de uma conta, depois da senha), que
 *   por definição atravessa escolas.
 * - O índice parcial `(escola_id)` dos coordenadores ativos serve ao estado da coordenação (`estadoDaCoordenacao`), que a
 *   lista do painel da operação lê para as escolas da página (A0b, tarefa 5.0): sem ele, a pergunta "há coordenador
 *   ativo?" varre os usuários de todas as escolas, que crescem com os alunos (regra 80, item 8). Tem uma linha por
 *   coordenador ativo.
 * - `nome` é dado pessoal (`docs/lgpd.md`): nunca em log nem em auditoria.
 */
export const usuario = pgTable(
  'usuario',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    contaId: uuid().references(() => conta.id),
    papel: text().$type<PapelDeUsuario>().notNull(),
    nome: text().notNull(),
    desativadoEm: timestamp({ withTimezone: true }),
    /**
     * Quando a coordenação registrou o pedido de eliminação da pessoa (F3, tarefa 14.0; RF14): do registro até a eliminação
     * de fato (7 dias) ou o cancelamento, a pessoa **não entra** (guarda, renovação, login e seletor recusam), e a conta, a
     * senha e as turmas ficam como estavam. É uma data, e não pessoa nem conteúdo. Diferente de `desativado_em`: quem sai
     * da escola tem a credencial apagada, e quem tem a eliminação agendada a mantém para o cancelamento devolver o acesso.
     */
    eliminacaoAgendadaEm: timestamp({ withTimezone: true }),
    /**
     * Quando a pessoa viu a introdução do papel dela (telas do aluno e primeiro acesso, tarefa 1.0). Uma data, nunca o que
     * ela fez na introdução. Nula até a primeira vez; depois nunca muda (`coalesce` na escrita). Mora no usuário, e não no
     * vínculo, para não reabrir em janeiro com o ano letivo novo.
     */
    introducaoVistaEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('usuario_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('usuario_escola_conta_papel_unico').on(tabela.escolaId, tabela.contaId, tabela.papel),
    index('usuario_conta_idx').on(tabela.contaId).where(sql`conta_id is not null`),
    index('usuario_coordenador_ativo_idx').on(tabela.escolaId).where(sql`papel = 'coordenador' and desativado_em is null`),
    // O expurgo da `pessoa_desativada` (F3, tarefa 5.0): só quem foi desativado, do mais antigo.
    index('usuario_desativado_idx').on(tabela.escolaId, tabela.desativadoEm).where(sql`desativado_em is not null`),
    check('usuario_papel_valido', sql`${tabela.papel} in ('coordenador', 'professor', 'aluno')`),
    check('usuario_conta_so_falta_para_aluno', sql`${tabela.contaId} is not null or ${tabela.papel} = 'aluno'`),
    check('usuario_nome_preenchido', sql`char_length(btrim(${tabela.nome})) between 1 and 200`),
  ],
)
