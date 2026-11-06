import { sql } from 'drizzle-orm'
import { check, date, foreignKey, index, pgTable, text, time, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { vinculo } from './vinculo.js'

/**
 * O registro da aula: o que a professora vai dar, ou deu, numa aula da grade numa data (glossário, "Aula"; F2b, tarefa 1.0;
 * Tech Spec da semana-do-professor, seção 3). Guarda **só o texto**, sem FK para a `alocacao`: a reimportação da grade apaga e
 * recria a alocação, e o texto passado precisa sobreviver à saída da grade (RF14) e ao feriado (RF13). Casa com a alocação por
 * (vínculo, dia da semana da `data`, `inicio`), na leitura.
 *
 * - `vinculo_id` por FK composta `(escola_id, ano_letivo_id, vinculo_id)` com o ano do vínculo, `on delete cascade`: o registro
 *   nunca aponta para o vínculo de outra escola nem de outro ano, e sai com ele. Como na `alocacao`, essa FK já é a FK composta
 *   com o ano: o vínculo só existe num ano da própria escola.
 * - `fim` é cópia do fim da alocação, só para o registro que saiu da grade ("fora da grade") continuar com o horário que tinha.
 * - Único `(vinculo_id, data, inicio)`: uma linha por aula; a gravação é `insert … on conflict do update`. Só existe com texto: texto
 *   vazio apaga a linha.
 * - `conteudo` de 1 a 500 caracteres depois do `btrim` (500 é `TAMANHO_MAXIMO_DO_TEXTO_DA_AULA` do contrato, `packages/shared`).
 *   É texto livre da professora e **pode trazer nome de aluno**: a tela pede para não escrever; nunca vai a log, a auditoria, à
 *   coordenação nem a IA (`docs/lgpd.md`, "Registro da aula").
 * - Sai na virada do ano (`VinculoRepository.virarAno`, na transação do encerramento) e, antes dela, em cascata com o vínculo.
 *   Não entra na troca de nome (`troca-de-nome.ts`): o nome de aluno eliminado não passa da virada.
 * - Índice `(escola_id, ano_letivo_id, vinculo_id, data)` para a semana da professora: começa pelo escopo (regra 80, item 8).
 */
export const aula = pgTable(
  'aula',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    anoLetivoId: uuid().notNull(),
    vinculoId: uuid().notNull(),
    data: date({ mode: 'string' }).notNull(),
    inicio: time().notNull(),
    fim: time().notNull(),
    conteudo: text().notNull(),
    atualizadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('aula_vinculo_data_inicio_unico').on(tabela.vinculoId, tabela.data, tabela.inicio),
    foreignKey({
      name: 'aula_vinculo_do_ano_da_escola_fk',
      columns: [tabela.escolaId, tabela.anoLetivoId, tabela.vinculoId],
      foreignColumns: [vinculo.escolaId, vinculo.anoLetivoId, vinculo.id],
    }).onDelete('cascade'),
    index('aula_semana_idx').on(tabela.escolaId, tabela.anoLetivoId, tabela.vinculoId, tabela.data),
    check('aula_horario_valido', sql`${tabela.inicio} < ${tabela.fim}`),
    check('aula_conteudo_preenchido', sql`char_length(btrim(${tabela.conteudo})) between 1 and 500`),
  ],
)
