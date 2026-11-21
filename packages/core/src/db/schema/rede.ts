import { TIPOS_DE_REDE, type TipoDeRede } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { bigint, check, inet, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core'

// Sem import relativo: o drizzle-kit carrega este arquivo com o próprio carregador para gerar a migration.

/** Os tipos de rede moram em `@educa/shared`, que o contrato do painel da operação também lê. */
export { TIPOS_DE_REDE, type TipoDeRede }

/**
 * A camada acima da escola (glossário, "Rede"). A escola particular independente é uma rede de uma
 * unidade só, para não existirem dois fluxos no código. Nasce só pelo operador Turmma: o `ops:escola` ou o painel da
 * operação (`POST /v1/operacao/redes`, A0b), nunca por rota de escola (RF1, D2). O id pode vir do pedido (idempotência).
 *
 * - Não tem `escola_id`: é a raiz acima do tenant, e nenhum dado de pessoa mora aqui.
 * - `ips_saida` é o IP público de saída da rede (não é dado de pessoa), usado só pelo limite por IP da
 *   rota de e-mail (tarefa 15.0).
 * - `ia_valor_por_aluno_micros` e `ia_teto_de_seguranca_percentual` (camada-ia, tarefa 2.0) são o orçamento de IA que a escola herda quando não tem o
 *   próprio, coluna a coluna (`orcamento-de-ia.ts`, em `@educa/shared`). A rede é a exceção da operação, acima do tenant: só o
 *   `OrcamentoDaRedeRepository` a grava (3.0), e a escola a lê pelo próprio `escola.rede_id`, no `OrcamentoDoMesRepository`.
 */
export const rede = pgTable(
  'rede',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    nome: text().notNull(),
    tipo: text().$type<TipoDeRede>().notNull(),
    ipsSaida: inet().array().notNull().default(sql`'{}'::inet[]`),
    /** O valor de IA por aluno por mês da rede, em micros (camada-ia, tarefa 2.0; D41): vale para a escola que não tem o próprio. Nulo: sem valor. */
    iaValorPorAlunoMicros: bigint({ mode: 'number' }),
    /** O teto de segurança do lote da rede, em % do orçamento (100 a 1000): vale para a escola que não tem o próprio. */
    iaTetoDeSegurancaPercentual: smallint(),
  },
  (tabela) => [
    check('rede_tipo_valido', sql`${tabela.tipo} in ('prefeitura', 'grupo', 'independente')`),
    check('rede_nome_preenchido', sql`char_length(btrim(${tabela.nome})) between 1 and 200`),
    check('rede_ia_valor_positivo', sql`${tabela.iaValorPorAlunoMicros} > 0`),
    check('rede_ia_teto_valido', sql`${tabela.iaTetoDeSegurancaPercentual} between 100 and 1000`),
  ],
)
