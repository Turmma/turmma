import { AgendamentoDaClassificacaoRepository, JobOutbox, JobOutboxRepository, runInContext, type Database, type SecaoParaAgendar } from '@educa/core'
import { ErrorCode, JobFailureCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { jobExecution } from '../../../worker/test/job-execution.fixture.js'
import { InMemoryLog } from '../../../worker/test/queue.fixture.js'
import { createAgendamentoDaClassificacao } from '../../../worker/src/processors/agendar-classificacao.js'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-turma.fixture.js'
import { SessaoFixtures } from '../../test/sessao.fixture.js'
import { DB } from '../database.module.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from '../../test/test-api.js'
import { TEST_APP_OPTIONS } from '../../test/test-config.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import { ClassificarSecoesCommand } from './classificar-secoes.command.js'
import { SecoesRepository } from './secoes.repository.js'

/**
 * A mudança de componente ou de séries limpa e reagenda a classificação (classificacao-bncc, 6.0; `techspec.md` §5 "Agendar" (b), "Suspensão", "Classificação" (candidatas no `preparar`); `cenarios.md` "Seções e
 * agendamento"; corridas P9, P10a, P10b e P11). O `PATCH` (pela API de verdade) só enfileira o job `material.agendar-classificacao` do material ou da disciplina; o job, que é o processador do `worker-lote` chamado como o
 * executor o chama, lê o recorte que está no banco e limpa e agenda. Nenhum teste chama modelo: o agendamento só cria execuções e jobs, e o `preparar` é chamado direto para ler as candidatas.
 */
const bancada = new SessaoFixtures()
const medidor = new MedidorDeTeste()
const log = new InMemoryLog('recorte-teste')
const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)
const enfileirador = new JobOutbox(new JobOutboxRepository(bancada.banco))
const naEscola = <Resultado>(escolaId: string, trabalho: () => Promise<Resultado>): Promise<Resultado> => runInContext({ requisicaoId: randomUUID(), escolaId }, trabalho)
/** O banco da API de teste, com o pool que aguenta as conexões das corridas: o da `bancada` tem duas, e o gatilho de parada e a trava já usam uma. */
const bancoDaApi = (): Database => api.app.get<Database>(DB)
const TIPO_DO_JOB = 'material.agendar-classificacao'
const CODIGO_DO_6O = 'EF06CI01'
let api: TestApi
const escolasDoTeste: string[] = []

interface Escola {
  readonly base: EscolaComTurma
  readonly escolaId: string
  readonly serie6: string
  readonly serie9: string
}

/** A escola montada pela API, com as séries do 6º e do 9º ano do Fundamental além do 2º do Médio. Química nasce com o componente `quimica`. */
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
  /** As séries declaradas, por padrão o 6º ano; vazio é o material sem série. */
  readonly series?: readonly string[]
}

/** O material `pronto` (a linha e as séries declaradas), sem seção. */
async function inserirMaterial(escola: Escola, disciplinaId: string, series: readonly string[], paginas: number): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
     values ($1, $2, 'Apostila sigilosa', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, 'pronto', $3, now() - interval '3 hours') returning id`,
    [escola.escolaId, disciplinaId, paginas],
  )
  const materialId = rows[0]?.id ?? ''
  for (const serieId of series) await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escola.escolaId, materialId, serieId])
  return materialId
}

/** O material `pronto` com `secoes` seções de uma página cada, sem execução, sem falha e sem correção. */
async function materialNovo(escola: Escola, opcoes: MaterialOptions = {}): Promise<{ materialId: string; secoes: string[] }> {
  const { secoes: quantas = 1, disciplinaId = escola.base.quimica, series = [escola.serie6] } = opcoes
  const materialId = await inserirMaterial(escola, disciplinaId, series, quantas)
  const secoes: string[] = []
  for (let ordem = 1; ordem <= quantas; ordem++) {
    const secao = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3::smallint, $3::int, $3::int) returning id', [escola.escolaId, materialId, ordem])
    secoes.push(secao.rows[0]?.id ?? '')
  }
  return { materialId, secoes }
}

type EstadoDaExecucao = 'pendente' | 'rodando' | 'concluida' | 'falhou'

/** Uma execução da classificação da escola no estado dado, e as seções apontando para ela com a `falhas_seguidas` dada. */
async function execucaoNaSecao(escola: Escola, secoes: readonly string[], estado: EstadoDaExecucao, falhas = 0): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, resultado, iniciada_em, concluida_em)
     values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, '{"tarefa":"classificar_secoes"}'::jsonb, $3::text, $4,
             case when $3::text = 'concluida' then '{"tipo":"classificacao_do_material","secoes":1}'::jsonb end,
             case when $3::text in ('rodando', 'concluida', 'falhou') then now() end, case when $3::text in ('concluida', 'falhou') then now() end) returning id`,
    [escola.escolaId, randomUUID(), estado, estado === 'falhou' ? 'IA_SAIDA_INVALIDA' : null],
  )
  const id = rows[0]?.id ?? ''
  await sql('update secao_do_material set execucao_id = $1, falhas_seguidas = $2, classificada_em = case when $3::text = \'concluida\' then now() end where escola_id = $4 and id = any($5::uuid[])', [id, falhas, estado, escola.escolaId, secoes])
  return id
}

/** A seção que a IA classificou (execução concluída e o código da IA), com `falhas` já somadas. */
async function secaoClassificada(escola: Escola, secoes: readonly string[], codigo = CODIGO_DO_6O): Promise<string> {
  const execucaoId = await execucaoNaSecao(escola, secoes, 'concluida')
  for (const secaoId of secoes) await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')", [escola.escolaId, secaoId, codigo])
  return execucaoId
}

/** A correção da coordenação: troca o código da IA pelo dela e grava `corrigida_em`, sobre a execução que a seção tinha. */
async function secaoCorrigida(escola: Escola, secaoId: string, codigo = 'EF06CI02'): Promise<void> {
  await sql("delete from habilidade_da_secao where secao_id = $1 and origem = 'ia'", [secaoId])
  await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'coordenacao')", [escola.escolaId, secaoId, codigo])
  await sql('update secao_do_material set corrigida_em = now() where id = $1', [secaoId])
}

interface SecaoLida extends Record<string, unknown> {
  readonly id: string
  readonly execucao_id: string | null
  readonly falhas_seguidas: number
  readonly classificada_em: Date | null
  readonly corrigida_em: Date | null
}
const secaoDe = async (id: string): Promise<SecaoLida> => (await sql<SecaoLida>('select id, execucao_id, falhas_seguidas, classificada_em, corrigida_em from secao_do_material where id = $1', [id])).rows[0] as SecaoLida
const habilidadesDa = async (secaoId: string): Promise<Array<{ codigo: string; origem: string }>> =>
  (await sql<{ codigo: string; origem: string }>('select codigo, origem from habilidade_da_secao where secao_id = $1 order by codigo', [secaoId])).rows
const execucoesDaEscola = async (escolaId: string): Promise<number> => Number((await sql<{ n: string }>("select count(*) as n from execucao_agente where escola_id = $1 and tarefa = 'classificar_secoes'", [escolaId])).rows[0]?.n)
const jobsDaEscola = async (escolaId: string): Promise<Array<{ id: string; chave: string; dados: Record<string, unknown>; estado: string }>> =>
  (await sql<{ id: string; chave: string; dados: Record<string, unknown>; estado: string }>('select id, chave_idempotencia as chave, dados, estado from job_registro where escola_id = $1 and tipo = $2 order by criado_em, id', [escolaId, TIPO_DO_JOB])).rows

/** Há candidatas, e todas começam por `prefixo`: `every` sobre a lista vazia daria verdadeiro, e a execução sem candidata passaria por boa. */
const soDoRecorte = (candidatas: readonly string[], prefixo: string): boolean => candidatas.length > 0 && candidatas.every((codigo) => codigo.startsWith(prefixo))

/** O que o `preparar` da execução manda ao modelo: os códigos candidatos, lidos agora do recorte do material e do componente da disciplina. */
async function candidatasDa(escolaId: string, execucaoId: string): Promise<string[]> {
  const preparado = await naEscola(escolaId, () => new ClassificarSecoesCommand(bancada.banco).preparar({ id: execucaoId, tarefa: 'classificar_secoes', chaveEnvio: randomUUID(), entrada: { tarefa: 'classificar_secoes' } }))
  return preparado.entrada.candidatas.map((candidata) => candidata.codigo)
}

/** O job `material.agendar-classificacao` da escola, como o executor o chama. */
function executar(escolaId: string, dados: Record<string, unknown>, opcoes: { lote?: number; sinal?: AbortSignal; enfileirador?: Pick<JobOutbox, 'enfileirarUmaVez'> } = {}): Promise<void> {
  const processador = createAgendamentoDaClassificacao({
    banco: bancoDaApi(),
    enfileirador: opcoes.enfileirador ?? enfileirador,
    logger: log.logger,
    ...(opcoes.lote === undefined ? {} : { lote: opcoes.lote }),
  })
  return naEscola(escolaId, () => processador(dados as never, jobExecution(randomUUID()), opcoes.sinal ?? new AbortController().signal))
}

/** Roda, na ordem em que foram gravados (ou na inversa), os jobs do tipo que o `PATCH` deixou na fila da escola. */
async function rodarOsJobsDoPatch(escolaId: string, ordem: 'gravacao' | 'inversa' = 'gravacao'): Promise<void> {
  const jobs = await jobsDaEscola(escolaId)
  for (const job of ordem === 'inversa' ? jobs.toReversed() : jobs) await executar(escolaId, job.dados)
}

const patchar = (escola: Escola, caminho: string, corpo: unknown): Promise<RespostaHttp> => chamar(api.url, 'PATCH', caminho, escola.base.coordenacao.token, corpo)
const mudarSeries = (escola: Escola, materialId: string, serieIds: readonly string[]): Promise<RespostaHttp> => patchar(escola, `/v1/materiais/${materialId}`, { serieIds })
const mudarComponente = (escola: Escola, disciplinaId: string, componenteBncc: string | null): Promise<RespostaHttp> => patchar(escola, `/v1/disciplinas/${disciplinaId}`, { componenteBncc })

beforeAll(async () => {
  api = await subirApi(medidor.medidor, {}, undefined, TEST_APP_OPTIONS)
})

afterAll(async () => {
  await api.app.close()
  await sql('delete from job_registro where escola_id = any($1::uuid[]) and tipo = $2', [escolasDoTeste, TIPO_DO_JOB])
  await bancada.fechar()
  await medidor.encerrar()
})

describe('o PATCH só enfileira, e o job refaz a classificação pelo recorte atual', () => {
  it('séries do 6º para o 9º: o `PATCH` só enfileira o job do material, sem execução na transação; o job limpa a seção e agenda a execução nova, com as candidatas do 9º; o outro material fica como está', async () => {
    const escola = await escolaNova()
    // O material sem execução vem primeiro (o id v7 segue o instante): se o job agendasse além das seções que limpou, esta seria a primeira que ele levaria.
    const semExecucao = await materialNovo(escola, { secoes: 1 })
    const alvo = await materialNovo(escola, { secoes: 2 })
    const outro = await materialNovo(escola, { secoes: 1 })
    const antiga = await secaoClassificada(escola, alvo.secoes)
    const antigaDoOutro = await secaoClassificada(escola, outro.secoes)
    const execucoesAntes = await execucoesDaEscola(escola.escolaId)

    const resposta = await mudarSeries(escola, alvo.materialId, [escola.serie9])

    expect(resposta.status).toBe(200)
    // O `PATCH` já respondeu: nenhuma execução nasceu, a seção segue como estava, e o job do material espera na fila.
    expect(await execucoesDaEscola(escola.escolaId)).toBe(execucoesAntes)
    expect((await secaoDe(alvo.secoes[0] ?? '')).execucao_id).toBe(antiga)
    expect((await jobsDaEscola(escola.escolaId)).map(({ dados, estado }) => ({ dados, estado }))).toEqual([{ dados: { materialId: alvo.materialId }, estado: 'aguardando' }])

    await rodarOsJobsDoPatch(escola.escolaId)

    const [primeira, segunda] = [await secaoDe(alvo.secoes[0] ?? ''), await secaoDe(alvo.secoes[1] ?? '')]
    expect(primeira.execucao_id).not.toBe(antiga)
    expect(primeira.execucao_id).not.toBeNull()
    expect(segunda.execucao_id).toBe(primeira.execucao_id)
    expect(await habilidadesDa(alvo.secoes[0] ?? '')).toEqual([])
    const candidatas = await candidatasDa(escola.escolaId, primeira.execucao_id ?? '')
    expect(candidatas.length).toBeGreaterThan(0)
    expect(candidatas.every((codigo) => codigo.startsWith('EF09CI'))).toBe(true)
    expect(await sql('select estado from execucao_agente where id = $1', [primeira.execucao_id]).then((resultado) => resultado.rows)).toEqual([{ estado: 'pendente' }])
    expect((await sql<{ fila: string; nao_urgente: boolean }>("select fila, nao_urgente from job_registro where escola_id = $1 and tipo = 'ia.executar-lote' and chave_idempotencia = $2", [escola.escolaId, primeira.execucao_id])).rows).toEqual([{ fila: 'lote', nao_urgente: true }])
    // O material que o `PATCH` não tocou continua com a classificação dele.
    expect((await secaoDe(outro.secoes[0] ?? '')).execucao_id).toBe(antigaDoOutro)
    expect(await habilidadesDa(outro.secoes[0] ?? '')).toEqual([{ codigo: CODIGO_DO_6O, origem: 'ia' }])
    expect((await secaoDe(semExecucao.secoes[0] ?? '')).execucao_id).toBeNull()
  })

  it('componente da disciplina: o `PATCH` só enfileira o job da disciplina; o job refaz os materiais dela, com as candidatas do componente novo, e não toca os de outra disciplina', async () => {
    const escola = await escolaNova()
    const daDisciplina = await materialNovo(escola, { series: [escola.serie9] })
    const doutroMaterialDaDisciplina = await materialNovo(escola, { series: [escola.serie9] })
    const deOutraDisciplina = await materialNovo(escola, { disciplinaId: escola.base.fisica, series: [escola.serie9] })
    const antiga = await secaoClassificada(escola, [...daDisciplina.secoes, ...doutroMaterialDaDisciplina.secoes], 'EF09CI01')
    const antigaDeFisica = await secaoClassificada(escola, deOutraDisciplina.secoes, 'EF09CI01')
    const execucoesAntes = await execucoesDaEscola(escola.escolaId)

    const resposta = await mudarComponente(escola, escola.base.quimica, 'matematica')

    expect(resposta.status).toBe(200)
    expect(await execucoesDaEscola(escola.escolaId)).toBe(execucoesAntes)
    expect((await jobsDaEscola(escola.escolaId)).map(({ dados }) => dados)).toEqual([{ disciplinaId: escola.base.quimica }])

    await rodarOsJobsDoPatch(escola.escolaId)

    for (const secaoId of [...daDisciplina.secoes, ...doutroMaterialDaDisciplina.secoes]) {
      const lida = await secaoDe(secaoId)
      expect(lida.execucao_id).not.toBe(antiga)
      expect(lida.execucao_id).not.toBeNull()
      expect(await habilidadesDa(secaoId)).toEqual([])
    }
    const nova = (await secaoDe(daDisciplina.secoes[0] ?? '')).execucao_id ?? ''
    const candidatas = await candidatasDa(escola.escolaId, nova)
    expect(candidatas.length).toBeGreaterThan(0)
    expect(candidatas.every((codigo) => codigo.startsWith('EF09MA'))).toBe(true)
    expect((await secaoDe(deOutraDisciplina.secoes[0] ?? '')).execucao_id).toBe(antigaDeFisica)
    expect(await habilidadesDa(deOutraDisciplina.secoes[0] ?? '')).toEqual([{ codigo: 'EF09CI01', origem: 'ia' }])
    expect(log.doEvento('classificacao.recorte_refeito').some((registro) => registro['escolaId'] === escola.escolaId && registro['tipo'] === 'disciplina' && registro['limpasTotal'] === 2)).toBe(true)
  })

  it('só o título, as mesmas séries, o mesmo componente ou só o nome não enfileiram nada', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { series: [escola.serie6] })

    expect((await patchar(escola, `/v1/materiais/${alvo.materialId}`, { titulo: 'Apostila nova' })).status).toBe(200)
    expect((await mudarSeries(escola, alvo.materialId, [escola.serie6])).status).toBe(200)
    expect((await mudarComponente(escola, escola.base.quimica, 'quimica')).status).toBe(200)
    expect((await patchar(escola, `/v1/disciplinas/${escola.base.quimica}`, { nome: 'Química Orgânica' })).status).toBe(200)

    expect(await jobsDaEscola(escola.escolaId)).toEqual([])
    // As séries diferentes enfileiram: o contraste que mostra que a conferência acima não é de uma rota quebrada.
    expect((await mudarSeries(escola, alvo.materialId, [escola.serie6, escola.serie9])).status).toBe(200)
    expect(await jobsDaEscola(escola.escolaId)).toHaveLength(1)
  })

  it('a seção corrigida fica; a não corrigida volta com `falhas_seguidas` zerada e uma execução nova, e a que falhou duas vezes deixa de ir sozinha', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { secoes: 3 })
    const [corrigida, falhada, classificada] = alvo.secoes as [string, string, string]
    const execucaoDaCorrigida = await secaoClassificada(escola, [corrigida])
    await secaoCorrigida(escola, corrigida)
    await execucaoNaSecao(escola, [falhada], 'falhou', 2)
    await secaoClassificada(escola, [classificada])

    await mudarSeries(escola, alvo.materialId, [escola.serie9])
    await rodarOsJobsDoPatch(escola.escolaId)

    const lidaCorrigida = await secaoDe(corrigida)
    expect(lidaCorrigida.execucao_id).toBe(execucaoDaCorrigida)
    expect(lidaCorrigida.corrigida_em).not.toBeNull()
    expect(await habilidadesDa(corrigida)).toEqual([{ codigo: 'EF06CI02', origem: 'coordenacao' }])
    const [lidaFalhada, lidaClassificada] = [await secaoDe(falhada), await secaoDe(classificada)]
    expect(lidaFalhada).toMatchObject({ falhas_seguidas: 0, classificada_em: null })
    expect(lidaFalhada.execucao_id).not.toBeNull()
    expect(lidaClassificada).toMatchObject({ falhas_seguidas: 0, classificada_em: null })
    // Zeradas, as duas vão juntas, numa execução só (a seção com falha iria sozinha).
    expect(lidaClassificada.execucao_id).toBe(lidaFalhada.execucao_id)
  })

  it('`PATCH` durante uma execução `rodando`: a antiga conclui sem efeito e a seção fica com a nova', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola)
    const rodando = await execucaoNaSecao(escola, alvo.secoes, 'rodando')

    await mudarSeries(escola, alvo.materialId, [escola.serie9])
    await rodarOsJobsDoPatch(escola.escolaId)
    const nova = (await secaoDe(alvo.secoes[0] ?? '')).execucao_id ?? ''
    // A execução antiga termina e tenta gravar o que o modelo devolveu, com as candidatas do 6º.
    const gravadas = await naEscola(escola.escolaId, () => bancada.banco.transaction((tx) => new SecoesRepository(tx).saveClassificacao(rodando, [{ secaoId: alvo.secoes[0] ?? '', codigos: [CODIGO_DO_6O] }])))

    expect(gravadas).toHaveLength(0)
    expect(nova).not.toBe(rodando)
    expect((await secaoDe(alvo.secoes[0] ?? '')).execucao_id).toBe(nova)
    expect(await habilidadesDa(alvo.secoes[0] ?? '')).toEqual([])
  })

  it('`PATCH` de séries com a seção `aguardando` (execução pendente): ao rodar, a execução nova recebe as candidatas do 9º, lidas no `preparar`', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola)
    const pendente = await execucaoNaSecao(escola, alvo.secoes, 'pendente')
    // A execução pendente ainda é do 6º até o `PATCH`: o `preparar` dela leria o 6º.
    expect(soDoRecorte(await candidatasDa(escola.escolaId, pendente), 'EF06CI')).toBe(true)

    await mudarSeries(escola, alvo.materialId, [escola.serie9])
    await rodarOsJobsDoPatch(escola.escolaId)

    const nova = (await secaoDe(alvo.secoes[0] ?? '')).execucao_id ?? ''
    expect(nova).not.toBe(pendente)
    expect(soDoRecorte(await candidatasDa(escola.escolaId, nova), 'EF09CI')).toBe(true)
  })

  it('dois `PATCH` seguidos com os dois jobs na fila: vale o recorte do segundo, na ordem em que os jobs rodam e na inversa', async () => {
    for (const ordem of ['gravacao', 'inversa'] as const) {
      const escola = await escolaNova()
      const alvo = await materialNovo(escola)
      const antiga = await secaoClassificada(escola, alvo.secoes)

      await mudarSeries(escola, alvo.materialId, [escola.serie9])
      await mudarSeries(escola, alvo.materialId, [escola.serie6])
      expect(await jobsDaEscola(escola.escolaId)).toHaveLength(2)
      await rodarOsJobsDoPatch(escola.escolaId, ordem)

      const execucaoId = (await secaoDe(alvo.secoes[0] ?? '')).execucao_id ?? ''
      // O recorte do segundo `PATCH` é o original: só uma execução nova, `pendente`, com a seção limpa do código antigo, prova que os jobs refizeram o trabalho.
      expect(execucaoId, ordem).not.toBe('')
      expect(execucaoId, ordem).not.toBe(antiga)
      expect((await sql('select estado from execucao_agente where id = $1', [execucaoId])).rows, ordem).toEqual([{ estado: 'pendente' }])
      expect(await habilidadesDa(alvo.secoes[0] ?? ''), ordem).toEqual([])
      expect(soDoRecorte(await candidatasDa(escola.escolaId, execucaoId), 'EF06CI'), ordem).toBe(true)
    }
  })
})

describe('componente apagado, suspensão e disciplina sem componente', () => {
  it('componente apagado: nenhuma execução nova; as não corrigidas voltam a `nao_agendada` sem `origem: ia` e sem falha somada, e a corrigida fica', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { secoes: 3 })
    const [corrigida, falhada, classificada] = alvo.secoes as [string, string, string]
    const execucaoDaCorrigida = await secaoClassificada(escola, [corrigida])
    await secaoCorrigida(escola, corrigida)
    await execucaoNaSecao(escola, [falhada], 'falhou', 2)
    await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')", [escola.escolaId, falhada, CODIGO_DO_6O])
    await secaoClassificada(escola, [classificada])
    const execucoesAntes = await execucoesDaEscola(escola.escolaId)

    expect((await mudarComponente(escola, escola.base.quimica, null)).status).toBe(200)
    await rodarOsJobsDoPatch(escola.escolaId)

    expect(await execucoesDaEscola(escola.escolaId)).toBe(execucoesAntes)
    for (const secaoId of [falhada, classificada]) {
      expect(await secaoDe(secaoId)).toMatchObject({ execucao_id: null, falhas_seguidas: 0, classificada_em: null })
      expect(await habilidadesDa(secaoId)).toEqual([])
    }
    expect((await secaoDe(corrigida)).execucao_id).toBe(execucaoDaCorrigida)
    expect(await habilidadesDa(corrigida)).toEqual([{ codigo: 'EF06CI02', origem: 'coordenacao' }])
  })

  it('o job do componente apagado, entregue depois de ele voltar, agenda pelo componente atual e não deixa a seção `nao_agendada`', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { series: [escola.serie9] })
    const antiga = await secaoClassificada(escola, alvo.secoes, 'EF09CI01')

    await mudarComponente(escola, escola.base.quimica, null)
    await mudarComponente(escola, escola.base.quimica, 'matematica')
    expect((await jobsDaEscola(escola.escolaId)).map(({ dados }) => dados)).toEqual([{ disciplinaId: escola.base.quimica }, { disciplinaId: escola.base.quimica }])
    // Só o primeiro job (o do `null`) chega, depois de o componente já ter voltado.
    await executar(escola.escolaId, (await jobsDaEscola(escola.escolaId))[0]?.dados ?? {})

    const execucaoId = (await secaoDe(alvo.secoes[0] ?? '')).execucao_id ?? ''
    expect(execucaoId).not.toBe('')
    expect(execucaoId).not.toBe(antiga)
    expect(await habilidadesDa(alvo.secoes[0] ?? '')).toEqual([])
    expect(soDoRecorte(await candidatasDa(escola.escolaId, execucaoId), 'EF09MA')).toBe(true)
  })

  it('função suspensa: o `PATCH` que apaga o componente e o que troca limpam e não agendam; a retomada devolve a seção à rotina, que agenda pelo componente novo', async () => {
    const escola = await escolaNova()
    const apagado = await materialNovo(escola, { series: [escola.serie9] })
    const trocado = await materialNovo(escola, { disciplinaId: escola.base.fisica, series: [escola.serie9] })
    await secaoClassificada(escola, apagado.secoes, 'EF09CI01')
    await secaoClassificada(escola, trocado.secoes, 'EF09CI01')
    const suspensao = await sql<{ id: string }>("insert into suspensao_de_funcao (escola_id, funcao, motivo, suspensa_por) values ($1, 'classificacao_do_material', 'decisao_da_escola', $2) returning id", [escola.escolaId, escola.base.coordenacao.usuarioId])
    const execucoesAntes = await execucoesDaEscola(escola.escolaId)

    await mudarComponente(escola, escola.base.quimica, null)
    await mudarComponente(escola, escola.base.fisica, 'matematica')
    await rodarOsJobsDoPatch(escola.escolaId)

    expect(await execucoesDaEscola(escola.escolaId)).toBe(execucoesAntes)
    for (const secaoId of [...apagado.secoes, ...trocado.secoes]) {
      expect(await secaoDe(secaoId)).toMatchObject({ execucao_id: null, falhas_seguidas: 0 })
      expect(await habilidadesDa(secaoId)).toEqual([])
    }

    // Retomada: a rotina das 19h (o job sem dados) agenda a seção da disciplina que tem componente; a do componente apagado segue sem.
    await sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $2 where id = $1', [suspensao.rows[0]?.id, escola.base.coordenacao.usuarioId])
    await executar(escola.escolaId, {})
    expect((await secaoDe(apagado.secoes[0] ?? '')).execucao_id).toBeNull()
    const execucaoId = (await secaoDe(trocado.secoes[0] ?? '')).execucao_id ?? ''
    expect(execucaoId).not.toBe('')
    expect(soDoRecorte(await candidatasDa(escola.escolaId, execucaoId), 'EF09MA')).toBe(true)
  })

  it('`PATCH` de séries numa disciplina sem componente: limpa e não cria execução', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { disciplinaId: escola.base.fisica })
    await sql('update disciplina set componente_bncc = null where id = $1', [escola.base.fisica])
    await secaoClassificada(escola, alvo.secoes)
    const execucoesAntes = await execucoesDaEscola(escola.escolaId)

    await mudarSeries(escola, alvo.materialId, [escola.serie9])
    await rodarOsJobsDoPatch(escola.escolaId)

    expect(await execucoesDaEscola(escola.escolaId)).toBe(execucoesAntes)
    expect(await secaoDe(alvo.secoes[0] ?? '')).toMatchObject({ execucao_id: null, falhas_seguidas: 0, classificada_em: null })
    expect(await habilidadesDa(alvo.secoes[0] ?? '')).toEqual([])
  })
})

describe('o `preparar` sem candidatas limpa só a própria seção (P11)', () => {
  it('sem candidatas: conclui sem modelo (`semModelo`), e a seção volta a `nao_agendada` com `falhas_seguidas` de 2 a 0', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola)
    const pendente = await execucaoNaSecao(escola, alvo.secoes, 'pendente', 2)
    await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')", [escola.escolaId, alvo.secoes[0], CODIGO_DO_6O])
    await sql('update disciplina set componente_bncc = null where id = $1', [escola.base.quimica])

    const preparado = await naEscola(escola.escolaId, () => new ClassificarSecoesCommand(bancada.banco).preparar({ id: pendente, tarefa: 'classificar_secoes', chaveEnvio: randomUUID(), entrada: { tarefa: 'classificar_secoes' } }))
    expect(preparado.semModelo).toBe(true)
    await naEscola(escola.escolaId, () => bancada.banco.transaction((tx) => new ClassificarSecoesCommand(bancada.banco).concluirSemModelo(preparado.lido, tx, pendente)))

    expect(await secaoDe(alvo.secoes[0] ?? '')).toMatchObject({ execucao_id: null, falhas_seguidas: 0, classificada_em: null })
    expect(await habilidadesDa(alvo.secoes[0] ?? '')).toEqual([])
  })

  it('[P] o job agenda pelo componente definido de novo depois de o `preparar` ler e antes de ele limpar: a limpeza não toca a seção, que segue com a execução nova', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { series: [escola.serie9] })
    const antiga = await execucaoNaSecao(escola, alvo.secoes, 'pendente', 2)
    await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, 'EF09CI01', 'ia')", [escola.escolaId, alvo.secoes[0]])
    await sql('update disciplina set componente_bncc = null where id = $1', [escola.base.quimica])
    const comando = new ClassificarSecoesCommand(bancada.banco)
    // 1. O `preparar` da execução antiga lê a disciplina sem componente.
    const preparado = await naEscola(escola.escolaId, () => comando.preparar({ id: antiga, tarefa: 'classificar_secoes', chaveEnvio: randomUUID(), entrada: { tarefa: 'classificar_secoes' } }))
    expect(preparado.semModelo).toBe(true)
    // 2. O componente volta e o job da disciplina agenda a seção numa execução nova.
    await sql("update disciplina set componente_bncc = 'quimica' where id = $1", [escola.base.quimica])
    await executar(escola.escolaId, { disciplinaId: escola.base.quimica })
    const nova = (await secaoDe(alvo.secoes[0] ?? '')).execucao_id ?? ''
    expect(nova).not.toBe(antiga)
    // 3. Só agora o `preparar` antigo conclui e limpa: a seção é da execução nova, e fica.
    await naEscola(escola.escolaId, () => bancada.banco.transaction((tx) => comando.concluirSemModelo(preparado.lido, tx, antiga)))

    expect((await secaoDe(alvo.secoes[0] ?? '')).execucao_id).toBe(nova)
    expect(nova).not.toBe('')
  })
})

describe('o laço, o sinal, os dados e o isolamento do job', () => {
  it('mais seções que o lote: um lote por transação (as seções do primeiro já estão gravadas, vistas por outra conexão, quando o segundo enfileira); o log só tem ids e contagens', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { secoes: 5 })
    for (const secaoId of alvo.secoes) await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')", [escola.escolaId, secaoId, CODIGO_DO_6O])
    let chamadas = 0
    let gravadasVistas: number | undefined
    const espia: Pick<JobOutbox, 'enfileirarUmaVez'> = {
      enfileirarUmaVez: async (...argumentos) => {
        chamadas += 1
        if (chamadas === 2) gravadasVistas = (await sql<{ n: number }>('select count(*)::int as n from secao_do_material where id = any($1::uuid[]) and execucao_id is not null', [alvo.secoes])).rows[0]?.n
        return enfileirador.enfileirarUmaVez(...argumentos)
      },
    }
    const inicio = log.registros().length

    await executar(escola.escolaId, { materialId: alvo.materialId }, { lote: 2, enfileirador: espia })

    expect(gravadasVistas).toBe(2)
    expect((await Promise.all(alvo.secoes.map(secaoDe))).every((secao) => secao.execucao_id !== null)).toBe(true)
    const registros = log.registros().slice(inicio)
    expect(registros.find((registro) => registro['evento'] === 'classificacao.recorte_refeito' && registro['escolaId'] === escola.escolaId)).toMatchObject({ tipo: 'material', estado: 'fim', lotesTotal: 3, limpasTotal: 5, secoesTotal: 5 })
    // As seções tinham o código da IA, que a limpeza apagou: nem ele nem o título passam pelo log.
    expect(JSON.stringify(registros)).not.toContain('sigilosa')
    expect(JSON.stringify(registros)).not.toContain(CODIGO_DO_6O)
  })

  it('com o sinal abortado o job para antes do primeiro lote, sem limpar nada', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola)
    await secaoClassificada(escola, alvo.secoes)
    const controle = new AbortController()
    controle.abort()

    await executar(escola.escolaId, { materialId: alvo.materialId }, { sinal: controle.signal })

    expect(await habilidadesDa(alvo.secoes[0] ?? '')).toEqual([{ codigo: CODIGO_DO_6O, origem: 'ia' }])
  })

  it('`materialId` e `disciplinaId` juntos são recusados como dados inválidos, e nada é limpo', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola)
    await secaoClassificada(escola, alvo.secoes)

    await expect(executar(escola.escolaId, { materialId: alvo.materialId, disciplinaId: escola.base.quimica })).rejects.toMatchObject({ name: 'JobFailureError', codigo: JobFailureCode.DADOS_INVALIDOS })
    expect(await habilidadesDa(alvo.secoes[0] ?? '')).toEqual([{ codigo: CODIGO_DO_6O, origem: 'ia' }])
  })

  it('o job da escola A com o id do material (ou da disciplina) da B nem limpa nem trava a seção da B', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const daB = await materialNovo(b, { secoes: 1 })
    const execucaoDaB = await secaoClassificada(b, daB.secoes)
    const segurador = await bancada.pool.connect()
    try {
      // A linha da B fica travada por outra transação: o job da A que a lesse (ou tentasse limpá-la) esperaria aqui, e passaria do `statement_timeout`.
      await segurador.query('begin')
      await segurador.query('select 1 from secao_do_material where id = $1 for update', [daB.secoes[0]])
      await executar(a.escolaId, { materialId: daB.materialId })
      await executar(a.escolaId, { disciplinaId: b.base.quimica })
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }

    expect((await secaoDe(daB.secoes[0] ?? '')).execucao_id).toBe(execucaoDaB)
    expect(await habilidadesDa(daB.secoes[0] ?? '')).toEqual([{ codigo: CODIGO_DO_6O, origem: 'ia' }])
  })
})

describe('[P] corridas da limpeza (P9, P10a, P10b)', () => {
  it('P9, rotina × `PATCH`: a rotina leu a seção sem execução, o job do `PATCH` a agenda, e o agendamento da rotina, que chega depois, não cria outra execução', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { series: [escola.serie9] })
    const lidas: SecaoParaAgendar[] = await naEscola(escola.escolaId, () => bancada.banco.transaction((tx) => new AgendamentoDaClassificacaoRepository(tx).proximasSecoes(10, { materialId: alvo.materialId })))
    expect(lidas).toHaveLength(1)

    await executar(escola.escolaId, { materialId: alvo.materialId })
    const doPatch = (await secaoDe(alvo.secoes[0] ?? '')).execucao_id
    const agendado = await naEscola(escola.escolaId, () => bancada.banco.transaction((tx) => new AgendamentoDaClassificacaoRepository(tx).agendar(lidas, enfileirador)))

    expect(agendado.execucoes).toBe(0)
    expect((await secaoDe(alvo.secoes[0] ?? '')).execucao_id).toBe(doPatch)
    expect(await execucoesDaEscola(escola.escolaId)).toBe(1)
  })

  it('P10a, a limpeza × o `concluir` que ainda não confirmou: a limpeza espera a trava da seção e depois apaga os códigos recém-gravados', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { series: [escola.serie9] })
    const secaoId = alvo.secoes[0] ?? ''
    const execucaoId = await execucaoNaSecao(escola, alvo.secoes, 'rodando')
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'habilidade_da_secao', evento: 'insert', quando: `new.secao_id = '${secaoId}'::uuid` })
    await parada.armar()
    try {
      // O `concluir` grava a seção e o código da IA e para antes do commit, segurando a linha da seção.
      const concluir = naEscola(escola.escolaId, () => bancoDaApi().transaction((tx) => new SecoesRepository(tx).saveClassificacao(execucaoId, [{ secaoId, codigos: ['EF09CI01'] }])))
      await parada.esperarParadas(1)
      const limpeza = executar(escola.escolaId, { materialId: alvo.materialId })
      await esperarNaTrava(bancada.pool, '%"secao_do_material"%')
      await parada.soltar()
      await Promise.all([concluir, limpeza])
    } finally {
      await parada.desarmar()
    }

    expect(await habilidadesDa(secaoId)).toEqual([])
    const lida = await secaoDe(secaoId)
    expect(lida.classificada_em).toBeNull()
    expect(lida.execucao_id).not.toBe(execucaoId)
    expect(lida.execucao_id).not.toBeNull()
  })

  it('P10b, a limpeza × o `concluir`: o `concluir` que espera a seção não grava, porque o `execucao_id` já é nulo', async () => {
    const escola = await escolaNova()
    const alvo = await materialNovo(escola, { series: [escola.serie9] })
    const secaoId = alvo.secoes[0] ?? ''
    const execucaoId = await execucaoNaSecao(escola, alvo.secoes, 'rodando')
    await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, 'EF09CI02', 'ia')", [escola.escolaId, secaoId])
    // A limpeza para depois de travar a seção, ao apagar o código que a IA tinha posto antes.
    const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'habilidade_da_secao', evento: 'delete', quando: `old.secao_id = '${secaoId}'::uuid` })
    await parada.armar()
    const gravadas = await (async () => {
      try {
        const limpeza = executar(escola.escolaId, { materialId: alvo.materialId })
        await parada.esperarParadas(1)
        const concluir = naEscola(escola.escolaId, () => bancoDaApi().transaction((tx) => new SecoesRepository(tx).saveClassificacao(execucaoId, [{ secaoId, codigos: ['EF09CI01'] }])))
        await esperarNaTrava(bancada.pool, '%"secao_do_material"%"execucao_id" = %for update%')
        await parada.soltar()
        const [, resultado] = await Promise.all([limpeza, concluir])
        return resultado
      } finally {
        await parada.desarmar()
      }
    })()

    expect(gravadas).toHaveLength(0)
    expect(await habilidadesDa(secaoId)).toEqual([])
    expect((await secaoDe(secaoId)).execucao_id).not.toBe(execucaoId)
  })
})

describe('o `PATCH` que não muda nada, ou que é recusado, não deixa job na fila', () => {
  const semJobs = async (...escolas: Escola[]): Promise<void> => {
    for (const escola of escolas) expect(await jobsDaEscola(escola.escolaId)).toEqual([])
  }

  it('professor na própria escola e coordenação da A com o id da B: `NAO_ENCONTRADO` igual ao inexistente, e nenhuma fila (A nem B) ganha job', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const daA = await materialNovo(a)
    const daB = await materialNovo(b)
    const [professor] = await bancada.sessoes(a.escolaId, { papel: 'professor' })
    const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
    const naoEncontrado = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }

    expect(erro(await chamar(api.url, 'PATCH', `/v1/materiais/${daA.materialId}`, professor?.token ?? '', { serieIds: [a.serie9] }))).toEqual(naoEncontrado)
    expect(erro(await chamar(api.url, 'PATCH', `/v1/disciplinas/${a.base.quimica}`, professor?.token ?? '', { componenteBncc: 'matematica' }))).toEqual(naoEncontrado)
    expect(erro(await patchar(a, `/v1/materiais/${daB.materialId}`, { serieIds: [a.serie9] }))).toEqual(naoEncontrado)
    expect(erro(await patchar(a, `/v1/disciplinas/${b.base.quimica}`, { componenteBncc: 'matematica' }))).toEqual(naoEncontrado)
    expect(erro(await patchar(a, `/v1/materiais/${daA.materialId}`, { serieIds: [b.serie9] }))).toEqual(naoEncontrado)

    await semJobs(a, b)
  })

  it('o `PATCH` de disciplina que falha depois de validar (nome repetido, com o componente no mesmo pedido) desfaz tudo e não deixa job', async () => {
    const escola = await escolaNova()
    const { rows } = await sql<{ nome: string }>('select nome from disciplina where id = $1', [escola.base.fisica])

    const resposta = await patchar(escola, `/v1/disciplinas/${escola.base.quimica}`, { nome: rows[0]?.nome, componenteBncc: 'matematica' })

    expect(resposta.status).toBe(409)
    expect((await sql<{ componente_bncc: string }>('select componente_bncc from disciplina where id = $1', [escola.base.quimica])).rows).toEqual([{ componente_bncc: 'quimica' }])
    await semJobs(escola)
  })

  it('duplo clique no componente: os dois `PATCH` respondem 200, e só o primeiro, que mudou o componente, deixa job', async () => {
    const escola = await escolaNova()

    const respostas = await Promise.all([mudarComponente(escola, escola.base.quimica, 'matematica'), mudarComponente(escola, escola.base.quimica, 'matematica')])

    expect(respostas.map((resposta) => resposta.status)).toEqual([200, 200])
    expect((await jobsDaEscola(escola.escolaId)).map(({ dados }) => dados)).toEqual([{ disciplinaId: escola.base.quimica }])
  })
})

describe('a limpeza sem seção não escreve nada', () => {
  /** O que a transação fez de `delete` e `update`: os comandos de escrita da limpeza, para conferir que ela sai antes deles quando não há seção. */
  const escritasDe = <Conexao extends object>(conexao: Conexao, escritas: string[]): Conexao =>
    new Proxy(conexao, {
      get(alvo, propriedade) {
        const valor: unknown = Reflect.get(alvo, propriedade, alvo)
        if (propriedade === 'delete' || propriedade === 'update') escritas.push(propriedade)
        return typeof valor === 'function' ? (valor as (...argumentos: unknown[]) => unknown).bind(alvo) : valor
      },
    })

  it('`clearDoRecorte` de um material só com seção corrigida para depois do `select`, sem `delete` nem `update`', async () => {
    const escola = await escolaNova()
    const vazio = await materialNovo(escola, { secoes: 1 })
    await secaoCorrigida(escola, vazio.secoes[0] ?? '')
    const escritas: string[] = []

    const resultado = await naEscola(escola.escolaId, () => bancada.banco.transaction((tx) => new AgendamentoDaClassificacaoRepository(escritasDe(tx, escritas)).clearDoRecorte({ materialId: vazio.materialId }, 500)))

    expect(resultado).toEqual({ limpas: [], ultima: undefined })
    expect(escritas).toEqual([])
  })

  it('`clearDaExecucao` de uma execução que nenhuma seção tem para depois do `update`, sem `delete`', async () => {
    const escola = await escolaNova()
    const escritas: string[] = []

    const limpas = await naEscola(escola.escolaId, () => new SecoesRepository(escritasDe(bancada.banco, escritas)).clearDaExecucao(randomUUID()))

    expect(limpas).toBe(0)
    expect(escritas).toEqual(['update'])
  })
})
