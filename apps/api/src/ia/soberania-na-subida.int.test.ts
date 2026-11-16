import 'reflect-metadata'
import {
  bullmqQueueName,
  categoriasEnviadasPelasTarefas,
  createLogger,
  Heartbeat,
  SoberaniaNaSubida,
  type DatabaseConfig,
} from '@educa/core'
import { NestFactory } from '@nestjs/core'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteExemplo } from '../../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { urlRedisDeFila } from '../../../worker/test/queue.fixture.js'
import { subirApi, type TestApi } from '../../test/test-api.js'
import { testConfig } from '../../test/test-config.js'
import { SessaoFixtures } from '../../test/sessao.fixture.js'
import { loadWorkerConfig, type MainWorkerConfig } from '../worker-config.js'
import { CicloDoWorkerDeIa, WorkerModule } from '../worker.module.js'

/**
 * A D62 na subida (reengenharia-continuacao, 8.0; `techspec.md` §5 "A D62"; `cenarios.md` §5; decisão A do Joaquim, 16/11). Com provedor externo, só o
 * `main-worker` (`worker-ia`) confere: sem o suboperador **vigente** da `IA_PROVEDOR_ID` com `pais = 'BR'`, treinamento vedado, `alcance = 'todas'` e a
 * união das categorias que as tarefas registradas enviam, ele não cria o consumidor das filas `api-*` nem bate o batimento. **A API não confere**: a
 * `/prontidao` dela responde 200 com a D62 não conferida (o horário de aula é sagrado, regra 80). O adaptador falso e o modelo local sobem sem
 * suboperador. O suboperador é semeado por SQL, com chave própria de cada caso, e sai no fim: o de alcance `todas` aparece em toda escola, também nas
 * telas dos outros testes.
 *
 * O endereço do provedor é de mentira e nenhuma chamada sai: a subida só lê o cadastro, e nada aqui chama provedor pago (regra 30, item 3). Que o gateway
 * recuse a tarefa de aluno sem a conferência é de `packages/core/src/ia/llm-gateway.test.ts`.
 */
const bancada = new SessaoFixtures()
const medidor = new MedidorDeTeste()
const sql = (texto: string, valores: unknown[] = []) => bancada.pool.query(texto, valores)

/** As três filas `api-*` que o `worker-ia` atende. */
const FILAS_DA_IA = ['interativa', 'ferramenta', 'normal'] as const
const EXIGIDAS = categoriasEnviadasPelasTarefas()
const CHAVES_SEMEADAS: string[] = []
const ARQUIVOS_DE_BATIMENTO: string[] = []
const A_FECHAR: (() => Promise<void>)[] = []

/** Uma chave de provedor própria de cada caso, no formato do `IA_PROVEDOR_ID`: só o caso a vê. */
const chaveNova = (): string => `d62-${randomUUID().slice(0, 12)}`

/** O ambiente de IA de um provedor externo: o `LLM_PROCESSAMENTO_LOCAL=false` é o que o declara externo. */
const externo = (provedor: string): Record<string, string> => ({
  IA_ADAPTADOR: 'openai_compat',
  LLM_BASE_URL: 'https://api.provedor-de-teste.example/v1',
  LLM_MODELO: 'modelo-de-teste',
  LLM_PROCESSAMENTO_LOCAL: 'false',
  IA_PROVEDOR_ID: provedor,
})
/** O modelo local: o endereço é desta máquina e o processamento é declarado local. */
const LOCAL: Record<string, string> = { IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: 'http://127.0.0.1:8080/v1', LLM_MODELO: 'modelo-de-teste', LLM_PROCESSAMENTO_LOCAL: 'true' }

interface Cadastro {
  pais: string
  vedaTreinamento: boolean
  alcance: 'todas' | 'lista'
  categorias: string[]
  /** O suboperador encerrado: tem `fim`. */
  encerrado: boolean
}

/** O suboperador que cobre a D62, com o que o caso quer diferente. */
async function cadastrar(chave: string, mudanca: Partial<Cadastro> = {}): Promise<void> {
  const cadastro: Cadastro = { pais: 'BR', vedaTreinamento: true, alcance: 'todas', categorias: [...EXIGIDAS], encerrado: false, ...mudanca }
  CHAVES_SEMEADAS.push(chave)
  await sql(
    `insert into suboperador (chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, inicio, fim, registrado_por)
     values ($1, 'Provedor Sintético da D62', 'Modelo de linguagem', $2::text[], $3, 'DPA-D62', $4, $5, now() - interval '2 days', $6, 'equipe-de-teste')`,
    [chave, cadastro.categorias, cadastro.pais, cadastro.vedaTreinamento, cadastro.alcance, cadastro.encerrado ? new Date(Date.now() - 24 * 3600_000) : null],
  )
}

async function limparCadastros(): Promise<void> {
  if (CHAVES_SEMEADAS.length === 0) return
  await sql('delete from suboperador_escola where suboperador_id in (select id from suboperador where chave = any($1::text[]))', [CHAVES_SEMEADAS])
  await sql('delete from suboperador where chave = any($1::text[])', [CHAVES_SEMEADAS])
  CHAVES_SEMEADAS.length = 0
}

/** Uma porta em que ninguém escuta: o `connect` é recusado na hora, como um Postgres fora de verdade (o erro que o driver lança, e não um dublê). */
async function portaSemNinguem(): Promise<number> {
  const servidor = createServer()
  await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver))
  const { port } = servidor.address() as AddressInfo
  await new Promise<void>((resolver) => servidor.close(() => resolver()))
  return port
}

/** O banco de teste num endereço que ninguém atende. */
async function bancoFora(): Promise<Partial<DatabaseConfig>> {
  const { url } = testConfig().banco
  return { url: url.replace(/@127\.0\.0\.1:\d+\//, `@127.0.0.1:${String(await portaSemNinguem())}/`), timeoutConexaoMs: 500, timeoutConsultaMs: 500 }
}

async function prontidao(api: TestApi): Promise<{ status: number; corpo: unknown }> {
  const resposta = await fetch(`${api.url}/prontidao`)
  return { status: resposta.status, corpo: await resposta.json() }
}

/** Sobe a API com o ambiente de IA do caso. */
async function subirComIa(ambiente: Record<string, string>, opcoes: { banco?: Partial<DatabaseConfig> } = {}): Promise<TestApi> {
  const api = await subirApi(medidor.medidor, { ambiente, ...(opcoes.banco === undefined ? {} : { banco: opcoes.banco }) })
  A_FECHAR.push(() => api.app.close())
  return api
}

beforeAll(() => {
  // `worker-ia` do compose de pé consumiria as filas `api-*` junto com o deste arquivo, e o caso do consumidor contaria o dele.
  compose('stop', ...PROCESSOS_DA_FILA)
})

afterEach(async () => {
  for (const fechar of A_FECHAR.splice(0)) await fechar()
  for (const arquivo of ARQUIVOS_DE_BATIMENTO.splice(0)) rmSync(arquivo, { force: true })
  await limparCadastros()
})

afterAll(async () => {
  await limparCadastros()
  await bancada.fechar()
  await medidor.encerrar()
})

describe('a API não confere a D62: a prontidão dela responde como antes da 8.0 (RF9, decisão A)', () => {
  it('provedor externo com o cadastro que não cobre a D62: a API responde 200 em /prontidao', async () => {
    const chave = chaveNova()
    await cadastrar(chave, { pais: 'US' })
    const api = await subirComIa(externo(chave))
    expect(await prontidao(api)).toEqual({ status: 200, corpo: { pronta: true } })
  })

  it('provedor externo sem suboperador nenhum, ou com o banco fora: a API responde 200 em /prontidao', async () => {
    const semCadastro = await subirComIa(externo(chaveNova()))
    expect(await prontidao(semCadastro)).toEqual({ status: 200, corpo: { pronta: true } })
    const semBanco = await subirComIa(externo(chaveNova()), { banco: await bancoFora() })
    expect(await prontidao(semBanco)).toEqual({ status: 200, corpo: { pronta: true } })
  })

  it.each([
    ['o adaptador falso', {}],
    ['o modelo local', LOCAL],
  ])('%s: a API responde 200 em /prontidao, com o banco no ar ou fora', async (_nome, ambiente) => {
    const api = await subirComIa(ambiente)
    expect(await prontidao(api)).toEqual({ status: 200, corpo: { pronta: true } })
    const semBanco = await subirComIa(ambiente, { banco: await bancoFora() })
    expect(await prontidao(semBanco)).toEqual({ status: 200, corpo: { pronta: true } })
  })
})

describe('o main-worker só consome fila com a D62 conferida (RF9)', () => {
  const redis = new Redis(urlRedisDeFila(), { maxRetriesPerRequest: null })
  afterAll(async () => {
    await redis.quit()
  })

  function configDoWorker(ambienteDeIa: Record<string, string>, banco: Partial<DatabaseConfig> = {}): MainWorkerConfig {
    const base = loadWorkerConfig({
      ...lerAmbienteExemplo(),
      AMBIENTE: 'local',
      BANCO_URL: testConfig().banco.url,
      REDIS_FILA_URL: urlRedisDeFila(),
      TELEMETRIA_OTLP_URL: 'http://observabilidade:4318',
      WORKER_IA_POOL_INTERATIVA: '1',
      WORKER_IA_POOL_FERRAMENTA: '1',
      WORKER_IA_POOL_NORMAL: '1',
      ...ambienteDeIa,
    })
    return { ...base, banco: { ...base.banco, ...banco } }
  }

  /** O `WorkerModule` do `main-worker`, montado como o `main-worker.ts` o monta, com o batimento num arquivo só do caso. */
  async function subirWorker(config: MainWorkerConfig, linhas?: string[]) {
    const arquivoDoBatimento = join(tmpdir(), `educa-batimento-teste-${randomUUID()}`)
    ARQUIVOS_DE_BATIMENTO.push(arquivoDoBatimento)
    const logger =
      linhas === undefined
        ? createLogger({ servico: 'worker-ia-teste', nivel: 'silent' })
        : createLogger({ servico: 'worker-ia-teste', nivel: 'trace', destino: { write: (linha: string) => linhas.push(linha) } })
    const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config, logger, medidor.medidor, new Heartbeat(arquivoDoBatimento)), { logger: false })
    A_FECHAR.push(() => app.close())
    const soberania = app.get(SoberaniaNaSubida)
    await soberania.iniciar()
    return { app, soberania, bateu: () => existsSync(arquivoDoBatimento) }
  }

  /** O que o `worker-ia` de uma instância não conferida faz: nada. Nenhum consumidor nas três filas e nenhum batimento. */
  async function exigirParado(soberania: SoberaniaNaSubida, bateu: () => boolean): Promise<void> {
    expect(soberania.conferida).toBe(false)
    expect(await consumidores()).toBe(0)
    expect(bateu()).toBe(false)
  }

  /** O motivo que o log da recusa traz (`codigo`), o que o operador procura no runbook. */
  const motivoDaRecusa = (linhas: string[]): string | undefined =>
    linhas.map((linha) => JSON.parse(linha) as { evento?: string; codigo?: string }).find((linha) => linha.evento === 'ia.soberania_na_subida_recusada')?.codigo

  /** Quantos consumidores o BullMQ conhece nas três filas `api-*` da IA, pelas conexões abertas no Redis. */
  async function consumidores(): Promise<number> {
    const contagens = await Promise.all(
      FILAS_DA_IA.map(async (fila) => {
        const fila_ = new Queue(bullmqQueueName(fila, 'api'), { connection: redis })
        try {
          return (await fila_.getWorkers()).length
        } finally {
          await fila_.close()
        }
      }),
    )
    return contagens.reduce((soma, quantidade) => soma + quantidade, 0)
  }

  it('o falso e o local consomem na hora, sem suboperador: um consumidor por fila e o batimento', async () => {
    expect(await consumidores()).toBe(0)
    const { bateu } = await subirWorker(configDoWorker({}))
    await expect.poll(consumidores, { timeout: 10_000 }).toBe(FILAS_DA_IA.length)
    expect(bateu()).toBe(true)
  })

  it('o local, com o banco fora, também consome: sem envio externo não há o que conferir', async () => {
    const { bateu } = await subirWorker(configDoWorker(LOCAL, await bancoFora()))
    await expect.poll(consumidores, { timeout: 10_000 }).toBe(FILAS_DA_IA.length)
    expect(bateu()).toBe(true)
  })

  it('externo com o suboperador que cobre tudo: consome', async () => {
    const chave = chaveNova()
    await cadastrar(chave)
    const { soberania, bateu } = await subirWorker(configDoWorker(externo(chave)))
    expect(soberania.conferida).toBe(true)
    await expect.poll(consumidores, { timeout: 10_000 }).toBe(FILAS_DA_IA.length)
    expect(bateu()).toBe(true)
  })

  it.each([
    ['pais', { pais: 'US' }, 'pais_fora_do_brasil'],
    ['veda_treinamento', { vedaTreinamento: false }, 'treinamento_nao_vedado'],
    ['alcance', { alcance: 'lista' as const }, 'alcance_nao_e_todas'],
    ['vigência', { encerrado: true }, 'sem_suboperador_vigente'],
  ] as const)('recusa por %s: o worker não consome nem bate o batimento, e o log diz o motivo', async (_campo, errado, motivo) => {
    const chave = chaveNova()
    await cadastrar(chave, errado)
    const linhas: string[] = []
    const { soberania, bateu } = await subirWorker(configDoWorker(externo(chave)), linhas)
    await exigirParado(soberania, bateu)
    expect(motivoDaRecusa(linhas)).toBe(motivo)
  })

  it.each(EXIGIDAS.map((categoria) => [categoria]))('recusa por categoria faltando, %s: só a categoria que falta, e só ela, para o worker', async (categoria) => {
    const chave = chaveNova()
    await cadastrar(chave, { categorias: EXIGIDAS.filter((outra) => outra !== categoria) })
    const linhas: string[] = []
    const { soberania, bateu } = await subirWorker(configDoWorker(externo(chave)), linhas)
    await exigirParado(soberania, bateu)
    expect(motivoDaRecusa(linhas)).toBe(`categoria_faltando:${categoria}`)
  })

  it('o suboperador vigente é de outra IA_PROVEDOR_ID: o worker não consome, ainda que o outro cubra tudo, e o log diz que não há vigente do provedor', async () => {
    await cadastrar(chaveNova())
    const linhas: string[] = []
    const { soberania, bateu } = await subirWorker(configDoWorker(externo(chaveNova())), linhas)
    await exigirParado(soberania, bateu)
    expect(motivoDaRecusa(linhas)).toBe('sem_suboperador_vigente')
  })

  it('externo com o cadastro que não cobre: nenhum consumidor e nenhum batimento; corrigido o cadastro, passa a consumir sozinho', async () => {
    const chave = chaveNova()
    await cadastrar(chave, { categorias: EXIGIDAS.filter((categoria) => categoria !== 'conversa_do_aluno') })
    const { soberania, bateu } = await subirWorker(configDoWorker(externo(chave)))
    expect(soberania.conferida).toBe(false)
    // O consumidor não nasce logo depois da recusa: a nova conferência só vem em 5 s (`INTERVALO_DA_NOVA_CONFERENCIA_MS`), e as várias seguidas são provadas em `soberania.test.ts`.
    await new Promise((resolver) => setTimeout(resolver, 1_500))
    expect(await consumidores()).toBe(0)
    expect(bateu()).toBe(false)
    await sql(`update suboperador set categorias = $2::text[] where chave = $1`, [chave, EXIGIDAS])
    await expect.poll(consumidores, { timeout: 20_000, interval: 250 }).toBe(FILAS_DA_IA.length)
    expect(bateu()).toBe(true)
  })

  it('externo que desliga sem ter conferido: fechar a aplicação não cria o consumidor', async () => {
    const chave = chaveNova()
    await cadastrar(chave, { pais: 'US' })
    const { app, soberania, bateu } = await subirWorker(configDoWorker(externo(chave)))
    expect(soberania.conferida).toBe(false)
    await app.close()
    await new Promise((resolver) => setTimeout(resolver, 1_000))
    expect(await consumidores()).toBe(0)
    expect(bateu()).toBe(false)
  })

  it('a conferência encerrada sem o ciclo desligar solta o ciclo com false, e ele não cria o consumidor', async () => {
    const chave = chaveNova()
    await cadastrar(chave, { pais: 'US' })
    const { soberania, bateu } = await subirWorker(configDoWorker(externo(chave)))
    await exigirParado(soberania, bateu)
    soberania.encerrar()
    await new Promise((resolver) => setTimeout(resolver, 500))
    await exigirParado(soberania, bateu)
  })

  it('o ciclo desligado antes de a D62 ser conferida não cria o consumidor quando ela é conferida depois', async () => {
    const chave = chaveNova()
    await cadastrar(chave, { pais: 'US' })
    const { app, soberania, bateu } = await subirWorker(configDoWorker(externo(chave)))
    await exigirParado(soberania, bateu)
    // Só o ciclo desliga; a conferência segue viva e passa a conferir quando o cadastro é corrigido: o consumidor não pode nascer depois do desligamento.
    await app.get(CicloDoWorkerDeIa).onApplicationShutdown()
    await sql(`update suboperador set pais = 'BR' where chave = $1`, [chave])
    await expect.poll(() => soberania.conferida, { timeout: 20_000, interval: 250 }).toBe(true)
    await new Promise((resolver) => setTimeout(resolver, 500))
    expect(await consumidores()).toBe(0)
    expect(bateu()).toBe(false)
  })

  it('externo com o banco fora: não consome fila nem bate o batimento, e o log é o do banco, não o da recusa do cadastro', async () => {
    const linhas: string[] = []
    const { soberania, bateu } = await subirWorker(configDoWorker(externo(chaveNova()), await bancoFora()), linhas)
    await new Promise((resolver) => setTimeout(resolver, 1_500))
    await exigirParado(soberania, bateu)
    const eventos = linhas.map((linha) => (JSON.parse(linha) as { evento?: string }).evento)
    expect(eventos).toContain('ia.soberania_na_subida_sem_banco')
    expect(eventos).not.toContain('ia.soberania_na_subida_recusada')
  })
})
