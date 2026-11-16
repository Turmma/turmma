import { alunoTrailStatement, currentContext, runInContext, TASK_CATALOG, type DestinoDoAdaptador, type proporFerramenta, type turnoDoTutor } from '@educa/core'
import { ErrorCode, type ResultadoGravado, type TarefaDeIa } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { aguardarSaudavel, compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA } from '../../../../tools/testes/compose.ts'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-turma.fixture.js'
import { FilaDeIa, type ModeloDeTeste } from '../../test/fila-de-ia.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import type { EntradaDaTarefa, ExecucaoCommand, SaidaDaTarefa } from './execucao-command.js'
import { ExecucaoRepository } from './execucao.repository.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { RegistroDeComandos } from './registro-de-comandos.js'
import { LIMITE_DA_RODANDO_SEGUNDOS, LOTE_DA_VARREDURA, PASSADAS_MAXIMAS, PIOR_CASO_DA_VARREDURA_MS, INTERVALO_DA_VARREDURA_MS } from './varredura-de-execucoes.js'

/**
 * A execução duplicada ou interrompida (reengenharia-continuacao, 6.0; `techspec.md` §5 "Os estados" e "A varredura", §8; `cenarios.md` §1, §3 e §6). A reentrega do job que
 * acha a execução `rodando` a encerra com `EXECUCAO_INTERROMPIDA`, sem modelo e sem troca, e a varredura de 60 s encerra a `rodando` de mais de 300 s e a `pendente` sem job
 * vivo. Toda `rodando` encerrada deixa a linha estimada em `consumo_ia`, na mesma transação, no rastro de quem a pediu: o custo a mais, nunca a menos (D14).
 *
 * A bancada é a `FilaDeIa`, sem consumir (`semConsumir`): o teste escolhe o instante em que o job é entregue (`entregarDeNovo`) e chama a varredura (`varrer`). A idade
 * das execuções se faz recuando `iniciada_em` no banco, e nunca com relógio de JS. Cada bloco sobe a sua bancada e a fecha: o `job_registro` é um só.
 */
const medidor = new MedidorDeTeste()
const bancada = new SessaoFixtures()
const sql = <Resultado extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Resultado>(texto, valores)

const ENTRADA_DA_FERRAMENTA: EntradaDaTarefa<typeof proporFerramenta> = { mensagem: 'monta uma atividade com 5 questões sobre reagente limitante', contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], turnosAnteriores: [] }
const ENTRADA_DO_TUTOR: EntradaDaTarefa<typeof turnoDoTutor> = { duvida: 'não entendi essa parte', contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], memoria: [], turnosAnteriores: [] }

/** A turma de cada escola montada neste arquivo, que o comando do Tutor entrega ao `preparar`. */
const TURMA_DA_ESCOLA = new Map<string, string>()

/** O registro com um comando de teste para a tarefa de cada fila: o `preparar` entrega a entrada fixa e o `concluir` devolve só a referência. */
function registroDeTeste(): RegistroDeComandos {
  const registro = new RegistroDeComandos()
  const ferramenta: ExecucaoCommand<EntradaDaTarefa<typeof proporFerramenta>, SaidaDaTarefa<typeof proporFerramenta>, Record<string, never>> = {
    tarefa: TASK_CATALOG.propor_ferramenta,
    fila: 'ferramenta',
    preparar: () => Promise.resolve({ entrada: ENTRADA_DA_FERRAMENTA, lido: {} }),
    concluir: (): Promise<ResultadoGravado> => Promise.resolve({ tipo: 'mensagem', mensagemId: randomUUID() }),
  }
  const tutor: ExecucaoCommand<EntradaDaTarefa<typeof turnoDoTutor>, SaidaDaTarefa<typeof turnoDoTutor>, Record<string, never>> = {
    tarefa: TASK_CATALOG.turno_do_tutor,
    fila: 'interativa',
    preparar: () => {
      const contexto = currentContext()
      return Promise.resolve({ entrada: ENTRADA_DO_TUTOR, lido: {}, alunoId: contexto?.usuarioId ?? '', turmaId: TURMA_DA_ESCOLA.get(contexto?.escolaId ?? '') ?? '' })
    },
    concluir: (): Promise<ResultadoGravado> => Promise.resolve({ tipo: 'mensagem_do_tutor', mensagemId: randomUUID() }),
  }
  registro.registrar(ferramenta)
  registro.registrar(tutor)
  return registro
}

type Tarefa = Extract<TarefaDeIa, 'propor_ferramenta' | 'turno_do_tutor'>

interface Escola extends EscolaComTurma {
  readonly escolaId: string
  readonly professor: TestSessao
  readonly aluno: TestSessao
  readonly outroAluno: TestSessao
}

async function alunoNaTurma(escola: EscolaComTurma, escolaId: string): Promise<TestSessao> {
  const aluno = await bancada.sessao(escolaId, 'aluno')
  await sql(`insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`, [escolaId, escola.anoLetivoId, aluno.usuarioId, escola.turma, escola.coordenacao.usuarioId])
  return aluno
}

async function montarEscola(fila: FilaDeIa): Promise<Escola> {
  const escola = await montarEscolaComTurma(fila.api, bancada)
  const escolaId = escola.coordenacao.escolaId
  TURMA_DA_ESCOLA.set(escolaId, escola.turma)
  return { ...escola, escolaId, professor: await bancada.sessao(escolaId, 'professor'), aluno: await alunoNaTurma(escola, escolaId), outroAluno: await alunoNaTurma(escola, escolaId) }
}

interface Semente {
  readonly tarefa?: Tarefa
  /** Quem pediu: o professor, ou o aluno no Tutor. */
  readonly por?: TestSessao
  readonly estado?: 'pendente' | 'rodando'
  /** Há quantos segundos, pelo relógio do banco, a execução está `rodando` (`iniciada_em`) ou `pendente` (`criada_em`). */
  readonly haSegundos?: number
}

/** Uma execução gravada à mão, sem job: o estado e a idade vêm do banco, e nunca do relógio de JS. */
async function semear(escola: Escola, { tarefa = 'propor_ferramenta', por = escola.professor, estado = 'rodando', haSegundos = 301 }: Semente = {}): Promise<string> {
  const funcao = tarefa === 'turno_do_tutor' ? 'tutor_com_o_aluno' : 'conversa_e_ferramentas'
  const { rows } = await sql<{ id: string }>('insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
    escola.escolaId,
    escola.anoLetivoId,
    funcao,
    tarefa,
    por.usuarioId,
    randomUUID(),
    JSON.stringify({ tarefa }),
  ])
  const id = rows[0]?.id ?? ''
  if (estado === 'rodando') await sql(`update execucao_agente set estado = 'rodando', iniciada_em = now() - make_interval(secs => $2) where id = $1`, [id, haSegundos])
  else await sql('update execucao_agente set criada_em = now() - make_interval(secs => $2) where id = $1', [id, haSegundos])
  return id
}

interface Job {
  readonly estado?: string
  readonly fila?: string
  readonly tipo?: string
  /** A escola dona do job. Sem ela, a da execução. */
  readonly escolaId?: string
  readonly execucaoId?: string
}

/** O job no outbox, como o `agendar` o grava; `aguardando` é o vivo. */
async function semearJob(escola: Escola, execucaoId: string, { estado = 'aguardando', fila = 'ferramenta', tipo = 'ia.executar', escolaId = escola.escolaId, execucaoId: noPayload = execucaoId }: Job = {}): Promise<void> {
  await sql('insert into job_registro (escola_id, fila, prioridade, tipo, dados, estado) values ($1, $2, 2, $3, $4::jsonb, $5)', [escolaId, fila, tipo, JSON.stringify({ execucaoId: noPayload }), estado])
}

interface Execucao {
  readonly estado: string
  readonly erro: string | null
  readonly resultado: unknown
}
const execucaoDe = async (id: string): Promise<Execucao> => (await sql<Execucao & Record<string, unknown>>('select estado, erro, resultado from execucao_agente where id = $1', [id])).rows[0] ?? { estado: 'inexistente', erro: null, resultado: null }

interface ConsumoLido {
  readonly escola_id: string
  readonly aluno_id: string | null
  readonly tarefa: string
  readonly funcao: string
  readonly perfil: string
  readonly origem: string
  readonly modelo: string
  readonly prompt_versao: string
  readonly tokens_de_entrada: number
  readonly tokens_de_saida: number
  readonly tentativas: number
  readonly estado: string
  readonly codigo_de_erro: string | null
  readonly entrada: unknown
  readonly saida: unknown
  readonly envio_externo: boolean
  readonly provedor: string | null
  readonly duracao_ms: number
}
const linhasDe = async (execucaoId: string): Promise<ConsumoLido[]> =>
  (
    await sql<ConsumoLido & Record<string, unknown>>(
      `select escola_id, aluno_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, tentativas, estado, codigo_de_erro, entrada, saida, envio_externo, provedor, duracao_ms
         from consumo_ia where execucao_id = $1 order by em, id`,
      [execucaoId],
    )
  ).rows

/** A linha estimada que a tarefa deve deixar: os dois tetos, o envio do destino, e nenhuma pessoa nem texto. */
function estimadaDe(tarefa: Tarefa, escola: Escola, destino: DestinoDoAdaptador) {
  const definicao = TASK_CATALOG[tarefa]
  return {
    escola_id: escola.escolaId,
    aluno_id: null,
    tarefa,
    funcao: definicao.funcao,
    perfil: definicao.perfil,
    origem: destino.origem,
    modelo: destino.modeloDoPerfil(definicao.perfil),
    prompt_versao: definicao.prompt.versao,
    tokens_de_entrada: definicao.maximoDeTokensDeEntrada,
    tokens_de_saida: definicao.maximoDeTokensDeSaida,
    tentativas: 1,
    estado: 'falhou',
    codigo_de_erro: ErrorCode.EXECUCAO_INTERROMPIDA,
    entrada: null,
    saida: null,
    envio_externo: destino.envio.envioExterno,
    provedor: destino.envio.provedorId,
    duracao_ms: expect.any(Number) as number,
  }
}

/** O modelo de mentira que conta as chamadas e deixa o pedido passar pelo gateway de verdade (o que registra a linha do original). */
function modeloContado(fila: FilaDeIa, { segurar = false }: { segurar?: boolean } = {}) {
  let chamadas = 0
  let chegou: () => void = () => undefined
  let liberar: () => void = () => undefined
  const naChamada = new Promise<void>((resolver) => {
    chegou = resolver
  })
  const liberacao = segurar ? new Promise<void>((resolver) => (liberar = resolver)) : Promise.resolve()
  const modelo: ModeloDeTeste = async (pedido) => {
    chamadas += 1
    chegou()
    await liberacao
    return fila.falso().gerar(pedido as Parameters<ReturnType<FilaDeIa['falso']>['gerar']>[0])
  }
  fila.comModelo(modelo)
  return { chamadas: () => chamadas, naChamada, liberar }
}

/** Espera até `condicao` valer, ou falha: o que o teste espera é o efeito no banco. */
async function esperar(condicao: () => boolean | Promise<boolean>, descricao: string, limiteMs = 10_000): Promise<void> {
  const prazo = Date.now() + limiteMs
  while (!(await condicao())) {
    if (Date.now() > prazo) throw new Error(`não aconteceu no prazo: ${descricao}`)
    await new Promise((resolver) => setTimeout(resolver, 25))
  }
}

/** Um gatilho do banco de teste que faz a gravação da linha estimada falhar, só para a execução dada. */
async function quebrarAGravacaoDa(execucaoId: string): Promise<() => Promise<void>> {
  const nome = `teste_sem_linha_${randomBytes(6).toString('hex')}`
  await sql(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'a gravação da linha estimada falhou de propósito'; end $$`)
  await sql(`create trigger ${nome} before insert on consumo_ia for each row when (new.execucao_id = '${execucaoId}'::uuid) execute function ${nome}()`)
  return async () => {
    await sql(`drop trigger if exists ${nome} on consumo_ia`)
    await sql(`drop function if exists ${nome}()`)
  }
}

async function limpar(...escolas: Escola[]): Promise<void> {
  const ids = escolas.map((escola) => escola.escolaId)
  for (const tabela of ['mensagem_tutor', 'consumo_ia', 'job_registro', 'execucao_agente', 'configuracao_operacional_escola']) await sql(`delete from ${tabela} where escola_id = any($1::uuid[])`, [ids])
}

afterAll(async () => {
  await bancada.fechar()
})

describe('a execução interrompida: a reentrega e a varredura (adaptador falso)', () => {
  const linhasDeLog: string[] = []
  let fila: FilaDeIa
  let a: Escola
  let b: Escola

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor, {}, linhasDeLog, { registro: registroDeTeste(), semConsumir: true })
    a = await montarEscola(fila)
    b = await montarEscola(fila)
  })

  afterEach(() => {
    fila.restaurar()
  })

  afterAll(async () => {
    await fila.fechar()
    await limpar(a, b)
  })

  describe('a reentrega do job', () => {
    it('worker morto: a reentrega encerra com EXECUCAO_INTERROMPIDA, sem modelo, e deixa uma linha estimada', async () => {
      const id = await semear(a, { haSegundos: 20 })
      // Outra execução da mesma escola, também `rodando`: a reentrega encerra a do job, e só ela.
      const outra = await semear(a, { haSegundos: 20 })
      const modelo = modeloContado(fila)
      await fila.entregarDeNovo(id, a.escolaId)
      expect(modelo.chamadas()).toBe(0)
      expect(await execucaoDe(outra)).toEqual({ estado: 'rodando', erro: null, resultado: null })
      expect(await linhasDe(outra)).toEqual([])
      expect(await execucaoDe(id)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      // Os dois tetos da tarefa, o resto nulo, e a duração desde o `rodando`, que o banco mede.
      expect(await linhasDe(id)).toEqual([estimadaDe('propor_ferramenta', a, fila.destino)])
      expect((await linhasDe(id))[0]?.duracao_ms).toBeGreaterThanOrEqual(20_000)
    })

    it('linha estimada, falso ou local: não conta como envio externo', async () => {
      const id = await semear(a, { haSegundos: 20 })
      await fila.entregarDeNovo(id, a.escolaId)
      const [linha] = await linhasDe(id)
      expect(fila.destino.envio).toEqual({ envioExterno: false, provedorId: null })
      expect(linha).toMatchObject({ envio_externo: false, provedor: null, origem: 'falso' })
      expect(await sql('select 1 from consumo_ia where execucao_id = $1 and (envio_externo or provedor is not null)', [id])).toMatchObject({ rowCount: 0 })
    })

    it('fora do freio: a linha estimada não leva o aluno, e a pergunta da execução interrompida não conta no dia', async () => {
      await sql('insert into configuracao_operacional_escola (escola_id, tutor_trocas_por_dia) values ($1, 1) on conflict (escola_id) do update set tutor_trocas_por_dia = 1', [a.escolaId])
      const perguntar = (execucaoId: string) =>
        sql(`insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto) values ($1, $2, $3, $4, $5, 'aluno', 'não entendi')`, [a.escolaId, a.anoLetivoId, a.turma, a.aluno.usuarioId, execucaoId])
      const consultar = () => fila.como(a.escolaId, a.aluno.usuarioId, () => new OrcamentoRepository(fila.banco).consultar({ funcao: 'tutor_com_o_aluno', alunoId: a.aluno.usuarioId }))
      const interrompida = await semear(a, { tarefa: 'turno_do_tutor', por: a.aluno, haSegundos: 20 })
      await perguntar(interrompida)
      // A pergunta em andamento conta no freio (limite 1): é o controle de que a consulta enxerga a pergunta.
      expect(await consultar()).toMatchObject({ permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' })
      await fila.entregarDeNovo(interrompida, a.escolaId)
      // Encerrada, a pergunta não gasta o dia, e a linha estimada não leva o aluno.
      expect(await consultar()).toEqual({ permitido: true })
      expect((await linhasDe(interrompida)).map((linha) => linha.aluno_id)).toEqual([null])
      expect((await linhasDe(interrompida)).map((linha) => linha.funcao)).toEqual(['tutor_com_o_aluno'])
      await sql('delete from configuracao_operacional_escola where escola_id = $1', [a.escolaId])
    })

    it('duplicada em corrida: a segunda entrega acha `rodando` e encerra; a conclusão da primeira não muda a linha, e o modelo é chamado uma vez só', async () => {
      const id = await semear(a, { estado: 'pendente', haSegundos: 5 })
      const modelo = modeloContado(fila, { segurar: true })
      const primeira = fila.entregarDeNovo(id, a.escolaId)
      await modelo.naChamada
      expect((await execucaoDe(id)).estado).toBe('rodando')
      // A segunda entrega do mesmo job, com a primeira ainda no modelo.
      await fila.entregarDeNovo(id, a.escolaId)
      expect(await execucaoDe(id)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect(await linhasDe(id)).toEqual([estimadaDe('propor_ferramenta', a, fila.destino)])
      modelo.liberar()
      await primeira
      // A resposta da primeira se desfez: a linha segue como a segunda a deixou, sem resultado, e a troca não conta.
      expect(await execucaoDe(id)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect(modelo.chamadas()).toBe(1)
      expect(linhasDeLog.filter((linha) => linha.includes('"evento":"ia.execucao.encerrada_por_outro"') && linha.includes(id))).toHaveLength(1)
    })

    it('o original vivo também registra: a linha dele e a estimada, duas linhas, nunca zero', async () => {
      const id = await semear(a, { estado: 'pendente', haSegundos: 5 })
      const modelo = modeloContado(fila, { segurar: true })
      const primeira = fila.entregarDeNovo(id, a.escolaId)
      await modelo.naChamada
      await fila.entregarDeNovo(id, a.escolaId)
      modelo.liberar()
      await primeira
      const linhas = await linhasDe(id)
      expect(linhas.map((linha) => linha.estado).sort()).toEqual(['concluida', 'falhou'])
      expect(linhas.find((linha) => linha.estado === 'concluida')).toMatchObject({ codigo_de_erro: null, aluno_id: null })
      expect(linhas.find((linha) => linha.estado === 'falhou')).toMatchObject({ codigo_de_erro: 'EXECUCAO_INTERROMPIDA', tokens_de_entrada: TASK_CATALOG.propor_ferramenta.maximoDeTokensDeEntrada })
    })

    it('as duas leem `pendente`: uma só vira `rodando` e chama o modelo, e a outra a encerra sem chamar', async () => {
      const id = await semear(a, { estado: 'pendente', haSegundos: 5 })
      const modelo = modeloContado(fila, { segurar: true })
      // A barreira fica entre a leitura e o `update` que as duas fazem: a primeira para dentro do `update`, com a linha já `rodando`, e a segunda espera a linha.
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.id = '${id}'::uuid and new.estado = 'rodando'` })
      await parada.armar()
      try {
        const entregas = [fila.entregarDeNovo(id, a.escolaId), fila.entregarDeNovo(id, a.escolaId)]
        await parada.esperarParadas(1)
        await esperarNaTrava(bancada.pool, '%update "execucao_agente" set "estado"%', 2)
        await parada.soltar()
        // A que perdeu viu a linha `rodando`, com o modelo da vencedora ainda pendurado, e a encerrou.
        await esperar(async () => (await execucaoDe(id)).estado === 'falhou', 'a segunda entrega encerrar a execução')
        modelo.liberar()
        await Promise.all(entregas)
      } finally {
        await parada.desarmar()
      }
      expect(modelo.chamadas()).toBe(1)
      expect(await execucaoDe(id)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect((await linhasDe(id)).filter((linha) => linha.estado === 'falhou')).toHaveLength(1)
    })

    it('a gravação falha: o encerramento se desfaz, a execução segue `rodando` para a varredura, e o aviso leva só ids', async () => {
      const id = await semear(a, { haSegundos: 20 })
      const consertar = await quebrarAGravacaoDa(id)
      try {
        await fila.entregarDeNovo(id, a.escolaId)
        expect(await execucaoDe(id)).toEqual({ estado: 'rodando', erro: null, resultado: null })
        expect(await linhasDe(id)).toEqual([])
        const aviso = linhasDeLog.find((linha) => linha.includes('"evento":"ia.execucao.interrupcao_nao_gravada"') && linha.includes(id))
        expect(aviso).toBeDefined()
        expect(aviso).not.toContain('de propósito')
      } finally {
        await consertar()
      }
      // Com a gravação de volta, a mesma entrega encerra: o controle de que foi o gatilho que segurou.
      await fila.entregarDeNovo(id, a.escolaId)
      expect(await execucaoDe(id)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect(await linhasDe(id)).toHaveLength(1)
    })

    it('isolamento, reentrega: o job da A com o `execucaoId` da B, já `rodando`, não muda nada na B e não deixa linha', async () => {
      const daB = await semear(b, { haSegundos: 20 })
      const modelo = modeloContado(fila)
      await expect(fila.entregarDeNovo(daB, a.escolaId)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' })
      expect(await execucaoDe(daB)).toEqual({ estado: 'rodando', erro: null, resultado: null })
      expect(await linhasDe(daB)).toEqual([])
      expect(modelo.chamadas()).toBe(0)
      // O repository, no contexto da A, não alcança a da B; no da B, encerra: o controle de que o `where` é o que a protege.
      expect(await fila.como(a.escolaId, a.professor.usuarioId, () => new ExecucaoRepository(fila.banco).encerrarRodando(daB))).toBeUndefined()
      expect(await execucaoDe(daB)).toMatchObject({ estado: 'rodando' })
      expect(await fila.como(b.escolaId, b.professor.usuarioId, () => new ExecucaoRepository(fila.banco).encerrarRodando(daB))).toMatchObject({ id: daB, escolaId: b.escolaId, tarefa: 'propor_ferramenta' })
      expect(await execucaoDe(daB)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
    })

    it('a execução que já terminou ou já foi encerrada não ganha linha na reentrega', async () => {
      const concluida = await semear(a, { haSegundos: 20 })
      await sql(`update execucao_agente set estado = 'concluida', resultado = $2::jsonb, concluida_em = now() where id = $1`, [concluida, JSON.stringify({ tipo: 'mensagem', mensagemId: randomUUID() })])
      const jaEncerrada = await semear(a, { haSegundos: 20 })
      await sql(`update execucao_agente set estado = 'falhou', erro = 'IA_INDISPONIVEL', concluida_em = now() where id = $1`, [jaEncerrada])
      const modelo = modeloContado(fila)
      await fila.entregarDeNovo(concluida, a.escolaId)
      await fila.entregarDeNovo(jaEncerrada, a.escolaId)
      expect(modelo.chamadas()).toBe(0)
      expect(await execucaoDe(concluida)).toMatchObject({ estado: 'concluida', erro: null })
      expect(await execucaoDe(jaEncerrada)).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
      expect(await linhasDe(concluida)).toEqual([])
      expect(await linhasDe(jaEncerrada)).toEqual([])
      // O log diz que já estava tratada, e não que a interrompeu.
      for (const id of [concluida, jaEncerrada]) {
        expect(linhasDeLog.some((linha) => linha.includes('"evento":"ia.execucao.ja_tratada"') && linha.includes(id))).toBe(true)
        expect(linhasDeLog.some((linha) => linha.includes('"evento":"ia.execucao.interrompida"') && linha.includes(id))).toBe(false)
      }
    })
  })

  describe('a varredura de 60 s', () => {
    it('varredura, limiar: a `rodando` de 301 s é encerrada com a linha estimada, e a de 299 s fica', async () => {
      const velha = await semear(a, { haSegundos: 301 })
      const quase = await semear(a, { haSegundos: 299 })
      await fila.varredura().varrer()
      expect(await execucaoDe(velha)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect(await linhasDe(velha)).toEqual([estimadaDe('propor_ferramenta', a, fila.destino)])
      // A duração da linha é a do banco, desde o `rodando`.
      expect((await linhasDe(velha))[0]?.duracao_ms).toBeGreaterThanOrEqual(301_000)
      expect(await execucaoDe(quase)).toEqual({ estado: 'rodando', erro: null, resultado: null })
      expect(await linhasDe(quase)).toEqual([])
      // O limiar é o dobro do `prazoMs` do job, e a varredura anda de 60 em 60 s.
      expect(LIMITE_DA_RODANDO_SEGUNDOS).toBe(300)
      expect(INTERVALO_DA_VARREDURA_MS).toBe(60_000)
    })

    it('varredura, execução esquecida há mais de 24,8 dias: a `rodando` encerra com a duração no teto do inteiro da linha, e não trava a volta das outras `rodando`', async () => {
      const esquecida = await semear(a, { haSegundos: 40 * 24 * 3600 })
      // Na outra escola: o lote mistura escolas, e a linha de cada execução vai para a dela.
      const recente = await semear(b, { haSegundos: 301 })
      expect(await fila.varredura().varrer()).toBeGreaterThanOrEqual(2)
      expect(await execucaoDe(esquecida)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect((await linhasDe(esquecida))[0]?.duracao_ms).toBe(2_147_483_647)
      expect(await execucaoDe(recente)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect(await linhasDe(recente)).toEqual([estimadaDe('propor_ferramenta', b, fila.destino)])
    })

    it('reentrega, execução esquecida há mais de 24,8 dias: a `rodando` encerra com a linha no teto do inteiro, e não cai em `interrupcao_nao_gravada`', async () => {
      const id = await semear(a, { haSegundos: 40 * 24 * 3600 })
      await fila.entregarDeNovo(id, a.escolaId)
      expect(await execucaoDe(id)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect((await linhasDe(id))[0]?.duracao_ms).toBe(2_147_483_647)
      expect(linhasDeLog.some((linha) => linha.includes('"evento":"ia.execucao.interrupcao_nao_gravada"') && linha.includes(id))).toBe(false)
    })

    it('varredura, `pendente`: com job vivo fica; sem job, com job final, de outro tipo, de outra fila ou de outra execução, é encerrada sem linha', async () => {
      const comJobVivo = await semear(a, { estado: 'pendente', haSegundos: 5 })
      await semearJob(a, comJobVivo)
      // O job vivo na manhã de segunda, e com o Redis fora, está em qualquer estado que não seja final: reservado, publicado ou ativo.
      const comJobEmAndamento: string[] = []
      for (const estado of ['reservado', 'publicado', 'ativo']) {
        const id = await semear(a, { estado: 'pendente', haSegundos: 5 })
        await semearJob(a, id, { estado })
        comJobEmAndamento.push(id)
      }
      const comJobConcluido = await semear(a, { estado: 'pendente', haSegundos: 5 })
      await semearJob(a, comJobConcluido, { estado: 'concluido' })
      const comJobFalhou = await semear(a, { estado: 'pendente', haSegundos: 5 })
      await semearJob(a, comJobFalhou, { estado: 'falhou' })
      const semJob = await semear(a, { estado: 'pendente', haSegundos: 5 })
      const deOutroTipo = await semear(a, { estado: 'pendente', haSegundos: 5 })
      await semearJob(a, deOutroTipo, { tipo: 'sistema.expurgar-jobs' })
      const deOutraFila = await semear(a, { estado: 'pendente', haSegundos: 5 })
      await semearJob(a, deOutraFila, { fila: 'lote' })
      const deOutraExecucao = await semear(a, { estado: 'pendente', haSegundos: 5 })
      await semearJob(a, deOutraExecucao, { execucaoId: randomUUID() })
      await fila.varredura().varrer()
      for (const viva of [comJobVivo, ...comJobEmAndamento]) {
        expect((await execucaoDe(viva)).estado).toBe('pendente')
        expect(await linhasDe(viva)).toEqual([])
      }
      for (const encerrada of [comJobConcluido, comJobFalhou, semJob, deOutroTipo, deOutraFila, deOutraExecucao]) {
        expect(await execucaoDe(encerrada)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
        // O modelo nunca foi chamado: nenhuma linha.
        expect(await linhasDe(encerrada)).toEqual([])
      }
    })

    it('varredura, escola: o job vivo de outra escola com o mesmo `execucaoId` não segura a `pendente`', async () => {
      const daA = await semear(a, { estado: 'pendente', haSegundos: 5 })
      await semearJob(a, daA, { escolaId: b.escolaId })
      const controle = await semear(a, { estado: 'pendente', haSegundos: 5 })
      await semearJob(a, controle)
      await fila.varredura().varrer()
      expect(await execucaoDe(daA)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      // O controle: o job vivo da própria escola segura.
      expect((await execucaoDe(controle)).estado).toBe('pendente')
    })

    it('varredura, duas réplicas: o encerramento e a linha saem uma vez só, mesmo com duas varreduras juntas na mesma `rodando`', async () => {
      const id = await semear(a, { haSegundos: 301 })
      // A barreira fica entre o `update … returning` e o `commit` da primeira: a segunda espera a linha e, depois, a acha encerrada.
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.id = '${id}'::uuid and new.estado = 'falhou'` })
      await parada.armar()
      try {
        const varreduras = [fila.varredura().varrer(), fila.varredura().varrer()]
        await parada.esperarParadas(1)
        await esperarNaTrava(bancada.pool, '%update execucao_agente x set estado%', 2)
        await parada.soltar()
        await Promise.all(varreduras)
      } finally {
        await parada.desarmar()
      }
      expect(await execucaoDe(id)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect(await linhasDe(id)).toEqual([estimadaDe('propor_ferramenta', a, fila.destino)])
    })

    it('varredura, duas réplicas na `pendente`: a execução sem job é encerrada, e contada, uma vez só', async () => {
      const id = await semear(a, { estado: 'pendente', haSegundos: 5 })
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.id = '${id}'::uuid and new.estado = 'falhou'` })
      await parada.armar()
      // Um gatilho por linha, só desta execução, conta quantas vezes ela foi encerrada: com a condição de estado no `update`, a réplica que perdeu a acha `falhou` e não a escreve de novo.
      const nome = `teste_encerramentos_${randomBytes(6).toString('hex')}`
      await sql(`create sequence ${nome}`)
      await sql(`create function ${nome}() returns trigger language plpgsql as $$ begin perform nextval('${nome}'); return null; end $$`)
      await sql(`create trigger ${nome} after update on execucao_agente for each row when (old.id = '${id}'::uuid and new.estado = 'falhou') execute function ${nome}()`)
      try {
        const varreduras = [fila.varredura().varrer(), fila.varredura().varrer()]
        await parada.esperarParadas(1)
        await esperarNaTrava(bancada.pool, '%update execucao_agente x set estado%', 2)
        await parada.soltar()
        await Promise.all(varreduras)
        const { rows } = await sql<{ encerramentos: string }>(`select case when is_called then last_value else 0 end as encerramentos from ${nome}`)
        expect(Number(rows[0]?.encerramentos)).toBe(1)
      } finally {
        await parada.desarmar()
        await sql(`drop trigger if exists ${nome} on execucao_agente`)
        await sql(`drop function if exists ${nome}()`)
        await sql(`drop sequence if exists ${nome}`)
      }
      expect(await execucaoDe(id)).toEqual({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA', resultado: null })
      expect(await linhasDe(id)).toEqual([])
    })

    it('varredura, duas escolas: cada linha estimada fica na escola da execução, e a `pendente` encerrada no mesmo ciclo não gera linha', async () => {
      const daA = await semear(a, { tarefa: 'turno_do_tutor', por: a.aluno })
      const daB = await semear(b, { haSegundos: 400 })
      const pendente = await semear(b, { estado: 'pendente', haSegundos: 5 })
      await fila.varredura().varrer()
      expect(await linhasDe(daA)).toEqual([estimadaDe('turno_do_tutor', a, fila.destino)])
      expect(await linhasDe(daB)).toEqual([estimadaDe('propor_ferramenta', b, fila.destino)])
      expect(await execucaoDe(pendente)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect(await linhasDe(pendente)).toEqual([])
    })

    it('a gravação da linha falha: o lote da varredura se desfaz, e a `rodando` segue como estava para a volta seguinte', async () => {
      const id = await semear(a, { haSegundos: 301 })
      const consertar = await quebrarAGravacaoDa(id)
      // A mesma varredura nas duas voltas: a que falhou libera a vez da seguinte.
      const varredura = fila.varredura()
      try {
        await expect(varredura.varrer()).resolves.toBe(0)
        expect(await execucaoDe(id)).toEqual({ estado: 'rodando', erro: null, resultado: null })
        expect(await linhasDe(id)).toEqual([])
        expect(linhasDeLog.some((linha) => linha.includes('"evento":"ia.execucao.varredura_falhou"'))).toBe(true)
      } finally {
        await consertar()
      }
      await varredura.varrer()
      expect(await execucaoDe(id)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect(await linhasDe(id)).toHaveLength(1)
    })

    /** Execuções já terminadas e velhas, mais antigas que as que o teste varre: se a varredura deixasse de filtrar por estado, elas ocupariam o lote. */
    const iscas = async (escola: Escola, quantas: number): Promise<void> => {
      await sql(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, iniciada_em, criada_em, concluida_em)
         select $1, $2, 'conversa_e_ferramentas', 'propor_ferramenta', $3, gen_random_uuid(), '{"tarefa":"propor_ferramenta"}'::jsonb, 'falhou', 'IA_INDISPONIVEL', now() - interval '3 hours', now() - interval '3 hours', now() - interval '2 hours' from generate_series(1, $4::int)`,
        [escola.escolaId, escola.anoLetivoId, escola.professor.usuarioId, quantas],
      )
    }

    it('o lote limita o passo: a `rodando` e a `pendente` sem job encerram até o lote, e as execuções que já terminaram não o ocupam', async () => {
      await iscas(b, 20)
      for (let i = 0; i < 12; i += 1) await semear(b, { haSegundos: 400 })
      for (let i = 0; i < 12; i += 1) await semear(b, { estado: 'pendente', haSegundos: 5 })
      const repositorio = () => new ExecucaoRepository(fila.banco)
      const daRotina = <T>(corpo: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, corpo)
      const encerradas = await daRotina(() => repositorio().encerrarRodandasVelhas(LIMITE_DA_RODANDO_SEGUNDOS, 7))
      expect(encerradas).toHaveLength(7)
      expect(await daRotina(() => repositorio().encerrarPendentesSemJob(5))).toBe(5)
    })

    it('a conta do laço: o pior caso cabe nos 60 s; o laço repete até esvaziar, para no teto de passadas e para no sinal', async () => {
      // O pior caso (2 tipos × 5 passos × 5 s = 50 s) fica abaixo do intervalo: a volta nunca encosta na seguinte. O teto das passadas é o que a volta abaixo prova.
      expect(PIOR_CASO_DA_VARREDURA_MS).toBeLessThanOrEqual(INTERVALO_DA_VARREDURA_MS)
      // Uma passada a mais que o teto das passadas: o que passa do teto fica para a volta seguinte.
      const quantas = LOTE_DA_VARREDURA * PASSADAS_MAXIMAS + 50
      const { rows } = await sql<{ id: string }>(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, iniciada_em)
         select $1, $2, 'conversa_e_ferramentas', 'propor_ferramenta', $3, gen_random_uuid(), '{"tarefa":"propor_ferramenta"}'::jsonb, 'rodando', now() - interval '1 hour' from generate_series(1, $4::int) returning id`,
        [b.escolaId, b.anoLetivoId, b.professor.usuarioId, quantas],
      )
      const semeadas = rows.map((linha) => linha.id)
      const aindaRodando = async (): Promise<number> => Number((await sql<{ total: string }>(`select count(*) as total from execucao_agente where id = any($1::uuid[]) and estado = 'rodando'`, [semeadas])).rows[0]?.total)
      // Com o sinal dado, a volta não começa passo nenhum.
      const parada = fila.varredura()
      parada.encerrar()
      expect(await parada.varrer()).toBe(0)
      expect(await aindaRodando()).toBe(quantas)
      // Sem ele, a volta encerra até o teto (cinco lotes) e deixa o resto: nunca passa do tempo do intervalo.
      expect(await fila.varredura().varrer()).toBeLessThanOrEqual(LOTE_DA_VARREDURA * PASSADAS_MAXIMAS * 2)
      expect(await aindaRodando()).toBeGreaterThan(0)
      // A volta seguinte esvazia, e cada execução ficou com uma linha estimada, nem mais nem menos.
      await fila.varredura().varrer()
      expect(await aindaRodando()).toBe(0)
      expect(Number((await sql<{ total: string }>('select count(*) as total from consumo_ia where execucao_id = any($1::uuid[])', [semeadas])).rows[0]?.total)).toBe(quantas)
    })

    it('a volta para quando o lote não enche: uma consulta por tipo, e não as cinco passadas', async () => {
      for (let i = 0; i < 3; i += 1) await semear(a, { haSegundos: 301 })
      for (let i = 0; i < 2; i += 1) await semear(a, { estado: 'pendente', haSegundos: 5 })
      // Um gatilho de comando (um por instrução, mesmo sem linha) conta os `update` que a varredura manda à tabela.
      const nome = `teste_passos_${randomBytes(6).toString('hex')}`
      await sql(`create sequence ${nome}`)
      await sql(`create function ${nome}() returns trigger language plpgsql as $$ begin perform nextval('${nome}'); return null; end $$`)
      await sql(`create trigger ${nome} after update on execucao_agente for each statement execute function ${nome}()`)
      try {
        const total = await fila.varredura().varrer()
        expect(total).toBeGreaterThanOrEqual(5)
        const { rows } = await sql<{ passos: string }>(`select case when is_called then last_value else 0 end as passos from ${nome}`)
        expect(Number(rows[0]?.passos)).toBe(2)
      } finally {
        await sql(`drop trigger if exists ${nome} on execucao_agente`)
        await sql(`drop function if exists ${nome}()`)
        await sql(`drop sequence if exists ${nome}`)
      }
    })

    it('a varredura que está rodando não é repetida por cima: a segunda volta, com a primeira em curso, não faz nada', async () => {
      const id = await semear(a, { haSegundos: 301 })
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.id = '${id}'::uuid and new.estado = 'falhou'` })
      await parada.armar()
      const varredura = fila.varredura()
      try {
        const primeira = varredura.varrer()
        await parada.esperarParadas(1)
        // A mesma varredura, chamada com a primeira em curso, volta na hora, sem esperar a linha (que o `statement_timeout` de 5 s derrubaria).
        const inicio = Date.now()
        expect(await varredura.varrer()).toBe(0)
        expect(Date.now() - inicio).toBeLessThan(1_500)
        await parada.soltar()
        await primeira
      } finally {
        await parada.desarmar()
      }
      expect(await linhasDe(id)).toHaveLength(1)
    })

    it('o `EXPLAIN` da sondagem do `not exists` da `pendente` desce pelo `job_registro_pendentes_idx`, pela fila e pela escola', async () => {
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        // O volume, sem montar as FKs: só dentro desta transação, que termina em `rollback`. Um job de cada 200 é da escola da sondagem, e um de cada três já terminou.
        await cliente.query('set local session_replication_role = replica')
        await cliente.query(
          `insert into job_registro (escola_id, fila, prioridade, tipo, dados, estado, criado_em)
           select case when n % 200 = 0 then $1::uuid else gen_random_uuid() end, (array['interativa', 'ferramenta', 'normal', 'lote', 'pdf'])[1 + n % 5], 2,
                  case when n % 7 = 0 then 'ia.executar' else 'titular.eliminar' end, jsonb_build_object('execucaoId', gen_random_uuid()),
                  case when n % 3 = 0 then 'concluido' else 'aguardando' end, now() - n * interval '1 second'
             from generate_series(1, 30000) as n`,
          [a.escolaId],
        )
        await cliente.query('analyze job_registro')
        // O que o `not exists` faz por `pendente`: a sondagem em `job_registro` com a escola e o id dela.
        const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(
          `explain (format json) select 1 from job_registro j
            where j.escola_id = $1 and j.fila in ('interativa', 'ferramenta', 'normal') and j.tipo = 'ia.executar' and j.dados ->> 'execucaoId' = $2 and j.estado not in ('concluido', 'falhou')`,
          [a.escolaId, randomUUID()],
        )
        const nos: Array<Record<string, unknown>> = []
        const andar = (no: Record<string, unknown> | undefined): void => {
          if (no === undefined) return
          nos.push(no)
          for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
        }
        andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
        const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')
        const doIndice = nos.find((no) => no['Index Name'] === 'job_registro_pendentes_idx')
        expect(doIndice, resumo).toBeDefined()
        expect(String(doIndice?.['Index Cond']), resumo).toMatch(/fila/)
        expect(String(doIndice?.['Index Cond']), resumo).toMatch(/escola_id/)
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })
  })

  describe('o log', () => {
    it('o que a reentrega e a varredura escrevem leva só ids, a tarefa, o código e a contagem', async () => {
      const reentregue = await semear(a, { haSegundos: 20 })
      const varrida = await semear(a, { haSegundos: 301 })
      await fila.entregarDeNovo(reentregue, a.escolaId)
      await fila.varredura().varrer()
      const permitidos = ['level', 'time', 'servico', 'evento', 'execucaoId', 'escolaId', 'tipo', 'codigo', 'duracaoMs', 'total', 'rodandoTotal', 'pendentesTotal', 'pid', 'hostname', 'nivel', 'msg', 'requisicaoId', 'v']
      const daReentrega = linhasDeLog.filter((linha) => linha.includes('"evento":"ia.execucao.interrompida"') && linha.includes(reentregue))
      expect(daReentrega).toHaveLength(1)
      const dasVarreduras = linhasDeLog.filter((linha) => linha.includes('"evento":"ia.execucao.interrompidas_encerradas"'))
      expect(dasVarreduras.length).toBeGreaterThan(0)
      for (const linha of [...daReentrega, ...dasVarreduras]) {
        expect(Object.keys(JSON.parse(linha) as Record<string, unknown>).filter((campo) => !permitidos.includes(campo)), linha).toEqual([])
      }
      expect(JSON.parse(daReentrega[0] ?? '{}')).toMatchObject({ execucaoId: reentregue, escolaId: a.escolaId, tipo: 'propor_ferramenta', codigo: 'EXECUCAO_INTERROMPIDA' })
      // A execução varrida não aparece nominalmente: a varredura conta, não lista.
      expect(linhasDeLog.join('\n')).not.toContain(varrida)
      // Sem nada a encerrar, a varredura não escreve.
      const antes = linhasDeLog.length
      expect(await fila.varredura().varrer()).toBe(0)
      expect(linhasDeLog.slice(antes).filter((linha) => linha.includes('ia.execucao.'))).toEqual([])
    })
  })
})

describe('a execução interrompida com o adaptador externo configurado', () => {
  const externo: DestinoDoAdaptador = { origem: 'openai_compat', envio: { envioExterno: true, provedorId: 'provedor-de-teste' }, modeloDoPerfil: (perfil) => `modelo-externo-${perfil}` }
  let fila: FilaDeIa
  let a: Escola
  let b: Escola

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, { registro: registroDeTeste(), semConsumir: true, destino: externo })
    a = await montarEscola(fila)
    b = await montarEscola(fila)
  })

  afterAll(async () => {
    await fila.fechar()
    await limpar(a, b)
  })

  /** O rastro do aluno, pela mesma instrução que o `CompartilhamentoRepository.rastroDoAluno` roda: a chamada dele e a das execuções que ele pediu, na escola do contexto. */
  const rastroDe = (escola: Escola, aluno: TestSessao) =>
    fila.como(escola.escolaId, aluno.usuarioId, async () => (await fila.banco.execute<{ provedor: string | null; em: Date | string }>(alunoTrailStatement(aluno.usuarioId))).rows)

  it('linha estimada, externo: o envio e o provedor do adaptador configurado, os dois tetos, o resto nulo, e a execução entra no `rastroDoAluno`', async () => {
    const id = await semear(a, { tarefa: 'turno_do_tutor', por: a.aluno, haSegundos: 20 })
    expect(await rastroDe(a, a.aluno)).toEqual([])
    await fila.entregarDeNovo(id, a.escolaId)
    expect(await linhasDe(id)).toEqual([estimadaDe('turno_do_tutor', a, externo)])
    expect(await linhasDe(id)).toMatchObject([{ envio_externo: true, provedor: 'provedor-de-teste', origem: 'openai_compat', modelo: 'modelo-externo-rapido', aluno_id: null }])
    expect(await rastroDe(a, a.aluno)).toMatchObject([{ provedor: 'provedor-de-teste' }])
  })

  it('rastro de outro aluno: o aluno X não vê a linha do Y, na mesma escola', async () => {
    const doX = await semear(a, { tarefa: 'turno_do_tutor', por: a.aluno, haSegundos: 20 })
    const doY = await semear(a, { tarefa: 'turno_do_tutor', por: a.outroAluno, haSegundos: 20 })
    const doYtambem = await semear(a, { tarefa: 'turno_do_tutor', por: a.outroAluno, haSegundos: 20 })
    const antesDoX = (await rastroDe(a, a.aluno)).length
    const antesDoY = (await rastroDe(a, a.outroAluno)).length
    for (const id of [doX, doY, doYtambem]) await fila.entregarDeNovo(id, a.escolaId)
    // Cada um ganha as suas: o X, uma; o Y, duas. Quem lê o do outro veria o número trocado ou somado.
    expect((await rastroDe(a, a.aluno)).length - antesDoX).toBe(1)
    expect((await rastroDe(a, a.outroAluno)).length - antesDoY).toBe(2)
  })

  it('varredura, duas escolas, externo: cada linha tem o provedor, fica na escola da execução e aparece no `rastroDoAluno` do aluno dela', async () => {
    const daA = await semear(a, { tarefa: 'turno_do_tutor', por: a.aluno })
    const daB = await semear(b, { tarefa: 'turno_do_tutor', por: b.aluno })
    const antesDaA = (await rastroDe(a, a.aluno)).length
    const antesDaB = (await rastroDe(b, b.aluno)).length
    const pendente = await semear(b, { estado: 'pendente', haSegundos: 5 })
    await fila.varredura().varrer()
    expect(await linhasDe(daA)).toEqual([estimadaDe('turno_do_tutor', a, externo)])
    expect(await linhasDe(daB)).toEqual([estimadaDe('turno_do_tutor', b, externo)])
    expect((await rastroDe(a, a.aluno)).length - antesDaA).toBe(1)
    expect((await rastroDe(b, b.aluno)).length - antesDaB).toBe(1)
    // A `pendente` encerrada no mesmo ciclo não gera linha: o modelo nunca foi chamado.
    expect(await execucaoDe(pendente)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
    expect(await linhasDe(pendente)).toEqual([])
  })
})

describe('Redis de fila fora', () => {
  let fila: FilaDeIa
  let a: Escola

  beforeAll(async () => {
    // O worker e o despachante do compose de pé disputariam o job com os desta bancada.
    compose('stop', ...PROCESSOS_DA_FILA)
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, { registro: registroDeTeste(), semConsumir: true })
    a = await montarEscola(fila)
  })

  afterEach(async () => {
    compose('unpause', 'redis-fila')
    await composeAssincronoOuFalha('up', '--detach', 'redis-fila')
    await aguardarSaudavel('redis-fila')
  }, 120_000)

  afterAll(async () => {
    await fila.fechar()
    await limpar(a)
  })

  it('varredura, `pendente`, Redis fora: o job vivo continua no outbox e segura a `pendente`; a sem job é encerrada', async () => {
    const comJob = await semear(a, { estado: 'pendente', haSegundos: 5 })
    await semearJob(a, comJob)
    const comJobAtivo = await semear(a, { estado: 'pendente', haSegundos: 5 })
    await semearJob(a, comJobAtivo, { estado: 'ativo' })
    const semJob = await semear(a, { estado: 'pendente', haSegundos: 5 })
    await composeAssincronoOuFalha('stop', 'redis-fila')
    await fila.varredura().varrer()
    expect((await execucaoDe(comJob)).estado).toBe('pendente')
    expect((await execucaoDe(comJobAtivo)).estado).toBe('pendente')
    expect(await execucaoDe(semJob)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
  }, 120_000)
})
