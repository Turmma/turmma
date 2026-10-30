import { posix } from 'node:path'
import ts from 'typescript'
import { analisar, ehCodigo } from './ast.ts'
import { casosDe } from './casos.ts'
import { literalDoNo } from './especificadores.ts'

/**
 * A foto de um arquivo de código, para o `conferir` (Tech Spec da X8, §5): o que o rename de nome não pode mudar. São as strings,
 * as partes fixas de template, os literais de regex, os `JsxText`, as chaves de objeto literal, os nomes exportados, os
 * especificadores de módulo e os casos de teste. Identificador não entra: é ele que o rename muda.
 */

export type Categoria = 'string' | 'template' | 'regex' | 'jsx' | 'chave' | 'especificador' | 'exportado' | 'caso'

export interface ItemDaFoto {
  categoria: Categoria
  /** O arquivo onde o item está. */
  arquivo: string
  valor: string
  /** Só no nome que o arquivo repassa (`export { X } from '…'`, `export * as X from '…'` e o `export { X }` de um `import`): o especificador de onde ele vem, no formato de comparação. */
  origem?: string
}

/** O que o `conferir` fotografa: `apps/`, `packages/`, `e2e/`, `infra/test/`, `infra/scripts/` e `tools/`, menos a ferramenta. */
export const RAIZES_DA_FOTO: readonly string[] = ['apps/', 'packages/', 'e2e/', 'infra/test/', 'infra/scripts/', 'tools/']
const FORA_DA_FOTO = 'tools/renomear/'

export const naFoto = (caminho: string): boolean => ehCodigo(caminho) && !caminho.startsWith(FORA_DA_FOTO) && RAIZES_DA_FOTO.some((raiz) => caminho.startsWith(raiz))

const EXTENSAO_DE_CODIGO = /\.(?:d\.ts|tsx?|jsx?|mjs|cjs|mts|cts)$/

/**
 * O especificador no formato de comparação. O relativo vira o alvo a partir da raiz, sem a extensão, e a extensão fica ao lado
 * (`relativo|packages/x/a|.js`): o arquivo que muda de lugar muda o texto do import de quem o cita, e a comparação é pelo alvo.
 * O de pacote fica como está.
 */
function formaDoEspecificador(importador: string, valor: string): string {
  if (!valor.startsWith('.')) return `pacote|${valor}`
  const extensao = EXTENSAO_DE_CODIGO.exec(valor)?.[0] ?? ''
  const base = valor.slice(0, valor.length - extensao.length)
  return `relativo|${posix.normalize(posix.join(posix.dirname(importador), base))}|${extensao}`
}

const nomeDaChave = (nome: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(nome) || ts.isStringLiteralLike(nome) || ts.isNumericLiteral(nome)) return nome.text
  return undefined
}

/** O nome da chave de um objeto literal, e o literal quando a chave é texto (ele não conta como string). */
function chaveDe(no: ts.Node): { nome: string; literal?: ts.Node } | undefined {
  if (!(ts.isPropertyAssignment(no) || ts.isShorthandPropertyAssignment(no) || ts.isMethodDeclaration(no) || ts.isAccessor(no))) return undefined
  if (!ts.isObjectLiteralExpression(no.parent)) return undefined
  const nome = nomeDaChave(no.name)
  if (nome === undefined) return undefined
  return ts.isStringLiteralLike(no.name) ? { nome, literal: no.name } : { nome }
}

function nomesDoPadrao(nome: ts.BindingName): string[] {
  if (ts.isIdentifier(nome)) return [nome.text]
  return nome.elements.flatMap((elemento) => (ts.isOmittedExpression(elemento) ? [] : nomesDoPadrao(elemento.name)))
}

const temModificador = (declaracao: ts.Statement, tipo: ts.SyntaxKind): boolean => ts.canHaveModifiers(declaracao) && (ts.getModifiers(declaracao) ?? []).some((modificador) => modificador.kind === tipo)
const exportado = (declaracao: ts.Statement): boolean => temModificador(declaracao, ts.SyntaxKind.ExportKeyword)
const porPadrao = (declaracao: ts.Statement): boolean => temModificador(declaracao, ts.SyntaxKind.DefaultKeyword)

interface NomeExportado {
  nome: string
  /** O especificador de onde o nome vem, como está no texto: o do `export … from`, ou o do `import` do nome que o `export { X }` repassa. */
  origem?: string
}

/** O nome local de cada binding de `import` do arquivo → o especificador que o traz. */
function importadosDe(fonte: ts.SourceFile): Map<string, string> {
  const importados = new Map<string, string>()
  for (const declaracao of fonte.statements) {
    if (!ts.isImportDeclaration(declaracao) || !ts.isStringLiteralLike(declaracao.moduleSpecifier)) continue
    const clausula = declaracao.importClause
    if (clausula === undefined) continue
    const especificador = declaracao.moduleSpecifier.text
    if (clausula.name !== undefined) importados.set(clausula.name.text, especificador)
    const ligacoes = clausula.namedBindings
    if (ligacoes === undefined) continue
    if (ts.isNamespaceImport(ligacoes)) importados.set(ligacoes.name.text, especificador)
    else for (const elemento of ligacoes.elements) importados.set(elemento.name.text, especificador)
  }
  return importados
}

function nomesDaExportacao(declaracao: ts.ExportDeclaration, importados: ReadonlyMap<string, string>): NomeExportado[] {
  const clausula = declaracao.exportClause
  if (clausula === undefined) return []
  const origemDaDeclaracao = declaracao.moduleSpecifier !== undefined && ts.isStringLiteralLike(declaracao.moduleSpecifier) ? declaracao.moduleSpecifier.text : undefined
  if (ts.isNamespaceExport(clausula)) return [{ nome: clausula.name.text, ...(origemDaDeclaracao === undefined ? {} : { origem: origemDaDeclaracao }) }]
  return clausula.elements.map((elemento) => {
    // Sem `from`, o `export { X }` repassa o que o arquivo importou: a origem é o `import` do nome local.
    const origem = origemDaDeclaracao ?? importados.get((elemento.propertyName ?? elemento.name).text)
    return { nome: elemento.name.text, ...(origem === undefined ? {} : { origem }) }
  })
}

/** Os nomes que a declaração de topo exporta. */
function nomesExportados(declaracao: ts.Statement, importados: ReadonlyMap<string, string>): NomeExportado[] {
  if (ts.isExportDeclaration(declaracao)) return nomesDaExportacao(declaracao, importados)
  if (ts.isExportAssignment(declaracao)) return [{ nome: 'default' }]
  if (!exportado(declaracao)) return []
  if (porPadrao(declaracao)) return [{ nome: 'default' }]
  if (ts.isVariableStatement(declaracao)) return declaracao.declarationList.declarations.flatMap((variavel) => nomesDoPadrao(variavel.name).map((nome) => ({ nome })))
  const nome = (declaracao as { name?: ts.Node }).name
  return nome !== undefined && ts.isIdentifier(nome) ? [{ nome: nome.text }] : []
}

const aparar = (texto: string): string => texto.replace(/\s+/g, ' ').trim()

/** A string que a foto guarda: o literal que não é especificador, título nem chave. */
const ehTexto = (no: ts.Node, ignorados: ReadonlySet<ts.Node>): no is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && !ignorados.has(no)

const ehParteDeTemplate = (no: ts.Node, ignorados: ReadonlySet<ts.Node>): no is ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail =>
  (ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) && !ignorados.has(no)

/** O item de um nó que a foto guarda, ou `undefined`. Os nós que o `visitar` precisa ignorar (título, especificador, chave) já foram marcados. */
function itemDoNo(no: ts.Node, ignorados: ReadonlySet<ts.Node>): { categoria: Categoria; valor: string } | undefined {
  if (ehTexto(no, ignorados)) return { categoria: 'string', valor: no.text }
  if (ehParteDeTemplate(no, ignorados)) return no.text === '' ? undefined : { categoria: 'template', valor: no.text }
  if (ts.isRegularExpressionLiteral(no)) return { categoria: 'regex', valor: no.text }
  return ts.isJsxText(no) && aparar(no.text) !== '' ? { categoria: 'jsx', valor: aparar(no.text) } : undefined
}

/** A foto de um arquivo. */
export function fotografar(caminho: string, texto: string): ItemDaFoto[] {
  const fonte = analisar(caminho, texto)
  const itens: ItemDaFoto[] = []
  const guardar = (categoria: Categoria, valor: string, origem?: string): void =>
    void itens.push({ categoria, arquivo: caminho, valor, ...(origem === undefined ? {} : { origem: formaDoEspecificador(caminho, origem) }) })
  const ignorados = new Set<ts.Node>()
  for (const caso of casosDe(fonte)) {
    ignorados.add(caso.no)
    // O título em template: as partes fixas são do caso, e não da foto de templates.
    if (ts.isTemplateExpression(caso.no)) for (const parte of [caso.no.head, ...caso.no.templateSpans.map((trecho) => trecho.literal)]) ignorados.add(parte)
    guardar('caso', caso.caminho)
  }
  const visitar = (no: ts.Node): void => {
    const especificador = literalDoNo(no)
    if (especificador !== undefined) {
      ignorados.add(especificador.literal)
      guardar('especificador', formaDoEspecificador(caminho, especificador.literal.text))
    }
    const chave = chaveDe(no)
    if (chave !== undefined) {
      if (chave.literal !== undefined) ignorados.add(chave.literal)
      guardar('chave', chave.nome)
    }
    const item = itemDoNo(no, ignorados)
    if (item !== undefined) guardar(item.categoria, item.valor)
    ts.forEachChild(no, visitar)
  }
  // O pai marca o literal que não é string (especificador, chave) antes de o `forEachChild` chegar nele; o título já foi marcado acima.
  visitar(fonte)
  const importados = importadosDe(fonte)
  for (const declaracao of fonte.statements) for (const { nome, origem } of nomesExportados(declaracao, importados)) guardar('exportado', nome, origem)
  return itens
}
