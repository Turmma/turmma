import { CalendarioRepository, createDatabase, createPool, runInContext, type DatabasePool } from '@educa/core'
import { calendarioResponseSchema, ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'

/**
 * A leitura do calendário (F2, tarefa 5.0; `tasks/prd-onboarding-por-convite/cenarios.md`, RF15 e RF16, "Isolamento e ano letivo"):
 * `GET /v1/calendario`. A coordenação lê o da escola, com o filtro do ano planejado; o professor lê o do ano em curso, e só com
 * vínculo `confirmado`. Postgres real do compose de teste; escolas, anos e descrições gerados.
 */

const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }
const ENTRADA_INVALIDA = { status: 400, codigo: ErrorCode.ENTRADA_INVALIDA }
const PREFIXO = `ler${randomUUID().slice(0, 6)}`

function erroDe(resposta: RespostaHttp): { status: number; codigo: unknown } {
  return { status: resposta.status, codigo: (resposta.corpo.erro as { codigo?: unknown } | undefined)?.codigo }
}

interface Escola {
  readonly escolaId: string
  readonly coordenacao: TestSessao
  readonly emCurso: string
  readonly planejado: string
}

describe('GET /v1/calendario: coordenação e professor (F2, tarefa 5.0)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let apoio: DatabasePool
  /** A série de cada escola: ela só se cria uma vez (uma segunda, igual, é CONFLITO). */
  const series = new Map<string, string>()

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {})
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
  })

  afterAll(async () => {
    await api.app.close()
    await apoio.end()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const pedir = (sessao: TestSessao, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)
  const ler = (sessao: TestSessao, consulta = '') => pedir(sessao, 'GET', `/v1/calendario${consulta}`)

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

  async function escolaComAnos(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    return { escolaId, coordenacao, emCurso: await anoNovo(coordenacao, 2026, true), planejado: await anoNovo(coordenacao, 2027, false) }
  }

  /** O evento no ano, gravado direto: a descrição leva o prefixo desta execução. */
  async function eventoNo(e: Escola, anoLetivoId: string, inicio: string, descricao: string, fim = inicio): Promise<void> {
    await bancada.pool.query("insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, 'feriado', $3, $4, $5)", [e.escolaId, anoLetivoId, inicio, fim, `${PREFIXO} ${descricao}`])
  }

  /** As descrições do calendário lido, sem o prefixo, na ordem em que vieram. */
  const descricoesDe = (resposta: RespostaHttp): string[] =>
    calendarioResponseSchema.parse(resposta.corpo).eventos.map((evento) => evento.descricao.replace(`${PREFIXO} `, ''))

  /** Um professor da escola com um vínculo no estado pedido, na turma e na disciplina que a coordenação criou, no ano em curso. */
  async function professorCom(e: Escola, estado: 'confirmado' | 'pendente' | 'encerrado', anoLetivoId = e.emCurso): Promise<TestSessao> {
    const professor = await bancada.sessao(e.escolaId, 'professor')
    const serie = series.get(e.escolaId) ?? (await criado(pedir(e.coordenacao, 'POST', '/v1/series', { etapa: 'ef_anos_finais', ano: 7 })))
    series.set(e.escolaId, serie)
    const nome = `turma ${randomUUID().slice(0, 6)}`
    // A turma pertence a um ano: a do ano planejado não passa pela API (ela cria no ano em curso), então entra direto.
    const turma =
      anoLetivoId === e.emCurso
        ? await criado(pedir(e.coordenacao, 'POST', '/v1/turmas', { serieId: serie, nome }))
        : ((await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [e.escolaId, anoLetivoId, serie, nome])).rows[0]?.id as string)
    const disciplina = await criado(pedir(e.coordenacao, 'POST', '/v1/disciplinas', { nome: `disciplina ${PREFIXO} ${randomUUID().slice(0, 4)}` }))
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em, motivo_encerramento, encerrado_em)
       values ($1, $2, $3, $4, $5, 'professor', $6, $7, case when $6 = 'pendente' then null else now() end, case when $6 = 'encerrado' then 'desligamento' end, case when $6 = 'encerrado' then now() end)`,
      [e.escolaId, anoLetivoId, professor.usuarioId, turma, disciplina, estado, e.coordenacao.usuarioId],
    )
    return professor
  }

  it('a coordenação lê o calendário do ano em curso, por data de início, e o contrato fecha: id, tipo, datas e descrição', async () => {
    const e = await escolaComAnos()
    await eventoNo(e, e.emCurso, '2026-07-13', 'Recesso', '2026-07-24')
    await eventoNo(e, e.emCurso, '2026-04-21', 'Tiradentes')
    await eventoNo(e, e.planejado, '2027-04-21', 'Tiradentes de 2027')

    const lida = await ler(e.coordenacao)
    expect(lida.status).toBe(200)
    expect(calendarioResponseSchema.parse(lida.corpo).eventos.map((evento) => [evento.inicio, evento.fim])).toEqual([
      ['2026-04-21', '2026-04-21'],
      ['2026-07-13', '2026-07-24'],
    ])
    expect(descricoesDe(lida)).toEqual(['Tiradentes', 'Recesso'])
  })

  it('o filtro `anoLetivoId` do ano planejado traz o calendário dele, e só o dele; o do ano em curso não entra', async () => {
    const e = await escolaComAnos()
    await eventoNo(e, e.emCurso, '2026-04-21', 'Tiradentes de 2026')
    await eventoNo(e, e.planejado, '2027-04-21', 'Tiradentes de 2027')

    expect(descricoesDe(await ler(e.coordenacao, `?anoLetivoId=${e.planejado}`))).toEqual(['Tiradentes de 2027'])
    expect(descricoesDe(await ler(e.coordenacao))).toEqual(['Tiradentes de 2026'])
  })

  it('sem ano em curso: sem filtro responde NAO_ENCONTRADO, e com o do planejado responde', async () => {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const e: Escola = { escolaId, coordenacao, emCurso: '', planejado: await anoNovo(coordenacao, 2027, false) }
    await eventoNo(e, e.planejado, '2027-04-21', 'Tiradentes de 2027')

    expect(erroDe(await ler(coordenacao))).toEqual(NAO_ENCONTRADO)
    expect(descricoesDe(await ler(coordenacao, `?anoLetivoId=${e.planejado}`))).toEqual(['Tiradentes de 2027'])
  })

  it('isolamento: o calendário da B não aparece para a A; o ano da B, em curso ou planejado, responde igual ao inexistente', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    await eventoNo(b, b.emCurso, '2026-05-01', 'Trabalho da B')
    await eventoNo(b, b.planejado, '2027-05-01', 'Trabalho da B em 2027')

    // O ano encerrado da própria escola (a virada do ano letivo) também não é o planejado: igual ao inexistente.
    const encerrado = await anoNovo(a.coordenacao, 2025, false)
    await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where id = $1", [encerrado])
    await eventoNo(a, encerrado, '2025-04-21', 'Tiradentes de 2025')

    expect(descricoesDe(await ler(a.coordenacao))).toEqual([])
    for (const anoLetivoId of [b.emCurso, b.planejado, a.emCurso, encerrado, randomUUID()]) {
      expect(erroDe(await ler(a.coordenacao, `?anoLetivoId=${anoLetivoId}`)), anoLetivoId).toEqual(NAO_ENCONTRADO)
    }
  })

  it('o repositório do calendário só devolve o ano da escola do contexto: o id do ano da B, lido no contexto da A, volta vazio', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    await eventoNo(a, a.emCurso, '2026-04-21', 'Tiradentes da A')
    await eventoNo(b, b.emCurso, '2026-05-01', 'Trabalho da B')
    const lerComo = (escolaId: string, anoLetivoId: string) =>
      runInContext({ requisicaoId: randomUUID(), escolaId }, () => new CalendarioRepository(createDatabase(apoio)).doAno(anoLetivoId))

    expect((await lerComo(a.escolaId, a.emCurso)).map((evento) => evento.descricao)).toEqual([`${PREFIXO} Tiradentes da A`])
    expect(await lerComo(a.escolaId, b.emCurso)).toEqual([])
  })

  it('o filtro é estrito: `escolaId` na consulta e `anoLetivoId` que não é UUID respondem ENTRADA_INVALIDA', async () => {
    const e = await escolaComAnos()
    expect(erroDe(await ler(e.coordenacao, `?escolaId=${e.escolaId}`))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await ler(e.coordenacao, '?anoLetivoId=2027'))).toEqual(ENTRADA_INVALIDA)
  })

  it('isolamento: o professor com vínculo confirmado lê só o calendário da escola dele, no ano em curso', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    await eventoNo(a, a.emCurso, '2026-04-21', 'Tiradentes da A')
    await eventoNo(a, a.planejado, '2027-04-21', 'Tiradentes da A em 2027')
    await eventoNo(b, b.emCurso, '2026-05-01', 'Trabalho da B')
    const professor = await professorCom(a, 'confirmado')

    const lida = await ler(professor)
    expect(lida.status).toBe(200)
    expect(descricoesDe(lida)).toEqual(['Tiradentes da A'])
  })

  it('professor sem vínculo confirmado (pendente, encerrado, só no ano planejado ou nenhum): o calendário responde igual ao inexistente, mesmo com outro professor confirmado na escola', async () => {
    const e = await escolaComAnos()
    await eventoNo(e, e.emCurso, '2026-04-21', 'Tiradentes')
    // Um colega confirmado: o vínculo dele não abre o calendário de quem não tem o seu.
    const colega = await professorCom(e, 'confirmado')
    const sessoes = {
      pendente: await professorCom(e, 'pendente'),
      encerrado: await professorCom(e, 'encerrado'),
      'confirmado só no ano planejado': await professorCom(e, 'confirmado', e.planejado),
      nenhum: await bancada.sessao(e.escolaId, 'professor'),
    }

    for (const [situacao, sessao] of Object.entries(sessoes)) expect(erroDe(await ler(sessao)), situacao).toEqual(NAO_ENCONTRADO)
    expect(descricoesDe(await ler(colega))).toEqual(['Tiradentes'])
  })

  it('o vínculo que acaba fecha o calendário do professor na mesma hora: a leitura seguinte responde NAO_ENCONTRADO', async () => {
    const e = await escolaComAnos()
    await eventoNo(e, e.emCurso, '2026-04-21', 'Tiradentes')
    const professor = await professorCom(e, 'confirmado')
    expect((await ler(professor)).status).toBe(200)

    await bancada.pool.query("update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where usuario_id = $1", [professor.usuarioId])

    expect(erroDe(await ler(professor))).toEqual(NAO_ENCONTRADO)
  })

  it('o professor não escolhe o ano: com `anoLetivoId` (inclusive o planejado da escola dele) responde NAO_ENCONTRADO', async () => {
    const e = await escolaComAnos()
    await eventoNo(e, e.planejado, '2027-04-21', 'Tiradentes de 2027')
    const professor = await professorCom(e, 'confirmado')

    for (const anoLetivoId of [e.planejado, e.emCurso]) expect(erroDe(await ler(professor, `?anoLetivoId=${anoLetivoId}`)), anoLetivoId).toEqual(NAO_ENCONTRADO)
  })

  it('o aluno não lê o calendário e sem token a resposta é 401', async () => {
    const e = await escolaComAnos()
    await eventoNo(e, e.emCurso, '2026-04-21', 'Tiradentes')
    const aluno = await bancada.sessao(e.escolaId, 'aluno')

    expect(erroDe(await ler(aluno))).toEqual(NAO_ENCONTRADO)
    expect(erroDe(await chamar(api.url, 'GET', '/v1/calendario', undefined))).toMatchObject({ status: 401 })
  })
})
