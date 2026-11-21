import { createDatabase, createPool, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, criadoNoPainelResponseSchema, orcamentoDeIaDoPainelSchema, redesDoPainelResponseSchema, MAXIMO_DE_REDES_DO_PAINEL } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import type { CommandDatabase, CommandOutput } from '../src/ops/command.js'
import { runOpsConviteCoordenador } from '../src/ops/convite-coordenador.js'
import { runOpsEscola } from '../src/ops/escola.js'
import { desativarOperador } from '../src/ops/operador.js'
import { runOpsRedefinirMfa } from '../src/ops/redefinir-mfa.js'
import { runOpsRevogarConvite } from '../src/ops/revogar-convite.js'
import { runOpsUso } from '../src/ops/uso.js'
import { createConviteDeCoordenador } from '../src/sessao/index.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'
import { ESPERA_DO_AUTOR, esperarErro, nomeQueVemPrimeiro, pedir, PRAZO_DAS_CONSULTAS_MS, segurarODesativar as segurarODesativarNoBanco, subirApiDoPainel as subir } from './painel.fixture.js'
import { OperadorFixtures, type TestOperadorSessao } from './operador-session.fixture.js'
import { autorDaBancada, SessaoFixtures } from './sessao.fixture.js'

/**
 * A escrita do painel da operação (A0b, tarefa 1.0): `POST /v1/operacao/redes` e `/escolas`, e o autor conferido dentro
 * da transação, no painel e nos cinco `ops:*` de escola. Cenários de `tasks/prd-apresentacao-painel/cenarios.md`: E1–E5,
 * E11 (criar escola e os cinco comandos), E12, E14 e A3 (rede e escola). Postgres e Redis reais do compose de teste.
 */

const RECUSA_DO_OPERADOR = 'OPERADOR não é um operador ativo da equipe\n'

describe('painel da operação: rede e escola, com o autor conferido na transação (tarefa 1.0)', () => {
  const operadores = new OperadorFixtures()
  const escolasDaBancada = new SessaoFixtures()
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

  async function criarRedePeloPainel(sessao: TestOperadorSessao): Promise<string> {
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
    await pool.query('delete from configuracao_operacional_escola where escola_id = any($1::uuid[])', [escolas])
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

    it('GET /v1/operacao/redes: a rede criada, só com id, nome, tipo, o orçamento e a contagem, e nunca mais que 200', async () => {
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
      expect(itens.find((item) => item.id === redeId)).toStrictEqual({
        id: redeId,
        nome: pedido.nome,
        tipo: 'prefeitura',
        orcamento: {
          proprio: { valorPorAlunoMicros: null, tetoDeSegurancaPercentual: null },
          vigente: { valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoDeSegurancaPercentual: 200, origemDoTeto: 'padrao' },
        },
        escolasQueUsamOValorDaRede: 0,
      })

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
      const gatilho = new WriteBlockTrigger(pool, { tabela: 'rede', evento: 'insert', quando: `new.nome like 'Rede Parada %'` })
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
      const gatilho = new WriteBlockTrigger(pool, { tabela: 'escola', evento: 'insert', quando: `new.slug like 'parada-%'` })
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
      const gatilho = new WriteBlockTrigger(pool, { tabela: 'escola', evento: 'insert', quando: `new.slug like 'disputa-%'` })
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
      const gatilho = new WriteBlockTrigger(pool, { tabela: 'escola', evento: 'insert', quando: `new.slug like 'antes-do-desativar-%'` })
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
      type Comando = (argumentos: string[], ambiente: Record<string, string | undefined>, terminal: CommandOutput, abrirBanco?: (ambiente: Record<string, string | undefined>) => CommandDatabase) => Promise<number>
      interface Caso {
        readonly nome: string
        readonly comando: Comando
        /** Prepara o que o comando mexeria, e devolve os argumentos e a conferência de que nada mudou. */
        readonly preparar: () => Promise<{ argumentos: string[]; nadaGravado: () => Promise<void> }>
      }

      const casos: Caso[] = [
        {
          nome: 'escola',
          comando: runOpsEscola,
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
          comando: runOpsConviteCoordenador,
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
          comando: runOpsRevogarConvite,
          preparar: async () => {
            const escolaId = await escolasDaBancada.escola()
            escolasComConvite.push(escolaId)
            const { conviteId } = await createConviteDeCoordenador(banco, autorDaBancada, {
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
          comando: runOpsRedefinirMfa,
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
          comando: runOpsUso,
          preparar: async () => ({ argumentos: ['--escola', await escolasDaBancada.escola()], nadaGravado: async () => undefined }),
        },
      ]

      it.each(casos)('ops:$nome', async ({ comando, preparar }) => {
        // Outro operador ativo: sem ele, o desativado cairia no nascimento (nenhum ativo) e passaria.
        const [quemRoda] = await Promise.all([operadores.operador(), operadores.operador()])
        const { argumentos, nadaGravado } = await preparar()
        let saida = ''
        let erro = ''
        const terminal: CommandOutput = { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) }
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


  /**
   * O orçamento de IA no painel (camada-ia, tarefa 3.0; `tasks/prd-camada-ia/cenarios.md`, RF7, §2 e §3): `PUT /v1/operacao/escolas/:id/orcamento-ia` e `/redes/:id/orcamento-ia`, com a auditoria só quando o
   * valor muda, a trava da linha nas corridas, o isolamento entre escolas e entre redes e o 404 do que não existe.
   */
  describe('camada-ia 3.0: o orçamento de IA da escola e da rede', () => {
    const corpo = (valorPorAlunoCentavos: number | null, tetoDeSegurancaPercentual: number | null) => ({ valorPorAlunoCentavos, tetoDeSegurancaPercentual })
    const orcamentoDaEscola = (id: string, token: string, pedido: unknown) => pedir(url, 'PUT', `/v1/operacao/escolas/${id}/orcamento-ia`, token, pedido)
    const orcamentoDaRede = (id: string, token: string, pedido: unknown) => pedir(url, 'PUT', `/v1/operacao/redes/${id}/orcamento-ia`, token, pedido)
    const propria = (valorPorAlunoMicros: number | null, tetoDeSegurancaPercentual: number | null) => ({ valorPorAlunoMicros, tetoDeSegurancaPercentual })
    const vigente = (valorPorAlunoMicros: number | null, origemDoValor: string, tetoDeSegurancaPercentual: number, origemDoTeto: string) => ({ valorPorAlunoMicros, origemDoValor, tetoDeSegurancaPercentual, origemDoTeto })

    const configuracaoDaEscola = async (escolaId: string) =>
      (await pool.query<{ valor: string | null; teto: number | null }>('select ia_valor_por_aluno_micros::text as valor, ia_teto_de_seguranca_percentual as teto from configuracao_operacional_escola where escola_id = $1', [escolaId])).rows
    const configuracaoDaRede = async (redeId: string) =>
      (await pool.query<{ valor: string | null; teto: number | null }>('select ia_valor_por_aluno_micros::text as valor, ia_teto_de_seguranca_percentual as teto from rede where id = $1', [redeId])).rows
    const auditoriaDoOrcamento = (entidadeId: string) =>
      pool.query<{ acao: string; escola_id: string | null; autor_operador: string | null; autor_usuario_id: string | null; antes: unknown; depois: unknown }>(
        'select acao, escola_id, autor_operador, autor_usuario_id, antes, depois from auditoria where entidade_id = $1 and acao like $2 order by em, id',
        [entidadeId, '%.orcamento_ia_alterado'],
      )

    /** Uma rede e uma escola nela, criadas pelo painel: a escola nasce sem linha em `configuracao_operacional_escola` e sem ano letivo. */
    async function redeEEscola(sessao: TestOperadorSessao): Promise<{ redeId: string; escolaId: string }> {
      const redeId = await criarRedePeloPainel(sessao)
      const pedido = novaEscola(redeId)
      expect((await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedido)).status).toBe(201)
      escolas.push(pedido.id)
      return { redeId, escolaId: pedido.id }
    }

    describe('RF7: o PUT da escola grava em micros, audita com o operador e só audita quando muda', () => {
      it('a primeira gravação cria a linha da escola sem ano em curso, devolve o próprio e o vigente, e audita o antes e o depois com o apelido da sessão', async () => {
        const sessao = await operadores.operadorComSessao()
        const { escolaId } = await redeEEscola(sessao)
        expect(await configuracaoDaEscola(escolaId)).toEqual([])
        // O cenário é o da escola sem ano `em_curso`: se a criação da escola passar a abrir um ano, o caso deixa de cobri-lo, e isto avisa.
        expect((await pool.query('select 1 from ano_letivo where escola_id = $1', [escolaId])).rows).toEqual([])
        linhasDeLog.length = 0

        const resposta = await orcamentoDaEscola(escolaId, sessao.token, corpo(300, 150))
        expect(resposta.status).toBe(200)
        expect(resposta.cacheControl).toBe('no-store')
        expect(orcamentoDeIaDoPainelSchema.parse(resposta.corpo)).toStrictEqual({ proprio: propria(3_000_000, 150), vigente: vigente(3_000_000, 'escola', 150, 'escola') })
        expect(await configuracaoDaEscola(escolaId)).toEqual([{ valor: '3000000', teto: 150 }])
        expect((await auditoriaDoOrcamento(escolaId)).rows).toEqual([
          { acao: 'escola.orcamento_ia_alterado', escola_id: escolaId, autor_operador: sessao.apelido, autor_usuario_id: null, antes: propria(null, null), depois: propria(3_000_000, 150) },
        ])
        // O log leva o evento e a escola, nunca o valor.
        expect(linhasComEvento('operacao.escola.orcamento_ia_alterado')).toEqual([expect.objectContaining({ escolaId })])
        // O valor nunca vai ao log, em micros nem em centavos, nem o teto: o pedido era 300 centavos e 150%.
        const logDaEscola = linhasDeLog.join('\n')
        for (const valor of ['3000000', 'valorPorAlunoCentavos', 'tetoDeSegurancaPercentual']) expect(logDaEscola).not.toContain(valor)
        // E nenhum campo numérico do evento leva os 300 centavos nem os 150%.
        expect(JSON.stringify(linhasComEvento('operacao.escola.orcamento_ia_alterado'))).not.toMatch(/:\s*(300|150)\b/)
      })

      it('o mesmo PUT de novo não grava nem audita; mudar só o teto, só o valor, ou voltar a nulo, audita cada um', async () => {
        const sessao = await operadores.operadorComSessao()
        const { escolaId } = await redeEEscola(sessao)
        const auditorias = async () => (await auditoriaDoOrcamento(escolaId)).rows
        linhasDeLog.length = 0

        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(300, 150))).status).toBe(200)
        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(300, 150))).status).toBe(200)
        expect(await auditorias()).toHaveLength(1)

        // Só o teto: o valor é o mesmo.
        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(300, 400))).status).toBe(200)
        expect((await auditorias()).map((registro) => registro.depois)).toEqual([propria(3_000_000, 150), propria(3_000_000, 400)])
        // Só o valor: o teto é o mesmo.
        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(450, 400))).status).toBe(200)
        expect((await auditorias()).map((registro) => registro.depois)).toEqual([propria(3_000_000, 150), propria(3_000_000, 400), propria(4_500_000, 400)])
        // Nulo nos dois: a escola volta a valer a rede (que aqui não definiu nada) e o padrão.
        const volta = await orcamentoDaEscola(escolaId, sessao.token, corpo(null, null))
        expect(volta.corpo).toStrictEqual({ proprio: propria(null, null), vigente: vigente(null, 'nenhuma', 200, 'padrao') })
        const registros = await auditorias()
        expect(registros).toHaveLength(4)
        expect(registros[3]).toMatchObject({ antes: propria(4_500_000, 400), depois: propria(null, null) })
        expect(await configuracaoDaEscola(escolaId)).toEqual([{ valor: null, teto: null }])
        // O log segue a auditoria: um evento por mudança, nenhum para o PUT repetido.
        expect(linhasComEvento('operacao.escola.orcamento_ia_alterado')).toHaveLength(4)
      })

      it('o valor da escola vale sobre o da rede, coluna a coluna: escola sem valor usa o da rede, escola só com o teto usa o valor da rede e o teto dela', async () => {
        const sessao = await operadores.operadorComSessao()
        const { redeId, escolaId } = await redeEEscola(sessao)
        expect((await orcamentoDaRede(redeId, sessao.token, corpo(500, 300))).status).toBe(200)

        const semNada = await orcamentoDaEscola(escolaId, sessao.token, corpo(null, null))
        expect(semNada.corpo).toStrictEqual({ proprio: propria(null, null), vigente: vigente(5_000_000, 'rede', 300, 'rede') })
        const soOTeto = await orcamentoDaEscola(escolaId, sessao.token, corpo(null, 150))
        expect(soOTeto.corpo).toStrictEqual({ proprio: propria(null, 150), vigente: vigente(5_000_000, 'rede', 150, 'escola') })
        const soOValor = await orcamentoDaEscola(escolaId, sessao.token, corpo(300, null))
        expect(soOValor.corpo).toStrictEqual({ proprio: propria(3_000_000, null), vigente: vigente(3_000_000, 'escola', 300, 'rede') })
      })
    })

    describe('RF7: o PUT da rede audita sem escola, só quando muda', () => {
      it('rede.orcamento_ia_alterado com escola nula, o antes, o depois e o operador; o mesmo PUT de novo não audita', async () => {
        const sessao = await operadores.operadorComSessao()
        const redeId = await criarRedePeloPainel(sessao)
        linhasDeLog.length = 0

        const resposta = await orcamentoDaRede(redeId, sessao.token, corpo(500, null))
        expect(resposta.status).toBe(200)
        expect(resposta.cacheControl).toBe('no-store')
        expect(orcamentoDeIaDoPainelSchema.parse(resposta.corpo)).toStrictEqual({ proprio: propria(5_000_000, null), vigente: vigente(5_000_000, 'rede', 200, 'padrao') })
        expect(await configuracaoDaRede(redeId)).toEqual([{ valor: '5000000', teto: null }])
        expect((await orcamentoDaRede(redeId, sessao.token, corpo(500, null))).status).toBe(200)
        expect((await auditoriaDoOrcamento(redeId)).rows).toEqual([
          { acao: 'rede.orcamento_ia_alterado', escola_id: null, autor_operador: sessao.apelido, autor_usuario_id: null, antes: propria(null, null), depois: propria(5_000_000, null) },
        ])
        expect(linhasComEvento('operacao.rede.orcamento_ia_alterado')).toHaveLength(1)
        const logDaRede = linhasDeLog.join('\n')
        for (const valor of ['5000000', 'valorPorAlunoCentavos', 'tetoDeSegurancaPercentual']) expect(logDaRede).not.toContain(valor)
        expect(JSON.stringify(linhasComEvento('operacao.rede.orcamento_ia_alterado'))).not.toMatch(/:\s*500\b/)

        // Só o teto muda; depois, só o valor; depois, nulo nos dois.
        expect((await orcamentoDaRede(redeId, sessao.token, corpo(500, 250))).status).toBe(200)
        expect((await orcamentoDaRede(redeId, sessao.token, corpo(400, 250))).status).toBe(200)
        const volta = await orcamentoDaRede(redeId, sessao.token, corpo(null, null))
        expect(volta.corpo).toStrictEqual({ proprio: propria(null, null), vigente: vigente(null, 'nenhuma', 200, 'padrao') })
        expect((await auditoriaDoOrcamento(redeId)).rows.map((registro) => registro.depois)).toEqual([propria(5_000_000, null), propria(5_000_000, 250), propria(4_000_000, 250), propria(null, null)])
      })
    })

    describe('RF7: os limites do valor e do teto, pela rota', () => {
      it('0, R$ 100,01, 99 e 1001, e o que não é o contrato, são ENTRADA_INVALIDA, sem gravar nem auditar; R$ 0,01, R$ 100,00, 100 e 1000 passam', async () => {
        const sessao = await operadores.operadorComSessao()
        const { redeId, escolaId } = await redeEEscola(sessao)
        const recusados: unknown[] = [corpo(0, 200), corpo(10_001, 200), corpo(500, 99), corpo(500, 1001), corpo(5.5, 200), { ...corpo(500, 200), autor: 'outra-pessoa' }, { valorPorAlunoCentavos: 500 }, { ...corpo(500, 200), escolaId: randomUUID() }, {}]
        for (const pedido of recusados) {
          esperarErro(await orcamentoDaEscola(escolaId, sessao.token, pedido), 400, ErrorCode.ENTRADA_INVALIDA)
          esperarErro(await orcamentoDaRede(redeId, sessao.token, pedido), 400, ErrorCode.ENTRADA_INVALIDA)
        }
        expect(await configuracaoDaEscola(escolaId)).toEqual([])
        expect(await configuracaoDaRede(redeId)).toEqual([{ valor: null, teto: null }])
        expect((await auditoriaDoOrcamento(escolaId)).rows).toHaveLength(0)
        expect((await auditoriaDoOrcamento(redeId)).rows).toHaveLength(0)

        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(1, 100))).corpo).toMatchObject({ proprio: propria(10_000, 100) })
        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(10_000, 1000))).corpo).toMatchObject({ proprio: propria(100_000_000, 1000) })
        expect((await orcamentoDaRede(redeId, sessao.token, corpo(1, 100))).corpo).toMatchObject({ proprio: propria(10_000, 100) })
        expect((await orcamentoDaRede(redeId, sessao.token, corpo(10_000, 1000))).corpo).toMatchObject({ proprio: propria(100_000_000, 1000) })
      })
    })

    describe('regra 10, item 6: o id que não existe responde como a rota que não existe', () => {
      it('escola e rede inexistentes, e id que não é UUID, são NAO_ENCONTRADO com o corpo da rota inexistente, sem linha nem auditoria', async () => {
        const sessao = await operadores.operadorComSessao()
        const inexistente = await pedir(url, 'PUT', `/v1/operacao/nao-existe-${randomUUID()}`, sessao.token, corpo(500, 200))
        esperarErro(inexistente, 404, ErrorCode.NAO_ENCONTRADO)
        const semRequisicao = (resposta: { corpo: unknown }) => {
          const { erro } = resposta.corpo as { erro: Record<string, unknown> }
          return { ...erro, requisicaoId: undefined }
        }
        const escolaInexistente = randomUUID()
        const redeInexistente = randomUUID()
        for (const resposta of [
          await orcamentoDaEscola(escolaInexistente, sessao.token, corpo(500, 200)),
          await orcamentoDaRede(redeInexistente, sessao.token, corpo(500, 200)),
          await orcamentoDaEscola('nao-e-uuid', sessao.token, corpo(500, 200)),
          await orcamentoDaRede('1837', sessao.token, corpo(500, 200)),
        ]) {
          esperarErro(resposta, 404, ErrorCode.NAO_ENCONTRADO)
          expect(semRequisicao(resposta)).toEqual(semRequisicao(inexistente))
        }
        expect(await configuracaoDaEscola(escolaInexistente)).toEqual([])
        expect((await auditoriaDoOrcamento(escolaInexistente)).rows).toHaveLength(0)
        expect((await auditoriaDoOrcamento(redeInexistente)).rows).toHaveLength(0)
      })
    })

    describe('isolamento: o PUT em uma escola ou em uma rede não muda a outra', () => {
      it('o PUT em A não muda a configuração de B, e o da rede 1 não muda a rede 2 nem o que vale para a escola B', async () => {
        const sessao = await operadores.operadorComSessao()
        // A escola A na rede 1, a escola B na rede 2: cada uma com configuração própria diferente, e cada rede com a sua.
        const redeA = await criarRedePeloPainel(sessao)
        const redeB = await criarRedePeloPainel(sessao)
        const pedidoA = { ...novaEscola(redeA), nome: nomeQueVemPrimeiro('Escola A do Orçamento') }
        const pedidoB = { ...novaEscola(redeB), nome: nomeQueVemPrimeiro('Escola B do Orçamento') }
        // A escola C, na rede 2 e sem linha de configuração: o que vale para ela é só o da rede 2.
        const pedidoC = { ...novaEscola(redeB), nome: nomeQueVemPrimeiro('Escola C do Orçamento') }
        for (const pedido of [pedidoA, pedidoB, pedidoC]) {
          expect((await pedir(url, 'POST', '/v1/operacao/escolas', sessao.token, pedido)).status).toBe(201)
          escolas.push(pedido.id)
        }
        expect((await orcamentoDaEscola(pedidoA.id, sessao.token, corpo(500, 200))).status).toBe(200)
        expect((await orcamentoDaEscola(pedidoB.id, sessao.token, corpo(100, 100))).status).toBe(200)
        expect((await orcamentoDaRede(redeA, sessao.token, corpo(900, 500))).status).toBe(200)
        expect((await orcamentoDaRede(redeB, sessao.token, corpo(200, 300))).status).toBe(200)

        // O PUT da escola A: só a linha dela.
        expect((await orcamentoDaEscola(pedidoA.id, sessao.token, corpo(250, 400))).status).toBe(200)
        expect(await configuracaoDaEscola(pedidoA.id)).toEqual([{ valor: '2500000', teto: 400 }])
        // O `antes` da auditoria é o de A (R$ 5, 200%), e não a linha de outra escola.
        expect((await auditoriaDoOrcamento(pedidoA.id)).rows[1]).toMatchObject({ antes: propria(5_000_000, 200), depois: propria(2_500_000, 400) })
        expect(await configuracaoDaEscola(pedidoB.id)).toEqual([{ valor: '1000000', teto: 100 }])
        // O PUT da rede 1: só a linha dela.
        expect((await orcamentoDaRede(redeA, sessao.token, corpo(700, 600))).status).toBe(200)
        expect(await configuracaoDaRede(redeA)).toEqual([{ valor: '7000000', teto: 600 }])
        expect(await configuracaoDaRede(redeB)).toEqual([{ valor: '2000000', teto: 300 }])
        // O que vale para B segue o dela e o da rede 2: a lista do painel (a primeira página, pelo nome).
        const lista = await pedir(url, 'GET', '/v1/operacao/escolas', sessao.token)
        const itens = (lista.corpo as { itens: { id: string; orcamento: unknown }[] }).itens
        expect(itens.find((item) => item.id === pedidoB.id)?.orcamento).toStrictEqual({ proprio: propria(1_000_000, 100), vigente: vigente(1_000_000, 'escola', 100, 'escola') })
        expect(itens.find((item) => item.id === pedidoA.id)?.orcamento).toStrictEqual({ proprio: propria(2_500_000, 400), vigente: vigente(2_500_000, 'escola', 400, 'escola') })
        // A escola sem linha da rede 2 segue o que a rede 2 define (R$ 2, 300%), e não o da rede 1 que acabou de mudar.
        expect(itens.find((item) => item.id === pedidoC.id)?.orcamento).toStrictEqual({ proprio: propria(null, null), vigente: vigente(2_000_000, 'rede', 300, 'rede') })
      })
    })

    describe('a coordenação, o professor e o aluno: a rota e a auditoria não são deles', () => {
      /** O `PUT` da escola ou da rede, com o token dado (o corpo é válido: quem recusa é a guarda, antes dele). */
      const orcamentoDaEscolaOuRede = (caminho: string, token: string) => pedir(url, 'PUT', caminho, token, corpo(500, 200))
      const semRequisicaoDe = (resposta: { corpo: unknown }) => {
        const { erro } = resposta.corpo as { erro: Record<string, unknown> }
        return { ...erro, requisicaoId: undefined }
      }

      it('com a sessão da própria escola, o PUT responde como a rota inexistente, e nenhuma leitura da governança devolve a auditoria do orçamento', async () => {
        const sessao = await operadores.operadorComSessao()
        const escolaId = await escolasDaBancada.escola()
        const coordenacao = await escolasDaBancada.sessao(escolaId, 'coordenador')
        const professor = await escolasDaBancada.sessao(escolaId, 'professor')
        const aluno = await escolasDaBancada.sessao(escolaId, 'aluno')
        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(500, 200))).status).toBe(200)

        const inexistente = await pedir(url, 'PUT', `/v1/operacao/nao-existe-${randomUUID()}`, coordenacao.token, corpo(500, 200))
        esperarErro(inexistente, 404, ErrorCode.NAO_ENCONTRADO)
        for (const quem of [coordenacao, professor, aluno]) {
          for (const caminho of [`/v1/operacao/escolas/${escolaId}/orcamento-ia`, `/v1/operacao/redes/${randomUUID()}/orcamento-ia`]) {
            const resposta = await orcamentoDaEscolaOuRede(caminho, quem.token)
            expect(resposta.status, caminho).toBe(404)
            // O corpo inteiro, menos o id da requisição, é o da rota que não existe.
            expect(semRequisicaoDe(resposta), caminho).toEqual(semRequisicaoDe(inexistente))
          }
        }
        // A auditoria é do operador: nenhuma pessoa da escola assina, e a leitura da coordenação não a traz.
        expect((await auditoriaDoOrcamento(escolaId)).rows).toEqual([expect.objectContaining({ autor_usuario_id: null, autor_operador: sessao.apelido })])
        for (const caminho of ['/v1/governanca/resumo', '/v1/governanca/funcoes', '/v1/governanca/consumo']) {
          const lida = await pedir(url, 'GET', caminho, coordenacao.token)
          expect(lida.status, caminho).toBe(200)
          expect(lida.texto, caminho).not.toContain('orcamento_ia_alterado')
          expect(lida.texto, caminho).not.toContain(sessao.apelido)
        }
      })
    })

    describe('E11: o autor desativado no meio do PUT', () => {
      it('escola: com o desativar segurando a linha do operador, o PUT espera o for share e responde 401 SESSAO_ENCERRADA, sem linha nem auditoria', async () => {
        const sessao = await operadores.operadorComSessao()
        const { escolaId } = await redeEEscola(await operadores.operadorComSessao())
        const desativar = await segurarODesativar(sessao.operadorId)
        try {
          const escrita = orcamentoDaEscola(escolaId, sessao.token, corpo(300, 150))
          await esperarNaTrava(pool, ESPERA_DO_AUTOR)
          await desativar.confirmar()
          esperarErro(await escrita, 401, ErrorCode.SESSAO_ENCERRADA)
        } finally {
          await desativar.desfazer()
        }
        expect(await configuracaoDaEscola(escolaId)).toEqual([])
        expect((await auditoriaDoOrcamento(escolaId)).rows).toHaveLength(0)
      })

      it('rede: o mesmo, sem gravar o orçamento nem auditar', async () => {
        const sessao = await operadores.operadorComSessao()
        const redeId = await criarRedePeloPainel(await operadores.operadorComSessao())
        const desativar = await segurarODesativar(sessao.operadorId)
        try {
          const escrita = orcamentoDaRede(redeId, sessao.token, corpo(300, 150))
          await esperarNaTrava(pool, ESPERA_DO_AUTOR)
          await desativar.confirmar()
          esperarErro(await escrita, 401, ErrorCode.SESSAO_ENCERRADA)
        } finally {
          await desativar.desfazer()
        }
        expect(await configuracaoDaRede(redeId)).toEqual([{ valor: null, teto: null }])
        expect((await auditoriaDoOrcamento(redeId)).rows).toHaveLength(0)
      })
    })

    describe('E14: o limite do operador no PUT', () => {
      const LIMITE = 3
      let appLimitado: INestApplication
      let urlLimitada: string

      beforeAll(async () => {
        ;({ app: appLimitado, url: urlLimitada } = await subir([], { LIMITE_REQ_OPERADOR_MIN: String(LIMITE) }))
      })

      afterAll(async () => {
        await appLimitado.close()
      })

      it('acima do rl:op do operador, 429 LIMITE_EXCEDIDO com Retry-After, e o orçamento não muda', async () => {
        const sessao = await operadores.operadorComSessao()
        // A escola nasce por outro operador: o limite é do operador (`rl:op:{sub}`, no Redis de todas as réplicas), e os dois pedidos que criam a escola contariam contra os três deste.
        const { escolaId } = await redeEEscola(await operadores.operadorComSessao())
        for (let vez = 1; vez <= LIMITE; vez++) expect((await pedir(urlLimitada, 'PUT', `/v1/operacao/escolas/${escolaId}/orcamento-ia`, sessao.token, corpo(100 * vez, 200))).status).toBe(200)
        const recusado = await pedir(urlLimitada, 'PUT', `/v1/operacao/escolas/${escolaId}/orcamento-ia`, sessao.token, corpo(999, 200))
        esperarErro(recusado, 429, ErrorCode.LIMITE_EXCEDIDO)
        expect(Number(recusado.retryAfter)).toBeGreaterThanOrEqual(1)
        expect(await configuracaoDaEscola(escolaId)).toEqual([{ valor: '3000000', teto: 200 }])
      })
    })

    /**
     * Cenários §3: o segundo `PUT` espera o primeiro na linha e lê como `antes` o que o primeiro gravou. O gatilho do banco de teste segura o primeiro **depois** de ele gravar (a linha já travada), e o teste confere
     * que o segundo está na fila da trava antes de soltar.
     */
    describe('corrida: dois PUT do mesmo alvo, o primeiro segurado na linha', () => {
      it('escola sem linha, valores diferentes: vale o segundo, duas auditorias, o antes da segunda é o depois da primeira, e nenhum 500', async () => {
        const sessao = await operadores.operadorComSessao()
        const { escolaId } = await redeEEscola(sessao)
        const gatilho = new WriteBlockTrigger(pool, { tabela: 'configuracao_operacional_escola', evento: 'update', quando: `new.escola_id = '${escolaId}' and new.ia_valor_por_aluno_micros = 3000000` })
        await gatilho.armar()
        try {
          const primeira = orcamentoDaEscola(escolaId, sessao.token, corpo(300, 200))
          await gatilho.esperarParadas()
          const segunda = orcamentoDaEscola(escolaId, sessao.token, corpo(400, 200))
          // O segundo chegou com a linha do primeiro ainda sem commit: o `insert … on conflict do nothing` espera nela.
          await esperarNaTrava(pool, '%insert into "configuracao_operacional_escola"%')
          await gatilho.soltar()
          const respostas = await Promise.all([primeira, segunda])
          expect(respostas.map((resposta) => resposta.status)).toEqual([200, 200])
          expect(await configuracaoDaEscola(escolaId)).toEqual([{ valor: '4000000', teto: 200 }])
          expect((await auditoriaDoOrcamento(escolaId)).rows.map((registro) => [registro.antes, registro.depois])).toEqual([
            [propria(null, null), propria(3_000_000, 200)],
            [propria(3_000_000, 200), propria(4_000_000, 200)],
          ])
        } finally {
          await gatilho.desarmar()
        }
      })

      it('escola, o mesmo valor nos dois: uma auditoria só, porque o segundo vê o antes igual ao depois', async () => {
        const sessao = await operadores.operadorComSessao()
        const { escolaId } = await redeEEscola(sessao)
        const gatilho = new WriteBlockTrigger(pool, { tabela: 'configuracao_operacional_escola', evento: 'update', quando: `new.escola_id = '${escolaId}' and new.ia_valor_por_aluno_micros = 3000000` })
        await gatilho.armar()
        try {
          const primeira = orcamentoDaEscola(escolaId, sessao.token, corpo(300, 200))
          await gatilho.esperarParadas()
          const segunda = orcamentoDaEscola(escolaId, sessao.token, corpo(300, 200))
          await esperarNaTrava(pool, '%insert into "configuracao_operacional_escola"%')
          await gatilho.soltar()
          expect((await Promise.all([primeira, segunda])).map((resposta) => resposta.status)).toEqual([200, 200])
          expect((await auditoriaDoOrcamento(escolaId)).rows).toHaveLength(1)
        } finally {
          await gatilho.desarmar()
        }
      })

      it('escola com a linha já gravada, valores diferentes: o segundo espera o for update e lê como antes o que o primeiro gravou', async () => {
        const sessao = await operadores.operadorComSessao()
        const { escolaId } = await redeEEscola(sessao)
        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(100, 200))).status).toBe(200)
        // Antes da gravação: o primeiro já travou a linha (`for update`) e ainda não a alterou, e o `insert … on conflict do nothing` do segundo passa sem esperar (a linha não mudou): só o `select … for update` o segura.
        const gatilho = new WriteBlockTrigger(pool, { tabela: 'configuracao_operacional_escola', evento: 'update', momento: 'before', quando: `new.escola_id = '${escolaId}' and new.ia_valor_por_aluno_micros = 3000000` })
        await gatilho.armar()
        try {
          const primeira = orcamentoDaEscola(escolaId, sessao.token, corpo(300, 200))
          await gatilho.esperarParadas()
          const segunda = orcamentoDaEscola(escolaId, sessao.token, corpo(400, 200))
          // Com a linha já commitada, o `insert … on conflict do nothing` passa direto, e quem espera é o `select … for update`.
          await esperarNaTrava(pool, '%from "configuracao_operacional_escola"%for update%')
          await gatilho.soltar()
          expect((await Promise.all([primeira, segunda])).map((resposta) => resposta.status)).toEqual([200, 200])
          expect(await configuracaoDaEscola(escolaId)).toEqual([{ valor: '4000000', teto: 200 }])
          expect((await auditoriaDoOrcamento(escolaId)).rows.map((registro) => [registro.antes, registro.depois])).toEqual([
            [propria(null, null), propria(1_000_000, 200)],
            [propria(1_000_000, 200), propria(3_000_000, 200)],
            [propria(3_000_000, 200), propria(4_000_000, 200)],
          ])
        } finally {
          await gatilho.desarmar()
        }
      })

      it('escola com a linha já gravada, o mesmo valor nos dois: o segundo espera o for update, vê o antes igual ao depois e não audita', async () => {
        const sessao = await operadores.operadorComSessao()
        const { escolaId } = await redeEEscola(sessao)
        expect((await orcamentoDaEscola(escolaId, sessao.token, corpo(100, 200))).status).toBe(200)
        // Antes da gravação: o primeiro já travou a linha (`for update`) e ainda não a alterou, e o `insert … on conflict do nothing` do segundo passa sem esperar (a linha não mudou): só o `select … for update` o segura.
        const gatilho = new WriteBlockTrigger(pool, { tabela: 'configuracao_operacional_escola', evento: 'update', momento: 'before', quando: `new.escola_id = '${escolaId}' and new.ia_valor_por_aluno_micros = 3000000` })
        await gatilho.armar()
        try {
          const primeira = orcamentoDaEscola(escolaId, sessao.token, corpo(300, 200))
          await gatilho.esperarParadas()
          const segunda = orcamentoDaEscola(escolaId, sessao.token, corpo(300, 200))
          await esperarNaTrava(pool, '%from "configuracao_operacional_escola"%for update%')
          await gatilho.soltar()
          expect((await Promise.all([primeira, segunda])).map((resposta) => resposta.status)).toEqual([200, 200])
          // A primeira (100) e a do valor de 300: a segunda não grava nem audita.
          expect((await auditoriaDoOrcamento(escolaId)).rows).toHaveLength(2)
        } finally {
          await gatilho.desarmar()
        }
      })

      it('rede, valores diferentes: vale o segundo, duas auditorias, o antes da segunda é o depois da primeira', async () => {
        const sessao = await operadores.operadorComSessao()
        const redeId = await criarRedePeloPainel(sessao)
        const gatilho = new WriteBlockTrigger(pool, { tabela: 'rede', evento: 'update', quando: `new.id = '${redeId}' and new.ia_valor_por_aluno_micros = 3000000` })
        await gatilho.armar()
        try {
          const primeira = orcamentoDaRede(redeId, sessao.token, corpo(300, 200))
          await gatilho.esperarParadas()
          const segunda = orcamentoDaRede(redeId, sessao.token, corpo(400, 200))
          // O segundo espera o `for update` da linha da rede que o primeiro travou.
          await esperarNaTrava(pool, '%from "rede"%for update%')
          await gatilho.soltar()
          expect((await Promise.all([primeira, segunda])).map((resposta) => resposta.status)).toEqual([200, 200])
          expect(await configuracaoDaRede(redeId)).toEqual([{ valor: '4000000', teto: 200 }])
          expect((await auditoriaDoOrcamento(redeId)).rows.map((registro) => [registro.antes, registro.depois])).toEqual([
            [propria(null, null), propria(3_000_000, 200)],
            [propria(3_000_000, 200), propria(4_000_000, 200)],
          ])
        } finally {
          await gatilho.desarmar()
        }
      })

      it('rede, o mesmo valor nos dois: uma auditoria só', async () => {
        const sessao = await operadores.operadorComSessao()
        const redeId = await criarRedePeloPainel(sessao)
        const gatilho = new WriteBlockTrigger(pool, { tabela: 'rede', evento: 'update', quando: `new.id = '${redeId}' and new.ia_valor_por_aluno_micros = 3000000` })
        await gatilho.armar()
        try {
          const primeira = orcamentoDaRede(redeId, sessao.token, corpo(300, 200))
          await gatilho.esperarParadas()
          const segunda = orcamentoDaRede(redeId, sessao.token, corpo(300, 200))
          await esperarNaTrava(pool, '%from "rede"%for update%')
          await gatilho.soltar()
          expect((await Promise.all([primeira, segunda])).map((resposta) => resposta.status)).toEqual([200, 200])
          expect((await auditoriaDoOrcamento(redeId)).rows).toHaveLength(1)
        } finally {
          await gatilho.desarmar()
        }
      })
    })
  })

  // O `Logger` do Nest é global: o app limitado de cada E14 (abaixo e o do PUT) troca o destino do log do `app` principal. Por isso o bloco do orçamento, que confere linhas de log, vem antes deles.

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
