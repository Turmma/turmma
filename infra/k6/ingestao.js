// Cenário "300 apostilas numa noite" (ingestao-do-material, tarefa 9.0; Tech Spec, seção 7c; PRD, RF15). Roda num container do compose de
// carga, na mesma rede. Quem o chama é infra/scripts/carga-ingestao.ts, duas vezes:
//
//   FASE=base       só a escola B no Tutor: 1,5 turno por segundo (a rota `POST /v1/tutor/mensagens`, com o adaptador falso de latência
//                   simulada), pela duração dada. O p95 do turno sai no resumo e no banco, e é a régua da fase seguinte.
//   FASE=ingestao   a mesma carga da B, com o p95 da base mais a margem no threshold, enquanto o driver do Node envia as 300 apostilas da escola A
//                   (três coordenadores, rota real, com o guard) e uma da B. O envio não é do k6: o multipart com 300 arquivos únicos fica mais
//                   simples e mais fiel no driver, e o que o k6 mede é o que o aluno da B espera.
//
// O turno é o tempo que o aluno espera: do `POST` à primeira leitura da execução `concluida`, medido aqui (a API não devolve datas da execução);
// o veredito usa o do banco (`criada_em` a `concluida_em`), sem o polling. Nenhum dado de pessoa: escola e alunos sintéticos, com tokens de sessões reais.

import { sleep } from 'k6'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'

const FASE = __ENV.FASE
const API = __ENV.API_URL
const ARQUIVO_DOS_TOKENS = __ENV.ARQUIVO_DOS_TOKENS
const DURACAO = __ENV.DURACAO
if (FASE !== 'base' && FASE !== 'ingestao') throw new Error('FASE precisa ser base ou ingestao')
if (!API || !ARQUIVO_DOS_TOKENS || !DURACAO) throw new Error('defina API_URL, ARQUIVO_DOS_TOKENS e DURACAO')

/** Margem declarada sobre a base (PRD, RF18). */
const MARGEM_SOBRE_A_BASE_MS = 500
/** Turnos do Tutor da B: 3 a cada 2 s (1,5 por segundo), abaixo do teto de 120 pedidos de IA por minuto por escola. */
const TURNOS_DA_B_POR_2S = 3
const PRAZO_DO_TURNO_MS = 30_000
const VUS_MAXIMOS_DO_TUTOR_DA_B = 40

const turnoDaB = new Trend('turno_b', true)
const turnosConcluidosDaB = new Counter('turnos_b_concluidos')
const respostas429 = new Counter('respostas_429')
const respostasInesperadas = new Counter('respostas_inesperadas')

const TOKENS_B_TUTOR = new SharedArray('tokens-b_tutor', () => JSON.parse(open(ARQUIVO_DOS_TOKENS)).b_tutor)

function thresholds() {
  const comuns = {
    turnos_b_concluidos: ['count>0'],
    'respostas_429{grupo:b_tutor}': ['count==0'],
    'respostas_inesperadas{grupo:b_tutor}': ['count==0'],
  }
  if (FASE === 'base') return { ...comuns, turno_b: [`max<${PRAZO_DO_TURNO_MS}`] }
  const turnoBase = Number(__ENV.TURNO_BASE_P95_MS)
  if (__ENV.TURNO_BASE_P95_MS === undefined || !Number.isFinite(turnoBase) || turnoBase < 0) throw new Error('a fase ingestao precisa de TURNO_BASE_P95_MS')
  return { ...comuns, turno_b: [`p(95)<=${turnoBase + MARGEM_SOBRE_A_BASE_MS}`, `max<${PRAZO_DO_TURNO_MS}`] }
}

export const options = {
  scenarios: {
    escola_b_tutor: {
      executor: 'constant-arrival-rate',
      exec: 'escolaBTutor',
      rate: TURNOS_DA_B_POR_2S,
      timeUnit: '2s',
      duration: DURACAO,
      preAllocatedVUs: 10,
      maxVUs: VUS_MAXIMOS_DO_TUTOR_DA_B,
    },
  },
  thresholds: thresholds(),
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: false,
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response'],
}

function cabecalhos(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function contar(resposta, grupo, esperado) {
  respostas429.add(resposta.status === 429 ? 1 : 0, { grupo })
  respostasInesperadas.add(resposta.status === esperado ? 0 : 1, { grupo, status: String(resposta.status) })
  return resposta.status === esperado
}

/** Milissegundos desde o começo do teste, por relógio monotônico (o k6 2.x não traz `performance` global). */
function agoraMonotonico() {
  return exec.instance.currentTestRunDuration
}

/** Um UUID v4: a `chaveEnvio` do turno é única por pergunta, e o k6 não traz `crypto.randomUUID` em toda versão. */
function novaChaveDeEnvio() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (letra) => {
    const sorteio = Math.floor(Math.random() * 16)
    return (letra === 'x' ? sorteio : (sorteio & 0x3) | 0x8).toString(16)
  })
}

/** Um turno do Tutor de um aluno da B, pela rota de verdade: a pergunta, a execução e a leitura dela até concluir. */
export function escolaBTutor() {
  const token = TOKENS_B_TUTOR[exec.scenario.iterationInTest % TOKENS_B_TUTOR.length]
  // Relógio monotônico (o do teste, em ms): o de parede (`Date.now`) anda para trás quando a máquina reajusta a hora, e a duração sai negativa.
  const inicio = agoraMonotonico()
  const pedido = http.post(`${API}/v1/tutor/mensagens`, JSON.stringify({ texto: 'Pergunta sintética de carga sobre o assunto da aula.', chaveEnvio: novaChaveDeEnvio() }), {
    headers: cabecalhos(token),
    tags: { name: 'POST /v1/tutor/mensagens' },
  })
  if (!contar(pedido, 'b_tutor', 202)) return
  const execucaoId = pedido.json('execucaoId')
  while (agoraMonotonico() < inicio + PRAZO_DO_TURNO_MS) {
    sleep(0.1)
    const resposta = http.get(`${API}/v1/execucoes/${execucaoId}`, { headers: cabecalhos(token), tags: { name: 'GET /v1/execucoes/:id' } })
    if (!contar(resposta, 'b_tutor', 200)) return
    const estado = resposta.json('estado')
    if (estado === 'concluida') {
      turnoDaB.add(agoraMonotonico() - inicio)
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
