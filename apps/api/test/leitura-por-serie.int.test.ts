import { FakeAdapter, material, runInContext, type Clock, type Database, type InProcessAgenteExecutor } from '@educa/core'
import { artefatoResponseSchema, conteudoDoArtefatoSchema, ErrorCode } from '@educa/shared'
import { and, eq, type SQL } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { citacoesDoConteudo } from '../src/artefato/conferencia.js'
import { DB } from '../src/database.module.js'
import { EXECUTOR_DE_AGENTE } from '../src/ia/ia.module.js'
import { declaradoParaASerie, proprioOuComLicencaVigente } from '../src/material/material.repository.js'
import { TrechoSearch } from '../src/material/trecho-search.js'
import { contarNaEscola, execucaoTerminada, montarEscolaComAssistente, vincularProfessor, zerarLimiteDePedidosDeIa, type EscolaComAssistente } from './escola-assistente.fixture.js'
import { aplicarAtividade } from './escola-tutor.fixture.js'
import { semearLicenca, semearMaterial } from './leitura-por-serie.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import { WriteBlockTrigger } from './write-block-trigger.js'

/**
 * Toda leitura de página filtra por série e por licença vigente hoje, e sem material da série ninguém gera (ingestao-do-material, 9.0; PRD, RF7, RF8, RF17; Tech Spec, seção 5, "Leitura de
 * página"): a ferramenta, o chat do Assistente, a porta de trechos, a página aberta, o material que o aluno abre, o turno do Tutor e a rota `GET /v1/materiais/busca`. Postgres real, o relógio das
 * licenças injetado (o dia de São Paulo) e o adaptador falso de IA.
 *
 * Cada caso monta a sua escola: a de Química, com o material de demonstração declarado só para o 2º ano do EM, e a série do 9º ano do EF, onde **não há material nenhum** até o caso semear o que
 * quer provar. A turma do 9º é a que o filtro precisa recusar; a do 2º, a que ele precisa atender.
 */
describe('leitura de página por série e licença vigente (9.0)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  /** O dia de São Paulo da licença: o caso o avança. */
  const relogio: Clock & { atual: Date } = { atual: new Date('2026-11-13T12:00:00-03:00'), agora: () => relogio.atual }
  let api: TestApi
  let executor: InProcessAgenteExecutor

  /** A escola de Química do 2º EM (com o material de demonstração) mais a série e a turma do 9º ano, sem material, com a professora vinculada e um aluno em cada turma. */
  interface Cenario {
    readonly escola: EscolaComAssistente
    readonly serie9: string
    readonly turma9: string
    readonly alunoDe2: TestSessao
    readonly alunoDe9: TestSessao
    /** A atividade de Química aplicada à turma do 9º, e a do 2º. */
    readonly atividadeDe9: string
    readonly atividadeDe2: string
  }

  const sql = <Registro extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Registro>(texto, valores)
  const get = async (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, await sessao.tokenNovo())
  const post = async (sessao: TestSessao, caminho: string, corpo: Record<string, unknown>): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, await sessao.tokenNovo(), { chaveEnvio: randomUUID(), ...corpo })
  const patch = async (sessao: TestSessao, caminho: string, corpo: Record<string, unknown>): Promise<RespostaHttp> => chamar(api.url, 'PATCH', caminho, await sessao.tokenNovo(), corpo)
  const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const noContexto = <T>(escola: EscolaComAssistente, funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId }, funcao)
  const gastos = async (escola: EscolaComAssistente) => [
    await contarNaEscola(bancada, 'execucao_agente', escola.escolaId),
    await contarNaEscola(bancada, 'consumo_ia', escola.escolaId),
    await contarNaEscola(bancada, 'mensagem_agente', escola.escolaId),
    await contarNaEscola(bancada, 'mensagem_tutor', escola.escolaId),
  ]
  const FERRAMENTAS = ['atividade_objetiva', 'plano_de_aula'] as const
  const gerar = (escola: EscolaComAssistente, ferramenta: (typeof FERRAMENTAS)[number], turmaId: string) => post(escola.professora, `/v1/ferramentas/${ferramenta}/gerar`, { turmaId, disciplinaId: escola.quimica, tema: 'estequiometria' })
  const conversar = (escola: EscolaComAssistente, turmaId: string) => post(escola.professora, '/v1/assistente/mensagens', { texto: 'explique o reagente limitante', turmaId, disciplinaId: escola.quimica })
  const perguntar = (aluno: TestSessao, corpo: Record<string, unknown>) => post(aluno, '/v1/tutor/mensagens', { texto: 'não entendi o reagente limitante', ...corpo })
  const buscar = async (sessao: TestSessao, consulta: string): Promise<string[]> => {
    const resposta = await get(sessao, `/v1/materiais/busca?q=reagente${consulta}`)
    expect(resposta.status).toBe(200)
    // A rota devolve um item por trecho: o que o caso compara é o material.
    return [...new Set((resposta.corpo['itens'] as Array<{ materialId: string }>).map((item) => item.materialId))]
  }

  async function novoAluno(escola: EscolaComAssistente, turmaId: string): Promise<TestSessao> {
    const aluno = await bancada.sessao(escola.escolaId, 'aluno')
    await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [
      escola.escolaId,
      escola.anoLetivoId,
      aluno.usuarioId,
      turmaId,
      escola.coordenacao.usuarioId,
    ])
    return aluno
  }

  async function cenario(): Promise<Cenario> {
    const escola = await montarEscolaComAssistente(api, bancada)
    const token = await escola.coordenacao.tokenNovo()
    const serie = await chamar(api.url, 'POST', '/v1/series', token, { etapa: 'ef_anos_finais', ano: 9 })
    expect(serie.status).toBe(201)
    const serie9 = serie.corpo['id'] as string
    const turma = await chamar(api.url, 'POST', '/v1/turmas', token, { serieId: serie9, nome: '9ºA' })
    expect(turma.status).toBe(201)
    const turma9 = turma.corpo['id'] as string
    await vincularProfessor(bancada, escola, escola.professora.usuarioId, turma9, escola.quimica)
    const alunoDe9 = await novoAluno(escola, turma9)
    const atividadeDe9 = await aplicarAtividade(bancada, escola, { turmaId: turma9 })
    const atividadeDe2 = await aplicarAtividade(bancada, escola)
    return { escola, serie9, turma9, alunoDe2: escola.aluno, alunoDe9, atividadeDe9, atividadeDe2 }
  }

  /** Material do 9º ano, de Química, com a licença da escola que o caso pede (ou próprio, sem licença). */
  const materialDe9 = (c: Cenario, opcoes: Partial<Parameters<typeof semearMaterial>[4]> = {}) =>
    semearMaterial(bancada.pool, c.escola.escolaId, c.escola.quimica, c.escola.coordenacao.usuarioId, { serieIds: [c.serie9], ...opcoes })
  const licencaDe = (c: Cenario, desde: string, ate: string | null = null) => semearLicenca(bancada.pool, c.escola.escolaId, c.escola.coordenacao.usuarioId, { desde, ate })

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog, { ...TEST_APP_OPTIONS, relogioDasLicencas: relogio })
    executor = api.app.get<InProcessAgenteExecutor>(EXECUTOR_DE_AGENTE)
  })

  beforeEach(async () => {
    relogio.atual = new Date('2026-11-13T12:00:00-03:00')
    await zerarLimiteDePedidosDeIa(api)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    await medidor.encerrar()
    await bancada.fechar()
  })

  describe('material só do 2º ano, turma do 9º', () => {
    it('a ferramenta (atividade e plano) e o chat recusam a turma do 9º com SEM_MATERIAL_DA_SERIE antes do 202, e atendem a turma do 2º', async () => {
      const c = await cenario()
      const antes = await gastos(c.escola)
      for (const ferramenta of FERRAMENTAS) expect(erroDe(await gerar(c.escola, ferramenta, c.turma9)), ferramenta).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })
      expect(erroDe(await conversar(c.escola, c.turma9))).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })
      expect(await gastos(c.escola)).toEqual(antes)

      // A turma do 2º, que tem o material, é atendida nos três.
      for (const ferramenta of FERRAMENTAS) {
        const aceita = await gerar(c.escola, ferramenta, c.escola.turma)
        expect(aceita.status, ferramenta).toBe(202)
        expect((await execucaoTerminada(api, c.escola.professora, aceita.corpo['execucaoId'] as string)).estado).toBe('concluida')
      }
      const conversa = await conversar(c.escola, c.escola.turma)
      expect(conversa.status).toBe(202)
      expect((await execucaoTerminada(api, c.escola.professora, conversa.corpo['execucaoId'] as string)).estado).toBe('concluida')
    })

    it('a porta de trechos e a página aberta só devolvem o material da série pedida', async () => {
      const c = await cenario()
      const porta = api.app.get(TrechoSearch)
      const pedido = { texto: 'reagente limitante', disciplinaId: c.escola.quimica, limite: 20 }
      expect(await noContexto(c.escola, () => porta.buscar({ ...pedido, serieId: c.serie9 }))).toEqual([])
      expect(new Set((await noContexto(c.escola, () => porta.buscar({ ...pedido, serieId: c.escola.serieId }))).map((trecho) => trecho.materialId))).toEqual(new Set([c.escola.materialId]))
      // O mesmo para a página aberta: o material do 2º ano, pedido pela série do 9º, não devolve página nenhuma.
      expect(await noContexto(c.escola, () => porta.doMaterial(c.escola.materialId, c.escola.quimica, c.serie9))).toEqual([])
      expect((await noContexto(c.escola, () => porta.doMaterial(c.escola.materialId, c.escola.quimica, c.escola.serieId))).map((trecho) => trecho.pagina)).toEqual([1, 2, 3, 4, 5, 6])
      expect(await noContexto(c.escola, () => porta.existeMaterialDaSerie({ serieId: c.serie9, disciplinaId: c.escola.quimica }))).toBe(false)
      expect(await noContexto(c.escola, () => porta.existeMaterialDaSerie({ serieId: c.escola.serieId, disciplinaId: c.escola.quimica }))).toBe(true)
      // E só da disciplina: Física não tem material em série nenhuma.
      expect(await noContexto(c.escola, () => porta.existeMaterialDaSerie({ serieId: c.escola.serieId, disciplinaId: c.escola.fisica }))).toBe(false)
    })

    it('o Tutor da turma do 9º é recusado com SEM_MATERIAL_DA_SERIE, e o material do 2º aberto por ele responde como o inexistente; o aluno do 2º é atendido', async () => {
      const c = await cenario()
      const antes = await gastos(c.escola)
      expect(erroDe(await perguntar(c.alunoDe9, { atividadeAplicadaId: c.atividadeDe9 }))).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })
      // O material que o aluno do 9º abre é o do 2º: `materialDaTurma` filtra pela série da turma dele, e a resposta é a do inexistente.
      expect(erroDe(await perguntar(c.alunoDe9, { atividadeAplicadaId: c.atividadeDe9, materialId: c.escola.materialId, pagina: 2 }))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(await gastos(c.escola)).toEqual(antes)

      const aceita = await perguntar(c.alunoDe2, { atividadeAplicadaId: c.atividadeDe2, materialId: c.escola.materialId, pagina: 2 })
      expect(aceita.status).toBe(202)
      expect((await execucaoTerminada(api, c.alunoDe2, aceita.corpo['execucaoId'] as string)).estado).toBe('concluida')
    })

    it('a rota de busca com serieId devolve só o material da série; sem serieId, o da escola toda; e a série filtra, não autoriza', async () => {
      const c = await cenario()
      const coordenacao = c.escola.coordenacao
      expect(await buscar(coordenacao, `&serieId=${c.escola.serieId}`)).toEqual([c.escola.materialId])
      expect(await buscar(coordenacao, `&serieId=${c.serie9}`)).toEqual([])
      expect(await buscar(coordenacao, '')).toEqual([c.escola.materialId])
      // A professora de Física não tem a disciplina do material: a série dele não o abre para ela.
      expect(await buscar(c.escola.deFisica, `&serieId=${c.escola.serieId}`)).toEqual([])
      expect(await buscar(c.escola.professora, `&serieId=${c.escola.serieId}`)).toEqual([c.escola.materialId])
    })

    it('com material de Química do 2º e do 9º na mesma escola, a turma do 9º só cita o do 9º: atividade, plano, chat e Tutor', async () => {
      const c = await cenario()
      // Os dois materiais têm a palavra procurada: sem o filtro de série, a busca da turma do 9º traria páginas do 2º.
      const de9 = await materialDe9(c, { titulo: 'Química do 9º ano', deDemonstracao: true })
      const professora = c.escola.professora
      const citadosPor = (citacoes: ReadonlyArray<{ materialId: string }> | undefined, rotulo: string, esperado: string): void => {
        expect(citacoes?.length, rotulo).toBeGreaterThan(0)
        expect(new Set(citacoes?.map((citacao) => citacao.materialId)), rotulo).toEqual(new Set([esperado]))
      }
      const fontesDoArtefato = async (execucaoId: string): Promise<ReadonlyArray<{ materialId: string }>> => {
        const execucao = await execucaoTerminada(api, professora, execucaoId)
        expect(execucao.estado, String(execucao.erro)).toBe('concluida')
        const lido = artefatoResponseSchema.parse((await get(professora, `/v1/artefatos/${String(execucao.resultado?.artefatoId)}`)).corpo)
        return citacoesDoConteudo(conteudoDoArtefatoSchema.parse(lido.conteudo))
      }
      const citacoesDaMensagem = async (sessao: TestSessao, aceita: RespostaHttp): Promise<ReadonlyArray<{ materialId: string }> | undefined> => {
        expect(aceita.status).toBe(202)
        const execucao = await execucaoTerminada(api, sessao, aceita.corpo['execucaoId'] as string)
        expect(execucao.estado).toBe('concluida')
        return execucao.resultado?.mensagem?.['citacoes'] as ReadonlyArray<{ materialId: string }> | undefined
      }

      for (const ferramenta of FERRAMENTAS) {
        const aceita = await gerar(c.escola, ferramenta, c.turma9)
        expect(aceita.status, ferramenta).toBe(202)
        citadosPor(await fontesDoArtefato(aceita.corpo['execucaoId'] as string), `${ferramenta} do 9º`, de9)
      }
      citadosPor(await citacoesDaMensagem(professora, await conversar(c.escola, c.turma9)), 'chat do 9º', de9)
      // O turno do Tutor, com a página aberta do material do 9º: a citação vem dele, e nunca do 2º.
      citadosPor(await citacoesDaMensagem(c.alunoDe9, await perguntar(c.alunoDe9, { atividadeAplicadaId: c.atividadeDe9, materialId: de9, pagina: 1 })), 'Tutor do 9º', de9)
      // Sem página aberta, só com a atividade: a busca do Tutor é por disciplina e série, e só o filtro de série separa o material do 9º do do 2º.
      citadosPor(await citacoesDaMensagem(c.alunoDe9, await perguntar(c.alunoDe9, { atividadeAplicadaId: c.atividadeDe9 })), 'Tutor do 9º, sem página aberta', de9)
      // O controle: a turma do 2º, com a mesma palavra, cita só o material dela.
      citadosPor(await citacoesDaMensagem(professora, await conversar(c.escola, c.escola.turma)), 'chat do 2º', c.escola.materialId)
    })

    it('a lista de materiais com serieId devolve só o material da série', async () => {
      const c = await cenario()
      const lista = async (consulta: string): Promise<string[]> => {
        const resposta = await get(c.escola.coordenacao, `/v1/materiais${consulta}`)
        expect(resposta.status).toBe(200)
        return (resposta.corpo['itens'] as Array<{ id: string }>).map((item) => item.id)
      }
      expect(await lista(`?serieId=${c.escola.serieId}`)).toEqual([c.escola.materialId])
      expect(await lista(`?serieId=${c.serie9}`)).toEqual([])
      expect(await lista('')).toEqual([c.escola.materialId])
    })

    it('a turma que a professora não alcança responde como inexistente na ferramenta e no chat, antes de qualquer conferência de material', async () => {
      const c = await cenario()
      const antes = await gastos(c.escola)
      const naoDela = { turmaId: c.escola.turma, disciplinaId: c.escola.quimica }
      // A professora de Física não tem vínculo com a Química: a turma existe, o material existe, e a resposta é a do inexistente.
      for (const ferramenta of FERRAMENTAS) {
        expect(erroDe(await post(c.escola.deFisica, `/v1/ferramentas/${ferramenta}/gerar`, { ...naoDela, tema: 'estequiometria' })), ferramenta).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      }
      expect(erroDe(await post(c.escola.deFisica, '/v1/assistente/mensagens', { ...naoDela, texto: 'explique o reagente limitante' }))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      // E a turma que não existe responde igual.
      expect(erroDe(await conversar(c.escola, randomUUID()))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      expect(await gastos(c.escola)).toEqual(antes)
    })
  })

  describe('a licença vale no dia de São Paulo', () => {
    it('às 23h do último dia o material de licença volta em toda leitura; às 0h01 do seguinte não volta; o PATCH que estende o devolve, também na página aberta do Tutor', async () => {
      const c = await cenario()
      const licencaId = await licencaDe(c, '2026-01-01', '2026-11-13')
      const materialId = await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId })
      const porta = api.app.get(TrechoSearch)
      const paginaAberta = () => noContexto(c.escola, () => porta.doMaterial(materialId, c.escola.quimica, c.serie9))
      const existe = () => noContexto(c.escola, () => porta.existeMaterialDaSerie({ serieId: c.serie9, disciplinaId: c.escola.quimica }))
      const achada = async () => [...new Set((await noContexto(c.escola, () => porta.buscar({ texto: 'reagente limitante', disciplinaId: c.escola.quimica, serieId: c.serie9 }))).map((trecho) => trecho.materialId))]
      const naTelaDoAluno = async () => erroDe(await perguntar(c.alunoDe9, { atividadeAplicadaId: c.atividadeDe9, materialId, pagina: 1 }))
      const emUso = async () => (await buscar(c.escola.coordenacao, `&serieId=${c.serie9}`)).length

      // 23h de São Paulo já é o dia seguinte em UTC: quem lê o dia pelo relógio do banco ou do servidor erra aqui.
      relogio.atual = new Date('2026-11-13T23:00:00-03:00')
      expect([(await paginaAberta()).length, await existe(), await achada(), await emUso()]).toEqual([2, true, [materialId], 1])
      expect((await naTelaDoAluno()).status).toBe(202)
      await executor.ociosa()

      relogio.atual = new Date('2026-11-14T00:01:00-03:00')
      expect([(await paginaAberta()).length, await existe(), await achada(), await emUso()]).toEqual([0, false, [], 0])
      expect(await naTelaDoAluno()).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })

      // Estender a vigência devolve o material sem reenviar, e a página aberta do Tutor volta a abrir.
      expect((await patch(c.escola.coordenacao, `/v1/licencas/${licencaId}`, { vigenteAte: '2027-12-31' })).status).toBe(200)
      expect([(await paginaAberta()).length, await existe(), await achada(), await emUso()]).toEqual([2, true, [materialId], 1])
      expect((await naTelaDoAluno()).status).toBe(202)
      await executor.ociosa()
    })

    it('a licença que só começa amanhã deixa o material fora até o dia', async () => {
      const c = await cenario()
      const licencaId = await licencaDe(c, '2026-11-14')
      await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId })
      const emUso = async () => (await buscar(c.escola.coordenacao, `&serieId=${c.serie9}`)).length
      const existe = () => noContexto(c.escola, () => api.app.get(TrechoSearch).existeMaterialDaSerie({ serieId: c.serie9, disciplinaId: c.escola.quimica }))

      relogio.atual = new Date('2026-11-13T23:59:00-03:00')
      expect([await emUso(), await existe()]).toEqual([0, false])
      relogio.atual = new Date('2026-11-14T00:01:00-03:00')
      expect([await emUso(), await existe()]).toEqual([1, true])
    })

    it('a licença vigente de outro material da escola não autoriza o de licença vencida', async () => {
      const c = await cenario()
      const vencida = await licencaDe(c, '2026-01-01', '2026-11-12')
      await licencaDe(c, '2026-01-01')
      await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId: vencida })
      expect(await buscar(c.escola.coordenacao, `&serieId=${c.serie9}`)).toEqual([])
      expect(await noContexto(c.escola, () => api.app.get(TrechoSearch).existeMaterialDaSerie({ serieId: c.serie9, disciplinaId: c.escola.quimica }))).toBe(false)
    })

    it('o material próprio, sem licença, é lido; o de terceiro, pela licença vigente, não o esconde', async () => {
      const c = await cenario()
      const proprio = await materialDe9(c, { titulo: 'Próprio' })
      expect(await buscar(c.escola.coordenacao, `&serieId=${c.serie9}`)).toEqual([proprio])
      const licencaId = await licencaDe(c, '2026-01-01')
      const terceiro = await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId, titulo: 'Terceiro' })
      expect(new Set(await buscar(c.escola.coordenacao, `&serieId=${c.serie9}`))).toEqual(new Set([proprio, terceiro]))
    })
  })

  describe('sem material da série, ninguém gera', () => {
    it.each([
      { caso: 'o único material da série tem a licença vencida', preparar: async (c: Cenario) => materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId: await licencaDe(c, '2026-01-01', '2026-11-12') }) },
      { caso: 'o único material da série ainda está processando', preparar: (c: Cenario) => materialDe9(c, { estado: 'processando' }) },
      { caso: 'o único material da série foi substituído (excluído)', preparar: (c: Cenario) => materialDe9(c, { substituido: true }) },
    ])('$caso: SEM_MATERIAL_DA_SERIE na ferramenta e no chat, sem execução, consumo nem chamada ao adaptador', async ({ preparar }) => {
      const c = await cenario()
      await preparar(c)
      const adaptador = vi.spyOn(FakeAdapter.prototype, 'chamar')
      const buscarTrechos = vi.spyOn(api.app.get(TrechoSearch), 'buscar')
      const antes = await gastos(c.escola)

      for (const ferramenta of FERRAMENTAS) expect(erroDe(await gerar(c.escola, ferramenta, c.turma9)), ferramenta).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })
      expect(erroDe(await conversar(c.escola, c.turma9))).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })
      expect(erroDe(await perguntar(c.alunoDe9, { atividadeAplicadaId: c.atividadeDe9 }))).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })

      expect(adaptador).not.toHaveBeenCalled()
      expect(buscarTrechos).not.toHaveBeenCalled()
      expect(await gastos(c.escola)).toEqual(antes)
    })

    it('modo livre, sem atividade nem material: o turno é aceito, o adaptador é chamado, e não há SEM_MATERIAL_DA_SERIE', async () => {
      const c = await cenario()
      const adaptador = vi.spyOn(FakeAdapter.prototype, 'chamar')
      const aceita = await perguntar(c.alunoDe9, {})
      expect(aceita.status).toBe(202)
      expect((await execucaoTerminada(api, c.alunoDe9, aceita.corpo['execucaoId'] as string)).estado).toBe('concluida')
      expect(adaptador).toHaveBeenCalledTimes(1)
    })
  })

  describe('o reenvio com a mesma chaveEnvio, depois que o material saiu do alcance', () => {
    /** Os três pedidos da professora que disparam IA, cada um com a sua chave: o que a tela reenvia quando perde a resposta do `202`. */
    const pedidosDaProfessora = (c: Cenario) => [
      ...FERRAMENTAS.map((ferramenta) => ({ rotulo: ferramenta, caminho: `/v1/ferramentas/${ferramenta}/gerar`, corpo: { turmaId: c.turma9, disciplinaId: c.escola.quimica, tema: 'estequiometria', chaveEnvio: randomUUID() } })),
      { rotulo: 'chat', caminho: '/v1/assistente/mensagens', corpo: { texto: 'explique o reagente limitante', turmaId: c.turma9, disciplinaId: c.escola.quimica, chaveEnvio: randomUUID() } },
    ]
    const aceitarETerminar = async (sessao: TestSessao, caminho: string, corpo: Record<string, unknown>, rotulo: string): Promise<string> => {
      const aceita = await post(sessao, caminho, corpo)
      expect(aceita.status, rotulo).toBe(202)
      const execucaoId = aceita.corpo['execucaoId'] as string
      expect((await execucaoTerminada(api, sessao, execucaoId)).estado, rotulo).toBe('concluida')
      return execucaoId
    }

    /**
     * O reenvio com a execução ainda `pendente`: segura a execução na transição `rodando` (o gatilho só do banco de teste), tira o material, reenvia com a **mesma chave** e solta. É o caminho que a correção
     * abriu: o reenvio já não para no filtro, e o `agendar` retoma a execução que ainda não rodou. O que ela faz com o material que saiu é o que o caso confere.
     */
    async function reenviandoComAExecucaoPendente(sessao: TestSessao, caminho: string, corpo: Record<string, unknown>, mudar: () => Promise<void>): Promise<{ aceita: RespostaHttp; reenvio: RespostaHttp; execucaoId: string }> {
      await executor.ociosa()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.solicitada_por = '${sessao.usuarioId}'::uuid and new.estado = 'rodando'` })
      await parada.armar()
      let aceita: RespostaHttp
      let reenvio: RespostaHttp
      try {
        aceita = await post(sessao, caminho, corpo)
        expect(aceita.status).toBe(202)
        await parada.esperarParadas(1)
        await mudar()
        reenvio = await post(sessao, caminho, corpo)
      } finally {
        await parada.desarmar()
      }
      await executor.ociosa()
      return { aceita, reenvio, execucaoId: aceita.corpo['execucaoId'] as string }
    }
    const estadoDaExecucao = async (escolaId: string, execucaoId: string) =>
      (await sql<{ estado: string; erro: string | null }>('select estado, erro from execucao_agente where escola_id = $1 and id = $2', [escolaId, execucaoId])).rows

    it('a ferramenta e o chat devolvem o execucaoId já aceito, sem gravar nem chamar o modelo, depois que o único material da série saiu; a chave nova continua recusada', async () => {
      const c = await cenario()
      const materialId = await materialDe9(c, { deDemonstracao: true })
      const pedidos = pedidosDaProfessora(c)
      const aceitos: string[] = []
      for (const pedido of pedidos) aceitos.push(await aceitarETerminar(c.escola.professora, pedido.caminho, pedido.corpo, pedido.rotulo))

      await sql('delete from material_serie where escola_id = $1 and material_id = $2', [c.escola.escolaId, materialId])
      const adaptador = vi.spyOn(FakeAdapter.prototype, 'chamar')
      const antes = await gastos(c.escola)
      for (const [posicao, pedido] of pedidos.entries()) {
        const reenvio = await post(c.escola.professora, pedido.caminho, pedido.corpo)
        expect(reenvio.status, pedido.rotulo).toBe(202)
        expect(reenvio.corpo['execucaoId'], pedido.rotulo).toBe(aceitos[posicao])
        // O controle: a chave nova, com o mesmo corpo, continua recusada. O que passa é a chave que o servidor já aceitou.
        expect(erroDe(await post(c.escola.professora, pedido.caminho, { ...pedido.corpo, chaveEnvio: randomUUID() })), pedido.rotulo).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })
      }
      await executor.ociosa()
      expect(adaptador).not.toHaveBeenCalled()
      expect(await gastos(c.escola)).toEqual(antes)
    })

    it('a chave aceita para um pedido não pula a conferência de outro: reaproveitada em outra ferramenta ou no chat, continua com SEM_MATERIAL_DA_SERIE', async () => {
      const c = await cenario()
      const materialId = await materialDe9(c, { deDemonstracao: true })
      const pedidos = pedidosDaProfessora(c)
      for (const pedido of pedidos) await aceitarETerminar(c.escola.professora, pedido.caminho, pedido.corpo, pedido.rotulo)

      await sql('delete from material_serie where escola_id = $1 and material_id = $2', [c.escola.escolaId, materialId])
      const antes = await gastos(c.escola)
      for (const dona of pedidos) {
        for (const outro of pedidos.filter((pedido) => pedido !== dona)) {
          const reaproveitada = await post(c.escola.professora, outro.caminho, { ...outro.corpo, chaveEnvio: dona.corpo.chaveEnvio })
          expect(erroDe(reaproveitada), `${dona.rotulo} no lugar de ${outro.rotulo}`).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })
        }
      }
      expect(await gastos(c.escola)).toEqual(antes)
    })

    it('a chave aceita para uma professora não abre a recusa para outra da mesma escola: ela continua com SEM_MATERIAL_DA_SERIE', async () => {
      const c = await cenario()
      const materialId = await materialDe9(c, { deDemonstracao: true })
      await vincularProfessor(bancada, c.escola, c.escola.deFisica.usuarioId, c.turma9, c.escola.quimica)
      const pedidos = pedidosDaProfessora(c)
      for (const pedido of pedidos) await aceitarETerminar(c.escola.professora, pedido.caminho, pedido.corpo, pedido.rotulo)

      await sql('delete from material_serie where escola_id = $1 and material_id = $2', [c.escola.escolaId, materialId])
      const antes = await gastos(c.escola)
      for (const pedido of pedidos) expect(erroDe(await post(c.escola.deFisica, pedido.caminho, pedido.corpo)), pedido.rotulo).toEqual({ status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE })
      expect(await gastos(c.escola)).toEqual(antes)
    })

    it('o Tutor devolve a execução já aceita quando o material aberto ou o único material da série saiu, porque a licença venceu; a chave nova é recusada', async () => {
      const c = await cenario()
      const licencaId = await licencaDe(c, '2026-01-01')
      const materialId = await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId, deDemonstracao: true })
      const comMaterialAberto = { atividadeAplicadaId: c.atividadeDe9, materialId, pagina: 1, chaveEnvio: randomUUID() }
      const soComAtividade = { atividadeAplicadaId: c.atividadeDe9, chaveEnvio: randomUUID() }
      const aceitos = [await aceitarETerminar(c.alunoDe9, '/v1/tutor/mensagens', { texto: 'não entendi o reagente limitante', ...comMaterialAberto }, 'com o material aberto')]
      aceitos.push(await aceitarETerminar(c.alunoDe9, '/v1/tutor/mensagens', { texto: 'não entendi o reagente limitante', ...soComAtividade }, 'só com a atividade'))

      await sql(`update licenca_de_material set vigente_ate = '2026-11-12' where id = $1`, [licencaId])
      const adaptador = vi.spyOn(FakeAdapter.prototype, 'chamar')
      const antes = await gastos(c.escola)
      const reenvios = [comMaterialAberto, soComAtividade]
      const recusas = [
        { status: 404, codigo: ErrorCode.NAO_ENCONTRADO },
        { status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE },
      ]
      for (const [posicao, corpo] of reenvios.entries()) {
        const reenvio = await perguntar(c.alunoDe9, corpo)
        expect(reenvio.status, String(posicao)).toBe(202)
        expect(reenvio.corpo['execucaoId'], String(posicao)).toBe(aceitos[posicao])
        // O controle: a chave nova, com o mesmo corpo, é recusada como era.
        expect(erroDe(await perguntar(c.alunoDe9, { ...corpo, chaveEnvio: randomUUID() })), String(posicao)).toEqual(recusas[posicao])
      }
      await executor.ociosa()
      expect(adaptador).not.toHaveBeenCalled()
      expect(await gastos(c.escola)).toEqual(antes)
    })

    // A execução pendente retomada pelo reenvio confere o material de novo, e falha por ele: sem trecho, sem modelo e sem consumo (RF8).
    for (const [rotulo, falha] of [
      ['atividade_objetiva', ErrorCode.MATERIAL_INSUFICIENTE],
      ['plano_de_aula', ErrorCode.MATERIAL_INSUFICIENTE],
      ['chat', ErrorCode.SEM_MATERIAL_DA_SERIE],
    ] as const) {
      it(`${rotulo}: o reenvio com a execução ainda pendente, depois que o material saiu, devolve o mesmo id e a execução falha pelo material sem chamar o modelo`, async () => {
        const c = await cenario()
        const materialId = await materialDe9(c, { deDemonstracao: true })
        const pedido = pedidosDaProfessora(c).find((candidato) => candidato.rotulo === rotulo)
        if (pedido === undefined) throw new Error(`pedido ${rotulo} não montado`)
        const adaptador = vi.spyOn(FakeAdapter.prototype, 'chamar')
        const { aceita, reenvio, execucaoId } = await reenviandoComAExecucaoPendente(c.escola.professora, pedido.caminho, pedido.corpo, async () => {
          await sql('delete from material_serie where escola_id = $1 and material_id = $2', [c.escola.escolaId, materialId])
        })
        expect(reenvio.status).toBe(202)
        expect(reenvio.corpo['execucaoId']).toBe(aceita.corpo['execucaoId'])
        expect(await estadoDaExecucao(c.escola.escolaId, execucaoId)).toEqual([{ estado: 'falhou', erro: falha }])
        expect(adaptador).not.toHaveBeenCalled()
        expect(await contarNaEscola(bancada, 'consumo_ia', c.escola.escolaId, `execucao_id = '${execucaoId}'`)).toBe(0)
        expect(await contarNaEscola(bancada, 'execucao_agente', c.escola.escolaId, `chave_envio = '${String(pedido.corpo.chaveEnvio)}'`)).toBe(1)
      })
    }

    it('o Tutor com a execução ainda pendente no reenvio devolve o mesmo id, e a execução falha pelo material, sem resposta, sem consumo e sem chamar o modelo', async () => {
      const c = await cenario()
      const licencaId = await licencaDe(c, '2026-01-01')
      const materialId = await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId, deDemonstracao: true })
      const adaptador = vi.spyOn(FakeAdapter.prototype, 'chamar')
      const corpo = { texto: 'não entendi o reagente limitante', atividadeAplicadaId: c.atividadeDe9, materialId, pagina: 1, chaveEnvio: randomUUID() }
      const { aceita, reenvio, execucaoId } = await reenviandoComAExecucaoPendente(c.alunoDe9, '/v1/tutor/mensagens', corpo, async () => {
        await sql(`update licenca_de_material set vigente_ate = '2026-11-12' where id = $1`, [licencaId])
      })
      expect(reenvio.status).toBe(202)
      expect(reenvio.corpo['execucaoId']).toBe(aceita.corpo['execucaoId'])
      expect(await estadoDaExecucao(c.escola.escolaId, execucaoId)).toEqual([{ estado: 'falhou', erro: ErrorCode.NAO_ENCONTRADO }])
      expect(adaptador).not.toHaveBeenCalled()
      expect(await contarNaEscola(bancada, 'consumo_ia', c.escola.escolaId, `execucao_id = '${execucaoId}'`)).toBe(0)
      const { rows: mensagens } = await sql<{ autor: string }>('select autor from mensagem_tutor where escola_id = $1 and aluno_id = $2', [c.escola.escolaId, c.alunoDe9.usuarioId])
      expect(mensagens).toEqual([{ autor: 'aluno' }])
    })

    it('a chave aceita para um aluno não abre a recusa para outro da mesma turma: ele recebe a mesma resposta da chave nova', async () => {
      const c = await cenario()
      const licencaId = await licencaDe(c, '2026-01-01')
      const materialId = await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId, deDemonstracao: true })
      const colega = await novoAluno(c.escola, c.turma9)
      const corpos = [
        { texto: 'não entendi o reagente limitante', atividadeAplicadaId: c.atividadeDe9, materialId, pagina: 1, chaveEnvio: randomUUID() },
        { texto: 'não entendi o reagente limitante', atividadeAplicadaId: c.atividadeDe9, chaveEnvio: randomUUID() },
      ]
      for (const corpo of corpos) await aceitarETerminar(c.alunoDe9, '/v1/tutor/mensagens', corpo, 'do primeiro aluno')

      await sql(`update licenca_de_material set vigente_ate = '2026-11-12' where id = $1`, [licencaId])
      const antes = await gastos(c.escola)
      const recusas = [
        { status: 404, codigo: ErrorCode.NAO_ENCONTRADO },
        { status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE },
      ]
      for (const [posicao, corpo] of corpos.entries()) {
        expect(erroDe(await post(colega, '/v1/tutor/mensagens', corpo)), String(posicao)).toEqual(recusas[posicao])
        expect(erroDe(await post(colega, '/v1/tutor/mensagens', { ...corpo, chaveEnvio: randomUUID() })), String(posicao)).toEqual(recusas[posicao])
      }
      expect(await gastos(c.escola)).toEqual(antes)
    })

    it('a chave aceita na escola A não abre a recusa para a professora da escola B: ela recebe a mesma resposta da chave nova', async () => {
      const c = await cenario()
      const materialId = await materialDe9(c, { deDemonstracao: true })
      const pedidosDaA = pedidosDaProfessora(c)
      for (const pedido of pedidosDaA) await aceitarETerminar(c.escola.professora, pedido.caminho, pedido.corpo, pedido.rotulo)
      const b = await montarEscolaComAssistente(api, bancada)
      await sql('delete from material_serie where escola_id = $1 and material_id = $2', [c.escola.escolaId, materialId])
      await sql('delete from material_serie where escola_id = $1 and material_id = $2', [b.escolaId, b.materialId])
      const antes = await gastos(b)
      for (const pedido of pedidosDaA) {
        const daB = { ...pedido.corpo, turmaId: b.turma, disciplinaId: b.quimica }
        const recusa = { status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE }
        expect(erroDe(await post(b.professora, pedido.caminho, daB)), pedido.rotulo).toEqual(recusa)
        expect(erroDe(await post(b.professora, pedido.caminho, { ...daB, chaveEnvio: randomUUID() })), pedido.rotulo).toEqual(recusa)
      }
      expect(await gastos(b)).toEqual(antes)
    })
  })

  describe('o Tutor: a D36 vem antes do filtro, e a recusa não deixa rastro', () => {
    /**
     * Os três casos em que o filtro recusaria a pergunta comum: a turma sem material da série, a página aberta de uma edição já substituída, e a de material com licença vencida. A pergunta
     * de assunto delicado, nos três, recebe a mensagem fixa da D36 e o sinal `atencao_humana`: o encaminhamento nunca depende do material.
     */
    const CASOS = [
      {
        caso: 'a turma sem material da série',
        preparar: async (c: Cenario) => ({ atividadeAplicadaId: c.atividadeDe9 }),
        recusa: { status: 422, codigo: ErrorCode.SEM_MATERIAL_DA_SERIE },
      },
      {
        caso: 'a página aberta de uma edição já substituída',
        preparar: async (c: Cenario) => {
          const antiga = await materialDe9(c, { substituido: true, titulo: 'Edição antiga' })
          await materialDe9(c, { titulo: 'Edição nova' })
          return { atividadeAplicadaId: c.atividadeDe9, materialId: antiga, pagina: 1 }
        },
        recusa: { status: 404, codigo: ErrorCode.NAO_ENCONTRADO },
      },
      {
        caso: 'a página aberta de material com a licença vencida',
        preparar: async (c: Cenario) => {
          const vencido = await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId: await licencaDe(c, '2026-01-01', '2026-11-12') })
          return { atividadeAplicadaId: c.atividadeDe9, materialId: vencido, pagina: 1 }
        },
        recusa: { status: 404, codigo: ErrorCode.NAO_ENCONTRADO },
      },
    ]

    it.each(CASOS)('assunto delicado com $caso: a mensagem fixa e o sinal atencao_humana, e nada de SEM_MATERIAL_DA_SERIE nem de NAO_ENCONTRADO', async ({ preparar }) => {
      const c = await cenario()
      const onde = await preparar(c)
      const aceita = await perguntar(c.alunoDe9, { ...onde, texto: 'eu apanho em casa' })
      expect(aceita.status).toBe(202)
      const execucao = await execucaoTerminada(api, c.alunoDe9, aceita.corpo['execucaoId'] as string)
      expect(execucao.estado).toBe('concluida')
      expect(execucao.resultado?.mensagem).toMatchObject({ tipo: 'assunto_delicado', autor: 'tutor' })
      const { rows } = await sql<{ tipo: string }>('select tipo from sinal_tutor where escola_id = $1 and aluno_id = $2', [c.escola.escolaId, c.alunoDe9.usuarioId])
      expect(rows.map((linha) => linha.tipo)).toEqual(['atencao_humana'])
    })

    it.each(CASOS)('a pergunta comum com $caso é recusada, e nada fica em mensagem_tutor, no uso nem na execução', async ({ preparar, recusa }) => {
      const c = await cenario()
      const onde = await preparar(c)
      const antes = await gastos(c.escola)
      expect(erroDe(await perguntar(c.alunoDe9, onde))).toEqual(recusa)
      expect(await gastos(c.escola)).toEqual(antes)
      expect(await contarNaEscola(bancada, 'mensagem_tutor', c.escola.escolaId, `aluno_id = '${c.alunoDe9.usuarioId}'`)).toBe(0)
      const uso = await get(c.escola.professora, `/v1/tutor/uso?turmaId=${c.turma9}`)
      expect(uso.status).toBe(200)
      expect((uso.corpo['alunos'] as Array<{ trocasHoje?: number }>).reduce((soma, linha) => soma + (linha.trocasHoje ?? 0), 0)).toBe(0)
    })

    /**
     * Segura a execução entre o `202` e a conferência (a transição `rodando`), muda o que o caso quer, solta, e devolve a execução terminada. O gatilho para quando a execução do aluno vira `rodando`.
     */
    async function mudandoEntreO202EAExecucao(c: Cenario, corpo: Record<string, unknown>, mudar: () => Promise<void>): Promise<{ aceita: RespostaHttp; execucaoId: string }> {
      await executor.ociosa()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.solicitada_por = '${c.alunoDe9.usuarioId}'::uuid and new.estado = 'rodando'` })
      await parada.armar()
      let aceita: RespostaHttp
      try {
        aceita = await perguntar(c.alunoDe9, corpo)
        expect(aceita.status).toBe(202)
        await parada.esperarParadas(1)
        await mudar()
      } finally {
        await parada.desarmar()
      }
      await executor.ociosa()
      return { aceita, execucaoId: aceita.corpo['execucaoId'] as string }
    }

    it('[P] a licença vence entre o 202 e a conferência: a execução falha como inexistente, sem trecho, sem consumo e sem resposta, e a pergunta fica só na conversa', async () => {
      const c = await cenario()
      const licencaId = await licencaDe(c, '2026-01-01')
      const materialId = await materialDe9(c, { titularidade: 'terceiro_com_licenca', licencaId })
      const buscarTrechos = vi.spyOn(api.app.get(TrechoSearch), 'buscar')
      const { execucaoId } = await mudandoEntreO202EAExecucao(c, { atividadeAplicadaId: c.atividadeDe9, materialId, pagina: 1 }, async () => {
        await sql(`update licenca_de_material set vigente_ate = '2026-11-12' where id = $1`, [licencaId])
      })
      const { rows } = await sql<{ estado: string; erro: string | null }>('select estado, erro from execucao_agente where escola_id = $1 and id = $2', [c.escola.escolaId, execucaoId])
      expect(rows).toEqual([{ estado: 'falhou', erro: ErrorCode.NAO_ENCONTRADO }])
      expect(buscarTrechos).not.toHaveBeenCalled()
      expect(await contarNaEscola(bancada, 'consumo_ia', c.escola.escolaId, `execucao_id = '${execucaoId}'`)).toBe(0)
      const { rows: mensagens } = await sql<{ autor: string }>('select autor from mensagem_tutor where escola_id = $1 and aluno_id = $2', [c.escola.escolaId, c.alunoDe9.usuarioId])
      expect(mensagens).toEqual([{ autor: 'aluno' }])
    })

    it('[P] o único material da série sai entre o 202 e a conferência: a execução falha com SEM_MATERIAL_DA_SERIE, e a recusa é contada na turma', async () => {
      const c = await cenario()
      const materialId = await materialDe9(c)
      const { execucaoId } = await mudandoEntreO202EAExecucao(c, { atividadeAplicadaId: c.atividadeDe9 }, async () => {
        await sql('delete from material_serie where escola_id = $1 and material_id = $2', [c.escola.escolaId, materialId])
      })
      const { rows } = await sql<{ estado: string; erro: string | null }>('select estado, erro from execucao_agente where escola_id = $1 and id = $2', [c.escola.escolaId, execucaoId])
      expect(rows).toEqual([{ estado: 'falhou', erro: ErrorCode.SEM_MATERIAL_DA_SERIE }])
      expect(await contarNaEscola(bancada, 'consumo_ia', c.escola.escolaId, `execucao_id = '${execucaoId}'`)).toBe(0)
    })

    it('as recusas por falta de material são contadas por turma, sem aluno nem escola', async () => {
      const c = await cenario()
      const lidas = async (turmaId: string) =>
        (await medidor.pontos('tutor.recusa_sem_material')).filter((ponto) => ponto.atributos['turma_id'] === turmaId).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
      const antesDe9 = await lidas(c.turma9)
      const antesDe2 = await lidas(c.escola.turma)
      expect(erroDe(await perguntar(c.alunoDe9, { atividadeAplicadaId: c.atividadeDe9 })).codigo).toBe(ErrorCode.SEM_MATERIAL_DA_SERIE)
      expect(erroDe(await perguntar(c.alunoDe9, { atividadeAplicadaId: c.atividadeDe9 })).codigo).toBe(ErrorCode.SEM_MATERIAL_DA_SERIE)
      // A pergunta aceita da outra turma não conta.
      expect((await perguntar(c.alunoDe2, { atividadeAplicadaId: c.atividadeDe2 })).status).toBe(202)
      await executor.ociosa()

      expect(await lidas(c.turma9)).toBe(antesDe9 + 2)
      expect(await lidas(c.escola.turma)).toBe(antesDe2)
      const atributos = (await medidor.pontos('tutor.recusa_sem_material')).flatMap((ponto) => Object.keys(ponto.atributos))
      expect(new Set(atributos)).toEqual(new Set(['turma_id']))
      expect(JSON.stringify(await medidor.pontos('tutor.recusa_sem_material'))).not.toContain(c.alunoDe9.usuarioId)
    })
  })

  describe('a virada do ano', () => {
    it('a turma do 9º de 2027 acha o material declarado do 9º em 2026; o aluno que passou do 8º para o 9º só acha o do 9º', async () => {
      const c = await cenario()
      const token = await c.escola.coordenacao.tokenNovo()
      const serie8 = (await chamar(api.url, 'POST', '/v1/series', token, { etapa: 'ef_anos_finais', ano: 8 })).corpo['id'] as string
      const turma8 = (await chamar(api.url, 'POST', '/v1/turmas', token, { serieId: serie8, nome: '8ºA' })).corpo['id'] as string
      await vincularProfessor(bancada, c.escola, c.escola.professora.usuarioId, turma8, c.escola.quimica)
      const materialDe8 = await semearMaterial(bancada.pool, c.escola.escolaId, c.escola.quimica, c.escola.coordenacao.usuarioId, { serieIds: [serie8], titulo: 'Material do 8º' })
      const materialDoNono = await materialDe9(c, { titulo: 'Material do 9º' })
      const aluno = await novoAluno(c.escola, turma8)

      // Em 2026 o aluno está no 8º: acha o material dele e não o do 9º.
      const atividadeDe8 = await aplicarAtividade(bancada, c.escola, { turmaId: turma8 })
      expect((await perguntar(aluno, { atividadeAplicadaId: atividadeDe8, materialId: materialDe8, pagina: 1 })).status).toBe(202)
      await executor.ociosa()

      // Vira o ano: 2026 encerra, 2027 entra, a turma do 9º e o vínculo do aluno são do ano novo, e a série (e o material dela) são os mesmos.
      await sql(`update ano_letivo set situacao = 'encerrado' where id = $1`, [c.escola.anoLetivoId])
      const { rows: anos } = await sql<{ id: string }>(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'em_curso') returning id`, [c.escola.escolaId])
      const anoLetivoId = anos[0]?.id ?? ''
      const { rows: turmas } = await sql<{ id: string }>(`insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '9ºA de 2027') returning id`, [c.escola.escolaId, anoLetivoId, c.serie9])
      const turma2027 = turmas[0]?.id ?? ''
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`, [
        c.escola.escolaId,
        anoLetivoId,
        c.escola.professora.usuarioId,
        turma2027,
        c.escola.quimica,
        c.escola.coordenacao.usuarioId,
      ])
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [
        c.escola.escolaId,
        anoLetivoId,
        aluno.usuarioId,
        turma2027,
        c.escola.coordenacao.usuarioId,
      ])
      const de2027 = { ...c.escola, anoLetivoId }
      const atividadeDe2027 = await aplicarAtividade(bancada, de2027, { turmaId: turma2027 })

      expect((await perguntar(aluno, { atividadeAplicadaId: atividadeDe2027, materialId: materialDoNono, pagina: 1 })).status).toBe(202)
      await executor.ociosa()
      // O material do 8º, que ele leu em 2026, já não é o da turma dele.
      expect(erroDe(await perguntar(aluno, { atividadeAplicadaId: atividadeDe2027, materialId: materialDe8, pagina: 1 }))).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      await sql(`update ano_letivo set situacao = 'encerrado' where id = $1`, [anoLetivoId])
      await sql(`update ano_letivo set situacao = 'em_curso' where id = $1`, [c.escola.anoLetivoId])
    })
  })

  describe('isolamento entre escolas', () => {
    it('a busca e a página aberta da escola A com a série da escola B voltam vazias, e a série da B na rota da A não abre nada', async () => {
      const a = await cenario()
      const b = await cenario()
      const porta = api.app.get(TrechoSearch)
      // O material da B existe, na série dela, com a mesma palavra: só o escopo da escola o separa.
      const daB = await materialDe9(b, { titulo: 'Material da outra escola' })
      const pedido = { texto: 'reagente limitante', disciplinaId: a.escola.quimica, limite: 20 }
      expect(await noContexto(a.escola, () => porta.buscar({ ...pedido, serieId: b.serie9 }))).toEqual([])
      expect(await noContexto(a.escola, () => porta.doMaterial(daB, a.escola.quimica, b.serie9))).toEqual([])
      expect(await noContexto(a.escola, () => porta.doMaterial(a.escola.materialId, a.escola.quimica, b.serie9))).toEqual([])
      expect(await noContexto(a.escola, () => porta.existeMaterialDaSerie({ serieId: b.serie9, disciplinaId: a.escola.quimica }))).toBe(false)
      expect(await buscar(a.escola.coordenacao, `&serieId=${b.serie9}`)).toEqual([])
      // A disciplina e a série da B juntas, no contexto da A: a disciplina deixa de descartar o material, e só o corte por escola o separa.
      const pedidoDaB = { texto: 'reagente limitante', disciplinaId: b.escola.quimica, limite: 20 }
      expect(await noContexto(a.escola, () => porta.buscar({ ...pedidoDaB, serieId: b.serie9 }))).toEqual([])
      expect(await noContexto(a.escola, () => porta.existeMaterialDaSerie({ serieId: b.serie9, disciplinaId: b.escola.quimica }))).toBe(false)
      // A mesma série, na escola dona dela, acha o material: o vazio de cima é o escopo, e não a falta de material.
      expect(await noContexto(b.escola, () => porta.buscar({ ...pedido, disciplinaId: b.escola.quimica, serieId: b.serie9 }))).toHaveLength(2)
    })

    it('os dois helpers do filtro carregam o corte por escola: sozinhos, sem o escopo da consulta de fora, não casam material de outra escola', async () => {
      const a = await cenario()
      const b = await cenario()
      const banco = api.app.get<Database>(DB)
      const daB = await materialDe9(b, { titulo: 'Material da outra escola' })
      const deTerceiroDaB = await materialDe9(b, { titularidade: 'terceiro_com_licenca', licencaId: await licencaDe(b, '2026-01-01'), titulo: 'Material de terceiro da outra escola' })
      // A consulta não leva o `eq(material.escolaId, ...)`: o que separa as escolas é só o corte de dentro do fragmento, construído no contexto de quem lê.
      const casam = (escola: EscolaComAssistente, id: string, fragmento: (banco: Database) => SQL | undefined): Promise<string[]> =>
        noContexto(escola, async () => (await banco.select({ id: material.id }).from(material).where(and(eq(material.id, id), fragmento(banco)))).map((linha) => linha.id))
      const daSerie = (banco: Database) => declaradoParaASerie(banco, b.serie9)
      const comLicenca = (banco: Database) => proprioOuComLicencaVigente(banco, '2026-11-13')
      expect(await casam(a.escola, daB, daSerie)).toEqual([])
      expect(await casam(a.escola, deTerceiroDaB, comLicenca)).toEqual([])
      // O controle: na escola dona, os mesmos fragmentos casam.
      expect(await casam(b.escola, daB, daSerie)).toEqual([daB])
      expect(await casam(b.escola, deTerceiroDaB, comLicenca)).toEqual([deTerceiroDaB])
    })
  })
})
