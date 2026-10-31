import type { AlcanceDoSuboperador, CategoriaDeDadoDoSuboperador } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { boolean, check, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/**
 * A empresa que recebe dado da escola para nos prestar o serviço (F3, RF6 e RF7; Tech Spec do F3, seções 3 e 6). É da nossa
 * operação, não de escola: **sem `escola_id`**, uma das exceções declaradas da regra 10, item 1
 * (`docs/modelo-de-dados.md`, regras transversais). A hospedagem atende toda escola, e uma linha por escola seria a mesma
 * linha cem vezes. Por isso só o `OperacaoPrivacidadeRepository` a escreve (`ops:suboperador`), e a escola a lê só pelo
 * `SuboperadorDaEscolaRepository`, que filtra pelo alcance e pela ligação com a escola do contexto; um teste de arquitetura
 * procura outro uso, pelo `import` e pelo nome da tabela em SQL.
 *
 * - `chave` é o `IA_PROVEDOR_ID` da instância quando a empresa é um provedor de IA (tarefa 7.0), e é como o compartilhamento
 *   do titular casa uma chamada com o suboperador. Uma só vigente por chave (índice único onde `fim is null`); a chave
 *   encerrada pode ser cadastrada de novo, e as duas linhas ficam como histórico.
 * - `categorias` é a lista fechada de `CATEGORIAS_DE_DADO_DO_SUBOPERADOR`, escrita por extenso no check (o drizzle-kit lê o
 *   pacote pelo `dist`); o teste da migration compara com a constante.
 * - `contrato` é o código de referência do contrato, nunca texto dele, e não sai para a escola.
 * - `pais` é o código ISO de duas letras maiúsculas de onde a empresa processa o dado.
 * - `registrado_por` é o apelido do operador, no formato de `FORMATO_OPERADOR`, como o `auditoria.autor_operador`.
 * - Não varia por ano letivo: o contrato com a empresa atravessa a virada.
 * - Nenhuma pessoa da escola: a retenção é "enquanto a empresa existir como suboperador", e o encerrado fica como histórico
 *   (a escola precisa dizer ao titular por onde o dado passou, mesmo depois que a empresa saiu).
 */
export const suboperador = pgTable(
  'suboperador',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    chave: text().notNull(),
    nome: text().notNull(),
    finalidade: text().notNull(),
    categorias: text().array().$type<CategoriaDeDadoDoSuboperador[]>().notNull(),
    pais: text().notNull(),
    contrato: text().notNull(),
    vedaTreinamento: boolean().notNull(),
    alcance: text().$type<AlcanceDoSuboperador>().notNull(),
    inicio: timestamp({ withTimezone: true }).notNull().defaultNow(),
    fim: timestamp({ withTimezone: true }),
    registradoPor: text().notNull(),
  },
  (tabela) => [
    uniqueIndex('suboperador_chave_vigente_idx').on(tabela.chave).where(sql`${tabela.fim} is null`),
    check('suboperador_chave_formato', sql`${tabela.chave} ~ '^[a-z][a-z0-9_-]{1,39}$'`),
    check('suboperador_nome_tamanho', sql`char_length(${tabela.nome}) between 1 and 120`),
    check('suboperador_finalidade_tamanho', sql`char_length(${tabela.finalidade}) between 1 and 300`),
    check('suboperador_pais_formato', sql`${tabela.pais} ~ '^[A-Z]{2}$'`),
    check('suboperador_contrato_formato', sql`${tabela.contrato} ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$'`),
    check(
      'suboperador_categorias_validas',
      sql`cardinality(${tabela.categorias}) between 1 and 8 and ${tabela.categorias} <@ array['cadastro', 'conta_de_acesso', 'registro_de_acesso', 'conversa_do_aluno', 'conversa_do_professor', 'trabalho_do_aluno', 'material_da_escola', 'consulta_de_busca']`,
    ),
    check('suboperador_alcance_valido', sql`${tabela.alcance} in ('todas', 'lista')`),
    check('suboperador_vigencia_ordenada', sql`${tabela.fim} is null or ${tabela.fim} >= ${tabela.inicio}`),
    check('suboperador_registrado_por_formato', sql`${tabela.registradoPor} ~ '^[a-z][a-z0-9-]{1,31}$'`),
  ],
)

/**
 * As escolas que um suboperador de alcance `lista` atende (Tech Spec do F3, seção 3): uma linha por escola, escrita no
 * contexto dela pelo `ops:suboperador`, com o `escola_id` do contexto e nunca de argumento (regra 10, item 3). O suboperador de
 * alcance `todas` não tem ligação.
 *
 * - A chave primária começa pela escola (regra 80, item 8): a leitura da escola é "a minha ligação com este suboperador".
 * - `fim` é o encerramento da ligação, que o `ops:suboperador encerrar` põe junto com o do suboperador. Ligação com `fim` e
 *   suboperador sem `fim` é a escola que saiu da lista com a empresa seguindo para as outras: para essa escola a empresa é
 *   passada.
 */
export const suboperadorEscola = pgTable(
  'suboperador_escola',
  {
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    suboperadorId: uuid()
      .notNull()
      .references(() => suboperador.id),
    inicio: timestamp({ withTimezone: true }).notNull().defaultNow(),
    fim: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    primaryKey({ name: 'suboperador_escola_pk', columns: [tabela.escolaId, tabela.suboperadorId] }),
    index('suboperador_escola_suboperador_idx').on(tabela.suboperadorId),
    check('suboperador_escola_vigencia_ordenada', sql`${tabela.fim} is null or ${tabela.fim} >= ${tabela.inicio}`),
  ],
)
