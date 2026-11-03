import { ErrorCode } from '@educa/shared'
import { DomainException } from '../error/domain.exception.js'

/**
 * O texto de uma planilha, que o navegador leu do CSV ou da primeira aba do XLSX e mandou à API (F2, 4.0; Tech Spec, seção 1):
 * o separador (`;`, tab ou `,`), as aspas e o cabeçalho. Aqui só se separa em campos; o que cada campo quer dizer é do tipo.
 *
 * O campo entre aspas pode ter o separador dentro, mas não quebra de linha: o navegador entrega cada linha da planilha em uma
 * linha do texto.
 */

/** Os separadores aceitos, na ordem em que um vence o outro quando o cabeçalho tem mais de um. */
const SEPARADORES = [';', '\t', ','] as const
type Separador = (typeof SEPARADORES)[number]

const ASPAS = '"'

/** O texto sem acento, em minúsculas, sem espaço nas pontas e com os de dentro reduzidos a um: como se reconhece um cabeçalho ou um tipo. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Os campos da linha, separados por `separador` fora de aspas; `""` dentro de aspas é uma aspa. Aspa que não fecha leva o resto da linha. */
function camposDa(linha: string, separador: Separador): string[] {
  const campos: string[] = []
  let atual = ''
  let entreAspas = false
  for (let posicao = 0; posicao < linha.length; posicao += 1) {
    const caractere = linha[posicao]
    if (entreAspas) {
      if (caractere !== ASPAS) atual += caractere
      else if (linha[posicao + 1] === ASPAS) {
        atual += ASPAS
        posicao += 1
      } else entreAspas = false
    } else if (caractere === ASPAS && atual.trim() === '') {
      entreAspas = true
      atual = ''
    } else if (caractere === separador) {
      campos.push(atual)
      atual = ''
    } else atual += caractere
  }
  campos.push(atual)
  return campos
}

/** Uma linha de dados: o número dela no arquivo (o cabeçalho é a 1) e os campos por coluna, ou `null` se o número de campos não é o do cabeçalho. */
export interface SheetRow {
  readonly linha: number
  readonly campos: Readonly<Record<string, string>> | null
}

export interface TabelaLida {
  readonly linhas: readonly SheetRow[]
}

/** O separador e as colunas do cabeçalho, se a linha é o do modelo: as colunas esperadas, nem mais nem menos, em qualquer ordem (com o mesmo número de colunas, todas as esperadas presentes já exclui a repetida). */
function cabecalhoDe(linha: string, esperadas: readonly string[]): { readonly separador: Separador; readonly colunas: readonly string[] } | undefined {
  for (const separador of SEPARADORES) {
    const colunas = camposDa(linha, separador).map(normalizarTexto)
    if (colunas.length === esperadas.length && esperadas.every((coluna) => colunas.includes(coluna))) return { separador, colunas }
  }
  return undefined
}

/**
 * Lê o texto como tabela (o marcador de ordem de byte que o Excel põe na frente do CSV é espaço para o `trim` e sai com ele): a primeira linha com texto é o cabeçalho e precisa ter exatamente as colunas de `cabecalho`, em
 * qualquer ordem e em qualquer caixa, com ou sem acento. Linha em branco é ignorada, mas conta no número da linha. Cabeçalho que
 * não é o do modelo, texto sem linha de dados ou sem texto nenhum respondem `ENTRADA_INVALIDA`: a planilha errada não chega a ser
 * classificada. Linha com mais ou menos campos que o cabeçalho volta com `campos: null`, para o tipo apontar o erro nela.
 */
export function lerTabela(texto: string, cabecalho: readonly string[]): TabelaLida {
  const linhas = texto.split(/\r\n|\r|\n/)
  const primeira = linhas.findIndex((linha) => linha.trim() !== '')
  const lido = cabecalhoDe(linhas[primeira] ?? '', cabecalho.map(normalizarTexto))
  if (lido === undefined) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  const dados: SheetRow[] = []
  linhas.forEach((linha, posicao) => {
    if (posicao <= primeira || linha.trim() === '') return
    const campos = camposDa(linha, lido.separador)
    dados.push({ linha: posicao + 1, campos: campos.length === lido.colunas.length ? Object.fromEntries(lido.colunas.map((coluna, indice) => [coluna, campos[indice] ?? ''])) : null })
  })
  if (dados.length === 0) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  return { linhas: dados }
}
