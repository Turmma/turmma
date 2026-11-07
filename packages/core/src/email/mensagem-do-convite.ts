import type { MensagemDeEmail } from './email-sender.js'

export interface DadosDaMensagemDoConvite {
  /** O nome da escola que convida. */
  readonly escola: string
  /** O endereço público da web, sem barra no fim. */
  readonly urlDaWeb: string
  /** O endereço de quem recebe. */
  readonly para: string
  /** O token do convite, em claro: só existe aqui, na hora de montar o texto. */
  readonly token: string
}

/**
 * O e-mail do convite (RF11): a escola e o link, e mais nada. **Nunca nome de aluno, de turma ou de professor** (nem o de quem
 * recebe: o endereço basta), porque a mensagem sai da nossa rede para um provedor. O token vai depois do `#`, como em todo link
 * de convite: o navegador não o manda ao servidor.
 */
export function mensagemDoConvite({ escola, urlDaWeb, para, token }: DadosDaMensagemDoConvite): MensagemDeEmail {
  const link = `${urlDaWeb}/convite#${token}`
  return {
    para,
    assunto: `${escola} convidou você para o Turmma`,
    texto: [
      `A escola ${escola} convidou você para entrar no Turmma como professor.`,
      '',
      'Para aceitar, abra o link abaixo. Ele vale por 7 dias e só pode ser usado uma vez:',
      link,
      '',
      'Se você não esperava este convite, ignore esta mensagem: nada acontece até alguém abrir o link.',
    ].join('\n'),
  }
}
