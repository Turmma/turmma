import 'reflect-metadata'
import { ArquivoDoTitularRepository, currentContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import type { ConfiguracaoStorage } from '../src/config.js'
import { MedicaoDoArquivo } from '../src/medicao-do-arquivo.js'
import { montarWorker } from '../src/montagem.js'
import { BancadaDeFila, configuracaoDoBanco, janelaPadraoDoAmbiente, LogEmMemoria, urlRedisDeFila, vagasPadraoDoAmbiente } from './fila-de-teste.js'

// A medição `arquivo.horas_em_preparacao` (F3, tarefa 13.0; Tech Spec do F3, seção 7c) contra o Postgres do compose de teste, com a
// lista de escolas dada e o relógio injetado: as horas desde que o pedido de acesso mais antigo da escola foi registrado e ainda
// espera o arquivo. O alerta de 2 h em si, com o Prometheus e o Grafana, é `infra/test/alerta-do-arquivo.int.test.ts`.

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
const METRICA = 'arquivo.horas_em_preparacao'

describe('medição das horas do arquivo do titular em preparação', () => {
  const bancada = new BancadaDeFila()
  const log = new LogEmMemoria('worker-teste')

  afterAll(async () => {
    await bancada.fechar()
  })

  /** Um pedido de acesso (ou o tipo dado) da escola, registrado `horasAtras` antes do `AGORA`, no estado dado. */
  async function pedido(escolaId: string, horasAtras: number, estado: 'em_preparacao' | 'pronto' | 'concluido' | 'recebido' = 'em_preparacao', tipo = 'acesso'): Promise<void> {
    const { rows: alunos } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Aluno sintético do arquivo') returning id", [escolaId])
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`coordenacao-${randomUUID()}@arquivo.invalid`])
    const { rows: equipe } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética do arquivo', $2) returning id",
      [escolaId, contas[0]?.id],
    )
    await bancada.pool.query(
      `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, registrado_em, chave_envio, concluido_em, concluido_por)
       values ($1, $2, 'aluno', $3, 'titular', current_date, $4::text, '[]'::jsonb, $5::uuid, $6::timestamptz - $7::numeric * interval '1 hour', $8,
               case when $4::text = 'concluido' then $6::timestamptz end, case when $4::text = 'concluido' then $5::uuid end)`,
      [escolaId, alunos[0]?.id, tipo, estado, equipe[0]?.id, AGORA.toISOString(), horasAtras, randomUUID()],
    )
  }

  function medicaoDe(ids: readonly string[], medidor: MedidorDeTeste, repositorio: Pick<ArquivoDoTitularRepository, 'registradoEmDoEmPreparacaoMaisAntigo'> = new ArquivoDoTitularRepository(bancada.banco)): MedicaoDoArquivo {
    return new MedicaoDoArquivo({ escolas: { listarIds: () => Promise.resolve([...ids]) }, repositorio, relogio, logger: log.logger, medidor: medidor.medidor })
  }

  async function porEscola(medidor: MedidorDeTeste): Promise<Record<string, unknown>> {
    return Object.fromEntries((await medidor.pontos(METRICA)).map(({ atributos, valor }) => [String(atributos['escola_id']), valor]))
  }

  it('a série é a idade do pedido mais antigo em preparação: 1 h, 3 h, o mais antigo entre dois, e o pronto, o concluído e a escola sem pedido ficam sem série', async () => {
    const [a, b, c, d, e, f] = [await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola(), await bancada.escola()]
    await pedido(a, 1)
    await pedido(b, 3)
    // C: um velho pronto e um novo em preparação: vale o novo.
    await pedido(c, 50, 'pronto')
    await pedido(c, 2)
    // D: dois em preparação, o mais antigo vale; E: só um concluído e um recebido (o tipo que não gera arquivo).
    await pedido(d, 0.5)
    await pedido(d, 5)
    await pedido(e, 40, 'concluido')
    await pedido(e, 30, 'recebido', 'compartilhamento')
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    await medicaoDe([a, b, c, d, e, f], medidor).medir()
    const pontos = await medidor.pontos(METRICA)
    expect(await porEscola(medidor)).toEqual({ [a]: 1, [b]: 3, [c]: 2, [d]: 5 })
    // A série traz a escola e o número: nenhum outro rótulo.
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
    const real = new ArquivoDoTitularRepository(bancada.banco)
    const falhaEmB: Pick<ArquivoDoTitularRepository, 'registradoEmDoEmPreparacaoMaisAntigo'> = {
      registradoEmDoEmPreparacaoMaisAntigo: () => (currentContext()?.escolaId === b ? Promise.reject(new Error('banco lento')) : real.registradoEmDoEmPreparacaoMaisAntigo()),
    }
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const avisosAntes = log.doEvento('worker.medicao_do_arquivo_indisponivel').length
    await medicaoDe([a, b], medidor, falhaEmB).medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 4 })
    expect(log.doEvento('worker.medicao_do_arquivo_indisponivel').length).toBeGreaterThan(avisosAntes)
  })

  it('ficar pronto tira a série na volta seguinte', async () => {
    const a = await bancada.escola()
    await pedido(a, 3)
    const medidor = new MedidorDeTeste()
    onTestFinished(() => medidor.encerrar())
    const medicao = medicaoDe([a], medidor)
    await medicao.medir()
    expect(await porEscola(medidor)).toEqual({ [a]: 3 })
    await bancada.pool.query(`update pedido_titular set estado = 'pronto' where escola_id = $1`, [a])
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
