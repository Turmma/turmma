import type { DatabaseTransaction } from '@educa/core'

/**
 * A conferência do autor de uma escrita do operador (Tech Spec da A0b, seção 5, "Autor"), que o caso de uso chama como
 * **primeira instrução da transação dele** e que devolve o apelido que vai para `autor_operador`. Quem não passa lança:
 * o painel, `SESSAO_ENCERRADA`; o comando, `OperadorRecusado`. O pedido nunca escolhe o autor.
 */
export type ConferenciaDoAutor = (tx: DatabaseTransaction) => Promise<string>
