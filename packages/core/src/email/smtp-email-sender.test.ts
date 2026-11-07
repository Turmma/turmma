import { getEventListeners } from 'node:events'
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'
import { describe, expect, it, vi } from 'vitest'
import { EmailSendError } from './email-sender.js'
import { naturezaDaFalhaSmtp, opcoesDoTransporte, PRAZO_DO_ENVIO_SMTP_MS, SmtpEmailSender, type SmtpConfig } from './smtp-email-sender.js'

const CONFIG: SmtpConfig = { host: 'smtp.provedor.example', porta: 587, tls: true, usuario: 'conta', senha: 'senha-sintetica', remetente: 'Turmma <nao-responda@turmma.invalid>' }
const MENSAGEM = { para: 'professora@escola.invalid', assunto: 'Convite', texto: 'Link: https://app.example/convite#token-sintetico' }

/** A configuração sem um campo opcional (com `exactOptionalPropertyTypes`, `undefined` não é ausência). */
function semCampo(config: SmtpConfig, campo: 'usuario' | 'senha'): SmtpConfig {
  const { [campo]: _tirado, ...resto } = config
  return resto
}

/** O erro que o nodemailer devolve com o código da resposta do servidor, e com o endereço dentro da mensagem. */
const respostaDoServidor = (responseCode: number): Error & { responseCode: number } => Object.assign(new Error(`${String(responseCode)} <${MENSAGEM.para}>: recusado`), { responseCode })

async function recusa(promessa: Promise<unknown>): Promise<EmailSendError> {
  const erro = await promessa.then(
    () => undefined,
    (falha: unknown) => falha,
  )
  if (!(erro instanceof EmailSendError)) throw new Error('devia rejeitar com EmailSendError')
  return erro
}

describe('opcoesDoTransporte', () => {
  it('não liga logger nem debug: o nodemailer escreveria a conversa SMTP, com o endereço do destinatário, no log do processo', () => {
    for (const config of [CONFIG, { ...CONFIG, tls: false }, semCampo(semCampo(CONFIG, 'usuario'), 'senha')]) {
      const opcoes = opcoesDoTransporte(config)
      expect(Object.keys(opcoes)).not.toContain('logger')
      expect(Object.keys(opcoes)).not.toContain('debug')
    }
  })

  it('os três prazos do transporte são os 10 s do envio', () => {
    expect(PRAZO_DO_ENVIO_SMTP_MS).toBe(10_000)
    expect(opcoesDoTransporte(CONFIG)).toMatchObject({ connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000 })
  })

  it('com TLS: a porta 465 abre já cifrada e as outras exigem o STARTTLS; sem TLS, nenhum dos dois', () => {
    expect(opcoesDoTransporte({ ...CONFIG, porta: 465 })).toMatchObject({ secure: true, requireTLS: true })
    expect(opcoesDoTransporte({ ...CONFIG, porta: 587 })).toMatchObject({ secure: false, requireTLS: true })
    expect(opcoesDoTransporte({ ...CONFIG, porta: 1025, tls: false })).toMatchObject({ secure: false, requireTLS: false })
    expect(opcoesDoTransporte({ ...CONFIG, porta: 465, tls: false })).toMatchObject({ secure: false, requireTLS: false })
  })

  it('a credencial vai ao transporte só quando o usuário e a senha vêm juntos', () => {
    expect(opcoesDoTransporte(CONFIG)).toMatchObject({ auth: { user: 'conta', pass: 'senha-sintetica' } })
    expect(opcoesDoTransporte(semCampo(CONFIG, 'senha'))).not.toHaveProperty('auth')
    expect(opcoesDoTransporte(semCampo(CONFIG, 'usuario'))).not.toHaveProperty('auth')
  })
})

describe('naturezaDaFalhaSmtp', () => {
  it('a resposta 5xx recusa de vez; a 4xx, a queda de conexão e o erro sem código valem outra tentativa', () => {
    expect(naturezaDaFalhaSmtp(respostaDoServidor(550))).toBe('permanente')
    expect(naturezaDaFalhaSmtp(respostaDoServidor(599))).toBe('permanente')
    // Fora da faixa 5xx, ou com o código escrito como texto, não é uma recusa do servidor.
    expect(naturezaDaFalhaSmtp(respostaDoServidor(600))).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(Object.assign(new Error('recusado'), { responseCode: '550' }))).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(null)).toBe('transitoria')
    expect(naturezaDaFalhaSmtp('queda')).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(respostaDoServidor(500))).toBe('permanente')
    expect(naturezaDaFalhaSmtp(respostaDoServidor(599))).toBe('permanente')
    expect(naturezaDaFalhaSmtp(respostaDoServidor(421))).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(respostaDoServidor(451))).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(respostaDoServidor(499))).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(respostaDoServidor(600))).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(Object.assign(new Error('queda'), { code: 'ECONNECTION' }))).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(new Error('sem código'))).toBe('transitoria')
    expect(naturezaDaFalhaSmtp('texto')).toBe('transitoria')
    expect(naturezaDaFalhaSmtp(Object.assign(new Error('código em texto'), { responseCode: '550' }))).toBe('transitoria')
  })
})

describe('SmtpEmailSender', () => {
  it('entrega ao transporte o remetente da configuração, o destinatário, o assunto e o texto, e nada mais', async () => {
    const sendMail = vi.fn(() => Promise.resolve({} as SMTPTransport.SentMessageInfo))
    await new SmtpEmailSender(CONFIG, { sendMail }).enviar(MENSAGEM)
    expect(sendMail).toHaveBeenCalledExactlyOnceWith({ from: CONFIG.remetente, to: MENSAGEM.para, subject: MENSAGEM.assunto, text: MENSAGEM.texto })
  })

  it('a recusa 5xx sobe como falha permanente, e a 4xx como transitória, sem a mensagem do servidor nem o endereço', async () => {
    const com = (codigo: number) => new SmtpEmailSender(CONFIG, { sendMail: () => Promise.reject(respostaDoServidor(codigo)) }).enviar(MENSAGEM)
    const permanente = await recusa(com(550))
    expect(permanente.natureza).toBe('permanente')
    expect((await recusa(com(451))).natureza).toBe('transitoria')
    expect(permanente.message).not.toContain(MENSAGEM.para)
    expect(permanente.message).not.toContain('recusado')
    expect(permanente.cause).toBeUndefined()
  })

  it('o servidor que não responde em 10 s é falha transitória, e o prazo é a conta do envio, não só a do soquete', async () => {
    vi.useFakeTimers()
    try {
      const emissor = new SmtpEmailSender(CONFIG, { sendMail: () => new Promise(() => undefined) })
      const pendente = recusa(emissor.enviar(MENSAGEM))
      await vi.advanceTimersByTimeAsync(PRAZO_DO_ENVIO_SMTP_MS - 1)
      let terminou = false
      void pendente.then(() => {
        terminou = true
      })
      await vi.advanceTimersByTimeAsync(0)
      expect(terminou).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect((await pendente).natureza).toBe('transitoria')
    } finally {
      vi.useRealTimers()
    }
  })

  it('o envio que termina, bem ou mal, não deixa o relógio do prazo armado', async () => {
    vi.useFakeTimers()
    try {
      await new SmtpEmailSender(CONFIG, { sendMail: () => Promise.resolve({} as SMTPTransport.SentMessageInfo) }).enviar(MENSAGEM)
      expect(vi.getTimerCount()).toBe(0)
      await recusa(new SmtpEmailSender(CONFIG, { sendMail: () => Promise.reject(respostaDoServidor(550)) }).enviar(MENSAGEM))
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('o envio que termina sem o sinal disparar não deixa o ouvinte de `abort` no sinal do job, que vive mais que ele', async () => {
    const sinal = new AbortController().signal
    await new SmtpEmailSender(CONFIG, { sendMail: () => Promise.resolve({} as SMTPTransport.SentMessageInfo) }).enviar(MENSAGEM, sinal)
    expect(getEventListeners(sinal, 'abort')).toHaveLength(0)
    await recusa(new SmtpEmailSender(CONFIG, { sendMail: () => Promise.reject(respostaDoServidor(550)) }).enviar(MENSAGEM, sinal))
    expect(getEventListeners(sinal, 'abort')).toHaveLength(0)
  })

  it('o sinal abortado antes ou durante o envio é falha transitória, e o transporte nem é chamado quando já estava abortado', async () => {
    const sendMail = vi.fn(() => new Promise<never>(() => undefined))
    const emissor = new SmtpEmailSender(CONFIG, { sendMail })
    const jaAbortado = new AbortController()
    jaAbortado.abort()
    expect((await recusa(emissor.enviar(MENSAGEM, jaAbortado.signal))).natureza).toBe('transitoria')
    expect(sendMail).not.toHaveBeenCalled()

    const durante = new AbortController()
    const pendente = recusa(emissor.enviar(MENSAGEM, durante.signal))
    durante.abort()
    expect((await pendente).natureza).toBe('transitoria')
    expect(sendMail).toHaveBeenCalledOnce()
  })
})
