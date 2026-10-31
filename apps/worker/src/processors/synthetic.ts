import type { SyntheticEffectRepository } from '@educa/core'
import { JobFailureCode, InvariantException, type TIPO_JOB_SINTETICO } from '@educa/shared'
import { Worker } from 'node:worker_threads'
import type { Processador } from '../job-executor.js'
import { FalhaDeJob } from '../job-failure.error.js'

/**
 * O arquivo da thread: o `.js` compilado no container e o próprio `.ts` no teste, que o Node carrega sem build.
 * Nunca o BullMQ `useWorkerThreads`: ele poria o executor inteiro (estado no banco, vaga) dentro da thread, e
 * não tem teto de threads além da concorrência do pool.
 */
export const ARQUIVO_DO_SANDBOX = new URL(import.meta.url.endsWith('.ts') ? './synthetic.sandbox.ts' : './synthetic.sandbox.js', import.meta.url)

/** Memória de cada thread do sandbox. Ela só gira um laço: o teto impede uma thread de pesar no container. */
const MEMORIA_DA_THREAD_MB = 16

export interface QueimaDeCpu {
  /** Com `sinal`, o aborto tira o pedido da fila ou termina a thread que o roda, e rejeita com `EXECUCAO_INTERROMPIDA`. */
  queimar(cpuMs: number, sinal?: AbortSignal): Promise<void>
}

interface Pedido {
  cpuMs: number
  resolver: () => void
  rejeitar: (erro: FalhaDeJob) => void
}

/**
 * Sandbox de CPU do job sintético (15.0): no máximo `threadsMaximo` threads queimando CPU ao mesmo tempo, e o
 * resto na fila, por ordem de chegada. As threads nascem sob demanda e ficam para o pedido seguinte.
 *
 * É o que deixa o cenário de carga medir justiça entre escolas sem depender da máquina: o trabalho de CPU sai
 * do event loop (o lock de 10 s da fila interativa segue sendo renovado), e o teto casa com o `cpus:` fixo do
 * container em `infra/compose.carga.yml`, então o lote de uma réplica não disputa CPU além da dela.
 *
 * Thread que morre no meio (erro, memória) falha o job com `ERRO_INTERNO`, que vai para nova tentativa, e dá
 * lugar a outra. `encerrar` termina as threads e falha o que ainda esperava.
 */
export class SandboxDeCpu implements QueimaDeCpu {
  readonly #ociosas: Worker[] = []
  readonly #ocupadas = new Map<Worker, Pedido>()
  readonly #fila: Pedido[] = []
  #encerrado = false

  constructor(
    private readonly threadsMaximo: number,
    private readonly arquivo: URL = ARQUIVO_DO_SANDBOX,
  ) {
    if (!Number.isInteger(threadsMaximo) || threadsMaximo < 1) throw new InvariantException('o sandbox de CPU precisa de pelo menos uma thread')
  }

  /** Threads existentes agora, ociosas ou não. Nunca passa de `threadsMaximo`, salvo a que o aborto de um job está terminando. */
  get threads(): number {
    return this.#ociosas.length + this.#ocupadas.size
  }

  queimar(cpuMs: number, sinal?: AbortSignal): Promise<void> {
    if (this.#encerrado) return Promise.reject(new FalhaDeJob(JobFailureCode.ERRO_INTERNO))
    if (sinal?.aborted === true) return Promise.reject(new FalhaDeJob(JobFailureCode.EXECUCAO_INTERROMPIDA))
    if (cpuMs === 0) return Promise.resolve()
    return new Promise((resolver, rejeitar) => {
      const pedido: Pedido = { cpuMs, resolver, rejeitar }
      // O sinal é o de uma tentativa e some com ela; abortar um pedido que já terminou não acha fila nem thread, e rejeitar de novo não faz nada.
      sinal?.addEventListener('abort', () => this.#abortar(pedido), { once: true })
      this.#fila.push(pedido)
      this.#distribuir()
    })
  }

  /** Termina as threads e falha o que estava esperando ou em andamento. Depois disso, todo pedido falha. */
  async encerrar(): Promise<void> {
    this.#encerrado = true
    for (const pedido of this.#fila.splice(0)) pedido.rejeitar(new FalhaDeJob(JobFailureCode.ERRO_INTERNO))
    const threads = [...this.#ociosas.splice(0), ...this.#ocupadas.keys()]
    for (const pedido of this.#ocupadas.values()) pedido.rejeitar(new FalhaDeJob(JobFailureCode.ERRO_INTERNO))
    this.#ocupadas.clear()
    await Promise.all(threads.map((thread) => thread.terminate()))
  }

  /**
   * O sinal do job abortou: o pedido que esperava na fila sai dela, e o que queimava perde a thread, que é terminada (um laço de
   * CPU não escuta mensagem). A thread sai de `#ocupadas` na hora: nada que ela ainda mande vale, e o `exit` dela não acha pedido
   * (é ele que redistribui a fila).
   */
  #abortar(pedido: Pedido): void {
    const naFila = this.#fila.indexOf(pedido)
    if (naFila >= 0) this.#fila.splice(naFila, 1)
    else {
      for (const [thread, ocupante] of this.#ocupadas) {
        if (ocupante !== pedido) continue
        this.#ocupadas.delete(thread)
        void thread.terminate()
      }
    }
    pedido.rejeitar(new FalhaDeJob(JobFailureCode.EXECUCAO_INTERROMPIDA))
  }

  #distribuir(): void {
    while (this.#fila.length > 0) {
      const thread = this.#ociosas.pop() ?? (this.threads < this.threadsMaximo ? this.#criarThread() : undefined)
      if (thread === undefined) return
      const pedido = this.#fila.shift()
      if (pedido === undefined) {
        this.#ociosas.push(thread)
        return
      }
      this.#ocupadas.set(thread, pedido)
      thread.postMessage({ cpuMs: pedido.cpuMs })
    }
  }

  #criarThread(): Worker {
    const thread = new Worker(this.arquivo, { resourceLimits: { maxOldGenerationSizeMb: MEMORIA_DA_THREAD_MB } })
    // Ociosa, a thread não segura o processo: quem o mantém vivo é o worker do BullMQ.
    thread.unref()
    thread.on('message', (resposta: unknown) => {
      const pedido = this.#ocupadas.get(thread)
      if (pedido === undefined) return
      this.#ocupadas.delete(thread)
      if (resposta === 'pronto') pedido.resolver()
      else pedido.rejeitar(new FalhaDeJob(JobFailureCode.DADOS_INVALIDOS, true))
      if (this.#encerrado) return
      this.#ociosas.push(thread)
      this.#distribuir()
    })
    const perder = (): void => {
      const pedido = this.#ocupadas.get(thread)
      this.#ocupadas.delete(thread)
      const ociosa = this.#ociosas.indexOf(thread)
      if (ociosa >= 0) this.#ociosas.splice(ociosa, 1)
      pedido?.rejeitar(new FalhaDeJob(JobFailureCode.ERRO_INTERNO))
      if (!this.#encerrado) this.#distribuir()
    }
    // A mensagem do erro da thread não sai daqui: o código tipado basta, e ela nunca carrega dado de job.
    thread.on('error', perder)
    thread.on('exit', perder)
    return thread
  }
}

/**
 * Job sintético, para teste e carga: queima `cpuMs` de CPU no sandbox, fora do event loop; com `efeito`, grava
 * o efeito com a chave de idempotência da execução; e falha, se pedido, depois de tudo isso.
 * Com `cpuMs` zero, nem chega a uma thread.
 *
 * O modo `efeito` é o exemplo de referência da entrega pelo menos uma vez (D49): o efeito leva a chave, que é a
 * mesma em toda reexecução, e a gravação com a mesma chave não duplica. Falhar depois de gravar é o caso que
 * a retentativa precisa aguentar.
 */
export function criarProcessadorSintetico(cpu: QueimaDeCpu, efeitos: Pick<SyntheticEffectRepository, 'gravar'>): Processador<typeof TIPO_JOB_SINTETICO> {
  return async ({ cpuMs, efeito, falhar }, { tentativa, chaveIdempotencia }, sinal) => {
    await cpu.queimar(cpuMs, sinal)
    if (efeito === true) await efeitos.gravar({ chaveIdempotencia, tentativa })
    if (falhar) throw new FalhaDeJob(JobFailureCode.FALHA_SINTETICA)
  }
}
