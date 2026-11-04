import { createDatabase, createPool, executarPlanilha, runInContext, SchoolSemaphore, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, LIMITE_DA_PLANILHA_POR_MINUTO, listaDaTurmaResponseSchema, previaDaPlanilhaResponseSchema, MAXIMO_DE_BYTES_DA_LISTA, MAXIMO_DE_LINHAS_DA_LISTA, MENSAGENS_DE_ERRO, VAGAS_DA_PLANILHA_POR_ESCOLA } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { VAGAS_DA_PLANILHA } from '../src/rate-limit.module.js'
import { chamar, subirApi, type TestApi, type RespostaHttp } from './test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'

/**
 * A lista de nomes da turma (A1, tarefa 2.0; `tasks/prd-apresentacao-escola/cenarios.md`): E4, E5, E6 e E7, a parte da
 * lista do E2, o check da `lista_nome`, o conteúdo de A1 e A2, C8, C9, a gravação ao mesmo tempo em duas turmas, a matrícula
 * com forma de documento (G2), e o log. Desde a tarefa 8.0 da F2 (`tasks/prd-onboarding-por-convite/`, "A1 que muda de
 * regra") a prévia e a gravação do texto seguem a planilha de alunos: o contrato da importação (as linhas só com número,
 * resultado e código; as contagens; os candidatos), a gravação responde 202 e o job `estrutura.gravar-planilha` grava (aqui
 * rodado pelo `executarPlanilha`, como o worker o roda), o teto é o da planilha (3.000 linhas, 512 KB), e a matrícula que a
 * escola já tem deixa de ser `CONFLITO`: é "já existe", "nome corrigido" ou "muda de turma". As varreduras I3, P1, A1, A3 e A4
 * das cinco rotas moram em `escola-montada.int.test.ts`, e o E3 (a leitura do texto) em `lista-reader.test.ts`.
 * Postgres real do compose de teste; nomes e matrículas gerados.
 */

const FINALIDADE = 'conferencia_de_cadastro'

/** Uma escola com o ano de 2026 em curso, uma série e duas turmas, montada pela API como a coordenação faria. */
interface EscolaComTurmas {
  readonly escolaId: string
  readonly coordenacao: TestSessao
  readonly anoId: string
  readonly serieId: string
  readonly t1: string
  readonly t2: string
}

/** O prefixo das matrículas e dos nomes desta execução, que o log nunca pode ter. */
const PREFIXO = `lst${randomUUID().slice(0, 6)}`
const matricula = (): string => `${PREFIXO}-m-${randomUUID().slice(0, 12)}`
const nome = (): string => `${PREFIXO} Aluno ${randomUUID().slice(0, 8)}`
/** O texto da lista, uma linha `nome;matrícula` por aluno. */
const texto = (linhas: ReadonlyArray<readonly [string, string]>): string => linhas.map(([quem, qual]) => `${quem};${qual}`).join('\n')

const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }
const CONFLITO = { status: 409, corpo: { erro: { codigo: ErrorCode.CONFLITO, mensagem: MENSAGENS_DE_ERRO.CONFLITO } } }
const ENTRADA_INVALIDA = { status: 400, corpo: { erro: { codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA } } }

/** A resposta sem o `requisicaoId`, que muda a cada chamada: o resto precisa ser idêntico. */
function semRequisicao(resposta: RespostaHttp): unknown {
  if (resposta.corpo.erro === undefined) return { status: resposta.status, corpo: resposta.corpo }
  const { requisicaoId: _requisicaoId, ...erro } = resposta.corpo.erro as Record<string, unknown>
  return { status: resposta.status, corpo: { ...resposta.corpo, erro } }
}

describe('lista de nomes da turma (A1, tarefa 2.0): prévia, gravação, avulso, retirada e leitura auditada', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  /** O pool dos jobs e das paradas: o da bancada tem 2 conexões, e a parada segura uma e o job outra. */
  let apoio: DatabasePool
  let bancoDoJob: Database

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
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
  const previa = (e: EscolaComTurmas, turma: string, lista: string) => pedir(e.coordenacao, 'POST', `/v1/turmas/${turma}/lista/previa`, { texto: lista })
  const gravar = (e: EscolaComTurmas, turma: string, lista: string) => pedir(e.coordenacao, 'POST', `/v1/turmas/${turma}/lista`, { texto: lista })
  const avulso = (e: EscolaComTurmas, turma: string, corpo: unknown) => pedir(e.coordenacao, 'POST', `/v1/turmas/${turma}/lista/nome`, corpo)
  const ler = (e: EscolaComTurmas, turma: string, consulta = `?finalidade=${FINALIDADE}`) => pedir(e.coordenacao, 'GET', `/v1/turmas/${turma}/lista${consulta}`)
  const retirar = (e: EscolaComTurmas, id: string) => pedir(e.coordenacao, 'DELETE', `/v1/lista-nomes/${id}`)

  async function criado(resposta: Promise<RespostaHttp>, status = 201): Promise<string> {
    const lida = await resposta
    expect(lida.status).toBe(status)
    return lida.corpo['id'] as string
  }

  async function turmaNova(coordenacao: TestSessao, serieId: string): Promise<string> {
    return criado(pedir(coordenacao, 'POST', '/v1/turmas', { serieId, nome: `turma ${randomUUID().slice(0, 8)}` }))
  }

  async function anoAberto(coordenacao: TestSessao, ano: number): Promise<string> {
    const id = await criado(pedir(coordenacao, 'POST', '/v1/anos-letivos', { ano, inicio: `${String(ano)}-02-01`, fim: `${String(ano)}-12-15` }))
    await criado(pedir(coordenacao, 'POST', `/v1/anos-letivos/${id}/abrir`), 200)
    return id
  }

  async function escolaComTurmas(): Promise<EscolaComTurmas> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const anoId = await anoAberto(coordenacao, 2026)
    const serieId = await criado(pedir(coordenacao, 'POST', '/v1/series', { etapa: 'ef_anos_finais', ano: 7 }))
    return { escolaId, coordenacao, anoId, serieId, t1: await turmaNova(coordenacao, serieId), t2: await turmaNova(coordenacao, serieId) }
  }

  /** Roda o job uma vez (tentativa 1), no contexto da escola do job, como o executor do worker o abre. */
  const rodar = (escolaId: string, importacaoId: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => executarPlanilha(bancoDoJob, importacaoId))

  /** O estado e o resumo da importação, como ficaram no banco. */
  async function importacaoDe(id: string): Promise<{ estado: string; resumo: Record<string, number> | null }> {
    const { rows } = await bancada.pool.query<{ estado: string; resumo: Record<string, number> | null }>('select estado, resumo from importacao_planilha where id = $1', [id])
    return rows[0] ?? { estado: 'inexistente', resumo: null }
  }

  /** Grava a lista (202), roda o job e confere que concluiu com essas contagens (as que o resumo guarda, `entram` e `ja_existem` por padrão). Devolve o id da importação. */
  async function gravada(
    e: EscolaComTurmas,
    turma: string,
    linhas: ReadonlyArray<readonly [string, string]>,
    contagens: Record<string, number> = { entram: linhas.length, ja_existem: 0 },
  ): Promise<string> {
    const resposta = await gravar(e, turma, texto(linhas))
    expect(resposta.status).toBe(202)
    const id = resposta.corpo['id'] as string
    expect(await rodar(e.escolaId, id)).toBe('concluida')
    const { estado, resumo } = await importacaoDe(id)
    expect(estado).toBe('concluida')
    expect(resumo).toMatchObject(contagens)
    return id
  }

  interface LinhaNoBanco {
    readonly id: string
    readonly ano_letivo_id: string
    readonly turma_id: string
    readonly nome: string | null
    readonly matricula: string | null
    readonly estado: string
    readonly usuario_id: string | null
    readonly criado_por: string | null
  }

  /** As linhas da lista da escola, em ordem de id. */
  async function linhasDa(escolaId: string): Promise<LinhaNoBanco[]> {
    const { rows } = await bancada.pool.query<LinhaNoBanco>(
      'select id, ano_letivo_id, turma_id, nome, matricula, estado, usuario_id, criado_por from lista_nome where escola_id = $1 order by id',
      [escolaId],
    )
    return rows
  }

  /** O id da linha da lista com essa matrícula. */
  async function idDaMatricula(escolaId: string, qual: string): Promise<string> {
    const linha = (await linhasDa(escolaId)).find((gravada) => gravada.matricula === qual)
    if (linha === undefined) throw new Error('matrícula não está na lista')
    return linha.id
  }

  /** Tudo o que as rotas da lista podem gravar na escola: o que é recusado não muda nada disto. */
  async function retrato(escolaId: string) {
    const auditoria = await bancada.pool.query('select id, acao from auditoria where escola_id = $1 order by id', [escolaId])
    const turmas = await bancada.pool.query('select id, nome from turma where escola_id = $1 order by id', [escolaId])
    return { lista: await linhasDa(escolaId), auditoria: auditoria.rows, turmas: turmas.rows }
  }

  interface LinhaDeAuditoria {
    readonly entidade_id: string
    readonly autor_usuario_id: string | null
    readonly antes: Record<string, unknown> | null
    readonly depois: Record<string, unknown> | null
    readonly finalidade: string | null
  }

  async function auditoriaDa(escolaId: string, acao: string): Promise<LinhaDeAuditoria[]> {
    const { rows } = await bancada.pool.query<LinhaDeAuditoria>(
      'select entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = $2 order by em, id',
      [escolaId, acao],
    )
    return rows
  }

  /** Um aluno da escola com credencial por matrícula, como o aprovado terá (8.0). */
  async function alunoComMatricula(escolaId: string, qual = matricula()): Promise<{ usuarioId: string; matricula: string }> {
    const [usuarioId] = await bancada.alunosComMatricula(escolaId, [{ matricula: qual, senhaHash: 'hash-sintetico' }])
    if (usuarioId === undefined) throw new Error('aluno não criado')
    return { usuarioId, matricula: qual }
  }

  describe('E4 (RF4): erro por linha, e nada gravado; a matrícula que a escola já tem deixa de ser conflito (F2, 8.0)', () => {
    it('a prévia aponta cada linha ruim com o código, entre as boas; a matrícula na lista de outra turma é "muda de turma" (candidato a marca) e a de aluno da escola, "já existe"; a gravação com erro do texto é ENTRADA_INVALIDA e não grava nada', async () => {
      const e = await escolaComTurmas()
      const naOutraTurma = matricula()
      const nomeDaOutraTurma = nome()
      await gravada(e, e.t2, [[nomeDaOutraTurma, naOutraTurma]])
      const deAluno = (await alunoComMatricula(e.escolaId)).matricula
      const boas: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      const repetida = matricula()
      const semNome = matricula()
      const semMatricula = nome()
      const [b0, b1, b2, b3] = boas as [[string, string], [string, string], [string, string], [string, string]]
      const linhas: Array<[string, string]> = [b0, ['', semNome], b1, [semMatricula, ''], [`${PREFIXO} Rep A`, repetida], b2, [`${PREFIXO} Rep B`, repetida], [`${PREFIXO} Outra`, naOutraTurma], [`${PREFIXO} Aluno`, deAluno], b3]

      const lida = await previa(e, e.t1, texto(linhas))
      expect(lida.status).toBe(200)
      expect(previaDaPlanilhaResponseSchema.parse(lida.corpo)).toEqual({
        linhas: [
          { linha: 1, resultado: 'entra' },
          { linha: 2, resultado: 'erro', erro: 'sem_nome' },
          { linha: 3, resultado: 'entra' },
          { linha: 4, resultado: 'erro', erro: 'sem_matricula' },
          { linha: 5, resultado: 'erro', erro: 'matricula_repetida' },
          { linha: 6, resultado: 'entra' },
          { linha: 7, resultado: 'erro', erro: 'matricula_repetida' },
          { linha: 8, resultado: 'muda_de_turma' },
          { linha: 9, resultado: 'ja_existe' },
          { linha: 10, resultado: 'entra' },
        ],
        contagens: { entram: 4, ja_existem: 1, turmas_novas: 0 },
        candidatos: [{ id: await idDaMatricula(e.escolaId, naOutraTurma), acao: 'transferir', rotulo: `${nomeDaOutraTurma} (${naOutraTurma})` }],
      })

      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await gravar(e, e.t1, texto(linhas)))).toEqual(ENTRADA_INVALIDA)
      expect(await retrato(e.escolaId)).toEqual(antes)

      // Sem erro do texto, a matrícula da outra turma e a do aluno da escola não seguram a gravação (antes eram CONFLITO): sem marca, nada muda de turma.
      const importacao = await gravada(e, e.t1, [...boas, [`${PREFIXO} Outra`, naOutraTurma], [`${PREFIXO} Aluno`, deAluno]], { entram: 4, ja_existem: 1 })
      expect(importacao).toEqual(expect.any(String))
      expect((await linhasDa(e.escolaId)).filter((linha) => linha.matricula === naOutraTurma).map((linha) => linha.turma_id)).toEqual([e.t2])
      expect((await linhasDa(e.escolaId)).filter((linha) => linha.turma_id === e.t1).map((linha) => linha.matricula).sort()).toEqual(boas.map(([, qual]) => qual).sort())
    })

    it('o teto da planilha, 3.000 linhas e 512 KB, vale na prévia e na gravação: 3.001 linhas ou 512 KB + 1 byte são ENTRADA_INVALIDA e nada é gravado; 3.000 linhas gravam (202)', async () => {
      expect(MAXIMO_DE_LINHAS_DA_LISTA).toBe(3000)
      expect(MAXIMO_DE_BYTES_DA_LISTA).toBe(512 * 1024)
      const e = await escolaComTurmas()
      const linhas = Array.from({ length: MAXIMO_DE_LINHAS_DA_LISTA + 1 }, (_, posicao): [string, string] => [`${PREFIXO} Aluno ${String(posicao)}`, `${PREFIXO}-${String(posicao)}`])
      // Cabe nas 3.000 linhas, mas passa de 512 KB por uma matrícula só.
      const grande = texto([[nome(), 'x'.repeat(MAXIMO_DE_BYTES_DA_LISTA)]])
      const antes = await retrato(e.escolaId)
      for (const lista of [texto(linhas), grande]) {
        expect(semRequisicao(await previa(e, e.t1, lista))).toEqual(ENTRADA_INVALIDA)
        expect(semRequisicao(await gravar(e, e.t1, lista))).toEqual(ENTRADA_INVALIDA)
      }
      expect(await retrato(e.escolaId)).toEqual(antes)
      expect(await bancada.pool.query('select 1 from importacao_planilha where escola_id = $1', [e.escolaId]).then((r) => r.rows)).toEqual([])

      // As 201 linhas que o teto antigo (200) recusava passam; as 3.000, de uns 110 KB (acima dos 100 KB das outras rotas), leem e gravam.
      const dentro = texto(linhas.slice(0, MAXIMO_DE_LINHAS_DA_LISTA))
      expect(Buffer.byteLength(dentro, 'utf8')).toBeGreaterThan(100 * 1024)
      const lida = previaDaPlanilhaResponseSchema.parse((await previa(e, e.t1, dentro)).corpo)
      expect(lida.contagens).toEqual({ entram: MAXIMO_DE_LINHAS_DA_LISTA, ja_existem: 0, turmas_novas: 0 })
      const resposta = await gravar(e, e.t1, dentro)
      expect(resposta.status).toBe(202)
      expect(await rodar(e.escolaId, resposta.corpo['id'] as string)).toBe('concluida')
      expect(await linhasDa(e.escolaId)).toHaveLength(MAXIMO_DE_LINHAS_DA_LISTA)
    })

    it('a gravação responde 202 com o id da importação, na fila e sem gravar nada antes do job; o job a conclui, e a leitura da importação mostra as contagens', async () => {
      const e = await escolaComTurmas()
      const linhas: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      const resposta = await gravar(e, e.t1, texto(linhas))
      expect(resposta.status).toBe(202)
      expect(resposta.corpo).toEqual({ id: expect.any(String) })
      const id = resposta.corpo['id'] as string
      expect(await linhasDa(e.escolaId)).toEqual([])
      expect((await pedir(e.coordenacao, 'GET', `/v1/importacoes/${id}`)).corpo).toMatchObject({ id, tipo: 'alunos', estado: 'na_fila', resumo: null })

      expect(await rodar(e.escolaId, id)).toBe('concluida')
      expect((await pedir(e.coordenacao, 'GET', `/v1/importacoes/${id}`)).corpo).toMatchObject({ estado: 'concluida', resumo: { entram: 2, ja_existem: 0 } })
      expect((await linhasDa(e.escolaId)).map((linha) => [linha.nome, linha.matricula, linha.turma_id, linha.estado]).sort()).toEqual(linhas.map(([quem, qual]) => [quem, qual, e.t1, 'livre']).sort())
    })
  })

  describe('isolamento (regra 10) e ano (RF4, 8.0): o `turmaId` da prévia e da gravação é conferido na escola e no ano', () => {
    it('a turma da escola B, a de um id sorteado e a de um ano encerrado respondem a mesma coisa na prévia e na gravação: NAO_ENCONTRADO, sem importação, sem job, sem nome e sem leitura auditada', async () => {
      const a = await escolaComTurmas()
      const b = await escolaComTurmas()
      const emB = matricula()
      await gravada(b, b.t1, [[nome(), emB]])
      // A t1 de A fica no ano que encerra; a lista dela não se lê nem se grava (e o ano 2027 abre para a escola seguir).
      await criado(pedir(a.coordenacao, 'POST', `/v1/anos-letivos/${a.anoId}/encerrar`), 200)
      await anoAberto(a.coordenacao, 2027)
      const antesDeA = await retrato(a.escolaId)
      const antesDeB = await retrato(b.escolaId)
      const importacoesDeB = (await bancada.pool.query('select id from importacao_planilha where escola_id = $1 order by id', [b.escolaId])).rows
      const lista = texto([[nome(), matricula()], [nome(), emB]])

      const respostas = [b.t1, randomUUID(), a.t1]
      // Uma de cada vez: a escola tem duas vagas de classificação ao mesmo tempo.
      const previas: RespostaHttp[] = []
      const gravacoes: RespostaHttp[] = []
      for (const turma of respostas) {
        previas.push(await previa(a, turma, lista))
        gravacoes.push(await gravar(a, turma, lista))
      }
      // O inexistente é o parâmetro de comparação: as três respostas são a mesma, só o `requisicaoId` muda.
      for (const resposta of [...previas, ...gravacoes]) expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)

      expect(await retrato(a.escolaId)).toEqual(antesDeA)
      expect(await retrato(b.escolaId)).toEqual(antesDeB)
      expect((await bancada.pool.query('select 1 from importacao_planilha where escola_id = $1', [a.escolaId])).rows).toEqual([])
      expect((await bancada.pool.query('select id from importacao_planilha where escola_id = $1 order by id', [b.escolaId])).rows).toEqual(importacoesDeB)
      expect((await bancada.pool.query('select 1 from job_registro where escola_id = $1', [a.escolaId])).rows).toEqual([])
      expect(await auditoriaDa(a.escolaId, 'turma.alunos_lidos')).toEqual([])
      expect(await auditoriaDa(b.escolaId, 'turma.alunos_lidos')).toEqual([])
    })
  })

  describe('E5: a matrícula é única por escola e por ano, nunca no sistema', () => {
    it('a matrícula da lista de outra escola entra; a que só existe na credencial de outra escola entra na lista e no avulso', async () => {
      const a = await escolaComTurmas()
      const b = await escolaComTurmas()
      const naListaDeA = matricula()
      const outraNaListaDeA = matricula()
      await gravada(a, a.t1, [
        [nome(), naListaDeA],
        [nome(), outraNaListaDeA],
      ])
      const lidaEmB = await previa(b, b.t1, texto([[nome(), naListaDeA]]))
      expect(lidaEmB.status).toBe(200)
      expect(lidaEmB.corpo['linhas']).toEqual([{ linha: 1, resultado: 'entra' }])
      await gravada(b, b.t1, [[nome(), naListaDeA]])
      expect((await avulso(b, b.t1, { nome: nome(), matricula: outraNaListaDeA })).status).toBe(201)

      const deAlunoDeB = (await alunoComMatricula(b.escolaId)).matricula
      const outraDeAlunoDeB = (await alunoComMatricula(b.escolaId)).matricula
      const lidaEmA = await previa(a, a.t1, texto([[nome(), deAlunoDeB]]))
      expect(lidaEmA.corpo['linhas']).toEqual([{ linha: 1, resultado: 'entra' }])
      await gravada(a, a.t1, [[nome(), deAlunoDeB]])
      expect((await avulso(a, a.t1, { nome: nome(), matricula: outraDeAlunoDeB })).status).toBe(201)

      expect((await linhasDa(b.escolaId)).map((linha) => linha.matricula).sort()).toEqual([naListaDeA, outraNaListaDeA].sort())
      expect((await linhasDa(a.escolaId)).map((linha) => linha.matricula).sort()).toEqual([naListaDeA, outraNaListaDeA, deAlunoDeB, outraDeAlunoDeB].sort())
    })

    it('a matrícula da lista do ano encerrado entra no ano em curso; o nome livre de lá saiu no encerramento (10.0), e a turma de lá não ganha nome', async () => {
      const e = await escolaComTurmas()
      const de2026 = matricula()
      const outraDe2026 = matricula()
      await gravada(e, e.t1, [
        [nome(), de2026],
        [nome(), outraDe2026],
      ])
      const livreDe2026 = await idDaMatricula(e.escolaId, de2026)
      await criado(pedir(e.coordenacao, 'POST', `/v1/anos-letivos/${e.anoId}/encerrar`), 200)
      // O encerramento apagou os nomes livres do ano (10.0, V1).
      expect((await linhasDa(e.escolaId)).filter((linha) => linha.ano_letivo_id === e.anoId)).toEqual([])
      const de2027Ano = await anoAberto(e.coordenacao, 2027)
      const de2027 = await turmaNova(e.coordenacao, e.serieId)

      const lida = await previa(e, de2027, texto([[nome(), de2026]]))
      expect(lida.corpo['linhas']).toEqual([{ linha: 1, resultado: 'entra' }])
      await gravada(e, de2027, [[nome(), de2026]])
      expect((await avulso(e, de2027, { nome: nome(), matricula: outraDe2026 })).status).toBe(201)

      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await retirar(e, livreDe2026))).toEqual(NAO_ENCONTRADO)
      // A turma do ano encerrado também não se lê nem ganha nome por aqui.
      for (const resposta of [
        await previa(e, e.t1, texto([[nome(), matricula()]])),
        await gravar(e, e.t1, texto([[nome(), matricula()]])),
        await avulso(e, e.t1, { nome: nome(), matricula: matricula() }),
        await ler(e, e.t1),
      ]) {
        expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)
      }
      expect(await retrato(e.escolaId)).toEqual(antes)
      // A matrícula de 2026 agora só na lista de 2027.
      expect((await linhasDa(e.escolaId)).filter((linha) => linha.matricula === de2026).map((linha) => linha.ano_letivo_id)).toEqual([de2027Ano])
    })
  })

  describe('E6 (RF5, RF4): reenviar acrescenta só o que falta, pela matrícula; o nome diferente é "nome corrigido" (F2, 8.0)', () => {
    it('a mesma lista duas vezes é tudo "já existe" e o banco não muda; a mesma matrícula com outro nome é "nome corrigido" e a linha da lista ganha o nome novo; um nome novo acrescenta só ele', async () => {
      const e = await escolaComTurmas()
      const linhas: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      await gravada(e, e.t1, linhas)
      const depoisDaPrimeira = await linhasDa(e.escolaId)
      expect(depoisDaPrimeira).toHaveLength(3)

      // A mesma lista: a prévia diz "já existe" nas três, e o banco fica como estava.
      const repetida = previaDaPlanilhaResponseSchema.parse((await previa(e, e.t1, texto(linhas))).corpo)
      expect(repetida).toEqual({
        linhas: [1, 2, 3].map((linha) => ({ linha, resultado: 'ja_existe' })),
        contagens: { entram: 0, ja_existem: 3, turmas_novas: 0 },
        candidatos: [],
      })
      const antesDaSegunda = await retrato(e.escolaId)
      await gravada(e, e.t1, linhas, { entram: 0, ja_existem: 3 })
      expect((await retrato(e.escolaId)).lista).toEqual(antesDaSegunda.lista)
      expect((await auditoriaDa(e.escolaId, 'lista.nome_corrigido'))).toEqual([])

      // A mesma matrícula com outro nome: "nome corrigido", e não mais "já existe com o nome de antes".
      const [primeira] = linhas as [[string, string]]
      const corrigido = `${PREFIXO} Nome Corrigido`
      const comOutroNome: Array<[string, string]> = [...linhas.slice(1), [corrigido, primeira[1]]]
      const lida = previaDaPlanilhaResponseSchema.parse((await previa(e, e.t1, texto(comOutroNome))).corpo)
      expect(lida.linhas).toEqual([
        { linha: 1, resultado: 'ja_existe' },
        { linha: 2, resultado: 'ja_existe' },
        { linha: 3, resultado: 'nome_corrigido' },
      ])
      expect(lida.contagens).toEqual({ entram: 0, ja_existem: 2, nomes_corrigidos: 1, turmas_novas: 0 })
      expect(lida.candidatos).toEqual([])

      const nova = matricula()
      const novoNome = nome()
      await gravada(e, e.t1, [...comOutroNome, [novoNome, nova]], { entram: 1, ja_existem: 2, nomes_corrigidos: 1 })
      const naT1 = (await linhasDa(e.escolaId)).filter((linha) => linha.turma_id === e.t1)
      expect(naT1).toHaveLength(4)
      // O nome da linha que já existia mudou para o da planilha; as outras seguem; a nova entra livre.
      expect(naT1.find((linha) => linha.matricula === primeira[1])).toEqual(expect.objectContaining({ nome: corrigido, estado: 'livre', id: depoisDaPrimeira.find((linha) => linha.matricula === primeira[1])?.id }))
      expect(naT1.find((linha) => linha.matricula === nova)).toEqual(expect.objectContaining({ nome: novoNome, estado: 'livre', usuario_id: null, criado_por: e.coordenacao.usuarioId, ano_letivo_id: e.anoId }))
      for (const linha of naT1) expect(linha).toEqual(expect.objectContaining({ turma_id: e.t1, ano_letivo_id: e.anoId, estado: 'livre', usuario_id: null }))

      // Dois alunos com o mesmo nome e matrículas diferentes entram os dois: só a matrícula decide.
      const homonimo = nome()
      const homonimos: Array<[string, string]> = [
        [homonimo, matricula()],
        [homonimo, matricula()],
      ]
      const lidaHomonimos = previaDaPlanilhaResponseSchema.parse((await previa(e, e.t2, texto(homonimos))).corpo)
      expect(lidaHomonimos.contagens).toEqual({ entram: 2, ja_existem: 0, turmas_novas: 0 })
      await gravada(e, e.t2, homonimos)
      const daT2 = (await linhasDa(e.escolaId)).filter((linha) => linha.turma_id === e.t2)
      expect(daT2.map((linha) => [linha.nome, linha.matricula]).sort()).toEqual([...homonimos].sort())
    })

    it('"muda de turma" e "fora da planilha" sem marca gravam sem efeito: o nome fica na turma de antes, e o que a lista não traz não sai', async () => {
      const e = await escolaComTurmas()
      const daT1 = matricula()
      const daT2 = matricula()
      const ausente = matricula()
      const nomeDaT1 = nome()
      const nomeDaT2 = nome()
      await gravada(e, e.t1, [
        [nomeDaT1, daT1],
        [nome(), ausente],
      ])
      await gravada(e, e.t2, [[nomeDaT2, daT2]])
      const antes = await retrato(e.escolaId)

      // Na lista da t1: a matrícula da t2 ("muda de turma") e o ausente da t1 ("fora da planilha"), que só aparecem como candidatos.
      const lida = previaDaPlanilhaResponseSchema.parse((await previa(e, e.t1, texto([[nomeDaT1, daT1], [nomeDaT2, daT2]]))).corpo)
      expect(lida.linhas).toEqual([
        { linha: 1, resultado: 'ja_existe' },
        { linha: 2, resultado: 'muda_de_turma' },
      ])
      expect(lida.candidatos.map(({ id, acao }) => [id, acao]).sort()).toEqual(
        [
          [await idDaMatricula(e.escolaId, daT2), 'transferir'],
          [await idDaMatricula(e.escolaId, ausente), 'desligar'],
        ].sort(),
      )

      await gravada(e, e.t1, [[nomeDaT1, daT1], [nomeDaT2, daT2]], { entram: 0, ja_existem: 1 })
      expect((await retrato(e.escolaId)).lista).toEqual(antes.lista)
    })
  })

  describe('E7 (RF5): nome avulso e retirada do nome livre', () => {
    it('o avulso entra livre, sem espaço nas pontas e com quem gravou; sem nome ou sem matrícula, ENTRADA_INVALIDA; com a matrícula na lista da turma, na de outra turma ou de aluno da escola, CONFLITO; nada gravado nos cinco', async () => {
      const e = await escolaComTurmas()
      const naT1 = matricula()
      const naT2 = matricula()
      await gravada(e, e.t1, [[nome(), naT1]])
      await gravada(e, e.t2, [[nome(), naT2]])
      const deAluno = (await alunoComMatricula(e.escolaId)).matricula

      const quem = nome()
      const qual = matricula()
      const criadoAvulso = await avulso(e, e.t1, { nome: `  ${quem} `, matricula: ` ${qual}  ` })
      expect(criadoAvulso.status).toBe(201)
      expect(criadoAvulso.corpo).toEqual({ id: expect.any(String), nome: quem, matricula: qual, estado: 'livre' })
      expect((await linhasDa(e.escolaId)).find((linha) => linha.id === criadoAvulso.corpo['id'])).toEqual(
        expect.objectContaining({ turma_id: e.t1, ano_letivo_id: e.anoId, nome: quem, matricula: qual, estado: 'livre', usuario_id: null, criado_por: e.coordenacao.usuarioId }),
      )

      const antes = await retrato(e.escolaId)
      const recusas: Array<readonly [unknown, unknown]> = [
        [{ nome: '', matricula: matricula() }, ENTRADA_INVALIDA],
        [{ nome: nome(), matricula: '   ' }, ENTRADA_INVALIDA],
        [{ nome: nome() }, ENTRADA_INVALIDA],
        [{ nome: nome(), matricula: naT1 }, CONFLITO],
        [{ nome: nome(), matricula: naT2 }, CONFLITO],
        [{ nome: nome(), matricula: deAluno }, CONFLITO],
      ]
      for (const [corpo, esperado] of recusas) expect(semRequisicao(await avulso(e, e.t1, corpo)), JSON.stringify(corpo)).toEqual(esperado)
      expect(await retrato(e.escolaId)).toEqual(antes)
    })

    it('retirar o nome livre apaga a linha, e só ela; o reivindicado e o aprovado dão CONFLITO e ficam; o id sorteado e o segundo retirar do mesmo nome, NAO_ENCONTRADO', async () => {
      const e = await escolaComTurmas()
      const livre = matricula()
      const reivindicada = matricula()
      const outra = matricula()
      await gravada(e, e.t1, [
        [nome(), livre],
        [nome(), reivindicada],
        [nome(), outra],
      ])
      const idLivre = await idDaMatricula(e.escolaId, livre)
      const idReivindicado = await idDaMatricula(e.escolaId, reivindicada)
      // O pedido do aluno chega na 6.0; aqui o estado é posto no banco, com o nome e a matrícula que o check exige.
      await bancada.pool.query(`update lista_nome set estado = 'reivindicado' where id = $1`, [idReivindicado])

      const retirada = await retirar(e, idLivre)
      expect(retirada.status).toBe(204)
      expect(retirada.corpo).toEqual({})
      expect((await linhasDa(e.escolaId)).map((linha) => [linha.matricula, linha.estado])).toEqual([
        [reivindicada, 'reivindicado'],
        [outra, 'livre'],
      ])

      // O aprovado chega na 8.0; aqui a linha é posta no banco como o check exige: com o usuário, sem nome nem matrícula.
      const { usuarioId } = await alunoComMatricula(e.escolaId)
      const { rows: aprovados } = await bancada.pool.query<{ id: string }>(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id) values ($1, $2, $3, 'aprovado', $4) returning id`,
        [e.escolaId, e.anoId, e.t1, usuarioId],
      )
      const idAprovado = aprovados[0]?.id ?? ''

      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await retirar(e, idReivindicado))).toEqual(CONFLITO)
      expect(semRequisicao(await retirar(e, idAprovado))).toEqual(CONFLITO)
      expect(semRequisicao(await retirar(e, idLivre))).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(await retirar(e, randomUUID()))).toEqual(NAO_ENCONTRADO)
      expect(await retrato(e.escolaId)).toEqual(antes)
    })

    it('clique duplo: o mesmo avulso duas vezes em paralelo entra uma vez (a outra, CONFLITO); a mesma retirada duas vezes, uma 204 e a outra NAO_ENCONTRADO', async () => {
      const e = await escolaComTurmas()
      const corpo = { nome: nome(), matricula: matricula() }
      const avulsos = await Promise.all([avulso(e, e.t1, corpo), avulso(e, e.t1, corpo)])
      expect(avulsos.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      expect((await linhasDa(e.escolaId)).map((linha) => linha.matricula)).toEqual([corpo.matricula])
      expect(await auditoriaDa(e.escolaId, 'lista.gravada')).toHaveLength(1)

      const id = await idDaMatricula(e.escolaId, corpo.matricula)
      const retiradas = await Promise.all([retirar(e, id), retirar(e, id)])
      expect(retiradas.map((resposta) => resposta.status).sort()).toEqual([204, 404])
      expect(await linhasDa(e.escolaId)).toEqual([])
      expect(await auditoriaDa(e.escolaId, 'lista_nome.retirado')).toHaveLength(1)
    })

    it('E2 (lista): a turma com nome na lista não se exclui, e nada é apagado; sem o nome, sai', async () => {
      const e = await escolaComTurmas()
      const qual = matricula()
      await gravada(e, e.t1, [[nome(), qual]])
      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await pedir(e.coordenacao, 'DELETE', `/v1/turmas/${e.t1}`))).toEqual(CONFLITO)
      expect(await retrato(e.escolaId)).toEqual(antes)

      expect((await retirar(e, await idDaMatricula(e.escolaId, qual))).status).toBe(204)
      expect((await pedir(e.coordenacao, 'DELETE', `/v1/turmas/${e.t1}`)).status).toBe(204)
    })
  })

  /**
   * G2 da validação da A1 (correção `2026-10-03-trava-de-documento-so-na-tela`; regra 00, item 1; regra 20, item 2): a
   * matrícula com forma de CPF ou de data é recusada pela API, sem a tela no caminho. CPFs sintéticos, com o dígito
   * verificador calculado.
   */
  describe('G2: a matrícula com forma de documento, recusada pela API', () => {
    const CPFS_SEM_PONTUACAO = ['12345678909', '52998224725', '11144477735'] as const

    it('G2: a matrícula com forma de CPF ou de data é recusada pela API na prévia (linha com `matricula_parece_documento`), na gravação e no avulso (ENTRADA_INVALIDA), e nada é gravado', async () => {
      const e = await escolaComTurmas()
      for (const documento of ['123.456.789-09', '01/02/2012', '1/2/12', '2012-02-01']) {
        const boa: [string, string] = [nome(), matricula()]
        const suspeita: [string, string] = [nome(), documento]
        const lista = texto([boa, suspeita])

        const lida = await previa(e, e.t1, lista)
        expect(lida.status, documento).toBe(200)
        expect(previaDaPlanilhaResponseSchema.parse(lida.corpo), documento).toEqual({
          linhas: [
            { linha: 1, resultado: 'entra' },
            { linha: 2, resultado: 'erro', erro: 'matricula_parece_documento' },
          ],
          contagens: { entram: 1, ja_existem: 0, turmas_novas: 0 },
          candidatos: [],
        })

        const antes = await retrato(e.escolaId)
        expect(semRequisicao(await gravar(e, e.t1, lista)), documento).toEqual(ENTRADA_INVALIDA)
        expect(semRequisicao(await avulso(e, e.t1, { nome: nome(), matricula: documento })), documento).toEqual(ENTRADA_INVALIDA)
        // Com espaço nas pontas, que o contrato tira antes de conferir.
        expect(semRequisicao(await avulso(e, e.t1, { nome: nome(), matricula: `  ${documento} ` })), documento).toEqual(ENTRADA_INVALIDA)
        expect(await retrato(e.escolaId), documento).toEqual(antes)
      }
      // Controle: a mesma lista sem a linha suspeita grava, e o avulso com matrícula normal entra.
      await gravada(e, e.t1, [[nome(), matricula()]])
      expect((await avulso(e, e.t1, { nome: nome(), matricula: matricula() })).status).toBe(201)
    })

    it('G2: a lista com maioria de CPF sem pontuação é marcada como coluna de CPF: cada CPF sai com `matricula_parece_documento`, a gravação é recusada, e nada é gravado', async () => {
      const e = await escolaComTurmas()
      const [a, b, c] = CPFS_SEM_PONTUACAO
      const outra = matricula()
      const linhas: Array<[string, string]> = [
        [nome(), a],
        [nome(), b],
        [nome(), outra],
        [nome(), c],
      ]
      const lida = await previa(e, e.t1, texto(linhas))
      expect(lida.status).toBe(200)
      const resposta = previaDaPlanilhaResponseSchema.parse(lida.corpo)
      expect(resposta.linhas.map((linha) => [linha.linha, linha.resultado, linha.erro])).toEqual([
        [1, 'erro', 'matricula_parece_documento'],
        [2, 'erro', 'matricula_parece_documento'],
        [3, 'entra', undefined],
        [4, 'erro', 'matricula_parece_documento'],
      ])
      expect(resposta.contagens.entram).toBe(1)

      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await gravar(e, e.t1, texto(linhas)))).toEqual(ENTRADA_INVALIDA)
      expect(await retrato(e.escolaId)).toEqual(antes)
    })

    it('G2: o CPF sem pontuação que não é maioria não é marcado: a lista com um só entre matrículas normais grava, e o avulso sozinho entra (matrícula numérica de 11 algarismos)', async () => {
      const e = await escolaComTurmas()
      const [a, b] = CPFS_SEM_PONTUACAO
      const linhas: Array<[string, string]> = [
        [nome(), a],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      const lida = previaDaPlanilhaResponseSchema.parse((await previa(e, e.t1, texto(linhas))).corpo)
      expect(lida.linhas.filter((linha) => linha.resultado === 'erro')).toEqual([])
      await gravada(e, e.t1, linhas)
      expect((await avulso(e, e.t1, { nome: nome(), matricula: b })).status).toBe(201)
    })
  })

  describe('o banco: o check e as FKs da `lista_nome`', () => {
    /** O SQLSTATE e a restrição do erro do `insert`, ou `ok`. */
    async function resultadoDo(consulta: Promise<unknown>): Promise<string> {
      try {
        await consulta
        return 'ok'
      } catch (erro) {
        const { code, constraint } = erro as { code?: string; constraint?: string }
        return `${String(code)} ${String(constraint)}`
      }
    }

    it('aprovado ⇔ usuário ⇔ nome e matrícula nulos: cada combinação errada falha com 23514; as certas entram; estado, formato e usuário de outra escola também são recusados', async () => {
      const e = await escolaComTurmas()
      const { usuarioId } = await alunoComMatricula(e.escolaId)
      const deOutraEscola = (await alunoComMatricula((await escolaComTurmas()).escolaId)).usuarioId
      const inserir = (estado: string, usuario: string | null, quem: string | null, qual: string | null) =>
        bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id, nome, matricula) values ($1, $2, $3, $4, $5, $6, $7)', [
          e.escolaId,
          e.anoId,
          e.t1,
          estado,
          usuario,
          quem,
          qual,
        ])
      const CHECK = '23514 lista_nome_aprovado_sem_nome'
      const casos: Array<readonly [string, string | null, string | null, string | null, string]> = [
        ['aprovado', usuarioId, nome(), matricula(), CHECK],
        ['aprovado', usuarioId, null, matricula(), CHECK],
        ['aprovado', usuarioId, nome(), null, CHECK],
        ['aprovado', null, null, null, CHECK],
        ['livre', usuarioId, nome(), matricula(), CHECK],
        ['livre', null, nome(), null, CHECK],
        ['reivindicado', null, null, matricula(), CHECK],
        ['livre', null, null, null, CHECK],
        ['aprovado', usuarioId, null, null, 'ok'],
        ['reivindicado', null, nome(), matricula(), 'ok'],
        ['livre', null, nome(), matricula(), 'ok'],
        ['pendente', null, nome(), matricula(), '23514 lista_nome_estado_valido'],
        ['livre', null, ` ${nome()}`, matricula(), '23514 lista_nome_nome_formato'],
        ['livre', null, 'n'.repeat(201), matricula(), '23514 lista_nome_nome_formato'],
        ['livre', null, nome(), `${matricula()} `, '23514 lista_nome_matricula_formato'],
        ['livre', null, nome(), 'm'.repeat(41), '23514 lista_nome_matricula_formato'],
        ['aprovado', deOutraEscola, null, null, '23503 lista_nome_usuario_da_escola_fk'],
      ]
      for (const [estado, usuario, quem, qual, esperado] of casos) {
        expect(await resultadoDo(inserir(estado, usuario, quem, qual)), `${estado} usuário=${String(usuario !== null)} nome=${String(quem !== null)} matrícula=${String(qual !== null)}`).toBe(esperado)
      }
    })

    it('quem gravou vira nulo quando é eliminado, e a linha fica, com a escola; o autor de outra escola é recusado pela FK', async () => {
      const e = await escolaComTurmas()
      const outra = await escolaComTurmas()
      const autor = await bancada.equipeComEmail(e.escolaId, `autor-${randomUUID()}@escola.invalid`, 'coordenador')
      const deOutraEscola = await bancada.equipeComEmail(outra.escolaId, `autor-${randomUUID()}@escola.invalid`, 'coordenador')
      const inserir = (criadoPor: string) =>
        bancada.pool.query<{ id: string }>(
          'insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, criado_por) values ($1, $2, $3, $4, $5, $6) returning id',
          [e.escolaId, e.anoId, e.t1, nome(), matricula(), criadoPor],
        )
      expect(await resultadoDo(inserir(deOutraEscola.usuarioId))).toBe('23503 lista_nome_criado_por_da_escola_fk')
      const { rows } = await inserir(autor.usuarioId)
      const id = rows[0]?.id

      await bancada.pool.query('delete from usuario where id = $1', [autor.usuarioId])
      expect((await linhasDa(e.escolaId)).find((linha) => linha.id === id)).toEqual(expect.objectContaining({ turma_id: e.t1, criado_por: null, estado: 'livre' }))
    })
  })

  describe('A1 e A2: a auditoria da lista, só com ids e contagens', () => {
    it('o texto gravado audita `planilha.gravada` (a importação, as contagens, a coordenação como autora); `lista.gravada` é só do avulso, com o id, e `lista_nome.retirado` leva a turma do nome', async () => {
      const e = await escolaComTurmas()
      const jaNaLista = matricula()
      const nomeDela = nome()
      const primeira = await gravada(e, e.t1, [[nomeDela, jaNaLista]])
      const nova = matricula()
      const segunda = await gravada(
        e,
        e.t1,
        [
          [nomeDela, jaNaLista],
          [nome(), nova],
        ],
        { entram: 1, ja_existem: 1 },
      )
      const idNova = await idDaMatricula(e.escolaId, nova)
      const doAvulso = await avulso(e, e.t1, { nome: nome(), matricula: matricula() })
      expect(doAvulso.status).toBe(201)

      const daPlanilha = (importacao: string, contagens: Record<string, number>) => ({ entidade_id: importacao, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { tipo: 'alunos', contagens }, finalidade: null })
      expect(await auditoriaDa(e.escolaId, 'planilha.gravada')).toEqual([daPlanilha(primeira, { entram: 1, ja_existem: 0, turmas_novas: 0 }), daPlanilha(segunda, { entram: 1, ja_existem: 1, turmas_novas: 0 })])
      expect(await auditoriaDa(e.escolaId, 'lista.gravada')).toEqual([
        { entidade_id: e.t1, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { ids: [doAvulso.corpo['id']], gravados: 1, jaExistentes: 0 }, finalidade: null },
      ])

      expect((await retirar(e, idNova)).status).toBe(204)
      expect(await auditoriaDa(e.escolaId, 'lista_nome.retirado')).toEqual([
        { entidade_id: idNova, autor_usuario_id: e.coordenacao.usuarioId, antes: { turmaId: e.t1, estado: 'livre' }, depois: null, finalidade: null },
      ])
    })

    it('`lista.nome_corrigido` leva o id da linha e a coordenação, sem o nome (antes e depois nulos) e sem o nome em parte alguma da auditoria; sem nome corrigido, não há registro', async () => {
      const e = await escolaComTurmas()
      const qual = matricula()
      const antigo = nome()
      const corrigido = nome()
      await gravada(e, e.t1, [[antigo, qual]])
      expect(await auditoriaDa(e.escolaId, 'lista.nome_corrigido')).toEqual([])
      await gravada(e, e.t1, [[corrigido, qual]], { entram: 0, ja_existem: 0, nomes_corrigidos: 1 })

      expect(await auditoriaDa(e.escolaId, 'lista.nome_corrigido')).toEqual([
        { entidade_id: await idDaMatricula(e.escolaId, qual), autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: null, finalidade: null },
      ])
      const { rows } = await bancada.pool.query('select antes::text as antes, depois::text as depois from auditoria where escola_id = $1', [e.escolaId])
      for (const sentinela of [antigo, corrigido, qual, PREFIXO]) expect(JSON.stringify(rows), sentinela).not.toContain(sentinela)
    })

    it('a prévia que mostra nome do banco (o rótulo do candidato) grava `turma.alunos_lidos` com a finalidade e a quantidade, por turma de onde o nome saiu; a que não mostra, não grava; a recusada, não grava', async () => {
      const e = await escolaComTurmas()
      const b = await escolaComTurmas()
      const daT1 = matricula()
      const daT2 = matricula()
      const nomeDaT2 = nome()
      await gravada(e, e.t1, [
        [nome(), daT1],
        [nome(), matricula()],
      ])
      await gravada(e, e.t2, [[nomeDaT2, daT2]])
      expect(await auditoriaDa(e.escolaId, 'turma.alunos_lidos')).toEqual([])

      // Só "entra" e "ja_existe" sem ausente: nenhum nome do banco aparece, nada é lido.
      const quem = nome()
      await previa(e, e.t1, texto([[quem, matricula()]]))
      const antesDaLeitura = await auditoriaDa(e.escolaId, 'turma.alunos_lidos')
      // O rótulo dos dois ausentes da t1 e o da matrícula que veio da t2: dois nomes da t1 e um da t2.
      const lida = await previa(e, e.t1, texto([[quem, daT2]]))
      expect(lida.status).toBe(200)
      const registro = (turma: string, quantidade: number) => ({ entidade_id: turma, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { quantidade }, finalidade: FINALIDADE })
      const lidas = (await auditoriaDa(e.escolaId, 'turma.alunos_lidos')).slice(antesDaLeitura.length)
      expect(lidas).toHaveLength(2)
      expect(lidas).toEqual(expect.arrayContaining([registro(e.t1, 2), registro(e.t2, 1)]))
      expect(JSON.stringify(lidas)).not.toContain(nomeDaT2)

      // A prévia recusada (turma de outra escola, id sorteado) não grava nada.
      const antes = await retrato(e.escolaId)
      for (const turma of [b.t1, randomUUID()]) expect(semRequisicao(await previa(e, turma, texto([[quem, daT2]])))).toEqual(NAO_ENCONTRADO)
      expect(await retrato(e.escolaId)).toEqual(antes)
      expect(await auditoriaDa(b.escolaId, 'turma.alunos_lidos')).toEqual([])
    })

    it('A2: cada leitura da lista grava `turma.lista_lida` com a finalidade e a quantidade, também a repetida; sem finalidade, ENTRADA_INVALIDA igual para a turma dela, a de outra escola e um id sorteado, e nada é gravado', async () => {
      const e = await escolaComTurmas()
      const b = await escolaComTurmas()
      await gravada(e, e.t1, [
        [nome(), matricula()],
        [nome(), matricula()],
      ])
      expect((await ler(e, e.t1)).status).toBe(200)
      expect((await ler(e, e.t1)).status).toBe(200)
      expect((await ler(e, e.t1, `?finalidade=atendimento_a_familia&limite=1`)).status).toBe(200)
      const registro = (quantidade: number, finalidade: string) => ({ entidade_id: e.t1, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { quantidade }, finalidade })
      expect(await auditoriaDa(e.escolaId, 'turma.lista_lida')).toEqual([registro(2, FINALIDADE), registro(2, FINALIDADE), registro(1, 'atendimento_a_familia')])

      const antes = await retrato(e.escolaId)
      const semFinalidade = [await ler(e, e.t1, ''), await ler(e, b.t1, ''), await ler(e, randomUUID(), '?limite=5')]
      for (const resposta of semFinalidade) expect(semRequisicao(resposta)).toEqual(ENTRADA_INVALIDA)
      expect(semRequisicao(await ler(e, e.t1, '?finalidade=curiosidade'))).toEqual(ENTRADA_INVALIDA)
      // A escola e o ano vêm da sessão: pedi-los na consulta é campo a mais.
      expect(semRequisicao(await ler(e, e.t1, `?finalidade=${FINALIDADE}&escolaId=${b.escolaId}`))).toEqual(ENTRADA_INVALIDA)
      expect(await retrato(e.escolaId)).toEqual(antes)
    })

    it('a leitura traz só os nomes da turma, com matrícula e estado, em ordem de id, paginada', async () => {
      const e = await escolaComTurmas()
      const daT1: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      await gravada(e, e.t1, daT1)
      await gravada(e, e.t2, [[nome(), matricula()]])
      const ids = await Promise.all(daT1.map(([, qual]) => idDaMatricula(e.escolaId, qual)))
      const esperados = daT1.map(([quem, qual], posicao) => ({ id: ids[posicao], nome: quem, matricula: qual, estado: 'livre' })).sort((x, y) => String(x.id).localeCompare(String(y.id)))

      const primeira = await ler(e, e.t1, `?finalidade=${FINALIDADE}&limite=2`)
      expect(primeira.status).toBe(200)
      expect(listaDaTurmaResponseSchema.parse(primeira.corpo)).toEqual({ itens: esperados.slice(0, 2), proxima: esperados[1]?.id })
      const segunda = await ler(e, e.t1, `?finalidade=${FINALIDADE}&limite=2&pagina=${String(primeira.corpo['proxima'])}`)
      expect(segunda.corpo).toEqual({ itens: esperados.slice(2) })
    })
  })

  describe('limites da prévia e do gravar da lista (regra 80, itens 1 e 3; F2, 8.0)', () => {
    const LIMITE_EXCEDIDO = { status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO }
    const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: (resposta.corpo.erro as { codigo?: string } | undefined)?.codigo })
    const vagasDaApi = () => api.app.get<SchoolSemaphore>(VAGAS_DA_PLANILHA, { strict: false })
    const importacoesDe = async (escolaId: string) => (await bancada.pool.query('select id from importacao_planilha where escola_id = $1', [escolaId])).rows

    it('20 pedidos por minuto por usuário, no mesmo balde de `/v1/importacoes`: o 21º recebe 429 na prévia e no gravar da lista e na prévia da planilha, e outro usuário da escola segue', async () => {
      const e = await escolaComTurmas()
      expect(LIMITE_DA_PLANILHA_POR_MINUTO).toBe(20)
      const lista = texto([[nome(), matricula()]])
      const status: number[] = []
      for (let i = 0; i < 20; i += 1) status.push((await previa(e, e.t1, lista)).status)
      expect(status).toEqual(Array<number>(20).fill(200))

      expect(erroDe(await previa(e, e.t1, lista))).toEqual(LIMITE_EXCEDIDO)
      expect(erroDe(await gravar(e, e.t1, lista))).toEqual(LIMITE_EXCEDIDO)
      expect(erroDe(await pedir(e.coordenacao, 'POST', '/v1/importacoes/alunos/previa', { texto: `turma;nome;matricula\n7A;${nome()};${matricula()}` }))).toEqual(LIMITE_EXCEDIDO)
      expect(await importacoesDe(e.escolaId)).toEqual([])

      const outra = await bancada.sessao(e.escolaId, 'coordenador')
      expect((await pedir(outra, 'POST', `/v1/turmas/${e.t1}/lista/previa`, { texto: lista })).status).toBe(200)
    })

    it('[P] duas vagas da escola ocupadas: a prévia e o gravar da lista recebem 429 sem gravar nada, a outra escola segue, e a vaga solta volta', async () => {
      const e = await escolaComTurmas()
      const outra = await escolaComTurmas()
      const lista = texto([[nome(), matricula()]])
      const ocupadas = [await vagasDaApi().ocupar(e.escolaId), await vagasDaApi().ocupar(e.escolaId)]
      expect(VAGAS_DA_PLANILHA_POR_ESCOLA).toBe(2)
      try {
        expect(ocupadas.every((vaga) => vaga !== undefined)).toBe(true)
        expect(erroDe(await previa(e, e.t1, lista))).toEqual(LIMITE_EXCEDIDO)
        expect(erroDe(await gravar(e, e.t1, lista))).toEqual(LIMITE_EXCEDIDO)
        expect((await previa(outra, outra.t1, lista)).status).toBe(200)
      } finally {
        await Promise.all(ocupadas.map((vaga) => vaga?.liberar()))
      }
      expect((await previa(e, e.t1, lista)).status).toBe(200)
      expect(await importacoesDe(e.escolaId)).toEqual([])
    })
  })

  describe('concorrência (regra 80, item 7)', () => {
    /** Para a gravação na turma depois do `insert` dela, antes do commit. */
    const pararNaTurma = (turma: string) => new WriteBlockTrigger(bancada.pool, { tabela: 'lista_nome', evento: 'insert', quando: `new.turma_id = '${turma}'::uuid` })

    it('C8: a mesma lista gravada duas vezes em paralelo entra uma vez: a primeira responde 202 e a segunda, CONFLITO (uma importação na fila por escola); depois do job, a mesma lista conta tudo como já existente', async () => {
      const e = await escolaComTurmas()
      // A turma já tem um nome, fora da lista: a segunda gravação confere só as matrículas dela.
      await gravada(e, e.t1, [[nome(), matricula()]])
      const linhas: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      const respostas = await Promise.all([gravar(e, e.t1, texto(linhas)), gravar(e, e.t1, texto(linhas))])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([202, 409])
      const aceita = respostas.find((resposta) => resposta.status === 202)
      expect(semRequisicao(respostas.find((resposta) => resposta.status === 409) as RespostaHttp)).toEqual(CONFLITO)
      expect(await rodar(e.escolaId, aceita?.corpo['id'] as string)).toBe('concluida')
      expect(await linhasDa(e.escolaId)).toHaveLength(4)
      await gravada(e, e.t1, linhas, { entram: 0, ja_existem: 3 })
      expect(await linhasDa(e.escolaId)).toHaveLength(4)
    })

    it('a matrícula do avulso que chega enquanto o job grava a mesma na lista: o avulso espera o commit do job e responde CONFLITO; o job conclui', async () => {
      const e = await escolaComTurmas()
      const qual = matricula()
      const resposta = await gravar(e, e.t1, texto([[nome(), qual]]))
      expect(resposta.status).toBe(202)
      const gatilho = pararNaTurma(e.t1)
      await gatilho.armar()
      try {
        const rodando = rodar(e.escolaId, resposta.corpo['id'] as string)
        await gatilho.esperarParadas(1)
        const doAvulso = avulso(e, e.t2, { nome: nome(), matricula: qual })
        await esperarNaTrava(bancada.pool, '%insert into "lista_nome"%', 2)
        await gatilho.soltar()
        expect(await rodando).toBe('concluida')
        expect(semRequisicao(await doAvulso)).toEqual(CONFLITO)
      } finally {
        await gatilho.desarmar()
      }
      expect((await linhasDa(e.escolaId)).map((linha) => [linha.matricula, linha.turma_id])).toEqual([[qual, e.t1]])
      expect((await auditoriaDa(e.escolaId, 'lista.gravada')).map((registro) => registro.entidade_id)).toEqual([])
    })

    it('o avulso com a mesma matrícula que entra entre a gravação e o job: o job sai `desatualizada` (a classificação mudou), e nada do texto é gravado', async () => {
      const e = await escolaComTurmas()
      const qual = matricula()
      const outra = matricula()
      const resposta = await gravar(e, e.t1, texto([[nome(), qual], [nome(), outra]]))
      expect(resposta.status).toBe(202)
      expect((await avulso(e, e.t2, { nome: nome(), matricula: qual })).status).toBe(201)
      expect(await rodar(e.escolaId, resposta.corpo['id'] as string)).toBe('desatualizada')
      expect((await linhasDa(e.escolaId)).map((linha) => [linha.matricula, linha.turma_id])).toEqual([[qual, e.t2]])
      expect((await importacaoDe(resposta.corpo['id'] as string)).estado).toBe('desatualizada')
    })

    it('C9: excluir a turma enquanto o job grava a lista: a lista grava, e o excluir recebe CONFLITO', async () => {
      const e = await escolaComTurmas()
      const resposta = await gravar(e, e.t1, texto([[nome(), matricula()]]))
      expect(resposta.status).toBe(202)
      const gatilho = pararNaTurma(e.t1)
      await gatilho.armar()
      try {
        const rodando = rodar(e.escolaId, resposta.corpo['id'] as string)
        await gatilho.esperarParadas(1)
        const exclusao = pedir(e.coordenacao, 'DELETE', `/v1/turmas/${e.t1}`)
        // Desde a 4.0 o excluir trava a turma em `for update` num comando próprio, antes do `delete`: é nele que espera.
        await esperarNaTrava(bancada.pool, '%from "turma"%for update%')
        await gatilho.soltar()
        expect(await rodando).toBe('concluida')
        expect(semRequisicao(await exclusao)).toEqual(CONFLITO)
      } finally {
        await gatilho.desarmar()
      }
      expect((await linhasDa(e.escolaId)).map((linha) => linha.turma_id)).toEqual([e.t1])
    })

    it('C9: a turma que sai antes da lista: a prévia e a gravação recebem NAO_ENCONTRADO; a que sai entre a gravação e o job faz o job sair `desatualizada`; o avulso que espera por ela recebe NAO_ENCONTRADO; nada é gravado', async () => {
      const e = await escolaComTurmas()
      const foi = await turmaNova(e.coordenacao, e.serieId)
      await bancada.pool.query('delete from turma where id = $1', [foi])
      for (const resposta of [await previa(e, foi, texto([[nome(), matricula()]])), await gravar(e, foi, texto([[nome(), matricula()]])), await avulso(e, foi, { nome: nome(), matricula: matricula() })]) {
        expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)
      }

      const saiNoMeio = await turmaNova(e.coordenacao, e.serieId)
      const aceita = await gravar(e, saiNoMeio, texto([[nome(), matricula()]]))
      expect(aceita.status).toBe(202)
      await bancada.pool.query('delete from turma where id = $1', [saiNoMeio])
      expect(await rodar(e.escolaId, aceita.corpo['id'] as string)).toBe('desatualizada')

      const turma = await turmaNova(e.coordenacao, e.serieId)
      const exclusao = await bancada.pool.connect()
      try {
        await exclusao.query('begin')
        await exclusao.query('delete from turma where id = $1', [turma])
        const escrita = avulso(e, turma, { nome: nome(), matricula: matricula() })
        await esperarNaTrava(bancada.pool, '%from "turma"%for key share%')
        await exclusao.query('commit')
        expect(semRequisicao(await escrita)).toEqual(NAO_ENCONTRADO)
      } finally {
        exclusao.release()
      }
      expect(await linhasDa(e.escolaId)).toEqual([])
    })
  })

  it('log (A4): as rotas da lista, com e sem erro, não logam nome, matrícula nem o texto', async () => {
    const e = await escolaComTurmas()
    const CPF_SENTINELA = '987.654.321-00'
    const quem = `${PREFIXO} Sentinela ${randomUUID().slice(0, 8)}`
    const qual = `${PREFIXO}-sentinela-${randomUUID().slice(0, 8)}`
    linhasDeLog.length = 0
    const comErro = await previa(e, e.t1, texto([[quem, qual], ['', qual]]))
    const gravadaComErro = await gravar(e, e.t1, texto([[quem, qual], ['', qual]]))
    const naT1 = await gravar(e, e.t1, texto([[quem, qual]]))
    expect(await rodar(e.escolaId, naT1.corpo['id'] as string)).toBe('concluida')
    // A matrícula que a lista já tem em outra turma é "muda de turma", sem marca: grava sem efeito, e o avulso da mesma é CONFLITO.
    const naT2 = await gravar(e, e.t2, texto([[quem, qual]]))
    expect(await rodar(e.escolaId, naT2.corpo['id'] as string)).toBe('concluida')
    const respostas = [
      comErro,
      gravadaComErro,
      naT1,
      naT2,
      await avulso(e, e.t2, { nome: quem, matricula: qual }),
      await avulso(e, e.t2, { nome: quem }),
      // G2: a matrícula com forma de documento recusada não vai ao log, nem a linha dela na prévia.
      await avulso(e, e.t2, { nome: quem, matricula: CPF_SENTINELA }),
      await previa(e, e.t1, texto([[quem, CPF_SENTINELA]])),
      // O nome corrigido e o candidato (o rótulo traz o nome do banco) saem na resposta, nunca no log.
      await previa(e, e.t1, texto([[`${quem} Corrigido`, qual]])),
      await ler(e, e.t1),
      await ler(e, e.t1, ''),
      await retirar(e, await idDaMatricula(e.escolaId, qual)),
      await retirar(e, randomUUID()),
    ]
    expect(respostas.map((resposta) => resposta.status)).toEqual([200, 400, 202, 202, 409, 400, 400, 200, 200, 200, 400, 204, 404])
    const linhas = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>)
    expect(linhas.filter((linha) => linha['evento'] === 'http.erro')).toHaveLength(6)
    const todoOLog = linhasDeLog.join('\n')
    for (const sentinela of [quem, qual, PREFIXO, CPF_SENTINELA]) expect(todoOLog).not.toContain(sentinela)
  })
})
