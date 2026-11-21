/**
 * A conta do orçamento de IA (camada-ia, tarefa 2.0; Tech Spec, seções 3, 4 e 5; PRD, RF7 a RF9; D39, D40, D41). É função pura: a API, o lote e a medida a usam, e nenhuma tela calcula porcentagem. O que lê o banco é
 * o `OrcamentoDoMesRepository` (`@educa/core`).
 *
 * **O orçamento do mês é o valor por aluno vezes os alunos ativos.** O valor vem da escola e, onde ela não tem, da rede, **coluna a coluna**: a escola com teto próprio e sem valor usa o valor da rede e o teto dela. Teto nulo
 * nos dois vale 200%; valor nulo nos dois é "sem orçamento" (nunca zero: orçamento zero faria todo gasto passar do teto). Dinheiro em **micros** (milionésimos de real), inteiro. Nada aqui corta o uso (D40): a
 * porcentagem avisa a coordenação, e o teto só segura o lote (4.0).
 */

/** O teto de segurança que vale quando nem a escola nem a rede definiram o seu, em % do orçamento do mês (D40). */
export const TETO_PADRAO_PERCENTUAL = 200

/** O fuso em que o mês e o dia do orçamento viram: o das escolas do recorte (a chamada de 23h30 de 31/03 é de março). */
export const FUSO_DO_ORCAMENTO = 'America/Sao_Paulo'

/** De onde veio o valor por aluno que vale: a escola, a rede, ou de lugar nenhum ("sem orçamento"). */
export type OrigemDoValor = 'escola' | 'rede' | 'nenhuma'

/** De onde veio o teto que vale. */
export type OrigemDoTeto = 'escola' | 'rede' | 'padrao'

/** O que uma escola, ou uma rede, define: cada coluna pode ser nula. */
export interface OrcamentoDefinido {
  readonly valorPorAlunoMicros: number | null
  readonly tetoPercentual: number | null
}

/** O orçamento que vale para uma escola, com a origem de cada número. */
export interface OrcamentoVigente {
  readonly valorPorAlunoMicros: number | null
  readonly origemDoValor: OrigemDoValor
  readonly tetoPercentual: number
  readonly origemDoTeto: OrigemDoTeto
}

/**
 * Vale a escola, senão a rede, **coluna a coluna** (RF7): o valor e o teto são decididos cada um por si. Teto nulo nos
 * dois vale `TETO_PADRAO_PERCENTUAL`; valor nulo nos dois é `nenhuma`.
 */
export function orcamentoVigente(escola: OrcamentoDefinido, rede: OrcamentoDefinido): OrcamentoVigente {
  const valorPorAlunoMicros = escola.valorPorAlunoMicros ?? rede.valorPorAlunoMicros
  const tetoPercentual = escola.tetoPercentual ?? rede.tetoPercentual ?? TETO_PADRAO_PERCENTUAL
  return {
    valorPorAlunoMicros,
    origemDoValor: escola.valorPorAlunoMicros !== null ? 'escola' : rede.valorPorAlunoMicros !== null ? 'rede' : 'nenhuma',
    tetoPercentual,
    origemDoTeto: escola.tetoPercentual !== null ? 'escola' : rede.tetoPercentual !== null ? 'rede' : 'padrao',
  }
}

/**
 * Como está o orçamento do mês: `definido` (valor e aluno ativo: há porcentagem), `sem_orcamento` (nem a escola nem a rede definiram o valor), `sem_aluno_ativo` (montagem, virada do ano
 * letivo: sem porcentagem e sem aviso, e a Operação vê os reais) e `sem_retrato` (mês fechado antes da medição existir). Sem valor **e** sem aluno, vale `sem_orcamento`: é o que a Operação resolve.
 */
export type SituacaoDoOrcamento = 'definido' | 'sem_orcamento' | 'sem_aluno_ativo' | 'sem_retrato'

/** O limiar já cruzado do mês corrente: 80% ou 100% do orçamento. */
export type AvisoDoOrcamento = 80 | 100

/** O que a medida grava no retrato do mês e o que o mês fechado lê dele. */
export interface RetratoDoOrcamento {
  readonly alunosAtivos: number
  readonly valorPorAlunoMicros: number | null
  readonly tetoPercentual: number
  readonly origemDoValor: OrigemDoValor
}

/** O orçamento de um mês contra o custo dele. Mês sem retrato (`sem_retrato`) só tem o custo: o resto é nulo. */
export interface OrcamentoDoMes {
  readonly situacao: SituacaoDoOrcamento
  readonly valorPorAlunoMicros: number | null
  readonly origemDoValor: OrigemDoValor | null
  readonly tetoPercentual: number | null
  readonly alunosAtivos: number | null
  /** Valor por aluno vezes alunos ativos, em micros. Nulo sem orçamento definido ou sem aluno ativo. */
  readonly orcamentoMicros: number | null
  readonly custoMicros: number
  /** O custo do mês sobre o orçamento, em % arredondado para baixo: a porcentagem que a tela mostra nunca passa de um limiar que o aviso ainda não cruzou. Nula fora de `definido`. */
  readonly porcentagem: number | null
  /** O limiar cruzado (`>=`) no mês corrente; nulo no mês fechado e fora de `definido`. */
  readonly aviso: AvisoDoOrcamento | null
}

/** O custo sobre o orçamento, em % inteira para baixo. Aritmética inteira: 79,99% é 79, e o aviso de 80 só vem a 80% exatos. */
export function porcentagemDoOrcamento(custoMicros: number, orcamentoMicros: number): number {
  return Math.floor((custoMicros * 100) / orcamentoMicros)
}

/** O limiar já cruzado: 100 a partir de 100%, 80 a partir de 80%, senão nulo. */
export function avisoDaPorcentagem(porcentagem: number): AvisoDoOrcamento | null {
  if (porcentagem >= 100) return 100
  return porcentagem >= 80 ? 80 : null
}

/**
 * O orçamento de um mês com retrato: o do mês corrente (retrato calculado na hora, `mesCorrente = true`) ou o de um mês fechado
 * (retrato gravado). O aviso só existe no mês corrente.
 */
export function orcamentoDoMes(retrato: RetratoDoOrcamento, custoMicros: number, mesCorrente: boolean): OrcamentoDoMes {
  const { alunosAtivos, valorPorAlunoMicros, tetoPercentual, origemDoValor } = retrato
  const base = { valorPorAlunoMicros, origemDoValor, tetoPercentual, alunosAtivos, custoMicros }
  if (valorPorAlunoMicros === null) return { ...base, situacao: 'sem_orcamento', orcamentoMicros: null, porcentagem: null, aviso: null }
  if (alunosAtivos === 0) return { ...base, situacao: 'sem_aluno_ativo', orcamentoMicros: null, porcentagem: null, aviso: null }
  const orcamentoMicros = valorPorAlunoMicros * alunosAtivos
  const porcentagem = porcentagemDoOrcamento(custoMicros, orcamentoMicros)
  return { ...base, situacao: 'definido', orcamentoMicros, porcentagem, aviso: mesCorrente ? avisoDaPorcentagem(porcentagem) : null }
}

/** O mês fechado antes da medição: só o custo, e `sem_retrato` no lugar do que não se sabe. */
export function orcamentoSemRetrato(custoMicros: number): OrcamentoDoMes {
  return { situacao: 'sem_retrato', valorPorAlunoMicros: null, origemDoValor: null, tetoPercentual: null, alunosAtivos: null, orcamentoMicros: null, custoMicros, porcentagem: null, aviso: null }
}

const formatadorDoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_DO_ORCAMENTO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia civil do instante em São Paulo, `AAAA-MM-DD`: a chamada de 23h30 é do dia dela, mesmo já sendo o dia seguinte em UTC. */
export function diaDeSaoPaulo(instante: Date): string {
  const partes = Object.fromEntries(formatadorDoDia.formatToParts(instante).map((parte) => [parte.type, parte.value]))
  return `${String(partes['year'])}-${String(partes['month'])}-${String(partes['day'])}`
}

/** O mês civil do instante em São Paulo, `AAAA-MM`. */
export function mesDeSaoPaulo(instante: Date): string {
  return diaDeSaoPaulo(instante).slice(0, 7)
}
