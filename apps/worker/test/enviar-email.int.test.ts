import 'reflect-metadata'
import {
  EmailSendError,
  EnvioRepository,
  FakeEmailSender,
  LimiteDeEmailPorMinuto,
  runInContext,
  SecretCipher,
  VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL,
} from '@educa/core'
import { CicloDeVidaRepository } from '@educa/core/ciclo-de-vida'
import { JobFailureCode, JOB_DEFINITIONS, TIPO_ENVIAR_CONVITE } from '@educa/shared'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { ConviteRepository } from '../../api/src/sessao/convite/convite.repository.js'
import { JobAdiadoError } from '../src/job-adiado.error.js'
import { JobFailureError } from '../src/job-failure.error.js'
import { criarEnvioDoConvite, TENTATIVAS_DO_ENVIO_DE_EMAIL } from '../src/processors/enviar-email.js'
import { jobExecution } from './job-execution.fixture.js'
import { InMemoryLog, QueueFixtures } from './queue.fixture.js'

// O job `email.enviar-convite` (acesso-e-convites, tarefa 1.0), contra o Postgres do compose de teste, com o adaptador falso de
// e-mail (regra 40: o que está fora é o que se simula): a mensagem que sai, a reserva sem corrida, o desfecho condicional à
// reserva, a revogação que vence o envio, o 4xx que repete e o 5xx que não, o isolamento entre escolas e o log sem dado pessoal.

const URL_DA_WEB = 'https://web.turmma.invalid'
const cifra = new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, randomBytes(32)]]))

beforeAll(() => {
  // Um worker do compose de pé poderia pegar o job de outro teste; este chama o processador direto.
  compose('stop', ...PROCESSOS_DA_FILA)
})

describe('email.enviar-convite', () => {
  const bancada = new QueueFixtures()
  const log = new InMemoryLog('worker-teste')
  const emissor = new FakeEmailSender()
  const escolas: string[] = []
  const envios = new EnvioRepository(bancada.banco)
  // O teto do minuto aqui não é o assunto (é o do `enviar-email-adiamento.int.test.ts`): alto, para nenhum caso esperar por ele.
  const limite = new LimiteDeEmailPorMinuto(bancada.redis, 100_000, { prefixo: bancada.prefixo })
  const processador = criarEnvioDoConvite({ envios, emissor, cifra, limite, urlDaWeb: URL_DA_WEB, logger: log.logger })

  afterAll(async () => {
    await bancada.pool.query('delete from convite where escola_id = any($1::uuid[])', [escolas])
    await bancada.fechar()
  })

  /** Uma escola nova, com o nome que a mensagem leva. */
  async function escolaNova(): Promise<string> {
    const escolaId = await bancada.escola()
    escolas.push(escolaId)
    return escolaId
  }

  interface Semente {
    readonly escolaId: string
    readonly conviteId: string
    readonly usuarioId: string
    readonly token: string
    readonly endereco: string
  }

  /** Um convite de professor por e-mail, `na_fila`, com o token e o endereço cifrados como a API os deixa. */
  async function conviteNaFila(escolaId: string, ajuste: { envio?: 'na_fila' | 'enviando'; reservadoHa?: string } = {}): Promise<Semente> {
    const conviteId = randomUUID()
    const token = randomBytes(24).toString('base64url')
    const endereco = `professora-${randomUUID()}@convite.invalid`
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [endereco])
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'professor', 'Professora sintética do envio', now()) returning id",
      [escolaId, contas[0]?.id],
    )
    const usuarioId = usuarios[0]?.id ?? ''
    const envio = ajuste.envio ?? 'na_fila'
    await bancada.pool.query(
      `insert into convite (id, escola_id, token_hash, tipo, usuario_id, expira_em, canal, envio, token_cifrado, destino_cifrado, envio_reservado_em)
       values ($1, $2, $3, 'professor', $4, now() + interval '7 days', 'email', $5, $6, $7, case when $5 = 'enviando' then now() - $8::interval end)`,
      [
        conviteId,
        escolaId,
        createHash('sha256').update(token).digest('hex'),
        usuarioId,
        envio,
        cifra.cifrar(Buffer.from(token), conviteId).cifrado,
        cifra.cifrar(Buffer.from(endereco), conviteId).cifrado,
        ajuste.reservadoHa ?? '0 seconds',
      ],
    )
    return { escolaId, conviteId, usuarioId, token, endereco }
  }

  interface LinhaDoConvite {
    envio: string | null
    token: Buffer | null
    destino: Buffer | null
    reservadoEm: Date | null
    enviadoEm: Date | null
    revogadoEm: Date | null
  }

  async function linha(conviteId: string): Promise<LinhaDoConvite> {
    const { rows } = await bancada.pool.query<LinhaDoConvite>(
      `select envio, token_cifrado as token, destino_cifrado as destino, envio_reservado_em as "reservadoEm", enviado_em as "enviadoEm", revogado_em as "revogadoEm" from convite where id = $1`,
      [conviteId],
    )
    const achada = rows[0]
    if (achada === undefined) throw new Error('convite de teste sumiu')
    return achada
  }

  /** O que o executor faz com a linha do job: roda o processador no contexto da escola do registro, com a tentativa dada. */
  function rodar(escolaId: string, conviteId: string, tentativa = 1): Promise<void> {
    return runInContext({ requisicaoId: randomUUID(), escolaId }, () => processador({ conviteId }, jobExecution(randomUUID(), tentativa), new AbortController().signal))
  }

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  /** Quantas mensagens o adaptador aceitou até agora para este endereço: o teste não depende da ordem dos outros. */
  const enviadasPara = (endereco: string) => emissor.enviadas.filter((mensagem) => mensagem.para === endereco)

  describe('a mensagem', () => {
    it('leva a escola e o link com o token depois do `#`, nenhum nome de usuário da escola, e termina `enviado` sem os cifrados', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      await rodar(escolaId, c.conviteId)

      const [mensagem, ...outras] = enviadasPara(c.endereco)
      expect(outras).toEqual([])
      expect(mensagem?.texto).toContain(`${URL_DA_WEB}/convite#${c.token}`)
      expect(mensagem?.assunto).toContain('Escola sintética da fila')
      expect(`${mensagem?.assunto}\n${mensagem?.texto}`).not.toContain('Professora sintética do envio')
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviado', token: null, destino: null, reservadoEm: null, enviadoEm: expect.any(Date) as Date })
      expect(log.doEvento('email.convite_enviado')).toContainEqual(expect.objectContaining({ conviteId: c.conviteId, estado: 'gravado' }))
      // O `convite.enviado` é o pedido da coordenação, gravado pela API; o job só muda o `envio` e não é autor de nada (regra 20, item 10).
      const { rows: auditados } = await bancada.pool.query<{ total: number }>("select count(*)::int as total from auditoria where escola_id = $1 and entidade_id = $2 and acao = 'convite.enviado'", [escolaId, c.conviteId])
      expect(auditados[0]?.total).toBe(0)
    })
  })

  describe('a revogação vence o envio', () => {
    const caminhos: Array<[string, (escolaId: string, c: Semente) => Promise<unknown>]> = [
      ['revogar', (escolaId, c) => naEscola(escolaId, () => new ConviteRepository(bancada.banco).revogar(c.conviteId, 'professor'))],
      ['revogarParaRefazer', (escolaId, c) => naEscola(escolaId, () => new ConviteRepository(bancada.banco).revogarParaRefazer(c.conviteId, 'professor'))],
      [
        'revogarConviteAberto (a defesa do desativar)',
        (escolaId, c) => naEscola(escolaId, () => bancada.banco.transaction((tx) => new CicloDeVidaRepository(tx).revogarConviteAberto(c.usuarioId))),
      ],
    ]

    for (const [nome, revogar] of caminhos) {
      it(`${nome}: revogado entre a fila e o envio, o convite vira \`cancelado\` sem cifrados, e o job não manda nada`, async () => {
        const escolaId = await escolaNova()
        const c = await conviteNaFila(escolaId)
        await revogar(escolaId, c)
        expect(await linha(c.conviteId)).toMatchObject({ envio: 'cancelado', token: null, destino: null, reservadoEm: null })

        await rodar(escolaId, c.conviteId)
        expect(enviadasPara(c.endereco)).toEqual([])
        expect(await linha(c.conviteId)).toMatchObject({ envio: 'cancelado', enviadoEm: null })
      })
    }

    it('revogar o convite com o envio já terminado (`enviado`, `falhou`, `cancelado`) ou sem envio (`copiado`) não muda o envio nem a hora do envio', async () => {
      const escolaId = await escolaNova()
      const terminados = []
      for (const envio of ['enviado', 'falhou', 'cancelado'] as const) {
        const c = await conviteNaFila(escolaId)
        await bancada.pool.query("update convite set envio = $2, token_cifrado = null, destino_cifrado = null, enviado_em = case when $2 = 'enviado' then now() end where id = $1", [c.conviteId, envio])
        terminados.push({ c, envio })
      }
      const copiado = await conviteNaFila(escolaId)
      await bancada.pool.query("update convite set canal = 'copiado', envio = null, token_cifrado = null, destino_cifrado = null where id = $1", [copiado.conviteId])

      for (const { c } of terminados) await caminhos[0]?.[1](escolaId, c)
      await caminhos[0]?.[1](escolaId, copiado)

      for (const { c, envio } of terminados) expect(await linha(c.conviteId), envio).toMatchObject({ envio, enviadoEm: envio === 'enviado' ? expect.any(Date) : null })
      expect(await linha(copiado.conviteId)).toMatchObject({ envio: null, revogadoEm: expect.any(Date) as Date })
    })

    it('4xx e revogação entre as tentativas: a linha devolvida é cancelada, e a segunda tentativa não manda um segundo e-mail', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      emissor.falharProximos('transitoria')
      await expect(rodar(escolaId, c.conviteId, 1)).rejects.toBeInstanceOf(JobFailureError)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'na_fila' })

      await caminhos[0]?.[1](escolaId, c)
      await rodar(escolaId, c.conviteId, 2)
      expect(enviadasPara(c.endereco)).toEqual([])
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'cancelado', token: null, destino: null })
    })

    it('[P] revogado com o job na barreira: o e-mail já saiu, mas a linha continua `cancelada` e o `enviado` não a sobrescreve', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      const barreira = emissor.segurarNoProximo()
      const execucao = rodar(escolaId, c.conviteId)
      await barreira.chegou
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviando' })

      await caminhos[0]?.[1](escolaId, c)
      barreira.soltar()
      await execucao

      const final = await linha(c.conviteId)
      expect(final).toMatchObject({ envio: 'cancelado', enviadoEm: null, token: null, destino: null })
      expect(final.revogadoEm).toBeInstanceOf(Date)
      expect(log.doEvento('email.convite_enviado')).toContainEqual(expect.objectContaining({ conviteId: c.conviteId, estado: 'reserva_perdida' }))
    })

    it('o 5xx de quem perdeu a reserva (revogado durante o envio) não grava `falhou`: a linha segue `cancelada` e o log diz que a reserva se perdeu', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      const revogandoAoFalhar = criarEnvioDoConvite({
        envios,
        emissor: {
          enviar: async () => {
            await caminhos[0]?.[1](escolaId, c)
            throw new EmailSendError('permanente')
          },
        },
        cifra,
        limite,
        urlDaWeb: URL_DA_WEB,
        logger: log.logger,
      })
      await runInContext({ requisicaoId: randomUUID(), escolaId }, () => revogandoAoFalhar({ conviteId: c.conviteId }, jobExecution(randomUUID(), 1), new AbortController().signal))
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'cancelado', token: null, destino: null })
      expect(log.doEvento('email.convite_falhou')).toContainEqual(expect.objectContaining({ conviteId: c.conviteId, tipo: 'permanente', estado: 'reserva_perdida' }))
    })
  })

  describe('o servidor de e-mail', () => {
    it('5xx: o convite termina `falhou` sem cifrados, e o job termina sem repetir', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      emissor.falharProximos('permanente')
      await rodar(escolaId, c.conviteId, 1)

      expect(await linha(c.conviteId)).toMatchObject({ envio: 'falhou', token: null, destino: null, reservadoEm: null, enviadoEm: null })
      await rodar(escolaId, c.conviteId, 2)
      expect(enviadasPara(c.endereco)).toEqual([])
    })

    it('4xx: volta a `na_fila` com os cifrados e o job repete; a segunda tentativa envia', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      emissor.falharProximos('transitoria')
      await expect(rodar(escolaId, c.conviteId, 1)).rejects.toMatchObject({ codigo: JobFailureCode.ERRO_INTERNO })
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'na_fila', reservadoEm: null, token: expect.any(Buffer) as Buffer, destino: expect.any(Buffer) as Buffer })

      await rodar(escolaId, c.conviteId, 2)
      expect(enviadasPara(c.endereco)).toHaveLength(1)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviado', token: null, destino: null })
    })

    it('a queda que não é uma recusa do servidor (erro sem natureza) vale como 4xx: a linha volta a `na_fila` e o job repete', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      const quedas = criarEnvioDoConvite({ envios, emissor: { enviar: () => Promise.reject(new Error('conexão caiu')) }, cifra, limite, urlDaWeb: URL_DA_WEB, logger: log.logger })
      const rodarCaindo = () => runInContext({ requisicaoId: randomUUID(), escolaId }, () => quedas({ conviteId: c.conviteId }, jobExecution(randomUUID(), 1), new AbortController().signal))
      await expect(rodarCaindo()).rejects.toBeInstanceOf(JobFailureError)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'na_fila', token: expect.any(Buffer) as Buffer })
    })

    it('sempre 4xx: as quatro primeiras tentativas devolvem, e a quinta grava `falhou`', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      emissor.falharProximos(...Array.from({ length: TENTATIVAS_DO_ENVIO_DE_EMAIL }, () => 'transitoria' as const))
      for (let tentativa = 1; tentativa < TENTATIVAS_DO_ENVIO_DE_EMAIL; tentativa += 1) {
        await expect(rodar(escolaId, c.conviteId, tentativa)).rejects.toBeInstanceOf(JobFailureError)
        expect(await linha(c.conviteId)).toMatchObject({ envio: 'na_fila' })
      }
      await rodar(escolaId, c.conviteId, TENTATIVAS_DO_ENVIO_DE_EMAIL)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'falhou', token: null, destino: null })
      expect(enviadasPara(c.endereco)).toEqual([])
    })
  })

  describe('a reserva', () => {
    it('reserva morta há mais de 2 min: outro processo retoma e envia; vigente há 1 min: não retoma, o job é adiado e nada sai', async () => {
      const escolaId = await escolaNova()
      const morta = await conviteNaFila(escolaId, { envio: 'enviando', reservadoHa: '3 minutes' })
      const vigente = await conviteNaFila(escolaId, { envio: 'enviando', reservadoHa: '1 minute' })

      await rodar(escolaId, morta.conviteId)
      expect(enviadasPara(morta.endereco)).toHaveLength(1)
      expect(await linha(morta.conviteId)).toMatchObject({ envio: 'enviado' })

      const antes = await linha(vigente.conviteId)
      await expect(rodar(escolaId, vigente.conviteId)).rejects.toBeInstanceOf(JobAdiadoError)
      expect(enviadasPara(vigente.endereco)).toEqual([])
      expect(await linha(vigente.conviteId)).toEqual(antes)
    })

    it('[P] duas execuções ao mesmo tempo, a primeira na barreira: a segunda não envia, e o e-mail sai uma vez só', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      const barreira = emissor.segurarNoProximo()
      const primeira = rodar(escolaId, c.conviteId)
      await barreira.chegou

      await expect(rodar(escolaId, c.conviteId)).rejects.toBeInstanceOf(JobAdiadoError)
      expect(enviadasPara(c.endereco)).toEqual([])
      barreira.soltar()
      await primeira

      expect(enviadasPara(c.endereco)).toHaveLength(1)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviado' })
    })

    it('[P] oito reservas do mesmo convite ao mesmo tempo: o banco concede uma só, e as outras veem a reserva alheia', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)

      const resultados = await Promise.all(Array.from({ length: 8 }, () => naEscola(escolaId, () => envios.reservar(c.conviteId))))

      expect(resultados.filter((r) => r.resultado === 'reservado')).toHaveLength(1)
      expect(resultados.filter((r) => r.resultado === 'reserva_alheia')).toHaveLength(7)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviando' })
    })

    it('o job repetido depois de `enviado` não manda de novo', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      await rodar(escolaId, c.conviteId)
      await rodar(escolaId, c.conviteId, 2)
      expect(enviadasPara(c.endereco)).toHaveLength(1)
      expect(log.doEvento('email.convite_nao_enviado')).toContainEqual(expect.objectContaining({ conviteId: c.conviteId, tentativa: 2, estado: 'encerrado' }))
    })

    it('o desfecho é da reserva: `concluir` e `devolver` com a marca de uma reserva que outro processo já retomou não gravam nada', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      const primeira = await naEscola(escolaId, () => envios.reservar(c.conviteId))
      if (primeira.resultado !== 'reservado') throw new Error('a primeira reserva devia vir')
      // O processo da primeira reserva morreu: a marca dela passa de 2 min, e outro retoma a linha com a marca dele.
      await bancada.pool.query("update convite set envio_reservado_em = now() - interval '3 minutes' where id = $1", [c.conviteId])
      const segunda = await naEscola(escolaId, () => envios.reservar(c.conviteId))
      if (segunda.resultado !== 'reservado') throw new Error('a retomada devia reservar')
      expect(segunda.reserva.getTime()).toBeGreaterThan(primeira.reserva.getTime())

      expect(await naEscola(escolaId, () => envios.concluir(c.conviteId, primeira.reserva, 'enviado'))).toBe(false)
      expect(await naEscola(escolaId, () => envios.devolver(c.conviteId, primeira.reserva))).toBe(false)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviando', token: expect.any(Buffer) as Buffer, enviadoEm: null })

      expect(await naEscola(escolaId, () => envios.concluir(c.conviteId, segunda.reserva, 'enviado'))).toBe(true)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviado', token: null, destino: null })
    })

    it('o desfecho de quem reservou não ressuscita o convite revogado: `concluir` e `devolver` dão `false`, e a linha segue `cancelada`', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      const reservado = await naEscola(escolaId, () => envios.reservar(c.conviteId))
      if (reservado.resultado !== 'reservado') throw new Error('a reserva devia vir')
      await naEscola(escolaId, () => new ConviteRepository(bancada.banco).revogar(c.conviteId, 'professor'))

      expect(await naEscola(escolaId, () => envios.concluir(c.conviteId, reservado.reserva, 'enviado'))).toBe(false)
      expect(await naEscola(escolaId, () => envios.concluir(c.conviteId, reservado.reserva, 'falhou'))).toBe(false)
      expect(await naEscola(escolaId, () => envios.devolver(c.conviteId, reservado.reserva))).toBe(false)
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'cancelado', enviadoEm: null, token: null, destino: null })
    })

    it('o desfecho de uma escola não alcança o convite de outra: `concluir` e `devolver` com o id da B no contexto da A dão `false`', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const deB = await conviteNaFila(b)
      const reservado = await naEscola(b, () => envios.reservar(deB.conviteId))
      if (reservado.resultado !== 'reservado') throw new Error('a reserva devia vir')

      expect(await naEscola(a, () => envios.concluir(deB.conviteId, reservado.reserva, 'enviado'))).toBe(false)
      expect(await naEscola(a, () => envios.devolver(deB.conviteId, reservado.reserva))).toBe(false)
      expect(await linha(deB.conviteId)).toMatchObject({ envio: 'enviando' })
    })
  })

  describe('isolamento entre escolas', () => {
    it('o id do convite da escola B num job da escola A: nada é enviado e a linha da B fica intacta', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const deB = await conviteNaFila(b)
      const antes = await linha(deB.conviteId)

      await rodar(a, deB.conviteId)

      expect(enviadasPara(deB.endereco)).toEqual([])
      expect(await linha(deB.conviteId)).toEqual(antes)
      // Para a escola A o convite da B não existe: a mesma resposta do id que ninguém tem, e não a de "já encerrado" (regra 10, item 6).
      expect(log.doEvento('email.convite_nao_enviado')).toContainEqual(expect.objectContaining({ conviteId: deB.conviteId, estado: 'inexistente' }))
    })

    it('o convite da B com o envio `enviando` e reserva vigente, num job da A, também é `inexistente`: o job não repete à espera de uma reserva que não é da escola dele', async () => {
      const a = await escolaNova()
      const b = await escolaNova()
      const deB = await conviteNaFila(b, { envio: 'enviando', reservadoHa: '30 seconds' })
      await expect(rodar(a, deB.conviteId)).resolves.toBeUndefined()
      expect(enviadasPara(deB.endereco)).toEqual([])
    })

    it('o payload adulterado (escola no payload, id que não é UUID) é recusado pelo esquema do tipo', () => {
      const { dados } = JOB_DEFINITIONS[TIPO_ENVIAR_CONVITE]
      const conviteId = randomUUID()
      expect(dados.safeParse({ conviteId }).success).toBe(true)
      expect(dados.safeParse({ conviteId, escolaId: randomUUID() }).success).toBe(false)
      expect(dados.safeParse({ conviteId, para: 'alguem@convite.invalid' }).success).toBe(false)
      expect(dados.safeParse({ conviteId: '42' }).success).toBe(false)
    })
  })

  describe('o que o log guarda', () => {
    it('nenhuma linha traz o token, o endereço, o nome da escola nem o nome da pessoa: só ids, a tentativa e o motivo', async () => {
      const escolaId = await escolaNova()
      const enviado = await conviteNaFila(escolaId)
      const repetido = await conviteNaFila(escolaId)
      const falho = await conviteNaFila(escolaId)
      await rodar(escolaId, enviado.conviteId)
      emissor.falharProximos('transitoria')
      await rodar(escolaId, repetido.conviteId, 1).catch(() => undefined)
      emissor.falharProximos('permanente')
      await rodar(escolaId, falho.conviteId)

      const texto = log.linhas.join('\n')
      for (const segredo of [enviado, repetido, falho].flatMap((c) => [c.token, c.endereco])) expect(texto).not.toContain(segredo)
      expect(texto).not.toContain('Escola sintética da fila')
      expect(texto).not.toContain('Professora sintética do envio')
      expect(log.doEvento('email.convite_enviado')).toContainEqual(expect.objectContaining({ conviteId: enviado.conviteId, tentativa: 1 }))
      expect(log.doEvento('email.convite_repetira')).toContainEqual(expect.objectContaining({ conviteId: repetido.conviteId, tipo: 'transitoria' }))
      expect(log.doEvento('email.convite_falhou')).toContainEqual(expect.objectContaining({ conviteId: falho.conviteId, tipo: 'permanente' }))
    })
  })

  describe('a cifra', () => {
    it('o erro que não é de decifração sobe como veio, e a linha não vira `falhou`: a reserva vence e o job repete', async () => {
      const escolaId = await escolaNova()
      const c = await conviteNaFila(escolaId)
      const quebrada = criarEnvioDoConvite({ envios, emissor, cifra: { decifrar: () => { throw new Error('defeito da cifra') } }, limite, urlDaWeb: URL_DA_WEB, logger: log.logger })
      await expect(runInContext({ requisicaoId: randomUUID(), escolaId }, () => quebrada({ conviteId: c.conviteId }, jobExecution(randomUUID(), 1), new AbortController().signal))).rejects.toThrow('defeito da cifra')
      expect(await linha(c.conviteId)).toMatchObject({ envio: 'enviando', token: expect.any(Buffer) as Buffer })
      expect(enviadasPara(c.endereco)).toEqual([])
    })

    it('o token adulterado, ou copiado da linha de outro convite, não decifra: o envio termina `falhou` e nada sai', async () => {
      const escolaId = await escolaNova()
      const adulterado = await conviteNaFila(escolaId)
      const copiado = await conviteNaFila(escolaId)
      const doutro = await conviteNaFila(escolaId)

      const { token } = await linha(adulterado.conviteId)
      const quebrado = Buffer.from(token ?? Buffer.alloc(0))
      quebrado[quebrado.length - 1] = (quebrado[quebrado.length - 1] ?? 0) ^ 0xff
      await bancada.pool.query('update convite set token_cifrado = $2 where id = $1', [adulterado.conviteId, quebrado])
      // O cifrado válido de outro convite, posto nesta linha: o id da linha é o dado autenticado e não confere.
      await bancada.pool.query('update convite set token_cifrado = (select token_cifrado from convite where id = $2) where id = $1', [copiado.conviteId, doutro.conviteId])

      await rodar(escolaId, adulterado.conviteId)
      await rodar(escolaId, copiado.conviteId)

      for (const c of [adulterado, copiado]) {
        expect(enviadasPara(c.endereco)).toEqual([])
        expect(await linha(c.conviteId)).toMatchObject({ envio: 'falhou', token: null, destino: null })
      }
      expect(log.doEvento('email.convite_nao_decifra')).toHaveLength(2)
    })
  })
})
