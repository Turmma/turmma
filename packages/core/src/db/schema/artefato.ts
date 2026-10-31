import { sql } from 'drizzle-orm'
import { check, foreignKey, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import type { ConteudoDoArtefato, TipoDeArtefato } from '@educa/shared'
import { disciplina } from './disciplina.js'
import { escola } from './escola.js'
import { execucaoAgente } from './execucao-agente.js'
import { turma } from './turma.js'
import { usuario } from './usuario.js'

/**
 * O que uma ferramenta do Assistente produz (glossário, "Artefato"; MVP, A2; D18, D67): a atividade objetiva ou o plano
 * de aula, ligado à turma e à disciplina, com a página do material citada (D6). É do professor (D63): só o professor
 * com vínculo confirmado na turma o alcança, e **o aluno nunca lê o artefato**, que tem o gabarito.
 *
 * - `conteudo` é validado por `conteudoDoArtefatoSchema` na saída do modelo e na leitura (regra 30, item 7); o check
 *   garante no banco que é objeto e que o `tipo` dele é o da coluna. **Não muda depois de gravado**: só o título muda
 *   (`PATCH`, que atualiza a coluna e o `titulo` de dentro do conteúdo no mesmo comando), e por isso a atividade aplicada
 *   não precisa de cópia das questões.
 * - **Versão adaptada** é o artefato com `origem_id`, por FK composta `(escola_id, ano_letivo_id, turma_id, origem_id)`
 *   (0023): o original é da mesma escola, do mesmo ano letivo e da **mesma turma** da versão. Só atividade objetiva se
 *   adapta, e não se adapta uma versão adaptada (a tarefa confere; o check garante o tipo).
 * - `unique (escola_id, ano_letivo_id, id)` é o alvo da aplicação, que pode ser em outra turma do mesmo ano;
 *   `unique (escola_id, ano_letivo_id, turma_id, id)`, o da versão adaptada e da entrega, que são da turma do artefato. A
 *   execução também vai com o ano: nada aqui cruza de ano letivo (regra 60, item 5).
 * - Check `artefato_adaptacao_fechada`: a versão adaptada tem `conteudo.adaptacao`, e o original não tem; os `tipos` são
 *   de **lista fechada**, e o objeto não aceita chave além de `tipos` e `tempoExtraPercentual`. Não existe onde escrever
 *   texto sobre um aluno, uma condição ou um motivo, nem por fora da API (D35, D67). E **não existe coluna nem tabela
 *   que ligue aluno a adaptação**: a versão é aplicada à turma como qualquer artefato.
 * - A versão adaptada nasce com uma `entrega` pendente, e só chega à turma depois de aprovada (regra 70, item 3): quem
 *   segura isso é o gatilho da `atividade_aplicada`.
 * - Índice único parcial `(escola_id, execucao_id)`: uma execução produz um artefato, e executar duas vezes não cria
 *   dois (D49; regra 80, item 7).
 * - `criado_por` por FK composta com a escola, `on delete set null (criado_por)` (escrito à mão na 0022): o artefato
 *   fica para a escola, com a atividade já aplicada. No prazo da categoria `autoria_de_artefato`, contado do `fim` do ano
 *   letivo **encerrado**, o expurgo noturno da escola também o anula (F3, tarefa 4.0), pelo índice parcial
 *   `(escola_id, ano_letivo_id)` onde `criado_por is not null`; o ano em curso nunca perde a autoria.
 * - Índices pelo escopo (regra 80, item 8): `(escola_id, turma_id, id)` para a listagem paginada, e o parcial
 *   `(escola_id, origem_id)` para as versões adaptadas de um artefato.
 */
export const artefato = pgTable(
  'artefato',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    turmaId: uuid().notNull(),
    disciplinaId: uuid().notNull(),
    tipo: text().$type<TipoDeArtefato>().notNull(),
    titulo: text().notNull(),
    conteudo: jsonb().$type<ConteudoDoArtefato>().notNull(),
    origemId: uuid(),
    execucaoId: uuid(),
    criadoPor: uuid(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('artefato_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('artefato_escola_ano_id_unico').on(tabela.escolaId, tabela.anoLetivoId, tabela.id),
    unique('artefato_escola_ano_turma_id_unico').on(tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.id),
    foreignKey({
      name: 'artefato_turma_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId],
      foreignColumns: [turma.escolaId, turma.anoLetivoId, turma.id],
    }),
    foreignKey({ name: 'artefato_disciplina_da_escola_fk', columns: [tabela.escolaId, tabela.disciplinaId], foreignColumns: [disciplina.escolaId, disciplina.id] }),
    foreignKey({
      name: 'artefato_origem_da_turma_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.turmaId, tabela.origemId],
      foreignColumns: [tabela.escolaId as AnyPgColumn, tabela.anoLetivoId as AnyPgColumn, tabela.turmaId as AnyPgColumn, tabela.id as AnyPgColumn],
    }),
    foreignKey({
      name: 'artefato_execucao_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.execucaoId],
      foreignColumns: [execucaoAgente.escolaId, execucaoAgente.anoLetivoId, execucaoAgente.id],
    }),
    // A migration escreve `on delete set null ("criado_por")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'artefato_criado_por_da_escola_fk', columns: [tabela.escolaId, tabela.criadoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    uniqueIndex('artefato_um_por_execucao').on(tabela.escolaId, tabela.execucaoId).where(sql`${tabela.execucaoId} is not null`),
    index('artefato_turma_idx').on(tabela.escolaId, tabela.turmaId, tabela.id),
    index('artefato_origem_idx').on(tabela.escolaId, tabela.origemId).where(sql`${tabela.origemId} is not null`),
    index('artefato_autoria_idx').on(tabela.escolaId, tabela.anoLetivoId).where(sql`${tabela.criadoPor} is not null`),
    // Por pessoa: a eliminação dela (o `on delete set null` da FK `artefato_criado_por_da_escola_fk`) acha os artefatos por aqui (F3, tarefa 5.0).
    index('artefato_criado_por_idx').on(tabela.escolaId, tabela.criadoPor).where(sql`${tabela.criadoPor} is not null`),
    check('artefato_tipo_valido', sql`${tabela.tipo} in ('atividade_objetiva', 'plano_de_aula')`),
    check('artefato_titulo_preenchido', sql`char_length(btrim(${tabela.titulo})) between 1 and 160`),
    check('artefato_conteudo_do_tipo', sql`jsonb_typeof(${tabela.conteudo}) = 'object' and coalesce(${tabela.conteudo} ->> 'tipo', '') = ${tabela.tipo}`),
    check('artefato_adaptada_so_de_atividade', sql`${tabela.origemId} is null or ${tabela.tipo} = 'atividade_objetiva'`),
    // `case` e não `and`: a ordem de avaliação é garantida, e `jsonb_array_length` e o `-` nunca rodam sobre o que não é
    // lista nem objeto. O que não cai em nenhum ramo é recusado, em vez de passar por o check dar nulo.
    check(
      'artefato_adaptacao_fechada',
      sql`(${tabela.origemId} is null) = (${tabela.conteudo} -> 'adaptacao' is null) and case
        when ${tabela.conteudo} -> 'adaptacao' is null then true
        when jsonb_typeof(${tabela.conteudo} -> 'adaptacao') = 'object' and jsonb_typeof(${tabela.conteudo} #> '{adaptacao,tipos}') = 'array' then
          jsonb_array_length(${tabela.conteudo} #> '{adaptacao,tipos}') >= 1
          and ${tabela.conteudo} #> '{adaptacao,tipos}' <@ '["fonte_ampliada", "tempo_adicional", "linguagem_direta", "enunciado_simplificado", "resposta_escrita_no_lugar_da_oral", "leitura_de_apoio"]'::jsonb
          and (${tabela.conteudo} -> 'adaptacao') - 'tipos' - 'tempoExtraPercentual' = '{}'::jsonb
        else false
      end`,
    ),
  ],
)
