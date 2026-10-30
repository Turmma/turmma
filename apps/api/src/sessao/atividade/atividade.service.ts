import { throttledWarn, METRICS, requestSessao, type Database, type Meter } from '@educa/nucleo'
import { Logger } from '@nestjs/common'
import { EscritaDeSessaoRepository } from '../../credencial/escrita-de-sessao.repository.js'

/**
 * A atividade da pessoa na sessão da requisição: move `ultimo_uso_em`, que é o que a inatividade confere (Tech Spec,
 * seção 5, "Atividade"). Só `POST /v1/sessao/atividade` e, no F6, a gravação de resposta de avaliação a chamam: uma
 * requisição qualquer, a renovação e o handshake do realtime não contam como uso.
 *
 * A gravação não segura a resposta: começa e segue sozinha. A que falhar (Postgres lento ou fora) é contada em
 * `sessao.atividade_falha`, sem 5xx; a tolerância de 5 min da inatividade cobre uma atividade perdida.
 */
export class RegistroDeAtividade {
  readonly #logger = new Logger('sessao')
  readonly #falhas: ReturnType<Meter['createCounter']>
  readonly #avisar = throttledWarn(() => this.#logger.warn('sessao.atividade_falhou'))

  constructor(
    private readonly banco: Database,
    medidor: Meter,
  ) {
    this.#falhas = medidor.createCounter(METRICS.atividadeFalha, { description: 'Gravações de atividade de sessão que falharam' })
    this.#falhas.add(0)
  }

  /**
   * Contrato para o F6: registra a atividade da sessão da requisição em andamento, sem esperar a gravação. Devolve a
   * gravação, para quem precisar saber quando terminou (o teste); ela nunca rejeita.
   */
  registrarAtividade(): Promise<void> {
    const { sessaoId } = requestSessao()
    return new EscritaDeSessaoRepository(this.banco)
      .registrarUso(sessaoId)
      .then(() => undefined)
      .catch(() => {
        this.#falhas.add(1)
        this.#avisar()
      })
  }
}
