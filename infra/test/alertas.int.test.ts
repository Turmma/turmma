import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cookieDaResposta, cookieDeRenovacao, renovar } from '../../apps/api/test/test-api.js'
import { SessaoFixtures } from '../../apps/api/test/sessao.fixture.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { aguardarSaudavel, compose, composeAssincrono, composeAssincronoCom, composeAssincronoOuFalha, recriarDoZero } from '../../tools/testes/compose.ts'
import { arquivosDeAlertaDoRepositorio } from '../../tools/guardas/alerta-tem-runbook.ts'
import { parse } from 'yaml'
import { urlDoBancoDeTeste } from '../../tools/testes/integracao.setup.ts'
import {
  alertaCom,
  codigoSorteado,
  criarJobSintetico,
  executarEnsaioDeAlertas,
  gatilhoDaFalhaExiste,
  lerRegrasNoGrafana,
  REGRAS_DO_ENSAIO,
  REGRAS_PROVISIONADAS,
  type EstadoDoAlerta,
  type ResultadoDoEnsaio,
} from '../scripts/ensaio-alertas.ts'

// Contra o compose de teste, com as imagens construídas: a observabilidade (grafana/otel-lgtm) com as regras
// provisionadas de infra/grafana/alertas/, uma API, os dois despachantes e o worker-interativo exportando OTLP
// de verdade, e o estado das regras lido pela API do Grafana, como o ensaio faz.
const ambiente = lerAmbienteDeTeste()
const porta = (variavel: string) => valorObrigatorio(ambiente, variavel)
const API = `http://127.0.0.1:${porta('API_1_PORTA_HOST')}`
const GRAFANA = `http://127.0.0.1:${porta('GRAFANA_PORTA_HOST')}`
const PROMETHEUS = `http://127.0.0.1:${porta('PROMETHEUS_PORTA_HOST')}`
const SERVICOS = ['observabilidade', 'api-1', 'despachante-1', 'despachante-2', 'worker-interativo-1', 'worker-interativo-2'] as const
/**
 * A escola da borda opera com uma vaga interativa só (configuração dela): um job longo a toma inteira. Com as cinco
 * vagas do padrão seriam cinco jobs longos, e o job sintético queima CPU de verdade no sandbox (15.0): cinco deles
 * disputariam as threads do worker e esticariam a espera além do `for:` da regra.
 */
const VAGAS_INTERATIVAS_DA_ESCOLA = 1
/** Quanto os jobs que tomam as vagas da escola duram: a espera do seguinte passa de 30 s e fica bem abaixo de 30 s + 1 min. */
const DURACAO_DOS_JOBS_LONGOS_MS = 50_000

const escolas: string[] = []
const bancoUrl = urlDoBancoDeTeste()

const sessoes = new SessaoFixtures()

/** O token de uma sessão nova de coordenação na escola: a rota de job sintético é da unidade. */
async function token(escolaId: string): Promise<string> {
  return (await sessoes.sessao(escolaId, 'coordenador')).token
}

async function esperaNoPrometheus(escolaId: string): Promise<number | undefined> {
  const consulta = new URLSearchParams({ query: `max(job_espera_mais_antiga_s{escola_id="${escolaId}", fila="interativa"})` })
  const corpo = (await (await fetch(`${PROMETHEUS}/api/v1/query?${consulta}`)).json()) as { data: { result: Array<{ value: [number, string] }> } }
  const [serie] = corpo.data.result
  return serie === undefined ? undefined : Number(serie.value[1])
}

/** A expressão da regra como está no arquivo provisionado: o teste consulta a mesma que o Grafana avalia. */
function regraPorUidNoArquivo(uid: string): string {
  for (const arquivo of arquivosDeAlertaDoRepositorio()) {
    const documento = parse(arquivo.conteudo) as { groups: Array<{ rules: Array<{ uid: string; data: Array<{ refId: string; model: { expr?: string } }> }> }> }
    for (const grupo of documento.groups) for (const regra of grupo.rules) if (regra.uid === uid) return regra.data.find((consulta) => consulta.refId === 'A')?.model.expr ?? ''
  }
  throw new Error(`regra ${uid} não provisionada`)
}

/** O valor de uma expressão instantânea no Prometheus da observabilidade, ou `undefined` se ela não tem série. */
async function valorNoPrometheus(expr: string): Promise<number | undefined> {
  const corpo = (await (await fetch(`${PROMETHEUS}/api/v1/query?${new URLSearchParams({ query: expr })}`)).json()) as { data: { result: Array<{ value: [number, string] }> } }
  const [serie] = corpo.data.result
  return serie === undefined ? undefined : Number(serie.value[1])
}

async function estadoDoJob(apiToken: string, jobId: string): Promise<string> {
  const resposta = await fetch(`${API}/v1/sistema/jobs-sinteticos/${jobId}`, { headers: { Authorization: `Bearer ${apiToken}` } })
  return ((await resposta.json()) as { estado: string }).estado
}

describe('alertas locais: as regras do ensaio disparam, não disparam com condição curta ou abaixo do limiar, e voltam a normal', () => {
  beforeAll(async () => {
    // Observabilidade recriada: nenhum estado de alerta nem série de uma execução anterior.
    await recriarDoZero('observabilidade')
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', ...SERVICOS)
  }, 900_000)

  afterAll(async () => {
    // Ensaio que falhou no meio não deixa o Redis de cache nem o worker parados para o arquivo seguinte.
    await composeAssincrono('up', '--detach', '--wait', 'redis-cache')
    const pool = new pg.Pool({ connectionString: bancoUrl, max: 1 })
    await pool.query('delete from job_registro where escola_id = any($1)', [escolas])
    await pool.query('delete from configuracao_operacional_escola where escola_id = any($1)', [escolas])
    await pool.end()
    await sessoes.fechar()
    await composeAssincronoOuFalha('stop', ...SERVICOS)
  }, 180_000)

  it('caminho feliz: `ensaio:alertas` leva as regras do ensaio a disparadas, cada uma só depois do próprio `for:`, e a condição cessada as leva de volta a normal', async () => {
    const resultado: ResultadoDoEnsaio = await executarEnsaioDeAlertas({
      compose: composeAssincrono,
      composeCom: composeAssincronoCom,
      servicos: SERVICOS,
      // O ensaio fala direto com a api-1: só ela é recriada com o hash lento.
      apis: ['api-1'],
      apiUrl: API,
      grafanaUrl: GRAFANA,
      bancoUrl,
      ambiente,
      criarEscolaComSessoes: async (quantidade) => {
        const escolaId = await sessoes.escola()
        const criadas = await sessoes.sessoes(escolaId, { papel: 'coordenador', quantidade })
        return { escolaId, slug: await sessoes.slugDe(escolaId), tokens: criadas.map((criada) => () => criada.tokenNovo()) }
      },
      // O andamento do ensaio no log do teste: é o que diz em que regra ele parou, se estourar o prazo.
      registrar: (linha) => process.stdout.write(`ensaio: ${linha}\n`),
    })
    escolas.push(resultado.escolaDoJob, resultado.escolaDaFalha, resultado.escolaDoSeguro, resultado.escolaDoLogin, resultado.escolaDaSala)

    const jobInterativo = resultado.disparos[REGRAS_DO_ENSAIO.jobInterativo]
    const seguroDoLimite = resultado.disparos[REGRAS_DO_ENSAIO.seguroDoLimite]
    const taxa5xx = resultado.disparos[REGRAS_DO_ENSAIO.taxa5xx]
    const loginLento = resultado.disparos[REGRAS_DO_ENSAIO.loginLento]
    const loginHashRecusado = resultado.disparos[REGRAS_DO_ENSAIO.loginHashRecusado]
    const loginRebaixado = resultado.disparos[REGRAS_DO_ENSAIO.loginRebaixado]
    const loginEmailLimiteIp = resultado.disparos[REGRAS_DO_ENSAIO.loginEmailLimiteIp]
    const salaCodigoErrado = resultado.disparos[REGRAS_DO_ENSAIO.salaCodigoErrado]
    // Cada regra disparou com os rótulos da condição provocada: a escola do job, a rota que falhou.
    expect(jobInterativo.rotulos).toMatchObject({ fila: 'interativa', escola_id: resultado.escolaDoJob })
    expect(taxa5xx.rotulos).toMatchObject({ job: 'educa/api', http_route: '/v1/sistema/jobs-sinteticos' })
    expect(seguroDoLimite.rotulos['instance']).toMatch(/^[0-9a-f]{12}$/)
    // O rebaixamento traz a escola dos logins do ensaio, e nenhum dos dois de login traz IP.
    expect(loginRebaixado.rotulos).toMatchObject({ escola_id: resultado.escolaDoLogin })
    for (const disparo of [loginRebaixado, loginEmailLimiteIp, salaCodigoErrado]) expect(Object.values(disparo.rotulos).join(' ')).not.toMatch(/\d+\.\d+\.\d+\.\d+|::/)
    // L12 (A1, tarefa 9.0): o de código errado em massa não traz escola: ela vem da linha do log.
    expect(Object.keys(salaCodigoErrado.rotulos)).not.toContain('escola_id')
    expect(Object.values(salaCodigoErrado.rotulos)).not.toContain(resultado.escolaDaSala)
    // E só depois de pendente pelo `for:` inteiro: início da pendência e do disparo, os dois informados pelo Grafana.
    expect([
      jobInterativo.duracaoS,
      seguroDoLimite.duracaoS,
      taxa5xx.duracaoS,
      loginLento.duracaoS,
      loginHashRecusado.duracaoS,
      loginRebaixado.duracaoS,
      loginEmailLimiteIp.duracaoS,
      salaCodigoErrado.duracaoS,
    ]).toEqual([60, 120, 300, 180, 180, 120, 300, 300])
    for (const disparo of [jobInterativo, seguroDoLimite, taxa5xx, loginLento, loginHashRecusado, loginRebaixado, loginEmailLimiteIp, salaCodigoErrado]) {
      expect(disparo.disparadoDesdeMs - disparo.pendenteDesdeMs).toBeGreaterThanOrEqual(disparo.duracaoS * 1_000)
    }
    // Isolamento do gatilho: com a falha forçada valendo, outra escola gravou job na mesma rota.
    expect(resultado.jobDeOutraEscolaNaFalha).toMatch(/^[0-9a-f-]{36}$/)
    // A falha forçada é 500 da API, e nenhuma requisição virou 429 no lugar do 5xx.
    expect(resultado.statusDaFalha['500'] ?? 0).toBeGreaterThan(200)
    expect(Object.keys(resultado.statusDaFalha)).toEqual(['500'])

    // Os alertas de login vieram do semáforo: logins recusados com 503, e nenhum 429 (nem conta segurada, nem IP). O
    // rebaixamento da escola e o limite por IP do e-mail não recusam ninguém: só 401 e 503 (regra 80, item 1).
    expect(resultado.statusDoLogin['503'] ?? 0).toBeGreaterThan(50)
    expect(resultado.statusDoLogin['429']).toBeUndefined()
    expect(Object.keys(resultado.statusDoLogin).sort()).toEqual(['401', '503'])
    expect(Object.keys(resultado.statusDoEmail).filter((status) => !['401', '503'].includes(status))).toEqual([])
    // O ataque ao código passou do teto da escola (1.000) e seguiu acima dele, e ninguém foi recusado: todas
    // `NAO_ENCONTRADO`, nenhuma 429 nem 5xx (a espera de 1 s não recusa).
    expect(Object.keys(resultado.statusDaSala)).toEqual(['404'])
    expect(resultado.statusDaSala['404'] ?? 0).toBeGreaterThan(1_000)

    // Restaurado: sem gatilho, a mesma escola grava job; Redis de cache e worker-interativo de pé; a api-1 recriada com o
    // hash do ambiente, e não o lento do ensaio.
    for (const variavel of ['LOGIN_HASH_CONCORRENCIA', 'LOGIN_ARGON2_ITERACOES']) {
      expect(compose('exec', '-T', 'api-1', 'printenv', variavel).saida.trim(), variavel).toBe(ambiente[variavel])
    }
    expect(await gatilhoDaFalhaExiste(bancoUrl)).toBe(false)
    const depois = await criarJobSintetico(API, await token(resultado.escolaDaFalha), { fila: 'interativa', cpuMs: 0 })
    expect(depois.status).toBe(202)
    for (const servico of ['redis-cache', 'worker-interativo-1', 'worker-interativo-2']) {
      expect(compose('ps', '--format', '{{.Health}}', servico).saida.trim(), servico).toBe('healthy')
    }
    // O job que esperou começou quando o worker voltou, e as três regras estão normais.
    const tokenDoJob = await token(resultado.escolaDoJob)
    await expect.poll(() => estadoDoJob(tokenDoJob, resultado.jobId), { timeout: 30_000, interval: 1_000 }).toBe('concluido')
    const regras = await lerRegrasNoGrafana(GRAFANA)
    for (const uid of Object.values(REGRAS_DO_ENSAIO)) {
      expect(regras.get(uid)?.alertas.map((alerta) => alerta.estado), uid).toEqual(expect.arrayContaining(['normal']))
      expect(regras.get(uid)?.alertas.filter((alerta) => alerta.estado !== 'normal'), uid).toEqual([])
    }
  }, 900_000)

  it('L12: a rajada do primeiro dia (420 códigos errados em 5 min, abaixo do teto da escola) não soma na métrica e nem deixa a regra pendente', async () => {
    const escola = await sessoes.escola()
    escolas.push(escola)
    const slug = await sessoes.slugDe(escola)
    const daRegra = regraPorUidNoArquivo(REGRAS_DO_ENSAIO.salaCodigoErrado)
    const estadoDaSala = async (): Promise<EstadoDoAlerta> => alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(REGRAS_DO_ENSAIO.salaCodigoErrado), {})?.estado ?? 'normal'
    // A série nasce em 0 no boot da API: com ela no Prometheus, o aumento durante a rajada é medível. O aumento, e não o
    // valor: a instância que o ensaio recriou deixa o último valor dela lá por até 5 min, e ele some no meio da rajada.
    await expect.poll(() => valorNoPrometheus('sum(sala_limite_atingido_total{job="educa/api", tipo="escola"})'), { timeout: 60_000, interval: 1_000 }).toBeDefined()
    expect(await estadoDaSala()).toBe('normal')

    const estados: EstadoDoAlerta[] = []
    let amostrando = true
    const amostragem = (async () => {
      while (amostrando) {
        estados.push(await estadoDaSala())
        await new Promise((resolver) => setTimeout(resolver, 2_000))
      }
    })()
    // 420 códigos em 5 min, espaçados por igual: 84 por minuto, oito vezes o limiar da regra se cada um somasse.
    const status: Record<string, number> = {}
    const RAJADA = 420
    const DURACAO_MS = 5 * 60_000
    // Um intervalo de exportação e de raspagem antes de marcar o início: um último incremento do ataque do ensaio que
    // ainda estivesse a caminho do Prometheus não cai dentro da janela da rajada.
    await new Promise((resolver) => setTimeout(resolver, 20_000))
    const inicio = Date.now()
    for (let tentativa = 0; tentativa < RAJADA; tentativa++) {
      await new Promise((resolver) => setTimeout(resolver, Math.max(0, inicio + (tentativa * DURACAO_MS) / RAJADA - Date.now())))
      const resposta = await fetch(`${API}/v1/salas/abrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, codigo: codigoSorteado() }),
        signal: AbortSignal.timeout(15_000),
      })
      status[String(resposta.status)] = (status[String(resposta.status)] ?? 0) + 1
      await resposta.body?.cancel()
    }
    // Mais duas avaliações da regra depois da rajada, para uma pendência atrasada aparecer.
    await new Promise((resolver) => setTimeout(resolver, 25_000))
    amostrando = false
    await amostragem

    expect(status).toEqual({ '404': RAJADA })
    // A janela começa no início da rajada: o fim do ataque do ensaio, logo antes, fica de fora.
    const segundos = Math.floor((Date.now() - inicio) / 1_000)
    expect(await valorNoPrometheus(`sum(increase(sala_limite_atingido_total{job="educa/api", tipo="escola"}[${String(segundos)}s]))`)).toBe(0)
    expect(await valorNoPrometheus(daRegra)).toBe(0)
    expect(estados.length).toBeGreaterThan(100)
    expect(estados.every((estado) => estado === 'normal')).toBe(true)
  }, 480_000)

  it('borda: espera curta não dispara — a 20 s nem fica pendente, e passando de 30 s por menos de 1 min fica pendente e volta a normal sem disparar', async () => {
    const escola = await sessoes.escola()
    escolas.push(escola)
    const apiToken = await token(escola)
    const pool = new pg.Pool({ connectionString: bancoUrl, max: 1 })
    await pool.query('insert into configuracao_operacional_escola (escola_id, vagas) values ($1, $2)', [escola, JSON.stringify({ interativa: VAGAS_INTERATIVAS_DA_ESCOLA })])
    await pool.end()
    // As vagas interativas da escola tomadas por jobs longos: o próximo job espera por elas, com o worker de pé.
    const longos: string[] = []
    for (let vaga = 0; vaga < VAGAS_INTERATIVAS_DA_ESCOLA; vaga++) {
      const resposta = await criarJobSintetico(API, apiToken, { fila: 'interativa', cpuMs: DURACAO_DOS_JOBS_LONGOS_MS })
      expect(resposta.status).toBe(202)
      longos.push(((await resposta.json()) as { jobId: string }).jobId)
    }
    await expect.poll(async () => (await Promise.all(longos.map((jobId) => estadoDoJob(apiToken, jobId)))).every((estado) => estado === 'ativo'), { timeout: 30_000, interval: 500 }).toBe(true)
    const resposta = await criarJobSintetico(API, apiToken, { fila: 'interativa', cpuMs: 0 })
    expect(resposta.status).toBe(202)
    const esperando = ((await resposta.json()) as { jobId: string }).jobId

    // O estado da regra para esta escola, amostrado sem parar da criação do job até o fim: um disparo entre duas
    // esperas do teste (um `for:` curto demais, por exemplo) não passa despercebido.
    const estados: EstadoDoAlerta[] = []
    const estadoDaEscola = async (): Promise<EstadoDoAlerta> => {
      const estado = alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(REGRAS_DO_ENSAIO.jobInterativo), { escola_id: escola })?.estado ?? 'normal'
      estados.push(estado)
      return estado
    }
    let amostrando = true
    const amostragem = (async () => {
      while (amostrando) {
        await estadoDaEscola()
        await new Promise((resolver) => setTimeout(resolver, 1_000))
      }
    })()

    // Com a espera em 20 s no Prometheus, abaixo do limiar: a regra nem começou a contar.
    await expect.poll(() => esperaNoPrometheus(escola), { timeout: 60_000, interval: 1_000 }).toBeGreaterThanOrEqual(20)
    expect(await esperaNoPrometheus(escola)).toBeLessThan(30)
    expect(await estadoDaEscola()).toBe('normal')

    // Acima de 30 s ela fica pendente: o que segura o disparo é o `for:`, e não o limiar.
    await expect.poll(estadoDaEscola, { timeout: 60_000, interval: 1_000 }).toBe('pendente')
    // As vagas liberam, o job começa, a espera zera e a regra volta a normal, sem nunca ter disparado.
    await expect.poll(() => estadoDoJob(apiToken, esperando), { timeout: 60_000, interval: 1_000 }).toBe('concluido')
    await expect.poll(() => esperaNoPrometheus(escola), { timeout: 60_000, interval: 1_000 }).toBe(0)
    await expect.poll(estadoDaEscola, { timeout: 60_000, interval: 1_000 }).toBe('normal')
    // Mais duas avaliações da regra depois de normal, para um disparo atrasado aparecer.
    await new Promise((resolver) => setTimeout(resolver, 25_000))
    amostrando = false
    await amostragem
    expect(estados).toContain('pendente')
    expect(estados).not.toContain('disparado')
    expect(estados.at(-1)).toBe('normal')
  }, 300_000)

  it('login abaixo dos limiares: com logins sem fila, o p95 fica abaixo de 1 s e nenhum 503 sai do semáforo, e as duas regras de login ficam normais', async () => {
    const lento = regraPorUidNoArquivo(REGRAS_DO_ENSAIO.loginLento)
    const recusado = regraPorUidNoArquivo(REGRAS_DO_ENSAIO.loginHashRecusado)
    const estadoDe = async (uid: string): Promise<EstadoDoAlerta> => alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(uid), {})?.estado ?? 'normal'
    // Um login por vez, a cada meio segundo, num endereço que não existe: o semáforo nunca tem fila, e as regras têm
    // tráfego para avaliar (sem tráfego, a expressão fica sem série e a prova não diria nada).
    let ativo = true
    const status: Record<string, number> = {}
    const lacos = (async () => {
      while (ativo) {
        const resposta = await fetch(`${API}/v1/sessao/matricula`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'alertas-abaixo-do-limiar', matricula: `ABAIXO${String(Date.now())}`, senha: 'senha-sintetica-abaixo' }),
        })
        status[String(resposta.status)] = (status[String(resposta.status)] ?? 0) + 1
        await resposta.body?.cancel()
        await new Promise((resolver) => setTimeout(resolver, 500))
      }
    })()
    try {
      // A janela de 1 min esquece o que um teste anterior deixou; daí em diante, as duas expressões têm série e ficam
      // abaixo do limiar.
      await expect.poll(() => valorNoPrometheus(recusado), { timeout: 180_000, interval: 2_000 }).toBe(0)
      await expect.poll(async () => (await valorNoPrometheus(lento)) ?? Number.POSITIVE_INFINITY, { timeout: 60_000, interval: 2_000 }).toBeLessThan(1)
      // Quatro avaliações de cada regra com a expressão abaixo do limiar: nem pendente, nem disparada.
      const estados: EstadoDoAlerta[] = []
      for (let volta = 0; volta < 4; volta++) {
        estados.push(await estadoDe(REGRAS_DO_ENSAIO.loginLento), await estadoDe(REGRAS_DO_ENSAIO.loginHashRecusado))
        await new Promise((resolver) => setTimeout(resolver, 10_000))
      }
      expect(estados.every((estado) => estado === 'normal')).toBe(true)
    } finally {
      ativo = false
      await lacos
    }
    expect(Object.keys(status)).toEqual(['401'])
  }, 360_000)

  it('o anônimo do Grafana lê as regras, mas não apaga nem pausa uma regra provisionada', async () => {
    const apagar = await fetch(`${GRAFANA}/api/v1/provisioning/alert-rules/${REGRAS_DO_ENSAIO.taxa5xx}`, { method: 'DELETE' })
    expect(apagar.status).toBe(403)
    const regras = await lerRegrasNoGrafana(GRAFANA)
    expect([...regras.keys()].sort()).toEqual(Object.values(REGRAS_PROVISIONADAS).sort())
  }, 60_000)

  it('reuso de refresh: 5 reusos em 10 min não disparam, o sexto dispara, e o reinício da API com o acumulado não dispara', async () => {
    const escola = await sessoes.escola()
    const alunos = await sessoes.sessoes(escola, { quantidade: 6 })
    const reusos = `sum(sessao_renovacao_total{job="educa/api", resultado="reuso"})`
    const daRegra = regraPorUidNoArquivo(REGRAS_PROVISIONADAS.reusoDeRefresh)
    const estadoDoReuso = async (): Promise<EstadoDoAlerta> => alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(REGRAS_PROVISIONADAS.reusoDeRefresh), {})?.estado ?? 'normal'
    // A série nasce em 0 no boot da API: o Prometheus precisa tê-la antes do primeiro reuso, senão ele não conta.
    await expect.poll(() => valorNoPrometheus(reusos), { timeout: 60_000, interval: 1_000 }).toBeDefined()
    const base = (await valorNoPrometheus(reusos)) ?? 0

    /** O cookie antigo de volta 31 s depois da rotação, com o token novo já usado: a família cai. */
    async function reusar(aluno: (typeof alunos)[number]): Promise<void> {
      const cookie = await cookieDeRenovacao(sessoes, aluno)
      const legitima = await renovar(API, cookie)
      expect(legitima.status).toBe(200)
      const eu = await fetch(`${API}/v1/eu`, { headers: { Authorization: `Bearer ${String(legitima.corpo['token'])}` } })
      expect(eu.status).toBe(200)
      await expect
        .poll(async () => (await sessoes.pool.query<{ atual_apresentado: boolean }>('select atual_apresentado from sessao where escola_id = $1 and id = $2', [escola, aluno.sessaoId])).rows[0]?.atual_apresentado, { timeout: 10_000 })
        .toBe(true)
      await sessoes.pool.query("update sessao set rotacionado_em = now() - interval '31 seconds' where escola_id = $1 and id = $2", [escola, aluno.sessaoId])
      expect((await renovar(API, cookie)).status).toBe(401)
      expect((await renovar(API, cookieDaResposta(legitima))).status).toBe(401)
    }

    for (const aluno of alunos.slice(0, 5)) await reusar(aluno)
    await expect.poll(() => valorNoPrometheus(reusos), { timeout: 60_000, interval: 1_000 }).toBe(base + 5)
    await expect.poll(() => valorNoPrometheus(daRegra), { timeout: 60_000, interval: 1_000 }).toBeGreaterThanOrEqual(5)
    expect(await valorNoPrometheus(daRegra)).toBeLessThanOrEqual(5)
    // Três avaliações da regra com os 5 na janela: nem pendente, nem disparada.
    const estados: EstadoDoAlerta[] = []
    for (let volta = 0; volta < 4; volta++) {
      estados.push(await estadoDoReuso())
      await new Promise((resolver) => setTimeout(resolver, 10_000))
    }
    expect(estados.every((estado) => estado === 'normal')).toBe(true)

    const sexto = alunos[5]
    if (sexto === undefined) throw new Error('sessão de teste não criada')
    await reusar(sexto)
    await expect.poll(() => valorNoPrometheus(reusos), { timeout: 60_000, interval: 1_000 }).toBe(base + 6)
    await expect.poll(estadoDoReuso, { timeout: 60_000, interval: 2_000 }).toBe('disparado')

    // Borda: a API reinicia no mesmo contêiner (mesmo hostname, mesma série) com os reusos acumulados, e nenhum reuso
    // novo acontece. O contador volta a 0 e a regra volta a normal: o acumulado de antes do reinício não conta.
    await composeAssincronoOuFalha('restart', 'api-1')
    await aguardarSaudavel('api-1')
    await expect.poll(() => valorNoPrometheus(reusos), { timeout: 60_000, interval: 1_000 }).toBe(0)
    await expect.poll(() => valorNoPrometheus(daRegra), { timeout: 60_000, interval: 1_000 }).toBe(0)
    await expect.poll(estadoDoReuso, { timeout: 60_000, interval: 2_000 }).toBe('normal')
  }, 420_000)
})
