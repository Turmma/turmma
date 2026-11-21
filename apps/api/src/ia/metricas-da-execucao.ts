import { METRICS, ROTULO_ESCOLA, type Meter } from '@educa/core'

type MetricCounter = ReturnType<Meter['createCounter']>
type MetricHistogram = ReturnType<Meter['createHistogram']>

/** Por que o job do lote esperou sem falhar: o horário letivo da escola, o provedor de IA ou o teto de segurança do orçamento (camada-ia, 4.0). */
export type MotivoDoLoteAdiado = 'janela' | 'provedor' | 'orcamento'

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
  readonly #esperaDaClassificacao: MetricHistogram
  readonly #habilidadeAnulada: MetricCounter
  readonly #loteAdiado: MetricCounter

  constructor(medidor: Meter) {
    this.#esperaEstourada = medidor.createCounter(METRICS.esperaEstourada, { description: 'Perguntas do Tutor cortadas por esperar mais de 20 s na fila, por escola' })
    this.#interrompida = medidor.createCounter(METRICS.execucaoInterrompida, { description: 'Execuções de IA encerradas como interrompidas, por escola e origem' })
    this.#esperaDaClassificacao = medidor.createHistogram(METRICS.esperaDaClassificacao, { unit: 's', description: 'Do envio do material à classificação de cada seção, por escola' })
    this.#habilidadeAnulada = medidor.createCounter(METRICS.habilidadeAnulada, { description: 'Habilidades da BNCC anuladas na gravação da geração por não serem da seção da página citada, por escola' })
    this.#loteAdiado = medidor.createCounter(METRICS.loteAdiado, { description: 'Jobs do lote de IA adiados sem falhar, por motivo' })
  }

  /** O job do lote foi adiado, sem gastar tentativa, pelo `motivo` (`janela`, `provedor` ou `orcamento`). Só o motivo no rótulo: nunca a escola, a execução nem o valor do orçamento. */
  loteAdiado(motivo: MotivoDoLoteAdiado): void {
    this.#loteAdiado.add(1, { motivo })
  }

  /** O corte da espera de 20 s devolveu a linha. */
  esperaEstourada(escolaId: string): void {
    this.#esperaEstourada.add(1, { [ROTULO_ESCOLA]: escolaId })
  }

  /** Uma seção foi classificada: quanto o material esperou desde o envio, em segundos. Só a escola no rótulo. */
  esperaDaClassificacao(escolaId: string, segundos: number): void {
    this.#esperaDaClassificacao.record(segundos, { [ROTULO_ESCOLA]: escolaId })
  }

  /** A geração anulou `quantas` habilidades (a da questão que não é da seção da página citada, ou o código do plano que não é de seção citada). Só a escola no rótulo. */
  habilidadeAnulada(escolaId: string, quantas: number): void {
    this.#habilidadeAnulada.add(quantas, { [ROTULO_ESCOLA]: escolaId })
  }

  /** A execução `rodando` foi encerrada como `EXECUCAO_INTERROMPIDA` (a que deixa a linha estimada em `consumo_ia`). */
  interrompida(escolaId: string, origem: OrigemDaInterrupcao): void {
    this.#interrompida.add(1, { [ROTULO_ESCOLA]: escolaId, origem })
  }
}
