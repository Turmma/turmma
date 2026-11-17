/**
 * Os três agentes e as funções de cada um (D32 revista, D9, D60), declarados em código: é daqui que a tela da
 * coordenação responde "o que essa IA faz sozinha?" (regra 70, item 5), e é por `chave` que a suspensão por função
 * (D60) e o consumo (D14) se registram.
 *
 * A autonomia é da função, não do agente (`docs/agentes.md`): 1 executa e registra, 2 executa e avisa, 3 propõe e
 * espera aprovação, 4 nunca faz. O Tutor é a única exceção à aprovação prévia (D47), e por isso a função dele é 2,
 * com supervisão do professor.
 */
export const AGENTES = ['assistente_de_ensino', 'tutor', 'analista_de_desempenho_escolar'] as const
export type Agente = (typeof AGENTES)[number]

export const NOMES_DOS_AGENTES: Readonly<Record<Agente, string>> = {
  assistente_de_ensino: 'Assistente de ensino',
  tutor: 'Tutor',
  analista_de_desempenho_escolar: 'Analista de desempenho escolar',
}

export const NIVEIS_DE_AUTONOMIA = [1, 2, 3, 4] as const
export type NivelDeAutonomia = (typeof NIVEIS_DE_AUTONOMIA)[number]

export interface DeclaracaoDeFuncao {
  readonly agente: Agente
  readonly nome: string
  readonly autonomia: NivelDeAutonomia
  /** Alto risco no CNE (D60): exige AIA e pode ser suspensa pela escola. */
  readonly altoRisco: boolean
  /** O que ela faz sozinha, em português comum, para a coordenação (regra 70, item 5). */
  readonly fazSozinha: string
  /** O que espera uma pessoa antes de valer. */
  readonly esperaAprovacao: string
}

export const FUNCOES = {
  conversa_e_ferramentas: {
    agente: 'assistente_de_ensino',
    nome: 'Conversa e ferramentas',
    autonomia: 1,
    altoRisco: false,
    fazSozinha: 'Gera rascunho de atividade, plano de aula e material, sempre a partir do material da escola e com a página citada.',
    esperaAprovacao: 'Nada vai ao aluno: o que sai é rascunho do professor até ele usar.',
  },
  correcao_de_objetiva: {
    agente: 'assistente_de_ensino',
    nome: 'Correção de objetiva',
    autonomia: 2,
    altoRisco: true,
    fazSozinha: 'Corrige as questões objetivas, monta o diagnóstico por habilidade e o relatório por questão, e avisa o professor.',
    esperaAprovacao: 'O diagnóstico só chega ao aluno depois que o professor abre os casos destacados e aprova o lote.',
  },
  adaptacao: {
    agente: 'assistente_de_ensino',
    nome: 'Adaptação',
    autonomia: 3,
    altoRisco: true,
    fazSozinha: 'Prepara a versão adaptada da atividade a partir do tipo de adaptação escolhido, sem receber diagnóstico nem texto sobre o aluno.',
    esperaAprovacao: 'A versão adaptada só chega ao aluno depois que o professor aprova.',
  },
  classificacao_do_material: {
    agente: 'assistente_de_ensino',
    nome: 'Classificação do material',
    autonomia: 1,
    altoRisco: true,
    fazSozinha: 'Classifica cada capítulo ou bloco de páginas do material pela BNCC, à noite. A coordenação corrige, e a correção vence.',
    esperaAprovacao: 'Nada chega ao aluno pela classificação: a habilidade de cada questão só vale quando o professor confere e aplica a atividade.',
  },
  tutor_com_o_aluno: {
    agente: 'tutor',
    nome: 'Tutor com o aluno',
    autonomia: 2,
    altoRisco: true,
    fazSozinha: 'Conduz o aluno por perguntas, sem entregar a resposta pronta, restrito ao material da turma e citando a página.',
    esperaAprovacao: 'Responde na hora, sem que o professor aprove cada resposta. O professor da turma acompanha: vê quem está usando, quanto e em que atividade, e recebe os avisos.',
  },
  sinais_para_o_professor: {
    agente: 'tutor',
    nome: 'Sinais para o professor',
    autonomia: 2,
    altoRisco: true,
    fazSozinha: 'Avisa o professor da turma quando um aluno travou, pediu a resposta pronta ou repetiu a mesma dúvida, e quando um aluno escreveu sobre um assunto pessoal delicado e precisa da atenção de um adulto. Neste último aviso, o professor não recebe o que o aluno escreveu.',
    esperaAprovacao: 'Só avisa: não decide nada sobre o aluno. O nome do aluno chega só ao professor da turma.',
  },
  resumo_e_alerta: {
    agente: 'analista_de_desempenho_escolar',
    nome: 'Resumo e alerta',
    autonomia: 2,
    altoRisco: true,
    fazSozinha: 'Monta o resumo e os alertas quando a coordenação pede, sempre em agregado por série e disciplina.',
    esperaAprovacao: 'O detalhe de turma ou de pessoa só abre com registro em auditoria. Nunca contata professor nem família.',
  },
} as const satisfies Record<string, DeclaracaoDeFuncao>

export type ChaveDeFuncao = keyof typeof FUNCOES
export const CHAVES_DE_FUNCAO = Object.keys(FUNCOES) as ChaveDeFuncao[]

export function ehChaveDeFuncao(valor: string): valor is ChaveDeFuncao {
  return Object.hasOwn(FUNCOES, valor)
}
