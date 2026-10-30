import ts from 'typescript'
import type { Arvore } from './arvore.ts'
import { analisar, aplicarTrocas, ehCodigo, ehNomeDeFora, ehNomeDeMembro, identificadorEm } from './ast.ts'
import type { EntradaDoMapa, Recusa } from './mapa.ts'
import { paraAbsoluto, paraRelativo, type Projeto } from './projetos.ts'

/**
 * Passo 2 do `aplicar`: o rename do símbolo pelo serviço de linguagem (`findRenameLocations`), em cada `tsconfig` que enxerga a
 * declaração, com as ocorrências juntas sem repetir. Duas diferenças do rename do editor, de propósito:
 * - o rename atravessa o `export { x } from` e o `import { x }`, e por isso roda sem o `providePrefixAndSuffixTextForRename`; a
 *   forma curta `{ esquemaTurma }`, onde o nome é também a chave, é refeita aqui como `{ esquemaTurma: turmaSchema }`;
 * - o `para` que já é nome do escopo de um arquivo é recusa (a recusa 2), ou o `alias` do import.
 */

export interface Declaracao {
  arquivo: string
  /** O início do identificador do nome. */
  inicio: number
  /** Método, propriedade ou membro de enum: o `com` do módulo dinâmico, e não uma declaração de topo. */
  membro: boolean
  /** O `para` já é nome de outro membro do mesmo tipo. */
  colideNoTipo: boolean
}

/** O membro que pode ter nome: o da classe, o da interface e o do enum. */
interface Membro {
  name?: ts.Node | undefined
}

function membrosDe(declaracao: ts.Statement): readonly Membro[] | undefined {
  if (ts.isClassDeclaration(declaracao) || ts.isInterfaceDeclaration(declaracao)) return declaracao.members
  return ts.isEnumDeclaration(declaracao) ? declaracao.members : undefined
}

interface Achado {
  no: ts.Identifier
  membro: boolean
  colideNoTipo: boolean
}

/** Os nomes que a declaração de topo introduz: o dela, ou o de cada variável do `const a = 1, b = 2`. */
function nomesDaDeclaracao(declaracao: ts.Statement): Array<ts.Node | undefined> {
  if (ts.isVariableStatement(declaracao)) return declaracao.declarationList.declarations.map((variavel) => variavel.name)
  const comNome = ts.isClassDeclaration(declaracao) || ts.isInterfaceDeclaration(declaracao) || ts.isEnumDeclaration(declaracao) || ts.isTypeAliasDeclaration(declaracao) || ts.isFunctionDeclaration(declaracao) || ts.isModuleDeclaration(declaracao)
  return comNome ? [declaracao.name] : []
}

function achadoDe(nome: ts.Node | undefined, de: string, membro: boolean, colideNoTipo: boolean): Achado[] {
  return nome !== undefined && ts.isIdentifier(nome) && nome.text === de ? [{ no: nome, membro, colideNoTipo }] : []
}

function achadosDaDeclaracao(declaracao: ts.Statement, de: string, para: string): Achado[] {
  const achados = nomesDaDeclaracao(declaracao).flatMap((nome) => achadoDe(nome, de, false, false))
  const membros = membrosDe(declaracao) ?? []
  const colide = membros.some((membro) => membro.name !== undefined && ts.isIdentifier(membro.name) && membro.name.text === para)
  return [...achados, ...membros.flatMap((membro) => achadoDe(membro.name, de, true, colide))]
}

function declaracoesDeTopo(declaracoes: readonly ts.Statement[], de: string, para: string): Achado[] {
  return declaracoes.flatMap((declaracao) => {
    const dentro = ts.isModuleDeclaration(declaracao) && declaracao.body !== undefined && ts.isModuleBlock(declaracao.body) ? declaracoesDeTopo(declaracao.body.statements, de, para) : []
    return [...achadosDaDeclaracao(declaracao, de, para), ...dentro]
  })
}

/** Onde o `de` é declarado: no `arquivo` da entrada, ou, sem ele, em toda declaração com o nome. */
export function acharDeclaracoes(arvore: Arvore, entrada: EntradaDoMapa): Declaracao[] {
  const candidatos = entrada.arquivo === undefined ? arvore.caminhos().filter(ehCodigo) : [entrada.arquivo]
  return candidatos.flatMap((arquivo) => {
    const texto = arvore.lerOuNada(arquivo)
    if (texto === undefined || !texto.includes(entrada.de)) return []
    return declaracoesDeTopo(analisar(arquivo, texto).statements, entrada.de, entrada.para).map(({ no, membro, colideNoTipo }) => ({
      arquivo,
      inicio: no.getStart(),
      membro,
      colideNoTipo,
    }))
  })
}

interface Local {
  arquivo: string
  inicio: number
  comprimento: number
  projeto: Projeto
  declaracao: Declaracao
}

/** As ocorrências do símbolo em todos os projetos que enxergam a declaração, sem repetir. */
function coletarLocais(arvore: Arvore, projetos: readonly Projeto[], declaracoes: readonly Declaracao[], de: string): Local[] {
  const locais = new Map<string, Local>()
  for (const declaracao of declaracoes) {
    const absoluto = paraAbsoluto(arvore, declaracao.arquivo)
    const enxergam = projetos.filter((projeto) => projeto.servico.getProgram()?.getSourceFile(absoluto) !== undefined)
    if (enxergam.length === 0) throw new Error(`nenhum tsconfig enxerga ${declaracao.arquivo}: o rename de "${de}" ficaria pela metade`)
    for (const projeto of enxergam) {
      const achados = projeto.servico.findRenameLocations(absoluto, declaracao.inicio, false, false, { providePrefixAndSuffixTextForRename: false }) ?? []
      for (const achado of achados) {
        const arquivo = paraRelativo(arvore, achado.fileName)
        if (arquivo === undefined || !arvore.existe(arquivo)) continue
        const chave = `${arquivo}:${String(achado.textSpan.start)}`
        if (!locais.has(chave)) locais.set(chave, { arquivo, inicio: achado.textSpan.start, comprimento: achado.textSpan.length, projeto, declaracao })
      }
    }
  }
  return [...locais.values()]
}

/** O `resolveName` do verificador não está na API pública, mas é o que o serviço de linguagem usa para saber o que um nome alcança. */
interface VerificadorComResolucao {
  resolveName(nome: string, local: ts.Node | undefined, significado: ts.SymbolFlags, excluirGlobais: boolean): ts.Symbol | undefined
}

const SIGNIFICADO = ts.SymbolFlags.Value | ts.SymbolFlags.Type | ts.SymbolFlags.Namespace

function resolverNome(verificador: ts.TypeChecker, nome: string, no: ts.Node): ts.Symbol | undefined {
  const interno = verificador as unknown as Partial<VerificadorComResolucao>
  if (typeof interno.resolveName !== 'function') throw new Error('o typescript instalado não expõe resolveName: a colisão do rename não pode ser conferida')
  return interno.resolveName.call(verificador, nome, no, SIGNIFICADO, false)
}

function ehOMesmoSimbolo(verificador: ts.TypeChecker, achado: ts.Symbol, alvo: ts.Symbol | undefined): boolean {
  const final = (achado.flags & ts.SymbolFlags.Alias) !== 0 ? verificador.getAliasedSymbol(achado) : achado
  return alvo !== undefined && final === alvo
}

/** O nome da ocorrência no programa do projeto, ou nada quando ela é membro ou nome de fora (não colide com escopo). */
function nomeDaOcorrencia(arvore: Arvore, local: Local): { programa: ts.Program; fonte: ts.SourceFile; no: ts.Identifier } | undefined {
  const programa = local.projeto.servico.getProgram()
  const fonte = programa?.getSourceFile(paraAbsoluto(arvore, local.arquivo))
  if (programa === undefined || fonte === undefined) return undefined
  const no = identificadorEm(fonte, local.inicio)
  return no === undefined || ehNomeDeMembro(no) || ehNomeDeFora(no) ? undefined : { programa, fonte, no }
}

/** O `para` já é um nome do escopo da ocorrência (ou membro de mesmo nome, na declaração de membro). */
function colideNaOcorrencia(arvore: Arvore, local: Local, para: string): boolean {
  if (local.declaracao.membro) return local.declaracao.colideNoTipo
  const ocorrencia = nomeDaOcorrencia(arvore, local)
  if (ocorrencia === undefined) return false
  const { programa, fonte, no } = ocorrencia
  const verificador = programa.getTypeChecker()
  const achado = resolverNome(verificador, para, no)
  if (achado === undefined) return false
  const fonteDaDeclaracao = programa.getSourceFile(paraAbsoluto(arvore, local.declaracao.arquivo)) ?? fonte
  const nomeDeclarado = identificadorEm(fonteDaDeclaracao, local.declaracao.inicio)
  return !ehOMesmoSimbolo(verificador, achado, nomeDeclarado === undefined ? undefined : verificador.getSymbolAtLocation(nomeDeclarado))
}

/** Os arquivos onde o `para` já é um nome do escopo de alguma ocorrência. */
function arquivosComColisao(arvore: Arvore, locais: readonly Local[], para: string): Set<string> {
  const colidem = new Set<string>()
  for (const local of locais) {
    const arquivo = local.declaracao.membro ? local.declaracao.arquivo : local.arquivo
    if (!colidem.has(arquivo) && colideNaOcorrencia(arvore, local, para)) colidem.add(arquivo)
  }
  return colidem
}

/** A forma curta (`{ nome }`, `const { nome } = x`): o nome é também a chave, e a chave fica. */
function ehFormaCurta(no: ts.Identifier): boolean {
  const pai = no.parent
  if (ts.isShorthandPropertyAssignment(pai)) return pai.name === no
  return ts.isBindingElement(pai) && pai.name === no && pai.propertyName === undefined && ts.isObjectBindingPattern(pai.parent)
}

/** No arquivo que colide, o import traz o `para` com o `alias`, e o resto do arquivo usa o `alias`. */
function textoDoAlias(no: ts.Identifier, entrada: EntradaDoMapa, alias: string): string {
  const pai = no.parent
  if (ts.isImportSpecifier(pai) && pai.propertyName === undefined && pai.name === no) return `${entrada.para} as ${alias}`
  return ts.isImportSpecifier(pai) && pai.propertyName === no ? entrada.para : alias
}

/** O texto que entra no lugar do nome: o `para`, o `alias` no arquivo que colide, e a chave mantida na forma curta. */
function textoNovo(no: ts.Identifier | undefined, entrada: EntradaDoMapa, comAlias: boolean, membro: boolean): string {
  const nome = comAlias && entrada.alias !== undefined ? entrada.alias : entrada.para
  if (no === undefined) return nome
  if (!membro && ehFormaCurta(no)) return `${entrada.de}: ${nome}`
  return comAlias && entrada.alias !== undefined ? textoDoAlias(no, entrada, entrada.alias) : nome
}

function aplicarNosArquivos(arvore: Arvore, locais: readonly Local[], entrada: EntradaDoMapa, colidem: ReadonlySet<string>): void {
  const porArquivo = new Map<string, Local[]>()
  for (const local of locais) porArquivo.set(local.arquivo, [...(porArquivo.get(local.arquivo) ?? []), local])
  for (const [arquivo, doArquivo] of porArquivo) {
    const texto = arvore.ler(arquivo)
    const fonte = analisar(arquivo, texto)
    const comAlias = colidem.has(arquivo) && entrada.alias !== undefined
    const trocas = doArquivo
      .filter((local) => texto.slice(local.inicio, local.inicio + local.comprimento) === entrada.de)
      .map((local) => ({
        inicio: local.inicio,
        comprimento: local.comprimento,
        novo: textoNovo(identificadorEm(fonte, local.inicio), entrada, comAlias, local.declaracao.membro),
      }))
    arvore.escrever(arquivo, aplicarTrocas(texto, trocas))
  }
}

/** Renomeia o símbolo na árvore. Devolve as recusas, e nesse caso a árvore não foi tocada por esta entrada. */
export function renomearSimbolo(arvore: Arvore, projetos: readonly Projeto[], entrada: EntradaDoMapa, declaracoes: readonly Declaracao[]): Recusa[] {
  const locais = coletarLocais(arvore, projetos, declaracoes, entrada.de)
  const colidem = arquivosComColisao(arvore, locais, entrada.para)
  const semAlias = [...colidem].filter((arquivo) => entrada.alias === undefined || declaracoes.some((declaracao) => declaracao.arquivo === arquivo))
  if (semAlias.length > 0) {
    return semAlias.map((arquivo) => ({ codigo: 'colisao', detalhe: `"${entrada.para}" já é um nome no escopo de ${arquivo}, e a entrada de "${entrada.de}" não tem alias` }))
  }
  aplicarNosArquivos(arvore, locais, entrada, colidem)
  return []
}
