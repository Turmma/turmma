import type { EstadoDoPedido } from '@educa/shared'
import { agendarRelitura, type BrowserTab } from '../../../components/pedidos/atualizacao-dos-pedidos'

/**
 * O detalhe do pedido que se atualiza enquanto o arquivo é montado (F3, 17.0; RF16; Tech Spec do F3, seção 9): o pedido de
 * acesso ou de portabilidade nasce `em_preparacao`, o worker monta o arquivo fora da requisição e o pedido passa a `pronto`
 * sem ninguém tocar na tela. Sem React aqui, para a regra ter teste de unidade com relógio falso.
 */

/** De quanto em quanto tempo o detalhe é relido enquanto o arquivo está em preparação (Tech Spec do F3, seção 9). */
export const INTERVALO_DA_PREPARACAO_MS = 10_000

/**
 * Só o pedido em preparação se relê sozinho. Cada leitura do detalhe é auditada em nome da coordenação (`pedido.lido`,
 * regra 20, item 10), e por isso o pedido que não está mudando de estado por conta própria (recebido, pronto, agendado,
 * concluído, cancelado) nunca é lido sem a pessoa pedir.
 */
export function relerEnquantoPrepara(estado: EstadoDoPedido): boolean {
  return estado === 'em_preparacao'
}

/**
 * Relê o detalhe a cada 10 s enquanto o pedido está em preparação e a aba à vista, e para com a aba escondida: a aba
 * esquecida atrás de outra não fica batendo na API nem enchendo a auditoria (regra 80). Quando a aba volta, relê na hora.
 * Fora de `em_preparacao` não agenda nada. Devolve como parar, para quando o estado muda ou a tela sai.
 */
export function agendarPreparacao(estado: EstadoDoPedido, atualizar: () => void, aba: BrowserTab): () => void {
  if (!relerEnquantoPrepara(estado)) return () => undefined
  return agendarRelitura(atualizar, aba, INTERVALO_DA_PREPARACAO_MS)
}
