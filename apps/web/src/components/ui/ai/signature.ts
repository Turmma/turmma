import { FUNCOES, NOMES_DOS_AGENTES, type Agente, type ChaveDeFuncao } from '@educa/shared'

/**
 * Quem assina uma saída de IA: o agente, ou uma função dele. Um ou outro, nunca os dois: a função já diz de que agente
 * é (`FUNCOES`, em `@educa/shared`), e assim não existe "Tutor · correção de objetiva" por engano de quem escreve a tela.
 */
export type QuemAssina = { readonly agente: Agente; readonly funcao?: never } | { readonly funcao: ChaveDeFuncao; readonly agente?: never }

/** O nome curto, usado quando a função vem junto: "Assistente · correção de objetiva" (`docs/interface.md` 9.7). */
const NOME_CURTO_DO_AGENTE: Readonly<Record<Agente, string>> = {
  assistente_de_ensino: 'Assistente',
  tutor: 'Tutor',
  analista_de_desempenho_escolar: 'Analista',
}

export function agenteDe(quem: QuemAssina): Agente {
  return quem.funcao === undefined ? quem.agente : FUNCOES[quem.funcao].agente
}

/**
 * O nome que aparece ao lado do avatar. É **nome de função, nunca nome próprio** (D17): "Assistente de ensino", ou
 * "Assistente · correção de objetiva" quando é uma função dele que assina. O agente não tem nome de gente (D58).
 */
export function nomeDaAssinatura(quem: QuemAssina): string {
  if (quem.funcao === undefined) return NOMES_DOS_AGENTES[quem.agente]
  const funcao = FUNCOES[quem.funcao]
  return `${NOME_CURTO_DO_AGENTE[funcao.agente]} · ${funcao.nome.charAt(0).toLocaleLowerCase('pt-BR')}${funcao.nome.slice(1)}`
}
