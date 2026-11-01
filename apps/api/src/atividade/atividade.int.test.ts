import { atividadeAplicadaResponseSchema, atividadeEncerradaResponseSchema, listaDeAtividadesAplicadasResponseSchema, minhasAtividadesResponseSchema, provaResponseSchema, questaoSalvaResponseSchema } from '@educa/shared'
import { PASTA_MIGRACOES } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { subirApi, type TestApi, type RespostaHttp } from '../../test/test-api.js'
import {
  alunosComSessao,
  aplicarAtividade,
  conteudoDeTeste,
  criarAtividade,
  criarPlanoDeAula,
  criarVersaoAdaptada,
  encerrarAtividade,
  EXPLICACAO_DE_TESTE,
  GABARITO_DE_TESTE,
  responderProva,
  rotasDaAtividade,
  type RotasDaAtividade,
} from '../../test/atividade.fixture.js'
import { montarEscolaComAssistente, NOME_DO_ALUNO_DE_TESTE, type EscolaComAssistente } from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'

/**
 * A atividade aplicada, do aplicar ao encerrar, e o lado do aluno (MVP, A3), com a API montada pelo `AppModule` e o
 * Postgres do compose de teste. O artefato é gravado direto, com gabarito conhecido; tudo o mais passa pelas rotas.
 * O isolamento entre escolas, turmas e disciplinas está em `atividade-isolamento.int.test.ts`; a correção, os destaques
 * e a validação do lote, em `correcao.int.test.ts`.
 */
describe('atividade aplicada', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let bia: TestSessao

  const sql = async <Linha extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Linha[]> => (await bancada.pool.query(texto, valores)).rows as Linha[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const contar = async (tabela: string, filtro: string, valores: unknown[]): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where ${filtro}`, valores))[0]?.total)
  const respostasDe = (atividadeId: string, alunoId: string) =>
    sql<{ questao: number; alternativa: number }>('select questao, alternativa from resposta_atividade where atividade_aplicada_id = $1 and aluno_id = $2 order by questao', [atividadeId, alunoId])
  const correcoesDa = (atividadeId: string) =>
    sql<{ id: string; aluno_id: string; acertos: number; total: number; em_branco: number; por_habilidade: unknown; destaques: string[]; corrigida_em: Date }>(
      'select id, aluno_id, acertos, total, em_branco, por_habilidade, destaques, corrigida_em from correcao where atividade_aplicada_id = $1 order by aluno_id',
      [atividadeId],
    )
  const lotesDa = (atividadeId: string) => sql<{ id: string; estado: string; funcao: string; tipo: string; decidida_por: string | null; execucao_id: string | null }>('select id, estado, funcao, tipo, decidida_por, execucao_id from entrega where atividade_aplicada_id = $1 order by id', [atividadeId])
  /** Uma atividade nova, aplicada ao 2ºB pela professora, com título próprio (uma aberta por turma e artefato). */
  const aplicada = async (avaliativa = false): Promise<string> => aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a, { conteudo: conteudoDeTeste(a.materialId, `Lista sintética ${randomUUID()}`) }), a.turma, avaliativa)

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    ;[bia] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Bia Souza'])) as [TestSessao]
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
  })

  describe('aplicar', () => {
    it('a professora aplica a atividade objetiva à turma dela: nasce aberta, com quem aplicou na linha e na auditoria, e só contagem de participação', async () => {
      const artefatoId = await criarAtividade(bancada, a)
      const resposta = await rotas.aplicar(a.professora, { artefatoId, turmaId: a.turma, avaliativa: true })
      expect(resposta.status).toBe(201)
      const criada = atividadeAplicadaResponseSchema.parse(resposta.corpo)
      expect(criada).toMatchObject({ artefatoId, turmaId: a.turma, avaliativa: true, estado: 'aberta', questoes: 5, encerradaEm: null, entrega: null, participacao: { alunos: 2, iniciaram: 0, enviaram: 0 } })

      expect(await sql('select aplicada_por, estado from atividade_aplicada where id = $1', [criada.id])).toEqual([{ aplicada_por: a.professora.usuarioId, estado: 'aberta' }])
      expect(await sql(`select entidade, autor_usuario_id, depois from auditoria where acao = 'atividade.aplicada' and entidade_id = $1`, [criada.id])).toEqual([
        { entidade: 'atividade_aplicada', autor_usuario_id: a.professora.usuarioId, depois: { artefatoId, turmaId: a.turma, avaliativa: true, versaoAdaptada: false } },
      ])
    })

    it('a mesma atividade aberta duas vezes na mesma turma é CONFLITO, e dois cliques ao mesmo tempo gravam uma aplicação e uma auditoria', async () => {
      const artefatoId = await criarAtividade(bancada, a)
      const corpo = { artefatoId, turmaId: a.turma, avaliativa: false }
      const simultaneas = await Promise.all([rotas.aplicar(a.professora, corpo), rotas.aplicar(a.professora, corpo)])
      expect(simultaneas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      expect(erro(await rotas.aplicar(a.professora, corpo))).toEqual({ status: 409, codigo: 'CONFLITO' })
      expect(await contar('atividade_aplicada', 'artefato_id = $1', [artefatoId])).toBe(1)
      expect(await contar('auditoria', `acao = 'atividade.aplicada' and depois ->> 'artefatoId' = $1`, [artefatoId])).toBe(1)
    })

    it('só atividade objetiva se aplica: o plano de aula é recusado, e nada é gravado', async () => {
      const planoId = await criarPlanoDeAula(bancada, a)
      expect(erro(await rotas.aplicar(a.professora, { artefatoId: planoId, turmaId: a.turma, avaliativa: false }))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      expect(await contar('atividade_aplicada', 'artefato_id = $1', [planoId])).toBe(0)
    })

    it('a versão adaptada pendente e a rejeitada não chegam à turma (VERSAO_ADAPTADA_NAO_APROVADA, sem linha e sem auditoria); a aprovada se aplica', async () => {
      const origemId = await criarAtividade(bancada, a)
      for (const estado of ['pendente', 'rejeitada'] as const) {
        const adaptadaId = await criarVersaoAdaptada(bancada, a, origemId, estado)
        expect(erro(await rotas.aplicar(a.professora, { artefatoId: adaptadaId, turmaId: a.turma, avaliativa: false }))).toEqual({ status: 409, codigo: 'VERSAO_ADAPTADA_NAO_APROVADA' })
        expect(await contar('atividade_aplicada', 'artefato_id = $1', [adaptadaId])).toBe(0)
        expect(await contar('auditoria', `acao = 'atividade.aplicada' and depois ->> 'artefatoId' = $1`, [adaptadaId])).toBe(0)
      }
      const aprovadaId = await criarVersaoAdaptada(bancada, a, origemId, 'aprovada')
      const resposta = await rotas.aplicar(a.professora, { artefatoId: aprovadaId, turmaId: a.turma, avaliativa: false })
      expect(resposta.status).toBe(201)
      expect(await sql(`select depois -> 'versaoAdaptada' as adaptada from auditoria where acao = 'atividade.aplicada' and entidade_id = $1`, [resposta.corpo['id']])).toEqual([{ adaptada: true }])
      // A prova da versão adaptada diz só os tipos da adaptação, que valem para a turma: nada sobre aluno (D35).
      const prova = provaResponseSchema.parse((await rotas.prova(a.aluno, resposta.corpo['id'] as string)).corpo)
      expect(prova.adaptacao).toEqual({ tipos: ['fonte_ampliada'] })
    })

    it('escola, ano, pessoa ou estado no corpo são ENTRADA_INVALIDA: o escopo vem da sessão', async () => {
      const artefatoId = await criarAtividade(bancada, a)
      const corpo = { artefatoId, turmaId: a.turma, avaliativa: false }
      for (const aMais of [{ escolaId: a.escolaId }, { anoLetivoId: a.anoLetivoId }, { aplicadaPor: a.colega.usuarioId }, { estado: 'encerrada' }]) {
        expect(erro(await rotas.aplicar(a.professora, { ...corpo, ...aMais }))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      expect(await contar('atividade_aplicada', 'artefato_id = $1', [artefatoId])).toBe(0)
    })

    it('a listagem da turma é paginada, da mais nova para a mais antiga, e exige a turma', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const ids: string[] = []
      for (let i = 0; i < 3; i++) ids.push(await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma))
      const primeira = listaDeAtividadesAplicadasResponseSchema.parse((await rotas.listar(c.professora, `?turmaId=${c.turma}&limite=2`)).corpo)
      expect(primeira.itens.map((item) => item.id)).toEqual([ids[2], ids[1]])
      expect(primeira.proxima).toBe(ids[1])
      const segunda = listaDeAtividadesAplicadasResponseSchema.parse((await rotas.listar(c.professora, `?turmaId=${c.turma}&limite=2&pagina=${String(primeira.proxima)}`)).corpo)
      expect(segunda).toEqual({ itens: [expect.objectContaining({ id: ids[0] })] })
      expect(erro(await rotas.listar(c.professora, ''))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      expect(erro(await rotas.listar(c.professora, `?turmaId=${c.turma}&limite=101`))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
    })
  })

  describe('o aluno responde', () => {
    it('a prova traz número, enunciado e alternativas, e nada do gabarito, da explicação, da habilidade nem da citação', async () => {
      const id = await aplicada()
      const resposta = await rotas.prova(a.aluno, id)
      expect(resposta.status).toBe(200)
      const prova = provaResponseSchema.parse(resposta.corpo)
      expect(prova).toMatchObject({ atividadeAplicadaId: id, estado: 'aberta', adaptacao: null, respostas: [], enviadaEm: null })
      expect(prova.questoes).toHaveLength(5)
      for (const questao of prova.questoes) expect(Object.keys(questao).sort()).toEqual(['alternativas', 'enunciado', 'numero'])
      const texto = JSON.stringify(resposta.corpo)
      for (const proibido of ['gabarito', 'explicacao', EXPLICACAO_DE_TESTE, 'habilidade', 'QUI.EM', 'citacao', 'correta', 'acertos']) expect(texto).not.toContain(proibido)
    })

    it('abrir a prova cria a tentativa do aluno, uma só, mesmo em duas abas ao mesmo tempo', async () => {
      const id = await aplicada()
      await Promise.all([rotas.prova(a.aluno, id), rotas.prova(a.aluno, id), rotas.prova(a.aluno, id)])
      await rotas.prova(a.aluno, id)
      expect(await sql('select aluno_id, enviada_em from tentativa_atividade where atividade_aplicada_id = $1', [id])).toEqual([{ aluno_id: a.aluno.usuarioId, enviada_em: null }])
    })

    it('a lista do aluno acompanha a situação (para fazer, em andamento, enviada) e nunca diz como ele foi', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma, true)
      const lista = async () => minhasAtividadesResponseSchema.parse((await rotas.minhas(c.aluno)).corpo)
      expect((await lista()).itens).toEqual([expect.objectContaining({ id, situacao: 'para_fazer', avaliativa: true, questoes: 5, respondidas: 0, enviadaEm: null, disciplina: { id: c.quimica, nome: 'Química' } })])
      await responderProva(rotas, c.aluno, id, [0, 1, null, null, null], false)
      expect((await lista()).itens).toEqual([expect.objectContaining({ situacao: 'em_andamento', respondidas: 2, enviadaEm: null })])
      await rotas.enviar(c.aluno, id)
      const enviada = await rotas.minhas(c.aluno)
      expect(minhasAtividadesResponseSchema.parse(enviada.corpo).itens).toEqual([expect.objectContaining({ situacao: 'enviada', respondidas: 2 })])
      for (const proibido of ['acertos', 'gabarito', 'correta', 'explicacao', 'destaque', 'media']) expect(JSON.stringify(enviada.corpo)).not.toContain(proibido)
    })

    it('a resposta é gravada de forma idempotente: a mesma questão duas vezes, e cinco ao mesmo tempo depois da queda de rede, é uma linha só, com a última alternativa', async () => {
      const id = await aplicada()
      await rotas.prova(a.aluno, id)
      const primeira = await rotas.responder(a.aluno, id, 2, 1)
      expect(primeira.status).toBe(200)
      expect(primeira.corpo).toMatchObject({ questao: 2, alternativa: 1 })
      expect(Object.keys(primeira.corpo).sort()).toEqual(['alternativa', 'questao', 'respondidaEm', 'sequencia'])
      expect((await rotas.responder(a.aluno, id, 2, 1)).status).toBe(200)
      expect(await respostasDe(id, a.aluno.usuarioId)).toEqual([{ questao: 2, alternativa: 1 }])

      const reenvios = await Promise.all(Array.from({ length: 5 }, () => rotas.responder(a.aluno, id, 2, 3)))
      expect(reenvios.map((resposta) => resposta.status)).toEqual([200, 200, 200, 200, 200])
      expect(await respostasDe(id, a.aluno.usuarioId)).toEqual([{ questao: 2, alternativa: 3 }])
      // A prova reaberta devolve o que ficou salvo, para o aluno continuar de onde parou.
      // (cliente antigo, sem `sequencia`: cada um dos 2 + 5 envios subiu a escala em 1)
      expect(provaResponseSchema.parse((await rotas.prova(a.aluno, id)).corpo).respostas).toEqual([{ questao: 2, alternativa: 3, sequencia: 7 }])
    })

    // 51.1, caracterização: o que o cliente antigo (sem `sequencia`) faz tem de continuar valendo depois da 51.0.
    it('caracterização: cinco reenvios iguais ao mesmo tempo são uma linha só, e trocar a alternativa troca a gravada', async () => {
      const id = await aplicada()
      await rotas.prova(a.aluno, id)
      const iguais = await Promise.all(Array.from({ length: 5 }, () => rotas.responder(a.aluno, id, 3, 2)))
      expect(iguais.map((resposta) => resposta.status)).toEqual([200, 200, 200, 200, 200])
      for (const resposta of iguais) expect(resposta.corpo).toMatchObject({ questao: 3, alternativa: 2 })
      expect(await respostasDe(id, a.aluno.usuarioId)).toEqual([{ questao: 3, alternativa: 2 }])
      expect((await rotas.responder(a.aluno, id, 3, 0)).corpo).toMatchObject({ questao: 3, alternativa: 0 })
      expect(await respostasDe(id, a.aluno.usuarioId)).toEqual([{ questao: 3, alternativa: 0 }])
    })

    describe('só a escolha mais nova vale (51.0, RF21)', () => {
      const caminho = (id: string, questao: number) => `/v1/atividades-aplicadas/${id}/respostas/${String(questao)}`
      /** O `PUT` como o cliente novo o manda: a alternativa e a ordem dela. */
      const responderComSequencia = (aluno: TestSessao, id: string, questao: number, alternativa: number, sequencia: number) => rotas.pedir(aluno, 'PUT', caminho(id, questao), { alternativa, sequencia })
      const gravadasDe = (id: string, alunoId: string) =>
        sql<{ questao: number; alternativa: number; sequencia: number; respondida_em: Date }>('select questao, alternativa, sequencia::int as sequencia, respondida_em from resposta_atividade where atividade_aplicada_id = $1 and aluno_id = $2 order by questao', [id, alunoId])
      /** Um aluno por caso: o limite é de 120 requisições por minuto por usuário, e o das vinte repetições gasta 41. */
      let alunos: TestSessao[]
      beforeAll(async () => {
        alunos = await alunosComSessao(bancada, a, a.turma, Array.from({ length: 11 }, (_, i) => `Aluno sintético da sequência ${String(i + 1)}`))
      })
      const dessaForma = (resposta: RespostaHttp) => questaoSalvaResponseSchema.parse(resposta.corpo)

      it('5 e 7 ao mesmo tempo, nas duas ordens, deixam a 7: vinte repetições, e a prova reaberta devolve a alternativa e a sequência gravadas', async () => {
        const aluno = alunos[0] as TestSessao
        const id = await aplicada()
        await rotas.prova(aluno, id)
        for (let repeticao = 0; repeticao < 20; repeticao++) {
          const base = repeticao * 10
          const pedidos = [responderComSequencia(aluno, id, 1, 1, base + 5), responderComSequencia(aluno, id, 1, 2, base + 7)]
          const respostas = await Promise.all(repeticao % 2 === 0 ? pedidos : pedidos.reverse())
          expect(respostas.map((resposta) => resposta.status), `repetição ${String(repeticao)}`).toEqual([200, 200])
          expect(await gravadasDe(id, aluno.usuarioId), `repetição ${String(repeticao)}`).toMatchObject([{ questao: 1, alternativa: 2, sequencia: base + 7 }])
        }
        expect(provaResponseSchema.parse((await rotas.prova(aluno, id)).corpo).respostas).toEqual([{ questao: 1, alternativa: 2, sequencia: 197 }])
      })

      it('a 5 que chega depois da 7 responde 200 com a 7 gravada (alternativa e sequência), e nada muda no banco', async () => {
        const aluno = alunos[1] as TestSessao
        const id = await aplicada()
        await rotas.prova(aluno, id)
        const sete = await responderComSequencia(aluno, id, 2, 3, 7)
        expect(dessaForma(sete)).toMatchObject({ questao: 2, alternativa: 3, sequencia: 7 })
        const [antes] = await gravadasDe(id, aluno.usuarioId)
        const cinco = await responderComSequencia(aluno, id, 2, 0, 5)
        expect(cinco.status).toBe(200)
        expect(dessaForma(cinco)).toEqual({ questao: 2, alternativa: 3, sequencia: 7, respondidaEm: antes?.respondida_em.toISOString() })
        expect(await gravadasDe(id, aluno.usuarioId)).toEqual([antes])
      })

      it('a mesma sequência com outra alternativa não troca a gravada (duas abas que leram a mesma): a segunda recebe a da primeira; o reenvio igual devolve a mesma', async () => {
        const aluno = alunos[2] as TestSessao
        const id = await aplicada()
        await rotas.prova(aluno, id)
        await responderComSequencia(aluno, id, 1, 1, 6)
        expect(dessaForma(await responderComSequencia(aluno, id, 1, 3, 6))).toMatchObject({ alternativa: 1, sequencia: 6 })
        const iguais = await Promise.all(Array.from({ length: 5 }, () => responderComSequencia(aluno, id, 1, 1, 6)))
        for (const resposta of iguais) expect(dessaForma(resposta)).toMatchObject({ alternativa: 1, sequencia: 6 })
        expect(await gravadasDe(id, aluno.usuarioId)).toMatchObject([{ questao: 1, alternativa: 1, sequencia: 6 }])
      })

      it('a mesma sequência com outra alternativa, ao mesmo tempo: uma vence, e as duas respostas são iguais à linha gravada', async () => {
        const aluno = alunos[10] as TestSessao
        const id = await aplicada()
        await rotas.prova(aluno, id)
        const [um, outro] = await Promise.all([responderComSequencia(aluno, id, 1, 1, 6), responderComSequencia(aluno, id, 1, 3, 6)])
        const [gravada] = await gravadasDe(id, aluno.usuarioId)
        expect(gravada).toMatchObject({ questao: 1, sequencia: 6 })
        expect([1, 3]).toContain(gravada?.alternativa)
        const esperada = { questao: 1, alternativa: gravada?.alternativa, sequencia: 6, respondidaEm: gravada?.respondida_em.toISOString() }
        expect((um as RespostaHttp).status).toBe(200)
        expect((outro as RespostaHttp).status).toBe(200)
        expect(dessaForma(um as RespostaHttp)).toEqual(esperada)
        expect(dessaForma(outro as RespostaHttp)).toEqual(esperada)
        expect(await gravadasDe(id, aluno.usuarioId)).toHaveLength(1)
      })

      it('quem perde numa questão recebe a gravada daquela questão e daquele aluno, nunca a de outra questão nem a de um colega', async () => {
        const aluno = alunos[3] as TestSessao
        const id = await aplicada()
        await rotas.prova(aluno, id)
        await responderComSequencia(bia, id, 2, 0, 90)
        await responderComSequencia(aluno, id, 1, 3, 40)
        await responderComSequencia(aluno, id, 2, 1, 50)
        const perdeu = await responderComSequencia(aluno, id, 2, 2, 10)
        const propria = (await gravadasDe(id, aluno.usuarioId)).find((linha) => linha.questao === 2)
        expect(dessaForma(perdeu)).toEqual({ questao: 2, alternativa: 1, sequencia: 50, respondidaEm: propria?.respondida_em.toISOString() })
      })

      it('cliente antigo (sem sequência) e depois o novo com servidor + 1: o novo vence, e o antigo sobe a sequência em 1', async () => {
        const aluno = alunos[4] as TestSessao
        const id = await aplicada()
        await rotas.prova(aluno, id)
        expect(dessaForma(await rotas.responder(aluno, id, 4, 0))).toMatchObject({ alternativa: 0, sequencia: 1 })
        expect(dessaForma(await rotas.responder(aluno, id, 4, 1))).toMatchObject({ alternativa: 1, sequencia: 2 })
        const novo = await responderComSequencia(aluno, id, 4, 2, 3)
        expect(dessaForma(novo)).toMatchObject({ alternativa: 2, sequencia: 3 })
        expect(dessaForma(await rotas.responder(aluno, id, 4, 3))).toMatchObject({ alternativa: 3, sequencia: 4 })
        // O cliente novo que ainda estava em 3 perde para o antigo, que subiu a sequência.
        expect(dessaForma(await responderComSequencia(aluno, id, 4, 0, 3))).toMatchObject({ alternativa: 3, sequencia: 4 })
        expect(await gravadasDe(id, aluno.usuarioId)).toMatchObject([{ questao: 4, alternativa: 3, sequencia: 4 }])
      })

      it('sequência negativa, fracionária, texto ou nula, ou uma chave a mais, é ENTRADA_INVALIDA, e nada é gravado', async () => {
        const aluno = alunos[5] as TestSessao
        const id = await aplicada()
        await rotas.prova(aluno, id)
        for (const corpo of [{ alternativa: 1, sequencia: -1 }, { alternativa: 1, sequencia: 1.5 }, { alternativa: 1, sequencia: '3' }, { alternativa: 1, sequencia: null }, { alternativa: 1, sequencia: 1, alunoId: bia.usuarioId }, { alternativa: 1, sequencia: 1, escolaId: a.escolaId }]) {
          expect(erro(await rotas.pedir(aluno, 'PUT', caminho(id, 1), corpo)), JSON.stringify(corpo)).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
        }
        expect(await gravadasDe(id, aluno.usuarioId)).toEqual([])
        expect(await gravadasDe(id, bia.usuarioId)).toEqual([])
        // O zero é a escala da linha anterior à coluna: vale.
        expect(dessaForma(await responderComSequencia(aluno, id, 1, 1, 0))).toMatchObject({ alternativa: 1, sequencia: 0 })
      })

      it('o aluno de A com a atividade de B recebe o mesmo 404 do inexistente, e nenhuma sequência de B muda', async () => {
        const aluno = alunos[6] as TestSessao
        const b = await montarEscolaComAssistente(api, bancada)
        const deB = await aplicarAtividade(rotas, b.professora, await criarAtividade(bancada, b), b.turma)
        await rotas.prova(b.aluno, deB)
        await responderComSequencia(b.aluno, deB, 1, 2, 5)
        const [antes] = await gravadasDe(deB, b.aluno.usuarioId)
        const inexistente = erro(await responderComSequencia(aluno, randomUUID(), 1, 0, 9))
        expect(inexistente).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
        expect(erro(await responderComSequencia(aluno, deB, 1, 0, 9))).toEqual(inexistente)
        expect(await gravadasDe(deB, b.aluno.usuarioId)).toEqual([antes])
        expect(await gravadasDe(deB, aluno.usuarioId)).toEqual([])
      })

      it('depois do envio, ATIVIDADE_ENCERRADA com qualquer sequência, e o que estava salvo não muda', async () => {
        const aluno = alunos[7] as TestSessao
        const id = await aplicada()
        await rotas.prova(aluno, id)
        await responderComSequencia(aluno, id, 1, 2, 5)
        await rotas.enviar(aluno, id)
        for (const sequencia of [0, 5, 6, 1000]) expect(erro(await responderComSequencia(aluno, id, 1, 0, sequencia)), String(sequencia)).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
        expect(erro(await rotas.responder(aluno, id, 1, 0))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
        expect(await gravadasDe(id, aluno.usuarioId)).toMatchObject([{ questao: 1, alternativa: 2, sequencia: 5 }])
      })

      it('a migration 0037 aplicada sobre linhas antigas deixa todas com sequência 0 (e o cliente antigo, a partir delas, sobe para 1)', async () => {
        const aluno = alunos[8] as TestSessao
        // O texto do arquivo da migration, aplicado a uma tabela de rascunho que já tem linhas: é ele que o `migrate` roda no banco da escola.
        const migration = readFileSync(join(PASTA_MIGRACOES, '0037_sequencia_da_resposta.sql'), 'utf8')
        const cliente = await bancada.pool.connect()
        try {
          // Nome fixo, então limpa o que uma execução morta entre o `create` e o `drop` possa ter deixado.
          await cliente.query('drop schema if exists rascunho_0037 cascade')
          await cliente.query('create schema rascunho_0037')
          await cliente.query('set search_path to rascunho_0037')
          await cliente.query('create table resposta_atividade (id serial primary key, questao smallint not null, alternativa smallint not null)')
          await cliente.query('insert into resposta_atividade (questao, alternativa) values (1, 0), (2, 3), (3, 1)')
          await cliente.query(migration)
          const { rows } = await cliente.query<{ sequencia: string }>('select sequencia::text from resposta_atividade order by id')
          expect(rows).toEqual([{ sequencia: '0' }, { sequencia: '0' }, { sequencia: '0' }])
          await expect(cliente.query('insert into resposta_atividade (questao, alternativa, sequencia) values (4, 0, null)')).rejects.toThrow(/null value/)
        } finally {
          await cliente.query('set search_path to public')
          await cliente.query('drop schema if exists rascunho_0037 cascade')
          cliente.release()
        }
        // E no banco de verdade: a linha sem `sequencia` nasce em 0, a prova a devolve assim, e o cliente antigo a leva a 1.
        const id = await aplicada()
        await rotas.prova(aluno, id)
        await sql(
          `insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa)
           select escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, 5, 2 from tentativa_atividade where atividade_aplicada_id = $1 and aluno_id = $2`,
          [id, aluno.usuarioId],
        )
        expect(provaResponseSchema.parse((await rotas.prova(aluno, id)).corpo).respostas).toEqual([{ questao: 5, alternativa: 2, sequencia: 0 }])
        expect(dessaForma(await rotas.responder(aluno, id, 5, 3))).toMatchObject({ alternativa: 3, sequencia: 1 })
      })
    })

    it('a questão que a atividade não tem responde como inexistente, e a alternativa fora de 0 a 3 ou um campo a mais, ENTRADA_INVALIDA; nada é gravado', async () => {
      const id = await aplicada()
      await rotas.prova(a.aluno, id)
      // O `coerce` sozinho aceitaria `0x3`, `+3` e `001` como a questão 3, 3 e 1: o caminho só tem um ou dois dígitos.
      for (const questao of [6, 0, 21, 'abc', '1.5', '-1', '0x3', '+3', '001']) expect(erro(await rotas.responder(a.aluno, id, questao, 0))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      expect(erro(await rotas.responder(a.aluno, id, 1, 4))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      for (const corpo of [{ alternativa: 0, correta: true }, { alternativa: 0, alunoId: bia.usuarioId }, {}]) {
        expect(erro(await rotas.pedir(a.aluno, 'PUT', `/v1/atividades-aplicadas/${id}/respostas/1`, corpo))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      expect(await respostasDe(id, a.aluno.usuarioId)).toEqual([])
      expect(await respostasDe(id, bia.usuarioId)).toEqual([])
    })

    it('o corpo fora do contrato não apaga nem troca a resposta que já estava salva: ENTRADA_INVALIDA, e a gravada continua (17.0)', async () => {
      const id = await aplicada()
      await rotas.prova(a.aluno, id)
      expect((await rotas.responder(a.aluno, id, 2, 1)).status).toBe(200)
      for (const corpo of [{ alternativa: 4 }, { alternativa: 3, correta: true }, { alternativa: 'a' }, {}]) {
        expect(erro(await rotas.pedir(a.aluno, 'PUT', `/v1/atividades-aplicadas/${id}/respostas/2`, corpo)), JSON.stringify(corpo)).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      expect(await respostasDe(id, a.aluno.usuarioId)).toEqual([{ questao: 2, alternativa: 1 }])
    })

    it('enviar sem corpo nenhum vale como corpo vazio e envia; com um campo a mais é ENTRADA_INVALIDA e não envia (17.0)', async () => {
      const id = await aplicada()
      await responderProva(rotas, a.aluno, id, [0, 1], false)
      expect(erro(await rotas.pedir(a.aluno, 'POST', `/v1/atividades-aplicadas/${id}/enviar`, { forcar: true }))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      // Não enviou: a atividade segue aberta para ele.
      expect((await rotas.responder(a.aluno, id, 3, 2)).status).toBe(200)
      const enviada = await rotas.pedir(a.aluno, 'POST', `/v1/atividades-aplicadas/${id}/enviar`)
      expect(enviada.status).toBe(200)
      expect(enviada.corpo).toMatchObject({ respondidas: 3, questoes: 5 })
      expect(erro(await rotas.responder(a.aluno, id, 4, 0))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
    })

    it('depois de enviar, a resposta é recusada (ATIVIDADE_ENCERRADA) e o que estava salvo não muda; enviar de novo devolve o mesmo', async () => {
      const id = await aplicada()
      await responderProva(rotas, a.aluno, id, [0, 1, 2], false)
      const enviada = await rotas.enviar(a.aluno, id)
      expect(enviada.status).toBe(200)
      expect(enviada.corpo).toMatchObject({ respondidas: 3, questoes: 5 })

      expect(erro(await rotas.responder(a.aluno, id, 1, 3))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      expect(erro(await rotas.responder(a.aluno, id, 4, 3))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      expect(await respostasDe(id, a.aluno.usuarioId)).toEqual([
        { questao: 1, alternativa: 0 },
        { questao: 2, alternativa: 1 },
        { questao: 3, alternativa: 2 },
      ])
      const deNovo = await rotas.enviar(a.aluno, id)
      expect(deNovo.status).toBe(200)
      expect(deNovo.corpo).toEqual(enviada.corpo)
      // O envio de um aluno não fecha a atividade para a colega.
      expect((await rotas.responder(bia, id, 1, 0)).status).toBe(200)
    })

    it('depois de encerrada, a resposta e o envio são recusados (ATIVIDADE_ENCERRADA), e quem não abriu continua sem tentativa', async () => {
      const id = await aplicada()
      await responderProva(rotas, a.aluno, id, [0], false)
      await encerrarAtividade(rotas, a.professora, id)

      expect(erro(await rotas.responder(a.aluno, id, 2, 1))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      expect(erro(await rotas.enviar(a.aluno, id))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      expect(await respostasDe(id, a.aluno.usuarioId)).toEqual([{ questao: 1, alternativa: 0 }])

      // A colega que faltou abre a atividade já encerrada: vê as questões, sem gabarito, e não ganha tentativa.
      const prova = await rotas.prova(bia, id)
      expect(provaResponseSchema.parse(prova.corpo)).toMatchObject({ estado: 'encerrada', respostas: [], enviadaEm: null })
      expect(JSON.stringify(prova.corpo)).not.toContain('gabarito')
      expect(erro(await rotas.responder(bia, id, 1, 0))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      expect(await contar('tentativa_atividade', 'atividade_aplicada_id = $1 and aluno_id = $2', [id, bia.usuarioId])).toBe(0)
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(bia)).corpo).itens.find((item) => item.id === id)).toMatchObject({ situacao: 'encerrada', respondidas: 0 })
    })

    it('o aluno que chega à turma depois de a atividade aberta a encontra na lista e responde', async () => {
      const id = await aplicada()
      const [novato] = (await alunosComSessao(bancada, a, a.turma, ['Aluno Sintético que chegou em maio'])) as [TestSessao]
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(novato)).corpo).itens.find((item) => item.id === id)).toMatchObject({ situacao: 'para_fazer' })
      await responderProva(rotas, novato, id, [...GABARITO_DE_TESTE])
      expect(await respostasDe(id, novato.usuarioId)).toHaveLength(5)
    })

    it('trinta e cinco alunos do mesmo IP respondem ao mesmo tempo, e nenhum é recusado por limite', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const turma = await alunosComSessao(bancada, c, c.turma, Array.from({ length: 35 }, (_, i) => `Aluno sintético ${String(i + 1)}`))
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma)
      const respostas = await Promise.all(turma.map(async (aluno) => [await rotas.prova(aluno, id), await rotas.responder(aluno, id, 1, 0), await rotas.enviar(aluno, id)]))
      expect(new Set(respostas.flat().map((resposta) => resposta.status))).toEqual(new Set([200]))
      expect(await contar('resposta_atividade', 'atividade_aplicada_id = $1', [id])).toBe(35)
      expect(await contar('tentativa_atividade', 'atividade_aplicada_id = $1 and enviada_em is not null', [id])).toBe(35)
    })
  })

  describe('encerrar corrige', () => {
    it('compara com o gabarito, grava a correção de cada tentativa e cria o lote pendente; quem faltou não tem correção, e nada aprova', async () => {
      const id = await aplicada()
      // Caio acerta 4 de 5; Bia abre a prova e não responde nada (em branco). Ninguém mais abriu.
      await responderProva(rotas, a.aluno, id, [0, 1, 2, 3, 1])
      await rotas.prova(bia, id)

      const resposta = await rotas.encerrar(a.professora, id)
      expect(resposta.status).toBe(200)
      const encerrada = atividadeEncerradaResponseSchema.parse(resposta.corpo)
      const [lote] = await lotesDa(id)
      expect(lote).toEqual({ id: expect.any(String), estado: 'pendente', funcao: 'correcao_de_objetiva', tipo: 'lote_de_correcao', decidida_por: null, execucao_id: null })
      expect(encerrada.execucaoId).toBeNull()
      expect(encerrada.atividade).toMatchObject({ id, estado: 'encerrada', entrega: { id: lote?.id, estado: 'pendente' }, participacao: { iniciaram: 2, enviaram: 1 } })
      expect(encerrada.atividade.encerradaEm).not.toBeNull()

      const correcoes = new Map((await correcoesDa(id)).map((correcao) => [correcao.aluno_id, correcao]))
      expect([...correcoes.keys()].sort()).toEqual([a.aluno.usuarioId, bia.usuarioId].sort())
      expect(correcoes.get(a.aluno.usuarioId)).toMatchObject({
        acertos: 4,
        total: 5,
        em_branco: 0,
        por_habilidade: [
          { codigo: 'QUI.EM.05', acertos: 3, total: 3 },
          { codigo: 'QUI.EM.06', acertos: 1, total: 2 },
        ],
        destaques: [],
      })
      expect(correcoes.get(bia.usuarioId)).toMatchObject({ acertos: 0, total: 5, em_branco: 5, destaques: ['em_branco'] })
      expect(await contar('validacao_do_lote', 'atividade_aplicada_id = $1', [id])).toBe(0)
    })

    it('encerrar duas vezes, em seguida e ao mesmo tempo, não cria segundo lote nem altera correção, e a data do encerramento fica', async () => {
      const id = await aplicada()
      await responderProva(rotas, a.aluno, id, [0, 1, 2, 3, 0])
      const primeira = atividadeEncerradaResponseSchema.parse((await rotas.encerrar(a.professora, id)).corpo)
      const antes = await correcoesDa(id)

      const repetidas = await Promise.all([rotas.encerrar(a.professora, id), rotas.encerrar(a.professora, id), rotas.encerrar(a.professora, id)])
      for (const repetida of repetidas) {
        expect(repetida.status).toBe(200)
        expect(atividadeEncerradaResponseSchema.parse(repetida.corpo)).toEqual(primeira)
      }
      expect(await lotesDa(id)).toHaveLength(1)
      expect(await correcoesDa(id)).toEqual(antes)
    })

    it('quatro cliques no primeiro encerramento, ao mesmo tempo, criam um lote só e uma correção por aluno', async () => {
      const id = await aplicada()
      await responderProva(rotas, a.aluno, id, [0, 1, 2, 3, 0])
      await responderProva(rotas, bia, id, [1, 1, 1, 1, 1])
      const simultaneas = await Promise.all(Array.from({ length: 4 }, () => rotas.encerrar(a.professora, id)))
      expect(simultaneas.map((resposta) => resposta.status)).toEqual([200, 200, 200, 200])
      expect(await lotesDa(id)).toHaveLength(1)
      expect(await correcoesDa(id)).toHaveLength(2)
    })

    it('com a função de correção suspensa, a atividade encerra e nada é corrigido; retomada a função, encerrar de novo corrige', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma)
      await responderProva(rotas, c.aluno, id, [0, 1, 2, 3, 0])
      await sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [c.escolaId, 'correcao_de_objetiva', c.coordenacao.usuarioId])

      const suspensa = atividadeEncerradaResponseSchema.parse((await rotas.encerrar(c.professora, id)).corpo)
      expect(suspensa).toMatchObject({ execucaoId: null, atividade: { estado: 'encerrada', entrega: null } })
      expect(await lotesDa(id)).toEqual([])
      expect(await correcoesDa(id)).toEqual([])
      // Encerrada, a atividade não recebe mais resposta, mesmo sem correção.
      expect(erro(await rotas.responder(c.aluno, id, 1, 3))).toEqual({ status: 409, codigo: 'ATIVIDADE_ENCERRADA' })
      // Encerrar de novo com a função ainda suspensa continua sem corrigir.
      expect((await rotas.encerrar(c.professora, id)).status).toBe(200)
      expect(await lotesDa(id)).toEqual([])

      await sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $2 where escola_id = $1', [c.escolaId, c.coordenacao.usuarioId])
      const retomada = atividadeEncerradaResponseSchema.parse((await rotas.encerrar(c.professora, id)).corpo)
      expect(retomada.atividade.entrega).toMatchObject({ estado: 'pendente' })
      expect(retomada.atividade.encerradaEm).toBe(suspensa.atividade.encerradaEm)
      expect(await correcoesDa(id)).toEqual([expect.objectContaining({ aluno_id: c.aluno.usuarioId, acertos: 5, total: 5 })])
    })

    it('a suspensão de outra função não impede a correção', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma)
      await responderProva(rotas, c.aluno, id, [0])
      await sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [c.escolaId, 'adaptacao', c.coordenacao.usuarioId])
      expect(await encerrarAtividade(rotas, c.professora, id)).not.toBeNull()
    })

    it('encerrar uma turma de 40 alunos com 20 questões corrige as 40 tentativas dentro do request, bem abaixo de dois segundos', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const gabarito = Array.from({ length: 20 }, (_, i) => i % 4)
      const turma = await alunosComSessao(bancada, c, c.turma, Array.from({ length: 39 }, (_, i) => `Aluno sintético ${String(i + 1).padStart(2, '0')}`))
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c, { conteudo: conteudoDeTeste(c.materialId, 'Lista sintética de vinte questões', gabarito) }), c.turma)
      // As 800 respostas entram direto no banco: o que se mede é o encerramento, não os 800 `PUT`.
      const alunos = [c.aluno, ...turma].map((aluno) => aluno.usuarioId)
      await sql(`insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, enviada_em) select $1, $2, $3, aluno, now() from unnest($4::uuid[]) as aluno`, [c.escolaId, c.anoLetivoId, id, alunos])
      await sql(
        `insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa)
         select $1, $2, $3, aluno, questao, (questao + posicao) % 4 from unnest($4::uuid[]) with ordinality as a(aluno, posicao), generate_series(1, 20) as questao`,
        [c.escolaId, c.anoLetivoId, id, alunos],
      )
      const inicio = performance.now()
      const resposta = await rotas.encerrar(c.professora, id)
      const duracaoMs = performance.now() - inicio
      expect(resposta.status).toBe(200)
      expect(await contar('correcao', 'atividade_aplicada_id = $1', [id])).toBe(40)
      // A alternativa marcada é (questão + posição) % 4, e o gabarito, (questão − 1) % 4: acerta tudo quem tem posição ≡ 3 (mod 4), dez dos quarenta.
      expect(await contar('correcao', 'atividade_aplicada_id = $1 and acertos = 20', [id])).toBe(10)
      expect(await contar('correcao', 'atividade_aplicada_id = $1 and acertos = 0', [id])).toBe(30)
      if (process.env['EDUCA_MEDIR_ENCERRAR'] !== undefined) process.stdout.write(`encerrar 40 x 20: ${duracaoMs.toFixed(0)} ms\n`)
      expect(duracaoMs).toBeLessThan(2000)
    })

    it('se ninguém abriu a atividade, ela encerra sem lote: faltar não é ficar em branco', async () => {
      const id = await aplicada()
      const encerrada = atividadeEncerradaResponseSchema.parse((await rotas.encerrar(a.professora, id)).corpo)
      expect(encerrada.atividade).toMatchObject({ estado: 'encerrada', entrega: null, participacao: { iniciaram: 0, enviaram: 0 } })
      expect(await lotesDa(id)).toEqual([])
    })

    it('o lote rejeitado deixa corrigir de novo: encerrar outra vez cria um lote novo, pendente, e o rejeitado fica como estava', async () => {
      const id = await aplicada()
      await responderProva(rotas, a.aluno, id, [0, 1, 2, 3, 0])
      const rejeitadoId = await encerrarAtividade(rotas, a.professora, id)
      expect((await rotas.rejeitar(a.professora, rejeitadoId as string)).status).toBe(200)
      const novoId = await encerrarAtividade(rotas, a.professora, id)
      expect(novoId).not.toBe(rejeitadoId)
      expect((await lotesDa(id)).map((lote) => lote.estado)).toEqual(['rejeitada', 'pendente'])
      expect(await contar('correcao', 'entrega_id = $1', [rejeitadoId])).toBe(1)
      expect(await contar('correcao', 'entrega_id = $1', [novoId])).toBe(1)
    })
  })

  describe('virada do ano letivo', () => {
    it('a atividade do ano anterior não aparece para o aluno nem para a professora, e as rotas dela respondem como inexistente', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma)
      await responderProva(rotas, c.aluno, id, [0, 1, 2, 3, 0])
      const entregaId = (await encerrarAtividade(rotas, c.professora, id)) as string
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(c.aluno)).corpo).itens).toHaveLength(1)
      await rotas.correcao(c.professora, id)

      // O ano vira: 2026 encerra e 2027 entra em curso. Os vínculos de 2026 ficam como estavam, de propósito: quem
      // segura a atividade do ano anterior é o filtro de ano letivo, e não o fim do vínculo.
      await sql(`update ano_letivo set situacao = 'encerrado' where escola_id = $1 and id = $2`, [c.escolaId, c.anoLetivoId])
      await sql(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'em_curso')`, [c.escolaId])

      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(c.aluno)).corpo).itens).toEqual([])
      const inexistente = randomUUID()
      for (const [chamada, doInexistente] of [
        [await rotas.prova(c.aluno, id), await rotas.prova(c.aluno, inexistente)],
        [await rotas.diagnostico(c.aluno, id), await rotas.diagnostico(c.aluno, inexistente)],
        [await rotas.correcao(c.professora, id), await rotas.correcao(c.professora, inexistente)],
        [await rotas.encerrar(c.professora, id), await rotas.encerrar(c.professora, inexistente)],
        [await rotas.listar(c.professora, `?turmaId=${c.turma}`), await rotas.listar(c.professora, `?turmaId=${inexistente}`)],
        [await rotas.aprovarLote(c.professora, entregaId), await rotas.aprovarLote(c.professora, inexistente)],
        [await rotas.desempenho(c.professora, c.turma), await rotas.desempenho(c.professora, inexistente)],
        [await rotas.desempenho(c.coordenacao, c.turma, '?finalidade=acompanhamento_pedagogico'), await rotas.desempenho(c.coordenacao, inexistente, '?finalidade=acompanhamento_pedagogico')],
      ] as const) {
        expect(chamada.status).toBe(doInexistente.status)
        expect(chamada.corpo.erro?.codigo ?? chamada.corpo['itens']).toEqual(doInexistente.corpo.erro?.codigo ?? doInexistente.corpo['itens'])
      }
      expect(erro(await rotas.prova(c.aluno, id))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      expect((await rotas.listar(c.professora, `?turmaId=${c.turma}`)).corpo['itens']).toEqual([])
      expect(erro(await rotas.aprovarLote(c.professora, entregaId))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      expect(await sql('select estado from entrega where id = $1', [entregaId])).toEqual([{ estado: 'pendente' }])
      expect(await contar('auditoria', `acao = 'turma.desempenho_lido' and escola_id = $1`, [c.escolaId])).toBe(0)
    })
  })

  describe('rastro', () => {
    it('nenhuma linha de log tem nome de aluno, enunciado, explicação nem resposta', () => {
      const log = linhasDeLog.join('\n')
      for (const proibido of [NOME_DO_ALUNO_DE_TESTE, 'Bia Souza', 'Enunciado sintético', EXPLICACAO_DE_TESTE, 'Alternativa A']) expect(log).not.toContain(proibido)
    })
  })
})
