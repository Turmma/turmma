import { throttledWarn, runInContext, summarizeError, ROTULO_ESCOLA, type CronEscolasRepository, type LoggerBase, type Meter, type Clock } from '@educa/core'
import { randomUUID } from 'node:crypto'

/** De quanto em quanto tempo o worker-lote mede uma série por escola. Os valores mudam devagar (uma vez por noite, ou por hora): 5 min sobram. */
export const ESCOLA_GAUGE_INTERVAL_MS = 5 * 60_000

export interface EscolaGaugeDependencies {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/** O que identifica a série: o nome da métrica, o texto do gauge e o evento do aviso quando o Postgres não responde. */
export interface EscolaGaugeDescription {
  readonly metrica: string
  readonly descricao: string
  readonly evento: string
}

/**
 * Uma métrica por escola, medida pelo worker-lote num laço próprio (F3, tarefas 3.0 e 9.0; Tech Spec do F3, seção 7c): a cada 5 min,
 * mede todas as escolas, e a exportação só lê o resultado guardado (como a medição da fila no despachante). A medição não guarda
 * estado que outra réplica precise: cada worker-lote mede do Postgres, e o painel usa `max`. A lista de escolas sai da
 * `CronEscolasRepository`, a mesma da rotina, e cada escola é lida no contexto dela. Quem herda diz só **o que medir numa
 * escola** (`medirEscola`); a escola que devolve `undefined` não tem série. Com o Postgres fora, a medição anterior sai da exportação.
 */
export abstract class EscolaGauge {
  readonly #series = new Map<string, number>()
  readonly #intervaloMs: number
  readonly #avisarFalha: (erro: unknown) => void
  #laco: Promise<void> | undefined
  #ativa = false
  #encerrada = false
  #acordar: (() => void) | undefined

  protected constructor(
    private readonly base: EscolaGaugeDependencies,
    descricao: EscolaGaugeDescription,
    opcoes: { intervaloMs?: number } = {},
  ) {
    this.#intervaloMs = opcoes.intervaloMs ?? ESCOLA_GAUGE_INTERVAL_MS
    let ultimoErro: unknown
    const aviso = throttledWarn(() => base.logger.warn({ evento: descricao.evento, erro: summarizeError(ultimoErro) }))
    this.#avisarFalha = (erro) => {
      ultimoErro = erro
      aviso()
    }
    const gauge = base.medidor.createObservableGauge(descricao.metrica, { description: descricao.descricao })
    gauge.addCallback((observador) => {
      for (const [escolaId, valor] of this.#series) observador.observe(valor, { [ROTULO_ESCOLA]: escolaId })
    })
  }

  /** O valor da série da escola do contexto, ou `undefined` se ela não tem série. `agora` é o mesmo para a volta inteira. */
  protected abstract medirEscola(agora: Date): Promise<number | undefined>

  /**
   * Uma medição de todas as escolas. A escola que falha fica sem série nesta volta; a lista que falha zera a exportação.
   * Depois de `encerrar`, a volta em andamento para na escola seguinte, sem trocar as séries.
   */
  async medir(): Promise<void> {
    const { escolas, relogio } = this.base
    let ids: string[]
    try {
      ids = await escolas.listarIds()
    } catch (erro) {
      this.#series.clear()
      this.#avisarFalha(erro)
      return
    }
    const agora = relogio.agora()
    const medidas = new Map<string, number>()
    for (const escolaId of ids) {
      // O desligamento não espera a volta inteira: com milhares de escolas, ela leva segundos.
      if (this.#encerrada) return
      try {
        const valor = await runInContext({ requisicaoId: randomUUID(), escolaId }, () => this.medirEscola(agora))
        if (valor !== undefined) medidas.set(escolaId, valor)
      } catch (erro) {
        this.#avisarFalha(erro)
      }
    }
    this.#series.clear()
    for (const [escolaId, valor] of medidas) this.#series.set(escolaId, valor)
  }

  /** Mede agora e, depois, a cada intervalo, até `encerrar`. */
  iniciar(): void {
    if (this.#ativa) return
    this.#ativa = true
    this.#laco = (async () => {
      while (this.#ativa) {
        await this.medir()
        if (!this.#ativa) break
        await new Promise<void>((acordar) => {
          const prazo = setTimeout(acordar, this.#intervaloMs)
          this.#acordar = () => {
            clearTimeout(prazo)
            acordar()
          }
        })
      }
    })()
  }

  /** Para o laço e espera a medição em andamento terminar. */
  async encerrar(): Promise<void> {
    this.#ativa = false
    this.#encerrada = true
    this.#acordar?.()
    await this.#laco
  }
}
