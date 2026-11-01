import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SessaoFixtures, type TestSessao } from '../../apps/api/test/sessao.fixture.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { aguardarSaudavel, compose, composeAssincronoOuFalha, composeOuFalha, PROCESSOS_DA_FILA } from '../../tools/testes/compose.ts'

// Contra o compose de teste, com as imagens construídas: migrar, API, dois despachantes e dois
// workers como processos de verdade. É o que prova a ligação do main.ts, o `kill -9` e o SIGTERM.
const ambiente = lerAmbienteDeTeste()
const API = `http://127.0.0.1:${valorObrigatorio(ambiente, 'API_1_PORTA_HOST')}`
const WORKERS_INTERATIVOS = ['worker-interativo-1', 'worker-interativo-2'] as const
const WORKERS_DE_LOTE = ['worker-lote-1', 'worker-lote-2'] as const

interface LinhaDeLog {
  servico: string
  registro: Record<string, unknown>
}

/** Linhas JSON do log dos serviços desde `desde`, com o nome do serviço que as escreveu. */
function logsDesde(desde: string, ...servicos: string[]): LinhaDeLog[] {
  return servicos.flatMap((servico) =>
    composeOuFalha('logs', '--no-color', '--no-log-prefix', '--since', desde, servico)
      .split('\n')
      .filter((linha) => linha.startsWith('{'))
      .map((linha) => ({ servico, registro: JSON.parse(linha) as Record<string, unknown> })),
  )
}

describe('job pela API até o worker, com processos de verdade', () => {
  const sessoes = new SessaoFixtures()
  // Escola e sessão reais, criadas depois de o compose subir. Cada pedido leva um token novo da sessão: o de acesso
  // vale 10 min, e o arquivo passa disso com a construção das imagens.
  let sessao: TestSessao
  let ESCOLA: string

  const criarJob = async (corpo: Record<string, unknown>, requisicaoId = randomUUID()): Promise<string> => {
    const resposta = await fetch(`${API}/v1/sistema/jobs-sinteticos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await sessao.tokenNovo()}`, 'Content-Type': 'application/json', 'X-Requisicao-Id': requisicaoId },
      body: JSON.stringify({ fila: 'interativa', naoUrgente: false, ...corpo }),
    })
    expect(resposta.status).toBe(202)
    return ((await resposta.json()) as { jobId: string }).jobId
  }

  const estado = async (jobId: string): Promise<string | undefined> => {
    const resposta = await fetch(`${API}/v1/sistema/jobs-sinteticos/${jobId}`, { headers: { Authorization: `Bearer ${await sessao.tokenNovo()}` } })
    return ((await resposta.json()) as { estado?: string }).estado
  }

  const estadoDoServico = (servico: string) => compose('ps', '--all', '--format', '{{.State}} {{.ExitCode}}', servico).saida.trim()

  beforeAll(async () => {
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', 'api-1', ...PROCESSOS_DA_FILA)
    sessao = await sessoes.escolaComSessao('coordenador')
    ESCOLA = sessao.escolaId
  }, 900_000)

  afterAll(async () => {
    // Derruba só o que este arquivo subiu: um despachante de pé disputaria a fila com os testes em processo.
    await composeAssincronoOuFalha('stop', 'api-1', ...PROCESSOS_DA_FILA)
    await sessoes.fechar()
  }, 120_000)

  it('o migrar rodou e saiu com sucesso antes de API, despachantes e workers', () => {
    expect(estadoDoServico('migrar')).toBe('exited 0')
    for (const servico of ['api-1', ...PROCESSOS_DA_FILA]) expect(estadoDoServico(servico), servico).toBe('running 0')
  })

  it('o mesmo requisicaoId aparece no log da API, de um despachante e de um worker, e o job termina concluido', async () => {
    const desde = new Date().toISOString()
    const requisicaoId = randomUUID()
    const jobId = await criarJob({ cpuMs: 200 }, requisicaoId)
    await expect.poll(() => estado(jobId), { timeout: 20_000, interval: 200 }).toBe('concluido')

    const daRequisicao = logsDesde(desde, 'api-1', ...PROCESSOS_DA_FILA).filter(({ registro }) => registro['requisicaoId'] === requisicaoId)
    const eventosPorServico = (prefixo: string) =>
      daRequisicao.filter(({ servico }) => servico.startsWith(prefixo)).map(({ registro }) => registro['evento'] ?? registro['msg'])
    expect(eventosPorServico('api')).toContain('job.enfileirado')
    expect(eventosPorServico('despachante')).toEqual(['job.publicado'])
    expect(eventosPorServico('worker-interativo')).toEqual(['job.iniciado', 'job.concluido'])
    for (const { registro } of daRequisicao) expect(registro['escolaId']).toBe(ESCOLA)
  }, 60_000)

  it('cada fila no seu pool: o lote executa no worker-lote, e o interativo e o normal, no worker-interativo', async () => {
    const desde = new Date().toISOString()
    const porFila = { lote: await criarJob({ fila: 'lote', cpuMs: 0 }), normal: await criarJob({ fila: 'normal', cpuMs: 0 }), interativa: await criarJob({ cpuMs: 0 }) }
    for (const jobId of Object.values(porFila)) await expect.poll(() => estado(jobId), { timeout: 20_000, interval: 200 }).toBe('concluido')

    const iniciadoEm = (jobId: string) =>
      logsDesde(desde, ...WORKERS_INTERATIVOS, ...WORKERS_DE_LOTE)
        .filter(({ registro }) => registro['jobId'] === jobId && registro['evento'] === 'job.iniciado')
        .map(({ servico }) => servico.replace(/-\d$/, ''))
    expect(iniciadoEm(porFila.lote)).toEqual(['worker-lote'])
    expect(iniciadoEm(porFila.normal)).toEqual(['worker-interativo'])
    expect(iniciadoEm(porFila.interativa)).toEqual(['worker-interativo'])
  }, 60_000)

  it('kill -9 no worker-interativo no meio do job: o lock vence, a outra réplica retoma em menos de 30 s, e o job termina concluido', async () => {
    const desde = new Date().toISOString()
    // As duas réplicas de pé: o tempo medido é o da retomada, não o de subir a outra réplica.
    const jobId = await criarJob({ cpuMs: 20_000 })
    await expect.poll(() => estado(jobId), { timeout: 20_000, interval: 200 }).toBe('ativo')
    const iniciosDoJob = () =>
      logsDesde(desde, ...WORKERS_INTERATIVOS).filter(({ registro }) => registro['jobId'] === jobId && registro['evento'] === 'job.iniciado')
    await expect.poll(() => iniciosDoJob().length, { timeout: 10_000, interval: 200 }).toBe(1)
    const [primeiroInicio] = iniciosDoJob()
    const morto = primeiroInicio?.servico ?? ''
    const sobrevivente = WORKERS_INTERATIVOS.find((servico) => servico !== morto) ?? ''
    try {
      await composeAssincronoOuFalha('kill', '--signal', 'SIGKILL', morto)
      const mortoEm = performance.now()
      expect(estadoDoServico(morto)).toBe('exited 137')

      // Lock de 10 s e verificação de stalled a cada 5 s na fila interativa: abaixo do alerta de 30 s.
      await expect.poll(() => iniciosDoJob().some(({ servico }) => servico === sobrevivente), { timeout: 30_000, interval: 500 }).toBe(true)
      expect(performance.now() - mortoEm).toBeLessThan(30_000)
      await expect.poll(() => estado(jobId), { timeout: 40_000, interval: 500 }).toBe('concluido')
      const doJob = logsDesde(desde, morto, sobrevivente).filter(({ registro }) => registro['jobId'] === jobId)
      expect(doJob.filter(({ servico }) => servico === morto).map(({ registro }) => registro['evento'])).toEqual(['job.iniciado'])
      expect(doJob.filter(({ servico }) => servico === sobrevivente).map(({ registro }) => registro['evento'])).toEqual(['job.iniciado', 'job.concluido'])
    } finally {
      await composeAssincronoOuFalha('up', '--detach', '--wait', ...WORKERS_INTERATIVOS)
    }
  }, 180_000)

  it('SIGTERM no worker no meio do job: ele termina o job antes de sair, com código 0', async () => {
    const [primeiro, segundo] = WORKERS_INTERATIVOS
    await composeAssincronoOuFalha('stop', segundo)
    try {
      const desde = new Date().toISOString()
      const jobId = await criarJob({ cpuMs: 4_000 })
      await expect.poll(() => estado(jobId), { timeout: 20_000, interval: 200 }).toBe('ativo')

      await composeAssincronoOuFalha('stop', primeiro)
      expect(estadoDoServico(primeiro)).toBe('exited 0')
      expect(await estado(jobId)).toBe('concluido')
      const eventos = logsDesde(desde, primeiro).filter(({ registro }) => registro['jobId'] === jobId).map(({ registro }) => registro['evento'])
      expect(eventos).toEqual(['job.iniciado', 'job.concluido'])
    } finally {
      await composeAssincronoOuFalha('up', '--detach', '--wait', ...WORKERS_INTERATIVOS)
    }
  }, 120_000)

  it('Redis de fila fora por 2 min: a API aceita na hora, despachantes e workers seguem de pé e saudáveis, e ao religar cada job executa uma vez', async () => {
    const desde = new Date().toISOString()
    const inicioDaQueda = performance.now()
    await composeAssincronoOuFalha('stop', 'redis-fila')
    try {
      const ids: string[] = []
      for (let indice = 0; indice < 5; indice++) {
        const inicio = performance.now()
        ids.push(await criarJob({ cpuMs: 0 }))
        expect(performance.now() - inicio).toBeLessThan(1_000)
      }
      // Dois minutos inteiros de Redis fora, conferindo os processos a cada 10 s.
      while (performance.now() - inicioDaQueda < 120_000) {
        await new Promise((resolver) => setTimeout(resolver, 10_000))
        for (const servico of PROCESSOS_DA_FILA) {
          expect(compose('ps', '--all', '--format', '{{.State}} {{.ExitCode}} {{.Health}}', servico).saida.trim(), servico).toBe('running 0 healthy')
        }
      }
      for (const id of ids) expect(await estado(id)).not.toBe('concluido')

      await composeAssincronoOuFalha('start', 'redis-fila')
      await aguardarSaudavel('redis-fila')
      // Nada foi reservado na queda (sem Redis não há vaga): com ele de volta, a rodada seguinte despacha.
      for (const id of ids) await expect.poll(() => estado(id), { timeout: 60_000, interval: 500 }).toBe('concluido')

      const registros = logsDesde(desde, ...PROCESSOS_DA_FILA)
      expect(registros.filter(({ registro }) => String(registro['evento']).startsWith('processo.'))).toEqual([])
      expect(registros.some(({ registro }) => registro['evento'] === 'despachante.vaga_indisponivel')).toBe(true)
      for (const id of ids) {
        const inicios = registros.filter(({ registro }) => registro['evento'] === 'job.iniciado' && registro['jobId'] === id)
        expect(inicios, id).toHaveLength(1)
      }
    } finally {
      await composeAssincronoOuFalha('up', '--detach', '--wait', 'redis-fila')
    }
  }, 300_000)
})
