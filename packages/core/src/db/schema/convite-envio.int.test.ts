import { randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../../tools/testes/integracao.setup.ts'
import { createLogger } from '../../log/logger.js'
import { migrate, PASTA_MIGRACOES } from '../migrate.js'

/**
 * As invariantes do envio do convite por e-mail (migration 0042, acesso-e-convites, tarefa 1.0), provadas por fora do código: é o que
 * segura um `update` escrito à mão, uma rotina ou um repository de outro pacote que esqueça a regra. O token e o endereço cifrados
 * só existem enquanto o envio espera (`na_fila`, `enviando`), e o banco é a última barreira disso (regra 20, item 8).
 *
 * O teste migra um banco só dele, com as migrations da pasta, como o `aula.int.test.ts`: o que se prova é o texto da
 * `0042_envio_de_email.sql`, e o banco do ambiente já a aplicou antes de qualquer teste rodar.
 */
describe('acesso-e-convites: o banco recusa o envio do convite que o contrato proíbe', () => {
  const nomeDoBanco = `convite_envio_${Date.now()}`
  const urlDoAmbiente = new URL(urlDoBancoDeTeste())
  const urlDoScratch = new URL(urlDoAmbiente)
  urlDoScratch.pathname = `/${nomeDoBanco}`
  const administrador = new pg.Client({ connectionString: urlDoAmbiente.toString() })
  const cliente = new pg.Client({ connectionString: urlDoScratch.toString() })
  let escolaId = ''

  /** O que o banco recusou: o código do erro e o nome da restrição. Falha se não recusou. */
  async function recusa(consulta: Promise<unknown>): Promise<{ codigo: string; restricao: string | undefined }> {
    try {
      await consulta
    } catch (erro) {
      const { code, constraint } = erro as { code: string; constraint?: string }
      return { codigo: code, restricao: constraint }
    }
    throw new Error('o banco deveria ter recusado')
  }

  async function id(instrucao: string, valores: unknown[]): Promise<string> {
    const { rows } = await cliente.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  const RECUSADO_PELO = (restricao: string) => ({ codigo: '23514', restricao })
  const CIFRADO = Buffer.from('cifrado-sintetico')

  /** Um convite de professor para uma pessoa nova (o índice do convite aberto é por pessoa); o que o teste prova entra em `ajuste`. */
  async function convite(ajuste: Record<string, unknown> = {}): Promise<string> {
    const contaId = await id('insert into conta (email) values ($1) returning id', [`convite-envio-${randomUUID()}@educa.invalid`])
    const usuarioId = await id("insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'professor', 'Pessoa sintética', now()) returning id", [escolaId, contaId])
    const linha = { escola_id: escolaId, token_hash: randomBytes(32).toString('hex'), tipo: 'professor', usuario_id: usuarioId, expira_em: new Date(Date.now() + 86_400_000), ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into convite (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  beforeAll(async () => {
    await administrador.connect()
    await administrador.query(`create database ${nomeDoBanco}`)
    await migrate({ url: urlDoScratch.toString(), timeoutConexaoMs: 5_000, timeoutConsultaMs: 60_000, pasta: PASTA_MIGRACOES }, createLogger({ servico: 'migrar-convite-envio-teste', nivel: 'silent' }))
    await cliente.connect()
    const redeId = await id("insert into rede (nome, tipo) values ('Rede sintética do envio', 'independente') returning id", [])
    escolaId = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola sintética do envio', $2) returning id", [redeId, `envio-${randomUUID()}`])
  }, 120_000)

  afterAll(async () => {
    await cliente.end()
    await administrador.query(`drop database if exists ${nomeDoBanco} with (force)`)
    await administrador.end()
  })

  describe('compatível com o código anterior', () => {
    it('o convite gravado como antes (sem canal, sem envio) entra como `copiado`, sem envio, sem cifrados, com o `criado_em` de agora', async () => {
      const conviteId = await convite()
      const { rows } = await cliente.query<{ canal: string; envio: string | null; token: Buffer | null; destino: Buffer | null; reservado: Date | null; enviado: Date | null; recente: boolean }>(
        `select canal, envio, token_cifrado as token, destino_cifrado as destino, envio_reservado_em as reservado, enviado_em as enviado, criado_em > now() - interval '1 minute' as recente from convite where id = $1`,
        [conviteId],
      )
      expect(rows).toEqual([{ canal: 'copiado', envio: null, token: null, destino: null, reservado: null, enviado: null, recente: true }])
    })
  })

  describe('o canal e o envio', () => {
    it('o canal e o `criado_em` não aceitam nulo: o `insert` que os anula é recusado', async () => {
      expect(await recusa(convite({ canal: null }))).toEqual({ codigo: '23502', restricao: undefined })
      expect(await recusa(convite({ criado_em: null }))).toEqual({ codigo: '23502', restricao: undefined })
    })

    it('o canal só é `copiado` ou `email`', async () => {
      expect(await recusa(convite({ canal: 'sms' }))).toEqual(RECUSADO_PELO('convite_canal_valido'))
      await expect(convite({ canal: 'email', envio: 'na_fila', token_cifrado: CIFRADO, destino_cifrado: CIFRADO })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('o envio só é um dos cinco estados', async () => {
      expect(await recusa(convite({ canal: 'email', envio: 'reenviando' }))).toEqual(RECUSADO_PELO('convite_envio_valido'))
      for (const envio of ['enviado', 'falhou', 'cancelado']) await expect(convite({ canal: 'email', envio }), envio).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('só o convite de canal `email` tem envio, e o de canal `email` sempre tem', async () => {
      expect(await recusa(convite({ canal: 'copiado', envio: 'na_fila', token_cifrado: CIFRADO, destino_cifrado: CIFRADO }))).toEqual(RECUSADO_PELO('convite_envio_so_por_email'))
      expect(await recusa(convite({ canal: 'copiado', envio: 'enviado' }))).toEqual(RECUSADO_PELO('convite_envio_so_por_email'))
      expect(await recusa(convite({ canal: 'email' }))).toEqual(RECUSADO_PELO('convite_envio_so_por_email'))
    })
  })

  describe('os cifrados', () => {
    it('o token e o endereço cifrados somem em `enviado`, `falhou` e `cancelado`: o banco recusa qualquer um dos dois ali', async () => {
      for (const envio of ['enviado', 'falhou', 'cancelado']) {
        const restricao = RECUSADO_PELO('convite_cifrados_so_no_envio_aberto')
        expect(await recusa(convite({ canal: 'email', envio, token_cifrado: CIFRADO, destino_cifrado: CIFRADO })), `${envio} com os dois`).toEqual(restricao)
        expect(await recusa(convite({ canal: 'email', envio, token_cifrado: CIFRADO })), `${envio} com o token`).toEqual(restricao)
        expect(await recusa(convite({ canal: 'email', envio, destino_cifrado: CIFRADO })), `${envio} com o endereço`).toEqual(restricao)
        await expect(convite({ canal: 'email', envio }), `${envio} sem nenhum`).resolves.toMatch(/^[0-9a-f-]{36}$/)
      }
    })

    it('em `na_fila` e `enviando` os dois vêm juntos: um sem o outro, ou nenhum, é recusado', async () => {
      for (const envio of ['na_fila', 'enviando']) {
        const restricao = RECUSADO_PELO('convite_cifrados_so_no_envio_aberto')
        expect(await recusa(convite({ canal: 'email', envio, token_cifrado: CIFRADO })), `${envio} só o token`).toEqual(restricao)
        expect(await recusa(convite({ canal: 'email', envio, destino_cifrado: CIFRADO })), `${envio} só o endereço`).toEqual(restricao)
        expect(await recusa(convite({ canal: 'email', envio })), `${envio} nenhum`).toEqual(restricao)
        await expect(convite({ canal: 'email', envio, token_cifrado: CIFRADO, destino_cifrado: CIFRADO }), `${envio} os dois`).resolves.toMatch(/^[0-9a-f-]{36}$/)
      }
    })

    it('o `update` que leva o envio a `enviado` sem anular os cifrados é recusado, e o que os anula passa', async () => {
      const conviteId = await convite({ canal: 'email', envio: 'enviando', token_cifrado: CIFRADO, destino_cifrado: CIFRADO })
      expect(await recusa(cliente.query("update convite set envio = 'enviado' where id = $1", [conviteId]))).toEqual(RECUSADO_PELO('convite_cifrados_so_no_envio_aberto'))
      await cliente.query("update convite set envio = 'enviado', token_cifrado = null, destino_cifrado = null where id = $1", [conviteId])
    })
  })

  describe('a reserva', () => {
    it('a marca da reserva só existe com o envio `enviando`', async () => {
      const restricao = RECUSADO_PELO('convite_reserva_so_enviando')
      expect(await recusa(convite({ canal: 'email', envio: 'na_fila', token_cifrado: CIFRADO, destino_cifrado: CIFRADO, envio_reservado_em: new Date() }))).toEqual(restricao)
      expect(await recusa(convite({ canal: 'email', envio: 'enviado', envio_reservado_em: new Date() }))).toEqual(restricao)
      expect(await recusa(convite({ envio_reservado_em: new Date() }))).toEqual(restricao)
      await expect(convite({ canal: 'email', envio: 'enviando', token_cifrado: CIFRADO, destino_cifrado: CIFRADO, envio_reservado_em: new Date() })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('o índice do expurgo', () => {
    it('o índice parcial (escola, criado_em) só cobre o envio `na_fila` e `enviando`', async () => {
      const { rows } = await cliente.query<{ definicao: string }>("select indexdef as definicao from pg_indexes where tablename = 'convite' and indexname = 'convite_envio_aberto_idx'")
      expect(rows).toHaveLength(1)
      const definicao = rows[0]?.definicao ?? ''
      expect(definicao).toContain('(escola_id, criado_em)')
      expect(definicao).toMatch(/WHERE \(envio = ANY \(ARRAY\['na_fila'::text, 'enviando'::text\]\)\)/)
      expect(definicao).not.toMatch(/'enviado'|'falhou'|'cancelado'/)
    })
  })
})
