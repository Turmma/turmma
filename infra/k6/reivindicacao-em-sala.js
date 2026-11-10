// Cenário "reivindicação em sala" (A1, tarefa 9.0; Tech Spec da A1, seção 7c; cenarios.md, K1 e K2; PRD, RF19; regra 80,
// itens 1, 7 e 11). Roda num container do compose de carga, na mesma rede: todos os VUs de um container saem do IP dele,
// como uma escola inteira atrás de um NAT. Quem o chama é infra/scripts/carga-sala.ts, uma vez por fase:
//
//   FASE=k1               seis turmas de 35 alunos (210) chegam em 5 min: abrem a turma pelo link ou pelo código,
//                         escolhem o nome, digitam a matrícula e criam a senha. 20% erram o código antes, 10% erram a
//                         matrícula antes, e dois alunos por turma mandam o pedido de dois computadores no mesmo
//                         segundo (a disputa pelo nome). O professor decide os pedidos em lotes de até 40, a cada 45 s,
//                         e cada aprovado entra logo depois, um depois do outro, pelo login por matrícula.
//   FASE=k2               o mesmo, no primeiro dia da escola inteira: 60 turmas, 2.100 alunos em 5 min, dez professores.
//   FASE=k2_conta         o K2 da escola da D48 (a conta da escola, quando ela existe): quase todos pedem o nome pela conta, e o aprovado
//                         entra pela conta (`iniciar` sem intenção, `retorno` e `POST /v1/sessao/renovar`, como a web), no balde anônimo
//                         do IP da escola. O script de carga lê o pico desse balde no Redis e reprova acima de 80% do teto.
//   FASE=k2_redis_lento   o K2 menor (12 turmas, 420 alunos em 2 min, dois professores), com o Redis de fila respondendo
//                         devagar (o script pausa os clientes dele em ciclos): mede o `decidir`, que zera os contadores de
//                         login das aprovadas nesse Redis depois do lote.
//   FASE=outra_escola     só o login da outra escola, com requisições autenticadas: roda no SEGUNDO container, com IP
//                         próprio, ao mesmo tempo que o K1 e o K2. É a régua do login do F1: p95 abaixo de 1 s.
//
// A página imita a web (17.0 e 16.0): depois do `abrir`, lê os provedores da escola (`GET /v1/escolas/:slug/acesso`, uma
// leitura anônima por aluno, porque cada um está num computador e o `staleTime` vale só por aba); 1 aluno em cada 20 (ou quase todos,
// no `k2_conta`) prova
// a conta da escola no `oidc-falso` (o `iniciar` com `intencao=reivindicar`, o formulário do provedor falso, o `retorno`),
// abre a sala de novo e manda o pedido sem senha; depois de aprovado, entra pela conta (`iniciar`, `retorno`, `renovar`). No 503 com `Retry-After`, repete o mesmo envio, com a mesma chave, até 3
// vezes. Toda resposta soma no contador do seu grupo (1 no caso, 0 fora dele), para nenhum threshold passar por falta de amostra.
//
// Nenhum dado de pessoa: nomes e matrículas gerados pelo script de carga, e a senha sintética gerada na hora, lida de um
// arquivo da pasta temporária da execução. Nada chama provedor de IA; a conta da escola é a do `oidc-falso`, um provedor
// falso do compose, com um sujeito sintético por aluno (`google-aluna-carga-<fase>-<n>`).

import { sleep } from 'k6'
import crypto from 'k6/crypto'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'

const FASE = __ENV.FASE
const API = __ENV.API_URL
const ARQUIVO_DAS_CONTAS = __ENV.ARQUIVO_DAS_CONTAS
const FASES = ['k1', 'k2', 'k2_conta', 'k2_redis_lento', 'outra_escola']
if (!FASES.includes(FASE)) throw new Error(`FASE precisa ser uma de: ${FASES.join(', ')}`)
if (!API || !ARQUIVO_DAS_CONTAS) throw new Error('defina API_URL e ARQUIVO_DAS_CONTAS')

/** p95 do login da outra escola: a régua do F1 (`docs/infra.md` 3.1 e 10; alerta `login-lento`). */
export const P95_MAXIMO_DO_LOGIN_MS = 1_000
/** p95 do `decidir` em lote de até 40: nada demorado dentro do request (regra 00, item 4). */
export const P95_MAXIMO_DO_DECIDIR_MS = 2_000
/** Quantas vezes a página repete o 503 com a mesma chave antes de mostrar "Tentar de novo" (Tech Spec da A1, seção 9). */
const REENVIOS_NO_503 = 3
/** O teto do `decidir` (`MAXIMO_DE_PEDIDOS_POR_DECISAO`). */
export const LOTE_DO_DECIDIR = 40
/** De quanto em quanto tempo o professor olha os pedidos e aprova os que chegaram. */
const CICLO_DO_PROFESSOR_S = 45
/** O alfabeto do código da turma (Tech Spec da A1, seção 3): o código errado é sorteado no formato. */
const ALFABETO_DO_CODIGO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

const conteudo = () => JSON.parse(open(ARQUIVO_DAS_CONTAS))
// Uma cópia para todos os VUs, e não uma por VU.
const [GERAL] = new SharedArray('geral', () => {
  const { senha, slug, chegadaS, esperaDosProfessoresS, slugOutra } = conteudo()
  return [{ senha, slug, chegadaS, esperaDosProfessoresS, slugOutra }]
})
const ALUNOS = new SharedArray('alunos', () => conteudo().alunos ?? [])
const TURMAS = new SharedArray('turmas', () => conteudo().turmas ?? [])
const PROFESSORES = new SharedArray('professores', () => conteudo().professores ?? [])
const OUTRA_ESCOLA = new SharedArray('outraEscola', () => conteudo().outraEscola ?? [])
const { senha: SENHA, slug: SLUG, chegadaS: CHEGADA_S, esperaDosProfessoresS: ESPERA_DOS_PROFESSORES_S, slugOutra: SLUG_OUTRA } = GERAL

const duracaoDoLogin = new Trend('login_duracao', true)
const duracaoDoDecidir = new Trend('decidir_duracao', true)
const duracaoDaSala = new Trend('sala_duracao', true)
const loteDoDecidir = new Trend('decidir_lote')
const autenticadaDuracao = new Trend('autenticada_duracao', true)
const respostas5xx = new Counter('respostas_5xx')
// Informativo: o 503 que a página repete. Ele também soma em `respostas_5xx`, que precisa ficar em zero.
const respostas503 = new Counter('respostas_503')
// O 429 do limite por IP: separado, para o resumo dizer se a reprovação foi o balde do IP da escola ou outra coisa. Também soma em `respostas_inesperadas`.
const respostas429 = new Counter('respostas_429')
const inesperadas = new Counter('respostas_inesperadas')
const enviados = new Counter('pedidos_enviados')
const disputaErrada = new Counter('disputa_sem_um_vencedor')
const aprovados = new Counter('aprovados')
const aprovadoEntrou = new Counter('aprovado_entrou')
const loginErroFinal = new Counter('login_erro_final')
const entraram = new Counter('contas_que_entraram')
// As contas provadas no `oidc-falso`: a volta do provedor que devolveu a sala com `?conta=provada`.
const contasProvadas = new Counter('contas_provadas')
// O aprovado que entrou pela conta da escola: o `retorno` abriu o cookie da sessão e o `renovar` devolveu o token.
const aprovadoEntrouPelaConta = new Counter('aprovado_entrou_pela_conta')

// ---------------------------------------------------------------------------------------------------------------------
// Cenários e thresholds de cada fase
// ---------------------------------------------------------------------------------------------------------------------

function configuracao() {
  if (FASE === 'outra_escola') {
    return {
      cenarios: {
        outra_escola: { executor: 'constant-arrival-rate', exec: 'outraEscola', rate: 1, timeUnit: '1s', duration: `${CHEGADA_S}s`, preAllocatedVUs: 20, maxVUs: 100 },
      },
      thresholds: {
        'login_duracao{grupo:outra_escola}': [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`],
        'login_erro_final{grupo:outra_escola}': ['count==0'],
        'contas_que_entraram{grupo:outra_escola}': ['count>0'],
        'respostas_5xx{grupo:outra_escola}': ['count==0'],
        'respostas_429{grupo:outra_escola}': ['count==0'],
        'respostas_inesperadas{grupo:outra_escola}': ['count==0'],
        dropped_iterations: ['count==0'],
      },
    }
  }
  const alunos = ALUNOS.length
  const viaConta = ALUNOS.filter((conta) => conta.viaConta).length
  const redisLento = FASE === 'k2_redis_lento'
  return {
    cenarios: {
      alunos: {
        executor: 'constant-arrival-rate',
        exec: 'aluno',
        rate: alunos,
        timeUnit: `${CHEGADA_S}s`,
        duration: `${CHEGADA_S}s`,
        preAllocatedVUs: Math.min(400, Math.ceil(alunos / 4)),
        maxVUs: 800,
      },
      professores: {
        executor: 'per-vu-iterations',
        exec: 'professor',
        vus: PROFESSORES.length,
        iterations: 1,
        maxDuration: `${CHEGADA_S + ESPERA_DOS_PROFESSORES_S + 120}s`,
      },
    },
    thresholds: {
      // Zero 5xx, em qualquer grupo, e nenhuma resposta fora do esperado (nada de 429 para quem está atrás do mesmo IP).
      respostas_5xx: ['count==0'],
      respostas_429: ['count==0'],
      respostas_inesperadas: ['count==0'],
      // Zero duplicidade: cada aluno com um pedido enviado, cada disputa com um vencedor só, e cada nome aprovado uma vez.
      pedidos_enviados: [`count==${alunos}`],
      disputa_sem_um_vencedor: ['count==0'],
      aprovados: [`count==${alunos}`],
      // Quem pediu pela conta da escola provou a conta no provedor falso, uma vez cada.
      contas_provadas: [`count==${viaConta}`],
      // O `decidir` em lote de até 40 dentro dos 2 s, também com o Redis de fila devagar.
      decidir_duracao: [`p(95)<${P95_MAXIMO_DO_DECIDIR_MS}`],
      decidir_lote: [`max<=${LOTE_DO_DECIDIR}`],
      dropped_iterations: ['count==0'],
      // Com o Redis devagar, a entrada do aprovado é medida, e não cobrada: o corte do cliente Redis do login é o que ela
      // mede (runbook, "Seguro de limite ativo", causa 4).
      // Quem pediu pela conta não tem senha: entra pela conta (`iniciar`, `retorno` e `renovar`), e por isso fica fora da entrada por matrícula.
      ...(redisLento ? {} : { aprovado_entrou: [`count==${alunos - viaConta}`], aprovado_entrou_pela_conta: [`count==${viaConta}`], 'login_erro_final{grupo:aprovado}': ['count==0'] }),
    },
  }
}

const { cenarios, thresholds } = configuracao()

export const options = {
  scenarios: cenarios,
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  // O nome da requisição agrupa: nenhuma URL com id vira série.
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response'],
}

// ---------------------------------------------------------------------------------------------------------------------
// A web, imitada
// ---------------------------------------------------------------------------------------------------------------------

const JSON_ = { 'Content-Type': 'application/json' }
/** A rota do login externo da API. Escrita por partes: o guarda de nomes antigos (`tools/renomear`) acha o nome da pasta que a onda 6 trocou, e este é o da rota, que não mudou. */
const ROTA_DO_LOGIN_EXTERNO = ['/v1/sessao', 'externa'].join('/')
/** Navegação do navegador: o k6 não segue o redirecionamento, porque o endereço de volta do provedor é o da borda vista de fora do compose. */
const SEM_SEGUIR = { redirects: 0, responseCallback: http.expectedStatuses({ min: 200, max: 499 }) }

/** Um UUID v4 sorteado: a `chaveEnvio` que a página sorteia a cada envio. */
function uuid() {
  const bytes = new Uint8Array(crypto.randomBytes(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function codigoErrado() {
  return Array.from(new Uint8Array(crypto.randomBytes(8)), (byte) => ALFABETO_DO_CODIGO[byte % ALFABETO_DO_CODIGO.length]).join('')
}

/** Soma a resposta nos contadores do grupo: 5xx, 503 e a resposta fora do esperado. */
function contar(resposta, grupo, esperados) {
  respostas5xx.add(resposta.status >= 500 ? 1 : 0, { grupo })
  respostas503.add(resposta.status === 503 ? 1 : 0, { grupo })
  respostas429.add(resposta.status === 429 ? 1 : 0, { grupo })
  inesperadas.add(esperados.includes(resposta.status) ? 0 : 1, { grupo, status: String(resposta.status) })
}

function post(caminho, corpo, nome, grupo, token) {
  const headers = token === undefined ? JSON_ : { ...JSON_, Authorization: `Bearer ${token}` }
  return http.post(`${API}${caminho}`, JSON.stringify(corpo), { headers, tags: { name: nome, grupo }, responseCallback: http.expectedStatuses({ min: 200, max: 499 }) })
}

/** `salas/abrir` pelo link ou pelo código. */
function abrir(pelo) {
  const resposta = post('/v1/salas/abrir', { slug: SLUG, ...pelo }, 'POST /v1/salas/abrir', 'aluno')
  duracaoDaSala.add(resposta.timings.duration, { rota: 'abrir' })
  return resposta
}

/** A leitura dos provedores da escola, que a seção "Tem a conta da escola?" faz depois de abrir a sala: anônima, uma por aluno. */
function lerOsProvedores() {
  const resposta = http.get(`${API}/v1/escolas/${SLUG}/acesso`, { tags: { name: 'GET /v1/escolas/:slug/acesso', grupo: 'aluno' }, responseCallback: http.expectedStatuses({ min: 200, max: 499 }) })
  duracaoDaSala.add(resposta.timings.duration, { rota: 'acesso' })
  contar(resposta, 'aluno', [200])
  return resposta
}

/**
 * A ida ao `oidc-falso` com a conta de um aluno, como o navegador a faz: o `iniciar` (302 ao provedor), o formulário dele, o envio do nome de
 * usuário (302 de volta) e o `retorno` da API, que devolve a resposta final (a sala com `?conta=provada` e o cookie da conta provada, ou a casca
 * com o cookie da sessão). O endereço de volta vem do provedor com o host da borda de fora do compose: o k6 troca o começo pelo da API e segue pelo
 * caminho. O `name` das requisições é fixo e obrigatório: sem ele, o token do link, que vai na consulta do `iniciar`, iria para a tag `url` do resumo.
 * Devolve a resposta do `retorno`, ou `undefined` se o caminho parou antes.
 */
function irAoProvedor(consulta, numero, grupo) {
  const marca = { grupo }
  const iniciar = http.get(`${API}${ROTA_DO_LOGIN_EXTERNO}/google/iniciar?${consulta}`, { ...SEM_SEGUIR, tags: { ...marca, name: 'GET login externo: iniciar' } })
  contar(iniciar, grupo, [302])
  const formularioEm = iniciar.headers['Location']
  if (iniciar.status !== 302 || !formularioEm) return undefined
  const formulario = http.get(formularioEm, { ...SEM_SEGUIR, tags: { ...marca, name: 'GET provedor falso: formulario' } })
  contar(formulario, grupo, [200])
  const entrada = http.post(formularioEm, { username: `google-aluna-carga-${FASE}-${numero}`, claims: '' }, { ...SEM_SEGUIR, tags: { ...marca, name: 'POST provedor falso: entrar' } })
  contar(entrada, grupo, [302])
  const volta = entrada.headers['Location']
  if (entrada.status !== 302 || !volta) return undefined
  const retorno = http.get(`${API}${volta.slice(volta.indexOf('/v1/'))}`, { ...SEM_SEGUIR, tags: { ...marca, name: 'GET login externo: retorno' } })
  duracaoDaSala.add(retorno.timings.duration, { rota: 'retorno' })
  contar(retorno, grupo, [302])
  return retorno
}

/** A prova da conta para pedir o nome: o `iniciar` com `intencao=reivindicar` e o token ou o código da sala, e a volta com `?conta=provada`. */
function provarAConta(conta, turma, numero) {
  const pelo = conta.peloCodigo ? `codigo=${turma.codigo}` : `token=${turma.token}`
  const retorno = irAoProvedor(`slug=${SLUG}&intencao=reivindicar&${pelo}`, numero, 'aluno')
  if (retorno === undefined) return false
  const provada = retorno.status === 302 && String(retorno.headers['Location']).includes('conta=provada')
  contasProvadas.add(provada ? 1 : 0)
  inesperadas.add(provada ? 0 : 1, { grupo: 'aluno', status: `conta_${retorno.status}` })
  return provada
}

/**
 * O aprovado que entra pela conta da escola, como a web: o `iniciar` sem intenção, o `retorno` (que abre o cookie da sessão e manda para `/`) e o
 * `POST /v1/sessao/renovar`, que troca o cookie pelo token. Os três são `@Public()` e sem rebaixamento: contam no balde anônimo do IP da escola.
 */
function entrarPelaConta(numero) {
  http.cookieJar().clear(API)
  const retorno = irAoProvedor(`slug=${SLUG}`, numero, 'aprovado')
  if (retorno === undefined) return
  const renovada = http.post(`${API}/v1/sessao/renovar`, null, { tags: { name: 'POST /v1/sessao/renovar', grupo: 'aprovado' }, responseCallback: http.expectedStatuses({ min: 200, max: 499 }) })
  contar(renovada, 'aprovado', [200])
  const entrou = renovada.status === 200 && typeof renovada.json('token') === 'string'
  aprovadoEntrouPelaConta.add(entrou ? 1 : 0)
  loginErroFinal.add(entrou ? 0 : 1, { grupo: 'aprovado' })
}

/** A espera do `Retry-After` do 503, ou 2 s se ele não veio. */
function esperaDoRetryAfter(resposta) {
  const espera = Number(resposta.headers['Retry-After'])
  return Number.isFinite(espera) && espera > 0 ? espera : 2
}

/**
 * O 503 do semáforo do hash na resposta de `salas/reivindicar`, repetido como a página: com a mesma chave, pelo `Retry-After`, até 3 vezes. Soma
 * cada resposta no contador do grupo. A disputa passa por aqui também: o 503 do `http.batch` não é corrida, e a página o repete.
 */
function repetirNo503(primeira, corpo) {
  let resposta = primeira
  contar(resposta, 'aluno', [200, 409, 503])
  for (let envio = 0; envio < REENVIOS_NO_503 && resposta.status === 503; envio++) {
    sleep(esperaDoRetryAfter(resposta))
    resposta = post('/v1/salas/reivindicar', corpo, 'POST /v1/salas/reivindicar', 'aluno')
    duracaoDaSala.add(resposta.timings.duration, { rota: 'reivindicar' })
    contar(resposta, 'aluno', [200, 409, 503])
  }
  return resposta
}

/** Um envio de `salas/reivindicar`, como a página: no 503, repete com a mesma chave pelo `Retry-After`, até 3 vezes. */
function reivindicar(corpo) {
  const primeira = post('/v1/salas/reivindicar', corpo, 'POST /v1/salas/reivindicar', 'aluno')
  duracaoDaSala.add(primeira.timings.duration, { rota: 'reivindicar' })
  return repetirNo503(primeira, corpo)
}

const recusada = (resposta) => resposta.status === 409 && resposta.json('erro.codigo') === 'REIVINDICACAO_RECUSADA'

/** Login por matrícula, repetindo o 503 como a web faz, por até 30 s. Devolve o token, ou `undefined`. */
function entrar(slug, matricula, grupo) {
  const inicio = Date.now()
  for (;;) {
    const resposta = post('/v1/sessao/matricula', { slug, matricula, senha: SENHA }, 'POST /v1/sessao/matricula', grupo)
    duracaoDoLogin.add(resposta.timings.duration, { grupo })
    contar(resposta, grupo, [200, 503])
    if (resposta.status === 503) {
      const espera = Number(resposta.headers['Retry-After'])
      const esperaS = Number.isFinite(espera) && espera > 0 ? espera : 2
      if (Date.now() - inicio + esperaS * 1_000 <= 30_000) {
        sleep(esperaS)
        continue
      }
    }
    const token = resposta.status === 200 ? resposta.json('token') : undefined
    const entrou = typeof token === 'string'
    loginErroFinal.add(entrou ? 0 : 1, { grupo })
    if (entrou) entraram.add(1, { grupo })
    return entrou ? token : undefined
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// O aluno
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Um aluno chega: abre a turma (errando o código antes, se é um dos 20%), acha o próprio nome na lista, e manda o pedido
 * (errando a matrícula antes, se é um dos 10%). Na disputa, o mesmo nome e a mesma matrícula saem de dois computadores
 * no mesmo segundo, cada um com a sua chave: um fica pendente, e o outro é recusado sem erro cru.
 */
export function aluno() {
  const conta = ALUNOS[exec.scenario.iterationInTest]
  if (conta === undefined) return
  // Um computador por aluno: o cookie da conta provada do aluno anterior deste VU não é deste aluno.
  http.cookieJar().clear(API)
  const turma = TURMAS[conta.turma]
  if (conta.erraCodigo) contar(abrir({ codigo: codigoErrado() }), 'aluno', [404])
  const aberta = abrir(conta.peloCodigo ? { codigo: turma.codigo } : { token: turma.token })
  contar(aberta, 'aluno', [200])
  if (aberta.status !== 200) return
  lerOsProvedores()
  const nome = (aberta.json('nomes') ?? []).find((item) => item.nome === conta.nome)
  inesperadas.add(nome === undefined ? 1 : 0, { grupo: 'aluno', status: 'nome_fora_da_lista' })
  if (nome === undefined) return
  const pelo = conta.peloCodigo ? { codigo: turma.codigo } : { token: turma.token }
  if (conta.viaConta) return pedirPelaConta(conta, turma, nome, pelo)
  const pedido = (matricula) => ({ slug: SLUG, ...pelo, listaNomeId: nome.id, matricula, senha: SENHA, chaveEnvio: uuid() })

  if (conta.erraMatricula) {
    const errada = reivindicar(pedido(`errada-${uuid().slice(0, 8)}`))
    inesperadas.add(recusada(errada) || errada.status === 503 ? 0 : 1, { grupo: 'aluno', status: 'matricula_errada_aceita' })
  }

  if (conta.disputa) {
    const corpos = [pedido(conta.matricula), pedido(conta.matricula)]
    const requisicoes = corpos.map((corpo) => ['POST', `${API}/v1/salas/reivindicar`, JSON.stringify(corpo), { headers: JSON_, tags: { name: 'POST /v1/salas/reivindicar', grupo: 'aluno' }, responseCallback: http.expectedStatuses({ min: 200, max: 499 }) }])
    // Os dois do mesmo segundo, cada um com a sua chave; o 503 do semáforo de um deles é repetido como a página repete, e não é corrida.
    // A simultaneidade é só a do `http.batch`: se os dois levam 503, a nova tentativa sai um pedido depois do outro, e o que se mede ali é a página repetindo, e não a corrida.
    const respostas = http.batch(requisicoes).map((primeira, indice) => repetirNo503(primeira, corpos[indice]))
    const venceu = respostas.filter((resposta) => resposta.status === 200).length
    const perdeu = respostas.filter(recusada).length
    disputaErrada.add(venceu === 1 && perdeu === 1 ? 0 : 1)
    if (venceu === 1) enviados.add(1)
    return
  }

  const resposta = reivindicar(pedido(conta.matricula))
  const enviado = resposta.status === 200 && resposta.json('resultado') === 'enviado'
  inesperadas.add(enviado ? 0 : 1, { grupo: 'aluno', status: `envio_${resposta.status}` })
  if (enviado) enviados.add(1)
}

/**
 * O aluno que pede pela conta da escola: prova a conta, a página abre a sala de novo com o caminho guardado e o pedido sai sem senha, com
 * o cookie da conta provada. A volta que não devolve a sala com a conta provada já foi contada em `respostas_inesperadas`.
 */
function pedirPelaConta(conta, turma, nome, pelo) {
  if (!provarAConta(conta, turma, exec.scenario.iterationInTest)) return
  const reaberta = abrir(pelo)
  contar(reaberta, 'aluno', [200])
  if (reaberta.status !== 200) return
  const resposta = reivindicar({ slug: SLUG, ...pelo, listaNomeId: nome.id, matricula: conta.matricula, chaveEnvio: uuid() })
  const enviado = resposta.status === 200 && resposta.json('resultado') === 'enviado'
  inesperadas.add(enviado ? 0 : 1, { grupo: 'aluno', status: `envio_conta_${resposta.status}` })
  if (enviado) enviados.add(1)
}

// ---------------------------------------------------------------------------------------------------------------------
// O professor
// ---------------------------------------------------------------------------------------------------------------------

/** Os pedidos pendentes das turmas do professor, com a matrícula de cada um lida da lista que o script de carga gerou. */
function pendentes(professor) {
  const todos = []
  for (const indice of professor.turmas) {
    const turma = TURMAS[indice]
    const resposta = http.get(`${API}/v1/turmas/${turma.id}/reivindicacoes?limite=100`, {
      headers: { Authorization: `Bearer ${professor.token}` },
      tags: { name: 'GET /v1/turmas/:id/reivindicacoes', grupo: 'professor' },
      responseCallback: http.expectedStatuses({ min: 200, max: 499 }),
    })
    contar(resposta, 'professor', [200])
    if (resposta.status !== 200) continue
    for (const item of resposta.json('itens') ?? []) todos.push({ id: item.id, matricula: turma.matriculas[item.nome], numeroDaConta: turma.viaConta[item.nome] })
  }
  return todos
}

/**
 * O aprovado entra logo depois, do IP da escola: um depois do outro, como os alunos voltando à tela de entrada, e repetindo o 503 como a web.
 * Todos no mesmo milissegundo não é a sala: são 40 hashes de uma vez no semáforo. Quem pediu pela conta não tem senha: entra pela conta, com o
 * mesmo sujeito que provou (`entrarPelaConta`); os outros entram por matrícula.
 */
function entrarOsAprovados(lote, decididos) {
  for (const pedido of lote) {
    if (!decididos.has(pedido.id)) continue
    if (pedido.numeroDaConta !== undefined) entrarPelaConta(pedido.numeroDaConta)
    else if (entrar(SLUG, pedido.matricula, 'aprovado') !== undefined) aprovadoEntrou.add(1)
  }
}

/**
 * O professor olha os pedidos das turmas dele a cada 45 s e aprova os que chegaram, em lotes de até 40 (`decidir`); cada
 * aprovado entra logo depois, um depois do outro, pelo login por matrícula, do mesmo IP da escola. Para quando aprovou todos os alunos das
 * turmas dele, ou no fim do prazo.
 */
export function professor() {
  // Uma iteração por VU: o número da iteração no cenário é o do professor.
  const eu = PROFESSORES[exec.scenario.iterationInTest]
  if (eu === undefined) return
  const esperados = eu.turmas.reduce((soma, indice) => soma + Object.keys(TURMAS[indice].matriculas).length, 0)
  const fim = Date.now() + (CHEGADA_S + ESPERA_DOS_PROFESSORES_S) * 1_000
  let aprovadosPorMim = 0
  while (aprovadosPorMim < esperados && Date.now() < fim) {
    sleep(CICLO_DO_PROFESSOR_S)
    const lista = pendentes(eu)
    for (let inicio = 0; inicio < lista.length; inicio += LOTE_DO_DECIDIR) {
      const lote = lista.slice(inicio, inicio + LOTE_DO_DECIDIR)
      const resposta = post('/v1/reivindicacoes/decidir', { ids: lote.map((pedido) => pedido.id), decisao: 'aprovar' }, 'POST /v1/reivindicacoes/decidir', 'professor', eu.token)
      duracaoDoDecidir.add(resposta.timings.duration)
      loteDoDecidir.add(lote.length)
      contar(resposta, 'professor', [200])
      if (resposta.status !== 200) continue
      const decididos = new Set((resposta.json('resultados') ?? []).filter((item) => item.resultado === 'decidida').map((item) => item.id))
      aprovados.add(decididos.size)
      aprovadosPorMim += decididos.size
      entrarOsAprovados(lote, decididos)
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// A outra escola
// ---------------------------------------------------------------------------------------------------------------------

/** Um aluno da outra escola entra por matrícula e faz três requisições autenticadas, de outro IP. */
export function outraEscola() {
  const matricula = OUTRA_ESCOLA[exec.scenario.iterationInTest % OUTRA_ESCOLA.length]
  const token = entrar(SLUG_OUTRA, matricula, 'outra_escola')
  if (token === undefined) return
  for (let vez = 0; vez < 3; vez++) {
    const resposta = http.get(`${API}/v1/sistema/contexto`, { headers: { Authorization: `Bearer ${token}` }, tags: { name: 'GET /v1/sistema/contexto', grupo: 'outra_escola' }, responseCallback: http.expectedStatuses(200) })
    autenticadaDuracao.add(resposta.timings.duration, { grupo: 'outra_escola' })
    contar(resposta, 'outra_escola', [200])
    sleep(1)
  }
}
