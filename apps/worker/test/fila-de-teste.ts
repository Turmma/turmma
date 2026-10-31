import {
  OperationalSettings,
  OperationalSettingsRepository,
  createDatabase,
  createLogger,
  createPool,
  DispatchRepository,
  JobOutbox,
  runInContext,
  JobOutboxRepository,
  lerJanelaPadrao,
  bullmqQueueName,
  QUEUE_PRIORITY,
  resolverVagas,
  EscolaConcurrencyLimiter,
  type Database,
  type DatabaseConfig,
  type QueuedJobData,
  type JanelaLetiva,
  type LoggerBase,
  type Meter,
  type DatabasePool,
  type ConfiguredConcurrency,
  type ConcurrencyByQueue,
} from '@educa/core'
import { JOB_DEFINITIONS, QUEUE_NAMES, type JobState, type QueueName, type JobRegistry } from '@educa/shared'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { criarEscola, criarRede } from '../../api/src/operacao/escola/escola.js'
import { montarDespachante, type DespachanteMontado, type OpcoesDaMontagem as OpcoesDoDespachante } from '../../despachante/src/montagem.js'
import type { ProcessadoresDeJob } from '../src/executor.js'
import { montarWorker, type WorkerMontado } from '../src/montagem.js'

/** O operador que a bancada grava na auditoria da rede e da escola que cria. */
export const OPERADOR_DA_BANCADA = 'teste-fila'

const ambiente = lerAmbienteDeTeste()

/** Consulta com prazo próprio do cliente: o `pg` aceita `query_timeout` por consulta, mas o `@types/pg` não o declara. */
interface ConsultaComPrazoDoCliente {
  text: string
  values: unknown[]
  query_timeout: number
}

/** Prazo da preparação de volume da bancada (`semear`), nos dois lados: servidor e cliente. */
export const PRAZO_DA_PREPARACAO_MS = 60_000

export function configuracaoDoBanco(maximoConexoes = 5): DatabaseConfig {
  return { url: urlDoBancoDeTeste(), maximoConexoes, timeoutConexaoMs: 2_000, timeoutConsultaMs: 2_000 }
}

/** As vagas por fila do padrão do ambiente, as mesmas de `.env.example` com que o despachante sobe. */
export function vagasPadraoDoAmbiente(): ConcurrencyByQueue {
  return {
    interativa: Number(valorObrigatorio(ambiente, 'VAGAS_ESCOLA_INTERATIVA')),
    normal: Number(valorObrigatorio(ambiente, 'VAGAS_ESCOLA_NORMAL')),
    lote: Number(valorObrigatorio(ambiente, 'VAGAS_ESCOLA_LOTE')),
  }
}

/** O horário letivo padrão de `.env.example` (São Paulo, segunda a sexta, 07:00 às 18:00), lido como o despachante lê. */
export function janelaPadraoDoAmbiente(): JanelaLetiva {
  return lerJanelaPadrao(ambiente)
}

export function urlRedisDeFila(): string {
  return `redis://127.0.0.1:${valorObrigatorio(ambiente, 'REDIS_FILA_PORTA_HOST')}`
}

/** Log em memória, para o teste ler o que o processo escreveria no stdout. */
export class LogEmMemoria {
  readonly linhas: string[] = []
  readonly logger: LoggerBase

  constructor(servico: string) {
    this.logger = createLogger({ servico, destino: { write: (linha: string) => this.linhas.push(linha) } })
  }

  registros(): Array<Record<string, unknown>> {
    return this.linhas.map((linha) => JSON.parse(linha) as Record<string, unknown>)
  }

  doEvento(evento: string): Array<Record<string, unknown>> {
    return this.registros().filter((registro) => registro['evento'] === evento)
  }
}

/**
 * O `ioredis` conecta de forma assíncrona, e o cliente do despachante sobe sem fila offline: comando
 * emitido antes da conexão falha na hora. No laço isso não aparece — a rodada termina em
 * `vaga_indisponivel` e a seguinte publica —, mas o teste dirige rodada avulsa, sem próxima, e leria
 * o 0 da conexão como se fosse o resultado do despacho. Era a corrida que deixava a janela
 * intermitente na esteira (correção `2026-09-16-rodada-antes-do-redis-do-despachante`).
 *
 * Por isso toda porta da bancada que lê o Redis logo depois da montagem — `rodada()`, `reconciliar()`
 * e `medir()` — espera o `pronto` na primeira vez. Com o Redis parado de propósito, `pronto` resolve
 * no erro do cliente: a degradação continua exercitada, sem pedágio.
 *
 * Quem chama `iniciar()` também ganha a espera na primeira volta do laço, já que ela passa por
 * `rodada()`. É inofensivo: o laço tentaria de novo de qualquer jeito.
 */
export interface MontadoQueEspera {
  pronto: Promise<void>
  despachante: { rodada: () => Promise<number> }
  reconciliacao: { reconciliar: () => Promise<unknown> }
  medicao?: { medir: () => Promise<void> }
}

export function esperarORedisNaPrimeiraVez(montado: MontadoQueEspera): void {
  let espera: Promise<void> | undefined = montado.pronto
  const esperar = async (): Promise<void> => {
    if (espera === undefined) return
    await espera
    // Uma vez de pé, sempre de pé: as chamadas seguintes não pagam nem um tique a mais.
    espera = undefined
  }

  const rodada = montado.despachante.rodada.bind(montado.despachante)
  montado.despachante.rodada = async () => {
    await esperar()
    return rodada()
  }

  const reconciliar = montado.reconciliacao.reconciliar.bind(montado.reconciliacao)
  montado.reconciliacao.reconciliar = async () => {
    await esperar()
    return reconciliar()
  }

  const { medicao } = montado
  if (medicao !== undefined) {
    const medir = medicao.medir.bind(medicao)
    medicao.medir = async () => {
      await esperar()
      return medir()
    }
  }
}

/**
 * O que o teste pede à bancada: o job como a linha de `job_registro` o guarda, com o que não vier no valor padrão do sintético. O
 * `tipo` é um dos do registro da bancada; o tipo que o registro não tem entra por SQL, no teste que o prova.
 */
export interface PedidoDaBancada<Registro extends JobRegistry = typeof JOB_DEFINITIONS> {
  tipo?: Extract<keyof Registro, string>
  fila?: QueueName
  naoUrgente?: boolean
  dados?: Record<string, unknown>
}

/**
 * O que o teste usa para olhar o banco e as filas por fora: pool próprio, repositories reais, uma
 * `Queue` por fila e as vagas, no mesmo prefixo dos despachantes e workers do teste.
 *
 * O registro de jobs é o de produção, salvo o que o teste injeta (`new BancadaDeFila(definicoes)`): os despachantes e os workers
 * da bancada o usam para publicar com a retentativa do tipo e para validar os dados da linha, e o teste que precisa de um tipo
 * de dados próprios (o `rotulo` do teste de vagas) ou de uma retentativa curta o declara aqui, sem tocar `JOB_DEFINITIONS`.
 */
export class BancadaDeFila<Registro extends JobRegistry = typeof JOB_DEFINITIONS> {
  readonly definicoes: JobRegistry
  readonly prefixo = `teste-${randomUUID()}`
  readonly pool: DatabasePool = createPool(configuracaoDoBanco(), () => undefined)
  readonly banco: Database = createDatabase(this.pool)
  readonly registro = new JobOutboxRepository(this.banco)
  readonly despacho = new DispatchRepository(this.banco)
  readonly enfileirador = new JobOutbox(this.registro)
  readonly redis = new Redis(urlRedisDeFila(), { maxRetriesPerRequest: null })
  readonly filas: Readonly<Record<QueueName, Queue<QueuedJobData>>> = Object.fromEntries(
    QUEUE_NAMES.map((fila) => [fila, new Queue<QueuedJobData>(bullmqQueueName(fila, 'worker'), { connection: this.redis, prefix: this.prefixo })]),
  ) as Record<QueueName, Queue<QueuedJobData>>
  readonly vagas = new EscolaConcurrencyLimiter(this.redis, this.prefixo)
  readonly #montados: Array<DespachanteMontado | WorkerMontado> = []

  constructor(definicoes?: Registro) {
    this.definicoes = definicoes ?? JOB_DEFINITIONS
    // Os testes param o Redis de fila: sem ouvinte, o ioredis escreve cada reconexão no console.
    this.redis.on('error', () => undefined)
    for (const fila of Object.values(this.filas)) fila.on('error', () => undefined)
  }

  /** A fila interativa, onde a maior parte dos testes publica. */
  get fila(): Queue<QueuedJobData> {
    return this.filas.interativa
  }

  /**
   * Uma escola nova, com rede própria, pelos mesmos serviços de `ops:escola`. Desde a tarefa 3.0
   * `job_registro`, `configuracao_operacional_escola` e `uso_infra_diario` têm FK para `escola`: id
   * inventado é recusado pelo banco, e todo teste de fila cria a escola antes de gravar job.
   *
   * O id é sorteado (UUID v4), como o `ops:escola` e o painel fazem: não cresce com a criação, e o teste que compara
   * duas escolas não supõe ordem entre elas (correção `2026-09-24-escola-da-bancada-fora-de-ordem`).
   */
  async escola(): Promise<string> {
    // A bancada não é o comando nem o painel: o autor é fixo, sem conferir operador ativo.
    const autor = async () => OPERADOR_DA_BANCADA
    const { id: redeId } = await criarRede(this.banco, autor, { id: randomUUID(), nome: 'Rede sintética da fila', tipo: 'independente' })
    return (await criarEscola(this.banco, autor, { id: randomUUID(), redeId, nome: 'Escola sintética da fila', slug: `fila-${randomUUID()}` })).id
  }

  /**
   * Grava como o `JobOutbox` grava (na transação, com a escola e a requisição no contexto, pelo mesmo `inserir`), mas sem
   * conferir a definição do tipo: o worker não confia na gravação, e o teste põe na linha o dado que o executor deve recusar
   * (chave a mais, formato errado). A definição é provada pelo `JobOutbox` de verdade, em `execucao.int.test.ts ›
   * enfileirar`, e a do worker, em `execucao.int.test.ts › o worker valida pela definição`.
   */
  enfileirar(escolaId: string, pedido: PedidoDaBancada<Registro> = {}, requisicaoId = randomUUID()): Promise<string> {
    const fila = pedido.fila ?? 'interativa'
    return runInContext({ requisicaoId, escolaId }, () =>
      this.banco.transaction((tx) =>
        this.registro.inserir(tx, {
          tipo: pedido.tipo ?? 'sintetico',
          fila,
          prioridade: QUEUE_PRIORITY[fila],
          naoUrgente: pedido.naoUrgente ?? false,
          dados: pedido.dados ?? { cpuMs: 0, falhar: false },
        }),
      ),
    )
  }

  async estado(id: string): Promise<{ estado: JobState; escolaId: string | null; codigoFalha: string | null } | undefined> {
    const { rows } = await this.pool.query<{ estado: JobState; escolaId: string | null; codigoFalha: string | null }>(
      'select estado, escola_id as "escolaId", codigo_falha as "codigoFalha" from job_registro where id = $1',
      [id],
    )
    return rows[0]
  }

  /** Reserva como o despachante faz, na escola do contexto e na fila, sem tomar vaga. */
  reservar(escolaId: string, fila: QueueName = 'interativa', limite = 1_000) {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => this.despacho.reservarDaEscola(fila, limite))
  }

  /** Vagas no mesmo prefixo, sobre outro cliente: como outra instância as veria. */
  vagasCom(cliente: Redis): EscolaConcurrencyLimiter {
    return new EscolaConcurrencyLimiter(cliente, this.prefixo)
  }

  /** As vagas por fila da escola do contexto, lidas como o despachante lê. */
  vagasDaEscola(): OperationalSettings<ConcurrencyByQueue> {
    return new OperationalSettings(new OperationalSettingsRepository(this.banco), (linha) => resolverVagas(vagasPadraoDoAmbiente(), linha))
  }

  /** Grava a configuração operacional da escola, como a escola a teria. O que não vier fica nulo: vale o padrão. */
  async configurarEscola(
    escolaId: string,
    configuracao: {
      vagas?: ConfiguredConcurrency | null
      limiteReqUsuarioMin?: number
      limiteReqEscolaMin?: number
      fuso?: string
      diasLetivos?: number[]
      inicio?: string
      fim?: string
    },
  ): Promise<void> {
    await this.pool.query(
      `insert into configuracao_operacional_escola (escola_id, vagas, limite_req_usuario_min, limite_req_escola_min, fuso, dias_letivos, inicio, fim)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (escola_id) do update set vagas = excluded.vagas, limite_req_usuario_min = excluded.limite_req_usuario_min,
         limite_req_escola_min = excluded.limite_req_escola_min, fuso = excluded.fuso, dias_letivos = excluded.dias_letivos,
         inicio = excluded.inicio, fim = excluded.fim`,
      [
        escolaId,
        configuracao.vagas === undefined || configuracao.vagas === null ? null : JSON.stringify(configuracao.vagas),
        configuracao.limiteReqUsuarioMin ?? null,
        configuracao.limiteReqEscolaMin ?? null,
        configuracao.fuso ?? null,
        configuracao.diasLetivos ?? null,
        configuracao.inicio ?? null,
        configuracao.fim ?? null,
      ],
    )
  }

  /** Com `vagasPorEscolaDesligadas`, a montagem do controle negativo do cenário de carga. */
  despachante(log: LogEmMemoria, opcoes: Omit<OpcoesDoDespachante, 'prefixo'> = {}, vagasPorEscolaDesligadas?: true): DespachanteMontado {
    const montado = montarDespachante(
      {
        banco: configuracaoDoBanco(3),
        redisFilaUrl: urlRedisDeFila(),
        vagasPadrao: vagasPadraoDoAmbiente(),
        janelaPadrao: janelaPadraoDoAmbiente(),
        ...(vagasPorEscolaDesligadas === undefined ? {} : { vagasPorEscolaDesligadas }),
      },
      log.logger,
      { prefixo: this.prefixo, definicoes: this.definicoes, ...opcoes },
    )
    this.#montados.push(montado)
    esperarORedisNaPrimeiraVez(montado)
    return montado
  }

  /** Um worker que atende as três filas, com `concorrencia` em cada uma, salvo `pools` explícito. */
  worker(
    log: LogEmMemoria,
    opcoes: {
      concorrencia?: number
      pools?: Partial<Record<QueueName, number>>
      processadores?: ProcessadoresDeJob
      graca?: number
      intervaloRenovacaoDaVagaMs?: number
      validadeDaVagaMs?: number
      medidor?: Meter
      vagasPorEscolaDesligadas?: true
    } = {},
  ): WorkerMontado {
    const pools = opcoes.pools ?? Object.fromEntries(QUEUE_NAMES.map((fila) => [fila, opcoes.concorrencia ?? 5]))
    const montado = montarWorker(
      {
        banco: configuracaoDoBanco(),
        redisFilaUrl: urlRedisDeFila(),
        pools,
        vagasPadrao: vagasPadraoDoAmbiente(),
        threadsMaximo: 2,
        ...(opcoes.vagasPorEscolaDesligadas === undefined ? {} : { vagasPorEscolaDesligadas: opcoes.vagasPorEscolaDesligadas }),
      },
      log.logger,
      {
        prefixo: this.prefixo,
        definicoes: this.definicoes,
        ...(opcoes.processadores === undefined ? {} : { processadores: opcoes.processadores }),
        ...(opcoes.graca === undefined ? {} : { graca: opcoes.graca }),
        ...(opcoes.intervaloRenovacaoDaVagaMs === undefined ? {} : { intervaloRenovacaoDaVagaMs: opcoes.intervaloRenovacaoDaVagaMs }),
        ...(opcoes.validadeDaVagaMs === undefined ? {} : { validadeDaVagaMs: opcoes.validadeDaVagaMs }),
        ...(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor }),
      },
    )
    this.#montados.push(montado)
    return montado
  }

  /**
   * Prepara dado de teste em volume (histórico, fila cheia) com prazo de 60 s, e não o de 2 s do pool, que
   * é o do worker em produção. Desde a tarefa 3.0 cada linha de `job_registro` confere a FK de `escola_id`,
   * e 100 mil linhas numa instrução passam dos 2 s no runner da esteira.
   *
   * Só para preparação: a instrução que o teste mede continua pelo pool normal, com os 2 s, ou a lentidão
   * que o teste deveria pegar passaria em silêncio. O prazo sobe dos dois lados: o `statement_timeout` do
   * servidor e o `query_timeout` do cliente, que o `pg` herda do pool (2 s + 2 s de conexão) e cortaria sozinho.
   */
  async semear(texto: string, valores: unknown[] = []): Promise<void> {
    const cliente = await this.pool.connect()
    let conexaoPerdida: Error | undefined
    try {
      await cliente.query('begin')
      await cliente.query(`set local statement_timeout = '${PRAZO_DA_PREPARACAO_MS}ms'`)
      // O cliente espera um pouco mais que o servidor: quem corta é o Postgres, com o 57014 legível, e a
      // consulta não fica rodando no servidor depois de o cliente desistir.
      const consulta: ConsultaComPrazoDoCliente = { text: texto, values: valores, query_timeout: PRAZO_DA_PREPARACAO_MS + 5_000 }
      await cliente.query(consulta)
      await cliente.query('commit')
    } catch (erro) {
      // Com a conexão perdida o rollback também falharia: o erro que vale é o da preparação, e a conexão sai do pool.
      await cliente.query('rollback').catch((erroDoRollback: unknown) => {
        conexaoPerdida = erroDoRollback instanceof Error ? erroDoRollback : new Error('rollback da preparação falhou')
      })
      throw erro
    } finally {
      cliente.release(conexaoPerdida)
    }
  }

  /** Todo job pendente vira histórico, e toda escola volta ao padrão: um teste não herda fila nem configuração de outro. */
  async limparRegistro(): Promise<void> {
    await this.pool.query('delete from job_registro')
    await this.pool.query('delete from configuracao_operacional_escola')
  }

  async fechar(): Promise<void> {
    await Promise.all(this.#montados.splice(0).map((montado) => montado.encerrar()))
    for (const fila of Object.values(this.filas)) {
      await fila.obliterate({ force: true })
      await fila.close()
    }
    // Vagas e contadores de uso no prefixo do teste: nada fica no Redis de fila com AOF depois dele.
    const chaves = await this.redis.keys(`${this.prefixo}:*`)
    if (chaves.length > 0) await this.redis.del(...chaves)
    await this.redis.quit()
    await this.pool.end()
  }
}
