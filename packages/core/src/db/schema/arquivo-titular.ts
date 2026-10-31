import type { VersaoDoArquivo } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { check, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { pedidoTitular } from './pedido-titular.js'

/**
 * O arquivo do titular que o pedido de acesso ou de portabilidade gera (F3, RF11, RF12 e RF17; Tech Spec do F3, seções 3
 * e 5; `docs/lgpd.md`, "Arquivo do titular"). O JSON mora no storage privado, e esta linha guarda **só onde ele está e
 * por quanto tempo**: nenhum dado do titular passa por aqui.
 *
 * - **`chave_objeto` nunca sai pela API** (`COLUNAS_FORA_DO_ARQUIVO`, RF17). O check `arquivo_titular_chave_da_escola`
 *   a amarra à escola, ao pedido e à versão: `titular/<escola>/<pedido>/<versao>.json`. Sem ele, uma linha poderia
 *   apontar para o objeto de outra escola, e a URL assinada o entregaria.
 * - **Uma linha por pedido e versão** (`unique (escola_id, pedido_id, versao)`): dois jobs do mesmo pedido gravam a mesma
 *   linha (`on conflict do update`) e a mesma chave do objeto, e o segundo sobrescreve o primeiro, sem duplicar.
 * - **`expira_em` é `pronto_em` + 7 dias** (RF12). Depois dele, ou com `apagado_em` (a eliminação do titular, 15.0), a
 *   rotina da escola apaga o objeto do storage e só então a linha. A linha com `apagado_em` e o objeto ainda no
 *   storage é o que uma falha ao apagar deixa: a noite seguinte tenta de novo pelo mesmo `apagado_em`.
 * - **A FK composta com a escola** (`arquivo_titular_pedido_da_escola_fk`, regra 10) impede apontar para o pedido de outra
 *   escola. O pedido nunca é apagado antes do fim de contrato (F12), então não há `on delete`.
 * - Índice `(escola_id, expira_em)`: a rotina da escola lista os vencidos pelo escopo e pela data (regra 80, item 8).
 */
export const arquivoTitular = pgTable(
  'arquivo_titular',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    pedidoId: uuid().notNull(),
    versao: text().$type<VersaoDoArquivo>().notNull(),
    chaveObjeto: text().notNull(),
    bytes: integer().notNull(),
    prontoEm: timestamp({ withTimezone: true }).notNull(),
    expiraEm: timestamp({ withTimezone: true }).notNull(),
    apagadoEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    unique('arquivo_titular_pedido_versao_unico').on(tabela.escolaId, tabela.pedidoId, tabela.versao),
    foreignKey({ name: 'arquivo_titular_pedido_da_escola_fk', columns: [tabela.escolaId, tabela.pedidoId], foreignColumns: [pedidoTitular.escolaId, pedidoTitular.id] }),
    index('arquivo_titular_escola_expira_idx').on(tabela.escolaId, tabela.expiraEm),
    check('arquivo_titular_versao_valida', sql`${tabela.versao} in ('completa', 'coordenacao')`),
    check(
      'arquivo_titular_chave_da_escola',
      sql`${tabela.chaveObjeto} = 'titular/' || ${tabela.escolaId}::text || '/' || ${tabela.pedidoId}::text || '/' || ${tabela.versao} || '.json'`,
    ),
    check('arquivo_titular_bytes_nao_negativos', sql`${tabela.bytes} >= 0`),
    check('arquivo_titular_expira_depois_de_pronto', sql`${tabela.expiraEm} > ${tabela.prontoEm}`),
  ],
)
