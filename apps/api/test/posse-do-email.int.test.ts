import { loadChaveDoTokenDeEmail, SecretCipher, VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL } from '@educa/core'
import { ErrorCode, TIPO_ENVIAR_EMAIL_DA_CONTA } from '@educa/shared'
import type { Redis } from 'ioredis'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { travarRedis } from '../../../tools/testes/redis-travado.ts'
import { PasswordHasher, REDIS_LOGIN_CLIENT } from '../src/credencial/index.js'
import { criarConviteDeCoordenador } from '../src/sessao/index.js'
import { autorDaBancada, SessaoFixtures } from './sessao.fixture.js'
import { subirApi, type TestApi } from './test-api.js'
import { TEST_APP_OPTIONS, testConfig } from './test-config.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * A posse do e-mail (acesso-e-convites, tarefa 7.0; RF12, RF17; `cenarios.md`, "E-mail, convite e posse", "Limites", "Corridas", "Auditoria" e "A1 e F2 que mudam de regra").
 * Postgres e Redis reais do compose de teste. O que se prova: o aceite de convite **enviado por e-mail** grava `emailVerificadoEm`; a conta com senha e sem a posse provada que
 * aceita convite **copiado** de outra escola recebe `VERIFICACAO_PENDENTE` e o link de verificar (24 h, 3 por hora por conta); e `POST /v1/conta/verificar` libera o aceite. O e-mail em si
 * sai pelo worker (`apps/worker/test/enviar-email-da-conta.int.test.ts`): aqui o que se prova é o pedido, a linha e o job.
 */

const SENHA_DA_CONTA = 'senha-sintetica-da-conta-1'
const SENHA_NOVA = 'senha-sintetica-do-convite-12'
const SENHA_ESCOLHIDA_EM_A = 'senha-sintetica-escolhida-em-a-1'
const SENHA_ESCOLHIDA_EM_B = 'senha-sintetica-escolhida-em-b-2'

interface Resposta {
  readonly status: number
  readonly texto: string
  readonly corpo: Record<string, unknown> & { erro?: Record<string, unknown> }
}

describe('acesso-e-convites, 7.0: a posse do e-mail antes de a conta cruzar escolas', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  const cifra = new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, loadChaveDoTokenDeEmail(lerAmbienteDeTeste())]]))
  let api: TestApi
  let hash: PasswordHasher

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } }, linhasDeLog, TEST_APP_OPTIONS)
    hash = api.app.get(PasswordHasher, { strict: false })
    const redis = api.app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false })
    const prazo = performance.now() + 15_000
    while (redis.status !== 'ready') {
      if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
      await new Promise((resolver) => setTimeout(resolver, 20))
    }
  })

  beforeEach(() => {
    linhasDeLog.length = 0
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const ipSorteado = () => `10.${[...randomBytes(3)].join('.')}`

  async function pedir(caminho: string, corpo: unknown): Promise<Resposta> {
    const resposta = await fetch(`${api.url}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipSorteado() }, body: JSON.stringify(corpo) })
    const texto = await resposta.text()
    return { status: resposta.status, texto, corpo: texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo']) }
  }

  const aceitar = (token: string, senha?: string) => pedir('/v1/convites/aceitar', senha === undefined ? { token } : { token, senha })
  const verificar = (token: string) => pedir('/v1/conta/verificar', { token })
  const codigoDe = (resposta: Resposta): unknown => resposta.corpo.erro?.['codigo']

  const unica = <T>(linhas: readonly T[]): T => {
    const [primeira] = linhas
    if (primeira === undefined) throw new Error('a consulta devia devolver uma linha')
    return primeira
  }

  /** Uma conta global: com senha (a regra só vale para quem já a tem) ou sem, verificada ou não. */
  async function conta({ senha = true, verificada = false }: { senha?: boolean; verificada?: boolean } = {}): Promise<{ email: string; contaId: string }> {
    const email = `posse-${randomUUID()}@escola.invalid`
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into conta (email, senha_hash, email_verificado_em) values ($1, $2, ${verificada ? 'now()' : 'null'}) returning id`,
      [email, senha ? await hash.gerar(SENHA_DA_CONTA) : null],
    )
    return { email, contaId: unica(rows).id }
  }

  /** Um usuário da conta na escola: ativo, ou desativado (inativo até o aceite do convite). */
  async function usuarioEm(contaId: string, escolaId: string, { ativo = true, papel = 'professor' }: { ativo?: boolean; papel?: 'professor' | 'coordenador' } = {}): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, $3, 'Pessoa sintética', ${ativo ? 'null' : 'now()'}) returning id`,
      [escolaId, contaId, papel],
    )
    return unica(rows).id
  }

  interface Convite {
    readonly token: string
    readonly conviteId: string
    readonly usuarioId: string
    readonly escolaId: string
  }

  /** O convite de professor da conta na escola, semeado: usuário inativo, convite aberto no canal pedido (o `email` já `enviado`, sem cifrados). */
  async function convite(contaId: string, escolaId: string, canal: 'copiado' | 'email'): Promise<Convite> {
    const usuarioId = await usuarioEm(contaId, escolaId, { ativo: false })
    const token = randomBytes(32).toString('base64url')
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, canal, envio, enviado_em)
       values ($1, $2, 'professor', $3, now() + interval '7 days', $4, ${canal === 'email' ? "'enviado'" : 'null'}, ${canal === 'email' ? 'now()' : 'null'}) returning id`,
      [escolaId, createHash('sha256').update(token).digest('hex'), usuarioId, canal],
    )
    return { token, conviteId: unica(rows).id, usuarioId, escolaId }
  }

  /** O caso do enunciado: a conta com senha, sem a posse provada, ativa numa escola e convidada para outra. */
  async function contaQueCruza(canal: 'copiado' | 'email', verificada = false) {
    const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
    const { email, contaId } = await conta({ verificada })
    const usuarioA = await usuarioEm(contaId, escolaA)
    return { escolaA, escolaB, email, contaId, usuarioA, convite: await convite(contaId, escolaB, canal) }
  }

  const emailVerificadoEm = async (contaId: string): Promise<Date | null> => unica((await bancada.pool.query<{ em: Date | null }>('select email_verificado_em as em from conta where id = $1', [contaId])).rows).em
  const conviteUsado = async (conviteId: string): Promise<boolean> => unica((await bancada.pool.query<{ usado: boolean }>('select usado_em is not null as usado from convite where id = $1', [conviteId])).rows).usado
  const usuarioAtivo = async (usuarioId: string): Promise<boolean> => unica((await bancada.pool.query<{ ativo: boolean }>('select desativado_em is null as ativo from usuario where id = $1', [usuarioId])).rows).ativo
  const senhaDaConta = async (contaId: string): Promise<string | null> => unica((await bancada.pool.query<{ senha_hash: string | null }>('select senha_hash from conta where id = $1', [contaId])).rows).senha_hash

  interface Link {
    readonly id: string
    readonly finalidade: string
    readonly envio: string
    readonly usado: boolean
    readonly cifrados: boolean
    readonly expiraEmSegundos: number
  }

  const linksDe = async (contaId: string): Promise<Link[]> =>
    (
      await bancada.pool.query<{ id: string; finalidade: string; envio: string; usado: boolean; cifrados: boolean; expira_em_s: number }>(
        `select id, finalidade, envio, usado_em is not null as usado, token_cifrado is not null and destino_cifrado is not null as cifrados, extract(epoch from expira_em - now())::int as expira_em_s
           from link_da_conta where conta_id = $1 order by id`,
        [contaId],
      )
    ).rows.map((linha) => ({ id: linha.id, finalidade: linha.finalidade, envio: linha.envio, usado: linha.usado, cifrados: linha.cifrados, expiraEmSegundos: linha.expira_em_s }))

  const abertosDe = async (contaId: string) => (await linksDe(contaId)).filter((link) => !link.usado)

  /** O token do link aberto, como o worker o leria da fila, e o endereço para onde ele iria. */
  async function linkAberto(contaId: string): Promise<{ token: string; destino: string }> {
    const { rows } = await bancada.pool.query<{ id: string; token_cifrado: Buffer; destino_cifrado: Buffer }>('select id, token_cifrado, destino_cifrado from link_da_conta where conta_id = $1 and usado_em is null', [contaId])
    const linha = unica(rows)
    const claro = (cifrado: Buffer) => Buffer.from(cifra.decifrar({ cifrado, versao: VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL }, linha.id)).toString('utf8')
    return { token: claro(linha.token_cifrado), destino: claro(linha.destino_cifrado) }
  }

  const jobsDoLink = async (contaId: string): Promise<Array<{ escola_id: string | null }>> =>
    (
      await bancada.pool.query<{ escola_id: string | null }>(
        `select j.escola_id from job_registro j join link_da_conta l on (j.dados->>'linkId')::uuid = l.id where j.tipo = $1 and l.conta_id = $2`,
        [TIPO_ENVIAR_EMAIL_DA_CONTA, contaId],
      )
    ).rows

  const auditoriaDe = async (escolaId: string, acao: string) =>
    (
      await bancada.pool.query<{ entidade: string; entidade_id: string; autor_usuario_id: string | null; antes: unknown; depois: unknown; finalidade: string | null }>(
        'select entidade, entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = $2', [escolaId, acao],
      )
    ).rows

  describe('o aceite de convite por e-mail prova a posse', () => {
    it('o aceite pelo e-mail grava `emailVerificadoEm` e `conta.email_verificado` só na escola do convite, e a conta da A que aceita por e-mail o convite da B segue sem link', async () => {
      const c = await contaQueCruza('email')
      expect(await emailVerificadoEm(c.contaId)).toBeNull()

      const aceite = await aceitar(c.convite.token)

      expect(aceite.status).toBe(200)
      expect(aceite.corpo).toEqual({ etapa: 'entrar', bilhete: expect.any(String) })
      expect(await emailVerificadoEm(c.contaId)).toBeInstanceOf(Date)
      expect(await conviteUsado(c.convite.conviteId)).toBe(true)
      expect(await linksDe(c.contaId)).toEqual([])
      // O registro sai só na escola do convite, com o usuário do convite como autor e alvo; a A não recebe nada.
      expect(await auditoriaDe(c.escolaB, 'conta.email_verificado')).toEqual([
        { entidade: 'usuario', entidade_id: c.convite.usuarioId, autor_usuario_id: c.convite.usuarioId, antes: null, depois: null, finalidade: null },
      ])
      expect(await auditoriaDe(c.escolaA, 'conta.email_verificado')).toEqual([])
    })

    it('o segundo aceite por e-mail de uma conta já verificada não grava outro registro, e a hora da primeira posse não muda', async () => {
      const c = await contaQueCruza('email')
      await aceitar(c.convite.token)
      const primeira = await emailVerificadoEm(c.contaId)
      const outra = await convite(c.contaId, await bancada.escola(), 'email')

      expect((await aceitar(outra.token)).status).toBe(200)

      expect(await emailVerificadoEm(c.contaId)).toEqual(primeira)
      expect(await auditoriaDe(outra.escolaId, 'conta.email_verificado')).toEqual([])
    })

    it('a conta nova, sem senha, que aceita pelo e-mail define a senha e fica verificada', async () => {
      const escolaId = await bancada.escola()
      const { contaId } = await conta({ senha: false })
      const recebido = await convite(contaId, escolaId, 'email')

      const aceite = await aceitar(recebido.token, SENHA_NOVA)

      expect(aceite.status).toBe(200)
      expect(await senhaDaConta(contaId)).not.toBeNull()
      expect(await emailVerificadoEm(contaId)).toBeInstanceOf(Date)
      expect(await usuarioAtivo(recebido.usuarioId)).toBe(true)
    })

    it('o aceite pelo link copiado não grava a posse: a conta nova aceita sem verificação (não tinha senha) e continua não verificada, sem link e sem registro', async () => {
      const escolaId = await bancada.escola()
      const { contaId } = await conta({ senha: false })
      const outra = await usuarioEm(contaId, await bancada.escola())
      expect(await usuarioAtivo(outra)).toBe(true)
      const copiado = await convite(contaId, escolaId, 'copiado')

      const aceite = await aceitar(copiado.token, SENHA_NOVA)

      expect(aceite.status).toBe(200)
      expect(await senhaDaConta(contaId)).not.toBeNull()
      expect(await emailVerificadoEm(contaId)).toBeNull()
      expect(await linksDe(contaId)).toEqual([])
      expect(await auditoriaDe(escolaId, 'conta.email_verificado')).toEqual([])
    })
  })

  describe('o convite copiado de outra escola', () => {
    it('conta com senha e sem posse: `VERIFICACAO_PENDENTE`, o convite fica valendo, e o link de verificar (24 h, `na_fila`, cifrado, job de sistema sem escola) vai ao e-mail da conta', async () => {
      const c = await contaQueCruza('copiado')
      const senhaAntes = await senhaDaConta(c.contaId)

      const aceite = await aceitar(c.convite.token)

      expect(aceite.status).toBe(409)
      expect(codigoDe(aceite)).toBe(ErrorCode.VERIFICACAO_PENDENTE)
      // Nada do convite mudou: não foi usado, o usuário da B segue inativo e a senha é a mesma.
      expect(await conviteUsado(c.convite.conviteId)).toBe(false)
      expect(await usuarioAtivo(c.convite.usuarioId)).toBe(false)
      expect(await senhaDaConta(c.contaId)).toBe(senhaAntes)
      expect(await emailVerificadoEm(c.contaId)).toBeNull()
      // O link: um aberto, de verificar, 24 h, o envio na fila com os cifrados, e o destino é o e-mail da conta.
      const [link] = await abertosDe(c.contaId)
      expect(link).toMatchObject({ finalidade: 'verificar', envio: 'na_fila', cifrados: true })
      expect(link?.expiraEmSegundos).toBeGreaterThan(24 * 3_600 - 60)
      expect(link?.expiraEmSegundos).toBeLessThanOrEqual(24 * 3_600)
      expect((await linkAberto(c.contaId)).destino).toBe(c.email.toLowerCase())
      // Job de sistema, de escola nula, mesmo nascido no aceite de uma escola.
      expect(await jobsDoLink(c.contaId)).toEqual([{ escola_id: null }])
      // A resposta não traz id, nome nem quantidade da outra escola, nem o token; o log também não.
      for (const proibido of [c.escolaA, c.escolaB, c.usuarioA, c.convite.usuarioId, c.convite.token, c.email, (await linkAberto(c.contaId)).token]) {
        expect(aceite.texto.includes(proibido), proibido).toBe(false)
        expect(linhasDeLog.join('\n').includes(proibido), proibido).toBe(false)
      }
    })

    it('o mesmo convite do painel da operação (a coordenação que o operador gera): `VERIFICACAO_PENDENTE`, sem usar o convite', async () => {
      const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
      const { email, contaId } = await conta()
      await usuarioEm(contaId, escolaA)
      const { conviteId, token } = await criarConviteDeCoordenador(bancada.banco, autorDaBancada, { escolaId: escolaB, email, nome: 'Coordenação Sintética Convidada' })

      const aceite = await aceitar(token)

      expect(aceite.status).toBe(409)
      expect(codigoDe(aceite)).toBe(ErrorCode.VERIFICACAO_PENDENTE)
      expect(await conviteUsado(conviteId)).toBe(false)
      expect(await abertosDe(contaId)).toEqual([expect.objectContaining({ finalidade: 'verificar', envio: 'na_fila' })])
    })

    it('depois de verificar, o aceite segue: o mesmo convite vale, o link é de uso único, e o verificar de novo é link inválido', async () => {
      const c = await contaQueCruza('copiado')
      expect((await aceitar(c.convite.token)).status).toBe(409)
      const { token } = await linkAberto(c.contaId)

      const verificado = await verificar(token)

      expect(verificado.status).toBe(204)
      expect(verificado.texto).toBe('')
      expect(await emailVerificadoEm(c.contaId)).toBeInstanceOf(Date)
      const aceite = await aceitar(c.convite.token)
      expect(aceite.status).toBe(200)
      expect(aceite.corpo).toEqual({ etapa: 'entrar', bilhete: expect.any(String) })
      expect(await conviteUsado(c.convite.conviteId)).toBe(true)
      expect(await abertosDe(c.contaId)).toEqual([])
      const repetido = await verificar(token)
      expect(repetido.status).toBe(404)
      expect(codigoDe(repetido)).toBe(ErrorCode.NAO_ENCONTRADO)
    })

    it('o professor desativado na A com o convite copiado da B já emitido (conta com senha, sem posse): recebe o link, o verificar o aceita sem registro de auditoria (não há usuário ativo), e o aceite segue', async () => {
      const c = await contaQueCruza('copiado')
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [c.usuarioA])

      const pendente = await aceitar(c.convite.token)
      expect(pendente.status).toBe(409)
      expect(codigoDe(pendente)).toBe(ErrorCode.VERIFICACAO_PENDENTE)
      const { token } = await linkAberto(c.contaId)
      expect((await verificar(token)).status).toBe(204)

      expect(await emailVerificadoEm(c.contaId)).toBeInstanceOf(Date)
      for (const escolaId of [c.escolaA, c.escolaB]) expect(await auditoriaDe(escolaId, 'conta.email_verificado'), escolaId).toEqual([])
      expect((await aceitar(c.convite.token)).status).toBe(200)
    })

    it('a conta que já tinha a posse provada aceita o copiado de outra escola sem o link', async () => {
      const c = await contaQueCruza('copiado', true)

      expect((await aceitar(c.convite.token)).status).toBe(200)
      expect(await linksDe(c.contaId)).toEqual([])
    })

    it('a conta com senha que só tem usuário na própria escola (sem outra escola) aceita o copiado sem verificação: não há o que cruzar', async () => {
      const escolaId = await bancada.escola()
      const { contaId } = await conta()
      const copiado = await convite(contaId, escolaId, 'copiado')

      expect((await aceitar(copiado.token)).status).toBe(200)
      expect(await linksDe(contaId)).toEqual([])
    })

    it('a senha definida pelo link de uma escola não abre o convite de outra: a conta nova convidada por A e por B aceita A e fica pendente em B, com o convite de B intacto', async () => {
      const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
      const { contaId } = await conta({ senha: false })
      const deA = await convite(contaId, escolaA, 'copiado')
      const deB = await convite(contaId, escolaB, 'copiado')

      expect((await aceitar(deA.token, SENHA_NOVA)).status).toBe(200)
      const emB = await aceitar(deB.token)

      expect(emB.status).toBe(409)
      expect(codigoDe(emB)).toBe(ErrorCode.VERIFICACAO_PENDENTE)
      expect(await conviteUsado(deB.conviteId)).toBe(false)
      expect(await usuarioAtivo(deB.usuarioId)).toBe(false)
      expect(await abertosDe(contaId)).toEqual([expect.objectContaining({ finalidade: 'verificar' })])
    })

    it('os dois aceites da conta nova convidada por A e por B: o da B lê o convite e para dentro da transação, o da A define a senha, e o da B, que perdeu a corrida, desfaz tudo e responde `VERIFICACAO_PENDENTE`', async () => {
      const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
      const { contaId } = await conta({ senha: false })
      const deA = await convite(contaId, escolaA, 'copiado')
      const deB = await convite(contaId, escolaB, 'copiado')
      // A ordem é forçada: a B já leu o convite (a conta sem senha não pede verificação) e usou o convite dentro da transação quando a A define a senha e confirma.
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'convite', evento: 'update', quando: `new.id = '${deB.conviteId}'::uuid and new.usado_em is not null` })
      await parada.armar()
      try {
        const daB = aceitar(deB.token, SENHA_ESCOLHIDA_EM_B)
        await parada.esperarParadas(1)
        const daA = await aceitar(deA.token, SENHA_ESCOLHIDA_EM_A)
        expect(daA.status).toBe(200)
        await parada.soltar()
        const respostaDaB = await daB

        expect(respostaDaB.status).toBe(409)
        expect(codigoDe(respostaDaB)).toBe(ErrorCode.VERIFICACAO_PENDENTE)
        expect(await conviteUsado(deA.conviteId)).toBe(true)
        expect(await conviteUsado(deB.conviteId)).toBe(false)
        expect(await usuarioAtivo(deB.usuarioId)).toBe(false)
        expect(await abertosDe(contaId)).toEqual([expect.objectContaining({ finalidade: 'verificar', envio: 'na_fila' })])
      } finally {
        await parada.desarmar()
      }
    })

    it('o quarto aceite na hora: `VERIFICACAO_PENDENTE` e três envios, cada link novo invalida o anterior (o ainda `na_fila` vira `cancelado`, sem cifrados), e o quarto não manda nada', async () => {
      const c = await contaQueCruza('copiado')
      const tokens: string[] = []
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        const aceite = await aceitar(c.convite.token)
        expect(aceite.status, `aceite ${String(tentativa + 1)}`).toBe(409)
        expect(codigoDe(aceite)).toBe(ErrorCode.VERIFICACAO_PENDENTE)
        tokens.push((await linkAberto(c.contaId)).token)
      }

      // Três envios: o quarto não gravou link nem job, e o link aberto segue sendo o terceiro.
      expect(await jobsDoLink(c.contaId)).toHaveLength(3)
      expect(new Set(tokens).size).toBe(3)
      expect(tokens[3]).toBe(tokens[2])
      const links = await linksDe(c.contaId)
      expect(links.map((link) => [link.usado, link.envio, link.cifrados])).toEqual([
        [true, 'cancelado', false],
        [true, 'cancelado', false],
        [false, 'na_fila', true],
      ])
      // Cada link novo invalida o anterior: o primeiro e o segundo são link inválido; o terceiro serve.
      expect((await verificar(tokens[0] ?? '')).status).toBe(404)
      expect((await verificar(tokens[1] ?? '')).status).toBe(404)
      expect((await verificar(tokens[2] ?? '')).status).toBe(204)
    })

    it('com o Redis de fila fora, o teto de 3 por hora cai para o seguro em memória e divide pelas instâncias (3 ÷ 4 = 1): o segundo aceite da hora já não abre link, e nenhum responde 500', async () => {
      const c = await contaQueCruza('copiado')
      // A aplicação montada como no contêiner: 4 instâncias dividem o limite, e o Redis de fila responde em 100 ms (ou nem responde).
      const instancia = await subirApi(medidor.medidor, { ambiente: { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1', LIMITE_INSTANCIAS_API: '4' }, login: { prazoDoRedisMs: 100 } }, undefined, TEST_APP_OPTIONS)
      try {
        const redis = instancia.app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false })
        const prazo = performance.now() + 15_000
        while (redis.status !== 'ready') {
          if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
          await new Promise((resolver) => setTimeout(resolver, 20))
        }
        const travado = await travarRedis(testConfig().redisFilaUrl, 15_000)
        let voltou = false
        void travado.fim.then(() => {
          voltou = true
        })
        const respostas = []
        for (let pedido = 0; pedido < 3; pedido++) {
          respostas.push(await fetch(`${instancia.url}/v1/convites/aceitar`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipSorteado() }, body: JSON.stringify({ token: c.convite.token }) }))
        }
        expect(voltou, 'o Redis voltou antes do terceiro pedido: a máquina está lenta demais para este caso').toBe(false)
        await travado.fim
        expect(respostas.map((resposta) => resposta.status)).toEqual([409, 409, 409])
        // Só o primeiro passou do seguro (limite 1 na instância); com o limite cheio (3) os três teriam aberto link, cada um cancelando o anterior.
        expect(await linksDe(c.contaId)).toHaveLength(1)
        expect(await conviteUsado(c.convite.conviteId)).toBe(false)
      } finally {
        await instancia.app.close()
      }
    }, 60_000)

    it('o teto de 3 por hora é por conta: outra conta, no mesmo minuto, ainda recebe o link', async () => {
      const cheia = await contaQueCruza('copiado')
      for (let tentativa = 0; tentativa < 4; tentativa++) await aceitar(cheia.convite.token)
      expect(await jobsDoLink(cheia.contaId)).toHaveLength(3)

      const outra = await contaQueCruza('copiado')
      expect((await aceitar(outra.convite.token)).status).toBe(409)

      expect(await jobsDoLink(outra.contaId)).toHaveLength(1)
    })

    it('o link antigo semeado em `enviando`, preso na barreira do envio, vira `cancelado` quando o aceite pede o link novo, e o token antigo é recusado em `/conta/verificar`', async () => {
      const c = await contaQueCruza('copiado')
      const antigo = randomBytes(32).toString('base64url')
      const { rows } = await bancada.pool.query<{ id: string }>(
        `insert into link_da_conta (conta_id, finalidade, token_hash, token_cifrado, destino_cifrado, expira_em, envio, envio_reservado_em)
         values ($1, 'verificar', $2, '\\x01', '\\x01', now() + interval '1 hour', 'enviando', now()) returning id`,
        [c.contaId, createHash('sha256').update(antigo).digest('hex')],
      )
      const antigoId = unica(rows).id

      expect((await aceitar(c.convite.token)).status).toBe(409)

      const links = await linksDe(c.contaId)
      expect(links).toHaveLength(2)
      expect(links).toContainEqual(expect.objectContaining({ id: antigoId, usado: true, envio: 'cancelado', cifrados: false }))
      expect(links).toContainEqual(expect.objectContaining({ usado: false, envio: 'na_fila', cifrados: true }))
      // O envio que estava preso na barreira acorda e tenta gravar `enviado` com a reserva dele: a condição do worker não casa mais com a linha.
      const gravou = await bancada.pool.query(
        "update link_da_conta set envio = 'enviado', token_cifrado = null, destino_cifrado = null, envio_reservado_em = null where id = $1 and envio = 'enviando'", [antigoId],
      )
      expect(gravou.rowCount).toBe(0)
      const recusado = await verificar(antigo)
      expect(recusado.status).toBe(404)
      expect(await emailVerificadoEm(c.contaId)).toBeNull()
    })

    it('[P] dois aceites que pedem verificação, o primeiro preso no insert do link: os dois respondem `VERIFICACAO_PENDENTE` (nunca 500), há um link aberto só, e nada da outra escola aparece', async () => {
      const c = await contaQueCruza('copiado')
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'link_da_conta', evento: 'insert', quando: `new.conta_id = '${c.contaId}'::uuid` })
      await parada.armar()
      try {
        const primeiro = aceitar(c.convite.token)
        await parada.esperarParadas(1)
        // O segundo chega ao insert do mesmo link aberto (conta, finalidade) e espera a linha do primeiro, que ainda não confirmou.
        const segundo = aceitar(c.convite.token)
        await new Promise((resolver) => setTimeout(resolver, 300))
        await parada.soltar()
        const respostas = await Promise.all([primeiro, segundo])

        for (const resposta of respostas) {
          expect(resposta.status).toBe(409)
          expect(codigoDe(resposta)).toBe(ErrorCode.VERIFICACAO_PENDENTE)
          for (const proibido of [c.escolaA, c.escolaB, c.usuarioA, c.convite.usuarioId]) expect(resposta.texto.includes(proibido), proibido).toBe(false)
        }
        expect(await abertosDe(c.contaId)).toHaveLength(1)
        expect(await jobsDoLink(c.contaId)).toHaveLength(1)
        expect(await conviteUsado(c.convite.conviteId)).toBe(false)
      } finally {
        await parada.desarmar()
      }
    })
  })

  describe('o verificar', () => {
    it('o token vai no corpo, nunca na query: a API só o lê do corpo (na query ou com chave a mais é entrada inválida, e a resposta sai com `no-store`)', async () => {
      const c = await contaQueCruza('copiado')
      await aceitar(c.convite.token)
      const { token } = await linkAberto(c.contaId)

      const naQuery = await fetch(`${api.url}/v1/conta/verificar?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      expect(naQuery.status).toBe(400)
      const comChaveAMais = await pedir('/v1/conta/verificar', { token, escolaId: c.escolaA })
      expect(comChaveAMais.status).toBe(400)
      expect(await emailVerificadoEm(c.contaId)).toBeNull()
      expect(await abertosDe(c.contaId)).toHaveLength(1)
      const noCorpo = await fetch(`${api.url}/v1/conta/verificar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      expect(noCorpo.status).toBe(204)
      expect(noCorpo.headers.get('cache-control')).toBe('no-store')
    })

    it('o token vencido, o de redefinir e o inexistente dão a mesma resposta de link inválido, e nada é gravado', async () => {
      const c = await contaQueCruza('copiado')
      await aceitar(c.convite.token)
      const { token } = await linkAberto(c.contaId)
      // O de outra finalidade: um link de redefinir aberto da mesma conta não verifica.
      const deRedefinir = randomBytes(32).toString('base64url')
      await bancada.pool.query(
        "insert into link_da_conta (conta_id, finalidade, token_hash, token_cifrado, destino_cifrado, expira_em, envio) values ($1, 'redefinir', $2, '\\x01', '\\x01', now() + interval '1 hour', 'na_fila')",
        [c.contaId, createHash('sha256').update(deRedefinir).digest('hex')],
      )
      await bancada.pool.query("update link_da_conta set expira_em = now() - interval '1 second' where conta_id = $1 and finalidade = 'verificar'", [c.contaId])

      const respostas = await Promise.all([verificar(token), verificar(deRedefinir), verificar(randomBytes(32).toString('base64url'))])

      for (const resposta of respostas) {
        expect(resposta.status).toBe(404)
        expect(codigoDe(resposta)).toBe(ErrorCode.NAO_ENCONTRADO)
      }
      expect(await emailVerificadoEm(c.contaId)).toBeNull()
    })

    it('`conta.email_verificado` pelo verificar: um por escola em que a conta tem usuário ativo (A e B), com autor e alvo o usuário dela, e nenhum em escola de outra conta', async () => {
      const [escolaA, escolaB, escolaC] = [await bancada.escola(), await bancada.escola(), await bancada.escola()]
      const { contaId } = await conta()
      const [usuarioA, usuarioB] = [await usuarioEm(contaId, escolaA), await usuarioEm(contaId, escolaB)]
      await pedirLinkDeVerificar(contaId, escolaC)
      const { token } = await linkAberto(contaId)

      expect((await verificar(token)).status).toBe(204)

      expect(await auditoriaDe(escolaA, 'conta.email_verificado')).toEqual([{ entidade: 'usuario', entidade_id: usuarioA, autor_usuario_id: usuarioA, antes: null, depois: null, finalidade: null }])
      expect(await auditoriaDe(escolaB, 'conta.email_verificado')).toEqual([{ entidade: 'usuario', entidade_id: usuarioB, autor_usuario_id: usuarioB, antes: null, depois: null, finalidade: null }])
      expect(await auditoriaDe(escolaC, 'conta.email_verificado')).toEqual([])
    })

    it('com o usuário da B desativado, o registro sai só na A', async () => {
      const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
      const { contaId } = await conta()
      await usuarioEm(contaId, escolaA)
      await usuarioEm(contaId, escolaB, { ativo: false })
      await pedirLinkDeVerificar(contaId, escolaA)
      const { token } = await linkAberto(contaId)

      expect((await verificar(token)).status).toBe(204)

      expect(await auditoriaDe(escolaA, 'conta.email_verificado')).toHaveLength(1)
      expect(await auditoriaDe(escolaB, 'conta.email_verificado')).toEqual([])
    })

    it('o usuário desativado entre o link e o verificar, sem convite válido à espera: link inválido, sem registro e sem posse gravada', async () => {
      const escolaId = await bancada.escola()
      const { contaId } = await conta()
      const usuarioId = await usuarioEm(contaId, escolaId)
      const pendente = await pedirLinkDeVerificar(contaId, escolaId)
      const { token } = await linkAberto(contaId)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [usuarioId])
      await bancada.pool.query('update convite set revogado_em = now() where id = $1', [pendente.conviteId])

      const resposta = await verificar(token)

      expect(resposta.status).toBe(404)
      expect(codigoDe(resposta)).toBe(ErrorCode.NAO_ENCONTRADO)
      expect(await emailVerificadoEm(contaId)).toBeNull()
      expect(await auditoriaDe(escolaId, 'conta.email_verificado')).toEqual([])
    })

    it('o usuário desativado e o convite revogado depois da leitura do link, com o verificar já dentro da transação e o link gasto: a conta travada decide, a resposta é a de link inválido e a transação inteira se desfaz', async () => {
      const escolaId = await bancada.escola()
      const { contaId } = await conta()
      const usuarioId = await usuarioEm(contaId, escolaId)
      const pendente = await pedirLinkDeVerificar(contaId, escolaId)
      const { token } = await linkAberto(contaId)
      // O verificar leu o link como válido, travou a conta e gastou o link; parado aí, a desativação chega, e só então ele lê os usuários ativos.
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'link_da_conta', evento: 'update', quando: `new.conta_id = '${contaId}'::uuid and new.finalidade = 'verificar' and new.usado_em is not null` })
      await parada.armar()
      try {
        const resposta = verificar(token)
        await parada.esperarParadas(1)
        await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [usuarioId])
        await bancada.pool.query('update convite set revogado_em = now() where id = $1', [pendente.conviteId])
        await parada.soltar()
        const final = await resposta

        expect(final.status).toBe(404)
        expect(codigoDe(final)).toBe(ErrorCode.NAO_ENCONTRADO)
        expect(await emailVerificadoEm(contaId)).toBeNull()
        expect(await auditoriaDe(escolaId, 'conta.email_verificado')).toEqual([])
        // O link não foi gasto: a transação foi desfeita inteira.
        expect(await abertosDe(contaId)).toHaveLength(1)
      } finally {
        await parada.desarmar()
      }
    })

    it('dois verificar com o mesmo token: o primeiro gasta o link e para, o segundo lê o link ainda válido e espera a conta travada; solto o primeiro, um só confirma, um registro só', async () => {
      const escolaId = await bancada.escola()
      const { contaId } = await conta()
      await usuarioEm(contaId, escolaId)
      await pedirLinkDeVerificar(contaId, escolaId)
      const { token } = await linkAberto(contaId)
      // A ordem é forçada: os dois leem o link como válido antes de qualquer confirmação, e o segundo espera a conta que o primeiro segura.
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'link_da_conta', evento: 'update', quando: `new.conta_id = '${contaId}'::uuid and new.finalidade = 'verificar' and new.usado_em is not null` })
      await parada.armar()
      try {
        const primeiro = verificar(token)
        await parada.esperarParadas(1)
        const segundo = verificar(token)
        await esperarNaTrava(bancada.pool, '%for update%')
        await parada.soltar()
        const respostas = await Promise.all([primeiro, segundo])

        expect(respostas.map((resposta) => resposta.status)).toEqual([204, 404])
        expect(await auditoriaDe(escolaId, 'conta.email_verificado')).toHaveLength(1)
      } finally {
        await parada.desarmar()
      }
    })

    it('a conta já verificada que abre um link de verificar: o link é gasto, a hora da primeira posse fica e nenhum registro novo sai', async () => {
      const escolaId = await bancada.escola()
      const { contaId } = await conta()
      await usuarioEm(contaId, escolaId)
      await pedirLinkDeVerificar(contaId, escolaId)
      const { token } = await linkAberto(contaId)
      // A posse chega por outro caminho (o "esqueci", por exemplo) enquanto o link de verificar espera: o link ainda se gasta.
      await bancada.pool.query("update conta set email_verificado_em = now() - interval '1 day' where id = $1", [contaId])
      const antes = await emailVerificadoEm(contaId)

      expect((await verificar(token)).status).toBe(204)

      expect(await emailVerificadoEm(contaId)).toEqual(antes)
      expect(await auditoriaDe(escolaId, 'conta.email_verificado')).toEqual([])
      expect(await abertosDe(contaId)).toEqual([])
    })

    it('[P] o link antigo preso na barreira do envio e o aceite parado depois de cancelá-lo: o `verificar` do antigo espera a conta, e quando o aceite confirma o antigo é `cancelado` e recusado', async () => {
      const c = await contaQueCruza('copiado')
      const antigo = randomBytes(32).toString('base64url')
      await bancada.pool.query(
        `insert into link_da_conta (conta_id, finalidade, token_hash, token_cifrado, destino_cifrado, expira_em, envio, envio_reservado_em)
         values ($1, 'verificar', $2, '\\x01', '\\x01', now() + interval '1 hour', 'enviando', now())`,
        [c.contaId, createHash('sha256').update(antigo).digest('hex')],
      )
      // O aceite já cancelou o antigo (e segura a linha dele) e ainda não inseriu o novo: parado logo depois do cancelamento, antes da checagem da chave da conta no insert. É esse
      // ponto que separa a conta tomada primeiro (o `verificar` espera) da conta tomada só no insert (o `verificar` trava a conta, espera a linha do antigo, e o insert espera a conta: 40P01).
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'link_da_conta', evento: 'update', quando: `new.conta_id = '${c.contaId}'::uuid and new.envio = 'cancelado'` })
      await parada.armar()
      try {
        const aceite = aceitar(c.convite.token)
        await parada.esperarParadas(1)
        const tentativa = verificar(antigo)
        // O `verificar` leu o antigo como válido e espera a conta, que o aceite segura: não responde enquanto o aceite não confirma.
        const adiantou = await Promise.race([tentativa.then(() => true), new Promise<boolean>((resolver) => setTimeout(() => resolver(false), 400))])
        expect(adiantou).toBe(false)
        await parada.soltar()
        const [respostaDoAceite, respostaDoAntigo] = await Promise.all([aceite, tentativa])

        expect(respostaDoAceite.status).toBe(409)
        expect(codigoDe(respostaDoAceite)).toBe(ErrorCode.VERIFICACAO_PENDENTE)
        expect(respostaDoAntigo.status).toBe(404)
        expect(await emailVerificadoEm(c.contaId)).toBeNull()
        // O id é v7 e não dá a ordem de negócio: o par se confere pelo estado de cada um.
        const links = await linksDe(c.contaId)
        expect(links).toHaveLength(2)
        expect(links).toContainEqual(expect.objectContaining({ usado: true, envio: 'cancelado', cifrados: false }))
        expect(links).toContainEqual(expect.objectContaining({ usado: false, envio: 'na_fila', cifrados: true }))
      } finally {
        await parada.desarmar()
      }
    })
  })

  describe('o "esqueci a senha" também prova a posse', () => {
    it('redefinir pelo link do "esqueci" grava `emailVerificadoEm` e `conta.email_verificado` em cada escola da conta', async () => {
      const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
      const { email, contaId } = await conta()
      const [usuarioA, usuarioB] = [await usuarioEm(contaId, escolaA), await usuarioEm(contaId, escolaB)]
      expect(await emailVerificadoEm(contaId)).toBeNull()
      expect((await pedir('/v1/senha/esqueci', { email })).status).toBe(202)
      const { token } = await linkAberto(contaId)

      const resposta = await pedir('/v1/senha/redefinir', { token, senha: SENHA_NOVA })

      expect(resposta.status).toBe(204)
      expect(await emailVerificadoEm(contaId)).toBeInstanceOf(Date)
      expect((await auditoriaDe(escolaA, 'conta.email_verificado')).map((registro) => registro.entidade_id)).toEqual([usuarioA])
      expect((await auditoriaDe(escolaB, 'conta.email_verificado')).map((registro) => registro.entidade_id)).toEqual([usuarioB])
    })

    it('depois de redefinir, a conta que cruza escolas aceita o convite copiado sem o link de verificar', async () => {
      const c = await contaQueCruza('copiado')
      expect((await pedir('/v1/senha/esqueci', { email: c.email })).status).toBe(202)
      const { token } = await linkAberto(c.contaId)
      expect((await pedir('/v1/senha/redefinir', { token, senha: SENHA_NOVA })).status).toBe(204)

      expect((await aceitar(c.convite.token)).status).toBe(200)
      expect(await linksDe(c.contaId)).toEqual([expect.objectContaining({ finalidade: 'redefinir', usado: true })])
    })
  })

  /** O link de verificar da conta, pelo mesmo pedido do aceite: um convite copiado de uma escola em que ela não tem usuário (a `escolaPeloConvite`). */
  async function pedirLinkDeVerificar(contaId: string, escolaDaConta: string): Promise<Convite> {
    const outra = await bancada.escola()
    const pendente = await convite(contaId, outra, 'copiado')
    // A conta tem usuário em `escolaDaConta` (cruza escolas) e não verificou: o aceite pede o link.
    expect(escolaDaConta).not.toBe(outra)
    expect((await aceitar(pendente.token)).status).toBe(409)
    return pendente
  }
})
