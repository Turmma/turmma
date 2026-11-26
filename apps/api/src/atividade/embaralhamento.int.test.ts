import { runInContext, type RequestContext } from '@educa/core'
import { desempenhoDaTurmaResponseSchema, meuDiagnosticoResponseSchema, provaOnlineResponseSchema, type PapelDeUsuario, type ProvaEmAndamentoResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { subirApi, type TestApi, type RespostaHttp } from '../../test/test-api.js'
import { TEST_APP_OPTIONS } from '../../test/test-config.js'
import { alunosComSessao, aplicarAtividade, criarAtividade, encerrarAtividade, aprovarOLote, rotasDaAtividade, GABARITO_DE_TESTE, HABILIDADE_DAS_DUAS_ULTIMAS, HABILIDADE_DAS_TRES_PRIMEIRAS, type RotasDaAtividade } from '../../test/atividade.fixture.js'
import { montarEscolaComAssistente, type EscolaComAssistente } from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import { MinhaAtividadeRepository } from './minha-atividade/minha-atividade.repository.js'
import type { Sorteador } from './minha-atividade/ordem-da-prova.js'

/**
 * O embaralhamento por aluno (avaliacao-e-correcao, 4.0; RF8; Tech Spec §5.3): cada aluno recebe questões e alternativas numa ordem própria, sorteada **uma vez**, no `comecar`, e a mesma
 * em toda leitura; a resposta, a correção, o relatório e o diagnóstico seguem pelo número da questão e pelo índice da alternativa **originais**.
 *
 * O teste não depende do acaso: o sorteador é injetado com um roteiro. Com `n` questões, o roteiro de quem embaralha tudo é `n - 1` números para as questões (limites `n`, `n - 1`, …, 2)
 * e, para cada questão na ordem original, 3 para as alternativas (limites 4, 3, 2). O sorteador que devolve sempre 0 gira cada lista uma casa para a esquerda.
 */
describe('embaralhamento: a ordem de cada aluno, só de apresentação', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let ana: TestSessao
  let bia: TestSessao
  let caio: TestSessao
  let alunoDoC: TestSessao
  let ultimoPulsoAntes: Date | undefined
  let idsDeIndisponibilidadeAntes: string[] = []

  /** O roteiro do sorteio que vem: cada `comecar` que embaralha consome o seu, na ordem. Roteiro curto, ou número fora do limite, derruba a rota (500) e o caso. */
  const roteiro: number[] = []
  const sorteador: Sorteador = (limite) => {
    const proximo = roteiro.shift()
    if (proximo === undefined || proximo >= limite) throw new Error(`sem sorteio válido para o limite ${String(limite)}`)
    return proximo
  }

  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query(texto, valores)).rows as Registro[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const MIN = 60_000
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  const TUDO = { questoes: true, alternativas: true }

  /** 4 voltas das questões e 3 por questão nas alternativas: o roteiro de quem embaralha as 5 questões do fixture, com 0 em todas as voltas (cada lista gira uma casa). */
  const ZEROS = Array<number>(4 + 5 * 3).fill(0)
  // Questões: [1,1,1,1] dá 1, 3, 4, 5, 2. Alternativas, uma questão por vez: [3,0,0], [0,0,0], [3,2,1], [1,1,1], [2,1,0].
  const ROTEIRO_DA_BIA = [1, 1, 1, 1, 3, 0, 0, 0, 0, 0, 3, 2, 1, 1, 1, 1, 2, 1, 0]
  const ORDEM_DA_ANA = { questoes: [2, 3, 4, 5, 1], alternativas: [[1, 2, 3, 0], [1, 2, 3, 0], [1, 2, 3, 0], [1, 2, 3, 0], [1, 2, 3, 0]] }
  const ORDEM_DA_BIA = { questoes: [1, 3, 4, 5, 2], alternativas: [[1, 2, 0, 3], [1, 2, 3, 0], [0, 1, 2, 3], [0, 2, 3, 1], [3, 0, 1, 2]] }
  const ORIGINAL = { questoes: [1, 2, 3, 4, 5], alternativas: Array.from({ length: 5 }, () => [0, 1, 2, 3]) }

  const pulsar = () => sql('update pulso_da_api set ultimo_em = now()')
  const janela = (abreEmMin = -5, fechaEmMin = 120) => ({ abreEm: new Date(Date.now() + abreEmMin * MIN).toISOString(), fechaEm: new Date(Date.now() + fechaEmMin * MIN).toISOString() })

  /** Uma prova nova (um artefato novo: a mesma aberta duas vezes na turma é `CONFLITO`), com o embaralhamento pedido e, se quiser, outra janela (minutos a partir de agora). */
  async function aplicarProva(embaralhar: { questoes: boolean; alternativas: boolean }, minutosDaJanela: readonly [number, number] = [-5, 120]): Promise<string> {
    return aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma, true, { janela: janela(...minutosDaJanela), duracaoMin: 40, embaralhar })
  }

  const emAndamento = (resposta: RespostaHttp): ProvaEmAndamentoResponse => {
    const prova = provaOnlineResponseSchema.parse(resposta.corpo)
    if (!prova.comecou) throw new Error('a prova ainda não tinha começado')
    return prova
  }
  const ordemGravada = async (id: string, aluno: TestSessao) => (await sql<{ ordem: unknown }>('select ordem from tentativa_atividade where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId]))[0]?.ordem
  const contarTentativas = async (id: string) => Number((await sql<{ total: string }>('select count(*) as total from tentativa_atividade where atividade_aplicada_id = $1', [id]))[0]?.total)
  const comecarCom = async (aluno: TestSessao, id: string, sorteio: readonly number[]): Promise<ProvaEmAndamentoResponse> => {
    roteiro.splice(0, roteiro.length, ...sorteio)
    const resposta = await rotas.comecar(aluno, id)
    expect(resposta.status).toBe(200)
    expect(roteiro, 'o `comecar` consumiu o roteiro inteiro').toEqual([])
    return emAndamento(resposta)
  }

  /** O texto que o aluno procura na tela: o da alternativa certa, ou o da seguinte (errada). O fixture dá a cada alternativa o texto da sua letra original. */
  const textoDaEscolha = (numero: number, acerta: boolean): string => `Alternativa ${'ABCD'[((GABARITO_DE_TESTE[numero - 1] ?? 0) + (acerta ? 0 : 1)) % 4] ?? ''}`
  /** A posição em que a tela mostra a alternativa certa da questão. */
  const posicaoDaCerta = (prova: ProvaEmAndamentoResponse, numero: number): number => prova.questoes.find((questao) => questao.numero === numero)?.alternativas.indexOf(textoDaEscolha(numero, true)) ?? -1

  /** O aluno responde como a tela: lê a prova na ordem dele, escolhe **pelo texto** e manda o índice original da alternativa que está naquela posição. `acertos[n - 1]` diz se a questão `n` é acertada. */
  async function responderComoATela(aluno: TestSessao, id: string, acertos: readonly boolean[]): Promise<void> {
    const prova = emAndamento(await rotas.prova(aluno, id))
    for (const questao of prova.questoes) {
      const posicao = questao.alternativas.indexOf(textoDaEscolha(questao.numero, acertos[questao.numero - 1] === true))
      const original = questao.ordemDasAlternativas[posicao]
      if (original === undefined) throw new Error('a alternativa não está na tela')
      expect((await rotas.responder(aluno, id, questao.numero, original)).status).toBe(200)
    }
    expect((await rotas.enviar(aluno, id)).status).toBe(200)
  }

  const diagnosticoDe = async (aluno: TestSessao, id: string) => meuDiagnosticoResponseSchema.parse((await rotas.diagnostico(aluno, id)).corpo)
  const resumoDoDiagnostico = (diagnostico: Awaited<ReturnType<typeof diagnosticoDe>>) => ({
    acertos: diagnostico.acertos,
    total: diagnostico.total,
    porHabilidade: diagnostico.porHabilidade.map(({ habilidade, acertos, total }) => ({ codigo: habilidade?.codigo, acertos, total })),
    questoes: diagnostico.questoes.map(({ numero, alternativa, correta }) => ({ numero, alternativa, correta })),
  })

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '2000', LIMITE_REQ_ESCOLA_MIN: '2000' } }, undefined, { ...TEST_APP_OPTIONS, sorteadorDaProva: sorteador })
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    ;[ana, bia, caio] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluno Sintético Caio'])) as [TestSessao, TestSessao, TestSessao]
    ;[alunoDoC] = (await alunosComSessao(bancada, a, a.outraTurma, ['Aluno Sintético do 2ºC'])) as [TestSessao]
    idsDeIndisponibilidadeAntes = (await sql<{ id: string }>('select id from indisponibilidade')).map(({ id }) => id)
    ultimoPulsoAntes = (await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api'))[0]?.ultimo_em
  })

  beforeEach(async () => {
    roteiro.length = 0
    await pulsar()
  })

  afterAll(async () => {
    await sql('delete from indisponibilidade where id <> all($1::uuid[])', [idsDeIndisponibilidadeAntes])
    if (ultimoPulsoAntes !== undefined) await sql('update pulso_da_api set ultimo_em = $1', [ultimoPulsoAntes])
    await api.app.close()
    await bancada.fechar()
  })

  it('sorteio fixo, dois alunos: ordens diferentes e conhecidas; a alternativa certa fica em posição de tela diferente nos dois, e acerta nos dois pelo índice original', async () => {
    const id = await aplicarProva(TUDO)
    const daAna = await comecarCom(ana, id, ZEROS)
    const daBia = await comecarCom(bia, id, ROTEIRO_DA_BIA)

    // A ordem gravada, por aluno, e a prova na ordem dele: o número é o original, e cada alternativa traz o índice original e o texto dele.
    expect(await ordemGravada(id, ana)).toEqual(ORDEM_DA_ANA)
    expect(await ordemGravada(id, bia)).toEqual(ORDEM_DA_BIA)
    expect(daAna.questoes.map((questao) => questao.numero)).toEqual([2, 3, 4, 5, 1])
    expect(daBia.questoes.map((questao) => questao.numero)).toEqual([1, 3, 4, 5, 2])
    expect(daAna.questoes.map((questao) => questao.ordemDasAlternativas)).toEqual(Array.from({ length: 5 }, () => [1, 2, 3, 0]))
    // Cada questão usa a ordem de alternativas do **número dela**, e não a da posição em que aparece: as questões 1, 3, 4, 5 e 2.
    expect(daBia.questoes.map((questao) => questao.ordemDasAlternativas)).toEqual([[1, 2, 0, 3], [0, 1, 2, 3], [0, 2, 3, 1], [3, 0, 1, 2], [1, 2, 3, 0]])
    expect(daBia.questoes[0]?.alternativas).toEqual(['Alternativa B', 'Alternativa C', 'Alternativa A', 'Alternativa D'])
    expect(daBia.questoes[0]?.enunciado).toBe('Enunciado sintético da questão 1')
    // A leitura da prova é a que o aluno recebeu ao começar, e a de um não é a do outro.
    expect(emAndamento(await rotas.prova(ana, id)).questoes).toEqual(daAna.questoes)
    expect(emAndamento(await rotas.prova(bia, id)).questoes).toEqual(daBia.questoes)

    // A certa da questão 1 está na posição 3 da Ana e na 2 da Bia: marcar pela posição da tela erraria numa delas.
    expect([posicaoDaCerta(daAna, 1), posicaoDaCerta(daBia, 1)]).toEqual([3, 2])
    await responderComoATela(ana, id, [true, true, true, true, true])
    await responderComoATela(bia, id, [true, true, true, true, true])
    for (const aluno of [ana, bia]) {
      const gravadas = await sql<{ questao: number; alternativa: number }>('select questao, alternativa from resposta_atividade where atividade_aplicada_id = $1 and aluno_id = $2 order by questao', [id, aluno.usuarioId])
      // O que fica gravado é o índice original: o gabarito, questão a questão, e não a posição da tela.
      expect(gravadas.map(({ questao, alternativa }) => [questao, alternativa])).toEqual(GABARITO_DE_TESTE.map((gabarito, indice) => [indice + 1, gabarito]))
    }
    await encerrarAtividade(rotas, a.professora, id)
    await aprovarOLote(rotas, a.professora, id)
    for (const aluno of [ana, bia]) expect(resumoDoDiagnostico(await diagnosticoDe(aluno, id))).toMatchObject({ acertos: 5, total: 5 })
  })

  it('o desempenho por habilidade e o diagnóstico com a ordem embaralhada são os da ordem original: a mesma resposta lógica, o mesmo resultado', async () => {
    // A turma é a do arquivo inteiro: o desempenho se lê antes e depois, e o que o lote acrescenta é a diferença (outro caso aprova o dele).
    const antes = desempenhoDaTurmaResponseSchema.parse((await rotas.desempenho(a.professora, a.turma)).corpo)
    const embaralhada = await aplicarProva(TUDO)
    await comecarCom(ana, embaralhada, ZEROS)
    await comecarCom(bia, embaralhada, ROTEIRO_DA_BIA)
    // Ana erra só a 4; Bia erra a 1 e a 5. As questões 1 a 3 são de uma habilidade e as 4 e 5, de outra.
    await responderComoATela(ana, embaralhada, [true, true, true, false, true])
    await responderComoATela(bia, embaralhada, [false, true, true, true, false])
    await encerrarAtividade(rotas, a.professora, embaralhada)
    await aprovarOLote(rotas, a.professora, embaralhada)

    const diagnosticoDaAna = resumoDoDiagnostico(await diagnosticoDe(ana, embaralhada))
    expect(diagnosticoDaAna).toEqual({
      acertos: 4,
      total: 5,
      porHabilidade: [{ codigo: HABILIDADE_DAS_TRES_PRIMEIRAS.codigo, acertos: 3, total: 3 }, { codigo: HABILIDADE_DAS_DUAS_ULTIMAS.codigo, acertos: 1, total: 2 }],
      // O diagnóstico segue a ordem original e o índice original: errou a 4 marcando a alternativa A (0) no lugar da D (3).
      questoes: [{ numero: 1, alternativa: 0, correta: true }, { numero: 2, alternativa: 1, correta: true }, { numero: 3, alternativa: 2, correta: true }, { numero: 4, alternativa: 0, correta: false }, { numero: 5, alternativa: 0, correta: true }],
    })
    expect(resumoDoDiagnostico(await diagnosticoDe(bia, embaralhada))).toEqual({
      acertos: 3,
      total: 5,
      porHabilidade: [{ codigo: HABILIDADE_DAS_TRES_PRIMEIRAS.codigo, acertos: 2, total: 3 }, { codigo: HABILIDADE_DAS_DUAS_ULTIMAS.codigo, acertos: 1, total: 2 }],
      questoes: [{ numero: 1, alternativa: 1, correta: false }, { numero: 2, alternativa: 1, correta: true }, { numero: 3, alternativa: 2, correta: true }, { numero: 4, alternativa: 3, correta: true }, { numero: 5, alternativa: 1, correta: false }],
    })

    // O desempenho da turma, só deste lote: na primeira habilidade Ana 3 e Bia 2 de 6; na segunda, Ana 1 e Bia 1 de 4. É o da ordem original.
    const depois = desempenhoDaTurmaResponseSchema.parse((await rotas.desempenho(a.professora, a.turma)).corpo)
    const somaDe = (desempenho: typeof depois, codigo: string) => desempenho.porHabilidade.find(({ habilidade }) => habilidade?.codigo === codigo) ?? { acertos: 0, total: 0 }
    expect(depois.lotesAprovados - antes.lotesAprovados).toBe(1)
    for (const [habilidade, acertos, total] of [[HABILIDADE_DAS_TRES_PRIMEIRAS, 5, 6], [HABILIDADE_DAS_DUAS_ULTIMAS, 2, 4]] as const) {
      expect([somaDe(depois, habilidade.codigo).acertos - somaDe(antes, habilidade.codigo).acertos, somaDe(depois, habilidade.codigo).total - somaDe(antes, habilidade.codigo).total]).toEqual([acertos, total])
    }

    // E a mesma resposta lógica da Ana, numa aplicação que não embaralha, dá exatamente o mesmo diagnóstico.
    const original = await aplicarProva({ questoes: false, alternativas: false })
    await comecarCom(caio, original, [])
    await responderComoATela(caio, original, [true, true, true, false, true])
    await encerrarAtividade(rotas, a.professora, original)
    await aprovarOLote(rotas, a.professora, original)
    expect(resumoDoDiagnostico(await diagnosticoDe(caio, original))).toEqual(diagnosticoDaAna)
  })

  it('só alternativas: as questões ficam na ordem original e só as alternativas mudam; o sorteio das questões nem acontece', async () => {
    const id = await aplicarProva({ questoes: false, alternativas: true })
    // 5 questões × 3 voltas das alternativas, e nenhuma volta de questões: um roteiro de 15, que o `comecarCom` confere por inteiro.
    const prova = await comecarCom(ana, id, Array<number>(5 * 3).fill(0))
    expect(prova.questoes.map((questao) => questao.numero)).toEqual([1, 2, 3, 4, 5])
    expect(prova.questoes.map((questao) => questao.ordemDasAlternativas)).toEqual(Array.from({ length: 5 }, () => [1, 2, 3, 0]))
    expect(prova.questoes[0]?.alternativas).toEqual(['Alternativa B', 'Alternativa C', 'Alternativa D', 'Alternativa A'])
    expect(await ordemGravada(id, ana)).toEqual({ questoes: [1, 2, 3, 4, 5], alternativas: Array.from({ length: 5 }, () => [1, 2, 3, 0]) })
  })

  it('só questões: as alternativas ficam na ordem original e só as questões mudam; o sorteio das alternativas nem acontece', async () => {
    const id = await aplicarProva({ questoes: true, alternativas: false })
    const prova = await comecarCom(ana, id, [0, 0, 0, 0])
    expect(prova.questoes.map((questao) => questao.numero)).toEqual([2, 3, 4, 5, 1])
    expect(prova.questoes.map((questao) => questao.ordemDasAlternativas)).toEqual(Array.from({ length: 5 }, () => [0, 1, 2, 3]))
    expect(prova.questoes[0]?.alternativas).toEqual(['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'])
    expect(await ordemGravada(id, ana)).toEqual({ questoes: [2, 3, 4, 5, 1], alternativas: ORIGINAL.alternativas })
  })

  it('sem embaralhar: a `ordem` é nula e a prova é a original, mesmo com um sorteador que embaralharia', async () => {
    const id = await aplicarProva({ questoes: false, alternativas: false })
    roteiro.push(...ZEROS)
    const resposta = await rotas.comecar(ana, id)
    expect(resposta.status).toBe(200)
    const prova = emAndamento(resposta)
    expect(prova.questoes.map((questao) => questao.numero)).toEqual([1, 2, 3, 4, 5])
    expect(prova.questoes.map((questao) => questao.ordemDasAlternativas)).toEqual(ORIGINAL.alternativas)
    expect(prova.questoes[0]?.alternativas).toEqual(['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'])
    expect(await ordemGravada(id, ana)).toBeNull()
    // O sorteador nem foi chamado: o roteiro está inteiro.
    expect(roteiro).toHaveLength(ZEROS.length)
  })

  it('retomada: a segunda leitura (`comecar` de novo, `prova`, e a prova depois de responder) traz a mesma ordem, e ninguém sorteia de novo', async () => {
    const id = await aplicarProva(TUDO)
    const primeira = await comecarCom(bia, id, ROTEIRO_DA_BIA)
    // Um roteiro que daria outra ordem à espera: se alguma leitura sorteasse, ele seria consumido.
    roteiro.push(...ZEROS)
    expect(emAndamento(await rotas.comecar(bia, id)).questoes).toEqual(primeira.questoes)
    expect(emAndamento(await rotas.prova(bia, id)).questoes).toEqual(primeira.questoes)
    expect(primeira.questoes[1]?.numero).toBe(3)
    expect((await rotas.responder(bia, id, 3, 2)).status).toBe(200)
    const depois = emAndamento(await rotas.prova(bia, id))
    expect(depois.questoes).toEqual(primeira.questoes)
    expect(depois.respostas.map(({ questao, alternativa }) => [questao, alternativa])).toEqual([[3, 2]])
    expect(roteiro).toHaveLength(ZEROS.length)
    expect(await ordemGravada(id, bia)).toEqual(ORDEM_DA_BIA)
    expect(await contarTentativas(id)).toBe(1)
  })

  it('(a) começar × começar com a primeira segurada: a segunda sorteia outra ordem, espera, e a gravada e a devolvida são as da primeira', async () => {
    const id = await aplicarProva(TUDO)
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'tentativa_atividade', evento: 'insert', quando: `new.atividade_aplicada_id = '${id}'` })
    roteiro.push(...ROTEIRO_DA_BIA)
    await parada.armar()
    let primeira: Promise<RespostaHttp> | undefined
    let segunda: Promise<RespostaHttp> | undefined
    try {
      primeira = rotas.comecar(caio, id)
      await parada.esperarParadas(1)
      expect(roteiro, 'a primeira já sorteou a ordem dela').toEqual([])
      // A segunda sorteia a ordem dela (a rotação, outra) antes do `insert`, e espera na chave única a primeira terminar.
      roteiro.push(...ZEROS)
      segunda = rotas.comecar(caio, id)
      await esperarNaTrava(bancada.pool, '%tentativa_atividade%', 2)
      expect(roteiro, 'a segunda já sorteou a dela').toEqual([])
    } finally {
      await parada.desarmar()
    }
    const [daPrimeira, daSegunda] = [emAndamento(await (primeira as Promise<RespostaHttp>)), emAndamento(await (segunda as Promise<RespostaHttp>))]
    expect(daPrimeira.questoes.map((questao) => questao.numero)).toEqual([1, 3, 4, 5, 2])
    expect(daSegunda.questoes).toEqual(daPrimeira.questoes)
    expect(await ordemGravada(id, caio)).toEqual(ORDEM_DA_BIA)
    expect(await contarTentativas(id)).toBe(1)
  })

  it('o alcance vem antes do sorteio: o aluno de outra turma recebe NAO_ENCONTRADO, sem tentativa e sem sortear; e a ordem de um colega nunca é a de quem lê', async () => {
    const id = await aplicarProva(TUDO)
    roteiro.push(...ZEROS)
    expect(erro(await rotas.comecar(alunoDoC, id))).toEqual(NAO_ENCONTRADO)
    expect(erro(await rotas.prova(alunoDoC, id))).toEqual(NAO_ENCONTRADO)
    expect(await contarTentativas(id)).toBe(0)
    expect(roteiro).toHaveLength(ZEROS.length)

    // Quem começou antes não dá a ordem a quem começa depois: cada tentativa guarda a sua.
    roteiro.length = 0
    const daAna = await comecarCom(ana, id, ZEROS)
    const daBia = await comecarCom(bia, id, ROTEIRO_DA_BIA)
    expect(daBia.questoes.map((questao) => questao.numero)).not.toEqual(daAna.questoes.map((questao) => questao.numero))
    expect(await ordemGravada(id, ana)).toEqual(ORDEM_DA_ANA)
    expect(await ordemGravada(id, bia)).toEqual(ORDEM_DA_BIA)
    // A resposta de outro aluno com a mesma aplicação não é lida por ele: o índice marcado por Ana não aparece na prova da Bia.
    expect((await rotas.responder(ana, id, 1, 0)).status).toBe(200)
    expect(emAndamento(await rotas.prova(bia, id)).respostas).toEqual([])
  })

  it('o sorteio vem depois da janela e do estado: fora da janela e com a atividade encerrada o `comecar` recusa, sem tentativa e sem sortear', async () => {
    const roteiroIntacto = [...ZEROS]
    roteiro.push(...roteiroIntacto)
    const cedo = await aplicarProva(TUDO, [30, 90])
    const tarde = await aplicarProva(TUDO, [-90, -30])
    for (const id of [cedo, tarde]) {
      expect(erro(await rotas.comecar(ana, id))).toEqual({ status: 409, codigo: 'PROVA_FORA_DA_JANELA' })
      expect(await contarTentativas(id)).toBe(0)
    }
    const encerrada = await aplicarProva(TUDO)
    await encerrarAtividade(rotas, a.professora, encerrada)
    expect(erro(await rotas.comecar(ana, encerrada))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
    expect(await contarTentativas(encerrada)).toBe(0)
    // Nenhuma das três recusas sorteou: o roteiro à espera está inteiro.
    expect(roteiro).toEqual(roteiroIntacto)
    expect(await ordemGravada(encerrada, ana)).toBeUndefined()
  })

  it('isolamento: o repository só lê o que a aplicação embaralha no alcance do aluno (escola, ano, turma e o id dela), e cada aplicação diz o seu', async () => {
    const { banco } = bancada
    const soQuestoes = await aplicarProva({ questoes: true, alternativas: false })
    const soAlternativas = await aplicarProva({ questoes: false, alternativas: true })
    const outra = await montarEscolaComAssistente(api, bancada)
    const [alunoDaOutra] = (await alunosComSessao(bancada, outra, outra.turma, ['Aluno Sintético da escola B'])) as [TestSessao]
    const contexto = (escolaId: string, anoLetivoId: string, sessao: TestSessao, papel: PapelDeUsuario): RequestContext => ({ requisicaoId: randomUUID(), escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId })
    const ler = (id: string, escolaId: string, anoLetivoId: string, aluno: TestSessao) => runInContext(contexto(escolaId, anoLetivoId, aluno, 'aluno'), () => new MinhaAtividadeRepository(banco).embaralhar(id))

    // Cada aplicação diz o que a professora ligou nela, e não o de outra aplicação da mesma turma.
    expect(await ler(soQuestoes, a.escolaId, a.anoLetivoId, ana)).toEqual({ questoes: true, alternativas: false })
    expect(await ler(soAlternativas, a.escolaId, a.anoLetivoId, ana)).toEqual({ questoes: false, alternativas: true })
    // O aluno de outra escola, no contexto dele, com o id desta escola; a escola e o ano trocados; e o aluno de outra turma da mesma escola: nada.
    expect(await ler(soQuestoes, outra.escolaId, outra.anoLetivoId, alunoDaOutra)).toBeUndefined()
    expect(await ler(soQuestoes, outra.escolaId, a.anoLetivoId, ana)).toBeUndefined()
    expect(await ler(soQuestoes, a.escolaId, randomUUID(), ana)).toBeUndefined()
    expect(await ler(soQuestoes, a.escolaId, a.anoLetivoId, alunoDoC)).toBeUndefined()
  })
})
