import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { SemaforoDeHash } from '../src/credencial/index.js'
import { subirApi, type ApiDeTeste } from './api-com-sessao.js'

/**
 * O limite por IP vem antes do pipe da entrada (reengenharia, 16.0, RF5; regra 80, item 1): o corpo fora do esquema
 * conta no balde do IP da rota anônima e no da operação, como contava quando o controller fazia o `safeParse`. O Nest
 * roda a guarda antes dos pipes, e este teste prova que a migração para `@Body(new ZodValidationPipe(…))` não tirou o
 * pedido inválido da contagem: o inválido de um IP não segura o outro, e o do IP acima do limite é recusado sem ser lido.
 */

const LIMITE_POR_IP = 5

describe('o corpo fora do esquema conta no balde do IP, como antes do pipe', () => {
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_IP_ANONIMO_MIN: String(LIMITE_POR_IP), LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } })
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

  it.each(['/v1/convites/consultar', '/v1/operacao/convite/consultar'])('%s: o corpo inválido gasta o limite do IP: a sexta recusa é 429 LIMITE_EXCEDIDO, e o outro IP continua lendo o corpo', async (caminho) => {
    const [ip, outro] = [ipSorteado(), ipSorteado()]
    for (let vez = 1; vez <= LIMITE_POR_IP; vez++) expect(await postar(caminho, {}, ip), `${caminho} vez ${String(vez)}`).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
    expect(await postar(caminho, {}, ip)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    // Acima do limite nem o corpo válido é lido: a guarda recusa antes do pipe e do service.
    expect(await postar(caminho, { token: 'x'.repeat(43) }, ip)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    expect(await postar(caminho, {}, outro)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
  })

  it.each([
    ['/v1/sessao/email', 'equipe', (email: string) => ({ email, senha: 'senha-errada-0123456' })],
    ['/v1/sessao/matricula', undefined, () => ({ slug: `escola-${randomUUID().slice(0, 8)}`, matricula: `m${randomUUID().slice(0, 12)}`, senha: 'senha-errada-0123456' })],
    ['/v1/operacao/sessao/email', 'equipe', (email: string) => ({ email, senha: 'senha-errada-0123456' })],
  ] as const)('%s: o corpo inválido conta no balde do IP, e a tentativa válida que vem depois sai rebaixada no semáforo do hash, nunca em 429', async (caminho, balde, valido) => {
    const [ip, outro] = [ipSorteado(), ipSorteado()]
    const semaforo = api.app.get(SemaforoDeHash)
    const vezes = vi.spyOn(semaforo, 'executar')
    try {
      for (let vez = 1; vez <= 2 * LIMITE_POR_IP; vez++) expect(await postar(caminho, {}, ip), `${caminho} vez ${String(vez)}`).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
      expect(vezes).not.toHaveBeenCalled()

      const email = `ninguem-${randomUUID()}@turmma.invalid`
      expect((await postar(caminho, valido(email), ip)).status).toBe(401)
      expect(vezes.mock.calls.map(([passada]) => passada.rebaixado)).toEqual([true])
      expect((await postar(caminho, valido(email), outro)).status).toBe(401)
      expect(vezes.mock.calls.map(([passada]) => passada.rebaixado)).toEqual([true, false])
      if (balde !== undefined) expect(vezes.mock.calls.map(([passada]) => passada.id)).toEqual([balde, balde])
    } finally {
      vezes.mockRestore()
    }
  })
})
