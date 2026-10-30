import {
  contextoAtual,
  executarNoContexto,
  ErroDeDominio,
  ErroDeIa,
  EXECUCAO_INTERROMPIDA,
  gerarAtividadeObjetiva,
  justificativaSemEscopo,
  mensagemAgente,
  mensagemTutor,
  proporFerramenta,
  threadAgente,
  turnoDoTutor,
  type ConsultaDeOrcamento,
  type ConsumoDeIa,
  type ContextoDaRequisicao,
  type ExecutorNoProcesso,
  type LLMProvider,
  type OrcamentoDeIa,
  type SuspensaoDeFuncao,
  type TransacaoBanco,
} from '@educa/nucleo'
import { ErrorCode, execucaoResponseSchema, TROCAS_POR_DIA_PADRAO_DO_TUTOR, type ChaveDeFuncao, type PapelDeUsuario, type ResultadoGravado } from '@educa/shared'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from '../../test/api-com-sessao.js'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-com-turma.js'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../test/sessao-de-teste.js'
import { AgendadorDeExecucoes, type PedidoDeExecucao } from './agendador-de-execucoes.js'
import { ConferenciaDeFuncao } from './conferencia-de-funcao.js'
import { ConsumoRepository } from './consumo.repository.js'
import { ExecucaoDaSessaoRepository, ExecucaoRepository } from './execucao.repository.js'
import { EXECUTOR_DE_AGENTE, LLM_PROVIDER, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO } from './ia.module.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { SuspensaoRepository } from './suspensao.repository.js'

/**
 * A camada de IA ligada ao banco e à API (MVP, fase 1): as quatro portas em Postgres, o `GET /v1/execucoes/:id` e o
 * `AgendadorDeExecucoes`, com a API montada pelo `AppModule` e o adaptador falso, que é o padrão.
 *
 * Cada caso de isolamento tem, na escola B, a linha que a consulta da escola A alcançaria se a cláusula de escola
 * saísse do repository (regra 10, item 5).
 */
describe('camada de IA na API', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  let agendador: AgendadorDeExecucoes
  let executor: ExecutorNoProcesso

  interface Escola extends EscolaComTurma {
    readonly escolaId: string
    readonly professor: SessaoDeTeste
    readonly outroProfessor: SessaoDeTeste
    readonly aluno: SessaoDeTeste
    readonly outroAluno: SessaoDeTeste
  }
  let a: Escola
  let b: Escola

  const sql = (texto: string, valores: unknown[] = []) => bancada.pool.query(texto, valores)
  const get = (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)

  async function montarEscola(): Promise<Escola> {
    const escola = await montarEscolaComTurma(api, bancada)
    const { escolaId } = escola.coordenacao
    const [professor, outroProfessor] = await bancada.sessoes(escolaId, { papel: 'professor', quantidade: 2 })
    const [aluno, outroAluno] = await bancada.sessoes(escolaId, { papel: 'aluno', quantidade: 2 })
    if (professor === undefined || outroProfessor === undefined || aluno === undefined || outroAluno === undefined) throw new Error('sessões de teste não criadas')
    for (const estudante of [aluno, outroAluno]) {
      await sql(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
        [escolaId, escola.anoLetivoId, estudante.usuarioId, escola.turma, escola.coordenacao.usuarioId],
      )
    }
    return { ...escola, escolaId, professor, outroProfessor, aluno, outroAluno }
  }

  /** O contexto que a `GuardaDeSessao` gravaria para esta pessoa: é nele que o serviço roda, como numa rota. */
  const contextoDe = (escola: Escola, sessao: SessaoDeTeste, papel: PapelDeUsuario): ContextoDaRequisicao => ({
    requisicaoId: randomUUID(),
    escolaId: escola.escolaId,
    usuarioId: sessao.usuarioId,
    papel,
    sessaoId: sessao.sessaoId,
    anoLetivoId: escola.anoLetivoId,
  })
  const como = <T>(escola: Escola, sessao: SessaoDeTeste, papel: PapelDeUsuario, funcao: () => T): T => executarNoContexto(contextoDe(escola, sessao, papel), funcao)
  /** Só a escola, sem pessoa: o contexto que as portas de IA leem, a escola de quem pede (8.0). */
  const noContextoDe = <T>(escola: Escola, funcao: () => T): T => executarNoContexto({ requisicaoId: randomUUID(), escolaId: escola.escolaId }, funcao)

  interface ExecucaoGravada {
    readonly id: string
    readonly estado: string
    readonly erro: string | null
    readonly resultado: unknown
    readonly concluida_em: Date | null
    readonly iniciada_em: Date | null
  }
  async function execucaoNoBanco(id: string): Promise<ExecucaoGravada> {
    const { rows } = await sql('select id, estado, erro, resultado, concluida_em, iniciada_em from execucao_agente where id = $1', [id])
    const [linha] = rows as ExecucaoGravada[]
    if (linha === undefined) throw new Error('execução não encontrada')
    return linha
  }
  const contar = async (tabela: string, escolaId: string, filtro = 'true'): Promise<number> =>
    Number(((await sql(`select count(*) as total from ${tabela} where escola_id = $1 and ${filtro}`, [escolaId])).rows as { total: string }[])[0]?.total)

  /** Uma execução pendente gravada à mão, como o `POST` de um pacote de domínio a deixaria. */
  async function execucaoPendente(escola: Escola, de: SessaoDeTeste, tarefa = 'gerar_atividade_objetiva', funcao: ChaveDeFuncao = 'conversa_e_ferramentas'): Promise<{ id: string; escolaId: string; chave: string }> {
    const chave = randomUUID()
    const entrada = tarefa === 'gerar_atividade_objetiva' ? { tarefa, parametros: { turmaId: escola.turma, disciplinaId: escola.quimica, tema: 'estequiometria' } } : { tarefa }
    const { rows } = await sql('insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
      escola.escolaId,
      escola.anoLetivoId,
      funcao,
      tarefa,
      de.usuarioId,
      chave,
      JSON.stringify(entrada),
    ])
    return { id: (rows as { id: string }[])[0]?.id ?? '', escolaId: escola.escolaId, chave }
  }

  /** `quantidade` perguntas do aluno ao Tutor hoje, cada uma com a execução dela, ainda não respondida. */
  async function perguntasAoTutor(escola: Escola, aluno: SessaoDeTeste, quantidade: number): Promise<string[]> {
    const { rows } = await sql(
      `with novas as (
         insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
         select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, gen_random_uuid(), '{"tarefa":"turno_do_tutor"}' from generate_series(1, $5) returning id
       )
       insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto)
       select $1, $2, $4, $3, id, 'aluno', 'pergunta sintética' from novas returning execucao_id`,
      [escola.escolaId, escola.anoLetivoId, aluno.usuarioId, escola.turma, quantidade],
    )
    return (rows as { execucao_id: string }[]).map((linha) => linha.execucao_id)
  }

  /** O pedido que o pacote do Assistente faria para a mensagem de um professor: grava a mensagem dele e, ao concluir, a do agente. */
  function pedidoDoAssistente(escola: Escola, opcoes: { chaveEnvio?: string; texto?: string; aoConcluir?: (tx: TransacaoBanco) => Promise<void> } = {}) {
    const aoGravar = vi.fn(async (tx: TransacaoBanco, execucaoId: string) => {
      const dono = { escolaId: escola.escolaId, anoLetivoId: escola.anoLetivoId, usuarioId: contextoAtual()?.usuarioId ?? '' }
      await tx.insert(threadAgente).values({ ...dono, agente: 'assistente_de_ensino' }).onConflictDoNothing()
      const [thread] = await tx
        .select({ id: threadAgente.id })
        .from(threadAgente)
        .where(and(eq(threadAgente.escolaId, dono.escolaId), eq(threadAgente.anoLetivoId, dono.anoLetivoId), eq(threadAgente.usuarioId, dono.usuarioId), eq(threadAgente.agente, 'assistente_de_ensino')))
      await tx.insert(mensagemAgente).values({
        escolaId: escola.escolaId,
        anoLetivoId: escola.anoLetivoId,
        threadId: thread?.id ?? '',
        execucaoId,
        autor: 'usuario',
        conteudo: { tipo: 'texto', texto: opcoes.texto ?? 'monta uma atividade com 5 questões sobre reagente limitante' },
        turmaId: escola.turma,
        disciplinaId: escola.quimica,
      })
    })
    const aoConcluir = vi.fn(async (saida: Awaited<ReturnType<typeof proporFerramenta.falso>>, tx: TransacaoBanco, execucaoId: string): Promise<ResultadoGravado> => {
      await opcoes.aoConcluir?.(tx)
      const [pergunta] = await tx
        .select({ threadId: mensagemAgente.threadId })
        .from(mensagemAgente)
        .where(and(eq(mensagemAgente.escolaId, escola.escolaId), eq(mensagemAgente.execucaoId, execucaoId), eq(mensagemAgente.autor, 'usuario')))
      // A turma e a disciplina, quem acrescenta à proposta é o Assistente: o modelo não conhece id.
      const conteudo = saida.tipo === 'texto' ? saida : { ...saida, proposta: { ...saida.proposta, parametros: { ...saida.proposta.parametros, turmaId: escola.turma, disciplinaId: escola.quimica } } }
      const [mensagem] = await tx
        .insert(mensagemAgente)
        .values({ escolaId: escola.escolaId, anoLetivoId: escola.anoLetivoId, threadId: pergunta?.threadId ?? '', execucaoId, autor: 'agente', conteudo })
        .returning({ id: mensagemAgente.id })
      return { tipo: 'mensagem', mensagemId: mensagem?.id ?? '' }
    })
    const contextoVisto: (ContextoDaRequisicao | undefined)[] = []
    const pedido: PedidoDeExecucao<Parameters<typeof proporFerramenta.falso>[0], Awaited<ReturnType<typeof proporFerramenta.falso>>> = {
      tarefa: proporFerramenta,
      chaveEnvio: opcoes.chaveEnvio ?? randomUUID(),
      entradaDaExecucao: { tarefa: 'propor_ferramenta' },
      entrada: async () => {
        contextoVisto.push(contextoAtual())
        return { mensagem: opcoes.texto ?? 'monta uma atividade com 5 questões sobre reagente limitante', contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], turnosAnteriores: [] }
      },
      aoGravar,
      aoConcluir,
    }
    return { pedido, aoGravar, aoConcluir, contextoVisto }
  }

  /** O pedido que o pacote do Tutor faria para a pergunta de um aluno. */
  function pedidoDoTutor(escola: Escola, aluno: SessaoDeTeste, duvida: string) {
    const aoConcluir = vi.fn(async (saida: Awaited<ReturnType<typeof turnoDoTutor.falso>>, tx: TransacaoBanco, execucaoId: string): Promise<ResultadoGravado> => {
      const [mensagem] = await tx
        .insert(mensagemTutor)
        .values({
          escolaId: escola.escolaId,
          anoLetivoId: escola.anoLetivoId,
          turmaId: escola.turma,
          alunoId: aluno.usuarioId,
          execucaoId,
          autor: 'tutor',
          tipo: saida.classificacao === 'assunto_delicado' ? 'assunto_delicado' : 'texto',
          texto: saida.resposta,
          ...(saida.classificacao === 'assunto_delicado' ? {} : { citacoes: saida.citacoes }),
        })
        .returning({ id: mensagemTutor.id })
      return { tipo: 'mensagem_do_tutor', mensagemId: mensagem?.id ?? '' }
    })
    const pedido: PedidoDeExecucao<Parameters<typeof turnoDoTutor.falso>[0], Awaited<ReturnType<typeof turnoDoTutor.falso>>> = {
      tarefa: turnoDoTutor,
      chaveEnvio: randomUUID(),
      entradaDaExecucao: { tarefa: 'turno_do_tutor' },
      entrada: { duvida, contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], memoria: [], turnosAnteriores: [] },
      alunoId: aluno.usuarioId,
      turmaId: escola.turma,
      aoGravar: async (tx, execucaoId) => {
        await tx.insert(mensagemTutor).values({ escolaId: escola.escolaId, anoLetivoId: escola.anoLetivoId, turmaId: escola.turma, alunoId: aluno.usuarioId, execucaoId, autor: 'aluno', texto: duvida })
      },
      aoConcluir,
    }
    return { pedido, aoConcluir }
  }

  async function erroDe(promessa: Promise<unknown>): Promise<ErroDeDominio> {
    const erro: unknown = await promessa.then(
      () => undefined,
      (motivo: unknown) => motivo,
    )
    if (!(erro instanceof ErroDeDominio)) throw new Error('a chamada deveria ter falhado com erro de domínio', { cause: erro })
    return erro
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    agendador = api.app.get(AgendadorDeExecucoes)
    executor = api.app.get<ExecutorNoProcesso>(EXECUTOR_DE_AGENTE)
    a = await montarEscola()
    b = await montarEscola()
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    // A limpeza da bancada ainda não conhece as tabelas do MVP, que apontam para a turma e para o ano letivo: o que
    // este arquivo gravou nelas sai antes, do que aponta para o que é apontado.
    const escolas = [a.escolaId, b.escolaId]
    for (const tabela of ['consumo_ia', 'mensagem_tutor', 'mensagem_agente', 'thread_agente', 'suspensao_de_funcao', 'execucao_agente', 'configuracao_operacional_escola']) {
      await sql(`delete from ${tabela} where escola_id = any($1::uuid[])`, [escolas])
    }
    await bancada.fechar()
  })

  describe('ExecucaoRepository: a execução só é marcada com a escola dela', () => {
    it('com o id da execução de B e a escola A, nada é marcado; com a escola de B, a mesma chamada marca', async () => {
      const execucoes = new ExecucaoRepository(bancada.banco)
      const deB = await execucaoPendente(b, b.professor)
      const comEscolaErrada = { ...deB, escolaId: a.escolaId }

      expect(await execucoes.marcarRodando(comEscolaErrada)).toBe(false)
      expect((await execucaoNoBanco(deB.id)).estado).toBe('pendente')
      expect(await execucoes.marcarRodando(deB)).toBe(true)
      expect((await execucaoNoBanco(deB.id)).iniciada_em).toBeInstanceOf(Date)

      const resultado = { tipo: 'artefato', artefatoId: randomUUID(), entregaId: null } as const
      await execucoes.marcarFalhou(comEscolaErrada, 'IA_INDISPONIVEL')
      await execucoes.marcarConcluida(comEscolaErrada, resultado)
      expect(await execucoes.concluirRodando(comEscolaErrada, resultado)).toBe(false)
      expect((await execucaoNoBanco(deB.id)).estado).toBe('rodando')

      await execucoes.marcarConcluida(deB, resultado)
      const concluida = await execucaoNoBanco(deB.id)
      expect(concluida).toMatchObject({ estado: 'concluida', resultado, erro: null })
      expect(concluida.concluida_em).toBeInstanceOf(Date)
    })

    it('a passagem é uma só: a segunda instância que tenta pegar a mesma execução não pega, e a terminada não volta a rodar', async () => {
      const execucoes = new ExecucaoRepository(bancada.banco)
      const execucao = await execucaoPendente(a, a.professor)
      const pegaram = await Promise.all(Array.from({ length: 5 }, () => execucoes.marcarRodando(execucao)))
      expect(pegaram.filter(Boolean)).toHaveLength(1)
      await execucoes.marcarFalhou(execucao, 'IA_TEMPO_ESGOTADO')
      const falha = await execucaoNoBanco(execucao.id)
      expect(falha).toMatchObject({ estado: 'falhou', erro: 'IA_TEMPO_ESGOTADO', resultado: null })
      expect(falha.concluida_em).toBeInstanceOf(Date)
      expect(await execucoes.marcarRodando(execucao)).toBe(false)
      // O resultado que chega depois da falha não ressuscita a execução.
      await execucoes.marcarConcluida(execucao, { tipo: 'artefato', artefatoId: randomUUID(), entregaId: null })
      expect((await execucaoNoBanco(execucao.id)).estado).toBe('falhou')
    })

    it('o resultado é só referência: texto no lugar dela não é gravado', async () => {
      const execucoes = new ExecucaoRepository(bancada.banco)
      const execucao = await execucaoPendente(a, a.professor)
      await execucoes.marcarRodando(execucao)
      await expect(execucoes.marcarConcluida(execucao, { tipo: 'mensagem', texto: 'a resposta inteira do Assistente' })).rejects.toThrow()
      expect((await execucaoNoBanco(execucao.id)).estado).toBe('rodando')
      await execucoes.marcarFalhou(execucao, 'ERRO_INTERNO')
    })

    it('a única consulta entre escolas é a varredura, marcada @SemEscopo com a justificativa', () => {
      const metodos = Object.getOwnPropertyNames(ExecucaoRepository.prototype).filter((metodo) => metodo !== 'constructor')
      expect(metodos.filter((metodo) => justificativaSemEscopo(ExecucaoRepository, metodo) !== undefined)).toEqual(['falharInterrompidas'])
      expect(justificativaSemEscopo(ExecucaoRepository, 'falharInterrompidas')).toMatch(/^varredura da subida da API: /)
    })
  })

  describe('ExecucaoDaSessaoRepository: só quem pediu lê', () => {
    it('a execução de outra escola, e a de outra pessoa da mesma escola, não são achadas pelo id nem pela chave', async () => {
      const deB = await execucaoPendente(b, b.professor)
      const doColega = await execucaoPendente(a, a.outroProfessor)
      const minha = await execucaoPendente(a, a.professor)
      await como(a, a.professor, 'professor', async () => {
        const execucoes = new ExecucaoDaSessaoRepository(bancada.banco)
        expect(await execucoes.deQuemPediu(deB.id)).toBeUndefined()
        expect(await execucoes.daChave(deB.chave)).toBeUndefined()
        expect(await execucoes.deQuemPediu(doColega.id)).toBeUndefined()
        expect(await execucoes.daChave(doColega.chave)).toBeUndefined()
        expect(await execucoes.deQuemPediu(minha.id)).toMatchObject({ id: minha.id, estado: 'pendente', tarefa: 'gerar_atividade_objetiva' })
        expect(await execucoes.daChave(minha.chave)).toEqual({ id: minha.id, tarefa: 'gerar_atividade_objetiva' })
      })
    })

    it('a mesma chave de envio em escolas diferentes são execuções diferentes, cada uma na sua', async () => {
      const chave = randomUUID()
      const naA = await como(a, a.professor, 'professor', () => new ExecucaoDaSessaoRepository(bancada.banco).gravarPendente('propor_ferramenta', chave, { tarefa: 'propor_ferramenta' }))
      const naB = await como(b, b.professor, 'professor', () => new ExecucaoDaSessaoRepository(bancada.banco).gravarPendente('propor_ferramenta', chave, { tarefa: 'propor_ferramenta' }))
      expect(naA).toBeDefined()
      expect(naB).toBeDefined()
      expect(naA).not.toBe(naB)
      // Na mesma escola, a chave repetida não grava de novo.
      expect(await como(a, a.outroProfessor, 'professor', () => new ExecucaoDaSessaoRepository(bancada.banco).gravarPendente('propor_ferramenta', chave, { tarefa: 'propor_ferramenta' }))).toBeUndefined()
    })
  })

  describe('SuspensaoRepository: a suspensão de uma escola não vale na outra', () => {
    const suspender = (escola: Escola, funcao: ChaveDeFuncao) =>
      sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
    const retomar = (escola: Escola, funcao: ChaveDeFuncao) =>
      sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $3 where escola_id = $1 and funcao = $2 and retomada_em is null', [escola.escolaId, funcao, escola.coordenacao.usuarioId])

    it('função suspensa em B: suspensa em B, ativa em A; outra função de B continua ativa; retomada, volta a ficar ativa', async () => {
      const suspensao = new SuspensaoRepository(bancada.banco)
      await suspender(b, 'adaptacao')
      try {
        expect(await noContextoDe(b, () => suspensao.estaSuspensa('adaptacao'))).toBe(true)
        expect(await noContextoDe(a, () => suspensao.estaSuspensa('adaptacao'))).toBe(false)
        expect(await noContextoDe(b, () => suspensao.estaSuspensa('correcao_de_objetiva'))).toBe(false)
      } finally {
        await retomar(b, 'adaptacao')
      }
      expect(await noContextoDe(b, () => suspensao.estaSuspensa('adaptacao'))).toBe(false)
    })

    it('sem escola no contexto, lança antes de ler: nem a suspensão da escola B responde por ninguém', async () => {
      await suspender(b, 'adaptacao')
      try {
        const suspensao = new SuspensaoRepository(bancada.banco)
        await expect(suspensao.estaSuspensa('adaptacao')).rejects.toThrow('consulta com escopo sem escola no contexto')
        await expect(executarNoContexto({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => suspensao.estaSuspensa('adaptacao'))).rejects.toThrow('consulta com escopo sem escola no contexto')
      } finally {
        await retomar(b, 'adaptacao')
      }
    })

    it('função suspensa recusa antes de gravar: nenhuma execução, nenhum consumo, e o que o pacote gravaria não é gravado', async () => {
      await suspender(a, 'conversa_e_ferramentas')
      try {
        const execucoesAntes = await contar('execucao_agente', a.escolaId)
        const consumoAntes = await contar('consumo_ia', a.escolaId)
        const { pedido, aoGravar, aoConcluir } = pedidoDoAssistente(a)
        const erro = await erroDe(como(a, a.professor, 'professor', () => agendador.agendar(pedido)))
        expect(erro).toMatchObject({ codigo: ErrorCode.FUNCAO_SUSPENSA, status: 409 })
        await executor.ociosa()
        expect(aoGravar).not.toHaveBeenCalled()
        expect(aoConcluir).not.toHaveBeenCalled()
        expect(await contar('execucao_agente', a.escolaId)).toBe(execucoesAntes)
        expect(await contar('consumo_ia', a.escolaId)).toBe(consumoAntes)

        // Pela porta, direto, a recusa é a mesma e também não grava consumo.
        const ia = api.app.get<LLMProvider>(LLM_PROVIDER)
        const direto = await erroDe(
          noContextoDe(a, () => ia.gerar({ tarefa: proporFerramenta, escolaId: a.escolaId, entrada: { mensagem: 'bom dia', contexto: { serie: '2º ano', disciplina: 'Química' }, trechos: [], turnosAnteriores: [] } })),
        )
        expect(direto.codigo).toBe(ErrorCode.FUNCAO_SUSPENSA)
        expect(await contar('consumo_ia', a.escolaId)).toBe(consumoAntes)

        // A mesma função na escola B executa, e outra função na escola A também.
        const naB = pedidoDoAssistente(b)
        await como(b, b.professor, 'professor', () => agendador.agendar(naB.pedido))
        await executor.ociosa()
        expect(naB.aoConcluir).toHaveBeenCalledTimes(1)
        await expect(como(a, a.coordenacao, 'coordenador', () => api.app.get(ConferenciaDeFuncao).exigirAtiva('correcao_de_objetiva'))).resolves.toBeUndefined()
        expect((await erroDe(como(a, a.coordenacao, 'coordenador', () => api.app.get(ConferenciaDeFuncao).exigirAtiva('conversa_e_ferramentas')))).codigo).toBe(ErrorCode.FUNCAO_SUSPENSA)
      } finally {
        await retomar(a, 'conversa_e_ferramentas')
      }
      expect(await noContextoDe(a, () => api.app.get<SuspensaoDeFuncao>(SUSPENSAO_DE_FUNCAO).estaSuspensa('conversa_e_ferramentas'))).toBe(false)
    })
  })

  describe('ConsumoRepository: o consumo fica na escola de quem gastou', () => {
    // Sem `escolaId`: o registro fica na escola do contexto em que é gravado (`registrarEm`), e o tipo não aceita outra.
    const consumoDe = (extra: Record<string, unknown> = {}) => ({
      tarefa: 'gerar_atividade_objetiva' as const,
      funcao: 'conversa_e_ferramentas' as const,
      perfil: 'padrao' as const,
      origem: 'falso' as const,
      modelo: 'falso-deterministico',
      promptVersao: '2026-10-04.1',
      tokensDeEntrada: 120,
      tokensDeSaida: 80,
      duracaoMs: 15,
      envioExterno: false as const,
      provedorId: null,
      tentativas: 1,
      estado: 'concluida' as const,
      entrada: { tema: 'estequiometria' },
      saida: { tipo: 'atividade_objetiva' },
      em: new Date(),
      ...extra,
    })

    const registrarEm = (escola: Escola, consumo: ConsumoDeIa, repositorio = new ConsumoRepository(bancada.banco)) => noContextoDe(escola, () => repositorio.registrar(consumo))

    it('grava na escola do contexto, e a outra escola não ganha linha', async () => {
      const [antesA, antesB] = [await contar('consumo_ia', a.escolaId), await contar('consumo_ia', b.escolaId)]
      // B primeiro: a tabela já tem uma linha de outra escola quando A grava, e a gravação que errasse de escola a acharia.
      await registrarEm(b, consumoDe())
      expect(await contar('consumo_ia', b.escolaId)).toBe(antesB + 1)
      await registrarEm(a, consumoDe())
      expect(await contar('consumo_ia', a.escolaId)).toBe(antesA + 1)
      expect(await contar('consumo_ia', b.escolaId)).toBe(antesB + 1)
    })

    it('sem escola no contexto, lança antes de gravar: nenhuma linha em escola nenhuma', async () => {
      const antes = [await contar('consumo_ia', a.escolaId), await contar('consumo_ia', b.escolaId)]
      const repositorio = new ConsumoRepository(bancada.banco)
      await expect(repositorio.registrar(consumoDe())).rejects.toThrow('consulta com escopo sem escola no contexto')
      await expect(executarNoContexto({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => repositorio.registrar(consumoDe()))).rejects.toThrow('consulta com escopo sem escola no contexto')
      expect([await contar('consumo_ia', a.escolaId), await contar('consumo_ia', b.escolaId)]).toEqual(antes)
    })

    it('grava o provedor de quem recebeu o conteúdo, e nulo onde nada saiu; as quatro formas válidas entram, e o par inválido o tipo da porta e o check do banco já barram', async () => {
      const repositorio = new ConsumoRepository(bancada.banco)
      const modelo = `modelo-${randomUUID()}`
      const externo = { ...consumoDe(), modelo, envioExterno: true as const, provedorId: 'provedor-de-teste' }
      const chamadas: ConsumoDeIa[] = [
        externo,
        // O que falhou depois de sair também deixa o rastro do provedor.
        { ...externo, provedorId: 'outro-provedor', origem: 'openai_compat', estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL' },
        // Local, adaptador falso e regra fixa: nada saiu, e a linha entra como sempre entrou.
        { ...consumoDe(), modelo },
        { ...consumoDe(), modelo, origem: 'regra_fixa', tentativas: 0 },
      ]
      for (const chamada of chamadas) await expect(registrarEm(a, chamada, repositorio)).resolves.toBeUndefined()
      const { rows } = await sql('select provedor, envio_externo from consumo_ia where escola_id = $1 and modelo = $2 order by provedor nulls last', [a.escolaId, modelo])
      expect(rows).toEqual([
        { provedor: 'outro-provedor', envio_externo: true },
        { provedor: 'provedor-de-teste', envio_externo: true },
        { provedor: null, envio_externo: false },
        { provedor: null, envio_externo: false },
      ])
    })

    it('o consumo de A não aponta para execução de B: o banco recusa', async () => {
      const deB = await execucaoPendente(b, b.professor)
      await expect(registrarEm(a, consumoDe({ execucaoId: deB.id }))).rejects.toThrow()
      const daA = await execucaoPendente(a, a.professor)
      await expect(registrarEm(a, consumoDe({ execucaoId: daA.id }))).resolves.toBeUndefined()
    })

    it('nas funções do Tutor, entrada e saída só entram nulas: texto de aluno não se duplica na tabela de métrica', async () => {
      const doTutor = { tarefa: 'turno_do_tutor' as const, funcao: 'tutor_com_o_aluno' as const, perfil: 'rapido' as const, alunoId: a.aluno.usuarioId }
      await expect(registrarEm(a, consumoDe(doTutor))).rejects.toThrow()
      await expect(registrarEm(a, consumoDe({ ...doTutor, entrada: undefined, saida: undefined }))).resolves.toBeUndefined()
    })
  })

  describe('OrcamentoRepository: o freio diário do Tutor', () => {
    const consulta = (escola: Escola, aluno: SessaoDeTeste) => ({ funcao: 'tutor_com_o_aluno' as const, alunoId: aluno.usuarioId, turmaId: escola.turma })
    /** A consulta feita no contexto da escola: é de lá que a porta lê a escola, e a consulta não a traz (8.0). */
    const consultarEm = (escola: Escola, orcamento: OrcamentoDeIa, pergunta: ConsultaDeOrcamento) => noContextoDe(escola, () => orcamento.consultar(pergunta))

    it('recusa a 61ª troca do aluno no dia, e não a de outro aluno; a pergunta que falhou não conta', async () => {
      const orcamento = api.app.get<OrcamentoDeIa>(ORCAMENTO_DE_IA)
      const perguntas = await perguntasAoTutor(a, a.aluno, TROCAS_POR_DIA_PADRAO_DO_TUTOR - 1)
      // Com 59 perguntas no dia, a 60ª ainda cabe.
      expect(await consultarEm(a, orcamento, consulta(a, a.aluno))).toEqual({ permitido: true })
      perguntas.push(...(await perguntasAoTutor(a, a.aluno, 1)))
      // Com 60, a 61ª é recusada, com o código do freio do dia.
      expect(await consultarEm(a, orcamento, consulta(a, a.aluno))).toEqual({ permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' })
      // O colega da mesma turma continua perguntando.
      expect(await consultarEm(a, orcamento, consulta(a, a.outroAluno))).toEqual({ permitido: true })

      // De dentro da execução da 60ª pergunta, ela mesma não conta contra si.
      expect(await consultarEm(a, orcamento, { ...consulta(a, a.aluno), execucaoId: perguntas.at(-1) ?? '' })).toEqual({ permitido: true })

      // A 61ª, agendada assim mesmo, falha com o código do freio, sem resposta e sem consumo de modelo.
      const { pedido, aoConcluir } = pedidoDoTutor(a, a.aluno, 'como eu acho o reagente limitante?')
      const { execucaoId } = await como(a, a.aluno, 'aluno', () => agendador.agendar(pedido))
      await executor.ociosa()
      expect(await execucaoNoBanco(execucaoId)).toMatchObject({ estado: 'falhou', erro: 'LIMITE_DIARIO_DO_TUTOR' })
      expect(aoConcluir).not.toHaveBeenCalled()

      // A pergunta que o modelo não respondeu não gasta o dia: a falha devolve a vez.
      await sql(`update execucao_agente set estado = 'falhou', erro = 'IA_INDISPONIVEL', concluida_em = now() where escola_id = $1 and id = $2`, [a.escolaId, perguntas[0]])
      expect(await consultarEm(a, orcamento, consulta(a, a.aluno))).toEqual({ permitido: true })
    })

    it('o limite é o da configuração da escola, quando ela tem', async () => {
      await sql('insert into configuracao_operacional_escola (escola_id, tutor_trocas_por_dia) values ($1, 2) on conflict (escola_id) do update set tutor_trocas_por_dia = 2', [b.escolaId])
      const orcamento = new OrcamentoRepository(bancada.banco)
      await perguntasAoTutor(b, b.aluno, 1)
      expect(await consultarEm(b, orcamento, consulta(b, b.aluno))).toEqual({ permitido: true })
      await perguntasAoTutor(b, b.aluno, 1)
      expect(await consultarEm(b, orcamento, consulta(b, b.aluno))).toEqual({ permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' })
    })

    it('as perguntas de um aluno de B não contam na escola A, nem com o id dele', async () => {
      // Um aluno de B com duas perguntas hoje e o limite de duas nas duas escolas: se a contagem de A alcançasse as linhas
      // de B, a consulta de A, com o id dele, seria recusada. O teste monta o próprio aluno e tira as perguntas no fim, para
      // valer sozinho e não mexer na conta do pacote do caso seguinte.
      const [alunoDeB] = await bancada.sessoes(b.escolaId, { papel: 'aluno', quantidade: 1 })
      if (alunoDeB === undefined) throw new Error('aluno de teste não criado')
      for (const escola of [a, b]) {
        await sql('insert into configuracao_operacional_escola (escola_id, tutor_trocas_por_dia) values ($1, 2) on conflict (escola_id) do update set tutor_trocas_por_dia = 2', [escola.escolaId])
      }
      await perguntasAoTutor(b, alunoDeB, 2)
      const orcamento = new OrcamentoRepository(bancada.banco)
      try {
        expect(await consultarEm(a, orcamento, { funcao: 'tutor_com_o_aluno', alunoId: alunoDeB.usuarioId })).toEqual({ permitido: true })
        expect(await consultarEm(b, orcamento, { funcao: 'tutor_com_o_aluno', alunoId: alunoDeB.usuarioId })).toMatchObject({ permitido: false })
      } finally {
        await sql('delete from mensagem_tutor where escola_id = $1 and aluno_id = $2', [b.escolaId, alunoDeB.usuarioId])
        await sql('delete from configuracao_operacional_escola where escola_id = $1', [a.escolaId])
      }
    })

    it('o pacote do mês é da turma: as trocas de todos os alunos somadas, contra o limite por aluno vezes os alunos da turma', async () => {
      // Dois alunos na turma, 2 por mês para cada: o pacote é 4. O dia fica folgado para o mês ser o que segura.
      await sql('update configuracao_operacional_escola set tutor_trocas_por_dia = 50, tutor_trocas_por_mes = 2 where escola_id = $1', [b.escolaId])
      const orcamento = new OrcamentoRepository(bancada.banco)
      // B já tem duas perguntas do primeiro aluno. Com mais uma do segundo, são 3 de 4: cabe.
      await perguntasAoTutor(b, b.outroAluno, 1)
      expect(await consultarEm(b, orcamento, consulta(b, b.outroAluno))).toEqual({ permitido: true })
      await perguntasAoTutor(b, b.outroAluno, 1)
      expect(await consultarEm(b, orcamento, consulta(b, b.outroAluno))).toEqual({ permitido: false, codigo: 'PACOTE_DO_TUTOR_ESGOTADO' })
      expect(await consultarEm(b, orcamento, consulta(b, b.aluno))).toEqual({ permitido: false, codigo: 'PACOTE_DO_TUTOR_ESGOTADO' })
      // Fora do Tutor, o orçamento não segura: o contrato ainda não tem teto de IA por escola.
      expect(await consultarEm(b, orcamento, { funcao: 'conversa_e_ferramentas' })).toEqual({ permitido: true })
    })

    it('em A, a turma de B não infla o pacote: os alunos contados são os da escola do contexto, e não os da turma pelo id', async () => {
      // A turma de B tem alunos confirmados (os dois de B, ao menos). Uma pergunta da escola A aponta para ela, o que a FK
      // composta nunca deixa gravar: só a conexão com as FKs desligadas (`replica`, só dentro da transação desta conexão)
      // monta o estado, e é ele que prova que a contagem de alunos tem a cláusula de escola por si. A linha sai no fim.
      // Depende de o papel do banco de teste ser superusuário: é o `POSTGRES_USUARIO` do compose, na máquina e na esteira
      // (o mesmo que `arquivo-do-titular.int.test.ts` e `expurgo-da-escola.int.test.ts` já usam).
      // Na escola A o pacote é 1 troca por aluno: sem aluno da escola A na turma, vale 1 (`Math.max(1, …)`), e a pergunta
      // grava 1 troca no mês, que já o esgota. Se a contagem alcançasse os alunos de B, o pacote subiria e a consulta passaria.
      await sql('insert into configuracao_operacional_escola (escola_id, tutor_trocas_por_dia, tutor_trocas_por_mes) values ($1, 50, 1) on conflict (escola_id) do update set tutor_trocas_por_dia = 50, tutor_trocas_por_mes = 1', [a.escolaId])
      const [alunoDeA] = await bancada.sessoes(a.escolaId, { papel: 'aluno', quantidade: 1 })
      if (alunoDeA === undefined) throw new Error('aluno de teste não criado')
      const alunosDaTurmaDeB = Number(((await sql(`select count(*) as total from vinculo where escola_id = $1 and turma_id = $2 and papel = 'aluno' and estado = 'confirmado'`, [b.escolaId, b.turma])).rows as { total: string }[])[0]?.total)
      expect(alunosDaTurmaDeB).toBeGreaterThanOrEqual(2)
      const execucao = await execucaoPendente(a, a.professor, 'turno_do_tutor', 'tutor_com_o_aluno')
      const cliente = await bancada.pool.connect()
      try {
        try {
          await cliente.query('begin')
          await cliente.query('set local session_replication_role = replica')
          await cliente.query(
            `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto) values ($1, $2, $3, $4, $5, 'aluno', 'pergunta sintética')`,
            [a.escolaId, a.anoLetivoId, b.turma, alunoDeA.usuarioId, execucao.id],
          )
          await cliente.query('commit')
        } catch (erro) {
          // O cliente volta ao pool sem transação aberta, ainda que o `insert` falhe.
          await cliente.query('rollback')
          throw erro
        }
        const orcamento = new OrcamentoRepository(bancada.banco)
        const decisao = await noContextoDe(a, () => orcamento.consultar({ funcao: 'tutor_com_o_aluno', alunoId: alunoDeA.usuarioId, turmaId: b.turma }))
        expect(decisao).toEqual({ permitido: false, codigo: 'PACOTE_DO_TUTOR_ESGOTADO' })
      } finally {
        cliente.release()
        await sql('delete from mensagem_tutor where escola_id = $1 and execucao_id = $2', [a.escolaId, execucao.id])
        await sql('delete from configuracao_operacional_escola where escola_id = $1', [a.escolaId])
      }
    })

    it('sem escola no contexto, o Tutor não é consultado: lança antes de ler o limite, o dia ou o pacote', async () => {
      const orcamento = new OrcamentoRepository(bancada.banco)
      await expect(orcamento.consultar({ funcao: 'tutor_com_o_aluno', alunoId: a.aluno.usuarioId, turmaId: a.turma })).rejects.toThrow('consulta com escopo sem escola no contexto')
      await expect(executarNoContexto({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => orcamento.consultar(consulta(a, a.aluno)))).rejects.toThrow('consulta com escopo sem escola no contexto')
    })

    it('sem escola no contexto, a função que não é o Tutor também lança: o exigir vem antes do "permitido" que ela receberia', async () => {
      const orcamento = new OrcamentoRepository(bancada.banco)
      await expect(orcamento.consultar({ funcao: 'conversa_e_ferramentas' })).rejects.toThrow('consulta com escopo sem escola no contexto')
      await expect(orcamento.consultar({ funcao: 'tutor_com_o_aluno' })).rejects.toThrow('consulta com escopo sem escola no contexto')
    })
  })

  describe('OrcamentoRepository: o limite lido é o da própria escola', () => {
    it('A e B com limites diferentes: com o limite de A (1) a pergunta é recusada, com o de B (3) é permitida', async () => {
      const limitar = (escola: Escola, porDia: number) =>
        sql(
          'insert into configuracao_operacional_escola (escola_id, tutor_trocas_por_dia, tutor_trocas_por_mes) values ($1, $2, null) on conflict (escola_id) do update set tutor_trocas_por_dia = $2, tutor_trocas_por_mes = null',
          [escola.escolaId, porDia],
        )
      // Cada escola tem a linha dela, e as duas linhas existem ao mesmo tempo: se a leitura do limite perdesse a
      // cláusula de escola, as duas consultas leriam a mesma linha, e uma das duas respostas abaixo trocaria.
      await limitar(a, 1)
      await limitar(b, 3)
      try {
        const orcamento = new OrcamentoRepository(bancada.banco)
        const semPerguntaHoje = await bancada.sessoes(a.escolaId, { papel: 'aluno', quantidade: 1 })
        const [alunoDeA] = semPerguntaHoje
        const [alunoDeB] = await bancada.sessoes(b.escolaId, { papel: 'aluno', quantidade: 1 })
        if (alunoDeA === undefined || alunoDeB === undefined) throw new Error('alunos de teste não criados')
        await perguntasAoTutor(a, alunoDeA, 1)
        await perguntasAoTutor(b, alunoDeB, 1)
        // Uma pergunta em cada escola. Em A, com limite 1, a próxima não cabe; em B, com limite 3, cabe.
        expect(await noContextoDe(a, () => orcamento.consultar({ funcao: 'tutor_com_o_aluno', alunoId: alunoDeA.usuarioId }))).toEqual({ permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' })
        expect(await noContextoDe(b, () => orcamento.consultar({ funcao: 'tutor_com_o_aluno', alunoId: alunoDeB.usuarioId }))).toEqual({ permitido: true })
      } finally {
        await sql('delete from configuracao_operacional_escola where escola_id = any($1::uuid[])', [[a.escolaId, b.escolaId]])
      }
    })
  })

  describe('as três portas, com A e B ao mesmo tempo nas mesmas instâncias', () => {
    it('cada turno do Tutor lê a suspensão, consulta o orçamento e grava o consumo na escola de quem o fez, e nenhuma escola herda a do primeiro a chegar', async () => {
      const limitar = (escola: Escola, porDia: number) =>
        sql('insert into configuracao_operacional_escola (escola_id, tutor_trocas_por_dia, tutor_trocas_por_mes) values ($1, $2, null) on conflict (escola_id) do update set tutor_trocas_por_dia = $2, tutor_trocas_por_mes = null', [escola.escolaId, porDia])
      // As duas com o freio de 1 e uma pergunta de cada aluno: no contexto certo as duas consultas são recusadas, e na
      // escola errada (onde o aluno não tem pergunta) seriam permitidas, qualquer que seja a escola que se herdou.
      await limitar(a, 1)
      await limitar(b, 1)
      await sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [b.escolaId, 'tutor_com_o_aluno', b.coordenacao.usuarioId])
      try {
        const [alunoDeA] = await bancada.sessoes(a.escolaId, { papel: 'aluno', quantidade: 1 })
        const [alunoDeB] = await bancada.sessoes(b.escolaId, { papel: 'aluno', quantidade: 1 })
        if (alunoDeA === undefined || alunoDeB === undefined) throw new Error('alunos de teste não criados')
        await perguntasAoTutor(a, alunoDeA, 1)
        await perguntasAoTutor(b, alunoDeB, 1)
        // As instâncias são uma só de cada, como as do módulo: o que muda de uma chamada para a outra é o contexto.
        const suspensao = new SuspensaoRepository(bancada.banco)
        const orcamento = new OrcamentoRepository(bancada.banco)
        const consumo = new ConsumoRepository(bancada.banco)
        const modelo = `modelo-${randomUUID()}`
        const doTutor: ConsumoDeIa = {
          tarefa: 'turno_do_tutor',
          funcao: 'tutor_com_o_aluno',
          perfil: 'rapido',
          origem: 'falso',
          modelo,
          promptVersao: '2026-10-04.1',
          tokensDeEntrada: 10,
          tokensDeSaida: 5,
          duracaoMs: 3,
          envioExterno: false,
          provedorId: null,
          tentativas: 1,
          estado: 'concluida',
          em: new Date(),
        }
        const turno = (escola: Escola, aluno: SessaoDeTeste) =>
          noContextoDe(escola, async () => {
            const suspensa = await suspensao.estaSuspensa('tutor_com_o_aluno')
            const decisao = await orcamento.consultar({ funcao: 'tutor_com_o_aluno', alunoId: aluno.usuarioId })
            await consumo.registrar({ ...doTutor, alunoId: aluno.usuarioId })
            return { suspensa, decisao }
          })
        const turnos = Array.from({ length: 5 }, () => [turno(a, alunoDeA), turno(b, alunoDeB)]).flat()
        const resultados = await Promise.all(turnos)
        // A cada turno, a resposta é a da escola dele: A não tem suspensão e B tem; nas duas o freio de 1 já fechou.
        const recusada = { permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' }
        expect(resultados.filter((_, indice) => indice % 2 === 0)).toEqual(Array.from({ length: 5 }, () => ({ suspensa: false, decisao: recusada })))
        expect(resultados.filter((_, indice) => indice % 2 === 1)).toEqual(Array.from({ length: 5 }, () => ({ suspensa: true, decisao: recusada })))
        const gravadas = (escola: Escola) => contar('consumo_ia', escola.escolaId, `modelo = '${modelo}'`)
        expect([await gravadas(a), await gravadas(b)]).toEqual([5, 5])
      } finally {
        await sql(`update suspensao_de_funcao set retomada_em = now(), retomada_por = $2 where escola_id = $1 and funcao = 'tutor_com_o_aluno' and retomada_em is null`, [b.escolaId, b.coordenacao.usuarioId])
        await sql('delete from configuracao_operacional_escola where escola_id = any($1::uuid[])', [[a.escolaId, b.escolaId]])
      }
    })
  })

  describe('AgendadorDeExecucoes', () => {
    it('grava a execução pendente, responde o id e roda depois, no contexto de quem pediu; a tela lê o resultado pela rota', async () => {
      const { pedido, aoGravar, aoConcluir, contextoVisto } = pedidoDoAssistente(a)
      const [consumoAntesDeA = 0, consumoAntesDeB = 0] = [await contar('consumo_ia', a.escolaId), await contar('consumo_ia', b.escolaId)]
      const { execucaoId } = await como(a, a.professor, 'professor', () => agendador.agendar(pedido))
      expect(aoGravar).toHaveBeenCalledTimes(1)
      // O id volta antes de a tarefa rodar: o que a execução produz só é gravado depois de a rota responder.
      expect(aoConcluir).not.toHaveBeenCalled()

      await executor.ociosa()
      expect(contextoVisto).toMatchObject([{ escolaId: a.escolaId, usuarioId: a.professor.usuarioId, anoLetivoId: a.anoLetivoId, papel: 'professor' }])
      // O consumo da execução, gravada depois do 202, é da escola de quem pediu: uma linha em A, e B sem mudança.
      expect([await contar('consumo_ia', a.escolaId), await contar('consumo_ia', b.escolaId)]).toEqual([consumoAntesDeA + 1, consumoAntesDeB])
      const resposta = await get(a.professor, `/v1/execucoes/${execucaoId}`)
      expect(resposta.status).toBe(200)
      expect(execucaoResponseSchema.safeParse(resposta.corpo).success).toBe(true)
      expect(resposta.corpo).toMatchObject({
        id: execucaoId,
        estado: 'concluida',
        erro: null,
        resultado: {
          tipo: 'mensagem',
          mensagem: { autor: 'agente', tipo: 'proposta_de_ferramenta', proposta: { ferramenta: 'atividade_objetiva', parametros: { tema: 'reagente limitante', quantidade: 5, turmaId: a.turma, disciplinaId: a.quimica } } },
        },
      })
      // A resposta não leva a entrada, o prompt, o modelo nem o custo.
      expect(Object.keys(resposta.corpo).sort()).toEqual(['erro', 'estado', 'id', 'resultado', 'tarefa'])
    })

    it('a mesma chave de envio duas vezes ao mesmo tempo grava uma execução e produz uma vez', async () => {
      const chaveEnvio = randomUUID()
      const um = pedidoDoAssistente(a, { chaveEnvio })
      const dois = pedidoDoAssistente(a, { chaveEnvio })
      const [primeira, segunda] = await como(a, a.professor, 'professor', () => Promise.all([agendador.agendar(um.pedido), agendador.agendar(dois.pedido)]))
      await executor.ociosa()
      expect(primeira.execucaoId).toBe(segunda.execucaoId)
      expect(await contar('execucao_agente', a.escolaId, `chave_envio = '${chaveEnvio}'`)).toBe(1)
      expect(um.aoGravar.mock.calls.length + dois.aoGravar.mock.calls.length).toBe(1)
      expect(um.aoConcluir.mock.calls.length + dois.aoConcluir.mock.calls.length).toBe(1)
      expect(await contar('mensagem_agente', a.escolaId, `execucao_id = '${primeira.execucaoId}'`)).toBe(2)
      expect(await contar('consumo_ia', a.escolaId, `execucao_id = '${primeira.execucaoId}'`)).toBe(1)

      // O reenvio depois de concluída devolve a mesma execução, e não produz de novo.
      const tres = pedidoDoAssistente(a, { chaveEnvio })
      expect(await como(a, a.professor, 'professor', () => agendador.agendar(tres.pedido))).toEqual({ execucaoId: primeira.execucaoId })
      await executor.ociosa()
      expect(tres.aoGravar).not.toHaveBeenCalled()
      expect(tres.aoConcluir).not.toHaveBeenCalled()
      expect(await contar('mensagem_agente', a.escolaId, `execucao_id = '${primeira.execucaoId}'`)).toBe(2)
    })

    it('a chave de envio de outra pessoa da escola responde como inexistente, e nada é gravado nem produzido', async () => {
      const chaveEnvio = randomUUID()
      const dono = pedidoDoAssistente(a, { chaveEnvio })
      await como(a, a.professor, 'professor', () => agendador.agendar(dono.pedido))
      await executor.ociosa()
      const colega = pedidoDoAssistente(a, { chaveEnvio })
      expect((await erroDe(como(a, a.outroProfessor, 'professor', () => agendador.agendar(colega.pedido)))).codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      await executor.ociosa()
      expect(colega.aoGravar).not.toHaveBeenCalled()
      expect(colega.aoConcluir).not.toHaveBeenCalled()
    })

    it('a conversa do professor não é copiada para o consumo: entrada e saída nulas, e o texto só em mensagem_agente', async () => {
      const texto = 'monta uma atividade sobre mol para o Enzo, que tem dislexia: palavra-marcada-do-professor'
      const { pedido } = pedidoDoAssistente(a, { texto })
      const { execucaoId } = await como(a, a.professor, 'professor', () => agendador.agendar(pedido))
      await executor.ociosa()
      const { rows } = await sql('select tarefa, funcao, estado, aluno_id, entrada, saida, origem, envio_externo, tokens_de_entrada from consumo_ia where escola_id = $1 and execucao_id = $2', [a.escolaId, execucaoId])
      expect(rows).toMatchObject([{ tarefa: 'propor_ferramenta', funcao: 'conversa_e_ferramentas', estado: 'concluida', aluno_id: null, entrada: null, saida: null, origem: 'falso', envio_externo: false }])
      const tudo = JSON.stringify([(await sql('select * from consumo_ia where escola_id = $1', [a.escolaId])).rows, (await sql('select * from execucao_agente where escola_id = $1', [a.escolaId])).rows])
      expect(tudo).not.toContain('palavra-marcada-do-professor')
      expect(await contar('mensagem_agente', a.escolaId, `execucao_id = '${execucaoId}' and conteudo ->> 'texto' like '%palavra-marcada-do-professor%'`)).toBe(1)
    })

    it('o turno do Tutor grava consumo com o aluno e com entrada e saída nulas, e o aluno lê a resposta pela rota', async () => {
      const duvida = 'não entendi essa parte: palavra-marcada-do-aluno'
      const { pedido } = pedidoDoTutor(b, b.outroAluno, duvida)
      // O orçamento desta escola foi esgotado no caso do pacote do mês: volta ao padrão para este turno.
      await sql('update configuracao_operacional_escola set tutor_trocas_por_dia = null, tutor_trocas_por_mes = null where escola_id = $1', [b.escolaId])
      const { execucaoId } = await como(b, b.outroAluno, 'aluno', () => agendador.agendar(pedido))
      await executor.ociosa()
      const { rows } = await sql('select tarefa, funcao, perfil, estado, aluno_id, entrada, saida from consumo_ia where escola_id = $1 and execucao_id = $2', [b.escolaId, execucaoId])
      expect(rows).toEqual([{ tarefa: 'turno_do_tutor', funcao: 'tutor_com_o_aluno', perfil: 'rapido', estado: 'concluida', aluno_id: b.outroAluno.usuarioId, entrada: null, saida: null }])
      expect(JSON.stringify((await sql('select * from consumo_ia where escola_id = $1', [b.escolaId])).rows)).not.toContain('palavra-marcada-do-aluno')

      const resposta = await get(b.outroAluno, `/v1/execucoes/${execucaoId}`)
      expect(resposta.status).toBe(200)
      expect(resposta.corpo).toMatchObject({ estado: 'concluida', resultado: { tipo: 'mensagem_do_tutor', mensagem: { autor: 'tutor', tipo: 'texto', citacoes: [] } } })
      // O colega de turma e o professor não leem a execução do aluno.
      expect((await get(b.aluno, `/v1/execucoes/${execucaoId}`)).status).toBe(404)
      expect((await get(b.professor, `/v1/execucoes/${execucaoId}`)).status).toBe(404)
    })

    it('assunto delicado no Tutor: a mensagem fixa chega ao aluno sem modelo, e o consumo não guarda o que ele escreveu', async () => {
      const { pedido } = pedidoDoTutor(b, b.outroAluno, 'não tô bem, meu pai me bate')
      const { execucaoId } = await como(b, b.outroAluno, 'aluno', () => agendador.agendar(pedido))
      await executor.ociosa()
      expect((await get(b.outroAluno, `/v1/execucoes/${execucaoId}`)).corpo).toMatchObject({ estado: 'concluida', resultado: { tipo: 'mensagem_do_tutor', mensagem: { tipo: 'assunto_delicado' } } })
      const { rows } = await sql('select origem, tentativas, entrada, saida from consumo_ia where escola_id = $1 and execucao_id = $2', [b.escolaId, execucaoId])
      expect(rows).toEqual([{ origem: 'regra_fixa', tentativas: 0, entrada: null, saida: null }])
    })

    it('se o que a execução produz falha ao gravar, ela termina "falhou" com código, e nada do que foi produzido fica', async () => {
      const { pedido } = pedidoDoAssistente(a, {
        aoConcluir: async () => {
          throw new Error('defeito ao gravar a mensagem, com o texto do professor')
        },
      })
      const { execucaoId } = await como(a, a.professor, 'professor', () => agendador.agendar(pedido))
      await executor.ociosa()
      expect(await execucaoNoBanco(execucaoId)).toMatchObject({ estado: 'falhou', erro: 'ERRO_INTERNO', resultado: null })
      expect(await contar('mensagem_agente', a.escolaId, `execucao_id = '${execucaoId}' and autor = 'agente'`)).toBe(0)
      expect((await get(a.professor, `/v1/execucoes/${execucaoId}`)).corpo).toEqual({ id: execucaoId, tarefa: 'propor_ferramenta', estado: 'falhou', resultado: null, erro: 'ERRO_INTERNO' })
    })

    it('material sem trecho aproveitável termina "falhou" com MATERIAL_INSUFICIENTE, que a tela sabe mostrar', async () => {
      const trechos = [{ materialId: randomUUID(), pagina: 1, texto: 'Sumário. Capítulo 7.' }]
      const aoConcluir = vi.fn(async (): Promise<ResultadoGravado> => ({ tipo: 'artefato', artefatoId: randomUUID(), entregaId: null }))
      const { execucaoId } = await como(a, a.professor, 'professor', () =>
        agendador.agendar({
          tarefa: gerarAtividadeObjetiva,
          chaveEnvio: randomUUID(),
          entradaDaExecucao: { tarefa: 'gerar_atividade_objetiva', parametros: { turmaId: a.turma, disciplinaId: a.quimica, tema: 'estequiometria' } },
          entrada: { tema: 'estequiometria', quantidade: 5, contexto: { serie: '2º ano', disciplina: 'Química' }, habilidades: [{ codigo: 'QUI.EM.05', descricao: 'Estequiometria' }], trechos },
          aoConcluir,
        }),
      )
      await executor.ociosa()
      expect(await execucaoNoBanco(execucaoId)).toMatchObject({ estado: 'falhou', erro: 'MATERIAL_INSUFICIENTE' })
      expect(aoConcluir).not.toHaveBeenCalled()
      expect(new ErroDeIa('MATERIAL_INSUFICIENTE').status).toBe(422)
    })
  })

  describe('GET /v1/execucoes/:id', () => {
    it('de outra pessoa, de outra escola, inexistente e com id fora do formato respondem igual: 404, o mesmo corpo', async () => {
      const minha = await execucaoPendente(a, a.professor)
      const doColega = await execucaoPendente(a, a.outroProfessor)
      const deB = await execucaoPendente(b, b.professor)

      const propria = await get(a.professor, `/v1/execucoes/${minha.id}`)
      expect(propria.status).toBe(200)
      expect(propria.corpo).toEqual({ id: minha.id, tarefa: 'gerar_atividade_objetiva', estado: 'pendente', resultado: null, erro: null })

      // Em maiúsculas é o mesmo id: a dona o lê, e quem não é dona recebe o mesmo 404 do inexistente.
      expect((await get(a.professor, `/v1/execucoes/${minha.id.toUpperCase()}`)).corpo).toEqual(propria.corpo)
      const recusas = await Promise.all([doColega.id, deB.id, deB.id.toUpperCase(), randomUUID(), 'nao-e-uuid'].map((id) => get(a.professor, `/v1/execucoes/${id}`)))
      for (const recusa of recusas) {
        expect(recusa.status).toBe(404)
        expect(recusa.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      }
      const semIdDaRequisicao = recusas.map((recusa) => ({ ...(recusa.corpo.erro as object), requisicaoId: undefined }))
      expect(new Set(semIdDaRequisicao.map((corpo) => JSON.stringify(corpo))).size).toBe(1)
      // A coordenação da própria escola também não lê a execução do professor: o alcance é o de quem pediu.
      expect((await get(a.coordenacao, `/v1/execucoes/${minha.id}`)).status).toBe(404)
      expect((await get(b.professor, `/v1/execucoes/${deB.id}`)).status).toBe(200)
    })

    it('a mensagem que o resultado aponta só sai se for da conversa de quem pede, mesmo com a referência forjada', async () => {
      // A execução é do colega de A, mas o resultado dela aponta para a mensagem do Assistente de outro professor.
      const { pedido } = pedidoDoAssistente(a)
      const { execucaoId: daOutra } = await como(a, a.professor, 'professor', () => agendador.agendar(pedido))
      await executor.ociosa()
      const { rows } = await sql(`select resultado from execucao_agente where id = $1`, [daOutra])
      const forjada = await execucaoPendente(a, a.outroProfessor, 'propor_ferramenta')
      await sql(`update execucao_agente set estado = 'concluida', iniciada_em = now(), concluida_em = now(), resultado = $2 where id = $1`, [forjada.id, JSON.stringify((rows as { resultado: unknown }[])[0]?.resultado)])
      expect((await get(a.outroProfessor, `/v1/execucoes/${forjada.id}`)).status).toBe(404)
      expect((await get(a.professor, `/v1/execucoes/${daOutra}`)).status).toBe(200)
    })

    it('a resposta do Tutor que o resultado aponta só sai se for da conversa do próprio aluno, na escola dele, mesmo com a referência forjada', async () => {
      // `resultado.mensagemId` é jsonb, sem FK: o que prende o texto da conversa a quem lê é a cláusula de escola e de aluno.
      const respostaDoTutorA = async (escola: Escola, aluno: SessaoDeTeste): Promise<{ execucaoId: string; mensagemId: string }> => {
        const { pedido } = pedidoDoTutor(escola, aluno, 'como eu acho o reagente limitante?')
        const { execucaoId } = await como(escola, aluno, 'aluno', () => agendador.agendar(pedido))
        await executor.ociosa()
        const { rows } = await sql(`select id from mensagem_tutor where escola_id = $1 and execucao_id = $2 and autor = 'tutor'`, [escola.escolaId, execucaoId])
        const mensagemId = (rows as { id: string }[])[0]?.id
        if (mensagemId === undefined) throw new Error('o Tutor deveria ter respondido')
        return { execucaoId, mensagemId }
      }
      const doColega = await respostaDoTutorA(a, a.outroAluno)
      const deOutraEscola = await respostaDoTutorA(b, b.outroAluno)

      // Um aluno novo, sem conversa nenhuma, com duas execuções dele concluídas que apontam para a resposta de outro aluno.
      const [curioso] = await bancada.sessoes(a.escolaId, { papel: 'aluno', quantidade: 1 })
      if (curioso === undefined) throw new Error('aluno de teste não criado')
      const forjar = async (mensagemId: string): Promise<string> => {
        const forjada = await execucaoPendente(a, curioso, 'turno_do_tutor', 'tutor_com_o_aluno')
        await sql(`update execucao_agente set estado = 'concluida', iniciada_em = now(), concluida_em = now(), resultado = $2 where id = $1`, [forjada.id, JSON.stringify({ tipo: 'mensagem_do_tutor', mensagemId })])
        return forjada.id
      }
      const [apontaParaOColega, apontaParaOutraEscola, apontaParaNada] = [await forjar(doColega.mensagemId), await forjar(deOutraEscola.mensagemId), await forjar(randomUUID())]

      const recusas = await Promise.all([apontaParaOColega, apontaParaOutraEscola, apontaParaNada].map((id) => get(curioso, `/v1/execucoes/${id}`)))
      for (const recusa of recusas) {
        expect(recusa.status).toBe(404)
        expect(recusa.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
        expect(JSON.stringify(recusa.corpo)).not.toContain('Releia')
      }
      expect(new Set(recusas.map((recusa) => JSON.stringify({ ...(recusa.corpo.erro as object), requisicaoId: undefined }))).size).toBe(1)
      // O dono de cada conversa lê a resposta dele, com o texto.
      const propria = await get(a.outroAluno, `/v1/execucoes/${doColega.execucaoId}`)
      expect(propria.status).toBe(200)
      expect(propria.corpo).toMatchObject({ resultado: { tipo: 'mensagem_do_tutor', mensagem: { id: doColega.mensagemId, autor: 'tutor' } } })
      expect((await get(b.outroAluno, `/v1/execucoes/${deOutraEscola.execucaoId}`)).status).toBe(200)
    })

    it('a cláusula de escola das mensagens vale por si: com a pessoa de B e a escola A no contexto, a mensagem de B não é achada', async () => {
      // O id de usuário é de uma escola só, então pela rota a cláusula de pessoa já barra a outra escola. Aqui o
      // contexto junta a escola A com a pessoa de B, que é o que sobraria se só a cláusula de escola segurasse.
      const { rows: doTutor } = await sql(`select id from mensagem_tutor where escola_id = $1 and aluno_id = $2 and autor = 'tutor' limit 1`, [b.escolaId, b.outroAluno.usuarioId])
      const { rows: doAssistente } = await sql(
        `select m.id from mensagem_agente m join thread_agente t on t.escola_id = m.escola_id and t.id = m.thread_id where m.escola_id = $1 and t.usuario_id = $2 and m.autor = 'agente' limit 1`,
        [b.escolaId, b.professor.usuarioId],
      )
      const [idDoTutor, idDoAssistente] = [(doTutor as { id: string }[])[0]?.id ?? '', (doAssistente as { id: string }[])[0]?.id ?? '']
      expect(idDoTutor).not.toBe('')
      expect(idDoAssistente).not.toBe('')
      const naEscola = <T>(escolaId: string, usuarioId: string, funcao: () => T): T => executarNoContexto({ requisicaoId: randomUUID(), escolaId, usuarioId }, funcao)
      const execucoes = new ExecucaoDaSessaoRepository(bancada.banco)

      expect(await naEscola(a.escolaId, b.outroAluno.usuarioId, () => execucoes.mensagemDoTutor(idDoTutor))).toBeUndefined()
      expect(await naEscola(a.escolaId, b.professor.usuarioId, () => execucoes.mensagemDoAssistente(idDoAssistente))).toBeUndefined()
      // Na escola certa, a mesma pessoa acha a própria mensagem.
      expect(await naEscola(b.escolaId, b.outroAluno.usuarioId, () => execucoes.mensagemDoTutor(idDoTutor))).toMatchObject({ id: idDoTutor })
      expect(await naEscola(b.escolaId, b.professor.usuarioId, () => execucoes.mensagemDoAssistente(idDoAssistente))).toMatchObject({ id: idDoAssistente })
    })

    it('a execução que falhou devolve só o código do erro, e a sem sessão não passa', async () => {
      const execucao = await execucaoPendente(a, a.professor)
      await new ExecucaoRepository(bancada.banco).marcarRodando(execucao)
      await new ExecucaoRepository(bancada.banco).marcarFalhou(execucao, 'IA_SAIDA_INVALIDA')
      expect((await get(a.professor, `/v1/execucoes/${execucao.id}`)).corpo).toEqual({ id: execucao.id, tarefa: 'gerar_atividade_objetiva', estado: 'falhou', resultado: null, erro: 'IA_SAIDA_INVALIDA' })
      expect((await chamar(api.url, 'GET', `/v1/execucoes/${execucao.id}`, undefined)).status).toBe(401)
    })
  })

  describe('varredura da subida', () => {
    it('execução presa em "rodando" ou "pendente" vira "falhou" com EXECUCAO_INTERROMPIDA quando a API sobe; a recente não é tocada', async () => {
      const presaRodando = await execucaoPendente(a, a.professor)
      const presaPendente = await execucaoPendente(b, b.professor)
      const viva = await execucaoPendente(a, a.professor)
      const recemCriada = await execucaoPendente(b, b.professor)
      await sql(`update execucao_agente set estado = 'rodando', iniciada_em = now() - interval '1 hour' where id = $1`, [presaRodando.id])
      await sql(`update execucao_agente set criada_em = now() - interval '1 hour' where id = $1`, [presaPendente.id])
      await new ExecucaoRepository(bancada.banco).marcarRodando(viva)

      // Outra instância da API sobe: é a varredura dela que encerra o que ficou para trás, nas duas escolas.
      const outra = await subirApi(medidor.medidor)
      await outra.app.close()

      for (const presa of [presaRodando, presaPendente]) {
        const encerrada = await execucaoNoBanco(presa.id)
        expect(encerrada).toMatchObject({ estado: 'falhou', erro: EXECUCAO_INTERROMPIDA, resultado: null })
        expect(encerrada.concluida_em).toBeInstanceOf(Date)
      }
      expect((await execucaoNoBanco(viva.id)).estado).toBe('rodando')
      expect((await execucaoNoBanco(recemCriada.id)).estado).toBe('pendente')
      // A tela de quem pediu recebe o código, e sabe o que mostrar.
      expect((await get(a.professor, `/v1/execucoes/${presaRodando.id}`)).corpo).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      await new ExecucaoRepository(bancada.banco).marcarFalhou(viva, 'ERRO_INTERNO')
    })
  })
})
