import { runInContext, turnoDoTutor, mensagemTutor, type DatabaseTransaction, type InProcessAgenteExecutor, type OrcamentoDeIa, type RequestContext } from '@educa/core'
import { TROCAS_POR_DIA_PADRAO_DO_TUTOR, type PapelDeUsuario, type ResultadoGravado } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-turma.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { subirApi, type TestApi } from '../../test/test-api.js'
import { ExecucaoScheduler, type ExecucaoRequest } from './execucao.scheduler.js'
import { EXECUTOR_DE_AGENTE, ORCAMENTO_DE_IA } from './ia.module.js'

type TutorInput = Parameters<typeof turnoDoTutor.falso>[0]
type TutorOutput = Awaited<ReturnType<typeof turnoDoTutor.falso>>

/**
 * O pedido acima do teto de entrada, com a API, o banco e o gateway de verdade (reengenharia-continuacao, 4.0; `techspec.md` §8). O teto da tarefa é
 * rebaixado na definição que o pedido leva: a entrada passa pelo esquema, e quem recusa é o gateway, antes do orçamento e do envio.
 */
describe('o turno do Tutor acima do teto de entrada', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let agendador: ExecucaoScheduler
  let executor: InProcessAgenteExecutor
  let a: EscolaComTurma & { escolaId: string; aluno: TestSessao; outroAluno: TestSessao }

  const sql = (texto: string, valores: unknown[] = []) => bancada.pool.query(texto, valores)
  const como = <T>(sessao: TestSessao, papel: PapelDeUsuario, funcao: () => T): T => {
    const contexto: RequestContext = { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId: a.anoLetivoId }
    return runInContext(contexto, funcao)
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    agendador = api.app.get(ExecucaoScheduler)
    executor = api.app.get<InProcessAgenteExecutor>(EXECUTOR_DE_AGENTE)
    const escola = await montarEscolaComTurma(api, bancada)
    const { escolaId } = escola.coordenacao
    const [aluno, outroAluno] = await bancada.sessoes(escolaId, { papel: 'aluno', quantidade: 2 })
    if (aluno === undefined || outroAluno === undefined) throw new Error('sessões de teste não criadas')
    for (const estudante of [aluno, outroAluno]) {
      await sql(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
        [escolaId, escola.anoLetivoId, estudante.usuarioId, escola.turma, escola.coordenacao.usuarioId],
      )
    }
    a = { ...escola, escolaId, aluno, outroAluno }
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    for (const tabela of ['consumo_ia', 'mensagem_tutor', 'execucao_agente', 'configuracao_operacional_escola']) {
      await sql(`delete from ${tabela} where escola_id = $1`, [a.escolaId])
    }
    await medidor.encerrar()
    await bancada.fechar()
  })

  /** O pedido do Tutor que grava a pergunta do aluno com a execução e, ao concluir, a resposta: a mesma forma do `POST` do Tutor. */
  function pedidoDoTutor(tarefa: typeof turnoDoTutor, duvida: string, aluno: TestSessao) {
    const aoConcluir = vi.fn(async (saida: TutorOutput, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> => {
      const [mensagem] = await tx
        .insert(mensagemTutor)
        .values({ escolaId: a.escolaId, anoLetivoId: a.anoLetivoId, turmaId: a.turma, alunoId: aluno.usuarioId, execucaoId, autor: 'tutor', tipo: 'texto', texto: saida.resposta, citacoes: saida.citacoes })
        .returning({ id: mensagemTutor.id })
      return { tipo: 'mensagem_do_tutor', mensagemId: mensagem?.id ?? '' }
    })
    const pedido: ExecucaoRequest<TutorInput, TutorOutput> = {
      tarefa,
      chaveEnvio: randomUUID(),
      entradaDaExecucao: { tarefa: 'turno_do_tutor' },
      entrada: { duvida, contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], memoria: [], turnosAnteriores: [] },
      alunoId: aluno.usuarioId,
      turmaId: a.turma,
      aoGravar: async (tx, execucaoId) => {
        await tx.insert(mensagemTutor).values({ escolaId: a.escolaId, anoLetivoId: a.anoLetivoId, turmaId: a.turma, alunoId: aluno.usuarioId, execucaoId, autor: 'aluno', texto: duvida })
      },
      aoConcluir,
    }
    return { pedido, aoConcluir }
  }

  /** `quantidade` perguntas do aluno ao Tutor hoje, cada uma com a execução dela, ainda não respondida. */
  async function perguntasAnteriores(quantidade: number): Promise<void> {
    await sql(
      `with novas as (
         insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
         select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, gen_random_uuid(), '{"tarefa":"turno_do_tutor"}' from generate_series(1, $5) returning id
       )
       insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto)
       select $1, $2, $4, $3, id, 'aluno', 'pergunta sintética' from novas`,
      [a.escolaId, a.anoLetivoId, a.aluno.usuarioId, a.turma, quantidade],
    )
  }

  const consulta = () => ({ funcao: 'tutor_com_o_aluno' as const, alunoId: a.aluno.usuarioId, turmaId: a.turma })
  const consultarEm = (orcamento: OrcamentoDeIa) => runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId }, () => orcamento.consultar(consulta()))
  const recusadasPorTeto = async (): Promise<number> =>
    (await medidor.pontos('ia.pedido_acima_do_teto')).filter((ponto) => ponto.atributos['tarefa'] === 'turno_do_tutor').reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)

  it('o turno recusado acima do teto termina falhou com o código, sem resposta nem consumo, e a pergunta não conta como troca do dia', async () => {
    const orcamento = api.app.get<OrcamentoDeIa>(ORCAMENTO_DE_IA)
    // Com 59 perguntas no dia, a 60ª ainda cabe: se a pergunta recusada contasse, a próxima já seria a 61ª.
    await perguntasAnteriores(TROCAS_POR_DIA_PADRAO_DO_TUTOR - 1)
    expect(await consultarEm(orcamento)).toEqual({ permitido: true })
    const antes = await recusadasPorTeto()

    const { pedido, aoConcluir } = pedidoDoTutor({ ...turnoDoTutor, maximoDeTokensDeEntrada: 1 }, 'como eu acho o reagente limitante?', a.aluno)
    const { execucaoId } = await como(a.aluno, 'aluno', () => agendador.agendar(pedido))
    await executor.ociosa()

    const { rows } = await sql('select estado, erro, resultado from execucao_agente where id = $1', [execucaoId])
    expect(rows).toEqual([{ estado: 'falhou', erro: 'PEDIDO_ACIMA_DO_TETO', resultado: null }])
    expect(aoConcluir).not.toHaveBeenCalled()
    // Nada foi ao modelo: nem linha de consumo, nem resposta do Tutor.
    expect(Number(((await sql('select count(*) as total from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])).rows as { total: string }[])[0]?.total)).toBe(0)
    expect(Number(((await sql(`select count(*) as total from mensagem_tutor where escola_id = $1 and execucao_id = $2 and autor = 'tutor'`, [a.escolaId, execucaoId])).rows as { total: string }[])[0]?.total)).toBe(0)
    // A pergunta do aluno ficou gravada (é o registro dele), e a execução falhou: a vez volta, e a 60ª ainda cabe.
    expect(Number(((await sql(`select count(*) as total from mensagem_tutor where escola_id = $1 and execucao_id = $2 and autor = 'aluno'`, [a.escolaId, execucaoId])).rows as { total: string }[])[0]?.total)).toBe(1)
    expect(await consultarEm(orcamento)).toEqual({ permitido: true })
    // A API montou o gateway com o medidor: a recusa foi contada na tarefa.
    expect((await recusadasPorTeto()) - antes).toBe(1)
  })

  it('o mesmo pedido com o teto da tarefa conclui: a recusa de cima veio do teto, e não de outra checagem', async () => {
    const { pedido, aoConcluir } = pedidoDoTutor(turnoDoTutor, 'como eu acho o reagente limitante?', a.outroAluno)
    const { execucaoId } = await como(a.outroAluno, 'aluno', () => agendador.agendar(pedido))
    await executor.ociosa()
    const { rows } = await sql('select estado, erro from execucao_agente where id = $1', [execucaoId])
    expect(rows).toEqual([{ estado: 'concluida', erro: null }])
    expect(aoConcluir).toHaveBeenCalledTimes(1)
  })
})
