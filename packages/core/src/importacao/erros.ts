/**
 * Os dois desvios do passo (3) que não são falha (F2, 6.0; Tech Spec, seção 5, "O job"). Nenhum guarda texto: o erro sobe pelo
 * motor, e nem a mensagem nem a pilha levam nome, e-mail ou matrícula.
 */

/**
 * O que a coordenação viu na prévia mudou antes do passo (3) escrever (um `desativar` que não alcança mais o marcado, o usuário
 * que já está ativo, o convite que já está em aberto): a transação volta e a importação sai `desatualizada`, sem escrita.
 */
export class DiferencaNaPlanilhaError extends Error {
  constructor() {
    super('diferenca_na_planilha')
    this.name = 'DiferencaNaPlanilhaError'
  }
}

/**
 * A conta que o passo (1) achou ou criou deixou de existir com aquele e-mail antes do passo (3) (o expurgo de acesso a limpou, ou
 * outra desativação a limpou): nenhum convite pode ir para conta sem e-mail. A transação volta e o job tenta de novo, refazendo o (1).
 */
export class ContaDaPlanilhaPerdidaError extends Error {
  constructor() {
    super('conta_da_planilha_perdida')
    this.name = 'ContaDaPlanilhaPerdidaError'
  }
}
