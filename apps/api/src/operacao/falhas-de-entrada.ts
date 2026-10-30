import { METRICS, type Meter } from '@educa/nucleo'

/**
 * A série `operacao.entrada_falha` (Tech Spec da A0, seção 7c): toda entrada do operador que falhou, pela senha
 * (`/sessao/email`) ou pelo código (`/sessao/mfa`), conta uma vez. Um contador só, criado uma vez no módulo e dividido
 * pelas duas rotas: a leitura por minuto do painel é a soma das duas etapas. Sem rótulo: nada da pessoa nem do operador.
 */
export class FalhasDeEntradaDaOperacao {
  readonly #contador: ReturnType<Meter['createCounter']>

  constructor(medidor: Meter) {
    this.#contador = medidor.createCounter(METRICS.entradaFalhaDaOperacao, { description: 'Entradas do operador Turmma que falharam, pela senha ou pelo código' })
    // A série nasce em 0 no boot, como as do login do F1: o painel mostra 0, e não "sem dado", até a primeira falha.
    this.#contador.add(0)
  }

  somar(): void {
    this.#contador.add(1)
  }
}
