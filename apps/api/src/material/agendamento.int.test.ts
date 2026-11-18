import { AgendamentoDaClassificacaoRepository, JobOutbox, JobOutboxRepository, runInContext, SECOES_POR_EXECUCAO, type SecaoParaAgendar } from '@educa/core'
import { sql as consulta } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { jobExecution } from '../../../worker/test/job-execution.fixture.js'
import { InMemoryLog } from '../../../worker/test/queue.fixture.js'
import { criarAgendamentoDaClassificacao } from '../../../worker/src/processors/agendar-classificacao.js'
import { SessaoFixtures } from '../../test/sessao.fixture.js'

/**
 * O agendamento da classificação do material (classificacao-bncc, 5.0; `techspec.md` §5 "Agendar" (a), §7c "Laços"; `cenarios.md` "Seções e agendamento"; corrida P9): o que a rotina das 19h agenda e o que ela não toca,
 * a execução de um recorte, a seção com falha numa execução só dela, o teto de três noites, o laço em lotes e o limite da noite. O repository roda sobre o Postgres do compose de teste, e o job da escola é o processador do
 * `worker-lote`, chamado como o executor o chama. Nenhum teste chama modelo: o agendamento só cria execuções e jobs.
 */
const bancada = new SessaoFixtures()
const log = new InMemoryLog('agendamento-teste')
const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)
const enfileirador = new JobOutbox(new JobOutboxRepository(bancada.banco))
const naEscola = <Resultado>(escolaId: string, trabalho: () => Promise<Resultado>): Promise<Resultado> => runInContext({ requisicaoId: randomUUID(), escolaId }, trabalho)

interface Escola {
  readonly escolaId: string
  readonly disciplinaId: string
  readonly serie6: string
  readonly serie9: string
}

/** A escola sintética com a disciplina de Química (com o componente dado) e as séries do 6º e do 9º ano do Fundamental. */
async function escolaNova(componente: string | null = 'quimica'): Promise<Escola> {
  const escolaId = await bancada.escola()
  const disciplina = await sql<{ id: string }>('insert into disciplina (escola_id, nome, componente_bncc) values ($1, $2, $3) returning id', [escolaId, `Disciplina ${randomUUID()}`, componente])
  const serie6 = await sql<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 6) returning id", [escolaId])
  const serie9 = await sql<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 9) returning id", [escolaId])
  return { escolaId, disciplinaId: disciplina.rows[0]?.id ?? '', serie6: serie6.rows[0]?.id ?? '', serie9: serie9.rows[0]?.id ?? '' }
}

interface MaterialOptions {
  readonly secoes?: number
  readonly disciplinaId?: string
  /** As séries declaradas, por padrão o 9º ano; vazio é o material sem série. */
  readonly series?: readonly string[]
  readonly estado?: string
  readonly excluido?: boolean
}

/** O material (sem as seções), com as séries declaradas. */
async function inserirMaterial(escola: Escola, opcoes: MaterialOptions, paginas: number): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em, excluido_em)
     values ($1, $2, 'Apostila sigilosa', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, $3, $4, now() - interval '3 hours', case when $5::boolean then now() else null end) returning id`,
    [escola.escolaId, opcoes.disciplinaId ?? escola.disciplinaId, opcoes.estado ?? 'pronto', paginas, opcoes.excluido ?? false],
  )
  const materialId = rows[0]?.id ?? ''
  for (const serieId of opcoes.series ?? [escola.serie9]) await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escola.escolaId, materialId, serieId])
  return materialId
}

/** O material com `secoes` seções de uma página cada, sem execução, sem falha e sem correção. */
async function materialNovo(escola: Escola, opcoes: MaterialOptions = {}): Promise<{ materialId: string; secoes: string[] }> {
  const quantas = opcoes.secoes ?? 1
  const materialId = await inserirMaterial(escola, opcoes, quantas)
  const secoes: string[] = []
  for (let ordem = 1; ordem <= quantas; ordem++) {
    const secao = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3::smallint, $3::int, $3::int) returning id', [escola.escolaId, materialId, ordem])
    secoes.push(secao.rows[0]?.id ?? '')
  }
  return { materialId, secoes }
}

type EstadoDaExecucao = 'pendente' | 'rodando' | 'concluida' | 'falhou'

/** Uma execução da classificação da escola no estado dado, e as seções apontando para ela com a `falhas_seguidas` dada. Com `classificada`, a seção também leva `classificada_em`. */
async function execucaoNaSecao(escola: Escola, secoes: readonly string[], estado: EstadoDaExecucao, opcoes: { falhas?: number; erro?: string; classificada?: boolean } = {}): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, resultado, iniciada_em, concluida_em)
     values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, '{"tarefa":"classificar_secoes"}'::jsonb, $3::text, $4,
             case when $3::text = 'concluida' then '{"tipo":"classificacao_do_material","secoes":1}'::jsonb end,
             case when $3::text in ('rodando', 'concluida', 'falhou') then now() end, case when $3::text in ('concluida', 'falhou') then now() end) returning id`,
    [escola.escolaId, randomUUID(), estado, estado === 'falhou' ? (opcoes.erro ?? 'IA_SAIDA_INVALIDA') : null],
  )
  const id = rows[0]?.id ?? ''
  await sql('update secao_do_material set execucao_id = $1, falhas_seguidas = $2, classificada_em = case when $5::boolean then now() end where escola_id = $3 and id = any($4::uuid[])', [id, opcoes.falhas ?? 0, escola.escolaId, secoes, opcoes.classificada ?? false])
  return id
}

interface SecaoLida extends Record<string, unknown> {
  readonly id: string
  readonly execucao_id: string | null
  readonly falhas_seguidas: number
}
const secoesDe = async (ids: readonly string[]): Promise<SecaoLida[]> => (await sql<SecaoLida>('select id, execucao_id, falhas_seguidas from secao_do_material where id = any($1::uuid[]) order by ordem, id', [ids])).rows

interface ExecucaoLida extends Record<string, unknown> {
  readonly id: string
  readonly estado: string
  readonly ano_letivo_id: string | null
  readonly solicitada_por: string | null
  readonly funcao: string
  readonly tarefa: string
  readonly secoes: number
}
/** As execuções da escola que ainda têm seção, com quantas, da mais antiga à mais nova. */
const execucoesDa = async (escolaId: string): Promise<ExecucaoLida[]> =>
  (
    await sql<ExecucaoLida>(
      `select e.id, e.estado, e.ano_letivo_id, e.solicitada_por, e.funcao, e.tarefa, (select count(*)::int from secao_do_material s where s.escola_id = e.escola_id and s.execucao_id = e.id) as secoes
         from execucao_agente e where e.escola_id = $1 and e.tarefa = 'classificar_secoes' order by e.criada_em, e.id`,
      [escolaId],
    )
  ).rows
const jobsDe = async (escolaId: string) =>
  (await sql<{ estado: string; fila: string; nao_urgente: boolean; execucao: string; chave: string | null }>("select estado, fila, nao_urgente, dados ->> 'execucaoId' as execucao, chave_idempotencia as chave from job_registro where escola_id = $1 and tipo = 'ia.executar-lote'", [escolaId])).rows

/** O job `material.agendar-classificacao` da escola, como o executor o chama. */
function agendar(escolaId: string, opcoes: { lote?: number; limiteDeExecucoes?: number; sinal?: AbortSignal; enfileirador?: Pick<JobOutbox, 'enfileirarUmaVez'> } = {}): Promise<void> {
  const processador = criarAgendamentoDaClassificacao({
    banco: bancada.banco,
    enfileirador: opcoes.enfileirador ?? enfileirador,
    logger: log.logger,
    ...(opcoes.lote === undefined ? {} : { lote: opcoes.lote }),
    ...(opcoes.limiteDeExecucoes === undefined ? {} : { limiteDeExecucoes: opcoes.limiteDeExecucoes }),
  })
  return naEscola(escolaId, () => processador({}, jobExecution(randomUUID()), opcoes.sinal ?? new AbortController().signal))
}

const tamanhos = (execucoes: readonly ExecucaoLida[]): number[] => execucoes.map((execucao) => execucao.secoes).sort((a, b) => b - a)

afterAll(async () => {
  await bancada.fechar()
})

describe('a rotina agenda a seção sem execução e a que falhou, e só elas', () => {
  it('nao_agendada e nao_classificada com menos de 3 falhas ganham execução, sem ano nem pessoa, e o job de cada uma na `lote`, não urgente, com a execução por chave', async () => {
    const escola = await escolaNova()
    const sem = await materialNovo(escola)
    const falhou = await materialNovo(escola, { secoes: 2 })
    await execucaoNaSecao(escola, [falhou.secoes[0] ?? ''], 'falhou', { falhas: 1 })
    await execucaoNaSecao(escola, [falhou.secoes[1] ?? ''], 'falhou', { falhas: 2 })

    await agendar(escola.escolaId)

    const todas = [...sem.secoes, ...falhou.secoes]
    const lidas = await secoesDe(todas)
    const execucoes = (await execucoesDa(escola.escolaId)).filter((execucao) => execucao.estado === 'pendente')
    expect(lidas.every((secao) => secao.execucao_id !== null && execucoes.some((execucao) => execucao.id === secao.execucao_id))).toBe(true)
    // A sem falha e as duas com falha: três execuções, as com falha cada uma só com a sua seção.
    expect(tamanhos(execucoes)).toEqual([1, 1, 1])
    for (const execucao of execucoes) expect(execucao).toMatchObject({ ano_letivo_id: null, solicitada_por: null, funcao: 'classificacao_do_material', tarefa: 'classificar_secoes' })
    const jobs = await jobsDe(escola.escolaId)
    expect(jobs).toHaveLength(3)
    for (const job of jobs) expect(job).toMatchObject({ fila: 'lote', nao_urgente: true })
    expect(jobs.map((job) => job.execucao).sort()).toEqual(execucoes.map((execucao) => execucao.id).sort())
    expect(jobs.map((job) => job.chave).sort()).toEqual(jobs.map((job) => job.execucao).sort())
  })

  it('a seção corrigida sem execução não é agendada: a correção da coordenação vence', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 2 })
    await sql('update secao_do_material set corrigida_em = now() where id = $1', [material.secoes[0]])

    await agendar(escola.escolaId)

    const [corrigida, livre] = await secoesDe(material.secoes)
    expect(corrigida?.execucao_id).toBeNull()
    expect(livre?.execucao_id).not.toBeNull()
  })

  it.each([
    ['aguardando (execução pendente)', 'pendente' as const],
    ['aguardando (execução rodando)', 'rodando' as const],
    ['classificada ou sem habilidade (execução concluída)', 'concluida' as const],
  ])('%s: a rotina não toca', async (_nome, estado) => {
    const escola = await escolaNova()
    const material = await materialNovo(escola)
    const execucaoId = await execucaoNaSecao(escola, material.secoes, estado, { classificada: estado === 'concluida' })

    await agendar(escola.escolaId)

    expect((await secoesDe(material.secoes))[0]?.execucao_id).toBe(execucaoId)
    expect(await jobsDe(escola.escolaId)).toEqual([])
    expect(await execucoesDa(escola.escolaId)).toHaveLength(1)
  })

  it.each([
    ['o material não está `pronto`', { estado: 'processando' }],
    ['o material foi excluído', { excluido: true }],
    ['o material não tem série declarada', { series: [] }],
  ] as const)('%s: a seção fica sem execução', async (_nome, opcoes) => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, opcoes)

    await agendar(escola.escolaId)

    expect((await secoesDe(material.secoes))[0]?.execucao_id).toBeNull()
    expect(await execucoesDa(escola.escolaId)).toEqual([])
  })

  it('a disciplina sem componente: a seção fica sem execução (o componente definido depois a põe na rotina)', async () => {
    const escola = await escolaNova(null)
    const material = await materialNovo(escola)

    await agendar(escola.escolaId)
    expect((await secoesDe(material.secoes))[0]?.execucao_id).toBeNull()
    expect(await execucoesDa(escola.escolaId)).toEqual([])

    await sql('update disciplina set componente_bncc = $1 where id = $2', ['quimica', escola.disciplinaId])
    await agendar(escola.escolaId)
    expect((await secoesDe(material.secoes))[0]?.execucao_id).not.toBeNull()
  })

  // O isolamento da leitura (o `where` de escola de `proximasSecoes`) é provado no caso "as seções da B não aparecem nas próximas da A", mais abaixo: aqui quem joga fora a seção da B é a busca das séries do
  // material (`#seriesDosMateriais`), e não o `where`, de modo que este caso sozinho não pega a remoção da cláusula de escola da leitura. Não apague aquele achando que repete este.
  it('a rotina da escola A não toca a seção da B', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const daA = await materialNovo(a)
    const daB = await materialNovo(b)

    await agendar(a.escolaId)

    expect((await secoesDe(daA.secoes))[0]?.execucao_id).not.toBeNull()
    expect((await secoesDe(daB.secoes))[0]?.execucao_id).toBeNull()
    expect(await execucoesDa(b.escolaId)).toEqual([])
    expect(await jobsDe(b.escolaId)).toEqual([])
  })

  it('a função suspensa na escola: nenhuma execução, e a retomada volta a agendar; a suspensão da B não vale para a A', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const daA = await materialNovo(a)
    const daB = await materialNovo(b)
    const coordenacao = await bancada.sessoes(b.escolaId, { papel: 'coordenador', quantidade: 1 })
    const suspensao = await sql<{ id: string }>("insert into suspensao_de_funcao (escola_id, funcao, motivo, suspensa_por) values ($1, 'classificacao_do_material', 'decisao_da_escola', $2) returning id", [b.escolaId, coordenacao[0]?.usuarioId])

    await agendar(a.escolaId)
    await agendar(b.escolaId)
    expect((await secoesDe(daA.secoes))[0]?.execucao_id).not.toBeNull()
    expect((await secoesDe(daB.secoes))[0]?.execucao_id).toBeNull()
    expect(await jobsDe(b.escolaId)).toEqual([])
    expect(log.doEvento('classificacao.agendada').some((registro) => registro['escolaId'] === b.escolaId && registro['estado'] === 'suspensa')).toBe(true)

    await sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $2 where id = $1', [suspensao.rows[0]?.id, coordenacao[0]?.usuarioId])
    await agendar(b.escolaId)
    expect((await secoesDe(daB.secoes))[0]?.execucao_id).not.toBeNull()
  })

  it('a suspensão de outra função da escola não suspende a classificação', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola)
    const coordenacao = await bancada.sessoes(escola.escolaId, { papel: 'coordenador', quantidade: 1 })
    await sql("insert into suspensao_de_funcao (escola_id, funcao, motivo, suspensa_por) values ($1, 'tutor_com_o_aluno', 'decisao_da_escola', $2)", [escola.escolaId, coordenacao[0]?.usuarioId])

    await agendar(escola.escolaId)

    expect((await secoesDe(material.secoes))[0]?.execucao_id).not.toBeNull()
  })
})

describe('o teto de três noites e a retomada', () => {
  it('a seção com 3 falhas seguidas não chama o modelo na quarta noite; com 2, sim', async () => {
    const escola = await escolaNova()
    const tres = await materialNovo(escola)
    const duas = await materialNovo(escola)
    const execucaoDaTres = await execucaoNaSecao(escola, tres.secoes, 'falhou', { falhas: 3 })
    await execucaoNaSecao(escola, duas.secoes, 'falhou', { falhas: 2 })

    await agendar(escola.escolaId)

    expect((await secoesDe(tres.secoes))[0]?.execucao_id).toBe(execucaoDaTres)
    expect((await secoesDe(duas.secoes))[0]?.execucao_id).not.toBeNull()
    expect((await jobsDe(escola.escolaId)).map((job) => job.execucao)).not.toContain(execucaoDaTres)
    expect(await jobsDe(escola.escolaId)).toHaveLength(1)
  })

  it('a execução que falhou sem somar (EXECUCAO_INTERROMPIDA, FUNCAO_SUSPENSA) volta na noite seguinte, e a seção segue em execução com as outras sem falha', async () => {
    const escola = await escolaNova()
    const interrompida = await materialNovo(escola, { secoes: 2 })
    const suspensa = await materialNovo(escola)
    await execucaoNaSecao(escola, interrompida.secoes, 'falhou', { erro: 'EXECUCAO_INTERROMPIDA' })
    await execucaoNaSecao(escola, suspensa.secoes, 'falhou', { erro: 'FUNCAO_SUSPENSA' })

    await agendar(escola.escolaId)

    const pendentes = (await execucoesDa(escola.escolaId)).filter((execucao) => execucao.estado === 'pendente')
    // `falhas_seguidas` está em 0 nas três: vão juntas, num recorte só.
    expect(tamanhos(pendentes)).toEqual([3])
  })

  it('a execução de 12 seções falhou por causa de uma: as 12 somam 1, e na noite seguinte saem 12 execuções de uma seção; a seção nova da mesma noite vai em execução separada das com falha', async () => {
    const escola = await escolaNova()
    const doze = await materialNovo(escola, { secoes: 12 })
    const nova = await materialNovo(escola)
    await execucaoNaSecao(escola, doze.secoes, 'falhou', { falhas: 1 })

    await agendar(escola.escolaId)

    const pendentes = (await execucoesDa(escola.escolaId)).filter((execucao) => execucao.estado === 'pendente')
    expect(tamanhos(pendentes)).toEqual([1, ...Array<number>(12).fill(1)])
    const execucaoDaNova = (await secoesDe(nova.secoes))[0]?.execucao_id
    const execucoesDasComFalha = new Set((await secoesDe(doze.secoes)).map((secao) => secao.execucao_id))
    expect(execucoesDasComFalha.size).toBe(12)
    expect(execucoesDasComFalha.has(execucaoDaNova ?? '')).toBe(false)
  })
})

describe('uma execução é de um recorte', () => {
  it('25 seções do mesmo recorte: três execuções (12, 12 e 1), cada seção com o seu `execucao_id`', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 25 })

    await agendar(escola.escolaId)

    const execucoes = await execucoesDa(escola.escolaId)
    expect(tamanhos(execucoes)).toEqual([SECOES_POR_EXECUCAO, SECOES_POR_EXECUCAO, 1])
    expect((await secoesDe(material.secoes)).every((secao) => secao.execucao_id !== null)).toBe(true)
    expect(await jobsDe(escola.escolaId)).toHaveLength(3)
  })

  it('materiais do mesmo componente e das mesmas séries vão juntos; outra série ou outro componente, em execução à parte', async () => {
    const escola = await escolaNova()
    const outraDisciplina = await sql<{ id: string }>("insert into disciplina (escola_id, nome, componente_bncc) values ($1, $2, 'fisica') returning id", [escola.escolaId, `Física ${randomUUID()}`])
    const primeiro = await materialNovo(escola, { secoes: 3 })
    const segundo = await materialNovo(escola, { secoes: 2 })
    const doSexto = await materialNovo(escola, { secoes: 2, series: [escola.serie6] })
    const dasDuas = await materialNovo(escola, { secoes: 2, series: [escola.serie6, escola.serie9] })
    const deFisica = await materialNovo(escola, { secoes: 2, disciplinaId: outraDisciplina.rows[0]?.id ?? '' })

    await agendar(escola.escolaId)

    const execucao = async (material: { secoes: string[] }): Promise<Set<string | null>> => new Set((await secoesDe(material.secoes)).map((secao) => secao.execucao_id))
    expect([...(await execucao(primeiro))]).toEqual([...(await execucao(segundo))])
    expect(tamanhos((await execucoesDa(escola.escolaId)).filter((e) => e.estado === 'pendente'))).toEqual([5, 2, 2, 2])
    const todos = [primeiro, doSexto, dasDuas, deFisica].map(async (material) => [...(await execucao(material))])
    const unicos = new Set((await Promise.all(todos)).flat())
    expect(unicos.size).toBe(4)
  })
})

describe('o laço em lotes e o limite da noite', () => {
  it('mais seções que o lote: cada lote numa transação e todos agendados; o log diz os lotes, as execuções e as seções, sem título nem texto', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 7 })
    const inicio = log.registros().length

    await agendar(escola.escolaId, { lote: 3 })

    expect((await secoesDe(material.secoes)).every((secao) => secao.execucao_id !== null)).toBe(true)
    const feito = log.registros().slice(inicio).find((registro) => registro['evento'] === 'classificacao.agendada' && registro['escolaId'] === escola.escolaId)
    expect(feito).toMatchObject({ estado: 'fim', lotesTotal: 3, secoesTotal: 7 })
    expect(JSON.stringify(log.registros().slice(inicio))).not.toContain('sigilosa')
  })

  it('um lote por transação: quando o segundo lote enfileira, as seções do primeiro já estão gravadas, vistas por outra conexão', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 7 })
    let chamadas = 0
    let gravadasVistas: number | undefined
    const espia: Pick<JobOutbox, 'enfileirarUmaVez'> = {
      enfileirarUmaVez: async (...argumentos) => {
        chamadas += 1
        if (chamadas === 2) gravadasVistas = (await sql<{ n: number }>('select count(*)::int as n from secao_do_material where id = any($1::uuid[]) and execucao_id is not null', [material.secoes])).rows[0]?.n
        return enfileirador.enfileirarUmaVez(...argumentos)
      },
    }

    await agendar(escola.escolaId, { lote: 3, enfileirador: espia })

    expect(gravadasVistas).toBe(3)
  })

  it('um lote por transação: o lote que falha desfaz só ele, e o anterior segue com a execução e o job dele', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 7 })
    let chamadas = 0
    const quebra: Pick<JobOutbox, 'enfileirarUmaVez'> = {
      enfileirarUmaVez: async (...argumentos) => {
        chamadas += 1
        if (chamadas === 2) throw new Error('falha do segundo lote')
        return enfileirador.enfileirarUmaVez(...argumentos)
      },
    }

    await expect(agendar(escola.escolaId, { lote: 3, enfileirador: quebra })).rejects.toThrow('falha do segundo lote')

    const lidas = await secoesDe(material.secoes)
    expect(lidas.filter((secao) => secao.execucao_id !== null)).toHaveLength(3)
    expect(lidas.slice(3).every((secao) => secao.execucao_id === null)).toBe(true)
    expect(await jobsDe(escola.escolaId)).toHaveLength(1)
    expect(await execucoesDa(escola.escolaId)).toHaveLength(1)
  })

  it('a função suspensa entre o primeiro e o segundo lote: o segundo não começa, e o primeiro fica como foi gravado', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 7 })
    const coordenacao = await bancada.sessoes(escola.escolaId, { papel: 'coordenador', quantidade: 1 })
    let chamadas = 0
    const suspende: Pick<JobOutbox, 'enfileirarUmaVez'> = {
      enfileirarUmaVez: async (...argumentos) => {
        chamadas += 1
        if (chamadas === 1) {
          await sql("insert into suspensao_de_funcao (escola_id, funcao, motivo, suspensa_por) values ($1, 'classificacao_do_material', 'decisao_da_escola', $2)", [escola.escolaId, coordenacao[0]?.usuarioId])
        }
        return enfileirador.enfileirarUmaVez(...argumentos)
      },
    }
    const inicio = log.registros().length

    await agendar(escola.escolaId, { lote: 3, enfileirador: suspende })

    const lidas = await secoesDe(material.secoes)
    expect(lidas.filter((secao) => secao.execucao_id !== null)).toHaveLength(3)
    expect(lidas.slice(3).every((secao) => secao.execucao_id === null)).toBe(true)
    expect(log.registros().slice(inicio).some((registro) => registro['evento'] === 'classificacao.agendada' && registro['escolaId'] === escola.escolaId && registro['estado'] === 'suspensa')).toBe(true)
  })

  it('cada lote corre com o `statement_timeout` de 20 s', async () => {
    const escola = await escolaNova()
    await materialNovo(escola, { secoes: 2 })
    let doLote: string | undefined
    const espia: Pick<JobOutbox, 'enfileirarUmaVez'> = {
      enfileirarUmaVez: async (tx, ...resto) => {
        const { rows } = await tx.execute<{ prazo: string }>(consulta`select current_setting('statement_timeout') as prazo`)
        doLote = rows[0]?.prazo
        return enfileirador.enfileirarUmaVez(tx, ...resto)
      },
    }

    await agendar(escola.escolaId, { enfileirador: espia })

    expect(doLote).toBe('20s')
  })

  it('o sinal abortado entre os lotes: o lote em andamento termina por inteiro, o seguinte não começa, e nenhuma seção fica sem execução no meio de um lote', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 7 })
    const controle = new AbortController()
    const aborta: Pick<JobOutbox, 'enfileirarUmaVez'> = {
      enfileirarUmaVez: async (...argumentos) => {
        controle.abort()
        return enfileirador.enfileirarUmaVez(...argumentos)
      },
    }

    await agendar(escola.escolaId, { lote: 3, sinal: controle.signal, enfileirador: aborta })

    const lidas = await secoesDe(material.secoes)
    expect(lidas.filter((secao) => secao.execucao_id !== null)).toHaveLength(3)
    expect(lidas.slice(3).every((secao) => secao.execucao_id === null)).toBe(true)
    expect(log.doEvento('classificacao.agendada').some((registro) => registro['escolaId'] === escola.escolaId && registro['estado'] === 'sinal')).toBe(true)
    // O que sobrou sai na próxima volta, sem duplicar o que já tem execução.
    await agendar(escola.escolaId, { lote: 3 })
    expect((await secoesDe(material.secoes)).every((secao) => secao.execucao_id !== null)).toBe(true)
    // A primeira volta agendou um lote de três; a segunda, os outros quatro em lotes de três e um: o que já tinha execução não foi tocado.
    expect(tamanhos((await execucoesDa(escola.escolaId)).filter((execucao) => execucao.secoes > 0))).toEqual([3, 3, 1])
  })

  it('o limite de execuções da noite: a escola ganha só o que cabe, e o resto sai na noite seguinte', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 5 })
    await execucaoNaSecao(escola, material.secoes, 'falhou', { falhas: 1 })

    await agendar(escola.escolaId, { limiteDeExecucoes: 2 })

    const pendentes = (await execucoesDa(escola.escolaId)).filter((execucao) => execucao.estado === 'pendente')
    expect(pendentes).toHaveLength(2)
    expect(await jobsDe(escola.escolaId)).toHaveLength(2)
    expect(log.doEvento('classificacao.agendada').some((registro) => registro['escolaId'] === escola.escolaId && registro['estado'] === 'limite')).toBe(true)
    const semExecucaoNova = (await secoesDe(material.secoes)).filter((secao) => !pendentes.some((execucao) => execucao.id === secao.execucao_id))
    expect(semExecucaoNova).toHaveLength(3)

    // Na noite seguinte, mais duas das três que sobraram ganham execução (as duas de antes seguem `aguardando`), e a última fica para a outra.
    await agendar(escola.escolaId, { limiteDeExecucoes: 2 })
    expect((await execucoesDa(escola.escolaId)).filter((execucao) => execucao.estado === 'pendente')).toHaveLength(4)
    await agendar(escola.escolaId, { limiteDeExecucoes: 2 })
    expect((await execucoesDa(escola.escolaId)).filter((execucao) => execucao.estado === 'pendente')).toHaveLength(5)
  })
})

describe('a leitura das próximas seções', () => {
  const proximas = (escolaId: string, limite: number, filtro: { depoisDe?: string; materialId?: string } = {}): Promise<SecaoParaAgendar[]> =>
    naEscola(escolaId, () => bancada.banco.transaction((tx) => new AgendamentoDaClassificacaoRepository(tx).proximasSecoes(limite, filtro)))

  it.each([
    ['a seção de disciplina sem componente não ocupa vaga do lote', 'sem_componente' as const],
    ['a seção de material sem série declarada não ocupa vaga do lote', 'sem_serie' as const],
  ])('%s: com o limite de 1, a lida é a da seção que a rotina agenda', async (_nome, falta) => {
    const escola = await escolaNova()
    const semComponente = await sql<{ id: string }>('insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escola.escolaId, `Sem componente ${randomUUID()}`])
    // O material sem a condição vem primeiro (id menor): se a leitura não o filtrasse, ele ocuparia o limite e a da rotina ficaria de fora.
    await materialNovo(escola, falta === 'sem_componente' ? { disciplinaId: semComponente.rows[0]?.id ?? '' } : { series: [] })
    const agendavel = await materialNovo(escola)

    const lidas = await proximas(escola.escolaId, 1)

    expect(lidas.map((secao) => secao.secaoId)).toEqual(agendavel.secoes)
  })

  it('a seção corrigida pela coordenação não é lida, mesmo sem execução', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 2 })
    await sql('update secao_do_material set corrigida_em = now() where id = $1', [material.secoes[0]])

    const lidas = await proximas(escola.escolaId, 10)

    expect(lidas.map((secao) => secao.secaoId)).toEqual([material.secoes[1]])
  })

  it('só é lida a seção sem execução ou a que falhou abaixo do teto: a pendente, a rodando e a concluída ficam de fora', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 5 })
    await execucaoNaSecao(escola, [material.secoes[0] ?? ''], 'pendente')
    await execucaoNaSecao(escola, [material.secoes[1] ?? ''], 'rodando')
    await execucaoNaSecao(escola, [material.secoes[2] ?? ''], 'concluida', { classificada: true })
    await execucaoNaSecao(escola, [material.secoes[3] ?? ''], 'falhou', { falhas: 1 })

    const lidas = await proximas(escola.escolaId, 10)

    expect(lidas.map((secao) => secao.secaoId).sort()).toEqual([material.secoes[3] ?? '', material.secoes[4] ?? ''].sort())
  })

  it('depois do cursor: só as seções de id maior que o dado, na ordem do id', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 4 })
    const todas = (await proximas(escola.escolaId, 10)).map((secao) => secao.secaoId)
    expect(todas).toEqual([...material.secoes].sort())

    const depois = (await proximas(escola.escolaId, 10, { depoisDe: todas[1] ?? '' })).map((secao) => secao.secaoId)

    expect(depois).toEqual(todas.slice(2))
  })

  it('o material que perdeu a série entre a leitura e o agendamento fica sem execução, e sem job', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 2 })
    const lidas = await proximas(escola.escolaId, 10)
    await sql('delete from material_serie where escola_id = $1 and material_id = $2', [escola.escolaId, material.materialId])

    const agendado = await naEscola(escola.escolaId, () => bancada.banco.transaction((tx) => new AgendamentoDaClassificacaoRepository(tx).agendar(lidas, enfileirador)))

    expect(agendado).toEqual({ execucoes: 0, secoes: 0 })
    expect((await secoesDe(material.secoes)).every((secao) => secao.execucao_id === null)).toBe(true)
    expect(await jobsDe(escola.escolaId)).toEqual([])
  })

  it('a seção que a coordenação corrigiu entre a leitura e o agendamento não ganha execução: a correção vence', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 3 })
    const lidas = await proximas(escola.escolaId, 10)
    await sql('update secao_do_material set corrigida_em = now() where id = $1', [material.secoes[0]])

    const agendado = await naEscola(escola.escolaId, () => bancada.banco.transaction((tx) => new AgendamentoDaClassificacaoRepository(tx).agendar(lidas, enfileirador)))

    expect(agendado.secoes).toBe(2)
    const lidasDepois = await secoesDe(material.secoes)
    expect(lidasDepois.find((secao) => secao.id === material.secoes[0])?.execucao_id).toBeNull()
    expect(lidasDepois.filter((secao) => secao.execucao_id !== null)).toHaveLength(2)
  })
})

describe('[P] P9: dois agendamentos da mesma seção ao mesmo tempo', () => {
  /** Lê as seções numa transação e a segura até `soltar`: é o agendamento que leu antes do outro e agenda depois dele. */
  async function agendamentoParadoDepoisDeLer(escolaId: string): Promise<{ leu: Promise<void>; soltar: () => void; terminou: Promise<{ execucoes: number; secoes: number }> }> {
    let soltar: () => void = () => undefined
    const liberado = new Promise<void>((resolver) => {
      soltar = resolver
    })
    let leu: () => void = () => undefined
    const jaLeu = new Promise<void>((resolver) => {
      leu = resolver
    })
    const terminou = naEscola(escolaId, () =>
      bancada.banco.transaction(async (tx) => {
        const repositorio = new AgendamentoDaClassificacaoRepository(tx)
        const lidas: SecaoParaAgendar[] = await repositorio.proximasSecoes(500)
        leu()
        await liberado
        return repositorio.agendar(lidas, enfileirador)
      }),
    )
    return { leu: jaLeu, soltar, terminou }
  }

  it('a rotina duas vezes: o primeiro parado depois de ler, o segundo agenda por inteiro; o primeiro não cria execução nem job', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 4 })
    const parado = await agendamentoParadoDepoisDeLer(escola.escolaId)
    await parado.leu

    await agendar(escola.escolaId)
    parado.soltar()
    const perdido = await parado.terminou

    expect(perdido).toEqual({ execucoes: 0, secoes: 0 })
    const execucoes = await execucoesDa(escola.escolaId)
    expect(execucoes).toHaveLength(1)
    expect(execucoes[0]?.secoes).toBe(4)
    expect(await jobsDe(escola.escolaId)).toHaveLength(1)
    expect(new Set((await secoesDe(material.secoes)).map((secao) => secao.execucao_id)).size).toBe(1)
  })

  it('a seção da execução que falhou, lida pelas duas rotinas: uma execução só', async () => {
    const escola = await escolaNova()
    const material = await materialNovo(escola, { secoes: 2 })
    await execucaoNaSecao(escola, material.secoes, 'falhou', { falhas: 1 })
    const parado = await agendamentoParadoDepoisDeLer(escola.escolaId)
    await parado.leu

    await agendar(escola.escolaId)
    parado.soltar()
    await parado.terminou

    const pendentes = (await execucoesDa(escola.escolaId)).filter((execucao) => execucao.estado === 'pendente')
    expect(pendentes).toHaveLength(2)
    expect(await jobsDe(escola.escolaId)).toHaveLength(2)
  })
})

describe('isolamento: o repository, no contexto da A, só lê e só grava a escola da A', () => {
  it('as seções da B não aparecem nas próximas da A, e o agendamento da A com a seção da B na mão não troca nada', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    await materialNovo(a, { secoes: 2 })
    const daB = await materialNovo(b, { secoes: 2 })
    const lidasDaB = await naEscola(b.escolaId, () => bancada.banco.transaction((tx) => new AgendamentoDaClassificacaoRepository(tx).proximasSecoes(10)))
    expect(lidasDaB.map((secao) => secao.secaoId).sort()).toEqual([...daB.secoes].sort())

    const resultado = await naEscola(a.escolaId, () =>
      bancada.banco.transaction(async (tx) => {
        const repositorio = new AgendamentoDaClassificacaoRepository(tx)
        // O material da B pedido no contexto da A: o resultado não depende do que mais há elegível no banco (o limite e a ordem por id deixariam as seções da B, as mais novas, fora de uma leitura sem filtro).
        expect(await repositorio.proximasSecoes(10, { materialId: daB.materialId })).toEqual([])
        // O agendamento da A com as seções da B: a troca leva a escola da A, e a FK composta impede a execução da A de apontar para seção de B.
        return repositorio.agendar(lidasDaB, enfileirador)
      }),
    )

    expect(resultado.secoes).toBe(0)
    expect((await secoesDe(daB.secoes)).every((secao) => secao.execucao_id === null)).toBe(true)
  })
})
