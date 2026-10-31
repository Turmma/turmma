import ts from 'typescript'
import { Arvore } from './arvore.ts'
import { analisar, ehCodigo, linhaDe, PASTA_DO_PROTOTIPO } from './ast.ts'
import { casosDe } from './casos.ts'
import { arquivoDepoisDasOndas, type EntradaDoMapa, type Mapa, ocorrenciasNoLugarDeHoje } from './mapa.ts'
import { acharReferencias, estaClassificada } from './referencias.ts'
import { MAPA_DOS_DOCUMENTOS, lerTodosOsMapas, PASTA_DOS_MAPAS } from './reaplicar.ts'
import { TITULO_DA_TROCA_A_MAO } from './relatorio.ts'
import { textoDoUso } from './sintaxe.ts'
import { comentariosDe, ehDocumentoVivo, foraDoPasso5, semExtensaoDoCaminho, trocarTrecho } from './texto.ts'

/**
 * `restos`: nenhum `de` de nenhum mapa aplicado sobrou (Tech Spec da X8, §5). Busca com a forma do passo 6 no código (string,
 * template, regex, JSON, YAML, `-w`), pelo identificador (o uso que o `reaplicar` trocaria) e com a forma do passo 5 em comentário
 * e documento vivo, onde a palavra comum solta não conta.
 *
 * **Liberado:** o que o mapa classifica `fica` (string de fora, ou o identificador que a onda decidiu manter); a chave que o passo 2 mantém (`{ esquemaTurma: turmaSchema }`);
 * o texto de `describe`, `it` e `test`; a palavra que o relatório da onda registra na troca à mão (o `arquivo` de um e de outro acompanha os moves das ondas seguintes: `arquivoDepoisDasOndas`, em `mapa.ts`); e o que o passo 5 deixa fora
 * (`docs/decisoes.md`, o ouro, `tasks/`, o protótipo). A ocorrência `trava` não libera: a onda a troca, e o nome antigo que sobra é resto.
 *
 * **Documento.** Os mapas de linha (`"linha": true`) não olham documento enquanto não existir `mapas/13.json`; com ele, todos os
 * mapas olham, e o ouro (`docs/aia/ouro/`, `docs/aia/ouro-retido/`) deixa de ser isento.
 *
 * **Dado pessoal.** O `trecho` de um resto é impresso na saída. O que a árvore guarda é sintético (regra 20, item 17: seed e fixture de
 * desenvolvimento nunca são dado real), e o repositório é público. Se a saída um dia for arquivada pela esteira, essa premissa precisa continuar valendo.
 */

export interface Resto {
  arquivo: string
  linha: number
  de: string
  onde: 'texto' | 'identificador' | 'comentário' | 'documento'
  trecho: string
}

export interface ResultadoDosRestos {
  /** 0 limpo; 1 com resto. Sem mapa nenhum, lança. */
  codigo: 0 | 1
  restos: Resto[]
  texto: string
}

const PASTAS_DO_OURO = ['docs/aia/ouro/', 'docs/aia/ouro-retido/']
const aparar = (texto: string): string => texto.replace(/\s+/g, ' ').trim().slice(0, 100)

/** O identificador que o `restos` não cobra: a ferramenta, o protótipo, o histórico e o documento. A fixture entra: a onda a renomeia à mão (RF6). */
const foraDoIdentificador = (caminho: string): boolean => caminho.startsWith('tools/renomear/') || new RegExp(`(^|/)(node_modules|${PASTA_DO_PROTOTIPO}|tasks|docs)/`).test(caminho)

const ehDoOuro = (caminho: string): boolean => PASTAS_DO_OURO.some((pasta) => caminho.startsWith(pasta)) && /\.(md|json)$/.test(caminho)

// ---- o que o relatório da onda registra -------------------------------------------------------------------------------

/** As linhas da tabela "Troca à mão" do relatório da onda: `arquivo` e `nome`. */
export function trocaAMaoRegistrada(relatorio: string): Set<string> {
  const registrada = new Set<string>()
  const linhas = relatorio.split('\n')
  const inicio = linhas.indexOf(TITULO_DA_TROCA_A_MAO)
  if (inicio < 0) return registrada
  for (const linha of linhas.slice(inicio + 1)) {
    if (linha.startsWith('## ')) break
    const celulas = linha.split(/(?<!\\)\|/).map((celula) => celula.trim())
    const [, arquivo, nome] = celulas
    if (celulas.length >= 4 && arquivo !== undefined && nome !== undefined && arquivo !== 'Arquivo' && !/^-+$/.test(arquivo)) registrada.add(`${arquivo}\u0000${nome}`)
  }
  return registrada
}

/** A chave `arquivo\0nome` da troca à mão, com o arquivo levado pelos movimentos das ondas seguintes. */
function chaveDaTrocaAMaoNoLugarDeHoje(chave: string, mapas: readonly Mapa[], indiceDaOnda: number): string {
  const [arquivo = '', nome = ''] = chave.split('\u0000')
  return `${arquivoDepoisDasOndas(arquivo, mapas, indiceDaOnda)}\u0000${nome}`
}

// ---- a busca por texto (passo 6) --------------------------------------------------------------------------------------

/** As unidades de texto do título de um caso, com a linha onde cada uma começa: é o que a busca do passo 6 listaria dele. */
function titulosDeCaso(caminho: string, texto: string): Set<string> {
  const fonte = analisar(caminho, texto)
  const chaves = new Set<string>()
  const guardar = (no: ts.Node, conteudo: string): void => void chaves.add(`${String(linhaDe(fonte, no.getStart(fonte)))}\u0000${aparar(conteudo)}`)
  for (const { no } of casosDe(fonte)) {
    if (ts.isStringLiteralLike(no)) guardar(no, no.text)
    else if (ts.isTemplateExpression(no)) {
      guardar(no.head, no.head.text)
      for (const trecho of no.templateSpans) guardar(trecho.literal, trecho.literal.text)
    }
  }
  return chaves
}

function restosDeTexto(arvore: Arvore, entradas: readonly EntradaDoMapa[]): Resto[] {
  const titulos = new Map<string, Set<string>>()
  const ehTitulo = (arquivo: string, linha: number, trecho: string): boolean => {
    if (!ehCodigo(arquivo)) return false
    const doArquivo = titulos.get(arquivo) ?? titulosDeCaso(arquivo, arvore.ler(arquivo))
    titulos.set(arquivo, doArquivo)
    return doArquivo.has(`${String(linha)}\u0000${trecho}`)
  }
  return acharReferencias(arvore, entradas)
    .filter((referencia) => !ehTitulo(referencia.arquivo, referencia.linha, referencia.trecho))
    .map((referencia) => ({ arquivo: referencia.arquivo, linha: referencia.linha, de: referencia.de, onde: 'texto', trecho: referencia.trecho }))
}

// ---- o identificador --------------------------------------------------------------------------------------------------

/** O uso do símbolo antigo que o `reaplicar` trocaria. A chave mantida pelo passo 2, o membro e o tipo de um campo não contam; o uso de uma variável local que tem o nome antigo conta (é o limite que o passo 6 declara), e o `restos` fica vermelho a mais, nunca verde a mais. */
function restosDeIdentificador(arvore: Arvore, entradas: readonly EntradaDoMapa[]): Resto[] {
  const simbolos = simbolosDe(entradas)
  const restos: Resto[] = []
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (texto === undefined || !ehCodigo(caminho) || foraDoIdentificador(caminho) || ![...simbolos.keys()].some((de) => texto.includes(de))) continue
    const fonte = analisar(caminho, texto)
    const visitar = (no: ts.Node): void => {
      const entrada = ts.isIdentifier(no) ? simbolos.get(no.text) : undefined
      if (entrada !== undefined && ts.isIdentifier(no) && textoDoUso(no, entrada) !== undefined) {
        restos.push({ arquivo: caminho, linha: linhaDe(fonte, no.getStart(fonte)), de: entrada.de, onde: 'identificador', trecho: aparar(texto.split('\n')[linhaDe(fonte, no.getStart(fonte)) - 1] ?? '') })
      }
      ts.forEachChild(no, visitar)
    }
    visitar(fonte)
  }
  return restos
}

// ---- comentário e documento (passo 5) ---------------------------------------------------------------------------------

/** Os `de` que o passo 5 ainda trocaria no trecho: o identificador composto, o entre crases, o `{@link}` e o caminho. */
function nomesQueOPasso5Trocaria(trecho: string, entradas: readonly EntradaDoMapa[]): string[] {
  const citadas = entradas.filter((entrada) => [entrada.de, semExtensaoDoCaminho(entrada.de)].some((nome) => nome !== undefined && trecho.includes(nome)))
  return citadas.filter((entrada) => trocarTrecho(trecho, [entrada], simbolosDe([entrada])).texto !== trecho).map((entrada) => entrada.de)
}

function simbolosDe(entradas: readonly EntradaDoMapa[]): Map<string, EntradaDoMapa> {
  return new Map(entradas.filter((entrada) => entrada.tipo === 'simbolo').map((entrada) => [entrada.de, entrada]))
}

function restosDeComentario(arvore: Arvore, entradas: readonly EntradaDoMapa[]): Resto[] {
  const simbolos = simbolosDe(entradas)
  const restos: Resto[] = []
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (texto === undefined || !ehCodigo(caminho) || foraDoPasso5(caminho) || !entradas.some((entrada) => texto.includes(entrada.de))) continue
    const fonte = analisar(caminho, texto)
    for (const [inicio, fim] of comentariosDe(fonte)) {
      const comentario = texto.slice(inicio, fim)
      if (trocarTrecho(comentario, entradas, simbolos).texto === comentario) continue
      for (const de of nomesQueOPasso5Trocaria(comentario, entradas)) restos.push({ arquivo: caminho, linha: linhaDe(fonte, inicio), de, onde: 'comentário', trecho: aparar(comentario) })
    }
  }
  return restos
}

function restosDeDocumento(arvore: Arvore, entradas: readonly EntradaDoMapa[], comOuro: boolean): Resto[] {
  const simbolos = simbolosDe(entradas)
  const restos: Resto[] = []
  for (const caminho of arvore.caminhos()) {
    const texto = arvore.lerOuNada(caminho)
    if (texto === undefined || !(ehDocumentoVivo(caminho) || (comOuro && ehDoOuro(caminho)))) continue
    texto.split('\n').forEach((linha, indice) => {
      if (trocarTrecho(linha, entradas, simbolos).texto === linha) return
      for (const de of nomesQueOPasso5Trocaria(linha, entradas)) restos.push({ arquivo: caminho, linha: indice + 1, de, onde: 'documento', trecho: aparar(linha) })
    })
  }
  return restos
}

// ---- o comando --------------------------------------------------------------------------------------------------------

function textoDoResultado(restos: readonly Resto[], mapas: number): string {
  if (restos.length === 0) return `restos: limpo. ${String(mapas)} mapas, nenhum nome antigo sobrou.`
  return [`restos: ${String(restos.length)} nomes antigos sobraram (${String(mapas)} mapas):`, ...restos.map((r) => `- ${r.arquivo}:${String(r.linha)} (${r.onde}) cita "${r.de}": ${r.trecho}`)].join('\n')
}

export function restos(raiz: string): ResultadoDosRestos {
  const mapas = lerTodosOsMapas(raiz)
  const arvore = Arvore.carregar(raiz)
  const existe13 = arvore.existe(MAPA_DOS_DOCUMENTOS)
  const todas = mapas.flatMap((mapa) => mapa.entradas)
  const fica = ocorrenciasNoLugarDeHoje(mapas).filter((ocorrencia) => ocorrencia.classe === 'fica')
  const dosDocumentos = mapas.filter((mapa) => !mapa.linha || existe13).flatMap((mapa) => mapa.entradas)
  const registrada = new Set(mapas.flatMap((mapa, indice) => [...trocaAMaoRegistrada(arvore.lerOuNada(`${PASTA_DOS_MAPAS}/${mapa.nome}.relatorio.md`) ?? '')].map((chave) => chaveDaTrocaAMaoNoLugarDeHoje(chave, mapas, indice))))
  const achados = [
    ...restosDeTexto(arvore, todas),
    ...restosDeIdentificador(arvore, todas),
    ...restosDeComentario(arvore, todas),
    ...restosDeDocumento(arvore, dosDocumentos, existe13),
  ]
    .filter((resto) => estaClassificada(resto, fica) === undefined)
    .filter((resto) => resto.onde === 'texto' || resto.onde === 'identificador' || !registrada.has(`${resto.arquivo}\u0000${resto.de}`))
  const vistos = new Set<string>()
  const unicos = achados.filter((r) => {
    const chave = `${r.arquivo}:${String(r.linha)}:${r.de}:${r.onde}`
    return !vistos.has(chave) && vistos.add(chave)
  })
  return { codigo: unicos.length === 0 ? 0 : 1, restos: unicos, texto: textoDoResultado(unicos, mapas.length) }
}

if (import.meta.filename === process.argv[1]) {
  try {
    const resultado = restos(process.cwd())
    process.stdout.write(`${resultado.texto}\n`)
    process.exitCode = resultado.codigo
  } catch (erro) {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`)
    process.exitCode = 2
  }
}
