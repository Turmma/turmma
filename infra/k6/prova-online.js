// Cenário "a prova da manhã" (avaliacao-e-correcao, tarefa 6.0; Tech Spec, seções 5.4 a 5.7 e 7c; cenarios.md, seção 5; regra 80, itens 6 e 10). Roda num container do compose de
// carga, na mesma rede. Quem o chama é infra/scripts/carga-prova.ts, uma vez:
//
//   10 escolas × 6 turmas × 35 alunos = 2.100 alunos em prova ao mesmo tempo, 20 itens cada, pelas rotas reais do aluno:
//   `POST /v1/atividades-aplicadas/:id/comecar`, `PUT .../respostas/:questao` (um por item), `GET .../tempo` a cada 30 s e `POST .../enviar` no fim.
//
// O tempo da prova é comprimido (um item a cada ~18 s, e não a cada 2 min de uma prova de 40 min): o ritmo é mais que o dobro do da Tech Spec (~80 req/s), de propósito: o p95 passa com folga ou reprova
// de verdade. Dois acidentes acontecem no meio dela, e quem os causa é o driver do Node, não o k6:
//
//   - 10% dos alunos (`rede: true` no arquivo dos tokens) ficam 1 min sem rede, aos 120 s: eles respondem, o cliente guarda os itens na fila e, quando a rede volta, espera um sorteio de até
//     `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS` antes de reenviar (o `online` do app, Tech Spec §9: a escola inteira volta no mesmo instante, e não pode reenviar no mesmo segundo);
//   - todas as instâncias da API ficam fora por 90 s, aos 180 s (`docker compose pause`): o PUT que não responde, ou que a borda recusa, fica na fila do cliente, que tenta de novo
//     com o recuo do app (2, 4, 8 e 15 s, com ±25% de jitter: `esperaAntesDeTentar`, `apps/web/src/areas/aluno/respostas.ts`). A gravação é idempotente, então o reenvio nunca duplica nem perde.
//
// O cliente daqui imita a fila do app (`fila-de-respostas.ts`), e não um laço próprio: o item novo sai na hora, mesmo no meio do recuo (o `escolher` chama o `bombear`); um de cada vez,
// na ordem; o que estourou o prazo do cliente vai para o fim da fila e o seguinte sai já; qualquer outra falha espera o recuo. As constantes da fila são as do app, e
// `infra/test/carga-prova.test.ts` confere as duas.
//
// O que o k6 mede (Tech Spec §7c; `cenarios.md` §5), com o critério dividido (decisão do Joaquim, 27/11/2026, na 6.0):
//   - o **fluxo normal**: o PUT do cliente que não está se recuperando (`put_fluxo_normal_ms`, só o 200), com o p95 abaixo de `LIMITE_P95_DO_PUT_MS`, fora da janela da volta
//     (de `FIM_DA_QUEDA_S` a `FIM_DA_JANELA_DA_VOLTA_S`): o PUT normal que toca essa janela vai para `put_fluxo_normal_na_volta_ms`, sem limite, só para ler;
//   - a **volta da queda**: o PUT do cliente que falhou, ou ficou sem rede, até a fila dele esvaziar (`put_da_volta_ms`, sem limite, só para ler), e quanto tempo depois do fim da queda
//     cada fila que a atravessou ficou vazia (`fila_esvaziada_na_volta_s`), com o máximo abaixo de `LIMITE_DA_VOLTA_S`. A fila que não esvazia até o prazo entra com o tempo do desistir;
//   - quantos itens o cliente deu como enviados (`respostas_enviadas`: o 200 de cada item, uma vez), e o que falhou **fora** da janela da queda (`put_falhas_fora_da_queda`, que precisa ser zero). A janela da queda
//     vai de `MARGEM_DA_QUEDA_S` antes dela até o fim da janela da volta, e nela só a indisponibilidade (status 0, 502, 503, 504) é da queda: um 500 ou um 4xx ali continua defeito.
// `put_ms` continua com todos os PUT respondidos, sem limite. O driver compara os itens enviados com as linhas de `resposta_atividade` e confere o que a queda fez com o limite e com o
// encerramento. Nenhum dado de pessoa: escolas e alunos sintéticos, com tokens de sessões reais.

import { sleep } from 'k6'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'

const API = __ENV.API_URL
const ARQUIVO_DOS_TOKENS = __ENV.ARQUIVO_DOS_TOKENS
if (!API || !ARQUIVO_DOS_TOKENS) throw new Error('defina API_URL e ARQUIVO_DOS_TOKENS')

/** O que o driver e `infra/test/carga-prova.test.ts` conferem contra as constantes de infra/scripts/conferir-carga-prova.ts. */
const ITENS = 20
const INTERVALO_ENTRE_ITENS_S = 18
const VARIACAO_DO_INTERVALO_S = 2
const INTERVALO_DO_TEMPO_S = 30
const ENTRADA_ESCALONADA_S = 20
const QUEDA_INICIO_S = 180
const QUEDA_DURACAO_S = 90
const REDE_CAI_APOS_S = 120
const REDE_CAI_DURACAO_S = 60
const LIMITE_P95_DO_PUT_MS = 500

/** A borda recusa um pouco antes do `pause`: a falha de indisponibilidade dentro desta margem, antes da queda, é a queda. Depois dela vale a janela da volta, que é maior. */
const MARGEM_DA_QUEDA_S = 15
const PRAZO_DO_RESTO_S = 240
const ESPERA_ENTRE_REENVIOS_S = 3

/** A fila do app (`apps/web/src/areas/aluno/respostas.ts` e `api/client.ts`), repetida: `infra/test/carga-prova.test.ts` confere que são as mesmas. */
const PRIMEIRA_ESPERA_DA_FILA_MS = 2000
const MAIOR_ESPERA_DA_FILA_MS = 15000
/** O jitter do recuo, em pontos percentuais: ±25% (`JITTER_DA_FILA = 0.25` no app). */
const JITTER_DA_FILA_PCT = 25
/** O prazo do PUT da prova no app (`PRAZOS_DA_CHAMADA_MS.prova`). */
const PRAZO_DO_PUT_MS = 10000
/** A rede volta: cada cliente espera um sorteio entre zero e isto antes de reenviar (o `online` do app, Tech Spec §9). */
const ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS = 5000

/** A volta da queda: a fila de cada aluno que a atravessou esvazia em até isto depois do fim dela (`cenarios.md` §5). */
const LIMITE_DA_VOLTA_S = 60
const FIM_DA_QUEDA_S = QUEDA_INICIO_S + QUEDA_DURACAO_S
/**
 * A janela da volta (decisão de 27/11/2026, na 6.0, `cenarios.md` §5): os `LIMITE_DA_VOLTA_S` depois do fim da queda, os mesmos que a fila tem para esvaziar. Nela o sistema inteiro está
 * se recuperando, e o PUT do fluxo normal disputa o pool com a rajada da volta: o p95 dele e as falhas de indisponibilidade não contam no critério do fluxo normal.
 */
const FIM_DA_JANELA_DA_VOLTA_S = FIM_DA_QUEDA_S + LIMITE_DA_VOLTA_S
/** O código do k6 para a requisição que estourou o prazo do cliente (o `estourouNoCliente` do app). */
const ERRO_DE_PRAZO_DO_K6 = 1050

const alunos = new SharedArray('alunos', () => JSON.parse(open(ARQUIVO_DOS_TOKENS)).alunos)

const putMs = new Trend('put_ms', true)
const putFluxoNormalMs = new Trend('put_fluxo_normal_ms', true)
const putFluxoNormalNaVoltaMs = new Trend('put_fluxo_normal_na_volta_ms', true)
const putDaVoltaMs = new Trend('put_da_volta_ms', true)
const filaEsvaziadaNaVoltaS = new Trend('fila_esvaziada_na_volta_s')
const respostasEnviadas = new Counter('respostas_enviadas')
const putFalhasForaDaQueda = new Counter('put_falhas_fora_da_queda')
const putFalhasNaQueda = new Counter('put_falhas_na_queda')
const temposLidos = new Counter('tempos_lidos')
const enviosFeitos = new Counter('envios_feitos')
const respostasInesperadas = new Counter('respostas_inesperadas')

export const options = {
  scenarios: { prova: { executor: 'per-vu-iterations', vus: alunos.length, iterations: 1, maxDuration: '15m' } },
  thresholds: {
    put_fluxo_normal_ms: [`p(95)<${LIMITE_P95_DO_PUT_MS}`],
    fila_esvaziada_na_volta_s: [`max<${LIMITE_DA_VOLTA_S}`],
    put_falhas_fora_da_queda: ['count==0'],
    respostas_inesperadas: ['count==0'],
  },
}

const segundosDesdeOInicio = () => (Date.now() - exec.scenario.startTime) / 1000
const naQueda = () => {
  const agora = segundosDesdeOInicio()
  return agora >= QUEDA_INICIO_S - MARGEM_DA_QUEDA_S && agora <= FIM_DA_JANELA_DA_VOLTA_S
}
/** O PUT que começou antes do fim da janela da volta e terminou depois do fim da queda tocou a janela. */
const tocouAJanelaDaVolta = (inicioS, fimS) => inicioS < FIM_DA_JANELA_DA_VOLTA_S && fimS >= FIM_DA_QUEDA_S

function chamar(metodo, caminho, token, corpo, prazoMs = PRAZO_DO_PUT_MS) {
  const parametros = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: `${String(prazoMs)}ms` }
  return http.request(metodo, `${API}${caminho}`, corpo === undefined ? null : JSON.stringify(corpo), parametros)
}

/** A falha de conexão (status 0), a recusa da borda e o 503 de "tente de novo" são o que a queda faz, dentro da janela dela e da volta; qualquer outra coisa, ou fora dela, é defeito. */
function registrarFalha(resposta, contador) {
  if (naQueda() && (resposta.status === 0 || resposta.status === 502 || resposta.status === 503 || resposta.status === 504)) putFalhasNaQueda.add(1)
  else contador.add(1)
}

/** O recuo do app: 2, 4, 8 e, daí em diante, 15 s, cada um com ±25% de jitter e nunca acima do teto (`esperaAntesDeTentar`). */
function esperaAntesDeTentar(tentativas) {
  const base = Math.min(MAIOR_ESPERA_DA_FILA_MS, PRIMEIRA_ESPERA_DA_FILA_MS * 2 ** Math.max(0, tentativas - 1))
  const jitter = JITTER_DA_FILA_PCT / 100
  return Math.min(MAIOR_ESPERA_DA_FILA_MS, Math.round(base * (1 - jitter + 2 * jitter * Math.random())))
}

/** O aluno com a rede caída: só os 10% marcados no arquivo dos tokens, e só na janela dos 60 s depois de `REDE_CAI_APOS_S`. */
function estaSemRede(aluno) {
  const agora = segundosDesdeOInicio()
  return aluno.rede && agora >= REDE_CAI_APOS_S && agora < REDE_CAI_APOS_S + REDE_CAI_DURACAO_S
}

/**
 * A fila de um aluno, como a do app: `fila` são as questões que ainda não tiveram 200; `tentarEm` é o instante do recuo (ou da volta da rede), quando há um;
 * `seRecuperando` vale da primeira falha (ou da rede que caiu com o aluno respondendo) até a fila esvaziar.
 */
function novoCliente(aluno) {
  return { aluno, fila: [], tentativas: 0, tentarEm: undefined, seRecuperando: false, voltaMedida: false, ficouSemRede: false }
}

/** A fila esvaziou: se o aluno vinha se recuperando de algo que atravessou o fim da queda, conta quanto levou depois dela. */
function filaVazia(cliente) {
  if (cliente.seRecuperando && !cliente.voltaMedida && segundosDesdeOInicio() >= FIM_DA_QUEDA_S) {
    filaEsvaziadaNaVoltaS.add(segundosDesdeOInicio() - FIM_DA_QUEDA_S)
    cliente.voltaMedida = true
  }
  cliente.seRecuperando = false
  cliente.tentativas = 0
  cliente.tentarEm = undefined
}

/**
 * O `bombear` do app: manda os itens da fila, um de cada vez e na ordem, até esvaziar ou falhar. O 200 é a única confirmação. O que estourou o prazo do cliente vai para o fim da fila
 * e o seguinte sai já (a rede pendurou, e a API não recusou); qualquer outra falha deixa o item onde está e espera o recuo. Sem rede, nada sai: quando ela volta, o cliente espera o
 * sorteio da volta da rede.
 */
function bombear(cliente) {
  const { aluno, fila } = cliente
  if (estaSemRede(aluno)) {
    if (fila.length > 0) cliente.seRecuperando = true
    cliente.ficouSemRede = true
    cliente.tentarEm = undefined
    return
  }
  if (cliente.ficouSemRede) {
    // O `online` do app: a rede da escola volta para todos no mesmo instante, e cada um sorteia quando reenviar.
    cliente.ficouSemRede = false
    cliente.tentarEm = Date.now() + Math.random() * ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS
    return
  }
  cliente.tentarEm = undefined
  while (fila.length > 0) {
    const questao = fila[0]
    const inicioS = segundosDesdeOInicio()
    const resposta = chamar('PUT', `/v1/atividades-aplicadas/${aluno.aplicacaoId}/respostas/${questao}`, aluno.token, { alternativa: questao % 4 })
    if (resposta.status !== 200) {
      registrarFalha(resposta, putFalhasForaDaQueda)
      cliente.seRecuperando = true
      cliente.tentativas += 1
      if (resposta.error_code === ERRO_DE_PRAZO_DO_K6 && fila.length > 1) {
        fila.push(fila.shift())
        continue
      }
      cliente.tentarEm = Date.now() + esperaAntesDeTentar(cliente.tentativas)
      return
    }
    putMs.add(resposta.timings.duration)
    const noFluxoNormal = tocouAJanelaDaVolta(inicioS, segundosDesdeOInicio()) ? putFluxoNormalNaVoltaMs : putFluxoNormalMs
    const dividido = cliente.seRecuperando ? putDaVoltaMs : noFluxoNormal
    dividido.add(resposta.timings.duration)
    respostasEnviadas.add(1)
    fila.shift()
    cliente.tentativas = 0
  }
  filaVazia(cliente)
}

/** Dorme até o instante dado, em ms do relógio do VU. */
function esperarAte(instante) {
  const espera = (instante - Date.now()) / 1000
  if (espera > 0) sleep(espera)
}

/** Uma chamada que se repete até o 200 ou até o prazo: o `comecar` e o `enviar` não têm fila, mas o aluno toca de novo. */
function ate200(metodo, caminho, token, contador) {
  const limite = Date.now() + PRAZO_DO_RESTO_S * 1000
  for (;;) {
    const resposta = chamar(metodo, caminho, token, {})
    if (resposta.status === 200) return true
    registrarFalha(resposta, contador)
    if (Date.now() > limite) return false
    sleep(ESPERA_ENTRE_REENVIOS_S)
  }
}

/** A leitura do tempo restante: o 200 conta, e qualquer outra resposta é falha (da queda, se estiver nela). */
function lerOTempo(caminho, token) {
  const tempo = chamar('GET', `${caminho}/tempo`, token)
  if (tempo.status === 200) temposLidos.add(1)
  else registrarFalha(tempo, respostasInesperadas)
}

/** O próximo instante em que a fila tenta: o do recuo, o da volta da rede, ou o fim da janela sem rede. */
function proximaTentativa(cliente) {
  if (cliente.fila.length === 0) return Infinity
  if (estaSemRede(cliente.aluno)) return exec.scenario.startTime + (REDE_CAI_APOS_S + REDE_CAI_DURACAO_S) * 1000
  return cliente.tentarEm ?? Date.now()
}

/** Depois do último item, a fila segue no recuo até esvaziar ou até o prazo. A que desiste entra na medida da volta com o tempo até o desistir, que passa do limite. */
function esvaziarAteOPrazo(cliente) {
  const prazo = Date.now() + PRAZO_DO_RESTO_S * 1000
  while (cliente.fila.length > 0 && Date.now() < prazo) {
    esperarAte(Math.min(proximaTentativa(cliente), prazo))
    bombear(cliente)
  }
  if (cliente.fila.length > 0 && cliente.seRecuperando && !cliente.voltaMedida) filaEsvaziadaNaVoltaS.add(segundosDesdeOInicio() - FIM_DA_QUEDA_S)
}

export default function () {
  const aluno = alunos[exec.vu.idInTest - 1]
  const base = `/v1/atividades-aplicadas/${aluno.aplicacaoId}`
  sleep(Math.random() * ENTRADA_ESCALONADA_S)
  if (!ate200('POST', `${base}/comecar`, aluno.token, respostasInesperadas)) return
  const cliente = novoCliente(aluno)
  const intervalo = () => (INTERVALO_ENTRE_ITENS_S + (Math.random() * 2 - 1) * VARIACAO_DO_INTERVALO_S) * 1000
  let ultimoTempo = Date.now()
  let proximoItemEm = Date.now() + intervalo()
  let questao = 1
  while (questao <= ITENS) {
    esperarAte(Math.min(proximoItemEm, proximaTentativa(cliente)))
    let marcou = false
    if (Date.now() >= proximoItemEm) {
      // O aluno marcou: o item entra na fila e sai na hora, mesmo no meio do recuo (o `escolher` do app chama o `bombear`, que cancela a espera). Sem rede, o `bombear` não manda nada.
      cliente.fila.push(questao)
      questao += 1
      proximoItemEm = Date.now() + intervalo()
      cliente.tentarEm = undefined
      marcou = true
    }
    if (Date.now() - ultimoTempo >= INTERVALO_DO_TEMPO_S * 1000) {
      ultimoTempo = Date.now()
      lerOTempo(base, aluno.token)
    }
    if (cliente.fila.length > 0 && (marcou || Date.now() >= proximaTentativa(cliente))) bombear(cliente)
  }
  esvaziarAteOPrazo(cliente)
  if (cliente.fila.length === 0 && ate200('POST', `${base}/enviar`, aluno.token, respostasInesperadas)) enviosFeitos.add(1)
}
