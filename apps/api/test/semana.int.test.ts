import { createDatabase, createPool, executarPlanilha, runInContext, SemanaRepository, type Clock, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, semanaResponseSchema, type SemanaResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'

/**
 * A Semana da professora (F2b, tarefa 2.0; `tasks/prd-semana-do-professor/cenarios.md`, "Leitura da semana", R2, R3, R4 e R7): `GET /v1/semana`.
 * As aulas são as alocações dos vínculos `confirmado` da professora da sessão, no ano em curso da escola do token, sem feriado e recesso, com o
 * registro de texto e o que saiu da grade. Postgres real do compose de teste, relógio injetado; escolas, anos e nomes gerados. O calendário do S4
 * e a grade do R4 são gravados pela reimportação real do F2 (`executarPlanilha`).
 */

const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }
const ENTRADA_INVALIDA = { status: 400, codigo: ErrorCode.ENTRADA_INVALIDA }
const PREFIXO = `sem${randomUUID().slice(0, 6)}`

/** Uma quarta-feira, 10h em Brasília. As semanas dos casos são a de 2026-11-02 (segunda) e vizinhas. */
const QUARTA_DE_MANHA = new Date('2026-11-04T13:00:00Z')
const SEGUNDA = '2026-11-02'

function erroDe(resposta: RespostaHttp): { status: number; codigo: unknown } {
  return { status: resposta.status, codigo: (resposta.corpo.erro as { codigo?: unknown } | undefined)?.codigo }
}

type EstadoDoVinculo = 'pendente' | 'confirmado' | 'contestado' | 'encerrado'

interface Escola {
  readonly escolaId: string
  readonly coordenacao: TestSessao
  readonly emCurso: string
  readonly planejado: string
  readonly serieId: string
}

interface Professora {
  readonly sessao: TestSessao
  readonly nome: string
  readonly email: string
}

describe('GET /v1/semana: a professora vê a semana dela (F2b, tarefa 2.0)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const relogio: Clock & { atual: Date } = { atual: QUARTA_DE_MANHA, agora: () => relogio.atual }
  const linhasDeLog: string[] = []
  let api: TestApi
  let apoio: DatabasePool
  // O banco do job e dos casos de repository não é o papel da API: ele alcança todas as escolas. O escopo de cada chamada vem só do `runInContext`
  // (regra 10, item 3), e é a cláusula de escopo do repository que esses casos exercitam.
  let bancoDoJob: Database

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '1000', LIMITE_REQ_ESCOLA_MIN: '1000' } }, linhasDeLog, { ...TEST_APP_OPTIONS, relogioDaSemana: relogio })
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 4, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    bancoDoJob = createDatabase(apoio)
  })

  afterAll(async () => {
    await api.app.close()
    await apoio.end()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const pedir = (sessao: TestSessao, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)

  async function criado(resposta: Promise<RespostaHttp>, status = 201): Promise<string> {
    const lida = await resposta
    expect(lida.status).toBe(status)
    return lida.corpo['id'] as string
  }

  async function anoNovo(coordenacao: TestSessao, ano: number, abrir: boolean): Promise<string> {
    const id = await criado(pedir(coordenacao, 'POST', '/v1/anos-letivos', { ano, inicio: `${String(ano)}-02-01`, fim: `${String(ano)}-12-15` }))
    if (abrir) await criado(pedir(coordenacao, 'POST', `/v1/anos-letivos/${id}/abrir`), 200)
    return id
  }

  /** A escola com a coordenação, o ano de 2026 (02-01 a 12-15) em curso, o de 2027 planejado e a série do 7º ano. */
  async function escolaComAnos(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const { rows } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 7) returning id", [escolaId])
    return { escolaId, coordenacao, emCurso: await anoNovo(coordenacao, 2026, true), planejado: await anoNovo(coordenacao, 2027, false), serieId: rows[0]?.id ?? '' }
  }

  /** A escola só com o ano planejado: nenhum em curso. */
  async function escolaSemAnoEmCurso(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const { rows } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 7) returning id", [escolaId])
    return { escolaId, coordenacao, emCurso: '', planejado: await anoNovo(coordenacao, 2027, false), serieId: rows[0]?.id ?? '' }
  }

  /** A turma do ano (o em curso, se não for dito outro), com a chave que o nome dá. */
  async function turmaNa(e: Escola, nome: string, anoId = e.emCurso): Promise<string> {
    const chave = `${nome.charAt(0)}${nome.slice(-1).toLowerCase()}`
    const { rows } = await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [e.escolaId, anoId, e.serieId, nome, chave])
    return rows[0]?.id ?? ''
  }

  async function disciplinaNa(e: Escola, nome: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into disciplina (escola_id, nome) values ($1, $2) returning id', [e.escolaId, `${nome} ${PREFIXO}`])
    return rows[0]?.id ?? ''
  }

  /** Uma professora da escola com sessão, com nome e e-mail próprios (a conta existe, como na grade: a planilha a acha por ela). */
  async function professoraNa(e: Escola, rotulo: string): Promise<Professora> {
    const sessao = await bancada.sessao(e.escolaId, 'professor')
    const nome = `Prof ${rotulo} ${PREFIXO}`
    const email = `${PREFIXO}-${rotulo}-${randomUUID().slice(0, 6)}@professores.invalid`
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    await bancada.pool.query('update usuario set nome = $2, conta_id = $3 where id = $1', [sessao.usuarioId, nome, conta[0]?.id])
    return { sessao, nome, email }
  }

  /** O vínculo de professor feito à mão, no estado pedido. */
  async function vinculoDireto(e: Escola, usuarioId: string, turmaId: string, disciplinaId: string, estado: EstadoDoVinculo, anoId = e.emCurso): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, contestacao, decidido_em, motivo_encerramento, encerrado_em)
       values ($1, $2, $3, $4, $5, 'professor', $6::text, $7, case when $6::text = 'contestado' then 'turma_errada' end, case when $6::text <> 'pendente' then now() end,
               case when $6::text = 'encerrado' then 'desligamento' end, case when $6::text = 'encerrado' then now() end) returning id`,
      [e.escolaId, anoId, usuarioId, turmaId, disciplinaId, estado, e.coordenacao.usuarioId],
    )
    return rows[0]?.id ?? ''
  }

  /** A alocação do vínculo: dia da semana de 1 (segunda) a 7 (domingo), `HH:MM` de início e fim. */
  async function alocar(e: Escola, vinculoId: string, dia: number, inicio: string, fim: string, sala: string | null = null, anoId = e.emCurso): Promise<void> {
    await bancada.pool.query('insert into alocacao (escola_id, ano_letivo_id, vinculo_id, dia_semana, inicio, fim, sala) values ($1, $2, $3, $4, $5, $6, $7)', [e.escolaId, anoId, vinculoId, dia, inicio, fim, sala])
  }

  /** O registro de texto da aula, gravado direto (a rota de gravação é da 4.0): a tabela `aula`. */
  async function registrar(e: Escola, vinculoId: string, data: string, inicio: string, fim: string, conteudo: string, anoId = e.emCurso): Promise<void> {
    await bancada.pool.query('insert into aula (escola_id, ano_letivo_id, vinculo_id, data, inicio, fim, conteudo) values ($1, $2, $3, $4, $5, $6, $7)', [e.escolaId, anoId, vinculoId, data, inicio, fim, conteudo])
  }

  async function eventoNo(e: Escola, tipo: 'feriado' | 'recesso' | 'evento', inicio: string, fim: string, descricao: string, anoId = e.emCurso): Promise<void> {
    await bancada.pool.query('insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, $3, $4, $5, $6)', [e.escolaId, anoId, tipo, inicio, fim, `${PREFIXO} ${descricao}`])
  }

  /** O professor com um vínculo confirmado numa turma e disciplina novas, com as alocações pedidas: o caso mais comum. */
  async function professoraComAulas(e: Escola, rotulo: string, aulas: Array<[number, string, string]>, nomeDaTurma = '7º A', nomeDaDisciplina = 'Matemática') {
    const professora = await professoraNa(e, rotulo)
    const turmaId = await turmaNa(e, nomeDaTurma)
    const disciplinaId = await disciplinaNa(e, nomeDaDisciplina)
    const vinculoId = await vinculoDireto(e, professora.sessao.usuarioId, turmaId, disciplinaId, 'confirmado')
    for (const [dia, inicio, fim] of aulas) await alocar(e, vinculoId, dia, inicio, fim)
    return { professora, turmaId, disciplinaId, vinculoId }
  }

  const semana = (sessao: TestSessao, segunda = SEGUNDA) => pedir(sessao, 'GET', `/v1/semana?segunda=${segunda}`)

  async function lerSemana(sessao: TestSessao, segunda = SEGUNDA): Promise<SemanaResponse> {
    const lida = await semana(sessao, segunda)
    expect(lida.status).toBe(200)
    return semanaResponseSchema.parse(lida.corpo)
  }

  const aulasDe = (lida: SemanaResponse, data: string) => lida.dias.find((dia) => dia.data === data)?.aulas ?? []
  const datasDe = (lida: SemanaResponse): string[] => lida.dias.map((dia) => dia.data)
  const tirarPrefixo = (texto: string): string => texto.replace(`${PREFIXO} `, '').replace(` ${PREFIXO}`, '')

  /** A planilha do calendário gravada pelo job real, no ano pedido. */
  async function importarCalendario(e: Escola, linhas: string[]): Promise<void> {
    const texto = ['inicio;fim;tipo;descricao', ...linhas].join('\n')
    const id = await criado(pedir(e.coordenacao, 'POST', '/v1/importacoes/calendario', { texto, marcas: { transferir: [], desligar: [], encerrar: [] } }), 202)
    await runInContext({ requisicaoId: randomUUID(), escolaId: e.escolaId }, () =>
      executarPlanilha(bancoDoJob, id, { acharConta: () => Promise.reject(new Error('o calendário não cadastra professor')), travarContas: () => Promise.resolve(true) }),
    )
    const { rows } = await bancada.pool.query<{ estado: string }>('select estado from importacao_planilha where id = $1', [id])
    expect(rows[0]?.estado).toBe('concluida')
  }

  /** A grade gravada pelo job real. */
  async function importarGrade(e: Escola, linhas: string[], encerrar: string[] = []): Promise<void> {
    const texto = ['turma;disciplina;professor;email;dia;inicio;fim;sala', ...linhas].join('\n')
    const id = await criado(pedir(e.coordenacao, 'POST', '/v1/importacoes/grade', { texto, marcas: { transferir: [], desligar: [], encerrar } }), 202)
    await runInContext({ requisicaoId: randomUUID(), escolaId: e.escolaId }, () =>
      executarPlanilha(bancoDoJob, id, { acharConta: () => Promise.reject(new Error('a grade deste teste não cadastra professor')), travarContas: () => Promise.resolve(true) }),
    )
    const { rows } = await bancada.pool.query<{ estado: string }>('select estado from importacao_planilha where id = $1', [id])
    expect(rows[0]?.estado).toBe('concluida')
  }

  it('S1: só o vínculo confirmado gera aula; o encerrado, o pendente e o contestado da mesma professora não aparecem', async () => {
    const e = await escolaComAnos()
    const { professora } = await professoraComAulas(e, 'ana', [[1, '07:30', '08:20']], '7º A', 'Matemática')
    const disciplinaId = await disciplinaNa(e, 'Física')
    for (const estado of ['encerrado', 'pendente', 'contestado'] as const) {
      const turmaId = await turmaNa(e, `7º ${estado.charAt(0).toUpperCase()}`)
      const vinculoId = await vinculoDireto(e, professora.sessao.usuarioId, turmaId, disciplinaId, estado)
      await alocar(e, vinculoId, 1, '09:00', '09:50')
    }

    const lida = await lerSemana(professora.sessao)
    expect(aulasDe(lida, SEGUNDA).map((aula) => [aula.turma, tirarPrefixo(aula.disciplina), aula.inicio, aula.fim])).toEqual([['7º A', 'Matemática', '07:30', '08:20']])
  })

  it('S2: sábado e domingo só aparecem quando a grade tem aula neles, e as aulas do dia vêm em ordem de horário', async () => {
    const e = await escolaComAnos()
    const { professora, vinculoId } = await professoraComAulas(e, 'bia', [[1, '10:00', '10:50']])
    await alocar(e, vinculoId, 1, '07:30', '08:20')
    await alocar(e, vinculoId, 6, '08:00', '08:50')

    const lida = await lerSemana(professora.sessao)
    expect(datasDe(lida)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'])
    expect(aulasDe(lida, SEGUNDA).map((aula) => aula.inicio)).toEqual(['07:30', '10:00'])
    expect(aulasDe(lida, '2026-11-07').map((aula) => aula.inicio)).toEqual(['08:00'])
    expect(aulasDe(lida, '2026-11-03')).toEqual([])
  })

  it('S3: o feriado numa terça tira a aula e o dia traz tipo e descrição; o evento (Conselho de classe) aparece e não tira', async () => {
    const e = await escolaComAnos()
    const { professora } = await professoraComAulas(e, 'cris', [[2, '07:30', '08:20'], [3, '07:30', '08:20']])
    await eventoNo(e, 'feriado', '2026-11-03', '2026-11-03', 'Finados')
    await eventoNo(e, 'evento', '2026-11-04', '2026-11-04', 'Conselho de classe')

    const lida = await lerSemana(professora.sessao)
    const dia = (data: string) => lida.dias.find((d) => d.data === data)
    expect(aulasDe(lida, '2026-11-03')).toEqual([])
    expect(dia('2026-11-03')?.eventos.map((evento) => [evento.tipo, tirarPrefixo(evento.descricao)])).toEqual([['feriado', 'Finados']])
    expect(aulasDe(lida, '2026-11-04')).toHaveLength(1)
    expect(dia('2026-11-04')?.eventos.map((evento) => [evento.tipo, tirarPrefixo(evento.descricao)])).toEqual([['evento', 'Conselho de classe']])
  })

  it('S4: o recesso que começa na sexta anterior e acaba na segunda depois da semana seguinte esvazia as duas semanas (calendário gravado pelo job real)', async () => {
    const e = await escolaComAnos()
    const { professora } = await professoraComAulas(e, 'dani', [[1, '07:30', '08:20'], [3, '07:30', '08:20']])
    await importarCalendario(e, ['2026-10-30;2026-11-16;recesso;Recesso de novembro'])

    const primeira = await lerSemana(professora.sessao, SEGUNDA)
    const segunda = await lerSemana(professora.sessao, '2026-11-09')
    for (const lida of [primeira, segunda]) {
      expect(lida.dias.flatMap((dia) => dia.aulas)).toEqual([])
      expect(lida.dias.every((dia) => dia.eventos.length === 1 && dia.eventos[0]?.tipo === 'recesso')).toBe(true)
      expect(lida.calendarioImportado).toBe(true)
    }
    // A semana seguinte ao recesso (que acaba numa segunda) volta a ter aula na quarta.
    expect(aulasDe(await lerSemana(professora.sessao, '2026-11-16'), '2026-11-18')).toHaveLength(1)
  })

  it('o cruzamento tem as duas metades: o evento que acaba na segunda e o que começa no domingo entram; o que acabou no domingo anterior e o que começa na segunda seguinte, não', async () => {
    const e = await escolaComAnos()
    const { professora, vinculoId } = await professoraComAulas(e, 'edu', [[1, '07:30', '08:20']])
    await alocar(e, vinculoId, 7, '09:00', '09:50')
    await eventoNo(e, 'evento', '2026-10-30', '2026-11-02', 'Acaba na segunda')
    await eventoNo(e, 'feriado', '2026-11-08', '2026-11-08', 'Começa no domingo')
    await eventoNo(e, 'evento', '2026-10-25', '2026-11-01', 'Acabou no domingo anterior')
    await eventoNo(e, 'evento', '2026-11-09', '2026-11-09', 'Começa na segunda seguinte')

    const lida = await lerSemana(professora.sessao)
    const eventosDe = (data: string) => lida.dias.find((dia) => dia.data === data)?.eventos.map((evento) => tirarPrefixo(evento.descricao))
    expect(eventosDe('2026-11-02')).toEqual(['Acaba na segunda'])
    expect(eventosDe('2026-11-08')).toEqual(['Começa no domingo'])
    expect(aulasDe(lida, '2026-11-08')).toEqual([])
    expect(lida.dias.flatMap((dia) => dia.eventos.map((evento) => tirarPrefixo(evento.descricao))).sort()).toEqual(['Acaba na segunda', 'Começa no domingo'])
  })

  it('S5: a semana que atravessa o fim do ano traz só os dias do ano; a semana inteira fora do ano e a anterior ao início não trazem dia', async () => {
    const e = await escolaComAnos()
    const { professora } = await professoraComAulas(e, 'fabi', [[1, '07:30', '08:20'], [2, '07:30', '08:20'], [3, '07:30', '08:20'], [4, '07:30', '08:20'], [5, '07:30', '08:20']])

    // O ano de 2026 vai de 02-01 a 12-15: a semana de 12-14 tem a segunda e a terça dentro dele.
    const noFim = await lerSemana(professora.sessao, '2026-12-14')
    expect(datasDe(noFim)).toEqual(['2026-12-14', '2026-12-15'])
    expect(noFim.ano).toEqual({ inicio: '2026-02-01', fim: '2026-12-15' })
    expect((await lerSemana(professora.sessao, '2026-12-21')).dias).toEqual([])
    expect((await lerSemana(professora.sessao, '2026-01-26')).dias).toEqual([])
    // O primeiro dia do ano é um domingo, sem aula na grade: a semana do início começa na segunda seguinte.
    expect(datasDe(await lerSemana(professora.sessao, '2026-02-02'))).toEqual(['2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05', '2026-02-06'])
  })

  it('S6, o GET: escola sem ano em curso responde `ano: null` e nenhum dia, e não NAO_ENCONTRADO', async () => {
    const e = await escolaSemAnoEmCurso()
    const professora = await professoraNa(e, 'gabi')
    const turmaId = await turmaNa(e, '7º A', e.planejado)
    const vinculoId = await vinculoDireto(e, professora.sessao.usuarioId, turmaId, await disciplinaNa(e, 'Matemática'), 'confirmado', e.planejado)
    await alocar(e, vinculoId, 1, '07:30', '08:20', null, e.planejado)

    const lida = await semana(professora.sessao)
    expect(lida.status).toBe(200)
    expect(lida.corpo).toEqual({ ano: null, hoje: '2026-11-04', agora: '10:00', gradeImportada: false, calendarioImportado: false, dias: [] })
  })

  it('S7, o GET: com o ano novo em curso, o registro do ano anterior (inserido direto, sem a virada) não volta, e a aula do ano novo fica sem texto', async () => {
    const e = await escolaComAnos()
    const antiga = await professoraComAulas(e, 'hana', [[1, '07:30', '08:20']])
    await registrar(e, antiga.vinculoId, '2027-03-01', '07:30', '08:20', 'texto de 2026 numa data de 2027')
    // 2026 sai de cena e 2027 entra em curso; o `delete` da virada não roda, então o registro continua no banco. Quem o esconde é o vínculo: ele não
    // é um dos confirmados do ano em curso, e a leitura só pede os registros desses vínculos (o filtro de ano do repository tem caso próprio).
    await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where id = $1", [e.emCurso])
    await bancada.pool.query("update ano_letivo set situacao = 'em_curso' where id = $1", [e.planejado])
    const turma2027 = await turmaNa(e, '8º A', e.planejado)
    const vinculo2027 = await vinculoDireto(e, antiga.professora.sessao.usuarioId, turma2027, antiga.disciplinaId, 'confirmado', e.planejado)
    await alocar(e, vinculo2027, 1, '07:30', '08:20', null, e.planejado)

    const lida = await lerSemana(antiga.professora.sessao, '2027-03-01')
    expect(lida.ano).toEqual({ inicio: '2027-02-01', fim: '2027-12-15' })
    expect(aulasDe(lida, '2027-03-01').map((aula) => [aula.turma, aula.texto, aula.foraDaGrade])).toEqual([['8º A', null, false]])
  })

  it('o vínculo confirmado do ano anterior, com alocação e registro, não gera aula no ano em curso', async () => {
    const e = await escolaComAnos()
    const antiga = await professoraComAulas(e, 'ines', [[1, '07:30', '08:20']])
    await registrar(e, antiga.vinculoId, '2026-10-26', '07:30', '08:20', 'texto do ano anterior')
    await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where id = $1", [e.emCurso])
    await bancada.pool.query("update ano_letivo set situacao = 'em_curso' where id = $1", [e.planejado])

    // 2027 em curso, e a professora sem vínculo nele: a semana é vazia mesmo com o do ano anterior confirmado, alocado e com texto.
    const lida = await lerSemana(antiga.professora.sessao, '2027-03-01')
    expect(lida.dias.flatMap((dia) => dia.aulas)).toEqual([])
    expect(lida.gradeImportada).toBe(false)
  })

  it('S8: o registro passado de um vínculo encerrado não volta como fora da grade', async () => {
    const e = await escolaComAnos()
    const { professora } = await professoraComAulas(e, 'joana', [[1, '07:30', '08:20']])
    const encerrado = await vinculoDireto(e, professora.sessao.usuarioId, await turmaNa(e, '7º B'), await disciplinaNa(e, 'Ciências'), 'encerrado')
    await registrar(e, encerrado, SEGUNDA, '10:00', '10:50', 'de um vínculo que acabou')

    const lida = await lerSemana(professora.sessao)
    expect(aulasDe(lida, SEGUNDA).map((aula) => aula.inicio)).toEqual(['07:30'])
  })

  it('S11: duas disciplinas na mesma turma, no mesmo horário: o texto de uma não aparece na outra', async () => {
    const e = await escolaComAnos()
    const matematica = await professoraComAulas(e, 'kelly', [[1, '07:30', '08:20']], '7º A', 'Matemática')
    const fisica = await disciplinaNa(e, 'Física')
    const vinculoFisica = await vinculoDireto(e, matematica.professora.sessao.usuarioId, matematica.turmaId, fisica, 'confirmado')
    await alocar(e, vinculoFisica, 1, '07:30', '08:20')
    await registrar(e, matematica.vinculoId, SEGUNDA, '07:30', '08:20', 'só da matemática')

    const lida = await lerSemana(matematica.professora.sessao)
    expect(aulasDe(lida, SEGUNDA).map((aula) => [tirarPrefixo(aula.disciplina), aula.texto])).toEqual([
      ['Física', null],
      ['Matemática', 'só da matemática'],
    ])
  })

  it('S12: a turma sem professor alocado não aparece, e a aula do colega confirmado na mesma turma não é da professora', async () => {
    const e = await escolaComAnos()
    const dela = await professoraComAulas(e, 'lia', [[1, '07:30', '08:20']], '7º A', 'Matemática')
    await turmaNa(e, '7º Z')
    const colega = await professoraNa(e, 'colega')
    const disciplinaDoColega = await disciplinaNa(e, 'História')
    const vinculoDoColega = await vinculoDireto(e, colega.sessao.usuarioId, dela.turmaId, disciplinaDoColega, 'confirmado')
    await alocar(e, vinculoDoColega, 1, '09:00', '09:50')
    await registrar(e, vinculoDoColega, SEGUNDA, '09:00', '09:50', 'texto do colega')
    await registrar(e, vinculoDoColega, SEGUNDA, '11:00', '11:50', 'texto do colega fora da grade')

    const lida = await lerSemana(dela.professora.sessao)
    expect(aulasDe(lida, SEGUNDA).map((aula) => [aula.turma, aula.inicio])).toEqual([['7º A', '07:30']])
    expect(JSON.stringify(lida)).not.toContain('texto do colega')
    // O colega vê as dele: a da grade e a que saiu dela (o horário das 11h não tem alocação, e é passado).
    expect(aulasDe(await lerSemana(colega.sessao), SEGUNDA).map((aula) => [tirarPrefixo(aula.disciplina), aula.texto, aula.foraDaGrade])).toEqual([
      ['História', 'texto do colega', false],
      ['História', 'texto do colega fora da grade', true],
    ])
  })

  it('S13: às 22h de Brasília (já o dia seguinte em UTC), `hoje` e `agora` são os de Brasília', async () => {
    const e = await escolaComAnos()
    const { professora } = await professoraComAulas(e, 'mara', [[3, '07:30', '08:20']])
    relogio.atual = new Date('2026-11-05T01:00:00Z')
    try {
      const lida = await lerSemana(professora.sessao)
      expect(lida.hoje).toBe('2026-11-04')
      expect(lida.agora).toBe('22:00')
    } finally {
      relogio.atual = QUARTA_DE_MANHA
    }
  })

  it('o `hoje` separa o passado do resto: o registro fora da grade de ontem aparece com o texto; o de hoje e o de amanhã, sem alocação, não', async () => {
    const e = await escolaComAnos()
    const { professora, vinculoId } = await professoraComAulas(e, 'nina', [[1, '07:30', '08:20']])
    await registrar(e, vinculoId, '2026-11-03', '10:00', '10:50', 'ontem fora da grade')
    await registrar(e, vinculoId, '2026-11-04', '10:00', '10:50', 'hoje fora da grade')
    await registrar(e, vinculoId, '2026-11-05', '10:00', '10:50', 'amanhã fora da grade')

    const lida = await lerSemana(professora.sessao)
    expect(aulasDe(lida, '2026-11-03').map((aula) => [aula.inicio, aula.fim, aula.texto, aula.foraDaGrade, aula.sala])).toEqual([['10:00', '10:50', 'ontem fora da grade', true, null]])
    expect(aulasDe(lida, '2026-11-04')).toEqual([])
    expect(aulasDe(lida, '2026-11-05')).toEqual([])
  })

  it('S16, o GET: a aula dupla traz cada aula com o próprio texto', async () => {
    const e = await escolaComAnos()
    const { professora, vinculoId } = await professoraComAulas(e, 'olga', [[1, '07:30', '08:20'], [1, '08:20', '09:10']])
    await registrar(e, vinculoId, SEGUNDA, '07:30', '08:20', 'primeira aula')
    await registrar(e, vinculoId, SEGUNDA, '08:20', '09:10', 'segunda aula')

    const lida = await lerSemana(professora.sessao)
    expect(aulasDe(lida, SEGUNDA).map((aula) => [aula.inicio, aula.texto])).toEqual([['07:30', 'primeira aula'], ['08:20', 'segunda aula']])
  })

  it('`gradeImportada` e `calendarioImportado` são da escola do token: a A sem grade e sem calendário diz false, mesmo com a B completa', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    const semGrade = await professoraNa(a, 'paula')
    const deB = await professoraComAulas(b, 'quiteria', [[1, '07:30', '08:20']])
    await eventoNo(b, 'feriado', '2026-11-03', '2026-11-03', 'Finados da B')

    const vazia = await lerSemana(semGrade.sessao)
    expect([vazia.gradeImportada, vazia.calendarioImportado]).toEqual([false, false])
    const completa = await lerSemana(deB.professora.sessao)
    expect([completa.gradeImportada, completa.calendarioImportado]).toEqual([true, true])
  })

  it('`gradeImportada` olha a escola e não a professora: com a grade de uma colega, a professora sem aula vê true e semana vazia', async () => {
    const e = await escolaComAnos()
    await professoraComAulas(e, 'rita', [[1, '07:30', '08:20']])
    const semAula = await professoraNa(e, 'sem-aula')

    const lida = await lerSemana(semAula.sessao)
    expect(lida.gradeImportada).toBe(true)
    expect(lida.dias.flatMap((dia) => dia.aulas)).toEqual([])
  })

  it('o `calendarioImportado` e as aulas da A seguem a A quando a B tem calendário: o feriado da B no mesmo dia não tira a aula da A (R3)', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    const daA = await professoraComAulas(a, 'sonia', [[2, '07:30', '08:20']])
    await professoraComAulas(b, 'tania', [[2, '07:30', '08:20']])
    await eventoNo(b, 'feriado', '2026-11-03', '2026-11-03', 'Feriado só da B')
    await eventoNo(b, 'evento', '2026-11-03', '2026-11-03', 'Evento só da B')

    const lida = await lerSemana(daA.professora.sessao)
    expect(aulasDe(lida, '2026-11-03')).toHaveLength(1)
    expect(lida.dias.flatMap((dia) => dia.eventos)).toEqual([])
    expect(lida.calendarioImportado).toBe(false)
    expect(JSON.stringify(lida)).not.toContain('só da B')
  })

  it('o `ano` é o da escola do token: a B com outras datas não muda o período da A', async () => {
    const a = await escolaComAnos()
    const b = await escolaSemAnoEmCurso()
    const daA = await professoraComAulas(a, 'ursula', [[1, '07:30', '08:20']])
    await professoraNa(b, 'vera')

    expect((await lerSemana(daA.professora.sessao)).ano).toEqual({ inicio: '2026-02-01', fim: '2026-12-15' })
  })

  it('R2: a professora de duas escolas, com o token de uma, não vê aula, registro nem evento da outra', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    const naA = await professoraComAulas(a, 'wanda', [[1, '07:30', '08:20']], '7º A', 'Matemática')
    const naB = await professoraComAulas(b, 'wanda-b', [[1, '09:00', '09:50']], '9º B', 'Geografia')
    // A mesma pessoa nas duas escolas: a conta é uma só.
    const { rows } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [naA.professora.sessao.usuarioId])
    await bancada.pool.query('update usuario set conta_id = $2 where id = $1', [naB.professora.sessao.usuarioId, rows[0]?.conta_id])
    await registrar(a, naA.vinculoId, SEGUNDA, '07:30', '08:20', 'texto da escola A')
    await registrar(b, naB.vinculoId, SEGUNDA, '09:00', '09:50', 'texto da escola B')
    await eventoNo(b, 'evento', SEGUNDA, SEGUNDA, 'Evento da B')

    const lida = await lerSemana(naA.professora.sessao)
    expect(aulasDe(lida, SEGUNDA).map((aula) => [aula.turma, aula.texto])).toEqual([['7º A', 'texto da escola A']])
    expect(JSON.stringify(lida)).not.toMatch(/9º B|Geografia|escola B|Evento da B/)
  })

  it('R4: o substituto não lê o texto do antecessor, e o antecessor não recebe a aula nem o fora da grade (a grade é reimportada pelo job real)', async () => {
    const e = await escolaComAnos()
    const antecessor = await professoraNa(e, 'antecessor')
    const substituto = await professoraNa(e, 'substituto')
    await turmaNa(e, '8º A')
    await disciplinaNa(e, 'Química')
    const linha = (p: Professora) => ['8A', `Química ${PREFIXO}`, p.nome, p.email, 'segunda', '8:00', '8:50', ''].join(';')
    await importarGrade(e, [linha(antecessor)])
    const { rows: doAntecessor } = await bancada.pool.query<{ id: string }>('select id from vinculo where escola_id = $1 and usuario_id = $2', [e.escolaId, antecessor.sessao.usuarioId])
    const vinculoAntigo = doAntecessor[0]?.id ?? ''
    await bancada.pool.query("update vinculo set estado = 'confirmado', decidido_em = now() where id = $1", [vinculoAntigo])
    await registrar(e, vinculoAntigo, '2026-10-26', '08:00', '08:50', 'texto do antecessor, passado')
    await registrar(e, vinculoAntigo, SEGUNDA, '08:00', '08:50', 'texto do antecessor, desta segunda')

    // Reimportação real: o antecessor sai da grade (encerra por realocação) e o substituto entra no mesmo dia e horário.
    await importarGrade(e, [linha(substituto)], [vinculoAntigo])
    const { rows: doSubstituto } = await bancada.pool.query<{ id: string }>('select id from vinculo where escola_id = $1 and usuario_id = $2', [e.escolaId, substituto.sessao.usuarioId])
    await bancada.pool.query("update vinculo set estado = 'confirmado', decidido_em = now() where id = $1", [doSubstituto[0]?.id])
    const { rows: estado } = await bancada.pool.query<{ estado: string }>('select estado from vinculo where id = $1', [vinculoAntigo])
    expect(estado[0]?.estado).toBe('encerrado')

    const doNovo = await lerSemana(substituto.sessao)
    expect(aulasDe(doNovo, SEGUNDA).map((aula) => [aula.inicio, aula.texto, aula.foraDaGrade])).toEqual([['08:00', null, false]])
    expect(aulasDe(doNovo, '2026-10-26')).toEqual([])
    expect(JSON.stringify(doNovo)).not.toContain('texto do antecessor')
    expect((await lerSemana(antecessor.sessao)).dias.flatMap((dia) => dia.aulas)).toEqual([])
    expect(aulasDe(await lerSemana(antecessor.sessao, '2026-10-26'), '2026-10-26')).toEqual([])
  })

  it('R7: a coordenação e o aluno, com o token direto no `GET /v1/semana`, recebem a recusa da matriz e nada é lido', async () => {
    const e = await escolaComAnos()
    const { professora, vinculoId } = await professoraComAulas(e, 'xuxa', [[1, '07:30', '08:20']])
    await registrar(e, vinculoId, SEGUNDA, '07:30', '08:20', 'texto que a coordenação não lê')
    const aluno = await bancada.sessao(e.escolaId, 'aluno')

    for (const sessao of [e.coordenacao, aluno]) {
      const lida = await semana(sessao)
      expect(erroDe(lida)).toEqual(NAO_ENCONTRADO)
      expect(JSON.stringify(lida.corpo)).not.toContain('texto que a coordenação não lê')
    }
    expect(aulasDe(await lerSemana(professora.sessao), SEGUNDA)).toHaveLength(1)
  })

  it('G7, pela rota: `segunda` que não é segunda, data impossível, consulta sem `segunda` e campo a mais respondem ENTRADA_INVALIDA', async () => {
    const e = await escolaComAnos()
    const { professora } = await professoraComAulas(e, 'yara', [[1, '07:30', '08:20']])

    expect(erroDe(await semana(professora.sessao, '2026-11-03'))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await semana(professora.sessao, '2026-11-08'))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await semana(professora.sessao, '2026-02-30'))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await pedir(professora.sessao, 'GET', '/v1/semana'))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await pedir(professora.sessao, 'GET', `/v1/semana?segunda=${SEGUNDA}&escolaId=${e.escolaId}`))).toEqual(ENTRADA_INVALIDA)
  })

  it('o DTO: as chaves exatas da resposta, do dia e da aula, sem e-mail, nome de professor, nome de aluno nem `atualizadoEm`', async () => {
    const e = await escolaComAnos()
    const { professora, vinculoId } = await professoraComAulas(e, 'zeca', [[1, '07:30', '08:20']])
    await registrar(e, vinculoId, SEGUNDA, '07:30', '08:20', 'frações')
    await eventoNo(e, 'evento', SEGUNDA, SEGUNDA, 'Reunião')

    const lida = await semana(professora.sessao)
    expect(lida.status).toBe(200)
    expect(Object.keys(lida.corpo).sort()).toEqual(['agora', 'ano', 'calendarioImportado', 'dias', 'gradeImportada', 'hoje'])
    const dia = (lida.corpo['dias'] as Array<Record<string, unknown>>)[0] ?? {}
    expect(Object.keys(dia).sort()).toEqual(['aulas', 'data', 'eventos', 'itens'])
    expect(Object.keys((dia['eventos'] as Array<Record<string, unknown>>)[0] ?? {}).sort()).toEqual(['descricao', 'tipo'])
    expect(Object.keys((dia['aulas'] as Array<Record<string, unknown>>)[0] ?? {}).sort()).toEqual(['disciplina', 'disciplinaId', 'fim', 'foraDaGrade', 'inicio', 'sala', 'texto', 'turma', 'turmaId', 'vinculoId'])
    const bruto = JSON.stringify(lida.corpo)
    expect(bruto).not.toContain(professora.email)
    expect(bruto).not.toContain(professora.nome)
    expect(bruto).not.toContain('atualizadoEm')
    expect(bruto).not.toContain('atualizado_em')
  })

  it('a sala da alocação chega na aula, e a aula sem sala traz `null`', async () => {
    const e = await escolaComAnos()
    const { professora, vinculoId } = await professoraComAulas(e, 'abel', [[1, '07:30', '08:20']])
    await alocar(e, vinculoId, 1, '09:00', '09:50', 'Laboratório 2')

    const lida = await lerSemana(professora.sessao)
    expect(aulasDe(lida, SEGUNDA).map((aula) => [aula.inicio, aula.sala])).toEqual([['07:30', null], ['09:00', 'Laboratório 2']])
  })

  it('os itens do dia vão vazios até a 3.0', async () => {
    const e = await escolaComAnos()
    const { professora } = await professoraComAulas(e, 'beto', [[1, '07:30', '08:20']])
    expect((await lerSemana(professora.sessao)).dias.every((dia) => dia.itens.length === 0)).toBe(true)
  })

  it('o texto da aula não vai a log: nenhuma linha do log da API traz o conteúdo', async () => {
    const e = await escolaComAnos()
    const { professora, vinculoId } = await professoraComAulas(e, 'caio', [[1, '07:30', '08:20']])
    const sentinela = `sentinela-${randomUUID()}`
    await registrar(e, vinculoId, SEGUNDA, '07:30', '08:20', sentinela)

    expect(aulasDe(await lerSemana(professora.sessao), SEGUNDA)[0]?.texto).toBe(sentinela)
    // O log tem linhas (a requisição foi registrada): a ausência do texto não vem de um log vazio.
    expect(linhasDeLog.length).toBeGreaterThan(0)
    expect(linhasDeLog.some((linha) => linha.includes(sentinela))).toBe(false)
  })

  it('o repository só devolve a escola do contexto: todo id da B, lido no contexto da A, volta vazio', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    const daA = await professoraComAulas(a, 'dora', [[1, '07:30', '08:20']])
    const daB = await professoraComAulas(b, 'edna', [[1, '07:30', '08:20']])
    await registrar(b, daB.vinculoId, SEGUNDA, '07:30', '08:20', 'texto da B')
    await eventoNo(b, 'feriado', SEGUNDA, SEGUNDA, 'Feriado da B')

    // O contexto é o da A (escola, professora e ano dela); todos os ids passados são da B.
    const contextoDaA = { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: daA.professora.sessao.usuarioId, papel: 'professor' as const, sessaoId: daA.professora.sessao.sessaoId, anoLetivoId: a.emCurso }
    const lerComoA = <T>(ler: (repositorio: SemanaRepository) => Promise<T>): Promise<T> => runInContext(contextoDaA, () => ler(new SemanaRepository(createDatabase(apoio))))

    // A professora da B, no contexto da escola A: o `usuarioId` e o ano são da B, e só a escola do contexto os separa.
    const contextoDaBNaA = { ...contextoDaA, usuarioId: daB.professora.sessao.usuarioId, sessaoId: daB.professora.sessao.sessaoId }
    expect(await runInContext(contextoDaBNaA, () => new SemanaRepository(createDatabase(apoio)).vinculosDaProfessora(b.emCurso))).toEqual([])
    expect(await lerComoA((r) => r.vinculosDaProfessora(b.emCurso))).toEqual([])
    expect(await lerComoA((r) => r.alocacoesDosVinculos(b.emCurso, [daB.vinculoId]))).toEqual([])
    expect(await lerComoA((r) => r.registrosDosVinculos(b.emCurso, [daB.vinculoId], SEGUNDA, '2026-11-08'))).toEqual([])
    expect(await lerComoA((r) => r.eventosDaSemana(b.emCurso, SEGUNDA, '2026-11-08'))).toEqual([])
    expect(await lerComoA((r) => r.gradeImportada(b.emCurso))).toBe(false)
    expect(await lerComoA((r) => r.calendarioImportado(b.emCurso))).toBe(false)
    // Os da A, com o mesmo contexto, voltam: o vazio acima é do escopo, e não de um repository quebrado.
    expect(await lerComoA((r) => r.alocacoesDosVinculos(a.emCurso, [daA.vinculoId]))).toHaveLength(1)
    // O ano em curso do contexto é o da A, qualquer que seja o da B.
    expect((await lerComoA((r) => r.anoEmCurso()))?.id).toBe(a.emCurso)

    // O contexto da B: a escola B tem grade e calendário no ano em curso, e nenhum no planejado dela.
    const contextoDaB = { requisicaoId: randomUUID(), escolaId: b.escolaId, usuarioId: daB.professora.sessao.usuarioId, papel: 'professor' as const, sessaoId: daB.professora.sessao.sessaoId, anoLetivoId: b.emCurso }
    const lerComoB = <T>(ler: (repositorio: SemanaRepository) => Promise<T>): Promise<T> => runInContext(contextoDaB, () => ler(new SemanaRepository(createDatabase(apoio))))
    expect(await lerComoB((r) => r.calendarioImportado(b.emCurso))).toBe(true)
    expect(await lerComoB((r) => r.calendarioImportado(b.planejado))).toBe(false)
  })

  it('o repository do ano em curso: o ano de outra escola, e o ano que não está em curso, no contexto, não são achados', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    const professora = await professoraNa(a, 'hugo')
    const contexto = (anoLetivoId: string) => ({ requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: professora.sessao.usuarioId, papel: 'professor' as const, sessaoId: professora.sessao.sessaoId, anoLetivoId })
    const anoDo = (anoLetivoId: string | null) =>
      runInContext({ ...contexto(''), anoLetivoId }, () => new SemanaRepository(createDatabase(apoio)).anoEmCurso())

    expect(await anoDo(a.emCurso)).toEqual({ id: a.emCurso, inicio: '2026-02-01', fim: '2026-12-15' })
    // O id da B no contexto da A, e o ano planejado da própria A: nenhum dos dois é o ano em curso desta escola.
    expect(await anoDo(b.emCurso)).toBeNull()
    expect(await anoDo(a.planejado)).toBeNull()
    expect(await anoDo(null)).toBeNull()
  })

  it('o repository lê só o que é do ano, dos vínculos pedidos e da semana: o ano planejado, a colega, a semana anterior e a seguinte ficam de fora', async () => {
    const a = await escolaComAnos()
    const dela = await professoraComAulas(a, 'iris', [[1, '07:30', '08:20']])
    const colega = await professoraComAulas(a, 'jair', [[1, '07:30', '08:20']], '7º B', 'Física')
    await registrar(a, dela.vinculoId, SEGUNDA, '07:30', '08:20', 'na segunda')
    await registrar(a, dela.vinculoId, '2026-11-08', '09:00', '09:50', 'no domingo')
    await registrar(a, dela.vinculoId, '2026-11-01', '09:00', '09:50', 'no domingo anterior')
    await registrar(a, dela.vinculoId, '2026-11-09', '09:00', '09:50', 'na segunda seguinte')
    await registrar(a, colega.vinculoId, SEGUNDA, '07:30', '08:20', 'da colega')
    await eventoNo(a, 'evento', '2026-10-30', SEGUNDA, 'acaba na segunda')
    await eventoNo(a, 'evento', '2026-11-08', '2026-11-08', 'começa no domingo')
    await eventoNo(a, 'evento', '2026-10-25', '2026-11-01', 'acabou no domingo anterior')
    await eventoNo(a, 'evento', '2026-11-09', '2026-11-09', 'começa na segunda seguinte')
    await eventoNo(a, 'evento', SEGUNDA, SEGUNDA, 'do ano planejado', a.planejado)
    const contexto = { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: dela.professora.sessao.usuarioId, papel: 'professor' as const, sessaoId: dela.professora.sessao.sessaoId, anoLetivoId: a.emCurso }
    const lerComoA = <T>(ler: (repositorio: SemanaRepository) => Promise<T>): Promise<T> => runInContext(contexto, () => ler(new SemanaRepository(createDatabase(apoio))))
    const domingo = '2026-11-08'

    expect((await lerComoA((r) => r.registrosDosVinculos(a.emCurso, [dela.vinculoId], SEGUNDA, domingo))).map((registro) => registro.conteudo)).toEqual(['na segunda', 'no domingo'])
    expect(await lerComoA((r) => r.registrosDosVinculos(a.planejado, [dela.vinculoId], SEGUNDA, domingo))).toEqual([])
    expect((await lerComoA((r) => r.eventosDaSemana(a.emCurso, SEGUNDA, domingo))).map((evento) => tirarPrefixo(evento.descricao))).toEqual(['acaba na segunda', 'começa no domingo'])
    expect(await lerComoA((r) => r.eventosDaSemana(a.planejado, SEGUNDA, domingo))).toHaveLength(1)
    expect(await lerComoA((r) => r.alocacoesDosVinculos(a.emCurso, [dela.vinculoId])).then((alocacoes) => alocacoes.map((alocacao) => alocacao.vinculoId))).toEqual([dela.vinculoId])
    expect(await lerComoA((r) => r.alocacoesDosVinculos(a.planejado, [dela.vinculoId]))).toEqual([])
    expect(await lerComoA((r) => r.vinculosDaProfessora(a.planejado))).toEqual([])
    // A escola A tem grade e calendário no ano em curso, e nenhum no planejado (o evento do planejado é do calendário dele).
    expect(await lerComoA((r) => r.gradeImportada(a.emCurso))).toBe(true)
    expect(await lerComoA((r) => r.gradeImportada(a.planejado))).toBe(false)
    expect(await lerComoA((r) => r.calendarioImportado(a.emCurso))).toBe(true)
  })

  it('o vínculo de professora que o repository acha é o da sessão: a colega confirmada na mesma escola e o mesmo ano não entra', async () => {
    const e = await escolaComAnos()
    const dela = await professoraComAulas(e, 'fani', [[1, '07:30', '08:20']])
    const colega = await professoraComAulas(e, 'gil', [[1, '07:30', '08:20']], '7º B', 'Física')
    // O banco não compara o papel do vínculo com o do usuário: um vínculo `aluno` confirmado, com disciplina, no mesmo usuário, não é aula de professora.
    await bancada.pool.query(
      "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'aluno', 'confirmado', $6, now())",
      [e.escolaId, e.emCurso, dela.professora.sessao.usuarioId, await turmaNa(e, '7º C'), dela.disciplinaId, e.coordenacao.usuarioId],
    )
    const contexto = (usuarioId: string, sessaoId: string) => ({ requisicaoId: randomUUID(), escolaId: e.escolaId, usuarioId, papel: 'professor' as const, sessaoId, anoLetivoId: e.emCurso })

    const dela_ = await runInContext(contexto(dela.professora.sessao.usuarioId, dela.professora.sessao.sessaoId), () => new SemanaRepository(createDatabase(apoio)).vinculosDaProfessora(e.emCurso))
    expect(dela_.map((vinculo) => vinculo.id)).toEqual([dela.vinculoId])
    expect(dela_.some((vinculo) => vinculo.id === colega.vinculoId)).toBe(false)
  })
})
