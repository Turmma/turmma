import { createDatabase, createPool, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, criadoNoPainelResponseSchema, redesDoPainelResponseSchema, MAXIMO_DE_REDES_DO_PAINEL } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import type { BancoDoComando, SaidaDoComando } from '../src/ops/command.js'
import { executarOpsConviteCoordenador } from '../src/ops/convite-coordenador.js'
import { executarOpsEscola } from '../src/ops/escola.js'
import { desativarOperador } from '../src/ops/operador.js'
import { executarOpsRedefinirMfa } from '../src/ops/redefinir-mfa.js'
import { executarOpsRevogarConvite } from '../src/ops/revogar-convite.js'
import { executarOpsUso } from '../src/ops/uso.js'
import { criarConviteDeCoordenador } from '../src/sessao/index.js'
import { esperarNaTrava, GatilhoDeParada } from './write-block-trigger.js'
import { ESPERA_DO_AUTOR, esperarErro, nomeQueVemPrimeiro, pedir, PRAZO_DAS_CONSULTAS_MS, segurarODesativar as segurarODesativarNoBanco, subirApiDoPainel as subir } from './painel.fixture.js'
import { BancadaDeOperadores, type SessaoDeOperadorDeTeste } from './operador-session.fixture.js'
import { autorDaBancada, BancadaDeSessoes } from './sessao.fixture.js'

/**
 * A escrita do painel da operação (A0b, tarefa 1.0): `POST /v1/operacao/redes` e `/escolas`, e o autor conferido dentro
 * da transação, no painel e nos cinco `ops:*` de escola. Cenários de `tasks/prd-apresentacao-painel/cenarios.md`: E1–E5,
 * E11 (criar escola e os cinco comandos), E12, E14 e A3 (rede e escola). Postgres e Redis reais do compose de teste.
 */

const RECUSA_DO_OPERADOR = 'OPERADOR não é um operador ativo da equipe\n'

describe('painel da operação: rede e escola, com o autor conferido na transação (tarefa 1.0)', () => {
  const operadores = new BancadaDeOperadores()
  const escolasDaBancada = new BancadaDeSessoes()
  const linhasDeLog: string[] = []
  const redes: string[] = []
  const escolas: string[] = []
  /** Escolas da bancada com convite: o convite sai antes de a bancada apagar o usuário convidado. */
  const escolasComConvite: string[] = []
  const pasta = mkdtempSync(join(tmpdir(), 'painel-escrita-int-'))
  const sufixo = randomUUID().slice(0, 8)
  let app: INestApplication
  let url: string
  let pool: DatabasePool
  let banco: Database

  const novaRede = (nome = `Rede Sintética ${randomUUID().slice(0, 8)}`) => ({ id: randomUUID(), nome, tipo: 'prefeitura' as const })
  const novaEscola = (redeId: string, slug = `painel-${randomUUID().slice(0, 12)}`) => ({ id: randomUUID(), redeId, nome: `Colégio Sintético ${slug}`, slug })

  async function criarRedePeloPainel(sessao: SessaoDeOperadorDeTeste): Promise<string> {
    const pedido = novaRede()
    const resposta = await pedir(url, 'POST', '/v1/operacao/redes', sessao.token, pedido)
    expect(resposta.status).toBe(201)
    redes.push(pedido.id)
    return pedido.id
  }

  const contar = async (sql: string, parametros: unknown[]) => (await pool.query<{ total: number }>(`select count(*)::int as total from (${sql}) as linhas`, parametros)).rows[0]?.total ?? 0
  const auditoriaDe = (entidadeId: string) =>
    pool.query<{ acao: string; escola_id: string | null; autor_operador: string | null; autor_usuario_id: string | null }>(
      'select acao, escola_id, autor_operador, autor_usuario_id from auditoria where entidade_id = $1 order by em',
      [entidadeId],
    )
  const linhasComEvento = (evento: string) => linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['msg'] === evento)

  const segurarODesativar = (operadorId: string) => segurarODesativarNoBanco(pool, operadorId)

  beforeAll(async () => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 6, timeoutConexaoMs: 5_000, timeoutConsultaMs: PRAZO_DAS_CONSULTAS_MS }, () => undefined)
    banco = createDatabase(pool)
    ;({ app, url } = await subir(linhasDeLog))
  })

  afterAll(async () => {
    await app.close()
    await pool.query('delete from convite where escola_id = any($1::uuid[])', [escolasComConvite])
    await pool.query('delete from auditoria where escola_id = any($1::uuid[]) or entidade_id = any($2::uuid[])', [escolas, redes])
    await pool.query('delete from escola where id = any($1::uuid[])', [escolas])
    await pool.query('delete from rede where id = any($1::uuid[])', [redes])
    await pool.end()
    await escolasDaBancada.fechar()
    await operadores.fechar()
    rmSync(pasta, { recursive: true, force: true })
  })

  describe('E1 e A3: criar rede e escola grava a linha e a auditoria com o apelido da sessão, e o log leva só ids', () => {
    it('rede.criada sem escola e escola.criada na escola, com o autor da sessão; resposta só com o id, no-store', async () => {
      const sessao = await operadores.operadorComSessao()
      linhasDeLog.length = 0
      const pedidoDaRede = novaRede(`Rede Sintética Sentinela ${sufixo}`)
      const rede = await pedir(url, 'POST', '/v1/operacao/redes', sessao.token, pedidoDaRede)
      expect(rede.status).toBe(201)
      expect(rede.corpo).toStrictEqual({ id: pedidoDaRede.id })
      expect(criadoNoPainelResponseSchema.safeParse(rede.corpo).success).toBe(true)
      expect(rede.cacheControl).toBe('no-store')
      redes.push(pedidoDaRede.id)

      const pedidoDaEscola = novaEscola(pedidoDaRede.id, `sentinela-${sufixo}`)
      const escola = await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedidoDaEscola)
      expect(escola.status).toBe(201)
      expect(escola.corpo).toStrictEqual({ id: pedidoDaEscola.id })
      expect(escola.cacheControl).toBe('no-store')
      escolas.push(pedidoDaEscola.id)

      const { rows: criadas } = await pool.query('select e.rede_id, e.nome, e.slug, r.nome as rede_nome, r.tipo from escola e join rede r on r.id = e.rede_id where e.id = $1', [pedidoDaEscola.id])
      expect(criadas).toEqual([{ rede_id: pedidoDaRede.id, nome: pedidoDaEscola.nome, slug: pedidoDaEscola.slug, rede_nome: pedidoDaRede.nome, tipo: 'prefeitura' }])
      expect((await auditoriaDe(pedidoDaRede.id)).rows).toEqual([{ acao: 'rede.criada', escola_id: null, autor_operador: sessao.apelido, autor_usuario_id: null }])
      expect((await auditoriaDe(pedidoDaEscola.id)).rows).toEqual([{ acao: 'escola.criada', escola_id: pedidoDaEscola.id, autor_operador: sessao.apelido, autor_usuario_id: null }])

      // A3: uma linha de cada evento, a da escola com o id dela; nenhuma linha do log leva nome ou endereço.
      expect(linhasComEvento('operacao.rede.criada')).toHaveLength(1)
      expect(linhasComEvento('operacao.escola.criada')).toEqual([expect.objectContaining({ escolaId: pedidoDaEscola.id })])
      const todoOLog = linhasDeLog.join('\n')
      for (const sentinela of [pedidoDaRede.nome, pedidoDaEscola.nome, pedidoDaEscola.slug, sessao.nome]) expect(todoOLog).not.toContain(sentinela)
    })

    it('GET /v1/operacao/redes: a rede criada, só com id, nome e tipo, e nunca mais que 200', async () => {
      const sessao = await operadores.operadorComSessao()
      // O nome vem antes, na ordem por nome, das redes que outros testes e o e2e deixam no banco, quantas forem.
      const pedido = novaRede(nomeQueVemPrimeiro('Rede Sintética'))
      expect((await pedir(url, 'POST', '/v1/operacao/redes', sessao.token, pedido)).status).toBe(201)
      redes.push(pedido.id)
      const redeId = pedido.id
      const lidas = await pedir(url, 'GET', '/v1/operacao/redes', sessao.token)
      expect(lidas.status).toBe(200)
      expect(lidas.cacheControl).toBe('no-store')
      expect(redesDoPainelResponseSchema.safeParse(lidas.corpo).success).toBe(true)
      const { itens } = lidas.corpo as { itens: { id: string }[] }
      expect(itens.find((item) => item.id === redeId)).toStrictEqual({ id: redeId, nome: pedido.nome, tipo: 'prefeitura' })

      // Com mais de 200 no banco, a lista para em 200.
      const { rows } = await pool.query<{ id: string }>(
        `insert into rede (nome, tipo) select 'Rede Sintética em Massa ' || n, 'grupo' from generate_series(1, $1::int) as n returning id`,
        [MAXIMO_DE_REDES_DO_PAINEL + 1],
      )
      redes.push(...rows.map((linha) => linha.id))
      const cheia = await pedir(url, 'GET', '/v1/operacao/redes', sessao.token)
      expect(cheia.status).toBe(200)
      expect((cheia.corpo as { itens: unknown[] }).itens).toHaveLength(MAXIMO_DE_REDES_DO_PAINEL)
      await pool.query('delete from rede where id = any($1::uuid[])', [rows.map((linha) => linha.id)])
    })
  })

  describe('E2: o mesmo pedido duas vezes, ao mesmo tempo, cria uma vez e responde o mesmo id', () => {
    it('POST /redes: o segundo espera o primeiro no índice do id e responde o mesmo id, com uma linha e uma auditoria', async () => {
      const sessao = await operadores.operadorComSessao()
      const gatilho = new GatilhoDeParada(pool, { tabela: 'rede', evento: 'insert', quando: `new.nome like 'Rede Parada %'` })
      await gatilho.armar()
      try {
        const pedido = novaRede(`Rede Parada ${randomUUID().slice(0, 8)}`)
        redes.push(pedido.id)
        linhasDeLog.length = 0
        const primeira = pedir(url, 'POST', '/v1/operacao/redes', sessao.token, pedido)
        await gatilho.esperarParadas()
        const segunda = pedir(url, 'POST', '/v1/operacao/redes', sessao.token, pedido)
        // O segundo insert achou a linha do primeiro, ainda sem commit, e espera a transação dele.
        await esperarNaTrava(pool, '%insert into "rede"%')
        await gatilho.soltar()
        const respostas = await Promise.all([primeira, segunda])
        expect(respostas.map((resposta) => resposta.status)).toEqual([201, 201])
        expect(respostas.map((resposta) => resposta.corpo)).toEqual([{ id: pedido.id }, { id: pedido.id }])
        expect(await contar('select 1 from rede where id = $1', [pedido.id])).toBe(1)
        expect((await auditoriaDe(pedido.id)).rows).toHaveLength(1)
        expect(linhasComEvento('operacao.rede.criada')).toHaveLength(1)
      } finally {
        await gatilho.desarmar()
      }
    })

    it('POST /escolas: o mesmo, esperando nos índices do id e do slug', async () => {
      const sessao = await operadores.operadorComSessao()
      const redeId = await criarRedePeloPainel(sessao)
      const gatilho = new GatilhoDeParada(pool, { tabela: 'escola', evento: 'insert', quando: `new.slug like 'parada-%'` })
      await gatilho.armar()
      try {
        const pedido = novaEscola(redeId, `parada-${randomUUID().slice(0, 12)}`)
        escolas.push(pedido.id)
        linhasDeLog.length = 0
        const primeira = pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedido)
        await gatilho.esperarParadas()
        const segunda = pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedido)
        await esperarNaTrava(pool, '%insert into "escola"%')
        await gatilho.soltar()
        const respostas = await Promise.all([primeira, segunda])
        expect(respostas.map((resposta) => resposta.status)).toEqual([201, 201])
        expect(respostas.map((resposta) => resposta.corpo)).toEqual([{ id: pedido.id }, { id: pedido.id }])
        expect(await contar('select 1 from escola where id = $1', [pedido.id])).toBe(1)
        expect((await auditoriaDe(pedido.id)).rows).toHaveLength(1)
        // O pedido repetido não loga de novo, como não audita de novo.
        expect(linhasComEvento('operacao.escola.criada')).toEqual([expect.objectContaining({ escolaId: pedido.id })])
      } finally {
        await gatilho.desarmar()
      }
    })

    it('o pedido repetido depois do primeiro, fora de corrida, também responde o mesmo id sem auditoria nova', async () => {
      const sessao = await operadores.operadorComSessao()
      const redeId = await criarRedePeloPainel(sessao)
      const pedido = novaEscola(redeId)
      escolas.push(pedido.id)
      for (let vez = 0; vez < 2; vez++) expect(await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedido)).toMatchObject({ status: 201, corpo: { id: pedido.id } })
      expect((await auditoriaDe(pedido.id)).rows).toHaveLength(1)
    })
  })

  describe('E3, E4 e E5: o que não é o mesmo pedido', () => {
    it('E3: o mesmo id com outros dados é CONFLITO, sem linha nova nem auditoria, na rede e na escola', async () => {
      const sessao = await operadores.operadorComSessao()
      const pedidoDaRede = novaRede()
      expect((await pedir(url, 'POST', '/v1/operacao/redes', sessao.token, pedidoDaRede)).status).toBe(201)
      redes.push(pedidoDaRede.id)
      esperarErro(await pedir(url, 'POST', '/v1/operacao/redes', sessao.token, { ...pedidoDaRede, nome: `${pedidoDaRede.nome} Outra` }), 409, ErrorCode.CONFLITO)
      esperarErro(await pedir(url, 'POST', '/v1/operacao/redes', sessao.token, { ...pedidoDaRede, tipo: 'grupo' }), 409, ErrorCode.CONFLITO)
      expect((await pool.query('select nome, tipo from rede where id = $1', [pedidoDaRede.id])).rows).toEqual([{ nome: pedidoDaRede.nome, tipo: 'prefeitura' }])
      expect((await auditoriaDe(pedidoDaRede.id)).rows).toHaveLength(1)

      const outraRede = await criarRedePeloPainel(sessao)
      const pedidoDaEscola = novaEscola(pedidoDaRede.id)
      expect((await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedidoDaEscola)).status).toBe(201)
      escolas.push(pedidoDaEscola.id)
      const outroSlug = `outro-${randomUUID().slice(0, 12)}`
      for (const diferente of [{ slug: outroSlug }, { nome: 'Colégio Sintético Outro' }, { redeId: outraRede }]) {
        esperarErro(await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, { ...pedidoDaEscola, ...diferente }), 409, ErrorCode.CONFLITO)
      }
      expect((await pool.query('select rede_id, nome, slug from escola where id = $1', [pedidoDaEscola.id])).rows).toEqual([
        { rede_id: pedidoDaRede.id, nome: pedidoDaEscola.nome, slug: pedidoDaEscola.slug },
      ])
      expect(await contar('select 1 from escola where slug = $1', [outroSlug])).toBe(0)
      expect((await auditoriaDe(pedidoDaEscola.id)).rows).toHaveLength(1)
    })

    it('E4: ids diferentes com o mesmo slug, ao mesmo tempo: um cria, o outro espera no índice do slug e recebe CONFLITO, nunca 500', async () => {
      const sessao = await operadores.operadorComSessao()
      const redeId = await criarRedePeloPainel(sessao)
      const gatilho = new GatilhoDeParada(pool, { tabela: 'escola', evento: 'insert', quando: `new.slug like 'disputa-%'` })
      await gatilho.armar()
      try {
        const slug = `disputa-${randomUUID().slice(0, 12)}`
        const primeiro = novaEscola(redeId, slug)
        const segundo = novaEscola(redeId, slug)
        escolas.push(primeiro.id, segundo.id)
        const primeira = pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, primeiro)
        await gatilho.esperarParadas()
        const segunda = pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, segundo)
        await esperarNaTrava(pool, '%insert into "escola"%')
        await gatilho.soltar()
        const [criou, perdeu] = await Promise.all([primeira, segunda])
        expect(criou).toMatchObject({ status: 201, corpo: { id: primeiro.id } })
        esperarErro(perdeu, 409, ErrorCode.CONFLITO)
        expect((await pool.query('select id from escola where slug = $1', [slug])).rows).toEqual([{ id: primeiro.id }])
        expect((await auditoriaDe(primeiro.id)).rows).toHaveLength(1)
        expect((await auditoriaDe(segundo.id)).rows).toHaveLength(0)
      } finally {
        await gatilho.desarmar()
      }
    })

    it('E4, fora de corrida: slug de outra escola é CONFLITO', async () => {
      const sessao = await operadores.operadorComSessao()
      const redeId = await criarRedePeloPainel(sessao)
      const original = novaEscola(redeId)
      expect((await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, original)).status).toBe(201)
      escolas.push(original.id)
      const repetido = novaEscola(redeId, original.slug)
      esperarErro(await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, repetido), 409, ErrorCode.CONFLITO)
      expect(await contar('select 1 from escola where id = $1', [repetido.id])).toBe(0)
    })

    it('E5: rede inexistente é NAO_ENCONTRADO, sem escola nem auditoria', async () => {
      const sessao = await operadores.operadorComSessao()
      const pedido = novaEscola(randomUUID())
      esperarErro(await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedido), 404, ErrorCode.NAO_ENCONTRADO)
      expect(await contar('select 1 from escola where id = $1 or slug = $2', [pedido.id, pedido.slug])).toBe(0)
      expect((await auditoriaDe(pedido.id)).rows).toHaveLength(0)
    })
  })

  describe('E12: o corpo não escolhe o autor', () => {
    it('corpo com autor, ou qualquer campo a mais, é 400 ENTRADA_INVALIDA, sem linha nem auditoria', async () => {
      const sessao = await operadores.operadorComSessao()
      const pedidoDaRede = novaRede()
      esperarErro(await pedir(url, 'POST', '/v1/operacao/redes', sessao.token, { ...pedidoDaRede, autor: 'outra-pessoa' }), 400, ErrorCode.ENTRADA_INVALIDA)
      expect(await contar('select 1 from rede where id = $1', [pedidoDaRede.id])).toBe(0)
      expect((await auditoriaDe(pedidoDaRede.id)).rows).toHaveLength(0)

      const redeId = await criarRedePeloPainel(sessao)
      const pedidoDaEscola = novaEscola(redeId)
      for (const aMais of [{ autor: 'outra-pessoa' }, { autorOperador: 'outra-pessoa' }, { escolaId: randomUUID() }]) {
        esperarErro(await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, { ...pedidoDaEscola, ...aMais }), 400, ErrorCode.ENTRADA_INVALIDA)
      }
      expect(await contar('select 1 from escola where id = $1', [pedidoDaEscola.id])).toBe(0)
      expect((await auditoriaDe(pedidoDaEscola.id)).rows).toHaveLength(0)
      expect(await contar(`select 1 from auditoria where autor_operador = 'outra-pessoa'`, [])).toBe(0)
    })
  })

  describe('16.0: a consulta da lista e do uso passa pelo ZodValidationPipe', () => {
    it('ordem fora da lista, página zero e campo a mais são 400 ENTRADA_INVALIDA em /escolas e em /uso, e a consulta válida responde 200', async () => {
      const sessao = await operadores.operadorComSessao()
      for (const caminho of ['/v1/operacao/escolas', '/v1/operacao/uso']) {
        for (const consulta of ['ordem=aluno', 'pagina=0', `escolaId=${randomUUID()}`]) {
          esperarErro(await pedir(url, 'GET', `${caminho}?${consulta}`, sessao.token), 400, ErrorCode.ENTRADA_INVALIDA)
        }
        expect((await pedir(url, 'GET', `${caminho}?ordem=nome`, sessao.token)).status, caminho).toBe(200)
      }
    })
  })

  describe('E11: o autor desativado no meio da escrita', () => {
    it('pelo painel, com o desativar segurando a linha: a escrita espera o for share e responde 401 SESSAO_ENCERRADA sem gravar', async () => {
      const sessao = await operadores.operadorComSessao()
      const redeId = await criarRedePeloPainel(sessao)
      const pedido = novaEscola(redeId)
      escolas.push(pedido.id)
      const desativar = await segurarODesativar(sessao.operadorId)
      try {
        const escrita = pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedido)
        await esperarNaTrava(pool, ESPERA_DO_AUTOR)
        await desativar.confirmar()
        esperarErro(await escrita, 401, ErrorCode.SESSAO_ENCERRADA)
      } finally {
        await desativar.desfazer()
      }
      expect(await contar('select 1 from escola where id = $1 or slug = $2', [pedido.id, pedido.slug])).toBe(0)
      expect((await auditoriaDe(pedido.id)).rows).toHaveLength(0)
    })

    it('pelo painel, com a escrita segurando o for share: o desativar espera, e a escrita entra com a auditoria', async () => {
      const [sessao, quemDesativa] = await Promise.all([operadores.operadorComSessao(), operadores.operador()])
      const redeId = await criarRedePeloPainel(sessao)
      const gatilho = new GatilhoDeParada(pool, { tabela: 'escola', evento: 'insert', quando: `new.slug like 'antes-do-desativar-%'` })
      await gatilho.armar()
      try {
        const pedido = novaEscola(redeId, `antes-do-desativar-${randomUUID().slice(0, 12)}`)
        escolas.push(pedido.id)
        const escrita = pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedido)
        await gatilho.esperarParadas()
        // O `desativar` de verdade, pelo mesmo caso de uso do `ops:operador`: a linha do alvo está em `for share`.
        const desativacao = desativarOperador(banco, quemDesativa.apelido, sessao.apelido)
        await esperarNaTrava(pool, '%from "operador"%for update%')
        await gatilho.soltar()
        expect(await escrita).toMatchObject({ status: 201, corpo: { id: pedido.id } })
        await desativacao
        expect((await auditoriaDe(pedido.id)).rows).toEqual([{ acao: 'escola.criada', escola_id: pedido.id, autor_operador: sessao.apelido, autor_usuario_id: null }])
        expect((await pool.query('select desativado_em is not null as desativado from operador where id = $1', [sessao.operadorId])).rows).toEqual([{ desativado: true }])
      } finally {
        await gatilho.desarmar()
      }
    })

    describe('pelos cinco ops:* de escola: cada um espera o for share do OPERADOR e, com o desativar confirmado, sai com 2 sem gravar', () => {
      type Comando = (argumentos: string[], ambiente: Record<string, string | undefined>, terminal: SaidaDoComando, abrirBanco?: (ambiente: Record<string, string | undefined>) => BancoDoComando) => Promise<number>
      interface Caso {
        readonly nome: string
        readonly comando: Comando
        /** Prepara o que o comando mexeria, e devolve os argumentos e a conferência de que nada mudou. */
        readonly preparar: () => Promise<{ argumentos: string[]; nadaGravado: () => Promise<void> }>
      }

      const casos: Caso[] = [
        {
          nome: 'escola',
          comando: executarOpsEscola,
          preparar: async () => {
            const nome = `Rede Sintética do Comando ${randomUUID().slice(0, 8)}`
            return {
              argumentos: ['rede', 'criar', '--nome', nome, '--tipo', 'grupo'],
              nadaGravado: async () => expect(await contar('select 1 from rede where nome = $1', [nome])).toBe(0),
            }
          },
        },
        {
          nome: 'convite-coordenador',
          comando: executarOpsConviteCoordenador,
          preparar: async () => {
            const escolaId = await escolasDaBancada.escola()
            const email = `coordenacao-${randomUUID()}@escola.invalid`
            const saida = join(pasta, `token-${randomUUID()}.txt`)
            return {
              argumentos: ['--escola', await escolasDaBancada.slugDe(escolaId), '--email', email, '--nome', 'Coordenação Sintética', '--saida', saida],
              nadaGravado: async () => {
                expect(await contar('select 1 from conta where email = $1', [email])).toBe(0)
                expect(await contar('select 1 from convite where escola_id = $1', [escolaId])).toBe(0)
                expect(await contar('select 1 from auditoria where escola_id = $1 and acao = $2', [escolaId, 'convite.criado'])).toBe(0)
                expect(existsSync(saida)).toBe(false)
              },
            }
          },
        },
        {
          nome: 'revogar-convite',
          comando: executarOpsRevogarConvite,
          preparar: async () => {
            const escolaId = await escolasDaBancada.escola()
            escolasComConvite.push(escolaId)
            const { conviteId } = await criarConviteDeCoordenador(banco, autorDaBancada, {
              slug: await escolasDaBancada.slugDe(escolaId),
              email: `coordenacao-${randomUUID()}@escola.invalid`,
              nome: 'Coordenação Sintética',
            })
            return {
              argumentos: ['--convite', conviteId],
              nadaGravado: async () => {
                expect((await pool.query('select revogado_em from convite where id = $1', [conviteId])).rows).toEqual([{ revogado_em: null }])
                expect(await contar('select 1 from auditoria where entidade_id = $1 and acao = $2', [conviteId, 'convite.revogado'])).toBe(0)
              },
            }
          },
        },
        {
          nome: 'redefinir-mfa',
          comando: executarOpsRedefinirMfa,
          preparar: async () => {
            const escolaId = await escolasDaBancada.escola()
            const coordenador = await escolasDaBancada.sessao(escolaId, 'coordenador')
            return {
              argumentos: ['--usuario', coordenador.usuarioId, '--pedido', '12'],
              nadaGravado: async () => {
                // Sem a conferência, a redefinição encerraria a sessão da conta e gravaria a auditoria.
                expect((await pool.query('select encerrada_em from sessao where id = $1', [coordenador.sessaoId])).rows).toEqual([{ encerrada_em: null }])
                expect(await contar('select 1 from auditoria where escola_id = $1 and acao = $2', [escolaId, 'usuario.mfa_redefinido'])).toBe(0)
              },
            }
          },
        },
        {
          nome: 'uso',
          comando: executarOpsUso,
          preparar: async () => ({ argumentos: ['--escola', await escolasDaBancada.escola()], nadaGravado: async () => undefined }),
        },
      ]

      it.each(casos)('ops:$nome', async ({ comando, preparar }) => {
        // Outro operador ativo: sem ele, o desativado cairia no nascimento (nenhum ativo) e passaria.
        const [quemRoda] = await Promise.all([operadores.operador(), operadores.operador()])
        const { argumentos, nadaGravado } = await preparar()
        let saida = ''
        let erro = ''
        const terminal: SaidaDoComando = { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) }
        const ambiente = { ...lerAmbienteDeTeste(), OPERADOR: quemRoda.apelido, BANCO_TIMEOUT_CONSULTA_MS: String(PRAZO_DAS_CONSULTAS_MS) }
        const desativar = await segurarODesativar(quemRoda.operadorId)
        try {
          const execucao = comando(argumentos, ambiente, terminal)
          await esperarNaTrava(pool, ESPERA_DO_AUTOR)
          await desativar.confirmar()
          expect(await execucao).toBe(2)
        } finally {
          await desativar.desfazer()
        }
        expect({ saida, erro }).toEqual({ saida: '', erro: RECUSA_DO_OPERADOR })
        await nadaGravado()
      })
    })
  })

  describe('E14: o limite do operador no POST /escolas', () => {
    const LIMITE = 3
    let appLimitado: INestApplication
    let urlLimitada: string

    beforeAll(async () => {
      ;({ app: appLimitado, url: urlLimitada } = await subir([], { LIMITE_REQ_OPERADOR_MIN: String(LIMITE) }))
    })

    afterAll(async () => {
      await appLimitado.close()
    })

    it('acima do rl:op do operador, 429 LIMITE_EXCEDIDO com Retry-After, e a escola não nasce', async () => {
      const sessao = await operadores.operadorComSessao()
      // A rede nasce por fora da API: o limite é do operador, e todo pedido dele conta.
      const { rows } = await pool.query<{ id: string }>(`insert into rede (nome, tipo) values ('Rede Sintética do Limite', 'grupo') returning id`)
      const redeId = rows[0]?.id ?? ''
      redes.push(redeId)
      for (let vez = 0; vez < LIMITE; vez++) {
        const pedido = novaEscola(redeId)
        escolas.push(pedido.id)
        expect((await pedir(urlLimitada, 'POST', '/v1/operacao/escolas', sessao.token, pedido)).status).toBe(201)
      }
      const recusado = novaEscola(redeId)
      const resposta = await pedir(urlLimitada, 'POST', '/v1/operacao/escolas', sessao.token, recusado)
      esperarErro(resposta, 429, ErrorCode.LIMITE_EXCEDIDO)
      expect(Number(resposta.retryAfter)).toBeGreaterThanOrEqual(1)
      expect(await contar('select 1 from escola where id = $1', [recusado.id])).toBe(0)
    })
  })
})
