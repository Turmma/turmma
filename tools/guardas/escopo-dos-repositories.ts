import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO } from '../../packages/core/src/db/unscoped.decorator.ts'

/**
 * Trava de tenant (regra 10, itens 3, 5 e 9; RF9 da X5): todo método público de `*.repository.ts` que toca o banco prova o
 * escopo, ou declara a exceção com motivo. Por AST, com o `typescript` da raiz, e não por texto: a chamada em comentário ou
 * em string não vale, a cópia local do mesmo nome não vale, o alias vale.
 *
 * "Método público" é o método, o acessor e a propriedade-função sem `private`, `protected` nem `#`, e a função exportada do
 * módulo. "Toca o banco" é usar `this.<campo>` (campo de tipo `TIPOS_DO_BANCO`) ou um parâmetro desses tipos, direto ou por
 * ajudante do mesmo arquivo: passar o banco a uma função de outro arquivo também é tocar.
 *
 * A prova é uma de três:
 * - (a) chama uma função de `PROVAS_DE_ESCOPO`, importada, direto ou por ajudante do mesmo arquivo;
 * - (b) tem `@Unscoped(<motivo>)`, com motivo estático de pelo menos 30 caracteres: texto, soma de textos ou `const` do
 *   mesmo arquivo com um desses;
 * - (c) está em `REPOSITORIES_SEM_ESCOPO`, com `motivo` de pelo menos 30 caracteres.
 *
 * **O limite declarado:** a prova (a) vê a chamada, não o uso: `requireEscolaId()` chamada e jogada fora passa, e o
 * `where` sem o `escolaId` também. Quem prova o `where` é o teste de isolamento de cada repository; este teste só impede
 * que um repository nasça sem nenhuma das três coisas.
 *
 * **Outros limites declarados** (nenhum existe hoje no código; cada um passa sem acusação):
 * - só são lidos os arquivos `*.repository.ts` e os que declaram `class *Repository`: uma função de outro arquivo que receba
 *   `Database` e consulte, como a de `homonimo.ts`, fica fora da trava;
 * - só é função exportada a que traz `export` na própria declaração: `function f() {}` seguida de `export { f }` ou de
 *   `export default f` não é vista;
 * - o parâmetro desestruturado, como `({ banco }: { banco: Database })`, não é visto: o nome que se guarda é o texto do padrão
 *   (`{ banco }`), e o uso de `banco` no corpo não bate com ele;
 * - o tipo do banco é reconhecido pelo nome (`TIPOS_DO_BANCO`): o alias local, como `type Db = Database`, não é.
 */

/** As funções que lêem o escopo do contexto autenticado (ou do job) em vez de recebê-lo por argumento. */
export const PROVAS_DE_ESCOPO: ReadonlySet<string> = new Set(['requireEscolaId', 'requestIdentity', 'jobScopeInContext'])

/**
 * Os tipos que fazem uma propriedade ou um parâmetro ser "o banco": `this.banco`, `this.tx`, `tx: DatabaseTransaction`.
 * `DatabaseExecutor` é o banco ou a transação de quem chama, e é como o `AuditoriaRepository` e o `RedeEEscolaRepository` o recebem.
 */
export const TIPOS_DO_BANCO: ReadonlySet<string> = new Set(['Database', 'DatabaseTransaction', 'DatabaseExecutor'])

export interface EntradaSemEscopo {
  /** Caminho a partir da raiz do repositório, com `/`. */
  arquivo: string
  /** Por que estes métodos não têm escopo de escola. */
  motivo: string
  /** Só estes métodos: o resto do arquivo continua obrigado a provar. */
  metodos: readonly string[]
}

/**
 * Os métodos públicos sem escopo de escola que ainda existem, por arquivo e por método, cada um com a evidência no motivo.
 * **Só encolhe:** entrada de arquivo ou de método que não existe, ou que já prova o escopo, reprova.
 */
export const REPOSITORIES_SEM_ESCOPO: readonly EntradaSemEscopo[] = [
  {
    arquivo: 'apps/api/src/assistente/turma-do-professor.repository.ts',
    motivo: 'monta subconsulta SQL ligada à coluna de escola da linha de quem chama, e não executa nada; quem a embute prova o escopo',
    metodos: ['comVinculoConfirmadoDoProfessor', 'disciplinaDoArtefato', 'disciplinaDaEntrega'],
  },
  {
    arquivo: 'apps/api/src/ia/execucao.repository.ts',
    motivo: 'a escola vem de execucao.escolaId, do pedido que o agendador montou, e não do contexto; sai quando a 47.0 trocar a origem (R39)',
    metodos: ['marcarRodando', 'marcarConcluida', 'concluirRodando', 'marcarFalhou'],
  },
  {
    arquivo: 'apps/api/src/operacao/operador/operador.repository.ts',
    motivo: 'as tabelas da operação Turmma são da equipe e não têm escola_id: nenhum método do OperadorRepository tem escopo de escola a aplicar',
    metodos: ['autorAtivoNaTransacao', 'travarOperadores', 'situacaoDoAutor', 'ativoParaAtualizar', 'contarAtivos', 'criar', 'criarConvite', 'revogarConvitePendente', 'desativar', 'apagarCodigosDeRecuperacao', 'encerrarSessoes', 'lerSessaoParaGuarda', 'marcarUsoDaSessao', 'sessaoParaRenovar', 'rotacionarSessao', 'encerrarSessao', 'encerrarSessaoPelaSaida', 'daSessao', 'conviteValidoPorHash', 'aceitarConvite', 'gravarSegredoParaConfigurar', 'trocarCodigosDeRecuperacao', 'ativoParaSegundoFator', 'avancarPassoDoSegundoFator', 'usarCodigoDeRecuperacao', 'ativarSegundoFator', 'abrirSessao', 'credencialDeEntrada', 'registrarFalhaDeEntrada', 'registrarAcesso', 'auditar'],
  },
  {
    arquivo: 'apps/api/src/ops/operacao-privacidade.repository.ts',
    motivo: 'suboperador e incidente são da operação e não têm escola_id; só ligarEscola e ligarEscolaAoIncidente gravam por escola, e leem o contexto',
    metodos: ['cadastrar', 'travarVigente', 'encerrar', 'registrarIncidente'],
  },
  {
    arquivo: 'apps/api/src/privacidade/titulares.repository.ts',
    motivo: 'repassa o banco a haHomonimoDoTitular (nucleo/titular/homonimo.ts), que lê exigirEscolaDoContexto; a prova mora em outro arquivo, e a guarda não a segue',
    metodos: ['homonimo'],
  },
  {
    arquivo: 'packages/core/src/auditoria/auditoria.repository.ts',
    motivo: 'lê contextoAtual()?.escolaId no próprio método e recusa sem escola, com AuditoriaRecusada: é a cópia local, com erro próprio',
    metodos: ['listarDaEscola'],
  },
  {
    arquivo: 'packages/core/src/auditoria/auditoria-insert.repository.ts',
    motivo: 'grava a escola do contexto, e escola nula nas ações da operação global (check auditoria_escola_ou_operacao_global); a escola nula é legítima aqui',
    metodos: ['insertAuditoria'],
  },
  {
    arquivo: 'packages/core/src/queue/job-outbox.repository.ts',
    motivo: 'a escola, ou a falta dela nos jobs sistema.*, vem de contextoAtual() e do escopoDoJobNoContexto definido neste arquivo, que a guarda só conta quando importado',
    metodos: ['inserir', 'inserirUmaVez', 'buscarDaEscola', 'localizarParaExecucao', 'iniciarExecucao', 'concluir', 'avisarVagaLivre', 'registrarFalha'],
  },
  {
    arquivo: 'packages/core/src/identidade/sessao.repository.ts',
    motivo: 'é a leitura que cria o contexto da requisição: o escopo é a escola e a sessão do TokenVerificado, e não há contexto para ler',
    metodos: ['lerParaGuarda', 'marcarAtualApresentado'],
  },
  {
    arquivo: 'packages/core/src/titular/compartilhamento.repository.ts',
    motivo: 'só calcula duas datas pela aritmética do banco, sem ler tabela nenhuma: não há escola a aplicar',
    metodos: ['datasDeReferencia'],
  },
]

export interface ArquivoFonte {
  /** Caminho a partir da raiz do repositório, com `/`. */
  caminho: string
  texto: string
}

export type CodigoDeViolacao =
  | 'erro-de-sintaxe'
  | 'sem-prova-de-escopo'
  | 'motivo-curto'
  | 'motivo-nao-literal'
  | 'repository-fora-do-arquivo'
  | 'lista-arquivo-inexistente'
  | 'lista-metodo-inexistente'
  | 'lista-metodo-conforme'
  | 'lista-motivo-curto'

export interface Violacao {
  arquivo: string
  /** A linha do nome do método ou da classe; 1 quando o erro é do arquivo ou da lista. */
  linha: number
  codigo: CodigoDeViolacao
  /** O que está errado, com o nome do método ou da classe. */
  detalhe: string
}

export interface MetodoPublico {
  /** A classe, ou `(módulo)` para a função exportada. */
  classe: string
  nome: string
  linha: number
  /** Toca o banco, direto ou por ajudante do mesmo arquivo. */
  tocaBanco: boolean
  /** `contexto` é a prova (a), `sem-escopo` é o `@Unscoped` (b) com motivo válido; `null` não prova nada. */
  prova: 'contexto' | 'sem-escopo' | null
  /** O que há de errado com o `@Unscoped` do método, se ele o tem. */
  erroDoDecorator: 'motivo-curto' | 'motivo-nao-literal' | null
}

export interface AnaliseDoArquivo {
  /** `true` se o arquivo não compila como sintaxe: nada mais foi lido. */
  erroDeSintaxe: boolean
  classes: Array<{ nome: string; linha: number }>
  metodos: MetodoPublico[]
}

/** Função, método, acessor ou seta, com o corpo que o analisador percorre. */
type Chamavel = ts.FunctionLikeDeclaration & { readonly body: ts.ConciseBody }
/** O que a classe tem de nome e pode ser público: método, acessor ou propriedade. */
type Membro = ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration | ts.PropertyDeclaration

interface Classe {
  nome: string
  /** `this.<nome>` que é o banco: parâmetro-propriedade ou propriedade com tipo de `TIPOS_DO_BANCO`. */
  bancos: Set<string>
  /** O que `this.<nome>()` alcança: método, acessor ou propriedade-função da classe. */
  membros: Map<string, Chamavel>
}

/** A assinatura de sobrecarga e a declaração sem corpo não têm o que percorrer. */
function temCorpo(no: ts.FunctionLikeDeclaration): no is Chamavel {
  return no.body !== undefined
}

const ehMembro = (elemento: ts.ClassElement): elemento is Membro =>
  ts.isMethodDeclaration(elemento) || ts.isGetAccessorDeclaration(elemento) || ts.isSetAccessorDeclaration(elemento) || ts.isPropertyDeclaration(elemento)

const ehExportado = (no: ts.FunctionDeclaration | ts.VariableStatement): boolean => (ts.getModifiers(no) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

const ehPublico = (membro: Membro): boolean =>
  !(ts.getModifiers(membro) ?? []).some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)

const linhaDe = (fonte: ts.SourceFile, no: ts.Node): number => fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1

function tipoEhOBanco(tipo: ts.TypeNode | undefined): boolean {
  if (tipo === undefined) return false
  let achou = false
  const visitar = (no: ts.Node): void => {
    if (ts.isTypeReferenceNode(no) && ts.isIdentifier(no.typeName) && TIPOS_DO_BANCO.has(no.typeName.text)) achou = true
    ts.forEachChild(no, visitar)
  }
  visitar(tipo)
  return achou
}

/** Os parâmetros do método ou da função que são o banco (`tx: DatabaseTransaction`). */
function parametrosDoBanco(chamavel: Chamavel): Set<string> {
  const nomes = new Set<string>()
  for (const parametro of chamavel.parameters) {
    if (tipoEhOBanco(parametro.type)) nomes.add(parametro.name.getText())
  }
  return nomes
}

/** O corpo que o membro dá a percorrer: o do método e do acessor, ou a seta da propriedade-função. */
function chamavelDoMembro(membro: Membro): Chamavel | undefined {
  if (ts.isPropertyDeclaration(membro)) {
    const inicial = membro.initializer
    return inicial !== undefined && (ts.isArrowFunction(inicial) || ts.isFunctionExpression(inicial)) ? inicial : undefined
  }
  return temCorpo(membro) ? membro : undefined
}

function classeDe(declaracao: ts.ClassDeclaration): Classe {
  const classe: Classe = { nome: declaracao.name?.text ?? '(anônima)', bancos: new Set(), membros: new Map() }
  for (const elemento of declaracao.members) {
    if (ts.isConstructorDeclaration(elemento)) {
      for (const parametro of elemento.parameters) {
        if (ts.isParameterPropertyDeclaration(parametro, elemento) && tipoEhOBanco(parametro.type)) classe.bancos.add(parametro.name.getText())
      }
    } else if (ehMembro(elemento)) {
      const nome = elemento.name.getText()
      if (tipoEhOBanco(elemento.type)) classe.bancos.add(nome)
      const chamavel = chamavelDoMembro(elemento)
      if (chamavel !== undefined) classe.membros.set(nome, chamavel)
    }
  }
  return classe
}

/** O texto que se sabe sem executar: literal, `+` de textos, ou `const` do mesmo arquivo com um desses. */
function valorEstatico(no: ts.Expression, constantes: ReadonlyMap<string, ts.Expression>, vistos: ReadonlySet<string> = new Set()): string | undefined {
  if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) return no.text
  if (ts.isBinaryExpression(no) && no.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const esquerda = valorEstatico(no.left, constantes, vistos)
    const direita = valorEstatico(no.right, constantes, vistos)
    return esquerda === undefined || direita === undefined ? undefined : esquerda + direita
  }
  if (ts.isIdentifier(no)) {
    const inicial = constantes.get(no.text)
    if (inicial === undefined || vistos.has(no.text)) return undefined
    return valorEstatico(inicial, constantes, new Set([...vistos, no.text]))
  }
  return undefined
}

export function analisarFonte(arquivo: ArquivoFonte): AnaliseDoArquivo {
  const fonte = ts.createSourceFile(
    arquivo.caminho,
    arquivo.texto,
    { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseNone },
    true,
    ts.ScriptKind.TS,
  )
  // Campo interno do compilador, como em `tools/processo/revisoes.ts`: se sumir numa versão nova, quebra alto em vez de aceitar tudo.
  if ((fonte as unknown as { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length > 0) return { erroDeSintaxe: true, classes: [], metodos: [] }

  /** Os nomes locais que são `PROVAS_DE_ESCOPO` importadas, e o do `Unscoped` importado: o alias conta, e função local do mesmo nome não. */
  const provasImportadas = new Set<string>()
  const decoratorsSemEscopo = new Set<string>()
  const funcoes = new Map<string, Chamavel>()
  /** As funções de topo exportadas: o ponto de entrada público do módulo, como o método é o da classe. */
  const exportadas = new Map<string, { chamavel: Chamavel; nome: ts.Node }>()
  const constantes = new Map<string, ts.Expression>()
  const declaracoesDeClasse: ts.ClassDeclaration[] = []
  for (const declaracao of fonte.statements) {
    if (ts.isImportDeclaration(declaracao)) {
      const nomeados = declaracao.importClause?.namedBindings
      if (nomeados !== undefined && ts.isNamedImports(nomeados)) {
        for (const elemento of nomeados.elements) {
          const exportado = (elemento.propertyName ?? elemento.name).text
          if (PROVAS_DE_ESCOPO.has(exportado)) provasImportadas.add(elemento.name.text)
          if (exportado === 'Unscoped') decoratorsSemEscopo.add(elemento.name.text)
        }
      }
    } else if (ts.isFunctionDeclaration(declaracao) && temCorpo(declaracao)) {
      const nome = declaracao.name?.text ?? 'default'
      funcoes.set(nome, declaracao)
      if (ehExportado(declaracao)) exportadas.set(nome, { chamavel: declaracao, nome: declaracao.name ?? declaracao })
    } else if (ts.isVariableStatement(declaracao)) {
      const ehConst = (declaracao.declarationList.flags & ts.NodeFlags.Const) !== 0
      for (const variavel of declaracao.declarationList.declarations) {
        const inicial = variavel.initializer
        if (!ts.isIdentifier(variavel.name) || inicial === undefined) continue
        if (ts.isArrowFunction(inicial) || ts.isFunctionExpression(inicial)) {
          funcoes.set(variavel.name.text, inicial)
          if (ehExportado(declaracao)) exportadas.set(variavel.name.text, { chamavel: inicial, nome: variavel.name })
        } else if (ehConst) {
          constantes.set(variavel.name.text, inicial)
        }
      }
    } else if (ts.isClassDeclaration(declaracao)) {
      declaracoesDeClasse.push(declaracao)
    }
  }

  /** O que o método faz, seguindo os ajudantes do mesmo arquivo (`this.x()` da classe e função de topo), uma vez cada. */
  const resumir = (inicio: Chamavel, classeInicial: Classe | undefined): { toca: boolean; prova: boolean } => {
    const resumo = { toca: false, prova: false }
    const visitados = new Set<ts.Node>()
    const pilha: Array<{ chamavel: Chamavel; classe: Classe | undefined }> = [{ chamavel: inicio, classe: classeInicial }]
    for (let atual = pilha.pop(); atual !== undefined; atual = pilha.pop()) {
      const { chamavel, classe } = atual
      if (visitados.has(chamavel)) continue
      visitados.add(chamavel)
      const parametros = parametrosDoBanco(chamavel)
      const visitar = (no: ts.Node): void => {
        if (ts.isPropertyAccessExpression(no) && no.expression.kind === ts.SyntaxKind.ThisKeyword && classe?.bancos.has(no.name.getText()) === true) resumo.toca = true
        if (ts.isIdentifier(no) && parametros.has(no.text) && !(ts.isPropertyAccessExpression(no.parent) && no.parent.name === no)) resumo.toca = true
        if (ts.isCallExpression(no)) {
          const chamado = no.expression
          if (ts.isIdentifier(chamado)) {
            if (provasImportadas.has(chamado.text)) resumo.prova = true
            const ajudante = funcoes.get(chamado.text)
            if (ajudante !== undefined) pilha.push({ chamavel: ajudante, classe: undefined })
          } else if (ts.isPropertyAccessExpression(chamado) && chamado.expression.kind === ts.SyntaxKind.ThisKeyword) {
            const ajudante = classe?.membros.get(chamado.name.getText())
            if (ajudante !== undefined) pilha.push({ chamavel: ajudante, classe })
          }
        }
        ts.forEachChild(no, visitar)
      }
      visitar(chamavel.body)
    }
    return resumo
  }

  /** O `@Unscoped(<motivo>)` do membro: `undefined` se não tem; senão, o erro do motivo ou `null` se ele vale. */
  const decoratorDe = (membro: Membro): null | 'motivo-curto' | 'motivo-nao-literal' | undefined => {
    for (const decorator of ts.getDecorators(membro) ?? []) {
      const chamada = decorator.expression
      if (!ts.isCallExpression(chamada) || !ts.isIdentifier(chamada.expression) || !decoratorsSemEscopo.has(chamada.expression.text)) continue
      const argumento = chamada.arguments.length === 1 ? chamada.arguments[0] : undefined
      const motivo = argumento === undefined ? undefined : valorEstatico(argumento, constantes)
      if (motivo === undefined) return 'motivo-nao-literal'
      return motivo.trim().length < TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO ? 'motivo-curto' : null
    }
    return undefined
  }

  const analise: AnaliseDoArquivo = { erroDeSintaxe: false, classes: [], metodos: [] }
  for (const declaracao of declaracoesDeClasse) {
    const classe = classeDe(declaracao)
    analise.classes.push({ nome: classe.nome, linha: linhaDe(fonte, declaracao.name ?? declaracao) })
    for (const membro of declaracao.members) {
      if (!ehMembro(membro) || !ehPublico(membro) || ts.isPrivateIdentifier(membro.name)) continue
      const chamavel = chamavelDoMembro(membro)
      if (chamavel === undefined) continue
      const { toca, prova } = resumir(chamavel, classe)
      const decorator = decoratorDe(membro)
      analise.metodos.push({
        classe: classe.nome,
        nome: membro.name.getText(),
        linha: linhaDe(fonte, membro.name),
        tocaBanco: toca,
        prova: decorator === null ? 'sem-escopo' : prova ? 'contexto' : null,
        erroDoDecorator: decorator ?? null,
      })
    }
  }
  for (const [nome, { chamavel, nome: noDoNome }] of exportadas) {
    const { toca, prova } = resumir(chamavel, undefined)
    analise.metodos.push({ classe: '(módulo)', nome, linha: linhaDe(fonte, noDoNome), tocaBanco: toca, prova: prova ? 'contexto' : null, erroDoDecorator: null })
  }
  return analise
}

const ehDeRepository = (caminho: string): boolean => caminho.endsWith('.repository.ts')
const MENCIONA_CLASSE_REPOSITORY = /\bclass\s+\w*Repository\b/

/** Tudo que reprova nos arquivos dados, com a lista de exceções dada. Vazio é verde. */
export function verificarRepositories(fontes: readonly ArquivoFonte[], lista: readonly EntradaSemEscopo[]): Violacao[] {
  const violacoes: Violacao[] = []
  const analises = new Map<string, AnaliseDoArquivo>()
  for (const fonte of fontes) {
    if (!ehDeRepository(fonte.caminho) && !MENCIONA_CLASSE_REPOSITORY.test(fonte.texto)) continue
    const analise = analisarFonte(fonte)
    if (analise.erroDeSintaxe) {
      violacoes.push({ arquivo: fonte.caminho, linha: 1, codigo: 'erro-de-sintaxe', detalhe: 'o arquivo não compila como sintaxe, e nada dele foi conferido' })
      continue
    }
    if (!ehDeRepository(fonte.caminho)) {
      for (const classe of analise.classes.filter((c) => c.nome.endsWith('Repository'))) {
        violacoes.push({ arquivo: fonte.caminho, linha: classe.linha, codigo: 'repository-fora-do-arquivo', detalhe: `${classe.nome} mora fora de um *.repository.ts` })
      }
      continue
    }
    analises.set(fonte.caminho, analise)
  }

  const naLista = (arquivo: string, metodo: string): boolean => lista.some((entrada) => entrada.arquivo === arquivo && entrada.metodos.includes(metodo))
  for (const [arquivo, analise] of analises) {
    for (const metodo of analise.metodos) {
      const qual = `${metodo.classe}.${metodo.nome}`
      if (metodo.erroDoDecorator !== null) {
        violacoes.push({
          arquivo,
          linha: metodo.linha,
          codigo: metodo.erroDoDecorator,
          detalhe: `${qual}: o motivo do @Unscoped precisa ser texto de pelo menos ${String(TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO)} caracteres, escrito ali ou numa const do mesmo arquivo`,
        })
      } else if (metodo.tocaBanco && metodo.prova === null && !naLista(arquivo, metodo.nome)) {
        violacoes.push({
          arquivo,
          linha: metodo.linha,
          codigo: 'sem-prova-de-escopo',
          detalhe: `${qual} toca o banco sem ${[...PROVAS_DE_ESCOPO].join(', ')}, sem @Unscoped e fora de REPOSITORIES_SEM_ESCOPO`,
        })
      }
    }
  }

  for (const entrada of lista) {
    const analise = analises.get(entrada.arquivo)
    if (analise === undefined) {
      violacoes.push({ arquivo: entrada.arquivo, linha: 1, codigo: 'lista-arquivo-inexistente', detalhe: 'REPOSITORIES_SEM_ESCOPO cita um *.repository.ts que não existe' })
      continue
    }
    if (entrada.motivo.trim().length < TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO) {
      violacoes.push({ arquivo: entrada.arquivo, linha: 1, codigo: 'lista-motivo-curto', detalhe: `o motivo da lista tem de ter pelo menos ${String(TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO)} caracteres` })
    }
    for (const nome of entrada.metodos) {
      const achados = analise.metodos.filter((metodo) => metodo.nome === nome)
      if (achados.length === 0) {
        violacoes.push({ arquivo: entrada.arquivo, linha: 1, codigo: 'lista-metodo-inexistente', detalhe: `${nome} não é método público do arquivo` })
      } else if (achados.some((metodo) => !metodo.tocaBanco || metodo.prova !== null)) {
        violacoes.push({ arquivo: entrada.arquivo, linha: 1, codigo: 'lista-metodo-conforme', detalhe: `${nome} já prova o escopo, ou nem toca o banco: sai da lista` })
      }
    }
  }
  return violacoes
}

/** Os `.ts` de produção de `apps/*\/src` e `packages/*\/src` (sem teste, sem `.d.ts`), com o caminho a partir da raiz. */
export function lerFontesDeProducao(raiz: string): ArquivoFonte[] {
  const fontes: ArquivoFonte[] = []
  for (const grupo of ['apps', 'packages']) {
    for (const pacote of readdirSync(join(raiz, grupo))) {
      const pastaSrc = join(raiz, grupo, pacote, 'src')
      let entradas: string[]
      try {
        entradas = readdirSync(pastaSrc, { recursive: true, encoding: 'utf8' })
      } catch {
        continue
      }
      for (const entrada of entradas) {
        if (!entrada.endsWith('.ts') || entrada.endsWith('.d.ts') || entrada.endsWith('.test.ts')) continue
        if (entrada.split(sep).some((parte) => parte === 'node_modules' || parte === 'dist')) continue
        const caminho = relative(raiz, join(pastaSrc, entrada)).split(sep).join('/')
        fontes.push({ caminho, texto: readFileSync(join(raiz, caminho), 'utf8') })
      }
    }
  }
  return fontes
}
