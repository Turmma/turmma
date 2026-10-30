import { ErroDeDominio, limiteDoSeguro, segundosParaTentarDeNovo, sessaoDaRequisicao, type LoggerBase } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { Logger } from '@nestjs/common'
import type { ContadorEmJanela } from '../credencial/index.js'

/** A janela dos dois contadores: "por minuto". */
export const JANELA_DOS_PEDIDOS_DE_IA_MS = 60_000
/** Pedidos de IA que uma pessoa dispara por minuto (mensagem ao Assistente, gerar, adaptar) antes de esperar. */
export const TETO_DE_PEDIDOS_DE_IA_POR_USUARIO = 12
/** Pedidos de IA que uma escola inteira dispara por minuto. A execução em si ainda passa pelas vagas por escola do executor. */
export const TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA = 120

export const PREFIXO_PEDIDOS_DE_IA_POR_USUARIO = 'ia:pedidos-usuario'
export const PREFIXO_PEDIDOS_DE_IA_POR_ESCOLA = 'ia:pedidos-escola'

const loggerDeIa = new Logger('ia')

/** O aviso espaçado do contador contando no seguro em memória (Redis de fila fora). */
export const avisarSeguroDosPedidosDeIa = (): void => loggerDeIa.warn('ia.limite_de_pedidos_no_seguro')

export interface DependenciasDoLimiteDeIa {
  /** O contador em janela de um minuto, no Redis de fila, com a chave de HMAC dos contadores do login. */
  readonly janela: Pick<ContadorEmJanela, 'chaveDe' | 'somar' | 'restanteMs'>
  /** Quantas instâncias da API dividem os tetos quando a contagem cai no seguro em memória (`LIMITE_INSTANCIAS_API`). */
  readonly instancias: number
  /** O logger JSON do processo: a linha leva o tipo e os ids, que o `Logger` do Nest não carrega. */
  readonly logger: Pick<LoggerBase, 'warn'>
}

/** Qual dos dois tetos segurou o pedido. */
export type TipoDeLimiteDeIa = 'usuario' | 'escola'

/**
 * O limite dos `POST` que disparam IA (regra 80, itens 1 e 3): **por pessoa e por escola, nunca por IP**. A escola
 * inteira sai por um IP só, e um professor com o dedo no botão não pode gastar a vez dos outros nem encher a fila de
 * execuções da escola. É somado ao limite geral de requisições, que já conta toda rota por usuário e por escola.
 *
 * Cada pedido soma primeiro no contador da pessoa; só o que passa por ele soma no da escola: quem estourou o próprio
 * teto não gasta o da escola. A soma é atômica no Redis de fila (regra 80, itens 5 e 7), e a chave é o HMAC dos ids.
 * Com o Redis fora, cada instância conta em memória, com o teto dividido pelas instâncias: nunca libera sem limite.
 *
 * Acima do teto: `LIMITE_EXCEDIDO` (429) com o `Retry-After` do resto da janela, antes de gravar execução e de gastar
 * modelo. O reenvio com a mesma chave também conta: é uma requisição como as outras.
 *
 * O primeiro pedido que passa de cada teto, em cada janela, escreve a linha `ia.limite_de_pedidos_atingido` (regra 80,
 * item 10), com o tipo, a escola e a pessoa **por id**: nada do pedido, do tema nem da mensagem. Os seguintes da mesma
 * janela não repetem a linha: um script em laço não enche o log.
 */
export class LimiteDePedidosDeIa {
  constructor(private readonly dependencias: DependenciasDoLimiteDeIa) {}

  /** Conta o pedido da pessoa e da escola da sessão, e recusa o que passa do teto. */
  async contar(): Promise<void> {
    const { escolaId, usuarioId } = sessaoDaRequisicao()
    await this.#somar('usuario', this.chaveDoUsuario(escolaId, usuarioId), TETO_DE_PEDIDOS_DE_IA_POR_USUARIO, escolaId, usuarioId)
    await this.#somar('escola', this.chaveDaEscola(escolaId), TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA, escolaId, usuarioId)
  }

  async #somar(tipo: TipoDeLimiteDeIa, chave: string, teto: number, escolaId: string, usuarioId: string): Promise<void> {
    const { janela, instancias, logger } = this.dependencias
    const { valor, doSeguro } = await janela.somar(chave)
    const efetivo = doSeguro ? limiteDoSeguro(teto, instancias) : teto
    if (valor <= efetivo) return
    // Só o primeiro acima do teto na janela: a soma é atômica, e nenhum outro pedido lê este mesmo valor.
    if (valor === efetivo + 1) logger.warn({ evento: 'ia.limite_de_pedidos_atingido', tipo, escolaId, usuarioId })
    throw new ErroDeDominio(ErrorCode.LIMITE_EXCEDIDO, undefined, segundosParaTentarDeNovo(await janela.restanteMs(chave)))
  }

  /** As chaves dos contadores (o teste também as usa): o prefixo e o HMAC do identificador, nunca ele em texto. */
  chaveDoUsuario(escolaId: string, usuarioId: string): string {
    return this.dependencias.janela.chaveDe(PREFIXO_PEDIDOS_DE_IA_POR_USUARIO, `${escolaId}|${usuarioId}`)
  }

  chaveDaEscola(escolaId: string): string {
    return this.dependencias.janela.chaveDe(PREFIXO_PEDIDOS_DE_IA_POR_ESCOLA, escolaId)
  }
}
