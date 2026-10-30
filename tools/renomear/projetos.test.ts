import type * as Caminhos from 'node:path'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Arvore } from './arvore.ts'
import { moverEntrada } from './movimentos.ts'
import { abrirProjetos, paraRelativo } from './projetos.ts'
import { apagarRepositoriosDeTeste, montarRepositorio, pacoteDeTeste, type RepositorioDeTeste, tsconfigDe } from './repositorio-de-teste.ts'

// O custo do move (Tech Spec da X8, §5, passo 3) é o do `paraRelativo`: o serviço de linguagem pergunta a versão de cada arquivo do
// programa a cada `getProgram()`, e o `getEditsForFileRename` chama o `getProgram()` muitas vezes por dentro. Na 3.0 isso
// custou 214 s por projeto e por arquivo. O contador conta cada `path.relative` que a ferramenta pede. Ele só intercepta o
// `relative` que `projetos.ts` importa de `node:path`: se o código passar a usar `posix.relative` ou outro caminho até o cálculo, os
// casos de custo passam sem medir nada, e o contador tem de acompanhar.
const pedidos = vi.hoisted(() => ({ relative: [] as string[] }))

vi.mock('node:path', async (original) => {
  const real = await original<typeof Caminhos>()
  const relative: typeof real.relative = (de, para) => {
    pedidos.relative.push(`${de} -> ${para}`)
    return real.relative(de, para)
  }
  return { ...real, relative, default: { ...real, relative } }
})

afterEach(() => {
  apagarRepositoriosDeTeste()
  pedidos.relative.length = 0
})

const IMPORTADORES = 40

/** O `shared` com um arquivo que muda de lugar, e a `api` com muitos arquivos que o importam. */
function repositorioComImportadores(): RepositorioDeTeste {
  const importadores = Object.fromEntries(
    Array.from({ length: IMPORTADORES }, (_, i) => [`apps/api/src/i${String(i)}.ts`, `import { a } from '../../../packages/shared/src/x/a.ts'\nexport const r${String(i)} = a\n`]),
  )
  return montarRepositorio({
    'packages/shared/package.json': pacoteDeTeste('@educa/shared'),
    'packages/shared/tsconfig.json': tsconfigDe(2),
    'apps/api/package.json': JSON.stringify({ name: '@educa/api', type: 'module' }),
    'apps/api/tsconfig.json': tsconfigDe(2, ['src']),
    'packages/shared/src/index.ts': "export { a } from './x/a.ts'\n",
    'packages/shared/src/x/a.ts': 'export const a = 1\n',
    ...importadores,
  })
}

const repetidos = (chamadas: readonly string[]): string[] => chamadas.filter((c, i) => chamadas.indexOf(c) !== i)

describe('o custo do serviço de linguagem (passo 3)', () => {
  it('o programa que não mudou não recalcula o caminho de nenhum arquivo, por mais vezes que o serviço o peça', { timeout: 120_000 }, () => {
    const repo = repositorioComImportadores()
    const arvore = Arvore.carregar(repo.raiz)
    const projetos = abrirProjetos(arvore)
    expect(projetos.length).toBeGreaterThan(0)
    for (const projeto of projetos) projeto.servico.getProgram()
    pedidos.relative.length = 0

    for (let vez = 0; vez < 30; vez++) for (const projeto of projetos) projeto.servico.getProgram()

    expect(pedidos.relative).toEqual([])
  })

  it('o move de um arquivo calcula o caminho de cada arquivo uma vez só', { timeout: 120_000 }, () => {
    const repo = repositorioComImportadores()
    const arvore = Arvore.carregar(repo.raiz)
    const projetos = abrirProjetos(arvore)

    moverEntrada(arvore, projetos, { tipo: 'arquivo', de: 'packages/shared/src/x/a.ts', para: 'packages/shared/src/y/a.ts', linhaDoAnexo: 'inventario-core-shared.md:1', comum: false })

    expect(repetidos(pedidos.relative)).toEqual([])
    // O move continua certo: os 40 importadores e o re-export acompanham o arquivo.
    for (let i = 0; i < IMPORTADORES; i++) expect(arvore.ler(`apps/api/src/i${String(i)}.ts`)).toContain('packages/shared/src/y/a.ts')
    expect(arvore.ler('packages/shared/src/index.ts')).toBe("export { a } from './y/a.ts'\n")
  })
})

describe('paraRelativo', () => {
  it('devolve o caminho do repositório com `/`, e nada para o que está fora da raiz, no próprio diretório ou não é absoluto', { timeout: 120_000 }, () => {
    const repo = repositorioComImportadores()
    const arvore = Arvore.carregar(repo.raiz)

    expect(paraRelativo(arvore, join(repo.raiz, 'apps', 'api', 'src', 'i1.ts'))).toBe('apps/api/src/i1.ts')
    expect(paraRelativo(arvore, repo.raiz)).toBeUndefined()
    expect(paraRelativo(arvore, join(repo.raiz, '..', 'fora.ts'))).toBeUndefined()
    expect(paraRelativo(arvore, 'apps/api/src/i1.ts')).toBeUndefined()
  })

  it('a resposta vale por árvore: a mesma árvore lembra, e outra raiz recalcula', { timeout: 120_000 }, () => {
    const um = repositorioComImportadores()
    const outro = repositorioComImportadores()
    const arvoreUm = Arvore.carregar(um.raiz)
    const arvoreOutro = Arvore.carregar(outro.raiz)
    const caminho = join(um.raiz, 'apps', 'api', 'src', 'i1.ts')

    expect(paraRelativo(arvoreUm, caminho)).toBe('apps/api/src/i1.ts')
    expect(paraRelativo(arvoreOutro, caminho)).toBeUndefined()
    const antes = pedidos.relative.length
    expect(paraRelativo(arvoreUm, caminho)).toBe('apps/api/src/i1.ts')
    expect(paraRelativo(arvoreOutro, caminho)).toBeUndefined()
    expect(pedidos.relative).toHaveLength(antes)
  })
})
