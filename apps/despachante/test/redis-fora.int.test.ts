import 'reflect-metadata'
import { Heartbeat, TIMEOUT_COMANDO_REDIS_FILA_MS } from '@educa/core'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { aguardarSaudavel, compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { AppModule } from '../../api/src/app.module.js'
import { configurarAplicacao } from '../../api/src/configurar-app.js'
import { configuracaoDeTeste } from '../../api/test/configuracao-de-teste.js'
import { BancadaDeSessoes } from '../../api/test/sessao-de-teste.js'
import { BancadaDeFila, LogEmMemoria } from '../../worker/test/fila-de-teste.js'

// API, despachantes e worker de verdade (a mesma montagem do main.ts), no processo do teste, contra o
// Postgres e o Redis de fila do compose de teste, que este arquivo para, trava e religa.

async function contarPorEstado(bancada: BancadaDeFila, ids: readonly string[]): Promise<Record<string, number>> {
  const { rows } = await bancada.pool.query<{ estado: string; total: string }>(
    'select estado, count(*) as total from job_registro where id = any($1) group by estado',
    [ids],
  )
  return Object.fromEntries(rows.map((linha) => [linha.estado, Number(linha.total)]))
}

/** Quantas vezes cada job começou a executar, somando os workers. */
function execucoesPorJob(...logs: LogEmMemoria[]): Map<string, number> {
  const execucoes = new Map<string, number>()
  for (const registro of logs.flatMap((log) => log.doEvento('job.iniciado'))) {
    const id = String(registro['jobId'])
    execucoes.set(id, (execucoes.get(id) ?? 0) + 1)
  }
  return execucoes
}

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('Redis de fila fora', () => {
  let bancada: BancadaDeFila

  afterEach(async () => {
    // Religa o Redis antes de fechar: a bancada limpa a fila dela no Redis.
    compose('unpause', 'redis-fila')
    await composeAssincronoOuFalha('up', '--detach', 'redis-fila')
    // `up --wait` desiste na hora depois de um `pause`, com o último estado ainda `unhealthy`.
    await aguardarSaudavel('redis-fila')
    await bancada.fechar()
  }, 120_000)

  it('parado: 50 POSTs dão 202 em menos de 1 s cada, a vaga não é consultável e nada é reservado, sem derrubar o laço, e ao religar cada job executa uma vez', async () => {
    bancada = new BancadaDeFila()
    await bancada.limparRegistro()
    const logApi = new LogEmMemoria('api')
    const app: INestApplication = await NestFactory.create(AppModule.com(configuracaoDeTeste({ ambiente: { ROTAS_SINTETICAS: 'true' } })), { logger: false })
    configurarAplicacao(app, logApi.logger)
    await app.listen(0, '127.0.0.1')
    try {
      const { port } = app.getHttpServer().address() as AddressInfo
      // Sessão real numa escola nova: a SessaoGuard lê a sessão antes de o POST gravar o job.
      const sessoes = new BancadaDeSessoes()
      onTestFinished(() => sessoes.fechar())
      const { token } = await sessoes.escolaComSessao('coordenador')
      const logs = { d1: new LogEmMemoria('despachante-1'), d2: new LogEmMemoria('despachante-2'), worker: new LogEmMemoria('worker') }
      bancada.worker(logs.worker, { concorrencia: 10 })
      for (const log of [logs.d1, logs.d2]) bancada.despachante(log).despachante.iniciar()

      await composeAssincronoOuFalha('stop', 'redis-fila')
      const ids: string[] = []
      for (let indice = 0; indice < 50; indice++) {
        const inicio = performance.now()
        const resposta = await fetch(`http://127.0.0.1:${port}/v1/sistema/jobs-sinteticos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fila: 'interativa', cpuMs: 0, naoUrgente: false }),
        })
        expect(performance.now() - inicio).toBeLessThan(1_000)
        expect(resposta.status).toBe(202)
        ids.push(((await resposta.json()) as { jobId: string }).jobId)
      }

      // Sem Redis não há vaga: os despachantes avisam, só com ids, e não reservam nada que não possam publicar.
      const avisos = () => [...logs.d1.doEvento('despachante.vaga_indisponivel'), ...logs.d2.doEvento('despachante.vaga_indisponivel')]
      await expect.poll(() => avisos().length, { timeout: 10_000 }).toBeGreaterThan(0)
      for (const aviso of avisos()) {
        expect(Object.keys(aviso).sort()).toEqual(['erro', 'escolaId', 'evento', 'level', 'requisicaoId', 'servico', 'time'])
      }
      // Nada foi reservado, publicado nem executado, e o laço seguiu: nenhuma rodada caiu por exceção.
      await new Promise((resolver) => setTimeout(resolver, 1_500))
      expect(await contarPorEstado(bancada, ids)).toEqual({ aguardando: 50 })
      expect([...logs.d1.doEvento('despachante.rodada_falhou'), ...logs.d2.doEvento('despachante.rodada_falhou')]).toEqual([])

      await composeAssincronoOuFalha('start', 'redis-fila')
      // A subida do container fica fora do orçamento abaixo: `start` devolve quando o Docker aceitou o comando, não
      // quando o Redis responde, e numa máquina carregada essa diferença come o prazo que deveria medir só a regra.
      await aguardarSaudavel('redis-fila')
      // Sem reserva a vencer: com o Redis de volta, a próxima rodada já despacha, dentro das vagas da escola.
      await expect.poll(async () => (await contarPorEstado(bancada, ids))['concluido'], { timeout: 60_000, interval: 500 }).toBe(50)

      const execucoes = execucoesPorJob(logs.worker)
      expect(execucoes.size).toBe(50)
      expect([...execucoes.values()].filter((vezes) => vezes !== 1)).toEqual([])
    } finally {
      await app.close()
    }
    // 240 s, não 180: a espera pelo serviço entrou no caso, e com o teto padrão dela (60 s) o pior caso
    // encostava no prazo. Alargar aqui é melhor que apertar a espera — um teto de espera curto demais
    // nasceria vermelho num runner lento, que é justamente a máquina que esta classe de teste precisa tolerar.
  }, 240_000)

  it('travado: a vaga desiste no prazo, a rodada termina sem tentar as outras escolas e o laço segue batendo; ao destravar cada job executa uma vez', async () => {
    bancada = new BancadaDeFila()
    await bancada.limparRegistro()
    const logDespachante = new LogEmMemoria('despachante')
    const logWorker = new LogEmMemoria('worker')
    const arquivoDoBatimento = join(mkdtempSync(join(tmpdir(), 'educa-batimento-')), 'batimento')
    const idadeDoBatimento = () => (existsSync(arquivoDoBatimento) ? Date.now() - statSync(arquivoDoBatimento).mtimeMs : Number.POSITIVE_INFINITY)
    // O despachante sobe com o Redis de pé, e o cliente dele conecta: é o Redis que trava depois.
    bancada.despachante(logDespachante, { batimento: new Heartbeat(arquivoDoBatimento) }).despachante.iniciar()
    await new Promise((resolver) => setTimeout(resolver, 1_000))

    // Escolas reais: desde a tarefa 3.0 `job_registro` tem FK para `escola`. Criadas antes do `pause`,
    // porque a criação grava auditoria no mesmo Postgres.
    const [escolaA, escolaB, escolaC] = await Promise.all([bancada.escola(), bancada.escola(), bancada.escola()])

    compose('pause', 'redis-fila')
    const inicio = performance.now()
    // Três escolas com job: com o Redis travado, tentar a vaga de cada uma custaria o prazo três vezes por rodada.
    const antes = [await bancada.enfileirar(escolaA), await bancada.enfileirar(escolaB), await bancada.enfileirar(escolaC)]
    await expect.poll(() => logDespachante.doEvento('despachante.vaga_indisponivel').length, { timeout: 10_000, interval: 50 }).toBe(1)
    const desistiuEmMs = performance.now() - inicio
    expect(desistiuEmMs).toBeGreaterThanOrEqual(TIMEOUT_COMANDO_REDIS_FILA_MS - 100)
    expect(desistiuEmMs).toBeLessThan(TIMEOUT_COMANDO_REDIS_FILA_MS + 2_000)

    // O laço não ficou preso: bate a cada rodada (uma espera de prazo por rodada, e não uma por escola),
    // bem abaixo da idade que o healthcheck tolera, e o job que chega depois não trava nada.
    const depois = await bancada.enfileirar(escolaA)
    for (let conferencia = 0; conferencia < 4; conferencia++) {
      await new Promise((resolver) => setTimeout(resolver, 1_500))
      expect(idadeDoBatimento()).toBeLessThan(TIMEOUT_COMANDO_REDIS_FILA_MS + 1_500)
    }
    const ids = [...antes, depois]
    expect(await contarPorEstado(bancada, ids)).toEqual({ aguardando: 4 })
    expect(logDespachante.doEvento('despachante.rodada_falhou')).toEqual([])

    compose('unpause', 'redis-fila')
    bancada.worker(logWorker)
    await expect.poll(async () => (await contarPorEstado(bancada, ids))['concluido'], { timeout: 60_000, interval: 500 }).toBe(4)
    const execucoes = execucoesPorJob(logWorker)
    expect(ids.map((id) => execucoes.get(id))).toEqual([1, 1, 1, 1])
    expect(await bancada.fila.getJobCounts('completed', 'waiting', 'active', 'delayed', 'failed')).toEqual({ completed: 4, waiting: 0, active: 0, delayed: 0, failed: 0 })
  }, 120_000)
})
