import { CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA, createDatabase, createPool, executarPlanilha, runInContext, type Clock, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, gravarAulaResponseSchema } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import { aguardar, esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * A professora grava o que vai dar (F2b, tarefa 4.0; `tasks/prd-semana-do-professor/cenarios.md`, "Gravação", R1, R1b, R4, R7, S6, S16, J13 e J14):
 * `PUT /v1/aulas`. Postgres real do compose de teste e relógio injetado (quarta, 2026-11-04, 10h em Brasília); escolas, anos e nomes gerados. A
 * grade do R4 é gravada pela reimportação real do F2 (`executarPlanilha`). A gravação passa pelo vínculo dela, pelo ano em curso e pela trava do
 * vínculo, nesta ordem; o que não é dela responde como o inexistente.
 */

const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }
const ENTRADA_INVALIDA = { status: 400, codigo: ErrorCode.ENTRADA_INVALIDA }
const INDISPONIVEL = { status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO }
const PREFIXO = `aul${randomUUID().slice(0, 6)}`

/** Uma quarta-feira, 10h em Brasília: `hoje` é 2026-11-04. */
const QUARTA_DE_MANHA = new Date('2026-11-04T13:00:00Z')
const SEGUNDA_PASSADA = '2026-11-02'
const HOJE = '2026-11-04'
const SEGUNDA_FUTURA = '2026-11-09'
const TERCA_FUTURA = '2026-11-10'
const QUARTA_DO_FERIADO_DE_B = '2026-11-18'

function erroDe(resposta: RespostaHttp): { status: number; codigo: unknown } {
  return { status: resposta.status, codigo: (resposta.corpo.erro as { codigo?: unknown } | undefined)?.codigo }
}

/** A recusa inteira, com a mensagem: o que o cliente vê, para provar que os casos de R1 respondem a mesma coisa. */
function recusaDe(resposta: RespostaHttp): { status: number; codigo: unknown; mensagem: unknown } {
  return { ...erroDe(resposta), mensagem: (resposta.corpo.erro as { mensagem?: unknown } | undefined)?.mensagem }
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

interface AulaRow {
  readonly data: string
  readonly inicio: string
  readonly fim: string
  readonly conteudo: string
  readonly atualizado_em: Date
}

describe('PUT /v1/aulas: a professora grava o que vai dar (F2b, tarefa 4.0)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const relogio: Clock & { atual: Date } = { atual: QUARTA_DE_MANHA, agora: () => relogio.atual }
  const linhasDeLog: string[] = []
  let api: TestApi
  let apoio: DatabasePool
  let bancoDoJob: Database

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '1000', LIMITE_REQ_ESCOLA_MIN: '1000' } }, linhasDeLog, { ...TEST_APP_OPTIONS, relogioDaSemana: relogio })
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 6, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    bancoDoJob = createDatabase(apoio)
  })

  afterAll(async () => {
    await api.app.close()
    await apoio.end()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const pedir = (sessao: TestSessao, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)
  const gravar = (sessao: TestSessao, corpo: unknown) => pedir(sessao, 'PUT', '/v1/aulas', corpo)
  const texto = (vinculoId: string, data: string, inicio: string, conteudo: string) => ({ vinculoId, data, inicio, texto: conteudo })

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

  async function turmaNa(e: Escola, nome: string, anoId = e.emCurso): Promise<string> {
    const chave = `${nome.charAt(0)}${nome.slice(-1).toLowerCase()}`
    const { rows } = await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [e.escolaId, anoId, e.serieId, nome, chave])
    return rows[0]?.id ?? ''
  }

  async function disciplinaNa(e: Escola, nome: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into disciplina (escola_id, nome) values ($1, $2) returning id', [e.escolaId, `${nome} ${PREFIXO}`])
    return rows[0]?.id ?? ''
  }

  /** Uma professora da escola com sessão, nome e e-mail próprios (a conta existe, como na grade: a planilha a acha por ela). */
  async function professoraNa(e: Escola, rotulo: string): Promise<Professora> {
    const sessao = await bancada.sessao(e.escolaId, 'professor')
    const nome = `Prof ${rotulo} ${PREFIXO}`
    const email = `${PREFIXO}-${rotulo}-${randomUUID().slice(0, 6)}@professores.invalid`
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    await bancada.pool.query('update usuario set nome = $2, conta_id = $3 where id = $1', [sessao.usuarioId, nome, conta[0]?.id])
    return { sessao, nome, email }
  }

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
  async function alocar(e: Escola, vinculoId: string, dia: number, inicio: string, fim: string, anoId = e.emCurso): Promise<void> {
    await bancada.pool.query('insert into alocacao (escola_id, ano_letivo_id, vinculo_id, dia_semana, inicio, fim) values ($1, $2, $3, $4, $5, $6)', [e.escolaId, anoId, vinculoId, dia, inicio, fim])
  }

  /** O registro de texto da aula, gravado direto no banco (o que a rota não grava: o passado sem alocação, ou o de um feriado novo). */
  async function registrar(e: Escola, vinculoId: string, data: string, inicio: string, fim: string, conteudo: string, anoId = e.emCurso): Promise<void> {
    await bancada.pool.query('insert into aula (escola_id, ano_letivo_id, vinculo_id, data, inicio, fim, conteudo) values ($1, $2, $3, $4, $5, $6, $7)', [e.escolaId, anoId, vinculoId, data, inicio, fim, conteudo])
  }

  async function eventoNo(e: Escola, tipo: 'feriado' | 'recesso' | 'evento', inicio: string, fim: string, descricao: string, anoId = e.emCurso): Promise<void> {
    await bancada.pool.query('insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, $3, $4, $5, $6)', [e.escolaId, anoId, tipo, inicio, fim, `${PREFIXO} ${descricao}`])
  }

  /** A professora com um vínculo confirmado numa turma e disciplina novas e as alocações pedidas: segunda e quarta, 7h30, se nada for dito. */
  async function professoraComAulas(e: Escola, rotulo: string, aulas: Array<[number, string, string]> = [[1, '07:30', '08:20'], [3, '07:30', '08:20']], nomeDaTurma = '7º A', nomeDaDisciplina = 'Matemática') {
    const professora = await professoraNa(e, rotulo)
    const turmaId = await turmaNa(e, nomeDaTurma)
    const disciplinaId = await disciplinaNa(e, nomeDaDisciplina)
    const vinculoId = await vinculoDireto(e, professora.sessao.usuarioId, turmaId, disciplinaId, 'confirmado')
    for (const [dia, inicio, fim] of aulas) await alocar(e, vinculoId, dia, inicio, fim)
    return { professora, turmaId, disciplinaId, vinculoId }
  }

  /** As linhas de `aula` do vínculo, com o texto, direto do banco. */
  async function linhasDe(vinculoId: string): Promise<AulaRow[]> {
    const { rows } = await bancada.pool.query<AulaRow>(
      "select to_char(data, 'YYYY-MM-DD') as data, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim, conteudo, atualizado_em from aula where vinculo_id = $1 order by data, inicio",
      [vinculoId],
    )
    return rows
  }

  /** A grade gravada pelo job real. */
  async function importarGrade(e: Escola, linhas: string[], encerrar: string[] = []): Promise<void> {
    const planilha = ['turma;disciplina;professor;email;dia;inicio;fim;sala', ...linhas].join('\n')
    const id = await criado(pedir(e.coordenacao, 'POST', '/v1/importacoes/grade', { texto: planilha, marcas: { transferir: [], desligar: [], encerrar } }), 202)
    await runInContext({ requisicaoId: randomUUID(), escolaId: e.escolaId }, () =>
      executarPlanilha(bancoDoJob, id, { acharConta: () => Promise.reject(new Error('a grade deste teste não cadastra professor')), travarContas: () => Promise.resolve(true) }),
    )
    const { rows } = await bancada.pool.query<{ estado: string }>('select estado from importacao_planilha where id = $1', [id])
    expect(rows[0]?.estado).toBe('concluida')
  }

  /**
   * Segura a trava do vínculo como a gravação a pega (`hashtext(escolaId ‖ vinculoId)`), numa transação do teste que não confirma. `soltar` desfaz e
   * devolve a conexão. Sem `escolaId`, segura a chave só do vínculo: a que a gravação pegaria se a escola ficasse fora da chave.
   */
  async function segurarTrava(escolaId: string | null, vinculoId: string): Promise<{ soltar: () => Promise<void> }> {
    const segurador = await apoio.connect()
    await segurador.query('begin')
    await segurador.query('select pg_advisory_xact_lock($1, hashtext($2::text))', [CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA, `${escolaId ?? ''}${vinculoId}`])
    return {
      soltar: async () => {
        try {
          await segurador.query('rollback')
        } finally {
          segurador.release()
        }
      },
    }
  }

  /**
   * Quantas transações esperam, agora, em alguma trava consultiva da classe da gravação. Lê o banco inteiro, sem filtrar o que o caso criou: só é confiável
   * porque a integração roda um arquivo por vez (`fileParallelism: false`). Se a 5.0 deixar transações esperando nesta classe, filtre pelo `objid` do caso.
   */
  async function esperandoNaTravaDoVinculo(): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: number }>("select count(*)::int as total from pg_locks where locktype = 'advisory' and classid = $1 and not granted", [CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA])
    return rows[0]?.total ?? 0
  }

  describe('o que a rota grava', () => {
    it('grava o texto da aula da grade e responde com o contrato exato; a segunda gravação muda o texto e o `atualizadoEm`, e o `fim` é o da alocação', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'ana')

      const primeira = await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'frações equivalentes'))
      expect(primeira.status).toBe(200)
      expect(Object.keys(primeira.corpo).sort()).toEqual(['data', 'inicio', 'texto', 'vinculoId'])
      expect(gravarAulaResponseSchema.parse(primeira.corpo)).toEqual({ vinculoId, data: SEGUNDA_FUTURA, inicio: '07:30', texto: 'frações equivalentes' })
      const [gravada] = await linhasDe(vinculoId)
      expect(gravada).toMatchObject({ data: SEGUNDA_FUTURA, inicio: '07:30', fim: '08:20', conteudo: 'frações equivalentes' })

      // O `fim` da cópia ficou velho (a alocação mudou de duração): a gravação seguinte o traz de volta ao da alocação.
      await bancada.pool.query("update aula set fim = '07:50' where vinculo_id = $1", [vinculoId])
      const segunda = await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'frações e números mistos'))
      expect(segunda.status).toBe(200)
      const linhas = await linhasDe(vinculoId)
      expect(linhas).toHaveLength(1)
      expect(linhas[0]).toMatchObject({ fim: '08:20', conteudo: 'frações e números mistos' })
      expect(linhas[0]?.atualizado_em.getTime()).toBeGreaterThan(gravada?.atualizado_em.getTime() ?? Infinity)
    })

    it('G1: a aula de hoje, com alocação, grava; hoje não é passado, mas a alocação basta', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'beto')

      expect((await gravar(professora.sessao, texto(vinculoId, HOJE, '07:30', 'hoje'))).status).toBe(200)
      expect((await gravar(professora.sessao, texto(vinculoId, SEGUNDA_PASSADA, '07:30', 'passada'))).status).toBe(200)
      expect((await linhasDe(vinculoId)).map((linha) => [linha.data, linha.conteudo])).toEqual([
        [SEGUNDA_PASSADA, 'passada'],
        [HOJE, 'hoje'],
      ])
    })

    it('G2: o registro passado que saiu da grade se corrige, e o `fim` que ele tinha fica', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'carla')
      await registrar(e, vinculoId, '2026-10-26', '08:30', '09:20', 'texto antigo, de uma aula que saiu da grade')

      const corrigida = await gravar(professora.sessao, texto(vinculoId, '2026-10-26', '08:30', 'texto corrigido'))

      expect(corrigida.status).toBe(200)
      expect(await linhasDe(vinculoId)).toEqual([expect.objectContaining({ data: '2026-10-26', inicio: '08:30', fim: '09:20', conteudo: 'texto corrigido' })])
    })

    it('G3: texto vazio e texto só de espaços apagam a linha; 500 caracteres grava; 501 dá ENTRADA_INVALIDA e não grava', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'dani')
      const gravarEm = (conteudo: string) => gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', conteudo))

      expect((await gravarEm('um texto')).status).toBe(200)
      const apagada = await gravarEm('')
      expect(apagada.status).toBe(200)
      expect(apagada.corpo['texto']).toBeNull()
      expect(await linhasDe(vinculoId)).toEqual([])

      expect((await gravarEm('outro texto')).status).toBe(200)
      expect((await gravarEm('   \n  ')).corpo['texto']).toBeNull()
      expect(await linhasDe(vinculoId)).toEqual([])

      const quinhentos = 'a'.repeat(500)
      expect((await gravarEm(quinhentos)).status).toBe(200)
      expect((await linhasDe(vinculoId))[0]?.conteudo).toBe(quinhentos)

      expect(erroDe(await gravarEm('a'.repeat(501)))).toEqual(ENTRADA_INVALIDA)
      expect((await linhasDe(vinculoId))[0]?.conteudo).toBe(quinhentos)
    })

    it('o texto é aparado antes de medir: "  abc  " grava "abc", e 500 caracteres com espaços nas pontas gravam', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'edu')

      const curta = await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', '  abc  '))
      expect(curta.corpo['texto']).toBe('abc')
      expect((await linhasDe(vinculoId))[0]?.conteudo).toBe('abc')

      const comEspacos = ` \t${'b'.repeat(500)}  `
      const larga = await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', comEspacos))
      expect(larga.status).toBe(200)
      expect((await linhasDe(vinculoId))[0]?.conteudo).toBe('b'.repeat(500))
    })

    it('texto vazio numa aula sem registro: responde `texto: null` e não cria linha (apagar é idempotente)', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'fabi')

      const resposta = await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', ''))

      expect(resposta.status).toBe(200)
      expect(resposta.corpo).toEqual({ vinculoId, data: SEGUNDA_FUTURA, inicio: '07:30', texto: null })
      expect(await linhasDe(vinculoId)).toEqual([])
    })

    it('S16, o PUT: na aula dupla, gravar uma não altera a outra', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'gabi', [[1, '07:30', '08:20'], [1, '08:20', '09:10']])

      expect((await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'primeira aula'))).status).toBe(200)
      expect((await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '08:20', 'segunda aula'))).status).toBe(200)
      expect((await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'primeira aula, revista'))).status).toBe(200)

      expect((await linhasDe(vinculoId)).map((linha) => [linha.inicio, linha.fim, linha.conteudo])).toEqual([
        ['07:30', '08:20', 'primeira aula, revista'],
        ['08:20', '09:10', 'segunda aula'],
      ])
    })

    it('G5: o log do PUT não traz o texto, e nenhuma linha de auditoria nasce dele', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'hana')
      const sentinela = `sentinela da aula ${randomUUID()}`
      const auditorias = async () => (await bancada.pool.query<{ total: number }>('select count(*)::int as total from auditoria where escola_id = $1', [e.escolaId])).rows[0]?.total
      const antes = await auditorias()
      const inicioDoLog = linhasDeLog.length

      expect((await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', sentinela))).status).toBe(200)
      expect(erroDe(await gravar(professora.sessao, texto(vinculoId, TERCA_FUTURA, '07:30', sentinela)))).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', sentinela.padEnd(501, '.'))))).toEqual(ENTRADA_INVALIDA)

      // O que a API registra do PUT são as recusas (`http.erro`, com o código e o tipo); o texto, nem o de 200 nem o das recusas, está em linha nenhuma.
      const doPut = linhasDeLog.slice(inicioDoLog)
      const erros = doPut.map((linha) => JSON.parse(linha) as { evento?: string; codigo?: string }).filter((linha) => linha.evento === 'http.erro')
      expect(erros.map((linha) => linha.codigo)).toEqual([ErrorCode.NAO_ENCONTRADO, ErrorCode.ENTRADA_INVALIDA])
      expect(doPut.join('\n')).not.toContain(sentinela)
      expect(await auditorias()).toBe(antes)
    })

    it('G6: duas gravações da mesma aula ao mesmo tempo respondem 200 as duas e deixam uma linha só, com o texto de uma delas', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'ines')

      const [a, b] = await Promise.all([
        gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto A')),
        gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto B')),
      ])

      expect([a.status, b.status]).toEqual([200, 200])
      const linhas = await linhasDe(vinculoId)
      expect(linhas).toHaveLength(1)
      expect(['texto A', 'texto B']).toContain(linhas[0]?.conteudo)
    })

    it('o contrato é estrito: campo a mais, data inexistente, `inicio` mal formado e corpo sem campo respondem ENTRADA_INVALIDA, e nada é gravado', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'joana')
      const base = texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto')

      for (const corpo of [
        { ...base, escolaId: e.escolaId },
        { ...base, data: '2026-02-30' },
        { ...base, inicio: '7:30' },
        { ...base, inicio: '25:00' },
        { ...base, vinculoId: 'nao-e-uuid' },
        { vinculoId, data: SEGUNDA_FUTURA, inicio: '07:30' },
      ]) {
        expect(erroDe(await gravar(professora.sessao, corpo))).toEqual(ENTRADA_INVALIDA)
      }
      expect(await linhasDe(vinculoId)).toEqual([])
    })
  })

  describe('G1: cada cláusula dá NAO_ENCONTRADO e não grava', () => {
    /** Cada caso cumpre todas as outras cláusulas: a professora tem aula às segundas e quartas, 7h30, no ano em curso, de 2026-02-01 a 12-15. */
    const casos: Array<[string, (e: Escola, vinculoId: string) => Promise<{ data: string; inicio: string }>]> = [
      ['data em feriado', async (e) => (await eventoNo(e, 'feriado', SEGUNDA_FUTURA, SEGUNDA_FUTURA, 'Feriado'), { data: SEGUNDA_FUTURA, inicio: '07:30' })],
      ['data em recesso', async (e) => (await eventoNo(e, 'recesso', '2026-11-06', '2026-11-12', 'Recesso'), { data: SEGUNDA_FUTURA, inicio: '07:30' })],
      ['data depois do fim do ano', async () => ({ data: '2026-12-21', inicio: '07:30' })],
      ['data no ano planejado, que é de outro ano', async () => ({ data: '2027-03-01', inicio: '07:30' })],
      ['data antes do início do ano', async () => ({ data: '2026-01-26', inicio: '07:30' })],
      ['início que não é de alocação', async () => ({ data: SEGUNDA_FUTURA, inicio: '09:00' })],
      ['dia da semana sem alocação do vínculo', async () => ({ data: TERCA_FUTURA, inicio: '07:30' })],
      ['data futura sem alocação', async () => ({ data: '2026-11-17', inicio: '10:00' })],
      [
        'data futura sem alocação, num dia útil sem evento, com registro gravado direto: o "passado" é a cláusula',
        async (e, vinculoId) => (await registrar(e, vinculoId, TERCA_FUTURA, '10:00', '10:50', 'registro futuro sem alocação'), { data: TERCA_FUTURA, inicio: '10:00' }),
      ],
      [
        'a data de hoje sem alocação, com registro gravado direto: hoje não é passado',
        async (e, vinculoId) => (await registrar(e, vinculoId, HOJE, '10:00', '10:50', 'registro de hoje sem alocação'), { data: HOJE, inicio: '10:00' }),
      ],
      ['o registro passado da colega no mesmo dia e início, sem alocação da professora', async () => ({ data: '2026-10-30', inicio: '10:00' })],
      ['o registro passado dela em outro início da mesma data', async () => ({ data: '2026-10-28', inicio: '10:00' })],
      [
        'o registro passado fora da grade num dia que virou feriado',
        async (e, vinculoId) => (await registrar(e, vinculoId, '2026-10-26', '10:00', '10:50', 'registro passado fora da grade'), await eventoNo(e, 'feriado', '2026-10-26', '2026-10-26', 'Feriado novo'), { data: '2026-10-26', inicio: '10:00' }),
      ],
    ]

    /**
     * O segundo dado de cada cláusula: a colega tem alocação em todo dia da semana, às 7h30, 9h e 10h, e registro passado no mesmo dia e início do que a
     * professora tenta gravar; a professora tem dois registros passados fora da grade, um em outra data e outro em outro início. Tirada qualquer
     * cláusula da busca da alocação ou do registro, algum caso acha o que não é dele.
     */
    async function apoios(e: Escola, vinculoId: string): Promise<void> {
      const colega = await professoraNa(e, 'colega')
      const vinculoDaColega = await vinculoDireto(e, colega.sessao.usuarioId, await turmaNa(e, '7º B'), await disciplinaNa(e, 'História'), 'confirmado')
      for (const dia of [1, 2, 3, 4, 5, 6, 7]) for (const [inicio, fim] of [['07:30', '08:20'], ['09:00', '09:50'], ['10:00', '10:50']] as const) await alocar(e, vinculoDaColega, dia, inicio, fim)
      await registrar(e, vinculoDaColega, '2026-10-30', '10:00', '10:50', 'registro passado da colega')
      await registrar(e, vinculoId, '2026-10-27', '10:00', '10:50', 'registro passado dela, em outra data')
      await registrar(e, vinculoId, '2026-10-28', '11:00', '11:50', 'registro passado dela, em outro início')
    }

    for (const [nome, preparar] of casos) {
      it(`${nome}`, async () => {
        const e = await escolaComAnos()
        const { professora, vinculoId } = await professoraComAulas(e, 'kelly')
        await apoios(e, vinculoId)
        const alvo = await preparar(e, vinculoId)
        const antes = await linhasDe(vinculoId)

        const resposta = await gravar(professora.sessao, texto(vinculoId, alvo.data, alvo.inicio, 'texto que não pode ser gravado'))

        expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
        expect(await linhasDe(vinculoId)).toEqual(antes)
        expect(JSON.stringify(await linhasDe(vinculoId))).not.toContain('texto que não pode ser gravado')
      })
    }

    it('data futura com registro já gravado e feriado novo sobre ele: o texto e o `atualizadoEm` ficam intactos', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'lia')
      expect((await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto antes do feriado'))).status).toBe(200)
      const antes = await linhasDe(vinculoId)
      await eventoNo(e, 'feriado', SEGUNDA_FUTURA, SEGUNDA_FUTURA, 'Feriado novo')

      const resposta = await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto depois do feriado'))

      expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
      expect(await linhasDe(vinculoId)).toEqual(antes)
    })

    it('o que não tira a aula: o evento comum, o feriado da escola B, o do ano planejado e o do dia anterior e do seguinte; só o que cai no dia tira', async () => {
      const e = await escolaComAnos()
      const b = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'mia')
      await eventoNo(e, 'evento', SEGUNDA_FUTURA, SEGUNDA_FUTURA, 'Conselho de classe')
      await eventoNo(b, 'feriado', SEGUNDA_FUTURA, SEGUNDA_FUTURA, 'Feriado da escola B')
      await eventoNo(e, 'feriado', SEGUNDA_FUTURA, SEGUNDA_FUTURA, 'Feriado do ano planejado', e.planejado)
      await eventoNo(e, 'feriado', '2026-11-08', '2026-11-08', 'Feriado do domingo')
      await eventoNo(e, 'recesso', TERCA_FUTURA, '2026-11-14', 'Recesso da terça em diante')

      const resposta = await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'a aula continua de pé'))

      expect(resposta.status).toBe(200)
      expect((await linhasDe(vinculoId)).map((linha) => linha.conteudo)).toEqual(['a aula continua de pé'])
    })

    it('G4: o vínculo confirmado da mesma professora no ano anterior, com alocação naquele dia e início, responde a mesma coisa e nada é gravado', async () => {
      const e = await escolaComAnos()
      const { professora, disciplinaId } = await professoraComAulas(e, 'mara')
      const { rows } = await bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id", [e.escolaId])
      const anoAnterior = rows[0]?.id ?? ''
      const turmaAnterior = await turmaNa(e, '6º A', anoAnterior)
      const vinculoAnterior = await vinculoDireto(e, professora.sessao.usuarioId, turmaAnterior, disciplinaId, 'confirmado', anoAnterior)
      await alocar(e, vinculoAnterior, 1, '07:30', '08:20', anoAnterior)

      const resposta = await gravar(professora.sessao, texto(vinculoAnterior, '2025-03-03', '07:30', 'texto do ano anterior'))

      expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
      expect(await linhasDe(vinculoAnterior)).toEqual([])
    })

    it('S6, o PUT: a escola sem ano em curso responde NAO_ENCONTRADO e não grava', async () => {
      const e = await escolaSemAnoEmCurso()
      const professora = await professoraNa(e, 'nina')
      const turmaId = await turmaNa(e, '7º A', e.planejado)
      const vinculoId = await vinculoDireto(e, professora.sessao.usuarioId, turmaId, await disciplinaNa(e, 'Matemática'), 'confirmado', e.planejado)
      await alocar(e, vinculoId, 1, '07:30', '08:20', e.planejado)

      const resposta = await gravar(professora.sessao, texto(vinculoId, '2027-03-01', '07:30', 'texto sem ano em curso'))

      expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
      expect(await linhasDe(vinculoId)).toEqual([])
    })
  })

  describe('R1, R4 e R7: o que não é dela responde como o inexistente', () => {
    it('R1: vínculo de outra escola, de colega, pendente, contestado, encerrado, de papel aluno e id inexistente respondem a mesma coisa, e nada é gravado', async () => {
      const a = await escolaComAnos()
      const b = await escolaComAnos()
      const dela = await professoraComAulas(a, 'olga')
      const colega = await professoraComAulas(a, 'paula', [[1, '07:30', '08:20']], '7º B', 'História')
      const deB = await professoraComAulas(b, 'rita', [[1, '07:30', '08:20']], '7º C', 'Geografia')
      const outros: string[] = []
      for (const estado of ['pendente', 'contestado', 'encerrado'] as const) {
        const vinculoId = await vinculoDireto(a, dela.professora.sessao.usuarioId, await turmaNa(a, `8º ${estado.charAt(0).toUpperCase()}`), await disciplinaNa(a, `Ciências ${estado}`), estado)
        await alocar(a, vinculoId, 1, '07:30', '08:20')
        outros.push(vinculoId)
      }
      // O vínculo de aluno do mesmo usuário, confirmado, com alocação plantada: o papel do vínculo é o que conta, e não o do usuário.
      const { rows: doAluno } = await bancada.pool.query<{ id: string }>(
        "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'aluno', 'confirmado', $6, now()) returning id",
        [a.escolaId, a.emCurso, dela.professora.sessao.usuarioId, await turmaNa(a, '8º Z'), await disciplinaNa(a, 'Arte'), a.coordenacao.usuarioId],
      )
      outros.push(doAluno[0]?.id ?? '')
      await alocar(a, doAluno[0]?.id ?? '', 1, '07:30', '08:20')
      const alvos = [deB.vinculoId, colega.vinculoId, ...outros, randomUUID()]

      const respostas: Array<{ status: number; codigo: unknown; mensagem: unknown }> = []
      for (const vinculoId of alvos) respostas.push(recusaDe(await gravar(dela.professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto alheio'))))

      expect(respostas[0]).toMatchObject(NAO_ENCONTRADO)
      expect(respostas).toEqual(alvos.map(() => respostas[0]))
      for (const vinculoId of alvos) expect(await linhasDe(vinculoId)).toEqual([])
      expect(await linhasDe(dela.vinculoId)).toEqual([])
    })

    it('o vínculo da própria professora na escola B, com o token de A: NAO_ENCONTRADO, e nada é gravado em B', async () => {
      const a = await escolaComAnos()
      const b = await escolaComAnos()
      const naA = await professoraComAulas(a, 'sara')
      const naB = await professoraComAulas(b, 'sara-b', [[1, '07:30', '08:20']], '9º B', 'Geografia')
      // A mesma pessoa nas duas escolas: a conta é uma só.
      const { rows } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [naA.professora.sessao.usuarioId])
      await bancada.pool.query('update usuario set conta_id = $2 where id = $1', [naB.professora.sessao.usuarioId, rows[0]?.conta_id])

      const resposta = await gravar(naA.professora.sessao, texto(naB.vinculoId, SEGUNDA_FUTURA, '07:30', 'texto na escola errada'))

      expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
      expect(await linhasDe(naB.vinculoId)).toEqual([])
      // E a gravação dela na B, com o token da B, funciona: a recusa era da escola, e não da pessoa.
      expect((await gravar(naB.professora.sessao, texto(naB.vinculoId, SEGUNDA_FUTURA, '07:30', 'texto na escola certa'))).status).toBe(200)
    })

    it('o `setWhere` da escola no `on conflict` é inalcançável: a FK composta recusa a aula de uma escola sobre o vínculo de outra', async () => {
      const a = await escolaComAnos()
      const b = await escolaComAnos()
      const dela = await professoraComAulas(a, 'ursula')

      await expect(
        bancada.pool.query('insert into aula (escola_id, ano_letivo_id, vinculo_id, data, inicio, fim, conteudo) values ($1, $2, $3, $4, $5, $6, $7)', [b.escolaId, a.emCurso, dela.vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'texto']),
      ).rejects.toMatchObject({ code: '23503', constraint: 'aula_vinculo_do_ano_da_escola_fk' })
    })

    it('R1b (a): a trava do vínculo do colega está presa, e o PUT de outra professora de A com esse `vinculoId` responde NAO_ENCONTRADO na hora, sem esperar a trava', async () => {
      const e = await escolaComAnos()
      const dela = await professoraComAulas(e, 'vera')
      const colega = await professoraComAulas(e, 'wanda', [[1, '07:30', '08:20']], '7º B', 'História')
      const segurador = await segurarTrava(e.escolaId, colega.vinculoId)
      try {
        const resposta = await gravar(dela.professora.sessao, texto(colega.vinculoId, SEGUNDA_FUTURA, '07:30', 'texto no vínculo do colega'))

        // A resposta chegou com o segurador ainda de pé: ela não esperou a trava (o `lock_timeout` de 2 s): quem trocasse a ordem, travando antes de conferir, receberia `INDISPONIVEL_TENTE_DE_NOVO`.
        expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
      } finally {
        await segurador.soltar()
      }
      expect(await linhasDe(colega.vinculoId)).toEqual([])
    })

    it('R1b (b): a chave que o PUT de A calcularia para o vínculo de B está presa, e o mesmo PUT responde NAO_ENCONTRADO na hora; a gravação da própria B não espera pela dela sem a escola nem pela de A', async () => {
      const a = await escolaComAnos()
      const b = await escolaComAnos()
      const deA = await professoraComAulas(a, 'xuxa')
      const deB = await professoraComAulas(b, 'yara', [[1, '07:30', '08:20']], '7º C', 'Geografia')
      const segurador = await segurarTrava(a.escolaId, deB.vinculoId)
      const soDoVinculo = await segurarTrava(null, deB.vinculoId)
      try {
        const alheia = await gravar(deA.professora.sessao, texto(deB.vinculoId, SEGUNDA_FUTURA, '07:30', 'texto de A no vínculo de B'))
        expect(erroDe(alheia)).toEqual(NAO_ENCONTRADO)

        // A chave de B é `(escolaB ‖ vinculoB)`: as presas são `(escolaA ‖ vinculoB)` e `vinculoB` sozinha, outras. Com a escola fora da chave, esta gravação
        // ficaria na fila da segunda.
        const propria = await gravar(deB.professora.sessao, texto(deB.vinculoId, SEGUNDA_FUTURA, '07:30', 'texto de B'))
        expect(propria.status).toBe(200)
      } finally {
        await soDoVinculo.soltar()
        await segurador.soltar()
      }
      expect((await linhasDe(deB.vinculoId)).map((linha) => linha.conteudo)).toEqual(['texto de B'])
    })

    it('R4, o PUT: o antecessor, com o vínculo encerrado pela reimportação real da grade, recebe NAO_ENCONTRADO e o texto dele fica; o substituto grava a aula no mesmo dia e horário', async () => {
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
      expect((await gravar(antecessor.sessao, texto(vinculoAntigo, SEGUNDA_PASSADA, '08:00', 'texto do antecessor'))).status).toBe(200)

      await importarGrade(e, [linha(substituto)], [vinculoAntigo])
      const { rows: doSubstituto } = await bancada.pool.query<{ id: string }>('select id from vinculo where escola_id = $1 and usuario_id = $2', [e.escolaId, substituto.sessao.usuarioId])
      const vinculoNovo = doSubstituto[0]?.id ?? ''
      await bancada.pool.query("update vinculo set estado = 'confirmado', decidido_em = now() where id = $1", [vinculoNovo])
      const { rows: estado } = await bancada.pool.query<{ estado: string }>('select estado from vinculo where id = $1', [vinculoAntigo])
      expect(estado[0]?.estado).toBe('encerrado')

      expect(erroDe(await gravar(antecessor.sessao, texto(vinculoAntigo, SEGUNDA_PASSADA, '08:00', 'o antecessor tenta de novo')))).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await gravar(antecessor.sessao, texto(vinculoNovo, SEGUNDA_PASSADA, '08:00', 'o antecessor no vínculo do substituto')))).toEqual(NAO_ENCONTRADO)
      expect((await gravar(substituto.sessao, texto(vinculoNovo, SEGUNDA_PASSADA, '08:00', 'texto do substituto'))).status).toBe(200)
      expect(erroDe(await gravar(substituto.sessao, texto(vinculoAntigo, SEGUNDA_PASSADA, '08:00', 'o substituto no vínculo do antecessor')))).toEqual(NAO_ENCONTRADO)

      expect((await linhasDe(vinculoAntigo)).map((registro) => registro.conteudo)).toEqual(['texto do antecessor'])
      expect((await linhasDe(vinculoNovo)).map((registro) => registro.conteudo)).toEqual(['texto do substituto'])
    })

    it('R7, o PUT: a coordenação e o aluno, com o token direto, recebem a recusa da matriz e nada é gravado', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'zeca')
      await registrar(e, vinculoId, SEGUNDA_FUTURA, '07:30', '08:20', 'texto que só a professora grava')
      const antes = await linhasDe(vinculoId)
      const aluno = await bancada.sessao(e.escolaId, 'aluno')

      for (const sessao of [e.coordenacao, aluno]) {
        const resposta = await gravar(sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto de quem não é professor'))
        expect(erroDe(resposta)).toEqual(NAO_ENCONTRADO)
        expect(erroDe(await gravar(sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', '')))).toEqual(NAO_ENCONTRADO)
      }
      expect(await linhasDe(vinculoId)).toEqual(antes)
      expect((await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto da professora'))).status).toBe(200)
    })
  })

  describe('o escopo de cada consulta, com a linha que as FKs compostas não deixam existir', () => {
    /**
     * Linhas de outra escola e de outro ano sobre o vínculo da professora, que só existem com `session_replication_role = replica`: as FKs compostas
     * `(escola_id, ano_letivo_id, vinculo_id)` as recusam, e é por isso que a cláusula de escola e de ano de cada consulta nunca fica vermelha com dado
     * consistente. Plantadas, cada uma é o segundo dado que torna a cláusula observável.
     */
    async function plantar(comandos: ReadonlyArray<{ sql: string; valores: unknown[] }>): Promise<void> {
      const cliente = await apoio.connect()
      try {
        await cliente.query('begin')
        await cliente.query('set local session_replication_role = replica')
        for (const comando of comandos) await cliente.query(comando.sql, comando.valores)
        await cliente.query('commit')
      } finally {
        await cliente.query('rollback').catch(() => undefined)
        cliente.release()
      }
    }

    const alocacaoPlantada = (escolaId: string, anoId: string, vinculoId: string, dia: number) => ({
      sql: "insert into alocacao (escola_id, ano_letivo_id, vinculo_id, dia_semana, inicio, fim) values ($1, $2, $3, $4, '07:30', '08:20')",
      valores: [escolaId, anoId, vinculoId, dia],
    })
    const aulaPlantada = (escolaId: string, anoId: string, vinculoId: string, data: string, inicio = '07:30') => ({
      sql: "insert into aula (escola_id, ano_letivo_id, vinculo_id, data, inicio, fim, conteudo) values ($1, $2, $3, $4, $5, '23:00', 'plantada')",
      valores: [escolaId, anoId, vinculoId, data, inicio],
    })

    it('a cláusula de escola e de ano do vínculo, da alocação e do registro: a linha de outra escola ou de outro ano, sobre o vínculo dela, não conta', async () => {
      const a = await escolaComAnos()
      const b = await escolaComAnos()
      const dela = await professoraComAulas(a, 'tania')
      const turmaId = await turmaNa(a, '8º A')
      const disciplinaId = await disciplinaNa(a, 'Física')
      const deOutraEscola = await vinculoDireto(a, dela.professora.sessao.usuarioId, turmaId, disciplinaId, 'confirmado')
      const doOutroAno = await vinculoDireto(a, dela.professora.sessao.usuarioId, await turmaNa(a, '8º B'), disciplinaId, 'confirmado')
      // O vínculo da escola B com o usuário e o ano da escola A, e o da escola A com o ano planejado: a conferência do vínculo não os acha.
      await plantar([
        { sql: 'update vinculo set escola_id = $2 where id = $1', valores: [deOutraEscola, b.escolaId] },
        { sql: 'update vinculo set ano_letivo_id = $2 where id = $1', valores: [doOutroAno, a.planejado] },
        alocacaoPlantada(a.escolaId, a.emCurso, deOutraEscola, 1),
        alocacaoPlantada(a.escolaId, a.emCurso, doOutroAno, 1),
        // Sobre o vínculo real dela: a alocação de B, a do ano planejado, e os registros de B e do ano planejado (a gravar, a corrigir e a apagar).
        alocacaoPlantada(b.escolaId, a.emCurso, dela.vinculoId, 2),
        alocacaoPlantada(a.escolaId, a.planejado, dela.vinculoId, 4),
        aulaPlantada(b.escolaId, a.emCurso, dela.vinculoId, '2026-10-28', '10:00'),
        aulaPlantada(a.escolaId, a.planejado, dela.vinculoId, '2026-10-29', '10:00'),
        aulaPlantada(b.escolaId, a.emCurso, dela.vinculoId, SEGUNDA_FUTURA),
        aulaPlantada(a.escolaId, a.planejado, dela.vinculoId, '2026-11-11'),
        aulaPlantada(b.escolaId, a.emCurso, dela.vinculoId, '2026-11-16'),
        // O feriado da escola B sobre o ano da A, no dia da alocação de quarta dela: só a escola do `where` do evento o deixa de fora.
        {
          sql: "insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, 'feriado', $3, $3, $4)",
          valores: [b.escolaId, a.emCurso, QUARTA_DO_FERIADO_DE_B, `${PREFIXO} feriado plantado da escola B`],
        },
      ])

      // O vínculo achado só se for da escola e do ano do token.
      expect(erroDe(await gravar(dela.professora.sessao, texto(deOutraEscola, SEGUNDA_FUTURA, '07:30', 'no vínculo da escola B')))).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await gravar(dela.professora.sessao, texto(doOutroAno, SEGUNDA_FUTURA, '07:30', 'no vínculo do ano planejado')))).toEqual(NAO_ENCONTRADO)
      // A alocação e o registro passado, só da escola e do ano do token.
      expect(erroDe(await gravar(dela.professora.sessao, texto(dela.vinculoId, TERCA_FUTURA, '07:30', 'na alocação da escola B')))).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await gravar(dela.professora.sessao, texto(dela.vinculoId, '2026-11-12', '07:30', 'na alocação do ano planejado')))).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await gravar(dela.professora.sessao, texto(dela.vinculoId, '2026-10-28', '10:00', 'no registro da escola B')))).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await gravar(dela.professora.sessao, texto(dela.vinculoId, '2026-10-29', '10:00', 'no registro do ano planejado')))).toEqual(NAO_ENCONTRADO)
      // O upsert não toca a linha da escola B (o `setWhere`), e o apagar não toca a de B nem a do ano planejado (a escola e o ano do `delete`).
      expect((await gravar(dela.professora.sessao, texto(dela.vinculoId, '2026-11-16', '07:30', 'sobre a linha da escola B'))).status).toBe(200)
      expect((await gravar(dela.professora.sessao, texto(dela.vinculoId, SEGUNDA_FUTURA, '07:30', ''))).status).toBe(200)
      expect((await gravar(dela.professora.sessao, texto(dela.vinculoId, '2026-11-11', '07:30', ''))).status).toBe(200)
      // O feriado e o recesso, só da escola do token: o feriado de B no mesmo dia não tira a aula dela (texto vazio apaga e responde 200, sem deixar linha).
      expect((await gravar(dela.professora.sessao, texto(dela.vinculoId, QUARTA_DO_FERIADO_DE_B, '07:30', ''))).status).toBe(200)

      const { rows } = await bancada.pool.query<{ escola_id: string; data: string; conteudo: string }>(
        "select escola_id, to_char(data, 'YYYY-MM-DD') as data, conteudo from aula where vinculo_id = $1 and conteudo = 'plantada' order by data",
        [dela.vinculoId],
      )
      expect(rows.map((linha) => [linha.data, linha.escola_id === b.escolaId])).toEqual([
        ['2026-10-28', true],
        ['2026-10-29', false],
        [SEGUNDA_FUTURA, true],
        ['2026-11-11', false],
        ['2026-11-16', true],
      ])
      expect(await bancada.pool.query('select 1 from aula where vinculo_id = $1 and conteudo <> $2', [dela.vinculoId, 'plantada']).then((resultado) => resultado.rowCount)).toBe(0)
    })

    it('apagar uma aula não apaga outra: nem a de outro horário, nem a de outra data, nem a mesma data e horário do vínculo da colega', async () => {
      const e = await escolaComAnos()
      const dela = await professoraComAulas(e, 'vera', [[1, '07:30', '08:20'], [1, '08:20', '09:10']])
      const colega = await professoraComAulas(e, 'wanda', [[1, '07:30', '08:20']], '7º B', 'História')
      for (const [vinculoId, data, inicio, fim] of [
        [dela.vinculoId, SEGUNDA_FUTURA, '07:30', '08:20'],
        [dela.vinculoId, SEGUNDA_FUTURA, '08:20', '09:10'],
        [dela.vinculoId, '2026-11-16', '07:30', '08:20'],
        [colega.vinculoId, SEGUNDA_FUTURA, '07:30', '08:20'],
      ] as const)
        await registrar(e, vinculoId, data, inicio, fim, `texto ${vinculoId.slice(0, 4)} ${data} ${inicio}`)

      const apagada = await gravar(dela.professora.sessao, texto(dela.vinculoId, SEGUNDA_FUTURA, '07:30', ''))

      expect(apagada.status).toBe(200)
      expect((await linhasDe(dela.vinculoId)).map((linha) => [linha.data, linha.inicio])).toEqual([
        [SEGUNDA_FUTURA, '08:20'],
        ['2026-11-16', '07:30'],
      ])
      expect(await linhasDe(colega.vinculoId)).toHaveLength(1)
    })
  })

  describe('as travas: a ordem e o tempo', () => {
    it('J13: com a trava do vínculo presa por outra transação, o PUT fica na fila da trava e devolve INDISPONIVEL_TENTE_DE_NOVO, sem gravar', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'abel')
      const segurador = await segurarTrava(e.escolaId, vinculoId)
      try {
        const gravando = gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto que espera a trava'))
        await aguardar(async () => (await esperandoNaTravaDoVinculo()) >= 1, 'o PUT esperando na trava do vínculo')

        expect(erroDe(await gravando)).toEqual(INDISPONIVEL)
      } finally {
        await segurador.soltar()
      }
      expect(await linhasDe(vinculoId)).toEqual([])
      expect(await esperandoNaTravaDoVinculo()).toBe(0)
      // Solta a trava, a mesma gravação passa: a recusa era a fila, e não o pedido.
      expect((await gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto que passa'))).status).toBe(200)
    })

    it('J14: a virada pausada depois de apagar a `aula`, o PUT espera no `for share` do ano; o ano encerra, o PUT responde NAO_ENCONTRADO e nenhuma linha fica no ano encerrado', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'bia')
      // Uma linha para o `delete` da virada disparar o gatilho de parada.
      await registrar(e, vinculoId, SEGUNDA_PASSADA, '07:30', '08:20', 'texto que a virada apaga')
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'aula', evento: 'delete', quando: `old.vinculo_id = '${vinculoId}'::uuid` })
      await gatilho.armar()
      try {
        const encerrando = pedir(e.coordenacao, 'POST', `/v1/anos-letivos/${e.emCurso}/encerrar`)
        await gatilho.esperarParadas()
        const gravando = gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto na virada'))
        // O lado esperado: o `for share` do ano, preso na linha que o encerramento atualizou.
        await esperarNaTrava(bancada.pool, '%"ano_letivo"%for share%')
        await gatilho.soltar()

        expect((await encerrando).status).toBe(200)
        expect(erroDe(await gravando)).toEqual(NAO_ENCONTRADO)
      } finally {
        await gatilho.desarmar()
      }
      expect(await linhasDe(vinculoId)).toEqual([])
      const { rows } = await bancada.pool.query<{ situacao: string }>('select situacao from ano_letivo where id = $1', [e.emCurso])
      expect(rows[0]?.situacao).toBe('encerrado')
    })

    it('o ano que deixa de estar em curso enquanto o PUT espera o `for share`: NAO_ENCONTRADO, mesmo com o vínculo ainda confirmado e a alocação de pé', async () => {
      const e = await escolaComAnos()
      const { professora, vinculoId } = await professoraComAulas(e, 'caio')
      const segurador = await apoio.connect()
      try {
        // Só o ano muda de situação, sem a virada: o vínculo e a alocação continuam como estavam, e só o `for share` do ano pode recusar o PUT.
        await segurador.query('begin')
        await segurador.query("update ano_letivo set situacao = 'encerrado' where id = $1", [e.emCurso])
        const gravando = gravar(professora.sessao, texto(vinculoId, SEGUNDA_FUTURA, '07:30', 'texto no ano que fechou'))
        await esperarNaTrava(bancada.pool, '%"ano_letivo"%for share%')
        await segurador.query('commit')

        expect(erroDe(await gravando)).toEqual(NAO_ENCONTRADO)
      } finally {
        await segurador.query('rollback').catch(() => undefined)
        segurador.release()
      }
      expect(await linhasDe(vinculoId)).toEqual([])
    })
  })
})
