import { LIMITES_DO_HISTOGRAMA_HTTP_S, METRICS, ROTULO_ESCOLA, type Meter } from '@educa/core'

/**
 * `tutor.trava.duracao{escola_id}` (avaliacao-e-correcao, 7.0; regra 80, item 10): a conferência que diz se o Tutor está travado para o aluno roda três
 * vezes por turno (o `POST`, o `preparar` e o `concluir`), e a duração da rota inteira não a separa nem alcança as duas últimas, que rodam no worker. Mede
 * com qualquer desfecho, inclusive o erro. O único rótulo é a escola: nunca o aluno, a turma nem a prova (regra 20, item 9).
 *
 * O instrumento é pedido ao medidor a cada conferência: o SDK devolve o mesmo armazenamento para o mesmo nome, e o repository do Tutor nasce por requisição, sem um lugar
 * onde guardá-lo.
 */
export async function medirATrava<T>(medidor: Meter, escolaId: string, conferir: () => Promise<T>): Promise<T> {
  const histograma = medidor.createHistogram(METRICS.duracaoDaTravaDoTutor, {
    unit: 's',
    description: 'Duração da conferência da trava do Tutor por prova, por escola',
    advice: { explicitBucketBoundaries: LIMITES_DO_HISTOGRAMA_HTTP_S },
  })
  const inicio = performance.now()
  try {
    return await conferir()
  } finally {
    histograma.record((performance.now() - inicio) / 1_000, { [ROTULO_ESCOLA]: escolaId })
  }
}
