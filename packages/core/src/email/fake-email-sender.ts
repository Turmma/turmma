import { EmailSendError, type EmailSender, type MensagemDeEmail, type NaturezaDaFalhaDeEmail } from './email-sender.js'

/**
 * O adaptador falso (regra 40: o que está fora, e-mail, é o que se simula): guarda o que "enviou" para o teste ler e não
 * toca a rede. É o mesmo da API e do worker nos testes de integração.
 *
 * - **A barreira** (`segurarNoProximo`) prende a próxima chamada antes de ela terminar, para o teste cravar a corrida
 *   (a revogação com o envio no meio, as duas execuções ao mesmo tempo) sem sono: `chegou` resolve quando a chamada está presa, e
 *   `soltar` a deixa terminar.
 * - **A falha** (`falharProximos`) faz as próximas chamadas rejeitarem com a natureza pedida, na ordem, antes de qualquer envio.
 */
export class FakeEmailSender implements EmailSender {
  readonly #enviadas: MensagemDeEmail[] = []
  readonly #falhas: NaturezaDaFalhaDeEmail[] = []
  #barreira: { readonly chegou: () => void; readonly liberada: Promise<void> } | undefined
  #tentativas = 0

  /** As mensagens aceitas, na ordem. Uma presa na barreira ainda não está aqui. */
  get enviadas(): readonly MensagemDeEmail[] {
    return this.#enviadas
  }

  /** Quantas vezes `enviar` foi chamado, inclusive as que falharam e as presas. */
  get tentativas(): number {
    return this.#tentativas
  }

  falharProximos(...naturezas: readonly NaturezaDaFalhaDeEmail[]): void {
    this.#falhas.push(...naturezas)
  }

  /** Prende a próxima chamada. `chegou` resolve quando ela estiver presa; `soltar` a deixa terminar e aceitar a mensagem. */
  segurarNoProximo(): { readonly chegou: Promise<void>; readonly soltar: () => void } {
    let soltar: () => void = () => undefined
    let chegou: () => void = () => undefined
    const liberada = new Promise<void>((resolver) => {
      soltar = resolver
    })
    const presa = new Promise<void>((resolver) => {
      chegou = resolver
    })
    this.#barreira = { chegou, liberada }
    return { chegou: presa, soltar }
  }

  async enviar(mensagem: MensagemDeEmail, sinal?: AbortSignal): Promise<void> {
    this.#tentativas += 1
    const falha = this.#falhas.shift()
    if (falha !== undefined) throw new EmailSendError(falha)
    const barreira = this.#barreira
    this.#barreira = undefined
    if (barreira !== undefined) {
      barreira.chegou()
      await barreira.liberada
    }
    if (sinal?.aborted === true) throw new EmailSendError('transitoria')
    this.#enviadas.push(mensagem)
  }
}
