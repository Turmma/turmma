import 'reflect-metadata'
import { createPool, runInContext, type DatabasePool } from '@educa/core'
import { ErrorCode, JobFailureCode, MENSAGENS_DE_ERRO, TIPO_JOB_SINTETICO } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { BancadaDeFila, LogEmMemoria } from '../../worker/test/queue.fixture.js'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configure-app.js'
import { configuracaoDeTeste } from './test-config.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

/** Uma escola que o corpo tenta impor: não precisa existir, o corpo estrito recusa o campo. */
const ESCOLA_NO_CORPO = '0190f5a0-0000-7000-8000-00000000000b'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ROTA = '/v1/sistema/jobs-sinteticos'


async function subirApi(log: LogEmMemoria, ambiente: Record<string, string> = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.com(configuracaoDeTeste({ ambiente })), { logger: false })
  configurarAplicacao(app, log.logger)
  await app.listen(0, '127.0.0.1')
  return app
}

/** O corpo de erro sem o `requisicaoId`, que muda a cada requisição: o resto precisa ser idêntico. */
function semRequisicaoId(corpo: { erro: Record<string, unknown> }): Record<string, unknown> {
  const { requisicaoId, ...resto } = corpo.erro
  expect(requisicaoId).toMatch(UUID)
  return resto
}

const pedidoValido = { fila: 'interativa', cpuMs: 0, naoUrgente: false }

describe('POST e GET /v1/sistema/jobs-sinteticos', () => {
  const log = new LogEmMemoria('api')
  const sessoes = new BancadaDeSessoes()
  let app: INestApplication
  let pool: DatabasePool
  // Escolas e sessões reais: a SessaoGuard lê a sessão do token. Coordenação: a rota de job sintético é da unidade.
  let ESCOLA_A: string
  let ESCOLA_B: string
  let tokenA: string
  let tokenB: string

  const contarJobs = async (escolaId: string): Promise<number> => {
    const { rows } = await pool.query<{ total: string }>('select count(*) as total from job_registro where escola_id = $1', [escolaId])
    return Number(rows[0]?.total)
  }

  beforeAll(async () => {
    // Um despachante do compose de pé tiraria o job de `aguardando` antes de o teste olhar.
    compose('stop', ...PROCESSOS_DA_FILA)
    app = await subirApi(log, { ROTAS_SINTETICAS: 'true' })
    pool = createPool(configuracaoDeTeste().banco, () => undefined)
    const sessaoA = await sessoes.escolaComSessao('coordenador')
    const sessaoB = await sessoes.escolaComSessao('coordenador')
    ESCOLA_A = sessaoA.escolaId
    ESCOLA_B = sessaoB.escolaId
    tokenA = sessaoA.token
    tokenB = sessaoB.token
  })

  afterAll(async () => {
    await app.close()
    await pool.query('delete from job_registro where escola_id = any($1::uuid[])', [[ESCOLA_A, ESCOLA_B]])
    await pool.end()
    await sessoes.fechar()
  })

  beforeEach(() => {
    log.linhas.length = 0
  })

  it('aceita com 202, grava o job da escola do token com a requisição que o pediu, e o GET o mostra aguardando', async () => {
    const requisicaoId = randomUUID()
    const resposta = await request(app.getHttpServer())
      .post(ROTA)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Requisicao-Id', requisicaoId)
      .send({ fila: 'lote', cpuMs: 250, naoUrgente: true })

    expect(resposta.status).toBe(202)
    expect(resposta.body).toEqual({ jobId: expect.stringMatching(UUID) })
    const jobId = (resposta.body as { jobId: string }).jobId

    const { rows } = await pool.query('select escola_id, tipo, fila, prioridade, dados, nao_urgente, estado, requisicao_id from job_registro where id = $1', [jobId])
    expect(rows[0]).toEqual({
      escola_id: ESCOLA_A,
      tipo: TIPO_JOB_SINTETICO,
      fila: 'lote',
      prioridade: 3,
      dados: { cpuMs: 250, falhar: false },
      nao_urgente: true,
      estado: 'aguardando',
      requisicao_id: requisicaoId,
    })
    expect(log.registros().find((registro) => registro['msg'] === 'job.enfileirado')).toMatchObject({ requisicaoId, escolaId: ESCOLA_A })

    const consulta = await request(app.getHttpServer()).get(`${ROTA}/${jobId}`).set('Authorization', `Bearer ${tokenA}`)
    expect(consulta.status).toBe(200)
    expect(consulta.headers['cache-control']).toBe('no-store')
    expect(consulta.body).toEqual({ estado: 'aguardando', criadoEm: expect.any(String) })
  })

  it('o corpo escolhe a fila e o não urgente do job: cada combinação grava a fila, a prioridade e o valor que veio', async () => {
    const combinacoes = [
      { fila: 'interativa', prioridade: 1, naoUrgente: false },
      { fila: 'normal', prioridade: 2, naoUrgente: true },
      { fila: 'lote', prioridade: 3, naoUrgente: false },
    ] as const
    for (const { fila, prioridade, naoUrgente } of combinacoes) {
      const resposta = await request(app.getHttpServer()).post(ROTA).set('Authorization', `Bearer ${tokenA}`).send({ fila, cpuMs: 1, naoUrgente })
      expect(resposta.status).toBe(202)
      const { rows } = await pool.query('select fila, prioridade, nao_urgente from job_registro where id = $1', [(resposta.body as { jobId: string }).jobId])
      expect(rows[0]).toEqual({ fila, prioridade, nao_urgente: naoUrgente })
    }
  })

  it('caminho feliz com despachante e worker: o GET mostra aguardando, ativo e concluido, com as datas', async () => {
    const bancada = new BancadaDeFila()
    try {
      await bancada.limparRegistro()
      const resposta = await request(app.getHttpServer()).post(ROTA).set('Authorization', `Bearer ${tokenB}`).send({ ...pedidoValido, cpuMs: 1_500 })
      const jobId = (resposta.body as { jobId: string }).jobId
      const consultar = async () => (await request(app.getHttpServer()).get(`${ROTA}/${jobId}`).set('Authorization', `Bearer ${tokenB}`)).body as Record<string, unknown>

      expect((await consultar())['estado']).toBe('aguardando')
      bancada.worker(new LogEmMemoria('worker'))
      bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()

      await expect.poll(async () => (await consultar())['estado'], { timeout: 10_000, interval: 100 }).toBe('ativo')
      expect(await consultar()).toEqual({ estado: 'ativo', criadoEm: expect.any(String), iniciadoEm: expect.any(String) })
      await expect.poll(async () => (await consultar())['estado'], { timeout: 10_000, interval: 100 }).toBe('concluido')
      const final = await consultar()
      expect(final).toEqual({ estado: 'concluido', criadoEm: expect.any(String), iniciadoEm: expect.any(String), concluidoEm: expect.any(String) })
      expect(Date.parse(String(final['concluidoEm'])) - Date.parse(String(final['iniciadoEm']))).toBeGreaterThanOrEqual(1_400)
    } finally {
      await bancada.fechar()
    }
  })

  it('job que falhou de vez aparece no GET como falhou, com o código tipado e a data', async () => {
    const criado = await request(app.getHttpServer()).post(ROTA).set('Authorization', `Bearer ${tokenA}`).send(pedidoValido)
    const jobId = (criado.body as { jobId: string }).jobId
    const bancada = new BancadaDeFila()
    try {
      // O que o worker grava na última tentativa, pelo mesmo repository e no escopo da escola do job.
      await bancada.reservar(ESCOLA_A)
      await runInContext({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () =>
        bancada.registro.registrarFalha(jobId, JobFailureCode.FALHA_SINTETICA),
      )
    } finally {
      await bancada.fechar()
    }
    const consulta = await request(app.getHttpServer()).get(`${ROTA}/${jobId}`).set('Authorization', `Bearer ${tokenA}`)
    expect(consulta.body).toEqual({
      estado: 'falhou',
      criadoEm: expect.any(String),
      concluidoEm: expect.any(String),
      codigoFalha: JobFailureCode.FALHA_SINTETICA,
    })
  })

  it('dois POSTs iguais em paralelo criam dois jobs distintos, sem erro', async () => {
    const antes = await contarJobs(ESCOLA_A)
    const respostas = await Promise.all(
      [1, 2].map(() => request(app.getHttpServer()).post(ROTA).set('Authorization', `Bearer ${tokenA}`).send(pedidoValido)),
    )
    expect(respostas.map((resposta) => resposta.status)).toEqual([202, 202])
    const [primeiro, segundo] = respostas.map((resposta) => (resposta.body as { jobId: string }).jobId)
    expect(primeiro).not.toBe(segundo)
    expect(await contarJobs(ESCOLA_A)).toBe(antes + 2)
  })

  describe('a rota de teste não abre porta', () => {
    it('sem token, o POST responde 401 e não grava nada', async () => {
      const antes = await contarJobs(ESCOLA_A)
      const resposta = await request(app.getHttpServer()).post(ROTA).send({ ...pedidoValido })
      expect(resposta.status).toBe(401)
      expect(resposta.body.erro.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
      expect(await contarJobs(ESCOLA_A)).toBe(antes)
    })

    it('sem token, o corpo inválido responde 401, e não 400: a guarda vem antes do pipe', async () => {
      const antes = await contarJobs(ESCOLA_A)
      const resposta = await request(app.getHttpServer()).post(ROTA).send({ ...pedidoValido, escolaId: ESCOLA_NO_CORPO })
      expect(resposta.status).toBe(401)
      expect(resposta.body.erro.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
      expect(await contarJobs(ESCOLA_A)).toBe(antes)
    })

    it.each([
      ['tipo de rotina do sistema', { ...pedidoValido, tipo: 'sistema.expurgar-jobs' }],
      ['tipo qualquer', { ...pedidoValido, tipo: TIPO_JOB_SINTETICO }],
      ['escolaId de outra escola', { ...pedidoValido, escolaId: ESCOLA_NO_CORPO }],
      ['fila inexistente', { ...pedidoValido, fila: 'urgentissima' }],
      ['cpuMs acima do teto', { ...pedidoValido, cpuMs: 60_001 }],
      ['sem naoUrgente', { fila: 'normal', cpuMs: 0 }],
    ])('corpo com %s é recusado com 400, e nenhuma escola ganha job', async (_caso, corpo) => {
      const antes = { a: await contarJobs(ESCOLA_A), b: await contarJobs(ESCOLA_B) }
      const resposta = await request(app.getHttpServer()).post(ROTA).set('Authorization', `Bearer ${tokenA}`).send(corpo)
      expect(resposta.status).toBe(400)
      expect(semRequisicaoId(resposta.body)).toEqual({ codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA })
      expect({ a: await contarJobs(ESCOLA_A), b: await contarJobs(ESCOLA_B) }).toEqual(antes)
    })

    it('com ROTAS_SINTETICAS=false, o POST responde o mesmo 404 de uma rota inexistente, com ou sem token', async () => {
      const desligada = await subirApi(new LogEmMemoria('api-desligada'), { ROTAS_SINTETICAS: 'false' })
      try {
        const antes = await contarJobs(ESCOLA_A)
        const servidor = desligada.getHttpServer()
        const comToken = await request(servidor).post(ROTA).set('Authorization', `Bearer ${tokenA}`).send(pedidoValido)
        const semToken = await request(servidor).post(ROTA).send(pedidoValido)
        const inexistente = await request(servidor).post('/v1/sistema/rota-que-nao-existe').set('Authorization', `Bearer ${tokenA}`).send(pedidoValido)

        for (const resposta of [comToken, semToken, inexistente]) expect(resposta.status).toBe(404)
        expect(semRequisicaoId(comToken.body)).toEqual(semRequisicaoId(inexistente.body))
        expect(semRequisicaoId(semToken.body)).toEqual(semRequisicaoId(inexistente.body))
        expect(await contarJobs(ESCOLA_A)).toBe(antes)
      } finally {
        await desligada.close()
      }
    })
  })

  describe('isolamento', () => {
    it('a escola A consulta job da B e recebe 404 com corpo idêntico ao de um id inexistente', async () => {
      const criado = await request(app.getHttpServer()).post(ROTA).set('Authorization', `Bearer ${tokenB}`).send(pedidoValido)
      const jobDaB = (criado.body as { jobId: string }).jobId
      // O job existe: a própria B o enxerga.
      expect((await request(app.getHttpServer()).get(`${ROTA}/${jobDaB}`).set('Authorization', `Bearer ${tokenB}`)).status).toBe(200)
      // Em maiúsculas é o mesmo id: a dona o enxerga, e a outra escola não.
      expect((await request(app.getHttpServer()).get(`${ROTA}/${jobDaB.toUpperCase()}`).set('Authorization', `Bearer ${tokenB}`)).status).toBe(200)

      const servidor = app.getHttpServer()
      const deOutraEscola = await request(servidor).get(`${ROTA}/${jobDaB}`).set('Authorization', `Bearer ${tokenA}`)
      const inexistente = await request(servidor).get(`${ROTA}/${randomUUID()}`).set('Authorization', `Bearer ${tokenA}`)
      const foraDoFormato = await request(servidor).get(`${ROTA}/1837`).set('Authorization', `Bearer ${tokenA}`)
      const emMaiusculas = await request(servidor).get(`${ROTA}/${jobDaB.toUpperCase()}`).set('Authorization', `Bearer ${tokenA}`)
      const escolaNaQuery = await request(servidor).get(`${ROTA}/${jobDaB}?escolaId=${ESCOLA_B}`).set('Authorization', `Bearer ${tokenA}`).set('X-Escola-Id', ESCOLA_B)

      for (const resposta of [deOutraEscola, inexistente, foraDoFormato, emMaiusculas, escolaNaQuery]) {
        expect(resposta.status).toBe(404)
        expect(semRequisicaoId(resposta.body)).toEqual({ codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO })
        expect(Object.keys(resposta.headers).sort()).toEqual(Object.keys(inexistente.headers).sort())
      }
    })

    it('sem token, o GET responde 401 mesmo para um job que existe', async () => {
      const criado = await request(app.getHttpServer()).post(ROTA).set('Authorization', `Bearer ${tokenA}`).send(pedidoValido)
      const resposta = await request(app.getHttpServer()).get(`${ROTA}/${(criado.body as { jobId: string }).jobId}`)
      expect(resposta.status).toBe(401)
    })
  })
})
