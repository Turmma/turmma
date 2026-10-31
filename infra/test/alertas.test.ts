import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import { ancoraDoTitulo, arquivosDeAlertaDoRepositorio, CAMINHO_DO_RUNBOOK, entradasDoRunbook } from '../../tools/guardas/alerta-tem-runbook.ts'
import { MedidorDeTeste, NOMES_NO_PROMETHEUS } from '../../tools/testes/metricas.ts'
import { metricasDa } from '../../tools/testes/promql.ts'
import { ITERACOES_MINIMAS_ARGON2, THREADS_DE_FOLGA_DO_LIBUV } from '../../apps/api/src/credencial/configuracao-de-login.ts'
import { lerEscolaARevogar, OPCAO_DA_ESCOLA } from '../../apps/api/src/ops/revogar-acessos-sala.ts'
import { EVENTO_DO_LIMITE_DA_SALA, JANELA_DOS_LIMITES_DA_SALA_MS, LimitesDaSala, TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA } from '../../apps/api/src/sala/limites-da-sala.ts'
import { ContadorEmJanela } from '../../apps/api/src/credencial/senha/contador-em-janela.ts'
import { LIMITES_DO_HISTOGRAMA_HTTP_S } from '../../packages/core/src/telemetry/metrics.ts'
import { HORAS_EM_PREPARACAO_PARA_ALERTAR } from '../../packages/shared/src/privacidade/arquivo.ts'
import { HORAS_AGENDADO_PARA_ALERTAR } from '../../packages/shared/src/privacidade/titular.ts'
import { HORAS_PARA_A_ESCOLA_CONFIRMAR } from '../../packages/shared/src/privacidade/incidente.ts'
import { lerAmbienteExemplo } from '../../tools/ci/compose.ts'
import {
  codigoSorteado,
  criarGatilhoDaFalha,
  estadoDoAlerta,
  executarEnsaioDeAlertas,
  HASH_LENTO_DO_ENSAIO,
  REGRAS_DO_ENSAIO,
  REGRAS_PROVISIONADAS,
  regrasDaResposta,
} from '../scripts/ensaio-alertas.ts'

interface Consulta {
  refId: string
  datasourceUid: string
  model: { expr?: string; instant?: boolean; type?: string; expression?: string; conditions?: Array<{ evaluator: { type: string; params: number[] } }> }
}

interface Regra {
  uid: string
  title: string
  condition: string
  for: string
  noDataState: string
  execErrState: string
  isPaused: boolean
  data: Consulta[]
}

interface Grupo {
  orgId: number
  name: string
  folder: string
  interval: string
  rules: Regra[]
}

const regras = arquivosDeAlertaDoRepositorio().flatMap((arquivo) => (parse(arquivo.conteudo) as { groups: Grupo[] }).groups.flatMap((grupo) => grupo.rules.map((regra) => ({ arquivo: arquivo.caminho, grupo, regra }))))

function regraPorUid(uid: string): { grupo: Grupo; regra: Regra } {
  const achada = regras.find((item) => item.regra.uid === uid)
  if (achada === undefined) throw new Error(`regra ${uid} não provisionada`)
  return achada
}

const expressao = (regra: Regra) => regra.data.find((consulta) => consulta.refId === 'A')?.model.expr ?? ''
const limiar = (regra: Regra) => regra.data.find((consulta) => consulta.refId === regra.condition)?.model.conditions?.[0]?.evaluator

describe('regras de alerta provisionadas', () => {
  it('são as das Tech Specs, com o `for:` e o limiar declarados (RF16 do F0; seção 7c da identidade)', () => {
    expect(regras.map(({ regra }) => regra.uid).sort()).toEqual(Object.values(REGRAS_PROVISIONADAS).sort())

    const job = regraPorUid(REGRAS_DO_ENSAIO.jobInterativo).regra
    expect(job.for).toBe('1m')
    expect(expressao(job)).toBe('max by (fila, escola_id) (job_espera_mais_antiga_s{fila="interativa"})')
    expect(limiar(job)).toEqual({ type: 'gt', params: [30] })

    const seguro = regraPorUid(REGRAS_DO_ENSAIO.seguroDoLimite).regra
    expect(seguro.for).toBe('2m')
    // A proporção do seguro com o limiar declarado, ou (`or`, e não `and`) o Redis de cache fora para aquela instância, com ou sem tráfego.
    expect(expressao(seguro)).toBe('max by (instance) ((limite_seguro_ativo{job="educa/api"} >= bool 0.5) or (redis_disponivel{job="educa/api", instancia="cache"} == bool 0))')
    expect(limiar(seguro)).toEqual({ type: 'gt', params: [0] })

    const erro = regraPorUid(REGRAS_DO_ENSAIO.taxa5xx).regra
    expect(erro.for).toBe('5m')
    // A razão de 5xx sobre o total da rota (e não a taxa absoluta de erro), só em rota com tráfego no minuto.
    expect(expressao(erro)).toBe(
      '(sum by (job, http_route) (rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[1m])) / sum by (job, http_route) (rate(http_server_request_duration_seconds_count[1m]))) and (sum by (job, http_route) (rate(http_server_request_duration_seconds_count[1m])) > 0)',
    )
    expect(limiar(erro)).toEqual({ type: 'gt', params: [0.05] })

    const reuso = regraPorUid(REGRAS_PROVISIONADAS.reusoDeRefresh).regra
    // Sem espera: cada reuso já encerrou uma família, e a janela de 10 min está na expressão.
    expect(reuso.for).toBe('0s')
    // O máximo menos o mínimo do contador na janela, por instância e somado: exato, sem a extrapolação do `increase()`,
    // que passaria de 5 com 5 reusos. A instância que reiniciou na janela entra só com o valor atual (os reusos desde o
    // reinício), e não com o acumulado de antes dele.
    expect(expressao(reuso)).toBe(
      'sum (((max_over_time(sessao_renovacao_total{job="educa/api", resultado="reuso"}[10m]) - min_over_time(sessao_renovacao_total{job="educa/api", resultado="reuso"}[10m])) and (resets(sessao_renovacao_total{job="educa/api", resultado="reuso"}[10m]) == 0)) or (sessao_renovacao_total{job="educa/api", resultado="reuso"} and (resets(sessao_renovacao_total{job="educa/api", resultado="reuso"}[10m]) > 0)))',
    )
    expect(limiar(reuso)).toEqual({ type: 'gt', params: [5] })

    const lento = regraPorUid(REGRAS_DO_ENSAIO.loginLento).regra
    expect(lento.for).toBe('3m')
    // O p95 do último minuto, somadas instâncias e métodos, e só com login no minuto: sem tráfego, sem série.
    expect(expressao(lento)).toBe(
      'histogram_quantile(0.95, sum by (le) (rate(login_duracao_seconds_bucket{job="educa/api"}[1m]))) and on () (sum (rate(login_duracao_seconds_count{job="educa/api"}[1m])) > 0)',
    )
    expect(limiar(lento)).toEqual({ type: 'gt', params: [1] })

    const recusado = regraPorUid(REGRAS_DO_ENSAIO.loginHashRecusado).regra
    expect(recusado.for).toBe('3m')
    // Os 503 do semáforo sobre todos os logins (a razão, e não a taxa absoluta), só com login no minuto.
    expect(expressao(recusado)).toBe(
      '(sum (rate(login_hash_recusado_total{job="educa/api"}[1m])) / sum (rate(login_duracao_seconds_count{job="educa/api"}[1m]))) and on () (sum (rate(login_duracao_seconds_count{job="educa/api"}[1m])) > 0)',
    )
    expect(limiar(recusado)).toEqual({ type: 'gt', params: [0.01] })

    const rebaixado = regraPorUid(REGRAS_DO_ENSAIO.loginRebaixado).regra
    expect(rebaixado.for).toBe('2m')
    // Por escola, e basta uma instância com a série em 1: o rebaixamento é de cada instância, e o alerta nunca leva IP.
    expect(expressao(rebaixado)).toBe('max by (escola_id) (login_prioridade_rebaixada{job="educa/api"})')
    expect(limiar(rebaixado)).toEqual({ type: 'gt', params: [0] })

    const limiteEmail = regraPorUid(REGRAS_DO_ENSAIO.loginEmailLimiteIp).regra
    expect(limiteEmail.for).toBe('5m')
    // As rebaixadas por minuto, somadas as instâncias, sem rótulo nenhum.
    expect(expressao(limiteEmail)).toBe('sum (rate(login_limite_email_ip_total{job="educa/api"}[1m])) * 60')
    expect(limiar(limiteEmail)).toEqual({ type: 'gt', params: [20] })

    // L11 (A1, tarefa 9.0): as seguradas por minuto no teto de códigos errados, somadas as instâncias, sem agrupar por
    // escola nem por usuário (a série nem tem escola): a escola vem da linha do log.
    const sala = regraPorUid(REGRAS_DO_ENSAIO.salaCodigoErrado).regra
    expect(sala.for).toBe('5m')
    expect(expressao(sala)).toBe('sum (rate(sala_limite_atingido_total{job="educa/api", tipo="escola"}[1m])) * 60')
    expect(limiar(sala)).toEqual({ type: 'gt', params: [10] })

    // F3, tarefa 3.0: por escola, em qualquer réplica do worker-lote, e só com duas noites seguidas (a série vai de 0 a 2).
    const expurgo = regraPorUid(REGRAS_PROVISIONADAS.expurgoIncompleto).regra
    expect(expurgo.for).toBe('1m')
    expect(expressao(expurgo)).toBe('max by (escola_id) (expurgo_noites_incompletas{job="educa/worker"})')
    expect(limiar(expurgo)).toEqual({ type: 'gt', params: [1] })

    // F3, tarefa 9.0: por escola, em qualquer réplica do worker-lote, e só acima de 24 h da detecção (HORAS_PARA_A_ESCOLA_CONFIRMAR).
    const incidente = regraPorUid(REGRAS_PROVISIONADAS.incidenteSemConfirmacao).regra
    expect(incidente.for).toBe('1m')
    expect(expressao(incidente)).toBe('max by (escola_id) (incidente_horas_sem_confirmacao{job="educa/worker"})')
    expect(limiar(incidente)).toEqual({ type: 'gt', params: [HORAS_PARA_A_ESCOLA_CONFIRMAR] })

    // F3, tarefa 13.0: por escola, em qualquer réplica do worker-lote, e só acima de 2 h esperando o arquivo (HORAS_EM_PREPARACAO_PARA_ALERTAR).
    const arquivo = regraPorUid(REGRAS_PROVISIONADAS.arquivoEmPreparacao).regra
    expect(arquivo.for).toBe('1m')
    expect(expressao(arquivo)).toBe('max by (escola_id) (arquivo_horas_em_preparacao{job="educa/worker"})')
    expect(limiar(arquivo)).toEqual({ type: 'gt', params: [HORAS_EM_PREPARACAO_PARA_ALERTAR] })

    // F3, tarefa 15.0: por escola, em qualquer réplica do worker-lote, e só acima de 48 h do prazo da eliminação (HORAS_AGENDADO_PARA_ALERTAR).
    const eliminacao = regraPorUid(REGRAS_PROVISIONADAS.eliminacaoVencida).regra
    expect(eliminacao.for).toBe('1m')
    expect(expressao(eliminacao)).toBe('max by (escola_id) (eliminacao_horas_vencida{job="educa/worker"})')
    expect(limiar(eliminacao)).toEqual({ type: 'gt', params: [HORAS_AGENDADO_PARA_ALERTAR] })

    // X5, tarefa 44.0: por tipo, em qualquer despachante, com qualquer job falho na tabela (acima de zero), por 1 min.
    const falhouDeVez = regraPorUid(REGRAS_PROVISIONADAS.jobFalhouDeVez).regra
    expect(falhouDeVez.for).toBe('1m')
    expect(expressao(falhouDeVez)).toBe('max by (tipo) (job_falhos)')
    expect(limiar(falhouDeVez)).toEqual({ type: 'gt', params: [0] })
  })

  it('L11: a linha `sala.limite_atingido` que o limite da escola escreve traz o `escolaId` que o comando da entrada do runbook recebe', async () => {
    // O limite da sala de verdade, com o Redis fora (o seguro em memória conta) e uma instância: o teto é o mesmo.
    const medidor = new MedidorDeTeste()
    const linhas: unknown[] = []
    // O cliente fora do ar: só o `status` é lido antes de ir ao seguro.
    const foraDoAr = { status: 'end' } as Pick<Redis, 'status'> as Redis
    const janela = new ContadorEmJanela(foraDoAr, new TextEncoder().encode('chave-de-teste-do-contador-com-32-bytes'), {
      janelaMs: JANELA_DOS_LIMITES_DA_SALA_MS,
      avisarSeguro: () => undefined,
    })
    const limites = new LimitesDaSala({ janela, instancias: 1, medidor: medidor.medidor, logger: { warn: (linha: unknown) => void linhas.push(linha) }, esperar: async () => undefined })
    const escolaId = randomUUID()
    try {
      for (let vez = 0; vez < TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA; vez++) await limites.codigoErrado(escolaId)
      await limites.antesDaBusca(escolaId)
      await limites.antesDaBusca(escolaId)
    } finally {
      await medidor.encerrar()
    }
    // Uma linha por escola e janela, com o evento da constante: é o que o runbook manda procurar no log.
    expect(linhas).toEqual([{ evento: EVENTO_DO_LIMITE_DA_SALA, tipo: 'escola', escolaId }])
    const [linha] = linhas as Array<{ escolaId: string }>
    // O comando aceita o campo como o log o entrega, e revoga a escola dele.
    expect(lerEscolaARevogar([`--${OPCAO_DA_ESCOLA}`, linha?.escolaId ?? ''])).toBe(escolaId)

    // A entrada do runbook cita o evento, o campo e o comando com a opção que o leitor aceita, e o comando existe.
    const entrada = entradasDoRunbook(readFileSync(join(raizRepositorio, CAMINHO_DO_RUNBOOK), 'utf8')).get(ancoraDoTitulo(regraPorUid(REGRAS_DO_ENSAIO.salaCodigoErrado).regra.title)) ?? ''
    expect(entrada).toContain(`\`${EVENTO_DO_LIMITE_DA_SALA}\``)
    expect(entrada).toContain('`escolaId`')
    expect(entrada).toContain(`npm run -s ops:revogar-acessos-sala -- --${OPCAO_DA_ESCOLA} <escolaId do log>`)
    const pacote = JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pacote.scripts['ops:revogar-acessos-sala']).toMatch(/build -w @educa\/api && node --env-file=\.env\.example apps\/api\/dist\/ops\/revogar-acessos-sala\.js$/)
  })

  it('o código que o ensaio tenta tem o formato do código da turma: 8 caracteres do alfabeto sem letra que confunde', () => {
    for (let vez = 0; vez < 200; vez++) expect(codigoSorteado()).toMatch(/^[2-9A-HJKMNP-Z]{8}$/)
  })

  it('o limite de 1 s do login lento é fronteira de balde do histograma de login.duracao: o p95 acima de 1 s não é interpolação', () => {
    expect(LIMITES_DO_HISTOGRAMA_HTTP_S).toContain(1)
  })

  it('o hash lento do ensaio é uma configuração que a API aceita: acima da OWASP e com a concorrência dentro das threads do compose', () => {
    const ambiente: Record<string, string | undefined> = { ...lerAmbienteExemplo(), ...HASH_LENTO_DO_ENSAIO }
    expect(Number(ambiente['LOGIN_ARGON2_ITERACOES'])).toBeGreaterThan(ITERACOES_MINIMAS_ARGON2)
    expect(Number(ambiente['LOGIN_HASH_CONCORRENCIA'])).toBeLessThanOrEqual(Number(ambiente['UV_THREADPOOL_SIZE']) - THREADS_DE_FOLGA_DO_LIBUV)
  })

  it('toda regra consulta o Prometheus da observabilidade por consulta instantânea, avalia a cada 10 s e não nasce pausada', () => {
    for (const { arquivo, grupo, regra } of regras) {
      expect(grupo.interval, arquivo).toBe('10s')
      expect(grupo.folder, arquivo).toBe('Educa.ia alertas')
      expect(regra.isPaused, arquivo).toBe(false)
      const consulta = regra.data.find((item) => item.refId === 'A')
      expect(consulta?.datasourceUid, arquivo).toBe('prometheus')
      expect(consulta?.model.instant, arquivo).toBe(true)
      const condicao = regra.data.find((item) => item.refId === regra.condition)
      expect(condicao?.model).toMatchObject({ type: 'threshold', expression: 'A' })
    }
  })

  it('sem dado é normal, e erro de avaliação aparece como erro: série que some não prende o alerta disparado', () => {
    for (const { arquivo, regra } of regras) {
      expect(regra.noDataState, arquivo).toBe('OK')
      expect(regra.execErrState, arquivo).toBe('Error')
    }
  })

  it('toda regra consulta métrica que o código exporta, com o nome do Prometheus, e nenhuma agrupa por usuário', () => {
    const conhecidas = new Set<string>(Object.values(NOMES_NO_PROMETHEUS).flat())
    for (const { arquivo, regra } of regras) {
      const usadas = metricasDa(expressao(regra))
      expect(usadas.length, arquivo).toBeGreaterThan(0)
      for (const nome of usadas) expect(conhecidas.has(nome), `${arquivo}: ${nome}`).toBe(true)
      expect(expressao(regra), arquivo).not.toMatch(/usuario/)
    }
  })

  it('o compose monta a pasta das regras no provisionamento de alertas do Grafana, só para leitura', () => {
    const compose = parse(readFileSync(join(raizRepositorio, 'infra/compose.yml'), 'utf8')) as { services: Record<string, { volumes?: string[] }> }
    expect(compose.services['observabilidade']?.volumes).toContain('./grafana/alertas:/otel-lgtm/grafana/conf/provisioning/alerting:ro')
  })

  it('`npm run ensaio:alertas` constrói o emissor de token e roda o ensaio com as variáveis de .env.example, sobrepostas pelo .env local como no compose', () => {
    const pacote = JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pacote.scripts['ensaio:alertas']).toMatch(/build -w @educa\/api && node --env-file=\.env\.example --env-file-if-exists=\.env infra\/scripts\/ensaio-alertas\.ts$/)
  })
})

describe('leitura do estado das regras na API do Grafana', () => {
  it('classifica os estados do Grafana, inclusive os com motivo entre parênteses', () => {
    expect(estadoDoAlerta('Alerting')).toBe('disparado')
    expect(estadoDoAlerta('Alerting (NoData)')).toBe('disparado')
    expect(estadoDoAlerta('Pending')).toBe('pendente')
    expect(estadoDoAlerta('Normal (NoData)')).toBe('normal')
    expect(estadoDoAlerta('Normal')).toBe('normal')
    expect(estadoDoAlerta('Error')).toBe('erro')
    // Estado que o ensaio não conhece (`Recovering`, de `keep_firing_for`, ou um nome novo do Grafana) não passa por normal.
    expect(() => estadoDoAlerta('Recovering')).toThrow('estado de alerta desconhecido')
    expect(() => estadoDoAlerta('')).toThrow('estado de alerta desconhecido')
  })

  it('lê uid, `for:`, rótulos e início da pendência de cada alerta, e ignora o que não é regra do Grafana', () => {
    const corpo = {
      status: 'success',
      data: {
        groups: [
          {
            name: 'fila',
            rules: [
              {
                uid: REGRAS_DO_ENSAIO.jobInterativo,
                name: 'Job interativo esperando',
                state: 'firing',
                duration: 60,
                alerts: [
                  { labels: { escola_id: 'a', fila: 'interativa' }, state: 'Alerting', activeAt: '2026-09-13T22:07:10Z' },
                  { labels: { escola_id: 'b', fila: 'interativa' }, state: 'Normal', activeAt: '0001-01-01T00:00:00Z' },
                ],
              },
              { name: 'sem uid', state: 'inactive' },
            ],
          },
        ],
      },
    }
    const lidas = regrasDaResposta(corpo)
    expect([...lidas.keys()]).toEqual([REGRAS_DO_ENSAIO.jobInterativo])
    expect(lidas.get(REGRAS_DO_ENSAIO.jobInterativo)).toEqual({
      uid: REGRAS_DO_ENSAIO.jobInterativo,
      titulo: 'Job interativo esperando',
      estado: 'firing',
      duracaoS: 60,
      alertas: [
        { estado: 'disparado', rotulos: { escola_id: 'a', fila: 'interativa' }, desdeMs: Date.parse('2026-09-13T22:07:10Z') },
        { estado: 'normal', rotulos: { escola_id: 'b', fila: 'interativa' }, desdeMs: undefined },
      ],
    })
    expect(regrasDaResposta({ status: 'error' }).size).toBe(0)
  })
})

describe('travas do ensaio', () => {
  it('permissão: fora de AMBIENTE=local o ensaio recusa antes de tocar no compose, no banco ou na API', async () => {
    for (const AMBIENTE of ['producao', 'staging', undefined]) {
      const chamadas: string[][] = []
      const ensaio = executarEnsaioDeAlertas({
        compose: (...argumentos) => {
          chamadas.push(argumentos)
          return Promise.resolve({ codigo: 0, saida: '' })
        },
        composeCom: (_sobreposicao, ...argumentos) => {
          chamadas.push(argumentos)
          return Promise.resolve({ codigo: 0, saida: '' })
        },
        servicos: [],
        apis: ['api-1'],
        apiUrl: 'http://127.0.0.1:1',
        grafanaUrl: 'http://127.0.0.1:1',
        bancoUrl: 'postgres://ninguem@127.0.0.1:1/nada',
        ambiente: { AMBIENTE },
        criarEscolaComSessoes: () => Promise.reject(new Error('não deveria criar escola nem sessão')),
      })
      await expect(ensaio, String(AMBIENTE)).rejects.toThrow('o ensaio de alertas só roda com AMBIENTE=local')
      expect(chamadas, String(AMBIENTE)).toEqual([])
    }
  })

  it('o gatilho só é criado para id de escola em formato UUID: o id entra no texto do DDL', async () => {
    for (const escolaId of ["x'::uuid) execute function pg_sleep(); --", '', '00000000-0000-0000-0000-00000000000G']) {
      // Banco inexistente: se a checagem não recusasse antes, o erro seria de conexão, e não este.
      await expect(criarGatilhoDaFalha('postgres://ninguem@127.0.0.1:1/nada', escolaId)).rejects.toThrow('escola do ensaio precisa ser um UUID')
    }
  })
})
