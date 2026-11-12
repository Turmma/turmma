/** Palavras do PromQL que o extrator de nomes de métrica ignora: funções, agregações e operadores usados aqui. */
const PALAVRAS_DO_PROMQL = new Set([
  'sum',
  'max',
  'min',
  'avg',
  'count',
  'by',
  'without',
  'rate',
  'increase',
  'max_over_time',
  'min_over_time',
  'resets',
  'histogram_quantile',
  'le',
  'bool',
  'and',
  'or',
  'unless',
  'on',
  'ignoring',
  'vector',
])

/**
 * Nomes de métrica numa expressão PromQL: os identificadores que sobram depois de tirar rótulos, textos entre
 * aspas, palavras do PromQL e rótulos de agrupamento. Serve ao painel e às regras de alerta, que consultam as
 * métricas pelo nome que o Prometheus dá a elas (`NOMES_NO_PROMETHEUS`).
 */
export function metricasDa(expr: string): string[] {
  const semRotulos = expr.replace(/\{[^}]*\}/g, '{}').replace(/"[^"]*"/g, '""')
  const rotulosDeAgrupamento = new Set([...semRotulos.matchAll(/\b(?:by|on|ignoring|without)\s*\(([^)]*)\)/g)].flatMap((achado) => (achado[1] ?? '').split(',').map((rotulo) => rotulo.trim())))
  return [...semRotulos.matchAll(/\b([a-z_][a-z0-9_]*)\b/g)]
    .map((achado) => achado[1] ?? '')
    .filter((nome) => !PALAVRAS_DO_PROMQL.has(nome) && !rotulosDeAgrupamento.has(nome) && !/^\d/.test(nome))
}
