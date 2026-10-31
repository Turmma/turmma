import {
  runInContext,
  summarizeError,
  type SweepCursor,
  type DispatchRepository,
  type JobToSweep,
} from '@educa/core'
import type { JobFailureCode } from '@educa/shared'
import { contextoDoJob, publicarComVaga, type DependenciasDaPublicacao } from './outbox-relay.js'
import type { FilaDePublicacao } from './job-publisher.js'

/** A reconciliação roda a cada minuto (Tech Spec, seção 5, "Reconciliação"). */
export const INTERVALO_RECONCILIACAO_MS = 60_000
/** Quantos jobs cada página da varredura confere. As consultas da página saem juntas, com o prazo da fila. */
export const LOTE_DE_RECONCILIACAO = 100
/**
 * Quanto uma reconciliação varre antes de ceder a vez à próxima, que continua do mesmo ponto. Menor
 * que o intervalo: com dezenas de milhares de jobs ativos (uma rede inteira corrigindo), a varredura
 * leva mais de uma rodada, mas passa por todos.
 */
export const DURACAO_MAXIMA_RECONCILIACAO_MS = 30_000

export interface DependenciasDaReconciliacao extends DependenciasDaPublicacao {
  repositorio: DispatchRepository
  fila: FilaDePublicacao
}

export interface OpcoesDaReconciliacao {
  intervaloMs?: number
  lote?: number
}

export interface ResultadoDaReconciliacao {
  conferidos: number
  republicados: string[]
  falhasRegistradas: string[]
  /** Consultas que deram erro ou passaram do prazo: esses jobs ficam como estão até a próxima. */
  semConfirmacao: number
}

/**
 * Confere, a cada minuto, os jobs `publicado` ou `ativo` há mais de 2 min contra o que o BullMQ tem:
 *
 * - a fila **confirma** que não tem o job (o Redis perdeu o que o AOF não gravou): ele é tomado de
 *   volta com a mesma troca condicional da reserva e publicado de novo com o mesmo `jobId`, pelo
 *   mesmo caminho da vaga da rodada (sem vaga, volta a `aguardando`);
 * - a fila tem o job como falho, e a linha não sabe (o worker não gravou a falha): a linha passa a
 *   `falhou`, com o código que o worker mandou à fila, e a vaga do job é liberada;
 * - erro ou prazo na consulta: nada muda. Na dúvida, republicar poderia executar o job duas vezes.
 *
 * A varredura vai por páginas, do interativo ao lote, e guarda onde parou: um job perdido não fica
 * atrás dos mesmos cem lotes longos a cada minuto. O ponto de parada é só desta instância; perdê-lo
 * num reinício só recomeça a volta. Duas instâncias reconciliando juntas não publicam o mesmo job
 * duas vezes: só uma consegue tomá-lo.
 */
export class Reconciliacao {
  readonly #intervaloMs: number
  readonly #lote: number
  #ativa = false
  #laco: Promise<void> | undefined
  #encerrarEspera: (() => void) | undefined
  #cursor: SweepCursor | undefined
  /** No SIGTERM, a varredura em andamento termina a página e cede: o prazo do contêiner é curto. */
  #parando = false

  constructor(
    private readonly dependencias: DependenciasDaReconciliacao,
    opcoes: OpcoesDaReconciliacao = {},
  ) {
    this.#intervaloMs = opcoes.intervaloMs ?? INTERVALO_RECONCILIACAO_MS
    this.#lote = opcoes.lote ?? LOTE_DE_RECONCILIACAO
  }

  iniciar(): void {
    if (this.#ativa) return
    this.#ativa = true
    this.#laco = this.lacar()
  }

  /** Termina a reconciliação em andamento e para. */
  async parar(): Promise<void> {
    this.#ativa = false
    this.#parando = true
    this.#encerrarEspera?.()
    await this.#laco
  }

  /**
   * Varre do ponto em que a anterior parou até o fim, ou até `DURACAO_MAXIMA_RECONCILIACAO_MS`. Uma
   * página em que nenhuma consulta respondeu encerra a varredura, sem avançar: a fila não está
   * respondendo, e a próxima reconciliação confere a mesma página de novo. Se só parte dela ficou
   * sem resposta (um job que a fila não consegue ler), a varredura segue, e esses jobs voltam na
   * próxima volta: um job problemático não prende a varredura na mesma página.
   */
  async reconciliar(): Promise<ResultadoDaReconciliacao> {
    const resultado: ResultadoDaReconciliacao = { conferidos: 0, republicados: [], falhasRegistradas: [], semConfirmacao: 0 }
    const inicio = performance.now()
    do {
      const pagina = await this.dependencias.repositorio.listarParaReconciliar(this.#lote, this.#cursor)
      const semConfirmacao = await this.reconciliarPagina(pagina, resultado)
      if (pagina.length > 0 && semConfirmacao === pagina.length) break
      const ultimo = pagina.at(-1)
      this.#cursor = pagina.length < this.#lote || ultimo === undefined ? undefined : { prioridade: ultimo.prioridade, criadoEm: ultimo.criadoEm, id: ultimo.id }
    } while (this.#cursor !== undefined && !this.#parando && performance.now() - inicio < DURACAO_MAXIMA_RECONCILIACAO_MS)
    return resultado
  }

  /** Confere uma página e soma ao resultado. Devolve quantas consultas ficaram sem resposta. */
  private async reconciliarPagina(pagina: readonly JobToSweep[], resultado: ResultadoDaReconciliacao): Promise<number> {
    const { repositorio, fila, vagas, logger } = this.dependencias
    const consultas = await Promise.allSettled(pagina.map((job) => fila.consultar(job)))

    const inexistentes: string[] = []
    const falhos: Array<{ job: JobToSweep; codigo: JobFailureCode }> = []
    consultas.forEach((consulta, indice) => {
      const job = pagina[indice]
      if (job === undefined || consulta.status === 'rejected') return
      if (consulta.value.situacao === 'inexistente') inexistentes.push(job.id)
      else if (consulta.value.situacao === 'falhou') falhos.push({ job, codigo: consulta.value.codigo })
    })
    const recusadas = consultas.filter((consulta): consulta is PromiseRejectedResult => consulta.status === 'rejected')
    const [primeiraRecusada] = recusadas
    if (primeiraRecusada !== undefined) {
      const quantidade = recusadas.length
      logger.warn({ evento: 'reconciliacao.consulta_falhou', quantidade, erro: summarizeError(primeiraRecusada.reason) })
    }

    for (const { job, codigo } of falhos) {
      if (!(await repositorio.registrarFalhaDaFila(job.id, codigo))) continue
      resultado.falhasRegistradas.push(job.id)
      runInContext(contextoDoJob(job), () => logger.warn({ evento: 'job.falha_reconciliada', jobId: job.id, codigo }))
      // O worker que não gravou a falha também não liberou a vaga; sem isto, ela só venceria em 60 s.
      await vagas.liberar(job.fila, job.escolaId, [job.id]).catch((erro: unknown) =>
        logger.warn({ evento: 'reconciliacao.vaga_nao_liberada', jobId: job.id, erro: summarizeError(erro) }),
      )
    }

    const tomados = await repositorio.reservarParaRepublicar(inexistentes)
    resultado.republicados.push(...(await publicarComVaga(this.dependencias, tomados, 'job.republicado')))
    resultado.conferidos += pagina.length
    resultado.semConfirmacao += recusadas.length
    return recusadas.length
  }

  private async lacar(): Promise<void> {
    while (this.#ativa) {
      await this.esperar()
      if (!this.#ativa) return
      try {
        await this.reconciliar()
      } catch (erro) {
        // Banco fora: a próxima reconciliação tenta de novo, do mesmo ponto. Nunca derruba o processo.
        this.dependencias.logger.warn({ evento: 'reconciliacao.falhou', erro: summarizeError(erro) })
      }
    }
  }

  private esperar(): Promise<void> {
    return new Promise((resolver) => {
      const encerrar = (): void => {
        clearTimeout(prazo)
        this.#encerrarEspera = undefined
        resolver()
      }
      const prazo = setTimeout(encerrar, this.#intervaloMs)
      this.#encerrarEspera = encerrar
    })
  }
}
