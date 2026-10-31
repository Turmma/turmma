import { RateLimiter, METRICS, observeInsuranceLimiter, TIMEOUT_COMANDO_REDIS_API_MS, TIMEOUT_COMANDO_REDIS_FILA_MS } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import type { Redis } from 'ioredis'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { composeOuFalha, aguardarSaudavel } from '../../../tools/testes/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { travarRedis } from '../../../tools/testes/redis-travado.ts'
import { CLIENTE_REDIS_LOGIN, ConsumoDeDesafio, ContadorDeTentativas, ContadorEmJanela, EmissorDeDesafio, HashDeSenha, PREFIXO_FALHAS_POR_IP_NA_ESCOLA, SeguroDoLogin, SemaforoDeHash, verificarDesafio } from '../src/credencial/index.js'
import { ESCOLA_DESCONHECIDA } from '../src/sessao/index.js'
import { comoAWebNo503, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

const SENHA = 'senha-sintetica-do-ataque-1'
const SENHA_ERRADA = 'senha-sintetica-errada-do-ataque'
/**
 * Um hash por vez, e a borda de confiança no próprio teste: com o hash de um login segurado pelo teste, os outros
 * esperam a vez, e a ordem em que o semáforo os atende é a ordem das chamadas ao hash. O `X-Forwarded-For` escolhe o IP
 * de cada pedido, como a borda faria.
 */
const AMBIENTE_DO_ATAQUE = { LOGIN_HASH_CONCORRENCIA: '1', LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1', LIMITE_REQ_IP_ANONIMO_MIN: '150' }
/** O limite por IP das rotas anônimas nesta API: baixo, para o teste passar dele sem milhares de pedidos. */
const LIMITE_ANONIMO_POR_IP = Number(AMBIENTE_DO_ATAQUE.LIMITE_REQ_IP_ANONIMO_MIN)
/** O limite por IP da rota de e-mail do ambiente de teste (o do `.env.example`). */
const LIMITE_EMAIL_POR_IP = configuracaoDeTeste().login.limiteEmailPorIpMin

interface Resposta {
  status: number
  corpo: Record<string, unknown> & { erro?: { codigo?: string } }
  retryAfter: string | null
  setCookie: string[]
}

interface Origem {
  readonly ip: string
  /** O `educa_dispositivo` que o navegador mandaria, já como `nome=valor`. */
  readonly cookie?: string
}

async function clientePronto(cliente: Redis, pronto = true): Promise<void> {
  const prazo = performance.now() + 15_000
  while ((cliente.status === 'ready') !== pronto) {
    if (performance.now() > prazo) throw new Error(`o cliente do Redis de fila do login não ficou ${pronto ? 'pronto' : 'fora'}`)
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

/** Um IP da faixa de documentação, sorteado: o contador de uma execução anterior não conta para esta. */
function ipSorteado(): string {
  return `2001:db8:15:${randomBytes(2).toString('hex')}::${randomBytes(2).toString('hex')}`
}

function matriculaRara(): string {
  return `RA${randomBytes(6).toString('hex').toUpperCase()}`
}

/** O `educa_dispositivo` do `Set-Cookie`, como o navegador mandaria de volta. */
function cookieDeDispositivo(resposta: Resposta): string {
  const linha = resposta.setCookie.find((valor) => valor.startsWith('educa_dispositivo='))
  if (linha === undefined) throw new Error('a resposta não trouxe educa_dispositivo')
  return linha.split(';')[0] ?? ''
}

describe('ataque de senha nunca bloqueia a escola: rebaixa, por IP e escola, e quem já entrou naquele navegador mantém a vez', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let semaforo: SemaforoDeHash
  let hash: HashDeSenha
  let verificacoes: MockInstance<HashDeSenha['verificar']>
  let verificarReal: HashDeSenha['verificar']
  let hashDaSenha: string
  /** Tudo que identifica pessoa, origem ou navegador e passou pelo login: nada disso vira rótulo, log ou linha no banco. */
  const naoPodemAparecer = new Set<string>()
  const cookiesVistos = new Set<string>()

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE_DO_ATAQUE }, linhasDeLog)
    semaforo = api.app.get(SemaforoDeHash)
    hash = api.app.get(HashDeSenha)
    verificarReal = hash.verificar.bind(hash)
    verificacoes = vi.spyOn(hash, 'verificar')
    await clientePronto(api.app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }))
    hashDaSenha = await hash.gerar(SENHA)
  })

  /** O hash segurado que o teste ainda não soltou: se ele quebrar no meio, o `afterEach` solta, e a API fecha. */
  let soltarPendente: (() => void) | undefined

  beforeEach(() => {
    verificacoes.mockClear()
  })

  afterEach(() => {
    soltarPendente?.()
    soltarPendente = undefined
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  async function lerResposta(resposta: Response): Promise<Resposta> {
    const texto = await resposta.text()
    const lida = {
      status: resposta.status,
      corpo: texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo']),
      retryAfter: resposta.headers.get('retry-after'),
      setCookie: resposta.headers.getSetCookie(),
    }
    for (const linha of lida.setCookie) if (linha.startsWith('educa_dispositivo=')) cookiesVistos.add(linha.split(';')[0]?.slice('educa_dispositivo='.length) ?? '')
    return lida
  }

  function cabecalhos(origem: Origem): Record<string, string> {
    naoPodemAparecer.add(origem.ip)
    return { 'Content-Type': 'application/json', 'X-Forwarded-For': origem.ip, ...(origem.cookie === undefined ? {} : { Cookie: origem.cookie }) }
  }

  async function porMatricula(slug: string, matricula: string, senha: string, origem: Origem): Promise<Resposta> {
    naoPodemAparecer.add(matricula)
    const resposta = await fetch(`${api.url}/v1/sessao/matricula`, { method: 'POST', headers: cabecalhos(origem), body: JSON.stringify({ slug, matricula, senha }) })
    return lerResposta(resposta)
  }

  async function porEmail(email: string, senha: string, origem: Origem): Promise<Resposta> {
    naoPodemAparecer.add(email)
    const resposta = await fetch(`${api.url}/v1/sessao/email`, { method: 'POST', headers: cabecalhos(origem), body: JSON.stringify({ email, senha }) })
    return lerResposta(resposta)
  }

  async function escola(): Promise<{ escolaId: string; slug: string }> {
    const escolaId = await bancada.escola()
    return { escolaId, slug: await bancada.slugDe(escolaId) }
  }

  /** Alunos com matrícula e a senha dada (a comum, se nada for dito). */
  async function alunos(escolaId: string, quantidade: number, senhaHash = hashDaSenha): Promise<string[]> {
    const matriculas = Array.from({ length: quantidade }, () => matriculaRara())
    const ids = await bancada.alunosComMatricula(
      escolaId,
      matriculas.map((matricula) => ({ matricula, senhaHash })),
    )
    for (const id of ids) naoPodemAparecer.add(id)
    return matriculas
  }

  /** Um aluno com senha própria: a ordem em que o semáforo atende é lida pela senha que chega ao hash. */
  async function alunoComSenha(escolaId: string, senha: string): Promise<string> {
    const [matricula] = await alunos(escolaId, 1, await hash.gerar(senha))
    if (matricula === undefined) throw new Error('aluno não criado')
    return matricula
  }

  /** Um professor com conta e senha na escola. */
  async function professor(escolaId: string): Promise<string> {
    const email = `ataque-${randomUUID()}@escola.invalid`
    const { rows } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, hashDaSenha])
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Pessoa sintética') returning id", [
      escolaId,
      rows[0]?.id,
    ])
    naoPodemAparecer.add(usuarios[0]?.id ?? '')
    return email
  }

  /** `quantidade` falhas de um IP na escola, com matrículas que não existem, uma de cada vez: nenhuma conta chega a ser segurada. */
  async function falhasNaEscola(slug: string, ip: string, quantidade: number): Promise<Resposta[]> {
    const respostas: Resposta[] = []
    for (let falha = 0; falha < quantidade; falha++) respostas.push(await porMatricula(slug, matriculaRara(), SENHA_ERRADA, { ip }))
    return respostas
  }

  /**
   * O próximo hash só termina quando o teste soltar: o login que chegar a ele fica com a única vez, e os outros esperam.
   * Devolve quando esse login já está no hash.
   */
  async function segurarAVez(): Promise<{ soltar: () => Promise<void> }> {
    let liberar: () => void = () => undefined
    const portao = new Promise<void>((resolver) => (liberar = resolver))
    soltarPendente = liberar
    // Daqui em diante, a primeira chamada ao hash é a do login que segura a vez.
    verificacoes.mockClear()
    verificacoes.mockImplementationOnce(async (guardado, senha) => {
      await portao
      return verificarReal(guardado, senha)
    })
    const { escolaId, slug } = await escola()
    const [daVez] = await alunos(escolaId, 1)
    const comAVez = porMatricula(slug, daVez ?? '', SENHA, { ip: ipSorteado() })
    await vi.waitFor(() => expect(verificacoes).toHaveBeenCalledTimes(1))
    return {
      soltar: async () => {
        liberar()
        expect((await comAVez).status).toBe(200)
      },
    }
  }

  /** Espera o semáforo ter `quantidade` pedidos na fila: é a ordem de chegada, que o teste controla. */
  async function naFila(quantidade: number): Promise<void> {
    await vi.waitFor(() => expect(semaforo.esperando).toBe(quantidade), { timeout: 5_000 })
  }

  /** As senhas que chegaram ao hash, na ordem, sem a do login que segurou a vez. */
  function ordemDoHash(): string[] {
    return verificacoes.mock.calls.slice(1).map(([, senha]) => senha)
  }

  async function serieRebaixadaDa(escolaId: string, deQual = medidor): Promise<number | undefined> {
    const ponto = (await deQual.pontos(METRICS.prioridadeRebaixada)).find(({ atributos }) => atributos['escola_id'] === escolaId)
    return typeof ponto?.valor === 'number' ? ponto.valor : undefined
  }

  async function falhasDe(rotulo: string): Promise<number> {
    const ponto = (await medidor.pontos(METRICS.falhasDeLogin)).find(({ atributos }) => atributos['escola_id'] === rotulo)
    return typeof ponto?.valor === 'number' ? ponto.valor : 0
  }

  async function rebaixadasNoEmail(): Promise<number> {
    const [ponto] = await medidor.pontos(METRICS.limiteEmailIp)
    return typeof ponto?.valor === 'number' ? ponto.valor : Number.NaN
  }

  /** `login.rebaixado_ip` (16.5): as tentativas rebaixadas pelo limite por IP das rotas de login, sem rótulo. */
  async function rebaixadasPeloIp(): Promise<number> {
    const pontos = await medidor.pontos(METRICS.rebaixadoPorIp)
    expect(pontos.map((ponto) => ponto.atributos)).toEqual([{}])
    const [ponto] = pontos
    return typeof ponto?.valor === 'number' ? ponto.valor : Number.NaN
  }

  it('caminho feliz sob ataque (regra 80, item 1): um IP passa o limiar na A com matrículas diferentes; a série da A vai a 1, as falhas contam na A, e nenhum pedido desse IP recebe 429', async () => {
    const a = await escola()
    const ip = ipSorteado()
    const falhasAntes = await falhasDe(a.escolaId)

    // Até 100 falhas por minuto o IP não é rebaixado: é o piso do limiar, e a escola tem poucos alunos.
    const ate100 = await falhasNaEscola(a.slug, ip, 100)
    expect(await serieRebaixadaDa(a.escolaId)).toBeUndefined()
    const depois = await falhasNaEscola(a.slug, ip, 10)

    expect([...ate100, ...depois].map(({ status }) => status)).toEqual(Array.from({ length: 110 }, () => 401))
    expect(await serieRebaixadaDa(a.escolaId)).toBe(1)
    expect((await falhasDe(a.escolaId)) - falhasAntes).toBe(110)
  }, 60_000)

  it('borda (passagem pelo cookie): com a A rebaixada para o IP do ataque, a aluna que já entrou naquele navegador, chegando por último, é atendida antes das tentativas rebaixadas; o colega sem cookie espera o fim do balde e entra também', async () => {
    const a = await escola()
    const ip = ipSorteado()
    const senhaDaAluna = 'senha-sintetica-da-aluna-com-cookie'
    const senhaDoColega = 'senha-sintetica-do-colega-sem-cookie'
    const aluna = await alunoComSenha(a.escolaId, senhaDaAluna)
    const colega = await alunoComSenha(a.escolaId, senhaDoColega)
    // A aluna entrou neste Chromebook ontem, pela rede da escola: o navegador guardou o educa_dispositivo.
    const ontem = await porMatricula(a.slug, aluna, senhaDaAluna, { ip })
    expect(ontem.status).toBe(200)
    const cookie = cookieDeDispositivo(ontem)
    await falhasNaEscola(a.slug, ip, 105)

    const vez = await segurarAVez()
    const doAtaque = [1, 2, 3].map((numero) => porMatricula(a.slug, matriculaRara(), `senha-sintetica-do-ataque-${String(numero)}`, { ip }))
    const doColega = porMatricula(a.slug, colega, senhaDoColega, { ip })
    // O script no Chromebook dela, com o cookie dela, varrendo outra matrícula: o cookie vale só para a matrícula dela.
    const comOCookieDela = porMatricula(a.slug, matriculaRara(), 'senha-sintetica-do-ataque-com-o-cookie-dela', { ip, cookie })
    await naFila(5)
    const daAluna = porMatricula(a.slug, aluna, senhaDaAluna, { ip, cookie })
    await naFila(6)
    await vez.soltar()

    const [daAlunaRespondeu, doColegaRespondeu, doAtaqueRespondeu] = await Promise.all([daAluna, doColega, Promise.all([...doAtaque, comOCookieDela])])
    // Ela chegou por último e foi a primeira: os outros cinco, do mesmo IP e sem o cookie daquela matrícula, estavam no
    // fim do balde.
    const ordem = ordemDoHash()
    expect(ordem[0]).toBe(senhaDaAluna)
    expect(ordem.slice(1).sort()).toEqual(
      [senhaDoColega, 'senha-sintetica-do-ataque-1', 'senha-sintetica-do-ataque-2', 'senha-sintetica-do-ataque-3', 'senha-sintetica-do-ataque-com-o-cookie-dela'].sort(),
    )
    expect(daAlunaRespondeu.status).toBe(200)
    // Rebaixar não é recusar: o colega sem cookie, do IP do ataque, também entra, e o ataque recebe a senha errada.
    expect(doColegaRespondeu.status).toBe(200)
    expect(doAtaqueRespondeu.map(({ status }) => status)).toEqual([401, 401, 401, 401])
  }, 60_000)

  it('isolamento: com a A rebaixada para um IP, os logins da B pelo mesmo IP seguem com prioridade normal (na ordem de chegada), e a série da B não sai de 0', async () => {
    const a = await escola()
    const b = await escola()
    const ip = ipSorteado()
    const [doIpDoAtaque, deOutroIp] = await alunos(b.escolaId, 2)
    await falhasNaEscola(a.slug, ip, 105)
    expect(await serieRebaixadaDa(a.escolaId)).toBe(1)
    // A B também erra por aquele IP, e o contador dela anda: a leitura acontece, e dá abaixo do limiar dela.
    expect((await porMatricula(b.slug, matriculaRara(), SENHA_ERRADA, { ip })).status).toBe(401)

    const vez = await segurarAVez()
    const primeiro = porMatricula(b.slug, doIpDoAtaque ?? '', 'senha-sintetica-da-b-pelo-ip-do-ataque', { ip })
    await naFila(1)
    const segundo = porMatricula(b.slug, deOutroIp ?? '', 'senha-sintetica-da-b-por-outro-ip', { ip: ipSorteado() })
    await naFila(2)
    await vez.soltar()

    const respostas = await Promise.all([primeiro, segundo])
    // Se o contador não levasse a escola, o IP do ataque estaria rebaixado na B também, e o segundo passaria na frente.
    expect(ordemDoHash()).toEqual(['senha-sintetica-da-b-pelo-ip-do-ataque', 'senha-sintetica-da-b-por-outro-ip'])
    expect(respostas.map(({ status }) => status)).toEqual([401, 401])
    expect(await serieRebaixadaDa(b.escolaId)).toBeUndefined()
  }, 60_000)

  it('borda (regra 80, item 1): acima do limite por IP das rotas de login, nada recebe 429; a tentativa vai para o fim do balde, quem traz o cookie passa na frente, e a página de acesso da escola, pelo mesmo IP, segue respondendo', async () => {
    const a = await escola()
    const ip = ipSorteado()
    const senhaDaAluna = 'senha-sintetica-da-aluna-do-limite-anonimo'
    const aluna = await alunoComSenha(a.escolaId, senhaDaAluna)
    const [colega] = await alunos(a.escolaId, 1)

    // A aluna entra pelo IP da escola até ele passar do limite por IP das rotas anônimas, sem nenhuma falha: nada aqui é
    // rebaixamento por senha errada.
    const entradas = []
    for (let entrada = 0; entrada < LIMITE_ANONIMO_POR_IP; entrada++) entradas.push(await porMatricula(a.slug, aluna, senhaDaAluna, { ip }))
    expect(new Set(entradas.map(({ status }) => status))).toEqual(new Set([200]))
    const cookie = cookieDeDispositivo(entradas.at(-1) ?? { status: 0, corpo: {}, retryAfter: null, setCookie: [] })
    const rebaixadasPeloIpAntes = await rebaixadasPeloIp()

    // A página de acesso da escola, anônima e pelo mesmo IP, não perdeu nada: o login conta num balde próprio.
    const acesso = await fetch(`${api.url}/v1/escolas/${a.slug}/acesso`, { headers: { 'X-Forwarded-For': ip } })
    expect(acesso.status).toBe(200)

    const vez = await segurarAVez()
    const doColega = porMatricula(a.slug, colega ?? '', SENHA, { ip })
    await naFila(1)
    const daAluna = porMatricula(a.slug, aluna, senhaDaAluna, { ip, cookie })
    await naFila(2)
    await vez.soltar()
    const respostas = await Promise.all([daAluna, doColega])

    // O colega, sem cookie e acima do limite do IP, foi para o fim; a aluna, com o cookie, chegou depois e passou.
    expect(ordemDoHash()).toEqual([senhaDaAluna, SENHA])
    expect(respostas.map(({ status }) => status)).toEqual([200, 200])
    // E não foi o rebaixamento por falhas: a escola não tem série. O limite do IP tem a série dele (16.5), que contou só o
    // colega: a aluna com o cookie não foi rebaixada.
    expect(await serieRebaixadaDa(a.escolaId)).toBeUndefined()
    expect(await rebaixadasPeloIp()).toBe(rebaixadasPeloIpAntes + 1)
  }, 60_000)

  it('borda (rede municipal acima do limite do IP do login): no e-mail, o IP de saída da rede passa do limite por IP das rotas de login antes do limite da rota vezes as escolas; a tentativa sem cookie vai para o fim, o professor com o cookie passa na frente, e nada recebe 429', async () => {
    const daRede = ipSorteado()
    const [escolaDaRede] = await bancada.redeComEscolas(3, [daRede])
    const email = await professor(escolaDaRede ?? '')
    // O professor entrou ontem, pelo IP da rede, neste computador.
    const ontem = await porEmail(email, SENHA, { ip: daRede })
    expect(ontem.status).toBe(200)
    const cookie = cookieDeDispositivo(ontem)
    // A equipe das três escolas (sem conta, aqui) leva o IP até o limite do login (150), abaixo do limite da rota (180):
    // a entrada do professor, acima, foi a 1ª das 150 nos dois contadores, e por isso o laço começa em 1.
    const daEquipe = []
    for (let tentativa = 1; tentativa < LIMITE_ANONIMO_POR_IP; tentativa++) daEquipe.push((await porEmail(`equipe-${randomUUID()}@escola.invalid`, SENHA_ERRADA, { ip: daRede })).status)
    expect(new Set(daEquipe)).toEqual(new Set([401]))
    const rebaixadasAntes = await rebaixadasNoEmail()
    const rebaixadasPeloIpAntes = await rebaixadasPeloIp()

    const vez = await segurarAVez()
    const semCookie = porEmail(`equipe-${randomUUID()}@escola.invalid`, 'senha-sintetica-da-equipe-sem-cookie', { ip: daRede })
    await naFila(1)
    const doProfessor = porEmail(email, SENHA, { ip: daRede, cookie })
    await naFila(2)
    await vez.soltar()
    const [semCookieRespondeu, doProfessorRespondeu] = await Promise.all([semCookie, doProfessor])

    // Chegou depois e passou: o pedido sem cookie foi para o fim pelo limite do IP do login, e não pelo da rota (que, com
    // as três escolas, ainda não tinha passado), porque a métrica da rota não andou.
    expect(ordemDoHash()).toEqual([SENHA, 'senha-sintetica-da-equipe-sem-cookie'])
    expect([doProfessorRespondeu.status, semCookieRespondeu.status]).toEqual([200, 401])
    expect(await rebaixadasNoEmail()).toBe(rebaixadasAntes)
    // Quem conta é a série do limite por IP do login (16.5), uma vez, pela tentativa sem cookie.
    expect(await rebaixadasPeloIp()).toBe(rebaixadasPeloIpAntes + 1)
  }, 60_000)

  it('borda (primeiros dias de aula): numa escola de 400 alunos, 160 logins no primeiro minuto pelo IP da escola, com 30% errando a senha uma vez, não passam do limiar; a série fica em 0 e todos entram', async () => {
    const w = await escola()
    const ip = ipSorteado()
    const turma = await alunos(w.escolaId, 400)
    const falhasAntes = await falhasDe(w.escolaId)
    // A rajada das 7h30 tem 40% dos logins no primeiro minuto: 160 dos 400, e 30% deles (48) erram a senha uma vez.
    const doPrimeiroMinuto = turma.slice(0, 160)
    const erramUmaVez = new Set(doPrimeiroMinuto.slice(0, 48))
    const entrar = async (matricula: string) => {
      if (erramUmaVez.has(matricula)) expect((await comoAWebNo503(() => porMatricula(w.slug, matricula, SENHA_ERRADA, { ip }))).resposta.status).toBe(401)
      return (await comoAWebNo503(() => porMatricula(w.slug, matricula, SENHA, { ip }))).resposta.status
    }
    const status: number[] = []
    for (let inicio = 0; inicio < doPrimeiroMinuto.length; inicio += 20) status.push(...(await Promise.all(doPrimeiroMinuto.slice(inicio, inicio + 20).map(entrar))))

    expect(status).toEqual(Array.from({ length: 160 }, () => 200))
    expect((await falhasDe(w.escolaId)) - falhasAntes).toBe(48)
    expect(await serieRebaixadaDa(w.escolaId)).toBeUndefined()
  }, 120_000)

  it('borda (rede municipal atrás de um IP): o IP de saída de uma rede com três escolas tem 180 tentativas por minuto no e-mail; a 181ª é rebaixada, e nenhuma é recusada; o IP de fora da rede, na 61ª', async () => {
    const daRede = ipSorteado()
    const deFora = ipSorteado()
    await bancada.redeComEscolas(3, [daRede])
    const semConta = () => `ninguem-${randomUUID()}@escola.invalid`
    const equipeAntes = await falhasDe('equipe')

    const antes = await rebaixadasNoEmail()
    const daRedeAte180 = []
    for (let tentativa = 0; tentativa < 3 * LIMITE_EMAIL_POR_IP; tentativa++) daRedeAte180.push((await porEmail(semConta(), SENHA_ERRADA, { ip: daRede })).status)
    expect(await rebaixadasNoEmail()).toBe(antes)
    const daRede181 = await porEmail(semConta(), SENHA_ERRADA, { ip: daRede })
    expect(await rebaixadasNoEmail()).toBe(antes + 1)

    const deForaAte60 = []
    for (let tentativa = 0; tentativa < LIMITE_EMAIL_POR_IP; tentativa++) deForaAte60.push((await porEmail(semConta(), SENHA_ERRADA, { ip: deFora })).status)
    expect(await rebaixadasNoEmail()).toBe(antes + 1)
    const deFora61 = await porEmail(semConta(), SENHA_ERRADA, { ip: deFora })
    expect(await rebaixadasNoEmail()).toBe(antes + 2)

    // Rebaixar não é recusar: todas saem com a senha errada de sempre, nenhuma com 429.
    expect(new Set([...daRedeAte180, daRede181.status, ...deForaAte60, deFora61.status])).toEqual(new Set([401]))
    // As falhas por e-mail contam no rótulo da equipe, sem escola.
    expect((await falhasDe('equipe')) - equipeAntes).toBe(3 * LIMITE_EMAIL_POR_IP + LIMITE_EMAIL_POR_IP + 2)
  }, 120_000)

  it('borda (aluno com script não tranca a equipe): o script errando a senha do professor em outro navegador segura só o contador `outro`; o professor, com o próprio cookie e do mesmo IP acima do limite, entra e passa na frente do script', async () => {
    const { escolaId } = await escola()
    const email = await professor(escolaId)
    const ip = ipSorteado()
    // O professor entrou ontem neste computador: o navegador guardou o educa_dispositivo da conta.
    const ontem = await porEmail(email, SENHA, { ip })
    expect(ontem.status).toBe(200)
    const cookie = cookieDeDispositivo(ontem)

    // O script, no computador da sala, erra a senha dele até a conta ser segurada para o `outro`, e varre e-mails até o
    // IP passar do limite da rota.
    const doScript = []
    for (let tentativa = 0; tentativa < 6; tentativa++) doScript.push((await porEmail(email, SENHA_ERRADA, { ip })).status)
    expect(doScript).toEqual([401, 401, 401, 401, 429, 429])
    for (let tentativa = 0; tentativa < LIMITE_EMAIL_POR_IP; tentativa++) await porEmail(`varredura-${randomUUID()}@escola.invalid`, SENHA_ERRADA, { ip })
    const rebaixadasAntes = await rebaixadasNoEmail()

    const vez = await segurarAVez()
    const doAtaque = [1, 2, 3].map((numero) => porEmail(`varredura-${randomUUID()}@escola.invalid`, `senha-sintetica-do-script-${String(numero)}`, { ip }))
    await naFila(3)
    const doProfessor = porEmail(email, SENHA, { ip, cookie })
    await naFila(4)
    await vez.soltar()
    const [doProfessorRespondeu, doAtaqueRespondeu] = await Promise.all([doProfessor, Promise.all(doAtaque)])

    expect(ordemDoHash()[0]).toBe(SENHA)
    expect(ordemDoHash()).toHaveLength(4)
    expect(doProfessorRespondeu.status).toBe(200)
    expect(doProfessorRespondeu.corpo['etapa']).toBe('pronta')
    expect(doAtaqueRespondeu.map(({ status }) => status)).toEqual([401, 401, 401])
    // Só as três do script foram rebaixadas; a do professor, com o cookie, não.
    expect((await rebaixadasNoEmail()) - rebaixadasAntes).toBe(3)
    // E no navegador do script a conta continua segurada.
    expect((await porEmail(email, SENHA, { ip })).status).toBe(429)
  }, 60_000)

  it('cookie: login que falhou não grava educa_dispositivo; o que entrou grava um valor sem matrícula nem e-mail em texto', async () => {
    const { escolaId, slug } = await escola()
    const [matricula] = await alunos(escolaId, 1)
    const email = await professor(escolaId)
    const ip = ipSorteado()
    for (const falha of [await porMatricula(slug, matricula ?? '', SENHA_ERRADA, { ip }), await porEmail(email, SENHA_ERRADA, { ip })]) {
      expect(falha.status).toBe(401)
      expect(falha.setCookie.filter((linha) => linha.startsWith('educa_dispositivo='))).toEqual([])
    }
    for (const entrou of [await porMatricula(slug, matricula ?? '', SENHA, { ip }), await porEmail(email, SENHA, { ip })]) {
      expect(entrou.status).toBe(200)
      const valor = cookieDeDispositivo(entrou).slice('educa_dispositivo='.length)
      expect(valor).toMatch(/^\d+\.[\w-]{22}:[0-9a-z]+$/)
      for (const texto of [matricula ?? '', email, email.split('@')[0] ?? '', escolaId]) expect(valor.toLowerCase()).not.toContain(texto.toLowerCase())
    }
  })

  it('falha (Redis de fila parado): a conta segurada continua segurada, o rebaixamento segue em memória com o limiar dividido pelas instâncias (100 ÷ 2), e limite.seguro_ativo vai a 1', async () => {
    const e = await escola()
    const [aluno] = await alunos(e.escolaId, 1)
    const instancias: ApiDeTeste[] = []
    const medidores: MedidorDeTeste[] = []
    const subir = async () => {
      const medidorDaInstancia = new MedidorDeTeste()
      medidores.push(medidorDaInstancia)
      const instancia = await subirApi(medidorDaInstancia.medidor, { ambiente: { ...AMBIENTE_DO_ATAQUE, LIMITE_INSTANCIAS_API: '2' } })
      instancias.push(instancia)
      observeInsuranceLimiter(medidorDaInstancia.medidor, instancia.app.get(RateLimiter), instancia.app.get(SeguroDoLogin))
      return { instancia, medidor: medidorDaInstancia }
    }
    const pela = (instancia: ApiDeTeste) => async (matricula: string, senha: string, ip: string) => {
      naoPodemAparecer.add(ip)
      const resposta = await fetch(`${instancia.url}/v1/sessao/matricula`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ slug: e.slug, matricula, senha }) })
      return lerResposta(resposta)
    }

    // A instância que viu o ataque com o Redis de pé: o script segura a conta do aluno.
    const antes = await subir()
    const cliente = antes.instancia.app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false })
    await clientePronto(cliente)
    const doScript = ipSorteado()
    const antesDaQueda = []
    for (let tentativa = 0; tentativa < 5; tentativa++) antesDaQueda.push((await pela(antes.instancia)(aluno ?? '', SENHA_ERRADA, doScript)).status)
    expect(antesDaQueda).toEqual([401, 401, 401, 401, 429])

    composeOuFalha('stop', 'redis-fila')
    try {
      await clientePronto(cliente, false)
      // A conta segurada no Redis continua segurada no seguro desta instância, mesmo com a senha certa.
      expect((await pela(antes.instancia)(aluno ?? '', SENHA, doScript)).status).toBe(429)

      // Uma instância que só conheceu o Redis fora: toda contagem dela é do seguro, e a proporção do seguro é a dela.
      const depois = await subir()
      const naQueda = pela(depois.instancia)
      // O ataque de um IP de fora: com a contagem em memória, o limiar desta instância é 100 ÷ 2 = 50.
      const doAtaque = ipSorteado()
      const ataque = []
      for (let falha = 0; falha < 51; falha++) ataque.push((await naQueda(matriculaRara(), SENHA_ERRADA, doAtaque)).status)
      // A 51ª ainda leu 50 falhas: não passou do limiar.
      expect(await serieRebaixadaDa(e.escolaId, depois.medidor)).toBeUndefined()
      ataque.push((await naQueda(matriculaRara(), SENHA_ERRADA, doAtaque)).status)
      expect(await serieRebaixadaDa(e.escolaId, depois.medidor)).toBe(1)
      expect(new Set(ataque)).toEqual(new Set([401]))

      expect(depois.instancia.app.get(SeguroDoLogin).proporcaoDoSeguro).toBe(1)
      expect((await depois.medidor.pontos(METRICS.seguroAtivo)).map(({ valor }) => valor)).toEqual([1])
    } finally {
      composeOuFalha('start', 'redis-fila')
      await aguardarSaudavel('redis-fila')
      for (const instancia of instancias) await instancia.app.close()
      for (const medidorDaInstancia of medidores) await medidorDaInstancia.encerrar()
    }
  }, 120_000)

  it('falhas: o 503 do semáforo não conta como falha, nem para o IP na escola; a conta segurada (429) conta; e o endereço que não existe conta em `desconhecida` e não rebaixa ninguém', async () => {
    const janela = api.app.get(ContadorEmJanela)
    const falhasDoIp = async (escolaId: string, ip: string) => (await janela.ler(janela.chaveDe(PREFIXO_FALHAS_POR_IP_NA_ESCOLA, `${escolaId}|${ip}`))).valor
    const f = await escola()
    const [aluno] = await alunos(f.escolaId, 1)
    const ip = ipSorteado()
    const falhasAntes = await falhasDe(f.escolaId)

    // 503: com a vez tomada, a senha errada espera o prazo e sai com 503, sem chegar ao contador. Nada conta.
    const vez = await segurarAVez()
    const atrasada = await porMatricula(f.slug, aluno ?? '', SENHA_ERRADA, { ip })
    await vez.soltar()
    expect(atrasada.status).toBe(503)
    expect(await falhasDe(f.escolaId)).toBe(falhasAntes)
    expect(await falhasDoIp(f.escolaId, ip)).toBe(0)

    // 429: a conta segurada é falha também, para a métrica e para o IP na escola.
    const tentativas = []
    for (let tentativa = 0; tentativa < 6; tentativa++) tentativas.push((await porMatricula(f.slug, aluno ?? '', SENHA_ERRADA, { ip })).status)
    expect(tentativas).toEqual([401, 401, 401, 401, 429, 429])
    expect(tentativas.filter((status) => status === 429)).toHaveLength(2)
    expect((await falhasDe(f.escolaId)) - falhasAntes).toBe(6)
    expect(await falhasDoIp(f.escolaId, ip)).toBe(6)

    // Endereço que não existe: 105 falhas do mesmo IP contam em `desconhecida`, e nenhuma escola, nem a desconhecida,
    // ganha contador por IP ou série de rebaixamento.
    const doEndereco = ipSorteado()
    const desconhecidaAntes = await falhasDe('desconhecida')
    const slugQueNaoExiste = `inexistente-${randomUUID().slice(0, 8)}`
    for (let falha = 0; falha < 105; falha++) expect((await porMatricula(slugQueNaoExiste, matriculaRara(), SENHA_ERRADA, { ip: doEndereco })).status).toBe(401)
    expect((await falhasDe('desconhecida')) - desconhecidaAntes).toBe(105)
    expect(await falhasDoIp(ESCOLA_DESCONHECIDA, doEndereco)).toBe(0)
    const rotulosRebaixados = (await medidor.pontos(METRICS.prioridadeRebaixada)).map(({ atributos }) => atributos['escola_id'])
    expect(rotulosRebaixados).not.toContain('desconhecida')
    expect(rotulosRebaixados).not.toContain(ESCOLA_DESCONHECIDA)
  }, 60_000)

  it('falha (15.5): com a aplicação montada como em produção e o Redis de fila travado, o desafio recusado sozinho leva o seguro do login e limite.seguro_ativo a 1, com os contadores em 0', async () => {
    const medidorDoDesafio = new MedidorDeTeste()
    // O prazo de produção entra pela configuração, que é por onde o contêiner o recebe desde a correção
    // 2026-09-22-corte-de-100-ms-do-redis-recusa-o-desafio-no-e2e: montar sem a opção de teste já não significa
    // "produção", porque aí quem decide é o `AMBIENTE`, e o do compose de teste é `local`, com os 2 s da fila. A opção
    // de montagem (`MONTAGEM_DE_TESTE`) também não serviria: ela pula justamente a leitura que se quer provar. Quem
    // diz que `staging` vale 100 ms é `config.test.ts`; aqui se prova que esse valor chega ao cliente.
    const instancia = await subirApi(medidorDoDesafio.medidor, { login: { prazoDoRedisMs: TIMEOUT_COMANDO_REDIS_API_MS } }, undefined, {})
    try {
      await clientePronto(instancia.app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }))
      observeInsuranceLimiter(medidorDoDesafio.medidor, instancia.app.get(RateLimiter), instancia.app.get(SeguroDoLogin))
      const chave = configuracaoDeTeste().identidade.chaveAssinatura
      const desafio = await verificarDesafio(await new EmissorDeDesafio(chave).emitir({ contaId: randomUUID(), etapa: 'mfa', mfaCumprido: false }), chave, ['mfa'])
      const travado = await travarRedis(configuracaoDeTeste().redisFilaUrl, 3_000)
      const comecou = performance.now()
      await expect(instancia.app.get(ConsumoDeDesafio).consumir(desafio)).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
      // O corte é curto, e é isso que separa esta montagem da do compose: com o prazo da fila chegando até aqui, a
      // recusa só viria depois de 2 s, e a asserção acima continuaria verde sem provar nada.
      expect(performance.now() - comecou).toBeLessThan(TIMEOUT_COMANDO_REDIS_FILA_MS / 2)
      expect(instancia.app.get(ConsumoDeDesafio).proporcaoDoSeguro).toBe(1)
      expect([instancia.app.get(ContadorDeTentativas).proporcaoDoSeguro, instancia.app.get(ContadorEmJanela).proporcaoDoSeguro]).toEqual([0, 0])
      expect(instancia.app.get(SeguroDoLogin).proporcaoDoSeguro).toBe(1)
      expect((await medidorDoDesafio.pontos(METRICS.seguroAtivo)).map(({ valor }) => valor)).toEqual([1])
      await travado.fim
    } finally {
      await instancia.app.close()
      await medidorDoDesafio.encerrar()
    }
  }, 60_000)

  it('privacidade (regra 20): o valor do educa_dispositivo não vai a log nem a tabela nenhuma, e nenhuma métrica leva IP, matrícula, e-mail ou id de pessoa', async () => {
    // Logins próprios, para o teste não depender dos de cima: aluno e professor, pelo mesmo navegador e por outro.
    const { escolaId, slug } = await escola()
    const [primeiro, segundo] = await alunos(escolaId, 2)
    const ip = ipSorteado()
    const doPrimeiro = await porMatricula(slug, primeiro ?? '', SENHA, { ip })
    expect((await porMatricula(slug, segundo ?? '', SENHA, { ip, cookie: cookieDeDispositivo(doPrimeiro) })).status).toBe(200)
    expect((await porEmail(await professor(escolaId), SENHA, { ip })).status).toBe(200)
    expect(cookiesVistos.size).toBeGreaterThanOrEqual(3)
    const log = linhasDeLog.join('\n')
    for (const valor of cookiesVistos) expect(log.includes(valor), 'o valor do cookie apareceu no log').toBe(false)

    const { rows: tabelas } = await bancada.pool.query<{ nome: string }>(
      "select quote_ident(table_schema) || '.' || quote_ident(table_name) as nome from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema') and table_type = 'BASE TABLE'",
    )
    expect(tabelas.length).toBeGreaterThan(10)
    for (const { nome } of tabelas) {
      for (const valor of cookiesVistos) {
        // A parte do HMAC de cada entrada: a data em base 36 é curta demais para dizer algo.
        for (const entrada of valor.split('.').slice(1).map((parte) => parte.split(':')[0] ?? '')) {
          const { rows } = await bancada.pool.query<{ n: number }>(`select count(*)::int as n from ${nome} as linha where strpos(linha::text, $1) > 0`, [entrada])
          expect(rows[0]?.n, `${nome}: entrada do cookie`).toBe(0)
        }
      }
    }

    const valores = (await medidor.atributosDeTodas()).flatMap(({ atributos }) => Object.values(atributos).map(String))
    expect(valores.filter((valor) => naoPodemAparecer.has(valor))).toEqual([])
  }, 120_000)
})
