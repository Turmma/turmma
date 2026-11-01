import { runInContext, RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, type AgenteExecutor, type InProcessAgenteExecutor, type LLMProvider, type SuspensaoDeFuncao } from '@educa/core'
import { conversaDoAssistenteResponseSchema, timeResponseSchema, FUNCOES, MENSAGENS_DE_ERRO, type ChaveDeFuncao } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { PersonalDataCapture } from '../../test/personal-data-capture.js'
import { chamar, subirApi, type TestApi, type RespostaHttp } from '../../test/test-api.js'
import {
  comoPessoa,
  contarNaEscola,
  dispararExecucao,
  execucaoTerminada,
  montarAnoAnterior,
  montarEscolaComAssistente,
  vincularProfessor,
  zerarLimiteDePedidosDeIa,
  type EscolaComAssistente,
} from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { EXECUTOR_DE_AGENTE, SUSPENSAO_DE_FUNCAO } from '../ia/ia.module.js'
import { TrechoSearch } from '../material/trecho-search.js'
import { AssistenteService } from './assistente.service.js'
import { ConversaRepository } from './conversa.repository.js'
import { IaRequestRateLimit, TETO_DE_PEDIDOS_DE_IA_POR_USUARIO } from './ai-request-rate-limit.js'
import { TurmaDoProfessorRepository } from './turma-do-professor.repository.js'

/**
 * O Assistente de ensino na API (MVP, A2): o time e a conversa do professor, com a API montada pelo `AppModule`, o
 * Postgres do compose de teste, o material de demonstração enviado pela rota da coordenação e o adaptador falso de IA.
 *
 * Em cada caso de isolamento, a outra escola (ou a colega da mesma escola) tem a linha que a consulta alcançaria se a
 * cláusula de escopo saísse do repository (regra 10, item 5).
 */
describe('Assistente de ensino', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  let executor: InProcessAgenteExecutor
  let a: EscolaComAssistente
  let b: EscolaComAssistente

  const sql = (texto: string, valores: unknown[] = []) => bancada.pool.query(texto, valores)
  const get = async (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, await sessao.tokenNovo())
  const post = async (sessao: TestSessao, caminho: string, corpo: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, await sessao.tokenNovo(), corpo)
  const mensagem = (escola: EscolaComAssistente, texto: string, extra: Record<string, unknown> = {}) => ({ texto, turmaId: escola.turma, disciplinaId: escola.quimica, chaveEnvio: randomUUID(), ...extra })
  const conversaDe = async (sessao: TestSessao, consulta = '') => conversaDoAssistenteResponseSchema.parse((await get(sessao, `/v1/assistente/conversa${consulta}`)).corpo)
  const suspender = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) => sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
  const retomar = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) =>
    sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $3 where escola_id = $1 and funcao = $2 and retomada_em is null', [escola.escolaId, funcao, escola.coordenacao.usuarioId])

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
    executor = api.app.get<InProcessAgenteExecutor>(EXECUTOR_DE_AGENTE)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    await bancada.fechar()
  })

  describe('GET /v1/time', () => {
    it('professor e coordenação leem os três agentes e as funções do catálogo, com a autonomia em português comum', async () => {
      for (const sessao of [a.professora, a.coordenacao]) {
        const time = timeResponseSchema.parse((await get(sessao, '/v1/time')).corpo)
        expect(time.agentes.map((agente) => agente.agente)).toEqual(['assistente_de_ensino', 'tutor', 'analista_de_desempenho_escolar'])
        const adaptacao = time.agentes[0]?.funcoes.find((funcao) => funcao.chave === 'adaptacao')
        expect(adaptacao).toEqual({ chave: 'adaptacao', nome: FUNCOES.adaptacao.nome, autonomia: 3, altoRisco: true, fazSozinha: FUNCOES.adaptacao.fazSozinha, esperaAprovacao: FUNCOES.adaptacao.esperaAprovacao, suspensa: false })
      }
    })

    it('a suspensão que aparece é a da escola de quem lê: suspensa em A, a mesma função segue ativa em B, e a retomada some', async () => {
      const suspensas = async (sessao: TestSessao) =>
        timeResponseSchema
          .parse((await get(sessao, '/v1/time')).corpo)
          .agentes.flatMap((agente) => agente.funcoes)
          .filter((funcao) => funcao.suspensa)
          .map((funcao) => funcao.chave)
      await suspender(a, 'adaptacao')
      try {
        expect(await suspensas(a.professora)).toEqual(['adaptacao'])
        expect(await suspensas(a.coordenacao)).toEqual(['adaptacao'])
        expect(await suspensas(b.professora)).toEqual([])
      } finally {
        await retomar(a, 'adaptacao')
      }
      expect(await suspensas(a.professora)).toEqual([])
    })

    it('o aluno não lê o time: a resposta é a do inexistente', async () => {
      expect(await get(a.aluno, '/v1/time')).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
    })
  })

  describe('a conversa', () => {
    it('o envio grava a pergunta e a execução juntas, e o Assistente responde com a proposta de ferramenta, sem gerar nada', async () => {
      const artefatosAntes = await contarNaEscola(bancada, 'artefato', a.escolaId)
      const execucaoId = await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, 'monta uma atividade de estequiometria'))
      // Antes de a execução rodar, a pergunta já está na conversa: as duas nasceram na mesma transação.
      const { rows } = await sql(`select autor, conteudo, turma_id, disciplina_id from mensagem_agente where escola_id = $1 and execucao_id = $2`, [a.escolaId, execucaoId])
      expect(rows).toContainEqual({ autor: 'usuario', conteudo: { tipo: 'texto', texto: 'monta uma atividade de estequiometria' }, turma_id: a.turma, disciplina_id: a.quimica })

      const execucao = await execucaoTerminada(api, a.professora, execucaoId)
      expect(execucao).toMatchObject({ estado: 'concluida', erro: null, resultado: { tipo: 'mensagem', mensagem: { autor: 'agente', tipo: 'proposta_de_ferramenta' } } })
      // A turma e a disciplina da proposta são as da mensagem da professora.
      expect(execucao.resultado?.mensagem?.['proposta']).toMatchObject({ ferramenta: 'atividade_objetiva', parametros: { turmaId: a.turma, disciplinaId: a.quimica } })
      // A proposta é uma pergunta: nenhum artefato nasceu, e a execução guarda só a referência à mensagem.
      expect(await contarNaEscola(bancada, 'artefato', a.escolaId)).toBe(artefatosAntes)
      const gravada = await sql('select entrada, resultado from execucao_agente where id = $1', [execucaoId])
      expect(gravada.rows[0]).toEqual({ entrada: { tarefa: 'propor_ferramenta' }, resultado: { tipo: 'mensagem', mensagemId: execucao.resultado?.mensagem?.['id'] } })

      const { mensagens } = await conversaDe(a.professora)
      expect(mensagens.slice(-2).map((item) => [item.autor, item.tipo])).toEqual([['usuario', 'texto'], ['agente', 'proposta_de_ferramenta']])
    })

    it('pergunta sobre o material é respondida em texto, com a página citada que veio da busca', async () => {
      const execucao = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, 'o que é o reagente limitante?')))
      expect(execucao).toMatchObject({ estado: 'concluida', resultado: { mensagem: { tipo: 'texto' } } })
      const citacoes = execucao.resultado?.mensagem?.['citacoes'] as { materialId: string; pagina: number }[]
      expect(citacoes).toHaveLength(1)
      expect(citacoes[0]?.materialId).toBe(a.materialId)
    })

    it('pedido de adaptação vira texto que aponta a ferramenta: não nasce proposta, artefato nem entrega', async () => {
      const entregasAntes = await contarNaEscola(bancada, 'entrega', a.escolaId)
      const execucao = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, 'adapta a atividade de estequiometria')))
      expect(execucao.resultado?.mensagem).toMatchObject({ tipo: 'texto', citacoes: [] })
      expect(String(execucao.resultado?.mensagem?.['texto'])).toContain('Adaptar')
      expect(await contarNaEscola(bancada, 'entrega', a.escolaId)).toBe(entregasAntes)
    })

    it('"só conversar" é a outra opção da proposta: a resposta ao último pedido vem em texto, com a página citada, e sem a marca nada muda', async () => {
      const pedido = 'monta uma atividade sobre reagente limitante'
      const proposta = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, pedido)))
      expect(proposta.resultado?.mensagem?.['tipo']).toBe('proposta_de_ferramenta')
      const artefatosAntes = await contarNaEscola(bancada, 'artefato', a.escolaId)

      const execucaoId = await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, 'Só conversar', { resposta: 'so_conversar' }))
      const resposta = await execucaoTerminada(api, a.professora, execucaoId)
      expect(resposta).toMatchObject({ estado: 'concluida', resultado: { tipo: 'mensagem', mensagem: { autor: 'agente', tipo: 'texto' } } })
      // Respondeu ao pedido anterior, com o material: a fala "só conversar" não tem assunto nenhum.
      const citacoes = resposta.resultado?.mensagem?.['citacoes'] as { materialId: string; pagina: number; trecho: string }[]
      expect(citacoes).toHaveLength(1)
      expect(citacoes[0]?.materialId).toBe(a.materialId)
      expect(String(resposta.resultado?.mensagem?.['texto'])).toMatch(/reagente limitante/iu)
      // A marca fica com a execução, em lista fechada; a fala, só na conversa. Nada foi gerado.
      const { rows } = await sql('select entrada from execucao_agente where id = $1', [execucaoId])
      expect(rows).toEqual([{ entrada: { tarefa: 'propor_ferramenta', resposta: 'so_conversar' } }])
      expect(await contarNaEscola(bancada, 'artefato', a.escolaId)).toBe(artefatosAntes)
      expect((await conversaDe(a.professora)).mensagens.slice(-4).map((item) => [item.autor, item.tipo])).toEqual([['usuario', 'texto'], ['agente', 'proposta_de_ferramenta'], ['usuario', 'texto'], ['agente', 'texto']])

      // O mesmo texto de pedido, com a marca, nunca vira proposta; sem a marca, continua virando.
      const comMarca = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, pedido, { resposta: 'so_conversar' })))
      expect(comMarca.resultado?.mensagem?.['tipo']).toBe('texto')
      const semMarca = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, pedido)))
      expect(semMarca.resultado?.mensagem?.['tipo']).toBe('proposta_de_ferramenta')
      // Lista fechada: outro valor é ENTRADA_INVALIDA.
      expect((await post(a.professora, '/v1/assistente/mensagens', mensagem(a, 'x', { resposta: 'abrir' }))).corpo.erro?.codigo).toBe('ENTRADA_INVALIDA')
    })

    it('a conversa é paginada para trás, da mais antiga para a mais nova, com teto', async () => {
      const todas = await conversaDe(a.professora)
      expect(todas.mensagens.length).toBeGreaterThanOrEqual(6)
      expect(todas.mensagens.map((item) => item.id)).toEqual([...todas.mensagens.map((item) => item.id)].sort())
      const ultimas = await conversaDe(a.professora, '?limite=2')
      expect(ultimas.mensagens.map((item) => item.id)).toEqual(todas.mensagens.slice(-2).map((item) => item.id))
      expect(ultimas.anterior).toBe(ultimas.mensagens[0]?.id)
      const antes = await conversaDe(a.professora, `?limite=2&antes=${ultimas.anterior ?? ''}`)
      expect(antes.mensagens.map((item) => item.id)).toEqual(todas.mensagens.slice(-4, -2).map((item) => item.id))
      expect((await get(a.professora, '/v1/assistente/conversa?limite=101')).corpo.erro?.codigo).toBe('ENTRADA_INVALIDA')
      expect((await get(a.professora, `/v1/assistente/conversa?usuarioId=${a.colega.usuarioId}`)).corpo.erro?.codigo).toBe('ENTRADA_INVALIDA')
    })

    it('o corpo é o contrato estrito: escola, pessoa ou campo a mais é ENTRADA_INVALIDA, e nada é gravado', async () => {
      const antes = await contarNaEscola(bancada, 'execucao_agente', a.escolaId)
      for (const extra of [{ escolaId: b.escolaId }, { usuarioId: a.colega.usuarioId }, { nota: 7 }]) {
        expect(await post(a.professora, '/v1/assistente/mensagens', mensagem(a, 'monta uma atividade', extra))).toMatchObject({ status: 400, corpo: { erro: { codigo: 'ENTRADA_INVALIDA' } } })
      }
      expect((await post(a.professora, '/v1/assistente/mensagens', { ...mensagem(a, 'x'), chaveEnvio: undefined })).status).toBe(400)
      expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId)).toBe(antes)
    })

    it('o corpo e a consulta inválidos: nenhuma execução nem consumo; a resposta é só o código do catálogo e o que foi mandado não vai ao log; o limite 100 passa e o 101 não', async () => {
      const SENTINELA = `sentinela-do-corpo-${randomUUID()}`
      const captura = new PersonalDataCapture(linhasDeLog)
      const execucoesAntes = await contarNaEscola(bancada, 'execucao_agente', a.escolaId)
      const consumoAntes = await contarNaEscola(bancada, 'consumo_ia', a.escolaId)
      const corpoInvalido = await captura.capturar(post(a.professora, '/v1/assistente/mensagens', mensagem(a, SENTINELA, { escolaId: b.escolaId, [SENTINELA]: SENTINELA })))
      expect(corpoInvalido.status).toBe(400)
      expect(corpoInvalido.corpo).toEqual({ erro: { codigo: 'ENTRADA_INVALIDA', mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA, requisicaoId: expect.any(String) } })
      const consultaInvalida = await captura.capturar(get(a.professora, `/v1/assistente/conversa?limite=101&${SENTINELA}=${SENTINELA}`))
      expect(consultaInvalida.corpo).toEqual({ erro: { codigo: 'ENTRADA_INVALIDA', mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA, requisicaoId: expect.any(String) } })
      captura.varrerTudo([SENTINELA])
      expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId)).toBe(execucoesAntes)
      expect(await contarNaEscola(bancada, 'consumo_ia', a.escolaId)).toBe(consumoAntes)
      expect((await get(a.professora, '/v1/assistente/conversa?limite=100')).status).toBe(200)
    })

    it('a guarda responde antes do pipe: sem sessão, 401; a coordenação, que não conversa com o Assistente, 404; o corpo inválido não é lido e nada é gravado', async () => {
      const antes = await contarNaEscola(bancada, 'execucao_agente', a.escolaId)
      const auditoriaAntes = await contarNaEscola(bancada, 'auditoria', a.escolaId)
      const invalido = { ...mensagem(a, 'x'), escolaId: b.escolaId }
      expect((await chamar(api.url, 'POST', '/v1/assistente/mensagens', undefined, invalido)).status).toBe(401)
      expect((await chamar(api.url, 'GET', '/v1/assistente/conversa?limite=101', undefined)).status).toBe(401)
      expect(await post(a.coordenacao, '/v1/assistente/mensagens', invalido)).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      expect(await get(a.coordenacao, '/v1/assistente/conversa?limite=101')).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId)).toBe(antes)
      expect(await contarNaEscola(bancada, 'auditoria', a.escolaId)).toBe(auditoriaAntes)
    })
  })

  describe('isolamento: só a própria professora lê a conversa dela', () => {
    it('a colega da mesma escola, a professora de outra escola e a coordenação não leem a conversa de A', async () => {
      expect((await conversaDe(a.professora)).mensagens.length).toBeGreaterThan(0)
      // A colega e a professora de B têm a própria thread, vazia: nenhuma mensagem de A aparece nela.
      expect((await conversaDe(a.colega)).mensagens).toEqual([])
      expect((await conversaDe(b.professora)).mensagens).toEqual([])
      const umaMensagemDeA = (await conversaDe(a.professora)).mensagens[0]?.id ?? ''
      expect((await conversaDe(a.colega, `?antes=${randomUUID()}`)).mensagens).toEqual([])
      expect(await comoPessoa(a, a.colega, 'professor', () => new ConversaRepository(bancada.banco).anteriores(undefined, 100))).toEqual([])
      expect(await comoPessoa(b, b.professora, 'professor', () => new ConversaRepository(bancada.banco).anteriores(undefined, 100))).toEqual([])
      expect((await comoPessoa(a, a.professora, 'professor', () => new ConversaRepository(bancada.banco).anteriores(undefined, 100))).map((item) => item.id)).toContain(umaMensagemDeA)
      // A coordenação e o aluno não têm a rota: a resposta é a do inexistente.
      for (const sessao of [a.coordenacao, a.aluno]) {
        expect(await get(sessao, '/v1/assistente/conversa')).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
        expect(await post(sessao, '/v1/assistente/mensagens', mensagem(a, 'bom dia'))).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      }
    })

    it('a execução da conversa de A não é lida pela colega, pela coordenação nem pela outra escola: igual ao inexistente', async () => {
      const execucaoId = await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, 'o que é mol?'))
      await execucaoTerminada(api, a.professora, execucaoId)
      const inexistente = await get(a.professora, `/v1/execucoes/${randomUUID()}`)
      expect(inexistente.status).toBe(404)
      for (const sessao of [a.colega, a.coordenacao, a.aluno, b.professora]) {
        const resposta = await get(sessao, `/v1/execucoes/${execucaoId}`)
        expect({ status: resposta.status, codigo: resposta.corpo.erro?.codigo }).toEqual({ status: inexistente.status, codigo: inexistente.corpo.erro?.codigo })
      }
    })

    it('a turma de outra professora, a de outra escola e a que não existe respondem igual, e nada é gravado', async () => {
      const antes = [await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'mensagem_agente', a.escolaId), await contarNaEscola(bancada, 'execucao_agente', b.escolaId)]
      const inexistente = await post(a.professora, '/v1/assistente/mensagens', mensagem(a, 'bom dia', { turmaId: randomUUID() }))
      expect(inexistente).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      for (const alvo of [
        { turmaId: a.outraTurma }, // a da colega, na mesma escola
        { turmaId: b.turma, disciplinaId: b.quimica }, // a de outra escola
        { disciplinaId: a.fisica }, // a disciplina em que ela não tem vínculo
      ]) {
        const resposta = await post(a.professora, '/v1/assistente/mensagens', mensagem(a, 'bom dia', alvo))
        expect({ status: resposta.status, corpo: resposta.corpo.erro?.codigo }).toEqual({ status: 404, corpo: 'NAO_ENCONTRADO' })
      }
      expect([await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'mensagem_agente', a.escolaId), await contarNaEscola(bancada, 'execucao_agente', b.escolaId)]).toEqual(antes)
    })

    it('vínculo pendente não dá alcance; confirmado, dá: a turma é dela só depois de confirmar', async () => {
      const turmas = () => comoPessoa(a, a.colega, 'professor', () => new TurmaDoProfessorRepository(bancada.banco).turmaComDisciplina(a.turma, a.fisica))
      await vincularProfessor(bancada, a, a.colega.usuarioId, a.turma, a.fisica, 'pendente')
      expect(await turmas()).toBeUndefined()
      await sql(`update vinculo set estado = 'confirmado', decidido_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3 and disciplina_id = $4`, [a.escolaId, a.colega.usuarioId, a.turma, a.fisica])
      expect(await turmas()).toEqual({ serie: { etapa: 'em', ano: 2 }, disciplina: 'Física' })
      // O vínculo em Física não abre Química na mesma turma: o material é da disciplina.
      expect(await comoPessoa(a, a.colega, 'professor', () => new TurmaDoProfessorRepository(bancada.banco).turmaComDisciplina(a.turma, a.quimica))).toBeUndefined()
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3 and disciplina_id = $4`, [a.escolaId, a.colega.usuarioId, a.turma, a.fisica])
      expect(await turmas()).toBeUndefined()
    })

    it('a conversa e a execução do ano letivo anterior não aparecem no ano em curso: a thread é do ano, e a resposta é a do inexistente', async () => {
      const anterior = await montarAnoAnterior(bancada, b)
      const chaveDe2025 = randomUUID()
      const dono = [b.escolaId, anterior.anoLetivoId, b.professora.usuarioId]
      const { rows: threads } = await sql(`insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente) values ($1, $2, $3, 'assistente_de_ensino') returning id`, dono)
      const { rows: execucoes } = await sql(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, 'conversa_e_ferramentas', 'propor_ferramenta', $3, $4, '{"tarefa":"propor_ferramenta"}') returning id`,
        [...dono, chaveDe2025],
      )
      const execucaoDe2025 = (execucoes[0] as { id: string }).id
      const { rows: mensagens } = await sql(
        `insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, turma_id, disciplina_id) values ($1, $2, $3, $4, 'usuario', '{"tipo":"texto","texto":"pergunta feita em 2025"}', $5, $6) returning id`,
        [b.escolaId, anterior.anoLetivoId, (threads[0] as { id: string }).id, execucaoDe2025, anterior.turmaId, b.quimica],
      )
      const mensagemDe2025 = (mensagens[0] as { id: string }).id

      // A conversa de 2026 não traz a de 2025, pela rota nem pelo repository.
      expect(JSON.stringify(await conversaDe(b.professora, '?limite=100'))).not.toContain('pergunta feita em 2025')
      const emCurso = await comoPessoa(b, b.professora, 'professor', () => new ConversaRepository(bancada.banco).anteriores(undefined, 100))
      expect(emCurso.map((item) => item.id)).not.toContain(mensagemDe2025)
      expect(await comoPessoa(b, b.professora, 'professor', () => new ConversaRepository(bancada.banco).perguntaDaChave(chaveDe2025))).toBeUndefined()
      // No contexto de 2025, as mesmas consultas acham: o que separou foi o ano letivo.
      const em2025 = { requisicaoId: randomUUID(), escolaId: b.escolaId, usuarioId: b.professora.usuarioId, papel: 'professor' as const, sessaoId: b.professora.sessaoId, anoLetivoId: anterior.anoLetivoId }
      expect((await runInContext(em2025, () => new ConversaRepository(bancada.banco).anteriores(undefined, 100))).map((item) => item.id)).toEqual([mensagemDe2025])
      expect((await runInContext(em2025, () => new ConversaRepository(bancada.banco).perguntaDaChave(chaveDe2025)))?.id).toBe(mensagemDe2025)

      // A execução de 2025 não é lida em 2026, e a chave dela não devolve a execução antiga nem grava uma nova.
      expect(await get(b.professora, `/v1/execucoes/${execucaoDe2025}`)).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      const reenvio = await post(b.professora, '/v1/assistente/mensagens', { ...mensagem(b, 'o que é mol?'), chaveEnvio: chaveDe2025 })
      expect(reenvio).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      expect(JSON.stringify(reenvio.corpo)).not.toContain(execucaoDe2025)
      expect(await contarNaEscola(bancada, 'execucao_agente', b.escolaId, `chave_envio = '${chaveDe2025}'`)).toBe(1)
      // Mandar mensagem sobre a turma de 2025 também responde como o inexistente.
      expect((await post(b.professora, '/v1/assistente/mensagens', mensagem(b, 'bom dia', { turmaId: anterior.turmaId }))).status).toBe(404)
    })

    it('quem perdeu o vínculo depois do 202 não recebe resposta sobre a turma: a execução confere de novo ao rodar, e nada vai ao modelo', async () => {
      let liberar = (): void => undefined
      const antesDeRodar = new Promise<void>((resolver) => (liberar = resolver))
      let chamadasAoModelo = 0
      const ia = {
        gerar: async () => {
          chamadasAoModelo += 1
          return { saida: { tipo: 'texto', texto: 'resposta que não deveria existir', citacoes: [] }, medicao: {} }
        },
      } as unknown as LLMProvider
      // O trabalho da execução espera o teste liberar: é o intervalo entre o `202` e a execução.
      const comEspera: AgenteExecutor = { agendar: (execucao, trabalho) => executor.agendar(execucao, async (sinal) => (await antesDeRodar, trabalho(sinal))) }
      const servico = new AssistenteService(bancada.banco, new ExecucaoScheduler(bancada.banco, ia, comEspera, api.app.get<SuspensaoDeFuncao>(SUSPENSAO_DE_FUNCAO)), api.app.get(IaRequestRateLimit), api.app.get(TrechoSearch))

      await vincularProfessor(bancada, b, b.colega.usuarioId, b.turma, b.quimica)
      const { execucaoId } = await comoPessoa(b, b.colega, 'professor', () => servico.enviar({ texto: 'o que é o reagente limitante?', turmaId: b.turma, disciplinaId: b.quimica, chaveEnvio: randomUUID() }))
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [b.escolaId, b.colega.usuarioId, b.turma])
      liberar()
      expect(await execucaoTerminada(api, b.colega, execucaoId)).toMatchObject({ estado: 'falhou', erro: 'NAO_ENCONTRADO', resultado: null })
      expect(chamadasAoModelo).toBe(0)
      // A pergunta dela fica na conversa dela; resposta do Assistente, nenhuma, e nenhum consumo.
      const { rows } = await sql('select autor from mensagem_agente where escola_id = $1 and execucao_id = $2', [b.escolaId, execucaoId])
      expect(rows).toEqual([{ autor: 'usuario' }])
      expect(await contarNaEscola(bancada, 'consumo_ia', b.escolaId, `execucao_id = '${execucaoId}'`)).toBe(0)
    })

    it('fora de teste, só o repository da conversa, a leitura da execução de quem pediu e a contagem do titular tocam a thread e as mensagens do Assistente, e a contagem nunca lê o conteúdo', () => {
      const raiz = fileURLToPath(new URL('../../../../', import.meta.url))
      const pasta = join(raiz, 'apps/api/src')
      const semComentarios = (arquivo: string): string => readFileSync(join(pasta, arquivo), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      const tocam = (readdirSync(pasta, { recursive: true }) as string[])
        .filter((arquivo) => arquivo.endsWith('.ts') && !arquivo.endsWith('.test.ts'))
        .filter((arquivo) => /\b(mensagemAgente|threadAgente)\b|\b(mensagem_agente|thread_agente)\b/.test(semComentarios(arquivo)))
        .map((arquivo) => relative(raiz, join(pasta, arquivo)).split(sep).join('/'))
        .sort()
      // Nenhum módulo da coordenação, da governança ou do Analista lê a conversa do professor (regra 70, item 8). O terceiro da
      // lista é a contagem por categoria do titular (F3, RF11): conta as linhas do titular para o "Meus dados" da própria pessoa e
      // para a prévia de aluno; a prévia de professor volta antes de chegar a ele (D64). Ele conta; não lê.
      expect(tocam).toEqual(['apps/api/src/assistente/conversa.repository.ts', 'apps/api/src/ia/execucao.repository.ts', 'apps/api/src/privacidade/titulares.repository.ts'])
      // Com um arquivo do módulo da coordenação na lista, a sentinela deixaria de acusar uma leitura nova feita nele: por isso a
      // contagem não pode nem citar a coluna do que o professor escreveu, e o arquivo fica preso à forma da contagem: uma
      // ocorrência da tabela, em `count(*)`, sem identificador do drizzle e sem `*`.
      const contagem = semComentarios('privacidade/titulares.repository.ts')
      expect(contagem, 'a contagem do titular lê `conteudo` da mensagem do professor').not.toMatch(/conteudo/i)
      expect(contagem, 'o repository do titular usa a tabela da conversa do professor pelo drizzle').not.toMatch(/\b(mensagemAgente|threadAgente)\b/)
      expect(contagem.match(/\bmensagem_agente\b/g) ?? [], 'o repository do titular lê a mensagem do professor em mais de um lugar').toHaveLength(1)
      expect(contagem, 'a leitura de `mensagem_agente` no repository do titular não é a contagem').toMatch(/count\(\*\)::int from mensagem_agente m\b/)
      expect(contagem, 'o repository do titular seleciona colunas da conversa do professor com `*`').not.toMatch(/\bm\.\*|\bselect\s+\*/i)
    })
  })

  describe('idempotência e concorrência', () => {
    it('a mesma chave de envio duas vezes ao mesmo tempo dá uma execução, uma pergunta e uma resposta', async () => {
      const corpo = mensagem(a, 'monta uma atividade com 3 questões sobre mol')
      const respostas = await Promise.all(Array.from({ length: 4 }, () => post(a.professora, '/v1/assistente/mensagens', corpo)))
      expect(respostas.map((resposta) => resposta.status)).toEqual([202, 202, 202, 202])
      const ids = new Set(respostas.map((resposta) => resposta.corpo['execucaoId']))
      expect(ids.size).toBe(1)
      const [execucaoId] = [...ids] as string[]
      await execucaoTerminada(api, a.professora, execucaoId ?? '')
      // O reenvio depois de concluída devolve a mesma, e não roda de novo.
      expect((await post(a.professora, '/v1/assistente/mensagens', corpo)).corpo['execucaoId']).toBe(execucaoId)
      await executor.ociosa()
      expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId, `chave_envio = '${corpo.chaveEnvio}'`)).toBe(1)
      const { rows } = await sql('select autor from mensagem_agente where escola_id = $1 and execucao_id = $2 order by autor', [a.escolaId, execucaoId])
      expect(rows).toEqual([{ autor: 'agente' }, { autor: 'usuario' }])
      expect(await contarNaEscola(bancada, 'consumo_ia', a.escolaId, `execucao_id = '${execucaoId ?? ''}'`)).toBe(1)
    })

    it('a chave de outra pessoa da escola não devolve a execução dela, e não grava mensagem na conversa de ninguém', async () => {
      const corpo = mensagem(a, 'o que é massa molar?')
      const daProfessora = await post(a.professora, '/v1/assistente/mensagens', corpo)
      expect(daProfessora.status).toBe(202)
      const mensagensAntes = await contarNaEscola(bancada, 'mensagem_agente', a.escolaId, `autor = 'usuario'`)
      const daColega = await post(a.colega, '/v1/assistente/mensagens', { ...corpo, turmaId: a.outraTurma })
      expect(daColega).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      expect(JSON.stringify(daColega.corpo)).not.toContain(String(daProfessora.corpo['execucaoId']))
      expect(await contarNaEscola(bancada, 'mensagem_agente', a.escolaId, `autor = 'usuario'`)).toBe(mensagensAntes)
      // A mesma chave em outra escola é outra execução, da outra escola.
      const emB = await post(b.professora, '/v1/assistente/mensagens', { ...corpo, turmaId: b.turma, disciplinaId: b.quimica })
      expect(emB.status).toBe(202)
      expect(emB.corpo['execucaoId']).not.toBe(daProfessora.corpo['execucaoId'])
      await executor.ociosa()
    })
  })

  describe('suspensão por função (D60)', () => {
    it('com a conversa suspensa em A, o POST é recusado antes de gravar execução, pergunta ou consumo; em B a mesma função segue', async () => {
      await suspender(a, 'conversa_e_ferramentas')
      try {
        const antes = [await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'mensagem_agente', a.escolaId), await contarNaEscola(bancada, 'consumo_ia', a.escolaId)]
        expect(await post(a.professora, '/v1/assistente/mensagens', mensagem(a, 'monta uma atividade de mol'))).toMatchObject({ status: 409, corpo: { erro: { codigo: 'FUNCAO_SUSPENSA' } } })
        await executor.ociosa()
        expect([await contarNaEscola(bancada, 'execucao_agente', a.escolaId), await contarNaEscola(bancada, 'mensagem_agente', a.escolaId), await contarNaEscola(bancada, 'consumo_ia', a.escolaId)]).toEqual(antes)
        const emB = await execucaoTerminada(api, b.professora, await dispararExecucao(api, b.professora, '/v1/assistente/mensagens', mensagem(b, 'monta uma atividade de mol')))
        expect(emB.estado).toBe('concluida')
        // O que a função já produziu continua lá: a conversa de A segue podendo ser lida.
        expect((await conversaDe(a.professora)).mensagens.length).toBeGreaterThan(0)
      } finally {
        await retomar(a, 'conversa_e_ferramentas')
      }
      expect((await post(a.professora, '/v1/assistente/mensagens', mensagem(a, 'monta uma atividade de mol'))).status).toBe(202)
      await executor.ociosa()
    })
  })

  describe('o que a professora escreve mora só na conversa (regra 20, item 9; D35; D55)', () => {
    it('a descrição de um aluno no pedido não vai para execução, consumo, artefato, auditoria, log nem para a resposta', async () => {
      const descricao = 'A Mariana Albuquerque Sintética tem dislexia e TDAH; adapta a atividade de estequiometria para ela'
      const artefatosAntes = await contarNaEscola(bancada, 'artefato', a.escolaId)
      const execucaoId = await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, descricao))
      const execucao = await execucaoTerminada(api, a.professora, execucaoId)
      expect(execucao.estado).toBe('concluida')
      const proibido = /Mariana|Albuquerque|dislexia|TDAH/i
      // A pergunta está na conversa, e só nela.
      const { rows: mensagens } = await sql('select autor, conteudo from mensagem_agente where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])
      expect(mensagens.filter((linha: { conteudo: unknown }) => proibido.test(JSON.stringify(linha.conteudo))).map((linha: { autor: string }) => linha.autor)).toEqual(['usuario'])
      const { rows: execucoes } = await sql('select entrada, resultado, erro from execucao_agente where id = $1', [execucaoId])
      expect(JSON.stringify(execucoes)).not.toMatch(proibido)
      const { rows: consumo } = await sql('select * from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])
      expect(consumo).toHaveLength(1)
      expect(consumo[0]).toMatchObject({ entrada: null, saida: null, tarefa: 'propor_ferramenta' })
      expect(JSON.stringify(consumo)).not.toMatch(proibido)
      expect(JSON.stringify((await sql('select * from auditoria where escola_id = $1', [a.escolaId])).rows)).not.toMatch(proibido)
      expect(JSON.stringify((await sql('select * from artefato where escola_id = $1', [a.escolaId])).rows)).not.toMatch(proibido)
      expect(await contarNaEscola(bancada, 'artefato', a.escolaId)).toBe(artefatosAntes)
      // O log capturado não está vazio: tem a linha desta execução. E não tem o que a professora escreveu.
      expect(linhasDeLog.some((linha) => linha.includes('ia.execucao.concluida') && linha.includes(execucaoId))).toBe(true)
      expect(linhasDeLog.join('\n')).not.toMatch(proibido)
      expect(linhasDeLog.join('\n')).not.toContain('adapta a atividade')
    })

    it('pedido de corrigir e dar nota a uma redação é recusado por regra fixa: nada sobre o texto do aluno é produzido, e não existe nota em lugar nenhum', async () => {
      const redacao = 'Na minha opinião a tecnologia aproxima as pessoas porque todo mundo conversa pelo celular'
      const antes = [await contarNaEscola(bancada, 'artefato', a.escolaId), await contarNaEscola(bancada, 'entrega', a.escolaId)]
      const execucaoId = await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, `Corrige esta redação do aluno e sugere uma nota de 0 a 10: "${redacao}"`))
      const execucao = await execucaoTerminada(api, a.professora, execucaoId)
      expect(execucao.resultado?.mensagem).toMatchObject({ tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] })
      // A resposta veio da regra, sem modelo, e não repete nem avalia o texto do aluno.
      const { rows: consumo } = await sql('select origem, modelo, entrada, saida from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])
      expect(consumo).toEqual([{ origem: 'regra_fixa', modelo: 'regra_fixa', entrada: null, saida: null }])
      const { rows: resposta } = await sql(`select conteudo from mensagem_agente where escola_id = $1 and execucao_id = $2 and autor = 'agente'`, [a.escolaId, execucaoId])
      expect(JSON.stringify(resposta)).not.toMatch(/tecnologia|celular|\d/u)
      expect(Object.keys((resposta[0] as { conteudo: object }).conteudo).sort()).toEqual(['citacoes', 'texto', 'tipo'])
      expect([await contarNaEscola(bancada, 'artefato', a.escolaId), await contarNaEscola(bancada, 'entrega', a.escolaId)]).toEqual(antes)
      expect(linhasDeLog.some((linha) => linha.includes('ia.execucao.concluida') && linha.includes(execucaoId))).toBe(true)
      expect(linhasDeLog.join('\n')).not.toMatch(/tecnologia aproxima/u)
    })

    it('as outras formas de pedir julgamento ou nota também são recusadas pela rota, sem modelo; o pedido legítimo sobre o próprio material segue', async () => {
      const texto = 'A água é formada porque o hidrogênio gosta do oxigênio e os dois se juntam na reação.'
      for (const pedido of ['que nota você daria?', 'dá uma olhada nesse texto do aluno', 'avalia essa resposta', `${texto} ${texto} o que achou?`, 'que conceito merece esse texto?']) {
        await zerarLimiteDePedidosDeIa(api)
        const execucaoId = await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, pedido))
        const execucao = await execucaoTerminada(api, a.professora, execucaoId)
        expect(execucao.resultado?.mensagem, pedido).toMatchObject({ tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] })
        const { rows } = await sql('select origem from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])
        expect(rows, pedido).toEqual([{ origem: 'regra_fixa' }])
      }
      const legitimo = await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, 'melhora o enunciado da questão 3')))
      expect(legitimo.resultado?.mensagem?.['texto']).not.toBe(RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO)
    })

    it('colar o texto numa mensagem e pedir a opinião na seguinte também é recusado, sem modelo; e o texto colado não vai ao modelo depois', async () => {
      const colado = 'Na minha opinião a internet ajudou muito as pessoas porque agora da para estudar de casa e falar com os amigos. Mas tambem tem coisas ruins como o cyberbullying e as fake news.'
      await zerarLimiteDePedidosDeIa(api)
      // A professora da outra turma, para a conversa começar limpa.
      await execucaoTerminada(api, a.colega, await dispararExecucao(api, a.colega, '/v1/assistente/mensagens', mensagem(a, colado, { turmaId: a.outraTurma })))
      const execucaoId = await dispararExecucao(api, a.colega, '/v1/assistente/mensagens', mensagem(a, 'e aí, ficou bom?', { turmaId: a.outraTurma }))
      const execucao = await execucaoTerminada(api, a.colega, execucaoId)
      expect(execucao.resultado?.mensagem).toMatchObject({ tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO })
      const { rows } = await sql('select origem from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])
      expect(rows).toEqual([{ origem: 'regra_fixa' }])
      // O pedido comum que vem depois segue, e responde.
      const seguinte = await execucaoTerminada(api, a.colega, await dispararExecucao(api, a.colega, '/v1/assistente/mensagens', mensagem(a, 'monta uma atividade de estequiometria', { turmaId: a.outraTurma })))
      expect(seguinte.resultado?.mensagem?.['tipo']).toBe('proposta_de_ferramenta')
    })

    it('o nome e a condição de um aluno no pedido de atividade não viram o tema da proposta, e por isso não viram título de artefato', async () => {
      const execucaoId = await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagem(a, 'Monta uma atividade para a Mariana Albuquerque, que tem dislexia'))
      const execucao = await execucaoTerminada(api, a.professora, execucaoId)
      expect(execucao.resultado?.mensagem).toMatchObject({ tipo: 'proposta_de_ferramenta', proposta: { ferramenta: 'atividade_objetiva', parametros: { tema: 'Química', turmaId: a.turma, disciplinaId: a.quimica } } })
      const { rows } = await sql(`select conteudo from mensagem_agente where escola_id = $1 and execucao_id = $2 and autor = 'agente'`, [a.escolaId, execucaoId])
      expect(JSON.stringify(rows)).not.toMatch(/Mariana|Albuquerque|dislexia/u)
    })
  })

  describe('limite dos pedidos de IA (regra 80, item 1)', () => {
    it('é por pessoa, não por IP: acima do teto a professora recebe LIMITE_EXCEDIDO, e a colega, do mesmo IP e da mesma escola, segue', async () => {
      const corpo = mensagem(a, 'o que é mol?')
      for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_USUARIO; pedido++) expect((await post(a.professora, '/v1/assistente/mensagens', corpo)).status).toBe(202)
      const execucoesAntes = await contarNaEscola(bancada, 'execucao_agente', a.escolaId)
      expect(await post(a.professora, '/v1/assistente/mensagens', mensagem(a, 'e massa molar?'))).toMatchObject({ status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO' } } })
      expect(await contarNaEscola(bancada, 'execucao_agente', a.escolaId)).toBe(execucoesAntes)
      expect((await post(a.colega, '/v1/assistente/mensagens', mensagem(a, 'o que é mol?', { turmaId: a.outraTurma }))).status).toBe(202)
      await executor.ociosa()
      // Uma linha de log por janela, com o evento e os ids, e nada do pedido (regra 80, item 10; regra 20, item 9).
      expect(await post(a.professora, '/v1/assistente/mensagens', mensagem(a, 'e massa molar?'))).toMatchObject({ status: 429 })
      const doLimite = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['evento'] === 'ia.limite_de_pedidos_atingido')
      expect(doLimite).toHaveLength(1)
      expect(doLimite[0]).toMatchObject({ evento: 'ia.limite_de_pedidos_atingido', tipo: 'usuario', escolaId: a.escolaId, usuarioId: a.professora.usuarioId })
      expect(JSON.stringify(doLimite)).not.toMatch(/massa molar|mol\?/u)
    })
  })
})
