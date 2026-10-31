import type { Meter } from '@opentelemetry/api'
import type { Redis } from 'ioredis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import type { DatabasePool } from '../db/pool.js'

/**
 * Nome de toda métrica do sistema (Tech Spec, seção 5, "Observação local"). O painel
 * (`infra/grafana/paineis/`) e os alertas (13.0) leem estes nomes, já traduzidos pelo Prometheus:
 * ponto vira sublinhado, contador ganha `_total`, e unidade em segundos ganha `_seconds`.
 *
 * Métrica só leva id e rótulo de estrutura (regra 20, item 9). Nenhuma leva usuário nem IP, e só as de job e as três de
 * login da seção 7c da identidade levam escola (`METRICS_WITH_ESCOLA`).
 */
export const METRICS = {
  /** Histograma, em segundos, por rota template, método e status. */
  duracaoHttp: 'http.server.request.duration',
  /** Há quantos segundos o job mais antigo que ainda não começou espera, por fila e escola. Sem unidade declarada: o nome já a traz. */
  esperaMaisAntiga: 'job.espera_mais_antiga_s',
  /** Quantos jobs ainda não começaram, por fila e escola, com teto na contagem. */
  pendentes: 'job.pendentes',
  /**
   * Quantos jobs de cada `tipo` terminaram `falhou` e ainda estão em `job_registro` (44.0), com teto na contagem. Só o tipo:
   * nunca a escola, o `dados` nem o código da falha. A série some quando o expurgo leva a última linha do tipo (30 dias; o
   * `titular.*` fica até a ação do operador). O alerta "Job que falhou de vez" dispara com qualquer valor acima de zero.
   */
  falhos: 'job.falhos',
  /** Quantas vezes um job chegou ao worker sem vaga e voltou a esperar, por fila e escola. */
  aguardandoVaga: 'job.aguardando_vaga',
  /** Vagas tomadas agora, por fila e escola. */
  vagasEmUso: 'fila.vagas_em_uso',
  /** Jobs que o BullMQ devolveu à espera por lock vencido (worker morto ou event loop travado), por fila. */
  jobsStalled: 'fila.jobs_stalled',
  /** Conexões abertas nesta instância do realtime. */
  conexoesRealtime: 'realtime.conexoes',
  /** Conexões do pool emprestadas agora. */
  poolEmUso: 'db.pool.em_uso',
  /** Conexões que o pool jogou fora: erro de conexão, sessão suja, conexão ociosa derrubada. */
  conexoesDescartadas: 'db.pool.conexoes_descartadas',
  /** 1 se o cliente do Redis está pronto, 0 se não, por instância de Redis (`fila`, `cache`). */
  redisDisponivel: 'redis.disponivel',
  /** Proporção das requisições limitadas pelo seguro em memória na janela recente, de 0 a 1. */
  seguroAtivo: 'limite.seguro_ativo',
  /**
   * Tentativas de login respondidas com `CONTA_SEGURADA` (senha errada repetida), sem rótulo. A conta da equipe é
   * global, mas a do aluno é da escola (`escola_id|matricula`, 11.0): a métrica não leva escola porque a série por
   * escola das falhas é `login.falhas`, e esta só diz quantas contas estão sendo seguradas no sistema.
   */
  contaSegurada: 'login.conta_segurada',
  /**
   * Logins por e-mail ou matrícula que falharam (`NAO_AUTENTICADO` ou `CONTA_SEGURADA`), por `escola_id`: a escola do
   * endereço (matrícula), `equipe` (e-mail) ou `desconhecida` (endereço que não existe). Não conta o 503 do semáforo,
   * que é atraso e não falha.
   */
  falhasDeLogin: 'login.falhas',
  /**
   * 1 enquanto esta instância rebaixou, no último minuto, tentativas de um IP com mais falhas que o limiar naquela escola
   * (tarefa 15.0), por `escola_id`; 0 depois, até a série ser esquecida. Nunca o IP.
   */
  prioridadeRebaixada: 'login.prioridade_rebaixada',
  /** Tentativas de login por e-mail rebaixadas por passar do limite por IP da rota, sem rótulo: o IP nunca vira rótulo. */
  limiteEmailIp: 'login.limite_email_ip',
  /**
   * Tentativas de login (matrícula ou e-mail) rebaixadas por passar do limite por IP das rotas de login (`rl:ip-login`,
   * 15.0), sem o cookie de dispositivo da conta, sem rótulo (16.5): o IP nunca vira rótulo, e a escola que sofre aparece
   * em `login.hash_espera`.
   */
  rebaixadoPorIp: 'login.rebaixado_ip',
  /**
   * Retornos do login pela conta Google ou Microsoft da escola, por `resultado`: `entrou`, `recusado` (domínio, tenant
   * ou ligação que não valem, a mesma recusa para todos) e `provedor` (erro, prazo ou cookie do início ausente). Sem
   * escola e sem motivo mais fino: o motivo fino diria, a quem lê o painel, qual conta existe.
   */
  loginExterno: 'login.externo',
  /**
   * Histograma, em segundos, de cada login por e-mail ou matrícula, do pedido à resposta, por `metodo` (`email`,
   * `matricula`). Conta toda resposta: entrou, senha errada, conta segurada e o 503 do semáforo do hash.
   */
  duracaoDoLogin: 'login.duracao',
  /**
   * Histograma, em segundos, de quanto o login esperou a vez no semáforo do hash de senha, por `escola_id`: a escola do
   * endereço (matrícula), `equipe` (todo login por e-mail) ou `desconhecida` (endereço que não existe). Nunca usuário,
   * matrícula nem IP.
   */
  esperaPeloHash: 'login.hash_espera',
  /** Logins que esperaram mais que o prazo pela vez no semáforo do hash e saíram com 503, sem rótulo. */
  hashRecusado: 'login.hash_recusado',
  /**
   * Renovações de sessão pelo cookie, por `resultado`: `ok`, `ja_renovado` (409 de duas abas), `resposta_perdida`
   * (o anterior voltou sem o atual ter sido usado), `reuso` (família encerrada) e `recusada` (cookie que não vale).
   */
  renovacaoDeSessao: 'sessao.renovacao',
  /** Gravações de atividade que falharam depois de a resposta sair: a sessão só vence pela tolerância. */
  atividadeFalha: 'sessao.atividade_falha',
  /**
   * Vezes em que a gravação da linha da própria sessão, disparada pelo `GET /v1/eu` por haver data de outra escola da mesma
   * conta, falhou (telas do aluno, tarefa 1.0). O que se grava é `now()`, nunca a data emprestada. Sem rótulo: nem escola nem
   * pessoa. A resposta sai do mesmo jeito, com a data lida.
   */
  introducaoFalha: 'eu.introducao_falha',
  /**
   * Entradas do operador Turmma que falharam em `/v1/operacao/sessao/email` (`NAO_AUTENTICADO` ou `CONTA_SEGURADA`), sem
   * rótulo: a contagem de `entrada_falha` por minuto da Tech Spec da A0 (seção 7c). Separada de `login.falhas`, para o
   * painel das escolas não contar a nossa equipe.
   */
  entradaFalhaDaOperacao: 'operacao.entrada_falha',
  /**
   * Gravações de uso que a consolidação noturna pulou para não parar as outras escolas, por `origem` (`contador`,
   * `storage`) e `causa` (`escola_inexistente`, `valor_invalido`, `erro_de_storage`). Sem escola: o id vai no log
   * `uso.escola_ignorada`, e a escola eliminada não abre série.
   */
  escolaIgnoradaNoUso: 'uso.escola_ignorada',
  /**
   * Pedidos de `salas/reivindicar` (A1, tarefa 7.0), por `resultado`: `enviado` (pedido novo), `reenvio` (a chave já
   * gravada), `recusada`, `limite` (o nome travado), `sem_acesso` (link ou código que não vale), `indisponivel` (o 503 do
   * semáforo) e `erro`. Sem escola: a série por escola seria a contagem pública de quem entrou, e o id vai só no log.
   */
  reivindicacaoNaSala: 'sala.reivindicacao',
  /**
   * Vezes que um limite da sala segurou um pedido (A1, tarefa 7.0; Tech Spec da A1, 7c), por `tipo`: `escola` (a espera
   * de 1 s do código errado demais), `nome` (o `LIMITE_EXCEDIDO` do nome travado) e `turma` (o hash rebaixado). Sem
   * escola (`METRICS_WITH_ESCOLA` é fechada): a escola vai no log `sala.limite_atingido`, uma linha por escola e janela.
   */
  limiteDaSala: 'sala.limite_atingido',
  /** Histograma, em segundos, da leitura de sessão da `SessaoGuard`, uma por requisição autenticada. */
  leituraDeSessao: 'sessao.leitura.duracao',
  /** p99 do atraso do event loop no intervalo, em segundos. */
  atrasoEventLoop: 'nodejs.eventloop.delay.p99',
  /**
   * Noites seguidas, de ontem para trás, em que o expurgo da escola não terminou todas as categorias (F3, tarefa 3.0),
   * por `escola_id`, de 0 a 2: medida pelo worker-lote a partir de `expurgo_execucao`. Só a escola que já rodou o
   * expurgo tem série. O alerta "Expurgo incompleto por duas noites numa escola" dispara em 2.
   */
  noitesIncompletasDoExpurgo: 'expurgo.noites_incompletas',
  /**
   * Horas desde que a Turmma soube do incidente mais antigo da escola ainda sem confirmação de recebimento (F3, tarefa 9.0), por
   * `escola_id`: medida pelo worker-lote a partir de `incidente_escola`. Só a escola com incidente sem confirmação tem série; ao
   * confirmar, a série some. O alerta "Incidente sem confirmação em 24 h" dispara acima de 24.
   */
  horasDoIncidenteSemConfirmacao: 'incidente.horas_sem_confirmacao',
  /**
   * Horas que o pedido de acesso mais antigo da escola espera `em_preparacao` (F3, tarefa 13.0), por `escola_id`: medida pelo
   * worker-lote a partir de `pedido_titular`. Só a escola com pedido em preparação tem série; ao ficar `pronto`, a série some.
   * O alerta "Arquivo do titular em preparação há mais de 2 h" dispara acima de 2.
   */
  horasDoArquivoEmPreparacao: 'arquivo.horas_em_preparacao',
  /**
   * Horas desde que o pedido de eliminação `agendado` mais antigo da escola venceu (`eliminar_em`, F3, tarefa 15.0), por
   * `escola_id`: medida pelo worker-lote a partir de `pedido_titular`. Só a escola com eliminação vencida e ainda `agendada`
   * tem série; ao concluir, a série some. O prazo dos 7 dias não conta, e a interrupção pela janela letiva cabe nas 48 h. O
   * alerta "Eliminação do titular agendada há mais de 48 h do prazo" dispara acima de 48.
   */
  horasDaEliminacaoVencida: 'eliminacao.horas_vencida',
} as const

/**
 * As únicas métricas que levam `escola_id`: as de job e, fora de job, as três de login da Tech Spec da identidade (seção
 * 7c), com cardinalidade de uma série por escola: a espera pelo hash, as falhas e o rebaixamento; e as noites sem
 * expurgo (F3, tarefa 3.0) as horas do incidente sem confirmação (F3, tarefa 9.0) as do arquivo em preparação (F3, tarefa 13.0) e as da eliminação vencida (F3, tarefa 15.0). Nenhuma outra pode levar escola, e nenhuma leva usuário.
 */
export const METRICS_WITH_ESCOLA: readonly string[] = [
  METRICS.esperaMaisAntiga,
  METRICS.pendentes,
  METRICS.aguardandoVaga,
  METRICS.vagasEmUso,
  METRICS.esperaPeloHash,
  METRICS.falhasDeLogin,
  METRICS.prioridadeRebaixada,
  METRICS.noitesIncompletasDoExpurgo,
  METRICS.horasDoIncidenteSemConfirmacao,
  METRICS.horasDoArquivoEmPreparacao,
  METRICS.horasDaEliminacaoVencida,
]

/** O rótulo da escola nas métricas de job. Rotina do sistema, sem escola, aparece como `sistema`, como na chave da vaga. */
export const ROTULO_ESCOLA = 'escola_id'

/** `http.route` de requisição que não casou com rota nenhuma. Nunca o caminho: ele traria id e explodiria a cardinalidade. */
export const ROTA_NAO_ENCONTRADA = 'nao_encontrada'

const METODOS_HTTP = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

/** Limites do histograma de duração HTTP, os recomendados pela convenção do OpenTelemetry, em segundos. */
export const LIMITES_DO_HISTOGRAMA_HTTP_S = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10]

/** O que o Express grava na requisição ao casar a rota. */
interface RequisicaoComRota extends IncomingMessage {
  route?: { path?: unknown }
  baseUrl?: string
}

/**
 * A rota template da requisição (`/v1/sistema/jobs-sinteticos/:id`), como o roteador a casou. Sem rota
 * casada, `ROTA_NAO_ENCONTRADA`: o caminho de verdade (com o id, ou o que alguém digitou) nunca vira rótulo.
 */
export function requestRoute(requisicao: RequisicaoComRota): string {
  const caminho = requisicao.route?.path
  if (typeof caminho !== 'string') return ROTA_NAO_ENCONTRADA
  return `${requisicao.baseUrl ?? ''}${caminho}`
}

/**
 * Middleware que mede `http.server.request.duration` de toda requisição HTTP, com a rota template,
 * o método e o status. Mede no `close` da resposta: aí o roteador já casou a rota, e a requisição
 * recusada pela guarda (401, 429) e a que não casou (404) também contam.
 */
export function httpMetricsMiddleware(medidor: Meter): (requisicao: IncomingMessage, resposta: ServerResponse, proximo: () => void) => void {
  const duracao = medidor.createHistogram(METRICS.duracaoHttp, {
    unit: 's',
    description: 'Duração da requisição HTTP, por rota template',
    advice: { explicitBucketBoundaries: LIMITES_DO_HISTOGRAMA_HTTP_S },
  })
  return (requisicao, resposta, proximo) => {
    const inicio = performance.now()
    resposta.once('close', () => {
      const metodo = requisicao.method ?? ''
      duracao.record((performance.now() - inicio) / 1_000, {
        'http.request.method': METODOS_HTTP.has(metodo) ? metodo : '_OTHER',
        'http.route': requestRoute(requisicao),
        'http.response.status_code': resposta.statusCode,
      })
    })
    proximo()
  }
}

/** Uso do pool do banco: conexões emprestadas agora e conexões descartadas desde o boot. */
export function observeDatabasePool(medidor: Meter, pool: DatabasePool): void {
  medidor
    .createObservableGauge(METRICS.poolEmUso, { description: 'Conexões do pool emprestadas agora' })
    .addCallback((observador) => observador.observe(pool.totalCount - pool.idleCount))
  const descartadas = medidor.createCounter(METRICS.conexoesDescartadas, { description: 'Conexões que o pool descartou' })
  // O pool devolve a conexão com erro para descartá-la (pool.ts: erro de conexão, sessão suja).
  pool.on('release', (erro: Error | undefined) => {
    if (erro !== undefined) descartadas.add(1)
  })
  // Conexão ociosa que o Postgres derrubou: o pool a remove.
  pool.on('error', () => descartadas.add(1))
}

/** Instância de Redis que o processo usa: o de fila (BullMQ, vagas, uso, realtime) ou o de cache (rate limit). */
export type RedisInstance = 'fila' | 'cache'

/**
 * `redis.disponivel{instancia}`: 1 só se todos os clientes do processo para aquela instância estão
 * prontos. Lê o estado do cliente, sem mandar comando: com o Redis fora, a coleta não espera nada.
 */
export function observeRedis(medidor: Meter, clientes: Partial<Record<RedisInstance, readonly Redis[]>>): void {
  medidor.createObservableGauge(METRICS.redisDisponivel, { description: '1 se o Redis responde a este processo' }).addCallback((observador) => {
    for (const [instancia, daInstancia] of Object.entries(clientes)) {
      if (daInstancia === undefined || daInstancia.length === 0) continue
      observador.observe(daInstancia.every((cliente) => cliente.status === 'ready') ? 1 : 0, { instancia })
    }
  })
}

/**
 * `limite.seguro_ativo`: a proporção das requisições limitadas pelo seguro em memória na janela recente. Com mais de
 * uma fonte (o rate limit no Redis de cache e, no Redis de fila, o contador de tentativas, os contadores por IP e o
 * desafio do login e os limites da sala), vale a maior: o alerta `seguro-limite-ativo` dispara quando qualquer uma conta sozinha em memória.
 */
export function observeInsuranceLimiter(medidor: Meter, ...fontes: ReadonlyArray<{ readonly proporcaoDoSeguro: number }>): void {
  medidor
    .createObservableGauge(METRICS.seguroAtivo, { description: 'Proporção das requisições limitadas pelo seguro em memória, de 0 a 1' })
    .addCallback((observador) => observador.observe(Math.max(0, ...fontes.map((fonte) => fonte.proporcaoDoSeguro))))
}

/** `realtime.conexoes`: conexões abertas nesta instância, sem rótulo de escola nem de sala. */
export function observeRealtimeConnections(medidor: Meter, conexoesAbertas: () => number): void {
  medidor
    .createObservableGauge(METRICS.conexoesRealtime, { description: 'Conexões abertas nesta instância do realtime' })
    .addCallback((observador) => observador.observe(conexoesAbertas()))
}

/** p99 do atraso do event loop entre duas coletas: job de CPU no event loop, GC longo, travamento. */
export function observeEventLoop(medidor: Meter): void {
  const monitor = monitorEventLoopDelay({ resolution: 20 })
  monitor.enable()
  medidor.createObservableGauge(METRICS.atrasoEventLoop, { unit: 's', description: 'p99 do atraso do event loop' }).addCallback((observador) => {
    // O histograma registra em nanossegundos. Zerado a cada coleta: o valor é o do intervalo, não desde o boot.
    observador.observe(monitor.percentile(99) / 1e9)
    monitor.reset()
  })
}
