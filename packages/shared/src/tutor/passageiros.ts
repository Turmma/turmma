import { ErrorCode } from '../errors/error-code.js'

/**
 * Os erros que passam sozinhos: vale pedir de novo com o mesmo pedido, e a tela oferece "Tentar de novo" (regra 80, item 4:
 * nunca erro cru). O resto pede que algo mude antes (o tema, o orçamento da escola) e a mensagem do catálogo diz o quê.
 *
 * Mora aqui, e não na web, porque quem decide se um código é passageiro é o contrato: código novo de IA entra nesta lista
 * junto do `ErrorCode`, e o teste que a fixa inteira o lembra.
 *
 * `PEDIDO_ACIMA_DO_TETO` é defeito nosso (o teto de entrada da tarefa não cobre o pedido que ela monta): repetir pode até dar o
 * mesmo, mas a pessoa não tem o que mudar, e a tela não a manda "mudar o pedido".
 */
export const PASSAGEIROS: readonly ErrorCode[] = [
  ErrorCode.IA_INDISPONIVEL,
  ErrorCode.IA_TEMPO_ESGOTADO,
  ErrorCode.IA_SAIDA_INVALIDA,
  ErrorCode.IA_ENTRADA_INVALIDA,
  ErrorCode.PEDIDO_ACIMA_DO_TETO,
  ErrorCode.EXECUCAO_INTERROMPIDA,
  ErrorCode.INDISPONIVEL_TENTE_DE_NOVO,
  ErrorCode.TEMPO_ESGOTADO,
  ErrorCode.ERRO_INTERNO,
]
