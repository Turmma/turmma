/** Quantas extrações rodam ao mesmo tempo neste processo, somando todas as escolas. */
export const EXTRACOES_AO_MESMO_TEMPO = 2
/** Quantas extrações de uma mesma escola rodam ao mesmo tempo: uma. As outras dela esperam, e as das outras escolas passam. */
export const EXTRACOES_POR_ESCOLA = 1
/** O prazo de uma extração. Passou dele, o material vira `falhou` com `extracao_falhou`, e a coordenação envia de novo. */
export const PRAZO_DA_EXTRACAO_MS = 45_000

/**
 * O trabalho de uma extração. Recebe o sinal do prazo e **nunca rejeita**: quem o escreve grava a falha no material
 * (promessa rejeitada sem tratamento derruba o processo). Chamado com o sinal já abortado, só grava a falha.
 */
export type ExtractionTask = (sinal: AbortSignal) => Promise<void>

interface NaFila {
  readonly escolaId: string
  readonly trabalho: ExtractionTask
}

export interface ExtractionQueueOptions {
  readonly aoMesmoTempo?: number
  readonly porEscola?: number
  readonly prazoMs?: number
}

const proximaVolta = (): Promise<void> => new Promise((resolver) => setImmediate(resolver))

/**
 * Roda a extração do PDF **depois** de a requisição responder, no processo da API. É a mesma exceção declarada da IA à
 * regra 00, item 4, e à D49 (D77; `docs/mvp-rapido.md`, seção 4, itens 1 e 3), e vale só na fatia de apresentação.
 *
 * O que ela garante mesmo assim (regra 80, item 3):
 * - **uma escola não trava as outras**: uma extração por escola por vez, e a escola que subiu dez arquivos espera a
 *   própria vez sem segurar a vaga de quem vem atrás (`despachar` pula a escola que já está rodando);
 * - teto no total, para a leitura de PDF, que é CPU, não tomar a instância que também atende o resto;
 * - prazo por extração, pelo `AbortSignal`;
 * - no desligamento (`encerrar`), o que está rodando é abortado e o que espera é chamado já abortado: cada material
 *   grava a própria falha, e nenhum fica `processando` por causa de um deploy.
 *
 * A fila guarda só a função: os bytes do PDF vivem no fecho do trabalho e somem com ele. O que limita a memória é o
 * teto de materiais em processamento por escola, conferido no envio.
 *
 * TODO(fila): trocar por job do worker. O envio passa a gravar o PDF num objeto temporário do storage privado, com
 * validade curta, e a publicar um job pelo `JobOutbox` (prioridade `lote`, chave de idempotência = id do
 * material); o processador do worker lê o objeto, extrai, grava os trechos e apaga o objeto. Somem esta fila em
 * memória, as vagas deste processo (a vaga por escola é do despachante) e a varredura dos parados, que vira a
 * reconciliação da fila. O serviço, o repository e o contrato da API não mudam.
 */
export class ExtractionQueue {
  readonly #fila: NaFila[] = []
  readonly #rodandoPorEscola = new Map<string, number>()
  readonly #controles = new Set<AbortController>()
  readonly #promessas = new Set<Promise<void>>()
  readonly #aoMesmoTempo: number
  readonly #porEscola: number
  readonly #prazoMs: number
  #rodando = 0
  #encerrada = false

  constructor(opcoes: ExtractionQueueOptions = {}) {
    this.#aoMesmoTempo = opcoes.aoMesmoTempo ?? EXTRACOES_AO_MESMO_TEMPO
    this.#porEscola = opcoes.porEscola ?? EXTRACOES_POR_ESCOLA
    this.#prazoMs = opcoes.prazoMs ?? PRAZO_DA_EXTRACAO_MS
  }

  /** Devolve na hora. Depois de `encerrar`, o trabalho é chamado já abortado: grava a falha e não lê nada. */
  agendar(escolaId: string, trabalho: ExtractionTask): void {
    if (this.#encerrada) {
      this.#acompanhar(trabalho(AbortSignal.abort()))
      return
    }
    this.#fila.push({ escolaId, trabalho })
    // Na próxima volta do laço de eventos: quem agendou termina de responder antes de a leitura começar.
    setImmediate(() => this.#despachar())
  }

  /** Quantos trabalhos esperam vaga. Só o teste lê. */
  get esperando(): number {
    return this.#fila.length
  }

  /** Para o teste: resolve quando não há nada esperando nem rodando. */
  async ociosa(): Promise<void> {
    while (this.#fila.length > 0 || this.#promessas.size > 0) {
      if (this.#promessas.size > 0) await Promise.all(this.#promessas)
      else await proximaVolta()
    }
  }

  /** No desligamento: aborta o que roda, chama já abortado o que espera, e resolve quando todos gravaram a falha. */
  async encerrar(): Promise<void> {
    this.#encerrada = true
    for (const controle of this.#controles) controle.abort()
    for (const { trabalho } of this.#fila.splice(0)) this.#acompanhar(trabalho(AbortSignal.abort()))
    await Promise.all(this.#promessas)
  }

  /** Dá vaga ao primeiro da fila cuja escola ainda tem vaga: a escola no teto espera, e não segura a de trás. */
  #despachar(): void {
    while (!this.#encerrada && this.#rodando < this.#aoMesmoTempo) {
      const indice = this.#fila.findIndex((item) => (this.#rodandoPorEscola.get(item.escolaId) ?? 0) < this.#porEscola)
      const [item] = indice === -1 ? [] : this.#fila.splice(indice, 1)
      if (item === undefined) return
      const { escolaId } = item
      this.#rodando += 1
      this.#rodandoPorEscola.set(escolaId, (this.#rodandoPorEscola.get(escolaId) ?? 0) + 1)
      this.#acompanhar(
        this.#comPrazo(item.trabalho).finally(() => {
          this.#rodando -= 1
          const restantes = (this.#rodandoPorEscola.get(escolaId) ?? 1) - 1
          if (restantes === 0) this.#rodandoPorEscola.delete(escolaId)
          else this.#rodandoPorEscola.set(escolaId, restantes)
          this.#despachar()
        }),
      )
    }
  }

  async #comPrazo(trabalho: ExtractionTask): Promise<void> {
    const controle = new AbortController()
    this.#controles.add(controle)
    const prazo = setTimeout(() => controle.abort(), this.#prazoMs)
    try {
      await trabalho(controle.signal)
    } finally {
      clearTimeout(prazo)
      this.#controles.delete(controle)
    }
  }

  /** O trabalho promete não rejeitar; se rejeitar mesmo assim, a rejeição morre aqui, e não derruba o processo. */
  #acompanhar(promessa: Promise<void>): void {
    const acompanhada = promessa
      .catch(() => undefined)
      .finally(() => {
        this.#promessas.delete(acompanhada)
      })
    this.#promessas.add(acompanhada)
  }
}
