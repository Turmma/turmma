import {
  EmailSendError,
  mensagemDoConvite,
  requireEscolaId,
  SecretDecryptionError,
  VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL,
  type EmailSender,
  type EnvioRepository,
  type LoggerBase,
  type MensagemDeEmail,
  type ReservaDoEnvio,
  type SecretCipher,
} from '@educa/core'
import { JobFailureCode, JOB_DEFINITIONS, TIPO_ENVIAR_CONVITE } from '@educa/shared'
import type { JobProcessor } from '../job-executor.js'
import { JobFailureError } from '../job-failure.error.js'

/** Quantas vezes o job do convite tenta: no 4xx do servidor, a linha volta a `na_fila` até a última, que a grava `falhou`. */
export const TENTATIVAS_DO_ENVIO_DE_EMAIL = JOB_DEFINITIONS[TIPO_ENVIAR_CONVITE].retentativa.tentativas

/** A reserva que o `EnvioRepository` concedeu: o que o job precisa para montar a mensagem e a marca com que grava o desfecho. */
type ReservaReservada = Extract<ReservaDoEnvio, { resultado: 'reservado' }>

export interface EnviarEmailDependencies {
  envios: Pick<EnvioRepository, 'reservar' | 'concluir' | 'devolver'>
  emissor: EmailSender
  /** A cifra do token e do endereço na fila de envio (`EMAIL_TOKEN_KEY`). */
  cifra: Pick<SecretCipher, 'decifrar'>
  /** O endereço público da web, de onde sai o link. */
  urlDaWeb: string
  logger: LoggerBase
}

/**
 * `email.enviar-convite` (acesso-e-convites, tarefa 1.0; Tech Spec, seção 5, "E-mail"): no contexto da escola do registro do job,
 * reserva o convite **dessa escola** pelo id, decifra o token e o endereço, manda a mensagem pela porta `EmailSender`, fora de
 * qualquer transação, e grava o desfecho só se a linha ainda é dele.
 *
 * - **O job leva só o id do convite.** A escola é a do registro; o id de um convite de outra escola não é achado, e o job termina
 *   sem enviar nada, como o de um id que não existe (regra 10, itens 3 e 6).
 * - **Um e-mail por convite.** Quem reserva primeiro envia; o job repetido depois de `enviado`, `falhou` ou `cancelado` não faz nada. Reserva
 *   alheia ainda vigente: o job repete (a saída de adiar, sem gastar tentativa, é da 2.0).
 * - **O desfecho é condicional à reserva** (`concluir`): a revogação, o refazer e a defesa do `desativar` gravam `cancelado` na hora,
 *   e o `enviado` que chega depois não casa. O link já saiu no e-mail, mas o aceite o recusa (o convite está revogado).
 * - **Servidor SMTP.** Recusa de vez (5xx): `falhou`, sem nova tentativa. Pedido de tentar depois (4xx) ou queda: a linha volta a
 *   `na_fila` e o job repete com o recuo da fila; na última tentativa, `falhou`.
 * - **Log**: ids, a tentativa e o motivo. Nunca o token, o endereço, o nome da escola nem a resposta do servidor (regra 20, item 9).
 */
export function criarEnvioDoConvite({ envios, emissor, cifra, urlDaWeb, logger }: EnviarEmailDependencies): JobProcessor<typeof TIPO_ENVIAR_CONVITE> {
  /** A mensagem do convite, com o token e o endereço decifrados; ou `undefined`, com o envio já gravado `falhou`, se eles não decifram. */
  async function montarMensagem(conviteId: string, tentativa: number, reservado: ReservaReservada): Promise<MensagemDeEmail | undefined> {
    try {
      // O id do convite é o dado autenticado: o cifrado copiado de outra linha não decifra aqui.
      const abrir = (cifrado: Buffer): string => Buffer.from(cifra.decifrar({ cifrado, versao: VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL }, conviteId)).toString('utf8')
      const token = abrir(reservado.tokenCifrado)
      const para = abrir(reservado.destinoCifrado)
      return mensagemDoConvite({ escola: reservado.escola, urlDaWeb, para, token })
    } catch (erro) {
      if (!(erro instanceof SecretDecryptionError)) throw erro
      // Chave trocada ou linha adulterada: repetir não decifra. O envio termina `falhou`, e a coordenação o reenvia.
      await envios.concluir(conviteId, reservado.reserva, 'falhou')
      logger.error({ evento: 'email.convite_nao_decifra', conviteId, tentativa })
      return undefined
    }
  }

  return async ({ conviteId }, execucao, sinal) => {
    requireEscolaId()
    const { tentativa } = execucao
    const reservado = await envios.reservar(conviteId)
    if (reservado.resultado === 'reserva_alheia') {
      logger.info({ evento: 'email.convite_reserva_alheia', conviteId, tentativa })
      throw new JobFailureError(JobFailureCode.ERRO_INTERNO)
    }
    if (reservado.resultado !== 'reservado') {
      const estado = reservado.resultado
      logger.info({ evento: 'email.convite_nao_enviado', conviteId, tentativa, estado })
      return
    }
    const mensagem = await montarMensagem(conviteId, tentativa, reservado)
    if (mensagem === undefined) return
    const { reserva } = reservado
    try {
      await emissor.enviar(mensagem, sinal)
    } catch (erro) {
      const tipo = erro instanceof EmailSendError ? erro.natureza : 'transitoria'
      if (tipo === 'transitoria' && tentativa < TENTATIVAS_DO_ENVIO_DE_EMAIL) {
        await envios.devolver(conviteId, reserva)
        logger.warn({ evento: 'email.convite_repetira', conviteId, tentativa, tipo })
        throw new JobFailureError(JobFailureCode.ERRO_INTERNO)
      }
      const gravou = await envios.concluir(conviteId, reserva, 'falhou')
      logger.warn({ evento: 'email.convite_falhou', conviteId, tentativa, tipo, estado: gravou ? 'gravado' : 'reserva_perdida' })
      return
    }
    const gravou = await envios.concluir(conviteId, reserva, 'enviado')
    logger.info({ evento: 'email.convite_enviado', conviteId, tentativa, estado: gravou ? 'gravado' : 'reserva_perdida' })
  }
}
