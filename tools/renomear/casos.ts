import ts from 'typescript'

/**
 * Os casos de teste de um arquivo: o `describe`, o `it` e o `test`, com as formas que o Vitest dá a eles (`.skip`, `.only`,
 * `.each(tabela)('título')`). O `conferir` conta os casos por arquivo, e o `restos` deixa o texto do título de fora: o título é a
 * frase da regra (regra 40) e continua em português.
 */

const CHAMADAS_DE_CASO: ReadonlySet<string> = new Set(['describe', 'it', 'test'])

/** `it`, `it.skip`, `it.each(tabela)`: o nome que abre a cadeia, ou `undefined` se a chamada não é de caso. */
function raizDaChamada(chamada: ts.CallExpression): string | undefined {
  let alvo: ts.Expression = chamada.expression
  for (;;) {
    if (ts.isPropertyAccessExpression(alvo) || ts.isCallExpression(alvo)) alvo = alvo.expression
    else break
  }
  return ts.isIdentifier(alvo) && CHAMADAS_DE_CASO.has(alvo.text) ? alvo.text : undefined
}

/** O texto fixo do título: o literal, ou o template com `${}` no lugar de cada substituição. */
function textoDoTitulo(no: ts.Node | undefined): string | undefined {
  if (no === undefined) return undefined
  if (ts.isStringLiteralLike(no)) return no.text
  if (!ts.isTemplateExpression(no)) return undefined
  return no.head.text + no.templateSpans.map((trecho) => `\${}${trecho.literal.text}`).join('')
}

export interface Caso {
  /** O literal do título no código. */
  no: ts.Node
  /** Os títulos dos `describe` que o envolvem, e o dele, separados por ` › `. */
  caminho: string
  /** `describe`, `it` ou `test`. */
  tipo: string
}

/** Todo caso do arquivo, com o título que o `describe` pai acrescenta. O título que não é texto (`describe(Classe.name, …)`) não conta. */
export function casosDe(fonte: ts.SourceFile): Caso[] {
  const casos: Caso[] = []
  const visitar = (no: ts.Node, pilha: readonly string[]): void => {
    let dentro = pilha
    if (ts.isCallExpression(no)) {
      const tipo = raizDaChamada(no)
      const titulo = tipo === undefined ? undefined : textoDoTitulo(no.arguments[0])
      if (tipo !== undefined && titulo !== undefined && no.arguments[0] !== undefined) {
        dentro = [...pilha, titulo]
        casos.push({ no: no.arguments[0], caminho: dentro.join(' › '), tipo })
      }
    }
    ts.forEachChild(no, (filho) => visitar(filho, dentro))
  }
  visitar(fonte, [])
  return casos
}
