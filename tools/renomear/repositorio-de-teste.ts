import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Executor } from './arvore.ts'

/**
 * O repositório de brinquedo dos testes do `aplicar` e do `reaplicar`: um `git init` numa pasta temporária, com a base do
 * `tsconfig`, e os workspaces ligados em `node_modules` como o `npm` os liga. O `npm install` não roda: o executor do teste
 * registra a chamada.
 */

export const TSCONFIG_BASE = {
  compilerOptions: {
    strict: true,
    target: 'es2023',
    lib: ['es2023'],
    module: 'nodenext',
    moduleResolution: 'nodenext',
    customConditions: ['source'],
    noEmit: true,
    allowImportingTsExtensions: true,
    skipLibCheck: true,
    types: [],
  },
}

export const tsconfigDe = (profundidade: number, incluir: string[] = ['src']): string =>
  JSON.stringify({ extends: `${'../'.repeat(profundidade)}tsconfig.base.json`, include: incluir })

/** Um pacote do workspace com a condição `source` na entrada, como `packages/shared` e `packages/nucleo`. */
export const pacoteDeTeste = (nome: string, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ name: nome, type: 'module', exports: { '.': { source: './src/index.ts', default: './dist/index.js' } }, ...extra }, null, 2)

export interface RepositorioDeTeste {
  raiz: string
  ler(caminho: string): string
  existe(caminho: string): boolean
  escrever(caminho: string, conteudo: string): void
  git(...argumentos: string[]): string
  /** `git status --porcelain`: vazio quando a árvore está como o último commit. */
  sujeira(): string
  /** O que o executor de teste foi mandado rodar (`npm install --package-lock-only`), em vez de rodar. */
  comandos: string[]
  executar: Executor
  limpar(): void
}

const PASTAS: string[] = []

function escreverArquivo(raiz: string, caminho: string, conteudo: string): void {
  mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
  writeFileSync(join(raiz, caminho), conteudo)
}

function ligarWorkspaces(raiz: string): void {
  for (const pasta of ['packages', 'apps']) {
    if (!existsSync(join(raiz, pasta))) continue
    for (const nome of readdirSync(join(raiz, pasta))) {
      const manifesto = join(raiz, pasta, nome, 'package.json')
      if (!existsSync(manifesto)) continue
      const pacote = (JSON.parse(readFileSync(manifesto, 'utf8')) as { name: string }).name
      const destino = join(raiz, 'node_modules', pacote)
      mkdirSync(dirname(destino), { recursive: true })
      symlinkSync(join(raiz, pasta, nome), destino)
    }
  }
}

/** Monta o repositório com os arquivos dados (caminho → conteúdo) e um commit só. */
export function montarRepositorio(arquivos: Record<string, string>): RepositorioDeTeste {
  const raiz = mkdtempSync(join(tmpdir(), 'renomear-'))
  PASTAS.push(raiz)
  const git = (...argumentos: string[]) => execFileSync('git', argumentos, { cwd: raiz, encoding: 'utf8', stdio: 'pipe' }).trim()
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'teste')
  git('config', 'user.email', 'teste@exemplo.invalid')
  escreverArquivo(raiz, '.gitignore', 'node_modules/\n')
  escreverArquivo(raiz, 'tsconfig.base.json', JSON.stringify(TSCONFIG_BASE))
  for (const [caminho, conteudo] of Object.entries(arquivos)) escreverArquivo(raiz, caminho, conteudo)
  ligarWorkspaces(raiz)
  git('add', '-A')
  git('commit', '-q', '-m', 'Base')
  const comandos: string[] = []
  const executar: Executor = (comando, argumentos, cwd) => {
    if (comando === 'git') execFileSync('git', [...argumentos], { cwd, stdio: 'pipe' })
    else comandos.push([comando, ...argumentos].join(' '))
  }
  return {
    raiz,
    ler: (caminho) => readFileSync(join(raiz, caminho), 'utf8'),
    existe: (caminho) => existsSync(join(raiz, caminho)),
    escrever: (caminho, conteudo) => escreverArquivo(raiz, caminho, conteudo),
    git,
    sujeira: () => git('status', '--porcelain'),
    comandos,
    executar,
    limpar: () => rmSync(raiz, { recursive: true, force: true }),
  }
}

/** Copia a fixture de `__fixtures__/` para um mapa caminho → conteúdo, tirando o `.txt` do fim de cada nome. */
export function lerFixture(pasta: string): Record<string, string> {
  const arquivos: Record<string, string> = {}
  const percorrer = (relativo: string): void => {
    for (const nome of readdirSync(join(pasta, relativo))) {
      const caminho = relativo === '' ? nome : `${relativo}/${nome}`
      if (statSync(join(pasta, caminho)).isDirectory()) percorrer(caminho)
      else if (caminho.endsWith('.txt')) arquivos[caminho.slice(0, -'.txt'.length)] = readFileSync(join(pasta, caminho), 'utf8')
    }
  }
  percorrer('')
  return arquivos
}

export function apagarRepositoriosDeTeste(): void {
  for (const pasta of PASTAS.splice(0)) rmSync(pasta, { recursive: true, force: true })
}

