import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Guarda "o executor de IA só na bancada" (reengenharia-continuacao, 5.0; `techspec.md` §13): o provedor de modelo, o processador da execução
 * e o worker de IA só se montam em `apps/api/test/fila-de-ia.fixture.ts`. Suíte que troca o provedor por `overrideProvider`, que o põe num
 * `useValue`, que o reexporta, que o importa com `import()` ou que o pede por texto monta uma IA que o produto não tem, e o que ela prova
 * não vale para o `main-worker`. O que a suíte precisa de diferente (um modelo de mentira, a execução presa) pede à bancada: `comModelo`, `segurar`.
 *
 * A guarda lê o texto, sem os comentários: o nome do alvo em qualquer outro lugar de um arquivo de teste, em `import`, em `export … from`, em `import()`
 * ou entre aspas, é violação. E ela falha se o alvo some (o nome renomeado na fonte, ou a bancada apagada): a lista vazia nunca é "nada a cobrar".
 */

export const CAMINHO_DA_BANCADA = 'apps/api/test/fila-de-ia.fixture.ts'

/** O que só a bancada alcança, e o arquivo de produção que o define: se a definição some, o nome na guarda ficou sem alvo. */
export const ALVOS_DA_BANCADA: ReadonlyArray<{ readonly nome: string; readonly definidoEm: string }> = [
  { nome: 'LLM_PROVIDER', definidoEm: 'apps/api/src/ia/ia.module.ts' },
  { nome: 'ExecucaoProcessor', definidoEm: 'apps/api/src/ia/execucao.processor.ts' },
  { nome: 'createWorkerDeIa', definidoEm: 'apps/api/src/ia/worker-de-ia.ts' },
  { nome: 'IaDoWorkerModule', definidoEm: 'apps/api/src/ia/ia-do-worker.module.ts' },
  { nome: 'InProcessAgenteExecutor', definidoEm: '' },
  { nome: 'EXECUTOR_DE_AGENTE', definidoEm: '' },
]

/** Os arquivos que um `import` alcança sem citar o nome do alvo (o `import()` de um arquivo, o `export *`, o caminho relativo da mesma pasta): o nome do arquivo, sem pasta nem extensão, em apps/api/src/ia/. */
export const MODULOS_DA_BANCADA = ['execucao.processor', 'worker-de-ia', 'ia-do-worker.module'] as const

export interface ArquivoLido {
  /** Caminho a partir da raiz, com `/`. */
  readonly caminho: string
  readonly texto: string
}

export interface Violacao {
  readonly arquivo: string
  readonly alvo: string
}

const semOsComentarios = (texto: string): string => texto.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1')

/** Arquivo de teste: `*.test.ts`, `*.fixture.ts` e o que mora numa pasta `test/`, fora a própria bancada. */
export function ehArquivoDeTeste(caminho: string): boolean {
  if (caminho === CAMINHO_DA_BANCADA) return false
  return /\.(test|fixture)\.tsx?$/u.test(caminho) || /(^|\/)(test|e2e)\//u.test(caminho)
}

const ehNome = (texto: string, nome: string): boolean => new RegExp(`(?<![A-Za-z0-9_$])${nome}(?![A-Za-z0-9_$])`, 'u').test(texto)

/** Os arquivos de teste que alcançam o que é só da bancada. */
export function verificarExecutorNaBancada(arquivos: readonly ArquivoLido[]): Violacao[] {
  const violacoes: Violacao[] = []
  for (const arquivo of arquivos) {
    if (!ehArquivoDeTeste(arquivo.caminho)) continue
    const texto = semOsComentarios(arquivo.texto)
    for (const { nome } of ALVOS_DA_BANCADA) if (ehNome(texto, nome)) violacoes.push({ arquivo: arquivo.caminho, alvo: nome })
    for (const modulo of MODULOS_DA_BANCADA) if (texto.includes(modulo)) violacoes.push({ arquivo: arquivo.caminho, alvo: modulo })
  }
  return violacoes
}

/** O alvo que sumiu: a bancada apagada, ou o nome que a guarda cobra e a definição já não tem. Vazio quando tudo está onde a guarda espera. */
export function alvosQueSumiram(raiz: string): string[] {
  const sumidos: string[] = []
  if (!existsSync(join(raiz, CAMINHO_DA_BANCADA))) sumidos.push(CAMINHO_DA_BANCADA)
  for (const { nome, definidoEm } of ALVOS_DA_BANCADA) {
    if (definidoEm === '') continue
    const caminho = join(raiz, definidoEm)
    if (!existsSync(caminho) || !ehNome(readFileSync(caminho, 'utf8'), nome)) sumidos.push(`${nome} em ${definidoEm}`)
  }
  for (const modulo of MODULOS_DA_BANCADA) if (!existsSync(join(raiz, 'apps/api/src/ia', `${modulo}.ts`))) sumidos.push(modulo)
  return sumidos
}

const PASTAS_IGNORADAS = new Set(['node_modules', 'dist', '.git', '__fixtures__', 'build', 'coverage'])

/** Todo `.ts` e `.tsx` de `apps` e `e2e` a partir da raiz, com o caminho relativo. */
export function lerArquivosDeTeste(raiz: string): ArquivoLido[] {
  const lidos: ArquivoLido[] = []
  const percorrer = (pasta: string): void => {
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      if (PASTAS_IGNORADAS.has(entrada.name)) continue
      const completo = join(pasta, entrada.name)
      if (entrada.isDirectory()) percorrer(completo)
      else if (/\.tsx?$/u.test(entrada.name)) lidos.push({ caminho: relative(raiz, completo).split(sep).join('/'), texto: readFileSync(completo, 'utf8') })
    }
  }
  for (const base of ['apps', 'e2e']) if (existsSync(join(raiz, base))) percorrer(join(raiz, base))
  return lidos.filter((arquivo) => ehArquivoDeTeste(arquivo.caminho))
}
