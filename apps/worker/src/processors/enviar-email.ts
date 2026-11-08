import {
  EmailSendError,
  mensagemDoConvite,
  mensagemDoLinkDaConta,
  METRICS,
  requireEscolaId,
  SecretDecryptionError,
  systemClock,
  VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL,
  type ClasseDoEmail,
  type Clock,
  type Database,
  type EmailSender,
  type LimiteDeEmail,
  type LoggerBase,
  type MensagemDeEmail,
  type Meter,
  type NaturezaDaFalhaDeEmail,
  type PontoDeEmail,
  type SecretCipher,
} from '@educa/core'
import { EnvioRepository, type ReservaDoEnvio, type ReservaDoLink } from '@educa/core/envio'
import { JobFailureCode, JOB_DEFINITIONS, TIPO_ENVIAR_CONVITE, TIPO_ENVIAR_EMAIL_DA_CONTA } from '@educa/shared'
import { JobAdiadoError, type MotivoDoAdiamento } from '../job-adiado.error.js'
import type { JobProcessor } from '../job-executor.js'
import { JobFailureError } from '../job-failure.error.js'

/** Quanto o job espera com o Redis de fila fora: sem o `msBeforeNext` do limite, vale esta espera (Tech Spec, seção 5, "E-mail"). */
export const ESPERA_COM_REDIS_FORA_MS = 30_000

/** Quantas vezes o job do convite tenta: no 4xx do servidor, a linha volta a `na_fila` até a última, que a grava `falhou`. */
export const TENTATIVAS_DO_ENVIO_DE_EMAIL = JOB_DEFINITIONS[TIPO_ENVIAR_CONVITE].retentativa.tentativas
/** E as do job do link da conta, lidas da definição dele: se as duas divergirem, cada job usa a sua. */
export const TENTATIVAS_DO_ENVIO_DO_LINK_DA_CONTA = JOB_DEFINITIONS[TIPO_ENVIAR_EMAIL_DA_CONTA].retentativa.tentativas

/** O repositório do envio, criado aqui e não na composição: este arquivo é o único do worker que o conhece (a regra `cerca-envio`, Tech Spec, seção 6). */
export function criarEnvios(banco: Database): EnvioRepository {
  return new EnvioRepository(banco)
}

/** O que o processador usa do repositório do envio; a composição o carrega sem nomear a classe. */
export type EnviosDoEmail = EnvioRepository

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

/** As dependências do e-mail da conta: as mesmas, com a reserva e o desfecho do link no lugar dos do convite. */
export interface EnviarEmailDaContaDependencies extends Omit<EnviarEmailDependencies, 'envios'> {
  envios: Pick<EnvioRepository, 'reservarLink' | 'concluirLink' | 'devolverLink'>
}

/** A linha que a reserva concedeu: o que o job precisa para montar a mensagem e a marca com que grava o desfecho. */
interface Reservada {
  readonly resultado: 'reservado'
  readonly reserva: Date
  readonly tokenCifrado: Buffer
  readonly destinoCifrado: Buffer
}

/** As outras três respostas da reserva, iguais para o convite e para o link da conta. */
type SemReserva = { readonly resultado: 'reserva_alheia'; readonly ate: Date } | { readonly resultado: 'encerrado' } | { readonly resultado: 'inexistente' }

/**
 * O que muda entre o e-mail do convite e o do link da conta (Tech Spec, seção 5, "E-mail"): onde a linha mora e como se reserva, quem gasta no
 * `EMAIL_POR_MINUTO`, como a mensagem se monta e o nome do evento de log. Todo o resto, o ponto, a reserva, o envio fora de transação e o desfecho
 * sob a marca da reserva, é o mesmo código.
 */
interface Destino<Lida extends Reservada> {
  readonly classe: ClasseDoEmail
  /** Quantas vezes o job do destino tenta (a `retentativa` da definição dele): na última, o 4xx também grava `falhou`. */
  readonly tentativas: number
  /** O log do destino: um evento fixo por acontecimento, com o id da linha e nunca token, endereço nem resposta do servidor (regra 20, item 9). */
  readonly rastro: Rastro
  reservar(id: string): Promise<Lida | SemReserva>
  concluir(id: string, reserva: Date, desfecho: 'enviado' | 'falhou'): Promise<boolean>
  devolver(id: string, reserva: Date): Promise<boolean>
  mensagem(linha: Lida, token: string, para: string): MensagemDeEmail
}

/** Os acontecimentos que o processador registra, cada um com o evento fixo do destino: o log não leva nome de evento montado em tempo de execução. */
interface Rastro {
  adiado(id: string, tentativa: number, tipo: MotivoDoAdiamento): void
  naoDecifra(id: string, tentativa: number): void
  naoEnviado(id: string, tentativa: number, estado: string): void
  falhou(id: string, tentativa: number, tipo: NaturezaDaFalhaDeEmail, estado: string): void
  repetira(id: string, tentativa: number, tipo: NaturezaDaFalhaDeEmail): void
  enviado(id: string, tentativa: number, estado: string): void
}

/** O rastro do convite: os eventos `email.convite_*` do runbook. */
const rastroDoConvite = (logger: LoggerBase): Rastro => ({
  adiado: (conviteId, tentativa, tipo) => logger.info({ evento: 'email.convite_adiado', conviteId, tentativa, tipo }),
  naoDecifra: (conviteId, tentativa) => logger.error({ evento: 'email.convite_nao_decifra', conviteId, tentativa }),
  naoEnviado: (conviteId, tentativa, estado) => logger.info({ evento: 'email.convite_nao_enviado', conviteId, tentativa, estado }),
  falhou: (conviteId, tentativa, tipo, estado) => logger.warn({ evento: 'email.convite_falhou', conviteId, tentativa, tipo, estado }),
  repetira: (conviteId, tentativa, tipo) => logger.warn({ evento: 'email.convite_repetira', conviteId, tentativa, tipo }),
  enviado: (conviteId, tentativa, estado) => logger.info({ evento: 'email.convite_enviado', conviteId, tentativa, estado }),
})

/** O rastro do link da conta: os mesmos acontecimentos, em `email.link_da_conta_*`, com o `linkId`. */
const rastroDoLink = (logger: LoggerBase): Rastro => ({
  adiado: (linkId, tentativa, tipo) => logger.info({ evento: 'email.link_da_conta_adiado', linkId, tentativa, tipo }),
  naoDecifra: (linkId, tentativa) => logger.error({ evento: 'email.link_da_conta_nao_decifra', linkId, tentativa }),
  naoEnviado: (linkId, tentativa, estado) => logger.info({ evento: 'email.link_da_conta_nao_enviado', linkId, tentativa, estado }),
  falhou: (linkId, tentativa, tipo, estado) => logger.warn({ evento: 'email.link_da_conta_falhou', linkId, tentativa, tipo, estado }),
  repetira: (linkId, tentativa, tipo) => logger.warn({ evento: 'email.link_da_conta_repetira', linkId, tentativa, tipo }),
  enviado: (linkId, tentativa, estado) => logger.info({ evento: 'email.link_da_conta_enviado', linkId, tentativa, estado }),
})

/** Tudo que o processador usa além do destino. */
type Pecas = Omit<EnviarEmailDependencies, 'envios' | 'logger' | 'urlDaWeb'>

/** O desfecho que se mede: o que a linha recebeu, ou `reserva_perdida` se o cancelamento ou outro processo ficou com ela enquanto o e-mail ia. */
const resultadoGravado = (gravou: boolean, resultado: 'enviado' | 'falhou'): 'enviado' | 'falhou' | 'reserva_perdida' => (gravou ? resultado : 'reserva_perdida')

/**
 * O processador do e-mail, para o destino dado: no contexto do job, reserva a linha pelo id, decifra o token e o endereço, manda a mensagem
 * pela porta `EmailSender`, fora de qualquer transação, e grava o desfecho só se a linha ainda é dele. Veja `criarEnvioDoConvite` e
 * `criarEnvioDoLinkDaConta` para o que cada job promete.
 */
function criarProcessador<Lida extends Reservada>(destino: Destino<Lida>, { emissor, cifra, limite, relogio = systemClock, medidor }: Pecas): (id: string, tentativa: number, sinal: AbortSignal | undefined) => Promise<void> {
  const porResultado = medidor?.createCounter(METRICS.emailPorResultado, { description: 'Execuções dos jobs de e-mail (o do convite e o do link da conta), por resultado' })
  const adiados = medidor?.createCounter(METRICS.emailAdiado, { description: 'Jobs de e-mail adiados sem gastar tentativa, por motivo' })
  const { classe, rastro } = destino

  /** Adia o job: conta, registra o motivo (nunca o erro do Redis) e pede ao executor a espera. */
  function adiar(id: string, tentativa: number, baseMs: number, tipo: MotivoDoAdiamento): never {
    adiados?.add(1, { motivo: tipo })
    rastro.adiado(id, tentativa, tipo)
    throw new JobAdiadoError(baseMs, tipo)
  }

  /** O envio não aconteceu: o ponto volta se o minuto ainda é o dele. A falha em devolver não esconde o desfecho do job: o ponto se perde e o minuto vira. */
  async function devolverPonto(ponto: PontoDeEmail): Promise<void> {
    await limite.devolver(ponto).catch(() => false)
  }

  /** A mensagem, com o token e o endereço decifrados; ou `undefined`, com o envio já gravado `falhou`, se eles não decifram. */
  async function montarMensagem(id: string, tentativa: number, linha: Lida): Promise<MensagemDeEmail | undefined> {
    try {
      // O id da linha é o dado autenticado: o cifrado copiado de outra linha não decifra aqui.
      const abrir = (cifrado: Buffer): string => Buffer.from(cifra.decifrar({ cifrado, versao: VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL }, id)).toString('utf8')
      const token = abrir(linha.tokenCifrado)
      const para = abrir(linha.destinoCifrado)
      return destino.mensagem(linha, token, para)
    } catch (erro) {
      if (!(erro instanceof SecretDecryptionError)) throw erro
      // Chave trocada ou linha adulterada: repetir não decifra. O envio termina `falhou`, e a pessoa pede outro.
      await destino.concluir(id, linha.reserva, 'falhou')
      porResultado?.add(1, { resultado: 'falhou' })
      rastro.naoDecifra(id, tentativa)
      return undefined
    }
  }

  /** Gasta um ponto do `EMAIL_POR_MINUTO` antes de tocar na linha: sem ponto, ou sem Redis, adia. Nunca envia sem contar. */
  async function gastarPonto(id: string, tentativa: number): Promise<PontoDeEmail> {
    const consumo = await limite.consumir(classe).catch(() => undefined)
    if (consumo === undefined) adiar(id, tentativa, ESPERA_COM_REDIS_FORA_MS, 'redis')
    if (consumo.resultado === 'sem_vaga') adiar(id, tentativa, consumo.msBeforeNext, 'limite')
    return consumo.ponto
  }

  /**
   * Reserva a linha com o ponto na mão. Reserva alheia vigente: o ponto volta e o job adia até o prazo dela. Envio já terminado, ou linha que não é
   * deste job: o ponto volta e o job termina. Falha do banco: o ponto volta e o erro sobe.
   */
  async function reservarComPonto(id: string, tentativa: number, ponto: PontoDeEmail): Promise<Lida | undefined> {
    let reservado: Lida | SemReserva
    try {
      reservado = await destino.reservar(id)
    } catch (erro) {
      await devolverPonto(ponto)
      throw erro
    }
    if (reservado.resultado === 'reservado') return reservado
    await devolverPonto(ponto)
    if (reservado.resultado === 'reserva_alheia') adiar(id, tentativa, Math.max(0, reservado.ate.getTime() - relogio.agora().getTime()), 'reserva_alheia')
    porResultado?.add(1, { resultado: 'ignorado' })
    rastro.naoEnviado(id, tentativa, reservado.resultado)
    return undefined
  }

  /** O 5xx, ou o 4xx da última tentativa: `falhou`, sem nova tentativa. */
  async function gravarFalha(id: string, tentativa: number, reserva: Date, tipo: NaturezaDaFalhaDeEmail): Promise<void> {
    const gravou = await destino.concluir(id, reserva, 'falhou')
    porResultado?.add(1, { resultado: resultadoGravado(gravou, 'falhou') })
    rastro.falhou(id, tentativa, tipo, gravou ? 'gravado' : 'reserva_perdida')
  }

  /** Manda pela porta e grava o desfecho da reserva: `enviado`; `falhou` no 5xx e na última tentativa; no 4xx e na queda, devolve a linha e a fila repete. */
  async function enviarEGravar(id: string, tentativa: number, reserva: Date, mensagem: MensagemDeEmail, sinal: AbortSignal | undefined): Promise<void> {
    try {
      await emissor.enviar(mensagem, sinal)
    } catch (erro) {
      const tipo = erro instanceof EmailSendError ? erro.natureza : 'transitoria'
      if (tipo === 'permanente' || tentativa >= destino.tentativas) return gravarFalha(id, tentativa, reserva, tipo)
      await destino.devolver(id, reserva)
      porResultado?.add(1, { resultado: 'nova_tentativa' })
      rastro.repetira(id, tentativa, tipo)
      throw new JobFailureError(JobFailureCode.ERRO_INTERNO)
    }
    const gravou = await destino.concluir(id, reserva, 'enviado')
    porResultado?.add(1, { resultado: resultadoGravado(gravou, 'enviado') })
    rastro.enviado(id, tentativa, gravou ? 'gravado' : 'reserva_perdida')
  }

  return async (id, tentativa, sinal) => {
    const ponto = await gastarPonto(id, tentativa)
    const reservado = await reservarComPonto(id, tentativa, ponto)
    if (reservado === undefined) return
    const mensagem = await montarMensagem(id, tentativa, reservado)
    if (mensagem === undefined) {
      await devolverPonto(ponto)
      return
    }
    await enviarEGravar(id, tentativa, reservado.reserva, mensagem, sinal)
  }
}

/** O convite: lê a linha pela escola do contexto do job. */
type ConviteReservado = Extract<ReservaDoEnvio, { resultado: 'reservado' }>

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
export function criarEnvioDoConvite({ envios, logger, urlDaWeb, ...pecas }: EnviarEmailDependencies): JobProcessor<typeof TIPO_ENVIAR_CONVITE> {
  const processar = criarProcessador<ConviteReservado>(
    {
      classe: 'convite',
      tentativas: TENTATIVAS_DO_ENVIO_DE_EMAIL,
      rastro: rastroDoConvite(logger),
      reservar: (id) => envios.reservar(id),
      concluir: (id, reserva, desfecho) => envios.concluir(id, reserva, desfecho),
      devolver: (id, reserva) => envios.devolver(id, reserva),
      mensagem: (linha, token, para) => mensagemDoConvite({ escola: linha.escola, urlDaWeb, para, token }),
    },
    pecas,
  )
  return async ({ conviteId }, execucao, sinal) => {
    requireEscolaId()
    await processar(conviteId, execucao.tentativa, sinal)
  }
}

type LinkReservado = Extract<ReservaDoLink, { resultado: 'reservado' }>

/**
 * `sistema.enviar-email-da-conta` (acesso-e-convites, tarefa 5.0; Tech Spec, seções 5 e 6): o e-mail do link da conta, o do "esqueci a senha". É um job
 * de sistema, **sem escola** (a conta é global): lê e grava o `link_da_conta` só pelo id do job, no `EnvioRepository`, e ocupa a `vaga:normal:sistema`.
 * Como o do convite, gasta um ponto do `EMAIL_POR_MINUTO` antes de reservar, mas da metade que o convite não alcança (`classe: 'conta'`): o link sai
 * no minuto mesmo com os convites enchendo a deles. Reserva, envio fora da transação, adiamento sem gastar tentativa, 4xx e 5xx são os do convite, e o
 * desfecho é condicional à reserva: o "esqueci" seguinte grava `cancelado` na hora, e o `enviado` do link antigo não casa.
 *
 * Log: o id do link e a tentativa. Nunca o token, o endereço nem a resposta do servidor.
 */
export function criarEnvioDoLinkDaConta({ envios, logger, urlDaWeb, ...pecas }: EnviarEmailDaContaDependencies): JobProcessor<typeof TIPO_ENVIAR_EMAIL_DA_CONTA> {
  const processar = criarProcessador<LinkReservado>(
    {
      classe: 'conta',
      tentativas: TENTATIVAS_DO_ENVIO_DO_LINK_DA_CONTA,
      rastro: rastroDoLink(logger),
      reservar: (id) => envios.reservarLink(id),
      concluir: (id, reserva, desfecho) => envios.concluirLink(id, reserva, desfecho),
      devolver: (id, reserva) => envios.devolverLink(id, reserva),
      mensagem: (linha, token, para) => mensagemDoLinkDaConta({ finalidade: linha.finalidade, urlDaWeb, para, token }),
    },
    pecas,
  )
  return async ({ linkId }, execucao, sinal) => {
    await processar(linkId, execucao.tentativa, sinal)
  }
}
