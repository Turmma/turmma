import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { Despachante } from '../src/outbox-relay.js'
import { MedicaoDaFila } from '../src/queue-gauge.js'
import { Reconciliacao } from '../src/outbox-sweeper.js'
import { montarDespachante, TETO_DA_ESPERA_DO_REDIS_MS } from '../src/composition.js'
import { BancadaDeFila, configuracaoDoBanco, janelaPadraoDoAmbiente, LogEmMemoria, vagasPadraoDoAmbiente } from '../../worker/test/queue.fixture.js'

// O `pronto` da montagem e o embrulho da bancada, da correção
// `2026-09-16-rodada-antes-do-redis-do-despachante`. A corrida que causou o defeito (conexão do Redis
// contra consulta ao Postgres) não é determinística; estes contratos são, e são eles que impedem a
// volta dela. Cada teste aqui fica vermelho quando a linha que ele guarda é removida.

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas e as vagas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('o `pronto` da montagem do despachante', () => {
  let bancada: BancadaDeFila
  // Escolas reais, criadas a cada caso: desde a tarefa 3.0 `job_registro` e
  // `configuracao_operacional_escola` têm FK para `escola`, e id inventado é recusado pelo banco.
  let ESCOLA_A: string

  beforeEach(async () => {
    bancada = new BancadaDeFila()
    await bancada.limparRegistro()
    ESCOLA_A = await bancada.escola()
  })

  afterEach(async () => {
    await bancada.fechar()
  })

  /** Uma porta que ninguém atende: o `connect` é recusado na hora, como um Redis fora de verdade. */
  async function portaSemNinguem(): Promise<number> {
    const servidor = createServer()
    await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver))
    const { port } = servidor.address() as AddressInfo
    await new Promise<void>((resolver) => servidor.close(() => resolver()))
    return port
  }

  it('com o Redis de pé, resolve pelo `ready` sem pagar o teto, e a rodada alcança o Redis e publica', async () => {
    // A espera medida é o vermelho de quem tirar o `redis.on('ready')`: sem ele só sobra o teto.
    // O job enfileirado é o que impede a asserção de passar de graça: sem linha `aguardando`, a
    // rodada volta na consulta ao Postgres e nunca chega a emitir comando de Redis.
    const id = await bancada.enfileirar(ESCOLA_A, { fila: 'interativa' })
    const log = new LogEmMemoria('despachante')
    const montado = bancada.despachante(log)

    const comecou = Date.now()
    await montado.pronto
    expect(Date.now() - comecou).toBeLessThan(TETO_DA_ESPERA_DO_REDIS_MS / 2)
    // Não só pelo relógio: a margem do limite é estreita perto do `commandTimeout` de 2 s do cliente,
    // e nomear o ramo torna a falsificação independente do tempo.
    expect(log.doEvento('despachante.redis_sem_resposta_na_montagem')).toEqual([])

    // Publicar é a prova de que a rodada alcançou o Redis. Aqui não se afirma a primeira rodada, e
    // sim que ela publica: `pronto` também resolve no `error`, e um erro transitório na conexão com
    // o Redis de pé (o `info` estourando o `commandTimeout` num runner carregado) deixaria o cliente
    // reconectando. Exigir a primeira seria trocar uma intermitência por outra.
    await expect
      .poll(
        async () => {
          await montado.despachante.rodada()
          return (await bancada.estado(id))?.estado
        },
        { timeout: 10_000, interval: 100 },
      )
      .toBe('publicado')
  })

  it('borda: com o Redis fora, resolve pelo erro do cliente, e não esperando o teto', async () => {
    // Sem isto, tirar o `redis.on('error')` da montagem ficaria invisível: todo teste de Redis fora
    // passaria a pagar o teto calado, e a suíte seguiria verde.
    const log = new LogEmMemoria('despachante-sem-redis')
    const montado = montarDespachante(
      {
        banco: configuracaoDoBanco(),
        redisFilaUrl: `redis://127.0.0.1:${await portaSemNinguem()}`,
        vagasPadrao: vagasPadraoDoAmbiente(),
        janelaPadrao: janelaPadraoDoAmbiente(),
      },
      log.logger,
      { prefixo: `teste-${randomUUID()}` },
    )

    try {
      const comecou = Date.now()
      await montado.pronto
      const esperou = Date.now() - comecou

      expect(esperou).toBeLessThan(TETO_DA_ESPERA_DO_REDIS_MS / 2)
      // Nomeia o ramo que resolveu, em vez de deduzi-lo do relógio.
      expect(log.doEvento('despachante.redis_indisponivel').length).toBeGreaterThan(0)
      expect(log.doEvento('despachante.redis_sem_resposta_na_montagem')).toEqual([])
    } finally {
      // No caminho vermelho, sem isto sobra cliente reconectando contra porta morta e pool aberto
      // até o fim do arquivo, e o barulho encobre a mensagem da falha.
      await montado.encerrar()
    }
  })

  it('a bancada entrega as três portas embrulhadas: quem montar sem embrulhar cai aqui', async () => {
    // Guarda do ponto de ligação. O contrato do embrulho em si está em
    // `apps/worker/test/wait-for-redis.test.ts`; aqui prova-se que a bancada de fato o aplica.
    const medidor = new MedidorDeTeste()
    try {
      const montado = bancada.despachante(new LogEmMemoria('despachante'), { medidor: medidor.medidor })

      expect(montado.despachante.rodada).not.toBe(Despachante.prototype.rodada)
      expect(montado.reconciliacao.reconciliar).not.toBe(Reconciliacao.prototype.reconciliar)
      // `toBeDefined` antes: sem ele, a montagem que parasse de criar a medição passaria de graça.
      expect(montado.medicao).toBeDefined()
      expect(montado.medicao?.medir).not.toBe(MedicaoDaFila.prototype.medir)
    } finally {
      await medidor.encerrar()
    }
  })
})
