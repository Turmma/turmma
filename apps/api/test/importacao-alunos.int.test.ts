import { createDatabase, createPool, executarPlanilha, MotorDePlanilha, runInContext, schema, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, MAXIMO_DE_BYTES_DA_PLANILHA, MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR, MAXIMO_DE_LINHAS_DA_PLANILHA, previaDaPlanilhaResponseSchema } from '@educa/shared'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { FerramentasDaSala } from './sala.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * A planilha de alunos, pela prévia e pelo gravar (F2, tarefa 7.0; `tasks/prd-onboarding-por-convite/cenarios.md`, RF2, RF3 e
 * "Corridas"): a turma escrita de três jeitos, a turma que a escola não tem, os erros de linha, os tetos, o isolamento entre escolas
 * e as corridas da turma com o gerar acesso, o encerrar do ano e a criação à mão. O job pelo processador do worker, com as corridas
 * entre o passo (2) e o (3), está em `apps/worker/test/gravar-planilha-alunos.int.test.ts`. Postgres real do compose de teste;
 * escolas, turmas, nomes e matrículas gerados (regra 20, item 17).
 */

const CABECALHO = 'turma;nome;matricula'
const PREFIXO = `alu${randomUUID().slice(0, 6)}`
const ENTRADA_INVALIDA = { status: 400, codigo: ErrorCode.ENTRADA_INVALIDA }
const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }
const CONFLITO = { status: 409, codigo: ErrorCode.CONFLITO }

/** Uma escola com 2026 em curso e 2027 planejado, montados pela API como a coordenação faria. */
interface Escola {
  readonly escolaId: string
  readonly coordenacao: TestSessao
  readonly emCurso: string
  readonly planejado: string
}

let contador = 0
/** A matrícula desta execução, única por chamada: a lista e a credencial são da escola, mas o banco de teste acumula. */
const matricula = (): string => `${PREFIXO}-${String((contador += 1))}`
const texto = (...linhas: string[]): string => [CABECALHO, ...linhas].join('\n')
const linha = (turma: string, nome = `Aluno Sintético ${randomUUID().slice(0, 6)}`, m = matricula()): string => `${turma};${nome};${m}`

/** A turma da linha `i`: 32 turmas distintas (6º ao 9º, letras de A a H). */
const turmaDe = (i: number): string => `${String(6 + (i % 4))}${String.fromCharCode(97 + (Math.floor(i / 4) % 8))}`

function erroDe(resposta: RespostaHttp): { status: number; codigo: unknown } {
  return { status: resposta.status, codigo: (resposta.corpo.erro as { codigo?: unknown } | undefined)?.codigo }
}

describe('planilha de alunos (F2, tarefa 7.0): prévia, gravar e as corridas da turma', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let sala: FerramentasDaSala
  /** O pool dos jobs e das paradas: o da bancada tem 2 conexões, e a parada segura uma e o job outra. */
  let apoio: DatabasePool
  let bancoDoJob: Database

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {})
    sala = new FerramentasDaSala(api, bancada)
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
  const previa = (e: Escola, planilha: string, extra: Record<string, unknown> = {}) => pedir(e.coordenacao, 'POST', '/v1/importacoes/alunos/previa', { texto: planilha, ...extra })
  const gravar = (e: Escola, planilha: string, extra: Record<string, unknown> = {}) => pedir(e.coordenacao, 'POST', '/v1/importacoes/alunos', { texto: planilha, ...extra })

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

  /** A série da escola, criada pela API (a que já existe não se repete: o banco recusa). */
  const serieNova = (e: Escola, etapa: 'ef_anos_finais' | 'em', ano: number) => criado(pedir(e.coordenacao, 'POST', '/v1/series', { etapa, ano }))

  /** A turma do ano em curso com o nome e a `chave` dados, pelo banco: a chave nula é o que a migration deixa onde o ano tinha duas de mesma chave. */
  async function turmaNoBanco(e: Escola, serieId: string, nome: string, chave: string | null): Promise<string> {
    const { rows } = await apoio.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [e.escolaId, e.emCurso, serieId, nome, chave])
    return rows[0]?.id ?? ''
  }

  /** Arma o gatilho, roda `corpo` e o desarma, também quando `corpo` falha. */
  async function comParada<T>(gatilho: WriteBlockTrigger, corpo: () => Promise<T>): Promise<T> {
    await gatilho.armar()
    try {
      return await corpo()
    } finally {
      await gatilho.desarmar()
    }
  }

  const lida = (resposta: RespostaHttp) => {
    expect(resposta.status).toBe(200)
    return previaDaPlanilhaResponseSchema.parse(resposta.corpo)
  }

  const importacoesDe = async (escolaId: string) => (await bancada.pool.query<{ id: string; estado: string }>('select id, estado from importacao_planilha where escola_id = $1 order by id', [escolaId])).rows
  const jobsDe = async (escolaId: string) => (await bancada.pool.query('select 1 from job_registro where escola_id = $1', [escolaId])).rows.length
  const turmasDe = async (escolaId: string) => (await bancada.pool.query<{ nome: string; chave: string | null }>('select nome, chave from turma where escola_id = $1 order by nome', [escolaId])).rows
  const nomesDaLista = async (escolaId: string) => (await bancada.pool.query<{ total: number }>('select count(*)::int as total from lista_nome where escola_id = $1', [escolaId])).rows[0]?.total ?? 0

  /** Roda o job uma vez (tentativa 1), no contexto da escola do job, como o executor o abre. */
  const rodar = (escolaId: string, importacaoId: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => executarPlanilha(bancoDoJob, importacaoId))

  it('a turma escrita de três jeitos ("8ºA", "8 A" e "8a") é uma turma só: a prévia diz "turma nova" uma vez, e gravar responde 202 e enfileira', async () => {
    const e = await escolaComAnos()
    const planilha = texto(linha('8ºA'), linha('8 A'), linha('8a'))

    const resposta = lida(await previa(e, planilha))

    expect(resposta).toEqual({
      linhas: [
        { linha: 2, resultado: 'entra' },
        { linha: 3, resultado: 'entra' },
        { linha: 4, resultado: 'entra' },
      ],
      contagens: { entram: 3, ja_existem: 0, turmas_novas: 1 },
      candidatos: [],
    })
    expect(await turmasDe(e.escolaId)).toEqual([])
    const gravada = await gravar(e, planilha)
    expect(gravada.status).toBe(202)
    expect(await importacoesDe(e.escolaId)).toEqual([{ id: gravada.corpo['id'], estado: 'na_fila' }])
    expect(await jobsDe(e.escolaId)).toBe(1)
  })

  it('a turma que a escola já tem casa pelas três grafias: nenhuma turma nova, e a chave da turma decide, não o nome escrito', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 8)
    await turmaNoBanco(e, serie, '8ºA', '8a')
    await turmaNoBanco(e, serie, '8ºB', '8b')

    const resposta = lida(await previa(e, texto(linha('8A'), linha('8 a'), linha('8º ano A'), linha('8 B'))))

    expect(resposta.linhas.map((l) => l.resultado)).toEqual(['entra', 'entra', 'entra', 'entra'])
    expect(resposta.contagens).toEqual({ entram: 4, ja_existem: 0, turmas_novas: 0 })
  })

  it('três linhas erradas ("Turma Azul", "10A", aluno sem nome): a prévia aponta as três com o código, as boas seguem "entra", e gravar responde ENTRADA_INVALIDA sem importação nem job', async () => {
    const e = await escolaComAnos()
    const planilha = texto(linha('8A'), linha('Turma Azul'), linha('10A'), `8A;;${matricula()}`, linha('9B'))

    const resposta = lida(await previa(e, planilha))

    expect(resposta.linhas).toEqual([
      { linha: 2, resultado: 'entra' },
      { linha: 3, resultado: 'erro', erro: 'turma_invalida' },
      { linha: 4, resultado: 'erro', erro: 'turma_invalida' },
      { linha: 5, resultado: 'erro', erro: 'sem_nome' },
      { linha: 6, resultado: 'entra' },
    ])
    expect(resposta.contagens).toEqual({ entram: 2, ja_existem: 0, turmas_novas: 2 })
    expect(erroDe(await gravar(e, planilha))).toEqual(ENTRADA_INVALIDA)
    expect(await importacoesDe(e.escolaId)).toEqual([])
    expect(await jobsDe(e.escolaId)).toBe(0)
    expect(await turmasDe(e.escolaId)).toEqual([])
  })

  it('a turma que o texto escreve mas a escola não pode ter ("4A" e "0B" fora do recorte, "6AB" com letra a mais) é erro, nunca turma nova; a vazia tem o código dela', async () => {
    const e = await escolaComAnos()

    const resposta = lida(await previa(e, texto(linha('4A'), linha('0B'), linha('6AB'), linha(''), linha('6A'))))

    expect(resposta.linhas.map((l) => [l.resultado, l.erro])).toEqual([
      ['erro', 'turma_invalida'],
      ['erro', 'turma_invalida'],
      ['erro', 'turma_invalida'],
      ['erro', 'turma_vazia'],
      ['entra', undefined],
    ])
  })

  it('duas turmas da escola com a mesma chave (as que a migration deixou com chave nula): a prévia dá erro na linha, pelas duas grafias, e a turma de outra chave segue', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 8)
    await turmaNoBanco(e, serie, '8A', null)
    await turmaNoBanco(e, serie, '8º A', null)
    await turmaNoBanco(e, serie, '8B', '8b')
    expect(await turmasDe(e.escolaId)).toEqual([
      { nome: '8A', chave: null },
      { nome: '8B', chave: '8b' },
      { nome: '8º A', chave: null },
    ])

    const resposta = lida(await previa(e, texto(linha('8A'), linha('8 º a'), linha('8B'))))

    expect(resposta.linhas.map((l) => [l.resultado, l.erro])).toEqual([
      ['erro', 'turma_ambigua'],
      ['erro', 'turma_ambigua'],
      ['entra', undefined],
    ])
    expect(erroDe(await gravar(e, texto(linha('8A'))))).toEqual(ENTRADA_INVALIDA)
  })

  it('"8A" renomeada para "9B": a planilha com "8A" não casa e vira turma nova; a com "9B" casa com a turma renomeada', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 8)
    const id = await criado(pedir(e.coordenacao, 'POST', '/v1/turmas', { serieId: serie, nome: '8A' }))
    expect((await pedir(e.coordenacao, 'PATCH', `/v1/turmas/${id}`, { nome: '9B' })).status).toBe(200)

    expect(lida(await previa(e, texto(linha('8A')))).contagens).toEqual({ entram: 1, ja_existem: 0, turmas_novas: 1 })
    expect(lida(await previa(e, texto(linha('9B')))).contagens).toEqual({ entram: 1, ja_existem: 0, turmas_novas: 0 })
    expect(lida(await previa(e, texto(linha('9 b')))).contagens).toEqual({ entram: 1, ja_existem: 0, turmas_novas: 0 })
  })

  it('a turma e a lista de outro ano da mesma escola não contam: a "8A" e a matrícula do ano planejado não casam com a planilha do ano em curso, e a do planejado casa com elas', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 8)
    const noPlanejado = await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [e.escolaId, e.planejado, serie, '8A', '8a'])
    const deOutroAno = matricula()
    await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) values ($1, $2, $3, $4, $5)', [e.escolaId, e.planejado, noPlanejado.rows[0]?.id, 'Aluno Do Ano Seguinte', deOutroAno])
    const planilha = texto(linha('8A', 'Aluno Deste Ano', deOutroAno))
    // Com o mesmo nome do banco: o nome diferente seria "nome corrigido" (8.0), e aqui o que se prova é só que a matrícula casa no ano dela.
    const doPlanejado = texto(linha('8A', 'Aluno Do Ano Seguinte', deOutroAno))

    expect(lida(await previa(e, planilha)).contagens).toEqual({ entram: 1, ja_existem: 0, turmas_novas: 1 })
    expect(lida(await previa(e, doPlanejado, { anoLetivoId: e.planejado })).contagens).toEqual({ entram: 0, ja_existem: 1, turmas_novas: 0 })
  })

  it('o nome fora do padrão só casa com turma de mesmo nome: "Turma Azul" existente recebe a linha, "Turma Verde" que a escola não tem é erro', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'em', 1)
    await turmaNoBanco(e, serie, 'Turma Azul', null)

    const resposta = lida(await previa(e, texto(linha('turma  AZUL'), linha('Turma Verde'))))

    expect(resposta.linhas.map((l) => [l.resultado, l.erro])).toEqual([
      ['entra', undefined],
      ['erro', 'turma_invalida'],
    ])
    expect(resposta.contagens.turmas_novas).toBe(0)
  })

  it('matrícula repetida na planilha: erro nas duas linhas, mesmo com turmas e nomes diferentes, e a terceira linha não é afetada', async () => {
    const e = await escolaComAnos()
    const repetida = matricula()

    const resposta = lida(await previa(e, texto(linha('8A', 'Ana Primeira', repetida), linha('9A', 'Bia Segunda', repetida), linha('8A'))))

    expect(resposta.linhas.map((l) => [l.resultado, l.erro])).toEqual([
      ['erro', 'matricula_repetida'],
      ['erro', 'matricula_repetida'],
      ['entra', undefined],
    ])
  })

  it('matrícula em notação científica no CSV (o que o Excel faz com o número comprido) é erro na linha; a de CPF pontuado e a de data também', async () => {
    const e = await escolaComAnos()

    const resposta = lida(await previa(e, texto('8A;Fulano Um;1,2345E+11', '8A;Fulano Dois;1.2345e11', '8A;Fulano Três;123.456.789-09', '8A;Fulano Quatro;01/02/2012', linha('8A'))))

    expect(resposta.linhas.map((l) => l.erro)).toEqual(['matricula_notacao_cientifica', 'matricula_notacao_cientifica', 'matricula_parece_documento', 'matricula_parece_documento', undefined])
  })

  it('homônimos com matrículas diferentes são dois alunos: as duas linhas entram', async () => {
    const e = await escolaComAnos()

    const resposta = lida(await previa(e, texto(linha('8A', 'Maria da Silva'), linha('8A', 'Maria da Silva'))))

    expect(resposta.linhas.map((l) => l.resultado)).toEqual(['entra', 'entra'])
    expect(resposta.contagens.entram).toBe(2)
  })

  it('o erro da linha vem na ordem em que a coordenação o corrige: turma, nome, matrícula; e uma linha com campo a menos é "linha_incompleta"', async () => {
    const e = await escolaComAnos()

    const resposta = lida(await previa(e, texto(';Sem Turma;m1', '8A;;m2', '8A;Sem Matrícula;', '8A;Só duas colunas', `8A;${'n'.repeat(201)};m3`)))

    expect(resposta.linhas.map((l) => l.erro)).toEqual(['turma_vazia', 'sem_nome', 'sem_matricula', 'linha_incompleta', 'nome_invalido'])
  })

  it('isolamento: a matrícula da escola B na planilha da A "entra" (na A, a de A é "já existe"), e a turma "8A" da B não casa com a da A, que sai "turma nova"', async () => {
    const a = await escolaComAnos()
    const b = await escolaComAnos()
    const serieB = await serieNova(b, 'ef_anos_finais', 8)
    const turmaB = await turmaNoBanco(b, serieB, '8A', '8a')
    const daB = matricula()
    const daA = matricula()
    await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) values ($1, $2, $3, $4, $5)', [b.escolaId, b.emCurso, turmaB, 'Aluno da B', daB])
    const alunoDaB = (await bancada.sessoes(b.escolaId, { papel: 'aluno', quantidade: 1 }))[0]
    const credencialDaB = matricula()
    await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula) values ($1, $2, $3)', [b.escolaId, alunoDaB?.usuarioId, credencialDaB])
    const serieA = await serieNova(a, 'ef_anos_finais', 8)
    const turmaA = await turmaNoBanco(a, serieA, '8B', '8b')
    await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) values ($1, $2, $3, $4, $5)', [a.escolaId, a.emCurso, turmaA, 'Aluno da A', daA])

    const resposta = lida(await previa(a, texto(linha('8A', 'Outro Nome', daB), linha('8A', 'Mais Um', credencialDaB), linha('8B', 'Aluno da A', daA))))

    expect(resposta.linhas.map((l) => l.resultado)).toEqual(['entra', 'entra', 'ja_existe'])
    expect(resposta.contagens).toEqual({ entram: 2, ja_existem: 1, turmas_novas: 1 })
  })

  it('a matrícula que a escola já tem (na lista de qualquer turma do ano, ou com credencial de aluno) é "já existe" e não grava nada: nem nome, nem turma', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 7)
    const turma = await turmaNoBanco(e, serie, '7A', '7a')
    const naLista = matricula()
    const comCredencial = matricula()
    await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) values ($1, $2, $3, $4, $5)', [e.escolaId, e.emCurso, turma, 'Aluno Já Listado', naLista])
    const aluno = (await bancada.sessoes(e.escolaId, { papel: 'aluno', quantidade: 1 }))[0]
    await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula) values ($1, $2, $3)', [e.escolaId, aluno?.usuarioId, comCredencial])
    const planilha = texto(linha('7A', 'Aluno Já Listado', naLista), linha('7B', 'Aluno Com Credencial', comCredencial), linha('7A'))

    const resposta = lida(await previa(e, planilha))

    expect(resposta.linhas.map((l) => l.resultado)).toEqual(['ja_existe', 'ja_existe', 'entra'])
    expect(resposta.contagens).toEqual({ entram: 1, ja_existem: 2, turmas_novas: 0 })
  })

  it('a prévia que mostra nome do banco (o rótulo do candidato a desligar) grava `turma.alunos_lidos` com a finalidade e a quantidade, sem nome; a que não mostra nenhum, não grava', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 7)
    const turma = await turmaNoBanco(e, serie, '7A', '7a')
    for (const nome of ['Aluno Ausente Um', 'Aluno Ausente Dois']) {
      await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) values ($1, $2, $3, $4, $5)', [e.escolaId, e.emCurso, turma, nome, matricula()])
    }
    const lidas = async () => (await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string; antes: unknown; depois: unknown; finalidade: string }>(
      "select entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = 'turma.alunos_lidos' order by em, id",
      [e.escolaId],
    )).rows

    // Só linhas de turma que a escola não tem: nenhum aluno do banco aparece, nada é lido.
    expect(lida(await previa(e, texto(linha('7B')))).candidatos).toEqual([])
    expect(await lidas()).toEqual([])

    // A planilha cita a 7A e traz outra matrícula: os dois nomes da 7A viram candidatos a desligar, com o rótulo, e a leitura é auditada.
    const resposta = lida(await previa(e, texto(linha('7A'))))
    expect(resposta.candidatos.map((c) => c.acao)).toEqual(['desligar', 'desligar'])
    expect(await lidas()).toEqual([{ entidade_id: turma, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { quantidade: 2 }, finalidade: 'conferencia_de_cadastro' }])
    expect(JSON.stringify(await lidas())).not.toContain('Aluno Ausente')
  })

  it('o desligamento tem teto por gravar (16.0): 101 marcas são ENTRADA_INVALIDA, sem importação nem job; 100 passam, o job desliga as 100 e a que ficou sem marca continua na lista', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 7)
    const turma = await turmaNoBanco(e, serie, '7A', '7a')
    const ausentes = MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR + 1
    await bancada.pool.query(
      "insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) select $1, $2, $3, 'Ausente Sintético ' || n, $4 || n from generate_series(1, $5) as n",
      [e.escolaId, e.emCurso, turma, `${PREFIXO}-aus-`, ausentes],
    )
    const planilha = texto(linha('7A'))
    const candidatos = lida(await previa(e, planilha)).candidatos.filter((c) => c.acao === 'desligar')
    expect(candidatos).toHaveLength(ausentes)
    const ids = candidatos.map((c) => c.id)

    expect(erroDe(await gravar(e, planilha, { marcas: { desligar: ids } }))).toEqual(ENTRADA_INVALIDA)
    expect(await importacoesDe(e.escolaId)).toEqual([])
    expect(await jobsDe(e.escolaId)).toBe(0)

    const id = await criado(gravar(e, planilha, { marcas: { desligar: ids.slice(0, MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR) } }), 202)
    expect(await rodar(e.escolaId, id)).toBe('concluida')
    // Na turma da planilha ficam o nome que ela trouxe e o único ausente sem marca (o 101º candidato), pelo id: a conta não depende do nome.
    const naTurma = (await bancada.pool.query<{ id: string }>('select id from lista_nome where escola_id = $1 and turma_id = $2', [e.escolaId, turma])).rows.map((linha) => linha.id)
    expect(naTurma).toHaveLength(2)
    expect(naTurma).toContain(ids[MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR])
    expect(await nomesDaLista(e.escolaId)).toBe(2)
    // "A sua escolha fica registrada": a auditoria diz quem desligou cada um e quando (regra 20, item 10), e só os marcados estão nela.
    const retirados = (await bancada.pool.query<{ entidade_id: string; autor_usuario_id: string; em: Date }>("select entidade_id, autor_usuario_id, em from auditoria where escola_id = $1 and acao = 'lista_nome.retirado'", [e.escolaId])).rows
    expect(retirados).toHaveLength(MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR)
    expect(new Set(retirados.map((linha) => linha.entidade_id))).toEqual(new Set(ids.slice(0, MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR)))
    expect(new Set(retirados.map((linha) => linha.autor_usuario_id))).toEqual(new Set([e.coordenacao.usuarioId]))
    expect(retirados.every((linha) => linha.em instanceof Date)).toBe(true)
  }, 60_000)

  it('3.001 linhas ou mais de 512 KB: ENTRADA_INVALIDA na prévia e no gravar, sem importação; 3.000 linhas entram, em 32 turmas, e o job as grava', async () => {
    const e = await escolaComAnos()
    const linhas = Array.from({ length: MAXIMO_DE_LINHAS_DA_PLANILHA }, (_, i) => linha(turmaDe(i), `Aluno ${String(i)}`))

    const demais = texto(...linhas, linha('8A'))
    expect(erroDe(await previa(e, demais))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await gravar(e, demais))).toEqual(ENTRADA_INVALIDA)
    const pesada = texto(...Array.from({ length: 2_200 }, (_, i) => linha('8A', `${'x'.repeat(250)}${String(i)}`)))
    expect(Buffer.byteLength(pesada, 'utf8')).toBeGreaterThan(MAXIMO_DE_BYTES_DA_PLANILHA)
    expect(erroDe(await previa(e, pesada))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await gravar(e, pesada))).toEqual(ENTRADA_INVALIDA)
    expect(await importacoesDe(e.escolaId)).toEqual([])

    const todas = texto(...linhas)
    const resposta = lida(await previa(e, todas))
    expect(resposta.contagens).toEqual({ entram: MAXIMO_DE_LINHAS_DA_PLANILHA, ja_existem: 0, turmas_novas: 32 })
    const id = await criado(gravar(e, todas), 202)
    expect(await rodar(e.escolaId, id)).toBe('concluida')
    expect(await nomesDaLista(e.escolaId)).toBe(MAXIMO_DE_LINHAS_DA_PLANILHA)
    expect((await turmasDe(e.escolaId)).length).toBe(32)
  }, 60_000)

  it('as consultas da prévia são as mesmas com 30 e com 3.000 linhas (contadas, nunca cronometradas): o número de consultas não cresce com a planilha', async () => {
    const e = await escolaComAnos()
    const consultas: string[] = []
    const espiado = drizzle({ client: apoio, schema, casing: 'snake_case', logger: { logQuery: (consulta: string) => consultas.push(consulta) } }) as unknown as Database
    const motor = new MotorDePlanilha(espiado, { enfileirar: () => Promise.resolve(randomUUID()) })
    const contexto = { requisicaoId: randomUUID(), escolaId: e.escolaId, usuarioId: e.coordenacao.usuarioId, papel: 'coordenador' as const, sessaoId: randomUUID(), anoLetivoId: e.emCurso }
    const quantas = async (n: number): Promise<number> => {
      consultas.length = 0
      const planilha = texto(...Array.from({ length: n }, (_, i) => linha(turmaDe(i), `Aluno ${String(i)}`)))
      const resultado = await runInContext(contexto, () => motor.previa('alunos', { texto: planilha }))
      expect(resultado.linhas).toHaveLength(n)
      return consultas.length
    }

    const com30 = await quantas(30)
    const com3000 = await quantas(MAXIMO_DE_LINHAS_DA_PLANILHA)

    expect(com30).toBeGreaterThan(0)
    expect(com3000).toBe(com30)
  }, 30_000)

  it('escola sem ano em curso: sem o filtro a prévia e o gravar respondem NAO_ENCONTRADO; com o ano planejado funcionam; o ano de outra escola e o `turmaId` no corpo, também NAO_ENCONTRADO', async () => {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const planejado = await anoNovo(coordenacao, 2027, false)
    const e: Escola = { escolaId, coordenacao, emCurso: '', planejado }
    const outra = await escolaComAnos()
    const planilha = texto(linha('8A'))

    expect(erroDe(await previa(e, planilha))).toEqual(NAO_ENCONTRADO)
    expect(erroDe(await gravar(e, planilha))).toEqual(NAO_ENCONTRADO)
    expect(lida(await previa(e, planilha, { anoLetivoId: planejado })).contagens).toEqual({ entram: 1, ja_existem: 0, turmas_novas: 1 })
    expect((await gravar(e, planilha, { anoLetivoId: planejado })).status).toBe(202)
    expect(erroDe(await previa(e, planilha, { anoLetivoId: outra.planejado }))).toEqual(NAO_ENCONTRADO)
    expect(erroDe(await previa(outra, planilha, { turmaId: randomUUID() }))).toEqual(NAO_ENCONTRADO)
  })

  it('o professor e o aluno não alcançam a planilha de alunos: NAO_ENCONTRADO na prévia e no gravar', async () => {
    const e = await escolaComAnos()
    for (const papel of ['professor', 'aluno'] as const) {
      const sessao = await bancada.sessao(e.escolaId, papel)
      expect(erroDe(await pedir(sessao, 'POST', '/v1/importacoes/alunos/previa', { texto: texto(linha('8A')) })), papel).toEqual(NAO_ENCONTRADO)
      expect(erroDe(await pedir(sessao, 'POST', '/v1/importacoes/alunos', { texto: texto(linha('8A')) })), papel).toEqual(NAO_ENCONTRADO)
    }
    expect(await importacoesDe(e.escolaId)).toEqual([])
  })

  it('[P] a criação à mão de "8º A" (direto no banco) parada contra o job que cria "8A": uma turma só, a que perde viola o único da `chave`, e a API responde CONFLITO depois', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 8)
    const id = await criado(gravar(e, texto(linha('8A'))), 202)
    const gatilho = new WriteBlockTrigger(apoio, { tabela: 'turma', evento: 'insert', quando: `new.escola_id = '${e.escolaId}'::uuid` })

    // Dentro da janela do job (o `lock_timeout` de 1 s do passo (3)) só vai o que é direto no banco: o `insert` de quem perde espera o índice único da `chave`, que o job já ocupa (o padrão não casa o `insert into "turma"` do próprio job, que também espera, no gatilho).
    const [job, aMao] = await comParada(gatilho, async () => {
      const rodando = rodar(e.escolaId, id)
      await gatilho.esperarParadas()
      const criando = turmaNoBanco(e, serie, '8º A', '8a').then(
        () => null,
        (erro: unknown) => erro,
      )
      await esperarNaTrava(apoio, '%insert into turma %')
      await gatilho.soltar()
      return Promise.all([rodando, criando])
    })

    expect(job).toBe('concluida')
    expect(aMao).toMatchObject({ code: '23505' })
    expect(await turmasDe(e.escolaId)).toEqual([{ nome: '8A', chave: '8a' }])
    // A resposta da API para quem perde, fora da janela: a "8A" do job já existe, e a criação pela API vira CONFLITO.
    expect(erroDe(await pedir(e.coordenacao, 'POST', '/v1/turmas', { serieId: serie, nome: '8º A' }))).toEqual(CONFLITO)
    expect(await turmasDe(e.escolaId)).toEqual([{ nome: '8A', chave: '8a' }])
  })

  it('[P] a renomeação de "8B" para "8A" (direto no banco) parada contra o job que cria "8A": uma turma "8A", a que perde viola o único da `chave`, e a API responde CONFLITO depois', async () => {
    const e = await escolaComAnos()
    const serie = await serieNova(e, 'ef_anos_finais', 8)
    const outra = await criado(pedir(e.coordenacao, 'POST', '/v1/turmas', { serieId: serie, nome: '8B' }))
    const id = await criado(gravar(e, texto(linha('8A'))), 202)
    const gatilho = new WriteBlockTrigger(apoio, { tabela: 'turma', evento: 'insert', quando: `new.escola_id = '${e.escolaId}'::uuid and new.chave = '8a'` })

    const [job, renomeacao] = await comParada(gatilho, async () => {
      const rodando = rodar(e.escolaId, id)
      await gatilho.esperarParadas()
      const renomeando = apoio.query("update turma set nome = '8A', chave = '8a' where id = $1", [outra]).then(
        () => null,
        (erro: unknown) => erro,
      )
      await esperarNaTrava(apoio, '%update turma set%')
      await gatilho.soltar()
      return Promise.all([rodando, renomeando])
    })

    expect(job).toBe('concluida')
    expect(renomeacao).toMatchObject({ code: '23505' })
    const esperadas = [
      { nome: '8A', chave: '8a' },
      { nome: '8B', chave: '8b' },
    ]
    expect(await turmasDe(e.escolaId)).toEqual(esperadas)
    // A resposta da API para quem perde, fora da janela.
    expect(erroDe(await pedir(e.coordenacao, 'PATCH', `/v1/turmas/${outra}`, { nome: '8A' }))).toEqual(CONFLITO)
    expect(await turmasDe(e.escolaId)).toEqual(esperadas)
  })

  it('[P] o passo (3) contra o gerar acesso na mesma turma, nas duas ordens: um espera o outro, o job conclui, o acesso nasce (201), e nenhum dos dois leva deadlock nem 503', async () => {
    const s = await sala.montar()
    const e: Escola = { escolaId: s.escolaId, coordenacao: s.coordenacao, emCurso: s.anoLetivoId, planejado: '' }
    // (a) O gerar parado depois do `insert` do acesso (já com a turma em `FOR SHARE`): o passo (3) espera a turma e conclui quando ele termina.
    const primeiro = await criado(gravar(e, texto(linha('2ºB'))), 202)
    const doAcesso = new WriteBlockTrigger(apoio, { tabela: 'acesso_turma', evento: 'insert', quando: `new.turma_id = '${s.turma}'::uuid` })
    const [gerado, job] = await comParada(doAcesso, async () => {
      const gerando = chamar(api.url, 'POST', `/v1/turmas/${s.turma}/acesso`, s.professor.token, { validadeDias: 7 })
      await doAcesso.esperarParadas()
      const rodando = rodar(e.escolaId, primeiro)
      await esperarNaTrava(apoio, '%"turma"%for no key update%')
      await doAcesso.soltar()
      return Promise.all([gerando, rodando])
    })
    expect(gerado.status).toBe(201)
    expect(job).toBe('concluida')
    // (b) O job parado depois de gravar a lista (com a turma em `FOR NO KEY UPDATE`): o gerar espera a trava e nasce depois.
    const segundo = await criado(gravar(e, texto(linha('2ºB'))), 202)
    const daLista = new WriteBlockTrigger(apoio, { tabela: 'lista_nome', evento: 'insert', quando: `new.escola_id = '${e.escolaId}'::uuid and new.turma_id = '${s.turma}'::uuid` })
    // Dentro da janela só o que é direto no banco: o `FOR SHARE` na turma que o gerar pede espera o `FOR NO KEY UPDATE` do job.
    const [job2, tomado] = await comParada(daLista, async () => {
      const rodando = rodar(e.escolaId, segundo)
      await daLista.esperarParadas()
      const gerando = apoio.query('select id from turma where id = $1 for share', [s.turma])
      await esperarNaTrava(apoio, '%from turma where id = $1 for share%')
      await daLista.soltar()
      return Promise.all([rodando, gerando])
    })
    expect(job2).toBe('concluida')
    expect(tomado.rowCount).toBe(1)
    const gerado2 = await chamar(api.url, 'POST', `/v1/turmas/${s.turma}/acesso`, s.professor.token, { validadeDias: 7 })
    expect(gerado2.status).toBe(201)
    const { rows } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from lista_nome where escola_id = $1 and turma_id = $2 and criado_por = $3', [e.escolaId, s.turma, e.coordenacao.usuarioId])
    expect(rows[0]?.total).toBe(2)
  }, 60_000)

  it('[P] o passo (3) parado depois de gravar a lista contra o encerrar do ano (direto no banco): o encerrar espera o `FOR SHARE` do ano, o job conclui e o nome fica gravado; zero deadlock', async () => {
    const e = await escolaComAnos()
    const id = await criado(gravar(e, texto(linha('8A'))), 202)
    const gatilho = new WriteBlockTrigger(apoio, { tabela: 'lista_nome', evento: 'insert', quando: `new.escola_id = '${e.escolaId}'::uuid` })

    // Direto no banco: o job espera a trava só 1 s, e o encerrar precisa chegar a ela dentro disso.
    const [job, encerrado] = await comParada(gatilho, async () => {
      const rodando = rodar(e.escolaId, id)
      await gatilho.esperarParadas()
      const encerrando = apoio.query("update ano_letivo set situacao = 'encerrado' where id = $1", [e.emCurso])
      await esperarNaTrava(apoio, '%update ano_letivo set%')
      await gatilho.soltar()
      return Promise.all([rodando, encerrando])
    })

    expect(job).toBe('concluida')
    expect(encerrado.rowCount).toBe(1)
    expect(await nomesDaLista(e.escolaId)).toBe(1)
  }, 30_000)
})
