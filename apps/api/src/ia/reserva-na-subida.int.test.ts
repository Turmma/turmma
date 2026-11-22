import 'reflect-metadata'
import { adaptadorDaReserva, bullmqQueueName, createLogger, Heartbeat, MODELO_FALSO, reservaElegivel, SoberaniaNaSubida, type ModeloAprovado } from '@educa/core'
import { NestFactory } from '@nestjs/core'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteExemplo } from '../../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { urlRedisDeFila } from '../../../worker/test/queue.fixture.js'
import { soberaniaDaReservaDe } from '../../test/fila-de-ia.fixture.js'
import { SessaoFixtures } from '../../test/sessao.fixture.js'
import { testConfig } from '../../test/test-config.js'
import { loadWorkerConfig, type MainWorkerConfig } from '../worker-config.js'
import { WorkerModule } from '../worker.module.js'

/**
 * A reserva sobe configurada, e a D62 dela é conferida **sem segurar o principal** (reserva-e-avaliacao, 2.0; `techspec.md` §5 "A subida"; `cenarios.md` §1, RF1 e "o alerta da reserva"). O `main-worker`
 * confere o suboperador vigente da `IA_RESERVA_PROVEDOR_ID` numa `SoberaniaNaSubida` própria: enquanto ela não passa, a reserva não é elegível e `ia.provedor_de_reserva.conferido` vale 0, mas o consumo das filas
 * `api-*` e o batimento seguem o principal (o inverso de `soberania-na-subida.int.test.ts`, em que o principal não conferido para o worker). Sem reserva configurada, a série nem existe.
 *
 * O endereço dos dois provedores é de mentira e nenhuma chamada sai (regra 30, item 3). O suboperador é semeado por SQL com chave própria de cada caso, e sai no fim.
 */
const bancada = new SessaoFixtures()
const medidorDoArquivo = new MedidorDeTeste()
const sql = (texto: string, valores: unknown[] = []) => bancada.pool.query(texto, valores)

const FILAS_DA_IA = ['interativa', 'ferramenta', 'normal'] as const
const CHAVES_SEMEADAS: string[] = []
const ARQUIVOS_DE_BATIMENTO: string[] = []
const A_FECHAR: (() => Promise<void>)[] = []
const CHAVE_DA_RESERVA = 'chave-secreta-da-reserva-0123456789'
const MODELO_DA_RESERVA = 'modelo-da-reserva'
const SERIE = 'ia.provedor_de_reserva.conferido'

const chaveNova = (): string => `res-${randomUUID().slice(0, 12)}`

/** O principal externo, com o provedor dele. */
const principalExterno = (provedor: string): Record<string, string> => ({
  IA_ADAPTADOR: 'openai_compat',
  LLM_BASE_URL: 'https://api.provedor-de-teste.example/v1',
  LLM_MODELO: 'modelo-de-teste',
  LLM_PROCESSAMENTO_LOCAL: 'false',
  IA_PROVEDOR_ID: provedor,
})
/** A reserva `openai_compat`: outro provedor, outro modelo, e uma chave que nunca pode aparecer no log. */
const reservaExterna = (provedor: string): Record<string, string> => ({
  IA_RESERVA_ADAPTADOR: 'openai_compat',
  LLM_RESERVA_BASE_URL: 'https://reserva.provedor-de-teste.example/v1',
  LLM_RESERVA_MODELO: MODELO_DA_RESERVA,
  IA_RESERVA_PROVEDOR_ID: provedor,
  LLM_RESERVA_CHAVE_API: CHAVE_DA_RESERVA,
})

interface Cadastro {
  pais: string
  vedaTreinamento: boolean
  alcance: 'todas' | 'lista'
  encerrado: boolean
  categorias: string[]
}

/** O suboperador que cobre a D62 da reserva. Com a chave aleatória dos casos, nenhuma tarefa está aprovada para ela (`MODELOS_APROVADOS` só tem a reserva falsa): as categorias exigidas são nenhuma, e as `categorias` do cadastro não decidem. O caso da aprovação (`falso-reserva` em `openai_compat`) é o que as faz decidir. */
async function cadastrar(chave: string, mudanca: Partial<Cadastro> = {}): Promise<void> {
  const cadastro: Cadastro = { pais: 'BR', vedaTreinamento: true, alcance: 'todas', encerrado: false, categorias: ['conversa_do_aluno', 'conversa_do_professor', 'material_da_escola', 'trabalho_do_aluno'], ...mudanca }
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
  await medidorDoArquivo.encerrar()
})

const redis = new Redis(urlRedisDeFila(), { maxRetriesPerRequest: null })
afterAll(async () => {
  await redis.quit()
})

function configDoWorker(ambienteDeIa: Record<string, string>): MainWorkerConfig {
  return loadWorkerConfig({
    ...lerAmbienteExemplo(),
    AMBIENTE: 'local',
    BANCO_URL: testConfig().banco.url,
    REDIS_FILA_URL: urlRedisDeFila(),
    TELEMETRIA_OTLP_URL: 'http://observabilidade:4318',
    WORKER_IA_POOL_INTERATIVA: '1',
    WORKER_IA_POOL_FERRAMENTA: '1',
    WORKER_IA_POOL_NORMAL: '1',
    WORKER_IA_POOL_LOTE: '1',
    JANELA_LETIVA_FUSO: 'America/Sao_Paulo',
    JANELA_LETIVA_DIAS: '1,2,3,4,5',
    JANELA_LETIVA_INICIO: '07:00',
    JANELA_LETIVA_FIM: '18:00',
    ...ambienteDeIa,
  })
}

/** O `WorkerModule` do `main-worker`, montado como o `main-worker.ts` o monta. Devolve as duas conferências: a do principal, que segura o consumo, e a da reserva, que não. */
async function subirWorker(config: MainWorkerConfig, opcoes: { linhas?: string[]; medidor?: MedidorDeTeste } = {}) {
  const arquivoDoBatimento = join(tmpdir(), `educa-batimento-teste-${randomUUID()}`)
  ARQUIVOS_DE_BATIMENTO.push(arquivoDoBatimento)
  const { linhas } = opcoes
  const logger =
    linhas === undefined
      ? createLogger({ servico: 'worker-ia-teste', nivel: 'silent' })
      : createLogger({ servico: 'worker-ia-teste', nivel: 'trace', destino: { write: (linha: string) => linhas.push(linha) } })
  const medidor = opcoes.medidor ?? medidorDoArquivo
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config, logger, medidor.medidor, new Heartbeat(arquivoDoBatimento)), { logger: false })
  // Fechado uma vez só: quem fecha antes (o caso do reinício) tira o fechamento do `afterEach`.
  const fecharApp = () => app.close()
  A_FECHAR.push(fecharApp)
  const fechar = async () => {
    const posicao = A_FECHAR.indexOf(fecharApp)
    if (posicao >= 0) A_FECHAR.splice(posicao, 1)
    await app.close()
  }
  const principal = app.get(SoberaniaNaSubida)
  await principal.start()
  const reserva = soberaniaDaReservaDe(app)
  await reserva?.start()
  return { app, fechar, principal, reserva, bateu: () => existsSync(arquivoDoBatimento) }
}

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

/** O que `ia.provedor_de_reserva.conferido` diz de um provedor agora. */
async function conferidoDe(medidor: MedidorDeTeste, provedor: string): Promise<(number | { contagem: number; soma: number })[]> {
  return (await medidor.pontos(SERIE)).filter((ponto) => ponto.atributos['provedor'] === provedor).map((ponto) => ponto.valor)
}

/** O `codigo` da recusa da reserva no log, o que o operador procura no runbook. */
const motivoDaRecusaDaReserva = (linhas: string[]): string | undefined =>
  linhas.map((linha) => JSON.parse(linha) as { evento?: string; codigo?: string }).find((linha) => linha.evento === 'ia.provedor_de_reserva.conferencia_recusada')?.codigo

describe('o main-worker sobe com a reserva sem suboperador vigente: o principal passa e consome, a reserva fica fora do caminho (RF1)', () => {
  it('reserva sem suboperador vigente: o worker consome as filas e bate o batimento, o principal passa, `conferido = 0`, e o log não leva a chave nem o contrato', async () => {
    const principal = chaveNova()
    const reservaChave = chaveNova()
    // O principal externo conferido ao lado da reserva recusada: o cadastro dele cobre, o dela não existe.
    await cadastrar(principal)
    const linhas: string[] = []
    const worker = await subirWorker(configDoWorker({ ...principalExterno(principal), ...reservaExterna(reservaChave) }), { linhas })
    expect(worker.principal.conferida).toBe(true)
    expect(worker.reserva?.conferida).toBe(false)
    await expect.poll(consumidores, { timeout: 10_000 }).toBe(FILAS_DA_IA.length)
    expect(worker.bateu()).toBe(true)
    expect(await conferidoDe(medidorDoArquivo, reservaChave)).toEqual([0])
    expect(motivoDaRecusaDaReserva(linhas)).toBe('sem_suboperador_vigente')
    const dito = linhas.join('\n')
    expect(dito).not.toContain(CHAVE_DA_RESERVA)
    expect(dito).not.toContain('DPA-D62')
  })

  it.each([
    ['pais', { pais: 'US' }, 'pais_fora_do_brasil'],
    ['veda_treinamento', { vedaTreinamento: false }, 'treinamento_nao_vedado'],
    ['alcance', { alcance: 'lista' as const }, 'alcance_nao_e_todas'],
    ['vigência', { encerrado: true }, 'sem_suboperador_vigente'],
  ] as const)('recusa da reserva por %s: não conferida, o principal consome, e o log diz o motivo', async (_campo, errado, motivo) => {
    const principal = chaveNova()
    const reservaChave = chaveNova()
    await cadastrar(principal)
    await cadastrar(reservaChave, errado)
    const linhas: string[] = []
    const worker = await subirWorker(configDoWorker({ ...principalExterno(principal), ...reservaExterna(reservaChave) }), { linhas })
    expect(worker.reserva?.conferida).toBe(false)
    expect(worker.principal.conferida).toBe(true)
    await expect.poll(consumidores, { timeout: 10_000 }).toBe(FILAS_DA_IA.length)
    expect(worker.bateu()).toBe(true)
    expect(await conferidoDe(medidorDoArquivo, reservaChave)).toEqual([0])
    expect(motivoDaRecusaDaReserva(linhas)).toBe(motivo)
  })

  it('o suboperador da reserva encerrado depois de conferida: o reinício a recusa, e o principal segue', async () => {
    const principal = chaveNova()
    const reservaChave = chaveNova()
    await cadastrar(principal)
    await cadastrar(reservaChave)
    const antes = await subirWorker(configDoWorker({ ...principalExterno(principal), ...reservaExterna(reservaChave) }))
    expect(antes.reserva?.conferida).toBe(true)
    expect(await conferidoDe(medidorDoArquivo, reservaChave)).toEqual([1])
    await antes.fechar()
    // O contrato vence: o cadastro encerra, e a instância que reinicia já não o encontra vigente.
    await sql(`update suboperador set fim = now() - interval '1 day' where chave = $1`, [reservaChave])
    const depois = await subirWorker(configDoWorker({ ...principalExterno(principal), ...reservaExterna(reservaChave) }))
    expect(depois.reserva?.conferida).toBe(false)
    expect(depois.principal.conferida).toBe(true)
    await expect.poll(consumidores, { timeout: 10_000 }).toBe(FILAS_DA_IA.length)
  })

  it('as categorias que o contrato da reserva tem de cobrir são as das tarefas aprovadas para ela: com `falso-reserva` aprovada em todas, faltar `conversa_do_aluno` recusa, e as quatro conferem', async () => {
    // A única aprovação de `MODELOS_APROVADOS` é a da reserva falsa (todas as tarefas, no modelo falso, fora de produção): a mesma identidade e o mesmo modelo, por `openai_compat`, trazem a aprovação para o `main-worker` de verdade.
    const principal = chaveNova()
    await cadastrar(principal)
    await cadastrar('falso-reserva', { categorias: ['material_da_escola'] })
    const config = configDoWorker({ ...principalExterno(principal), ...reservaExterna('falso-reserva'), LLM_RESERVA_MODELO: MODELO_FALSO })
    const linhas: string[] = []
    const medidor = new MedidorDeTeste()
    A_FECHAR.push(() => medidor.encerrar())
    const { reserva } = await subirWorker(config, { linhas, medidor })
    expect(reserva?.conferida).toBe(false)
    expect(motivoDaRecusaDaReserva(linhas)).toContain('categoria_faltando:conversa_do_aluno')
    expect(await conferidoDe(medidor, 'falso-reserva')).toEqual([0])
    await sql(`update suboperador set categorias = $2::text[] where chave = $1`, ['falso-reserva', ['conversa_do_aluno', 'conversa_do_professor', 'material_da_escola', 'trabalho_do_aluno']])
    await expect.poll(() => reserva?.conferida, { timeout: 20_000, interval: 250 }).toBe(true)
    expect(await conferidoDe(medidor, 'falso-reserva')).toEqual([1])
  })

  it('cadastro da reserva corrigido sem reiniciar: o mesmo processo a confere sozinho, `conferido` passa a 1, e a reserva passa a ser elegível', async () => {
    const principal = chaveNova()
    const reservaChave = chaveNova()
    await cadastrar(principal)
    await cadastrar(reservaChave, { pais: 'US' })
    const config = configDoWorker({ ...principalExterno(principal), ...reservaExterna(reservaChave) })
    const { reserva } = await subirWorker(config)
    expect(reserva?.conferida).toBe(false)
    expect(await conferidoDe(medidorDoArquivo, reservaChave)).toEqual([0])
    // A aprovação que a elegibilidade lê é injetada, para o provedor desta chave: a da constante só tem a reserva falsa.
    const aprovada: ModeloAprovado = { tarefa: 'gerar_atividade_objetiva', provedorId: reservaChave, modelo: MODELO_DA_RESERVA, relatorio: 'docs/avaliacao/falso-reserva/relatorio.md', sha256: 'x', aprovadoPor: 'teste', aprovadoEm: '2026-11-22' }
    const adaptador = adaptadorDaReserva(config.ia)
    const tarefa = { nome: 'gerar_atividade_objetiva', perfil: 'padrao' } as const
    const elegivel = (): boolean => reservaElegivel(tarefa, { ...(adaptador === undefined ? {} : { reserva: adaptador }), ...(reserva === null ? {} : { soberania: reserva }), ambiente: 'local', aprovados: [aprovada] })
    expect(elegivel()).toBe(false)
    await sql(`update suboperador set pais = 'BR' where chave = $1`, [reservaChave])
    await expect.poll(() => reserva?.conferida, { timeout: 20_000, interval: 250 }).toBe(true)
    expect(await conferidoDe(medidorDoArquivo, reservaChave)).toEqual([1])
    expect(elegivel()).toBe(true)
  })

  it('a reserva falsa não envia nada para fora: nasce conferida, e a série vale 1 sem ler o cadastro', async () => {
    const medidor = new MedidorDeTeste()
    A_FECHAR.push(() => medidor.encerrar())
    const worker = await subirWorker(configDoWorker({ IA_RESERVA_ADAPTADOR: 'falso' }), { medidor })
    expect(worker.reserva?.conferida).toBe(true)
    expect(await conferidoDe(medidor, 'falso-reserva')).toEqual([1])
    await expect.poll(consumidores, { timeout: 10_000 }).toBe(FILAS_DA_IA.length)
  })
})

describe('sem reserva configurada nada muda (RF1)', () => {
  it('o worker com o principal só: nenhuma conferência da reserva, a série `ia.provedor_de_reserva.conferido` não é publicada, e o principal consome', async () => {
    const medidor = new MedidorDeTeste()
    A_FECHAR.push(() => medidor.encerrar())
    const principal = chaveNova()
    await cadastrar(principal)
    const worker = await subirWorker(configDoWorker(principalExterno(principal)), { medidor })
    expect(worker.reserva).toBeNull()
    expect(worker.principal.conferida).toBe(true)
    await expect.poll(consumidores, { timeout: 10_000 }).toBe(FILAS_DA_IA.length)
    expect(await medidor.pontos(SERIE)).toEqual([])
  })
})
