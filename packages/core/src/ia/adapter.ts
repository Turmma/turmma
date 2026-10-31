import type { Perfil } from './perfis.js'
import type { EnvioDaChamada } from './port.js'
import type { TaskDefinition } from './task.js'

/** O que voltou errado na tentativa anterior, para o modelo corrigir. Só existe na repetição. */
export interface RepairHint {
  readonly respostaAnterior: string
  readonly problemas: readonly string[]
}

export interface ModelCall<Entrada, Saida> {
  readonly tarefa: TaskDefinition<Entrada, Saida>
  /** Já validada pelo schema de entrada. */
  readonly entrada: Entrada
  readonly sinal: AbortSignal
  readonly correcao?: RepairHint
}

export interface ModelResponse {
  /** O texto que o modelo devolveu, já sem bloco de raciocínio e sem cerca de código. Ainda não validado. */
  readonly texto: string
  readonly modelo: string
  readonly tokensDeEntrada: number
  readonly tokensDeSaida: number
}

/**
 * O que muda de um provedor para outro, e só isso: fazer uma chamada e devolver o texto e o uso. Validação,
 * repetição, orçamento, registro e log são do `LLMGateway`, iguais para todo adaptador.
 */
export interface ModelAdapter {
  readonly origem: 'falso' | 'openai_compat'
  /** Se a chamada sai desta máquina e para qual provedor: nunca um sem o outro. */
  readonly envio: EnvioDaChamada
  modeloDoPerfil(perfil: Perfil): string
  /** Falha com `LLMError` (`IA_INDISPONIVEL` ou `IA_TEMPO_ESGOTADO`); nunca devolve nem lança erro cru do provedor. */
  chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse>
}
