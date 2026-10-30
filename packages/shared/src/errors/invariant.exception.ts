/**
 * Invariante do código que não se sustentou: a linha que "não pode acontecer" (a gravação que não devolveu a linha, a
 * consulta sem escola no contexto, a configuração que o boot já deveria ter recusado). É defeito de quem chamou, e não
 * erro de domínio: o filtro global responde 500 `ERRO_INTERNO`, sem o motivo, e o log leva só o nome da classe.
 *
 * O motivo é texto fixo, escrito no código, e nunca montado com valor de execução: nome, matrícula ou id não têm por
 * onde entrar na mensagem (regra 20, item 11). O tipo não distingue `'texto'` de `` `texto ${x}` ``; quem o recusa é a
 * guarda `guardas/erro-tipado` (`tools/guardas/regras-erro.mjs`), que reprova o motivo que não é literal. O dado de
 * diagnóstico que não é pessoal (a lista de rotas sem permissão) vai em campo de uma subclasse.
 *
 * Mora no `shared` e não no `nucleo` porque a web também lança invariante e não importa o `nucleo` (regra 00, item 1).
 */
export class InvariantException extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'InvariantException'
  }
}
