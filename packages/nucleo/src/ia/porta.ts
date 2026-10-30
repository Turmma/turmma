import type { OrigemDaSaidaDeIa } from '@educa/shared'
import type { Perfil } from './perfis.js'
import type { TaskDefinition } from './tarefa.js'

/**
 * Quem atendeu: um adaptador, ou nenhum, quando a resposta saiu de regra fixa da tarefa (assunto delicado no Tutor).
 * A lista é `ORIGENS_DA_SAIDA_DE_IA`, de `@educa/shared`, a mesma do check de `consumo_ia`.
 */
export type OutputSource = OrigemDaSaidaDeIa

/**
 * Uma chamada de IA. A tarefa já declara a função e o perfil (regra 30, item 2); quem chama diz de que escola é o
 * gasto (que o provedor confere com a do contexto: as portas de suspensão, orçamento e consumo leem só a do contexto)
 * e, no Tutor, de que aluno. Não há campo para modelo nem para provedor: isso é configuração.
 */
export interface GenerationRequest<Entrada, Saida> {
  readonly tarefa: TaskDefinition<Entrada, Saida>
  readonly entrada: Entrada
  /** Do contexto autenticado ou da execução gravada, nunca do cliente (regra 10). */
  readonly escolaId: string
  /** Obrigatório nas tarefas do Tutor: é por ele que o freio diário do aluno é consultado (D38). Só o id, nunca o nome. */
  readonly alunoId?: string
  /** No Tutor, a turma em que o aluno está perguntando: é por ela que o pacote do mês é consultado (D38). */
  readonly turmaId?: string
  /** A `execucao_agente` que pediu, para o consumo apontar para ela. */
  readonly execucaoId?: string
  /** Cancela a chamada em curso: o `AgenteExecutor` passa o dele, e a execução que estourou o prazo não segue gastando. */
  readonly sinal?: AbortSignal
}

/**
 * Se o conteúdo saiu desta máquina e para quem. Os dois andam juntos: com envio externo há sempre o id do provedor, e
 * sem ele não há (o check `consumo_ia_provedor_so_no_envio_externo` é o espelho disto no banco). Enquanto o banco não
 * exige o `provedor` das linhas externas (contração fora do F3, Tech Spec seção 3), quem garante é este tipo.
 */
export type EnvioDaChamada =
  | { readonly envioExterno: true; readonly provedorId: string }
  | { readonly envioExterno: false; readonly provedorId: null }

/** Nada saiu: adaptador falso, modelo local, regra fixa e chamada que nem chegou a sair. */
export const SEM_ENVIO_EXTERNO: EnvioDaChamada = { envioExterno: false, provedorId: null }

interface DadosDaMedicao {
  readonly origem: OutputSource
  readonly perfil: Perfil
  readonly modelo: string
  readonly promptVersao: string
  readonly tokensDeEntrada: number
  readonly tokensDeSaida: number
  readonly duracaoMs: number
  /** Chamadas ao modelo: 0 na regra fixa, 2 quando a primeira saída foi inválida. */
  readonly tentativas: number
}

/** `envioExterno`: o conteúdo saiu desta máquina para um provedor de fora (`LLM_PROCESSAMENTO_LOCAL=false`), e `provedorId` diz qual. */
export type GenerationMeasurement = DadosDaMedicao & EnvioDaChamada

export interface GenerationResult<Saida> {
  /** Já validada pelo schema e pela conferência da tarefa. */
  readonly saida: Saida
  readonly medicao: GenerationMeasurement
}

/**
 * A porta. É a única coisa que o domínio conhece da camada de IA (regra 30, item 1): ele entrega uma tarefa e a
 * entrada, e recebe a saída validada e a medição. Falha é sempre `LLMError`, com código; erro cru de provedor não
 * atravessa.
 */
export interface LLMProvider {
  gerar<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>): Promise<GenerationResult<Saida>>
}
