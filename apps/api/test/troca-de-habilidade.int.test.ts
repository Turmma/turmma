import { type LLMProvider } from '@educa/core'
import { artefatoResponseSchema, conteudoDeAtividadeSchema, correcaoDoLoteResponseSchema, descricaoParaOModelo, ErrorCode, type ConteudoDeAtividade } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { ArtefatoService, JANELA_DA_TROCA_DE_HABILIDADE_MS, TROCAS_POR_ESCOLA_NA_JANELA, TROCAS_POR_USUARIO_NA_JANELA } from '../src/artefato/artefato.service.js'
import { IaRequestRateLimit } from '../src/assistente/ai-request-rate-limit.js'
import { aplicarAtividade, alunosComSessao, conteudoDeTeste, criarAtividade, criarPlanoDeAula, criarVersaoAdaptada, encerrarAtividade, responderProva, rotasDaAtividade } from './atividade.fixture.js'
import { comoPessoa, enviarMaterialDeDemonstracao, execucaoTerminada, montarEscolaComAssistente, vincularProfessor, zerarLimiteDePedidosDeIa, type EscolaComAssistente } from './escola-assistente.fixture.js'
import { FilaDeIa } from './fila-de-ia.fixture.js'
import { auditoriaDa, variacaoDoPdf } from './material.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, type RespostaHttp, type TestApi } from './test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * O professor troca a habilidade da questão no artefato dele, e aplicar e adaptar tomam a mesma trava (classificacao-bncc, 11.0; `techspec.md` §4 e §5 "Troca"; `cenarios.md` "Troca pelo professor", "Permissão e isolamento" e as
 * corridas P6a, P6b, P7 e P8). A API é a de verdade, com o Postgres do compose de teste e o adaptador falso de IA; nenhum teste chama modelo de verdade. O artefato é gravado direto, com o gabarito e as citações que o teste conhece.
 *
 * A escola A tem o material de demonstração com duas seções: o capítulo 3 (páginas 1 a 3, `EM13CNT101` da IA) e um bloco de páginas (4 a 6, `EM13CNT102` corrigida pela coordenação). A B tem o artefato que a A não alcança.
 */
describe('o professor troca a habilidade da questão no artefato dele', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  let fila: FilaDeIa
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  /** A disciplina da A cujo componente é outro (Matemática), com a professora vinculada no mesmo 2ºB. */
  let matematica: string
  /** A disciplina da A sem componente da BNCC, com a professora vinculada no mesmo 2ºB. */
  let robotica: string
  const rotas = (): ReturnType<typeof rotasDaAtividade> => rotasDaAtividade(api)

  /** A habilidade que a atividade de teste tem nas três primeiras questões e a que passa a ter, ambas do recorte (Química no 2º ano do Médio). */
  const ORIGINAL = 'EM13CNT102'
  const NOVA = 'EM13CNT104'
  const OUTRA = 'EM13CNT105'
  const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)
  const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const naoEncontrado = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO }
  /** Se o pedido já respondeu ou segue esperando depois de um tempo: quem chega depois da trava tem de seguir esperando, e é isto que diz a regra quando ela falta (e não só o tempo esgotado do `esperarNaTrava`). */
  const situacaoDe = (pedido: Promise<unknown>): Promise<'respondido' | 'esperando'> => Promise.race([pedido.then(() => 'respondido' as const), new Promise<'esperando'>((resolver) => setTimeout(() => resolver('esperando'), 500))])
  const entradaInvalida = { status: 400, codigo: ErrorCode.ENTRADA_INVALIDA }
  const conflito = { status: 409, codigo: ErrorCode.CONFLITO }

  const trocar = async (sessao: TestSessao, artefatoId: string, indice: number | string, codigo: unknown): Promise<RespostaHttp> =>
    chamar(api.url, 'PATCH', `/v1/artefatos/${artefatoId}/questoes/${String(indice)}/habilidade`, await sessao.tokenNovo(), { codigo })
  const ler = async (sessao: TestSessao, artefatoId: string) => artefatoResponseSchema.parse((await chamar(api.url, 'GET', `/v1/artefatos/${artefatoId}`, await sessao.tokenNovo())).corpo)
  const conteudoDe = async (artefatoId: string): Promise<ConteudoDeAtividade> => {
    const { rows } = await sql<{ conteudo: unknown }>('select conteudo from artefato where id = $1', [artefatoId])
    return conteudoDeAtividadeSchema.parse(rows[0]?.conteudo)
  }
  const codigosDasQuestoes = async (artefatoId: string): Promise<(string | null)[]> => (await conteudoDe(artefatoId)).questoes.map((questao) => questao.habilidade?.codigo ?? null)
  const atividade = (escola: EscolaComAssistente = a, opcoes: { disciplinaId?: string } = {}): Promise<string> => criarAtividade(bancada, escola, opcoes)
  const trocasAuditadas = (escola: EscolaComAssistente = a) => auditoriaDa(bancada, escola.escolaId, 'artefato.habilidade_trocada')
  const totalDeTrocas = async (escola: EscolaComAssistente = a): Promise<number> => (await trocasAuditadas(escola)).length

  async function inserirSecao(escola: EscolaComAssistente, ordem: number, de: number, ate: number, habilidade: readonly [string, 'ia' | 'coordenacao'], capitulo?: { numero: number; titulo: string }): Promise<void> {
    let capituloId: string | null = null
    if (capitulo !== undefined) {
      const { rows } = await sql<{ id: string }>('insert into capitulo_do_material (escola_id, material_id, ordem, numero, titulo, pagina_inicial, pagina_final) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
        escola.escolaId,
        escola.materialId,
        ordem,
        capitulo.numero,
        capitulo.titulo,
        de,
        ate,
      ])
      capituloId = rows[0]?.id ?? null
    }
    const { rows } = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, capitulo_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3, $4::smallint, $5, $6) returning id', [
      escola.escolaId,
      escola.materialId,
      capituloId,
      ordem,
      de,
      ate,
    ])
    await sql('insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, $4)', [escola.escolaId, rows[0]?.id, habilidade[0], habilidade[1]])
  }

  /** As seções do material de A: o capítulo 3 (páginas 1 a 3, da IA) e o bloco de páginas 4 a 6 (da coordenação). */
  async function secoesDeA(): Promise<void> {
    await sql('delete from secao_do_material where escola_id = $1 and material_id = $2', [a.escolaId, a.materialId])
    await sql('delete from capitulo_do_material where escola_id = $1 and material_id = $2', [a.escolaId, a.materialId])
    await inserirSecao(a, 1, 1, 3, ['EM13CNT101', 'ia'], { numero: 3, titulo: 'Reações químicas' })
    await inserirSecao(a, 2, 4, 6, [ORIGINAL, 'coordenacao'])
  }
  const habilidadesDaSecaoDeA = async (): Promise<string[]> => (await sql<{ codigo: string; origem: string }>('select codigo, origem from habilidade_da_secao where escola_id = $1 order by codigo', [a.escolaId])).rows.map((linha) => `${linha.codigo}:${linha.origem}`)

  const suspender = (escola: EscolaComAssistente) => sql("insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, 'classificacao_do_material', $2)", [escola.escolaId, escola.coordenacao.usuarioId])
  const retomar = (escola: EscolaComAssistente) =>
    sql("update suspensao_de_funcao set retomada_em = greatest(now(), suspensa_em), retomada_por = $2 where escola_id = $1 and funcao = 'classificacao_do_material' and retomada_em is null", [escola.escolaId, escola.coordenacao.usuarioId])

  async function disciplinaNova(escola: EscolaComAssistente, nome: string): Promise<string> {
    const criada = await chamar(api.url, 'POST', '/v1/disciplinas', await escola.coordenacao.tokenNovo(), { nome })
    expect(criada.status).toBe(201)
    const id = criada.corpo['id'] as string
    await vincularProfessor(bancada, escola, escola.professora.usuarioId, escola.turma, id)
    return id
  }

  /** Os services atrás do adaptador falso, com o agendador da bancada: o que o teste da adaptação usa para pedir e esperar a versão. */
  function adaptacao() {
    fila.comModelo(async (pedido) => ({ saida: (await fila.falso().generate(pedido as Parameters<LLMProvider['generate']>[0])).saida, medicao: {} }))
    return new ArtefatoService(bancada.banco, fila.agendador(), api.app.get(IaRequestRateLimit))
  }

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor, {}, linhasDeLog)
    api = fila.api
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    matematica = await disciplinaNova(a, 'Matemática')
    robotica = await disciplinaNova(a, 'Robótica')
  })

  afterEach(() => fila.restaurar())

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
    await secoesDeA()
    // Cada caso conta as trocas que ele mesmo fez: o teste da escola é de teste, e o registro dele é sintético.
    await sql("delete from auditoria where escola_id = any($1::uuid[]) and acao = 'artefato.habilidade_trocada'", [[a.escolaId, b.escolaId]])
  })

  afterAll(async () => {
    await fila.ociosa()
    await fila.fechar()
    await bancada.fechar()
  })

  describe('a troca', () => {
    it('muda a habilidade só da questão pedida, com o texto da BNCC, deixa a classificação da base como estava e audita sem título nem texto', async () => {
      const id = await atividade()
      const basesAntes = await habilidadesDaSecaoDeA()
      const antes = await conteudoDe(id)

      const resposta = await trocar(a.professora, id, 1, NOVA)
      expect(resposta.status).toBe(200)
      const devolvido = artefatoResponseSchema.parse(resposta.corpo)
      const { rows } = await sql<{ descricao: string }>('select descricao from habilidade_bncc where codigo = $1', [NOVA])
      expect(devolvido.conteudo).toMatchObject({ tipo: 'atividade_objetiva' })

      const depois = await conteudoDe(id)
      expect(depois.questoes[1]?.habilidade).toEqual({ codigo: NOVA, descricao: descricaoParaOModelo(rows[0]?.descricao ?? '') })
      // As outras questões, o título e o gabarito ficam como estavam.
      expect(depois.questoes.map((questao, indice) => (indice === 1 ? { ...questao, habilidade: antes.questoes[1]?.habilidade } : questao))).toEqual(antes.questoes)
      expect(depois.titulo).toBe(antes.titulo)
      // A base não muda: a classificação das seções é a mesma, de cada origem.
      expect(await habilidadesDaSecaoDeA()).toEqual(basesAntes)

      const [trocada] = await trocasAuditadas()
      expect(trocada).toMatchObject({ entidade: 'artefato', entidade_id: id, autor_usuario_id: a.professora.usuarioId, antes: { indice: 1, codigo: ORIGINAL, legado: false }, depois: { indice: 1, codigo: NOVA } })
      const registro = JSON.stringify(trocada)
      for (const proibido of [antes.titulo, antes.questoes[1]?.enunciado ?? '', rows[0]?.descricao ?? '']) expect(registro, proibido).not.toContain(proibido)
    })

    it('com outro artefato da mesma professora, a troca lê e grava só o pedido; a questão que não tinha habilidade passa a ter a nova, e o `antes` do registro diz nulo sem `legado`', async () => {
      // O artefato isca é mais velho e tem outro título: a trava e a gravação que se enganassem de artefato o mostrariam.
      const isca = await criarAtividade(bancada, a, { conteudo: conteudoDeTeste(a.materialId, 'Atividade isca') })
      const semHabilidade = conteudoDeTeste(a.materialId, 'Atividade alvo')
      const alvo = conteudoDeAtividadeSchema.parse({ ...semHabilidade, questoes: semHabilidade.questoes.map((questao, indice) => (indice === 1 ? { ...questao, habilidade: null } : questao)) })
      const id = await criarAtividade(bancada, a, { conteudo: alvo })

      expect((await trocar(a.professora, id, 1, NOVA)).status).toBe(200)

      const depois = await conteudoDe(id)
      expect(depois.titulo).toBe('Atividade alvo')
      expect(depois.questoes[1]?.habilidade?.codigo).toBe(NOVA)
      expect(depois.questoes[0]?.habilidade?.codigo).toBe(ORIGINAL)
      const outra = await conteudoDe(isca)
      expect(outra.titulo).toBe('Atividade isca')
      expect(outra.questoes[1]?.habilidade?.codigo).toBe(ORIGINAL)
      const [trocada] = await trocasAuditadas()
      expect(trocada).toMatchObject({ entidade_id: id, antes: { indice: 1, codigo: null, legado: false }, depois: { indice: 1, codigo: NOVA } })
    })

    it('troca por nenhuma (`null`) e o código do catálogo antigo, de antes da BNCC, sai do `antes` como `legado`', async () => {
      const comLegado = { ...conteudoDeTeste(a.materialId), questoes: conteudoDeTeste(a.materialId).questoes.map((questao, indice) => (indice === 0 ? { ...questao, habilidade: { codigo: 'QUI.EM.05', descricao: 'Catálogo antigo' } } : questao)) }
      const id = await atividade(a, {})
      await sql('update artefato set conteudo = $2 where id = $1', [id, JSON.stringify(comLegado)])

      expect((await trocar(a.professora, id, 0, null)).status).toBe(200)
      expect((await trocar(a.professora, id, 1, null)).status).toBe(200)

      expect((await codigosDasQuestoes(id)).slice(0, 3)).toEqual([null, null, ORIGINAL])
      expect((await trocasAuditadas()).map((registro) => [registro.antes, registro.depois])).toEqual([
        [{ indice: 0, codigo: null, legado: true }, { indice: 0, codigo: null }],
        [{ indice: 1, codigo: ORIGINAL, legado: false }, { indice: 1, codigo: null }],
      ])
    })

    it('o diagnóstico usa a trocada: a atividade aplicada depois da troca resume o acerto pela habilidade nova, e a base segue a mesma', async () => {
      const id = await atividade()
      for (const indice of [0, 1, 2]) expect((await trocar(a.professora, id, indice, NOVA)).status).toBe(200)

      const aplicada = await aplicarAtividade(rotas(), a.professora, id, a.turma)
      const [aluno] = await alunosComSessao(bancada, a, a.turma, ['Aluno Sintético da troca'])
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      await responderProva(rotas(), aluno, aplicada, [0, 1, 2, 3, 0])
      await encerrarAtividade(rotas(), a.professora, aplicada)

      const correcao = correcaoDoLoteResponseSchema.parse((await rotas().correcao(a.professora, aplicada)).corpo)
      expect(correcao.resumo.porHabilidade.map((linha) => [linha.habilidade?.codigo, linha.acertos, linha.total])).toEqual([
        [NOVA, 3, 3],
        ['EM13CNT103', 2, 2],
      ])
      expect(await habilidadesDaSecaoDeA()).toEqual(['EM13CNT101:ia', `${ORIGINAL}:coordenacao`])
    })

    it('só `null` vale na disciplina sem componente da BNCC, e o código de qualquer outra fica recusado', async () => {
      const id = await atividade(a, { disciplinaId: robotica })
      expect(erroDe(await trocar(a.professora, id, 0, NOVA))).toEqual(entradaInvalida)
      expect((await trocar(a.professora, id, 0, null)).status).toBe(200)
      expect(await codigosDasQuestoes(id)).toEqual([null, ORIGINAL, ORIGINAL, 'EM13CNT103', 'EM13CNT103'])
      expect((await chamar(api.url, 'GET', `/v1/habilidades-bncc?artefatoId=${id}`, await a.professora.tokenNovo())).corpo).toMatchObject({ itens: [], semComponente: true })
    })
  })

  describe('as recusas, na ordem da Tech Spec', () => {
    it('a coordenação e o aluno não alcançam a rota (a rede, que só lê agregado, está na matriz de permissão), e a questão fica como estava', async () => {
      const id = await atividade()
      const antes = await codigosDasQuestoes(id)
      expect(erroDe(await trocar(a.coordenacao, id, 0, NOVA))).toEqual(naoEncontrado)
      expect(erroDe(await trocar(a.aluno, id, 0, NOVA))).toEqual(naoEncontrado)
      expect(await codigosDasQuestoes(id)).toEqual(antes)
      expect(await totalDeTrocas()).toBe(0)
    })

    it('o artefato de outro professor da escola (mesma turma e disciplina, outra turma, outra disciplina) é `NAO_ENCONTRADO`, nunca `CONFLITO`, mesmo aplicado', async () => {
      const id = await atividade()
      const colegaDaMesmaTurma = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, colegaDaMesmaTurma.usuarioId, a.turma, a.quimica)
      await aplicarAtividade(rotas(), a.professora, id, a.turma)

      for (const [nome, outro] of [['mesma turma e disciplina', colegaDaMesmaTurma], ['outra turma', a.colega], ['outra disciplina', a.deFisica]] as const) {
        expect(erroDe(await trocar(outro, id, 0, NOVA)), nome).toEqual(naoEncontrado)
      }
      expect(await codigosDasQuestoes(id)).toEqual([ORIGINAL, ORIGINAL, ORIGINAL, 'EM13CNT103', 'EM13CNT103'])
    })

    it('o artefato da outra escola, e o inexistente, respondem igual (`NAO_ENCONTRADO`), e nada muda lá', async () => {
      const daB = await atividade(b)
      const antes = await codigosDasQuestoes(daB)
      expect(erroDe(await trocar(a.professora, daB, 0, NOVA))).toEqual(naoEncontrado)
      expect(erroDe(await trocar(a.professora, randomUUID(), 0, NOVA))).toEqual(naoEncontrado)
      expect(erroDe(await trocar(b.professora, await atividade(), 0, NOVA))).toEqual(naoEncontrado)
      expect(await codigosDasQuestoes(daB)).toEqual(antes)
      expect(await totalDeTrocas(b)).toBe(0)
    })

    it('o código de outra disciplina da mesma professora na mesma turma, o de outra etapa e o que a tabela não tem são `ENTRADA_INVALIDA`, antes de qualquer `CONFLITO`', async () => {
      const id = await atividade()
      const antes = await codigosDasQuestoes(id)
      expect(matematica).not.toBe(a.quimica)
      for (const codigo of ['EM13MAT101', 'EF06CI01', 'EM13CNT999', 'em13cnt101', 'Mudar as frações']) expect(erroDe(await trocar(a.professora, id, 0, codigo)), codigo).toEqual(entradaInvalida)
      // Aplicada e com código fora do recorte: o recorte vem primeiro.
      await aplicarAtividade(rotas(), a.professora, id, a.turma)
      expect(erroDe(await trocar(a.professora, id, 0, 'EM13MAT101'))).toEqual(entradaInvalida)
      expect(await codigosDasQuestoes(id)).toEqual(antes)
      expect(await totalDeTrocas()).toBe(0)
    })

    it('o índice de questão que a atividade não tem, o plano de aula e o corpo com campo a mais são recusados sem gravar; o índice fora do formato responde como o inexistente', async () => {
      const id = await atividade()
      const plano = await criarPlanoDeAula(bancada, a)
      const antes = await codigosDasQuestoes(id)
      expect(erroDe(await trocar(a.professora, id, 5, NOVA))).toEqual(entradaInvalida)
      expect(erroDe(await trocar(a.professora, id, 19, NOVA))).toEqual(entradaInvalida)
      expect(erroDe(await trocar(a.professora, plano, 0, NOVA))).toEqual(entradaInvalida)
      for (const indice of ['20', '-1', '001', '0x1', '1e1', 'a']) expect(erroDe(await trocar(a.professora, id, indice, NOVA)), indice).toEqual(naoEncontrado)
      const comCampoAMais = await chamar(api.url, 'PATCH', `/v1/artefatos/${id}/questoes/0/habilidade`, await a.professora.tokenNovo(), { codigo: NOVA, descricao: 'Texto do cliente' })
      expect(erroDe(comCampoAMais)).toEqual(entradaInvalida)
      expect(erroDe(await chamar(api.url, 'PATCH', `/v1/artefatos/${id}/questoes/0/habilidade`, await a.professora.tokenNovo(), {}))).toEqual(entradaInvalida)
      expect(await codigosDasQuestoes(id)).toEqual(antes)
      expect(await totalDeTrocas()).toBe(0)
    })

    it('o artefato já aplicado é `CONFLITO`, mesmo na aplicação encerrada, e a questão fica como estava', async () => {
      const id = await atividade()
      const aplicada = await aplicarAtividade(rotas(), a.professora, id, a.turma)
      expect(erroDe(await trocar(a.professora, id, 0, NOVA))).toEqual(conflito)
      await rotas().encerrar(a.professora, aplicada)
      expect(erroDe(await trocar(a.professora, id, 0, NOVA))).toEqual(conflito)
      expect((await codigosDasQuestoes(id))[0]).toBe(ORIGINAL)
      expect(await totalDeTrocas()).toBe(0)
    })

    it('o artefato com versão adaptada (em qualquer estado da entrega) é `CONFLITO`, e a própria versão adaptada também', async () => {
      for (const estado of ['pendente', 'aprovada', 'rejeitada'] as const) {
        const id = await atividade()
        const versao = await criarVersaoAdaptada(bancada, a, id, estado)
        expect(erroDe(await trocar(a.professora, id, 0, NOVA)), `original com a versão ${estado}`).toEqual(conflito)
        expect(erroDe(await trocar(a.professora, versao, 0, NOVA)), `a versão ${estado}`).toEqual(conflito)
        expect((await codigosDasQuestoes(id))[0]).toBe(ORIGINAL)
      }
      expect(await totalDeTrocas()).toBe(0)
    })
    it('a aplicação e a versão adaptada de outro artefato não fecham a troca deste: o artefato solto da mesma professora, na mesma turma, troca', async () => {
      const aplicado = await atividade()
      await aplicarAtividade(rotas(), a.professora, aplicado, a.turma)
      const comVersao = await atividade()
      await criarVersaoAdaptada(bancada, a, comVersao, 'pendente')
      const id = await atividade()
      expect((await trocar(a.professora, id, 0, NOVA)).status).toBe(200)
      expect((await codigosDasQuestoes(id))[0]).toBe(NOVA)
      // A troca grava só o artefato pedido: os outros da mesma escola e do mesmo ano ficam como estavam.
      expect((await codigosDasQuestoes(aplicado))[0]).toBe(ORIGINAL)
      expect((await codigosDasQuestoes(comVersao))[0]).toBe(ORIGINAL)
      expect(await totalDeTrocas()).toBe(1)
    })
  })

  describe('com a função suspensa e na leitura', () => {
    it('o artefato diz o capítulo de cada questão (ou `null` sem seção), as habilidades da seção de cada origem e a suspensão da função', async () => {
      const id = await atividade()
      const conteudo = conteudoDeTeste(a.materialId)
      const semSecao = { ...conteudo, questoes: conteudo.questoes.map((questao, indice) => (indice === 4 ? { ...questao, citacao: { ...questao.citacao, pagina: 9 } } : questao)) }
      await sql('update artefato set conteudo = $2 where id = $1', [id, JSON.stringify(semSecao)])

      const lido = await ler(a.professora, id)
      expect(lido.classificacaoSuspensa).toBe(false)
      // As questões citam as páginas 1, 2, 3, 4 e 9: o capítulo 3, o capítulo 3, o capítulo 3, o bloco de páginas e a página que nenhuma seção tem.
      expect(lido.secoesDasQuestoes).toEqual([
        ...[0, 1, 2].map(() => ({ capitulo: { numero: 3, titulo: 'Reações químicas' }, paginaInicial: 1, paginaFinal: 3, habilidades: [{ codigo: 'EM13CNT101', origem: 'ia' }] })),
        { capitulo: null, paginaInicial: 4, paginaFinal: 6, habilidades: [{ codigo: ORIGINAL, origem: 'coordenacao' }] },
        null,
      ])

      await suspender(a)
      try {
        expect((await ler(a.professora, id)).classificacaoSuspensa).toBe(true)
      } finally {
        await retomar(a)
      }
      // O plano de aula não tem questão; o material de outra escola nunca entra.
      expect((await ler(a.professora, await criarPlanoDeAula(bancada, a))).secoesDasQuestoes).toEqual([])
      // O material da outra escola nunca entra: nenhuma seção da B traz o capítulo da A.
      const daB = await ler(b.professora, await atividade(b))
      expect(JSON.stringify(daB.secoesDasQuestoes)).not.toContain('Reações químicas')
    })

    it('a página que o `jsonb` cita de um material da outra escola não traz o capítulo dela, e o material excluído da própria escola deixa a questão sem capítulo', async () => {
      const id = await atividade()
      const conteudo = conteudoDeTeste(a.materialId)
      // A citação não tem chave estrangeira: o artefato da A, com a página 1 do material da B, que tem um capítulo próprio.
      await sql('delete from secao_do_material where escola_id = $1 and material_id = $2', [b.escolaId, b.materialId])
      await sql('delete from capitulo_do_material where escola_id = $1 and material_id = $2', [b.escolaId, b.materialId])
      await inserirSecao(b, 1, 1, 3, ['EM13CNT101', 'ia'], { numero: 9, titulo: 'Capítulo secreto da B' })
      const doutra = { ...conteudo, questoes: conteudo.questoes.map((questao) => ({ ...questao, citacao: { ...questao.citacao, materialId: b.materialId, pagina: 1 } })) }
      await sql('update artefato set conteudo = $2 where id = $1', [id, JSON.stringify(doutra)])
      try {
        // O material da B está pronto e não excluído: só a escola da A o deixa de fora (o controle de que o negativo abaixo não passa por outro motivo).
        expect((await sql<{ estado: string; excluido_em: Date | null }>('select estado, excluido_em from material where id = $1', [b.materialId])).rows[0]).toMatchObject({ estado: 'pronto', excluido_em: null })
        const lido = await ler(a.professora, id)
        expect(JSON.stringify(lido)).not.toContain('Capítulo secreto da B')
        expect(lido.secoesDasQuestoes.every((secao) => secao === null)).toBe(true)
      } finally {
        await sql('delete from secao_do_material where escola_id = $1 and material_id = $2', [b.escolaId, b.materialId])
        await sql('delete from capitulo_do_material where escola_id = $1 and material_id = $2', [b.escolaId, b.materialId])
      }

      // O material excluído da própria escola não dá capítulo: a questão cita a página, e a seção não vale mais.
      const propria = await atividade()
      expect((await ler(a.professora, propria)).secoesDasQuestoes[0]).not.toBeNull()
      // A escola tem outro material pronto: a seção do excluído não pode "pegar" o dele na junção (sem ele, o excluído seria o único e nada se distinguiria).
      await enviarMaterialDeDemonstracao(api, a, a.quimica, 'Segundo material da A', variacaoDoPdf())
      await sql('update material set excluido_em = now() where escola_id = $1 and id = $2', [a.escolaId, a.materialId])
      try {
        expect((await ler(a.professora, propria)).secoesDasQuestoes.every((secao) => secao === null)).toBe(true)
      } finally {
        await sql('update material set excluido_em = null where escola_id = $1 and id = $2', [a.escolaId, a.materialId])
      }
    })

    it('a lista da troca (as candidatas do recorte) é a mesma com a função suspensa: quem decide a prioridade é a tela, e a troca só vale pelo recorte', async () => {
      const id = await atividade()
      await suspender(a)
      try {
        expect((await trocar(a.professora, id, 0, NOVA)).status).toBe(200)
        const candidatas = (await chamar(api.url, 'GET', `/v1/habilidades-bncc?artefatoId=${id}`, await a.professora.tokenNovo())).corpo['itens'] as { codigo: string }[]
        expect(candidatas.map((candidata) => candidata.codigo)).toContain(OUTRA)
        expect((await trocar(a.professora, id, 1, OUTRA)).status).toBe(200)
      } finally {
        await retomar(a)
      }
      expect((await codigosDasQuestoes(id)).slice(0, 2)).toEqual([NOVA, OUTRA])
    })
  })

  describe('os tetos: 100 por hora por pessoa e 300 por escola', () => {
    const registrosJaFeitos = (escola: EscolaComAssistente, autorId: string, quantidade: number, idadeMs = 0) =>
      sql(
        `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, em)
         select $1, $2, 'artefato.habilidade_trocada', 'artefato', gen_random_uuid(), gen_random_uuid(), now() - ($4::int * interval '1 millisecond') from generate_series(1, $3::int)`,
        [escola.escolaId, autorId, quantidade, idadeMs],
      )
    const comRetryAfter = async (sessao: TestSessao, artefatoId: string, corpo: unknown) => {
      const resposta = await fetch(`${api.url}/v1/artefatos/${artefatoId}/questoes/0/habilidade`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${await sessao.tokenNovo()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const texto = await resposta.text()
      return { status: resposta.status, corpo: (texto === '' ? {} : JSON.parse(texto)) as RespostaHttp['corpo'], setCookie: [], retryAfter: resposta.headers.get('Retry-After') }
    }

    it('a 101ª troca da pessoa recebe 429 com o `Retry-After` da janela, antes de ler o corpo; as de mais de uma hora atrás não contam e a colega segue livre', async () => {
      const id = await atividade()
      const sessao = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, sessao.usuarioId, a.turma, a.quimica)
      await registrosJaFeitos(a, sessao.usuarioId, 150, JANELA_DA_TROCA_DE_HABILIDADE_MS + 60_000)
      await registrosJaFeitos(a, sessao.usuarioId, TROCAS_POR_USUARIO_NA_JANELA)
      const acima = await comRetryAfter(sessao, id, { codigo: 123 })
      expect(erroDe(acima)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect(acima.retryAfter).toBe(String(JANELA_DA_TROCA_DE_HABILIDADE_MS / 1_000))
      // Com 99 na janela, a 100ª passa (a conferência é "100 ou mais").
      await sql("delete from auditoria where escola_id = $1 and autor_usuario_id = $2 and acao = 'artefato.habilidade_trocada' and em > now() - interval '1 hour' and id in (select id from auditoria where escola_id = $1 and autor_usuario_id = $2 and acao = 'artefato.habilidade_trocada' and em > now() - interval '1 hour' limit 1)", [
        a.escolaId,
        sessao.usuarioId,
      ])
      expect(erroDe(await comRetryAfter(sessao, id, { codigo: NOVA }))).toEqual(naoEncontrado)
      expect((await trocar(a.professora, id, 0, NOVA)).status).toBe(200)
    })

    it('a 301ª troca da escola recebe 429 mesmo de quem não passou do próprio, e a outra escola segue livre', async () => {
      const id = await atividade()
      const daB = await atividade(b)
      for (let pessoa = 0; pessoa < 3; pessoa++) await registrosJaFeitos(a, (await bancada.sessao(a.escolaId, 'professor')).usuarioId, TROCAS_POR_ESCOLA_NA_JANELA / 3)
      const acima = await comRetryAfter(a.professora, id, { codigo: NOVA })
      expect(erroDe(acima)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect(acima.retryAfter).toBe(String(JANELA_DA_TROCA_DE_HABILIDADE_MS / 1_000))
      expect((await trocar(b.professora, daB, 0, NOVA)).status).toBe(200)
      expect((await codigosDasQuestoes(id))[0]).toBe(ORIGINAL)
      await sql("delete from auditoria where escola_id = $1 and acao = 'artefato.habilidade_trocada'", [a.escolaId])
    })
  })

  describe('as corridas: a trava do artefato é a mesma na troca, na aplicação e na adaptação', () => {
    it('P6a: a troca que chegou primeiro segura o artefato, a aplicação espera e aplica com a habilidade trocada', async () => {
      const id = await atividade()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'artefato', evento: 'update', quando: `new.id = '${id}'::uuid` })
      await parada.armar()
      try {
        const troca = trocar(a.professora, id, 0, NOVA)
        await parada.esperarParadas(1)
        const aplicacao = rotas().aplicar(a.professora, { artefatoId: id, turmaId: a.turma, avaliativa: false })
        expect(await situacaoDe(aplicacao), 'a aplicação tem de esperar a troca que chegou primeiro').toBe('esperando')
        await esperarNaTrava(bancada.pool, '%"artefato"%"entrega"%for update%')
        await parada.soltar()
        const [trocada, aplicada] = await Promise.all([troca, aplicacao])
        expect(trocada.status).toBe(200)
        expect(aplicada.status).toBe(201)
      } finally {
        await parada.desarmar()
      }
      expect((await codigosDasQuestoes(id))[0]).toBe(NOVA)
      expect((await sql('select 1 from atividade_aplicada where escola_id = $1 and artefato_id = $2', [a.escolaId, id])).rowCount).toBe(1)
    })

    it('P6b: a aplicação que chegou primeiro segura o artefato, a troca espera e recebe `CONFLITO`', async () => {
      const id = await atividade()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'atividade_aplicada', evento: 'insert', quando: `new.artefato_id = '${id}'::uuid` })
      await parada.armar()
      try {
        const aplicacao = rotas().aplicar(a.professora, { artefatoId: id, turmaId: a.turma, avaliativa: false })
        await parada.esperarParadas(1)
        const troca = trocar(a.professora, id, 0, NOVA)
        expect(await situacaoDe(troca), 'a troca tem de esperar a aplicação que chegou primeiro').toBe('esperando')
        await esperarNaTrava(bancada.pool, '%"artefato"%for update%')
        await parada.soltar()
        const [aplicada, trocada] = await Promise.all([aplicacao, troca])
        expect(aplicada.status).toBe(201)
        expect(erroDe(trocada)).toEqual(conflito)
      } finally {
        await parada.desarmar()
      }
      expect((await codigosDasQuestoes(id))[0]).toBe(ORIGINAL)
      expect(await totalDeTrocas()).toBe(0)
    })

    it('P7: duas trocas de questões diferentes ao mesmo tempo ficam as duas, uma depois da outra, com duas auditorias', async () => {
      const id = await atividade()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'artefato', evento: 'update', quando: `new.id = '${id}'::uuid` })
      await parada.armar()
      try {
        const primeira = trocar(a.professora, id, 0, NOVA)
        await parada.esperarParadas(1)
        const segunda = trocar(a.professora, id, 1, OUTRA)
        expect(await situacaoDe(segunda), 'a segunda troca tem de esperar a primeira').toBe('esperando')
        await esperarNaTrava(bancada.pool, '%"artefato"%for update%')
        await parada.soltar()
        expect((await Promise.all([primeira, segunda])).map((resposta) => resposta.status)).toEqual([200, 200])
      } finally {
        await parada.desarmar()
      }
      expect((await codigosDasQuestoes(id)).slice(0, 3)).toEqual([NOVA, OUTRA, ORIGINAL])
      expect((await trocasAuditadas()).map((registro) => registro.depois)).toEqual([
        { indice: 0, codigo: NOVA },
        { indice: 1, codigo: OUTRA },
      ])
    })

    // A parada `before` segura a adaptação com o original já lido e a versão ainda não inserida: é onde só a trava da adaptação protege (a chave estrangeira da versão ainda não existe). A `after` a segura com a versão inserida,
    // onde a chave estrangeira da versão também barra a troca. Cada parada tira uma das duas defesas do caminho.
    it.each(['before', 'after'] as const)('P8 (parada %s do insert): a adaptação que chegou primeiro segura o artefato, a troca espera e recebe `CONFLITO`; a versão repete a habilidade do original', async (momento) => {
      const id = await atividade()
      const servicos = adaptacao()
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'artefato', evento: 'insert', quando: `new.origem_id = '${id}'::uuid`, momento })
      await parada.armar()
      let execucaoId: string
      let trocada: RespostaHttp
      try {
        execucaoId = (await comoPessoa(a, a.professora, 'professor', () => servicos.adaptar(id, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }))).execucaoId
        await parada.esperarParadas(1)
        const troca = trocar(a.professora, id, 0, NOVA)
        expect(await situacaoDe(troca), 'a troca tem de esperar a adaptação que chegou primeiro').toBe('esperando')
        await esperarNaTrava(bancada.pool, '%"artefato"%for update%')
        await parada.soltar()
        trocada = await troca
      } finally {
        await parada.desarmar()
      }
      expect(erroDe(trocada)).toEqual(conflito)
      expect((await execucaoTerminada(api, a.professora, execucaoId)).estado).toBe('concluida')
      const versao = (await ler(a.professora, id)).versoesAdaptadas[0]
      expect(versao).toBeDefined()
      expect((await codigosDasQuestoes(versao?.id ?? ''))[0]).toBe(ORIGINAL)
      expect((await codigosDasQuestoes(id))[0]).toBe(ORIGINAL)
      expect(await totalDeTrocas()).toBe(0)
    })

    it('a troca que chegou antes da adaptação vale na versão: a conferência de fidelidade lê o original já trocado', async () => {
      const id = await atividade()
      expect((await trocar(a.professora, id, 0, NOVA)).status).toBe(200)
      const servicos = adaptacao()
      const { execucaoId } = await comoPessoa(a, a.professora, 'professor', () => servicos.adaptar(id, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }))
      expect((await execucaoTerminada(api, a.professora, execucaoId)).estado).toBe('concluida')
      const versao = (await ler(a.professora, id)).versoesAdaptadas[0]
      expect((await codigosDasQuestoes(versao?.id ?? ''))[0]).toBe(NOVA)
    })
  })
})
