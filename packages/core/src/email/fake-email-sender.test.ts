import { describe, expect, it } from 'vitest'
import { EmailSendError } from './email-sender.js'
import { FakeEmailSender } from './fake-email-sender.js'

const MENSAGEM = { para: 'professora@escola.invalid', assunto: 'Convite', texto: 'corpo' }

describe('FakeEmailSender', () => {
  it('guarda o que aceitou, na ordem, e conta as tentativas', async () => {
    const falso = new FakeEmailSender()
    await falso.enviar(MENSAGEM)
    await falso.enviar({ ...MENSAGEM, assunto: 'Outro' })
    expect(falso.enviadas.map((mensagem) => mensagem.assunto)).toEqual(['Convite', 'Outro'])
    expect(falso.tentativas).toBe(2)
  })

  it('a falha programada rejeita com a natureza pedida, na ordem, sem guardar a mensagem, e depois volta a aceitar', async () => {
    const falso = new FakeEmailSender()
    falso.falharProximos('transitoria', 'permanente')
    await expect(falso.enviar(MENSAGEM)).rejects.toMatchObject({ natureza: 'transitoria' })
    await expect(falso.enviar(MENSAGEM)).rejects.toBeInstanceOf(EmailSendError)
    expect(falso.enviadas).toEqual([])
    await falso.enviar(MENSAGEM)
    expect(falso.enviadas).toHaveLength(1)
    expect(falso.tentativas).toBe(3)
  })

  it('a barreira prende a próxima chamada antes de ela aceitar a mensagem, e só a próxima', async () => {
    const falso = new FakeEmailSender()
    const barreira = falso.segurarNoProximo()
    const presa = falso.enviar(MENSAGEM)
    await barreira.chegou
    expect(falso.tentativas).toBe(1)
    expect(falso.enviadas).toEqual([])
    await falso.enviar({ ...MENSAGEM, assunto: 'livre' })
    expect(falso.enviadas.map((mensagem) => mensagem.assunto)).toEqual(['livre'])
    barreira.soltar()
    await presa
    expect(falso.enviadas.map((mensagem) => mensagem.assunto)).toEqual(['livre', 'Convite'])
  })

  it('o sinal abortado enquanto a chamada está presa a faz rejeitar, e a mensagem não é guardada', async () => {
    const falso = new FakeEmailSender()
    const barreira = falso.segurarNoProximo()
    const aborto = new AbortController()
    const presa = falso.enviar(MENSAGEM, aborto.signal)
    await barreira.chegou
    aborto.abort()
    barreira.soltar()
    await expect(presa).rejects.toMatchObject({ natureza: 'transitoria' })
    expect(falso.enviadas).toEqual([])
  })
})
