import type { readSheet } from 'read-excel-file/browser'
import { lerArquivoDaLista, tetoPassado } from '../estrutura/ler-arquivo-da-lista'

/**
 * O arquivo da planilha que a coordenação escolhe, lido no navegador e entregue como **texto** (F2, 13.0; Tech Spec, seção 1 e
 * seção 9): CSV ou TXT (`ler-arquivo-da-lista.ts`) e a primeira aba do XLSX. O arquivo em si nunca chega à API, e o XLSX só é
 * carregado quando alguém escolhe um (`docs/interface.md` 10.4): a biblioteca fica fora do pedaço da entrada.
 *
 * Da primeira aba sai uma linha de texto por linha da planilha, com `;` entre as colunas: é o que a API já lê do CSV, e a
 * numeração das linhas que a prévia aponta é a do Excel (a linha 1 é o cabeçalho). Linha em branco no meio continua em branco, para
 * a contagem não andar; as em branco no fim saem.
 */

/** O maior XLSX que a tela abre. Uma planilha de 3.000 linhas tem uns 100 KB; acima disso é imagem ou macro, e o teto de texto vem depois. */
export const MAXIMO_DE_BYTES_DO_XLSX = 8 * 1024 * 1024

/**
 * Por que a planilha não virou texto. `grande` e `linhas` passam dos tetos da API (512 KB, 3.000 linhas); `ilegivel` é o arquivo que o
 * navegador não leu; `formato` é o que não é CSV, TXT nem XLSX legível (`.xls` antigo, `.ods`, arquivo corrompido); `leitor` é a
 * falha de carregar o leitor de XLSX (a rede caiu ao pedi-lo).
 */
export const MOTIVOS_DA_PLANILHA_RECUSADA = ['grande', 'linhas', 'ilegivel', 'formato', 'leitor'] as const
export type MotivoDaPlanilhaRecusada = (typeof MOTIVOS_DA_PLANILHA_RECUSADA)[number]

export type PlanilhaLida = { readonly ok: true; readonly texto: string } | { readonly ok: false; readonly motivo: MotivoDaPlanilhaRecusada }

const COMECO_DO_ZIP = [0x50, 0x4b, 0x03, 0x04]
/** O começo do `.xls` antigo do Excel (`D0 CF 11 E0`), que o leitor de XLSX não abre. */
const COMECO_DO_XLS = [0xd0, 0xcf, 0x11, 0xe0]

const comecaCom = (bytes: Uint8Array, assinatura: readonly number[]): boolean => assinatura.every((byte, posicao) => bytes[posicao] === byte)

/** Uma célula em texto: o que a pessoa vê, sem quebra de linha nem tabulação, entre aspas se tiver `;` ou `"`. A data sai `aaaa-mm-dd`, pelo dia em UTC. */
function textoDaCelula(celula: unknown): string {
  if (celula instanceof Date) return celula.toISOString().slice(0, 10)
  if (typeof celula !== 'string' && typeof celula !== 'number' && typeof celula !== 'boolean') return ''
  const texto = String(celula)
  const limpo = texto.replace(/[\r\n\t]+/g, ' ')
  return /[;"]/.test(limpo) ? `"${limpo.replace(/"/g, '""')}"` : limpo
}

/** A célula como a biblioteca entrega: texto, número, booleano, `Date` ou nulo (o tipo dela diz `typeof Date`, e por isso aqui é `unknown`). */
type CelulasDaLinha = readonly unknown[]

/** As linhas da aba em texto: todas com o mesmo número de colunas (a do cabeçalho), as em branco no fim fora. */
export function linhasEmTexto(linhas: readonly CelulasDaLinha[]): string {
  const vazia = (linha: CelulasDaLinha): boolean => linha.every((celula) => celula === null || celula === undefined || celula === '')
  let fim = linhas.length
  while (fim > 0 && vazia(linhas[fim - 1] ?? [])) fim -= 1
  const aproveitadas = linhas.slice(0, fim)
  const colunas = aproveitadas.find((linha) => !vazia(linha))?.length ?? 0
  return aproveitadas.map((linha) => (vazia(linha) ? '' : Array.from({ length: Math.max(colunas, linha.length) }, (_, posicao) => textoDaCelula(linha[posicao])).join(';'))).join('\n')
}

async function lerXlsx(arquivo: Blob): Promise<PlanilhaLida> {
  if (arquivo.size > MAXIMO_DE_BYTES_DO_XLSX) return { ok: false, motivo: 'grande' }
  let leitor: { readonly readSheet: typeof readSheet }
  try {
    leitor = await import('read-excel-file/browser')
  } catch {
    return { ok: false, motivo: 'leitor' }
  }
  let linhas: readonly CelulasDaLinha[]
  try {
    linhas = await leitor.readSheet(arquivo)
  } catch {
    return { ok: false, motivo: 'formato' }
  }
  return depoisDosTetos(linhasEmTexto(linhas))
}

function depoisDosTetos(texto: string): PlanilhaLida {
  const teto = tetoPassado(texto)
  if (teto !== undefined) return { ok: false, motivo: teto === 'bytes' ? 'grande' : 'linhas' }
  return { ok: true, texto }
}

export async function lerPlanilha(arquivo: Blob): Promise<PlanilhaLida> {
  try {
    const comeco = new Uint8Array(await arquivo.slice(0, 4).arrayBuffer())
    if (comecaCom(comeco, COMECO_DO_XLS)) return { ok: false, motivo: 'formato' }
    if (comecaCom(comeco, COMECO_DO_ZIP)) return await lerXlsx(arquivo)
    const csv = await lerArquivoDaLista(arquivo)
    return csv.ok ? depoisDosTetos(csv.texto) : csv
  } catch {
    // A leitura que o navegador recusa não pode virar promessa rejeitada sem aviso na tela.
    return { ok: false, motivo: 'ilegivel' }
  }
}
