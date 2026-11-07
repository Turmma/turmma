import { hkdfSync } from 'node:crypto'
import { z } from 'zod'
import { enderecoDaNossaRede, FORMATO_DO_PROVEDOR_ID } from '../config/llm-config.js'
import { AMBIENTES, validateEnvironment } from '../config/validate-config.js'
import type { SmtpConfig } from './smtp-email-sender.js'

/**
 * `falso` é o adaptador do teste (guarda a mensagem e não envia); `smtp` fala com qualquer servidor de saída, o Mailpit do
 * desenvolvimento ou o provedor contratado. Trocar de um para o outro é só variável de ambiente (D81).
 */
export const ADAPTADORES_DE_EMAIL = ['falso', 'smtp'] as const
export type EmailAdapterKind = (typeof ADAPTADORES_DE_EMAIL)[number]

export const MOTIVO_EMAIL_FALSO_EM_PRODUCAO =
  'EMAIL_ADAPTADOR=falso é proibido com AMBIENTE=producao: o adaptador falso não envia nada, e a escola real esperaria um convite que nunca sai'
export const MOTIVO_EMAIL_SEM_SERVIDOR = 'EMAIL_ADAPTADOR=smtp precisa de EMAIL_SMTP_HOST'
export const MOTIVO_EMAIL_SEM_PROVEDOR_ID =
  'EMAIL_PROVEDOR_ID é obrigatória com EMAIL_ADAPTADOR=smtp fora de AMBIENTE=local: é a chave do suboperador que recebe o e-mail do convite (LGPD, art. 18, VII)'
export const MOTIVO_EMAIL_SEM_TLS = 'EMAIL_SMTP_TLS=true é obrigatório com EMAIL_ADAPTADOR=smtp fora de AMBIENTE=local: o link do convite não trafega em claro'
export const MOTIVO_EMAIL_NO_MAILPIT = 'EMAIL_SMTP_HOST é desta máquina ou da nossa rede (o Mailpit do desenvolvimento): fora de AMBIENTE=local, a mensagem não chegaria a ninguém'

/** AES-256 pede chave de exatamente 256 bits, que o HKDF deriva do texto da variável. */
export const BYTES_DA_CHAVE_DO_TOKEN_DE_EMAIL = 32
export const TAMANHO_MINIMO_DA_CHAVE_DO_TOKEN_DE_EMAIL = 32
/** A versão da chave que o `SecretCipher` do e-mail usa: há uma chave só (Tech Spec, seção 3), e a troca dela recomeça o envio. */
export const VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL = 1
/** O rótulo (`info`) do HKDF: a chave do e-mail nunca é a mesma sequência de bytes da do MFA, mesmo que o texto da variável se repita. */
const ROTULO_DA_CHAVE_DO_TOKEN_DE_EMAIL = 'educa.email.token.aes-256-gcm'

const opcional = <Esquema extends z.ZodType>(esquema: Esquema) => z.preprocess((valor) => (valor === '' ? undefined : valor), esquema)

export const emailEnvSchema = z
  .object({
    AMBIENTE: z.enum(AMBIENTES),
    EMAIL_ADAPTADOR: opcional(z.enum(ADAPTADORES_DE_EMAIL).default('falso')),
    EMAIL_SMTP_HOST: opcional(z.string().min(1).max(253).optional()),
    EMAIL_SMTP_PORTA: opcional(z.coerce.number().int().min(1).max(65_535).default(587)),
    EMAIL_SMTP_TLS: opcional(z.enum(['true', 'false']).default('false')),
    EMAIL_SMTP_USUARIO: opcional(z.string().min(1).optional()),
    /** Nunca vai para log, erro nem registro. */
    EMAIL_SMTP_SENHA: opcional(z.string().min(1).optional()),
    EMAIL_REMETENTE: opcional(z.string().min(3).max(200).default('Turmma <nao-responda@turmma.invalid>')),
    /** Quem recebe o e-mail: a chave do suboperador. Não é segredo. */
    EMAIL_PROVEDOR_ID: opcional(z.string().regex(FORMATO_DO_PROVEDOR_ID).optional()),
    /** A chave que cifra o token e o endereço enquanto o envio espera: pelo menos 32 caracteres. */
    EMAIL_TOKEN_KEY: z.string().min(TAMANHO_MINIMO_DA_CHAVE_DO_TOKEN_DE_EMAIL),
    /** O endereço público da web, de onde sai o link do convite: o token vai depois do `#`. */
    EMAIL_URL_DA_WEB: z.url({ protocol: /^https?$/ }),
  })
  .superRefine((valores, contexto) => {
    const problema = (variavel: string, message: string): void => contexto.addIssue({ code: 'custom', path: [variavel], message })
    if (valores.AMBIENTE === 'producao' && valores.EMAIL_ADAPTADOR === 'falso') problema('EMAIL_ADAPTADOR', MOTIVO_EMAIL_FALSO_EM_PRODUCAO)
    if (valores.EMAIL_ADAPTADOR !== 'smtp') return
    if (valores.EMAIL_SMTP_HOST === undefined) {
      problema('EMAIL_SMTP_HOST', MOTIVO_EMAIL_SEM_SERVIDOR)
      return
    }
    if (valores.AMBIENTE === 'local') return
    if (valores.EMAIL_PROVEDOR_ID === undefined) problema('EMAIL_PROVEDOR_ID', MOTIVO_EMAIL_SEM_PROVEDOR_ID)
    if (valores.EMAIL_SMTP_TLS !== 'true') problema('EMAIL_SMTP_TLS', MOTIVO_EMAIL_SEM_TLS)
    if (enderecoDaNossaRede(`smtp://${valores.EMAIL_SMTP_HOST}`)) problema('EMAIL_SMTP_HOST', MOTIVO_EMAIL_NO_MAILPIT)
  })

export interface EmailConfig {
  readonly adaptador: EmailAdapterKind
  /** Só com `smtp`. */
  readonly smtp?: SmtpConfig
  /** O endereço público da web, sem barra no fim. */
  readonly urlDaWeb: string
  /** A chave AES-256 do token e do endereço cifrados na fila de envio. Nunca vai para log. */
  readonly chaveDoToken: Uint8Array
  /** O id do provedor que recebe o e-mail (`EMAIL_PROVEDOR_ID`); o do desenvolvimento não tem. */
  readonly provedorId?: string
}

export function loadEmailConfig(ambiente: Record<string, string | undefined>): EmailConfig {
  const valores = validateEnvironment(emailEnvSchema, ambiente)
  const chaveDoToken = new Uint8Array(hkdfSync('sha256', valores.EMAIL_TOKEN_KEY, new Uint8Array(0), ROTULO_DA_CHAVE_DO_TOKEN_DE_EMAIL, BYTES_DA_CHAVE_DO_TOKEN_DE_EMAIL))
  const base = {
    adaptador: valores.EMAIL_ADAPTADOR,
    urlDaWeb: valores.EMAIL_URL_DA_WEB.replace(/\/+$/, ''),
    chaveDoToken,
    ...(valores.EMAIL_PROVEDOR_ID === undefined ? {} : { provedorId: valores.EMAIL_PROVEDOR_ID }),
  }
  if (valores.EMAIL_ADAPTADOR !== 'smtp' || valores.EMAIL_SMTP_HOST === undefined) return base
  return {
    ...base,
    smtp: {
      host: valores.EMAIL_SMTP_HOST,
      porta: valores.EMAIL_SMTP_PORTA,
      tls: valores.EMAIL_SMTP_TLS === 'true',
      remetente: valores.EMAIL_REMETENTE,
      ...(valores.EMAIL_SMTP_USUARIO === undefined || valores.EMAIL_SMTP_SENHA === undefined ? {} : { usuario: valores.EMAIL_SMTP_USUARIO, senha: valores.EMAIL_SMTP_SENHA }),
    },
  }
}
