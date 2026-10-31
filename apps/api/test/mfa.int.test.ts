import 'reflect-metadata'
import { createLogger, TokenIssuer } from '@educa/core'
import { ErrorCode, type PapelDeUsuario } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { Redis } from 'ioredis'
import { randomBytes, randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { Secret, TOTP } from 'otpauth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { aguardarSaudavel, composeOuFalha } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { AppModule } from '../src/app.module.js'
import { configureApp } from '../src/configure-app.js'
import { executarOpsRedefinirMfa } from '../src/ops/redefinir-mfa.js'
import { SecretCipher, REDIS_LOGIN_CLIENT, ChallengeIssuer, gerarCodigosDeRecuperacao, gerarSegredo, PasswordHasher, hmacDaRecuperacao } from '../src/credencial/index.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './test-config.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

const SENHA = 'senha-sintetica-correta-1'
const PERIODO_MS = 30_000

interface Resposta {
  status: number
  corpo: Record<string, unknown> & { erro?: { codigo?: string } }
  retryAfter: string | null
  cacheControl: string | null
  setCookie: string[]
}

interface Pessoa {
  email: string
  contaId: string
  usuarioId: string
  escolaId: string
}

interface MfaAtivo {
  base32: string
  codigosRecuperacao: string[]
}

async function clientePronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 15_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

/** O passo do TOTP de agora, pelo relógio da máquina (o mesmo da API no teste). */
const passoAtual = () => Math.floor(Date.now() / PERIODO_MS)

function codigoDoPasso(base32: string, passo: number): string {
  return TOTP.generate({ secret: Secret.fromBase32(base32), algorithm: 'SHA1', digits: 6, period: 30, timestamp: passo * PERIODO_MS })
}

describe('MFA do coordenador: configurar, ativar, entrar com o código e redefinir', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const configuracao = configuracaoDeTeste()
  const emissorDeDesafio = new ChallengeIssuer(configuracao.identidade.chaveAssinatura)
  const cifra = new SecretCipher(configuracao.login.mfa.versaoCifra, configuracao.login.mfa.chavesCifra)
  const linhasDeLog: string[] = []
  /** Tudo que foi mandado ou recebido e não pode aparecer no log: e-mails, segredos, URIs, códigos, desafios e cookies. */
  const segredosVistos = new Set<string>([SENHA])
  let app: INestApplication
  let url: string
  let hash: PasswordHasher
  let cliente: Redis

  beforeAll(async () => {
    app = await NestFactory.create(AppModule.forRoot(configuracao, { medidor: medidor.medidor, ...MONTAGEM_DE_TESTE }), { logger: false })
    configureApp(app, createLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => linhasDeLog.push(linha) } }), medidor.medidor)
    await app.listen(0, '127.0.0.1')
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
    hash = app.get(PasswordHasher)
    cliente = app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false })
    await clientePronto(cliente)
  })

  afterAll(async () => {
    await app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Uma conta com senha e um usuário ativo na escola, com o papel pedido. */
  async function pessoa(escolaId: string, papel: PapelDeUsuario = 'coordenador'): Promise<Pessoa> {
    const email = `coordenacao-${randomUUID()}@escola.invalid`
    segredosVistos.add(email)
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, await hash.gerar(SENHA)])
    const contaId = contas[0]?.id ?? ''
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
    return { email, contaId, usuarioId: usuarios[0]?.id ?? '', escolaId }
  }

  /** O mesmo usuário da conta em outra escola: a coordenadora que trabalha em duas. */
  async function naOutraEscola(quem: Pessoa, escolaId: string, papel: PapelDeUsuario = 'coordenador'): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, quem.contaId, papel])
    return rows[0]?.id ?? ''
  }

  /** Liga o MFA direto no banco, com a cifra de produção, e os dez códigos de recuperação: é o estado depois do `ativar`. */
  async function comMfaAtivo(quem: Pessoa): Promise<MfaAtivo> {
    const novo = gerarSegredo()
    segredosVistos.add(novo.base32).add(novo.uri)
    const { cifrado, versao } = cifra.cifrar(novo.bytes, quem.contaId)
    await bancada.pool.query('update conta set mfa_segredo_cifrado = $1, mfa_chave_versao = $2, mfa_ativado_em = now(), mfa_ultimo_passo = null where id = $3', [cifrado, versao, quem.contaId])
    const codigosRecuperacao = gerarCodigosDeRecuperacao()
    for (const codigo of codigosRecuperacao) {
      segredosVistos.add(codigo)
      await bancada.pool.query('insert into codigo_recuperacao (conta_id, hmac) values ($1, $2)', [quem.contaId, hmacDaRecuperacao(configuracao.login.mfa.chaveRecuperacao, codigo)])
    }
    return { base32: novo.base32, codigosRecuperacao }
  }

  function valorDoCookie(linha: string): string {
    return linha.split(';')[0]?.split('=').slice(1).join('=') ?? ''
  }

  async function lerResposta(resposta: Response): Promise<Resposta> {
    const texto = await resposta.text()
    const setCookie = resposta.headers.getSetCookie()
    for (const linha of setCookie) segredosVistos.add(valorDoCookie(linha))
    const corpo = texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo'])
    for (const campo of ['desafio', 'token', 'segredo', 'uri'] as const) if (typeof corpo[campo] === 'string') segredosVistos.add(corpo[campo])
    if (Array.isArray(corpo['codigosRecuperacao'])) for (const codigo of corpo['codigosRecuperacao'] as string[]) segredosVistos.add(codigo)
    return { status: resposta.status, corpo, retryAfter: resposta.headers.get('retry-after'), cacheControl: resposta.headers.get('cache-control'), setCookie }
  }

  async function entrar(email: string, cookie?: string): Promise<Resposta> {
    return lerResposta(
      await fetch(`${url}/v1/sessao/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie === undefined ? {} : { Cookie: cookie }) },
        body: JSON.stringify({ email, senha: SENHA }),
      }),
    )
  }

  /** Um POST com o desafio (ou qualquer token) no `Authorization`, como a web faz nas etapas. */
  async function comDesafio(caminho: string, desafio: string, corpo?: unknown, cookie?: string): Promise<Resposta> {
    // O código de recuperação digitado vai para a conferência do log. O do app, não: seis dígitos quaisquer aparecem por
    // acaso num número do log, e quem o protege é o redact de `*.codigo` (logger.test.ts).
    if (typeof corpo === 'object' && corpo !== null && 'recuperacao' in corpo && typeof corpo.recuperacao === 'string') segredosVistos.add(corpo.recuperacao)
    return lerResposta(
      await fetch(`${url}${caminho}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${desafio}`, 'Content-Type': 'application/json', ...(cookie === undefined ? {} : { Cookie: cookie }) },
        body: JSON.stringify(corpo ?? {}),
      }),
    )
  }

  /** O desafio da etapa pelo login de verdade. */
  async function desafioDoLogin(quem: Pessoa, etapa: 'configurar_mfa' | 'mfa', cookie?: string): Promise<string> {
    const resposta = await entrar(quem.email, cookie)
    expect(resposta.corpo['etapa']).toBe(etapa)
    return String(resposta.corpo['desafio'])
  }

  function esperarNaoAutenticado(resposta: Resposta): void {
    expect(resposta.status).toBe(401)
    expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(resposta.setCookie).toEqual([])
  }

  function esperarSegurada(resposta: Resposta): void {
    expect(resposta.status).toBe(429)
    expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.CONTA_SEGURADA)
    expect(Number(resposta.retryAfter)).toBeGreaterThan(0)
    expect(Number(resposta.retryAfter)).toBeLessThanOrEqual(30)
    expect(resposta.setCookie).toEqual([])
  }

  async function sessoesDaConta(contaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: string }>('select count(*) as total from sessao where conta_id = $1', [contaId])
    return Number(rows[0]?.total)
  }

  async function mfaNoBanco(contaId: string): Promise<{ ativo: boolean; segredo: Buffer | null; passo: string | null; codigos: number }> {
    const { rows } = await bancada.pool.query<{ ativo: boolean; segredo: Buffer | null; passo: string | null; codigos: string }>(
      'select mfa_ativado_em is not null as ativo, mfa_segredo_cifrado as segredo, mfa_ultimo_passo as passo, (select count(*) from codigo_recuperacao c where c.conta_id = conta.id) as codigos from conta where id = $1',
      [contaId],
    )
    const [linha] = rows
    if (linha === undefined) throw new Error('conta não encontrada')
    return { ativo: linha.ativo, segredo: linha.segredo, passo: linha.passo, codigos: Number(linha.codigos) }
  }

  /**
   * Uma sessão de e-mail aberta do usuário da conta, como o login a deixa, e o token dela: é a sessão no aparelho que se
   * perdeu. Devolve o id e o token.
   */
  async function sessaoAberta(contaId: string, escolaId: string, usuarioId: string): Promise<{ sessaoId: string; token: string }> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      "insert into sessao (escola_id, conta_id, usuario_id, metodo, familia, refresh_hash, expira_em) values ($1, $2, $3, 'email', uuidv7(), $4, now() + interval '12 hours') returning id",
      [escolaId, contaId, usuarioId, randomBytes(32).toString('hex')],
    )
    const sessaoId = rows[0]?.id ?? ''
    const { token } = await new TokenIssuer(configuracao.identidade.chaveAssinatura).emitir({ escolaId, usuarioId, sessaoId })
    return { sessaoId, token }
  }

  /** A situação da sessão no banco: se foi encerrada, e com que motivo. */
  async function situacaoDaSessao(sessaoId: string): Promise<{ encerrada: boolean; motivo: string | null }> {
    const { rows } = await bancada.pool.query<{ encerrada: boolean; motivo: string | null }>('select encerrada_em is not null as encerrada, motivo from sessao where id = $1', [sessaoId])
    const [linha] = rows
    if (linha === undefined) throw new Error('sessão não encontrada')
    return linha
  }

  async function obterEu(token: string): Promise<number> {
    return (await fetch(`${url}/v1/eu`, { headers: { Authorization: `Bearer ${token}` } })).status
  }

  async function auditoriaDeMfa(escolaId: string): Promise<Array<Record<string, unknown>>> {
    const { rows } = await bancada.pool.query(
      "select acao, entidade, entidade_id, autor_usuario_id, autor_operador, antes, depois, finalidade from auditoria where escola_id = $1 and acao like 'usuario.mfa%' order by em, id",
      [escolaId],
    )
    return rows
  }

  it('caminho feliz (RF12): o coordenador configura, ativa com o código, entra de novo e só chega a pronta depois do código, que grava educa_dispositivo', async () => {
    const coordenador = await pessoa(await bancada.escola())
    const desafio = await desafioDoLogin(coordenador, 'configurar_mfa')

    const configurado = await comDesafio('/v1/conta/mfa/configurar', desafio)
    expect(configurado.status).toBe(200)
    expect(configurado.cacheControl).toBe('no-store')
    expect(configurado.setCookie).toEqual([])
    expect(configurado.corpo).toEqual({ uri: expect.stringMatching(/^otpauth:\/\/totp\//), segredo: expect.stringMatching(/^[A-Z2-7]{32}$/) })
    const segredo = String(configurado.corpo['segredo'])
    // O segredo sai também em texto, para colar no gerenciador de senhas do computador, e é o mesmo da URI.
    expect(new URL(String(configurado.corpo['uri'])).searchParams.get('secret')).toBe(segredo)
    const gravado = await mfaNoBanco(coordenador.contaId)
    expect(gravado).toMatchObject({ ativo: false, passo: null, codigos: 0 })
    expect(gravado.segredo?.includes(Buffer.from(Secret.fromBase32(segredo).bytes))).toBe(false)
    expect(gravado.segredo?.toString('latin1')).not.toContain(segredo)

    const passo = passoAtual()
    const ativado = await comDesafio('/v1/conta/mfa/ativar', desafio, { codigo: codigoDoPasso(segredo, passo) })
    expect(ativado.status).toBe(200)
    expect(ativado.cacheControl).toBe('no-store')
    expect(ativado.setCookie).toEqual([])
    const codigos = ativado.corpo['codigosRecuperacao'] as string[]
    expect(codigos).toHaveLength(10)
    const { rows: hmacs } = await bancada.pool.query<{ hmac: string }>('select hmac from codigo_recuperacao where conta_id = $1', [coordenador.contaId])
    expect(hmacs).toHaveLength(10)
    for (const { hmac } of hmacs) expect(codigos).not.toContain(hmac)
    expect(await mfaNoBanco(coordenador.contaId)).toMatchObject({ ativo: true, codigos: 10 })
    // A ativação não abre sessão, e o desafio dela não serve de novo.
    expect(await sessoesDaConta(coordenador.contaId)).toBe(0)
    esperarNaoAutenticado(await comDesafio('/v1/conta/mfa/ativar', desafio, { codigo: codigoDoPasso(segredo, passo) }))

    // Sai e entra de novo: a senha certa leva a `mfa`, não a `pronta`, e nada de cookie antes do código.
    const desafioMfa = await desafioDoLogin(coordenador, 'mfa')
    expect(await sessoesDaConta(coordenador.contaId)).toBe(0)
    const pronta = await comDesafio('/v1/sessao/mfa', desafioMfa, { codigo: codigoDoPasso(segredo, passo + 1) })
    expect(pronta.status).toBe(200)
    expect(pronta.cacheControl).toBe('no-store')
    expect(pronta.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(pronta.setCookie.map((linha) => linha.split('=')[0]).sort()).toEqual(['educa_dispositivo', 'educa_sessao'])
    expect(await sessoesDaConta(coordenador.contaId)).toBe(1)

    const eu = await fetch(`${url}/v1/eu`, { headers: { Authorization: `Bearer ${String(pronta.corpo['token'])}` } })
    expect(eu.status).toBe(200)
    expect(((await eu.json()) as { papel: string }).papel).toBe('coordenador')
    const { rows: acessos } = await bancada.pool.query("select 1 from registro_acesso where escola_id = $1 and usuario_id = $2 and evento = 'login'", [coordenador.escolaId, coordenador.usuarioId])
    expect(acessos).toHaveLength(1)
    // O desafio do MFA foi consumido no acerto.
    esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', desafioMfa, { codigo: codigoDoPasso(segredo, passo + 1) }))
  })

  it('permissão (RF12): sem MFA ativo o coordenador só alcança a configuração; o desafio não vale como token de acesso, e cada desafio só na rota da etapa dele', async () => {
    const escolaId = await bancada.escola()
    const semMfa = await pessoa(escolaId)
    const desafio = await desafioDoLogin(semMfa, 'configurar_mfa')
    for (const [metodo, caminho] of [
      ['GET', '/v1/eu'],
      ['PUT', '/v1/escola/sessao'],
      ['POST', '/v1/sessao/atividade'],
    ] as const) {
      const resposta = await fetch(`${url}${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${desafio}`, 'Content-Type': 'application/json' }, body: metodo === 'GET' ? null : '{"inatividadeAlunoMin":30,"inatividadeEquipeMin":120}' })
      expect(resposta.status, caminho).toBe(401)
    }
    // O desafio de configurar não vale no `/v1/sessao/mfa`, e o de `mfa` não configura.
    esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', desafio, { codigo: '123456' }))
    const comMfa = await pessoa(escolaId)
    await comMfaAtivo(comMfa)
    esperarNaoAutenticado(await comDesafio('/v1/conta/mfa/configurar', await desafioDoLogin(comMfa, 'mfa')))
    // O token de acesso de um professor não vale nas rotas de etapa.
    const professor = await bancada.sessao(escolaId, 'professor')
    esperarNaoAutenticado(await comDesafio('/v1/conta/mfa/configurar', professor.token))
    esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', professor.token, { codigo: '123456' }))
    // Sem desafio nenhum, também não.
    const semAutorizacao = await fetch(`${url}/v1/conta/mfa/configurar`, { method: 'POST' })
    expect(semAutorizacao.status).toBe(401)
    expect(await sessoesDaConta(semMfa.contaId)).toBe(0)
    expect(await mfaNoBanco(semMfa.contaId)).toMatchObject({ ativo: false, segredo: null })
  })

  it('borda: configurar com o MFA já ativo é recusado, com um desafio de configurar que sobrou; quem tem só a senha não troca o segundo fator', async () => {
    const coordenador = await pessoa(await bancada.escola())
    const [primeiro, sobrou] = [await desafioDoLogin(coordenador, 'configurar_mfa'), await desafioDoLogin(coordenador, 'configurar_mfa')]
    const segredo = String((await comDesafio('/v1/conta/mfa/configurar', primeiro)).corpo['segredo'])
    expect((await comDesafio('/v1/conta/mfa/ativar', primeiro, { codigo: codigoDoPasso(segredo, passoAtual()) })).status).toBe(200)
    const ativo = await mfaNoBanco(coordenador.contaId)

    esperarNaoAutenticado(await comDesafio('/v1/conta/mfa/configurar', sobrou))
    esperarNaoAutenticado(await comDesafio('/v1/conta/mfa/ativar', sobrou, { codigo: codigoDoPasso(segredo, passoAtual()) }))
    const depois = await mfaNoBanco(coordenador.contaId)
    expect(depois.segredo?.equals(ativo.segredo ?? Buffer.alloc(0))).toBe(true)
    expect(depois).toMatchObject({ ativo: true, codigos: 10, passo: ativo.passo })
  })

  it('borda: código errado na ativação não ativa nem consome o desafio; o certo, depois, ativa', async () => {
    const coordenador = await pessoa(await bancada.escola())
    const desafio = await desafioDoLogin(coordenador, 'configurar_mfa')
    const segredo = String((await comDesafio('/v1/conta/mfa/configurar', desafio)).corpo['segredo'])
    esperarNaoAutenticado(await comDesafio('/v1/conta/mfa/ativar', desafio, { codigo: codigoDoPasso(segredo, passoAtual() + 3) }))
    expect(await mfaNoBanco(coordenador.contaId)).toMatchObject({ ativo: false, codigos: 0 })
    expect((await comDesafio('/v1/conta/mfa/ativar', desafio, { codigo: codigoDoPasso(segredo, passoAtual()) })).status).toBe(200)
  })

  it('concorrência: duas ativações ao mesmo tempo (dois cliques, ou duas abas com dois desafios) ativam uma vez, e o banco guarda o lote de códigos que a resposta 200 mostrou', async () => {
    const hmacsGravados = async (contaId: string) => (await bancada.pool.query<{ hmac: string }>('select hmac from codigo_recuperacao where conta_id = $1', [contaId])).rows.map((linha) => linha.hmac).sort()
    const hmacsDe = (resposta: Resposta) => (resposta.corpo['codigosRecuperacao'] as string[]).map((codigo) => hmacDaRecuperacao(configuracao.login.mfa.chaveRecuperacao, codigo)).sort()

    // Duas abas, dois desafios: o `consumir` não barra nada, e só o `update … where mfa_ativado_em is null` decide.
    const duasAbas = await pessoa(await bancada.escola())
    const [primeiraAba, segundaAba] = [await desafioDoLogin(duasAbas, 'configurar_mfa'), await desafioDoLogin(duasAbas, 'configurar_mfa')]
    const segredo = String((await comDesafio('/v1/conta/mfa/configurar', primeiraAba)).corpo['segredo'])
    const codigo = codigoDoPasso(segredo, passoAtual())
    const abas = await Promise.all([comDesafio('/v1/conta/mfa/ativar', primeiraAba, { codigo }), comDesafio('/v1/conta/mfa/ativar', segundaAba, { codigo })])
    expect(abas.map((resposta) => resposta.status).sort()).toEqual([200, 401])
    for (const recusada of abas.filter((resposta) => resposta.status !== 200)) esperarNaoAutenticado(recusada)
    const ativouNasAbas = abas.find((resposta) => resposta.status === 200)
    if (ativouNasAbas === undefined) throw new Error('nenhuma ativação passou')
    expect(await hmacsGravados(duasAbas.contaId)).toEqual(hmacsDe(ativouNasAbas))

    // Dois cliques, o mesmo desafio: o `jti` consumido antes de gravar deixa passar um só.
    const doisCliques = await pessoa(await bancada.escola())
    const desafio = await desafioDoLogin(doisCliques, 'configurar_mfa')
    const segredoDosCliques = String((await comDesafio('/v1/conta/mfa/configurar', desafio)).corpo['segredo'])
    const codigoDosCliques = codigoDoPasso(segredoDosCliques, passoAtual())
    const cliques = await Promise.all([comDesafio('/v1/conta/mfa/ativar', desafio, { codigo: codigoDosCliques }), comDesafio('/v1/conta/mfa/ativar', desafio, { codigo: codigoDosCliques })])
    expect(cliques.map((resposta) => resposta.status).sort()).toEqual([200, 401])
    for (const recusada of cliques.filter((resposta) => resposta.status !== 200)) esperarNaoAutenticado(recusada)
    const ativouNosCliques = cliques.find((resposta) => resposta.status === 200)
    if (ativouNosCliques === undefined) throw new Error('nenhuma ativação passou')
    expect(await hmacsGravados(doisCliques.contaId)).toEqual(hmacsDe(ativouNosCliques))
    // O desafio da ativação foi gasto: mesmo com o MFA apagado depois, ele não configura de novo.
    await bancada.pool.query('update conta set mfa_segredo_cifrado = null, mfa_chave_versao = null, mfa_ativado_em = null, mfa_ultimo_passo = null where id = $1', [doisCliques.contaId])
    esperarNaoAutenticado(await comDesafio('/v1/conta/mfa/configurar', desafio))
  })

  it('concorrência: o mesmo TOTP em dois POST paralelos, com dois desafios, passa uma vez só', async () => {
    const coordenador = await pessoa(await bancada.escola())
    const { base32 } = await comMfaAtivo(coordenador)
    const [um, outro] = [await desafioDoLogin(coordenador, 'mfa'), await desafioDoLogin(coordenador, 'mfa')]
    const codigo = codigoDoPasso(base32, passoAtual())
    const respostas = await Promise.all([comDesafio('/v1/sessao/mfa', um, { codigo }), comDesafio('/v1/sessao/mfa', outro, { codigo })])
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 401])
    expect(await sessoesDaConta(coordenador.contaId)).toBe(1)
    // O passo usado não volta, nem num terceiro desafio.
    esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', await desafioDoLogin(coordenador, 'mfa'), { codigo }))
    expect(await sessoesDaConta(coordenador.contaId)).toBe(1)
  })

  it('concorrência: o mesmo código de recuperação em dois POST paralelos passa uma vez, e depois nunca mais; outro código da lista continua valendo', async () => {
    const coordenador = await pessoa(await bancada.escola())
    const { codigosRecuperacao } = await comMfaAtivo(coordenador)
    const [primeiro, segundo] = codigosRecuperacao
    if (primeiro === undefined || segundo === undefined) throw new Error('sem códigos')
    // Como a pessoa copia do papel: minúsculas e hífen.
    const digitado = `${primeiro.slice(0, 4)}-${primeiro.slice(4, 8)}-${primeiro.slice(8)}`.toLowerCase()
    const [um, outro] = [await desafioDoLogin(coordenador, 'mfa'), await desafioDoLogin(coordenador, 'mfa')]
    const respostas = await Promise.all([comDesafio('/v1/sessao/mfa', um, { recuperacao: digitado }), comDesafio('/v1/sessao/mfa', outro, { recuperacao: primeiro })])
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 401])
    const { rows } = await bancada.pool.query<{ usados: string }>('select count(*) filter (where usado_em is not null) as usados from codigo_recuperacao where conta_id = $1', [coordenador.contaId])
    expect(rows[0]?.usados).toBe('1')
    esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', await desafioDoLogin(coordenador, 'mfa'), { recuperacao: primeiro }))
    expect((await comDesafio('/v1/sessao/mfa', await desafioDoLogin(coordenador, 'mfa'), { recuperacao: segundo })).corpo['etapa']).toBe('pronta')
    expect(await sessoesDaConta(coordenador.contaId)).toBe(2)
  })

  it('borda: o quinto código errado consome o desafio, e o sexto, mesmo certo, é recusado; o contador é da conta, vale nos desafios de A e de B, e o acerto da senha não o zera', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const coordenador = await pessoa(escolaA)
    await naOutraEscola(coordenador, escolaB)
    const { base32 } = await comMfaAtivo(coordenador)
    const errado = { codigo: codigoDoPasso(base32, passoAtual() + 5) }
    // A conta trabalha em A e em B: o desafio `mfa` de cada escola é o da troca (12.0), aqui emitido direto.
    const [paraA, paraB] = [
      await emissorDeDesafio.emitir({ contaId: coordenador.contaId, etapa: 'mfa', mfaCumprido: false }),
      await emissorDeDesafio.emitir({ contaId: coordenador.contaId, etapa: 'mfa', mfaCumprido: false }),
    ]
    for (let tentativa = 1; tentativa <= 3; tentativa++) esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', paraA, errado))
    esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', paraB, errado))
    esperarSegurada(await comDesafio('/v1/sessao/mfa', paraB, errado))
    // O sexto, com o código certo, no desafio consumido pelo quinto erro: recusado.
    esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', paraB, { codigo: codigoDoPasso(base32, passoAtual()) }))
    // Com outro desafio, a conta segue segurada: o limite é da conta, não do desafio.
    esperarSegurada(await comDesafio('/v1/sessao/mfa', paraA, { codigo: codigoDoPasso(base32, passoAtual()) }))
    expect(await sessoesDaConta(coordenador.contaId)).toBe(0)
    expect(await mfaNoBanco(coordenador.contaId)).toMatchObject({ passo: null })

    // O limite próprio do MFA: o acerto da senha zera o contador da senha, não o do segundo fator.
    const outro = await pessoa(await bancada.escola())
    const segredoDoOutro = await comMfaAtivo(outro)
    const erradoDoOutro = { codigo: codigoDoPasso(segredoDoOutro.base32, passoAtual() + 5) }
    const primeiro = await desafioDoLogin(outro, 'mfa')
    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', primeiro, erradoDoOutro))
    const depoisDaSenha = await desafioDoLogin(outro, 'mfa')
    esperarSegurada(await comDesafio('/v1/sessao/mfa', depoisDaSenha, erradoDoOutro))
  })

  it('borda: quem erra o código em outro navegador segura só o contador dele; o coordenador com o educa_dispositivo, que só sai depois do MFA, continua entrando', async () => {
    const coordenador = await pessoa(await bancada.escola())
    const { codigosRecuperacao } = await comMfaAtivo(coordenador)
    const primeira = await comDesafio('/v1/sessao/mfa', await desafioDoLogin(coordenador, 'mfa'), { recuperacao: codigosRecuperacao[0] })
    const linha = primeira.setCookie.find((valor) => valor.startsWith('educa_dispositivo='))
    expect(linha).toBeDefined()
    const dispositivo = `educa_dispositivo=${valorDoCookie(linha ?? '')}`

    // Quem tem só a senha, em outro navegador: cinco erros seguram a origem `outro`, sem cookie nenhum na resposta.
    const doAtacante = await desafioDoLogin(coordenador, 'mfa')
    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', doAtacante, { recuperacao: 'AAAA-AAAA-AAAA' }))
    esperarSegurada(await comDesafio('/v1/sessao/mfa', doAtacante, { recuperacao: 'AAAA-AAAA-AAAA' }))
    esperarSegurada(await comDesafio('/v1/sessao/mfa', await desafioDoLogin(coordenador, 'mfa'), { recuperacao: codigosRecuperacao[1] }))

    const doComputadorDela = await comDesafio('/v1/sessao/mfa', await desafioDoLogin(coordenador, 'mfa', dispositivo), { recuperacao: codigosRecuperacao[2] }, dispositivo)
    expect(doComputadorDela.status).toBe(200)
    expect(doComputadorDela.corpo['etapa']).toBe('pronta')
  })

  it('borda: conta de coordenador em A e professor em B leva a escolher depois do MFA, com o MFA cumprido e sem sessão nem cookie ainda', async () => {
    const escolaA = await bancada.escola()
    const coordenador = await pessoa(escolaA)
    const { codigosRecuperacao } = await comMfaAtivo(coordenador)
    const desafio = await emissorDeDesafio.emitir({ contaId: coordenador.contaId, etapa: 'mfa', mfaCumprido: false })
    await naOutraEscola(coordenador, await bancada.escola(), 'professor')
    const resposta = await comDesafio('/v1/sessao/mfa', desafio, { recuperacao: codigosRecuperacao[0] })
    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toEqual({ etapa: 'escolher', desafio: expect.any(String), acessos: expect.any(Array) })
    expect(resposta.setCookie).toEqual([])
    const [, carga] = String(resposta.corpo['desafio']).split('.')
    expect(JSON.parse(Buffer.from(carga ?? '', 'base64url').toString())).toMatchObject({ etapa: 'escolher', mfa_cumprido: true, conta_id: coordenador.contaId })
    expect(await sessoesDaConta(coordenador.contaId)).toBe(0)
  })

  describe('redefinição pela coordenação: 202 sempre, e só age dentro da escola', () => {
    it('isolamento: usuário só de B dá 202 sem efeito; usuário de A com a conta também em B, 202 sem efeito e recusa na auditoria de A; só de A, 202 e o MFA apagado; as respostas são idênticas', async () => {
      const escolaA = await bancada.escola()
      const escolaB = await bancada.escola()
      const coordenacaoDeA = await bancada.sessao(escolaA, 'coordenador')
      const soDeB = await pessoa(escolaB)
      const emAeB = await pessoa(escolaA)
      await naOutraEscola(emAeB, escolaB)
      const soDeA = await pessoa(escolaA)
      for (const quem of [soDeB, emAeB, soDeA]) await comMfaAtivo(quem)
      const redefinir = (id: string) => comDesafio(`/v1/usuarios/${id}/mfa/redefinir`, coordenacaoDeA.token, { finalidade: 'autenticador_perdido' })

      const respostas = [await redefinir(soDeB.usuarioId), await redefinir(emAeB.usuarioId), await redefinir(randomUUID()), await redefinir('1837'), await redefinir(soDeA.usuarioId)]
      for (const resposta of respostas) {
        expect(resposta.status).toBe(202)
        expect(resposta.corpo).toEqual({})
        expect(resposta.setCookie).toEqual([])
      }

      expect(await mfaNoBanco(soDeB.contaId)).toMatchObject({ ativo: true, codigos: 10 })
      expect(await mfaNoBanco(emAeB.contaId)).toMatchObject({ ativo: true, codigos: 10 })
      expect(await mfaNoBanco(soDeA.contaId)).toEqual({ ativo: false, segredo: null, passo: null, codigos: 0 })
      const { rows: versao } = await bancada.pool.query<{ mfa_chave_versao: number | null }>('select mfa_chave_versao from conta where id = $1', [soDeA.contaId])
      expect(versao).toEqual([{ mfa_chave_versao: null }])

      expect(await auditoriaDeMfa(escolaA)).toEqual([
        { acao: 'usuario.mfa_redefinicao_recusada', entidade: 'usuario', entidade_id: emAeB.usuarioId, autor_usuario_id: coordenacaoDeA.usuarioId, autor_operador: null, antes: null, depois: null, finalidade: 'autenticador_perdido' },
        {
          acao: 'usuario.mfa_redefinido',
          entidade: 'usuario',
          entidade_id: soDeA.usuarioId,
          autor_usuario_id: coordenacaoDeA.usuarioId,
          autor_operador: null,
          antes: { mfaAtivo: true },
          depois: { mfaAtivo: false },
          finalidade: 'autenticador_perdido',
        },
      ])
      expect(await auditoriaDeMfa(escolaB)).toEqual([])
      // No login seguinte, quem teve o MFA redefinido configura de novo.
      await desafioDoLogin(soDeA, 'configurar_mfa')
      await desafioDoLogin(soDeB, 'mfa')
    })

    it('caminho feliz (17.4): o coordenador com sessão aberta tem o MFA redefinido pela coordenação, e a requisição seguinte com aquela sessão dá 401; quem pediu segue entrando', async () => {
      const escolaA = await bancada.escola()
      const coordenacaoDeA = await bancada.sessao(escolaA, 'coordenador')
      const alvo = await pessoa(escolaA)
      await comMfaAtivo(alvo)
      // Duas sessões abertas da conta: o computador da escola e o aparelho que se perdeu.
      const [noComputador, noAparelho] = [await sessaoAberta(alvo.contaId, escolaA, alvo.usuarioId), await sessaoAberta(alvo.contaId, escolaA, alvo.usuarioId)]
      for (const aberta of [noComputador, noAparelho]) expect(await obterEu(aberta.token)).toBe(200)

      const resposta = await comDesafio(`/v1/usuarios/${alvo.usuarioId}/mfa/redefinir`, coordenacaoDeA.token, { finalidade: 'autenticador_perdido' })
      expect(resposta.status).toBe(202)
      expect(resposta.corpo).toEqual({})

      for (const aberta of [noComputador, noAparelho]) {
        expect(await obterEu(aberta.token)).toBe(401)
        expect(await situacaoDaSessao(aberta.sessaoId)).toEqual({ encerrada: true, motivo: 'mfa_redefinido' })
      }
      expect(await obterEu(coordenacaoDeA.token)).toBe(200)
      // A auditoria da escola não diz quantas sessões caíram: podiam ser também de outra escola.
      expect((await auditoriaDeMfa(escolaA)).map((linha) => linha['depois'])).toEqual([{ mfaAtivo: false }])
    })

    it('isolamento (17.4): redefinir o MFA de um usuário de A não encerra a sessão de um usuário de B, nem as da conta que também está em B e teve a redefinição recusada', async () => {
      const escolaA = await bancada.escola()
      const escolaB = await bancada.escola()
      const coordenacaoDeA = await bancada.sessao(escolaA, 'coordenador')
      const soDeA = await pessoa(escolaA)
      const soDeB = await pessoa(escolaB)
      const emAeB = await pessoa(escolaA)
      const emAeBnaB = await naOutraEscola(emAeB, escolaB)
      for (const quem of [soDeA, soDeB, emAeB]) await comMfaAtivo(quem)
      const deA = await sessaoAberta(soDeA.contaId, escolaA, soDeA.usuarioId)
      const deB = await sessaoAberta(soDeB.contaId, escolaB, soDeB.usuarioId)
      const recusadaEmA = await sessaoAberta(emAeB.contaId, escolaA, emAeB.usuarioId)
      const recusadaEmB = await sessaoAberta(emAeB.contaId, escolaB, emAeBnaB)

      for (const id of [soDeA.usuarioId, soDeB.usuarioId, emAeB.usuarioId]) {
        expect((await comDesafio(`/v1/usuarios/${id}/mfa/redefinir`, coordenacaoDeA.token, { finalidade: 'autenticador_perdido' })).status).toBe(202)
      }

      expect(await situacaoDaSessao(deA.sessaoId)).toEqual({ encerrada: true, motivo: 'mfa_redefinido' })
      for (const aberta of [deB, recusadaEmA, recusadaEmB]) {
        expect(await situacaoDaSessao(aberta.sessaoId)).toEqual({ encerrada: false, motivo: null })
        expect(await obterEu(aberta.token)).toBe(200)
      }
      expect(await auditoriaDeMfa(escolaB)).toEqual([])
    })

    it('borda: o próprio coordenador, o alvo desativado e o aluno sem conta dão 202 sem efeito e sem registro', async () => {
      const escolaId = await bancada.escola()
      const coordenacao = await bancada.sessao(escolaId, 'coordenador')
      const desativado = await pessoa(escolaId)
      await comMfaAtivo(desativado)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [desativado.usuarioId])
      const aluno = await bancada.sessao(escolaId, 'aluno')
      for (const id of [coordenacao.usuarioId, desativado.usuarioId, aluno.usuarioId]) {
        const resposta = await comDesafio(`/v1/usuarios/${id}/mfa/redefinir`, coordenacao.token, { finalidade: 'codigos_perdidos' })
        expect(resposta.status).toBe(202)
      }
      expect(await mfaNoBanco(desativado.contaId)).toMatchObject({ ativo: true })
      expect(await auditoriaDeMfa(escolaId)).toEqual([])
    })

    it('permissão: professor chamando redefinir recebe 404, como rota inexistente, e nada muda; finalidade fora da lista é recusada', async () => {
      const escolaId = await bancada.escola()
      const professor = await bancada.sessao(escolaId, 'professor')
      const coordenador = await pessoa(escolaId)
      await comMfaAtivo(coordenador)
      const resposta = await comDesafio(`/v1/usuarios/${coordenador.usuarioId}/mfa/redefinir`, professor.token, { finalidade: 'autenticador_perdido' })
      expect(resposta.status).toBe(404)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)
      expect(await mfaNoBanco(coordenador.contaId)).toMatchObject({ ativo: true })

      const coordenacao = await bancada.sessao(escolaId, 'coordenador')
      for (const corpo of [{}, { finalidade: 'pedido_formal_da_escola' }, { finalidade: 'a coordenadora Renata pediu' }, { finalidade: 'autenticador_perdido', escolaId }]) {
        const invalida = await comDesafio(`/v1/usuarios/${coordenador.usuarioId}/mfa/redefinir`, coordenacao.token, corpo)
        expect(invalida.status).toBe(400)
        expect(invalida.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect(await mfaNoBanco(coordenador.contaId)).toMatchObject({ ativo: true })
      expect(await auditoriaDeMfa(escolaId)).toEqual([])
    })
  })

  describe('ops:redefinir-mfa', () => {
    const ambiente = { ...lerAmbienteDeTeste(), OPERADOR: 'operador-teste' }

    async function rodar(argumentos: string[]): Promise<{ codigo: number; saida: string; erro: string }> {
      let saida = ''
      let erro = ''
      const codigo = await executarOpsRedefinirMfa(argumentos, ambiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
      return { codigo, saida, erro }
    }

    it('privacidade: redefine a conta que está em A e em B, grava o registro nas duas escolas com o operador e o pedido, e imprime só "ok", sem nome nem e-mail', async () => {
      const escolaA = await bancada.escola()
      const escolaB = await bancada.escola()
      const coordenador = await pessoa(escolaA)
      const usuarioEmB = await naOutraEscola(coordenador, escolaB)
      await comMfaAtivo(coordenador)

      const execucao = await rodar(['--usuario', coordenador.usuarioId, '--pedido', '4471'])
      expect(execucao).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })
      expect(await mfaNoBanco(coordenador.contaId)).toEqual({ ativo: false, segredo: null, passo: null, codigos: 0 })
      for (const [escolaId, usuarioId] of [
        [escolaA, coordenador.usuarioId],
        [escolaB, usuarioEmB],
      ] as const) {
        expect(await auditoriaDeMfa(escolaId)).toEqual([
          {
            acao: 'usuario.mfa_redefinido',
            entidade: 'usuario',
            entidade_id: usuarioId,
            autor_usuario_id: null,
            autor_operador: 'operador-teste',
            antes: { mfaAtivo: true },
            depois: { mfaAtivo: false, pedidoDoOperador: 4471 },
            finalidade: 'pedido_formal_da_escola',
          },
        ])
      }
    })

    it('eliminação agendada (14.0): a escola em que a pessoa está agendada também recebe o registro da redefinição, porque o usuário continua sendo dela', async () => {
      const escolaA = await bancada.escola()
      const escolaB = await bancada.escola()
      const coordenador = await pessoa(escolaA)
      const usuarioEmB = await naOutraEscola(coordenador, escolaB)
      await comMfaAtivo(coordenador)
      await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where id = $1', [usuarioEmB])

      expect(await rodar(['--usuario', coordenador.usuarioId, '--pedido', '5150'])).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })

      expect(await auditoriaDeMfa(escolaA)).toHaveLength(1)
      expect(await auditoriaDeMfa(escolaB)).toEqual([expect.objectContaining({ entidade_id: usuarioEmB, depois: { mfaAtivo: false, pedidoDoOperador: 5150 } })])
    })

    it('caminho feliz (17.4): a redefinição pelo operador encerra as sessões abertas da conta em A e em B, e as duas dão 401; a sessão de outra pessoa continua', async () => {
      const escolaA = await bancada.escola()
      const escolaB = await bancada.escola()
      const coordenador = await pessoa(escolaA)
      const usuarioEmB = await naOutraEscola(coordenador, escolaB)
      await comMfaAtivo(coordenador)
      const emA = await sessaoAberta(coordenador.contaId, escolaA, coordenador.usuarioId)
      const emB = await sessaoAberta(coordenador.contaId, escolaB, usuarioEmB)
      const outraPessoa = await pessoa(escolaA)
      const daOutra = await sessaoAberta(outraPessoa.contaId, escolaA, outraPessoa.usuarioId)

      expect(await rodar(['--usuario', coordenador.usuarioId, '--pedido', '88'])).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })
      for (const aberta of [emA, emB]) {
        expect(await obterEu(aberta.token)).toBe(401)
        expect(await situacaoDaSessao(aberta.sessaoId)).toEqual({ encerrada: true, motivo: 'mfa_redefinido' })
      }
      expect(await obterEu(daOutra.token)).toBe(200)
    })

    it('usuário desativado e aluno sem conta saem com NAO_ENCONTRADO, e o MFA do desativado não muda', async () => {
      const escolaId = await bancada.escola()
      const desativado = await pessoa(escolaId)
      await comMfaAtivo(desativado)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [desativado.usuarioId])
      const aluno = await bancada.sessao(escolaId, 'aluno')
      for (const usuarioId of [desativado.usuarioId, aluno.usuarioId]) expect(await rodar(['--usuario', usuarioId, '--pedido', '12'])).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO\n' })
      expect(await mfaNoBanco(desativado.contaId)).toMatchObject({ ativo: true, codigos: 10 })
      expect(await auditoriaDeMfa(escolaId)).toEqual([])
    })

    it('usuário inexistente sai com NAO_ENCONTRADO e 1, sem o id, e nada gravado', async () => {
      const inexistente = randomUUID()
      const execucao = await rodar(['--usuario', inexistente, '--pedido', '12'])
      expect(execucao).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO\n' })
      const { rows } = await bancada.pool.query("select 1 from auditoria where entidade_id = $1 and acao like 'usuario.mfa%'", [inexistente])
      expect(rows).toEqual([])
    })
  })

  describe('a borda de entrada (16.0, onda-1a T1): o corpo passa pelo ZodValidationPipe, o token continua lido no handler', () => {
    /** Um POST sem `Authorization`, ou com o valor que o teste quiser (que não seja um desafio). */
    async function comCabecalho(caminho: string, authorization: string | undefined, corpo: unknown): Promise<Resposta> {
      return lerResposta(
        await fetch(`${url}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization === undefined ? {} : { Authorization: authorization }) }, body: JSON.stringify(corpo) }),
      )
    }

    const CORPO_VALIDO = { codigo: '123456' }
    const CORPO_INVALIDO = {}

    it('a ordem dos erros: com o corpo válido, o token que falta ou não vale dá 401; com o corpo inválido, o 400 vem antes do token, em /conta/mfa/ativar e em /sessao/mfa, e o desafio certo com o corpo inválido dá 400', async () => {
      const escolaId = await bancada.escola()
      const semMfa = await pessoa(escolaId)
      const comMfa = await pessoa(escolaId)
      await comMfaAtivo(comMfa)
      const paraAtivar = await emissorDeDesafio.emitir({ contaId: semMfa.contaId, etapa: 'configurar_mfa', mfaCumprido: false })
      const paraEntrar = await emissorDeDesafio.emitir({ contaId: comMfa.contaId, etapa: 'mfa', mfaCumprido: false })
      for (const [caminho, desafio] of [
        ['/v1/conta/mfa/ativar', paraAtivar],
        ['/v1/sessao/mfa', paraEntrar],
      ] as const) {
        esperarNaoAutenticado(await comCabecalho(caminho, undefined, CORPO_VALIDO))
        esperarNaoAutenticado(await comCabecalho(caminho, 'Bearer desafio-que-nao-vale', CORPO_VALIDO))
        // O corpo inválido é lido pelo pipe, que o Nest roda antes do handler: o 401 do token, lido no handler, não é alcançado.
        for (const authorization of [undefined, 'Bearer desafio-que-nao-vale']) {
          const resposta = await comCabecalho(caminho, authorization, CORPO_INVALIDO)
          expect(resposta.status, `${caminho} ${String(authorization)}`).toBe(400)
          expect(resposta.corpo.erro?.codigo, `${caminho} ${String(authorization)}`).toBe(ErrorCode.ENTRADA_INVALIDA)
          expect(resposta.setCookie, `${caminho} ${String(authorization)}`).toEqual([])
        }
        const certoEInvalido = await comDesafio(caminho, desafio, CORPO_INVALIDO)
        expect(certoEInvalido.status, caminho).toBe(400)
        expect(certoEInvalido.corpo.erro?.codigo, caminho).toBe(ErrorCode.ENTRADA_INVALIDA)
        expect(certoEInvalido.setCookie, caminho).toEqual([])
      }
      expect(await sessoesDaConta(comMfa.contaId)).toBe(0)
      expect(await mfaNoBanco(semMfa.contaId)).toMatchObject({ ativo: false, codigos: 0 })
    })

    it('o corpo inválido não gasta tentativa: seis pedidos com o desafio certo e o corpo fora do esquema dão 400, e os quatro erros de código que vêm depois ainda dão 401, só o quinto segura a conta', async () => {
      const coordenador = await pessoa(await bancada.escola())
      const { base32 } = await comMfaAtivo(coordenador)
      const desafio = await emissorDeDesafio.emitir({ contaId: coordenador.contaId, etapa: 'mfa', mfaCumprido: false })
      for (const corpo of [{}, { codigo: '12345' }, { codigo: 123456 }, { codigo: '123456', escolaId: coordenador.escolaId }, { recuperacao: 'curto' }, []]) {
        const resposta = await comDesafio('/v1/sessao/mfa', desafio, corpo)
        expect(resposta.status).toBe(400)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      const errado = { codigo: codigoDoPasso(base32, passoAtual() + 5) }
      for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', desafio, errado))
      esperarSegurada(await comDesafio('/v1/sessao/mfa', desafio, errado))
    })

    it('redefinir: o id em maiúsculas age sobre o usuário da escola; o id fora do formato com o corpo inválido é 400, e com o corpo válido é 202 sem efeito', async () => {
      const escolaA = await bancada.escola()
      const coordenacao = await bancada.sessao(escolaA, 'coordenador')
      const alvo = await pessoa(escolaA)
      await comMfaAtivo(alvo)
      const redefinir = (id: string, corpo: unknown) => comDesafio(`/v1/usuarios/${id}/mfa/redefinir`, coordenacao.token, corpo)

      for (const id of ['nao-e-uuid', '1837', `${alvo.usuarioId}x`]) {
        const invalido = await redefinir(id, { finalidade: 'pedido_formal_da_escola' })
        expect(invalido.status, id).toBe(400)
        expect(invalido.corpo.erro?.codigo, id).toBe(ErrorCode.ENTRADA_INVALIDA)
        expect((await redefinir(id, { finalidade: 'autenticador_perdido' })).status, id).toBe(202)
      }
      expect(await mfaNoBanco(alvo.contaId)).toMatchObject({ ativo: true, codigos: 10 })
      // O id fora do formato não chega ao caso de uso: nem a recusa dele fica na auditoria.
      expect(await auditoriaDeMfa(escolaA)).toEqual([])

      const emMaiusculas = await redefinir(alvo.usuarioId.toUpperCase(), { finalidade: 'autenticador_perdido' })
      expect(emMaiusculas.status).toBe(202)
      expect(await mfaNoBanco(alvo.contaId)).toEqual({ ativo: false, segredo: null, passo: null, codigos: 0 })
    })
  })

  it('falha: com o Redis de fila fora, o desafio de mfa é recusado com NAO_AUTENTICADO antes de o código ser conferido, e depois a pessoa entra de novo', async () => {
    const coordenador = await pessoa(await bancada.escola())
    const { base32 } = await comMfaAtivo(coordenador)
    const desafio = await desafioDoLogin(coordenador, 'mfa')
    composeOuFalha('stop', 'redis-fila')
    try {
      const prazo = performance.now() + 10_000
      while (cliente.status === 'ready' && performance.now() < prazo) await new Promise((resolver) => setTimeout(resolver, 20))
      expect(cliente.status).not.toBe('ready')
      esperarNaoAutenticado(await comDesafio('/v1/sessao/mfa', desafio, { codigo: codigoDoPasso(base32, passoAtual()) }))
      // O código não foi gasto: o passo não andou.
      expect(await mfaNoBanco(coordenador.contaId)).toMatchObject({ passo: null })
      expect(await sessoesDaConta(coordenador.contaId)).toBe(0)
    } finally {
      composeOuFalha('start', 'redis-fila')
      await aguardarSaudavel('redis-fila')
      await clientePronto(cliente)
    }
    const deNovo = await comDesafio('/v1/sessao/mfa', await desafioDoLogin(coordenador, 'mfa'), { codigo: codigoDoPasso(base32, passoAtual()) })
    expect(deNovo.corpo['etapa']).toBe('pronta')
  })

  it('privacidade: o log do fluxo inteiro, com os erros, não tem segredo, URI, código, código de recuperação, desafio, cookie nem e-mail', () => {
    const log = linhasDeLog.join('\n')
    expect(log).toContain('http.erro')
    expect(segredosVistos.size).toBeGreaterThan(80)
    for (const segredo of segredosVistos) if (segredo.length >= 6) expect(log.includes(segredo), 'um valor secreto apareceu no log').toBe(false)
    expect(log).not.toMatch(/otpauth:|@escola\.invalid/i)
  })
})
