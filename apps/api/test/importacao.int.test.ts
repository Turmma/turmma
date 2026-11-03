import { createDatabase, createPool, executarPlanilha, runInContext, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, previaDaPlanilhaResponseSchema } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
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
    // Os tipos que as tarefas seguintes trazem ainda não gravam.
    for (const tipo of ['alunos', 'professores', 'grade']) expect(erroDe(await pedir(e.coordenacao, 'POST', `/v1/importacoes/${tipo}/previa`, { texto: planilha })), tipo).toEqual(NAO_ENCONTRADO)
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
})
