import { describe, expect, it } from 'vitest'
import type { EmailConfig } from './email-config.js'
import { createEmailSender } from './criar-email-sender.js'
import { FakeEmailSender } from './fake-email-sender.js'
import { SmtpEmailSender } from './smtp-email-sender.js'

const base = { urlDaWeb: 'http://web.teste', chaveDoToken: new Uint8Array(32), porMinuto: 60 }
const smtp = { host: 'mailpit', porta: 1025, tls: false, remetente: 'Turmma <nao-responda@turmma.invalid>' }

describe('createEmailSender', () => {
  it('o adaptador `smtp` com o servidor configurado é o SMTP; o `falso` é o do teste, que nunca toca a rede', () => {
    expect(createEmailSender({ ...base, adaptador: 'smtp', smtp } satisfies EmailConfig)).toBeInstanceOf(SmtpEmailSender)
    expect(createEmailSender({ ...base, adaptador: 'falso' } satisfies EmailConfig)).toBeInstanceOf(FakeEmailSender)
  })

  it('o adaptador `falso` com um servidor na configuração continua o falso: quem manda é o adaptador, não a presença do host', () => {
    expect(createEmailSender({ ...base, adaptador: 'falso', smtp } satisfies EmailConfig)).toBeInstanceOf(FakeEmailSender)
  })
})
