import { sql } from 'drizzle-orm'
import pg from 'pg'
import { afterEach, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../../tools/ci/compose.ts'
import { aguardarSaudavel, compose, composeOuFalha } from '../../../../tools/testes/compose.ts'
import { createDatabase } from './banco.js'
import { pingDatabase, createPool, type DatabaseConfig, type DatabasePool } from './pool.js'

function configuracaoLocal(): DatabaseConfig {
  const ambiente = lerAmbienteDeTeste()
  const usuario = valorObrigatorio(ambiente, 'POSTGRES_USUARIO')
  const senha = valorObrigatorio(ambiente, 'POSTGRES_SENHA')
  const banco = valorObrigatorio(ambiente, 'POSTGRES_BANCO')
  const porta = valorObrigatorio(ambiente, 'POSTGRES_PORTA_HOST')
  return {
    url: `postgres://${usuario}:${senha}@127.0.0.1:${porta}/${banco}`,
    maximoConexoes: 1,
    timeoutConexaoMs: 1_000,
    timeoutConsultaMs: 300,
  }
}

describe('criarPool', () => {
  const abertos: Array<DatabasePool | pg.Client> = []
  afterEach(async () => {
    await Promise.all(abertos.splice(0).map((recurso) => recurso.end()))
  })

  it('sobrevive à conexão ociosa derrubada pelo Postgres e avisa, em vez de encerrar o processo', async () => {
    const perdas: number[] = []
    const pool = createPool(configuracaoLocal(), () => perdas.push(Date.now()))
    abertos.push(pool)
    const { rows } = await pool.query<{ pid: number }>('select pg_backend_pid() as pid')
    const pidOcioso = rows[0]?.pid

    const administrador = new pg.Client({ connectionString: configuracaoLocal().url })
    abertos.push(administrador)
    await administrador.connect()
    await administrador.query('select pg_terminate_backend($1)', [pidOcioso])

    await expect.poll(() => perdas.length).toBe(1)
    expect(await pingDatabase(pool)).toBe(true)
  })

  it('aplica o timeout de consulta no servidor, para uma consulta lenta não segurar a conexão', async () => {
    const pool = createPool(configuracaoLocal(), () => undefined)
    abertos.push(pool)
    const { rows } = await pool.query<{ statement_timeout: string }>('show statement_timeout')
    expect(rows[0]?.statement_timeout).toBe('300ms')
    // 57014 é o cancelamento pelo statement_timeout do servidor, não o timeout do cliente.
    await expect(pool.query('select pg_sleep(2)')).rejects.toMatchObject({ code: '57014' })
    expect(await pingDatabase(pool)).toBe(true)
  })

  describe('erro de consulta devolve a conexão ao pool, e só erro de conexão a descarta', () => {
    async function pidDa(pool: DatabasePool): Promise<number | undefined> {
      const { rows } = await pool.query<{ pid: number }>('select pg_backend_pid() as pid')
      return rows[0]?.pid
    }

    function poolComContagemDeDescarte(ajuste: Partial<DatabaseConfig> = {}) {
      const pool = createPool({ ...configuracaoLocal(), ...ajuste }, () => undefined)
      abertos.push(pool)
      const descartes: unknown[] = []
      pool.on('remove', (conexao) => descartes.push(conexao))
      return { pool, descartes }
    }

    it('reaproveita a mesma conexão depois de violação de unicidade, de consulta cortada pelo statement_timeout e de erro de sintaxe', async () => {
      const { pool, descartes } = poolComContagemDeDescarte()
      const pidInicial = await pidDa(pool)
      const tabela = `teste_pool_${Date.now()}`
      await pool.query(`create table ${tabela} (nome text unique)`)
      try {
        await pool.query(`insert into ${tabela} (nome) values ($1)`, ['Enzo Martins'])
        await expect(pool.query(`insert into ${tabela} (nome) values ($1)`, ['Enzo Martins'])).rejects.toMatchObject({ code: '23505' })
        expect(await pidDa(pool)).toBe(pidInicial)

        await expect(pool.query('select pg_sleep(2)')).rejects.toMatchObject({ code: '57014' })
        expect(await pidDa(pool)).toBe(pidInicial)

        await expect(pool.query('selec 1')).rejects.toMatchObject({ code: '42601' })
        expect(await pidDa(pool)).toBe(pidInicial)

        // A conexão devolvida está boa de verdade: a consulta seguinte não herda estado do erro.
        const { rows } = await pool.query<{ total: string }>(`select count(*) as total from ${tabela}`)
        expect(rows[0]?.total).toBe('1')
        expect(descartes).toHaveLength(0)
      } finally {
        await pool.query(`drop table if exists ${tabela}`)
      }
    })

    it('descarta a conexão que ficou com transação abortada ou aberta, para ela não envenenar as consultas seguintes', async () => {
      const { pool, descartes } = poolComContagemDeDescarte()
      const tabela = `teste_pool_tx_${Date.now()}`
      await pool.query(`create table ${tabela} (nome text unique)`)
      try {
        await pool.query(`insert into ${tabela} (nome) values ('Enzo Martins')`)
        const pidAntes = await pidDa(pool)

        await expect(
          pool.query(`begin; insert into ${tabela} (nome) values ('Enzo Martins'); commit`),
        ).rejects.toMatchObject({ code: '23505' })
        await expect.poll(() => descartes.length).toBe(1)
        expect(await pidDa(pool)).not.toBe(pidAntes)

        // Sem erro, mas com a transação deixada aberta: também não volta ao pool.
        await pool.query('begin')
        await expect.poll(() => descartes.length).toBe(2)
        const { rows } = await pool.query<{ total: string }>(`select count(*) as total from ${tabela}`)
        expect(rows[0]?.total).toBe('1')
      } finally {
        await pool.query(`drop table if exists ${tabela}`)
      }
    })

    it('descarta a conexão encerrada pelo servidor no meio da consulta e abre outra na seguinte', async () => {
      // Consulta longa, para o encerramento cair com ela em andamento, e não depois dela.
      const { pool, descartes } = poolComContagemDeDescarte({ timeoutConsultaMs: 10_000 })
      const pidInicial = await pidDa(pool)

      const administrador = new pg.Client({ connectionString: configuracaoLocal().url })
      abertos.push(administrador)
      await administrador.connect()

      // A asserção entra junto com a consulta, antes do encerramento: a rejeição pode chegar antes da resposta
      // do `pg_terminate_backend`, e uma promessa ainda sem tratador nesse instante vira rejeição não tratada.
      const rejeitada = expect(pool.query('select pg_sleep(5)')).rejects.toMatchObject({ code: '57P01' })
      await expect.poll(async () => {
        const { rows } = await administrador.query<{ ativa: boolean }>(
          `select state = 'active' as ativa from pg_stat_activity where pid = $1`,
          [pidInicial],
        )
        return rows[0]?.ativa
      }).toBe(true)
      await administrador.query('select pg_terminate_backend($1)', [pidInicial])

      await rejeitada
      await expect.poll(() => descartes.length).toBe(1)
      const pidNovo = await pidDa(pool)
      expect(pidNovo).toBeDefined()
      expect(pidNovo).not.toBe(pidInicial)
    })
  })

  /**
   * Transação do Drizzle com o Postgres travado (`docker pause`): o prazo do cliente (`query_timeout`) estoura com a
   * consulta já enviada. O Drizzle manda o `begin` fora do `try`, e o `rollback` que ele manda depois de um erro também
   * estoura (e sai da fila sem ir ao servidor); nos dois casos ele não devolve a conexão com erro. A conexão emprestada
   * tem de sair do pool assim mesmo: presa, ela esgota o pool e segura o `end()` para sempre; devolvida como boa, ela
   * leva a transação aberta no servidor para quem a pegar depois.
   */
  describe('transação do Drizzle com o prazo do cliente estourado', () => {
    /** `true` se `end()` terminou dentro do prazo: com conexão presa, ele nunca termina. */
    async function encerraNoPrazo(pool: DatabasePool, limiteMs: number): Promise<boolean> {
      let prazo: NodeJS.Timeout | undefined
      const esgotado = new Promise<false>((resolver) => (prazo = setTimeout(() => resolver(false), limiteMs)))
      try {
        return await Promise.race([pool.end().then(() => true as const), esgotado])
      } finally {
        clearTimeout(prazo)
      }
    }

    it('o `begin` que estoura não prende a conexão: o pool de uma conexão volta a responder e o `end()` termina', async () => {
      // Sem entrar em `abertos`: com a conexão presa, o `end()` do afterEach esperaria até o prazo do hook.
      const pool = createPool(configuracaoLocal(), () => undefined)
      // A conexão ociosa que a transação vai pegar: é ela que recebe o `begin` com o Postgres parado.
      expect(await pingDatabase(pool)).toBe(true)
      composeOuFalha('pause', 'postgres')
      try {
        await expect(createDatabase(pool).transaction(async (tx) => tx.execute(sql`select 1`))).rejects.toThrow()
        expect(pool.totalCount - pool.idleCount).toBe(0)
      } finally {
        compose('unpause', 'postgres')
        await aguardarSaudavel('postgres')
      }
      expect(await pingDatabase(pool)).toBe(true)
      expect(await encerraNoPrazo(pool, 5_000)).toBe(true)
    })

    it('o `rollback` que estoura não devolve a transação aberta: a escrita da requisição que falhou não é confirmada por outra', async () => {
      const pool = createPool(configuracaoLocal(), () => undefined)
      abertos.push(pool)
      const banco = createDatabase(pool)
      const tabela = `teste_pool_rollback_${Date.now()}`
      await pool.query(`create table ${tabela} (nome text)`)
      try {
        let pausado = false
        try {
          await expect(
            banco.transaction(async (tx) => {
              await tx.execute(sql.raw(`insert into ${tabela} (nome) values ('da requisição que falhou')`))
              composeOuFalha('pause', 'postgres')
              pausado = true
              await tx.execute(sql`select 1`)
            }),
            // O `release` do `finally` do Drizzle vem depois do descarte: lançando, ele trocaria o erro do banco pelo da
            // liberação dupla do `pg-pool`.
          ).rejects.not.toThrow(/already been released/)
        } finally {
          if (pausado) {
            compose('unpause', 'postgres')
            await aguardarSaudavel('postgres')
          }
        }
        // A requisição seguinte, no mesmo pool de uma conexão, confirma a própria escrita.
        await banco.transaction(async (tx) => tx.execute(sql.raw(`insert into ${tabela} (nome) values ('da requisição seguinte')`)))
        const { rows } = await pool.query<{ nome: string }>(`select nome from ${tabela} order by nome`)
        expect(rows.map((linha) => linha.nome)).toEqual(['da requisição seguinte'])
      } finally {
        await pool.query(`drop table if exists ${tabela}`)
      }
    })
  })

  describe('a conexão emprestada por `pool.connect()`', () => {
    async function pidDaConexao(conexao: pg.PoolClient): Promise<number | undefined> {
      const { rows } = await conexao.query<{ pid: number }>('select pg_backend_pid() as pid')
      return rows[0]?.pid
    }

    it('descartada no erro de conexão, aceita o `release` de quem a pegou sem lançar, e o pool abre outra', async () => {
      const pool = createPool({ ...configuracaoLocal(), timeoutConsultaMs: 10_000 }, () => undefined)
      abertos.push(pool)
      const descartes: unknown[] = []
      pool.on('remove', (conexao) => descartes.push(conexao))
      const conexao = await pool.connect()
      const pid = await pidDaConexao(conexao)
      const administrador = new pg.Client({ connectionString: configuracaoLocal().url })
      abertos.push(administrador)
      await administrador.connect()

      // Encerrada com a consulta em andamento, como no teste do `pool.query`: o erro chega pela consulta.
      const rejeitada = expect(conexao.query('select pg_sleep(5)')).rejects.toMatchObject({ code: '57P01' })
      await expect.poll(async () => {
        const { rows } = await administrador.query<{ ativa: boolean }>(`select state = 'active' as ativa from pg_stat_activity where pid = $1`, [pid])
        return rows[0]?.ativa
      }).toBe(true)
      await administrador.query('select pg_terminate_backend($1)', [pid])
      await rejeitada

      // O `finally` do Drizzle e o `catch` do `JobNotificationListener` devolvem a conexão de novo, e isso não pode lançar.
      expect(() => conexao.release()).not.toThrow()
      expect(() => conexao.release(true)).not.toThrow()
      await expect.poll(() => descartes.length).toBe(1)
      const outra = await pool.connect()
      try {
        expect(await pidDaConexao(outra)).not.toBe(pid)
      } finally {
        outra.release()
      }
    })

    /**
     * Emprestada, a conexão fica sem o ouvinte de 'error' do pool, e o `pg` emite 'error' em toda queda de socket. Sem
     * ouvinte, a exceção sobe ao processo, e o `uncaughtException` do logger o encerra: um failover do Postgres com uma
     * transação aberta derrubaria a instância.
     */
    describe('queda da sessão com a transação aberta', () => {
      function capturarExcecoes(): unknown[] {
        const excecoes: unknown[] = []
        const aoExcecao = (erro: unknown) => excecoes.push(erro)
        process.on('uncaughtException', aoExcecao)
        onTestFinished(() => {
          process.off('uncaughtException', aoExcecao)
        })
        return excecoes
      }

      function poolComDescartes() {
        const pool = createPool({ ...configuracaoLocal(), timeoutConsultaMs: 10_000 }, () => undefined)
        abertos.push(pool)
        const descartes: unknown[] = []
        pool.on('remove', (conexao) => descartes.push(conexao))
        return { pool, descartes }
      }

      it('sessão encerrada pelo servidor entre duas consultas: nada sobe ao processo, a conexão sai do pool e o pool responde', async () => {
        const excecoes = capturarExcecoes()
        const { pool, descartes } = poolComDescartes()
        const conexao = await pool.connect()
        await conexao.query('begin')
        const pid = await pidDaConexao(conexao)
        const administrador = new pg.Client({ connectionString: configuracaoLocal().url })
        abertos.push(administrador)
        await administrador.connect()
        await administrador.query('select pg_terminate_backend($1)', [pid])

        // Nenhuma consulta em andamento: o aviso da queda chega só pelo 'error' da conexão.
        await expect.poll(() => descartes.length).toBe(1)
        await expect(conexao.query('select 1')).rejects.toThrow()
        expect(() => conexao.release()).not.toThrow()
        expect(excecoes).toEqual([])
        expect(await pingDatabase(pool)).toBe(true)
      })

      it('socket resetado no meio de uma consulta da transação: nada sobe ao processo, a conexão sai do pool e o pool responde', async () => {
        const excecoes = capturarExcecoes()
        const { pool, descartes } = poolComDescartes()
        const conexao = await pool.connect()
        await conexao.query('begin')
        const rejeitada = expect(conexao.query('select pg_sleep(5)')).rejects.toMatchObject({ code: 'ECONNRESET' })
        // `connection` é interno do `pg` (8.x) e não está nos tipos: uma troca de versão pode mudá-lo.
        const { connection: protocolo } = conexao as pg.PoolClient & { connection: { stream: { destroy(erro: Error): void } } }
        protocolo.stream.destroy(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))
        await rejeitada

        await expect.poll(() => descartes.length).toBe(1)
        expect(() => conexao.release()).not.toThrow()
        expect(excecoes).toEqual([])
        expect(await pingDatabase(pool)).toBe(true)
      })
    })

    it('emprestada e devolvida dezenas de milhares de vezes, a mesma conexão ainda consulta: a troca da `query` não se empilha', async () => {
      const pool = createPool(configuracaoLocal(), () => undefined)
      abertos.push(pool)
      const pid = await pool.query<{ pid: number }>('select pg_backend_pid() as pid')
      for (let vez = 0; vez < 50_000; vez++) (await pool.connect()).release()
      const conexao = await pool.connect()
      try {
        // Emprestada, só o ouvinte de 'error' deste empréstimo: o pool tira o dele, e o dos anteriores saiu na devolução.
        expect(conexao.listenerCount('error')).toBe(1)
        expect(await pidDaConexao(conexao)).toBe(pid.rows[0]?.pid)
      } finally {
        conexao.release()
      }
      expect(await pingDatabase(pool)).toBe(true)
    })

    it('na transação do Drizzle, o erro de consulta (unicidade) não descarta: o `rollback` é do Drizzle e a conexão volta limpa', async () => {
      const pool = createPool(configuracaoLocal(), () => undefined)
      abertos.push(pool)
      const descartes: unknown[] = []
      pool.on('remove', (conexao) => descartes.push(conexao))
      const banco = createDatabase(pool)
      const tabela = `teste_pool_tx_unica_${Date.now()}`
      await pool.query(`create table ${tabela} (nome text unique)`)
      try {
        const pidAntes = (await pool.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0]?.pid
        await expect(
          banco.transaction(async (tx) => {
            await tx.execute(sql.raw(`insert into ${tabela} (nome) values ('Enzo Martins')`))
            await tx.execute(sql.raw(`insert into ${tabela} (nome) values ('Enzo Martins')`))
          }),
        ).rejects.toMatchObject({ cause: { code: '23505' } })
        const depois = await pool.query<{ pid: number; total: string }>(`select pg_backend_pid() as pid, (select count(*) from ${tabela}) as total`)
        expect(depois.rows[0]).toEqual({ pid: pidAntes, total: '0' })
        expect(descartes).toHaveLength(0)
      } finally {
        await pool.query(`drop table if exists ${tabela}`)
      }
    })

    it('a forma com callback, a do `pg.Pool#query` por dentro, segue respondendo', async () => {
      const pool = createPool(configuracaoLocal(), () => undefined)
      abertos.push(pool)
      const resultado = await new Promise<pg.QueryResult<{ um: number }>>((resolver, rejeitar) => {
        pool.query<{ um: number }>('select 1 as um', (erro, resposta) => (erro ? rejeitar(erro) : resolver(resposta)))
      })
      expect(resultado.rows).toEqual([{ um: 1 }])
    })
  })

  it('desiste de abrir conexão dentro do timeout quando o Postgres trava, mesmo com o pool vazio', async () => {
    const pool = createPool({ ...configuracaoLocal(), timeoutConsultaMs: 10_000 }, () => undefined)
    abertos.push(pool)
    composeOuFalha('pause', 'postgres')
    try {
      const inicio = performance.now()
      expect(await pingDatabase(pool)).toBe(false)
      expect(performance.now() - inicio).toBeLessThan(3_000)
    } finally {
      compose('unpause', 'postgres')
      await aguardarSaudavel('postgres')
    }
  })
})
