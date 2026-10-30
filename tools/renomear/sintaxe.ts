import ts from 'typescript'
import type { Arvore } from './arvore.ts'
import { analisar, aplicarTrocas, ehCodigo, ehNomeDeMembro, PASTA_DO_PROTOTIPO } from './ast.ts'
import type { EntradaDoMapa } from './mapa.ts'

/**
 * O rename de símbolo do `reaplicar`, só pela sintaxe. O código que o merge da `develop` traz cita o nome antigo, e o nome
 * antigo já não está declarado em lugar nenhum: o serviço de linguagem não acha o que renomear. Aqui cada identificador com o
 * nome é um uso, menos os que são nomes de outra coisa (membro, declaração local, o apelido do import).
 *
 * **O limite declarado:** sem o verificador de tipos, o uso de uma variável local que sombreia o nome antigo (`(Banco) => Banco`)
 * também é trocado, e o `tsc` da correção acusa. O membro sem `arquivo` (o `com`) é só `X.com(` e `static com(`.
 */

/** Fixture, protótipo e documento não são código do produto: o `aplicar` também não os renomeia pelo serviço de linguagem. */
const FORA_DA_SINTAXE = new RegExp(`(^|/)(__fixtures__|fixtures|node_modules|${PASTA_DO_PROTOTIPO}|tasks|docs)/`)
const FORA_DA_FERRAMENTA = 'tools/renomear/'

function ehNomeDeDeclaracaoLocal(no: ts.Identifier): boolean {
  const pai = no.parent
  if (ts.isParameter(pai) || ts.isVariableDeclaration(pai) || ts.isBindingElement(pai)) return pai.name === no
  return (ts.isClassDeclaration(pai) || ts.isInterfaceDeclaration(pai) || ts.isTypeAliasDeclaration(pai) || ts.isEnumDeclaration(pai) || ts.isFunctionDeclaration(pai)) && pai.name === no
}

function textoDoMembro(no: ts.Identifier, entrada: EntradaDoMapa): string | undefined {
  const pai = no.parent
  return (ts.isPropertyAccessExpression(pai) || ts.isMethodDeclaration(pai)) && pai.name === no ? entrada.para : undefined
}

function textoDoImportOuExport(no: ts.Identifier, entrada: EntradaDoMapa): string | undefined {
  const pai = no.parent as ts.ImportSpecifier | ts.ExportSpecifier
  if (pai.propertyName === undefined) return entrada.para
  return pai.propertyName === no ? entrada.para : undefined
}

/** A forma curta (`{ Banco }`): o nome é também a chave, e a chave fica. */
function textoDaFormaCurta(no: ts.Identifier, entrada: EntradaDoMapa): string | undefined {
  const pai = no.parent
  const curta = ts.isShorthandPropertyAssignment(pai) || (ts.isBindingElement(pai) && pai.propertyName === undefined && ts.isObjectBindingPattern(pai.parent))
  return curta && pai.name === no ? `${entrada.de}: ${entrada.para}` : undefined
}

/** O que entra no lugar do identificador, ou `undefined` se ele é nome de outra coisa. */
export function textoDoUso(no: ts.Identifier, entrada: EntradaDoMapa): string | undefined {
  const pai = no.parent
  // Sem `arquivo`, o `de` é um membro (o `com` dos módulos dinâmicos): só `X.com(` e `static com(`.
  if (entrada.arquivo === undefined) return textoDoMembro(no, entrada)
  if (ehNomeDeMembro(no)) return undefined
  if (ts.isImportSpecifier(pai) || ts.isExportSpecifier(pai)) return textoDoImportOuExport(no, entrada)
  const curta = textoDaFormaCurta(no, entrada)
  if (curta !== undefined) return curta
  return ehNomeDeDeclaracaoLocal(no) ? undefined : entrada.para
}

function usosNoTexto(caminho: string, texto: string, entrada: EntradaDoMapa): Array<{ inicio: number; comprimento: number; novo: string }> {
  const fonte = analisar(caminho, texto)
  const trocas: Array<{ inicio: number; comprimento: number; novo: string }> = []
  const visitar = (no: ts.Node): void => {
    if (ts.isIdentifier(no) && no.text === entrada.de) {
      const novo = textoDoUso(no, entrada)
      if (novo !== undefined) trocas.push({ inicio: no.getStart(fonte), comprimento: no.getWidth(fonte), novo })
    }
    ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return trocas
}

/** Renomeia, na árvore, todo uso do nome antigo. Devolve quantos arquivos mudaram. */
export function renomearPelaSintaxe(arvore: Arvore, entrada: EntradaDoMapa): number {
  let mudaram = 0
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (!ehCodigo(caminho) || texto === undefined || caminho.startsWith(FORA_DA_FERRAMENTA) || FORA_DA_SINTAXE.test(caminho) || !texto.includes(entrada.de)) continue
    const trocas = usosNoTexto(caminho, texto, entrada)
    if (trocas.length === 0) continue
    arvore.escrever(caminho, aplicarTrocas(texto, trocas))
    mudaram += 1
  }
  return mudaram
}
