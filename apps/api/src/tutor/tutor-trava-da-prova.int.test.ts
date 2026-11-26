import { METRICS, ROTULO_ESCOLA, runInContext, systemClock, type Database, type RequestContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, type RespostaHttp, type TestApi } from '../../test/test-api.js'
import { FilaDeIa } from '../../test/fila-de-ia.fixture.js'
import { comoPessoa, dispararExecucao, execucaoTerminada, montarEscolaComAssistente, zerarLimiteDePedidosDeIa, type EscolaComAssistente } from '../../test/escola-assistente.fixture.js'
import { aplicarAtividade, citacaoDoPrimeiroTrecho, encerrarAtividade, fakeModelEnv, HABILIDADE_LIMITANTE, lancarLote, startFakeModel, type FakeModel } from '../../test/escola-tutor.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { TutorDoAlunoRepository } from './tutor.repository.js'

/**
 * A trava do Tutor por aluno (avaliacao-e-correcao, 7.0; Tech Spec §5.10; regra 30, item 10): do `abre_em` até o fim da janela (com as extensões da turma) **ou o limite do
 * aluno, o que vier depois**; a segunda chamada trava só o convocado; sem janela, como antes da F6. O Tutor não é rota de prova: a lacuna aberta do pulso não o recusa
 * (503), só estica o limite de quem estava em prova.
 *
 * `pulso_da_api` e `indisponibilidade` são globais: o arquivo tira do caminho as quedas que o banco já tinha, põe o pulso fresco antes de cada caso, devolve as duas ao que eram no `afterAll`, e os arquivos de integração
 * rodam um por vez. Tentativas e extensões são semeadas direto no banco: a rota do aluno (`comecar`) é da 3.0 e a da extensão, da 5.0.
 */
describe('o Tutor travado por aluno durante a prova', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let modelo: FakeModel
  let api: TestApi
  let fila: FilaDeIa
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  let ultimoEmAntes: Date | undefined
  /** As quedas que o banco já tinha (o teste de infra e os de outros arquivos as deixam): saem do caminho no `beforeAll`, porque uma queda recente entra na janela de toda tentativa e estica o limite, e voltam no `afterAll`. */
  let quedasAntes: Array<{ id: string; inicio: Date; fim: Date }> = []
  /** As provas que o caso semeou: a `afterEach` as encerra, passe ou falhe o caso, e o Tutor da turma volta a ficar livre para o seguinte. */
  const abertas: Array<{ escola: EscolaComAssistente; id: string }> = []

  const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)
  const enviar = async (sessao: TestSessao, corpo: Record<string, unknown>): Promise<RespostaHttp> => chamar(api.url, 'POST', '/v1/tutor/mensagens', await sessao.tokenNovo(), { chaveEnvio: randomUUID(), ...corpo })
  const novoAluno = async (escola: EscolaComAssistente, turmaId: string = escola.turma): Promise<TestSessao> => {
    const sessao = await bancada.sessao(escola.escolaId, 'aluno')
    await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [
      escola.escolaId,
      escola.anoLetivoId,
      sessao.usuarioId,
      turmaId,
      escola.coordenacao.usuarioId,
    ])
    return sessao
  }
  /** O que o Tutor dirá a este aluno, na turma dele, agora: o título da prova que o trava, ou `undefined`. */
  const travaDe = (escola: EscolaComAssistente, aluno: TestSessao, turmaId: string = escola.turma) => comoPessoa(escola, aluno, 'aluno', () => new TutorDoAlunoRepository(bancada.banco).avaliativaAberta(turmaId))
  const titulosDaTrava = async (escola: EscolaComAssistente, aluno: TestSessao, turmaId?: string) => (await travaDe(escola, aluno, turmaId))?.titulo

  /**
   * Uma avaliativa aberta na turma, com a janela `abre` e `fecha` em minutos a partir de agora (negativo é passado), pelo relógio do banco. Sem `abre`, a avaliativa é a de antes da
   * F6, sem janela. A aplicação fica aberta: encerrá-la é da rotina (6.0), e o caso do "depois do fim" prova que o Tutor não espera por ela.
   */
  const semear = async (escola: EscolaComAssistente, opcoes: { titulo: string; turmaId?: string; abre?: number; fecha?: number }): Promise<string> => {
    const turmaId = opcoes.turmaId ?? escola.turma
    const id = await aplicarAtividade(bancada, escola, { avaliativa: true, turmaId, titulo: opcoes.titulo, ...(turmaId === escola.turma ? {} : { aplicadaPor: escola.colega.usuarioId }) })
    abertas.push({ escola, id })
    if (opcoes.abre !== undefined && opcoes.fecha !== undefined) {
      await sql(`update atividade_aplicada set abre_em = now() + $3 * interval '1 minute', fecha_em = now() + $4 * interval '1 minute' where escola_id = $1 and id = $2`, [escola.escolaId, id, opcoes.abre, opcoes.fecha])
    }
    return id
  }
  /** A tentativa em andamento do aluno: começou `iniciou` minutos atrás (negativo) e o limite base é `limiteBase` minutos a partir de agora, como o `comecar` o gravaria. */
  const comecou = (escola: EscolaComAssistente, aluno: TestSessao, aplicacao: string, iniciou: number, limiteBase: number) =>
    sql(
      `insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, iniciada_em, limite_base_em) values ($1, $2, $3, $4, now() + $5 * interval '1 minute', now() + $6 * interval '1 minute')`,
      [escola.escolaId, escola.anoLetivoId, aplicacao, aluno.usuarioId, iniciou, limiteBase],
    )
  /** Uma extensão do professor: de um aluno, ou da turma inteira quando `aluno` é `null`. */
  const estendeu = (escola: EscolaComAssistente, aplicacao: string, aluno: TestSessao | null, minutos: number) =>
    sql('insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave) values ($1, $2, $3, $4, $5, $6, $7)', [
      escola.escolaId,
      escola.anoLetivoId,
      aplicacao,
      aluno?.usuarioId ?? null,
      minutos,
      escola.professora.usuarioId,
      randomUUID(),
    ])
  /** A segunda chamada aberta de uma prova original já encerrada, com a janela de agora, e o título da original: a mesma turma e o mesmo artefato, como a FK exige. */
  const segundaChamada = async (escola: EscolaComAssistente, titulo: string): Promise<string> => {
    const original = await aplicarAtividade(bancada, escola, { avaliativa: true, titulo })
    await encerrarAtividade(bancada, escola, original)
    const { rows } = await sql<{ id: string }>(
      `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por, abre_em, fecha_em, segunda_chamada_de)
       select escola_id, ano_letivo_id, turma_id, artefato_id, true, aplicada_por, now() - interval '1 minute', now() + interval '30 minutes', id from atividade_aplicada where escola_id = $1 and id = $2 returning id`,
      [escola.escolaId, original],
    )
    const id = rows[0]?.id
    if (id === undefined) throw new Error('segunda chamada de teste não semeada')
    abertas.push({ escola, id })
    return id
  }
  const pulsouHa = (segundos: number) => sql('update pulso_da_api set ultimo_em = now() - make_interval(secs => $1::double precision)', [segundos])
  /** Uma queda da API já fechada, de `de` a `ate` minutos a partir de agora (negativos). */
  const caiu = (de: number, ate: number) => sql(`insert into indisponibilidade (inicio, fim) values (now() + $1 * interval '1 minute', now() + $2 * interval '1 minute')`, [de, ate])

  beforeAll(async () => {
    modelo = await startFakeModel()
    fila = await FilaDeIa.subir(medidor.medidor, { ambiente: fakeModelEnv(modelo) }, linhasDeLog)
    api = fila.api
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    quedasAntes = (await sql<{ id: string; inicio: Date; fim: Date }>('select id, inicio, fim from indisponibilidade')).rows
    await sql('delete from indisponibilidade')
    ultimoEmAntes = (await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api')).rows[0]?.ultimo_em
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
    // O pulso fresco vale por caso: acima de 30 s sem pulso, toda tentativa ganharia uma lacuna aberta e o limite esticaria. Caso novo que passe disso (o arquivo todo leva cerca de 10 s) regrava o pulso no meio.
    await pulsouHa(0)
  })

  afterEach(async () => {
    for (const { escola, id } of abertas.splice(0)) await encerrarAtividade(bancada, escola, id)
    await sql('delete from indisponibilidade')
  })

  afterAll(async () => {
    await sql('delete from indisponibilidade')
    for (const queda of quedasAntes) await sql('insert into indisponibilidade (id, inicio, fim) values ($1, $2, $3)', [queda.id, queda.inicio, queda.fim])
    await sql('delete from pulso_da_api')
    await sql('insert into pulso_da_api (ultimo_em) values ($1)', [ultimoEmAntes ?? new Date()])
    await fila.ociosa()
    await fila.fechar()
    await modelo.fechar()
    await bancada.fechar()
  })

  describe('a janela', () => {
    it('prova de amanhã não trava; aberta há um minuto, trava', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova de amanhã', abre: 24 * 60, fecha: 25 * 60 })
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
      await sql(`update atividade_aplicada set abre_em = now() - interval '1 minute' where escola_id = $1 and id = $2`, [a.escolaId, prova])
      expect(await titulosDaTrava(a, aluno)).toBe('Prova de amanhã')
    })

    it('dentro da janela trava a turma, e só ela: o aluno da outra turma da escola segue livre, e o da turma da prova, travado pela rota', async () => {
      const daTurma = await novoAluno(a)
      const daOutra = await novoAluno(a, a.outraTurma)
      await semear(a, { titulo: 'Prova do 2ºC', turmaId: a.outraTurma, abre: -10, fecha: 30 })
      expect(await titulosDaTrava(a, daOutra, a.outraTurma)).toBe('Prova do 2ºC')
      expect(await titulosDaTrava(a, daTurma)).toBeUndefined()
      expect(await enviar(daOutra, { texto: 'o que é mol?' })).toMatchObject({ status: 409, corpo: { erro: { codigo: 'TUTOR_PAUSADO_EM_AVALIACAO' } } })
      expect((await enviar(daTurma, { texto: 'o que é mol?' })).status).toBe(202)
    })

    it('depois do fim efetivo, destrava, mesmo com a aplicação ainda aberta (a rotina não rodou); a mesma prova com o fim adiante trava', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova que acabou', abre: -120, fecha: -10 })
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
      await sql(`update atividade_aplicada set fecha_em = now() + interval '10 minutes' where escola_id = $1 and id = $2`, [a.escolaId, prova])
      expect(await titulosDaTrava(a, aluno)).toBe('Prova que acabou')
    })

    it('a avaliativa sem janela (a de antes da F6) trava enquanto está aberta; encerrada, destrava', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova sem janela' })
      expect(await titulosDaTrava(a, aluno)).toBe('Prova sem janela')
      await encerrarAtividade(bancada, a, prova)
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
    })

    it('a tentativa sem limite base (a prova só com janela) vale a janela: trava até o `fecha_em`, e destrava depois', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova só com janela', abre: -60, fecha: 10 })
      await sql(`insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, iniciada_em) values ($1, $2, $3, $4, now() - interval '30 minutes')`, [a.escolaId, a.anoLetivoId, prova, aluno.usuarioId])
      expect(await titulosDaTrava(a, aluno)).toBe('Prova só com janela')
      await sql(`update atividade_aplicada set fecha_em = now() - interval '1 minute' where escola_id = $1 and id = $2`, [a.escolaId, prova])
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
    })

    it('duas avaliativas abertas na turma: a primeira por id já acabou e a rotina não rodou, a segunda está na janela, e o Tutor trava pela segunda', async () => {
      const aluno = await novoAluno(a)
      const tituloDe = new Map<string, string>()
      for (const titulo of ['Prova de Matemática', 'Prova de História']) tituloDe.set(await semear(a, { titulo }), titulo)
      // A ordem é a do id (v7: o instante da criação, sem desempate no mesmo milissegundo): a janela passada vai para o menor, a que vale para o maior, seja qual dos dois títulos tenha caído onde.
      const [primeira, segunda] = [...tituloDe.keys()].sort()
      if (primeira === undefined || segunda === undefined) throw new Error('as duas provas não foram semeadas')
      await sql(`update atividade_aplicada set abre_em = now() - interval '120 minutes', fecha_em = now() - interval '60 minutes' where escola_id = $1 and id = $2`, [a.escolaId, primeira])
      await sql(`update atividade_aplicada set abre_em = now() - interval '10 minutes', fecha_em = now() + interval '30 minutes' where escola_id = $1 and id = $2`, [a.escolaId, segunda])
      expect(await titulosDaTrava(a, aluno)).toBe(tituloDe.get(segunda))
    })

    it('a atividade que não é avaliativa não trava', async () => {
      const aluno = await novoAluno(a)
      const lista = await aplicarAtividade(bancada, a, { titulo: 'Lista comum' })
      abertas.push({ escola: a, id: lista })
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
    })
  })

  describe('o limite do aluno e a extensão da turma', () => {
    it('o aluno cujo limite já passou segue travado até o fim da janela, que vem depois: o que vier depois decide', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova de duas horas', abre: -60, fecha: 30 })
      await comecou(a, aluno, prova, -50, -10)
      expect(await titulosDaTrava(a, aluno)).toBe('Prova de duas horas')
      await sql(`update atividade_aplicada set fecha_em = now() - interval '1 minute' where escola_id = $1 and id = $2`, [a.escolaId, prova])
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
    })

    it('o aluno estendido além do `fecha_em` segue travado até o limite dele, e o colega sem extensão destrava', async () => {
      const estendido = await novoAluno(a)
      const colega = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova com extensão', abre: -60, fecha: -5 })
      await comecou(a, estendido, prova, -40, -5)
      await comecou(a, colega, prova, -40, -5)
      expect(await titulosDaTrava(a, estendido)).toBeUndefined()
      await estendeu(a, prova, estendido, 30)
      expect(await titulosDaTrava(a, estendido)).toBe('Prova com extensão')
      expect(await titulosDaTrava(a, colega)).toBeUndefined()
    })

    it('a extensão de outro aluno não segura o colega: ele destrava no `fecha_em`', async () => {
      const estendido = await novoAluno(a)
      const colega = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova com extensão', abre: -60, fecha: -5 })
      await comecou(a, colega, prova, -40, -5)
      await estendeu(a, prova, estendido, 30)
      expect(await titulosDaTrava(a, colega)).toBeUndefined()
    })

    it('a extensão e a tentativa de outra prova da turma não esticam esta: a outra está encerrada, esta já acabou', async () => {
      const aluno = await novoAluno(a)
      const outra = await semear(a, { titulo: 'Prova que o professor encerrou', abre: -120, fecha: 60 })
      await comecou(a, aluno, outra, -100, 20)
      await estendeu(a, outra, aluno, 45)
      await estendeu(a, outra, null, 45)
      await encerrarAtividade(bancada, a, outra)
      await semear(a, { titulo: 'Prova que acabou', abre: -60, fecha: -5 })
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
    })

    it('a tentativa e a queda de um colega não esticam o aluno que não começou', async () => {
      const quemNaoComecou = await novoAluno(a)
      const colega = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova com queda', abre: -60, fecha: -2 })
      await comecou(a, colega, prova, -40, -2)
      await caiu(-20, -15)
      expect(await titulosDaTrava(a, colega)).toBe('Prova com queda')
      expect(await titulosDaTrava(a, quemNaoComecou)).toBeUndefined()
    })

    it('uma indisponibilidade fechada dentro da prova empurra o limite além do `fecha_em` e segue travado; sem ela, destrava', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova com queda', abre: -60, fecha: -2 })
      await comecou(a, aluno, prova, -40, -2)
      await caiu(-55, -45)
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
      await caiu(-20, -15)
      expect(await titulosDaTrava(a, aluno)).toBe('Prova com queda')
      await sql('delete from indisponibilidade')
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
    })

    it('a lacuna aberta montada à mão (pulso envelhecido 3 min) segue travando além do limite original, que já passou, e o Tutor responde 409, não 503; sem a lacuna, destrava', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova com a API fora', abre: -60, fecha: -1 })
      await comecou(a, aluno, prova, -40, -1)
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
      await pulsouHa(180)
      expect(await titulosDaTrava(a, aluno)).toBe('Prova com a API fora')
      expect(await enviar(aluno, { texto: 'o que é mol?' })).toMatchObject({ status: 409, corpo: { erro: { codigo: 'TUTOR_PAUSADO_EM_AVALIACAO' } } })
      await pulsouHa(0)
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
    })

    it('a extensão da turma, com o aluno sem tentativa, trava até o `fecha_em` mais a extensão; sem ela, destrava', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova estendida à turma', abre: -60, fecha: -5 })
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
      await estendeu(a, prova, null, 10)
      expect(await titulosDaTrava(a, aluno)).toBe('Prova estendida à turma')
      await sql(`update atividade_aplicada set fecha_em = now() - interval '20 minutes' where escola_id = $1 and id = $2`, [a.escolaId, prova])
      expect(await titulosDaTrava(a, aluno)).toBeUndefined()
    })
  })

  describe('a segunda chamada', () => {
    it('trava o convocado, não o colega', async () => {
      const convocado = await novoAluno(a)
      const colega = await novoAluno(a)
      const segunda = await segundaChamada(a, 'Prova original')
      await sql('insert into convocado_da_segunda_chamada (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', [a.escolaId, a.anoLetivoId, segunda, convocado.usuarioId])
      expect(await titulosDaTrava(a, convocado)).toBe('Prova original')
      expect(await titulosDaTrava(a, colega)).toBeUndefined()
    })
  })

  describe('a segunda chamada, de outra prova', () => {
    it('quem é convocado de uma segunda chamada não é convocado de outra da turma: encerrada a dele, destrava', async () => {
      const convocado = await novoAluno(a)
      await segundaChamada(a, 'Segunda chamada da outra prova')
      const dele = await segundaChamada(a, 'Segunda chamada dele')
      await sql('insert into convocado_da_segunda_chamada (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', [a.escolaId, a.anoLetivoId, dele, convocado.usuarioId])
      expect(await titulosDaTrava(a, convocado)).toBe('Segunda chamada dele')
      await encerrarAtividade(bancada, a, dele)
      expect(await titulosDaTrava(a, convocado)).toBeUndefined()
    })
  })

  describe('o escopo (regra 10)', () => {
    it('o repository no contexto da A, com a turma, o aluno e o ano da B, não alcança a prova da B na janela; a B, no contexto dela, sim', async () => {
      const alunoDaB = await novoAluno(b)
      await semear(b, { titulo: 'Prova da escola B', abre: -10, fecha: 30 })
      const contexto = (escolaId: string, anoLetivoId: string): RequestContext => ({ requisicaoId: randomUUID(), escolaId, usuarioId: alunoDaB.usuarioId, papel: 'aluno', sessaoId: alunoDaB.sessaoId, anoLetivoId })
      const ler = (escolaId: string, anoLetivoId: string) => runInContext(contexto(escolaId, anoLetivoId), () => new TutorDoAlunoRepository(bancada.banco).avaliativaAberta(b.turma))
      // A escola da A com o ano da B: só a escola do contexto separa; a escola da B com o ano da A: só o ano do contexto separa.
      expect(await ler(a.escolaId, b.anoLetivoId)).toBeUndefined()
      expect(await ler(b.escolaId, a.anoLetivoId)).toBeUndefined()
      expect((await ler(b.escolaId, b.anoLetivoId))?.titulo).toBe('Prova da escola B')
    })

    it('a extensão e a tentativa da B não esticam a trava da A: o aluno da A sem a extensão dele destrava', async () => {
      const alunoDaA = await novoAluno(a)
      const alunoDaB = await novoAluno(b)
      const provaDaA = await semear(a, { titulo: 'Prova da A', abre: -60, fecha: -5 })
      const provaDaB = await semear(b, { titulo: 'Prova da B', abre: -60, fecha: -5 })
      await comecou(a, alunoDaA, provaDaA, -40, -5)
      await comecou(b, alunoDaB, provaDaB, -40, -5)
      await estendeu(b, provaDaB, null, 30)
      expect(await titulosDaTrava(a, alunoDaA)).toBeUndefined()
      expect(await titulosDaTrava(b, alunoDaB)).toBe('Prova da B')
    })
  })

  describe('a latência (regra 80, item 10)', () => {
    it('a consulta principal de cada turno (as provas abertas da turma) desce pela turma, no índice da atividade aplicada, e não varre a tabela; as de extensão e de queda não têm plano conferido', async () => {
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        // O volume sem montar as FKs: só dentro desta transação, que termina em `rollback`. Uma turma em quarenta é a do teste.
        await cliente.query('set local session_replication_role = replica')
        await cliente.query(
          `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, aplicada_em)
           select $1, $2, case when n % 40 = 0 then $3::uuid else gen_random_uuid() end, gen_random_uuid(), true, 'aberta', $4, now() - n * interval '1 minute' from generate_series(1, 4000) as n`,
          [a.escolaId, a.anoLetivoId, a.turma, a.professora.usuarioId],
        )
        await cliente.query('analyze atividade_aplicada')
        await cliente.query('set local enable_seqscan = off')
        await cliente.query('set local enable_bitmapscan = off')
        const aluno = await novoAluno(a)
        const consulta = comoPessoa(a, aluno, 'aluno', () => new TutorDoAlunoRepository(bancada.banco).consultaDasAvaliativasAbertas(a.turma))
        const { sql: texto, params } = consulta.toSQL()
        const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (format json) ${texto}`, params as unknown[])
        const nos: Array<Record<string, unknown>> = []
        const andar = (no: Record<string, unknown> | undefined): void => {
          if (no === undefined) return
          nos.push(no)
          for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
        }
        andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
        const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')
        // Qualquer índice da atividade aplicada que comece pela escola e pela turma serve; o que não serve é varrer a tabela, ou entrar só pela escola.
        const doIndice = nos.find((no) => no['Relation Name'] === 'atividade_aplicada' && String(no['Index Cond'] ?? '').match(/escola_id.*turma_id/) !== null)
        expect(doIndice, resumo).toBeDefined()
        expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === 'atividade_aplicada'), resumo).toEqual([])
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })
  })

  describe('a latência medida (regra 80, item 10)', () => {
    const medido = (banco: Database = bancada.banco) => new TutorDoAlunoRepository(banco, systemClock, medidor.medidor)
    const medidas = async (escola: EscolaComAssistente) => {
      const pontos = (await medidor.pontos(METRICS.duracaoDaTravaDoTutor)).filter((ponto) => ponto.atributos[ROTULO_ESCOLA] === escola.escolaId)
      return { contagem: pontos.reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? 0 : ponto.valor.contagem), 0), rotulos: pontos.flatMap((ponto) => Object.keys(ponto.atributos)) }
    }

    it('grava uma medida por conferência, só com a escola no rótulo: sem prova (uma consulta), com prova na janela (as extras) e quando a conferência lança', async () => {
      const aluno = await novoAluno(a)
      const antes = await medidas(a)
      expect(await comoPessoa(a, aluno, 'aluno', () => medido().avaliativaAberta(a.turma))).toBeUndefined()
      const semProva = await medidas(a)
      expect(semProva.contagem).toBe(antes.contagem + 1)

      const prova = await semear(a, { titulo: 'Prova medida', abre: -60, fecha: -2 })
      await comecou(a, aluno, prova, -40, -2)
      await estendeu(a, prova, null, 10)
      expect((await comoPessoa(a, aluno, 'aluno', () => medido().avaliativaAberta(a.turma)))?.titulo).toBe('Prova medida')
      const comProva = await medidas(a)
      expect(comProva.contagem).toBe(semProva.contagem + 1)

      const quebrado = { select: () => { throw new Error('o banco caiu') } } as unknown as Database
      await expect(comoPessoa(a, aluno, 'aluno', () => medido(quebrado).avaliativaAberta(a.turma))).rejects.toThrow('o banco caiu')
      const comErro = await medidas(a)
      expect(comErro.contagem).toBe(comProva.contagem + 1)
      // Nunca o aluno, a turma nem a prova: a série é por escola.
      expect([...new Set(comErro.rotulos)]).toEqual([ROTULO_ESCOLA])
    })

    it('a medida da escola A não soma na da B: cada conferência cai na série da escola do contexto', async () => {
      const alunoDaB = await novoAluno(b)
      const antesA = await medidas(a)
      const antesB = await medidas(b)
      await comoPessoa(b, alunoDaB, 'aluno', () => medido().avaliativaAberta(b.turma))
      expect((await medidas(a)).contagem).toBe(antesA.contagem)
      expect((await medidas(b)).contagem).toBe(antesB.contagem + 1)
    })
  })

  describe('a memória do Tutor (D66)', () => {
    it('não leva tempo adicional, saídas da aba, extensão nem limite: o aluno com +50%, 7 saídas e extensão tem a memória do trabalho dele, o pedido ao modelo não traz nenhum dos três e o log do turno não traz a pergunta, o título da prova nem o percentual', async () => {
      const aluno = await novoAluno(a)
      const prova = await semear(a, { titulo: 'Prova com adaptação', abre: -240, fecha: -120 })
      await lancarLote(bancada, a, prova, 'aprovada', { alunoId: aluno.usuarioId, acertos: 1, total: 3, porHabilidade: [{ codigo: HABILIDADE_LIMITANTE.codigo, acertos: 1, total: 3 }] })
      await sql(`update tentativa_atividade set saidas_da_aba = 7, limite_base_em = '2031-03-14T10:11:12Z', iniciada_em = now() - interval '3 hours', envio = 'aluno' where escola_id = $1 and atividade_aplicada_id = $2 and aluno_id = $3`, [
        a.escolaId,
        prova,
        aluno.usuarioId,
      ])
      await sql('insert into tempo_adicional (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, percentual, concedido_por) values ($1, $2, $3, $4, 50, $5)', [a.escolaId, a.anoLetivoId, prova, aluno.usuarioId, a.professora.usuarioId])
      await estendeu(a, prova, aluno, 45)
      await encerrarAtividade(bancada, a, prova)

      modelo.responder((pedido) => JSON.stringify({ classificacao: 'normal', resposta: 'Vamos por partes. O que o enunciado pede que você descubra?', citacoes: citacaoDoPrimeiroTrecho(pedido) }))
      const execucaoId = await dispararExecucao(api, aluno, '/v1/tutor/mensagens', { texto: 'não entendi o que é reagente limitante' })
      expect((await execucaoTerminada(api, aluno, execucaoId)).estado).toBe('concluida')
      const pedido = modelo.pedidos[modelo.pedidos.length - 1] ?? ''
      // A memória do trabalho dele foi (o controle: sem ela o "não leva" abaixo passaria sozinho), e as colunas da prova online, não.
      expect(pedido).toContain('memoria_do_trabalho_do_aluno_por_habilidade')
      expect(pedido).toContain(HABILIDADE_LIMITANTE.codigo)
      for (const proibido of ['tempo_adicional', 'tempoAdicional', '"percentual"', 'saidas', 'saídas', 'limite_base', 'limiteBase', 'limiteEm', 'extensao', 'extensão', '2031-03-14']) {
        expect(pedido, proibido).not.toContain(proibido)
      }
      // O log do caminho novo (regra 20, item 9): o turno rodou a trava três vezes e o log não carrega o texto da pergunta, o título da prova nem o que o aluno teve de adaptação. O controle: o log não está vazio.
      const log = linhasDeLog.join('\n')
      expect(log.length).toBeGreaterThan(0)
      for (const proibido of ['reagente limitante', 'Prova com adaptação', 'percentual', 'tempo_adicional', 'saidas_da_aba']) expect(log, proibido).not.toContain(proibido)
    })
  })
})
