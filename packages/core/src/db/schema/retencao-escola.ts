import type { CategoriaDeRetencao } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { check, integer, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/**
 * O ajuste de retenção de uma escola numa categoria (F3, RF2; Tech Spec do F3, seção 3). Uma linha por escola e
 * categoria, e só quando a operação ajustou: categoria sem linha usa o padrão do catálogo (`CATEGORIAS_DE_RETENCAO`, em
 * `@educa/shared`). Quem escreve é só o `ops:retencao`, no contexto da escola; quem lê é o `RetencaoDaEscolaRepository`.
 *
 * - `categoria` só aceita as doze do catálogo, escritas por extenso no check (o drizzle-kit lê o pacote pelo `dist`); o
 *   teste da migration compara o check com `CHAVES_DE_RETENCAO`. Os prazos fixos não têm linha.
 * - `meses` entre 1 e 60 é a rede de segurança do banco: o piso, o teto e as travas de cada categoria são conferidos pelo
 *   comando, contra o catálogo, antes de gravar (`ajusteDeRetencaoCabe`).
 * - `referencia_contrato` é o número do contrato ou do aditivo que pede o prazo, inteiro positivo, como o número do
 *   pedido no `ops:redefinir-mfa`: vai também para a auditoria (`retencao.ajustada`), que não aceita texto livre.
 * - `alterada_por` é o apelido do operador, no formato de `FORMATO_OPERADOR`, como o `auditoria.autor_operador`.
 * - Não varia por ano letivo: o prazo é do contrato da escola e atravessa a virada.
 */
export const retencaoEscola = pgTable(
  'retencao_escola',
  {
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    categoria: text().$type<CategoriaDeRetencao>().notNull(),
    meses: smallint().notNull(),
    referenciaContrato: integer().notNull(),
    alteradaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    alteradaPor: text().notNull(),
  },
  (tabela) => [
    primaryKey({ name: 'retencao_escola_pk', columns: [tabela.escolaId, tabela.categoria] }),
    check(
      'retencao_escola_categoria_valida',
      sql`${tabela.categoria} in ('conversa_tutor', 'sinal_tutor', 'conversa_professor', 'execucao_agente', 'texto_do_modelo', 'consumo_por_aluno', 'trabalho_do_aluno', 'reivindicacao_decidida', 'autoria_de_artefato', 'material_excluido', 'vinculo_encerrado', 'pessoa_desativada')`,
    ),
    check('retencao_escola_meses_validos', sql`${tabela.meses} between 1 and 60`),
    check('retencao_escola_referencia_positiva', sql`${tabela.referenciaContrato} > 0`),
    check('retencao_escola_alterada_por_formato', sql`${tabela.alteradaPor} ~ '^[a-z][a-z0-9-]{1,31}$'`),
  ],
)
