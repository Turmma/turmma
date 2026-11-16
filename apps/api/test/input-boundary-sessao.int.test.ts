import { RateLimiter } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { HashBulkhead } from '../src/credencial/index.js'
import { subirApi, type TestApi } from './test-api.js'

/**
 * O limite por IP vem antes do pipe da entrada (reengenharia, 16.0, RF5; regra 80, item 1): o corpo fora do esquema
 * conta no balde do IP da rota anônima e no da operação, como contava quando o controller fazia o `safeParse`. O Nest
 * roda a guarda antes dos pipes, e este teste prova que a migração para `@Body(new ZodValidationPipe(…))` não tirou o
 * pedido inválido da contagem: o inválido de um IP não segura o outro, e o do IP acima do limite é recusado sem ser lido.
 */

const LIMITE_POR_IP = 5
const TENTATIVAS_DE_AQUECIMENTO = 30

/** As rotas dos casos abaixo: o aquecimento do Redis do limite usa as mesmas listas, e uma rota nova entra nos dois ou em nenhum. */
const ROTAS_DE_CONSULTA = ['/v1/convites/consultar', '/v1/operacao/convite/consultar']
const ROTAS_DE_LOGIN = [
  ['/v1/sessao/email', 'equipe', (email: string) => ({ email, senha: 'senha-errada-0123456' })],
  ['/v1/sessao/matricula', undefined, () => ({ slug: `escola-${randomUUID().slice(0, 8)}`, matricula: `m${randomUUID().slice(0, 12)}`, senha: 'senha-errada-0123456' })],
  ['/v1/operacao/sessao/email', 'equipe', (email: string) => ({ email, senha: 'senha-errada-0123456' })],
] as const

describe('o corpo fora do esquema conta no balde do IP, como antes do pipe', () => {
  const medidor = new MedidorDeTeste()
  let api: TestApi

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_IP_ANONIMO_MIN: String(LIMITE_POR_IP), LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } })
    await aquecerORedisDoLimite()
  })

  afterAll(async () => {
    await api.app.close()
    await medidor.encerrar()
  })

  const ipSorteado = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`

  async function postar(caminho: string, corpo: unknown, ip: string): Promise<{ status: number; codigo: string | undefined }> {
    const resposta = await fetch(`${api.url}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify(corpo) })
    const corpoLido = (await resposta.json()) as { erro?: { codigo?: string } }
    return { status: resposta.status, codigo: corpoLido.erro?.codigo }
  }

  /**
   * Como `postar`, e cai com a causa escrita se o limitador respondeu pelo seguro em memória: o cliente do limite corta o
   * comando em 100 ms (a máquina ocupada no meio de um caso basta), e a chamada que caiu no seguro conta à parte e deixa
   * a sexta passar, o que apareceria como um 400 no lugar do 429, sem a causa.
   */
  async function postarContado(caminho: string, corpo: unknown, ip: string): Promise<{ status: number; codigo: string | undefined }> {
    const resposta = await postar(caminho, corpo, ip)
    expect(api.app.get(RateLimiter).seguroAtivo, `${caminho}: o Redis do limite não aqueceu`).toBe(0)
    return resposta
  }

  /**
   * O primeiro comando no Redis depois do boot passa dos 100 ms do cliente do limite quando a conexão ainda está fria ou
   * o script de contagem ainda não foi carregado (a primeira tentativa o carrega mesmo cortada pelo cliente, e por isso
   * esperar o `ready` não basta): o ponto cai no seguro em memória (regra 80, item 5). Cada rota recebe uma chamada de
   * um IP descartável, repetida enquanto o limitador responder pelo seguro, e o teste cai com a causa escrita se ele
   * não aquece. Os casos abaixo conferem o mesmo depois de cada chamada (`postarContado`).
   */
  async function aquecerORedisDoLimite(): Promise<void> {
    const limitador = api.app.get(RateLimiter)
    for (const caminho of [...ROTAS_DE_CONSULTA, ...ROTAS_DE_LOGIN.map(([rota]) => rota)]) {
      let tentativa = 0
      do {
        tentativa++
        await postar(caminho, {}, ipSorteado())
        if (limitador.seguroAtivo === 1) await new Promise((resolver) => setTimeout(resolver, 100))
      } while (limitador.seguroAtivo === 1 && tentativa < TENTATIVAS_DE_AQUECIMENTO)
      expect(limitador.seguroAtivo, `${caminho}: o Redis do limite não aqueceu`).toBe(0)
    }
  }

  it.each(ROTAS_DE_CONSULTA)('%s: o corpo inválido gasta o limite do IP: a sexta recusa é 429 LIMITE_EXCEDIDO, e o outro IP continua lendo o corpo', async (caminho) => {
    const [ip, outro] = [ipSorteado(), ipSorteado()]
    for (let vez = 1; vez <= LIMITE_POR_IP; vez++) expect(await postarContado(caminho, {}, ip), `${caminho} vez ${String(vez)}`).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
    expect(await postarContado(caminho, {}, ip)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    // Acima do limite nem o corpo válido é lido: a guarda recusa antes do pipe e do service.
    expect(await postarContado(caminho, { token: 'x'.repeat(43) }, ip)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    expect(await postarContado(caminho, {}, outro)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
  })

  it.each(ROTAS_DE_LOGIN)('%s: o corpo inválido conta no balde do IP, e a tentativa válida que vem depois sai rebaixada no semáforo do hash, nunca em 429', async (caminho, balde, valido) => {
    const [ip, outro] = [ipSorteado(), ipSorteado()]
    const semaforo = api.app.get(HashBulkhead)
    const vezes = vi.spyOn(semaforo, 'executar')
    try {
      for (let vez = 1; vez <= 2 * LIMITE_POR_IP; vez++) expect(await postarContado(caminho, {}, ip), `${caminho} vez ${String(vez)}`).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(vezes).not.toHaveBeenCalled()

      const email = `ninguem-${randomUUID()}@turmma.invalid`
      expect((await postarContado(caminho, valido(email), ip)).status).toBe(401)
      expect(vezes.mock.calls.map(([passada]) => passada.rebaixado)).toEqual([true])
      expect((await postarContado(caminho, valido(email), outro)).status).toBe(401)
      expect(vezes.mock.calls.map(([passada]) => passada.rebaixado)).toEqual([true, false])
      if (balde !== undefined) expect(vezes.mock.calls.map(([passada]) => passada.id)).toEqual([balde, balde])
    } finally {
      vezes.mockRestore()
    }
  })
})
