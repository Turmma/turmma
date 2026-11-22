import { JobOutbox, JobOutboxRepository, runInContext } from '@educa/core'
import { TIPO_EXECUTAR_LOTE } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { FilaDeIa, TIPOS_DE_JOB_DE_IA } from './fila-de-ia.fixture.js'
import { dispararExecucao, execucaoTerminada, montarEscolaComAssistente, zerarLimiteDePedidosDeIa, type EscolaComAssistente } from './escola-assistente.fixture.js'
import { aplicarAtividade, citacaoDoPrimeiroTrecho, fakeModelEnv, startFakeModel, type FakeModel } from './escola-tutor.fixture.js'
import { SessaoFixtures } from './sessao.fixture.js'

/**
 * Os testes de integração de um mesmo banco rodam um arquivo por vez, e `job_registro` não é esvaziado entre eles. O job de IA que um arquivo
 * deixa `aguardando` (a extração do PDF agenda a classificação em lote; uma bancada sem consumo grava e não consome) seria publicado pelo
 * despachante da bancada **seguinte** e rodaria no worker dela, contra o modelo de mentira dela: o `tutor-modelo` contou 17 pedidos onde esperava 2.
 * A bancada que liga o consumo não herda a fila de outro arquivo.
 */
describe('A bancada de IA não herda o job que outro arquivo deixou na fila', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let modelo: FakeModel
  let deixou: FilaDeIa
  let seguinte: FilaDeIa | undefined
  let a: EscolaComAssistente
  let atividade: string

  const naQuestao = () => ({ atividadeAplicadaId: atividade, questao: 3 })
  const obediente = (pedido: string): string => JSON.stringify({ classificacao: 'normal', resposta: 'Vamos por partes. O que o enunciado pede que você descubra?', citacoes: citacaoDoPrimeiroTrecho(pedido) })
  const estadoDa = async (execucaoId: string): Promise<string | undefined> => (await bancada.pool.query<{ estado: string }>('select estado from execucao_agente where id = $1', [execucaoId])).rows[0]?.estado
  /** Os estados dos jobs de IA da execução (`ia.executar` do Tutor, `ia.executar-lote` da rotina): vazio é job que não existe mais. Os tipos vão escritos aqui, e não da lista do fixture: o teste que confere a lista não pode ler dela. */
  const jobDa = async (execucaoId: string): Promise<string[]> =>
    (await bancada.pool.query<{ estado: string }>(`select estado from job_registro where tipo in ('ia.executar', 'ia.executar-lote') and dados ->> 'execucaoId' = $1`, [execucaoId])).rows.map((linha) => linha.estado)
  /** O job do lote como a rotina das 19h o grava (`classificacao.int.test.ts`): a execução `classificar_secoes` sem pessoa e sem ano, e o job na fila `lote`, pelo outbox. */
  const deixarOLote = async (bancadaQueGrava: FilaDeIa): Promise<string> => {
    const { rows } = await bancada.pool.query<{ id: string }>(
      "insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, $3) returning id",
      [a.escolaId, randomUUID(), JSON.stringify({ tarefa: 'classificar_secoes' })],
    )
    const execucaoId = rows[0]?.id ?? ''
    const outbox = new JobOutbox(new JobOutboxRepository(bancadaQueGrava.banco))
    await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () =>
      bancadaQueGrava.banco.transaction((tx) => outbox.enfileirarUmaVez(tx, TIPO_EXECUTAR_LOTE, { execucaoId }, execucaoId, { fila: 'lote' })),
    )
    return execucaoId
  }

  beforeAll(async () => {
    modelo = await startFakeModel()
    // O arquivo anterior: a bancada sem consumo grava o job de IA e termina sem ele ter rodado.
    deixou = await FilaDeIa.subir(medidor.medidor, { ambiente: fakeModelEnv(modelo) }, undefined, { semConsumir: true })
    a = await montarEscolaComAssistente(deixou.api, bancada)
    atividade = await aplicarAtividade(bancada, a)
  })

  afterAll(async () => {
    await seguinte?.fechar()
    await deixou.fechar().catch(() => undefined)
    await modelo.fechar()
    await bancada.pool.query('delete from job_registro where escola_id = $1 and tipo = any($2::text[])', [a.escolaId, TIPOS_DE_JOB_DE_IA])
    await bancada.pool.query('delete from mensagem_tutor where escola_id = $1', [a.escolaId])
    await bancada.pool.query('delete from consumo_ia where escola_id = $1', [a.escolaId])
    await bancada.pool.query('delete from execucao_agente where escola_id = $1', [a.escolaId])
    await bancada.fechar()
  })

  it('o job que ficou `aguardando` antes da bancada não roda nela, e o que nasce depois roda', async () => {
    await zerarLimiteDePedidosDeIa(deixou.api)
    const orfao = await dispararExecucao(deixou.api, a.aluno, '/v1/tutor/mensagens', { texto: 'não entendi o que é reagente limitante', ...naQuestao() })
    const lote = await deixarOLote(deixou)
    expect(await jobDa(orfao)).toEqual(['aguardando'])
    expect(await jobDa(lote)).toEqual(['aguardando'])
    await deixou.fechar()

    modelo.responder((pedido) => obediente(pedido))
    seguinte = await FilaDeIa.subir(medidor.medidor, { ambiente: fakeModelEnv(modelo) })
    // Os dois órfãos, o do Tutor e o do lote, já não estão na fila quando a bancada seguinte volta de `subir`: nada a esperar, e nenhum tempo de máquina em jogo.
    expect(await jobDa(orfao)).toEqual([])
    expect(await jobDa(lote)).toEqual([])
    // O controle: a bancada seguinte está viva e consome. Sem ele, "o órfão não rodou" também valeria para uma bancada que não consome.
    await zerarLimiteDePedidosDeIa(seguinte.api)
    const novo = await dispararExecucao(seguinte.api, a.aluno, '/v1/tutor/mensagens', { texto: 'não entendi o que é reagente limitante', ...naQuestao() })
    expect((await execucaoTerminada(seguinte.api, a.aluno, novo)).estado).toBe('concluida')

    expect(await estadoDa(orfao)).toBe('pendente')
    expect(await estadoDa(lote)).toBe('pendente')
    expect(modelo.pedidos).toHaveLength(1)
    await seguinte.fechar()
    seguinte = undefined
  }, 120_000)

  it('a segunda bancada do mesmo arquivo não apaga o job que a primeira, ainda de pé, gravou', async () => {
    const primeira = await FilaDeIa.subir(medidor.medidor, { ambiente: fakeModelEnv(modelo) }, undefined, { semConsumir: true })
    let segunda: FilaDeIa | undefined
    try {
      await zerarLimiteDePedidosDeIa(primeira.api)
      const gravado = await dispararExecucao(primeira.api, a.aluno, '/v1/tutor/mensagens', { texto: 'não entendi o que é reagente limitante', ...naQuestao() })
      expect(await jobDa(gravado)).toEqual(['aguardando'])
      segunda = await FilaDeIa.subir(medidor.medidor, { ambiente: fakeModelEnv(modelo) }, undefined, { semConsumir: true })
      expect(await jobDa(gravado)).toEqual(['aguardando'])
    } finally {
      await segunda?.fechar()
      await primeira.fechar()
    }
  }, 120_000)
})
