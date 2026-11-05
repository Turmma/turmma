import { createDatabase, createPool, executarPlanilha, GradeRepository, ImportacaoRepository, runInContext, type Database, type DatabasePool } from '@educa/core'
import { ErrorCode, gradeResponseSchema, previaDaPlanilhaResponseSchema, type PreviaDaPlanilhaResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * Reimportar a grade e lê-la por turma (F2, tarefa 12.0; `tasks/prd-onboarding-por-convite/cenarios.md`, RF9, RF16 e RF17): a reimportação
 * substitui as aulas do ano e mantém o id da que continua, o vínculo que perdeu as aulas aparece "sai da grade" e só encerra marcado, pelo
 * caminho do `encerrar` (que revoga o acesso), e `GET /v1/grade?turmaId=` serve a coordenação e o professor com vínculo confirmado na turma.
 * Postgres real do compose de teste; escolas, anos, e-mails e nomes gerados.
 */

const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }
const ENTRADA_INVALIDA = { status: 400, codigo: ErrorCode.ENTRADA_INVALIDA }
const PREFIXO = `grd${randomUUID().slice(0, 6)}`
const CABECALHO = 'turma;disciplina;professor;email;dia;inicio;fim;sala'

function erroDe(resposta: RespostaHttp): { status: number; codigo: unknown } {
  return { status: resposta.status, codigo: (resposta.corpo.erro as { codigo?: unknown } | undefined)?.codigo }
}

/** Uma linha da planilha da grade. */
const aula = (turma: string, disciplina: string, p: Professor, dia: string, inicio: string, fim: string, sala = ''): string => [turma, disciplina, p.nome, p.email, dia, inicio, fim, sala].join(';')
const planilha = (...linhas: string[]): string => [CABECALHO, ...linhas].join('\n')

interface Professor {
  readonly usuarioId: string
  readonly nome: string
  readonly email: string
}

interface Escola {
  readonly escolaId: string
  readonly coordenacao: TestSessao
  readonly emCurso: string
  readonly planejado: string
  readonly serieId: string
}

interface AulaNoBanco {
  readonly id: string
  readonly vinculo_id: string
  readonly ano_letivo_id: string
  readonly dia_semana: number
  readonly inicio: string
  readonly fim: string
}

interface VinculoNoBanco {
  readonly id: string
  readonly usuario_id: string
  readonly turma_id: string
  readonly estado: string
  readonly origem: string
  readonly motivo_encerramento: string | null
}

type EstadoDoVinculo = 'pendente' | 'confirmado' | 'contestado' | 'encerrado'

describe('grade: reimportar substitui o ano, e a grade se lê por turma (F2, tarefa 12.0)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let apoio: DatabasePool
  // O banco do job e dos casos de repository abaixo não é o papel da API: ele alcança todas as escolas. O escopo de cada chamada vem só do
  // `runInContext` (regra 10, item 3), e é a cláusula de escopo do repository que esses casos exercitam.
  let bancoDoJob: Database

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {})
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 4, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    bancoDoJob = createDatabase(apoio)
  })

  afterAll(async () => {
    await api.app.close()
    await apoio.end()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const pedir = (sessao: TestSessao, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)
  const lerGrade = (sessao: TestSessao, consulta: string) => pedir(sessao, 'GET', `/v1/grade${consulta}`)

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

  /** A escola com a coordenação, o ano de 2026 em curso, o de 2027 planejado e a série do 8º ano. */
  async function escolaComAnos(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const { rows } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaId])
    return { escolaId, coordenacao, emCurso: await anoNovo(coordenacao, 2026, true), planejado: await anoNovo(coordenacao, 2027, false), serieId: rows[0]?.id ?? '' }
  }

  /** A escola só com o ano planejado: nenhum em curso. */
  async function escolaSemAnoEmCurso(): Promise<Escola> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const { rows } = await bancada.pool.query<{ id: string }>("insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 8) returning id", [escolaId])
    return { escolaId, coordenacao, emCurso: '', planejado: await anoNovo(coordenacao, 2027, false), serieId: rows[0]?.id ?? '' }
  }

  /** A turma do ano (o em curso, se não for dito outro), com a chave que o nome dá: "8º A" é `8a`. */
  async function turmaNa(e: Escola, nome: string, anoId = e.emCurso): Promise<string> {
    const chave = `${nome.charAt(0)}${nome.slice(-1).toLowerCase()}`
    const { rows } = await bancada.pool.query<{ id: string }>('insert into turma (escola_id, ano_letivo_id, serie_id, nome, chave) values ($1, $2, $3, $4, $5) returning id', [e.escolaId, anoId, e.serieId, nome, chave])
    return rows[0]?.id ?? ''
  }

  async function disciplinaNa(e: Escola, nome: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into disciplina (escola_id, nome) values ($1, $2) returning id', [e.escolaId, nome])
    return rows[0]?.id ?? ''
  }

  /** Um professor ativo da escola, com conta própria: é por ela que a planilha o acha. */
  async function professorNaEscola(e: Escola, rotulo: string): Promise<Professor> {
    const nome = `Prof ${rotulo} ${PREFIXO}`
    const email = `${PREFIXO}-${rotulo}-${randomUUID().slice(0, 6)}@professores.invalid`
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'professor', $2, $3) returning id", [e.escolaId, nome, conta[0]?.id])
    return { usuarioId: rows[0]?.id ?? '', nome, email }
  }

  /** O professor da escola que também tem sessão: o que a rota lê é a sessão dele. */
  async function professorComSessao(e: Escola, rotulo: string): Promise<{ professor: Professor; sessao: TestSessao }> {
    const sessao = await bancada.sessao(e.escolaId, 'professor')
    const nome = `Prof ${rotulo} ${PREFIXO}`
    const email = `${PREFIXO}-${rotulo}-${randomUUID().slice(0, 6)}@professores.invalid`
    const { rows: conta } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [email])
    await bancada.pool.query('update usuario set nome = $2, conta_id = $3 where id = $1', [sessao.usuarioId, nome, conta[0]?.id])
    return { professor: { usuarioId: sessao.usuarioId, nome, email }, sessao }
  }

  /** O vínculo de professor feito à mão (origem `coordenacao`, se não for dito outra), no estado pedido. */
  async function vinculoDireto(e: Escola, usuarioId: string, turmaId: string, disciplinaId: string, estado: EstadoDoVinculo, anoId = e.emCurso, origem = 'coordenacao'): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, origem, contestacao, decidido_em, motivo_encerramento, encerrado_em)
       values ($1, $2, $3, $4, $5, 'professor', $6::text, $7, $8, case when $6::text = 'contestado' then 'turma_errada' end, case when $6::text <> 'pendente' then now() end,
               case when $6::text = 'encerrado' then 'desligamento' end, case when $6::text = 'encerrado' then now() end) returning id`,
      [e.escolaId, anoId, usuarioId, turmaId, disciplinaId, estado, e.coordenacao.usuarioId, origem],
    )
    return rows[0]?.id ?? ''
  }

  async function aulaDireta(e: Escola, vinculoId: string, dia: number, inicio: string, fim: string, anoId = e.emCurso): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into alocacao (escola_id, ano_letivo_id, vinculo_id, dia_semana, inicio, fim) values ($1, $2, $3, $4, $5, $6) returning id', [e.escolaId, anoId, vinculoId, dia, inicio, fim])
    return rows[0]?.id ?? ''
  }

  /** Um acesso de turma vigente que o professor gerou, ainda não revogado. */
  async function acessoDoProfessor(e: Escola, professorId: string, turmaId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      "insert into acesso_turma (escola_id, ano_letivo_id, turma_id, token_hash, codigo_hmac, validade_dias, expira_em, criado_por) values ($1, $2, $3, $4, $5, 7, now() + interval '7 days', $6) returning id",
      [e.escolaId, e.emCurso, turmaId, randomUUID(), randomUUID(), professorId],
    )
    return rows[0]?.id ?? ''
  }

  const previa = (e: Escola, texto: string, extra: Record<string, unknown> = {}) => pedir(e.coordenacao, 'POST', '/v1/importacoes/grade/previa', { texto, ...extra })

  async function candidatosDa(e: Escola, texto: string, extra: Record<string, unknown> = {}): Promise<PreviaDaPlanilhaResponse> {
    const lida = await previa(e, texto, extra)
    expect(lida.status).toBe(200)
    return previaDaPlanilhaResponseSchema.parse(lida.corpo)
  }

  /** O job uma vez, na escola do job: a grade só reaproveita professor que a escola já tem, e por isso o job nunca pede conta global. */
  const rodar = (escolaId: string, importacaoId: string) =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, () =>
      executarPlanilha(bancoDoJob, importacaoId, { acharConta: () => Promise.reject(new Error('a grade deste teste não cadastra professor')), travarContas: () => Promise.resolve(true) }),
    )

  /** Grava a planilha da grade (202), com as marcas e o filtro de ano pedidos, e devolve o id da importação. */
  async function gravar(e: Escola, texto: string, extra: { marcas?: { encerrar: string[] }; anoLetivoId?: string; tipo?: string } = {}): Promise<string> {
    const marcas = { transferir: [], desligar: [], encerrar: extra.marcas?.encerrar ?? [] }
    return criado(pedir(e.coordenacao, 'POST', `/v1/importacoes/${extra.tipo ?? 'grade'}`, { texto, marcas, ...(extra.anoLetivoId === undefined ? {} : { anoLetivoId: extra.anoLetivoId }) }), 202)
  }

  /** Grava e roda o job; devolve o que a importação ficou sendo. */
  async function importar(e: Escola, texto: string, extra: { marcas?: { encerrar: string[] }; anoLetivoId?: string; tipo?: string } = {}): Promise<{ estado: string; resumo: Record<string, number> | null }> {
    const id = await gravar(e, texto, extra)
    await rodar(e.escolaId, id)
    const { rows } = await bancada.pool.query<{ estado: string; resumo: Record<string, number> | null }>('select estado, resumo from importacao_planilha where id = $1', [id])
    return rows[0] ?? { estado: 'sumiu', resumo: null }
  }

  async function aulasDe(e: Escola, anoId = e.emCurso): Promise<AulaNoBanco[]> {
    const { rows } = await bancada.pool.query<AulaNoBanco>(
      "select id, vinculo_id, ano_letivo_id, dia_semana, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from alocacao where escola_id = $1 and ano_letivo_id = $2 order by dia_semana, inicio, id",
      [e.escolaId, anoId],
    )
    return rows
  }

  async function vinculosDe(e: Escola, anoId = e.emCurso): Promise<VinculoNoBanco[]> {
    const { rows } = await bancada.pool.query<VinculoNoBanco>(
      "select id, usuario_id, turma_id, estado, origem, motivo_encerramento from vinculo where escola_id = $1 and ano_letivo_id = $2 and papel = 'professor' order by id",
      [e.escolaId, anoId],
    )
    return rows
  }

  async function auditoriaDe(e: Escola, acao: string): Promise<Array<{ entidade_id: string; antes: unknown; depois: unknown }>> {
    const { rows } = await bancada.pool.query<{ entidade_id: string; antes: unknown; depois: unknown }>('select entidade_id, antes, depois from auditoria where escola_id = $1 and acao = $2 order by id', [e.escolaId, acao])
    return rows
  }

  const estadoDoVinculo = async (vinculoId: string): Promise<string | undefined> =>
    (await bancada.pool.query<{ estado: string }>('select estado from vinculo where id = $1', [vinculoId])).rows[0]?.estado

  /** A escola da A, as turmas 8ºA e 8ºB, a Química e três professores com a grade de cada um já importada: a Ana na 8ºA, o Bruno e a Carla na 8ºB. */
  async function escolaComGradeImportada() {
    const e = await escolaComAnos()
    const t8a = await turmaNa(e, '8º A')
    const t8b = await turmaNa(e, '8º B')
    const quimica = await disciplinaNa(e, 'Química')
    const fisica = await disciplinaNa(e, 'Física')
    const [ana, bruno, carla] = [await professorNaEscola(e, 'ana'), await professorNaEscola(e, 'bruno'), await professorNaEscola(e, 'carla')]
    if (ana === undefined || bruno === undefined || carla === undefined) throw new Error('professores de teste não criados')
    const linhas = {
      ana: [aula('8A', 'Química', ana, 'segunda', '8:00', '8:50', 'Sala 1'), aula('8A', 'Química', ana, 'terça', '9:00', '9:50')],
      bruno: [aula('8B', 'Química', bruno, 'segunda', '10:00', '10:50')],
      carla: [aula('8B', 'Física', carla, 'quarta', '8:00', '8:50')],
    }
    const primeira = await importar(e, planilha(...linhas.ana, ...linhas.bruno, ...linhas.carla))
    expect(primeira.estado).toBe('concluida')
    return { e, t8a, t8b, quimica, fisica, ana, bruno, carla, linhas }
  }

  /**
   * A escola com a Ana na 8ºA e um professor com sessão na 8ºB, a grade dos dois já importada: é o professor que a marca "sai da grade" encerra.
   * `saida` é a planilha só com a linha da Ana (a que tira o professor da grade), e `linhaDele` a dele, para a reimportação que o mantém.
   */
  async function escolaComProfessorQueSai(estado: 'pendente' | 'confirmado' = 'confirmado') {
    const e = await escolaComAnos()
    const t8a = await turmaNa(e, '8º A')
    const t8b = await turmaNa(e, '8º B')
    await disciplinaNa(e, 'Química')
    await disciplinaNa(e, 'Física')
    const ana = await professorNaEscola(e, 'ana')
    const { professor, sessao } = await professorComSessao(e, 'saindo')
    const linhaAna = aula('8A', 'Química', ana, 'segunda', '8:00', '8:50')
    const linhaDele = aula('8B', 'Química', professor, 'segunda', '9:00', '9:50')
    expect((await importar(e, planilha(linhaAna, linhaDele))).estado).toBe('concluida')
    const doProfessor = (await vinculosDe(e)).find(({ usuario_id }) => usuario_id === professor.usuarioId)?.id ?? ''
    if (estado === 'confirmado') await bancada.pool.query("update vinculo set estado = 'confirmado', decidido_em = now() where id = $1", [doProfessor])
    return { e, t8a, t8b, ana, professor, sessao, doProfessor, linhaAna, linhaDele, saida: planilha(linhaAna) }
  }

  const gerarAcesso = (sessao: TestSessao, turmaId: string) => pedir(sessao, 'POST', `/v1/turmas/${turmaId}/acesso`, { validadeDias: 7 })

  const acessosVigentes = async (turmaId: string): Promise<string[]> =>
    (await bancada.pool.query<{ id: string }>('select id from acesso_turma where turma_id = $1 and revogado_em is null order by id', [turmaId])).rows.map(({ id }) => id)

  const estadoDaImportacao = async (importacaoId: string): Promise<string | undefined> =>
    (await bancada.pool.query<{ estado: string }>('select estado from importacao_planilha where id = $1', [importacaoId])).rows[0]?.estado

  it('reimportar mantém o id da aula que continua (vínculo, dia, início), muda o fim e a sala nela, e cria só a nova', async () => {
    const { e, ana, linhas } = await escolaComGradeImportada()
    const antes = await aulasDe(e)
    expect(antes).toHaveLength(4)
    const daAnaNaSegunda = antes.find((a) => a.dia_semana === 1 && a.inicio === '08:00')

    const segunda = await importar(e, planilha(aula('8A', 'Química', ana, 'segunda', '8:00', '9:00', 'Sala 2'), linhas.ana[1] ?? '', aula('8A', 'Química', ana, 'quarta', '10:00', '10:50'), ...linhas.bruno, ...linhas.carla))

    expect(segunda).toEqual({ estado: 'concluida', resumo: expect.objectContaining({ aulas: 2, ja_existem: 3 }) })
    const depois = await aulasDe(e)
    expect(depois).toHaveLength(5)
    expect(depois.find((a) => a.dia_semana === 1 && a.inicio === '08:00')).toEqual({ ...daAnaNaSegunda, fim: '09:00' })
    // Nenhuma das quatro aulas de antes mudou de id, e a única nova é a de quarta às 10h.
    expect(antes.every(({ id }) => depois.some((a) => a.id === id))).toBe(true)
    expect(depois.filter(({ id }) => !antes.some((a) => a.id === id)).map(({ dia_semana, inicio }) => [dia_semana, inicio])).toEqual([[3, '10:00']])
    expect(segunda.resumo).not.toHaveProperty('aulas_removidas')
    expect(segunda.resumo).not.toHaveProperty('vinculos_encerrados')
  })

  it('a aula que a planilha não traz sai do ano, mesmo de um vínculo que continua; a do outro ano e a da outra escola ficam', async () => {
    const { e, ana, linhas } = await escolaComGradeImportada()
    const outraEscola = await escolaComGradeImportada()
    const planejadaId = await turmaNa(e, '8º C', e.planejado)
    const quimica = await disciplinaNa(e, 'Química do planejado')
    const doPlanejado = await aulaDireta(e, await vinculoDireto(e, ana.usuarioId, planejadaId, quimica, 'pendente', e.planejado), 5, '08:00', '08:50', e.planejado)
    const aulasDeAntes = await aulasDe(e)
    const daTerca = aulasDeAntes.find((a) => a.dia_semana === 2)

    const reimportada = await importar(e, planilha(linhas.ana[0] ?? '', ...linhas.bruno, ...linhas.carla))

    expect(reimportada).toEqual({ estado: 'concluida', resumo: expect.objectContaining({ aulas_removidas: 1 }) })
    expect((await aulasDe(e)).map(({ id }) => id)).not.toContain(daTerca?.id)
    expect(await aulasDe(e)).toHaveLength(3)
    // O vínculo da Ana continua aberto: ainda tem a aula de segunda, e nenhuma marca o encerrou.
    expect((await vinculosDe(e)).filter(({ usuario_id }) => usuario_id === ana.usuarioId).map(({ estado }) => estado)).toEqual(['pendente'])
    expect((await aulasDe(e, e.planejado)).map(({ id }) => id)).toEqual([doPlanejado])
    expect(await aulasDe(outraEscola.e)).toHaveLength(4)
  })

  it('o vínculo da grade que perdeu as aulas aparece "sai da grade" na prévia, e só encerra marcado: sem a marca, ele segue aberto e sem aula', async () => {
    const { e, bruno, linhas } = await escolaComGradeImportada()
    const doBruno = (await vinculosDe(e)).find(({ usuario_id }) => usuario_id === bruno.usuarioId)

    const lida = await candidatosDa(e, planilha(...linhas.ana, ...linhas.carla))
    expect(lida.candidatos).toEqual([{ id: doBruno?.id, acao: 'encerrar', rotulo: `${bruno.nome} · 8º B · Química` }])
    expect(lida.contagens).toMatchObject({ aulas_removidas: 1 })

    const semMarca = await importar(e, planilha(...linhas.ana, ...linhas.carla))

    expect(semMarca).toEqual({ estado: 'concluida', resumo: expect.objectContaining({ aulas_removidas: 1 }) })
    expect(semMarca.resumo).not.toHaveProperty('vinculos_encerrados')
    expect(await estadoDoVinculo(doBruno?.id ?? '')).toBe('pendente')
    expect((await aulasDe(e)).filter(({ vinculo_id }) => vinculo_id === doBruno?.id)).toEqual([])
    expect(await auditoriaDe(e, 'vinculo.encerrado')).toEqual([])
    // Sem a aula, o vínculo continua candidato na reimportação seguinte: a marca vale a qualquer tempo, porque o vínculo nasceu da grade.
    expect((await candidatosDa(e, planilha(...linhas.ana, ...linhas.carla))).candidatos.map(({ id }) => id)).toEqual([doBruno?.id])
  })

  it('o marcado encerra por `realocacao`, e só ele: o outro candidato sem marca segue aberto, e o resumo conta o que encerrou', async () => {
    const { e, bruno, carla, ana, linhas } = await escolaComGradeImportada()
    const vinculos = await vinculosDe(e)
    const doBruno = vinculos.find(({ usuario_id }) => usuario_id === bruno.usuarioId)
    const daCarla = vinculos.find(({ usuario_id }) => usuario_id === carla.usuarioId)

    const marcada = await importar(e, planilha(...linhas.ana), { marcas: { encerrar: [doBruno?.id ?? ''] } })

    expect(marcada).toEqual({ estado: 'concluida', resumo: expect.objectContaining({ aulas_removidas: 2, vinculos_encerrados: 1 }) })
    const depois = await vinculosDe(e)
    expect(depois.find(({ id }) => id === doBruno?.id)).toMatchObject({ estado: 'encerrado', motivo_encerramento: 'realocacao' })
    expect(depois.find(({ id }) => id === daCarla?.id)).toMatchObject({ estado: 'pendente', motivo_encerramento: null })
    expect(depois.find(({ usuario_id }) => usuario_id === ana.usuarioId)).toMatchObject({ estado: 'pendente' })
    expect(await aulasDe(e)).toHaveLength(2)
  })

  it('"sai da grade" passa pelo `encerrar`: o acesso que o professor gerou na turma é revogado, o de outro professor fica, e a auditoria traz a origem sem nome nem e-mail', async () => {
    const { e, t8a, t8b, bruno, linhas, ana } = await escolaComGradeImportada()
    const doBruno = (await vinculosDe(e)).find(({ usuario_id }) => usuario_id === bruno.usuarioId)
    const daAna = (await vinculosDe(e)).find(({ usuario_id }) => usuario_id === ana.usuarioId)
    await bancada.pool.query("update vinculo set estado = 'confirmado', decidido_em = now() where id = any($1::uuid[])", [[doBruno?.id, daAna?.id]])
    const acessoDoBruno = await acessoDoProfessor(e, bruno.usuarioId, t8b)
    const acessoDaAna = await acessoDoProfessor(e, ana.usuarioId, t8a)
    const revogadoEm = async (id: string) => (await bancada.pool.query<{ revogado_em: Date | null }>('select revogado_em from acesso_turma where id = $1', [id])).rows[0]?.revogado_em

    await importar(e, planilha(...linhas.ana), { marcas: { encerrar: [doBruno?.id ?? ''] } })

    expect(await revogadoEm(acessoDoBruno)).not.toBeNull()
    expect(await revogadoEm(acessoDaAna)).toBeNull()
    const [encerrado] = await auditoriaDe(e, 'vinculo.encerrado')
    expect(encerrado).toEqual({ entidade_id: doBruno?.id, antes: { estado: 'confirmado' }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'grade' } })
    expect(await auditoriaDe(e, 'vinculo.encerrado')).toHaveLength(1)
    expect((await auditoriaDe(e, 'acesso_turma.revogado')).map(({ entidade_id }) => entidade_id)).toEqual([acessoDoBruno])
    expect(JSON.stringify(await auditoriaDe(e, 'planilha.gravada'))).not.toMatch(new RegExp(`${PREFIXO}|professores\\.invalid`))
    expect(JSON.stringify(await auditoriaDe(e, 'vinculo.encerrado'))).not.toMatch(new RegExp(`${PREFIXO}|professores\\.invalid`))
  })

  it('o vínculo feito à mão sem aula fica e não é candidato; marcá-lo é ENTRADA_INVALIDA, e o vínculo à mão que tinha aula entra na lista', async () => {
    const { e, t8a, t8b, quimica, fisica, linhas } = await escolaComGradeImportada()
    const deDiana = await professorNaEscola(e, 'diana')
    const semAula = await vinculoDireto(e, deDiana.usuarioId, t8a, fisica, 'confirmado')
    const comAula = await vinculoDireto(e, deDiana.usuarioId, t8b, quimica, 'confirmado')
    await aulaDireta(e, comAula, 4, '08:00', '08:50')

    const todas = planilha(...linhas.ana, ...linhas.bruno, ...linhas.carla)
    const lida = await candidatosDa(e, todas)
    expect(lida.candidatos.map(({ id }) => id)).toEqual([comAula])

    const recusada = await pedir(e.coordenacao, 'POST', '/v1/importacoes/grade', { texto: todas, marcas: { transferir: [], desligar: [], encerrar: [semAula] } })
    expect(erroDe(recusada)).toEqual(ENTRADA_INVALIDA)
    const naoEhEncerrar = await pedir(e.coordenacao, 'POST', '/v1/importacoes/grade', { texto: todas, marcas: { transferir: [], desligar: [comAula], encerrar: [] } })
    expect(erroDe(naoEhEncerrar)).toEqual(ENTRADA_INVALIDA)

    const reimportada = await importar(e, todas)
    expect(reimportada).toEqual({ estado: 'concluida', resumo: expect.objectContaining({ aulas_removidas: 1 }) })
    expect(await estadoDoVinculo(semAula)).toBe('confirmado')
    expect(await estadoDoVinculo(comAula)).toBe('confirmado')
  })

  it('planilha com erro de linha não oferece candidato nem conta aula que sai, e o gravar a recusa', async () => {
    const { e, ana, linhas } = await escolaComGradeImportada()
    const comErro = planilha(...linhas.ana, aula('8A', 'Química', ana, 'quinta', '9:00', '8:00'))

    const lida = await candidatosDa(e, comErro)
    expect(lida.linhas.some(({ resultado }) => resultado === 'erro')).toBe(true)
    expect(lida.candidatos).toEqual([])
    expect(lida.contagens).not.toHaveProperty('aulas_removidas')
    expect(erroDe(await pedir(e.coordenacao, 'POST', '/v1/importacoes/grade', { texto: comErro }))).toEqual(ENTRADA_INVALIDA)
    expect(await aulasDe(e)).toHaveLength(4)
  })

  it('o vínculo encerrado à mão, ou a aula posta à mão, entre o gravar e o job: a importação sai `desatualizada` e nada é apagado nem encerrado', async () => {
    const { e, bruno, carla, linhas } = await escolaComGradeImportada()
    const vinculos = await vinculosDe(e)
    const doBruno = vinculos.find(({ usuario_id }) => usuario_id === bruno.usuarioId)
    const daCarla = vinculos.find(({ usuario_id }) => usuario_id === carla.usuarioId)
    const texto = planilha(...linhas.ana)

    const aoEncerrarAMao = await gravar(e, texto, { marcas: { encerrar: [doBruno?.id ?? ''] } })
    await bancada.pool.query("update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where id = $1", [doBruno?.id])
    await rodar(e.escolaId, aoEncerrarAMao)
    const aulasDepois = await aulasDe(e)
    expect((await bancada.pool.query<{ estado: string }>('select estado from importacao_planilha where id = $1', [aoEncerrarAMao])).rows[0]?.estado).toBe('desatualizada')
    expect(aulasDepois).toHaveLength(4)
    expect(await estadoDoVinculo(daCarla?.id ?? '')).toBe('pendente')

    const aoPorAula = await gravar(e, texto)
    await aulaDireta(e, daCarla?.id ?? '', 6, '08:00', '08:50')
    await rodar(e.escolaId, aoPorAula)
    expect((await bancada.pool.query<{ estado: string }>('select estado from importacao_planilha where id = $1', [aoPorAula])).rows[0]?.estado).toBe('desatualizada')
    expect(await aulasDe(e)).toHaveLength(5)
  })

  it('a marca com o id de um vínculo da escola B, no `POST /v1/importacoes/grade` da A, é ENTRADA_INVALIDA, e nada muda nas duas escolas', async () => {
    const a = await escolaComGradeImportada()
    const b = await escolaComGradeImportada()
    const doBrunoNaA = (await vinculosDe(a.e)).find(({ usuario_id }) => usuario_id === a.bruno.usuarioId)?.id
    const daB = (await vinculosDe(b.e))[0]?.id ?? ''
    const semBruno = planilha(...a.linhas.ana, ...a.linhas.carla)
    // O candidato existe na A (o Bruno saiu da planilha): o que a marca da B tem de errar é o id, não a falta de candidato.
    expect((await candidatosDa(a.e, semBruno)).candidatos.map(({ id }) => id)).toEqual([doBrunoNaA])

    const recusada = await pedir(a.e.coordenacao, 'POST', '/v1/importacoes/grade', { texto: semBruno, marcas: { transferir: [], desligar: [], encerrar: [daB] } })

    expect(erroDe(recusada)).toEqual(ENTRADA_INVALIDA)
    expect(await estadoDoVinculo(daB)).toBe('pendente')
    expect(await estadoDoVinculo(doBrunoNaA ?? '')).toBe('pendente')
    expect(await aulasDe(a.e)).toHaveLength(4)
    expect(await aulasDe(b.e)).toHaveLength(4)
  })

  describe('o "sai da grade" pela planilha contra o gerar e contra o confirmar do professor (regra 20, item 18)', () => {
    it('o gerar parado depois do insert: o job com a marca espera a turma e revoga o acesso que acabou de nascer', async () => {
      const s = await escolaComProfessorQueSai()
      const importacaoId = await gravar(s.e, s.saida, { marcas: { encerrar: [s.doProfessor] } })
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'acesso_turma', evento: 'insert', quando: `new.turma_id = '${s.t8b}'::uuid` })
      await gatilho.armar()
      try {
        const gerando = gerarAcesso(s.sessao, s.t8b)
        await gatilho.esperarParadas()
        const rodando = rodar(s.e.escolaId, importacaoId)
        await esperarNaTrava(bancada.pool, '%"turma"%for no key update%')
        await gatilho.soltar()
        const [gerado] = await Promise.all([gerando, rodando])
        expect(gerado.status).toBe(201)
      } finally {
        await gatilho.desarmar()
      }
      expect(await estadoDaImportacao(importacaoId)).toBe('concluida')
      expect(await estadoDoVinculo(s.doProfessor)).toBe('encerrado')
      expect(await acessosVigentes(s.t8b)).toEqual([])
      expect(await auditoriaDe(s.e, 'acesso_turma.revogado')).toHaveLength(1)
    })

    it('o job parado com a turma travada: o gerar espera, reconfere o vínculo e sai NAO_ENCONTRADO, sem acesso vigente', async () => {
      const s = await escolaComProfessorQueSai()
      const importacaoId = await gravar(s.e, s.saida, { marcas: { encerrar: [s.doProfessor] } })
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'vinculo', evento: 'update', quando: `new.id = '${s.doProfessor}'::uuid and new.estado = 'encerrado'` })
      await gatilho.armar()
      try {
        const rodando = rodar(s.e.escolaId, importacaoId)
        await gatilho.esperarParadas()
        const gerando = gerarAcesso(s.sessao, s.t8b)
        await esperarNaTrava(bancada.pool, '%"turma"%for share%')
        await gatilho.soltar()
        const [, gerado] = await Promise.all([rodando, gerando])
        expect(erroDe(gerado)).toEqual(NAO_ENCONTRADO)
      } finally {
        await gatilho.desarmar()
      }
      expect(await estadoDaImportacao(importacaoId)).toBe('concluida')
      expect(await acessosVigentes(s.t8b)).toEqual([])
    })

    it('o job contra o confirmar do professor no vínculo marcado: sem deadlock, o vínculo termina encerrado, e o estado de antes na auditoria é o que o confirmar deixou', async () => {
      const s = await escolaComProfessorQueSai('pendente')
      const importacaoId = await gravar(s.e, s.saida, { marcas: { encerrar: [s.doProfessor] } })
      const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'vinculo', evento: 'update', quando: `new.id = '${s.doProfessor}'::uuid and new.estado = 'confirmado'` })
      await gatilho.armar()
      try {
        const confirmando = pedir(s.sessao, 'POST', `/v1/vinculos/${s.doProfessor}/confirmar`)
        await gatilho.esperarParadas()
        const rodando = rodar(s.e.escolaId, importacaoId)
        // O job espera a linha do vínculo, que o confirmar ainda segura: sem o `FOR UPDATE` ele leria `pendente` e passaria direto.
        await esperarNaTrava(bancada.pool, '%from "vinculo"%for update%')
        await gatilho.soltar()
        const [confirmado] = await Promise.all([confirmando, rodando])
        expect(confirmado.status).toBe(200)
      } finally {
        await gatilho.desarmar()
      }
      expect(await estadoDaImportacao(importacaoId)).toBe('concluida')
      expect(await estadoDoVinculo(s.doProfessor)).toBe('encerrado')
      expect((await auditoriaDe(s.e, 'vinculo.encerrado')).map(({ antes }) => antes)).toEqual([{ estado: 'confirmado' }])
      expect(await auditoriaDe(s.e, 'vinculo.confirmado')).toHaveLength(1)
    })
  })

  it('o professor com duas disciplinas na mesma turma: marcar a Física pelo "sai da grade" mantém o acesso que a Química confirmada segura, e marcar a Química depois o revoga', async () => {
    const s = await escolaComProfessorQueSai()
    const linhaFisica = aula('8B', 'Física', s.professor, 'terça', '10:00', '10:50')
    expect((await importar(s.e, planilha(s.linhaAna, s.linhaDele, linhaFisica))).estado).toBe('concluida')
    const daFisica = (await vinculosDe(s.e)).find(({ usuario_id, estado }) => usuario_id === s.professor.usuarioId && estado === 'pendente')?.id ?? ''
    await bancada.pool.query("update vinculo set estado = 'confirmado', decidido_em = now() where id = $1", [daFisica])
    const acesso = await acessoDoProfessor(s.e, s.professor.usuarioId, s.t8b)

    const marcaFisica = await importar(s.e, planilha(s.linhaAna, s.linhaDele), { marcas: { encerrar: [daFisica] } })

    expect(marcaFisica).toEqual({ estado: 'concluida', resumo: expect.objectContaining({ vinculos_encerrados: 1 }) })
    expect(await estadoDoVinculo(daFisica)).toBe('encerrado')
    expect(await estadoDoVinculo(s.doProfessor)).toBe('confirmado')
    expect(await acessosVigentes(s.t8b)).toEqual([acesso])
    expect(await auditoriaDe(s.e, 'acesso_turma.revogado')).toEqual([])

    const marcaQuimica = await importar(s.e, s.saida, { marcas: { encerrar: [s.doProfessor] } })

    expect(marcaQuimica.estado).toBe('concluida')
    expect(await estadoDoVinculo(s.doProfessor)).toBe('encerrado')
    expect(await acessosVigentes(s.t8b)).toEqual([])
    expect((await auditoriaDe(s.e, 'acesso_turma.revogado')).map(({ entidade_id }) => entidade_id)).toEqual([acesso])
  })

  it('a grade e o calendário do planejado não tocam o ano anterior: aulas, vínculos e eventos do ano em curso seguem como estavam', async () => {
    const { e, ana, quimica } = await escolaComGradeImportada()
    await bancada.pool.query("insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, 'feriado', '2026-04-21', '2026-04-21', $3)", [e.escolaId, e.emCurso, `${PREFIXO} Tiradentes`])
    const aulasDeAntes = await aulasDe(e)
    const vinculosDeAntes = await vinculosDe(e)
    const t8aPlanejada = await turmaNa(e, '8º A', e.planejado)
    const doPlanejado = await vinculoDireto(e, ana.usuarioId, t8aPlanejada, quimica, 'pendente', e.planejado, 'grade')
    await aulaDireta(e, doPlanejado, 1, '07:00', '07:50', e.planejado)

    const grade = await importar(e, planilha(aula('8A', 'Química', ana, 'quinta', '8:00', '8:50')), { anoLetivoId: e.planejado })
    const calendario = await importar(e, 'inicio;fim;tipo;descricao\n2027-04-21;2027-04-21;feriado;Tiradentes de 2027', { anoLetivoId: e.planejado, tipo: 'calendario' })

    expect(grade).toEqual({ estado: 'concluida', resumo: expect.objectContaining({ aulas: 1 }) })
    expect(calendario).toEqual({ estado: 'concluida', resumo: expect.objectContaining({ entram: 1 }) })
    expect(await aulasDe(e)).toEqual(aulasDeAntes)
    expect(await vinculosDe(e)).toEqual(vinculosDeAntes)
    const doPlano = await aulasDe(e, e.planejado)
    expect(doPlano.map(({ dia_semana, inicio }) => [dia_semana, inicio])).toEqual([[4, '08:00']])
    const { rows: eventos } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from evento_calendario where escola_id = $1 and ano_letivo_id = $2', [e.escolaId, e.emCurso])
    expect(eventos[0]?.total).toBe(1)
    const { rows: doPlanejado2 } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from evento_calendario where escola_id = $1 and ano_letivo_id = $2', [e.escolaId, e.planejado])
    expect(doPlanejado2[0]?.total).toBe(1)
  })

  it('apagar aula só alcança a escola do contexto e o ano pedido: o id de outro ano, ou de outra escola, não é apagado', async () => {
    const { e, ana, quimica } = await escolaComGradeImportada()
    const outra = await escolaComGradeImportada()
    const t8aPlanejada = await turmaNa(e, '8º A', e.planejado)
    const doPlanejado = await aulaDireta(e, await vinculoDireto(e, ana.usuarioId, t8aPlanejada, quimica, 'pendente', e.planejado), 1, '07:00', '07:50', e.planejado)
    const doAnoEmCurso = (await aulasDe(e))[0]?.id ?? ''
    const daOutra = (await aulasDe(outra.e))[0]?.id ?? ''
    const apagar = (anoId: string, ids: string[]) =>
      // O banco do job vê todas as escolas: o escopo é só o `runInContext` (ver `bancoDoJob`).
      runInContext({ requisicaoId: randomUUID(), escolaId: e.escolaId }, () => new ImportacaoRepository(bancoDoJob).apagarAulas(anoId, ids))

    expect(await apagar(e.planejado, [doAnoEmCurso, daOutra])).toBe(0)
    expect(await apagar(e.emCurso, [doPlanejado, daOutra])).toBe(0)

    expect(await aulasDe(e)).toHaveLength(4)
    expect(await aulasDe(e, e.planejado)).toHaveLength(1)
    expect(await aulasDe(outra.e)).toHaveLength(4)
    expect(await apagar(e.emCurso, [doAnoEmCurso])).toBe(1)
    expect(await aulasDe(e)).toHaveLength(3)
  })

  it('encerrar o "sai da grade" só alcança o vínculo de professor aberto da escola e do ano pedidos: o de outro ano, o de outra escola, o de aluno e o já encerrado não mudam', async () => {
    const { e, ana, t8a, quimica } = await escolaComGradeImportada()
    const outra = await escolaComGradeImportada()
    const t8aPlanejada = await turmaNa(e, '8º A', e.planejado)
    const doPlanejado = await vinculoDireto(e, ana.usuarioId, t8aPlanejada, quimica, 'pendente', e.planejado)
    const daOutra = (await vinculosDe(outra.e))[0]?.id ?? ''
    const doAluno = (await bancada.pool.query<{ id: string }>(
      "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5) returning id",
      [e.escolaId, e.emCurso, (await bancada.sessao(e.escolaId, 'aluno')).usuarioId, t8a, e.coordenacao.usuarioId],
    )).rows[0]?.id ?? ''
    const jaEncerrado = await vinculoDireto(e, ana.usuarioId, t8a, await disciplinaNa(e, 'Artes'), 'encerrado')
    const doAno = (await vinculosDe(e)).find(({ usuario_id, estado }) => usuario_id === ana.usuarioId && estado === 'pendente')?.id ?? ''
    const encerrar = (anoId: string, ids: string[]) =>
      // O banco do job vê todas as escolas: o escopo é só o `runInContext` (ver `bancoDoJob`).
      runInContext({ requisicaoId: randomUUID(), escolaId: e.escolaId }, () => new ImportacaoRepository(bancoDoJob).encerrarVinculosDeProfessorDaGrade(anoId, ids, 'realocacao'))

    expect(await encerrar(e.emCurso, [doPlanejado, daOutra, doAluno, jaEncerrado])).toEqual([])
    expect(await encerrar(e.planejado, [doAno])).toEqual([])
    expect(await estadoDoVinculo(doPlanejado)).toBe('pendente')
    expect(await estadoDoVinculo(daOutra)).toBe('pendente')
    expect(await estadoDoVinculo(doAluno)).toBe('confirmado')
    expect(await estadoDoVinculo(jaEncerrado)).toBe('encerrado')
    expect(await estadoDoVinculo(doAno)).toBe('pendente')

    expect(await encerrar(e.emCurso, [doAno, doPlanejado])).toEqual([{ id: doAno, usuarioId: ana.usuarioId, turmaId: t8a, estadoAntes: 'pendente' }])
    expect(await estadoDoVinculo(doAno)).toBe('encerrado')
    expect(await estadoDoVinculo(doPlanejado)).toBe('pendente')
    expect(await estadoDoVinculo(doAluno)).toBe('confirmado')
  })

  it('a leitura da grade só alcança a turma da escola do contexto e do ano pedido: a turma de outra escola ou de outro ano não existe, e não devolve aula', async () => {
    const { e, t8a } = await escolaComGradeImportada()
    const outra = await escolaComGradeImportada()
    // O banco do job vê todas as escolas: o escopo é só o `runInContext` (ver `bancoDoJob`).
    const ler = <T>(leitura: (grade: GradeRepository) => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId: e.escolaId }, () => leitura(new GradeRepository(bancoDoJob)))

    expect(await ler((grade) => grade.turmaExiste(e.emCurso, t8a))).toBe(true)
    expect(await ler((grade) => grade.turmaExiste(e.emCurso, outra.t8a))).toBe(false)
    expect(await ler((grade) => grade.turmaExiste(e.planejado, t8a))).toBe(false)
    expect((await ler((grade) => grade.aulasDaTurma(e.emCurso, t8a))).map(({ diaSemana }) => diaSemana)).toEqual([1, 2])
    expect(await ler((grade) => grade.aulasDaTurma(e.emCurso, outra.t8a))).toEqual([])
    expect(await ler((grade) => grade.aulasDaTurma(e.planejado, t8a))).toEqual([])
  })

  it('a coordenação lê a grade da turma, por dia e horário, sem e-mail; a aula de vínculo encerrado não aparece, e a de outra turma tampouco', async () => {
    const { e, t8a, t8b, ana, quimica } = await escolaComGradeImportada()
    const daEncerrada = await vinculoDireto(e, ana.usuarioId, t8b, quimica, 'encerrado')
    await aulaDireta(e, daEncerrada, 5, '07:00', '07:50')
    // Duas aulas fora da ordem em que nasceram, para a leitura provar que ordena por dia e depois por início.
    const daAna = (await vinculosDe(e)).find(({ usuario_id, turma_id }) => usuario_id === ana.usuarioId && turma_id === t8a)?.id ?? ''
    await aulaDireta(e, daAna, 3, '07:00', '07:50')
    await aulaDireta(e, daAna, 1, '07:00', '07:50')
    const jaHaviaNaOutra = await lerGrade(e.coordenacao, `?turmaId=${t8b}`)
    expect(jaHaviaNaOutra.status).toBe(200)

    const lida = await lerGrade(e.coordenacao, `?turmaId=${t8a}`)

    expect(lida.status).toBe(200)
    const { aulas } = gradeResponseSchema.parse(lida.corpo)
    expect(aulas.map(({ diaSemana, inicio, fim, sala, turmaId }) => [diaSemana, inicio, fim, sala, turmaId])).toEqual([
      [1, '07:00', '07:50', null, t8a],
      [1, '08:00', '08:50', 'Sala 1', t8a],
      [2, '09:00', '09:50', null, t8a],
      [3, '07:00', '07:50', null, t8a],
    ])
    expect(aulas.map(({ professor }) => professor)).toEqual(Array.from({ length: 4 }, () => ({ usuarioId: ana.usuarioId, nome: ana.nome })))
    expect(aulas.every(({ disciplinaId }) => disciplinaId === quimica)).toBe(true)
    expect(JSON.stringify(lida.corpo)).not.toMatch(/professores\.invalid|@/)
    // A 8ºB tem a aula do Bruno e a da Carla; a da Ana, de vínculo encerrado na 8ºB, não aparece.
    expect(gradeResponseSchema.parse(jaHaviaNaOutra.corpo).aulas.map(({ diaSemana, inicio }) => [diaSemana, inicio])).toEqual([[1, '10:00'], [3, '08:00']])
  })

  it('a turma sem professor alocado: a coordenação recebe 200 com a lista de aulas vazia', async () => {
    const e = await escolaComAnos()
    const t8a = await turmaNa(e, '8º A')

    const lida = await lerGrade(e.coordenacao, `?turmaId=${t8a}`)

    expect(lida.status).toBe(200)
    expect(lida.corpo).toEqual({ aulas: [] })
  })

  it('o professor com vínculo confirmado lê a grade da turma, com o colega só por id e nome; com o vínculo pendente, contestado ou sem vínculo, é igual a inexistente', async () => {
    const e = await escolaComAnos()
    const t8a = await turmaNa(e, '8º A')
    const t8b = await turmaNa(e, '8º B')
    const t8c = await turmaNa(e, '8º C')
    const quimica = await disciplinaNa(e, 'Química')
    const colega = await professorNaEscola(e, 'colega')
    const { professor, sessao } = await professorComSessao(e, 'leitor')
    const doColega = await vinculoDireto(e, colega.usuarioId, t8a, quimica, 'confirmado')
    await aulaDireta(e, doColega, 1, '08:00', '08:50')
    await vinculoDireto(e, professor.usuarioId, t8a, quimica, 'confirmado')
    await vinculoDireto(e, professor.usuarioId, t8b, quimica, 'pendente')
    const contestado = await professorComSessao(e, 'contestou')
    await vinculoDireto(e, contestado.professor.usuarioId, t8a, quimica, 'contestado')

    const lida = await lerGrade(sessao, `?turmaId=${t8a}`)
    expect(lida.status).toBe(200)
    expect(gradeResponseSchema.parse(lida.corpo).aulas.map(({ professor: p }) => p)).toEqual([{ usuarioId: colega.usuarioId, nome: colega.nome }])
    expect(JSON.stringify(lida.corpo)).not.toMatch(/professores\.invalid|@/)

    const inexistente = erroDe(await lerGrade(sessao, `?turmaId=${randomUUID()}`))
    expect(inexistente).toEqual(NAO_ENCONTRADO)
    // Confirmado numa turma e pendente em outra: a pendente responde como a que não existe, e a sem vínculo também.
    for (const turmaId of [t8b, t8c]) expect(erroDe(await lerGrade(sessao, `?turmaId=${turmaId}`))).toEqual(inexistente)
    expect(erroDe(await lerGrade(contestado.sessao, `?turmaId=${t8a}`))).toEqual(inexistente)
    expect(professor.email).toContain(PREFIXO)
  })

  it('vínculo encerrado em uma turma e confirmado em outra: a grade é só da confirmada', async () => {
    const e = await escolaComAnos()
    const t8a = await turmaNa(e, '8º A')
    const t8b = await turmaNa(e, '8º B')
    const quimica = await disciplinaNa(e, 'Química')
    const { professor, sessao } = await professorComSessao(e, 'mudou')
    const daX = await vinculoDireto(e, professor.usuarioId, t8a, quimica, 'encerrado')
    const daY = await vinculoDireto(e, professor.usuarioId, t8b, quimica, 'confirmado')
    await aulaDireta(e, daX, 1, '08:00', '08:50')
    const aulaDaY = await aulaDireta(e, daY, 2, '09:00', '09:50')

    expect(erroDe(await lerGrade(sessao, `?turmaId=${t8a}`))).toEqual(NAO_ENCONTRADO)
    const lida = await lerGrade(sessao, `?turmaId=${t8b}`)
    expect(lida.status).toBe(200)
    expect(gradeResponseSchema.parse(lida.corpo).aulas.map(({ id }) => id)).toEqual([aulaDaY])
  })

  it('o professor que sai da grade pela marca perde a leitura da turma na mesma hora', async () => {
    const e = await escolaComAnos()
    const t8a = await turmaNa(e, '8º A')
    const t8b = await turmaNa(e, '8º B')
    await disciplinaNa(e, 'Química')
    const { professor: ana } = await professorComSessao(e, 'ana-leitora')
    const { professor: saida, sessao } = await professorComSessao(e, 'saida')
    const primeira = await importar(e, planilha(aula('8A', 'Química', ana, '1', '8:00', '8:50'), aula('8B', 'Química', saida, '1', '9:00', '9:50')))
    expect(primeira.estado).toBe('concluida')
    const doSaida = (await vinculosDe(e)).find(({ usuario_id }) => usuario_id === saida.usuarioId)
    await bancada.pool.query("update vinculo set estado = 'confirmado', decidido_em = now() where id = $1", [doSaida?.id])
    expect((await lerGrade(sessao, `?turmaId=${t8b}`)).status).toBe(200)

    await importar(e, planilha(aula('8A', 'Química', ana, '1', '8:00', '8:50')), { marcas: { encerrar: [doSaida?.id ?? ''] } })

    expect(erroDe(await lerGrade(sessao, `?turmaId=${t8b}`))).toEqual(NAO_ENCONTRADO)
    expect((await lerGrade(e.coordenacao, `?turmaId=${t8a}`)).status).toBe(200)
  })

  it('a grade da escola B, para a coordenação e para o professor da A, é igual a inexistente; a reimportação da A não toca a grade da B', async () => {
    const a = await escolaComGradeImportada()
    const b = await escolaComGradeImportada()
    const { professor, sessao } = await professorComSessao(a.e, 'espiao')
    await vinculoDireto(a.e, professor.usuarioId, a.t8a, a.quimica, 'confirmado')
    const inexistente = erroDe(await lerGrade(a.e.coordenacao, `?turmaId=${randomUUID()}`))
    expect(inexistente).toEqual(NAO_ENCONTRADO)

    expect(erroDe(await lerGrade(a.e.coordenacao, `?turmaId=${b.t8a}`))).toEqual(inexistente)
    expect(erroDe(await lerGrade(sessao, `?turmaId=${b.t8a}`))).toEqual(inexistente)
    expect(erroDe(await lerGrade(a.e.coordenacao, `?turmaId=${b.t8a}&anoLetivoId=${b.e.planejado}`))).toEqual(inexistente)
    expect(erroDe(await lerGrade(a.e.coordenacao, `?turmaId=${a.t8a}&anoLetivoId=${b.e.planejado}`))).toEqual(inexistente)
    expect((await lerGrade(b.e.coordenacao, `?turmaId=${b.t8a}`)).status).toBe(200)

    const antesDaB = await aulasDe(b.e)
    await importar(a.e, planilha(...a.linhas.ana))
    expect(await aulasDe(b.e)).toEqual(antesDaB)
    expect((await vinculosDe(b.e)).map(({ estado }) => estado)).toEqual(['pendente', 'pendente', 'pendente'])
  })

  it('sem ano em curso, a grade do coordenador aceita o filtro do planejado, e a do professor segue o ano em curso, que não existe', async () => {
    const e = await escolaSemAnoEmCurso()
    const t8a = await turmaNa(e, '8º A', e.planejado)
    const quimica = await disciplinaNa(e, 'Química')
    const { professor, sessao } = await professorComSessao(e, 'planejado')
    const doVinculo = await vinculoDireto(e, professor.usuarioId, t8a, quimica, 'confirmado', e.planejado)
    const aulaId = await aulaDireta(e, doVinculo, 1, '08:00', '08:50', e.planejado)

    expect(erroDe(await lerGrade(e.coordenacao, `?turmaId=${t8a}`))).toEqual(NAO_ENCONTRADO)
    const comFiltro = await lerGrade(e.coordenacao, `?turmaId=${t8a}&anoLetivoId=${e.planejado}`)
    expect(comFiltro.status).toBe(200)
    expect(gradeResponseSchema.parse(comFiltro.corpo).aulas.map(({ id }) => id)).toEqual([aulaId])
    expect(erroDe(await lerGrade(sessao, `?turmaId=${t8a}`))).toEqual(NAO_ENCONTRADO)
    expect(erroDe(await lerGrade(sessao, `?turmaId=${t8a}&anoLetivoId=${e.planejado}`))).toEqual(NAO_ENCONTRADO)
  })

  it('com ano em curso, o professor com filtro de ano é igual a inexistente, e o filtro com o ano em curso na coordenação não vale (só o planejado)', async () => {
    const e = await escolaComAnos()
    const t8a = await turmaNa(e, '8º A')
    const quimica = await disciplinaNa(e, 'Química')
    const { professor, sessao } = await professorComSessao(e, 'filtro')
    await vinculoDireto(e, professor.usuarioId, t8a, quimica, 'confirmado')

    expect((await lerGrade(sessao, `?turmaId=${t8a}`)).status).toBe(200)
    expect(erroDe(await lerGrade(sessao, `?turmaId=${t8a}&anoLetivoId=${e.planejado}`))).toEqual(NAO_ENCONTRADO)
    expect(erroDe(await lerGrade(e.coordenacao, `?turmaId=${t8a}&anoLetivoId=${e.planejado}`))).toEqual(NAO_ENCONTRADO)
    expect(erroDe(await lerGrade(e.coordenacao, `?turmaId=${t8a}&anoLetivoId=${e.emCurso}`))).toEqual(NAO_ENCONTRADO)
    const comAno = await lerGrade(e.coordenacao, `?turmaId=${t8a}`)
    expect(comAno.status).toBe(200)
  })

  it('a consulta exige a turma e não aceita a escola; o aluno não lê a grade, e a resposta é a do inexistente', async () => {
    const e = await escolaComAnos()
    const t8a = await turmaNa(e, '8º A')
    const aluno = await bancada.sessao(e.escolaId, 'aluno')

    expect(erroDe(await lerGrade(e.coordenacao, ''))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await lerGrade(e.coordenacao, `?turmaId=${t8a}&escolaId=${e.escolaId}`))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await lerGrade(e.coordenacao, '?turmaId=1837'))).toEqual(ENTRADA_INVALIDA)
    // Não existe leitura da grade por professor (regra 70, item 8): a grade é da turma, e o `professorId` não é parâmetro dela.
    expect(erroDe(await lerGrade(e.coordenacao, `?turmaId=${t8a}&professorId=${randomUUID()}`))).toEqual(ENTRADA_INVALIDA)
    expect(erroDe(await lerGrade(aluno, `?turmaId=${t8a}`))).toEqual(NAO_ENCONTRADO)
  })
})
