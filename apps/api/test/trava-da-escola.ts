import type { DatabasePool } from '@educa/nucleo'
import { CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA } from '../src/sessao/index.js'
import { aguardar } from './gatilho-de-parada.js'

/**
 * A trava do convite da escola (`pg_advisory_xact_lock(7_000_003, hashtext(escola_id))`, Tech Spec da A0b, seção 7c)
 * vista de fora, pelo teste: segurá-la numa conexão própria, e esperar quem está na fila dela. É com isso que os
 * cenários E8, E15 e I6 forçam a ordem entre o operador e a ativação por convite, sem gancho no código de produção.
 */

/** Segura a trava do convite da escola numa conexão do teste; `soltar` pode ser chamado mais de uma vez. */
export async function segurarTravaDaEscola(pool: DatabasePool, escolaId: string): Promise<() => Promise<void>> {
  const conexao = await pool.connect()
  await conexao.query('select pg_advisory_lock($1, hashtext($2::uuid::text))', [CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA, escolaId])
  let solta = false
  return async () => {
    if (solta) return
    solta = true
    try {
      await conexao.query('select pg_advisory_unlock($1, hashtext($2::uuid::text))', [CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA, escolaId])
    } finally {
      conexao.release()
    }
  }
}

/** Espera `quantas` transações paradas na trava do convite desta escola, com `wait_event = 'advisory'`. */
export async function esperarNaTravaDaEscola(pool: DatabasePool, escolaId: string, quantas: number): Promise<void> {
  await aguardar(async () => {
    const { rows } = await pool.query<{ total: number }>(
      `select count(*)::int as total from pg_locks l join pg_stat_activity a on a.pid = l.pid
        where l.locktype = 'advisory' and l.classid = $1 and l.objid = hashtext($2::uuid::text)::oid and l.objsubid = 2
          and not l.granted and a.wait_event = 'advisory'`,
      [CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA, escolaId],
    )
    return (rows[0]?.total ?? 0) >= quantas
  }, `${quantas} na trava do convite da escola`)
}

/**
 * Dispara as duas chamadas com a trava da escola segura pelo teste, uma depois da outra: a segunda só sai quando a
 * primeira já espera na trava, e o Postgres entrega a trava na ordem da fila. Solta com as duas esperando.
 */
export async function emOrdemNaTrava<A, B>(pool: DatabasePool, escolaId: string, primeira: () => Promise<A>, segunda: () => Promise<B>): Promise<[A, B]> {
  const soltar = await segurarTravaDaEscola(pool, escolaId)
  try {
    const daPrimeira = primeira()
    await esperarNaTravaDaEscola(pool, escolaId, 1)
    const daSegunda = segunda()
    await esperarNaTravaDaEscola(pool, escolaId, 2)
    await soltar()
    return [await daPrimeira, await daSegunda]
  } finally {
    await soltar()
  }
}
