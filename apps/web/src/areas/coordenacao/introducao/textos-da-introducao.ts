import type { Agente } from '@educa/shared'
import { O_QUE_A_IA_NUNCA_FAZ } from '../governanca/nunca-faz'

/**
 * Os quatro passos da introdução da coordenação (telas do aluno e primeiro acesso, 11.0; RF15, RF19; regra 20, itens 10 e 10a; regra 70,
 * itens 2, 4a, 8 e 9; D44, D45, D55, D57, D58, D64). Texto fixo, em `.ts` com teste: **nenhuma fala varia com presença, ausência, acerto
 * nem tempo de uso**, e nenhuma afirma ser pessoa, professor ou amigo, promete voltar, esperar ou estar sempre ali, nem fala de vínculo
 * ou saudade. Quem fala é o Analista de desempenho escolar, em nome da função, e termina parado: só acena e aponta.
 *
 * O que cada passo diz é o que o produto faz: a IA prepara e avisa, e a escola aprova (D44); a coordenação vê a escola em números
 * agregados, e o desempenho de professores só aparece com dois ou mais no grupo (D45; `GRUPO_MINIMO_DE_PROFESSORES`); o dado com nome só
 * abre com um motivo, e o registro guarda quem abriu, quando e para quê (regra 20, item 10); e o que a IA nunca faz é a lista de
 * `O_QUE_A_IA_NUNCA_FAZ`, a mesma da tela de Governança (D55, D57, D64). **Os quatro se pulam**: a coordenação decide o que lê.
 *
 * Não há tela de fim (Tech Spec, seção 9): o passo 4 traz "onde fica cada coisa", e o último "Continuar" é o "Começar".
 */

export type IdDoPasso = 'numeros' | 'agregado' | 'nominal' | 'nunca'

export interface PassoDaCoordenacao {
  readonly id: IdDoPasso
  /** A onça só acena e aponta aqui; a `BemVindo` passa a pose à `Introducao`. Quem importa a `Onca` é uma lista fechada (D58), e este arquivo não está nela. */
  readonly pose: 'acenando' | 'apontando'
  /** O que o passo diz embaixo da fala, uma frase por linha. O passo 4 traz a lista do que a IA nunca faz, que a tela desenha de `O_QUE_A_IA_NUNCA_FAZ`. */
  readonly linhas: readonly string[]
  /** Nenhum passo da coordenação é obrigatório: ela pode pular a introdução inteira (RF15). */
  readonly obrigatorio: false
}

/** Quem fala: o Analista de desempenho escolar. A função assina embaixo da onça, com o selo "IA" (D17, D58). */
export const AGENTE_DA_INTRODUCAO: Agente = 'analista_de_desempenho_escolar'

/**
 * A fala do passo 1 diz o nome da escola, que o `/v1/eu` traz. **"de", e não "da"**: o nome vem como a escola o escreveu ("Colégio …",
 * "Escola …", "Instituto …"), e o artigo concordaria com a palavra de abertura, que o código não conhece. Enquanto o nome não chegou
 * (o carregando), a fala diz "da sua escola": o mesmo texto, sem o nome, e não depende de ninguém.
 */
export function falaDoPasso1(nomeDaEscola?: string): string {
  return nomeDaEscola === undefined ? 'Eu ajudo a ler os números da sua escola.' : `Eu ajudo a ler os números de ${nomeDaEscola}.`
}

export const FALA_DO_PASSO_2 = 'Você vê a escola em números agregados.'
export const FALA_DO_PASSO_3 = 'Dado com nome só abre com um motivo, e isso fica registrado.'
export const FALA_DO_PASSO_4 = 'Estas coisas a IA nunca faz.'

/** Os passos, na ordem. */
export const PASSOS_DA_COORDENACAO: readonly PassoDaCoordenacao[] = [
  {
    id: 'numeros',
    pose: 'acenando',
    linhas: ['Eu preparo e aviso. Quem aprova é a escola.', 'Eu sou um programa e posso errar.'],
    obrigatorio: false,
  },
  {
    id: 'agregado',
    pose: 'apontando',
    linhas: ['Turma, série e disciplina aparecem somadas, sem nome de pessoa.', 'O desempenho de professores só aparece com dois ou mais no grupo.'],
    obrigatorio: false,
  },
  {
    id: 'nominal',
    pose: 'apontando',
    linhas: ['Abrir um aluno ou um professor pelo nome pede um motivo.', 'O registro guarda quem abriu, quando e para quê.'],
    obrigatorio: false,
  },
  {
    id: 'nunca',
    pose: 'acenando',
    linhas: O_QUE_A_IA_NUNCA_FAZ,
    obrigatorio: false,
  },
]

/** A fala de cada passo, na ordem: a do passo 1 leva o nome da escola. */
export function falasDosPassos(nomeDaEscola?: string): readonly string[] {
  return [falaDoPasso1(nomeDaEscola), FALA_DO_PASSO_2, FALA_DO_PASSO_3, FALA_DO_PASSO_4]
}

/** Quantos passos há: o carregando e o erro da `BemVindo` mostram "Passo 1 de N" sem ainda saber qual é o modo. */
export const TOTAL_DE_PASSOS = PASSOS_DA_COORDENACAO.length

/** O título da lista de lugares, no passo 4. */
export const TITULO_DE_ONDE_FICA_CADA_COISA = 'Onde fica cada coisa'

/**
 * O que cada lugar da lateral da coordenação é, numa frase, pelo **rótulo** que `NAVIGATION.coordenador` dá a ele. A lista da tela sai
 * da navegação, e não daqui: lugar que a fase não tem não aparece, e lugar novo ganha a linha dele aqui (o teste dos textos reprova o
 * que ficar sem descrição).
 */
export const DESCRICAO_DO_LUGAR: Readonly<Record<string, string>> = {
  Painel: 'A escola em números e o que espera por você.',
  Analista: 'Pergunte ao Analista sobre o desempenho da escola.',
  Escola: 'Turmas, professores e material da escola.',
  Registros: 'O que a IA fez, os pedidos de titular e a privacidade.',
}
