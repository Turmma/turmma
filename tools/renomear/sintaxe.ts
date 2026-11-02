import { posix } from 'node:path'
import ts from 'typescript'
import type { Arvore } from './arvore.ts'
import { analisar, aplicarTrocas, ehCodigo, ehNomeDeMembro, linhaDe, PASTA_DO_PROTOTIPO } from './ast.ts'
import { literalDoNo } from './especificadores.ts'
import { aparar, type FicaEm } from './texto.ts'
import { arquivoDepoisDasOndas, type EntradaDoMapa, type Mapa, pacoteDoArquivo } from './mapa.ts'
import { nomeDoPacote } from './pacotes.ts'
import { declaracoesDeTopo } from './simbolos.ts'

/**
 * O rename de símbolo do `reaplicar`, só pela sintaxe. O código que o merge da `develop` traz cita o nome antigo, e o nome
 * antigo já não está declarado em lugar nenhum: o serviço de linguagem não acha o que renomear. Aqui cada identificador com o
 * nome é um uso, menos os que são nomes de outra coisa (membro, declaração local, o apelido do import).
 *
 * **O limite declarado:** sem o verificador de tipos, o uso de uma variável local que sombreia o nome antigo (`(Banco) => Banco`)
 * também é trocado, e o `tsc` da correção acusa. O membro sem `arquivo` (o `com`) é só `X.com(` e `static com(`.
 *
 * **O `arquivo` da entrada filtra** (sem ele, o `portao` de `e2e/` trocava o `portao` de `tools/processo/`, e o `Aparencia` do componente
 * trocava o do tema). Entra no rename o `arquivo` da entrada (onde a onda o viu e onde as seguintes o deixaram) e o arquivo que importa o
 * nome de lá: o especificador relativo que resolve para esse arquivo, ou para um arquivo do pacote dele que não declara o nome antigo
 * (o barrel que o reexporta), ou o nome do pacote (o de hoje e os que as entradas `pacote` das ondas levaram a ele). O arquivo que
 * declara um homônimo, e quem o importa, ficam. **O limite declarado:** quem importa o nome de outro pacote que o reexporta não entra;
 * o `restos` e o `tsc` o acusam, e a troca é à mão.
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

function usosNoTexto(caminho: string, texto: string, entrada: EntradaDoMapa, ficaEm: FicaEm | undefined): Array<{ inicio: number; comprimento: number; novo: string }> {
  const fonte = analisar(caminho, texto)
  const trocas: Array<{ inicio: number; comprimento: number; novo: string }> = []
  const linhas = ficaEm === undefined ? [] : texto.split('\n')
  const visitar = (no: ts.Node): void => {
    if (ts.isIdentifier(no) && no.text === entrada.de) {
      const novo = textoDoUso(no, entrada)
      if (novo !== undefined && !(ficaEm?.(caminho, entrada.de, aparar(linhas[linhaDe(fonte, no.getStart(fonte)) - 1] ?? '')) ?? false)) trocas.push({ inicio: no.getStart(fonte), comprimento: no.getWidth(fonte), novo })
    }
    ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return trocas
}

/** Onde o nome antigo pode ser o símbolo da entrada: as pastas de pacote, os nomes de pacote e os arquivos declarantes. */
export interface Alcance {
  pastas: ReadonlySet<string>
  nomes: ReadonlySet<string>
  arquivos: ReadonlySet<string>
}

function nomeDoPackageJson(arvore: Arvore, pasta: string): string | undefined {
  try {
    const nome = (JSON.parse(arvore.lerOuNada(`${pasta}/package.json`) ?? '{}') as { name?: unknown }).name
    return typeof nome === 'string' ? nome : undefined
  } catch {
    return undefined // package.json que não é JSON: o pacote fica sem nome, e só o caminho relativo alcança.
  }
}

/** Os nomes que o pacote teve: o de hoje, e os `de` das entradas `pacote` das ondas que levam a ele (em cadeia). */
function nomesDoPacote(atuais: readonly string[], mapas: readonly Mapa[]): Set<string> {
  const nomes = new Set(atuais)
  const dePacote = mapas.flatMap((mapa) => mapa.entradas).filter((outra) => outra.tipo === 'pacote')
  for (let mudou = true; mudou; ) {
    const antes = nomes.size
    for (const outra of dePacote) if (nomes.has(nomeDoPacote(outra.para))) nomes.add(nomeDoPacote(outra.de))
    mudou = nomes.size > antes
  }
  return nomes
}

/**
 * O alcance de uma entrada com `arquivo`, no lugar em que a onda a viu e no lugar em que as ondas seguintes a deixaram.
 * Sem `mapas`, só o lugar do mapa (para quem chama uma entrada solta).
 */
export function alcanceDaEntrada(arvore: Arvore, entrada: EntradaDoMapa, mapas: readonly Mapa[] = [], indiceDaOnda = -1): Alcance | undefined {
  if (entrada.arquivo === undefined) return undefined
  const arquivos = new Set([entrada.arquivo, arquivoDepoisDasOndas(entrada.arquivo, mapas, indiceDaOnda)])
  const pastas = new Set([...arquivos].map(pacoteDoArquivo))
  const atuais = [...pastas].flatMap((pasta) => nomeDoPackageJson(arvore, pasta) ?? [])
  return { pastas, nomes: nomesDoPacote(atuais, mapas), arquivos }
}

const EXTENSAO_DO_MODULO = /\.(?:tsx?|jsx?|mjs|cjs|mts|cts)$/
const semExtensao = (caminho: string): string => caminho.replace(EXTENSAO_DO_MODULO, '')

/** Os arquivos que o especificador relativo pode ser: ele mesmo, com a extensão do TypeScript no lugar da de saída, ou a pasta com `index`. */
function arquivosDoEspecificador(arvore: Arvore, resolvido: string): string[] {
  const base = semExtensao(resolvido)
  return ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '/index.ts', '/index.tsx'].map((fim) => `${base}${fim}`).filter((caminho) => arvore.existe(caminho))
}

/** O especificador aponta para a declaração da entrada: o arquivo dela, o pacote dela, ou um arquivo do pacote que a reexporta (que não declara o nome antigo). */
function apontaParaAEntrada(arvore: Arvore, caminho: string, valor: string, entrada: EntradaDoMapa, alcance: Alcance): boolean {
  if (!valor.startsWith('.')) return alcance.nomes.has(nomeDoPacote(valor))
  const resolvido = posix.join(posix.dirname(caminho), valor)
  if ([...alcance.arquivos].some((arquivo) => semExtensao(arquivo) === semExtensao(resolvido))) return true
  if (!alcance.pastas.has(pacoteDoArquivo(resolvido))) return false
  return arquivosDoEspecificador(arvore, resolvido).some((alvo) => {
    const texto = arvore.lerOuNada(alvo)
    return texto !== undefined && declaracoesDeTopo(analisar(alvo, texto).statements, entrada.de, entrada.para).length === 0
  })
}

/** A declaração `import`/`export … from` traz o nome antigo? Namespace, padrão e `export *` podem trazê-lo. */
function trazONome(no: ts.Node, de: string): boolean {
  if (ts.isImportDeclaration(no)) {
    const clausula = no.importClause
    if (clausula === undefined) return false
    if (clausula.name !== undefined) return true
    const ligacoes = clausula.namedBindings
    if (ligacoes === undefined) return false
    return ts.isNamespaceImport(ligacoes) || ligacoes.elements.some((elemento) => (elemento.propertyName ?? elemento.name).text === de)
  }
  if (ts.isExportDeclaration(no)) {
    if (no.exportClause === undefined || ts.isNamespaceExport(no.exportClause)) return true
    return no.exportClause.elements.some((elemento) => (elemento.propertyName ?? elemento.name).text === de)
  }
  return true
}

function importaDoAlcance(arvore: Arvore, caminho: string, texto: string, entrada: EntradaDoMapa, alcance: Alcance): boolean {
  const fonte = analisar(caminho, texto)
  let achou = false
  const visitar = (no: ts.Node): void => {
    if (achou) return
    const modulo = literalDoNo(no)
    if (modulo !== undefined && trazONome(no, entrada.de) && apontaParaAEntrada(arvore, caminho, modulo.literal.text, entrada, alcance)) achou = true
    ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return achou
}

function estaNoAlcance(arvore: Arvore, caminho: string, texto: string, entrada: EntradaDoMapa, alcance: Alcance | undefined): boolean {
  return alcance === undefined || alcance.arquivos.has(caminho) || importaDoAlcance(arvore, caminho, texto, entrada, alcance)
}

/** Renomeia, na árvore, todo uso do nome antigo no alcance da entrada. Devolve quantos arquivos mudaram. */
export function renomearPelaSintaxe(arvore: Arvore, entrada: EntradaDoMapa, alcance: Alcance | undefined = alcanceDaEntrada(arvore, entrada), ficaEm?: FicaEm): number {
  let mudaram = 0
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (!ehCodigo(caminho) || texto === undefined || caminho.startsWith(FORA_DA_FERRAMENTA) || FORA_DA_SINTAXE.test(caminho) || !texto.includes(entrada.de)) continue
    if (!estaNoAlcance(arvore, caminho, texto, entrada, alcance)) continue
    const trocas = usosNoTexto(caminho, texto, entrada, ficaEm)
    if (trocas.length === 0) continue
    arvore.escrever(caminho, aplicarTrocas(texto, trocas))
    mudaram += 1
  }
  return mudaram
}
