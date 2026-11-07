import { createDatabase, createPool, runInContext, SemanaRepository, type Clock, type DatabasePool } from '@educa/core'
import { ESTADOS_DE_ITEM_DO_DIA, rotuloDoItem, semanaResponseSchema, type DiaDaSemana, type ItemDoDia, type SemanaResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { aplicarAtividade, aprovarOLote, conteudoDeTeste, criarAtividade, criarVersaoAdaptada, encerrarAtividade, GABARITO_DE_TESTE, responderProva, rotasDaAtividade, type RotasDaAtividade } from './atividade.fixture.js'
import { montarEscolaComAssistente, NOME_DA_PROFESSORA_DE_TESTE, NOME_DO_ALUNO_DE_TESTE, vincularProfessor, type EscolaComAssistente } from './escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS } from './test-config.js'

/**
 * Os itens do dia da Semana (F2b, tarefa 3.0; `tasks/prd-semana-do-professor/cenarios.md`, S9, S10, R2 e a linha do `EXPLAIN`): em cada dia de
 * `GET /v1/semana`, a atividade aplicada, a encerrada e a correção do Assistente das turmas e disciplinas dos vínculos `confirmado` da professora,
 * com o estado de hoje, sem nota, acerto, nome de aluno nem autor. A atividade, o encerramento e a aprovação do lote passam pelas rotas de verdade
 * (`atividade.fixture.ts`); só os instantes (`aplicada_em`, `encerrada_em`, `criada_em` do lote) são levados para a semana do caso, direto no banco.
 * Cada caso lê a sua própria semana de 2026, para que o item de um não apareça no outro. Escolas e sessões geradas; tudo sintético.
 */

/** A mesma expressão de `e2e/support/professor/scenario.ts` (`VOCABULARIO_DE_NOTA`), copiada: a integração não importa do e2e. */
const VOCABULARIO_DE_NOTA = /\bnotas?\b|\bconceitos?\b|pontuaç/i

/** Um instante em Brasília (UTC−3, sem horário de verão): `brasilia('2026-03-04', '10:00')`. */
const brasilia = (dia: string, hora: string): Date => new Date(`${dia}T${hora}:00-03:00`)

type ItemLido = DiaDaSemana['itens'][number]

describe('os itens do dia na Semana (F2b, tarefa 3.0)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const relogio: Clock = { agora: () => new Date('2026-11-04T13:00:00Z') }
  let api: TestApi
  let rotas: RotasDaAtividade
  let apoio: DatabasePool
  /** O mesmo banco com a sessão em UTC: o dia do item não pode depender do fuso que o servidor de banco traz. */
  let apoioEmUtc: DatabasePool
  let a: EscolaComAssistente
  let b: EscolaComAssistente

  const sql = async <Linha extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Linha[]> => (await bancada.pool.query(texto, valores)).rows as Linha[]

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '1000', LIMITE_REQ_ESCOLA_MIN: '1000' } }, undefined, { ...TEST_APP_OPTIONS, relogioDaSemana: relogio })
    rotas = rotasDaAtividade(api)
    apoio = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 4, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    const urlEmUtc = new URL(urlDoBancoDeTeste())
    urlEmUtc.searchParams.set('options', '-c timezone=UTC')
    apoioEmUtc = createPool({ url: urlEmUtc.toString(), maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
  })

  afterAll(async () => {
    await api.app.close()
    await apoio.end()
    await apoioEmUtc.end()
    await bancada.fechar()
    await medidor.encerrar()
  })

  async function lerSemana(sessao: TestSessao, segunda: string): Promise<SemanaResponse> {
    const lida = await chamar(api.url, 'GET', `/v1/semana?segunda=${segunda}`, sessao.token)
    expect(lida.status).toBe(200)
    return semanaResponseSchema.parse(lida.corpo)
  }

  const itensDo = (lida: SemanaResponse, data: string): ItemLido[] => lida.dias.find((dia) => dia.data === data)?.itens ?? []
  const todosOsItens = (lida: SemanaResponse): ItemLido[] => lida.dias.flatMap((dia) => dia.itens)
  const titulosDo = (lida: SemanaResponse, data: string): string[] => itensDo(lida, data).map((item) => `${item.tipo}:${item.titulo}`)

  interface Instantes {
    readonly aplicadaEm: Date
    readonly encerradaEm?: Date
    /** Quando o lote de correção nasceu; sem ele, o lote fica com a hora real do teste (fora de qualquer semana de 2026). */
    readonly loteCriadoEm?: Date
  }

  interface Atividade {
    readonly id: string
    readonly entregaId: string | null
  }

  /**
   * Uma atividade de Química aplicada pela professora ao 2ºB, pela rota. Com `encerradaEm`, o aluno responde e a professora a encerra, e o lote nasce
   * pendente; os instantes são levados para onde o caso precisa. Sem `encerradaEm`, ela fica aberta.
   */
  async function atividade(escola: EscolaComAssistente, titulo: string, instantes: Instantes, turmaId = escola.turma): Promise<Atividade> {
    const artefatoId = await criarAtividade(bancada, escola, { conteudo: conteudoDeTeste(escola.materialId, titulo) })
    const id = await aplicarAtividade(rotas, escola.professora, artefatoId, turmaId)
    let entregaId: string | null = null
    if (instantes.encerradaEm !== undefined) {
      await responderProva(rotas, escola.aluno, id, [...GABARITO_DE_TESTE])
      entregaId = await encerrarAtividade(rotas, escola.professora, id)
      if (entregaId === null) throw new Error('o lote não nasceu')
    }
    await sql('update atividade_aplicada set aplicada_em = $2, encerrada_em = coalesce($3, encerrada_em) where id = $1', [id, instantes.aplicadaEm, instantes.encerradaEm ?? null])
    if (entregaId !== null && instantes.loteCriadoEm !== undefined) await sql('update entrega set criada_em = $2 where id = $1', [entregaId, instantes.loteCriadoEm])
    return { id, entregaId }
  }

  async function vinculoDa(escola: EscolaComAssistente, sessao: TestSessao, disciplinaId = escola.quimica, turmaId = escola.turma): Promise<string> {
    const [linha] = await sql<{ id: string }>('select id from vinculo where escola_id = $1 and usuario_id = $2 and turma_id = $3 and disciplina_id = $4', [escola.escolaId, sessao.usuarioId, turmaId, disciplinaId])
    if (linha === undefined) throw new Error('vínculo de teste não achado')
    return linha.id
  }

  async function alocar(escola: EscolaComAssistente, vinculoId: string, diaDaSemana: number, inicio = '07:30', fim = '08:20'): Promise<void> {
    await sql('insert into alocacao (escola_id, ano_letivo_id, vinculo_id, dia_semana, inicio, fim) values ($1, $2, $3, $4, $5, $6)', [escola.escolaId, escola.anoLetivoId, vinculoId, diaDaSemana, inicio, fim])
  }

  /** O contexto da pessoa na escola e o ano em curso dela: é nele que o repository roda, chamado direto, como numa rota. */
  const contextoDe = (escola: EscolaComAssistente, sessao: TestSessao) => ({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: sessao.usuarioId, papel: 'professor' as const, sessaoId: sessao.sessaoId, anoLetivoId: escola.anoLetivoId })
  /** Os itens que o repository devolve para a semana, sem a montagem dos dias: o filtro do período é dele. */
  const lerOsItens = (escola: EscolaComAssistente, sessao: TestSessao, ano: string, segunda: string, domingo: string) =>
    runInContext(contextoDe(escola, sessao), () => new SemanaRepository(createDatabase(apoio)).itensDaSemana(ano, segunda, domingo))

  it('S9: a atividade aplicada na quarta aparece na quarta da turma e disciplina da professora, só ali, e a aplicada em outro dia da semana cai no dia dela', async () => {
    const segunda = '2026-03-02'
    const naQuarta = await atividade(a, 'Lista de quarta', { aplicadaEm: brasilia('2026-03-04', '10:00') })
    const naSexta = await atividade(a, 'Lista de sexta', { aplicadaEm: brasilia('2026-03-06', '08:00') })

    const lida = await lerSemana(a.professora, segunda)
    expect(itensDo(lida, '2026-03-04')).toEqual([{ tipo: 'aplicada', turmaId: a.turma, disciplinaId: a.quimica, atividadeAplicadaId: naQuarta.id, titulo: 'Lista de quarta' }])
    expect(itensDo(lida, '2026-03-06')).toEqual([{ tipo: 'aplicada', turmaId: a.turma, disciplinaId: a.quimica, atividadeAplicadaId: naSexta.id, titulo: 'Lista de sexta' }])
    expect(todosOsItens(lida)).toHaveLength(2)
  })

  it('S9: a atividade de Química do 2ºB não aparece para a professora de Física da mesma turma, nem para a de Química de outra turma, nem para a de vínculo pendente em Química', async () => {
    const segunda = '2026-03-16'
    // Encerrada, com o lote de correção: os três itens (aplicada, encerrada e correção) são da Química do 2ºB, e só dela.
    await atividade(a, 'Lista só da Química do 2ºB', { aplicadaEm: brasilia('2026-03-18', '10:00'), encerradaEm: brasilia('2026-03-18', '11:00'), loteCriadoEm: brasilia('2026-03-18', '11:00') })
    // A de Física confirma Física no 2ºB: a turma é a mesma, a disciplina não. A outra tem Física confirmada no 2ºB e Química pendente no 2ºB:
    // a turma dela é a do 2ºB, e só o estado do vínculo em Química impede o item.
    const comPendente = await bancada.sessao(a.escolaId, 'professor')
    await vincularProfessor(bancada, a, comPendente.usuarioId, a.turma, a.fisica, 'confirmado')
    await vincularProfessor(bancada, a, comPendente.usuarioId, a.turma, a.quimica, 'pendente')

    // E a que tem Física confirmada e, no mesmo usuário, um vínculo de aluno em Química no 2ºB (gravado direto: a tabela não compara o papel do vínculo com o do usuário).
    const comPapelDeAluno = await bancada.sessao(a.escolaId, 'professor')
    await vincularProfessor(bancada, a, comPapelDeAluno.usuarioId, a.turma, a.fisica, 'confirmado')
    await sql(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'aluno', 'confirmado', $6, now())`,
      [a.escolaId, a.anoLetivoId, comPapelDeAluno.usuarioId, a.turma, a.quimica, a.coordenacao.usuarioId],
    )

    expect(todosOsItens(await lerSemana(a.professora, segunda)).map((item) => item.tipo)).toEqual(['aplicada', 'encerrada', 'correcao'])
    for (const sessao of [a.deFisica, a.colega, comPendente, comPapelDeAluno]) expect(todosOsItens(await lerSemana(sessao, segunda))).toEqual([])
  })

  it('S9: a professora com Química e Física confirmadas no 2ºB vê as duas atividades, cada uma com a sua disciplina e uma vez só', async () => {
    const segunda = '2026-08-03'
    const comAsDuas = await bancada.sessao(a.escolaId, 'professor')
    await vincularProfessor(bancada, a, comAsDuas.usuarioId, a.turma, a.quimica, 'confirmado')
    await vincularProfessor(bancada, a, comAsDuas.usuarioId, a.turma, a.fisica, 'confirmado')
    const deQuimica = await atividade(a, 'Lista de Química das duas', { aplicadaEm: brasilia('2026-08-05', '10:00') })
    // A de Física é do artefato de Física, aplicada pela professora de Física ao mesmo 2ºB.
    const artefatoDeFisica = await criarAtividade(bancada, a, { conteudo: conteudoDeTeste(a.materialId, 'Lista de Física das duas'), disciplinaId: a.fisica })
    const deFisica = await aplicarAtividade(rotas, a.deFisica, artefatoDeFisica, a.turma)
    await sql('update atividade_aplicada set aplicada_em = $2 where id = $1', [deFisica, brasilia('2026-08-05', '11:00')])

    const itens = itensDo(await lerSemana(comAsDuas, segunda), '2026-08-05')
    expect(itens.map((item) => [item.tipo, item.disciplinaId, item.atividadeAplicadaId, item.titulo])).toEqual([
      ['aplicada', a.fisica, deFisica, 'Lista de Física das duas'],
      ['aplicada', a.quimica, deQuimica.id, 'Lista de Química das duas'],
    ])
  })

  it('S9: a mesma atividade aplicada a outra turma da professora é da outra turma, e a turma do item é a da aplicação', async () => {
    const segunda = '2026-03-23'
    // A professora de Química também dá Química no 2ºC (a colega dá lá, e a professora ganha o vínculo para este caso).
    await vincularProfessor(bancada, a, a.professora.usuarioId, a.outraTurma, a.quimica)
    const noOutraTurma = await atividade(a, 'Lista aplicada no 2ºC', { aplicadaEm: brasilia('2026-03-25', '09:00') }, a.outraTurma)

    const lida = await lerSemana(a.professora, segunda)
    expect(itensDo(lida, '2026-03-25')).toEqual([{ tipo: 'aplicada', turmaId: a.outraTurma, disciplinaId: a.quimica, atividadeAplicadaId: noOutraTurma.id, titulo: 'Lista aplicada no 2ºC' }])
    // A colega de Química do 2ºC (vínculo confirmado nela) lê a aplicação do 2ºC: a atividade é da turma, e quem dá a disciplina na turma a vê.
    expect(titulosDo(await lerSemana(a.colega, segunda), '2026-03-25')).toEqual(['aplicada:Lista aplicada no 2ºC'])
  })

  it('S9: a correção aparece nos três estados (para revisar, aprovada, rejeitada), e a atividade encerrada e a aplicada aparecem junto', async () => {
    const segunda = '2026-03-09'
    const quarta = brasilia('2026-03-11', '10:00')
    const pendente = await atividade(a, 'Lista pendente', { aplicadaEm: quarta, encerradaEm: brasilia('2026-03-11', '11:00'), loteCriadoEm: brasilia('2026-03-11', '11:00') })
    const aprovada = await atividade(a, 'Lista aprovada', { aplicadaEm: quarta, encerradaEm: brasilia('2026-03-11', '11:00'), loteCriadoEm: brasilia('2026-03-11', '11:00') })
    const rejeitada = await atividade(a, 'Lista rejeitada', { aplicadaEm: quarta, encerradaEm: brasilia('2026-03-11', '11:00'), loteCriadoEm: brasilia('2026-03-11', '11:00') })
    await aprovarOLote(rotas, a.professora, aprovada.id)
    expect((await rotas.rejeitar(a.professora, rejeitada.entregaId ?? '')).status).toBe(200)

    const lida = await lerSemana(a.professora, segunda)
    const correcoes = itensDo(lida, '2026-03-11').filter((item) => item.tipo === 'correcao')
    expect(correcoes.map((item) => [item.titulo, item.estado, item.atividadeAplicadaId])).toEqual(
      expect.arrayContaining([
        ['Lista pendente', 'pendente', pendente.id],
        ['Lista aprovada', 'aprovada', aprovada.id],
        ['Lista rejeitada', 'rejeitada', rejeitada.id],
      ]),
    )
    expect(correcoes).toHaveLength(3)
    // Cada atividade rende três itens no dia: aplicada, encerrada e a correção; a aplicada e a encerrada não levam estado.
    expect(itensDo(lida, '2026-03-11').map((item) => item.tipo)).toEqual(['aplicada', 'aplicada', 'aplicada', 'encerrada', 'encerrada', 'encerrada', 'correcao', 'correcao', 'correcao'])
    expect(itensDo(lida, '2026-03-11').filter((item) => item.tipo !== 'correcao').every((item) => !('estado' in item))).toBe(true)
  })

  it('a correção aprovada depois da semana mostra o estado de hoje: a mesma semana lida antes e depois da aprovação', async () => {
    const segunda = '2026-04-06'
    const lote = await atividade(a, 'Lista aprovada depois', { aplicadaEm: brasilia('2026-04-07', '10:00'), encerradaEm: brasilia('2026-04-07', '11:00'), loteCriadoEm: brasilia('2026-04-07', '11:00') })
    const estadoDaCorrecao = async () => itensDo(await lerSemana(a.professora, segunda), '2026-04-07').find((item) => item.tipo === 'correcao')?.estado

    expect(await estadoDaCorrecao()).toBe('pendente')
    await aprovarOLote(rotas, a.professora, lote.id)
    expect(await estadoDaCorrecao()).toBe('aprovada')
  })

  it('S9: o item traz só as chaves do contrato (sem nota, acerto, nome de aluno nem autor), e o rótulo do item não tem palavra de nota', async () => {
    const segunda = '2026-04-13'
    await atividade(a, 'Lista de estequiometria', { aplicadaEm: brasilia('2026-04-15', '10:00'), encerradaEm: brasilia('2026-04-15', '11:00'), loteCriadoEm: brasilia('2026-04-15', '11:00') })

    const lida = await lerSemana(a.professora, segunda)
    const itens = itensDo(lida, '2026-04-15')
    expect(itens.map((item) => item.tipo)).toEqual(['aplicada', 'encerrada', 'correcao'])
    for (const item of itens) {
      const esperadas = ['atividadeAplicadaId', 'disciplinaId', 'tipo', 'titulo', 'turmaId', ...(item.tipo === 'correcao' ? ['estado'] : [])].sort()
      expect(Object.keys(item).sort()).toEqual(esperadas)
      // O título é o que o teste escolheu: só falharia se o código acrescentasse texto a ele. Quem prova a regra 70 é o rótulo.
      expect(item.titulo).not.toMatch(VOCABULARIO_DE_NOTA)
      expect(rotuloDoItem(item)).not.toMatch(VOCABULARIO_DE_NOTA)
    }
    expect(itens.find((item) => item.tipo === 'correcao')?.estado).toSatisfy((estado: unknown) => ESTADOS_DE_ITEM_DO_DIA.includes(estado as ItemDoDia['estado'] & string))
    // O aluno respondeu e a correção tem acertos: nada disso, e nenhum nome, sai nos itens.
    expect(JSON.stringify(todosOsItens(lida))).not.toMatch(new RegExp(`acerto|nota|aluno|autor|aplicadaPor|decididaPor|${NOME_DO_ALUNO_DE_TESTE}|${NOME_DA_PROFESSORA_DE_TESTE}`, 'i'))
  })

  it('S10: o feriado no dia da prova tira a aula e o item fica; o dia sem feriado, com aula, não perde nada', async () => {
    const segunda = '2026-04-20'
    const vinculoId = await vinculoDa(a, a.professora)
    await alocar(a, vinculoId, 3)
    await alocar(a, vinculoId, 4)
    await sql("insert into evento_calendario (escola_id, ano_letivo_id, tipo, inicio, fim, descricao) values ($1, $2, 'feriado', '2026-04-22', '2026-04-22', 'Feriado sintético da prova')", [a.escolaId, a.anoLetivoId])
    const naProva = await atividade(a, 'Prova no feriado', { aplicadaEm: brasilia('2026-04-22', '10:00') })
    const noOutroDia = await atividade(a, 'Lista de quinta', { aplicadaEm: brasilia('2026-04-23', '10:00') })

    const lida = await lerSemana(a.professora, segunda)
    const dia = (data: string) => lida.dias.find((d) => d.data === data)
    expect(dia('2026-04-22')?.aulas).toEqual([])
    expect(dia('2026-04-22')?.eventos).toEqual([{ tipo: 'feriado', descricao: 'Feriado sintético da prova' }])
    expect(dia('2026-04-22')?.itens.map((item) => item.atividadeAplicadaId)).toEqual([naProva.id])
    expect(dia('2026-04-23')?.aulas).toHaveLength(1)
    expect(dia('2026-04-23')?.itens.map((item) => item.atividadeAplicadaId)).toEqual([noOutroDia.id])
  })

  it('a atividade aplicada no domingo às 22h de Brasília (já segunda em UTC) fica no domingo, e a das 00h da segunda é da semana seguinte', async () => {
    const vinculoId = await vinculoDa(a, a.professora)
    await alocar(a, vinculoId, 7, '09:00', '09:50')
    // 2026-07-12 é domingo: às 22h de Brasília são 01h de segunda em UTC.
    const noDomingo = await atividade(a, 'Lista do domingo à noite', { aplicadaEm: brasilia('2026-07-12', '22:00') })
    const naSegunda = await atividade(a, 'Lista da segunda à meia-noite', { aplicadaEm: brasilia('2026-07-13', '00:00') })

    const daSemanaDoDomingo = await lerSemana(a.professora, '2026-07-06')
    expect(titulosDo(daSemanaDoDomingo, '2026-07-12')).toEqual(['aplicada:Lista do domingo à noite'])
    expect(todosOsItens(daSemanaDoDomingo).map((item) => item.atividadeAplicadaId)).toEqual([noDomingo.id])
    // O dia vem do fuso da escola, e não do da sessão do banco: com a sessão em UTC, as 22h de domingo em Brasília continuam no domingo.
    const comSessaoEmUtc = await runInContext(contextoDe(a, a.professora), () => new SemanaRepository(createDatabase(apoioEmUtc)).itensDaSemana(a.anoLetivoId, '2026-07-06', '2026-07-12'))
    expect(comSessaoEmUtc.map((item) => [item.data, item.atividadeAplicadaId])).toEqual([['2026-07-12', noDomingo.id]])
    const daSeguinte = await lerSemana(a.professora, '2026-07-13')
    expect(titulosDo(daSeguinte, '2026-07-13')).toEqual(['aplicada:Lista da segunda à meia-noite'])
    expect(todosOsItens(daSeguinte).map((item) => item.atividadeAplicadaId)).toEqual([naSegunda.id])
  })

  it('a atividade aplicada fora da semana não aparece: o último instante da semana anterior e o primeiro da seguinte ficam de fora', async () => {
    const segunda = '2026-05-04'
    // Domingo 23h59 da semana anterior e segunda 00h da seguinte, nos dois extremos; a de segunda 00h e a de domingo 23h59 desta semana entram.
    await atividade(a, 'Antes da semana', { aplicadaEm: brasilia('2026-05-03', '23:59') })
    await atividade(a, 'Depois da semana', { aplicadaEm: brasilia('2026-05-11', '00:00') })
    const naSegunda = await atividade(a, 'Primeiro instante', { aplicadaEm: brasilia('2026-05-04', '00:00') })
    const vinculoId = await vinculoDa(a, a.professora)
    await alocar(a, vinculoId, 7, '10:00', '10:50')
    const noDomingo = await atividade(a, 'Último instante', { aplicadaEm: brasilia('2026-05-10', '23:59') })

    const lida = await lerSemana(a.professora, segunda)
    expect(todosOsItens(lida).map((item) => [item.titulo, item.atividadeAplicadaId])).toEqual([
      ['Primeiro instante', naSegunda.id],
      ['Último instante', noDomingo.id],
    ])
    // O período é do repository (a montagem dos dias também deixaria de fora o que não é da semana): ele só devolve os dois.
    const doRepository = await lerOsItens(a, a.professora, a.anoLetivoId, segunda, '2026-05-10')
    expect(doRepository.map((item) => [item.tipo, item.data, item.atividadeAplicadaId])).toEqual(
      expect.arrayContaining([
        ['aplicada', '2026-05-04', naSegunda.id],
        ['aplicada', '2026-05-10', noDomingo.id],
      ]),
    )
    expect(doRepository).toHaveLength(2)
  })

  it('o lote de correção criado fora da semana não aparece, e a atividade aplicada e encerrada dentro dela aparece sem a correção', async () => {
    const segunda = '2026-05-18'
    const lote = await atividade(a, 'Lote da semana seguinte', { aplicadaEm: brasilia('2026-05-19', '10:00'), encerradaEm: brasilia('2026-05-20', '10:00'), loteCriadoEm: brasilia('2026-05-26', '10:00') })

    const dela = await lerSemana(a.professora, segunda)
    expect(todosOsItens(dela).map((item) => [item.tipo, item.atividadeAplicadaId])).toEqual([
      ['aplicada', lote.id],
      ['encerrada', lote.id],
    ])
    const daSeguinte = await lerSemana(a.professora, '2026-05-25')
    expect(todosOsItens(daSeguinte).map((item) => [item.tipo, item.estado, item.atividadeAplicadaId])).toEqual([['correcao', 'pendente', lote.id]])
    // O repository, sem a montagem dos dias: a semana do lote devolve a aplicada e a encerrada, e a seguinte, só a correção.
    expect((await lerOsItens(a, a.professora, a.anoLetivoId, segunda, '2026-05-24')).map((item) => item.tipo)).toEqual(['aplicada', 'encerrada'])
    expect((await lerOsItens(a, a.professora, a.anoLetivoId, '2026-05-25', '2026-05-31')).map((item) => item.tipo)).toEqual(['correcao'])
  })

  it('a entrega de outro tipo (a versão adaptada) na mesma turma, criada na semana, não aparece', async () => {
    const segunda = '2026-06-01'
    const artefatoId = await criarAtividade(bancada, a, { conteudo: conteudoDeTeste(a.materialId, 'Original da adaptada') })
    const adaptadaId = await criarVersaoAdaptada(bancada, a, artefatoId, 'pendente')
    await sql("update entrega set criada_em = $2 where escola_id = $1 and artefato_id = $3 and tipo = 'versao_adaptada'", [a.escolaId, brasilia('2026-06-03', '10:00'), adaptadaId])
    const [entregaNaSemana] = await sql<{ total: string }>("select count(*) as total from entrega where escola_id = $1 and tipo = 'versao_adaptada' and criada_em = $2", [a.escolaId, brasilia('2026-06-03', '10:00')])
    expect(entregaNaSemana?.total).toBe('1')

    expect(todosOsItens(await lerSemana(a.professora, segunda))).toEqual([])
  })

  it('a atividade aplicada numa semana e encerrada noutra rende um item em cada semana: a aplicada na primeira, a encerrada na segunda', async () => {
    const lote = await atividade(a, 'Aplicada e encerrada em semanas diferentes', { aplicadaEm: brasilia('2026-06-09', '10:00'), encerradaEm: brasilia('2026-06-16', '10:00'), loteCriadoEm: brasilia('2026-06-16', '10:00') })

    expect(todosOsItens(await lerSemana(a.professora, '2026-06-08')).map((item) => [item.tipo, item.atividadeAplicadaId])).toEqual([['aplicada', lote.id]])
    expect(todosOsItens(await lerSemana(a.professora, '2026-06-15')).map((item) => [item.tipo, item.atividadeAplicadaId])).toEqual([
      ['encerrada', lote.id],
      ['correcao', lote.id],
    ])
  })

  it('R2: a professora nas duas escolas, com o token de uma, não vê a atividade da outra; e o repository da A, com os ids da B, volta vazio', async () => {
    const segunda = '2026-06-22'
    // A mesma pessoa nas duas escolas: a conta é uma só.
    const [conta] = await sql<{ id: string }>('insert into conta (email) values ($1) returning id', [`r2-${randomUUID()}@professores.invalid`])
    for (const sessao of [a.professora, b.professora]) await sql('update usuario set conta_id = $2 where id = $1', [sessao.usuarioId, conta?.id])
    const daA = await atividade(a, 'Atividade da escola A', { aplicadaEm: brasilia('2026-06-24', '10:00'), encerradaEm: brasilia('2026-06-24', '11:00'), loteCriadoEm: brasilia('2026-06-24', '11:00') })
    const daB = await atividade(b, 'Atividade da escola B', { aplicadaEm: brasilia('2026-06-24', '10:00'), encerradaEm: brasilia('2026-06-24', '11:00'), loteCriadoEm: brasilia('2026-06-24', '11:00') })

    const comATokenDaA = await lerSemana(a.professora, segunda)
    expect(todosOsItens(comATokenDaA).map((item) => item.atividadeAplicadaId)).toEqual([daA.id, daA.id, daA.id])
    expect(JSON.stringify(comATokenDaA)).not.toContain(daB.id)
    expect(JSON.stringify(comATokenDaA)).not.toContain('Atividade da escola B')
    expect(todosOsItens(await lerSemana(b.professora, segunda)).map((item) => item.atividadeAplicadaId)).toEqual([daB.id, daB.id, daB.id])

    // O repository: o contexto é o da A (escola, professora e ano dela); o ano e a professora que ele recebe, ou o contexto inteiro, trocam para a B.
    const ler = (escola: EscolaComAssistente, sessao: TestSessao, ano: string) => lerOsItens(escola, sessao, ano, segunda, '2026-06-28')
    // A professora da A, o ano da B: o ano que o repository recebe não é o da atividade.
    expect(await ler(a, a.professora, b.anoLetivoId)).toEqual([])
    // A professora da B no contexto da escola A, com o ano dela: só a escola do contexto separa as duas.
    expect(await ler(a, b.professora, b.anoLetivoId)).toEqual([])
    // Os da A, com o mesmo contexto, voltam: o vazio acima é do escopo, e não de um repository quebrado.
    expect((await ler(a, a.professora, a.anoLetivoId)).map((item) => item.atividadeAplicadaId)).toEqual([daA.id, daA.id, daA.id])
    // O contexto da B vê a atividade da B, e só ela.
    expect((await ler(b, b.professora, b.anoLetivoId)).map((item) => item.atividadeAplicadaId)).toEqual([daB.id, daB.id, daB.id])
  })

  it('o `EXPLAIN` das três consultas dos itens desce pela turma, pelo índice da atividade aplicada e pelo da entrega', async () => {
    const cliente = await bancada.pool.connect()
    try {
      await cliente.query('begin')
      // O volume sem montar as FKs (artefato, turma, execução): só dentro desta transação, que termina em `rollback`.
      await cliente.query('set local session_replication_role = replica')
      await cliente.query(
        `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, aplicada_em)
         select $1, $2, case when n % 40 = 0 then $3::uuid else gen_random_uuid() end, gen_random_uuid(), false, 'aberta', $4, now() - n * interval '1 minute' from generate_series(1, 4000) as n`,
        [a.escolaId, a.anoLetivoId, a.turma, a.professora.usuarioId],
      )
      await cliente.query(
        `insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id, estado, criada_em)
         select $1, $2, case when n % 40 = 0 then $3::uuid else gen_random_uuid() end, 'correcao_de_objetiva', 'lote_de_correcao', gen_random_uuid(), 'pendente', now() - n * interval '1 minute' from generate_series(1, 4000) as n`,
        [a.escolaId, a.anoLetivoId, a.turma],
      )
      for (const tabela of ['atividade_aplicada', 'entrega']) await cliente.query(`analyze ${tabela}`)
      // Com o `seqscan` e o `bitmapscan` desligados o teste prova que há um caminho pelo índice com a escola e a turma, e não que o planejador o escolhe
      // com a configuração padrão e as estatísticas reais.
      await cliente.query('set local enable_seqscan = off')
      await cliente.query('set local enable_bitmapscan = off')

      const consultas = runInContext(contextoDe(a, a.professora), () => new SemanaRepository(createDatabase(apoio)).consultasDosItens(a.anoLetivoId, '2026-06-22', '2026-06-28'))
      // O planejador prefere, na atividade aplicada, o único `(escola, ano, turma, id)` ao `atividade_aplicada_turma_idx`: os dois começam pela escola e pela turma.
      for (const [nome, consulta, tabela, indices] of [
        ['aplicadas', consultas.aplicadas, 'atividade_aplicada', ['atividade_aplicada_turma_idx', 'atividade_aplicada_escola_ano_turma_id_unico']],
        ['encerradas', consultas.encerradas, 'atividade_aplicada', ['atividade_aplicada_turma_idx', 'atividade_aplicada_escola_ano_turma_id_unico']],
        ['lotes', consultas.lotes, 'entrega', ['entrega_turma_idx']],
      ] as const) {
        const { sql: texto, params } = consulta.toSQL()
        const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (format json) ${texto}`, params as unknown[])
        const nos: Array<Record<string, unknown>> = []
        const andar = (no: Record<string, unknown> | undefined): void => {
          if (no === undefined) return
          nos.push(no)
          for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
        }
        andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
        const resumo = `${nome}: ${nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')}`
        const doIndice = nos.find((no) => no['Relation Name'] === tabela && (indices as readonly string[]).includes(String(no['Index Name'])))
        expect(doIndice, resumo).toBeDefined()
        // O índice entra pela escola e pela turma, e não só pela escola: a condição dele cita as duas colunas.
        expect(String(doIndice?.['Index Cond']), resumo).toMatch(/escola_id.*turma_id/)
        expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === tabela), resumo).toEqual([])
      }
    } finally {
      await cliente.query('rollback')
      cliente.release()
    }
  })
})
