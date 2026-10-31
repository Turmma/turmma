import { isAbsolute, join, relative, sep } from 'node:path'
import ts from 'typescript'
import type { Arvore } from './arvore.ts'
import { PASTA_DO_PROTOTIPO } from './ast.ts'

/**
 * Um serviço de linguagem do TypeScript por `tsconfig` (passo 1 do `aplicar`): a raiz, `e2e/`, `infra/` e cada workspace.
 * O serviço lê os arquivos da árvore em memória, e não do disco: o rename seguinte enxerga o que o anterior já escreveu, e o
 * arquivo que mudou de lugar aparece no lugar novo. O que não é da árvore (`node_modules`, a biblioteca do `typescript`) vem do disco.
 */

export interface Projeto {
  /** O `tsconfig.json`, a partir da raiz do repositório. */
  config: string
  servico: ts.LanguageService
  /**
   * O mesmo `tsconfig` sem nenhum arquivo de código: o programa dele é só a biblioteca. Serve ao `getEditsForFileRename` que quer
   * as edições do `files`/`include`/`exclude`, que saem da configuração e não do programa, sem pagar o programa inteiro.
   */
  servicoDaConfiguracao: ts.LanguageService
}

const PASTAS_FORA = new RegExp(`(^|/)(${PASTA_DO_PROTOTIPO}|node_modules|__fixtures__|fixtures)/`)
// O registro de documentos é do processo: os arquivos da biblioteca (`lib.*.d.ts`) são analisados uma vez só.
const REGISTRO = ts.createDocumentRegistry()
const FORMATACAO = ts.getDefaultFormatCodeSettings()

export const paraAbsoluto = (arvore: Arvore, caminho: string): string => join(arvore.raiz, caminho)

// O serviço de linguagem pergunta a versão de todo arquivo do programa a cada `getProgram()`, e o `getEditsForFileRename` chama o
// `getProgram()` muitas vezes por dentro: sem lembrar a resposta, o `path.relative` desta função dominava o custo do move.
// A resposta só depende da raiz e do texto do caminho, por isso a memória é por árvore.
const RELATIVOS = new WeakMap<Arvore, Map<string, string | undefined>>()

function calcularRelativo(arvore: Arvore, absoluto: string): string | undefined {
  if (!isAbsolute(absoluto)) return undefined
  const caminho = relative(arvore.raiz, absoluto)
  return caminho === '' || caminho.startsWith('..') || isAbsolute(caminho) ? undefined : caminho.split(sep).join('/')
}

/** O caminho do repositório (com `/`), ou `undefined` se o arquivo está fora da raiz. */
export function paraRelativo(arvore: Arvore, absoluto: string): string | undefined {
  let lembrados = RELATIVOS.get(arvore)
  if (lembrados === undefined) {
    lembrados = new Map()
    RELATIVOS.set(arvore, lembrados)
  }
  if (lembrados.has(absoluto)) return lembrados.get(absoluto)
  const caminho = calcularRelativo(arvore, absoluto)
  lembrados.set(absoluto, caminho)
  return caminho
}

function leitorDaArvore(arvore: Arvore) {
  /** `undefined` quando o arquivo não é da árvore, e o disco decide. */
  const daArvore = (absoluto: string): { existe: boolean; texto?: string } | undefined => {
    const caminho = paraRelativo(arvore, absoluto)
    if (caminho === undefined || !arvore.conhece(caminho)) return undefined
    const texto = arvore.lerOuNada(caminho)
    return texto === undefined ? { existe: arvore.existe(caminho) } : { existe: true, texto }
  }
  return {
    fileExists: (absoluto: string): boolean => daArvore(absoluto)?.existe ?? ts.sys.fileExists(absoluto),
    readFile: (absoluto: string): string | undefined => {
      const achado = daArvore(absoluto)
      return achado === undefined ? ts.sys.readFile(absoluto) : achado.texto
    },
    directoryExists: (absoluto: string): boolean => {
      const caminho = paraRelativo(arvore, absoluto)
      return (caminho !== undefined && arvore.temPasta(caminho)) || ts.sys.directoryExists(absoluto)
    },
    /** O link simbólico do workspace (`node_modules/@educa/x`) aponta para o disco: o resultado volta ao lugar de hoje. */
    realpath: (absoluto: string): string => {
      const real = ts.sys.realpath?.(absoluto) ?? absoluto
      const caminho = paraRelativo(arvore, real)
      const atual = caminho === undefined ? undefined : arvore.atual(caminho)
      return atual === undefined ? real : paraAbsoluto(arvore, atual)
    },
  }
}

function criarHost(arvore: Arvore, config: string, opcoes: ts.CompilerOptions, nomes: readonly string[]): ts.LanguageServiceHost {
  const leitor = leitorDaArvore(arvore)
  const diretorio = paraAbsoluto(arvore, config.slice(0, Math.max(0, config.lastIndexOf('/'))))
  return {
    getScriptFileNames: () =>
      nomes.flatMap((absoluto) => {
        const caminho = paraRelativo(arvore, absoluto)
        const atual = caminho === undefined ? absoluto : arvore.atual(caminho)
        return atual === undefined ? [] : [caminho === undefined ? absoluto : paraAbsoluto(arvore, atual)]
      }),
    getScriptVersion: (absoluto) => {
      const caminho = paraRelativo(arvore, absoluto)
      return String(caminho === undefined ? 0 : arvore.versao(caminho))
    },
    getScriptSnapshot: (absoluto) => {
      const texto = leitor.readFile(absoluto)
      return texto === undefined ? undefined : ts.ScriptSnapshot.fromString(texto)
    },
    getCurrentDirectory: () => diretorio,
    getCompilationSettings: () => opcoes,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    useCaseSensitiveFileNames: () => true,
    readDirectory: ts.sys.readDirectory,
    getDirectories: ts.sys.getDirectories,
    ...leitor,
  }
}

function abrirUm(arvore: Arvore, config: string): Projeto | undefined {
  const lido = ts.getParsedCommandLineOfConfigFile(paraAbsoluto(arvore, config), undefined, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined })
  if (lido === undefined) return undefined
  return {
    config,
    servico: ts.createLanguageService(criarHost(arvore, config, lido.options, lido.fileNames), REGISTRO),
    servicoDaConfiguracao: ts.createLanguageService(criarHost(arvore, config, lido.options, []), REGISTRO),
  }
}

/** Todo `tsconfig.json` versionado, menos o do protótipo e o das fixtures. O serviço só monta o programa quando alguém pergunta. */
export function abrirProjetos(arvore: Arvore): Projeto[] {
  const configs = arvore.caminhos().filter((caminho) => /(^|\/)tsconfig\.json$/.test(caminho) && !PASTAS_FORA.test(caminho))
  return configs.flatMap((config) => abrirUm(arvore, config) ?? [])
}

export const formatacao = FORMATACAO
