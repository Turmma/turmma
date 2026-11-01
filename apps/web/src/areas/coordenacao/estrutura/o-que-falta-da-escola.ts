import { COORDENACAO_ROUTES } from '../../../paths'

/**
 * O roteiro da escola até a alocação (`docs/interface.md` 3; W4, "Estrutura"; telas da coordenação, 2.0), sem tela: a
 * Estrutura o desenha inteiro e o Painel desenha só o que falta. Vive aqui, num módulo puro, para as duas telas dizerem a
 * mesma coisa de cada passo.
 *
 * **A lista de nomes não tem marca, nunca**: saber se cada turma tem lista seria ler a lista de cada uma, e cada leitura
 * da coordenação vai para a auditoria (regra 20, item 10). O passo existe, e o módulo não o mede.
 */

/** Um passo do roteiro: feito, falta, ou "ainda não sei" (`undefined`). */
export interface PassoDoRoteiro {
  readonly titulo: string
  readonly texto: string
  /** O que fazer, numa frase que fecha sozinha: é o que o Painel escreve embaixo do passo que falta. */
  readonly acao: string
  /**
   * `undefined` é "ainda não sei": a leitura daquele passo está carregando ou falhou, e o passo fica sem marca. Dizer
   * "falta" ali mandaria a coordenação criar o que a escola já tem.
   */
  readonly feito: boolean | undefined
  /** O passo que o sistema nunca mede (a lista de nomes): sem marca por desenho, e não por leitura que falta. */
  readonly semMarca?: true
  /** O endereço da tela onde o passo se faz, **relativo à área**. */
  readonly para: string
  /** O link que fecha a frase do passo na Estrutura, quando o passo se faz em outra tela. */
  readonly link?: { readonly rotulo: string; readonly para: string }
}

/** Quanto a tela leu de cada coisa. `undefined` é "ainda não li": carregando ou falhou. */
export interface ContagemDoRoteiro {
  readonly anoEmCurso: boolean
  readonly series: number | undefined
  readonly disciplinas: number | undefined
  readonly turmas: number | undefined
  readonly professores: number | undefined
  readonly vinculos: number | undefined
}

/** Onde cada passo se faz, relativo à área. O ano, as séries e as disciplinas moram no painel "Ano letivo e disciplinas" da Estrutura. */
export const PARA_O_ANO = `${COORDENACAO_ROUTES.estrutura}?painel=ano`
const PARA_AS_TURMAS = COORDENACAO_ROUTES.estrutura
const PARA_OS_PROFESSORES = COORDENACAO_ROUTES.professores

/**
 * Os sete passos. Sem `dados` (a escola ainda não tem ano letivo), nenhum passo tem marca: o vazio mostra o roteiro todo.
 */
export function passosDoRoteiro(dados: ContagemDoRoteiro | undefined): PassoDoRoteiro[] {
  const tem = (quantos: number | undefined) => (quantos === undefined ? undefined : quantos > 0)
  return [
    { titulo: 'Ano letivo', texto: 'Crie o ano letivo e abra: as turmas nascem no ano em curso.', acao: 'Crie o ano letivo e abra.', feito: dados?.anoEmCurso, para: PARA_O_ANO },
    { titulo: 'Séries', texto: 'Do 6º ao 9º ano e do 1º ao 3º do Ensino Médio.', acao: 'Crie as séries que a escola tem.', feito: tem(dados?.series), para: PARA_O_ANO },
    { titulo: 'Disciplinas', texto: 'As que os professores dão.', acao: 'Crie as disciplinas que os professores dão.', feito: tem(dados?.disciplinas), para: PARA_O_ANO },
    { titulo: 'Turmas', texto: 'Cada turma numa série do ano em curso.', acao: 'Crie as turmas do ano em curso.', feito: tem(dados?.turmas), para: PARA_AS_TURMAS },
    { titulo: 'Lista de nomes', texto: 'Abra cada turma e cole a lista ou envie o arquivo, com nome e matrícula.', acao: 'Abra cada turma e envie a lista de nomes.', feito: undefined, semMarca: true, para: PARA_AS_TURMAS },
    {
      titulo: 'Professores',
      texto: 'Cadastre cada professor com o e-mail dele e mande o convite, em',
      acao: 'Cadastre os professores e mande o convite.',
      feito: tem(dados?.professores),
      para: PARA_OS_PROFESSORES,
      link: { rotulo: 'Professores', para: PARA_OS_PROFESSORES },
    },
    { titulo: 'Alocação', texto: 'Ligue cada professor à turma e à disciplina. Ele confirma pelo convite.', acao: 'Ligue cada professor à turma e à disciplina.', feito: tem(dados?.vinculos), para: PARA_OS_PROFESSORES },
  ]
}

/**
 * O que o Painel mostra do roteiro: só os passos que **faltam**, e se a escola pode ser dada como montada. Montada é com
 * todo passo medido feito: um passo que ainda não foi lido (`feito` indefinido, fora o que nunca se mede) impede a frase.
 */
export function oQueFaltaDaEscola(passos: readonly PassoDoRoteiro[]): { readonly faltam: readonly PassoDoRoteiro[]; readonly montada: boolean } {
  const faltam = passos.filter((passo) => passo.feito === false)
  const montada = passos.every((passo) => passo.feito === true || passo.semMarca === true)
  return { faltam, montada }
}
