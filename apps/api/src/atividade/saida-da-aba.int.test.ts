import { runInContext, type RequestContext } from '@educa/core'
import { correcaoDoLoteResponseSchema, destaqueAbertoResponseSchema, type CorrecaoDoLoteResponse, type PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { alunosComSessao, aplicarAtividade, aprovarOLote, criarAtividade, encerrarAtividade, GABARITO_DE_TESTE, rotasDaAtividade, responderProva, type RotasDaAtividade } from '../../test/atividade.fixture.js'
import { montarEscolaComAssistente, vincularProfessor, type EscolaComAssistente } from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { subirApi, type RespostaHttp, type TestApi } from '../../test/test-api.js'
import { TEST_APP_OPTIONS } from '../../test/test-config.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import { SaidaDaAbaRepository } from './minha-atividade/saida-da-aba.repository.js'
import { PulsoService, type Tique } from './pulso/pulso.service.js'

const MIN = 60_000

/**
 * A saída da aba na prova online (avaliacao-e-correcao, 8.0; D70, D88; Tech Spec §4, §5.8 e §7): cada saída conta **uma vez** na tentativa (a chave é de quem reenvia), só numa prova avaliativa em
 * andamento, o professor a lê **só no lote** e ela nunca é destaque, trava nem soma entre provas.
 *
 * O relógio é o do banco: o teste não dorme, e a tentativa é posta por SQL em instantes que ele calcula. O pulso da API (`pulso_da_api`, global) é renovado antes de cada caso que depende do limite
 * e devolvido ao que era no fim; as indisponibilidades que o arquivo grava são apagadas.
 */
describe('saída da aba: uma vez por chave, só em prova em andamento', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let ana: TestSessao
  let bia: TestSessao
  let caio: TestSessao
  let davi: TestSessao
  let alunoDoC: TestSessao
  let idsDeIndisponibilidadeAntes: string[] = []
  let ultimoPulsoAntes: Date | undefined

  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query(texto, valores)).rows as Registro[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  const ENTRADA_INVALIDA = { status: 400, codigo: 'ENTRADA_INVALIDA' }
  const NO_CONTENT = { status: 204, codigo: undefined }
  const em = (minutos: number): Date => new Date(Date.now() + minutos * MIN)
  const janelaEm = (abreMin: number, fechaMin: number) => ({ abreEm: em(abreMin).toISOString(), fechaEm: em(fechaMin).toISOString() })
  const pulsar = () => sql('update pulso_da_api set ultimo_em = now()')
  const saida = (aluno: TestSessao, id: string, chave: string = randomUUID()) => rotas.saidaDaAba(aluno, id, { chave })

  /** Uma avaliativa nova, de um artefato novo, já aberta por padrão (de 5 min atrás a 60 min à frente), com a duração de 40 min. */
  async function aplicarProva(prova: Record<string, unknown> = { janela: janelaEm(-5, 60), duracaoMin: 40 }, escola: EscolaComAssistente = a): Promise<string> {
    return aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola), escola.turma, true, prova)
  }

  /** A contagem da tentativa e as linhas de chave do aluno naquela aplicação. */
  const contagem = async (id: string, aluno: TestSessao): Promise<{ contagem: number | undefined; chaves: number }> => ({
    contagem: (await sql<{ saidas_da_aba: number }>('select saidas_da_aba from tentativa_atividade where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId]))[0]?.saidas_da_aba,
    chaves: Number((await sql<{ total: string }>('select count(*) as total from saida_da_aba where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId]))[0]?.total),
  })

  /** Posiciona a tentativa do aluno: começou `iniciadaMin` minutos atrás e o limite base é `limiteMin` minutos à frente (negativo: já passou). */
  const posicionar = (id: string, aluno: TestSessao, iniciadaMin: number, limiteMin: number) =>
    sql('update tentativa_atividade set iniciada_em = $3, limite_base_em = $4 where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId, em(iniciadaMin), em(limiteMin)])

  /** O aluno começa a prova (a tentativa nasce) e a prova segue em andamento. */
  async function comecar(aluno: TestSessao, id: string): Promise<void> {
    expect((await rotas.comecar(aluno, id)).status).toBe(200)
  }

  const contexto = (escolaId: string, anoLetivoId: string, sessao: TestSessao, papel: PapelDeUsuario): RequestContext => ({ requisicaoId: randomUUID(), escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId })

  beforeAll(async () => {
    // Os limites por usuário e por escola do F0 vêm altos: o teste prova o balde da saída (`rl:saida-da-aba`), não o rate limit geral.
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '2000', LIMITE_REQ_ESCOLA_MIN: '2000' } })
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    ;[ana, bia, caio, davi] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluno Sintético Caio', 'Aluno Sintético Davi'])) as [TestSessao, TestSessao, TestSessao, TestSessao]
    ;[alunoDoC] = (await alunosComSessao(bancada, a, a.outraTurma, ['Aluno Sintético do 2ºC'])) as [TestSessao]
    idsDeIndisponibilidadeAntes = (await sql<{ id: string }>('select id from indisponibilidade')).map(({ id }) => id)
    ultimoPulsoAntes = (await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api'))[0]?.ultimo_em
  })

  afterAll(async () => {
    await sql('delete from indisponibilidade where id <> all($1::uuid[])', [idsDeIndisponibilidadeAntes])
    if (ultimoPulsoAntes !== undefined) await sql('update pulso_da_api set ultimo_em = $1', [ultimoPulsoAntes])
    await api.app.close()
    await bancada.fechar()
  })

  describe('a chave conta uma vez', () => {
    it('a saída nova soma 1; a mesma chave de novo não soma; uma chave nova soma; A, B e A dão 2', async () => {
      await pulsar()
      const id = await aplicarProva()
      await comecar(ana, id)
      const [chaveA, chaveB] = [randomUUID(), randomUUID()]
      expect(erro(await saida(ana, id, chaveA))).toEqual(NO_CONTENT)
      expect(await contagem(id, ana)).toEqual({ contagem: 1, chaves: 1 })
      // O reenvio da mesma chave (a fila da tela depois de um 5xx) responde igual e não soma.
      expect(erro(await saida(ana, id, chaveA))).toEqual(NO_CONTENT)
      expect(await contagem(id, ana)).toEqual({ contagem: 1, chaves: 1 })
      expect(erro(await saida(ana, id, chaveB))).toEqual(NO_CONTENT)
      expect(await contagem(id, ana)).toEqual({ contagem: 2, chaves: 2 })
      // A, B e A: a chave antiga volta e continua não contando.
      expect(erro(await saida(ana, id, chaveA))).toEqual(NO_CONTENT)
      expect(await contagem(id, ana)).toEqual({ contagem: 2, chaves: 2 })
      // A contagem é da tentativa dela: a do colega, que não saiu, segue sem nada.
      await comecar(bia, id)
      expect(await contagem(id, bia)).toEqual({ contagem: 0, chaves: 0 })
    })

    it('a chave de outro aluno na mesma prova é outra saída: a chave é por aluno, e as duas somam', async () => {
      await pulsar()
      const id = await aplicarProva()
      await comecar(ana, id)
      await comecar(bia, id)
      const chave = randomUUID()
      expect(erro(await saida(ana, id, chave))).toEqual(NO_CONTENT)
      expect(erro(await saida(bia, id, chave))).toEqual(NO_CONTENT)
      expect(await contagem(id, ana)).toEqual({ contagem: 1, chaves: 1 })
      expect(await contagem(id, bia)).toEqual({ contagem: 1, chaves: 1 })
    })

    it('a chave é uuid v4: a v7 e o campo a mais são ENTRADA_INVALIDA, sem gravar; a v4 passa', async () => {
      await pulsar()
      const id = await aplicarProva()
      await comecar(ana, id)
      // O dígito da versão (o 15º) é 7: carrega o milissegundo, e a saída não tem horário.
      expect(erro(await saida(ana, id, '0197a1c0-0000-7000-8000-000000000001'))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await rotas.saidaDaAba(ana, id, { chave: randomUUID(), instante: new Date().toISOString() }))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await rotas.saidaDaAba(ana, id, {}))).toEqual(ENTRADA_INVALIDA)
      expect(await contagem(id, ana)).toEqual({ contagem: 0, chaves: 0 })
      expect(erro(await saida(ana, id))).toEqual(NO_CONTENT)
      expect(await contagem(id, ana)).toEqual({ contagem: 1, chaves: 1 })
    })

    it('a prova 2 começa em 0: as saídas da prova 1 não passam para ela, e nenhuma leitura devolve soma por aluno', async () => {
      await pulsar()
      const [primeira, segunda] = [await aplicarProva(), await aplicarProva()]
      await comecar(ana, primeira)
      for (let i = 0; i < 3; i += 1) await saida(ana, primeira)
      await comecar(ana, segunda)
      expect(await contagem(primeira, ana)).toEqual({ contagem: 3, chaves: 3 })
      expect(await contagem(segunda, ana)).toEqual({ contagem: 0, chaves: 0 })
      await saida(ana, segunda)
      expect(await contagem(primeira, ana)).toEqual({ contagem: 3, chaves: 3 })
      expect(await contagem(segunda, ana)).toEqual({ contagem: 1, chaves: 1 })
      // O aluno não lê a própria contagem em lugar nenhum: nem a prova, nem o tempo, nem a lista dele trazem saída.
      for (const resposta of [await rotas.prova(ana, primeira), await rotas.tempo(ana, primeira), await rotas.minhas(ana)]) expect(JSON.stringify(resposta.corpo)).not.toMatch(/saida/i)
    })
  })

  describe('só em prova avaliativa em andamento', () => {
    it('a não avaliativa, a que o aluno ainda não começou, a enviada, a vencida e a encerrada pelo professor são NAO_ENCONTRADO, e nada muda', async () => {
      await pulsar()
      const semProva = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma, false)
      await comecar(ana, semProva)
      expect(erro(await saida(ana, semProva))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(semProva, ana)).toEqual({ contagem: 0, chaves: 0 })

      const naoComecou = await aplicarProva()
      expect(erro(await saida(ana, naoComecou))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(naoComecou, ana)).toEqual({ contagem: undefined, chaves: 0 })

      const enviada = await aplicarProva()
      await comecar(ana, enviada)
      expect((await rotas.enviar(ana, enviada)).status).toBe(200)
      expect(erro(await saida(ana, enviada))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(enviada, ana)).toEqual({ contagem: 0, chaves: 0 })

      const vencida = await aplicarProva()
      await comecar(ana, vencida)
      await posicionar(vencida, ana, -50, -10)
      expect(erro(await saida(ana, vencida))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(vencida, ana)).toEqual({ contagem: 0, chaves: 0 })

      const encerrada = await aplicarProva()
      await comecar(ana, encerrada)
      await encerrarAtividade(rotas, a.professora, encerrada)
      expect(erro(await saida(ana, encerrada))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(encerrada, ana)).toEqual({ contagem: 0, chaves: 0 })
    })

    it('a saída depois do limite original conta com a indisponibilidade fechada de 5 min, e com a lacuna aberta de 3 min; sem elas, é NAO_ENCONTRADO', async () => {
      await pulsar()
      const fechada = await aplicarProva()
      await comecar(ana, fechada)
      // O limite base passou há 2 min: sem a queda, a tentativa venceu.
      await posicionar(fechada, ana, -10, -2)
      expect(erro(await saida(ana, fechada))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(fechada, ana)).toEqual({ contagem: 0, chaves: 0 })
      await sql('insert into indisponibilidade (inicio, fim) values ($1, $2)', [em(-6), em(-1)])
      expect(erro(await saida(ana, fechada))).toEqual(NO_CONTENT)
      expect(await contagem(fechada, ana)).toEqual({ contagem: 1, chaves: 1 })
      await sql('delete from indisponibilidade where id <> all($1::uuid[])', [idsDeIndisponibilidadeAntes])

      // A lacuna aberta, montada à mão: a linha do pulso envelhecida em 3 min, e a saída conta os 3 min.
      const aberta = await aplicarProva()
      await pulsar()
      await comecar(bia, aberta)
      await posicionar(aberta, bia, -10, -2)
      expect(erro(await saida(bia, aberta))).toEqual(NAO_ENCONTRADO)
      await sql(`update pulso_da_api set ultimo_em = now() - interval '3 minutes'`)
      try {
        expect(erro(await saida(bia, aberta))).toEqual(NO_CONTENT)
      } finally {
        await pulsar()
      }
      expect(await contagem(aberta, bia)).toEqual({ contagem: 1, chaves: 1 })
    })
  })

  describe('a saída não é destaque, nem trava, nem aparece fora do lote do professor', () => {
    /**
     * Uma prova avaliativa em que dois alunos novos marcam o mesmo (a primeira com 0 saídas e o segundo com 9), encerrada. Alunos novos a cada chamada: o balde de 30 por minuto é por aluno, e o arquivo
     * chama isto mais de uma vez.
     */
    async function provaComSaidas(): Promise<{ id: string; entregaId: string; semSaida: TestSessao; comNove: TestSessao }> {
      await pulsar()
      const [semSaida, comNove] = (await alunosComSessao(bancada, a, a.turma, [`Aluna Sintética Sem ${randomUUID()}`, `Aluno Sintético Nove ${randomUUID()}`])) as [TestSessao, TestSessao]
      const id = await aplicarProva()
      const marcadas = [0, 1, 2, 3, 1]
      await responderProva(rotas, semSaida, id, marcadas)
      await comecar(comNove, id)
      for (let i = 0; i < 9; i += 1) expect(erro(await saida(comNove, id))).toEqual(NO_CONTENT)
      // A prova segue gravando depois de 9 saídas: a saída não trava a tentativa.
      for (const [indice, alternativa] of marcadas.entries()) expect((await rotas.responder(comNove, id, indice + 1, alternativa)).status).toBe(200)
      expect((await rotas.enviar(comNove, id)).status).toBe(200)
      const entregaId = await encerrarAtividade(rotas, a.professora, id)
      if (entregaId === null) throw new Error('o lote não nasceu')
      return { id, entregaId, semSaida, comNove }
    }
    const lerCorrecao = async (id: string): Promise<CorrecaoDoLoteResponse> => correcaoDoLoteResponseSchema.parse((await rotas.correcao(a.professora, id)).corpo)

    it('a mesma tentativa com 0 e com 9 saídas tem a mesma correção e os mesmos destaques; o lote aprova sem abrir ninguém, e a prova seguiu gravando', async () => {
      const { id, entregaId, semSaida, comNove } = await provaComSaidas()
      const correcaoDe = async (aluno: TestSessao) =>
        (await sql<Record<string, unknown>>('select acertos, total, em_branco, por_habilidade, destaques from correcao where entrega_id = $1 and aluno_id = $2', [entregaId, aluno.usuarioId]))[0]
      const [daAna, daBia] = [await correcaoDe(semSaida), await correcaoDe(comNove)]
      expect(daAna).toBeDefined()
      expect(daAna).toEqual(daBia)
      expect(daBia?.['destaques']).toEqual([])
      const lote = await lerCorrecao(id)
      expect(lote.destaques).toEqual([])
      expect(lote.podeAprovar).toBe(true)
      // Sem abrir ninguém: não há destaque, e a saída da Bia não criou um.
      expect((await aprovarOLote(rotas, a.professora, id)).status).toBe(200)
      expect((await sql<{ estado: string }>('select estado from entrega where id = $1', [entregaId]))[0]?.estado).toBe('aprovada')
    })

    it('o lote da avaliativa traz `saidasDaAba` por aluno, a abertura do destaque também; o da não avaliativa não traz o campo', async () => {
      await pulsar()
      const id = await aplicarProva()
      await responderProva(rotas, ana, id, [0, 1, 2, 3, 1])
      await comecar(davi, id)
      for (let i = 0; i < 2; i += 1) await saida(davi, id)
      await responderProva(rotas, caio, id, [null, null, null, null, null])
      const entregaId = await encerrarAtividade(rotas, a.professora, id)
      expect(entregaId).not.toBeNull()
      const lote = await lerCorrecao(id)
      const todas = [...lote.destaques, ...lote.outras]
      expect(Object.fromEntries(todas.map((aluno) => [aluno.alunoId, aluno.saidasDaAba]))).toEqual({ [ana.usuarioId]: 0, [davi.usuarioId]: 2, [caio.usuarioId]: 0 })
      // Caio e Davi não marcaram nada: são destaques pelo branco (`em_branco`), e só por ele; a Ana, com 0 saídas, e o Davi, com 2, não ganham nem perdem destaque pela contagem.
      expect(lote.destaques.map((destaque) => [destaque.alunoId, destaque.motivos]).sort()).toEqual([[caio.usuarioId, ['em_branco']], [davi.usuarioId, ['em_branco']]].sort())
      // A contagem vem também na abertura do destaque.
      const aberto = destaqueAbertoResponseSchema.parse((await rotas.abrirDestaque(a.professora, id, davi.usuarioId)).corpo)
      expect(aberto.destaque.saidasDaAba).toBe(2)

      const naoAvaliativa = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma, false)
      await responderProva(rotas, ana, naoAvaliativa, [...GABARITO_DE_TESTE])
      await responderProva(rotas, caio, naoAvaliativa, [null, null, null, null, null])
      await encerrarAtividade(rotas, a.professora, naoAvaliativa)
      const semProva = await lerCorrecao(naoAvaliativa)
      expect([...semProva.destaques, ...semProva.outras].length).toBe(2)
      for (const aluno of [...semProva.destaques, ...semProva.outras]) expect(Object.keys(aluno)).not.toContain('saidasDaAba')
      const abertoSemProva = destaqueAbertoResponseSchema.parse((await rotas.abrirDestaque(a.professora, naoAvaliativa, caio.usuarioId)).corpo)
      expect(Object.keys(abertoSemProva.destaque)).not.toContain('saidasDaAba')
    })

    it('o lote de uma prova traz só as saídas daquela prova: o aluno com tentativa em duas provas aparece uma vez em cada lote, com a contagem da própria', async () => {
      await pulsar()
      const [primeira, segunda] = [await aplicarProva(), await aplicarProva()]
      await comecar(ana, primeira)
      for (let i = 0; i < 3; i += 1) expect(erro(await saida(ana, primeira))).toEqual(NO_CONTENT)
      await comecar(davi, primeira)
      await comecar(ana, segunda)
      await comecar(davi, segunda)
      for (let i = 0; i < 2; i += 1) expect(erro(await saida(davi, segunda))).toEqual(NO_CONTENT)
      for (const id of [primeira, segunda]) expect(await encerrarAtividade(rotas, a.professora, id)).not.toBeNull()
      const contagens = async (id: string) => {
        const lote = await lerCorrecao(id)
        return [...lote.destaques, ...lote.outras].map((aluno) => [aluno.alunoId, aluno.saidasDaAba] as const).sort()
      }
      // Uma linha por aluno, e a contagem da prova do lote: a da outra prova não entra, nem duplica a linha.
      expect(await contagens(primeira)).toEqual([[ana.usuarioId, 3], [davi.usuarioId, 0]].sort())
      expect(await contagens(segunda)).toEqual([[ana.usuarioId, 0], [davi.usuarioId, 2]].sort())
    })

    it('a validação da avaliativa guarda que a coluna foi mostrada, e nenhuma contagem; a da não avaliativa não guarda a marca', async () => {
      const { id, entregaId, comNove } = await provaComSaidas()
      await aprovarOLote(rotas, a.professora, id)
      const [validacao] = await sql<{ apresentado: Record<string, unknown> }>('select apresentado from validacao_do_lote where entrega_id = $1', [entregaId])
      expect(validacao?.apresentado['saidaDaAbaMostrada']).toBe(true)
      // A contagem da Bia (9) não está em lugar nenhum do que foi apresentado: nem por aluno, nem somada.
      const texto = JSON.stringify(validacao?.apresentado)
      expect(texto).not.toMatch(/saidas/i)
      expect(texto).not.toContain(comNove.usuarioId)

      const naoAvaliativa = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma, false)
      await responderProva(rotas, ana, naoAvaliativa, [...GABARITO_DE_TESTE])
      const entregaSemProva = await encerrarAtividade(rotas, a.professora, naoAvaliativa)
      await aprovarOLote(rotas, a.professora, naoAvaliativa)
      const [semProva] = await sql<{ apresentado: Record<string, unknown> }>('select apresentado from validacao_do_lote where entrega_id = $1', [entregaSemProva])
      expect(Object.keys(semProva?.apresentado ?? {}).sort()).toEqual(['destaques', 'resumo'])
    })

    it('a coordenação e o aluno não leem o lote: a `correcao` é só do professor da turma, com a contagem', async () => {
      const { id, comNove } = await provaComSaidas()
      // A recusa é a mesma do id que não existe (regra 10, item 6): o status e o código primeiro, e só depois a ausência do campo.
      const doInexistente = erro(await rotas.correcao(a.professora, randomUUID()))
      expect(doInexistente).toEqual(NAO_ENCONTRADO)
      for (const sessao of [a.coordenacao, comNove]) {
        const resposta = await rotas.correcao(sessao, id)
        expect(erro(resposta)).toEqual(doInexistente)
        expect(JSON.stringify(resposta.corpo)).not.toMatch(/saidasDaAba/)
      }
      expect(JSON.stringify((await rotas.correcao(a.professora, id)).corpo)).toMatch(/saidasDaAba/)
    })
  })

  describe('(i) saída × saída', () => {
    it('duas saídas de chaves diferentes ao mesmo tempo somam as duas: a primeira segura no `insert`, a segunda grava e confirma, e a primeira solta dá 2', async () => {
      await pulsar()
      const id = await aplicarProva()
      await comecar(ana, id)
      const [primeiraChave, segundaChave] = [randomUUID(), randomUUID()]
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'saida_da_aba', evento: 'insert', quando: `new.atividade_aplicada_id = '${id}' and new.chave = '${primeiraChave}'` })
      await parada.armar()
      let primeira: Promise<RespostaHttp> | undefined
      try {
        primeira = saida(ana, id, primeiraChave)
        await parada.esperarParadas(1)
        // A saída não trava a tentativa antes do `insert`: a segunda não espera a primeira.
        expect(erro(await saida(ana, id, segundaChave))).toEqual(NO_CONTENT)
        expect((await contagem(id, ana)).contagem).toBe(1)
      } finally {
        await parada.desarmar()
      }
      expect(erro(await (primeira as Promise<RespostaHttp>))).toEqual(NO_CONTENT)
      expect(await contagem(id, ana)).toEqual({ contagem: 2, chaves: 2 })
    })

    it('a mesma chave nas duas, na mesma ordem: a segunda espera na chave única da primeira e, solta, não soma: 1', async () => {
      await pulsar()
      const id = await aplicarProva()
      await comecar(bia, id)
      const chave = randomUUID()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'saida_da_aba', evento: 'insert', quando: `new.atividade_aplicada_id = '${id}'` })
      await parada.armar()
      let primeira: Promise<RespostaHttp> | undefined
      let segunda: Promise<RespostaHttp> | undefined
      try {
        primeira = saida(bia, id, chave)
        await parada.esperarParadas(1)
        segunda = saida(bia, id, chave)
        // Dois no `insert`: a primeira, parada no gatilho, e a segunda, esperando a chave que a primeira já pôs no índice.
        await esperarNaTrava(bancada.pool, '%saida_da_aba%', 2)
      } finally {
        await parada.desarmar()
      }
      expect([erro(await (primeira as Promise<RespostaHttp>)), erro(await (segunda as Promise<RespostaHttp>))]).toEqual([NO_CONTENT, NO_CONTENT])
      expect(await contagem(id, bia)).toEqual({ contagem: 1, chaves: 1 })
    })
  })

  describe('o balde da saída: 30 por minuto por usuário, nunca por IP', () => {
    it('a 31ª saída do minuto é 429; outro aluno atrás do mesmo IP passa; a 30ª passou; o balde é só da saída', async () => {
      await pulsar()
      const c = await montarEscolaComAssistente(api, bancada)
      const [primeiro, segundo] = (await alunosComSessao(bancada, c, c.turma, ['Aluno Sintético Balde Um', 'Aluno Sintético Balde Dois'])) as [TestSessao, TestSessao]
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      await comecar(primeiro, id)
      await comecar(segundo, id)
      const aceitas: RespostaHttp[] = []
      for (let i = 0; i < 30; i += 1) aceitas.push(await saida(primeiro, id))
      expect(new Set(aceitas.map((resposta) => resposta.status))).toEqual(new Set([204]))
      expect(erro(await saida(primeiro, id))).toEqual({ status: 429, codigo: 'LIMITE_EXCEDIDO' })
      expect(erro(await saida(segundo, id))).toEqual(NO_CONTENT)
      // A 31ª recusada não gravou nada; e o balde é só da saída: a resposta da prova e o `comecar` do mesmo aluno seguem.
      expect(await contagem(id, primeiro)).toEqual({ contagem: 30, chaves: 30 })
      expect((await rotas.responder(primeiro, id, 1, 0)).status).toBe(200)
      expect((await rotas.comecar(primeiro, id)).status).toBe(200)
    })
  })

  describe('alcance, isolamento e vínculo', () => {
    it('o aluno de outra turma e o de outra escola recebem NAO_ENCONTRADO, e a contagem da dona segue 0 mesmo com a tentativa dela em andamento', async () => {
      await pulsar()
      const outra = await montarEscolaComAssistente(api, bancada)
      const daB = await aplicarProva({ janela: janelaEm(-5, 60), duracaoMin: 40 }, outra)
      await comecar(outra.aluno, daB)
      for (const intruso of [ana, alunoDoC]) expect(erro(await saida(intruso, daB))).toEqual(NAO_ENCONTRADO)
      // O aluno da B na própria prova conta; o de A, com o id da B, não somou nada nela.
      expect(await contagem(daB, outra.aluno)).toEqual({ contagem: 0, chaves: 0 })
      expect((await sql<{ total: string }>('select count(*) as total from saida_da_aba where atividade_aplicada_id = $1', [daB]))[0]?.total).toBe('0')
      expect(erro(await saida(outra.aluno, daB))).toEqual(NO_CONTENT)
      expect(erro(await saida(ana, randomUUID()))).toEqual(NAO_ENCONTRADO)
      // Só o aluno registra a própria saída: o professor e a coordenação, mesmo da escola e da turma, não passam da permissão (a matriz diz `nunca`) e recebem o mesmo `NAO_ENCONTRADO`, sem gravar.
      const daA = await aplicarProva()
      await comecar(ana, daA)
      for (const quem of [a.professora, a.coordenacao]) expect(erro(await saida(quem, daA))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(daA, ana)).toEqual({ contagem: 0, chaves: 0 })
    })

    it('o aluno transferido, com tentativa na turma A, recebe NAO_ENCONTRADO em A, e a contagem fica como estava', async () => {
      await pulsar()
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      await comecar(c.aluno, id)
      expect(erro(await saida(c.aluno, id))).toEqual(NO_CONTENT)
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [c.escolaId, c.aluno.usuarioId, c.turma])
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [c.escolaId, c.anoLetivoId, c.aluno.usuarioId, c.outraTurma, c.coordenacao.usuarioId])
      await vincularProfessor(bancada, c, c.professora.usuarioId, c.outraTurma, c.quimica)
      expect(erro(await saida(c.aluno, id))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(id, c.aluno)).toEqual({ contagem: 1, chaves: 1 })
    })

    it('a escola sem ano em curso: a saída é NAO_ENCONTRADO, e nada é gravado', async () => {
      await pulsar()
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      await comecar(c.aluno, id)
      expect((await rotas.pedir(c.coordenacao, 'POST', `/v1/anos-letivos/${c.anoLetivoId}/encerrar`)).status).toBe(200)
      expect(erro(await saida(c.aluno, id))).toEqual(NAO_ENCONTRADO)
      expect(await contagem(id, c.aluno)).toEqual({ contagem: 0, chaves: 0 })
    })

    describe('no repository: o id certo com o contexto errado', () => {
      it('só grava para a tentativa do aluno da sessão, na escola e no ano do contexto, e na aplicação pedida: nos outros contextos devolve falso e não muda nada', async () => {
        await pulsar()
        const { banco } = bancada
        const [primeira, segunda] = [await aplicarProva(), await aplicarProva()]
        await comecar(ana, primeira)
        await comecar(ana, segunda)
        const outra = await montarEscolaComAssistente(api, bancada)
        const daOutra = await aplicarProva({ janela: janelaEm(-5, 60), duracaoMin: 40 }, outra)
        await comecar(outra.aluno, daOutra)
        const registrar = (contextoDoPedido: RequestContext, id: string, chave: string = randomUUID()) => runInContext(contextoDoPedido, () => new SaidaDaAbaRepository(banco).registrar(id, chave))

        // Escola trocada: o aluno da B, com o contexto da A e o id da B, não tem tentativa lá.
        expect(await registrar(contexto(a.escolaId, a.anoLetivoId, outra.aluno, 'aluno'), daOutra), 'com a escola trocada').toBe(false)
        // Escola da A com o ano da B: o aluno e a aplicação são da B, o ano é o dela, e só o termo da escola separa a gravação.
        expect(await registrar(contexto(a.escolaId, outra.anoLetivoId, outra.aluno, 'aluno'), daOutra), 'com o ano da B na escola da A').toBe(false)
        // Ano trocado: a Ana, com a aplicação dela e um ano que não é o dela.
        expect(await registrar(contexto(a.escolaId, randomUUID(), ana, 'aluno'), primeira), 'com o ano trocado').toBe(false)
        // O colega que não começou a prova não grava na tentativa da Ana.
        expect(await registrar(contexto(a.escolaId, a.anoLetivoId, bia, 'aluno'), primeira), 'aluno sem tentativa').toBe(false)
        expect(await contagem(daOutra, outra.aluno)).toEqual({ contagem: 0, chaves: 0 })
        expect(await contagem(primeira, ana)).toEqual({ contagem: 0, chaves: 0 })

        // No contexto certo grava, uma vez, e só na aplicação pedida (a Ana tem tentativa nas duas).
        expect(await registrar(contexto(a.escolaId, a.anoLetivoId, ana, 'aluno'), primeira)).toBe(true)
        expect(await contagem(primeira, ana)).toEqual({ contagem: 1, chaves: 1 })
        expect(await contagem(segunda, ana)).toEqual({ contagem: 0, chaves: 0 })
        // A chave repetida devolve falso, e a contagem não anda.
        const repetida = randomUUID()
        expect(await registrar(contexto(a.escolaId, a.anoLetivoId, ana, 'aluno'), primeira, repetida)).toBe(true)
        expect(await registrar(contexto(a.escolaId, a.anoLetivoId, ana, 'aluno'), primeira, repetida)).toBe(false)
        expect(await contagem(primeira, ana)).toEqual({ contagem: 2, chaves: 2 })
      })
    })
  })
})

/**
 * O pulso parado (Tech Spec §5.7; RF6): a instância que não pulsa há mais de 30 s recusa `saidas-da-aba` com 503, antes de ler e de gravar, como as outras rotas de prova. O relógio da recusa e o tique são
 * injetados, e a API é uma só deste bloco.
 */
describe('saída da aba com o pulso parado', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let rotas: RotasDaAtividade
  let escola: EscolaComAssistente
  let aluno: TestSessao
  let deslocamentoMs = 0
  const instanteBase = Date.now()
  const relogio = { agora: () => new Date(instanteBase + deslocamentoMs) }
  let acaoDoTique: (() => Promise<void>) | undefined
  const tique: Tique = (acao) => {
    acaoDoTique = acao
    return () => {
      acaoDoTique = undefined
    }
  }
  let idsDeIndisponibilidadeAntes: string[] = []
  let ultimoPulsoAntes: Date | undefined
  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query(texto, valores)).rows as Registro[]

  beforeAll(async () => {
    idsDeIndisponibilidadeAntes = (await sql<{ id: string }>('select id from indisponibilidade')).map(({ id }) => id)
    ultimoPulsoAntes = (await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api'))[0]?.ultimo_em
    api = await subirApi(medidor.medidor, {}, undefined, { ...TEST_APP_OPTIONS, relogioDoPulso: relogio, tiqueDoPulso: tique })
    rotas = rotasDaAtividade(api)
    escola = await montarEscolaComAssistente(api, bancada)
    ;[aluno] = (await alunosComSessao(bancada, escola, escola.turma, ['Aluno Sintético Parado'])) as [TestSessao]
  })

  afterAll(async () => {
    // O pulso que o teste dispara grava a lacuna desde o pulso velho do banco: nada disso fica para o próximo arquivo.
    await sql('delete from indisponibilidade where id <> all($1::uuid[])', [idsDeIndisponibilidadeAntes])
    if (ultimoPulsoAntes !== undefined) await sql('update pulso_da_api set ultimo_em = $1', [ultimoPulsoAntes])
    await api.app.close()
    await bancada.fechar()
  })

  it('a 29 s a saída é aceita; a 31 s é 503, antes de gravar e igual para um id que não existe; o tique volta e ela é aceita de novo', async () => {
    const agora = Date.now()
    const id = await aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola), escola.turma, true, { janela: { abreEm: new Date(agora - 5 * MIN).toISOString(), fechaEm: new Date(agora + 60 * MIN).toISOString() }, duracaoMin: 40 })
    expect((await rotas.comecar(aluno, id)).status).toBe(200)
    // O pulso do banco está fresco: o primeiro pulso da instância não grava lacuna.
    await sql('update pulso_da_api set ultimo_em = now()')
    await api.app.get(PulsoService).start()
    expect(acaoDoTique, 'o tique foi registrado').toBeDefined()
    const total = async () => Number((await sql<{ total: string }>('select count(*) as total from saida_da_aba where atividade_aplicada_id = $1', [id]))[0]?.total)

    deslocamentoMs = 29_000
    expect((await rotas.saidaDaAba(aluno, id, { chave: randomUUID() })).status).toBe(204)
    expect(await total()).toBe(1)

    deslocamentoMs = 31_000
    for (const alvo of [id, randomUUID()]) {
      const recusada = await rotas.saidaDaAba(aluno, alvo, { chave: randomUUID() })
      expect({ status: recusada.status, codigo: recusada.corpo.erro?.codigo }).toEqual({ status: 503, codigo: 'INDISPONIVEL_TENTE_DE_NOVO' })
    }
    expect(await total()).toBe(1)

    await acaoDoTique?.()
    expect((await rotas.saidaDaAba(aluno, id, { chave: randomUUID() })).status).toBe(204)
    expect(await total()).toBe(2)
  })
})
