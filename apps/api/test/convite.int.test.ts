import 'reflect-metadata'
import { criarLogger } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { Redis } from 'ioredis'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Secret, TOTP } from 'otpauth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { executarOpsConviteCoordenador } from '../src/ops/convite-coordenador.js'
import { executarOpsRevogarConvite } from '../src/ops/revogar-convite.js'
import { CifraDoSegredo, CLIENTE_REDIS_LOGIN, gerarSegredo, HashDeSenha } from '../src/credencial/index.js'
import { criarConviteDeCoordenador } from '../src/sessao/index.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './configuracao-de-teste.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

const SENHA_NOVA = 'senha-nova-do-convite-1'
const SENHA_DE_B = 'senha-que-a-conta-ja-tinha-1'
const OPERADOR = 'operador-teste'
const NOME_DO_CONVIDADO = 'Renata Convidada Sintética'
const HORA_MS = 60 * 60 * 1_000

interface Resposta {
  status: number
  corpo: Record<string, unknown> & { erro?: { codigo?: string; requisicaoId?: string } }
  texto: string
  cacheControl: string | null
  setCookie: string[]
}

interface Convite {
  conviteId: string
  token: string
  email: string
  usuarioId: string
  contaId: string
}

async function clientePronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 15_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex')

/** O corpo do erro sem o `requisicaoId`, que muda a cada requisição. */
function semRequisicao(resposta: Resposta): unknown {
  const { erro, ...resto } = resposta.corpo
  if (erro === undefined) return resto
  const { requisicaoId: _requisicaoId, ...erroSemId } = erro
  return { ...resto, erro: erroSemId }
}

describe('convite do primeiro coordenador: o operador gera, a pessoa consulta e aceita', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const configuracao = configuracaoDeTeste()
  const cifra = new CifraDoSegredo(configuracao.login.mfa.versaoCifra, configuracao.login.mfa.chavesCifra)
  const ambiente = { ...lerAmbienteDeTeste(), OPERADOR }
  const linhasDeLog: string[] = []
  let app: INestApplication
  let url: string
  let hash: HashDeSenha
  let pasta: string

  beforeAll(async () => {
    app = await NestFactory.create(AppModule.com(configuracao, { medidor: medidor.medidor, ...MONTAGEM_DE_TESTE }), { logger: false })
    configurarAplicacao(app, criarLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => linhasDeLog.push(linha) } }), medidor.medidor)
    await app.listen(0, '127.0.0.1')
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
    hash = app.get(HashDeSenha)
    await clientePronto(app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }))
    pasta = await mkdtemp(join(tmpdir(), 'convite-'))
  })

  afterAll(async () => {
    await app.close()
    await bancada.fechar()
    await medidor.encerrar()
    await rm(pasta, { recursive: true, force: true })
  })

  async function slugDe(escolaId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ slug: string }>('select slug from escola where id = $1', [escolaId])
    return rows[0]?.slug ?? ''
  }

  async function rodarConvite(argumentos: string[]): Promise<{ codigo: number; saida: string; erro: string }> {
    let saida = ''
    let erro = ''
    const codigo = await executarOpsConviteCoordenador(argumentos, ambiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
    return { codigo, saida, erro }
  }

  async function rodarRevogacao(conviteId: string): Promise<{ codigo: number; saida: string; erro: string }> {
    let saida = ''
    let erro = ''
    const codigo = await executarOpsRevogarConvite(['--convite', conviteId], ambiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
    return { codigo, saida, erro }
  }

  /** O usuário e a conta do convite, pelo id dele: é o que o operador não vê. */
  async function alvoDoConvite(conviteId: string): Promise<{ usuarioId: string; contaId: string }> {
    const { rows } = await bancada.pool.query<{ usuario_id: string; conta_id: string }>('select c.usuario_id, u.conta_id from convite c join usuario u on u.id = c.usuario_id where c.id = $1', [conviteId])
    const [linha] = rows
    if (linha === undefined) throw new Error('convite não encontrado')
    return { usuarioId: linha.usuario_id, contaId: linha.conta_id }
  }

  /** O convite pelo comando do operador, com o token lido do arquivo. */
  async function convidarPeloComando(escolaId: string, email = `convidada-${randomUUID()}@escola.invalid`): Promise<Convite & { arquivo: string; saida: string }> {
    const arquivo = join(pasta, `convite-${randomUUID()}.txt`)
    const execucao = await rodarConvite(['--escola', await slugDe(escolaId), '--email', email, '--nome', NOME_DO_CONVIDADO, '--saida', arquivo])
    expect(execucao.erro).toBe('')
    expect(execucao.codigo).toBe(0)
    const { conviteId } = JSON.parse(execucao.saida) as { conviteId: string }
    const token = (await readFile(arquivo, 'utf8')).trim()
    return { conviteId, token, email, arquivo, saida: execucao.saida, ...(await alvoDoConvite(conviteId)) }
  }

  /** O convite pelo serviço que o comando chama, com o relógio escolhido: é como se ele tivesse sido gerado naquela hora. */
  async function convidarEm(escolaId: string, agora: Date, email = `convidada-${randomUUID()}@escola.invalid`): Promise<Convite> {
    const { conviteId, token } = await criarConviteDeCoordenador(bancada.banco, async () => OPERADOR, { slug: await slugDe(escolaId), email, nome: NOME_DO_CONVIDADO }, { agora: () => agora })
    return { conviteId, token, email, ...(await alvoDoConvite(conviteId)) }
  }

  async function post(caminho: string, corpo: unknown, cabecalhos: Record<string, string> = {}): Promise<Resposta> {
    const resposta = await fetch(`${url}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo) })
    const texto = await resposta.text()
    return {
      status: resposta.status,
      corpo: texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo']),
      texto,
      cacheControl: resposta.headers.get('cache-control'),
      setCookie: resposta.headers.getSetCookie(),
    }
  }

  const consultar = (token: string) => post('/v1/convites/consultar', { token })
  const aceitar = (token: string, senha?: string) => post('/v1/convites/aceitar', senha === undefined ? { token } : { token, senha })
  const entrar = (email: string, senha: string, bilhete?: string) => post('/v1/sessao/email', bilhete === undefined ? { email, senha } : { email, senha, bilhete })

  /** Aceita o convite de quem já tem conta e devolve o bilhete que liga o link ao login. */
  async function aceitarComConta(token: string, senha?: string): Promise<string> {
    const aceite = await aceitar(token, senha)
    expect(aceite.status).toBe(200)
    expect(aceite.corpo).toEqual({ etapa: 'entrar', bilhete: expect.any(String) })
    expect(aceite.setCookie).toEqual([])
    return String(aceite.corpo['bilhete'])
  }

  async function usuarioAtivo(usuarioId: string): Promise<boolean> {
    const { rows } = await bancada.pool.query<{ ativo: boolean }>('select desativado_em is null as ativo from usuario where id = $1', [usuarioId])
    return rows[0]?.ativo ?? false
  }

  async function senhaDaConta(contaId: string): Promise<string | null> {
    const { rows } = await bancada.pool.query<{ senha_hash: string | null }>('select senha_hash from conta where id = $1', [contaId])
    return rows[0]?.senha_hash ?? null
  }

  async function sessoesDaConta(contaId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: string }>('select count(*) as total from sessao where conta_id = $1', [contaId])
    return Number(rows[0]?.total)
  }

  async function auditoriaDoConvite(escolaId: string): Promise<Array<Record<string, unknown>>> {
    const { rows } = await bancada.pool.query(
      "select acao, entidade, entidade_id, autor_usuario_id, autor_operador, antes, depois, finalidade from auditoria where escola_id = $1 and (entidade = 'convite' or acao = 'usuario.ativado_por_convite') order by em, id",
      [escolaId],
    )
    return rows
  }

  /** A pessoa que já coordena B, com senha e MFA ativo: o convite de A chega a uma conta que já existe. */
  async function coordenadoraDeB(escolaB: string): Promise<{ email: string; contaId: string; usuarioId: string; base32: string }> {
    const email = `coordenadora-b-${randomUUID()}@escola.invalid`
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, await hash.gerar(SENHA_DE_B)])
    const contaId = contas[0]?.id ?? ''
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'coordenador', 'Pessoa sintética') returning id", [
      escolaB,
      contaId,
    ])
    const novo = gerarSegredo()
    const { cifrado, versao } = cifra.cifrar(novo.bytes, contaId)
    await bancada.pool.query('update conta set mfa_segredo_cifrado = $1, mfa_chave_versao = $2, mfa_ativado_em = now() where id = $3', [cifrado, versao, contaId])
    return { email, contaId, usuarioId: usuarios[0]?.id ?? '', base32: novo.base32 }
  }

  /** A professora de B, com senha e sem MFA. */
  async function professoraDeB(escolaB: string): Promise<{ email: string; contaId: string; usuarioId: string }> {
    const email = `professora-b-${randomUUID()}@escola.invalid`
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, await hash.gerar(SENHA_DE_B)])
    const contaId = contas[0]?.id ?? ''
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Pessoa sintética') returning id", [
      escolaB,
      contaId,
    ])
    return { email, contaId, usuarioId: usuarios[0]?.id ?? '' }
  }

  /** O código do app autenticador, `adiante` passos depois do de agora (a janela aceita o seguinte). */
  function codigoDoApp(base32: string, adiante = 0): string {
    return TOTP.generate({ secret: Secret.fromBase32(base32), algorithm: 'SHA1', digits: 6, period: 30, timestamp: Date.now() + adiante * 30_000 })
  }

  it('caminho feliz (RF1, RF12): o operador gera, o coordenador consulta, aceita com a senha e recebe configurar_mfa, sem sessão nem cookie; o MFA vem antes de qualquer acesso', async () => {
    const escolaId = await bancada.escola()
    const convite = await convidarPeloComando(escolaId)

    // Antes do aceite, a conta não tem senha e o coordenador está inativo: não há como entrar.
    expect(await usuarioAtivo(convite.usuarioId)).toBe(false)
    expect(await senhaDaConta(convite.contaId)).toBeNull()
    expect((await entrar(convite.email, SENHA_NOVA)).status).toBe(401)

    const consulta = await consultar(convite.token)
    expect(consulta.status).toBe(200)
    expect(consulta.cacheControl).toBe('no-store')
    expect(consulta.corpo).toEqual({ escolaNome: 'Escola sintética de teste' })

    const aceite = await aceitar(convite.token, SENHA_NOVA)
    expect(aceite.status).toBe(200)
    expect(aceite.cacheControl).toBe('no-store')
    expect(aceite.corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
    expect(aceite.setCookie).toEqual([])
    expect(await sessoesDaConta(convite.contaId)).toBe(0)
    expect(await usuarioAtivo(convite.usuarioId)).toBe(true)
    expect(await hash.verificar(await senhaDaConta(convite.contaId), SENHA_NOVA)).toBe(true)

    // O desafio do aceite não vale como token de acesso; vale para configurar o MFA.
    const desafio = String(aceite.corpo['desafio'])
    expect((await fetch(`${url}/v1/eu`, { headers: { Authorization: `Bearer ${desafio}` } })).status).toBe(401)
    const configurado = await post('/v1/conta/mfa/configurar', {}, { Authorization: `Bearer ${desafio}` })
    expect(configurado.status).toBe(200)
    // Entrando de novo com a senha nova, sem ter ativado o MFA, a etapa continua sendo configurar_mfa: nada de pronta.
    expect((await entrar(convite.email, SENHA_NOVA)).corpo).toEqual({ etapa: 'configurar_mfa', desafio: expect.any(String) })
    expect(await sessoesDaConta(convite.contaId)).toBe(0)

    expect(await auditoriaDoConvite(escolaId)).toEqual([
      {
        acao: 'convite.criado',
        entidade: 'convite',
        entidade_id: convite.conviteId,
        autor_usuario_id: null,
        autor_operador: OPERADOR,
        antes: null,
        depois: { tipo: 'coordenador', usuarioId: convite.usuarioId, expiraEm: expect.any(String), contaNova: true },
        finalidade: null,
      },
      {
        acao: 'convite.aceito',
        entidade: 'convite',
        entidade_id: convite.conviteId,
        autor_usuario_id: convite.usuarioId,
        autor_operador: null,
        antes: null,
        depois: { tipo: 'coordenador', usuarioId: convite.usuarioId, usuarioAtivo: true },
        finalidade: null,
      },
    ])
    // O convite vale 72 h a partir da criação.
    const { rows } = await bancada.pool.query<{ horas: number }>('select extract(epoch from (expira_em - now())) / 3600 as horas from convite where id = $1', [convite.conviteId])
    expect(Number(rows[0]?.horas)).toBeGreaterThan(71.9)
    expect(Number(rows[0]?.horas)).toBeLessThanOrEqual(72)
  })

  it('privacidade (regra 20, itens 8 e 9): o arquivo do token tem modo 0600, o terminal não traz token, nome nem e-mail, o banco guarda só o hash e o log do aceite não traz o token', async () => {
    const escolaId = await bancada.escola()
    const convite = await convidarPeloComando(escolaId)

    expect((await stat(convite.arquivo)).mode & 0o777).toBe(0o600)
    expect(convite.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(JSON.parse(convite.saida)).toEqual({ conviteId: convite.conviteId, arquivo: convite.arquivo })
    for (const proibido of [convite.token, convite.email, NOME_DO_CONVIDADO]) expect(convite.saida).not.toContain(proibido)

    const { rows } = await bancada.pool.query<{ linha: string; token_hash: string }>('select row_to_json(c)::text as linha, token_hash from convite c where id = $1', [convite.conviteId])
    expect(rows[0]?.token_hash).toBe(sha256(convite.token))
    expect(rows[0]?.linha).not.toContain(convite.token)
    const { rows: auditoria } = await bancada.pool.query<{ linha: string }>('select row_to_json(a)::text as linha from auditoria a where escola_id = $1', [escolaId])
    for (const { linha } of auditoria) for (const proibido of [convite.token, convite.email, NOME_DO_CONVIDADO]) expect(linha).not.toContain(proibido)

    // Um aceite que falha (senha curta) e um que passa: nenhum dos dois deixa o token no log.
    expect((await aceitar(convite.token, 'curta')).status).toBe(400)
    expect((await aceitar(convite.token, SENHA_NOVA)).status).toBe(200)
    expect((await aceitar(convite.token, SENHA_NOVA)).status).toBe(404)
    const log = linhasDeLog.join('\n')
    expect(log).toContain('http.erro')
    for (const proibido of [convite.token, convite.email, SENHA_NOVA, NOME_DO_CONVIDADO]) expect(log.includes(proibido), 'dado do convite apareceu no log').toBe(false)
  })

  it('concorrência (regra 80, item 7): dois aceites em paralelo com o mesmo token definem uma senha, ativam um usuário e gravam um aceite', async () => {
    const escolaId = await bancada.escola()
    const convite = await convidarEm(escolaId, new Date())
    const senhas = ['senha-da-primeira-aba-1', 'senha-da-segunda-aba-2'] as const

    const respostas = await Promise.all(senhas.map((senha) => aceitar(convite.token, senha)))
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 404])
    const vencedora = respostas.findIndex((resposta) => resposta.status === 200)
    expect(respostas[vencedora]?.corpo['etapa']).toBe('configurar_mfa')
    expect(respostas[1 - vencedora]?.corpo.erro?.codigo).toBe(ErrorCode.NAO_ENCONTRADO)

    const senhaGravada = await senhaDaConta(convite.contaId)
    expect(await hash.verificar(senhaGravada, senhas[vencedora] ?? '')).toBe(true)
    expect(await hash.verificar(senhaGravada, senhas[1 - vencedora] ?? '')).toBe(false)
    expect(await usuarioAtivo(convite.usuarioId)).toBe(true)
    expect((await auditoriaDoConvite(escolaId)).filter((linha) => linha['acao'] === 'convite.aceito')).toHaveLength(1)
  })

  it('concorrência: a mesma conta nova convidada por A e por B, aceitando os dois ao mesmo tempo com senhas diferentes, fica com uma senha só; o outro aceite vira entrar', async () => {
    const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
    const email = `convidada-${randomUUID()}@escola.invalid`
    const deA = await convidarEm(escolaA, new Date(), email)
    const deB = await convidarEm(escolaB, new Date(), email)
    expect(deB.contaId).toBe(deA.contaId)

    const [emA, emB] = await Promise.all([aceitar(deA.token, 'senha-escolhida-em-a-1'), aceitar(deB.token, 'senha-escolhida-em-b-2')])
    expect([emA.corpo['etapa'], emB.corpo['etapa']].sort()).toEqual(['configurar_mfa', 'entrar'])
    // O aceite que perdeu a corrida não define senha: devolve o bilhete, e aquele usuário espera o login.
    expect([emA, emB].find((resposta) => resposta.corpo['etapa'] === 'entrar')?.corpo['bilhete']).toEqual(expect.any(String))
    const senhaGravada = await senhaDaConta(deA.contaId)
    const valeA = await hash.verificar(senhaGravada, 'senha-escolhida-em-a-1')
    const valeB = await hash.verificar(senhaGravada, 'senha-escolhida-em-b-2')
    expect([valeA, valeB].filter(Boolean)).toHaveLength(1)
    // Só o usuário da escola cuja senha ficou é ativado no aceite; o outro espera o login.
    expect(await usuarioAtivo(deA.usuarioId)).toBe(valeA)
    expect(await usuarioAtivo(deB.usuarioId)).toBe(valeB)
  })

  it('borda: expirado (72 h + 1 s), revogado, já usado e inexistente dão a mesma resposta em consultar e em aceitar; 72 h menos um minuto ainda vale', async () => {
    // Uma escola por convite: com convite em aberto, a escola não recebe outro (A0b, a matriz da seção 5).
    const agora = Date.now()
    const expirado = await convidarEm(await bancada.escola(), new Date(agora - 72 * HORA_MS - 1_000))
    const quaseVencido = await convidarEm(await bancada.escola(), new Date(agora - 72 * HORA_MS + 60_000))
    const escolaId = await bancada.escola()
    const revogado = await convidarEm(escolaId, new Date(agora))
    const usado = await convidarEm(await bancada.escola(), new Date(agora))

    expect(await rodarRevogacao(revogado.conviteId)).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })
    expect((await aceitar(usado.token, SENHA_NOVA)).status).toBe(200)
    expect((await consultar(quaseVencido.token)).status).toBe(200)

    const tokens = { expirado: expirado.token, revogado: revogado.token, usado: usado.token, inexistente: randomBytes(32).toString('base64url') }
    for (const rota of ['consultar', 'aceitar'] as const) {
      const respostas = await Promise.all(Object.values(tokens).map((token) => (rota === 'consultar' ? consultar(token) : aceitar(token, SENHA_NOVA))))
      for (const resposta of respostas) {
        expect(resposta.status, rota).toBe(404)
        expect(resposta.corpo.erro?.codigo, rota).toBe(ErrorCode.NAO_ENCONTRADO)
        expect(semRequisicao(resposta), rota).toEqual(semRequisicao(respostas[0] as Resposta))
        expect(resposta.setCookie).toEqual([])
      }
    }
    // Nada mudou nos recusados: o expirado e o revogado seguem sem senha e inativos.
    for (const recusado of [expirado, revogado]) {
      expect(await usuarioAtivo(recusado.usuarioId)).toBe(false)
      expect(await senhaDaConta(recusado.contaId)).toBeNull()
    }
    expect((await auditoriaDoConvite(escolaId)).filter((linha) => linha['acao'] === 'convite.revogado')).toEqual([
      expect.objectContaining({ entidade_id: revogado.conviteId, autor_operador: OPERADOR, autor_usuario_id: null, depois: { tipo: 'coordenador' } }),
    ])
    // Revogar de novo, ou um id que não existe: NAO_ENCONTRADO, sem o id no terminal.
    const inexistente = randomUUID()
    expect(await rodarRevogacao(revogado.conviteId)).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO\n' })
    expect(await rodarRevogacao(inexistente)).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO\n' })
  })

  it('isolamento: e-mail que já coordena B, com convite de A: aceitar com senha não a troca e responde entrar; o login rotineiro sem o bilhete não ativa A; com o bilhete, a senha atual e o MFA, ativa', async () => {
    const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
    const pessoa = await coordenadoraDeB(escolaB)
    const convite = await convidarPeloComando(escolaA, pessoa.email)
    expect(convite.contaId).toBe(pessoa.contaId)
    const senhaAntes = await senhaDaConta(pessoa.contaId)

    const bilhete = await aceitarComConta(convite.token, SENHA_NOVA)
    expect(await senhaDaConta(pessoa.contaId)).toBe(senhaAntes)
    expect(await usuarioAtivo(convite.usuarioId)).toBe(false)
    // O convite foi usado: o mesmo link não serve de novo.
    expect((await aceitar(convite.token)).status).toBe(404)

    // A senha mandada no aceite não vale, nem com o bilhete.
    expect((await entrar(pessoa.email, SENHA_NOVA, bilhete)).status).toBe(401)
    // O login rotineiro da conta, sem o bilhete, entra só em B, mesmo depois do código: A continua inativo.
    const rotineiro = await entrar(pessoa.email, SENHA_DE_B)
    expect(rotineiro.corpo).toEqual({ etapa: 'mfa', desafio: expect.any(String) })
    const soEmB = await post('/v1/sessao/mfa', { codigo: codigoDoApp(pessoa.base32) }, { Authorization: `Bearer ${String(rotineiro.corpo['desafio'])}` })
    expect(soEmB.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(await usuarioAtivo(convite.usuarioId)).toBe(false)

    // Com o bilhete: a senha de B leva ao MFA, e A continua inativo até o código.
    const comBilhete = await entrar(pessoa.email, SENHA_DE_B, bilhete)
    expect(comBilhete.corpo).toEqual({ etapa: 'mfa', desafio: expect.any(String) })
    expect(await usuarioAtivo(convite.usuarioId)).toBe(false)
    const depoisDoCodigo = await post('/v1/sessao/mfa', { codigo: codigoDoApp(pessoa.base32, 1) }, { Authorization: `Bearer ${String(comBilhete.corpo['desafio'])}` })
    expect(depoisDoCodigo.corpo).toEqual({ etapa: 'escolher', desafio: expect.any(String), acessos: expect.any(Array) })
    expect(await usuarioAtivo(convite.usuarioId)).toBe(true)
    expect(await auditoriaDoConvite(escolaA)).toEqual([
      expect.objectContaining({ acao: 'convite.criado', autor_operador: OPERADOR, depois: { tipo: 'coordenador', usuarioId: convite.usuarioId, expiraEm: expect.any(String), contaNova: false } }),
      expect.objectContaining({ acao: 'convite.aceito', autor_usuario_id: convite.usuarioId, depois: { tipo: 'coordenador', usuarioId: convite.usuarioId, usuarioAtivo: false } }),
      {
        acao: 'usuario.ativado_por_convite',
        entidade: 'usuario',
        entidade_id: convite.usuarioId,
        autor_usuario_id: convite.usuarioId,
        autor_operador: null,
        antes: null,
        depois: { conviteId: convite.conviteId },
        finalidade: null,
      },
    ])
    // Nada do convite de A vai para a auditoria de B.
    expect(await auditoriaDoConvite(escolaB)).toEqual([])
  })

  it('isolamento: e-mail digitado errado pelo operador; a pessoa certa aceita o link, mas o bilhete dela no login de outra conta não ativa nada, e a dona do e-mail sem o bilhete também não', async () => {
    const [escolaA, escolaB, escolaC] = [await bancada.escola(), await bancada.escola(), await bancada.escola()]
    const donaDoEmail = await professoraDeB(escolaB)
    const pessoaCerta = await professoraDeB(escolaC)
    const convite = await convidarEm(escolaA, new Date(), donaDoEmail.email)
    const bilhete = await aceitarComConta(convite.token)

    // A pessoa certa entra na conta dela com o bilhete: entra em C, e A não é ativado.
    expect((await entrar(pessoaCerta.email, SENHA_DE_B, bilhete)).corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    // A dona do e-mail, no login rotineiro, entra em B, e A também não é ativado.
    expect((await entrar(donaDoEmail.email, SENHA_DE_B)).corpo['etapa']).toBe('pronta')
    // Bilhete forjado ou quebrado é ignorado: o login segue normal e não ativa nada.
    const forjado = `${bilhete.slice(0, -4)}AAAA`
    expect((await entrar(donaDoEmail.email, SENHA_DE_B, forjado)).corpo['etapa']).toBe('pronta')
    expect((await entrar(donaDoEmail.email, SENHA_DE_B, 'nao-e-um-jwt')).corpo['etapa']).toBe('pronta')
    expect(await usuarioAtivo(convite.usuarioId)).toBe(false)
    expect((await auditoriaDoConvite(escolaA)).filter((linha) => linha['acao'] === 'usuario.ativado_por_convite')).toEqual([])
    // O operador revoga, e o erro não vira acesso nem depois.
    expect(await rodarRevogacao(convite.conviteId)).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })
    expect((await entrar(donaDoEmail.email, SENHA_DE_B, bilhete)).corpo['etapa']).toBe('pronta')
    expect(await usuarioAtivo(convite.usuarioId)).toBe(false)
  })

  it('borda: conta sem MFA (professora de B) convidada a coordenar A é ativada logo depois da senha atual, uma vez só, mesmo com dois logins ao mesmo tempo', async () => {
    const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
    const pessoa = await professoraDeB(escolaB)
    const convite = await convidarEm(escolaA, new Date(), pessoa.email)
    const bilhete = await aceitarComConta(convite.token)

    const logins = await Promise.all([entrar(pessoa.email, SENHA_DE_B, bilhete), entrar(pessoa.email, SENHA_DE_B, bilhete)])
    for (const login of logins) expect(login.corpo).toEqual({ etapa: 'escolher', desafio: expect.any(String), acessos: expect.any(Array) })
    expect(await usuarioAtivo(convite.usuarioId)).toBe(true)
    expect((await auditoriaDoConvite(escolaA)).filter((linha) => linha['acao'] === 'usuario.ativado_por_convite')).toHaveLength(1)
  })

  it('borda: quem tem conta e abandona depois de entrar continua inativo em A; o login seguinte sem o bilhete não ativa; e o convite revogado depois do aceite não ativa nem com o bilhete', async () => {
    const [escolaA, escolaB, escolaC] = [await bancada.escola(), await bancada.escola(), await bancada.escola()]
    const pessoa = await professoraDeB(escolaB)
    const deA = await convidarEm(escolaA, new Date(), pessoa.email)
    const deC = await convidarEm(escolaC, new Date(), pessoa.email)
    await aceitarComConta(deA.token)
    const bilheteDeC = await aceitarComConta(deC.token)

    // Abandonou: nenhum login. Os dois continuam inativos, e B é a única escola ativa da conta.
    expect(await usuarioAtivo(deA.usuarioId)).toBe(false)
    expect(await usuarioAtivo(deC.usuarioId)).toBe(false)
    const { rows } = await bancada.pool.query<{ escola_id: string }>('select escola_id from usuario where conta_id = $1 and desativado_em is null', [pessoa.contaId])
    expect(rows.map((linha) => linha.escola_id)).toEqual([escolaB])

    // Depois, entra sem o bilhete de A, e com o de C já revogado: o login com a senha certa só entra em B.
    expect(await rodarRevogacao(deC.conviteId)).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })
    const login = await entrar(pessoa.email, SENHA_DE_B, bilheteDeC)
    expect(login.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(await usuarioAtivo(deA.usuarioId)).toBe(false)
    expect(await usuarioAtivo(deC.usuarioId)).toBe(false)
    const eu = (await (await fetch(`${url}/v1/eu`, { headers: { Authorization: `Bearer ${String(login.corpo['token'])}` } })).json()) as { escola: { id: string } }
    expect(eu.escola.id).toBe(escolaB)
  })

  it('borda: coordenador desativado depois de entrar não volta pelo convite antigo; o coordenador ativo dá CONFLITO; o operador o convida de novo, e com esse convite em aberto a escola não recebe outro', async () => {
    const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
    const pessoa = await professoraDeB(escolaB)
    const primeiro = await convidarEm(escolaA, new Date(), pessoa.email)
    const bilhete = await aceitarComConta(primeiro.token)
    expect((await entrar(pessoa.email, SENHA_DE_B, bilhete)).corpo['etapa']).toBe('escolher')
    expect(await usuarioAtivo(primeiro.usuarioId)).toBe(true)

    // Ativo: um convite novo para a mesma pessoa em A é recusado, sem nome nem e-mail no terminal.
    const arquivo = join(pasta, `convite-${randomUUID()}.txt`)
    const ativo = await rodarConvite(['--escola', await slugDe(escolaA), '--email', pessoa.email, '--nome', NOME_DO_CONVIDADO, '--saida', arquivo])
    expect(ativo).toEqual({ codigo: 1, saida: '', erro: 'CONFLITO: a escola já tem coordenação ativa ou convite em aberto; revogue o convite antes de gerar outro\n' })
    await expect(stat(arquivo)).rejects.toThrow()

    // Desativado depois de ter entrado: o convite antigo, usado, não o reativa no login, nem com o bilhete dele.
    await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [primeiro.usuarioId])
    expect((await entrar(pessoa.email, SENHA_DE_B, bilhete)).corpo['etapa']).toBe('pronta')
    expect(await usuarioAtivo(primeiro.usuarioId)).toBe(false)

    // A escola chama de volta (sem coordenação ativa): o mesmo usuário espera o convite novo, e o antigo, já usado, é
    // revogado. Com o convite novo em aberto, outro é recusado sem gravar nada; revogado ele, a escola recebe outro.
    const aberto = await convidarEm(escolaA, new Date(), pessoa.email)
    expect(aberto.usuarioId).toBe(primeiro.usuarioId)
    const recusado = await rodarConvite(['--escola', await slugDe(escolaA), '--email', pessoa.email, '--nome', NOME_DO_CONVIDADO, '--saida', join(pasta, `convite-${randomUUID()}.txt`)])
    expect(recusado.codigo).toBe(1)
    expect(recusado.erro).toMatch(/^CONFLITO: /)
    expect((await consultar(aberto.token)).status).toBe(200)
    expect(await rodarRevogacao(aberto.conviteId)).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })
    const novo = await convidarEm(escolaA, new Date(), pessoa.email)
    expect(novo.usuarioId).toBe(primeiro.usuarioId)
    expect((await consultar(aberto.token)).status).toBe(404)
    const bilheteNovo = await aceitarComConta(novo.token)
    expect((await entrar(pessoa.email, SENHA_DE_B, bilheteNovo)).corpo['etapa']).toBe('escolher')
    expect(await usuarioAtivo(primeiro.usuarioId)).toBe(true)
  })

  it('borda: conta nova sem senha no aceite é recusada com ENTRADA_INVALIDA e o convite continua valendo', async () => {
    const convite = await convidarEm(await bancada.escola(), new Date())
    const semSenha = await aceitar(convite.token)
    expect(semSenha.status).toBe(400)
    expect(semSenha.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
    expect(await usuarioAtivo(convite.usuarioId)).toBe(false)
    expect((await aceitar(convite.token, SENHA_NOVA)).corpo['etapa']).toBe('configurar_mfa')
  })

  it('borda (16.0): o corpo fora do contrato é ENTRADA_INVALIDA em consultar e em aceitar, antes de ler o convite, e o convite continua valendo', async () => {
    const convite = await convidarEm(await bancada.escola(), new Date())
    for (const caminho of ['/v1/convites/consultar', '/v1/convites/aceitar']) {
      for (const corpo of [{}, { token: 7 }, { token: '' }]) {
        const resposta = await post(caminho, corpo)
        expect(resposta.status, `${caminho} ${JSON.stringify(corpo)}`).toBe(400)
        expect(resposta.corpo.erro?.codigo, `${caminho} ${JSON.stringify(corpo)}`).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
    }
    expect(await usuarioAtivo(convite.usuarioId)).toBe(false)
    expect((await consultar(convite.token)).status).toBe(200)
  })

  it('privacidade (regra 20, item 4): consultar devolve só escolaNome, sem e-mail nem nome do convidado; aceitar só a etapa e o desafio', async () => {
    const convite = await convidarEm(await bancada.escola(), new Date())
    const consulta = await consultar(convite.token)
    expect(Object.keys(consulta.corpo)).toEqual(['escolaNome'])
    for (const proibido of [convite.email, NOME_DO_CONVIDADO, convite.usuarioId, convite.contaId, convite.token]) expect(consulta.texto).not.toContain(proibido)
    const aceite = await aceitar(convite.token, SENHA_NOVA)
    expect(Object.keys(aceite.corpo).sort()).toEqual(['desafio', 'etapa'])
    for (const proibido of [convite.email, NOME_DO_CONVIDADO, convite.usuarioId, convite.token, SENHA_NOVA]) expect(aceite.texto).not.toContain(proibido)
  })

  describe('permissão (RF1): o convite nasce só pelo operador, pelo comando ou pelo painel da operação', () => {
    it('fora do painel da operação, não existe rota que crie convite: as outras rotas com convite só consultam e aceitam, e POST /v1/convites responde 404 também ao coordenador', async () => {
      const express = app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }
      const rotas = express.router.stack.flatMap((camada) =>
        camada.route === undefined ? [] : Object.keys(camada.route.methods).map((metodo) => `${metodo.toUpperCase()} ${camada.route?.path ?? ''}`),
      )
      // A lista não pode sair vazia por mudança de versão do Express: aí o teste passaria sem olhar nada.
      expect(rotas).toContain('GET /saude')
      // As do convite do operador (A0, tarefa 5.0) também só consultam e aceitam: o convite dele nasce só pelo
      // `ops:operador`. As do painel (A0b) geram, refazem e revogam o convite da coordenação, e são `@RotaDeOperacao` (C41, C46).
      // As dos professores (A1, 3.0) refazem e revogam só o convite de professor (I7, `professores.int.test.ts`), e o
      // `POST /v1/professores`, que cadastra, só gera convite de professor: nenhuma delas alcança o de coordenação.
      expect(rotas.filter((rota) => /convite/i.test(rota)).sort()).toEqual([
        'POST /v1/convites/aceitar',
        'POST /v1/convites/consultar',
        'POST /v1/operacao/convite/aceitar',
        'POST /v1/operacao/convite/consultar',
        'POST /v1/operacao/convites/:id/refazer',
        'POST /v1/operacao/convites/:id/revogar',
        'POST /v1/operacao/escolas/:id/convite-coordenacao',
        'POST /v1/professores/:usuarioId/convite/refazer',
        'POST /v1/professores/:usuarioId/convite/revogar',
      ])

      const coordenacao = await bancada.escolaComSessao('coordenador')
      for (const caminho of ['/v1/convites', '/v1/convites/criar']) {
        const resposta = await post(caminho, { email: 'alguem@escola.invalid', nome: 'Alguém' }, { Authorization: `Bearer ${coordenacao.token}` })
        expect(resposta.status, caminho).toBe(404)
      }
    })

    it('ops:convite-coordenador recusa escola inexistente sem imprimir o e-mail, sem criar conta e sem deixar arquivo', async () => {
      const email = `ninguem-${randomUUID()}@escola.invalid`
      const arquivo = join(pasta, `convite-${randomUUID()}.txt`)
      const execucao = await rodarConvite(['--escola', `escola-que-nao-existe-${randomUUID().slice(0, 8)}`, '--email', email, '--nome', NOME_DO_CONVIDADO, '--saida', arquivo])
      expect(execucao).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: escola não encontrada\n' })
      expect(execucao.erro).not.toContain(email)
      const { rows } = await bancada.pool.query('select 1 from conta where email = $1', [email])
      expect(rows).toEqual([])
      await expect(stat(arquivo)).rejects.toThrow()
    })

    it('ops:convite-coordenador não sobrescreve um arquivo que já existe, e aí não grava nada no banco', async () => {
      const escolaId = await bancada.escola()
      const existente = await convidarPeloComando(escolaId)
      const conteudoAntes = await readFile(existente.arquivo, 'utf8')
      const email = `outra-${randomUUID()}@escola.invalid`
      const execucao = await rodarConvite(['--escola', await slugDe(escolaId), '--email', email, '--nome', NOME_DO_CONVIDADO, '--saida', existente.arquivo])
      expect(execucao.codigo).toBe(2)
      expect(execucao.saida).toBe('')
      expect(await readFile(existente.arquivo, 'utf8')).toBe(conteudoAntes)
      const { rows } = await bancada.pool.query('select 1 from conta where email = $1', [email])
      expect(rows).toEqual([])
    })
  })
})
