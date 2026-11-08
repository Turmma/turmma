import type { FinalidadeDoLinkDaConta } from '../db/schema/link-da-conta.js'
import type { MensagemDeEmail } from './email-sender.js'

export interface DadosDaMensagemDoLinkDaConta {
  readonly finalidade: FinalidadeDoLinkDaConta
  /** O endereço público da web, sem barra no fim. */
  readonly urlDaWeb: string
  /** O endereço de quem recebe. */
  readonly para: string
  /** O token do link, em claro: só existe aqui, na hora de montar o texto. */
  readonly token: string
}

/** Para onde a web leva cada finalidade (acesso-e-convites, telas 6.0 e 8.0). O token vai no fragmento, depois do `#`. */
const CAMINHO_POR_FINALIDADE: Readonly<Record<FinalidadeDoLinkDaConta, string>> = { redefinir: '/redefinir', verificar: '/verificar' }

/**
 * O e-mail do link da conta (RF12): o "esqueci a senha" (`redefinir`, vale 1 hora) e a verificação do e-mail (`verificar`, vale 24 horas).
 * A conta é global e a mensagem não diz escola, turma nem nome de ninguém: só o link. O token vai depois do `#`, como em todo link de
 * acesso: o navegador não o manda ao servidor.
 */
export function mensagemDoLinkDaConta({ finalidade, urlDaWeb, para, token }: DadosDaMensagemDoLinkDaConta): MensagemDeEmail {
  const link = `${urlDaWeb}${CAMINHO_POR_FINALIDADE[finalidade]}#${token}`
  if (finalidade === 'verificar') {
    return {
      para,
      assunto: 'Confirme o seu e-mail no Turmma',
      texto: [
        'Para confirmar o seu e-mail no Turmma, abra o link abaixo. Ele vale por 24 horas e só pode ser usado uma vez:',
        link,
        '',
        'Se você não pediu isto, ignore esta mensagem: nada acontece até alguém abrir o link.',
      ].join('\n'),
    }
  }
  return {
    para,
    assunto: 'Troque a sua senha do Turmma',
    texto: [
      'Recebemos um pedido para trocar a senha da sua conta no Turmma. Para escolher uma senha nova, abra o link abaixo. Ele vale por 1 hora e só pode ser usado uma vez:',
      link,
      '',
      'Se você não pediu isto, ignore esta mensagem: a sua senha continua a mesma até alguém abrir o link.',
    ].join('\n'),
  }
}
