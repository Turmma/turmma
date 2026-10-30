import { METRICS } from '@educa/nucleo'
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import type { Redis } from 'ioredis'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { MedidorDeTeste, type PontoLido } from '../../../tools/testes/metricas.ts'
import { CLIENTE_REDIS_LOGIN, ESPERA_MAXIMA_PELO_HASH_MS, HashDeSenha, RETRY_AFTER_MAXIMO_S, RETRY_AFTER_MINIMO_S } from '../src/credencial/index.js'
import { comoAWebNo503, PRAZO_DA_WEB_NO_503_MS, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SENHA = 'senha-sintetica-do-semaforo-1'
const SENHA_ERRADA = 'senha-sintetica-errada-do-semaforo'
/**
 * Um hash por vez nesta API: com o hash de um login segurado pelo teste, todo outro login espera a vez, e o prazo de
 * 2 s vence para todos. O teto baixo é o que torna a saturação determinística, sem depender da CPU da máquina.
 */
const CONCORRENCIA_DE_TESTE = '1'
/**
 * O limite inferior do tempo até o 503, com folga de 100 ms para o relógio do cliente, que começa a contar antes de o
 * pedido chegar ao semáforo. Não há limite superior: o runner lento só atrasa a resposta, e o que o teste prova é que
 * ela vem, e não quando.
 */
const ESPERA_MINIMA_ATE_O_503_MS = ESPERA_MAXIMA_PELO_HASH_MS - 100

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

/** Uma matrícula que não aparece por acaso em outro lugar (letra e hexadecimal), para a busca nos rótulos ter sentido. */
function matriculaRara(): string {
  return `RA${randomBytes(6).toString('hex').toUpperCase()}`
}

describe('semáforo do hash no login: fila justa com prazo, sem revelar quem existe', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  let hash: HashDeSenha
  let verificacoes: MockInstance<HashDeSenha['verificar']>
  let verificarReal: HashDeSenha['verificar']
  let hashDaSenha: string
  /** Tudo que identifica pessoa ou origem e passou pelo login: nada disso pode virar rótulo de métrica. */
  const naoPodemSerRotulo = new Set<string>(['127.0.0.1'])

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LOGIN_HASH_CONCORRENCIA: CONCORRENCIA_DE_TESTE } })
    hash = api.app.get(HashDeSenha)
    verificarReal = hash.verificar.bind(hash)
    verificacoes = vi.spyOn(hash, 'verificar')
    await clientePronto(api.app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }))
    hashDaSenha = await hash.gerar(SENHA)
  })

  beforeEach(() => {
    verificacoes.mockClear()
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /**
   * O próximo hash só termina quando o teste soltar: o login que chegar a ele fica com a única vez do semáforo, e todo
   * outro login espera. Devolve quando esse login já está no hash.
   */
  function segurarOProximoHash(): { soltar: () => void } {
    let soltar: () => void = () => undefined
    const portao = new Promise<void>((resolver) => (soltar = resolver))
    verificacoes.mockImplementationOnce(async (guardado, senha) => {
      await portao
      return verificarReal(guardado, senha)
    })
    return { soltar }
  }

  async function lerResposta(resposta: Response): Promise<Resposta> {
    return { status: resposta.status, corpo: JSON.parse(await resposta.text()) as Resposta['corpo'], retryAfter: resposta.headers.get('retry-after'), setCookie: resposta.headers.getSetCookie() }
  }

  async function porMatricula(slug: string, matricula: string, senha = SENHA): Promise<Resposta> {
    naoPodemSerRotulo.add(matricula)
    const resposta = await fetch(`${api.url}/v1/sessao/matricula`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, matricula, senha }) })
    return lerResposta(resposta)
  }

  async function porEmail(email: string, senha = SENHA): Promise<Resposta> {
    naoPodemSerRotulo.add(email)
    const resposta = await fetch(`${api.url}/v1/sessao/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) })
    return lerResposta(resposta)
  }

  async function escola(): Promise<{ escolaId: string; slug: string }> {
    const escolaId = await bancada.escola()
    return { escolaId, slug: await bancada.slugDe(escolaId) }
  }

  async function alunos(escolaId: string, quantidade: number): Promise<string[]> {
    const matriculas = Array.from({ length: quantidade }, () => matriculaRara())
    const ids = await bancada.alunosComMatricula(
      escolaId,
      matriculas.map((matricula) => ({ matricula, senhaHash: hashDaSenha })),
    )
    for (const id of ids) naoPodemSerRotulo.add(id)
    return matriculas
  }

  /** Dois alunos novos na escola do endereço. */
  async function alunosDe(slug: string): Promise<[string, string]> {
    const { rows } = await bancada.pool.query<{ id: string }>('select id from escola where slug = $1', [slug])
    const [primeiro, segundo] = await alunos(rows[0]?.id ?? '', 2)
    if (primeiro === undefined || segundo === undefined) throw new Error('alunos não criados')
    return [primeiro, segundo]
  }

  /** Um professor com conta e senha na escola. */
  async function professor(escolaId: string): Promise<string> {
    const email = `semaforo-${randomUUID()}@escola.invalid`
    const { rows } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, hashDaSenha])
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Pessoa sintética') returning id", [
      escolaId,
      rows[0]?.id,
    ])
    naoPodemSerRotulo.add(usuarios[0]?.id ?? '')
    return email
  }

  function esperarIndisponivel(resposta: Resposta): void {
    expect(resposta.status).toBe(503)
    expect(resposta.corpo).toEqual({ erro: { codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, mensagem: MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, requisicaoId: expect.stringMatching(UUID) } })
    expect(Number(resposta.retryAfter)).toBeGreaterThanOrEqual(RETRY_AFTER_MINIMO_S)
    expect(Number(resposta.retryAfter)).toBeLessThanOrEqual(RETRY_AFTER_MAXIMO_S)
    expect(Number.isInteger(Number(resposta.retryAfter))).toBe(true)
    expect(resposta.setCookie).toEqual([])
  }

  async function duracoesDe(metodo: string): Promise<number> {
    const ponto = (await medidor.pontos(METRICS.duracaoDoLogin)).find(({ atributos }) => atributos['metodo'] === metodo)
    return typeof ponto?.valor === 'object' ? ponto.valor.contagem : 0
  }

  async function recusados(): Promise<number> {
    const [ponto] = await medidor.pontos(METRICS.hashRecusado)
    return typeof ponto?.valor === 'number' ? ponto.valor : 0
  }

  it('borda: quem espera a vez mais de 2 s recebe 503 com Retry-After entre 2 e 6 e não chega ao hash; e os 503 não contam como senha errada', async () => {
    const { slug } = await escola()
    const [daVez, enzo] = await alunosDe(slug)
    const antes = await recusados()

    const hashSegurado = segurarOProximoHash()
    const primeiro = porMatricula(slug, daVez)
    await vi.waitFor(() => expect(verificacoes).toHaveBeenCalledTimes(1))
    const duracoesAntes = await duracoesDe('matricula')

    // Seis pedidos do Enzo, com a senha certa, enquanto a única vez está tomada: nenhum pedido fica pendurado.
    const inicio = performance.now()
    const doEnzo = await Promise.all(Array.from({ length: 6 }, () => porMatricula(slug, enzo)))
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(ESPERA_MINIMA_ATE_O_503_MS)
    for (const resposta of doEnzo) esperarIndisponivel(resposta)
    expect(verificacoes).toHaveBeenCalledTimes(1)
    expect((await recusados()) - antes).toBe(6)
    // E os seis entram em login.duracao, o denominador do alerta de 503 e a base do p95 do login lento. O login que está
    // com a vez ainda não respondeu, então a conta é exata.
    expect((await duracoesDe('matricula')) - duracoesAntes).toBe(6)

    hashSegurado.soltar()
    expect((await primeiro).status).toBe(200)
    // Seis 503 seguidos e o Enzo entra na sétima: a vez é pedida antes de a tentativa ser contada. Se o 503 contasse,
    // a quinta já teria segurado a conta, e esta seria 429 CONTA_SEGURADA.
    const depois = await porMatricula(slug, enzo)
    expect(depois.status).toBe(200)
    expect(depois.corpo['etapa']).toBe('pronta')
  }, 30_000)

  it('privacidade (regra 20, item 6): sob saturação, matrícula que existe e que não existe, e e-mail com e sem conta, recebem 503 na mesma proporção e com a mesma resposta', async () => {
    const a = await escola()
    const [daVez] = await alunosDe(a.slug)
    const existentes = await alunos(a.escolaId, 5)
    const inexistentes = Array.from({ length: 5 }, () => matriculaRara())
    const comConta = await Promise.all(Array.from({ length: 5 }, () => professor(a.escolaId)))
    const semConta = Array.from({ length: 5 }, () => `ninguem-${randomUUID()}@escola.invalid`)

    const hashSegurado = segurarOProximoHash()
    const primeiro = porMatricula(a.slug, daVez)
    await vi.waitFor(() => expect(verificacoes).toHaveBeenCalledTimes(1))
    const [deExistentes, deInexistentes, deComConta, deSemConta] = await Promise.all([
      Promise.all(existentes.map((matricula) => porMatricula(a.slug, matricula))),
      Promise.all(inexistentes.map((matricula) => porMatricula(a.slug, matricula))),
      Promise.all(comConta.map((email) => porEmail(email))),
      Promise.all(semConta.map((email) => porEmail(email))),
    ])
    hashSegurado.soltar()
    expect((await primeiro).status).toBe(200)

    // Margem declarada: zero. Com a vez tomada, a proporção de 503 é a mesma, 5 de 5, nos quatro grupos: o balde e o
    // prazo não dependem de a credencial existir. Quem pulasse o semáforo por não existir iria direto ao hash e
    // responderia 401, e a proporção dele cairia a 0.
    const taxa = (respostas: Resposta[]) => respostas.filter((resposta) => resposta.status === 503).length / respostas.length
    expect([taxa(deExistentes), taxa(deInexistentes), taxa(deComConta), taxa(deSemConta)]).toEqual([1, 1, 1, 1])
    const semRequisicao = (resposta: Resposta) => ({ ...resposta, retryAfter: undefined, corpo: { erro: { ...resposta.corpo.erro, requisicaoId: undefined } } })
    const referencia = semRequisicao(deExistentes[0] ?? ({} as Resposta))
    for (const resposta of [...deExistentes, ...deInexistentes, ...deComConta, ...deSemConta]) {
      esperarIndisponivel(resposta)
      expect(semRequisicao(resposta)).toEqual(referencia)
    }
    // Nenhum dos vinte chegou ao hash: só o login que estava com a vez.
    expect(verificacoes).toHaveBeenCalledTimes(1)
  }, 30_000)

  it('borda (regra 80, item 1): 35 alunos do mesmo IP ao mesmo tempo, com um hash por vez, entram todos em até 30 s, com no máximo espera e 503 repetido como a web faz; nenhum 429', async () => {
    const { escolaId, slug } = await escola()
    const turma = await alunos(escolaId, 35)
    const esperaAntes = await esperasDa(escolaId)

    const tentativas = await Promise.all(
      turma.map(async (matricula) => {
        const inicio = performance.now()
        const tentativa = await comoAWebNo503(() => porMatricula(slug, matricula))
        return { ...tentativa, duracaoMs: performance.now() - inicio }
      }),
    )
    for (const { resposta, recusas, duracaoMs } of tentativas) {
      expect(resposta.status).toBe(200)
      expect(resposta.corpo['etapa']).toBe('pronta')
      for (const recusa of recusas) esperarIndisponivel(recusa)
      // A web desiste em 30 s: com 35 logins e um hash por vez, a turma inteira entra em poucos segundos, e o limite é
      // o prazo da web, não uma estimativa de tempo desta máquina.
      expect(duracaoMs).toBeLessThan(PRAZO_DA_WEB_NO_503_MS)
    }
    expect(tentativas.flatMap(({ recusas }) => recusas).filter((recusa) => recusa.status === 429)).toEqual([])
    // Todos passaram pelo semáforo, no balde da escola: 35 vezes concedidas, e os que chegaram atrás esperaram.
    const esperaDepois = await esperasDa(escolaId)
    expect(esperaDepois.contagem - esperaAntes.contagem).toBe(35)
    expect(esperaDepois.soma - esperaAntes.soma).toBeGreaterThan(0)
  }, 120_000)

  async function esperasDa(escolaId: string): Promise<{ contagem: number; soma: number }> {
    const ponto = (await medidor.pontos(METRICS.esperaPeloHash)).find(({ atributos }) => atributos['escola_id'] === escolaId)
    return typeof ponto?.valor === 'object' ? ponto.valor : { contagem: 0, soma: 0 }
  }

  it('métrica (regra 80, item 10): depois de logins de A, de B e da equipe, login.hash_espera tem uma série por escola e nenhum rótulo de usuário, matrícula ou IP; login.duracao só o método', async () => {
    const a = await escola()
    const b = await escola()
    const [equipeAntes, desconhecidaAntes] = [await esperasDa('equipe'), await esperasDa('desconhecida')]
    for (const { slug } of [a, b]) {
      const [primeiro, segundo] = await alunosDe(slug)
      expect((await porMatricula(slug, primeiro)).status).toBe(200)
      expect((await porMatricula(slug, segundo, SENHA_ERRADA)).status).toBe(401)
    }
    // A matrícula que não existe no endereço da A espera a vez no balde da A, como as que existem: o balde sai do
    // endereço, antes de a credencial ser lida (regra 20, item 6).
    expect((await porMatricula(a.slug, matriculaRara())).status).toBe(401)
    // O e-mail com conta e o sem conta esperam os dois no balde da equipe.
    expect((await porEmail(await professor(a.escolaId))).status).toBe(200)
    expect((await porEmail(`ninguem-${randomUUID()}@escola.invalid`)).status).toBe(401)
    expect((await porMatricula(`inexistente-${randomUUID().slice(0, 8)}`, matriculaRara())).status).toBe(401)

    const esperas = await medidor.pontos(METRICS.esperaPeloHash)
    const porEscola = (escolaId: string) => esperas.filter(({ atributos }) => atributos['escola_id'] === escolaId)
    // Uma série por escola: na A, a matrícula certa, a errada e a que não existe; na B, a certa e a errada. A equipe e o
    // endereço que não existe têm a sua, sem escola real, e contam exatamente os pedidos deste teste.
    expect(porEscola(a.escolaId).map(({ valor }) => valor)).toEqual([expect.objectContaining({ contagem: 3 })])
    expect(porEscola(b.escolaId).map(({ valor }) => valor)).toEqual([expect.objectContaining({ contagem: 2 })])
    expect((await esperasDa('equipe')).contagem - equipeAntes.contagem).toBe(2)
    expect((await esperasDa('desconhecida')).contagem - desconhecidaAntes.contagem).toBe(1)
    for (const { atributos } of esperas) expect(Object.keys(atributos)).toEqual(['escola_id'])

    const duracoes: PontoLido[] = await medidor.pontos(METRICS.duracaoDoLogin)
    expect(duracoes.map(({ atributos }) => atributos).sort((x, y) => String(x['metodo']).localeCompare(String(y['metodo'])))).toEqual([{ metodo: 'email' }, { metodo: 'matricula' }])

    // Nenhum valor de rótulo, em métrica nenhuma, é matrícula, e-mail, id de aluno ou de usuário, ou o IP de quem pediu.
    const valores = (await medidor.atributosDeTodas()).flatMap(({ atributos }) => Object.values(atributos).map(String))
    expect(valores.filter((valor) => naoPodemSerRotulo.has(valor))).toEqual([])
  }, 60_000)
})
