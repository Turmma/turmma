import { ErrorCode } from '@educa/shared'
import { DomainException } from '../error/domain.exception.js'

/**
 * O que pode dar errado numa chamada de IA, do jeito que o domínio enxerga. São códigos do contrato da API
 * (`ErrorCode`, em `@educa/shared`), com o status de `HTTP_STATUS_BY_CODE`: o mesmo código vai para a resposta
 * HTTP, para `execucao_agente.erro` e para `consumo_ia.codigo_de_erro`. O erro cru do provedor (status, corpo,
 * mensagem do `fetch`) nunca sai da camada: ele pode repetir o prompt, e o prompt do Tutor é texto de aluno.
 */
export const LLM_ERROR_CODES = [
  /** O provedor não respondeu, recusou (429, mesmo depois da única repetição), falhou (5xx) ou está com o disjuntor aberto. */
  ErrorCode.IA_INDISPONIVEL,
  /** A chamada passou do prazo do perfil (`LLM_TIMEOUT_MS`, `_RAPIDO` ou `_PADRAO`) ou a execução passou do dela. */
  ErrorCode.IA_TEMPO_ESGOTADO,
  /** A saída não passou no schema ou na conferência da tarefa, nem depois da repetição. */
  ErrorCode.IA_SAIDA_INVALIDA,
  /** O orçamento de IA da escola não cobre mais uma chamada (D14). */
  ErrorCode.IA_ORCAMENTO_ESGOTADO,
  /** O aluno chegou ao freio diário do Tutor (D38). */
  ErrorCode.LIMITE_DIARIO_DO_TUTOR,
  /** A turma gastou o pacote do mês do Tutor (D38). */
  ErrorCode.PACOTE_DO_TUTOR_ESGOTADO,
  /** Quem chamou mandou uma entrada fora do schema da tarefa: chave a mais (nome de pessoa, por exemplo) ou campo errado. */
  ErrorCode.IA_ENTRADA_INVALIDA,
  /** A escola suspendeu esta função (D60): nada dela executa enquanto a suspensão durar. */
  ErrorCode.FUNCAO_SUSPENSA,
  /** Os trechos do material não sustentam o que foi pedido: sem página para citar, nada é gerado (regra 30, item 12). */
  ErrorCode.MATERIAL_INSUFICIENTE,
] as const
export type LLMErrorCode = (typeof LLM_ERROR_CODES)[number]

/** Como o `DomainException`, não tem texto livre: não há onde levar prompt, resposta de modelo ou nome. */
export class LLMError extends DomainException {
  /** O mesmo `codigo`, com o tipo restrito aos da camada de IA. */
  readonly codigoDeIa: LLMErrorCode

  constructor(codigoDeIa: LLMErrorCode, tenteDeNovoEmSegundos?: number) {
    super(codigoDeIa, undefined, tenteDeNovoEmSegundos)
    this.name = 'LLMError'
    this.codigoDeIa = codigoDeIa
  }
}

/**
 * Como a chamada ao provedor falhou, do jeito que a resiliência decide o que fazer (`resilient-adapter.ts`):
 * - `limite`: 429. O provedor não cobrou; repete-se uma vez, e não pesa no disjuntor.
 * - `recusada`: conexão recusada (`ECONNREFUSED`). A chamada nem chegou; repete-se uma vez, e pesa no disjuntor.
 * - `servidor`: 5xx, rede que caiu no meio, resposta que não é do padrão. Pode ter cobrado: não se repete, e pesa.
 * - `tempo`: o prazo acabou. Pode ter cobrado: não se repete, e pesa.
 * - `rejeitada`: outro 4xx. O pedido ou a configuração está errada e repetir daria o mesmo: não se repete e não pesa.
 */
export type ProviderFailure = 'limite' | 'recusada' | 'servidor' | 'tempo' | 'rejeitada'

/**
 * O erro que o adaptador do provedor lança: um `LLMError` que diz também **por que** falhou. Continua sem texto livre,
 * e por isso o corpo do provedor, que pode repetir o prompt, não tem como sair dele. A camada de resiliência o troca por
 * um `LLMError` simples antes de devolver, e quem está acima dela não conhece o `falha`.
 */
export class ProviderError extends LLMError {
  constructor(
    readonly falha: ProviderFailure,
    tenteDeNovoEmSegundos?: number,
  ) {
    super(falha === 'tempo' ? 'IA_TEMPO_ESGOTADO' : 'IA_INDISPONIVEL', tenteDeNovoEmSegundos)
    this.name = 'ProviderError'
  }
}
