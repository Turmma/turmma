// Cenário "a escola inteira entra de uma vez" (F2, tarefa 16.0; Tech Spec do onboarding, seções 7c e 13; PRD, RF15; regra 80,
// itens 1, 3, 7 e 11). Roda num container do compose de carga, na mesma rede, uma vez por fase; quem o chama é
// infra/scripts/carga-importacao.ts:
//
//   FASE=previa_e_gravar         a prévia e o gravar de uma planilha de 3.000 linhas, de duas coordenações da mesma escola, enquanto
//                                a rajada de login do F1 (infra/k6/login-7h30.js, no outro container) entra com 2.100 contas. O
//                                teto é o p95 de 2 s (PRD, RF15, seção 11 da Tech Spec) para a prévia e para o gravar.
//   FASE=transferencias_base     o que o passo (3) vai disputar, sem o job: a professora de cada turma gera o acesso da turma de cinco
//                                em cinco décimos de segundo, e decide os pedidos em lotes. A régua da espera de trava.
//   FASE=transferencias          o mesmo, e um job atrás do outro: a planilha de 3.000 linhas com 300 transferências, de ida e de
//                                volta, em turmas onde o gerar acesso e a decisão rodam (a Tech Spec, seção 13: o [C]).
//   FASE=desligamentos_e_virada  cinco jobs, um depois do outro, em três escolas: 100 desligamentos de alunos aprovados (a conta
//                                desativada um por um) num gravar, 300 em três gravares de 100 (o teto por gravar: a planilha é
//                                enviada de novo, e a prévia mostra quem ainda falta) e a virada de 900 alunos para o ano planejado
//                                (`vinculo.criado` um por um). Quem mede o passo (3) é o Prometheus; o k6 mede o job.
//   FASE=professores             a planilha de 300 professores (200 que já têm conta e 100 novos, que nascem a cada volta) contra o
//                                login dos que já existem, com a rajada de login do F1 no outro container (com a provisória e a conta
//                                externa) e o redefinir da senha dos mesmos professores (acesso-e-convites, 10.0; Tech Spec, 7c):
//                                zero 503 no login e no redefinir, e todo redefinir em 204. O token de cada redefinir vem de um
//                                `link_da_conta` que o script de carga semeou pelo banco, e a senha nova é a da carga, para o login
//                                deles seguir valendo.
//
// A coordenação e a professora imitam a tela: a prévia primeiro, as marcas que a coordenação aceitou (todas as do tipo pedido), o gravar
// e a espera do job até sair de `na_fila`. Toda resposta soma no contador do seu grupo (1 no caso, 0 fora dele), para nenhum
// threshold passar por falta de amostra.
//
// Nenhum dado de pessoa: nomes, matrículas e e-mails sintéticos (domínio `.invalid`), os tokens e a senha gerados na hora pelo script,
// lidos de um arquivo da pasta temporária da execução. Nada chama provedor de IA nem o `oidc-falso`.

import { sleep } from 'k6'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'

const FASE = __ENV.FASE
const API = __ENV.API_URL
const ARQUIVO_DAS_CONTAS = __ENV.ARQUIVO_DAS_CONTAS
const FASES = ['previa_e_gravar', 'transferencias_base', 'transferencias', 'desligamentos_e_virada', 'professores']
if (!FASES.includes(FASE)) throw new Error(`FASE precisa ser uma de: ${FASES.join(', ')}`)
if (!API || !ARQUIVO_DAS_CONTAS) throw new Error('defina API_URL e ARQUIVO_DAS_CONTAS')

/** O teto da prévia e do gravar com 3.000 linhas (PRD, RF15; Tech Spec, seção 11: o PRD admite 10 s, o teto é 2 s). */
export const P95_MAXIMO_DA_PREVIA_E_DO_GRAVAR_MS = 2_000
/** Quantas linhas a planilha da carga tem: o teto do contrato (`MAXIMO_DE_LINHAS_DA_PLANILHA`). */
export const LINHAS_DA_PLANILHA = 3_000
/** Quantas decisões cada lote leva (cinco pedidos, de uma professora só). */
export const PEDIDOS_POR_LOTE = 5
/**
 * A espera entre uma volta e a seguinte da mesma coordenação. Cada volta de job faz duas chamadas do balde da planilha (a prévia e o
 * gravar contam juntos), e o job leva de 1 a 4 s: com 7 s de espera, a conta fica abaixo de 20 por minuto de cada usuário
 * (`LIMITE_DA_PLANILHA_POR_MINUTO`), e o 429 só aparece se o limite estiver errado.
 */
const ESPERA_ENTRE_CHAMADAS_S = 7
/** Quanto o job de uma planilha pode levar até sair de `na_fila`, do ponto de vista da coordenação que espera na tela. */
const PRAZO_DO_JOB_S = 120

const conteudo = () => JSON.parse(open(ARQUIVO_DAS_CONTAS))
const [GERAL] = new SharedArray('geral', () => {
  const { senha, duracaoS, taxaDeAcessosPorSegundo, intervaloDoLoteS, taxaDeLoginsPorSegundo, taxaDeRedefinicoesPorSegundo } = conteudo()
  return [{ senha, duracaoS, taxaDeAcessosPorSegundo, intervaloDoLoteS, taxaDeLoginsPorSegundo, taxaDeRedefinicoesPorSegundo }]
})
// Uma cópia para todos os VUs, e não uma por VU.
const COORDENACOES = new SharedArray('coordenacoes', () => conteudo().coordenacoes ?? [])
const PLANILHAS = new SharedArray('planilhas', () => [conteudo().planilhas ?? {}])
const TURMAS_COM_ACESSO = new SharedArray('turmasComAcesso', () => conteudo().turmasComAcesso ?? [])
const LOTES_DE_DECISAO = new SharedArray('lotesDeDecisao', () => conteudo().lotesDeDecisao ?? [])
const TRABALHOS = new SharedArray('trabalhos', () => conteudo().trabalhos ?? [])
/** Quantos gravares a fase faz: um por trabalho, e a rodada a mais de quem passa do teto de desligamentos por gravar. */
const GRAVARES = TRABALHOS.reduce((soma, trabalho) => soma + (trabalho.rodadas ?? 1), 0)
const LOGINS = new SharedArray('logins', () => conteudo().logins ?? [])
/** Um token de `redefinir` por professor, semeado pelo script de carga: cada um vale uma vez. */
const REDEFINICOES = new SharedArray('redefinicoes', () => conteudo().redefinicoes ?? [])
const {
  senha: SENHA,
  duracaoS: DURACAO_S,
  taxaDeAcessosPorSegundo: TAXA_DE_ACESSOS,
  intervaloDoLoteS: INTERVALO_DO_LOTE_S,
  taxaDeLoginsPorSegundo: TAXA_DE_LOGINS,
  taxaDeRedefinicoesPorSegundo: TAXA_DE_REDEFINICOES,
} = GERAL

const duracaoDaPrevia = new Trend('previa_duracao', true)
const duracaoDoGravar = new Trend('gravar_duracao', true)
const duracaoDoAcesso = new Trend('gerar_acesso_duracao', true)
const duracaoDaDecisao = new Trend('decidir_duracao', true)
const duracaoDoLogin = new Trend('login_duracao', true)
const duracaoDoJob = new Trend('job_duracao', true)
const duracaoDoRedefinir = new Trend('redefinir_duracao', true)
const respostas5xx = new Counter('respostas_5xx')
// Informativo: o 503 também soma em `respostas_5xx`, que precisa ficar em zero.
const respostas503 = new Counter('respostas_503')
const inesperadas = new Counter('respostas_inesperadas')
const previasCom3000 = new Counter('previas_com_3000_linhas')
const gravaresAceitos = new Counter('gravares_aceitos')
const jobsConcluidos = new Counter('jobs_concluidos')
const jobsNaoConcluidos = new Counter('jobs_nao_concluidos')
const jobsDesatualizados = new Counter('jobs_desatualizados')
const acessosGerados = new Counter('acessos_gerados')
const decisoes = new Counter('decisoes_feitas')
const loginsFeitos = new Counter('logins_feitos')
/** Os redefinir que voltaram 204: todos os tokens semeados, cada um uma vez. */
const redefinicoesFeitas = new Counter('redefinicoes_feitas')
const marcasForaDoEsperado = new Counter('marcas_fora_do_esperado')

// ---------------------------------------------------------------------------------------------------------------------
// Cenários e thresholds de cada fase
// ---------------------------------------------------------------------------------------------------------------------

/** A carga que o passo (3) disputa: o gerar acesso e a decisão, as duas coisas que a professora faz às 7h30. */
function cenariosDaProfessora() {
  return {
    acessos: { executor: 'constant-arrival-rate', exec: 'gerarAcesso', rate: TAXA_DE_ACESSOS, timeUnit: '1s', duration: `${DURACAO_S}s`, preAllocatedVUs: 20, maxVUs: 60 },
    decisoes: {
      executor: 'constant-arrival-rate',
      exec: 'decidir',
      rate: 1,
      timeUnit: `${INTERVALO_DO_LOTE_S}s`,
      duration: `${DURACAO_S}s`,
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  }
}

/** A resposta inesperada por status: sempre passa, e só faz o k6 dizer qual status foi (o 409 e o 429 têm remédios diferentes). */
const POR_STATUS = Object.fromEntries([400, 401, 403, 404, 409, 429].map((status) => [`respostas_inesperadas{status:${String(status)}}`, ['count>=0']]))

const SEM_ERRO = {
  ...POR_STATUS,
  respostas_5xx: ['count==0'],
  respostas_inesperadas: ['count==0'],
  dropped_iterations: ['count==0'],
}

function configuracao() {
  if (FASE === 'previa_e_gravar') {
    return {
      cenarios: { coordenacao: { executor: 'constant-vus', exec: 'previaEGravar', vus: 2, duration: `${DURACAO_S}s`, gracefulStop: `${PRAZO_DO_JOB_S}s` } },
      thresholds: {
        ...SEM_ERRO,
        previa_duracao: [`p(95)<${P95_MAXIMO_DA_PREVIA_E_DO_GRAVAR_MS}`],
        gravar_duracao: [`p(95)<${P95_MAXIMO_DA_PREVIA_E_DO_GRAVAR_MS}`],
        // A amostra existe: cada prévia trouxe as 3.000 linhas, e o gravar do primeiro VU entrou e foi até o fim.
        previas_com_3000_linhas: ['count>=20'],
        gravares_aceitos: ['count>=3'],
        jobs_concluidos: ['count>=3'],
        jobs_nao_concluidos: ['count==0'],
      },
    }
  }
  if (FASE === 'transferencias_base') {
    return {
      cenarios: cenariosDaProfessora(),
      thresholds: { ...SEM_ERRO, acessos_gerados: ['count>0'], decisoes_feitas: ['count>0'] },
    }
  }
  if (FASE === 'transferencias') {
    return {
      cenarios: {
        ...cenariosDaProfessora(),
        trabalho: { executor: 'constant-vus', exec: 'idaEVolta', vus: 1, duration: `${DURACAO_S}s`, gracefulStop: `${PRAZO_DO_JOB_S}s` },
      },
      thresholds: { ...SEM_ERRO, acessos_gerados: ['count>0'], decisoes_feitas: ['count>0'], jobs_concluidos: ['count>=3'], jobs_nao_concluidos: ['count==0'], marcas_fora_do_esperado: ['count==0'] },
    }
  }
  if (FASE === 'desligamentos_e_virada') {
    return {
      cenarios: { trabalhos: { executor: 'per-vu-iterations', exec: 'umPorVez', vus: 1, iterations: 1, maxDuration: `${PRAZO_DO_JOB_S * (GRAVARES + 1)}s` } },
      thresholds: {
        ...SEM_ERRO,
        jobs_concluidos: [`count==${GRAVARES}`],
        jobs_nao_concluidos: ['count==0'],
        marcas_fora_do_esperado: ['count==0'],
        // Um limite por job, para o resumo trazer o tempo de cada um (prévia, gravar e job): o prazo da espera da tela.
        ...Object.fromEntries(TRABALHOS.map((trabalho) => [`job_duracao{trabalho:${trabalho.nome}}`, [`max<${PRAZO_DO_JOB_S * 1_000}`]])),
      },
    }
  }
  return {
    cenarios: {
      logins: { executor: 'constant-arrival-rate', exec: 'loginDoProfessor', rate: TAXA_DE_LOGINS, timeUnit: '1s', duration: `${DURACAO_S}s`, preAllocatedVUs: 20, maxVUs: 60 },
      redefinir: { executor: 'constant-arrival-rate', exec: 'redefinirSenha', rate: TAXA_DE_REDEFINICOES, timeUnit: '1s', duration: `${DURACAO_S}s`, preAllocatedVUs: 5, maxVUs: 20 },
      trabalho: { executor: 'constant-vus', exec: 'professoresEmVolta', vus: 1, duration: `${DURACAO_S}s`, gracefulStop: `${PRAZO_DO_JOB_S}s` },
    },
    thresholds: {
      ...SEM_ERRO,
      // Zero 503 no login deles (o semáforo do hash) enquanto o job grava as contas globais, e no redefinir dos mesmos professores.
      respostas_503: ['count==0'],
      logins_feitos: ['count>0'],
      // Todo redefinir volta 204 (qualquer outro status soma em `respostas_inesperadas`): os tokens semeados foram todos usados, uma vez cada.
      redefinicoes_feitas: [`count==${REDEFINICOES.length}`],
      jobs_concluidos: ['count>=3'],
      jobs_nao_concluidos: ['count==0'],
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

/** Soma a resposta nos contadores: 5xx, 503 e a que não estava entre as esperadas. */
function contar(resposta, esperados) {
  respostas5xx.add(resposta.status >= 500 ? 1 : 0)
  respostas503.add(resposta.status === 503 ? 1 : 0)
  inesperadas.add(esperados.includes(resposta.status) ? 0 : 1, { status: String(resposta.status) })
}

function chamar(metodo, caminho, corpo, nome, token) {
  const headers = token === undefined ? JSON_ : { ...JSON_, Authorization: `Bearer ${token}` }
  const parametros = { headers, tags: { name: nome }, responseCallback: http.expectedStatuses({ min: 200, max: 499 }) }
  return metodo === 'GET' ? http.get(`${API}${caminho}`, parametros) : http.post(`${API}${caminho}`, corpo === undefined ? null : JSON.stringify(corpo), parametros)
}

/** A prévia de uma planilha, como a tela a pede. */
function previa(trabalho, texto) {
  const resposta = chamar('POST', `/v1/importacoes/${trabalho.tipo}/previa`, { texto, ...(trabalho.anoLetivoId === undefined ? {} : { anoLetivoId: trabalho.anoLetivoId }) }, 'POST /v1/importacoes/:tipo/previa', trabalho.token)
  duracaoDaPrevia.add(resposta.timings.duration)
  contar(resposta, [200])
  return resposta
}

/** O gravar, com as marcas. No 409, a escola já tem uma importação `na_fila`: a tela mostra "tente de novo", e o cenário também conta. */
function gravar(trabalho, texto, marcas) {
  const resposta = chamar(
    'POST',
    `/v1/importacoes/${trabalho.tipo}`,
    { texto, ...(trabalho.anoLetivoId === undefined ? {} : { anoLetivoId: trabalho.anoLetivoId }), marcas },
    'POST /v1/importacoes/:tipo',
    trabalho.token,
  )
  duracaoDoGravar.add(resposta.timings.duration)
  contar(resposta, [202])
  if (resposta.status === 202) gravaresAceitos.add(1)
  return resposta
}

/** Espera a importação sair de `na_fila`, como a tela. Devolve o estado final, ou `na_fila` se estourou o prazo. */
function esperarOJob(trabalho, id) {
  const limite = Date.now() + PRAZO_DO_JOB_S * 1_000
  while (Date.now() < limite) {
    const resposta = chamar('GET', `/v1/importacoes/${id}`, undefined, 'GET /v1/importacoes/:id', trabalho.token)
    contar(resposta, [200])
    const estado = resposta.status === 200 ? resposta.json('estado') : 'na_fila'
    if (estado !== 'na_fila') return estado
    sleep(0.25)
  }
  return 'na_fila'
}

/**
 * As marcas que a coordenação aceita na prévia: todas as do tipo pedido. `esperadas` é quantas marcas o cenário diz que a prévia oferece:
 * outra quantidade é o cenário que não está medindo o que diz.
 */
function marcasDaPrevia(trabalho, resposta) {
  const marcas = { transferir: [], desligar: [], encerrar: [] }
  const teto = trabalho.marcarAte ?? Number.POSITIVE_INFINITY
  for (const candidato of resposta.json('candidatos') ?? []) {
    if ((trabalho.marcar ?? []).includes(candidato.acao) && marcas[candidato.acao].length < teto) marcas[candidato.acao].push(candidato.id)
  }
  if (trabalho.esperadas !== undefined) {
    const marcadas = marcas.transferir.length + marcas.desligar.length + marcas.encerrar.length
    marcasForaDoEsperado.add(marcadas === trabalho.esperadas ? 0 : 1)
  }
  return marcas
}

/** Conta o estado em que o job terminou: concluída, desatualizada (a planilha mudou entre a prévia e o job) ou parada na fila. */
function contarOEstado(estado) {
  if (estado === 'concluida') jobsConcluidos.add(1)
  else if (estado === 'desatualizada') jobsDesatualizados.add(1)
  else jobsNaoConcluidos.add(1)
}

/** Um trabalho de importação do começo ao fim, como a coordenação o faz: prévia, as marcas, gravar e espera. */
function trabalhar(trabalho, texto) {
  const inicio = Date.now()
  const resposta = previa(trabalho, texto)
  if (resposta.status !== 200) return 'sem_previa'
  if (trabalho.linhas !== undefined) previasCom3000.add((resposta.json('linhas') ?? []).length === trabalho.linhas ? 1 : 0)
  const aceito = gravar(trabalho, texto, marcasDaPrevia(trabalho, resposta))
  if (aceito.status !== 202) return 'recusado'
  const estado = esperarOJob(trabalho, aceito.json('id'))
  duracaoDoJob.add(Date.now() - inicio, { trabalho: trabalho.nome ?? 'job' })
  contarOEstado(estado)
  return estado
}

// ---------------------------------------------------------------------------------------------------------------------
// previa_e_gravar
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Duas coordenações da mesma escola (as duas vagas da planilha): a primeira repete a prévia e, a cada quatro voltas, grava e espera o
 * job (a primeira grava as 3.000 linhas de verdade; as seguintes encontram tudo "já existe"); a segunda só repete a prévia.
 */
export function previaEGravar() {
  const eu = exec.vu.idInTest - 1
  const coordenacao = COORDENACOES[eu % COORDENACOES.length]
  const trabalho = { tipo: 'alunos', token: coordenacao.token, linhas: LINHAS_DA_PLANILHA, marcar: [], nome: 'previa_e_gravar' }
  const texto = PLANILHAS[0].base
  const volta = exec.vu.iterationInInstance
  if (eu === 0 && volta % 4 === 0) {
    trabalhar(trabalho, texto)
  } else {
    const resposta = previa(trabalho, texto)
    if (resposta.status === 200) previasCom3000.add((resposta.json('linhas') ?? []).length === LINHAS_DA_PLANILHA ? 1 : 0)
  }
  sleep(ESPERA_ENTRE_CHAMADAS_S)
}

// ---------------------------------------------------------------------------------------------------------------------
// transferencias_base e transferencias
// ---------------------------------------------------------------------------------------------------------------------

/** A professora gera o acesso da turma dela (o que a coordenação não faz às 7h30, e a professora faz). */
export function gerarAcesso() {
  const turma = TURMAS_COM_ACESSO[exec.scenario.iterationInTest % TURMAS_COM_ACESSO.length]
  const resposta = chamar('POST', `/v1/turmas/${turma.id}/acesso`, { validadeDias: 7 }, 'POST /v1/turmas/:id/acesso', turma.token)
  duracaoDoAcesso.add(resposta.timings.duration)
  contar(resposta, [200, 201])
  if (resposta.status === 200 || resposta.status === 201) acessosGerados.add(1)
}

/** A professora decide o lote de cinco pedidos da vez. */
export function decidir() {
  const lote = LOTES_DE_DECISAO[exec.scenario.iterationInTest]
  if (lote === undefined) return
  const resposta = chamar('POST', '/v1/reivindicacoes/decidir', { ids: lote.ids, decisao: 'aprovar' }, 'POST /v1/reivindicacoes/decidir', lote.token)
  duracaoDaDecisao.add(resposta.timings.duration)
  contar(resposta, [200])
  if (resposta.status === 200) decisoes.add(1)
}

/**
 * A coordenação põe 300 alunos em outra turma e, na volta seguinte, devolve os 300: cada volta é um job com 300 transferências,
 * nas turmas onde a professora gera o acesso e decide. O passo (3) é medido pelo Prometheus.
 */
export function idaEVolta() {
  const trabalho = { ...TRABALHOS[0] }
  const ida = exec.vu.iterationInInstance % 2 === 0
  trabalhar(trabalho, ida ? PLANILHAS[0].movida : PLANILHAS[0].base)
  sleep(ESPERA_ENTRE_CHAMADAS_S)
}

// ---------------------------------------------------------------------------------------------------------------------
// desligamentos_e_virada
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Um job de cada vez, na ordem do arquivo: 100 e 300 desligamentos e a virada. O trabalho que passa do teto de desligamentos por gravar
 * repete (`rodadas`), cada vez com a prévia nova, que mostra quem ainda falta: é o que a coordenação faz com a planilha de novo.
 */
export function umPorVez() {
  for (const trabalho of TRABALHOS) {
    for (let rodada = 0; rodada < (trabalho.rodadas ?? 1); rodada += 1) {
      trabalhar(trabalho, trabalho.texto)
      sleep(ESPERA_ENTRE_CHAMADAS_S)
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// professores
// ---------------------------------------------------------------------------------------------------------------------

/** Um professor que já tem conta entra com e-mail e senha, de onde a escola inteira entra: o IP dela. */
export function loginDoProfessor() {
  const conta = LOGINS[exec.scenario.iterationInTest % LOGINS.length]
  const resposta = chamar('POST', '/v1/sessao/email', { email: conta.email, senha: SENHA }, 'POST /v1/sessao/email')
  duracaoDoLogin.add(resposta.timings.duration)
  contar(resposta, [200, 503])
  if (resposta.status === 200) loginsFeitos.add(1)
}

/** O professor redefine a senha com o link do e-mail (o token vem semeado), e a senha nova é a da carga: o login dele segue valendo. */
export function redefinirSenha() {
  const volta = exec.scenario.iterationInTest
  // A taxa constante pode dar uma iteração a mais no fim: ela não repete o token do começo.
  if (volta >= REDEFINICOES.length) return
  const resposta = chamar('POST', '/v1/senha/redefinir', { token: REDEFINICOES[volta].token, senha: SENHA }, 'POST /v1/senha/redefinir')
  duracaoDoRedefinir.add(resposta.timings.duration)
  contar(resposta, [204])
  if (resposta.status === 204) redefinicoesFeitas.add(1)
}

/** A coordenação importa a equipe: os 200 que já têm conta mais 100 novos a cada volta (e-mail que ainda não existe). */
export function professoresEmVolta() {
  const trabalho = { ...TRABALHOS[0] }
  const volta = exec.vu.iterationInInstance
  const novos = Array.from({ length: PLANILHAS[0].novosPorVolta }, (_, posicao) => `Professor novo ${volta}-${posicao};novo-${volta}-${posicao}@educa.invalid`)
  trabalhar(trabalho, `${PLANILHAS[0].professores}${novos.join('\r\n')}\r\n`)
  sleep(ESPERA_ENTRE_CHAMADAS_S)
}
