// Cenário "login às 7h30" (Tech Spec da identidade, seção 7c; PRD, RF11, RF13 e RF21; regra 80, itens 1, 3 e 11). Roda
// num container do compose de carga, na mesma rede: todos os VUs de um container saem do IP dele, como uma escola inteira
// atrás de um NAT. Quem o chama é infra/scripts/carga-login.ts, uma vez por fase, na ordem da Tech Spec:
//
//   FASE=base           só B e C: login e requisições autenticadas, sem ataque. O p95 das autenticadas vira a base.
//   FASE=rajada         2.100 contas de A, B e C em 5 min, 40% no primeiro minuto e 30% errando a senha uma vez antes
//                       de acertar, cada uma seguida de requisições autenticadas. O aluno lê também o que o Início dele
//                       lê (GET /v1/eu e a primeira página de GET /v1/minhas-atividades, telas do aluno 3.0), e o professor
//                       abre a Semana (GET /v1/semana, F2b), com a grade, o texto das aulas e os itens do dia semeados.
//   FASE=renovacao      600 contas entram e renovam a sessão em duas abas ao mesmo tempo, como no pior caso da web. Em
//                       vez de esperar o token curto vencer, a renovação vem logo depois do login: a disputa é a mesma.
//   FASE=preparacao     sem ataque, as contas "com cookie" entram uma vez, e o `educa_dispositivo` que o login grava vai
//                       para /execucao/dispositivos.json: é o navegador em que elas já entraram antes do ataque.
//   FASE=ataque_fora    as contas legítimas entram (A com e sem cookie, equipe com e sem cookie) enquanto B e C usam o
//                       sistema; o ataque sai de OUTRO container (FASE=atacante), com IP próprio.
//   FASE=ataque_dentro  o mesmo, com o ataque saindo deste container: o IP da escola.
//   FASE=redis_fora     como ataque_fora; o script derruba o Redis de fila no meio e o religa.
//   FASE=atacante       só o ataque: 3.000 tentativas por minuto, metade em matrículas diferentes da A (existentes, de
//                       um grupo que nenhuma conta legítima usa, e inexistentes), metade em e-mails diferentes, com e
//                       sem conta, e uma em dez na senha da conta da equipe cujo dono entra com cookie.
//
// A conta legítima imita a web (18.0): no 503 com `Retry-After`, espera e repete sozinha por até 30 s. Os thresholds
// derrubam o código de saída do k6 (99). Toda resposta soma no contador do seu grupo (1 no caso, 0 fora dele), para
// nenhum threshold passar por falta de amostra.
//
// Nenhum dado de pessoa: escolas, matrículas e e-mails sintéticos (domínio `.invalid`), e a senha sintética gerada na
// hora pelo script, lida de um arquivo da pasta temporária da execução. Nada chama provedor de IA nem o `oidc-falso`.

import { sleep } from 'k6'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'

const FASE = __ENV.FASE
const API = __ENV.API_URL
const ARQUIVO_DAS_CONTAS = __ENV.ARQUIVO_DAS_CONTAS
const FASES = ['base', 'rajada', 'renovacao', 'preparacao', 'ataque_fora', 'ataque_dentro', 'redis_fora', 'atacante']
/** As fases com contas legítimas sob ataque: leem os cookies de dispositivo que a preparação obteve. */
const FASES_SOB_ATAQUE = ['ataque_fora', 'ataque_dentro', 'redis_fora']
if (!FASES.includes(FASE)) throw new Error(`FASE precisa ser uma de: ${FASES.join(', ')}`)
if (!API || !ARQUIVO_DAS_CONTAS) throw new Error('defina API_URL e ARQUIVO_DAS_CONTAS')

/** p95 do login, em toda fase (PRD, RF21; alerta `login-lento`). */
export const P95_MAXIMO_DO_LOGIN_MS = 1_000
/** O nome (a tag `name`) das duas leituras do Início do aluno, e o da rota que ganha limite próprio na rajada. */
export const ROTA_DO_EU = 'GET /v1/eu'
export const ROTA_DAS_TAREFAS = 'GET /v1/minhas-atividades'
/** O nome (a tag `name`) da Semana do professor, que ganha limite próprio na rajada, e quantos professores a leem: 20 por escola, 3 escolas. */
export const ROTA_DA_SEMANA = 'GET /v1/semana'
export const PROFESSORES_NA_RAJADA = 60
/** Margem declarada sobre o p95 das requisições autenticadas da B e da C na base. */
export const MARGEM_SOBRE_A_BASE_MS = 250
/** Quanto a web repete sozinha no 503 antes de mostrar erro (Tech Spec, seção 5, "Hash"; 18.0). */
export const PRAZO_DA_WEB_MS = 30_000
/** Quanto a web espera depois de um 409 `JA_RENOVADO` antes de tentar de novo (Tech Spec, seção 5, "Renovar"). */
const ESPERA_DEPOIS_DO_409_S = 2.5
/** Tentativas por minuto do ataque (Tech Spec, seção 7c). */
export const ATAQUE_POR_MINUTO = 3_000
const DURACAO_DO_ATAQUE = '3m'
/** As contas legítimas começam depois de o ataque ter passado do limiar da A. */
const INICIO_DOS_LEGITIMOS = '20s'
const DURACAO_DOS_LEGITIMOS = '150s'
const DURACAO_DA_BASE = '2m'
/** A rajada (Tech Spec, 7c): 2.100 contas em 5 min, 40% (840) no primeiro minuto, 1.260 nos quatro seguintes. */
export const CONTAS_NA_RAJADA = 2_100
const NO_PRIMEIRO_MINUTO = 840
const CONTAS_NA_RENOVACAO = 600

// Uma cópia para todos os VUs, e não uma por VU: o arquivo só é lido na criação de cada SharedArray, e os VUs criados no
// meio da rajada não param para ler as 2.100 contas de novo.
const lista = (nome) => new SharedArray(nome, () => JSON.parse(open(ARQUIVO_DAS_CONTAS))[nome])
const [contas] = new SharedArray('geral', () => {
  const { senha, senhaErrada, slugs, equipeAlvo } = JSON.parse(open(ARQUIVO_DAS_CONTAS))
  return [{ senha, senhaErrada, slugs, equipeAlvo }]
})
const RAJADA = lista('rajada')
const RENOVACAO = lista('renovacao')
const A_COM_COOKIE = lista('aComCookie')
const A_SEM_COOKIE = lista('aSemCookie')
const B_FUNDO = lista('bFundo')
const C_FUNDO = lista('cFundo')
const EQUIPE_SEM_COOKIE = lista('equipeSemCookie')
const ALVOS_MATRICULA = lista('alvosAtaqueMatricula')
const ALVOS_EMAIL = lista('alvosAtaqueEmail')
const { senha: SENHA, senhaErrada: SENHA_ERRADA, slugs: SLUGS, equipeAlvo: EQUIPE_ALVO } = contas
/** O `educa_dispositivo` de cada conta "com cookie", por matrícula ou e-mail, obtido na preparação. */
const [DISPOSITIVOS] = FASES_SOB_ATAQUE.includes(FASE) ? new SharedArray('dispositivos', () => [JSON.parse(open('/execucao/dispositivos.json'))]) : [{}]

const duracaoDoLogin = new Trend('login_duracao', true)
const duracaoAutenticada = new Trend('autenticada_duracao', true)
const respostas429 = new Counter('respostas_429')
// Informativo, sem threshold: quem decide é o erro final (a web repete o 503). O número vai para o registro da tarefa.
const respostas503 = new Counter('respostas_503')
const erroFinal = new Counter('login_erro_final')
const entraram = new Counter('contas_que_entraram')
/** As leituras da Semana que voltaram 200 e completas: aula, texto de aula, evento e item do dia. */
const semanasLidas = new Counter('semanas_lidas')
const inesperadas = new Counter('respostas_inesperadas')
const renovacaoRecusada = new Counter('renovacao_recusada')
const renovacaoConcorrente = new Counter('renovacao_409')
const ataqueEnviado = new Counter('ataque_enviado')
const dispositivosObtidos = new Counter('dispositivos_obtidos')
/**
 * Informativo, sem threshold: do primeiro envio do formulário até entrar, com as repetições da web no 503, por grupo da A
 * e da equipe nas fases de ataque. Métrica própria por grupo, e não submétrica, para o p95 ir ao resumo sem threshold e
 * daí ao registro da tarefa: com cookie "sem atraso", sem cookie "em até 30 s".
 */
const GRUPOS_SOB_ATAQUE = ['a_com_cookie', 'a_sem_cookie', 'equipe_com_cookie', 'equipe_sem_cookie']
const ateEntrar = Object.fromEntries(GRUPOS_SOB_ATAQUE.map((grupo) => [grupo, new Trend(`ate_entrar_${grupo}`, true)]))

// ---------------------------------------------------------------------------------------------------------------------
// Cenários e thresholds de cada fase
// ---------------------------------------------------------------------------------------------------------------------

/** B e C usando o sistema: uma conta nova por segundo, que entra e faz dez requisições autenticadas. */
function fundoBC(inicio, duracao) {
  const cenario = (funcao) => ({
    executor: 'constant-arrival-rate',
    exec: funcao,
    rate: 1,
    timeUnit: '2s',
    duration: duracao,
    startTime: inicio,
    preAllocatedVUs: 20,
    maxVUs: 120,
  })
  return { fundo_b: cenario('fundoB'), fundo_c: cenario('fundoC') }
}

/** Os thresholds de um grupo legítimo: nenhum 429, nenhum erro final, nenhuma resposta fora do esperado, e entrou. */
function legitimo(grupo, { p95 = true } = {}) {
  return {
    [`respostas_429{grupo:${grupo}}`]: ['count==0'],
    [`login_erro_final{grupo:${grupo}}`]: ['count==0'],
    [`respostas_inesperadas{grupo:${grupo}}`]: ['count==0'],
    [`contas_que_entraram{grupo:${grupo}}`]: ['count>0'],
    ...(p95 ? { [`login_duracao{grupo:${grupo}}`]: [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`] } : {}),
  }
}

/** B e C mantidos: login abaixo de 1 s e autenticadas até a margem sobre a base. */
function bcMantidos() {
  const base = Number(__ENV.AUTENTICADA_BASE_P95_MS)
  if (!Number.isFinite(base) || base < 0) throw new Error(`a fase ${FASE} precisa de AUTENTICADA_BASE_P95_MS`)
  const limite = Math.ceil(base + MARGEM_SOBRE_A_BASE_MS)
  return {
    ...legitimo('b'),
    ...legitimo('c'),
    'autenticada_duracao{grupo:b}': [`p(95)<=${limite}`],
    'autenticada_duracao{grupo:c}': [`p(95)<=${limite}`],
  }
}

function cenariosDoAtaque(inicio = '0s') {
  return {
    ataque: {
      executor: 'constant-arrival-rate',
      exec: 'atacar',
      rate: ATAQUE_POR_MINUTO,
      timeUnit: '1m',
      duration: DURACAO_DO_ATAQUE,
      startTime: inicio,
      preAllocatedVUs: 150,
      maxVUs: 400,
    },
  }
}

/** O ataque chegou inteiro: sem isto, um cenário em que o atacante não rodou passaria. */
const ATAQUE_CHEGOU = { ataque_enviado: [`count>=${Math.floor(ATAQUE_POR_MINUTO * 3 * 0.95)}`] }

/** As contas legítimas durante o ataque (Tech Spec, 7c, "Passa com"). */
function legitimosSobAtaque() {
  const cenario = (funcao, rate, timeUnit) => ({
    executor: 'constant-arrival-rate',
    exec: funcao,
    rate,
    timeUnit,
    duration: DURACAO_DOS_LEGITIMOS,
    startTime: INICIO_DOS_LEGITIMOS,
    preAllocatedVUs: 20,
    maxVUs: 150,
  })
  const cenarios = {
    a_com_cookie: cenario('aComCookie', 1, '1s'),
    a_sem_cookie: cenario('aSemCookie', 1, '1s'),
    equipe_com_cookie: cenario('equipeComCookie', 1, '10s'),
    equipe_sem_cookie: cenario('equipeSemCookie', 1, '10s'),
    ...fundoBC(INICIO_DOS_LEGITIMOS, DURACAO_DOS_LEGITIMOS),
  }
  // Com cookie: nenhum 429, inclusive o dono da conta da equipe que o script ataca, nenhum erro, e o p95 do login abaixo
  // de 1 s, como a B e a C (Tech Spec, 7c): quem já entrou naquele navegador passa na frente do rebaixado. Sem cookie:
  // entra em até 30 s e nunca termina em erro, com o 503 repetido pela web contando como atraso (com ataque de fora, isso
  // é o "nenhum 503 final"); o atraso dele é o que a Tech Spec, seção 13, aceita para quem ainda não entrou naquele
  // navegador, e fica medido em `ate_entrar_*`, sem p95.
  const thresholds = {
    ...legitimo('a_com_cookie'),
    ...legitimo('equipe_com_cookie'),
    ...legitimo('a_sem_cookie', { p95: false }),
    ...legitimo('equipe_sem_cookie', { p95: false }),
    ...bcMantidos(),
  }
  return { cenarios, thresholds }
}

function configuracao() {
  switch (FASE) {
    case 'base':
      return {
        cenarios: fundoBC('0s', DURACAO_DA_BASE),
        // O threshold das autenticadas também põe o p95 de cada escola no resumo, que é a base das fases seguintes.
        thresholds: { ...legitimo('b'), ...legitimo('c'), 'autenticada_duracao{grupo:b}': [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`], 'autenticada_duracao{grupo:c}': [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`] },
      }
    case 'rajada':
      return {
        cenarios: {
          rajada_primeiro_minuto: {
            executor: 'constant-arrival-rate',
            exec: 'rajada',
            rate: NO_PRIMEIRO_MINUTO,
            timeUnit: '1m',
            duration: '1m',
            preAllocatedVUs: 400,
            maxVUs: 800,
          },
          rajada_resto: {
            executor: 'constant-arrival-rate',
            exec: 'rajada',
            rate: (CONTAS_NA_RAJADA - NO_PRIMEIRO_MINUTO) / 4,
            timeUnit: '1m',
            duration: '4m',
            startTime: '1m',
            preAllocatedVUs: 200,
            maxVUs: 800,
          },
        },
        thresholds: {
          ...legitimo('rajada'),
          // O que o Início do aluno lê depois do login (Tech Spec das telas do aluno, 7c): as autenticadas da rajada, todas, ficam
          // abaixo de 1 s no p95, e a `minhas-atividades` tem o mesmo limite sozinha, para a página lenta não se esconder na
          // média das outras rotas.
          'autenticada_duracao{grupo:rajada}': [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`],
          [`autenticada_duracao{grupo:rajada,name:${ROTA_DAS_TAREFAS}}`]: [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`],
          // O professor abre a Semana depois do login (F2b): a rota roda as consultas da semana em sequência, uma conexão por vez, e tem o
          // mesmo limite sozinha. As 60 leituras vieram com 200 e completas (aula, texto, evento e item do dia): parte vazia quer dizer que o seed
          // falhou, e que a consulta que a Semana paga nem rodou de verdade.
          [`autenticada_duracao{grupo:rajada,name:${ROTA_DA_SEMANA}}`]: [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`],
          semanas_lidas: [`count==${PROFESSORES_NA_RAJADA}`],
          // As 2.100 entraram: nenhuma iteração perdida por falta de VU, nenhuma conta que desistiu.
          'contas_que_entraram{grupo:rajada}': [`count==${CONTAS_NA_RAJADA}`],
          dropped_iterations: ['count==0'],
        },
      }
    case 'renovacao':
      return {
        cenarios: {
          renovacao: { executor: 'constant-arrival-rate', exec: 'renovacao', rate: 5, timeUnit: '1s', duration: '2m', preAllocatedVUs: 40, maxVUs: 200 },
        },
        thresholds: {
          ...legitimo('renovacao'),
          // Nenhuma família de sessões encerrada (401 na renovação) e a concorrência aconteceu de verdade (409).
          renovacao_recusada: ['count==0'],
          renovacao_409: ['count>0'],
          'contas_que_entraram{grupo:renovacao}': [`count==${CONTAS_NA_RENOVACAO}`],
          dropped_iterations: ['count==0'],
        },
      }
    case 'preparacao':
      return {
        cenarios: { preparacao: { executor: 'shared-iterations', exec: 'nada', vus: 1, iterations: 1 } },
        thresholds: { dispositivos_obtidos: [`count==${A_COM_COOKIE.length + 1}`] },
      }
    case 'ataque_dentro': {
      const { cenarios, thresholds } = legitimosSobAtaque()
      return { cenarios: { ...cenarios, ...cenariosDoAtaque() }, thresholds: { ...thresholds, ...ATAQUE_CHEGOU } }
    }
    case 'ataque_fora':
    case 'redis_fora':
      return legitimosSobAtaque()
    case 'atacante':
      return { cenarios: cenariosDoAtaque(), thresholds: ATAQUE_CHEGOU }
    default:
      throw new Error('fase desconhecida')
  }
}

const { cenarios, thresholds } = configuracao()

export const options = {
  scenarios: cenarios,
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  // O nome da requisição agrupa: nenhuma URL com id vira série.
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response'],
  setupTimeout: '120s',
}

// ---------------------------------------------------------------------------------------------------------------------
// A web, imitada
// ---------------------------------------------------------------------------------------------------------------------

const JSON_ = { 'Content-Type': 'application/json' }

function pedidoDeLogin(conta, senha) {
  if (conta.email !== undefined) return { url: `${API}/v1/sessao/email`, corpo: { email: conta.email, senha }, nome: 'POST /v1/sessao/email' }
  return { url: `${API}/v1/sessao/matricula`, corpo: { slug: SLUGS[conta.escola], matricula: conta.matricula, senha }, nome: 'POST /v1/sessao/matricula' }
}

/**
 * Um envio do formulário de login, como a web faz: no 503, espera o `Retry-After` e repete sozinha por até 30 s. Cada
 * tentativa entra no p95 do login; o 429 e o 503 somam no contador do grupo. Devolve a última resposta, ou `undefined`
 * se o prazo da web acabou em 503.
 */
function enviarLogin(conta, senha, grupo, navegador) {
  const { url, corpo, nome } = pedidoDeLogin(conta, senha)
  const inicio = Date.now()
  for (;;) {
    const resposta = http.post(url, JSON.stringify(corpo), { headers: JSON_, jar: navegador.jar, cookies: navegador.cookies, tags: { name: nome, grupo } })
    duracaoDoLogin.add(resposta.timings.duration, { grupo })
    respostas429.add(resposta.status === 429 ? 1 : 0, { grupo })
    respostas503.add(resposta.status === 503 ? 1 : 0, { grupo })
    if (resposta.status !== 503) return resposta
    const espera = Number(resposta.headers['Retry-After'])
    const esperaS = Number.isFinite(espera) && espera > 0 ? espera : 2
    if (Date.now() - inicio + esperaS * 1_000 > PRAZO_DA_WEB_MS) return undefined
    sleep(esperaS)
  }
}

/**
 * A conta entra, errando a senha uma vez antes se `erra`. Conta erro final (a tela mostraria erro) e resposta fora do
 * esperado; devolve o token, ou `undefined`.
 */
function entrar(conta, grupo, navegador, erra = false) {
  const inicio = Date.now()
  if (erra) {
    const errada = enviarLogin(conta, SENHA_ERRADA, grupo, navegador)
    const esperado = errada !== undefined && errada.status === 401
    // O prazo da web acabado em 503 é erro final, e não resposta inesperada.
    inesperadas.add(errada === undefined || esperado ? 0 : 1, { grupo, status: String(errada?.status ?? 503) })
    if (!esperado) {
      erroFinal.add(1, { grupo })
      return undefined
    }
  }
  const resposta = enviarLogin(conta, SENHA, grupo, navegador)
  const token = resposta?.status === 200 ? resposta.json('token') : undefined
  const entrou = typeof token === 'string'
  erroFinal.add(entrou ? 0 : 1, { grupo })
  inesperadas.add(entrou || resposta === undefined ? 0 : 1, { grupo, status: String(resposta?.status ?? 503) })
  if (entrou) entraram.add(1, { grupo })
  if (entrou) ateEntrar[grupo]?.add(Date.now() - inicio)
  return entrou ? token : undefined
}

/**
 * Uma leitura autenticada: soma a duração em `autenticada_duracao`, com a tag `name` da rota (o k6 não copia a tag da
 * requisição para a métrica própria), e conta como inesperada a que não responde 200. Devolve a resposta.
 */
function autenticada(token, grupo, caminho = '/v1/sistema/contexto', nome = `GET ${caminho}`) {
  const resposta = http.get(`${API}${caminho}`, { headers: { Authorization: `Bearer ${token}` }, tags: { name: nome, grupo } })
  duracaoAutenticada.add(resposta.timings.duration, { grupo, name: nome })
  respostas429.add(resposta.status === 429 ? 1 : 0, { grupo })
  inesperadas.add(resposta.status === 200 ? 0 : 1, { grupo, status: String(resposta.status) })
  return resposta
}

/**
 * O que o Início do aluno lê depois do login: a pessoa (`/v1/eu`) e a primeira página das tarefas. As duas têm de responder
 * 200, e a página não pode vir vazia: a escola da carga dá ao aluno turma e atividades, e uma página vazia quer dizer que o
 * seed ou o vínculo falhou, e que a consulta que o Início paga nem rodou de verdade.
 */
function leituraDoInicio(token, grupo) {
  autenticada(token, grupo, '/v1/eu', ROTA_DO_EU)
  const tarefas = autenticada(token, grupo, '/v1/minhas-atividades', ROTA_DAS_TAREFAS)
  const itens = tarefas.status === 200 ? tarefas.json('itens') : undefined
  inesperadas.add(tarefas.status !== 200 || (Array.isArray(itens) && itens.length > 0) ? 0 : 1, { grupo, status: 'pagina_vazia' })
}

/**
 * A segunda-feira (`AAAA-MM-DD`) da semana de hoje em Brasília (UTC-3, sem horário de verão), a que a Semana do professor abre. O seed grava a dele com o
 * relógio do banco na hora em que roda: se o seed rodar na madrugada de domingo e o k6 já na segunda, as duas semanas diferem, e o cenário reprova (falha segura).
 */
function segundaDaSemana() {
  const hoje = new Date(Date.now() - 3 * 3_600_000)
  return new Date(hoje.getTime() - ((hoje.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10)
}

/**
 * O que o professor lê ao abrir a Semana depois do login: a semana de hoje. A leitura só conta quando volta 200 **e completa**: com aula, com o texto de ao
 * menos uma aula, com evento de calendário em algum dia e com item em algum dia. A escola da carga dá a cada professor vínculos, grade, texto, calendário e
 * atividades aplicadas na semana (`semearASemanaDosProfessores`); a que falta uma dessas partes quer dizer que o seed ou o vínculo falhou, e que a consulta
 * correspondente da Semana nem rodou de verdade.
 */
function leituraDaSemana(token, grupo) {
  const caminho = '/v1/semana'
  const resposta = autenticada(token, grupo, `${caminho}?segunda=${segundaDaSemana()}`, ROTA_DA_SEMANA)
  const dias = resposta.status === 200 ? resposta.json('dias') : undefined
  const lista = Array.isArray(dias) ? dias : []
  const comAula = lista.some((dia) => dia.aulas.length > 0)
  const comTexto = lista.some((dia) => dia.aulas.some((aula) => aula.texto !== null))
  const comEvento = lista.some((dia) => dia.eventos.length > 0)
  const comItem = lista.some((dia) => dia.itens.length > 0)
  const completa = comAula && comTexto && comEvento && comItem
  semanasLidas.add(completa ? 1 : 0)
  inesperadas.add(resposta.status !== 200 || completa ? 0 : 1, { grupo, status: 'semana_incompleta' })
}

/** Um navegador novo: sem cookie nenhum, ou só com o `educa_dispositivo` de quem já entrou nele. */
function navegador(dispositivo) {
  return { jar: new http.CookieJar(), cookies: dispositivo === undefined ? {} : { educa_dispositivo: { value: dispositivo, replace: true } } }
}

function daIteracao(lista_, deslocamento = 0) {
  return lista_[(exec.scenario.iterationInTest + deslocamento) % lista_.length]
}

// ---------------------------------------------------------------------------------------------------------------------
// Preparação: quem já entrou neste navegador antes (o cookie de dispositivo vem de um login de verdade)
// ---------------------------------------------------------------------------------------------------------------------

/** Na preparação, sem ataque: cada conta "com cookie" entra uma vez, como a web, e o cookie que o login grava é guardado. */
export function setup() {
  if (FASE !== 'preparacao') return {}
  const cookies = {}
  for (let posicao = 0; posicao <= A_COM_COOKIE.length; posicao++) {
    const conta = posicao < A_COM_COOKIE.length ? A_COM_COOKIE[posicao] : EQUIPE_ALVO
    const resposta = enviarLogin(conta, SENHA, 'preparacao', navegador())
    const valor = resposta?.cookies.educa_dispositivo?.[0]?.value
    if (resposta?.status !== 200 || valor === undefined) continue
    cookies[conta.email ?? conta.matricula] = valor
    dispositivosObtidos.add(1)
  }
  return { cookies }
}

export function nada() {}

/** Os cookies da preparação saem num arquivo da pasta da execução, lido pelas fases de ataque. */
export function handleSummary(dados) {
  return FASE === 'preparacao' ? { '/execucao/dispositivos.json': JSON.stringify(dados.setup_data?.cookies ?? {}) } : {}
}

// ---------------------------------------------------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------------------------------------------------

function usarOSistema(conta, grupo, requisicoes) {
  const token = entrar(conta, grupo, navegador())
  if (token === undefined) return
  for (let vez = 0; vez < requisicoes; vez++) {
    autenticada(token, grupo)
    sleep(1)
  }
}

export function fundoB() {
  usarOSistema(daIteracao(B_FUNDO), 'b', 10)
}

export function fundoC() {
  usarOSistema(daIteracao(C_FUNDO), 'c', 10)
}

export function rajada() {
  // A taxa constante pode dar uma iteração a mais no fim de cada trecho: ela não repete a conta do trecho seguinte.
  const noTrecho = exec.scenario.iterationInTest
  const primeiro = exec.scenario.name !== 'rajada_resto'
  if (noTrecho >= (primeiro ? NO_PRIMEIRO_MINUTO : CONTAS_NA_RAJADA - NO_PRIMEIRO_MINUTO)) return
  const conta = RAJADA[primeiro ? noTrecho : NO_PRIMEIRO_MINUTO + noTrecho]
  if (conta === undefined) return
  const token = entrar(conta, 'rajada', navegador(), conta.erra)
  if (token === undefined) return
  // O aluno abre o Início, e o professor abre a Semana: a equipe da rajada é só de professores.
  if (conta.matricula !== undefined) leituraDoInicio(token, 'rajada')
  if (conta.email !== undefined) leituraDaSemana(token, 'rajada')
  for (let vez = 0; vez < 3; vez++) {
    sleep(1)
    autenticada(token, 'rajada')
  }
}

/**
 * Duas abas do mesmo navegador renovam juntas com o mesmo cookie (o pior caso: sem a trava entre abas da web). Uma
 * rotaciona; a outra recebe 409 `JA_RENOVADO`, espera mais de 2 s e tenta uma vez com o cookie atual, como a web. Cada
 * aba usa o token que recebeu. Nenhuma família pode ser encerrada.
 */
export function renovacao() {
  const conta = RENOVACAO[exec.scenario.iterationInTest]
  if (conta === undefined) return
  const aba = navegador()
  const token = entrar(conta, 'renovacao', aba)
  if (token === undefined) return
  autenticada(token, 'renovacao')
  const renovar = () => ['POST', `${API}/v1/sessao/renovar`, null, { jar: aba.jar, tags: { name: 'POST /v1/sessao/renovar', grupo: 'renovacao' } }]
  const respostas = http.batch([renovar(), renovar()])
  for (const resposta of respostas) {
    renovacaoConcorrente.add(resposta.status === 409 ? 1 : 0)
    renovacaoRecusada.add(resposta.status === 401 ? 1 : 0)
    inesperadas.add([200, 409].includes(resposta.status) ? 0 : 1, { grupo: 'renovacao', status: String(resposta.status) })
    if (resposta.status === 200) autenticada(resposta.json('token'), 'renovacao')
  }
  for (let vez = respostas.filter((cada) => cada.status === 409).length; vez > 0; vez--) {
    sleep(ESPERA_DEPOIS_DO_409_S)
    const [denovo] = http.batch([renovar()])
    renovacaoRecusada.add(denovo.status === 401 ? 1 : 0)
    inesperadas.add(denovo.status === 200 ? 0 : 1, { grupo: 'renovacao', status: String(denovo.status) })
    if (denovo.status === 200) autenticada(denovo.json('token'), 'renovacao')
  }
}

export function aComCookie() {
  const conta = daIteracao(A_COM_COOKIE)
  const token = entrar(conta, 'a_com_cookie', navegador(DISPOSITIVOS[conta.matricula]))
  if (token !== undefined) autenticada(token, 'a_com_cookie')
}

export function aSemCookie() {
  const token = entrar(daIteracao(A_SEM_COOKIE), 'a_sem_cookie', navegador())
  if (token !== undefined) autenticada(token, 'a_sem_cookie')
}

export function equipeComCookie() {
  const token = entrar(EQUIPE_ALVO, 'equipe_com_cookie', navegador(DISPOSITIVOS[EQUIPE_ALVO.email]))
  if (token !== undefined) autenticada(token, 'equipe_com_cookie')
}

export function equipeSemCookie() {
  const token = entrar(daIteracao(EQUIPE_SEM_COOKIE), 'equipe_sem_cookie', navegador())
  if (token !== undefined) autenticada(token, 'equipe_sem_cookie')
}

/**
 * Uma tentativa do ataque, sem repetir no 503 (o script não imita a web): as pares em matrículas da A, as ímpares em
 * e-mails. Uma em cinco de cada vai a uma conta que existe (as matrículas e os e-mails do grupo de alvos, que nenhuma
 * conta legítima do cenário usa); uma em dez dos e-mails vai à conta da equipe cujo dono entra com cookie; o resto, a
 * identificadores que não existem, um diferente a cada tentativa.
 */
export function atacar() {
  const numero = exec.scenario.iterationInTest
  const vez = Math.floor(numero / 2)
  let conta
  if (numero % 2 === 0) conta = vez % 5 === 0 ? { escola: 'A', matricula: ALVOS_MATRICULA[vez % ALVOS_MATRICULA.length] } : { escola: 'A', matricula: `9${String(vez).padStart(7, '0')}` }
  else if (vez % 10 === 0) conta = EQUIPE_ALVO
  else conta = vez % 5 === 0 ? { email: ALVOS_EMAIL[vez % ALVOS_EMAIL.length] } : { email: `ataque-${String(vez)}-${String(exec.vu.idInTest)}@carga-login.invalid` }
  const { url, corpo, nome } = pedidoDeLogin(conta, SENHA_ERRADA)
  http.post(url, JSON.stringify(corpo), { headers: JSON_, jar: new http.CookieJar(), tags: { name: nome, grupo: 'ataque' }, responseCallback: http.expectedStatuses(401, 429, 503) })
  ataqueEnviado.add(1)
}
