import {
  EmailSendError,
  mensagemDoConvite,
  METRICS,
  requireEscolaId,
  SecretDecryptionError,
  systemClock,
  VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL,
  type Clock,
  type EmailSender,
  type EnvioRepository,
  type LimiteDeEmail,
  type LoggerBase,
  type MensagemDeEmail,
  type Meter,
  type NaturezaDaFalhaDeEmail,
  type PontoDeEmail,
  type ReservaDoEnvio,
  type SecretCipher,
} from '@educa/core'
import { JobFailureCode, JOB_DEFINITIONS, TIPO_ENVIAR_CONVITE } from '@educa/shared'
import { JobAdiadoError, type MotivoDoAdiamento } from '../job-adiado.error.js'
import type { JobProcessor } from '../job-executor.js'
import { JobFailureError } from '../job-failure.error.js'

/** Quanto o job espera com o Redis de fila fora: sem o `msBeforeNext` do limite, vale esta espera (Tech Spec, seção 5, "E-mail"). */
export const ESPERA_COM_REDIS_FORA_MS = 30_000

/** Quantas vezes o job do convite tenta: no 4xx do servidor, a linha volta a `na_fila` até a última, que a grava `falhou`. */
export const TENTATIVAS_DO_ENVIO_DE_EMAIL = JOB_DEFINITIONS[TIPO_ENVIAR_CONVITE].retentativa.tentativas

/** A reserva que o `EnvioRepository` concedeu: o que o job precisa para montar a mensagem e a marca com que grava o desfecho. */
type ReservaReservada = Extract<ReservaDoEnvio, { resultado: 'reservado' }>

export interface EnviarEmailDependencies {
  envios: Pick<EnvioRepository, 'reservar' | 'concluir' | 'devolver'>
  emissor: EmailSender
  /** A cifra do token e do endereço na fila de envio (`EMAIL_TOKEN_KEY`). */
  cifra: Pick<SecretCipher, 'decifrar'>
  /** O `EMAIL_POR_MINUTO`: um ponto por tentativa de envio, gasto antes de reservar a linha. Sem ele (Redis fora), o job adia. */
  limite: LimiteDeEmail
  /** O endereço público da web, de onde sai o link. */
  urlDaWeb: string
  logger: LoggerBase
  /** O relógio da espera até o prazo de uma reserva alheia. Só o teste troca. */
  relogio?: Clock | undefined
  /** Sem medidor (os testes que não olham métrica), não mede nada. */
  medidor?: Meter | undefined
}

/** O que o envio usa do processador: o repositório da reserva, a porta, o log e o contador de resultado (que pode não existir). */
interface PecasDoEnvio {
  envios: Pick<EnvioRepository, 'concluir' | 'devolver'>
  emissor: EmailSender
  logger: LoggerBase
  porResultado: ReturnType<Meter['createCounter']> | undefined
}

/** A execução em curso: o convite, a tentativa e a marca da reserva com que o desfecho se grava. */
interface EnvioEmCurso {
  conviteId: string
  tentativa: number
  reserva: Date
}

/** O desfecho que se mede: o que a linha recebeu, ou `reserva_perdida` se a revogação ou outro processo ficou com ela enquanto o e-mail ia. */
const resultadoGravado = (gravou: boolean, resultado: 'enviado' | 'falhou'): 'enviado' | 'falhou' | 'reserva_perdida' => (gravou ? resultado : 'reserva_perdida')

/** O 5xx, ou o 4xx da última tentativa: `falhou`, sem nova tentativa. */
async function gravarFalhaDoEnvio({ envios, logger, porResultado }: PecasDoEnvio, { conviteId, tentativa, reserva }: EnvioEmCurso, tipo: NaturezaDaFalhaDeEmail): Promise<void> {
  const gravou = await envios.concluir(conviteId, reserva, 'falhou')
  porResultado?.add(1, { resultado: resultadoGravado(gravou, 'falhou') })
  logger.warn({ evento: 'email.convite_falhou', conviteId, tentativa, tipo, estado: gravou ? 'gravado' : 'reserva_perdida' })
}

/** Manda pela porta e grava o desfecho da reserva: `enviado`; `falhou` no 5xx e na última tentativa; no 4xx e na queda, devolve a linha e a fila repete. */
async function enviarEGravar(pecas: PecasDoEnvio, envio: EnvioEmCurso, mensagem: MensagemDeEmail, sinal: AbortSignal | undefined): Promise<void> {
  const { envios, emissor, logger, porResultado } = pecas
  const { conviteId, tentativa, reserva } = envio
  try {
    await emissor.enviar(mensagem, sinal)
  } catch (erro) {
    const tipo = erro instanceof EmailSendError ? erro.natureza : 'transitoria'
    if (tipo === 'permanente' || tentativa >= TENTATIVAS_DO_ENVIO_DE_EMAIL) return gravarFalhaDoEnvio(pecas, envio, tipo)
    await envios.devolver(conviteId, reserva)
    porResultado?.add(1, { resultado: 'nova_tentativa' })
    logger.warn({ evento: 'email.convite_repetira', conviteId, tentativa, tipo })
    throw new JobFailureError(JobFailureCode.ERRO_INTERNO)
  }
  const gravou = await envios.concluir(conviteId, reserva, 'enviado')
  porResultado?.add(1, { resultado: resultadoGravado(gravou, 'enviado') })
  logger.info({ evento: 'email.convite_enviado', conviteId, tentativa, estado: gravou ? 'gravado' : 'reserva_perdida' })
}

/**
 * `email.enviar-convite` (acesso-e-convites, tarefa 1.0; Tech Spec, seção 5, "E-mail"): no contexto da escola do registro do job,
 * reserva o convite **dessa escola** pelo id, decifra o token e o endereço, manda a mensagem pela porta `EmailSender`, fora de
 * qualquer transação, e grava o desfecho só se a linha ainda é dele.
 *
 * - **O job leva só o id do convite.** A escola é a do registro; o id de um convite de outra escola não é achado, e o job termina
 *   sem enviar nada, como o de um id que não existe (regra 10, itens 3 e 6).
 * - **Um e-mail por convite.** Quem reserva primeiro envia; o job repetido depois de `enviado`, `falhou` ou `cancelado` não faz nada.
 * - **Adiar não é falhar** (tarefa 2.0). Antes de reservar, o job gasta um ponto do `EMAIL_POR_MINUTO`; sem ponto, ou sem Redis de fila, ou
 *   com a reserva de outro processo ainda vigente, ele pede ao executor que o adie (`JobAdiadoError`): sem gastar tentativa nem uso, soltando
 *   a vaga da escola, e voltando depois do `msBeforeNext` (do prazo da reserva, ou 30 s com o Redis fora). Nunca envia sem contar.
 * - **O ponto de um envio que não aconteceu volta**: a reserva alheia, o envio já terminado, o convite que não é desta escola, a cifra que não
 *   decifra, o banco que falha na reserva. A tentativa que falou com o servidor (aceita, recusada ou caída) gastou o ponto, e ele não volta.
 * - **O desfecho é condicional à reserva** (`concluir`): a revogação, o refazer e a defesa do `desativar` gravam `cancelado` na hora,
 *   e o `enviado` que chega depois não casa. O link já saiu no e-mail, mas o aceite o recusa (o convite está revogado).
 * - **Servidor SMTP.** Recusa de vez (5xx): `falhou`, sem nova tentativa. Pedido de tentar depois (4xx) ou queda: a linha volta a
 *   `na_fila` e o job repete com o recuo da fila; na última tentativa, `falhou`.
 * - **Log**: ids, a tentativa e o motivo. Nunca o token, o endereço, o nome da escola nem a resposta do servidor (regra 20, item 9).
 */
export function criarEnvioDoConvite({ envios, emissor, cifra, limite, urlDaWeb, logger, relogio = systemClock, medidor }: EnviarEmailDependencies): JobProcessor<typeof TIPO_ENVIAR_CONVITE> {
  const porResultado = medidor?.createCounter(METRICS.emailPorResultado, { description: 'Execuções do job de e-mail do convite, por resultado' })
  const adiados = medidor?.createCounter(METRICS.emailAdiado, { description: 'Jobs de e-mail adiados sem gastar tentativa, por motivo' })

  /** Adia o job: conta, registra o motivo (nunca o erro do Redis) e pede ao executor a espera. */
  function adiar(conviteId: string, tentativa: number, baseMs: number, tipo: MotivoDoAdiamento): never {
    adiados?.add(1, { motivo: tipo })
    logger.info({ evento: 'email.convite_adiado', conviteId, tentativa, tipo })
    throw new JobAdiadoError(baseMs, tipo)
  }

  /** O envio não aconteceu: o ponto volta se o minuto ainda é o dele. A falha em devolver não esconde o desfecho do job: o ponto se perde e o minuto vira. */
  async function devolverPonto(ponto: PontoDeEmail): Promise<void> {
    await limite.devolver(ponto).catch(() => false)
  }

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
      porResultado?.add(1, { resultado: 'falhou' })
      logger.error({ evento: 'email.convite_nao_decifra', conviteId, tentativa })
      return undefined
    }
  }

  /** Gasta um ponto do `EMAIL_POR_MINUTO` antes de tocar na linha: sem ponto, ou sem Redis, adia. Nunca envia sem contar. */
  async function gastarPonto(conviteId: string, tentativa: number): Promise<PontoDeEmail> {
    const consumo = await limite.consumir('convite').catch(() => undefined)
    if (consumo === undefined) adiar(conviteId, tentativa, ESPERA_COM_REDIS_FORA_MS, 'redis')
    if (consumo.resultado === 'sem_vaga') adiar(conviteId, tentativa, consumo.msBeforeNext, 'limite')
    return consumo.ponto
  }

  /**
   * Reserva a linha com o ponto na mão. Reserva alheia vigente: o ponto volta e o job adia até o prazo dela. Envio já terminado, ou convite que
   * não é desta escola: o ponto volta e o job termina. Falha do banco: o ponto volta e o erro sobe.
   */
  async function reservarComPonto(conviteId: string, tentativa: number, ponto: PontoDeEmail): Promise<ReservaDoEnvio> {
    let reservado: ReservaDoEnvio
    try {
      reservado = await envios.reservar(conviteId)
    } catch (erro) {
      await devolverPonto(ponto)
      throw erro
    }
    if (reservado.resultado === 'reservado') return reservado
    await devolverPonto(ponto)
    if (reservado.resultado === 'reserva_alheia') adiar(conviteId, tentativa, Math.max(0, reservado.ate.getTime() - relogio.agora().getTime()), 'reserva_alheia')
    porResultado?.add(1, { resultado: 'ignorado' })
    const estado = reservado.resultado
    logger.info({ evento: 'email.convite_nao_enviado', conviteId, tentativa, estado })
    return reservado
  }

  return async ({ conviteId }, execucao, sinal) => {
    requireEscolaId()
    const { tentativa } = execucao
    const ponto = await gastarPonto(conviteId, tentativa)
    const reservado = await reservarComPonto(conviteId, tentativa, ponto)
    if (reservado.resultado !== 'reservado') return
    const mensagem = await montarMensagem(conviteId, tentativa, reservado)
    if (mensagem === undefined) {
      await devolverPonto(ponto)
      return
    }
    await enviarEGravar({ envios, emissor, logger, porResultado }, { conviteId, tentativa, reserva: reservado.reserva }, mensagem, sinal)
  }
}
