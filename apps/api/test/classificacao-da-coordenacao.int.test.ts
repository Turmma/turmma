import { AgendamentoDaClassificacaoRepository, JobOutbox, JobOutboxRepository, runInContext, type Database, type SecaoParaAgendar } from '@educa/core'
import { ErrorCode, habilidadesBnccResponseSchema, materialComCapitulosResponseSchema, reclassificarResponseSchema, secaoDoMaterialResponseSchema, type SituacaoDaSecao } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DB } from '../src/database.module.js'
import {
  CORRECOES_POR_ESCOLA_NA_JANELA,
  CORRECOES_POR_USUARIO_NA_JANELA,
  JANELA_DA_CLASSIFICACAO_MS,
  RECLASSIFICACOES_POR_ESCOLA_NA_JANELA,
  RECLASSIFICACOES_POR_USUARIO_NA_JANELA,
} from '../src/material/material.service.js'
import { SecoesRepository } from '../src/material/secoes.repository.js'
import { runOpsReclassificarEscola, reclassificarEscola } from '../src/ops/reclassificar-escola.js'
import { vincularProfessor } from './escola-assistente.fixture.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-turma.fixture.js'
import { auditoriaDa } from './material.fixture.js'
import { autorDaBancada, SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * A coordenação lê, corrige e manda reclassificar pela API, e a operação reclassifica uma escola (classificacao-bncc, 7.0; `techspec.md` §4, §5 "Reclassificar", "Correção" e "Suspensão", §7c "Estados da seção";
 * `cenarios.md` "Correção e reclassificação", "Permissão e isolamento", "Dado pessoal"; corridas P1b, P2, P3, P5 e P9). A API é a de verdade e nenhum teste chama modelo: reclassificar só cria execuções e jobs.
 * O material é gravado direto no banco (uma apostila sintética, sem PDF no storage: o texto vem dos `trecho`).
 */
const bancada = new SessaoFixtures()
const medidor = new MedidorDeTeste()
const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)
const enfileirador = new JobOutbox(new JobOutboxRepository(bancada.banco))
const naEscola = <Resultado>(escolaId: string, trabalho: () => Promise<Resultado>): Promise<Resultado> => runInContext({ requisicaoId: randomUUID(), escolaId }, trabalho)
const bancoDaApi = (): Database => api.app.get<Database>(DB)
let api: TestApi
const escolasDoTeste: string[] = []

const CODIGO_DO_6O = 'EF06CI01'
const CODIGO_DO_9O = 'EF09CI01'
const CODIGO_DO_MEDIO = 'EM13CNT101'
const PESSOA_DA_BANCADA = 'teste-integracao'

interface Escola {
  readonly base: EscolaComTurma
  readonly escolaId: string
  readonly serie6: string
  readonly serie9: string
}

/** A escola montada pela API, com o 6º e o 9º do Fundamental além do 2º do Médio. Química e Física nascem com componente. */
async function escolaNova(): Promise<Escola> {
  const base = await montarEscolaComTurma(api, bancada)
  const escolaId = base.coordenacao.escolaId
  escolasDoTeste.push(escolaId)
  const serie = async (ano: number): Promise<string> => {
    const criada = await chamar(api.url, 'POST', '/v1/series', base.coordenacao.token, { etapa: 'ef_anos_finais', ano })
    expect(criada.status).toBe(201)
    return criada.corpo['id'] as string
  }
  return { base, escolaId, serie6: await serie(6), serie9: await serie(9) }
}

interface MaterialOptions {
  readonly secoes?: number
  readonly disciplinaId?: string
  readonly series?: readonly string[]
  readonly estado?: string
}

async function inserirMaterial(escola: Escola, disciplinaId: string, estado: string, paginas: number): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
     values ($1, $2, 'Apostila sigilosa', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, $3, $4, now() - interval '3 hours') returning id`,
    [escola.escolaId, disciplinaId, estado, paginas],
  )
  return rows[0]?.id ?? ''
}

/** O material (`pronto`, a menos que se peça outro estado) com `secoes` seções de uma página cada, sem execução, sem falha e sem correção. */
async function materialNovo(escola: Escola, opcoes: MaterialOptions = {}): Promise<{ materialId: string; secoes: string[] }> {
  const quantas = opcoes.secoes ?? 1
  const materialId = await inserirMaterial(escola, opcoes.disciplinaId ?? escola.base.quimica, opcoes.estado ?? 'pronto', quantas)
  for (const serieId of opcoes.series ?? [escola.serie6]) await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escola.escolaId, materialId, serieId])
  const secoes: string[] = []
  for (let ordem = 1; ordem <= quantas; ordem++) {
    const secao = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3::smallint, $3::int, $3::int) returning id', [escola.escolaId, materialId, ordem])
    secoes.push(secao.rows[0]?.id ?? '')
  }
  return { materialId, secoes }
}

type EstadoDaExecucao = 'pendente' | 'rodando' | 'concluida' | 'falhou'

/** Uma execução da classificação no estado dado, e as seções apontando para ela com a `falhas_seguidas` dada. */
async function execucaoNaSecao(escola: Escola, secoes: readonly string[], estado: EstadoDaExecucao, falhas = 0): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, resultado, iniciada_em, concluida_em)
     values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, '{"tarefa":"classificar_secoes"}'::jsonb, $3::text, $4,
             case when $3::text = 'concluida' then '{"tipo":"classificacao_do_material","secoes":1}'::jsonb end,
             case when $3::text in ('rodando', 'concluida', 'falhou') then now() end, case when $3::text in ('concluida', 'falhou') then now() end) returning id`,
    [escola.escolaId, randomUUID(), estado, estado === 'falhou' ? 'IA_SAIDA_INVALIDA' : null],
  )
  const id = rows[0]?.id ?? ''
  await sql("update secao_do_material set execucao_id = $1, falhas_seguidas = $2, classificada_em = case when $3::text = 'concluida' then now() end where escola_id = $4 and id = any($5::uuid[])", [id, falhas, estado, escola.escolaId, secoes])
  return id
}

/** A seção que a IA classificou: execução concluída e o código da IA. */
async function secaoClassificada(escola: Escola, secoes: readonly string[], codigo = CODIGO_DO_6O): Promise<string> {
  const execucaoId = await execucaoNaSecao(escola, secoes, 'concluida')
  for (const secaoId of secoes) await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')", [escola.escolaId, secaoId, codigo])
  return execucaoId
}

interface SecaoNoBanco extends Record<string, unknown> {
  readonly execucao_id: string | null
  readonly falhas_seguidas: number
  readonly corrigida_em: Date | null
  readonly corrigida_por: string | null
}
const secaoDe = async (id: string): Promise<SecaoNoBanco> => (await sql<SecaoNoBanco>('select execucao_id, falhas_seguidas, corrigida_em, corrigida_por from secao_do_material where id = $1', [id])).rows[0] as SecaoNoBanco
const habilidadesDa = async (secaoId: string): Promise<Array<{ codigo: string; origem: string }>> =>
  (await sql<{ codigo: string; origem: string }>('select codigo, origem from habilidade_da_secao where secao_id = $1 order by codigo', [secaoId])).rows
const execucoesDaEscola = async (escolaId: string): Promise<number> => Number((await sql<{ n: string }>("select count(*) as n from execucao_agente where escola_id = $1 and tarefa = 'classificar_secoes'", [escolaId])).rows[0]?.n)

const get = (sessao: Pick<TestSessao, 'token'>, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
const corrigir = (sessao: Pick<TestSessao, 'token'>, materialId: string, secaoId: string, corpo: unknown): Promise<RespostaHttp & { retryAfter?: string | null }> =>
  comRetryAfter(sessao, 'PUT', `/v1/materiais/${materialId}/secoes/${secaoId}/habilidades`, corpo)
const reclassificar = (sessao: Pick<TestSessao, 'token'>, materialId: string): Promise<RespostaHttp & { retryAfter?: string | null }> => comRetryAfter(sessao, 'POST', `/v1/materiais/${materialId}/reclassificar`)
const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
const naoEncontrado = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }

async function comRetryAfter(sessao: Pick<TestSessao, 'token'>, metodo: string, caminho: string, corpo?: unknown): Promise<RespostaHttp & { retryAfter: string | null }> {
  const resposta = await fetch(`${api.url}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${sessao.token}`, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  })
  const texto = await resposta.text()
  return { status: resposta.status, corpo: texto === '' ? {} : (JSON.parse(texto) as RespostaHttp['corpo']), setCookie: resposta.headers.getSetCookie(), retryAfter: resposta.headers.get('Retry-After') }
}

async function lerSecoes(escola: Escola, materialId: string): Promise<ReturnType<typeof materialComCapitulosResponseSchema.parse>> {
  const resposta = await get(escola.base.coordenacao, `/v1/materiais/${materialId}`)
  expect(resposta.status).toBe(200)
  return materialComCapitulosResponseSchema.parse(resposta.corpo)
}

/** Grava, direto na auditoria, `quantidade` registros da `acao` feitos por `autorId` na escola: o que centenas de pedidos deixariam, sem fazê-los. */
async function registrosJaFeitos(escolaId: string, autorId: string, quantidade: number, acao: string): Promise<void> {
  await sql(
    `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, em)
     select $1, $2, $3, 'material', gen_random_uuid(), gen_random_uuid(), now() from generate_series(1, $4::int)`,
    [escolaId, autorId, acao, quantidade],
  )
}

/** O artefato (`atividade_objetiva`) de `autorId` na turma e na disciplina pedidas, no ano em curso da escola. */
async function artefatoNovo(escola: Escola, autorId: string, turmaId: string, disciplinaId: string): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por)
     values ($1, $2, $3, $4, 'atividade_objetiva', 'Atividade sintética', '{"tipo":"atividade_objetiva","questoes":[]}'::jsonb, $5) returning id`,
    [escola.escolaId, escola.base.anoLetivoId, turmaId, disciplinaId, autorId],
  )
  return rows[0]?.id ?? ''
}

async function professorDaDisciplina(escola: Escola, disciplinaId = escola.base.quimica): Promise<TestSessao> {
  const professor = await bancada.sessao(escola.escolaId, 'professor')
  await vincularProfessor(bancada, escola.base, professor.usuarioId, escola.base.turma, disciplinaId)
  return professor
}

beforeAll(async () => {
  api = await subirApi(medidor.medidor, {}, undefined, TEST_APP_OPTIONS)
})

afterAll(async () => {
  await api.app.close()
  await sql('delete from job_registro where escola_id = any($1::uuid[]) and tipo = any($2::text[])', [escolasDoTeste, ['ia.executar-lote', 'material.agendar-classificacao']])
  await bancada.fechar()
  await medidor.encerrar()
})

describe('GET /v1/materiais/:id traz as seções com a situação e as habilidades', () => {
  it('uma seção em cada estado: a situação sai da execução e das habilidades, e a correção vence todas', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola, { secoes: 7 })
    const [naoAgendada, pendente, classificada, semHabilidade, falhou, corrigida, corrigidaSemCodigo] = secoes as [string, string, string, string, string, string, string]
    await execucaoNaSecao(escola, [pendente], 'pendente')
    await secaoClassificada(escola, [classificada])
    await execucaoNaSecao(escola, [semHabilidade], 'concluida')
    await execucaoNaSecao(escola, [falhou], 'falhou', 2)
    await execucaoNaSecao(escola, [corrigida, corrigidaSemCodigo], 'falhou')
    expect((await corrigir(escola.base.coordenacao, materialId, corrigida, { codigos: [CODIGO_DO_6O] })).status).toBe(200)
    expect((await corrigir(escola.base.coordenacao, materialId, corrigidaSemCodigo, { codigos: [] })).status).toBe(200)

    const lido = await lerSecoes(escola, materialId)

    const situacoes = Object.fromEntries(lido.secoes.map((secao) => [secao.id, secao.situacao])) as Record<string, SituacaoDaSecao>
    expect(situacoes).toEqual({
      [naoAgendada]: 'nao_agendada',
      [pendente]: 'aguardando',
      [classificada]: 'classificada',
      [semHabilidade]: 'sem_habilidade',
      [falhou]: 'nao_classificada',
      [corrigida]: 'classificada',
      [corrigidaSemCodigo]: 'sem_habilidade',
    })
    expect(lido.secoes.map((secao) => secao.corrigida)).toEqual([false, false, false, false, false, true, true])
    expect(lido.secoes.map((secao) => secao.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7])
    const daIa = lido.secoes.find((secao) => secao.id === classificada)
    expect(daIa?.habilidades).toEqual([expect.objectContaining({ codigo: CODIGO_DO_6O, origem: 'ia', descricao: expect.any(String) })])
    expect(lido.secoes.find((secao) => secao.id === corrigida)?.habilidades.map(({ origem }) => origem)).toEqual(['coordenacao'])
  })

  it('a seção de capítulo traz o número e o título dele; a de bloco de páginas traz `capitulo: null`', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola, { secoes: 2 })
    const { rows } = await sql<{ id: string }>(
      "insert into capitulo_do_material (escola_id, material_id, ordem, numero, titulo, pagina_inicial, pagina_final) values ($1, $2, 1, 3, 'Reações químicas', 1, 1) returning id",
      [escola.escolaId, materialId],
    )
    await sql('update secao_do_material set capitulo_id = $1 where id = $2', [rows[0]?.id, secoes[0]])

    const lido = await lerSecoes(escola, materialId)

    expect(lido.secoes.map((secao) => secao.capitulo)).toEqual([{ numero: 3, titulo: 'Reações químicas' }, null])
  })

  it('classificacaoSuspensa acompanha a suspensão da função; o contrato nunca leva `corrigidaPor` nem `execucaoId`', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    await secaoClassificada(escola, secoes)
    expect((await corrigir(escola.base.coordenacao, materialId, secoes[0] ?? '', { codigos: [CODIGO_DO_6O] })).status).toBe(200)
    expect((await lerSecoes(escola, materialId)).classificacaoSuspensa).toBe(false)

    const suspensa = await chamar(api.url, 'POST', '/v1/governanca/funcoes/classificacao_do_material/suspender', escola.base.coordenacao.token, {})
    expect(suspensa.status).toBe(200)

    const resposta = await get(escola.base.coordenacao, `/v1/materiais/${materialId}`)
    expect(materialComCapitulosResponseSchema.parse(resposta.corpo).classificacaoSuspensa).toBe(true)
    const texto = JSON.stringify(resposta.corpo)
    expect(texto).not.toMatch(/corrigidaPor|corrigida_por|execucaoId|execucao_id/)
    expect(texto).not.toContain(escola.base.coordenacao.usuarioId)
  })

  it('o professor da disciplina lê as seções; o do outro componente e o aluno recebem `NAO_ENCONTRADO`', async () => {
    const escola = await escolaNova()
    const { materialId } = await materialNovo(escola)
    const daDisciplina = await professorDaDisciplina(escola)
    const deFisica = await professorDaDisciplina(escola, escola.base.fisica)
    const aluno = await bancada.sessao(escola.escolaId, 'aluno')

    expect((await get(daDisciplina, `/v1/materiais/${materialId}`)).status).toBe(200)
    expect(erroDe(await get(deFisica, `/v1/materiais/${materialId}`))).toEqual(naoEncontrado)
    expect(erroDe(await get(aluno, `/v1/materiais/${materialId}`))).toEqual(naoEncontrado)
  })
})

describe('PUT da correção: final, auditada, e a ordem das respostas', () => {
  it('de zero a cinco códigos: troca todos, `origem` é a coordenação, e a auditoria leva a seção e os códigos de antes e de depois, sem título', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const secaoId = secoes[0] ?? ''
    await secaoClassificada(escola, secoes, 'EF06CI02')

    const resposta = await corrigir(escola.base.coordenacao, materialId, secaoId, { codigos: ['EF06CI03', 'EF06CI01', 'EF06CI04', 'EF06CI05', 'EF06CI06'] })

    expect(resposta.status).toBe(200)
    const lida = secaoDoMaterialResponseSchema.parse(resposta.corpo)
    expect(lida).toMatchObject({ id: secaoId, situacao: 'classificada', corrigida: true })
    expect(lida.habilidades.map(({ codigo, origem }) => [codigo, origem])).toEqual([
      ['EF06CI01', 'coordenacao'],
      ['EF06CI03', 'coordenacao'],
      ['EF06CI04', 'coordenacao'],
      ['EF06CI05', 'coordenacao'],
      ['EF06CI06', 'coordenacao'],
    ])
    const noBanco = await secaoDe(secaoId)
    expect(noBanco.corrigida_em).not.toBeNull()
    expect(noBanco.corrigida_por).toBe(escola.base.coordenacao.usuarioId)
    const [auditoria] = await auditoriaDa(bancada, escola.escolaId, 'material.classificacao_corrigida')
    expect(auditoria).toMatchObject({ entidade: 'material', entidade_id: materialId, autor_usuario_id: escola.base.coordenacao.usuarioId })
    expect(auditoria?.antes).toEqual({ secaoId, habilidades: ['EF06CI02'] })
    expect(auditoria?.depois).toEqual({ secaoId, habilidades: ['EF06CI01', 'EF06CI03', 'EF06CI04', 'EF06CI05', 'EF06CI06'] })
    expect(JSON.stringify(auditoria)).not.toContain('Apostila sigilosa')

    const zerada = await corrigir(escola.base.coordenacao, materialId, secaoId, { codigos: [] })
    expect(secaoDoMaterialResponseSchema.parse(zerada.corpo)).toMatchObject({ situacao: 'sem_habilidade', corrigida: true, habilidades: [] })
    expect(await habilidadesDa(secaoId)).toEqual([])
  })

  it('a correção de uma seção não toca a vizinha do mesmo material: as habilidades e a ausência de correção dela ficam, e a resposta é a da seção pedida', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola, { secoes: 2 })
    const [vizinha = '', pedida = ''] = secoes
    await secaoClassificada(escola, secoes, 'EF06CI02')

    const resposta = await corrigir(escola.base.coordenacao, materialId, pedida, { codigos: ['EF06CI03'] })

    expect(secaoDoMaterialResponseSchema.parse(resposta.corpo)).toMatchObject({ id: pedida, corrigida: true })
    expect(await habilidadesDa(vizinha)).toEqual([{ codigo: 'EF06CI02', origem: 'ia' }])
    expect((await secaoDe(vizinha)).corrigida_em).toBeNull()
    expect(await habilidadesDa(pedida)).toEqual([{ codigo: 'EF06CI03', origem: 'coordenacao' }])
    const [auditoria] = await auditoriaDa(bancada, escola.escolaId, 'material.classificacao_corrigida')
    expect(auditoria?.antes).toEqual({ secaoId: pedida, habilidades: ['EF06CI02'] })
  })

  it('seis códigos, código repetido, formato errado, sufixo estadual e código que a tabela não tem: `ENTRADA_INVALIDA`, um caso cada, e nada muda', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const secaoId = secoes[0] ?? ''
    await secaoClassificada(escola, secoes)
    const invalidos: unknown[] = [
      { codigos: ['EF06CI01', 'EF06CI02', 'EF06CI03', 'EF06CI04', 'EF06CI05', 'EF06CI06'] },
      { codigos: ['EF06CI01', 'EF06CI01'] },
      { codigos: ['ef06ci01'] },
      { codigos: ['EF06CI01A'] },
      { codigos: ['EF06CI99'] },
      { codigos: [CODIGO_DO_9O] },
      { codigos: [CODIGO_DO_MEDIO] },
      { codigos: ['EF06CI01'], extra: true },
      {},
    ]

    for (const corpo of invalidos) expect(erroDe(await corrigir(escola.base.coordenacao, materialId, secaoId, corpo)), JSON.stringify(corpo)).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })

    expect(await habilidadesDa(secaoId)).toEqual([{ codigo: CODIGO_DO_6O, origem: 'ia' }])
    expect((await secaoDe(secaoId)).corrigida_em).toBeNull()
    expect(await auditoriaDa(bancada, escola.escolaId, 'material.classificacao_corrigida')).toEqual([])
  })

  it('material que não está `pronto` e disciplina sem componente: `CONFLITO`, e o recorte vem antes do estado', async () => {
    const escola = await escolaNova()
    const processando = await materialNovo(escola, { estado: 'processando' })
    const semComponente = await materialNovo(escola, { disciplinaId: escola.base.fisica })
    await sql('update disciplina set componente_bncc = null where id = $1', [escola.base.fisica])

    expect(erroDe(await corrigir(escola.base.coordenacao, processando.materialId, processando.secoes[0] ?? '', { codigos: [CODIGO_DO_6O] }))).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
    expect(erroDe(await corrigir(escola.base.coordenacao, processando.materialId, processando.secoes[0] ?? '', { codigos: [CODIGO_DO_9O] }))).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
    expect(erroDe(await corrigir(escola.base.coordenacao, semComponente.materialId, semComponente.secoes[0] ?? '', { codigos: [CODIGO_DO_6O] }))).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
    expect(erroDe(await reclassificar(escola.base.coordenacao, processando.materialId))).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
    expect(erroDe(await reclassificar(escola.base.coordenacao, semComponente.materialId))).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
    expect(await auditoriaDa(bancada, escola.escolaId, 'material.classificacao_corrigida')).toEqual([])
  })

  it('`secaoId` de outro material, de material excluído, da escola B e inexistente: `NAO_ENCONTRADO` igual; o código fora do recorte em material da B também, não `ENTRADA_INVALIDA`', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const daA = await materialNovo(a, { secoes: 2 })
    const outroDaA = await materialNovo(a)
    const excluido = await materialNovo(a)
    await sql('update material set excluido_em = now(), excluido_por = $2 where id = $1', [excluido.materialId, a.base.coordenacao.usuarioId])
    const daB = await materialNovo(b)
    await secaoClassificada(b, daB.secoes)

    expect(erroDe(await corrigir(a.base.coordenacao, daA.materialId, outroDaA.secoes[0] ?? '', { codigos: [CODIGO_DO_6O] }))).toEqual(naoEncontrado)
    expect(erroDe(await corrigir(a.base.coordenacao, excluido.materialId, excluido.secoes[0] ?? '', { codigos: [CODIGO_DO_6O] }))).toEqual(naoEncontrado)
    expect(erroDe(await corrigir(a.base.coordenacao, daB.materialId, daB.secoes[0] ?? '', { codigos: [CODIGO_DO_6O] }))).toEqual(naoEncontrado)
    expect(erroDe(await corrigir(a.base.coordenacao, daA.materialId, daB.secoes[0] ?? '', { codigos: [CODIGO_DO_6O] }))).toEqual(naoEncontrado)
    expect(erroDe(await corrigir(a.base.coordenacao, daA.materialId, randomUUID(), { codigos: [CODIGO_DO_6O] }))).toEqual(naoEncontrado)
    expect(erroDe(await corrigir(a.base.coordenacao, daB.materialId, daB.secoes[0] ?? '', { codigos: [CODIGO_DO_9O] }))).toEqual(naoEncontrado)
    expect(await habilidadesDa(daB.secoes[0] ?? '')).toEqual([{ codigo: CODIGO_DO_6O, origem: 'ia' }])
    expect((await secaoDe(daB.secoes[0] ?? '')).corrigida_em).toBeNull()
  })

  it('professor e aluno no `PUT` e no reclassificar: `NAO_ENCONTRADO`, e nada é gravado', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const professor = await professorDaDisciplina(escola)
    const aluno = await bancada.sessao(escola.escolaId, 'aluno')

    for (const sessao of [professor, aluno]) {
      expect(erroDe(await corrigir(sessao, materialId, secoes[0] ?? '', { codigos: [CODIGO_DO_6O] }))).toEqual(naoEncontrado)
      expect(erroDe(await reclassificar(sessao, materialId))).toEqual(naoEncontrado)
    }

    expect((await secaoDe(secoes[0] ?? '')).corrigida_em).toBeNull()
    expect(await execucoesDaEscola(escola.escolaId)).toBe(0)
  })

  it('o coordenador eliminado: `corrigida` segue `true` (a marca é `corrigida_em`) e o reclassificar mantém a correção', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const secaoId = secoes[0] ?? ''
    expect((await corrigir(escola.base.coordenacao, materialId, secaoId, { codigos: [CODIGO_DO_6O] })).status).toBe(200)
    await sql('update secao_do_material set corrigida_por = null where id = $1', [secaoId])

    expect((await lerSecoes(escola, materialId)).secoes[0]).toMatchObject({ corrigida: true, situacao: 'classificada' })
    const resposta = await reclassificar(escola.base.coordenacao, materialId)

    expect(resposta.status).toBe(202)
    expect(reclassificarResponseSchema.parse(resposta.corpo)).toEqual({ secoes: 0, preservadas: 1 })
    expect(await habilidadesDa(secaoId)).toEqual([{ codigo: CODIGO_DO_6O, origem: 'coordenacao' }])
    expect((await secaoDe(secaoId)).execucao_id).toBeNull()
  })

  it('a correção é final: a classificação em andamento e o reclassificar não a desfazem', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola, { secoes: 2 })
    const [corrigida, outra] = secoes as [string, string]
    const execucaoId = await execucaoNaSecao(escola, secoes, 'rodando')
    expect((await corrigir(escola.base.coordenacao, materialId, corrigida, { codigos: [CODIGO_DO_6O] })).status).toBe(200)

    const gravadas = await naEscola(escola.escolaId, () => bancoDaApi().transaction((tx) => new SecoesRepository(tx).saveClassificacao(execucaoId, [{ secaoId: corrigida, codigos: ['EF06CI02'] }, { secaoId: outra, codigos: ['EF06CI03'] }])))

    expect(gravadas.map(({ secaoId }) => secaoId)).toEqual([outra])
    expect(await habilidadesDa(corrigida)).toEqual([{ codigo: CODIGO_DO_6O, origem: 'coordenacao' }])
    expect(await habilidadesDa(outra)).toEqual([{ codigo: 'EF06CI03', origem: 'ia' }])
  })
})

describe('POST /v1/materiais/:id/reclassificar', () => {
  it('cria a execução e o job só das seções não corrigidas, na fila `lote`, sem storage; zera as falhas; responde quantas e quantas ficam; e grava `material.reclassificado`', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola, { secoes: 4 })
    const [corrigida, falhou, classificada, nova] = secoes as [string, string, string, string]
    await execucaoNaSecao(escola, [falhou], 'falhou', 3)
    await secaoClassificada(escola, [classificada])
    await secaoClassificada(escola, [corrigida])
    await sql('update secao_do_material set falhas_seguidas = 2 where id = $1', [corrigida])
    expect((await corrigir(escola.base.coordenacao, materialId, corrigida, { codigos: ['EF06CI05'] })).status).toBe(200)
    const outroMaterial = await materialNovo(escola, { secoes: 2 })
    expect((await corrigir(escola.base.coordenacao, outroMaterial.materialId, outroMaterial.secoes[0] ?? '', { codigos: ['EF06CI07'] })).status).toBe(200)
    const antesDoOutro = await execucoesDaEscola(escola.escolaId)

    const resposta = await reclassificar(escola.base.coordenacao, materialId)

    expect(resposta.status).toBe(202)
    expect(reclassificarResponseSchema.parse(resposta.corpo)).toEqual({ secoes: 3, preservadas: 1 })
    expect(await execucoesDaEscola(escola.escolaId)).toBe(antesDoOutro + 1)
    const execucaoNova = (await secaoDe(nova)).execucao_id
    expect(execucaoNova).not.toBeNull()
    expect((await secaoDe(falhou)).execucao_id).toBe(execucaoNova)
    expect((await secaoDe(classificada)).execucao_id).toBe(execucaoNova)
    expect((await secaoDe(falhou)).falhas_seguidas).toBe(0)
    expect((await secaoDe(corrigida)).execucao_id).not.toBe(execucaoNova)
    expect((await secaoDe(corrigida)).falhas_seguidas).toBe(2)
    expect(await habilidadesDa(corrigida)).toEqual([{ codigo: 'EF06CI05', origem: 'coordenacao' }])
    expect((await secaoDe(outroMaterial.secoes[0] ?? '')).execucao_id).toBeNull()
    expect((await secaoDe(outroMaterial.secoes[1] ?? '')).execucao_id, 'a seção não corrigida de outro material da escola fica como está').toBeNull()
    const execucao = (await sql<{ solicitada_por: string | null; ano_letivo_id: string | null; estado: string }>('select solicitada_por, ano_letivo_id, estado from execucao_agente where id = $1', [execucaoNova])).rows
    expect(execucao).toEqual([{ solicitada_por: null, ano_letivo_id: null, estado: 'pendente' }])
    const jobs = (await sql<{ fila: string; nao_urgente: boolean }>("select fila, nao_urgente from job_registro where escola_id = $1 and tipo = 'ia.executar-lote' and chave_idempotencia = $2", [escola.escolaId, execucaoNova])).rows
    expect(jobs).toEqual([{ fila: 'lote', nao_urgente: true }])
    const [auditoria] = await auditoriaDa(bancada, escola.escolaId, 'material.reclassificado')
    expect(auditoria).toMatchObject({ entidade: 'material', entidade_id: materialId, depois: { secoes: 3, preservadas: 1 } })
    expect(JSON.stringify(auditoria)).not.toContain('Apostila sigilosa')
  })

  it('com a função suspensa: `FUNCAO_SUSPENSA`, e nenhuma execução nasce', async () => {
    const escola = await escolaNova()
    const { materialId } = await materialNovo(escola)
    expect((await chamar(api.url, 'POST', '/v1/governanca/funcoes/classificacao_do_material/suspender', escola.base.coordenacao.token, {})).status).toBe(200)

    const resposta = await reclassificar(escola.base.coordenacao, materialId)

    expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.FUNCAO_SUSPENSA)
    expect(await execucoesDaEscola(escola.escolaId)).toBe(0)
    expect(await auditoriaDa(bancada, escola.escolaId, 'material.reclassificado')).toEqual([])
  })

  it('material da escola B e inexistente: `NAO_ENCONTRADO`, e a B não ganha execução', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const daB = await materialNovo(b)

    expect(erroDe(await reclassificar(a.base.coordenacao, daB.materialId))).toEqual(naoEncontrado)
    expect(erroDe(await reclassificar(a.base.coordenacao, randomUUID()))).toEqual(naoEncontrado)
    expect(erroDe(await get(a.base.coordenacao, `/v1/materiais/${daB.materialId}`))).toEqual(naoEncontrado)
    expect(await execucoesDaEscola(b.escolaId)).toBe(0)
  })
})

describe('os tetos, por pessoa e por escola, contados na auditoria (regra 80, itens 1 e 3)', () => {
  it('o 301º `PUT` da pessoa recebe 429 com `Retry-After` antes de o corpo ser lido; a colega ainda corrige; o registro antigo e o de outra escola não contam', async () => {
    const escola = await escolaNova()
    const outra = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const colega = await bancada.sessao(escola.escolaId, 'coordenador')
    const acao = 'material.classificacao_corrigida'
    await registrosJaFeitos(outra.escolaId, outra.base.coordenacao.usuarioId, CORRECOES_POR_ESCOLA_NA_JANELA, acao)
    await sql("insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, em) select $1, $2, $3, 'material', gen_random_uuid(), gen_random_uuid(), now() - ($4::int * interval '1 millisecond') from generate_series(1, 150)", [
      escola.escolaId,
      escola.base.coordenacao.usuarioId,
      acao,
      JANELA_DA_CLASSIFICACAO_MS + 60_000,
    ])
    await registrosJaFeitos(escola.escolaId, escola.base.coordenacao.usuarioId, CORRECOES_POR_USUARIO_NA_JANELA - 1, acao)

    expect((await corrigir(escola.base.coordenacao, materialId, secoes[0] ?? '', { codigos: [CODIGO_DO_6O] })).status).toBe(200)
    const acima = await corrigir(escola.base.coordenacao, materialId, secoes[0] ?? '', { codigos: 'corpo inválido' })

    expect(erroDe(acima)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    expect(acima.retryAfter).toBe(String(JANELA_DA_CLASSIFICACAO_MS / 1_000))
    expect((await corrigir(colega, materialId, secoes[0] ?? '', { codigos: ['EF06CI02'] })).status).toBe(200)
  })

  it('o 901º `PUT` da escola recebe 429 mesmo de quem não passou do próprio; a outra escola segue livre', async () => {
    const escola = await escolaNova()
    const outra = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const doutraEscola = await materialNovo(outra)
    for (let pessoa = 0; pessoa < 3; pessoa++) {
      const colega = await bancada.sessao(escola.escolaId, 'coordenador')
      await registrosJaFeitos(escola.escolaId, colega.usuarioId, CORRECOES_POR_ESCOLA_NA_JANELA / 3, 'material.classificacao_corrigida')
    }

    const acima = await corrigir(escola.base.coordenacao, materialId, secoes[0] ?? '', { codigos: [CODIGO_DO_6O] })
    expect(erroDe(acima)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    expect(acima.retryAfter).toBe(String(JANELA_DA_CLASSIFICACAO_MS / 1_000))
    expect((await corrigir(outra.base.coordenacao, doutraEscola.materialId, doutraEscola.secoes[0] ?? '', { codigos: [CODIGO_DO_6O] })).status).toBe(200)
  })

  it('o 101º pedido de reclassificar da pessoa e o 301º da escola recebem 429; o `PUT` segue livre (teto à parte)', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const colega = await bancada.sessao(escola.escolaId, 'coordenador')
    await registrosJaFeitos(escola.escolaId, escola.base.coordenacao.usuarioId, RECLASSIFICACOES_POR_USUARIO_NA_JANELA, 'material.reclassificado')

    const acima = await reclassificar(escola.base.coordenacao, materialId)
    expect(erroDe(acima)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    expect(acima.retryAfter).toBe(String(JANELA_DA_CLASSIFICACAO_MS / 1_000))
    expect((await corrigir(escola.base.coordenacao, materialId, secoes[0] ?? '', { codigos: [CODIGO_DO_6O] })).status).toBe(200)
    expect((await reclassificar(colega, materialId)).status).toBe(202)

    // A escola já tem os da primeira pessoa e o da colega; semeia até faltar um para o teto exato: o 300º passa, o 301º não.
    const jaFeitos = RECLASSIFICACOES_POR_USUARIO_NA_JANELA + 1
    const doadora = await bancada.sessao(escola.escolaId, 'coordenador')
    await registrosJaFeitos(escola.escolaId, doadora.usuarioId, RECLASSIFICACOES_POR_ESCOLA_NA_JANELA - 1 - jaFeitos, 'material.reclassificado')
    const trecentesima = await bancada.sessao(escola.escolaId, 'coordenador')
    expect((await reclassificar(trecentesima, materialId)).status).toBe(202)
    const trecentesimaEUma = await bancada.sessao(escola.escolaId, 'coordenador')
    const acimaDaEscola = await reclassificar(trecentesimaEUma, materialId)
    expect(erroDe(acimaDaEscola)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    expect(acimaDaEscola.retryAfter).toBe(String(JANELA_DA_CLASSIFICACAO_MS / 1_000))
  })
})

describe('GET /v1/habilidades-bncc', () => {
  it('o material: as candidatas do componente e das séries dele, na ordem do código; sem componente, `semComponente` e lista vazia', async () => {
    const escola = await escolaNova()
    const do6 = await materialNovo(escola)
    const do9 = await materialNovo(escola, { series: [escola.serie9] })
    const semComponente = await materialNovo(escola, { disciplinaId: escola.base.fisica })
    await sql('update disciplina set componente_bncc = null where id = $1', [escola.base.fisica])
    const codigosDe = async (materialId: string) => habilidadesBnccResponseSchema.parse((await get(escola.base.coordenacao, `/v1/habilidades-bncc?materialId=${materialId}`)).corpo)

    const lista6 = await codigosDe(do6.materialId)
    const lista9 = await codigosDe(do9.materialId)

    expect(lista6.semComponente).toBe(false)
    expect(lista6.itens.length).toBeGreaterThan(0)
    expect(lista6.itens.every(({ codigo }) => codigo.startsWith('EF06CI'))).toBe(true)
    expect(lista6.itens.map(({ codigo }) => codigo)).toEqual([...lista6.itens.map(({ codigo }) => codigo)].sort())
    expect(lista9.itens.every(({ codigo }) => codigo.startsWith('EF09CI'))).toBe(true)
    expect(await codigosDe(semComponente.materialId)).toEqual({ itens: [], semComponente: true })
    expect(await codigosDe((await materialNovo(escola, { series: [] })).materialId)).toEqual({ itens: [], semComponente: false })
  })

  it('`materialId` da B, material de disciplina sem vínculo, `artefatoId` da B e de colega: `NAO_ENCONTRADO` igual ao inexistente, um caso cada; os dois ids ou nenhum, `ENTRADA_INVALIDA`', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const daA = await materialNovo(a)
    const daB = await materialNovo(b)
    const professor = await professorDaDisciplina(a)
    const colega = await professorDaDisciplina(a)
    const artefatoDe = async (escola: Escola, autor: TestSessao): Promise<string> =>
      (
        await sql<{ id: string }>(
          `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por)
           values ($1, $2, $3, $4, 'atividade_objetiva', 'Atividade sintética', '{"tipo":"atividade_objetiva","questoes":[]}'::jsonb, $5) returning id`,
          [escola.escolaId, escola.base.anoLetivoId, escola.base.turma, escola.base.quimica, autor.usuarioId],
        )
      ).rows[0]?.id ?? ''
    const seu = await artefatoDe(a, professor)
    const doColega = await artefatoDe(a, colega)
    const daOutraEscola = await artefatoDe(b, b.base.coordenacao)
    const semVinculo = await bancada.sessao(a.escolaId, 'professor')
    const doSemVinculo = await artefatoDe(a, semVinculo)
    const aluno = await bancada.sessao(a.escolaId, 'aluno')
    const consulta = (sessao: TestSessao, query: string) => get(sessao, `/v1/habilidades-bncc?${query}`)

    const propria = habilidadesBnccResponseSchema.parse((await consulta(professor, `artefatoId=${seu}`)).corpo)
    expect(propria.itens.length).toBeGreaterThan(0)
    expect(propria.itens.every(({ codigo }) => codigo.startsWith('EM13CNT'))).toBe(true)
    expect((await consulta(professor, `materialId=${daA.materialId}`)).status).toBe(200)
    expect(erroDe(await consulta(a.base.coordenacao, `materialId=${daB.materialId}`))).toEqual(naoEncontrado)
    expect(erroDe(await consulta(a.base.coordenacao, `materialId=${randomUUID()}`))).toEqual(naoEncontrado)
    expect(erroDe(await consulta(semVinculo, `materialId=${daA.materialId}`))).toEqual(naoEncontrado)
    const soDeFisica = await professorDaDisciplina(a, a.base.fisica)
    expect(erroDe(await consulta(soDeFisica, `materialId=${daA.materialId}`))).toEqual(naoEncontrado)
    expect(erroDe(await consulta(semVinculo, `artefatoId=${doSemVinculo}`))).toEqual(naoEncontrado)
    expect(erroDe(await consulta(professor, `artefatoId=${doColega}`))).toEqual(naoEncontrado)
    expect(erroDe(await consulta(professor, `artefatoId=${daOutraEscola}`))).toEqual(naoEncontrado)
    expect(erroDe(await consulta(professor, `artefatoId=${randomUUID()}`))).toEqual(naoEncontrado)
    expect(erroDe(await consulta(aluno, `materialId=${daA.materialId}`))).toEqual(naoEncontrado)
    expect(erroDe(await consulta(a.base.coordenacao, `materialId=${daA.materialId}&artefatoId=${seu}`))).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
    expect(erroDe(await consulta(a.base.coordenacao, ''))).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
  })
})

describe('GET /v1/habilidades-bncc, o recorte do artefato', () => {
  it('é o da turma e da disciplina do próprio artefato: duas turmas de séries diferentes, a disciplina sem componente, e a professora que dá aula também na escola B', async () => {
    const a = await escolaNova()
    const professor = await professorDaDisciplina(a)
    const criada = await chamar(api.url, 'POST', '/v1/turmas', a.base.coordenacao.token, { serieId: a.serie6, nome: '6ºA' })
    expect(criada.status).toBe(201)
    const turma6 = criada.corpo['id'] as string
    await vincularProfessor(bancada, a.base, professor.usuarioId, turma6, a.base.quimica)
    await vincularProfessor(bancada, a.base, professor.usuarioId, a.base.turma, a.base.fisica)
    await sql('update disciplina set componente_bncc = null where id = $1', [a.base.fisica])
    const doSexto = await artefatoNovo(a, professor.usuarioId, turma6, a.base.quimica)
    const doMedio = await artefatoNovo(a, professor.usuarioId, a.base.turma, a.base.quimica)
    const deFisica = await artefatoNovo(a, professor.usuarioId, a.base.turma, a.base.fisica)
    const candidatas = async (artefatoId: string) => habilidadesBnccResponseSchema.parse((await get(professor, `/v1/habilidades-bncc?artefatoId=${artefatoId}`)).corpo)

    const sexto = await candidatas(doSexto)
    const medio = await candidatas(doMedio)

    expect(sexto.semComponente).toBe(false)
    expect(sexto.itens.length).toBeGreaterThan(0)
    expect(sexto.itens.every(({ codigo }) => codigo.startsWith('EF06CI'))).toBe(true)
    expect(medio.itens.length).toBeGreaterThan(0)
    expect(medio.itens.every(({ codigo }) => codigo.startsWith('EM13CNT'))).toBe(true)
    expect(await candidatas(deFisica)).toEqual({ itens: [], semComponente: true })

    const contaId = (await sql<{ id: string }>('insert into conta (email) values ($1) returning id', [`professora-${randomUUID()}@exemplo.invalid`])).rows[0]?.id ?? ''
    await sql('update usuario set conta_id = $1 where id = $2', [contaId, professor.usuarioId])
    const b = await escolaNova()
    await bancada.sessaoDaMesmaConta(professor.usuarioId, b.escolaId)
    const emB = (await sql<{ id: string }>('select id from usuario where escola_id = $1 and conta_id = $2', [b.escolaId, contaId])).rows[0]?.id ?? ''
    await vincularProfessor(bancada, b.base, emB, b.base.turma, b.base.quimica)
    const doProfessorEmB = await artefatoNovo(b, emB, b.base.turma, b.base.quimica)
    expect(erroDe(await get(professor, `/v1/habilidades-bncc?artefatoId=${doProfessorEmB}`))).toEqual(naoEncontrado)
  })
})

describe('[P] corridas da correção e do reclassificar', () => {
  it('P1b, a correção × o `concluir` que ainda não confirmou: a correção espera a trava da seção e aplica por cima; o "antes" da auditoria são os códigos da IA', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const secaoId = secoes[0] ?? ''
    const execucaoId = await execucaoNaSecao(escola, secoes, 'rodando')
    // `before`: o `concluir` já leu a seção e ainda não tomou nenhuma trava de linha dela (o `for key share` da chave estrangeira só vem com a linha); só o `for update` da leitura segura a correção.
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'habilidade_da_secao', evento: 'insert', momento: 'before', quando: `new.secao_id = '${secaoId}'::uuid` })
    await parada.armar()
    let correcao: Promise<RespostaHttp>
    try {
      const concluir = naEscola(escola.escolaId, () => bancoDaApi().transaction((tx) => new SecoesRepository(tx).saveClassificacao(execucaoId, [{ secaoId, codigos: ['EF06CI02'] }])))
      await parada.esperarParadas(1)
      correcao = corrigir(escola.base.coordenacao, materialId, secaoId, { codigos: [CODIGO_DO_6O] })
      await esperarNaTrava(bancada.pool, '%"secao_do_material"%for update%')
      await parada.soltar()
      await concluir
    } finally {
      await parada.desarmar()
    }

    expect((await correcao).status).toBe(200)
    expect(await habilidadesDa(secaoId)).toEqual([{ codigo: CODIGO_DO_6O, origem: 'coordenacao' }])
    const [auditoria] = await auditoriaDa(bancada, escola.escolaId, 'material.classificacao_corrigida')
    expect(auditoria?.antes).toEqual({ secaoId, habilidades: ['EF06CI02'] })
  })

  it('P2, o reclassificar troca o `execucao_id`: a execução antiga conclui sem efeito e fica o que a nova gravou', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const secaoId = secoes[0] ?? ''
    const antiga = await execucaoNaSecao(escola, secoes, 'rodando')
    expect((await reclassificar(escola.base.coordenacao, materialId)).status).toBe(202)
    const nova = (await secaoDe(secaoId)).execucao_id ?? ''
    expect(nova).not.toBe(antiga)
    const gravar = (execucaoId: string, codigo: string) => naEscola(escola.escolaId, () => bancoDaApi().transaction((tx) => new SecoesRepository(tx).saveClassificacao(execucaoId, [{ secaoId, codigos: [codigo] }])))

    expect(await gravar(nova, 'EF06CI02')).toHaveLength(1)
    expect(await gravar(antiga, 'EF06CI03')).toHaveLength(0)

    expect(await habilidadesDa(secaoId)).toEqual([{ codigo: 'EF06CI02', origem: 'ia' }])
    expect((await secaoDe(secaoId)).execucao_id).toBe(nova)
  })

  it('P3, dois reclassificar com a ordem forçada: o primeiro para dentro da trava da seção, o segundo espera e então vê a execução `pendente` e não cria outra', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    await secaoClassificada(escola, secoes)
    const colega = await bancada.sessao(escola.escolaId, 'coordenador')
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'insert', quando: `new.escola_id = '${escola.escolaId}'::uuid` })
    await parada.armar()
    let primeira: Promise<RespostaHttp>
    let segunda: Promise<RespostaHttp>
    try {
      primeira = reclassificar(escola.base.coordenacao, materialId)
      await parada.esperarParadas(1)
      segunda = reclassificar(colega, materialId)
      await esperarNaTrava(bancada.pool, '%"secao_do_material"%for update%')
      await parada.soltar()
      await Promise.all([primeira, segunda])
    } finally {
      await parada.desarmar()
    }

    expect([(await primeira).status, (await segunda).status]).toEqual([202, 202])
    expect(await execucoesDaEscola(escola.escolaId)).toBe(2)
    expect([reclassificarResponseSchema.parse((await primeira).corpo).secoes, reclassificarResponseSchema.parse((await segunda).corpo).secoes]).toEqual([1, 1])
  })

  it('P5, duas correções: a segunda espera a trava e as duas auditorias ficam em cadeia (o "antes" da segunda é o "depois" da primeira)', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola)
    const secaoId = secoes[0] ?? ''
    await secaoClassificada(escola, secoes, 'EF06CI02')
    const colega = await bancada.sessao(escola.escolaId, 'coordenador')
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'habilidade_da_secao', evento: 'insert', quando: `new.secao_id = '${secaoId}'::uuid and new.origem = 'coordenacao'` })
    await parada.armar()
    let primeira: Promise<RespostaHttp>
    let segunda: Promise<RespostaHttp>
    try {
      primeira = corrigir(escola.base.coordenacao, materialId, secaoId, { codigos: [CODIGO_DO_6O] })
      await parada.esperarParadas(1)
      segunda = corrigir(colega, materialId, secaoId, { codigos: ['EF06CI03'] })
      await esperarNaTrava(bancada.pool, '%"secao_do_material"%for update%')
      await parada.soltar()
      await Promise.all([primeira, segunda])
    } finally {
      await parada.desarmar()
    }

    expect([(await primeira).status, (await segunda).status]).toEqual([200, 200])
    const auditorias = await auditoriaDa(bancada, escola.escolaId, 'material.classificacao_corrigida')
    expect(auditorias.map(({ antes, depois }) => [antes, depois])).toEqual([
      [
        { secaoId, habilidades: ['EF06CI02'] },
        { secaoId, habilidades: [CODIGO_DO_6O] },
      ],
      [
        { secaoId, habilidades: [CODIGO_DO_6O] },
        { secaoId, habilidades: ['EF06CI03'] },
      ],
    ])
    expect(await habilidadesDa(secaoId)).toEqual([{ codigo: 'EF06CI03', origem: 'coordenacao' }])
  })

  it('P9, a rotina × o reclassificar numa seção `nao_classificada`: a rotina leu a seção antes, o reclassificar a agenda, e o agendamento da rotina não cria outra execução', async () => {
    const escola = await escolaNova()
    const { materialId, secoes } = await materialNovo(escola, { series: [escola.serie9] })
    await execucaoNaSecao(escola, secoes, 'falhou', 1)
    const lidas: SecaoParaAgendar[] = await naEscola(escola.escolaId, () => bancoDaApi().transaction((tx) => new AgendamentoDaClassificacaoRepository(tx).proximasSecoes(10, { materialId })))
    expect(lidas).toHaveLength(1)
    expect((await reclassificar(escola.base.coordenacao, materialId)).status).toBe(202)
    const doReclassificar = (await secaoDe(secoes[0] ?? '')).execucao_id

    const agendado = await naEscola(escola.escolaId, () => bancoDaApi().transaction((tx) => new AgendamentoDaClassificacaoRepository(tx).agendar(lidas, enfileirador)))

    expect(agendado.execucoes).toBe(0)
    expect((await secaoDe(secoes[0] ?? '')).execucao_id).toBe(doReclassificar)
    expect(await execucoesDaEscola(escola.escolaId)).toBe(2)
  })
})

describe('o comando reclassificar-escola (D76)', () => {
  const pedidoDe = (escola: Escola, chamado = 4711) => ({ escolaId: escola.escolaId, chamado })
  const secaoN = (material: { secoes: string[] }, indice: number): string => material.secoes[indice] ?? ''
  const semSinal = { aborted: false }

  it('reclassifica só a escola dada: as não corrigidas ganham execução, a correção fica, as falhas zeram, e `escola.reclassificada` leva o chamado e as contagens, sem texto', async () => {
    const escola = await escolaNova()
    const outra = await escolaNova()
    const a = await materialNovo(escola, { secoes: 2 })
    const doutroMaterial = await materialNovo(escola)
    const daOutra = await materialNovo(outra)
    const processando = await materialNovo(escola, { estado: 'processando' })
    const excluido = await materialNovo(escola)
    await sql('update material set excluido_em = now(), excluido_por = $2 where id = $1', [excluido.materialId, escola.base.coordenacao.usuarioId])
    const semComponente = await materialNovo(escola, { disciplinaId: escola.base.fisica })
    await sql('update disciplina set componente_bncc = null where id = $1', [escola.base.fisica])
    await execucaoNaSecao(escola, [secaoN(a, 0)], 'falhou', 3)
    await secaoClassificada(escola, doutroMaterial.secoes)
    await secaoClassificada(escola, [secaoN(a, 1)])
    expect((await corrigir(escola.base.coordenacao, a.materialId, secaoN(a, 1), { codigos: ['EF06CI05'] })).status).toBe(200)

    const resultado = await reclassificarEscola(bancoDaApi(), autorDaBancada, pedidoDe(escola), semSinal)

    expect(resultado).toEqual({ estado: 'fim', lotes: 1, execucoes: 1, secoes: 2 })
    expect((await secaoDe(secaoN(a, 0))).falhas_seguidas).toBe(0)
    expect((await secaoDe(secaoN(a, 0))).execucao_id).toBe((await secaoDe(secaoN(doutroMaterial, 0))).execucao_id)
    expect(await habilidadesDa(secaoN(a, 1))).toEqual([{ codigo: 'EF06CI05', origem: 'coordenacao' }])
    expect((await secaoDe(secaoN(daOutra, 0))).execucao_id).toBeNull()
    for (const fora of [processando, excluido, semComponente]) expect((await secaoDe(secaoN(fora, 0))).execucao_id, 'material que não está pronto, excluído ou sem componente fica como está').toBeNull()
    expect(await execucoesDaEscola(outra.escolaId)).toBe(0)
    const [auditoria] = await sql<{ entidade_id: string; autor_operador: string | null; autor_usuario_id: string | null; depois: unknown }>(
      "select entidade_id, autor_operador, autor_usuario_id, depois from auditoria where escola_id = $1 and acao = 'escola.reclassificada'",
      [escola.escolaId],
    ).then((r) => r.rows)
    expect(auditoria).toEqual({ entidade_id: escola.escolaId, autor_operador: await autorDaBancada(), autor_usuario_id: null, depois: { chamado: 4711, secoes: 2, execucoes: 1 } })
    expect(JSON.stringify(auditoria)).not.toContain('Apostila sigilosa')
    expect(await auditoriaDa(bancada, outra.escolaId, 'escola.reclassificada')).toEqual([])
  })

  it('com a função suspensa na escola recusa (`FUNCAO_SUSPENSA`) e não toca nada; escola inexistente, `NAO_ENCONTRADO`', async () => {
    const escola = await escolaNova()
    const { secoes } = await materialNovo(escola)
    expect((await chamar(api.url, 'POST', '/v1/governanca/funcoes/classificacao_do_material/suspender', escola.base.coordenacao.token, {})).status).toBe(200)

    await expect(reclassificarEscola(bancoDaApi(), autorDaBancada, pedidoDe(escola), semSinal)).rejects.toMatchObject({ codigo: ErrorCode.FUNCAO_SUSPENSA })
    await expect(reclassificarEscola(bancoDaApi(), autorDaBancada, { escolaId: randomUUID(), chamado: 1 }, semSinal)).rejects.toMatchObject({ codigo: ErrorCode.NAO_ENCONTRADO })

    expect((await secaoDe(secoes[0] ?? '')).execucao_id).toBeNull()
    expect(await execucoesDaEscola(escola.escolaId)).toBe(0)
    expect(await auditoriaDa(bancada, escola.escolaId, 'escola.reclassificada')).toEqual([])
  })

  it('a função suspensa entre dois lotes: o comando para com `FUNCAO_SUSPENSA`, e só o primeiro lote deixou execução e auditoria', async () => {
    const escola = await escolaNova()
    const { secoes } = await materialNovo(escola, { secoes: 4 })
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'auditoria', evento: 'insert', quando: `new.escola_id = '${escola.escolaId}'::uuid and new.acao = 'escola.reclassificada'` })
    await parada.armar()
    let desfecho: unknown
    try {
      const comando = reclassificarEscola(bancoDaApi(), autorDaBancada, pedidoDe(escola), semSinal, 2).catch((erro: unknown) => erro)
      await parada.esperarParadas(1)
      expect((await chamar(api.url, 'POST', '/v1/governanca/funcoes/classificacao_do_material/suspender', escola.base.coordenacao.token, {})).status).toBe(200)
      await parada.soltar()
      desfecho = await comando
    } finally {
      await parada.desarmar()
    }

    expect(desfecho).toMatchObject({ codigo: ErrorCode.FUNCAO_SUSPENSA })
    expect((await Promise.all(secoes.map(secaoDe))).filter((secao) => secao.execucao_id !== null)).toHaveLength(2)
    expect(await execucoesDaEscola(escola.escolaId)).toBe(1)
    expect((await auditoriaDa(bancada, escola.escolaId, 'escola.reclassificada')).length).toBe(1)
  })

  it('o comando de ponta a ponta: 0 com a contagem, 2 com `--chamado` ausente, 1 com escola inexistente ou função suspensa, e só o código tipado na saída', async () => {
    const escola = await escolaNova()
    await materialNovo(escola, { secoes: 2 })
    const abrir = () => ({ banco: bancoDaApi(), close: async () => undefined })
    const rodar = async (argumentos: string[]) => {
      let saida = ''
      let erro = ''
      const codigo = await runOpsReclassificarEscola(argumentos, { OPERADOR: PESSOA_DA_BANCADA }, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) }, abrir)
      return { codigo, saida, erro }
    }

    const feito = await rodar(['--escola', escola.escolaId, '--chamado', '4711'])
    expect(feito.codigo).toBe(0)
    expect(JSON.parse(feito.saida)).toEqual({ estado: 'fim', lotes: 1, execucoes: 1, secoes: 2, chamado: 4711 })
    expect(await rodar(['--escola', escola.escolaId])).toMatchObject({ codigo: 2, saida: '' })
    expect(await rodar(['--escola', randomUUID(), '--chamado', '4711'])).toEqual({ codigo: 1, saida: '', erro: `${ErrorCode.NAO_ENCONTRADO}\n` })
    expect((await chamar(api.url, 'POST', '/v1/governanca/funcoes/classificacao_do_material/suspender', escola.base.coordenacao.token, {})).status).toBe(200)
    expect(await rodar(['--escola', escola.escolaId, '--chamado', '4711'])).toEqual({ codigo: 1, saida: '', erro: `${ErrorCode.FUNCAO_SUSPENSA}\n` })
  })

  it('em lotes: cada lote numa transação, para no sinal entre dois lotes e, rodado de novo, termina sem repetir execução', async () => {
    const escola = await escolaNova()
    const { secoes } = await materialNovo(escola, { secoes: 5 })
    let consultas = 0
    const aposUmLote = {
      get aborted(): boolean {
        consultas += 1
        return consultas > 1
      },
    }

    const primeira = await reclassificarEscola(bancoDaApi(), autorDaBancada, pedidoDe(escola), aposUmLote, 2)

    expect(primeira).toEqual({ estado: 'sinal', lotes: 1, execucoes: 1, secoes: 2 })
    expect((await auditoriaDa(bancada, escola.escolaId, 'escola.reclassificada')).length).toBe(1)
    expect((await Promise.all(secoes.map(secaoDe))).filter((secao) => secao.execucao_id !== null)).toHaveLength(2)

    const segunda = await reclassificarEscola(bancoDaApi(), autorDaBancada, pedidoDe(escola), semSinal, 2)

    expect(segunda.estado).toBe('fim')
    expect(segunda.secoes).toBe(3)
    expect((await Promise.all(secoes.map(secaoDe))).every((secao) => secao.execucao_id !== null)).toBe(true)
    expect(await execucoesDaEscola(escola.escolaId)).toBe(1 + segunda.execucoes)
  })
})
