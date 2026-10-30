import { sql } from 'drizzle-orm'
import { bigint, check, customType, index, inet, integer, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

// Sem import relativo: o drizzle-kit carrega este arquivo com o próprio carregador para gerar a migration.

/** E-mail sem diferença de caixa, como o da `conta`. */
const citext = customType<{ data: string }>({ dataType: () => 'citext' })

/** Segredo cifrado (AES-256-GCM, a mesma peça do F1): bytes, nunca texto legível. */
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

/** Quanto vale o convite de operador desde que o `ops:operador` o gera (Tech Spec da A0, seção 3). */
export const VALIDADE_DO_CONVITE_DE_OPERADOR_HORAS = 72

/**
 * O autor da `AuditoriaOperacao` quando ainda não há operador ativo e o comando aceita o `OPERADOR` do ambiente. Nenhum
 * operador pode ter este apelido: a auditoria não pode confundir o nascimento com uma pessoa.
 */
export const AUTOR_BOOTSTRAP = 'bootstrap'

/**
 * Por que a sessão do operador terminou: a saída, o reuso do refresh, a desativação, ou o aceite de um convite novo da
 * conta (A0b, tarefa 9.0), que é o caminho de recuperá-la e troca a senha: as sessões abertas com a credencial de antes
 * não seguem abertas.
 */
export const MOTIVOS_DE_ENCERRAMENTO_DE_OPERADOR = ['saida', 'reuso_de_refresh', 'desativacao', 'convite_aceito'] as const
export type MotivoDeEncerramentoDeOperador = (typeof MOTIVOS_DE_ENCERRAMENTO_DE_OPERADOR)[number]

export const EVENTOS_DE_ACESSO_DA_OPERACAO = ['entrada', 'entrada_falha', 'saida'] as const
export type EventoDeAcessoDaOperacao = (typeof EVENTOS_DE_ACESSO_DA_OPERACAO)[number]

export const ACOES_DA_AUDITORIA_DA_OPERACAO = [
  'operador.criado',
  'operador.desativado',
  'operador.mfa_configurado',
  'convite_operador.gerado',
  'convite_operador.revogado',
  'convite_operador.aceito',
] as const
export type AcaoDaAuditoriaDaOperacao = (typeof ACOES_DA_AUDITORIA_DA_OPERACAO)[number]

/**
 * As seis tabelas da operação Turmma (A0, D76; Tech Spec, seção 3). São da nossa equipe, não de escola: **sem
 * `escola_id`**, o único desvio declarado da regra 10, item 1 (Tech Spec, seção 11). Por isso só o
 * `OperadorRepository` (`apps/api/src/operacao/`) as toca, e o expurgo (tarefa 9.0); um teste de arquitetura procura
 * outro uso, pelo `import` e pelo nome da tabela em SQL. Nenhuma delas entra no `schema` do `createDatabase`, como a
 * `auditoria`: a consulta relacional (`banco.query.*`) não as alcança de fora.
 *
 * Nenhum dado de escola nem de aluno. Nome, e-mail, hash e segredo nunca saem em log nem em DTO (`docs/lgpd.md`,
 * linhas da operação).
 */

/**
 * A conta de quem é da equipe. O `apelido` é o identificador que o `OPERADOR` dos comandos e a `auditoria.autor_operador`
 * usam, e fica para sempre: a auditoria o cita. Desativar apaga nome, e-mail, senha, segredo e códigos na mesma
 * transação (check `operador_desativado_sem_dado_pessoal`); ativo sempre tem nome e e-mail.
 *
 * - `mfa_versao` sobe a cada segredo gravado pelo configurar (tarefa 7.0): a ativação confere a versão do desafio.
 * - Hash de senha, segredo e passo do TOTP ficam vazios até o aceite do convite e o configurar (tarefas 5.0 e 7.0).
 */
export const operador = pgTable(
  'operador',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    apelido: text().notNull().unique('operador_apelido_unico'),
    nome: text(),
    email: citext().unique('operador_email_unico'),
    senhaHash: text(),
    mfaSegredoCifrado: bytea(),
    mfaChaveVersao: smallint(),
    mfaVersao: integer().notNull().default(0),
    mfaAtivadoEm: timestamp({ withTimezone: true }),
    mfaUltimoPasso: bigint({ mode: 'number' }),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    desativadoEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    // O `FORMATO_OPERADOR` de `@educa/shared`, escrito por extenso porque o drizzle-kit lê o pacote pelo `dist`, que pode estar atrás; o
    // teste `formato-do-operador.int.test.ts` compara o check do banco com a constante. Nunca o autor reservado do nascimento.
    // `rotina` também é reservado (F3, tarefa 15.0): é o autor do job da eliminação e do expurgo, e a auditoria só o aceita
    // em quatro ações (`auditoria_rotina_so_nas_acoes`). Um operador com esse apelido assinaria como se fosse o sistema.
    check('operador_apelido_formato', sql`${tabela.apelido} ~ '^[a-z][a-z0-9-]{1,31}$' and ${tabela.apelido} <> 'bootstrap' and ${tabela.apelido} <> 'rotina'`),
    check('operador_nome_curto', sql`${tabela.nome} is null or char_length(${tabela.nome}) between 1 and 200`),
    check('operador_email_formato', sql`char_length(${tabela.email}) between 3 and 254 and position('@' in ${tabela.email}) > 1`),
    check('operador_ativo_com_nome_e_email', sql`${tabela.desativadoEm} is not null or (${tabela.nome} is not null and ${tabela.email} is not null)`),
    check(
      'operador_desativado_sem_dado_pessoal',
      sql`${tabela.desativadoEm} is null or (${tabela.nome} is null and ${tabela.email} is null and ${tabela.senhaHash} is null and ${tabela.mfaSegredoCifrado} is null and ${tabela.mfaChaveVersao} is null and ${tabela.mfaAtivadoEm} is null and ${tabela.mfaUltimoPasso} is null)`,
    ),
  ],
)

/**
 * Os códigos de recuperação do segundo fator do operador: só o HMAC, com a chave própria do F1. O código usado sai por
 * `delete … returning` (tarefa 7.0), e desativar apaga todos. A chave primária é também a busca do código de um operador.
 */
export const codigoRecuperacaoOperador = pgTable(
  'codigo_recuperacao_operador',
  {
    operadorId: uuid()
      .notNull()
      .references(() => operador.id),
    hmac: text().notNull(),
  },
  (tabela) => [
    primaryKey({ name: 'codigo_recuperacao_operador_pk', columns: [tabela.operadorId, tabela.hmac] }),
    // HMAC-SHA256 em base64url: 43 caracteres, nunca o código em si.
    check('codigo_recuperacao_operador_hmac_formato', sql`char_length(${tabela.hmac}) = 43`),
  ],
)

/**
 * O convite do operador, de uso único e 72 h, gerado só pelo `ops:operador` (`criar` e `convite`). O banco guarda só o
 * SHA-256 do token; o valor vai para o arquivo 0600. **Um pendente por operador**, pelo único parcial: gerar outro
 * revoga o anterior na mesma transação. Pendente é o que não foi usado nem revogado, vencido ou não.
 */
export const conviteOperador = pgTable(
  'convite_operador',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    operadorId: uuid()
      .notNull()
      .references(() => operador.id),
    tokenHash: text().notNull().unique('convite_operador_token_hash_unico'),
    expiraEm: timestamp({ withTimezone: true }).notNull(),
    usadoEm: timestamp({ withTimezone: true }),
    revogadoEm: timestamp({ withTimezone: true }),
  },
  (tabela) => [
    uniqueIndex('convite_operador_pendente_unico').on(tabela.operadorId).where(sql`usado_em is null and revogado_em is null`),
    check('convite_operador_token_hash_formato', sql`${tabela.tokenHash} ~ '^[0-9a-f]{64}$'`),
  ],
)

/**
 * A sessão do operador, no Postgres como a da escola: 8 h no máximo, e 30 min sem uso a encerram (tarefa 8.0). Os
 * hashes são do cookie `turmma_operacao`, nunca o valor. Sem IP: o IP fica em `acesso_operacao`.
 */
export const sessaoOperador = pgTable(
  'sessao_operador',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    operadorId: uuid()
      .notNull()
      .references(() => operador.id),
    refreshHash: text().notNull().unique('sessao_operador_refresh_hash_unico'),
    refreshHashAnterior: text(),
    rotacionadoEm: timestamp({ withTimezone: true }),
    criadaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ultimoUsoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiraEm: timestamp({ withTimezone: true }).notNull(),
    encerradaEm: timestamp({ withTimezone: true }),
    motivo: text().$type<MotivoDeEncerramentoDeOperador>(),
  },
  (tabela) => [
    index('sessao_operador_refresh_hash_anterior_idx').on(tabela.refreshHashAnterior),
    // Encerrar as sessões abertas de um operador (desativar, tarefa 3.0) desce por aqui.
    index('sessao_operador_aberta_idx').on(tabela.operadorId).where(sql`encerrada_em is null`),
    // O expurgo de 30 dias (tarefa 9.0) desce pelo fim da sessão, como o `sessao_fim_idx`.
    index('sessao_operador_fim_idx').on(sql`coalesce(${tabela.encerradaEm}, ${tabela.expiraEm})`),
    check('sessao_operador_motivo_valido', sql`${tabela.motivo} is null or ${tabela.motivo} in ('saida', 'reuso_de_refresh', 'desativacao', 'convite_aceito')`),
    check('sessao_operador_motivo_so_encerrada', sql`${tabela.motivo} is null or ${tabela.encerradaEm} is not null`),
  ],
)

/**
 * O registro de acesso da operação (Marco Civil, art. 15): evento, IP e data, por 6 meses. Nunca o e-mail digitado; a
 * falha sem operador reconhecido fica sem `operador_id`. A escola nunca lê.
 */
export const acessoOperacao = pgTable(
  'acesso_operacao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    operadorId: uuid().references(() => operador.id),
    evento: text().$type<EventoDeAcessoDaOperacao>().notNull(),
    ip: inet().notNull(),
    em: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    // O expurgo de 6 meses (tarefa 9.0) desce por aqui.
    index('acesso_operacao_em_idx').on(tabela.em),
    check('acesso_operacao_evento_valido', sql`${tabela.evento} in ('entrada', 'entrada_falha', 'saida')`),
    check('acesso_operacao_operador_so_falta_na_falha', sql`${tabela.operadorId} is not null or ${tabela.evento} = 'entrada_falha'`),
  ],
)

/**
 * A auditoria da operação: quem criou ou desativou operador, configurou segundo fator, gerou ou revogou convite de
 * operador, aceitou o convite (que troca a senha e zera o segundo fator), e quando. Prestação de contas por vigência + 5
 * anos, fora do expurgo de acesso (`docs/lgpd.md`). O autor é o apelido do `OPERADOR` do comando, `bootstrap` no
 * nascimento, ou o próprio operador no segundo fator e no aceite. Sem texto livre: autor, ação da lista fechada, alvo e
 * data.
 */
export const auditoriaOperacao = pgTable(
  'auditoria_operacao',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    autor: text().notNull(),
    acao: text().$type<AcaoDaAuditoriaDaOperacao>().notNull(),
    operadorAlvoId: uuid()
      .notNull()
      .references(() => operador.id),
    em: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index('auditoria_operacao_alvo_em_idx').on(tabela.operadorAlvoId, tabela.em),
    // O `FORMATO_OPERADOR`, como no check do apelido.
    check('auditoria_operacao_autor_formato', sql`${tabela.autor} ~ '^[a-z][a-z0-9-]{1,31}$'`),
    check(
      'auditoria_operacao_acao_valida',
      sql`${tabela.acao} in ('operador.criado', 'operador.desativado', 'operador.mfa_configurado', 'convite_operador.gerado', 'convite_operador.revogado', 'convite_operador.aceito')`,
    ),
  ],
)
