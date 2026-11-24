import { runInContext, type RequestContext } from '@educa/core'
import { atividadeAplicadaResponseSchema, type PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { subirApi, type TestApi, type RespostaHttp } from '../../test/test-api.js'
import { alunosComSessao, aplicarAtividade, criarAtividade, rotasDaAtividade, type RotasDaAtividade } from '../../test/atividade.fixture.js'
import { montarAnoAnterior, montarEscolaComAssistente, vincularProfessor, type EscolaComAssistente } from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import { AtividadeAplicadaRepository } from './atividade-aplicada/atividade-aplicada.repository.js'

/**
 * A prova online do lado do professor (avaliacao-e-correcao, 1.0; RF1 a RF3): aplicar com janela, duração, embaralhamento e tempo adicional, e mudar a
 * janela antes do primeiro começo. Mais o isolamento das rotas e dos repositories novos, as colunas da `saida_da_aba` e as duas corridas da tarefa:
 * (b) mudar a janela × começar e (k) mudar a janela × mudar a janela.
 *
 * O tempo adicional é adaptação, dado sensível (regra 20, item 3): nenhuma resposta o devolve por aluno, e a auditoria só leva a contagem.
 */
describe('prova online: aplicar e mudar a janela', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  /** Alunos do 2ºB da escola A, com o percentual de tempo adicional que cada um recebe nos testes. */
  let ana: TestSessao
  let bia: TestSessao
  let caio: TestSessao
  let colega: TestSessao
  let alunoDoC: TestSessao
  /** Aluno da turma com vínculo ainda `pendente`, e outro com vínculo confirmado e a conta desativada: nenhum dos dois é da turma para o tempo adicional. */
  let pendente: TestSessao
  let desativado: TestSessao

  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query(texto, valores)).rows as Registro[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const contar = async (tabela: string, filtro: string, valores: unknown[]): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where ${filtro}`, valores))[0]?.total)
  /** O corpo de erro sem o `requisicaoId`, que muda a cada chamada: o que o cliente lê para distinguir uma recusa da outra. */
  const corpoDoErro = (resposta: RespostaHttp) => ({ ...resposta.corpo.erro, requisicaoId: undefined })
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  const ENTRADA_INVALIDA = { status: 400, codigo: 'ENTRADA_INVALIDA' }
  const PROVA_JA_COMECOU = { status: 409, codigo: 'PROVA_JA_COMECOU' }

  /** Uma janela de amanhã, de `minutos` de duração. */
  const janelaDe = (minutos: number, deslocamentoMin = 24 * 60): { abreEm: string; fechaEm: string } => {
    const abre = new Date(Date.now() + deslocamentoMin * 60_000)
    return { abreEm: abre.toISOString(), fechaEm: new Date(abre.getTime() + minutos * 60_000).toISOString() }
  }
  const adicional = (alunoId: string, percentual: 25 | 50 | 100) => ({ alunoId, percentual })

  /** O que o professor pode mudar da aplicação, lido do banco: nada disto passa pela API. */
  const retratoDa = async (id: string) => ({
    aplicacao: await sql('select abre_em, fecha_em, duracao_min, estado from atividade_aplicada where id = $1', [id]),
    adicionais: await sql('select aluno_id, percentual, concedido_por from tempo_adicional where atividade_aplicada_id = $1 order by aluno_id', [id]),
    auditorias: await contar('auditoria', `entidade_id = $1`, [id]),
  })

  /** Uma aplicação avaliativa nova, de um artefato novo (a mesma aberta duas vezes na turma é `CONFLITO`). */
  async function aplicarProva(prova: Record<string, unknown> = { janela: janelaDe(60), duracaoMin: 40 }, escola: EscolaComAssistente = a): Promise<string> {
    return aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola), escola.turma, true, prova)
  }

  /** O que o `comecar` da 3.0 fará nesta tarefa: a tentativa nasce por SQL, com o aluno e o relógio do banco. */
  const iniciarTentativa = (aplicacaoId: string, aluno: TestSessao) =>
    sql('insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', [a.escolaId, a.anoLetivoId, aplicacaoId, aluno.usuarioId])

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    ;[ana, bia, caio, colega] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluno Sintético Caio', 'Aluno Sintético Colega'])) as [TestSessao, TestSessao, TestSessao, TestSessao]
    ;[alunoDoC] = (await alunosComSessao(bancada, a, a.outraTurma, ['Aluno Sintético do 2ºC'])) as [TestSessao]
    ;[pendente, desativado] = (await alunosComSessao(bancada, a, a.turma, ['Aluno Sintético Pendente', 'Aluno Sintético Desativado'])) as [TestSessao, TestSessao]
    await sql(`update vinculo set estado = 'pendente', decidido_em = null where escola_id = $1 and usuario_id = $2`, [a.escolaId, pendente.usuarioId])
    await sql('update usuario set desativado_em = now() where id = $1', [desativado.usuarioId])
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
  })

  describe('aplicar', () => {
    it('+25%, +50% e +100% sobre 40 min gravam três linhas com quem concedeu; o colega não tem linha; a auditoria só leva a contagem, e a resposta, nenhum percentual', async () => {
      const artefatoId = await criarAtividade(bancada, a)
      const janela = janelaDe(90)
      const resposta = await rotas.aplicar(a.professora, {
        artefatoId,
        turmaId: a.turma,
        avaliativa: true,
        janela,
        duracaoMin: 40,
        embaralhar: { questoes: true, alternativas: false },
        tempoAdicional: [adicional(ana.usuarioId, 25), adicional(bia.usuarioId, 50), adicional(caio.usuarioId, 100)],
      })
      expect(resposta.status).toBe(201)
      const criada = atividadeAplicadaResponseSchema.parse(resposta.corpo)
      expect(criada).toMatchObject({ avaliativa: true, janela, duracaoMin: 40, embaralhar: { questoes: true, alternativas: false }, segundaChamadaDe: null, comTempoAdicional: 3 })
      // Nenhum percentual nem aluno na resposta: só a contagem.
      expect(JSON.stringify(resposta.corpo)).not.toMatch(/percentual|tempoAdicional|concedid/)

      const linhas = await sql<{ aluno_id: string; percentual: number; concedido_por: string }>('select aluno_id, percentual, concedido_por from tempo_adicional where atividade_aplicada_id = $1', [criada.id])
      expect(Object.fromEntries(linhas.map((linha) => [linha.aluno_id, linha.percentual]))).toEqual({ [ana.usuarioId]: 25, [bia.usuarioId]: 50, [caio.usuarioId]: 100 })
      expect(new Set(linhas.map((linha) => linha.concedido_por))).toEqual(new Set([a.professora.usuarioId]))
      expect(await contar('tempo_adicional', 'atividade_aplicada_id = $1 and aluno_id = $2', [criada.id, colega.usuarioId])).toBe(0)

      // A tela diz que o tempo adicional "fica registrado com o seu nome": o autor da auditoria do aplicar é a professora, e só a contagem vai nela.
      const auditorias = await sql<{ autor_usuario_id: string; depois: Record<string, unknown> }>(`select autor_usuario_id, depois from auditoria where acao = 'atividade.aplicada' and entidade_id = $1`, [criada.id])
      expect(auditorias).toEqual([{ autor_usuario_id: a.professora.usuarioId, depois: { artefatoId, turmaId: a.turma, avaliativa: true, versaoAdaptada: false, comTempoAdicional: 3 } }])
      const texto = JSON.stringify(auditorias.map((linha) => linha.depois))
      for (const aluno of [ana, bia, caio]) expect(texto).not.toContain(aluno.usuarioId)
      expect(texto).not.toMatch(/percentual/)
    })

    it('a avaliativa nova sem janela é ENTRADA_INVALIDA e nada se grava; a que não é avaliativa segue sem janela, e a avaliativa de antes da F6 segue lida como estava', async () => {
      const artefatoId = await criarAtividade(bancada, a)
      expect(erro(await rotas.aplicar(a.professora, { artefatoId, turmaId: a.turma, avaliativa: true }))).toEqual(ENTRADA_INVALIDA)
      // A duração e o embaralhamento também não substituem a janela.
      expect(erro(await rotas.aplicar(a.professora, { artefatoId, turmaId: a.turma, avaliativa: true, embaralhar: { questoes: true, alternativas: false } }))).toEqual(ENTRADA_INVALIDA)
      expect(await contar('atividade_aplicada', 'artefato_id = $1', [artefatoId])).toBe(0)
      expect(await contar('auditoria', `acao = 'atividade.aplicada' and depois ->> 'artefatoId' = $1`, [artefatoId])).toBe(0)

      const pratica = await rotas.aplicar(a.professora, { artefatoId, turmaId: a.turma, avaliativa: false })
      expect(pratica.status).toBe(201)
      expect(atividadeAplicadaResponseSchema.parse(pratica.corpo)).toMatchObject({ janela: null, duracaoMin: null, embaralhar: { questoes: false, alternativas: false }, comTempoAdicional: 0 })

      // A avaliativa que já existia sem janela (gravada antes da F6) continua na lista, sem janela.
      const [aplicacaoAntiga] = await sql<{ id: string }>(
        `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, encerrada_em) values ($1, $2, $3, $4, true, 'encerrada', $5, now()) returning id`,
        [a.escolaId, a.anoLetivoId, a.turma, await criarAtividade(bancada, a), a.professora.usuarioId],
      )
      const antiga = aplicacaoAntiga?.id
      const lista = await rotas.listar(a.professora, `?turmaId=${a.turma}&limite=100`)
      expect(lista.status).toBe(200)
      expect((lista.corpo['itens'] as { id: string; avaliativa: boolean; janela: unknown }[]).find((item) => item.id === antiga)).toMatchObject({ avaliativa: true, janela: null })
    })

    it('janela de 50 min com duração 40 e um aluno com +50% é ENTRADA_INVALIDA, sem gravar nada; a janela de 60 min passa', async () => {
      const artefatoId = await criarAtividade(bancada, a)
      const corpo = (minutos: number) => ({ artefatoId, turmaId: a.turma, avaliativa: true, janela: janelaDe(minutos), duracaoMin: 40, tempoAdicional: [adicional(bia.usuarioId, 50)] })
      expect(erro(await rotas.aplicar(a.professora, corpo(50)))).toEqual(ENTRADA_INVALIDA)
      expect(await contar('atividade_aplicada', 'artefato_id = $1', [artefatoId])).toBe(0)
      expect(await contar('auditoria', `acao = 'atividade.aplicada' and depois ->> 'artefatoId' = $1`, [artefatoId])).toBe(0)
      const passa = await rotas.aplicar(a.professora, { ...corpo(60), embaralhar: { questoes: false, alternativas: true } })
      expect(passa.status).toBe(201)
      expect(atividadeAplicadaResponseSchema.parse(passa.corpo)).toMatchObject({ embaralhar: { questoes: false, alternativas: true } })
      // O outro lado do embaralhamento, em outra aplicação: cada um dos dois vai para a sua coluna.
      const soQuestoes = await rotas.aplicar(a.professora, { artefatoId: await criarAtividade(bancada, a), turmaId: a.turma, avaliativa: true, janela: janelaDe(30), embaralhar: { questoes: true, alternativas: false } })
      expect(soQuestoes.status).toBe(201)
      expect(atividadeAplicadaResponseSchema.parse(soQuestoes.corpo)).toMatchObject({ embaralhar: { questoes: true, alternativas: false } })
    })

    it('aluno de outra turma, de outra escola, inexistente, professor, de vínculo pendente e desativado respondem a mesma coisa, e nada é gravado', async () => {
      const respostas: RespostaHttp[] = []
      const artefatos: string[] = []
      for (const alunoId of [alunoDoC.usuarioId, b.aluno.usuarioId, randomUUID(), a.professora.usuarioId, pendente.usuarioId, desativado.usuarioId]) {
        const artefatoId = await criarAtividade(bancada, a)
        artefatos.push(artefatoId)
        respostas.push(await rotas.aplicar(a.professora, { artefatoId, turmaId: a.turma, avaliativa: true, janela: janelaDe(60), duracaoMin: 40, tempoAdicional: [adicional(alunoId, 25)] }))
      }
      for (const resposta of respostas) expect(erro(resposta)).toEqual(ENTRADA_INVALIDA)
      for (const resposta of respostas) expect(corpoDoErro(resposta)).toEqual(corpoDoErro(respostas[0] as RespostaHttp))
      for (const artefatoId of artefatos) expect(await contar('atividade_aplicada', 'artefato_id = $1', [artefatoId])).toBe(0)
      expect(await contar('tempo_adicional', 'aluno_id in ($1, $2, $3, $4, $5)', [alunoDoC.usuarioId, b.aluno.usuarioId, a.professora.usuarioId, pendente.usuarioId, desativado.usuarioId])).toBe(0)
    })

    it('o que não fecha é ENTRADA_INVALIDA: não avaliativa com janela, duração sem janela, tempo adicional sem duração, chave a mais (motivo) e aluno repetido', async () => {
      const artefatoId = await criarAtividade(bancada, a)
      const base = { artefatoId, turmaId: a.turma }
      const janela = janelaDe(60)
      for (const corpo of [
        { ...base, avaliativa: false, janela },
        { ...base, avaliativa: false, embaralhar: { questoes: true, alternativas: false } },
        { ...base, avaliativa: true, duracaoMin: 40 },
        { ...base, avaliativa: true, janela, tempoAdicional: [adicional(ana.usuarioId, 25)] },
        { ...base, avaliativa: true, janela, duracaoMin: 40, tempoAdicional: [{ ...adicional(ana.usuarioId, 25), motivo: 'laudo' }] },
        { ...base, avaliativa: true, janela, duracaoMin: 40, tempoAdicional: [adicional(ana.usuarioId, 25), adicional(ana.usuarioId, 50)] },
        { ...base, avaliativa: true, janela, duracaoMin: 40, tempoAdicional: [{ alunoId: ana.usuarioId, percentual: 30 }] },
        { ...base, avaliativa: true, janela: { abreEm: janela.fechaEm, fechaEm: janela.abreEm }, duracaoMin: 40 },
      ]) {
        expect(erro(await rotas.aplicar(a.professora, corpo)), JSON.stringify(corpo)).toEqual(ENTRADA_INVALIDA)
      }
      expect(await contar('atividade_aplicada', 'artefato_id = $1', [artefatoId])).toBe(0)
      // A avaliativa com a janela e a duração passa.
      expect((await rotas.aplicar(a.professora, { ...base, avaliativa: true, janela, duracaoMin: 40 })).status).toBe(201)
    })
  })

  describe('mudar a janela', () => {
    it('só a janela e só o tempo adicional, antes do primeiro começo: grava, audita só a contagem, e o que não veio fica como estava', async () => {
      // 90 min comportam os 80 do +100% sobre 40.
      const janelaInicial = janelaDe(90)
      const id = await aplicarProva({ janela: janelaInicial, duracaoMin: 40, tempoAdicional: [adicional(ana.usuarioId, 25), adicional(bia.usuarioId, 50), adicional(caio.usuarioId, 100)] })
      // A vizinha, de outra prova da mesma turma: nada do que se muda aqui chega nela.
      const vizinha = await aplicarProva({ janela: janelaDe(60), duracaoMin: 40, tempoAdicional: [adicional(ana.usuarioId, 25)] })
      // Alguém já começou a vizinha: isso não impede mudar a prova que ninguém começou (a tentativa lida é a da aplicação, não a da escola).
      await iniciarTentativa(vizinha, ana)
      const daVizinha = await retratoDa(vizinha)
      const concedidoEm = async () => (await sql<{ concedido_em: Date }>('select concedido_em from tempo_adicional where atividade_aplicada_id = $1 and aluno_id = $2', [id, ana.usuarioId]))[0]?.concedido_em.getTime()
      const concessaoDaAna = await concedidoEm()

      // Só a janela: a duração e o tempo adicional ficam.
      const nova = janelaDe(120, 2 * 24 * 60)
      const daJanela = await rotas.mudarJanela(a.professora, id, { janela: nova })
      expect(daJanela.status).toBe(200)
      expect(atividadeAplicadaResponseSchema.parse(daJanela.corpo)).toMatchObject({ id, janela: nova, duracaoMin: 40, comTempoAdicional: 3 })
      expect(await contar('tempo_adicional', 'atividade_aplicada_id = $1', [id])).toBe(3)

      // Só o tempo adicional: a lista inteira. Quem não está nela sai (o Caio), o percentual de quem muda muda (a Bia), e quem fica igual (a Ana) não é regravada.
      const dosAdicionais = await rotas.mudarJanela(a.professora, id, { tempoAdicional: [adicional(ana.usuarioId, 25), adicional(bia.usuarioId, 100)] })
      expect(dosAdicionais.status).toBe(200)
      expect(atividadeAplicadaResponseSchema.parse(dosAdicionais.corpo)).toMatchObject({ janela: nova, duracaoMin: 40, comTempoAdicional: 2 })
      const linhas = await sql<{ aluno_id: string; percentual: number; concedido_por: string }>('select aluno_id, percentual, concedido_por from tempo_adicional where atividade_aplicada_id = $1', [id])
      expect(Object.fromEntries(linhas.map((linha) => [linha.aluno_id, linha.percentual]))).toEqual({ [ana.usuarioId]: 25, [bia.usuarioId]: 100 })
      expect(new Set(linhas.map((linha) => linha.concedido_por))).toEqual(new Set([a.professora.usuarioId]))
      expect(await concedidoEm()).toBe(concessaoDaAna)

      // Os dois campos juntos, na mesma aplicação, e a lista vazia limpa o tempo adicional.
      const dosDois = await rotas.mudarJanela(a.professora, id, { duracaoMin: 30, tempoAdicional: [] })
      expect(dosDois.status).toBe(200)
      expect(atividadeAplicadaResponseSchema.parse(dosDois.corpo)).toMatchObject({ janela: nova, duracaoMin: 30, comTempoAdicional: 0 })
      expect(await contar('tempo_adicional', 'atividade_aplicada_id = $1', [id])).toBe(0)

      const auditorias = await sql<{ antes: Record<string, unknown>; depois: Record<string, unknown> }>(`select antes, depois from auditoria where acao = 'atividade.janela_alterada' and entidade_id = $1 order by em`, [id])
      expect(auditorias).toEqual([
        { antes: { janela: janelaInicial, duracaoMin: 40, comTempoAdicional: 3 }, depois: { janela: nova, duracaoMin: 40, comTempoAdicional: 3 } },
        { antes: { janela: nova, duracaoMin: 40, comTempoAdicional: 3 }, depois: { janela: nova, duracaoMin: 40, comTempoAdicional: 2 } },
        { antes: { janela: nova, duracaoMin: 40, comTempoAdicional: 2 }, depois: { janela: nova, duracaoMin: 30, comTempoAdicional: 0 } },
      ])
      const texto = JSON.stringify(auditorias)
      for (const aluno of [ana, bia, caio]) expect(texto).not.toContain(aluno.usuarioId)
      expect(texto).not.toMatch(/percentual/)
      // A vizinha não mudou: nem a janela, nem o tempo adicional, nem a auditoria dela.
      expect(await retratoDa(vizinha)).toEqual(daVizinha)
    })

    it('a avaliativa de antes da F6, aberta e sem janela, ganha a janela pelo PATCH: a auditoria guarda nulo no que ainda não havia', async () => {
      // Aplicar já não gera avaliativa sem janela (10.0): a de antes da F6 entra por SQL, como estava gravada. A escola, o ano e a turma são os da bancada `a`,
      // a mesma da sessão que muda a janela: o caso prova a conferência da prova, e não a travessia entre escolas (essa é a do caso do isolamento, abaixo).
      const [antiga] = await sql<{ id: string }>(
        `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, true, $5) returning id`,
        [a.escolaId, a.anoLetivoId, a.turma, await criarAtividade(bancada, a), a.professora.usuarioId],
      )
      const id = antiga?.id ?? ''
      // A prova que sairia da mudança precisa ser válida: sem trazer a janela, a avaliativa continuaria sem ela, e nada muda nem se audita.
      expect(erro(await rotas.mudarJanela(a.professora, id, { tempoAdicional: [] }))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      const nova = janelaDe(60)
      const mudada = await rotas.mudarJanela(a.professora, id, { janela: nova })
      expect(mudada.status).toBe(200)
      expect(atividadeAplicadaResponseSchema.parse(mudada.corpo)).toMatchObject({ janela: nova, duracaoMin: null, comTempoAdicional: 0 })
      const semProva = { janela: null, duracaoMin: null, comTempoAdicional: 0 }
      const auditorias = await sql(`select antes, depois from auditoria where acao = 'atividade.janela_alterada' and entidade_id = $1 order by em`, [id])
      expect(auditorias).toEqual([{ antes: semProva, depois: { janela: nova, duracaoMin: null, comTempoAdicional: 0 } }])
    })

    it('a resposta do PATCH não se guarda em cache, e o id que não é uuid responde como o inexistente', async () => {
      const id = await aplicarProva()
      const pedir = (alvo: string) =>
        fetch(`${api.url}/v1/atividades-aplicadas/${alvo}/janela`, { method: 'PATCH', headers: { Authorization: `Bearer ${a.professora.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ janela: janelaDe(90) }) })
      const mudada = await pedir(id)
      expect(mudada.status).toBe(200)
      expect(mudada.headers.get('cache-control')).toBe('no-store')
      const malformado = await pedir('nao-e-um-uuid')
      const inexistente = await pedir(randomUUID())
      expect([malformado.status, (await malformado.json() as { erro?: { codigo?: string } }).erro?.codigo]).toEqual([404, 'NAO_ENCONTRADO'])
      expect(inexistente.status).toBe(404)
    })

    it('com uma tentativa iniciada, a mudança é PROVA_JA_COMECOU, em cada campo, e a aplicação fica igual', async () => {
      const id = await aplicarProva({ janela: janelaDe(60), duracaoMin: 40, tempoAdicional: [adicional(ana.usuarioId, 25)] })
      expect((await rotas.mudarJanela(a.professora, id, { duracaoMin: 35 })).status).toBe(200)
      await iniciarTentativa(id, colega)
      const antes = await retratoDa(id)
      for (const corpo of [{ janela: janelaDe(120) }, { duracaoMin: 30 }, { tempoAdicional: [adicional(bia.usuarioId, 50)] }, { janela: janelaDe(120), duracaoMin: 30, tempoAdicional: [] }]) {
        expect(erro(await rotas.mudarJanela(a.professora, id, corpo)), JSON.stringify(corpo)).toEqual(PROVA_JA_COMECOU)
      }
      expect(await retratoDa(id)).toEqual(antes)
    })

    it('a janela que não cabe, o corpo vazio, a chave a mais e o aluno de fora são recusados e não mudam nada; o de 60 min passa', async () => {
      const id = await aplicarProva({ janela: janelaDe(60), duracaoMin: 40, tempoAdicional: [adicional(bia.usuarioId, 50)] })
      const antes = await retratoDa(id)
      expect(erro(await rotas.mudarJanela(a.professora, id, { janela: janelaDe(50) }))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await rotas.mudarJanela(a.professora, id, { duracaoMin: 45 }))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await rotas.mudarJanela(a.professora, id, { tempoAdicional: [adicional(caio.usuarioId, 100)] }))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await rotas.mudarJanela(a.professora, id, {}))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await rotas.mudarJanela(a.professora, id, { janela: janelaDe(60), motivo: 'feriado' }))).toEqual(ENTRADA_INVALIDA)
      const respostas = []
      for (const alunoId of [alunoDoC.usuarioId, b.aluno.usuarioId, randomUUID(), a.professora.usuarioId, pendente.usuarioId, desativado.usuarioId]) respostas.push(await rotas.mudarJanela(a.professora, id, { tempoAdicional: [adicional(alunoId, 25)] }))
      for (const resposta of respostas) expect(erro(resposta)).toEqual(ENTRADA_INVALIDA)
      for (const resposta of respostas.slice(1)) expect(corpoDoErro(resposta)).toEqual(corpoDoErro(respostas[0] as RespostaHttp))
      expect(await retratoDa(id)).toEqual(antes)
      expect((await rotas.mudarJanela(a.professora, id, { janela: janelaDe(60, 3 * 24 * 60) })).status).toBe(200)
    })

    it('a atividade sem prova não ganha janela pelo PATCH, e a encerrada é ATIVIDADE_ENCERRADA', async () => {
      const semProva = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma, false)
      const antes = await retratoDa(semProva)
      expect(erro(await rotas.mudarJanela(a.professora, semProva, { janela: janelaDe(60) }))).toEqual(ENTRADA_INVALIDA)
      expect(await retratoDa(semProva)).toEqual(antes)

      const encerrada = await aplicarProva()
      expect((await rotas.encerrar(a.professora, encerrada)).status).toBe(200)
      expect(erro(await rotas.mudarJanela(a.professora, encerrada, { duracaoMin: 30 }))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      // E a gravação do repository, na aplicação encerrada e no contexto da dona, também não muda nada: o `where` leva o estado.
      const daEncerrada = await retratoDa(encerrada)
      const contextoDaDona: RequestContext = { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: a.professora.usuarioId, papel: 'professor', sessaoId: a.professora.sessaoId, anoLetivoId: a.anoLetivoId }
      await runInContext(contextoDaDona, () => new AtividadeAplicadaRepository(bancada.banco).saveJanela(encerrada, { janela: janelaDe(30), duracaoMin: 10 }))
      expect(await retratoDa(encerrada)).toEqual(daEncerrada)
    })
  })

  describe('corridas', () => {
    it('(b) mudar a janela × começar: o começo segura a aplicação em `for share`, a mudança espera a trava, relê e recebe PROVA_JA_COMECOU', async () => {
      const id = await aplicarProva({ janela: janelaDe(60), duracaoMin: 40 })
      const antes = await retratoDa(id)
      // O que o `comecar` faz: a aplicação em `for share` e o insert da tentativa, numa transação que o teste segura aberta.
      const conexao = await bancada.pool.connect()
      let mudanca: Promise<RespostaHttp> | undefined
      try {
        await conexao.query('begin')
        await conexao.query('select id from atividade_aplicada where id = $1 for share', [id])
        await conexao.query('insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)', [a.escolaId, a.anoLetivoId, id, ana.usuarioId])
        mudanca = rotas.mudarJanela(a.professora, id, { janela: janelaDe(120) })
        await esperarNaTrava(bancada.pool, '%atividade_aplicada%for update%')
        await conexao.query('commit')
      } finally {
        conexao.release()
      }
      expect(erro(await (mudanca as Promise<RespostaHttp>))).toEqual(PROVA_JA_COMECOU)
      expect(await retratoDa(id)).toEqual(antes)
      expect(await contar('tentativa_atividade', 'atividade_aplicada_id = $1', [id])).toBe(1)
    })

    it('(k) mudar a janela × mudar a janela: a segunda relê a janela de 50 min que a primeira gravou e recebe ENTRADA_INVALIDA', async () => {
      const id = await aplicarProva({ janela: janelaDe(60), duracaoMin: 40 })
      const curta = janelaDe(50)
      // A primeira (só a janela, encurtada) para depois do `update`, ainda com a trava; a segunda (só +50% sobre 40 min) chega e espera.
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'atividade_aplicada', evento: 'update', quando: `new.id = '${id}'` })
      await parada.armar()
      let primeira: Promise<RespostaHttp> | undefined
      let segunda: Promise<RespostaHttp> | undefined
      try {
        primeira = rotas.mudarJanela(a.professora, id, { janela: curta })
        await parada.esperarParadas()
        segunda = rotas.mudarJanela(a.professora, id, { tempoAdicional: [adicional(bia.usuarioId, 50)] })
        await esperarNaTrava(bancada.pool, '%atividade_aplicada%for update%')
        await parada.soltar()
        expect((await primeira).status).toBe(200)
        expect(erro(await segunda)).toEqual(ENTRADA_INVALIDA)
      } finally {
        await parada.desarmar()
        await Promise.allSettled([primeira, segunda])
      }
      const [linha] = await sql<{ abre_em: Date; fecha_em: Date }>('select abre_em, fecha_em from atividade_aplicada where id = $1', [id])
      expect(linha === undefined ? null : { abreEm: linha.abre_em.toISOString(), fechaEm: linha.fecha_em.toISOString() }).toEqual(curta)
      expect(await contar('tempo_adicional', 'atividade_aplicada_id = $1', [id])).toBe(0)
      expect(await contar('auditoria', `acao = 'atividade.janela_alterada' and entidade_id = $1`, [id])).toBe(1)
    })
  })

  describe('isolamento', () => {
    const contexto = (escolaId: string, anoLetivoId: string, sessao: TestSessao, papel: PapelDeUsuario): RequestContext => ({ requisicaoId: randomUUID(), escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId })
    const vazio = (lido: unknown): boolean => lido === undefined || lido === false || lido === 0 || (Array.isArray(lido) && lido.length === 0) || (lido instanceof Set && lido.size === 0)

    it('mudar a janela, por quem não é o professor daquela turma e daquela disciplina, responde como o inexistente e não muda nada', async () => {
      const id = await aplicarProva({ janela: janelaDe(60), duracaoMin: 40, tempoAdicional: [adicional(bia.usuarioId, 50)] })
      const antes = await retratoDa(id)

      const pendente = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, pendente.usuarioId, a.turma, a.quimica, 'pendente')
      // Vínculo encerrado na turma X (a do 2ºB) e aberto na Y (o 2ºC).
      const trocada = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, trocada.usuarioId, a.turma, a.quimica)
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [a.escolaId, trocada.usuarioId, a.turma])
      await vincularProfessor(bancada, a, trocada.usuarioId, a.outraTurma, a.quimica)

      const inexistente = randomUUID()
      for (const sessao of [b.professora, a.colega, a.deFisica, pendente, trocada, a.coordenacao, a.aluno, ana]) {
        // A janela de 50 min não comporta o +50% sobre 40: quem alcançasse a aplicação receberia ENTRADA_INVALIDA, e o 404 igual ao do inexistente prova que a aplicação nem é achada.
        const daAtividade = await rotas.mudarJanela(sessao, id, { janela: janelaDe(50) })
        const doInexistente = await rotas.mudarJanela(sessao, inexistente, { janela: janelaDe(50) })
        expect(erro(daAtividade)).toEqual(erro(doInexistente))
        // O aluno e a coordenação (fora da matriz) respondem como os demais: a mesma recusa do inexistente.
        expect(erro(daAtividade)).toEqual(NAO_ENCONTRADO)
      }
      expect(await retratoDa(id)).toEqual(antes)
    })

    it('a escola sem ano em curso: mudar a janela é NAO_ENCONTRADO e aplicar é recusado, sem gravar', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarProva({ janela: janelaDe(60), duracaoMin: 40 }, c)
      expect((await rotas.pedir(c.coordenacao, 'POST', `/v1/anos-letivos/${c.anoLetivoId}/encerrar`)).status).toBe(200)
      const antes = await retratoDa(id)
      expect(erro(await rotas.mudarJanela(c.professora, id, { janela: janelaDe(120) }))).toEqual(NAO_ENCONTRADO)
      const artefatoId = await criarAtividade(bancada, c)
      const aplicar = await rotas.aplicar(c.professora, { artefatoId, turmaId: c.turma, avaliativa: true, janela: janelaDe(60), duracaoMin: 40 })
      expect(erro(aplicar)).toEqual(NAO_ENCONTRADO)
      expect(await contar('atividade_aplicada', 'artefato_id = $1', [artefatoId])).toBe(0)
      expect(await retratoDa(id)).toEqual(antes)
    })

    it('no repository, o id certo com a escola trocada ou o ano trocado não acha nada; no ano dele, acha', async () => {
      const { banco } = bancada
      const id = await aplicarProva({ janela: janelaDe(60), duracaoMin: 40, tempoAdicional: [adicional(bia.usuarioId, 50)] })
      await iniciarTentativa(id, ana)
      const leituras: Record<string, () => Promise<unknown>> = {
        'aplicação travada para mudar a janela': () => new AtividadeAplicadaRepository(banco).lockParaMudarAJanela(id),
        'tempo adicional da aplicação': () => new AtividadeAplicadaRepository(banco).tempoAdicionalDaAplicacao(id),
        'há tentativa': () => new AtividadeAplicadaRepository(banco).existeTentativa(id),
        'alunos da turma entre': () => new AtividadeAplicadaRepository(banco).alunosDaTurmaEntre(a.turma, [ana.usuarioId, bia.usuarioId]),
      }
      const anterior = await montarAnoAnterior(bancada, a)
      // As gravações do repository, com o id certo e o contexto errado, não mudam nada: o `where` delas leva a escola e o ano.
      const janelaAntes = await retratoDa(id)
      const gravacoes: Record<string, () => Promise<unknown>> = {
        'trocar o tempo adicional': () => new AtividadeAplicadaRepository(banco).trocarTempoAdicional(id, []),
        'gravar a janela': () => new AtividadeAplicadaRepository(banco).saveJanela(id, { janela: undefined, duracaoMin: undefined }),
      }
      for (const [nome, gravar] of Object.entries(gravacoes)) {
        for (const [onde, escolaId, anoLetivoId] of [['com a escola trocada', b.escolaId, a.anoLetivoId], ['com o ano trocado', a.escolaId, anterior.anoLetivoId]] as const) {
          await runInContext(contexto(escolaId, anoLetivoId, a.professora, 'professor'), gravar)
          expect(await retratoDa(id), `${nome}, ${onde}`).toEqual(janelaAntes)
        }
      }
      // O que a lista dos ids deixa de fora não volta: entre os alunos da turma, só quem foi pedido.
      const soAna = await runInContext(contexto(a.escolaId, a.anoLetivoId, a.professora, 'professor'), () => new AtividadeAplicadaRepository(banco).alunosDaTurmaEntre(a.turma, [ana.usuarioId]))
      expect([...soAna]).toEqual([ana.usuarioId])
      // Sem ninguém para conferir, o conjunto é vazio: o repository não precisa da conferência de quem chama.
      expect([...(await runInContext(contexto(a.escolaId, a.anoLetivoId, a.professora, 'professor'), () => new AtividadeAplicadaRepository(banco).alunosDaTurmaEntre(a.turma, [])))]).toEqual([])
      for (const [nome, ler] of Object.entries(leituras)) {
        expect(vazio(await runInContext(contexto(a.escolaId, a.anoLetivoId, a.professora, 'professor'), ler)), `${nome}: acha no contexto da dona`).toBe(false)
        expect(vazio(await runInContext(contexto(b.escolaId, a.anoLetivoId, a.professora, 'professor'), ler)), `${nome}: com a escola trocada`).toBe(true)
        expect(vazio(await runInContext(contexto(a.escolaId, anterior.anoLetivoId, a.professora, 'professor'), ler)), `${nome}: no ano anterior`).toBe(true)
        expect(vazio(await runInContext(contexto(a.escolaId, randomUUID(), a.professora, 'professor'), ler)), `${nome}: com o ano trocado`).toBe(true)
      }
    })
  })

  describe('a tabela da saída da aba', () => {
    it('tem só as cinco colunas, nenhuma de horário e nenhuma com valor padrão; a chave v7 e a repetida são recusadas pelo banco', async () => {
      const colunas = await sql<{ column_name: string; column_default: string | null; data_type: string }>(`select column_name, column_default, data_type from information_schema.columns where table_name = 'saida_da_aba' order by column_name`)
      expect(colunas.map((coluna) => coluna.column_name).sort()).toEqual(['aluno_id', 'ano_letivo_id', 'atividade_aplicada_id', 'chave', 'escola_id'])
      expect(colunas.map((coluna) => coluna.column_default)).toEqual([null, null, null, null, null])
      expect(colunas.every((coluna) => coluna.data_type === 'uuid')).toBe(true)

      const id = await aplicarProva()
      await iniciarTentativa(id, ana)
      const inserir = (chave: string) => sql('insert into saida_da_aba (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, chave) values ($1, $2, $3, $4, $5)', [a.escolaId, a.anoLetivoId, id, ana.usuarioId, chave])
      await expect(inserir('0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b')).rejects.toThrow(/saida_da_aba_chave_v4/)
      const v4 = randomUUID()
      await inserir(v4)
      await expect(inserir(v4)).rejects.toThrow(/saida_da_aba_pk/)
    })
  })
})
