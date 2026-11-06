import type pg from 'pg'

/**
 * Conferência do cenário "a escola inteira entra de uma vez" (F2, tarefa 16.0; Tech Spec do onboarding, seções 7c e 13) depois do k6: o
 * que ele não vê pela API, lido no banco e no Prometheus do projeto de carga. `npm run carga:importacao` chama
 * `conferirCenarioDaImportacao` direto.
 *
 * - **O passo (3) abaixo de 1 s** (o alerta da Tech Spec, 7c): nas fases com job, o histograma `importacao.passo3.duracao` ganhou
 *   observações na janela (o job chegou ao passo (3): a planilha tem transferências nas turmas onde o gerar acesso roda) e nenhuma
 *   passou do balde de 1 s.
 * - **Nenhum job `falhou`** na janela, e nenhum 5xx do lado da API nas rotas do cenário (503 do semáforo incluído).
 * - **No banco**, em cada escola da fase: o número de importações `concluida` que a fase pede e nenhuma `falhou`.
 * - **Informativo:** o que o job fez por resultado (`concluida`, `desatualizada`, `nova_tentativa`), para o registro da tarefa.
 *
 * Lê só as escolas sintéticas do cenário, pelo endereço gerado nesta execução, no banco do compose de carga: é rotina nossa de teste,
 * sem contexto de requisição, e por isso consulta as tabelas direto, sem repository (regra 10, item 9). Nada de pessoa sai daqui:
 * contagens.
 */

/** O teto do passo (3), em segundos: o alerta "passo (3) acima de 1 s" (Tech Spec, 7c). */
export const TETO_DO_PASSO_3_S = 1

export interface JanelaDaImportacao {
  readonly fase: string
  readonly inicio: Date
  readonly fim: Date
  /** Quantas vezes o passo (3) precisa ter rodado na janela, no mínimo; zero nas fases sem job. */
  readonly passo3Minimo: number
}

export interface EscolaDaImportacao {
  readonly fase: string
  readonly slug: string
  /** Quantas importações `concluida` a escola precisa ter no fim, no mínimo. */
  readonly concluidasMinimas: number
}

export interface ConferenciaDaImportacao {
  readonly linhas: readonly string[]
  readonly reprovacoes: readonly string[]
}

type Consultavel = Pick<pg.ClientBase, 'query'>

export interface EntradaDaConferencia {
  readonly banco: Consultavel
  readonly prometheus: string
  readonly janelas: readonly JanelaDaImportacao[]
  readonly escolas: readonly EscolaDaImportacao[]
}

/** As rotas do cenário, como aparecem no rótulo `http_route`. */
export const ROTAS_DO_CENARIO = '/v1/importacoes.*|/v1/turmas/:id/acesso|/v1/reivindicacoes/decidir|/v1/sessao/(email|matricula)'

/** O que reprova na contagem do passo (3) de uma janela: poucas observações (o job não chegou lá) ou alguma acima do teto. */
export function julgarPasso3(fase: string, minimo: number, total: number, ateOTeto: number): string[] {
  const reprovacoes: string[] = []
  if (total < minimo) reprovacoes.push(`${fase}: o passo (3) rodou ${String(total)} vez(es), e o cenário pede ao menos ${String(minimo)}: o job não chegou a ele`)
  const acima = total - ateOTeto
  if (acima > 0) reprovacoes.push(`${fase}: ${String(acima)} de ${String(total)} passo(s) (3) acima de ${String(TETO_DO_PASSO_3_S)} s`)
  return reprovacoes
}

/** O que reprova nas importações de uma escola da fase: alguma `falhou`, ou menos `concluida` do que a fase pede. */
export function julgarImportacoes(fase: string, minimas: number, porEstado: Readonly<Record<string, number>>): string[] {
  const reprovacoes: string[] = []
  if ((porEstado['falhou'] ?? 0) > 0) reprovacoes.push(`${fase}: ${String(porEstado['falhou'])} importação(ões) terminaram falhou`)
  if ((porEstado['concluida'] ?? 0) < minimas) reprovacoes.push(`${fase}: ${String(porEstado['concluida'] ?? 0)} importação(ões) concluída(s), e a fase pede ao menos ${String(minimas)}`)
  return reprovacoes
}

async function consultar(prometheus: string, expressao: string, instante: Date): Promise<Array<{ metric: Record<string, string>; valor: number }>> {
  const resposta = await fetch(`${prometheus}/api/v1/query?${new URLSearchParams({ query: expressao, time: String(instante.getTime() / 1_000) })}`)
  if (!resposta.ok) throw new Error(`o Prometheus respondeu ${resposta.status}`)
  const corpo = (await resposta.json()) as { data: { result: Array<{ metric: Record<string, string>; value: [number, string] }> } }
  return corpo.data.result.map((serie) => ({ metric: serie.metric, valor: Number(serie.value[1]) }))
}

/** O valor acumulado de uma série (somada por um rótulo, ou toda) num instante: série que ainda não existe vale zero. */
async function valorEm(prometheus: string, serie: string, instante: Date, porRotulo?: string): Promise<Record<string, number>> {
  const resultado = await consultar(prometheus, `sum${porRotulo === undefined ? '' : ` by (${porRotulo})`} (${serie})`, instante)
  return Object.fromEntries(resultado.map((item) => [porRotulo === undefined ? 'total' : (item.metric[porRotulo] ?? '?'), item.valor]))
}

/**
 * O que uma série acumulou na janela da fase, somado por um rótulo (ou tudo): o valor no fim menos o valor no começo. Não é `increase()`:
 * ele descarta a primeira amostra de uma série que nasce dentro da janela, e o histograma do passo (3) nasce no primeiro job da fase.
 */
async function aumentoNaJanela(prometheus: string, janela: JanelaDaImportacao, serie: string, porRotulo?: string): Promise<Record<string, number>> {
  const [depois, antes] = [await valorEm(prometheus, serie, janela.fim, porRotulo), await valorEm(prometheus, serie, janela.inicio, porRotulo)]
  return Object.fromEntries(Object.entries(depois).map(([rotulo, valor]) => [rotulo, Math.round(valor - (antes[rotulo] ?? 0))]))
}

const CONTAGEM_POR_ESTADO = `select i.estado, count(*) as n from importacao_planilha i join escola e on e.id = i.escola_id where e.slug = $1 group by i.estado`

async function conferirEscolas(banco: Consultavel, escolas: readonly EscolaDaImportacao[]): Promise<ConferenciaDaImportacao> {
  const linhas: string[] = []
  const reprovacoes: string[] = []
  for (const escola of escolas) {
    const { rows } = await banco.query<{ estado: string; n: string }>(CONTAGEM_POR_ESTADO, [escola.slug])
    const porEstado = Object.fromEntries(rows.map((linha) => [linha.estado, Number(linha.n)]))
    linhas.push(`${escola.fase}: importações por estado ${JSON.stringify(porEstado)}`)
    reprovacoes.push(...julgarImportacoes(escola.fase, escola.concluidasMinimas, porEstado))
  }
  return { linhas, reprovacoes }
}

/** Quantas observações do passo (3) cabem em cada balde do histograma (`le`, em segundos, acumulado), na janela: onde está a cauda. */
async function distribuicaoDoPasso3(prometheus: string, janela: JanelaDaImportacao): Promise<string> {
  const baldes = await aumentoNaJanela(prometheus, janela, 'importacao_passo3_duracao_seconds_bucket', 'le')
  return Object.entries(baldes)
    .sort((a, b) => (a[0] === '+Inf' ? Infinity : Number(a[0])) - (b[0] === '+Inf' ? Infinity : Number(b[0])))
    .map(([limite, quantidade]) => `${limite}:${String(quantidade)}`)
    .join(' ')
}

/** O passo (3) da janela: quantas vezes rodou, quantas até o teto, e o que reprova. */
async function conferirPasso3(prometheus: string, janela: JanelaDaImportacao, jobs: Record<string, number>): Promise<ConferenciaDaImportacao> {
  const total = (await aumentoNaJanela(prometheus, janela, 'importacao_passo3_duracao_seconds_count'))['total'] ?? 0
  // O balde do teto: o rótulo `le` sai como "1" ou "1.0", conforme o exportador.
  const ateOTeto = (await aumentoNaJanela(prometheus, janela, `importacao_passo3_duracao_seconds_bucket{le=~"${String(TETO_DO_PASSO_3_S)}(\\\\.0)?"}`))['total'] ?? 0
  const baldes = await distribuicaoDoPasso3(prometheus, janela)
  return {
    linhas: [`${janela.fase}: passo (3) por balde (segundos, acumulado) ${baldes}`, `${janela.fase}: passo (3) rodou ${String(total)} vez(es), ${String(ateOTeto)} até ${String(TETO_DO_PASSO_3_S)} s; nova tentativa por trava ${String(jobs['nova_tentativa'] ?? 0)}; desatualizada ${String(jobs['desatualizada'] ?? 0)}`],
    reprovacoes: julgarPasso3(janela.fase, janela.passo3Minimo, total, ateOTeto),
  }
}

async function conferirJanela(prometheus: string, janela: JanelaDaImportacao): Promise<ConferenciaDaImportacao> {
  const cincoXX = await aumentoNaJanela(prometheus, janela, `http_server_request_duration_seconds_count{job="educa/api", http_route=~"${ROTAS_DO_CENARIO}", http_response_status_code=~"5.."}`, 'http_route')
  const total5xx = Object.values(cincoXX).reduce((soma, valor) => soma + valor, 0)
  const jobs = await aumentoNaJanela(prometheus, janela, 'importacao_job_total', 'resultado')
  const linhas = [`${janela.fase}: 5xx da API nas rotas do cenário ${String(total5xx)}${total5xx > 0 ? ` (${JSON.stringify(cincoXX)})` : ''}`, `${janela.fase}: jobs por resultado ${JSON.stringify(jobs)}`]
  const reprovacoes = [
    ...(total5xx > 0 ? [`${janela.fase}: ${String(total5xx)} resposta(s) 5xx da API nas rotas do cenário`] : []),
    ...((jobs['falhou'] ?? 0) > 0 ? [`${janela.fase}: ${String(jobs['falhou'])} job(s) falharam de vez`] : []),
  ]
  if (janela.passo3Minimo === 0) return { linhas, reprovacoes }
  const passo3 = await conferirPasso3(prometheus, janela, jobs)
  return { linhas: [...linhas, ...passo3.linhas], reprovacoes: [...reprovacoes, ...passo3.reprovacoes] }
}

export async function conferirCenarioDaImportacao({ banco, prometheus, janelas, escolas }: EntradaDaConferencia): Promise<ConferenciaDaImportacao> {
  const conferencias = [await conferirEscolas(banco, escolas)]
  for (const janela of janelas) conferencias.push(await conferirJanela(prometheus, janela))
  return { linhas: conferencias.flatMap(({ linhas }) => linhas), reprovacoes: conferencias.flatMap(({ reprovacoes }) => reprovacoes) }
}

export function descreverConferenciaDaImportacao(conferencia: ConferenciaDaImportacao): string[] {
  return [...conferencia.linhas.map((linha) => `  ${linha}`), ...conferencia.reprovacoes.map((motivo) => `  ✖ ${motivo}`)]
}
