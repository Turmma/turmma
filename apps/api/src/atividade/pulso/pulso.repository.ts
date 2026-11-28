import { isConnectionError, Unscoped, type DatabasePool } from '@educa/core'
import { LIMIAR_DA_LACUNA_MS } from '@educa/shared'
import type { PoolClient } from 'pg'

/** A conexão que o pool empresta. */
type ConexaoDoPool = PoolClient

/**
 * O pulso numa instrução só (Tech Spec §5.7; regra 80, item 6). `antes` lê e **trava** a linha única; `novo` a atualiza com o `now()` do banco e devolve o que havia; e a
 * lacuna entre os dois, **acima do limiar**, vira uma `indisponibilidade`. Numa instrução só, o `update` e o `insert` confirmam juntos ou não confirmam: a lacuna que a
 * falha do `insert` deixaria sem gravar continua visível no próximo pulso, que parte do mesmo `ultimo_em`. A trava faz de duas instâncias pulsando ao mesmo tempo uma fila:
 * a segunda lê o `ultimo_em` que a primeira acabou de gravar, e a lacuna não é gravada duas vezes. `gravadas` e `lacunas` dizem o que a instrução fez, para quem a chamou.
 */
const PULSAR = `
  with antes as (select ultimo_em from pulso_da_api for update),
  novo as (
    update pulso_da_api set ultimo_em = now() from antes
    returning antes.ultimo_em as anterior, pulso_da_api.ultimo_em as atual
  ),
  lacunas as (
    insert into indisponibilidade (inicio, fim)
    select anterior, atual from novo where atual - anterior > make_interval(secs => $1::double precision)
    returning id
  )
  select (select count(*)::int from novo) as pulsos, (select count(*)::int from lacunas) as lacunas
`

/** A linha única de volta, quando a tabela está vazia (restauração de backup sem ela): sem `ultimo_em` anterior não há lacuna a gravar. */
const RECRIAR_A_LINHA = 'insert into pulso_da_api (ultimo_em) values (now()) on conflict do nothing'

/**
 * A escrita do pulso, **com conexão própria**: uma conexão tirada do pool e **não devolvida**, que reconecta quando cai. Enquanto a conexão segue retida, a requisição que esgota o
 * pool não impede o pulso, e o pulso que ficasse atrás de uma fila de conexões mediria o pool, não a API. Para reconectar, o pulso entra na fila do pool compartilhado (a causa 3
 * do runbook admite isso): a conexão é própria enquanto vive, não depois de cair. A conexão que o Postgres derrubou (`pg_terminate_backend`, failover) é
 * trocada na própria chamada: o pulso seguinte grava sem lacuna que não houve, em vez de falhar uma vez para só então reconectar.
 */
export class PulsoRepository {
  #conexao: ConexaoDoPool | undefined

  constructor(private readonly pool: DatabasePool) {}

  /**
   * A conexão do pulso: a retida, ou uma nova do pool. O `'error'` dela (queda do socket) é ouvido, ou encerraria o processo; quem trata a queda é `pulsar`, que a descobre
   * no próximo pulso (o `pg` recusa a consulta numa conexão que já caiu) e reconecta na própria chamada.
   */
  async #conexaoDoPulso(): Promise<ConexaoDoPool> {
    if (this.#conexao !== undefined) return this.#conexao
    const conexao = await this.pool.connect()
    conexao.on('error', () => undefined)
    this.#conexao = conexao
    return conexao
  }

  /** Devolve ao pool, descartada (`release(true)`), a conexão que falhou: a seguinte abre outra. */
  #descartar(): void {
    const conexao = this.#conexao
    this.#conexao = undefined
    conexao?.release(true)
  }

  async #run(): Promise<void> {
    const conexao = await this.#conexaoDoPulso()
    const { rows } = await conexao.query<{ pulsos: number }>(PULSAR, [LIMIAR_DA_LACUNA_MS / 1000])
    // Tabela vazia: nada foi atualizado, e o pulso não pode contar como dado. A linha volta, sem lacuna.
    if (rows[0]?.pulsos === 0) await conexao.query(RECRIAR_A_LINHA)
  }

  /**
   * Um pulso. A falha de conexão descarta a conexão e tenta **uma vez** de novo, numa nova; qualquer outra falha (o `insert` recusado, o `statement_timeout`) sobe a quem
   * chamou, que não conta o pulso como feito.
   */
  @Unscoped('o pulso é fato global da API: a linha única e a indisponibilidade não têm escola nem pessoa, e nenhuma requisição de escola chega aqui')
  async pulsar(): Promise<void> {
    try {
      await this.#run()
    } catch (erro) {
      if (!isConnectionError(erro)) throw erro
      this.#descartar()
      await this.#run()
    }
  }

  /** Devolve a conexão ao pool, limpa. Sem isso o `pool.end()` do desligamento espera por ela. */
  async encerrar(): Promise<void> {
    const conexao = this.#conexao
    this.#conexao = undefined
    conexao?.release()
  }
}
