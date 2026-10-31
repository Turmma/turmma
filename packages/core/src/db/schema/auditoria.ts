import { FORMATO_OPERADOR } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/**
 * O formato do autor da nossa equipe: a definição mora em `@educa/shared`. O check `auditoria_operador_formato` a escreve
 * por extenso, porque o drizzle-kit lê o pacote pelo `dist`, que pode estar atrás; `formato-do-operador.int.test.ts` compara o
 * check do banco com a constante.
 */
export { FORMATO_OPERADOR }

/**
 * O registro consultável de quem fez o quê, em qual escola e quando (regra 20, item 10; RF19). Não é
 * log: tem autor, data e finalidade, e fica pela retenção legal (vigência + 5 anos, `docs/lgpd.md`).
 *
 * - Só grava por `AuditoriaRecorder.gravar`, que confere `antes`, `depois` e `finalidade` contra a lista
 *   fechada da ação: ids, estados, códigos e datas, nunca nome, e-mail, matrícula, complemento, hash ou
 *   segredo. O insert fica num módulo fora do `index.ts` do pacote, e um teste procura outra escrita.
 * - `escola_id` só é nulo quando o operador faz algo acima do tenant, que não pertence a uma escola: criar a rede (que
 *   ainda não tem escola) e cadastrar ou encerrar um suboperador, que pode atender toda escola (F3, 8.0). O check garante
 *   isso no banco mesmo por fora do código.
 * - Todo registro tem um autor, e só um: a pessoa da escola (`autor_usuario_id`) ou alguém da nossa
 *   equipe (`autor_operador`).
 * - Sem `unique (escola_id, id)`: nenhuma tabela referencia a auditoria, então não há FK composta a apoiar.
 * - O autor é sempre um usuário da própria escola do registro, conferido no banco na gravação pelo gatilho
 *   `auditoria_autor_da_escola_fk` (migration 0013). Até a 17.0 era FK composta para `usuario (escola_id, id)`; virou
 *   gatilho porque a eliminação pedida pela escola apaga o usuário e a auditoria fica pela retenção legal, com o id do
 *   autor (Tech Spec, seção 5, "Ciclo de vida").
 * - O índice começa pela escola (regra 80, item 8): a consulta do F3 é sempre "a escola, num período".
 */
export const auditoria = pgTable(
  'auditoria',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid().references(() => escola.id),
    autorUsuarioId: uuid(),
    autorOperador: text(),
    acao: text().notNull(),
    entidade: text().notNull(),
    entidadeId: uuid().notNull(),
    antes: jsonb().$type<Record<string, unknown>>(),
    depois: jsonb().$type<Record<string, unknown>>(),
    finalidade: text(),
    requisicaoId: uuid().notNull(),
    em: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index('auditoria_escola_em_idx').on(tabela.escolaId, tabela.em),
    // O que o arquivo do titular lê: a auditoria em que ele é o autor, pela escola e pela pessoa (F3, 13.0; regra 80, item 8).
    index('auditoria_escola_autor_idx')
      .on(tabela.escolaId, tabela.autorUsuarioId, tabela.em)
      .where(sql`${tabela.autorUsuarioId} is not null`),
    // Sem escola, só o que a operação faz acima do tenant: a rede criada e o suboperador cadastrado ou encerrado (F3, 8.0).
    check('auditoria_escola_ou_operacao_global', sql`escola_id is not null or (autor_operador is not null and entidade in ('rede', 'suboperador'))`),
    // Um autor e só um: a pessoa da escola, ou alguém da nossa equipe em rotina de operador.
    check('auditoria_um_autor', sql`(autor_usuario_id is not null) <> (autor_operador is not null)`),
    check('auditoria_operador_formato', sql`autor_operador is null or autor_operador ~ '^[a-z][a-z0-9-]{1,31}$'`),
    // O autor `rotina` (a eliminação do titular e o expurgo por prazo, F3, tarefa 15.0) só assina as quatro ações que a rotina
    // faz sozinha: a eliminação da pessoa e a revogação do acesso que ela gerou, a troca do nome dela nos textos livres e a
    // conclusão do pedido. Ele nunca aprova entrega, rejeita entrega nem valida lote: a aprovação humana é regra 70, item 3.
    check(
      'auditoria_rotina_so_nas_acoes',
      sql`autor_operador is distinct from 'rotina' or acao in ('usuario.eliminado', 'acesso_turma.revogado', 'titular.nome_trocado', 'pedido.concluido')`,
    ),
    check('auditoria_finalidade_curta', sql`finalidade is null or char_length(finalidade) between 1 and 200`),
  ],
)
