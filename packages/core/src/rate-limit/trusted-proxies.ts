import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { normalizeIp } from './keys.js'

export type NameResolver = (nome: string) => Promise<readonly string[]>

/** Uma resolução por vez, e no máximo uma a cada este intervalo, por mais conexões desconhecidas que cheguem. */
export const INTERVALO_MINIMO_RESOLUCAO_MS = 2_000

/** Resolução de nome que não volta a tempo não segura a requisição: vale o que já se sabia. */
export const TIMEOUT_RESOLUCAO_MS = 200

async function resolverPeloSistema(nome: string): Promise<readonly string[]> {
  const enderecos = await lookup(nome, { all: true })
  return enderecos.map((endereco) => endereco.address)
}

/**
 * Os proxies cujo `X-Forwarded-For` a API aceita: só a borda. A configuração traz nome (`borda`, no
 * compose) ou IP. O nome é resolvido de novo quando chega conexão de um endereço desconhecido, no
 * máximo a cada `INTERVALO_MINIMO_RESOLUCAO_MS`: a borda que reinicia com outro IP volta a ser
 * reconhecida em segundos, e quem forja o cabeçalho de fora não provoca uma consulta por requisição.
 *
 * Guarda só o cache de endereços da própria instância, que nenhuma outra precisa.
 */
export class TrustedProxies {
  readonly #ipsFixos: ReadonlySet<string>
  readonly #nomes: readonly string[]
  #ipsResolvidos: ReadonlySet<string> = new Set()
  #resolvidoEm = Number.NEGATIVE_INFINITY
  #resolucao: Promise<void> | undefined
  /** A consulta ao sistema em si, que o prazo não cancela: enquanto não volta, nenhuma outra começa. */
  #consulta: Promise<void> | undefined

  constructor(
    entradas: readonly string[],
    private readonly resolver: NameResolver = resolverPeloSistema,
    private readonly agora: () => number = () => performance.now(),
  ) {
    this.#ipsFixos = new Set(entradas.flatMap((entrada) => normalizeIp(entrada) ?? []))
    this.#nomes = entradas.filter((entrada) => isIP(entrada) === 0)
  }

  async ehConfiavel(enderecoDaConexao: string | undefined): Promise<boolean> {
    const ip = normalizeIp(enderecoDaConexao)
    if (ip === undefined) return false
    if (this.#ipsFixos.has(ip) || this.#ipsResolvidos.has(ip)) return true
    if (this.#nomes.length === 0 || this.agora() - this.#resolvidoEm < INTERVALO_MINIMO_RESOLUCAO_MS) return false
    await this.#resolverNomes()
    return this.#ipsResolvidos.has(ip)
  }

  #resolverNomes(): Promise<void> {
    this.#resolucao ??= this.#resolverComPrazo().finally(() => {
      this.#resolvidoEm = this.agora()
      this.#resolucao = undefined
    })
    return this.#resolucao
  }

  async #resolverComPrazo(): Promise<void> {
    let prazo: NodeJS.Timeout | undefined
    const estourou = new Promise<void>((resolver) => {
      prazo = setTimeout(resolver, TIMEOUT_RESOLUCAO_MS)
    })
    // `dns.lookup` ocupa uma thread do libuv até voltar, e o prazo não a cancela. Com o DNS travado,
    // começar outra consulta a cada intervalo encheria o pool que o resto do processo usa: enquanto
    // uma não volta, nenhuma outra começa, e a que volta atrasada ainda atualiza o conjunto.
    this.#consulta ??= Promise.allSettled(this.#nomes.map((nome) => this.resolver(nome)))
      .then((resolvidos) => this.#aplicar(resolvidos))
      .finally(() => {
        this.#consulta = undefined
      })
    try {
      await Promise.race([this.#consulta, estourou])
    } finally {
      clearTimeout(prazo)
    }
  }

  /** Nenhum nome resolvido: fica o conjunto anterior. */
  #aplicar(resolvidos: Array<PromiseSettledResult<readonly string[]>>): void {
    if (!resolvidos.some((resultado) => resultado.status === 'fulfilled')) return
    const enderecos = resolvidos.flatMap((resultado) => (resultado.status === 'fulfilled' ? resultado.value : []))
    this.#ipsResolvidos = new Set(enderecos.flatMap((endereco) => normalizeIp(endereco) ?? []))
  }
}
