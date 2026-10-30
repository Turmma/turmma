import { MENSAGEM_DE_ASSUNTO_DELICADO, MENSAGEM_DE_RISCO_A_VIDA, type ExecutorNoProcesso } from '@educa/nucleo'
import {
  conversaDoTutorResponseSchema,
  memoriaDoTutorResponseSchema,
  sinaisResponseSchema,
  usoDoTutorResponseSchema,
  TAMANHO_MAXIMO_DA_PERGUNTA_AO_TUTOR,
  TROCAS_POR_DIA_PADRAO_DO_TUTOR,
  type ChaveDeFuncao,
} from '@educa/shared'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from '../../test/api-com-sessao.js'
import {
  comoPessoa,
  dispararExecucao,
  enviarMaterialDeDemonstracao,
  execucaoTerminada,
  montarAnoAnterior,
  montarEscolaComAssistente,
  NOME_DO_ALUNO_DE_TESTE,
  zerarLimiteDePedidosDeIa,
  type AnoAnterior,
  type EscolaComAssistente,
  type ExecucaoLida,
} from '../../test/escola-com-assistente.js'
import {
  ALTERNATIVA_CERTA_DA_QUESTAO_3,
  aplicarAtividade,
  configurarLimitesDoTutor,
  encerrarAtividade,
  HABILIDADE_LIMITANTE,
  HABILIDADE_MASSA_MOLAR,
  HABILIDADE_PROPORCAO,
  lancarLote,
  trocasJaFeitas,
} from '../../test/escola-com-tutor.js'
import * as pelaRota from '../../test/atividade-de-teste.js'
import { GatilhoDeParada } from '../../test/gatilho-de-parada.js'
import { variacaoDoPdf } from '../../test/material-de-teste.js'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../test/sessao-de-teste.js'
import { TETO_DE_PEDIDOS_DE_IA_POR_USUARIO } from '../assistente/limite-de-pedidos-de-ia.js'
import { EXECUTOR_DE_AGENTE } from '../ia/ia.module.js'
import { CLIENTE_REDIS_CACHE } from '../limite.module.js'
import { BuscaDeTrechos } from '../material/busca-de-trechos.js'
import { CLIENTE_REDIS_LOGIN } from '../credencial/index.js'
import { TROCAS_SEGUIDAS_PARA_TRAVOU } from './sinais-do-turno.js'
import { SupervisaoDoTutorRepository } from './supervisao.repository.js'
import { TutorDoAlunoRepository } from './tutor.repository.js'

interface LinhaDeSinal {
  readonly tipo: string
  readonly atividade_aplicada_id: string | null
  readonly questao: number | null
  readonly material_id: string | null
  readonly pagina: number | null
}

/**
 * O Tutor e os sinais na API (MVP, A4), com a API montada pelo `AppModule`, o Postgres do compose de teste, o material
 * de demonstração e o **adaptador falso** de IA (determinístico). O que precisa de um modelo que erra de propósito, e
 * do pedido que chega a ele, está em `tutor-modelo.int.test.ts`.
 *
 * Em cada caso de isolamento, o outro aluno, a outra turma, a outra disciplina ou a outra escola têm a linha que a
 * consulta alcançaria se a cláusula de escopo saísse do repository (regra 10, item 5).
 */
describe('Tutor e sinais', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let executor: ExecutorNoProcesso
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  /** A lista de Química aplicada ao 2ºB da escola A, não avaliativa, e a mesma na escola B. */
  let atividade: string
  let atividadeDeB: string
  /** As rotas da atividade (aplicar, responder, encerrar, aprovar), para o lote que nasce e é aprovado como na tela. */
  let rotas: pelaRota.RotasDaAtividade

  const sql = <Linha extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Linha>(texto, valores)
  const get = async (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, await sessao.tokenNovo())
  const enviar = async (sessao: SessaoDeTeste, corpo: Record<string, unknown>): Promise<RespostaHttp> => chamar(api.url, 'POST', '/v1/tutor/mensagens', await sessao.tokenNovo(), { chaveEnvio: randomUUID(), ...corpo })
  const turno = async (sessao: SessaoDeTeste, texto: string, onde: Record<string, unknown> = {}): Promise<ExecucaoLida & { execucaoId: string }> => {
    const execucaoId = await dispararExecucao(api, sessao, '/v1/tutor/mensagens', { texto, ...onde })
    return { execucaoId, ...(await execucaoTerminada(api, sessao, execucaoId)) }
  }
  const naQuestao = (questao: number, atividadeAplicadaId: string = atividade) => ({ atividadeAplicadaId, questao })
  const resposta = (execucao: ExecucaoLida): { tipo: string; texto: string; citacoes?: { materialId: string; pagina: number }[] } => execucao.resultado?.mensagem as never
  const conversaDe = async (sessao: SessaoDeTeste, consulta = '') => conversaDoTutorResponseSchema.parse((await get(sessao, `/v1/tutor/conversa${consulta}`)).corpo)
  const memoriaDe = async (sessao: SessaoDeTeste) => memoriaDoTutorResponseSchema.parse((await get(sessao, '/v1/tutor/memoria')).corpo)
  const sinaisPara = async (sessao: SessaoDeTeste, turmaId: string, consulta = '') => sinaisResponseSchema.parse((await get(sessao, `/v1/sinais?turmaId=${turmaId}${consulta}`)).corpo)
  const usoPara = async (sessao: SessaoDeTeste, turmaId: string) => usoDoTutorResponseSchema.parse((await get(sessao, `/v1/tutor/uso?turmaId=${turmaId}`)).corpo)
  const sinaisDe = async (aluno: SessaoDeTeste): Promise<LinhaDeSinal[]> =>
    (await sql<LinhaDeSinal & Record<string, unknown>>('select tipo, atividade_aplicada_id, questao, material_id, pagina from sinal_tutor where escola_id = $1 and aluno_id = $2 order by id', [aluno.escolaId, aluno.usuarioId])).rows
  const mensagensDe = async (aluno: SessaoDeTeste) =>
    (await sql<{ autor: string; tipo: string; texto: string; questao: number | null; material_id: string | null; pagina: number | null; atividade_aplicada_id: string | null }>(
      'select autor, tipo, texto, questao, material_id, pagina, atividade_aplicada_id from mensagem_tutor where escola_id = $1 and aluno_id = $2 order by id',
      [aluno.escolaId, aluno.usuarioId],
    )).rows
  const suspender = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) => sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
  const retomar = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) =>
    sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $3 where escola_id = $1 and funcao = $2 and retomada_em is null', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
  /** Um aluno novo com vínculo confirmado na turma: cada grupo de testes usa o seu, para o freio e os sinais de um não contarem no outro. */
  const novoAluno = async (escola: EscolaComAssistente, turmaId: string = escola.turma, nome = `Aluno Sintético ${randomUUID().slice(0, 8)}`): Promise<SessaoDeTeste> => {
    const sessao = await bancada.sessao(escola.escolaId, 'aluno')
    await sql('update usuario set nome = $1 where id = $2', [nome, sessao.usuarioId])
    await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [
      escola.escolaId,
      escola.anoLetivoId,
      sessao.usuarioId,
      turmaId,
      escola.coordenacao.usuarioId,
    ])
    return sessao
  }
  /** O aluno sai da turma do 2ºB e vai para o 2ºC, no mesmo ano: o vínculo antigo é encerrado (`realocacao`). */
  const transferir = async (escola: EscolaComAssistente, aluno: SessaoDeTeste) => {
    await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3`, [escola.escolaId, aluno.usuarioId, escola.turma])
    await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [escola.escolaId, escola.anoLetivoId, aluno.usuarioId, escola.outraTurma, escola.coordenacao.usuarioId])
  }
  /** Os valores de uma chave do Redis, como texto, pelo tipo dela. */
  const valoresNoRedis = async (redis: Redis, chave: string): Promise<(string | null)[]> => {
    const tipo = await redis.type(chave)
    if (tipo === 'string') return [await redis.get(chave)]
    if (tipo === 'hash') return Object.entries(await redis.hgetall(chave)).flat()
    if (tipo === 'list') return redis.lrange(chave, 0, -1)
    if (tipo === 'set') return redis.smembers(chave)
    if (tipo === 'zset') return redis.zrange(chave, '0', '-1')
    if (tipo === 'stream') return (await redis.xrange(chave, '-', '+')).flatMap(([, campos]) => campos)
    return []
  }
  /** Se a palavra marcada está em alguma chave ou valor do Redis: o de fila (sessão, limites, leitura do lote) e o de cache. */
  const estaNoRedis = async (redis: Redis, marca: string): Promise<boolean> => {
    const tem = (textos: readonly (string | null)[]) => textos.some((texto) => texto?.toLowerCase().includes(marca.toLowerCase()) === true)
    let cursor = '0'
    do {
      const [proximo, chaves] = await redis.scan(cursor, 'COUNT', 1000)
      cursor = proximo
      for (const chave of chaves) if (tem([chave]) || tem(await valoresNoRedis(redis, chave))) return true
    } while (cursor !== '0')
    return false
  }
  /** Onde a palavra marcada aparece fora de `mensagem_tutor`: sinal, execução, consumo, auditoria, log e Redis. */
  const ondeVazou = async (escolaId: string, marca: string): Promise<string[]> => {
    const achados: string[] = []
    for (const tabela of ['sinal_tutor', 'execucao_agente', 'consumo_ia', 'auditoria']) {
      const { rows } = await sql<{ total: string }>(`select count(*) as total from ${tabela} t where t.escola_id = $1 and row_to_json(t)::text ilike $2`, [escolaId, `%${marca}%`])
      if (Number(rows[0]?.total) > 0) achados.push(tabela)
    }
    if (linhasDeLog.some((linha) => linha.toLowerCase().includes(marca.toLowerCase()))) achados.push('log')
    for (const [nome, token] of [['redis de fila', CLIENTE_REDIS_LOGIN], ['redis de cache', CLIENTE_REDIS_CACHE]] as const) {
      if (await estaNoRedis(api.app.get<Redis>(token), marca)) achados.push(nome)
    }
    return achados
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
    executor = api.app.get<ExecutorNoProcesso>(EXECUTOR_DE_AGENTE)
    rotas = pelaRota.rotasDaAtividade(api)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    atividade = await aplicarAtividade(bancada, a)
    atividadeDeB = await aplicarAtividade(bancada, b)
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    await bancada.fechar()
  })

  describe('o turno', () => {
    it('grava a pergunta com a execução, responde por pergunta com a página citada, e o texto do aluno fica só na conversa dele', async () => {
      const aluno = await novoAluno(a)
      const marca = `zimbro${randomUUID().slice(0, 8)}`
      const execucaoId = await dispararExecucao(api, aluno, '/v1/tutor/mensagens', { texto: `não entendi o que é reagente limitante ${marca}`, ...naQuestao(3), materialId: a.materialId, pagina: 4 })
      // A pergunta nasceu com a execução, na mesma transação, com a referência ao trabalho que o professor vê no uso.
      const { rows } = await sql('select autor, turma_id, atividade_aplicada_id, questao, material_id, pagina from mensagem_tutor where escola_id = $1 and execucao_id = $2 and autor = $3', [a.escolaId, execucaoId, 'aluno'])
      expect(rows).toEqual([{ autor: 'aluno', turma_id: a.turma, atividade_aplicada_id: atividade, questao: 3, material_id: a.materialId, pagina: 4 }])

      const execucao = await execucaoTerminada(api, aluno, execucaoId)
      expect(execucao).toMatchObject({ estado: 'concluida', erro: null, resultado: { tipo: 'mensagem_do_tutor' } })
      const dita = resposta(execucao)
      expect(dita.tipo).toBe('texto')
      // Socrático: termina perguntando, cita a página do material da turma e não repete a alternativa certa.
      expect(dita.texto.trim().endsWith('?')).toBe(true)
      expect(dita.citacoes).toEqual([expect.objectContaining({ materialId: a.materialId, pagina: 4 })])
      expect(dita.texto).not.toContain(ALTERNATIVA_CERTA_DA_QUESTAO_3)

      const conversa = await conversaDe(aluno, `?atividadeAplicadaId=${atividade}`)
      expect(conversa.mensagens.map((mensagem) => [mensagem.autor, mensagem.tipo])).toEqual([
        ['aluno', 'texto'],
        ['tutor', 'texto'],
      ])
      expect(conversa.mensagens[0]?.texto).toContain(marca)
      expect(conversa).toMatchObject({ estado: 'ligado', uso: { hoje: 1, limiteDoDia: TROCAS_POR_DIA_PADRAO_DO_TUTOR }, avaliacaoAberta: null })
      // A conversa é por atividade: fora de atividade, este aluno ainda não tem nada.
      expect((await conversaDe(aluno)).mensagens).toEqual([])

      // O texto do aluno não foi copiado para sinal, execução, consumo, auditoria nem log (regra 20, itens 9 e 14).
      expect(await ondeVazou(a.escolaId, marca)).toEqual([])
      const { rows: consumo } = await sql('select aluno_id, entrada, saida, origem from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])
      expect(consumo).toEqual([{ aluno_id: aluno.usuarioId, entrada: null, saida: null, origem: 'falso' }])
      const { rows: execucoes } = await sql('select entrada, resultado from execucao_agente where escola_id = $1 and id = $2', [a.escolaId, execucaoId])
      expect(execucoes).toEqual([{ entrada: { tarefa: 'turno_do_tutor' }, resultado: { tipo: 'mensagem_do_tutor', mensagemId: expect.any(String) as string } }])
    })

    it('a mesma chave de envio devolve a mesma execução, com uma pergunta, uma resposta e uma troca contada', async () => {
      const aluno = await novoAluno(a)
      const corpo = { texto: 'como eu começo a questão 1?', ...naQuestao(1), chaveEnvio: randomUUID() }
      const primeira = await enviar(aluno, corpo)
      const segunda = await enviar(aluno, corpo)
      expect([primeira.status, segunda.status]).toEqual([202, 202])
      expect(segunda.corpo['execucaoId']).toBe(primeira.corpo['execucaoId'])
      await executor.ociosa()
      expect((await mensagensDe(aluno)).map((mensagem) => mensagem.autor)).toEqual(['aluno', 'tutor'])
      expect((await conversaDe(aluno, `?atividadeAplicadaId=${atividade}`)).uso.hoje).toBe(1)
    })

    it('recusa o corpo fora do contrato: escola, aluno ou turma mandados pelo cliente, questão sem atividade e página sem material', async () => {
      const aluno = await novoAluno(a)
      for (const corpo of [
        { texto: 'oi', escolaId: b.escolaId },
        { texto: 'oi', alunoId: a.aluno.usuarioId },
        { texto: 'oi', turmaId: a.outraTurma },
        { texto: 'oi', questao: 3 },
        { texto: 'oi', pagina: 4 },
        { texto: '   ' },
      ]) {
        expect(await enviar(aluno, corpo), JSON.stringify(corpo)).toMatchObject({ status: 400, corpo: { erro: { codigo: 'ENTRADA_INVALIDA' } } })
      }
      expect(await mensagensDe(aluno)).toEqual([])
    })

    it('a mensagem vazia, acima do tamanho, ou com um campo a mais, é ENTRADA_INVALIDA: a troca do dia não é gasta, nada é gravado, e o texto não vai ao log nem à resposta (17.0)', async () => {
      const aluno = await novoAluno(a)
      const sentinela = `sentinela-${randomUUID()}`
      const antes = (await conversaDe(aluno)).uso.hoje
      for (const corpo of [{ texto: '' }, { texto: `${sentinela} ${'a'.repeat(TAMANHO_MAXIMO_DA_PERGUNTA_AO_TUTOR)}` }, { texto: sentinela, alunoId: a.aluno.usuarioId }]) {
        const recusada = await enviar(aluno, corpo)
        expect(recusada).toMatchObject({ status: 400, corpo: { erro: { codigo: 'ENTRADA_INVALIDA' } } })
        expect(JSON.stringify(recusada.corpo)).not.toContain(sentinela)
      }
      expect((await conversaDe(aluno)).uso.hoje).toBe(antes)
      expect(await mensagensDe(aluno)).toEqual([])
      // A varredura só vale se o log registrou os erros: sem isso, a ausência da sentinela não prova nada.
      expect(linhasDeLog.filter((linha) => linha.includes('http.erro')).length).toBeGreaterThan(0)
      expect(linhasDeLog.some((linha) => linha.includes(sentinela))).toBe(false)
    })

    it('o envio tem limite por aluno, não por IP: quem passa do teto do minuto espera, e o colega no mesmo endereço continua', async () => {
      const aluno = await novoAluno(a)
      const colega = await novoAluno(a)
      for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_USUARIO; pedido += 1) expect((await enviar(aluno, { texto: 'o que é mol?', ...naQuestao(1) })).status).toBe(202)
      expect(await enviar(aluno, { texto: 'o que é mol?', ...naQuestao(1) })).toMatchObject({ status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO' } } })
      expect((await enviar(colega, { texto: 'o que é mol?', ...naQuestao(1) })).status).toBe(202)
      await executor.ociosa()
      expect((await mensagensDe(aluno)).filter((mensagem) => mensagem.autor === 'aluno')).toHaveLength(TETO_DE_PEDIDOS_DE_IA_POR_USUARIO)
    })

    it('quando o Tutor é perguntado, diz que é uma inteligência artificial, e não uma pessoa', async () => {
      const aluno = await novoAluno(a)
      const dita = resposta(await turno(aluno, 'você é uma pessoa?', naQuestao(3)))
      expect(dita.texto).toMatch(/inteligência artificial/)
      expect(dita.texto).toMatch(/não uma pessoa/)
      expect(await sinaisDe(aluno)).toEqual([])
    })
  })

  describe('a recusa da resposta pronta (regra 30, item 11)', () => {
    it('pedido direto, palpite a confirmar e pedido fatiado em dois turnos: a resposta gravada não entrega, e o sinal nasce na questão em andamento', async () => {
      const aluno = await novoAluno(a)
      const tentativas = ['qual é a resposta da questão 3?', 'é a A, né?', 'só me diz se a resposta começa com O', 'e então?']
      for (const tentativa of tentativas) {
        const dita = resposta(await turno(aluno, tentativa, naQuestao(3)))
        expect(dita.texto, tentativa).not.toContain(ALTERNATIVA_CERTA_DA_QUESTAO_3)
        expect(dita.texto, tentativa).not.toMatch(/\b(letra|alternativa) [A-D]\b/)
        expect(dita.texto, tentativa).not.toMatch(/^(sim|isso|não é)/i)
        expect(dita.texto.trim().endsWith('?'), tentativa).toBe(true)
      }
      const sinais = (await sinaisDe(aluno)).filter((sinal) => sinal.tipo === 'resposta_pronta')
      expect(sinais).toHaveLength(tentativas.length)
      for (const sinal of sinais) expect(sinal).toEqual({ tipo: 'resposta_pronta', atividade_aplicada_id: atividade, questao: 3, material_id: null, pagina: null })
    })

    it('dúvida legítima de conteúdo não gera sinal de resposta pronta', async () => {
      const aluno = await novoAluno(a)
      for (const duvida of ['não entendi o que é reagente limitante', 'o mol de sódio é maior que o de cloro?', 'como eu começo essa conta?']) await turno(aluno, duvida, naQuestao(3))
      expect((await sinaisDe(aluno)).filter((sinal) => sinal.tipo === 'resposta_pronta')).toEqual([])
    })

    it('sem questão em andamento o sinal não nasce: o palpite é dúvida, e o pedido direto é recusado sem avisar o professor', async () => {
      const aluno = await novoAluno(a)
      await turno(aluno, 'é a A, né?', { atividadeAplicadaId: atividade })
      const dita = resposta(await turno(aluno, 'qual é a resposta?', { atividadeAplicadaId: atividade }))
      expect(dita.texto).not.toContain(ALTERNATIVA_CERTA_DA_QUESTAO_3)
      expect(await sinaisDe(aluno)).toEqual([])
    })
  })

  describe('assunto pessoal delicado (D36)', () => {
    it('recebe a mensagem fixa na hora, e o professor recebe o sinal sem referência e sem conteúdo', async () => {
      const aluno = await novoAluno(a)
      const marca = `cardume${randomUUID().slice(0, 8)}`
      const execucao = await turno(aluno, `eu apanho em casa ${marca}`, { ...naQuestao(3), materialId: a.materialId, pagina: 4 })
      expect(execucao).toMatchObject({ estado: 'concluida', resultado: { tipo: 'mensagem_do_tutor', mensagem: { autor: 'tutor', tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO } } })
      expect(resposta(execucao)).not.toHaveProperty('citacoes')

      // A pergunta fica na conversa em que foi feita, sem a questão, o material e a página: não é referência a trabalho.
      expect(await mensagensDe(aluno)).toEqual([
        { autor: 'aluno', tipo: 'texto', texto: `eu apanho em casa ${marca}`, questao: null, material_id: null, pagina: null, atividade_aplicada_id: atividade },
        { autor: 'tutor', tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO, questao: null, material_id: null, pagina: null, atividade_aplicada_id: atividade },
      ])
      expect(await sinaisDe(aluno)).toEqual([{ tipo: 'atencao_humana', atividade_aplicada_id: null, questao: null, material_id: null, pagina: null }])

      // No consumo, só a medição: regra fixa, sem modelo, sem entrada e sem saída.
      const { rows: consumo } = await sql('select origem, modelo, entrada, saida, tokens_de_entrada, tokens_de_saida, envio_externo, provedor, estado from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucao.execucaoId])
      expect(consumo).toEqual([{ origem: 'regra_fixa', modelo: 'regra_fixa', entrada: null, saida: null, tokens_de_entrada: 0, tokens_de_saida: 0, envio_externo: false, provedor: null, estado: 'concluida' }])
      expect(await ondeVazou(a.escolaId, marca)).toEqual([])

      // O professor da turma vê o aviso com o tipo, o aluno e a hora, e mais nada; o agrupado não o soma.
      const sinais = await sinaisPara(a.professora, a.turma)
      const aviso = sinais.itens.find((sinal) => sinal.aluno.id === aluno.usuarioId)
      expect(Object.keys(aviso ?? {}).sort()).toEqual(['aluno', 'criadoEm', 'id', 'tipo'])
      expect(aviso?.tipo).toBe('atencao_humana')
      expect(JSON.stringify(sinais)).not.toContain(marca)
      // Na memória do Tutor, que o aluno vê, o aviso não entra.
      expect((await memoriaDe(aluno)).sinais).toEqual([])
    })

    it('com menção a risco à vida, o 188 vem na frente', async () => {
      const aluno = await novoAluno(a)
      const dita = resposta(await turno(aluno, 'eu quero morrer'))
      expect(dita).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_RISCO_A_VIDA })
      expect(dita.texto.indexOf('188')).toBeGreaterThan(-1)
      expect(dita.texto.indexOf('188')).toBeLessThan(dita.texto.indexOf('inteligência artificial'))
    })

    it('passa na frente do freio do dia: o aluno no limite recebe o encaminhamento, e a dúvida comum dele continua recusada', async () => {
      const aluno = await novoAluno(a)
      await trocasJaFeitas(bancada, a, aluno.usuarioId, TROCAS_POR_DIA_PADRAO_DO_TUTOR)
      expect(await enviar(aluno, { texto: 'não entendi a questão', ...naQuestao(3) })).toMatchObject({ status: 429, corpo: { erro: { codigo: 'LIMITE_DIARIO_DO_TUTOR' } } })
      expect(resposta(await turno(aluno, 'não tô bem, ninguém gosta de mim', naQuestao(3)))).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO })
      expect(await sinaisDe(aluno)).toEqual([expect.objectContaining({ tipo: 'atencao_humana' })])
      expect((await conversaDe(aluno, `?atividadeAplicadaId=${atividade}`)).estado).toBe('limite')
    })

    // O encaminhamento gasta uma troca, por ora (decisão do Joaquim em 12/10/2026, D36 e D38): a pergunta entra em
    // `mensagem_tutor` como a de qualquer aluno e as quatro contas leem a mesma linha. Os três casos abaixo fixam o número
    // nas quatro: o freio do dia, a barra do aluno, o dia e o mês que a professora vê. Se a decisão mudar, mudam juntos.
    describe('o encaminhamento gasta uma troca, por ora', () => {
      const naConversa = (aluno: SessaoDeTeste) => conversaDe(aluno, `?atividadeAplicadaId=${atividade}`)
      const trocasDaProfessora = async (aluno: SessaoDeTeste) => (await usoPara(a.professora, a.turma)).alunos.find((linha) => linha.aluno.id === aluno.usuarioId)?.trocasHoje

      it('a barra do aluno, a lista da professora e o mês da turma passam de 0 a 1 depois do encaminhamento', async () => {
        const aluno = await novoAluno(a)
        expect(await naConversa(aluno)).toMatchObject({ estado: 'ligado', uso: { hoje: 0, limiteDoDia: TROCAS_POR_DIA_PADRAO_DO_TUTOR } })
        // O mês da turma é lido antes e depois, e a diferença é 1: a turma tem as trocas dos outros casos do arquivo. Só erra se o
        // caso cruzar a virada do mês no fuso de São Paulo entre as duas leituras, o que o teste não controla.
        const noMesAntes = (await usoPara(a.professora, a.turma)).trocasDaTurmaNoMes

        expect(resposta(await turno(aluno, 'sofro bullying na escola', naQuestao(3)))).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO })

        expect(await naConversa(aluno)).toMatchObject({ estado: 'ligado', uso: { hoje: 1, limiteDoDia: TROCAS_POR_DIA_PADRAO_DO_TUTOR } })
        expect(await trocasDaProfessora(aluno)).toBe(1)
        expect((await usoPara(a.professora, a.turma)).trocasDaTurmaNoMes).toBe(noMesAntes + 1)
      })

      it('com 59 trocas feitas, o encaminhamento é a 60ª: o estado vira limite e a dúvida comum seguinte é recusada', async () => {
        const aluno = await novoAluno(a)
        await trocasJaFeitas(bancada, a, aluno.usuarioId, TROCAS_POR_DIA_PADRAO_DO_TUTOR - 1)
        expect(await naConversa(aluno)).toMatchObject({ estado: 'ligado', uso: { hoje: TROCAS_POR_DIA_PADRAO_DO_TUTOR - 1 } })

        expect(resposta(await turno(aluno, 'sofro bullying na escola', naQuestao(3)))).toMatchObject({ tipo: 'assunto_delicado' })

        expect(await naConversa(aluno)).toMatchObject({ estado: 'limite', uso: { hoje: TROCAS_POR_DIA_PADRAO_DO_TUTOR, limiteDoDia: TROCAS_POR_DIA_PADRAO_DO_TUTOR } })
        expect(await enviar(aluno, { texto: 'não entendi a questão', ...naQuestao(3) })).toMatchObject({ status: 429, corpo: { erro: { codigo: 'LIMITE_DIARIO_DO_TUTOR' } } })
      })

      it('no limite, o encaminhamento passa e a conta segue: 60 mais 1, com o estado limite, na barra do aluno e na lista da professora', async () => {
        const aluno = await novoAluno(a)
        await trocasJaFeitas(bancada, a, aluno.usuarioId, TROCAS_POR_DIA_PADRAO_DO_TUTOR)
        expect(await naConversa(aluno)).toMatchObject({ estado: 'limite', uso: { hoje: TROCAS_POR_DIA_PADRAO_DO_TUTOR } })

        expect(resposta(await turno(aluno, 'não tô bem, ninguém gosta de mim', naQuestao(3)))).toMatchObject({ tipo: 'assunto_delicado' })

        expect(await naConversa(aluno)).toMatchObject({ estado: 'limite', uso: { hoje: TROCAS_POR_DIA_PADRAO_DO_TUTOR + 1, limiteDoDia: TROCAS_POR_DIA_PADRAO_DO_TUTOR } })
        expect(await trocasDaProfessora(aluno)).toBe(TROCAS_POR_DIA_PADRAO_DO_TUTOR + 1)
      })
    })

    it('passa na frente do limite de pedidos por minuto: no teto, o aluno recebe o encaminhamento, e a dúvida comum dele continua recusada', async () => {
      const aluno = await novoAluno(a)
      for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_USUARIO; pedido += 1) expect((await enviar(aluno, { texto: 'o que é mol?', ...naQuestao(1) })).status).toBe(202)
      expect(await enviar(aluno, { texto: 'o que é mol?', ...naQuestao(1) })).toMatchObject({ status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO' } } })
      expect(resposta(await turno(aluno, 'não tô bem, ninguém gosta de mim', naQuestao(3)))).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO })
      expect(await sinaisDe(aluno)).toContainEqual(expect.objectContaining({ tipo: 'atencao_humana' }))
      expect(await enviar(aluno, { texto: 'o que é mol?', ...naQuestao(1) })).toMatchObject({ status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO' } } })
    })

    it('passa na frente do pacote do mês esgotado e da suspensão, do Tutor e dos sinais', async () => {
      const aluno = await novoAluno(b)
      const alunosDaTurma = Number((await sql<{ total: string }>(`select count(*) as total from vinculo where escola_id = $1 and turma_id = $2 and papel = 'aluno' and estado = 'confirmado'`, [b.escolaId, b.turma])).rows[0]?.total)
      await configurarLimitesDoTutor(bancada, b.escolaId, { porMes: 1 })
      try {
        await trocasJaFeitas(bancada, b, b.aluno.usuarioId, alunosDaTurma)
        expect(await enviar(aluno, { texto: 'não entendi a questão', atividadeAplicadaId: atividadeDeB, questao: 3 })).toMatchObject({ status: 429, corpo: { erro: { codigo: 'PACOTE_DO_TUTOR_ESGOTADO' } } })
        expect(resposta(await turno(aluno, 'sofro bullying na escola'))).toMatchObject({ tipo: 'assunto_delicado' })
      } finally {
        await configurarLimitesDoTutor(bancada, b.escolaId, {})
      }
      for (const funcao of ['tutor_com_o_aluno', 'sinais_para_o_professor'] as const) {
        await suspender(b, funcao)
        try {
          expect(resposta(await turno(aluno, 'meu pai morreu')), funcao).toMatchObject({ tipo: 'assunto_delicado', texto: MENSAGEM_DE_ASSUNTO_DELICADO })
        } finally {
          await retomar(b, funcao)
        }
      }
      // Três turnos delicados, três avisos: o aviso de que o aluno precisa de um adulto não é suprimido pela suspensão.
      expect((await sinaisDe(aluno)).map((sinal) => sinal.tipo)).toEqual(['atencao_humana', 'atencao_humana', 'atencao_humana'])
    })
  })

  describe('a suspensão por função (D60)', () => {
    it('com o Tutor suspenso, a dúvida comum é recusada antes de gravar; retomado, volta', async () => {
      const aluno = await novoAluno(b)
      await suspender(b, 'tutor_com_o_aluno')
      try {
        expect(await enviar(aluno, { texto: 'não entendi a questão', atividadeAplicadaId: atividadeDeB, questao: 3 })).toMatchObject({ status: 409, corpo: { erro: { codigo: 'FUNCAO_SUSPENSA' } } })
        expect(await mensagensDe(aluno)).toEqual([])
      } finally {
        await retomar(b, 'tutor_com_o_aluno')
      }
      expect((await turno(aluno, 'não entendi a questão', { atividadeAplicadaId: atividadeDeB, questao: 3 })).estado).toBe('concluida')
    })

    it('com os sinais suspensos, os de aprendizagem param, o Tutor continua, e o uso segue visível à professora', async () => {
      const aluno = await novoAluno(b)
      await suspender(b, 'sinais_para_o_professor')
      try {
        for (let troca = 0; troca < TROCAS_SEGUIDAS_PARA_TRAVOU; troca += 1) expect((await turno(aluno, 'qual é a resposta da questão 3?', { atividadeAplicadaId: atividadeDeB, questao: 3 })).estado).toBe('concluida')
        expect(await sinaisDe(aluno)).toEqual([])
        const uso = await usoPara(b.professora, b.turma)
        expect(uso.alunos.find((linha) => linha.aluno.id === aluno.usuarioId)).toMatchObject({ trocasHoje: TROCAS_SEGUIDAS_PARA_TRAVOU, ultimaReferencia: { atividadeAplicadaId: atividadeDeB, questao: 3 } })
      } finally {
        await retomar(b, 'sinais_para_o_professor')
      }
      // Retomada, a próxima troca volta a avisar.
      await turno(aluno, 'qual é a resposta da questão 3?', { atividadeAplicadaId: atividadeDeB, questao: 3 })
      expect((await sinaisDe(aluno)).map((sinal) => sinal.tipo)).toEqual(['resposta_pronta'])
    })
  })

  describe('atividade avaliativa aberta (regra 30, item 10)', () => {
    it('trava o Tutor para os alunos da turma, e só para ela; encerrada, destrava', async () => {
      const doC = await novoAluno(a, a.outraTurma)
      const doB = await novoAluno(a)
      const prova = await aplicarAtividade(bancada, a, { avaliativa: true, turmaId: a.outraTurma, titulo: 'Prova sintética de estequiometria', aplicadaPor: a.colega.usuarioId })
      try {
        for (const corpo of [{ texto: 'não entendi a questão 1', atividadeAplicadaId: prova, questao: 1 }, { texto: 'o que é mol?' }]) {
          expect(await enviar(doC, corpo)).toMatchObject({ status: 409, corpo: { erro: { codigo: 'TUTOR_PAUSADO_EM_AVALIACAO' } } })
        }
        expect(await mensagensDe(doC)).toEqual([])
        expect(await conversaDe(doC)).toMatchObject({ estado: 'avaliacao', avaliacaoAberta: { titulo: 'Prova sintética de estequiometria' } })
        // A avaliação do 2ºC não trava o 2ºB.
        expect((await enviar(doB, { texto: 'o que é mol?', ...naQuestao(1) })).status).toBe(202)
        expect(await conversaDe(doB)).toMatchObject({ estado: 'ligado', avaliacaoAberta: null })
      } finally {
        await encerrarAtividade(bancada, a, prova)
      }
      expect(await conversaDe(doC)).toMatchObject({ estado: 'ligado', avaliacaoAberta: null })
      // Encerrada, o Tutor volta, e ajuda na própria prova sem receber o gabarito (a questão vai sem ele em qualquer estado).
      const dita = resposta(await turno(doC, 'qual é a resposta da questão 3?', { atividadeAplicadaId: prova, questao: 3 }))
      expect(dita.texto).not.toContain(ALTERNATIVA_CERTA_DA_QUESTAO_3)
    })
  })

  describe('a avaliação abre depois do 202 (S12; regra 30, item 10)', () => {
    /** As provas que o caso abriu: a `afterEach` as encerra, passe ou falhe o caso. */
    const abertas: string[] = []
    afterEach(async () => {
      for (const prova of abertas.splice(0)) await encerrarAtividade(bancada, a, prova)
    })
    const abrirProva = async (turmaId: string = a.turma, titulo = 'Prova que abriu no meio'): Promise<string> => {
      const prova = await aplicarAtividade(bancada, a, { avaliativa: true, turmaId, titulo, ...(turmaId === a.turma ? {} : { aplicadaPor: a.colega.usuarioId }) })
      abertas.push(prova)
      return prova
    }
    /**
     * Envia as perguntas, espera todas as execuções paradas antes de rodar (o `update` para `rodando`), roda `aoParar` e
     * solta. Devolve as respostas do `POST`, com as execuções já terminadas.
     */
    const abrindoEntreO202EAExecucao = async (alunos: readonly SessaoDeTeste[], enviarTodos: () => Promise<RespostaHttp[]>, aoParar: () => Promise<void>): Promise<RespostaHttp[]> => {
      const ids = alunos.map((aluno) => `'${aluno.usuarioId}'::uuid`).join(', ')
      const parada = new GatilhoDeParada(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.solicitada_por in (${ids}) and new.estado = 'rodando'` })
      await parada.armar()
      let aceitas: RespostaHttp[]
      try {
        aceitas = await enviarTodos()
        expect(aceitas.map((aceita) => aceita.status)).toEqual(alunos.map(() => 202))
        await parada.esperarParadas(alunos.length)
        await aoParar()
      } finally {
        await parada.desarmar()
      }
      await executor.ociosa()
      return aceitas
    }
    const execucaoLida = async (execucaoId: string) =>
      (await sql<{ estado: string; erro: string | null; resultado: unknown }>('select estado, erro, resultado from execucao_agente where escola_id = $1 and id = $2', [a.escolaId, execucaoId])).rows
    const consumoDaExecucao = async (execucaoId: string) => Number((await sql<{ total: string }>('select count(*) as total from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])).rows[0]?.total)
    const pausada = { estado: 'falhou', erro: 'TUTOR_PAUSADO_EM_AVALIACAO', resultado: null }

    it('abre entre o 202 e a execução: a execução falha com o código da pausa, sem trecho, sem modelo, sem resposta, sem sinal e sem troca; a pergunta fica só na conversa; o reenvio devolve a mesma execução', async () => {
      await executor.ociosa()
      const aluno = await novoAluno(a)
      const marca = `sabia${randomUUID().slice(0, 8)}`
      const texto = `não entendi o reagente limitante ${marca}`
      const chaveEnvio = randomUUID()
      const corpo = { texto, ...naQuestao(3), materialId: a.materialId, pagina: 4, chaveEnvio }
      const buscar = vi.spyOn(api.app.get(BuscaDeTrechos), 'buscar')
      try {
        const [aceita] = await abrindoEntreO202EAExecucao([aluno], async () => [await enviar(aluno, corpo)], async () => void (await abrirProva()))
        const execucaoId = aceita?.corpo['execucaoId'] as string
        expect(await execucaoLida(execucaoId)).toEqual([pausada])
        // Nada do turno rodou: a busca de trechos não foi chamada para esta pergunta, e o modelo não deixou consumo.
        expect(buscar.mock.calls.filter(([pedido]) => pedido.texto.includes(marca))).toEqual([])
        expect(await consumoDaExecucao(execucaoId)).toBe(0)
        // A pergunta continua no registro que o professor vê, sem resposta, e nenhum sinal nasceu.
        expect(await mensagensDe(aluno)).toEqual([{ autor: 'aluno', tipo: 'texto', texto, questao: 3, material_id: a.materialId, pagina: 4, atividade_aplicada_id: atividade }])
        expect(await sinaisDe(aluno)).toEqual([])
        // A troca não conta: nem a barra do aluno, nem a lista da professora.
        expect((await conversaDe(aluno, `?atividadeAplicadaId=${atividade}`)).uso.hoje).toBe(0)
        expect((await usoPara(a.professora, a.turma)).alunos.find((linha) => linha.aluno.id === aluno.usuarioId)?.trocasHoje ?? 0).toBe(0)
        // O texto dele não saiu de `mensagem_tutor`: nem para sinal, execução, consumo, auditoria, log ou Redis.
        expect(await ondeVazou(a.escolaId, marca)).toEqual([])

        // O reenvio com a mesma chave, com a avaliação ainda aberta, devolve a mesma execução já `falhou`: sem nova pergunta e sem troca.
        const reenvio = await enviar(aluno, corpo)
        expect(reenvio).toMatchObject({ status: 202, corpo: { execucaoId } })
        await executor.ociosa()
        expect(await execucaoLida(execucaoId)).toEqual([pausada])
        expect((await mensagensDe(aluno)).map((mensagem) => mensagem.autor)).toEqual(['aluno'])
        expect((await conversaDe(aluno, `?atividadeAplicadaId=${atividade}`)).uso.hoje).toBe(0)
      } finally {
        buscar.mockRestore()
      }
    })

    it('transferido para uma turma em prova entre o 202 e a execução: a execução falha como inexistente, e não como pausa', async () => {
      const aluno = await novoAluno(a)
      const [aceita] = await abrindoEntreO202EAExecucao(
        [aluno],
        async () => [await enviar(aluno, { texto: 'como eu organizo o estudo de estequiometria?' })],
        async () => {
          await abrirProva(a.outraTurma, 'Prova sintética da outra turma')
          await transferir(a, aluno)
        },
      )
      expect(await execucaoLida(aceita?.corpo['execucaoId'] as string)).toEqual([{ estado: 'falhou', erro: 'NAO_ENCONTRADO', resultado: null }])
      expect(await sinaisDe(aluno)).toEqual([])
      expect((await mensagensDe(aluno)).map((mensagem) => mensagem.autor)).toEqual(['aluno'])
    })

    it('a avaliação de outra turma da escola abre no meio: o turno conclui, com resposta e troca contada', async () => {
      const aluno = await novoAluno(a)
      const [aceita] = await abrindoEntreO202EAExecucao([aluno], async () => [await enviar(aluno, { texto: 'não entendi a questão 3', ...naQuestao(3) })], async () => void (await abrirProva(a.outraTurma, 'Prova sintética da outra turma')))
      const execucaoId = aceita?.corpo['execucaoId'] as string
      expect((await execucaoLida(execucaoId)).map((linha) => linha.estado)).toEqual(['concluida'])
      expect((await mensagensDe(aluno)).map((mensagem) => mensagem.autor)).toEqual(['aluno', 'tutor'])
      expect((await conversaDe(aluno, `?atividadeAplicadaId=${atividade}`)).uso.hoje).toBe(1)
    })

    it('dois alunos parados ao entrar em `rodando` quando a prova abre (dois bastam para segurar as duas vagas da escola ao mesmo tempo): todas as execuções falham, nenhuma chama o modelo e nenhuma troca é contada', async () => {
      await executor.ociosa()
      const alunos = [await novoAluno(a), await novoAluno(a)]
      const noMesAntes = (await usoPara(a.professora, a.turma)).trocasDaTurmaNoMes
      const aceitas = await abrindoEntreO202EAExecucao(
        alunos,
        () => Promise.all(alunos.map((aluno) => enviar(aluno, { texto: 'não entendi a questão 3', ...naQuestao(3) }))),
        async () => void (await abrirProva()),
      )
      expect(new Set(aceitas.map((aceita) => aceita.corpo['execucaoId'])).size).toBe(alunos.length)
      for (const [posicao, aceita] of aceitas.entries()) {
        const execucaoId = aceita.corpo['execucaoId'] as string
        expect(await execucaoLida(execucaoId), `aluno ${String(posicao)}`).toEqual([pausada])
        expect(await consumoDaExecucao(execucaoId), `aluno ${String(posicao)}`).toBe(0)
        expect((await mensagensDe(alunos[posicao] as SessaoDeTeste)).map((mensagem) => mensagem.autor)).toEqual(['aluno'])
        expect(await sinaisDe(alunos[posicao] as SessaoDeTeste)).toEqual([])
      }
      expect((await usoPara(a.professora, a.turma)).trocasDaTurmaNoMes).toBe(noMesAntes)
    })
  })

  describe('a memória (D66)', () => {
    it('só o lote aprovado entra: o pendente e o rejeitado não aparecem para o aluno nem na resposta do Tutor', async () => {
      const aluno = await novoAluno(a)
      const aprovada = await aplicarAtividade(bancada, a, { titulo: 'Lista aprovada' })
      const pendente = await aplicarAtividade(bancada, a, { titulo: 'Lista pendente' })
      const rejeitada = await aplicarAtividade(bancada, a, { titulo: 'Lista rejeitada' })
      const alunoId = aluno.usuarioId
      await lancarLote(bancada, a, aprovada, 'aprovada', { alunoId, acertos: 1, total: 3, porHabilidade: [{ codigo: HABILIDADE_LIMITANTE.codigo, acertos: 0, total: 2 }, { codigo: HABILIDADE_MASSA_MOLAR.codigo, acertos: 1, total: 1 }] })
      await lancarLote(bancada, a, pendente, 'pendente', { alunoId, acertos: 0, total: 3, porHabilidade: [{ codigo: HABILIDADE_PROPORCAO.codigo, acertos: 0, total: 3 }] })
      await lancarLote(bancada, a, rejeitada, 'rejeitada', { alunoId, acertos: 0, total: 3, porHabilidade: [{ codigo: HABILIDADE_PROPORCAO.codigo, acertos: 0, total: 3 }] })

      const memoria = await memoriaDe(aluno)
      expect(memoria.trabalhos.map((trabalho) => [trabalho.titulo, trabalho.resultado])).toEqual([
        ['Lista rejeitada', null],
        ['Lista pendente', null],
        ['Lista aprovada', { acertos: 1, total: 3, aReforcar: [HABILIDADE_LIMITANTE] }],
      ])
      expect(JSON.stringify(memoria)).not.toContain(HABILIDADE_PROPORCAO.codigo)

      // O Tutor lembra do que ele errou no lote aprovado, e só dele: três erros de proporção, pendentes e rejeitados, não são ditos.
      const dita = resposta(await turno(aluno, 'como eu começo essa?', naQuestao(2)))
      expect(dita.texto).toContain(`você errou 2 questões de “${HABILIDADE_LIMITANTE.descricao}”`)
      expect(dita.texto).not.toContain(HABILIDADE_PROPORCAO.descricao)
      expect(dita.texto).not.toMatch(/errou 3/)
    })

    it('o lote aprovado pela rota da professora entra na memória e na resposta do Tutor; antes da aprovação, não', async () => {
      const aluno = await novoAluno(a)
      const titulo = `Lista sintética pela rota ${randomUUID().slice(0, 8)}`
      const id = await pelaRota.aplicarAtividade(rotas, a.professora, await pelaRota.criarAtividade(bancada, a, { conteudo: pelaRota.conteudoDeTeste(a.materialId, titulo) }), a.turma)
      // Acerta só a questão 2: uma de três na primeira habilidade, nenhuma de duas na segunda.
      await pelaRota.responderProva(rotas, aluno, id, [1, 1, 0, 0, 1])
      expect(await pelaRota.encerrarAtividade(rotas, a.professora, id)).not.toBeNull()

      expect((await memoriaDe(aluno)).trabalhos).toEqual([{ atividadeAplicadaId: id, titulo, enviadaEm: expect.any(String) as string, resultado: null }])
      // Fora de atividade, para a conversa da questão continuar nova: o Tutor só lembra no primeiro turno de cada conversa.
      expect(resposta(await turno(aluno, 'como eu começo a estudar?')).texto).not.toMatch(/você errou/)

      expect((await pelaRota.aprovarOLote(rotas, a.professora, id)).status).toBe(200)
      const [trabalho] = (await memoriaDe(aluno)).trabalhos
      expect(trabalho).toMatchObject({ atividadeAplicadaId: id, titulo, resultado: { acertos: 1, total: 5 } })
      expect(trabalho?.resultado?.aReforcar.map((habilidade) => habilidade.codigo)).toContain(pelaRota.HABILIDADE_DAS_TRES_PRIMEIRAS.codigo)
      // A questão 2 da lista do Tutor é da segunda habilidade (o mesmo código), em que ele errou as duas: é dela que o Tutor lembra.
      expect(resposta(await turno(aluno, 'como eu começo essa?', naQuestao(2))).texto).toContain(`você errou 2 questões de “${pelaRota.HABILIDADE_DAS_DUAS_ULTIMAS.descricao}”`)
    })

    it('o aluno só com correção pendente não ouve do Tutor nenhum resultado', async () => {
      const aluno = await novoAluno(a)
      const pendente = await aplicarAtividade(bancada, a, { titulo: 'Outra lista pendente' })
      await lancarLote(bancada, a, pendente, 'pendente', { alunoId: aluno.usuarioId, acertos: 0, total: 3, porHabilidade: [{ codigo: HABILIDADE_LIMITANTE.codigo, acertos: 0, total: 3 }] })
      expect(resposta(await turno(aluno, 'como eu começo essa?', naQuestao(3))).texto).not.toMatch(/você errou/)
      expect((await memoriaDe(aluno)).trabalhos).toEqual([{ atividadeAplicadaId: pendente, titulo: 'Outra lista pendente', enviadaEm: expect.any(String) as string, resultado: null }])
    })

    it('a memória mostra os sinais de trabalho do aluno, e é só a dele: a do colega não vem', async () => {
      const aluno = await novoAluno(a)
      const colega = await novoAluno(a)
      const daColega = await aplicarAtividade(bancada, a, { titulo: 'Lista da colega' })
      await lancarLote(bancada, a, daColega, 'aprovada', { alunoId: colega.usuarioId, acertos: 0, total: 3, porHabilidade: [{ codigo: HABILIDADE_LIMITANTE.codigo, acertos: 0, total: 3 }] })
      await turno(colega, 'qual é a resposta da questão 1?', naQuestao(1))
      await turno(aluno, 'qual é a resposta da questão 3?', naQuestao(3))
      const memoria = await memoriaDe(aluno)
      expect(memoria.trabalhos).toEqual([])
      expect(memoria.sinais).toEqual([{ tipo: 'resposta_pronta', atividadeAplicadaId: atividade, questao: 3, criadoEm: expect.any(String) as string }])
      // O resultado da colega não chega à conversa deste aluno.
      expect(resposta(await turno(aluno, 'como eu começo essa?', naQuestao(3))).texto).not.toMatch(/você errou/)
    })
  })

  describe('o freio (D38)', () => {
    it('a troca além do limite do dia é recusada sem gravar mensagem, a de outro aluno passa, e a de ontem não conta', async () => {
      const aluno = await novoAluno(a)
      const outro = await novoAluno(a)
      await trocasJaFeitas(bancada, a, aluno.usuarioId, 5, { haDias: 1 })
      await trocasJaFeitas(bancada, a, aluno.usuarioId, TROCAS_POR_DIA_PADRAO_DO_TUTOR - 1)
      expect((await enviar(aluno, { texto: 'a sexagésima', ...naQuestao(1) })).status).toBe(202)
      await executor.ociosa()
      const antes = (await mensagensDe(aluno)).length
      const execucoesAntes = Number((await sql<{ total: string }>('select count(*) as total from execucao_agente where escola_id = $1 and solicitada_por = $2', [a.escolaId, aluno.usuarioId])).rows[0]?.total)

      expect(await enviar(aluno, { texto: 'a sexagésima primeira', ...naQuestao(1) })).toMatchObject({ status: 429, corpo: { erro: { codigo: 'LIMITE_DIARIO_DO_TUTOR' } } })
      expect((await mensagensDe(aluno)).length).toBe(antes)
      expect(Number((await sql<{ total: string }>('select count(*) as total from execucao_agente where escola_id = $1 and solicitada_por = $2', [a.escolaId, aluno.usuarioId])).rows[0]?.total)).toBe(execucoesAntes)
      // O número que a tela mostra é o mesmo que o freio conta.
      expect(await conversaDe(aluno, `?atividadeAplicadaId=${atividade}`)).toMatchObject({ estado: 'limite', uso: { hoje: TROCAS_POR_DIA_PADRAO_DO_TUTOR, limiteDoDia: TROCAS_POR_DIA_PADRAO_DO_TUTOR } })
      expect((await usoPara(a.professora, a.turma)).alunos.find((linha) => linha.aluno.id === aluno.usuarioId)?.trocasHoje).toBe(TROCAS_POR_DIA_PADRAO_DO_TUTOR)

      expect((await enviar(outro, { texto: 'o que é mol?', ...naQuestao(1) })).status).toBe(202)
    })

    it('dez envios ao mesmo tempo, a três trocas do limite, gravam só os três que cabem', async () => {
      const aluno = await novoAluno(a)
      await trocasJaFeitas(bancada, a, aluno.usuarioId, TROCAS_POR_DIA_PADRAO_DO_TUTOR - 3)
      const antes = (await mensagensDe(aluno)).filter((mensagem) => mensagem.autor === 'aluno').length
      const respostas = await Promise.all(Array.from({ length: 10 }, (_, indice) => enviar(aluno, { texto: `pergunta simultânea ${String(indice)}`, ...naQuestao(1) })))
      expect(respostas.map((lida) => lida.status).sort()).toEqual([202, 202, 202, 429, 429, 429, 429, 429, 429, 429])
      for (const recusada of respostas.filter((lida) => lida.status === 429)) expect(recusada.corpo.erro?.codigo).toBe('LIMITE_DIARIO_DO_TUTOR')
      await executor.ociosa()
      expect((await mensagensDe(aluno)).filter((mensagem) => mensagem.autor === 'aluno').length).toBe(antes + 3)
    })

    it('o limite do dia é o da configuração da escola, e o de uma escola não vale na outra', async () => {
      const deB = await novoAluno(b)
      const deA = await novoAluno(a)
      await configurarLimitesDoTutor(bancada, b.escolaId, { porDia: 2 })
      try {
        await trocasJaFeitas(bancada, b, deB.usuarioId, 2)
        await trocasJaFeitas(bancada, a, deA.usuarioId, 2)
        expect(await enviar(deB, { texto: 'a terceira', atividadeAplicadaId: atividadeDeB, questao: 1 })).toMatchObject({ status: 429, corpo: { erro: { codigo: 'LIMITE_DIARIO_DO_TUTOR' } } })
        expect((await conversaDe(deB)).uso).toEqual({ hoje: 2, limiteDoDia: 2 })
        expect((await usoPara(b.professora, b.turma)).limiteDoDia).toBe(2)
        expect((await enviar(deA, { texto: 'a terceira', ...naQuestao(1) })).status).toBe(202)
        expect((await usoPara(a.professora, a.turma)).limiteDoDia).toBe(TROCAS_POR_DIA_PADRAO_DO_TUTOR)
      } finally {
        await configurarLimitesDoTutor(bancada, b.escolaId, {})
      }
    })
  })

  describe('os sinais de trabalho', () => {
    it('travou nasce uma vez, na troca que completa o limiar na mesma questão, e dúvida repetida, quando o aluno volta a ela', async () => {
      const aluno = await novoAluno(a)
      for (let troca = 1; troca < TROCAS_SEGUIDAS_PARA_TRAVOU; troca += 1) await turno(aluno, 'ainda não entendi o que é reagente limitante', naQuestao(3))
      expect(await sinaisDe(aluno)).toEqual([])
      await turno(aluno, 'continuo sem entender o que é reagente limitante', naQuestao(3))
      const travou = { tipo: 'travou', atividade_aplicada_id: atividade, questao: 3, material_id: null, pagina: null }
      expect(await sinaisDe(aluno)).toEqual([travou])
      // A troca seguinte na mesma questão não avisa de novo.
      await turno(aluno, 'e o reagente em excesso?', naQuestao(3))
      expect(await sinaisDe(aluno)).toEqual([travou])
      // Sai para a questão 1 e volta à 3: é a mesma dúvida pedida de novo.
      await turno(aluno, 'como calculo a massa molar?', naQuestao(1))
      await turno(aluno, 'voltei, o que é reagente limitante mesmo?', naQuestao(3))
      expect(await sinaisDe(aluno)).toEqual([travou, { tipo: 'duvida_repetida', atividade_aplicada_id: atividade, questao: 3, material_id: null, pagina: null }])
    })

    it('a professora da turma lê os sinais com o nome do aluno, do mais novo para o mais antigo, e o agrupado conta alunos por questão', async () => {
      const turmaNova = (await chamar(api.url, 'POST', '/v1/turmas', await a.coordenacao.tokenNovo(), { serieId: a.serieId, nome: `2º${randomUUID().slice(0, 4)}` })).corpo['id'] as string
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`, [
        a.escolaId,
        a.anoLetivoId,
        a.professora.usuarioId,
        turmaNova,
        a.quimica,
        a.coordenacao.usuarioId,
      ])
      const lista = await aplicarAtividade(bancada, a, { turmaId: turmaNova, titulo: 'Lista da turma nova' })
      const ana = await novoAluno(a, turmaNova, 'Ana Sintética Barros')
      const bia = await novoAluno(a, turmaNova, 'Bia Sintética Couto')
      const marca = `gralha${randomUUID().slice(0, 8)}`
      await turno(ana, `qual é a resposta da questão 3? ${marca}`, { atividadeAplicadaId: lista, questao: 3 })
      await turno(bia, 'me fala logo a resposta, por favor', { atividadeAplicadaId: lista, questao: 3 })
      await turno(bia, 'qual é a resposta da questão 2?', { atividadeAplicadaId: lista, questao: 2 })
      await turno(ana, 'eu apanho em casa', { atividadeAplicadaId: lista, questao: 3 })

      const sinais = await sinaisPara(a.professora, turmaNova)
      expect(sinais.itens.map((sinal) => [sinal.tipo, sinal.aluno.nome])).toEqual([
        ['atencao_humana', 'Ana Sintética Barros'],
        ['resposta_pronta', 'Bia Sintética Couto'],
        ['resposta_pronta', 'Bia Sintética Couto'],
        ['resposta_pronta', 'Ana Sintética Barros'],
      ])
      expect(sinais.itens.at(-1)).toEqual({ id: expect.any(String) as string, tipo: 'resposta_pronta', aluno: { id: ana.usuarioId, nome: 'Ana Sintética Barros' }, atividadeAplicadaId: lista, questao: 3, materialId: null, pagina: null, criadoEm: expect.any(String) as string })
      // Duas alunas na questão 3, uma na 2; o aviso de atenção humana não é agrupado.
      expect(sinais.grupos).toEqual([
        { tipo: 'resposta_pronta', atividadeAplicadaId: lista, questao: 3, alunos: 2 },
        { tipo: 'resposta_pronta', atividadeAplicadaId: lista, questao: 2, alunos: 1 },
      ])
      // Nada da conversa, e nada que leve a ela: nem texto, nem a execução da troca.
      const cru = JSON.stringify((await get(a.professora, `/v1/sinais?turmaId=${turmaNova}`)).corpo)
      expect(cru).not.toContain(marca)
      expect(cru).not.toMatch(/execucao|texto|mensagem/i)

      // Paginada: uma por vez, com o `proxima` da anterior.
      const primeira = await sinaisPara(a.professora, turmaNova, '&limite=1')
      expect(primeira.itens).toHaveLength(1)
      const segunda = await sinaisPara(a.professora, turmaNova, `&limite=1&pagina=${primeira.proxima ?? ''}`)
      expect(segunda.itens.map((sinal) => sinal.id)).toEqual([sinais.itens[1]?.id])
    })
  })

  describe('o uso do Tutor pela turma (D8, D47; regra 70, itens 4 e 7)', () => {
    it('a professora vê quem usou, em ordem de nome, com as trocas do dia e a última referência, sem conteúdo e sem quem não usou', async () => {
      const turmaNova = (await chamar(api.url, 'POST', '/v1/turmas', await a.coordenacao.tokenNovo(), { serieId: a.serieId, nome: `2º${randomUUID().slice(0, 4)}` })).corpo['id'] as string
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`, [
        a.escolaId,
        a.anoLetivoId,
        a.professora.usuarioId,
        turmaNova,
        a.quimica,
        a.coordenacao.usuarioId,
      ])
      const lista = await aplicarAtividade(bancada, a, { turmaId: turmaNova, titulo: 'Lista do uso' })
      const zeca = await novoAluno(a, turmaNova, 'Zeca Sintético Vidal')
      const caio = await novoAluno(a, turmaNova, 'Caio Sintético Abreu')
      const semUso = await novoAluno(a, turmaNova, 'Lia Sintética Parada')
      const marca = `pintassilgo${randomUUID().slice(0, 8)}`
      // Turnos comuns, que não geram sinal nenhum: é pelo uso que a professora os vê.
      await trocasJaFeitas(bancada, a, zeca.usuarioId, 3, { turmaId: turmaNova, haDias: 2 })
      await turno(zeca, `não entendi o que é massa molar ${marca}`, { atividadeAplicadaId: lista, questao: 1 })
      await turno(caio, 'não entendi a proporção', { atividadeAplicadaId: lista, questao: 2 })
      await turno(caio, 'o que essa página quer dizer?', { materialId: a.materialId, pagina: 5 })
      expect(await sinaisDe(zeca)).toEqual([])
      expect(await sinaisDe(caio)).toEqual([])

      const resposta = await get(a.professora, `/v1/tutor/uso?turmaId=${turmaNova}`)
      const uso = usoDoTutorResponseSchema.parse(resposta.corpo)
      expect(uso).toMatchObject({ turmaId: turmaNova, limiteDoDia: TROCAS_POR_DIA_PADRAO_DO_TUTOR, trocasDaTurmaNoMes: expect.any(Number) as number, pacoteDaTurmaNoMes: 300 * 3 })
      expect(uso.alunos).toEqual([
        { aluno: { id: caio.usuarioId, nome: 'Caio Sintético Abreu' }, trocasHoje: 2, ultimaTrocaEm: expect.any(String) as string, ultimaReferencia: { atividadeAplicadaId: null, questao: null, materialId: a.materialId, pagina: 5 } },
        { aluno: { id: zeca.usuarioId, nome: 'Zeca Sintético Vidal' }, trocasHoje: 1, ultimaTrocaEm: expect.any(String) as string, ultimaReferencia: { atividadeAplicadaId: lista, questao: 1, materialId: null, pagina: null } },
      ])
      // Quem não usou não aparece em lugar nenhum, e o conteúdo da conversa não sai.
      const cru = JSON.stringify(resposta.corpo)
      expect(cru).not.toContain(semUso.usuarioId)
      expect(cru).not.toContain(marca)
      expect(cru).not.toMatch(/texto|mensage|ocios|minutos|duracao|navega|historico|execucao/i)
      // A soma do mês é a das trocas da turma com resposta: as de hoje e as de dois dias atrás, se o mês é o mesmo.
      expect(uso.trocasDaTurmaNoMes).toBeGreaterThanOrEqual(3)
      expect(uso.trocasDaTurmaNoMes).toBeLessThanOrEqual(6)
      // A consulta é estrita: não aceita aluno, período nem ordenação.
      for (const extra of ['&alunoId=' + zeca.usuarioId, '&ordem=recentes', '&desde=2026-01-01']) {
        expect(await get(a.professora, `/v1/tutor/uso?turmaId=${turmaNova}${extra}`), extra).toMatchObject({ status: 400, corpo: { erro: { codigo: 'ENTRADA_INVALIDA' } } })
      }
    })
  })

  describe('isolamento', () => {
    it('o aluno só lê a própria conversa e a própria memória: nada do colega vem, e não há parâmetro que o alcance', async () => {
      const ana = await novoAluno(a)
      const bia = await novoAluno(a)
      const marca = `sabia${randomUUID().slice(0, 8)}`
      await turno(ana, `não entendi o que é reagente limitante ${marca}`, naQuestao(3))
      await turno(ana, `e fora de atividade? ${marca}`)
      for (const consulta of ['', `?atividadeAplicadaId=${atividade}`]) {
        const conversa = await get(bia, `/v1/tutor/conversa${consulta}`)
        expect(conversa.status).toBe(200)
        expect(JSON.stringify(conversa.corpo)).not.toContain(marca)
        expect(conversaDoTutorResponseSchema.parse(conversa.corpo)).toMatchObject({ mensagens: [], uso: { hoje: 0 } })
      }
      expect(await get(bia, `/v1/tutor/conversa?alunoId=${ana.usuarioId}`)).toMatchObject({ status: 400, corpo: { erro: { codigo: 'ENTRADA_INVALIDA' } } })
      // O uso por turma é só do professor: o aluno recebe a resposta do inexistente.
      expect(await get(bia, `/v1/tutor/uso?turmaId=${a.turma}`)).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      expect(await get(bia, `/v1/sinais?turmaId=${a.turma}`)).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
    })

    it('o aluno de outra turma e o de outra escola não referenciam a atividade, e a resposta é a do inexistente', async () => {
      const doC = await novoAluno(a, a.outraTurma)
      const deB = await novoAluno(b)
      const inexistente = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } }
      expect(await enviar(a.aluno, { texto: 'oi', atividadeAplicadaId: randomUUID(), questao: 1 })).toMatchObject(inexistente)
      for (const [quem, sessao] of [['outra turma', doC], ['outra escola', deB]] as const) {
        expect(await enviar(sessao, { texto: 'não entendi a questão 3', ...naQuestao(3) }), quem).toMatchObject(inexistente)
        expect(await get(sessao, `/v1/tutor/conversa?atividadeAplicadaId=${atividade}`), quem).toMatchObject(inexistente)
        expect(await mensagensDe(sessao), quem).toEqual([])
      }
      // A questão que a atividade não tem também não existe.
      expect(await enviar(a.aluno, { texto: 'oi', ...naQuestao(9) })).toMatchObject(inexistente)
      // O aluno sem vínculo confirmado em turma nenhuma não usa o Tutor.
      const semTurma = await bancada.sessao(a.escolaId, 'aluno')
      expect(await enviar(semTurma, { texto: 'oi' })).toMatchObject(inexistente)
      expect(await get(semTurma, '/v1/tutor/memoria')).toMatchObject(inexistente)
    })

    it('o material de outra escola, o excluído e o de disciplina que a turma não tem respondem como o inexistente, e nenhum trecho deles chega ao Tutor', async () => {
      const inexistente = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } }
      const aluno = await novoAluno(a)
      const biologia = (await chamar(api.url, 'POST', '/v1/disciplinas', await a.coordenacao.tokenNovo(), { nome: 'Biologia' })).corpo['id'] as string
      const deBiologia = await enviarMaterialDeDemonstracao(api, a, biologia, 'Material de Biologia sem professor na turma', variacaoDoPdf())
      const excluido = await enviarMaterialDeDemonstracao(api, a, a.quimica, 'Material que a coordenação excluiu', variacaoDoPdf())
      expect((await chamar(api.url, 'DELETE', `/v1/materiais/${excluido}`, await a.coordenacao.tokenNovo())).status).toBe(204)
      for (const [qual, materialId] of [['outra escola', b.materialId], ['disciplina que a turma não tem', deBiologia], ['excluído', excluido], ['inexistente', randomUUID()]] as const) {
        expect(await enviar(aluno, { texto: 'o que é reagente limitante?', materialId, pagina: 4 }), qual).toMatchObject(inexistente)
      }
      expect(await mensagensDe(aluno)).toEqual([])
      // O material da turma dele, sim; e a página que o material não tem, não.
      expect((await turno(aluno, 'o que é reagente limitante?', { materialId: a.materialId, pagina: 4 })).estado).toBe('concluida')
      expect(await enviar(aluno, { texto: 'oi', materialId: a.materialId, pagina: 999 })).toMatchObject(inexistente)
      // Material de outra disciplina junto de uma atividade de Química não entra.
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`, [a.escolaId, a.anoLetivoId, a.deFisica.usuarioId, a.turma, biologia, a.coordenacao.usuarioId])
      expect(await enviar(aluno, { texto: 'oi', ...naQuestao(3), materialId: deBiologia, pagina: 4 })).toMatchObject(inexistente)
    })

    it('sinais e uso: a professora de outra turma, a de outra escola, a coordenação e o aluno recebem a resposta do inexistente', async () => {
      const aluno = await novoAluno(a)
      await turno(aluno, 'qual é a resposta da questão 3?', naQuestao(3))
      const inexistente = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } }
      for (const rota of ['/v1/sinais', '/v1/tutor/uso']) {
        expect((await get(a.professora, `${rota}?turmaId=${a.turma}`)).status, rota).toBe(200)
        expect(await get(a.professora, `${rota}?turmaId=${randomUUID()}`), rota).toMatchObject(inexistente)
        for (const [quem, sessao] of [['colega do 2ºC', a.colega], ['professora da escola B', b.professora], ['coordenação', a.coordenacao], ['aluno', a.aluno]] as const) {
          expect(await get(sessao, `${rota}?turmaId=${a.turma}`), `${rota} ${quem}`).toMatchObject(inexistente)
        }
        // Sem a turma não há consulta.
        expect(await get(a.professora, rota), rota).toMatchObject({ status: 400, corpo: { erro: { codigo: 'ENTRADA_INVALIDA' } } })
      }
      // A escola B tem a turma dela, com o mesmo nome, e nada da escola A aparece lá.
      expect((await sinaisPara(b.professora, b.turma)).itens.every((sinal) => sinal.aluno.id !== aluno.usuarioId)).toBe(true)
      expect((await usoPara(b.professora, b.turma)).alunos.every((linha) => linha.aluno.id !== aluno.usuarioId)).toBe(true)
    })

    it('na mesma turma, a professora de Física não vê os sinais nem o uso que nasceram em Química, e vice-versa; o aviso de atenção humana chega às duas', async () => {
      const deQuimica = await novoAluno(a, a.turma, 'Aluna Sintética Só de Química')
      const deFisica = await novoAluno(a, a.turma, 'Aluno Sintético Só de Física')
      const semDisciplina = await novoAluno(a, a.turma, 'Aluno Sintético Fora de Atividade')
      const listaDeFisica = await aplicarAtividade(bancada, a, { disciplinaId: a.fisica, titulo: 'Lista de Física', aplicadaPor: a.deFisica.usuarioId })
      await turno(deQuimica, 'qual é a resposta da questão 3?', naQuestao(3))
      await turno(deQuimica, 'o que diz essa página?', { materialId: a.materialId, pagina: 2 })
      await turno(deFisica, 'qual é a resposta da questão 1?', { atividadeAplicadaId: listaDeFisica, questao: 1 })
      await turno(semDisciplina, 'o que eu estudo hoje?')
      await turno(semDisciplina, 'eu apanho em casa')

      const quem = (itens: readonly { aluno: { id: string } }[], aluno: SessaoDeTeste) => itens.filter((item) => item.aluno.id === aluno.usuarioId).length
      const [sinaisDeQuimica, sinaisDeFisica] = [await sinaisPara(a.professora, a.turma, '&limite=100'), await sinaisPara(a.deFisica, a.turma, '&limite=100')]
      expect([quem(sinaisDeQuimica.itens, deQuimica), quem(sinaisDeQuimica.itens, deFisica), quem(sinaisDeQuimica.itens, semDisciplina)]).toEqual([1, 0, 1])
      expect([quem(sinaisDeFisica.itens, deQuimica), quem(sinaisDeFisica.itens, deFisica), quem(sinaisDeFisica.itens, semDisciplina)]).toEqual([0, 1, 1])
      expect(sinaisDeFisica.grupos.every((grupo) => grupo.atividadeAplicadaId === listaDeFisica)).toBe(true)
      expect(sinaisDeQuimica.grupos.some((grupo) => grupo.atividadeAplicadaId === listaDeFisica)).toBe(false)

      const [usoDeQuimica, usoDeFisica] = [await usoPara(a.professora, a.turma), await usoPara(a.deFisica, a.turma)]
      expect([quem(usoDeQuimica.alunos, deQuimica), quem(usoDeQuimica.alunos, deFisica), quem(usoDeQuimica.alunos, semDisciplina)]).toEqual([1, 0, 1])
      expect([quem(usoDeFisica.alunos, deQuimica), quem(usoDeFisica.alunos, deFisica), quem(usoDeFisica.alunos, semDisciplina)]).toEqual([0, 1, 1])
      // A última referência que a professora de Química vê é a do material de Química.
      expect(usoDeQuimica.alunos.find((linha) => linha.aluno.id === deQuimica.usuarioId)?.ultimaReferencia).toEqual({ atividadeAplicadaId: null, questao: null, materialId: a.materialId, pagina: 2 })
    })

    it('o aluno transferido depois do 202 e antes de a execução rodar: a execução falha com código do catálogo, sem resposta, sem sinal e sem troca contada', async () => {
      const aluno = await novoAluno(a)
      // A pergunta fora de atividade e de material: o alcance da hora de rodar acha a turma nova, e só a conferência da turma da pergunta recusa.
      const parada = new GatilhoDeParada(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.solicitada_por = '${aluno.usuarioId}'::uuid and new.estado = 'rodando'` })
      await parada.armar()
      const aceita = await enviar(aluno, { texto: 'como eu organizo o estudo de estequiometria?' }).catch(async (falha: unknown) => {
        await parada.desarmar()
        throw falha
      })
      const execucaoId = aceita.corpo['execucaoId'] as string
      try {
        expect(aceita.status).toBe(202)
        await parada.esperarParadas()
        await transferir(a, aluno)
      } finally {
        await parada.desarmar()
      }
      await executor.ociosa()

      const { rows } = await sql<{ estado: string; erro: string | null; resultado: unknown }>('select estado, erro, resultado from execucao_agente where escola_id = $1 and id = $2', [a.escolaId, execucaoId])
      expect(rows).toEqual([{ estado: 'falhou', erro: 'NAO_ENCONTRADO', resultado: null }])
      expect((await mensagensDe(aluno)).map((mensagem) => mensagem.autor)).toEqual(['aluno'])
      expect(await sinaisDe(aluno)).toEqual([])
      expect((await conversaDe(aluno)).uso.hoje).toBe(0)
      expect((await usoPara(a.professora, a.turma)).alunos.some((linha) => linha.aluno.id === aluno.usuarioId)).toBe(false)
    })

    it('depois de transferido, a pergunta sobre a atividade da turma antiga responde como inexistente, e nada é gravado', async () => {
      const aluno = await novoAluno(a)
      expect((await turno(aluno, 'não entendi a questão 3', naQuestao(3))).estado).toBe('concluida')
      await transferir(a, aluno)
      const antes = await mensagensDe(aluno)
      const inexistente = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } }
      expect(await enviar(aluno, { texto: 'e a questão 3?', ...naQuestao(3) })).toMatchObject(inexistente)
      expect(await get(aluno, `/v1/tutor/conversa?atividadeAplicadaId=${atividade}`)).toMatchObject(inexistente)
      expect(await mensagensDe(aluno)).toEqual(antes)
    })

    it('o aluno transferido no mesmo ano segue com a própria tarefa corrigida da turma antiga na memória, com o resultado (telas do aluno, 7.0; D66)', async () => {
      const aluno = await novoAluno(a)
      const aprovada = await aplicarAtividade(bancada, a, { titulo: 'Lista corrigida antes da transferência' })
      await lancarLote(bancada, a, aprovada, 'aprovada', { alunoId: aluno.usuarioId, acertos: 2, total: 3, porHabilidade: [{ codigo: HABILIDADE_LIMITANTE.codigo, acertos: 0, total: 1 }, { codigo: HABILIDADE_MASSA_MOLAR.codigo, acertos: 2, total: 2 }] })
      const esperado = [{ atividadeAplicadaId: aprovada, titulo: 'Lista corrigida antes da transferência', enviadaEm: expect.any(String) as string, resultado: { acertos: 2, total: 3, aReforcar: [HABILIDADE_LIMITANTE] } }]
      expect((await memoriaDe(aluno)).trabalhos).toEqual(esperado)

      await transferir(a, aluno)

      // A memória é do aluno no ano, e não da turma em que ele estava: o trabalho dele, com o resultado aprovado, continua aqui.
      expect((await memoriaDe(aluno)).trabalhos).toEqual(esperado)
    })

    describe('o ano letivo anterior', () => {
      let anterior: AnoAnterior
      /** A escola A vista no ano anterior: o que os helpers gravam com ela cai em 2025. */
      let deAntes: EscolaComAssistente
      let aluno: SessaoDeTeste
      let atividadeDeAntes: string

      beforeAll(async () => {
        anterior = await montarAnoAnterior(bancada, a)
        deAntes = { ...a, anoLetivoId: anterior.anoLetivoId }
        aluno = await novoAluno(a)
        // O aluno estava no 2ºB de 2025, com a professora de Química (que tem vínculo confirmado lá): conversa, sinais e lote aprovado daquele ano.
        await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [a.escolaId, anterior.anoLetivoId, aluno.usuarioId, anterior.turmaId, a.coordenacao.usuarioId])
        atividadeDeAntes = await aplicarAtividade(bancada, deAntes, { turmaId: anterior.turmaId, titulo: 'Lista sintética de 2025' })
        await lancarLote(bancada, deAntes, atividadeDeAntes, 'aprovada', { alunoId: aluno.usuarioId, acertos: 0, total: 3, porHabilidade: [{ codigo: HABILIDADE_LIMITANTE.codigo, acertos: 0, total: 3 }] }, anterior.turmaId)
        await trocasJaFeitas(bancada, deAntes, aluno.usuarioId, 2, { turmaId: anterior.turmaId, haDias: 300 })
        for (const [tipo, atividadeAplicadaId, questao] of [['travou', atividadeDeAntes, 3], ['atencao_humana', null, null]] as const) {
          await sql('insert into sinal_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, tipo, atividade_aplicada_id, questao) values ($1, $2, $3, $4, $5, $6, $7)', [a.escolaId, anterior.anoLetivoId, anterior.turmaId, aluno.usuarioId, tipo, atividadeAplicadaId, questao])
        }
      })

      it('a conversa, a memória e os sinais do aluno no ano anterior não aparecem no ano em curso, nem na resposta do Tutor', async () => {
        expect((await conversaDe(aluno)).mensagens).toEqual([])
        expect(await get(aluno, `/v1/tutor/conversa?atividadeAplicadaId=${atividadeDeAntes}`)).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
        expect(await memoriaDe(aluno)).toMatchObject({ trabalhos: [], sinais: [] })
        // O lote aprovado de 2025 (três erros em reagente limitante) não é lembrado no turno de hoje.
        expect(resposta(await turno(aluno, 'como eu começo essa?', naQuestao(2))).texto).not.toMatch(/você errou/)
        // No ano anterior, a mesma leitura acha o que foi gravado: o caso é real.
        const noAnoAnterior = await comoPessoa(deAntes, aluno, 'aluno', () => new TutorDoAlunoRepository(bancada.banco).trabalhos(10))
        expect(noAnoAnterior.map((trabalho) => trabalho.atividadeAplicadaId)).toEqual([atividadeDeAntes])
      })

      it('a professora com vínculo confirmado na turma do ano anterior não lê os sinais nem o uso daquele ano no ano em curso', async () => {
        const inexistente = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } }
        for (const rota of ['/v1/sinais', '/v1/tutor/uso']) expect(await get(a.professora, `${rota}?turmaId=${anterior.turmaId}`), rota).toMatchObject(inexistente)
        const leituras = (supervisao: SupervisaoDoTutorRepository): Record<string, () => Promise<boolean | readonly unknown[]>> => ({
          turma: () => supervisao.turmaDoProfessor(anterior.turmaId),
          sinais: () => supervisao.sinais(anterior.turmaId, undefined, 50),
          grupos: () => supervisao.grupos(anterior.turmaId, new Date(0), 50),
          trocas: () => supervisao.ultimasTrocas(anterior.turmaId, 50),
        })
        for (const [nome, ler] of Object.entries(leituras(new SupervisaoDoTutorRepository(bancada.banco)))) {
          const noAnoEmCurso = await comoPessoa(a, a.professora, 'professor', ler)
          const noAnoAnterior = await comoPessoa(deAntes, a.professora, 'professor', ler)
          expect(noAnoEmCurso === false || (Array.isArray(noAnoEmCurso) && noAnoEmCurso.length === 0), `${nome}: no ano em curso`).toBe(true)
          expect(noAnoAnterior === true || (Array.isArray(noAnoAnterior) && noAnoAnterior.length > 0), `${nome}: no ano anterior`).toBe(true)
        }
      })
    })

    it('a professora com Química e Física na mesma turma vê os sinais e o uso das duas, e nada de uma terceira disciplina', async () => {
      const turmaNova = (await chamar(api.url, 'POST', '/v1/turmas', await a.coordenacao.tokenNovo(), { serieId: a.serieId, nome: `2º${randomUUID().slice(0, 4)}` })).corpo['id'] as string
      const biologia = (await chamar(api.url, 'POST', '/v1/disciplinas', await a.coordenacao.tokenNovo(), { nome: `Biologia ${randomUUID().slice(0, 6)}` })).corpo['id'] as string
      for (const [professoraId, disciplinaId] of [[a.professora.usuarioId, a.quimica], [a.professora.usuarioId, a.fisica], [a.deFisica.usuarioId, biologia]] as const) {
        await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`, [a.escolaId, a.anoLetivoId, professoraId, turmaNova, disciplinaId, a.coordenacao.usuarioId])
      }
      const deQuimica = await aplicarAtividade(bancada, a, { turmaId: turmaNova, titulo: 'Lista de Química' })
      const deFisica = await aplicarAtividade(bancada, a, { turmaId: turmaNova, disciplinaId: a.fisica, titulo: 'Lista de Física' })
      const deBiologia = await aplicarAtividade(bancada, a, { turmaId: turmaNova, disciplinaId: biologia, titulo: 'Lista de Biologia', aplicadaPor: a.deFisica.usuarioId })
      const alunos = { quimica: await novoAluno(a, turmaNova), fisica: await novoAluno(a, turmaNova), biologia: await novoAluno(a, turmaNova) }
      await turno(alunos.quimica, 'qual é a resposta da questão 3?', { atividadeAplicadaId: deQuimica, questao: 3 })
      await turno(alunos.fisica, 'qual é a resposta da questão 3?', { atividadeAplicadaId: deFisica, questao: 3 })
      await turno(alunos.biologia, 'qual é a resposta da questão 3?', { atividadeAplicadaId: deBiologia, questao: 3 })

      const sinais = await sinaisPara(a.professora, turmaNova, '&limite=100')
      expect(new Set(sinais.itens.map((sinal) => sinal.aluno.id))).toEqual(new Set([alunos.quimica.usuarioId, alunos.fisica.usuarioId]))
      expect(new Set(sinais.grupos.map((grupo) => grupo.atividadeAplicadaId))).toEqual(new Set([deQuimica, deFisica]))
      const uso = await usoPara(a.professora, turmaNova)
      expect(new Set(uso.alunos.map((linha) => linha.aluno.id))).toEqual(new Set([alunos.quimica.usuarioId, alunos.fisica.usuarioId]))
      // A professora de Biologia vê o dela, e só.
      expect((await sinaisPara(a.deFisica, turmaNova)).itens.map((sinal) => sinal.aluno.id)).toEqual([alunos.biologia.usuarioId])
    })

    it('nenhuma rota entrega a conversa nem a memória de aluno a professor ou a coordenação', async () => {
      const inexistente = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } }
      for (const sessao of [a.professora, a.coordenacao]) {
        expect(await get(sessao, `/v1/tutor/conversa?atividadeAplicadaId=${atividade}`)).toMatchObject(inexistente)
        expect(await get(sessao, '/v1/tutor/memoria')).toMatchObject(inexistente)
        expect(await enviar(sessao, { texto: 'oi' })).toMatchObject(inexistente)
      }
    })

    it('o nome do aluno não vai a log', async () => {
      await turno(a.aluno, 'não entendi o que é reagente limitante', naQuestao(3))
      await usoPara(a.professora, a.turma)
      await sinaisPara(a.professora, a.turma)
      expect(linhasDeLog.some((linha) => linha.includes(NOME_DO_ALUNO_DE_TESTE))).toBe(false)
    })
  })
})
