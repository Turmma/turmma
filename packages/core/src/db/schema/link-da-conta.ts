import { ESTADOS_DO_ENVIO, type EstadoDoEnvio } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { check, customType, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { conta } from './conta.js'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

/** Para que o link serve: trocar a senha (acesso-e-convites, 5.0) ou provar a posse do e-mail (7.0). */
export const FINALIDADES_DO_LINK_DA_CONTA = ['redefinir', 'verificar'] as const
export type FinalidadeDoLinkDaConta = (typeof FINALIDADES_DO_LINK_DA_CONTA)[number]

export { ESTADOS_DO_ENVIO, type EstadoDoEnvio }

/**
 * O link que a conta global recebe por e-mail: o do "esqueci a senha" (acesso-e-convites, tarefa 5.0; Tech Spec, seções 3 e 5) e, na
 * 7.0, o de verificar o e-mail. Como o convite, guarda só o SHA-256 do token (`token_hash`) e, enquanto o envio espera (`na_fila` ou
 * `enviando`), o token e o endereço cifrados (AES-GCM, o id da linha como dado autenticado): é o que o job precisa para montar a
 * mensagem. O check `link_da_conta_cifrados_so_no_envio_aberto` os mantém nulos em qualquer outro estado.
 *
 * - **Não tem `escola_id`.** É da `conta`, que é global: desvio da regra 10, itens 1 e 9, declarado em `docs/modelo-de-dados.md`, como
 *   o `codigo_recuperacao`. Na API, quem a toca é a `TenantResolutionRepository` (pelo hash do token e pela conta); no worker, o
 *   `EnvioRepository` (pelo id do job) e o `ExpurgoDeAcessoRepository`, cada método com `@Unscoped` justificado.
 * - **Um aberto por conta e finalidade** (`link_da_conta_aberto_unico`): o "esqueci" cancela o anterior antes de gravar o novo, e dois
 *   pedidos ao mesmo tempo deixam um só (o perdedor leva 23505, que vira o mesmo 202).
 * - **`usado_em` marca o fim do link**, usado ou substituído por um link novo: o `redefinir` consome com `update … where usado_em is
 *   null`, e dois pedidos com o mesmo token passam um só (regra 80, item 7).
 * - Sai com a conta (`on delete cascade`) e 30 dias depois do uso ou do vencimento, pelo `sistema.expurgar-acesso`
 *   (`link_da_conta_fim_idx` serve ao `order by`).
 */
export const linkDaConta = pgTable(
  'link_da_conta',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    contaId: uuid()
      .notNull()
      .references(() => conta.id, { onDelete: 'cascade' }),
    finalidade: text().$type<FinalidadeDoLinkDaConta>().notNull(),
    tokenHash: text().notNull().unique('link_da_conta_token_hash_unico'),
    tokenCifrado: bytea(),
    destinoCifrado: bytea(),
    expiraEm: timestamp({ withTimezone: true }).notNull(),
    usadoEm: timestamp({ withTimezone: true }),
    envio: text().$type<EstadoDoEnvio>().notNull(),
    envioReservadoEm: timestamp({ withTimezone: true }),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    uniqueIndex('link_da_conta_aberto_unico').on(tabela.contaId, tabela.finalidade).where(sql`${tabela.usadoEm} is null`),
    index('link_da_conta_fim_idx').on(sql`coalesce(${tabela.usadoEm}, ${tabela.expiraEm})`),
    check('link_da_conta_finalidade_valida', sql`${tabela.finalidade} in ('redefinir', 'verificar')`),
    check('link_da_conta_token_hash_formato', sql`${tabela.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('link_da_conta_envio_valido', sql`${tabela.envio} in ('na_fila', 'enviando', 'enviado', 'falhou', 'cancelado')`),
    check(
      'link_da_conta_cifrados_so_no_envio_aberto',
      sql`case when ${tabela.envio} in ('na_fila', 'enviando') then ${tabela.tokenCifrado} is not null and ${tabela.destinoCifrado} is not null else ${tabela.tokenCifrado} is null and ${tabela.destinoCifrado} is null end`,
    ),
    check('link_da_conta_reserva_so_enviando', sql`${tabela.envioReservadoEm} is null or ${tabela.envio} = 'enviando'`),
  ],
)
