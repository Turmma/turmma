import { FOLGA_DO_PRAZO_MS, JobOutbox, LLMError, JobOutboxRepository, PRAZO_DA_EXECUCAO_MS, gerarAtividadeObjetiva, proporFerramenta, currentContext, runInContext, turnoDoTutor, type DatabaseTransaction } from '@educa/core'
import { ErrorCode, JOB_DEFINITIONS, TAREFAS_DE_IA, TIPO_EXECUTAR_IA, type ResultadoGravado } from '@educa/shared'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { compose, composeAssincronoOuFalha, aguardarSaudavel, PROCESSOS_DA_FILA } from '../../../../tools/testes/compose.ts'
import { urlRedisDeFila } from '../../../worker/test/queue.fixture.js'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-turma.fixture.js'
import { FilaDeIa, type FabricaDePrazo, type ModeloDeTeste } from '../../test/fila-de-ia.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import type { EntradaDaTarefa, ExecucaoCommand, SaidaDaTarefa } from './execucao-command.js'
import { ExecucaoRepository } from './execucao.repository.js'
import type { ExecucaoComComando } from './execucao.scheduler.js'
import { montarComandos } from './montar-comandos.js'
import { RegistroDeComandos } from './registro-de-comandos.js'

/**
 * A IA no worker (reengenharia-continuacao, 5.0; `techspec.md` §1, §5, §6, §13): o `POST` grava a execução `pendente` e o job `ia.executar` na mesma
 * transação, e o `main-worker` (aqui, o consumo real das filas `api-*` pela bancada `FilaDeIa`) conclui a execução uma vez só. Comandos de teste
 * para duas tarefas reais, uma por fila (`turno_do_tutor` na `interativa`, `gerar_atividade_objetiva` na `ferramenta`), no registro da bancada.
 *
 * Os casos de Tutor com a rota (D36, S12, desligado, suspenso, fora da política) estão em `tutor.int.test.ts` e `tutor-modelo.int.test.ts`,
 * e a entrega que nasce pendente, em `entrega.int.test.ts` e `artefato.int.test.ts`: todos passam pela bancada.
 */
const medidor = new MedidorDeTeste()
const bancada = new SessaoFixtures()
const sql = <ExecutionRecord extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<ExecutionRecord>(texto, valores)

const ENTRADA_DA_FERRAMENTA: EntradaDaTarefa<typeof proporFerramenta> = { mensagem: 'monta uma atividade com 5 questões sobre reagente limitante', contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], turnosAnteriores: [] }
const ENTRADA_DA_ATIVIDADE: EntradaDaTarefa<typeof gerarAtividadeObjetiva> = {
  tema: 'estequiometria',
  quantidade: 3,
  contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' },
  habilidades: [{ codigo: 'EM13CNT101', descricao: 'Analisar e representar transformações e conservações em sistemas.' }],
  trechos: [{ materialId: '0198a7b2-4c1d-7e3f-8a9b-1c2d3e4f5a6b', pagina: 1, texto: 'A estequiometria calcula a quantidade de reagentes e de produtos de uma reação química balanceada.' }],
}
const ENTRADA_DO_TUTOR: EntradaDaTarefa<typeof turnoDoTutor> = { duvida: 'não entendi essa parte', contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], memoria: [], turnosAnteriores: [] }

/** A turma de cada escola montada neste arquivo, que o comando do Tutor entrega ao `preparar`. */
const TURMA_DA_ESCOLA = new Map<string, string>()

/** O registro com um comando de teste por fila, para as duas tarefas: o `preparar` entrega a entrada fixa e o `concluir` devolve só a referência. */
function registroDeTeste(): RegistroDeComandos {
  const registro = new RegistroDeComandos()
  const ferramenta: ExecucaoCommand<EntradaDaTarefa<typeof proporFerramenta>, SaidaDaTarefa<typeof proporFerramenta>, Record<string, never>> = {
    tarefa: proporFerramenta,
    fila: 'ferramenta',
    preparar: () => Promise.resolve({ entrada: ENTRADA_DA_FERRAMENTA, lido: {} }),
    concluir: (): Promise<ResultadoGravado> => Promise.resolve({ tipo: 'mensagem', mensagemId: randomUUID() }),
  }
  const tutor: ExecucaoCommand<EntradaDaTarefa<typeof turnoDoTutor>, SaidaDaTarefa<typeof turnoDoTutor>, Record<string, never>> = {
    tarefa: turnoDoTutor,
    fila: 'interativa',
    // O Tutor sempre tem aluno e turma: a execução é de quem perguntou, e a turma é a da escola do contexto.
    preparar: () => {
      const contexto = currentContext()
      return Promise.resolve({ entrada: ENTRADA_DO_TUTOR, lido: {}, alunoId: contexto?.usuarioId ?? '', turmaId: TURMA_DA_ESCOLA.get(contexto?.escolaId ?? '') ?? '' })
    },
    concluir: (): Promise<ResultadoGravado> => Promise.resolve({ tipo: 'mensagem_do_tutor', mensagemId: randomUUID() }),
  }
  // O perfil `padrao` (a atividade, 140 s de prazo): o único caso que precisa dele é o do prazo, com o modelo de mentira, que não valida a entrada.
  const atividade: ExecucaoCommand<EntradaDaTarefa<typeof gerarAtividadeObjetiva>, SaidaDaTarefa<typeof gerarAtividadeObjetiva>, Record<string, never>> = {
    tarefa: gerarAtividadeObjetiva,
    fila: 'ferramenta',
    preparar: () => Promise.resolve({ entrada: ENTRADA_DA_ATIVIDADE, lido: {} }),
    concluir: (): Promise<ResultadoGravado> => Promise.resolve({ tipo: 'artefato', artefatoId: randomUUID(), entregaId: null }),
  }
  registro.registrar(ferramenta)
  registro.registrar(atividade)
  registro.registrar(tutor)
  return registro
}

type Tarefa = 'propor_ferramenta' | 'gerar_atividade_objetiva' | 'turno_do_tutor'

interface Escola extends EscolaComTurma {
  readonly escolaId: string
  readonly professor: TestSessao
  readonly aluno: TestSessao
}

async function montarEscola(fila: FilaDeIa): Promise<Escola> {
  const escola = await montarEscolaComTurma(fila.api, bancada)
  const escolaId = escola.coordenacao.escolaId
  const aluno = await bancada.sessao(escolaId, 'aluno')
  await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [escolaId, escola.anoLetivoId, aluno.usuarioId, escola.turma, escola.coordenacao.usuarioId])
  TURMA_DA_ESCOLA.set(escolaId, escola.turma)
  return { ...escola, escolaId, professor: await bancada.sessao(escolaId, 'professor'), aluno }
}

const pedidoDe = (escola: EscolaComTurma, tarefa: Tarefa, extra: Partial<ExecucaoComComando> = {}): ExecucaoComComando => ({
  comando: tarefa,
  chaveEnvio: randomUUID(),
  entradaDaExecucao: tarefa === 'gerar_atividade_objetiva' ? { tarefa, parametros: { turmaId: escola.turma, disciplinaId: escola.quimica, tema: 'estequiometria' } } : { tarefa },
  ...extra,
})

/** Como o `POST` o faria: `agendar` no contexto da pessoa. O turno do Tutor é do aluno, e a ferramenta, do professor. */
const agendar = (fila: FilaDeIa, escola: Escola, pedido: ExecucaoComComando): Promise<{ execucaoId: string }> => {
  const doAluno = pedido.comando === 'turno_do_tutor'
  const pessoa = doAluno ? escola.aluno : escola.professor
  return runInContext({ requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: pessoa.usuarioId, papel: doAluno ? 'aluno' : 'professor', sessaoId: pessoa.sessaoId, anoLetivoId: escola.anoLetivoId }, () => fila.agendador().agendar(pedido))
}

interface ExecutionRecord {
  readonly estado: string
  readonly erro: string | null
}
const execucaoDe = async (id: string): Promise<ExecutionRecord> => (await sql<ExecutionRecord & Record<string, unknown>>('select estado, erro from execucao_agente where id = $1', [id])).rows[0] ?? { estado: 'inexistente', erro: null }
const jobsDa = async (execucaoId: string) =>
  (await sql<{ id: string; estado: string; fila: string; escola_id: string; dados: Record<string, unknown>; codigo_falha: string | null }>(
    "select id, estado, fila, escola_id, dados, codigo_falha from job_registro where tipo = 'ia.executar' and dados ->> 'execucaoId' = $1",
    [execucaoId],
  )).rows
const consumosDa = async (execucaoId: string): Promise<number> => Number((await sql<{ total: string }>('select count(*) as total from consumo_ia where execucao_id = $1', [execucaoId])).rows[0]?.total)

/** Uma execução `pendente` gravada à mão, sem job: o que a escola dona dela não pediu a ninguém. */
async function execucaoSemJob(escola: Escola, tarefa: Tarefa = 'propor_ferramenta'): Promise<string> {
  const entrada = { tarefa }
  const funcao = tarefa === 'turno_do_tutor' ? 'tutor_com_o_aluno' : 'conversa_e_ferramentas'
  const { rows } = await sql<{ id: string }>('insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
    escola.escolaId,
    escola.anoLetivoId,
    funcao,
    tarefa,
    escola.professor.usuarioId,
    randomUUID(),
    JSON.stringify(entrada),
  ])
  return rows[0]?.id ?? ''
}

/** O modelo que responde na hora e anota quem chamou, e o que fica pendurado até o `sinal` abortar: o que o prazo e o desligamento cortam. */
const respondeNaHora: ModeloDeTeste = () => Promise.resolve({ saida: {}, medicao: {} })
const penduradoAteOSinal: ModeloDeTeste = (pedido) =>
  new Promise((_resolver, rejeitar) => {
    pedido.sinal?.addEventListener('abort', () => rejeitar(new Error('abortado')), { once: true })
  })

/** Espera até `condicao` valer, ou falha: o worker é assíncrono, e o teste espera o que ele faz pelo efeito. */
async function esperar(condicao: () => boolean | Promise<boolean>, descricao: string, limiteMs = 20_000): Promise<void> {
  const prazo = Date.now() + limiteMs
  while (!(await condicao())) {
    if (Date.now() > prazo) throw new Error(`não aconteceu no prazo: ${descricao}`)
    await new Promise((resolver) => setTimeout(resolver, 25))
  }
}

/** Todo texto que o Redis guarda sob o prefixo da bancada: o job, a cópia `failed`, o motivo. */
async function conteudoDoRedis(prefixo: string): Promise<string> {
  const redis = new Redis(urlRedisDeFila(), { maxRetriesPerRequest: 1 })
  try {
    const pedacos: string[] = []
    for await (const chaves of redis.scanStream({ match: `${prefixo}:*`, count: 200 })) {
      for (const chave of chaves as string[]) {
        const tipo = await redis.type(chave)
        if (tipo === 'hash') pedacos.push(JSON.stringify(await redis.hgetall(chave)))
        else if (tipo === 'string') pedacos.push((await redis.get(chave)) ?? '')
        else if (tipo === 'list') pedacos.push((await redis.lrange(chave, 0, -1)).join('\n'))
        else if (tipo === 'zset') pedacos.push((await redis.zrange(chave, '0', '-1')).join('\n'))
      }
    }
    return pedacos.join('\n')
  } finally {
    redis.disconnect()
  }
}

// As sessões e as escolas de todos os blocos saem juntas, no fim do arquivo.
afterAll(async () => {
  await bancada.fechar()
})

describe('a IA roda no worker', () => {
  const linhasDeLog: string[] = []
  let fila: FilaDeIa
  let a: Escola
  let b: Escola

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor, {}, linhasDeLog, { registro: registroDeTeste() })
    a = await montarEscola(fila)
    b = await montarEscola(fila)
  })

  afterEach(() => {
    fila.restaurar()
  })

  afterAll(async () => {
    await fila.ociosa().catch(() => undefined)
    await fila.fechar()
    for (const tabela of ['consumo_ia', 'execucao_agente', 'configuracao_operacional_escola']) await sql(`delete from ${tabela} where escola_id = any($1::uuid[])`, [[a.escolaId, b.escolaId]])
  })

  describe('sem modelo na API', () => {
    it('o `AppModule` não tem o provedor, e a API monta controllers; o `main-worker` tem o provedor e nenhum controller', async () => {
      expect(fila.apiTemProvedor()).toBe(false)
      expect(FilaDeIa.controllersDe(fila.api.app)).toBeGreaterThan(10)
      const worker = await FilaDeIa.subirOMainWorker()
      try {
        expect(worker.temProvedor).toBe(true)
        expect(worker.controllers).toBe(0)
      } finally {
        await worker.fechar()
      }
    })

    it('o `main-worker` monta o limite de tokens quando há `LLM_TOKENS_POR_MINUTO`, e é ele que o gateway reserva; sem a variável (só no `local`), nenhum limite e nenhuma espera (49.0)', async () => {
      const com = await FilaDeIa.subirOMainWorker()
      try {
        expect(com.limiteDeTokens).toBe('TokenLimiter')
        expect(com.gatewayReservaNele).toBe(true)
      } finally {
        await com.fechar()
      }
      const sem = await FilaDeIa.subirOMainWorker({ semTokensPorMinuto: true })
      try {
        expect(sem.limiteDeTokens).toBeNull()
        expect(sem.gatewayReservaNele).toBe(false)
      } finally {
        await sem.fechar()
      }
    })
  })

  describe('payload do job', () => {
    it('só o id da execução: sem id, id que não é uuid, campo a mais e texto livre são recusados', () => {
      expect(JOB_DEFINITIONS[TIPO_EXECUTAR_IA].dados.safeParse({ execucaoId: randomUUID() }).success).toBe(true)
      for (const dados of [{}, { execucaoId: 'nao-e-uuid' }, { execucaoId: randomUUID(), texto: 'a dúvida do aluno' }, { execucaoId: randomUUID(), resposta: 'o enunciado' }]) {
        expect(JOB_DEFINITIONS[TIPO_EXECUTAR_IA].dados.safeParse(dados).success, JSON.stringify(dados)).toBe(false)
      }
    })

    it('a IA não tem tarefa de discursiva nem de redação, e o catálogo e o registro que o worker consome não crescem por fora (D55)', () => {
      expect(TAREFAS_DE_IA.filter((tarefa) => /discursiv|redacao|pre_correcao|corrigir|nota/u.test(tarefa))).toEqual([])
      // O catálogo inteiro, fixo: uma tarefa nova (de texto de aluno, por exemplo) muda esta lista, e a mudança passa por revisão.
      expect([...TAREFAS_DE_IA]).toEqual(['propor_ferramenta', 'gerar_atividade_objetiva', 'gerar_plano_de_aula', 'adaptar_atividade', 'turno_do_tutor', 'relatorio_da_correcao', 'resumo_do_analista', 'classificar_secoes'])
      // O que o worker executa: os sete comandos de `montarComandos`, todos do catálogo, e nenhum fora dele.
      const registro = new RegistroDeComandos()
      montarComandos(registro, {} as never, {} as never, {} as never, {} as never)
      expect(registro.tarefas().sort()).toEqual(['adaptar_atividade', 'classificar_secoes', 'gerar_atividade_objetiva', 'gerar_plano_de_aula', 'propor_ferramenta', 'resumo_do_analista', 'turno_do_tutor'])
      expect(registro.tarefas().filter((tarefa) => !(TAREFAS_DE_IA as readonly string[]).includes(tarefa))).toEqual([])
    })
  })

  describe('o POST grava e o worker conclui', () => {
    it('a execução `pendente` e o job nascem na mesma transação: se o commit falha, não fica nem um, nem outro', async () => {
      const chaveEnvio = randomUUID()
      const nome = `teste_commit_${randomUUID().replaceAll('-', '').slice(0, 12)}`
      // O gatilho adiado só dispara no commit, depois de a execução e o job já terem sido gravados dentro da transação.
      await sql(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'commit forçado a falhar'; end $$`)
      await sql(`create constraint trigger ${nome} after insert on execucao_agente deferrable initially deferred for each row when (new.chave_envio = '${chaveEnvio}') execute function ${nome}()`)
      const desde = (await sql<{ agora: Date }>('select now() as agora')).rows[0]?.agora ?? new Date()
      try {
        await expect(agendar(fila, a, pedidoDe(a, 'propor_ferramenta', { chaveEnvio }))).rejects.toThrow('Failed query: commit')
      } finally {
        await sql(`drop trigger ${nome} on execucao_agente`)
        await sql(`drop function ${nome}()`)
      }
      await fila.ociosa()
      expect((await sql('select 1 from execucao_agente where escola_id = $1 and chave_envio = $2', [a.escolaId, chaveEnvio])).rows).toHaveLength(0)
      // Todo `ia.executar` da escola desde o início do caso, em qualquer estado: o job que saísse da transação (ou fosse enfileirado depois do commit) apareceria aqui.
      expect(Number((await sql<{ total: string }>("select count(*) as total from job_registro where escola_id = $1 and tipo = 'ia.executar' and criado_em >= $2", [a.escolaId, desde])).rows[0]?.total)).toBe(0)
    })

    it('a requisição que falha depois de gravar o pendente, antes do commit, também não deixa job', async () => {
      const chaveEnvio = randomUUID()
      const desde = (await sql<{ agora: Date }>('select now() as agora')).rows[0]?.agora ?? new Date()
      await expect(agendar(fila, a, pedidoDe(a, 'propor_ferramenta', { chaveEnvio, aoGravar: (_tx: DatabaseTransaction) => Promise.reject(new Error('a requisição falhou depois do pendente')) }))).rejects.toThrow('a requisição falhou depois do pendente')
      expect((await sql('select 1 from execucao_agente where escola_id = $1 and chave_envio = $2', [a.escolaId, chaveEnvio])).rows).toHaveLength(0)
      expect(Number((await sql<{ total: string }>("select count(*) as total from job_registro where escola_id = $1 and tipo = 'ia.executar' and criado_em >= $2", [a.escolaId, desde])).rows[0]?.total)).toBe(0)
    })

    it('o turno do Tutor: 202 (a execução volta `pendente` com o job `interativa`) e o worker a conclui uma vez, com um consumo', async () => {
      const segurar = fila.segurar()
      const { execucaoId } = await agendar(fila, a, pedidoDe(a, 'turno_do_tutor'))
      try {
        const [job, ...resto] = await jobsDa(execucaoId)
        expect(resto).toEqual([])
        expect(job).toMatchObject({ fila: 'interativa', escola_id: a.escolaId, dados: { execucaoId } })
        expect((await execucaoDe(execucaoId)).estado).not.toBe('concluida')
      } finally {
        segurar()
      }
      await fila.ociosa()
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'concluida', erro: null })
      expect((await jobsDa(execucaoId)).map((job) => job.estado)).toEqual(['concluido'])
      expect(await consumosDa(execucaoId)).toBe(1)
    })

    it('a ferramenta vai para a fila `ferramenta`, e o job leva só o id da execução', async () => {
      const { execucaoId } = await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))
      await fila.ociosa()
      const jobs = await jobsDa(execucaoId)
      expect(jobs).toHaveLength(1)
      expect(jobs[0]).toMatchObject({ fila: 'ferramenta', dados: { execucaoId } })
      expect(Object.keys(jobs[0]?.dados ?? {})).toEqual(['execucaoId'])
    })

    it('clique duplo: a mesma chave de envio em `Promise.all` grava uma execução, um job, e produz uma vez', async () => {
      const chaveEnvio = randomUUID()
      const segurar = fila.segurar()
      const respostas = await Promise.all(Array.from({ length: 5 }, () => agendar(fila, a, pedidoDe(a, 'propor_ferramenta', { chaveEnvio }))))
      const ids = new Set(respostas.map((resposta) => resposta.execucaoId))
      expect(ids.size).toBe(1)
      const [execucaoId = ''] = [...ids]
      expect(await jobsDa(execucaoId)).toHaveLength(1)
      segurar()
      await fila.ociosa()
      expect(await consumosDa(execucaoId)).toBe(1)
      expect(Number((await sql<{ total: string }>('select count(*) as total from execucao_agente where escola_id = $1 and chave_envio = $2', [a.escolaId, chaveEnvio])).rows[0]?.total)).toBe(1)
    })

    it('job duplicado sobre a execução concluída: o modelo não roda de novo, e nada muda', async () => {
      const { execucaoId } = await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))
      await fila.ociosa()
      expect(await consumosDa(execucaoId)).toBe(1)
      const chamadas: string[] = []
      fila.comModelo((pedido) => {
        chamadas.push(pedido.execucaoId ?? '')
        return respondeNaHora(pedido)
      })
      // O mesmo `execucaoId` publicado de novo, por outra chave: é a reentrega de um despachante, ou de um stalled.
      await fila.como(a.escolaId, a.professor.usuarioId, () => fila.banco.transaction((tx) => new JobOutbox(new JobOutboxRepository(tx)).enfileirarUmaVez(tx, TIPO_EXECUTAR_IA, { execucaoId }, randomUUID(), { fila: 'ferramenta' })))
      await fila.ociosa()
      // O segundo job existe e terminou: o teste não passa em branco por job que nunca saiu do outbox.
      expect((await jobsDa(execucaoId)).map((job) => job.estado)).toEqual(['concluido', 'concluido'])
      expect(chamadas).toEqual([])
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'concluida', erro: null })
      expect(await consumosDa(execucaoId)).toBe(1)
    })
  })

  describe('49.0: a fila do comando chega ao gateway', () => {
    it('o pedido ao modelo leva a fila do comando (o Tutor na `interativa`, a ferramenta na `ferramenta`): é nela que o limite de tokens reserva', async () => {
      const filas = new Map<string, string | undefined>()
      fila.comModelo((pedido) => {
        filas.set(pedido.tarefa.nome, pedido.fila)
        return respondeNaHora(pedido)
      })
      await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))
      await agendar(fila, a, pedidoDe(a, 'turno_do_tutor'))
      await fila.ociosa()
      expect(Object.fromEntries(filas)).toEqual({ propor_ferramenta: 'ferramenta', turno_do_tutor: 'interativa' })
    })
  })

  describe('RF2: a vaga de cada fila é de cada escola', () => {
    it('cinco ferramentas da A juntas: a quinta espera, o Tutor da A responde, e a ferramenta da B segue', async () => {
      const chamadas: string[] = []
      let liberar: () => void = () => undefined
      const solta = new Promise<void>((resolver) => (liberar = resolver))
      fila.comModelo(async (pedido) => {
        chamadas.push(pedido.execucaoId ?? '')
        // Só a ferramenta espera; o turno do Tutor responde na hora.
        if (pedido.tarefa.nome !== 'turno_do_tutor') await solta
        return { saida: {}, medicao: {} }
      })
      const ferramentasDaA = await Promise.all(Array.from({ length: 5 }, () => agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))))
      const doTutorDaA = await agendar(fila, a, pedidoDe(a, 'turno_do_tutor'))
      const daB = await agendar(fila, b, pedidoDe(b, 'propor_ferramenta'))
      try {
        // 4 da A (a vaga da `ferramenta`) + 1 do Tutor da A + 1 da B começaram; a quinta da A espera a vaga.
        await esperar(() => chamadas.length >= 6, 'as quatro ferramentas da A, o Tutor da A e a da B chamarem o modelo')
        // Um fato positivo, e não um tempo: o despachante só publicou quatro dos cinco jobs da A (a vaga da `ferramenta` é de quatro), e o quinto segue
        // `aguardando` no registro, depois de o job da B, criado depois de todos os da A, já ter sido publicado e chamado o modelo.
        const estadosDaA = async () => {
          const ids = (await Promise.all(ferramentasDaA.map((execucao) => jobsDa(execucao.execucaoId)))).flat()
          return ids.map((job) => job.estado).sort()
        }
        await esperar(async () => (await estadosDaA()).join() === 'aguardando,ativo,ativo,ativo,ativo', 'quatro jobs da A ativos e o quinto aguardando a vaga')
        expect(chamadas).toHaveLength(6)
        const daA = ferramentasDaA.map((execucao) => execucao.execucaoId)
        expect(chamadas.filter((id) => daA.includes(id))).toHaveLength(4)
        expect(chamadas).toContain(daB.execucaoId)
        expect(await execucaoDe(doTutorDaA.execucaoId)).toMatchObject({ estado: 'concluida' })
        expect((await execucaoDe(daB.execucaoId)).estado).toBe('rodando')
        const esperando = daA.filter((id) => !chamadas.includes(id))
        expect(esperando).toHaveLength(1)
        expect((await jobsDa(esperando[0] ?? '')).map((job) => job.estado)).not.toContain('concluido')
      } finally {
        liberar()
      }
      await fila.ociosa()
      for (const { execucaoId } of [...ferramentasDaA, doTutorDaA, daB]) expect((await execucaoDe(execucaoId)).estado, execucaoId).toBe('concluida')
    })
  })

  describe('isolamento do job', () => {
    it('job da A com o `execucaoId` da B: nada muda, o modelo não roda, e o job falha só com o código', async () => {
      const daB = await execucaoSemJob(b)
      const chamadas: string[] = []
      fila.comModelo((pedido) => {
        chamadas.push(pedido.execucaoId ?? '')
        return respondeNaHora(pedido)
      })
      await fila.como(a.escolaId, a.professor.usuarioId, () => fila.banco.transaction((tx) => new JobOutbox(new JobOutboxRepository(tx)).enfileirarUmaVez(tx, TIPO_EXECUTAR_IA, { execucaoId: daB }, randomUUID(), { fila: 'ferramenta' })))
      await fila.ociosa()
      expect(chamadas).toEqual([])
      expect(await execucaoDe(daB)).toMatchObject({ estado: 'pendente', erro: null })
      expect(await consumosDa(daB)).toBe(0)
      const [job] = await jobsDa(daB)
      expect(job).toMatchObject({ estado: 'falhou', escola_id: a.escolaId, codigo_falha: 'DADOS_INVALIDOS' })
    })
  })

  describe('o repository da execução e quem pediu', () => {
    it('no contexto da A, a execução da B não é lida nem mudada; no da B, cada chamada muda só a execução que recebe, e só no estado em que vale', async () => {
      const emRodando = async (id: string) => sql("update execucao_agente set estado = 'rodando', iniciada_em = now() where id = $1", [id])
      const [pendente, paraConcluir, paraFalhar, pendenteDeFora, rodandoDeFora] = [await execucaoSemJob(b), await execucaoSemJob(b), await execucaoSemJob(b), await execucaoSemJob(b), await execucaoSemJob(b)]
      for (const id of [paraConcluir, paraFalhar, rodandoDeFora]) await emRodando(id)
      const referencia: ResultadoGravado = { tipo: 'mensagem', mensagemId: randomUUID() }
      const estados = async () => (await Promise.all([pendente, paraConcluir, paraFalhar, pendenteDeFora, rodandoDeFora].map(async (id) => (await execucaoDe(id)).estado)))
      const chamar = (escola: Escola) =>
        fila.como(escola.escolaId, escola.professor.usuarioId, async () => {
          const repositorio = new ExecucaoRepository(fila.banco)
          return {
            lida: (await repositorio.paraIniciar(pendente))?.id,
            outraLida: (await repositorio.paraIniciar(paraFalhar))?.id,
            marcouRodando: await repositorio.marcarRodando(pendente),
            concluiu: await repositorio.concluirRodando(paraConcluir, referencia),
            falhou: await repositorio.marcarFalhou(paraFalhar, ErrorCode.NAO_ENCONTRADO),
          }
        })
      // A escola A também tem execuções, pendente e rodando: sem o id na cláusula, o repository acharia e mudaria uma delas.
      const daAPendente = await execucaoSemJob(a)
      const daARodando = await execucaoSemJob(a)
      await emRodando(daARodando)
      expect(await chamar(a)).toEqual({ lida: undefined, outraLida: undefined, marcouRodando: false, concluiu: false, falhou: false })
      expect(await estados()).toEqual(['pendente', 'rodando', 'rodando', 'pendente', 'rodando'])
      expect([(await execucaoDe(daAPendente)).estado, (await execucaoDe(daARodando)).estado]).toEqual(['pendente', 'rodando'])
      // O controle: sem ele, "nada mudou" valeria também para um repository que nunca muda nada.
      expect(await chamar(b)).toEqual({ lida: pendente, outraLida: paraFalhar, marcouRodando: true, concluiu: true, falhou: true })
      // Só as três execuções chamadas mudaram: as de fora, pendente e rodando, ficam como estavam.
      expect(await estados()).toEqual(['rodando', 'concluida', 'falhou', 'pendente', 'rodando'])
      // O estado também é condição: a que já concluiu não volta a `rodando` nem a `falhou`, e a que está pendente não conclui nem falha.
      const repetida = await fila.como(b.escolaId, b.professor.usuarioId, async () => {
        const repositorio = new ExecucaoRepository(fila.banco)
        return { marcouRodando: await repositorio.marcarRodando(paraConcluir), concluiuPendente: await repositorio.concluirRodando(pendenteDeFora, referencia), falhouConcluida: await repositorio.marcarFalhou(paraConcluir, ErrorCode.NAO_ENCONTRADO), falhouPendente: await repositorio.marcarFalhou(pendenteDeFora, ErrorCode.NAO_ENCONTRADO) }
      })
      expect(repetida).toEqual({ marcouRodando: false, concluiuPendente: false, falhouConcluida: false, falhouPendente: false })
      expect(await estados()).toEqual(['rodando', 'concluida', 'falhou', 'pendente', 'rodando'])
      // O resultado é só referência: o que a conclusão recebe a mais não chega ao banco.
      const comTexto = await execucaoSemJob(b)
      await emRodando(comTexto)
      await fila.como(b.escolaId, b.professor.usuarioId, () => new ExecucaoRepository(fila.banco).concluirRodando(comTexto, { ...referencia, texto: 'conteúdo que não é referência' } as never)).catch(() => undefined)
      expect(JSON.stringify((await sql('select resultado from execucao_agente where id = $1', [comTexto])).rows)).not.toContain('conteúdo que não é referência')
    })

    it('a defesa em profundidade do banco: a execução da escola A não aceita a pessoa nem o ano letivo da B, e por isso os joins do `paraIniciar` não têm o que cruzar', async () => {
      const inserir = (pessoa: string, ano: string) =>
        sql('insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7)', [
          a.escolaId,
          ano,
          'conversa_e_ferramentas',
          'propor_ferramenta',
          pessoa,
          randomUUID(),
          JSON.stringify({ tarefa: 'propor_ferramenta' }),
        ])
      // O controle: com a pessoa e o ano da própria escola, a mesma linha entra.
      await inserir(a.professor.usuarioId, a.anoLetivoId)
      await expect(inserir(b.professor.usuarioId, a.anoLetivoId)).rejects.toThrow(/violates foreign key constraint/u)
      await expect(inserir(a.professor.usuarioId, b.anoLetivoId)).rejects.toThrow(/violates foreign key constraint/u)
    })

    it('a tarefa da execução não tem comando registrado: o defeito de montagem falha a execução com `ERRO_INTERNO`, em vez de deixá-la `rodando`, e o modelo não roda', async () => {
      const chamadas: string[] = []
      fila.comModelo((pedido) => {
        chamadas.push(pedido.execucaoId ?? '')
        return respondeNaHora(pedido)
      })
      // O registro desta bancada não tem o comando do resumo do Analista.
      const { rows } = await sql<{ id: string }>('insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
        a.escolaId,
        a.anoLetivoId,
        'resumo_e_alerta',
        'resumo_do_analista',
        a.professor.usuarioId,
        randomUUID(),
        JSON.stringify({ tarefa: 'resumo_do_analista' }),
      ])
      const execucaoId = rows[0]?.id ?? ''
      await fila.como(a.escolaId, a.professor.usuarioId, () => fila.banco.transaction((tx) => new JobOutbox(new JobOutboxRepository(tx)).enfileirarUmaVez(tx, TIPO_EXECUTAR_IA, { execucaoId }, randomUUID(), { fila: 'normal' })))
      await fila.ociosa()
      expect(await execucaoDe(execucaoId)).toEqual({ estado: 'falhou', erro: ErrorCode.ERRO_INTERNO })
      expect(chamadas).toEqual([])
    })

    it('a falha que não se grava deixa o aviso `ia.execucao.falha_nao_gravada`, só com ids e o código: a linha fica `rodando` para a varredura', async () => {
      const chaveEnvio = randomUUID()
      const nome = `teste_falha_${randomUUID().replaceAll('-', '').slice(0, 12)}`
      await sql(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'a gravação da falha foi recusada'; end $$`)
      // O gatilho recusa só a passagem para `falhou` desta execução: o `rodando` e o resto da bancada seguem.
      await sql(`create trigger ${nome} before update on execucao_agente for each row when (new.estado = 'falhou' and new.chave_envio = '${chaveEnvio}') execute function ${nome}()`)
      try {
        const { rows } = await sql<{ id: string }>('insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
          a.escolaId,
          a.anoLetivoId,
          'resumo_e_alerta',
          'resumo_do_analista',
          a.professor.usuarioId,
          chaveEnvio,
          JSON.stringify({ tarefa: 'resumo_do_analista' }),
        ])
        const execucaoId = rows[0]?.id ?? ''
        await fila.como(a.escolaId, a.professor.usuarioId, () => fila.banco.transaction((tx) => new JobOutbox(new JobOutboxRepository(tx)).enfileirarUmaVez(tx, TIPO_EXECUTAR_IA, { execucaoId }, randomUUID(), { fila: 'normal' })))
        await fila.ociosa()
        expect(await execucaoDe(execucaoId)).toEqual({ estado: 'rodando', erro: null })
        const aviso = linhasDeLog.find((linha) => linha.includes('"evento":"ia.execucao.falha_nao_gravada"'))
        expect(aviso).toBeDefined()
        expect(aviso).toContain(execucaoId)
        expect(aviso).toContain(`"codigo":"${ErrorCode.ERRO_INTERNO}"`)
        // Só ids e o código: nem o texto do erro do banco, nem o da execução.
        expect(aviso).not.toContain('a gravação da falha foi recusada')
      } finally {
        await sql(`drop trigger if exists ${nome} on execucao_agente`)
        await sql(`drop function if exists ${nome}()`)
      }
    })

    it('quem pediu foi desativado, teve a eliminação agendada, ou o ano letivo dele já não está em curso, ou a entrada gravada não é lida: a execução falha como inexistente, e o modelo não roda', async () => {
      const chamadas: string[] = []
      fila.comModelo((pedido) => {
        chamadas.push(pedido.execucaoId ?? '')
        return respondeNaHora(pedido)
      })
      const casos: { rotulo: string; tarefa?: Tarefa; mexer: (escola: Escola, execucaoId: string) => Promise<unknown> }[] = [
        { rotulo: 'desativado', mexer: (escola) => sql('update usuario set desativado_em = now() where id = $1', [escola.professor.usuarioId]) },
        { rotulo: 'eliminação agendada', mexer: (escola) => sql('update usuario set eliminacao_agendada_em = now() where id = $1', [escola.professor.usuarioId]) },
        { rotulo: 'ano encerrado', mexer: (escola) => sql("update ano_letivo set situacao = 'encerrado' where id = $1", [escola.anoLetivoId]) },
        // A atividade sem os `parametros` que o esquema da entrada exige: a execução que a API gravaria nunca é assim, e o worker não a roda.
        { rotulo: 'entrada gravada que o esquema não lê', tarefa: 'gerar_atividade_objetiva', mexer: () => Promise.resolve() },
        {
          // O ano em curso continua o mesmo, mas a execução é de um ano que já acabou: a virada do ano entre o `202` e o worker.
          rotulo: 'execução de ano anterior',
          mexer: async (escola, execucaoId) => {
            const { rows } = await sql<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2019, '2019-02-01', '2019-12-15', 'encerrado') returning id", [escola.escolaId])
            await sql('update execucao_agente set ano_letivo_id = $1 where id = $2', [rows[0]?.id, execucaoId])
          },
        },
      ]
      for (const { rotulo, tarefa, mexer } of casos) {
        // Uma escola para cada caso: o ano encerrado de uma não serve à outra.
        const escola = await montarEscola(fila)
        const execucaoId = await execucaoSemJob(escola, tarefa)
        await mexer(escola, execucaoId)
        await fila.como(escola.escolaId, escola.professor.usuarioId, () => fila.banco.transaction((tx) => new JobOutbox(new JobOutboxRepository(tx)).enfileirarUmaVez(tx, TIPO_EXECUTAR_IA, { execucaoId }, randomUUID(), { fila: 'ferramenta' })))
        await fila.ociosa()
        expect(await execucaoDe(execucaoId), rotulo).toEqual({ estado: 'falhou', erro: ErrorCode.NAO_ENCONTRADO })
        expect(await consumosDa(execucaoId), rotulo).toBe(0)
      }
      expect(chamadas).toEqual([])
    })

    it('a varredura encerrou a execução enquanto o modelo rodava: nem a resposta nem a falha do modelo a reescrevem', async () => {
      const respostas = new Map<string, (resposta: 'responder' | 'falhar') => void>()
      fila.comModelo(
        (pedido) =>
          new Promise((resolver, rejeitar) => {
            respostas.set(pedido.execucaoId ?? '', (resposta) => (resposta === 'responder' ? resolver({ saida: {}, medicao: {} }) : rejeitar(new Error('o modelo falhou'))))
          }),
      )
      const quemResponde = await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))
      const quemFalha = await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))
      await esperar(() => respostas.size === 2, 'as duas execuções chamarem o modelo')
      // Como a varredura a deixa: `falhou`, com o código dela.
      await sql("update execucao_agente set estado = 'falhou', erro = 'EXECUCAO_INTERROMPIDA', concluida_em = now() where id = any($1::uuid[])", [[quemResponde.execucaoId, quemFalha.execucaoId]])
      respostas.get(quemResponde.execucaoId)?.('responder')
      respostas.get(quemFalha.execucaoId)?.('falhar')
      await fila.ociosa()
      expect(await execucaoDe(quemResponde.execucaoId)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect(await execucaoDe(quemFalha.execucaoId)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      // Quem respondeu desfez a própria transação (a conclusão não passou), e o processador o diz no log, só com ids.
      expect(linhasDeLog.filter((linha) => linha.includes('"evento":"ia.execucao.encerrada_por_outro"') && linha.includes(quemResponde.execucaoId))).toHaveLength(1)
      expect(linhasDeLog.filter((linha) => linha.includes('"evento":"ia.execucao.encerrada_por_outro"') && linha.includes(quemFalha.execucaoId))).toHaveLength(0)
    })
  })

  describe('a volta do código depois da 5.0', () => {
    /** O bloco de SQL do runbook que abre com `-- volta-da-5.0`: o que a pessoa de plantão copia é o que está provado. */
    const blocoDoRunbook = (): string => {
      const texto = readFileSync(fileURLToPath(new URL('../../../../docs/runbook.md', import.meta.url)), 'utf8')
      const achado = /```sql\n-- volta-da-5\.0[^\n]*\n([\s\S]*?)```/u.exec(texto)
      if (achado?.[1] === undefined) throw new Error('o runbook não tem o bloco "volta-da-5.0"')
      return achado[1]
    }

    it('o bloco do runbook encerra a execução `pendente` e a `rodando` e conclui o job `ia.executar` que não terminou, e deixa o resto como estava', async () => {
      const pendente = await execucaoSemJob(a)
      const rodando = await execucaoSemJob(a)
      await sql("update execucao_agente set estado = 'rodando', iniciada_em = now() where id = $1", [rodando])
      const concluida = (await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))).execucaoId
      await fila.ociosa()
      const jobAberto = async (execucaoId: string, fila_: string, estado: string): Promise<string> =>
        (await sql<{ id: string }>("insert into job_registro (escola_id, fila, prioridade, tipo, dados, estado) values ($1, $2, 1, 'ia.executar', $3::jsonb, $4) returning id", [a.escolaId, fila_, JSON.stringify({ execucaoId }), estado])).rows[0]?.id ?? ''
      const abertos = [await jobAberto(pendente, 'ferramenta', 'aguardando'), await jobAberto(rodando, 'interativa', 'publicado'), await jobAberto(rodando, 'normal', 'ativo')]
      const deOutroTipo = (await sql<{ id: string }>("insert into job_registro (escola_id, fila, prioridade, tipo, dados, nao_urgente, estado) values ($1, 'lote', 3, 'sintetico', '{}'::jsonb, false, 'aguardando') returning id", [a.escolaId])).rows[0]?.id ?? ''

      await sql(blocoDoRunbook())

      expect(await execucaoDe(pendente)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect(await execucaoDe(rodando)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect(await execucaoDe(concluida)).toEqual({ estado: 'concluida', erro: null })
      const estadoDe = async (id: string) => (await sql<{ estado: string }>('select estado from job_registro where id = $1', [id])).rows[0]?.estado
      expect(await Promise.all(abertos.map(estadoDe))).toEqual(['concluido', 'concluido', 'concluido'])
      expect(await estadoDe(deOutroTipo)).toBe('aguardando')
      // A execução que o código anterior vê agora é uma `falhou` com um código que ele já conhece: nenhuma fica para a varredura dele.
      expect(Number((await sql<{ total: string }>("select count(*) as total from execucao_agente where escola_id = $1 and estado in ('pendente', 'rodando')", [a.escolaId])).rows[0]?.total)).toBe(0)
    })
  })

  describe('o que o Redis e o log guardam', () => {
    it('o erro do modelo não vai à cópia do job no Redis, nem ao registro, nem ao log: a execução falha só com o código', async () => {
      const segredo = 'palavra-secreta-do-provedor'
      fila.comModelo(() => Promise.reject(new Error(`o provedor disse: ${segredo}`)))
      const { execucaoId } = await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))
      await fila.ociosa()
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.ERRO_INTERNO })
      expect((await jobsDa(execucaoId)).map((job) => job.estado)).toEqual(['concluido'])
      expect(await conteudoDoRedis(fila.prefixo)).not.toContain(segredo)
      expect(JSON.stringify((await sql('select * from job_registro where dados ->> \'execucaoId\' = $1', [execucaoId])).rows)).not.toContain(segredo)
      expect(JSON.stringify((await sql('select * from execucao_agente where id = $1', [execucaoId])).rows)).not.toContain(segredo)
      expect(linhasDeLog.join('\n')).not.toContain(segredo)
    })

    it('o provedor indisponível numa ferramenta, que não é do lote, não adia: a execução falha com `IA_INDISPONIVEL` e o job termina', async () => {
      fila.comModelo(() => Promise.reject(new LLMError('IA_INDISPONIVEL', 5, 'sem_vaga')))
      const { execucaoId } = await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))
      await fila.ociosa()
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_INDISPONIVEL })
      expect((await jobsDa(execucaoId)).map((job) => job.estado)).toEqual(['concluido'])
    })

    it('o processador loga só ids, a tarefa e o código, nunca a entrada nem o nome de quem pediu', async () => {
      await sql('update usuario set nome = $1 where id = $2', ['Maria Sintética da Silva', a.professor.usuarioId])
      const { execucaoId } = await agendar(fila, a, pedidoDe(a, 'propor_ferramenta'))
      await fila.ociosa()
      const doProcessador = linhasDeLog.filter((linha) => linha.includes('"evento":"ia.execucao.'))
      expect(doProcessador.length).toBeGreaterThan(0)
      const daExecucao = doProcessador.filter((linha) => linha.includes(execucaoId))
      expect(daExecucao.length).toBeGreaterThan(0)
      for (const linha of daExecucao) {
        const campos = Object.keys(JSON.parse(linha) as Record<string, unknown>)
        expect(campos.filter((campo) => !['level', 'time', 'servico', 'evento', 'execucaoId', 'escolaId', 'tipo', 'codigo', 'duracaoMs', 'pid', 'hostname', 'nivel', 'msg', 'requisicaoId', 'v'].includes(campo)), linha).toEqual([])
      }
      expect(linhasDeLog.join('\n')).not.toContain('Maria Sintética')
      expect(linhasDeLog.join('\n')).not.toContain('reagente limitante')
    })
  })

})

// Cada bancada tem o despachante dela, e o `job_registro` é um só: duas bancadas vivas no mesmo arquivo disputariam as linhas. Cada bloco abaixo sobe a sua e a fecha.
describe('o prazo único e o desligamento', () => {
  let aqui: FilaDeIa
  let escola: Escola
  const prazos: { ms: number; abortar: () => void }[] = []
  const linhasDoPrazo: string[] = []

  const prazo: FabricaDePrazo = (ms) => {
    const controle = new AbortController()
    prazos.push({ ms, abortar: () => controle.abort() })
    return { sinal: controle.signal, cancelar: () => undefined }
  }

  beforeAll(async () => {
    aqui = await FilaDeIa.subir(medidor.medidor, {}, linhasDoPrazo, { registro: registroDeTeste(), prazo, graca: 100 })
    escola = await montarEscola(aqui)
  })

  afterEach(() => {
    aqui.restaurar()
    prazos.length = 0
  })

  afterAll(async () => {
    await aqui.fechar()
    await sql('delete from consumo_ia where escola_id = $1', [escola.escolaId])
    await sql('delete from execucao_agente where escola_id = $1', [escola.escolaId])
  })

  it('o prazo de cada execução é o do perfil: 60 s no Tutor, 140 s na atividade, abaixo dos 150 s do job com a folga de gravar a falha', async () => {
    expect(PRAZO_DA_EXECUCAO_MS).toMatchObject({ rapido: 60_000, padrao: 140_000 })
    for (const prazoMs of Object.values(PRAZO_DA_EXECUCAO_MS)) expect(prazoMs + FOLGA_DO_PRAZO_MS).toBeLessThanOrEqual(150_000)
    aqui.comModelo(penduradoAteOSinal)
    const doTutor = await agendar(aqui, escola, pedidoDe(escola, 'turno_do_tutor'))
    await esperar(() => prazos.length === 1, 'o prazo do Tutor começar')
    expect(prazos[0]?.ms).toBe(60_000)
    prazos[0]?.abortar()
    const daFerramenta = await agendar(aqui, escola, pedidoDe(escola, 'gerar_atividade_objetiva'))
    await esperar(() => prazos.length === 2, 'o prazo da ferramenta começar')
    expect(prazos[1]?.ms).toBe(140_000)
    prazos[1]?.abortar()
    await aqui.ociosa()
    expect(await execucaoDe(doTutor.execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_TEMPO_ESGOTADO })
    expect(await execucaoDe(daFerramenta.execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_TEMPO_ESGOTADO })
  })

  it('o desligamento do worker aborta e não grava: a execução fica `rodando`, sem `IA_TEMPO_ESGOTADO` nem falha', async () => {
    let chamou = false
    let abortado = false
    aqui.comModelo((pedido) => {
      chamou = true
      pedido.sinal?.addEventListener('abort', () => (abortado = true), { once: true })
      return penduradoAteOSinal(pedido)
    })
    const { execucaoId } = await agendar(aqui, escola, pedidoDe(escola, 'propor_ferramenta'))
    await esperar(() => chamou, 'o modelo ser chamado')
    await aqui.desligarWorker()
    // O que roda é abortado pelo mesmo sinal que o modelo recebe, e a execução fica como estava: a reentrega decide (6.0).
    expect(abortado).toBe(true)
    // O fato positivo do processador: o aviso `ia.execucao.abortada` com os ids, e nenhum `ia.execucao.falhou`; o resultado não depende de o `marcarFalhou` caber no teto do `encerrar`.
    await esperar(() => linhasDoPrazo.some((linha) => linha.includes('ia.execucao.abortada') && linha.includes(execucaoId)), 'o aviso de execução abortada')
    expect(linhasDoPrazo.some((linha) => linha.includes('ia.execucao.falhou') && linha.includes(execucaoId))).toBe(false)
    expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'rodando', erro: null })
  })
})

describe('o pool do banco', () => {
  it('20 execuções lentas no pool de 20: nenhuma segura conexão durante o modelo, e um `select` responde no meio', async () => {
    const aqui = await FilaDeIa.subir(medidor.medidor, {}, undefined, { registro: registroDeTeste(), pools: { interativa: 20, ferramenta: 20, normal: 5 }, conexoes: 20 })
    try {
      const [e1, e2] = [await montarEscola(aqui), await montarEscola(aqui)]
      let chamadas = 0
      let liberar: () => void = () => undefined
      const solta = new Promise<void>((resolver) => (liberar = resolver))
      aqui.comModelo(async () => {
        chamadas += 1
        await solta
        return { saida: {}, medicao: {} }
      })
      // 10 vagas do Tutor por escola: duas escolas enchem as 20 execuções.
      const ids = (await Promise.all([e1, e2].flatMap((escola) => Array.from({ length: 10 }, () => agendar(aqui, escola, pedidoDe(escola, 'turno_do_tutor')))))).map((resposta) => resposta.execucaoId)
      try {
        await esperar(() => chamadas === 20, 'as 20 execuções chegarem ao modelo', 40_000)
        const inicio = performance.now()
        const { rows } = await aqui.pool.query<{ um: number }>('select 1 as um')
        expect(rows[0]?.um).toBe(1)
        expect(performance.now() - inicio).toBeLessThan(1_000)
        expect(aqui.pool.waitingCount).toBe(0)
      } finally {
        liberar()
      }
      await aqui.ociosa(40_000)
      for (const id of ids) expect((await execucaoDe(id)).estado, id).toBe('concluida')
      for (const escola of [e1, e2]) {
        await sql('delete from consumo_ia where escola_id = $1', [escola.escolaId])
        await sql('delete from execucao_agente where escola_id = $1', [escola.escolaId])
      }
    } finally {
      await aqui.fechar()
    }
  }, 120_000)
})

describe('Redis de fila fora', () => {
  beforeAll(() => {
    // O worker e o despachante do compose de pé disputariam o job com os desta bancada.
    compose('stop', ...PROCESSOS_DA_FILA)
  })

  afterEach(async () => {
    compose('unpause', 'redis-fila')
    await composeAssincronoOuFalha('up', '--detach', 'redis-fila')
    await aguardarSaudavel('redis-fila')
  }, 120_000)

  it('o POST dá 202 depressa e o job fica gravado; na volta do Redis, a execução conclui uma vez', async () => {
    const aqui = await FilaDeIa.subir(medidor.medidor, {}, undefined, { registro: registroDeTeste(), semConsumir: true })
    try {
      const escola = await montarEscola(aqui)
      await composeAssincronoOuFalha('stop', 'redis-fila')
      const inicio = performance.now()
      const { execucaoId } = await agendar(aqui, escola, pedidoDe(escola, 'propor_ferramenta'))
      expect(performance.now() - inicio).toBeLessThan(2_000)
      expect((await execucaoDe(execucaoId)).estado).toBe('pendente')
      expect((await jobsDa(execucaoId)).map((job) => job.estado)).toEqual(['aguardando'])

      await composeAssincronoOuFalha('up', '--detach', 'redis-fila')
      await aguardarSaudavel('redis-fila')
      aqui.ligar()
      await aqui.ociosa(60_000)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'concluida', erro: null })
      expect(await consumosDa(execucaoId)).toBe(1)
      await sql('delete from consumo_ia where escola_id = $1', [escola.escolaId])
      await sql('delete from execucao_agente where escola_id = $1', [escola.escolaId])
    } finally {
      await aqui.fechar()
    }
  }, 180_000)
})
