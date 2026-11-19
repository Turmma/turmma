import { currentContext, TASK_CATALOG, type proporFerramenta, type turnoDoTutor } from '@educa/core'
import { ErrorCode, type ResultadoGravado, type TarefaDeIa } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { aguardarSaudavel, compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA } from '../../../../tools/testes/compose.ts'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-turma.fixture.js'
import { FilaDeIa, type ModeloDeTeste } from '../../test/fila-de-ia.fixture.js'
import { SessaoFixtures, type TestSessao } from '../../test/sessao.fixture.js'
import { chamar, type RespostaHttp } from '../../test/test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import type { EntradaDaTarefa, ExecucaoCommand, SaidaDaTarefa } from './execucao-command.js'
import { ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS, ExecucaoRepository } from './execucao.repository.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { RegistroDeComandos } from './registro-de-comandos.js'

/**
 * O corte da espera de 20 s e a contagem da execução interrompida (reengenharia-continuacao, 7.0; `techspec.md` §5 "Os estados", linha `pendente`, e §7c; `cenarios.md` §1, "O corte dos 20 s", e §6;
 * PRD RF5). A pergunta do Tutor (`interativa`) `pendente` há mais de 20 s termina `falhou IA_INDISPONIVEL`, **sem modelo** e sem linha em `consumo_ia`, cortada por quem chega primeiro: o
 * processador (`pendente → rodando` com a idade, e, com zero linhas, o corte) ou o `GET /v1/execucoes/:id` (depois de lê-la no escopo de quem pediu). A troca não conta, e o operador recebe
 * `ia.espera_estourada{escola_id}`. A `ferramenta` não tem corte.
 *
 * A bancada é a `FilaDeIa`, sem consumir: o teste escolhe o instante em que o job é entregue (`entregarDeNovo`) e chama o `GET` pela API de verdade. A idade se faz recuando `criada_em` no banco,
 * nunca com relógio de JS. Cada bloco sobe a sua bancada e a fecha: o `job_registro` é um só.
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
  /** Quem pediu: o aluno no Tutor, o professor na ferramenta. */
  readonly por?: TestSessao
  readonly estado?: 'pendente' | 'rodando' | 'concluida'
  /** Há quantos segundos, pelo relógio do banco, a execução foi criada (`criada_em`). */
  readonly haSegundos?: number
}

/** A `concluida` aponta para a resposta que existe, na conversa de quem perguntou: sem ela o `GET` devolveria 404 por falta da mensagem, e não pelo estado. */
async function concluirComResposta(escola: Escola, por: TestSessao, id: string): Promise<void> {
  const { rows: resposta } = await sql<{ id: string }>(
    `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto) values ($1, $2, $3, $4, $5, 'tutor', 'resposta sintética') returning id`,
    [escola.escolaId, escola.anoLetivoId, escola.turma, por.usuarioId, id],
  )
  await sql(`update execucao_agente set estado = 'concluida', resultado = $2::jsonb, concluida_em = now() where id = $1`, [id, JSON.stringify({ tipo: 'mensagem_do_tutor', mensagemId: resposta[0]?.id })])
}

/** Uma execução gravada à mão, sem job: o estado e a idade vêm do banco, e nunca do relógio de JS. */
const SEMENTE_PADRAO = { tarefa: 'turno_do_tutor', estado: 'pendente', haSegundos: 21 } as const satisfies Semente

async function semear(escola: Escola, semente: Semente = {}): Promise<string> {
  const { tarefa, estado, haSegundos } = { ...SEMENTE_PADRAO, ...semente }
  const por = semente.por ?? (tarefa === 'turno_do_tutor' ? escola.aluno : escola.professor)
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
  await sql('update execucao_agente set criada_em = now() - make_interval(secs => $2) where id = $1', [id, haSegundos])
  if (estado === 'rodando') await sql(`update execucao_agente set estado = 'rodando', iniciada_em = now() - make_interval(secs => $2) where id = $1`, [id, haSegundos])
  if (estado === 'concluida') await concluirComResposta(escola, por, id)
  return id
}

interface Execucao {
  readonly estado: string
  readonly erro: string | null
  readonly resultado: unknown
  /** A versão da linha: muda a cada escrita, e por isso "nenhuma escrita" é a mesma versão antes e depois. */
  readonly versao: string
}
const execucaoDe = async (id: string): Promise<Execucao> =>
  (await sql<Execucao & Record<string, unknown>>('select estado, erro, resultado, xmin::text as versao from execucao_agente where id = $1', [id])).rows[0] ?? { estado: 'inexistente', erro: null, resultado: null, versao: '' }

const consumoDe = async (execucaoId: string): Promise<number> => Number((await sql<{ total: string }>('select count(*)::text as total from consumo_ia where execucao_id = $1', [execucaoId])).rows[0]?.total)

/** A soma de um contador do medidor, na escola (e, se dita, na origem): é cumulativa, e o teste compara antes e depois. */
async function contagem(nome: 'ia.espera_estourada' | 'ia.execucao.interrompida', escola: Escola, origem?: string): Promise<number> {
  return (await medidor.pontos(nome))
    .filter((ponto) => ponto.atributos['escola_id'] === escola.escolaId && (origem === undefined || ponto.atributos['origem'] === origem))
    .reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
}

/** O modelo de mentira que conta as chamadas e responde pelo gateway de verdade: o que o teste quer saber é se o modelo foi chamado. */
function modeloContado(fila: FilaDeIa) {
  let chamadas = 0
  const modelo: ModeloDeTeste = (pedido) => {
    chamadas += 1
    return fila.falso().generate(pedido as Parameters<ReturnType<FilaDeIa['falso']>['generate']>[0])
  }
  fila.comModelo(modelo)
  return { chamadas: () => chamadas }
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

describe('o corte da espera de 20 s (adaptador falso)', () => {
  const linhasDeLog: string[] = []
  let fila: FilaDeIa
  let a: Escola
  let b: Escola

  const get = (sessao: TestSessao, id: string): Promise<RespostaHttp> => chamar(fila.api.url, 'GET', `/v1/execucoes/${id}`, sessao.token)

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

  describe('o processador', () => {
    it('processador corta: aos 21 s, sem GET, a pergunta do Tutor termina falhou IA_INDISPONIVEL, sem modelo e sem linha de consumo, e a métrica soma uma vez', async () => {
      const id = await semear(a)
      const modelo = modeloContado(fila)
      const antes = await contagem('ia.espera_estourada', a)
      await fila.entregarDeNovo(id, a.escolaId)
      expect(await execucaoDe(id)).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL', resultado: null })
      // O corte fecha a execução: a hora em que terminou fica gravada, como a de toda execução que termina.
      expect((await sql<{ terminou: boolean }>('select concluida_em is not null as terminou from execucao_agente where id = $1', [id])).rows[0]?.terminou).toBe(true)
      expect(modelo.chamadas()).toBe(0)
      expect(await consumoDe(id)).toBe(0)
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
      // A mesma entrega de novo (o job chegou duas vezes): a linha já está encerrada, e nada soma.
      await fila.entregarDeNovo(id, a.escolaId)
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
      expect(await execucaoDe(id)).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
    })

    it('o processador aos 15 s roda: a pergunta dentro da espera chama o modelo e conclui, sem corte e sem métrica', async () => {
      const id = await semear(a, { haSegundos: 15 })
      const modelo = modeloContado(fila)
      const antes = await contagem('ia.espera_estourada', a)
      await fila.entregarDeNovo(id, a.escolaId)
      expect(await execucaoDe(id)).toMatchObject({ estado: 'concluida', erro: null })
      expect(modelo.chamadas()).toBe(1)
      expect(await contagem('ia.espera_estourada', a)).toBe(antes)
    })

    it('ferramenta com 21 s: não corta, e roda', async () => {
      const id = await semear(a, { tarefa: 'propor_ferramenta', haSegundos: 21 })
      const modelo = modeloContado(fila)
      const antes = await contagem('ia.espera_estourada', a)
      await fila.entregarDeNovo(id, a.escolaId)
      expect(await execucaoDe(id)).toMatchObject({ estado: 'concluida', erro: null })
      expect(modelo.chamadas()).toBe(1)
      expect(await contagem('ia.espera_estourada', a)).toBe(antes)
    })

    it('isolamento, job: o job da A com o `execucaoId` da B, vencida, não muda nada na B e não soma', async () => {
      const daB = await semear(b)
      const modelo = modeloContado(fila)
      const antesDaB = await contagem('ia.espera_estourada', b)
      const antesDaA = await contagem('ia.espera_estourada', a)
      const lida = await execucaoDe(daB)
      await expect(fila.entregarDeNovo(daB, a.escolaId)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' })
      expect(await execucaoDe(daB)).toEqual(lida)
      expect(modelo.chamadas()).toBe(0)
      expect(await contagem('ia.espera_estourada', b)).toBe(antesDaB)
      expect(await contagem('ia.espera_estourada', a)).toBe(antesDaA)
      // O repository, no contexto da A, não alcança a da B (nem a idade, nem o corte); no da B, corta: o controle de que o `where` da escola é o que a protege.
      expect(await fila.como(a.escolaId, a.aluno.usuarioId, () => new ExecucaoRepository(fila.banco).cortarEspera(daB, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS))).toBe(false)
      expect(await fila.como(a.escolaId, a.aluno.usuarioId, () => new ExecucaoRepository(fila.banco).marcarRodando(daB))).toBe(false)
      expect(await execucaoDe(daB)).toEqual(lida)
      expect(await fila.como(b.escolaId, b.aluno.usuarioId, () => new ExecucaoRepository(fila.banco).cortarEspera(daB, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS))).toBe(true)
      expect(await execucaoDe(daB)).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
    })
  })

  describe('o GET', () => {
    it('GET corta: aos 21 s, o GET devolve falhou IA_INDISPONIVEL, grava, soma uma vez, e o job que chega depois sai sem modelo', async () => {
      const id = await semear(a)
      // Outra execução da mesma escola, também com 21 s na fila: o corte é da que foi pedida, e a outra segue como estava (a ferramenta não tem corte).
      const daFerramenta = await semear(a, { tarefa: 'propor_ferramenta' })
      const modelo = modeloContado(fila)
      const antes = await contagem('ia.espera_estourada', a)
      const resposta = await get(a.aluno, id)
      expect(resposta.status).toBe(200)
      expect(await execucaoDe(daFerramenta)).toMatchObject({ estado: 'pendente', erro: null })
      expect(resposta.corpo).toEqual({ id, tarefa: 'turno_do_tutor', estado: 'falhou', resultado: null, erro: 'IA_INDISPONIVEL' })
      expect(await execucaoDe(id)).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
      expect(await consumoDe(id)).toBe(0)
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
      // A consulta seguinte (a tela consulta de segundo em segundo) lê a linha já cortada e não soma de novo.
      expect((await get(a.aluno, id)).corpo).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
      // O job, ao chegar, acha a pergunta encerrada: nenhum modelo, nenhuma linha, nenhuma soma.
      await fila.entregarDeNovo(id, a.escolaId)
      expect(modelo.chamadas()).toBe(0)
      expect(await consumoDe(id)).toBe(0)
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
    })

    it('GET aos 15 s: nenhuma escrita', async () => {
      const id = await semear(a, { haSegundos: 15 })
      const lida = await execucaoDe(id)
      const antes = await contagem('ia.espera_estourada', a)
      const resposta = await get(a.aluno, id)
      expect(resposta.corpo).toEqual({ id, tarefa: 'turno_do_tutor', estado: 'pendente', resultado: null, erro: null })
      expect(await execucaoDe(id)).toEqual(lida)
      expect(await contagem('ia.espera_estourada', a)).toBe(antes)
    })

    it('GET sobre `concluida` e `rodando` com mais de 20 s: nenhuma escrita, a resposta continua, e a métrica não soma', async () => {
      const concluida = await semear(a, { estado: 'concluida', haSegundos: 30 })
      const rodando = await semear(a, { estado: 'rodando', haSegundos: 30 })
      const antes = await contagem('ia.espera_estourada', a)
      const [daConcluida, daRodando] = [await execucaoDe(concluida), await execucaoDe(rodando)]
      expect((await get(a.aluno, concluida)).corpo).toMatchObject({ estado: 'concluida', erro: null })
      expect((await get(a.aluno, rodando)).corpo).toMatchObject({ estado: 'rodando', erro: null })
      expect(await execucaoDe(concluida)).toEqual(daConcluida)
      expect(await execucaoDe(rodando)).toEqual(daRodando)
      expect(await contagem('ia.espera_estourada', a)).toBe(antes)
    })

    it('GET sobre a `pendente` da ferramenta com 21 s: nenhuma escrita, e ela roda depois', async () => {
      const id = await semear(a, { tarefa: 'propor_ferramenta', haSegundos: 21 })
      const lida = await execucaoDe(id)
      const antes = await contagem('ia.espera_estourada', a)
      expect((await get(a.professor, id)).corpo).toMatchObject({ estado: 'pendente', erro: null })
      expect(await execucaoDe(id)).toEqual(lida)
      expect(await contagem('ia.espera_estourada', a)).toBe(antes)
      const modelo = modeloContado(fila)
      await fila.entregarDeNovo(id, a.escolaId)
      expect(await execucaoDe(id)).toMatchObject({ estado: 'concluida' })
      expect(modelo.chamadas()).toBe(1)
    })

    it('isolamento: o GET de usuário da B, e de outro da mesma escola, sobre a `pendente` de 21 s da A responde 404 como o inexistente, sem escrita e sem soma', async () => {
      // A cláusula de escola do `cortarEspera` não é provada aqui: a leitura escopada (`deQuemPediu`) barra antes dele. Quem a prova é o caso "isolamento, job", que chama o repository direto no contexto da A com a execução da B.
      const id = await semear(a)
      const lida = await execucaoDe(id)
      const antes = await contagem('ia.espera_estourada', a)
      // O controle: a dona a lê e a corta (200), numa execução que é só dela.
      const controle = await semear(a)
      expect((await get(a.aluno, controle)).corpo).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
      const recusas = [await get(b.aluno, id), await get(a.outroAluno, id), await get(a.aluno, randomUUID())]
      for (const recusa of recusas) {
        expect(recusa.status).toBe(404)
        expect(recusa.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      }
      expect(new Set(recusas.map((recusa) => JSON.stringify({ ...(recusa.corpo.erro as object), requisicaoId: undefined }))).size).toBe(1)
      expect(await execucaoDe(id)).toEqual(lida)
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
    })
  })

  describe('a corrida entre o processador e o GET', () => {
    /** Um gatilho que segura o corte que escreve `falhou` na execução, com a linha já alterada e a trava dela: o outro lado espera a linha. */
    const pararNoCorte = (id: string) => new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.id = '${id}'::uuid and new.estado = 'falhou'` })

    it('corrida, processador primeiro: ele corta; o GET, lido antes, recebe zero linhas no `update` e não soma', async () => {
      const id = await semear(a)
      const modelo = modeloContado(fila)
      const antes = await contagem('ia.espera_estourada', a)
      const parada = pararNoCorte(id)
      await parada.armar()
      let leitura: Promise<RespostaHttp> | undefined
      try {
        const entrega = fila.entregarDeNovo(id, a.escolaId)
        await parada.esperarParadas(1)
        // O `GET` lê a linha ainda `pendente` e vai ao `update`, que espera a trava do corte do processador: a barreira fica entre a leitura e o `update`.
        leitura = get(a.aluno, id)
        await esperarNaTrava(bancada.pool, '%update "execucao_agente" set "estado"%', 2)
        await parada.soltar()
        await entrega
      } finally {
        await parada.desarmar()
      }
      const resposta = await leitura
      // Um corte só, e a resposta do `GET` é a da linha já cortada.
      expect(resposta.corpo).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
      expect(await execucaoDe(id)).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
      expect(modelo.chamadas()).toBe(0)
      expect(await consumoDe(id)).toBe(0)
    })

    it('corrida, GET primeiro: ele corta, e o processador, que esperava a linha, a acha encerrada: um corte, a métrica soma uma vez, sem modelo', async () => {
      const id = await semear(a)
      const modelo = modeloContado(fila)
      const antes = await contagem('ia.espera_estourada', a)
      const parada = pararNoCorte(id)
      await parada.armar()
      let entrega: Promise<void> | undefined
      let leitura: Promise<RespostaHttp> | undefined
      try {
        leitura = get(a.aluno, id)
        await parada.esperarParadas(1)
        // O processador chega com a linha já cortada pelo `GET` (e ainda não confirmada): o `update` dele espera a trava e, ao soltar, acha `falhou`.
        entrega = fila.entregarDeNovo(id, a.escolaId)
        await esperarNaTrava(bancada.pool, '%update "execucao_agente" set "estado"%', 2)
        await parada.soltar()
        await Promise.all([leitura, entrega])
      } finally {
        await parada.desarmar()
      }
      expect((await leitura).corpo).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
      expect(await execucaoDe(id)).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
      expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
      expect(modelo.chamadas()).toBe(0)
      expect(await consumoDe(id)).toBe(0)
    })
  })

  describe('a troca', () => {
    it('a troca: a pergunta cortada não conta no freio do dia, e a reenviada, com a chave nova, conta', async () => {
      await sql('insert into configuracao_operacional_escola (escola_id, tutor_trocas_por_dia) values ($1, 1) on conflict (escola_id) do update set tutor_trocas_por_dia = 1', [a.escolaId])
      try {
        const perguntar = (execucaoId: string) =>
          sql(`insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto) values ($1, $2, $3, $4, $5, 'aluno', 'não entendi')`, [a.escolaId, a.anoLetivoId, a.turma, a.aluno.usuarioId, execucaoId])
        const consultar = () => fila.como(a.escolaId, a.aluno.usuarioId, () => new OrcamentoRepository(fila.banco).check({ funcao: 'tutor_com_o_aluno', alunoId: a.aluno.usuarioId }))
        const cortada = await semear(a)
        await perguntar(cortada)
        // A pergunta em andamento conta no freio (limite 1): é o controle de que a consulta enxerga a pergunta.
        expect(await consultar()).toMatchObject({ permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' })
        expect((await get(a.aluno, cortada)).corpo).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
        expect(await consultar()).toEqual({ permitido: true })
        // "Tentar de novo": a execução nova, com a chave nova, está dentro da espera e conta.
        const reenviada = await semear(a, { haSegundos: 1 })
        await perguntar(reenviada)
        expect(await consultar()).toMatchObject({ permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' })
      } finally {
        await sql('delete from configuracao_operacional_escola where escola_id = $1', [a.escolaId])
      }
    })
  })

  describe('o log', () => {
    it('log: o corte, pelo processador e pelo GET, leva só ids, a tarefa e o código', async () => {
      const peloProcessador = await semear(a)
      const peloGet = await semear(a)
      await fila.entregarDeNovo(peloProcessador, a.escolaId)
      await get(a.aluno, peloGet)
      const permitidos = ['level', 'time', 'servico', 'evento', 'execucaoId', 'escolaId', 'usuarioId', 'tipo', 'codigo', 'pid', 'hostname', 'nivel', 'msg', 'requisicaoId', 'v']
      for (const id of [peloProcessador, peloGet]) {
        const linhas = linhasDeLog.filter((linha) => linha.includes('"evento":"ia.execucao.espera_estourada"') && linha.includes(id))
        expect(linhas, id).toHaveLength(1)
        expect(Object.keys(JSON.parse(linhas[0] ?? '{}') as Record<string, unknown>).filter((campo) => !permitidos.includes(campo))).toEqual([])
        expect(JSON.parse(linhas[0] ?? '{}')).toMatchObject({ execucaoId: id, escolaId: a.escolaId, tipo: 'turno_do_tutor', codigo: 'IA_INDISPONIVEL' })
      }
    })
  })

  describe('a execução interrompida conta por escola e origem (a 6.0 deixou o contador para a 7.0)', () => {
    it('as duas métricas só levam `escola_id` (e a origem): nenhum aluno, usuário nem execução no rótulo', async () => {
      const cortada = await semear(a)
      const interrompida = await semear(a, { tarefa: 'propor_ferramenta', estado: 'rodando', haSegundos: 20 })
      await fila.entregarDeNovo(cortada, a.escolaId)
      await fila.entregarDeNovo(interrompida, a.escolaId)
      const daEspera = await medidor.pontos('ia.espera_estourada')
      const daInterrompida = await medidor.pontos('ia.execucao.interrompida')
      expect(daEspera.length).toBeGreaterThan(0)
      expect(daInterrompida.length).toBeGreaterThan(0)
      for (const ponto of daEspera) expect(Object.keys(ponto.atributos)).toEqual(['escola_id'])
      for (const ponto of daInterrompida) expect(Object.keys(ponto.atributos).sort()).toEqual(['escola_id', 'origem'])
      // Nada do que identifica pessoa ou pedido aparece em valor de rótulo.
      const valores = JSON.stringify([...daEspera, ...daInterrompida])
      for (const proibido of [a.aluno.usuarioId, a.professor.usuarioId, cortada, interrompida]) expect(valores).not.toContain(proibido)
    })

    it('reentrega: a `rodando` encerrada soma uma vez, na escola dela e com a origem `reentrega`; a execução que já terminou não soma', async () => {
      const id = await semear(a, { tarefa: 'propor_ferramenta', estado: 'rodando', haSegundos: 20 })
      const terminada = await semear(a, { tarefa: 'propor_ferramenta', estado: 'concluida', haSegundos: 20 })
      const antes = await contagem('ia.execucao.interrompida', a, 'reentrega')
      const antesDaB = await contagem('ia.execucao.interrompida', b)
      await fila.entregarDeNovo(terminada, a.escolaId)
      expect(await contagem('ia.execucao.interrompida', a, 'reentrega')).toBe(antes)
      await fila.entregarDeNovo(id, a.escolaId)
      expect((await contagem('ia.execucao.interrompida', a, 'reentrega')) - antes).toBe(1)
      // A mesma entrega de novo acha a execução já encerrada: nada soma.
      await fila.entregarDeNovo(id, a.escolaId)
      expect((await contagem('ia.execucao.interrompida', a, 'reentrega')) - antes).toBe(1)
      expect(await contagem('ia.execucao.interrompida', b)).toBe(antesDaB)
    })

    it('varredura: cada `rodando` de 301 s soma na escola dela, com a origem `varredura`; a `pendente` sem job encerrada no mesmo ciclo não soma', async () => {
      const daA = await semear(a, { tarefa: 'propor_ferramenta', estado: 'rodando', haSegundos: 301 })
      const daB = await semear(b, { tarefa: 'propor_ferramenta', estado: 'rodando', haSegundos: 301 })
      const pendente = await semear(a, { tarefa: 'propor_ferramenta', haSegundos: 5 })
      const [antesDaA, antesDaB] = [await contagem('ia.execucao.interrompida', a, 'varredura'), await contagem('ia.execucao.interrompida', b, 'varredura')]
      const daReentregaA = await contagem('ia.execucao.interrompida', a, 'reentrega')
      await fila.varredura().varrer()
      expect(await execucaoDe(daA)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect(await execucaoDe(daB)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect(await execucaoDe(pendente)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect((await contagem('ia.execucao.interrompida', a, 'varredura')) - antesDaA).toBe(1)
      expect((await contagem('ia.execucao.interrompida', b, 'varredura')) - antesDaB).toBe(1)
      expect(await contagem('ia.execucao.interrompida', a, 'reentrega')).toBe(daReentregaA)
    })

    it('a gravação da linha falha: o lote da varredura se desfaz e não soma, e a volta seguinte soma uma vez', async () => {
      const id = await semear(a, { tarefa: 'propor_ferramenta', estado: 'rodando', haSegundos: 301 })
      const antes = await contagem('ia.execucao.interrompida', a, 'varredura')
      const consertar = await quebrarAGravacaoDa(id)
      try {
        await fila.varredura().varrer()
        expect(await execucaoDe(id)).toMatchObject({ estado: 'rodando', erro: null })
        expect(await contagem('ia.execucao.interrompida', a, 'varredura')).toBe(antes)
      } finally {
        await consertar()
      }
      await fila.varredura().varrer()
      expect(await execucaoDe(id)).toMatchObject({ estado: 'falhou', erro: 'EXECUCAO_INTERROMPIDA' })
      expect((await contagem('ia.execucao.interrompida', a, 'varredura')) - antes).toBe(1)
    })
  })
})

describe('Redis de fila fora e de volta', () => {
  let fila: FilaDeIa
  let a: Escola

  const get = (sessao: TestSessao, id: string): Promise<RespostaHttp> => chamar(fila.api.url, 'GET', `/v1/execucoes/${id}`, sessao.token)

  beforeAll(async () => {
    // O worker e o despachante do compose de pé disputariam o job com os desta bancada.
    compose('stop', ...PROCESSOS_DA_FILA)
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, { registro: registroDeTeste(), semConsumir: true })
    a = await montarEscola(fila)
  })

  afterEach(async () => {
    fila.restaurar()
    compose('unpause', 'redis-fila')
    await composeAssincronoOuFalha('up', '--detach', 'redis-fila')
    await aguardarSaudavel('redis-fila')
  }, 120_000)

  afterAll(async () => {
    await fila.fechar()
    await limpar(a)
  })

  it('Redis fora e de volta: em 15 s o job roda; em 25 s o GET já cortou e o job, ao chegar, sai sem modelo; a ferramenta roda', async () => {
    // Nasce com 5 s e só volta a ter 15 s depois de o Redis voltar: o tempo que o Docker leva para parar e subir o contêiner não pode empurrá-la para além dos 20 s.
    const aos15 = await semear(a, { haSegundos: 5 })
    const aos25 = await semear(a, { haSegundos: 25 })
    const ferramenta = await semear(a, { tarefa: 'propor_ferramenta', haSegundos: 25 })
    const antes = await contagem('ia.espera_estourada', a)
    await composeAssincronoOuFalha('stop', 'redis-fila')
    // Com o Redis fora nenhum job chega ao processador: só o `GET` decide, e só a de 25 s da `interativa` é cortada, antes de o Redis voltar.
    expect((await get(a.aluno, aos15)).corpo).toMatchObject({ estado: 'pendente', erro: null })
    expect((await get(a.aluno, aos25)).corpo).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
    expect((await get(a.professor, ferramenta)).corpo).toMatchObject({ estado: 'pendente', erro: null })
    expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
    await composeAssincronoOuFalha('up', '--detach', 'redis-fila')
    await aguardarSaudavel('redis-fila')
    // O Redis volta e os jobs chegam: o de 15 s roda, o de 25 s sai sem modelo, e a ferramenta roda. A idade da de 15 s vem do banco, a cada entrega, e não do tempo que o Docker levou.
    await sql(`update execucao_agente set criada_em = now() - make_interval(secs => 15) where id = $1`, [aos15])
    const modelo = modeloContado(fila)
    await fila.entregarDeNovo(aos15, a.escolaId)
    await fila.entregarDeNovo(aos25, a.escolaId)
    await fila.entregarDeNovo(ferramenta, a.escolaId)
    expect(modelo.chamadas()).toBe(2)
    expect(await execucaoDe(aos15)).toMatchObject({ estado: 'concluida' })
    expect(await execucaoDe(aos25)).toMatchObject({ estado: 'falhou', erro: 'IA_INDISPONIVEL' })
    expect(await execucaoDe(ferramenta)).toMatchObject({ estado: 'concluida' })
    expect((await contagem('ia.espera_estourada', a)) - antes).toBe(1)
  }, 120_000)
})
