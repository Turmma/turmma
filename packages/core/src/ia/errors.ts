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
  /** O pedido montado passa do teto de entrada da tarefa: defeito nosso, recusado antes do orçamento e do envio, sem consumo. */
  ErrorCode.PEDIDO_ACIMA_DO_TETO,
  /** A escola suspendeu esta função (D60): nada dela executa enquanto a suspensão durar. */
  ErrorCode.FUNCAO_SUSPENSA,
  /** Os trechos do material não sustentam o que foi pedido: sem página para citar, nada é gerado (regra 30, item 12). */
  ErrorCode.MATERIAL_INSUFICIENTE,
] as const
export type LLMErrorCode = (typeof LLM_ERROR_CODES)[number]

/**
 * Por que a chamada terminou `IA_INDISPONIVEL`, para quem decide se tenta de novo (a execução do lote, que adia em vez de falhar):
 * - `soberania`: a D62 recusou o envio (provedor não conferido). É definitivo: esperar não muda a conferência, e a execução termina `falhou`;
 * - `sem_vaga`: o balde de tokens da fila estava cheio e a espera da vaga acabou, **antes** de a chamada sair; `tenteDeNovoEmSegundos` diz quando o balde libera;
 * - `disjuntor`: o disjuntor do modelo estava aberto e a chamada nem saiu;
 * - `limite`: o provedor respondeu 429 e continuou respondendo depois da única repetição. O pedido **chegou** ao provedor: é falta de vaga dele, e o gateway desce o degrau do modelo menor, como no balde cheio;
 * - `rejeitada`: o provedor respondeu outro 4xx (401, 403…). O pedido ou a configuração está errada e esperar não muda: não há degrau, e a chamada termina;
 * - ausente: o provedor falhou (5xx, conexão) e **a chamada pode ter saído**.
 * Só `sem_vaga` e `disjuntor` garantem que nada foi enviado: `limite` e `rejeitada` ficam **fora** de `semEnvio`, e a linha de consumo deles leva a estimativa (D14) e o provedor.
 */
export type MotivoDaIndisponibilidade = 'soberania' | 'sem_vaga' | 'disjuntor' | 'limite' | 'rejeitada'

/** Como o `DomainException`, não tem texto livre: não há onde levar prompt, resposta de modelo ou nome. */
export class LLMError extends DomainException {
  /** O mesmo `codigo`, com o tipo restrito aos da camada de IA. */
  readonly codigoDeIa: LLMErrorCode

  constructor(
    codigoDeIa: LLMErrorCode,
    tenteDeNovoEmSegundos?: number,
    readonly motivo?: MotivoDaIndisponibilidade,
  ) {
    super(codigoDeIa, undefined, tenteDeNovoEmSegundos)
    this.name = 'LLMError'
    this.codigoDeIa = codigoDeIa
  }

  /** `true` quando a chamada com certeza não saiu: o balde cheio e o disjuntor aberto. O provedor que falhou depois de a chamada sair (5xx, `limite`, `rejeitada`) não é. */
  get semEnvio(): boolean {
    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor'
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
 * um `LLMError` simples antes de devolver, e quem está acima dela não conhece o `falha`: só a causa que decide o degrau
 * atravessa, como `motivo` (`limite`, `rejeitada`).
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
