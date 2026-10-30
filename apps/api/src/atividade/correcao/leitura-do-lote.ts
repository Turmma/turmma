import { DomainException, requestSessao } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { createHash } from 'node:crypto'

/** Por quanto tempo vale a leitura da correção do lote, para a aprovação: um dia de trabalho. Depois disso, a professora relê antes de aprovar. */
export const VALIDADE_DA_LEITURA_DO_LOTE_MS = 12 * 60 * 60 * 1000

export const PREFIXO_DA_LEITURA_DO_LOTE = 'atividade:lote-lido'

const logger = new Logger('atividade')

/**
 * A marca de que a professora **leu a correção do lote** antes de aprovar (D56: a validação é efetiva, e não um clique).
 * `GET …/correcao` grava, para a pessoa e o lote, a marca do que foi apresentado a ela; `aprovar-lote` só passa se a
 * marca existe e é a do que o servidor monta naquele instante. Sem ter lido, ou com o lote diferente do que ela leu, a
 * aprovação é recusada, e a tela relê.
 *
 * Fica no Redis de fila, e não em memória: com duas instâncias, a leitura cai numa e a aprovação, na outra (regra 80,
 * item 5). A chave é o hash da escola, do lote e da pessoa; o valor, a marca do resumo. Nenhum dos dois é dado de aluno.
 * A prova durável do que foi apresentado é a `validacao_do_lote`: a marca só decide se ela pode ser gravada.
 *
 * Redis fora: a leitura responde assim mesmo (só não marca), e a aprovação responde 503, para tentar de novo. Nunca
 * aprova sem conferir.
 */
export class LeituraDoLote {
  constructor(private readonly cliente: Pick<Redis, 'set' | 'get'>) {}

  /** A chave da leitura do lote pela pessoa da sessão. */
  chave(entregaId: string): string {
    const { escolaId, usuarioId } = requestSessao()
    return `${PREFIXO_DA_LEITURA_DO_LOTE}:${createHash('sha256').update(`${escolaId}|${entregaId}|${usuarioId}`).digest('base64url')}`
  }

  /** Registra que a pessoa da sessão recebeu o lote com esta marca. */
  async registrar(entregaId: string, marca: string): Promise<void> {
    const chave = this.chave(entregaId)
    try {
      await this.cliente.set(chave, marca, 'PX', VALIDADE_DA_LEITURA_DO_LOTE_MS)
    } catch {
      logger.warn('atividade.leitura_do_lote_nao_registrada')
    }
  }

  /** A marca do que a pessoa da sessão leu por último deste lote, se leu e a leitura ainda vale. */
  async marcaLida(entregaId: string): Promise<string | undefined> {
    // Fora do `try`: sem sessão de pessoa, quem recusa é a sessão, e não o Redis.
    const chave = this.chave(entregaId)
    try {
      return (await this.cliente.get(chave)) ?? undefined
    } catch {
      throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    }
  }
}
