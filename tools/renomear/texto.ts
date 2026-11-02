import ts from 'typescript'
import type { Arvore } from './arvore.ts'
import { analisar, aplicarTrocas, ehCodigo, linhaDe, PASTA_DO_PROTOTIPO } from './ast.ts'
import type { EntradaDoMapa } from './mapa.ts'

/**
 * Passo 5 do `aplicar`: o nome em comentário e em documento vivo. Troca sozinho só o que não tem outro sentido: o identificador
 * composto (`AdaptadorFalso`), o que está entre crases, o que está em `{@link}`, e o caminho. A palavra comum (`com`, `Banco`,
 * `Fila`) solta fica, e vai para a lista de troca à mão do relatório. O `de` de símbolo com mais de uma entrada (os homônimos de
 * pacotes diferentes) não tem um `para` só: não se troca em lugar nenhum, e cada ocorrência vai para a troca à mão (Tech Spec §5).
 */

export interface TrocaAMao {
  arquivo: string
  linha: number
  de: string
}

/** Documento que o passo 5 não toca: o histórico (decisões, ouro, specs fechadas) e o protótipo. */
const FORA_DO_PASSO_5 = ['docs/decisoes.md', 'docs/aia/ouro/', 'docs/aia/ouro-retido/', 'tasks/', `${PASTA_DO_PROTOTIPO}/`, 'tools/renomear/', '.claude/worktrees/']

export const foraDoPasso5 = (caminho: string): boolean => FORA_DO_PASSO_5.some((fora) => caminho === fora || (fora.endsWith('/') && caminho.startsWith(fora)))

/** O README de qualquer pasta (o da raiz, o de `packages/` e o de `apps/web/`) é documento vivo como o de `docs/`: o prototipo e o ouro continuam de fora. */
export const ehDocumentoVivo = (caminho: string): boolean =>
  caminho.endsWith('.md') && !foraDoPasso5(caminho) && (caminho === 'CLAUDE.md' || caminho.startsWith('.claude/') || caminho.startsWith('docs/') || caminho.split('/').at(-1) === 'README.md')

const TOKEN = /[A-Za-z0-9_]+/g

export const escaparRegex = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** O caminho ou o nome do pacote como texto: sem letra, número, `.`, `@` ou `-` antes, e sem letra ou número depois. */
export const regexDeCaminho = (forma: string, semOutraExtensao = false): RegExp =>
  new RegExp(`(?<![\\w@.-])${escaparRegex(forma)}(?![\\w-]${semOutraExtensao ? '|\\.\\w' : ''})`, 'g')

/** O caminho sem a extensão, quando o último segmento tem uma. */
export function semExtensaoDoCaminho(caminho: string): string | undefined {
  const sem = caminho.replace(/\.[A-Za-z0-9]+$/, '')
  return sem === caminho ? undefined : sem
}

function trocarCaminhos(trecho: string, entradas: readonly EntradaDoMapa[]): string {
  let texto = trecho
  for (const entrada of entradas) {
    const pares: Array<[string, string, boolean]> = [[entrada.de, entrada.para, false]]
    const semDe = entrada.tipo === 'arquivo' ? semExtensaoDoCaminho(entrada.de) : undefined
    const semPara = entrada.tipo === 'arquivo' ? semExtensaoDoCaminho(entrada.para) : undefined
    // A forma sem extensão não leva o nome de outro arquivo (`estilos.test.ts` não é `estilos.css`).
    if (semDe !== undefined && semPara !== undefined) pares.push([semDe, semPara, true])
    for (const [de, para, semExtensao] of pares) {
      if (texto.includes(de)) texto = texto.replace(regexDeCaminho(de, semExtensao), () => para)
    }
  }
  return texto
}

const EXTENSAO_DE_ARQUIVO = /^\.(?:tsx?|jsx?|mjs|cjs|json|md|ya?ml|sh|sql|css|html)(?![\w(])/

/**
 * A palavra comum que é parte de outro nome: o pedaço de um nome de arquivo com hífen (`portao-local.ts`), o nome de arquivo com
 * extensão (`portao.ts`) e o fim de um domínio (`example.com`). Entre crases, essa palavra não é o símbolo. O membro de chamada
 * (`Modulo.com()`) continua sendo o símbolo.
 */
function ehPedacoDeOutroNome(texto: string, indice: number, comprimento: number): boolean {
  const antes = texto[indice - 1]
  const depois = texto[indice + comprimento]
  if (antes === '-' || depois === '-') return true
  if (antes === '.' && depois !== '(' && /\w/.test(texto[indice - 2] ?? '')) return true
  return EXTENSAO_DE_ARQUIVO.test(texto.slice(indice + comprimento))
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

/**
 * @param repetidos Os `de` de símbolo com mais de uma entrada (os homônimos de pacotes diferentes): não têm um `para` só, então não
 *   se trocam em lugar nenhum, nem entre crases nem em `{@link}`, e cada ocorrência vai para a troca à mão. O `restos` não os passa:
 *   ele ainda cobra o nome antigo, e a troca à mão registrada no relatório o libera.
 */
export function trocarTrecho(
  trecho: string,
  entradas: readonly EntradaDoMapa[],
  simbolos: ReadonlyMap<string, EntradaDoMapa>,
  repetidos: ReadonlySet<string> = new Set(),
): ResultadoDaTroca {
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
    if (repetidos.has(entrada.de)) {
      aMao.push({ de: entrada.de, indice: achado.index })
      continue
    }
    const dentro = protegidas.some(([inicio, fim]) => achado.index >= inicio && achado.index < fim)
    if (entrada.comum && dentro && ehPedacoDeOutroNome(texto, achado.index, achado[0].length)) continue
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

/** Diz se a ocorrência de `de` no `trecho` do `arquivo` é uma das que a onda classificou `fica`: o nome que a onda decidiu manter. */
export type FicaEm = (arquivo: string, de: string, trecho: string) => boolean

/** O trecho como o `restos` o compara com o `trecho` do mapa: os espaços juntos, e o começo. */
export const aparar = (texto: string): string => texto.replace(/\s+/g, ' ').trim().slice(0, 100)

/** As entradas do passo 5 que valem para esta unidade (o comentário ou a linha): tira as que o mapa classifica `fica` nela. */
function semOsQueFicam(
  ficaEm: FicaEm | undefined,
  caminho: string,
  unidade: string,
  entradas: readonly EntradaDoMapa[],
  simbolos: ReadonlyMap<string, EntradaDoMapa>,
): { entradas: readonly EntradaDoMapa[]; simbolos: ReadonlyMap<string, EntradaDoMapa> } {
  if (ficaEm === undefined) return { entradas, simbolos }
  const trecho = aparar(unidade)
  const ficam = new Set(entradas.filter((entrada) => unidade.includes(entrada.de) && ficaEm(caminho, entrada.de, trecho)).map((entrada) => entrada.de))
  if (ficam.size === 0) return { entradas, simbolos }
  return { entradas: entradas.filter((entrada) => !ficam.has(entrada.de)), simbolos: new Map([...simbolos].filter(([de]) => !ficam.has(de))) }
}

function trocarNosComentarios(
  caminho: string,
  texto: string,
  entradas: readonly EntradaDoMapa[],
  simbolos: ReadonlyMap<string, EntradaDoMapa>,
  repetidos: ReadonlySet<string>,
  aMao: TrocaAMao[],
  ficaEm: FicaEm | undefined,
): string {
  const fonte = analisar(caminho, texto)
  const trocas: Array<{ inicio: number; comprimento: number; novo: string }> = []
  for (const [inicio, fim] of comentariosDe(fonte)) {
    const vale = semOsQueFicam(ficaEm, caminho, texto.slice(inicio, fim), entradas, simbolos)
    const resultado = trocarTrecho(texto.slice(inicio, fim), vale.entradas, vale.simbolos, repetidos)
    if (resultado.texto !== texto.slice(inicio, fim)) trocas.push({ inicio, comprimento: fim - inicio, novo: resultado.texto })
    for (const { de, indice } of resultado.aMao) aMao.push({ arquivo: caminho, linha: linhaDe(fonte, inicio) + linhaNoTexto(resultado.texto, indice), de })
  }
  return aplicarTrocas(texto, trocas)
}

function trocarNoDocumento(
  caminho: string,
  texto: string,
  entradas: readonly EntradaDoMapa[],
  simbolos: ReadonlyMap<string, EntradaDoMapa>,
  repetidos: ReadonlySet<string>,
  aMao: TrocaAMao[],
  ficaEm: FicaEm | undefined,
): string {
  if (ficaEm === undefined) {
    const resultado = trocarTrecho(texto, entradas, simbolos, repetidos)
    for (const { de, indice } of resultado.aMao) aMao.push({ arquivo: caminho, linha: linhaNoTexto(resultado.texto, indice) + 1, de })
    return resultado.texto
  }
  // O `fica` do documento é por linha (o `trecho` é um pedaço dela), e a troca de uma linha não muda a contagem das outras.
  return texto
    .split('\n')
    .map((linha, indice) => {
      const vale = semOsQueFicam(ficaEm, caminho, linha, entradas, simbolos)
      const resultado = trocarTrecho(linha, vale.entradas, vale.simbolos, repetidos)
      for (const { de } of resultado.aMao) aMao.push({ arquivo: caminho, linha: indice + 1, de })
      return resultado.texto
    })
    .join('\n')
}

export interface OpcoesDoPasso5 {
  /** Troca também nos documentos vivos. As ondas de linha não tocam documento. */
  documentos: boolean
  /** O `reaplicar` não troca o que a onda classificou `fica`: o nome que ela decidiu manter não é nome antigo. O `aplicar` não passa isto. */
  ficaEm?: FicaEm
}

/** Aplica o passo 5 na árvore e devolve a lista de troca à mão. */
export function aplicarPasso5(arvore: Arvore, entradas: readonly EntradaDoMapa[], opcoes: OpcoesDoPasso5): TrocaAMao[] {
  const doSimbolo = entradas.filter((entrada) => entrada.tipo === 'simbolo')
  const simbolos = new Map(doSimbolo.map((entrada) => [entrada.de, entrada]))
  const repetidos = new Set(doSimbolo.filter((entrada) => doSimbolo.filter((outra) => outra.de === entrada.de).length > 1).map((entrada) => entrada.de))
  const aMao: TrocaAMao[] = []
  const nomes = [...entradas.map((entrada) => entrada.de), ...entradas.flatMap((entrada) => semExtensaoDoCaminho(entrada.de) ?? [])]
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (texto === undefined || foraDoPasso5(caminho) || !nomes.some((nome) => texto.includes(nome))) continue
    if (ehCodigo(caminho)) arvore.escrever(caminho, trocarNosComentarios(caminho, texto, entradas, simbolos, repetidos, aMao, opcoes.ficaEm))
    else if (opcoes.documentos && ehDocumentoVivo(caminho)) arvore.escrever(caminho, trocarNoDocumento(caminho, texto, entradas, simbolos, repetidos, aMao, opcoes.ficaEm))
  }
  return aMao
}
