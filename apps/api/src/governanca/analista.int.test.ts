import type { InProcessAgenteExecutor } from '@educa/core'
import { analistaNominalResponseSchema, resumoDoAnalistaResponseSchema, type ConteudoDoResumoDoAnalista } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from '../../test/test-api.js'
import {
  alunosComSessao,
  aplicarAtividade,
  aprovarOLote,
  criarAtividade,
  encerrarAtividade,
  HABILIDADE_DAS_DUAS_ULTIMAS,
  HABILIDADE_DAS_TRES_PRIMEIRAS,
  responderProva,
  rotasDaAtividade,
  type RotasDaAtividade,
} from '../../test/atividade.fixture.js'
import {
  contarNaEscola,
  dispararExecucao,
  execucaoTerminada,
  montarAnoAnterior,
  montarEscolaComAssistente,
  NOME_DA_PROFESSORA_DE_TESTE,
  NOME_DO_ALUNO_DE_TESTE,
  vincularProfessor,
  zerarLimiteDePedidosDeIa,
  type AnoAnterior,
  type EscolaComAssistente,
} from '../../test/escola-assistente.fixture.js'
import { aplicarAtividade as gravarAplicacao, lancarLote, trocasJaFeitas } from '../../test/escola-tutor.fixture.js'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../test/sessao.fixture.js'
import { TETO_DE_PEDIDOS_DE_IA_POR_USUARIO } from '../assistente/ai-request-rate-limit.js'
import { EXECUTOR_DE_AGENTE } from '../ia/ia.module.js'
import { LIMIAR_DE_ACERTO_BAIXO_PERCENTUAL } from './analista.service.js'

const TODAS_CERTAS = [0, 1, 2, 3, 0] as const
/** Acerta só a questão 2: uma de três na primeira habilidade, nenhuma de duas na segunda. */
const QUASE_TUDO_ERRADO = [1, 1, 0, 0, 1] as const
const NOME_DA_BIA = 'Aluna Sintética Bia Souza'

/**
 * O Analista de desempenho escolar (MVP, A5; D34, D45, D46, D64; regra 70, itens 7 a 9), pela rota, com o adaptador
 * falso. Na escola A, no 2º ano:
 *
 * - **Química tem duas professoras alocadas** (a do 2ºB e a colega do 2ºC). O lote do 2ºB está aprovado (Caio acertou
 *   tudo, Bia quase nada); o do 2ºC começa esperando a colega. Com uma só com lote aprovado, a Química não tem número.
 * - **Física tem uma professora só** (no 2ºB): o lote dela está aprovado, e mesmo assim o recorte não leva número.
 */
describe('Analista de desempenho escolar', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let executor: InProcessAgenteExecutor
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  let bia: SessaoDeTeste
  let alunoDoC: SessaoDeTeste
  /** A lista de Química do 2ºC, encerrada, com o lote ainda pendente. */
  let pendenteNoC: string

  const sql = async <Linha extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Linha[]> => (await bancada.pool.query(texto, valores)).rows as Linha[]
  const get = async (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, await sessao.tokenNovo())
  const post = async (sessao: SessaoDeTeste, caminho: string, corpo: unknown = {}): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, await sessao.tokenNovo(), corpo)
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  const ENTRADA_INVALIDA = { status: 400, codigo: 'ENTRADA_INVALIDA' }
  const FINALIDADE = 'conversa_pedagogica_a_pedido_do_professor'

  /** Gera o resumo pela rota, espera a execução e devolve o que `GET /v1/analista/resumo` passa a responder. */
  const gerar = async (escola: EscolaComAssistente): Promise<{ id: string; conteudo: ConteudoDoResumoDoAnalista; texto: string }> => {
    const execucao = await execucaoTerminada(api, escola.coordenacao, await dispararExecucao(api, escola.coordenacao, '/v1/analista/gerar', {}))
    expect(execucao).toMatchObject({ estado: 'concluida', erro: null, resultado: { tipo: 'resumo_do_analista' } })
    const resposta = await get(escola.coordenacao, '/v1/analista/resumo')
    const { resumo } = resumoDoAnalistaResponseSchema.parse(resposta.corpo)
    if (resumo === null) throw new Error('o resumo não foi gravado')
    expect(resumo.id).toBe(execucao.resultado?.['resumoId'])
    return { id: resumo.id, conteudo: resumo.conteudo, texto: JSON.stringify(resposta.corpo) }
  }
  const nominal = (sessao: SessaoDeTeste, turmaId: string, finalidade: string | null = FINALIDADE) =>
    get(sessao, `/v1/analista/nominal?turmaId=${turmaId}${finalidade === null ? '' : `&finalidade=${finalidade}`}`)
  /** O 2025 da escola A, criado uma vez só (o ano é único por escola) e usado por quem precisar dele. */
  let anoAnterior: AnoAnterior | undefined
  const anteriorDeA = async (): Promise<AnoAnterior> => (anoAnterior ??= await montarAnoAnterior(bancada, a))
  const leiturasNominais = (escola: EscolaComAssistente) =>
    sql<{ autor_usuario_id: string; entidade_id: string; depois: unknown; finalidade: string }>(`select autor_usuario_id, entidade_id, depois, finalidade from auditoria where escola_id = $1 and acao = 'analista.nominal_lido' order by id`, [escola.escolaId])

  /** Aplica a lista, os alunos respondem e a professora encerra: o lote nasce pendente. Devolve o id da aplicação. */
  const comLote = async (escola: EscolaComAssistente, professora: SessaoDeTeste, turmaId: string, disciplinaId: string, respostas: readonly (readonly [SessaoDeTeste, readonly number[]])[]): Promise<string> => {
    const id = await aplicarAtividade(rotas, professora, await criarAtividade(bancada, escola, { turmaId, disciplinaId }), turmaId)
    for (const [aluno, marcadas] of respostas) await responderProva(rotas, aluno, id, marcadas)
    if ((await encerrarAtividade(rotas, professora, id)) === null) throw new Error('o lote não nasceu')
    return id
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
    executor = api.app.get<InProcessAgenteExecutor>(EXECUTOR_DE_AGENTE)
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    ;[bia] = (await alunosComSessao(bancada, a, a.turma, [NOME_DA_BIA])) as [SessaoDeTeste]
    ;[alunoDoC] = (await alunosComSessao(bancada, a, a.outraTurma, ['Aluno Sintético do 2ºC'])) as [SessaoDeTeste]

    // Química, 2ºB: aprovado.
    const quimicaDoB = await comLote(a, a.professora, a.turma, a.quimica, [[a.aluno, TODAS_CERTAS], [bia, QUASE_TUDO_ERRADO]])
    await aprovarOLote(rotas, a.professora, quimicaDoB)
    // Química, 2ºC: esperando a colega.
    pendenteNoC = await comLote(a, a.colega, a.outraTurma, a.quimica, [[alunoDoC, QUASE_TUDO_ERRADO]])
    // Física, 2ºB: aprovado, de uma professora só.
    const fisicaDoB = await comLote(a, a.deFisica, a.turma, a.fisica, [[a.aluno, QUASE_TUDO_ERRADO]])
    await aprovarOLote(rotas, a.deFisica, fisicaDoB)

    // Sinais do Tutor no 2ºB: dois de trabalho e um de atenção humana, que não tem referência.
    for (const [tipo, atividade, questao] of [['travou', quimicaDoB, 3], ['travou', quimicaDoB, 4], ['atencao_humana', null, null]] as const) {
      await sql('insert into sinal_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, tipo, atividade_aplicada_id, questao) values ($1, $2, $3, $4, $5, $6, $7)', [a.escolaId, a.anoLetivoId, a.turma, bia.usuarioId, tipo, atividade, questao])
    }
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    await bancada.fechar()
  })

  describe('o resumo em agregado', () => {
    it('com duas professoras alocadas em Química e só uma com lote aprovado, a Química não tem número: vai para os recortes sem número', async () => {
      expect(resumoDoAnalistaResponseSchema.parse((await get(a.coordenacao, '/v1/analista/resumo')).corpo)).toEqual({ resumo: null })
      const { conteudo, texto } = await gerar(a)
      // O grupo mínimo conta quem decidiu lote aprovado no recorte, não quem tem vínculo nele (D45, D64): o número da
      // Química seria o resultado da professora do 2ºB, e diria que a colega do 2ºC não aplicou nada.
      expect(conteudo.recortes).toEqual([])
      expect(conteudo.alertas).toEqual([])
      expect(conteudo.recortesNominais).toEqual([
        { serie: { id: a.serieId, etapa: 'em', ano: 2 }, disciplina: { id: a.fisica, nome: 'Física' } },
        { serie: { id: a.serieId, etapa: 'em', ano: 2 }, disciplina: { id: a.quimica, nome: 'Química' } },
      ])
      expect(conteudo.escola).toEqual({ atividadesAplicadas: 3, lotesAprovados: 2, lotesEsperando: 1, versoesAdaptadasAprovadas: 0, trocasComOTutor: 0, sinais: { travou: 2, resposta_pronta: 0, duvida_repetida: 0, atencao_humana: 1 } })
      expect(conteudo.periodo.inicio).toBe('2026-02-01')
      // Nem o número de professores com vínculo aparece.
      expect(texto).not.toContain('"professores"')
    })

    it('aprovado o lote da colega, a Química tem duas professoras com dado e ganha número, só de lote aprovado', async () => {
      await aprovarOLote(rotas, a.colega, pendenteNoC)
      // Um lote novo da colega, ainda pendente, em que o aluno do 2ºC acertou tudo: se contasse, mudaria os números.
      await comLote(a, a.colega, a.outraTurma, a.quimica, [[alunoDoC, TODAS_CERTAS]])
      const { conteudo } = await gerar(a)
      // 2ºB: Caio 3/3 e 2/2, Bia 1/3 e 0/2; 2ºC: 1/3 e 0/2. O lote pendente ficaria em 8/12 e 4/8.
      expect(conteudo.recortes).toEqual([
        {
          serie: { id: a.serieId, etapa: 'em', ano: 2 },
          disciplina: { id: a.quimica, nome: 'Química' },
          professores: 2,
          alunos: 3,
          lotesAprovados: 2,
          acertoPercentual: 46.7,
          porHabilidade: [
            { habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, acertos: 5, total: 9 },
            { habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, acertos: 2, total: 6 },
          ],
        },
      ])
      expect(conteudo.escola).toMatchObject({ atividadesAplicadas: 4, lotesAprovados: 3, lotesEsperando: 1 })
    })

    it('o recorte de um professor só com lote não leva número, mesmo com um segundo professor alocado nele', async () => {
      await vincularProfessor(bancada, a, a.colega.usuarioId, a.outraTurma, a.fisica)
      try {
        const { conteudo, texto } = await gerar(a)
        expect(conteudo.recortesNominais).toEqual([{ serie: { id: a.serieId, etapa: 'em', ano: 2 }, disciplina: { id: a.fisica, nome: 'Física' } }])
        expect(conteudo.recortes.map((recorte) => recorte.disciplina.id)).toEqual([a.quimica])
        expect(conteudo.alertas.every((alerta) => alerta.disciplina.id === a.quimica)).toBe(true)
        // A Física aparece uma vez só, no recorte sem número.
        expect(texto.split(a.fisica)).toHaveLength(2)
      } finally {
        await sql(`delete from vinculo where escola_id = $1 and usuario_id = $2 and disciplina_id = $3`, [a.escolaId, a.colega.usuarioId, a.fisica])
      }
    })

    it('quando os dois lotes aprovados da Química foram decididos pela mesma pessoa, ela perde o número', async () => {
      const [lote] = await sql<{ id: string; decidida_por: string }>(`select id, decidida_por from entrega where escola_id = $1 and atividade_aplicada_id = $2 and estado = 'aprovada'`, [a.escolaId, pendenteNoC])
      if (lote === undefined) throw new Error('lote do 2ºC sem aprovação')
      await sql('update entrega set decidida_por = $3 where escola_id = $1 and id = $2', [a.escolaId, lote.id, a.professora.usuarioId])
      try {
        const { conteudo } = await gerar(a)
        expect(conteudo.recortes).toEqual([])
        expect(conteudo.recortesNominais.map((recorte) => recorte.disciplina.nome)).toEqual(['Física', 'Química'])
        for (const recorte of conteudo.recortesNominais) expect(Object.keys(recorte).sort()).toEqual(['disciplina', 'serie'])
      } finally {
        await sql('update entrega set decidida_por = $3 where escola_id = $1 and id = $2', [a.escolaId, lote.id, lote.decidida_por])
      }
    })

    it('o alerta é só o de habilidade com acerto baixo, com o número medido, o limiar e hipótese de lista fechada', async () => {
      const { conteudo } = await gerar(a)
      // 2 de 6 é 33,3% e 5 de 9 é 55,6%, os dois abaixo do limiar; do pior para o melhor.
      const comum = { tipo: 'habilidade_com_acerto_baixo', serie: { id: a.serieId, etapa: 'em', ano: 2 }, disciplina: { id: a.quimica, nome: 'Química' }, referencia: LIMIAR_DE_ACERTO_BAIXO_PERCENTUAL, hipoteses: ['conteudo_recente', 'questoes_acima_do_material'] }
      expect(conteudo.alertas).toEqual([
        { ...comum, habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, valor: 33.3 },
        { ...comum, habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, valor: 55.6 },
      ])
    })

    it('nenhum id nem nome de professor ou de aluno, e nenhuma turma, no resumo lido nem no gravado', async () => {
      const { id, texto } = await gerar(a)
      const [gravado] = await sql<{ conteudo: unknown }>('select conteudo from resumo_do_analista where escola_id = $1 and id = $2', [a.escolaId, id])
      const pessoas = await sql<{ id: string; nome: string }>(`select id, nome from usuario where escola_id = $1 and papel in ('professor', 'aluno')`, [a.escolaId])
      expect(pessoas.length).toBeGreaterThan(4)
      for (const onde of [texto, JSON.stringify(gravado?.conteudo)]) {
        for (const pessoa of pessoas) {
          expect(onde).not.toContain(pessoa.id)
          expect(onde).not.toContain(pessoa.nome)
        }
        for (const proibido of [a.turma, a.outraTurma, '2ºB', '2ºC', NOME_DA_PROFESSORA_DE_TESTE, NOME_DO_ALUNO_DE_TESTE, NOME_DA_BIA]) expect(onde).not.toContain(proibido)
      }
    })

    it('a mesma chave de envio devolve a mesma execução e grava um resumo só', async () => {
      const antes = await contarNaEscola(bancada, 'resumo_do_analista', a.escolaId)
      const corpo = { chaveEnvio: randomUUID() }
      const primeira = await post(a.coordenacao, '/v1/analista/gerar', corpo)
      const segunda = await post(a.coordenacao, '/v1/analista/gerar', corpo)
      expect([primeira.status, segunda.status]).toEqual([202, 202])
      expect(segunda.corpo['execucaoId']).toBe(primeira.corpo['execucaoId'])
      await executor.ociosa()
      expect(await contarNaEscola(bancada, 'resumo_do_analista', a.escolaId)).toBe(antes + 1)
      expect(erro(await post(a.coordenacao, '/v1/analista/gerar', { chaveEnvio: randomUUID(), escolaId: b.escolaId }))).toEqual(ENTRADA_INVALIDA)
    })

    it('com a função suspensa, gerar é recusado antes de gravar a execução; retomada, volta', async () => {
      const execucoes = () => contarNaEscola(bancada, 'execucao_agente', a.escolaId, `tarefa = 'resumo_do_analista'`)
      expect((await post(a.coordenacao, '/v1/governanca/funcoes/resumo_e_alerta/suspender')).status).toBe(200)
      try {
        const antes = await execucoes()
        expect(erro(await post(a.coordenacao, '/v1/analista/gerar', { chaveEnvio: randomUUID() }))).toEqual({ status: 409, codigo: 'FUNCAO_SUSPENSA' })
        expect(await execucoes()).toBe(antes)
        // O resumo que já existia continua lido, e a outra escola segue gerando.
        expect(resumoDoAnalistaResponseSchema.parse((await get(a.coordenacao, '/v1/analista/resumo')).corpo).resumo).not.toBeNull()
        expect((await post(b.coordenacao, '/v1/analista/gerar', { chaveEnvio: randomUUID() })).status).toBe(202)
      } finally {
        expect((await post(a.coordenacao, '/v1/governanca/funcoes/resumo_e_alerta/retomar')).status).toBe(200)
      }
      expect((await post(a.coordenacao, '/v1/analista/gerar', { chaveEnvio: randomUUID() })).status).toBe(202)
      await executor.ociosa()
    })

    it('o gerar tem limite por pessoa: acima do teto do minuto, LIMITE_EXCEDIDO, e a coordenação da outra escola segue', async () => {
      const corpo = { chaveEnvio: randomUUID() }
      for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_USUARIO; pedido += 1) expect((await post(a.coordenacao, '/v1/analista/gerar', corpo)).status).toBe(202)
      expect(erro(await post(a.coordenacao, '/v1/analista/gerar', corpo))).toEqual({ status: 429, codigo: 'LIMITE_EXCEDIDO' })
      expect((await post(b.coordenacao, '/v1/analista/gerar', { chaveEnvio: randomUUID() })).status).toBe(202)
      await executor.ociosa()
    })
  })

  describe('o dado nominal', () => {
    it('sem finalidade, ou com finalidade fora da lista, é recusado antes de procurar a turma, e nada é auditado', async () => {
      const antes = (await leiturasNominais(a)).length
      for (const turmaId of [a.turma, b.turma, randomUUID()]) {
        expect(erro(await nominal(a.coordenacao, turmaId, null))).toEqual(ENTRADA_INVALIDA)
        expect(erro(await nominal(a.coordenacao, turmaId, 'avaliar_o_professor'))).toEqual(ENTRADA_INVALIDA)
      }
      expect(erro(await get(a.coordenacao, `/v1/analista/nominal?finalidade=${FINALIDADE}`))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await get(a.coordenacao, `/v1/analista/nominal?turmaId=${a.turma}&finalidade=${FINALIDADE}&professorId=${a.professora.usuarioId}`))).toEqual(ENTRADA_INVALIDA)
      expect(await leiturasNominais(a)).toHaveLength(antes)
    })

    it('com finalidade, traz a turma, os professores dela, o acerto por habilidade e os sinais de trabalho; nada de aluno', async () => {
      const resposta = await nominal(a.coordenacao, a.turma)
      expect(resposta.status).toBe(200)
      const lido = analistaNominalResponseSchema.parse(resposta.corpo)
      expect(lido.turma).toEqual({ id: a.turma, nome: '2ºB', serie: { id: a.serieId, etapa: 'em', ano: 2 } })
      expect(lido.professores.map((professor) => [professor.id, professor.disciplina.nome]).sort()).toEqual(
        [
          [a.professora.usuarioId, 'Química'],
          [a.deFisica.usuarioId, 'Física'],
        ].sort(),
      )
      expect(lido.professores.find((professor) => professor.id === a.professora.usuarioId)?.nome).toBe(NOME_DA_PROFESSORA_DE_TESTE)
      // Os dois lotes aprovados do 2ºB, de Química e de Física: 4 + 1 de 9, e 2 + 0 de 6.
      expect(lido.lotesAprovados).toBe(2)
      expect(lido.porHabilidade).toEqual([
        { habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, acertos: 5, total: 9 },
        { habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, acertos: 2, total: 6 },
      ])
      // Sem `atencao_humana`: numa turma, a contagem aponta poucos alunos (D36).
      expect(lido.sinais).toEqual({ travou: 2, resposta_pronta: 0, duvida_repetida: 0 })
      expect(Object.keys(resposta.corpo).sort()).toEqual(['lotesAprovados', 'porHabilidade', 'professores', 'sinais', 'turma'])
      const texto = JSON.stringify(resposta.corpo)
      for (const proibido of [a.aluno.usuarioId, bia.usuarioId, NOME_DO_ALUNO_DE_TESTE, NOME_DA_BIA, 'atencao_humana', a.colega.usuarioId]) expect(texto).not.toContain(proibido)
    })

    it('cada leitura grava uma auditoria, com quem leu, a turma, a finalidade e quantos professores, nunca quais', async () => {
      const antes = (await leiturasNominais(a)).length
      expect((await nominal(a.coordenacao, a.turma)).status).toBe(200)
      expect((await nominal(a.coordenacao, a.turma, 'apuracao_de_denuncia')).status).toBe(200)
      const registros = (await leiturasNominais(a)).slice(antes)
      expect(registros).toEqual([
        { autor_usuario_id: a.coordenacao.usuarioId, entidade_id: a.turma, depois: { professores: 2 }, finalidade: FINALIDADE },
        { autor_usuario_id: a.coordenacao.usuarioId, entidade_id: a.turma, depois: { professores: 2 }, finalidade: 'apuracao_de_denuncia' },
      ])
      // Nem o log nem a auditoria levam o nome de quem foi nomeado na resposta.
      expect(linhasDeLog.some((linha) => linha.includes(NOME_DA_PROFESSORA_DE_TESTE) || linha.includes(NOME_DA_BIA))).toBe(false)
    })

    it('a turma de outra escola, de outro ano e a inexistente respondem igual, sem auditoria em nenhuma das escolas', async () => {
      const anterior = await anteriorDeA()
      const antes = { deA: (await leiturasNominais(a)).length, deB: (await leiturasNominais(b)).length }
      expect(erro(await nominal(a.coordenacao, b.turma))).toEqual(NAO_ENCONTRADO)
      expect(erro(await nominal(a.coordenacao, anterior.turmaId))).toEqual(NAO_ENCONTRADO)
      expect(erro(await nominal(a.coordenacao, randomUUID()))).toEqual(NAO_ENCONTRADO)
      expect(erro(await nominal(b.coordenacao, a.turma))).toEqual(NAO_ENCONTRADO)
      expect({ deA: (await leiturasNominais(a)).length, deB: (await leiturasNominais(b)).length }).toEqual(antes)
    })
  })

  describe('isolamento', () => {
    it('a coordenação de B não lê o resumo de A, e o que B gera só conta o que é de B', async () => {
      const deA = await gerar(a)
      const deB = await gerar(b)
      expect(deB.id).not.toBe(deA.id)
      expect(deB.conteudo.recortes).toEqual([])
      expect(deB.conteudo.recortesNominais).toEqual([])
      expect(deB.conteudo.escola).toMatchObject({ atividadesAplicadas: 0, lotesAprovados: 0, lotesEsperando: 0, sinais: { travou: 0, atencao_humana: 0 } })
      for (const proibido of [a.serieId, a.quimica, a.fisica]) expect(deB.texto).not.toContain(proibido)
      // E o resumo de A continua sendo o de A.
      expect(resumoDoAnalistaResponseSchema.parse((await get(a.coordenacao, '/v1/analista/resumo')).corpo).resumo?.id).toBe(deA.id)
    })

    it('a aplicação, o lote aprovado, a troca com o Tutor e os sinais do ano anterior não entram em número nenhum do ano em curso', async () => {
      const antes = await gerar(a)
      const anterior = await anteriorDeA()
      const deAntes = { ...a, anoLetivoId: anterior.anoLetivoId }
      // A Bia estava no 2ºB de 2025, com a professora de Química: lá ela errou tudo, trocou com o Tutor e travou.
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [a.escolaId, anterior.anoLetivoId, bia.usuarioId, anterior.turmaId, a.coordenacao.usuarioId])
      const aplicacao = await gravarAplicacao(bancada, deAntes, { turmaId: anterior.turmaId, titulo: 'Lista sintética de 2025' })
      await lancarLote(bancada, deAntes, aplicacao, 'aprovada', { alunoId: bia.usuarioId, acertos: 0, total: 5, porHabilidade: [{ codigo: HABILIDADE_DAS_TRES_PRIMEIRAS.codigo, acertos: 0, total: 3 }, { codigo: HABILIDADE_DAS_DUAS_ULTIMAS.codigo, acertos: 0, total: 2 }] }, anterior.turmaId)
      await trocasJaFeitas(bancada, deAntes, bia.usuarioId, 2, { turmaId: anterior.turmaId, haDias: 300 })
      for (const [tipo, atividade, questao] of [['travou', aplicacao, 1], ['atencao_humana', null, null]] as const) {
        await sql('insert into sinal_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, tipo, atividade_aplicada_id, questao) values ($1, $2, $3, $4, $5, $6, $7)', [a.escolaId, anterior.anoLetivoId, anterior.turmaId, bia.usuarioId, tipo, atividade, questao])
      }

      const depois = await gerar(a)
      expect(depois.id).not.toBe(antes.id)
      expect(depois.conteudo).toEqual(antes.conteudo)
    })

    it('professor e aluno não alcançam nenhuma rota do Analista: a resposta é a do inexistente, e nada é gravado', async () => {
      const antes = { execucoes: await contarNaEscola(bancada, 'execucao_agente', a.escolaId, `tarefa = 'resumo_do_analista'`), leituras: (await leiturasNominais(a)).length }
      for (const sessao of [a.professora, a.aluno]) {
        expect(erro(await get(sessao, '/v1/analista/resumo'))).toEqual(NAO_ENCONTRADO)
        expect(erro(await post(sessao, '/v1/analista/gerar', { chaveEnvio: randomUUID() }))).toEqual(NAO_ENCONTRADO)
        expect(erro(await nominal(sessao, a.turma))).toEqual(NAO_ENCONTRADO)
      }
      expect({ execucoes: await contarNaEscola(bancada, 'execucao_agente', a.escolaId, `tarefa = 'resumo_do_analista'`), leituras: (await leiturasNominais(a)).length }).toEqual(antes)
    })
  })
})
