import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * A guarda dos ids retidos (reserva-e-avaliacao, 10.0; RF14; `avaliacao.md`, "Lotes retidos"): o id de uma amostra de `docs/aia/ouro-retido/`
 * (`RT-`, `RQ-`, `RJ-` e `CR-`, três dígitos) só aparece fora da pasta dos lotes **sozinho**. O id com a frase ao lado, ou o lote copiado,
 * entrega o que o lote retido existe para não entregar: quem escreve padrão ou finalista não pode ter visto a frase.
 *
 * A guarda varre o repositório por padrão de id, **sem ler os lotes** (a pasta fica de fora) nem o que o hook escreve em `achados/`. Texto ao lado do id é
 * o que vem entre aspas, entre parênteses ou depois de `:` ou travessão colado ao id, e o id logo depois de uma citação entre aspas. Em arquivo
 * `.json` ou `.jsonl`, é o objeto que traz o id e uma chave de texto (`texto`, `frase`, `saida`…): o `resultado.json` com id e resultado passa; o lote copiado,
 * não. O `relatorio.md` que a avaliação grava entra na varredura como qualquer `.md`. A guarda falha se a pasta dos lotes some: a varredura sem alvo não é "nada a cobrar".
 */

export const PASTA_DOS_LOTES = 'docs/aia/ouro-retido'
export const INDICE_DOS_LOTES = `${PASTA_DOS_LOTES}/RETIDOS.json`

const PADRAO_DO_ID = /(?<![A-Za-z0-9])(?:RT|RQ|RJ|CR)-\d{3}(?!\d)/gu
const CHAVES_DE_TEXTO = ['texto', 'frase', 'mensagem', 'pedido', 'saida', 'resposta', 'duvida', 'entrada', 'conteudo', 'razao'] as const
const ABRE_TEXTO = new Set(['(', ':', '—', '–', '=', '"', '“', '«', '„'])
const FECHA_ASPAS = new Set(['"', '”', '»'])
const ENFEITE = new Set(['`', '*', '_', ' ', '\t', '\n', '\r'])
/** O quanto depois do id uma citação ainda é "ao lado dele", dentro da mesma frase. */
const ALCANCE_DA_FRASE = 80

export interface ArquivoParaIds {
  /** Caminho a partir da raiz, com `/`. */
  readonly caminho: string
  readonly texto: string
}

export interface ViolacaoDeId {
  readonly arquivo: string
  readonly id: string
  readonly motivo: string
}

/** O índice do primeiro caractere, a partir de `de` e andando `passo`, que não é enfeite (crase, ênfase, espaço, quebra de linha, e `(` quando se anda para trás). */
function primeiroSemEnfeite(texto: string, de: number, passo: 1 | -1): number {
  let indice = de
  // `charAt` fora do texto devolve vazio, que não é enfeite: o laço para sozinho nas pontas.
  while (ENFEITE.has(texto.charAt(indice)) || (passo === -1 && texto.charAt(indice) === '(')) indice += passo
  return indice
}

/** A frase depois do id, na mesma linha: até o ponto final seguido de espaço, a quebra de linha ou o alcance. */
function restoDaFrase(texto: string, fim: number): string {
  const trecho = texto.slice(fim, fim + ALCANCE_DA_FRASE)
  const corte = trecho.search(/\.\s|\n/u)
  return corte === -1 ? trecho : trecho.slice(0, corte)
}

function textoAoLado(texto: string, inicio: number, fim: number): boolean {
  const aposOId = primeiroSemEnfeite(texto, fim, 1)
  // `(` seguido de outro id é lista de ids, não texto.
  if (ABRE_TEXTO.has(texto.charAt(aposOId))) return !/^\(\s*(?:RT|RQ|RJ|CR)-\d{3}/u.test(texto.slice(aposOId))
  if (FECHA_ASPAS.has(texto.charAt(primeiroSemEnfeite(texto, inicio - 1, -1)))) return true
  return /["“«]/u.test(restoDaFrase(texto, fim))
}

const EXTENSOES_DE_CODIGO = /\.(?:ts|tsx|mjs|cjs)$/u
const CHAVE_DE_TEXTO_EM_CODIGO = new RegExp(`\\b(?:${CHAVES_DE_TEXTO.join('|')})\\s*:\\s*['"\`]`, 'u')

/**
 * O lote copiado em código: `{ id: '<id>', texto: '<a frase>' }`, com aspas simples ou crase, que `textoAoLado` não vê. O id é o valor de uma chave `id`
 * e o objeto que o contém (da chave `{` anterior à `}` seguinte) traz uma chave de texto com valor em texto.
 */
function objetoDeCodigoComTexto(texto: string, inicio: number, fim: number): boolean {
  if (!/\bid\s*:\s*['"`]$/u.test(texto.slice(Math.max(0, inicio - 20), inicio))) return false
  // Sem chave antes ou depois, o objeto vai do começo ou até o fim do arquivo: o lote copiado pela metade também é acusado.
  const abre = Math.max(texto.lastIndexOf('{', inicio), 0)
  const fecha = texto.indexOf('}', fim)
  return CHAVE_DE_TEXTO_EM_CODIGO.test(texto.slice(abre, fecha === -1 ? undefined : fecha))
}

function violacoesDeTexto(arquivo: ArquivoParaIds): ViolacaoDeId[] {
  const violacoes: ViolacaoDeId[] = []
  const ehCodigo = EXTENSOES_DE_CODIGO.test(arquivo.caminho)
  for (const achado of arquivo.texto.matchAll(PADRAO_DO_ID)) {
    const inicio = achado.index
    const fim = inicio + achado[0].length
    if (textoAoLado(arquivo.texto, inicio, fim) || (ehCodigo && objetoDeCodigoComTexto(arquivo.texto, inicio, fim))) violacoes.push({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o id vem com texto ao lado, fora de docs/aia/ouro-retido/' })
  }
  return violacoes
}

function objetosDo(valor: unknown): Record<string, unknown>[] {
  if (typeof valor !== 'object' || valor === null) return []
  const objeto = valor as Record<string, unknown>
  return [objeto, ...Object.values(objeto).flatMap(objetosDo)]
}

function violacoesDeObjeto(arquivo: ArquivoParaIds, objeto: Record<string, unknown>): ViolacaoDeId[] {
  const id = String(objeto.id)
  if (!new RegExp(`^${PADRAO_DO_ID.source}$`, 'u').test(id)) return []
  const chave = CHAVES_DE_TEXTO.find((candidata) => typeof objeto[candidata] === 'string' && objeto[candidata] !== '')
  return chave === undefined ? [] : [{ arquivo: arquivo.caminho, id, motivo: `o objeto do id leva a chave "${chave}": a frase de um lote retido, copiada` }]
}

function violacoesDeJson(arquivo: ArquivoParaIds): ViolacaoDeId[] {
  const linhas = arquivo.caminho.endsWith('.jsonl') ? arquivo.texto.split('\n').filter((linha) => linha.trim() !== '') : [arquivo.texto]
  try {
    return linhas.flatMap((linha) => objetosDo(JSON.parse(linha) as unknown)).flatMap((objeto) => violacoesDeObjeto(arquivo, objeto))
  } catch {
    // O que não abre não se prova sem texto: com id dentro, é violação.
    return [...arquivo.texto.matchAll(PADRAO_DO_ID)].map((achado) => ({ arquivo: arquivo.caminho, id: achado[0], motivo: 'o arquivo não abre como JSON: não dá para provar que o id está sem texto' }))
  }
}

const dentroDosLotes = (caminho: string): boolean => caminho === PASTA_DOS_LOTES || caminho.startsWith(`${PASTA_DOS_LOTES}/`)

/** Os ids com texto ao lado, ou o lote copiado, nos arquivos dados. A pasta dos lotes não é cobrada. */
export function verificarIdsRetidos(arquivos: readonly ArquivoParaIds[]): ViolacaoDeId[] {
  return arquivos
    .filter((arquivo) => !dentroDosLotes(arquivo.caminho))
    .flatMap((arquivo) => (/\.jsonl?$/u.test(arquivo.caminho) ? violacoesDeJson(arquivo) : violacoesDeTexto(arquivo)))
}

/** O alvo que sumiu: a pasta dos lotes ou o índice. Vazio quando estão onde a guarda espera. */
export function alvosQueSumiram(raiz: string): string[] {
  return [PASTA_DOS_LOTES, INDICE_DOS_LOTES].filter((alvo) => !existsSync(join(raiz, alvo)))
}

// Por nome, só o que nunca tem código nosso; o que sai por ser nosso sai pelo caminho: as fixtures das guardas, que têm a violação de propósito, e o
// `achados/` das tarefas, onde o hook grava o que o revisor escreveu. Fixture de outra pasta (`packages/core/src/ia/__fixtures__/`) é lida.
const PASTAS_IGNORADAS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.maestri', '.processo'])
const CAMINHOS_IGNORADOS: readonly RegExp[] = [/^tools\/guardas\/__fixtures__$/u, /^tasks\/[^/]+\/achados$/u]
const pastaIgnorada = (nome: string, caminho: string): boolean => PASTAS_IGNORADAS.has(nome) || CAMINHOS_IGNORADOS.some((padrao) => padrao.test(caminho))
const EXTENSOES_LIDAS = /\.(?:md|json|jsonl|ts|tsx|mjs|cjs|txt|yml|yaml|csv|html)$/u
const TAMANHO_MAXIMO = 2_000_000

/**
 * Os arquivos de texto do repositório, a partir da raiz, fora a pasta dos lotes e o que a varredura não deve ler: `achados/` (o que o hook escreve),
 * as fixtures das guardas (`tools/guardas/__fixtures__/`, que têm a violação de propósito), `node_modules`, `.git`. O `package-lock.json` também fica de fora.
 */
export function lerArquivosParaIds(raiz: string, tamanhoMaximo: number = TAMANHO_MAXIMO): ArquivoParaIds[] {
  const lidos: ArquivoParaIds[] = []
  const percorrer = (pasta: string): void => {
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      const completo = join(pasta, entrada.name)
      const caminho = relative(raiz, completo).split(sep).join('/')
      if (entrada.isDirectory()) {
        if (!pastaIgnorada(entrada.name, caminho) && !dentroDosLotes(caminho)) percorrer(completo)
      } else if (EXTENSOES_LIDAS.test(entrada.name) && entrada.name !== 'package-lock.json' && statSync(completo).size <= tamanhoMaximo) {
        lidos.push({ caminho, texto: readFileSync(completo, 'utf8') })
      }
    }
  }
  percorrer(raiz)
  return lidos
}
