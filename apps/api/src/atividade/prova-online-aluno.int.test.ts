import { runInContext, type RequestContext } from '@educa/core'
import { minhasAtividadesResponseSchema, provaOnlineResponseSchema, tempoResponseSchema, type PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { subirApi, type TestApi, type RespostaHttp } from '../../test/test-api.js'
import { alunosComSessao, aplicarAtividade, criarAtividade, encerrarAtividade, rotasDaAtividade, type RotasDaAtividade } from '../../test/atividade.fixture.js'
import { montarEscolaComAssistente, vincularProfessor, type EscolaComAssistente } from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { aguardar, esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import { MinhaAtividadeRepository } from './minha-atividade/minha-atividade.repository.js'

/**
 * A prova online do lado do aluno (avaliacao-e-correcao, 3.0; RF1, RF3, RF5, RF6; Tech Spec §4 e §5.2 a §5.5): começar só dentro da janela, a tentativa que nasce no `comecar` e
 * não na leitura, o limite do aluno (com o tempo adicional que ele nunca lê como tal), a resposta além do limite recusada sem gravar, e o tempo da queda da API devolvido.
 *
 * O relógio é o do banco: o teste não dorme. O instante da tentativa e o limite base são postos por SQL, em instantes que o teste calcula, e o pulso da API (`pulso_da_api`, global) é
 * renovado antes de cada caso e devolvido ao que era no fim. As indisponibilidades que o arquivo grava são apagadas no fim (os arquivos de integração rodam um por vez).
 */
describe('prova online: o aluno começa e responde dentro do limite', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let ana: TestSessao
  let bia: TestSessao
  let caio: TestSessao
  let colega: TestSessao
  let alunoDoC: TestSessao
  let idsDeIndisponibilidadeAntes: string[] = []
  let ultimoPulsoAntes: Date | undefined

  const sql = async <Registro extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Registro[]> => (await bancada.pool.query(texto, valores)).rows as Registro[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const contar = async (tabela: string, filtro: string, valores: unknown[]): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where ${filtro}`, valores))[0]?.total)
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  const FORA_DA_JANELA = { status: 409, codigo: 'PROVA_FORA_DA_JANELA' }
  const TEMPO_ESGOTADO = { status: 503, codigo: 'TEMPO_ESGOTADO' }
  const MIN = 60_000

  /** Um instante a `minutos` de agora (negativo, no passado), pelo relógio desta máquina: o banco roda nela. */
  const em = (minutos: number): Date => new Date(Date.now() + minutos * MIN)
  const janelaEm = (abreMin: number, fechaMin: number) => ({ abreEm: em(abreMin).toISOString(), fechaEm: em(fechaMin).toISOString() })
  const adicional = (alunoId: string, percentual: 25 | 50 | 100) => ({ alunoId, percentual })

  /** O pulso de agora: o teste que não toca nele não conta a lacuna aberta que o pulso parado do banco de teste deixaria. */
  const pulsar = () => sql('update pulso_da_api set ultimo_em = now()')

  /** Uma aplicação avaliativa nova, de um artefato novo (a mesma aberta duas vezes na turma é `CONFLITO`), já aberta por padrão (de 5 min atrás a 60 min à frente). */
  async function aplicarProva(prova: Record<string, unknown> = { janela: janelaEm(-5, 60), duracaoMin: 40 }, escola: EscolaComAssistente = a): Promise<string> {
    return aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola), escola.turma, true, prova)
  }

  const tentativaDe = async (id: string, aluno: TestSessao) =>
    (await sql<{ iniciada_em: Date; limite_base_em: Date | null; enviada_em: Date | null; envio: string | null }>('select iniciada_em, limite_base_em, enviada_em, envio from tentativa_atividade where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId]))[0]
  const contarTentativas = (id: string) => contar('tentativa_atividade', 'atividade_aplicada_id = $1', [id])
  const contarRespostas = (id: string) => contar('resposta_atividade', 'atividade_aplicada_id = $1', [id])
  const tempoDe = async (id: string, aluno: TestSessao) => tempoResponseSchema.parse((await rotas.tempo(aluno, id)).corpo)

  /** Uma extensão de tempo posta por SQL (a rota do professor é da 5.0): do aluno, ou da turma inteira quando `alunoId` é nulo. */
  const estender = (id: string, alunoId: string | null, minutos: number) =>
    sql('insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave) values ($1, $2, $3, $4, $5, $6, $7)', [a.escolaId, a.anoLetivoId, id, alunoId, minutos, a.professora.usuarioId, randomUUID()])
  const janelaDoBanco = async (id: string) => {
    const [linha] = await sql<{ abre_em: Date; fecha_em: Date }>('select abre_em, fecha_em from atividade_aplicada where id = $1', [id])
    return { abreEm: linha?.abre_em.toISOString(), fechaEm: linha?.fecha_em.toISOString() }
  }

  /** Posiciona a tentativa do aluno: começou `iniciadaMin` minutos atrás e o limite base é `limiteMin` minutos à frente (negativo: já passou). */
  const posicionar = (id: string, aluno: TestSessao, iniciadaMin: number, limiteMin: number) =>
    sql('update tentativa_atividade set iniciada_em = $3, limite_base_em = $4 where atividade_aplicada_id = $1 and aluno_id = $2', [id, aluno.usuarioId, em(iniciadaMin), em(limiteMin)])

  beforeAll(async () => {
    // Os limites por usuário e por escola do F0 vêm altos: o teste prova o balde do `comecar` (`rl:comecar-prova`), não o rate limit geral.
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '2000', LIMITE_REQ_ESCOLA_MIN: '2000' } })
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    ;[ana, bia, caio, colega] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Ana', 'Aluna Sintética Bia', 'Aluno Sintético Caio', 'Aluno Sintético Colega'])) as [TestSessao, TestSessao, TestSessao, TestSessao]
    ;[alunoDoC] = (await alunosComSessao(bancada, a, a.outraTurma, ['Aluno Sintético do 2ºC'])) as [TestSessao]
    idsDeIndisponibilidadeAntes = (await sql<{ id: string }>('select id from indisponibilidade')).map(({ id }) => id)
    ultimoPulsoAntes = (await sql<{ ultimo_em: Date }>('select ultimo_em from pulso_da_api'))[0]?.ultimo_em
  })

  afterAll(async () => {
    await sql('delete from indisponibilidade where id <> all($1::uuid[])', [idsDeIndisponibilidadeAntes])
    if (ultimoPulsoAntes !== undefined) await sql('update pulso_da_api set ultimo_em = $1', [ultimoPulsoAntes])
    await api.app.close()
    await bancada.fechar()
  })

  describe('começar: alcance, depois janela, depois o limite', () => {
    it('antes de `abre_em` e depois de `fecha_em` é PROVA_FORA_DA_JANELA, sem tentativa; dentro da janela começa', async () => {
      await pulsar()
      const cedo = await aplicarProva({ janela: janelaEm(30, 90), duracaoMin: 40 })
      const tarde = await aplicarProva({ janela: janelaEm(-90, -30), duracaoMin: 40 })
      for (const id of [cedo, tarde]) {
        expect(erro(await rotas.comecar(ana, id))).toEqual(FORA_DA_JANELA)
        expect(await contarTentativas(id)).toBe(0)
      }
      const aberta = await aplicarProva({ janela: janelaEm(-5, 60), duracaoMin: 40 })
      const resposta = await rotas.comecar(ana, aberta)
      expect(resposta.status).toBe(200)
      expect(await contarTentativas(aberta)).toBe(1)
      // A janela é fechada à direita: no instante do fim ela já fechou (`agora >= fecha_em`).
      const noFim = await aplicarProva({ janela: janelaEm(-60, 0), duracaoMin: 40 })
      expect(erro(await rotas.comecar(ana, noFim))).toEqual(FORA_DA_JANELA)
    })

    it('a 10 min do `fecha_em` com duração 40 o limite é o `fecha_em`; começando cedo, o limite é o começo mais 40', async () => {
      await pulsar()
      const fechando = await aplicarProva({ janela: janelaEm(-50, 10), duracaoMin: 40 })
      const noFim = provaOnlineResponseSchema.parse((await rotas.comecar(ana, fechando)).corpo)
      const [aplicacao] = await sql<{ fecha_em: Date }>('select fecha_em from atividade_aplicada where id = $1', [fechando])
      expect(noFim.comecou && noFim.tempo.limiteEm).toBe(aplicacao?.fecha_em.toISOString())

      const cedo = await aplicarProva({ janela: janelaEm(-5, 120), duracaoMin: 40 })
      const comecou = provaOnlineResponseSchema.parse((await rotas.comecar(ana, cedo)).corpo)
      const tentativa = await tentativaDe(cedo, ana)
      expect(comecou.comecou && comecou.tempo.limiteEm).toBe(new Date((tentativa?.iniciada_em.getTime() ?? 0) + 40 * MIN).toISOString())
      expect(tentativa?.limite_base_em?.toISOString()).toBe(new Date((tentativa?.iniciada_em.getTime() ?? 0) + 40 * MIN).toISOString())
    })

    it('começar de novo devolve a tentativa que já havia, com o mesmo limite; depois de fechada a janela, quem já começou volta a ela', async () => {
      await pulsar()
      const id = await aplicarProva()
      const primeira = provaOnlineResponseSchema.parse((await rotas.comecar(ana, id)).corpo)
      await sql('update atividade_aplicada set abre_em = $2, fecha_em = $3 where id = $1', [id, em(-120), em(-60)])
      await posicionar(id, ana, -10, 30)
      const segunda = provaOnlineResponseSchema.parse((await rotas.comecar(ana, id)).corpo)
      expect(segunda.comecou).toBe(true)
      expect(primeira.comecou && segunda.comecou && segunda.questoes).toEqual(primeira.comecou && primeira.questoes)
      // Quem não começou antes de a janela fechar não começa.
      expect(erro(await rotas.comecar(bia, id))).toEqual(FORA_DA_JANELA)
      expect(await contarTentativas(id)).toBe(1)
    })

    it('(a) começar × começar: três chamadas ao mesmo tempo dão uma tentativa e um `limite_base_em`, o mesmo nas três respostas', async () => {
      await pulsar()
      const id = await aplicarProva({ janela: janelaEm(-5, 120), duracaoMin: 40 })
      const respostas = await Promise.all([rotas.comecar(caio, id), rotas.comecar(caio, id), rotas.comecar(caio, id)])
      expect(respostas.map((resposta) => resposta.status)).toEqual([200, 200, 200])
      expect(await contarTentativas(id)).toBe(1)
      const limites = respostas.map((resposta) => provaOnlineResponseSchema.parse(resposta.corpo)).map((prova) => (prova.comecou ? prova.tempo.limiteEm : null))
      expect(new Set(limites).size).toBe(1)
      expect(limites[0]).toBe((await tentativaDe(id, caio))?.limite_base_em?.toISOString())
    })

    it('(a) começar × começar com a primeira segurada: a segunda espera, não cria outra tentativa e devolve o `limiteEm` da primeira, mesmo com o `now()` dela mais novo', async () => {
      await pulsar()
      const id = await aplicarProva({ janela: janelaEm(-5, 120), duracaoMin: 40 })
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'tentativa_atividade', evento: 'insert', quando: `new.atividade_aplicada_id = '${id}'` })
      await parada.armar()
      let primeira: Promise<RespostaHttp> | undefined
      let segunda: Promise<RespostaHttp> | undefined
      try {
        primeira = rotas.comecar(colega, id)
        await parada.esperarParadas(1)
        // A segunda começa depois, com outro `now()`: espera na linha que a primeira já inseriu (a chave única), em vez de gravar um limite seu.
        await new Promise((pronto) => setTimeout(pronto, 1_100))
        segunda = rotas.comecar(colega, id)
        // Dois no `insert`: a primeira (parada no gatilho, que também é espera de trava) e a segunda (na chave única, esperando a primeira). Com um só, a espera voltava com a primeira
        // e o `desarmar` a soltava antes de a segunda chegar ao banco: ela achava a tentativa pronta e nunca passava pelo `on conflict`.
        await esperarNaTrava(bancada.pool, '%tentativa_atividade%', 2)
      } finally {
        await parada.desarmar()
      }
      const [daPrimeira, daSegunda] = [provaOnlineResponseSchema.parse((await (primeira as Promise<RespostaHttp>)).corpo), provaOnlineResponseSchema.parse((await (segunda as Promise<RespostaHttp>)).corpo)]
      expect(await contarTentativas(id)).toBe(1)
      expect(daSegunda.comecou && daSegunda.tempo.limiteEm).toBe(daPrimeira.comecou ? daPrimeira.tempo.limiteEm : 'x')
      expect(daSegunda.comecou && daSegunda.tempo.limiteEm).toBe((await tentativaDe(id, colega))?.limite_base_em?.toISOString())
    })

    it('(b) mudar a janela × começar: o `comecar` espera a mudança segurada e grava o limite da janela nova', async () => {
      await pulsar()
      // A janela de hoje fecha em 20 min (o limite seria o `fecha_em`); a mudança a leva a 120 min, e o limite do aluno passa a ser o começo mais 40.
      const id = await aplicarProva({ janela: janelaEm(-5, 120), duracaoMin: 40 })
      await sql('update atividade_aplicada set fecha_em = $2 where id = $1', [id, em(20)])
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'atividade_aplicada', evento: 'update', quando: `new.id = '${id}'` })
      await parada.armar()
      let mudanca: Promise<RespostaHttp> | undefined
      let comeco: Promise<RespostaHttp> | undefined
      try {
        mudanca = rotas.mudarJanela(a.professora, id, { janela: janelaEm(-5, 120) })
        await parada.esperarParadas(1)
        comeco = rotas.comecar(bia, id)
        await esperarNaTrava(bancada.pool, '%atividade_aplicada%for share%')
        expect(await contarTentativas(id)).toBe(0)
      } finally {
        await parada.desarmar()
      }
      expect((await (mudanca as Promise<RespostaHttp>)).status).toBe(200)
      const resposta = await (comeco as Promise<RespostaHttp>)
      expect(resposta.status).toBe(200)
      const tentativa = await tentativaDe(id, bia)
      expect(tentativa?.limite_base_em?.getTime()).toBe((tentativa?.iniciada_em.getTime() ?? 0) + 40 * MIN)
    })
  })

  describe('ler a prova não grava', () => {
    it('`prova` sem tentativa traz o título, a janela e a duração, sem questão e sem gravar; depois do `comecar`, traz as questões', async () => {
      await pulsar()
      const id = await aplicarProva()
      const antes = await rotas.prova(ana, id)
      expect(antes.status).toBe(200)
      const lida = provaOnlineResponseSchema.parse(antes.corpo)
      expect(lida).toMatchObject({ comecou: false, atividadeAplicadaId: id, duracaoMin: 40 })
      expect(Object.keys(antes.corpo).sort()).toEqual(['atividadeAplicadaId', 'comecou', 'duracaoMin', 'janela', 'titulo'])
      expect(JSON.stringify(antes.corpo)).not.toMatch(/questoes|enunciado|gabarito/)
      expect(await contarTentativas(id)).toBe(0)
      expect(await janelaDoBanco(id)).toEqual((lida.comecou ? undefined : lida.janela) ?? {})
      // Sem tentativa o aluno não começou: tempo, resposta e envio respondem como o inexistente, e nenhuma delas cria a tentativa.
      for (const resposta of [await rotas.tempo(ana, id), await rotas.responder(ana, id, 1, 0), await rotas.enviar(ana, id)]) expect(erro(resposta)).toEqual(NAO_ENCONTRADO)
      expect(await contarTentativas(id)).toBe(0)
      expect(await contarRespostas(id)).toBe(0)

      await rotas.comecar(ana, id)
      const depois = provaOnlineResponseSchema.parse((await rotas.prova(ana, id)).corpo)
      expect(depois.comecou && depois.questoes).toHaveLength(5)
      expect(depois.comecou && depois.tempo.envio).toBeNull()
    })

    it('o tempo adicional do aluno vira só a duração dele: 60 em `prova` e `minhas-atividades` para +50%, sem "adicional" nem percentual, e o colega lê 40', async () => {
      await pulsar()
      const id = await aplicarProva({ janela: janelaEm(-5, 200), duracaoMin: 40, tempoAdicional: [adicional(ana.usuarioId, 50)] })
      const daAna = await rotas.prova(ana, id)
      const doColega = await rotas.prova(colega, id)
      expect(provaOnlineResponseSchema.parse(daAna.corpo)).toMatchObject({ comecou: false, duracaoMin: 60 })
      expect(provaOnlineResponseSchema.parse(doColega.corpo)).toMatchObject({ comecou: false, duracaoMin: 40 })
      const listaDaAna = await rotas.minhas(ana)
      expect(minhasAtividadesResponseSchema.parse(listaDaAna.corpo).itens.find((item) => item.id === id)).toMatchObject({ duracaoMin: 60, janela: await janelaDoBanco(id) })
      const listaDoColega = await rotas.minhas(colega)
      expect(minhasAtividadesResponseSchema.parse(listaDoColega.corpo).itens.find((item) => item.id === id)?.duracaoMin).toBe(40)
      // Outra aplicação com +100% para a mesma aluna: a lista lê o tempo adicional de cada aplicação, não o de outra (60 e 80, cada um na sua).
      const dobrada = await aplicarProva({ janela: janelaEm(-5, 200), duracaoMin: 40, tempoAdicional: [adicional(ana.usuarioId, 100)] })
      const itens = minhasAtividadesResponseSchema.parse((await rotas.minhas(ana)).corpo).itens
      expect([itens.find((item) => item.id === id)?.duracaoMin, itens.find((item) => item.id === dobrada)?.duracaoMin]).toEqual([60, 80])
      // Depois de começar: o limite dele é o começo mais 60, o do colega o começo mais 40; nada diz de onde veio.
      const comecouAna = await rotas.comecar(ana, id)
      const comecouColega = await rotas.comecar(colega, id)
      for (const [resposta, minutos, aluno] of [[comecouAna, 60, ana], [comecouColega, 40, colega]] as const) {
        const tentativa = await tentativaDe(id, aluno)
        const prova = provaOnlineResponseSchema.parse(resposta.corpo)
        expect(prova.comecou && prova.tempo.limiteEm).toBe(new Date((tentativa?.iniciada_em.getTime() ?? 0) + minutos * MIN).toISOString())
      }
      for (const corpo of [daAna.corpo, listaDaAna.corpo, comecouAna.corpo, (await rotas.tempo(ana, id)).corpo]) expect(JSON.stringify(corpo)).not.toMatch(/adicional|percentual/i)
    })
  })

  describe('a resposta e o envio dentro do limite', () => {
    it('um minuto antes do limite grava; depois dele é TEMPO_ESGOTADO, sem linha; a vencida sem envio lê `envio=limite`', async () => {
      await pulsar()
      const id = await aplicarProva()
      await rotas.comecar(ana, id)
      await posicionar(id, ana, -39, 1)
      expect((await rotas.responder(ana, id, 1, 2)).status).toBe(200)
      expect(await contarRespostas(id)).toBe(1)

      await posicionar(id, ana, -41, -1)
      expect(erro(await rotas.responder(ana, id, 2, 1))).toEqual(TEMPO_ESGOTADO)
      expect(erro(await rotas.enviar(ana, id))).toEqual(TEMPO_ESGOTADO)
      expect(await contarRespostas(id)).toBe(1)
      expect((await tentativaDe(id, ana))?.enviada_em).toBeNull()
      // A prova vencida sem envio conta como enviada em toda leitura, e o aluno vê por quê.
      expect(await tempoDe(id, ana)).toMatchObject({ envio: 'limite' })
      const prova = provaOnlineResponseSchema.parse((await rotas.prova(ana, id)).corpo)
      expect(prova.comecou && prova.tempo.envio).toBe('limite')
      expect(prova.comecou && prova.enviadaEm).not.toBeNull()
      const lista = minhasAtividadesResponseSchema.parse((await rotas.minhas(ana)).corpo).itens.find((item) => item.id === id)
      expect(lista).toMatchObject({ situacao: 'enviada', respondidas: 1 })
      expect(lista?.enviadaEm).not.toBeNull()
    })

    it('o envio dentro do limite diz `aluno`; a não avaliativa, sem janela nem duração, grava a qualquer hora e não tem limite', async () => {
      await pulsar()
      const id = await aplicarProva()
      await rotas.comecar(bia, id)
      expect((await rotas.responder(bia, id, 1, 0)).status).toBe(200)
      expect((await rotas.enviar(bia, id)).status).toBe(200)
      expect(await tempoDe(id, bia)).toMatchObject({ envio: 'aluno' })
      expect((await tentativaDe(id, bia))?.envio).toBe('aluno')
      // Enviar de novo, depois de o limite passar, devolve o mesmo envio: a tentativa já enviada não é recusada por tempo.
      const primeiroEnvio = (await tentativaDe(id, bia))?.enviada_em?.toISOString()
      await posicionar(id, bia, -41, -1)
      const deNovo = await rotas.enviar(bia, id)
      expect(deNovo.status).toBe(200)
      expect(deNovo.corpo['enviadaEm']).toBe(primeiroEnvio)
      await posicionar(id, bia, -1, 39)
      // A linha enviada antes da migration não tem `envio`: lê-se `aluno`.
      await sql('update tentativa_atividade set envio = null where atividade_aplicada_id = $1 and aluno_id = $2', [id, bia.usuarioId])
      expect(await tempoDe(id, bia)).toMatchObject({ envio: 'aluno' })

      const semProva = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma, false)
      await rotas.comecar(caio, semProva)
      await sql('update tentativa_atividade set iniciada_em = now() - interval \'10 days\' where atividade_aplicada_id = $1', [semProva])
      expect((await rotas.responder(caio, semProva, 1, 3)).status).toBe(200)
      expect((await rotas.enviar(caio, semProva)).status).toBe(200)
      expect(await tempoDe(semProva, caio)).toEqual({ limiteEm: null, agora: expect.any(String), envio: 'aluno' })
    })

    it('(c) enviar × responder: o PUT que chega com o envio segurado espera a trava da tentativa (`for update`) e, solto, é ATIVIDADE_ENCERRADA, sem gravar', async () => {
      await pulsar()
      const id = await aplicarProva()
      await rotas.comecar(bia, id)
      expect((await rotas.responder(bia, id, 1, 0)).status).toBe(200)
      const antes = await contarRespostas(id)
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'tentativa_atividade', evento: 'update', quando: `new.atividade_aplicada_id = '${id}'` })
      await parada.armar()
      let envio: Promise<RespostaHttp> | undefined
      let resposta: Promise<RespostaHttp> | undefined
      try {
        envio = rotas.enviar(bia, id)
        await parada.esperarParadas(1)
        resposta = rotas.responder(bia, id, 2, 1)
        // A resposta lê a tentativa com `for update`: com o envio segurado (a linha já travada por ele), ela fica na fila em vez de ler a tentativa ainda sem hora de envio.
        await esperarNaTrava(bancada.pool, '%tentativa_atividade%for update%')
        expect(await contarRespostas(id)).toBe(antes)
      } finally {
        await parada.desarmar()
      }
      expect((await (envio as Promise<RespostaHttp>)).status).toBe(200)
      expect(erro(await (resposta as Promise<RespostaHttp>))).toMatchObject({ codigo: 'ATIVIDADE_ENCERRADA' })
      expect(await contarRespostas(id)).toBe(antes)
      expect((await tentativaDe(id, bia))?.enviada_em).not.toBeNull()
    })

    it('a indisponibilidade fechada de 5 min devolve o tempo: grava 2 min depois do limite original, e `prova` e `tempo` trazem o limite mais 5', async () => {
      await pulsar()
      const id = await aplicarProva()
      await rotas.comecar(ana, id)
      const inicio = em(-10)
      const base = em(-2)
      await sql('update tentativa_atividade set iniciada_em = $3, limite_base_em = $4 where atividade_aplicada_id = $1 and aluno_id = $2', [id, ana.usuarioId, inicio, base])
      // Sem a queda, a tentativa já venceu há 2 min.
      expect(erro(await rotas.responder(ana, id, 1, 0))).toEqual(TEMPO_ESGOTADO)
      await sql('insert into indisponibilidade (inicio, fim) values ($1, $2)', [em(-6), em(-1)])
      expect((await rotas.responder(ana, id, 1, 0)).status).toBe(200)
      const limite = new Date(base.getTime() + 5 * MIN).toISOString()
      expect((await tempoDe(id, ana)).limiteEm).toBe(limite)
      const prova = provaOnlineResponseSchema.parse((await rotas.prova(ana, id)).corpo)
      expect(prova.comecou && prova.tempo.limiteEm).toBe(limite)
      await sql('delete from indisponibilidade where id <> all($1::uuid[])', [idsDeIndisponibilidadeAntes])
    })

    it('a lacuna aberta montada à mão (pulso parado há 3 min) conta no PUT, em `prova` e em `tempo`', async () => {
      const id = await aplicarProva()
      await pulsar()
      await rotas.comecar(bia, id)
      const base = em(-2)
      await sql('update tentativa_atividade set iniciada_em = $3, limite_base_em = $4 where atividade_aplicada_id = $1 and aluno_id = $2', [id, bia.usuarioId, em(-10), base])
      expect(erro(await rotas.responder(bia, id, 1, 0))).toEqual(TEMPO_ESGOTADO)
      await sql(`update pulso_da_api set ultimo_em = now() - interval '3 minutes'`)
      try {
        expect((await rotas.responder(bia, id, 1, 0)).status).toBe(200)
        const esperado = base.getTime() + 3 * MIN
        const limite = Date.parse((await tempoDe(id, bia)).limiteEm ?? '')
        expect(Math.abs(limite - esperado)).toBeLessThan(5_000)
        const prova = provaOnlineResponseSchema.parse((await rotas.prova(bia, id)).corpo)
        expect(Math.abs(Date.parse(prova.comecou ? (prova.tempo.limiteEm ?? '') : '') - esperado)).toBeLessThan(5_000)
      } finally {
        await pulsar()
      }
    })
  })

  describe('a lista, as extensões e o encerramento', () => {
    it('a extensão do aluno e a da turma somam ao limite, e a de outro aluno não: `tempo` traz o base mais 15 min', async () => {
      await pulsar()
      const id = await aplicarProva()
      await rotas.comecar(ana, id)
      const base = em(30)
      await sql('update tentativa_atividade set iniciada_em = $3, limite_base_em = $4 where atividade_aplicada_id = $1 and aluno_id = $2', [id, ana.usuarioId, em(-10), base])
      await estender(id, ana.usuarioId, 10)
      await estender(id, null, 5)
      await estender(id, bia.usuarioId, 20)
      // A extensão da mesma aluna em outra prova não é desta.
      await estender(await aplicarProva(), ana.usuarioId, 7)
      expect((await tempoDe(id, ana)).limiteEm).toBe(new Date(base.getTime() + 15 * MIN).toISOString())
    })

    it('a lista conta como vencida a tentativa em andamento sem extensão, e só ela: a estendida (do aluno ou da turma), a de outro aluno, a enviada e a da atividade encerrada ficam como estão', async () => {
      await pulsar()
      const nova = async () => {
        const id = await aplicarProva()
        await rotas.comecar(ana, id)
        await posicionar(id, ana, -41, -3)
        return id
      }
      const semExtensao = await nova()
      const doAluno = await nova()
      const daTurma = await nova()
      const deOutro = await nova()
      const enviada = await nova()
      const encerrada = await nova()
      await estender(doAluno, ana.usuarioId, 10)
      await estender(daTurma, null, 10)
      await estender(deOutro, bia.usuarioId, 30)
      // A enviada foi enviada antes do limite e só depois ele passou: a hora do envio é a que vale, não a do limite.
      await posicionar(enviada, ana, -10, 30)
      await rotas.enviar(ana, enviada)
      await posicionar(enviada, ana, -41, -3)
      // A atividade encerrada com a tentativa ainda com tempo fica sem envio (a vencida, ao encerrar, é gravada no limite dela: caso a seguir); depois o limite passa.
      await posicionar(encerrada, ana, -10, 30)
      await encerrarAtividade(rotas, a.professora, encerrada)
      await posicionar(encerrada, ana, -41, -3)
      const lista = minhasAtividadesResponseSchema.parse((await rotas.minhas(ana, '?limite=100')).corpo).itens
      const de = (id: string) => lista.find((item) => item.id === id)
      // Sem extensão: vencida há 3 min, conta como enviada, com o limite como hora. A extensão do aluno e a da turma a mantêm em andamento; a de outro aluno não vale para ela.
      expect(de(semExtensao)).toMatchObject({ situacao: 'enviada', enviadaEm: (await tentativaDe(semExtensao, ana))?.limite_base_em?.toISOString() })
      expect(de(doAluno)).toMatchObject({ situacao: 'em_andamento', enviadaEm: null })
      expect(de(daTurma)).toMatchObject({ situacao: 'em_andamento', enviadaEm: null })
      expect(de(deOutro)).toMatchObject({ situacao: 'enviada' })
      expect(de(enviada)?.enviadaEm).toBe((await tentativaDe(enviada, ana))?.enviada_em?.toISOString())
      expect(de(encerrada)).toMatchObject({ situacao: 'encerrada', enviadaEm: null })
    })

    it('a atividade que a professora encerrou antes de o aluno enviar diz `encerramento`, sem hora de envio', async () => {
      await pulsar()
      const id = await aplicarProva()
      await rotas.comecar(caio, id)
      await encerrarAtividade(rotas, a.professora, id)
      expect(await tempoDe(id, caio)).toMatchObject({ envio: 'encerramento' })
      const prova = provaOnlineResponseSchema.parse((await rotas.prova(caio, id)).corpo)
      expect(prova.comecou && [prova.tempo.envio, prova.enviadaEm]).toEqual(['encerramento', null])
    })

    it('`tempo` é leitura sem trava: com a aplicação travada em `for update` (o encerramento), ele responde sem esperar', async () => {
      await pulsar()
      const id = await aplicarProva()
      await rotas.comecar(ana, id)
      const conexao = await bancada.pool.connect()
      try {
        await conexao.query('begin')
        await conexao.query('select id from atividade_aplicada where id = $1 for update', [id])
        let respondeu: RespostaHttp | undefined
        const chamada = rotas.tempo(ana, id).then((resposta) => (respondeu = resposta))
        // Sem relógio de parede: espera até a chamada responder ou até algum backend aparecer parado numa trava sobre a aplicação (o `for share`/`for update` que a leitura não pode tomar).
        const esperando = async (): Promise<number> =>
          Number((await sql<{ total: string }>(`select count(*) as total from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock' and query ilike '%atividade_aplicada%'`))[0]?.total)
        await aguardar(async () => respondeu !== undefined || (await esperando()) > 0, '`tempo` responder ou esperar na trava da aplicação')
        expect(await esperando()).toBe(0)
        expect((await chamada).status).toBe(200)
      } finally {
        await conexao.query('rollback')
        conexao.release()
      }
    })

    it('a professora encerrando grava a vencida no limite dela (`envio` = limite) e deixa sem envio a que ainda tinha tempo, que segue com o que salvou (6.0; Tech Spec §5.5)', async () => {
      await pulsar()
      // Uma queda gravada nos últimos 35 min (de outro caso ou de outro arquivo da rodada) andaria o limite que o caso compara.
      await sql("delete from indisponibilidade where fim > now() - interval '3 hours'")
      const id = await aplicarProva()
      for (const aluno of [ana, bia]) {
        await rotas.comecar(aluno, id)
        expect((await rotas.responder(aluno, id, 1, 0)).status).toBe(200)
      }
      await posicionar(id, ana, -35, -5)
      await posicionar(id, bia, -5, 20)
      expect((await rotas.encerrar(a.professora, id)).status).toBe(200)
      const daAna = await tentativaDe(id, ana)
      expect(daAna?.envio).toBe('limite')
      expect(daAna?.enviada_em?.toISOString()).toBe(daAna?.limite_base_em?.toISOString())
      const semEnvio = async () => {
        const daBia = await tentativaDe(id, bia)
        return [daBia?.enviada_em, daBia?.envio]
      }
      expect(await semEnvio()).toEqual([null, null])
      // As duas entram na correção, com o que cada uma salvou.
      expect(await contar('correcao', 'atividade_aplicada_id = $1', [id])).toBe(2)
      // Encerrar de novo, com o limite da que tinha tempo já passado, não regrava nada: o fato gravado no primeiro encerramento é o que vale, e a Bia segue sem envio (o `encerramento` é derivado: não se grava).
      await posicionar(id, bia, -35, -5)
      expect((await rotas.encerrar(a.professora, id)).status).toBe(200)
      expect(await semEnvio()).toEqual([null, null])
      expect(await contar('correcao', 'atividade_aplicada_id = $1', [id])).toBe(2)
    })
  })

  describe('alcance e isolamento', () => {
    it('o aluno de outra turma e o de outra escola, fora da janela, recebem NAO_ENCONTRADO, nunca PROVA_FORA_DA_JANELA; e nada é gravado', async () => {
      await pulsar()
      const fora = await aplicarProva({ janela: janelaEm(30, 90), duracaoMin: 40 })
      const outra = await montarEscolaComAssistente(api, bancada)
      for (const intruso of [alunoDoC, outra.aluno]) {
        expect(erro(await rotas.comecar(intruso, fora))).toEqual(NAO_ENCONTRADO)
        expect(erro(await rotas.prova(intruso, fora))).toEqual(NAO_ENCONTRADO)
        expect(erro(await rotas.tempo(intruso, fora))).toEqual(NAO_ENCONTRADO)
      }
      expect(erro(await rotas.comecar(ana, randomUUID()))).toEqual(NAO_ENCONTRADO)
      expect(await contarTentativas(fora)).toBe(0)
    })

    it('o aluno transferido, com tentativa na turma A, recebe NAO_ENCONTRADO nas rotas de A, e `minhas-atividades` traz só as de B', async () => {
      await pulsar()
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      expect((await rotas.comecar(c.aluno, id)).status).toBe(200)
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [c.escolaId, c.aluno.usuarioId, c.turma])
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [c.escolaId, c.anoLetivoId, c.aluno.usuarioId, c.outraTurma, c.coordenacao.usuarioId])
      await vincularProfessor(bancada, c, c.professora.usuarioId, c.outraTurma, c.quimica)
      const deB = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.outraTurma, false)
      for (const resposta of [await rotas.comecar(c.aluno, id), await rotas.prova(c.aluno, id), await rotas.tempo(c.aluno, id), await rotas.responder(c.aluno, id, 1, 0), await rotas.enviar(c.aluno, id)]) {
        expect(erro(resposta)).toEqual(NAO_ENCONTRADO)
      }
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(c.aluno)).corpo).itens.map((item) => item.id)).toEqual([deB])
      // A tentativa em A fica: as recusas não a apagam nem a enviam.
      expect(await contarTentativas(id)).toBe(1)
      expect(await tentativaDe(id, c.aluno)).toMatchObject({ enviada_em: null })
    })

    it('a escola sem ano em curso: as rotas e a lista são NAO_ENCONTRADO, e nada é gravado', async () => {
      await pulsar()
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      await rotas.comecar(c.aluno, id)
      expect((await rotas.pedir(c.coordenacao, 'POST', `/v1/anos-letivos/${c.anoLetivoId}/encerrar`)).status).toBe(200)
      for (const resposta of [await rotas.comecar(c.aluno, id), await rotas.prova(c.aluno, id), await rotas.tempo(c.aluno, id), await rotas.responder(c.aluno, id, 1, 0), await rotas.enviar(c.aluno, id)]) {
        expect(erro(resposta)).toEqual(NAO_ENCONTRADO)
      }
      // Sem ano em curso a lista também é a recusa do inexistente (o repository, com o ano trocado, devolve lista vazia: caso do repository abaixo).
      expect(erro(await rotas.minhas(c.aluno))).toEqual(NAO_ENCONTRADO)
      expect(await contarRespostas(id)).toBe(0)
      // O envio recusado não gravou: a tentativa que o `comecar` criou segue sem hora de envio.
      expect(await tentativaDe(id, c.aluno)).toMatchObject({ enviada_em: null, envio: null })
    })

    describe('no repository: o id certo com o contexto errado', () => {
      const contexto = (escolaId: string, anoLetivoId: string, sessao: TestSessao, papel: PapelDeUsuario): RequestContext => ({ requisicaoId: randomUUID(), escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId })
      const vazio = (lido: unknown): boolean => lido === undefined || lido === null || lido === false || lido === 0 || (Array.isArray(lido) && lido.length === 0) || (lido instanceof Map && lido.size === 0)

      it('cada leitura da prova do aluno acha o dado no contexto da dona, e não acha nada com a escola trocada nem com o ano trocado', async () => {
        await pulsar()
        const { banco } = bancada
        const id = await aplicarProva({ janela: janelaEm(-5, 60), duracaoMin: 40, tempoAdicional: [adicional(ana.usuarioId, 50)] })
        await rotas.comecar(ana, id)
        await estender(id, ana.usuarioId, 10)
        const outra = await montarEscolaComAssistente(api, bancada)
        const leituras: Record<string, () => Promise<unknown>> = {
          'prova': () => new MinhaAtividadeRepository(banco).prova(id),
          'prova travada': () => new MinhaAtividadeRepository(banco).prova(id, true),
          'tentativa': () => new MinhaAtividadeRepository(banco).tentativa(id),
          'tentativa travada': () => new MinhaAtividadeRepository(banco).tentativaTravada(id),
          'tempo adicional do aluno': () => new MinhaAtividadeRepository(banco).percentualDoAluno(id),
          'extensões': () => new MinhaAtividadeRepository(banco).extensoes(id),
          'extensões da lista': () => new MinhaAtividadeRepository(banco).extensoesDas([id]),
          'lock para gravar': () => new MinhaAtividadeRepository(banco).lockParaGravar(id),
          'leitura sem trava': () => new MinhaAtividadeRepository(banco).leitura(id),
          'lista': () => new MinhaAtividadeRepository(banco).list({ limite: 50 }),
        }
        for (const [nome, ler] of Object.entries(leituras)) {
          const daDona = await runInContext(contexto(a.escolaId, a.anoLetivoId, ana, 'aluno'), ler)
          expect(vazio(daDona), `${nome}: acha no contexto da dona`).toBe(false)
          expect(vazio(await runInContext(contexto(outra.escolaId, a.anoLetivoId, ana, 'aluno'), ler)), `${nome}: com a escola trocada`).toBe(true)
          expect(vazio(await runInContext(contexto(a.escolaId, randomUUID(), ana, 'aluno'), ler)), `${nome}: com o ano trocado`).toBe(true)
        }
        // O tempo adicional lido no contexto dele é o dele; o do colega no mesmo contexto não existe.
        expect(await runInContext(contexto(a.escolaId, a.anoLetivoId, ana, 'aluno'), () => new MinhaAtividadeRepository(banco).percentualDoAluno(id))).toBe(50)
        expect(await runInContext(contexto(a.escolaId, a.anoLetivoId, colega, 'aluno'), () => new MinhaAtividadeRepository(banco).percentualDoAluno(id))).toBeNull()
      })

      it('`extensoesDas` com o id de uma aplicação de outra escola no array não traz a extensão dela, e a da própria escola, no mesmo array, traz', async () => {
        await pulsar()
        const { banco } = bancada
        const outra = await montarEscolaComAssistente(api, bancada)
        const daOutra = await aplicarProva({ janela: janelaEm(-5, 60), duracaoMin: 40 }, outra)
        await sql('insert into extensao_de_tempo (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, minutos, concedida_por, chave) values ($1, $2, $3, null, 10, $4, $5)', [outra.escolaId, outra.anoLetivoId, daOutra, outra.professora.usuarioId, randomUUID()])
        const minha = await aplicarProva({ janela: janelaEm(-5, 60), duracaoMin: 40 })
        await estender(minha, null, 15)
        const lidas = await runInContext(contexto(a.escolaId, a.anoLetivoId, ana, 'aluno'), () => new MinhaAtividadeRepository(banco).extensoesDas([minha, daOutra]))
        expect([...lidas.keys()]).toEqual([minha])
        expect(lidas.get(minha)).toEqual([{ alunoId: null, minutos: 15 }])
      })

      it('as gravações do repository, com o id certo e o contexto errado, não mudam nada', async () => {
        await pulsar()
        const { banco } = bancada
        const id = await aplicarProva({ janela: janelaEm(-5, 60), duracaoMin: 40 })
        const outra = await montarEscolaComAssistente(api, bancada)
        const limite = em(30)
        for (const [onde, escolaId, anoLetivoId] of [['com a escola trocada', outra.escolaId, a.anoLetivoId], ['com o ano trocado', a.escolaId, randomUUID()]] as const) {
          await runInContext(contexto(escolaId, anoLetivoId, caio, 'aluno'), () => new MinhaAtividadeRepository(banco).comecar(id, limite, null)).catch(() => undefined)
          expect(await contarTentativas(id), `comecar ${onde}`).toBe(0)
        }
        await runInContext(contexto(a.escolaId, a.anoLetivoId, caio, 'aluno'), () => new MinhaAtividadeRepository(banco).comecar(id, limite, null))
        expect(await contarTentativas(id)).toBe(1)
        for (const [onde, escolaId, anoLetivoId] of [['com a escola trocada', outra.escolaId, a.anoLetivoId], ['com o ano trocado', a.escolaId, randomUUID()]] as const) {
          await runInContext(contexto(escolaId, anoLetivoId, caio, 'aluno'), () => new MinhaAtividadeRepository(banco).send(id)).catch(() => undefined)
          expect((await tentativaDe(id, caio))?.enviada_em, `enviar ${onde}`).toBeNull()
        }
      })
    })
  })

  describe('o balde do `comecar`: 30 por minuto por usuário, nunca por IP', () => {
    it('a 31ª chamada do minuto é 429; outro aluno atrás do mesmo IP passa; a 30ª passou', async () => {
      await pulsar()
      const c = await montarEscolaComAssistente(api, bancada)
      const [primeiro, segundo] = (await alunosComSessao(bancada, c, c.turma, ['Aluno Sintético Balde Um', 'Aluno Sintético Balde Dois'])) as [TestSessao, TestSessao]
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma, true, { janela: janelaEm(-5, 60), duracaoMin: 40 })
      const aceitas: RespostaHttp[] = []
      for (let i = 0; i < 30; i += 1) aceitas.push(await rotas.comecar(primeiro, id))
      expect(new Set(aceitas.map((resposta) => resposta.status))).toEqual(new Set([200]))
      expect(erro(await rotas.comecar(primeiro, id))).toEqual({ status: 429, codigo: 'LIMITE_EXCEDIDO' })
      expect((await rotas.comecar(segundo, id)).status).toBe(200)
      // O balde é só do `comecar`: a leitura da prova do mesmo aluno segue.
      expect((await rotas.prova(primeiro, id)).status).toBe(200)
      expect(await contarTentativas(id)).toBe(2)
    })
  })
})
