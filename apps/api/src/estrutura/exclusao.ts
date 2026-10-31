import { DomainException, postgresErrorIn } from '@educa/core'
import { ErrorCode } from '@educa/shared'

/** SQLSTATE `foreign_key_violation`: uma linha de outra tabela ainda aponta para a que se quer apagar. */
const LINHA_AINDA_REFERENCIADA = '23503'

/**
 * O `delete` da estrutura que uma FK barra vira `CONFLITO`, e nada é apagado (Tech Spec da A1, seções 3 e 4): a
 * disciplina com vínculo, a turma com vínculo ou com nome na lista (2.0) e, nas tarefas seguintes, a turma com pedido. É o
 * único lugar que traduz o 23503 da exclusão. O nome da restrição e o `detail` do Postgres, que traz o valor da linha,
 * não saem daqui: o erro novo não leva nada do original.
 *
 * Fora deste caminho o 23503 continua `ERRO_INTERNO` (`mapPostgresError`): numa gravação, ele é defeito nosso, e
 * não uma situação que a coordenação resolve.
 *
 * `excluir` devolve se apagou a linha; `false` quer dizer que ela não estava no alcance de quem pediu.
 */
export async function excluirSemReferencia(excluir: () => Promise<boolean>): Promise<boolean> {
  try {
    return await excluir()
  } catch (erro) {
    if (postgresErrorIn(erro)?.code === LINHA_AINDA_REFERENCIADA) throw new DomainException(ErrorCode.CONFLITO)
    throw erro
  }
}
