import 'reflect-metadata'
import { createLogger, RateLimiter, METRICS, observeInsuranceLimiter } from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO, type PapelDeUsuario } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { Redis } from 'ioredis'
import { createHash, randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { aguardarSaudavel, composeOuFalha } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configure-app.js'
import { CLIENTE_REDIS_LOGIN, ContadorDeTentativas, HashDeSenha } from '../src/credencial/index.js'
import { comoAWebNo503 } from './test-api.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './test-config.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SENHA = 'senha-sintetica-correta-1'
const SENHA_ERRADA = 'senha-sintetica-errada-9'

interface Resposta {
  status: number
  corpo: Record<string, unknown> & { erro?: { codigo?: string; mensagem?: string; requisicaoId?: string } }
  retryAfter: string | null
  setCookie: string[]
}

interface Pessoa {
  email: string
  contaId: string
  usuarioId: string
  escolaId: string
}

async function clientePronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 15_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

describe('POST /v1/sessao/email: a equipe entra por e-mail e senha', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  /** Tudo que foi mandado ou recebido e não pode aparecer no log: e-mails, senhas, cookies e desafios. */
  const segredosVistos = new Set<string>([SENHA, SENHA_ERRADA])
  let app: INestApplication
  let url: string
  let hash: HashDeSenha
  let verificacoes: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    app = await NestFactory.create(AppModule.com(configuracaoDeTeste(), { medidor: medidor.medidor, ...MONTAGEM_DE_TESTE }), { logger: false })
    configurarAplicacao(app, createLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => linhasDeLog.push(linha) } }), medidor.medidor)
    await app.listen(0, '127.0.0.1')
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
    hash = app.get(HashDeSenha)
    verificacoes = vi.spyOn(hash, 'verificar')
    await clientePronto(app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }))
  })

  beforeEach(() => {
    verificacoes.mockClear()
  })

  afterAll(async () => {
    await app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Uma conta com senha e um usuário ativo na escola, com o papel pedido. */
  async function pessoa(escolaId: string, papel: PapelDeUsuario = 'professor', { senha = SENHA as string | null } = {}): Promise<Pessoa> {
    const email = `Equipe-${randomUUID()}@Escola.invalid`
    segredosVistos.add(email).add(email.toLowerCase())
    const senhaHash = senha === null ? null : await hash.gerar(senha)
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, senhaHash])
    const contaId = contas[0]?.id ?? ''
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
    return { email, contaId, usuarioId: usuarios[0]?.id ?? '', escolaId }
  }

  async function entrar(corpo: unknown, cookie?: string, base = url): Promise<Resposta> {
    const resposta = await fetch(`${base}/v1/sessao/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie === undefined ? {} : { Cookie: cookie }) },
      body: JSON.stringify(corpo),
    })
    const setCookie = resposta.headers.getSetCookie()
    for (const linha of setCookie) segredosVistos.add(valorDoCookie(linha))
    const lido = (await resposta.json()) as Resposta['corpo']
    if (typeof lido['desafio'] === 'string') segredosVistos.add(lido['desafio'])
    if (typeof lido['token'] === 'string') segredosVistos.add(lido['token'])
    return { status: resposta.status, corpo: lido, retryAfter: resposta.headers.get('retry-after'), setCookie }
  }

  const comSenha = (email: string, senha = SENHA, cookie?: string) => entrar({ email, senha }, cookie)

  function valorDoCookie(linha: string): string {
    return linha.split(';')[0]?.split('=').slice(1).join('=') ?? ''
  }

  function cookieDe(resposta: Resposta, nome: string): string | undefined {
    return resposta.setCookie.find((linha) => linha.startsWith(`${nome}=`))
  }

  /** O corpo de erro sem o `requisicaoId`, que muda a cada requisição. */
  function semRequisicao(corpo: Resposta['corpo']): unknown {
    return { ...corpo, erro: { ...corpo.erro, requisicaoId: undefined } }
  }

  function esperarNaoAutenticado(resposta: Resposta): void {
    expect(resposta.status).toBe(401)
    expect(resposta.corpo).toEqual({ erro: { codigo: ErrorCode.NAO_AUTENTICADO, mensagem: MENSAGENS_DE_ERRO.NAO_AUTENTICADO, requisicaoId: expect.stringMatching(UUID) } })
    expect(resposta.setCookie).toEqual([])
  }

  function esperarSegurada(resposta: Resposta, retryAfter: number): void {
    expect(resposta.status).toBe(429)
    expect(resposta.corpo).toEqual({ erro: { codigo: ErrorCode.CONTA_SEGURADA, mensagem: MENSAGENS_DE_ERRO.CONTA_SEGURADA, requisicaoId: expect.stringMatching(UUID) } })
    expect(Number(resposta.retryAfter)).toBeGreaterThan(retryAfter - 2)
    expect(Number(resposta.retryAfter)).toBeLessThanOrEqual(retryAfter)
    expect(resposta.setCookie).toEqual([])
  }

  async function contasSeguradas(): Promise<number> {
    return (await medidor.pontos(METRICS.contaSegurada)).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
  }

  async function falhasSemEscola(): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: string }>("select count(*) as total from registro_acesso where escola_id is null and evento = 'login_falho' and usuario_id is null")
    return Number(rows[0]?.total)
  }

  it('caminho feliz: o professor entra, recebe pronta, o token e educa_sessao; o /v1/eu devolve o contrato; e o login fica no registro de acesso', async () => {
    const escolaId = await bancada.escola()
    const professor = await pessoa(escolaId)
    // O e-mail com outra caixa e espaço nas pontas é a mesma conta.
    const resposta = await comSenha(`  ${professor.email.toUpperCase()} `)
    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(verificacoes).toHaveBeenCalledTimes(1)

    const sessao = cookieDe(resposta, 'educa_sessao') ?? ''
    expect(sessao.split('; ').slice(1).sort()).toEqual(['HttpOnly', 'Path=/v1/sessao', 'SameSite=Strict'])
    const dispositivo = cookieDe(resposta, 'educa_dispositivo') ?? ''
    expect(dispositivo.split('; ').slice(1).sort()).toEqual(['HttpOnly', 'Max-Age=2592000', 'Path=/v1/sessao', 'SameSite=Strict'])

    const { rows: sessoes } = await bancada.pool.query<{ metodo: string; refresh_hash: string; conta_id: string; horas: string; familia: string | null }>(
      "select metodo, refresh_hash, conta_id, familia, round(extract(epoch from expira_em - now()) / 3600) as horas from sessao where escola_id = $1 and usuario_id = $2",
      [escolaId, professor.usuarioId],
    )
    expect(sessoes).toEqual([{ metodo: 'email', refresh_hash: createHash('sha256').update(valorDoCookie(sessao)).digest('hex'), conta_id: professor.contaId, familia: expect.stringMatching(UUID), horas: '12' }])

    const eu = await fetch(`${url}/v1/eu`, { headers: { Authorization: `Bearer ${String(resposta.corpo['token'])}` } })
    expect(eu.status).toBe(200)
    expect(eu.headers.get('cache-control')).toBe('no-store')
    const { rows: escolas } = await bancada.pool.query<{ nome: string; slug: string; rede: string }>(
      'select escola.nome, escola.slug, rede.nome as rede from escola join rede on rede.id = escola.rede_id where escola.id = $1',
      [escolaId],
    )
    expect(await eu.json()).toEqual({
      usuarioId: professor.usuarioId,
      papel: 'professor',
      nome: 'Pessoa sintética',
      escola: { id: escolaId, nome: escolas[0]?.nome, slug: escolas[0]?.slug },
      inatividadeMin: 120,
      introducaoVistaEm: null,
      acessos: [{ usuarioId: professor.usuarioId, escolaNome: escolas[0]?.nome, redeNome: escolas[0]?.rede, papel: 'professor' }],
    })

    const { rows: acessos } = await bancada.pool.query<{ evento: string; ip: string }>('select evento, host(ip) as ip from registro_acesso where escola_id = $1 and usuario_id = $2', [escolaId, professor.usuarioId])
    expect(acessos).toEqual([{ evento: 'login', ip: '127.0.0.1' }])
  })

  it('privacidade: senha errada, e-mail que não existe, conta sem senha e usuário desativado respondem igual, com um hash cada, e gravam a falha sem escola', async () => {
    const escolaId = await bancada.escola()
    const comSenhaErrada = await pessoa(escolaId)
    const semSenha = await pessoa(escolaId, 'professor', { senha: null })
    const desativado = await pessoa(escolaId)
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escolaId, desativado.usuarioId])
    const inexistente = `ninguem-${randomUUID()}@escola.invalid`
    segredosVistos.add(inexistente)
    const falhasAntes = await falhasSemEscola()

    const respostas: Resposta[] = []
    for (const [email, senha] of [
      [comSenhaErrada.email, SENHA_ERRADA],
      [inexistente, SENHA],
      [semSenha.email, SENHA],
      [desativado.email, SENHA],
    ] as const) {
      verificacoes.mockClear()
      respostas.push(await comSenha(email, senha))
      // Um argon2 em cada caminho: o tempo não diz se a conta existe.
      expect(verificacoes, email).toHaveBeenCalledTimes(1)
    }
    for (const resposta of respostas) esperarNaoAutenticado(resposta)
    const [primeira, ...outras] = respostas
    for (const resposta of outras) {
      expect(resposta.status).toBe(primeira?.status)
      expect(semRequisicao(resposta.corpo)).toEqual(semRequisicao(primeira?.corpo ?? {}))
      expect(resposta.retryAfter).toBe(primeira?.retryAfter)
    }
    expect(await falhasSemEscola()).toBe(falhasAntes + 4)
    const { rows } = await bancada.pool.query('select 1 from sessao where escola_id = $1', [escolaId])
    expect(rows).toEqual([])
  })

  it('borda: a quinta falha segura a conta por 30 s, com CONTA_SEGURADA e Retry-After, e nem a senha certa passa sem conferir o hash', async () => {
    const professor = await pessoa(await bancada.escola())
    const seguradasAntes = await contasSeguradas()
    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comSenha(professor.email, SENHA_ERRADA))
    esperarSegurada(await comSenha(professor.email, SENHA_ERRADA), 30)
    verificacoes.mockClear()
    esperarSegurada(await comSenha(professor.email, SENHA), 30)
    expect(verificacoes).not.toHaveBeenCalled()
    expect(await contasSeguradas()).toBe(seguradasAntes + 2)
  })

  it('privacidade: o bloqueio também não revela a conta: e-mail inexistente e usuário desativado chegam a CONTA_SEGURADA na quinta falha, igual à conta que existe', async () => {
    const escolaId = await bancada.escola()
    const existente = await pessoa(escolaId)
    const desativado = await pessoa(escolaId)
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escolaId, desativado.usuarioId])
    const inexistente = `ninguem-${randomUUID()}@escola.invalid`
    segredosVistos.add(inexistente)

    const sequencias = await Promise.all(
      [existente.email, desativado.email, inexistente].map(async (email) => {
        const respostas: Resposta[] = []
        for (let tentativa = 1; tentativa <= 6; tentativa++) respostas.push(await comSenha(email, SENHA_ERRADA))
        return respostas
      }),
    )
    const [daExistente, ...dasOutras] = sequencias
    if (daExistente === undefined) throw new Error('sem respostas')
    for (const resposta of daExistente.slice(0, 4)) esperarNaoAutenticado(resposta)
    for (const resposta of daExistente.slice(4)) esperarSegurada(resposta, 30)
    for (const sequencia of dasOutras) {
      expect(sequencia.map((resposta) => resposta.status)).toEqual(daExistente.map((resposta) => resposta.status))
      expect(sequencia.map((resposta) => semRequisicao(resposta.corpo))).toEqual(daExistente.map((resposta) => semRequisicao(resposta.corpo)))
      expect(sequencia.map((resposta) => resposta.retryAfter)).toEqual(daExistente.map((resposta) => resposta.retryAfter))
    }
  })

  it('permissão: aluno não entra por e-mail e senha, nem com a senha certa; a conta com professor e aluno entra como professor, e o usuário desativado em outra escola não conta', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    // O banco aceita aluno com conta (o check só exige conta de quem não é aluno): o login é que não o aceita.
    const soAluno = await pessoa(escolaA, 'aluno')
    const falhasAntes = await falhasSemEscola()
    verificacoes.mockClear()
    esperarNaoAutenticado(await comSenha(soAluno.email))
    expect(verificacoes).toHaveBeenCalledTimes(1)
    expect(await falhasSemEscola()).toBe(falhasAntes + 1)
    const { rows: sessoesDoAluno } = await bancada.pool.query('select 1 from sessao where escola_id = $1 and usuario_id = $2', [escolaA, soAluno.usuarioId])
    expect(sessoesDoAluno).toEqual([])

    const professorEAluno = await pessoa(escolaA)
    await bancada.pool.query("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'aluno', 'Pessoa sintética')", [escolaB, professorEAluno.contaId])
    const { rows: desativadoEmB } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'professor', 'Pessoa sintética', now()) returning id",
      [escolaB, professorEAluno.contaId],
    )
    const resposta = await comSenha(professorEAluno.email)
    expect(resposta.status).toBe(200)
    expect(resposta.corpo['etapa']).toBe('pronta')
    const { rows: sessoes } = await bancada.pool.query<{ escola_id: string; usuario_id: string }>('select escola_id, usuario_id from sessao where conta_id = $1', [professorEAluno.contaId])
    expect(sessoes).toEqual([{ escola_id: escolaA, usuario_id: professorEAluno.usuarioId }])
    expect(desativadoEmB).toHaveLength(1)
  })

  it('borda: o acerto zera o contador: quatro erros, um acerto, e mais quatro erros não seguram', async () => {
    const professor = await pessoa(await bancada.escola())
    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comSenha(professor.email, SENHA_ERRADA))
    expect((await comSenha(professor.email)).status).toBe(200)
    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comSenha(professor.email, SENHA_ERRADA))
    expect((await comSenha(professor.email)).status).toBe(200)
  })

  it('concorrência: dez senhas erradas ao mesmo tempo avaliam cinco hashes, e as outras cinco já encontram a conta segurada', async () => {
    const professor = await pessoa(await bancada.escola())
    const respostas = await Promise.all(Array.from({ length: 10 }, () => comSenha(professor.email, SENHA_ERRADA)))
    expect(verificacoes).toHaveBeenCalledTimes(5)
    expect(respostas.filter((resposta) => resposta.status === 401)).toHaveLength(4)
    const seguradas = respostas.filter((resposta) => resposta.status === 429)
    expect(seguradas).toHaveLength(6)
    for (const resposta of seguradas) expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.CONTA_SEGURADA)
  })

  it('borda: o script que erra a senha em outro navegador segura só o contador dele; a professora com o educa_dispositivo continua entrando', async () => {
    const professor = await pessoa(await bancada.escola())
    const primeira = await comSenha(professor.email)
    expect(primeira.status).toBe(200)
    const dispositivo = `educa_dispositivo=${valorDoCookie(cookieDe(primeira, 'educa_dispositivo') ?? '')}`

    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comSenha(professor.email, SENHA_ERRADA))
    esperarSegurada(await comSenha(professor.email, SENHA_ERRADA), 30)
    // Sem o cookie, nem com a senha certa: quem não tem o navegador dela não passa.
    esperarSegurada(await comSenha(professor.email), 30)
    // Com o cookie de uma chave que não é a do servidor, também não.
    esperarSegurada(await comSenha(professor.email, SENHA, 'educa_dispositivo=1.AAAAAAAAAAAAAAAAAAAAAA:zzzzzz'), 30)

    const doComputadorDela = await comSenha(professor.email, SENHA, dispositivo)
    expect(doComputadorDela.status).toBe(200)
    expect(doComputadorDela.corpo['etapa']).toBe('pronta')
  })

  it('borda (RF11, regra 80): 35 professores do mesmo IP entram no mesmo minuto, e só quem errou a senha cinco vezes fica segurado', async () => {
    const escolaId = await bancada.escola()
    const professores = await Promise.all(Array.from({ length: 35 }, () => pessoa(escolaId)))
    const [esquecido] = professores
    if (esquecido === undefined) throw new Error('professores não criados')
    for (let tentativa = 1; tentativa <= 5; tentativa++) await comSenha(esquecido.email, SENHA_ERRADA)

    const inicio = performance.now()
    // Como a web: o 503 do semáforo do hash (14.0) é atraso, e o pedido volta depois do `Retry-After`.
    const tentativas = await Promise.all(professores.map((professor) => comoAWebNo503(() => comSenha(professor.email))))
    const respostas = tentativas.map(({ resposta }) => resposta)
    expect(performance.now() - inicio).toBeLessThan(60_000)
    for (const { recusas } of tentativas) for (const recusa of recusas) expect(recusa.corpo.erro?.codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    esperarSegurada(respostas[0] ?? ({} as Resposta), 30)
    expect(respostas.slice(1).map((resposta) => resposta.status)).toEqual(Array.from({ length: 34 }, () => 200))
    const { rows } = await bancada.pool.query<{ total: string }>("select count(*) as total from registro_acesso where escola_id = $1 and evento = 'login' and host(ip) = '127.0.0.1'", [escolaId])
    expect(Number(rows[0]?.total)).toBe(34)
  })

  it('borda: conta com usuário em A e em B recebe escolher, e coordenador recebe o MFA; nenhum grava sessão, educa_sessao nem educa_dispositivo', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const emDuas = await pessoa(escolaA)
    await bancada.pool.query("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Pessoa sintética')", [escolaB, emDuas.contaId])
    const coordenadorSemMfa = await pessoa(escolaA, 'coordenador')
    const coordenadorComMfa = await pessoa(escolaB, 'coordenador')
    await bancada.pool.query('update conta set mfa_ativado_em = now() where id = $1', [coordenadorComMfa.contaId])

    for (const [email, etapa] of [
      [emDuas.email, 'escolher'],
      [coordenadorSemMfa.email, 'configurar_mfa'],
      [coordenadorComMfa.email, 'mfa'],
    ] as const) {
      const resposta = await comSenha(email)
      expect(resposta.status, etapa).toBe(200)
      // Só `escolher` leva a lista de acessos: é ela que a tela da escolha mostra (20.0), e o segundo fator não
      // precisa de lista nenhuma.
      expect(resposta.corpo, etapa).toEqual(etapa === 'escolher' ? { etapa, desafio: expect.any(String), acessos: expect.any(Array) } : { etapa, desafio: expect.any(String) })
      // O login ainda não terminou: nem sessão, nem a marca de navegador conhecido (quem tem só a senha do
      // coordenador não ganha o `educa_dispositivo` sem o segundo fator).
      expect(resposta.setCookie, etapa).toEqual([])
    }
    const { rows } = await bancada.pool.query('select 1 from sessao where escola_id = any($1::uuid[])', [[escolaA, escolaB]])
    expect(rows).toEqual([])
    const { rows: acessos } = await bancada.pool.query("select 1 from registro_acesso where escola_id = any($1::uuid[]) and evento = 'login'", [[escolaA, escolaB]])
    expect(acessos).toEqual([])
  })

  it('permissão: o desafio usado como Bearer no /v1/eu é recusado como sessão inválida', async () => {
    const coordenador = await pessoa(await bancada.escola(), 'coordenador')
    const resposta = await comSenha(coordenador.email)
    expect(resposta.corpo['etapa']).toBe('configurar_mfa')
    const eu = await fetch(`${url}/v1/eu`, { headers: { Authorization: `Bearer ${String(resposta.corpo['desafio'])}` } })
    expect(eu.status).toBe(401)
    expect(((await eu.json()) as Resposta['corpo']).erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
  })

  it('borda: o banco aceita login_falho sem escola, e recusa login sem escola e falha com usuário sem escola', async () => {
    await bancada.pool.query("insert into registro_acesso (escola_id, usuario_id, evento, ip) values (null, null, 'login_falho', '10.9.9.9')")
    await expect(bancada.pool.query("insert into registro_acesso (escola_id, usuario_id, evento, ip) values (null, $1, 'login', '10.9.9.9')", [randomUUID()])).rejects.toMatchObject({ code: '23514' })
    await expect(bancada.pool.query("insert into registro_acesso (escola_id, usuario_id, evento, ip) values (null, null, 'login', '10.9.9.9')")).rejects.toMatchObject({ code: '23514' })
    await expect(bancada.pool.query("insert into registro_acesso (escola_id, usuario_id, evento, ip) values (null, $1, 'login_falho', '10.9.9.9')", [randomUUID()])).rejects.toMatchObject({ code: '23514' })
  })

  it('entrada fora do contrato é recusada antes de qualquer hash', async () => {
    for (const corpo of [{ email: 'a@b.invalid' }, { email: 'a@b.invalid', senha: '' }, { email: 'a@b.invalid', senha: 'x', escolaId: randomUUID() }, { email: 'a@b.invalid', senha: 'x'.repeat(1_025) }]) {
      const resposta = await entrar(corpo)
      expect(resposta.status).toBe(400)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
    }
    expect(verificacoes).not.toHaveBeenCalled()
  })

  it('o corpo fora do contrato não gasta tentativa da conta nem grava registro_acesso: seis pedidos inválidos com o e-mail dela, e a senha certa entra', async () => {
    const professor = await pessoa(await bancada.escola())
    const invalidos = [{ email: professor.email, senha: '' }, { email: professor.email }, { email: professor.email, senha: SENHA, escolaId: professor.escolaId }, { email: professor.email, senha: 7 }, { email: '', senha: SENHA }, {}]
    for (const corpo of invalidos) {
      const resposta = await entrar(corpo)
      expect(resposta.status).toBe(400)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(resposta.setCookie).toEqual([])
    }
    const { rows: antes } = await bancada.pool.query<{ total: string }>('select count(*) as total from registro_acesso where escola_id = $1', [professor.escolaId])
    expect(Number(antes[0]?.total)).toBe(0)
    expect(verificacoes).not.toHaveBeenCalled()
    // Seis erros de formato valeriam seis falhas de senha, e a quinta segura a conta: a senha certa ainda entra.
    expect((await comSenha(professor.email)).status).toBe(200)
  })

  it('falha: com o Redis de fila fora, o contador em memória segura a conta, limite.seguro_ativo vai a 1, e quem tem a senha certa entra', async () => {
    // Uma instância só para este caso: a proporção do seguro é da janela de 30 s da instância, e nesta nenhuma
    // tentativa foi contada pelo Redis antes de ele cair.
    const medidorDaQueda = new MedidorDeTeste()
    const instancia = await NestFactory.create(AppModule.com(configuracaoDeTeste(), { medidor: medidorDaQueda.medidor }), { logger: false })
    configurarAplicacao(instancia, createLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => linhasDeLog.push(linha) } }), medidorDaQueda.medidor)
    await instancia.listen(0, '127.0.0.1')
    const urlDaQueda = `http://127.0.0.1:${(instancia.getHttpServer().address() as AddressInfo).port}`
    const cliente = instancia.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false })
    await clientePronto(cliente)
    observeInsuranceLimiter(medidorDaQueda.medidor, instancia.get(RateLimiter), instancia.get(ContadorDeTentativas))
    const escolaId = await bancada.escola()
    const [professor, colega] = [await pessoa(escolaId), await pessoa(escolaId)]
    const naQueda = (email: string, senha = SENHA) => entrar({ email, senha }, undefined, urlDaQueda)
    composeOuFalha('stop', 'redis-fila')
    try {
      const prazo = performance.now() + 10_000
      while (cliente.status === 'ready' && performance.now() < prazo) await new Promise((resolver) => setTimeout(resolver, 20))
      expect(cliente.status).not.toBe('ready')
      for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await naQueda(professor.email, SENHA_ERRADA))
      esperarSegurada(await naQueda(professor.email, SENHA_ERRADA), 30)
      esperarSegurada(await naQueda(professor.email), 30)
      expect(instancia.get(ContadorDeTentativas).proporcaoDoSeguro).toBe(1)
      expect((await medidorDaQueda.pontos(METRICS.seguroAtivo)).map((ponto) => ponto.valor)).toEqual([1])
      expect((await naQueda(colega.email)).status).toBe(200)
    } finally {
      composeOuFalha('start', 'redis-fila')
      await aguardarSaudavel('redis-fila')
      await instancia.close()
      await medidorDaQueda.encerrar()
    }
  })

  it('privacidade: o log do caminho de login, depois de tudo acima e dos erros, não tem e-mail, senha, cookie, token nem desafio (o redact das chaves é provado em logger.test.ts)', () => {
    const log = linhasDeLog.join('\n')
    expect(log).toContain('http.erro')
    expect(segredosVistos.size).toBeGreaterThan(40)
    for (const segredo of segredosVistos) if (segredo !== '') expect(log.includes(segredo), 'um valor secreto apareceu no log').toBe(false)
    expect(log).not.toMatch(/@escola\.invalid/i)
  })
})
