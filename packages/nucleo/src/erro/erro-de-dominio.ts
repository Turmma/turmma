import type { ErrorCode } from '@educa/shared'

/** Status HTTP padrão de cada código. Quem lança só muda quando o caso pede outro. */
export const HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  ERRO_INTERNO: 500,
  ENTRADA_INVALIDA: 400,
  NAO_AUTENTICADO: 401,
  NAO_ENCONTRADO: 404,
  CONFLITO: 409,
  TEMPO_ESGOTADO: 503,
  INDISPONIVEL_TENTE_DE_NOVO: 503,
  LIMITE_EXCEDIDO: 429,
  CONTA_SEGURADA: 429,
  JA_RENOVADO: 409,
  // O retorno do login externo responde com redirecionamento; o código só aparece se alguma rota JSON o lançar.
  CONTA_EXTERNA_NAO_LIGADA: 401,
  ACESSO_VENCIDO: 401,
  SESSAO_ENCERRADA: 401,
  // A1, tarefa 6.0: o pedido é bem formado, e o nome não foi tomado; o nome inexistente responde igual ao tomado.
  REIVINDICACAO_RECUSADA: 409,
  // MVP de apresentação (D77). 422: o pedido é bem formado, e a licença declarada não permite o uso (D5).
  MATERIAL_SEM_LICENCA: 422,
  FUNCAO_SUSPENSA: 409,
  // Freio diário e pacote do mês do Tutor (D38): limite de uso, como o `LIMITE_EXCEDIDO`.
  LIMITE_DIARIO_DO_TUTOR: 429,
  PACOTE_DO_TUTOR_ESGOTADO: 429,
  TUTOR_PAUSADO_EM_AVALIACAO: 409,
  DESTAQUES_NAO_ABERTOS: 409,
  ENTREGA_JA_DECIDIDA: 409,
  VERSAO_ADAPTADA_NAO_APROVADA: 409,
  ATIVIDADE_ENCERRADA: 409,
  // Camada de IA (regra 80, item 4). Na rota que responde 202 estes códigos chegam pela execução, e não pelo status.
  IA_INDISPONIVEL: 503,
  IA_TEMPO_ESGOTADO: 503,
  IA_SAIDA_INVALIDA: 502,
  IA_ORCAMENTO_ESGOTADO: 429,
  IA_ENTRADA_INVALIDA: 500,
  EXECUCAO_INTERROMPIDA: 503,
  MATERIAL_INSUFICIENTE: 422,
  // F3, RF2: o pedido é bem formado, e o prazo não cabe no catálogo da retenção.
  RETENCAO_FORA_DO_LIMITE: 422,
  // F3, RF16: o pedido do titular não está no estado que a ação pede (fora de correção, já fechado, eliminação).
  PEDIDO_EM_ESTADO_INVALIDO: 409,
  // F3, RF14: a credencial está certa, mas a eliminação da pessoa está agendada. 403, e não 401: a web não tenta renovar nem deslogar em laço.
  ACESSO_SUSPENSO: 403,
}

/**
 * Espera sugerida ao cliente (`Retry-After`) quando o erro diz "tente de novo" e quem lançou não
 * sabe quanto: 503 de indisponibilidade ou de tempo esgotado. Igual à da borda (`infra/Caddyfile`).
 */
export const DEFAULT_RETRY_AFTER_SECONDS = 5

/**
 * Erro esperado do domínio. Carrega só o código, o status e, quando o cliente deve esperar, em
 * quantos segundos tentar de novo: não existe construtor com texto livre, então um erro de
 * domínio não tem onde levar nome, matrícula ou valor de campo para a resposta ou para o log.
 */
export class DomainException extends Error {
  readonly status: number

  constructor(
    readonly codigo: ErrorCode,
    status?: number,
    readonly tenteDeNovoEmSegundos?: number,
  ) {
    super(codigo)
    this.name = 'DomainException'
    // "Não encontrado" nunca sai com outro status: um 403 confirmaria que o objeto existe (regra 10, item 6).
    this.status = codigo === 'NAO_ENCONTRADO' ? HTTP_STATUS_BY_CODE.NAO_ENCONTRADO : (status ?? HTTP_STATUS_BY_CODE[codigo])
  }
}
