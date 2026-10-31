import { type AgenteExecutor, type InProcessAgenteExecutor, type LLMProvider, type SuspensaoDeFuncao } from '@educa/core'
import { conteudoDeAtividadeSchema, artefatoResponseSchema, listaDeArtefatosResponseSchema, listaDeEntregasResponseSchema, timeResponseSchema, type ChaveDeFuncao, type ConteudoDeAtividade } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { normalizarTexto, textoDaPagina } from '../../../../tools/demonstracao/conteudo-estequiometria.ts'
import { extrairTextoPorPagina } from '../../../../tools/demonstracao/extrair-texto.ts'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from '../../test/api-com-sessao.js'
import {
  comoPessoa,
  contarNaEscola,
  copiarArtefatoParaOAnoAnterior,
  dispararExecucao,
  enviarMaterialDeDemonstracao,
  execucaoTerminada,
  montarAnoAnterior,
  montarEscolaComAssistente,
  NOME_DA_PROFESSORA_DE_TESTE,
  NOME_DO_ALUNO_DE_TESTE,
  vincularProfessor,
  zerarLimiteDePedidosDeIa,
  type EscolaComAssistente,
} from '../../test/escola-com-assistente.js'
import { variacaoDoPdf } from '../../test/material-de-teste.js'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../test/sessao-de-teste.js'
import { LimiteDePedidosDeIa } from '../assistente/limite-de-pedidos-de-ia.js'
import { AgendadorDeExecucoes } from '../ia/agendador-de-execucoes.js'
import { EXECUTOR_DE_AGENTE, LLM_PROVIDER, SUSPENSAO_DE_FUNCAO } from '../ia/ia.module.js'
import { BuscaDeTrechos } from '../material/busca-de-trechos.js'
import { ArtefatoRepository } from './artefato.repository.js'
import { ArtefatoService } from './artefato.service.js'
import { DURACAO_PADRAO_DO_PLANO_DE_AULA_MIN, FerramentasService } from './ferramentas.service.js'
import { AVISO_DE_IA_NO_PDF, AVISO_DE_IA_NO_RASCUNHO, MARCA_DE_RASCUNHO } from './pdf-do-artefato.js'

/**
 * As ferramentas e o artefato (MVP, A2), com a API montada pelo `AppModule`, o Postgres do compose de teste, o material
 * de demonstração enviado pela rota da coordenação e o adaptador falso de IA. Onde o teste precisa de uma saída que o
 * adaptador falso não dá (página que não foi entregue, gabarito trocado), o service roda com um provedor de mentira
 * atrás do mesmo agendador, do mesmo executor e do mesmo banco.
 *
 * Em cada caso de isolamento, a outra escola (ou a colega) tem o artefato que a consulta alcançaria sem a cláusula de
 * escopo do repository (regra 10, item 5).
 */
describe('ferramentas e artefato', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let executor: InProcessAgenteExecutor
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  /** A atividade objetiva que a professora de A gerou, e a que a de B gerou. */
  let atividadeDeA: string
  let atividadeDeB: string

  const sql = (texto: string, valores: unknown[] = []) => bancada.pool.query(texto, valores)
  const pedir = async (sessao: SessaoDeTeste, metodo: string, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, metodo, caminho, await sessao.tokenNovo(), corpo)
  const get = (sessao: SessaoDeTeste, caminho: string) => pedir(sessao, 'GET', caminho)
  const parametros = (escola: EscolaComAssistente, tema: string, extra: Record<string, unknown> = {}) => ({ turmaId: escola.turma, disciplinaId: escola.quimica, tema, ...extra })
  const artefatoDe = async (sessao: SessaoDeTeste, id: string) => artefatoResponseSchema.parse((await get(sessao, `/v1/artefatos/${id}`)).corpo)
  const suspender = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) => sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
  const retomar = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) =>
    sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $3 where escola_id = $1 and funcao = $2 and retomada_em is null', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
  /** Sem espaço nenhum: a quebra de linha do PDF cai onde a largura da página manda. */
  const semEspaco = (texto: string) => texto.replace(/\s+/gu, '')
  const semId = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })

  async function gerar(escola: EscolaComAssistente, ferramenta: string, tema: string, extra: Record<string, unknown> = {}): Promise<string> {
    const execucao = await execucaoTerminada(api, escola.professora, await dispararExecucao(api, escola.professora, `/v1/ferramentas/${ferramenta}/gerar`, parametros(escola, tema, extra)))
    if (execucao.estado !== 'concluida' || execucao.resultado?.artefatoId === undefined) throw new Error(`a geração não concluiu: ${execucao.erro ?? execucao.estado}`)
    return execucao.resultado.artefatoId
  }

  /** O PDF como o navegador o recebe: os bytes e os cabeçalhos. */
  async function baixarPdf(sessao: SessaoDeTeste, id: string): Promise<{ status: number; tipo: string | null; disposicao: string | null; cache: string | null; bytes: Uint8Array }> {
    const resposta = await fetch(`${api.url}/v1/artefatos/${id}/pdf`, { headers: { Authorization: `Bearer ${await sessao.tokenNovo()}` } })
    return { status: resposta.status, tipo: resposta.headers.get('content-type'), disposicao: resposta.headers.get('content-disposition'), cache: resposta.headers.get('cache-control'), bytes: new Uint8Array(await resposta.arrayBuffer()) }
  }

  /** Os services atrás de um provedor de mentira, com o agendador, o executor, a suspensão e o banco de verdade. */
  function comProvedor(gerarSaida: (pedido: { entrada: unknown; execucaoId?: string }) => Promise<unknown>, antesDeRodar: Promise<void> = Promise.resolve()) {
    const ia = { gerar: async (pedido: { entrada: unknown; execucaoId?: string }) => ({ saida: await gerarSaida(pedido), medicao: {} }) } as unknown as LLMProvider
    // `antesDeRodar` segura o trabalho da execução até o teste liberar: é o intervalo entre o `202` e a execução.
    const comEspera: AgenteExecutor = { agendar: (execucao, trabalho) => executor.agendar(execucao, async (sinal) => (await antesDeRodar, trabalho(sinal))) }
    const agendador = new AgendadorDeExecucoes(bancada.banco, ia, comEspera, api.app.get<SuspensaoDeFuncao>(SUSPENSAO_DE_FUNCAO))
    const limite = api.app.get(LimiteDePedidosDeIa)
    return { ferramentas: new FerramentasService(bancada.banco, agendador, limite, api.app.get(BuscaDeTrechos)), artefatos: new ArtefatoService(bancada.banco, agendador, limite) }
  }
  const falso = () => api.app.get<LLMProvider>(LLM_PROVIDER)

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
    executor = api.app.get<InProcessAgenteExecutor>(EXECUTOR_DE_AGENTE)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    atividadeDeA = await gerar(a, 'atividade_objetiva', 'reagente limitante e reagente em excesso', { quantidade: 4 })
    atividadeDeB = await gerar(b, 'atividade_objetiva', 'reagente limitante', { quantidade: 3 })
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    await bancada.fechar()
  })

  describe('A2 de ponta a ponta', () => {
    it('a professora pede no chat, aceita a proposta, gera a atividade com a página citada, exporta o PDF, pede a versão adaptada, que nasce pendente, e aprova', async () => {
      // 1. O pedido no chat vira a pergunta "quer abrir a ferramenta?", com os parâmetros para o cartão.
      const conversa = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', { texto: 'monta uma atividade de estequiometria', turmaId: a.turma, disciplinaId: a.quimica }))
      const proposta = conversa.resultado?.mensagem?.['proposta'] as { ferramenta: string; parametros: Record<string, unknown> }
      expect(proposta.ferramenta).toBe('atividade_objetiva')

      // 2. Ela aceita: o cartão manda os parâmetros da proposta para a mesma rota da ferramenta.
      const geracao = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, `/v1/ferramentas/${proposta.ferramenta}/gerar`, proposta.parametros))
      expect(geracao).toMatchObject({ estado: 'concluida', resultado: { tipo: 'artefato', entregaId: null } })
      const artefatoId = geracao.resultado?.artefatoId ?? ''
      const artefato = await artefatoDe(a.professora, artefatoId)
      expect(artefato).toMatchObject({ tipo: 'atividade_objetiva', turmaId: a.turma, disciplinaId: a.quimica, origemId: null, adaptacao: null, entrega: null, versoesAdaptadas: [], aplicacoes: [] })
      const conteudo = conteudoDeAtividadeSchema.parse(artefato.conteudo)
      expect(conteudo.questoes).toHaveLength(5)
      // Toda questão cita o material da escola, e o trecho citado está mesmo na página citada.
      for (const questao of conteudo.questoes) {
        expect(questao.citacao.materialId).toBe(a.materialId)
        expect(normalizarTexto(textoDaPagina(questao.citacao.pagina))).toContain(normalizarTexto(questao.citacao.trecho).replace(/…$/u, ''))
        expect(questao.alternativas).toHaveLength(4)
      }
      // O artefato é rascunho da professora: não nasce com entrega, e nada foi a aluno nenhum.
      expect(await contarNaEscola(bancada, 'entrega', a.escolaId, `artefato_id = '${artefatoId}'`)).toBe(0)

      // 3. O PDF: as questões e o gabarito, o aviso de IA, e nenhum nome de pessoa nem de turma.
      const pdf = await baixarPdf(a.professora, artefatoId)
      expect(pdf).toMatchObject({ status: 200, tipo: 'application/pdf', cache: 'no-store' })
      expect(pdf.disposicao).toMatch(/^attachment; filename="[a-z0-9-]+\.pdf"$/u)
      const paginas = (await extrairTextoPorPagina(pdf.bytes)).map(normalizarTexto)
      const texto = paginas.join(' ')
      expect(texto).toContain(normalizarTexto(AVISO_DE_IA_NO_PDF))
      conteudo.questoes.forEach((questao, indice) => {
        expect(semEspaco(texto)).toContain(semEspaco(`${String(indice + 1)}. ${questao.enunciado}`))
        expect(texto).toContain(`p. ${String(questao.citacao.pagina)}`)
      })
      expect(paginas.at(-1)).toContain('Gabarito')
      expect(paginas.slice(0, -1).join(' ')).not.toContain('Gabarito')
      for (const proibido of [NOME_DA_PROFESSORA_DE_TESTE, NOME_DO_ALUNO_DE_TESTE, 'Pessoa sintética', '2ºB', '2ºC']) expect(texto).not.toContain(proibido)
      expect(texto).not.toMatch(/[�₀-₉→]/u)

      // 4. A versão adaptada: só os tipos e o tempo extra. Nasce com a entrega pendente, e ninguém decidiu por ela.
      const adaptacao = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, `/v1/artefatos/${artefatoId}/adaptar`, { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 25 }))
      expect(adaptacao).toMatchObject({ estado: 'concluida', resultado: { tipo: 'artefato' } })
      const adaptadaId = adaptacao.resultado?.artefatoId ?? ''
      const entregaId = adaptacao.resultado?.entregaId ?? ''
      const adaptada = await artefatoDe(a.professora, adaptadaId)
      expect(adaptada).toMatchObject({ origemId: artefatoId, turmaId: a.turma, adaptacao: { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 25 }, entrega: { id: entregaId, estado: 'pendente', decididaEm: null } })
      const questoesAdaptadas = conteudoDeAtividadeSchema.parse(adaptada.conteudo).questoes
      expect(questoesAdaptadas.map((questao) => [questao.gabarito, questao.habilidade, questao.citacao])).toEqual(conteudo.questoes.map((questao) => [questao.gabarito, questao.habilidade, questao.citacao]))
      expect((await artefatoDe(a.professora, artefatoId)).versoesAdaptadas.map((versao) => [versao.id, versao.entrega?.estado])).toEqual([[adaptadaId, 'pendente']])
      const { rows: pendente } = await sql('select estado, funcao, tipo, turma_id, decidida_por, decidida_em from entrega where id = $1', [entregaId])
      expect(pendente).toEqual([{ estado: 'pendente', funcao: 'adaptacao', tipo: 'versao_adaptada', turma_id: a.turma, decidida_por: null, decidida_em: null }])
      // Pendente, a versão não chega à turma: o banco recusa a aplicação.
      await expect(sql('insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, false, $5)', [a.escolaId, a.anoLetivoId, a.turma, adaptadaId, a.professora.usuarioId])).rejects.toThrow()

      // 5. Ela aprova: a entrega passa a ter autor e data.
      const decisao = await pedir(a.professora, 'POST', `/v1/entregas/${entregaId}/decidir`, { decisao: 'aprovar' })
      expect(decisao).toMatchObject({ status: 200, corpo: { id: entregaId, estado: 'aprovada', artefatoId: adaptadaId, decididaPor: { id: a.professora.usuarioId, nome: NOME_DA_PROFESSORA_DE_TESTE } } })
      expect(Date.parse(String(decisao.corpo['decididaEm']))).not.toBeNaN()
      expect((await artefatoDe(a.professora, adaptadaId)).entrega).toMatchObject({ id: entregaId, estado: 'aprovada' })
      // O PDF da versão adaptada diz os tipos só na página do gabarito.
      const adaptadaEmPdf = (await extrairTextoPorPagina((await baixarPdf(a.professora, adaptadaId)).bytes)).map(normalizarTexto)
      expect(adaptadaEmPdf.at(-1)).toContain('Versão adaptada: Fonte ampliada, Tempo adicional (+25%).')
      expect(adaptadaEmPdf.slice(0, -1).join(' ')).not.toMatch(/Tempo adicional/u)
    })

    it('o plano de aula sai com a duração padrão da aula, as etapas com a página citada, e as habilidades do catálogo da disciplina', async () => {
      const plano = await artefatoDe(a.professora, await gerar(a, 'plano_de_aula', 'reagente limitante'))
      expect(plano.tipo).toBe('plano_de_aula')
      if (plano.conteudo.tipo !== 'plano_de_aula') throw new Error('tipo inesperado')
      expect(plano.conteudo.duracaoMinutos).toBe(DURACAO_PADRAO_DO_PLANO_DE_AULA_MIN)
      expect(plano.conteudo.etapas.reduce((soma, etapa) => soma + etapa.minutos, 0)).toBe(50)
      expect(plano.conteudo.etapas.every((etapa) => etapa.citacao?.materialId === a.materialId)).toBe(true)
      expect(plano.conteudo.habilidades.every((habilidade) => habilidade.codigo.startsWith('QUI.EM.'))).toBe(true)
      expect((await baixarPdf(a.professora, plano.id)).status).toBe(200)
    })

    it('sem material aproveitável na disciplina, a execução falha com MATERIAL_INSUFICIENTE e nenhum artefato nasce; material excluído ou ainda processando não conta', async () => {
      await vincularProfessor(bancada, a, a.professora.usuarioId, a.turma, a.fisica)
      const antes = await contarNaEscola(bancada, 'artefato', a.escolaId)
      const emFisica = () => dispararExecucao(api, a.professora, '/v1/ferramentas/atividade_objetiva/gerar', { turmaId: a.turma, disciplinaId: a.fisica, tema: 'estequiometria' })
      expect(await execucaoTerminada(api, a.professora, await emFisica())).toMatchObject({ estado: 'falhou', erro: 'MATERIAL_INSUFICIENTE', resultado: null })

      // Com material em Física, gera; excluído ou voltando a `processando`, deixa de gerar.
      const deFisica = await enviarMaterialDeDemonstracao(api, a, a.fisica, 'Material sintético de Física', variacaoDoPdf())
      expect((await execucaoTerminada(api, a.professora, await emFisica())).estado).toBe('concluida')
      await sql(`update material set estado = 'processando' where id = $1`, [deFisica])
      expect((await execucaoTerminada(api, a.professora, await emFisica())).erro).toBe('MATERIAL_INSUFICIENTE')
      await sql(`update material set estado = 'pronto', excluido_em = now() where id = $1`, [deFisica])
      expect((await execucaoTerminada(api, a.professora, await emFisica())).erro).toBe('MATERIAL_INSUFICIENTE')
      // O tema sem nenhuma palavra do material também não gera.
      expect((await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/ferramentas/atividade_objetiva/gerar', parametros(a, 'xilofone zumbi')))).erro).toBe('MATERIAL_INSUFICIENTE')
      expect(await contarNaEscola(bancada, 'artefato', a.escolaId)).toBe(antes + 1)
    })

    it('o corpo é o contrato estrito, e ferramenta fora da lista não existe', async () => {
      const gastos = async () => [await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'consumo_ia', a.escolaId)]
      const antes = await gastos()
      for (const extra of [{ escolaId: b.escolaId }, { professorId: a.colega.usuarioId }, { quantidade: 21 }, { aluno: 'descrição' }]) {
        expect(semId(await pedir(a.professora, 'POST', '/v1/ferramentas/atividade_objetiva/gerar', { ...parametros(a, 'mol', extra), chaveEnvio: randomUUID() }))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      for (const ferramenta of ['adaptacao', 'redacao', 'x']) {
        expect(semId(await pedir(a.professora, 'POST', `/v1/ferramentas/${ferramenta}/gerar`, { ...parametros(a, 'mol'), chaveEnvio: randomUUID() }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      }
      // A ferramenta que existe mas não gera (`adaptacao`) e a que nem existe (`x`) respondem ao pé da letra o mesmo (regra 10, item 6).
      const resposta = async (ferramenta: string) => {
        const lida = await pedir(a.professora, 'POST', `/v1/ferramentas/${ferramenta}/gerar`, { ...parametros(a, 'mol'), chaveEnvio: randomUUID() })
        return { status: lida.status, corpo: { erro: { ...lida.corpo.erro, requisicaoId: undefined } } }
      }
      expect(await resposta('adaptacao')).toEqual(await resposta('x'))
      // O corpo fora do contrato, com uma ferramenta que não existe, dá o erro do corpo, o último parâmetro (onda-1a.md T1, 17.0).
      expect(semId(await pedir(a.professora, 'POST', '/v1/ferramentas/x/gerar', { ...parametros(a, 'mol', { escolaId: b.escolaId }), chaveEnvio: randomUUID() }))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      // Nenhuma execução nasce e nada do orçamento de IA é consumido (a linha da tabela da 17.0: "sem execução nem consumo").
      expect(await gastos()).toEqual(antes)
    })
  })

  describe('isolamento', () => {
    it('o artefato de A não é lido, renomeado, exportado nem adaptado pela professora de B, pela colega de outra turma, pela professora de outra disciplina da mesma turma, pela coordenação nem pelo aluno: igual ao inexistente', async () => {
      const inexistente = randomUUID()
      const rotas = (id: string): [string, string, unknown?][] => [
        ['GET', `/v1/artefatos/${id}`],
        ['PATCH', `/v1/artefatos/${id}`, { titulo: 'Título trocado por quem não podia' }],
        ['GET', `/v1/artefatos/${id}/pdf`],
        ['POST', `/v1/artefatos/${id}/adaptar`, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }],
      ]
      const antes = [await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'execucao_agente', b.escolaId)]
      for (const sessao of [b.professora, a.colega, a.deFisica, a.coordenacao, a.aluno]) {
        for (const [indice, [metodo, caminho, corpo]] of rotas(atividadeDeA).entries()) {
          const [, caminhoDoInexistente] = rotas(inexistente)[indice] ?? []
          const doInexistente = await pedir(sessao, metodo, caminhoDoInexistente ?? '', corpo)
          expect(semId(await pedir(sessao, metodo, caminho, corpo)), `${metodo} ${caminho}`).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
          expect(semId(doInexistente)).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
        }
      }
      expect((await artefatoDe(a.professora, atividadeDeA)).titulo).not.toBe('Título trocado por quem não podia')
      expect([await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'execucao_agente', b.escolaId)]).toEqual(antes)
      // No repository: com o id certo e o contexto errado, nada; com o contexto da dona, o artefato.
      for (const [escola, sessao] of [[b, b.professora], [a, a.colega], [a, a.deFisica]] as const) {
        expect(await comoPessoa(escola, sessao, 'professor', () => new ArtefatoRepository(bancada.banco).porId(atividadeDeA))).toBeUndefined()
        expect(await comoPessoa(escola, sessao, 'professor', () => new ArtefatoRepository(bancada.banco).renomear(atividadeDeA, 'Outro'))).toBe(false)
        expect(await comoPessoa(escola, sessao, 'professor', () => new ArtefatoRepository(bancada.banco).versoesAdaptadas(atividadeDeA))).toEqual([])
      }
      expect((await comoPessoa(a, a.professora, 'professor', () => new ArtefatoRepository(bancada.banco).porId(atividadeDeA)))?.id).toBe(atividadeDeA)
      // O título do material de B não sai no PDF de A, nem que a citação apontasse para ele.
      expect(await comoPessoa(a, a.professora, 'professor', () => new ArtefatoRepository(bancada.banco).titulosDosMateriais([a.materialId, b.materialId]))).toEqual(new Map([[a.materialId, 'Química 2 — Capítulo 7: Estequiometria']]))
    })

    it('a listagem traz só os artefatos das turmas da professora, paginados, e o filtro de turma não abre a turma dos outros', async () => {
      const listar = async (sessao: SessaoDeTeste, consulta = '') => listaDeArtefatosResponseSchema.parse((await get(sessao, `/v1/artefatos${consulta}`)).corpo)
      const deA = await listar(a.professora)
      expect(deA.itens.map((item) => item.id)).toContain(atividadeDeA)
      expect(deA.itens.map((item) => item.id)).not.toContain(atividadeDeB)
      expect(deA.itens.every((item) => item.turmaId === a.turma)).toBe(true)
      expect(Object.keys(deA.itens[0] ?? {}).sort()).toEqual(['adaptacao', 'criadoEm', 'disciplinaId', 'entrega', 'id', 'origemId', 'tipo', 'titulo', 'turmaId'])
      expect((await listar(a.colega)).itens).toEqual([])
      expect((await listar(a.colega, `?turmaId=${a.turma}`)).itens).toEqual([])
      // A professora de Física do 2ºB vê os artefatos de Física da turma, e nenhum de Química: a disciplina é a do artefato.
      expect(deA.itens.map((item) => item.disciplinaId)).toContain(a.fisica)
      for (const consulta of ['', `?turmaId=${a.turma}`]) {
        const deFisica = (await listar(a.deFisica, consulta)).itens
        expect(deFisica.length).toBeGreaterThan(0)
        expect(deFisica.every((item) => item.disciplinaId === a.fisica)).toBe(true)
        expect(deFisica.map((item) => item.id)).not.toContain(atividadeDeA)
      }
      expect((await listar(b.professora, `?turmaId=${a.turma}`)).itens).toEqual([])
      expect((await listar(b.professora)).itens.map((item) => item.id)).toContain(atividadeDeB)
      // Do mais novo para o mais antigo, uma página por vez.
      const primeira = await listar(a.professora, '?limite=2')
      expect(primeira.itens.map((item) => item.id)).toEqual(deA.itens.slice(0, 2).map((item) => item.id))
      expect(primeira.proxima).toBe(primeira.itens[1]?.id)
      expect((await listar(a.professora, `?limite=2&pagina=${primeira.proxima ?? ''}`)).itens.map((item) => item.id)).toEqual(deA.itens.slice(2, 4).map((item) => item.id))
      for (const sessao of [a.coordenacao, a.aluno]) expect(semId(await get(sessao, '/v1/artefatos'))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      expect(semId(await get(a.professora, `/v1/artefatos?escolaId=${b.escolaId}`))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
    })

    it('gerar para a turma da colega, para a turma de outra escola ou para a disciplina sem vínculo responde como o inexistente, e nada é gravado', async () => {
      const antes = await contarNaEscola(bancada, 'execucao_agente', a.escolaId)
      for (const alvo of [{ turmaId: a.outraTurma }, { turmaId: b.turma, disciplinaId: b.quimica }, { turmaId: randomUUID() }, { disciplinaId: randomUUID() }]) {
        expect(semId(await pedir(a.professora, 'POST', '/v1/ferramentas/atividade_objetiva/gerar', { ...parametros(a, 'mol', alvo), chaveEnvio: randomUUID() }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      }
      // A disciplina existe na escola, a turma é dela, e o vínculo é em outra disciplina: Física, para quem só dá Química.
      for (const [escola, sessao, turmaId] of [[b, b.professora, b.turma], [a, a.colega, a.outraTurma]] as const) {
        const antesDela = await contarNaEscola(bancada, 'execucao_agente', escola.escolaId)
        expect(semId(await pedir(sessao, 'POST', '/v1/ferramentas/atividade_objetiva/gerar', { turmaId, disciplinaId: escola.fisica, tema: 'mol', chaveEnvio: randomUUID() }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
        expect(semId(await pedir(sessao, 'POST', '/v1/ferramentas/plano_de_aula/gerar', { turmaId, disciplinaId: escola.fisica, tema: 'mol', chaveEnvio: randomUUID() }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
        expect(await contarNaEscola(bancada, 'execucao_agente', escola.escolaId)).toBe(antesDela)
      }
      for (const sessao of [a.coordenacao, a.aluno]) {
        expect(semId(await pedir(sessao, 'POST', '/v1/ferramentas/atividade_objetiva/gerar', { ...parametros(a, 'mol'), chaveEnvio: randomUUID() }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      }
      expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId)).toBe(antes)
    })

    it('o artefato do ano letivo anterior não aparece no ano em curso, nem com vínculo confirmado naquele ano: a resposta é a do inexistente', async () => {
      const anterior = await montarAnoAnterior(bancada, b)
      const de2025 = await copiarArtefatoParaOAnoAnterior(bancada, b, anterior, atividadeDeB)
      for (const id of [de2025.artefatoId, de2025.adaptadaId]) {
        for (const [metodo, caminho, corpo] of [
          ['GET', `/v1/artefatos/${id}`],
          ['PATCH', `/v1/artefatos/${id}`, { titulo: 'Título de 2025 trocado em 2026' }],
          ['GET', `/v1/artefatos/${id}/pdf`],
          ['POST', `/v1/artefatos/${id}/adaptar`, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }],
        ] as const) {
          expect(semId(await pedir(b.professora, metodo, caminho, corpo)), `${metodo} ${caminho}`).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
        }
        expect(await comoPessoa(b, b.professora, 'professor', () => new ArtefatoRepository(bancada.banco).porId(id))).toBeUndefined()
      }
      const lista = listaDeArtefatosResponseSchema.parse((await get(b.professora, '/v1/artefatos?limite=100')).corpo).itens
      expect(lista.map((item) => item.id)).toContain(atividadeDeB)
      expect(lista.some((item) => [de2025.artefatoId, de2025.adaptadaId].includes(item.id) || item.turmaId === anterior.turmaId)).toBe(false)
      expect(listaDeArtefatosResponseSchema.parse((await get(b.professora, `/v1/artefatos?turmaId=${anterior.turmaId}`)).corpo).itens).toEqual([])
      expect(await comoPessoa(b, b.professora, 'professor', () => new ArtefatoRepository(bancada.banco).versoesAdaptadas(de2025.artefatoId))).toEqual([])
      const { rows } = await sql('select titulo from artefato where id = $1', [de2025.artefatoId])
      expect((rows[0] as { titulo: string }).titulo).not.toBe('Título de 2025 trocado em 2026')
      // Gerar para a turma de 2025 também responde como o inexistente: a turma do pedido é do ano em curso.
      expect(semId(await pedir(b.professora, 'POST', '/v1/ferramentas/atividade_objetiva/gerar', { turmaId: anterior.turmaId, disciplinaId: b.quimica, tema: 'mol', chaveEnvio: randomUUID() }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
    })

    it('quem perdeu o vínculo depois do 202 não recebe o artefato: a execução confere de novo ao rodar', async () => {
      let liberar = (): void => undefined
      let chamadasAoModelo = 0
      const servicos = comProvedor(
        async () => {
          chamadasAoModelo += 1
          return {}
        },
        new Promise<void>((resolver) => (liberar = resolver)),
      )
      await vincularProfessor(bancada, a, a.colega.usuarioId, a.turma, a.quimica)
      const antes = await contarNaEscola(bancada, 'artefato', a.escolaId)
      // O vínculo acaba entre o `202` e a execução.
      const { execucaoId } = await comoPessoa(a, a.colega, 'professor', () => servicos.ferramentas.gerar('atividade_objetiva', { ...parametros(a, 'mol'), chaveEnvio: randomUUID() }))
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [a.escolaId, a.colega.usuarioId, a.turma])
      liberar()
      expect(chamadasAoModelo).toBe(0)
      expect(await execucaoTerminada(api, a.colega, execucaoId)).toMatchObject({ estado: 'falhou', erro: 'NAO_ENCONTRADO' })
      // Nada do material foi ao modelo, e nenhum artefato nasceu.
      expect(chamadasAoModelo).toBe(0)
      expect(await contarNaEscola(bancada, 'artefato', a.escolaId)).toBe(antes)
    })
  })

  describe('o PDF da versão adaptada segue a entrega (regra 70, itens 3 e 6)', () => {
    const adaptar = async () => {
      const execucao = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, `/v1/artefatos/${atividadeDeA}/adaptar`, { tipos: ['fonte_ampliada'] }))
      return { adaptadaId: execucao.resultado?.artefatoId ?? '', entregaId: execucao.resultado?.entregaId ?? '' }
    }

    it('pendente, sai como rascunho: a marca em toda página, sem a frase "revisado"; aprovada, sai limpo; rejeitada, não sai', async () => {
      const paraAprovar = await adaptar()
      const paraRejeitar = await adaptar()
      const revisado = /revisado pela professora ou pelo professor/u

      // Pendente: a professora vê a versão, com a fonte ampliada, para decidir; o papel diz que é rascunho.
      const rascunho = await baixarPdf(a.professora, paraAprovar.adaptadaId)
      expect(rascunho.status).toBe(200)
      expect(rascunho.disposicao).toMatch(/^attachment; filename="rascunho-[a-z0-9-]+\.pdf"$/u)
      const paginasDoRascunho = (await extrairTextoPorPagina(rascunho.bytes)).map(normalizarTexto)
      expect(paginasDoRascunho.length).toBeGreaterThan(1)
      for (const pagina of paginasDoRascunho) expect(pagina).toContain(MARCA_DE_RASCUNHO)
      expect(paginasDoRascunho.join(' ')).toContain(normalizarTexto(AVISO_DE_IA_NO_RASCUNHO))
      expect(paginasDoRascunho.join(' ')).not.toMatch(revisado)

      // Aprovada: sem a marca, e com o aviso de quem revisou.
      expect((await pedir(a.professora, 'POST', `/v1/entregas/${paraAprovar.entregaId}/decidir`, { decisao: 'aprovar' })).status).toBe(200)
      const limpo = await baixarPdf(a.professora, paraAprovar.adaptadaId)
      expect(limpo.status).toBe(200)
      expect(limpo.disposicao).not.toContain('rascunho')
      const textoLimpo = (await extrairTextoPorPagina(limpo.bytes)).map(normalizarTexto).join(' ')
      expect(textoLimpo).not.toContain('Rascunho')
      expect(textoLimpo).toMatch(revisado)

      // Rejeitada: nunca sai, nem como rascunho.
      expect((await pedir(a.professora, 'POST', `/v1/entregas/${paraRejeitar.entregaId}/decidir`, { decisao: 'rejeitar', justificativa: 'O enunciado ficou diferente do original.' })).status).toBe(200)
      const recusado = await pedir(a.professora, 'GET', `/v1/artefatos/${paraRejeitar.adaptadaId}/pdf`)
      expect(semId(recusado)).toEqual({ status: 409, codigo: 'VERSAO_ADAPTADA_NAO_APROVADA' })
      // O original, que é rascunho da própria professora e não vai a aluno por aqui, continua saindo limpo.
      const original = (await extrairTextoPorPagina((await baixarPdf(a.professora, atividadeDeA)).bytes)).map(normalizarTexto).join(' ')
      expect(original).not.toContain('Rascunho')
      expect(original).toMatch(revisado)
    })

    it('a versão adaptada já decidida não se renomeia: CONFLITO, e o título fica o que a professora viu ao decidir', async () => {
      const { adaptadaId, entregaId } = await adaptar()
      // Pendente, ainda se renomeia.
      expect((await pedir(a.professora, 'PATCH', `/v1/artefatos/${adaptadaId}`, { titulo: 'Versão com fonte ampliada' })).status).toBe(200)
      expect((await pedir(a.professora, 'POST', `/v1/entregas/${entregaId}/decidir`, { decisao: 'aprovar' })).status).toBe(200)
      expect(semId(await pedir(a.professora, 'PATCH', `/v1/artefatos/${adaptadaId}`, { titulo: 'Outro título, depois de aprovada' }))).toEqual({ status: 409, codigo: 'CONFLITO' })
      const { rows } = await sql(`select titulo, conteudo ->> 'titulo' as no_conteudo from artefato where id = $1`, [adaptadaId])
      expect(rows).toEqual([{ titulo: 'Versão com fonte ampliada', no_conteudo: 'Versão com fonte ampliada' }])
      // Quem não alcança o artefato continua recebendo a resposta do inexistente, e não o conflito.
      expect(semId(await pedir(a.deFisica, 'PATCH', `/v1/artefatos/${adaptadaId}`, { titulo: 'x' }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      // A rejeitada também não.
      const rejeitada = await adaptar()
      expect((await pedir(a.professora, 'POST', `/v1/entregas/${rejeitada.entregaId}/decidir`, { decisao: 'rejeitar', justificativa: 'Não é o que eu pedi nesta versão.' })).status).toBe(200)
      expect(semId(await pedir(a.professora, 'PATCH', `/v1/artefatos/${rejeitada.adaptadaId}`, { titulo: 'Título depois de rejeitada' }))).toEqual({ status: 409, codigo: 'CONFLITO' })
    })
  })

  describe('renomear', () => {
    it('troca o título na coluna e dentro do conteúdo, juntos, e não mexe nas questões', async () => {
      const antes = await artefatoDe(a.professora, atividadeDeA)
      const resposta = await pedir(a.professora, 'PATCH', `/v1/artefatos/${atividadeDeA}`, { titulo: '  Lista 3 — reagente limitante  ' })
      expect(resposta.status).toBe(200)
      const { rows } = await sql(`select titulo, conteudo ->> 'titulo' as no_conteudo, conteudo -> 'questoes' as questoes from artefato where id = $1`, [atividadeDeA])
      expect(rows[0]).toMatchObject({ titulo: 'Lista 3 — reagente limitante', no_conteudo: 'Lista 3 — reagente limitante' })
      const depois = await artefatoDe(a.professora, atividadeDeA)
      expect(depois.titulo).toBe('Lista 3 — reagente limitante')
      expect(depois.conteudo.titulo).toBe('Lista 3 — reagente limitante')
      const questoes = (artefato: typeof antes) => (artefato.conteudo.tipo === 'atividade_objetiva' ? artefato.conteudo.questoes : [])
      expect(questoes(antes).length).toBeGreaterThan(0)
      expect(questoes(depois)).toEqual(questoes(antes))
      // Só o título: mandar o conteúdo, ou título vazio, é recusado.
      for (const corpo of [{ titulo: 'x', conteudo: { tipo: 'atividade_objetiva' } }, { titulo: '   ' }, { titulo: 'a'.repeat(161) }, {}]) {
        expect(semId(await pedir(a.professora, 'PATCH', `/v1/artefatos/${atividadeDeA}`, corpo))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      expect((await artefatoDe(a.professora, atividadeDeA)).titulo).toBe('Lista 3 — reagente limitante')
    })
  })

  describe('adaptação (D35, D67; regra 70, item 3)', () => {
    it('recebe só os tipos e o tempo extra: campo de texto, tipo fora da lista, tipo repetido ou tempo extra sem o tipo são ENTRADA_INVALIDA, e nada é gravado', async () => {
      const antes = [await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'artefato', a.escolaId), await contarNaEscola(bancada, 'entrega', a.escolaId)]
      for (const corpo of [
        { tipos: ['fonte_ampliada'], observacao: 'aluno com baixa visão' },
        { tipos: ['fonte_ampliada'], alunoId: a.aluno.usuarioId },
        { tipos: ['fonte_ampliada'], motivo: 'laudo' },
        { tipos: ['dislexia'] },
        { tipos: [] },
        { tipos: ['fonte_ampliada', 'fonte_ampliada'] },
        { tipos: ['fonte_ampliada'], tempoExtraPercentual: 25 },
        { tipos: ['tempo_adicional'], tempoExtraPercentual: 500 },
      ]) {
        expect(semId(await pedir(a.professora, 'POST', `/v1/artefatos/${atividadeDeA}/adaptar`, { ...corpo, chaveEnvio: randomUUID() })), JSON.stringify(corpo)).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      expect([await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'artefato', a.escolaId), await contarNaEscola(bancada, 'entrega', a.escolaId)]).toEqual(antes)
    })

    it('só atividade objetiva se adapta, e versão adaptada não se adapta de novo: CONFLITO, sem execução', async () => {
      const plano = await gerar(a, 'plano_de_aula', 'mol e massa molar')
      const adaptacao = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, `/v1/artefatos/${atividadeDeA}/adaptar`, { tipos: ['linguagem_direta'] }))
      const antes = await contarNaEscola(bancada, 'execucao_agente', a.escolaId)
      for (const id of [plano, adaptacao.resultado?.artefatoId ?? '']) {
        expect(semId(await pedir(a.professora, 'POST', `/v1/artefatos/${id}/adaptar`, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }))).toEqual({ status: 409, codigo: 'CONFLITO' })
      }
      expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId)).toBe(antes)
    })

    it('a mesma chave de envio duas vezes ao mesmo tempo dá uma execução, uma versão adaptada e uma entrega; a chave de outra pessoa não devolve a execução dela', async () => {
      const corpo = { tipos: ['leitura_de_apoio'], chaveEnvio: randomUUID() }
      const respostas = await Promise.all(Array.from({ length: 4 }, () => pedir(a.professora, 'POST', `/v1/artefatos/${atividadeDeA}/adaptar`, corpo)))
      expect(respostas.map((resposta) => resposta.status)).toEqual([202, 202, 202, 202])
      expect(new Set(respostas.map((resposta) => resposta.corpo['execucaoId'])).size).toBe(1)
      const execucaoId = String(respostas[0]?.corpo['execucaoId'])
      const execucao = await execucaoTerminada(api, a.professora, execucaoId)
      expect((await pedir(a.professora, 'POST', `/v1/artefatos/${atividadeDeA}/adaptar`, corpo)).corpo['execucaoId']).toBe(execucaoId)
      await executor.ociosa()
      expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId, `chave_envio = '${corpo.chaveEnvio}'`)).toBe(1)
      expect(await contarNaEscola(bancada, 'artefato', a.escolaId, `execucao_id = '${execucaoId}'`)).toBe(1)
      expect(await contarNaEscola(bancada, 'entrega', a.escolaId, `execucao_id = '${execucaoId}'`)).toBe(1)
      expect(await contarNaEscola(bancada, 'entrega', a.escolaId, `artefato_id = '${execucao.resultado?.artefatoId ?? ''}'`)).toBe(1)

      // A colega, com vínculo na turma e na disciplina, usa a chave da professora: não recebe a execução dela, e nada novo nasce.
      await vincularProfessor(bancada, a, a.colega.usuarioId, a.turma, a.quimica)
      try {
        const daColega = await pedir(a.colega, 'POST', `/v1/artefatos/${atividadeDeA}/adaptar`, corpo)
        expect(semId(daColega)).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
        expect(JSON.stringify(daColega.corpo)).not.toContain(execucaoId)
        expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId, `chave_envio = '${corpo.chaveEnvio}'`)).toBe(1)
      } finally {
        await sql(`delete from vinculo where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [a.escolaId, a.colega.usuarioId, a.turma])
      }
    })

    it('a saída que muda o gabarito é recusada: nem a versão adaptada nem a entrega nascem', async () => {
      const antes = [await contarNaEscola(bancada, 'artefato', a.escolaId), await contarNaEscola(bancada, 'entrega', a.escolaId)]
      const servicos = comProvedor(async ({ entrada }) => {
        const { conteudo, adaptacao } = entrada as { conteudo: ConteudoDeAtividade; adaptacao: ConteudoDeAtividade['adaptacao'] }
        return { ...conteudo, titulo: 'Versão com o gabarito trocado', adaptacao, questoes: conteudo.questoes.map((questao, indice) => (indice === 0 ? { ...questao, gabarito: (questao.gabarito + 1) % 4 } : questao)) }
      })
      const { execucaoId } = await comoPessoa(a, a.professora, 'professor', () => servicos.artefatos.adaptar(atividadeDeA, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }))
      expect(await execucaoTerminada(api, a.professora, execucaoId)).toMatchObject({ estado: 'falhou', erro: 'IA_SAIDA_INVALIDA', resultado: null })
      expect([await contarNaEscola(bancada, 'artefato', a.escolaId), await contarNaEscola(bancada, 'entrega', a.escolaId)]).toEqual(antes)
    })

    it('a versão adaptada e a entrega nascem juntas ou não nascem: se a conclusão da execução não vale, as duas são desfeitas', async () => {
      const antes = [await contarNaEscola(bancada, 'artefato', a.escolaId), await contarNaEscola(bancada, 'entrega', a.escolaId)]
      // Enquanto o modelo responde, o prazo encerra a execução: a transação que gravaria as duas linhas não conclui.
      const servicos = comProvedor(async (pedido) => {
        await sql(`update execucao_agente set estado = 'falhou', erro = 'IA_TEMPO_ESGOTADO', concluida_em = now() where id = $1`, [pedido.execucaoId])
        return (await falso().gerar(pedido as Parameters<LLMProvider['gerar']>[0])).saida
      })
      const { execucaoId } = await comoPessoa(a, a.professora, 'professor', () => servicos.artefatos.adaptar(atividadeDeA, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }))
      expect((await execucaoTerminada(api, a.professora, execucaoId)).estado).toBe('falhou')
      expect([await contarNaEscola(bancada, 'artefato', a.escolaId), await contarNaEscola(bancada, 'entrega', a.escolaId)]).toEqual(antes)
      // O mesmo caminho, sem a interrupção, grava as duas, com a mesma execução.
      const normal = comProvedor((pedido) => falso().gerar(pedido as Parameters<LLMProvider['gerar']>[0]).then((resultado) => resultado.saida))
      const aceita = await comoPessoa(a, a.professora, 'professor', () => normal.artefatos.adaptar(atividadeDeA, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }))
      expect((await execucaoTerminada(api, a.professora, aceita.execucaoId)).estado).toBe('concluida')
      expect([await contarNaEscola(bancada, 'artefato', a.escolaId, `execucao_id = '${aceita.execucaoId}'`), await contarNaEscola(bancada, 'entrega', a.escolaId, `execucao_id = '${aceita.execucaoId}' and estado = 'pendente'`)]).toEqual([1, 1])
    })
  })

  describe('citação (regra 30, item 12)', () => {
    it('a saída que cita página que não foi entregue à tarefa é recusada, e nenhum artefato nasce', async () => {
      const antes = await contarNaEscola(bancada, 'artefato', a.escolaId)
      for (const [caso, trocar] of [
        ['página que não veio', (citacao: { materialId: string; pagina: number }) => ({ ...citacao, pagina: 99 })],
        ['material de outra escola', (citacao: { materialId: string; pagina: number }) => ({ ...citacao, materialId: b.materialId })],
      ] as const) {
        const servicos = comProvedor(async (pedido) => {
          const conteudo = (await falso().gerar(pedido as Parameters<LLMProvider['gerar']>[0])).saida as ConteudoDeAtividade
          return { ...conteudo, questoes: conteudo.questoes.map((questao, indice) => (indice === 0 ? { ...questao, citacao: { ...questao.citacao, ...trocar(questao.citacao) } } : questao)) }
        })
        const { execucaoId } = await comoPessoa(a, a.professora, 'professor', () => servicos.ferramentas.gerar('atividade_objetiva', { ...parametros(a, 'reagente limitante'), chaveEnvio: randomUUID() }))
        expect(await execucaoTerminada(api, a.professora, execucaoId), caso).toMatchObject({ estado: 'falhou', erro: 'IA_SAIDA_INVALIDA', resultado: null })
      }
      expect(await contarNaEscola(bancada, 'artefato', a.escolaId)).toBe(antes)
      // A saída sem a troca, pelo mesmo caminho, vira artefato: o que recusou foi a citação.
      const normal = comProvedor((pedido) => falso().gerar(pedido as Parameters<LLMProvider['gerar']>[0]).then((resultado) => resultado.saida))
      const aceita = await comoPessoa(a, a.professora, 'professor', () => normal.ferramentas.gerar('atividade_objetiva', { ...parametros(a, 'reagente limitante'), chaveEnvio: randomUUID() }))
      expect((await execucaoTerminada(api, a.professora, aceita.execucaoId)).estado).toBe('concluida')
      expect(await contarNaEscola(bancada, 'artefato', a.escolaId)).toBe(antes + 1)
    })
  })

  describe('suspensão por função (D60)', () => {
    it('com a Adaptação suspensa em A, o POST é recusado sem gravar execução nem consumo; gerar segue em A, adaptar segue em B, e a entrega pendente ainda se decide', async () => {
      const pendente = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, `/v1/artefatos/${atividadeDeA}/adaptar`, { tipos: ['enunciado_simplificado'] }))
      await suspender(a, 'adaptacao')
      try {
        const antes = [await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'consumo_ia', a.escolaId), await contarNaEscola(bancada, 'artefato', a.escolaId)]
        expect(semId(await pedir(a.professora, 'POST', `/v1/artefatos/${atividadeDeA}/adaptar`, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() }))).toEqual({ status: 409, codigo: 'FUNCAO_SUSPENSA' })
        await executor.ociosa()
        expect([await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'consumo_ia', a.escolaId), await contarNaEscola(bancada, 'artefato', a.escolaId)]).toEqual(antes)
        // A outra função da mesma escola segue, e a mesma função em outra escola também.
        expect(await gerar(a, 'atividade_objetiva', 'mol', { quantidade: 2 })).toMatch(/^[0-9a-f-]{36}$/u)
        expect((await execucaoTerminada(api, b.professora, await dispararExecucao(api, b.professora, `/v1/artefatos/${atividadeDeB}/adaptar`, { tipos: ['fonte_ampliada'] }))).estado).toBe('concluida')

        // O que a função já produziu fica: a entrega pendente aparece, diz de que função é, e o time diz que ela está suspensa.
        const entregas = listaDeEntregasResponseSchema.parse((await get(a.professora, '/v1/entregas?estado=pendente')).corpo)
        const daSuspensa = entregas.itens.find((entrega) => entrega.id === pendente.resultado?.entregaId)
        expect(daSuspensa).toMatchObject({ funcao: 'adaptacao', estado: 'pendente' })
        const time = timeResponseSchema.parse((await get(a.professora, '/v1/time')).corpo)
        expect(time.agentes.flatMap((agente) => agente.funcoes).find((funcao) => funcao.chave === daSuspensa?.funcao)?.suspensa).toBe(true)
        // E continua podendo ser decidida: quem decide é a pessoa.
        expect(await pedir(a.professora, 'POST', `/v1/entregas/${daSuspensa?.id ?? ''}/decidir`, { decisao: 'aprovar' })).toMatchObject({ status: 200, corpo: { estado: 'aprovada' } })
      } finally {
        await retomar(a, 'adaptacao')
      }
      expect((await pedir(a.professora, 'POST', `/v1/artefatos/${atividadeDeA}/adaptar`, { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() })).status).toBe(202)
      await executor.ociosa()
    })

    it('com a conversa e as ferramentas suspensas, gerar é recusado antes de gravar, e adaptar, que é outra função, segue', async () => {
      await suspender(a, 'conversa_e_ferramentas')
      try {
        const antes = [await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'consumo_ia', a.escolaId)]
        expect(semId(await pedir(a.professora, 'POST', '/v1/ferramentas/plano_de_aula/gerar', { ...parametros(a, 'mol'), chaveEnvio: randomUUID() }))).toEqual({ status: 409, codigo: 'FUNCAO_SUSPENSA' })
        await executor.ociosa()
        expect([await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'consumo_ia', a.escolaId)]).toEqual(antes)
        expect((await pedir(a.professora, 'POST', `/v1/artefatos/${atividadeDeA}/adaptar`, { tipos: ['tempo_adicional'], tempoExtraPercentual: 50, chaveEnvio: randomUUID() })).status).toBe(202)
        await executor.ociosa()
      } finally {
        await retomar(a, 'conversa_e_ferramentas')
      }
    })
  })

  describe('o tema é texto livre da professora (regra 20, item 9)', () => {
    it('o tema e o título ficam na execução, no consumo e no artefato, que são dela; nunca vão para log nem para auditoria, nem quando a execução falha', async () => {
      const proibido = /Bernardo|Queiroz|discalculia/u
      const tema = 'reagente limitante para o Bernardo Queiroz, que tem discalculia'
      const execucaoId = await dispararExecucao(api, a.professora, '/v1/ferramentas/atividade_objetiva/gerar', parametros(a, tema, { quantidade: 2 }))
      const geracao = await execucaoTerminada(api, a.professora, execucaoId)
      expect(geracao.estado).toBe('concluida')
      const artefatoId = geracao.resultado?.artefatoId ?? ''
      // O caminho inteiro: renomear, exportar, adaptar, decidir; e uma geração que falha com o mesmo tipo de tema.
      expect((await pedir(a.professora, 'PATCH', `/v1/artefatos/${artefatoId}`, { titulo: 'Lista do Bernardo Queiroz' })).status).toBe(200)
      expect((await baixarPdf(a.professora, artefatoId)).status).toBe(200)
      const adaptacao = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, `/v1/artefatos/${artefatoId}/adaptar`, { tipos: ['fonte_ampliada'] }))
      expect((await pedir(a.professora, 'POST', `/v1/entregas/${adaptacao.resultado?.entregaId ?? ''}/decidir`, { decisao: 'aprovar' })).status).toBe(200)
      const falha = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/ferramentas/plano_de_aula/gerar', parametros(a, 'xilofone do Bernardo Queiroz com discalculia')))
      expect(falha).toMatchObject({ estado: 'falhou', erro: 'MATERIAL_INSUFICIENTE' })
      expect(semId(await pedir(a.professora, 'POST', '/v1/ferramentas/atividade_objetiva/gerar', { ...parametros(a, tema, { turmaId: a.outraTurma }), chaveEnvio: randomUUID() }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })

      // Onde o tema está: na entrada da execução e no consumo dela (aceito pelo contrato), e no título do artefato.
      const { rows: execucoes } = await sql('select entrada from execucao_agente where id = $1', [execucaoId])
      expect(JSON.stringify(execucoes)).toMatch(proibido)
      expect(JSON.stringify((await sql('select entrada from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])).rows)).toMatch(proibido)
      // Onde ele nunca está: no log (nem o da geração, nem o da falha, nem o da requisição) e na auditoria.
      const log = linhasDeLog.join('\n')
      expect(log).toContain(execucaoId)
      expect(log).not.toMatch(proibido)
      expect(log).not.toMatch(/reagente limitante para|xilofone|Lista do/u)
      const { rows: auditorias } = await sql('select * from auditoria where escola_id = $1', [a.escolaId])
      expect(auditorias.some((linha: { acao: string }) => linha.acao === 'entrega.decidida')).toBe(true)
      expect(JSON.stringify(auditorias)).not.toMatch(proibido)
      expect(JSON.stringify(auditorias)).not.toMatch(/reagente limitante para|Lista do/u)
    })
  })

  describe('o que fica gravado', () => {
    it('a execução guarda só os parâmetros e a referência; o consumo, a função, o custo e o conteúdo, sem pessoa', async () => {
      const execucaoId = await dispararExecucao(api, a.professora, '/v1/ferramentas/atividade_objetiva/gerar', parametros(a, 'mol', { quantidade: 2 }))
      const execucao = await execucaoTerminada(api, a.professora, execucaoId)
      const { rows } = await sql('select funcao, tarefa, entrada, resultado, solicitada_por from execucao_agente where id = $1', [execucaoId])
      expect(rows[0]).toEqual({
        funcao: 'conversa_e_ferramentas',
        tarefa: 'gerar_atividade_objetiva',
        entrada: { tarefa: 'gerar_atividade_objetiva', parametros: { turmaId: a.turma, disciplinaId: a.quimica, tema: 'mol', quantidade: 2 } },
        resultado: { tipo: 'artefato', artefatoId: execucao.resultado?.artefatoId, entregaId: null },
        solicitada_por: a.professora.usuarioId,
      })
      const { rows: consumo } = await sql('select * from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])
      expect(consumo).toHaveLength(1)
      expect(consumo[0]).toMatchObject({ funcao: 'conversa_e_ferramentas', tarefa: 'gerar_atividade_objetiva', aluno_id: null, estado: 'concluida' })
      expect(JSON.stringify(consumo)).not.toContain(a.professora.usuarioId)
      const { rows: gravado } = await sql('select criado_por, execucao_id, tipo from artefato where id = $1', [execucao.resultado?.artefatoId])
      expect(gravado).toEqual([{ criado_por: a.professora.usuarioId, execucao_id: execucaoId, tipo: 'atividade_objetiva' }])
    })
  })
})
