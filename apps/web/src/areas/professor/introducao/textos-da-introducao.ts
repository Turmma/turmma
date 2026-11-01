import type { Agente } from '@educa/shared'

/**
 * Os quatro passos da introdução do professor (telas do aluno e primeiro acesso, 10.0; RF15, RF19; regra 70, itens 3, 4a e 8 a 9; D47,
 * D55, D58, D64). Texto fixo, em `.ts` com teste: **nenhuma fala varia com presença, ausência, acerto nem tempo de uso**, e nenhuma
 * afirma ser pessoa, professor ou amigo, promete voltar, esperar ou estar sempre ali, nem fala de vínculo ou saudade. Quem fala é o
 * Assistente de ensino, em nome da função, e termina parado: só acena e aponta.
 *
 * O que cada passo diz é o que o produto faz: a IA prepara e o professor aprova (regra 70, item 3); só a resposta do Tutor chega ao
 * aluno sem a aprovação dele, uma a uma (D47); em redação e discursiva a IA não corrige, não dá nota, não sugere nota nem pré-corrige
 * (D55); e usar ou não a ferramenta não vira indicador (D64). **Os quatro se pulam**: a regra de não pular é do aluno, e aqui o
 * professor tem a autonomia dele.
 *
 * **Duas frases são promessas ao professor e valem pelo código**, e mudar o código muda a frase junto: "Do Tutor você vê o uso" (regra 70,
 * item 7: uso e dificuldade, não vigilância; `apps/api/src/tutor/tutor.int.test.ts`) e "A conversa que você tem comigo não aparece
 * para a coordenação" (regra 70, item 8; `apps/api/src/assistente/assistente.int.test.ts`). "Não gera número sobre você" vale até o painel
 * do próprio professor (D45) entrar: então a fala do passo 4 se revê (`TODO.md`).
 *
 * Não há tela de fim (Tech Spec, seção 9): o passo 4 traz "onde fica cada coisa", e o último "Continuar" é o "Começar".
 */

export type IdDoPasso = 'prepara' | 'tutor' | 'discursiva' | 'indicador'

export interface PassoDoProfessor {
  readonly id: IdDoPasso
  /** A onça só acena e aponta aqui; a `BemVindo` passa a pose à `Introducao`. Quem importa a `Onca` é uma lista fechada (D58), e este arquivo não está nela. */
  readonly pose: 'acenando' | 'apontando'
  /** A fala da onça, que é o `h1` do passo. */
  readonly fala: string
  /** O que o passo diz embaixo da fala, uma frase por linha. */
  readonly linhas: readonly string[]
  /** Nenhum passo do professor é obrigatório: ele pode pular a introdução inteira (RF15). */
  readonly obrigatorio: false
}

/** Quem fala: o Assistente de ensino. A função assina embaixo da onça, com o selo "IA" (D17, D58). */
export const AGENTE_DA_INTRODUCAO: Agente = 'assistente_de_ensino'

export const FALA_DO_PASSO_1 = 'Eu preparo, você revê, e só então vai à turma.'
export const FALA_DO_PASSO_2 = 'Só a resposta do Tutor chega ao aluno sem a sua aprovação, uma a uma.'
export const FALA_DO_PASSO_3 = 'Eu não corrijo redação nem discursiva: ajudo com a rubrica e com a organização do lote.'
export const FALA_DO_PASSO_4 = 'Usar ou não esta ferramenta não gera número sobre você.'

/** Os passos, na ordem. */
export const PASSOS_DO_PROFESSOR: readonly PassoDoProfessor[] = [
  {
    id: 'prepara',
    pose: 'acenando',
    fala: FALA_DO_PASSO_1,
    linhas: ['Nada do que eu preparo chega à turma sem a sua aprovação.', 'Eu sou um programa e posso errar.'],
    obrigatorio: false,
  },
  {
    id: 'tutor',
    pose: 'apontando',
    fala: FALA_DO_PASSO_2,
    linhas: ['O que eu preparo para a turma espera pela sua aprovação.', 'Do Tutor você vê o uso: onde a turma travou e qual dúvida se repetiu.'],
    obrigatorio: false,
  },
  {
    id: 'discursiva',
    pose: 'apontando',
    fala: FALA_DO_PASSO_3,
    linhas: ['Na prova objetiva eu corrijo, e o resultado só vale depois da sua aprovação.', 'Em redação e discursiva, a correção é sua.'],
    obrigatorio: false,
  },
  {
    id: 'indicador',
    pose: 'acenando',
    fala: FALA_DO_PASSO_4,
    linhas: ['Escolher não usar não vira indicador, aviso nem cobrança.', 'A conversa que você tem comigo não aparece para a coordenação.'],
    obrigatorio: false,
  },
]

/** Quantos passos há: o carregando e o erro da `BemVindo` mostram "Passo 1 de N" sem ainda saber qual é o modo. */
export const TOTAL_DE_PASSOS = PASSOS_DO_PROFESSOR.length

/** O título da lista de lugares, no passo 4. */
export const TITULO_DE_ONDE_FICA_CADA_COISA = 'Onde fica cada coisa'

/**
 * O que cada lugar da lateral do professor é, numa frase, pelo **rótulo** que `NAVIGATION.professor` dá a ele. A lista da tela sai
 * da navegação, e não daqui: lugar que a fase não tem não aparece, e lugar novo ganha a linha dele aqui (o teste dos textos reprova o
 * que ficar sem descrição).
 */
export const DESCRICAO_DO_LUGAR: Readonly<Record<string, string>> = {
  Início: 'Peça ao Assistente e veja o que espera por você.',
  Turmas: 'Confirme suas turmas e abra cada uma.',
  Ferramentas: 'Uma ferramenta para cada tipo de material.',
  Criados: 'O que você já criou, para rever e aprovar.',
}
