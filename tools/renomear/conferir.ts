import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import type { Movimento } from './arvore.ts'
import { destinoDoArquivo, destinoDoCaminho } from './especificadores.ts'
import { type Categoria, fotografar, type ItemDaFoto, naFoto, RAIZES_DA_FOTO } from './foto.ts'
import { type EntradaDoMapa, type ExcecaoDoConferir, lerMapa, type Mapa, validarMapa } from './mapa.ts'

/**
 * `conferir`: prova que a onda só mudou nome (Tech Spec da X8, §5). Tira uma foto de `apps/`, `packages/`, `e2e/`, `infra/test/`,
 * `infra/scripts/` e `tools/` (menos `tools/renomear/`) no `HEAD` e outra na árvore, aplica o mapa à de antes (o caminho do arquivo,
 * o especificador e o nome exportado) e compara. Qualquer diferença que o mapa não explica deixa o comando vermelho.
 *
 * A foto de antes é o conteúdo de `git show HEAD:<arquivo>`, lido em lote por `git cat-file --batch`: um processo só, e não um por arquivo.
 *
 * **O que cada exceção cobre.** `excecoesDoConferir` vale para a string, a parte de template, a regex, o `JsxText` e a chave, no
 * `arquivo` que a árvore tem depois da onda, com o `texto` igual ao valor. Uma exceção cobre um lado da troca: a string que muda
 * de propósito leva duas, a do texto antigo e a do novo. O caso de teste, o especificador e o nome exportado não têm exceção: ou o
 * mapa explica, ou o `conferir` fica vermelho (RF6, RF7).
 *
 * **O nome exportado e o pacote.** A entrada `simbolo` com `arquivo` troca o nome exportado só no pacote desse arquivo e em quem o reexporta,
 * nas duas formas: `export { X } from '…'` (e `export * as X from '…'`) e o `export { X }` de um nome que o arquivo importou do pacote. O
 * homônimo exportado por outro pacote fica com o nome, como o `aplicar`, que renomeia por símbolo, o deixa. A entrada sem `arquivo` vale em
 * todo pacote. O nome que vale é o exportado: `export { X as Y } from` é o `Y`.
 *
 * **Limites conhecidos** (todos para o lado do vermelho; nenhum deixa passar uma diferença): (1) a reexportação em cadeia (`apps/web`
 * reexporta de `apps/api`, que reexporta do core) não segue a entrada, porque só se olha o primeiro salto; (2) `tools/` conta como um pacote
 * só (`pacoteDoArquivo`), e uma entrada com `arquivo` em `tools/processo/` troca o homônimo de qualquer outro arquivo de `tools/`; (3) dois
 * exportados com o mesmo nome dentro do pacote da entrada, ou um nome que um arquivo desse pacote importa de outro pacote e repassa, são
 * trocados na foto de antes e o `aplicar` não os troca; (4) a entrada cujo pacote não tem `package.json` no `HEAD` só vale na pasta, e a
 * reexportação pelo nome do pacote não a segue. Quem lê um vermelho de nome exportado confere estes quatro antes de achar defeito na onda.
 */

export interface Divergencia {
  categoria: Categoria
  /** O arquivo da árvore, ou a pasta do pacote nos nomes exportados. */
  arquivo: string
  valor: string
  /** `saiu`: estava no `HEAD` e não está na árvore. `entrou`: o contrário. */
  lado: 'saiu' | 'entrou'
}

export interface ResultadoDoConferir {
  /** 0 verde; 1 vermelho. A foto vazia e a pasta inexistente lançam. */
  codigo: 0 | 1
  divergencias: Divergencia[]
  texto: string
}

const CATEGORIAS_COM_EXCECAO: ReadonlySet<Categoria> = new Set(['string', 'template', 'regex', 'jsx', 'chave'])
const LIMITE_DE_LINHAS = 200

// ---- a foto do disco -------------------------------------------------------------------------------------------------

function git(raiz: string, argumentos: string[], entrada?: string): Buffer {
  return execFileSync('git', argumentos, { cwd: raiz, maxBuffer: 1024 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...(entrada === undefined ? {} : { input: entrada }) })
}

/** Divide a saída de `git cat-file --batch`: `<sha> <tipo> <tamanho>\n<conteúdo>\n`, um bloco por pedido. */
function blocosDoBatch(saida: Buffer, caminhos: readonly string[]): Map<string, string> {
  const arquivos = new Map<string, string>()
  let posicao = 0
  for (const caminho of caminhos) {
    const fimDoCabecalho = saida.indexOf(0x0a, posicao)
    const cabecalho = saida.subarray(posicao, fimDoCabecalho).toString('utf8').split(' ')
    if (cabecalho[1] === 'missing') throw new Error(`${caminho} não existe no HEAD`)
    const tamanho = Number(cabecalho[2])
    arquivos.set(caminho, saida.subarray(fimDoCabecalho + 1, fimDoCabecalho + 1 + tamanho).toString('utf8'))
    posicao = fimDoCabecalho + 1 + tamanho + 1
  }
  return arquivos
}

/** Os arquivos da foto no `HEAD`: caminho → texto. */
function lerDoHead(raiz: string): Map<string, string> {
  const caminhos = git(raiz, ['ls-tree', '-r', '-z', '--name-only', 'HEAD']).toString('utf8').split('\0').filter((caminho) => caminho !== '' && naFoto(caminho))
  if (caminhos.length === 0) return new Map()
  return blocosDoBatch(git(raiz, ['cat-file', '--batch'], caminhos.map((caminho) => `HEAD:${caminho}`).join('\n') + '\n'), caminhos)
}

/** Os arquivos da foto na árvore: os versionados e os que vão ser, sem os ignorados, e sem o que o índice ainda tem e o disco já não. */
function lerDaArvore(raiz: string): Map<string, string> {
  const caminhos = git(raiz, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString('utf8').split('\0')
  const arquivos = new Map<string, string>()
  for (const caminho of caminhos) {
    if (caminho !== '' && naFoto(caminho) && existsSync(join(raiz, caminho))) arquivos.set(caminho, readFileSync(join(raiz, caminho), 'utf8'))
  }
  return arquivos
}

function fotoDe(arquivos: ReadonlyMap<string, string>): ItemDaFoto[] {
  return [...arquivos].flatMap(([caminho, texto]) => fotografar(caminho, texto))
}

// ---- o mapa aplicado à foto de antes ---------------------------------------------------------------------------------

const movimentosDe = (entradas: readonly EntradaDoMapa[]): Movimento[] =>
  entradas.filter((entrada) => entrada.tipo === 'arquivo' || entrada.tipo === 'pasta').map((entrada) => ({ de: entrada.de, para: entrada.para, pasta: entrada.tipo === 'pasta' }))

function substituirPrefixo(valor: string, de: string, para: string): string | undefined {
  if (valor === de) return para
  return valor.startsWith(`${de}/`) ? para + valor.slice(de.length) : undefined
}

/** O especificador de pacote depois dos `pacote` do mapa, do subcaminho (o `de` mais longo) para o nome, como o `aplicar` os troca. */
function pacoteMapeado(especificador: string, pacotes: readonly EntradaDoMapa[]): string {
  let atual = especificador
  for (const entrada of [...pacotes].sort((a, b) => b.de.length - a.de.length)) atual = substituirPrefixo(atual, entrada.de, entrada.para) ?? atual
  return atual
}

function especificadorMapeado(valor: string, movimentos: readonly Movimento[], pacotes: readonly EntradaDoMapa[]): string {
  const [tipo, alvo = '', extensao = ''] = valor.split('|')
  if (tipo === 'pacote') return `pacote|${pacoteMapeado(alvo, pacotes)}`
  const novoAlvo = movimentos.reduce((atual, movimento) => destinoDoCaminho(atual, movimento), alvo)
  return `relativo|${novoAlvo}|${extensao}`
}

/** O nome do pacote de `@escopo/nome/sub` ou `nome/sub`. */
const nomeDoPacoteDe = (especificador: string): string => especificador.split('/').slice(0, especificador.startsWith('@') ? 2 : 1).join('/')

/** O nome (`name` do `package.json`) de cada pasta de pacote em que uma entrada de símbolo declara o `arquivo`, como o `HEAD` o tem. */
function nomesDosPacotesDasEntradas(raiz: string, mapa: Mapa): Map<string, string> {
  const nomes = new Map<string, string>()
  for (const entrada of mapa.entradas) {
    if (entrada.tipo !== 'simbolo' || entrada.arquivo === undefined) continue
    const pasta = pacoteDoArquivo(entrada.arquivo)
    if (nomes.has(pasta)) continue
    try {
      const nome = (JSON.parse(git(raiz, ['show', `HEAD:${pasta}/package.json`]).toString('utf8')) as { name?: unknown }).name
      if (typeof nome === 'string') nomes.set(pasta, nome)
    } catch {
      // Pasta sem `package.json` no `HEAD` (`tools/`, ou o arquivo de um pacote que nasce na onda): só a pasta vale.
    }
  }
  return nomes
}

/** O item repassa um nome do pacote da pasta (`export … from` ou `export { X }` de um `import`): pelo nome do pacote, ou pelo caminho relativo que entra nela. */
function reexportaDoPacote(origem: string | undefined, pasta: string, nomes: ReadonlyMap<string, string>): boolean {
  if (origem === undefined) return false
  const [tipo, alvo = ''] = origem.split('|')
  if (tipo === 'relativo') return alvo.startsWith(`${pasta}/`)
  return nomes.get(pasta) === nomeDoPacoteDe(alvo)
}

/**
 * O nome exportado segue a entrada `simbolo` só no pacote do `arquivo` dela e em quem o reexporta (`export { X } from` e o `export { X }` do que
 * o arquivo importou): o `aplicar` renomeia por símbolo, e o homônimo de outro pacote fica com o nome. A entrada sem `arquivo` vale em todo
 * pacote. O `item.arquivo` é o do `HEAD`.
 */
function paraONomeExportado(item: ItemDaFoto, entradas: readonly EntradaDoMapa[], nomes: ReadonlyMap<string, string>): string {
  const entrada = entradas.find((candidata) => {
    if (candidata.tipo !== 'simbolo' || candidata.de !== item.valor) return false
    if (candidata.arquivo === undefined) return true
    const pasta = pacoteDoArquivo(candidata.arquivo)
    return pacoteDoArquivo(item.arquivo) === pasta || reexportaDoPacote(item.origem, pasta, nomes)
  })
  return entrada?.para ?? item.valor
}

/** A foto de antes como a onda a deixa se só mudar nome: o arquivo no lugar novo, o especificador e o nome exportado com o nome novo. */
function aplicarMapaAFoto(itens: readonly ItemDaFoto[], mapa: Mapa, nomesDosPacotes: ReadonlyMap<string, string>): ItemDaFoto[] {
  const movimentos = movimentosDe(mapa.entradas)
  const pacotes = mapa.entradas.filter((entrada) => entrada.tipo === 'pacote')
  return itens.map((item) => {
    const arquivo = movimentos.reduce((atual, movimento) => destinoDoArquivo(atual, movimento), item.arquivo)
    if (item.categoria === 'especificador') return { ...item, arquivo, valor: especificadorMapeado(item.valor, movimentos, pacotes) }
    if (item.categoria === 'exportado') return { ...item, arquivo, valor: paraONomeExportado(item, mapa.entradas, nomesDosPacotes) }
    return { ...item, arquivo }
  })
}

// ---- a comparação ----------------------------------------------------------------------------------------------------

/** O pacote de um arquivo: `apps/api`, `packages/shared`; fora disso, a primeira pasta. */
function pacoteDoArquivo(arquivo: string): string {
  const partes = arquivo.split('/')
  return partes.slice(0, partes[0] === 'apps' || partes[0] === 'packages' ? 2 : 1).join('/')
}

/** Onde o item é contado: por arquivo, e por pacote nos nomes exportados (o nome pode mudar de arquivo dentro dele). */
const grupoDe = (item: ItemDaFoto): string => `${item.categoria}\u0000${item.categoria === 'exportado' ? pacoteDoArquivo(item.arquivo) : item.arquivo}`

function contar(itens: readonly ItemDaFoto[]): Map<string, Map<string, number>> {
  const grupos = new Map<string, Map<string, number>>()
  for (const item of itens) {
    const grupo = grupos.get(grupoDe(item)) ?? new Map<string, number>()
    grupo.set(item.valor, (grupo.get(item.valor) ?? 0) + 1)
    grupos.set(grupoDe(item), grupo)
  }
  return grupos
}

function diferencas(grupo: string, antes: ReadonlyMap<string, number> | undefined, depois: ReadonlyMap<string, number> | undefined): Divergencia[] {
  const [categoria = '', arquivo = ''] = grupo.split('\u0000')
  const valores = new Set([...(antes?.keys() ?? []), ...(depois?.keys() ?? [])])
  return [...valores].flatMap((valor) => {
    const delta = (depois?.get(valor) ?? 0) - (antes?.get(valor) ?? 0)
    const lado = delta > 0 ? 'entrou' : 'saiu'
    return Array.from({ length: Math.abs(delta) }, (): Divergencia => ({ categoria: categoria as Categoria, arquivo, valor, lado }))
  })
}

function coberta(divergencia: Divergencia, excecoes: readonly ExcecaoDoConferir[]): boolean {
  return CATEGORIAS_COM_EXCECAO.has(divergencia.categoria) && excecoes.some((excecao) => excecao.arquivo === divergencia.arquivo && excecao.texto === divergencia.valor)
}

/** As diferenças entre a foto de antes (já com o mapa) e a de depois, sem as que uma exceção declara. */
function compararFotos(antes: readonly ItemDaFoto[], depois: readonly ItemDaFoto[], excecoes: readonly ExcecaoDoConferir[]): Divergencia[] {
  const contagemAntes = contar(antes)
  const contagemDepois = contar(depois)
  const grupos = new Set([...contagemAntes.keys(), ...contagemDepois.keys()])
  return [...grupos].sort().flatMap((grupo) => diferencas(grupo, contagemAntes.get(grupo), contagemDepois.get(grupo))).filter((divergencia) => !coberta(divergencia, excecoes))
}

// ---- o comando -------------------------------------------------------------------------------------------------------

function textoDoResultado(divergencias: readonly Divergencia[], itens: number): string {
  if (divergencias.length === 0) return `conferir: verde. ${String(itens)} itens na foto de antes, nenhuma diferença que o mapa não explique.`
  const linhas = divergencias.slice(0, LIMITE_DE_LINHAS).map((d) => `- ${d.lado} ${d.categoria} em ${d.arquivo}: ${JSON.stringify(d.valor)}`)
  const resto = divergencias.length - linhas.length
  return [`conferir: VERMELHO. ${String(divergencias.length)} diferenças que o mapa não explica:`, ...linhas, ...(resto > 0 ? [`… e mais ${String(resto)}`] : [])].join('\n')
}

/** Cada pasta da foto tem de ter arquivo no `HEAD`: foto vazia confere nada e passaria. */
function exigirFotoCompleta(arquivos: ReadonlyMap<string, string>): void {
  for (const raiz of RAIZES_DA_FOTO) {
    if (![...arquivos.keys()].some((caminho) => caminho.startsWith(raiz))) throw new Error(`a foto do HEAD não tem arquivo em ${raiz}: o conferir não tem o que comparar`)
  }
}

export function conferir(raiz: string, caminhoDoMapa: string): ResultadoDoConferir {
  if (!existsSync(raiz)) throw new Error(`${raiz} não existe`)
  const mapa = lerMapa(join(raiz, caminhoDoMapa))
  const invalidas = validarMapa(mapa)
  if (invalidas.length > 0) throw new Error(`mapa inválido:\n${invalidas.map((recusa) => `- ${recusa.detalhe}`).join('\n')}`)
  const doHead = lerDoHead(raiz)
  exigirFotoCompleta(doHead)
  const antes = aplicarMapaAFoto(fotoDe(doHead), mapa, nomesDosPacotesDasEntradas(raiz, mapa))
  const divergencias = compararFotos(antes, fotoDe(lerDaArvore(raiz)), mapa.excecoesDoConferir)
  return { codigo: divergencias.length === 0 ? 0 : 1, divergencias, texto: textoDoResultado(divergencias, antes.length) }
}

if (import.meta.filename === process.argv[1]) {
  const { values } = parseArgs({ options: { mapa: { type: 'string' } } })
  if (values.mapa === undefined) {
    process.stderr.write('uso: node tools/renomear/conferir.ts --mapa tools/renomear/mapas/<N>.json\n')
    process.exitCode = 2
  } else {
    try {
      const resultado = conferir(process.cwd(), values.mapa)
      process.stdout.write(`${resultado.texto}\n`)
      process.exitCode = resultado.codigo
    } catch (erro) {
      process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`)
      process.exitCode = 2
    }
  }
}
