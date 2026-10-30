import { dirname, join, posix } from 'node:path'
import ts from 'typescript'
import type { Arvore, Movimento } from './arvore.ts'
import { analisar, aplicarTrocas, ehCodigo } from './ast.ts'

/**
 * Os especificadores de módulo de um arquivo de código: o texto entre aspas de `import`, `export ... from`, `require()`,
 * `import()`, `typeof import()` e dos `vi.mock`/`jest.mock` e parentes. O TypeScript atualiza os imports quando um arquivo muda
 * de lugar, mas não o `vi.mock`; e quem traz o nome antigo pelo merge da `develop` (o `reaplicar`) não tem o arquivo antigo para
 * o serviço de linguagem resolver. Aqui a conta é de caminho, sem consultar o disco.
 */

export interface Especificador {
  /** Onde começa o texto, dentro das aspas. */
  inicio: number
  comprimento: number
  valor: string
  /** É o primeiro argumento de `vi.mock` e parentes. */
  ehMock: boolean
}

const FUNCOES_DE_MOCK = new Set(['mock', 'doMock', 'unmock', 'doUnmock', 'importActual', 'importMock', 'requireActual', 'requireMock'])
const EXTENSOES = /\.(?:d\.ts|tsx?|jsx?|mjs|cjs|mts|cts|json)$/

function chamaMock(chamada: ts.CallExpression): boolean {
  const alvo = chamada.expression
  return ts.isPropertyAccessExpression(alvo) && ts.isIdentifier(alvo.expression) && (alvo.expression.text === 'vi' || alvo.expression.text === 'jest') && FUNCOES_DE_MOCK.has(alvo.name.text)
}

function chamaImportacao(chamada: ts.CallExpression): boolean {
  const alvo = chamada.expression
  return alvo.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(alvo) && alvo.text === 'require')
}

const literalDeTexto = (no: ts.Node | undefined): ts.StringLiteralLike | undefined => (no !== undefined && ts.isStringLiteral(no) ? no : undefined)

function literalDaDeclaracao(no: ts.Node): ts.StringLiteralLike | undefined {
  if (ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) return literalDeTexto(no.moduleSpecifier)
  if (ts.isImportEqualsDeclaration(no) && ts.isExternalModuleReference(no.moduleReference)) return literalDeTexto(no.moduleReference.expression)
  return ts.isImportTypeNode(no) && ts.isLiteralTypeNode(no.argument) ? literalDeTexto(no.argument.literal) : undefined
}

function literalDoNo(no: ts.Node): { literal: ts.StringLiteralLike; ehMock: boolean } | undefined {
  const daDeclaracao = literalDaDeclaracao(no)
  if (daDeclaracao !== undefined) return { literal: daDeclaracao, ehMock: false }
  if (!ts.isCallExpression(no)) return undefined
  const primeiro = no.arguments[0]
  if (primeiro === undefined || !ts.isStringLiteralLike(primeiro)) return undefined
  if (chamaMock(no)) return { literal: primeiro, ehMock: true }
  return chamaImportacao(no) ? { literal: primeiro, ehMock: false } : undefined
}

export function especificadoresDe(caminho: string, texto: string): Especificador[] {
  const fonte = analisar(caminho, texto)
  const achados: Especificador[] = []
  const visitar = (no: ts.Node): void => {
    const achado = literalDoNo(no)
    if (achado !== undefined) {
      const inicio = achado.literal.getStart(fonte) + 1
      achados.push({ inicio, comprimento: achado.literal.getEnd() - inicio - 1, valor: texto.slice(inicio, achado.literal.getEnd() - 1), ehMock: achado.ehMock })
    }
    ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return achados
}

/** Troca o especificador do pacote (`de` ou `de/sub`) pelo nome novo, em todo arquivo de código. */
export function trocarEspecificadoresDoPacote(arvore: Arvore, de: string, para: string): void {
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (!ehCodigo(caminho) || texto === undefined || !texto.includes(de)) continue
    const trocas = especificadoresDe(caminho, texto)
      .filter(({ valor }) => valor === de || valor.startsWith(`${de}/`))
      .map(({ inicio, comprimento, valor }) => ({ inicio, comprimento, novo: para + valor.slice(de.length) }))
    if (trocas.length > 0) arvore.escrever(caminho, aplicarTrocas(texto, trocas))
  }
}

const semExtensao = (caminho: string): string => caminho.replace(EXTENSOES, '')

/** Para onde o movimento leva o caminho (sem extensão), ou ele mesmo se o movimento não o alcança. */
function destinoDoCaminho(alvo: string, movimento: Movimento): string {
  if (movimento.pasta) {
    if (alvo === movimento.de) return movimento.para
    return alvo.startsWith(`${movimento.de}/`) ? movimento.para + alvo.slice(movimento.de.length) : alvo
  }
  return alvo === semExtensao(movimento.de) ? semExtensao(movimento.para) : alvo
}

/** O caminho do arquivo depois do movimento. */
export function destinoDoArquivo(arquivo: string, movimento: Movimento): string {
  if (movimento.pasta) return arquivo.startsWith(`${movimento.de}/`) ? movimento.para + arquivo.slice(movimento.de.length) : arquivo
  return arquivo === movimento.de ? movimento.para : arquivo
}

function novoEspecificador(arquivo: string, valor: string, movimento: Movimento): string | undefined {
  if (!valor.startsWith('.')) return undefined
  const extensao = EXTENSOES.exec(valor)?.[0] ?? ''
  const base = valor.slice(0, valor.length - extensao.length)
  const alvoAntigo = posix.normalize(join(dirname(arquivo), base))
  const alvoNovo = destinoDoCaminho(alvoAntigo, movimento)
  const dirNovo = dirname(destinoDoArquivo(arquivo, movimento))
  let relativo = posix.relative(dirNovo, alvoNovo)
  if (relativo === '') relativo = '.'
  if (!relativo.startsWith('.')) relativo = `./${relativo}`
  return `${relativo}${extensao}` === valor ? undefined : `${relativo}${extensao}`
}

function arquivosAfetados(arvore: Arvore, movimento: Movimento, soMock: boolean): string[] {
  const nome = posix.basename(semExtensao(movimento.de))
  return arvore.caminhos().filter((caminho) => {
    const texto = arvore.lerOuNada(caminho)
    if (!ehCodigo(caminho) || texto === undefined || (soMock && !/\b(?:vi|jest)\./.test(texto))) return false
    return texto.includes(nome) || destinoDoArquivo(caminho, movimento) !== caminho
  })
}

/**
 * Reescreve os especificadores relativos que o movimento muda: os que apontam para o que mudou de lugar, e os do que mudou de
 * lugar para o que não mudou. `soMock` deixa os `import` para o serviço de linguagem. Roda antes de a árvore mover o arquivo.
 */
export function reescreverRelativos(arvore: Arvore, movimento: Movimento, soMock: boolean): void {
  for (const caminho of arquivosAfetados(arvore, movimento, soMock)) {
    const texto = arvore.ler(caminho)
    const trocas = especificadoresDe(caminho, texto).flatMap((especificador) => {
      if (soMock && !especificador.ehMock) return []
      const novo = novoEspecificador(caminho, especificador.valor, movimento)
      return novo === undefined ? [] : [{ inicio: especificador.inicio, comprimento: especificador.comprimento, novo }]
    })
    if (trocas.length > 0) arvore.escrever(caminho, aplicarTrocas(texto, trocas))
  }
}
