import { runInContext } from '@educa/core'
import { coberturaResponseSchema, ErrorCode, type CoberturaResponse, type GrupoDaCoberturaResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DB } from '../src/database.module.js'
import { CoberturaRepository } from '../src/material/cobertura.repository.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-turma.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'
import type { Database } from '@educa/core'

/**
 * A coordenação vê, por série, as habilidades da BNCC que nenhum material em uso cobre (classificacao-bncc, 13.0; RF19 e RF20; `techspec.md` §4, §5 "Cobertura" e "Suspensão", §7c; `cenarios.md` "Cobertura (RF19)",
 * "Permissão e isolamento", "Seções e agendamento" e "Carga"). A API é a de verdade e nenhum teste chama modelo: o material, as seções, as execuções e as habilidades são gravados direto no banco (apostilas sintéticas, sem
 * PDF no storage). A cobertura é lida pela rota, com o contrato estrito.
 */
const bancada = new SessaoFixtures()
const medidor = new MedidorDeTeste()
const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)
const bancoDaApi = (): Database => api.app.get<Database>(DB)
let api: TestApi
const escolasDoTeste: string[] = []

/** Um código só do 6º, um só do 7º, um do 6º ao 9º (LP), e um do Médio de cada área que o teste usa. */
const CI_6 = 'EF06CI01'
const CI_7 = 'EF07CI01'
const CI_7_OUTRA = 'EF07CI02'
const LP_69 = 'EF69LP01'
const CNT_EM = 'EM13CNT101'
const MAT_EM = 'EM13MAT101'
const LP_EM = 'EM13LP01'

interface Escola {
  readonly base: EscolaComTurma
  readonly escolaId: string
  readonly serie6: string
  readonly serie7: string
  /** A disciplina de Língua Portuguesa (nasce com o componente) e a de Matemática. */
  readonly portugues: string
  readonly matematica: string
}

/** A escola montada pela API, com o 6º e o 7º do Fundamental além do 2º do Médio. Química e Física (do Médio) nascem com componente, e Língua Portuguesa e Matemática também. */
async function escolaNova(): Promise<Escola> {
  const base = await montarEscolaComTurma(api, bancada)
  const escolaId = base.coordenacao.escolaId
  escolasDoTeste.push(escolaId)
  const criar = async (caminho: string, corpo: unknown): Promise<string> => {
    const criada = await chamar(api.url, 'POST', caminho, base.coordenacao.token, corpo)
    expect(criada.status).toBe(201)
    return criada.corpo['id'] as string
  }
  return {
    base,
    escolaId,
    serie6: await criar('/v1/series', { etapa: 'ef_anos_finais', ano: 6 }),
    serie7: await criar('/v1/series', { etapa: 'ef_anos_finais', ano: 7 }),
    portugues: await criar('/v1/disciplinas', { nome: 'Língua Portuguesa' }),
    matematica: await criar('/v1/disciplinas', { nome: 'Matemática' }),
  }
}

type EstadoDaExecucao = 'pendente' | 'rodando' | 'concluida' | 'falhou'

interface Cobrindo {
  readonly disciplinaId: string
  readonly series: readonly string[]
  readonly codigos: readonly string[]
  /** `ia`: a execução concluiu e a IA pôs os códigos. `coordenacao`: a seção foi corrigida. */
  readonly origem?: 'ia' | 'coordenacao'
  readonly estado?: 'pronto' | 'processando' | 'falhou'
  /** A execução da seção: `concluida` por padrão, quando a origem é `ia`. */
  readonly execucao?: EstadoDaExecucao | null
  readonly licencaVencida?: boolean
}

async function inserirMaterial(escola: Escola, disciplinaId: string, estado: string, licencaId: string | null = null): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, licenca_id, declaracao, sha256, tamanho_bytes, estado, falha, paginas, enviado_em)
     values ($1, $2, 'Apostila sigilosa', case when $4::uuid is null then 'escola' else 'terceiro_com_licenca' end, case when $4::uuid is null then 'autoria_da_escola' else 'licenca_comercial_autorizada' end, $4::uuid, true,
             md5(random()::text) || md5(random()::text), 1000, $3, case when $3 = 'falhou' then 'sem_texto' end, case when $3 = 'pronto' then 1 end, now() - interval '3 hours') returning id`,
    [escola.escolaId, disciplinaId, estado, licencaId],
  )
  return rows[0]?.id ?? ''
}

async function execucao(escolaId: string, estado: EstadoDaExecucao): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, resultado, iniciada_em, concluida_em)
     values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, '{"tarefa":"classificar_secoes"}'::jsonb, $3::text, $4,
             case when $3::text = 'concluida' then '{"tipo":"classificacao_do_material","secoes":1}'::jsonb end,
             case when $3::text in ('rodando', 'concluida', 'falhou') then now() end, case when $3::text in ('concluida', 'falhou') then now() end) returning id`,
    [escolaId, randomUUID(), estado, estado === 'falhou' ? 'IA_SAIDA_INVALIDA' : null],
  )
  return rows[0]?.id ?? ''
}

/** Uma licença vencida em 2020, da escola: o material que a cita já não pode ser usado. */
async function licencaVencida(escola: Escola): Promise<string | null> {
  const { rows } = await sql<{ id: string }>(
    "insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde, vigente_ate) values ($1, 'Editora sintética', 'Apostilas sintéticas', 'contrato 1', '2019-01-01', '2020-12-31') returning id",
    [escola.escolaId],
  )
  return rows[0]?.id ?? null
}

/** A execução da seção: a pedida; sem pedido, a `concluida` da IA, e nenhuma na seção que a coordenação corrigiu. */
function estadoDaExecucao(opcoes: Cobrindo): EstadoDaExecucao | null {
  if (opcoes.execucao !== undefined) return opcoes.execucao
  return (opcoes.origem ?? 'ia') === 'ia' ? 'concluida' : null
}

/**
 * Um material de uma seção só, declarado para as séries dadas, cuja seção tem os códigos pedidos. Por padrão: pronto, com a execução `concluida` e a IA como origem; com `origem: 'coordenacao'` a seção é corrigida.
 * Devolve o id do material e o da seção.
 */
async function materialCobrindo(escola: Escola, opcoes: Cobrindo): Promise<{ materialId: string; secaoId: string }> {
  const licencaId = opcoes.licencaVencida === true ? await licencaVencida(escola) : null
  const materialId = await inserirMaterial(escola, opcoes.disciplinaId, opcoes.estado ?? 'pronto', licencaId)
  for (const serieId of opcoes.series) await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escola.escolaId, materialId, serieId])
  const secao = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, 1, 1, 1) returning id', [escola.escolaId, materialId])
  const secaoId = secao.rows[0]?.id ?? ''
  const origem = opcoes.origem ?? 'ia'
  const estado = estadoDaExecucao(opcoes)
  if (estado !== null) await sql('update secao_do_material set execucao_id = $1 where id = $2', [await execucao(escola.escolaId, estado), secaoId])
  for (const codigo of opcoes.codigos) await sql('insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, $4)', [escola.escolaId, secaoId, codigo, origem])
  if (origem === 'coordenacao') await sql('update secao_do_material set corrigida_em = now() where id = $1', [secaoId])
  return { materialId, secaoId }
}

/** Uma seção a mais num material, sem código, na execução dada (nenhuma: `null`). A `ordem` e as páginas seguem a do material. */
async function secaoSemCodigo(escola: Escola, materialId: string, ordem: number, estado: EstadoDaExecucao | null): Promise<string> {
  const secao = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3::smallint, $3::int, $3::int) returning id', [escola.escolaId, materialId, ordem])
  const id = secao.rows[0]?.id ?? ''
  if (estado !== null) await sql('update secao_do_material set execucao_id = $1 where id = $2', [await execucao(escola.escolaId, estado), id])
  return id
}

const get = (sessao: Pick<TestSessao, 'token'>, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)
const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
const naoEncontrado = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }

/** A cobertura como a coordenação a lê: 200 e o contrato inteiro, que é estrito. */
async function coberturaDe(escola: Escola, serieId: string): Promise<CoberturaResponse> {
  const resposta = await get(escola.base.coordenacao, `/v1/materiais/cobertura?serieId=${serieId}`)
  expect(resposta.status).toBe(200)
  return coberturaResponseSchema.parse(resposta.corpo)
}

function grupoDe(cobertura: CoberturaResponse, chave: string): GrupoDaCoberturaResponse {
  const grupo = cobertura.grupos.find((candidato) => candidato.chave === chave)
  if (grupo === undefined) throw new Error(`o grupo ${chave} não está na cobertura`)
  return grupo
}
const faltam = (cobertura: CoberturaResponse, chave: string): string[] => grupoDe(cobertura, chave).semMaterial.map((habilidade) => habilidade.codigo)

beforeAll(async () => {
  api = await subirApi(medidor.medidor, {}, undefined, TEST_APP_OPTIONS)
})

afterAll(async () => {
  await api.app.close()
  await bancada.fechar()
  await medidor.encerrar()
})

describe('GET /v1/materiais/cobertura: o que nenhum material em uso cobre', () => {
  it('a série sem material lista todas as habilidades dela; o material que a cobre as tira, e com dois materiais, excluído um a outra a cobre, e excluídos os dois a habilidade volta', async () => {
    const escola = await escolaNova()
    const vazia = await coberturaDe(escola, escola.serie7)
    const ciencias = grupoDe(vazia, 'ciencias')
    expect(ciencias.semMaterial).toHaveLength(ciencias.total)
    expect(ciencias.total).toBeGreaterThan(1)
    expect(ciencias.semMaterial[0]).toEqual({ codigo: 'EF07CI01', descricao: expect.any(String) })
    // A ordem da resposta é a dos nomes que a tela mostra, em `pt-BR`, e não a da leitura das habilidades.
    expect(vazia.grupos.map((grupo) => grupo.chave)).toEqual(['arte', 'ciencias', 'educacao_fisica', 'ensino_religioso', 'geografia', 'historia', 'lingua_inglesa', 'lingua_portuguesa', 'matematica'])

    const { materialId } = await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })
    const coberta = await coberturaDe(escola, escola.serie7)
    expect(faltam(coberta, 'ciencias')).not.toContain(CI_7)
    expect(grupoDe(coberta, 'ciencias').total).toBe(ciencias.total)
    expect(grupoDe(coberta, 'ciencias').semMaterial).toHaveLength(ciencias.total - 1)

    // Dois materiais cobrem o mesmo código: excluído um, o outro ainda o cobre; só com os dois excluídos a habilidade volta.
    const { materialId: segundo } = await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })
    expect((await chamar(api.url, 'DELETE', `/v1/materiais/${materialId}`, escola.base.coordenacao.token)).status).toBe(204)
    expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias')).not.toContain(CI_7)

    expect((await chamar(api.url, 'DELETE', `/v1/materiais/${segundo}`, escola.base.coordenacao.token)).status).toBe(204)
    expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias')).toContain(CI_7)
  })

  it('o material de que a escola ainda não pode ou não deve se valer não cobre, um por vez: licença vencida, `processando`, `falhou`, substituído e seção `aguardando`', async () => {
    const escola = await escolaNova()
    const nao: Array<[string, Cobrindo]> = [
      ['licença vencida', { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], licencaVencida: true }],
      ['processando', { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], estado: 'processando' }],
      ['falhou', { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], estado: 'falhou' }],
      ['seção aguardando (execução pendente com o código de antes)', { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], execucao: 'pendente' }],
      ['seção aguardando (execução rodando)', { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], execucao: 'rodando' }],
      ['seção cuja última execução falhou', { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], execucao: 'falhou' }],
    ]
    for (const [motivo, opcoes] of nao) {
      const { materialId } = await materialCobrindo(escola, opcoes)
      expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias'), motivo).toContain(CI_7)
      await sql('update material set excluido_em = now() where id = $1', [materialId])
    }
    const anterior = (await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })).materialId
    expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias')).not.toContain(CI_7)
    const edicao = await inserirMaterial(escola, escola.base.quimica, 'processando')
    // A extração da edição marca, na mesma transação, o `substituido_por` e o `excluido_em` do material anterior.
    await sql('update material set substituido_por = $1, excluido_em = now() where id = $2', [edicao, anterior])
    expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias'), 'substituído').toContain(CI_7)
  })

  it('`materiaisEmUso` conta só o material em uso da série: o `pronto`, não excluído, de licença vigente e declarado para ela', async () => {
    const escola = await escolaNova()
    expect((await coberturaDe(escola, escola.serie7)).materiaisEmUso).toBe(0)
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })
    await materialCobrindo(escola, { disciplinaId: escola.portugues, series: [escola.serie6, escola.serie7], codigos: [LP_69] })
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie6], codigos: [CI_6] })
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], estado: 'processando' })
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], licencaVencida: true })
    const { materialId } = await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })
    await sql('update material set excluido_em = now() where id = $1', [materialId])

    expect((await coberturaDe(escola, escola.serie7)).materiaisEmUso).toBe(2)
    expect((await coberturaDe(escola, escola.serie6)).materiaisEmUso).toBe(2)
  })

  it('o material em uso e o que não está em uso na mesma escola: cada habilidade e cada seção é do material dela', async () => {
    const escola = await escolaNova()
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })
    const processando = await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7_OUTRA], estado: 'processando' })
    await secaoSemCodigo(escola, processando.materialId, 2, null)

    const cobertura = await coberturaDe(escola, escola.serie7)

    expect(faltam(cobertura, 'ciencias')).not.toContain(CI_7)
    // O código do material que ainda processa não passa a cobrir só porque há outro material em uso na escola, e a seção dele não conta como sem classificação.
    expect(faltam(cobertura, 'ciencias')).toContain(CI_7_OUTRA)
    expect(grupoDe(cobertura, 'ciencias').secoesSemClassificacao).toBe(0)
  })

  it('o material de licença vigente cobre; o próprio da escola cobre sem licença', async () => {
    const escola = await escolaNova()
    const { rows } = await sql<{ id: string }>(
      "insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde, vigente_ate) values ($1, 'Editora sintética', 'Apostilas sintéticas', 'contrato 1', '2020-01-01', null) returning id",
      [escola.escolaId],
    )
    const materialId = await inserirMaterial(escola, escola.base.quimica, 'pronto', rows[0]?.id ?? null)
    await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escola.escolaId, materialId, escola.serie7])
    const secao = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, 1, 1, 1) returning id', [escola.escolaId, materialId])
    await sql('update secao_do_material set execucao_id = $1 where id = $2', [await execucao(escola.escolaId, 'concluida'), secao.rows[0]?.id])
    await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')", [escola.escolaId, secao.rows[0]?.id, CI_7])
    await materialCobrindo(escola, { disciplinaId: escola.portugues, series: [escola.serie7], codigos: [LP_69] })

    const cobertura = await coberturaDe(escola, escola.serie7)

    expect(faltam(cobertura, 'ciencias')).not.toContain(CI_7)
    expect(faltam(cobertura, 'lingua_portuguesa')).not.toContain(LP_69)
  })

  it('a seção que não terminou conta em `secoesSemClassificacao` do componente do material: sem execução, à espera da noite e a que falhou; a classificada e a corrigida não', async () => {
    const escola = await escolaNova()
    const { materialId } = await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })
    await secaoSemCodigo(escola, materialId, 2, null)
    await secaoSemCodigo(escola, materialId, 3, 'pendente')
    await secaoSemCodigo(escola, materialId, 4, 'rodando')
    await secaoSemCodigo(escola, materialId, 5, 'falhou')
    await secaoSemCodigo(escola, materialId, 6, 'concluida')
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], origem: 'coordenacao' })
    // O material de Física também é de Ciências no Fundamental, e a seção dele soma com as da Química.
    const fisica = await materialCobrindo(escola, { disciplinaId: escola.base.fisica, series: [escola.serie7], codigos: [CI_7] })
    await secaoSemCodigo(escola, fisica.materialId, 2, 'pendente')
    // O material de Português tem uma seção sem classificação, e cai no grupo dele.
    const portugues = await materialCobrindo(escola, { disciplinaId: escola.portugues, series: [escola.serie7], codigos: [LP_69] })
    await secaoSemCodigo(escola, portugues.materialId, 2, 'pendente')
    // O material de outra série não entra na conta desta.
    const doSexto = await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie6], codigos: [CI_6] })
    await secaoSemCodigo(escola, doSexto.materialId, 2, null)

    const cobertura = await coberturaDe(escola, escola.serie7)

    expect(grupoDe(cobertura, 'ciencias').secoesSemClassificacao).toBe(5)
    expect(grupoDe(cobertura, 'lingua_portuguesa').secoesSemClassificacao).toBe(1)
    expect(grupoDe(cobertura, 'matematica').secoesSemClassificacao).toBe(0)
  })

  it('`EF69LP01` num material só do 6º não cobre o 7º, e o material do 6º ao 9º o cobre em cada uma', async () => {
    const escola = await escolaNova()
    await materialCobrindo(escola, { disciplinaId: escola.portugues, series: [escola.serie6], codigos: [LP_69, 'EF06LP01'] })

    expect(faltam(await coberturaDe(escola, escola.serie6), 'lingua_portuguesa')).not.toContain(LP_69)
    const doSetimo = await coberturaDe(escola, escola.serie7)
    expect(faltam(doSetimo, 'lingua_portuguesa')).toContain(LP_69)
    expect(faltam(doSetimo, 'lingua_portuguesa')).not.toContain('EF06LP01')
    expect(grupoDe(doSetimo, 'lingua_portuguesa').semMaterial.map((habilidade) => habilidade.codigo)).not.toContain('EF06LP01')
  })

  it('o material de duas séries cobre nas duas', async () => {
    const escola = await escolaNova()
    await materialCobrindo(escola, { disciplinaId: escola.portugues, series: [escola.serie6, escola.serie7], codigos: [LP_69] })

    expect(faltam(await coberturaDe(escola, escola.serie6), 'lingua_portuguesa')).not.toContain(LP_69)
    expect(faltam(await coberturaDe(escola, escola.serie7), 'lingua_portuguesa')).not.toContain(LP_69)
  })

  it('o material do Fundamental e do Médio juntos cobre cada série pelo código do recorte dela, e só por ele', async () => {
    const escola = await escolaNova()
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7, escola.base.serieId], codigos: [CI_7, CNT_EM] })

    const no7 = grupoDe(await coberturaDe(escola, escola.serie7), 'ciencias')
    const noMedio = grupoDe(await coberturaDe(escola, escola.base.serieId), 'ciencias_da_natureza')
    // Cada série perde exatamente a habilidade do recorte dela: o código da outra etapa, que o mesmo material traz, não entra na conta de nenhuma.
    expect(no7.semMaterial.map((habilidade) => habilidade.codigo)).not.toContain(CI_7)
    expect(no7.semMaterial).toHaveLength(no7.total - 1)
    expect(noMedio.semMaterial.map((habilidade) => habilidade.codigo)).not.toContain(CNT_EM)
    expect(noMedio.semMaterial).toHaveLength(noMedio.total - 1)
  })

  it('no Médio a cobertura é por área, e o código da Língua Portuguesa cai em Linguagens', async () => {
    const escola = await escolaNova()
    const vazia = await coberturaDe(escola, escola.base.serieId)
    expect(vazia.etapa).toBe('em')
    expect(vazia.grupos.map((grupo) => grupo.chave)).toEqual(['ciencias_da_natureza', 'ciencias_humanas', 'linguagens', 'matematica'])
    expect(vazia.grupos.reduce((soma, grupo) => soma + grupo.total, 0)).toBe(183)

    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.base.serieId], codigos: [CNT_EM] })
    await materialCobrindo(escola, { disciplinaId: escola.portugues, series: [escola.base.serieId], codigos: [LP_EM] })
    // Matemática com um código de Linguagens: não é do recorte dela, e não cobre.
    await materialCobrindo(escola, { disciplinaId: escola.matematica, series: [escola.base.serieId], codigos: [MAT_EM, 'EM13LGG101'] })
    const coberta = await coberturaDe(escola, escola.base.serieId)

    expect(faltam(coberta, 'ciencias_da_natureza')).not.toContain(CNT_EM)
    expect(faltam(coberta, 'linguagens')).not.toContain(LP_EM)
    expect(faltam(coberta, 'linguagens')).toContain('EM13LGG101')
    expect(faltam(coberta, 'matematica')).not.toContain(MAT_EM)
    expect(grupoDe(coberta, 'ciencias_da_natureza').secoesSemClassificacao).toBe(0)
  })

  it('Biologia no Fundamental procura em Ciências: o material dela cobre o código de `CI`, e Filosofia não cobre nada', async () => {
    const escola = await escolaNova()
    const biologia = (await chamar(api.url, 'POST', '/v1/disciplinas', escola.base.coordenacao.token, { nome: 'Biologia' })).corpo['id'] as string
    const filosofia = (await chamar(api.url, 'POST', '/v1/disciplinas', escola.base.coordenacao.token, { nome: 'Filosofia' })).corpo['id'] as string
    await materialCobrindo(escola, { disciplinaId: biologia, series: [escola.serie7], codigos: [CI_7] })
    const filosofiaMaterial = await materialCobrindo(escola, { disciplinaId: filosofia, series: [escola.serie7], codigos: [LP_69] })
    await secaoSemCodigo(escola, filosofiaMaterial.materialId, 2, null)

    const cobertura = await coberturaDe(escola, escola.serie7)

    expect(faltam(cobertura, 'ciencias')).not.toContain(CI_7)
    expect(faltam(cobertura, 'lingua_portuguesa')).toContain(LP_69)
    expect(cobertura.grupos.every((grupo) => grupo.secoesSemClassificacao === 0)).toBe(true)
  })

  it('o componente apagado deixa de contar o código, mesmo na seção que a coordenação corrigiu; definido de novo, ele volta', async () => {
    const escola = await escolaNova()
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7], origem: 'coordenacao' })
    expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias')).not.toContain(CI_7)

    const apagado = await chamar(api.url, 'PATCH', `/v1/disciplinas/${escola.base.quimica}`, escola.base.coordenacao.token, { componenteBncc: null })
    expect(apagado.status).toBe(200)
    const semComponente = await coberturaDe(escola, escola.serie7)
    expect(faltam(semComponente, 'ciencias')).toContain(CI_7)
    expect(semComponente.grupos.every((grupo) => grupo.secoesSemClassificacao === 0)).toBe(true)

    const definido = await chamar(api.url, 'PATCH', `/v1/disciplinas/${escola.base.quimica}`, escola.base.coordenacao.token, { componenteBncc: 'quimica' })
    expect(definido.status).toBe(200)
    expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias')).not.toContain(CI_7)
  })

  it('no Médio, o componente apagado não derruba a cobertura: a seção do material dele deixa de contar em qualquer área', async () => {
    const escola = await escolaNova()
    const { materialId } = await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.base.serieId], codigos: [CNT_EM] })
    await secaoSemCodigo(escola, materialId, 2, null)
    expect(grupoDe(await coberturaDe(escola, escola.base.serieId), 'ciencias_da_natureza').secoesSemClassificacao).toBe(1)

    const apagado = await chamar(api.url, 'PATCH', `/v1/disciplinas/${escola.base.quimica}`, escola.base.coordenacao.token, { componenteBncc: null })
    expect(apagado.status).toBe(200)
    const semComponente = await coberturaDe(escola, escola.base.serieId)

    expect(faltam(semComponente, 'ciencias_da_natureza')).toContain(CNT_EM)
    expect(semComponente.grupos.every((grupo) => grupo.secoesSemClassificacao === 0)).toBe(true)
  })

  describe('com a classificação pela IA suspensa', () => {
    async function suspender(escola: Escola, rota: 'suspender' | 'retomar'): Promise<void> {
      const resposta = await chamar(api.url, 'POST', `/v1/governanca/funcoes/classificacao_do_material/${rota}`, escola.base.coordenacao.token, {})
      expect(resposta.status).toBe(200)
    }

    it('só as habilidades corrigidas contam, a da IA não, e a seção que a coordenação não corrigiu conta como sem classificação', async () => {
      const escola = await escolaNova()
      await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7, 'EF07CI02'] })
      await materialCobrindo(escola, { disciplinaId: escola.portugues, series: [escola.serie7], codigos: [LP_69], origem: 'coordenacao' })
      const antes = await coberturaDe(escola, escola.serie7)
      expect(antes.classificacaoSuspensa).toBe(false)
      expect(faltam(antes, 'ciencias')).not.toContain(CI_7)
      expect(grupoDe(antes, 'ciencias').secoesSemClassificacao).toBe(0)

      await suspender(escola, 'suspender')
      const suspensa = await coberturaDe(escola, escola.serie7)

      expect(suspensa.classificacaoSuspensa).toBe(true)
      expect(faltam(suspensa, 'ciencias')).toEqual(expect.arrayContaining([CI_7, 'EF07CI02']))
      expect(faltam(suspensa, 'lingua_portuguesa')).not.toContain(LP_69)
      expect(grupoDe(suspensa, 'ciencias').secoesSemClassificacao).toBe(1)
      expect(grupoDe(suspensa, 'lingua_portuguesa').secoesSemClassificacao).toBe(0)

      await suspender(escola, 'retomar')
      expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias')).not.toContain(CI_7)
    })

    it('suspensa e retomada, com o componente apagado no meio, a cobertura não conta o código antigo', async () => {
      const escola = await escolaNova()
      await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })
      await suspender(escola, 'suspender')
      const apagado = await chamar(api.url, 'PATCH', `/v1/disciplinas/${escola.base.quimica}`, escola.base.coordenacao.token, { componenteBncc: null })
      expect(apagado.status).toBe(200)
      await suspender(escola, 'retomar')

      expect(faltam(await coberturaDe(escola, escola.serie7), 'ciencias')).toContain(CI_7)
    })
  })
})

describe('GET /v1/materiais/cobertura: permissão e isolamento (RF20)', () => {
  it('o professor e o aluno recebem `NAO_ENCONTRADO`, mesmo na série dele', async () => {
    const escola = await escolaNova()
    const professor = await bancada.sessao(escola.escolaId, 'professor')
    const aluno = await bancada.sessao(escola.escolaId, 'aluno')

    expect(erroDe(await get(professor, `/v1/materiais/cobertura?serieId=${escola.serie7}`))).toEqual(naoEncontrado)
    expect(erroDe(await get(aluno, `/v1/materiais/cobertura?serieId=${escola.serie7}`))).toEqual(naoEncontrado)
  })

  it('a série da outra escola, e a que não existe, respondem o mesmo `NAO_ENCONTRADO`', async () => {
    const a = await escolaNova()
    const b = await escolaNova()

    const daB = erroDe(await get(a.base.coordenacao, `/v1/materiais/cobertura?serieId=${b.serie7}`))
    const inexistente = erroDe(await get(a.base.coordenacao, `/v1/materiais/cobertura?serieId=${randomUUID()}`))

    expect(daB).toEqual(naoEncontrado)
    expect(inexistente).toEqual(daB)
  })

  it('a consulta fora do contrato é `ENTRADA_INVALIDA`: sem série, com id que não é UUID e com campo a mais', async () => {
    const escola = await escolaNova()
    for (const consulta of ['', '?serieId=1', `?serieId=${escola.serie7}&escolaId=${escola.escolaId}`]) {
      const resposta = await get(escola.base.coordenacao, `/v1/materiais/cobertura${consulta}`)
      expect(erroDe(resposta), consulta).toEqual({ status: 400, codigo: ErrorCode.ENTRADA_INVALIDA })
    }
  })

  it('o material da B que cobriria a habilidade que falta à A não cobre, e a cobertura da B não vê o material da A', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    await materialCobrindo(b, { disciplinaId: b.base.quimica, series: [b.serie7], codigos: [CI_7] })
    await materialCobrindo(a, { disciplinaId: a.portugues, series: [a.serie7], codigos: [LP_69] })

    const daA = await coberturaDe(a, a.serie7)
    const daB = await coberturaDe(b, b.serie7)

    expect(faltam(daA, 'ciencias')).toContain(CI_7)
    expect(faltam(daB, 'ciencias')).not.toContain(CI_7)
    expect(faltam(daB, 'lingua_portuguesa')).toContain(LP_69)
    expect(faltam(daA, 'lingua_portuguesa')).not.toContain(LP_69)
  })

  it('a rota `/cobertura` não é capturada por `:id`, e um id de material continua sendo lido por ela', async () => {
    const escola = await escolaNova()
    const { materialId } = await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })

    const cobertura = await get(escola.base.coordenacao, `/v1/materiais/cobertura?serieId=${escola.serie7}`)
    const material = await get(escola.base.coordenacao, `/v1/materiais/${materialId}`)

    expect(cobertura.status).toBe(200)
    expect(cobertura.corpo).toHaveProperty('grupos')
    expect(material.status).toBe(200)
    expect(material.corpo['id']).toBe(materialId)
  })

  it('o contrato só leva ids, códigos, descrições da BNCC e contagens: nenhum título de material nem dado de pessoa', async () => {
    const escola = await escolaNova()
    await materialCobrindo(escola, { disciplinaId: escola.base.quimica, series: [escola.serie7], codigos: [CI_7] })

    const resposta = await get(escola.base.coordenacao, `/v1/materiais/cobertura?serieId=${escola.serie7}`)

    const texto = JSON.stringify(resposta.corpo)
    expect(texto).not.toContain('Apostila sigilosa')
    expect(texto).not.toContain(escola.base.coordenacao.usuarioId)
    expect(Object.keys(resposta.corpo).sort()).toEqual(['classificacaoSuspensa', 'etapa', 'grupos', 'materiaisEmUso', 'serieId'])
  })
})

describe('GET /v1/materiais/cobertura: o plano da consulta no volume do cenário da carga', () => {
  it('a consulta das cobertas entra pelos índices de `secao_do_material` e de `habilidade_da_secao`, pela escola, sem varrer a tabela', async () => {
    const escola = await escolaNova()
    const quimica = escola.base.quimica
    // 300 apostilas de 25 seções (7.500), cada uma com duas habilidades da IA e a execução concluída, na série do 7º: o cenário da carga (§7c).
    await sql(
      `with materiais as (
         insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
         select $1, $2, 'Apostila ' || n, 'escola', 'autoria_da_escola', true, md5(n::text || random()::text) || md5(random()::text), 1000, 'pronto', 250, now() from generate_series(1, 300) n returning id
       ), serie_do_material as (
         insert into material_serie (escola_id, material_id, serie_id) select $1, id, $3 from materiais
       ), exec as (
         insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, resultado, iniciada_em, concluida_em)
         values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, gen_random_uuid(), '{"tarefa":"classificar_secoes"}'::jsonb, 'concluida', '{"tipo":"classificacao_do_material","secoes":7500}'::jsonb, now(), now()) returning id
       ), secoes as (
         insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final, execucao_id)
         select $1, m.id, s, (s - 1) * 10 + 1, s * 10, (select id from exec) from materiais m cross join generate_series(1, 25) s returning id
       )
       insert into habilidade_da_secao (escola_id, secao_id, codigo, origem)
       select $1, id, c, 'ia' from secoes cross join (values ('EF07CI01'), ('EF07CI02')) v(c)`,
      [escola.escolaId, quimica, escola.serie7],
    )
    const cliente = await bancada.pool.connect()
    try {
      await cliente.query('analyze secao_do_material')
      await cliente.query('analyze habilidade_da_secao')
      await cliente.query('analyze material')
      await cliente.query('begin')
      const { sql: texto, params } = await runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId }, async () => new CoberturaRepository(bancoDaApi()).consultaDasCobertas(escola.serie7, '2026-11-20', false).toSQL())
      const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (format json) ${texto}`, params as unknown[])
      const nos: Array<Record<string, unknown>> = []
      const andar = (no: Record<string, unknown> | undefined): void => {
        if (no === undefined) return
        nos.push(no)
        for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
      }
      andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
      const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')
      for (const tabela of ['secao_do_material', 'habilidade_da_secao']) {
        const doIndice = nos.filter((no) => no['Relation Name'] === tabela && typeof no['Index Name'] === 'string')
        expect(doIndice.length, `${tabela}: ${resumo}`).toBeGreaterThan(0)
        // Cada índice entra pela escola: a condição dele cita `escola_id`.
        for (const no of doIndice) expect(String(no['Index Cond']), resumo).toMatch(/escola_id/)
        expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === tabela), `${tabela}: ${resumo}`).toEqual([])
      }
      const medida = await cliente.query<{ 'QUERY PLAN': Array<{ 'Execution Time': number }> }>(`explain (analyze, format json) ${texto}`, params as unknown[])
      // O teto do plano é o da carga (`TETO_DO_PLANO_MS`, 200 ms).
      expect(medida.rows[0]?.['QUERY PLAN'][0]?.['Execution Time'] ?? Infinity, resumo).toBeLessThan(200)
    } finally {
      await cliente.query('rollback')
      cliente.release()
    }
  })
})
