import type { DatabasePool } from '@educa/nucleo'
import { randomBytes } from 'node:crypto'

/** A primeira metade da chave da trava consultiva dos gatilhos de parada: longe das 7_000_00x do código. */
const CLASSE_DA_PARADA = 8_000_001

const PRAZO_DA_ESPERA_MS = 15_000

/** Espera `condicao` ficar verdadeira, conferindo a cada 20 ms, por até 15 s; senão falha com a `descricao`. */
export async function aguardar(condicao: () => Promise<boolean>, descricao: string): Promise<void> {
  const prazo = Date.now() + PRAZO_DA_ESPERA_MS
  while (!(await condicao())) {
    if (Date.now() > prazo) throw new Error(`não aconteceu a tempo: ${descricao}`)
    await new Promise((pronto) => setTimeout(pronto, 20))
  }
}

/**
 * Espera até `quantos` backends deste banco estarem parados numa espera de trava de linha ou de transação (`wait_event_type
 * = 'Lock'`) com a consulta que casa `padrao` (`ilike`). É como o teste confere que a escrita ficou mesmo na fila da
 * trava, e não passou antes por outro caminho.
 */
export async function esperarNaTrava(pool: DatabasePool, padrao: string, quantos = 1): Promise<void> {
  await aguardar(async () => {
    const { rows } = await pool.query<{ total: number }>(
      `select count(*)::int as total from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock' and query ilike $1`,
      [padrao],
    )
    return (rows[0]?.total ?? 0) >= quantos
  }, `${quantos} esperando na trava com ${padrao}`)
}

/**
 * Um gatilho **só do banco de teste** que para uma escrita no meio da transação dela, sem gancho no código de produção
 * (cenários E11 e E15 da A0b). É `after … for each row`: quando ele dispara, a linha já está na tabela e nos índices, e
 * a transação já passou por tudo que veio antes (o `for share` do autor, por exemplo). Ali ele espera numa trava
 * consultiva que o teste segura; o teste confere o que quiser com a escrita parada, e solta.
 *
 * Só dispara para as linhas da condição `quando` (SQL sobre `new`; no `delete`, sobre `old`), para não parar outra
 * escrita do mesmo arquivo. `desarmar` apaga o gatilho e a função, e solta a trava se ela ainda estiver segura.
 */
export class GatilhoDeParada {
  readonly #pool: DatabasePool
  readonly #nome = `teste_parada_${randomBytes(6).toString('hex')}`
  readonly #chave = randomBytes(3).readUIntBE(0, 3)
  /** Solta a trava e devolve a conexão que a segura; existe só entre `armar` e `soltar`. */
  #soltarTrava: (() => Promise<void>) | undefined

  constructor(
    pool: DatabasePool,
    private readonly opcoes: { readonly tabela: string; readonly evento: 'insert' | 'update' | 'delete'; readonly quando: string },
  ) {
    this.#pool = pool
  }

  /** Segura a trava e cria o gatilho: a próxima escrita que casar com `quando` para nele. */
  async armar(): Promise<void> {
    const segurador = await this.#pool.connect()
    await segurador.query('select pg_advisory_lock($1, $2)', [CLASSE_DA_PARADA, this.#chave])
    this.#soltarTrava = async () => {
      try {
        await segurador.query('select pg_advisory_unlock($1, $2)', [CLASSE_DA_PARADA, this.#chave])
      } finally {
        segurador.release()
      }
    }
    await this.#pool.query(
      `create function ${this.#nome}() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock_shared(${CLASSE_DA_PARADA}, ${this.#chave}); return null; end $$`,
    )
    await this.#pool.query(`create trigger ${this.#nome} after ${this.opcoes.evento} on ${this.opcoes.tabela} for each row when (${this.opcoes.quando}) execute function ${this.#nome}()`)
  }

  /** Espera até `quantas` escritas estarem paradas no gatilho. */
  async esperarParadas(quantas = 1): Promise<void> {
    await aguardar(async () => {
      const { rows } = await this.#pool.query<{ total: number }>(
        `select count(*)::int as total from pg_locks where locktype = 'advisory' and classid = $1 and objid = $2 and objsubid = 2 and not granted`,
        [CLASSE_DA_PARADA, this.#chave],
      )
      return (rows[0]?.total ?? 0) >= quantas
    }, `${quantas} escrita(s) parada(s) no gatilho ${this.#nome}`)
  }

  /** Solta a trava: as escritas paradas seguem, e as próximas passam direto. */
  async soltar(): Promise<void> {
    const soltarTrava = this.#soltarTrava
    this.#soltarTrava = undefined
    await soltarTrava?.()
  }

  async desarmar(): Promise<void> {
    await this.soltar()
    await this.#pool.query(`drop trigger if exists ${this.#nome} on ${this.opcoes.tabela}`)
    await this.#pool.query(`drop function if exists ${this.#nome}()`)
  }
}
