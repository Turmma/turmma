import nodemailer, { type Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'
import { EmailSendError, type EmailSender, type MensagemDeEmail } from './email-sender.js'

/** Quanto o envio espera o servidor, na conexão, na saudação, no soquete e no total (Tech Spec, seção 5: "timeout de 10 s"). */
export const PRAZO_DO_ENVIO_SMTP_MS = 10_000

export interface SmtpConfig {
  readonly host: string
  readonly porta: number
  /** TLS obrigatório: a porta 465 abre já cifrada, e as outras exigem o STARTTLS. */
  readonly tls: boolean
  readonly usuario?: string
  readonly senha?: string
  /** O endereço de quem manda, como o servidor o aceita. */
  readonly remetente: string
}

/**
 * As opções do transporte. **Sem `logger` e sem `debug`**: o nodemailer, ligado neles, escreve a conversa SMTP inteira, com o
 * endereço do destinatário, no log do processo (regra 20, item 9). Um teste confere a ausência das duas chaves.
 */
export function opcoesDoTransporte(config: SmtpConfig): SMTPTransport.Options {
  return {
    host: config.host,
    port: config.porta,
    secure: config.tls && config.porta === 465,
    requireTLS: config.tls,
    connectionTimeout: PRAZO_DO_ENVIO_SMTP_MS,
    greetingTimeout: PRAZO_DO_ENVIO_SMTP_MS,
    socketTimeout: PRAZO_DO_ENVIO_SMTP_MS,
    ...(config.usuario === undefined || config.senha === undefined ? {} : { auth: { user: config.usuario, pass: config.senha } }),
  }
}

/** A resposta do servidor com código 5xx recusa de vez; 4xx e a queda de conexão (sem código) valem uma nova tentativa. */
export function naturezaDaFalhaSmtp(erro: unknown): 'permanente' | 'transitoria' {
  const codigo = (erro as { responseCode?: unknown } | null | undefined)?.responseCode
  return typeof codigo === 'number' && codigo >= 500 && codigo < 600 ? 'permanente' : 'transitoria'
}

/** O adaptador SMTP, pelo `nodemailer` (padrão de mercado, D81). Fala com o provedor contratado e com o Mailpit do desenvolvimento. */
export class SmtpEmailSender implements EmailSender {
  readonly #remetente: string

  constructor(
    config: Pick<SmtpConfig, 'remetente'>,
    private readonly transporte: Pick<Transporter, 'sendMail'>,
    private readonly prazoMs = PRAZO_DO_ENVIO_SMTP_MS,
  ) {
    this.#remetente = config.remetente
  }

  static criar(config: SmtpConfig): SmtpEmailSender {
    return new SmtpEmailSender(config, nodemailer.createTransport(opcoesDoTransporte(config)))
  }

  async enviar(mensagem: MensagemDeEmail, sinal?: AbortSignal): Promise<void> {
    if (sinal?.aborted === true) throw new EmailSendError('transitoria')
    let prazo: NodeJS.Timeout | undefined
    let aoAbortar: (() => void) | undefined
    const corte = new Promise<never>((_, rejeitar) => {
      prazo = setTimeout(() => rejeitar(new EmailSendError('transitoria')), this.prazoMs)
      aoAbortar = () => rejeitar(new EmailSendError('transitoria'))
      sinal?.addEventListener('abort', aoAbortar, { once: true })
    })
    try {
      await Promise.race([this.transporte.sendMail({ from: this.#remetente, to: mensagem.para, subject: mensagem.assunto, text: mensagem.texto }), corte])
    } catch (erro) {
      // A mensagem do servidor leva o endereço do destinatário: nada dela sobe, só a natureza (o corte do prazo e do sinal não tem código: é transitório).
      throw new EmailSendError(naturezaDaFalhaSmtp(erro))
    } finally {
      clearTimeout(prazo)
      // O sinal é o do job e pode viver mais que o envio: o ouvinte que não disparou sai com ele, para não ficar um por e-mail.
      if (aoAbortar !== undefined) sinal?.removeEventListener('abort', aoAbortar)
    }
  }
}
