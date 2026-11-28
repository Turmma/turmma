import { createDatabase, runInContext, type DatabasePool, type RequestContext } from '@educa/core'
import { sql as sqlDoDrizzle } from 'drizzle-orm'
import { acompanhamentoResponseSchema, atividadeEncerradaResponseSchema, listaDeAtividadesAplicadasResponseSchema, type AcompanhamentoResponse, type PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { subirApi, type TestApi, type RespostaHttp } from '../../test/test-api.js'
import { alunosComSessao, aplicarAtividade, criarAtividade, rotasDaAtividade, type RotasDaAtividade } from '../../test/atividade.fixture.js'
import { montarAnoAnterior, montarEscolaComAssistente, vincularProfessor, type EscolaComAssistente } from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { aguardar, esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import { AtividadeAplicadaRepository } from './atividade-aplicada/atividade-aplicada.repository.js'
import { AcompanhamentoRepository, ExtensaoRepository, type AlunoDoAcompanhamento, type LeituraDoAcompanhamento } from './atividade-aplicada/acompanhamento.repository.js'

/**
 * A extensão de tempo e o acompanhamento da prova (avaliacao-e-correcao, 5.0; RF4): o professor estende o tempo de um aluno ou da turma, e lê por aluno quem não começou, quem está fazendo
 * e até quando, e quem enviou. O `comecar` e o PUT que recusa depois do limite são da 3.0: aqui a tentativa nasce por SQL, com o `limite_base_em` que o `comecar` gravaria, e o efeito da
 * extensão se lê no `limiteEm` do acompanhamento, que vem da mesma `limiteDaTentativa` de que o PUT depende. Os instantes são relativos ao relógio do banco; nenhum teste dorme.
 *
 * Tempo a mais é adaptação, dado sensível (regra 20, item 3): a auditoria só diz o escopo, e nenhuma resposta do acompanhamento traz saída da aba (D70, D88).
 */
/** As consultas que chegam ao banco, contadas no `query` do pool: o `select` do drizzle também se conta ao montar subconsulta, e isso não é ida ao banco. */
function contarConsultas(pool: DatabasePool): { readonly pool: DatabasePool; readonly consultas: () => number } {
  let total = 0
  const contado = new Proxy(pool, {
    get(alvo, propriedade) {
      const valor: unknown = Reflect.get(alvo, propriedade, alvo)
      if (propriedade === 'query') {
        return (...argumentos: unknown[]) => {
          total += 1
          return (valor as (...recebidos: unknown[]) => unknown).apply(alvo, argumentos)
        }
      }
      return typeof valor === 'function' ? (valor as (...recebidos: unknown[]) => unknown).bind(alvo) : valor
    },
  }) as DatabasePool
  return { pool: contado, consultas: () => total }
}

function alunoLido(leitura: LeituraDoAcompanhamento | undefined, alunoId: string): AlunoDoAcompanhamento {
  const achado = leitura?.alunos.find((aluno) => aluno.alunoId === alunoId)
  if (achado === undefined) throw new Error(`o aluno ${alunoId} não está na leitura`)
  return achado
}

describe('a extensão de tempo e o acompanhamento da prova', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  /** Alunos do 2ºB da escola A. */
  let ana: TestSessao
  let bia: TestSessao
  let caio: TestSessao
  let colega: TestSessao
  let alunoDoC: TestSessao
  /** Aluno da turma com vínculo `pendente`, outro com vínculo confirmado e a conta desativada, e o transferido (vínculo `encerrado`): nenhum dos três é da turma. */
  let pendente: TestSessao
  let desativado: TestSessao
  /** O aluno transferido: o vínculo com a turma foi `encerrado` (o caso real da escola). */
  let transferido: TestSessao

  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query(texto, valores)).rows as Registro[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const contar = async (tabela: string, filtro: string, valores: unknown[]): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where ${filtro}`, valores))[0]?.total)
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  const ENTRADA_INVALIDA = { status: 400, codigo: 'ENTRADA_INVALIDA' }
  const MINUTO = 60_000

  /**
   * O pulso da API de teste não bate (o tique só liga no `main.ts`), e a linha única envelhece: o limite passaria a contar a lacuna aberta desde o último pulso. O teste a deixa fresca antes de cada
   * leitura, como a API de pé a deixaria; a lacuna aberta e a fechada têm os casos delas em `pulso.int.test.ts` e em `limite-da-tentativa.test.ts`.
   */
  const pulsoFresco = () => sql('update pulso_da_api set ultimo_em = now()')
  const estender = async (sessao: TestSessao, id: string, corpo: Record<string, unknown>) => {
    await pulsoFresco()
    return rotas.pedir(sessao, 'POST', `/v1/atividades-aplicadas/${id}/extensoes`, corpo)
  }
  const acompanhar = async (sessao: TestSessao, id: string) => {
    await pulsoFresco()
    return rotas.pedir(sessao, 'GET', `/v1/atividades-aplicadas/${id}/acompanhamento`)
  }
  const lerAcompanhamento = (resposta: RespostaHttp): AcompanhamentoResponse => {
    expect(resposta.status).toBe(200)
    return acompanhamentoResponseSchema.parse(resposta.corpo)
  }
  const doAluno = (lido: AcompanhamentoResponse, aluno: TestSessao) => {
    const achado = lido.alunos.find((item) => item.alunoId === aluno.usuarioId)
    if (achado === undefined) throw new Error('o aluno não está no acompanhamento')
    return achado
  }

  /** Uma janela de `abreHaMin` minutos atrás até `fechaEmMin` minutos adiante. */
  const janelaDe = (abreHaMin: number, fechaEmMin: number): { abreEm: string; fechaEm: string } => ({ abreEm: new Date(Date.now() - abreHaMin * MINUTO).toISOString(), fechaEm: new Date(Date.now() + fechaEmMin * MINUTO).toISOString() })

  /** Uma prova avaliativa nova, de um artefato novo (a mesma aberta duas vezes na turma é `CONFLITO`), aberta há 1 h e fechando daqui a 2 h, de 40 min. */
  async function aplicarProva(prova: Record<string, unknown> = { janela: janelaDe(60, 120), duracaoMin: 40 }, escola: EscolaComAssistente = a): Promise<string> {
    return aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola), escola.turma, true, prova)
  }

  interface Tentativa {
    /** Quantos minutos atrás o aluno começou. */
    readonly haMin: number
    /** O `limite_base_em`, em minutos a partir de agora (negativo: já passou); `null`, sem limite. */
    readonly baseEmMin: number | null
    /** Quantos minutos atrás foi enviada; sem ele, a tentativa está em andamento. */
    readonly enviadaHaMin?: number
    readonly envio?: 'aluno' | 'limite' | 'encerramento'
  }

  /** O que o `comecar` da 3.0 fará: a tentativa nasce por SQL, com o aluno e os instantes do relógio do banco. */
  const iniciarTentativa = (aplicacaoId: string, aluno: TestSessao, tentativa: Tentativa) =>
    sql(
      `insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, iniciada_em, limite_base_em, enviada_em, envio)
       values ($1, $2, $3, $4, now() - make_interval(mins => $5::int), case when $6::int is null then null else now() + make_interval(mins => $6::int) end,
               case when $7::int is null then null else now() - make_interval(mins => $7::int) end, $8)`,
      [a.escolaId, a.anoLetivoId, aplicacaoId, aluno.usuarioId, tentativa.haMin, tentativa.baseEmMin, tentativa.enviadaHaMin ?? null, tentativa.envio ?? null],
    )
  const limiteBaseDe = async (aplicacaoId: string, aluno: TestSessao): Promise<number> => {
    const [linha] = await sql<{ limite_base_em: Date }>('select limite_base_em from tentativa_atividade where atividade_aplicada_id = $1 and aluno_id = $2', [aplicacaoId, aluno.usuarioId])
    if (linha === undefined) throw new Error('tentativa não achada')
    return linha.limite_base_em.getTime()
  }
  const extensoesDe = (aplicacaoId: string) => sql<{ aluno_id: string | null; minutos: number; concedida_por: string; chave: string }>('select aluno_id, minutos, concedida_por, chave from extensao_de_tempo where atividade_aplicada_id = $1 order by minutos', [aplicacaoId])
  const auditoriasDe = (aplicacaoId: string) => sql<{ autor_usuario_id: string; antes: unknown; depois: Record<string, unknown> }>(`select autor_usuario_id, antes, depois from auditoria where acao = 'atividade.tempo_estendido' and entidade_id = $1`, [aplicacaoId])
  const contexto = (escolaId: string, anoLetivoId: string, sessao: TestSessao, papel: PapelDeUsuario): RequestContext => ({ requisicaoId: randomUUID(), escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId })
  const contextoDaProfessora = (): RequestContext => contexto(a.escolaId, a.anoLetivoId, a.professora, 'professor')

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    ;[ana, bia, caio, colega] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluno Sintético Caio', 'Aluno Sintético Colega'])) as [TestSessao, TestSessao, TestSessao, TestSessao]
    ;[alunoDoC] = (await alunosComSessao(bancada, a, a.outraTurma, ['Aluno Sintético do 2ºC'])) as [TestSessao]
    ;[pendente, desativado, transferido] = (await alunosComSessao(bancada, a, a.turma, ['Aluno Sintético Pendente', 'Aluno Sintético Desativado', 'Aluno Sintético Transferido'])) as [TestSessao, TestSessao, TestSessao]
    await sql(`update vinculo set estado = 'pendente', decidido_em = null where escola_id = $1 and usuario_id = $2`, [a.escolaId, pendente.usuarioId])
    await sql('update usuario set desativado_em = now() where id = $1', [desativado.usuarioId])
    await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2`, [a.escolaId, transferido.usuarioId])
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
  })

  describe('estender', () => {
    it('10 min só para a Ana: o limite dela anda 10 min, o da Bia fica no que era, e a resposta é o acompanhamento', async () => {
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 5, baseEmMin: 35 })
      await iniciarTentativa(id, bia, { haMin: 5, baseEmMin: 35 })
      const [baseDaAna, baseDaBia] = [await limiteBaseDe(id, ana), await limiteBaseDe(id, bia)]

      const resposta = await estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 10, chave: randomUUID() })
      const lido = lerAcompanhamento(resposta)
      expect(Date.parse(doAluno(lido, ana).limiteEm ?? '') - baseDaAna).toBe(10 * MINUTO)
      expect(Date.parse(doAluno(lido, bia).limiteEm ?? '') - baseDaBia).toBe(0)
      expect(lido.atividadeAplicadaId).toBe(id)
      // O que ficou gravado: uma extensão, do aluno, com quem deu.
      expect(await extensoesDe(id)).toEqual([{ aluno_id: ana.usuarioId, minutos: 10, concedida_por: a.professora.usuarioId, chave: expect.any(String) as string }])
    })

    it('a turma toda: todos andam, e o aluno que começa depois tem o limite no `fecha_em` mais a extensão', async () => {
      // Fecha daqui a 20 min; a duração de 40 min não cabe, e o `limite_base_em` do `comecar` é o `fecha_em`.
      const id = await aplicarProva({ janela: janelaDe(30, 20), duracaoMin: 40 })
      await iniciarTentativa(id, ana, { haMin: 5, baseEmMin: 20 })
      await iniciarTentativa(id, bia, { haMin: 5, baseEmMin: 10 })
      const [baseDaAna, baseDaBia] = [await limiteBaseDe(id, ana), await limiteBaseDe(id, bia)]

      expect((await estender(a.professora, id, { minutos: 15, chave: randomUUID() })).status).toBe(200)
      // O aluno sem tentativa começa depois da extensão, e o `fecha_em` é o limite dele.
      await iniciarTentativa(id, caio, { haMin: 0, baseEmMin: 20 })
      const lido = lerAcompanhamento(await acompanhar(a.professora, id))
      expect(Date.parse(doAluno(lido, ana).limiteEm ?? '') - baseDaAna).toBe(15 * MINUTO)
      expect(Date.parse(doAluno(lido, bia).limiteEm ?? '') - baseDaBia).toBe(15 * MINUTO)
      expect(Date.parse(doAluno(lido, caio).limiteEm ?? '') - (await limiteBaseDe(id, caio))).toBe(15 * MINUTO)
      expect(await extensoesDe(id)).toMatchObject([{ aluno_id: null, minutos: 15 }])
    })

    it('0 e 121 minutos, e a chave a mais, são ENTRADA_INVALIDA; 1 e 120 passam; a prova encerrada é ATIVIDADE_ENCERRADA, sem linha', async () => {
      const id = await aplicarProva()
      for (const minutos of [0, 121]) expect(erro(await estender(a.professora, id, { minutos, chave: randomUUID() })), String(minutos)).toEqual(ENTRADA_INVALIDA)
      expect(erro(await estender(a.professora, id, { minutos: 10, chave: randomUUID(), motivo: 'a prova caiu' }))).toEqual(ENTRADA_INVALIDA)
      expect(await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [id])).toBe(0)
      for (const minutos of [1, 120]) expect((await estender(a.professora, id, { minutos, chave: randomUUID() })).status, String(minutos)).toBe(200)
      expect(await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [id])).toBe(2)

      expect((await rotas.encerrar(a.professora, id)).status).toBe(200)
      expect(erro(await estender(a.professora, id, { minutos: 10, chave: randomUUID() }))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      expect(await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [id])).toBe(2)
    })

    it('o aluno de outra turma, de outra escola, o inexistente, o pendente, o desativado e o transferido: a mesma ENTRADA_INVALIDA, e nada gravado', async () => {
      const id = await aplicarProva()
      const daB = await bancada.sessao(b.escolaId, 'aluno')
      const respostas = []
      for (const alunoId of [alunoDoC.usuarioId, daB.usuarioId, randomUUID(), pendente.usuarioId, desativado.usuarioId, transferido.usuarioId]) respostas.push(await estender(a.professora, id, { alunoId, minutos: 10, chave: randomUUID() }))
      expect(respostas.map(erro)).toEqual(Array.from({ length: 6 }, () => ENTRADA_INVALIDA))
      expect(new Set(respostas.map((resposta) => JSON.stringify({ ...resposta.corpo.erro, requisicaoId: undefined }))).size).toBe(1)
      expect(await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [id])).toBe(0)
      expect(await auditoriasDe(id)).toEqual([])
    })

    it('a mesma chave de novo devolve o gravado sem outra linha nem outra auditoria; a chave nova grava outra; em outra aplicação, a mesma chave é outra extensão', async () => {
      const id = await aplicarProva()
      const outra = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 5, baseEmMin: 35 })
      const chave = randomUUID()
      const base = await limiteBaseDe(id, ana)
      const primeira = lerAcompanhamento(await estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 10, chave }))
      const repetida = lerAcompanhamento(await estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 10, chave }))
      expect(Date.parse(doAluno(repetida, ana).limiteEm ?? '') - base).toBe(10 * MINUTO)
      expect(doAluno(repetida, ana)).toEqual(doAluno(primeira, ana))
      expect(await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [id])).toBe(1)
      expect(await auditoriasDe(id)).toHaveLength(1)

      // A mesma chave com outro corpo (outro aluno, outros minutos) é o mesmo pedido: 200, o gravado, e nada novo (Tech Spec §4; recusar o corpo diferente é decisão do Arquiteto, no `TODO.md`).
      const outroCorpo = lerAcompanhamento(await estender(a.professora, id, { alunoId: bia.usuarioId, minutos: 30, chave }))
      expect(Date.parse(doAluno(outroCorpo, ana).limiteEm ?? '') - base).toBe(10 * MINUTO)
      expect(await extensoesDe(id)).toMatchObject([{ aluno_id: ana.usuarioId, minutos: 10 }])
      expect(await auditoriasDe(id)).toHaveLength(1)

      // Outra chave grava outra extensão, e o limite anda de novo.
      const nova = lerAcompanhamento(await estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 5, chave: randomUUID() }))
      expect(Date.parse(doAluno(nova, ana).limiteEm ?? '') - base).toBe(15 * MINUTO)
      expect(await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [id])).toBe(2)

      // A chave é por aplicação: a mesma, em outra prova, é outra extensão.
      expect((await estender(a.professora, outra, { minutos: 10, chave })).status).toBe(200)
      expect(await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [outra])).toBe(1)
      expect(await contar('extensao_de_tempo', 'chave = $1', [chave])).toBe(2)
    })

    it('a auditoria diz só o escopo e quem deu: 17 min a uma aluna não deixa o 17 nem o aluno no detalhe; a da turma também não leva os minutos', async () => {
      const id = await aplicarProva()
      expect((await estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 17, chave: randomUUID() })).status).toBe(200)
      expect((await auditoriasDe(id)).map((linha) => linha.depois)).toEqual([{ escopo: 'aluno' }])
      expect((await estender(a.professora, id, { minutos: 23, chave: randomUUID() })).status).toBe(200)
      const auditorias = await auditoriasDe(id)
      expect(auditorias.map((linha) => linha.depois).sort((x, y) => String(x['escopo']).localeCompare(String(y['escopo'])))).toEqual([{ escopo: 'aluno' }, { escopo: 'turma' }])
      expect(new Set(auditorias.map((linha) => linha.autor_usuario_id))).toEqual(new Set([a.professora.usuarioId]))
      const texto = JSON.stringify(auditorias.map((linha) => [linha.antes, linha.depois]))
      for (const proibido of ['17', '23', ana.usuarioId, 'minutos']) expect(texto, proibido).not.toContain(proibido)
    })
  })

  describe('corridas', () => {
    it('(d) estender × estender: a primeira insere e para; a segunda, com a mesma chave, espera e devolve o gravado; a chave nova grava outra', async () => {
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 5, baseEmMin: 35 })
      const base = await limiteBaseDe(id, ana)
      const chave = randomUUID()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'extensao_de_tempo', evento: 'insert', quando: `new.atividade_aplicada_id = '${id}'` })
      await parada.armar()
      let primeira: Promise<RespostaHttp> | undefined
      let segunda: Promise<RespostaHttp> | undefined
      try {
        primeira = estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 10, chave })
        await parada.esperarParadas()
        segunda = estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 10, chave })
        // Quem segura (a primeira, no gatilho) e quem espera (a segunda, na linha que a primeira inseriu) estão na fila da trava.
        await esperarNaTrava(bancada.pool, '%insert into "extensao_de_tempo"%', 2)
        await parada.soltar()
        const [lidaA, lidaB] = [lerAcompanhamento(await primeira), lerAcompanhamento(await segunda)]
        expect(Date.parse(doAluno(lidaA, ana).limiteEm ?? '') - base).toBe(10 * MINUTO)
        expect(Date.parse(doAluno(lidaB, ana).limiteEm ?? '') - base).toBe(10 * MINUTO)
      } finally {
        await parada.desarmar()
        await Promise.allSettled([primeira, segunda])
      }
      expect(await extensoesDe(id)).toHaveLength(1)
      expect(await auditoriasDe(id)).toHaveLength(1)
      expect((await estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 5, chave: randomUUID() })).status).toBe(200)
      expect(await extensoesDe(id)).toHaveLength(2)
    })

    it('estender × encerrar: o encerramento segura a aplicação; a extensão espera, relê e recebe ATIVIDADE_ENCERRADA, sem linha', async () => {
      const id = await aplicarProva()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'atividade_aplicada', evento: 'update', quando: `new.id = '${id}'` })
      await parada.armar()
      let encerramento: Promise<RespostaHttp> | undefined
      let extensao: Promise<RespostaHttp> | undefined
      try {
        encerramento = rotas.encerrar(a.professora, id)
        await parada.esperarParadas()
        extensao = estender(a.professora, id, { minutos: 10, chave: randomUUID() })
        await esperarNaTrava(bancada.pool, '%atividade_aplicada%for share%')
        await parada.soltar()
        expect((await encerramento).status).toBe(200)
        expect(erro(await extensao)).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      } finally {
        await parada.desarmar()
        await Promise.allSettled([encerramento, extensao])
      }
      expect(await extensoesDe(id)).toEqual([])
    })
  })

  describe('a trava da extensão é da aplicação', () => {
    it('estender numa prova não espera o encerramento de outra: a extensão termina com o encerramento da vizinha ainda parado', async () => {
      const vizinha = await aplicarProva()
      const id = await aplicarProva()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'atividade_aplicada', evento: 'update', quando: `new.id = '${vizinha}'` })
      await parada.armar()
      let encerramento: Promise<RespostaHttp> | undefined
      try {
        encerramento = rotas.encerrar(a.professora, vizinha)
        await parada.esperarParadas()
        // A vizinha está travada em `for update` até o fim: a extensão desta prova confirma sem esperar por ela. Se a trava pegasse também a vizinha (sem o id no `where`), o encerramento dela deixaria de dar 200, e o desfecho dos dois deixa de ser `[200, 200]`.
        const extensao = estender(a.professora, id, { minutos: 10, chave: randomUUID() })
        await aguardar(async () => (await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [id])) === 1, 'a extensão confirmada com o encerramento da vizinha parado')
        await parada.soltar()
        expect([(await extensao).status, (await encerramento).status]).toEqual([200, 200])
      } finally {
        await parada.desarmar()
        await Promise.allSettled([encerramento])
      }
      expect(await extensoesDe(id)).toHaveLength(1)
    })
  })

  describe('acompanhar', () => {
    it('quem não começou, quem faz (com a extensão e a indisponibilidade no limite), quem enviou e quem esgotou o tempo; só os alunos da turma, na ordem do nome', async () => {
      // A Ana tem uma tentativa já enviada em **outra** prova da turma: nada dela entra neste acompanhamento.
      const outra = await aplicarProva()
      await iniciarTentativa(outra, ana, { haMin: 90, baseEmMin: -50, enviadaHaMin: 60, envio: 'aluno' })
      const id = await aplicarProva()
      // Ana: não começou. Bia: faz, e o `limite_base_em` é daqui a 10 min. Caio: enviou. Colega: o limite passou há 20 min, sem envio. Tentativa sem limite (`a.aluno`): faz, sem horário.
      await iniciarTentativa(id, bia, { haMin: 30, baseEmMin: 10 })
      await iniciarTentativa(id, caio, { haMin: 30, baseEmMin: 10, enviadaHaMin: 10, envio: 'aluno' })
      await iniciarTentativa(id, colega, { haMin: 60, baseEmMin: -20 })
      await iniciarTentativa(id, a.aluno, { haMin: 30, baseEmMin: null })
      // O transferido começou a prova antes de a turma o perder: a tentativa existe, e ele não é da lista.
      await iniciarTentativa(id, transferido, { haMin: 20, baseEmMin: 20 })
      const baseDaBia = await limiteBaseDe(id, bia)
      expect((await estender(a.professora, id, { alunoId: bia.usuarioId, minutos: 5, chave: randomUUID() })).status).toBe(200)
      // Uma queda de 5 min **dentro** da prova da Bia (começou há 30 min, o limite é daqui a 15), e outra, de 5 min, antes de ela começar: só a primeira anda o limite.
      const [dentro] = await sql<{ id: string }>(`insert into indisponibilidade (inicio, fim) values (now() - interval '20 minutes', now() - interval '15 minutes') returning id`)
      const [antes] = await sql<{ id: string }>(`insert into indisponibilidade (inicio, fim) values (now() - interval '50 minutes', now() - interval '45 minutes') returning id`)
      try {
        const lido = lerAcompanhamento(await acompanhar(a.professora, id))
        expect(lido.alunos.map((item) => item.nome)).toEqual(['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluno Sintético Caio', NOME_DO_ALUNO, 'Aluno Sintético Colega'])
        expect(lido.alunos.map((item) => [item.nome, item.situacao])).toEqual([
          ['Aluna Sintética Ana', 'nao_comecou'],
          ['Aluna Sintética Bia', 'fazendo'],
          ['Aluno Sintético Caio', 'enviou'],
          [NOME_DO_ALUNO, 'fazendo'],
          ['Aluno Sintético Colega', 'tempo_esgotado'],
        ])
        // A Bia: o base, mais a extensão de 5 min, mais a queda de 5 min dentro da prova (a de antes de começar não conta).
        expect(Date.parse(doAluno(lido, bia).limiteEm ?? '') - baseDaBia).toBe(10 * MINUTO)
        // Só quem faz tem horário; sem limite, não há o que mostrar.
        expect(lido.alunos.map((item) => item.limiteEm === null)).toEqual([true, false, true, true, true])
        // A conta do relógio é a do banco.
        expect(Math.abs(Date.parse(lido.agora) - Date.now())).toBeLessThan(60_000)
        // O contrato é o declarado: nada de saídas da aba, de percentual nem de quem deu a extensão.
        expect(Object.keys(doAluno(lido, bia)).sort()).toEqual(['alunoId', 'limiteEm', 'nome', 'situacao'])
        expect(JSON.stringify(lido)).not.toMatch(/saida|percentual|concedid|tempoAdicional/i)
        // Nenhum aluno de outra turma, pendente, desativado ou transferido.
        for (const fora of [alunoDoC, pendente, desativado, transferido]) expect(lido.alunos.some((item) => item.alunoId === fora.usuarioId)).toBe(false)
      } finally {
        await sql('delete from indisponibilidade where id = any($1::uuid[])', [[dentro?.id, antes?.id]])
      }
    })

    it('dois alunos com o mesmo nome saem na ordem do id, a mesma a cada leitura', async () => {
      const id = await aplicarProva()
      const gemeos = await alunosComSessao(bancada, a, a.turma, ['Aluno Sintético Gêmeo', 'Aluno Sintético Gêmeo'])
      try {
        const esperado = gemeos.map((gemeo) => gemeo.usuarioId).sort()
        for (let leitura = 0; leitura < 3; leitura += 1) {
          const lidos = lerAcompanhamento(await acompanhar(a.professora, id)).alunos.filter((aluno) => aluno.nome === 'Aluno Sintético Gêmeo')
          expect(lidos.map((aluno) => aluno.alunoId), `leitura ${leitura}`).toEqual(esperado)
        }
      } finally {
        // Saem da turma, para os casos de baixo não os verem.
        await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = any($2::uuid[])`, [a.escolaId, gemeos.map((gemeo) => gemeo.usuarioId)])
      }
    })

    const NOME_DO_ALUNO = 'Aluno Sintético Caio Moreira'
    it('a prova encerrada pelo professor: quem não tinha enviado foi com o salvo (`enviou`), o limite que passou segue `tempo_esgotado`, e a tentativa fechada no limite é `tempo_esgotado`', async () => {
      // Uma vizinha aberta, criada antes, que ninguém encerrou: o estado lido é o desta prova.
      await aplicarProva()
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 30, baseEmMin: 10 })
      await iniciarTentativa(id, bia, { haMin: 60, baseEmMin: -20 })
      await iniciarTentativa(id, caio, { haMin: 60, baseEmMin: 10, enviadaHaMin: 5, envio: 'limite' })
      await iniciarTentativa(id, colega, { haMin: 60, baseEmMin: 10, enviadaHaMin: 5, envio: 'encerramento' })
      expect((await rotas.encerrar(a.professora, id)).status).toBe(200)
      const lido = lerAcompanhamento(await acompanhar(a.professora, id))
      expect(Object.fromEntries([ana, bia, caio, colega].map((aluno) => [aluno.usuarioId, doAluno(lido, aluno).situacao]))).toEqual({
        [ana.usuarioId]: 'enviou',
        [bia.usuarioId]: 'tempo_esgotado',
        [caio.usuarioId]: 'tempo_esgotado',
        [colega.usuarioId]: 'enviou',
      })
      expect(lido.alunos.every((item) => item.limiteEm === null)).toBe(true)
    })

    it('a turma cujo único aluno foi desativado devolve a lista vazia, e não o NAO_ENCONTRADO de quem não alcança a prova', async () => {
      const vazia = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarProva({ janela: janelaDe(60, 120), duracaoMin: 40 }, vazia)
      const lido = lerAcompanhamento(await acompanhar(vazia.professora, id))
      expect(lido.alunos.map((item) => item.alunoId)).toEqual([vazia.aluno.usuarioId])
      await sql('update usuario set desativado_em = now() where id = $1', [vazia.aluno.usuarioId])
      expect(lerAcompanhamento(await acompanhar(vazia.professora, id)).alunos).toEqual([])
    })

    it('lê numa consulta só: uma ida ao banco para a lista inteira, e a leitura traz, por aluno, as extensões e as quedas da aplicação, o pulso e o relógio do banco', async () => {
      // A outra prova nasce antes e tem tentativa dos mesmos alunos, enviada: o que for dela, se entrasse, seria o primeiro a ser lido.
      const outra = await aplicarProva()
      await iniciarTentativa(outra, ana, { haMin: 90, baseEmMin: -50, enviadaHaMin: 60, envio: 'aluno' })
      await iniciarTentativa(outra, bia, { haMin: 90, baseEmMin: -50, enviadaHaMin: 60, envio: 'aluno' })
      await iniciarTentativa(outra, caio, { haMin: 90, baseEmMin: -50, enviadaHaMin: 60, envio: 'aluno' })
      expect((await estender(a.professora, outra, { minutos: 9, chave: randomUUID() })).status).toBe(200)
      expect((await rotas.encerrar(a.professora, outra)).status).toBe(200)
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 30, baseEmMin: 10 })
      await iniciarTentativa(id, bia, { haMin: 30, baseEmMin: 10 })
      await estender(a.professora, id, { alunoId: ana.usuarioId, minutos: 5, chave: randomUUID() })
      const [dentro] = await sql<{ id: string }>(`insert into indisponibilidade (inicio, fim) values (now() - interval '20 minutes', now() - interval '15 minutes') returning id`)
      const [antes] = await sql<{ id: string }>(`insert into indisponibilidade (inicio, fim) values (now() - interval '50 minutes', now() - interval '45 minutes') returning id`)
      try {
        const { pool: poolContado, consultas } = contarConsultas(bancada.pool)
        await pulsoFresco()
        const leitura = await runInContext(contextoDaProfessora(), () => new AcompanhamentoRepository(createDatabase(poolContado)).read(id))
        expect(consultas()).toBe(1)
        const daAna = alunoLido(leitura, ana.usuarioId)
        expect(leitura?.estado).toBe('aberta')
        expect(leitura?.alunos.map((aluno) => aluno.alunoId)).not.toContain(desativado.usuarioId)
        expect(alunoLido(leitura, bia.usuarioId).tentativa?.enviadaEm).toBeNull()
        // As extensões são as desta aplicação (a da turma, na outra, não vem), e a queda de antes de começar não vem.
        expect(daAna.extensoes).toEqual([{ alunoId: ana.usuarioId, minutos: 5 }])
        expect(daAna.indisponibilidades).toHaveLength(1)
        expect(daAna.indisponibilidades[0]?.fim.getTime()).toBeLessThan(Date.now() - 14 * MINUTO)
        expect(daAna.pulso).not.toBeNull()
        expect(Math.abs((daAna.pulso?.agora.getTime() ?? 0) - Date.now())).toBeLessThan(60_000)
        // Quem não começou não tem tentativa, e as quedas dele não se leem (não há de onde contar).
        const daAlunoSemTentativa = alunoLido(leitura, caio.usuarioId)
        expect(daAlunoSemTentativa.tentativa).toBeNull()
        expect(daAlunoSemTentativa.indisponibilidades).toEqual([])
      } finally {
        await sql('delete from indisponibilidade where id = any($1::uuid[])', [[dentro?.id, antes?.id]])
      }
    })

    it('sem a linha do pulso (backup restaurado sem ela), a leitura traz o pulso nulo e o limite fica no que as extensões dão: nenhuma lacuna aberta se inventa', async () => {
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 5, baseEmMin: 35 })
      // Numa transação desfeita no fim: a tabela do pulso é global, e nenhuma outra escrita dela pode ficar de fora.
      let pulso: unknown = 'não lido'
      await expect(
        bancada.banco.transaction(async (tx) => {
          await tx.execute(sqlDoDrizzle`delete from pulso_da_api`)
          const leitura = await runInContext(contextoDaProfessora(), () => new AcompanhamentoRepository(tx).read(id))
          pulso = alunoLido(leitura, ana.usuarioId).pulso
          throw new Error('desfazer')
        }),
      ).rejects.toThrow('desfazer')
      expect(pulso).toBeNull()
      expect(await contar('pulso_da_api', 'true', [])).toBe(1)
    })

    it('as respostas do acompanhamento e da extensão não se guardam em cache, e o id que não é uuid responde como o inexistente', async () => {
      const id = await aplicarProva()
      await pulsoFresco()
      const pedir = (metodo: string, caminho: string, corpo?: unknown) =>
        fetch(`${api.url}/v1/atividades-aplicadas/${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${a.professora.token}`, 'Content-Type': 'application/json' }, ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }) })
      const lida = await pedir('GET', `${id}/acompanhamento`)
      const estendida = await pedir('POST', `${id}/extensoes`, { minutos: 10, chave: randomUUID() })
      expect([lida.status, estendida.status]).toEqual([200, 200])
      expect([lida.headers.get('cache-control'), estendida.headers.get('cache-control')]).toEqual(['no-store', 'no-store'])
      for (const [metodo, rota, corpo] of [['GET', 'acompanhamento', undefined], ['POST', 'extensoes', { minutos: 10, chave: randomUUID() }]] as const) {
        const malformado = await pedir(metodo, `nao-e-um-uuid/${rota}`, corpo)
        const inexistente = await pedir(metodo, `${randomUUID()}/${rota}`, corpo)
        expect([malformado.status, (await malformado.json() as { erro?: { codigo?: string } }).erro?.codigo], rota).toEqual([404, 'NAO_ENCONTRADO'])
        expect(inexistente.status, rota).toBe(404)
      }
    })

    it('o `EXPLAIN` da consulta do repository entra pelos índices: a aplicação pelo id, o vínculo pela turma, a tentativa pela chave única e as quedas pelo fim', async () => {
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 30, baseEmMin: 10 })
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        await cliente.query('set local enable_seqscan = off')
        await cliente.query('set local enable_bitmapscan = off')
        // Com uma ou duas linhas na escola, o índice só por escola e a chave única empatam no custo, e o planejador escolhe pelo que as outras suítes deixaram no banco: o volume
        // de uma escola de verdade (200 aplicações encerradas da turma, com tentativa e extensão por aluno) vai na transação desfeita. Causa: `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`.
        const aplicacoesNovas = await cliente.query(
          `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, aplicada_em, encerrada_em, abre_em, fecha_em, duracao_min)
           select escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, 'encerrada', aplicada_por, aplicada_em, now(), abre_em, fecha_em, duracao_min
           from atividade_aplicada cross join generate_series(1, 200) where escola_id = $1 and id = $2`,
          [a.escolaId, id],
        )
        const tentativasNovas = await cliente.query(
          `insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, iniciada_em, enviada_em, envio)
           select aplicacao.escola_id, aplicacao.ano_letivo_id, aplicacao.id, aluno.usuario_id, now() - interval '1 hour', now() - interval '30 minutes', 'aluno'
           from atividade_aplicada aplicacao
           join vinculo aluno on aluno.escola_id = aplicacao.escola_id and aluno.ano_letivo_id = aplicacao.ano_letivo_id and aluno.turma_id = aplicacao.turma_id and aluno.papel = 'aluno' and aluno.estado = 'confirmado'
           where aplicacao.escola_id = $1 and aplicacao.estado = 'encerrada' and aplicacao.id <> $2
           on conflict on constraint tentativa_atividade_uma_por_aluno do nothing`,
          [a.escolaId, id],
        )
        const extensoesNovas = await cliente.query(
          `insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave)
           select aplicacao.escola_id, aplicacao.ano_letivo_id, aplicacao.id, aluno.usuario_id, 10, aplicacao.aplicada_por, gen_random_uuid()
           from atividade_aplicada aplicacao
           join vinculo aluno on aluno.escola_id = aplicacao.escola_id and aluno.ano_letivo_id = aplicacao.ano_letivo_id and aluno.turma_id = aplicacao.turma_id and aluno.papel = 'aluno' and aluno.estado = 'confirmado'
           where aplicacao.escola_id = $1 and aplicacao.estado = 'encerrada' and aplicacao.id <> $2`,
          [a.escolaId, id],
        )
        // O volume só prova se existe: sem aluno confirmado na turma, os dois últimos `insert` gravariam zero e o empate voltaria calado.
        expect([aplicacoesNovas.rowCount, (tentativasNovas.rowCount ?? 0) >= 200, (extensoesNovas.rowCount ?? 0) >= 200]).toEqual([200, true, true])
        // As estatísticas de hoje, com o volume: sem elas o planejador escolhe o índice da tentativa pelo que o banco acumulado tinha.
        for (const tabela of ['atividade_aplicada', 'vinculo', 'usuario', 'tentativa_atividade', 'extensao_de_tempo']) await cliente.query(`analyze ${tabela}`)
        const consulta = runInContext(contextoDaProfessora(), () => new AcompanhamentoRepository(createDatabase(bancada.pool)).consulta(id))
        const { sql: texto, params } = consulta.toSQL()
        const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (format json) ${texto}`, params as unknown[])
        const nos: Array<Record<string, unknown>> = []
        const andar = (no: Record<string, unknown> | undefined): void => {
          if (no === undefined) return
          nos.push(no)
          for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
        }
        andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
        const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')
        for (const [tabela, indices] of [
          ['atividade_aplicada', ['atividade_aplicada_pkey', 'atividade_aplicada_escola_ano_turma_id_unico', 'atividade_aplicada_escola_ano_turma_artefato_id_unico', 'atividade_aplicada_escola_ano_id_unico']],
          ['vinculo', ['vinculo_turma_idx']],
          ['tentativa_atividade', ['tentativa_atividade_uma_por_aluno']],
          ['extensao_de_tempo', ['extensao_de_tempo_chave_por_aplicacao']],
          ['indisponibilidade', ['indisponibilidade_fim_idx']],
        ] as const) {
          const doIndice = nos.find((no) => no['Relation Name'] === tabela && (indices as readonly string[]).includes(String(no['Index Name'])))
          expect(doIndice, `${tabela}: ${resumo}`).toBeDefined()
          expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === tabela), `${tabela}: ${resumo}`).toEqual([])
        }
        // A tentativa e a extensão entram pela escola, e não só pelo aluno ou pela aplicação.
        const daTentativa = nos.find((no) => no['Relation Name'] === 'tentativa_atividade' && no['Index Name'] === 'tentativa_atividade_uma_por_aluno')
        expect(daTentativa, resumo).toBeDefined()
        expect(String(daTentativa?.['Index Cond']), resumo).toMatch(/escola_id/)
        // E pela aplicação, que é o que a torna seletiva: o índice só por escola (e aluno) também é índice, mas leria as tentativas da escola inteira.
        expect(String(daTentativa?.['Index Cond']), resumo).toMatch(/atividade_aplicada_id/)
        const daExtensao = nos.find((no) => no['Relation Name'] === 'extensao_de_tempo' && no['Index Name'] === 'extensao_de_tempo_chave_por_aplicacao')
        expect(daExtensao, resumo).toBeDefined()
        expect(String(daExtensao?.['Index Cond']), resumo).toMatch(/escola_id.*atividade_aplicada_id|atividade_aplicada_id.*escola_id/)
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })
  })

  describe('a contagem de quem enviou, na leitura da professora', () => {
    /** A participação que a lista da professora devolve para a aplicação, com o pulso fresco (a lacuna aberta de uma API parada andaria todos os limites). */
    const participacaoDe = async (id: string) => {
      await pulsoFresco()
      const lista = listaDeAtividadesAplicadasResponseSchema.parse((await rotas.listar(a.professora, `?turmaId=${a.turma}&limite=100`)).corpo)
      const achada = lista.itens.find((item) => item.id === id)
      if (achada === undefined) throw new Error('a aplicação não está na lista')
      return achada.participacao
    }

    it('a tentativa vencida, com a janela ainda aberta, conta como enviada (Tech Spec §5.5, RF5); a que tem tempo, a estendida e a sem limite não, e a vencida de outra prova não passa para esta', async () => {
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 60, baseEmMin: -20 })
      await iniciarTentativa(id, bia, { haMin: 30, baseEmMin: 10 })
      // O Caio enviou há 10 min e o limite dele passou há 5: já conta pelo envio, e não conta de novo como vencido.
      await iniciarTentativa(id, caio, { haMin: 30, baseEmMin: -5, enviadaHaMin: 10, envio: 'aluno' })
      await iniciarTentativa(id, colega, { haMin: 60, baseEmMin: -2 })
      await iniciarTentativa(id, a.aluno, { haMin: 30, baseEmMin: null })
      // O colega venceria há 2 min; com 10 a mais, o limite é daqui a 8.
      expect((await estender(a.professora, id, { alunoId: colega.usuarioId, minutos: 10, chave: randomUUID() })).status).toBe(200)
      const outra = await aplicarProva()
      await iniciarTentativa(outra, ana, { haMin: 60, baseEmMin: -20 })
      // A extensão de uma terceira prova, da turma toda, não anda o limite de ninguém destas duas.
      const vizinha = await aplicarProva()
      expect((await estender(a.professora, vizinha, { minutos: 120, chave: randomUUID() })).status).toBe(200)

      // Ana (vencida) e Caio (enviou): dois. Bia tem tempo, o colega foi estendido, e quem não tem limite nunca vence.
      expect(await participacaoDe(id)).toMatchObject({ iniciaram: 5, enviaram: 2 })
      expect(await participacaoDe(outra)).toMatchObject({ iniciaram: 1, enviaram: 1 })
      expect(await participacaoDe(vizinha)).toMatchObject({ iniciaram: 0, enviaram: 0 })

      // O `porId` (o que o aplicar, a mudança de janela e a segunda chamada devolvem) conta a vencida como a lista.
      await pulsoFresco()
      const lida = await runInContext(contextoDaProfessora(), () => new AtividadeAplicadaRepository(createDatabase(bancada.pool)).porId(id))
      expect(lida).toMatchObject({ iniciaram: 5, enviaram: 2 })

      // O encerramento grava o fato (`enviada_em` no limite) só da vencida, e a contagem de antes e a de depois são a mesma.
      const encerrada = atividadeEncerradaResponseSchema.parse((await rotas.encerrar(a.professora, id)).corpo)
      expect(encerrada.atividade.participacao).toMatchObject({ iniciaram: 5, enviaram: 2 })
      expect(await participacaoDe(id)).toMatchObject({ iniciaram: 5, enviaram: 2 })

      // Depois do encerramento a conta é a que ele gravou: a Bia, que tinha tempo, não vira "enviada" quando o limite dela passa (uma queda posterior andaria o limite, §5.5).
      await sql('update tentativa_atividade set limite_base_em = now() - interval \'1 minute\' where atividade_aplicada_id = $1 and aluno_id = $2', [id, bia.usuarioId])
      expect(await participacaoDe(id)).toMatchObject({ iniciaram: 5, enviaram: 2 })
    })

    it('a queda fechada da API dentro da prova anda o limite: a tentativa que venceria não conta enquanto a queda a cobre, e conta sem ela (a mesma conta do acompanhamento)', async () => {
      const id = await aplicarProva()
      // Começou há 60 min e o limite base passou há 2. A API ficou fora 6 min dentro da prova (de 30 a 24 min atrás), e o limite anda 6: vence daqui a 4 min.
      // A margem de 4 min é a do limite com a queda (6 − 2): o teste não dorme, e uma CI lenta só estraga o caso se atrasar mais de 4 min entre gravar a tentativa e ler a lista. Mexer nos números pede refazer essa conta.
      await iniciarTentativa(id, ana, { haMin: 60, baseEmMin: -2 })
      const [dentro] = await sql<{ id: string }>(`insert into indisponibilidade (inicio, fim) values (now() - interval '30 minutes', now() - interval '24 minutes') returning id`)
      try {
        expect(await participacaoDe(id)).toMatchObject({ iniciaram: 1, enviaram: 0 })
      } finally {
        await sql('delete from indisponibilidade where id = $1', [dentro?.id])
      }
      expect(await participacaoDe(id)).toMatchObject({ iniciaram: 1, enviaram: 1 })
    })

    it('a aplicação encerrada não custa a segunda ida ao banco, e a aberta custa (regra 80: a leitura de quem já encerrou é só a da aplicação)', async () => {
      const vazia = await montarEscolaComAssistente(api, bancada)
      const prova = { janela: janelaDe(60, 120), duracaoMin: 40 }
      const encerrada = await aplicarProva(prova, vazia)
      expect((await rotas.encerrar(vazia.professora, encerrada)).status).toBe(200)
      const aberta = await aplicarProva(prova, vazia)
      const consultasDoPorId = async (id: string): Promise<number> => {
        const { pool: poolContado, consultas } = contarConsultas(bancada.pool)
        await runInContext(contexto(vazia.escolaId, vazia.anoLetivoId, vazia.professora, 'professor'), () => new AtividadeAplicadaRepository(createDatabase(poolContado)).porId(id))
        return consultas()
      }
      expect(await consultasDoPorId(encerrada)).toBe(1)
      expect(await consultasDoPorId(aberta)).toBe(2)
    })
  })

  describe('isolamento', () => {
    it('estender e acompanhar, por quem não é o professor daquela turma e daquela disciplina, respondem como o inexistente e não gravam nada', async () => {
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 5, baseEmMin: 35 })
      const sentinela = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, sentinela.usuarioId, a.turma, a.quimica, 'pendente')
      // Vínculo encerrado na turma X (a do 2ºB) e aberto na Y (o 2ºC).
      const trocada = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, trocada.usuarioId, a.turma, a.quimica)
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [a.escolaId, trocada.usuarioId, a.turma])
      await vincularProfessor(bancada, a, trocada.usuarioId, a.outraTurma, a.quimica)

      const inexistente = randomUUID()
      for (const sessao of [b.professora, a.colega, a.deFisica, sentinela, trocada, a.coordenacao, a.aluno, ana]) {
        const dEstender = await estender(sessao, id, { alunoId: ana.usuarioId, minutos: 10, chave: randomUUID() })
        const dAcompanhar = await acompanhar(sessao, id)
        expect(erro(dEstender)).toEqual(erro(await estender(sessao, inexistente, { alunoId: ana.usuarioId, minutos: 10, chave: randomUUID() })))
        expect(erro(dAcompanhar)).toEqual(erro(await acompanhar(sessao, inexistente)))
        expect(erro(dEstender)).toEqual(NAO_ENCONTRADO)
        expect(erro(dAcompanhar)).toEqual(NAO_ENCONTRADO)
      }
      expect(await extensoesDe(id)).toEqual([])
      expect(await auditoriasDe(id)).toEqual([])
    })

    it('a escola sem ano em curso: estender e acompanhar são NAO_ENCONTRADO no `:id`, sem gravar', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarProva({ janela: janelaDe(60, 120), duracaoMin: 40 }, c)
      expect((await rotas.pedir(c.coordenacao, 'POST', `/v1/anos-letivos/${c.anoLetivoId}/encerrar`)).status).toBe(200)
      expect(erro(await estender(c.professora, id, { minutos: 10, chave: randomUUID() }))).toEqual(NAO_ENCONTRADO)
      expect(erro(await acompanhar(c.professora, id))).toEqual(NAO_ENCONTRADO)
      expect(await contar('extensao_de_tempo', 'atividade_aplicada_id = $1', [id])).toBe(0)
    })

    it('nos repositories, o id certo com a escola trocada ou o ano trocado não acha nada, e a extensão não grava; no contexto da dona, acha', async () => {
      const { banco } = bancada
      const id = await aplicarProva()
      await iniciarTentativa(id, ana, { haMin: 5, baseEmMin: 35 })
      const anterior = await montarAnoAnterior(bancada, a)
      const leituras: Record<string, () => Promise<unknown>> = {
        'o acompanhamento': () => new AcompanhamentoRepository(banco).read(id),
        'a aplicação travada para estender': () => new ExtensaoRepository(banco).lockParaEstender(id),
      }
      expect(await runInContext(contextoDaProfessora(), leituras['o acompanhamento'] as () => Promise<unknown>), 'o acompanhamento no contexto da dona').toMatchObject({ atividadeAplicadaId: id })
      expect(await runInContext(contextoDaProfessora(), leituras['a aplicação travada para estender'] as () => Promise<unknown>), 'a aplicação no contexto da dona').toMatchObject({ id })
      for (const [nome, ler] of Object.entries(leituras)) {
        for (const [onde, escolaId, anoLetivoId, sessao] of [
          ['com a escola trocada', b.escolaId, a.anoLetivoId, b.professora],
          ['com o ano trocado', a.escolaId, anterior.anoLetivoId, a.professora],
          ['com o ano de ninguém', a.escolaId, randomUUID(), a.professora],
          ['com a escola da B e o professor da A', b.escolaId, a.anoLetivoId, a.professora],
        ] as const) expect(await runInContext(contexto(escolaId, anoLetivoId, sessao, 'professor'), ler), `${nome} ${onde}`).toBeUndefined()
      }
      // A gravação com a escola ou o ano trocado não passa pela FK composta: nada fica gravado.
      for (const [escolaId, anoLetivoId] of [[b.escolaId, a.anoLetivoId], [a.escolaId, anterior.anoLetivoId]] as const) {
        await expect(runInContext(contexto(escolaId, anoLetivoId, a.professora, 'professor'), () => new ExtensaoRepository(banco).save(id, { minutos: 10, chave: randomUUID() }))).rejects.toThrow()
      }
      expect(await extensoesDe(id)).toEqual([])
    })
  })
})
