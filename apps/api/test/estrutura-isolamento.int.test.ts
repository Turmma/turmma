import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * Isolamento da estrutura (regra 10, itens 3 a 6; Tech Spec, seção 6): a coordenação de A não lê, não escreve e não
 * descobre a existência de nada de B. Cada caso tem linhas de B que a consulta alcançaria se a cláusula de escola
 * saísse do repository.
 */
describe('estrutura: isolamento entre escolas', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste

  interface EscolaMontada {
    readonly coordenacao: SessaoDeTeste
    readonly emCurso: string
    readonly planejado: string
    readonly serie: string
    readonly disciplina: string
    readonly turma: string
  }

  let a: EscolaMontada
  let b: EscolaMontada

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const get = (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)

  async function criado(resposta: Promise<RespostaHttp>, status = 201): Promise<string> {
    const lida = await resposta
    expect(lida.status).toBe(status)
    return lida.corpo['id'] as string
  }

  /** Uma escola com 2026 em curso, 2027 planejado, o 8º ano, Química e a turma 8ºA. */
  async function montar(): Promise<EscolaMontada> {
    const coordenacao = await bancada.escolaComSessao('coordenador')
    const emCurso = await criado(post(coordenacao, '/v1/anos-letivos', { ano: 2026, inicio: '2026-02-01', fim: '2026-12-15' }))
    await criado(post(coordenacao, `/v1/anos-letivos/${emCurso}/abrir`), 200)
    const planejado = await criado(post(coordenacao, '/v1/anos-letivos', { ano: 2027, inicio: '2027-02-01', fim: '2027-12-15' }))
    const serie = await criado(post(coordenacao, '/v1/series', { etapa: 'ef_anos_finais', ano: 8 }))
    const disciplina = await criado(post(coordenacao, '/v1/disciplinas', { nome: 'Química' }))
    const turma = await criado(post(coordenacao, '/v1/turmas', { serieId: serie, nome: '8ºA' }))
    return { coordenacao, emCurso, planejado, serie, disciplina, turma }
  }

  /** A resposta sem o id da requisição, que muda a cada chamada: o resto precisa ser idêntico. */
  const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo, mensagem: (resposta.corpo.erro as { mensagem?: string } | undefined)?.mensagem })

  async function estadoDe(escola: EscolaMontada): Promise<unknown> {
    const { rows: anos } = await bancada.pool.query('select id, situacao from ano_letivo where escola_id = $1 order by id', [escola.coordenacao.escolaId])
    const { rows: turmas } = await bancada.pool.query('select id, ano_letivo_id, serie_id, nome from turma where escola_id = $1 order by id', [escola.coordenacao.escolaId])
    return { anos, turmas }
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    a = await montar()
    b = await montar()
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  it('`abrir` e `encerrar` com id de B dão o mesmo 404 do inexistente e não mudam nada em B', async () => {
    const antesEmB = await estadoDe(b)
    const inexistente = randomUUID()

    for (const [acao, deB] of [
      ['abrir', b.planejado],
      ['encerrar', b.emCurso],
    ] as const) {
      const comIdDeB = await post(a.coordenacao, `/v1/anos-letivos/${deB}/${acao}`)
      const comInexistente = await post(a.coordenacao, `/v1/anos-letivos/${inexistente}/${acao}`)
      const foraDoFormato = await post(a.coordenacao, `/v1/anos-letivos/nao-e-um-id/${acao}`)
      expect(semRequisicao(comIdDeB), acao).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) })
      expect(semRequisicao(comInexistente), acao).toEqual(semRequisicao(comIdDeB))
      expect(semRequisicao(foraDoFormato), acao).toEqual(semRequisicao(comIdDeB))
    }

    expect(await estadoDe(b)).toEqual(antesEmB)
  })

  it('a turma de B, no contexto de A, abrir, renomear e excluir dão o mesmo 404 do inexistente e do id fora do formato, também em maiúsculas, e nada muda em B', async () => {
    const antesEmB = await estadoDe(b)
    const ids = [b.turma, b.turma.toUpperCase(), randomUUID(), 'nao-e-um-id']
    const chamadas = [
      (id: string) => get(a.coordenacao, `/v1/turmas/${id}`),
      (id: string) => chamar(api.url, 'PATCH', `/v1/turmas/${id}`, a.coordenacao.token, { nome: 'Invadida' }),
      (id: string) => chamar(api.url, 'DELETE', `/v1/turmas/${id}`, a.coordenacao.token),
      (id: string) => get(a.coordenacao, `/v1/turmas/${id}/alunos?finalidade=conferencia_de_cadastro`),
    ]
    for (const chamada of chamadas) {
      const respostas = (await Promise.all(ids.map((id) => chamada(id)))).map(semRequisicao)
      expect(respostas[0]).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) })
      for (const resposta of respostas) expect(resposta).toEqual(respostas[0])
    }
    expect(await estadoDe(b)).toEqual(antesEmB)
    // O id da própria turma, em maiúsculas, é a mesma turma: a coordenação de A a alcança.
    expect((await get(a.coordenacao, `/v1/turmas/${a.turma.toUpperCase()}`)).status).toBe(200)
  })

  it('a turma de um ano encerrado de B, lida pela coordenação de A com o `anoLetivoId` de B, dá o mesmo 404 do inexistente: a cláusula de escola é a única barreira', async () => {
    // Com o ano de B na consulta, o ano em curso de A não exclui a turma de B: só o `eq(turma.escolaId, …)` do repository o faz.
    const { rows: anos } = await bancada.pool.query<{ id: string }>(
      `insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id`,
      [b.coordenacao.escolaId],
    )
    const anoDeB = anos[0]?.id
    if (anoDeB === undefined) throw new Error('ano encerrado de B não criado')
    const { rows: turmas } = await bancada.pool.query<{ id: string }>(`insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '8ºA de 2025') returning id`, [
      b.coordenacao.escolaId,
      anoDeB,
      b.serie,
    ])
    const turmaDeB = turmas[0]?.id
    if (turmaDeB === undefined) throw new Error('turma de 2025 de B não criada')
    const ler = (id: string, rota: string) => get(a.coordenacao, `/v1/turmas/${id}${rota}anoLetivoId=${anoDeB}`)
    const abrir = [await ler(turmaDeB, '?'), await ler(randomUUID(), '?'), await ler('nao-e-um-id', '?')].map(semRequisicao)
    const alunos = [await ler(`${turmaDeB}/alunos?finalidade=conferencia_de_cadastro`, '&'), await ler(`${randomUUID()}/alunos?finalidade=conferencia_de_cadastro`, '&')].map(semRequisicao)
    for (const resposta of [...abrir, ...alunos]) expect(resposta).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) })
    // A coordenação de B, a dona, lê a mesma turma com o mesmo ano: 200.
    expect((await get(b.coordenacao, `/v1/turmas/${turmaDeB}?anoLetivoId=${anoDeB}`)).status).toBe(200)
  })

  it('criar turma com a série de B dá o mesmo 404 da série inexistente, e nenhuma turma nasce em A nem em B', async () => {
    const antesEmA = await estadoDe(a)
    const antesEmB = await estadoDe(b)

    const comSerieDeB = await post(a.coordenacao, '/v1/turmas', { serieId: b.serie, nome: '8ºZ' })
    const comSerieInexistente = await post(a.coordenacao, '/v1/turmas', { serieId: randomUUID(), nome: '8ºZ' })

    expect(semRequisicao(comSerieDeB)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) })
    expect(semRequisicao(comSerieInexistente)).toEqual(semRequisicao(comSerieDeB))
    expect(await estadoDe(a)).toEqual(antesEmA)
    expect(await estadoDe(b)).toEqual(antesEmB)
  })

  it('turma apontando para o ano de B, ou para o outro ano letivo de A, dá o mesmo 404, e nada nasce', async () => {
    const antesEmA = await estadoDe(a)
    const antesEmB = await estadoDe(b)

    const respostas = [
      await post(a.coordenacao, '/v1/turmas', { serieId: a.serie, nome: '8ºZ', anoLetivoId: b.emCurso }),
      await post(a.coordenacao, '/v1/turmas', { serieId: a.serie, nome: '8ºZ', anoLetivoId: a.planejado }),
      await post(a.coordenacao, '/v1/turmas', { serieId: a.serie, nome: '8ºZ', anoLetivoId: randomUUID() }),
    ]

    for (const resposta of respostas) expect(semRequisicao(resposta)).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) })
    expect(await estadoDe(a)).toEqual(antesEmA)
    expect(await estadoDe(b)).toEqual(antesEmB)
    // O mesmo pedido, com o ano em curso de A, cria: o 404 acima veio do ano, não da série nem do nome.
    expect((await post(a.coordenacao, '/v1/turmas', { serieId: a.serie, nome: '8ºZ', anoLetivoId: a.emCurso })).status).toBe(201)
  })

  it('o banco recusa a turma de A com a série ou o ano de B, mesmo por fora da rota: as FKs compostas são a segunda camada', async () => {
    const cliente = new pg.Client({ connectionString: urlDoBancoDeTeste() })
    await cliente.connect()
    try {
      const inserir = (anoLetivoId: string, serieId: string) =>
        cliente.query("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '8ºFK')", [a.coordenacao.escolaId, anoLetivoId, serieId]).then(
          () => undefined,
          (falha: { code?: string; constraint?: string }) => ({ codigo: falha.code, restricao: falha.constraint }),
        )
      expect(await inserir(a.emCurso, b.serie)).toEqual({ codigo: '23503', restricao: 'turma_serie_da_escola_fk' })
      expect(await inserir(b.emCurso, a.serie)).toEqual({ codigo: '23503', restricao: 'turma_ano_letivo_da_escola_fk' })
    } finally {
      await cliente.end()
    }
    const { rows } = await bancada.pool.query<{ total: string }>("select count(*) as total from turma where nome = '8ºFK' and escola_id = any($1::uuid[])", [
      [a.coordenacao.escolaId, b.coordenacao.escolaId],
    ])
    expect(Number(rows[0]?.total)).toBe(0)
  })

  // A listagem de turmas filtra por escola e pelo ano em curso do contexto, que é da escola: o teste do "7ºA" em
  // estrutura.int.test.ts é o que quebra sem a cláusula de ano.
  it('as listagens da coordenação de A trazem só o que é de A, com as linhas de B existindo', async () => {
    const idsDe = async (caminho: string) => ((await get(a.coordenacao, caminho)).corpo['itens'] as Array<{ id: string }>).map((item) => item.id)

    const anos = await idsDe('/v1/anos-letivos')
    const series = await idsDe('/v1/series')
    const disciplinas = await idsDe('/v1/disciplinas')
    const turmas = await idsDe('/v1/turmas')

    expect(anos).toEqual(expect.arrayContaining([a.emCurso, a.planejado]))
    expect(anos).toHaveLength(2)
    expect(series).toEqual([a.serie])
    expect(disciplinas).toEqual([a.disciplina])
    expect(turmas).toContain(a.turma)
    for (const deB of [b.emCurso, b.planejado, b.serie, b.disciplina, b.turma]) {
      expect([...anos, ...series, ...disciplinas, ...turmas]).not.toContain(deB)
    }
  })

  it('a série e a disciplina de A não conflitam com as iguais de B: o nome e o recorte se repetem entre escolas', async () => {
    const outra = await bancada.escolaComSessao('coordenador')
    expect((await post(outra, '/v1/series', { etapa: 'ef_anos_finais', ano: 8 })).status).toBe(201)
    expect((await post(outra, '/v1/disciplinas', { nome: 'química' })).status).toBe(201)
  })
})
