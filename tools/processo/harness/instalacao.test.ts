// A instalação do git hook nativo (RF14, `cenarios.md` B: "Instalação" e "Início de sessão"). O que o hook decide está em
// `hook-git.int.test.ts`, contra um git de verdade; aqui está o que o põe de pé em cada andar e linha: o `prepare` que grava o
// `core.hooksPath`, os scripts que o git executa, e o aviso do início de sessão quando o `core.hooksPath` não está certo.
import { execFileSync, spawnSync } from 'node:child_process'
import { accessSync, constants, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, matchesGlob } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import configuracaoDoVitest from '../../../vitest.config.ts'

const RAIZ = join(import.meta.dirname, '..', '..', '..')
const PASTA_DOS_HOOKS = 'tools/processo/git-hooks'
const SCRIPTS = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as { scripts: Record<string, string> }

describe('o prepare grava o core.hooksPath', () => {
  it('aponta a pasta dos scripts do git hook, com o caminho relativo (cada andar e linha usa o seu)', () => {
    expect(SCRIPTS.scripts['prepare']).toBe(`git config core.hooksPath ${PASTA_DOS_HOOKS}`)
  })

  it.each(['commit-msg', 'pre-push'])('a pasta tem o %s, e ele é executável: o git ignora o hook que não é', (hook) => {
    expect(() => accessSync(join(RAIZ, PASTA_DOS_HOOKS, hook), constants.X_OK)).not.toThrow()
  })

  it.each([
    ['commit-msg', /exec node "\$\(git rev-parse --show-toplevel\)\/tools\/processo\/hook-git\.ts" commit-msg "\$1"$/m],
    ['pre-push', /exec node "\$\(git rev-parse --show-toplevel\)\/tools\/processo\/hook-git\.ts" pre-push$/m],
  ])('o %s sai antes do node quando não há papel, e depois chama o hook-git.ts da árvore em que o git roda', (hook, chamada) => {
    const texto = readFileSync(join(RAIZ, PASTA_DOS_HOOKS, hook), 'utf8')
    expect(texto.startsWith('#!/bin/sh\n')).toBe(true)
    expect(texto).toMatch(chamada)
    const linhas = texto.split('\n')
    const saida = linhas.indexOf('[ -n "$CLAUDE_CODE_AGENT" ] || exit 0')
    expect(saida).toBeGreaterThan(-1)
    expect(saida).toBeLessThan(linhas.findIndex((linha) => linha.startsWith('exec node')))
  })
})

describe('o projeto processo do Vitest', () => {
  type Projeto = { test?: { name?: string; include?: string[]; exclude?: string[]; testTimeout?: number; globalSetup?: string[] } }
  const projetos = (configuracaoDoVitest.test?.projects ?? []) as Projeto[]
  const coletado = (caminho: string): string[] =>
    projetos
      .filter((projeto) => (projeto.test?.include ?? []).some((padrao) => matchesGlob(caminho, padrao)) && !(projeto.test?.exclude ?? []).some((padrao) => matchesGlob(caminho, padrao)))
      .map((projeto) => projeto.test?.name ?? '')

  it('coleta o teste do git hook e nenhum outro projeto o coleta: ele não pode subir o compose da integração', () => {
    expect(coletado('tools/processo/hook-git.int.test.ts')).toEqual(['processo'])
    // Os vizinhos continuam onde estavam: o outro teste de integração de tools/, o de unidade do processo e o de infra.
    expect(coletado('tools/guardas/gitleaks.int.test.ts')).toEqual(['integracao'])
    expect(coletado('tools/processo/revisoes.test.ts')).toEqual(['unidade'])
    expect(coletado('infra/test/metrics.int.test.ts')).toEqual(['infra'])
  })

  it('não coleta o que os ignorados excluem, mesmo dentro de tools/processo/, nem a cópia do worktree de um subagente', () => {
    // Estes casam o `include` e só o `exclude: ignorados` os tira: sem ele, o projeto rodaria teste de dependência e de build.
    expect(coletado('tools/processo/node_modules/pacote/hook-git.int.test.ts')).toEqual([])
    expect(coletado('tools/processo/dist/hook-git.int.test.ts')).toEqual([])
    expect(coletado('.claude/worktrees/agente/tools/processo/hook-git.int.test.ts')).toEqual([])
  })

  it('não tem globalSetup (sem compose) e dá a cada caso o prazo de quem faz commit e push de verdade', () => {
    const processo = projetos.find((projeto) => projeto.test?.name === 'processo')?.test
    expect(processo?.globalSetup).toBeUndefined()
    expect(processo?.testTimeout).toBe(60_000)
  })
})

describe('o início de sessão avisa quando o core.hooksPath não está certo', () => {
  const temporarios: string[] = []
  afterAll(() => {
    for (const pasta of temporarios) rmSync(pasta, { recursive: true, force: true })
  })

  /** Um checkout que o `contexto-inicial.sh` reconhece (tem o `ROADMAP.md`), com ou sem o `core.hooksPath`. */
  function checkout(hooksPath: string | null): string {
    const raiz = mkdtempSync(join(tmpdir(), 'sessao-'))
    temporarios.push(raiz)
    execFileSync('git', ['init', '-q'], { cwd: raiz, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } })
    writeFileSync(join(raiz, 'ROADMAP.md'), '# Roadmap\n')
    if (hooksPath !== null) execFileSync('git', ['config', 'core.hooksPath', hooksPath], { cwd: raiz })
    return raiz
  }

  /** O hook como o `settings.json` o chama: `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/contexto-inicial.sh"`, com o JSON na entrada. */
  function iniciar(raiz: string): string {
    const ambiente: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: raiz, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
    delete ambiente['CLAUDE_CODE_AGENT']
    return spawnSync('bash', [join(RAIZ, '.claude/hooks/contexto-inicial.sh')], { cwd: raiz, env: ambiente, input: '{"source":"startup"}', encoding: 'utf8' }).stdout
  }

  it('com o core.hooksPath ausente, o aviso sai e diz o comando', () => {
    const saida = iniciar(checkout(null))
    expect(saida).toMatch(/Aviso: o git hook nativo não está ligado neste checkout \(core\.hooksPath não está definido\)/)
    expect(saida).toContain(`git config core.hooksPath ${PASTA_DOS_HOOKS}`)
  })

  it('com o core.hooksPath em outro lugar, o aviso sai e diz o valor que está lá', () => {
    expect(iniciar(checkout('/dev/null'))).toMatch(/core\.hooksPath é "\/dev\/null"\)/)
  })

  it('com o core.hooksPath certo, o aviso não sai', () => {
    expect(iniciar(checkout(PASTA_DOS_HOOKS))).not.toMatch(/git hook nativo/)
  })
})
