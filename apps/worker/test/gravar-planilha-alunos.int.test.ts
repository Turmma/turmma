import 'reflect-metadata'
import { createDatabase, createPool, ehFalhaDeTrava, MotorDePlanilha, runInContext, schema, type Database, type DatabasePool } from '@educa/core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { esperarNaTrava } from '../../api/test/write-block-trigger.js'
import { JobFailureError } from '../src/job-failure.error.js'
import { criarGravacaoDaPlanilha } from '../src/processors/gravar-planilha.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

beforeAll(() => {
  // Worker do compose de pé poderia executar o job que o teste grava, e disputar a importação com o processador do próprio teste.
  compose('stop', ...PROCESSOS_DA_FILA)
})

/**
 * A planilha de alunos pelo job `estrutura.gravar-planilha` (F2, tarefa 7.0; Tech Spec do onboarding, seção 5, "O job" e "Gravar",
 * "Alunos"; `cenarios.md`, RF3 e "Corridas"), pelo processador do worker, uma tentativa por chamada. O que cada tentativa deixa no
 * banco: a turma e a série novas, a lista de nomes `livre`, a auditoria `turma.criada`, e o que acontece quando a turma, a matrícula
 * ou o ano mudam entre o passo (2) e o (3). A prévia, os tetos e as rotas estão em `apps/api/test/importacao-alunos.int.test.ts`.
 */

const SEM_MARCAS = { transferir: [], desligar: [], encerrar: [] }
const PREFIXO = `alu${randomUUID().slice(0, 6)}`
let contador = 0
const matricula = (): string => `${PREFIXO}-${String((contador += 1))}`

interface Escola {
  readonly escolaId: string
  readonly coordenadorId: string
  /** O ano em curso, ou `undefined` na escola que só tem o planejado. */
  readonly anoId: string | undefined
  readonly planejadoId: string
}

describe('estrutura.gravar-planilha, planilha de alunos', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const medidor = new MedidorDeTeste()
  /** O pool dos jobs em corrida e das paradas: o da bancada tem poucas conexões, e cada parada segura uma. */
  let apoio: DatabasePool
  let bancoDoJob: Database
  let gravacao: ReturnType<typeof criarGravacaoDaPlanilha>

  beforeAll(() => {
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 10, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    bancoDoJob = createDatabase(apoio)
    gravacao = criarGravacaoDaPlanilha({ banco: bancoDoJob, logger: log.logger, medidor: medidor.medidor })
  })

  afterAll(async () => {
    await apoio.end()
    await medidor.encerrar()
    await bancada.fechar()
  })

  /** Um ano de 2026 ou 2027 da escola, na situação dada. */
  async function anoDe(escolaId: string, ano: 2026 | 2027, situacao: 'em_curso' | 'planejado'): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2, $3, $4, $5) returning id', [escolaId, ano, `${String(ano)}-02-01`, `${String(ano)}-12-15`, situacao])
    return rows[0]?.id ?? ''
  }

  /** A escola com a coordenação que grava, o ano de 2026 (em curso, ou só planejado) e, na que tem ano em curso, o de 2027 planejado. */
  async function escolaNova(emCurso = true): Promise<Escola> {
    const escolaId = await bancada.escola()
    const anoId = await anoDe(escolaId, 2026, emCurso ? 'em_curso' : 'planejado')
    const planejadoId = emCurso ? await anoDe(escolaId, 2027, 'planejado') : anoId
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`${PREFIXO}-coord-${randomUUID().slice(0, 6)}@escola.invalid`])
    const { rows: pessoa } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética', $2) returning id", [escolaId, conta[0]?.id])
    return { escolaId, coordenadorId: pessoa[0]?.id ?? '', anoId: emCurso ? anoId : undefined, planejadoId }
  }

  async function serieDe(escola: Escola, etapa: 'ef_anos_finais' | 'em', ano: number): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into serie (escola_id, etapa, ano) values ($1, $2, $3) returning id', [escola.escolaId, etapa, ano])
    return rows[0]?.id ?? ''
  }

  /** A turma do ano em curso (ou do `anoId` dado) com a `chave` dada, pelo banco. */
  async function turmaNoBanco(escola: Escola, serieId: string, nome: string, chave: string | null, anoId = escola.anoId): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [escola.escolaId, anoId, serieId, nome, chave])
    return rows[0]?.id ?? ''
  }

  const texto = (...linhas: string[]): string => ['turma;nome;matricula', ...linhas].join('\n')
  const linha = (turma: string, nome = `Aluno Sintético ${randomUUID().slice(0, 6)}`, m = matricula()): string => `${turma};${nome};${m}`

  /** O gravar da coordenação, pelo motor (sem fila): devolve o id da importação `na_fila`. */
  function gravar(escola: Escola, planilha: string, anoLetivoId?: string): Promise<string> {
    const motor = new MotorDePlanilha(bancada.banco, { enfileirar: () => Promise.resolve(randomUUID()) })
    const contexto = { requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenadorId, papel: 'coordenador' as const, sessaoId: randomUUID(), ...(escola.anoId === undefined ? {} : { anoLetivoId: escola.anoId }) }
    return runInContext(contexto, async () => (await motor.gravar('alunos', { texto: planilha, marcas: SEM_MARCAS, ...(anoLetivoId === undefined ? {} : { anoLetivoId }) })).id)
  }

  /** Uma tentativa do job, como o executor a entrega: no contexto da escola da linha do outbox. */
  function tentar(escolaId: string, importacaoId: string, tentativa = 1): Promise<void> {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => gravacao({ importacaoId }, jobExecution(randomUUID(), tentativa)))
  }

  async function importacao(importacaoId: string): Promise<{ estado: string; erro: string | null; linhas: unknown; marcas: unknown; resumo: Record<string, number> | null }> {
    const { rows } = await bancada.pool.query<{ estado: string; erro: string | null; linhas: unknown; marcas: unknown; resumo: Record<string, number> | null }>('select estado, erro, linhas, marcas, resumo from importacao_planilha where id = $1', [importacaoId])
    return rows[0] ?? { estado: 'sumiu', erro: null, linhas: undefined, marcas: undefined, resumo: null }
  }

  interface TurmaNoBanco {
    readonly nome: string
    readonly chave: string | null
    readonly etapa: string
    readonly serie: number
    readonly ano: string
    readonly alunos: number
  }

  /** As turmas da escola, com a série, o ano e quantos nomes tem cada uma. */
  async function turmasDe(escolaId: string): Promise<TurmaNoBanco[]> {
    const { rows } = await bancada.pool.query<TurmaNoBanco>(
      `select t.nome, t.chave, s.etapa, s.ano as serie, a.ano::text as ano, (select count(*)::int from lista_nome l where l.turma_id = t.id) as alunos
         from turma t join serie s on s.id = t.serie_id and s.escola_id = t.escola_id join ano_letivo a on a.id = t.ano_letivo_id and a.escola_id = t.escola_id
        where t.escola_id = $1 order by t.nome`,
      [escolaId],
    )
    return rows
  }

  const seriesDe = async (escolaId: string): Promise<Array<{ etapa: string; ano: number }>> => (await bancada.pool.query<{ etapa: string; ano: number }>('select etapa, ano from serie where escola_id = $1 order by etapa, ano', [escolaId])).rows
  const nomesDe = async (escolaId: string) =>
    (await bancada.pool.query<{ nome: string; matricula: string; estado: string; turma: string; criado_por: string | null }>("select l.nome, l.matricula, l.estado, t.nome as turma, l.criado_por from lista_nome l join turma t on t.id = l.turma_id where l.escola_id = $1 order by l.nome", [escolaId])).rows
  const totalDeNomes = async (escolaId: string): Promise<number> => (await bancada.pool.query<{ total: number }>('select count(*)::int as total from lista_nome where escola_id = $1', [escolaId])).rows[0]?.total ?? 0

  async function auditoriaDa(escolaId: string, acao: string): Promise<Array<{ entidade_id: string; autor_usuario_id: string | null; depois: unknown }>> {
    const { rows } = await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string | null; depois: unknown }>('select entidade_id, autor_usuario_id, depois from auditoria where escola_id = $1 and acao = $2 order by id', [escolaId, acao])
    return rows
  }

  async function resultados(): Promise<Record<string, number>> {
    const pontos = await medidor.pontos('importacao.job')
    return Object.fromEntries(pontos.map(({ atributos, valor }) => [String(atributos['resultado']), valor as number]))
  }

  /**
   * Segura a importação em `FOR UPDATE`, deixa o job passar pelo passo (2) e esperar no (3), roda `mexer` com o job parado, solta a
   * trava e espera o job terminar: é o "entre o (2) e o (3)" dos cenários.
   */
  async function entreOs2e3(escola: Escola, importacaoId: string, mexer: () => Promise<void>): Promise<void> {
    const segurador = await bancada.pool.connect()
    let tentativa: Promise<void>
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [importacaoId])
      tentativa = tentar(escola.escolaId, importacaoId)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%')
      await mexer()
      await segurador.query('commit')
    } finally {
      segurador.release()
    }
    await tentativa
  }

  /**
   * Abre uma transação que escreve o que o job também vai escrever e **não confirma**, deixa o job chegar à escrita (que espera no
   * índice único), confirma, e espera o job terminar: o único violado de verdade, e não a diferença que o passo (3) já enxerga.
   */
  async function escritaParadaContraOJob(escola: Escola, importacaoId: string, escrever: (consulta: (sql: string, parametros: unknown[]) => Promise<unknown>) => Promise<void>, esperaPor: string): Promise<void> {
    const segurador = await bancada.pool.connect()
    let tentativa: Promise<void>
    try {
      await segurador.query('begin')
      await escrever((sql, parametros) => segurador.query(sql, parametros))
      tentativa = tentar(escola.escolaId, importacaoId)
      await esperarNaTrava(bancada.pool, esperaPor)
      await segurador.query('commit')
    } finally {
      segurador.release()
    }
    await tentativa
  }

  it('o job cria a turma e a série que faltam, grava a lista `livre` da coordenação e audita `turma.criada` com a série e `planilha.gravada` com as contagens, sem nome nem matrícula', async () => {
    const escola = await escolaNova()
    const m = [matricula(), matricula(), matricula(), matricula()]
    const id = await gravar(escola, texto(`8ºA;Ana Souza;${m[0]}`, `8 A;Bruno Lima;${m[1]}`, `8a;Carla Dias;${m[2]}`, `1ª ano B;Davi Rocha;${m[3]}`))

    await tentar(escola.escolaId, id)

    // Retenção (docs/lgpd.md): concluída, a importação não guarda mais as linhas (nome e matrícula) nem as marcas.
    expect(await importacao(id)).toEqual({ estado: 'concluida', erro: null, linhas: null, marcas: null, resumo: { entram: 4, ja_existem: 0, turmas_novas: 2 } })
    expect(await turmasDe(escola.escolaId)).toEqual([
      { nome: '1ª ano B', chave: '1b', etapa: 'em', serie: 1, ano: '2026', alunos: 1 },
      { nome: '8ºA', chave: '8a', etapa: 'ef_anos_finais', serie: 8, ano: '2026', alunos: 3 },
    ])
    expect(await seriesDe(escola.escolaId)).toEqual([
      { etapa: 'ef_anos_finais', ano: 8 },
      { etapa: 'em', ano: 1 },
    ])
    expect(await nomesDe(escola.escolaId)).toEqual([
      { nome: 'Ana Souza', matricula: m[0], estado: 'livre', turma: '8ºA', criado_por: escola.coordenadorId },
      { nome: 'Bruno Lima', matricula: m[1], estado: 'livre', turma: '8ºA', criado_por: escola.coordenadorId },
      { nome: 'Carla Dias', matricula: m[2], estado: 'livre', turma: '8ºA', criado_por: escola.coordenadorId },
      { nome: 'Davi Rocha', matricula: m[3], estado: 'livre', turma: '1ª ano B', criado_por: escola.coordenadorId },
    ])
    const criadas = await auditoriaDa(escola.escolaId, 'turma.criada')
    expect(criadas.map((c) => c.depois)).toEqual([
      { serie: { etapa: 'em', ano: 1 }, origem: 'planilha' },
      { serie: { etapa: 'ef_anos_finais', ano: 8 }, origem: 'planilha' },
    ])
    expect(criadas.every((c) => c.autor_usuario_id === escola.coordenadorId)).toBe(true)
    const [gravada] = await auditoriaDa(escola.escolaId, 'planilha.gravada')
    expect(gravada?.depois).toEqual({ tipo: 'alunos', contagens: { entram: 4, ja_existem: 0, turmas_novas: 2 } })
    const serializado = JSON.stringify([...criadas, gravada])
    expect(serializado).not.toMatch(/Ana|Bruno|Carla|Davi|8ºA/)
    for (const a of m) expect(serializado).not.toContain(a)
  })

  it('a série que a escola já tem é reaproveitada, e a turma que ela já tem recebe os nomes pelas três grafias, sem turma nova: os alunos de duas turmas vão cada um para a sua', async () => {
    const escola = await escolaNova()
    const oitavo = await serieDe(escola, 'ef_anos_finais', 8)
    await turmaNoBanco(escola, oitavo, '8ºA', '8a')
    await turmaNoBanco(escola, oitavo, '8ºB', '8b')
    const id = await gravar(escola, texto(linha('8A', 'Ana'), linha('8 a', 'Bia'), linha('8º ano A', 'Cris'), linha('8B', 'Davi'), linha('8ºC', 'Eva')))

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).resumo).toEqual({ entram: 5, ja_existem: 0, turmas_novas: 1 })
    expect(await turmasDe(escola.escolaId)).toEqual([
      { nome: '8ºA', chave: '8a', etapa: 'ef_anos_finais', serie: 8, ano: '2026', alunos: 3 },
      { nome: '8ºB', chave: '8b', etapa: 'ef_anos_finais', serie: 8, ano: '2026', alunos: 1 },
      { nome: '8ºC', chave: '8c', etapa: 'ef_anos_finais', serie: 8, ano: '2026', alunos: 1 },
    ])
    expect(await seriesDe(escola.escolaId)).toEqual([{ etapa: 'ef_anos_finais', ano: 8 }])
  })

  it('a turma nova nasce com o nome da primeira linha que a pediu, e a mesma turma pedida de outro jeito mais adiante vai para ela', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, texto(linha('9 º  b'), linha('9B'), linha('9ºb')))

    await tentar(escola.escolaId, id)

    expect((await turmasDe(escola.escolaId)).map((t) => [t.nome, t.alunos])).toEqual([['9 º b', 3]])
  })

  it('escola sem ano em curso: com o filtro do ano planejado a turma nova nasce nele, e o nome fica na lista dele', async () => {
    const escola = await escolaNova(false)
    const id = await gravar(escola, texto(linha('6A')), escola.planejadoId)

    await tentar(escola.escolaId, id)

    expect((await importacao(id)).estado).toBe('concluida')
    expect(await turmasDe(escola.escolaId)).toEqual([{ nome: '6A', chave: '6a', etapa: 'ef_anos_finais', serie: 6, ano: '2026', alunos: 1 }])
    const { rows } = await bancada.pool.query<{ ano_letivo_id: string }>('select l.ano_letivo_id from lista_nome l where l.escola_id = $1', [escola.escolaId])
    expect(rows).toEqual([{ ano_letivo_id: escola.planejadoId }])
  })

  it('a mesma planilha duas vezes: a matrícula que já está na lista é "já existe", não grava nem cria a turma que só ela pedia, e a segunda importação conclui sem mudar o banco', async () => {
    const escola = await escolaNova()
    const m = [matricula(), matricula()]
    const planilha = texto(`8A;Ana;${m[0]}`, `9C;Bia;${m[1]}`)
    await tentar(escola.escolaId, await gravar(escola, planilha))
    const antes = { turmas: await turmasDe(escola.escolaId), nomes: await nomesDe(escola.escolaId) }

    const segunda = await gravar(escola, planilha)
    await tentar(escola.escolaId, segunda)

    expect(await importacao(segunda)).toMatchObject({ estado: 'concluida', resumo: { entram: 0, ja_existem: 2, turmas_novas: 0 } })
    expect({ turmas: await turmasDe(escola.escolaId), nomes: await nomesDe(escola.escolaId) }).toEqual(antes)
    expect((await auditoriaDa(escola.escolaId, 'turma.criada')).length).toBe(2)
    // A matrícula ainda não vista entra, e a turma que só ela pedia nasce.
    const terceira = await gravar(escola, texto(`8A;Ana;${m[0]}`, linha('7D')))
    await tentar(escola.escolaId, terceira)
    expect((await importacao(terceira)).resumo).toEqual({ entram: 1, ja_existem: 1, turmas_novas: 1 })
  })

  it('isolamento: a matrícula e a turma da escola B não alteram nada na B quando a planilha é da A; a A grava a matrícula "da B" na turma "8A" dela, e a "8A" da B segue como estava', async () => {
    const a = await escolaNova()
    const b = await escolaNova()
    const serieB = await serieDe(b, 'ef_anos_finais', 8)
    const turmaB = await turmaNoBanco(b, serieB, '8A', '8a')
    const daB = matricula()
    await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) values ($1, $2, $3, $4, $5)', [b.escolaId, b.anoId, turmaB, 'Aluno da B', daB])
    const id = await gravar(a, texto(`8A;Aluno da A;${daB}`))

    await tentar(a.escolaId, id)

    expect((await importacao(id)).resumo).toEqual({ entram: 1, ja_existem: 0, turmas_novas: 1 })
    expect(await nomesDe(a.escolaId)).toEqual([{ nome: 'Aluno da A', matricula: daB, estado: 'livre', turma: '8A', criado_por: a.coordenadorId }])
    expect(await nomesDe(b.escolaId)).toEqual([{ nome: 'Aluno da B', matricula: daB, estado: 'livre', turma: '8A', criado_por: null }])
    expect((await turmasDe(b.escolaId)).map((t) => t.alunos)).toEqual([1])
  })

  it('homônimos com matrículas diferentes são dois alunos na mesma turma', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, texto(linha('8A', 'Maria da Silva'), linha('8A', 'Maria da Silva')))

    await tentar(escola.escolaId, id)

    expect((await nomesDe(escola.escolaId)).map((n) => n.nome)).toEqual(['Maria da Silva', 'Maria da Silva'])
  })

  it('[P] "8º A" criada à mão (ainda não confirmada) contra o "8A" do job: o job espera o índice único, sai `desatualizada` na primeira tentativa, e nada da planilha fica', async () => {
    const escola = await escolaNova()
    const serie = await serieDe(escola, 'ef_anos_finais', 8)
    const id = await gravar(escola, texto(linha('8A')))

    await escritaParadaContraOJob(
      escola,
      id,
      async (consulta) => {
        await consulta('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5)', [escola.escolaId, escola.anoId, serie, '8º A', '8a'])
      },
      '%insert into "turma"%',
    )

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada', erro: null, linhas: null, marcas: null })
    expect((await turmasDe(escola.escolaId)).map((t) => [t.nome, t.alunos])).toEqual([['8º A', 0]])
    expect(await totalDeNomes(escola.escolaId)).toBe(0)
    expect(await auditoriaDa(escola.escolaId, 'turma.criada')).toEqual([])
    expect(await auditoriaDa(escola.escolaId, 'planilha.gravada')).toEqual([])
  })

  it('[P] "8B" renomeada para "8A" (ainda não confirmada) contra o job que cria "8A": o job sai `desatualizada` na primeira tentativa, e há uma "8A" só', async () => {
    const escola = await escolaNova()
    const serie = await serieDe(escola, 'ef_anos_finais', 8)
    const outra = await turmaNoBanco(escola, serie, '8B', '8b')
    const id = await gravar(escola, texto(linha('8A')))

    await escritaParadaContraOJob(
      escola,
      id,
      async (consulta) => {
        await consulta("update turma set nome = '8A', chave = '8a' where id = $1", [outra])
      },
      '%insert into "turma"%',
    )

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada' })
    expect((await turmasDe(escola.escolaId)).map((t) => [t.nome, t.alunos])).toEqual([['8A', 0]])
    expect(await totalDeNomes(escola.escolaId)).toBe(0)
  })

  it('[P] "8º A" criada à mão e confirmada entre o passo (2) e o (3): o (3) já a vê, a linha deixa de ser "turma nova", e a importação sai `desatualizada` sem criar a "8A"', async () => {
    const escola = await escolaNova()
    const serie = await serieDe(escola, 'ef_anos_finais', 8)
    const id = await gravar(escola, texto(linha('8A')))

    await entreOs2e3(escola, id, async () => {
      await turmaNoBanco(escola, serie, '8º A', '8a')
    })

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada' })
    expect((await turmasDe(escola.escolaId)).map((t) => [t.nome, t.alunos])).toEqual([['8º A', 0]])
  })

  it('[P] turma tocada renomeada de "8A" para "9B" entre o passo (2) e o (3): `desatualizada`, e nenhum aluno da linha "8A" vai para a "9B"', async () => {
    const escola = await escolaNova()
    const serie = await serieDe(escola, 'ef_anos_finais', 8)
    const turma = await turmaNoBanco(escola, serie, '8A', '8a')
    const id = await gravar(escola, texto(linha('8A', 'Ana'), linha('8 A', 'Bia')))

    await entreOs2e3(escola, id, async () => {
      await bancada.pool.query("update turma set nome = '9B', chave = '9b' where id = $1", [turma])
    })

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada', linhas: null })
    expect(await turmasDe(escola.escolaId)).toEqual([{ nome: '9B', chave: '9b', etapa: 'ef_anos_finais', serie: 8, ano: '2026', alunos: 0 }])
    expect(await totalDeNomes(escola.escolaId)).toBe(0)
  })

  it('[P] nome avulso com a matrícula M lançado entre o passo (2) e o (3): `desatualizada` na primeira tentativa, a avulsa intacta, zero nomes da planilha e a turma nova desfeita', async () => {
    const escola = await escolaNova()
    const serie = await serieDe(escola, 'ef_anos_finais', 9)
    const turma = await turmaNoBanco(escola, serie, '9A', '9a')
    const m = matricula()
    const id = await gravar(escola, texto(`9A;Da Planilha;${m}`, linha('7C')))

    await entreOs2e3(escola, id, async () => {
      await bancada.pool.query("insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, criado_por) values ($1, $2, $3, 'Avulsa à mão', $4, $5)", [escola.escolaId, escola.anoId, turma, m, escola.coordenadorId])
    })

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada', erro: null })
    expect(await nomesDe(escola.escolaId)).toEqual([{ nome: 'Avulsa à mão', matricula: m, estado: 'livre', turma: '9A', criado_por: escola.coordenadorId }])
    expect((await turmasDe(escola.escolaId)).map((t) => t.nome)).toEqual(['9A'])
  })

  it('[P] nome avulso com a matrícula M escrito e ainda não confirmado quando o job grava: o único da lista barra, o job sai `desatualizada` na primeira tentativa (e não `falhou`), e nada da planilha fica', async () => {
    const escola = await escolaNova()
    const serie = await serieDe(escola, 'ef_anos_finais', 9)
    const turma = await turmaNoBanco(escola, serie, '9A', '9a')
    const m = matricula()
    const id = await gravar(escola, texto(`9A;Da Planilha;${m}`))

    await escritaParadaContraOJob(
      escola,
      id,
      async (consulta) => {
        await consulta("insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) values ($1, $2, $3, 'Avulsa à mão', $4)", [escola.escolaId, escola.anoId, turma, m])
      },
      '%insert into "lista_nome"%',
    )

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada', erro: null })
    expect(await nomesDe(escola.escolaId)).toEqual([{ nome: 'Avulsa à mão', matricula: m, estado: 'livre', turma: '9A', criado_por: null }])
  })

  it('[P] aluno aprovado com a matrícula M lançado entre o passo (2) e o (3): o (3) lê a credencial, a linha vira "já existe", e a importação sai `desatualizada` (a releitura sob a trava do passo (3) vê a credencial e a assinatura muda; a `credencial_matricula` não tem único contra a `lista_nome`)', async () => {
    const escola = await escolaNova()
    const m = matricula()
    const id = await gravar(escola, texto(`9A;Da Planilha;${m}`))

    await entreOs2e3(escola, id, async () => {
      const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Aluno aprovado à mão') returning id", [escola.escolaId])
      await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula) values ($1, $2, $3)', [escola.escolaId, rows[0]?.id, m])
    })

    expect(await importacao(id)).toMatchObject({ estado: 'desatualizada' })
    expect(await totalDeNomes(escola.escolaId)).toBe(0)
    expect(await turmasDe(escola.escolaId)).toEqual([])
  })

  it('[P] duas execuções do mesmo job, a segunda depois de classificar e antes de gravar: uma turma, um conjunto de nomes, uma `concluida` e uma `ignorada`', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, texto(linha('8A'), linha('8A'), linha('9B')))
    const antes = await resultados()
    const segurador = await bancada.pool.connect()
    let primeira: Promise<void>
    let segunda: Promise<void>
    try {
      await segurador.query('begin')
      await segurador.query('select id from importacao_planilha where id = $1 for update', [id])
      primeira = tentar(escola.escolaId, id)
      segunda = tentar(escola.escolaId, id)
      await esperarNaTrava(bancada.pool, '%importacao_planilha%for update%', 2)
      await segurador.query('commit')
    } finally {
      segurador.release()
    }
    await Promise.all([primeira, segunda])

    expect((await turmasDe(escola.escolaId)).map((t) => [t.nome, t.alunos])).toEqual([
      ['8A', 2],
      ['9B', 1],
    ])
    expect((await auditoriaDa(escola.escolaId, 'turma.criada')).length).toBe(2)
    expect((await auditoriaDa(escola.escolaId, 'planilha.gravada')).length).toBe(1)
    const depois = await resultados()
    expect((depois['concluida'] ?? 0) - (antes['concluida'] ?? 0)).toBe(1)
    expect((depois['ignorada'] ?? 0) - (antes['ignorada'] ?? 0)).toBe(1)
  })

  it('turma travada por mais de 1 s (como o gerar acesso a segura): o passo (3) estoura o `lock_timeout` sem escrever nada, a importação segue `na_fila`, e a nova tentativa conclui', async () => {
    const escola = await escolaNova()
    const serie = await serieDe(escola, 'ef_anos_finais', 8)
    const turma = await turmaNoBanco(escola, serie, '8A', '8a')
    const id = await gravar(escola, texto(linha('8A'), linha('9D')))
    const segurador = await bancada.pool.connect()
    let erro: unknown
    try {
      await segurador.query('begin')
      await segurador.query('select id from turma where id = $1 for share', [turma])
      erro = await tentar(escola.escolaId, id).then(
        () => undefined,
        (falha: unknown) => falha,
      )
      await segurador.query('rollback')
    } finally {
      segurador.release()
    }

    expect(ehFalhaDeTrava(erro)).toBe(true)
    expect(await importacao(id)).toMatchObject({ estado: 'na_fila' })
    expect(await totalDeNomes(escola.escolaId)).toBe(0)
    expect((await turmasDe(escola.escolaId)).map((t) => t.nome)).toEqual(['8A'])
    await tentar(escola.escolaId, id, 2)
    expect(await importacao(id)).toMatchObject({ estado: 'concluida', resumo: { entram: 2, ja_existem: 0, turmas_novas: 1 } })
    expect(await totalDeNomes(escola.escolaId)).toBe(2)
  })

  it('o passo (3) trava as turmas que as linhas tocam num único `for no key update` em ordem de id, depois do ano e antes de escrever qualquer coisa; a turma que a planilha não toca não é travada', async () => {
    const escola = await escolaNova()
    const serie = await serieDe(escola, 'ef_anos_finais', 8)
    const tocadas = [await turmaNoBanco(escola, serie, '8A', '8a'), await turmaNoBanco(escola, serie, '8B', '8b')]
    const intocada = await turmaNoBanco(escola, serie, '8C', '8c')
    const id = await gravar(escola, texto(linha('8A'), linha('8B'), linha('8 B')))
    const sqlDoJob: string[] = []
    const parametrosDoJob: unknown[][] = []
    const espiado = drizzle({
      client: apoio,
      schema,
      casing: 'snake_case',
      logger: {
        logQuery: (consulta: string, parametros: unknown[]) => {
          sqlDoJob.push(consulta.toLowerCase())
          parametrosDoJob.push(parametros)
        },
      },
    }) as unknown as Database
    const espiao = criarGravacaoDaPlanilha({ banco: espiado, logger: log.logger })

    await runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId }, () => espiao({ importacaoId: id }, jobExecution(randomUUID(), 1)))

    const posicao = (padrao: RegExp): number => sqlDoJob.findIndex((consulta) => padrao.test(consulta))
    const travasDeTurma = sqlDoJob.filter((consulta) => /^select .*from "turma".* for no key update$/.test(consulta))
    expect(travasDeTurma).toHaveLength(1)
    expect(travasDeTurma[0]).toMatch(/order by "turma"\."id" asc for no key update$/)
    const daTravaDeTurma = posicao(/^select .*from "turma".* for no key update$/)
    expect(parametrosDoJob[daTravaDeTurma]).toEqual(expect.arrayContaining([escola.escolaId, escola.anoId, ...tocadas]))
    expect(parametrosDoJob[daTravaDeTurma]).not.toContain(intocada)
    expect(posicao(/^select .*from "importacao_planilha".* for update$/)).toBeLessThan(posicao(/^select .*from "ano_letivo".* for share$/))
    expect(posicao(/^select .*from "ano_letivo".* for share$/)).toBeLessThan(daTravaDeTurma)
    expect(daTravaDeTurma).toBeLessThan(posicao(/^insert into "lista_nome"/))
    expect(await importacao(id)).toMatchObject({ estado: 'concluida' })
  })

  it('falha definitiva: as linhas guardadas sem a forma do tipo saem `falhou` na primeira tentativa, sem repetir, e nada é gravado', async () => {
    const escola = await escolaNova()
    const id = await gravar(escola, texto(linha('8A')))
    await bancada.pool.query('update importacao_planilha set linhas = $2::jsonb where id = $1', [id, JSON.stringify([{ linha: 2, turma: '8A' }])])

    // O processor embrulha o `ImportacaoIlegivelError` do motor em falha definitiva: o BullMQ não repete.
    const falha = tentar(escola.escolaId, id)
    await expect(falha).rejects.toBeInstanceOf(JobFailureError)
    await expect(falha).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS', definitiva: true })

    expect(await importacao(id)).toMatchObject({ estado: 'falhou', erro: 'erro_interno', linhas: null })
    expect(await turmasDe(escola.escolaId)).toEqual([])
  })
})
