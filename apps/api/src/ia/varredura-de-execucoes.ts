import { runInContext, summarizeError, type Database, type DestinoDoAdaptador, type LoggerBase, type Meter } from '@educa/core'
import { JOB_DEFINITIONS, TIPO_EXECUTAR_IA } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { ConsumoRepository } from './consumo.repository.js'
import { ExecucaoRepository } from './execucao.repository.js'
import { MetricasDaExecucao } from './metricas-da-execucao.js'

/** De quanto em quanto tempo o `main-worker` varre. */
export const INTERVALO_DA_VARREDURA_MS = 60_000
/** Quantos prazos do job uma execução pode ficar `rodando` antes de a varredura a encerrar (2 × `prazoMs`: a reentrega, ~15 s, vem muito antes). */
export const PRAZOS_ATE_A_VARREDURA = 2
/** Há quanto tempo, em segundos, uma execução `rodando` é dada como interrompida: 2 × o `prazoMs` do `ia.executar` (300 s). */
export const LIMITE_DA_RODANDO_SEGUNDOS = (PRAZOS_ATE_A_VARREDURA * JOB_DEFINITIONS[TIPO_EXECUTAR_IA].prazoMs) / 1000

/**
 * A conta do laço (Tech Spec §7c, "Laços e ritmo"): cada passo encerra até `LOTE_DA_VARREDURA` execuções numa transação com `statement_timeout` de
 * `PRAZO_DO_PASSO_MS`; cada tipo (a `rodando`, com a linha estimada, e a `pendente`) faz no máximo `PASSADAS_MAXIMAS` passos. O pior caso, **2 × 5 × 5 s = 50 s**, cabe nos 60 s do
 * intervalo: a varredura nunca começa uma segunda volta por cima da primeira, e o que sobrar de um acúmulo grande fica para a volta seguinte.
 */
export const LOTE_DA_VARREDURA = 200
export const PASSADAS_MAXIMAS = 5
export const PRAZO_DO_PASSO_MS = 5_000
export const TIPOS_VARRIDOS = 2
export const PIOR_CASO_DA_VARREDURA_MS = TIPOS_VARRIDOS * PASSADAS_MAXIMAS * PRAZO_DO_PASSO_MS

/**
 * A varredura do `main-worker` (X6, 6.0), a cada 60 s: encerra com `EXECUCAO_INTERROMPIDA` (1) a execução `rodando` iniciada antes de `now() - 300 s`, **gravando a linha
 * estimada em `consumo_ia` na mesma transação** (D14: o custo a mais, nunca a menos), e (2) a `pendente` **sem job vivo** (não finalizado, da mesma escola, nas filas da IA), sem
 * linha: o modelo nunca foi chamado. A idade é a do banco, e o `update` confere o estado: duas réplicas varrendo ao mesmo tempo encerram cada execução uma vez só, com uma linha.
 *
 * Nunca lança: o banco fora é aviso no log, e a próxima volta tenta de novo. A gravação da linha que falha desfaz o encerramento daquele lote. O laço **para no sinal** (o desligamento
 * do worker) e não se sobrepõe: com uma volta em andamento, o relógio a pula.
 */
export class VarreduraDeExecucoes {
  #temporizador: NodeJS.Timeout | undefined
  #parar = new AbortController()
  #emCurso = false
  readonly #metricas: MetricasDaExecucao

  constructor(
    private readonly banco: Database,
    private readonly logger: LoggerBase,
    private readonly destino: DestinoDoAdaptador,
    medidor: Meter,
  ) {
    this.#metricas = new MetricasDaExecucao(medidor)
  }

  /** Varre uma vez na subida e repete a cada `INTERVALO_DA_VARREDURA_MS`. */
  iniciar(intervaloMs: number = INTERVALO_DA_VARREDURA_MS): void {
    this.#parar = new AbortController()
    void this.varrer()
    this.#temporizador = setInterval(() => void this.varrer(), intervaloMs)
    this.#temporizador.unref()
  }

  /** Para o relógio e o laço em andamento: ele não começa outro passo. */
  encerrar(): void {
    clearInterval(this.#temporizador)
    this.#temporizador = undefined
    this.#parar.abort()
  }

  async varrer(): Promise<number> {
    if (this.#emCurso) return 0
    this.#emCurso = true
    try {
      // Rotina nossa, entre escolas: o contexto não tem escola, e o repository a varre com o `@Unscoped` dele.
      const { rodandoTotal, pendentesTotal } = await runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, async () => ({
        rodandoTotal: await this.#emPassos(() => this.#encerrarRodandas()),
        pendentesTotal: await this.#emPassos(() => this.#encerrarPendentes()),
      }))
      const total = rodandoTotal + pendentesTotal
      if (total > 0) this.logger.warn({ evento: 'ia.execucao.interrompidas_encerradas', total, rodandoTotal, pendentesTotal })
      return total
    } catch (erro) {
      this.logger.warn({ evento: 'ia.execucao.varredura_falhou', erro: summarizeError(erro) })
      return 0
    } finally {
      this.#emCurso = false
    }
  }

  /** Repete o passo enquanto ele enche o lote, até `PASSADAS_MAXIMAS` e até o sinal de parar. */
  async #emPassos(passo: () => Promise<number>): Promise<number> {
    let total = 0
    for (let passada = 0; passada < PASSADAS_MAXIMAS && !this.#parar.signal.aborted; passada += 1) {
      const encerradas = await passo()
      total += encerradas
      if (encerradas < LOTE_DA_VARREDURA) break
    }
    return total
  }

  /**
   * O encerramento e as linhas estimadas, numa transação só: a que falha desfaz o lote, e a linha segue `rodando` para a volta seguinte. `ia.execucao.interrompida` soma **depois** de a
   * transação confirmar, uma vez por execução encerrada e na escola dela: o lote desfeito não conta.
   */
  async #encerrarRodandas(): Promise<number> {
    const encerradas = await this.banco.transaction(async (tx) => {
      await tx.execute(sql.raw(`set local statement_timeout = ${PRAZO_DO_PASSO_MS}`))
      const encerradas = await new ExecucaoRepository(tx).encerrarRodandasVelhas(LIMITE_DA_RODANDO_SEGUNDOS, LOTE_DA_VARREDURA)
      const consumo = new ConsumoRepository(tx)
      for (const encerrada of encerradas) await consumo.registrarEstimada(encerrada, this.destino)
      return encerradas
    })
    for (const encerrada of encerradas) this.#metricas.interrompida(encerrada.escolaId, 'varredura')
    return encerradas.length
  }

  #encerrarPendentes(): Promise<number> {
    return this.banco.transaction(async (tx) => {
      await tx.execute(sql.raw(`set local statement_timeout = ${PRAZO_DO_PASSO_MS}`))
      return new ExecucaoRepository(tx).encerrarPendentesSemJob(LOTE_DA_VARREDURA)
    })
  }
}
