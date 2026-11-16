import { LLMError, MENSAGEM_DE_ASSUNTO_DELICADO, type LLMErrorCode } from '@educa/core'
import { ErrorCode, PASSAGEIROS, usoDoTutorResponseSchema, type ChaveDeFuncao } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, type RespostaHttp, type TestApi } from '../../test/test-api.js'
import { FilaDeIa, type ModeloDeTeste } from '../../test/fila-de-ia.fixture.js'
import {
  comoPessoa,
  dispararExecucao,
  enviarMaterialDeDemonstracao,
  execucaoTerminada,
  montarAnoAnterior,
  montarEscolaComAssistente,
  vincularProfessor,
  zerarLimiteDePedidosDeIa,
  type EscolaComAssistente,
  type ExecucaoLida,
} from '../../test/escola-assistente.fixture.js'
import { aplicarAtividade, encerrarAtividade } from '../../test/escola-tutor.fixture.js'
import { variacaoDoPdf } from '../../test/material.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { SupervisaoDoTutorRepository } from './supervisao.repository.js'

/**
 * A pergunta que o Tutor não respondeu, na lista de uso da professora (reengenharia-continuacao, 9.0; RF5; `techspec.md` §5 "A pergunta sem resposta"; D8, D47;
 * regra 70, itens 4 e 7). `GET /v1/tutor/uso` ganha `semRespostaHoje` por aluno: as perguntas de hoje que terminaram `falhou` num código de `PASSAGEIROS`, sem a mensagem
 * fixa da D36, no recorte (turma, ano e disciplina) das `ultimasTrocas`, **só a contagem**. A pergunta cortada continua fora de `trocasHoje` e do freio.
 *
 * As falhas nascem pelo caminho de verdade: o `POST` do aluno, o job no worker da bancada (`FilaDeIa`) e o provedor que lança o código que o gateway lançaria (`comModelo`);
 * a reentrega interrompida, a avaliação aberta, a função suspensa e o vínculo encerrado pelo que muda entre o `202` e o worker (`segurar`). A lista parametrizada sobre
 * `PASSAGEIROS` e as linhas de dia e de ano são gravadas direto, porque o caso é o da leitura e precisa de hora e ano escolhidos.
 */

/** O corpo de uma pergunta cortada, que nenhuma resposta da API pode repetir. */
const TEXTO_DA_PERGUNTA = 'não entendi o que é reagente limitante'

describe('o uso do Tutor mostra as perguntas que ele não respondeu hoje (RF5)', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let fila: FilaDeIa
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  /** A lista de Química e a de Física aplicadas ao 2ºB da escola A, e a de Química da escola B. */
  let atividade: string
  let atividadeDeFisica: string
  let materialDeFisica: string
  let atividadeDeB: string

  const sql = <Registro extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Registro>(texto, valores)
  const get = async (sessao: TestSessao, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, await sessao.tokenNovo())
  const enviar = async (sessao: TestSessao, corpo: Record<string, unknown>): Promise<RespostaHttp> => chamar(api.url, 'POST', '/v1/tutor/mensagens', await sessao.tokenNovo(), { chaveEnvio: randomUUID(), ...corpo })
  const turno = async (sessao: TestSessao, texto: string, onde: Record<string, unknown> = {}): Promise<ExecucaoLida & { execucaoId: string }> => {
    const execucaoId = await dispararExecucao(api, sessao, '/v1/tutor/mensagens', { texto, ...onde })
    return { execucaoId, ...(await execucaoTerminada(api, sessao, execucaoId)) }
  }
  const naQuestao = (questao: number, atividadeAplicadaId: string = atividade) => ({ atividadeAplicadaId, questao })
  const usoPara = async (sessao: TestSessao, turmaId: string) => usoDoTutorResponseSchema.parse((await get(sessao, `/v1/tutor/uso?turmaId=${turmaId}`)).corpo)
  const linhaDe = (uso: Awaited<ReturnType<typeof usoPara>>, aluno: TestSessao) => uso.alunos.find((linha) => linha.aluno.id === aluno.usuarioId)
  /** Um aluno novo com vínculo confirmado na turma: cada caso usa o seu, para a contagem de um não somar na do outro. */
  const novoAluno = async (escola: EscolaComAssistente, turmaId: string = escola.turma, nome = `Aluno Sintético ${randomUUID().slice(0, 8)}`): Promise<TestSessao> => {
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
  /** O aluno sai do 2ºB e vai para o 2ºC, no mesmo ano: o vínculo antigo é encerrado (`realocacao`). */
  const transferir = async (escola: EscolaComAssistente, aluno: TestSessao) => {
    await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3 and papel = 'aluno'`, [escola.escolaId, aluno.usuarioId, escola.turma])
    await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [escola.escolaId, escola.anoLetivoId, aluno.usuarioId, escola.outraTurma, escola.coordenacao.usuarioId])
  }
  const suspender = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) => sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
  const retomar = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) =>
    sql('update suspensao_de_funcao set retomada_em = greatest(now(), suspensa_em), retomada_por = $3 where escola_id = $1 and funcao = $2 and retomada_em is null', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
  const execucaoDe = async (execucaoId: string) =>
    (await sql<{ estado: string; erro: string | null; resultado: unknown }>('select estado, erro, resultado from execucao_agente where escola_id = $1 and id = $2', [a.escolaId, execucaoId])).rows[0]

  /** O provedor que lança o código que o gateway lançaria: o worker grava `falhou` com ele, como em produção. */
  const falhandoCom = (codigo: LLMErrorCode): ModeloDeTeste => () => Promise.reject(new LLMError(codigo))
  /** Uma pergunta que o provedor, com o modelo dado, não deixa o Tutor responder. */
  const comModelo = async (aluno: TestSessao, modelo: ModeloDeTeste, onde: Record<string, unknown> = {}, texto = TEXTO_DA_PERGUNTA) => {
    const volta = fila.comModelo(modelo)
    try {
      return await turno(aluno, texto, onde)
    } finally {
      volta()
    }
  }
  const cortada = (aluno: TestSessao, codigo: LLMErrorCode, onde: Record<string, unknown> = {}, texto = TEXTO_DA_PERGUNTA) => comModelo(aluno, falhandoCom(codigo), onde, texto)
  /** A pergunta que o Tutor responde (o adaptador falso): a que entra em `trocasHoje`. */
  const respondida = async (aluno: TestSessao, onde: Record<string, unknown> = naQuestao(1)) => {
    const execucao = await turno(aluno, 'como eu começo a questão?', onde)
    expect(execucao.estado).toBe('concluida')
    return execucao
  }

  /**
   * Perguntas de hoje do aluno gravadas direto, cada uma com a execução `falhou` no código dado, na turma e no ano dados. `quando` fixa a hora da pergunta; sem ele, é agora (o relógio do banco).
   * O `id` da mensagem acompanha a hora, porque a consulta da última pergunta ordena por ele.
   */
  const semear = async (aluno: TestSessao, codigos: readonly string[], { escola = a, turmaId = escola.turma, anoLetivoId = escola.anoLetivoId, quando = null }: { escola?: EscolaComAssistente; turmaId?: string; anoLetivoId?: string; quando?: string | null } = {}) => {
    await sql(
      `with novas as (
         insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, estado, erro, entrada, concluida_em)
         select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, gen_random_uuid(), 'falhou', codigo, '{"tarefa":"turno_do_tutor"}', now() from unnest($4::text[]) as codigo returning id
       )
       insert into mensagem_tutor (id, escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto, criada_em)
       select uuidv7(coalesce($6::timestamptz, now()) - now()), $1, $2, $5, $3, id, 'aluno', 'Pergunta sintética sem resposta', coalesce($6::timestamptz, now()) from novas`,
      [escola.escolaId, anoLetivoId, aluno.usuarioId, [...codigos], turmaId, quando],
    )
  }

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor)
    api = fila.api
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    atividade = await aplicarAtividade(bancada, a)
    atividadeDeB = await aplicarAtividade(bancada, b)
    // Sem material da série na disciplina, o Tutor recusa antes de gravar: a Física também tem o dela.
    materialDeFisica = await enviarMaterialDeDemonstracao(api, a, a.fisica, 'Material de Física da turma', variacaoDoPdf())
    atividadeDeFisica = await aplicarAtividade(bancada, a, { disciplinaId: a.fisica, titulo: 'Lista de Física', aplicadaPor: a.deFisica.usuarioId })
    // A professora de Química também é professora do 2ºC: a turma antiga e a nova do aluno transferido são, as duas, dela.
    await vincularProfessor(bancada, a, a.professora.usuarioId, a.outraTurma, a.quimica)
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterEach(() => {
    fila.restaurar()
  })

  afterAll(async () => {
    await fila.ociosa()
    await fila.fechar()
    await medidor.encerrar()
    await bancada.fechar()
  })

  describe('a contagem', () => {
    it('duas cortadas e uma respondida: semRespostaHoje 2, trocasHoje 1, sem o texto da pergunta nem o código no DTO; o aluno que só teve pergunta cortada aparece', async () => {
      const marca = `quati${randomUUID().slice(0, 8)}`
      const ana = await novoAluno(a, a.turma, 'Ana Sintética Com Corte')
      const bia = await novoAluno(a, a.turma, 'Bia Sintética Só Cortada')
      await respondida(ana)
      await cortada(ana, 'IA_INDISPONIVEL', naQuestao(2), `${TEXTO_DA_PERGUNTA} ${marca}`)
      await cortada(ana, 'IA_SAIDA_INVALIDA', naQuestao(3))
      await cortada(bia, 'IA_INDISPONIVEL', naQuestao(1))

      const resposta = await get(a.professora, `/v1/tutor/uso?turmaId=${a.turma}`)
      const uso = usoDoTutorResponseSchema.parse(resposta.corpo)
      expect(linhaDe(uso, ana)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 2 })
      // A pergunta cortada é a última do aluno que só teve ela, e ele está na lista, com a referência dela.
      expect(linhaDe(uso, bia)).toMatchObject({ trocasHoje: 0, semRespostaHoje: 1, ultimaReferencia: { atividadeAplicadaId: atividade, questao: 1 } })
      // Só o número: nem o texto da pergunta, nem o código do erro, nem a execução.
      const cru = JSON.stringify(resposta.corpo)
      expect(cru).not.toContain(marca)
      expect(cru).not.toMatch(/IA_|ERRO_|EXECUCAO|execucao|pergunta|texto/)
      // A pergunta cortada fica na conversa (são três mensagens do aluno no banco); quem prova que o freio não a conta é o `trocasHoje: 1` acima.
      const { rows } = await sql<{ total: string }>(`select count(*)::text as total from mensagem_tutor where escola_id = $1 and aluno_id = $2 and autor = 'aluno'`, [a.escolaId, ana.usuarioId])
      expect(rows[0]?.total).toBe('3')
    })

    it.each<LLMErrorCode>(['IA_INDISPONIVEL', 'IA_TEMPO_ESGOTADO', 'IA_SAIDA_INVALIDA', 'PEDIDO_ACIMA_DO_TETO'])('%s no worker: a pergunta conta como sem resposta, e não como troca', async (codigo) => {
      const aluno = await novoAluno(a)
      const execucao = await cortada(aluno, codigo)
      expect(execucao).toMatchObject({ estado: 'falhou', erro: codigo })
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 0, semRespostaHoje: 1 })
    })

    it('a reentrega interrompida (EXECUCAO_INTERROMPIDA): o worker que morreu no meio deixa a pergunta sem resposta, e ela conta', async () => {
      const aluno = await novoAluno(a)
      const liberar = fila.segurar()
      let execucaoId: string
      try {
        const aceita = await enviar(aluno, { texto: TEXTO_DA_PERGUNTA, ...naQuestao(2) })
        expect(aceita.status).toBe(202)
        execucaoId = aceita.corpo['execucaoId'] as string
        // O worker pegou a execução e morreu: a entrega seguinte do mesmo job a encontra `rodando`.
        await sql(`update execucao_agente set estado = 'rodando', iniciada_em = now() where escola_id = $1 and id = $2 and estado = 'pendente'`, [a.escolaId, execucaoId])
        await fila.entregarDeNovo(execucaoId, a.escolaId)
      } finally {
        liberar()
      }
      await fila.ociosa()
      expect(await execucaoDe(execucaoId)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 0, semRespostaHoje: 1 })
    })

    it('a cortada e depois reenviada pelo "Tentar de novo" e respondida: a cortada conta, a reenviada entra em trocasHoje', async () => {
      const aluno = await novoAluno(a)
      await cortada(aluno, 'IA_INDISPONIVEL', naQuestao(1))
      await respondida(aluno, naQuestao(1))
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 1 })
    })
  })

  describe('a lista inteira de PASSAGEIROS', () => {
    it.each(PASSAGEIROS.map((codigo) => [codigo]))('%s, sem filtro nenhum: a pergunta conta, e o aluno só com ela aparece', async (codigo) => {
      const aluno = await novoAluno(a)
      await semear(aluno, [codigo])
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 0, semRespostaHoje: 1 })
    })

    it('uma de cada código da lista importada: a soma é o tamanho dela, ERRO_INTERNO e IA_ENTRADA_INVALIDA inclusive', async () => {
      const aluno = await novoAluno(a)
      await semear(aluno, PASSAGEIROS)
      expect(PASSAGEIROS).toEqual(expect.arrayContaining([ErrorCode.ERRO_INTERNO, ErrorCode.IA_ENTRADA_INVALIDA, ErrorCode.PEDIDO_ACIMA_DO_TETO]))
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 0, semRespostaHoje: PASSAGEIROS.length })
    })

    it('nenhum outro código de erro conta: com a pergunta respondida ao lado, o aluno aparece e a contagem fica em zero', async () => {
      const aluno = await novoAluno(a)
      await respondida(aluno)
      const outros = Object.values(ErrorCode).filter((codigo) => !PASSAGEIROS.includes(codigo))
      // O caso tem de valer para S12, a função suspensa e o inexistente, e para todo código que o catálogo tem.
      expect(outros).toEqual(expect.arrayContaining([ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO, ErrorCode.FUNCAO_SUSPENSA, ErrorCode.NAO_ENCONTRADO]))
      await semear(aluno, outros)
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 0 })
    })
  })

  describe('o dia, no fuso do uso (FUSO_DO_USO)', () => {
    const contar = (agora: string, aluno: TestSessao) =>
      comoPessoa(a, a.professora, 'professor', async () => (await new SupervisaoDoTutorRepository(bancada.banco, { agora: () => new Date(agora) }).semRespostaDeHoje(a.turma, [aluno.usuarioId])).get(aluno.usuarioId) ?? 0)

    it('às 10h de Brasília, a cortada ontem às 23h50 não conta, e as de hoje contam, a da meia-noite e cinco também', async () => {
      const aluno = await novoAluno(a)
      // Brasília é UTC-3: 23h50 de ontem é 02h50 UTC de hoje, o mesmo dia UTC em que são 10h.
      await semear(aluno, ['IA_INDISPONIVEL'], { quando: '2026-11-16T02:50:00Z' })
      await semear(aluno, ['IA_INDISPONIVEL'], { quando: '2026-11-14T15:00:00Z' })
      await semear(aluno, ['IA_INDISPONIVEL'], { quando: '2026-11-16T03:05:00Z' })
      await semear(aluno, ['IA_SAIDA_INVALIDA'], { quando: '2026-11-16T11:00:00Z' })
      expect(await contar('2026-11-16T13:00:00Z', aluno)).toBe(2)
    })

    it('no domingo, às 23h59 de Brasília (já segunda em UTC): vale o dia de Brasília, e a de sábado às 23h50 não conta', async () => {
      const aluno = await novoAluno(a)
      await semear(aluno, ['IA_INDISPONIVEL'], { quando: '2026-11-15T02:50:00Z' })
      await semear(aluno, ['IA_INDISPONIVEL'], { quando: '2026-11-15T03:01:00Z' })
      await semear(aluno, ['IA_TEMPO_ESGOTADO'], { quando: '2026-11-16T02:58:00Z' })
      expect(await contar('2026-11-16T02:59:00Z', aluno)).toBe(2)
    })
  })

  describe('o que não conta', () => {
    it('a avaliação que abre depois do 202 (S12): a pergunta não é troca nem é sem resposta', async () => {
      const aluno = await novoAluno(a)
      await respondida(aluno)
      const liberar = fila.segurar()
      let prova: string | undefined
      let execucaoId: string
      try {
        const aceita = await enviar(aluno, { texto: TEXTO_DA_PERGUNTA, ...naQuestao(2) })
        expect(aceita.status).toBe(202)
        execucaoId = aceita.corpo['execucaoId'] as string
        prova = await aplicarAtividade(bancada, a, { avaliativa: true, titulo: 'Prova que abriu no meio' })
      } finally {
        liberar()
      }
      try {
        await fila.ociosa()
        expect(await execucaoDe(execucaoId)).toEqual({ estado: 'falhou', erro: ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO, resultado: null })
      } finally {
        if (prova !== undefined) await encerrarAtividade(bancada, a, prova)
      }
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 0 })
    })

    it('a função suspensa depois do 202 (FUNCAO_SUSPENSA): a pergunta não conta', async () => {
      const aluno = await novoAluno(a)
      await respondida(aluno)
      const liberar = fila.segurar()
      let execucaoId: string
      try {
        const aceita = await enviar(aluno, { texto: TEXTO_DA_PERGUNTA, ...naQuestao(2) })
        expect(aceita.status).toBe(202)
        execucaoId = aceita.corpo['execucaoId'] as string
        await suspender(a, 'tutor_com_o_aluno')
      } finally {
        liberar()
      }
      try {
        await fila.ociosa()
        expect(await execucaoDe(execucaoId)).toEqual({ estado: 'falhou', erro: ErrorCode.FUNCAO_SUSPENSA, resultado: null })
      } finally {
        await retomar(a, 'tutor_com_o_aluno')
      }
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 0 })
    })

    it('o vínculo do aluno encerrado depois do 202 (NAO_ENCONTRADO): a pergunta não conta, mesmo com o aluno de volta à turma', async () => {
      const aluno = await novoAluno(a)
      await respondida(aluno)
      const liberar = fila.segurar()
      let execucaoId: string
      try {
        const aceita = await enviar(aluno, { texto: TEXTO_DA_PERGUNTA })
        expect(aceita.status).toBe(202)
        execucaoId = aceita.corpo['execucaoId'] as string
        await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3 and papel = 'aluno'`, [a.escolaId, aluno.usuarioId, a.turma])
      } finally {
        liberar()
      }
      await fila.ociosa()
      expect(await execucaoDe(execucaoId)).toEqual({ estado: 'falhou', erro: ErrorCode.NAO_ENCONTRADO, resultado: null })
      // De volta à turma, para a professora o ver: a cortada continua fora.
      await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [a.escolaId, a.anoLetivoId, aluno.usuarioId, a.turma, a.coordenacao.usuarioId])
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 0 })
    })

    it('a pergunta que recebeu a mensagem fixa (D36), com a execução já encerrada pela varredura: a mensagem fixa a respondeu, e ela não conta; a cortada de verdade ao lado dela conta', async () => {
      const aluno = await novoAluno(a)
      await respondida(aluno)
      // A outra pergunta do aluno, cortada de verdade, no mesmo dia: ela conta, e só a que recebeu a mensagem fixa fica de fora.
      await cortada(aluno, 'IA_INDISPONIVEL', naQuestao(3))
      // O modelo classifica o assunto como delicado, e a execução já terminou `falhou` quando o `concluir` chega: a mensagem fixa e o sinal ficam (transação própria).
      const encerradaPelaVarredura: ModeloDeTeste = async () => {
        await sql(`update execucao_agente set estado = 'falhou', erro = 'EXECUCAO_INTERROMPIDA', concluida_em = now() where escola_id = $1 and solicitada_por = $2 and estado = 'rodando'`, [a.escolaId, aluno.usuarioId])
        return { saida: { classificacao: 'assunto_delicado', resposta: MENSAGEM_DE_ASSUNTO_DELICADO, citacoes: [] } }
      }
      const execucao = await comModelo(aluno, encerradaPelaVarredura, naQuestao(2), 'lá em casa as coisas estão bem complicadas')
      expect(execucao).toMatchObject({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA })
      const { rows } = await sql<{ tipo: string }>(`select tipo from mensagem_tutor where escola_id = $1 and execucao_id = $2 and autor = 'tutor'`, [a.escolaId, execucao.execucaoId])
      expect(rows).toEqual([{ tipo: 'assunto_delicado' }])
      expect(PASSAGEIROS).toContain(ErrorCode.EXECUCAO_INTERROMPIDA)
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 1 })
    })
  })

  describe('o recorte da professora', () => {
    it('na mesma turma, a cortada em Física não aparece para a professora de Química, e a de Química não aparece para a de Física', async () => {
      const duplo = await novoAluno(a, a.turma, 'Aluno Sintético Dos Dois')
      const soDeFisica = await novoAluno(a, a.turma, 'Aluno Sintético Só de Física')
      await respondida(duplo, naQuestao(1))
      await cortada(duplo, 'IA_INDISPONIVEL', naQuestao(1, atividadeDeFisica))
      await cortada(soDeFisica, 'IA_INDISPONIVEL', naQuestao(1, atividadeDeFisica))
      // A pergunta sobre o material de Física, que não é atividade: a disciplina vem do material, e a de Química também não a vê.
      const soDeMaterialDeFisica = await novoAluno(a, a.turma, 'Aluno Sintético Material de Física')
      await cortada(soDeMaterialDeFisica, 'IA_INDISPONIVEL', { materialId: materialDeFisica, pagina: 1 })
      const deQuimica = await usoPara(a.professora, a.turma)
      const deFisica = await usoPara(a.deFisica, a.turma)
      // Química: o aluno que respondeu lá, sem a cortada de Física, e nem sinal de quem só tem Física.
      expect(linhaDe(deQuimica, duplo)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 0 })
      expect(linhaDe(deQuimica, soDeFisica)).toBeUndefined()
      expect(linhaDe(deQuimica, soDeMaterialDeFisica)).toBeUndefined()
      // Física: as duas cortadas dela.
      expect(linhaDe(deFisica, duplo)).toMatchObject({ semRespostaHoje: 1 })
      expect(linhaDe(deFisica, soDeFisica)).toMatchObject({ trocasHoje: 0, semRespostaHoje: 1 })
      expect(linhaDe(deFisica, soDeMaterialDeFisica)).toMatchObject({ trocasHoje: 0, semRespostaHoje: 1, ultimaReferencia: { materialId: materialDeFisica, pagina: 1 } })
    })

    it('a professora com Química e Física na mesma turma vê as cortadas das duas, e a de uma terceira disciplina não aparece', async () => {
      const turmaNova = (await chamar(api.url, 'POST', '/v1/turmas', await a.coordenacao.tokenNovo(), { serieId: a.serieId, nome: `2º${randomUUID().slice(0, 4)}` })).corpo['id'] as string
      const biologia = (await chamar(api.url, 'POST', '/v1/disciplinas', await a.coordenacao.tokenNovo(), { nome: `Biologia ${randomUUID().slice(0, 6)}` })).corpo['id'] as string
      for (const [professoraId, disciplinaId] of [[a.professora.usuarioId, a.quimica], [a.professora.usuarioId, a.fisica], [a.deFisica.usuarioId, biologia]] as const) {
        await vincularProfessor(bancada, a, professoraId, turmaNova, disciplinaId)
      }
      await enviarMaterialDeDemonstracao(api, a, biologia, 'Material de Biologia da turma nova', variacaoDoPdf())
      const deQuimica = await aplicarAtividade(bancada, a, { turmaId: turmaNova, titulo: 'Lista de Química da turma nova' })
      const deFisica = await aplicarAtividade(bancada, a, { turmaId: turmaNova, disciplinaId: a.fisica, titulo: 'Lista de Física da turma nova', aplicadaPor: a.deFisica.usuarioId })
      const deBiologia = await aplicarAtividade(bancada, a, { turmaId: turmaNova, disciplinaId: biologia, titulo: 'Lista de Biologia da turma nova', aplicadaPor: a.deFisica.usuarioId })
      const emQuimica = await novoAluno(a, turmaNova)
      const emFisica = await novoAluno(a, turmaNova)
      const emBiologia = await novoAluno(a, turmaNova)
      await cortada(emQuimica, 'IA_INDISPONIVEL', naQuestao(1, deQuimica))
      await cortada(emFisica, 'IA_SAIDA_INVALIDA', naQuestao(1, deFisica))
      await cortada(emBiologia, 'IA_INDISPONIVEL', naQuestao(1, deBiologia))
      const uso = await usoPara(a.professora, turmaNova)
      expect(linhaDe(uso, emQuimica)).toMatchObject({ semRespostaHoje: 1 })
      expect(linhaDe(uso, emFisica)).toMatchObject({ semRespostaHoje: 1 })
      expect(linhaDe(uso, emBiologia)).toBeUndefined()
    })

    it('o aluno transferido hoje: a cortada na turma antiga não aparece na turma nova, mesmo para a professora das duas', async () => {
      const aluno = await novoAluno(a)
      await cortada(aluno, 'IA_INDISPONIVEL', {})
      await transferir(a, aluno)
      await respondida(aluno, {})
      const naNova = await usoPara(a.professora, a.outraTurma)
      expect(linhaDe(naNova, aluno)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 0 })
      // Na turma de onde saiu ele já não está na lista, e a cortada não o traz de volta.
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toBeUndefined()
    })

    it('o ano anterior: a cortada de uma turma de 2025 não aparece no ano em curso, e no ano dela a mesma leitura a acha', async () => {
      const anterior = await montarAnoAnterior(bancada, a)
      const deAntes = { ...a, anoLetivoId: anterior.anoLetivoId }
      const aluno = await novoAluno(a)
      await semear(aluno, ['IA_INDISPONIVEL'], { turmaId: anterior.turmaId, anoLetivoId: anterior.anoLetivoId })
      const leitura = (escola: EscolaComAssistente) => comoPessoa(escola, a.professora, 'professor', () => new SupervisaoDoTutorRepository(bancada.banco).semRespostaDeHoje(anterior.turmaId, [aluno.usuarioId]))
      // O caso é real: no ano dela, a leitura acha a pergunta.
      expect((await leitura(deAntes)).get(aluno.usuarioId)).toBe(1)
      expect((await leitura(a)).size).toBe(0)
      // E pela rota: a turma de 2025 responde como a que não existe, e o aluno não aparece na turma de hoje.
      expect(await get(a.professora, `/v1/tutor/uso?turmaId=${anterior.turmaId}`)).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      expect(linhaDe(await usoPara(a.professora, a.turma), aluno)).toBeUndefined()
    })
  })

  describe('isolamento entre escolas', () => {
    it('a cortada de um aluno da escola B, com a professora da A: não aparece, o GET da turma de B responde como o inexistente, e a leitura do repository vem vazia', async () => {
      const deB = await novoAluno(b)
      const outroDeB = await novoAluno(b)
      await cortada(deB, 'IA_INDISPONIVEL', naQuestao(1, atividadeDeB))
      await cortada(outroDeB, 'IA_INDISPONIVEL', naQuestao(1, atividadeDeB))
      // A escola B vê a própria cortada: o caso é real.
      expect(linhaDe(await usoPara(b.professora, b.turma), deB)).toMatchObject({ trocasHoje: 0, semRespostaHoje: 1 })

      const daOutra = await get(a.professora, `/v1/tutor/uso?turmaId=${b.turma}`)
      const inexistente = await get(a.professora, `/v1/tutor/uso?turmaId=${randomUUID()}`)
      expect(daOutra).toMatchObject({ status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO' } } })
      expect(daOutra.status).toBe(inexistente.status)
      // E a cortada da B não traz o aluno da B para a lista da turma da A.
      expect(linhaDe(await usoPara(a.professora, a.turma), deB)).toBeUndefined()
      expect({ ...daOutra.corpo.erro, requisicaoId: undefined }).toEqual({ ...inexistente.corpo.erro, requisicaoId: undefined })
      // Todo id é da B, lido no contexto da A: só a cláusula de escola do repository o separa.
      const contagem = (escola: EscolaComAssistente, professora: TestSessao) => comoPessoa(escola, professora, 'professor', () => new SupervisaoDoTutorRepository(bancada.banco).semRespostaDeHoje(b.turma, [deB.usuarioId]))
      expect((await contagem(a, a.professora)).size).toBe(0)
      // O ano e a professora são da B, e só a escola do contexto é a da A: a cláusula de escola é a única que separa (o ano de cada escola e o vínculo da professora já separariam os outros casos).
      expect((await contagem({ ...b, escolaId: a.escolaId }, b.professora)).size).toBe(0)
      // Na B, só o aluno pedido: o outro aluno cortado da turma não entra na leitura que não o pediu.
      const daB = await contagem(b, b.professora)
      expect(daB.get(deB.usuarioId)).toBe(1)
      expect(daB.size).toBe(1)
    })

    it('sem aluno nenhum a ler, devolve vazio', async () => {
      const leitura = comoPessoa(a, a.professora, 'professor', () => new SupervisaoDoTutorRepository(bancada.banco).semRespostaDeHoje(a.turma, []))
      expect((await leitura).size).toBe(0)
    })
  })
})

describe('o worker de IA parado (a D62 não conferida, ou a fila sem consumidor): a professora vê as perguntas que o corte da espera deixou sem resposta', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let fila: FilaDeIa
  let a: EscolaComAssistente

  beforeAll(async () => {
    // Sem consumir: o job espera no outbox, como espera com o `worker-ia` que não confere a D62 e não cria o consumidor (8.0).
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, { semConsumir: true })
    api = fila.api
    a = await montarEscolaComAssistente(api, bancada)
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterAll(async () => {
    await fila.fechar()
    await medidor.encerrar()
    await bancada.fechar()
  })

  it('a pergunta cortada pelo GET da execução (IA_INDISPONIVEL, em PASSAGEIROS) conta: o professor vê o aluno sem resposta, e não a troca', async () => {
    const aluno = await bancada.sessao(a.escolaId, 'aluno')
    await bancada.pool.query(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [a.escolaId, a.anoLetivoId, aluno.usuarioId, a.turma, a.coordenacao.usuarioId])
    const aceita = await chamar(api.url, 'POST', '/v1/tutor/mensagens', await aluno.tokenNovo(), { chaveEnvio: randomUUID(), texto: TEXTO_DA_PERGUNTA })
    expect(aceita.status).toBe(202)
    const execucaoId = aceita.corpo['execucaoId'] as string
    // Com o worker parado, ninguém a pegou: a execução espera `pendente`, o Tutor ainda pode responder, e a pergunta ainda é uma troca, e não é sem resposta.
    const uso = async () => usoDoTutorResponseSchema.parse((await chamar(api.url, 'GET', `/v1/tutor/uso?turmaId=${a.turma}`, await a.professora.tokenNovo())).corpo)
    expect((await uso()).alunos.find((linha) => linha.aluno.id === aluno.usuarioId)).toMatchObject({ trocasHoje: 1, semRespostaHoje: 0 })
    // Passados os 20 s, o GET da própria pessoa corta a espera, sem modelo: `falhou` com o código que a tela mostra como "Tentar de novo".
    await bancada.pool.query(`update execucao_agente set criada_em = now() - make_interval(secs => 21) where escola_id = $1 and id = $2`, [a.escolaId, execucaoId])
    const lida = await chamar(api.url, 'GET', `/v1/execucoes/${execucaoId}`, await aluno.tokenNovo())
    expect(lida).toMatchObject({ status: 200, corpo: { estado: 'falhou', erro: 'IA_INDISPONIVEL' } })
    const { rows } = await bancada.pool.query<{ erro: string }>('select erro from execucao_agente where escola_id = $1 and id = $2', [a.escolaId, execucaoId])
    expect(PASSAGEIROS).toContain(rows[0]?.erro)
    expect((await uso()).alunos.find((linha) => linha.aluno.id === aluno.usuarioId)).toMatchObject({ trocasHoje: 0, semRespostaHoje: 1 })
  })
})
