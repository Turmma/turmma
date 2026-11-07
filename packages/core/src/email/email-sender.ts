/**
 * A porta do e-mail (acesso-e-convites, Tech Spec, seção 5 "E-mail"; D81): o resto do sistema manda uma mensagem por ela e
 * não sabe se do outro lado há um servidor SMTP, o Mailpit do desenvolvimento ou o falso do teste.
 */

/** O que sai: um destinatário, um assunto e o texto. Sem HTML: o link do convite precisa chegar igual em qualquer leitor. */
export interface MensagemDeEmail {
  readonly para: string
  readonly assunto: string
  readonly texto: string
}

export interface EmailSender {
  /**
   * Entrega a mensagem ao servidor de saída e resolve quando ele a aceitou. Rejeita com `EmailSendError`, sempre: o motivo, o
   * endereço e a resposta do servidor ficam de fora do erro (regra 20, item 9). O `sinal` aborta a espera, e o abortado conta
   * como falha transitória.
   */
  enviar(mensagem: MensagemDeEmail, sinal?: AbortSignal): Promise<void>
}

/**
 * `permanente`: o servidor recusou de vez (resposta 5xx), repetir não muda nada. `transitoria`: o servidor pediu para tentar
 * depois (4xx), a conexão caiu ou o prazo estourou, e a fila repete.
 */
export type NaturezaDaFalhaDeEmail = 'permanente' | 'transitoria'

/** Falha do envio, só com a natureza. A mensagem é fixa: a do servidor leva o endereço do destinatário. */
export class EmailSendError extends Error {
  constructor(readonly natureza: NaturezaDaFalhaDeEmail) {
    super(`falha ${natureza} no envio de e-mail`)
    this.name = 'EmailSendError'
  }
}
