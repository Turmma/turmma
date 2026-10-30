import ts from 'typescript'
import type { Arvore } from './arvore.ts'
import { analisar, aplicarTrocas, ehCodigo, linhaDe, PASTA_DO_PROTOTIPO } from './ast.ts'
import type { EntradaDoMapa } from './mapa.ts'

/**
 * Passo 5 do `aplicar`: o nome em comentário e em documento vivo. Troca sozinho só o que não tem outro sentido: o identificador
 * composto (`AdaptadorFalso`), o que está entre crases, o que está em `{@link}`, e o caminho. A palavra comum (`com`, `Banco`,
 * `Fila`) solta fica, e vai para a lista de troca à mão do relatório.
 */

export interface TrocaAMao {
  arquivo: string
  linha: number
  de: string
}

/** Documento que o passo 5 não toca: o histórico (decisões, ouro, specs fechadas) e o protótipo. */
const FORA_DO_PASSO_5 = ['docs/decisoes.md', 'docs/aia/ouro/', 'docs/aia/ouro-retido/', 'tasks/', `${PASTA_DO_PROTOTIPO}/`, 'tools/renomear/', '.claude/worktrees/']

export const foraDoPasso5 = (caminho: string): boolean => FORA_DO_PASSO_5.some((fora) => caminho === fora || (fora.endsWith('/') && caminho.startsWith(fora)))

export const ehDocumentoVivo = (caminho: string): boolean =>
  caminho.endsWith('.md') && !foraDoPasso5(caminho) && (caminho === 'CLAUDE.md' || caminho.startsWith('.claude/') || caminho.startsWith('docs/'))

const TOKEN = /[A-Za-z0-9_]+/g

export const escaparRegex = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** O caminho ou o nome do pacote como texto: sem letra, número, `.`, `@` ou `-` antes, e sem letra ou número depois. */
export const regexDeCaminho = (forma: string): RegExp => new RegExp(`(?<![\\w@.-])${escaparRegex(forma)}(?![\\w-])`, 'g')

/** O caminho sem a extensão, quando o último segmento tem uma. */
export function semExtensaoDoCaminho(caminho: string): string | undefined {
  const sem = caminho.replace(/\.[A-Za-z0-9]+$/, '')
  return sem === caminho ? undefined : sem
}

function trocarCaminhos(trecho: string, entradas: readonly EntradaDoMapa[]): string {
  let texto = trecho
  for (const entrada of entradas) {
    const pares: Array<[string, string]> = [[entrada.de, entrada.para]]
    const semDe = entrada.tipo === 'arquivo' ? semExtensaoDoCaminho(entrada.de) : undefined
    const semPara = entrada.tipo === 'arquivo' ? semExtensaoDoCaminho(entrada.para) : undefined
    if (semDe !== undefined && semPara !== undefined) pares.push([semDe, semPara])
    for (const [de, para] of pares) {
      if (texto.includes(de)) texto = texto.replace(regexDeCaminho(de), () => para)
    }
  }
  return texto
}

/** As faixas do texto em que a palavra comum também se troca: entre crases e dentro de `{@link …}`. */
function faixasProtegidas(texto: string): Array<[number, number]> {
  const faixas: Array<[number, number]> = []
  for (const achado of texto.matchAll(/`[^`\n]*`|\{@link(?:code|plain)?\s[^}]*\}/g)) faixas.push([achado.index, achado.index + achado[0].length])
  return faixas
}

export interface ResultadoDaTroca {
  texto: string
  /** A palavra comum que ficou, com a posição no texto de saída. */
  aMao: Array<{ de: string; indice: number }>
}

export function trocarTrecho(trecho: string, entradas: readonly EntradaDoMapa[], simbolos: ReadonlyMap<string, EntradaDoMapa>): ResultadoDaTroca {
  const texto = trocarCaminhos(
    trecho,
    entradas.filter((entrada) => entrada.tipo !== 'simbolo'),
  )
  const protegidas = faixasProtegidas(texto)
  const trocas: Array<{ inicio: number; comprimento: number; novo: string }> = []
  const aMao: ResultadoDaTroca['aMao'] = []
  for (const achado of texto.matchAll(TOKEN)) {
    const entrada = simbolos.get(achado[0])
    if (entrada === undefined) continue
    const dentro = protegidas.some(([inicio, fim]) => achado.index >= inicio && achado.index < fim)
    if (!entrada.comum || dentro) trocas.push({ inicio: achado.index, comprimento: achado[0].length, novo: entrada.para })
    else aMao.push({ de: entrada.de, indice: achado.index })
  }
  return { texto: aplicarTrocas(texto, trocas), aMao }
}

/** Os comentários de um arquivo de código, `[início, fim)`, sem repetir. */
export function comentariosDe(fonte: ts.SourceFile): Array<[number, number]> {
  const texto = fonte.getFullText()
  const vistos = new Map<number, number>()
  const juntar = (faixas: ts.CommentRange[] | undefined): void => {
    for (const faixa of faixas ?? []) vistos.set(faixa.pos, faixa.end)
  }
  const visitar = (no: ts.Node): void => {
    const filhos = no.getChildren(fonte)
    if (filhos.length === 0) {
      juntar(ts.getLeadingCommentRanges(texto, no.getFullStart()))
      juntar(ts.getTrailingCommentRanges(texto, no.getEnd()))
    }
    filhos.forEach(visitar)
  }
  visitar(fonte)
  return [...vistos].sort((a, b) => a[0] - b[0])
}

const linhaNoTexto = (texto: string, indice: number): number => texto.slice(0, indice).split('\n').length - 1

function trocarNosComentarios(caminho: string, texto: string, entradas: readonly EntradaDoMapa[], simbolos: ReadonlyMap<string, EntradaDoMapa>, aMao: TrocaAMao[]): string {
  const fonte = analisar(caminho, texto)
  const trocas: Array<{ inicio: number; comprimento: number; novo: string }> = []
  for (const [inicio, fim] of comentariosDe(fonte)) {
    const resultado = trocarTrecho(texto.slice(inicio, fim), entradas, simbolos)
    if (resultado.texto !== texto.slice(inicio, fim)) trocas.push({ inicio, comprimento: fim - inicio, novo: resultado.texto })
    for (const { de, indice } of resultado.aMao) aMao.push({ arquivo: caminho, linha: linhaDe(fonte, inicio) + linhaNoTexto(resultado.texto, indice), de })
  }
  return aplicarTrocas(texto, trocas)
}

function trocarNoDocumento(caminho: string, texto: string, entradas: readonly EntradaDoMapa[], simbolos: ReadonlyMap<string, EntradaDoMapa>, aMao: TrocaAMao[]): string {
  const resultado = trocarTrecho(texto, entradas, simbolos)
  for (const { de, indice } of resultado.aMao) aMao.push({ arquivo: caminho, linha: linhaNoTexto(resultado.texto, indice) + 1, de })
  return resultado.texto
}

export interface OpcoesDoPasso5 {
  /** Troca também nos documentos vivos. As ondas de linha não tocam documento. */
  documentos: boolean
}

/** Aplica o passo 5 na árvore e devolve a lista de troca à mão. */
export function aplicarPasso5(arvore: Arvore, entradas: readonly EntradaDoMapa[], opcoes: OpcoesDoPasso5): TrocaAMao[] {
  const simbolos = new Map(entradas.filter((entrada) => entrada.tipo === 'simbolo').map((entrada) => [entrada.de, entrada]))
  const aMao: TrocaAMao[] = []
  const nomes = [...entradas.map((entrada) => entrada.de), ...entradas.flatMap((entrada) => semExtensaoDoCaminho(entrada.de) ?? [])]
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (texto === undefined || foraDoPasso5(caminho) || !nomes.some((nome) => texto.includes(nome))) continue
    if (ehCodigo(caminho)) arvore.escrever(caminho, trocarNosComentarios(caminho, texto, entradas, simbolos, aMao))
    else if (opcoes.documentos && ehDocumentoVivo(caminho)) arvore.escrever(caminho, trocarNoDocumento(caminho, texto, entradas, simbolos, aMao))
  }
  return aMao
}
