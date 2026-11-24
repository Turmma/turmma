/**
 * O limite de uma tentativa de prova online (avaliacao-e-correcao, Tech Spec §5.4; regra 80, item 6): **uma função só**, que
 * o PUT da resposta, a saída da aba, `prova`, `tempo`, a rotina que encerra a prova vencida e o Tutor chamam. Pura: os
 * dados vêm de quem chama (numa consulta só, `PulsoRepository`), o relógio também.
 *
 * O limite é o `limiteBase` (começo + duração com o tempo adicional, preso ao `fecha_em`), mais as extensões do aluno e da
 * turma, mais o tempo em que a API ficou fora **dentro da prova**. A queda do nosso sistema não é tempo do aluno: ela só
 * conta no pedaço em que a prova estava correndo, e esse pedaço depende do próprio limite, que cresce com ela. Por isso o
 * cálculo é de **ponto fixo**: soma-se a sobreposição com o limite de agora, o limite sobe, a sobreposição pode subir de
 * novo, e a conta pára quando o limite não anda mais. Sem isso, a segunda queda, que só cai dentro da prova por causa da
 * primeira, ficaria de fora.
 */

/**
 * A lacuna entre dois pulsos da API a partir da qual ela conta como queda (§5.7): o pulso é de 10 s, e até 30 s é atraso
 * de tique, não indisponibilidade. É também o prazo em que a instância que não pulsa passa a recusar as rotas de prova.
 */
export const LIMIAR_DA_LACUNA_MS = 30_000

/** Uma janela em que a API ficou fora, fechada (`indisponibilidade`) ou aberta (do último pulso até agora). */
export interface IntervaloDeIndisponibilidade {
  readonly inicio: Date
  readonly fim: Date
}

/** Uma extensão de tempo do professor: de um aluno, ou da turma inteira (`alunoId` nulo). */
export interface ExtensaoDoLimite {
  readonly alunoId: string | null
  readonly minutos: number
}

/** O último pulso da API e o `now()` do banco **na mesma leitura**: a lacuna aberta é a diferença entre os dois. */
export interface PulsoDoLimite {
  readonly ultimoEm: Date
  readonly agora: Date
}

export interface EntradaDoLimite {
  /** O aluno da tentativa: só as extensões dele e as da turma somam. */
  readonly alunoId: string
  readonly iniciadaEm: Date
  /** `limite_base_em` da tentativa; `null` quando a atividade não tem duração nem janela, e então não há limite. */
  readonly limiteBase: Date | null
  readonly extensoes: readonly ExtensaoDoLimite[]
  /** As indisponibilidades **fechadas** que terminam depois do começo da tentativa. */
  readonly indisponibilidades: readonly IntervaloDeIndisponibilidade[]
  /** O pulso e o relógio do banco; `null` quando a leitura não achou a linha do pulso. */
  readonly pulso: PulsoDoLimite | null
}

const MS_POR_MINUTO = 60_000

/** O pedaço de `intervalo` que cai dentro de `[de, ate]`, em milissegundos; nunca negativo. */
function sobreposicao(intervalo: IntervaloDeIndisponibilidade, de: number, ate: number): number {
  return Math.max(0, Math.min(intervalo.fim.getTime(), ate) - Math.max(intervalo.inicio.getTime(), de))
}

/** A lacuna aberta: do último pulso até agora, só acima do limiar. Abaixo dele, o pulso está só atrasado. */
function lacunaAberta(pulso: PulsoDoLimite | null): IntervaloDeIndisponibilidade | null {
  if (pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() <= LIMIAR_DA_LACUNA_MS) return null
  return { inicio: pulso.ultimoEm, fim: pulso.agora }
}

/** O limite efetivo da tentativa, ou `null` quando ela não tem limite. */
export function limiteDaTentativa(entrada: EntradaDoLimite): Date | null {
  if (entrada.limiteBase === null) return null
  const estendidoEm = entrada.extensoes
    .filter((extensao) => extensao.alunoId === null || extensao.alunoId === entrada.alunoId)
    .reduce((soma, extensao) => soma + extensao.minutos * MS_POR_MINUTO, 0)
  const semQueda = entrada.limiteBase.getTime() + estendidoEm
  const aberta = lacunaAberta(entrada.pulso)
  const quedas = aberta === null ? entrada.indisponibilidades : [...entrada.indisponibilidades, aberta]
  const inicio = entrada.iniciadaEm.getTime()
  let limite = semQueda
  for (;;) {
    const proximo = semQueda + quedas.reduce((soma, queda) => soma + sobreposicao(queda, inicio, limite), 0)
    if (proximo === limite) return new Date(limite)
    limite = proximo
  }
}

/** A duração do aluno em milissegundos: a da prova com o percentual de tempo adicional dele (nenhum, se não tem). Sempre inteira: 600 ms por minuto e por ponto percentual. */
function duracaoDoAlunoEmMs(duracaoMin: number, percentual: number | null): number {
  return 600 * duracaoMin * (100 + (percentual ?? 0))
}

/**
 * A duração que o aluno lê (`prova` antes de começar e a lista), em minutos inteiros: a da prova com o tempo adicional dele somado, **arredondada para cima**, e sem dizer que há
 * tempo adicional (D35). Quem não tem tempo adicional lê a duração da prova.
 */
export function duracaoDoAlunoEmMinutos(duracaoMin: number, percentual: number | null): number {
  return Math.ceil(duracaoDoAlunoEmMs(duracaoMin, percentual) / MS_POR_MINUTO)
}

export interface EntradaDoLimiteBase {
  /** O `now()` do banco no começo: é o início da tentativa. */
  readonly agora: Date
  /** O fim da janela da aplicação; `null` quando a atividade não tem janela, e então a tentativa não tem limite. */
  readonly fechaEm: Date | null
  readonly duracaoMin: number | null
  /** O tempo adicional do aluno nesta prova, ou `null`. */
  readonly percentual: number | null
}

/**
 * O limite base da tentativa, gravado no começo (`limite_base_em`; Tech Spec §5.3): **o que vier antes**, o início mais a duração do aluno (com o tempo adicional) ou o fim da
 * janela (RF1). Sem duração, é o fim da janela; sem janela, não há limite (`null`). Quem começa a 10 min do fim com duração de 40 tem 10.
 */
export function limiteBaseDaTentativa({ agora, fechaEm, duracaoMin, percentual }: EntradaDoLimiteBase): Date | null {
  if (fechaEm === null) return null
  if (duracaoMin === null) return fechaEm
  return new Date(Math.min(agora.getTime() + duracaoDoAlunoEmMs(duracaoMin, percentual), fechaEm.getTime()))
}
