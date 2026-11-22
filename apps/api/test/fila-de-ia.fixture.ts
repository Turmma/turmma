import {
  createDatabase,
  createLLMGateway,
  createLogger,
  createPool,
  destinoDoAdaptador,
  Heartbeat,
  JobOutbox,
  JobOutboxRepository,
  LLMGateway,
  runInContext,
  SoberaniaNaSubida,
  systemClock,
  TASK_CATALOG,
  type Clock,
  type DeclaracaoDeSoberania,
  type JanelaLetiva,
  type Database,
  type DatabasePool,
  type DestinoDoAdaptador,
  type JobExecution,
  type GenerationRequest,
  type GenerationResult,
  type LimiteDeTokens,
  type LLMGatewayPorts,
  type LLMProvider,
  type LoggerBase,
  type Meter,
  type ModeloAprovado,
  type Perfil,
  type SuspensaoDeFuncao,
} from '@educa/core'
import { NestFactory, ModulesContainer } from '@nestjs/core'
import type { INestApplicationContext } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InMemoryLog, configuracaoDoBanco, esperarORedisNaPrimeiraVez, janelaPadraoDoAmbiente, urlRedisDeFila, vagasPadraoDoAmbiente } from '../../worker/test/queue.fixture.js'
import { createOutboxRelay, type OutboxRelayRuntime } from '../../despachante/src/composition.js'
import type { TarefaDeIa } from '@educa/shared'
import type { ComandoExecutavel } from '../src/ia/execucao-command.js'
import { ConsumoRepository } from '../src/ia/consumo.repository.js'
import { ExecucaoProcessor } from '../src/ia/execucao.processor.js'
import type { FabricaDePrazo } from '../src/ia/prazo-por-temporizador.js'
import { ExecucaoScheduler } from '../src/ia/execucao.scheduler.js'
import { buildComandos } from '../src/ia/montar-comandos.js'
import { OrcamentoRepository } from '../src/ia/orcamento.repository.js'
import { RegistroDeComandos } from '../src/ia/registro-de-comandos.js'
import { SuspensaoRepository } from '../src/ia/suspensao.repository.js'
import { VarreduraDeExecucoes } from '../src/ia/varredura-de-execucoes.js'
import { createWorkerDeIa, type FilaDaIa, type WorkerDeIa } from '../src/ia/worker-de-ia.js'
import { AlcanceDoAluno } from '../src/tutor/turno.command.js'
import { TrechoSearch } from '../src/material/trecho-search.js'
import { testConfig, type TestOverrides } from './test-config.js'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { ScriptedAdapter } from '../../../packages/core/src/ia/__fixtures__/scripted-adapter.js'
import { subirApi, type TestApi } from './test-api.js'
import { LLM_PROVIDER } from '../src/ia/ia.module.js'
import { WorkerModule } from '../src/worker.module.js'
import { LIMITE_DE_TOKENS, LIMITE_DE_TOKENS_DA_RESERVA, SOBERANIA_DA_RESERVA } from '../src/ia/ia-do-worker.module.js'
import type { AppModuleOptions } from '../src/app.module.js'

/** O modelo que o teste põe no lugar do falso: recebe o pedido que o gateway receberia e devolve a saída e a medição. */
export type { FabricaDePrazo }

export type ModeloDeTeste = (pedido: GenerationRequest<unknown, unknown>) => Promise<{ readonly saida: unknown; readonly medicao?: unknown }>

/**
 * O gateway **real** com principal e reserva (reserva-e-avaliacao, 5.0; `techspec.md` §5, "A bancada"): dois `ScriptedAdapter` de envio externo, cada um com o `provedorId` dele (o suboperador de cada um é o
 * cadastro que o teste semeia com essa chave), no lugar do gateway com o adaptador falso. Só ele troca o gateway sem trocar o processador, o worker nem o `ConsumoRepository`: a linha de consumo que o teste lê
 * no banco é a que o `ConsumoRepository` gravou com o destino que o gateway deu a cada chamada. `comModelo` não serve aqui, porque troca o gateway inteiro e não deixa linha nenhuma.
 */
export interface GatewayDaBancada {
  readonly principal: { readonly provedorId: string; readonly roteiro: readonly (string | Error)[] }
  readonly reserva: { readonly provedorId: string; readonly roteiro: readonly (string | Error)[] }
  /** As tarefas que a reserva atende, aprovadas no provedor e no modelo dela em cada perfil (`reserva-<perfil>`): o que a elegibilidade confere. */
  readonly aprovadas: readonly TarefaDeIa[]
  /** A conferência da D62 da reserva que o gateway lê a cada chamada: a `SoberaniaNaSubida` de verdade, com o cadastro, ou a declaração do teste. Sem ela, vale conferida. */
  readonly conferenciaDaReserva?: DeclaracaoDeSoberania
}

/** A reserva da bancada: outro modelo em cada perfil (`reserva-<perfil>`), o que a aprovação confere junto do provedor. */
class ReservaRoteirizada extends ScriptedAdapter {
  override modeloDoPerfil(perfil: Perfil): string {
    return `reserva-${perfil}`
  }
}

/** Os dois adaptadores do gateway da bancada, com o contador de chamadas de cada um (`chamadas`). */
export interface AdaptadoresDaBancada {
  readonly principal: ScriptedAdapter
  readonly reserva: ScriptedAdapter
}

export interface FilaDeIaOptions {
  /** O registro que o processador consulta no lugar dos seis comandos do produto. Só o teste dos comandos de mentira o troca. */
  readonly registro?: RegistroDeComandos
  /** Jobs de IA ao mesmo tempo, por fila. O padrão é o de `.env.example`. */
  readonly pools?: Partial<Record<FilaDaIa, number>>
  /** O pool de banco da réplica. O padrão é o de 20 do `worker-ia`. */
  readonly conexoes?: number
  /** O prazo único de cada execução, que o teste troca para ver o estouro sem esperar 140 s. */
  readonly prazo?: FabricaDePrazo
  readonly graca?: number
  readonly medidor?: Meter
  /** Para onde o adaptador configurado manda o conteúdo, que a linha estimada da execução interrompida leva (6.0). O padrão é o da configuração de teste: o falso, sem envio externo. */
  readonly destino?: DestinoDoAdaptador
  /** Sobe a API, o despachante e o worker sem ligar o consumo: o job espera no outbox. Quem liga é `ligar()`. */
  readonly semConsumir?: true
  /** O relógio da situação da licença de material, o mesmo que a API recebeu em `montagem.relogioDasLicencas`. */
  readonly relogioDasLicencas?: Clock
  /** O gateway real com principal e reserva roteirizados, no lugar do que tem o adaptador falso. */
  readonly gateway?: GatewayDaBancada
}

/** A janela sem dia letivo: nunca está "em aula", então o lote não espera. */
const JANELA_SEM_AULA: JanelaLetiva = { fuso: 'America/Sao_Paulo', diasLetivos: [], inicio: '07:00', fim: '18:00' }

/** O corte das consultas do pool da bancada: folgado, porque o teste que segura uma escrita com gatilho (`WriteBlockTrigger`) a deixa esperar. */
const TEMPO_DA_CONSULTA_MS = 30_000

/** O registro que o processador consulta: pergunta à bancada a cada job, e por isso acompanha o `usarRegistro`. */
class RegistroDaBancada extends RegistroDeComandos {
  constructor(private readonly atual: () => RegistroDeComandos) {
    super()
  }

  override de(tarefa: TarefaDeIa): ComandoExecutavel {
    return this.atual().de(tarefa)
  }
}

const FILAS_POR_API = new WeakMap<TestApi, FilaDeIa>()

function adaptadoresDe({ principal, reserva }: GatewayDaBancada): AdaptadoresDaBancada {
  return { principal: new ScriptedAdapter(principal.roteiro, true, principal.provedorId), reserva: new ReservaRoteirizada(reserva.roteiro, true, reserva.provedorId) }
}

/** A aprovação de cada tarefa para o provedor e o modelo que a reserva usa no perfil dela: o `sha256` e o relatório são do teste, e `reservaElegivel` só confere tarefa, provedor e modelo. */
function aprovacoesDe({ reserva, aprovadas }: GatewayDaBancada): ModeloAprovado[] {
  return aprovadas.map((tarefa) => ({
    tarefa,
    provedorId: reserva.provedorId,
    modelo: `reserva-${TASK_CATALOG[tarefa].perfil}`,
    relatorio: 'docs/avaliacao/teste/relatorio.md',
    sha256: 'sha-da-bancada',
    aprovadoPor: 'bancada-de-teste',
    aprovadoEm: '2026-11-22',
  }))
}

/** Os tipos de job que o worker de IA da bancada consome: o que ela espera (`ociosa`) e o que ela descarta ao subir (`subir`) saem desta lista. */
export const TIPOS_DE_JOB_DE_IA = ['ia.executar', 'ia.executar-lote']

/** A conferência da reserva do `main-worker` (`null` sem reserva): a suíte da subida a lê aqui, porque só a bancada conhece o módulo da IA. */
export function soberaniaDaReservaDe(contexto: INestApplicationContext): SoberaniaNaSubida | null {
  return contexto.get<SoberaniaNaSubida | null>(SOBERANIA_DA_RESERVA, { strict: false })
}

/** Espera a bancada da API ficar ociosa: o que os fixtures que só têm a API (`execucaoTerminada`) usam. Sem bancada ligada a ela, falha em vez de passar em branco. */
export async function esperarAFilaDeIa(api: TestApi): Promise<void> {
  const fila = FILAS_POR_API.get(api)
  if (fila === undefined) throw new Error('esta API não foi subida por FilaDeIa.subir: não há worker de IA para esperar')
  await fila.ociosa()
}

/**
 * A bancada da IA no worker (X6, 5.0), no molde de `apps/worker/test/queue.fixture.ts`: a API de verdade, o despachante que publica
 * pelo outbox e o consumo das filas `api-*` pelo `JobExecutor` real, com o processador do produto, no Redis e no Postgres de teste.
 * Cada bancada tem o prefixo do BullMQ dela, para não disputar fila nem vaga com outro teste.
 *
 * **É o único lugar de teste que monta o processador, o worker de IA, o provedor do worker ou o registro do worker**
 * (`tools/guardas/executor-so-na-bancada.test.ts`): a suíte que precisa de um modelo de mentira o pede por `comModelo`, e não
 * troca provedor nem executor por conta própria.
 */
export class FilaDeIa {
  /**
   * Quantas bancadas deste arquivo de teste estão de pé: só a primeira limpa o que outro arquivo deixou, e a segunda (a réplica de um caso) não apaga o job da primeira.
   * Vale porque o Vitest dá a cada arquivo de teste uma cópia nova dos módulos (o padrão, que `vitest.config.ts` não muda): com `isolate: false` no projeto
   * `integracao`, o contador passaria de um arquivo para o outro, e um arquivo que esquecesse o `fechar()` desligaria a limpeza sem avisar.
   */
  static #vivas = 0
  #fechada = false
  readonly prefixo = `teste-ia-${randomUUID()}`
  readonly log = new InMemoryLog('worker-ia-teste')
  /** O registro que o processador e o agendador da bancada consultam; `usarRegistro` o troca entre um pedido e outro. */
  registro: RegistroDeComandos
  /** O pool e o banco da réplica, os que o worker de IA usa: separados dos da API, como no compose. */
  readonly pool: DatabasePool
  readonly banco: Database
  #gateway: LLMProvider
  readonly #portas: Pick<LLMGatewayPorts, 'registro' | 'orcamento' | 'suspensao' | 'logger' | 'medidor'>
  /** Os dois adaptadores do gateway real (`opcoes.gateway`); só `#montarORoteirizado` escreve. */
  #adaptadores: AdaptadoresDaBancada | undefined
  /** Para onde o adaptador configurado manda o conteúdo: o do processador e o da varredura da bancada. */
  readonly destino: DestinoDoAdaptador
  readonly #despachante: OutboxRelayRuntime
  /** A busca de trechos do worker: o teste a espia aqui para ver o que a execução leu, e não a da API. */
  readonly trechos: TrechoSearch
  #portao: Promise<void> = Promise.resolve()
  readonly #inicio = new Date()
  #modelo: ModeloDeTeste | undefined
  #agora: (() => Date) | undefined
  #janela: JanelaLetiva | undefined
  #worker: WorkerDeIa | undefined
  readonly #opcoes: FilaDeIaOptions
  readonly #logger: LoggerBase
  /** O medidor da bancada: o do processador e o da varredura contam nele, e é nele que o teste lê `ia.espera_estourada` e `ia.execucao.interrompida`. */
  readonly #medidor: Meter

  private constructor(readonly api: TestApi, opcoes: FilaDeIaOptions, sobreposicao: TestOverrides, medidor: Meter) {
    this.#opcoes = opcoes
    this.#medidor = medidor
    // Com `linhasDeLog`, o worker escreve na mesma lista da API (até `trace`): o teste procura nela o que nunca pode ir a log.
    const linhas = api.linhasDeLog
    this.#logger = linhas === undefined ? this.log.logger : createLogger({ servico: 'worker-ia-teste', nivel: 'trace', destino: { write: (linha: string) => linhas.push(linha) } })
    this.pool = createPool({ ...configuracaoDoBanco(opcoes.conexoes ?? 20), timeoutConsultaMs: TEMPO_DA_CONSULTA_MS }, () => undefined)
    this.banco = createDatabase(this.pool)
    const suspensao: SuspensaoDeFuncao = new SuspensaoRepository(this.banco)
    this.destino = opcoes.destino ?? destinoDoAdaptador(testConfig(sobreposicao).ia)
    this.#portas = {
      registro: new ConsumoRepository(this.banco),
      // O mês do teto de segurança do lote é o do relógio da bancada (`fixarHorario`): o teste da virada do mês põe o job às 00h10 de 1º/12 sem esperar.
      orcamento: new OrcamentoRepository(this.banco, { agora: () => (this.#agora ?? systemClock.agora)() }),
      suspensao,
      logger: this.#logger,
      medidor,
    }
    this.#gateway = opcoes.gateway === undefined ? createLLMGateway(testConfig(sobreposicao).ia, this.#portas) : this.#montarORoteirizado(opcoes.gateway)
    const trechos = new TrechoSearch(this.banco, opcoes.relogioDasLicencas)
    this.trechos = trechos
    this.registro = opcoes.registro ?? new RegistroDeComandos()
    if (opcoes.registro === undefined) buildComandos(this.registro, this.banco, trechos, suspensao, new AlcanceDoAluno(this.banco, trechos), medidor)
    this.#despachante = createOutboxRelay(
      { banco: configuracaoDoBanco(3), redisFilaUrl: urlRedisDeFila(), vagasPadrao: vagasPadraoDoAmbiente(), janelaPadrao: janelaPadraoDoAmbiente() },
      this.#logger,
      { prefixo: this.prefixo },
    )
    esperarORedisNaPrimeiraVez(this.#despachante)
  }

  /** Sobe a API e liga a bancada: o despachante publica e o worker consome, a menos que `semConsumir`. */
  static async subir(medidor: Meter, sobreposicao: TestOverrides = {}, linhasDeLog?: string[], opcoes: FilaDeIaOptions = {}, montagem?: AppModuleOptions): Promise<FilaDeIa> {
    const api = await subirApi(medidor, sobreposicao, linhasDeLog, ...(montagem === undefined ? [] : [montagem]))
    const relogioDasLicencas = opcoes.relogioDasLicencas ?? montagem?.relogioDasLicencas
    const fila = new FilaDeIa(api, relogioDasLicencas === undefined ? opcoes : { ...opcoes, relogioDasLicencas }, sobreposicao, opcoes.medidor ?? medidor)
    FILAS_POR_API.set(api, fila)
    // O banco é um só para todos os arquivos e `job_registro` não é esvaziado entre eles: o job de IA que o arquivo anterior deixou `aguardando` (o lote
    // que a extração do PDF agenda, o de uma bancada sem consumo) seria publicado pelo despachante desta e rodaria no worker dela, contra o modelo dela.
    // Limpa antes de ligar, e antes de o teste gravar qualquer job: o que ele agenda depois é dele.
    // O `delete` não tem escopo de escola, e isso é de propósito: é limpeza de harness no banco de teste compartilhado (o pool vem de `configuracaoDoBanco`, que só abre o banco de
    // teste), e não consulta de produto, por isso não leva `@Unscoped()`. Não copie esta linha para repository nem para rotina de `apps/*/src`. A execução (`execucao_agente`)
    // cujo job some fica `pendente` para sempre: quem conta execuções pendentes no banco de teste filtra pela escola que o próprio teste criou.
    if (FilaDeIa.#vivas === 0) await fila.pool.query("delete from job_registro where tipo = any($1::text[]) and estado not in ('concluido', 'falhou')", [TIPOS_DE_JOB_DE_IA])
    FilaDeIa.#vivas += 1
    if (opcoes.semConsumir !== true) fila.ligar()
    return fila
  }

  /** O provedor do worker: o gateway real com o adaptador falso, ou o modelo que o teste pôs em `comModelo`. */
  readonly provedor: LLMProvider = {
    generate: <Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>): Promise<GenerationResult<Saida>> =>
      this.#modelo === undefined ? this.#gateway.generate(pedido) : (this.#modelo(pedido as GenerationRequest<unknown, unknown>) as unknown as Promise<GenerationResult<Saida>>),
  }

  /** O gateway de verdade, que o `comModelo` pode chamar para só enfeitar a saída. */
  falso(): LLMProvider {
    return this.#gateway
  }

  /**
   * Monta o `LLMGateway` real com os dois adaptadores roteirizados (`GatewayDaBancada`). O contador de chamadas de cada adaptador recomeça em zero.
   *
   * **Sem o `ResilientAdapter`** que `createLLMGateway` põe no principal e na reserva: a bancada não prova o prazo por perfil, a repetição nem o disjuntor de cada provedor, e o "disjuntor" de um caso é só o motivo do
   * `LLMError` que o roteiro lança. O que ela prova é o roteamento do gateway, a linha de consumo que o `ConsumoRepository` grava por chamada e o que o compartilhamento do aluno lê dela; o `ResilientAdapter` é
   * provado em `resilient-adapter.test.ts` e em `llm-gateway.test.ts`.
   */
  #montarORoteirizado(gateway: GatewayDaBancada): LLMProvider {
    const adaptadores = adaptadoresDe(gateway)
    this.#adaptadores = adaptadores
    return new LLMGateway({
      ...this.#portas,
      adaptador: adaptadores.principal,
      // O principal externo conferido: a conferência do principal é a do `soberania-na-subida.int.test.ts`, e o que esta bancada prova é o roteamento e a linha de cada chamada.
      soberania: { conferida: true },
      soberaniaDaReserva: gateway.conferenciaDaReserva ?? { conferida: true },
      reserva: { adaptador: adaptadores.reserva, ambiente: 'local', aprovados: aprovacoesDe(gateway) },
    })
  }

  /** Os dois adaptadores do gateway real (`opcoes.gateway`), para o teste contar as chamadas de cada um; ausentes no gateway do adaptador falso. Só leitura. */
  get adaptadores(): AdaptadoresDaBancada | undefined {
    return this.#adaptadores
  }

  /** Troca os roteiros do gateway real: o caso seguinte recomeça com adaptadores novos e o contador de chamadas em zero, sem subir outra API. Só vale numa bancada subida com `gateway`. */
  roteirizar(gateway: GatewayDaBancada): void {
    this.#gateway = this.#montarORoteirizado(gateway)
  }

  /** O modelo de mentira do teste. Devolve o que desfaz a troca; o `afterEach` do teste a desfaz de qualquer forma por `restaurar`. */
  comModelo(modelo: ModeloDeTeste): () => void {
    this.#modelo = modelo
    return () => {
      if (this.#modelo === modelo) this.#modelo = undefined
    }
  }

  /**
   * O instante e o horário letivo que o processador confere para o job do `lote` (classificacao-bncc, 4.0): o teste da janela põe o job às 7h05 sem esperar. Sem chamar isto, a escola não tem dia letivo
   * e o lote roda a qualquer hora, como o relógio do sistema. `restaurar()` desfaz.
   */
  fixarHorario(agora: Date, janela: JanelaLetiva): void {
    this.#agora = () => agora
    this.#janela = janela
  }

  restaurar(): void {
    this.#agora = undefined
    this.#janela = undefined
    this.#modelo = undefined
    this.#liberarPortao?.()
  }

  #liberarPortao: (() => void) | undefined

  /**
   * Segura o começo de toda execução, a partir de agora, até o `liberar` que devolve: é o intervalo entre o `202` e o `preparar`, em que o teste muda o banco
   * (tira o vínculo, o material, a pessoa) para ver o que a execução confere ao rodar. O job espera com a vaga tomada; nada do que ele lê foi lido ainda.
   */
  segurar(): () => void {
    let liberar: () => void = () => undefined
    this.#portao = new Promise<void>((resolver) => {
      liberar = resolver
    })
    this.#liberarPortao = liberar
    return liberar
  }

  /** Troca o registro dos comandos: o teste que prova o gateway ou o agendador com um comando de mentira registra o dele aqui, uma tarefa por registro. */
  usarRegistro(registro: RegistroDeComandos): void {
    this.registro = registro
  }

  /** O agendador da API com o registro desta bancada: o do teste dos comandos de mentira, ou os seis do produto. */
  agendador(suspensao: SuspensaoDeFuncao = new SuspensaoRepository(this.banco)): ExecucaoScheduler {
    return new ExecucaoScheduler(this.banco, suspensao, this.registro, new JobOutbox(new JobOutboxRepository(this.banco)))
  }

  /** O processador do produto, com o provedor, o registro e o destino da bancada: o mesmo que o worker de IA consome e que `entregarDeNovo` chama. */
  #processador: ExecucaoProcessor | undefined
  get processador(): ExecucaoProcessor {
    return (this.#processador ??= new ExecucaoProcessor({
      banco: this.banco,
      ia: this.provedor,
      comandos: new RegistroDaBancada(() => this.registro),
      suspensao: new SuspensaoRepository(this.banco),
      destino: this.destino,
      logger: this.#logger,
      medidor: this.#medidor,
      janelaDaEscola: { daEscola: () => Promise.resolve(this.#janela ?? JANELA_SEM_AULA) },
      relogio: { agora: () => (this.#agora ?? systemClock.agora)() },
      ...(this.#opcoes.prazo === undefined ? {} : { prazo: this.#opcoes.prazo }),
    }))
  }

  /**
   * Entrega o job `ia.executar` da execução **de novo**, direto ao processador e no contexto da escola dela, como o `JobExecutor` o faria: a reentrega do job que o worker
   * morto deixou (~15 s), ou a segunda entrega do mesmo job. Sem passar pela fila: o teste da 6.0 escolhe o instante, e a vaga, o Redis e o relógio da fila não entram.
   */
  entregarDeNovo(execucaoId: string, escolaId: string, sinal?: AbortSignal): Promise<void> {
    const execucao: JobExecution = { jobId: randomUUID(), tentativa: 1, chaveIdempotencia: execucaoId, prazoMs: 150_000 }
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => this.processador.processar({ execucaoId }, execucao, sinal))
  }

  /** A varredura do `main-worker`, com o banco e o destino da bancada. Não liga o relógio: o teste chama `varrer()`. */
  varredura(): VarreduraDeExecucoes {
    return new VarreduraDeExecucoes(this.banco, this.#logger, this.destino, this.#medidor)
  }

  /** Liga o despachante e o consumo das três filas. */
  ligar(): void {
    this.#despachante.start()
    const processador = this.processador
    this.#worker = createWorkerDeIa(
      {
        redisFilaUrl: urlRedisDeFila(),
        pools: { interativa: 10, ferramenta: 10, normal: 5, lote: 5, ...this.#opcoes.pools },
        vagasPadrao: vagasPadraoDoAmbiente(),
      },
      { banco: this.banco, pool: this.pool },
      {
        'ia.executar': async (dados, execucao, sinal) => { await this.#portao; return processador.processar(dados, execucao, sinal) },
        'ia.executar-lote': async (dados, execucao, sinal) => { await this.#portao; return processador.processar(dados, execucao, sinal) },
      },
      this.#logger,
      { prefixo: this.prefixo, ...(this.#opcoes.graca === undefined ? {} : { graca: this.#opcoes.graca }), ...(this.#opcoes.medidor === undefined ? {} : { medidor: this.#opcoes.medidor }) },
    )
  }

  /** A API montada pelo `AppModule` não tem o provedor de modelo: só o `main-worker` o provê (techspec §1). */
  apiTemProvedor(): boolean {
    try {
      this.api.app.get(LLM_PROVIDER, { strict: false })
      return true
    } catch {
      return false
    }
  }

  /** Quantos controllers o contexto montou: a API tem muitos, e o `main-worker` nenhum. */
  static controllersDe(contexto: INestApplicationContext): number {
    return [...contexto.get(ModulesContainer, { strict: false }).values()].reduce((total, modulo) => total + modulo.controllers.size, 0)
  }

  /**
   * Sobe o `WorkerModule` de verdade, o do `main-worker`, como contexto de aplicação (sem HTTP, sem porta), e devolve o que o teste confere: os
   * controllers, se ele resolve o provedor e se o healthcheck de batimento foi escrito. O batimento vai para um arquivo do teste, e não para o `/tmp/educa-batimento`.
   */
  static async subirOMainWorker(opcoes: { readonly semTokensPorMinuto?: true; readonly reserva?: { readonly tokensPorMinuto?: number } } = {}): Promise<{
    readonly controllers: number
    readonly temProvedor: boolean
    /** O limite de tokens do módulo (49.0): o nome da classe, ou `null` sem `LLM_TOKENS_POR_MINUTO`. */
    readonly limiteDeTokens: string | null
    /** O provedor do worker leu o limite do módulo, e não outro: é o que o gateway reserva antes de cada chamada. */
    readonly gatewayReservaNele: boolean
    /** O limitador do principal, o objeto que o módulo montou (ausente sem `LLM_TOKENS_POR_MINUTO`). */
    readonly limiteDoPrincipal: LimiteDeTokens | null
    /** O limitador da reserva (F5b, 2.0), o objeto que o módulo montou: `null` sem reserva, ou sem `LLM_RESERVA_TOKENS_POR_MINUTO`. */
    readonly limiteDaReserva: LimiteDeTokens | null
    /** O gateway leu o limitador da reserva do módulo, e não o do principal nem outro. */
    readonly gatewayTemOLimiteDaReserva: boolean
    /** A conferência da D62 da reserva que o módulo montou, ou `null` sem reserva. */
    readonly soberaniaDaReserva: { readonly conferida: boolean } | null
    /** O gateway leu a conferência da reserva do módulo (a porta de `reservaElegivel`), e não outra. */
    readonly gatewayTemASoberaniaDaReserva: boolean
    readonly fechar: () => Promise<void>
  }> {
    const { reserva } = opcoes
    // A reserva falsa, `falso-reserva`, com o contratado dela quando o caso o diz: o `local` a aceita sem ele.
    const sobreposicao: TestOverrides =
      reserva === undefined
        ? {}
        : { ambiente: { IA_RESERVA_ADAPTADOR: 'falso', ...(reserva.tokensPorMinuto === undefined ? {} : { LLM_RESERVA_TOKENS_POR_MINUTO: String(reserva.tokensPorMinuto) }) } }
    const config = testConfig(sobreposicao)
    const { tokensPorMinuto: _tokens, ...iaSemTokens } = config.ia
    const ia = opcoes.semTokensPorMinuto === true ? iaSemTokens : config.ia
    const arquivo = join(mkdtempSync(join(tmpdir(), 'main-worker-')), 'batimento')
    const contexto = await NestFactory.createApplicationContext(
      WorkerModule.forRoot(
        {
          banco: configuracaoDoBanco(5),
          redisFilaUrl: urlRedisDeFila(),
          pools: { interativa: 1, ferramenta: 1, normal: 1, lote: 1 },
          vagasPadrao: vagasPadraoDoAmbiente(),
          janelaPadrao: janelaPadraoDoAmbiente(),
          telemetria: config.telemetria,
          ia,
        },
        createLogger({ servico: 'main-worker-teste', nivel: 'silent' }),
        // Sem exportação: o medidor do teste não tem coletor.
        new MedidorDeTeste().medidor,
        new Heartbeat(arquivo),
      ),
      { logger: false },
    )
    const limite = contexto.get<{ constructor: { name: string } } | null>(LIMITE_DE_TOKENS, { strict: false })
    const provedor = contexto.get<{ dependencias: { limiteDeTokens?: unknown; limiteDeTokensDaReserva?: unknown; soberaniaDaReserva?: unknown } }>(LLM_PROVIDER, { strict: false })
    const limiteDaReserva = contexto.get<LimiteDeTokens | null>(LIMITE_DE_TOKENS_DA_RESERVA, { strict: false })
    const soberaniaDaReserva = contexto.get<{ conferida: boolean } | null>(SOBERANIA_DA_RESERVA, { strict: false })
    return {
      controllers: FilaDeIa.controllersDe(contexto),
      limiteDeTokens: limite === null ? null : limite.constructor.name,
      gatewayReservaNele: provedor.dependencias.limiteDeTokens !== undefined && provedor.dependencias.limiteDeTokens === limite,
      limiteDoPrincipal: limite as LimiteDeTokens | null,
      limiteDaReserva,
      gatewayTemOLimiteDaReserva: provedor.dependencias.limiteDeTokensDaReserva !== undefined && provedor.dependencias.limiteDeTokensDaReserva === limiteDaReserva,
      soberaniaDaReserva,
      gatewayTemASoberaniaDaReserva: provedor.dependencias.soberaniaDaReserva !== undefined && provedor.dependencias.soberaniaDaReserva === soberaniaDaReserva,
      temProvedor: (() => {
        try {
          contexto.get(LLM_PROVIDER, { strict: false })
          return true
        } catch {
          return false
        }
      })(),
      fechar: () => contexto.close(),
    }
  }

  /** Para o consumo, como o SIGTERM faria, e deixa o job no outbox. */
  async desligarWorker(): Promise<void> {
    await this.#worker?.encerrar()
    this.#worker = undefined
  }

  /**
   * Espera todo `ia.executar` que esta bancada publicou terminar: nenhum job de IA criado depois do início dela fica fora de
   * `concluido` ou `falhou`. É o que a suíte espera antes de ler a execução, no lugar do `ociosa()` do executor em processo.
   */
  async ociosa(limiteMs = 30_000): Promise<void> {
    const prazo = Date.now() + limiteMs
    for (;;) {
      const { rows } = await this.pool.query<{ total: string }>(
        "select count(*)::text as total from job_registro where tipo = any($1::text[]) and criado_em >= $2 and estado not in ('concluido', 'falhou')",
        [TIPOS_DE_JOB_DE_IA, this.#inicio],
      )
      if (rows[0]?.total === '0') return
      if (Date.now() > prazo) throw new Error('a bancada de IA não ficou ociosa no prazo')
      await new Promise((resolver) => setTimeout(resolver, 25))
    }
  }

  /** Roda `corpo` como quem pediu, no contexto de escola e pessoa, pela transação da bancada: para o teste que fala com o repository. */
  como<T>(escolaId: string, usuarioId: string, corpo: () => Promise<T>): Promise<T> {
    return runInContext({ requisicaoId: randomUUID(), escolaId, usuarioId }, corpo)
  }

  async fechar(): Promise<void> {
    if (!this.#fechada) {
      this.#fechada = true
      FilaDeIa.#vivas -= 1
    }
    this.restaurar()
    await this.#worker?.encerrar().catch(() => undefined)
    await this.#despachante.encerrar().catch(() => undefined)
    await this.api.app.close()
    await this.pool.end()
  }
}

