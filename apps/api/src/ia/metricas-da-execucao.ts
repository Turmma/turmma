import { METRICS, ROTULO_ESCOLA, type Meter } from '@educa/core'

type MetricCounter = ReturnType<Meter['createCounter']>

/** De onde veio o encerramento da execução `rodando`: o job que chegou de novo, ou a varredura de 60 s. */
export type OrigemDaInterrupcao = 'reentrega' | 'varredura'

/**
 * As duas contagens da execução de IA (reengenharia-continuacao, 7.0): a pergunta do Tutor cortada por esperar mais de 20 s e a execução `rodando` encerrada como interrompida. Só a escola (e a
 * origem, na segunda) no rótulo, como contagem: nunca o aluno, a execução nem o texto (regra 20, item 9; D76). Quem chama conta **depois** de o `update` condicional devolver a linha, e por isso
 * cada corte e cada encerramento soma uma vez só, mesmo com o processador, o `GET` e a varredura disputando a mesma execução.
 */
export class MetricasDaExecucao {
  readonly #esperaEstourada: MetricCounter
  readonly #interrompida: MetricCounter

  constructor(medidor: Meter) {
    this.#esperaEstourada = medidor.createCounter(METRICS.esperaEstourada, { description: 'Perguntas do Tutor cortadas por esperar mais de 20 s na fila, por escola' })
    this.#interrompida = medidor.createCounter(METRICS.execucaoInterrompida, { description: 'Execuções de IA encerradas como interrompidas, por escola e origem' })
  }

  /** O corte da espera de 20 s devolveu a linha. */
  esperaEstourada(escolaId: string): void {
    this.#esperaEstourada.add(1, { [ROTULO_ESCOLA]: escolaId })
  }

  /** A execução `rodando` foi encerrada como `EXECUCAO_INTERROMPIDA` (a que deixa a linha estimada em `consumo_ia`). */
  interrompida(escolaId: string, origem: OrigemDaInterrupcao): void {
    this.#interrompida.add(1, { [ROTULO_ESCOLA]: escolaId, origem })
  }
}
