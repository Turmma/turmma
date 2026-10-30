import { createApiRedisClient, createQueueRedisClient, DomainException } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../../tools/ci/compose.ts'
import { travarRedis } from '../../../../tools/testes/redis-travado.ts'
import { ConsumoDeDesafio, EmissorDeDesafio, PREFIXO_DESAFIO_USADO, verificarDesafio } from './desafio.js'

const CHAVE = new TextEncoder().encode('chave-de-teste-da-assinatura-com-32-bytes')
const CONTA = '0190f5a0-0000-7000-8000-0000000000c1'
const URL_REDIS_FILA = `redis://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'REDIS_FILA_PORTA_HOST')}`

async function pronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 10_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o Redis de fila de teste não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

describe('ConsumoDeDesafio: o jti vale uma vez só, no Redis de fila', () => {
  let cliente: Redis

  beforeAll(async () => {
    // O cliente de produção da API desiste em 100 ms de propósito, para o login cair no seguro em memória e não
    // travar. Aqui o que se prova é o script no Redis, e no runner carregado da esteira uma resposta passou dos
    // 100 ms e caiu no seguro (correção 2026-09-18-contador-testado-com-o-prazo-de-producao). O cliente da fila é o
    // mesmo, sem fila offline, com prazo de 2 s. A queda com o Redis fora é provada pelos testes que usam o cliente de
    // produção de propósito, e o Redis travado (conectado, sem responder) pelo teste de `CLIENT PAUSE` no fim do arquivo.
    cliente = createQueueRedisClient(URL_REDIS_FILA, 'teste-desafio', () => undefined)
    await pronto(cliente)
  })

  afterAll(() => {
    cliente.disconnect()
  })

  it('concorrência: duas conclusões da mesma etapa ao mesmo tempo, com o mesmo desafio, passam uma vez só', async () => {
    const desafio = await verificarDesafio(await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false }), CHAVE, ['mfa'])
    const consumo = new ConsumoDeDesafio(cliente)
    const resultados = await Promise.allSettled([consumo.consumir(desafio), consumo.consumir(desafio)])
    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(1)
    const [recusa] = resultados.flatMap((resultado) => (resultado.status === 'rejected' ? [resultado.reason as unknown] : []))
    expect(recusa).toBeInstanceOf(DomainException)
    expect(recusa).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    // A marca vence com o desafio: não fica no Redis depois de 5 min.
    const vida = await cliente.pttl(`${PREFIXO_DESAFIO_USADO}${desafio.jti}`)
    expect(vida).toBeGreaterThan(0)
    expect(vida).toBeLessThanOrEqual(5 * 60_000)
  })

  it('falha: com o Redis de fila fora, o desafio é recusado, e não aceito sem marca', async () => {
    const fora = createApiRedisClient('redis://127.0.0.1:9', 'teste-desafio-fora', () => undefined)
    try {
      const desafio = await verificarDesafio(await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'escolher', mfaCumprido: false }), CHAVE, ['escolher'])
      const consumo = new ConsumoDeDesafio(fora)
      await expect(consumo.consumir(desafio)).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
      await expect(consumo.conferirLivre(desafio)).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
      // A recusa pelo Redis entra no sinal do seguro (15.5).
      expect(consumo.proporcaoDoSeguro).toBe(1)
    } finally {
      fora.disconnect()
    }
  })

  it('falha (15.5): Redis de fila travado, com a conexão aberta; o desafio é recusado no corte dos 100 ms, com o aviso `login.desafio_sem_redis` uma vez só e o sinal de seguro em 1, e o desafio bom continua valendo depois', async () => {
    // O cliente de produção da API, de propósito: o que se prova é o corte dos 100 ms.
    const producao = createApiRedisClient(URL_REDIS_FILA, 'teste-desafio-travado', () => undefined)
    const avisos = vi.spyOn(Logger.prototype, 'warn')
    try {
      await pronto(producao)
      const consumo = new ConsumoDeDesafio(producao)
      const emitir = async () => verificarDesafio(await new EmissorDeDesafio(CHAVE).emitir({ contaId: CONTA, etapa: 'mfa', mfaCumprido: false }), CHAVE, ['mfa'])
      const noTravamento = await emitir()
      avisos.mockClear()

      const travado = await travarRedis(URL_REDIS_FILA, 3_000)
      await expect(consumo.conferirLivre(noTravamento)).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
      await expect(consumo.consumir(noTravamento)).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
      expect(producao.status).toBe('ready')
      expect(consumo.proporcaoDoSeguro).toBe(1)
      // Uma linha só para as duas recusas, e só o evento: nada do desafio, da conta ou da pessoa.
      expect(avisos.mock.calls).toEqual([['login.desafio_sem_redis']])

      await travado.fim
      // Com a pausa acabada, o Redis ainda esvazia o que reteve e a máquina da esteira pode demorar: a primeira resposta pode passar dos
      // 100 ms e o desafio ser recusado no corte, que é o que a API deve fazer. Um desafio novo na primeira tentativa não prova que o
      // Redis voltou: foi o que oscilou na esteira 39803274227 (correção 2026-10-22-intermitentes-desafio-e-meus-dados). Por isso espera-se,
      // com um desafio novo a cada tentativa, que um seja aceito; e a recusa, enquanto não vem, tem de ser a do Redis, e não outra.
      await expect
        .poll(
          async () =>
            consumo.consumir(await emitir()).then(
              () => 'aceito',
              (erro: unknown) => (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_AUTENTICADO ? 'recusado' : `outra recusa: ${String(erro)}`),
            ),
          { timeout: 5_000, interval: 100 },
        )
        .toBe('aceito')
      expect(consumo.proporcaoDoSeguro).toBeLessThan(1)
    } finally {
      avisos.mockRestore()
      producao.disconnect()
    }
  })
})
