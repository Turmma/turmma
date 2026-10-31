import type { Redis } from 'ioredis'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import type { DatabasePool } from '../db/pool.js'
import { loadTelemetryConfig } from './start.js'
import { METRICS, METRICS_WITH_ESCOLA, httpMetricsMiddleware, observeDatabasePool, observeRedis, observeInsuranceLimiter, ROTA_NAO_ENCONTRADA, requestRoute } from './metrics.js'

const ID = '0190f5a0-0000-7000-8000-0000000000c1'

let medidor: MedidorDeTeste

beforeEach(() => {
  medidor = new MedidorDeTeste()
})

afterEach(async () => {
  await medidor.encerrar()
})

/** Uma requisição que termina: o roteador casou (ou não) a rota, e a resposta fecha com o status. */
function atender(requisicao: Partial<IncomingMessage> & { route?: { path?: unknown }; baseUrl?: string }, status: number): void {
  const resposta = Object.assign(new EventEmitter(), { statusCode: status }) as unknown as ServerResponse
  httpMetricsMiddleware(medidor.medidor)(requisicao as IncomingMessage, resposta, () => undefined)
  ;(resposta as unknown as EventEmitter).emit('close')
}

describe('http.server.request.duration', () => {
  it('rota template: registra `/v1/sistema/jobs-sinteticos/:id`, e o id do caminho nunca vira rótulo', async () => {
    atender({ method: 'GET', url: `/v1/sistema/jobs-sinteticos/${ID}`, route: { path: '/v1/sistema/jobs-sinteticos/:id' } }, 200)
    atender({ method: 'GET', url: `/v1/sistema/jobs-sinteticos/${ID}`, route: { path: '/v1/sistema/jobs-sinteticos/:id' } }, 404)

    const pontos = await medidor.pontos(METRICS.duracaoHttp)
    expect(pontos.map((ponto) => ponto.atributos)).toEqual([
      { 'http.request.method': 'GET', 'http.route': '/v1/sistema/jobs-sinteticos/:id', 'http.response.status_code': 200 },
      { 'http.request.method': 'GET', 'http.route': '/v1/sistema/jobs-sinteticos/:id', 'http.response.status_code': 404 },
    ])
    expect(JSON.stringify(pontos)).not.toContain(ID)
  })

  it('borda: caminho que não casou rota nenhuma vira `nao_encontrada`, e não o que o cliente digitou', async () => {
    atender({ method: 'GET', url: `/qualquer/${ID}?nome=Enzo` }, 404)
    atender({ method: 'BREW', url: '/cafe' }, 404)

    const pontos = await medidor.pontos(METRICS.duracaoHttp)
    expect(pontos.map((ponto) => ponto.atributos)).toEqual([
      { 'http.request.method': 'GET', 'http.route': ROTA_NAO_ENCONTRADA, 'http.response.status_code': 404 },
      // Método fora da lista não abre série nova por texto do cliente.
      { 'http.request.method': '_OTHER', 'http.route': ROTA_NAO_ENCONTRADA, 'http.response.status_code': 404 },
    ])
    expect(JSON.stringify(pontos)).not.toContain('Enzo')
  })

  it('a rota montada num prefixo leva o prefixo, e só em template', () => {
    expect(requestRoute({ baseUrl: '/v1', route: { path: '/turmas/:turmaId' } } as never)).toBe('/v1/turmas/:turmaId')
    expect(requestRoute({ route: { path: /regex/ } } as never)).toBe(ROTA_NAO_ENCONTRADA)
  })

  it('mede a duração em segundos, quando a resposta fecha', async () => {
    const resposta = Object.assign(new EventEmitter(), { statusCode: 200 }) as unknown as ServerResponse
    httpMetricsMiddleware(medidor.medidor)({ method: 'GET', route: { path: '/saude' } } as never, resposta, () => undefined)
    expect(await medidor.pontos(METRICS.duracaoHttp)).toEqual([])
    await new Promise((resolver) => setTimeout(resolver, 30))
    ;(resposta as unknown as EventEmitter).emit('close')
    const [ponto] = await medidor.pontos(METRICS.duracaoHttp)
    const valor = ponto?.valor as { contagem: number; soma: number }
    expect(valor.contagem).toBe(1)
    expect(valor.soma).toBeGreaterThanOrEqual(0.02)
    expect(valor.soma).toBeLessThan(1)
  })
})

describe('pool do banco', () => {
  function poolFalso(total: number, ocioso: number): DatabasePool & EventEmitter {
    return Object.assign(new EventEmitter(), { totalCount: total, idleCount: ocioso }) as unknown as DatabasePool & EventEmitter
  }

  it('em uso é o total menos as ociosas; descartada conta a devolução com erro e a ociosa derrubada, e não a devolução limpa', async () => {
    const pool = poolFalso(7, 3)
    observeDatabasePool(medidor.medidor, pool)
    pool.emit('release', undefined, {})
    pool.emit('release', undefined, {})
    pool.emit('release', new Error('sessão com transação pendente'), {})
    pool.emit('error', new Error('conexão ociosa derrubada'), {})

    expect((await medidor.pontos(METRICS.poolEmUso)).map((ponto) => ponto.valor)).toEqual([4])
    expect((await medidor.pontos(METRICS.conexoesDescartadas)).map((ponto) => ponto.valor)).toEqual([2])
  })
})

describe('redis.disponivel', () => {
  const cliente = (status: string) => ({ status }) as unknown as Redis

  it('1 só com todo cliente da instância pronto; o de cache e o de fila em séries separadas, sem outro rótulo', async () => {
    const pronto = cliente('ready')
    const reconectando = cliente('reconnecting')
    observeRedis(medidor.medidor, { fila: [pronto, reconectando], cache: [cliente('ready')] })

    const pontos = await medidor.pontos(METRICS.redisDisponivel)
    expect(pontos).toEqual([
      { atributos: { instancia: 'fila' }, valor: 0 },
      { atributos: { instancia: 'cache' }, valor: 1 },
    ])
  })
})

describe('limite.seguro_ativo', () => {
  it('com o rate limit e o contador de login, vale o maior: qualquer um contando só em memória acende a métrica', async () => {
    const limite = { proporcaoDoSeguro: 0 }
    const login = { proporcaoDoSeguro: 0 }
    observeInsuranceLimiter(medidor.medidor, limite, login)
    expect((await medidor.pontos(METRICS.seguroAtivo)).map((ponto) => ponto.valor)).toEqual([0])
    login.proporcaoDoSeguro = 1
    expect((await medidor.pontos(METRICS.seguroAtivo)).map((ponto) => ponto.valor)).toEqual([1])
    login.proporcaoDoSeguro = 0
    limite.proporcaoDoSeguro = 0.5
    expect((await medidor.pontos(METRICS.seguroAtivo)).map((ponto) => ponto.valor)).toEqual([0.5])
  })
})

describe('configuração da telemetria', () => {
  it('lê o destino sem barra no fim e o intervalo, e não sobe sem eles ou com intervalo abaixo de 1 s', () => {
    expect(loadTelemetryConfig({ TELEMETRIA_OTLP_URL: 'http://observabilidade:4318/', TELEMETRIA_INTERVALO_MS: '5000' })).toEqual({
      otlpUrl: 'http://observabilidade:4318',
      intervaloMs: 5000,
    })
    expect(() => loadTelemetryConfig({ TELEMETRIA_INTERVALO_MS: '5000' })).toThrow('TELEMETRIA_OTLP_URL')
    expect(() => loadTelemetryConfig({ TELEMETRIA_OTLP_URL: 'redis://x:1', TELEMETRIA_INTERVALO_MS: '5000' })).toThrow('TELEMETRIA_OTLP_URL')
    expect(() => loadTelemetryConfig({ TELEMETRIA_OTLP_URL: 'http://observabilidade:4318', TELEMETRIA_INTERVALO_MS: '100' })).toThrow('TELEMETRIA_INTERVALO_MS')
  })
})

describe('métricas com escola', () => {
  it('lista fechada: `escola_id` só nas quatro de job, nas três de login (Tech Spec da identidade, 7c) nas noites sem expurgo (F3, tarefa 3.0) nas horas do incidente sem confirmação (F3, tarefa 9.0) nas do arquivo do titular em preparação (F3, tarefa 13.0) e nas da eliminação agendada vencida (F3, tarefa 15.0)', () => {
    // Uma métrica nova com escola precisa entrar aqui de propósito: o rótulo multiplica as séries por escola, e fora
    // desta lista o teste de cardinalidade da observabilidade (infra/test/metricas.int.test.ts) a reprova.
    expect([...METRICS_WITH_ESCOLA].sort()).toEqual(
      [
        METRICS.esperaMaisAntiga,
        METRICS.pendentes,
        METRICS.aguardandoVaga,
        METRICS.vagasEmUso,
        METRICS.esperaPeloHash,
        METRICS.falhasDeLogin,
        METRICS.prioridadeRebaixada,
        METRICS.noitesIncompletasDoExpurgo,
        METRICS.horasDoIncidenteSemConfirmacao,
        METRICS.horasDoArquivoEmPreparacao,
        METRICS.horasDaEliminacaoVencida,
      ].sort(),
    )
    expect(METRICS_WITH_ESCOLA).not.toContain(METRICS.limiteEmailIp)
    expect(METRICS_WITH_ESCOLA).not.toContain(METRICS.rebaixadoPorIp)
    expect(METRICS_WITH_ESCOLA).not.toContain(METRICS.duracaoDoLogin)
    expect(METRICS_WITH_ESCOLA).not.toContain(METRICS.hashRecusado)
  })

  it('as duas da sala (A1, tarefa 7.0) não levam escola: a escola do limite atingido vai no log, e a do pedido em lugar nenhum', () => {
    expect(METRICS_WITH_ESCOLA).not.toContain(METRICS.limiteDaSala)
    expect(METRICS_WITH_ESCOLA).not.toContain(METRICS.reivindicacaoNaSala)
    expect([METRICS.limiteDaSala, METRICS.reivindicacaoNaSala]).toEqual(['sala.limite_atingido', 'sala.reivindicacao'])
  })
})
