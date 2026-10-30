import 'reflect-metadata'
import { contextoAtual, EfeitoSinteticoRepository, executarNoContexto, IDADE_PARA_RECONCILIAR_SEGUNDOS, nomeDaFilaBullMQ, TABELA_DO_EFEITO_SINTETICO } from '@educa/nucleo'
import { JobFailureCode, JOB_DEFINITIONS, TIPO_JOB_SINTETICO, type SyntheticJobData } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import type { ExecucaoDoJob, Processador } from '../src/executor.js'
import { FalhaDeJob } from '../src/falha-de-job.js'
import { criarProcessadorSintetico } from '../src/processadores/sintetico.js'
import { BancadaDeFila, LogEmMemoria } from './fila-de-teste.js'

// A entrega é pelo menos uma vez (D49): cada caminho em que o mesmo job roda de novo, com despachantes e workers
// de verdade no processo do teste, contra o Postgres e o Redis de fila do compose de teste. O efeito é o do
// processador sintético no modo `efeito`, gravado numa tabela que só este arquivo cria.

const COM_EFEITO: SyntheticJobData = { cpuMs: 0, falhar: false, efeito: true }

/** O prazo que o executor entrega ao processador do sintético: o da definição do tipo. */
const PRAZO_DO_SINTETICO_MS = JOB_DEFINITIONS[TIPO_JOB_SINTETICO].prazoMs

interface LinhaDeEfeito {
  escolaId: string
  chaveIdempotencia: string
  tentativa: number
}

/** Uma promessa e quem a resolve, para o teste marcar o ponto em que a execução chegou. */
function sinal(): { chegou: Promise<void>; marcar: () => void } {
  let marcar: () => void = () => undefined
  const chegou = new Promise<void>((resolver) => (marcar = resolver))
  return { chegou, marcar }
}

beforeAll(() => {
  // Despachante ou worker do compose de pé disputaria as linhas com os deste arquivo.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('reexecução do mesmo job: a chave de idempotência é a do job, e o efeito não duplica', () => {
  let bancada: BancadaDeFila
  // Escolas reais, criadas a cada caso: desde a tarefa 3.0 `job_registro` e
  // `configuracao_operacional_escola` têm FK para `escola`, e id inventado é recusado pelo banco.
  let ESCOLA_A: string
  let ESCOLA_B: string
  /** O processador sintético de verdade, com o repository de verdade: só a CPU é dispensada (os jobs pedem zero). */
  let sintetico: Processador

  beforeEach(async () => {
    bancada = new BancadaDeFila()
    await bancada.limparRegistro()
    // O id da escola é sorteado e não cresce com a criação (o `ops:escola` e o painel mandam UUID v4). A ordem ruim fica
    // fixa: a A com o id maior, para que asserção que dependa da ordem dos ids falhe sempre, e não em metade das vezes.
    ;[ESCOLA_B, ESCOLA_A] = (await Promise.all([bancada.escola(), bancada.escola()])).sort()
    // A forma de `TABELA_DO_EFEITO_SINTETICO`: a restrição começa pela escola e termina na chave (regra 80, item 8).
    await bancada.pool.query(`drop table if exists ${TABELA_DO_EFEITO_SINTETICO}`)
    await bancada.pool.query(
      `create table ${TABELA_DO_EFEITO_SINTETICO} (
         escola_id uuid not null,
         chave_idempotencia uuid not null,
         tentativa integer not null,
         primary key (escola_id, chave_idempotencia)
       )`,
    )
    sintetico = criarProcessadorSintetico({ queimar: () => Promise.resolve() }, new EfeitoSinteticoRepository(bancada.banco))
  })

  afterEach(async () => {
    try {
      await bancada.pool.query(`drop table if exists ${TABELA_DO_EFEITO_SINTETICO}`)
    } finally {
      await bancada.fechar()
    }
  }, 60_000)

  async function efeitos(): Promise<LinhaDeEfeito[]> {
    const { rows } = await bancada.pool.query<LinhaDeEfeito>(
      `select escola_id as "escolaId", chave_idempotencia as "chaveIdempotencia", tentativa from ${TABELA_DO_EFEITO_SINTETICO} order by escola_id`,
    )
    return rows
  }

  async function aguardarEstado(id: string, estado: string, limiteMs = 30_000): Promise<void> {
    await expect.poll(async () => (await bancada.estado(id))?.estado, { timeout: limiteMs, interval: 100 }).toBe(estado)
  }

  const iniciosNoLog = (log: LogEmMemoria, id: string) => log.doEvento('job.iniciado').filter((registro) => registro['jobId'] === id)

  it('o repository grava uma vez por chave na escola do contexto, e recusa gravar sem escola', async () => {
    const repositorio = new EfeitoSinteticoRepository(bancada.banco)
    const chaveIdempotencia = randomUUID()
    const naEscolaA = <T>(funcao: () => Promise<T>) => executarNoContexto({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, funcao)

    expect(await naEscolaA(() => repositorio.gravar({ chaveIdempotencia, tentativa: 1 }))).toBe(true)
    expect(await naEscolaA(() => repositorio.gravar({ chaveIdempotencia, tentativa: 2 }))).toBe(false)
    await expect(executarNoContexto({ requisicaoId: randomUUID() }, () => repositorio.gravar({ chaveIdempotencia, tentativa: 3 }))).rejects.toThrow(
      'consulta com escopo sem escola no contexto',
    )
    expect(await efeitos()).toEqual([{ escolaId: ESCOLA_A, chaveIdempotencia, tentativa: 1 }])
  })

  it('a mesma chave gravada ao mesmo tempo por A e por B, na mesma instância: cada uma na sua escola, as duas entram', async () => {
    const repositorio = new EfeitoSinteticoRepository(bancada.banco)
    const chaveIdempotencia = randomUUID()
    // A chave é a mesma e a restrição única começa pela escola: se a segunda chamada usasse a escola da primeira, cairia no conflito.
    const resultados = await Promise.all([ESCOLA_A, ESCOLA_B].map((escolaId) => executarNoContexto({ requisicaoId: randomUUID(), escolaId }, () => repositorio.gravar({ chaveIdempotencia, tentativa: 1 }))))
    expect(resultados).toEqual([true, true])
    expect((await efeitos()).map(({ escolaId }) => escolaId).sort()).toEqual([ESCOLA_A, ESCOLA_B].sort())
  })

  it('oito gravações da mesma chave ao mesmo tempo: uma entra, as outras caem no conflito sem erro, e fica uma linha só', async () => {
    const repositorio = new EfeitoSinteticoRepository(bancada.banco)
    const chaveIdempotencia = randomUUID()
    // Com "verifica e depois grava", duas passam da verificação juntas e a segunda estoura a chave primária.
    const resultados = await Promise.all(
      Array.from({ length: 8 }, (_, indice) =>
        executarNoContexto({ requisicaoId: randomUUID(), escolaId: ESCOLA_A }, () => repositorio.gravar({ chaveIdempotencia, tentativa: indice + 1 })),
      ),
    )
    expect(resultados.filter((gravou) => gravou)).toHaveLength(1)
    expect(await efeitos()).toEqual([{ escolaId: ESCOLA_A, chaveIdempotencia, tentativa: resultados.indexOf(true) + 1 }])
  })

  it('worker morto depois de gravar o efeito e antes de concluir: o job volta pelo stalled, roda de novo com a mesma chave, e o efeito fica numa linha só', async () => {
    const id = await bancada.enfileirar(ESCOLA_A, { dados: COM_EFEITO })
    const execucoes: ExecucaoDoJob[] = []
    const gravou = sinal()
    const logMorto = new LogEmMemoria('worker-morto')
    const morto = bancada.worker(logMorto, {
      concorrencia: 1,
      graca: 500,
      processadores: {
        sintetico: async (dados, execucao) => {
          execucoes.push(execucao)
          await sintetico(dados, execucao)
          gravou.marcar()
          // A réplica morre aqui: o processador nunca volta, e o `concluir` nunca chega ao banco.
          await new Promise<void>(() => undefined)
        },
      },
    })
    bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()
    await gravou.chegou
    expect(await efeitos()).toHaveLength(1)
    expect((await bancada.estado(id))?.estado).toBe('ativo')

    // O `kill -9` visto do Redis e do Postgres: a conexão cai sem aviso, e o lock deixa de ser renovado. O `kill -9`
    // do processo, com o compose, está em infra/test/jobs.int.test.ts.
    await morto.encerrar()
    expect(logMorto.doEvento('worker.desligamento_forcado')).toHaveLength(1)

    const logSobrevivente = new LogEmMemoria('worker-sobrevivente')
    bancada.worker(logSobrevivente, {
      processadores: {
        sintetico: async (dados, execucao) => {
          execucoes.push(execucao)
          await sintetico(dados, execucao)
        },
      },
    })
    // Lock de 10 s e verificação de stalled a cada 5 s na fila interativa.
    await aguardarEstado(id, 'concluido', 40_000)

    expect(execucoes).toEqual([
      { jobId: id, tentativa: 1, chaveIdempotencia: id, prazoMs: PRAZO_DO_SINTETICO_MS },
      // O stalled devolve o job sem contar tentativa: a reexecução aparece no log como outro `job.iniciado` do mesmo job.
      { jobId: id, tentativa: 1, chaveIdempotencia: id, prazoMs: PRAZO_DO_SINTETICO_MS },
    ])
    expect(await efeitos()).toEqual([{ escolaId: ESCOLA_A, chaveIdempotencia: id, tentativa: 1 }])
    expect(iniciosNoLog(logMorto, id)).toHaveLength(1)
    expect(iniciosNoLog(logSobrevivente, id)).toHaveLength(1)
  }, 90_000)

  it('a fila perde o job ativo e a reconciliação o republica enquanto a primeira execução ainda roda: a segunda recebe a mesma chave, e o efeito fica numa linha só', async () => {
    const id = await bancada.enfileirar(ESCOLA_A, { dados: COM_EFEITO })
    const montado = bancada.despachante(new LogEmMemoria('despachante'))
    expect(await montado.despachante.rodada()).toBe(1)

    const execucoes: ExecucaoDoJob[] = []
    const gravouPrimeira = sinal()
    const soltarPrimeira = sinal()
    const processador: Processador = async (dados, execucao) => {
      const ordem = execucoes.push(execucao)
      await sintetico(dados, execucao)
      if (ordem > 1) return
      gravouPrimeira.marcar()
      await soltarPrimeira.chegou
    }
    // Uma vaga por fila em cada réplica: a primeira fica ocupada com a execução presa, e a republicação vai para a outra.
    const logPrimeira = new LogEmMemoria('worker-1')
    bancada.worker(logPrimeira, { concorrencia: 1, processadores: { sintetico: processador } })
    await gravouPrimeira.chegou
    const logSegunda = new LogEmMemoria('worker-2')
    bancada.worker(logSegunda, { concorrencia: 1, processadores: { sintetico: processador } })

    try {
      // O Redis de fila perdeu o job ativo (AOF sem o último segundo): some o hash, o lock e a entrada na lista de ativos.
      const base = `${bancada.prefixo}:${nomeDaFilaBullMQ('interativa', 'worker')}`
      await bancada.redis.multi().lrem(`${base}:active`, 0, id).del(`${base}:${id}`, `${base}:${id}:lock`).exec()
      expect(await bancada.fila.getJob(id)).toBeUndefined()
      // Como se estivesse ativo há mais que a idade da reconciliação.
      await bancada.pool.query(
        `update job_registro
         set reservado_ate = reservado_ate - make_interval(secs => $2), iniciado_em = iniciado_em - make_interval(secs => $2)
         where id = $1`,
        [id, IDADE_PARA_RECONCILIAR_SEGUNDOS + 10],
      )

      expect((await montado.reconciliacao.reconciliar()).republicados).toEqual([id])
      await aguardarEstado(id, 'concluido')
      // A segunda terminou com a primeira ainda presa: as duas execuções se sobrepuseram.
      expect(execucoes).toHaveLength(2)
      expect(iniciosNoLog(logPrimeira, id)).toHaveLength(1)
      expect(iniciosNoLog(logSegunda, id)).toHaveLength(1)
    } finally {
      soltarPrimeira.marcar()
    }

    expect(execucoes).toEqual([
      { jobId: id, tentativa: 1, chaveIdempotencia: id, prazoMs: PRAZO_DO_SINTETICO_MS },
      { jobId: id, tentativa: 1, chaveIdempotencia: id, prazoMs: PRAZO_DO_SINTETICO_MS },
    ])
    expect(await efeitos()).toEqual([{ escolaId: ESCOLA_A, chaveIdempotencia: id, tentativa: 1 }])
    // A primeira termina depois: o `concluir` dela não acha o job ativo, e o job segue concluido.
    await expect.poll(() => logPrimeira.doEvento('job.concluido').filter((registro) => registro['jobId'] === id).length, { timeout: 10_000 }).toBe(1)
    expect((await bancada.estado(id))?.estado).toBe('concluido')
    expect(await efeitos()).toHaveLength(1)
  }, 60_000)

  it('falha transitória depois de gravar o efeito, na 1ª e na 2ª tentativa, e sucesso na 3ª: a chave é a mesma nas três, a tentativa é 1, 2 e 3, e o efeito fica numa linha só', async () => {
    const id = await bancada.enfileirar(ESCOLA_A, { dados: COM_EFEITO })
    const execucoes: ExecucaoDoJob[] = []
    const logWorker = new LogEmMemoria('worker')
    bancada.worker(logWorker, {
      processadores: {
        sintetico: async (dados, execucao) => {
          execucoes.push(execucao)
          await sintetico(dados, execucao)
          // O efeito já foi gravado quando a tentativa falha: é o que a retentativa precisa aguentar.
          if (execucao.tentativa < 3) throw new FalhaDeJob(JobFailureCode.FALHA_SINTETICA)
        },
      },
    })
    // Publicado pelo despachante, com as tentativas e o recuo de verdade.
    bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()

    await aguardarEstado(id, 'concluido', 40_000)

    expect(execucoes).toEqual([1, 2, 3].map((tentativa) => ({ jobId: id, tentativa, chaveIdempotencia: id, prazoMs: PRAZO_DO_SINTETICO_MS })))
    expect(await efeitos()).toEqual([{ escolaId: ESCOLA_A, chaveIdempotencia: id, tentativa: 1 }])
    // A reexecução no log: o mesmo `jobId` em mais de um `job.iniciado`, com a tentativa subindo, e só ids.
    const inicios = iniciosNoLog(logWorker, id)
    expect(inicios.map((registro) => registro['tentativa'])).toEqual([1, 2, 3])
  }, 60_000)

  describe('isolamento', () => {
    it('jobs da escola A e da B reexecutados em sequência na mesma réplica: cada reexecução grava no escopo do próprio job, e não no da execução anterior', async () => {
      const daEscolaA = await bancada.enfileirar(ESCOLA_A, { dados: COM_EFEITO })
      const daEscolaB = await bancada.enfileirar(ESCOLA_B, { dados: COM_EFEITO })
      const gravados = new Set<string>()
      const gravaramOsDois = sinal()
      const morto = bancada.worker(new LogEmMemoria('worker-morto'), {
        concorrencia: 2,
        graca: 500,
        processadores: {
          sintetico: async (dados, execucao) => {
            await sintetico(dados, execucao)
            gravados.add(execucao.jobId)
            if (gravados.size === 2) gravaramOsDois.marcar()
            await new Promise<void>(() => undefined)
          },
        },
      })
      bancada.despachante(new LogEmMemoria('despachante')).despachante.iniciar()
      await gravaramOsDois.chegou
      await morto.encerrar()

      // Uma execução por vez na réplica que retoma: a reexecução de um job vem logo depois da do job da outra escola.
      const escolaDaReexecucao = new Map<string, string | undefined>()
      bancada.worker(new LogEmMemoria('worker-sobrevivente'), {
        concorrencia: 1,
        processadores: {
          sintetico: async (dados, execucao) => {
            escolaDaReexecucao.set(execucao.chaveIdempotencia, contextoAtual()?.escolaId)
            await sintetico(dados, execucao)
          },
        },
      })
      await aguardarEstado(daEscolaA, 'concluido', 40_000)
      await aguardarEstado(daEscolaB, 'concluido', 40_000)

      expect(escolaDaReexecucao).toEqual(
        new Map([
          [daEscolaA, ESCOLA_A],
          [daEscolaB, ESCOLA_B],
        ]),
      )
      // Com o escopo da execução anterior, a reexecução gravaria uma linha a mais, na escola errada. Sem supor ordem entre
      // as escolas: as duas linhas, e só elas.
      const gravadas = await efeitos()
      expect(gravadas).toHaveLength(2)
      expect(gravadas).toEqual(
        expect.arrayContaining([
          { escolaId: ESCOLA_A, chaveIdempotencia: daEscolaA, tentativa: 1 },
          { escolaId: ESCOLA_B, chaveIdempotencia: daEscolaB, tentativa: 1 },
        ]),
      )
    }, 90_000)
  })
})
