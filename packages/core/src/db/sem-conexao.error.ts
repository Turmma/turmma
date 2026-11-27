/**
 * O pool não entregou uma conexão: o prazo (`connectionTimeoutMillis`) venceu com todas emprestadas, o servidor recusou
 * ou encerrou a conexão antes de qualquer consulta, ou o pool já fechou. Nenhuma consulta chegou a ser enviada, então
 * repetir a requisição é seguro, e o contrato é 503 `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`.
 *
 * Existe porque o erro do `pg-pool` é um `Error` comum, sem SQLSTATE, e o texto dele é do `pg-pool` e muda sem aviso:
 * só um tipo nosso, lançado no ponto em que a conexão é pedida, permite reconhecê-lo sem ler a mensagem.
 *
 * Carrega o erro original em `cause` e nunca o repete na própria mensagem: `summarizeError` lê o SQLSTATE dela, e o texto
 * do original, que pode trazer endereço do servidor, não vai para a resposta nem para o log.
 */
export class SemConexaoComOBancoError extends Error {
  constructor(causa: unknown) {
    super('sem conexão com o banco', { cause: causa })
    this.name = 'SemConexaoComOBancoError'
  }
}

/** O erro, solto ou embrulhado pelo Drizzle (`DrizzleQueryError` guarda o original em `cause`). */
export function semConexaoIn(erro: unknown): SemConexaoComOBancoError | undefined {
  if (erro instanceof SemConexaoComOBancoError) return erro
  if (erro instanceof Error && erro.cause instanceof SemConexaoComOBancoError) return erro.cause
  return undefined
}
