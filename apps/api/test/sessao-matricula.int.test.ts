import { METRICS } from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import type { Redis } from 'ioredis'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { CLIENTE_REDIS_LOGIN, HashDeSenha } from '../src/credencial/index.js'
import { chamar, comoAWebNo503, subirApi, type ApiDeTeste } from './test-api.js'
import { alunosNaTurma, montarEscolaComTurma } from './escola-turma.fixture.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SENHA_DE_A = 'senha-sintetica-da-escola-a'
const SENHA_DE_B = 'senha-sintetica-da-escola-b'
const SENHA_ERRADA = 'senha-sintetica-errada-7'
/** Alunos do teste da rajada: Enzo e mais 399 colegas atrás do mesmo IP (RF11). */
const COLEGAS_NA_RAJADA = 399
/** Logins em paralelo por onda na rajada: o pool de teste tem 10 conexões e 2 s de espera por uma. */
const LOGINS_POR_ONDA = 50

interface Resposta {
  status: number
  corpo: Record<string, unknown> & { erro?: { codigo?: string; mensagem?: string; requisicaoId?: string } }
  retryAfter: string | null
  setCookie: string[]
}

async function clientePronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 15_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

/** Uma matrícula que não aparece por acaso num log (letra e hexadecimal), para a busca no log ter sentido. */
function matriculaRara(): string {
  return `RA${randomBytes(6).toString('hex').toUpperCase()}`
}

describe('POST /v1/sessao/matricula: o aluno entra pelo endereço da escola com matrícula e senha', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  /** Matrículas raras e slugs digitados que passaram pelo login: nenhum pode aparecer no log. */
  const naoPodemIrAoLog = new Set<string>()
  let api: ApiDeTeste
  let hash: HashDeSenha
  let verificacoes: ReturnType<typeof vi.spyOn>
  let hashDeA: string
  let hashDeB: string

  beforeAll(async () => {
    // Quatro hashes ao mesmo tempo, as quatro threads do libuv que o processo do vitest tem: a rajada de 400 roda com a
    // vazão que tinha antes do semáforo (14.0). O semáforo com teto baixo tem prova própria (login-bulkhead.int.test.ts).
    api = await subirApi(medidor.medidor, { ambiente: { LOGIN_HASH_CONCORRENCIA: '4' } }, linhasDeLog)
    hash = api.app.get(HashDeSenha)
    verificacoes = vi.spyOn(hash, 'verificar')
    await clientePronto(api.app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }))
    hashDeA = await hash.gerar(SENHA_DE_A)
    hashDeB = await hash.gerar(SENHA_DE_B)
  })

  beforeEach(() => {
    verificacoes.mockClear()
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Uma escola nova e o endereço dela. */
  async function escola(): Promise<{ escolaId: string; slug: string }> {
    const escolaId = await bancada.escola()
    return { escolaId, slug: await bancada.slugDe(escolaId) }
  }

  async function aluno(escolaId: string, matricula: string, senhaHash = hashDeA): Promise<string> {
    const [usuarioId] = await bancada.alunosComMatricula(escolaId, [{ matricula, senhaHash }])
    if (usuarioId === undefined) throw new Error('aluno não criado')
    return usuarioId
  }

  async function entrar(corpo: unknown, cookie?: string): Promise<Resposta> {
    const resposta = await fetch(`${api.url}/v1/sessao/matricula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie === undefined ? {} : { Cookie: cookie }) },
      body: JSON.stringify(corpo),
    })
    const texto = await resposta.text()
    return { status: resposta.status, corpo: JSON.parse(texto) as Resposta['corpo'], retryAfter: resposta.headers.get('retry-after'), setCookie: resposta.headers.getSetCookie() }
  }

  const comSenha = (slug: string, matricula: string, senha = SENHA_DE_A, cookie?: string) => entrar({ slug, matricula, senha }, cookie)

  function valorDoCookie(linha: string): string {
    return linha.split(';')[0]?.split('=').slice(1).join('=') ?? ''
  }

  function cookieDe(resposta: Resposta, nome: string): string | undefined {
    return resposta.setCookie.find((linha) => linha.startsWith(`${nome}=`))
  }

  function semRequisicao(corpo: Resposta['corpo']): unknown {
    return { ...corpo, erro: { ...corpo.erro, requisicaoId: undefined } }
  }

  function esperarNaoAutenticado(resposta: Resposta): void {
    expect(resposta.status).toBe(401)
    expect(resposta.corpo).toEqual({ erro: { codigo: ErrorCode.NAO_AUTENTICADO, mensagem: MENSAGENS_DE_ERRO.NAO_AUTENTICADO, requisicaoId: expect.stringMatching(UUID) } })
    expect(resposta.setCookie).toEqual([])
  }

  function esperarSegurada(resposta: Resposta, retryAfter = 30): void {
    expect(resposta.status).toBe(429)
    expect(resposta.corpo).toEqual({ erro: { codigo: ErrorCode.CONTA_SEGURADA, mensagem: MENSAGENS_DE_ERRO.CONTA_SEGURADA, requisicaoId: expect.stringMatching(UUID) } })
    expect(Number(resposta.retryAfter)).toBeGreaterThan(retryAfter - 2)
    expect(Number(resposta.retryAfter)).toBeLessThanOrEqual(retryAfter)
    expect(resposta.setCookie).toEqual([])
  }

  async function eu(resposta: Resposta): Promise<Record<string, unknown>> {
    const lida = await chamar(api.url, 'GET', '/v1/eu', String(resposta.corpo['token']))
    expect(lida.status).toBe(200)
    return lida.corpo
  }

  async function contasSeguradas(): Promise<number> {
    return (await medidor.pontos(METRICS.contaSegurada)).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
  }

  it('caminho feliz (RF7): o aluno entra no slug da escola dele com um hash, recebe pronta, sessão de método matrícula sem conta, os dois cookies, o registro de acesso, e o /v1/eu devolve o usuário dele', async () => {
    const { escolaId, slug } = await escola()
    const matricula = matriculaRara()
    naoPodemIrAoLog.add(matricula).add(slug)
    const usuarioId = await aluno(escolaId, matricula)

    // Espaço nas pontas da matrícula e do slug não muda a conta.
    const resposta = await comSenha(` ${slug} `, ` ${matricula} `)
    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toEqual({ etapa: 'pronta', token: expect.any(String), expiraEm: expect.any(String) })
    expect(verificacoes).toHaveBeenCalledTimes(1)

    const sessao = cookieDe(resposta, 'educa_sessao') ?? ''
    expect(sessao.split('; ').slice(1).sort()).toEqual(['HttpOnly', 'Path=/v1/sessao', 'SameSite=Strict'])
    const dispositivo = cookieDe(resposta, 'educa_dispositivo') ?? ''
    expect(dispositivo.split('; ').slice(1).sort()).toEqual(['HttpOnly', 'Max-Age=2592000', 'Path=/v1/sessao', 'SameSite=Strict'])
    // O cookie de dispositivo leva só HMACs: nem a matrícula nem o slug.
    expect(dispositivo).not.toContain(matricula)
    expect(dispositivo).not.toContain(slug)

    const { rows: sessoes } = await bancada.pool.query<{ metodo: string; conta_id: string | null; refresh_hash: string; usuario_id: string }>(
      'select metodo, conta_id, refresh_hash, usuario_id from sessao where escola_id = $1',
      [escolaId],
    )
    expect(sessoes).toEqual([{ metodo: 'matricula', conta_id: null, refresh_hash: createHash('sha256').update(valorDoCookie(sessao)).digest('hex'), usuario_id: usuarioId }])
    const { rows: acessos } = await bancada.pool.query<{ evento: string; usuario_id: string }>('select evento, usuario_id from registro_acesso where escola_id = $1', [escolaId])
    expect(acessos).toEqual([{ evento: 'login', usuario_id: usuarioId }])

    const doAluno = await eu(resposta)
    expect(doAluno).toMatchObject({ usuarioId, papel: 'aluno', escola: { id: escolaId, slug }, inatividadeMin: 30 })
    // O contrato do /v1/eu não leva a matrícula nem nada da credencial.
    expect(Object.keys(doAluno).sort()).toEqual(['acessos', 'escola', 'inatividadeMin', 'introducaoVistaEm', 'nome', 'papel', 'usuarioId'])
    // O aluno não tem conta: nenhum outro acesso a listar.
    expect(doAluno['acessos']).toEqual([])
    expect(JSON.stringify(doAluno)).not.toContain(matricula)
  })

  it('isolamento (RF7, RF15): a matrícula 1234 existe em A e em B com senhas diferentes; cada aluno só entra no slug da própria escola, e a senha de um no slug do outro é recusada', async () => {
    const a = await escola()
    const b = await escola()
    const alunoDeA = await aluno(a.escolaId, '1234', hashDeA)
    const alunoDeB = await aluno(b.escolaId, '1234', hashDeB)

    const emA = await comSenha(a.slug, '1234', SENHA_DE_A)
    expect(emA.status).toBe(200)
    expect((await eu(emA))['usuarioId']).toBe(alunoDeA)
    const emB = await comSenha(b.slug, '1234', SENHA_DE_B)
    expect(emB.status).toBe(200)
    expect((await eu(emB))['usuarioId']).toBe(alunoDeB)

    esperarNaoAutenticado(await comSenha(b.slug, '1234', SENHA_DE_A))
    esperarNaoAutenticado(await comSenha(a.slug, '1234', SENHA_DE_B))
    const { rows } = await bancada.pool.query<{ escola_id: string; usuario_id: string }>('select escola_id, usuario_id from sessao where escola_id = any($1::uuid[]) order by id', [[a.escolaId, b.escolaId]])
    expect(rows).toEqual([
      { escola_id: a.escolaId, usuario_id: alunoDeA },
      { escola_id: b.escolaId, usuario_id: alunoDeB },
    ])
  })

  it('isolamento (RF11): cinco erros seguram a matrícula 1234 em A, e a 1234 de B continua entrando; o aluno de A fica segurado até com a senha certa', async () => {
    const a = await escola()
    const b = await escola()
    await aluno(a.escolaId, '1234', hashDeA)
    const alunoDeB = await aluno(b.escolaId, '1234', hashDeB)
    const seguradasAntes = await contasSeguradas()

    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comSenha(a.slug, '1234', SENHA_ERRADA))
    esperarSegurada(await comSenha(a.slug, '1234', SENHA_ERRADA))

    const emB = await comSenha(b.slug, '1234', SENHA_DE_B)
    expect(emB.status).toBe(200)
    expect((await eu(emB))['usuarioId']).toBe(alunoDeB)
    verificacoes.mockClear()
    esperarSegurada(await comSenha(a.slug, '1234', SENHA_DE_A))
    expect(verificacoes).not.toHaveBeenCalled()
    expect(await contasSeguradas()).toBe(seguradasAntes + 2)
  })

  it('privacidade (regra 20, item 6): slug inexistente, slug fora do formato, matrícula inexistente, aluno desativado e senha errada dão o mesmo status e o mesmo corpo, com um hash cada, e a falha na escola do slug fica no registro sem usuário', async () => {
    const { escolaId, slug } = await escola()
    const comSenhaErrada = matriculaRara()
    const desativada = matriculaRara()
    const inexistente = matriculaRara()
    const slugInexistente = `escola-que-nao-existe-${randomBytes(4).toString('hex')}`
    for (const valor of [comSenhaErrada, desativada, inexistente, slugInexistente, slug, 'Escola_Com_Formato_Errado']) naoPodemIrAoLog.add(valor)
    await aluno(escolaId, comSenhaErrada)
    const desativado = await aluno(escolaId, desativada)
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escolaId, desativado])

    const respostas: Resposta[] = []
    for (const [slugDigitado, matricula, senha] of [
      [slug, comSenhaErrada, SENHA_ERRADA],
      [slugInexistente, comSenhaErrada, SENHA_DE_A],
      ['Escola_Com_Formato_Errado', comSenhaErrada, SENHA_DE_A],
      [slug, inexistente, SENHA_DE_A],
      [slug, desativada, SENHA_DE_A],
    ] as const) {
      verificacoes.mockClear()
      respostas.push(await comSenha(slugDigitado, matricula, senha))
      // Um argon2 em cada caminho: o hash não diz se a escola ou a matrícula existem.
      expect(verificacoes, `${slugDigitado} ${matricula}`).toHaveBeenCalledTimes(1)
    }
    const [primeira, ...outras] = respostas
    if (primeira === undefined) throw new Error('sem respostas')
    esperarNaoAutenticado(primeira)
    for (const resposta of outras) {
      esperarNaoAutenticado(resposta)
      expect(semRequisicao(resposta.corpo)).toEqual(semRequisicao(primeira.corpo))
      expect(resposta.retryAfter).toBe(primeira.retryAfter)
    }
    const { rows } = await bancada.pool.query<{ evento: string; usuario_id: string | null }>('select evento, usuario_id from registro_acesso where escola_id = $1', [escolaId])
    expect(rows).toEqual(Array.from({ length: 3 }, () => ({ evento: 'login_falho', usuario_id: null })))
    const { rows: sessoes } = await bancada.pool.query('select 1 from sessao where escola_id = $1', [escolaId])
    expect(sessoes).toEqual([])
  })

  it('privacidade: o bloqueio também não revela nada: slug inexistente, matrícula inexistente e aluno desativado chegam a CONTA_SEGURADA na quinta falha, igual à matrícula que existe', async () => {
    const { escolaId, slug } = await escola()
    await aluno(escolaId, '1234')
    const desativado = await aluno(escolaId, '5678')
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escolaId, desativado])
    const slugInexistente = `escola-que-nao-existe-${randomBytes(4).toString('hex')}`
    // Todo slug inexistente conta na mesma "escola desconhecida": a matrícula dele é sorteada, para o contador não
    // trazer tentativas de outra execução.
    const naDesconhecida = matriculaRara()

    const sequencias = await Promise.all(
      [
        [slug, '1234'],
        [slug, '5678'],
        [slug, '9999'],
        [slugInexistente, naDesconhecida],
      ].map(async ([slugDigitado = '', matricula = '']) => {
        const respostas: Resposta[] = []
        for (let tentativa = 1; tentativa <= 6; tentativa++) respostas.push(await comSenha(slugDigitado, matricula, SENHA_ERRADA))
        return respostas
      }),
    )
    const [daExistente, ...dasOutras] = sequencias
    if (daExistente === undefined) throw new Error('sem respostas')
    for (const resposta of daExistente.slice(0, 4)) esperarNaoAutenticado(resposta)
    for (const resposta of daExistente.slice(4)) esperarSegurada(resposta)
    for (const sequencia of dasOutras) {
      expect(sequencia.map((resposta) => resposta.status)).toEqual(daExistente.map((resposta) => resposta.status))
      expect(sequencia.map((resposta) => semRequisicao(resposta.corpo))).toEqual(daExistente.map((resposta) => semRequisicao(resposta.corpo)))
      for (const [posicao, resposta] of sequencia.entries()) esperarRetryAfterProximo(resposta, daExistente[posicao])
    }
  })

  /** O `Retry-After` de duas sequências paralelas pode diferir em 1 s pelo arredondamento do que falta esperar. */
  function esperarRetryAfterProximo(resposta: Resposta, referencia: Resposta | undefined): void {
    if (referencia?.retryAfter === null || referencia === undefined) {
      expect(resposta.retryAfter).toBeNull()
      return
    }
    expect(Math.abs(Number(resposta.retryAfter) - Number(referencia.retryAfter))).toBeLessThanOrEqual(1)
  }

  it('borda (RF11, regra 80, item 1): 400 alunos do mesmo IP entram no mesmo minuto; Enzo, com 10 senhas erradas, fica segurado com CONTA_SEGURADA, e os 399 colegas entram sem 429', async () => {
    const { escolaId, slug } = await escola()
    const matriculas = Array.from({ length: COLEGAS_NA_RAJADA + 1 }, (_, posicao) => String(100_000 + posicao))
    const ids = await bancada.alunosComMatricula(
      escolaId,
      matriculas.map((matricula) => ({ matricula, senhaHash: hashDeA })),
    )
    const [matriculaDoEnzo, ...dosColegas] = matriculas
    if (matriculaDoEnzo === undefined) throw new Error('sem alunos')

    const doEnzo: Resposta[] = []
    for (let tentativa = 1; tentativa <= 10; tentativa++) doEnzo.push(await comSenha(slug, matriculaDoEnzo, SENHA_ERRADA))
    for (const resposta of doEnzo.slice(0, 4)) esperarNaoAutenticado(resposta)
    for (const resposta of doEnzo.slice(4)) expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.CONTA_SEGURADA)

    const inicio = performance.now()
    const respostas: Resposta[] = []
    for (let onda = 0; onda < matriculas.length; onda += LOGINS_POR_ONDA) {
      // Como a web: o 503 do semáforo do hash (14.0) é atraso, e o pedido volta depois do `Retry-After`.
      const tentativas = await Promise.all(matriculas.slice(onda, onda + LOGINS_POR_ONDA).map((matricula) => comoAWebNo503(() => comSenha(slug, matricula))))
      for (const { recusas } of tentativas) for (const recusa of recusas) expect(recusa.corpo.erro?.codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
      respostas.push(...tentativas.map(({ resposta }) => resposta))
    }
    expect(performance.now() - inicio).toBeLessThan(60_000)
    const [doEnzoNaRajada, ...dosColegasNaRajada] = respostas
    expect(doEnzoNaRajada?.status).toBe(429)
    expect(doEnzoNaRajada?.corpo.erro?.codigo).toBe(ErrorCode.CONTA_SEGURADA)
    expect(dosColegasNaRajada.map((resposta) => resposta.status)).toEqual(dosColegas.map(() => 200))
    const { rows } = await bancada.pool.query<{ usuario_id: string }>("select usuario_id from registro_acesso where escola_id = $1 and evento = 'login' and host(ip) = '127.0.0.1'", [escolaId])
    expect(new Set(rows.map((linha) => linha.usuario_id))).toEqual(new Set(ids.slice(1)))
  })

  it('concorrência (regra 80, item 7): dez senhas erradas ao mesmo tempo para a mesma matrícula avaliam no máximo cinco hashes', async () => {
    const { escolaId, slug } = await escola()
    await aluno(escolaId, '1234')
    const respostas = await Promise.all(Array.from({ length: 10 }, () => comSenha(slug, '1234', SENHA_ERRADA)))
    expect(verificacoes).toHaveBeenCalledTimes(5)
    expect(respostas.filter((resposta) => resposta.status === 401)).toHaveLength(4)
    const seguradas = respostas.filter((resposta) => resposta.status === 429)
    expect(seguradas).toHaveLength(6)
    for (const resposta of seguradas) expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.CONTA_SEGURADA)
  })

  it('borda: quem erra a senha em outro navegador segura só o contador dele; o aluno com o educa_dispositivo desta escola e matrícula continua entrando, e o cookie de outra escola não vale', async () => {
    const a = await escola()
    const b = await escola()
    await aluno(a.escolaId, '1234')
    await aluno(b.escolaId, '1234')
    const primeira = await comSenha(a.slug, '1234')
    expect(primeira.status).toBe(200)
    const dispositivoDeA = `educa_dispositivo=${valorDoCookie(cookieDe(primeira, 'educa_dispositivo') ?? '')}`

    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comSenha(b.slug, '1234', SENHA_ERRADA))
    esperarSegurada(await comSenha(b.slug, '1234', SENHA_ERRADA))
    // O cookie da 1234 de A não é o da 1234 de B: a entrada leva a escola.
    esperarSegurada(await comSenha(b.slug, '1234', SENHA_DE_A, dispositivoDeA))

    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comSenha(a.slug, '1234', SENHA_ERRADA))
    esperarSegurada(await comSenha(a.slug, '1234', SENHA_ERRADA))
    esperarSegurada(await comSenha(a.slug, '1234'))
    expect((await comSenha(a.slug, '1234', SENHA_DE_A, dispositivoDeA)).status).toBe(200)
  })

  it('borda: Chromebook do carrinho — o educa_dispositivo do aluno das 8h não torna conhecida a matrícula do aluno das 9h, e cada um entra no próprio usuário', async () => {
    const { escolaId, slug } = await escola()
    const [dasOito, dasNove] = await bancada.alunosComMatricula(escolaId, [
      { matricula: '1234', senhaHash: hashDeA },
      { matricula: '5678', senhaHash: hashDeB },
    ])
    const primeira = await comSenha(slug, '1234', SENHA_DE_A)
    expect((await eu(primeira))['usuarioId']).toBe(dasOito)
    const noCarrinho = `educa_dispositivo=${valorDoCookie(cookieDe(primeira, 'educa_dispositivo') ?? '')}`

    // Com o cookie das 8h, quem erra a senha da 5678 conta no contador `outro` dela, e segura.
    for (let tentativa = 1; tentativa <= 4; tentativa++) esperarNaoAutenticado(await comSenha(slug, '5678', SENHA_ERRADA, noCarrinho))
    esperarSegurada(await comSenha(slug, '5678', SENHA_ERRADA, noCarrinho))
    esperarSegurada(await comSenha(slug, '5678', SENHA_DE_B))
    // O aluno das 8h continua conhecido no mesmo navegador e entra no próprio usuário.
    expect((await eu(await comSenha(slug, '1234', SENHA_DE_A, noCarrinho)))['usuarioId']).toBe(dasOito)
    expect(dasNove).not.toBe(dasOito)
  })

  it('borda: aluno transferido — o usuário desativado em A é recusado com a resposta da senha errada, e a conta nova dele em B entra no slug de B', async () => {
    const a = await escola()
    const b = await escola()
    const antigo = await aluno(a.escolaId, '1234')
    const novo = await aluno(b.escolaId, '7788')
    expect((await comSenha(a.slug, '1234')).status).toBe(200)
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [a.escolaId, antigo])

    const senhaErrada = await comSenha(a.slug, '1234', SENHA_ERRADA)
    verificacoes.mockClear()
    const desativado = await comSenha(a.slug, '1234')
    expect(verificacoes).toHaveBeenCalledTimes(1)
    esperarNaoAutenticado(desativado)
    expect(semRequisicao(desativado.corpo)).toEqual(semRequisicao(senhaErrada.corpo))

    const naNova = await comSenha(b.slug, '7788')
    expect(naNova.status).toBe(200)
    expect((await eu(naNova))['usuarioId']).toBe(novo)
  })

  it('borda: dois "Enzo Martins" na mesma turma, com matrículas diferentes, recebem cada um o próprio usuário no /v1/eu', async () => {
    const turma = await montarEscolaComTurma(api, bancada)
    const escolaId = turma.coordenacao.escolaId
    const slug = await bancada.slugDe(escolaId)
    const [primeiro, segundo] = await bancada.alunosComMatricula(escolaId, [
      { matricula: '2026001', senhaHash: hashDeA },
      { matricula: '2026002', senhaHash: hashDeB },
    ])
    if (primeiro === undefined || segundo === undefined) throw new Error('alunos não criados')
    for (const id of [primeiro, segundo]) {
      await bancada.pool.query("update usuario set nome = 'Enzo Martins' where escola_id = $1 and id = $2", [escolaId, id])
      await bancada.pool.query(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
        [escolaId, turma.anoLetivoId, id, turma.turma, turma.coordenacao.usuarioId],
      )
    }

    const doPrimeiro = await eu(await comSenha(slug, '2026001', SENHA_DE_A))
    const doSegundo = await eu(await comSenha(slug, '2026002', SENHA_DE_B))
    expect(doPrimeiro).toMatchObject({ usuarioId: primeiro, nome: 'Enzo Martins' })
    expect(doSegundo).toMatchObject({ usuarioId: segundo, nome: 'Enzo Martins' })
    // A senha de um não abre a matrícula do outro, mesmo com o mesmo nome.
    esperarNaoAutenticado(await comSenha(slug, '2026001', SENHA_DE_B))
  })

  it('borda (RF13): a coordenação de A muda a inatividade do aluno para 15 min; o aluno de A vence com 20 min sem atividade, e o de B continua com os 30 min', async () => {
    const a = await escola()
    const b = await escola()
    await aluno(a.escolaId, '1234')
    await aluno(b.escolaId, '1234')
    const coordenacaoDeA = await bancada.sessao(a.escolaId, 'coordenador')
    expect((await chamar(api.url, 'PUT', '/v1/escola/sessao', coordenacaoDeA.token, { inatividadeAlunoMin: 15, inatividadeEquipeMin: 120 })).status).toBe(200)

    const deA = await comSenha(a.slug, '1234')
    const deB = await comSenha(b.slug, '1234')
    expect(await eu(deA)).toMatchObject({ inatividadeMin: 15 })
    expect(await eu(deB)).toMatchObject({ inatividadeMin: 30 })
    const semUsoHa = (minutos: number) =>
      bancada.pool.query("update sessao set ultimo_uso_em = now() - make_interval(mins => $2) where escola_id = any($1::uuid[]) and metodo = 'matricula'", [[a.escolaId, b.escolaId], minutos])
    // Com 17 min, o aluno de A ainda está nos 15 + 5 de tolerância.
    await semUsoHa(17)
    expect((await chamar(api.url, 'GET', '/v1/eu', String(deA.corpo['token']))).status).toBe(200)
    await semUsoHa(20)

    const vencida = await chamar(api.url, 'GET', '/v1/eu', String(deA.corpo['token']))
    expect(vencida.status).toBe(401)
    expect(vencida.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect((await chamar(api.url, 'GET', '/v1/eu', String(deB.corpo['token']))).status).toBe(200)
  })

  it('permissão: a sessão do aluno não lê a turma dele nem a lista de alunos (404 igual ao inexistente)', async () => {
    const turma = await montarEscolaComTurma(api, bancada)
    const escolaId = turma.coordenacao.escolaId
    await alunosNaTurma(bancada, turma, turma.turma, 2)
    const [alunoId] = await bancada.alunosComMatricula(escolaId, [{ matricula: '1234', senhaHash: hashDeA }])
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
      [escolaId, turma.anoLetivoId, alunoId, turma.turma, turma.coordenacao.usuarioId],
    )
    const token = String((await comSenha(await bancada.slugDe(escolaId), '1234')).corpo['token'])
    for (const caminho of [`/v1/turmas/${turma.turma}/alunos?finalidade=acompanhamento_pedagogico`, `/v1/turmas/${turma.turma}`, `/v1/turmas/${randomUUID()}/alunos`]) {
      const resposta = await chamar(api.url, 'GET', caminho, token)
      expect(resposta.status, caminho).toBe(404)
      expect(resposta.corpo.erro?.codigo, caminho).toBe(ErrorCode.NAO_ENCONTRADO)
      expect(JSON.stringify(resposta.corpo), caminho).not.toContain('Aluno sintético')
    }
  })

  it('entrada fora do contrato é recusada antes de qualquer hash, inclusive com a escola no corpo', async () => {
    const { slug } = await escola()
    for (const corpo of [
      { slug, matricula: '1234' },
      { slug, matricula: '', senha: 'x' },
      { slug, matricula: '1'.repeat(41), senha: 'x' },
      { slug, matricula: '1234', senha: 'x', escolaId: randomUUID() },
      { matricula: '1234', senha: 'x' },
    ]) {
      const resposta = await entrar(corpo)
      expect(resposta.status).toBe(400)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
    }
    expect(verificacoes).not.toHaveBeenCalled()
  })

  it('o corpo fora do contrato não gasta tentativa da matrícula nem grava registro_acesso: seis pedidos inválidos com a matrícula dela, e a senha certa entra', async () => {
    const { escolaId, slug } = await escola()
    await aluno(escolaId, '5521')
    const invalidos = [
      { slug, matricula: '5521', senha: '' },
      { slug, matricula: '5521' },
      { slug, matricula: '5521', senha: SENHA_DE_A, escolaId },
      { slug, matricula: 5521, senha: SENHA_DE_A },
      { slug: '', matricula: '5521', senha: SENHA_DE_A },
      { slug: 's'.repeat(64), matricula: '5521', senha: SENHA_DE_A },
    ]
    for (const corpo of invalidos) {
      const resposta = await entrar(corpo)
      expect(resposta.status).toBe(400)
      expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      expect(resposta.setCookie).toEqual([])
    }
    const { rows } = await bancada.pool.query<{ total: string }>('select count(*) as total from registro_acesso where escola_id = $1', [escolaId])
    expect(Number(rows[0]?.total)).toBe(0)
    expect(verificacoes).not.toHaveBeenCalled()
    expect((await comSenha(slug, '5521')).status).toBe(200)
  })

  it('privacidade (regra 20, item 9): o log do login, depois de tudo acima, não tem matrícula nem slug digitado', () => {
    const log = linhasDeLog.join('\n')
    expect(log).toContain('http.erro')
    expect(naoPodemIrAoLog.size).toBeGreaterThanOrEqual(5)
    for (const valor of naoPodemIrAoLog) expect(log.includes(valor), 'uma matrícula ou um slug digitado apareceu no log').toBe(false)
    expect(log).not.toMatch(/escola-que-nao-existe/)
  })
})
