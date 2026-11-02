import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Arvore, type Executor, executarDeVerdade } from './arvore.ts'
import { reescreverRelativos } from './especificadores.ts'
import { type EntradaDoMapa, lerMapa, type Mapa, ocorrenciasNoLugarDeHoje, validarMapa } from './mapa.ts'
import { atualizarAlvosDoPacote, renomearPacotes } from './pacotes.ts'
import { acharReferencias, estaClassificada } from './referencias.ts'
import { chaveDaTrocaAMaoNoLugarDeHoje, trocaAMaoRegistrada } from './registradas.ts'
import { alcanceDaEntrada, renomearPelaSintaxe } from './sintaxe.ts'
import { aplicarPasso5, type FicaEm } from './texto.ts'

/**
 * `reaplicar`: leva ao nome novo o que o merge da `develop` traz com o nome antigo (Tech Spec da X8, §5). Aplica todos os
 * mapas, na ordem das ondas, só às ocorrências que sobraram: o `de` que não existe mais não é erro, e rodar duas vezes não muda
 * nada. O que ele faz pela sintaxe e pelo caminho, sem o serviço de linguagem; depois dele, `conferir` e `restos`.
 */

export const PASTA_DOS_MAPAS = 'tools/renomear/mapas'
export const MAPA_DOS_DOCUMENTOS = `${PASTA_DOS_MAPAS}/13.json`

/** A troca à mão que os relatórios das ondas registram, como `arquivo\0nome`, com o arquivo no lugar de hoje. */
export function registradasDasOndas(arvore: Arvore, mapas: readonly Mapa[]): Set<string> {
  const chaves = mapas.flatMap((mapa, indice) => [...trocaAMaoRegistrada(arvore.lerOuNada(`${PASTA_DOS_MAPAS}/${mapa.nome}.relatorio.md`) ?? '')].map((chave) => chaveDaTrocaAMaoNoLugarDeHoje(chave, mapas, indice)))
  return new Set(chaves)
}

export interface OpcoesDoReaplicar {
  executar?: Executor
}

export interface ResultadoDoReaplicar {
  codigo: 0
  texto: string
  /** As referências por texto que nenhum mapa classifica: a correção as classifica ou troca à mão. */
  novas: string[]
}

function ordemDaOnda(nome: string): number {
  const numero = Number.parseInt(nome, 10)
  return Number.isNaN(numero) ? Number.MAX_SAFE_INTEGER : numero
}

export function lerTodosOsMapas(raiz: string): Mapa[] {
  let nomes: string[]
  try {
    nomes = readdirSync(join(raiz, PASTA_DOS_MAPAS)).filter((nome) => /^[^.]+\.json$/.test(nome))
  } catch {
    nomes = []
  }
  if (nomes.length === 0) throw new Error(`não há mapa em ${PASTA_DOS_MAPAS}/: o reaplicar não tem o que aplicar`)
  const mapas = nomes.map((nome) => lerMapa(join(raiz, PASTA_DOS_MAPAS, nome))).sort((a, b) => ordemDaOnda(a.nome) - ordemDaOnda(b.nome))
  const invalidos = mapas.flatMap((mapa) => validarMapa(mapa).map((recusa) => `${mapa.nome}.json: ${recusa.detalhe}`))
  if (invalidos.length > 0) throw new Error(`mapa inválido:\n${invalidos.join('\n')}`)
  return mapas
}

/** O arquivo ou a pasta que ainda está no lugar antigo (um arquivo novo dentro da pasta que mudou) vai para o lugar novo. */
function levarOQueFicou(arvore: Arvore, entrada: EntradaDoMapa): void {
  if (entrada.tipo === 'arquivo') {
    if (arvore.existe(entrada.de) && !arvore.existe(entrada.para)) arvore.mover(entrada.de, entrada.para)
    return
  }
  for (const caminho of arvore.caminhos().filter((c) => c.startsWith(`${entrada.de}/`))) {
    const destino = `${entrada.para}/${caminho.slice(entrada.de.length + 1)}`
    if (!arvore.existe(destino)) arvore.mover(caminho, destino)
  }
}

function reaplicarCaminho(arvore: Arvore, entrada: EntradaDoMapa): void {
  const movimento = { de: entrada.de, para: entrada.para, pasta: entrada.tipo === 'pasta' }
  reescreverRelativos(arvore, movimento, false)
  atualizarAlvosDoPacote(arvore, movimento)
  levarOQueFicou(arvore, entrada)
}

/** Um mapa inteiro sobre a árvore; o símbolo com `arquivo` só vale no alcance dele (`alcanceDaEntrada`). Devolve `true` se mudou o nome de um pacote. */
function reaplicarMapa(arvore: Arvore, mapas: readonly Mapa[], indice: number, documentos: boolean, ficaEm: FicaEm, deixaNoTexto: FicaEm): boolean {
  const mapa = mapas[indice] as Mapa
  for (const entrada of mapa.entradas) {
    if (entrada.tipo === 'simbolo') renomearPelaSintaxe(arvore, entrada, alcanceDaEntrada(arvore, entrada, mapas, indice), ficaEm)
    else if (entrada.tipo !== 'pacote') reaplicarCaminho(arvore, entrada)
  }
  const mudouPacote = renomearPacotes(arvore, mapa.entradas)
  aplicarPasso5(arvore, mapa.entradas, { documentos, ficaEm: deixaNoTexto })
  return mudouPacote
}

export function reaplicar(raiz: string, opcoes: OpcoesDoReaplicar = {}): ResultadoDoReaplicar {
  const mapas = lerTodosOsMapas(raiz)
  const arvore = Arvore.carregar(raiz)
  const documentosDosMapasDeLinha = arvore.existe(MAPA_DOS_DOCUMENTOS)
  const ocorrencias = ocorrenciasNoLugarDeHoje(mapas)
  const ficam = ocorrencias.filter((ocorrencia) => ocorrencia.classe === 'fica')
  const ficaEm: FicaEm = (arquivo, de, trecho) => estaClassificada({ arquivo, linha: 0, de, trecho }, ficam) !== undefined
  const registradas = registradasDasOndas(arvore, mapas)
  // No comentário e no documento, a palavra que o relatório da onda registrou como troca à mão também fica (o `restos` a libera igual).
  const deixaNoTexto: FicaEm = (arquivo, de, trecho) => ficaEm(arquivo, de, trecho) || registradas.has(`${arquivo}\u0000${de}`)
  const mudouPacote = mapas.map((mapa, indice) => reaplicarMapa(arvore, mapas, indice, !mapa.linha || documentosDosMapasDeLinha, ficaEm, deixaNoTexto)).some(Boolean)
  const novas = acharReferencias(arvore, mapas.flatMap((mapa) => mapa.entradas))
    .filter((referencia) => estaClassificada(referencia, ocorrencias) === undefined)
    .map((referencia) => `${referencia.arquivo}:${String(referencia.linha)} cita "${referencia.de}": ${referencia.trecho}`)
  const executar = opcoes.executar ?? executarDeVerdade
  arvore.gravar(executar)
  if (mudouPacote) executar('npm', ['install', '--package-lock-only'], raiz)
  const texto = [`Reaplicados ${String(mapas.length)} mapas.`, ...(novas.length > 0 ? ['Referências por texto sem classificação (classifique ou troque à mão):', ...novas.map((n) => `- ${n}`)] : []), 'Agora: conferir e restos.'].join('\n')
  return { codigo: 0, texto, novas }
}

if (import.meta.filename === process.argv[1]) {
  try {
    process.stdout.write(`${reaplicar(process.cwd()).texto}\n`)
  } catch (erro) {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`)
    process.exitCode = 2
  }
}
