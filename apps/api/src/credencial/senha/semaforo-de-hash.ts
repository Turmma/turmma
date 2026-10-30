import { ErroDeDominio, LIMITES_DO_HISTOGRAMA_HTTP_S, METRICAS, ROTULO_ESCOLA, type Meter } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { randomInt } from 'node:crypto'
import type { BaldeDeLogin } from './baldes-de-login.js'

/** Quanto um login espera a vez no semáforo antes de sair com 503 (Tech Spec da identidade, seção 5, "Hash"). */
export const ESPERA_MAXIMA_PELO_HASH_MS = 2_000
/** O `Retry-After` do 503 do semáforo é sorteado nesta faixa, em segundos: a rajada que volta não volta junta. */
export const RETRY_AFTER_MINIMO_S = 2
export const RETRY_AFTER_MAXIMO_S = 6
/**
 * Teto de pedidos esperando nesta instância. Com o prazo de 2 s ele só é alcançado por uma inundação muito acima da
 * rajada das 7h30 (~14 logins/s): acima dele o pedido sai com o mesmo 503 na hora, e a memória não cresce sem limite.
 */
export const MAXIMO_ESPERANDO = 10_000
/** Quantos baldes e subfilas a roda lembra antes de esquecer os que não têm ninguém esperando. */
const MAXIMO_NA_RODA = 10_000
/**
 * De quanto em quanto tempo a roda esquece quem não está esperando nem foi visto no último intervalo, mesmo abaixo do
 * teto (15.6): a subfila da equipe é o IP de quem pediu, e ele fica na memória da instância no máximo dois intervalos
 * depois da última vez, ou até o login seguinte, se a instância ficar sem login (a varredura roda na vez concedida).
 * Esquecer só muda a posição de quem voltar: entra logo antes da vez atual, como um balde novo.
 */
export const INTERVALO_PARA_ESQUECER_MS = 60_000

/** A chave da subfila na roda: o balde e a subfila, separados por um caractere que não aparece em id nem em IP. */
function chaveDaSubfila(balde: Pick<BaldeDeLogin, 'id' | 'subfila'>): string {
  return `${balde.id}\u0000${balde.subfila}`
}

interface Espera {
  readonly balde: BaldeDeLogin
  readonly inicio: number
  readonly entrar: () => void
  readonly sair: (erro: ErroDeDominio) => void
  readonly timer: ReturnType<typeof setTimeout>
}

/** As subfilas de um balde, separadas por prioridade: a rebaixada só anda quando a normal está vazia (15.0). */
interface FilasDoBalde {
  readonly normal: Map<string, Espera[]>
  readonly rebaixada: Map<string, Espera[]>
}

function filasDe(filas: FilasDoBalde, rebaixado: boolean): Map<string, Espera[]> {
  return rebaixado ? filas.rebaixada : filas.normal
}

/**
 * O semáforo do hash de senha (tarefa 14.0; Tech Spec da identidade, seção 5, "Hash"; regra 80, itens 1, 3 e 10).
 *
 * - **Teto:** no máximo `concorrencia` hashes ao mesmo tempo nesta instância (`LOGIN_HASH_CONCORRENCIA`, conferida no
 *   boot contra `UV_THREADPOOL_SIZE − 8`): às 7h30 o argon2 não toma a CPU nem as threads do libuv da API.
 * - **Rodízio:** quem espera fica na fila do seu balde (`baldes-de-login.ts`), e a vez que abre vai ao balde atendido
 *   há mais tempo, não ao pedido mais antigo: 3.000 pedidos de uma escola não passam na frente do primeiro de outra.
 *   Dentro do balde, a mesma roda entre as subfilas (o IP, na equipe).
 * - **Prazo:** quem espera mais de 2 s sai com 503 `INDISPONIVEL_TENTE_DE_NOVO` e `Retry-After` sorteado entre 2 e 6 s,
 *   sem chegar à tarefa. O prazo e o balde não dependem de a credencial existir: sob saturação, a matrícula ou o e-mail
 *   que existe e o que não existe recebem o 503 na mesma proporção (regra 20, item 6).
 * - **Rebaixado** (15.0): dentro do balde, a tentativa rebaixada só recebe a vez quando ninguém não rebaixado espera
 *   naquele balde. O balde continua na roda com a mesma vez: o ataque na A não tira vez da B.
 * - **Métricas:** `login.hash_espera{escola_id}` a cada vez concedida, `login.hash_recusado` a cada 503.
 * - **IP em memória** (15.6): a roda lembra a subfila (o IP, na equipe) de quem já foi atendido, e esquece quem não está
 *   esperando nem foi visto no último `INTERVALO_PARA_ESQUECER_MS`, ou todos que não esperam, se passar de 10.000.
 * - **Fila cheia** (15.0, corrigido na 16.5): com 10.000 esperando, o pedido não rebaixado entra no lugar do rebaixado
 *   mais antigo do balde com mais rebaixados, somadas as subfilas, que sai com o 503; o rebaixado que chega com a fila
 *   cheia sai ele mesmo. Somar o balde, e não olhar a maior subfila: no balde da equipe, um ataque espalhado por muitos
 *   IPs deixa subfilas curtas, e a maior subfila podia ser a do professor atrás do NAT da escola. O índice dos
 *   rebaixados por balde anda junto da fila, e o despejo não percorre as subfilas.
 *
 * Estado só desta instância, e de propósito: o que ele protege é a CPU e as threads do processo, que não se somam
 * entre instâncias (regra 80, item 5, trata de estado que outra instância precise; este não é).
 */
export class SemaforoDeHash {
  readonly #esperaPeloHash: ReturnType<Meter['createHistogram']>
  readonly #recusados: ReturnType<Meter['createCounter']>
  /**
   * Balde → prioridade → subfila → pedidos esperando, em ordem de chegada. Balde e subfila sem ninguém esperando saem do
   * mapa.
   */
  readonly #baldes = new Map<string, FilasDoBalde>()
  /**
   * A roda: em que vez cada balde, e cada subfila dentro dele, foi atendido por último (ou entrou na roda, se ainda
   * não foi). A vez que abre vai ao balde esperando há mais tempo sem ser atendido, contando também a vez que ele pegou
   * sem fila: o balde que está com o hash em andamento vai para o fim da roda, e não para o começo, quando os pedidos
   * seguintes dele chegam.
   */
  readonly #ultimaVez = new Map<string, number>()
  /** Quando cada entrada da roda foi vista pela última vez (entrou na fila ou recebeu a vez): é o prazo de esquecer. */
  readonly #vistoEm = new Map<string, number>()
  /**
   * Balde → os rebaixados esperando nele, em ordem de chegada (16.5): o primeiro é o mais antigo, e o tamanho é quantos
   * o balde tem. Anda junto da fila, em `#enfileirar`, `#proxima` e `#retirar`, para o despejo não percorrer as
   * subfilas no pico.
   */
  readonly #rebaixadosPorBalde = new Map<string, Set<Espera>>()
  #vez = 0
  #emUso = 0
  #esperando = 0
  #esquecidoEm: number

  /** @param agora só o teste troca, para passar o intervalo de esquecer sem esperar. */
  constructor(
    private readonly concorrencia: number,
    medidor: Meter,
    private readonly esperaMaximaMs = ESPERA_MAXIMA_PELO_HASH_MS,
    private readonly agora: () => number = () => performance.now(),
  ) {
    if (!Number.isInteger(concorrencia) || concorrencia < 1) throw new RangeError('a concorrência do semáforo do hash precisa ser um inteiro positivo')
    this.#esperaPeloHash = medidor.createHistogram(METRICAS.esperaPeloHash, {
      unit: 's',
      description: 'Espera pela vez no semáforo do hash de senha, por escola',
      advice: { explicitBucketBoundaries: LIMITES_DO_HISTOGRAMA_HTTP_S },
    })
    this.#recusados = medidor.createCounter(METRICAS.hashRecusado, { description: 'Logins que esperaram mais que o prazo pelo hash e saíram com 503' })
    // A série nasce em 0 no boot: a taxa do alerta `login-hash-recusado` conta o primeiro 503 desde o boot.
    this.#recusados.add(0)
    this.#esquecidoEm = this.agora()
  }

  /** Hashes rodando agora. */
  get emUso(): number {
    return this.#emUso
  }

  /** Pedidos esperando a vez agora, somados os baldes. */
  get esperando(): number {
    return this.#esperando
  }

  /** Quantos baldes e subfilas (IPs, na equipe) a roda lembra agora: é o que o prazo de esquecer limita. */
  get naRoda(): number {
    return this.#ultimaVez.size
  }

  /**
   * Roda `tarefa` quando o balde tiver a vez, e devolve o resultado dela. A vez é devolvida quando a tarefa termina,
   * com sucesso ou erro. Sem vez em 2 s, lança o 503, e a tarefa não roda.
   */
  async executar<T>(balde: BaldeDeLogin, tarefa: () => Promise<T>): Promise<T> {
    await this.#aguardarVez(balde)
    try {
      return await tarefa()
    } finally {
      this.#devolverVez()
    }
  }

  #aguardarVez(balde: BaldeDeLogin): Promise<void> {
    const inicio = this.agora()
    if (this.#emUso < this.concorrencia && this.#esperando === 0) {
      this.#conceder(balde, inicio)
      return Promise.resolve()
    }
    // Fila cheia: o pedido que não foi rebaixado toma o lugar do rebaixado mais antigo do balde com mais rebaixados, que
    // sai com o 503 (15.0 e 16.5). Um ataque rebaixado nunca faz a outra escola, nem o professor de verdade, receber 503
    // na hora. Sem rebaixado na fila, ou com o próprio pedido rebaixado, quem sai é ele.
    if (this.#esperando >= MAXIMO_ESPERANDO && (balde.rebaixado || !this.#despejarUmRebaixado())) return Promise.reject(this.#recusar())
    return new Promise<void>((resolver, rejeitar) => {
      const espera: Espera = {
        balde,
        inicio,
        entrar: resolver,
        sair: rejeitar,
        timer: setTimeout(() => {
          this.#retirar(espera)
          rejeitar(this.#recusar())
        }, this.esperaMaximaMs),
      }
      this.#enfileirar(espera)
    })
  }

  /**
   * Tira da fila, com o 503, o rebaixado mais antigo do balde com mais rebaixados (somadas as subfilas). Diz se havia
   * algum. Percorre só os baldes (as escolas, `equipe` e `desconhecida`), nunca as subfilas.
   */
  #despejarUmRebaixado(): boolean {
    let maior: Set<Espera> | undefined
    for (const rebaixados of this.#rebaixadosPorBalde.values()) if (rebaixados.size > (maior?.size ?? 0)) maior = rebaixados
    const despejado = maior?.values().next().value
    if (despejado === undefined) return false
    clearTimeout(despejado.timer)
    this.#retirar(despejado)
    despejado.sair(this.#recusar())
    return true
  }

  #devolverVez(): void {
    this.#emUso--
    while (this.#emUso < this.concorrencia) {
      const proxima = this.#proxima()
      if (proxima === undefined) return
      clearTimeout(proxima.timer)
      this.#conceder(proxima.balde, proxima.inicio)
      proxima.entrar()
    }
  }

  #conceder(balde: BaldeDeLogin, inicio: number): void {
    // Sob ataque com muitos IPs, a roda não cresce sem limite, e nenhum IP fica nela sem prazo: esquece quem não está
    // esperando, antes de anotar a vez de quem acabou de recebê-la.
    const agora = this.agora()
    if (this.#ultimaVez.size >= MAXIMO_NA_RODA) this.#esquecerQuemNaoEspera(agora, true)
    else if (agora - this.#esquecidoEm >= INTERVALO_PARA_ESQUECER_MS) this.#esquecerQuemNaoEspera(agora, false)
    this.#emUso++
    this.#vez++
    for (const chave of [balde.id, chaveDaSubfila(balde)]) {
      this.#ultimaVez.set(chave, this.#vez)
      this.#vistoEm.set(chave, agora)
    }
    this.#medirEspera(balde, inicio)
  }

  /**
   * Esquece quem não está esperando: pelo prazo, só quem não foi visto no último intervalo (o balde com o hash em
   * andamento continua com a vez dele na roda); pelo teto, todos que não esperam.
   */
  #esquecerQuemNaoEspera(agora: number, peloTeto: boolean): void {
    this.#esquecidoEm = agora
    const esperando = new Set<string>()
    for (const [id, filas] of this.#baldes) {
      esperando.add(id)
      for (const subfila of [...filas.normal.keys(), ...filas.rebaixada.keys()]) esperando.add(chaveDaSubfila({ id, subfila }))
    }
    for (const chave of this.#ultimaVez.keys()) {
      if (esperando.has(chave)) continue
      if (!peloTeto && agora - (this.#vistoEm.get(chave) ?? Number.NEGATIVE_INFINITY) < INTERVALO_PARA_ESQUECER_MS) continue
      this.#ultimaVez.delete(chave)
      this.#vistoEm.delete(chave)
    }
  }

  #enfileirar(espera: Espera): void {
    // Quem entra na roda sem vez anterior entra logo antes da vez atual: na frente de quem acabou de ser atendido (o
    // balde com o hash em andamento), atrás de quem espera desde antes. Um IP novo a cada pedido, num ataque ao balde
    // da equipe, não passa na frente de quem já esperava.
    for (const chave of [espera.balde.id, chaveDaSubfila(espera.balde)]) {
      if (!this.#ultimaVez.has(chave)) this.#ultimaVez.set(chave, this.#vez - 0.5)
      this.#vistoEm.set(chave, espera.inicio)
    }
    const filas = this.#baldes.get(espera.balde.id) ?? { normal: new Map<string, Espera[]>(), rebaixada: new Map<string, Espera[]>() }
    const subfilas = filasDe(filas, espera.balde.rebaixado)
    const fila = subfilas.get(espera.balde.subfila) ?? []
    fila.push(espera)
    subfilas.set(espera.balde.subfila, fila)
    this.#baldes.set(espera.balde.id, filas)
    if (espera.balde.rebaixado) {
      const rebaixados = this.#rebaixadosPorBalde.get(espera.balde.id) ?? new Set<Espera>()
      rebaixados.add(espera)
      this.#rebaixadosPorBalde.set(espera.balde.id, rebaixados)
    }
    this.#esperando++
  }

  /** Tira o pedido do índice dos rebaixados do balde, se ele era rebaixado. */
  #esquecerRebaixado(espera: Espera): void {
    if (!espera.balde.rebaixado) return
    const rebaixados = this.#rebaixadosPorBalde.get(espera.balde.id)
    rebaixados?.delete(espera)
    if (rebaixados?.size === 0) this.#rebaixadosPorBalde.delete(espera.balde.id)
  }

  /**
   * O primeiro pedido da subfila atendida há mais tempo, dentro do balde atendido há mais tempo; no balde, as subfilas
   * rebaixadas só quando não há normal esperando. Empate (os dois entraram na roda na mesma vez) fica com quem chegou
   * primeiro à fila.
   */
  #proxima(): Espera | undefined {
    const id = this.#maisAntigo(this.#baldes.keys(), (candidato) => candidato)
    const filas = id === undefined ? undefined : this.#baldes.get(id)
    if (id === undefined || filas === undefined) return undefined
    const subfilas = filas.normal.size > 0 ? filas.normal : filas.rebaixada
    const subfila = this.#maisAntigo(subfilas.keys(), (candidata) => chaveDaSubfila({ id, subfila: candidata }))
    const fila = subfila === undefined ? undefined : subfilas.get(subfila)
    const espera = fila?.shift()
    if (subfila === undefined || fila === undefined || espera === undefined) return undefined
    this.#esquecerRebaixado(espera)
    this.#esperando--
    if (fila.length === 0) subfilas.delete(subfila)
    if (filas.normal.size === 0 && filas.rebaixada.size === 0) this.#baldes.delete(id)
    return espera
  }

  #maisAntigo(candidatos: Iterable<string>, chave: (candidato: string) => string): string | undefined {
    let escolhido: string | undefined
    let menorVez = Number.POSITIVE_INFINITY
    for (const candidato of candidatos) {
      const vez = this.#ultimaVez.get(chave(candidato)) ?? Number.NEGATIVE_INFINITY
      if (vez < menorVez) {
        escolhido = candidato
        menorVez = vez
      }
    }
    return escolhido
  }

  /** Tira da fila quem desistiu pelo prazo, sem mexer na ordem da roda. */
  #retirar(espera: Espera): void {
    const filas = this.#baldes.get(espera.balde.id)
    const subfilas = filas === undefined ? undefined : filasDe(filas, espera.balde.rebaixado)
    const fila = subfilas?.get(espera.balde.subfila)
    const posicao = fila?.indexOf(espera) ?? -1
    if (filas === undefined || subfilas === undefined || fila === undefined || posicao < 0) return
    fila.splice(posicao, 1)
    this.#esquecerRebaixado(espera)
    this.#esperando--
    if (fila.length === 0) subfilas.delete(espera.balde.subfila)
    if (filas.normal.size === 0 && filas.rebaixada.size === 0) this.#baldes.delete(espera.balde.id)
  }

  #recusar(): ErroDeDominio {
    this.#recusados.add(1)
    return new ErroDeDominio(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, randomInt(RETRY_AFTER_MINIMO_S, RETRY_AFTER_MAXIMO_S + 1))
  }

  #medirEspera(balde: BaldeDeLogin, inicio: number): void {
    this.#esperaPeloHash.record((this.agora() - inicio) / 1_000, { [ROTULO_ESCOLA]: balde.rotulo })
  }
}

/** O balde único do semáforo sem proteção: todo pedido na mesma fila, por ordem de chegada, e ninguém rebaixado. */
const BALDE_UNICO = 'unico'

/**
 * O semáforo do controle negativo do cenário "login às 7h30" (`LOGIN_PROTECAO_DESLIGADA=true`, tarefa 16.0): o mesmo teto
 * e o mesmo prazo, mas sem baldes por escola, sem subfila por IP e sem rebaixamento. Todo login espera numa fila só, por
 * ordem de chegada. Existe para o cenário provar que reprova sem a proteção; a flag é recusada com `AMBIENTE=producao`.
 * A métrica de espera continua com o rótulo do balde de verdade.
 */
export class SemaforoSemProtecao extends SemaforoDeHash {
  override executar<T>(balde: BaldeDeLogin, tarefa: () => Promise<T>): Promise<T> {
    return super.executar({ id: BALDE_UNICO, subfila: '', rotulo: balde.rotulo, rebaixado: false }, tarefa)
  }
}
