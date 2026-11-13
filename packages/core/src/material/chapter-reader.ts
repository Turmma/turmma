import { TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO } from '@educa/shared'
import { limparLinha } from './limpar-linha.js'

/** O maior `int` do Postgres: o número de capítulo que passa dele não cabe na coluna e fica nulo. */
const MAIOR_INTEIRO = 2_147_483_647n
/** Quantas linhas do começo da página contam como "o topo": o cabeçalho corrido pode ocupar a primeira, e a linha do capítulo vem logo abaixo. */
export const LINHAS_DO_TOPO_DA_PAGINA = 2
/** A página com tantas linhas assim, **em qualquer lugar dela**, é um sumário: lista os capítulos em vez de começar um. */
export const CASAMENTOS_QUE_FAZEM_UM_SUMARIO = 3
/** Mais capítulos que isso não é a divisão de um livro, é um marcador por página: vale zero capítulos, e a coluna `ordem` (`smallint`) fica longe do teto. */
export const MAXIMO_DE_CAPITULOS_POR_MATERIAL = 2_000

/** O que `#doMarcador` devolve quando o PDF tem marcadores demais para ser a divisão de um livro. */
const ACIMA_DO_TETO = Symbol('acima do teto')

/** "Capítulo 7", "Unidade 2", "Módulo 3": a palavra e o número, no começo da linha ou do título do marcador. */
const LINHA_DE_CAPITULO = /^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)/i

/** O que o leitor pede do PDF aberto: o `PDFDocumentProxy` do `pdfjs` atende, e o teste entrega um falso para as bordas. */
export interface DocumentoComMarcadores {
  getOutline(): Promise<readonly { readonly title: string; readonly dest?: unknown }[] | null>
  getDestination(nome: string): Promise<readonly unknown[] | null>
  getPageIndex(referencia: never): Promise<number>
}

/** Um capítulo lido: `ordem` e as páginas de 1 em diante, o número que o PDF escreve (nulo se não há ou não cabe em `int`) e o título. */
export interface CapituloLido {
  readonly ordem: number
  readonly numero: number | null
  readonly titulo: string
  readonly paginaInicial: number
  readonly paginaFinal: number
}

/** Onde um capítulo começa, antes de a faixa de páginas ser calculada. */
interface InicioDeCapitulo {
  readonly pagina: number
  readonly titulo: string
}

function numeroDaLinha(linha: string): bigint | undefined {
  const digitos = LINHA_DE_CAPITULO.exec(linha)?.[2]
  return digitos === undefined ? undefined : BigInt(digitos)
}

function numeroDoBanco(numero: bigint | undefined): number | null {
  return numero === undefined || numero > MAIOR_INTEIRO ? null : Number(numero)
}

/**
 * Lê os capítulos de um PDF já aberto (ingestao-do-material, 4.0; Tech Spec, seção 5, "Capítulos"; PRD, RF4). **Nunca lança**: qualquer erro, do `pdfjs` ou
 * de um destino que não resolve, dá zero capítulos, e o material termina `pronto` do mesmo jeito. Capítulo é metadado do que a extração já leu; não vale uma falha.
 *
 * Duas fontes, nesta ordem:
 * 1. **O marcador de primeiro nível** (`getOutline()`), com o destino direto ou nomeado resolvido até a página. O de segundo nível não é capítulo. Dois marcadores
 *    na mesma página: fica o primeiro, na ordem do PDF. Marcadores fora de ordem saem ordenados pela página.
 * 2. **Sem marcador que resolva, a linha de capítulo no topo da página**, quando o número **muda** em relação ao do último capítulo: o cabeçalho corrido
 *    ("Capítulo 3" em toda página do capítulo 3) cria um capítulo só, e não um por página. A página que tem três linhas assim, em qualquer lugar, é um
 *    sumário e não começa capítulo.
 *
 * O capítulo vai da página em que começa até a anterior ao começo do seguinte, e o último, até o fim do PDF. A página antes do primeiro capítulo não é de capítulo
 * nenhum. As linhas de `linhasPorPagina` são as **de antes** de `tirarLinhasRepetidas`: o cabeçalho corrido já saiu das de depois, e é nele que o número muda.
 */
export class ChapterReader {
  async ler(documento: DocumentoComMarcadores, linhasPorPagina: readonly (readonly string[])[]): Promise<CapituloLido[]> {
    try {
      const total = linhasPorPagina.length
      const doMarcador = await this.#doMarcador(documento, total)
      if (doMarcador === ACIMA_DO_TETO) return []
      const inicios = doMarcador.length > 0 ? doMarcador : this.#daLinha(linhasPorPagina)
      if (inicios.length > MAXIMO_DE_CAPITULOS_POR_MATERIAL) return []
      return inicios.map((inicio, indice) => this.#capitulo(inicio, indice + 1, (inicios[indice + 1]?.pagina ?? total + 1) - 1))
    } catch {
      return []
    }
  }

  #capitulo(inicio: InicioDeCapitulo, ordem: number, paginaFinal: number): CapituloLido {
    const titulo = limparLinha(inicio.titulo).slice(0, TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO).trimEnd()
    return {
      ordem,
      numero: numeroDoBanco(numeroDaLinha(titulo)),
      titulo: titulo === '' ? `Capítulo ${String(ordem)}` : titulo,
      paginaInicial: inicio.pagina,
      paginaFinal,
    }
  }

  /** Para de resolver destinos assim que as páginas distintas passam do teto: o resultado já é zero capítulos, e a extração não segura a vaga da escola por um marcador por página. */
  async #doMarcador(documento: DocumentoComMarcadores, total: number): Promise<InicioDeCapitulo[] | typeof ACIMA_DO_TETO> {
    const arvore = await documento.getOutline()
    if (arvore === null) return []
    const achados: InicioDeCapitulo[] = []
    const paginasDistintas = new Set<number>()
    for (const marcador of arvore) {
      const pagina = await this.#paginaDoDestino(documento, marcador.dest)
      if (pagina === undefined || pagina < 1 || pagina > total) continue
      achados.push({ pagina, titulo: marcador.title })
      paginasDistintas.add(pagina)
      if (paginasDistintas.size > MAXIMO_DE_CAPITULOS_POR_MATERIAL) return ACIMA_DO_TETO
    }
    // A ordenação é estável: com dois marcadores na mesma página, o primeiro do PDF fica na frente e é o que sobra.
    achados.sort((a, b) => a.pagina - b.pagina)
    return achados.filter((achado, indice) => achado.pagina !== achados[indice - 1]?.pagina)
  }

  /** A página (de 1 em diante) para onde o destino aponta: direto, ou nomeado e resolvido pelo documento. Sem destino de página, `undefined`. */
  async #paginaDoDestino(documento: DocumentoComMarcadores, destino: unknown): Promise<number | undefined> {
    const resolvido = typeof destino === 'string' ? await documento.getDestination(destino) : destino
    if (!Array.isArray(resolvido)) return undefined
    const referencia: unknown = resolvido[0]
    if (typeof referencia !== 'object' || referencia === null) return undefined
    return (await documento.getPageIndex(referencia as never)) + 1
  }

  #daLinha(linhasPorPagina: readonly (readonly string[])[]): InicioDeCapitulo[] {
    const inicios: InicioDeCapitulo[] = []
    let ultimo: bigint | undefined
    linhasPorPagina.forEach((linhas, indice) => {
      if (linhas.filter((linha) => numeroDaLinha(linha) !== undefined).length >= CASAMENTOS_QUE_FAZEM_UM_SUMARIO) return
      const achada = linhas
        .slice(0, LINHAS_DO_TOPO_DA_PAGINA)
        .map((linha) => ({ linha, numero: numeroDaLinha(linha) }))
        .find(({ numero }) => numero !== undefined)
      if (achada?.numero === undefined || achada.numero === ultimo) return
      ultimo = achada.numero
      inicios.push({ pagina: indice + 1, titulo: achada.linha })
    })
    return inicios
  }
}
