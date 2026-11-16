// O prazo único da execução de IA (reengenharia-continuacao, 5.0). Fica fora do `execucao.processor.ts` para o teste do temporizador importá-lo sem montar o processador (`tools/guardas/executor-so-na-bancada.ts`).

/** O prazo único da execução: o sinal que aborta quando ele estoura, e como cancelar o temporizador. Só o teste troca a fábrica (`ExecucaoProcessorDependencies.prazo`). */
export interface PrazoDaExecucao {
  readonly sinal: AbortSignal
  cancelar(): void
}

export type FabricaDePrazo = (prazoMs: number) => PrazoDaExecucao

/** O prazo de verdade: um `setTimeout` que aborta o sinal. Não é `AbortSignal.timeout`, que o relógio falso do teste não alcança. */
export const prazoPorTemporizador: FabricaDePrazo = (prazoMs) => {
  const controle = new AbortController()
  const temporizador = setTimeout(() => controle.abort(), prazoMs)
  temporizador.unref()
  return { sinal: controle.signal, cancelar: () => clearTimeout(temporizador) }
}
