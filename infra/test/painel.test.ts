import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { METRICS } from '../../packages/nucleo/src/telemetria/metricas.ts'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import { NOMES_NO_PROMETHEUS } from '../../tools/testes/metricas.ts'
import { metricasDa } from '../../tools/testes/promql.ts'

interface Painel {
  title?: string
  type?: string
  datasource?: { uid?: string }
  targets?: Array<{ expr?: string }>
}

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')
const painel = JSON.parse(lerArquivo('infra/grafana/paineis/fundacao.json')) as { uid: string; panels: Painel[] }
const graficos = painel.panels.filter((item) => item.type !== 'row')
const expressoes = graficos.flatMap((item) => (item.targets ?? []).map((alvo) => ({ titulo: item.title ?? '', expr: alvo.expr ?? '' })))

describe('painel provisionado da fundação', () => {
  it('toda consulta do painel usa uma métrica que o código exporta, com o nome que o Prometheus dá a ela', () => {
    const conhecidas = new Set<string>(Object.values(NOMES_NO_PROMETHEUS).flat())
    expect(expressoes.length).toBeGreaterThan(0)
    for (const { titulo, expr } of expressoes) {
      const usadas = metricasDa(expr)
      expect(usadas.length, titulo).toBeGreaterThan(0)
      for (const nome of usadas) expect(conhecidas.has(nome), `${titulo}: ${nome}`).toBe(true)
    }
  })

  it('toda métrica do código tem painel: nenhuma é exportada sem que alguém a veja', () => {
    const usadas = new Set<string>(expressoes.flatMap(({ expr }) => metricasDa(expr)))
    for (const [chave, nomes] of Object.entries(NOMES_NO_PROMETHEUS)) {
      expect(nomes.some((nome) => usadas.has(nome)), `${chave} (${METRICS[chave as keyof typeof METRICS]}) sem painel`).toBe(true)
    }
    expect(Object.keys(NOMES_NO_PROMETHEUS).sort()).toEqual(Object.keys(METRICS).sort())
  })

  it('o que o RF15 pede está no painel: p95 e erro por rota, espera e tamanho por escola e prioridade, realtime e pool', () => {
    const todas = expressoes.map(({ expr }) => expr).join('\n')
    expect(todas).toContain('histogram_quantile(0.95, sum by (le, job, http_route)')
    expect(todas).toMatch(/http_response_status_code=~"5\.\."/)
    expect(todas).toContain('max by (fila, escola_id) (job_espera_mais_antiga_s)')
    expect(todas).toContain('max by (fila, escola_id) (job_pendentes)')
    expect(todas).toContain('realtime_conexoes')
    expect(todas).toContain('db_pool_em_uso')
  })

  it('nenhuma consulta agrupa ou filtra por usuário', () => {
    for (const { titulo, expr } of expressoes) expect(expr, titulo).not.toMatch(/usuario/)
  })

  it('nada sai da máquina: estatística de uso, atualização, plugin baixado e snapshot público desligados, e o anônimo só lê', () => {
    const compose = parse(lerArquivo('infra/compose.yml')) as { services: Record<string, { environment?: Record<string, string> }> }
    const ambiente = compose.services['observabilidade']?.environment ?? {}
    expect(ambiente).toMatchObject({
      GF_ANALYTICS_REPORTING_ENABLED: 'false',
      GF_ANALYTICS_CHECK_FOR_UPDATES: 'false',
      GF_ANALYTICS_CHECK_FOR_PLUGIN_UPDATES: 'false',
      GF_ANALYTICS_FEEDBACK_LINKS_ENABLED: 'false',
      GF_NEWS_NEWS_FEED_ENABLED: 'false',
      GF_SNAPSHOTS_EXTERNAL_ENABLED: 'false',
      GF_PLUGINS_PREINSTALL_DISABLED: 'true',
      GF_AUTH_ANONYMOUS_ORG_ROLE: 'Viewer',
      LOKI_EXTRA_ARGS: '-reporting.enabled=false',
      TEMPO_EXTRA_ARGS: '-reporting.enabled=false',
      PYROSCOPE_EXTRA_ARGS: '-usage-stats.enabled=false',
    })
    // Endereço OTLP externo na imagem liga um exportador para fora no coletor.
    expect(Object.keys(ambiente).filter((chave) => chave.startsWith('OTEL_EXPORTER_OTLP'))).toEqual([])
  })

  it('o provedor do Grafana lê a pasta montada, e o compose monta a pasta e o provedor só para leitura', () => {
    const provedor = parse(lerArquivo('infra/grafana/provedor-de-paineis.yaml')) as { providers: Array<{ allowUiUpdates?: boolean; options?: { path?: string } }> }
    const compose = parse(lerArquivo('infra/compose.yml')) as { services: Record<string, { volumes?: string[] }> }
    const volumes = compose.services['observabilidade']?.volumes ?? []
    expect(provedor.providers).toHaveLength(1)
    expect(provedor.providers[0]?.allowUiUpdates).toBe(false)
    expect(volumes).toContain(`./grafana/paineis:${provedor.providers[0]?.options?.path ?? ''}:ro`)
    expect(volumes.some((volume) => volume.startsWith('./grafana/provedor-de-paineis.yaml:/otel-lgtm/grafana/conf/provisioning/dashboards/') && volume.endsWith(':ro'))).toBe(true)
    for (const item of graficos) expect(item.datasource?.uid, item.title).toBe('prometheus')
  })
})
