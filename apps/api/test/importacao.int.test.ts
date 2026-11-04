import { createDatabase, createPool, executarPlanilha, PREFIXO_VAGAS_DA_IMPORTACAO, runInContext, SchoolSemaphore, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, importacaoSchema, LIMITE_DA_PLANILHA_POR_MINUTO, MAXIMO_DE_LINHAS_DA_PLANILHA, previaDaPlanilhaResponseSchema, VAGAS_DA_PLANILHA_POR_ESCOLA } from '@educa/shared'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { REDIS_CACHE_CLIENT, VAGAS_DA_PLANILHA } from '../src/rate-limit.module.js'
import { auditoriaDa } from './material.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * As planilhas da escola, pelo calendário (F2, tarefa 4.0; `tasks/prd-onboarding-por-convite/cenarios.md`, RF2, RF10, RF16, RF17
 * e "Job e estados"): a prévia que classifica, o gravar que responde 202 e enfileira, o job de três passos (chamado direto, uma
 * tentativa) e o que ele deixa no banco. O job pelo processador do worker, com métrica, log e tentativas, está em
 * `apps/worker/test/gravar-planilha.int.test.ts`. Postgres real do compose de teste; escolas, anos e descrições gerados.
 */

const CABECALHO = 'inicio;fim;tipo;descricao'
const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }
const CONFLITO = { status: 409, codigo: ErrorCode.CONFLITO }
const ENTRADA_INVALIDA = { status: 400, codigo: ErrorCode.ENTRADA_INVALIDA }
const LIMITE_EXCEDIDO = { status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO }

/** Uma escola com o ano de 2026 em curso (de 01/02 a 15/12) e o de 2027 planejado, montados pela API como a coordenação faria. */
interface Escola {
  readonly escolaId: string
  readonly coordenacao: TestSessao
  readonly emCurso: string
  readonly planejado: string
}

const PREFIXO = `cal${randomUUID().slice(0, 6)}`
const texto = (...linhas: string[]): string => [CABECALHO, ...linhas].join('\n')
/** Uma linha do calendário com a descrição própria desta execução. */
const evento = (inicio: string, fim: string, tipo: string, descricao: string): string => `${inicio};${fim};${tipo};${PREFIXO} ${descricao}`

function erroDe(resposta: RespostaHttp): { status: number; codigo: unknown } {
  return { status: resposta.status, codigo: (resposta.corpo.erro as { codigo?: unknown } | undefined)?.codigo }
}

describe('planilha de calendário (F2, tarefa 4.0): prévia, gravar e job', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  /** O pool dos jobs e das paradas: o da bancada tem 2 conexões, e a parada segura uma e o job outra. */
  let apoio: DatabasePool
  let bancoDoJob: Database

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {})
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 8, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    bancoDoJob = createDatabase(apoio)
  })

  afterAll(async () => {
    await api.app.close()
    await apoio.end()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const pedir = (sessao: TestSessao, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)
  const previa = (e: Escola, planilha: string, extra: Record<string, unknown> = {}) => pedir(e.coordenacao, 'POST', '/v1/importacoes/calendario/previa', { texto: planilha, ...extra })
  const gravar = (e: Escola, planilha: string, extra: Record<string, unknown> = {}) => pedir(e.coordenacao, 'POST', '/v1/importacoes/calendario', { texto: planilha, ...extra })

  async function criado(resposta: Promise<RespostaHttp>, status = 201): Promise<string> {
    const lida = await resposta
    expect(lida.status).toBe(status)
    return lida.corpo['id'] as string
  }

  /** O ano `ano` (de 01/02 a 15/12), criado e, se pedido, aberto. */
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

  /** Roda o job uma vez (tentativa 1), no contexto da escola do job, como o executor o abre. */
  const rodar = (escolaId: string, importacaoId: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => executarPlanilha(bancoDoJob, importacaoId))

  interface LinhaDoEvento {
    readonly tipo: string
    readonly inicio: string
    readonly fim: string
    readonly descricao: string
  }

  /** Os eventos do ano, em ordem de data, com a descrição sem o prefixo desta execução. */
  async function eventosDe(anoId: string): Promise<LinhaDoEvento[]> {
    const { rows } = await bancada.pool.query<LinhaDoEvento>(
      "select tipo, to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fim, 'YYYY-MM-DD') as fim, replace(descricao, $2, '') as descricao from evento_calendario where ano_letivo_id = $1 order by inicio, descricao",
      [anoId, `${PREFIXO} `],
    )
    return rows
  }

  interface ImportacaoNoBanco {
    readonly id: string
    readonly estado: string
    readonly erro: string | null
    readonly linhas: unknown
    readonly marcas: unknown
    readonly resumo: Record<string, number> | null
    readonly criado_por: string | null
    readonly ano_letivo_id: string
    readonly concluida_em: Date | null
  }

  async function importacoesDe(escolaId: string): Promise<ImportacaoNoBanco[]> {
    const { rows } = await bancada.pool.query<ImportacaoNoBanco>('select id, estado, erro, linhas, marcas, resumo, criado_por, ano_letivo_id, concluida_em from importacao_planilha where escola_id = $1 order by id', [escolaId])
    return rows
  }

  /** Grava a planilha e confere o 202. */
  async function gravada(e: Escola, planilha: string, extra: Record<string, unknown> = {}): Promise<string> {
    return criado(gravar(e, planilha, extra), 202)
  }

  it('caminho feliz: a prévia classifica, gravar responde 202 e guarda as linhas, o job conclui e apaga as linhas e as marcas', async () => {
    const e = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'), evento('2026-07-13', '2026-07-24', 'recesso', 'Recesso de julho'))

    const lida = await previa(e, planilha)
    expect(lida.status).toBe(200)
    expect(previaDaPlanilhaResponseSchema.parse(lida.corpo)).toEqual({
      linhas: [
        { linha: 2, resultado: 'entra' },
        { linha: 3, resultado: 'entra' },
      ],
      contagens: { entram: 2, ja_existem: 0, eventos_removidos: 0 },
      candidatos: [],
    })
    expect(await importacoesDe(e.escolaId)).toEqual([])

    const id = await gravada(e, planilha)
    const [fila] = await importacoesDe(e.escolaId)
    expect(fila).toMatchObject({ id, estado: 'na_fila', ano_letivo_id: e.emCurso, criado_por: e.coordenacao.usuarioId })
    expect(fila?.linhas).toHaveLength(2)
    const { rows: jobs } = await bancada.pool.query<{ tipo: string; fila: string; dados: unknown; nao_urgente: boolean }>('select tipo, fila, dados, nao_urgente from job_registro where escola_id = $1', [e.escolaId])
    expect(jobs).toEqual([{ tipo: 'estrutura.gravar-planilha', fila: 'normal', dados: { importacaoId: id }, nao_urgente: false }])
    expect(await eventosDe(e.emCurso)).toEqual([])

    expect(await rodar(e.escolaId, id)).toBe('concluida')

    expect(await eventosDe(e.emCurso)).toEqual([
      { tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Tiradentes' },
      { tipo: 'recesso', inicio: '2026-07-13', fim: '2026-07-24', descricao: 'Recesso de julho' },
    ])
    const [concluida] = await importacoesDe(e.escolaId)
    expect(concluida).toMatchObject({ estado: 'concluida', erro: null, linhas: null, marcas: null, resumo: { entram: 2, ja_existem: 0, eventos_removidos: 0 } })
    expect(concluida?.concluida_em).not.toBeNull()
  })

  it('gravar sem prévia, com texto errado, responde ENTRADA_INVALIDA e não grava importação nenhuma (a planilha curta passa do limite de tamanho e chega à prévia refeita)', async () => {
    const e = await escolaComAnos()
    const comErro = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'), evento('31/02/2026', '2026-04-22', 'feriado', 'Dia que não existe'))

    expect(erroDe(await gravar(e, comErro))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await gravar(e, 'qualquer coisa que não é planilha'))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await gravar(e, CABECALHO))).toEqual(ENTRADA_INVALIDA)
    expect(await importacoesDe(e.escolaId)).toEqual([])
    const { rows } = await bancada.pool.query('select 1 from job_registro where escola_id = $1', [e.escolaId])
    expect(rows).toHaveLength(0)
  })

  it('marca fora dos candidatos: ENTRADA_INVALIDA, também o id de uma pessoa de outra escola, e nenhuma importação', async () => {
    const e = await escolaComAnos()
    const outra = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))
    const deOutraEscola = (await bancada.sessao(outra.escolaId, 'professor')).usuarioId

    for (const id of [randomUUID(), deOutraEscola]) {
      for (const acao of ['transferir', 'desligar', 'encerrar']) {
        expect(erroDe(await gravar(e, planilha, { marcas: { [acao]: [id] } })), `${acao} ${id}`).toEqual(ENTRADA_INVALIDA)
      }
    }
    expect(await importacoesDe(e.escolaId)).toEqual([])
  })

  it('a prévia aponta o erro de cada linha, entre as boas: data fora do ano letivo, fim antes do início, tipo, descrição, repetida e linha incompleta', async () => {
    const e = await escolaComAnos()
    const lida = await previa(
      e,
      texto(
        evento('2026-04-21', '2026-04-21', 'feriado', 'Boa'),
        evento('2027-04-21', '2027-04-21', 'feriado', 'Feriado de 2027 no ano de 2026'),
        evento('2026-01-31', '2026-02-02', 'evento', 'Começa antes do ano'),
        evento('2026-12-14', '2026-12-16', 'evento', 'Termina depois do ano'),
        evento('2026-05-10', '2026-05-09', 'evento', 'Fim antes do início'),
        evento('2026-05-10', '2026-05-10', 'ferias', 'Tipo que não existe'),
        `2026-05-11;2026-05-11;evento;   `,
        `2026-05-12;2026-05-12;evento;${'x'.repeat(121)}`,
        evento('2026-04-21', '2026-04-21', 'feriado', 'Boa'),
        '2026-05-13;2026-05-13;evento',
        evento('2026-05-14', '2026-05-14', 'evento', 'Outra boa'),
      ),
    )
    expect(lida.status).toBe(200)
    const resumo = (lida.corpo['linhas'] as Array<{ linha: number; resultado: string; erro?: string }>).map(({ linha, resultado, erro }) => [linha, resultado, erro])
    expect(resumo).toEqual([
      [2, 'entra', undefined],
      [3, 'erro', 'fora_do_ano'],
      [4, 'erro', 'fora_do_ano'],
      [5, 'erro', 'fora_do_ano'],
      [6, 'erro', 'fim_antes_do_inicio'],
      [7, 'erro', 'tipo_invalido'],
      [8, 'erro', 'descricao_vazia'],
      [9, 'erro', 'descricao_longa'],
      [10, 'erro', 'repetida'],
      [11, 'erro', 'linha_incompleta'],
      [12, 'entra', undefined],
    ])
    expect(await importacoesDe(e.escolaId)).toEqual([])
  })

  it('borda: o evento de um dia entra (início igual ao fim, as duas datas em `DD/MM/AAAA` também), e o fim antes do início é erro', async () => {
    const e = await escolaComAnos()
    const id = await gravada(e, texto(evento('2026-09-07', '2026-09-07', 'feriado', 'Independência'), evento('12/10/2026', '12/10/2026', 'Feriado', 'Padroeira')))
    expect(await rodar(e.escolaId, id)).toBe('concluida')
    expect(await eventosDe(e.emCurso)).toEqual([
      { tipo: 'feriado', inicio: '2026-09-07', fim: '2026-09-07', descricao: 'Independência' },
      { tipo: 'feriado', inicio: '2026-10-12', fim: '2026-10-12', descricao: 'Padroeira' },
    ])
    const invertido = await previa(e, texto(evento('2026-09-08', '2026-09-07', 'feriado', 'Invertido')))
    expect((invertido.corpo['linhas'] as Array<{ erro?: string }>)[0]?.erro).toBe('fim_antes_do_inicio')
  })

  it('reimportar substitui só no ano de destino: o planejado não toca o em curso, e o em curso não toca o planejado', async () => {
    const e = await escolaComAnos()
    expect(await rodar(e.escolaId, await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes de 2026'))))).toBe('concluida')

    const noPlanejado = await gravada(e, texto(evento('2027-04-21', '2027-04-21', 'feriado', 'Tiradentes de 2027')), { anoLetivoId: e.planejado })
    expect((await importacoesDe(e.escolaId)).find((importacao) => importacao.id === noPlanejado)?.ano_letivo_id).toBe(e.planejado)
    expect(await rodar(e.escolaId, noPlanejado)).toBe('concluida')
    expect(await eventosDe(e.emCurso)).toEqual([{ tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Tiradentes de 2026' }])
    expect(await eventosDe(e.planejado)).toEqual([{ tipo: 'feriado', inicio: '2027-04-21', fim: '2027-04-21', descricao: 'Tiradentes de 2027' }])

    // O em curso, reimportado com outro evento, perde o antigo e não mexe no planejado.
    expect(await rodar(e.escolaId, await gravada(e, texto(evento('2026-05-01', '2026-05-01', 'feriado', 'Dia do Trabalho'))))).toBe('concluida')
    expect(await eventosDe(e.emCurso)).toEqual([{ tipo: 'feriado', inicio: '2026-05-01', fim: '2026-05-01', descricao: 'Dia do Trabalho' }])
    expect(await eventosDe(e.planejado)).toHaveLength(1)
  })

  it('a prévia mostra o que entra, o que já existe e o que sai; o que já existe fica com o mesmo id', async () => {
    const e = await escolaComAnos()
    const primeira = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'), evento('2026-05-01', '2026-05-01', 'feriado', 'Trabalho'), evento('2026-09-07', '2026-09-07', 'feriado', 'Independência'))
    expect(await rodar(e.escolaId, await gravada(e, primeira))).toBe('concluida')
    const { rows: antes } = await bancada.pool.query<{ id: string; descricao: string }>('select id, descricao from evento_calendario where ano_letivo_id = $1', [e.emCurso])

    const segunda = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'), evento('2026-10-12', '2026-10-12', 'feriado', 'Padroeira'))
    const lida = await previa(e, segunda)
    expect((lida.corpo['linhas'] as Array<{ resultado: string }>).map((linha) => linha.resultado)).toEqual(['ja_existe', 'entra'])
    expect(lida.corpo['contagens']).toEqual({ entram: 1, ja_existem: 1, eventos_removidos: 2 })
    expect(await eventosDe(e.emCurso)).toHaveLength(3)

    expect(await rodar(e.escolaId, await gravada(e, segunda))).toBe('concluida')
    expect(await eventosDe(e.emCurso)).toEqual([
      { tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Tiradentes' },
      { tipo: 'feriado', inicio: '2026-10-12', fim: '2026-10-12', descricao: 'Padroeira' },
    ])
    const { rows: depois } = await bancada.pool.query<{ id: string; descricao: string }>('select id, descricao from evento_calendario where ano_letivo_id = $1', [e.emCurso])
    const tiradentes = (linhas: Array<{ id: string; descricao: string }>) => linhas.find((linha) => linha.descricao.endsWith('Tiradentes'))?.id
    expect(tiradentes(depois)).toBe(tiradentes(antes))
    const [, segundaImportacao] = await importacoesDe(e.escolaId)
    expect(segundaImportacao?.resumo).toEqual({ entram: 1, ja_existem: 1, eventos_removidos: 2 })
  })

  it('a mesma planilha duas vezes não muda o banco: a segunda prévia só traz "já existe"', async () => {
    const e = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))
    expect(await rodar(e.escolaId, await gravada(e, planilha))).toBe('concluida')
    const { rows: antes } = await bancada.pool.query<{ id: string }>('select id from evento_calendario where ano_letivo_id = $1', [e.emCurso])
    const lida = await previa(e, planilha)
    expect(lida.corpo['contagens']).toEqual({ entram: 0, ja_existem: 1, eventos_removidos: 0 })
    expect(await rodar(e.escolaId, await gravada(e, planilha))).toBe('concluida')
    const { rows: depois } = await bancada.pool.query<{ id: string }>('select id from evento_calendario where ano_letivo_id = $1', [e.emCurso])
    expect(depois).toEqual(antes)
  })

  it('[P] gravar duas vezes ao mesmo tempo: uma fica `na_fila` e a outra recebe CONFLITO; a de outra escola segue', async () => {
    const e = await escolaComAnos()
    const outra = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))
    const respostas = await Promise.all([gravar(e, planilha), gravar(e, planilha), gravar(outra, planilha)])
    expect(respostas.slice(0, 2).map((resposta) => resposta.status).sort()).toEqual([202, 409])
    expect(respostas.filter((resposta, posicao) => posicao < 2 && resposta.status === 409).map(erroDe)).toEqual([CONFLITO])
    expect(respostas[2]?.status).toBe(202)
    expect((await importacoesDe(e.escolaId)).map((importacao) => importacao.estado)).toEqual(['na_fila'])
    const { rows: jobs } = await bancada.pool.query('select 1 from job_registro where escola_id = $1', [e.escolaId])
    expect(jobs).toHaveLength(1)
  })

  it('`na_fila` há mais de 1 h: o gravar seguinte a fecha `falhou` (`expirou`) e entra; com 59 min, CONFLITO e a fila não muda; a de outra escola e a já concluída não são tocadas', async () => {
    const e = await escolaComAnos()
    const outra = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))
    // Uma já concluída, velha, e a `na_fila` velha de outra escola: o fechamento da expirada não as alcança.
    const concluida = await gravada(e, planilha)
    expect(await rodar(e.escolaId, concluida)).toBe('concluida')
    await bancada.pool.query("update importacao_planilha set criado_em = now() - interval '3 hours' where id = $1", [concluida])
    const daOutra = await gravada(outra, planilha)
    await bancada.pool.query("update importacao_planilha set criado_em = now() - interval '3 hours' where id = $1", [daOutra])
    const velha = await gravada(e, texto(evento('2026-05-01', '2026-05-01', 'feriado', 'Trabalho')))

    await bancada.pool.query("update importacao_planilha set criado_em = now() - interval '59 minutes' where id = $1", [velha])
    expect(erroDe(await gravar(e, planilha))).toEqual(CONFLITO)
    expect((await importacoesDe(e.escolaId)).map((importacao) => importacao.estado).sort()).toEqual(['concluida', 'na_fila'])

    await bancada.pool.query("update importacao_planilha set criado_em = now() - interval '61 minutes' where id = $1", [velha])
    const nova = await gravada(e, planilha)
    const lidas = await importacoesDe(e.escolaId)
    expect(lidas.find((importacao) => importacao.id === velha)).toMatchObject({ estado: 'falhou', erro: 'expirou', linhas: null, marcas: null })
    expect(lidas.find((importacao) => importacao.id === nova)?.estado).toBe('na_fila')
    expect(lidas.find((importacao) => importacao.id === concluida)?.estado).toBe('concluida')
    expect((await importacoesDe(outra.escolaId))[0]?.estado).toBe('na_fila')
    // O job da fechada, se chegar, não encontra o que gravar.
    expect(await rodar(e.escolaId, velha)).toBe('ignorada')
    expect(await eventosDe(e.emCurso)).toEqual([{ tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Tiradentes' }])
  })

  it('`na_fila` velha travada por um job que roda: o gravar responde CONFLITO sem esperar a trava, e nada é fechado', async () => {
    const e = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))
    const velha = await gravada(e, planilha)
    await bancada.pool.query("update importacao_planilha set criado_em = now() - interval '61 minutes' where id = $1", [velha])

    const segurador = await bancada.pool.connect()
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [velha])
      // `nowait`: sem ele o gravar esperaria a trava até o `statement_timeout` e não sairia `CONFLITO`.
      expect(erroDe(await gravar(e, planilha))).toEqual(CONFLITO)
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }
    expect((await importacoesDe(e.escolaId)).map((importacao) => importacao.estado)).toEqual(['na_fila'])
  })

  it('o fechamento da expirada só trava a `na_fila` velha desta escola: a de outra escola e a já concluída, travadas por outra transação, não atrapalham', async () => {
    const e = await escolaComAnos()
    const outra = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))
    const concluida = await gravada(e, planilha)
    expect(await rodar(e.escolaId, concluida)).toBe('concluida')
    const daOutra = await gravada(outra, planilha)
    await bancada.pool.query("update importacao_planilha set criado_em = now() - interval '3 hours' where id = any($1::uuid[])", [[concluida, daOutra]])

    const seguradores = [await bancada.pool.connect(), await bancada.pool.connect()]
    try {
      for (const [posicao, id] of [concluida, daOutra].entries()) {
        await seguradores[posicao]?.query('begin')
        await seguradores[posicao]?.query('select id from importacao_planilha where id = $1 for update', [id])
      }
      await gravada(e, texto(evento('2026-05-01', '2026-05-01', 'feriado', 'Trabalho')))
    } finally {
      for (const segurador of seguradores) {
        await segurador.query('rollback')
        segurador.release()
      }
    }
    expect((await importacoesDe(outra.escolaId))[0]?.estado).toBe('na_fila')
  })

  it('assinatura diferente: o evento que a mão pôs entre o gravar e o job faz o job sair `desatualizada`, sem gravar e com as linhas apagadas', async () => {
    const e = await escolaComAnos()
    const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes')))
    await bancada.pool.query("insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, 'evento', '2026-06-01', '2026-06-01', $3)", [e.escolaId, e.emCurso, `${PREFIXO} Feito à mão`])

    expect(await rodar(e.escolaId, id)).toBe('desatualizada')

    expect(await eventosDe(e.emCurso)).toEqual([{ tipo: 'evento', inicio: '2026-06-01', fim: '2026-06-01', descricao: 'Feito à mão' }])
    expect((await importacoesDe(e.escolaId))[0]).toMatchObject({ estado: 'desatualizada', erro: null, linhas: null, marcas: null, resumo: null })
    // Quem chega depois acha a importação fechada: o job repetido não faz nada.
    expect(await rodar(e.escolaId, id)).toBe('ignorada')
  })

  it('ano encerrado entre o gravar e o job: `desatualizada`, e nenhum evento no ano encerrado', async () => {
    const e = await escolaComAnos()
    const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes')))
    expect((await pedir(e.coordenacao, 'POST', `/v1/anos-letivos/${e.emCurso}/encerrar`)).status).toBe(200)

    expect(await rodar(e.escolaId, id)).toBe('desatualizada')

    expect(await eventosDe(e.emCurso)).toEqual([])
    expect((await importacoesDe(e.escolaId))[0]).toMatchObject({ estado: 'desatualizada', linhas: null, marcas: null })
  })

  it('[P] `encerrar` do ano com o job parado depois de ler o ano: o encerrar espera o `FOR SHARE` do job, que conclui antes; nunca se grava no ano encerrado', async () => {
    const e = await escolaComAnos()
    const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes')))
    const parada = new WriteBlockTrigger(apoio, { tabela: 'evento_calendario', evento: 'insert', quando: `new.escola_id = '${e.escolaId}'` })
    await parada.armar()
    try {
      const job = rodar(e.escolaId, id)
      await parada.esperarParadas()
      // Direto no banco: o job espera a trava só 1 s, e o encerrar precisa chegar a ela dentro disso.
      const encerrar = apoio.query("update ano_letivo set situacao = 'encerrado' where id = $1", [e.emCurso])
      await esperarNaTrava(apoio, '%update%ano_letivo%')
      await parada.soltar()
      expect(await job).toBe('concluida')
      expect((await encerrar).rowCount).toBe(1)
    } finally {
      await parada.desarmar()
    }
    expect(await eventosDe(e.emCurso)).toHaveLength(1)
  })

  it('[P] `encerrar` do ano em andamento, o job vê o ano já encerrado ao pedir o `FOR SHARE`: `desatualizada`, sem evento e sem `40P01`', async () => {
    const e = await escolaComAnos()
    const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes')))
    const encerrador = await apoio.connect()
    try {
      await encerrador.query('begin')
      await encerrador.query("update ano_letivo set situacao = 'encerrado' where id = $1", [e.emCurso])
      const job = rodar(e.escolaId, id)
      await esperarNaTrava(apoio, '%ano_letivo%for share%')
      await encerrador.query('commit')
      expect(await job).toBe('desatualizada')
    } finally {
      encerrador.release()
    }
    expect(await eventosDe(e.emCurso)).toEqual([])
  })

  it('sem ano em curso: a prévia e o gravar com o filtro do ano planejado funcionam, e sem o filtro respondem NAO_ENCONTRADO', async () => {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const e: Escola = { escolaId, coordenacao, emCurso: '', planejado: await anoNovo(coordenacao, 2027, false) }
    const planilha = texto(evento('2027-04-21', '2027-04-21', 'feriado', 'Tiradentes'))

    expect(erroDe(await previa(e, planilha))).toEqual(NAO_ENCONTRADO)
    expect(erroDe(await gravar(e, planilha))).toEqual(NAO_ENCONTRADO)
    expect((await previa(e, planilha, { anoLetivoId: e.planejado })).status).toBe(200)
    const id = await gravada(e, planilha, { anoLetivoId: e.planejado })
    expect(await rodar(escolaId, id)).toBe('concluida')
    expect(await eventosDe(e.planejado)).toHaveLength(1)
  })

  it('filtro com o ano de outra escola (inclusive o planejado dela), o encerrado, o em curso ou o inexistente: NAO_ENCONTRADO, igual', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    const antigo = await anoNovo(a.coordenacao, 2025, false)
    await bancada.pool.query("update ano_letivo set situacao = 'encerrado' where id = $1", [antigo])
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))

    for (const anoLetivoId of [b.planejado, b.emCurso, antigo, a.emCurso, randomUUID()]) {
      const daPrevia = await previa(a, planilha, { anoLetivoId })
      const doGravar = await gravar(a, planilha, { anoLetivoId })
      expect([erroDe(daPrevia), erroDe(doGravar)], anoLetivoId).toEqual([NAO_ENCONTRADO, NAO_ENCONTRADO])
    }
    expect(await importacoesDe(a.escolaId)).toEqual([])
    expect(await importacoesDe(b.escolaId)).toEqual([])
  })

  it('isolamento: o `turmaId` de outra escola numa planilha que não usa turma responde igual ao de uma turma que não existe', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    const serie = await criado(pedir(b.coordenacao, 'POST', '/v1/series', { etapa: 'ef_anos_finais', ano: 7 }))
    const turmaDaB = await criado(pedir(b.coordenacao, 'POST', '/v1/turmas', { serieId: serie, nome: `turma ${PREFIXO}` }))
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))

    for (const turmaId of [turmaDaB, randomUUID()]) {
      expect([erroDe(await previa(a, planilha, { turmaId })), erroDe(await gravar(a, planilha, { turmaId }))], turmaId).toEqual([NAO_ENCONTRADO, NAO_ENCONTRADO])
    }
    expect(await importacoesDe(a.escolaId)).toEqual([])
  })

  it('isolamento: a importação da escola A grava só no ano da A, e o job da A não toca a escola B', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    expect(await rodar(b.escolaId, await gravada(b, texto(evento('2026-05-01', '2026-05-01', 'feriado', 'Trabalho da B'))))).toBe('concluida')
    const idDaA = await gravada(a, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes da A')))

    // O id da importação da A, no contexto da B: não é achado, e a da A segue `na_fila`.
    expect(await rodar(b.escolaId, idDaA)).toBe('ignorada')
    expect((await importacoesDe(a.escolaId))[0]?.estado).toBe('na_fila')
    expect(await rodar(a.escolaId, idDaA)).toBe('concluida')
    expect(await eventosDe(b.emCurso)).toEqual([{ tipo: 'feriado', inicio: '2026-05-01', fim: '2026-05-01', descricao: 'Trabalho da B' }])
    expect(await eventosDe(a.emCurso)).toEqual([{ tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Tiradentes da A' }])
  })

  it('o professor, o aluno e o tipo que não existe: a prévia e o gravar respondem NAO_ENCONTRADO, e nada é gravado', async () => {
    const e = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))
    for (const papel of ['professor', 'aluno'] as const) {
      const sessao = await bancada.sessao(e.escolaId, papel)
      expect(erroDe(await pedir(sessao, 'POST', '/v1/importacoes/calendario/previa', { texto: planilha })), papel).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await pedir(sessao, 'POST', '/v1/importacoes/calendario', { texto: planilha })), papel).toEqual(NAO_ENCONTRADO)
    }
    // O que o objeto tem de herança (`constructor`) não é um tipo de planilha: a rota não existe.
    for (const tipo of ['horario', 'constructor', 'toString']) {
      expect(erroDe(await pedir(e.coordenacao, 'POST', `/v1/importacoes/${tipo}/previa`, { texto: planilha })), tipo).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await pedir(e.coordenacao, 'POST', `/v1/importacoes/${tipo}`, { texto: planilha })), tipo).toEqual(NAO_ENCONTRADO)
    }
    // Os tipos que as tarefas seguintes trazem ainda não gravam (os professores gravam desde a 6.0, e têm o seu arquivo).
    for (const tipo of ['alunos', 'grade']) expect(erroDe(await pedir(e.coordenacao, 'POST', `/v1/importacoes/${tipo}/previa`, { texto: planilha })), tipo).toEqual(NAO_ENCONTRADO)
    expect(await importacoesDe(e.escolaId)).toEqual([])
  })

  it('o corpo é estrito: `escolaId` no corpo, texto de mais de 512 KB e corpo sem texto respondem ENTRADA_INVALIDA', async () => {
    const e = await escolaComAnos()
    const planilha = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))
    expect(erroDe(await previa(e, planilha, { escolaId: e.escolaId }))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await gravar(e, planilha, { escolaId: e.escolaId }))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await pedir(e.coordenacao, 'POST', '/v1/importacoes/calendario', {}))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await previa(e, `${CABECALHO}\n${'a'.repeat(512 * 1024 + 1)}`))).toEqual(ENTRADA_INVALIDA)
    expect(await importacoesDe(e.escolaId)).toEqual([])
  })

  it('uma planilha de 300 KB, três vezes o limite padrão do Express, é lida: a prévia e o gravar respondem, e o job grava todas as linhas', async () => {
    const e = await escolaComAnos()
    const linhas = Array.from({ length: 3_000 }, (_, posicao) => evento('2026-06-01', '2026-06-01', 'evento', `Evento ${String(posicao + 1)} ${'x'.repeat(60)}`))
    const grande = texto(...linhas)
    expect(grande.length).toBeGreaterThan(300_000)
    expect((await previa(e, grande)).status).toBe(200)
    const id = await gravada(e, grande)
    expect(await rodar(e.escolaId, id)).toBe('concluida')
    expect(await eventosDe(e.emCurso)).toHaveLength(3_000)
  })

  it('auditoria: `planilha.gravada` leva o tipo e as contagens, com a coordenação como autora, e nenhuma descrição de evento', async () => {
    const e = await escolaComAnos()
    const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'), evento('2026-05-01', '2026-05-01', 'feriado', 'Trabalho')))
    expect(await auditoriaDa(bancada, e.escolaId, 'planilha.gravada')).toEqual([])
    expect(await rodar(e.escolaId, id)).toBe('concluida')

    const registros = await auditoriaDa(bancada, e.escolaId, 'planilha.gravada')
    expect(registros).toHaveLength(1)
    expect(registros[0]).toMatchObject({ entidade: 'importacao_planilha', entidade_id: id, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { tipo: 'calendario', contagens: { entram: 2, ja_existem: 0, eventos_removidos: 0 } } })
    expect(JSON.stringify(registros)).not.toContain(PREFIXO)
  })

  it('quem gravou já saiu (`criado_por` nulo): o job não grava, fecha `desatualizada` e não audita; a rotina não assina `planilha.gravada`', async () => {
    const e = await escolaComAnos()
    const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes')))
    await bancada.pool.query('update importacao_planilha set criado_por = null where id = $1', [id])

    expect(await rodar(e.escolaId, id)).toBe('desatualizada')

    expect(await eventosDe(e.emCurso)).toEqual([])
    expect((await importacoesDe(e.escolaId))[0]).toMatchObject({ estado: 'desatualizada', linhas: null, marcas: null })
    expect(await auditoriaDa(bancada, e.escolaId, 'planilha.gravada')).toEqual([])
  })
  describe('GET /v1/importacoes/:id (F2, tarefa 5.0)', () => {
    it('a coordenação acompanha a importação: `na_fila` sem resumo, e `concluida` com as contagens; nem `linhas` nem `marcas` saem', async () => {
      const e = await escolaComAnos()
      const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes')))

      const naFila = await pedir(e.coordenacao, 'GET', `/v1/importacoes/${id}`)
      expect(naFila.status).toBe(200)
      expect(importacaoSchema.parse(naFila.corpo)).toMatchObject({ id, tipo: 'calendario', estado: 'na_fila', resumo: null, erro: null, concluidaEm: null })

      expect(await rodar(e.escolaId, id)).toBe('concluida')
      const concluida = await pedir(e.coordenacao, 'GET', `/v1/importacoes/${id}`)
      expect(importacaoSchema.parse(concluida.corpo)).toMatchObject({ estado: 'concluida', resumo: { entram: 1, ja_existem: 0, eventos_removidos: 0 } })
      expect(Object.keys(concluida.corpo).sort()).toEqual(['concluidaEm', 'criadoEm', 'erro', 'estado', 'id', 'resumo', 'tipo'])
    })

    it('a que falhou traz o código do erro e nenhum resumo', async () => {
      const e = await escolaComAnos()
      const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes')))
      await bancada.pool.query("update importacao_planilha set criado_em = now() - interval '61 minutes' where id = $1", [id])
      await gravada(e, texto(evento('2026-05-01', '2026-05-01', 'feriado', 'Trabalho')))

      const lida = importacaoSchema.parse((await pedir(e.coordenacao, 'GET', `/v1/importacoes/${id}`)).corpo)
      expect(lida).toMatchObject({ estado: 'falhou', erro: 'expirou', resumo: null })
      expect(lida.concluidaEm).not.toBeNull()
    })

    it('isolamento: o id da importação da B, na A, responde igual ao de uma que não existe', async () => {
      const a = await escolaComAnos()
      const b = await escolaComAnos()
      const daB = await gravada(b, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes da B')))

      expect(erroDe(await pedir(a.coordenacao, 'GET', `/v1/importacoes/${daB}`))).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await pedir(a.coordenacao, 'GET', `/v1/importacoes/${randomUUID()}`))).toEqual(NAO_ENCONTRADO)
      expect((await pedir(b.coordenacao, 'GET', `/v1/importacoes/${daB}`)).status).toBe(200)
    })

    it('sem ano em curso a importação da escola responde, e a da outra escola continua igual à que não existe', async () => {
      const escolaId = await bancada.escola()
      const coordenacao = await bancada.sessao(escolaId, 'coordenador')
      const e: Escola = { escolaId, coordenacao, emCurso: '', planejado: await anoNovo(coordenacao, 2027, false) }
      const outra = await escolaComAnos()
      const id = await gravada(e, texto(evento('2027-04-21', '2027-04-21', 'feriado', 'Tiradentes')), { anoLetivoId: e.planejado })
      const daOutra = await gravada(outra, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes da outra')))

      expect(importacaoSchema.parse((await pedir(coordenacao, 'GET', `/v1/importacoes/${id}`)).corpo)).toMatchObject({ id, estado: 'na_fila' })
      expect(erroDe(await pedir(coordenacao, 'GET', `/v1/importacoes/${daOutra}`))).toEqual(NAO_ENCONTRADO)
    })

    it('o professor e o aluno da mesma escola, e o id que não é UUID, não alcançam a importação', async () => {
      const e = await escolaComAnos()
      const id = await gravada(e, texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes')))
      for (const papel of ['professor', 'aluno'] as const) {
        expect(erroDe(await pedir(await bancada.sessao(e.escolaId, papel), 'GET', `/v1/importacoes/${id}`)), papel).toEqual(NAO_ENCONTRADO)
      }
      expect(erroDe(await pedir(e.coordenacao, 'GET', '/v1/importacoes/1837'))).toEqual(NAO_ENCONTRADO)
    })
  })

  describe('limites da prévia e do gravar (F2, tarefa 5.0)', () => {
    const vagasDaApi = () => api.app.get<SchoolSemaphore>(VAGAS_DA_PLANILHA, { strict: false })
    const planilhaPequena = texto(evento('2026-04-21', '2026-04-21', 'feriado', 'Tiradentes'))

    it('20 pedidos por minuto por usuário, prévia e gravar no mesmo balde: o 21º recebe 429 nas duas rotas, e outro usuário da escola segue', async () => {
      const e = await escolaComAnos()
      expect(LIMITE_DA_PLANILHA_POR_MINUTO).toBe(20)
      const status: number[] = []
      for (let i = 0; i < 12; i += 1) status.push((await previa(e, planilhaPequena)).status)
      // Os oito gravares gastam o balde mesmo quando respondem CONFLITO (a fila da escola já tem uma).
      for (let i = 0; i < 8; i += 1) status.push((await gravar(e, planilhaPequena)).status)
      expect(status.slice(0, 12)).toEqual(Array<number>(12).fill(200))
      expect(status.slice(12).sort()).toEqual([202, 409, 409, 409, 409, 409, 409, 409])

      expect(erroDe(await previa(e, planilhaPequena))).toEqual(LIMITE_EXCEDIDO)
      expect(erroDe(await gravar(e, planilhaPequena))).toEqual(LIMITE_EXCEDIDO)
      expect((await importacoesDe(e.escolaId)).map((importacao) => importacao.estado)).toEqual(['na_fila'])

      const outra = await bancada.sessao(e.escolaId, 'coordenador')
      expect((await pedir(outra, 'POST', '/v1/importacoes/calendario/previa', { texto: planilhaPequena })).status).toBe(200)
    })

    it('[P] três prévias ao mesmo tempo na escola: as duas primeiras ocupam a vaga, a terceira recebe 429, e a outra escola segue', async () => {
      const e = await escolaComAnos()
      const outra = await escolaComAnos()
      const ocupadas = [await vagasDaApi().ocupar(e.escolaId), await vagasDaApi().ocupar(e.escolaId)]
      expect(VAGAS_DA_PLANILHA_POR_ESCOLA).toBe(2)
      try {
        expect(ocupadas.every((vaga) => vaga !== undefined)).toBe(true)
        expect(erroDe(await previa(e, planilhaPequena))).toEqual(LIMITE_EXCEDIDO)
        expect(erroDe(await gravar(e, planilhaPequena))).toEqual(LIMITE_EXCEDIDO)
        expect((await previa(outra, planilhaPequena)).status).toBe(200)
      } finally {
        await Promise.all(ocupadas.map((vaga) => vaga?.liberar()))
      }
      expect((await previa(e, planilhaPequena)).status).toBe(200)
      expect(await importacoesDe(e.escolaId)).toEqual([])
    })

    it('[P] o gravar ocupa vaga: com uma vaga já ocupada e um gravar parado na escrita, a prévia da escola recebe 429 e a da outra escola segue; solto, a vaga volta', async () => {
      const e = await escolaComAnos()
      const outra = await escolaComAnos()
      const parada = new WriteBlockTrigger(apoio, { tabela: 'importacao_planilha', evento: 'insert', quando: `new.escola_id = '${e.escolaId}'` })
      const outraVaga = await vagasDaApi().ocupar(e.escolaId)
      await parada.armar()
      try {
        const emAndamento = gravar(e, planilhaPequena)
        await parada.esperarParadas()

        expect(erroDe(await previa(e, planilhaPequena))).toEqual(LIMITE_EXCEDIDO)
        expect((await previa(outra, planilhaPequena)).status).toBe(200)

        await parada.soltar()
        expect((await emAndamento).status).toBe(202)
      } finally {
        await parada.desarmar()
        await outraVaga?.liberar()
      }
      // As duas vagas voltaram: duas prévias seguidas e uma terceira ao mesmo tempo que a segunda passam, uma de cada vez.
      expect((await previa(e, planilhaPequena)).status).toBe(200)
      const ocupadas = await Promise.all([vagasDaApi().ocupar(e.escolaId), vagasDaApi().ocupar(e.escolaId)])
      expect(ocupadas.map((vaga) => vaga !== undefined)).toEqual([true, true])
      await Promise.all(ocupadas.map((vaga) => vaga?.liberar()))
    })

    it('o pedido que falha dentro do trabalho devolve a vaga: três prévias que dão NAO_ENCONTRADO (ano de outra escola) não deixam a escola cheia', async () => {
      const e = await escolaComAnos()
      for (let i = 0; i < VAGAS_DA_PLANILHA_POR_ESCOLA + 1; i += 1) expect(erroDe(await previa(e, planilhaPequena, { anoLetivoId: randomUUID() }))).toEqual(NAO_ENCONTRADO)
      expect((await previa(e, planilhaPequena)).status).toBe(200)
    })

    it('a vaga volta quando o processo morre: o membro vencido sai da conta pela hora do Redis, o vivo segue contando, e a chave ganha prazo', async () => {
      const cliente = api.app.get<Redis>(REDIS_CACHE_CLIENT, { strict: false })
      const escolaId = randomUUID()
      const prefixo = `${PREFIXO_VAGAS_DA_IMPORTACAO}:teste${PREFIXO}`
      const chave = `${prefixo}:${escolaId}`
      const semaforo = new SchoolSemaphore(cliente, { prefixo, maximo: 2, validadeMs: 5_000, instancias: 1 })
      // O estado que um processo morto deixa: uma vaga que já venceu e outra que ainda vale, pontuadas pela hora do próprio Redis.
      const [segundos, micro] = await cliente.time()
      const agoraMs = Number(segundos) * 1000 + Math.floor(Number(micro) / 1000)
      await cliente.zadd(chave, String(agoraMs - 60_000), 'processo-morto', String(agoraMs + 120_000), 'processo-vivo')
      expect(await cliente.pttl(chave)).toBe(-1)

      expect(await semaforo.ocupar(escolaId)).toBeDefined()
      expect(await semaforo.ocupar(escolaId)).toBeUndefined()
      expect(await cliente.zrange(chave, '0', '-1')).toContain('processo-vivo')
      expect(await cliente.zrange(chave, '0', '-1')).not.toContain('processo-morto')
      // A chave ganha prazo: se ninguém mais voltar, ela some sozinha.
      const prazo = await cliente.pttl(chave)
      expect(prazo).toBeGreaterThan(0)
      expect(prazo).toBeLessThanOrEqual(5_000)
      await cliente.del(chave)
    })

    it('[P] dez pedidos ao mesmo tempo na mesma escola ocupam exatamente as duas vagas, e a outra escola tem as dela', async () => {
      const a = randomUUID()
      const b = randomUUID()
      const pedidos = await Promise.all([...Array.from({ length: 10 }, () => vagasDaApi().ocupar(a)), ...Array.from({ length: 10 }, () => vagasDaApi().ocupar(b))])
      const deA = pedidos.slice(0, 10).filter((vaga) => vaga !== undefined)
      const deB = pedidos.slice(10).filter((vaga) => vaga !== undefined)
      try {
        expect([deA.length, deB.length]).toEqual([VAGAS_DA_PLANILHA_POR_ESCOLA, VAGAS_DA_PLANILHA_POR_ESCOLA])
      } finally {
        await Promise.all([...deA, ...deB].map((vaga) => vaga.liberar()))
      }
      // Devolvidas, as duas voltam a ser ocupadas.
      const denovo = await Promise.all(Array.from({ length: 5 }, () => vagasDaApi().ocupar(a)))
      expect(denovo.filter((vaga) => vaga !== undefined)).toHaveLength(VAGAS_DA_PLANILHA_POR_ESCOLA)
      await Promise.all(denovo.map((vaga) => vaga?.liberar()))
    })

    it('3.000 linhas entram; 3.001 linhas são ENTRADA_INVALIDA na prévia e no gravar, e nada é gravado', async () => {
      const e = await escolaComAnos()
      expect(MAXIMO_DE_LINHAS_DA_PLANILHA).toBe(3_000)
      const comLinhas = (quantas: number): string => texto(...Array.from({ length: quantas }, (_, posicao) => evento('2026-06-01', '2026-06-01', 'evento', `Evento ${String(posicao + 1)}`)))

      expect((await previa(e, comLinhas(3_000))).status).toBe(200)
      expect(erroDe(await previa(e, comLinhas(3_001)))).toEqual(ENTRADA_INVALIDA)
      expect(erroDe(await gravar(e, comLinhas(3_001)))).toEqual(ENTRADA_INVALIDA)
      expect(await importacoesDe(e.escolaId)).toEqual([])
    })

    it('512 KB exatos entram na prévia; 512 KB + 1 byte, com poucas linhas, são ENTRADA_INVALIDA', async () => {
      const e = await escolaComAnos()
      const cabecalho = `${CABECALHO}\n`
      const linha = (tamanho: number): string => `2026-04-21;2026-04-21;feriado;${PREFIXO} ${'a'.repeat(tamanho)}`
      // Uma só linha, com o tamanho exato: o limite de bytes decide, não o de linhas.
      const sobra = 512 * 1024 - Buffer.byteLength(cabecalho) - Buffer.byteLength(linha(0))
      const exato = `${cabecalho}${linha(sobra)}`
      expect(Buffer.byteLength(exato)).toBe(512 * 1024)

      expect(erroDe(await previa(e, `${exato}a`))).toEqual(ENTRADA_INVALIDA)
      // A linha é grande demais para uma descrição, mas o texto cabe: a prévia responde 200 e aponta o erro da linha 2.
      const lida = await previa(e, exato)
      expect(lida.status).toBe(200)
      expect(previaDaPlanilhaResponseSchema.parse(lida.corpo).linhas).toMatchObject([{ linha: 2, resultado: 'erro' }])
    })

    it('o teto de 100 KB vale para as outras rotas: um JSON válido de 101 KB em `POST /v1/series` é ENTRADA_INVALIDA (400, tipado, sem pilha) e não grava; o de 100 KB exatos é aceito; e a planilha de 300 KB segue lida', async () => {
      const a = await escolaComAnos()
      const b = await escolaComAnos()
      const serie = '{"etapa":"ef_anos_finais","ano":7}'
      // O corpo é o que o contrato aceitaria: só o tamanho (espaço em branco depois do JSON) o distingue do aceito.
      const comTamanho = (bytes: number): string => serie + ' '.repeat(bytes - serie.length)
      const bruto = async (e: Escola, corpo: string) => {
        const resposta = await fetch(`${api.url}/v1/series`, { method: 'POST', headers: { Authorization: `Bearer ${e.coordenacao.token}`, 'Content-Type': 'application/json' }, body: corpo })
        return { status: resposta.status, texto: await resposta.text() }
      }
      const seriesDe = async (e: Escola) => (await bancada.pool.query('select 1 from serie where escola_id = $1', [e.escolaId])).rowCount
      expect(comTamanho(101 * 1024)).toHaveLength(101 * 1024)

      const recusada = await bruto(a, comTamanho(101 * 1024))
      expect(recusada.status).toBe(400)
      expect(JSON.parse(recusada.texto)).toMatchObject({ erro: { codigo: ErrorCode.ENTRADA_INVALIDA } })
      expect(recusada.texto).not.toMatch(/stack|\bat \S+ \(/)
      expect(await seriesDe(a)).toBe(0)

      // Controle: o mesmo corpo com 100 KB exatos entra, pela mesma rota e a mesma sessão.
      expect((await bruto(b, comTamanho(100 * 1024))).status).toBe(201)
      expect(await seriesDe(b)).toBe(1)

      expect((await previa(a, texto(...Array.from({ length: 3_000 }, (_, posicao) => evento('2026-06-01', '2026-06-01', 'evento', `Evento ${String(posicao + 1)} ${'x'.repeat(60)}`))))).status).toBe(200)
    })
  })
})
