import { DomainException } from '@educa/core'
import {
  correcaoDoLoteResponseSchema,
  desempenhoDaTurmaResponseSchema,
  destaqueAbertoResponseSchema,
  loteAprovadoResponseSchema,
  meuDiagnosticoResponseSchema,
  minhasAtividadesResponseSchema,
  type CorrecaoDoLoteResponse,
} from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from '../../../test/test-api.js'
import {
  alunosComSessao,
  aplicarAtividade,
  aprovarOLote,
  conteudoDeTeste,
  criarAtividade,
  encerrarAtividade,
  EXPLICACAO_DE_TESTE,
  GABARITO_DE_TESTE,
  HABILIDADE_DAS_DUAS_ULTIMAS,
  HABILIDADE_DAS_TRES_PRIMEIRAS,
  responderProva,
  rotasDaAtividade,
  type RotasDaAtividade,
} from '../../../test/atividade.fixture.js'
import { montarEscolaComAssistente, NOME_DA_PROFESSORA_DE_TESTE, NOME_DO_ALUNO_DE_TESTE, vincularProfessor, type EscolaComAssistente } from '../../../test/escola-assistente.fixture.js'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../../test/sessao.fixture.js'
import { CorrecaoService } from './correcao.service.js'
import { LeituraDoLote } from './lote-read-marker.js'

const NOME_REPETIDO = 'Aluna Sintética Ana Lima'

/**
 * A correção do lote para a professora, os destaques, a aprovação com o registro da validação (D33, D56) e o que chega
 * ao aluno e à turma depois dela (D46; regra 70, itens 1, 3 e 6), com a API montada pelo `AppModule` e o Postgres do
 * compose de teste. A turma de cada cenário é o 2ºB de uma escola nova: Caio (o aluno da bancada), duas Anas com o
 * mesmo nome, Bia e Davi.
 */
describe('correção de objetiva e validação do lote', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let rotas: RotasDaAtividade

  interface Turma {
    readonly escola: EscolaComAssistente
    readonly caio: SessaoDeTeste
    readonly ana1: SessaoDeTeste
    readonly ana2: SessaoDeTeste
    readonly bia: SessaoDeTeste
    readonly davi: SessaoDeTeste
  }

  const sql = async <Linha extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Linha[]> => (await bancada.pool.query(texto, valores)).rows as Linha[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const contar = async (tabela: string, filtro: string, valores: unknown[]): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where ${filtro}`, valores))[0]?.total)
  const entregaNoBanco = async (id: string) => (await sql<{ estado: string; decidida_por: string | null; decidida_em: Date | null }>('select estado, decidida_por, decidida_em from entrega where id = $1', [id]))[0]
  const auditorias = (acao: string, entidadeId: string) => sql<{ autor_usuario_id: string; antes: unknown; depois: Record<string, unknown>; finalidade: string | null }>('select autor_usuario_id, antes, depois, finalidade from auditoria where acao = $1 and entidade_id = $2 order by em', [acao, entidadeId])
  const correcoesDoLote = (entregaId: string) => sql('select id, aluno_id, acertos, total, em_branco, por_habilidade, destaques, destaque_aberto_em, destaque_aberto_por, corrigida_em from correcao where entrega_id = $1 order by aluno_id', [entregaId])
  const lerCorrecao = async (sessao: SessaoDeTeste, atividadeId: string): Promise<CorrecaoDoLoteResponse> => correcaoDoLoteResponseSchema.parse((await rotas.correcao(sessao, atividadeId)).corpo)

  async function turmaNova(): Promise<Turma> {
    const escola = await montarEscolaComAssistente(api, bancada)
    const [ana1, ana2, bia, davi] = (await alunosComSessao(bancada, escola, escola.turma, [NOME_REPETIDO, NOME_REPETIDO, 'Aluna Sintética Bia Souza', 'Aluno Sintético Davi Rocha'])) as [SessaoDeTeste, SessaoDeTeste, SessaoDeTeste, SessaoDeTeste]
    return { escola, caio: escola.aluno, ana1, ana2, bia, davi }
  }

  /** Uma atividade aplicada ao 2ºB, respondida como o cenário pede (`null` na lista deixa a questão em branco; aluno fora do mapa falta). */
  async function atividadeRespondida(turma: Turma, respostas: readonly (readonly [SessaoDeTeste, readonly (number | null)[]])[], titulo = `Lista sintética ${randomUUID()}`): Promise<{ id: string; entregaId: string }> {
    const { escola } = turma
    const id = await aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola, { conteudo: conteudoDeTeste(escola.materialId, titulo) }), escola.turma)
    for (const [aluno, marcadas] of respostas) await responderProva(rotas, aluno, id, marcadas)
    const entregaId = await encerrarAtividade(rotas, escola.professora, id)
    if (entregaId === null) throw new Error('o lote não nasceu')
    return { id, entregaId }
  }

  /** O cenário comum: Caio acerta 4, as duas Anas acertam 5 e 2, Bia deixa em branco (destaque), Davi falta. */
  const cenarioComum = (turma: Turma) =>
    atividadeRespondida(turma, [
      [turma.caio, [0, 1, 2, 3, 1]],
      [turma.ana1, [...GABARITO_DE_TESTE]],
      [turma.ana2, [0, 1, 3, 0, 1]],
      [turma.bia, []],
    ])

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
    rotas = rotasDaAtividade(api)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
  })

  describe('a correção para a professora', () => {
    it('traz o lote com o resumo, a distribuição, o acerto por habilidade e por questão, os destaques e as outras correções, sem nota em campo nenhum', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const resposta = await rotas.correcao(turma.escola.professora, id)
      expect(resposta.status).toBe(200)
      const lote = correcaoDoLoteResponseSchema.parse(resposta.corpo)

      expect(lote).toMatchObject({ atividadeAplicadaId: id, entrega: { id: entregaId, estado: 'pendente' }, destaquesAbertos: 0, podeAprovar: false, validacao: null })
      // Cinco alunos na turma, quatro abriram a atividade: quem faltou não tem correção.
      expect(lote.resumo).toMatchObject({ alunosDaTurma: 5, corrigidos: 4, questoes: 5, mediaDeAcertos: 2.75 })
      expect(lote.resumo.distribuicao).toEqual([
        { de: 0, ate: 0, alunos: 1 },
        { de: 1, ate: 1, alunos: 0 },
        { de: 2, ate: 2, alunos: 1 },
        { de: 3, ate: 3, alunos: 0 },
        { de: 4, ate: 4, alunos: 1 },
        { de: 5, ate: 5, alunos: 1 },
      ])
      expect(lote.resumo.porHabilidade).toEqual([
        { habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, acertos: 8, total: 12 },
        { habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, acertos: 3, total: 8 },
      ])
      expect(lote.resumo.porQuestao[2]).toEqual({ numero: 3, habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, gabarito: 2, acertos: 2, porAlternativa: [0, 0, 2, 1], emBranco: 1 })
      expect(lote.resumo.porQuestao[4]).toEqual({ numero: 5, habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, gabarito: 0, acertos: 1, porAlternativa: [1, 2, 0, 0], emBranco: 1 })

      expect(lote.destaques).toEqual([{ alunoId: turma.bia.usuarioId, nome: 'Aluna Sintética Bia Souza', acertos: 0, total: 5, emBranco: 5, motivos: ['em_branco'], abertoEm: null }])
      // As duas alunas com o mesmo nome aparecem, cada uma com o id e o resultado dela, em ordem de nome.
      expect(lote.outras.map((outra) => outra.nome)).toEqual([NOME_REPETIDO, NOME_REPETIDO, NOME_DO_ALUNO_DE_TESTE])
      expect(new Map(lote.outras.map((outra) => [outra.alunoId, outra.acertos]))).toEqual(new Map([[turma.ana1.usuarioId, 5], [turma.ana2.usuarioId, 2], [turma.caio.usuarioId, 4]]))
      expect(JSON.stringify(resposta.corpo)).not.toContain(turma.davi.usuarioId)
      for (const proibido of ['nota', 'conceito', 'pontuacao', 'percentual']) expect(JSON.stringify(resposta.corpo).toLowerCase()).not.toContain(proibido)
    })

    it('a atividade sem lote (aberta, ou encerrada sem ninguém) responde como inexistente', async () => {
      const turma = await turmaNova()
      const { escola } = turma
      const aberta = await aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola), escola.turma)
      expect(erro(await rotas.correcao(escola.professora, aberta))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      await rotas.encerrar(escola.professora, aberta)
      expect(erro(await rotas.correcao(escola.professora, aberta))).toEqual(erro(await rotas.correcao(escola.professora, randomUUID())))
    })
  })

  describe('abrir destaque', () => {
    it('registra quem abriu e quando, uma vez só, com auditoria, e devolve as respostas do aluno com o gabarito; abrir de novo devolve o mesmo', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const { professora } = turma.escola

      const resposta = await rotas.abrirDestaque(professora, id, turma.bia.usuarioId)
      expect(resposta.status).toBe(200)
      const aberto = destaqueAbertoResponseSchema.parse(resposta.corpo)
      expect(aberto.destaque).toMatchObject({ alunoId: turma.bia.usuarioId, motivos: ['em_branco'], acertos: 0, emBranco: 5 })
      expect(aberto.destaque.abertoEm).not.toBeNull()
      expect(aberto.respostas).toEqual(GABARITO_DE_TESTE.map((gabarito, indice) => ({ questao: indice + 1, alternativa: null, gabarito, correta: false })))
      expect(aberto.historico).toEqual([])

      const [correcao] = await sql<{ destaque_aberto_em: Date; destaque_aberto_por: string }>('select destaque_aberto_em, destaque_aberto_por from correcao where entrega_id = $1 and aluno_id = $2', [entregaId, turma.bia.usuarioId])
      expect(correcao).toEqual({ destaque_aberto_em: new Date(aberto.destaque.abertoEm as string), destaque_aberto_por: professora.usuarioId })

      // De novo, em seguida e três vezes ao mesmo tempo: a primeira hora fica, e a auditoria continua uma.
      const repetidas = await Promise.all([rotas.abrirDestaque(professora, id, turma.bia.usuarioId), rotas.abrirDestaque(professora, id, turma.bia.usuarioId), rotas.abrirDestaque(professora, id, turma.bia.usuarioId)])
      for (const repetida of repetidas) expect(repetida.corpo).toEqual(resposta.corpo)
      expect(await auditorias('correcao.destaque_aberto', entregaId)).toEqual([
        { autor_usuario_id: professora.usuarioId, antes: null, depois: { atividadeAplicadaId: id, alunoId: turma.bia.usuarioId, motivos: ['em_branco'] }, finalidade: null },
      ])
      expect(await lerCorrecao(professora, id)).toMatchObject({ destaquesAbertos: 1, podeAprovar: true })
    })

    it('três aberturas ao mesmo tempo, do destaque ainda fechado, gravam uma abertura e uma auditoria', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const simultaneas = await Promise.all(Array.from({ length: 3 }, () => rotas.abrirDestaque(turma.escola.professora, id, turma.bia.usuarioId)))
      expect(simultaneas.map((resposta) => resposta.status)).toEqual([200, 200, 200])
      expect(new Set(simultaneas.map((resposta) => (resposta.corpo['destaque'] as { abertoEm: string }).abertoEm)).size).toBe(1)
      expect(await auditorias('correcao.destaque_aberto', entregaId)).toHaveLength(1)
    })

    it('o aluno que não é destaque, o que faltou, o de outra aplicação e o inexistente respondem igual, e nada é registrado', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const outra = await atividadeRespondida(turma, [[turma.davi, []]])
      const { professora } = turma.escola

      const doInexistente = erro(await rotas.abrirDestaque(professora, id, randomUUID()))
      expect(doInexistente).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      // Caio foi corrigido e não é destaque; Davi faltou aqui e é destaque só na outra aplicação.
      for (const alunoId of [turma.caio.usuarioId, turma.davi.usuarioId, professora.usuarioId, 'nao-e-uuid']) expect(erro(await rotas.abrirDestaque(professora, id, alunoId))).toEqual(doInexistente)
      expect(erro(await rotas.abrirDestaque(professora, outra.id, turma.bia.usuarioId))).toEqual(doInexistente)
      expect(await contar('correcao', 'entrega_id = any($1::uuid[]) and destaque_aberto_em is not null', [[entregaId, outra.entregaId]])).toBe(0)
      expect(await auditorias('correcao.destaque_aberto', entregaId)).toEqual([])
    })
  })

  describe('aprovar o lote', () => {
    it('com destaque fechado é recusado (DESTAQUES_NAO_ABERTOS): nenhuma validação, nenhuma auditoria, e a entrega continua pendente', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const { professora } = turma.escola
      expect(await lerCorrecao(professora, id)).toMatchObject({ podeAprovar: false, destaquesAbertos: 0 })

      expect(erro(await rotas.aprovarLote(professora, entregaId))).toEqual({ status: 409, codigo: 'DESTAQUES_NAO_ABERTOS' })
      expect(await contar('validacao_do_lote', 'entrega_id = $1', [entregaId])).toBe(0)
      expect(await auditorias('lote.aprovado', entregaId)).toEqual([])
      expect(await entregaNoBanco(entregaId)).toEqual({ estado: 'pendente', decidida_por: null, decidida_em: null })
      expect(erro(await rotas.diagnostico(turma.caio, id))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
    })

    it('grava a validação e a aprovação juntas: o apresentado é o que a rota de correção mostrou, o aberto é o que foi aberto, e quem confirmou é a professora', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const { professora } = turma.escola
      const mostrado = await lerCorrecao(professora, id)
      const aberto = destaqueAbertoResponseSchema.parse((await rotas.abrirDestaque(professora, id, turma.bia.usuarioId)).corpo)

      const resposta = await rotas.aprovarLote(professora, entregaId)
      expect(resposta.status).toBe(200)
      const aprovado = loteAprovadoResponseSchema.parse(resposta.corpo)
      expect(aprovado.entrega).toMatchObject({ id: entregaId, tipo: 'lote_de_correcao', funcao: 'correcao_de_objetiva', estado: 'aprovada', atividadeAplicadaId: id, decididaPor: { id: professora.usuarioId, nome: NOME_DA_PROFESSORA_DE_TESTE }, justificativa: null })

      const [validacao] = await sql<{ id: string; apresentado: { resumo: unknown; destaques: unknown }; aberto: unknown; confirmada_por: string; confirmada_em: Date }>('select id, apresentado, aberto, confirmada_por, confirmada_em from validacao_do_lote where entrega_id = $1', [entregaId])
      // O que foi apresentado: o resumo igual ao que `GET …/correcao` devolveu, e os destaques que ela listou, só com id e motivos.
      expect(validacao?.apresentado.resumo).toEqual(mostrado.resumo)
      expect(validacao?.apresentado.destaques).toEqual(mostrado.destaques.map((destaque) => ({ alunoId: destaque.alunoId, motivos: destaque.motivos })))
      expect(JSON.stringify(validacao?.apresentado)).not.toContain('Bia')
      // O que foi aberto, quem confirmou e quando.
      expect(validacao?.aberto).toEqual([{ alunoId: turma.bia.usuarioId, abertoEm: aberto.destaque.abertoEm }])
      expect(validacao?.confirmada_por).toBe(professora.usuarioId)
      expect(aprovado.validacao).toMatchObject({ id: validacao?.id, apresentado: validacao?.apresentado, aberto: validacao?.aberto, confirmadaPor: { id: professora.usuarioId }, confirmadaEm: validacao?.confirmada_em.toISOString() })

      const naEntrega = await entregaNoBanco(entregaId)
      expect(naEntrega).toMatchObject({ estado: 'aprovada', decidida_por: professora.usuarioId })
      expect(await auditorias('lote.aprovado', entregaId)).toEqual([
        {
          autor_usuario_id: professora.usuarioId,
          antes: { estado: 'pendente' },
          depois: { estado: 'aprovada', atividadeAplicadaId: id, turmaId: turma.escola.turma, validacaoId: validacao?.id, corrigidos: 4, destaques: 1, destaquesAbertos: 1 },
          finalidade: null,
        },
      ])
      // A correção lida depois traz o registro, e não libera aprovar de novo.
      expect(await lerCorrecao(professora, id)).toMatchObject({ entrega: { estado: 'aprovada' }, podeAprovar: false, validacao: { id: validacao?.id } })
      // Aprovar não cria nota: a tabela não existe, e a aprovação não a faria existir (D46).
      expect(await sql(`select table_name from information_schema.tables where table_name in ('nota', 'boletim')`)).toEqual([])
    })

    it('o cliente que manda apresentado, aberto ou qualquer campo no corpo é recusado, e nada é gravado', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const { professora } = turma.escola
      const mostrado = await lerCorrecao(professora, id)
      await rotas.abrirDestaque(professora, id, turma.bia.usuarioId)
      for (const corpo of [{ apresentado: { resumo: mostrado.resumo, destaques: [] } }, { aberto: [] }, { confirmadaPor: turma.escola.colega.usuarioId }, { decisao: 'aprovar' }]) {
        expect(erro(await rotas.aprovarLote(professora, entregaId, corpo))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      expect(await contar('validacao_do_lote', 'entrega_id = $1', [entregaId])).toBe(0)
      expect((await entregaNoBanco(entregaId))?.estado).toBe('pendente')
    })

    it('sem ter lido a correção do lote, a aprovação é recusada, mesmo sem destaque; e se o lote mudou depois da leitura, também, até ela reler', async () => {
      const turma = await turmaNova()
      const { professora } = turma.escola
      const { id, entregaId } = await atividadeRespondida(turma, [[turma.caio, [...GABARITO_DE_TESTE]]])

      // Nunca leu: recusa, sem gravar nada.
      expect(erro(await rotas.aprovarLote(professora, entregaId))).toEqual({ status: 409, codigo: 'CONFLITO' })
      expect(await contar('validacao_do_lote', 'entrega_id = $1', [entregaId])).toBe(0)
      expect((await entregaNoBanco(entregaId))?.estado).toBe('pendente')

      // Leu; depois a turma ganhou um aluno, e o resumo que o servidor monta já não é o que ela viu.
      const mostrado = await lerCorrecao(professora, id)
      await alunosComSessao(bancada, turma.escola, turma.escola.turma, ['Aluno Sintético que chegou depois'])
      expect(erro(await rotas.aprovarLote(professora, entregaId))).toEqual({ status: 409, codigo: 'CONFLITO' })
      expect(await contar('validacao_do_lote', 'entrega_id = $1', [entregaId])).toBe(0)

      // Releu: aprova, e o registrado é o da segunda leitura.
      const relido = await lerCorrecao(professora, id)
      expect(relido.resumo.alunosDaTurma).toBe(mostrado.resumo.alunosDaTurma + 1)
      const aprovado = loteAprovadoResponseSchema.parse((await rotas.aprovarLote(professora, entregaId)).corpo)
      expect(aprovado.validacao.apresentado.resumo).toEqual(relido.resumo)
    })

    it('a leitura de outra pessoa não vale: a marca é de quem leu', async () => {
      const turma = await turmaNova()
      const { escola } = turma
      const { id, entregaId } = await atividadeRespondida(turma, [[turma.caio, [...GABARITO_DE_TESTE]]])
      // Uma segunda professora de Química do 2ºB lê; a primeira, que não leu, não aprova.
      const segunda = await bancada.sessao(escola.escolaId, 'professor')
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`, [escola.escolaId, escola.anoLetivoId, segunda.usuarioId, escola.turma, escola.quimica, escola.coordenacao.usuarioId])
      await lerCorrecao(segunda, id)
      expect(erro(await rotas.aprovarLote(escola.professora, entregaId))).toEqual({ status: 409, codigo: 'CONFLITO' })
      expect((await rotas.aprovarLote(segunda, entregaId)).status).toBe(200)
      expect((await entregaNoBanco(entregaId))?.decidida_por).toBe(segunda.usuarioId)
    })

    it('dois cliques ao mesmo tempo gravam uma validação, uma aprovação e uma auditoria; o segundo responde ENTREGA_JA_DECIDIDA', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const { professora } = turma.escola
      await lerCorrecao(professora, id)
      await rotas.abrirDestaque(professora, id, turma.bia.usuarioId)

      const cliques = await Promise.all([rotas.aprovarLote(professora, entregaId), rotas.aprovarLote(professora, entregaId), rotas.aprovarLote(professora, entregaId)])
      expect(cliques.map((clique) => clique.status).sort()).toEqual([200, 409, 409])
      expect(cliques.filter((clique) => clique.status === 409).map((clique) => clique.corpo.erro?.codigo)).toEqual(['ENTREGA_JA_DECIDIDA', 'ENTREGA_JA_DECIDIDA'])
      expect(await contar('validacao_do_lote', 'entrega_id = $1', [entregaId])).toBe(1)
      expect(await auditorias('lote.aprovado', entregaId)).toHaveLength(1)
      expect(erro(await rotas.aprovarLote(professora, entregaId))).toEqual({ status: 409, codigo: 'ENTREGA_JA_DECIDIDA' })
      expect(erro(await rotas.rejeitar(professora, entregaId))).toEqual({ status: 409, codigo: 'ENTREGA_JA_DECIDIDA' })
    })

    it('depois de aprovado, nenhuma correção do lote é inserida nem alterada: nem pelo encerramento repetido, nem por abrir destaque', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const { professora } = turma.escola
      await aprovarOLote(rotas, professora, id)
      const antes = await correcoesDoLote(entregaId)

      for (const repetida of await Promise.all([rotas.encerrar(professora, id), rotas.encerrar(professora, id)])) expect(repetida.status).toBe(200)
      // O destaque já aberto continua lendo igual; o lote decidido não aceita abertura nova.
      expect((await rotas.abrirDestaque(professora, id, turma.bia.usuarioId)).status).toBe(200)
      expect(await correcoesDoLote(entregaId)).toEqual(antes)
      expect(await contar('entrega', 'atividade_aplicada_id = $1', [id])).toBe(1)
      expect(await contar('correcao', 'atividade_aplicada_id = $1', [id])).toBe(antes.length)
      expect(await contar('validacao_do_lote', 'atividade_aplicada_id = $1', [id])).toBe(1)
    })

    it('o destaque que ficou fechado num lote rejeitado não se abre depois da decisão', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const { professora } = turma.escola
      expect((await rotas.rejeitar(professora, entregaId)).status).toBe(200)
      expect(erro(await rotas.abrirDestaque(professora, id, turma.bia.usuarioId))).toEqual({ status: 409, codigo: 'ENTREGA_JA_DECIDIDA' })
      expect(await contar('correcao', 'entrega_id = $1 and destaque_aberto_em is not null', [entregaId])).toBe(0)
      // O lote rejeitado não se aprova.
      await lerCorrecao(professora, id)
      expect(erro(await rotas.aprovarLote(professora, entregaId))).toEqual({ status: 409, codigo: 'ENTREGA_JA_DECIDIDA' })
    })

    it('o lote pendente de uma função suspensa continua podendo ser aprovado: quem decide é a pessoa', async () => {
      const turma = await turmaNova()
      const { escola } = turma
      const { id, entregaId } = await atividadeRespondida(turma, [[turma.caio, [...GABARITO_DE_TESTE]]])
      await sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escola.escolaId, 'correcao_de_objetiva', escola.coordenacao.usuarioId])
      await aprovarOLote(rotas, escola.professora, id)
      expect((await entregaNoBanco(entregaId))?.estado).toBe('aprovada')
    })

    it('só uma pessoa aprova: sem sessão de usuário o serviço recusa, a reexecução do encerramento não aprova, e só a rota chama a aprovação', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await atividadeRespondida(turma, [[turma.caio, [...GABARITO_DE_TESTE]]])
      await lerCorrecao(turma.escola.professora, id)

      // Chamado direto, como um job ou uma rotina faria, sem o contexto que a guarda de sessão grava.
      const servico = new CorrecaoService(bancada.banco, api.app.get(LeituraDoLote))
      await expect(servico.aprovarLote(entregaId)).rejects.toBeInstanceOf(DomainException)
      await rotas.encerrar(turma.escola.professora, id)
      expect(await entregaNoBanco(entregaId)).toEqual({ estado: 'pendente', decidida_por: null, decidida_em: null })
      expect(await contar('validacao_do_lote', 'entrega_id = $1', [entregaId])).toBe(0)

      // No código do módulo: `aprovar` do repository só é chamado pelo service, e `aprovarLote`, só pela rota.
      // A pasta do módulo inteiro, com as subpastas por recurso (96.0): o chamador pode estar em qualquer uma delas. A prova de
      // que a varredura alcança a subpasta de outro recurso é a mutação de `atividade-aplicada.service.ts` (um `.aprovar(` lá
      // reprova); a do `recursive` e a do `'..'` ficam vermelhas pelo prefixo `correcao/` dos nomes esperados.
      const pasta = fileURLToPath(new URL('..', import.meta.url))
      const fontes = readdirSync(pasta, { recursive: true, encoding: 'utf8' })
        .map((arquivo) => arquivo.split(sep).join('/'))
        .filter((arquivo) => arquivo.endsWith('.ts') && !arquivo.endsWith('.test.ts'))
        .map((arquivo) => ({ arquivo, texto: readFileSync(join(pasta, arquivo), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '') }))
      const quemUsa = (padrao: RegExp) => fontes.filter((fonte) => padrao.test(fonte.texto)).map((fonte) => fonte.arquivo).sort()
      expect(quemUsa(/\.update\(entrega\)/u)).toEqual(['correcao/correcao.repository.ts'])
      expect(quemUsa(/\.aprovar\(/u)).toEqual(['correcao/correcao.service.ts'])
      expect(quemUsa(/\.aprovarLote\(/u)).toEqual(['correcao/lote.controller.ts'])
    })
  })

  describe('nada chega ao aluno sem aprovação', () => {
    it('com o lote pendente e com o lote rejeitado, o diagnóstico é inexistente, e a lista e a prova não dizem acerto, gabarito nem explicação', async () => {
      const turma = await turmaNova()
      const { id, entregaId } = await cenarioComum(turma)
      const semAprovacao = async () => {
        expect(erro(await rotas.diagnostico(turma.caio, id))).toEqual(erro(await rotas.diagnostico(turma.caio, randomUUID())))
        expect(erro(await rotas.diagnostico(turma.caio, id))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
        const lista = await rotas.minhas(turma.caio)
        expect(minhasAtividadesResponseSchema.parse(lista.corpo).itens).toEqual([expect.objectContaining({ id, situacao: 'enviada' })])
        const prova = await rotas.prova(turma.caio, id)
        expect(prova.status).toBe(200)
        for (const corpo of [lista.corpo, prova.corpo]) {
          for (const proibido of ['acertos', 'gabarito', 'correta', 'explicacao', EXPLICACAO_DE_TESTE, 'habilidade', 'destaque', 'com_diagnostico']) expect(JSON.stringify(corpo)).not.toContain(proibido)
        }
      }
      await semAprovacao()
      expect((await rotas.rejeitar(turma.escola.professora, entregaId)).status).toBe(200)
      await semAprovacao()
    })

    it('depois de aprovado, o diagnóstico existe e é só o do próprio aluno: o que ele marcou, o gabarito, a explicação e quem aprovou, sem colega nem turma', async () => {
      const turma = await turmaNova()
      const { id } = await cenarioComum(turma)
      await aprovarOLote(rotas, turma.escola.professora, id)

      const resposta = await rotas.diagnostico(turma.caio, id)
      expect(resposta.status).toBe(200)
      const diagnostico = meuDiagnosticoResponseSchema.parse(resposta.corpo)
      expect(diagnostico).toMatchObject({
        atividadeAplicadaId: id,
        acertos: 4,
        total: 5,
        porHabilidade: [
          { habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, acertos: 3, total: 3 },
          { habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, acertos: 1, total: 2 },
        ],
        aprovadoPor: { nome: NOME_DA_PROFESSORA_DE_TESTE },
      })
      expect(diagnostico.questoes.map(({ numero, alternativa, gabarito, correta }) => ({ numero, alternativa, gabarito, correta }))).toEqual([
        { numero: 1, alternativa: 0, gabarito: 0, correta: true },
        { numero: 2, alternativa: 1, gabarito: 1, correta: true },
        { numero: 3, alternativa: 2, gabarito: 2, correta: true },
        { numero: 4, alternativa: 3, gabarito: 3, correta: true },
        { numero: 5, alternativa: 1, gabarito: 0, correta: false },
      ])
      expect(diagnostico.questoes[4]?.explicacao).toContain(EXPLICACAO_DE_TESTE)

      // O de cada um é o dele: a Ana que acertou 2 lê 2, e não o 4 do Caio.
      expect(meuDiagnosticoResponseSchema.parse((await rotas.diagnostico(turma.ana2, id)).corpo)).toMatchObject({ acertos: 2, total: 5 })
      // Nada de colega, de turma nem de posição.
      const texto = JSON.stringify(resposta.corpo)
      for (const proibido of [turma.ana1.usuarioId, turma.ana2.usuarioId, turma.bia.usuarioId, NOME_REPETIDO, 'Bia', 'media', 'turma', 'posicao', 'ranking', 'nota', 'destaque']) expect(texto).not.toContain(proibido)
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(turma.caio)).corpo).itens).toEqual([expect.objectContaining({ id, situacao: 'com_diagnostico' })])

      // Quem faltou não tem correção: para ele, mesmo com o lote aprovado, o diagnóstico não existe.
      expect(erro(await rotas.diagnostico(turma.davi, id))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(turma.davi)).corpo).itens).toEqual([expect.objectContaining({ id, situacao: 'encerrada' })])
    })
  })

  describe('destaque pelo histórico do próprio aluno', () => {
    it('só conta lote aprovado: com o primeiro lote aprovado, a queda na segunda atividade é destacada; com o primeiro ainda pendente, não', async () => {
      const turma = await turmaNova()
      const { professora } = turma.escola
      // Caio e Ana acertam tudo na primeira; só o lote dela é aprovado.
      const primeira = await atividadeRespondida(turma, [[turma.caio, [...GABARITO_DE_TESTE]], [turma.ana1, [...GABARITO_DE_TESTE]]], 'Lista sintética um')
      const queda = [0, 2, 3, 0, 2]

      const antesDeAprovar = await atividadeRespondida(turma, [[turma.caio, queda], [turma.ana1, queda]], 'Lista sintética dois')
      expect((await lerCorrecao(professora, antesDeAprovar.id)).destaques).toEqual([])

      await aprovarOLote(rotas, professora, primeira.id)
      const depoisDeAprovar = await atividadeRespondida(turma, [[turma.caio, queda], [turma.ana1, [...GABARITO_DE_TESTE]]], 'Lista sintética três')
      const lote = await lerCorrecao(professora, depoisDeAprovar.id)
      // Caio caiu de 5 em 5 para 1 em 5; a Ana ficou onde estava.
      expect(lote.destaques.map(({ alunoId, motivos }) => ({ alunoId, motivos }))).toEqual([{ alunoId: turma.caio.usuarioId, motivos: ['fora_do_historico'] }])

      // O destaque aberto mostra o histórico que o explica: só o lote aprovado, com o título e a contagem.
      const aberto = destaqueAbertoResponseSchema.parse((await rotas.abrirDestaque(professora, depoisDeAprovar.id, turma.caio.usuarioId)).corpo)
      expect(aberto.historico).toEqual([{ titulo: 'Lista sintética um', acertos: 5, total: 5 }])
      expect(aberto.respostas.filter((resposta) => resposta.correta).map((resposta) => resposta.questao)).toEqual([1])
    })
  })

  describe('desempenho da turma', () => {
    const FINALIDADE = '?finalidade=acompanhamento_pedagogico'
    const lerDesempenho = async (sessao: SessaoDeTeste, turmaId: string, consulta = '') => desempenhoDaTurmaResponseSchema.parse((await rotas.desempenho(sessao, turmaId, consulta)).corpo)

    it('só soma lote aprovado: pendente e rejeitado não entram em número nenhum, e a turma sem lote aprovado vem vazia, com os alunos zerados', async () => {
      const turma = await turmaNova()
      const { escola } = turma
      const pendente = await cenarioComum(turma)
      const rejeitado = await cenarioComum(turma)
      await rotas.rejeitar(escola.professora, rejeitado.entregaId)

      const vazio = await lerDesempenho(escola.professora, escola.turma)
      expect(vazio).toMatchObject({ turmaId: escola.turma, lotesAprovados: 0, porHabilidade: [] })
      expect(vazio.alunos).toHaveLength(5)
      expect(vazio.alunos.every((aluno) => aluno.acertos === 0 && aluno.total === 0 && aluno.porHabilidade.length === 0)).toBe(true)

      await aprovarOLote(rotas, escola.professora, pendente.id)
      const resposta = await rotas.desempenho(escola.professora, escola.turma)
      const desempenho = desempenhoDaTurmaResponseSchema.parse(resposta.corpo)
      expect(desempenho.lotesAprovados).toBe(1)
      // Só o lote aprovado: 8 de 12 e 3 de 8, como no resumo dele. Abaixo da metade: Bia nas duas; a segunda Ana e Bia na segunda.
      expect(desempenho.porHabilidade).toEqual([
        { habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, acertos: 8, total: 12, alunosAbaixoDaMetade: 1 },
        { habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, acertos: 3, total: 8, alunosAbaixoDaMetade: 2 },
      ])
      // Em ordem de nome; as duas Anas, cada uma com o dela; Davi, que faltou, zerado.
      expect(desempenho.alunos.map((aluno) => aluno.nome)).toEqual([NOME_REPETIDO, NOME_REPETIDO, 'Aluna Sintética Bia Souza', NOME_DO_ALUNO_DE_TESTE, 'Aluno Sintético Davi Rocha'])
      expect(new Map(desempenho.alunos.map((aluno) => [aluno.alunoId, [aluno.acertos, aluno.total]]))).toEqual(
        new Map([[turma.ana1.usuarioId, [5, 5]], [turma.ana2.usuarioId, [2, 5]], [turma.bia.usuarioId, [0, 5]], [turma.caio.usuarioId, [4, 5]], [turma.davi.usuarioId, [0, 0]]]),
      )
      expect(desempenho.alunos.find((aluno) => aluno.alunoId === turma.caio.usuarioId)?.porHabilidade).toEqual([
        { habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, acertos: 3, total: 3 },
        { habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, acertos: 1, total: 2 },
      ])
      for (const proibido of ['nota', 'conceito', 'posicao', 'ranking', 'faixa']) expect(JSON.stringify(resposta.corpo).toLowerCase()).not.toContain(proibido)
    })

    it('a professora com duas disciplinas na mesma turma (Química e Física) lê o desempenho das duas somado, e nada de uma terceira', async () => {
      const turma = await turmaNova()
      const { escola } = turma
      await vincularProfessor(bancada, escola, escola.professora.usuarioId, escola.turma, escola.fisica)
      const biologia = (await chamar(api.url, 'POST', '/v1/disciplinas', await escola.coordenacao.tokenNovo(), { nome: 'Biologia' })).corpo['id'] as string
      await vincularProfessor(bancada, escola, escola.deFisica.usuarioId, escola.turma, biologia)
      const loteAprovado = async (professora: SessaoDeTeste, disciplinaId: string, respostas: readonly (readonly [SessaoDeTeste, readonly number[]])[]) => {
        const id = await aplicarAtividade(rotas, professora, await criarAtividade(bancada, escola, { disciplinaId, conteudo: conteudoDeTeste(escola.materialId, `Lista sintética ${randomUUID()}`) }), escola.turma)
        for (const [aluno, marcadas] of respostas) await responderProva(rotas, aluno, id, marcadas)
        if ((await encerrarAtividade(rotas, professora, id)) === null) throw new Error('o lote não nasceu')
        expect((await aprovarOLote(rotas, professora, id)).status).toBe(200)
      }
      const quaseTudoErrado = [1, 1, 0, 0, 1]
      // Química: Caio acerta tudo. Física: Caio acerta só a questão 2. Biologia (outra professora): Caio e Bia quase tudo errado.
      await loteAprovado(escola.professora, escola.quimica, [[turma.caio, [...GABARITO_DE_TESTE]]])
      await loteAprovado(escola.professora, escola.fisica, [[turma.caio, quaseTudoErrado]])
      await loteAprovado(escola.deFisica, biologia, [
        [turma.caio, quaseTudoErrado],
        [turma.bia, quaseTudoErrado],
      ])

      const desempenho = await lerDesempenho(escola.professora, escola.turma)
      expect(desempenho.lotesAprovados).toBe(2)
      // As duas somadas: 3 + 1 de 6 e 2 + 0 de 4, ninguém abaixo da metade. Com a Biologia seriam 5 de 9 e 2 de 6, e três abaixo.
      expect(desempenho.porHabilidade).toEqual([
        { habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, acertos: 4, total: 6, alunosAbaixoDaMetade: 0 },
        { habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, acertos: 2, total: 4, alunosAbaixoDaMetade: 0 },
      ])
      expect(new Map(desempenho.alunos.map((aluno) => [aluno.alunoId, [aluno.acertos, aluno.total]]))).toEqual(
        new Map([[turma.ana1.usuarioId, [0, 0]], [turma.ana2.usuarioId, [0, 0]], [turma.bia.usuarioId, [0, 0]], [turma.caio.usuarioId, [6, 10]], [turma.davi.usuarioId, [0, 0]]]),
      )
    })

    it('a professora lê sem registro; a coordenação só com finalidade, e cada leitura dela grava auditoria; sem finalidade, nem resposta nem registro', async () => {
      const turma = await turmaNova()
      const { escola } = turma
      const { id } = await cenarioComum(turma)
      await aprovarOLote(rotas, escola.professora, id)

      await lerDesempenho(escola.professora, escola.turma)
      expect(await auditorias('turma.desempenho_lido', escola.turma)).toEqual([])

      expect(erro(await rotas.desempenho(escola.coordenacao, escola.turma))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      expect(erro(await rotas.desempenho(escola.coordenacao, escola.turma, '?finalidade=curiosidade'))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      // Sem finalidade, a turma que não existe responde igual: a falta dela não confirma turma nenhuma.
      expect(erro(await rotas.desempenho(escola.coordenacao, randomUUID()))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      expect(await auditorias('turma.desempenho_lido', escola.turma)).toEqual([])

      const daCoordenacao = await lerDesempenho(escola.coordenacao, escola.turma, FINALIDADE)
      expect(daCoordenacao).toEqual(await lerDesempenho(escola.professora, escola.turma))
      await lerDesempenho(escola.coordenacao, escola.turma, '?finalidade=atendimento_a_familia')
      const registro = { autor_usuario_id: escola.coordenacao.usuarioId, antes: null, depois: { quantidade: 5, lotesAprovados: 1 } }
      expect(await auditorias('turma.desempenho_lido', escola.turma)).toEqual([
        { ...registro, finalidade: 'acompanhamento_pedagogico' },
        { ...registro, finalidade: 'atendimento_a_familia' },
      ])
    })
  })

  /**
   * O aluno transferido (decisão do pacote Z): a correção é do **trabalho feito**, então quem respondeu na turma X entra
   * no lote de X, e o resumo conta quem respondeu (`corrigidos`), com o número atual da turma à parte (`alunosDaTurma`).
   * O desempenho da turma é a foto de hoje: quem saiu não aparece nem conta. E o aluno, depois de sair, não lê o
   * diagnóstico da turma antiga nesta fatia (lacuna registrada em `minha-atividade.service.ts`).
   */
  describe('aluno transferido', () => {
    const lerDesempenho = async (sessao: SessaoDeTeste, turmaId: string) => desempenhoDaTurmaResponseSchema.parse((await rotas.desempenho(sessao, turmaId)).corpo)
    const transferir = async (escola: EscolaComAssistente, aluno: SessaoDeTeste) => {
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [escola.escolaId, aluno.usuarioId, escola.turma])
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [escola.escolaId, escola.anoLetivoId, aluno.usuarioId, escola.outraTurma, escola.coordenacao.usuarioId])
    }
    /** A soma de cada habilidade da turma é a soma dos alunos que a lista mostra: o número da tela fecha. */
    const somaDosAlunos = (desempenho: { alunos: readonly { porHabilidade: readonly { habilidade: { codigo: string }; acertos: number; total: number }[] }[] }) => {
      const soma = new Map<string, [number, number]>()
      for (const aluno of desempenho.alunos) {
        for (const parte of aluno.porHabilidade) {
          const [acertos, total] = soma.get(parte.habilidade.codigo) ?? [0, 0]
          soma.set(parte.habilidade.codigo, [acertos + parte.acertos, total + parte.total])
        }
      }
      return soma
    }

    it('transferido depois de aprovado: não aparece no desempenho da turma, não conta em habilidade nem abaixo da metade, e a soma da turma fecha', async () => {
      const turma = await turmaNova()
      const { escola } = turma
      const { id } = await cenarioComum(turma)
      await aprovarOLote(rotas, escola.professora, id)
      await transferir(escola, turma.bia)

      const desempenho = await lerDesempenho(escola.professora, escola.turma)
      expect(desempenho.lotesAprovados).toBe(1)
      expect(desempenho.alunos.map((aluno) => aluno.alunoId)).not.toContain(turma.bia.usuarioId)
      expect(desempenho.alunos).toHaveLength(4)
      // Sem a Bia (0 de 3 e 0 de 2): 8 de 9 e 3 de 6; abaixo da metade fica só a segunda Ana, na segunda habilidade.
      expect(desempenho.porHabilidade).toEqual([
        { habilidade: HABILIDADE_DAS_TRES_PRIMEIRAS, acertos: 8, total: 9, alunosAbaixoDaMetade: 0 },
        { habilidade: HABILIDADE_DAS_DUAS_ULTIMAS, acertos: 3, total: 6, alunosAbaixoDaMetade: 1 },
      ])
      expect(somaDosAlunos(desempenho)).toEqual(new Map(desempenho.porHabilidade.map((linha) => [linha.habilidade.codigo, [linha.acertos, linha.total]])))
      expect(JSON.stringify(desempenho)).not.toContain(turma.bia.usuarioId)
    })

    it('transferido antes de a professora encerrar: o trabalho entra no lote da turma em que foi feito, o resumo conta quem respondeu e fecha, o apresentado é o que a rota mostrou, e ele não lê o diagnóstico', async () => {
      const turma = await turmaNova()
      const { escola } = turma
      const id = await aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola, { conteudo: conteudoDeTeste(escola.materialId, `Lista sintética ${randomUUID()}`) }), escola.turma)
      // Os cinco respondem: Caio 4, Ana 5, a outra Ana 2, Bia 5 e Davi 4. A Bia sai da turma antes do encerramento.
      const respostas = [
        [turma.caio, [0, 1, 2, 3, 1]],
        [turma.ana1, [...GABARITO_DE_TESTE]],
        [turma.ana2, [0, 1, 3, 0, 1]],
        [turma.bia, [...GABARITO_DE_TESTE]],
        [turma.davi, [1, 1, 2, 3, 0]],
      ] as const
      for (const [aluno, marcadas] of respostas) await responderProva(rotas, aluno, id, marcadas)
      await transferir(escola, turma.bia)
      const entregaId = await encerrarAtividade(rotas, escola.professora, id)
      if (entregaId === null) throw new Error('o lote não nasceu')

      const lote = await lerCorrecao(escola.professora, id)
      // Corrigidos 5 de 5 que responderam; a turma, hoje, tem 4: o número dela vem à parte e não é o denominador.
      expect(lote.resumo).toMatchObject({ corrigidos: 5, alunosDaTurma: 4, mediaDeAcertos: 4 })
      expect(lote.resumo.distribuicao.reduce((soma, faixa) => soma + faixa.alunos, 0)).toBe(5)
      for (const questao of lote.resumo.porQuestao) expect(questao.porAlternativa.reduce((soma, alunos) => soma + alunos, 0) + questao.emBranco, `questão ${String(questao.numero)}`).toBe(5)
      expect(lote.resumo.porHabilidade.map((linha) => linha.total)).toEqual([15, 10])
      // A professora de X vê o trabalho da Bia, com o nome, no Aprovar.
      const todos = [...lote.destaques, ...lote.outras]
      expect(todos.map((correcao) => correcao.alunoId).sort()).toEqual([turma.caio, turma.ana1, turma.ana2, turma.bia, turma.davi].map((aluno) => aluno.usuarioId).sort())
      expect(todos.find((correcao) => correcao.alunoId === turma.bia.usuarioId)).toMatchObject({ nome: 'Aluna Sintética Bia Souza', acertos: 5, total: 5 })

      for (const destaque of lote.destaques) expect((await rotas.abrirDestaque(escola.professora, id, destaque.alunoId)).status).toBe(200)
      const mostrado = await lerCorrecao(escola.professora, id)
      const aprovado = loteAprovadoResponseSchema.parse((await rotas.aprovarLote(escola.professora, entregaId)).corpo)
      expect(aprovado.validacao.apresentado.resumo).toEqual(mostrado.resumo)
      expect(aprovado.validacao.apresentado.destaques).toEqual(mostrado.destaques.map((destaque) => ({ alunoId: destaque.alunoId, motivos: destaque.motivos })))
      const [gravada] = await sql<{ apresentado: unknown }>('select apresentado from validacao_do_lote where entrega_id = $1', [entregaId])
      expect(gravada?.apresentado).toEqual(aprovado.validacao.apresentado)

      // O alcance do aluno é pela turma atual: o diagnóstico da turma antiga responde como inexistente (lacuna desta fatia).
      expect(erro(await rotas.diagnostico(turma.bia, id))).toEqual(erro(await rotas.diagnostico(turma.bia, randomUUID())))
      expect((await rotas.diagnostico(turma.caio, id)).status).toBe(200)
      // E o desempenho de X, a foto de hoje, não a conta.
      const desempenho = await lerDesempenho(escola.professora, escola.turma)
      expect(desempenho.alunos.map((aluno) => aluno.alunoId)).not.toContain(turma.bia.usuarioId)
      expect(desempenho.porHabilidade.map((linha) => [linha.acertos, linha.total])).toEqual([
        [10, 12],
        [5, 8],
      ])
    })
  })

  describe('rastro', () => {
    it('nenhuma linha de log tem nome de aluno, de professora, enunciado nem explicação', () => {
      const log = linhasDeLog.join('\n')
      for (const proibido of [NOME_DO_ALUNO_DE_TESTE, NOME_REPETIDO, 'Bia Souza', 'Davi Rocha', NOME_DA_PROFESSORA_DE_TESTE, 'Enunciado sintético', EXPLICACAO_DE_TESTE]) expect(log).not.toContain(proibido)
    })
  })
})
