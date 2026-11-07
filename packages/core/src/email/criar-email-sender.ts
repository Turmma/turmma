import type { EmailConfig } from './email-config.js'
import type { EmailSender } from './email-sender.js'
import { FakeEmailSender } from './fake-email-sender.js'
import { SmtpEmailSender } from './smtp-email-sender.js'

/** O adaptador que a configuração escolheu: o SMTP, ou o falso do teste (a partida já recusou o falso em produção). */
export function criarEmailSender(config: EmailConfig): EmailSender {
  return config.adaptador === 'smtp' && config.smtp !== undefined ? SmtpEmailSender.criar(config.smtp) : new FakeEmailSender()
}
