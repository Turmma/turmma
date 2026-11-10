import type pg from 'pg'

/**
 * Conferência do cenário "reivindicação em sala" (A1, tarefa 9.0; cenarios.md, K1 e K2) depois do k6: o que ele não vê
 * pela API, lido no banco e no Prometheus do projeto de carga. `npm run carga:sala` chama `conferirCenarioDaSala` direto.
 *
 * - **Zero duplicidade:** em cada escola da fase, cada nome da lista aprovado uma vez só, nenhum nome com dois pedidos
 *   pendentes ou aprovados, um aluno por nome, uma credencial por aluno (a de quem pediu pela conta da escola, sem senha, e mais a conta ligada), nenhum aluno com dois vínculos, e nenhum pedido
 *   esperando no fim.
 * - **Zero 5xx do lado da API:** nas rotas da sala, do `decidir` e do login, pela métrica HTTP, em cada fase.
 * - **Primeiro dia:** no K2, nenhum pedido segurado pelo teto de códigos errados da escola: os ~420 códigos errados da
 *   manhã ficam abaixo dele, e o alerta de código errado em massa nem vê a rajada.
 * - **Informativo:** o que cada limite da sala segurou, as reivindicações por resultado e os 503 do semáforo, por fase.
 *
 * Lê só as escolas sintéticas do cenário, pelo endereço gerado nesta execução, no banco do compose de carga: é rotina
 * nossa de teste, sem contexto de requisição, e por isso consulta as tabelas direto, sem repository (regra 10, item 9).
 * Nada de pessoa sai daqui: contagens.
 */

export interface JanelaDaFase {
  readonly fase: string
  readonly inicio: Date
  readonly fim: Date
}

export interface EscolaDaFase {
  readonly fase: string
  readonly slug: string
  /** Quantos alunos a lista da escola tem: todos precisam terminar aprovados, uma vez cada. */
  readonly esperados: number
  /** Quantos deles pediram pela conta da escola (16.0): aprovados sem senha, com a conta da escola ligada a eles. */
  readonly viaConta: number
  /** A escola do primeiro dia (K2): nenhum código errado acima do teto dela. */
  readonly primeiroDia: boolean
}

export interface ConferenciaDaSala {
  readonly linhas: readonly string[]
  readonly reprovacoes: readonly string[]
}

type Consultavel = Pick<pg.ClientBase, 'query'>

export interface EntradaDaConferencia {
  readonly banco: Consultavel
  readonly prometheus: string
  readonly janelas: readonly JanelaDaFase[]
  readonly escolas: readonly EscolaDaFase[]
}

/** As contagens de uma escola da fase, lidas no banco. */
export interface ContagemDaEscola {
  readonly nomesAprovados: number
  readonly nomesSemAprovar: number
  readonly pedidosAprovados: number
  readonly pedidosPendentes: number
  readonly nomesComDoisPedidos: number
  readonly alunos: number
  readonly credenciais: number
  /** As contas da escola ligadas a um aluno (`conta_externa`): uma por aluno que pediu pela conta. */
  readonly contasLigadas: number
  /** Os alunos da escola com uma sessão aberta pelo login da conta da escola (`metodo = 'externo'`): quem entrou pela conta depois de aprovado, e só quem pediu por ela. */
  readonly entraramPelaConta: number
  readonly alunosComDoisVinculos: number
}

/** O que reprova numa escola da fase: qualquer duplicidade, e qualquer nome que não terminou aprovado uma vez. */
export function julgarContagem(fase: string, esperados: number, contagem: ContagemDaEscola, viaConta = 0): string[] {
  const reprovacoes: string[] = []
  const igual = (campo: keyof ContagemDaEscola, valor: number, descricao: string) => {
    if (contagem[campo] !== valor) reprovacoes.push(`${fase}: ${descricao} ${String(contagem[campo])}, e o cenário pede ${String(valor)}`)
  }
  igual('nomesAprovados', esperados, 'nomes aprovados na lista:')
  igual('nomesSemAprovar', 0, 'nomes que não terminaram aprovados:')
  igual('pedidosAprovados', esperados, 'pedidos aprovados:')
  igual('pedidosPendentes', 0, 'pedidos ainda pendentes:')
  igual('nomesComDoisPedidos', 0, 'nomes com dois pedidos pendentes ou aprovados:')
  igual('alunos', esperados, 'alunos criados:')
  igual('credenciais', esperados, 'credenciais de matrícula:')
  igual('contasLigadas', viaConta, 'contas da escola ligadas:')
  igual('alunosComDoisVinculos', 0, 'alunos com dois vínculos:')
  // Quem pediu pela conta entra pela conta depois de aprovado: uma sessão `externo` por aluno ligado, e nenhuma a mais.
  igual('entraramPelaConta', viaConta, 'alunos que entraram pela conta da escola:')
  if (viaConta > 0 && contagem.entraramPelaConta === 0) reprovacoes.push(`${fase}: nenhum aluno entrou pela conta da escola depois de aprovado`)
  return reprovacoes
}

const CONTAGEM = `
  select
    (select count(*) from lista_nome l where l.escola_id = e.id and l.estado = 'aprovado') as "nomesAprovados",
    (select count(*) from lista_nome l where l.escola_id = e.id and l.estado <> 'aprovado') as "nomesSemAprovar",
    (select count(*) from reivindicacao r where r.escola_id = e.id and r.estado = 'aprovada') as "pedidosAprovados",
    (select count(*) from reivindicacao r where r.escola_id = e.id and r.estado = 'pendente') as "pedidosPendentes",
    (select count(*) from (select r.lista_nome_id from reivindicacao r where r.escola_id = e.id and r.estado in ('pendente', 'aprovada')
                            group by r.lista_nome_id having count(*) > 1) d) as "nomesComDoisPedidos",
    (select count(*) from usuario u where u.escola_id = e.id and u.papel = 'aluno') as "alunos",
    (select count(*) from credencial_matricula c where c.escola_id = e.id) as "credenciais",
    (select count(*) from conta_externa x where x.escola_id = e.id) as "contasLigadas",
    (select count(distinct s.usuario_id) from sessao s where s.escola_id = e.id and s.metodo = 'externo') as "entraramPelaConta",
    (select count(*) from (select v.usuario_id from vinculo v where v.escola_id = e.id and v.papel = 'aluno'
                            group by v.usuario_id having count(*) > 1) d) as "alunosComDoisVinculos"
  from escola e where e.slug = $1`

async function consultar(prometheus: string, expressao: string, instante: Date): Promise<Array<{ metric: Record<string, string>; valor: number }>> {
  const resposta = await fetch(`${prometheus}/api/v1/query?${new URLSearchParams({ query: expressao, time: String(instante.getTime() / 1_000) })}`)
  if (!resposta.ok) throw new Error(`o Prometheus respondeu ${resposta.status}`)
  const corpo = (await resposta.json()) as { data: { result: Array<{ metric: Record<string, string>; value: [number, string] }> } }
  return corpo.data.result.map((serie) => ({ metric: serie.metric, valor: Number(serie.value[1]) }))
}

/** O aumento de um contador na janela da fase, somado por um rótulo (ou tudo, sem rótulo). */
async function aumentoNaJanela(prometheus: string, janela: JanelaDaFase, contador: string, porRotulo?: string): Promise<Record<string, number>> {
  const segundos = Math.max(10, Math.ceil((janela.fim.getTime() - janela.inicio.getTime()) / 1_000))
  const expressao = `sum${porRotulo === undefined ? '' : ` by (${porRotulo})`} (increase(${contador}[${String(segundos)}s]))`
  const series = await consultar(prometheus, expressao, janela.fim)
  return Object.fromEntries(series.map((serie) => [porRotulo === undefined ? 'total' : (serie.metric[porRotulo] ?? '?'), Math.round(serie.valor)]))
}

/** As rotas do cenário, como aparecem no rótulo `http_route`. */
export const ROTAS_DO_CENARIO = '/v1/salas/(abrir|reivindicar)|/v1/escolas/:slug/acesso|/v1/sessao/[a-z]+/(:provedor/iniciar|retorno)|/v1/sessao/renovar|/v1/reivindicacoes/decidir|/v1/turmas/:id/reivindicacoes|/v1/sessao/matricula|/v1/sistema/contexto'

export async function conferirCenarioDaSala({ banco, prometheus, janelas, escolas }: EntradaDaConferencia): Promise<ConferenciaDaSala> {
  const linhas: string[] = []
  const reprovacoes: string[] = []

  for (const escola of escolas) {
    const { rows } = await banco.query<Record<keyof ContagemDaEscola, string>>(CONTAGEM, [escola.slug])
    const [linha] = rows
    if (linha === undefined) {
      reprovacoes.push(`${escola.fase}: a escola da fase não está no banco`)
      continue
    }
    const contagem: ContagemDaEscola = {
      nomesAprovados: Number(linha.nomesAprovados),
      nomesSemAprovar: Number(linha.nomesSemAprovar),
      pedidosAprovados: Number(linha.pedidosAprovados),
      pedidosPendentes: Number(linha.pedidosPendentes),
      nomesComDoisPedidos: Number(linha.nomesComDoisPedidos),
      alunos: Number(linha.alunos),
      credenciais: Number(linha.credenciais),
      contasLigadas: Number(linha.contasLigadas),
      entraramPelaConta: Number(linha.entraramPelaConta),
      alunosComDoisVinculos: Number(linha.alunosComDoisVinculos),
    }
    linhas.push(`${escola.fase}: ${Object.entries(contagem).map(([campo, valor]) => `${campo} ${String(valor)}`).join(', ')}`)
    reprovacoes.push(...julgarContagem(escola.fase, escola.esperados, contagem, escola.viaConta))
  }

  for (const janela of janelas) {
    const cincoXX = await aumentoNaJanela(prometheus, janela, `http_server_request_duration_seconds_count{job="educa/api", http_route=~"${ROTAS_DO_CENARIO}", http_response_status_code=~"5.."}`, 'http_route')
    const total5xx = Object.values(cincoXX).reduce((soma, valor) => soma + valor, 0)
    linhas.push(`${janela.fase}: 5xx da API nas rotas do cenário ${String(total5xx)}${total5xx > 0 ? ` (${JSON.stringify(cincoXX)})` : ''}`)
    if (total5xx > 0) reprovacoes.push(`${janela.fase}: ${String(total5xx)} resposta(s) 5xx da API nas rotas do cenário`)

    const limites = await aumentoNaJanela(prometheus, janela, 'sala_limite_atingido_total{job="educa/api"}', 'tipo')
    const reivindicacoes = await aumentoNaJanela(prometheus, janela, 'sala_reivindicacao_total{job="educa/api"}', 'resultado')
    const recusados = await aumentoNaJanela(prometheus, janela, 'login_hash_recusado_total{job="educa/api"}')
    linhas.push(`${janela.fase}: segurados pelos limites da sala ${JSON.stringify(limites)}; reivindicações ${JSON.stringify(reivindicacoes)}; 503 do semáforo ${String(recusados['total'] ?? 0)}`)
    if (escolas.some((escola) => escola.fase === janela.fase && escola.primeiroDia) && (limites['escola'] ?? 0) > 0) {
      reprovacoes.push(`${janela.fase}: ${String(limites['escola'])} pedido(s) segurado(s) pelo teto de códigos errados no primeiro dia, que precisa ficar abaixo dele`)
    }
  }
  return { linhas, reprovacoes }
}

export function descreverConferenciaDaSala(conferencia: ConferenciaDaSala): string[] {
  return [...conferencia.linhas.map((linha) => `  ${linha}`), ...conferencia.reprovacoes.map((motivo) => `  ✖ ${motivo}`)]
}
