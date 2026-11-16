import { runInContext, turnoDoTutor, mensagemTutor, type DatabaseTransaction, type InProcessAgenteExecutor, type LLMProvider, type OrcamentoDeIa, type RequestContext, type SuspensaoDeFuncao } from '@educa/core'
import { TROCAS_POR_DIA_PADRAO_DO_TUTOR, type PapelDeUsuario, type ResultadoGravado } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-turma.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { subirApi, type TestApi } from '../../test/test-api.js'
import type { ExecucaoCommand, Preparado } from './execucao-command.js'
import { ExecucaoScheduler, type ExecucaoComComando } from './execucao.scheduler.js'
import { EXECUTOR_DE_AGENTE, LLM_PROVIDER, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO } from './ia.module.js'
import { RegistroDeComandos } from './registro-de-comandos.js'

type TutorInput = Parameters<typeof turnoDoTutor.falso>[0]
type TutorOutput = Awaited<ReturnType<typeof turnoDoTutor.falso>>

/**
 * O pedido acima do teto de entrada, com a API, o banco e o gateway de verdade (reengenharia-continuacao, 4.0; `techspec.md` §8). O teto da tarefa é
 * rebaixado na definição que um **comando de teste** leva ao gateway (`comoExecutavel` passa `comando.tarefa` ao `ia.gerar`, depois da 2.0):
 * a entrada passa pelo esquema, e quem recusa é o gateway, antes do orçamento e do envio. Cada definição tem o registro e o agendador dela
 * (o registro recusa a mesma tarefa duas vezes), e o modelo é o `LLM_PROVIDER` da app, que é o gateway montado com o medidor.
 *
 * O arquivo **não prova alcance nem escopo**: o comando de teste devolve `alunoId` e `turmaId` fixos no `preparar` e não passa pela checagem de alcance do
 * `TurnoDoTutorCommand` real. Ninguém conta com ele como cobertura de isolamento entre escolas; o que ele prova é a recusa pelo teto, no gateway.
 */
describe('o turno do Tutor acima do teto de entrada', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let executor: InProcessAgenteExecutor
  let a: EscolaComTurma & { escolaId: string; aluno: TestSessao; outroAluno: TestSessao }

  const sql = (texto: string, valores: unknown[] = []) => bancada.pool.query(texto, valores)
  const como = <T>(sessao: TestSessao, papel: PapelDeUsuario, funcao: () => T): T => {
    const contexto: RequestContext = { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId: a.anoLetivoId }
    return runInContext(contexto, funcao)
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
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

  /**
   * O pedido do Tutor pelo comando de teste da definição dada, com o agendador dele: a pergunta do aluno gravada com a execução (o `aoGravar`) e,
   * ao concluir, a resposta do Tutor: a mesma forma do `POST` do Tutor. O comando real não serve: a `tarefa` dele é fixa e o `preparar` exige o alcance inteiro.
   * O agendador usa `bancada.banco` de propósito: é o mesmo Postgres de teste que a app usa, e não um caminho de gravação fora do escopo da app (o escopo vem do contexto
   * que o `como(...)` monta, como na requisição).
   */
  function pedidoDoTutor(tarefa: typeof turnoDoTutor, duvida: string, aluno: TestSessao) {
    const concluir = vi.fn(async (saida: TutorOutput, _lido: null, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> => {
      const [mensagem] = await tx
        .insert(mensagemTutor)
        .values({ escolaId: a.escolaId, anoLetivoId: a.anoLetivoId, turmaId: a.turma, alunoId: aluno.usuarioId, execucaoId, autor: 'tutor', tipo: 'texto', texto: saida.resposta, citacoes: saida.citacoes })
        .returning({ id: mensagemTutor.id })
      return { tipo: 'mensagem_do_tutor', mensagemId: mensagem?.id ?? '' }
    })
    const comando: ExecucaoCommand<TutorInput, TutorOutput, null> = {
      tarefa,
      fila: 'interativa',
      // Atalho deliberado: ignora a `ExecucaoLida` (o agendador já a releu no escopo, para todo comando) e não relê a pergunta nem repete o alcance, como o `TurnoDoTutorCommand` faz.
      // A recusa vem do gateway, antes do orçamento e do envio, e é só ela que este arquivo prova.
      preparar: async (): Promise<Preparado<TutorInput, null>> => ({
        entrada: { duvida, contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], memoria: [], turnosAnteriores: [] },
        lido: null,
        alunoId: aluno.usuarioId,
        turmaId: a.turma,
      }),
      concluir,
    }
    const registro = new RegistroDeComandos()
    registro.registrar(comando)
    const agendador = new ExecucaoScheduler(bancada.banco, api.app.get<LLMProvider>(LLM_PROVIDER), executor, api.app.get<SuspensaoDeFuncao>(SUSPENSAO_DE_FUNCAO), registro)
    const pedido: ExecucaoComComando = {
      comando: 'turno_do_tutor',
      chaveEnvio: randomUUID(),
      entradaDaExecucao: { tarefa: 'turno_do_tutor' },
      aoGravar: async (tx, execucaoId) => {
        await tx.insert(mensagemTutor).values({ escolaId: a.escolaId, anoLetivoId: a.anoLetivoId, turmaId: a.turma, alunoId: aluno.usuarioId, execucaoId, autor: 'aluno', texto: duvida })
      },
    }
    return { pedido, agendador, concluir }
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

    const { pedido, agendador, concluir } = pedidoDoTutor({ ...turnoDoTutor, maximoDeTokensDeEntrada: 1 }, 'como eu acho o reagente limitante?', a.aluno)
    const { execucaoId } = await como(a.aluno, 'aluno', () => agendador.agendar(pedido))
    await executor.ociosa()

    const { rows } = await sql('select estado, erro, resultado from execucao_agente where id = $1', [execucaoId])
    expect(rows).toEqual([{ estado: 'falhou', erro: 'PEDIDO_ACIMA_DO_TETO', resultado: null }])
    expect(concluir).not.toHaveBeenCalled()
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
    const { pedido, agendador, concluir } = pedidoDoTutor(turnoDoTutor, 'como eu acho o reagente limitante?', a.outroAluno)
    const { execucaoId } = await como(a.outroAluno, 'aluno', () => agendador.agendar(pedido))
    await executor.ociosa()
    const { rows } = await sql('select estado, erro from execucao_agente where id = $1', [execucaoId])
    expect(rows).toEqual([{ estado: 'concluida', erro: null }])
    expect(concluir).toHaveBeenCalledTimes(1)
  })
})
