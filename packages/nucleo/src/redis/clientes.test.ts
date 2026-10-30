import { once } from 'node:events'
import { createServer, type AddressInfo, type Socket } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createQueueRedisClient, TIMEOUT_COMANDO_REDIS_FILA_MS } from './clientes.js'

/** Comandos RESP completos em `buffer`, e o que sobrou de um comando ainda pela metade. */
function lerComandos(buffer: string): { comandos: string[][]; resto: string } {
  const comandos: string[][] = []
  let posicao = 0
  for (;;) {
    const cabecalho = /^\*(\d+)\r\n/.exec(buffer.slice(posicao))
    if (cabecalho === null) break
    let cursor = posicao + cabecalho[0].length
    const partes: string[] = []
    for (let indice = 0; indice < Number(cabecalho[1]); indice++) {
      const tamanho = /^\$(\d+)\r\n/.exec(buffer.slice(cursor))
      if (tamanho === null || buffer.length < cursor + tamanho[0].length + Number(tamanho[1]) + 2) return { comandos, resto: buffer.slice(posicao) }
      cursor += tamanho[0].length
      partes.push(buffer.slice(cursor, cursor + Number(tamanho[1])))
      cursor += Number(tamanho[1]) + 2
    }
    comandos.push(partes)
    posicao = cursor
  }
  return { comandos, resto: buffer.slice(posicao) }
}

/**
 * Um "Redis" travado (pausado, sem memória, em fsync longo) visto pelo cliente: aceita a conexão e
 * não responde a nada. Com `respondeAoAperto`, completa o aperto de mão do ioredis antes de travar,
 * e o cliente chega a ficar pronto.
 */
async function redisTravado(respondeAoAperto: boolean): Promise<{ url: string; fechar: () => void }> {
  const conexoes: Socket[] = []
  const servidor = createServer((conexao) => {
    conexoes.push(conexao)
    let pendente = ''
    conexao.on('data', (dados: Buffer) => {
      const { comandos, resto } = lerComandos(pendente + dados.toString())
      pendente = resto
      for (const [nome = ''] of respondeAoAperto ? comandos : []) {
        const comando = nome.toLowerCase()
        if (comando === 'hello') conexao.write("-ERR unknown command 'hello'\r\n")
        else if (comando === 'client') conexao.write('+OK\r\n')
        else if (comando === 'info') {
          const info = '# Server\r\nredis_version:8.0.0\r\nloading:0\r\n'
          conexao.write(`$${Buffer.byteLength(info)}\r\n${info}\r\n`)
        }
        // Qualquer outro comando fica sem resposta.
      }
    })
  })
  servidor.listen(0, '127.0.0.1')
  await once(servidor, 'listening')
  return {
    url: `redis://127.0.0.1:${(servidor.address() as AddressInfo).port}`,
    fechar: () => {
      for (const conexao of conexoes) conexao.destroy()
      servidor.close()
    },
  }
}

describe('criarClienteRedisDaFila', () => {
  const abertos: Array<() => void> = []

  afterEach(() => {
    for (const fechar of abertos.splice(0)) fechar()
  })

  it('com o Redis fora, ou aceitando a conexão sem ficar pronto, o comando falha na hora, sem esperar numa fila', async () => {
    // Porta sem ninguém escutando.
    const fora = createQueueRedisClient('redis://127.0.0.1:1', 'teste', () => undefined)
    const semAperto = await redisTravado(false)
    const semFicarPronto = createQueueRedisClient(semAperto.url, 'teste', () => undefined)
    abertos.push(() => {
      fora.disconnect()
      semFicarPronto.disconnect()
      semAperto.fechar()
    })
    await once(semFicarPronto, 'connect')

    const inicio = performance.now()
    await expect(fora.ping()).rejects.toThrow()
    await expect(semFicarPronto.ping()).rejects.toThrow("Stream isn't writeable")
    expect(performance.now() - inicio).toBeLessThan(500)
  })

  it('com o Redis travado, o comando desiste no prazo da fila', async () => {
    const travado = await redisTravado(true)
    const cliente = createQueueRedisClient(travado.url, 'teste', () => undefined)
    abertos.push(() => {
      cliente.disconnect()
      travado.fechar()
    })
    await once(cliente, 'ready')

    const inicio = performance.now()
    await expect(cliente.ping()).rejects.toThrow('Command timed out')
    const desistiuEmMs = performance.now() - inicio
    expect(desistiuEmMs).toBeGreaterThanOrEqual(TIMEOUT_COMANDO_REDIS_FILA_MS - 50)
    expect(desistiuEmMs).toBeLessThan(TIMEOUT_COMANDO_REDIS_FILA_MS + 1_000)
  })
})
