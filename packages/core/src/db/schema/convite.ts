import { ESTADOS_DO_ENVIO, TIPOS_DE_CONVITE, VALIDADE_DO_CONVITE_HORAS, VALIDADE_DO_CONVITE_HORAS_POR_TIPO, type EstadoDoEnvio, type TipoDeConvite } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { check, customType, foreignKey, index, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

/** Por onde o link chegou à pessoa: copiado pela coordenação, ou enviado por e-mail pelo worker (acesso-e-convites, 1.0). */
export const CANAIS_DE_CONVITE = ['copiado', 'email'] as const
export type CanalDeConvite = (typeof CANAIS_DE_CONVITE)[number]

/** A vida do envio por e-mail (Tech Spec do acesso-e-convites, seção 3) mora em `@educa/shared`, que a lista de professores e a web também leem. */
export { ESTADOS_DO_ENVIO, type EstadoDoEnvio }

/** Os tipos e a validade de cada um moram em `@educa/shared`, que a web também lê (A1, tarefa 3.0). */
export { TIPOS_DE_CONVITE, VALIDADE_DO_CONVITE_HORAS, VALIDADE_DO_CONVITE_HORAS_POR_TIPO, type TipoDeConvite }

/**
 * O convite do primeiro coordenador (tarefa 7.0; Tech Spec, seções 3 e 5, "Convite") e o do professor (A1, tarefa 3.0).
 * O de coordenador nasce só pelo operador: o `ops:convite-coordenador` ou o painel da operação (A0b), nunca por rota de
 * escola (RF1, D2). O de professor nasce só pela coordenação da escola, no cadastro do professor (A1, RF6). O `tipo`
 * separa os dois em toda escrita: o operador só alcança o de coordenador, e a coordenação só o de professor.
 *
 * - Guarda só o SHA-256 do token (`token_hash`, 64 caracteres hexadecimais), nunca o token: quem lê o banco não tem o
 *   link (regra 20, item 8).
 * - Uso único, expiração e revogação são colunas, e o aceite é um `update … where usado_em is null and revogado_em is
 *   null and expira_em > now()`: dois aceites ao mesmo tempo passam uma vez (regra 80, item 7).
 * - `(escola_id, usuario_id)` é FK composta para `usuario (escola_id, id)`: o convite nunca aponta para usuário de
 *   outra escola. Sai com o usuário (`on delete cascade`), que é de quem ele é.
 * - O índice `(escola_id, usuario_id)` serve à ativação no login.
 * - No máximo um convite em aberto (nem usado, nem revogado) por usuário na escola (`convite_pendente_unico`, A0b): a
 *   rede de segurança da trava da escola (Tech Spec da A0b, seção 7c), que deixa um só em aberto por escola. O 23505
 *   dele vira `CONFLITO` (`ConviteRepository.criarConvite`).
 * - Sem nome e sem e-mail: esses ficam no `usuario` e na `conta` (`docs/lgpd.md`, "Convite de coordenador").
 * - **O envio por e-mail** (acesso-e-convites, 1.0): `canal`, `envio`, `envio_reservado_em` e `enviado_em` dizem em que pé está o
 *   e-mail do convite de canal `email`. O token e o endereço ficam cifrados (AES-GCM, o id da linha como dado autenticado) só
 *   enquanto o envio está `na_fila` ou `enviando`: é o que o job precisa para montar a mensagem, e o check
 *   `convite_cifrados_so_no_envio_aberto` exige os dois nesses estados e os mantém nulos em qualquer outro (também no convite `copiado`). `criado_em` conta as 24 h do expurgo do envio parado.
 */
export const convite = pgTable(
  'convite',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    tokenHash: text().notNull().unique('convite_token_hash_unico'),
    tipo: text().$type<TipoDeConvite>().notNull(),
    usuarioId: uuid().notNull(),
    expiraEm: timestamp({ withTimezone: true }).notNull(),
    usadoEm: timestamp({ withTimezone: true }),
    revogadoEm: timestamp({ withTimezone: true }),
    canal: text().$type<CanalDeConvite>().notNull().default('copiado'),
    tokenCifrado: bytea(),
    destinoCifrado: bytea(),
    envio: text().$type<EstadoDoEnvio>(),
    envioReservadoEm: timestamp({ withTimezone: true }),
    enviadoEm: timestamp({ withTimezone: true }),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('convite_escola_id_unico').on(tabela.escolaId, tabela.id),
    foreignKey({ name: 'convite_usuario_da_escola_fk', columns: [tabela.escolaId, tabela.usuarioId], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('cascade'),
    index('convite_escola_usuario_idx').on(tabela.escolaId, tabela.usuarioId),
    uniqueIndex('convite_pendente_unico').on(tabela.escolaId, tabela.usuarioId).where(sql`${tabela.usadoEm} is null and ${tabela.revogadoEm} is null`),
    check('convite_tipo_valido', sql`${tabela.tipo} in ('coordenador', 'professor')`),
    check('convite_token_hash_formato', sql`${tabela.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('convite_canal_valido', sql`${tabela.canal} in ('copiado', 'email')`),
    check('convite_envio_valido', sql`${tabela.envio} in ('na_fila', 'enviando', 'enviado', 'falhou', 'cancelado')`),
    check('convite_envio_so_por_email', sql`(${tabela.canal} = 'email') = (${tabela.envio} is not null)`),
    check(
      'convite_cifrados_so_no_envio_aberto',
      sql`case when ${tabela.envio} in ('na_fila', 'enviando') then ${tabela.tokenCifrado} is not null and ${tabela.destinoCifrado} is not null else ${tabela.tokenCifrado} is null and ${tabela.destinoCifrado} is null end`,
    ),
    check('convite_reserva_so_enviando', sql`${tabela.envioReservadoEm} is null or (${tabela.envio} is not null and ${tabela.envio} = 'enviando')`),
    index('convite_envio_aberto_idx').on(tabela.escolaId, tabela.criadoEm).where(sql`${tabela.envio} in ('na_fila', 'enviando')`),
  ],
)
