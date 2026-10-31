import {
  queuedJobDataSchema,
  runInContext,
  INTERVALO_RENOVACAO_DA_VAGA_MS,
  summarizeError,
  type OperationalSettings,
  type UsageMeter,
  type RequestContext,
  type JobOutboxRepository,
  type LoggerBase,
  type EscolaConcurrencyLimiter,
  type ConcurrencyByQueue,
} from '@educa/core'
import { ErrorCode, JobFailureCode, JOB_DEFINITIONS, InvariantException, type ParsedJobData, type QueueName, type JobRegistry, type JobType } from '@educa/shared'
import { DelayedError, UnrecoverableError, type Job } from 'bullmq'
import { randomUUID } from 'node:crypto'
import { FalhaDeJob } from './job-failure.error.js'

/**
 * A execução que o processador está rodando. A entrega é pelo menos uma vez (D49): o mesmo job pode chegar
 * ao processador mais de uma vez, e todo efeito dele (linha gravada, chamada de IA, aviso) usa
 * `chaveIdempotencia` para não duplicar. Efeito externo pago reserva a chave **antes** de disparar (grava com a
 * chave e só chama se a gravação entrou, ou entrega a chave ao gateway): o `on conflict` depois da chamada
 * protege a linha, não a fatura.
 */
export interface ExecucaoDoJob {
  /** O id do job em `job_registro`, que é também o `jobId` do BullMQ. */
  readonly jobId: string
  /**
   * A tentativa do BullMQ, a partir de 1: sobe na retentativa depois de falha. O stalled devolve o job sem
   * contar tentativa, e a republicação pela reconciliação recomeça do 1. Serve ao log, nunca à idempotência.
   */
  readonly tentativa: number
  /** Igual ao id do job em toda tentativa, em toda reentrega pelo stalled e em toda republicação pela reconciliação. */
  readonly chaveIdempotencia: string
  /**
   * O prazo de uma tentativa, da definição do tipo (`JOB_DEFINITIONS`). O executor corta a tentativa nele: aborta o `sinal`,
   * falha com `TEMPO_ESGOTADO` e libera a vaga. O processador que ignora o `sinal` segue rodando depois do corte, e só a
   * idempotência o protege (D49).
   */
  readonly prazoMs: number
}

/**
 * Processa os dados de um tipo de job, lidos do Postgres e validados pelo esquema estrito do tipo (`JOB_DEFINITIONS`), no
 * contexto da escola do job. O tipo de `dados` é o da definição: ler campo que ela não tem não compila. Precisa tolerar
 * reexecução: pode rodar de novo depois de ter gravado o efeito, e até ao mesmo tempo que outra execução.
 *
 * O `sinal` aborta quando a tentativa passa do `prazoMs` ou quando o worker é desligado além da graça; o executor sempre o
 * entrega, e é opcional só para o teste que chama o processador direto. Trabalho que pode durar passa o `sinal` adiante e
 * para quando ele aborta; o que não o escuta continua depois do corte e depende de ser idempotente.
 */
export type Processador<Tipo extends JobType = JobType> = (dados: ParsedJobData<Tipo>, execucao: ExecucaoDoJob, sinal?: AbortSignal) => Promise<void>

/** Os processadores de uma réplica, um por tipo: o de cada chave recebe os dados do tipo dela. */
export type ProcessadoresDeJob = { readonly [Tipo in JobType]?: Processador<Tipo> }

/**
 * O processador sem o tipo dos dados. O tipo do job é lido da linha, em execução, e o compilador não liga o texto à chave do
 * `ProcessadoresDeJob`: este é o único ponto sem prova de tipo, e o que o protege é o executor passar a ele só o que o esquema
 * do mesmo tipo leu.
 */
type ProcessadorSemTipo = (dados: never, execucao: ExecucaoDoJob, sinal: AbortSignal) => Promise<void>

export type JobDaFila = Pick<Job, 'id' | 'data' | 'attemptsMade' | 'opts' | 'moveToDelayed'>

/**
 * Aviso de vaga livre ao despachante, com no máximo um aviso em andamento: as vagas que se liberam enquanto ele
 * vai ao banco viram um aviso só, logo em seguida. Com cinquenta jobs terminando por segundo, o worker não
 * empilha consulta no pool, e o despachante acorda uma vez por rodada, não uma por job.
 */
export class AvisoDeVagaLivre {
  #emAndamento = false
  #pendente = false

  constructor(
    private readonly enviar: () => Promise<void>,
    private readonly aoFalhar: (erro: unknown) => void,
  ) {}

  readonly avisar = (): void => {
    if (this.#emAndamento) {
      this.#pendente = true
      return
    }
    this.#emAndamento = true
    this.enviar()
      .catch(this.aoFalhar)
      .finally(() => {
        this.#emAndamento = false
        if (!this.#pendente) return
        this.#pendente = false
        this.avisar()
      })
  }
}

/** Espera mínima de um job que chegou ao worker sem vaga, antes de a fila o entregar de novo. */
export const ESPERA_POR_VAGA_MS = 1_000

export interface DependenciasDoExecutor {
  repositorio: Pick<JobOutboxRepository, 'localizarParaExecucao' | 'iniciarExecucao' | 'concluir' | 'registrarFalha'>
  processadores: ProcessadoresDeJob
  /** O registro de jobs que valida os dados, confere o escopo e dá o prazo de cada tipo. Só o teste troca o de produção. */
  definicoes?: JobRegistry
  logger: LoggerBase
  vagas: Pick<EscolaConcurrencyLimiter, 'tomar' | 'renovar' | 'liberar'>
  /** Vagas por fila da escola do contexto: as da configuração dela, ou o padrão do ambiente. */
  vagasDaEscola: Pick<OperationalSettings<ConcurrencyByQueue>, 'daEscola'>
  /** Conta cada execução iniciada na escola do job (D30). Disparar e esquecer: nunca atrasa nem falha o job. */
  uso: Pick<UsageMeter, 'marcar'>
  /**
   * Chamado depois de cada vaga liberada no Redis, para o despachante publicar o próximo job da escola na hora.
   * Disparar e esquecer, como o uso: nunca atrasa nem falha o job.
   */
  aoLiberarVaga?: () => void
  /** Conta o job que chegou sem vaga e voltou a esperar, na fila e na escola da linha (métrica `job.aguardando_vaga`). */
  aoAguardarVaga?: (fila: QueueName, escolaId: string | null) => void
  intervaloRenovacaoMs?: number
}

/** A vaga do job: fila e escola da linha persistida, nunca do `data` do job na fila. */
interface VagaDoJob {
  fila: QueueName
  escolaId: string | null
  jobId: string
}

/**
 * A tentativa que roda agora neste worker. `interromper` (o SIGTERM além da graça) percorre o conjunto delas: o `controle` aborta o
 * processador, o `contexto` é o da escola do job (a falha grava só a linha dela) e `ultimaTentativa` diz se há outra para repetir.
 */
interface TentativaEmAndamento {
  readonly vaga: VagaDoJob
  readonly contexto: RequestContext
  readonly controle: AbortController
  readonly ultimaTentativa: boolean
  /** O `interromper` já tratou esta tentativa: o que o processador devolver depois não é falha dele nem mexe na vaga. */
  interrompida: boolean
}

/** A tentativa passou do `prazoMs` do tipo. Não é definitiva: segue a retentativa do tipo, e a vaga sai em toda tentativa estourada. */
class TempoEsgotado extends FalhaDeJob {
  constructor() {
    super(JobFailureCode.TEMPO_ESGOTADO)
  }
}

/** A tentativa em curso é a última que a fila dá ao job (`attempts`, uma só quando a fila não diz). Quem decide a falha final e o desligamento usam a mesma conta. */
function esgotouAsTentativas(job: JobDaFila): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
}

/** Erro que já saiu com a mensagem limpa (só o código) e pode ir para o Redis como está. */
class ErroParaAFila extends Error {
  override readonly name = 'ErroParaAFila'
}

/**
 * Renovação periódica da vaga de um job em execução. As renovações saem uma de cada vez, e `parar`
 * espera a que estiver em andamento: nenhuma renovação chega ao Redis depois da liberação, o que
 * devolveria ao ZSET a vaga de um job já terminado por mais uma validade.
 */
class RenovacaoDaVaga {
  #fila: Promise<void> = Promise.resolve()
  readonly #temporizador: NodeJS.Timeout

  constructor(renovar: () => Promise<void>, intervaloMs: number) {
    this.#temporizador = setInterval(() => {
      this.#fila = this.#fila.then(renovar)
    }, intervaloMs)
  }

  parar(): Promise<void> {
    clearInterval(this.#temporizador)
    return this.#fila
  }
}

/**
 * O que o worker faz com cada job que o BullMQ entrega:
 *
 * 1. restaura o contexto (`escolaId`, `requisicaoId`) do `data` que o despachante copiou da linha
 *    persistida; nada vem de parâmetro solto;
 * 2. localiza a linha pelo repository, que aplica o escopo dessa escola: job inexistente e job de
 *    outra escola dão o mesmo `nao_encontrado` e não rodam;
 * 3. toma a vaga com a fila e a escola da linha e o limite da configuração dessa escola. O despachante
 *    já a tomou ao publicar, e aqui ela só se confirma; sem vaga (publicação ambígua, vaga vencida
 *    numa queda longa), o job volta a esperar sem gastar tentativa nem executar: o teto vale na
 *    execução, e não só na publicação;
 * 4. marca `ativo`, conta a execução no uso da escola, confere a definição do tipo (`JOB_DEFINITIONS`: o escopo e o
 *    esquema estrito dos dados lidos do Postgres, sem confiar em quem gravou a linha), roda o processador do tipo com esses
 *    dados e a execução (`jobId`, `tentativa`, `chaveIdempotencia`, `prazoMs`), e renova a vaga enquanto ele roda;
 * 5. marca `concluido`, ou, na última tentativa, `falhou` com código tipado, e libera a vaga.
 *
 * Na retentativa, a vaga fica com o job. Job que já terminou não roda de novo, mesmo que a fila o
 * entregue outra vez. Falha do Redis ao tomar, renovar ou liberar não para o job: a vaga vence sozinha.
 *
 * **A entrega é pelo menos uma vez, não exatamente uma vez** (D49). O que é único é a reserva no banco; a
 * execução pode se repetir: reentrega a partir de `ativo`, `concluir` que falha depois de o processador
 * terminar, falso stalled com o lock vencido, reconciliação que republica um job `ativo` que ainda roda.
 * Por isso o processador recebe a chave de idempotência, que é o id do job em toda execução.
 *
 * Reexecução no log: mais de um `job.iniciado` com o mesmo `jobId`; a `tentativa` sobe na retentativa e se
 * repete no stalled e na republicação. Só ids, nenhum dado do job.
 */
export class ExecutorDeJobs {
  readonly #intervaloRenovacaoMs: number
  readonly #definicoes: JobRegistry
  readonly #processadores: Readonly<Record<string, ProcessadorSemTipo | undefined>>
  readonly #emAndamento = new Set<TentativaEmAndamento>()

  constructor(private readonly dependencias: DependenciasDoExecutor) {
    this.#intervaloRenovacaoMs = dependencias.intervaloRenovacaoMs ?? INTERVALO_RENOVACAO_DA_VAGA_MS
    this.#definicoes = dependencias.definicoes ?? JOB_DEFINITIONS
    this.#processadores = dependencias.processadores
  }

  processar(job: JobDaFila, token?: string): Promise<void> {
    const { logger } = this.dependencias
    const dados = queuedJobDataSchema.safeParse(job.data)
    if (job.id === undefined || !dados.success) {
      logger.warn({ evento: 'job.dados_da_fila_invalidos', jobId: job.id })
      return Promise.reject(new UnrecoverableError(JobFailureCode.DADOS_INVALIDOS))
    }
    const jobId = job.id
    const contexto: RequestContext = {
      requisicaoId: dados.data.requisicaoId ?? randomUUID(),
      // Sem escola, o job só pode ser rotina do sistema, e o repository só alcança os jobs sem escola.
      ...(dados.data.escolaId === null ? { rotinaDoSistema: true } : { escolaId: dados.data.escolaId }),
    }
    return runInContext(contexto, () =>
      this.executar(job, jobId, token, contexto).catch((erro: unknown) => {
        if (erro instanceof UnrecoverableError || erro instanceof ErroParaAFila || erro instanceof DelayedError) throw erro
        // Banco fora ao marcar o estado: a tentativa conta, e a mensagem original não vai ao Redis.
        logger.warn({ evento: 'job.estado_nao_gravado', jobId, erro: summarizeError(erro) })
        throw new ErroParaAFila(JobFailureCode.ERRO_INTERNO)
      }),
    )
  }

  private async executar(job: JobDaFila, jobId: string, token: string | undefined, contexto: RequestContext): Promise<void> {
    const { repositorio, logger } = this.dependencias
    const alvo = await repositorio.localizarParaExecucao(jobId)
    if (alvo === undefined) {
      logger.warn({ evento: 'job.nao_encontrado', jobId })
      throw new UnrecoverableError(ErrorCode.NAO_ENCONTRADO)
    }
    if (alvo.finalizado) {
      logger.info({ evento: 'job.ja_finalizado', jobId })
      return
    }
    const vaga: VagaDoJob = { fila: alvo.fila, escolaId: alvo.escolaId, jobId }
    if (!(await this.tomarVaga(vaga))) {
      await this.esperarVaga(job, vaga, token)
      return
    }
    const inicio = await repositorio.iniciarExecucao(jobId)
    if (inicio.situacao !== 'iniciado') {
      // Terminou (ou sumiu) entre a localização e o início: a vaga que acabou de ser tomada não fica.
      await this.liberarVaga(vaga)
      if (inicio.situacao === 'nao_encontrado') {
        logger.warn({ evento: 'job.nao_encontrado', jobId })
        throw new UnrecoverableError(ErrorCode.NAO_ENCONTRADO)
      }
      logger.info({ evento: 'job.ja_finalizado', jobId })
      return
    }
    const tentativa = job.attemptsMade + 1
    // Cada tentativa que começa conta: é execução que ocupou worker e banco. Job do sistema não tem escola e não conta.
    this.dependencias.uso.marcar('jobs')
    logger.info({ evento: 'job.iniciado', jobId, tentativa })
    const renovacao = new RenovacaoDaVaga(() => this.renovarVaga(vaga), this.#intervaloRenovacaoMs)
    const emAndamento: TentativaEmAndamento = { vaga, contexto, controle: new AbortController(), ultimaTentativa: esgotouAsTentativas(job), interrompida: false }
    this.#emAndamento.add(emAndamento)
    try {
      try {
        // A tentativa deixa de ser interrompível assim que o processador termina: o `finally` roda antes de a continuação ver o desfecho,
        // então o `interromper` não acha uma tentativa que está em `concluir` ou em `falhar` e não grava uma segunda falha sobre o desfecho dela.
        await this.rodarProcessador(inicio.tipo, inicio.dados, vaga, { jobId, tentativa, chaveIdempotencia: jobId }, emAndamento.controle).finally(() => {
          this.#emAndamento.delete(emAndamento)
        })
      } catch (erro) {
        // O `interromper` já gravou a falha da última tentativa e liberou a vaga; com tentativa sobrando, o job fica `ativo` para outra réplica (D49).
        if (emAndamento.interrompida) throw new ErroParaAFila(JobFailureCode.EXECUCAO_INTERROMPIDA)
        const falha = await this.falhar(job, jobId, erro)
        // O estouro libera a vaga também quando a fila vai repetir: o processador que ignora o `sinal` não segura a escola.
        if (falha instanceof UnrecoverableError || erro instanceof TempoEsgotado) {
          await renovacao.parar()
          await this.liberarVaga(vaga)
        }
        throw falha
      }
      // Conclui antes de liberar: se o Postgres falhar aqui, o job volta a tentar ainda dono da vaga.
      await repositorio.concluir(jobId)
      await renovacao.parar()
      await this.liberarVaga(vaga)
    } finally {
      await renovacao.parar()
    }
    logger.info({ evento: 'job.concluido', jobId, tentativa })
  }

  /**
   * O que o worker confere antes do processador, nesta ordem: a definição do tipo (sem ela, `TIPO_DESCONHECIDO`), o escopo da
   * definição contra a escola da linha, os dados contra o esquema estrito do tipo e o processador da réplica. Toda recusa é
   * definitiva e leva só o código: o `issues` do zod repete chave e valor, e iria ao log e ao Redis. O worker não confia
   * na gravação: a linha pode ter sido escrita por SQL, por uma versão antiga ou por quem não passou pelo `JobOutbox`.
   *
   * O processador roda contra o `prazoMs` da definição: passado ele, o `controle` aborta o `sinal` e a tentativa falha com
   * `TEMPO_ESGOTADO`, sem esperar o processador. A rejeição que o processador der depois do corte é engolida.
   */
  private async rodarProcessador(
    tipo: string,
    dados: unknown,
    { escolaId }: VagaDoJob,
    execucao: Omit<ExecucaoDoJob, 'prazoMs'>,
    controle: AbortController,
  ): Promise<void> {
    const definicao = this.#definicoes[tipo]
    if (definicao === undefined) throw new FalhaDeJob(JobFailureCode.TIPO_DESCONHECIDO, true)
    // A rotina do sistema não tem escola, e o job de escola sempre tem: a linha com o outro arranjo (`sistema.*` com escola, por SQL) não roda.
    if ((definicao.escopo === 'sistema') !== (escolaId === null)) throw new FalhaDeJob(JobFailureCode.DADOS_INVALIDOS, true)
    const lidos = definicao.dados.safeParse(dados)
    if (!lidos.success) throw new FalhaDeJob(JobFailureCode.DADOS_INVALIDOS, true)
    const processador = this.#processadores[tipo]
    if (processador === undefined) throw new FalhaDeJob(JobFailureCode.TIPO_DESCONHECIDO, true)
    // O esquema lido é o do mesmo tipo da chave do processador: o `never` é a ponte que o compilador não faz (`ProcessadorSemTipo`).
    await this.comPrazo(() => processador(lidos.data as never, { ...execucao, prazoMs: definicao.prazoMs }, controle.signal), definicao.prazoMs, controle, execucao)
  }

  /**
   * Resolve ou rejeita como o processador, salvo se ele passar de `prazoMs`: aí aborta o `sinal` e rejeita com `TEMPO_ESGOTADO`
   * (não definitivo: segue a retentativa do tipo). O que o processador devolver depois do corte tem destino: a rejeição cai no
   * segundo argumento do `then` e não vira rejeição sem tratamento do processo. O log leva só ids e o prazo.
   */
  private comPrazo(processar: () => Promise<void>, prazoMs: number, controle: AbortController, { jobId, tentativa }: Omit<ExecucaoDoJob, 'prazoMs'>): Promise<void> {
    return new Promise<void>((resolver, rejeitar) => {
      const temporizador = setTimeout(() => {
        this.dependencias.logger.warn({ evento: 'job.tempo_esgotado', jobId, tentativa, prazoMs })
        controle.abort()
        rejeitar(new TempoEsgotado())
      }, prazoMs)
      // O executor da `Promise` captura o `throw` síncrono do processador; o `then` limpa o temporizador nos dois desfechos.
      new Promise<void>((iniciado) => iniciado(processar())).then(
        () => {
          clearTimeout(temporizador)
          resolver()
        },
        (erro: unknown) => {
          clearTimeout(temporizador)
          rejeitar(erro)
        },
      )
    })
  }

  /**
   * O worker foi desligado e a graça acabou com tentativas ainda rodando. Aborta o `sinal` de todas. Na última tentativa o job não
   * tem outra para repetir: termina `falhou` com `EXECUCAO_INTERROMPIDA`, gravado no contexto da escola dele, e a vaga é liberada.
   * Com tentativa sobrando, a linha segue `ativo` e outra réplica o retoma quando o lock vencer (D49): marcar todos perderia o
   * `titular.*` em cada deploy. Falha do Redis ou do banco aqui vira aviso e não trava o resto, mas `interromper` espera a gravação e a
   * liberação: é esse tempo que tem de caber entre a graça de 20 s e o `stop_grace_period` de 25 s.
   */
  async interromper(): Promise<void> {
    const rodando = [...this.#emAndamento]
    for (const tentativa of rodando) tentativa.interrompida = true
    for (const { controle } of rodando) controle.abort()
    await Promise.all(
      rodando
        .filter(({ ultimaTentativa }) => ultimaTentativa)
        .map(async ({ vaga, contexto }) => {
          await runInContext(contexto, () => this.gravarFalhaDefinitiva(vaga.jobId, JobFailureCode.EXECUCAO_INTERROMPIDA))
          await this.liberarVaga(vaga)
        }),
    )
  }

  /** Sem Redis, o job segue: com o Redis de fila fora, ele nem teria chegado aqui, e a vaga vence sozinha. */
  private async tomarVaga(vaga: VagaDoJob): Promise<boolean> {
    try {
      const limite = (await this.dependencias.vagasDaEscola.daEscola())[vaga.fila]
      return (await this.dependencias.vagas.tomar(vaga.fila, vaga.escolaId, limite, [vaga.jobId])).has(vaga.jobId)
    } catch (erro) {
      this.dependencias.logger.warn({ evento: 'job.vaga_nao_conferida', jobId: vaga.jobId, erro: summarizeError(erro) })
      return true
    }
  }

  /**
   * Devolve o job à espera do BullMQ por um instante, sem contar tentativa e sem marcar `ativo`: a
   * linha continua `publicado`, e o despachante segue renovando a vaga de quem a tem.
   */
  private async esperarVaga(job: JobDaFila, { fila, escolaId }: VagaDoJob, token: string | undefined): Promise<never> {
    if (token === undefined) throw new InvariantException('job sem token do BullMQ não pode voltar à espera')
    // Métrica, e não log: com a escola no teto, cada job volta aqui a cada segundo, e uma linha por volta
    // encheria o log sem dizer mais que a contagem por escola.
    this.dependencias.aoAguardarVaga?.(fila, escolaId)
    const esperaMs = ESPERA_POR_VAGA_MS + Math.floor(Math.random() * (ESPERA_POR_VAGA_MS / 2))
    await job.moveToDelayed(Date.now() + esperaMs, token)
    throw new DelayedError()
  }

  private async renovarVaga({ fila, escolaId, jobId }: VagaDoJob): Promise<void> {
    try {
      await this.dependencias.vagas.renovar(fila, escolaId, jobId)
    } catch (erro) {
      this.dependencias.logger.warn({ evento: 'job.vaga_nao_renovada', jobId, erro: summarizeError(erro) })
    }
  }

  private async liberarVaga({ fila, escolaId, jobId }: VagaDoJob): Promise<void> {
    try {
      await this.dependencias.vagas.liberar(fila, escolaId, [jobId])
      this.dependencias.aoLiberarVaga?.()
    } catch (erro) {
      this.dependencias.logger.warn({ evento: 'job.vaga_nao_liberada', jobId, erro: summarizeError(erro) })
    }
  }

  /**
   * Decide se a falha encerra o job e devolve o erro para o BullMQ. O erro devolvido nunca é o
   * original: a mensagem vai para o Redis, e só o código tipado pode ir.
   */
  private async falhar(job: JobDaFila, jobId: string, erro: unknown): Promise<Error> {
    const codigo = erro instanceof FalhaDeJob ? erro.codigo : JobFailureCode.ERRO_INTERNO
    const tentativa = job.attemptsMade + 1
    const definitiva = (erro instanceof FalhaDeJob && erro.definitiva) || esgotouAsTentativas(job)
    this.dependencias.logger.warn({ evento: 'job.tentativa_falhou', jobId, tentativa, codigo, erro: summarizeError(erro) })
    if (!definitiva) return new ErroParaAFila(codigo)
    await this.gravarFalhaDefinitiva(jobId, codigo)
    return new UnrecoverableError(codigo)
  }

  /** `falhou` na linha do job, no contexto de quem chama. Banco fora: o erro vai ao log e o job segue o caminho dele. */
  private async gravarFalhaDefinitiva(jobId: string, codigo: JobFailureCode): Promise<void> {
    try {
      // Só afirma a falha no log se a linha mudou: ela pode já ter terminado por outro caminho (a conclusão, o desligamento).
      if (await this.dependencias.repositorio.registrarFalha(jobId, codigo)) this.dependencias.logger.warn({ evento: 'job.falhou', jobId, codigo })
    } catch (erroAoRegistrar) {
      this.dependencias.logger.error({ evento: 'job.falha_nao_registrada', jobId, codigo, erro: summarizeError(erroAoRegistrar) })
    }
  }
}
