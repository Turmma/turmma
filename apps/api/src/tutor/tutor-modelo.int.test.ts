import { MENSAGEM_DE_ASSUNTO_DELICADO, MENSAGEM_DE_RISCO_A_VIDA, type ExecutorNoProcesso } from '@educa/nucleo'
import { ErrorCode, conversaDoTutorResponseSchema } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste } from '../../test/api-com-sessao.js'
import { dispararExecucao, execucaoTerminada, montarEscolaComAssistente, NOME_DA_PROFESSORA_DE_TESTE, zerarLimiteDePedidosDeIa, type EscolaComAssistente, type ExecucaoLida } from '../../test/escola-com-assistente.js'
import {
  ALTERNATIVA_CERTA_DA_QUESTAO_3,
  ambienteDoModeloDeMentira,
  aplicarAtividade,
  citacaoDoPrimeiroTrecho,
  encerrarAtividade,
  HABILIDADE_LIMITANTE,
  HABILIDADE_PROPORCAO,
  lancarLote,
  MARCA_NA_EXPLICACAO,
  subirModeloDeMentira,
  type ModeloDeMentira,
} from '../../test/escola-com-tutor.js'
import { GatilhoDeParada } from '../../test/gatilho-de-parada.js'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../test/sessao-de-teste.js'
import { EXECUTOR_DE_AGENTE } from '../ia/ia.module.js'

const NOME_DO_ALUNO = 'Aluno Sintético Otávio Quintanilha'

/**
 * O Tutor **pela rota, contra um modelo de mentira** (regra 30, item 11; regra 40): a API é montada com o adaptador
 * OpenAI-compatível apontado para um servidor desta máquina, que responde o que o teste mandar e guarda o que recebeu.
 * Aqui se prova o que não depende do modelo se comportar: a recusa que ele tenta furar, a falha que não vira erro cru
 * nem troca contada, e o que de fato sai do sistema para o provedor.
 */
describe('Tutor contra um modelo que não obedece', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let modelo: ModeloDeMentira
  let api: ApiDeTeste
  let executor: ExecutorNoProcesso
  let a: EscolaComAssistente
  let atividade: string

  const sql = <Linha extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Linha>(texto, valores)
  const turno = async (sessao: SessaoDeTeste, texto: string, onde: Record<string, unknown> = {}): Promise<ExecucaoLida & { execucaoId: string }> => {
    const execucaoId = await dispararExecucao(api, sessao, '/v1/tutor/mensagens', { texto, ...onde })
    return { execucaoId, ...(await execucaoTerminada(api, sessao, execucaoId)) }
  }
  const naQuestao = (questao: number) => ({ atividadeAplicadaId: atividade, questao })
  const resposta = (execucao: ExecucaoLida): { tipo: string; texto: string } => execucao.resultado?.mensagem as never
  const usoDeHoje = async (sessao: SessaoDeTeste) => conversaDoTutorResponseSchema.parse((await chamar(api.url, 'GET', `/v1/tutor/conversa?atividadeAplicadaId=${atividade}`, await sessao.tokenNovo())).corpo).uso.hoje
  const sinaisDe = async (aluno: SessaoDeTeste) => (await sql<{ tipo: string; atividade_aplicada_id: string | null; questao: number | null }>('select tipo, atividade_aplicada_id, questao from sinal_tutor where escola_id = $1 and aluno_id = $2 order by id', [a.escolaId, aluno.usuarioId])).rows
  const respostasGravadas = async (aluno: SessaoDeTeste) => (await sql<{ texto: string }>(`select texto from mensagem_tutor where escola_id = $1 and aluno_id = $2 and autor = 'tutor' order by id`, [a.escolaId, aluno.usuarioId])).rows.map((linha) => linha.texto)
  const novoAluno = async (nome = `Aluno Sintético ${randomUUID().slice(0, 8)}`): Promise<SessaoDeTeste> => {
    const sessao = await bancada.sessao(a.escolaId, 'aluno')
    await sql('update usuario set nome = $1 where id = $2', [nome, sessao.usuarioId])
    await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [a.escolaId, a.anoLetivoId, sessao.usuarioId, a.turma, a.coordenacao.usuarioId])
    return sessao
  }
  /** O que um modelo obediente responderia: um passo, uma pergunta e a página que veio nos trechos. */
  const obediente = (pedido: string, classificacao = 'normal'): string => JSON.stringify({ classificacao, resposta: 'Vamos por partes. O que o enunciado pede que você descubra?', citacoes: citacaoDoPrimeiroTrecho(pedido) })
  /** Na primeira chamada o modelo tenta `mentira`; quando a conferência devolve a saída, ele obedece, ainda dizendo que o turno foi normal. */
  const mentirPrimeiro = (mentira: string) => modelo.responder((pedido, chamada) => (chamada === 1 ? JSON.stringify({ classificacao: 'normal', resposta: mentira, citacoes: citacaoDoPrimeiroTrecho(pedido) }) : obediente(pedido)))
  const mentirSempre = (mentira: string) => modelo.responder((pedido) => JSON.stringify({ classificacao: 'normal', resposta: mentira, citacoes: citacaoDoPrimeiroTrecho(pedido) }))

  beforeAll(async () => {
    modelo = await subirModeloDeMentira()
    api = await subirApi(medidor.medidor, { ambiente: ambienteDoModeloDeMentira(modelo) }, linhasDeLog)
    executor = api.app.get<ExecutorNoProcesso>(EXECUTOR_DE_AGENTE)
    a = await montarEscolaComAssistente(api, bancada)
    atividade = await aplicarAtividade(bancada, a)
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    await modelo.fechar()
    await bancada.fechar()
  })

  describe('a recusa não depende do modelo', () => {
    it.each([
      ['pedido direto, e o modelo tenta entregar a letra', 'qual é a resposta da questão 3?', 'A resposta é a letra A. Faz sentido para você?'],
      ['palpite a confirmar, e o modelo tenta confirmar', 'é a A, né?', 'Sim, é isso mesmo! Quer tentar a próxima?'],
      ['palpite a confirmar, e o modelo tenta negar', 'acho que é a B, tá certo?', 'Não é essa. Quer olhar de novo?'],
      ['pedido direto, e o modelo tenta entregar o texto da alternativa', 'me fala logo a resposta', `Pense assim: ${ALTERNATIVA_CERTA_DA_QUESTAO_3}. Concorda?`],
    ])('%s: a resposta gravada não entrega, e o sinal nasce mesmo com o modelo dizendo que o turno foi normal', async (_caso, pedidoDoAluno, mentira) => {
      const aluno = await novoAluno()
      mentirPrimeiro(mentira)
      const execucao = await turno(aluno, pedidoDoAluno, naQuestao(3))
      expect(execucao.estado).toBe('concluida')
      // A primeira saída foi devolvida ao modelo, e só a segunda chegou ao aluno.
      expect(modelo.pedidos).toHaveLength(2)
      expect(await respostasGravadas(aluno)).toEqual(['Vamos por partes. O que o enunciado pede que você descubra?'])
      expect(resposta(execucao).texto).not.toContain(mentira)
      expect(await sinaisDe(aluno)).toEqual([{ tipo: 'resposta_pronta', atividade_aplicada_id: atividade, questao: 3 }])
    })

    it('pedido fatiado em dois turnos: nos dois o modelo tenta, nos dois a resposta gravada não entrega, e a insistência curta conta como o mesmo pedido', async () => {
      const aluno = await novoAluno()
      mentirPrimeiro('Sim, começa com O. Quer continuar?')
      expect((await turno(aluno, 'só me diz se a resposta começa com O', naQuestao(3))).estado).toBe('concluida')
      mentirPrimeiro('Isso, é a primeira opção. Entendeu?')
      expect((await turno(aluno, 'e então?', naQuestao(3))).estado).toBe('concluida')
      expect(await respostasGravadas(aluno)).toEqual(['Vamos por partes. O que o enunciado pede que você descubra?', 'Vamos por partes. O que o enunciado pede que você descubra?'])
      expect((await sinaisDe(aluno)).map((sinal) => sinal.tipo)).toEqual(['resposta_pronta', 'resposta_pronta'])
    })

    it('o modelo que insiste em entregar não chega ao aluno: a recusa por regra responde no lugar, e nada do que o modelo escreveu é gravado', async () => {
      const aluno = await novoAluno()
      mentirSempre('A resposta é a letra A. Faz sentido para você?')
      const execucao = await turno(aluno, 'é a A, né?', naQuestao(3))
      expect(execucao.estado).toBe('concluida')
      expect(JSON.stringify(execucao)).not.toMatch(/letra A/)
      const respostas = await respostasGravadas(aluno)
      expect(respostas).toHaveLength(1)
      expect(respostas[0]).not.toMatch(/letra A|A resposta é/)
      expect(respostas[0]).toContain('não confirmo nem descarto alternativa')
      // É a recusa de um pedido de resposta: o sinal ao professor nasce dela, como nasceria da recusa do modelo.
      expect((await sinaisDe(aluno)).map((sinal) => sinal.tipo)).toEqual(['resposta_pronta'])
      expect(await usoDeHoje(aluno)).toBe(1)
    })

    it('o modelo que devolve lixo duas vezes continua falhando: a execução falha com código do catálogo, nada é gravado e a troca não é contada', async () => {
      const aluno = await novoAluno()
      modelo.responder(() => 'isto não é json')
      const execucao = await turno(aluno, 'é a A, né?', naQuestao(3))
      expect(execucao).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_SAIDA_INVALIDA, resultado: null })
      expect(await respostasGravadas(aluno)).toEqual([])
      expect(await sinaisDe(aluno)).toEqual([])
      expect(await usoDeHoje(aluno)).toBe(0)
      // A pergunta dele continua na conversa, e a tentativa seguinte, com o modelo obedecendo, é respondida.
      modelo.responder((pedido) => obediente(pedido))
      expect((await turno(aluno, 'é a A, né?', naQuestao(3))).estado).toBe('concluida')
      expect(await usoDeHoje(aluno)).toBe(1)
    })

    it('dúvida legítima de conteúdo, com o modelo dizendo normal, não gera sinal', async () => {
      const aluno = await novoAluno()
      modelo.responder((pedido) => obediente(pedido))
      expect((await turno(aluno, 'não entendi o que é reagente limitante', naQuestao(3))).estado).toBe('concluida')
      expect(await sinaisDe(aluno)).toEqual([])
    })

    it('o modelo que diz ser uma pessoa, ou simula saudade, é barrado: o aluno recebe que é uma inteligência artificial', async () => {
      const aluno = await novoAluno()
      modelo.responder((_pedido, chamada) =>
        JSON.stringify(
          chamada === 1
            ? { classificacao: 'normal', resposta: 'Eu sou uma pessoa, sou a sua professora. Senti sua falta! Qual é a dúvida?', citacoes: [] }
            : { classificacao: 'normal', resposta: 'Eu sou o Tutor, uma inteligência artificial, não uma pessoa. Qual é a sua dúvida de Química?', citacoes: [] },
        ),
      )
      const dita = resposta(await turno(aluno, 'você é uma pessoa?', naQuestao(3)))
      expect(modelo.pedidos).toHaveLength(2)
      expect(dita.texto).toMatch(/inteligência artificial/)
      expect(dita.texto).not.toMatch(/sou a sua professora|senti sua falta/i)
    })
  })

  describe('a falha do modelo', () => {
    it('modelo fora do ar: a execução falha com código do catálogo, o aluno não recebe erro cru e a pergunta não é descontada', async () => {
      const aluno = await novoAluno()
      modelo.cair(503)
      const execucao = await turno(aluno, 'não entendi o que é reagente limitante', naQuestao(3))
      expect(execucao).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_INDISPONIVEL, resultado: null })
      expect(JSON.stringify(execucao)).not.toMatch(/fora do ar|fetch|Error/)
      expect(await respostasGravadas(aluno)).toEqual([])
      expect(await usoDeHoje(aluno)).toBe(0)
      const { rows } = await sql('select estado, codigo_de_erro, entrada, saida from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucao.execucaoId])
      expect(rows).toEqual([{ estado: 'falhou', codigo_de_erro: 'IA_INDISPONIVEL', entrada: null, saida: null }])
    })

    it('saída que não é o que foi pedido (texto solto, campo a mais): falha tipada, e nada chega ao aluno', async () => {
      const aluno = await novoAluno()
      modelo.responder(() => 'Claro! A resposta é a letra A.')
      expect(await turno(aluno, 'não entendi o que é reagente limitante', naQuestao(3))).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_SAIDA_INVALIDA })
      modelo.responder((pedido) => JSON.stringify({ ...(JSON.parse(obediente(pedido)) as object), observacaoSobreOAluno: 'parece desatento e ansioso' }))
      expect(await turno(aluno, 'não entendi o que é reagente limitante', naQuestao(3))).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_SAIDA_INVALIDA })
      expect(await respostasGravadas(aluno)).toEqual([])
      expect(await usoDeHoje(aluno)).toBe(0)
    })

    it('citação de página que não foi entregue ao modelo é saída inválida: com a questão aberta, a regra responde no lugar, sem a página inventada', async () => {
      const aluno = await novoAluno()
      modelo.responder(() => JSON.stringify({ classificacao: 'normal', resposta: 'Releia a página 99. O que ela diz?', citacoes: [{ materialId: a.materialId, pagina: 99, trecho: 'Página 99' }] }))
      expect((await turno(aluno, 'não entendi o que é reagente limitante', naQuestao(3))).estado).toBe('concluida')
      const respostas = await respostasGravadas(aluno)
      expect(respostas).toHaveLength(1)
      expect(respostas[0]).not.toContain('página 99')
      // Dúvida legítima: o "vamos por partes" de sempre, e nenhum sinal de resposta pronta.
      expect(respostas[0]).toContain('Vamos por partes')
      expect(await sinaisDe(aluno)).toEqual([])
    })
  })

  describe('o que sai do sistema para o modelo', () => {
    it('a questão vai sem gabarito e sem explicação, a memória só com lote aprovado, e nenhum nome de pessoa', async () => {
      const aluno = await novoAluno(NOME_DO_ALUNO)
      const aprovada = await aplicarAtividade(bancada, a, { titulo: 'Lista aprovada' })
      const pendente = await aplicarAtividade(bancada, a, { titulo: 'Lista pendente' })
      const rejeitada = await aplicarAtividade(bancada, a, { titulo: 'Lista rejeitada' })
      const alunoId = aluno.usuarioId
      await lancarLote(bancada, a, aprovada, 'aprovada', { alunoId, acertos: 1, total: 3, porHabilidade: [{ codigo: HABILIDADE_LIMITANTE.codigo, acertos: 1, total: 3 }] })
      await lancarLote(bancada, a, pendente, 'pendente', { alunoId, acertos: 0, total: 3, porHabilidade: [{ codigo: HABILIDADE_PROPORCAO.codigo, acertos: 0, total: 3 }] })
      await lancarLote(bancada, a, rejeitada, 'rejeitada', { alunoId, acertos: 0, total: 3, porHabilidade: [{ codigo: HABILIDADE_PROPORCAO.codigo, acertos: 0, total: 3 }] })

      modelo.responder((pedido) => obediente(pedido))
      expect((await turno(aluno, 'não entendi o que é reagente limitante', naQuestao(3))).estado).toBe('concluida')
      expect(modelo.pedidos).toHaveLength(1)
      const pedido = modelo.pedidos[0] ?? ''

      // A questão em andamento foi, com o enunciado e as alternativas.
      expect(pedido).toContain('questao_em_que_o_aluno_esta')
      expect(pedido).toContain('o que é o reagente limitante?')
      expect(pedido).toContain(ALTERNATIVA_CERTA_DA_QUESTAO_3)
      // O gabarito e a explicação, não: o Tutor não tem como entregar o que não recebeu.
      expect(pedido).not.toMatch(/gabarito\\?"\s*:/)
      expect(pedido).not.toContain('explicacao')
      expect(pedido).not.toContain(MARCA_NA_EXPLICACAO)

      // A memória: a habilidade do lote aprovado, com os números dele; a do pendente e a do rejeitado, não.
      expect(pedido).toContain('memoria_do_trabalho_do_aluno_por_habilidade')
      expect(pedido).toMatch(new RegExp(`${HABILIDADE_LIMITANTE.codigo.replace(/\./g, '\\.')}.{0,200}acertos\\\\?":1,\\\\?"erros\\\\?":2`))
      expect(pedido).not.toContain(HABILIDADE_PROPORCAO.codigo)
      expect(pedido).not.toContain(HABILIDADE_PROPORCAO.descricao)

      // Nenhum nome, nenhum id de pessoa (regra 20, item 12).
      for (const proibido of [NOME_DO_ALUNO, 'Otávio', NOME_DA_PROFESSORA_DE_TESTE, aluno.usuarioId, a.professora.usuarioId, a.escolaId, a.turma]) expect(pedido, proibido).not.toContain(proibido)
      // E o que foi ao modelo não foi a log.
      expect(linhasDeLog.some((linha) => linha.includes('reagente limitante') || linha.includes(NOME_DO_ALUNO))).toBe(false)
    })

    it('o turno de assunto delicado nunca vai ao modelo, nem no turno seguinte: o filtro é o tipo gravado, não o texto', async () => {
      const aluno = await novoAluno()
      const marca = `araponga${randomUUID().slice(0, 8)}`
      modelo.responder((pedido) => obediente(pedido))
      await turno(aluno, 'como eu começo a questão 3?', naQuestao(3))
      const delicado = await turno(aluno, `eu apanho em casa ${marca}`, naQuestao(3))
      expect(resposta(delicado)).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO })
      // O turno delicado não chamou o modelo: só o primeiro turno chegou a ele.
      expect(modelo.pedidos).toHaveLength(1)

      // Troca-se, no banco, o texto dos dois lados do turno por um que nenhum gatilho reconhece: só o `tipo` ainda diz o que ele foi.
      await sql(`update mensagem_tutor set texto = $3 where escola_id = $1 and execucao_id = $2 and autor = 'aluno'`, [a.escolaId, delicado.execucaoId, `pergunta trocada ${marca}`])
      await sql(`update mensagem_tutor set texto = $3 where escola_id = $1 and execucao_id = $2 and autor = 'tutor'`, [a.escolaId, delicado.execucaoId, `mensagem fixa de outra versão ${marca}`])

      modelo.responder((pedido) => obediente(pedido))
      expect((await turno(aluno, 'e o que o enunciado quer dizer com limitante?', naQuestao(3))).estado).toBe('concluida')
      const pedido = modelo.pedidos[0] ?? ''
      // O turno comum de antes foi como turno anterior; o delicado, não.
      expect(pedido).toContain('como eu começo a questão 3?')
      expect(pedido).not.toContain(marca)
      expect(pedido).not.toContain('apanho')
    })

    it('com avaliação aberta, o assunto delicado ainda recebe a mensagem fixa e o sinal sem referência, sem ir ao modelo; a pergunta comum continua travada', async () => {
      const aluno = await bancada.sessao(a.escolaId, 'aluno')
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [a.escolaId, a.anoLetivoId, aluno.usuarioId, a.outraTurma, a.coordenacao.usuarioId])
      const prova = await aplicarAtividade(bancada, a, { avaliativa: true, turmaId: a.outraTurma, titulo: 'Prova sintética de estequiometria', aplicadaPor: a.colega.usuarioId })
      const marca = `bemtevi${randomUUID().slice(0, 8)}`
      const naProva = { atividadeAplicadaId: prova, questao: 3 }
      const enviar = async (corpo: Record<string, unknown>) => chamar(api.url, 'POST', '/v1/tutor/mensagens', await aluno.tokenNovo(), { chaveEnvio: randomUUID(), ...corpo })
      const travado = { status: 409, corpo: { erro: { codigo: 'TUTOR_PAUSADO_EM_AVALIACAO' } } }
      modelo.responder((pedido) => obediente(pedido))
      try {
        // A pergunta comum, na prova e fora dela, continua recusada, sem gravar nada.
        for (const corpo of [{ texto: 'não entendi a questão 3', ...naProva }, { texto: 'o que é mol?' }]) expect(await enviar(corpo)).toMatchObject(travado)
        expect(await respostasGravadas(aluno)).toEqual([])

        // O assunto delicado passa: 202, a mensagem fixa e o aviso aos professores da turma.
        const execucao = await turno(aluno, `eu apanho em casa ${marca}`, naProva)
        expect(execucao).toMatchObject({ estado: 'concluida', resultado: { tipo: 'mensagem_do_tutor', mensagem: { tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO } } })
        expect(resposta(await turno(aluno, 'eu quero morrer', naProva))).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_RISCO_A_VIDA })
        const { rows: sinais } = await sql('select tipo, atividade_aplicada_id, questao, material_id, pagina from sinal_tutor where escola_id = $1 and aluno_id = $2 order by id', [a.escolaId, aluno.usuarioId])
        const semReferencia = { tipo: 'atencao_humana', atividade_aplicada_id: null, questao: null, material_id: null, pagina: null }
        expect(sinais).toEqual([semReferencia, semReferencia])
        // Nada foi ao modelo: nem o texto dele, nem a questão da prova.
        expect(modelo.pedidos).toEqual([])
        // E o texto dele não saiu da conversa.
        for (const tabela of ['sinal_tutor', 'execucao_agente', 'consumo_ia', 'auditoria']) {
          const { rows } = await sql<{ total: string }>(`select count(*) as total from ${tabela} t where t.escola_id = $1 and row_to_json(t)::text ilike $2`, [a.escolaId, `%${marca}%`])
          expect(Number(rows[0]?.total), tabela).toBe(0)
        }
        expect(linhasDeLog.some((linha) => linha.includes(marca))).toBe(false)
        // A mensagem fixa não destrava o Tutor: a tela continua em avaliação, e a dúvida da prova continua recusada.
        const conversa = conversaDoTutorResponseSchema.parse((await chamar(api.url, 'GET', `/v1/tutor/conversa?atividadeAplicadaId=${prova}`, await aluno.tokenNovo())).corpo)
        expect(conversa).toMatchObject({ estado: 'avaliacao', avaliacaoAberta: { titulo: 'Prova sintética de estequiometria' } })
        expect(conversa.mensagens.map((mensagem) => mensagem.tipo)).toEqual(['texto', 'assunto_delicado', 'texto', 'assunto_delicado'])
        expect(await enviar({ texto: 'e a questão 3, qual é a resposta?', ...naProva })).toMatchObject(travado)
        // O aviso é da turma em prova: a professora dela o recebe, e a de outra turma, não.
        const avisos = async (sessao: SessaoDeTeste) => chamar(api.url, 'GET', `/v1/sinais?turmaId=${a.outraTurma}`, await sessao.tokenNovo())
        const daColega = (await avisos(a.colega)).corpo['itens'] as { tipo: string; aluno: { id: string } }[]
        expect(daColega.filter((sinal) => sinal.aluno.id === aluno.usuarioId).map((sinal) => sinal.tipo)).toEqual(['atencao_humana', 'atencao_humana'])
        expect((await avisos(a.professora)).status).toBe(404)
      } finally {
        await sql(`update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where escola_id = $1 and id = $2`, [a.escolaId, prova])
      }
    })

    it('a frase de risco à vida que só a regra reconhece, de um jeito de dizer ou de outro, recebe a mensagem de risco e o sinal sem referência, sem ir ao modelo, com a avaliação aberta', async () => {
      const aluno = await bancada.sessao(a.escolaId, 'aluno')
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [a.escolaId, a.anoLetivoId, aluno.usuarioId, a.outraTurma, a.coordenacao.usuarioId])
      const prova = await aplicarAtividade(bancada, a, { avaliativa: true, turmaId: a.outraTurma, titulo: 'Prova sintética de equilíbrio químico', aplicadaPor: a.colega.usuarioId })
      const marca = `sabia${randomUUID().slice(0, 8)}`
      const naProva = { atividadeAplicadaId: prova, questao: 3 }
      modelo.responder((pedido) => obediente(pedido))
      try {
        // "quero matar ela" era o padrão sem teste; "queria desaparecer do mundo" é um jeito de dizer que a regra não conhecia.
        for (const frase of ['quero matar ela', 'queria desaparecer do mundo']) {
          const execucao = await turno(aluno, `${frase} ${marca}`, naProva)
          expect(execucao).toMatchObject({ estado: 'concluida', resultado: { tipo: 'mensagem_do_tutor', mensagem: { tipo: 'assunto_delicado', texto: MENSAGEM_DE_RISCO_A_VIDA } } })
        }
        const semReferencia = { tipo: 'atencao_humana', atividade_aplicada_id: null, questao: null, material_id: null, pagina: null }
        const { rows: sinais } = await sql('select tipo, atividade_aplicada_id, questao, material_id, pagina from sinal_tutor where escola_id = $1 and aluno_id = $2 order by id', [a.escolaId, aluno.usuarioId])
        expect(sinais).toEqual([semReferencia, semReferencia])
        // Nada foi ao modelo, e o texto do aluno não saiu da conversa.
        expect(modelo.pedidos).toEqual([])
        for (const tabela of ['sinal_tutor', 'execucao_agente', 'consumo_ia', 'auditoria']) {
          const { rows } = await sql<{ total: string }>(`select count(*) as total from ${tabela} t where t.escola_id = $1 and row_to_json(t)::text ilike $2`, [a.escolaId, `%${marca}%`])
          expect(Number(rows[0]?.total), tabela).toBe(0)
        }
        expect(linhasDeLog.some((linha) => linha.includes(marca))).toBe(false)
        // A pergunta comum, na mesma prova, continua travada: a mensagem fixa não abriu a porta.
        const comum = await chamar(api.url, 'POST', '/v1/tutor/mensagens', await aluno.tokenNovo(), { chaveEnvio: randomUUID(), texto: 'não entendi a questão 3', ...naProva })
        expect(comum).toMatchObject({ status: 409, corpo: { erro: { codigo: 'TUTOR_PAUSADO_EM_AVALIACAO' } } })
      } finally {
        await sql(`update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where escola_id = $1 and id = $2`, [a.escolaId, prova])
      }
    })

    it('quando é o modelo que classifica o turno como assunto delicado, o aluno recebe a mensagem fixa, e o professor, o sinal sem referência', async () => {
      const aluno = await novoAluno()
      // Nenhum gatilho da regra reconhece esta frase: quem a classifica é o modelo, e o texto que ele escreveu é descartado.
      modelo.responder(() => JSON.stringify({ classificacao: 'assunto_delicado', resposta: 'Sinto muito, vamos conversar sobre isso. O que aconteceu?', citacoes: [] }))
      const execucao = await turno(aluno, 'lá em casa as coisas estão bem complicadas', naQuestao(3))
      expect(resposta(execucao)).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO })
      expect(await respostasGravadas(aluno)).toEqual([MENSAGEM_DE_ASSUNTO_DELICADO])
      const { rows: sinais } = await sql('select tipo, atividade_aplicada_id, questao, material_id, pagina from sinal_tutor where escola_id = $1 and aluno_id = $2', [a.escolaId, aluno.usuarioId])
      expect(sinais).toEqual([{ tipo: 'atencao_humana', atividade_aplicada_id: null, questao: null, material_id: null, pagina: null }])
      // A pergunta perde a questão: o turno delicado não é referência a trabalho.
      const { rows: perguntas } = await sql(`select questao, material_id, pagina from mensagem_tutor where escola_id = $1 and execucao_id = $2 and autor = 'aluno'`, [a.escolaId, execucao.execucaoId])
      expect(perguntas).toEqual([{ questao: null, material_id: null, pagina: null }])
    })

    it('quando é o modelo que classifica o turno como risco à vida, o aluno recebe a mensagem fixa com o 188, e o professor, o sinal sem referência', async () => {
      const aluno = await novoAluno()
      // Nenhum gatilho da regra reconhece esta frase, nem a de assunto delicado: quem a classifica é o modelo, e o texto que ele escreveu é descartado.
      const frase = 'ontem de noite eu fiquei olhando o frasco de remédio da minha mãe e pensando no que aconteceria'
      // Só a primeira chamada diz `risco_a_vida`: no turno seguinte o modelo obedece, e o pedido que chega a ele é o que se confere.
      modelo.responder((pedido, chamada) => (chamada === 1 ? JSON.stringify({ classificacao: 'risco_a_vida', resposta: 'Sinto muito. Respire fundo e converse com alguém de confiança, vai ficar tudo bem.', citacoes: [] }) : obediente(pedido)))
      const execucao = await turno(aluno, frase, naQuestao(3))
      expect(execucao.estado).toBe('concluida')
      // O modelo foi chamado uma vez, e a classificação dele não sai da tarefa: o aluno recebe `assunto_delicado`, nunca `risco_a_vida`.
      expect(modelo.pedidos).toHaveLength(1)
      expect(resposta(execucao)).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_RISCO_A_VIDA })
      expect(JSON.stringify(execucao)).not.toContain('risco_a_vida')
      expect(MENSAGEM_DE_RISCO_A_VIDA).toContain('188')
      expect(await respostasGravadas(aluno)).toEqual([MENSAGEM_DE_RISCO_A_VIDA])
      const { rows: sinais } = await sql('select tipo, atividade_aplicada_id, questao, material_id, pagina from sinal_tutor where escola_id = $1 and aluno_id = $2', [a.escolaId, aluno.usuarioId])
      expect(sinais).toEqual([{ tipo: 'atencao_humana', atividade_aplicada_id: null, questao: null, material_id: null, pagina: null }])
      // A pergunta perde a questão: o turno delicado não é referência a trabalho.
      const { rows: perguntas } = await sql(`select questao, material_id, pagina from mensagem_tutor where escola_id = $1 and execucao_id = $2 and autor = 'aluno'`, [a.escolaId, execucao.execucaoId])
      expect(perguntas).toEqual([{ questao: null, material_id: null, pagina: null }])
      // No turno seguinte do mesmo aluno, o que ele escreveu sobre risco à vida e a mensagem que recebeu não voltam ao modelo (regra 20, item 12).
      const seguinte = await turno(aluno, 'não entendi a questão 3', naQuestao(3))
      expect(seguinte.estado).toBe('concluida')
      expect(modelo.pedidos).toHaveLength(2)
      expect(modelo.pedidos[1]).toContain('não entendi a questão 3')
      expect(modelo.pedidos[1]).not.toContain('frasco')
      expect(modelo.pedidos[1]).not.toContain('Obrigado por me contar')
    })
  })

  describe('a avaliação abre depois do 202 (S12; regra 30, item 10)', () => {
    const pausada = { estado: 'falhou', erro: ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO, resultado: null }
    const execucaoLida = async (execucaoId: string) =>
      (await sql<{ estado: string; erro: string | null; resultado: unknown }>('select estado, erro, resultado from execucao_agente where escola_id = $1 and id = $2', [a.escolaId, execucaoId])).rows
    const consumoDaExecucao = async (execucaoId: string) =>
      (await sql<{ estado: string; entrada: unknown; saida: unknown }>('select estado, entrada, saida from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])).rows
    /**
     * Envia a pergunta e segura a execução no `gatilho` (antes de rodar, ou depois de o modelo responder, quando o consumo é
     * gravado); com ela parada, abre uma avaliação na turma, solta e espera o fim. Encerra a avaliação ao sair.
     */
    const abrindoDuranteOTurno = async (aluno: SessaoDeTeste, momento: { tabela: 'execucao_agente' | 'consumo_ia'; evento: 'update' | 'insert'; quando: string }, corpo: Record<string, unknown>): Promise<string> => {
      const parada = new GatilhoDeParada(bancada.pool, momento)
      await parada.armar()
      let prova: string | undefined
      try {
        const aceita = await chamar(api.url, 'POST', '/v1/tutor/mensagens', await aluno.tokenNovo(), { chaveEnvio: randomUUID(), ...corpo })
        expect(aceita.status).toBe(202)
        await parada.esperarParadas()
        prova = await aplicarAtividade(bancada, a, { avaliativa: true, titulo: 'Prova que abriu no meio' })
        await parada.soltar()
        await executor.ociosa()
        return aceita.corpo['execucaoId'] as string
      } finally {
        await parada.desarmar()
        if (prova !== undefined) await encerrarAtividade(bancada, a, prova)
      }
    }

    it('abre entre o 202 e a execução: o modelo nem chega a ser chamado', async () => {
      await executor.ociosa()
      const aluno = await novoAluno()
      modelo.responder((pedido) => obediente(pedido))
      const execucaoId = await abrindoDuranteOTurno(aluno, { tabela: 'execucao_agente', evento: 'update', quando: `new.solicitada_por = '${aluno.usuarioId}'::uuid and new.estado = 'rodando'` }, { texto: 'não entendi o que é reagente limitante', ...naQuestao(3) })
      expect(await execucaoLida(execucaoId)).toEqual([pausada])
      expect(modelo.pedidos).toEqual([])
      expect(await consumoDaExecucao(execucaoId)).toEqual([])
      expect(await respostasGravadas(aluno)).toEqual([])
      expect(await usoDeHoje(aluno)).toBe(0)
    })

    it('abre entre a execução e a conclusão: o modelo respondeu e a resposta é descartada, sem mensagem, sem sinal (nem resposta pronta) e sem troca; o consumo da chamada fica', async () => {
      await executor.ociosa()
      const aluno = await novoAluno()
      const marca = `tucano${randomUUID().slice(0, 8)}`
      const texto = `qual é a resposta da questão 3? ${marca}`
      modelo.responder((pedido) => obediente(pedido, 'pediu_resposta_pronta'))
      const execucaoId = await abrindoDuranteOTurno(aluno, { tabela: 'consumo_ia', evento: 'insert', quando: `new.aluno_id = '${aluno.usuarioId}'::uuid and new.estado = 'concluida'` }, { texto, ...naQuestao(3) })
      expect(await execucaoLida(execucaoId)).toEqual([pausada])
      // O modelo foi chamado, e a chamada está medida: o custo existiu. A entrada e a saída não são guardadas.
      expect(modelo.pedidos).toHaveLength(1)
      expect(await consumoDaExecucao(execucaoId)).toEqual([{ estado: 'concluida', entrada: null, saida: null }])
      expect(await respostasGravadas(aluno)).toEqual([])
      expect(await sinaisDe(aluno)).toEqual([])
      expect(await usoDeHoje(aluno)).toBe(0)
      // A pergunta continua no registro, só como a do aluno, e o texto dela não saiu de `mensagem_tutor`: nem pelo log do executor.
      const { rows: conversa } = await sql('select autor, texto from mensagem_tutor where escola_id = $1 and aluno_id = $2 order by id', [a.escolaId, aluno.usuarioId])
      expect(conversa).toEqual([{ autor: 'aluno', texto }])
      for (const tabela of ['sinal_tutor', 'execucao_agente', 'consumo_ia', 'auditoria']) {
        const { rows } = await sql<{ total: string }>(`select count(*) as total from ${tabela} t where t.escola_id = $1 and row_to_json(t)::text ilike $2`, [a.escolaId, `%${marca}%`])
        expect(Number(rows[0]?.total), tabela).toBe(0)
      }
      expect(linhasDeLog.some((linha) => linha.includes(marca))).toBe(false)
    })

    it('abre antes da conclusão e o modelo classificou assunto delicado: a mensagem fixa e o sinal sem referência ficam, e a troca conta', async () => {
      await executor.ociosa()
      const aluno = await novoAluno()
      modelo.responder(() => JSON.stringify({ classificacao: 'assunto_delicado', resposta: 'Sinto muito, vamos conversar sobre isso. O que aconteceu?', citacoes: [] }))
      const execucaoId = await abrindoDuranteOTurno(aluno, { tabela: 'consumo_ia', evento: 'insert', quando: `new.aluno_id = '${aluno.usuarioId}'::uuid and new.estado = 'concluida'` }, { texto: 'lá em casa as coisas estão bem complicadas', ...naQuestao(3) })
      const [lida] = await execucaoLida(execucaoId)
      expect(lida).toMatchObject({ estado: 'concluida', erro: null, resultado: { tipo: 'mensagem_do_tutor' } })
      expect(await respostasGravadas(aluno)).toEqual([MENSAGEM_DE_ASSUNTO_DELICADO])
      expect(await sinaisDe(aluno)).toEqual([{ tipo: 'atencao_humana', atividade_aplicada_id: null, questao: null }])
      expect(await usoDeHoje(aluno)).toBe(1)
    })

    it('abre antes da conclusão e o modelo classificou risco à vida: a mensagem de risco, com o 188, e o sinal sem referência ficam, e a troca conta', async () => {
      await executor.ociosa()
      const aluno = await novoAluno()
      modelo.responder(() => JSON.stringify({ classificacao: 'risco_a_vida', resposta: 'Sinto muito. Respire fundo e converse com alguém de confiança, vai ficar tudo bem.', citacoes: [] }))
      const execucaoId = await abrindoDuranteOTurno(aluno, { tabela: 'consumo_ia', evento: 'insert', quando: `new.aluno_id = '${aluno.usuarioId}'::uuid and new.estado = 'concluida'` }, { texto: 'ontem de noite eu fiquei olhando o frasco de remédio da minha mãe e pensando no que aconteceria', ...naQuestao(3) })
      const [lida] = await execucaoLida(execucaoId)
      expect(lida).toMatchObject({ estado: 'concluida', erro: null, resultado: { tipo: 'mensagem_do_tutor' } })
      expect(JSON.stringify(lida)).not.toContain('risco_a_vida')
      expect(await respostasGravadas(aluno)).toEqual([MENSAGEM_DE_RISCO_A_VIDA])
      expect(await sinaisDe(aluno)).toEqual([{ tipo: 'atencao_humana', atividade_aplicada_id: null, questao: null }])
      expect(await usoDeHoje(aluno)).toBe(1)
    })
  })
})
