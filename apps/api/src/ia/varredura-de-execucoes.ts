import { runInContext, summarizeError, systemClock, type Clock, type Database, type LoggerBase } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { ExecucaoRepository } from './execucao.repository.js'

/** O `prazoMs` do job `ia.executar` (`JOB_DEFINITIONS`): a varredura espera o dobro antes de encerrar uma linha parada. */
const PRAZO_DO_JOB_MS = 150_000
/** Quantos prazos uma linha pode ficar parada antes de a varredura a encerrar. */
const PRAZOS_ATE_A_VARREDURA = 2
/** De quanto em quanto tempo o `main-worker` varre. */
export const INTERVALO_DA_VARREDURA_MS = 60_000

/**
 * A varredura do `main-worker` (X6, 5.0): encerra com `EXECUCAO_INTERROMPIDA` a execução `rodando` iniciada, e a `pendente` criada,
 * antes de `now() - 300 s` (2 × o `prazoMs` do job). **Como estava**: a 6.0 a refaz (a `pendente` sem job vivo, a linha estimada em
 * `consumo_ia`). Nunca lança: o banco fora é aviso no log, e a próxima volta tenta de novo.
 */
export class VarreduraDeExecucoes {
  #temporizador: NodeJS.Timeout | undefined

  constructor(
    private readonly banco: Database,
    private readonly logger: LoggerBase,
    private readonly relogio: Clock = systemClock,
  ) {}

  /** Varre uma vez na subida e repete a cada `INTERVALO_DA_VARREDURA_MS`. */
  iniciar(intervaloMs: number = INTERVALO_DA_VARREDURA_MS): void {
    void this.varrer()
    this.#temporizador = setInterval(() => void this.varrer(), intervaloMs)
    this.#temporizador.unref()
  }

  encerrar(): void {
    clearInterval(this.#temporizador)
    this.#temporizador = undefined
  }

  async varrer(): Promise<number> {
    const antesDe = new Date(this.relogio.agora().getTime() - PRAZOS_ATE_A_VARREDURA * PRAZO_DO_JOB_MS)
    try {
      // Rotina nossa, entre escolas: o contexto não tem escola, e o repository a varre com o `@Unscoped` dele.
      const total = await runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => new ExecucaoRepository(this.banco).falharInterrompidas(antesDe))
      if (total > 0) this.logger.warn({ evento: 'ia.execucao.interrompidas_encerradas', total })
      return total
    } catch (erro) {
      this.logger.warn({ evento: 'ia.execucao.varredura_falhou', erro: summarizeError(erro) })
      return 0
    }
  }
}
