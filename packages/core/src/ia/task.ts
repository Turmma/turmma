import type { ChaveDeFuncao, TarefaDeIa as NomeDeTarefa } from '@educa/shared'
import type { z } from 'zod'
import type { Perfil } from './perfis.js'

/**
 * O prompt de uma tarefa: um arquivo por tarefa em `prompts/`, com versão (regra 30, item 6). A versão vai para o
 * registro de consumo, porque é ela que responde "com que instrução a IA disse isso?" depois que o texto muda.
 */
export interface VersionedPrompt {
  readonly versao: string
  readonly sistema: string
}

/**
 * Um pedaço de conteúdo que vai ao modelo como **dado**: trecho de material, texto escrito por aluno ou por professor,
 * números já calculados. O adaptador o cerca com `<dado …>` e diz ao modelo que nada ali é instrução.
 */
export interface PromptData {
  readonly tipo: string
  readonly atributos?: Readonly<Record<string, string | number>>
  readonly corpo: string
}

/** O que a tarefa manda ao modelo: a instrução, escrita por nós, e os dados, que nunca são instrução. */
export interface ModelRequest {
  readonly instrucao: string
  readonly dados: readonly PromptData[]
}

/**
 * Uma tarefa de IA, como dado: o domínio escolhe a tarefa e entrega a entrada; o resto (função, perfil, prompt,
 * schema, conferência e a versão determinística) está declarado aqui e vale para qualquer adaptador.
 *
 * Toda tarefa é de saída estruturada: o que volta ao domínio já passou por `esquemaDeSaida` e por `conferir`
 * (regra 30, item 7).
 */
export interface TaskDefinition<Entrada, Saida> {
  /** O nome do catálogo do contrato (`TAREFAS_DE_IA`, em `@educa/shared`): é o que a execução e o consumo gravam. */
  readonly nome: NomeDeTarefa
  /** A função do agente que gasta (D9, D14): é por ela que o consumo e a suspensão se registram. */
  readonly funcao: ChaveDeFuncao
  /** O mais barato que resolve (regra 30, item 2). */
  readonly perfil: Perfil
  /**
   * Sempre `strictObject`, em todos os níveis: chave a mais (um nome, um diagnóstico) é entrada inválida. Isso prende
   * a forma, não o conteúdo: campo de texto livre continua podendo trazer nome (`levaTextoLivreDePessoa`).
   */
  readonly esquemaDeEntrada: z.ZodType<Entrada>
  readonly esquemaDeSaida: z.ZodType<Saida>
  readonly prompt: VersionedPrompt
  /** Teto de tokens de saída por chamada: tarefa que não sabe parar queima a margem (D14). */
  readonly maximoDeTokensDeSaida: number
  /**
   * A entrada leva **texto livre escrito por uma pessoa**, aluno ou professor: a conversa com o Tutor, a conversa do
   * professor com o Assistente. O schema estrito barra a chave a mais, não o que a pessoa escreve: nesse texto pode
   * vir o nome ou a condição de um aluno. Por isso a entrada e a saída destas tarefas **não vão para o registro de
   * consumo**: o texto já está em `mensagem_tutor` ou em `mensagem_agente`, ligado pela execução, com o dono, o
   * acesso e a retenção de lá (regra 20, item 14; regra 70, item 8).
   */
  readonly levaTextoLivreDePessoa: boolean
  /**
   * O texto livre é de **aluno**: além de não ir para o consumo, só pode ir a provedor com processamento no Brasil,
   * antes de aluno real (D62). Toda tarefa com esta marca tem também a de cima.
   */
  readonly levaTextoDeAluno: boolean
  montarPedido(entrada: Entrada): ModelRequest
  /**
   * Resposta fixa, decidida por regra, **sem chamar o modelo**. É o caminho do assunto delicado no Tutor (D36): o
   * texto do aluno não segue para o provedor como conversa a continuar.
   */
  semModelo?(entrada: Entrada): Saida | undefined
  /**
   * Antes do schema: põe na resposta crua o que é decisão de quem pediu, e não do modelo. É o caso da adaptação, em
   * que os tipos escolhidos pelo professor voltam do modelo reescritos (um `tempoExtraPercentual: 0` que ninguém
   * pediu reprovava a resposta inteira, no ensaio com o Qwen de 04/10/2026).
   */
  prepararResposta?(entrada: Entrada, bruto: unknown): unknown
  /** Troca o que o modelo não pode improvisar por texto fixo nosso, antes da conferência. */
  ajustar?(entrada: Entrada, saida: Saida): Saida
  /**
   * A resposta nossa quando o modelo insistiu duas vezes numa saída que a **conferência** reprova (JSON e schema
   * certos, conteúdo errado; JSON quebrado continua sendo falha). Só onde falhar é pior
   * que responder por regra: no Tutor, a recusa da resposta pronta que o modelo não soube escrever sem nomear a
   * alternativa. Passa pelo schema e pela conferência como qualquer outra; reprovada, a chamada falha como antes.
   *
   * `problemas` são os da **última** reprovação da conferência, em texto fixo, para a reserva responder só ao motivo que é
   * dela: no Assistente, a recusa da D55 não cobre uma citação inválida.
   */
  reservaQuandoInvalida?(entrada: Entrada, problemas?: readonly string[]): Saida | undefined
  /**
   * O que o schema não alcança: página citada que não veio nos trechos, gabarito trocado na adaptação, Tutor
   * entregando a resposta. Devolve os problemas em texto fixo, que voltam ao modelo na repetição; lista vazia é aprovado.
   */
  conferir?(entrada: Entrada, saida: Saida): readonly string[]
  /** A versão determinística, do adaptador falso: mesma entrada, mesma saída, feita só do que veio na entrada. */
  falso(entrada: Entrada): Saida
}

/**
 * A versão determinística não achou, nos trechos, nada de que tirar a saída (material só com sumário, por exemplo).
 * Ela não inventa conteúdo: lança isto, e o adaptador falso responde `MATERIAL_INSUFICIENTE`.
 *
 * É uma classe própria, e não o `LLMError`, para a tarefa não depender do resto da camada: tarefa é dado, e pode
 * ser lida por um teste de `tools/` sem trazer junto o provedor e os erros de domínio.
 */
export class MaterialSemConteudoAproveitavelError extends Error {
  override readonly name = 'MaterialSemConteudoAproveitavelError'
}

/** Só para o compilador tirar `Entrada` e `Saida` dos dois schemas. */
export function defineTask<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>): TaskDefinition<Entrada, Saida> {
  return tarefa
}
