import { CotaPorHora, createQueueRedisClient, ExpurgoDaEscolaRepository, loadChaveDoTokenDeEmail, runInContext, SecretCipher, VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, type Clock } from '@educa/core'
import {
  CONVITES_POR_HORA_POR_ESCOLA,
  ErrorCode,
  InvariantException,
  ESTADOS_DO_ENVIO,
  conviteDeProfessorResponseSchema,
  enviarConvitesResponseSchema,
  listaDeProfessoresResponseSchema,
  TIPO_ENVIAR_CONVITE,
  type EstadoDoEnvio,
} from '@educa/shared'
import type { Redis } from 'ioredis'
import { createHash, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { REDIS_LOGIN_CLIENT } from '../src/credencial/index.js'
import { esperarNaTravaDaEscola } from './escola-lock.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { subirApi, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import { WriteBlockTrigger } from './write-block-trigger.js'

/**
 * O "Enviar convites" da coordenação (acesso-e-convites, tarefa 3.0; RF11, RF16, RF17; `cenarios.md`, "E-mail, convite e posse", "Isolamento" e
 * "Auditoria"): o filtro por estado, a cota de 300/h por escola, o convite novo de canal `email` com o envio na fila, o `convite.enviado` e a lista
 * com o `envio`. Postgres e Redis reais do compose de teste. O e-mail em si sai pelo worker (tarefas 1.0 e 2.0): aqui o que se prova é o pedido.
 */

const PRAZO_DAS_CONSULTAS_MS = 15_000
const MINUTO_MS = 60_000

interface Resposta {
  readonly status: number
  readonly corpo: Record<string, unknown> & { erro?: Record<string, unknown> }
  readonly texto: string
  readonly retryAfter: number | null
}

type EstadoSemeado = 'pendente' | 'vencido' | 'revogado' | 'aceito' | 'ativo' | 'desativado'

/** O relógio que a API usa para a validade do convite e para a janela da cota: o real, com um deslocamento que o teste avança. */
class RelogioDeslocavel implements Clock {
  #deslocamentoMs = 0
  agora(): Date {
    return new Date(Date.now() + this.#deslocamentoMs)
  }
  avancar(ms: number): void {
    this.#deslocamentoMs += ms
  }
  /** Volta ao relógio real: cada caso começa na hora de agora, e não depende de quanto o anterior avançou. */
  restaurar(): void {
    this.#deslocamentoMs = 0
  }
}

const hashSorteado = (): string => createHash('sha256').update(randomUUID()).digest('hex')

describe('acesso-e-convites, 3.0: a coordenação envia os convites por e-mail', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const relogio = new RelogioDeslocavel()
  const cifraDoTeste = new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, loadChaveDoTokenDeEmail(lerAmbienteDeTeste())]]))
  let api: TestApi
  let redis: Redis
  let cota: CotaPorHora

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { banco: { timeoutConsultaMs: PRAZO_DAS_CONSULTAS_MS } }, undefined, { ...TEST_APP_OPTIONS, relogioDosConvites: relogio })
    redis = api.app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false })
    cota = api.app.get(CotaPorHora, { strict: false })
    const prazo = performance.now() + 15_000
    while (redis.status !== 'ready') {
      if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
      await new Promise((resolver) => setTimeout(resolver, 20))
    }
  })

  afterEach(() => relogio.restaurar())

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  async function pedir(metodo: string, caminho: string, token?: string, corpo?: unknown): Promise<Resposta> {
    const resposta = await fetch(`${api.url}${caminho}`, {
      method: metodo,
      headers: { ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    })
    const texto = await resposta.text()
    const espera = resposta.headers.get('retry-after')
    return { status: resposta.status, corpo: texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo']), texto, retryAfter: espera === null ? null : Number(espera) }
  }

  const enviar = (coordenacao: TestSessao, corpo: unknown = {}) => pedir('POST', '/v1/professores/convites/enviar', coordenacao.token, corpo)
  const listar = async (coordenacao: TestSessao) => listaDeProfessoresResponseSchema.parse((await pedir('GET', '/v1/professores?limite=100', coordenacao.token)).corpo).itens
  const consultar = (token: string) => pedir('POST', '/v1/convites/consultar', undefined, { token })

  async function escolaComCoordenacao(): Promise<{ escolaId: string; coordenacao: TestSessao }> {
    const escolaId = await bancada.escola()
    return { escolaId, coordenacao: await bancada.sessao(escolaId, 'coordenador') }
  }

  /** Um professor da escola no estado pedido (a matriz do `estadoDoProfessor`), semeado direto no banco, com o convite de canal `copiado`. */
  async function semear(escolaId: string, estado: EstadoSemeado, criadoHa = '0 seconds'): Promise<{ usuarioId: string; conviteId: string | undefined; email: string }> {
    const email = `professor-${randomUUID()}@escola.invalid`
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    const desativado = estado === 'ativo' ? 'null' : estado === 'aceito' ? "now() - interval '1 hour'" : 'now()'
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>(
      `insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'professor', 'Professor sintético', ${desativado}) returning id`,
      [escolaId, contas[0]?.id],
    )
    const usuarioId = usuarios[0]?.id ?? ''
    const colunas: Record<EstadoSemeado, string | undefined> = {
      pendente: "now() + interval '7 days', null, null",
      vencido: "now() - interval '1 day', null, null",
      revogado: "now() + interval '7 days', null, now()",
      aceito: "now() + interval '7 days', now() - interval '30 minutes', null",
      ativo: undefined,
      desativado: undefined,
    }
    const valores = colunas[estado]
    if (valores === undefined) return { usuarioId, conviteId: undefined, email }
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em, revogado_em, criado_em) values ($1, $2, 'professor', $3, ${valores}, now() - $4::interval) returning id`,
      [escolaId, hashSorteado(), usuarioId, criadoHa],
    )
    return { usuarioId, conviteId: rows[0]?.id, email }
  }

  // A ordem das linhas (`criado_em`, `id`) segue o relógio de parede, que nesta máquina recua: nenhuma asserção deve depender dela para dizer qual convite é qual.
  // Cada caso acha o seu pelo canal, pelo id que já tem ou pelo estado (`aberto`, `revogado`, `envio`).
  const convitesDe = async (usuarioId: string) =>
    (
      await bancada.pool.query<{ id: string; canal: string; envio: string | null; cifrado: boolean; destino: boolean; aberto: boolean; revogado: boolean; criado_ha_s: number }>(
        `select id, canal, envio, token_cifrado is not null as cifrado, destino_cifrado is not null as destino, usado_em is null and revogado_em is null as aberto, revogado_em is not null as revogado,
                extract(epoch from now() - criado_em)::int as criado_ha_s
           from convite where usuario_id = $1 order by criado_em, id`,
        [usuarioId],
      )
    ).rows
  const jobsDe = async (escolaId: string) =>
    (await bancada.pool.query<{ tipo: string; fila: string; dados: { conviteId: string } }>('select tipo, fila, dados from job_registro where escola_id = $1 and tipo = $2 order by id', [escolaId, TIPO_ENVIAR_CONVITE])).rows
  const auditoriaDe = async (escolaId: string, acao: string) =>
    (
      await bancada.pool.query<{ entidade: string; entidade_id: string; autor_usuario_id: string | null; antes: unknown; depois: Record<string, unknown> | null }>(
        'select entidade, entidade_id, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and acao = $2 order by id',
        [escolaId, acao],
      )
    ).rows
  const totalDeConvites = async (escolaId: string) => Number((await bancada.pool.query<{ total: string }>('select count(*) as total from convite where escola_id = $1', [escolaId])).rows[0]?.total)

  /** O token em claro de um convite de canal `email`, decifrado como o worker o faz (o id da linha é o dado autenticado). */
  async function tokenDoEnvio(conviteId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ token_cifrado: Buffer }>('select token_cifrado from convite where id = $1', [conviteId])
    const cifrado = rows[0]?.token_cifrado
    if (cifrado === undefined) throw new Error('convite sem token cifrado')
    return Buffer.from(cifraDoTeste.decifrar({ cifrado, versao: VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL }, conviteId)).toString('utf8')
  }

  /** O endereço em claro de um convite de canal `email`, decifrado como o worker o faz (o id da linha é o dado autenticado). */
  async function destinoDoEnvio(conviteId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ destino_cifrado: Buffer }>('select destino_cifrado from convite where id = $1', [conviteId])
    const cifrado = rows[0]?.destino_cifrado
    if (cifrado === undefined) throw new Error('convite sem endereço cifrado')
    return Buffer.from(cifraDoTeste.decifrar({ cifrado, versao: VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL }, conviteId)).toString('utf8')
  }

  describe('o filtro: só quem espera o convite entra, e a resposta é a contagem', () => {
    it('"Enviar" sem seleção exclui quem aceitou, inclui o vencido e o copiado, cifra token e endereço no convite novo e põe um job por convite na fila normal', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const pendente = await semear(escolaId, 'pendente')
      const vencido = await semear(escolaId, 'vencido')
      const aceito = await semear(escolaId, 'aceito')

      const resposta = await enviar(coordenacao)
      expect(resposta.status).toBe(200)
      expect(enviarConvitesResponseSchema.parse(resposta.corpo)).toEqual({ quantidade: 2 })

      const novos: string[] = []
      for (const professor of [pendente, vencido]) {
        const convites = await convitesDe(professor.usuarioId)
        expect(convites).toHaveLength(2)
        const antigo = convites.find((convite) => convite.canal === 'copiado')
        const novo = convites.find((convite) => convite.canal === 'email')
        expect(antigo).toMatchObject({ id: professor.conviteId, canal: 'copiado', envio: null, aberto: false })
        expect(novo).toMatchObject({ canal: 'email', envio: 'na_fila', cifrado: true, destino: true, aberto: true })
        novos.push(novo?.id ?? '')
        // O token cifrado é o do convite novo (abre o convite, 200), e o endereço cifrado, com o id da linha, é o da conta daquele professor e de mais ninguém.
        expect((await consultar(await tokenDoEnvio(novo?.id ?? ''))).status).toBe(200)
        expect(await destinoDoEnvio(novo?.id ?? '')).toBe(professor.email)
      }
      expect(await convitesDe(aceito.usuarioId)).toEqual([expect.objectContaining({ id: aceito.conviteId, canal: 'copiado', envio: null, aberto: false })])
      expect(await jobsDe(escolaId)).toEqual(novos.map((conviteId) => ({ tipo: TIPO_ENVIAR_CONVITE, fila: 'normal', dados: { conviteId } })))
    })

    it('seleção que mistura pendente, vencido, revogado, aceito, ativo, desativado, um id inexistente e o de outra escola: só pendente e vencido entram, e a contagem diz quantos, nunca 409', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const outra = await escolaComCoordenacao()
      const estados: EstadoSemeado[] = ['pendente', 'vencido', 'revogado', 'aceito', 'ativo', 'desativado']
      const professores = await Promise.all(estados.map((estado) => semear(escolaId, estado)))
      const deOutraEscola = await semear(outra.escolaId, 'pendente')
      const usuarioIds = [...professores.map((professor) => professor.usuarioId), randomUUID(), deOutraEscola.usuarioId]

      const resposta = await enviar(coordenacao, { usuarioIds })
      expect(resposta.status).toBe(200)
      expect(resposta.corpo).toEqual({ quantidade: 2 })
      for (const [indice, estado] of estados.entries()) {
        const convites = await convitesDe(professores[indice]?.usuarioId ?? '')
        expect(convites.filter((convite) => convite.canal === 'email'), estado).toHaveLength(estado === 'pendente' || estado === 'vencido' ? 1 : 0)
      }
      // O de outra escola ficou como estava, e nada dele foi para a fila.
      expect(await convitesDe(deOutraEscola.usuarioId)).toEqual([expect.objectContaining({ id: deOutraEscola.conviteId, canal: 'copiado', aberto: true })])
      expect(await jobsDe(outra.escolaId)).toEqual([])
    })

    it('seleção só de quem não espera o convite: 200 com zero, nada na fila, e a cota não se mexe', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const aceito = await semear(escolaId, 'aceito')
      const resposta = await enviar(coordenacao, { usuarioIds: [aceito.usuarioId] })
      expect(resposta).toMatchObject({ status: 200, corpo: { quantidade: 0 } })
      expect(await jobsDe(escolaId)).toEqual([])
      // Os 300 pontos continuam inteiros.
      expect((await cota.consumir(escolaId, CONVITES_POR_HORA_POR_ESCOLA)).resultado).toBe('concedido')
    })

    it('sem corpo vale `{}`: todos os que esperam, e a resposta não leva link nem endereço', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const pendente = await semear(escolaId, 'pendente')
      const resposta = await fetch(`${api.url}/v1/professores/convites/enviar`, { method: 'POST', headers: { Authorization: `Bearer ${coordenacao.token}` } })
      expect(resposta.status).toBe(200)
      const texto = await resposta.text()
      expect(JSON.parse(texto)).toEqual({ quantidade: 1 })
      expect(texto).not.toMatch(/token|escola\.invalid|convite/)
      expect(await convitesDe(pendente.usuarioId)).toHaveLength(2)
    })

    it('só o papel de professor entra, mesmo que o id venha na seleção; e a conta sem endereço (conta limpa) não entra nem gasta a cota', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const coordenador = await semear(escolaId, 'pendente')
      await bancada.pool.query("update usuario set papel = 'coordenador' where id = $1", [coordenador.usuarioId])
      const semEndereco = await semear(escolaId, 'pendente')
      await bancada.pool.query('update conta set email = null where id = (select conta_id from usuario where id = $1)', [semEndereco.usuarioId])
      const comEndereco = await semear(escolaId, 'pendente')

      const resposta = await enviar(coordenacao, { usuarioIds: [coordenador.usuarioId, semEndereco.usuarioId, comEndereco.usuarioId] })
      expect(resposta).toMatchObject({ status: 200, corpo: { quantidade: 1 } })
      expect(await convitesDe(coordenador.usuarioId)).toHaveLength(1)
      expect(await convitesDe(semEndereco.usuarioId)).toHaveLength(1)
      expect(await jobsDe(escolaId)).toHaveLength(1)
      // Só um ponto foi gasto: os outros 299 ainda cabem.
      expect((await cota.consumir(escolaId, CONVITES_POR_HORA_POR_ESCOLA - 1)).resultado).toBe('concedido')
    })

    it('corpo inválido é ENTRADA_INVALIDA e não grava nada: campo a mais, lista vazia, id que não é UUID', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const pendente = await semear(escolaId, 'pendente')
      for (const corpo of [{ escolaId }, { usuarioIds: [] }, { usuarioIds: ['1'] }, { usuarioIds: [pendente.usuarioId], papel: 'coordenador' }]) {
        const resposta = await enviar(coordenacao, corpo)
        expect(resposta.status, JSON.stringify(corpo)).toBe(400)
        expect(resposta.corpo.erro?.['codigo']).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect(await convitesDe(pendente.usuarioId)).toHaveLength(1)
      expect(await jobsDe(escolaId)).toEqual([])
    })

    it('escola sem ano em curso: funciona', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      expect(Number((await bancada.pool.query<{ total: string }>('select count(*) as total from ano_letivo where escola_id = $1', [escolaId])).rows[0]?.total)).toBe(0)
      await semear(escolaId, 'pendente')
      expect(await enviar(coordenacao)).toMatchObject({ status: 200, corpo: { quantidade: 1 } })
    })

    it('permissão: o professor, o aluno e quem não tem sessão não alcançam o "Enviar", e nada muda', async () => {
      const { escolaId } = await escolaComCoordenacao()
      const pendente = await semear(escolaId, 'pendente')
      for (const papel of ['professor', 'aluno'] as const) {
        const sessao = await bancada.sessao(escolaId, papel)
        const resposta = await enviar(sessao)
        expect(resposta.status, papel).toBe(404)
        expect(resposta.corpo.erro?.['codigo']).toBe(ErrorCode.NAO_ENCONTRADO)
      }
      expect((await pedir('POST', '/v1/professores/convites/enviar', undefined, {})).status).toBe(401)
      expect(await convitesDe(pendente.usuarioId)).toHaveLength(1)
      expect(await jobsDe(escolaId)).toEqual([])
    })

    it('isolamento: os `usuarioIds` da escola B são tratados como inexistentes pela coordenação da A, e nada de B vai para a fila', async () => {
      const a = await escolaComCoordenacao()
      const b = await escolaComCoordenacao()
      const daB = await semear(b.escolaId, 'pendente')
      const daA = await semear(a.escolaId, 'pendente')
      const apenasB = await enviar(a.coordenacao, { usuarioIds: [daB.usuarioId] })
      expect(apenasB).toMatchObject({ status: 200, corpo: { quantidade: 0 } })
      const inexistente = await enviar(a.coordenacao, { usuarioIds: [randomUUID()] })
      expect(inexistente.corpo).toEqual(apenasB.corpo)
      expect(await convitesDe(daB.usuarioId)).toEqual([expect.objectContaining({ id: daB.conviteId, canal: 'copiado', aberto: true })])
      expect(await jobsDe(b.escolaId)).toEqual([])
      expect(await auditoriaDe(b.escolaId, 'convite.enviado')).toEqual([])
      // Misturado com um da própria escola, só o da A entra.
      expect((await enviar(a.coordenacao, { usuarioIds: [daB.usuarioId, daA.usuarioId] })).corpo).toEqual({ quantidade: 1 })
      expect(await totalDeConvites(b.escolaId)).toBe(1)
    })
  })

  describe('a cota de 300 convites por hora, por escola', () => {
    it('conta o que entra, não a seleção: com 2 pontos restantes, a seleção de 6 (2 que entram) passa, e um "Enviar" de 1 logo depois recebe 429', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      expect((await cota.consumir(escolaId, CONVITES_POR_HORA_POR_ESCOLA - 2)).resultado).toBe('concedido')
      const estados: EstadoSemeado[] = ['pendente', 'vencido', 'aceito', 'revogado', 'ativo', 'desativado']
      const professores = await Promise.all(estados.map((estado) => semear(escolaId, estado)))
      const resposta = await enviar(coordenacao, { usuarioIds: professores.map((professor) => professor.usuarioId) })
      expect(resposta).toMatchObject({ status: 200, corpo: { quantidade: 2 } })

      const seguinte = await semear(escolaId, 'pendente')
      const recusado = await enviar(coordenacao, { usuarioIds: [seguinte.usuarioId] })
      expect(recusado.status).toBe(429)
      expect(recusado.corpo.erro?.['codigo']).toBe(ErrorCode.LIMITE_EXCEDIDO)
    })

    it('cota esgotada, relógio falso: 429 com `Retry-After` aos 59 min, e passa aos 61 min', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      expect((await cota.consumir(escolaId, CONVITES_POR_HORA_POR_ESCOLA)).resultado).toBe('concedido')
      const pendente = await semear(escolaId, 'pendente')

      const logoDepois = await enviar(coordenacao)
      expect(logoDepois.status).toBe(429)
      expect(logoDepois.retryAfter).toBeGreaterThan(3_500)
      expect(logoDepois.retryAfter).toBeLessThanOrEqual(3_600)

      relogio.avancar(59 * MINUTO_MS)
      const aos59 = await enviar(coordenacao)
      expect(aos59.status).toBe(429)
      expect(aos59.retryAfter).toBeLessThanOrEqual(60)

      relogio.avancar(2 * MINUTO_MS)
      expect(await enviar(coordenacao)).toMatchObject({ status: 200, corpo: { quantidade: 1 } })
      expect(await convitesDe(pendente.usuarioId)).toHaveLength(2)
    })

    it('lote maior que o que resta: 429 inteiro, nada na fila nem na auditoria; 40 com 30 restantes recusa, e logo depois um de 30 passa', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      expect((await cota.consumir(escolaId, CONVITES_POR_HORA_POR_ESCOLA - 30)).resultado).toBe('concedido')
      const professores: Array<Awaited<ReturnType<typeof semear>>> = []
      for (let i = 0; i < 40; i += 1) professores.push(await semear(escolaId, 'pendente'))
      const antes = await totalDeConvites(escolaId)

      const recusado = await enviar(coordenacao)
      expect(recusado.status).toBe(429)
      expect(await totalDeConvites(escolaId)).toBe(antes)
      expect(await jobsDe(escolaId)).toEqual([])
      expect(await auditoriaDe(escolaId, 'convite.enviado')).toEqual([])
      expect(await auditoriaDe(escolaId, 'convite.refeito')).toEqual([])

      // O recusado não gastou nada: os 30 que sobravam ainda passam.
      const trinta = professores.slice(0, 30).map((professor) => professor.usuarioId)
      expect(await enviar(coordenacao, { usuarioIds: trinta })).toMatchObject({ status: 200, corpo: { quantidade: 30 } })
      expect(await jobsDe(escolaId)).toHaveLength(30)
      expect((await enviar(coordenacao, { usuarioIds: [professores[30]?.usuarioId] })).status).toBe(429)
    })

    it('transação desfeita depois do consumo: a cota volta inteira, e nada fica na fila', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      for (let i = 0; i < 3; i += 1) await semear(escolaId, 'pendente')
      const nome = `teste_falha_${randomUUID().replaceAll('-', '').slice(0, 12)}`
      await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'falha de teste depois do consumo'; end $$`)
      await bancada.pool.query(`create trigger ${nome} before insert on job_registro for each row when (new.escola_id = '${escolaId}'::uuid) execute function ${nome}()`)
      try {
        const falhou = await enviar(coordenacao)
        expect(falhou.status).toBe(500)
      } finally {
        await bancada.pool.query(`drop trigger ${nome} on job_registro`)
        await bancada.pool.query(`drop function ${nome}()`)
      }
      expect(await jobsDe(escolaId)).toEqual([])
      expect(await auditoriaDe(escolaId, 'convite.enviado')).toEqual([])
      // Os 3 pontos voltaram: a escola ainda tem os 300 inteiros.
      expect((await cota.consumir(escolaId, CONVITES_POR_HORA_POR_ESCOLA)).resultado).toBe('concedido')
    })

    it('isolamento: a escola A sem cota recebe 429 e a B segue enviando', async () => {
      const a = await escolaComCoordenacao()
      const b = await escolaComCoordenacao()
      expect((await cota.consumir(a.escolaId, CONVITES_POR_HORA_POR_ESCOLA)).resultado).toBe('concedido')
      await semear(a.escolaId, 'pendente')
      await semear(b.escolaId, 'pendente')
      expect((await enviar(a.coordenacao)).status).toBe(429)
      expect(await enviar(b.coordenacao)).toMatchObject({ status: 200, corpo: { quantidade: 1 } })
    })

    it('[P] dois lotes de 200 com 300 restantes, ao mesmo tempo: um passa, o outro é recusado, e a soma nunca passa de 300', async () => {
      const dono = randomUUID()
      const emParalelo = new CotaPorHora(redis, { porHora: CONVITES_POR_HORA_POR_ESCOLA, instancias: 2, prefixo: `teste-${randomUUID()}` })
      const resultados = await Promise.all([emParalelo.consumir(dono, 200), emParalelo.consumir(dono, 200)])
      expect(resultados.map((resultado) => resultado.resultado).sort()).toEqual(['concedido', 'recusado'])
      // Dez de uma vez, de 40: cabem sete (280), e os três últimos são recusados.
      const outroDono = randomUUID()
      const dez = await Promise.all(Array.from({ length: 10 }, () => emParalelo.consumir(outroDono, 40)))
      expect(dez.filter((resultado) => resultado.resultado === 'concedido')).toHaveLength(7)
    })

    it('devolver tira os pontos só na janela em que foram gastos: na seguinte, não volta nada', async () => {
      const dono = randomUUID()
      const tempo = new RelogioDeslocavel()
      const limitada = new CotaPorHora(redis, { porHora: 10, instancias: 1, relogio: tempo, prefixo: `teste-${randomUUID()}` })
      const gasto = await limitada.consumir(dono, 10)
      if (gasto.resultado !== 'concedido') throw new Error('o primeiro consumo devia passar')
      expect(await limitada.devolver(gasto.gasto)).toBe(true)
      const deNovo = await limitada.consumir(dono, 10)
      if (deNovo.resultado !== 'concedido') throw new Error('os pontos devolvidos deviam estar livres')
      tempo.avancar(61 * MINUTO_MS)
      const daOutraJanela = await limitada.consumir(dono, 4)
      expect(daOutraJanela.resultado).toBe('concedido')
      // O ponto da janela que fechou não é mais ponto de ninguém.
      expect(await limitada.devolver(deNovo.gasto)).toBe(false)
      expect((await limitada.consumir(dono, 7)).resultado).toBe('recusado')
    })

    it('Redis de fila fora: vale o seguro em memória, 300 ÷ instâncias, a devolução volta ao seguro, e a janela de uma hora vale lá também', async () => {
      const caido = createQueueRedisClient('redis://127.0.0.1:1', 'teste-cota-fora', () => undefined)
      try {
        let avisos = 0
        const dono = randomUUID()
        const tempo = new RelogioDeslocavel()
        const seguro = new CotaPorHora(caido, { porHora: CONVITES_POR_HORA_POR_ESCOLA, instancias: 3, relogio: tempo, aoUsarOSeguro: () => (avisos += 1) })
        const cem = await seguro.consumir(dono, 100)
        expect(cem.resultado).toBe('concedido')
        expect((await seguro.consumir(dono, 1)).resultado).toBe('recusado')
        expect(avisos).toBe(2)
        if (cem.resultado !== 'concedido') return
        expect(cem.gasto.origem).toBe('memoria')
        expect(await seguro.devolver(cem.gasto)).toBe(true)
        const deNovo = await seguro.consumir(dono, 100)
        expect(deNovo.resultado).toBe('concedido')
        // Outra escola não divide o seguro com esta.
        expect((await seguro.consumir(randomUUID(), 100)).resultado).toBe('concedido')

        // Passada a hora, o seguro libera; e o ponto da janela que fechou não volta para a nova.
        tempo.avancar(61 * MINUTO_MS)
        const daOutraJanela = await seguro.consumir(dono, 60)
        expect(daOutraJanela.resultado).toBe('concedido')
        if (deNovo.resultado !== 'concedido') return
        expect(await seguro.devolver(deNovo.gasto)).toBe(false)
        expect((await seguro.consumir(dono, 41)).resultado).toBe('recusado')
      } finally {
        caido.disconnect()
      }
    })

    it('a API montada com 3 instâncias e o Redis de fila fora: o seguro vale 300 ÷ 3, e o lote de 101 é recusado inteiro, o de 100 passa e o 101º sozinho é recusado', async () => {
      const aviso: string[] = []
      const apiSemRedis = await subirApi(medidor.medidor, { ambiente: { REDIS_FILA_URL: 'redis://127.0.0.1:1', LIMITE_INSTANCIAS_API: '3' } }, aviso)
      try {
        const { escolaId, coordenacao } = await escolaComCoordenacao()
        const professores: Array<Awaited<ReturnType<typeof semear>>> = []
        for (let i = 0; i < 101; i += 1) professores.push(await semear(escolaId, 'pendente'))
        const enviarSemRedis = (usuarioIds?: string[]) =>
          fetch(`${apiSemRedis.url}/v1/professores/convites/enviar`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${coordenacao.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(usuarioIds === undefined ? {} : { usuarioIds }),
          })
        expect((await enviarSemRedis()).status).toBe(429)
        expect(await jobsDe(escolaId)).toEqual([])
        const cem = await enviarSemRedis(professores.slice(0, 100).map((professor) => professor.usuarioId))
        expect(cem.status).toBe(200)
        expect(await cem.json()).toEqual({ quantidade: 100 })
        expect((await enviarSemRedis([professores[100]?.usuarioId ?? ''])).status).toBe(429)
        expect(await jobsDe(escolaId)).toHaveLength(100)
        // O aviso do seguro sai, e a linha dele só leva ids (o contexto da requisição): nenhum nome, endereço, lote ou contagem.
        const linhasDoAviso = aviso.filter((linha) => linha.includes('convites.cota_no_seguro_em_memoria'))
        expect(linhasDoAviso.length).toBeGreaterThan(0)
        expect(Object.keys(JSON.parse(linhasDoAviso[0] ?? '{}') as object).sort()).toEqual(['escolaId', 'level', 'msg', 'origem', 'requisicaoId', 'servico', 'time', 'usuarioId'])
      } finally {
        await apiSemRedis.app.close()
      }
    })

    it('o que não é pedido de cota válido é recusado antes de gastar: pontos zero ou fracionados, cota e instâncias fora do inteiro positivo', async () => {
      const limitada = new CotaPorHora(redis, { porHora: 10, instancias: 1, prefixo: `teste-${randomUUID()}` })
      const dono = randomUUID()
      for (const pontos of [0, -1, 1.5]) await expect(limitada.consumir(dono, pontos), String(pontos)).rejects.toBeInstanceOf(InvariantException)
      expect((await limitada.consumir(dono, 10)).resultado).toBe('concedido')
      for (const porHora of [0, 1.5, -3]) expect(() => new CotaPorHora(redis, { porHora, instancias: 1 }), `porHora ${String(porHora)}`).toThrow(InvariantException)
      for (const instancias of [0, 1.5, -2]) expect(() => new CotaPorHora(redis, { porHora: 10, instancias }), `instâncias ${String(instancias)}`).toThrow(InvariantException)
    })

    it('o script que o Redis ainda não conhece é carregado na primeira vez (NOSCRIPT) e o gasto fica no Redis; resposta fora do formato é erro, não seguro', async () => {
      const chamadas: string[] = []
      const semScript = {
        evalsha: async () => {
          chamadas.push('evalsha')
          throw new Error('NOSCRIPT No matching script. Please use EVAL.')
        },
        eval: async () => {
          chamadas.push('eval')
          return [1, 1_000, 0]
        },
      } as unknown as Redis
      const carregada = await new CotaPorHora(semScript, { porHora: 10, instancias: 1 }).consumir(randomUUID(), 3)
      expect(carregada).toMatchObject({ resultado: 'concedido', gasto: { pontos: 3, janela: 1_000, origem: 'redis' } })
      expect(chamadas).toEqual(['evalsha', 'eval'])

      const estranho = { evalsha: async () => [1] } as unknown as Redis
      await expect(new CotaPorHora(estranho, { porHora: 10, instancias: 1 }).consumir(randomUUID(), 3)).rejects.toBeInstanceOf(InvariantException)

      // Um erro de outra natureza (sem ser NOSCRIPT) não tenta o `eval`: vai ao seguro.
      const chamadasDoOutro: string[] = []
      const quebrado = {
        evalsha: async () => {
          chamadasDoOutro.push('evalsha')
          throw new Error('LOADING Redis is loading the dataset in memory')
        },
        eval: async () => {
          chamadasDoOutro.push('eval')
          return [1, 1_000, 0]
        },
      } as unknown as Redis
      const noSeguro = await new CotaPorHora(quebrado, { porHora: 10, instancias: 1 }).consumir(randomUUID(), 3)
      expect(noSeguro).toMatchObject({ resultado: 'concedido', gasto: { origem: 'memoria' } })
      expect(chamadasDoOutro).toEqual(['evalsha'])
    })
  })

  describe('o convite novo, o envio na fila e a auditoria', () => {
    it('40 pendentes: os 40 ficam `na_fila`, a resposta volta sem esperar nenhum envio', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      for (let i = 0; i < 40; i += 1) await semear(escolaId, 'pendente')
      const resposta = await enviar(coordenacao)
      expect(resposta).toMatchObject({ status: 200, corpo: { quantidade: 40 } })
      const { rows } = await bancada.pool.query<{ envio: string; total: string }>("select envio, count(*) as total from convite where escola_id = $1 and canal = 'email' group by envio", [escolaId])
      expect(rows).toEqual([{ envio: 'na_fila', total: '40' }])
      expect(await jobsDe(escolaId)).toHaveLength(40)
    })

    it('`convite.enviado`: um registro por convite novo, com a coordenação como autora, o canal e o tipo, sem nome nem e-mail', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const um = await semear(escolaId, 'pendente')
      const dois = await semear(escolaId, 'vencido')
      await enviar(coordenacao)
      const novos = (await Promise.all([um, dois].map((professor) => convitesDe(professor.usuarioId)))).map((convites) => convites.find((convite) => convite.canal === 'email')?.id)
      const enviados = await auditoriaDe(escolaId, 'convite.enviado')
      expect(enviados).toHaveLength(2)
      expect(enviados.map((registro) => registro.entidade_id).sort()).toEqual([...novos].sort())
      for (const registro of enviados) {
        expect(registro).toMatchObject({ entidade: 'convite', autor_usuario_id: coordenacao.usuarioId, antes: null, depois: { tipo: 'professor', canal: 'email' } })
      }
      expect(JSON.stringify(enviados)).not.toMatch(/escola\.invalid|Professor sintético/)
    })

    it('"Copiar link" depois do "Enviar": o envio `na_fila` termina `cancelado`, sem cifrados, e o link antigo é recusado; com o envio `enviando`, o mesmo', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const naFila = await semear(escolaId, 'pendente')
      const enviando = await semear(escolaId, 'pendente')
      await enviar(coordenacao)
      const envioDe = async (usuarioId: string) => (await convitesDe(usuarioId)).filter((convite) => convite.canal === 'email')[0]
      const antigoNaFila = (await envioDe(naFila.usuarioId))?.id ?? ''
      const antigoEnviando = (await envioDe(enviando.usuarioId))?.id ?? ''
      const tokenNaFila = await tokenDoEnvio(antigoNaFila)
      const tokenEnviando = await tokenDoEnvio(antigoEnviando)
      await bancada.pool.query("update convite set envio = 'enviando', envio_reservado_em = now() where id = $1", [antigoEnviando])
      expect((await consultar(tokenNaFila)).status).toBe(200)

      for (const professor of [naFila, enviando]) {
        const copiado = await pedir('POST', `/v1/professores/${professor.usuarioId}/convite/refazer`, coordenacao.token, {})
        expect(copiado.status).toBe(201)
        expect(conviteDeProfessorResponseSchema.parse(copiado.corpo).usuarioId).toBe(professor.usuarioId)
      }
      for (const [conviteId, token] of [
        [antigoNaFila, tokenNaFila],
        [antigoEnviando, tokenEnviando],
      ] as const) {
        const { rows } = await bancada.pool.query('select envio, token_cifrado is null as sem_token, destino_cifrado is null as sem_destino, envio_reservado_em is null as sem_reserva from convite where id = $1', [conviteId])
        expect(rows).toEqual([{ envio: 'cancelado', sem_token: true, sem_destino: true, sem_reserva: true }])
        expect((await consultar(token)).status).toBe(404)
      }
    })

    it('"Enviar" e "Reenviar" sobre convite copiado de 2 dias: id novo, token copiado recusado, e as 24 h do envio parado contam do `criado_em` novo (o expurgo o fecha `falhou` só depois delas)', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const cadastrar = async (nome: string) => {
        const cadastrado = await pedir('POST', '/v1/professores', coordenacao.token, { nome, email: `copiado-${randomUUID()}@escola.invalid` })
        const copiado = conviteDeProfessorResponseSchema.parse(cadastrado.corpo)
        await bancada.pool.query("update convite set criado_em = now() - interval '2 days' where id = $1", [copiado.conviteId])
        expect((await consultar(copiado.token)).status).toBe(200)
        return copiado
      }
      const expurgar = (agora: Date) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => new ExpurgoDaEscolaRepository(bancada.banco).fecharEnviosParados(agora))

      // "Enviar" (todos os que esperam) sobre o copiado de 2 dias.
      const doEnviar = await cadastrar('Professor Sintético do Enviar')
      expect(await enviar(coordenacao)).toMatchObject({ status: 200, corpo: { quantidade: 1 } })
      // "Reenviar" (a seleção de um) sobre outro copiado de 2 dias.
      const doReenviar = await cadastrar('Professor Sintético do Reenviar')
      expect(await enviar(coordenacao, { usuarioIds: [doReenviar.usuarioId] })).toMatchObject({ status: 200, corpo: { quantidade: 1 } })

      for (const copiado of [doEnviar, doReenviar]) {
        const convitesDoCopiado = await convitesDe(copiado.usuarioId)
        const antigo = convitesDoCopiado.find((convite) => convite.canal === 'copiado')
        const novo = convitesDoCopiado.find((convite) => convite.canal === 'email')
        expect(antigo?.id).toBe(copiado.conviteId)
        expect(novo?.id).not.toBe(copiado.conviteId)
        expect(novo).toMatchObject({ canal: 'email', envio: 'na_fila', aberto: true })
        expect(novo?.criado_ha_s).toBeLessThan(60)
        expect((await consultar(copiado.token)).status).toBe(404)
      }

      // Outro "Reenviar", agora sobre o envio que ainda estava na fila: o anterior termina `cancelado`, e há um convite aberto só.
      const primeiroEnvio = (await convitesDe(doEnviar.usuarioId)).find((convite) => convite.canal === 'email')?.id ?? ''
      const tokenDoPrimeiroEnvio = await tokenDoEnvio(primeiroEnvio)
      expect(await enviar(coordenacao, { usuarioIds: [doEnviar.usuarioId] })).toMatchObject({ status: 200, corpo: { quantidade: 1 } })
      const convites = await convitesDe(doEnviar.usuarioId)
      // Cada estado preso ao envio que o produziu, e não à ordem das linhas: o primeiro envio, pelo id que ele já tinha, termina `cancelado`; o copiado não tem envio; o outro está na fila.
      expect(convites.find((convite) => convite.id === primeiroEnvio)?.envio).toBe('cancelado')
      expect(convites.find((convite) => convite.canal === 'copiado')?.envio).toBeNull()
      expect(convites.filter((convite) => convite.canal === 'email' && convite.id !== primeiroEnvio).map((convite) => convite.envio)).toEqual(['na_fila'])
      expect(convites.filter((convite) => convite.aberto)).toHaveLength(1)
      expect((await consultar(tokenDoPrimeiroEnvio)).status).toBe(404)

      // O expurgo da noite: os envios de agora não são parados (contar do convite copiado de 2 dias os fecharia); 25 h depois, são.
      expect(await expurgar(new Date())).toBe(0)
      expect((await convitesDe(doReenviar.usuarioId)).find((convite) => convite.canal === 'email')).toMatchObject({ envio: 'na_fila', cifrado: true, destino: true })
      expect(await expurgar(new Date(Date.now() + 25 * 60 * MINUTO_MS))).toBe(2)
      for (const copiado of [doEnviar, doReenviar]) {
        const aberto = (await convitesDe(copiado.usuarioId)).find((convite) => convite.aberto)
        expect(aberto).toMatchObject({ envio: 'falhou', cifrado: false, destino: false })
      }
    })

    it('[P] dois "Enviar" ao mesmo tempo, o primeiro parado no insert: um convite aberto e um envio vivo por professor, e os dois respondem a contagem, nunca 409 nem 500', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const professores = [await semear(escolaId, 'pendente'), await semear(escolaId, 'pendente')]
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'convite', evento: 'insert', quando: `new.escola_id = '${escolaId}'::uuid and new.canal = 'email'` })
      await parada.armar()
      try {
        const primeiro = enviar(coordenacao)
        await parada.esperarParadas(1)
        const segundo = enviar(coordenacao)
        await esperarNaTravaDaEscola(bancada.pool, escolaId, 1)
        await parada.soltar()
        const respostas = await Promise.all([primeiro, segundo])
        expect(respostas.map((resposta) => [resposta.status, resposta.corpo])).toEqual([
          [200, { quantidade: 2 }],
          [200, { quantidade: 2 }],
        ])
      } finally {
        await parada.desarmar()
      }
      for (const professor of professores) {
        const convites = await convitesDe(professor.usuarioId)
        expect(convites.filter((convite) => convite.aberto)).toEqual([expect.objectContaining({ canal: 'email', envio: 'na_fila' })])
        // Os dois "Enviar" respondem a mesma contagem, e o caso não vê qual dos dois produziu qual convite; o que fica é o que cada convite é: o que o segundo
        // revogou termina `cancelado` e sem cifrado, e o que ficou é o aberto, na fila. O estado de cada um vem da linha, e não da ordem delas (o relógio recua).
        const porEnvio = (envio: string) => convites.filter((convite) => convite.canal === 'email' && convite.envio === envio)
        // Os dois e só os dois: um terceiro convite por e-mail, em outro estado, não passa pelas duas buscas abaixo.
        expect(convites.filter((convite) => convite.canal === 'email')).toHaveLength(2)
        expect(porEnvio('na_fila')).toEqual([expect.objectContaining({ aberto: true, revogado: false })])
        expect(porEnvio('cancelado')).toEqual([expect.objectContaining({ aberto: false, revogado: true, cifrado: false, destino: false })])
        expect(convites.filter((convite) => convite.envio === 'cancelado' && (convite.cifrado || convite.destino))).toEqual([])
      }
    })
  })

  describe('a lista de professores mostra o envio', () => {
    it('cada estado do envio aparece no professor, e o convite copiado e o professor sem convite têm `envio = null`', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const copiado = await semear(escolaId, 'pendente')
      const semConvite = await semear(escolaId, 'ativo')
      const porEstado = new Map<EstadoDoEnvio, string>()
      for (const estado of ESTADOS_DO_ENVIO) {
        const professor = await semear(escolaId, 'pendente')
        porEstado.set(estado, professor.usuarioId)
        const aberto = estado === 'na_fila' || estado === 'enviando'
        await bancada.pool.query(
          `update convite set canal = 'email', envio = $2, envio_reservado_em = ${estado === 'enviando' ? 'now()' : 'null'}, enviado_em = ${estado === 'enviado' ? 'now()' : 'null'},
                  token_cifrado = ${aberto ? "decode('00', 'hex')" : 'null'}, destino_cifrado = ${aberto ? "decode('00', 'hex')" : 'null'} where id = $1`,
          [professor.conviteId, estado],
        )
      }
      const itens = await listar(coordenacao)
      const envioDe = (usuarioId: string) => itens.find((item) => item.usuarioId === usuarioId)?.envio
      expect(envioDe(copiado.usuarioId)).toBeNull()
      expect(envioDe(semConvite.usuarioId)).toBeNull()
      for (const [estado, usuarioId] of porEstado) expect(envioDe(usuarioId), estado).toBe(estado)
    })

    it('4.0: `enviadoEm` é a hora que o job gravou, só no envio `enviado`; nos outros quatro estados e no convite copiado é nulo, mesmo com hora no banco, e a lista da A não traz a hora do professor da B', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const outra = await escolaComCoordenacao()
      const copiado = await semear(escolaId, 'pendente')
      const porEstado = new Map<EstadoDoEnvio, string>()
      for (const estado of ESTADOS_DO_ENVIO) {
        const professor = await semear(escolaId, 'pendente')
        porEstado.set(estado, professor.usuarioId)
        const aberto = estado === 'na_fila' || estado === 'enviando'
        await bancada.pool.query(
          `update convite set canal = 'email', envio = $2, envio_reservado_em = ${estado === 'enviando' ? 'now()' : 'null'}, enviado_em = timestamptz '2026-11-12 17:05:00+00',
                  token_cifrado = ${aberto ? "decode('00', 'hex')" : 'null'}, destino_cifrado = ${aberto ? "decode('00', 'hex')" : 'null'} where id = $1`,
          [professor.conviteId, estado],
        )
      }
      // O banco não proíbe a hora fora do `enviado` (um convite copiado, ou um envio que mudou de estado depois): a lista só a mostra no `enviado`.
      await bancada.pool.query("update convite set enviado_em = timestamptz '2026-11-12 17:05:00+00' where id = $1", [copiado.conviteId])
      // O `enviado` sem hora (o banco não obriga a hora): a lista diz `null`, e não quebra.
      const semHora = await semear(escolaId, 'pendente')
      await bancada.pool.query("update convite set canal = 'email', envio = 'enviado', enviado_em = null where id = $1", [semHora.conviteId])
      // O professor da B tem um envio com hora própria: ele não aparece na lista da A.
      const daB = await semear(outra.escolaId, 'pendente')
      await bancada.pool.query(`update convite set canal = 'email', envio = 'enviado', enviado_em = timestamptz '2026-10-01 10:00:00+00' where id = $1`, [daB.conviteId])
      const itens = await listar(coordenacao)
      const horaDe = (usuarioId: string) => itens.find((item) => item.usuarioId === usuarioId)?.enviadoEm
      expect(horaDe(porEstado.get('enviado') ?? '')).toBe('2026-11-12T17:05:00.000Z')
      for (const estado of ESTADOS_DO_ENVIO.filter((candidato) => candidato !== 'enviado')) expect(horaDe(porEstado.get(estado) ?? ''), estado).toBeNull()
      expect(horaDe(copiado.usuarioId)).toBeNull()
      expect(horaDe(semHora.usuarioId)).toBeNull()
      expect(itens.find((item) => item.usuarioId === daB.usuarioId)).toBeUndefined()
      expect(itens.map((item) => item.enviadoEm).filter((hora) => hora !== null)).toEqual(['2026-11-12T17:05:00.000Z'])
    })

    it('depois de o envio falhar (5xx, ou 4xx esgotado), o professor continua pendente e a lista mostra `falhou`; o texto da lista não traz cifrado nem endereço', async () => {
      const { escolaId, coordenacao } = await escolaComCoordenacao()
      const pendente = await semear(escolaId, 'pendente')
      await enviar(coordenacao)
      const novo = (await convitesDe(pendente.usuarioId)).find((convite) => convite.canal === 'email')
      await bancada.pool.query("update convite set envio = 'falhou', token_cifrado = null, destino_cifrado = null, envio_reservado_em = null where id = $1", [novo?.id])
      const lista = await pedir('GET', '/v1/professores?limite=100', coordenacao.token)
      expect(listaDeProfessoresResponseSchema.parse(lista.corpo).itens).toEqual([{ usuarioId: pendente.usuarioId, nome: 'Professor sintético', estado: 'pendente', envio: 'falhou', enviadoEm: null }])
      expect(lista.texto).not.toMatch(/cifrado|escola\.invalid/)
    })
  })
})
