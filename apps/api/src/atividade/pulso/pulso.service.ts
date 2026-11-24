import { summarizeError, systemClock, type Clock, type LoggerBase } from '@educa/core'
import { LIMIAR_DA_LACUNA_MS } from '@educa/shared'
import type { BeforeApplicationShutdown, INestApplication } from '@nestjs/common'
import type { PulsoRepository } from './pulso.repository.js'

/** De quanto em quanto tempo cada instância HTTP da API pulsa (Tech Spec §5.7). */
export const INTERVALO_DO_PULSO_MS = 10_000

/**
 * O tique do pulso: chama `acao` a cada `intervaloMs` e devolve quem o desliga. O teste o injeta e dispara o tique à mão: nenhum teste do pulso dorme. O de produção é
 * `setInterval`, que não segura o processo vivo.
 */
export type Tique = (acao: () => Promise<void>, intervaloMs: number) => () => void

export const tiqueDoRelogio: Tique = (acao, intervaloMs) => {
  const marca = setInterval(() => void acao(), intervaloMs)
  marca.unref()
  return () => clearInterval(marca)
}

export interface PulsoServiceDependencies {
  readonly repositorio: Pick<PulsoRepository, 'pulsar' | 'encerrar'>
  /** O relógio **desta instância**, o da recusa: o último pulso que ela deu e o quanto faz. Não é o do banco, que é o do limite da tentativa. */
  readonly relogio?: Clock
  readonly tique?: Tique
  readonly logger: LoggerBase
}

/**
 * O pulso desta instância da API (avaliacao-e-correcao, 2.0; Tech Spec §5.7; regra 80, item 6): a cada 10 s ela grava que está de pé, e a lacuna entre dois pulsos acima de
 * 30 s vira `indisponibilidade`, que o limite de cada tentativa soma de volta (`limiteDaTentativa`). Só a instância HTTP pulsa: o worker e o realtime podem estar de pé com a
 * API fora, e então o pulso diria que não houve queda.
 *
 * **A instância que não consegue pulsar há mais de 30 s recusa as rotas de prova** (503, `RotasDeProvaGuard`): sem o pulso gravado, a queda dela não entraria na conta do
 * tempo, e cobrar a prova de quem não pôde responder é o que a regra 80, item 6, proíbe. Toda lacuna gravada é, assim, queda real. O resto da API segue.
 *
 * Antes de `start`, a instância não mede o pulso e não recusa nada: é o worker, o teste que não liga o pulso e o instante entre o `NestFactory` e o primeiro pulso, em que a
 * porta ainda não está aberta (`ouvirDepoisDoPrimeiroPulso`).
 */
export class PulsoService implements BeforeApplicationShutdown {
  readonly #repositorio: PulsoServiceDependencies['repositorio']
  readonly #relogio: Clock
  readonly #tique: Tique
  readonly #logger: LoggerBase
  #ultimoSucessoEm: Date | undefined
  #armado = false
  #emAndamento = false
  #desligarTique: (() => void) | undefined

  constructor({ repositorio, relogio = systemClock, tique = tiqueDoRelogio, logger }: PulsoServiceDependencies) {
    this.#repositorio = repositorio
    this.#relogio = relogio
    this.#tique = tique
    this.#logger = logger
  }

  async #pulsar(): Promise<void> {
    await this.#repositorio.pulsar()
    this.#ultimoSucessoEm = this.#relogio.agora()
  }

  /** O que o tique chama: um pulso que falha não derruba o processo nem para o tique, e o seguinte tenta de novo. Um pulso por vez. */
  readonly #aoTique = async (): Promise<void> => {
    if (this.#emAndamento) return
    this.#emAndamento = true
    try {
      await this.#pulsar()
    } catch (erro) {
      // O resumo do erro (o sqlstate do Postgres), nunca a mensagem: ela pode repetir a instrução.
      this.#logger.warn({ evento: 'pulso.falhou', erro: summarizeError(erro) })
    } finally {
      this.#emAndamento = false
    }
  }

  /**
   * O primeiro pulso, **esperado**, e o tique. Falha no primeiro sobe a quem chamou: a instância que não consegue pulsar não abre a porta. Chamar de novo não liga outro tique.
   */
  async start(): Promise<void> {
    if (this.#armado) return
    await this.#pulsar()
    this.#armado = true
    this.#desligarTique = this.#tique(this.#aoTique, INTERVALO_DO_PULSO_MS)
  }

  /** `false` quando a instância pulsa mas o último pulso bem-sucedido foi há **mais** de 30 s: 30 s exatos ainda aceita. Sem `start`, aceita. */
  aceitaProva(): boolean {
    if (!this.#armado || this.#ultimoSucessoEm === undefined) return true
    return this.#relogio.agora().getTime() - this.#ultimoSucessoEm.getTime() <= LIMIAR_DA_LACUNA_MS
  }

  /** Os segundos desde o último pulso bem-sucedido, para a métrica `api.pulso.idade_s`; `undefined` antes do primeiro. */
  idadeEmSegundos(): number | undefined {
    if (this.#ultimoSucessoEm === undefined) return undefined
    return (this.#relogio.agora().getTime() - this.#ultimoSucessoEm.getTime()) / 1000
  }

  /** Desliga o tique e devolve a conexão ao pool, antes de o `DatabaseModule` fechá-lo: o pool não termina com conexão emprestada. */
  async beforeApplicationShutdown(): Promise<void> {
    this.#desligarTique?.()
    this.#desligarTique = undefined
    await this.#repositorio.encerrar()
  }
}

/**
 * Abre a porta **depois** do primeiro pulso (Tech Spec §5.7: "antes de aceitar tráfego"): a instância que sobe depois de uma queda grava a lacuna antes de a primeira
 * prova bater nela. É o que o `main.ts` chama no lugar do `listen`.
 */
export async function ouvirDepoisDoPrimeiroPulso(app: INestApplication, porta: number, endereco: string): Promise<void> {
  await app.get(PulsoService).start()
  await app.listen(porta, endereco)
}
