import type { FalhaDeMaterial } from '@educa/shared'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** O teto da coluna `trecho.texto` (check `trecho_texto_preenchido`): a página que passa dele é cortada aqui. */
export const MAXIMO_DE_CARACTERES_DO_TRECHO = 20_000
/** A assinatura de todo PDF. A especificação a aceita nos primeiros 1024 bytes, e há gerador que põe lixo antes dela. */
const ASSINATURA_DO_PDF = Buffer.from('%PDF-', 'latin1')
const ALCANCE_DA_ASSINATURA = 1024
/** Quantas páginas com texto um material precisa ter para se dizer que uma linha "se repete em todas". */
export const MINIMO_DE_PAGINAS_PARA_TIRAR_LINHA_REPETIDA = 3
/** Cabeçalho e rodapé corridos têm uma ou duas linhas; mais que isso já é conteúdo que por acaso se repete. */
const MAXIMO_DE_LINHAS_REPETIDAS_POR_BORDA = 2

/** O texto de uma página que tem texto. A página só de imagem não vira trecho. */
export interface PaginaExtraida {
  /** Página do PDF, a partir de 1. */
  readonly pagina: number
  readonly texto: string
}

export type ResultadoDaExtracao =
  /** `paginas` é o total do PDF; `trechos`, só as que têm texto, em ordem. */
  | { readonly falha: null; readonly paginas: number; readonly trechos: readonly PaginaExtraida[] }
  | { readonly falha: FalhaDeMaterial }

/** O arquivo começa como PDF? É a conferência do conteúdo, e não do nome nem do tipo que o navegador declarou. */
export function temAssinaturaDePdf(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, ALCANCE_DA_ASSINATURA)).includes(ASSINATURA_DO_PDF)
}

/** A linha sem os números: "Capítulo 7 · p. 3" e "Capítulo 7 · p. 4" são a mesma linha, mudando só o número. */
const semNumeros = (linha: string): string => linha.replace(/\d+/g, '#')

/**
 * Tira o cabeçalho e o rodapé corridos: a primeira ou a última linha que **se repete em todas as páginas com texto,
 * mudando só o número** ("Química 2 · Capítulo 7 · … · p. 3").
 *
 * Por que tirar: a linha não é conteúdo da página. Na busca, ela faz toda página casar com o nome do capítulo, e empata
 * a página que trata do assunto com as que só o levam no rodapé; no Assistente e no Tutor, entra colada na última frase
 * da página. O número da página não se perde: é a coluna `trecho.pagina`, que é o que a citação mostra.
 *
 * Por que só assim: a regra precisa ser cega ao conteúdo. Só sai a linha da borda, igual em **todas** as páginas com
 * texto, e só em material com três páginas ou mais (com duas, "se repete" não quer dizer nada). Uma capa sem rodapé
 * basta para nada ser tirado: errar para o lado de manter é manter o trecho fiel à página.
 */
export function tirarLinhasRepetidas(paginas: readonly (readonly string[])[]): string[][] {
  let restantes = paginas.map((linhas) => [...linhas])
  for (const borda of ['fim', 'comeco'] as const) {
    for (let vez = 0; vez < MAXIMO_DE_LINHAS_REPETIDAS_POR_BORDA; vez += 1) {
      const comTexto = restantes.filter((linhas) => linhas.length > 0)
      if (comTexto.length < MINIMO_DE_PAGINAS_PARA_TIRAR_LINHA_REPETIDA) break
      const daBorda = comTexto.map((linhas) => semNumeros((borda === 'fim' ? linhas.at(-1) : linhas[0]) ?? ''))
      if (!daBorda.every((linha) => linha === daBorda[0])) break
      restantes = restantes.map((linhas) => (borda === 'fim' ? linhas.slice(0, -1) : linhas.slice(1)))
    }
  }
  return restantes
}

/** Caractere de controle que o Postgres não guarda em `text` (o NUL) ou que não é texto: vira espaço. */
// eslint-disable-next-line no-control-regex -- é justamente o caractere de controle que se quer tirar.
const CONTROLE = /[\u0000-\u0008\u000B-\u001F\u007F]/g

/** Cada linha com um espaço só entre as palavras, e nenhuma linha vazia. */
function linhasLimpas(linhas: readonly string[]): string[] {
  return linhas.map((linha) => linha.replace(CONTROLE, ' ').replace(/\s+/g, ' ').trim()).filter((linha) => linha !== '')
}

/** Erros do pdfjs que dizem "isto não é um PDF que se abre": arquivo corrompido, truncado ou com senha. */
const ERROS_DE_ARQUIVO = new Set(['InvalidPDFException', 'PasswordException', 'FormatError', 'MissingPDFException', 'XRefParseException'])

function falhaDoErro(erro: unknown): FalhaDeMaterial {
  return erro instanceof Error && ERROS_DE_ARQUIVO.has(erro.name) ? 'arquivo_invalido' : 'extracao_falhou'
}

const proximaVolta = (): Promise<void> => new Promise((resolver) => setImmediate(resolver))

/**
 * Lê o texto de um PDF, página por página, com `pdfjs-dist` em Node (`docs/mvp-rapido.md`, seção 4, item 3). Só o
 * texto: nada é desenhado, o arquivo não é gravado em lugar nenhum, e não há OCR — PDF só de imagem sai `sem_texto`.
 *
 * A receita é a de `tools/demonstracao/extrair-texto.ts`, que prova que o material de demonstração volta inteiro:
 * - build `legacy` (a padrão é para navegador);
 * - `data` como `Uint8Array` **copiado**: o pdfjs recusa `Buffer` e esvazia o array que recebe;
 * - sem fonte do sistema e sem `@font-face`, e `verbosity: 0`;
 * - uma linha é o que vem até o item com `hasEOL`; as linhas da página se juntam com `\n`;
 * - `destroy()` no fim, sempre.
 *
 * **Nunca lança**: toda falha sai como código da lista fechada (`FALHAS_DE_MATERIAL`). A mensagem da biblioteca, que
 * pode trazer pedaço do arquivo, não sai daqui (regra 20, itens 9 e 11).
 *
 * O `sinal` é o prazo: abortado, a leitura para na página seguinte e sai `extracao_falhou`. Entre uma página e outra
 * a leitura devolve o laço de eventos, para a API continuar atendendo enquanto um capítulo longo é lido.
 */
export class ExtratorDePdf {
  async extrair(bytes: Uint8Array, sinal?: AbortSignal): Promise<ResultadoDaExtracao> {
    // Lido por função: o prazo pode vencer no meio da leitura, entre uma conferência e outra.
    const abortado = (): boolean => sinal?.aborted === true
    if (abortado()) return { falha: 'extracao_falhou' }
    if (!temAssinaturaDePdf(bytes)) return { falha: 'arquivo_invalido' }
    const tarefa = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, verbosity: 0 })
    const aoAbortar = (): void => void tarefa.destroy().catch(() => undefined)
    sinal?.addEventListener('abort', aoAbortar, { once: true })
    try {
      const pdf = await tarefa.promise
      const linhasPorPagina: string[][] = []
      for (let numero = 1; numero <= pdf.numPages; numero += 1) {
        if (abortado()) return { falha: 'extracao_falhou' }
        const conteudo = await (await pdf.getPage(numero)).getTextContent()
        const linhas: string[] = []
        let linha = ''
        for (const item of conteudo.items) {
          // O outro tipo de item é o marcador de conteúdo marcado, que não tem texto.
          if (!('str' in item)) continue
          linha += item.str
          if (item.hasEOL) {
            linhas.push(linha)
            linha = ''
          }
        }
        linhas.push(linha)
        linhasPorPagina.push(linhasLimpas(linhas))
        await proximaVolta()
      }
      if (linhasPorPagina.length === 0) return { falha: 'arquivo_invalido' }
      const trechos = tirarLinhasRepetidas(linhasPorPagina)
        .map((linhas, indice) => ({ pagina: indice + 1, texto: linhas.join('\n').slice(0, MAXIMO_DE_CARACTERES_DO_TRECHO).trimEnd() }))
        .filter((pagina) => pagina.texto !== '')
      if (trechos.length === 0) return { falha: 'sem_texto' }
      return { falha: null, paginas: linhasPorPagina.length, trechos }
    } catch (erro) {
      return { falha: abortado() ? 'extracao_falhou' : falhaDoErro(erro) }
    } finally {
      sinal?.removeEventListener('abort', aoAbortar)
      await tarefa.destroy().catch(() => undefined)
    }
  }
}
