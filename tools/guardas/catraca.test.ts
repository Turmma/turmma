import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { conferirCatraca, renomeadosDesdeOHead, somaPorRegra, suprimidasDoHead, type Supressoes } from './catraca.ts'
import { REGRAS_DE_TAMANHO } from './index.mjs'

// A catraca do tamanho (X5, 13.0; RF11): `eslint-suppressions.json` só encolhe. O `TETO` é a soma por regra de hoje; quem corta
// uma função roda `eslint . --prune-suppressions` e baixa o número aqui, no mesmo commit. A comparação com o HEAD vale no
// portão da tarefa, onde o HEAD é o commit anterior; na esteira o HEAD é o próprio commit e ela passa sempre, e quem segura
// ali é a soma contra o `TETO`.
const TETO = { complexity: 241, 'max-lines-per-function': 61, 'max-depth': 12, 'max-lines': 8 }

const ARQUIVO = 'eslint-suppressions.json'
const lerBase = (pasta: string): Supressoes => JSON.parse(readFileSync(join(pasta, ARQUIVO), 'utf8')) as Supressoes
const PACOTE = JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { scripts: Record<string, string> }

const pastas: string[] = []
function pastaTemporaria(): string {
  const pasta = mkdtempSync(join(tmpdir(), 'catraca-'))
  pastas.push(pasta)
  return pasta
}
afterAll(() => {
  for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
})

function git(pasta: string, ...argumentos: string[]): string {
  const resultado = spawnSync('git', argumentos, { cwd: pasta, encoding: 'utf8' })
  expect(resultado.status, `git ${argumentos.join(' ')}: ${resultado.stderr}`).toBe(0)
  return resultado.stdout
}

describe('a linha de base do repositório (eslint-suppressions.json)', () => {
  const atual = lerBase(raizRepositorio)

  it('cita só as quatro regras de tamanho, e a soma por regra é o TETO', () => {
    expect(REGRAS_DE_TAMANHO).toEqual(['complexity', 'max-lines-per-function', 'max-depth', 'max-lines'])
    expect(Object.keys(somaPorRegra(atual)).sort()).toEqual([...REGRAS_DE_TAMANHO].sort())
    expect(somaPorRegra(atual)).toEqual(TETO)
  })

  it('nenhum arquivo ganhou supressão desde o HEAD (a soma igual não esconde a troca de uma função por outra)', () => {
    expect(conferirCatraca({ atual, teto: TETO, doHead: suprimidasDoHead(raizRepositorio), renomeadosDe: renomeadosDesdeOHead(raizRepositorio) })).toEqual([])
  })
})

describe('conferirCatraca', () => {
  const base: Supressoes = {
    'apps/api/src/a.ts': { complexity: { count: 2 }, 'max-depth': { count: 1 } },
    'apps/api/src/b.ts': { 'max-lines-per-function': { count: 1 } },
  }
  const teto = { complexity: 2, 'max-depth': 1, 'max-lines-per-function': 1 }
  const com = (mudanca: Supressoes): Supressoes => ({ ...base, ...mudanca })

  it('a base igual ao TETO e ao HEAD passa', () => {
    expect(conferirCatraca({ atual: base, teto, doHead: base })).toEqual([])
  })

  it('uma supressão a mais que o TETO reprova', () => {
    const atual = com({ 'apps/api/src/b.ts': { 'max-lines-per-function': { count: 2 } } })
    expect(conferirCatraca({ atual, teto, doHead: undefined })).toEqual(['max-lines-per-function: 2 supressões, o TETO é 1'])
  })

  it('uma supressão a menos sem baixar o TETO reprova: quem corta a função baixa o número no mesmo commit', () => {
    const atual = com({ 'apps/api/src/a.ts': { complexity: { count: 1 }, 'max-depth': { count: 1 } } })
    expect(conferirCatraca({ atual, teto, doHead: base })).toEqual(['complexity: 1 supressões, o TETO é 2'])
    expect(conferirCatraca({ atual, teto: { ...teto, complexity: 1 }, doHead: base })).toEqual([])
  })

  it('a regra que sumiu da base mas está no TETO, e a que está na base mas não no TETO, reprovam: o TETO desce a zero junto', () => {
    const { 'apps/api/src/b.ts': _, ...semB } = base
    expect(conferirCatraca({ atual: semB, teto, doHead: undefined })).toEqual(['max-lines-per-function: 0 supressões, o TETO é 1'])
    const { 'max-depth': __, ...semMaxDepth } = teto
    expect(conferirCatraca({ atual: base, teto: semMaxDepth, doHead: undefined })).toEqual(['max-depth: 1 supressões, o TETO é 0'])
  })

  it('regra que não é de tamanho não entra na linha de base: ela não esconde um no-explicit-any', () => {
    const atual = com({ 'apps/api/src/c.ts': { '@typescript-eslint/no-explicit-any': { count: 1 } } })
    const problemas = conferirCatraca({ atual, teto: { ...teto, '@typescript-eslint/no-explicit-any': 1 }, doHead: undefined })
    expect(problemas).toEqual(['apps/api/src/c.ts: @typescript-eslint/no-explicit-any não é regra de tamanho'])
  })

  it('troca no mesmo commit, com a soma igual, reprova: o arquivo que ganhou supressão aparece', () => {
    const atual: Supressoes = {
      'apps/api/src/a.ts': { complexity: { count: 1 }, 'max-depth': { count: 1 } },
      'apps/api/src/b.ts': { 'max-lines-per-function': { count: 1 }, complexity: { count: 1 } },
    }
    expect(somaPorRegra(atual)).toEqual(teto)
    expect(conferirCatraca({ atual, teto, doHead: base })).toEqual(['apps/api/src/b.ts: complexity subiu de 0 para 1'])
  })

  it('o arquivo que ganhou a mesma regra que já tinha reprova com o antes e o depois', () => {
    const atual = com({ 'apps/api/src/a.ts': { complexity: { count: 3 }, 'max-depth': { count: 1 } } })
    expect(conferirCatraca({ atual, teto: { ...teto, complexity: 3 }, doHead: base })).toEqual(['apps/api/src/a.ts: complexity subiu de 2 para 3'])
  })

  it('arquivo ausente no HEAD com supressão reprova: arquivo novo não nasce suprimido', () => {
    const atual = com({ 'apps/api/src/novo.ts': { complexity: { count: 1 } } })
    expect(conferirCatraca({ atual, teto: { ...teto, complexity: 3 }, doHead: base })).toEqual(['apps/api/src/novo.ts: arquivo sem supressão no HEAD (complexity: 1)'])
  })

  it('sem linha de base no HEAD (o commit que a cria), não há o que comparar: só a soma e as regras valem', () => {
    const atual = com({ 'apps/api/src/novo.ts': { complexity: { count: 1 } } })
    expect(conferirCatraca({ atual, teto: { ...teto, complexity: 3 }, doHead: undefined })).toEqual([])
  })

  it('arquivo movido leva a supressão do lugar de onde veio; sem o rename, o novo caminho é arquivo novo', () => {
    const { 'apps/api/src/a.ts': movido, ...resto } = base
    const atual: Supressoes = { ...resto, 'apps/api/src/sala/a.ts': movido ?? {} }
    expect(conferirCatraca({ atual, teto, doHead: base, renomeadosDe: new Map([['apps/api/src/sala/a.ts', 'apps/api/src/a.ts']]) })).toEqual([])
    expect(conferirCatraca({ atual, teto, doHead: base })).toEqual([
      'apps/api/src/sala/a.ts: arquivo sem supressão no HEAD (complexity: 2)',
      'apps/api/src/sala/a.ts: arquivo sem supressão no HEAD (max-depth: 1)',
    ])
  })

  it('arquivo movido que ganhou supressão reprova, mesmo seguindo o rename', () => {
    const { 'apps/api/src/a.ts': movido, ...resto } = base
    const atual: Supressoes = { ...resto, 'apps/api/src/sala/a.ts': { ...movido, complexity: { count: 3 } } }
    const renomeadosDe = new Map([['apps/api/src/sala/a.ts', 'apps/api/src/a.ts']])
    expect(conferirCatraca({ atual, teto: { ...teto, complexity: 3 }, doHead: base, renomeadosDe })).toEqual(['apps/api/src/sala/a.ts: complexity subiu de 2 para 3'])
  })
})

describe('o HEAD e o rename, lidos do git', () => {
  /** Repositório de teste com um commit: `a.ts` (o conteúdo é grande para o git reconhecer o rename) e a linha de base dele. */
  function repositorioComBase(): string {
    const pasta = pastaTemporaria()
    git(pasta, 'init', '-q')
    git(pasta, 'config', 'user.email', 'catraca@teste.local')
    git(pasta, 'config', 'user.name', 'Catraca')
    git(pasta, 'config', 'commit.gpgsign', 'false')
    // O rename só é achado com `--find-renames` no comando, e não pelo padrão do git de quem roda o teste.
    git(pasta, 'config', 'diff.renames', 'false')
    mkdirSync(join(pasta, 'src'))
    writeFileSync(join(pasta, 'src/a.ts'), Array.from({ length: 20 }, (_, i) => `export const v${i} = ${i}`).join('\n'))
    writeFileSync(join(pasta, ARQUIVO), JSON.stringify({ 'src/a.ts': { complexity: { count: 2 } } }))
    git(pasta, 'add', '.')
    git(pasta, 'commit', '-q', '-m', 'base')
    return pasta
  }

  it('sem o arquivo no HEAD, a leitura é undefined; com ele, é a linha de base do commit, e não a da árvore', () => {
    const vazio = pastaTemporaria()
    git(vazio, 'init', '-q')
    expect(suprimidasDoHead(vazio)).toBeUndefined()
    const pasta = repositorioComBase()
    writeFileSync(join(pasta, ARQUIVO), JSON.stringify({ 'src/a.ts': { complexity: { count: 9 } } }))
    // No índice também: o índice e o HEAD só se distinguem quando o índice já tem a base nova.
    git(pasta, 'add', ARQUIVO)
    expect(suprimidasDoHead(pasta)).toEqual({ 'src/a.ts': { complexity: { count: 2 } } })
  })

  it('git mv é achado como rename, e o conferidor aceita a supressão no lugar novo; mv sem git add não é rename', () => {
    const pasta = repositorioComBase()
    mkdirSync(join(pasta, 'src/sala'))
    git(pasta, 'mv', 'src/a.ts', 'src/sala/a.ts')
    expect(renomeadosDesdeOHead(pasta)).toEqual(new Map([['src/sala/a.ts', 'src/a.ts']]))
    const movida: Supressoes = { 'src/sala/a.ts': { complexity: { count: 2 } } }
    const conferir = (renomeadosDe: Map<string, string>) => conferirCatraca({ atual: movida, teto: { complexity: 2 }, doHead: suprimidasDoHead(pasta), renomeadosDe })
    expect(conferir(renomeadosDesdeOHead(pasta))).toEqual([])

    const solta = repositorioComBase()
    mkdirSync(join(solta, 'src/sala'))
    spawnSync('mv', ['src/a.ts', 'src/sala/a.ts'], { cwd: solta })
    expect(renomeadosDesdeOHead(solta)).toEqual(new Map())
    // Sem o rename, o caminho novo é arquivo novo para o HEAD daquele repositório, e a supressão dele reprova.
    expect(conferirCatraca({ atual: movida, teto: { complexity: 2 }, doHead: suprimidasDoHead(solta), renomeadosDe: renomeadosDesdeOHead(solta) })).toEqual([
      'src/sala/a.ts: arquivo sem supressão no HEAD (complexity: 2)',
    ])
  })
})

describe('a supressão sem uso reprova o lint (eslint . --prune-suppressions é de quem corta)', () => {
  const ESLINT = join(raizRepositorio, 'node_modules/.bin/eslint')
  /** Os argumentos do primeiro comando do `lint` do `package.json`, o `eslint . --max-warnings=0`. */
  const argumentosDoLint = (): string[] => {
    const [comando, ...argumentos] = (PACOTE.scripts['lint'] ?? '').split(' && ')[0]?.split(/\s+/) ?? []
    expect(comando).toBe('eslint')
    return argumentos
  }

  it('função encurtada sem podar a linha de base: o lint sai com falha; podada, volta a passar', () => {
    const pasta = pastaTemporaria()
    writeFileSync(join(pasta, 'eslint.config.mjs'), 'export default [{ rules: { complexity: ["error", 10] } }]\n')
    writeFileSync(join(pasta, 'f.js'), 'export function f() { return 1 }\n')
    writeFileSync(join(pasta, ARQUIVO), JSON.stringify({ 'f.js': { complexity: { count: 1 } } }))
    const rodar = (...extras: string[]) => spawnSync(ESLINT, [...argumentosDoLint(), ...extras], { cwd: pasta, encoding: 'utf8' })
    const sem = rodar()
    expect(sem.status, sem.stdout + sem.stderr).not.toBe(0)
    expect(sem.stdout + sem.stderr).toContain('--prune-suppressions')
    expect(rodar('--prune-suppressions').status).toBe(0)
    expect(rodar().status).toBe(0)
  }, 60_000)

  it('o npm run lint não abre mão da poda: sem --pass-on-unpruned-suppressions', () => {
    expect(PACOTE.scripts['lint']).not.toContain('pass-on-unpruned-suppressions')
  })

  it('npm run lint está verde com a linha de base (a catraca nasce sem quebrar nada)', () => {
    const resultado = spawnSync('npm', ['run', 'lint'], { cwd: raizRepositorio, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    expect(resultado.status, resultado.stdout + resultado.stderr).toBe(0)
  }, 240_000)
})
