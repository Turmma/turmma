import { createDatabase, createPool, DomainException, estadoDaCoordenacao, runInContext, type Database, type DatabasePool, type DatabaseTransaction } from '@educa/nucleo'
import { ErrorCode, conviteDaCoordenacaoResponseSchema, escolasDoPainelResponseSchema, ESTADOS_DA_COORDENACAO, type EstadoDaCoordenacao, type ConviteDaCoordenacaoResponse } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { is, SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import type { SaidaDoComando } from '../src/ops/comando.js'
import { executarOpsConviteCoordenador } from '../src/ops/convite-coordenador.js'
import { desativarOperador } from '../src/ops/operador.js'
import { executarOpsRevogarConvite } from '../src/ops/revogar-convite.js'
import { ConviteRepository, criarConviteDeCoordenador, refazerConviteDaCoordenacao } from '../src/sessao/index.js'
import { esperarNaTrava, GatilhoDeParada } from './gatilho-de-parada.js'
import { ESPERA_DO_AUTOR, esperarErro, nomeQueVemPrimeiro, pedir, PRAZO_DAS_CONSULTAS_MS, segurarODesativar, subirApiDoPainel, type Resposta } from './painel-de-teste.js'
import { BancadaDeOperadores } from './sessao-de-operador.js'
import { autorDaBancada, BancadaDeSessoes } from './sessao-de-teste.js'
import { emOrdemNaTrava as emOrdem, esperarNaTravaDaEscola as esperarNaFilaDaEscola, segurarTravaDaEscola as segurarTrava } from './trava-da-escola.js'

/**
 * O convite da primeira coordenação pelo painel da operação (A0b, tarefas 2.0 e 3.0): `POST /v1/operacao/escolas/:id/
 * convite-coordenacao`, `POST /v1/operacao/convites/:id/refazer` e `POST /v1/operacao/convites/:id/revogar`, e os `ops:*`
 * de convite pelo mesmo caso de uso. Cenários de `tasks/prd-apresentacao-painel/cenarios.md`: E6 (gerar, refazer e
 * revogar), E7, E8, E9, E10, E11 e E13 (convite), E12 (as três rotas), I6 (refazer), I7, A1, A2 e A3 (gerar, refazer e
 * revogar), e a L4 da tarefa 5.0 (a lista, com as escolas em cada estado). As partes de login da E6 e a ativação sob a
 * trava (E15, E16) são da 4.0, em `login-convite-revogado` e `ativacao-sob-trava`. Postgres e Redis reais do compose de
 * teste.
 */

const HORA_MS = 60 * 60 * 1_000
const SENHA = 'senha-nova-do-convite-1'
/** Quanto, no máximo, a escola B pode levar com a trava da escola A segura (E10): a gravação leva milissegundos. */
const PRAZO_DA_OUTRA_ESCOLA_MS = 5_000

/** O que gerar e revogar fazem em cada estado (Tech Spec da A0b, seção 5, a matriz). */
const GERAR: Readonly<Record<EstadoDaCoordenacao, 201 | 409>> = {
  sem_convite: 201,
  pendente: 409,
  vencido: 409,
  revogado: 201,
  aceito: 201,
  sem_coordenacao: 201,
  ativa: 409,
}
/** `sem_convite` não tem convite a passar: o id é inexistente, e a resposta é a do inexistente. */
const REVOGAR: Readonly<Record<EstadoDaCoordenacao, 204 | 404 | 409>> = {
  sem_convite: 404,
  pendente: 204,
  vencido: 204,
  revogado: 404,
  aceito: 204,
  sem_coordenacao: 409,
  ativa: 409,
}
/** O que refazer (do último convite) faz em cada estado. `sem_convite`: o id é inexistente, como no revogar. */
const REFAZER: Readonly<Record<EstadoDaCoordenacao, 201 | 404 | 409>> = {
  sem_convite: 404,
  pendente: 201,
  vencido: 201,
  revogado: 409,
  aceito: 409,
  sem_coordenacao: 409,
  ativa: 409,
}
const CODIGO: Readonly<Record<404 | 409, ErrorCode>> = { 404: ErrorCode.NAO_ENCONTRADO, 409: ErrorCode.CONFLITO }
/** O prazo das consultas da API da I6 que deixa o `statement_timeout` estourar na trava segura pelo teste. */
const PRAZO_CURTO_MS = 1_000

/**
 * A mutação da E9, só no teste: o mesmo banco, com a trava do convite da escola desligada. Toda transação que ele abre
 * recebe um `execute` que devolve na hora a consulta do `pg_advisory_xact_lock` e passa as outras adiante; nada muda no
 * código de produção, que chama o caso de uso com este banco no lugar do de verdade.
 */
function semATravaDaEscola(banco: Database): Database {
  const dialeto = new PgDialect()
  const ehATrava = (consulta: unknown): boolean => is(consulta, SQL) && dialeto.sqlToQuery(consulta).sql.includes('pg_advisory_xact_lock')
  const transacaoSemATrava = (tx: DatabaseTransaction): DatabaseTransaction =>
    new Proxy(tx, {
      get: (alvo, chave, receptor) =>
        chave === 'execute' ? (consulta: SQL) => (ehATrava(consulta) ? Promise.resolve({ rows: [] }) : alvo.execute(consulta)) : Reflect.get(alvo, chave, receptor),
    })
  return new Proxy(banco, {
    get: (alvo, chave, receptor) =>
      chave === 'transaction' ? <T>(corpo: (tx: DatabaseTransaction) => Promise<T>) => alvo.transaction((tx) => corpo(transacaoSemATrava(tx))) : Reflect.get(alvo, chave, receptor),
  })
}

interface Pessoa {
  readonly nome: string
  readonly email: string
}

interface EscolaPreparada {
  readonly escolaId: string
  /** Quem foi convidada no preparo. */
  readonly quem: Pessoa
  /** O último convite de coordenação da escola; nenhum em `sem_convite`. */
  readonly conviteId: string | undefined
  /** O token do último convite (o do link); nenhum em `sem_convite`. */
  readonly link: string | undefined
}

describe('painel da operação: o convite da coordenação, gerar e revogar (tarefa 2.0)', () => {
  const operadores = new BancadaDeOperadores()
  const escolas = new BancadaDeSessoes()
  const linhasDeLog: string[] = []
  const pasta = mkdtempSync(join(tmpdir(), 'painel-convite-int-'))
  let app: INestApplication
  let url: string
  let pool: DatabasePool
  let banco: Database

  const pessoa = (): Pessoa => ({ nome: `Coordenação Sintética ${randomUUID().slice(0, 8)}`, email: `coordenacao-${randomUUID()}@escola.invalid` })
  const gerar = (token: string, escolaId: string, corpo: unknown = pessoa()) => pedir(url, 'POST', `/v1/operacao/escolas/${escolaId}/convite-coordenacao`, token, corpo)
  const revogar = (token: string, conviteId: string, corpo?: unknown) => pedir(url, 'POST', `/v1/operacao/convites/${conviteId}/revogar`, token, corpo)
  const refazer = (token: string, conviteId: string, corpo?: unknown, naApi = url) => pedir(naApi, 'POST', `/v1/operacao/convites/${conviteId}/refazer`, token, corpo)
  const consultar = (link: string) => pedir(url, 'POST', '/v1/convites/consultar', undefined, { token: link })
  const aceitar = (token: string, senha?: string) => pedir(url, 'POST', '/v1/convites/aceitar', undefined, senha === undefined ? { token } : { token, senha })
  const gerado = (resposta: Resposta): ConviteDaCoordenacaoResponse => conviteDaCoordenacaoResponseSchema.parse(resposta.corpo)

  /** O estado da coordenação da escola, pela mesma função e pela mesma leitura da escrita. */
  const estadoDe = (escolaId: string) =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, async () => {
      const dados = await new ConviteRepository(banco).dadosDaCoordenacao()
      if (dados === undefined) throw new Error('escola de teste não encontrada')
      return estadoDaCoordenacao(dados)
    })

  const abertos = async (escolaId: string) =>
    (await pool.query<{ total: number }>('select count(*)::int as total from convite where escola_id = $1 and usado_em is null and revogado_em is null', [escolaId])).rows[0]?.total
  const auditoriaDe = async (escolaId: string, acao: string) =>
    (
      await pool.query<{ entidade_id: string; autor_operador: string | null; autor_usuario_id: string | null; antes: unknown; depois: unknown }>(
        'select entidade_id, autor_operador, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and acao = $2 order by em, id',
        [escolaId, acao],
      )
    ).rows
  const linhasComEvento = (evento: string) => linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['msg'] === evento)

  /** Tudo o que gerar e revogar podem gravar na escola, e a conta do e-mail: o que não é permitido não muda nada disto. */
  async function retrato(escolaId: string, email: string) {
    const [convites, usuarios, auditoria, contas] = await Promise.all([
      pool.query('select id, usuario_id, expira_em, usado_em, revogado_em from convite where escola_id = $1 order by id', [escolaId]),
      pool.query('select id, conta_id, desativado_em from usuario where escola_id = $1 order by id', [escolaId]),
      pool.query('select id from auditoria where escola_id = $1 order by id', [escolaId]),
      pool.query('select id from conta where email = $1', [email]),
    ])
    return { convites: convites.rows, usuarios: usuarios.rows, auditoria: auditoria.rows, contas: contas.rows }
  }

  /**
   * Uma escola nova no estado pedido: o gerar e o revogar do painel e o aceite da rota do convite (conta nova define a
   * senha e ativa; conta com senha espera o login) pelos caminhos de verdade; a coordenação desativada, por `update` no
   * banco (a desativação pela escola não é desta funcionalidade); o vencido, pelo caso de uso com o relógio 73 h atrás.
   * `nome` é o da escola, quando o teste precisa achá-la numa página da lista.
   */
  async function escolaEm(estado: EstadoDaCoordenacao, token: string, nome?: string): Promise<EscolaPreparada> {
    const escolaId = await escolas.escola(nome)
    const quem = pessoa()
    if (estado === 'sem_convite') return { escolaId, quem, conviteId: undefined, link: undefined }
    if (estado === 'vencido') {
      const { conviteId, token: link } = await criarConviteDeCoordenador(banco, autorDaBancada, { escolaId, ...quem }, { agora: () => new Date(Date.now() - 73 * HORA_MS) })
      expect(await estadoDe(escolaId)).toBe('vencido')
      return { escolaId, quem, conviteId, link }
    }
    // A pessoa que já trabalha em outra escola cliente: o aceite não troca a senha dela e espera o login.
    if (estado === 'aceito') await pool.query("insert into conta (email, senha_hash) values ($1, 'hash-sintetico')", [quem.email])
    const resposta = await gerar(token, escolaId, quem)
    expect(resposta.status).toBe(201)
    const { conviteId, token: link } = gerado(resposta)
    if (estado === 'revogado') expect((await revogar(token, conviteId)).status).toBe(204)
    if (estado === 'aceito') expect((await aceitar(link)).corpo).toEqual({ etapa: 'entrar', bilhete: expect.any(String) })
    if (estado === 'ativa' || estado === 'sem_coordenacao') expect((await aceitar(link, SENHA)).corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
    if (estado === 'sem_coordenacao') await pool.query("update usuario set desativado_em = now() where escola_id = $1 and papel = 'coordenador'", [escolaId])
    expect(await estadoDe(escolaId)).toBe(estado)
    return { escolaId, quem, conviteId, link }
  }

  // A trava do convite da escola vista pelo teste (`trava-da-escola.ts`), com o pool deste arquivo.
  const segurarTravaDaEscola = (escolaId: string) => segurarTrava(pool, escolaId)
  const esperarNaTravaDaEscola = (escolaId: string, quantas: number) => esperarNaFilaDaEscola(pool, escolaId, quantas)
  const emOrdemNaTrava = (escolaId: string, primeira: () => Promise<Resposta>, segunda: () => Promise<Resposta>) => emOrdem(pool, escolaId, primeira, segunda)

  /** Os convites da escola, com o usuário, e se cada um está em aberto ou revogado. */
  const convitesDa = async (escolaId: string) =>
    (
      await pool.query<{ id: string; usuario_id: string; expira_em: Date; aberto: boolean; revogado: boolean }>(
        'select id, usuario_id, expira_em, usado_em is null and revogado_em is null as aberto, revogado_em is not null as revogado from convite where escola_id = $1 order by id',
        [escolaId],
      )
    ).rows

  /** Dispara as chamadas com a trava da escola segura pelo teste, confere que todas esperam nela, e só então solta. */
  async function naFilaDaTrava(escolaId: string, chamadas: () => Promise<Resposta>[]): Promise<Resposta[]> {
    const soltar = await segurarTravaDaEscola(escolaId)
    try {
      const emAndamento = chamadas()
      await esperarNaTravaDaEscola(escolaId, emAndamento.length)
      await soltar()
      return await Promise.all(emAndamento)
    } finally {
      await soltar()
    }
  }

  beforeAll(async () => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 6, timeoutConexaoMs: 5_000, timeoutConsultaMs: PRAZO_DAS_CONSULTAS_MS }, () => undefined)
    banco = createDatabase(pool)
    ;({ app, url } = await subirApiDoPainel(linhasDeLog))
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
    await escolas.fechar()
    await operadores.fechar()
    rmSync(pasta, { recursive: true, force: true })
  })

  describe('E6: gerar, em cada estado, dá o resultado da matriz, e o que não é permitido não grava nada', () => {
    it.each(ESTADOS_DA_COORDENACAO)('gerar em %s', async (estado) => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm(estado, sessao.token)
      const outra = pessoa()
      const antes = await retrato(escola.escolaId, outra.email)
      const revogadosAntes = await auditoriaDe(escola.escolaId, 'convite.revogado')
      const resposta = await gerar(sessao.token, escola.escolaId, outra)
      expect(resposta.cacheControl).toBe('no-store')

      const esperado = GERAR[estado]
      if (esperado === 409) {
        esperarErro(resposta, 409, ErrorCode.CONFLITO)
        expect(await retrato(escola.escolaId, outra.email)).toEqual(antes)
        expect(await estadoDe(escola.escolaId)).toBe(estado)
        return
      }
      expect(resposta.status).toBe(201)
      const { conviteId, token } = gerado(resposta)
      const { rows } = await pool.query<{ escola_id: string; email: string }>('select c.escola_id, co.email from convite c join usuario u on u.id = c.usuario_id join conta co on co.id = u.conta_id where c.id = $1', [conviteId])
      expect(rows).toEqual([{ escola_id: escola.escolaId, email: outra.email }])
      expect(await abertos(escola.escolaId)).toBe(1)
      expect(await estadoDe(escola.escolaId)).toBe('pendente')
      expect(await auditoriaDe(escola.escolaId, 'convite.criado')).toEqual(expect.arrayContaining([expect.objectContaining({ entidade_id: conviteId, autor_operador: sessao.apelido, autor_usuario_id: null })]))

      const revogados = await auditoriaDe(escola.escolaId, 'convite.revogado')
      if (estado === 'aceito' || estado === 'sem_coordenacao') {
        // O último convite (no `aceito`, o do aceite que esperava o login; no `sem_coordenacao`, o já usado) é revogado
        // na mesma transação, com a auditoria dele e o apelido conferido, sem nome, e-mail nem token.
        expect((await pool.query('select revogado_em is not null as revogado from convite where id = $1', [escola.conviteId])).rows).toEqual([{ revogado: true }])
        expect(revogados).toEqual([...revogadosAntes, { entidade_id: escola.conviteId, autor_operador: sessao.apelido, autor_usuario_id: null, antes: null, depois: { tipo: 'coordenador' } }])
        const texto = JSON.stringify(revogados)
        for (const proibido of [escola.quem.nome, escola.quem.email, outra.nome, outra.email, token]) expect(texto).not.toContain(proibido)
      } else {
        expect(revogados).toEqual(revogadosAntes)
      }
    })

    it.each(['aceito', 'sem_coordenacao'] as const)('gerar em %s com o mesmo e-mail reaproveita o usuário, que fica esperando só o convite novo', async (estado) => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm(estado, sessao.token)
      const { rows: anterior } = await pool.query<{ usuario_id: string }>('select usuario_id from convite where id = $1', [escola.conviteId])
      const resposta = await gerar(sessao.token, escola.escolaId, escola.quem)
      expect(resposta.status).toBe(201)
      const { conviteId } = gerado(resposta)
      const { rows } = await pool.query<{ id: string; usuario_id: string; aberto: boolean; ativo: boolean }>(
        `select c.id, c.usuario_id, c.usado_em is null and c.revogado_em is null as aberto, u.desativado_em is null as ativo
           from convite c join usuario u on u.id = c.usuario_id where c.escola_id = $1 order by c.id`,
        [escola.escolaId],
      )
      expect(rows.map((linha) => linha.usuario_id)).toEqual([anterior[0]?.usuario_id, anterior[0]?.usuario_id])
      expect(rows.filter((linha) => linha.aberto).map((linha) => linha.id)).toEqual([conviteId])
      // Inativo até o convite novo ser aceito; uma conta só para o e-mail.
      expect(rows.every((linha) => !linha.ativo)).toBe(true)
      expect((await pool.query('select id from conta where email = $1', [escola.quem.email])).rows).toHaveLength(1)
    })
  })

  describe('E6: o nome se corrige revogando e gerando com o mesmo e-mail (Tech Spec da A0b, seção 5)', () => {
    it.each(['revogado', 'aceito', 'sem_coordenacao'] as const)('em %s, gerar com o mesmo e-mail e outro nome grava o nome novo no mesmo usuário', async (estado) => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm(estado, sessao.token)
      const { rows: anterior } = await pool.query<{ usuario_id: string }>('select usuario_id from convite where id = $1', [escola.conviteId])
      const corrigido = { nome: `${escola.quem.nome} Corrigido`, email: escola.quem.email }
      const resposta = await gerar(sessao.token, escola.escolaId, corrigido)
      expect(resposta.status).toBe(201)
      const { rows } = await pool.query<{ id: string; nome: string }>('select u.id, u.nome from convite c join usuario u on u.id = c.usuario_id where c.id = $1', [gerado(resposta).conviteId])
      expect(rows).toEqual([{ id: anterior[0]?.usuario_id, nome: corrigido.nome }])
    })
  })

  describe('E6: revogar, em cada estado, dá o resultado da matriz, e o que não é permitido não grava nada', () => {
    it.each(ESTADOS_DA_COORDENACAO)('revogar o último convite em %s', async (estado) => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm(estado, sessao.token)
      const alvo = escola.conviteId ?? randomUUID()
      const antes = await retrato(escola.escolaId, escola.quem.email)
      const revogadosAntes = await auditoriaDe(escola.escolaId, 'convite.revogado')
      const resposta = await revogar(sessao.token, alvo)
      expect(resposta.cacheControl).toBe('no-store')

      const esperado = REVOGAR[estado]
      if (esperado !== 204) {
        esperarErro(resposta, esperado, CODIGO[esperado])
        expect(await retrato(escola.escolaId, escola.quem.email)).toEqual(antes)
        return
      }
      expect(resposta.status).toBe(204)
      expect(resposta.texto).toBe('')
      expect((await pool.query('select revogado_em is not null as revogado from convite where id = $1', [alvo])).rows).toEqual([{ revogado: true }])
      expect(await auditoriaDe(escola.escolaId, 'convite.revogado')).toEqual([
        ...revogadosAntes,
        { entidade_id: alvo, autor_operador: sessao.apelido, autor_usuario_id: null, antes: null, depois: { tipo: 'coordenador' } },
      ])
      expect(await estadoDe(escola.escolaId)).toBe('revogado')
      expect(await abertos(escola.escolaId)).toBe(0)
    })

    it('o convite anterior que o gerar já revogou responde NAO_ENCONTRADO; um em aberto que não é o último (de antes da trava) responde CONFLITO', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('aceito', sessao.token)
      expect((await gerar(sessao.token, escola.escolaId)).status).toBe(201)
      esperarErro(await revogar(sessao.token, escola.conviteId ?? ''), 404, ErrorCode.NAO_ENCONTRADO)

      // Um convite em aberto de outro usuário, que vence antes do último: só dado de antes da trava chega a isso.
      const outraConta = pessoa()
      const { rows: contas } = await pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [outraConta.email])
      const { rows: antigos } = await pool.query<{ id: string }>(
        "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', now()) returning id",
        [escola.escolaId, contas[0]?.id],
      )
      const { rows: convites } = await pool.query<{ id: string }>(
        "insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em) values ($1, $2, 'coordenador', $3, now() + interval '1 hour') returning id",
        [escola.escolaId, createHash('sha256').update(randomUUID()).digest('hex'), antigos[0]?.id],
      )
      const antigo = convites[0]?.id ?? ''
      const antes = await retrato(escola.escolaId, outraConta.email)
      esperarErro(await revogar(sessao.token, antigo), 409, ErrorCode.CONFLITO)
      expect(await retrato(escola.escolaId, outraConta.email)).toEqual(antes)
    })
  })

  describe('E7: escola inexistente', () => {
    it('gerar numa escola que não existe é NAO_ENCONTRADO, sem conta, usuário nem convite; o id fora do formato também', async () => {
      const sessao = await operadores.operadorComSessao()
      const quem = pessoa()
      const escolaId = randomUUID()
      esperarErro(await gerar(sessao.token, escolaId, quem), 404, ErrorCode.NAO_ENCONTRADO)
      esperarErro(await gerar(sessao.token, 'nao-e-uuid', quem), 404, ErrorCode.NAO_ENCONTRADO)
      expect((await pool.query('select id from conta where email = $1', [quem.email])).rows).toEqual([])
      expect((await pool.query('select id from usuario where escola_id = $1', [escolaId])).rows).toEqual([])
      expect((await pool.query('select id from auditoria where escola_id = $1', [escolaId])).rows).toEqual([])
      esperarErro(await revogar(sessao.token, 'nao-e-uuid'), 404, ErrorCode.NAO_ENCONTRADO)
      esperarErro(await refazer(sessao.token, 'nao-e-uuid'), 404, ErrorCode.NAO_ENCONTRADO)
    })
  })

  describe('E12: o corpo não escolhe o autor nem a escola', () => {
    it('gerar com autor, escolaId ou qualquer campo a mais, e refazer e revogar com corpo, são 400 ENTRADA_INVALIDA, sem gravar nada', async () => {
      const sessao = await operadores.operadorComSessao()
      // Sem convite, o gerar criaria; com o convite pendente, o refazer refaria e o revogar revogaria: só o corpo os segura.
      const livre = await escolas.escola()
      const escola = await escolaEm('pendente', sessao.token)
      const quem = pessoa()
      const [livreAntes, antes] = [await retrato(livre, quem.email), await retrato(escola.escolaId, quem.email)]
      for (const aMais of [{ autor: 'outra-pessoa' }, { autorOperador: 'outra-pessoa' }, { escolaId: escola.escolaId }]) {
        esperarErro(await gerar(sessao.token, livre, { ...quem, ...aMais }), 400, ErrorCode.ENTRADA_INVALIDA)
      }
      for (const corpo of [{ autor: 'outra-pessoa' }, { conviteId: escola.conviteId }]) {
        esperarErro(await revogar(sessao.token, escola.conviteId ?? '', corpo), 400, ErrorCode.ENTRADA_INVALIDA)
        esperarErro(await refazer(sessao.token, escola.conviteId ?? '', corpo), 400, ErrorCode.ENTRADA_INVALIDA)
      }
      expect(await retrato(livre, quem.email)).toEqual(livreAntes)
      expect(await retrato(escola.escolaId, quem.email)).toEqual(antes)
      expect((await pool.query('select id from conta where email = $1', [quem.email])).rows).toEqual([])
      expect((await pool.query(`select 1 from auditoria where autor_operador = 'outra-pessoa'`)).rows).toEqual([])
    })
  })

  describe('E8: em paralelo na mesma escola, com a ordem forçada pela trava, no fim há no máximo um convite em aberto', () => {
    it('dois gerar com e-mails diferentes: um cria, o outro recebe CONFLITO', async () => {
      const sessao = await operadores.operadorComSessao()
      const escolaId = await escolas.escola()
      const respostas = await naFilaDaTrava(escolaId, () => [gerar(sessao.token, escolaId), gerar(sessao.token, escolaId)])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      esperarErro(respostas.find((resposta) => resposta.status === 409) as Resposta, 409, ErrorCode.CONFLITO)
      expect(await abertos(escolaId)).toBe(1)
      expect(await auditoriaDe(escolaId, 'convite.criado')).toHaveLength(1)
    })

    it('dois gerar com o mesmo e-mail: uma conta, um usuário e um convite; o outro recebe CONFLITO', async () => {
      const sessao = await operadores.operadorComSessao()
      const escolaId = await escolas.escola()
      const quem = pessoa()
      const respostas = await naFilaDaTrava(escolaId, () => [gerar(sessao.token, escolaId, quem), gerar(sessao.token, escolaId, quem)])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      esperarErro(respostas.find((resposta) => resposta.status === 409) as Resposta, 409, ErrorCode.CONFLITO)
      expect((await pool.query('select id from conta where email = $1', [quem.email])).rows).toHaveLength(1)
      expect((await pool.query('select id from usuario where escola_id = $1', [escolaId])).rows).toHaveLength(1)
      expect((await pool.query('select id from convite where escola_id = $1', [escolaId])).rows).toHaveLength(1)
    })

    it('gerar e revogar em aceito: o gerar cria; o revogar revoga (antes) ou responde NAO_ENCONTRADO (depois); o anterior sai revogado uma vez', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('aceito', sessao.token)
      const [doGerar, doRevogar] = await naFilaDaTrava(escola.escolaId, () => [gerar(sessao.token, escola.escolaId), revogar(sessao.token, escola.conviteId ?? '')])
      expect(doGerar?.status).toBe(201)
      // O revogar que perde para o gerar acha o convite já revogado por ele: NAO_ENCONTRADO, como no F1.
      if (doRevogar?.status === 204) expect(doRevogar.texto).toBe('')
      else esperarErro(doRevogar as Resposta, 404, ErrorCode.NAO_ENCONTRADO)
      expect(await abertos(escola.escolaId)).toBe(1)
      expect((await auditoriaDe(escola.escolaId, 'convite.revogado')).filter((linha) => linha.entidade_id === escola.conviteId)).toHaveLength(1)
    })

    it('dois revogar: um 204 e um NAO_ENCONTRADO, com uma auditoria', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      const respostas = await naFilaDaTrava(escola.escolaId, () => [revogar(sessao.token, escola.conviteId ?? ''), revogar(sessao.token, escola.conviteId ?? '')])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([204, 404])
      esperarErro(respostas.find((resposta) => resposta.status === 404) as Resposta, 404, ErrorCode.NAO_ENCONTRADO)
      expect(await auditoriaDe(escola.escolaId, 'convite.revogado')).toHaveLength(1)
      expect(await abertos(escola.escolaId)).toBe(0)
    })
  })

  describe('E10: a trava e o contexto são por escola', () => {
    it('o mesmo e-mail em duas escolas: com a trava de A segura, B termina; cada convite na sua escola, e nada da outra na resposta', async () => {
      const sessao = await operadores.operadorComSessao()
      const [escolaA, escolaB] = [await escolas.escola(), await escolas.escola()]
      const quem = pessoa()
      const soltar = await segurarTravaDaEscola(escolaA)
      let emA: Promise<Resposta> | undefined
      let respostaB: Resposta
      try {
        // Com a trava de outra chave que não a da escola (uma global, por exemplo), A não esperaria aqui; com a chave de
        // A para as duas, B esperaria A e estouraria o prazo abaixo.
        emA = gerar(sessao.token, escolaA, quem)
        await esperarNaTravaDaEscola(escolaA, 1)
        let prazo: NodeJS.Timeout | undefined
        respostaB = await Promise.race([
          gerar(sessao.token, escolaB, quem),
          new Promise<never>((_, recusar) => {
            prazo = setTimeout(() => recusar(new Error('a escola B esperou a trava da escola A')), PRAZO_DA_OUTRA_ESCOLA_MS)
          }),
        ]).finally(() => clearTimeout(prazo))
        await esperarNaTravaDaEscola(escolaA, 1)
      } finally {
        await soltar()
      }
      const respostaA = await emA
      expect([respostaA.status, respostaB.status]).toEqual([201, 201])
      const [deA, deB] = [gerado(respostaA), gerado(respostaB)]
      const { rows } = await pool.query<{ id: string; escola_id: string; conta_id: string }>(
        'select c.id, c.escola_id, u.conta_id from convite c join usuario u on u.id = c.usuario_id where c.id = any($1::uuid[]) order by c.escola_id = $2 desc',
        [[deA.conviteId, deB.conviteId], escolaA],
      )
      expect(rows.map((linha) => [linha.id, linha.escola_id])).toEqual([
        [deA.conviteId, escolaA],
        [deB.conviteId, escolaB],
      ])
      expect(new Set(rows.map((linha) => linha.conta_id)).size).toBe(1)
      expect(respostaA.texto).not.toContain(deB.conviteId)
      expect(respostaB.texto).not.toContain(deA.conviteId)
      for (const texto of [respostaA.texto, respostaB.texto]) for (const outraEscola of [escolaA, escolaB]) expect(texto).not.toContain(outraEscola)
    })
  })

  describe('E11: o autor desativado no meio do gerar e do revogar', () => {
    it('gerar, com o desativar segurando a linha: espera o for share e responde 401 SESSAO_ENCERRADA sem gravar nada', async () => {
      const sessao = await operadores.operadorComSessao()
      const escolaId = await escolas.escola()
      const quem = pessoa()
      const antes = await retrato(escolaId, quem.email)
      const desativar = await segurarODesativar(pool, sessao.operadorId)
      try {
        const escrita = gerar(sessao.token, escolaId, quem)
        await esperarNaTrava(pool, ESPERA_DO_AUTOR)
        await desativar.confirmar()
        esperarErro(await escrita, 401, ErrorCode.SESSAO_ENCERRADA)
      } finally {
        await desativar.desfazer()
      }
      expect(await retrato(escolaId, quem.email)).toEqual(antes)
    })

    it('revogar, com o desativar segurando a linha: o mesmo, e o convite continua em aberto', async () => {
      const [sessao, quemPrepara] = await Promise.all([operadores.operadorComSessao(), operadores.operadorComSessao()])
      const escola = await escolaEm('pendente', quemPrepara.token)
      const antes = await retrato(escola.escolaId, escola.quem.email)
      const desativar = await segurarODesativar(pool, sessao.operadorId)
      try {
        const escrita = revogar(sessao.token, escola.conviteId ?? '')
        await esperarNaTrava(pool, ESPERA_DO_AUTOR)
        await desativar.confirmar()
        esperarErro(await escrita, 401, ErrorCode.SESSAO_ENCERRADA)
      } finally {
        await desativar.desfazer()
      }
      expect(await retrato(escola.escolaId, escola.quem.email)).toEqual(antes)
      expect(await abertos(escola.escolaId)).toBe(1)
    })

    it('refazer, com o desativar segurando a linha: o mesmo, e o convite continua em aberto, sem outro', async () => {
      const [sessao, quemPrepara] = await Promise.all([operadores.operadorComSessao(), operadores.operadorComSessao()])
      const escola = await escolaEm('pendente', quemPrepara.token)
      const antes = await retrato(escola.escolaId, escola.quem.email)
      const desativar = await segurarODesativar(pool, sessao.operadorId)
      try {
        const escrita = refazer(sessao.token, escola.conviteId ?? '')
        await esperarNaTrava(pool, ESPERA_DO_AUTOR)
        await desativar.confirmar()
        esperarErro(await escrita, 401, ErrorCode.SESSAO_ENCERRADA)
      } finally {
        await desativar.desfazer()
      }
      expect(await retrato(escola.escolaId, escola.quem.email)).toEqual(antes)
      expect(await abertos(escola.escolaId)).toBe(1)
    })

    const ESCRITA = {
      gerar: { status: 201, acao: 'convite.criado' },
      refazer: { status: 201, acao: 'convite.refeito' },
      revogar: { status: 204, acao: 'convite.revogado' },
    } as const

    it.each([
      ['gerar', 'insert'],
      ['refazer', 'update'],
      ['revogar', 'update'],
    ] as const)('%s segurando o for share (parado no %s de convite): o desativar espera, e a escrita entra com a auditoria', async (acao, evento) => {
      const [sessao, quemDesativa] = await Promise.all([operadores.operadorComSessao(), operadores.operador()])
      const escola = acao === 'gerar' ? { escolaId: await escolas.escola(), conviteId: undefined } : await escolaEm('pendente', (await operadores.operadorComSessao()).token)
      const gatilho = new GatilhoDeParada(pool, { tabela: 'convite', evento, quando: `new.escola_id = '${escola.escolaId}'::uuid` })
      await gatilho.armar()
      try {
        const escrita = acao === 'gerar' ? gerar(sessao.token, escola.escolaId) : acao === 'refazer' ? refazer(sessao.token, escola.conviteId ?? '') : revogar(sessao.token, escola.conviteId ?? '')
        await gatilho.esperarParadas()
        const desativacao = desativarOperador(banco, quemDesativa.apelido, sessao.apelido)
        await esperarNaTrava(pool, '%from "operador"%for update%')
        await gatilho.soltar()
        expect((await escrita).status).toBe(ESCRITA[acao].status)
        await desativacao
        const registrada = await auditoriaDe(escola.escolaId, ESCRITA[acao].acao)
        expect(registrada).toEqual([expect.objectContaining({ autor_operador: sessao.apelido, autor_usuario_id: null })])
        expect((await pool.query('select desativado_em is not null as desativado from operador where id = $1', [sessao.operadorId])).rows).toEqual([{ desativado: true }])
      } finally {
        await gatilho.desarmar()
      }
    })
  })

  describe('E13 e o revogar pelo comando: os ops:* de convite passam pela mesma matriz do painel', () => {
    const rodar = async (comando: typeof executarOpsConviteCoordenador, argumentos: string[], operador: string) => {
      let saida = ''
      let erro = ''
      const terminal: SaidaDoComando = { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) }
      const codigo = await comando(argumentos, { ...lerAmbienteDeTeste(), OPERADOR: operador, BANCO_TIMEOUT_CONSULTA_MS: String(PRAZO_DAS_CONSULTAS_MS) }, terminal)
      return { codigo, saida, erro }
    }

    it('ops:convite-coordenador numa escola com convite em aberto: código 1, CONFLITO, nada gravado e nenhum arquivo', async () => {
      const [sessao, quemRoda] = await Promise.all([operadores.operadorComSessao(), operadores.operador()])
      const escola = await escolaEm('pendente', sessao.token)
      const outra = pessoa()
      const arquivo = join(pasta, `token-${randomUUID()}.txt`)
      const antes = await retrato(escola.escolaId, outra.email)
      const execucao = await rodar(executarOpsConviteCoordenador, ['--escola', await escolas.slugDe(escola.escolaId), '--email', outra.email, '--nome', outra.nome, '--saida', arquivo], quemRoda.apelido)
      expect(execucao).toEqual({ codigo: 1, saida: '', erro: 'CONFLITO: a escola já tem coordenação ativa ou convite em aberto; revogue o convite antes de gerar outro\n' })
      expect(await retrato(escola.escolaId, outra.email)).toEqual(antes)
      expect(existsSync(arquivo)).toBe(false)
    })

    it('ops:revogar-convite: numa escola com coordenação ativa, CONFLITO sem gravar nada; num convite pendente, revoga com o OPERADOR na auditoria', async () => {
      const [sessao, quemRoda] = await Promise.all([operadores.operadorComSessao(), operadores.operador()])
      const ativa = await escolaEm('ativa', sessao.token)
      const antes = await retrato(ativa.escolaId, ativa.quem.email)
      expect(await rodar(executarOpsRevogarConvite, ['--convite', ativa.conviteId ?? ''], quemRoda.apelido)).toEqual({ codigo: 1, saida: '', erro: 'CONFLITO\n' })
      expect(await retrato(ativa.escolaId, ativa.quem.email)).toEqual(antes)

      const pendente = await escolaEm('pendente', sessao.token)
      expect(await rodar(executarOpsRevogarConvite, ['--convite', pendente.conviteId ?? ''], quemRoda.apelido)).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })
      expect(await auditoriaDe(pendente.escolaId, 'convite.revogado')).toEqual([{ entidade_id: pendente.conviteId, autor_operador: quemRoda.apelido, autor_usuario_id: null, antes: null, depois: { tipo: 'coordenador' } }])
      expect(await estadoDe(pendente.escolaId)).toBe('revogado')
    })
  })

  describe('I7: escola ativa, e convite de outro tipo', () => {
    it('revogar pelo id do convite de uma escola ativa não grava nada', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('ativa', sessao.token)
      const antes = await retrato(escola.escolaId, escola.quem.email)
      esperarErro(await revogar(sessao.token, escola.conviteId ?? ''), 409, ErrorCode.CONFLITO)
      expect(await retrato(escola.escolaId, escola.quem.email)).toEqual(antes)
    })

    it('refazer pelo id do convite de uma escola ativa não grava nada, nem quando o último convite ainda está em aberto (dado de antes da trava)', async () => {
      const sessao = await operadores.operadorComSessao()
      const ativa = await escolaEm('ativa', sessao.token)
      const antes = await retrato(ativa.escolaId, ativa.quem.email)
      esperarErro(await refazer(sessao.token, ativa.conviteId ?? ''), 409, ErrorCode.CONFLITO)
      expect(await retrato(ativa.escolaId, ativa.quem.email)).toEqual(antes)

      // O convite pendente continua o último, e em aberto; com uma coordenadora ativa semeada, a escola está `ativa`. Sem
      // a linha `ativa` da matriz do refazer, o update condicional passaria e um convite novo nasceria.
      const pendente = await escolaEm('pendente', sessao.token)
      await escolas.equipeComEmail(pendente.escolaId, `coordenacao-ativa-${randomUUID()}@escola.invalid`, 'coordenador')
      expect(await estadoDe(pendente.escolaId)).toBe('ativa')
      const antesDaPendente = await retrato(pendente.escolaId, pendente.quem.email)
      esperarErro(await refazer(sessao.token, pendente.conviteId ?? ''), 409, ErrorCode.CONFLITO)
      expect(await retrato(pendente.escolaId, pendente.quem.email)).toEqual(antesDaPendente)
      expect(await abertos(pendente.escolaId)).toBe(1)
    })

    it('I7 da A1: com o check afrouxado pela 0018, refazer e revogar da operação pelo id de um convite de professor respondem NAO_ENCONTRADO, e nada é gravado', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      // O professor da escola, inativo, com o convite de professor em aberto, gravado direto no banco: a 0018 o permite.
      const { rows: contas } = await pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`professor-${randomUUID()}@escola.invalid`])
      const { rows: usuarios } = await pool.query<{ id: string }>(
        "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'professor', 'Professor sintético', now()) returning id",
        [escola.escolaId, contas[0]?.id],
      )
      const { rows: convites } = await pool.query<{ id: string }>(
        "insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em) values ($1, $2, 'professor', $3, now() + interval '7 days') returning id",
        [escola.escolaId, createHash('sha256').update(randomUUID()).digest('hex'), usuarios[0]?.id],
      )
      const deProfessor = convites[0]?.id ?? ''
      const antes = await retrato(escola.escolaId, escola.quem.email)

      // A mesma resposta do id inexistente: nada diz que o convite existe.
      for (const resposta of [await refazer(sessao.token, deProfessor), await revogar(sessao.token, deProfessor), await refazer(sessao.token, randomUUID())]) {
        esperarErro(resposta, 404, ErrorCode.NAO_ENCONTRADO)
      }
      expect(await retrato(escola.escolaId, escola.quem.email)).toEqual(antes)
      // O convite da coordenação continua o último e em aberto: o do professor não entra no estado dela.
      expect(await estadoDe(escola.escolaId)).toBe('pendente')
      expect((await refazer(sessao.token, escola.conviteId ?? '')).status).toBe(201)
    })
  })

  describe('E6 e A1: refazer, em cada estado, dá o resultado da matriz, e o que não é permitido não grava nada', () => {
    it.each(ESTADOS_DA_COORDENACAO)('refazer o último convite em %s', async (estado) => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm(estado, sessao.token)
      const alvo = escola.conviteId ?? randomUUID()
      // O pendente abre antes do refazer; o vencido já não abria pelo prazo, e sai revogado.
      if (estado === 'pendente') expect((await consultar(escola.link ?? '')).status).toBe(200)
      const antes = await retrato(escola.escolaId, escola.quem.email)
      const convitesAntes = await convitesDa(escola.escolaId)
      const resposta = await refazer(sessao.token, alvo)
      expect(resposta.cacheControl).toBe('no-store')

      const esperado = REFAZER[estado]
      if (esperado !== 201) {
        esperarErro(resposta, esperado, CODIGO[esperado])
        expect(await retrato(escola.escolaId, escola.quem.email)).toEqual(antes)
        expect(await estadoDe(escola.escolaId)).toBe(estado)
        return
      }
      expect(resposta.status).toBe(201)
      const { conviteId: novo, token } = gerado(resposta)
      const usuarioId = convitesAntes.find((convite) => convite.id === alvo)?.usuario_id
      expect(usuarioId).toEqual(expect.any(String))
      // O de origem sai revogado, e o novo, em aberto, é do mesmo usuário; nada mais muda (usuário, nome, conta).
      const depois = await convitesDa(escola.escolaId)
      expect(depois.find((convite) => convite.id === alvo)).toMatchObject({ aberto: false, revogado: true })
      expect(depois.filter((convite) => convite.aberto)).toEqual([expect.objectContaining({ id: novo, usuario_id: usuarioId })])
      expect(new Set(depois.map((convite) => convite.id))).toEqual(new Set([...convitesAntes.map((convite) => convite.id), novo]))
      const { usuarios, contas } = await retrato(escola.escolaId, escola.quem.email)
      expect({ usuarios, contas }).toEqual({ usuarios: antes.usuarios, contas: antes.contas })
      expect(await estadoDe(escola.escolaId)).toBe('pendente')
      // O link de origem não abre mais, e o novo abre.
      esperarErro(await consultar(escola.link ?? ''), 404, ErrorCode.NAO_ENCONTRADO)
      expect((await consultar(token)).status).toBe(200)

      // A1: uma linha nova de auditoria, `convite.refeito` do convite novo, com a origem, o usuário e a validade gravada.
      const novas = (
        await pool.query<{ acao: string; entidade_id: string; autor_operador: string | null; autor_usuario_id: string | null; antes: unknown; depois: unknown }>(
          'select acao, entidade_id, autor_operador, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and not (id = any($2::uuid[]))',
          [escola.escolaId, antes.auditoria.map((linha: { id: string }) => linha.id)],
        )
      ).rows
      const expiraEm = depois.find((convite) => convite.id === novo)?.expira_em
      expect(novas).toEqual([
        { acao: 'convite.refeito', entidade_id: novo, autor_operador: sessao.apelido, autor_usuario_id: null, antes: null, depois: { tipo: 'coordenador', origemId: alvo, usuarioId, expiraEm: expiraEm?.toISOString() } },
      ])
      const validadeH = ((expiraEm?.getTime() ?? 0) - Date.now()) / HORA_MS
      expect(validadeH).toBeGreaterThan(71.9)
      expect(validadeH).toBeLessThanOrEqual(72)
      const texto = JSON.stringify(novas)
      for (const proibido of [escola.quem.nome, escola.quem.email, token, escola.link ?? '']) expect(texto).not.toContain(proibido)
    })

    it('refazer de convite que não é o último é CONFLITO sem gravar nada: o de origem de um refazer, e um em aberto de antes da trava', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      expect((await refazer(sessao.token, escola.conviteId ?? '')).status).toBe(201)
      const antes = await retrato(escola.escolaId, escola.quem.email)
      esperarErro(await refazer(sessao.token, escola.conviteId ?? ''), 409, ErrorCode.CONFLITO)
      expect(await retrato(escola.escolaId, escola.quem.email)).toEqual(antes)

      // Um convite em aberto de outro usuário, que vence antes do último: só dado de antes da trava chega a isso. O update
      // condicional o revogaria, e um convite novo nasceria para esse usuário: quem segura é "não é o último".
      const outraConta = pessoa()
      const { rows: contas } = await pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [outraConta.email])
      const { rows: antigos } = await pool.query<{ id: string }>(
        "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', now()) returning id",
        [escola.escolaId, contas[0]?.id],
      )
      const { rows: convites } = await pool.query<{ id: string }>(
        "insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em) values ($1, $2, 'coordenador', $3, now() + interval '1 hour') returning id",
        [escola.escolaId, createHash('sha256').update(randomUUID()).digest('hex'), antigos[0]?.id],
      )
      const antesDoAntigo = await retrato(escola.escolaId, outraConta.email)
      esperarErro(await refazer(sessao.token, convites[0]?.id ?? ''), 409, ErrorCode.CONFLITO)
      expect(await retrato(escola.escolaId, outraConta.email)).toEqual(antesDoAntigo)
    })
  })

  describe('E8 (refazer): em paralelo na mesma escola, com a ordem forçada pela trava, no fim há no máximo um convite em aberto', () => {
    it('dois refazer do mesmo convite: o primeiro refaz, o segundo recebe CONFLITO; um convite novo e um convite.refeito', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      const alvo = escola.conviteId ?? ''
      const [primeiro, segundo] = await emOrdemNaTrava(escola.escolaId, () => refazer(sessao.token, alvo), () => refazer(sessao.token, alvo))
      expect(primeiro.status).toBe(201)
      esperarErro(segundo, 409, ErrorCode.CONFLITO)
      expect((await convitesDa(escola.escolaId)).filter((convite) => convite.aberto).map((convite) => convite.id)).toEqual([gerado(primeiro).conviteId])
      expect(await auditoriaDe(escola.escolaId, 'convite.refeito')).toHaveLength(1)
    })

    it('refazer e depois revogar o mesmo convite: o refazer refaz, e o revogar acha o de origem já revogado (NAO_ENCONTRADO); o novo segue em aberto', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      const alvo = escola.conviteId ?? ''
      const [doRefazer, doRevogar] = await emOrdemNaTrava(escola.escolaId, () => refazer(sessao.token, alvo), () => revogar(sessao.token, alvo))
      expect(doRefazer.status).toBe(201)
      esperarErro(doRevogar, 404, ErrorCode.NAO_ENCONTRADO)
      expect((await convitesDa(escola.escolaId)).filter((convite) => convite.aberto).map((convite) => convite.id)).toEqual([gerado(doRefazer).conviteId])
      expect(await auditoriaDe(escola.escolaId, 'convite.refeito')).toHaveLength(1)
      expect(await auditoriaDe(escola.escolaId, 'convite.revogado')).toEqual([])
    })

    it('revogar e depois refazer o mesmo convite: o revogar revoga, e o refazer recebe o CONFLITO da matriz em revogado; nenhum em aberto', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      const alvo = escola.conviteId ?? ''
      const [doRevogar, doRefazer] = await emOrdemNaTrava(escola.escolaId, () => revogar(sessao.token, alvo), () => refazer(sessao.token, alvo))
      expect(doRevogar.status).toBe(204)
      esperarErro(doRefazer, 409, ErrorCode.CONFLITO)
      expect(await abertos(escola.escolaId)).toBe(0)
      expect((await convitesDa(escola.escolaId)).map((convite) => convite.id)).toEqual([alvo])
      expect(await auditoriaDe(escola.escolaId, 'convite.refeito')).toEqual([])
      expect(await estadoDe(escola.escolaId)).toBe('revogado')
    })
  })

  describe('E9: sem a trava da escola, o refazer continua deixando um só convite em aberto', () => {
    it('dois refazer do mesmo convite, os dois já depois da leitura do estado: o segundo espera a linha no update condicional e recebe CONFLITO', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      const alvo = escola.conviteId ?? ''
      const semTrava = semATravaDaEscola(banco)
      const gatilho = new GatilhoDeParada(pool, { tabela: 'convite', evento: 'update', quando: `new.id = '${alvo}'::uuid` })
      await gatilho.armar()
      try {
        const primeiro = refazerConviteDaCoordenacao(semTrava, autorDaBancada, alvo).catch((erro: unknown) => erro)
        // O primeiro já revogou a origem e está parado antes de criar o novo, com a linha dela presa.
        await gatilho.esperarParadas()
        const segundo = refazerConviteDaCoordenacao(semTrava, autorDaBancada, alvo).catch((erro: unknown) => erro)
        // Com a trava, o segundo esperaria nela (no `select pg_advisory_xact_lock`); sem ela, passa pela leitura do estado
        // (o primeiro não confirmou: ainda `pendente`, e a origem é a última) e para no update da mesma linha. São dois
        // parados em `update "convite"`: o primeiro no gatilho, o segundo na linha.
        await esperarNaTrava(pool, '%update "convite"%', 2)
        await gatilho.soltar()
        expect(await primeiro).toEqual({ conviteId: expect.any(String), token: expect.any(String), escolaId: escola.escolaId })
        expect(await segundo).toBeInstanceOf(DomainException)
        expect(await segundo).toMatchObject({ codigo: ErrorCode.CONFLITO })
      } finally {
        await gatilho.desarmar()
      }
      expect(await abertos(escola.escolaId)).toBe(1)
      expect(await auditoriaDe(escola.escolaId, 'convite.refeito')).toHaveLength(1)
    })

    it('o aceite no meio do refazer, com o refazer sem a trava: o update condicional vê o convite usado, e o refazer recebe CONFLITO sem convite novo', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      const alvo = escola.conviteId ?? ''
      const gatilho = new GatilhoDeParada(pool, { tabela: 'convite', evento: 'update', quando: `new.id = '${alvo}'::uuid and new.usado_em is not null` })
      await gatilho.armar()
      try {
        // O aceite pega a trava da escola (4.0) e para no gatilho, com a linha do convite presa. O refazer, sem a trava
        // (a mutação), lê `pendente` (o aceite não confirmou) e para no update da linha: é o update condicional que o
        // segura. Com a trava, quem segura é ela, e a E15(d) cobre as duas ordens.
        const aceite = aceitar(escola.link ?? '', SENHA)
        await gatilho.esperarParadas()
        const doRefazer = refazerConviteDaCoordenacao(semATravaDaEscola(banco), autorDaBancada, alvo).catch((erro: unknown) => erro)
        await esperarNaTrava(pool, '%set "revogado_em"%')
        await gatilho.soltar()
        expect((await aceite).corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
        expect(await doRefazer).toBeInstanceOf(DomainException)
        expect(await doRefazer).toMatchObject({ codigo: ErrorCode.CONFLITO })
      } finally {
        await gatilho.desarmar()
      }
      expect((await convitesDa(escola.escolaId)).map((convite) => convite.id)).toEqual([alvo])
      expect(await auditoriaDe(escola.escolaId, 'convite.refeito')).toEqual([])
      expect(await estadoDe(escola.escolaId)).toBe('ativa')
    })
  })

  describe('L4 (tarefa 5.0): a lista mostra o estado e o conviteId da escrita', () => {
    it('para cada estado da E6, e o convite novo depois de um refazer, pela GET /v1/operacao/escolas', async () => {
      const sessao = await operadores.operadorComSessao()
      // A lista é de todas as escolas do banco de teste, que guarda as de execuções anteriores (milhares no banco local):
      // com o nome que vem primeiro na ordem por nome, as escolas deste teste estão todas na primeira página, e o teste
      // não depende de quantas escolas o banco tem (percorrer todas estourava o limite de 120 pedidos por minuto).
      const nome = nomeQueVemPrimeiro('Escola sintética do L4')
      const preparadas: [EstadoDaCoordenacao, EscolaPreparada][] = []
      for (const estado of ESTADOS_DA_COORDENACAO) preparadas.push([estado, await escolaEm(estado, sessao.token, nome)])
      // Com dois convites na escola (a origem revogada e o refeito), o último é o refeito.
      const origem = await escolaEm('pendente', sessao.token, nome)
      if (origem.conviteId === undefined) throw new Error('convite de origem')
      const refeito = gerado(await refazer(sessao.token, origem.conviteId))

      const leitor = await operadores.operadorComSessao()
      const resposta = await pedir(url, 'GET', '/v1/operacao/escolas?pagina=1&ordem=nome', leitor.token)
      expect(resposta.status).toBe(200)
      const { itens } = escolasDoPainelResponseSchema.parse(resposta.corpo)
      const naLista = (escolaId: string) => {
        const achadas = itens.filter((item) => item.id === escolaId)
        expect(achadas).toHaveLength(1)
        return achadas[0]
      }
      for (const [estado, escola] of preparadas) {
        const item = naLista(escola.escolaId)
        expect(item?.estado, estado).toBe(estado)
        expect(item?.estado, estado).toBe(await estadoDe(escola.escolaId))
        expect(item?.conviteId, estado).toBe(escola.conviteId)
      }
      expect(naLista(origem.escolaId)).toMatchObject({ estado: 'pendente', conviteId: refeito.conviteId })
    })
  })

  describe('I6 (refazer): nenhuma resposta do refazer traz o que é da escola, nem em 400, 404, 409 e 503', () => {
    it('com sentinelas de coordenação, aluno e turma semeadas na escola', async () => {
      const sessao = await operadores.operadorComSessao()
      const escolaId = await escolas.escola()
      const sufixo = randomUUID().slice(0, 8)
      const coordenacao = { nome: `Coordenação Sentinela ${sufixo}`, email: `sentinela-${randomUUID()}@escola.invalid` }
      const aluno = { nome: `Aluno Sentinela ${sufixo}`, matricula: `MAT-SENTINELA-${sufixo}` }
      const turma = `Turma Sentinela ${sufixo}`
      const [alunoId] = await escolas.alunosComMatricula(escolaId, [{ matricula: aluno.matricula, senhaHash: 'hash-sintetico' }])
      await pool.query('update usuario set nome = $1 where id = $2', [aluno.nome, alunoId])
      const { rows: anos } = await pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
      const { rows: series } = await pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
      await pool.query('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4)', [escolaId, anos[0]?.id, series[0]?.id, turma])
      const deOrigem = gerado(await gerar(sessao.token, escolaId, coordenacao)).conviteId

      const respostas: Resposta[] = []
      const guardar = (resposta: Resposta) => {
        respostas.push(resposta)
        return resposta
      }
      esperarErro(guardar(await refazer(sessao.token, deOrigem, { autor: coordenacao.nome })), 400, ErrorCode.ENTRADA_INVALIDA)
      esperarErro(guardar(await refazer(sessao.token, randomUUID())), 404, ErrorCode.NAO_ENCONTRADO)
      const refeito = guardar(await refazer(sessao.token, deOrigem))
      expect(refeito.status).toBe(201)
      esperarErro(guardar(await refazer(sessao.token, deOrigem)), 409, ErrorCode.CONFLITO)

      // 503: numa API com o prazo das consultas curto, o refazer espera a trava que o teste segura até o
      // `statement_timeout` cortar; nada é gravado.
      const antes = await retrato(escolaId, coordenacao.email)
      // O logger da API é do processo: a segunda escreve no mesmo destino, e o log dos outros testes continua capturado.
      const curta = await subirApiDoPainel(linhasDeLog, {}, PRAZO_CURTO_MS)
      const soltar = await segurarTravaDaEscola(escolaId)
      try {
        const esgotado = guardar(await refazer(sessao.token, gerado(refeito).conviteId, undefined, curta.url))
        esperarErro(esgotado, 503, ErrorCode.TEMPO_ESGOTADO)
        expect(esgotado.retryAfter).not.toBeNull()
      } finally {
        await soltar()
        await curta.app.close()
      }
      expect(await retrato(escolaId, coordenacao.email)).toEqual(antes)

      expect(respostas.map((resposta) => resposta.status)).toEqual([400, 404, 201, 409, 503])
      for (const { texto } of respostas) for (const sentinela of [coordenacao.nome, coordenacao.email, aluno.nome, aluno.matricula, turma]) expect(texto).not.toContain(sentinela)
    })
  })

  describe('A2 e A3: o token só na resposta, e o log só com ids', () => {
    it('depois de gerar, o token não está em coluna de convite nem na auditoria, e o token_hash é o SHA-256 dele', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('aceito', sessao.token)
      const resposta = await gerar(sessao.token, escola.escolaId)
      const { conviteId, token } = gerado(resposta)
      const { rows: convites } = await pool.query<{ linha: string; token_hash: string }>('select to_jsonb(c)::text as linha, token_hash from convite c where c.escola_id = $1', [escola.escolaId])
      expect(convites.length).toBeGreaterThanOrEqual(2)
      for (const { linha } of convites) expect(linha).not.toContain(token)
      expect((await pool.query('select token_hash from convite where id = $1', [conviteId])).rows).toEqual([{ token_hash: createHash('sha256').update(token).digest('hex') }])
      const { rows: auditoria } = await pool.query<{ linha: string }>('select to_jsonb(a)::text as linha from auditoria a where a.escola_id = $1', [escola.escolaId])
      expect(auditoria.length).toBeGreaterThanOrEqual(3)
      for (const { linha } of auditoria) expect(linha).not.toContain(token)
    })

    it('depois de refazer, o token novo não está em coluna de convite nem na auditoria, e o token_hash é o SHA-256 dele', async () => {
      const sessao = await operadores.operadorComSessao()
      const escola = await escolaEm('pendente', sessao.token)
      const { conviteId, token } = gerado(await refazer(sessao.token, escola.conviteId ?? ''))
      const { rows: convites } = await pool.query<{ linha: string }>('select to_jsonb(c)::text as linha from convite c where c.escola_id = $1', [escola.escolaId])
      expect(convites).toHaveLength(2)
      for (const { linha } of convites) for (const link of [token, escola.link ?? '']) expect(linha).not.toContain(link)
      expect((await pool.query('select token_hash from convite where id = $1', [conviteId])).rows).toEqual([{ token_hash: createHash('sha256').update(token).digest('hex') }])
      const { rows: auditoria } = await pool.query<{ linha: string }>('select to_jsonb(a)::text as linha from auditoria a where a.escola_id = $1', [escola.escolaId])
      expect(auditoria.length).toBeGreaterThanOrEqual(2)
      for (const { linha } of auditoria) for (const link of [token, escola.link ?? '']) expect(linha).not.toContain(link)
    })

    it('as linhas de log do refazer, e das recusas dele, levam só ids: nada de nome, e-mail, endereço nem token', async () => {
      const sessao = await operadores.operadorComSessao()
      const escolaId = await escolas.escola()
      const slug = await escolas.slugDe(escolaId)
      const quem = { nome: `Coordenadora Sentinela ${randomUUID().slice(0, 8)}`, email: `sentinela-${randomUUID()}@escola.invalid` }
      const { conviteId, token: deOrigem } = gerado(await gerar(sessao.token, escolaId, quem))
      linhasDeLog.length = 0
      const { token } = gerado(await refazer(sessao.token, conviteId))
      esperarErro(await refazer(sessao.token, conviteId), 409, ErrorCode.CONFLITO)
      esperarErro(await refazer(sessao.token, randomUUID()), 404, ErrorCode.NAO_ENCONTRADO)

      expect(linhasComEvento('operacao.convite.refeito')).toEqual([expect.objectContaining({ escolaId })])
      const todoOLog = linhasDeLog.join('\n')
      for (const sentinela of [quem.nome, quem.email, slug, token, deOrigem, sessao.nome]) expect(todoOLog).not.toContain(sentinela)
    })

    it('as linhas de log do gerar e do revogar, e das recusas, levam só ids: nada de nome, e-mail, endereço nem token', async () => {
      const sessao = await operadores.operadorComSessao()
      const escolaId = await escolas.escola()
      const slug = await escolas.slugDe(escolaId)
      const quem = { nome: `Coordenadora Sentinela ${randomUUID().slice(0, 8)}`, email: `sentinela-${randomUUID()}@escola.invalid` }
      linhasDeLog.length = 0
      const resposta = await gerar(sessao.token, escolaId, quem)
      const { conviteId, token } = gerado(resposta)
      esperarErro(await gerar(sessao.token, escolaId, quem), 409, ErrorCode.CONFLITO)
      expect((await revogar(sessao.token, conviteId)).status).toBe(204)
      esperarErro(await revogar(sessao.token, conviteId), 404, ErrorCode.NAO_ENCONTRADO)

      expect(linhasComEvento('operacao.convite.gerado')).toEqual([expect.objectContaining({ escolaId })])
      expect(linhasComEvento('operacao.convite.revogado')).toEqual([expect.objectContaining({ escolaId })])
      const todoOLog = linhasDeLog.join('\n')
      for (const sentinela of [quem.nome, quem.email, slug, token, sessao.nome]) expect(todoOLog).not.toContain(sentinela)
    })
  })
})
