import { executarNoContexto, type ContextoDaRequisicao } from '@educa/nucleo'
import { desempenhoDaTurmaResponseSchema, minhasAtividadesResponseSchema, provaResponseSchema, type PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { subirApi, type ApiDeTeste, type RespostaHttp } from '../../test/api-com-sessao.js'
import { alunosComSessao, aplicarAtividade, aprovarOLote, criarAtividade, encerrarAtividade, GABARITO_DE_TESTE, responderProva, rotasDaAtividade, type RotasDaAtividade } from '../../test/atividade-de-teste.js'
import { copiarArtefatoParaOAnoAnterior, montarAnoAnterior, montarEscolaComAssistente, vincularProfessor, type EscolaComAssistente } from '../../test/escola-com-assistente.js'
import { lancarLote } from '../../test/escola-com-tutor.js'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../test/sessao-de-teste.js'
import { AtividadeAplicadaRepository } from './atividade-aplicada/atividade-aplicada.repository.js'
import { CorrecaoRepository } from './correcao/correcao.repository.js'
import { DesempenhoRepository } from './desempenho/desempenho.repository.js'
import { MinhaAtividadeRepository } from './minha-atividade/minha-atividade.repository.js'

/**
 * O isolamento do módulo da atividade (regra 10, itens 4, 5 e 6; regra 20, item 5): cada rota, batida por quem não é
 * dono dela, responde igual ao inexistente e não muda nada. A atividade é de Química, no 2ºB da escola A, aplicada pela
 * professora dela. Quem tenta: a professora da escola B, a colega de Química do 2ºC (outra turma), a professora de
 * Física do 2ºB (outra disciplina), a professora com vínculo ainda pendente em Química no 2ºB, a coordenação, o aluno do
 * 2ºC e o aluno da escola B.
 *
 * No fim, cada consulta do repository roda com o id certo e o contexto errado (a escola, ou o ano letivo): é o que
 * quebra se a cláusula de escopo sair, mesmo com o vínculo dando a mesma resposta pela rota.
 */
describe('isolamento da atividade e da correção', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  let pendente: SessaoDeTeste
  let alunoDoC: SessaoDeTeste
  let bia: SessaoDeTeste
  /** Aberta, com uma resposta do Caio. */
  let aberta: string
  /** Encerrada, com o lote pendente e a Bia em destaque (em branco). */
  let corrigida: { id: string; entregaId: string }
  /** Encerrada, com o lote aprovado. */
  let aprovada: { id: string; entregaId: string }
  let artefatoDeA: string
  let artefatoDeB: string

  const sql = async <Linha extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Linha[]> => (await bancada.pool.query(texto, valores)).rows as Linha[]
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const contar = async (tabela: string, filtro: string, valores: unknown[]): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from ${tabela} where ${filtro}`, valores))[0]?.total)
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  /** O retrato das linhas que nenhuma tentativa de fora pode mudar. */
  const retrato = async () => ({
    aplicacoes: await sql('select id, estado, encerrada_em from atividade_aplicada where escola_id = $1 order by id', [a.escolaId]),
    entregas: await sql('select id, estado, decidida_por from entrega where escola_id = $1 order by id', [a.escolaId]),
    correcoes: await sql('select id, destaque_aberto_em, destaque_aberto_por from correcao where escola_id = $1 order by id', [a.escolaId]),
    tentativas: await sql('select id, aluno_id, enviada_em from tentativa_atividade where escola_id = $1 order by id', [a.escolaId]),
    respostas: await sql('select id, aluno_id, questao, alternativa from resposta_atividade where escola_id = $1 order by id', [a.escolaId]),
    validacoes: await contar('validacao_do_lote', 'escola_id = $1', [a.escolaId]),
    auditorias: await contar('auditoria', `escola_id = $1 and acao in ('atividade.aplicada', 'correcao.destaque_aberto', 'lote.aprovado', 'turma.desempenho_lido')`, [a.escolaId]),
  })

  async function comLote(escola: EscolaComAssistente, alunos: readonly (readonly [SessaoDeTeste, readonly (number | null)[]])[]): Promise<{ id: string; entregaId: string }> {
    const id = await aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola), escola.turma)
    for (const [aluno, marcadas] of alunos) await responderProva(rotas, aluno, id, marcadas)
    const entregaId = await encerrarAtividade(rotas, escola.professora, id)
    if (entregaId === null) throw new Error('o lote não nasceu')
    return { id, entregaId }
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    pendente = await bancada.sessao(a.escolaId, 'professor')
    await vincularProfessor(bancada, a, pendente.usuarioId, a.turma, a.quimica, 'pendente')
    ;[bia] = (await alunosComSessao(bancada, a, a.turma, ['Aluna Sintética Bia Souza'])) as [SessaoDeTeste]
    ;[alunoDoC] = (await alunosComSessao(bancada, a, a.outraTurma, ['Aluno Sintético do 2ºC'])) as [SessaoDeTeste]

    aprovada = await comLote(a, [[a.aluno, [...GABARITO_DE_TESTE]]])
    await aprovarOLote(rotas, a.professora, aprovada.id)
    corrigida = await comLote(a, [[a.aluno, [0, 1, 2, 0, 0]], [bia, []]])
    artefatoDeA = await criarAtividade(bancada, a)
    aberta = await aplicarAtividade(rotas, a.professora, artefatoDeA, a.turma, true)
    await responderProva(rotas, a.aluno, aberta, [0], false)
    artefatoDeB = await criarAtividade(bancada, b)
    // A escola B tem a atividade dela, que as consultas de A alcançariam sem a cláusula de escola.
    await comLote(b, [[b.aluno, [...GABARITO_DE_TESTE]]])
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
  })

  describe('as rotas da professora', () => {
    it('encerrar, ler a correção, abrir destaque e aprovar o lote, por quem não é a professora daquela turma e daquela disciplina, respondem como o inexistente e não mudam nada', async () => {
      const antes = await retrato()
      const inexistente = randomUUID()
      for (const sessao of [b.professora, a.colega, a.deFisica, pendente, a.coordenacao, a.aluno]) {
        for (const [daAtividade, doInexistente] of [
          [await rotas.encerrar(sessao, aberta), await rotas.encerrar(sessao, inexistente)],
          [await rotas.correcao(sessao, corrigida.id), await rotas.correcao(sessao, inexistente)],
          [await rotas.abrirDestaque(sessao, corrigida.id, bia.usuarioId), await rotas.abrirDestaque(sessao, inexistente, bia.usuarioId)],
          [await rotas.aprovarLote(sessao, corrigida.entregaId), await rotas.aprovarLote(sessao, inexistente)],
          [await rotas.correcao(sessao, aprovada.id), await rotas.correcao(sessao, inexistente)],
        ] as const) {
          expect(erro(daAtividade)).toEqual(NAO_ENCONTRADO)
          expect(erro(doInexistente)).toEqual(erro(daAtividade))
        }
      }
      expect(await retrato()).toEqual(antes)
    })

    it('a listagem da turma só responde à professora dela na disciplina: as outras recebem a lista vazia de uma turma inexistente, e coordenação e aluno não têm a rota', async () => {
      const daProfessora = (await rotas.listar(a.professora, `?turmaId=${a.turma}`)).corpo['itens'] as { id: string }[]
      expect(daProfessora.map((item) => item.id).sort()).toEqual([aberta, corrigida.id, aprovada.id].sort())
      for (const sessao of [b.professora, a.colega, a.deFisica, pendente]) {
        const resposta = await rotas.listar(sessao, `?turmaId=${a.turma}`)
        expect({ status: resposta.status, corpo: resposta.corpo }).toEqual({ status: 200, corpo: { itens: [] } })
        expect((await rotas.listar(sessao, `?turmaId=${randomUUID()}`)).corpo).toEqual(resposta.corpo)
      }
      for (const sessao of [a.coordenacao, a.aluno]) expect(erro(await rotas.listar(sessao, `?turmaId=${a.turma}`))).toEqual(NAO_ENCONTRADO)
    })

    it('aplicar exige vínculo confirmado na turma do artefato, na turma de destino e na disciplina dele: fora disso, igual ao inexistente, sem aplicação e sem auditoria', async () => {
      const antes = await retrato()
      const corpo = (artefatoId: string, turmaId: string) => ({ artefatoId, turmaId, avaliativa: false })
      const doInexistente = erro(await rotas.aplicar(a.professora, corpo(randomUUID(), a.turma)))
      expect(doInexistente).toEqual(NAO_ENCONTRADO)
      const tentativas: [SessaoDeTeste, string, string][] = [
        // De outra escola: o artefato de A, na turma de A ou na dela.
        [b.professora, artefatoDeA, a.turma],
        [b.professora, artefatoDeA, b.turma],
        // A professora de A com o artefato de B, ou com a turma de B.
        [a.professora, artefatoDeB, a.turma],
        [a.professora, artefatoDeA, b.turma],
        // A colega do 2ºC não alcança o artefato do 2ºB, nem para aplicar na turma dela.
        [a.colega, artefatoDeA, a.turma],
        [a.colega, artefatoDeA, a.outraTurma],
        // A professora de Física do 2ºB não aplica a atividade de Química.
        [a.deFisica, artefatoDeA, a.turma],
        // O vínculo pendente não dá alcance.
        [pendente, artefatoDeA, a.turma],
        // A professora do 2ºB não aplica no 2ºC, onde não leciona.
        [a.professora, artefatoDeA, a.outraTurma],
        [a.professora, artefatoDeA, randomUUID()],
      ]
      for (const [sessao, artefatoId, turmaId] of tentativas) expect(erro(await rotas.aplicar(sessao, corpo(artefatoId, turmaId)))).toEqual(doInexistente)
      for (const sessao of [a.coordenacao, a.aluno]) expect(erro(await rotas.aplicar(sessao, corpo(artefatoDeA, a.turma)))).toEqual(NAO_ENCONTRADO)
      expect(await retrato()).toEqual(antes)
      expect(await contar('atividade_aplicada', 'escola_id = $1', [b.escolaId])).toBe(1)
    })

    it('a professora que ganha vínculo confirmado em Química numa segunda turma aplica lá a atividade que criou na primeira', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      await vincularProfessor(bancada, c, c.professora.usuarioId, c.outraTurma, c.quimica)
      const resposta = await rotas.aplicar(c.professora, { artefatoId: await criarAtividade(bancada, c), turmaId: c.outraTurma, avaliativa: false })
      expect(resposta.status).toBe(201)
      expect(resposta.corpo).toMatchObject({ turmaId: c.outraTurma })
    })

    it('o desempenho da turma: outra escola e outra turma respondem como inexistente, sem auditoria; a professora de Física lê a turma dela sem nada de Química', async () => {
      const antes = await retrato()
      const FINALIDADE = '?finalidade=acompanhamento_pedagogico'
      const daProfessora = desempenhoDaTurmaResponseSchema.parse((await rotas.desempenho(a.professora, a.turma)).corpo)
      expect(daProfessora.lotesAprovados).toBe(1)
      expect(daProfessora.alunos.find((aluno) => aluno.alunoId === a.aluno.usuarioId)).toMatchObject({ acertos: 5, total: 5 })

      for (const sessao of [b.professora, a.colega, pendente]) {
        expect(erro(await rotas.desempenho(sessao, a.turma))).toEqual(NAO_ENCONTRADO)
        expect(erro(await rotas.desempenho(sessao, randomUUID()))).toEqual(NAO_ENCONTRADO)
      }
      // A coordenação de B, com finalidade: a turma de A não existe para ela, e nada é registrado em escola nenhuma.
      expect(erro(await rotas.desempenho(b.coordenacao, a.turma, FINALIDADE))).toEqual(NAO_ENCONTRADO)
      expect(erro(await rotas.desempenho(b.coordenacao, randomUUID(), FINALIDADE))).toEqual(NAO_ENCONTRADO)
      expect(await contar('auditoria', `acao = 'turma.desempenho_lido' and (escola_id = $1 or entidade_id = $2)`, [b.escolaId, a.turma])).toBe(0)
      for (const sessao of [a.aluno, alunoDoC]) expect(erro(await rotas.desempenho(sessao, a.turma))).toEqual(NAO_ENCONTRADO)

      // A professora de Física é professora do 2ºB: lê a turma, e não lê o acerto de Química (D45: o desempenho da turma numa disciplina é o de uma professora só).
      const deFisica = desempenhoDaTurmaResponseSchema.parse((await rotas.desempenho(a.deFisica, a.turma)).corpo)
      expect(deFisica).toMatchObject({ lotesAprovados: 0, porHabilidade: [] })
      expect(deFisica.alunos.every((aluno) => aluno.total === 0 && aluno.porHabilidade.length === 0)).toBe(true)
      expect(await retrato()).toEqual(antes)
    })
  })

  describe('as rotas do aluno', () => {
    it('o aluno de outra turma e o de outra escola não listam, não abrem, não respondem, não enviam nem leem o diagnóstico: igual ao inexistente, e nenhuma tentativa nasce', async () => {
      const antes = await retrato()
      const inexistente = randomUUID()
      for (const aluno of [alunoDoC, b.aluno]) {
        const lista = minhasAtividadesResponseSchema.parse((await rotas.minhas(aluno)).corpo)
        for (const id of [aberta, corrigida.id, aprovada.id]) expect(lista.itens.map((item) => item.id)).not.toContain(id)
        for (const [daAtividade, doInexistente] of [
          [await rotas.prova(aluno, aberta), await rotas.prova(aluno, inexistente)],
          [await rotas.responder(aluno, aberta, 1, 0), await rotas.responder(aluno, inexistente, 1, 0)],
          [await rotas.enviar(aluno, aberta), await rotas.enviar(aluno, inexistente)],
          [await rotas.diagnostico(aluno, aprovada.id), await rotas.diagnostico(aluno, inexistente)],
          [await rotas.prova(aluno, aprovada.id), await rotas.prova(aluno, inexistente)],
        ] as const) {
          expect(erro(daAtividade)).toEqual(NAO_ENCONTRADO)
          expect(erro(doInexistente)).toEqual(erro(daAtividade))
        }
      }
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(alunoDoC)).corpo).itens).toEqual([])
      expect(await retrato()).toEqual(antes)
    })

    it('professora e coordenação não têm as rotas do aluno, e o aluno não tem as da professora', async () => {
      const antes = await retrato()
      for (const sessao of [a.professora, a.coordenacao]) {
        for (const resposta of [await rotas.minhas(sessao), await rotas.prova(sessao, aberta), await rotas.responder(sessao, aberta, 1, 0), await rotas.enviar(sessao, aberta), await rotas.diagnostico(sessao, aprovada.id)]) {
          expect(erro(resposta)).toEqual(NAO_ENCONTRADO)
        }
      }
      for (const resposta of [await rotas.listar(a.aluno, `?turmaId=${a.turma}`), await rotas.encerrar(a.aluno, aberta), await rotas.correcao(a.aluno, corrigida.id), await rotas.aprovarLote(a.aluno, corrigida.entregaId)]) {
        expect(erro(resposta)).toEqual(NAO_ENCONTRADO)
      }
      expect(await retrato()).toEqual(antes)
    })

    it('cada aluno só lê e grava o que é dele: a colega da mesma turma não vê a resposta do Caio, e a dela não troca a dele', async () => {
      // Caio marcou a alternativa 0 na questão 1 da atividade aberta. A Bia abre a mesma prova e marca outra.
      const daBia = provaResponseSchema.parse((await rotas.prova(bia, aberta)).corpo)
      expect(daBia.respostas).toEqual([])
      expect((await rotas.responder(bia, aberta, 1, 3)).status).toBe(200)
      expect(provaResponseSchema.parse((await rotas.prova(a.aluno, aberta)).corpo).respostas).toEqual([{ questao: 1, alternativa: 0, sequencia: 1 }])
      expect(provaResponseSchema.parse((await rotas.prova(bia, aberta)).corpo).respostas).toEqual([{ questao: 1, alternativa: 3, sequencia: 1 }])
      expect(await sql('select aluno_id, alternativa from resposta_atividade where atividade_aplicada_id = $1 order by alternativa', [aberta])).toEqual([
        { aluno_id: a.aluno.usuarioId, alternativa: 0 },
        { aluno_id: bia.usuarioId, alternativa: 3 },
      ])
      // A Bia não tem correção no lote aprovado (não abriu aquela atividade): o diagnóstico do Caio não é dela.
      expect(erro(await rotas.diagnostico(bia, aprovada.id))).toEqual(NAO_ENCONTRADO)
      expect((await rotas.diagnostico(a.aluno, aprovada.id)).status).toBe(200)
      // Não existe parâmetro de aluno nas rotas do aluno: o id de colega na consulta ou no corpo é entrada inválida.
      expect(erro(await rotas.minhas(bia, `?alunoId=${a.aluno.usuarioId}`))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      expect(erro(await rotas.pedir(bia, 'PUT', `/v1/atividades-aplicadas/${aberta}/respostas/2`, { alternativa: 0, alunoId: a.aluno.usuarioId }))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
    })

    it('o aluno transferido de turma deixa de alcançar a atividade da turma antiga', async () => {
      const c = await montarEscolaComAssistente(api, bancada)
      const id = await aplicarAtividade(rotas, c.professora, await criarAtividade(bancada, c), c.turma)
      await responderProva(rotas, c.aluno, id, [0], false)
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [c.escolaId, c.aluno.usuarioId, c.turma])
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [c.escolaId, c.anoLetivoId, c.aluno.usuarioId, c.outraTurma, c.coordenacao.usuarioId])
      expect(minhasAtividadesResponseSchema.parse((await rotas.minhas(c.aluno)).corpo).itens).toEqual([])
      for (const resposta of [await rotas.prova(c.aluno, id), await rotas.responder(c.aluno, id, 2, 1), await rotas.enviar(c.aluno, id)]) expect(erro(resposta)).toEqual(NAO_ENCONTRADO)
      expect(await sql('select questao from resposta_atividade where atividade_aplicada_id = $1', [id])).toEqual([{ questao: 1 }])
    })
  })

  describe('no repository: o id certo com o contexto errado', () => {
    const contexto = (escolaId: string, anoLetivoId: string, sessao: SessaoDeTeste, papel: PapelDeUsuario): ContextoDaRequisicao => ({ requisicaoId: randomUUID(), escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId })
    const vazio = (lido: unknown): boolean => lido === undefined || lido === false || lido === 0 || (Array.isArray(lido) && lido.length === 0) || (lido instanceof Map && lido.size === 0)

    it('cada leitura acha o dado no contexto da dona, e não acha nada com a escola trocada nem com o ano letivo trocado', async () => {
      const { banco } = bancada
      const pagina = { limite: 50 }
      const daProfessora: Record<string, () => Promise<unknown>> = {
        'aplicação por id': () => new AtividadeAplicadaRepository(banco).porId(aberta),
        'aplicações da turma': () => new AtividadeAplicadaRepository(banco).listar({ turmaId: a.turma, ...pagina }),
        'aplicação travada': () => new AtividadeAplicadaRepository(banco).travar(aberta),
        'artefato para aplicar': () => new AtividadeAplicadaRepository(banco).artefatoParaAplicar(artefatoDeA),
        'turma em que pode aplicar': () => new AtividadeAplicadaRepository(banco).podeAplicarNaTurma(a.turma, a.quimica),
        'lote da aplicação': () => new CorrecaoRepository(banco).loteDaAplicacao(corrigida.id),
        'lote por id': () => new CorrecaoRepository(banco).lote(corrigida.entregaId),
        'lote travado': () => new CorrecaoRepository(banco).travarLote(corrigida.entregaId),
        'lote vigente': () => new CorrecaoRepository(banco).temLoteVigente(corrigida.id),
        'respostas da aplicação': () => new CorrecaoRepository(banco).respostasPorAluno(corrigida.id),
        'correções do lote': () => new CorrecaoRepository(banco).correcoesDoLote(corrigida.entregaId),
        'histórico aprovado': () => new CorrecaoRepository(banco).historicoAprovado([a.aluno.usuarioId], a.quimica),
        'validação do lote': () => new CorrecaoRepository(banco).validacao(aprovada.entregaId),
        'turma da escola': () => new DesempenhoRepository(banco).turmaDaEscola(a.turma),
        'disciplinas da professora': () => new DesempenhoRepository(banco).disciplinasDaProfessora(a.turma),
        'lotes aprovados': () => new DesempenhoRepository(banco).lotesAprovados(a.turma, 'todas'),
        'acertos por aluno': () => new DesempenhoRepository(banco).acertosPorAlunoEHabilidade(a.turma, 'todas'),
        'descrições das habilidades': () => new DesempenhoRepository(banco).descricoesDasHabilidades(a.turma, 'todas'),
        'alunos da turma': () => new DesempenhoRepository(banco).alunos(a.turma),
      }
      const doAluno: Record<string, () => Promise<unknown>> = {
        'minhas atividades': () => new MinhaAtividadeRepository(banco).listar(pagina),
        'prova': () => new MinhaAtividadeRepository(banco).prova(aberta),
        'atividade para gravar': () => new MinhaAtividadeRepository(banco).travarParaGravar(aberta),
        'minha tentativa': () => new MinhaAtividadeRepository(banco).tentativa(aberta),
        'minhas respostas': () => new MinhaAtividadeRepository(banco).respostas(aberta),
        'meu diagnóstico': () => new MinhaAtividadeRepository(banco).diagnostico(aprovada.id),
      }
      const outroAno = randomUUID()
      for (const [leituras, sessao, papel] of [[daProfessora, a.professora, 'professor'], [doAluno, a.aluno, 'aluno']] as const) {
        for (const [nome, ler] of Object.entries(leituras)) {
          expect(vazio(await executarNoContexto(contexto(a.escolaId, a.anoLetivoId, sessao, papel), ler)), `${nome}: acha no contexto da dona`).toBe(false)
          expect(vazio(await executarNoContexto(contexto(b.escolaId, a.anoLetivoId, sessao, papel), ler)), `${nome}: com a escola trocada`).toBe(true)
          expect(vazio(await executarNoContexto(contexto(a.escolaId, outroAno, sessao, papel), ler)), `${nome}: com o ano letivo trocado`).toBe(true)
        }
      }
    })

    it('com o ano anterior real e vínculo confirmado nele, cada leitura do ano anterior não acha nada no ano em curso, e acha no ano dela', async () => {
      const { banco } = bancada
      const anterior = await montarAnoAnterior(bancada, a)
      const deAntes = { ...a, anoLetivoId: anterior.anoLetivoId }
      // Um aluno que só existiu no 2ºB de 2025: lá ele fez a lista, e o lote foi aprovado pela professora (que tem vínculo confirmado lá).
      const [antigo] = (await alunosComSessao(bancada, deAntes, anterior.turmaId, ['Aluno Sintético de 2025'])) as [SessaoDeTeste]
      const { artefatoId } = await copiarArtefatoParaOAnoAnterior(bancada, a, anterior, artefatoDeA)
      const [aplicacao] = await sql<{ id: string }>('insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, false, $5) returning id', [a.escolaId, anterior.anoLetivoId, anterior.turmaId, artefatoId, a.professora.usuarioId])
      const aplicacaoId = aplicacao?.id ?? ''
      const entregaId = await lancarLote(bancada, deAntes, aplicacaoId, 'aprovada', { alunoId: antigo.usuarioId, acertos: 2, total: 5, porHabilidade: [{ codigo: 'QUI.EM.05', acertos: 2, total: 3 }, { codigo: 'QUI.EM.06', acertos: 0, total: 2 }] }, anterior.turmaId)

      const daProfessora: Record<string, () => Promise<unknown>> = {
        'aplicação por id': () => new AtividadeAplicadaRepository(banco).porId(aplicacaoId),
        'aplicações da turma': () => new AtividadeAplicadaRepository(banco).listar({ turmaId: anterior.turmaId, limite: 50 }),
        'aplicação travada': () => new AtividadeAplicadaRepository(banco).travar(aplicacaoId),
        'lote da aplicação': () => new CorrecaoRepository(banco).loteDaAplicacao(aplicacaoId),
        'lote por id': () => new CorrecaoRepository(banco).lote(entregaId),
        'lote vigente': () => new CorrecaoRepository(banco).temLoteVigente(aplicacaoId),
        'respostas da aplicação': () => new CorrecaoRepository(banco).respostasPorAluno(aplicacaoId),
        'correções do lote': () => new CorrecaoRepository(banco).correcoesDoLote(entregaId),
        'histórico aprovado': () => new CorrecaoRepository(banco).historicoAprovado([antigo.usuarioId], a.quimica),
        'validação do lote': () => new CorrecaoRepository(banco).validacao(entregaId),
        'turma da escola': () => new DesempenhoRepository(banco).turmaDaEscola(anterior.turmaId),
        'disciplinas da professora': () => new DesempenhoRepository(banco).disciplinasDaProfessora(anterior.turmaId),
        'lotes aprovados': () => new DesempenhoRepository(banco).lotesAprovados(anterior.turmaId, 'todas'),
        'acertos por aluno': () => new DesempenhoRepository(banco).acertosPorAlunoEHabilidade(anterior.turmaId, 'todas'),
        'descrições das habilidades': () => new DesempenhoRepository(banco).descricoesDasHabilidades(anterior.turmaId, 'todas'),
        'alunos da turma': () => new DesempenhoRepository(banco).alunos(anterior.turmaId),
      }
      const doAluno: Record<string, () => Promise<unknown>> = {
        'minhas atividades': () => new MinhaAtividadeRepository(banco).listar({ limite: 50 }),
        'minha tentativa': () => new MinhaAtividadeRepository(banco).tentativa(aplicacaoId),
        'meu diagnóstico': () => new MinhaAtividadeRepository(banco).diagnostico(aplicacaoId),
      }
      for (const [leituras, sessao, papel] of [[daProfessora, a.professora, 'professor'], [doAluno, antigo, 'aluno']] as const) {
        for (const [nome, ler] of Object.entries(leituras)) {
          expect(vazio(await executarNoContexto(contexto(a.escolaId, anterior.anoLetivoId, sessao, papel), ler)), `${nome}: acha no ano dela`).toBe(false)
          expect(vazio(await executarNoContexto(contexto(a.escolaId, a.anoLetivoId, sessao, papel), ler)), `${nome}: no ano em curso`).toBe(true)
        }
      }
      // Pela rota, no ano em curso, a professora recebe a resposta do inexistente.
      expect(erro(await rotas.correcao(a.professora, aplicacaoId))).toEqual(NAO_ENCONTRADO)
      expect(erro(await rotas.desempenho(a.professora, anterior.turmaId))).toEqual(NAO_ENCONTRADO)
    })

    it('cada escrita, com a escola ou o ano trocado, não grava nada', async () => {
      const { banco } = bancada
      const antes = await retrato()
      const outroAno = randomUUID()
      for (const [escolaId, anoLetivoId] of [[b.escolaId, a.anoLetivoId], [a.escolaId, outroAno]] as const) {
        const comoProfessora = <T>(funcao: () => Promise<T>) => executarNoContexto(contexto(escolaId, anoLetivoId, a.professora, 'professor'), funcao)
        const comoAluno = <T>(funcao: () => Promise<T>) => executarNoContexto(contexto(escolaId, anoLetivoId, a.aluno, 'aluno'), funcao)
        await comoProfessora(() => new AtividadeAplicadaRepository(banco).encerrar(aberta))
        expect(await comoProfessora(() => new CorrecaoRepository(banco).abrirDestaque(corrigida.entregaId, bia.usuarioId))).toBe(false)
        expect(await comoProfessora(() => new CorrecaoRepository(banco).aprovar(corrigida.entregaId))).toBe(false)
        await comoAluno(() => new MinhaAtividadeRepository(banco).enviar(aberta))
      }
      expect(await retrato()).toEqual(antes)
    })

    it('a professora de outra turma, a de outra disciplina e a de vínculo pendente, no contexto da própria escola, não acham a aplicação nem o lote', async () => {
      const { banco } = bancada
      for (const sessao of [a.colega, a.deFisica, pendente, a.coordenacao]) {
        const comoEla = <T>(funcao: () => Promise<T>) => executarNoContexto(contexto(a.escolaId, a.anoLetivoId, sessao, 'professor'), funcao)
        expect(await comoEla(() => new AtividadeAplicadaRepository(banco).porId(aberta))).toBeUndefined()
        expect(await comoEla(() => new AtividadeAplicadaRepository(banco).travar(aberta))).toBeUndefined()
        expect(await comoEla(() => new AtividadeAplicadaRepository(banco).artefatoParaAplicar(artefatoDeA))).toBeUndefined()
        expect(await comoEla(() => new CorrecaoRepository(banco).loteDaAplicacao(corrigida.id))).toBeUndefined()
        expect(await comoEla(() => new CorrecaoRepository(banco).travarLote(corrigida.entregaId))).toBeUndefined()
        expect(await comoEla(() => new CorrecaoRepository(banco).aprovar(corrigida.entregaId))).toBe(false)
      }
      // O aluno de outra turma, no contexto da própria escola.
      const comoAlunoDoC = <T>(funcao: () => Promise<T>) => executarNoContexto(contexto(a.escolaId, a.anoLetivoId, alunoDoC, 'aluno'), funcao)
      expect(await comoAlunoDoC(() => new MinhaAtividadeRepository(banco).prova(aberta))).toBeUndefined()
      expect(await comoAlunoDoC(() => new MinhaAtividadeRepository(banco).travarParaGravar(aberta))).toBeUndefined()
      expect(await comoAlunoDoC(() => new MinhaAtividadeRepository(banco).diagnostico(aprovada.id))).toBeUndefined()
      expect(await comoAlunoDoC(() => new MinhaAtividadeRepository(banco).listar({ limite: 50 }))).toEqual([])
      // A colega da mesma turma não lê a tentativa nem as respostas do Caio: as leituras são sempre as dela.
      const comoBia = <T>(funcao: () => Promise<T>) => executarNoContexto(contexto(a.escolaId, a.anoLetivoId, bia, 'aluno'), funcao)
      expect(await comoBia(() => new MinhaAtividadeRepository(banco).diagnostico(aprovada.id))).toBeUndefined()
      expect(await comoBia(() => new MinhaAtividadeRepository(banco).tentativa(aprovada.id))).toBeUndefined()
      expect(await comoBia(() => new MinhaAtividadeRepository(banco).respostas(aprovada.id))).toEqual([])
    })
  })
})
