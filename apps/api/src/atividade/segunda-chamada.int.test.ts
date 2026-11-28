import { createDatabase, runInContext, type RequestContext } from '@educa/core'
import { minhasAtividadesResponseSchema, provaOnlineResponseSchema, type PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { subirApi, type TestApi, type RespostaHttp } from '../../test/test-api.js'
import { alunosComSessao, aplicarAtividade, aprovarOLote, criarAtividade, criarPlanoDeAula, criarVersaoAdaptada, encerrarAtividade, responderProva, rotasDaAtividade, type RotasDaAtividade } from '../../test/atividade.fixture.js'
import { montarEscolaComAssistente, vincularProfessor, type EscolaComAssistente } from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import { AtividadeAplicadaRepository } from './atividade-aplicada/atividade-aplicada.repository.js'
import { MinhaAtividadeRepository } from './minha-atividade/minha-atividade.repository.js'

/**
 * A segunda chamada (avaliacao-e-correcao, 9.0; RF10; Tech Spec §5.9): com a original encerrada, a professora reabre a prova, com janela nova, só para quem não a enviou. Só o convocado a vê e a faz, e as
 * tentativas dela formam um lote próprio, sem mexer no da original.
 *
 * A original de cada caso nasce pelas rotas e termina assim: Ana enviou; Bia começou e foi cortada pelo encerramento (com tempo sobrando); Caio começou e venceu sem enviar (a rotina de encerramento grava
 * `enviada_em = limite`); Dani, Edu e Fabi nunca começaram. Convocáveis: Bia, Dani, Edu e Fabi. Os instantes são relativos ao relógio do banco; nenhum teste dorme.
 */
/** Nada achado: o repository devolve `undefined` (um) ou a lista vazia (vários). */
const semNada = (lido: unknown): boolean => lido === undefined || (Array.isArray(lido) && lido.length === 0)

describe('a segunda chamada da prova', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  let ana: TestSessao
  let bia: TestSessao
  let caio: TestSessao
  let dani: TestSessao
  let edu: TestSessao
  let fabi: TestSessao
  let alunoDoC: TestSessao
  let pendente: TestSessao
  let desativado: TestSessao
  let transferido: TestSessao
  let idsDeIndisponibilidadeAntes: string[] = []
  let ultimoPulsoAntes: Date | undefined

  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query(texto, valores)).rows as Registro[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const contar = async (tabela: string, filtro: string, valores: unknown[]): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where ${filtro}`, valores))[0]?.total)
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  const ENTRADA_INVALIDA = { status: 400, codigo: 'ENTRADA_INVALIDA' }
  const FORA_DA_JANELA = { status: 409, codigo: 'PROVA_FORA_DA_JANELA' }
  const CONFLITO = { status: 409, codigo: 'CONFLITO' }
  const MIN = 60_000

  const em = (minutos: number): Date => new Date(Date.now() + minutos * MIN)
  const janelaEm = (abreMin: number, fechaMin: number) => ({ abreEm: em(abreMin).toISOString(), fechaEm: em(fechaMin).toISOString() })
  /** O pulso de agora: o banco de teste não tem a API pulsando, e a lacuna aberta andaria o limite de quem está fazendo a prova. */
  const pulsar = () => sql('update pulso_da_api set ultimo_em = now()')
  const adicional = (alunoId: string, percentual: 25 | 50 | 100) => ({ alunoId, percentual })

  /** O corpo da segunda chamada: os convocados, a janela aberta há 5 min por 2 h e a duração de 40 min, com o que o caso acrescentar. */
  const corpoDe = (alunos: readonly TestSessao[], extra: Record<string, unknown> = {}) => ({ alunoIds: alunos.map((aluno) => aluno.usuarioId), janela: janelaEm(-5, 120), duracaoMin: 40, ...extra })
  const segundaChamada = async (sessao: TestSessao, id: string, corpo: unknown): Promise<RespostaHttp> => {
    await pulsar()
    return rotas.segundaChamada(sessao, id, corpo)
  }
  /** A segunda chamada pedida pela professora da turma, esperada com 201: devolve o id da aplicação nova. */
  async function abrirSegundaChamada(original: string, alunos: readonly TestSessao[], extra: Record<string, unknown> = {}): Promise<string> {
    const resposta = await segundaChamada(a.professora, original, corpoDe(alunos, extra))
    expect(erro(resposta)).toEqual({ status: 201, codigo: undefined })
    return resposta.corpo['id'] as string
  }
  const segundasDe = (original: string) => contar('atividade_aplicada', 'segunda_chamada_de = $1', [original])
  const convocadosDe = async (original: string): Promise<string[]> =>
    (await sql<{ aluno_id: string }>('select c.aluno_id from convocado_da_segunda_chamada c join atividade_aplicada s on s.id = c.atividade_aplicada_id where s.segunda_chamada_de = $1 order by c.aluno_id', [original])).map((linha) => linha.aluno_id)
  const auditoriasDe = (original: string) =>
    sql<{ entidade_id: string; autor_usuario_id: string; antes: unknown; depois: Record<string, unknown> }>(
      `select au.entidade_id, au.autor_usuario_id, au.antes, au.depois from auditoria au join atividade_aplicada s on s.id = au.entidade_id where au.acao = 'atividade.segunda_chamada_aplicada' and s.segunda_chamada_de = $1`,
      [original],
    )
  const tentativaDe = async (id: string, aluno: TestSessao) =>
    (await sql<{ iniciada_em: Date; enviada_em: Date | null; envio: string | null }>('select iniciada_em, enviada_em, envio from tentativa_atividade where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId]))[0]

  interface Original {
    readonly id: string
    readonly artefatoId: string
  }

  /** Uma prova de primeira chamada, já encerrada, com Ana, Bia, Caio e (sem tentativa) Dani, Edu e Fabi, como o comentário do arquivo diz. */
  async function montarOriginal(prova: Record<string, unknown> = { janela: janelaEm(-5, 60), duracaoMin: 40 }): Promise<Original> {
    await pulsar()
    const artefatoId = await criarAtividade(bancada, a)
    const id = await aplicarAtividade(rotas, a.professora, artefatoId, a.turma, true, prova)
    await responderProva(rotas, ana, id, [0, 1, 2, 3, 0])
    await responderProva(rotas, bia, id, [0, null, null, null, null], false)
    await responderProva(rotas, caio, id, [1, null, null, null, null], false)
    // Caio começou há 50 min e o limite dele (40 min) passou há 10: o encerramento o grava como enviado no limite.
    await sql('update tentativa_atividade set iniciada_em = $3, limite_base_em = $4 where atividade_aplicada_id = $1 and aluno_id = $2', [id, caio.usuarioId, em(-50), em(-10)])
    await pulsar()
    await encerrarAtividade(rotas, a.professora, id)
    return { id, artefatoId }
  }

  const contexto = (escolaId: string, anoLetivoId: string, sessao: TestSessao, papel: PapelDeUsuario): RequestContext => ({ requisicaoId: randomUUID(), escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId })

  beforeAll(async () => {
    // Os limites por usuário e por escola do F0 vêm altos: o teste prova a segunda chamada, não o rate limit geral.
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '2000', LIMITE_REQ_ESCOLA_MIN: '2000' } })
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    ;[ana, bia, caio, dani, edu, fabi] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluno Sintético Caio', 'Aluna Sintética Dani', 'Aluno Sintético Edu', 'Aluna Sintética Fabi'])) as [
      TestSessao,
      TestSessao,
      TestSessao,
      TestSessao,
      TestSessao,
      TestSessao,
    ]
    ;[alunoDoC] = (await alunosComSessao(bancada, a, a.outraTurma, ['Aluno Sintético do 2ºC'])) as [TestSessao]
    ;[pendente, desativado, transferido] = (await alunosComSessao(bancada, a, a.turma, ['Aluno Sintético Pendente', 'Aluno Sintético Desativado', 'Aluno Sintético Transferido'])) as [TestSessao, TestSessao, TestSessao]
    await sql(`update vinculo set estado = 'pendente', decidido_em = null where escola_id = $1 and usuario_id = $2`, [a.escolaId, pendente.usuarioId])
    await sql('update usuario set desativado_em = now() where id = $1', [desativado.usuarioId])
    await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2`, [a.escolaId, transferido.usuarioId])
    idsDeIndisponibilidadeAntes = (await sql<{ id: string }>('select id from indisponibilidade')).map(({ id }) => id)
    ultimoPulsoAntes = (await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api'))[0]?.ultimo_em
  })

  afterAll(async () => {
    await sql('delete from indisponibilidade where id <> all($1::uuid[])', [idsDeIndisponibilidadeAntes])
    if (ultimoPulsoAntes !== undefined) await sql('update pulso_da_api set ultimo_em = $1', [ultimoPulsoAntes])
    await api.app.close()
    await bancada.fechar()
  })

  describe('quem pode reabrir, e quem pode ser convocado', () => {
    it('a original aberta é ENTRADA_INVALIDA, sem nada gravado; encerrada, a mesma chamada passa', async () => {
      await pulsar()
      const id = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      expect(erro(await segundaChamada(a.professora, id, corpoDe([dani])))).toEqual(ENTRADA_INVALIDA)
      expect(await segundasDe(id)).toBe(0)
      expect(await convocadosDe(id)).toEqual([])
      expect(await auditoriasDe(id)).toEqual([])
      await encerrarAtividade(rotas, a.professora, id)
      const aberta = await segundaChamada(a.professora, id, corpoDe([dani]))
      expect(aberta.status).toBe(201)
      expect(aberta.corpo['segundaChamadaDe']).toBe(id)
      expect(await segundasDe(id)).toBe(1)
    })

    it('a original que não é avaliativa é ENTRADA_INVALIDA, e não erro do banco', async () => {
      const id = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma, false)
      await encerrarAtividade(rotas, a.professora, id)
      expect(erro(await segundaChamada(a.professora, id, corpoDe([dani])))).toEqual(ENTRADA_INVALIDA)
      expect(await segundasDe(id)).toBe(0)
    })

    it('segunda chamada de segunda chamada é ENTRADA_INVALIDA, mesmo encerrada', async () => {
      const original = await montarOriginal()
      const primeira = await abrirSegundaChamada(original.id, [dani])
      await encerrarAtividade(rotas, a.professora, primeira)
      expect(erro(await segundaChamada(a.professora, primeira, corpoDe([edu])))).toEqual(ENTRADA_INVALIDA)
      expect(await segundasDe(primeira)).toBe(0)
      expect(await contar('convocado_da_segunda_chamada', 'atividade_aplicada_id = $1', [primeira])).toBe(1)
    })

    it('janela de 50 min com duração 40 e um convocado com tempo adicional de 50 por cento é ENTRADA_INVALIDA, e a de 60 min passa', async () => {
      const original = await montarOriginal()
      const adicionalDaBia = [adicional(bia.usuarioId, 50)]
      expect(erro(await segundaChamada(a.professora, original.id, corpoDe([bia, dani], { janela: janelaEm(-5, 45), tempoAdicional: adicionalDaBia })))).toEqual(ENTRADA_INVALIDA)
      expect(await segundasDe(original.id)).toBe(0)
      // O tempo adicional de quem não é convocado também não passa: o aluno do adicional é um dos convocados.
      expect(erro(await segundaChamada(a.professora, original.id, corpoDe([dani], { tempoAdicional: adicionalDaBia })))).toEqual(ENTRADA_INVALIDA)
      expect(await segundasDe(original.id)).toBe(0)
      const passou = await segundaChamada(a.professora, original.id, corpoDe([bia, dani], { janela: janelaEm(-5, 55), tempoAdicional: adicionalDaBia }))
      expect(passou.status).toBe(201)
      expect(await segundasDe(original.id)).toBe(1)
    })

    it('quem enviou e quem venceu sem enviar não são convocáveis; quem faltou e quem a professora cortou antes do limite são', async () => {
      // Dani enviou a segunda chamada de **outra** prova: isso não a tira desta (o envio que conta é o da original).
      const daOutra = await abrirSegundaChamada((await montarOriginal()).id, [dani])
      await responderProva(rotas, dani, daOutra, [0, 1, 2, 3, 0])
      const original = await montarOriginal()
      // O cenário chega na linha que interessa: Ana enviou, Caio foi gravado como enviado no limite, Bia ficou sem envio e Dani nunca começou.
      expect(await tentativaDe(original.id, ana)).toMatchObject({ envio: 'aluno' })
      expect(await tentativaDe(original.id, caio)).toMatchObject({ envio: 'limite' })
      expect((await tentativaDe(original.id, caio))?.enviada_em).not.toBeNull()
      expect((await tentativaDe(original.id, bia))?.enviada_em).toBeNull()
      expect(await tentativaDe(original.id, dani)).toBeUndefined()
      for (const [quem, enviou] of [['Ana, que enviou', ana], ['Caio, que venceu', caio]] as const) {
        expect(erro(await segundaChamada(a.professora, original.id, corpoDe([enviou]))), quem).toEqual(ENTRADA_INVALIDA)
        // Um convocável junto não salva o pedido: ou todos, ou ninguém.
        expect(erro(await segundaChamada(a.professora, original.id, corpoDe([dani, enviou]))), `${quem}, com Dani`).toEqual(ENTRADA_INVALIDA)
      }
      expect(await segundasDe(original.id)).toBe(0)
      expect(await convocadosDe(original.id)).toEqual([])
      // Os ids chegam em qualquer caixa (o contrato aceita), e a conferência da turma os lê em minúsculas.
      const passou = await segundaChamada(a.professora, original.id, { ...corpoDe([bia, dani]), alunoIds: [bia.usuarioId.toUpperCase(), dani.usuarioId] })
      expect(passou.status).toBe(201)
      expect(await convocadosDe(original.id)).toEqual([bia.usuarioId, dani.usuarioId].sort())
    })

    it('artefato que deixou de ser objetiva e versão adaptada sem a entrega aprovada: as recusas do aplicar', async () => {
      const original = await montarOriginal()
      // O artefato vira um plano de aula por inteiro (o banco confere o conteúdo com o tipo): a aplicação já existia, e a segunda chamada confere o artefato de novo.
      // Volta ao que era logo depois: a lista de atividades da turma lê as questões de todo artefato aplicado.
      const [guardado] = await sql<{ conteudo: unknown }>('select conteudo from artefato where id = $1', [original.artefatoId])
      await sql(`update artefato set tipo = 'plano_de_aula', conteudo = (select conteudo from artefato where id = $2) where id = $1`, [original.artefatoId, await criarPlanoDeAula(bancada, a)])
      expect(erro(await segundaChamada(a.professora, original.id, corpoDe([dani])))).toEqual(ENTRADA_INVALIDA)
      expect(await segundasDe(original.id)).toBe(0)
      await sql(`update artefato set tipo = 'atividade_objetiva', conteudo = $2 where id = $1`, [original.artefatoId, JSON.stringify(guardado?.conteudo)])
      expect((await segundaChamada(a.professora, original.id, corpoDe([dani]))).status, 'objetiva de novo: a mesma chamada passa').toBe(201)

      const adaptadaId = await criarVersaoAdaptada(bancada, a, await criarAtividade(bancada, a), 'aprovada')
      await pulsar()
      const daAdaptada = await aplicarAtividade(rotas, a.professora, adaptadaId, a.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      await encerrarAtividade(rotas, a.professora, daAdaptada)
      // Com a entrega aprovada, a segunda chamada abre; com ela pendente, é VERSAO_ADAPTADA_NAO_APROVADA, e nada se grava.
      await sql(`update entrega set estado = 'pendente', decidida_por = null, decidida_em = null where artefato_id = $1`, [adaptadaId])
      expect(erro(await segundaChamada(a.professora, daAdaptada, corpoDe([dani])))).toEqual({ status: 409, codigo: 'VERSAO_ADAPTADA_NAO_APROVADA' })
      expect(await segundasDe(daAdaptada)).toBe(0)
      await sql(`update entrega set estado = 'aprovada', decidida_por = $2, decidida_em = now() where artefato_id = $1`, [adaptadaId, a.professora.usuarioId])
      expect((await segundaChamada(a.professora, daAdaptada, corpoDe([dani]))).status).toBe(201)
    })

    it('aluno de outra turma, de outra escola, inexistente, com vínculo pendente, desativado ou transferido: a mesma resposta, e nada gravado', async () => {
      const original = await montarOriginal()
      const respostas: Array<{ status: number; codigo: string | undefined }> = []
      for (const alunoId of [alunoDoC.usuarioId, b.aluno.usuarioId, randomUUID(), pendente.usuarioId, desativado.usuarioId, transferido.usuarioId]) {
        // Com a Dani, que é convocável: o pedido inteiro cai, e a Dani não fica convocada.
        respostas.push(erro(await segundaChamada(a.professora, original.id, { ...corpoDe([dani]), alunoIds: [dani.usuarioId, alunoId] })))
      }
      expect(respostas).toEqual(Array(6).fill(ENTRADA_INVALIDA))
      expect(await segundasDe(original.id)).toBe(0)
      expect(await convocadosDe(original.id)).toEqual([])
      expect(await auditoriasDe(original.id)).toEqual([])
    })
  })

  describe('o convocado vê e faz; o resto da turma, não', () => {
    it('o convocado vê a segunda chamada na lista e começa; o tempo adicional vale, sem dizer que é adicional, e o embaralhamento é o da original', async () => {
      const original = await montarOriginal({ janela: janelaEm(-5, 60), duracaoMin: 40, embaralhar: { questoes: true, alternativas: false } })
      const id = await abrirSegundaChamada(original.id, [bia, dani], { tempoAdicional: [adicional(bia.usuarioId, 50)] })
      expect(await sql('select embaralhar_questoes, embaralhar_alternativas, segunda_chamada_de, avaliativa, estado from atividade_aplicada where id = $1', [id])).toEqual([
        { embaralhar_questoes: true, embaralhar_alternativas: false, segunda_chamada_de: original.id, avaliativa: true, estado: 'aberta' },
      ])
      for (const [aluno, minutos] of [[bia, 60], [dani, 40]] as const) {
        await pulsar()
        const item = minhasAtividadesResponseSchema.parse((await rotas.minhas(aluno, '?limite=100')).corpo).itens.find((lido) => lido.id === id)
        expect(item, 'o convocado vê a segunda chamada').toMatchObject({ duracaoMin: minutos })
        expect(provaOnlineResponseSchema.parse((await rotas.prova(aluno, id)).corpo)).toMatchObject({ comecou: false, duracaoMin: minutos })
      }
      expect(await contar('tentativa_atividade', 'atividade_aplicada_id = $1', [id])).toBe(0)
      await pulsar()
      expect((await rotas.comecar(dani, id)).status).toBe(200)
      expect(await contar('tentativa_atividade', 'atividade_aplicada_id = $1', [id])).toBe(1)
      expect((await rotas.responder(dani, id, 1, 2)).status).toBe(200)
      expect((await rotas.saidaDaAba(dani, id, { chave: randomUUID() })).status).toBe(204)
      expect((await rotas.enviar(dani, id)).status).toBe(200)
      expect(await tentativaDe(id, dani)).toMatchObject({ envio: 'aluno' })
    })

    it('o não convocado não vê na lista e recebe NAO_ENCONTRADO em todas as rotas da prova, dentro e fora da janela; o convocado, FORA_DA_JANELA fora dela', async () => {
      const original = await montarOriginal()
      const aberta = await abrirSegundaChamada(original.id, [dani])
      const outraOriginal = await montarOriginal()
      const futura = await abrirSegundaChamada(outraOriginal.id, [dani], { janela: janelaEm(30, 150) })
      // Edu é convocado de **outra** segunda chamada: isso não o põe nestas duas.
      await abrirSegundaChamada((await montarOriginal()).id, [edu])

      const rotasDoAluno = (id: string): Array<[string, (aluno: TestSessao) => Promise<RespostaHttp>]> => [
        ['comecar', (aluno) => rotas.comecar(aluno, id)],
        ['prova', (aluno) => rotas.prova(aluno, id)],
        ['tempo', (aluno) => rotas.tempo(aluno, id)],
        ['PUT da resposta', (aluno) => rotas.responder(aluno, id, 1, 0)],
        ['enviar', (aluno) => rotas.enviar(aluno, id)],
        ['saída da aba', (aluno) => rotas.saidaDaAba(aluno, id, { chave: randomUUID() })],
        ['meu diagnóstico', (aluno) => rotas.diagnostico(aluno, id)],
      ]
      for (const id of [aberta, futura]) {
        await pulsar()
        const lista = minhasAtividadesResponseSchema.parse((await rotas.minhas(edu, '?limite=100')).corpo).itens
        expect(lista.map((item) => item.id), 'a lista do não convocado').not.toContain(id)
        for (const [nome, chamar] of rotasDoAluno(id)) {
          await pulsar()
          expect(erro(await chamar(edu)), `${nome}, o não convocado`).toEqual(NAO_ENCONTRADO)
        }
        expect(await contar('tentativa_atividade', 'atividade_aplicada_id = $1 and aluno_id = $2', [id, edu.usuarioId])).toBe(0)
      }
      // O convocado, na mesma segunda chamada fora da janela, vê a lista e recebe o erro da janela, e não o do alcance.
      await pulsar()
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(dani, '?limite=100')).corpo).itens.map((item) => item.id)).toEqual(expect.arrayContaining([aberta, futura]))
      expect(erro(await rotas.comecar(dani, futura))).toEqual(FORA_DA_JANELA)
      expect(await contar('tentativa_atividade', 'atividade_aplicada_id = $1', [futura])).toBe(0)
    })

    it('o convocado transferido antes de começar não começa e não vê a segunda chamada', async () => {
      const original = await montarOriginal()
      const id = await abrirSegundaChamada(original.id, [fabi])
      await pulsar()
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(fabi, '?limite=100')).corpo).itens.map((item) => item.id)).toContain(id)
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [a.escolaId, fabi.usuarioId, a.turma])
      await pulsar()
      expect(erro(await rotas.comecar(fabi, id))).toEqual(NAO_ENCONTRADO)
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(fabi, '?limite=100')).corpo).itens.map((item) => item.id)).not.toContain(id)
      expect(await contar('tentativa_atividade', 'atividade_aplicada_id = $1', [id])).toBe(0)
      // Reabre o vínculo: a convocação continua valendo, e quem decide é o vínculo de agora.
      await sql(`update vinculo set estado = 'confirmado', motivo_encerramento = null, encerrado_em = null where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [a.escolaId, fabi.usuarioId, a.turma])
      await pulsar()
      expect((await rotas.comecar(fabi, id)).status).toBe(200)
    })
  })

  describe('o lote da segunda chamada é dela', () => {
    it('com o lote da original aprovado, a segunda chamada encerra num lote pendente próprio, e o da original não muda', async () => {
      const original = await montarOriginal()
      const entregaDaOriginal = (await sql<{ id: string }>('select id from entrega where atividade_aplicada_id = $1', [original.id]))[0]?.id
      await aprovarOLote(rotas, a.professora, original.id)
      const correcoesDe = (id: string) => sql<{ aluno_id: string; acertos: number; total: number; entrega_id: string }>('select aluno_id, acertos, total, entrega_id from correcao where atividade_aplicada_id = $1 order by aluno_id', [id])
      const antes = await correcoesDe(original.id)
      expect(antes.map((linha) => linha.aluno_id).sort()).toEqual([ana.usuarioId, bia.usuarioId, caio.usuarioId].sort())
      expect(await sql('select estado from entrega where id = $1', [entregaDaOriginal])).toEqual([{ estado: 'aprovada' }])

      const id = await abrirSegundaChamada(original.id, [bia, dani])
      await responderProva(rotas, dani, id, [0, 1, 2, 3, 0])
      await responderProva(rotas, bia, id, [3, 3, null, null, null])
      await pulsar()
      const entrega = await encerrarAtividade(rotas, a.professora, id)

      expect(entrega, 'a segunda chamada encerra com um lote').not.toBeNull()
      expect(entrega).not.toBe(entregaDaOriginal)
      expect(await sql('select estado, atividade_aplicada_id from entrega where id = $1', [entrega])).toEqual([{ estado: 'pendente', atividade_aplicada_id: id }])
      const daSegunda = await correcoesDe(id)
      expect(daSegunda.map((linha) => linha.aluno_id).sort()).toEqual([bia.usuarioId, dani.usuarioId].sort())
      expect(new Set(daSegunda.map((linha) => linha.entrega_id))).toEqual(new Set([entrega]))
      // O lote da original é o mesmo: a mesma entrega aprovada, e as mesmas correções, com as mesmas contas.
      expect(await correcoesDe(original.id)).toEqual(antes)
      expect(await sql('select estado from entrega where id = $1', [entregaDaOriginal])).toEqual([{ estado: 'aprovada' }])
      expect(await contar('entrega', 'atividade_aplicada_id = $1', [original.id])).toBe(1)
    })
  })

  describe('uma segunda chamada aberta por original', () => {
    it('a segunda aberta é CONFLITO, sem convocado nem auditoria; encerrada a primeira, outra se abre', async () => {
      const original = await montarOriginal()
      const primeira = await abrirSegundaChamada(original.id, [dani])
      expect(erro(await segundaChamada(a.professora, original.id, corpoDe([bia])))).toEqual(CONFLITO)
      expect(await segundasDe(original.id)).toBe(1)
      expect(await convocadosDe(original.id)).toEqual([dani.usuarioId])
      expect(await auditoriasDe(original.id)).toHaveLength(1)
      await encerrarAtividade(rotas, a.professora, primeira)
      expect((await segundaChamada(a.professora, original.id, corpoDe([bia]))).status).toBe(201)
      expect(await segundasDe(original.id)).toBe(2)
    })

    it('quem enviou uma segunda chamada, já encerrada, não é convocado de novo: a prova foi feita; quem não enviou passa', async () => {
      const original = await montarOriginal()
      const primeira = await abrirSegundaChamada(original.id, [bia, dani])
      await responderProva(rotas, dani, primeira, [0, 1, 2, 3, 0])
      await encerrarAtividade(rotas, a.professora, primeira)
      const antes = { segundas: await segundasDe(original.id), convocados: await convocadosDe(original.id), auditorias: await auditoriasDe(original.id) }
      expect(erro(await segundaChamada(a.professora, original.id, corpoDe([dani])))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await segundaChamada(a.professora, original.id, corpoDe([bia, dani])))).toEqual(ENTRADA_INVALIDA)
      expect({ segundas: await segundasDe(original.id), convocados: await convocadosDe(original.id), auditorias: await auditoriasDe(original.id) }).toEqual(antes)
      // Bia foi convocada, mas não enviou: continua convocável, e a Dani, que enviou, fica de fora do pedido.
      expect((await segundaChamada(a.professora, original.id, corpoDe([bia]))).status).toBe(201)
    })

    it('(h) segunda chamada dupla: a primeira insere e segura; a segunda espera, e quando a primeira confirma é CONFLITO, sem convocado nem auditoria', async () => {
      const original = await montarOriginal()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'atividade_aplicada', evento: 'insert', quando: `new.segunda_chamada_de = '${original.id}'` })
      await parada.armar()
      let primeira: Promise<RespostaHttp> | undefined
      let segunda: Promise<RespostaHttp> | undefined
      try {
        await pulsar()
        primeira = rotas.segundaChamada(a.professora, original.id, corpoDe([dani]))
        await parada.esperarParadas()
        segunda = rotas.segundaChamada(a.professora, original.id, corpoDe([bia]))
        // A segunda fica na fila da trava (a do artefato, que a primeira também tomou): não passou antes por outro caminho.
        await esperarNaTrava(bancada.pool, '%from "artefato" left join "entrega"%')
        await parada.soltar()
        expect(erro(await primeira)).toEqual({ status: 201, codigo: undefined })
        expect(erro(await segunda)).toEqual(CONFLITO)
      } finally {
        await parada.desarmar()
        await Promise.allSettled([primeira, segunda])
      }
      expect(await segundasDe(original.id)).toBe(1)
      expect(await convocadosDe(original.id)).toEqual([dani.usuarioId])
      expect(await auditoriasDe(original.id)).toHaveLength(1)
    })
  })

  describe('isolamento', () => {
    it('quem não é a professora daquela turma e daquela disciplina recebe o NAO_ENCONTRADO do inexistente, e nada se grava', async () => {
      const original = await montarOriginal()
      const sentinela = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, sentinela.usuarioId, a.turma, a.quimica, 'pendente')
      // Vínculo encerrado na turma X (a do 2ºB) e aberto na Y (o 2ºC).
      const trocada = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, trocada.usuarioId, a.turma, a.quimica)
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [a.escolaId, trocada.usuarioId, a.turma])
      await vincularProfessor(bancada, a, trocada.usuarioId, a.outraTurma, a.quimica)

      for (const sessao of [b.professora, a.colega, a.deFisica, sentinela, trocada, a.coordenacao, a.aluno, dani]) {
        const daOriginal = erro(await segundaChamada(sessao, original.id, corpoDe([dani])))
        expect(daOriginal).toEqual(erro(await segundaChamada(sessao, randomUUID(), corpoDe([dani]))))
        expect(daOriginal).toEqual(NAO_ENCONTRADO)
      }
      expect(await segundasDe(original.id)).toBe(0)
      expect(await convocadosDe(original.id)).toEqual([])
      expect(await auditoriasDe(original.id)).toEqual([])
    })

    it('a escola sem ano em curso: a segunda chamada é NAO_ENCONTRADO no `:id`, sem gravar', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      await pulsar()
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      await encerrarAtividade(rotas, c.professora, id)
      expect((await rotas.pedir(c.coordenacao, 'POST', `/v1/anos-letivos/${c.anoLetivoId}/encerrar`)).status).toBe(200)
      expect(erro(await segundaChamada(c.professora, id, { alunoIds: [randomUUID()], janela: janelaEm(-5, 120), duracaoMin: 40 }))).toEqual(NAO_ENCONTRADO)
      expect(await segundasDe(id)).toBe(0)
    })

    it('nos repositories, o id certo com a escola trocada ou o ano trocado não acha nada, e nada se grava; no contexto da dona, acha', async () => {
      const { banco } = bancada
      const original = await montarOriginal()
      const id = await abrirSegundaChamada(original.id, [dani])
      const lerComo = <Lido>(escolaId: string, anoLetivoId: string, sessao: TestSessao, papel: PapelDeUsuario, ler: () => Promise<Lido>): Promise<Lido> => runInContext(contexto(escolaId, anoLetivoId, sessao, papel), ler)

      const doProfessor: Record<string, { ler: (repositorio: AtividadeAplicadaRepository) => Promise<unknown>; daDona: unknown }> = {
        'a original da segunda chamada': { ler: (repositorio) => repositorio.originalDaSegundaChamada(original.id), daDona: expect.objectContaining({ id: original.id, turmaId: a.turma, estado: 'encerrada' }) as unknown },
        // Dos três pedidos, só Ana enviou: Bia foi cortada sem envio e Dani nunca começou.
        'quem já enviou a original': { ler: async (repositorio) => [...(await repositorio.quemEnviou(original.id, [ana.usuarioId, bia.usuarioId, dani.usuarioId]))], daDona: [ana.usuarioId] },
      }
      for (const [nome, { ler, daDona: esperado }] of Object.entries(doProfessor)) {
        const daDona = await lerComo(a.escolaId, a.anoLetivoId, a.professora, 'professor', () => ler(new AtividadeAplicadaRepository(banco)))
        expect(daDona, `${nome}, no contexto da dona`).toEqual(esperado)
        for (const [onde, escolaId, anoLetivoId, sessao] of [
          ['com a escola trocada', b.escolaId, a.anoLetivoId, b.professora],
          ['com o ano de ninguém', a.escolaId, randomUUID(), a.professora],
          ['com a escola da B e a professora da A', b.escolaId, a.anoLetivoId, a.professora],
        ] as const) {
          const lido = await lerComo(escolaId, anoLetivoId, sessao, 'professor', () => ler(new AtividadeAplicadaRepository(banco)))
          expect(semNada(lido), `${nome} ${onde}`).toBe(true)
        }
      }
      // Pelos mesmos ids, e com Caio na lista, o que enviou volta junto: o filtro por aluno olha a lista que veio, e não a aplicação inteira.
      expect(await lerComo(a.escolaId, a.anoLetivoId, a.professora, 'professor', async () => [...(await new AtividadeAplicadaRepository(banco).quemEnviou(original.id, [ana.usuarioId, caio.usuarioId]))].sort())).toEqual([ana.usuarioId, caio.usuarioId].sort())
      // O id pedido é o que decide: um id que não existe, no alcance da dona (que tem aplicações), não devolve a primeira que houver.
      expect(await lerComo(a.escolaId, a.anoLetivoId, a.professora, 'professor', () => new AtividadeAplicadaRepository(banco).originalDaSegundaChamada(randomUUID()))).toBeUndefined()
      // Sem ninguém na lista, nada volta e nada se grava.
      expect(await lerComo(a.escolaId, a.anoLetivoId, a.professora, 'professor', async () => [...(await new AtividadeAplicadaRepository(banco).quemEnviou(original.id, []))])).toEqual([])
      await lerComo(a.escolaId, a.anoLetivoId, a.professora, 'professor', () => new AtividadeAplicadaRepository(banco).saveConvocados(id, []))
      expect(await convocadosDe(original.id)).toEqual([dani.usuarioId])
      // A gravação dos convocados com a escola ou o ano trocado não passa pela FK composta: nada fica gravado.
      for (const [escolaId, anoLetivoId] of [[b.escolaId, a.anoLetivoId], [a.escolaId, randomUUID()]] as const) {
        await expect(lerComo(escolaId, anoLetivoId, a.professora, 'professor', () => new AtividadeAplicadaRepository(banco).saveConvocados(id, [bia.usuarioId]))).rejects.toThrow()
      }
      expect(await convocadosDe(original.id)).toEqual([dani.usuarioId])

      // O lado do aluno: a segunda chamada é achada pelo convocado, no contexto dele, e por mais ninguém: nem pelo colega, nem com a escola ou o ano trocados.
      const doAluno: Record<string, { ler: (repositorio: MinhaAtividadeRepository) => Promise<unknown>; esperado: unknown }> = {
        'a prova': { ler: (repositorio) => repositorio.prova(id), esperado: expect.objectContaining({ id }) as unknown },
        'a leitura sem trava': { ler: (repositorio) => repositorio.leitura(id), esperado: expect.objectContaining({ estado: 'aberta', avaliativa: true }) as unknown },
        'a lista': { ler: async (repositorio) => (await repositorio.list({ limite: 100 })).filter((linha) => linha.id === id).map((linha) => linha.id), esperado: [id] },
      }
      for (const [nome, { ler, esperado }] of Object.entries(doAluno)) {
        const lido = await lerComo(a.escolaId, a.anoLetivoId, dani, 'aluno', () => ler(new MinhaAtividadeRepository(banco)))
        expect(lido, `${nome}, o convocado`).toEqual(esperado)
        for (const [onde, escolaId, anoLetivoId, sessao] of [
          ['do colega não convocado', a.escolaId, a.anoLetivoId, edu],
          ['com a escola trocada', b.escolaId, a.anoLetivoId, dani],
          ['com o ano de ninguém', a.escolaId, randomUUID(), dani],
        ] as const) {
          const vazio = await lerComo(escolaId, anoLetivoId, sessao, 'aluno', () => ler(new MinhaAtividadeRepository(banco)))
          expect(semNada(vazio), `${nome} ${onde}`).toBe(true)
        }
      }
      // O banco fora do contexto de requisição também não entrega: o repository exige escola e ano do contexto.
      await expect(new AtividadeAplicadaRepository(createDatabase(bancada.pool)).originalDaSegundaChamada(original.id)).rejects.toThrow()
    })
  })

  describe('a auditoria', () => {
    it('`atividade.segunda_chamada_aplicada` leva a original, a turma e só as contagens: nunca os convocados nem o percentual', async () => {
      const original = await montarOriginal()
      const id = await abrirSegundaChamada(original.id, [bia, dani], { tempoAdicional: [adicional(bia.usuarioId, 50)] })
      const [linha, ...resto] = await auditoriasDe(original.id)
      expect(resto).toEqual([])
      expect(linha).toMatchObject({ entidade_id: id, autor_usuario_id: a.professora.usuarioId, antes: null })
      expect(linha?.depois).toEqual({ segundaChamadaDe: original.id, turmaId: a.turma, convocados: 2, comTempoAdicional: 1 })
      const texto = JSON.stringify(linha)
      for (const proibido of [bia.usuarioId, dani.usuarioId, 'percentual', 'alunoId', 'minutos']) expect(texto, proibido).not.toContain(proibido)
    })
  })
})
