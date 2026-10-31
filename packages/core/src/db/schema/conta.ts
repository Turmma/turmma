import { sql } from 'drizzle-orm'
import { bigint, check, customType, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Sem import relativo: o drizzle-kit carrega este arquivo com o próprio carregador para gerar a migration.

/** E-mail sem diferença de caixa: `Camila@Escola.br` e `camila@escola.br` são a mesma conta. */
const citext = customType<{ data: string }>({ dataType: () => 'citext' })

/** Segredo cifrado (AES-256-GCM, tarefa 6.0): bytes, nunca texto legível. */
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

/**
 * A credencial global da equipe (Tech Spec, seção 1): o e-mail, o hash da senha e o segundo fator. Professor e
 * coordenador que trabalham em duas escolas têm uma conta só e um `usuario` em cada escola.
 *
 * - Não tem `escola_id`: é o desvio declarado da regra 10, itens 1 e 9 (Tech Spec, seção 6). Toda operação nela
 *   passa pelo repository de resolução de tenant do módulo de sessão, pelo repository da conta global em
 *   `nucleo/ciclo-de-vida` (F3, tarefa 1.0) ou pela limpeza do expurgo de acesso, com `@Unscoped` justificado.
 * - Aluno não tem conta: não tem e-mail no sistema (regra 20, item 2).
 * - Hash, segredo e passo do TOTP nunca saem em DTO nem em log (`docs/lgpd.md`); as colunas de MFA ficam vazias
 *   até a tarefa 6.0.
 * - `email` só é nulo na conta limpa (tarefa 17.0): quando ela deixa de ter usuário ativo em escola nenhuma, e-mail,
 *   senha e segundo fator saem, e fica só o id, que os usuários desativados dela ainda apontam. O `unique` aceita
 *   vários nulos, e o check de formato passa com nulo.
 */
export const conta = pgTable(
  'conta',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    email: citext().unique('conta_email_unico'),
    senhaHash: text(),
    mfaSegredoCifrado: bytea(),
    mfaChaveVersao: smallint(),
    mfaAtivadoEm: timestamp({ withTimezone: true }),
    mfaUltimoPasso: bigint({ mode: 'number' }),
  },
  (tabela) => [check('conta_email_formato', sql`char_length(${tabela.email}) between 3 and 254 and position('@' in ${tabela.email}) > 1`)],
)
