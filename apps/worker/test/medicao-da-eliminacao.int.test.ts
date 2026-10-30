import 'reflect-metadata'
import { currentContext, ExpurgoDaEscolaRepository } from '@educa/nucleo'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import type { ConfiguracaoStorage } from '../src/config.js'
import { MedicaoDaEliminacao } from '../src/medicao-da-eliminacao.js'
import { montarWorker } from '../src/montagem.js'
import { BancadaDeFila, configuracaoDoBanco, janelaPadraoDoAmbiente, LogEmMemoria, urlRedisDeFila, vagasPadraoDoAmbiente } from './fila-de-teste.js'

// A medição `eliminacao.horas_vencida` (F3, tarefa 15.0; Tech Spec do F3, seção 7c) contra o Postgres do compose de teste, com a
// lista de escolas dada e o relógio injetado: as horas desde que o pedido de eliminação `agendado` mais antigo da escola venceu
// (`eliminar_em`). O alerta de 48 h em si, com o Prometheus e o Grafana, é `infra/test/alerta-da-eliminacao.int.test.ts`.

const ambiente = lerAmbienteDeTeste()
const STORAGE: ConfiguracaoStorage = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}
const AGORA = new Date('2026-10-09T15:00:00-03:00')
const relogio = { agora: () => AGORA }
const METRICA = 'eliminacao.horas_vencida'

describe('medição das horas da eliminação do titular vencida', () => {
  const bancada = new BancadaDeFila()
  const log = new LogEmMemoria('worker-teste')

  afterAll(async () => {
    await bancada.fechar()
  })

  /** Um pedido de eliminação da escola, que venceu `horasAtras` antes do `AGORA` (negativo: ainda no prazo, daqui a tantas horas do relógio do banco, que é o que o filtro de vencido usa), no estado dado. */
  async function pedido(escolaId: string, horasAtras: number, estado: 'agendado' | 'concluido' | 'cancelado' = 'agendado'): Promise<void> {
    const { rows: alunos } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Aluno sintético da eliminação') returning id", [escolaId])
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`coordenacao-${randomUUID()}@eliminacao.invalid`])
    const { rows: equipe } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética da eliminação', $2) returning id",
      [escolaId, contas[0]?.id],
    )
    await bancada.pool.query(
      `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, compartilhamento, registrado_por, chave_envio,
                                   concluido_em, concluido_por, cancelado_em, cancelado_por)
       values ($1, $2, 'aluno', 'eliminacao', 'titular', current_date, $3::text,
               case when $5::numeric < 0 then now() - $5::numeric * interval '1 hour' else $4::timestamptz - $5::numeric * interval '1 hour' end, '[]'::jsonb, $6::uuid, $7,
               case when $3::text = 'concluido' then now() end, case when $3::text = 'concluido' then $6::uuid end,
               case when $3::text = 'cancelado' then now() end, case when $3::text = 'cancelado' then $6::uuid end)`,
      [escolaId, alunos[0]?.id, estado, AGORA.toISOString(), horasAtras, equipe[0]?.id, randomUUID()],
    )
  }

  function medicaoDe(ids: readonly string[], medidor: MedidorDeTeste, repositorio: Pick<ExpurgoDaEscolaRepository, 'vencimentoDoAgendadoMaisAntigo'> = new ExpurgoDaEscolaRepository(bancada.banco)): MedicaoDaEliminacao {
    return new MedicaoDaEliminacao({ escolas: { listarIds: () => Promise.resolve([...ids]) }, repositorio, relogio, logger: log.logger, medidor: medidor.medidor })
  }

  async function porEscola(medidor: MedidorDeTeste): Promise<Record<string, unknown>> {
    return Object.fromEntries((await medidor.pontos(METRICA)).map(({ atributos, valor }) => [String(atributos['escola_id']), valor]))
  }

  it('a série é a idade do vencimento do agendado mais antigo: 1 h, 47 h, o mais antigo entre dois; o no prazo, o concluído, o cancelado e a escola sem pedido ficam sem série', async () => {
    const [a, b, c, d, e, f] = [await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola()]
    await pedido(a, 1)
    await pedido(b, 47)
    // C: um concluído velho e um agendado novo: vale o agendado.
    await pedido(c, 100, 'concluido')
    await pedido(c, 2)
    // D: dois vencidos, o mais antigo vale. E: só no prazo (vence daqui a 3 dias), concluído e cancelado.
    await pedido(d, 0.5)
    await pedido(d, 5)
    await pedido(e, -72)
    await pedido(e, 30, 'concluido')
    await pedido(e, 30, 'cancelado')
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    await medicaoDe([a, b, c, d, e, f], medidor).medir()
    const pontos = await medidor.pontos(METRICA)
    expect(await porEscola(medidor)).toEqual({ [a]: 1, [b]: 47, [c]: 2, [d]: 5 })
    // A série traz a escola e o número: nenhum pedido, nenhum titular.
    for (const { atributos } of pontos) expect(Object.keys(atributos)).toEqual(['escola_id'])
  })

  it('o pedido de B não aparece na série de A: cada escola mede o que é dela', async () => {
    const [a, b] = [await bancada.escola(), await bancada.escola()]
    await pedido(b, 6)
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    await medicaoDe([a, b], medidor).medir()
    expect(await porEscola(medidor)).toEqual({ [b]: 6 })
  })

  it('a escola que falha fica sem série nesta volta, e as outras são medidas', async () => {
    const [a, b] = [await bancada.escola(), await bancada.escola()]
    await pedido(a, 4)
    await pedido(b, 4)
    const real = new ExpurgoDaEscolaRepository(bancada.banco)
    const falhaEmB: Pick<ExpurgoDaEscolaRepository, 'vencimentoDoAgendadoMaisAntigo'> = {
      vencimentoDoAgendadoMaisAntigo: () => (currentContext()?.escolaId === b ? Promise.reject(new Error('banco lento')) : real.vencimentoDoAgendadoMaisAntigo()),
    }
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const avisosAntes = log.doEvento('worker.medicao_da_eliminacao_indisponivel').length
    await medicaoDe([a, b], medidor, falhaEmB).medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 4 })
    expect(log.doEvento('worker.medicao_da_eliminacao_indisponivel').length).toBeGreaterThan(avisosAntes)
  })

  it('concluir o pedido tira a série na volta seguinte', async () => {
    const a = await bancada.escola()
    await pedido(a, 3)
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const medicao = medicaoDe([a], medidor)
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 3 })
    await bancada.pool.query(`update pedido_titular set estado = 'concluido', concluido_em = now(), concluido_por = registrado_por where escola_id = $1`, [a])
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({})
  })

  it('montada no worker de lote: mede no boot as escolas do banco e para com o worker', async () => {
    const a = await bancada.escola()
    await pedido(a, 7)
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const worker = montarWorker(
      { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { lote: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE, janelaPadrao: janelaPadraoDoAmbiente() },
      log.logger,
      { prefixo: bancada.prefixo, relogio, agendamentos: [], medidor: medidor.medidor },
    )
    let encerrado = false
    onTestFinished(async () => {
      if (!encerrado) await worker.encerrar()
    })
    await expect.poll(async () => (await porEscola(medidor))[a], { timeout: 20_000, interval: 100 }).toBe(7)
    await worker.encerrar()
    encerrado = true
  })
})
