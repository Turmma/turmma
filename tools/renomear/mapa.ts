import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

/**
 * O mapa de uma onda do rename (Tech Spec da X8, §5): uma entrada por linha do anexo do inventário, e as duas listas que o
 * `aplicar` e o `conferir` leem. É JSON, escrito à mão pela onda; este módulo só o lê e confere a forma, e as recusas 3 e 4
 * (o `de` que se repete e a entrada sem a linha do anexo) nascem aqui.
 */

export type TipoDeEntrada = 'simbolo' | 'arquivo' | 'pasta' | 'pacote'

export interface EntradaDoMapa {
  tipo: TipoDeEntrada
  /** O nome atual. Arquivo e pasta: o caminho a partir da raiz do repositório. Pacote: o nome (e, com subcaminho, `pacote/sub`). */
  de: string
  para: string
  /** Só no símbolo: onde ele é declarado. Sem `arquivo`, vale toda declaração com o nome (o `com` dos módulos dinâmicos). */
  arquivo?: string
  /** `inventario-<x>.md:<linha>`. */
  linhaDoAnexo: string
  /** O nome do import onde o `para` colide com outro nome do arquivo. */
  alias?: string
  /** Calculado, nunca declarado: o `de` de uma palavra só, que também é palavra de português ou de inglês. */
  comum: boolean
}

export interface OcorrenciaClassificada {
  /** O arquivo, ou a pasta (com `/` no fim) quando a classificação vale para tudo o que está dentro dela. */
  arquivo: string
  /** O texto achado: o `de` da entrada, ou o prefixo que o `startsWith` e o `endsWith` conferem. */
  de: string
  /** `fica`: string de fora. `trava`: o texto que a onda troca à mão. */
  classe: 'fica' | 'trava'
  /** `fica`: a linha de "Não muda, mas parece" do anexo. `trava`: a linha do `travas.md`. */
  linha: string
  /** Só as ocorrências cuja linha contém este trecho. */
  trecho?: string
}

export interface ExcecaoDoConferir {
  arquivo: string
  texto: string
  motivo: string
}

export interface Mapa {
  /** O número da onda, tirado do nome do arquivo: `7.json` é a `7`. */
  nome: string
  /** Onda de linha (7.0 a 11.0): só símbolo, e nenhum documento é tocado até a 13.0. */
  linha: boolean
  entradas: EntradaDoMapa[]
  ocorrencias: OcorrenciaClassificada[]
  excecoesDoConferir: ExcecaoDoConferir[]
}

export type CodigoDeRecusa =
  | 'de-inexistente'
  | 'colisao'
  | 'de-repetido'
  | 'sem-linha-do-anexo'
  | 'fora-do-escopo'
  | 'ocorrencia-sem-classificacao'

export interface Recusa {
  codigo: CodigoDeRecusa
  detalhe: string
}

const TIPOS: readonly string[] = ['simbolo', 'arquivo', 'pasta', 'pacote']
const FORMATO_DA_LINHA_DO_ANEXO = /^inventario(-[a-z0-9-]+)?\.md:\d+$/
const FORMATO_DA_LINHA_DA_TRAVA = /^travas\.md:\d+$/

/** `com`, `Banco`, `Tela`, `Fila`, `migrar`: uma palavra só, sem maiúscula interna nem `_`. */
export function ehComum(de: string): boolean {
  return /^[A-Za-z][a-z0-9]*$/.test(de)
}

function texto(valor: unknown, onde: string): string {
  if (typeof valor !== 'string' || valor === '') throw new Error(`mapa inválido: ${onde} precisa ser um texto não vazio`)
  return valor
}

function textoOpcional(valor: unknown, onde: string): string | undefined {
  return valor === undefined ? undefined : texto(valor, onde)
}

function objeto(valor: unknown, onde: string): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) throw new Error(`mapa inválido: ${onde} precisa ser um objeto`)
  return valor as Record<string, unknown>
}

function lista(valor: unknown, onde: string): unknown[] {
  if (valor === undefined) return []
  if (!Array.isArray(valor)) throw new Error(`mapa inválido: ${onde} precisa ser uma lista`)
  return valor
}

function lerEntrada(cru: unknown, indice: number): EntradaDoMapa {
  const onde = `entradas[${String(indice)}]`
  const campos = objeto(cru, onde)
  const tipo = texto(campos.tipo, `${onde}.tipo`)
  if (!TIPOS.includes(tipo)) throw new Error(`mapa inválido: ${onde}.tipo "${tipo}" não é simbolo, arquivo, pasta nem pacote`)
  const de = texto(campos.de, `${onde}.de`)
  const arquivo = textoOpcional(campos.arquivo, `${onde}.arquivo`)
  const alias = textoOpcional(campos.alias, `${onde}.alias`)
  return {
    tipo: tipo as TipoDeEntrada,
    de,
    para: texto(campos.para, `${onde}.para`),
    // Texto vazio é "falta": a recusa 4 é do `validarMapa`, que diz qual entrada.
    linhaDoAnexo: typeof campos.linhaDoAnexo === 'string' ? campos.linhaDoAnexo : '',
    ...(arquivo === undefined ? {} : { arquivo }),
    ...(alias === undefined ? {} : { alias }),
    comum: tipo === 'simbolo' && ehComum(de),
  }
}

function lerOcorrencia(cru: unknown, indice: number): OcorrenciaClassificada {
  const onde = `ocorrencias[${String(indice)}]`
  const campos = objeto(cru, onde)
  const classe = texto(campos.classe, `${onde}.classe`)
  if (classe !== 'fica' && classe !== 'trava') throw new Error(`mapa inválido: ${onde}.classe "${classe}" não é fica nem trava`)
  const trecho = textoOpcional(campos.trecho, `${onde}.trecho`)
  return {
    arquivo: texto(campos.arquivo, `${onde}.arquivo`),
    de: texto(campos.de, `${onde}.de`),
    classe,
    linha: typeof campos.linha === 'string' ? campos.linha : '',
    ...(trecho === undefined ? {} : { trecho }),
  }
}

function lerExcecao(cru: unknown, indice: number): ExcecaoDoConferir {
  const onde = `excecoesDoConferir[${String(indice)}]`
  const campos = objeto(cru, onde)
  return { arquivo: texto(campos.arquivo, `${onde}.arquivo`), texto: texto(campos.texto, `${onde}.texto`), motivo: texto(campos.motivo, `${onde}.motivo`) }
}

/** Lê o mapa de um texto JSON. Forma errada é erro do mapa (a onda o corrige), e não recusa do `aplicar`. */
export function lerMapaDoTexto(conteudo: string, caminho: string): Mapa {
  let cru: unknown
  try {
    cru = JSON.parse(conteudo)
  } catch {
    throw new Error(`mapa inválido: ${caminho} não é JSON`)
  }
  const campos = objeto(cru, caminho)
  return {
    nome: basename(caminho).replace(/\.json$/, ''),
    linha: campos.linha === true,
    entradas: lista(campos.entradas, 'entradas').map(lerEntrada),
    ocorrencias: lista(campos.ocorrencias, 'ocorrencias').map(lerOcorrencia),
    excecoesDoConferir: lista(campos.excecoesDoConferir, 'excecoesDoConferir').map(lerExcecao),
  }
}

export function lerMapa(caminho: string): Mapa {
  return lerMapaDoTexto(readFileSync(caminho, 'utf8'), caminho)
}

// ---- o arquivo depois das ondas seguintes -----------------------------------------------------------------------------

/**
 * O `arquivo` de uma ocorrência classificada, ou o da troca à mão de um relatório, é o da árvore logo depois da onda que o
 * classificou. Uma onda posterior pode mover o arquivo ou a pasta dele, e então o caminho registrado já não existe: esta função o
 * leva pelos movimentos `arquivo` e `pasta` das ondas seguintes, na ordem das ondas e, dentro de cada uma, na ordem das entradas.
 * Os movimentos da própria onda não entram (ela classifica depois dos moves dela), e o mapa e o relatório de onda feita não se reescrevem.
 *
 * Arquivo: o `de` igual leva ao `para`. Pasta: o prefixo `de/` vira `para/`, e a classificação que é a própria pasta (termina em `/`) também.
 * O arquivo que chegou ao caminho antigo depois do move não é levado a lugar nenhum: a classificação já saiu de lá.
 *
 * @param mapas Os mapas na ordem das ondas (`lerTodosOsMapas`).
 * @param indiceDaOnda A posição, em `mapas`, da onda que classificou o arquivo.
 */
export function arquivoDepoisDasOndas(arquivo: string, mapas: readonly Mapa[], indiceDaOnda: number): string {
  let atual = arquivo
  for (const mapa of mapas.slice(indiceDaOnda + 1)) {
    for (const entrada of mapa.entradas) {
      if (entrada.tipo === 'arquivo' && atual === entrada.de) atual = entrada.para
      else if (entrada.tipo === 'pasta' && atual.startsWith(`${entrada.de}/`)) atual = `${entrada.para}${atual.slice(entrada.de.length)}`
    }
  }
  return atual
}

/** Todas as ocorrências classificadas de todas as ondas, cada uma com o `arquivo` levado pelos movimentos das ondas seguintes. */
export function ocorrenciasNoLugarDeHoje(mapas: readonly Mapa[]): OcorrenciaClassificada[] {
  return mapas.flatMap((mapa, indice) => mapa.ocorrencias.map((ocorrencia) => ({ ...ocorrencia, arquivo: arquivoDepoisDasOndas(ocorrencia.arquivo, mapas, indice) })))
}

/** O pacote de um arquivo: `apps/api`, `packages/shared`; fora disso, a primeira pasta. */
export function pacoteDoArquivo(arquivo: string): string {
  const partes = arquivo.split('/')
  return partes.slice(0, partes[0] === 'apps' || partes[0] === 'packages' ? 2 : 1).join('/')
}

/**
 * Duas entradas de mesmo `de` se repetem, salvo se as duas forem de símbolo, cada uma com `arquivo`, e ou caírem em pacotes diferentes
 * ou, no mesmo pacote, forem de arquivos diferentes com o mesmo `para` (as cópias do mesmo nome, uma entrada por declaração): o
 * `aplicar` acha cada declaração pelo `arquivo`, e o `conferir` segue cada entrada só no pacote dela, ou, no mesmo pacote, devolve o
 * mesmo `para` por qualquer uma (Tech Spec §5). O mesmo `arquivo` duas vezes é a linha duplicada, e não uma cópia.
 */
function seRepetem(a: EntradaDoMapa, b: EntradaDoMapa): boolean {
  if (a.tipo !== 'simbolo' || b.tipo !== 'simbolo' || a.arquivo === undefined || b.arquivo === undefined) return true
  if (pacoteDoArquivo(a.arquivo) !== pacoteDoArquivo(b.arquivo)) return false
  return a.arquivo === b.arquivo || a.para !== b.para
}

/** As recusas que o mapa sozinho dá, antes de olhar a árvore: o `de` que se repete, e a linha do anexo que falta. */
export function validarMapa(mapa: Mapa): Recusa[] {
  const recusas: Recusa[] = []
  const vistos = new Map<string, EntradaDoMapa[]>()
  for (const entrada of mapa.entradas) {
    const doMesmoDe = vistos.get(entrada.de) ?? []
    if (doMesmoDe.some((vista) => seRepetem(vista, entrada))) recusas.push({ codigo: 'de-repetido', detalhe: `o "${entrada.de}" aparece mais de uma vez no mapa` })
    vistos.set(entrada.de, [...doMesmoDe, entrada])
    if (!FORMATO_DA_LINHA_DO_ANEXO.test(entrada.linhaDoAnexo)) {
      recusas.push({ codigo: 'sem-linha-do-anexo', detalhe: `"${entrada.de}" não tem linhaDoAnexo no formato inventario-<x>.md:<linha>` })
    }
  }
  for (const ocorrencia of mapa.ocorrencias) {
    const formato = ocorrencia.classe === 'fica' ? FORMATO_DA_LINHA_DO_ANEXO : FORMATO_DA_LINHA_DA_TRAVA
    if (!formato.test(ocorrencia.linha)) {
      const esperado = ocorrencia.classe === 'fica' ? 'inventario-<x>.md:<linha>' : 'travas.md:<linha>'
      recusas.push({ codigo: 'sem-linha-do-anexo', detalhe: `a ocorrência "${ocorrencia.de}" em ${ocorrencia.arquivo} (${ocorrencia.classe}) não tem linha no formato ${esperado}` })
    }
  }
  return recusas
}
