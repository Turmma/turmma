import { JobOutbox, JobOutboxRepository, loadChaveDoTokenDeEmail, runInContext, SecretCipher, VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, type Clock } from '@educa/core'
import { ErrorCode, InvariantException, TIPO_ENVIAR_EMAIL_DA_CONTA, TIPO_EXPURGAR_ACESSO } from '@educa/shared'
import type { Redis } from 'ioredis'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { travarRedis } from '../../../tools/testes/redis-travado.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { HashBulkhead, PasswordHasher, REDIS_LOGIN_CLIENT, WindowCounter } from '../src/credencial/index.js'
import { SessaoFixtures } from './sessao.fixture.js'
import { subirApi, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS, testConfig } from './test-config.js'
import { esperarNaTrava } from './write-block-trigger.js'

/**
 * O "esqueci a senha" e o "redefinir" da equipe (acesso-e-convites, tarefa 5.0; RF12, RF17; `cenarios.md`, "E-mail, convite e posse", "Limites", "Corridas" e
 * "Auditoria"). Postgres e Redis reais do compose de teste. O piso de 400 ms se prova por relógio falso, nunca por cronômetro: o relógio do serviço fica parado e a
 * espera é um espião que registra quanto o serviço pediu. O e-mail em si sai pelo worker (`apps/worker/test/enviar-email*.int.test.ts`): aqui o que se prova é o pedido.
 */

const SENHA_NOVA = 'senha-sintetica-nova-12345'
const SENHA_ANTIGA = 'senha-sintetica-antiga-1'
const SENHA_OUTRA = 'outra-senha-sintetica-12345'
const SENHA_DO_PRIMEIRO = 'senha-sintetica-do-primeiro-1'
const SENHA_DO_SEGUNDO = 'senha-sintetica-do-segundo-2'
const PISO_MS = 400

interface Resposta {
  readonly status: number
  readonly texto: string
  readonly corpo: Record<string, unknown>
  readonly cabecalhos: Headers
}

/** O relógio do piso: parado onde o teste o põe. A espera registra o pedido e anda o relógio, como a espera de verdade andaria. */
class RelogioDoPiso implements Clock {
  #agora = new Date()
  readonly esperas: number[] = []
  agora(): Date {
    return this.#agora
  }
  reiniciar(): void {
    this.#agora = new Date()
    this.esperas.length = 0
  }
  /** O trabalho do pedido: o relógio anda sem passar pela espera do piso. */
  andar(ms: number): void {
    this.#agora = new Date(this.#agora.getTime() + ms)
  }
  readonly esperar = (ms: number): Promise<void> => {
    this.esperas.push(ms)
    this.#agora = new Date(this.#agora.getTime() + ms)
    return Promise.resolve()
  }
}

describe('acesso-e-convites, 5.0: o "esqueci a senha" e o "redefinir" da equipe', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const piso = new RelogioDoPiso()
  const linhasDeLog: string[] = []
  const cifra = new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, loadChaveDoTokenDeEmail(lerAmbienteDeTeste())]]))
  let api: TestApi
  let hash: PasswordHasher

  beforeAll(async () => {
    api = await subirApi(
      medidor.medidor,
      { ambiente: { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } },
      linhasDeLog,
      { ...TEST_APP_OPTIONS, pisoDoEsqueci: { relogio: piso, esperar: piso.esperar } },
    )
    hash = api.app.get(PasswordHasher, { strict: false })
    const redis = api.app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false })
    const prazo = performance.now() + 15_000
    while (redis.status !== 'ready') {
      if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
      await new Promise((resolver) => setTimeout(resolver, 20))
    }
  })

  beforeEach(() => {
    piso.reiniciar()
    linhasDeLog.length = 0
  })

  afterEach(() => vi.restoreAllMocks())

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const ipSorteado = () => `10.${[...randomBytes(3)].join('.')}`

  async function pedir(caminho: string, corpo: unknown, ip: string = ipSorteado()): Promise<Resposta> {
    const resposta = await fetch(`${api.url}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify(corpo) })
    const texto = await resposta.text()
    return { status: resposta.status, texto, corpo: texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo']), cabecalhos: resposta.headers }
  }

  const esqueci = (email: string, ip?: string) => pedir('/v1/senha/esqueci', { email }, ip)
  const redefinir = (token: string, senha = SENHA_NOVA, ip?: string) => pedir('/v1/senha/redefinir', { token, senha }, ip)

  interface Pessoa {
    readonly email: string
    readonly contaId: string
    /** O primeiro usuário da conta, na primeira escola. */
    readonly usuarioId: string
    /** Um usuário ativo por escola, na ordem pedida. */
    readonly usuarios: ReadonlyArray<{ escolaId: string; usuarioId: string }>
  }

  /** A única linha de um resultado que tem de ter uma. */
  const unica = <T>(linhas: readonly T[]): T => {
    const [primeira] = linhas
    if (primeira === undefined) throw new Error('a consulta devia devolver uma linha')
    return primeira
  }

  const inserirConta = async (email: string, mfa: boolean): Promise<string> => {
    const colunas = mfa ? ', mfa_segredo_cifrado, mfa_chave_versao, mfa_ativado_em' : ''
    const valores = mfa ? ", '\\x01'::bytea, 1, now()" : ''
    const { rows } = await bancada.pool.query<{ id: string }>(`insert into conta (email, senha_hash${colunas}) values ($1, $2${valores}) returning id`, [email, await hash.gerar(SENHA_ANTIGA)])
    return unica(rows).id
  }

  /** Uma conta com senha e um usuário em cada escola dada; `desativados` desliga o usuário das posições da lista. */
  async function pessoa(escolas: readonly string[], { desativados = [] as readonly number[], mfa = false, papel = 'professor' } = {}): Promise<Pessoa> {
    const email = `Equipe-${randomUUID()}@Escola.invalid`
    const contaId = await inserirConta(email, mfa)
    const usuarios: Array<{ escolaId: string; usuarioId: string }> = []
    for (const [posicao, escolaId] of escolas.entries()) {
      const desativadoEm = desativados.includes(posicao) ? 'now()' : 'null'
      const { rows } = await bancada.pool.query<{ id: string }>(
        `insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, '${papel}', 'Pessoa sintética', ${desativadoEm}) returning id`,
        [escolaId, contaId],
      )
      usuarios.push({ escolaId, usuarioId: unica(rows).id })
    }
    return { email, contaId, usuarioId: unica(usuarios).usuarioId, usuarios }
  }

  /** Uma sessão aberta da conta na escola do usuário. */
  async function sessaoAberta(contaId: string, escolaId: string, usuarioId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into sessao (escola_id, conta_id, usuario_id, metodo, familia, refresh_hash, expira_em)
       values ($1, $2, $3, 'email', $4, $5, now() + interval '1 day') returning id`,
      [escolaId, contaId, usuarioId, randomUUID(), randomBytes(32).toString('hex')],
    )
    return rows[0]?.id ?? ''
  }

  interface Link {
    readonly id: string
    readonly envio: string
    readonly usado: boolean
    readonly cifrados: boolean
    readonly expiraEmSegundos: number
  }

  const linksDe = async (contaId: string): Promise<Link[]> =>
    (
      await bancada.pool.query<{ id: string; envio: string; usado: boolean; cifrados: boolean; expira_em_s: number }>(
        `select id, envio, usado_em is not null as usado, token_cifrado is not null and destino_cifrado is not null as cifrados,
                extract(epoch from expira_em - now())::int as expira_em_s
           from link_da_conta where conta_id = $1 order by id`,
        [contaId],
      )
    ).rows.map((linha) => ({ id: linha.id, envio: linha.envio, usado: linha.usado, cifrados: linha.cifrados, expiraEmSegundos: linha.expira_em_s }))

  const abertosDe = async (contaId: string) => (await linksDe(contaId)).filter((link) => !link.usado)

  /** O token do link aberto, como o worker o leria da fila: decifrado com o id da linha como dado autenticado. */
  async function tokenDoLinkAberto(contaId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string; token_cifrado: Buffer }>('select id, token_cifrado from link_da_conta where conta_id = $1 and usado_em is null', [contaId])
    const linha = rows[0]
    if (linha === undefined) throw new Error('a conta não tem link aberto')
    return Buffer.from(cifra.decifrar({ cifrado: linha.token_cifrado, versao: VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL }, linha.id)).toString('utf8')
  }

  /** Um link de outra finalidade, aberto, semeado direto no banco (o de `verificar` é da 7.0): devolve o token em claro. */
  async function linkDeVerificar(contaId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    await bancada.pool.query(
      "insert into link_da_conta (conta_id, finalidade, token_hash, token_cifrado, destino_cifrado, expira_em, envio) values ($1, 'verificar', $2, '\\x01', '\\x01', now() + interval '1 hour', 'na_fila')",
      [contaId, createHash('sha256').update(token).digest('hex')],
    )
    return token
  }

  const jobsDoLink = async (contaId: string): Promise<number> =>
    (
      await bancada.pool.query<{ total: number }>(
        `select count(*)::int as total from job_registro j join link_da_conta l on (j.dados->>'linkId')::uuid = l.id where j.tipo = $1 and l.conta_id = $2 and j.escola_id is null`,
        [TIPO_ENVIAR_EMAIL_DA_CONTA, contaId],
      )
    ).rows[0]?.total ?? 0

  const auditoriaDe = async (escolaId: string, acao: string) =>
    (await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string | null; antes: unknown; depois: unknown; finalidade: string | null }>(
      'select entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = $2', [escolaId, acao],
    )).rows

  describe('esqueci', () => {
    it('e-mail com conta e e-mail sem conta: a mesma resposta, o mesmo piso de 400 ms, e o log só com ids', async () => {
      const escolaId = await bancada.escola()
      const { email, contaId } = await pessoa([escolaId])
      const semConta = `ninguem-${randomUUID()}@escola.invalid`

      const comConta = await esqueci(email)
      const esperasDaConta = [...piso.esperas]
      piso.reiniciar()
      const semContaResposta = await esqueci(semConta)

      expect(comConta.status).toBe(202)
      expect(semContaResposta.status).toBe(202)
      expect(comConta.texto).toBe('')
      expect(semContaResposta.texto).toBe('')
      expect(comConta.cabecalhos.get('cache-control')).toBe('no-store')
      expect(semContaResposta.cabecalhos.get('cache-control')).toBe('no-store')
      // O piso: o relógio parado diz que nada passou, e os dois esperaram os 400 ms inteiros.
      expect(esperasDaConta).toEqual([PISO_MS])
      expect(piso.esperas).toEqual([PISO_MS])
      // Só a conta que existe ganhou link, e o link tem o envio na fila com o job de sistema, sem escola.
      const abertos = await abertosDe(contaId)
      expect(abertos).toHaveLength(1)
      expect(abertos[0]).toMatchObject({ envio: 'na_fila', cifrados: true })
      expect(await jobsDoLink(contaId)).toBe(1)
      const texto = linhasDeLog.join('\n')
      // O rastro é o evento fixo com o id do link: nenhum e-mail, token nem id de conta no log.
      expect(texto).toContain('senha.link_na_fila')
      expect(texto).toContain(abertos[0]?.id)
      expect(texto).not.toContain(contaId)
      for (const segredo of [email, email.toLowerCase(), semConta, await tokenDoLinkAberto(contaId)]) expect(texto.includes(segredo), segredo).toBe(false)
    })

    it('o piso desconta o trabalho já feito: o relógio anda no meio do pedido e a espera é só o que falta, e nenhuma se o trabalho passou do piso', async () => {
      const escolaId = await bancada.escola()
      const { email } = await pessoa([escolaId])
      // O trabalho do pedido: os dois contadores (IP e e-mail) andam antes de olhar a conta, 75 ms cada, e é aí que o relógio do piso anda: 150 ms no total.
      const somar = WindowCounter.prototype.somar
      const trabalho = { ms: 75 }
      vi.spyOn(WindowCounter.prototype, 'somar').mockImplementation(function (this: WindowCounter, chave: string) {
        piso.andar(trabalho.ms)
        return somar.call(this, chave)
      })
      expect((await esqueci(email)).status).toBe(202)
      expect(piso.esperas).toEqual([PISO_MS - 150])
      piso.reiniciar()
      trabalho.ms = PISO_MS + 100
      expect((await esqueci(email)).status).toBe(202)
      expect(piso.esperas).toEqual([])
    })

    it('o e-mail digitado vale sem diferença de caixa e sem espaços nas pontas, como no login', async () => {
      const escolaId = await bancada.escola()
      const { email, contaId } = await pessoa([escolaId])
      expect((await esqueci(`  ${email.toUpperCase()}  `)).status).toBe(202)
      expect(await abertosDe(contaId)).toHaveLength(1)
    })

    it('o link vale 1 hora, com o token e o endereço cifrados, o banco guarda só o hash do token e o corpo da API nunca o devolve', async () => {
      const escolaId = await bancada.escola()
      const { email, contaId } = await pessoa([escolaId])
      const resposta = await esqueci(email)
      expect(resposta.texto).toBe('')
      const [link] = await abertosDe(contaId)
      // 1 h, com a folga do tempo que o pedido levou.
      expect(link?.expiraEmSegundos).toBeGreaterThan(3_600 - 60)
      expect(link?.expiraEmSegundos).toBeLessThanOrEqual(3_600)
      const token = await tokenDoLinkAberto(contaId)
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
      const { rows } = await bancada.pool.query<{ token_hash: string }>('select token_hash from link_da_conta where conta_id = $1', [contaId])
      // O banco guarda só o SHA-256 do token.
      expect(rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(rows[0]?.token_hash).not.toContain(token)
    })

    it('o link vencido, o usado e o substituído dão a mesma resposta de link inválido, e o link novo cancela o antigo na hora', async () => {
      const escolaId = await bancada.escola()
      const { email, contaId } = await pessoa([escolaId])
      await esqueci(email)
      const antigo = await tokenDoLinkAberto(contaId)
      await esqueci(email)
      const novo = await tokenDoLinkAberto(contaId)
      expect(novo).not.toBe(antigo)
      const links = await linksDe(contaId)
      expect(links).toHaveLength(2)
      // O antigo terminou: usado_em marca o fim, o envio que esperava virou `cancelado` e os cifrados saíram.
      const [primeiro, segundo] = links
      expect(primeiro).toMatchObject({ usado: true, envio: 'cancelado', cifrados: false })
      expect(segundo).toMatchObject({ usado: false, envio: 'na_fila', cifrados: true })
      expect(await abertosDe(contaId)).toHaveLength(1)

      const recusado = await redefinir(antigo)
      expect(recusado.status).toBe(404)
      expect((recusado.corpo['erro'] as { codigo: string }).codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      // Vencido: o prazo do banco, não o do cliente.
      await bancada.pool.query("update link_da_conta set expira_em = now() - interval '1 second' where conta_id = $1 and usado_em is null", [contaId])
      expect((await redefinir(novo)).status).toBe(404)
      // Nada trocou a senha.
      const { rows } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from conta where id = $1', [contaId])
      expect(await hash.verificar(rows[0]?.senha_hash, SENHA_ANTIGA)).toBe(true)
    })

    it('o "esqueci" de uma conta não cancela o link aberto de outra: o de B segue `na_fila`, com os cifrados, e o token dele ainda redefine', async () => {
      const escolaId = await bancada.escola()
      const a = await pessoa([escolaId])
      const b = await pessoa([escolaId])
      await esqueci(b.email)
      const tokenDeB = await tokenDoLinkAberto(b.contaId)
      await esqueci(a.email)
      await esqueci(a.email)
      // O segundo pedido de A cancelou o primeiro de A, e só ele.
      expect((await linksDe(a.contaId)).map((link) => link.envio)).toEqual(['cancelado', 'na_fila'])
      expect(await linksDe(b.contaId)).toEqual([expect.objectContaining({ usado: false, envio: 'na_fila', cifrados: true })])
      expect((await redefinir(tokenDeB)).status).toBe(204)
    })

    it('o token de outra finalidade não serve: o de `verificar` não redefine a senha e não ocupa o argon2, e o "esqueci" deixa o link de `verificar` aberto', async () => {
      const escolaId = await bancada.escola()
      const dona = await pessoa([escolaId])
      const tokenDeVerificar = await linkDeVerificar(dona.contaId)
      const geracoes = vi.spyOn(hash, 'gerar')
      const resposta = await redefinir(tokenDeVerificar)
      expect(resposta.status).toBe(404)
      expect(geracoes).not.toHaveBeenCalled()
      const { rows } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from conta where id = $1', [dona.contaId])
      expect(await hash.verificar(rows[0]?.senha_hash, SENHA_ANTIGA)).toBe(true)

      await esqueci(dona.email)
      await esqueci(dona.email)
      // Dois "esqueci" depois, o de `verificar` segue como estava: aberto, na fila, com os cifrados.
      const { rows: links } = await bancada.pool.query<{ finalidade: string; usado: boolean; envio: string }>('select finalidade, usado_em is not null as usado, envio from link_da_conta where conta_id = $1 order by finalidade, id', [dona.contaId])
      expect(links.filter((link) => link.finalidade === 'verificar')).toEqual([{ finalidade: 'verificar', usado: false, envio: 'na_fila' }])
      expect(links.filter((link) => link.finalidade === 'redefinir').map((link) => link.usado)).toEqual([true, false])
    })

    it('conta desligada: 202 sem link; o quarto pedido na hora: 202 e três envios, sem 429', async () => {
      const escolaId = await bancada.escola()
      const desligada = await pessoa([escolaId], { desativados: [0] })
      expect((await esqueci(desligada.email)).status).toBe(202)
      expect(await linksDe(desligada.contaId)).toEqual([])
      expect(await jobsDoLink(desligada.contaId)).toBe(0)

      const ativa = await pessoa([escolaId])
      const respostas = []
      for (let pedido = 0; pedido < 4; pedido++) respostas.push(await esqueci(ativa.email))
      expect(respostas.map((resposta) => resposta.status)).toEqual([202, 202, 202, 202])
      // Três links, três jobs: o quarto pedido na mesma hora passou do teto do e-mail (3/h) e terminou sem envio.
      expect(await linksDe(ativa.contaId)).toHaveLength(3)
      expect(await jobsDoLink(ativa.contaId)).toBe(3)
      expect(await abertosDe(ativa.contaId)).toHaveLength(1)
      // O teto vale também para o e-mail que não tem conta: contar só a conta diria que ela existe.
      const ninguem = `ninguem-${randomUUID()}@escola.invalid`
      for (let pedido = 0; pedido < 5; pedido++) expect((await esqueci(ninguem)).status).toBe(202)
    })

    it('balde rl:ip:senha cheio: 202 sem envio e nunca 429, e o login do mesmo IP segue', async () => {
      const escolaId = await bancada.escola()
      const ip = ipSorteado()
      const pessoas = await Promise.all(Array.from({ length: 13 }, () => pessoa([escolaId])))
      const respostas = []
      for (const { email } of pessoas) respostas.push(await esqueci(email, ip))
      expect(respostas.map((resposta) => resposta.status)).toEqual(Array.from({ length: 13 }, () => 202))
      const comLink = await Promise.all(pessoas.map(async ({ contaId }) => (await linksDe(contaId)).length))
      // Os 10 primeiros do minuto ganharam o link; os três seguintes, nenhum.
      expect(comLink).toEqual([...Array.from({ length: 10 }, () => 1), 0, 0, 0])
      // O piso vale também para quem passou do balde.
      expect(piso.esperas).toHaveLength(13)
      expect(piso.esperas.every((espera) => espera === PISO_MS)).toBe(true)

      // O login do mesmo IP não depende deste balde.
      const dona = pessoas[0]
      const entrada = await fetch(`${api.url}/v1/sessao/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
        body: JSON.stringify({ email: dona?.email, senha: SENHA_ANTIGA }),
      })
      expect(entrada.status).toBe(200)
    })

    it('o envio antigo preso na barreira (`enviando`): o "esqueci" seguinte o cancela, o token antigo é recusado e a resposta é 202 no piso, nunca 503', async () => {
      const escolaId = await bancada.escola()
      const { email, contaId } = await pessoa([escolaId])
      await esqueci(email)
      const antigo = await tokenDoLinkAberto(contaId)
      // O job de e-mail reservou a linha e o servidor SMTP ainda não respondeu.
      await bancada.pool.query("update link_da_conta set envio = 'enviando', envio_reservado_em = now() where conta_id = $1 and usado_em is null", [contaId])
      piso.reiniciar()
      const resposta = await esqueci(email)
      expect(resposta.status).toBe(202)
      expect(piso.esperas).toEqual([PISO_MS])
      const [velho, novo] = await linksDe(contaId)
      expect(velho).toMatchObject({ usado: true, envio: 'cancelado', cifrados: false })
      expect(novo).toMatchObject({ usado: false, envio: 'na_fila' })
      expect((await redefinir(antigo)).status).toBe(404)
    })

    it('dois "esqueci" ao mesmo tempo, o primeiro preso no insert: os dois respondem 202 no piso e fica um link aberto só', async () => {
      const escolaId = await bancada.escola()
      const { email, contaId } = await pessoa([escolaId])
      // O "primeiro" é uma transação nossa, que abre o link e não confirma: o pedido da API chega ao insert e espera na trava do índice único.
      const preso = await bancada.pool.connect()
      try {
        await preso.query('begin')
        await preso.query(
          "insert into link_da_conta (conta_id, finalidade, token_hash, token_cifrado, destino_cifrado, expira_em, envio) values ($1, 'redefinir', $2, '\\x01', '\\x01', now() + interval '1 hour', 'na_fila')",
          [contaId, randomBytes(32).toString('hex')],
        )
        const pedido = esqueci(email)
        await esperarNaTrava(bancada.pool, '%link_da_conta%')
        await preso.query('commit')
        const resposta = await pedido
        expect(resposta.status).toBe(202)
        // O perdedor do índice único respeita o piso, no `catch` e não só no caminho feliz.
        expect(piso.esperas).toEqual([PISO_MS])
      } finally {
        preso.release()
      }
      expect(await abertosDe(contaId)).toHaveLength(1)
      expect(await jobsDoLink(contaId)).toBe(0)
    })

    it('dois "esqueci" em paralelo da mesma conta: os dois 202 e um link aberto', async () => {
      const escolaId = await bancada.escola()
      const { email, contaId } = await pessoa([escolaId])
      const [a, b] = await Promise.all([esqueci(email), esqueci(email)])
      expect([a.status, b.status]).toEqual([202, 202])
      expect(await abertosDe(contaId)).toHaveLength(1)
    })
  })

  describe('redefinir', () => {
    const lerConta = async (contaId: string) =>
      unica((await bancada.pool.query<{ senha_hash: string; mfa_segredo_cifrado: Buffer; mfa_ativado_em: Date }>('select senha_hash, mfa_segredo_cifrado, mfa_ativado_em from conta where id = $1', [contaId])).rows)

    const sessoesEncerradas = async (ids: readonly string[]) =>
      (await bancada.pool.query<{ id: string; motivo: string | null; encerrada: boolean }>('select id, motivo, encerrada_em is not null as encerrada from sessao where id = any($1::uuid[]) order by id', [ids])).rows

    it('troca a senha, derruba as sessões da conta em todas as escolas e o MFA segue; o link não serve duas vezes', async () => {
      const escolas = [await bancada.escola(), await bancada.escola()]
      const dona = await pessoa(escolas, { mfa: true })
      const sessoes = await Promise.all(dona.usuarios.map(({ escolaId, usuarioId }) => sessaoAberta(dona.contaId, escolaId, usuarioId)))
      const outra = await pessoa(escolas.slice(0, 1))
      const sessaoDeOutra = await sessaoAberta(outra.contaId, unica(outra.usuarios).escolaId, outra.usuarioId)
      await esqueci(dona.email)
      const token = await tokenDoLinkAberto(dona.contaId)
      const antes = await lerConta(dona.contaId)
      const deOutraAntes = await lerConta(outra.contaId)

      const resposta = await redefinir(token)
      expect(resposta.status).toBe(204)
      expect(resposta.texto).toBe('')
      expect(resposta.cabecalhos.get('cache-control')).toBe('no-store')

      const depois = await lerConta(dona.contaId)
      expect(await hash.verificar(depois.senha_hash, SENHA_NOVA)).toBe(true)
      expect(await hash.verificar(depois.senha_hash, SENHA_ANTIGA)).toBe(false)
      // O MFA fica como estava.
      expect(depois.mfa_segredo_cifrado).toEqual(antes.mfa_segredo_cifrado)
      expect(depois.mfa_ativado_em).toEqual(antes.mfa_ativado_em)
      // A senha de outra conta não muda: a troca é da conta do link e de mais nenhuma.
      const deOutraDepois = await lerConta(outra.contaId)
      expect(deOutraDepois.senha_hash).toBe(deOutraAntes.senha_hash)
      expect(await hash.verificar(deOutraDepois.senha_hash, SENHA_ANTIGA)).toBe(true)
      // As sessões da conta, nas duas escolas, caíram com o motivo próprio; a de outra conta segue.
      const encerradas = await sessoesEncerradas([...sessoes, sessaoDeOutra])
      const daConta = encerradas.filter((sessao) => sessao.id !== sessaoDeOutra)
      expect(daConta).toHaveLength(2)
      expect(daConta.every((sessao) => sessao.encerrada && sessao.motivo === 'senha_redefinida')).toBe(true)
      expect(encerradas.find((sessao) => sessao.id === sessaoDeOutra)?.encerrada).toBe(false)
      // O link foi usado; o mesmo token não serve de novo, e a senha nova não muda por isso.
      expect(await abertosDe(dona.contaId)).toHaveLength(0)
      const repetido = await redefinir(token, SENHA_OUTRA)
      expect(repetido.status).toBe(404)
    })

    it('o MFA segue exigido: entrar com a senha nova pede o segundo fator', async () => {
      const coordenacao = await pessoa([await bancada.escola()], { mfa: true, papel: 'coordenador' })
      await esqueci(coordenacao.email)
      expect((await redefinir(await tokenDoLinkAberto(coordenacao.contaId))).status).toBe(204)
      const entrada = await fetch(`${api.url}/v1/sessao/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipSorteado() }, body: JSON.stringify({ email: coordenacao.email, senha: SENHA_NOVA }) })
      expect(entrada.status).toBe(200)
      expect(((await entrada.json()) as { etapa: string }).etapa).toBe('mfa')
    })

    it('grava `senha.redefinida` em cada escola com usuário ativo, com o usuário dela como autor e alvo, e nada da outra escola', async () => {
      const [a, b] = [await bancada.escola(), await bancada.escola()]
      const dona = await pessoa([a ?? '', b ?? ''])
      await esqueci(dona.email)
      expect((await redefinir(await tokenDoLinkAberto(dona.contaId))).status).toBe(204)
      // Exatamente dois registros da conta no total: um a mais, numa terceira escola, apareceria aqui.
      const { rows: doTotal } = await bancada.pool.query<{ escola_id: string }>("select escola_id from auditoria where acao = 'senha.redefinida' and autor_usuario_id = any($1::uuid[])", [dona.usuarios.map((usuario) => usuario.usuarioId)])
      expect(doTotal.map((linha) => linha.escola_id).sort()).toEqual([...dona.usuarios.map((usuario) => usuario.escolaId)].sort())
      for (const { escolaId, usuarioId } of dona.usuarios) {
        const registros = await auditoriaDe(escolaId, 'senha.redefinida')
        expect(registros).toHaveLength(1)
        expect(registros[0]).toMatchObject({ entidade_id: usuarioId, autor_usuario_id: usuarioId, antes: null, depois: null, finalidade: null })
        // Nada da outra escola: o registro de A não cita o usuário de B, e vice-versa.
        const dosOutros = dona.usuarios.filter((outro) => outro.escolaId !== escolaId).map((outro) => outro.usuarioId)
        expect(JSON.stringify(registros)).not.toContain(dosOutros[0])
      }
    })

    it('usuário da conta desativado em B: o registro vai só para A', async () => {
      const [a, b] = [await bancada.escola(), await bancada.escola()]
      const dona = await pessoa([a ?? '', b ?? ''], { desativados: [1] })
      await esqueci(dona.email)
      expect((await redefinir(await tokenDoLinkAberto(dona.contaId))).status).toBe(204)
      expect(await auditoriaDe(a ?? '', 'senha.redefinida')).toHaveLength(1)
      expect(await auditoriaDe(b ?? '', 'senha.redefinida')).toEqual([])
    })

    it('a eliminação agendada numa escola não tira a conta do "esqueci": ganha o link, redefine, e o registro vai também para a escola da eliminação, só com ids; o mesmo com a única escola agendada', async () => {
      const [a, b] = [await bancada.escola(), await bancada.escola()]
      const dona = await pessoa([a, b])
      await bancada.pool.query("update usuario set eliminacao_agendada_em = now() + interval '30 days' where id = $1", [unica(dona.usuarios.filter((u) => u.escolaId === b)).usuarioId])
      await esqueci(dona.email)
      expect(await abertosDe(dona.contaId)).toHaveLength(1)
      expect((await redefinir(await tokenDoLinkAberto(dona.contaId))).status).toBe(204)
      for (const { escolaId, usuarioId } of dona.usuarios) {
        expect((await auditoriaDe(escolaId, 'senha.redefinida')).map((registro) => registro.entidade_id)).toEqual([usuarioId])
      }

      // Só com a eliminação agendada, na única escola: o link sai e o registro vai a ela; o login por e-mail segue barrado ali (`ACESSO_SUSPENSO`, caso próprio do login).
      const sozinha = await pessoa([a])
      await bancada.pool.query("update usuario set eliminacao_agendada_em = now() + interval '30 days' where id = $1", [sozinha.usuarioId])
      await esqueci(sozinha.email)
      expect((await redefinir(await tokenDoLinkAberto(sozinha.contaId))).status).toBe(204)
      const { rows: daSozinha } = await bancada.pool.query<{ escola_id: string; entidade_id: string }>(
        "select escola_id, entidade_id from auditoria where acao = 'senha.redefinida' and autor_usuario_id = $1", [sozinha.usuarioId],
      )
      expect(daSozinha).toEqual([{ escola_id: a, entidade_id: sozinha.usuarioId }])
    })

    it('usuário desativado entre o link e o redefinir: link inválido, sem registro e sem troca, nunca 500', async () => {
      const escolaId = await bancada.escola()
      const dona = await pessoa([escolaId])
      await esqueci(dona.email)
      const token = await tokenDoLinkAberto(dona.contaId)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [dona.usuarioId])
      const resposta = await redefinir(token)
      expect(resposta.status).toBe(404)
      expect((resposta.corpo['erro'] as { codigo: string }).codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      expect(await auditoriaDe(escolaId, 'senha.redefinida')).toEqual([])
      const { rows } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from conta where id = $1', [dona.contaId])
      expect(await hash.verificar(rows[0]?.senha_hash, SENHA_ANTIGA)).toBe(true)
    })

    it('o usuário desativado depois da leitura do link, antes da transação: a conta travada decide, e a resposta é a do link inválido', async () => {
      const escolaId = await bancada.escola()
      const dona = await pessoa([escolaId])
      await esqueci(dona.email)
      const token = await tokenDoLinkAberto(dona.contaId)
      // Passa pelo pré-confere do token, mas a desativação chega antes da transação do redefinir: o hash foi gerado e a transação confere de novo.
      const gerar = hash.gerar.bind(hash)
      vi.spyOn(hash, 'gerar').mockImplementation(async (senha: string) => {
        await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [dona.usuarioId])
        return gerar(senha)
      })
      const resposta = await redefinir(token)
      expect(resposta.status).toBe(404)
      expect(await auditoriaDe(escolaId, 'senha.redefinida')).toEqual([])
      const { rows } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from conta where id = $1', [dona.contaId])
      expect(await hash.verificar(rows[0]?.senha_hash, SENHA_ANTIGA)).toBe(true)
      // O link não foi gasto: a transação foi desfeita inteira.
      expect(await abertosDe(dona.contaId)).toHaveLength(1)
    })

    it('token inválido não ocupa o semáforo do argon2: nem o hash da senha nova nem a vez no balde', async () => {
      const geracoes = vi.spyOn(hash, 'gerar')
      const semaforo = vi.spyOn(api.app.get(HashBulkhead, { strict: false }), 'executar')
      for (const token of ['', 'x', randomBytes(32).toString('base64url'), 'a'.repeat(128)]) {
        if (token === '') {
          // O corpo inválido nem chega ao service.
          expect((await redefinir(token)).status).toBe(400)
        } else {
          expect((await redefinir(token)).status).toBe(404)
        }
      }
      expect(geracoes).not.toHaveBeenCalled()
      expect(semaforo).not.toHaveBeenCalled()
    })

    it('a senha curta é recusada antes de tudo, e o corpo com chave a mais também', async () => {
      const escolaId = await bancada.escola()
      const dona = await pessoa([escolaId])
      await esqueci(dona.email)
      const token = await tokenDoLinkAberto(dona.contaId)
      expect((await redefinir(token, 'curta')).status).toBe(400)
      expect((await pedir('/v1/senha/redefinir', { token, senha: SENHA_NOVA, escolaId })).status).toBe(400)
      expect((await pedir('/v1/senha/esqueci', { email: dona.email, escolaId })).status).toBe(400)
      expect(await abertosDe(dona.contaId)).toHaveLength(1)
    })

    it('dois "redefinir" com o mesmo token, o primeiro parado depois de ler o link e o segundo terminando antes: um só troca', async () => {
      const escolaId = await bancada.escola()
      const dona = await pessoa([escolaId])
      await esqueci(dona.email)
      const token = await tokenDoLinkAberto(dona.contaId)
      // A ordem forçada: o primeiro leu o link (válido) e espera no argon2; o segundo lê o mesmo link, troca a senha e confirma; só então o primeiro segue para a transação.
      const gerar = hash.gerar.bind(hash)
      let liberar: () => void = () => undefined
      const portao = new Promise<void>((resolver) => (liberar = resolver))
      let primeiroChegou: () => void = () => undefined
      const chegou = new Promise<void>((resolver) => (primeiroChegou = resolver))
      const geracoes = vi.spyOn(hash, 'gerar').mockImplementationOnce(async (senha: string) => {
        primeiroChegou()
        await portao
        return gerar(senha)
      })
      const primeiro = redefinir(token, SENHA_DO_PRIMEIRO)
      await chegou
      expect(geracoes).toHaveBeenCalledTimes(1)
      const segundo = await redefinir(token, SENHA_DO_SEGUNDO)
      expect(segundo.status).toBe(204)
      liberar()
      const resposta = await primeiro
      expect(resposta.status).toBe(404)
      expect(await auditoriaDe(escolaId, 'senha.redefinida')).toHaveLength(1)
      const { rows } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from conta where id = $1', [dona.contaId])
      expect(await hash.verificar(rows[0]?.senha_hash, SENHA_DO_SEGUNDO)).toBe(true)
      expect(await hash.verificar(rows[0]?.senha_hash, SENHA_DO_PRIMEIRO)).toBe(false)
    })
  })

  describe('o job da conta na fila', () => {
    it('outro `sistema.*` pedido por requisição é recusado (sem `rotinaDoSistema`); o da conta passa, sempre com escola nula', async () => {
      const escolaId = await bancada.escola()
      const fila = new JobOutbox(new JobOutboxRepository(bancada.banco))
      await expect(
        runInContext({ requisicaoId: randomUUID() }, () => bancada.banco.transaction((tx) => fila.enfileirar(tx, TIPO_EXPURGAR_ACESSO, {}))),
      ).rejects.toThrow(InvariantException)
      // Nem com a escola no contexto: o tipo de rotina só nasce da rotina.
      await expect(
        runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.banco.transaction((tx) => fila.enfileirar(tx, TIPO_EXPURGAR_ACESSO, {}))),
      ).rejects.toThrow(InvariantException)

      // O e-mail da conta, pedido no aceite (com escola no contexto), nasce com escola nula.
      const linkId = randomUUID()
      const jobId = await runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.banco.transaction((tx) => fila.enfileirar(tx, TIPO_ENVIAR_EMAIL_DA_CONTA, { linkId })))
      const { rows } = await bancada.pool.query<{ escola_id: string | null; tipo: string }>('select escola_id, tipo from job_registro where id = $1', [jobId])
      expect(rows[0]).toEqual({ escola_id: null, tipo: TIPO_ENVIAR_EMAIL_DA_CONTA })
    })
  })
  describe('o seguro em memória, com o Redis de fila fora', () => {
    it('os baldes do "esqueci" caem para o seguro e o limite divide pelas instâncias (3 por hora ÷ 4 = 1): o segundo pedido da hora já não abre link', async () => {
      const escolaId = await bancada.escola()
      const dona = await pessoa([escolaId])
      // A aplicação montada como no contêiner: 4 instâncias dividem o limite, e o Redis de fila responde em 100 ms (ou nem responde).
      const instancia = await subirApi(medidor.medidor, { ambiente: { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1', LIMITE_INSTANCIAS_API: '4' }, login: { prazoDoRedisMs: 100 } }, undefined, { pisoDoEsqueci: { relogio: piso, esperar: piso.esperar } })
      try {
        const redis = instancia.app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false })
        const prazo = performance.now() + 15_000
        while (redis.status !== 'ready') {
          if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
          await new Promise((resolver) => setTimeout(resolver, 20))
        }
        const travado = await travarRedis(testConfig().redisFilaUrl, 4_000)
        let voltou = false
        void travado.fim.then(() => {
          voltou = true
        })
        const pedidos = []
        for (let pedido = 0; pedido < 3; pedido++) {
          pedidos.push(await fetch(`${instancia.url}/v1/senha/esqueci`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipSorteado() }, body: JSON.stringify({ email: dona.email }) }))
        }
        expect(voltou, 'o Redis voltou antes do terceiro pedido: a máquina está lenta demais para este caso').toBe(false)
        await travado.fim
        expect(pedidos.map((resposta) => resposta.status)).toEqual([202, 202, 202])
        // Só o primeiro passou do seguro (limite 1 na instância); com o limite cheio (3) os três teriam aberto link, e o aberto seria o terceiro.
        expect(await linksDe(dona.contaId)).toHaveLength(1)
      } finally {
        await instancia.app.close()
      }
    }, 60_000)
  })
})
