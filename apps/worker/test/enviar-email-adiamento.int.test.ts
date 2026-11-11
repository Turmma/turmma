import 'reflect-metadata'
import {
  createQueueRedisClient,
  EmailSendError,
  FakeEmailSender,
  LimiteDeEmailPorMinuto,
  METRICS,
  runInContext,
  SecretCipher,
  tetoDoConvite,
  VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL,
  type Clock,
  type LimiteDeEmail,
} from '@educa/core'
import { JobFailureCode, TIPO_ENVIAR_CONVITE, TIPO_JOB_SINTETICO } from '@educa/shared'
import { DelayedError } from 'bullmq'
import { Redis } from 'ioredis'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { JobAdiadoError } from '../src/job-adiado.error.js'
import { JobExecutor, SORTEIO_DO_ADIAMENTO_MS, type JobProcessors, type QueuedJob } from '../src/job-executor.js'
import { JobFailureError } from '../src/job-failure.error.js'
import { criarEnvioDoConvite, criarEnvios, TENTATIVAS_DO_ENVIO_DE_EMAIL } from '../src/processors/enviar-email.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures, urlRedisDeFila } from './queue.fixture.js'

// O envio do convite que adia sem prender a fila (acesso-e-convites, tarefa 2.0), contra o Postgres e o Redis de fila do compose de teste:
// o `EMAIL_POR_MINUTO` global e atômico, o job que adia (tentativas, uso e vaga intactos, linha em `publicado`), o ponto que volta só na janela
// dele, a espera sorteada entre o `msBeforeNext` e ele mais 5 s, e a métrica de resultado e de adiamento. O relógio do limite é injetado: o
// minuto de cada caso não depende da hora em que a suíte roda (nem de o relógio de parede da máquina recuar).

const URL_DA_WEB = 'https://web.turmma.invalid'
const cifra = new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, randomBytes(32)]]))
/** Um minuto inteiro de calendário (múltiplo de 60 s): o segundo `n` dele é `INICIO_DO_MINUTO + n * 1000`. */
const INICIO_DO_MINUTO = Date.UTC(2026, 10, 9, 12, 0, 0)
const MINUTO_MS = 60_000

beforeAll(() => {
  // Um worker do compose de pé poderia pegar o job de outro teste; este chama o processador e o executor direto.
  compose('stop', ...PROCESSOS_DA_FILA)
})

/** Um relógio que o teste move: o limite lê a janela dele, e a espera até o prazo de uma reserva também. */
class RelogioMovel implements Clock {
  constructor(public emMs: number) {}

  agora(): Date {
    return new Date(this.emMs)
  }
}

describe('email.enviar-convite: o EMAIL_POR_MINUTO e a saída de adiar', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const escolas: string[] = []
  const envios = criarEnvios(bancada.banco)
  /** Outra conexão ao mesmo Redis de fila: o segundo worker. */
  const outroWorker = new Redis(urlRedisDeFila(), { maxRetriesPerRequest: null })
  outroWorker.on('error', () => undefined)

  afterAll(async () => {
    await bancada.pool.query('delete from convite where escola_id = any($1::uuid[])', [escolas])
    outroWorker.disconnect()
    await bancada.fechar()
  })

  async function escolaNova(): Promise<string> {
    const escolaId = await bancada.escola()
    escolas.push(escolaId)
    return escolaId
  }

  /** Um teto só do caso: o prefixo próprio mantém a contagem do minuto longe dos outros casos. */
  const limiteDe = (porMinuto: number, relogio: Clock, redis: Redis = bancada.redis, prefixo = `${bancada.prefixo}:${randomUUID()}`) =>
    new LimiteDeEmailPorMinuto(redis, porMinuto, { prefixo, relogio })

  interface Semente {
    readonly escolaId: string
    readonly conviteId: string
    readonly endereco: string
  }

  async function conviteNaFila(escolaId: string, ajuste: { envio?: 'na_fila' | 'enviando' | 'enviado' | 'cancelado'; reservadoHa?: string } = {}): Promise<Semente> {
    const conviteId = randomUUID()
    const token = randomBytes(24).toString('base64url')
    const endereco = `professora-${randomUUID()}@convite.invalid`
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [endereco])
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'professor', 'Professora sintética do adiamento', now()) returning id",
      [escolaId, contas[0]?.id],
    )
    const aberto = ajuste.envio === undefined || ajuste.envio === 'na_fila' || ajuste.envio === 'enviando'
    await bancada.pool.query(
      `insert into convite (id, escola_id, token_hash, tipo, usuario_id, expira_em, canal, envio, token_cifrado, destino_cifrado, envio_reservado_em, enviado_em)
       values ($1, $2, $3, 'professor', $4, now() + interval '7 days', 'email', $5, $6, $7, case when $5 = 'enviando' then now() - $8::interval end, case when $5 = 'enviado' then now() end)`,
      [
        conviteId,
        escolaId,
        createHash('sha256').update(token).digest('hex'),
        usuarios[0]?.id,
        ajuste.envio ?? 'na_fila',
        aberto ? cifra.cifrar(Buffer.from(token), conviteId).cifrado : null,
        aberto ? cifra.cifrar(Buffer.from(endereco), conviteId).cifrado : null,
        ajuste.reservadoHa ?? '0 seconds',
      ],
    )
    return { escolaId, conviteId, endereco }
  }

  interface LinhaDoConvite {
    envio: string | null
    token: Buffer | null
    reservadoEm: Date | null
  }

  async function linha(conviteId: string): Promise<LinhaDoConvite> {
    const { rows } = await bancada.pool.query<LinhaDoConvite>('select envio, token_cifrado as token, envio_reservado_em as "reservadoEm" from convite where id = $1', [conviteId])
    const achada = rows[0]
    if (achada === undefined) throw new Error('convite de teste sumiu')
    return achada
  }

  /** Um processador com o falso e o limite dados; devolve também o falso, para o teste contar o que saiu. */
  function processadorCom(limite: LimiteDeEmail, opcoes: { emissor?: FakeEmailSender; relogio?: Clock; medidor?: MedidorDeTeste } = {}) {
    const emissor = opcoes.emissor ?? new FakeEmailSender()
    const processador = criarEnvioDoConvite({
      envios,
      emissor,
      cifra,
      limite,
      urlDaWeb: URL_DA_WEB,
      logger: log.logger,
      ...(opcoes.relogio === undefined ? {} : { relogio: opcoes.relogio }),
      ...(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor.medidor }),
    })
    const rodar = (escolaId: string, conviteId: string, tentativa = 1): Promise<void> =>
      runInContext({ requisicaoId: randomUUID(), escolaId }, () => processador({ conviteId }, jobExecution(randomUUID(), tentativa), new AbortController().signal))
    const enviadasPara = (endereco: string) => emissor.enviadas.filter((mensagem) => mensagem.para === endereco)
    return { emissor, rodar, enviadasPara }
  }

  /** O erro que o job adiado lança, para o teste ler a espera e o motivo. */
  async function adiamentoDe(execucao: Promise<void>): Promise<JobAdiadoError> {
    const erro = await execucao.then(
      () => undefined,
      (falha: unknown) => falha,
    )
    expect(erro).toBeInstanceOf(JobAdiadoError)
    return erro as JobAdiadoError
  }

  /** O executor de verdade, sobre o registro e as vagas reais da bancada, com o falso de e-mail no lugar do SMTP. */
  function executorCom(processadores: JobProcessors, marcacoes: string[]) {
    return new JobExecutor({
      repositorio: bancada.registro,
      processadores,
      logger: log.logger,
      vagas: bancada.vagas,
      vagasDaEscola: { daEscola: () => Promise.resolve({ interativa: 1, normal: 1, lote: 1, pdf: 1 }) },
      uso: { marcar: (metrica) => marcacoes.push(metrica) },
    })
  }

  async function jobDeEmail(escolaId: string, tipo: 'email' | 'sintetico', conviteId?: string): Promise<{ jobId: string; job: QueuedJob; moveToDelayed: ReturnType<typeof vi.fn<QueuedJob['moveToDelayed']>> }> {
    const jobId =
      tipo === 'email'
        ? await bancada.enfileirar(escolaId, { tipo: TIPO_ENVIAR_CONVITE, fila: 'normal', dados: { conviteId: conviteId ?? randomUUID() } })
        : await bancada.enfileirar(escolaId, { tipo: TIPO_JOB_SINTETICO, fila: 'normal' })
    // Como o despachante o deixa depois de publicar: o worker pode começá-lo.
    await bancada.pool.query("update job_registro set estado = 'publicado' where id = $1", [jobId])
    const moveToDelayed = vi.fn<QueuedJob['moveToDelayed']>(() => Promise.resolve())
    const job = { id: jobId, data: { escolaId, requisicaoId: null }, attemptsMade: 0, opts: { attempts: TENTATIVAS_DO_ENVIO_DE_EMAIL }, moveToDelayed } as unknown as QueuedJob
    return { jobId, job, moveToDelayed }
  }

  describe('o teto do minuto', () => {
    it('estourado, o job é adiado mais vezes que as tentativas: a linha não vira `falhou`, nada sai, e o envio sai quando a vaga abre', async () => {
      const escolaId = await escolaNova()
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 10_000)
      const limite = limiteDe(1, relogio)
      const { emissor, enviadasPara } = processadorCom(limite)
      await limite.consumir('convite')
      const c = await conviteNaFila(escolaId)
      const marcacoes: string[] = []
      const executor = executorCom({ [TIPO_ENVIAR_CONVITE]: criarEnvioDoConvite({ envios, emissor, cifra, limite, urlDaWeb: URL_DA_WEB, logger: log.logger, relogio }) }, marcacoes)
      const { jobId, job, moveToDelayed } = await jobDeEmail(escolaId, 'email', c.conviteId)

      for (let volta = 0; volta < TENTATIVAS_DO_ENVIO_DE_EMAIL + 2; volta += 1) {
        await expect(executor.processar(job, 'token')).rejects.toBeInstanceOf(DelayedError)
      }
      expect(moveToDelayed).toHaveBeenCalledTimes(TENTATIVAS_DO_ENVIO_DE_EMAIL + 2)
      expect(await bancada.estado(jobId)).toMatchObject({ estado: 'publicado', codigoFalha: null })
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'na_fila', reservadoEm: null })
      expect(enviadasPara(c.endereco)).toEqual([])
      expect(marcacoes).toEqual([])
      // Os eventos de log do adiamento levam ids e o tipo, nunca o endereço nem o token do convite (regra 20, item 9).
      expect(log.doEvento('job.adiado').filter((registro) => registro['jobId'] === jobId)).toHaveLength(TENTATIVAS_DO_ENVIO_DE_EMAIL + 2)
      expect(log.doEvento('email.convite_adiado').filter((registro) => registro['conviteId'] === c.conviteId)).toHaveLength(TENTATIVAS_DO_ENVIO_DE_EMAIL + 2)
      const doConvite = log.linhas.filter((linha) => linha.includes(jobId) || linha.includes(c.conviteId))
      expect(doConvite.length).toBeGreaterThanOrEqual(2 * (TENTATIVAS_DO_ENVIO_DE_EMAIL + 2))
      for (const linhaDoLog of doConvite) expect(linhaDoLog).not.toContain(c.endereco)

      relogio.emMs += MINUTO_MS
      await executor.processar(job, 'token')
      expect(enviadasPara(c.endereco)).toHaveLength(1)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviado', token: null })
      expect(await bancada.estado(jobId)).toMatchObject({ estado: 'concluido' })
      expect(marcacoes).toEqual(['jobs'])
    })

    it('o job adiado solta a vaga: com o limite `normal` da escola em 1, o outro job `normal` roda na hora, sem esperar a validade da vaga', async () => {
      const escolaId = await escolaNova()
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 5_000)
      const limite = limiteDe(1, relogio)
      await limite.consumir('convite')
      const c = await conviteNaFila(escolaId)
      const sintetico = vi.fn(() => Promise.resolve())
      const marcacoes: string[] = []
      const executor = executorCom(
        {
          [TIPO_ENVIAR_CONVITE]: criarEnvioDoConvite({ envios, emissor: new FakeEmailSender(), cifra, limite, urlDaWeb: URL_DA_WEB, logger: log.logger, relogio }),
          [TIPO_JOB_SINTETICO]: sintetico,
        },
        marcacoes,
      )
      const adiado = await jobDeEmail(escolaId, 'email', c.conviteId)
      const outro = await jobDeEmail(escolaId, 'sintetico')

      await expect(executor.processar(adiado.job, 'token')).rejects.toBeInstanceOf(DelayedError)
      expect(await bancada.vagas.membros('normal', escolaId)).toEqual([])
      await executor.processar(outro.job, 'token')

      expect(sintetico).toHaveBeenCalledTimes(1)
      expect(outro.moveToDelayed).not.toHaveBeenCalled()
      expect(await bancada.estado(outro.jobId)).toMatchObject({ estado: 'concluido' })
      expect(await bancada.estado(adiado.jobId)).toMatchObject({ estado: 'publicado' })
      expect(marcacoes).toEqual(['jobs'])
    })

    it('a espera do job adiado fica entre o `msBeforeNext` e ele mais 5 s: nunca 1 s fixo', async () => {
      const escolaId = await escolaNova()
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 20_000)
      const limite = limiteDe(1, relogio)
      await limite.consumir('convite')
      const executor = executorCom({ [TIPO_ENVIAR_CONVITE]: criarEnvioDoConvite({ envios, emissor: new FakeEmailSender(), cifra, limite, urlDaWeb: URL_DA_WEB, logger: log.logger, relogio }) }, [])
      for (let volta = 0; volta < 6; volta += 1) {
        const c = await conviteNaFila(escolaId)
        const { job, moveToDelayed } = await jobDeEmail(escolaId, 'email', c.conviteId)
        const antes = Date.now()
        await expect(executor.processar(job, 'token')).rejects.toBeInstanceOf(DelayedError)
        const depois = Date.now()
        const ate = Number(moveToDelayed.mock.calls[0]?.[0])
        // O `msBeforeNext` do segundo 20 do minuto é de 40 s.
        expect(ate).toBeGreaterThanOrEqual(antes + 40_000)
        expect(ate).toBeLessThan(depois + 40_000 + SORTEIO_DO_ADIAMENTO_MS)
      }
    })
  })

  describe('o Redis de fila fora', () => {
    it('o job adia por 30 s, sem enviar nada e sem `falhou`, também mais vezes que as tentativas; com o Redis de volta, retoma e envia uma vez', async () => {
      const escolaId = await escolaNova()
      const real = limiteDe(100, new RelogioMovel(INICIO_DO_MINUTO))
      let fora = true
      const oscilante: LimiteDeEmail = {
        consumir: (classe) => (fora ? Promise.reject(new Error('Redis fora')) : real.consumir(classe)),
        devolver: (ponto) => (fora ? Promise.reject(new Error('Redis fora')) : real.devolver(ponto)),
      }
      const { rodar, enviadasPara } = processadorCom(oscilante)
      const c = await conviteNaFila(escolaId)

      for (let volta = 0; volta < TENTATIVAS_DO_ENVIO_DE_EMAIL + 2; volta += 1) {
        const adiamento = await adiamentoDe(rodar(escolaId, c.conviteId))
        expect(adiamento).toMatchObject({ baseMs: 30_000, motivo: 'redis' })
      }
      expect(enviadasPara(c.endereco)).toEqual([])
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'na_fila', reservadoEm: null })

      fora = false
      await rodar(escolaId, c.conviteId)
      await rodar(escolaId, c.conviteId, 2)
      expect(enviadasPara(c.endereco)).toHaveLength(1)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviado' })
    })

    it('o limite de verdade não tem seguro em memória: com um Redis que não responde, `consumir` rejeita, e o job adia sem enviar', async () => {
      const escolaId = await escolaNova()
      const semRedis = createQueueRedisClient('redis://127.0.0.1:1', 'teste-sem-redis', () => undefined)
      try {
        const limite = new LimiteDeEmailPorMinuto(semRedis, 100_000)
        await expect(limite.consumir('convite')).rejects.toThrow()
        const { rodar, enviadasPara } = processadorCom(limite)
        const c = await conviteNaFila(escolaId)
        const adiamento = await adiamentoDe(rodar(escolaId, c.conviteId))
        expect(adiamento).toMatchObject({ baseMs: 30_000, motivo: 'redis' })
        expect(enviadasPara(c.endereco)).toEqual([])
        expect(await linha(c.conviteId)).toMatchObject({ envio: 'na_fila' })
      } finally {
        semRedis.disconnect()
      }
    })
  })

  describe('o ponto que não foi gasto volta', () => {
    const SEM_ENVIO: Array<[string, (escolaId: string) => Promise<Semente>]> = [
      ['a reserva de outro processo ainda vigente', (escolaId) => conviteNaFila(escolaId, { envio: 'enviando', reservadoHa: '30 seconds' })],
      ['o envio já `enviado`', (escolaId) => conviteNaFila(escolaId, { envio: 'enviado' })],
      ['o envio já `cancelado`', (escolaId) => conviteNaFila(escolaId, { envio: 'cancelado' })],
      ['o convite que é de outra escola', async () => conviteNaFila(await escolaNova())],
    ]

    it.each(SEM_ENVIO)('com o teto em 1 e o ponto gasto por %s, ele volta, e o envio seguinte sai no mesmo minuto', async (_nome, semear) => {
      const escolaId = await escolaNova()
      const limite = limiteDe(1, new RelogioMovel(INICIO_DO_MINUTO + 30_000))
      const { rodar, enviadasPara } = processadorCom(limite)
      const semEnvio = await semear(escolaId)
      const antes = await linha(semEnvio.conviteId)
      await rodar(escolaId, semEnvio.conviteId).catch((erro: unknown) => {
        if (!(erro instanceof JobAdiadoError)) throw erro
      })
      // O convite sem envio fica como estava: nada saiu para o endereço dele e a linha não mudou (o da outra escola é o caso do isolamento).
      expect(enviadasPara(semEnvio.endereco)).toEqual([])
      expect(await linha(semEnvio.conviteId)).toEqual(antes)

      const proximo = await conviteNaFila(escolaId)
      await rodar(escolaId, proximo.conviteId)
      expect(enviadasPara(proximo.endereco)).toHaveLength(1)
    })

    it('o ponto gasto no segundo 59 e devolvido no minuto seguinte não volta: só se devolve na mesma janela', async () => {
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 59_000)
      const limite = limiteDe(1, relogio)
      const gasto = await limite.consumir('convite')
      if (gasto.resultado !== 'concedido') throw new Error('o primeiro ponto do minuto devia ser concedido')

      relogio.emMs = INICIO_DO_MINUTO + MINUTO_MS + 500
      expect(await limite.devolver(gasto.ponto)).toBe(false)
      relogio.emMs = INICIO_DO_MINUTO + 59_900
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'sem_vaga' })

      // Na mesma janela, ele volta.
      expect(await limite.devolver(gasto.ponto)).toBe(true)
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'concedido' })
    })

    it.each<['permanente' | 'transitoria']>([['permanente'], ['transitoria']])(
      'a tentativa recusada pelo SMTP (%s) gastou o ponto: ele não volta, e o convite seguinte é adiado',
      async (natureza) => {
        const escolaId = await escolaNova()
        const limite = limiteDe(1, new RelogioMovel(INICIO_DO_MINUTO + 30_000))
        const { emissor, rodar, enviadasPara } = processadorCom(limite)
        emissor.falharProximos(natureza)
        const recusado = await conviteNaFila(escolaId)
        await rodar(escolaId, recusado.conviteId).catch((erro: unknown) => {
          if (!(erro instanceof JobFailureError)) throw erro
        })
        expect(emissor.tentativas).toBe(1)

        const seguinte = await conviteNaFila(escolaId)
        const adiamento = await adiamentoDe(rodar(escolaId, seguinte.conviteId))
        expect(adiamento).toMatchObject({ motivo: 'limite' })
        expect(adiamento.baseMs).toBe(30_000)
        expect(enviadasPara(seguinte.endereco)).toEqual([])
      },
    )

    it('a queda que não é uma recusa do servidor também gastou o ponto', async () => {
      const escolaId = await escolaNova()
      const limite = limiteDe(1, new RelogioMovel(INICIO_DO_MINUTO + 30_000))
      const caindo = criarEnvioDoConvite({ envios, emissor: { enviar: () => Promise.reject(new Error('conexão caiu')) }, cifra, limite, urlDaWeb: URL_DA_WEB, logger: log.logger })
      const c = await conviteNaFila(escolaId)
      await expect(runInContext({ requisicaoId: randomUUID(), escolaId }, () => caindo({ conviteId: c.conviteId }, jobExecution(randomUUID(), 1)))).rejects.toBeInstanceOf(JobFailureError)
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'sem_vaga' })
    })
  })

  describe('a reserva de outro processo', () => {
    it('[P] a reentrega com a reserva alheia presa na barreira adia até o prazo da reserva, sem tentativa, e o e-mail sai uma vez só', async () => {
      const escolaId = await escolaNova()
      const limite = limiteDe(100, new RelogioMovel(INICIO_DO_MINUTO))
      const primeiro = processadorCom(limite)
      const c = await conviteNaFila(escolaId)
      const barreira = primeiro.emissor.segurarNoProximo()
      const execucaoDoPrimeiro = primeiro.rodar(escolaId, c.conviteId)
      await barreira.chegou
      const reservadoEm = (await linha(c.conviteId)).reservadoEm
      if (reservadoEm === null) throw new Error('o convite devia estar reservado')

      // 80 s depois da reserva, o prazo (2 min) falta 40 s: é exatamente a espera que o job pede.
      const relogio = new RelogioMovel(reservadoEm.getTime() + 80_000)
      const segundo = processadorCom(limite, { relogio })
      const adiamento = await adiamentoDe(segundo.rodar(escolaId, c.conviteId))
      expect(adiamento).toMatchObject({ baseMs: 40_000, motivo: 'reserva_alheia' })
      expect(segundo.enviadasPara(c.endereco)).toEqual([])

      barreira.soltar()
      await execucaoDoPrimeiro
      expect(primeiro.enviadasPara(c.endereco)).toHaveLength(1)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviado' })
    })

    it('depois do prazo da reserva, o job adiado retoma a linha e envia', async () => {
      const escolaId = await escolaNova()
      const limite = limiteDe(100, new RelogioMovel(INICIO_DO_MINUTO))
      const c = await conviteNaFila(escolaId, { envio: 'enviando', reservadoHa: '100 seconds' })
      const reservadoEm = (await linha(c.conviteId)).reservadoEm
      if (reservadoEm === null) throw new Error('o convite devia estar reservado')
      // O relógio do processo parte da hora que o banco gravou na reserva (sem comparar o `now()` do Postgres com o relógio de parede):
      // 100 s depois dela, o prazo de 120 s falta exatamente 20 s.
      const { rodar, enviadasPara } = processadorCom(limite, { relogio: new RelogioMovel(reservadoEm.getTime() + 100_000) })

      const adiamento = await adiamentoDe(rodar(escolaId, c.conviteId))
      expect(adiamento).toMatchObject({ baseMs: 20_000, motivo: 'reserva_alheia' })

      await bancada.pool.query("update convite set envio_reservado_em = now() - interval '3 minutes' where id = $1", [c.conviteId])
      await rodar(escolaId, c.conviteId, 2)
      expect(enviadasPara(c.endereco)).toHaveLength(1)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviado' })
    })
  })

  describe('o consumo atômico', () => {
    it('[P] mais consumos que o teto, de dois workers: os envios são o teto, exatamente', async () => {
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 15_000)
      const prefixo = `${bancada.prefixo}:${randomUUID()}`
      const doPrimeiro = limiteDe(10, relogio, bancada.redis, prefixo)
      const doSegundo = limiteDe(10, relogio, outroWorker, prefixo)

      const respostas = await Promise.all(Array.from({ length: 60 }, (_, indice) => (indice % 2 === 0 ? doPrimeiro : doSegundo).consumir('conta')))

      expect(respostas.filter(({ resultado }) => resultado === 'concedido')).toHaveLength(10)
      const recusadas = respostas.filter((resposta) => resposta.resultado === 'sem_vaga')
      expect(recusadas).toHaveLength(50)
      // Faltam 45 s para o minuto seguinte, a mesma conta para quem foi recusado em qualquer worker.
      for (const recusada of recusadas) expect(recusada).toEqual({ resultado: 'sem_vaga', msBeforeNext: 45_000 })
    })

    it('metade do teto é reservada ao link da conta: os convites enchem a deles e um a mais é adiado, mas o link da conta ainda sai no minuto', async () => {
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 15_000)
      const prefixo = `${bancada.prefixo}:${randomUUID()}`
      const doPrimeiro = limiteDe(10, relogio, bancada.redis, prefixo)
      const doSegundo = limiteDe(10, relogio, outroWorker, prefixo)

      const convites = await Promise.all(Array.from({ length: 30 }, (_, indice) => (indice % 2 === 0 ? doPrimeiro : doSegundo).consumir('convite')))
      expect(convites.filter(({ resultado }) => resultado === 'concedido')).toHaveLength(tetoDoConvite(10))
      expect(tetoDoConvite(10)).toBe(5)

      const contas = await Promise.all(Array.from({ length: 30 }, () => doPrimeiro.consumir('conta')))
      expect(contas.filter(({ resultado }) => resultado === 'concedido')).toHaveLength(5)
      expect(await doSegundo.consumir('convite')).toMatchObject({ resultado: 'sem_vaga' })
    })

    it('o teto de um é o do convite inteiro: com 1 por minuto o convite ainda sai, e com 3 o convite fica com 2 e a conta com o resto', () => {
      expect([1, 2, 3, 60].map(tetoDoConvite)).toEqual([1, 1, 2, 30])
      expect(() => new LimiteDeEmailPorMinuto(bancada.redis, 0)).toThrow()
      expect(() => new LimiteDeEmailPorMinuto(bancada.redis, 1.5)).toThrow()
    })
  })

  describe('as métricas', () => {
    it('o resultado e o adiamento são lidos como no metrics.int.test.ts, sem rótulo de escola, convite ou pessoa', async () => {
      const escolaId = await escolaNova()
      const medidor = new MedidorDeTeste()
      try {
        const relogio = new RelogioMovel(INICIO_DO_MINUTO + 10_000)
        const limite = limiteDe(100, relogio)
        const { emissor, rodar } = processadorCom(limite, { medidor, relogio })

        await rodar(escolaId, (await conviteNaFila(escolaId)).conviteId) // enviado
        emissor.falharProximos('permanente')
        await rodar(escolaId, (await conviteNaFila(escolaId)).conviteId) // falhou
        emissor.falharProximos('transitoria')
        await rodar(escolaId, (await conviteNaFila(escolaId)).conviteId).catch(() => undefined) // nova_tentativa
        await rodar(escolaId, (await conviteNaFila(escolaId, { envio: 'enviado' })).conviteId) // ignorado
        const adulterado = await conviteNaFila(escolaId)
        await bancada.pool.query('update convite set token_cifrado = $2 where id = $1', [adulterado.conviteId, Buffer.alloc(40, 7)])
        await rodar(escolaId, adulterado.conviteId) // falhou: a cifra que não decifra
        await adiamentoDe(rodar(escolaId, (await conviteNaFila(escolaId, { envio: 'enviando', reservadoHa: '10 seconds' })).conviteId)) // adiado: reserva_alheia

        const semRedis = processadorCom(
          { consumir: () => Promise.reject(new Error('Redis fora')), devolver: () => Promise.reject(new Error('Redis fora')) },
          { medidor, relogio },
        )
        await adiamentoDe(semRedis.rodar(escolaId, (await conviteNaFila(escolaId)).conviteId)) // adiado: redis
        const cheio = limiteDe(1, relogio)
        await cheio.consumir('convite')
        const estourado = processadorCom(cheio, { medidor, relogio })
        await adiamentoDe(estourado.rodar(escolaId, (await conviteNaFila(escolaId)).conviteId)) // adiado: limite

        const porResultado = Object.fromEntries((await medidor.pontos(METRICS.emailPorResultado)).map(({ atributos, valor }) => [String(atributos['resultado']), valor]))
        expect(porResultado).toEqual({ enviado: 1, falhou: 2, nova_tentativa: 1, ignorado: 1 })
        const adiados = Object.fromEntries((await medidor.pontos(METRICS.emailAdiado)).map(({ atributos, valor }) => [String(atributos['motivo']), valor]))
        expect(adiados).toEqual({ reserva_alheia: 1, redis: 1, limite: 1 })
        const rotulos = (await medidor.atributosDeTodas()).filter(({ nome }) => nome === METRICS.emailPorResultado || nome === METRICS.emailAdiado).flatMap(({ atributos }) => Object.keys(atributos))
        expect(new Set(rotulos)).toEqual(new Set(['resultado', 'motivo']))
      } finally {
        await medidor.encerrar()
      }
    })

    it('o 4xx conta só `nova_tentativa`: a linha volta e o job repete, sem contar `falhou`', async () => {
      const escolaId = await escolaNova()
      const medidor = new MedidorDeTeste()
      try {
        const limite = limiteDe(100, new RelogioMovel(INICIO_DO_MINUTO))
        const caindo = criarEnvioDoConvite({
          envios,
          emissor: { enviar: () => Promise.reject(new EmailSendError('transitoria')) },
          cifra,
          limite,
          urlDaWeb: URL_DA_WEB,
          logger: log.logger,
          medidor: medidor.medidor,
        })
        const c = await conviteNaFila(escolaId)
        await expect(runInContext({ requisicaoId: randomUUID(), escolaId }, () => caindo({ conviteId: c.conviteId }, jobExecution(randomUUID(), 1)))).rejects.toMatchObject({ codigo: JobFailureCode.ERRO_INTERNO })
        const pontos = await medidor.pontos(METRICS.emailPorResultado)
        expect(pontos.map(({ atributos }) => atributos['resultado'])).toEqual(['nova_tentativa'])
      } finally {
        await medidor.encerrar()
      }
    })
  })

  describe('o limite, em detalhe', () => {
    it('dois prefixos são duas contagens: o teto de um não gasta o do outro', async () => {
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 10_000)
      const a = limiteDe(1, relogio, bancada.redis, `${bancada.prefixo}:${randomUUID()}`)
      const b = limiteDe(1, relogio, bancada.redis, `${bancada.prefixo}:${randomUUID()}`)
      expect(await a.consumir('convite')).toMatchObject({ resultado: 'concedido' })
      expect(await a.consumir('convite')).toMatchObject({ resultado: 'sem_vaga' })
      expect(await b.consumir('convite')).toMatchObject({ resultado: 'concedido' })
    })

    it('o Redis que reiniciou sem o cache do script segue valendo: o `NOSCRIPT` manda o script inteiro, e a contagem continua', async () => {
      const limite = limiteDe(4, new RelogioMovel(INICIO_DO_MINUTO + 10_000))
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'concedido' })
      await bancada.redis.script('FLUSH')
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'concedido' })
      // A contagem do minuto sobreviveu à troca do script: o terceiro convite passa do teto do convite (2 de 4).
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'sem_vaga' })
    })

    it('o ponto do link da conta que volta não abre vaga do convite: só o contador do convite volta com o ponto de convite', async () => {
      const limite = limiteDe(4, new RelogioMovel(INICIO_DO_MINUTO + 10_000))
      expect(tetoDoConvite(4)).toBe(2)
      await limite.consumir('convite')
      await limite.consumir('convite')
      const daConta = await limite.consumir('conta')
      if (daConta.resultado !== 'concedido') throw new Error('a conta tem a metade dela')

      expect(await limite.devolver(daConta.ponto)).toBe(true)
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'sem_vaga' })
      expect(await limite.consumir('conta')).toMatchObject({ resultado: 'concedido' })
    })
  })

  describe('o limite com o relógio do Redis (o de produção)', () => {
    /** O `TIME` do Redis em ms, o mesmo que o script lê quando ninguém injeta relógio. */
    async function agoraDoRedis(): Promise<number> {
      const [segundos, micros] = await bancada.redis.time()
      return Number(segundos) * 1000 + Math.floor(Number(micros) / 1000)
    }

    it('sem relógio injetado, a janela e o `msBeforeNext` vêm do `TIME` do Redis: o teto de 1 vale no minuto dele e o segundo consumo espera o que falta', async () => {
      // Longe da borda do minuto: o primeiro e o segundo consumo caem na mesma janela do Redis.
      const faltam = MINUTO_MS - ((await agoraDoRedis()) % MINUTO_MS)
      if (faltam < 10_000) await new Promise((resolve) => setTimeout(resolve, faltam + 200))
      const limite = new LimiteDeEmailPorMinuto(bancada.redis, 1, { prefixo: `${bancada.prefixo}:${randomUUID()}` })

      const antes = await agoraDoRedis()
      const primeiro = await limite.consumir('convite')
      const entre = await agoraDoRedis()
      const segundo = await limite.consumir('convite')
      const depois = await agoraDoRedis()

      if (primeiro.resultado !== 'concedido') throw new Error('o primeiro ponto do minuto devia ser concedido')
      expect(primeiro.ponto.janela).toBeGreaterThanOrEqual(Math.floor(antes / MINUTO_MS))
      expect(primeiro.ponto.janela).toBeLessThanOrEqual(Math.floor(entre / MINUTO_MS))
      if (segundo.resultado !== 'sem_vaga') throw new Error('o segundo consumo do minuto devia ser recusado')
      // O script contou o `msBeforeNext` em algum instante entre `entre` e `depois`, na mesma janela: a conta é exata nesses limites.
      expect(segundo.msBeforeNext).toBeGreaterThanOrEqual(MINUTO_MS - (depois % MINUTO_MS))
      expect(segundo.msBeforeNext).toBeLessThanOrEqual(MINUTO_MS - (entre % MINUTO_MS))
      expect(await limite.devolver(primeiro.ponto)).toBe(true)
    })
  })

  describe('o link da conta e o ponto devolvido duas vezes', () => {
    it('o link da conta não enche o contador do convite: com 4 por minuto, duas contas e depois dois convites saem todos', async () => {
      const limite = limiteDe(4, new RelogioMovel(INICIO_DO_MINUTO + 10_000))
      const respostas = []
      for (const classe of ['conta', 'conta', 'convite', 'convite'] as const) respostas.push(await limite.consumir(classe))
      expect(respostas.map(({ resultado }) => resultado)).toEqual(['concedido', 'concedido', 'concedido', 'concedido'])
      expect(await limite.consumir('conta')).toMatchObject({ resultado: 'sem_vaga' })
    })

    it('o mesmo ponto devolvido duas vezes não abre mais do que gastou: os contadores não passam de zero', async () => {
      const limite = limiteDe(4, new RelogioMovel(INICIO_DO_MINUTO + 10_000))
      const gasto = await limite.consumir('convite')
      if (gasto.resultado !== 'concedido') throw new Error('o primeiro ponto do minuto devia ser concedido')
      await limite.devolver(gasto.ponto)
      await limite.devolver(gasto.ponto)

      const convites = []
      for (let i = 0; i < 5; i += 1) convites.push((await limite.consumir('convite')).resultado)
      const contas = []
      for (let i = 0; i < 5; i += 1) contas.push((await limite.consumir('conta')).resultado)
      // Convite: 2 de 4. Conta: o que falta do total, 2. Um contador abaixo de zero daria um a mais em cada.
      expect(convites.filter((resultado) => resultado === 'concedido')).toHaveLength(2)
      expect(contas.filter((resultado) => resultado === 'concedido')).toHaveLength(2)
    })
  })

  describe('o job devolvido à fila', () => {
    it('`devolverAoPublicado` só alcança o job `ativo` da escola do contexto: o de outra escola e o que não está ativo ficam como estão', async () => {
      const [escolaA, escolaB] = [await escolaNova(), await escolaNova()]
      const jobId = await bancada.enfileirar(escolaA, { tipo: TIPO_JOB_SINTETICO, fila: 'normal' })
      await bancada.pool.query("update job_registro set estado = 'ativo' where id = $1", [jobId])
      const daEscola = (id: string, escolaId: string) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.registro.devolverAoPublicado(id))

      expect(await daEscola(jobId, escolaB)).toBe(false)
      expect(await bancada.estado(jobId)).toMatchObject({ estado: 'ativo' })
      expect(await daEscola(jobId, escolaA)).toBe(true)
      expect(await bancada.estado(jobId)).toMatchObject({ estado: 'publicado' })
      expect(await daEscola(jobId, escolaA)).toBe(false)

      await bancada.pool.query("update job_registro set estado = 'concluido', concluido_em = now() where id = $1", [jobId])
      expect(await daEscola(jobId, escolaA)).toBe(false)
      expect(await bancada.estado(jobId)).toMatchObject({ estado: 'concluido' })
    })
  })

  describe('o ponto, quando o job não envia', () => {
    it('a cifra que não decifra termina `falhou` e o ponto volta: o envio seguinte sai no mesmo minuto', async () => {
      const escolaId = await escolaNova()
      const limite = limiteDe(1, new RelogioMovel(INICIO_DO_MINUTO + 30_000))
      const { rodar, enviadasPara } = processadorCom(limite)
      const adulterado = await conviteNaFila(escolaId)
      await bancada.pool.query("update convite set token_cifrado = $2 where id = $1", [adulterado.conviteId, Buffer.alloc(40, 7)])
      await rodar(escolaId, adulterado.conviteId)
      expect(await linha(adulterado.conviteId)).toMatchObject({ envio: 'falhou' })

      const seguinte = await conviteNaFila(escolaId)
      await rodar(escolaId, seguinte.conviteId)
      expect(enviadasPara(seguinte.endereco)).toHaveLength(1)
    })

    it('o banco que falha na reserva devolve o ponto e o erro sobe como veio', async () => {
      const escolaId = await escolaNova()
      const limite = limiteDe(1, new RelogioMovel(INICIO_DO_MINUTO + 30_000))
      const semBanco = criarEnvioDoConvite({
        envios: { reservar: () => Promise.reject(new Error('banco fora')), concluir: () => Promise.resolve(false), devolver: () => Promise.resolve(false) },
        emissor: new FakeEmailSender(),
        cifra,
        limite,
        urlDaWeb: URL_DA_WEB,
        logger: log.logger,
      })
      await expect(runInContext({ requisicaoId: randomUUID(), escolaId }, () => semBanco({ conviteId: randomUUID() }, jobExecution(randomUUID(), 1)))).rejects.toThrow('banco fora')
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'concedido' })
    })

    it('o Redis que falha ao devolver o ponto não esconde o desfecho do job: o envio já terminado termina o job sem erro', async () => {
      const escolaId = await escolaNova()
      const real = limiteDe(100, new RelogioMovel(INICIO_DO_MINUTO))
      const { rodar } = processadorCom({ consumir: (classe) => real.consumir(classe), devolver: () => Promise.reject(new Error('Redis fora')) })
      const terminado = await conviteNaFila(escolaId, { envio: 'enviado' })
      await expect(rodar(escolaId, terminado.conviteId)).resolves.toBeUndefined()
    })

    it('[P] a revogação com o job na barreira conta `reserva_perdida`, no envio aceito e na recusa do servidor', async () => {
      const escolaId = await escolaNova()
      const medidor = new MedidorDeTeste()
      try {
        const limite = limiteDe(100, new RelogioMovel(INICIO_DO_MINUTO))
        const { emissor, rodar } = processadorCom(limite, { medidor })
        const cancelar = (conviteId: string) =>
          bancada.pool.query(
            "update convite set envio = 'cancelado', token_cifrado = null, destino_cifrado = null, envio_reservado_em = null, revogado_em = now() where id = $1",
            [conviteId],
          )

        const aceito = await conviteNaFila(escolaId)
        const primeira = emissor.segurarNoProximo()
        const execucaoAceita = rodar(escolaId, aceito.conviteId)
        await primeira.chegou
        await cancelar(aceito.conviteId)
        primeira.soltar()
        await execucaoAceita

        const recusado = await conviteNaFila(escolaId)
        const recusando = criarEnvioDoConvite({
          envios,
          emissor: {
            enviar: async () => {
              await cancelar(recusado.conviteId)
              throw new EmailSendError('permanente')
            },
          },
          cifra,
          limite,
          urlDaWeb: URL_DA_WEB,
          logger: log.logger,
          medidor: medidor.medidor,
        })
        await runInContext({ requisicaoId: randomUUID(), escolaId }, () => recusando({ conviteId: recusado.conviteId }, jobExecution(randomUUID(), 1)))

        const porResultado = Object.fromEntries((await medidor.pontos(METRICS.emailPorResultado)).map(({ atributos, valor }) => [String(atributos['resultado']), valor]))
        expect(porResultado).toEqual({ reserva_perdida: 2 })
      } finally {
        await medidor.encerrar()
      }
    })
  })
})
