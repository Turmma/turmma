/**
 * Guarda de erro tipado (X5, 25.0; RF13; regra 00, item 9; regra 20, item 11).
 *
 * Em código de produção, o que se lança é erro com tipo: `DomainException` (o cliente distingue pelo código), uma
 * classe do módulo, ou `InvariantException` (a linha que "não pode acontecer"). Esta regra reprova:
 *
 * - `throw new Error(...)` e `throw Error(...)`: o filtro global não distingue um do outro, e a mensagem solta é onde
 *   o valor de campo (nome, matrícula, id) entra sem ninguém ver;
 * - `throw 'texto'`, `` throw `texto` `` e qualquer literal lançado: nem `instanceof` nem pilha;
 * - `new InvariantException(x)` e o `super(x)` de uma subclasse dela quando `x` não é texto fixo (literal, ou template sem
 *   expressão): o motivo é escrito no código, e o valor de execução não tem por onde entrar (regra 20, item 11).
 *
 * Limites declarados, que a revisão cobre: o `Error` guardado em variável ou em outro nome (`const E = Error`) e lançado
 * depois não é reconhecido, e o `throw` de uma variável que veio de `new Error()` também não (`throw erro` é o
 * relançamento, e é permitido). `throw new globalThis['Error']('x')` (índice entre colchetes) também não é reconhecido. A
 * `message` de uma classe própria do módulo que estende `Error`, com o `super` montado com valor, não passa pela guarda: só o
 * `InvariantException` tem o motivo conferido. O escopo (a pasta `src` de cada app e a do `nucleo`, sem teste nem
 * `__fixtures__`, menos o `main.tsx` da web) está em `index.mjs`.
 */

const NOME_DA_CLASSE_DE_INVARIANTE = 'InvariantException'

/** Tira as afirmações de tipo e o `!`: `throw new Error('x') as never` continua sendo `new Error('x')`. */
function desembrulhar(no) {
  let atual = no
  while (['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression'].includes(atual.type)) atual = atual.expression
  return atual
}

/** `Error` solto ou `globalThis.Error`: o que se chama com `new` ou sem. */
function ehErroGenerico(no) {
  if (no.type === 'Identifier') return no.name === 'Error'
  return no.type === 'MemberExpression' && !no.computed && no.property.type === 'Identifier' && no.property.name === 'Error'
}

/** Texto escrito no código: literal, ou template sem expressão. */
function ehTextoFixo(no) {
  const atual = desembrulhar(no)
  if (atual.type === 'Literal') return typeof atual.value === 'string'
  return atual.type === 'TemplateLiteral' && atual.expressions.length === 0
}

/** Os dois jeitos de lançar com um `Error`: `new Error(…)` e `Error(…)`. */
function chamaErroGenerico(no) {
  return (no.type === 'NewExpression' || no.type === 'CallExpression') && ehErroGenerico(no.callee)
}

/** `'generico'`, `'solto'` ou `null`: o que há de errado no que o `throw` lança. */
function problemaDoLancado(no) {
  const atual = desembrulhar(no)
  if (chamaErroGenerico(atual)) return 'generico'
  if (atual.type === 'Literal' || atual.type === 'TemplateLiteral') return 'solto'
  if (atual.type === 'ConditionalExpression') return problemaDoLancado(atual.consequent) ?? problemaDoLancado(atual.alternate)
  if (atual.type === 'LogicalExpression') return problemaDoLancado(atual.left) ?? problemaDoLancado(atual.right)
  return null
}

function ehInvariante(no) {
  return no?.name === NOME_DA_CLASSE_DE_INVARIANTE
}

/** Os argumentos do `InvariantException` (ou do `super` de uma subclasse) que não são um único texto fixo. */
function motivoInvalido(argumentos) {
  const [motivo, ...resto] = argumentos
  return motivo === undefined || resto.length > 0 || !ehTextoFixo(motivo)
}

/** A classe que contém o nó, ou `null`. */
function classeDe(no) {
  for (let atual = no.parent; atual; atual = atual.parent) {
    if (atual.type === 'ClassDeclaration' || atual.type === 'ClassExpression') return atual
  }
  return null
}

export const erroTipado = {
  meta: {
    type: 'problem',
    docs: { description: 'Proíbe lançar Error genérico ou literal em código de produção, e exige motivo fixo no InvariantException (regra 00, item 9; regra 20, item 11).' },
    schema: [],
    messages: {
      generico:
        'Não lance `Error` genérico: lance `DomainException` (o cliente precisa do código), `InvariantException` (a linha que não pode acontecer) ou uma classe própria do módulo (regra 00, item 9).',
      solto: 'Não lance texto, template nem literal: lance um erro tipado. Só um `Error` tem pilha e `instanceof` (regra 00, item 9).',
      motivo:
        'O motivo do `InvariantException` é texto fixo, escrito no código: sem `${valor}`, sem `+` e sem variável. Valor de execução (nome, matrícula, id) não entra na mensagem do erro (regra 20, item 11); dado de diagnóstico que não é pessoal vai em campo de uma subclasse.',
    },
  },
  create(context) {
    return {
      ThrowStatement(no) {
        const problema = problemaDoLancado(no.argument)
        if (problema !== null) context.report({ node: no.argument, messageId: problema })
      },
      NewExpression(no) {
        if (ehInvariante(no.callee) && motivoInvalido(no.arguments)) context.report({ node: no, messageId: 'motivo' })
      },
      CallExpression(no) {
        if (no.callee.type !== 'Super') return
        if (ehInvariante(classeDe(no)?.superClass) && motivoInvalido(no.arguments)) context.report({ node: no, messageId: 'motivo' })
      },
    }
  },
}
