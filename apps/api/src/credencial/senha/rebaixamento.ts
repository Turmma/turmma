import { insuranceLimit, METRICS, systemClock, ROTULO_ESCOLA, type Meter, type Clock } from '@educa/nucleo'
import { JANELA_DO_CONTADOR_POR_IP_MS, type ContadorEmJanela } from './contador-em-janela.js'

/** O piso do limiar: uma escola pequena não é rebaixada por uma manhã de senhas esquecidas. */
export const LIMIAR_MINIMO_DE_FALHAS_POR_IP = 100
/** A parte dos alunos ativos da escola que, errando no mesmo minuto pelo mesmo IP, ainda não é ataque. */
export const PROPORCAO_DE_ALUNOS_NO_LIMIAR = 0.25
/** Quanto o número de alunos ativos da escola vale sem ser lido de novo. */
export const VALIDADE_DO_TAMANHO_DA_ESCOLA_MS = 60_000
/** Depois do último rebaixamento, a série da escola fica em 0 por este tempo e então é esquecida. */
export const SERIE_REBAIXADA_ESQUECIDA_APOS_MS = 10 * 60_000
/** O prefixo da chave do contador de falhas por IP e escola, no Redis de fila. */
export const PREFIXO_FALHAS_POR_IP_NA_ESCOLA = 'login:falhas-ip'
/** Teto do cache de tamanho por escola: passando dele, o cache recomeça (são dezenas de escolas, não milhares). */
const MAXIMO_DE_ESCOLAS_NO_CACHE = 10_000

/** O limiar de falhas por minuto de um IP numa escola: `max(100, 25% dos alunos ativos)`. */
export function limiarDeFalhas(alunosAtivos: number): number {
  return Math.max(LIMIAR_MINIMO_DE_FALHAS_POR_IP, Math.ceil(alunosAtivos * PROPORCAO_DE_ALUNOS_NO_LIMIAR))
}

export interface DependenciasDoRebaixamento {
  readonly janela: Pick<ContadorEmJanela, 'chaveDe' | 'ler' | 'somar'>
  /** Quantos alunos ativos a escola do contexto tem: quem chama já está no contexto da escola do endereço. */
  readonly alunosAtivos: () => Promise<number>
  /** Quantas instâncias da API dividem o limiar quando a contagem é do seguro em memória (`LIMITE_INSTANCIAS_API`). */
  readonly instancias: number
  readonly medidor: Meter
  readonly relogio?: Clock
}

/**
 * O rebaixamento por IP e escola no login por matrícula (tarefa 15.1; Tech Spec da identidade, seção 5, "Rajada de
 * falhas na matrícula"; regra 80, item 1). Nunca bloqueia: rebaixa.
 *
 * - **Contagem:** as falhas de cada IP em cada escola, por minuto, no `ContadorEmJanela` (Redis de fila, chave com o
 *   HMAC da escola e do IP). A escola está na chave: o ataque na A não mexe na contagem da B pelo mesmo IP.
 * - **Limiar:** `max(100, 25% dos alunos ativos da escola)`, com o tamanho da escola lido com cache de 1 min. Abaixo de
 *   100 falhas nem se consulta o tamanho.
 * - **Acima do limiar:** a tentativa desse IP para essa escola vai para o fim do balde da escola, e
 *   `login.prioridade_rebaixada{escola_id}` fica em 1 enquanto houver rebaixamento no último minuto.
 * - **Passagem:** quem traz o `educa_dispositivo` válido para aquela matrícula não é rebaixado, nem consulta o contador.
 * - **Seguro:** com a contagem em memória (Redis de fila fora), o limiar é dividido pelas instâncias.
 */
export class RebaixamentoPorEscola {
  readonly #relogio: Clock
  /** Escola → quando esta instância rebaixou uma tentativa dela pela última vez. Só escola, nunca IP. */
  readonly #rebaixadaEm = new Map<string, number>()
  readonly #tamanhos = new Map<string, { readonly alunos: number; readonly venceEm: number }>()
  /** A leitura do tamanho em andamento, por escola: os pedidos que chegam durante ela esperam a mesma, e não vão ao banco. */
  readonly #lendo = new Map<string, Promise<number>>()

  constructor(private readonly dependencias: DependenciasDoRebaixamento) {
    this.#relogio = dependencias.relogio ?? systemClock
    dependencias.medidor
      .createObservableGauge(METRICS.prioridadeRebaixada, { description: 'Se esta instância rebaixou, no último minuto, tentativas de login de um IP com falhas demais na escola' })
      .addCallback((observador) => {
        const agora = this.#relogio.agora().getTime()
        for (const [escolaId, quando] of this.#rebaixadaEm) {
          const passou = agora - quando
          if (passou >= SERIE_REBAIXADA_ESQUECIDA_APOS_MS) this.#rebaixadaEm.delete(escolaId)
          else observador.observe(passou < JANELA_DO_CONTADOR_POR_IP_MS ? 1 : 0, { [ROTULO_ESCOLA]: escolaId })
        }
      })
  }

  /** Se a tentativa deste IP nesta escola vai para o fim do balde. Chamado no contexto da escola do endereço. */
  async rebaixar(ip: string, escolaId: string, conhecido: boolean): Promise<boolean> {
    if (conhecido) return false
    const { janela, instancias } = this.dependencias
    const { valor, doSeguro } = await janela.ler(this.#chave(ip, escolaId))
    const efetivo = (limiar: number) => (doSeguro ? insuranceLimit(limiar, instancias) : limiar)
    if (valor <= efetivo(LIMIAR_MINIMO_DE_FALHAS_POR_IP)) return false
    if (valor <= efetivo(limiarDeFalhas(await this.#alunosAtivos(escolaId)))) return false
    this.#rebaixadaEm.set(escolaId, this.#relogio.agora().getTime())
    return true
  }

  /** Conta uma falha deste IP nesta escola: senha errada, matrícula que não existe ou conta segurada. */
  async contarFalha(ip: string, escolaId: string): Promise<void> {
    await this.dependencias.janela.somar(this.#chave(ip, escolaId))
  }

  #chave(ip: string, escolaId: string): string {
    return this.dependencias.janela.chaveDe(PREFIXO_FALHAS_POR_IP_NA_ESCOLA, `${escolaId}|${ip}`)
  }

  async #alunosAtivos(escolaId: string): Promise<number> {
    const agora = this.#relogio.agora().getTime()
    const guardado = this.#tamanhos.get(escolaId)
    if (guardado !== undefined && guardado.venceEm > agora) return guardado.alunos
    const emAndamento = this.#lendo.get(escolaId)
    if (emAndamento !== undefined) return emAndamento
    const leitura = this.dependencias
      .alunosAtivos()
      .then((alunos) => {
        if (this.#tamanhos.size >= MAXIMO_DE_ESCOLAS_NO_CACHE) this.#tamanhos.clear()
        this.#tamanhos.set(escolaId, { alunos, venceEm: this.#relogio.agora().getTime() + VALIDADE_DO_TAMANHO_DA_ESCOLA_MS })
        return alunos
      })
      .finally(() => this.#lendo.delete(escolaId))
    this.#lendo.set(escolaId, leitura)
    return leitura
  }
}
