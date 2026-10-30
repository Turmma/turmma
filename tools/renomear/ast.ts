import { extname } from 'node:path'
import ts from 'typescript'

/** Os arquivos que o TypeScript lê como código (comentário, especificador, literal). */
export const EXTENSOES_DE_CODIGO: ReadonlySet<string> = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])

/**
 * A pasta do protótipo de interface. A ferramenta a nomeia só para deixá-la de fora (nenhum passo a toca); este é o único arquivo
 * que a escreve, e está em `CITAM_O_PROTOTIPO`, de `tools/guardas/guardas.test.ts`, que é onde a exceção se declara.
 */
export const PASTA_DO_PROTOTIPO = 'mockups'

export const ehCodigo = (caminho: string): boolean => EXTENSOES_DE_CODIGO.has(extname(caminho))

const TIPO_DE_SCRIPT: Record<string, ts.ScriptKind> = {
  '.tsx': ts.ScriptKind.TSX,
  '.jsx': ts.ScriptKind.JSX,
  '.js': ts.ScriptKind.JS,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
}

export function analisar(caminho: string, texto: string): ts.SourceFile {
  return ts.createSourceFile(caminho, texto, { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseNone }, true, TIPO_DE_SCRIPT[extname(caminho)] ?? ts.ScriptKind.TS)
}

/** O identificador que começa em `inicio`. */
export function identificadorEm(fonte: ts.SourceFile, inicio: number): ts.Identifier | undefined {
  let achado: ts.Identifier | undefined
  const visitar = (no: ts.Node): void => {
    if (achado !== undefined || inicio < no.getFullStart() || inicio >= no.getEnd()) return
    if (ts.isIdentifier(no) && no.getStart(fonte) === inicio) achado = no
    else ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return achado
}

/** O número da linha (a partir de 1) da posição. */
export const linhaDe = (fonte: ts.SourceFile, posicao: number): number => fonte.getLineAndCharacterOfPosition(posicao).line + 1

/** Aplica as trocas (início, comprimento, texto) de trás para a frente, para as posições não se deslocarem. */
export function aplicarTrocas(texto: string, trocas: readonly { inicio: number; comprimento: number; novo: string }[]): string {
  let resultado = texto
  for (const { inicio, comprimento, novo } of [...trocas].sort((a, b) => b.inicio - a.inicio)) {
    resultado = resultado.slice(0, inicio) + novo + resultado.slice(inicio + comprimento)
  }
  return resultado
}

const DONOS_DE_NOME_DE_MEMBRO: ReadonlyArray<(no: ts.Node) => boolean> = [
  ts.isPropertyAccessExpression,
  ts.isPropertyAssignment,
  ts.isPropertySignature,
  ts.isPropertyDeclaration,
  ts.isMethodDeclaration,
  ts.isMethodSignature,
  ts.isGetAccessorDeclaration,
  ts.isSetAccessorDeclaration,
  ts.isEnumMember,
  ts.isJsxAttribute,
]

/** O identificador é o nome de um membro (`x.nome`, `{ nome: 1 }`, `nome() {}`), e não um nome do escopo. */
export function ehNomeDeMembro(no: ts.Identifier): boolean {
  const pai = no.parent
  if (ts.isQualifiedName(pai)) return pai.right === no
  return DONOS_DE_NOME_DE_MEMBRO.some((ehDono) => ehDono(pai)) && (pai as unknown as { name?: ts.Node }).name === no
}

/** O nome que o import ou o export de fora dá, `x` em `import { x as y }`: ele não entra no escopo do arquivo. */
export function ehNomeDeFora(no: ts.Identifier): boolean {
  const pai = no.parent
  return (ts.isImportSpecifier(pai) || ts.isExportSpecifier(pai)) && pai.propertyName === no
}
