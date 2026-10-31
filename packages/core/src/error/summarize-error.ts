/**
 * Erro devolvido pelo servidor Postgres. Identificado pela forma, e não por `instanceof`, para
 * não depender de haver uma única cópia de `pg-protocol` instalada.
 */
export interface PostgresError extends Error {
  code: string
  severity: string
  constraint?: string | undefined
}

const FORMATO_SQLSTATE = /^[0-9A-Z]{5}$/

export function isPostgresError(erro: unknown): erro is PostgresError {
  if (!(erro instanceof Error)) return false
  const { code, severity } = erro as Partial<PostgresError>
  // `severity` separa o SQLSTATE do servidor de código de sistema do Node com cinco letras (EPIPE).
  return typeof code === 'string' && FORMATO_SQLSTATE.test(code) && typeof severity === 'string'
}

/**
 * O erro do Postgres, esteja ele solto ou embrulhado pelo Drizzle. O Drizzle lança
 * `DrizzleQueryError` com o erro do servidor em `cause`, e com a consulta e os parâmetros na
 * mensagem e em campos próprios: nada disso sai daqui, só o erro do servidor, para ser resumido.
 */
export function postgresErrorIn(erro: unknown): PostgresError | undefined {
  if (isPostgresError(erro)) return erro
  if (erro instanceof Error && isPostgresError(erro.cause)) return erro.cause
  return undefined
}

/** O que um erro pode deixar no log. Nenhum campo carrega texto montado com dado. */
export interface ErrorSummary {
  tipo: string
  sqlstate?: string
  constraint?: string
  pilha?: string[]
}

const LINHA_DE_PILHA = /^\s+at\s/

/**
 * Reduz um erro ao que é seguro logar.
 *
 * A mensagem nunca entra. No Postgres, `message` e `detail` trazem valor de linha
 * ("Key (nome)=(Enzo Martins) already exists", "invalid input syntax for type uuid: ..."). Fora
 * dele também: o `SyntaxError` de um corpo JSON inválido cita o trecho recebido. A pilha fica,
 * sem a primeira linha, que repete a mensagem.
 */
export function summarizeError(erro: unknown): ErrorSummary {
  const doPostgres = postgresErrorIn(erro)
  if (doPostgres !== undefined) {
    return {
      tipo: 'ErroDoPostgres',
      sqlstate: doPostgres.code,
      ...(doPostgres.constraint === undefined ? {} : { constraint: doPostgres.constraint }),
    }
  }
  if (erro instanceof Error) {
    const pilha = (erro.stack ?? '')
      .split('\n')
      .filter((linha) => LINHA_DE_PILHA.test(linha))
      .map((linha) => linha.trim())
    return { tipo: erro.name, ...(pilha.length > 0 ? { pilha } : {}) }
  }
  return { tipo: typeof erro }
}
