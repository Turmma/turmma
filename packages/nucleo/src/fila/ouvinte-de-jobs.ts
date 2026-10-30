import type pg from 'pg'
import type { DatabasePool } from '../db/pool.js'
import { CANAL_NOTIFICACAO_JOB } from './job-registro.repository.js'

/**
 * Mantém uma conexão do pool em `LISTEN job` e chama `aoNotificar` a cada job novo. A conexão sai
 * do pool do próprio processo, então ela entra na soma que precisa caber no `max_connections`.
 *
 * O aviso é só atalho: o despachante também acorda a cada 500 ms. Por isso, se a conexão cair,
 * nada se perde; ela é aberta de novo na próxima chamada a `garantir()`.
 */
export class JobNotificationListener {
  #conexao: pg.PoolClient | undefined
  #abrindo: Promise<void> | undefined

  constructor(
    private readonly pool: DatabasePool,
    private readonly aoNotificar: () => void,
    private readonly aoPerderConexao: () => void,
  ) {}

  get ouvindo(): boolean {
    return this.#conexao !== undefined
  }

  /** Abre a conexão de escuta se não houver uma. Falha é silenciosa: o sondar a cada 500 ms segue valendo. */
  garantir(): Promise<void> {
    if (this.#conexao !== undefined) return Promise.resolve()
    this.#abrindo ??= this.abrir().finally(() => {
      this.#abrindo = undefined
    })
    return this.#abrindo
  }

  async fechar(): Promise<void> {
    await this.#abrindo
    const conexao = this.#conexao
    this.#conexao = undefined
    conexao?.release(true)
  }

  private async abrir(): Promise<void> {
    let conexao: pg.PoolClient
    try {
      conexao = await this.pool.connect()
    } catch {
      this.aoPerderConexao()
      return
    }
    const aoErrar = (): void => {
      if (this.#conexao !== conexao) return
      this.#conexao = undefined
      conexao.release(true)
      this.aoPerderConexao()
    }
    conexao.on('error', aoErrar)
    conexao.on('notification', (notificacao) => {
      if (notificacao.channel === CANAL_NOTIFICACAO_JOB) this.aoNotificar()
    })
    try {
      await conexao.query(`listen ${CANAL_NOTIFICACAO_JOB}`)
      this.#conexao = conexao
    } catch {
      conexao.release(true)
      this.aoPerderConexao()
    }
  }
}
