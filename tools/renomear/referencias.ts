import { basename, extname } from 'node:path'
import ts from 'typescript'
import type { Arvore } from './arvore.ts'
import { analisar, ehCodigo, linhaDe } from './ast.ts'
import type { EntradaDoMapa, OcorrenciaClassificada } from './mapa.ts'
import { regexDeCaminho, semExtensaoDoCaminho } from './texto.ts'

/**
 * Passo 6 do `aplicar`: as referências por texto. O compilador e o serviço de linguagem não enxergam o nome que está numa
 * string, num template, numa regex, num JSON ou num YAML; esta varredura o lista, e a onda classifica cada achado como `fica`
 * (string de fora) ou `trava` (texto que ela troca à mão). Achado sem classificação deixa o relatório vermelho.
 */

export interface Referencia {
  arquivo: string
  linha: number
  /** O nome achado: o `de` da entrada, ou o prefixo que um `startsWith` ou `endsWith` confere. */
  de: string
  trecho: string
}

const PASTAS_VARRIDAS = new Set(['apps', 'packages', 'e2e', 'tools', 'infra', '.github'])
const SEM_VARREDURA = ['tools/renomear/', 'package-lock.json']
const TEXTO_SEM_CODIGO = /(\.(json|jsonc|ya?ml|toml|sh)|(^|[/.])Dockerfile)$/
/** Um `\b` de regex vira este marcador: ele separa palavras, e a regra da palavra comum o reconhece. */
const BORDA = '\u0001'
const MENOR_PREFIXO = 4

function varre(caminho: string): boolean {
  if (SEM_VARREDURA.some((fora) => caminho === fora || (fora.endsWith('/') && caminho.startsWith(fora)))) return false
  const partes = caminho.split('/')
  return partes.length === 1 || PASTAS_VARRIDAS.has(partes[0] ?? '')
}

/** `pasta-mãe/nome`, com e sem a extensão: a forma curta com que o passo 6 procura o arquivo e a pasta. */
function formasDoCaminho(entrada: EntradaDoMapa): string[] {
  if (entrada.tipo === 'pacote') return [entrada.de]
  const curta = entrada.de.split('/').slice(-2).join('/')
  const sem = entrada.tipo === 'arquivo' ? semExtensaoDoCaminho(curta) : undefined
  return sem === undefined ? [curta] : [curta, sem]
}

export interface Indice {
  simbolos: Map<string, EntradaDoMapa>
  caminhos: Array<{ de: string; forma: string; regex: RegExp }>
  prefixos: string[]
}

export function indiceDe(entradas: readonly EntradaDoMapa[]): Indice {
  const simbolos = new Map(entradas.filter((entrada) => entrada.tipo === 'simbolo').map((entrada) => [entrada.de, entrada]))
  const caminhos = entradas.filter((entrada) => entrada.tipo !== 'simbolo').flatMap((entrada) => formasDoCaminho(entrada).map((forma) => ({ de: entrada.de, forma, regex: regexDeCaminho(forma) })))
  return { simbolos, caminhos, prefixos: [...simbolos.keys()] }
}

/** O que, antes da palavra comum, a faz nome: `@`, o `\b` da regex e a `/` do caminho. E depois: `(`, o `\b` e a `/`. */
const ANTES_DA_PALAVRA: ReadonlySet<string> = new Set(['@', BORDA, '/'])
const DEPOIS_DA_PALAVRA: ReadonlySet<string> = new Set(['(', BORDA, '/'])

const ehEmailOuUrl = (texto: string): boolean => texto.includes('://') || /\S+@\S+\.\S+/.test(texto)

/**
 * A palavra comum só é referência quando o texto a usa como nome: o literal inteiro, seguida de `(`, precedida de `@` ou de
 * `\b`, ou como segmento de caminho ou de acesso a membro. Em prosa, URL e e-mail, não.
 */
function comumListada(texto: string, indice: number, palavra: string): boolean {
  if (ehEmailOuUrl(texto)) return false
  const antes = texto[indice - 1]
  const depois = texto[indice + palavra.length]
  if (texto === palavra || (antes !== undefined && ANTES_DA_PALAVRA.has(antes)) || (depois !== undefined && DEPOIS_DA_PALAVRA.has(depois))) return true
  return acessoAMembro(texto, indice, palavra)
}

/** `a.Banco` e `Banco.a`: o ponto separa dois nomes. O ponto final de uma frase não. */
function acessoAMembro(texto: string, indice: number, palavra: string): boolean {
  const membroAntes = texto[indice - 1] === '.' && /\w/.test(texto[indice - 2] ?? '')
  const membroDepois = texto[indice + palavra.length] === '.' && /\w/.test(texto[indice + palavra.length + 1] ?? '')
  return membroAntes || membroDepois
}

/** Os `de` que o texto cita. */
export function citacoesNoTexto(texto: string, indice: Indice): string[] {
  const achados = new Set<string>()
  for (const { de, forma, regex } of indice.caminhos) {
    regex.lastIndex = 0
    if (texto.includes(forma) && regex.test(texto)) achados.add(de)
  }
  for (const achado of texto.matchAll(/[A-Za-z0-9_]+/g)) {
    const entrada = indice.simbolos.get(achado[0])
    if (entrada !== undefined && (!entrada.comum || comumListada(texto, achado.index, achado[0]))) achados.add(entrada.de)
  }
  return [...achados]
}

/** O texto de uma regex ou de `String.raw` sem o escape, com o `\b` como marcador. */
const semEscape = (texto: string): string => texto.replace(/\\b/g, BORDA).replace(/\\([^A-Za-z0-9])/g, '$1')

interface Unidade {
  texto: string
  posicao: number
}

function unidadesDoCodigo(fonte: ts.SourceFile): Unidade[] {
  const unidades: Unidade[] = []
  const visitar = (no: ts.Node): void => {
    if (ts.isStringLiteral(no)) {
      unidades.push({ texto: no.text, posicao: no.getStart(fonte) })
    } else if (ts.isNoSubstitutionTemplateLiteral(no)) {
      // `String.raw` e os outros templates com etiqueta guardam o texto cru: com o escape, como numa regex.
      const texto = ts.isTaggedTemplateExpression(no.parent) ? semEscape(no.rawText ?? no.text) : no.text
      unidades.push({ texto, posicao: no.getStart(fonte) })
    } else if (ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) {
      unidades.push({ texto: no.text, posicao: no.getStart(fonte) })
    } else if (ts.isRegularExpressionLiteral(no)) {
      unidades.push({ texto: semEscape(no.text), posicao: no.getStart(fonte) })
    }
    ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return unidades
}

/** `x.startsWith('esquemaResposta')`: o literal é prefixo (ou sufixo) de um `de`, e quebra quando o `de` muda. */
function prefixosConferidos(fonte: ts.SourceFile, prefixos: readonly string[]): Array<{ de: string; posicao: number }> {
  const achados: Array<{ de: string; posicao: number }> = []
  const visitar = (no: ts.Node): void => {
    if (ts.isCallExpression(no) && ts.isPropertyAccessExpression(no.expression)) {
      const metodo = no.expression.name.text
      const literal = no.arguments[0]
      if ((metodo === 'startsWith' || metodo === 'endsWith') && literal !== undefined && ts.isStringLiteralLike(literal) && literal.text.length >= MENOR_PREFIXO) {
        const confere = (de: string) => (metodo === 'startsWith' ? de.startsWith(literal.text) : de.endsWith(literal.text))
        if (prefixos.some(confere)) achados.push({ de: literal.text, posicao: literal.getStart(fonte) })
      }
    }
    ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return achados
}

const aparar = (texto: string): string => texto.replace(/\s+/g, ' ').trim().slice(0, 100)

function referenciasDoCodigo(caminho: string, texto: string, indice: Indice): Referencia[] {
  const fonte = analisar(caminho, texto)
  const referencias: Referencia[] = []
  for (const { texto: unidade, posicao } of unidadesDoCodigo(fonte)) {
    for (const de of citacoesNoTexto(unidade, indice)) referencias.push({ arquivo: caminho, linha: linhaDe(fonte, posicao), de, trecho: aparar(unidade) })
  }
  for (const { de, posicao } of prefixosConferidos(fonte, indice.prefixos)) {
    referencias.push({ arquivo: caminho, linha: linhaDe(fonte, posicao), de, trecho: aparar(texto.slice(posicao, posicao + 60)) })
  }
  return referencias
}

function referenciasDoTexto(caminho: string, texto: string, indice: Indice): Referencia[] {
  return texto.split('\n').flatMap((linha, i) => citacoesNoTexto(linha, indice).map((de) => ({ arquivo: caminho, linha: i + 1, de, trecho: aparar(linha) })))
}

/** Filtro barato antes de ler o arquivo como código: o começo de algum nome, no texto sem escape de regex, ou um `startsWith`/`endsWith`. */
function podeCitar(texto: string, nomes: readonly string[]): boolean {
  const limpo = texto.replace(/\\(.)/g, '$1')
  return /\.(?:startsWith|endsWith)\(/.test(limpo) || nomes.some((nome) => limpo.includes(nome.slice(0, MENOR_PREFIXO)))
}

/** Todas as referências por texto às entradas, em `apps/`, `packages/`, `e2e/`, `tools/`, `infra/`, `.github/` e na raiz. */
export function acharReferencias(arvore: Arvore, entradas: readonly EntradaDoMapa[]): Referencia[] {
  const indice = indiceDe(entradas)
  const nomes = [...entradas.flatMap(formasDoCaminho), ...indice.prefixos]
  const referencias: Referencia[] = []
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (texto === undefined || !varre(caminho) || !podeCitar(texto, nomes)) continue
    if (ehCodigo(caminho)) referencias.push(...referenciasDoCodigo(caminho, texto, indice))
    else if (TEXTO_SEM_CODIGO.test(caminho) || extname(basename(caminho)) === '.Dockerfile') referencias.push(...referenciasDoTexto(caminho, texto, indice))
  }
  const vistas = new Set<string>()
  return referencias.filter((r) => {
    const chave = `${r.arquivo}:${String(r.linha)}:${r.de}`
    return !vistas.has(chave) && vistas.add(chave)
  })
}

/** A referência está classificada: há uma ocorrência do mapa para o arquivo (ou a pasta), o nome e, se ela diz, o trecho. */
export function estaClassificada(referencia: Referencia, ocorrencias: readonly OcorrenciaClassificada[]): OcorrenciaClassificada | undefined {
  return ocorrencias.find(
    (o) =>
      o.de === referencia.de &&
      (o.arquivo === referencia.arquivo || (o.arquivo.endsWith('/') && referencia.arquivo.startsWith(o.arquivo))) &&
      (o.trecho === undefined || referencia.trecho.includes(o.trecho)),
  )
}
