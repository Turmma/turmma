import 'reflect-metadata'
import {
  DONO_DAS_VAGAS_DO_SISTEMA,
  EmailSendError,
  FakeEmailSender,
  LimiteDeEmailPorMinuto,
  QUEUE_PRIORITY,
  runInContext,
  SecretCipher,
  VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL,
  type Clock,
  type EmailSender,
  type LimiteDeEmail,
} from '@educa/core'
import { JobFailureCode, TIPO_ENVIAR_CONVITE, TIPO_ENVIAR_EMAIL_DA_CONTA } from '@educa/shared'
import { DelayedError } from 'bullmq'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { TenantResolutionRepository } from '../../api/src/sessao/tenant/tenant-resolution.repository.js'
import { JobAdiadoError } from '../src/job-adiado.error.js'
import { JobExecutor, type JobProcessors, type QueuedJob } from '../src/job-executor.js'
import { JobFailureError } from '../src/job-failure.error.js'
import { criarEnvioDoConvite, criarEnvioDoLinkDaConta, criarEnvios, TENTATIVAS_DO_ENVIO_DO_LINK_DA_CONTA } from '../src/processors/enviar-email.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

// O job `sistema.enviar-email-da-conta` (acesso-e-convites, tarefa 5.0), contra o Postgres e o Redis de fila do compose de teste, com o adaptador falso de
// e-mail: um job de sistema, sem escola, que lê e grava o `link_da_conta` só pelo id; a mensagem, o desfecho condicional à reserva, o 4xx que repete e o 5xx
// que não, a vaga `normal:sistema` que ocupa e solta, e a metade do `EMAIL_POR_MINUTO` que os convites não alcançam.

const URL_DA_WEB = 'https://web.turmma.invalid'
const cifra = new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, randomBytes(32)]]))
const INICIO_DO_MINUTO = Date.UTC(2026, 10, 9, 12, 0, 0)

beforeAll(() => {
  // Um worker do compose de pé poderia pegar o job de outro teste; este chama o processador e o executor direto.
  compose('stop', ...PROCESSOS_DA_FILA)
})

class RelogioMovel implements Clock {
  constructor(public emMs: number) {}
  agora(): Date {
    return new Date(this.emMs)
  }
}

describe('sistema.enviar-email-da-conta', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const envios = criarEnvios(bancada.banco)
  const contas: string[] = []
  const alto = new LimiteDeEmailPorMinuto(bancada.redis, 100_000, { prefixo: bancada.prefixo })

  afterAll(async () => {
    await bancada.pool.query('delete from conta where id = any($1::uuid[])', [contas])
    await bancada.fechar()
  })

  interface Semente {
    readonly linkId: string
    readonly contaId: string
    readonly token: string
    readonly endereco: string
  }

  /** Um link da conta, `na_fila`, com o token e o endereço cifrados como a API os deixa. */
  async function linkNaFila(ajuste: { envio?: 'na_fila' | 'enviando'; reservadoHa?: string; finalidade?: 'redefinir' | 'verificar'; criadoHa?: string } = {}): Promise<Semente> {
    const linkId = randomUUID()
    const token = randomBytes(32).toString('base64url')
    const endereco = `equipe-${randomUUID()}@conta.invalid`
    const { rows } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [endereco])
    const contaId = rows[0]?.id ?? ''
    contas.push(contaId)
    const envio = ajuste.envio ?? 'na_fila'
    await bancada.pool.query(
      `insert into link_da_conta (id, conta_id, finalidade, token_hash, token_cifrado, destino_cifrado, expira_em, envio, envio_reservado_em, criado_em)
       values ($1, $2, $3, $4, $5, $6, now() + interval '1 hour', $7, case when $7 = 'enviando' then now() - $8::interval end, now() - $9::interval)`,
      [
        linkId,
        contaId,
        ajuste.finalidade ?? 'redefinir',
        createHash('sha256').update(token).digest('hex'),
        cifra.cifrar(Buffer.from(token), linkId).cifrado,
        cifra.cifrar(Buffer.from(endereco), linkId).cifrado,
        envio,
        ajuste.reservadoHa ?? '0 seconds',
        ajuste.criadoHa ?? '0 seconds',
      ],
    )
    return { linkId, contaId, token, endereco }
  }

  interface LinhaDoLink {
    envio: string
    token: Buffer | null
    destino: Buffer | null
    reservadoEm: Date | null
  }

  async function linha(linkId: string): Promise<LinhaDoLink> {
    const { rows } = await bancada.pool.query<LinhaDoLink>('select envio, token_cifrado as token, destino_cifrado as destino, envio_reservado_em as "reservadoEm" from link_da_conta where id = $1', [linkId])
    const achada = rows[0]
    if (achada === undefined) throw new Error('link de teste sumiu')
    return achada
  }

  /** Um processador do link com o falso e o limite dados. */
  function processadorCom(limite: LimiteDeEmail = alto, opcoes: { emissor?: FakeEmailSender; relogio?: Clock } = {}) {
    const emissor = opcoes.emissor ?? new FakeEmailSender()
    const processador = criarEnvioDoLinkDaConta({ envios, emissor, cifra, limite, urlDaWeb: URL_DA_WEB, logger: log.logger, ...(opcoes.relogio === undefined ? {} : { relogio: opcoes.relogio }) })
    /** Como o executor chama o job de sistema: sem escola, no contexto da rotina do sistema. */
    const rodar = (linkId: string, tentativa = 1): Promise<void> =>
      runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({ linkId }, jobExecution(randomUUID(), tentativa), new AbortController().signal))
    const enviadasPara = (endereco: string) => emissor.enviadas.filter((mensagem) => mensagem.para === endereco)
    return { emissor, processador, rodar, enviadasPara }
  }

  describe('a mensagem e o desfecho', () => {
    it('leva o link com o token depois do `#`, sem escola nem nome, e termina `enviado` sem os cifrados; o log leva só o id', async () => {
      const l = await linkNaFila()
      const { rodar, enviadasPara } = processadorCom()
      await rodar(l.linkId)

      const [mensagem, ...outras] = enviadasPara(l.endereco)
      expect(outras).toEqual([])
      expect(mensagem?.texto).toContain(`${URL_DA_WEB}/redefinir#${l.token}`)
      expect(mensagem?.texto).toContain('1 hora')
      expect(await linha(l.linkId)).toMatchObject({ envio: 'enviado', token: null, destino: null, reservadoEm: null })
      expect(log.doEvento('email.link_da_conta_enviado')).toContainEqual(expect.objectContaining({ linkId: l.linkId, estado: 'gravado' }))
      for (const linhaDoLog of log.linhas.filter((texto) => texto.includes(l.linkId))) {
        expect(linhaDoLog).not.toContain(l.endereco)
        expect(linhaDoLog).not.toContain(l.token)
      }
    })

    it('o link de `verificar` leva o caminho e a validade dele', async () => {
      const l = await linkNaFila({ finalidade: 'verificar' })
      const { rodar, enviadasPara } = processadorCom()
      await rodar(l.linkId)
      expect(enviadasPara(l.endereco)[0]?.texto).toContain(`${URL_DA_WEB}/verificar#${l.token}`)
      expect(enviadasPara(l.endereco)[0]?.texto).toContain('24 horas')
    })

    it('o job repetido depois de `enviado` não manda um segundo e-mail, e o id que não existe termina sem mandar nada', async () => {
      const l = await linkNaFila()
      const { rodar, enviadasPara } = processadorCom()
      await rodar(l.linkId)
      await rodar(l.linkId, 2)
      await rodar(randomUUID())
      expect(enviadasPara(l.endereco)).toHaveLength(1)
      expect(log.doEvento('email.link_da_conta_nao_enviado')).toContainEqual(expect.objectContaining({ linkId: l.linkId, estado: 'encerrado' }))
    })

    it('cifrado de outra linha não decifra aqui (o id da linha é o dado autenticado): `falhou`, sem e-mail', async () => {
      const l = await linkNaFila()
      const outro = await linkNaFila()
      await bancada.pool.query('update link_da_conta set token_cifrado = (select token_cifrado from link_da_conta where id = $2) where id = $1', [l.linkId, outro.linkId])
      const { rodar, enviadasPara } = processadorCom()
      await rodar(l.linkId)
      expect(enviadasPara(l.endereco)).toEqual([])
      expect(await linha(l.linkId)).toMatchObject({ envio: 'falhou', token: null, destino: null })
      expect(log.doEvento('email.link_da_conta_nao_decifra')).toContainEqual(expect.objectContaining({ linkId: l.linkId }))
    })
  })

  describe('o link novo vence o envio', () => {
    /** O que o "esqueci" seguinte faz com o link aberto, pelo método de verdade da API (`cancelarLinksAbertos`), e não por uma cópia dele em SQL. */
    const cancelar = (contaId: string) => new TenantResolutionRepository(bancada.banco).cancelarLinksAbertos(contaId, 'redefinir')

    it('cancelado entre a fila e o envio: o job não manda nada e a linha continua `cancelado`', async () => {
      const l = await linkNaFila()
      await cancelar(l.contaId)
      const { rodar, enviadasPara } = processadorCom()
      await rodar(l.linkId)
      expect(enviadasPara(l.endereco)).toEqual([])
      expect(await linha(l.linkId)).toMatchObject({ envio: 'cancelado', token: null, destino: null })
    })

    it('[P] cancelado com o job na barreira: o e-mail já saiu, mas a linha continua `cancelado` e o `enviado` não a sobrescreve', async () => {
      const l = await linkNaFila()
      const { emissor, rodar } = processadorCom()
      const barreira = emissor.segurarNoProximo()
      const execucao = rodar(l.linkId)
      await barreira.chegou
      await cancelar(l.contaId)
      barreira.soltar()
      await execucao
      expect(await linha(l.linkId)).toMatchObject({ envio: 'cancelado', token: null, destino: null })
      expect(log.doEvento('email.link_da_conta_enviado')).toContainEqual(expect.objectContaining({ linkId: l.linkId, estado: 'reserva_perdida' }))
    })
  })

  describe('o cancelamento e o 4xx', () => {
    it('cancelado enquanto o servidor responde 4xx: a linha continua `cancelado`, sem os cifrados, e a tentativa seguinte não envia', async () => {
      const l = await linkNaFila()
      // O servidor ainda não respondeu quando o "esqueci" seguinte chega; a resposta é "tente depois".
      const emissorDoCancelamento: EmailSender = {
        enviar: async () => {
          await new TenantResolutionRepository(bancada.banco).cancelarLinksAbertos(l.contaId, 'redefinir')
          throw new EmailSendError('transitoria')
        },
      }
      const processador = criarEnvioDoLinkDaConta({ envios, emissor: emissorDoCancelamento, cifra, limite: alto, urlDaWeb: URL_DA_WEB, logger: log.logger })
      const rodarCancelando = (tentativa: number) => runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({ linkId: l.linkId }, jobExecution(randomUUID(), tentativa), new AbortController().signal))
      await expect(rodarCancelando(1)).rejects.toBeInstanceOf(JobFailureError)
      // O `devolver` não casa com a reserva perdida: a linha não volta a `na_fila`.
      expect(await linha(l.linkId)).toMatchObject({ envio: 'cancelado', token: null, destino: null, reservadoEm: null })

      const { rodar, enviadasPara } = processadorCom()
      await rodar(l.linkId, 2)
      expect(enviadasPara(l.endereco)).toEqual([])
      expect(await linha(l.linkId)).toMatchObject({ envio: 'cancelado', token: null, destino: null })
    })
  })

  describe('o servidor SMTP', () => {
    it('4xx em toda tentativa: a linha volta a `na_fila` e o job repete; na última, `falhou` e os cifrados saem', async () => {
      const l = await linkNaFila()
      const { emissor, rodar, enviadasPara } = processadorCom()
      for (let tentativa = 1; tentativa < TENTATIVAS_DO_ENVIO_DO_LINK_DA_CONTA; tentativa += 1) {
        emissor.falharProximos('transitoria')
        await expect(rodar(l.linkId, tentativa)).rejects.toBeInstanceOf(JobFailureError)
        expect(await linha(l.linkId)).toMatchObject({ envio: 'na_fila', reservadoEm: null })
      }
      emissor.falharProximos('transitoria')
      await rodar(l.linkId, TENTATIVAS_DO_ENVIO_DO_LINK_DA_CONTA)
      expect(await linha(l.linkId)).toMatchObject({ envio: 'falhou', token: null, destino: null })
      expect(enviadasPara(l.endereco)).toEqual([])
    })

    it('4xx e depois a resposta boa: o segundo envio chega ao falso e a linha termina `enviado`', async () => {
      const l = await linkNaFila()
      const { emissor, rodar, enviadasPara } = processadorCom()
      emissor.falharProximos('transitoria')
      await expect(rodar(l.linkId, 1)).rejects.toMatchObject({ message: JobFailureCode.ERRO_INTERNO })
      await rodar(l.linkId, 2)
      expect(enviadasPara(l.endereco)).toHaveLength(1)
      expect(await linha(l.linkId)).toMatchObject({ envio: 'enviado', token: null, destino: null })
    })

    it('5xx: `falhou` na primeira tentativa, sem nova', async () => {
      const l = await linkNaFila()
      const { emissor, rodar } = processadorCom()
      emissor.falharProximos('permanente')
      await rodar(l.linkId, 1)
      expect(await linha(l.linkId)).toMatchObject({ envio: 'falhou', token: null, destino: null })
    })
  })

  describe('a reserva', () => {
    it('reserva alheia vigente: o job adia até o prazo dela, sem mandar nada, e o ponto gasto volta (o envio seguinte sai no mesmo minuto); vencida, é retomada', async () => {
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 15_000)
      // Teto 2: o convite usa 2 − ⌊2/2⌋ = 1 ponto por minuto, e o outro é do link da conta. Se o ponto da reserva alheia não voltasse, a retomada adiaria.
      const limite = new LimiteDeEmailPorMinuto(bancada.redis, 2, { prefixo: `${bancada.prefixo}:${randomUUID()}`, relogio })
      const vigente = await linkNaFila({ envio: 'enviando', reservadoHa: '30 seconds' })
      const { rodar, enviadasPara } = processadorCom(limite, { relogio })
      const adiado = await rodar(vigente.linkId).then(
        () => undefined,
        (falha: unknown) => falha,
      )
      expect(adiado).toBeInstanceOf(JobAdiadoError)
      expect(enviadasPara(vigente.endereco)).toEqual([])
      expect(await linha(vigente.linkId)).toMatchObject({ envio: 'enviando' })

      const vencida = await linkNaFila({ envio: 'enviando', reservadoHa: '3 minutes' })
      await rodar(vencida.linkId)
      expect(enviadasPara(vencida.endereco)).toHaveLength(1)
      expect(await linha(vencida.linkId)).toMatchObject({ envio: 'enviado' })
    })

    it('[P] dois jobs do mesmo link ao mesmo tempo: um e-mail só', async () => {
      const l = await linkNaFila()
      const { emissor, rodar, enviadasPara } = processadorCom()
      const barreira = emissor.segurarNoProximo()
      const primeiro = rodar(l.linkId)
      await barreira.chegou
      const segundo = await rodar(l.linkId, 2).then(
        () => undefined,
        (falha: unknown) => falha,
      )
      barreira.soltar()
      await primeiro
      // O segundo achou a reserva do primeiro vigente e adiou.
      expect(segundo).toBeInstanceOf(JobAdiadoError)
      expect(enviadasPara(l.endereco)).toHaveLength(1)
    })

    it('o desfecho é da reserva: `concluirLink` e `devolverLink` com a marca de uma reserva que outro processo já retomou não gravam nada', async () => {
      const l = await linkNaFila()
      const comoOJob = <T>(passo: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, passo)
      const primeira = await comoOJob(() => envios.reservarLink(l.linkId))
      if (primeira.resultado !== 'reservado') throw new Error('a primeira reserva devia vir')
      // O processo da primeira reserva morreu: a marca dela passa de 2 min, e outro retoma a linha com a marca dele.
      await bancada.pool.query("update link_da_conta set envio_reservado_em = now() - interval '3 minutes' where id = $1", [l.linkId])
      const segunda = await comoOJob(() => envios.reservarLink(l.linkId))
      if (segunda.resultado !== 'reservado') throw new Error('a retomada devia reservar')
      expect(segunda.reserva.getTime()).toBeGreaterThan(primeira.reserva.getTime())

      expect(await comoOJob(() => envios.concluirLink(l.linkId, primeira.reserva, 'enviado'))).toBe(false)
      expect(await comoOJob(() => envios.devolverLink(l.linkId, primeira.reserva))).toBe(false)
      expect(await linha(l.linkId)).toMatchObject({ envio: 'enviando', token: expect.any(Buffer) as Buffer, destino: expect.any(Buffer) as Buffer, reservadoEm: segunda.reserva })

      expect(await comoOJob(() => envios.concluirLink(l.linkId, segunda.reserva, 'enviado'))).toBe(true)
      expect(await linha(l.linkId)).toMatchObject({ envio: 'enviado', token: null, destino: null, reservadoEm: null })
    })
  })

  describe('a vaga do sistema', () => {
    function executorCom(processadores: JobProcessors) {
      return new JobExecutor({
        repositorio: bancada.registro,
        processadores,
        logger: log.logger,
        vagas: bancada.vagas,
        vagasDaEscola: { daEscola: () => Promise.resolve({ interativa: 1, normal: 1, lote: 1 }) },
        uso: { marcar: () => undefined },
      })
    }

    /** Um job de sistema na fila `normal`, como a API o grava no "esqueci": sem escola e sem `rotinaDoSistema`. */
    async function jobDoSistema(dados: Record<string, unknown>): Promise<{ jobId: string; job: QueuedJob }> {
      const jobId = await runInContext({ requisicaoId: randomUUID() }, () =>
        bancada.banco.transaction((tx) => bancada.registro.inserir(tx, { tipo: TIPO_ENVIAR_EMAIL_DA_CONTA, fila: 'normal', prioridade: QUEUE_PRIORITY.normal, naoUrgente: false, dados })),
      )
      await bancada.pool.query("update job_registro set estado = 'publicado' where id = $1", [jobId])
      const moveToDelayed = vi.fn<QueuedJob['moveToDelayed']>(() => Promise.resolve())
      const job = { id: jobId, data: { escolaId: null, requisicaoId: null }, attemptsMade: 0, opts: { attempts: TENTATIVAS_DO_ENVIO_DO_LINK_DA_CONTA }, moveToDelayed } as unknown as QueuedJob
      return { jobId, job }
    }

    it('o job é de escola nula, lê o link pelo id do job, ocupa a `vaga:normal:sistema` enquanto envia e a solta no fim', async () => {
      const l = await linkNaFila()
      const emissor = new FakeEmailSender()
      const { processador } = processadorCom(alto, { emissor })
      const executor = executorCom({ [TIPO_ENVIAR_EMAIL_DA_CONTA]: processador })
      const { jobId, job } = await jobDoSistema({ linkId: l.linkId })
      expect(await bancada.estado(jobId)).toMatchObject({ escolaId: null })

      const barreira = emissor.segurarNoProximo()
      const execucao = executor.processar(job, 'token')
      await barreira.chegou
      expect(await bancada.vagas.membros('normal', null)).toContain(jobId)
      barreira.soltar()
      await execucao
      expect(await bancada.vagas.membros('normal', null)).not.toContain(jobId)
      expect(await bancada.estado(jobId)).toMatchObject({ estado: 'concluido' })
      expect(await linha(l.linkId)).toMatchObject({ envio: 'enviado' })
      expect(DONO_DAS_VAGAS_DO_SISTEMA).toBe('sistema')
    })

    it('adiado, o job solta a vaga e volta a `publicado`: o outro job `normal` do sistema roda na hora, com o limite em 1', async () => {
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 5_000)
      const limite = new LimiteDeEmailPorMinuto(bancada.redis, 2, { prefixo: `${bancada.prefixo}:${randomUUID()}`, relogio })
      // O teto do minuto é 2: gastos os dois, o link da conta não tem ponto e o job adia.
      await limite.consumir('conta')
      await limite.consumir('conta')
      const l = await linkNaFila()
      const outroLink = await linkNaFila()
      const sintetico = vi.fn(() => Promise.resolve())
      const doLink = processadorCom(limite, { relogio }).processador
      // O outro job `normal` do sistema: o mesmo tipo, com um corpo que não passa pelo teto do minuto.
      const executor = executorCom({ [TIPO_ENVIAR_EMAIL_DA_CONTA]: (dados, execucao, sinal) => (dados.linkId === outroLink.linkId ? sintetico() : doLink(dados, execucao, sinal)) })
      const adiado = await jobDoSistema({ linkId: l.linkId })
      const outro = await jobDoSistema({ linkId: outroLink.linkId })

      await expect(executor.processar(adiado.job, 'token')).rejects.toBeInstanceOf(DelayedError)
      expect(await bancada.vagas.membros('normal', null)).not.toContain(adiado.jobId)
      await executor.processar(outro.job, 'token')
      expect(sintetico).toHaveBeenCalledTimes(1)
      expect(await bancada.estado(adiado.jobId)).toMatchObject({ estado: 'publicado' })
      expect(await bancada.estado(outro.jobId)).toMatchObject({ estado: 'concluido' })
      expect(await linha(l.linkId)).toMatchObject({ envio: 'na_fila' })
    })
  })

  describe('o EMAIL_POR_MINUTO', () => {
    it('com os convites enchendo a metade deles, o link da conta ainda sai no minuto, e um convite a mais é adiado', async () => {
      const relogio = new RelogioMovel(INICIO_DO_MINUTO + 15_000)
      // Teto 4: o convite usa até 4 − ⌊4/2⌋ = 2 pontos por minuto; os outros 2 são do link da conta.
      const limite = new LimiteDeEmailPorMinuto(bancada.redis, 4, { prefixo: `${bancada.prefixo}:${randomUUID()}`, relogio })
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'concedido' })
      expect(await limite.consumir('convite')).toMatchObject({ resultado: 'concedido' })

      const l = await linkNaFila()
      const { rodar, enviadasPara } = processadorCom(limite, { relogio })
      await rodar(l.linkId)
      expect(enviadasPara(l.endereco)).toHaveLength(1)
      expect(await linha(l.linkId)).toMatchObject({ envio: 'enviado' })

      // O convite a mais: a metade dele está cheia, e o job adia sem tocar na linha.
      const escolaId = await bancada.escola()
      const conviteId = randomUUID()
      const processadorDoConvite = criarEnvioDoConvite({ envios, emissor: new FakeEmailSender(), cifra, limite, urlDaWeb: URL_DA_WEB, logger: log.logger, relogio })
      const adiado = await runInContext({ requisicaoId: randomUUID(), escolaId }, () => processadorDoConvite({ conviteId }, jobExecution(randomUUID(), 1), new AbortController().signal)).then(
        () => undefined,
        (falha: unknown) => falha,
      )
      expect(adiado).toBeInstanceOf(JobAdiadoError)
      expect(TIPO_ENVIAR_CONVITE).toBe('email.enviar-convite')
    })
  })
})
