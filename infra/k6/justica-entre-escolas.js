// Cenário "justiça entre escolas" (Tech Spec, seção 7c; PRD, RF8 e RF18). Roda num container do compose de
// carga, na mesma rede: todos os VUs saem de um IP só. Quem o chama é infra/scripts/carga.ts, uma vez por fase:
//
//   FASE=base   só a escola B, 2 jobs interativos de 100 ms de CPU por segundo e 1,5 turno do Tutor por segundo (a rota
//               `POST /v1/tutor/mensagens`, com o adaptador falso de latência simulada), por 2 min. O p95 da espera
//               do job e o do turno saem no resumo, e viram a base das fases seguintes.
//   FASE=expurgo a mesma carga da B, com o p95 da base mais a margem nos dois thresholds, enquanto o worker de lote
//               expurga e troca o nome na escola A (F3, tarefa 19.0). O trabalho da A não é do k6: infra/scripts/carga.ts
//               o grava em `job_registro` poucos segundos depois de a fase começar e confere o que o banco viu.
//   FASE=sala   a carga da manhã (X6, tarefa 11.0; RF6): dez escolas, cada uma com seis turmas no Tutor e a professora nas ferramentas ao mesmo
//               tempo, por 3 min, com a latência por perfil do adaptador falso. Roda só no build da tarefa, e é relatório, não portão: os
//               thresholds daqui são os de cada escola (nenhum "indisponível", nenhuma 429, turno e ferramenta que terminam); a espera p95 do
//               Tutor e a da ferramenta saem do `job_registro`, e o `kill -9` do `worker-ia-1` é de infra/scripts/carga.ts.
//   FASE=reserva a carga da manhã com a queda do principal (F5b, tarefa 9.0): a mesma carga da sala, em cinco janelas com intervalo (a taxa cai a zero entre
//               elas), e quem troca a falha do principal falso e liga a reserva em cada intervalo é infra/scripts/carga.ts (as variáveis do worker só mudam na
//               subida). O k6 só gera a carga e conta o que o aluno viu; o veredito de cada janela sai do banco e do Prometheus, e é relatório, não portão.
//   FASE=carga  as fases 2, 3 e 4 ao mesmo tempo, por 2 min: a escola A enfileira 2.000 lotes urgentes de 2 s
//               e 500 interativos de 100 ms em rajada, enquanto a B repete a base; 400 usuários da escola C
//               chamam `contexto` uma vez por segundo, e um usuário da C, cinco vezes; 400 visitantes anônimos
//               recarregam a casca a cada 30 s.
//
// Os thresholds derrubam o código de saída do k6 (99). Um threshold precisa de amostra para valer: toda
// resposta soma no contador do seu grupo, com 1 quando é 429 e 0 quando não é, e nenhum grupo passa em branco.
// Espera é `iniciadoEm - criadoEm` do job, os dois do relógio do Postgres, lidos pela API. O turno do Tutor é o tempo
// que o aluno espera: do `POST` à primeira leitura da execução `concluida`, medido aqui (a API não devolve datas da execução).
//
// Nenhum dado de pessoa: escolas e usuários sintéticos, com tokens de sessões reais de `ops:sessao-sintetica`.

import { sleep } from 'k6'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'

const FASE = __ENV.FASE
const API = __ENV.API_URL
const WEB = __ENV.WEB_URL
const ARQUIVO_DOS_TOKENS = __ENV.ARQUIVO_DOS_TOKENS
if (FASE !== 'base' && FASE !== 'expurgo' && FASE !== 'carga' && FASE !== 'sala' && FASE !== 'reserva') throw new Error('FASE precisa ser base, expurgo, carga, sala ou reserva')
/** As duas fases que usam as dez escolas da sala: a carga da manhã e a da queda do principal. */
const NA_SALA = FASE === 'sala' || FASE === 'reserva'
if (!API || !WEB || !ARQUIVO_DOS_TOKENS) throw new Error('defina API_URL, WEB_URL e ARQUIVO_DOS_TOKENS')

/** Margem declarada sobre a espera da base (PRD, RF18). */
const MARGEM_SOBRE_A_BASE_MS = 500
/** Nenhum job interativo espera mais que isto: é o alerta do runbook. */
const ESPERA_MAXIMA_INTERATIVO_MS = 30_000
const DURACAO = '2m'
const JOBS_DE_LOTE_DA_A = 2_000
const JOBS_INTERATIVOS_DA_A = 500
const USUARIOS_DA_A_NO_LOTE = 40
const USUARIOS_DA_A_NO_INTERATIVO = 10
const USUARIOS_NORMAIS_DA_C = 400
const VUS_DO_ABUSIVO = 2
const VUS_MAXIMOS_DA_B = 60
const VISITANTES_ANONIMOS = 400
/** Depois disso sem `iniciadoEm`, o job da B conta como sem início: o cenário já reprovou. */
const PRAZO_PARA_INICIAR_MS = 60_000
/** Turnos do Tutor da B: 3 a cada 2 s (1,5 por segundo), abaixo do teto de 120 pedidos de IA por minuto por escola. */
const TURNOS_DA_B_POR_2S = 3
const PRAZO_DO_TURNO_MS = 30_000
const VUS_MAXIMOS_DO_TUTOR_DA_B = 40

/** A carga da manhã (`FASE=sala`, X6, 11.0; `docs/infra.md` 3.2): 10 escolas, 60 alunos em 6 turmas e 2 professoras em cada uma. */
const ESCOLAS_DA_SALA = 10
const ALUNOS_POR_ESCOLA_DA_SALA = 60
const PROFESSORAS_POR_ESCOLA_DA_SALA = 2
/** 0,75 turno por segundo por escola (45 por minuto), e a professora: 1 ferramenta e 4 propostas por minuto (`onda-3a.md`, "A conta, por réplica"). */
const TURNOS_DA_SALA_POR_MINUTO = 45
const FERRAMENTAS_DA_SALA_POR_MINUTO = 1
const PROPOSTAS_DA_SALA_POR_MINUTO = 4
const DURACAO_DA_SALA = '3m'
/** A fase `reserva` (F5b, 9.0): a duração da carga de cada janela e o intervalo sem carga entre duas, em segundos. São os de `JANELAS_DA_RESERVA` de infra/scripts/carga.ts, que `infra/test/carga.test.ts` confere. O intervalo deixa o worker trocar de configuração sem fila e sem execução nova. */
const DURACOES_DAS_JANELAS_DA_RESERVA_S = [30, 30, 30, 30, 60]
const INTERVALO_ENTRE_AS_JANELAS_S = 70
/** O Tutor espera a execução até 90 s: acima dos 60 s do prazo único da execução do perfil `rapido` (`PRAZO_DA_EXECUCAO_MS`, e não os 20 s de uma chamada ao modelo) e dos ~15 s da reentrega do job do worker morto (`EXECUCAO_INTERROMPIDA`). A ferramenta (`padrao`), até 170 s, acima dos 140 s do prazo único da execução dela. */
const PRAZO_DO_TURNO_DA_SALA_MS = 90_000
const PRAZO_DA_FERRAMENTA_DA_SALA_MS = 170_000
/** O turno de uma escola, no k6: a espera p95 de 2 s (RF6) mais os 6 s do modelo e o passo de 1 s da consulta (o intervalo que a web usa, `INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS`). A ferramenta: 10 s de espera, 50 s de modelo e a consulta. */
const TURNO_P95_DA_SALA_MS = 9_000
const FERRAMENTA_P95_DA_SALA_MS = 61_000
const PASSO_DA_CONSULTA_DA_SALA_S = 1
/** O tema da ferramenta: palavras que o material da carga tem como a busca em português as lê (o `estequiometria` do pedido vira o radical `estequiometr`, e o capítulo escreve `estequiométrica`). */
const TEMA_DA_FERRAMENTA_DA_SALA = 'reagente limitante e proporção estequiométrica'

const esperaDaB = new Trend('espera_b', true)
// Só informativa, sem threshold: a espera vai até `iniciadoEm`, marcado antes de o job pegar thread no sandbox do
// worker. Se a B passar a esperar thread atrás da A dentro do worker, é aqui que aparece.
const duracaoDaB = new Trend('duracao_b', true)
const semInicioDaB = new Counter('jobs_b_sem_inicio')
// O turno do Tutor da B, do `POST` à execução concluída (F3, tarefa 19.0). O Trend não aceita `count`: o contador ao lado
// soma um por turno concluído, e sem nenhum o threshold `count>0` reprova.
const turnoDaB = new Trend('turno_b', true)
const turnosConcluidosDaB = new Counter('turnos_b_concluidos')
const respostas429 = new Counter('respostas_429')
const respostasInesperadas = new Counter('respostas_inesperadas')
const jobsAceitos = new Counter('jobs_aceitos')
// A carga da manhã (`FASE=sala`): o que o k6 vê do lado do aluno e da professora, por escola (`escola:e<n>`).
const turnoDaSala = new Trend('turno_sala', true)
const ferramentaDaSala = new Trend('ferramenta_sala', true)
const turnosDaSalaConcluidos = new Counter('turnos_sala_concluidos')
const ferramentasDaSalaConcluidas = new Counter('ferramentas_sala_concluidas')
const propostasDaSalaConcluidas = new Counter('propostas_sala_concluidas')
/** O aluno que viu "indisponível" (`IA_INDISPONIVEL`): é o que a carga da manhã não pode ter. */
const indisponiveisDaSala = new Counter('indisponiveis_sala')
/** Só na `FASE=reserva`: a execução que terminou `IA_TEMPO_ESGOTADO` (a queda por prazo a produz, tipada); na `sala` ela segue sendo resposta inesperada. */
const temposEsgotadosDaReserva = new Counter('tempos_esgotados_reserva')
/** Execução que terminou `EXECUCAO_INTERROMPIDA` (o `kill -9` do `worker-ia-1`): fora de `respostas_inesperadas`, com teto lido por infra/scripts/carga.ts. */
const execucoesInterrompidas = new Counter('execucoes_interrompidas')

// Uma cópia para todos os VUs, e não uma por VU.
const tokens = (grupo) => new SharedArray(`tokens-${grupo}`, () => JSON.parse(open(ARQUIVO_DOS_TOKENS))[grupo] ?? [])
const TOKENS_A_LOTE = tokens('a_lote')
const TOKENS_A_INTERATIVO = tokens('a_interativo')
const TOKENS_B = tokens('b')
const TOKENS_B_TUTOR = tokens('b_tutor')
const TOKENS_C = tokens('c')
const TOKEN_ABUSIVO = tokens('abusivo')
const indicesDaSala = Array.from({ length: ESCOLAS_DA_SALA }, (_, indice) => indice)
// Só nas fases `sala` e `reserva` os tokens das dez escolas existem: nas outras, o arquivo não os tem e a lista fica vazia.
const ALUNOS_DA_SALA = NA_SALA ? indicesDaSala.map((indice) => tokens(`sala_aluno_${indice}`)) : []
const PROFESSORAS_DA_SALA = NA_SALA ? indicesDaSala.map((indice) => tokens(`sala_professora_${indice}`)) : []
/** Cada escola da sala guarda, no arquivo dos tokens, a turma e a disciplina em que as professoras têm vínculo: `sala_alvo_<n>` = [turmaId, disciplinaId]. */
const ALVOS_DA_SALA = NA_SALA ? indicesDaSala.map((indice) => tokens(`sala_alvo_${indice}`)) : []
// O arquivo de tokens tem de trazer os alunos e as professoras que o script criou: sem eles a carga de uma escola pediria com o mesmo usuário e bateria no limite por usuário.
if (NA_SALA) {
  for (const indice of indicesDaSala) {
    if (ALUNOS_DA_SALA[indice].length !== ALUNOS_POR_ESCOLA_DA_SALA || PROFESSORAS_DA_SALA[indice].length !== PROFESSORAS_POR_ESCOLA_DA_SALA) {
      throw new Error(`a escola ${indice + 1} da sala não trouxe ${ALUNOS_POR_ESCOLA_DA_SALA} alunos e ${PROFESSORAS_POR_ESCOLA_DA_SALA} professoras`)
    }
  }
}

function base() {
  const esperaB = __ENV.ESPERA_BASE_P95_MS
  const cenarios = {
    escola_b: {
      executor: 'constant-arrival-rate',
      exec: 'escolaB',
      rate: 2,
      timeUnit: '1s',
      duration: DURACAO,
      preAllocatedVUs: 20,
      maxVUs: VUS_MAXIMOS_DA_B,
    },
  }
  // O Tutor da B só nas fases base e expurgo: é o turno que o expurgo da A poderia atrasar, e a carga mede outra coisa.
  if (FASE !== 'carga') {
    cenarios.escola_b_tutor = {
      executor: 'constant-arrival-rate',
      exec: 'escolaBTutor',
      rate: TURNOS_DA_B_POR_2S,
      timeUnit: '2s',
      duration: DURACAO,
      preAllocatedVUs: 10,
      maxVUs: VUS_MAXIMOS_DO_TUTOR_DA_B,
    }
  }
  const thresholds = {
    espera_b: [`max<${ESPERA_MAXIMA_INTERATIVO_MS}`],
    jobs_b_sem_inicio: ['count==0'],
    'respostas_429{grupo:b}': ['count==0'],
    // Por grupo, e não no total: a reprovação já diz quem recebeu o status fora do esperado.
    'respostas_inesperadas{grupo:b}': ['count==0'],
  }
  if (FASE !== 'carga') {
    // Nenhum grupo passa em branco: sem turno concluído, `count>0` reprova.
    thresholds.turnos_b_concluidos = ['count>0']
    thresholds.turno_b = [`max<${PRAZO_DO_TURNO_MS}`]
    thresholds['respostas_429{grupo:b_tutor}'] = ['count==0']
    thresholds['respostas_inesperadas{grupo:b_tutor}'] = ['count==0']
  }
  if (FASE === 'base') return { cenarios, thresholds }
  const limite = Number(esperaB)
  if (esperaB === undefined || !Number.isFinite(limite) || limite < 0) throw new Error(`a fase ${FASE} precisa de ESPERA_BASE_P95_MS`)
  const turnoBase = Number(__ENV.TURNO_BASE_P95_MS)
  const comTurno = FASE === 'expurgo'
  if (comTurno && (__ENV.TURNO_BASE_P95_MS === undefined || !Number.isFinite(turnoBase) || turnoBase < 0)) throw new Error('a fase expurgo precisa de TURNO_BASE_P95_MS')
  return {
    cenarios,
    thresholds: {
      ...thresholds,
      espera_b: [`p(95)<=${limite + MARGEM_SOBRE_A_BASE_MS}`, `max<${ESPERA_MAXIMA_INTERATIVO_MS}`],
      ...(comTurno ? { turno_b: [`p(95)<=${turnoBase + MARGEM_SOBRE_A_BASE_MS}`, `max<${PRAZO_DO_TURNO_MS}`] } : {}),
    },
  }
}

function carga() {
  return {
    cenarios: {
      escola_a_lotes: {
        executor: 'shared-iterations',
        exec: 'escolaALote',
        vus: USUARIOS_DA_A_NO_LOTE,
        iterations: JOBS_DE_LOTE_DA_A,
        maxDuration: DURACAO,
      },
      escola_a_interativos: {
        executor: 'shared-iterations',
        exec: 'escolaAInterativo',
        vus: USUARIOS_DA_A_NO_INTERATIVO,
        iterations: JOBS_INTERATIVOS_DA_A,
        maxDuration: DURACAO,
      },
      escola_c: { executor: 'constant-vus', exec: 'escolaC', vus: USUARIOS_NORMAIS_DA_C, duration: DURACAO },
      escola_c_abusivo: {
        executor: 'constant-arrival-rate',
        exec: 'escolaCAbusivo',
        rate: 5,
        timeUnit: '1s',
        duration: DURACAO,
        // Dois VUs com o mesmo token: é um usuário só, e a taxa não perde iteração se uma resposta demorar.
        preAllocatedVUs: VUS_DO_ABUSIVO,
        maxVUs: VUS_DO_ABUSIVO,
      },
      anonimos: { executor: 'constant-vus', exec: 'anonimo', vus: VISITANTES_ANONIMOS, duration: DURACAO },
    },
    thresholds: {
      // A carga chegou inteira: sem isto, um cenário que não enfileirou nada passaria.
      'jobs_aceitos{grupo:a_lote}': [`count==${JOBS_DE_LOTE_DA_A}`],
      'jobs_aceitos{grupo:a_interativo}': [`count==${JOBS_INTERATIVOS_DA_A}`],
      // 429 só para o usuário abusivo: nem os 400 da C, nem os anônimos atrás do mesmo IP, nem a A na rajada.
      'respostas_429{grupo:c}': ['count==0'],
      'respostas_429{grupo:c_abusivo}': ['count>0'],
      'respostas_429{grupo:anonimo}': ['count==0'],
      'respostas_429{grupo:a}': ['count==0'],
      'respostas_inesperadas{grupo:a}': ['count==0'],
      'respostas_inesperadas{grupo:c}': ['count==0'],
      'respostas_inesperadas{grupo:c_abusivo}': ['count==0'],
      'respostas_inesperadas{grupo:anonimo}': ['count==0'],
    },
  }
}

function sala() {
  const cenarios = {}
  const thresholds = {
    // Nenhum aluno vê "indisponível", e nenhuma resposta foge do esperado nem leva 429: a carga da manhã é a de uma escola usando como deve.
    indisponiveis_sala: ['count==0'],
  }
  for (const grupo of ['sala_tutor', 'sala_ferramenta', 'sala_proposta']) {
    thresholds[`respostas_429{grupo:${grupo}}`] = ['count==0']
    thresholds[`respostas_inesperadas{grupo:${grupo}}`] = ['count==0']
  }
  for (const indice of indicesDaSala) {
    const escola = `e${indice + 1}`
    const ambiente = { ESCOLA: String(indice) }
    cenarios[`sala_tutor_${escola}`] = {
      executor: 'constant-arrival-rate',
      exec: 'salaTutor',
      env: ambiente,
      rate: TURNOS_DA_SALA_POR_MINUTO,
      timeUnit: '1m',
      duration: DURACAO_DA_SALA,
      preAllocatedVUs: 8,
      maxVUs: 30,
      gracefulStop: '100s',
    }
    cenarios[`sala_ferramenta_${escola}`] = {
      executor: 'constant-arrival-rate',
      exec: 'salaFerramenta',
      env: ambiente,
      rate: FERRAMENTAS_DA_SALA_POR_MINUTO,
      timeUnit: '1m',
      duration: DURACAO_DA_SALA,
      preAllocatedVUs: 2,
      maxVUs: 6,
      gracefulStop: '180s',
    }
    cenarios[`sala_proposta_${escola}`] = {
      executor: 'constant-arrival-rate',
      exec: 'salaProposta',
      env: ambiente,
      rate: PROPOSTAS_DA_SALA_POR_MINUTO,
      timeUnit: '1m',
      duration: DURACAO_DA_SALA,
      preAllocatedVUs: 1,
      maxVUs: 4,
      gracefulStop: '100s',
    }
    // Por escola: nenhum grupo passa em branco (o turno e a ferramenta terminam), e o p95 do k6 fica no que a espera do RF6 mais o modelo permitem.
    thresholds[`turnos_sala_concluidos{escola:${escola}}`] = ['count>0']
    thresholds[`ferramentas_sala_concluidas{escola:${escola}}`] = ['count>0']
    thresholds[`turno_sala{escola:${escola}}`] = [`p(95)<${TURNO_P95_DA_SALA_MS}`]
    thresholds[`ferramenta_sala{escola:${escola}}`] = [`p(95)<${FERRAMENTA_P95_DA_SALA_MS}`]
  }
  return { cenarios, thresholds }
}

/**
 * A fase `reserva` (F5b, 9.0): a carga da sala em janelas. Cada cenário é o mesmo da sala (o Tutor de cada escola, a ferramenta e a proposta da professora), mas com taxa que
 * sobe a cada janela e cai a zero no intervalo (`ramping-arrival-rate`): é no intervalo que infra/scripts/carga.ts troca a falha do principal falso e liga ou desliga a reserva. Sem o
 * intervalo, o worker que reinicia atrasaria o p95 da janela. Os thresholds são os do aluno que não vê erro de rede, e não os de "indisponível" nem de turno: quem julga cada janela é o banco.
 */
function reserva() {
  const cenarios = {}
  const thresholds = {}
  for (const grupo of ['sala_tutor', 'sala_ferramenta', 'sala_proposta']) {
    thresholds[`respostas_429{grupo:${grupo}}`] = ['count==0']
    thresholds[`respostas_inesperadas{grupo:${grupo}}`] = ['count==0']
  }
  const estagios = (porMinuto) => {
    const lista = []
    DURACOES_DAS_JANELAS_DA_RESERVA_S.forEach((duracao, indice) => {
      lista.push({ target: porMinuto, duration: '1s' }, { target: porMinuto, duration: `${duracao - 1}s` })
      if (indice < DURACOES_DAS_JANELAS_DA_RESERVA_S.length - 1) lista.push({ target: 0, duration: '1s' }, { target: 0, duration: `${INTERVALO_ENTRE_AS_JANELAS_S - 1}s` })
    })
    return lista
  }
  for (const indice of indicesDaSala) {
    const escola = `e${indice + 1}`
    const ambiente = { ESCOLA: String(indice) }
    const base = { executor: 'ramping-arrival-rate', env: ambiente, startRate: 0, timeUnit: '1m' }
    cenarios[`sala_tutor_${escola}`] = { ...base, exec: 'salaTutor', stages: estagios(TURNOS_DA_SALA_POR_MINUTO), preAllocatedVUs: 8, maxVUs: 30, gracefulStop: '100s' }
    cenarios[`sala_ferramenta_${escola}`] = { ...base, exec: 'salaFerramenta', stages: estagios(FERRAMENTAS_DA_SALA_POR_MINUTO), preAllocatedVUs: 2, maxVUs: 6, gracefulStop: '180s' }
    cenarios[`sala_proposta_${escola}`] = { ...base, exec: 'salaProposta', stages: estagios(PROPOSTAS_DA_SALA_POR_MINUTO), preAllocatedVUs: 1, maxVUs: 4, gracefulStop: '100s' }
    // Nenhum grupo passa em branco: o Tutor de cada escola termina turnos nas cinco janelas.
    thresholds[`turnos_sala_concluidos{escola:${escola}}`] = ['count>0']
  }
  return { cenarios, thresholds }
}

const daBase = NA_SALA ? { cenarios: {}, thresholds: {} } : base()
const daCarga = FASE === 'carga' ? carga() : { cenarios: {}, thresholds: {} }
const daSala = FASE === 'sala' ? sala() : FASE === 'reserva' ? reserva() : { cenarios: {}, thresholds: {} }

export const options = {
  scenarios: { ...daBase.cenarios, ...daCarga.cenarios, ...daSala.cenarios },
  thresholds: { ...daBase.thresholds, ...daCarga.thresholds, ...daSala.thresholds },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: false,
  // Os ids de job na URL virariam uma série por job; o nome da requisição agrupa.
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response'],
}

function cabecalhos(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** Soma a resposta no grupo: 429 no contador de limite; qualquer outro status fora do esperado, no de inesperadas. */
function contar(resposta, grupo, esperado) {
  const limitada = resposta.status === 429
  respostas429.add(limitada ? 1 : 0, { grupo })
  const aceitavel = resposta.status === esperado || (limitada && grupo === 'c_abusivo')
  respostasInesperadas.add(aceitavel ? 0 : 1, { grupo, status: String(resposta.status) })
  return resposta.status === esperado
}

function criarJob(token, grupo, pedido) {
  const resposta = http.post(`${API}/v1/sistema/jobs-sinteticos`, JSON.stringify({ naoUrgente: false, ...pedido }), {
    headers: cabecalhos(token),
    tags: { name: 'POST /v1/sistema/jobs-sinteticos' },
  })
  return contar(resposta, grupo, 202) ? resposta.json('jobId') : undefined
}

/** Cada token recebe a mesma quantidade de iterações: nenhum usuário passa do próprio limite por minuto. */
function tokenDaIteracao(lista) {
  return lista[exec.scenario.iterationInTest % lista.length]
}

/** Um token por VU, e nunca dois VUs com o mesmo: os VUs têm id único no teste, e há tokens para todos. */
function tokenDoVu(lista) {
  const token = lista[exec.vu.idInTest - 1]
  if (token === undefined) exec.test.abort('tokens da escola C a menos que VUs no teste')
  return token
}

export function escolaB() {
  const token = tokenDaIteracao(TOKENS_B)
  const jobId = criarJob(token, 'b', { fila: 'interativa', cpuMs: 100 })
  if (jobId === undefined) return
  const prazo = Date.now() + PRAZO_PARA_INICIAR_MS
  let esperaMedida = false
  while (Date.now() < prazo) {
    sleep(0.2)
    const resposta = http.get(`${API}/v1/sistema/jobs-sinteticos/${jobId}`, {
      headers: cabecalhos(token),
      tags: { name: 'GET /v1/sistema/jobs-sinteticos/:id' },
    })
    if (!contar(resposta, 'b', 200)) return
    const { criadoEm, iniciadoEm, concluidoEm } = resposta.json()
    if (iniciadoEm && !esperaMedida) {
      esperaDaB.add(Date.parse(iniciadoEm) - Date.parse(criadoEm))
      esperaMedida = true
    }
    if (concluidoEm) {
      duracaoDaB.add(Date.parse(concluidoEm) - Date.parse(criadoEm))
      return
    }
  }
  if (!esperaMedida) semInicioDaB.add(1)
}

/** Um UUID v4: a `chaveEnvio` do turno é única por pergunta, e o k6 não traz `crypto.randomUUID` em toda versão. */
function novaChaveDeEnvio() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (letra) => {
    const sorteio = Math.floor(Math.random() * 16)
    return (letra === 'x' ? sorteio : (sorteio & 0x3) | 0x8).toString(16)
  })
}

/**
 * Um turno do Tutor de um aluno da B, pela rota de verdade: a pergunta, a execução e a leitura dela até concluir. É o que
 * lê e grava `execucao_agente`, `mensagem_tutor` e `consumo_ia` na escola B, as tabelas que o expurgo da A atualiza em lote.
 */
export function escolaBTutor() {
  const token = tokenDaIteracao(TOKENS_B_TUTOR)
  const inicio = Date.now()
  const pedido = http.post(`${API}/v1/tutor/mensagens`, JSON.stringify({ texto: 'Pergunta sintética de carga sobre o assunto da aula.', chaveEnvio: novaChaveDeEnvio() }), {
    headers: cabecalhos(token),
    tags: { name: 'POST /v1/tutor/mensagens' },
  })
  if (!contar(pedido, 'b_tutor', 202)) return
  const execucaoId = pedido.json('execucaoId')
  while (Date.now() < inicio + PRAZO_DO_TURNO_MS) {
    sleep(0.1)
    const resposta = http.get(`${API}/v1/execucoes/${execucaoId}`, { headers: cabecalhos(token), tags: { name: 'GET /v1/execucoes/:id' } })
    if (!contar(resposta, 'b_tutor', 200)) return
    const estado = resposta.json('estado')
    if (estado === 'concluida') {
      turnoDaB.add(Date.now() - inicio)
      turnosConcluidosDaB.add(1)
      return
    }
    if (estado === 'falhou') {
      respostasInesperadas.add(1, { grupo: 'b_tutor', status: 'execucao_falhou' })
      return
    }
  }
  respostasInesperadas.add(1, { grupo: 'b_tutor', status: 'sem_conclusao' })
}

/**
 * Consulta a execução até ela terminar. Devolve `concluida`, o `erro` quando falhou, ou `sem_conclusao` no prazo. O resto (status fora do esperado) já
 * foi somado por `contar`, e a consulta para.
 */
function esperarExecucao(token, grupo, execucaoId, prazoMs) {
  const limite = Date.now() + prazoMs
  while (Date.now() < limite) {
    sleep(PASSO_DA_CONSULTA_DA_SALA_S)
    const resposta = http.get(`${API}/v1/execucoes/${execucaoId}`, { headers: cabecalhos(token), tags: { name: 'GET /v1/execucoes/:id' } })
    if (!contar(resposta, grupo, 200)) return 'resposta_inesperada'
    const { estado, erro } = resposta.json()
    if (estado === 'concluida') return 'concluida'
    if (estado === 'falhou') return erro ?? 'falhou'
  }
  return 'sem_conclusao'
}

/** O fim de uma execução da sala: "indisponível" e `EXECUCAO_INTERROMPIDA` têm contador próprio, e qualquer outra falha é resposta inesperada do grupo. */
function fecharExecucaoDaSala(desfecho, grupo, escola) {
  if (desfecho === 'concluida' || desfecho === 'resposta_inesperada') return desfecho === 'concluida'
  if (desfecho === 'IA_INDISPONIVEL') indisponiveisDaSala.add(1, { escola, grupo })
  else if (desfecho === 'IA_TEMPO_ESGOTADO' && FASE === 'reserva') temposEsgotadosDaReserva.add(1, { escola, grupo })
  else if (desfecho === 'EXECUCAO_INTERROMPIDA') execucoesInterrompidas.add(1, { escola, grupo })
  else respostasInesperadas.add(1, { grupo, status: desfecho })
  return false
}

/** Um turno do Tutor de um aluno de uma das dez escolas, pela rota de verdade, do `POST` à execução terminada. */
export function salaTutor() {
  const indice = Number(__ENV.ESCOLA)
  const escola = `e${indice + 1}`
  const token = tokenDaIteracao(ALUNOS_DA_SALA[indice])
  const inicio = Date.now()
  const pedido = http.post(`${API}/v1/tutor/mensagens`, JSON.stringify({ texto: 'Pergunta sintética de carga sobre o assunto da aula.', chaveEnvio: novaChaveDeEnvio() }), {
    headers: cabecalhos(token),
    tags: { name: 'POST /v1/tutor/mensagens' },
  })
  if (!contar(pedido, 'sala_tutor', 202)) return
  const desfecho = esperarExecucao(token, 'sala_tutor', pedido.json('execucaoId'), PRAZO_DO_TURNO_DA_SALA_MS)
  if (fecharExecucaoDaSala(desfecho, 'sala_tutor', escola)) {
    turnoDaSala.add(Date.now() - inicio, { escola })
    turnosDaSalaConcluidos.add(1, { escola })
  }
}

/** A professora pede uma atividade (`padrao`, ~50 s): é a ferramenta que ocupa a fila `ferramenta` da escola dela. */
export function salaFerramenta() {
  const indice = Number(__ENV.ESCOLA)
  const escola = `e${indice + 1}`
  const token = tokenDaIteracao(PROFESSORAS_DA_SALA[indice])
  const alvo = ALVOS_DA_SALA[indice]
  const turmaId = alvo[0]
  const disciplinaId = alvo[1]
  const inicio = Date.now()
  const pedido = http.post(
    `${API}/v1/ferramentas/atividade_objetiva/gerar`,
    JSON.stringify({ turmaId, disciplinaId, tema: TEMA_DA_FERRAMENTA_DA_SALA, quantidade: 3, chaveEnvio: novaChaveDeEnvio() }),
    { headers: cabecalhos(token), tags: { name: 'POST /v1/ferramentas/:ferramenta/gerar' } },
  )
  if (!contar(pedido, 'sala_ferramenta', 202)) return
  const desfecho = esperarExecucao(token, 'sala_ferramenta', pedido.json('execucaoId'), PRAZO_DA_FERRAMENTA_DA_SALA_MS)
  if (fecharExecucaoDaSala(desfecho, 'sala_ferramenta', escola)) {
    ferramentaDaSala.add(Date.now() - inicio, { escola })
    ferramentasDaSalaConcluidas.add(1, { escola })
  }
}

/** A professora conversa com o Assistente (`rapido`, ~6 s): a proposta de ferramenta, na fila `ferramenta`. */
export function salaProposta() {
  const indice = Number(__ENV.ESCOLA)
  const escola = `e${indice + 1}`
  const token = tokenDaIteracao(PROFESSORAS_DA_SALA[indice])
  const alvo = ALVOS_DA_SALA[indice]
  const turmaId = alvo[0]
  const disciplinaId = alvo[1]
  const pedido = http.post(
    `${API}/v1/assistente/mensagens`,
    JSON.stringify({ texto: 'Quero uma atividade de estequiometria para a turma.', turmaId, disciplinaId, chaveEnvio: novaChaveDeEnvio() }),
    { headers: cabecalhos(token), tags: { name: 'POST /v1/assistente/mensagens' } },
  )
  if (!contar(pedido, 'sala_proposta', 202)) return
  const desfecho = esperarExecucao(token, 'sala_proposta', pedido.json('execucaoId'), PRAZO_DO_TURNO_DA_SALA_MS)
  if (fecharExecucaoDaSala(desfecho, 'sala_proposta', escola)) propostasDaSalaConcluidas.add(1, { escola })
}

export function escolaALote() {
  if (criarJob(tokenDaIteracao(TOKENS_A_LOTE), 'a', { fila: 'lote', cpuMs: 2_000 }) !== undefined) {
    jobsAceitos.add(1, { grupo: 'a_lote' })
  }
}

export function escolaAInterativo() {
  if (criarJob(tokenDaIteracao(TOKENS_A_INTERATIVO), 'a', { fila: 'interativa', cpuMs: 100 }) !== undefined) {
    jobsAceitos.add(1, { grupo: 'a_interativo' })
  }
}

function contexto(token, grupo) {
  const resposta = http.get(`${API}/v1/sistema/contexto`, { headers: cabecalhos(token), tags: { name: 'GET /v1/sistema/contexto' } })
  contar(resposta, grupo, 200)
}

export function escolaC() {
  // Sem começar todos no mesmo milissegundo: 400 alunos não chegam juntos nem na mesma sala.
  if (exec.vu.iterationInScenario === 0) sleep(Math.random())
  contexto(tokenDoVu(TOKENS_C), 'c')
  sleep(1)
}

export function escolaCAbusivo() {
  contexto(TOKEN_ABUSIVO[0], 'c_abusivo')
}

/**
 * O `vite preview` da web recusa (403) nome de host que não conhece, contra DNS rebinding. O navegador chega a ela
 * por 127.0.0.1, e o k6 manda o mesmo `Host`, chegando pelo nome do serviço na rede do compose.
 */
const HOST_DA_WEB = { Host: '127.0.0.1:4173' }

/** O que o navegador busca ao recarregar a casca: a página, os arquivos dela e as duas rotas anônimas da API. */
export function anonimo() {
  if (exec.vu.iterationInScenario === 0) sleep(Math.random() * 30)
  const pagina = http.get(`${WEB}/`, { headers: HOST_DA_WEB, tags: { name: 'GET /' } })
  contar(pagina, 'anonimo', 200)
  const arquivos = [...String(pagina.body).matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(([, caminho]) => caminho)
  // A casca sem nenhum arquivo não é a casca: conta como resposta inesperada, e não como recarga leve.
  if (pagina.status === 200) respostasInesperadas.add(arquivos.length === 0 ? 1 : 0, { grupo: 'anonimo', status: 'sem_arquivos' })
  for (const resposta of http.batch(arquivos.map((caminho) => ['GET', `${WEB}${caminho}`, null, { headers: HOST_DA_WEB, tags: { name: 'GET /assets' } }]))) {
    contar(resposta, 'anonimo', 200)
  }
  for (const rota of ['/v1/sistema/estado', '/v1/sistema/avisos']) {
    contar(http.get(`${WEB}${rota}`, { headers: HOST_DA_WEB, tags: { name: `GET ${rota}` } }), 'anonimo', 200)
  }
  sleep(30)
}
