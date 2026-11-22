import { CHAVES_DE_FUNCAO, consumoResponseSchema, parteDosTokens, funcaoDaGovernancaResponseSchema, funcoesDaGovernancaResponseSchema, resumoDaGovernancaResponseSchema, FUNCOES, TROCAS_POR_MES_PADRAO_DO_TUTOR, type ChaveDeFuncao } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, type TestApi, type RespostaHttp } from '../../test/test-api.js'
import { FilaDeIa } from '../../test/fila-de-ia.fixture.js'
import { aplicarAtividade, aprovarOLote, criarAtividade, criarVersaoAdaptada, encerrarAtividade, responderProva, rotasDaAtividade, type RotasDaAtividade } from '../../test/atividade.fixture.js'
import {
  contarNaEscola,
  copiarArtefatoParaOAnoAnterior,
  dispararExecucao,
  execucaoTerminada,
  montarAnoAnterior,
  montarEscolaComAssistente,
  NOME_DA_PROFESSORA_DE_TESTE,
  NOME_DO_ALUNO_DE_TESTE,
  vincularProfessor,
  zerarLimiteDePedidosDeIa,
  type EscolaComAssistente,
} from '../../test/escola-assistente.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'

/**
 * A governança de IA da coordenação (MVP, A5; D9, D45, D60, D64; regra 70, itens 5, 6, 8 e 9), pela rota, contra o
 * Postgres. A escola A tem, no 2º ano (três professores na série): a lista de Química aplicada e com o lote aprovado
 * pela professora, e três versões adaptadas (aprovada, pendente, rejeitada). No 3º ano, **um professor só**: uma versão
 * adaptada pendente. A escola B tem as próprias entregas, que nunca entram nos números de A.
 */
describe('governança de IA da coordenação', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let fila: FilaDeIa
  let rotas: RotasDaAtividade
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  /** A lista original do 2ºB de A, e o lote aprovado dela. */
  let original: string
  let loteAprovado: string
  /** A série de um professor só, em A: o 3º ano, com o 3ºA. */
  let terceiroAno: { serieId: string; turmaId: string; professor: TestSessao; entregaId: string }
  /** A versão adaptada da colega, no 2ºC: é o segundo professor com entrega no 2º ano. */
  let entregaDaColega: string

  const sql = async <Linha extends Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<Linha[]> => (await bancada.pool.query(texto, valores)).rows as Linha[]
  const get = async (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, await sessao.tokenNovo())
  const post = async (sessao: TestSessao, caminho: string, corpo: unknown = {}): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, await sessao.tokenNovo(), corpo)
  const erro = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })
  const NAO_ENCONTRADO = { status: 404, codigo: 'NAO_ENCONTRADO' }
  const ENTRADA_INVALIDA = { status: 400, codigo: 'ENTRADA_INVALIDA' }
  const FUNCAO_SUSPENSA = { status: 409, codigo: 'FUNCAO_SUSPENSA' }

  const resumoDe = async (escola: EscolaComAssistente, consulta = '') => {
    const resposta = await get(escola.coordenacao, `/v1/governanca/resumo${consulta}`)
    expect(resposta.status).toBe(200)
    return { lido: resumoDaGovernancaResponseSchema.parse(resposta.corpo), texto: JSON.stringify(resposta.corpo) }
  }
  const funcaoDe = async (escola: EscolaComAssistente, chave: ChaveDeFuncao) => {
    const { agentes } = funcoesDaGovernancaResponseSchema.parse((await get(escola.coordenacao, '/v1/governanca/funcoes')).corpo)
    const funcao = agentes.flatMap((agente) => agente.funcoes).find((candidata) => candidata.chave === chave)
    if (funcao === undefined) throw new Error('função fora da resposta')
    return funcao
  }
  const suspender = (escola: EscolaComAssistente, chave: string, corpo: unknown = {}) => post(escola.coordenacao, `/v1/governanca/funcoes/${chave}/suspender`, corpo)
  const retomar = (escola: EscolaComAssistente, chave: string, corpo: unknown = {}) => post(escola.coordenacao, `/v1/governanca/funcoes/${chave}/retomar`, corpo)
  const suspensoes = (escola: EscolaComAssistente, chave: ChaveDeFuncao) =>
    sql<{ id: string; suspensa_por: string; retomada_por: string | null; retomada_em: Date | null; motivo: string | null }>(
      'select id, suspensa_por, retomada_por, retomada_em, motivo from suspensao_de_funcao where escola_id = $1 and funcao = $2 order by id',
      [escola.escolaId, chave],
    )
  const auditorias = (escola: EscolaComAssistente, acao: string) =>
    sql<{ autor_usuario_id: string; entidade_id: string; antes: unknown; depois: unknown; em: Date }>('select autor_usuario_id, entidade_id, antes, depois, em from auditoria where escola_id = $1 and acao = $2 order by id', [escola.escolaId, acao])

  /** Um artefato gravado direto, com quem o criou, e a versão adaptada dele com a entrega pendente. Devolve os ids. */
  const versaoAdaptadaDe = async (escola: EscolaComAssistente, turmaId: string, criadoPor: string): Promise<{ artefatos: string[]; entregaId: string }> => {
    const [copia] = await sql<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por)
       select escola_id, ano_letivo_id, $3, disciplina_id, tipo, titulo, conteudo, $4 from artefato where escola_id = $1 and id = $2 returning id`,
      [escola.escolaId, original, turmaId, criadoPor],
    )
    const [adaptada] = await sql<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id, criado_por)
       select escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo || '{"adaptacao": {"tipos": ["fonte_ampliada"]}}'::jsonb, id, criado_por from artefato where escola_id = $1 and id = $2 returning id`,
      [escola.escolaId, copia?.id],
    )
    const [criada] = await sql<{ id: string }>(`insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id) values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $4) returning id`, [
      escola.escolaId,
      escola.anoLetivoId,
      turmaId,
      adaptada?.id,
    ])
    if (copia === undefined || adaptada === undefined || criada === undefined) throw new Error('versão adaptada de teste não criada')
    return { artefatos: [copia.id, adaptada.id], entregaId: criada.id }
  }

  /** Uma lista aplicada ao 2ºB, com a resposta do aluno da escola, ainda aberta. */
  const listaRespondida = async (escola: EscolaComAssistente): Promise<string> => {
    const id = await aplicarAtividade(rotas, escola.professora, await criarAtividade(bancada, escola), escola.turma)
    await responderProva(rotas, escola.aluno, id, [0, 1, 2, 3, 0])
    return id
  }
  const mensagemAoAssistente = (escola: EscolaComAssistente) => ({ texto: 'o que é o reagente limitante?', turmaId: escola.turma, disciplinaId: escola.quimica, chaveEnvio: randomUUID() })

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor)
    api = fila.api
    rotas = rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)

    original = await criarAtividade(bancada, a)
    const aplicada = await aplicarAtividade(rotas, a.professora, original, a.turma)
    await responderProva(rotas, a.aluno, aplicada, [0, 1, 2, 3, 0])
    const entregaDoLote = await encerrarAtividade(rotas, a.professora, aplicada)
    if (entregaDoLote === null) throw new Error('o lote não nasceu')
    loteAprovado = entregaDoLote
    await aprovarOLote(rotas, a.professora, aplicada)
    for (const estado of ['aprovada', 'pendente', 'rejeitada'] as const) await criarVersaoAdaptada(bancada, a, original, estado)

    // O 3º ano de A: uma série, uma turma e um professor só.
    const serie = await post(a.coordenacao, '/v1/series', { etapa: 'em', ano: 3 })
    const turma = await post(a.coordenacao, '/v1/turmas', { serieId: serie.corpo['id'], nome: '3ºA' })
    const professor = await bancada.sessao(a.escolaId, 'professor')
    const turmaId = turma.corpo['id'] as string
    await vincularProfessor(bancada, a, professor.usuarioId, turmaId, a.quimica)
    const doTerceiro = await criarAtividade(bancada, a, { turmaId })
    const [adaptada] = await sql<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id, criado_por)
       select escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo || '{"adaptacao": {"tipos": ["fonte_ampliada"]}}'::jsonb, id, criado_por from artefato where escola_id = $1 and id = $2 returning id`,
      [a.escolaId, doTerceiro],
    )
    const [entrega] = await sql<{ id: string }>(`insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id) values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $4) returning id`, [a.escolaId, a.anoLetivoId, turmaId, adaptada?.id])
    if (entrega === undefined) throw new Error('entrega do 3º ano não criada')
    terceiroAno = { serieId: serie.corpo['id'] as string, turmaId, professor, entregaId: entrega.id }

    // A colega, de Química no 2ºC, também tem entrega no 2º ano: a série tem dois professores com dado, e a lista a mostra.
    entregaDaColega = (await versaoAdaptadaDe(a, a.outraTurma, a.colega.usuarioId)).entregaId

    // A escola B tem as próprias entregas, com outros números.
    const deB = await criarAtividade(bancada, b)
    await criarVersaoAdaptada(bancada, b, deB, 'aprovada')
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterAll(async () => {
    await fila.ociosa()
    await fila.fechar()
    await bancada.fechar()
  })

  describe('o que a IA gerou e quem decidiu', () => {
    it('conta o que a IA gerou e o que as pessoas decidiram, no ano em curso da escola', async () => {
      const { lido } = await resumoDe(a)
      // Oito artefatos (a lista, três versões adaptadas, a lista e a versão adaptada do 3º ano, a lista e a versão adaptada
      // da colega) e um lote de correção.
      expect(lido.numeros).toEqual({ geradoPorIa: 9, aprovadoPorPessoa: 2, rejeitado: 1, esperando: 3 })
    })

    it('os números de A não somam nada de B, e os de B não somam nada de A', async () => {
      expect((await resumoDe(b)).lido.numeros).toEqual({ geradoPorIa: 2, aprovadoPorPessoa: 1, rejeitado: 0, esperando: 0 })
      const deA = await resumoDe(a)
      const deB = await resumoDe(b)
      const idsDeA = (await sql<{ id: string }>('select id from entrega where escola_id = $1', [a.escolaId])).map((linha) => linha.id)
      expect(idsDeA.length).toBeGreaterThan(0)
      for (const id of idsDeA) expect(deB.texto).not.toContain(id)
      expect(deA.lido.itens.every((item) => idsDeA.includes(item.id))).toBe(true)
    })

    it('o que é de outro ano letivo não entra nos números nem na lista', async () => {
      const antes = await resumoDe(a)
      const anterior = await montarAnoAnterior(bancada, a)
      const copia = await copiarArtefatoParaOAnoAnterior(bancada, a, anterior, original)
      const depois = await resumoDe(a)
      expect(depois.lido.numeros).toEqual(antes.lido.numeros)
      expect(depois.texto).not.toContain(copia.entregaId)
    })

    it('a linha diz a função, o tipo, o estado, a série e as datas, da mais nova para a mais antiga, e nada de pessoa', async () => {
      const { lido, texto } = await resumoDe(a)
      const ids = lido.itens.map((item) => item.id)
      expect(ids).toEqual([...ids].sort().reverse())
      for (const item of lido.itens) expect(Object.keys(item).sort()).toEqual(['criadaEm', 'decididaEm', 'estado', 'funcao', 'id', 'serie', 'tipo'])
      expect(lido.itens.find((item) => item.id === loteAprovado)).toMatchObject({ funcao: 'correcao_de_objetiva', tipo: 'lote_de_correcao', estado: 'aprovada', serie: { id: a.serieId, etapa: 'em', ano: 2 } })
      expect(lido.itens.filter((item) => item.estado === 'pendente').every((item) => item.decididaEm === null)).toBe(true)
      expect(lido.itens.filter((item) => item.estado !== 'pendente').every((item) => item.decididaEm !== null)).toBe(true)

      // Nenhum id nem nome de professor ou de aluno, nenhuma turma, nenhum título, nenhuma justificativa.
      const pessoas = await sql<{ id: string; nome: string }>(`select id, nome from usuario where escola_id = $1 and papel in ('professor', 'aluno')`, [a.escolaId])
      expect(pessoas.length).toBeGreaterThan(3)
      for (const pessoa of pessoas) {
        expect(texto).not.toContain(pessoa.id)
        expect(texto).not.toContain(pessoa.nome)
      }
      for (const proibido of [a.turma, a.outraTurma, terceiroAno.turmaId, 'Justificativa sintética', 'Estequiometria', NOME_DA_PROFESSORA_DE_TESTE, NOME_DO_ALUNO_DE_TESTE]) expect(texto).not.toContain(proibido)
    })

    it('a série com um professor só com entrega fica fora da lista, mesmo com dois professores alocados; com dois com entrega, entra', async () => {
      const { lido, texto } = await resumoDe(a)
      expect(lido.itens).toHaveLength(5)
      expect(lido.itens.every((item) => item.serie.id === a.serieId)).toBe(true)
      expect(lido.itens.map((item) => item.id)).toContain(entregaDaColega)
      expect(texto).not.toContain(terceiroAno.entregaId)
      expect(texto).not.toContain(terceiroAno.serieId)
      // Um segundo professor com vínculo confirmado no 3º ano, sem entrega nenhuma: não forma grupo. Senão a linha diria o
      // que o primeiro fez, e insinuaria que o segundo não usa a ferramenta (D45, D64).
      const segundo = await bancada.sessao(a.escolaId, 'professor')
      await vincularProfessor(bancada, a, segundo.usuarioId, terceiroAno.turmaId, a.fisica)
      expect((await resumoDe(a)).texto).not.toContain(terceiroAno.entregaId)

      // Com uma entrega dele no 3º ano, a série tem dois professores com dado, e entra.
      const doSegundo = await versaoAdaptadaDe(a, terceiroAno.turmaId, segundo.usuarioId)
      try {
        const comGrupo = await resumoDe(a)
        expect(comGrupo.lido.itens.find((item) => item.id === terceiroAno.entregaId)).toMatchObject({ estado: 'pendente', serie: { id: terceiroAno.serieId, ano: 3 } })
        expect(comGrupo.lido.numeros).toEqual({ ...lido.numeros, geradoPorIa: lido.numeros.geradoPorIa + 2, esperando: lido.numeros.esperando + 1 })
      } finally {
        await sql('delete from entrega where escola_id = $1 and id = $2', [a.escolaId, doSegundo.entregaId])
        await sql('delete from artefato where escola_id = $1 and id = any($2::uuid[]) and origem_id is not null', [a.escolaId, doSegundo.artefatos])
        await sql('delete from artefato where escola_id = $1 and id = any($2::uuid[])', [a.escolaId, doSegundo.artefatos])
        await sql('delete from vinculo where escola_id = $1 and usuario_id = $2', [a.escolaId, segundo.usuarioId])
      }
      expect((await resumoDe(a)).texto).not.toContain(terceiroAno.entregaId)
    })

    it('filtra pelo estado e pagina, sem repetir nem pular entrega', async () => {
      const pendentes = await resumoDe(a, '?estado=pendente')
      expect(pendentes.lido.itens.map((item) => item.estado)).toEqual(['pendente', 'pendente'])
      const todas = (await resumoDe(a)).lido.itens.map((item) => item.id)
      const primeira = (await resumoDe(a, '?limite=3')).lido
      expect(primeira.itens.map((item) => item.id)).toEqual(todas.slice(0, 3))
      expect(primeira.proxima).toBe(todas[2])
      const segunda = (await resumoDe(a, `?limite=3&pagina=${String(primeira.proxima)}`)).lido
      expect(segunda.itens.map((item) => item.id)).toEqual(todas.slice(3))
      expect(segunda.proxima).toBeUndefined()
    })

    it.each(['professorId', 'turmaId', 'usuarioId', 'ordenarPor', 'agruparPor'])('não existe filtro, ordenação nem agrupamento por pessoa: `%s` é entrada inválida', async (campo) => {
      const valor = campo.endsWith('Id') ? a.professora.usuarioId : 'professor'
      expect(erro(await get(a.coordenacao, `/v1/governanca/resumo?${campo}=${valor}`))).toEqual(ENTRADA_INVALIDA)
    })

    it('a auditoria responde o que a IA gerou, quem aprovou e quando; a governança, só que uma pessoa aprovou e quando', async () => {
      const { lido } = await resumoDe(a, '?estado=pendente')
      // A pendente da professora do 2ºB (a da colega é da turma dela, e a professora não a decide).
      const pendente = lido.itens.find((item) => item.id !== entregaDaColega)
      if (pendente === undefined) throw new Error('nenhuma entrega pendente')
      const decidida = await post(a.professora, `/v1/entregas/${pendente.id}/decidir`, { decisao: 'aprovar' })
      expect(decidida.status).toBe(200)
      const item = (await resumoDe(a)).lido.itens.find((candidato) => candidato.id === pendente.id)
      expect(item).toMatchObject({ funcao: 'adaptacao', tipo: 'versao_adaptada', estado: 'aprovada' })
      // A versão adaptada e o lote: para qualquer entrega, a auditoria diz a função, quem decidiu e quando.
      const registros = await sql<{ acao: string; autor_usuario_id: string; depois: { funcao?: string }; em: Date }>(
        `select acao, autor_usuario_id, depois, em from auditoria where escola_id = $1 and entidade = 'entrega' and entidade_id = any($2::uuid[]) order by id`,
        [a.escolaId, [pendente.id, loteAprovado]],
      )
      expect(registros.map((registro) => registro.acao).sort()).toEqual(['entrega.decidida', 'lote.aprovado'])
      for (const registro of registros) {
        expect(registro.autor_usuario_id).toBe(a.professora.usuarioId)
        expect(registro.em).toBeInstanceOf(Date)
      }
      expect(registros.find((registro) => registro.acao === 'entrega.decidida')?.depois).toMatchObject({ funcao: 'adaptacao' })
      expect(new Date(String(item?.decididaEm)).getTime()).toBeGreaterThan(Date.now() - 60_000)
    })
  })

  describe('o que cada função faz sozinha', () => {
    it('os três agentes e as sete funções, com a autonomia do catálogo e sem suspensão', async () => {
      const resposta = await get(b.coordenacao, '/v1/governanca/funcoes')
      const { agentes } = funcoesDaGovernancaResponseSchema.parse(resposta.corpo)
      expect(agentes.map((agente) => agente.agente)).toEqual(['assistente_de_ensino', 'tutor', 'analista_de_desempenho_escolar'])
      const funcoes = agentes.flatMap((agente) => agente.funcoes)
      expect(funcoes.map((funcao) => funcao.chave)).toEqual(CHAVES_DE_FUNCAO)
      for (const funcao of funcoes) {
        const { nome, autonomia, altoRisco, fazSozinha, esperaAprovacao } = FUNCOES[funcao.chave]
        expect(funcao).toEqual({ chave: funcao.chave, nome, autonomia, altoRisco, fazSozinha, esperaAprovacao, suspensa: false, suspensao: null })
      }
    })

    it('em "Como cada IA trabalha", a classificação do material é do Assistente de ensino, de autonomia 1, alto risco e suspensível, com o texto do catálogo', async () => {
      const { agentes } = funcoesDaGovernancaResponseSchema.parse((await get(b.coordenacao, '/v1/governanca/funcoes')).corpo)
      const assistente = agentes.find((agente) => agente.agente === 'assistente_de_ensino')
      const funcao = assistente?.funcoes.find((candidata) => candidata.chave === 'classificacao_do_material')
      expect(funcao).toEqual({
        chave: 'classificacao_do_material',
        nome: 'Classificação do material',
        autonomia: 1,
        altoRisco: true,
        fazSozinha: 'Classifica cada capítulo ou bloco de páginas do material pela BNCC, à noite. A coordenação corrige, e a correção vence.',
        esperaAprovacao: 'Nada chega ao aluno pela classificação: a habilidade de cada questão só vale quando o professor confere e aplica a atividade.',
        suspensa: false,
        suspensao: null,
      })
    })
  })

  describe('a suspensão por função (D60)', () => {
    it('suspender grava a suspensão vigente com quem suspendeu, o motivo e a auditoria; o segundo clique não cria outra', async () => {
      const primeira = await suspender(a, 'resumo_e_alerta', { motivo: 'revisao_pedagogica' })
      try {
        expect(primeira.status).toBe(200)
        const funcao = funcaoDaGovernancaResponseSchema.parse(primeira.corpo)
        expect(funcao).toMatchObject({ chave: 'resumo_e_alerta', suspensa: true, suspensao: { motivo: 'revisao_pedagogica' } })
        const [linha, ...outras] = await suspensoes(a, 'resumo_e_alerta')
        expect(outras).toEqual([])
        expect(linha).toMatchObject({ suspensa_por: a.coordenacao.usuarioId, retomada_em: null, motivo: 'revisao_pedagogica' })
        expect(await auditorias(a, 'funcao.suspensa')).toMatchObject([{ autor_usuario_id: a.coordenacao.usuarioId, entidade_id: linha?.id, depois: { funcao: 'resumo_e_alerta', motivo: 'revisao_pedagogica' } }])

        const segunda = funcaoDaGovernancaResponseSchema.parse((await suspender(a, 'resumo_e_alerta', { motivo: 'incidente' })).corpo)
        expect(segunda.suspensao).toEqual(funcao.suspensao)
        expect(await suspensoes(a, 'resumo_e_alerta')).toHaveLength(1)
        expect(await auditorias(a, 'funcao.suspensa')).toHaveLength(1)
        expect(await funcaoDe(a, 'resumo_e_alerta')).toMatchObject({ suspensa: true, suspensao: funcao.suspensao })
      } finally {
        await retomar(a, 'resumo_e_alerta')
      }
    })

    it('a classificação do material se suspende e se retoma como as outras: a suspensão é da escola, aparece no time e não alcança a função vizinha', async () => {
      const suspensa = await suspender(a, 'classificacao_do_material', { motivo: 'revisao_pedagogica' })
      try {
        expect(suspensa.status).toBe(200)
        expect(funcaoDaGovernancaResponseSchema.parse(suspensa.corpo)).toMatchObject({ chave: 'classificacao_do_material', suspensa: true, suspensao: { motivo: 'revisao_pedagogica' } })
        expect(await suspensoes(a, 'classificacao_do_material')).toMatchObject([{ suspensa_por: a.coordenacao.usuarioId, retomada_em: null, motivo: 'revisao_pedagogica' }])
        expect(await auditorias(a, 'funcao.suspensa')).toContainEqual(expect.objectContaining({ depois: { funcao: 'classificacao_do_material', motivo: 'revisao_pedagogica' } }))
        // A conversa do mesmo agente segue, e a outra escola não é alcançada.
        expect(await funcaoDe(a, 'conversa_e_ferramentas')).toMatchObject({ suspensa: false })
        expect(await funcaoDe(b, 'classificacao_do_material')).toMatchObject({ suspensa: false })
      } finally {
        await retomar(a, 'classificacao_do_material')
      }
      expect(await funcaoDe(a, 'classificacao_do_material')).toMatchObject({ suspensa: false, suspensao: null })
    })

    it('dois cliques no mesmo instante gravam uma suspensão só', async () => {
      const respostas = await Promise.all([suspender(b, 'adaptacao'), suspender(b, 'adaptacao'), suspender(b, 'adaptacao')])
      try {
        expect(respostas.map((resposta) => resposta.status)).toEqual([200, 200, 200])
        expect(await suspensoes(b, 'adaptacao')).toHaveLength(1)
        expect(await auditorias(b, 'funcao.suspensa')).toHaveLength(1)
      } finally {
        await retomar(b, 'adaptacao')
      }
    })

    it('retomar fecha a vigente com quem retomou e audita; sem suspensão vigente, responde como inexistente', async () => {
      expect(erro(await retomar(b, 'sinais_para_o_professor'))).toEqual(NAO_ENCONTRADO)
      await suspender(b, 'sinais_para_o_professor')
      const retomada = await retomar(b, 'sinais_para_o_professor')
      expect(funcaoDaGovernancaResponseSchema.parse(retomada.corpo)).toMatchObject({ chave: 'sinais_para_o_professor', suspensa: false, suspensao: null })
      const [linha] = await suspensoes(b, 'sinais_para_o_professor')
      expect(linha?.retomada_por).toBe(b.coordenacao.usuarioId)
      expect(linha?.retomada_em).toBeInstanceOf(Date)
      const registros = (await auditorias(b, 'funcao.retomada')).filter((registro) => registro.entidade_id === linha?.id)
      expect(registros).toMatchObject([{ autor_usuario_id: b.coordenacao.usuarioId, antes: { funcao: 'sinais_para_o_professor' } }])
      expect(erro(await retomar(b, 'sinais_para_o_professor'))).toEqual(NAO_ENCONTRADO)
      expect(await suspensoes(b, 'sinais_para_o_professor')).toHaveLength(1)
    })

    it('função fora do catálogo responde como inexistente; motivo fora da lista e campo a mais são entrada inválida', async () => {
      expect(erro(await suspender(a, 'corretor_de_redacao'))).toEqual(NAO_ENCONTRADO)
      expect(erro(await retomar(a, 'corretor_de_redacao'))).toEqual(NAO_ENCONTRADO)
      expect(erro(await suspender(a, 'adaptacao', { motivo: 'a professora Helena errou' }))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await suspender(a, 'adaptacao', { escolaId: b.escolaId }))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await retomar(a, 'adaptacao', { escolaId: b.escolaId }))).toEqual(ENTRADA_INVALIDA)
      expect(await suspensoes(a, 'adaptacao')).toEqual([])
    })

    it('a chave fora do catálogo e a de uma função sem suspensão respondem igual ao mesmo corpo, no retomar e no suspender: o 404 do válido e o 400 do inválido, e nada é suspenso, retomado nem auditado', async () => {
      const marcas = async () => ({
        suspensoes: await suspensoes(a, 'sinais_para_o_professor'),
        suspensas: (await auditorias(a, 'funcao.suspensa')).length,
        retomadas: (await auditorias(a, 'funcao.retomada')).length,
      })
      const antes = await marcas()
      const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, corpo: { ...resposta.corpo, erro: { ...resposta.corpo.erro, requisicaoId: undefined } } })
      for (const [corpo, esperado] of [
        [{}, NAO_ENCONTRADO],
        [{ escolaId: b.escolaId }, ENTRADA_INVALIDA],
      ] as const) {
        const foraDoCatalogo = await retomar(a, 'corretor_de_redacao', corpo)
        const semSuspensao = await retomar(a, 'sinais_para_o_professor', corpo)
        expect(erro(foraDoCatalogo), JSON.stringify(corpo)).toEqual(esperado)
        expect(semRequisicao(semSuspensao), JSON.stringify(corpo)).toEqual(semRequisicao(foraDoCatalogo))
      }
      // O corpo inválido, no suspender, é o mesmo 400 para a chave do catálogo e para a de fora: a função continua ativa.
      for (const corpo of [{ motivo: 'a professora Helena errou' }, { motivo: 'incidente', escolaId: b.escolaId }]) {
        const foraDoCatalogo = await suspender(a, 'corretor_de_redacao', corpo)
        const doCatalogo = await suspender(a, 'sinais_para_o_professor', corpo)
        expect(erro(foraDoCatalogo), JSON.stringify(corpo)).toEqual(ENTRADA_INVALIDA)
        expect(semRequisicao(doCatalogo), JSON.stringify(corpo)).toEqual(semRequisicao(foraDoCatalogo))
      }
      expect(await marcas()).toEqual(antes)
      expect(await funcaoDe(a, 'sinais_para_o_professor')).toMatchObject({ suspensa: false, suspensao: null })
    })

    it('a correção suspensa não corrige ao encerrar; o Assistente da escola e a correção da outra escola seguem; retomar reabre', async () => {
      // Um lote que já esperava a professora antes da suspensão.
      const jaCorrigida = await listaRespondida(a)
      const loteQueJaEsperava = await encerrarAtividade(rotas, a.professora, jaCorrigida)
      expect(loteQueJaEsperava).not.toBeNull()
      const naoCorrigida = await listaRespondida(a)
      const deB = await listaRespondida(b)
      const antes = { entregas: await contarNaEscola(bancada, 'entrega', a.escolaId), correcoes: await contarNaEscola(bancada, 'correcao', a.escolaId), artefatos: await contarNaEscola(bancada, 'artefato', a.escolaId) }

      expect((await suspender(a, 'correcao_de_objetiva', { motivo: 'erro_recorrente' })).status).toBe(200)
      try {
        // Suspender não apaga nada do que a função já produziu.
        expect({ entregas: await contarNaEscola(bancada, 'entrega', a.escolaId), correcoes: await contarNaEscola(bancada, 'correcao', a.escolaId), artefatos: await contarNaEscola(bancada, 'artefato', a.escolaId) }).toEqual(antes)
        // A função suspensa não corrige: a atividade encerra e o lote não nasce.
        expect(await encerrarAtividade(rotas, a.professora, naoCorrigida)).toBeNull()
        expect(await contarNaEscola(bancada, 'entrega', a.escolaId)).toBe(antes.entregas)
        // As outras funções da escola seguem.
        expect((await post(a.professora, '/v1/assistente/mensagens', mensagemAoAssistente(a))).status).toBe(202)
        // A mesma função em outra escola segue.
        expect(await encerrarAtividade(rotas, b.professora, deB)).not.toBeNull()
        expect(await funcaoDe(b, 'correcao_de_objetiva')).toMatchObject({ suspensa: false, suspensao: null })
        // O que estava esperando a professora continua podendo ser decidido: quem decide é a pessoa.
        expect((await aprovarOLote(rotas, a.professora, jaCorrigida)).status).toBe(200)
      } finally {
        expect((await retomar(a, 'correcao_de_objetiva')).status).toBe(200)
      }
      // Retomada, encerrar de novo corrige.
      expect(await encerrarAtividade(rotas, a.professora, naoCorrigida)).not.toBeNull()
    })

    it('o Assistente suspenso recusa mensagem nova; o Tutor da escola e o Assistente da outra escola seguem; retomar reabre', async () => {
      const aberta = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma)
      const duvida = () => ({ texto: 'não entendi a questão', atividadeAplicadaId: aberta, questao: 3, chaveEnvio: randomUUID() })
      const execucoes = () => contarNaEscola(bancada, 'execucao_agente', a.escolaId, `funcao = 'conversa_e_ferramentas'`)
      await suspender(a, 'conversa_e_ferramentas')
      try {
        const antes = await execucoes()
        expect(erro(await post(a.professora, '/v1/assistente/mensagens', mensagemAoAssistente(a)))).toEqual(FUNCAO_SUSPENSA)
        expect(erro(await post(a.professora, '/v1/ferramentas/atividade_objetiva/gerar', { turmaId: a.turma, disciplinaId: a.quimica, tema: 'estequiometria', chaveEnvio: randomUUID() }))).toEqual(FUNCAO_SUSPENSA)
        // Recusada antes de gravar a execução.
        expect(await execucoes()).toBe(antes)
        expect((await post(a.aluno, '/v1/tutor/mensagens', duvida())).status).toBe(202)
        expect((await post(b.professora, '/v1/assistente/mensagens', mensagemAoAssistente(b))).status).toBe(202)
      } finally {
        await retomar(a, 'conversa_e_ferramentas')
      }
      expect((await post(a.professora, '/v1/assistente/mensagens', mensagemAoAssistente(a))).status).toBe(202)
      await fila.ociosa()
      await rotas.encerrar(a.professora, aberta)
    })

    it('o Tutor suspenso recusa a dúvida do aluno; o Assistente da escola e o Tutor da outra escola seguem; retomar reabre', async () => {
      const abertaEmA = await aplicarAtividade(rotas, a.professora, await criarAtividade(bancada, a), a.turma)
      const abertaEmB = await aplicarAtividade(rotas, b.professora, await criarAtividade(bancada, b), b.turma)
      const duvida = (atividadeAplicadaId: string) => ({ texto: 'não entendi a questão', atividadeAplicadaId, questao: 3, chaveEnvio: randomUUID() })
      await suspender(a, 'tutor_com_o_aluno')
      try {
        const antes = await contarNaEscola(bancada, 'mensagem_tutor', a.escolaId)
        expect(erro(await post(a.aluno, '/v1/tutor/mensagens', duvida(abertaEmA)))).toEqual(FUNCAO_SUSPENSA)
        expect(await contarNaEscola(bancada, 'mensagem_tutor', a.escolaId)).toBe(antes)
        expect((await post(a.professora, '/v1/assistente/mensagens', mensagemAoAssistente(a))).status).toBe(202)
        expect((await post(b.aluno, '/v1/tutor/mensagens', duvida(abertaEmB))).status).toBe(202)
      } finally {
        await retomar(a, 'tutor_com_o_aluno')
      }
      expect((await post(a.aluno, '/v1/tutor/mensagens', duvida(abertaEmA))).status).toBe(202)
      await fila.ociosa()
      await rotas.encerrar(a.professora, abertaEmA)
      await rotas.encerrar(b.professora, abertaEmB)
    })
  })

  describe('o consumo', () => {
    /** O orçamento de A e de B nos testes de porcentagem: o valor por aluno fica em R$ 5 e R$ 1, e o resto o teste decide. */
    const VALOR_DE_A = 5_000_000
    const VALOR_DE_B = 1_000_000
    /** Tudo o que estes casos gravam leva este modelo, e o `afterEach` apaga: a soma do mês de A e de B volta ao que o resto do arquivo deixou. */
    const MODELO_DO_CASO = 'orcamento-6-0'
    const MES_FECHADO = '2020-03'

    const alunosAtivosDe = async (escolaId: string): Promise<number> => {
      const [linha] = await sql<{ total: number }>(
        `select count(distinct v.usuario_id)::int as total from vinculo v
           join usuario pessoa on pessoa.escola_id = v.escola_id and pessoa.id = v.usuario_id
           join ano_letivo ano on ano.escola_id = v.escola_id and ano.id = v.ano_letivo_id and ano.situacao = 'em_curso'
          where v.escola_id = $1 and v.papel = 'aluno' and v.encerrado_em is null and pessoa.desativado_em is null`,
        [escolaId],
      )
      return linha?.total ?? 0
    }
    const definirOrcamento = async (escolaId: string, valorPorAlunoMicros: number | null, tetoPercentual: number | null = null): Promise<void> => {
      await sql('insert into configuracao_operacional_escola (escola_id) values ($1) on conflict do nothing', [escolaId])
      await sql('update configuracao_operacional_escola set ia_valor_por_aluno_micros = $2, ia_teto_de_seguranca_percentual = $3 where escola_id = $1', [escolaId, valorPorAlunoMicros, tetoPercentual])
    }
    /** Uma linha de consumo com o custo e os tokens dados, no instante `em` (agora, se omitido); leva o modelo do caso. */
    const gastar = (escolaId: string, custoMicros: number, { funcao = 'conversa_e_ferramentas', tokens = 0, em }: { funcao?: ChaveDeFuncao; tokens?: number; em?: string } = {}) =>
      sql(
        `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, custo_micros, em)
         values ($1, 'gerar_atividade_objetiva', $2, 'padrao', 'falso', $3, 'v1', $4, 0, 1, false, 1, 'concluida', $5, coalesce($6::timestamptz, now()))`,
        [escolaId, funcao, MODELO_DO_CASO, tokens, custoMicros, em ?? null],
      )
    /** O que o mês corrente de A já tem de custo, de outros casos do arquivo: o caso o desconta para chegar ao número exato. */
    const custoDoMesCorrente = async (escolaId: string): Promise<number> => {
      const [linha] = await sql<{ total: string }>(
        `select coalesce(sum(custo_micros), 0)::text as total from consumo_ia where escola_id = $1 and em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'`,
        [escolaId],
      )
      return Number(linha?.total ?? 0)
    }
    /** Põe o custo do mês de `escola` em exatamente `alvoMicros`. */
    const custoDoMesEm = async (escolaId: string, alvoMicros: number): Promise<void> => {
      const faltam = alvoMicros - (await custoDoMesCorrente(escolaId))
      expect(faltam, 'o mês já passou do alvo').toBeGreaterThanOrEqual(0)
      await gastar(escolaId, faltam)
    }
    const consumoDe = async (escola: EscolaComAssistente, consulta = '') => {
      const resposta = await get(escola.coordenacao, `/v1/governanca/consumo${consulta}`)
      expect(resposta.status).toBe(200)
      return { lido: consumoResponseSchema.parse(resposta.corpo), corpo: resposta.corpo, texto: JSON.stringify(resposta.corpo) }
    }

    afterEach(async () => {
      await sql('delete from consumo_ia where modelo = $1', [MODELO_DO_CASO])
      await sql('delete from orcamento_ia_do_mes where escola_id = any($1::uuid[]) and mes = $2', [[a.escolaId, b.escolaId], `${MES_FECHADO}-01`])
      await definirOrcamento(a.escolaId, null)
      await definirOrcamento(b.escolaId, null)
    })

    it('soma por função, no mês, sem origem, sem aluno, sem entrada e sem saída; a parte é a fatia dos tokens, e não soma o de outra escola', async () => {
      await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagemAoAssistente(a)))
      await fila.ociosa()
      const resposta = await get(a.coordenacao, '/v1/governanca/consumo')
      expect(resposta.status).toBe(200)
      const consumo = consumoResponseSchema.parse(resposta.corpo)
      const noBanco = await sql<{ funcao: ChaveDeFuncao; execucoes: number; tokens: number }>(
        `select funcao, (count(distinct execucao_id) + count(*) filter (where execucao_id is null))::int as execucoes, sum(tokens_de_entrada + tokens_de_saida)::int as tokens from consumo_ia where escola_id = $1 group by funcao`,
        [a.escolaId],
      )
      expect(noBanco.length).toBeGreaterThan(0)
      const tokensDoMes = noBanco.reduce((soma, linha) => soma + linha.tokens, 0)
      expect(tokensDoMes).toBeGreaterThan(0)
      expect([...consumo.porFuncao].sort((x, y) => x.funcao.localeCompare(y.funcao))).toEqual(
        [...noBanco].sort((x, y) => x.funcao.localeCompare(y.funcao)).map((linha) => ({ funcao: linha.funcao, parte: parteDosTokens(linha.tokens, tokensDoMes), execucoes: linha.execucoes })),
      )
      // Só a parte e as execuções de cada função: nenhum token, nenhum custo, e o total que o contrato antigo trazia saiu.
      for (const linha of consumo.porFuncao) expect(Object.keys(linha).sort()).toEqual(['execucoes', 'funcao', 'parte'])
      expect(Object.keys(consumo).sort()).toEqual(['mes', 'orcamento', 'porFuncao', 'tutor'])

      const texto = JSON.stringify(resposta.corpo)
      for (const proibido of ['origem', 'regra_fixa', 'falso', 'alunoId', 'usuarioId', '"entrada"', '"saida"', 'modelo', 'perfil', 'tokens', 'custo', 'Micros', a.aluno.usuarioId, a.professora.usuarioId]) expect(texto).not.toContain(proibido)

      // A escola B gastou menos, e o que A gastou não aparece lá.
      const deB = consumoResponseSchema.parse((await get(b.coordenacao, '/v1/governanca/consumo')).corpo)
      const [totalDeB] = await sql<{ execucoes: number }>('select (count(distinct execucao_id) + count(*) filter (where execucao_id is null))::int as execucoes from consumo_ia where escola_id = $1', [b.escolaId])
      expect(deB.porFuncao.reduce((soma, linha) => soma + linha.execucoes, 0)).toBe(totalDeB?.execucoes)
      expect(deB.porFuncao.reduce((soma, linha) => soma + linha.execucoes, 0)).not.toBe(consumo.porFuncao.reduce((soma, linha) => soma + linha.execucoes, 0))
    })

    it('a parte soma 100 (a menos do arredondamento de cada função); com zero token no mês, a parte é 0 em todas, sem divisão por zero', async () => {
      // Dois meses fechados e vazios de outros casos: a soma do mês é só destas linhas.
      await gastar(a.escolaId, 0, { funcao: 'conversa_e_ferramentas', tokens: 1500, em: '2020-06-10T12:00:00Z' })
      await gastar(a.escolaId, 0, { funcao: 'tutor_com_o_aluno', tokens: 500, em: '2020-06-11T12:00:00Z' })
      const { lido } = await consumoDe(a, '?mes=2020-06')
      expect(lido.porFuncao).toEqual([
        { funcao: 'conversa_e_ferramentas', parte: 75, execucoes: 1 },
        { funcao: 'tutor_com_o_aluno', parte: 25, execucoes: 1 },
      ])
      expect(lido.porFuncao.reduce((soma, linha) => soma + linha.parte, 0)).toBe(100)

      // Zero token: as duas funções gastaram (execuções e custo), nenhuma gastou token.
      await gastar(a.escolaId, 1_000, { funcao: 'conversa_e_ferramentas', tokens: 0, em: '2020-07-10T12:00:00Z' })
      await gastar(a.escolaId, 1_000, { funcao: 'adaptacao', tokens: 0, em: '2020-07-11T12:00:00Z' })
      expect((await consumoDe(a, '?mes=2020-07')).lido.porFuncao).toEqual([
        { funcao: 'conversa_e_ferramentas', parte: 0, execucoes: 1 },
        { funcao: 'adaptacao', parte: 0, execucoes: 1 },
      ])
    })

    it('a chamada com provedor entra na soma como qualquer outra, e o provedor não sai pela governança', async () => {
      const provedor = `provedor-${randomUUID().slice(0, 8)}`
      const chamada = (externo: boolean, provedorDaLinha: string | null) =>
        sql(
          `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, provedor, tentativas, estado, em)
           values ($1, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', $4, '2020-08', 1000, 500, 20, $2, $3, 1, 'concluida', '2020-08-10T12:00:00Z')`,
          [a.escolaId, externo, provedorDaLinha, MODELO_DO_CASO],
        )
      await chamada(true, provedor)
      await chamada(false, null)
      const { lido, texto } = await consumoDe(a, '?mes=2020-08')
      expect(lido.porFuncao).toEqual([{ funcao: 'conversa_e_ferramentas', parte: 100, execucoes: 2 }])
      expect(texto).not.toContain(provedor)
      expect(texto).not.toContain('provedor')
    })

    it('a execução com duas linhas de consumo (a repetição da saída inválida) conta uma execução, e os tokens de entrada e de saída das duas linhas pesam na parte', async () => {
      // Uma execução de verdade de A (a chave estrangeira exige): as duas linhas de baixo são dela, e caem num mês fechado.
      await execucaoTerminada(api, a.professora, await dispararExecucao(api, a.professora, '/v1/assistente/mensagens', mensagemAoAssistente(a)))
      await fila.ociosa()
      const [execucao] = await sql<{ execucao_id: string }>(
        `select execucao_id from consumo_ia where escola_id = $1 and execucao_id is not null and funcao = 'conversa_e_ferramentas' order by em desc limit 1`,
        [a.escolaId],
      )
      if (execucao === undefined) throw new Error('a execução do Assistente não gravou consumo')
      const linhaDaExecucao = (entrada: number, saida: number) =>
        sql(
          `insert into consumo_ia (escola_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, em)
           values ($1, $2, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'falso', $3, 'v1', $4, $5, 1, false, 1, 'concluida', '2020-10-10T12:00:00Z')`,
          [a.escolaId, execucao.execucao_id, MODELO_DO_CASO, entrada, saida],
        )
      // O Assistente: uma execução, duas linhas, 500 de entrada e 500 de saída (1000 no total). O Tutor: uma linha de 3000 de entrada.
      await linhaDaExecucao(500, 0)
      await linhaDaExecucao(0, 500)
      await gastar(a.escolaId, 0, { funcao: 'tutor_com_o_aluno', tokens: 3000, em: '2020-10-11T12:00:00Z' })
      const { lido } = await consumoDe(a, '?mes=2020-10')
      // 1000 de 4000 = 25 e 3000 de 4000 = 75. Sem a saída no denominador, o Assistente daria 29 e o Tutor 86; sem a segunda linha, o Assistente daria 14.
      expect([...lido.porFuncao].sort((x, y) => x.funcao.localeCompare(y.funcao))).toEqual([
        { funcao: 'conversa_e_ferramentas', parte: 25, execucoes: 1 },
        { funcao: 'tutor_com_o_aluno', parte: 75, execucoes: 1 },
      ])
    })

    it('a linha sem execução (o que a regra fixa do Tutor grava) conta uma execução por linha, e não some da conta', async () => {
      for (let i = 0; i < 2; i += 1) await gastar(a.escolaId, 0, { funcao: 'tutor_com_o_aluno', tokens: 10, em: '2020-09-10T12:00:00Z' })
      expect((await consumoDe(a, '?mes=2020-09')).lido.porFuncao).toEqual([{ funcao: 'tutor_com_o_aluno', parte: 100, execucoes: 2 }])
    })

    it('o mês sem consumo e sem retrato responde sem função e `sem_retrato`, e o pacote do Tutor soma os alunos das turmas', async () => {
      const passado = (await consumoDe(a, '?mes=2020-01')).lido
      expect(passado).toMatchObject({ mes: '2020-01', orcamento: { situacao: 'sem_retrato', porcentagem: null, aviso: null }, porFuncao: [], tutor: { trocasNoMes: 0 } })
      const atual = (await consumoDe(a)).lido
      const alunos = await contarNaEscola(bancada, 'vinculo', a.escolaId, `papel = 'aluno' and estado = 'confirmado'`)
      expect(alunos).toBeGreaterThan(0)
      expect(atual.tutor.pacoteDoMes).toBe(TROCAS_POR_MES_PADRAO_DO_TUTOR * alunos)
      const trocas = await contarNaEscola(bancada, 'mensagem_tutor', a.escolaId, `autor = 'aluno'`)
      expect(trocas).toBeGreaterThan(0)
      expect(atual.tutor.trocasNoMes).toBe(trocas)
      expect(erro(await get(a.coordenacao, '/v1/governanca/consumo?mes=2026-13'))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await get(a.coordenacao, `/v1/governanca/consumo?alunoId=${a.aluno.usuarioId}`))).toEqual(ENTRADA_INVALIDA)
      expect(erro(await get(a.coordenacao, '/v1/governanca/consumo?origem=regra_fixa'))).toEqual(ENTRADA_INVALIDA)
    })

    it('o aviso: a 79% é nulo, a 80% exatos é 80, a 99% segue 80 e a 100% é 100; a porcentagem é a do custo sobre valor por aluno vezes alunos ativos', async () => {
      const alunos = await alunosAtivosDe(a.escolaId)
      expect(alunos).toBeGreaterThan(0)
      await definirOrcamento(a.escolaId, VALOR_DE_A)
      const orcamento = VALOR_DE_A * alunos
      const casos: Array<{ custo: number; porcentagem: number; aviso: 80 | 100 | null }> = [
        { custo: Math.floor((orcamento * 80) / 100) - 1, porcentagem: 79, aviso: null },
        { custo: Math.floor((orcamento * 80) / 100), porcentagem: 80, aviso: 80 },
        { custo: orcamento - 1, porcentagem: 99, aviso: 80 },
        { custo: orcamento, porcentagem: 100, aviso: 100 },
        { custo: Math.floor((orcamento * 120) / 100), porcentagem: 120, aviso: 100 },
      ]
      for (const caso of casos) {
        await sql('delete from consumo_ia where modelo = $1', [MODELO_DO_CASO])
        await custoDoMesEm(a.escolaId, caso.custo)
        expect((await consumoDe(a)).lido.orcamento, `custo ${String(caso.custo)}`).toEqual({ situacao: 'definido', porcentagem: caso.porcentagem, aviso: caso.aviso })
      }
    })

    it('o mês fechado a 120% não traz aviso, e a porcentagem é a do retrato dele, não a de hoje', async () => {
      // O retrato de março de 2020: 100 alunos a R$ 5 (orçamento R$ 500) e R$ 600 gastos. Hoje a escola tem outro valor e outros alunos: não conta.
      await definirOrcamento(a.escolaId, 9_000_000)
      // A escola B tem retrato no mesmo mês, com outro valor e outros alunos (10 a R$ 1, orçamento R$ 10): é o que a leitura de A não pode alcançar.
      await sql(`insert into orcamento_ia_do_mes (escola_id, mes, alunos_ativos, valor_por_aluno_micros, teto_percentual, origem_do_valor) values ($1, $2, 10, 1000000, 100, 'escola')`, [b.escolaId, `${MES_FECHADO}-01`])
      await sql(`insert into orcamento_ia_do_mes (escola_id, mes, alunos_ativos, valor_por_aluno_micros, teto_percentual, origem_do_valor) values ($1, $2, 100, 5000000, 200, 'escola')`, [a.escolaId, `${MES_FECHADO}-01`])
      await gastar(a.escolaId, 600_000_000, { em: `${MES_FECHADO}-15T12:00:00Z` })
      await gastar(b.escolaId, 5_000_000, { em: `${MES_FECHADO}-15T12:00:00Z` })
      expect((await consumoDe(a, `?mes=${MES_FECHADO}`)).lido.orcamento).toEqual({ situacao: 'definido', porcentagem: 120, aviso: null })
      expect((await consumoDe(b, `?mes=${MES_FECHADO}`)).lido.orcamento).toEqual({ situacao: 'definido', porcentagem: 50, aviso: null })
      // O mês corrente da mesma escola, com o mesmo gasto, avisa: o aviso é do mês de agora.
      const alunos = await alunosAtivosDe(a.escolaId)
      await custoDoMesEm(a.escolaId, Math.floor((9_000_000 * alunos * 120) / 100))
      expect((await consumoDe(a)).lido.orcamento).toMatchObject({ situacao: 'definido', aviso: 100 })
    })

    it('a leitura da coordenação não grava o retrato: o `GET` do mês corrente e o de um mês fechado deixam `orcamento_ia_do_mes` como estava', async () => {
      await definirOrcamento(a.escolaId, VALOR_DE_A, 200)
      await gastar(a.escolaId, 1_000_000)
      const retratos = () => sql('select * from orcamento_ia_do_mes where escola_id = any($1::uuid[]) order by escola_id, mes', [[a.escolaId, b.escolaId]])
      const antes = await retratos()
      expect((await consumoDe(a)).lido.orcamento.situacao).toBe('definido')
      await consumoDe(a, '?mes=2020-01')
      await consumoDe(b)
      expect(await retratos()).toEqual(antes)
    })

    it('sem valor, `sem_orcamento`; sem ano em curso e com valor, `sem_aluno_ativo`: nos dois, sem porcentagem e sem aviso, mesmo com custo', async () => {
      await gastar(a.escolaId, 123_456_789)
      expect((await consumoDe(a)).lido.orcamento).toEqual({ situacao: 'sem_orcamento', porcentagem: null, aviso: null })
      // Uma escola montada sem ano letivo: nenhum aluno ativo.
      const vazia = await bancada.escolaComSessao('coordenador')
      const consulta = async () => consumoResponseSchema.parse((await get(vazia, '/v1/governanca/consumo')).corpo)
      expect((await consulta()).orcamento).toEqual({ situacao: 'sem_orcamento', porcentagem: null, aviso: null })
      await definirOrcamento(vazia.escolaId, VALOR_DE_A)
      await gastar(vazia.escolaId, 123_456_789)
      expect((await consulta()).orcamento).toEqual({ situacao: 'sem_aluno_ativo', porcentagem: null, aviso: null })
    })

    it('a coordenação de A lê 20% e a de B lê 111%, cada uma com os alunos e o custo da própria escola', async () => {
      const alunosDeA = await alunosAtivosDe(a.escolaId)
      const alunosDeB = await alunosAtivosDe(b.escolaId)
      expect([alunosDeA, alunosDeB].every((alunos) => alunos > 0)).toBe(true)
      await definirOrcamento(a.escolaId, VALOR_DE_A, 200)
      await definirOrcamento(b.escolaId, VALOR_DE_B, 100)
      await custoDoMesEm(a.escolaId, (VALOR_DE_A * alunosDeA * 20) / 100)
      await custoDoMesEm(b.escolaId, (VALOR_DE_B * alunosDeB * 111) / 100)
      expect((await consumoDe(a)).lido.orcamento).toEqual({ situacao: 'definido', porcentagem: 20, aviso: null })
      expect((await consumoDe(b)).lido.orcamento).toEqual({ situacao: 'definido', porcentagem: 111, aviso: 100 })
    })
  })

  describe('a auditoria do orçamento é da Operação', () => {
    it('as alterações de orçamento de A estão na auditoria, e nenhuma resposta da governança da coordenação de A as devolve', async () => {
      const antes = { valorPorAlunoMicros: 3_000_000, tetoDeSegurancaPercentual: 150 }
      const depois = { valorPorAlunoMicros: 4_000_000, tetoDeSegurancaPercentual: 150 }
      const requisicao = randomUUID()
      await sql(
        `insert into auditoria (escola_id, autor_operador, acao, entidade, entidade_id, antes, depois, requisicao_id)
         values ($1, 'operador-do-teste', 'escola.orcamento_ia_alterado', 'escola', $1, $2::jsonb, $3::jsonb, $4)`,
        [a.escolaId, JSON.stringify(antes), JSON.stringify(depois), requisicao],
      )
      try {
        expect(await sql('select 1 from auditoria where escola_id = $1 and acao = $2', [a.escolaId, 'escola.orcamento_ia_alterado'])).not.toHaveLength(0)
        const respostas = [(await get(a.coordenacao, '/v1/governanca/resumo')).corpo, (await get(a.coordenacao, '/v1/governanca/funcoes')).corpo, (await get(a.coordenacao, '/v1/governanca/consumo')).corpo]
        for (const corpo of respostas) {
          const texto = JSON.stringify(corpo)
          for (const vazado of ['orcamento_ia_alterado', 'operador-do-teste', 'valorPorAlunoMicros', 'tetoDeSegurancaPercentual', '3000000', '4000000', requisicao]) expect(texto).not.toContain(vazado)
        }
      } finally {
        await sql('delete from auditoria where requisicao_id = $1', [requisicao])
      }
    })
  })

  describe('isolamento', () => {
    it('professor e aluno não alcançam nenhuma rota da governança: a resposta é a do inexistente, e nada muda', async () => {
      for (const sessao of [a.professora, a.aluno]) {
        expect(erro(await get(sessao, '/v1/governanca/resumo'))).toEqual(NAO_ENCONTRADO)
        expect(erro(await get(sessao, '/v1/governanca/funcoes'))).toEqual(NAO_ENCONTRADO)
        expect(erro(await get(sessao, '/v1/governanca/consumo'))).toEqual(NAO_ENCONTRADO)
        expect(erro(await post(sessao, '/v1/governanca/funcoes/adaptacao/suspender'))).toEqual(NAO_ENCONTRADO)
        expect(erro(await post(sessao, '/v1/governanca/funcoes/adaptacao/retomar'))).toEqual(NAO_ENCONTRADO)
      }
      expect(await suspensoes(a, 'adaptacao')).toEqual([])
    })

    it('a suspensão é da escola de quem suspende: a coordenação de B não vê nem retoma a suspensão de A', async () => {
      await suspender(a, 'adaptacao')
      try {
        expect(await funcaoDe(a, 'adaptacao')).toMatchObject({ suspensa: true })
        expect(await funcaoDe(b, 'adaptacao')).toMatchObject({ suspensa: false, suspensao: null })
        expect(erro(await retomar(b, 'adaptacao'))).toEqual(NAO_ENCONTRADO)
        expect(await funcaoDe(a, 'adaptacao')).toMatchObject({ suspensa: true })
        expect(await suspensoes(b, 'adaptacao')).toHaveLength(1) // a que o teste dos dois cliques criou e retomou
        expect((await suspensoes(b, 'adaptacao')).every((linha) => linha.retomada_em !== null)).toBe(true)
      } finally {
        await retomar(a, 'adaptacao')
      }
    })
  })
})
