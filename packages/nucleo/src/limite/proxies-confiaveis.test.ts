import { describe, expect, it } from 'vitest'
import { INTERVALO_MINIMO_RESOLUCAO_MS, TrustedProxies, TIMEOUT_RESOLUCAO_MS } from './proxies-confiaveis.js'

function relogio() {
  let instante = 0
  return { agora: () => instante, avancar: (ms: number) => (instante += ms) }
}

describe('ProxiesConfiaveis', () => {
  it('IP da configuração é confiável, também chegando como IPv4 mapeado; outro IP não é', async () => {
    const proxies = new TrustedProxies(['10.0.0.2'], async () => {
      throw new Error('IP fixo não deveria ser resolvido')
    })
    expect(await proxies.ehConfiavel('10.0.0.2')).toBe(true)
    expect(await proxies.ehConfiavel('::ffff:10.0.0.2')).toBe(true)
    expect(await proxies.ehConfiavel('10.0.0.3')).toBe(false)
    expect(await proxies.ehConfiavel(undefined)).toBe(false)
  })

  it('nome da configuração vale pelo endereço resolvido, e a borda que volta com outro IP é reconhecida', async () => {
    const { agora, avancar } = relogio()
    let enderecoDaBorda = '172.20.0.5'
    const proxies = new TrustedProxies(['borda'], async (nome) => (nome === 'borda' ? [enderecoDaBorda] : []), agora)

    expect(await proxies.ehConfiavel('172.20.0.5')).toBe(true)
    enderecoDaBorda = '172.20.0.8'
    avancar(INTERVALO_MINIMO_RESOLUCAO_MS)
    expect(await proxies.ehConfiavel('172.20.0.8')).toBe(true)
    // O endereço antigo deixa de valer: pode ter ido para outro container.
    avancar(INTERVALO_MINIMO_RESOLUCAO_MS)
    expect(await proxies.ehConfiavel('172.20.0.5')).toBe(false)
  })

  it('quem forja o cabeçalho de fora não provoca uma resolução por requisição', async () => {
    const { agora, avancar } = relogio()
    let resolucoes = 0
    const proxies = new TrustedProxies(['borda'], async () => {
      resolucoes++
      return ['172.20.0.5']
    }, agora)

    await Promise.all(Array.from({ length: 50 }, (_, indice) => proxies.ehConfiavel(`198.51.100.${indice}`)))
    for (let indice = 0; indice < 50; indice++) await proxies.ehConfiavel(`203.0.113.${indice}`)
    expect(resolucoes).toBe(1)

    avancar(INTERVALO_MINIMO_RESOLUCAO_MS)
    expect(await proxies.ehConfiavel('203.0.113.200')).toBe(false)
    expect(resolucoes).toBe(2)
  })

  it('resolução que não volta a tempo não segura a requisição e mantém o que já se sabia', async () => {
    const { agora, avancar } = relogio()
    let travar = false
    const proxies = new TrustedProxies(['borda'], (nome) => (travar ? new Promise(() => undefined) : Promise.resolve(nome === 'borda' ? ['172.20.0.5'] : [])), agora)
    expect(await proxies.ehConfiavel('172.20.0.5')).toBe(true)

    travar = true
    avancar(INTERVALO_MINIMO_RESOLUCAO_MS)
    const inicio = performance.now()
    expect(await proxies.ehConfiavel('198.51.100.1')).toBe(false)
    expect(performance.now() - inicio).toBeLessThan(TIMEOUT_RESOLUCAO_MS + 100)
    expect(await proxies.ehConfiavel('172.20.0.5')).toBe(true)
  })

  it('com o DNS travado, não começa outra consulta enquanto a anterior não volta', async () => {
    const { agora, avancar } = relogio()
    let consultas = 0
    let liberar: (enderecos: readonly string[]) => void = () => undefined
    const proxies = new TrustedProxies(['borda'], () => {
      consultas++
      return new Promise((resolver) => {
        liberar = resolver
      })
    }, agora)

    for (let rodada = 0; rodada < 5; rodada++) {
      expect(await proxies.ehConfiavel('172.20.0.5')).toBe(false)
      avancar(INTERVALO_MINIMO_RESOLUCAO_MS)
    }
    expect(consultas).toBe(1)

    liberar(['172.20.0.5'])
    await new Promise((resolver) => setImmediate(resolver))
    expect(await proxies.ehConfiavel('172.20.0.5')).toBe(true)
  })

  it('resolução que falha mantém o que já se sabia', async () => {
    const { agora, avancar } = relogio()
    let falhar = false
    const proxies = new TrustedProxies(['borda'], async () => {
      if (falhar) throw new Error('ENOTFOUND')
      return ['172.20.0.5']
    }, agora)
    expect(await proxies.ehConfiavel('172.20.0.5')).toBe(true)
    falhar = true
    avancar(INTERVALO_MINIMO_RESOLUCAO_MS)
    expect(await proxies.ehConfiavel('198.51.100.1')).toBe(false)
    expect(await proxies.ehConfiavel('172.20.0.5')).toBe(true)
  })
})
