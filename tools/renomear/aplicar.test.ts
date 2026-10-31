import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { aplicar } from './aplicar.ts'
import { PASTA_DO_PROTOTIPO } from './ast.ts'
import type { Mapa } from './mapa.ts'
import { apagarRepositoriosDeTeste, lerFixture, montarRepositorio, pacoteDeTeste, type RepositorioDeTeste, tsconfigDe } from './repositorio-de-teste.ts'

// Cada caso monta um repositório de verdade (git e `tsconfig`), roda o `aplicar` nele e olha o efeito: a árvore depois, ou
// `git status` vazio quando o mapa é recusado. O serviço de linguagem lê a biblioteca do TypeScript, por isso o prazo largo.
const PRAZO = 120_000

afterEach(apagarRepositoriosDeTeste)

type EntradaDeTeste = Partial<Mapa['entradas'][number]> & Pick<Mapa['entradas'][number], 'tipo' | 'de' | 'para'>

const ANEXO = 'inventario-core-shared.md:883'

function mapaDe(entradas: EntradaDeTeste[], resto: Partial<Pick<Mapa, 'ocorrencias' | 'linha'>> = {}): string {
  return JSON.stringify({ ...resto, entradas: entradas.map((entrada) => ({ linhaDoAnexo: ANEXO, ...entrada })) })
}

/** Um mundo de três projetos, como o monorepo: o `shared` e as duas pontas que o importam. */
function mundo(arquivos: Record<string, string>, entradas: EntradaDeTeste[], resto: Partial<Pick<Mapa, 'ocorrencias' | 'linha'>> = {}): RepositorioDeTeste {
  return montarRepositorio({
    'packages/shared/package.json': pacoteDeTeste('@educa/shared'),
    'packages/shared/tsconfig.json': tsconfigDe(2),
    'apps/api/package.json': JSON.stringify({ name: '@educa/api', type: 'module' }),
    'apps/api/tsconfig.json': tsconfigDe(2, ['src', 'test']),
    'apps/web/package.json': JSON.stringify({ name: '@educa/web', type: 'module' }),
    'apps/web/tsconfig.json': tsconfigDe(2),
    'packages/shared/src/index.ts': '',
    'tools/renomear/mapas/1.json': mapaDe(entradas, resto),
    ...arquivos,
  })
}

const rodar = (repo: RepositorioDeTeste, opcoes: { escopo?: string } = {}) => aplicar(repo.raiz, 'tools/renomear/mapas/1.json', { executar: repo.executar, ...opcoes })

describe('o rename de símbolo (passos 1 e 2)', () => {
  it('símbolo do shared em dois projetos: renomeia nos dois, o comentário composto muda e a string igual ao nome fica', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        ...lerFixture(join(import.meta.dirname, '__fixtures__/esquema-real')),
        'apps/api/test/contratos.ts': "// O esquemaRespostaAvisos é o corpo de GET /v1/sistema/avisos.\nexport const NOMES = ['esquemaRespostaAvisos']\n",
      },
      [{ tipo: 'simbolo', de: 'esquemaRespostaAvisos', para: 'avisosResponseSchema', arquivo: 'packages/shared/src/sistema/avisos.ts' }],
      { ocorrencias: [{ arquivo: 'apps/api/test/contratos.ts', de: 'esquemaRespostaAvisos', classe: 'fica', linha: 'inventario-back.md:12' }] },
    )
    const resultado = rodar(repo)
    expect(resultado.recusas).toEqual([])
    expect(repo.ler('apps/web/src/api/sistema.ts')).toContain("import { avisosResponseSchema, esquemaRespostaEstado } from '@educa/shared'")
    expect(repo.ler('apps/web/src/api/sistema.ts')).toContain("'/v1/sistema/avisos', avisosResponseSchema, signal")
    expect(repo.ler('apps/api/src/sistema/avisos.controller.ts')).toContain('return avisosResponseSchema.parse({ itens: this.avisos })')
    expect(repo.ler('packages/shared/src/sistema/avisos.ts')).toContain('export const avisosResponseSchema = z')
    expect(repo.ler('packages/shared/src/index.ts')).toContain("export { esquemaAviso, avisosResponseSchema, MAXIMO_DE_AVISOS } from './sistema/avisos.js'")
    expect(repo.ler('apps/api/test/contratos.ts')).toBe("// O avisosResponseSchema é o corpo de GET /v1/sistema/avisos.\nexport const NOMES = ['esquemaRespostaAvisos']\n")
  })

  it('dois símbolos no mesmo arquivo: o segundo é renomeado mesmo depois de o primeiro mudar o tamanho do texto antes dele', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/shared/src/dois.ts': 'export const esquemaCurto = 1\nexport const esquemaSeguinte = esquemaCurto + 1\nexport type Seguinte = typeof esquemaSeguinte\n',
        'packages/shared/src/index.ts': "export { esquemaCurto, esquemaSeguinte } from './dois.ts'\nexport type { Seguinte } from './dois.ts'\n",
        'apps/api/src/b.ts': "import { esquemaCurto, esquemaSeguinte } from '@educa/shared'\nexport const r = [esquemaCurto, esquemaSeguinte]\n",
      },
      [
        { tipo: 'simbolo', de: 'esquemaCurto', para: 'umNomeBemMaisCompridoQueOAntigoSchema', arquivo: 'packages/shared/src/dois.ts' },
        { tipo: 'simbolo', de: 'esquemaSeguinte', para: 'seguinteSchema', arquivo: 'packages/shared/src/dois.ts' },
      ],
    )
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('packages/shared/src/dois.ts')).toBe(
      'export const umNomeBemMaisCompridoQueOAntigoSchema = 1\nexport const seguinteSchema = umNomeBemMaisCompridoQueOAntigoSchema + 1\nexport type Seguinte = typeof seguinteSchema\n',
    )
    expect(repo.ler('packages/shared/src/index.ts')).toContain('export { umNomeBemMaisCompridoQueOAntigoSchema, seguinteSchema }')
    expect(repo.ler('apps/api/src/b.ts')).toBe("import { umNomeBemMaisCompridoQueOAntigoSchema, seguinteSchema } from '@educa/shared'\nexport const r = [umNomeBemMaisCompridoQueOAntigoSchema, seguinteSchema]\n")
  })

  it('dois símbolos no mesmo arquivo: o segundo é renomeado também quando o primeiro encurta o texto antes dele', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/shared/src/dois.ts': 'export const esquemaDoPrimeiroDosDois = 1\nexport const esquemaSeguinte = esquemaDoPrimeiroDosDois + 1\nexport type Seguinte = typeof esquemaSeguinte\n',
        'packages/shared/src/index.ts': "export { esquemaDoPrimeiroDosDois, esquemaSeguinte } from './dois.ts'\nexport type { Seguinte } from './dois.ts'\n",
      },
      [
        { tipo: 'simbolo', de: 'esquemaDoPrimeiroDosDois', para: 'aSchema', arquivo: 'packages/shared/src/dois.ts' },
        { tipo: 'simbolo', de: 'esquemaSeguinte', para: 'seguinteSchema', arquivo: 'packages/shared/src/dois.ts' },
      ],
    )
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('packages/shared/src/dois.ts')).toBe('export const aSchema = 1\nexport const seguinteSchema = aSchema + 1\nexport type Seguinte = typeof seguinteSchema\n')
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export { aSchema, seguinteSchema } from './dois.ts'\nexport type { Seguinte } from './dois.ts'\n")
  })

  it('{ esquemaTurma }: a chave fica', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/shared/src/turma.ts': 'export const esquemaTurma = { a: 1 }\n',
        'packages/shared/src/index.ts': "export { esquemaTurma } from './turma.ts'\n",
        'apps/api/src/b.ts': "import { esquemaTurma } from '@educa/shared'\nexport const r = { esquemaTurma }\nexport const { esquemaTurma: outra } = { esquemaTurma }\n",
        'apps/api/src/c.ts': "import * as todos from '@educa/shared'\nconst { esquemaTurma } = todos\nexport const q = esquemaTurma\n",
      },
      [{ tipo: 'simbolo', de: 'esquemaTurma', para: 'turmaSchema', arquivo: 'packages/shared/src/turma.ts' }],
    )
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('apps/api/src/b.ts')).toBe("import { turmaSchema } from '@educa/shared'\nexport const r = { esquemaTurma: turmaSchema }\nexport const { esquemaTurma: outra } = { esquemaTurma: turmaSchema }\n")
    expect(repo.ler('apps/api/src/c.ts')).toBe("import * as todos from '@educa/shared'\nconst { esquemaTurma: turmaSchema } = todos\nexport const q = turmaSchema\n")
  })
})

describe('o membro sem arquivo: static com( vira forRoot (passos 1 e 2)', () => {
  const com = { tipo: 'simbolo' as const, de: 'com', para: 'forRoot' }
  const modulos = {
    'packages/shared/src/modulos.ts': 'export class ModuloA {\n  static com(): number {\n    return 1\n  }\n}\nexport class ModuloB {\n  static com(): number {\n    return 2\n  }\n}\n',
    'packages/shared/src/index.ts': "export { ModuloA, ModuloB } from './modulos.ts'\n",
    'apps/api/src/uso.ts': "import { ModuloA, ModuloB } from '@educa/shared'\n// O com entra aqui, em prosa.\nexport const nome = 'com'\nexport const r = [ModuloA.com(), ModuloB.com()]\n",
  }

  it('os dois módulos e a chamada viram forRoot, e o com em string e em comentário fica', { timeout: PRAZO }, () => {
    const repo = mundo(modulos, [com], { ocorrencias: [{ arquivo: 'apps/api/src/uso.ts', de: 'com', classe: 'fica', linha: 'inventario-back.md:39' }] })
    const resultado = rodar(repo)
    expect(resultado.recusas).toEqual([])
    expect(repo.ler('packages/shared/src/modulos.ts')).toBe(modulos['packages/shared/src/modulos.ts'].replaceAll('com()', 'forRoot()'))
    expect(repo.ler('apps/api/src/uso.ts')).toBe(modulos['apps/api/src/uso.ts'].replace('[ModuloA.com(), ModuloB.com()]', '[ModuloA.forRoot(), ModuloB.forRoot()]'))
    expect(resultado.relatorio).toContain('| apps/api/src/uso.ts | com | 2 |') // o comentário vai para a troca à mão, a string foi classificada
  })

  it('o membro forRoot que já existe no mesmo tipo: colisão, e a árvore sai igual', { timeout: PRAZO }, () => {
    const comColisao = { ...modulos, 'packages/shared/src/modulos.ts': `${modulos['packages/shared/src/modulos.ts']}export class ModuloC {\n  static com(): number {\n    return 3\n  }\n  static forRoot(): number {\n    return 4\n  }\n}\n` }
    const repo = mundo(comColisao, [com], { ocorrencias: [{ arquivo: 'apps/api/src/uso.ts', de: 'com', classe: 'fica', linha: 'inventario-back.md:39' }] })
    const resultado = rodar(repo)
    expect(resultado.codigo).toBe(1)
    expect(resultado.recusas.map((recusa) => recusa.codigo)).toEqual(['colisao'])
    expect(repo.sujeira()).toBe('')
  })
})

describe('o move de arquivo e de pasta (passo 3)', () => {
  const comArquivoDoShared = (entrada: EntradaDeTeste, extra: Record<string, string> = {}) =>
    mundo(
      {
        'packages/shared/package.json': pacoteDeTeste('@educa/shared', {
          exports: {
            '.': { source: './src/index.ts', default: './dist/index.js' },
            './x/a': { source: './src/x/a.ts', types: './dist/x/a.d.ts', default: './dist/x/a.js' },
          },
        }),
        'packages/shared/src/x/a.ts': 'export const a = 1\n',
        'packages/shared/src/index.ts': "export { a } from './x/a.ts'\n",
        'apps/api/src/b.ts': "import { a } from '../../../packages/shared/src/x/a.ts'\nimport { a as a2 } from '@educa/shared/x/a'\nexport const r = [a, a2]\n",
        'apps/api/src/b.test.ts': "import { vi } from 'vitest'\nvi.mock('../../../packages/shared/src/x/a.ts')\nvi.mock('@educa/shared/x/a')\n",
        ...extra,
      },
      [entrada],
      {
        // O subcaminho `x/a` do pacote tem o mesmo trecho de pasta-mãe e nome do arquivo: é string de fora, e fica.
        ocorrencias: ['apps/api/src/b.ts', 'apps/api/src/b.test.ts', 'packages/shared/package.json'].map((arquivo) => ({
          arquivo,
          de: 'packages/shared/src/x/a.ts',
          classe: 'fica' as const,
          linha: 'inventario-core-shared.md:1',
        })),
      },
    )

  it('move de arquivo: o import relativo, o de pacote e o vi.mock mudam', { timeout: PRAZO }, () => {
    const repo = comArquivoDoShared({ tipo: 'arquivo', de: 'packages/shared/src/x/a.ts', para: 'packages/shared/src/y/a.ts' })
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.existe('packages/shared/src/x/a.ts')).toBe(false)
    expect(repo.ler('packages/shared/src/y/a.ts')).toBe('export const a = 1\n')
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export { a } from './y/a.ts'\n")
    // o relativo muda; o de pacote continua o mesmo especificador, e o `exports` do pacote passa a apontar para o lugar novo
    expect(repo.ler('apps/api/src/b.ts')).toBe("import { a } from '../../../packages/shared/src/y/a.ts'\nimport { a as a2 } from '@educa/shared/x/a'\nexport const r = [a, a2]\n")
    expect(repo.ler('apps/api/src/b.test.ts')).toBe("import { vi } from 'vitest'\nvi.mock('../../../packages/shared/src/y/a.ts')\nvi.mock('@educa/shared/x/a')\n")
    const exportsDoPacote = (JSON.parse(repo.ler('packages/shared/package.json')) as { exports: Record<string, Record<string, string>> }).exports
    expect(exportsDoPacote['./x/a']).toEqual({ source: './src/y/a.ts', types: './dist/y/a.d.ts', default: './dist/y/a.js' })
    expect(repo.git('status', '--porcelain', '--', 'packages/shared/src')).toMatch(/R {2}packages\/shared\/src\/x\/a\.ts -> packages\/shared\/src\/y\/a\.ts|D {2}.*\n.*A /)
  })

  it('move de pasta: o import que termina em .js continua em .js e o que termina em .ts continua em .ts', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/shared/src/x/a.ts': 'export const a = 1\n',
        'packages/shared/src/x/b.ts': "import { a } from './a.js'\nexport const b = a\n",
        'packages/shared/src/index.ts': "export { a } from './x/a.js'\nexport { b } from './x/b.ts'\n",
        'apps/api/src/c.ts': "import { a } from '../../../packages/shared/src/x/a.js'\nimport { b } from '../../../packages/shared/src/x/b.ts'\nexport const r = [a, b]\n",
      },
      [{ tipo: 'pasta', de: 'packages/shared/src/x', para: 'packages/shared/src/y' }],
    )
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export { a } from './y/a.js'\nexport { b } from './y/b.ts'\n")
    expect(repo.ler('apps/api/src/c.ts')).toBe(
      "import { a } from '../../../packages/shared/src/y/a.js'\nimport { b } from '../../../packages/shared/src/y/b.ts'\nexport const r = [a, b]\n",
    )
    // dentro da pasta que mudou, o relativo que não muda também não troca a extensão
    expect(repo.ler('packages/shared/src/y/b.ts')).toBe("import { a } from './a.js'\nexport const b = a\n")
  })

  it('move de arquivo com import .js: o relativo muda de pasta e conserva o .js', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/shared/src/x/a.ts': 'export const a = 1\n',
        'packages/shared/src/index.ts': "export { a } from './x/a.js'\n",
        'apps/api/src/c.ts': "import { a } from '../../../packages/shared/src/x/a.js'\nexport const r = a\n",
      },
      [{ tipo: 'arquivo', de: 'packages/shared/src/x/a.ts', para: 'packages/shared/src/y/a.ts' }],
    )
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export { a } from './y/a.js'\n")
    expect(repo.ler('apps/api/src/c.ts')).toBe("import { a } from '../../../packages/shared/src/y/a.js'\nexport const r = a\n")
  })

  it('move com .js: o export *, o import() dinâmico e o vi.mock também conservam o .js', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/shared/src/x/a.ts': 'export const a = 1\n',
        'packages/shared/src/index.ts': "export * from './x/a.js'\nexport const carregar = () => import('./x/a.js')\n",
        'packages/shared/src/index.test.ts': "import { vi } from 'vitest'\nvi.mock('./x/a.js')\n",
        'apps/api/src/c.ts': "export const carregar = () => import('../../../packages/shared/src/x/a.js')\n",
      },
      [{ tipo: 'arquivo', de: 'packages/shared/src/x/a.ts', para: 'packages/shared/src/y/a.ts' }],
    )
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export * from './y/a.js'\nexport const carregar = () => import('./y/a.js')\n")
    expect(repo.ler('packages/shared/src/index.test.ts')).toBe("import { vi } from 'vitest'\nvi.mock('./y/a.js')\n")
    expect(repo.ler('apps/api/src/c.ts')).toBe("export const carregar = () => import('../../../packages/shared/src/y/a.js')\n")
  })

  it('move de pasta: o passo 3 vale para pasta', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/shared/src/fila/x.ts': "import { y } from './y.ts'\nexport const x = y\n",
        'packages/shared/src/fila/y.ts': 'export const y = 1\n',
        'packages/shared/src/index.ts': "export { x } from './fila/x.ts'\n",
        'packages/shared/src/index.test.ts': "import { vi } from 'vitest'\nvi.mock('./fila/y.ts')\n",
      },
      [{ tipo: 'pasta', de: 'packages/shared/src/fila', para: 'packages/shared/src/queue' }],
    )
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.existe('packages/shared/src/fila')).toBe(false)
    expect(repo.ler('packages/shared/src/queue/x.ts')).toBe("import { y } from './y.ts'\nexport const x = y\n")
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export { x } from './queue/x.ts'\n")
    expect(repo.ler('packages/shared/src/index.test.ts')).toBe("import { vi } from 'vitest'\nvi.mock('./queue/y.ts')\n")
  })

  it('o vi.mock dentro do que muda de lugar acompanha o alvo que não mudou', { timeout: PRAZO }, () => {
    const repo = mundo(
      { 'packages/shared/src/fila/x.test.ts': "import { vi } from 'vitest'\nvi.mock('../index.ts')\n", 'packages/shared/src/index.ts': 'export const i = 1\n' },
      [{ tipo: 'pasta', de: 'packages/shared/src/fila', para: 'packages/shared/src/dentro/queue' }],
    )
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('packages/shared/src/dentro/queue/x.test.ts')).toBe("import { vi } from 'vitest'\nvi.mock('../../index.ts')\n")
  })

  it('rename só de caixa: passa pelo nome intermediário', { timeout: PRAZO }, () => {
    const repo = mundo(
      { 'packages/shared/src/Foo.ts': 'export const f = 1\n', 'packages/shared/src/index.ts': "export { f } from './Foo.ts'\n" },
      [{ tipo: 'arquivo', de: 'packages/shared/src/Foo.ts', para: 'packages/shared/src/foo.ts' }],
    )
    const resultado = rodar(repo)
    expect(resultado.recusas).toEqual([])
    expect(resultado.comandos).toEqual([
      'git mv packages/shared/src/Foo.ts packages/shared/src/Foo.ts.renomear-intermediario',
      'git mv packages/shared/src/Foo.ts.renomear-intermediario packages/shared/src/foo.ts',
    ])
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export { f } from './foo.ts'\n")
  })

  it('dois tsconfig: cada um é editado uma vez, e o import que três projetos enxergam também', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/shared/tsconfig.json': JSON.stringify({ extends: '../../tsconfig.base.json', include: ['src', 'src/x/a.ts'] }),
        'apps/api/tsconfig.json': JSON.stringify({ extends: '../../tsconfig.base.json', include: ['src', '../../packages/shared/src/x/a.ts'] }),
        'packages/shared/src/x/a.ts': 'export const a = 1\n',
        'packages/shared/src/index.ts': "export { a } from './x/a.ts'\n",
        'apps/api/src/b.ts': "import { a } from '@educa/shared'\nexport const r = a\n",
      },
      [{ tipo: 'arquivo', de: 'packages/shared/src/x/a.ts', para: 'packages/shared/src/yy/a.ts' }],
    )
    // O nome novo é mais comprido que o antigo: a mesma troca aplicada duas vezes corromperia o arquivo.
    expect(rodar(repo).recusas).toEqual([])
    expect(JSON.parse(repo.ler('packages/shared/tsconfig.json'))).toEqual({ extends: '../../tsconfig.base.json', include: ['src', 'src/yy/a.ts'] })
    expect(JSON.parse(repo.ler('apps/api/tsconfig.json'))).toEqual({ extends: '../../tsconfig.base.json', include: ['src', '../../packages/shared/src/yy/a.ts'] })
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export { a } from './yy/a.ts'\n")
  })
})

describe('o pacote (passo 4)', () => {
  it('pacote no mapa: name, exports, dependências e lock mudam, e o -w do script fica para a troca à mão', { timeout: PRAZO }, () => {
    const repo = mundo(
      {
        'packages/nucleo/package.json': pacoteDeTeste('@educa/nucleo', {
          dependencies: { '@educa/shared': '0.0.0' },
          exports: { '.': { source: './src/index.ts', default: './dist/index.js' }, './armazem-s3': { source: './src/titular/armazem-s3.ts', default: './dist/titular/armazem-s3.js' } },
        }),
        'packages/nucleo/src/index.ts': 'export const x = 1\n',
        'packages/nucleo/src/titular/armazem-s3.ts': 'export const s = 1\n',
        'apps/api/package.json': JSON.stringify({ name: '@educa/api', type: 'module', dependencies: { '@educa/nucleo': '0.0.0' }, scripts: { build: 'npm run build -w @educa/nucleo' } }, null, 2),
        'apps/api/src/m.ts': "import { x } from '@educa/nucleo'\nimport { s } from '@educa/nucleo/armazem-s3'\nexport const r = [x, s]\n",
        'apps/api/src/m.test.ts': "import { vi } from 'vitest'\nvi.mock('@educa/nucleo')\n",
      },
      [
        { tipo: 'pacote', de: '@educa/nucleo', para: '@educa/core' },
        { tipo: 'pacote', de: '@educa/nucleo/armazem-s3', para: '@educa/core/s3-file-storage' },
      ],
      { ocorrencias: [{ arquivo: 'apps/api/package.json', de: '@educa/nucleo', classe: 'trava', linha: 'travas.md:80' }] },
    )
    const resultado = rodar(repo)
    expect(resultado.recusas).toEqual([])
    const pacote = JSON.parse(repo.ler('packages/nucleo/package.json')) as { name: string; exports: Record<string, unknown> }
    expect(pacote.name).toBe('@educa/core')
    expect(Object.keys(pacote.exports)).toEqual(['.', './s3-file-storage'])
    expect(resultado.relatorio).toContain('**Estado:** verde')
    expect(resultado.relatorio).toMatch(/^\| apps\/api\/package\.json \| \d+ \| @educa\/nucleo \| trava \| travas\.md:80 \|$/m)
    expect(resultado.relatorio).not.toContain('## Sem classificação')
    const api = JSON.parse(repo.ler('apps/api/package.json')) as { dependencies: Record<string, string>; scripts: Record<string, string> }
    expect(api.dependencies).toEqual({ '@educa/core': '0.0.0' })
    expect(api.scripts.build).toBe('npm run build -w @educa/nucleo')
    expect(repo.ler('apps/api/src/m.ts')).toBe("import { x } from '@educa/core'\nimport { s } from '@educa/core/s3-file-storage'\nexport const r = [x, s]\n")
    expect(repo.ler('apps/api/src/m.test.ts')).toBe("import { vi } from 'vitest'\nvi.mock('@educa/core')\n")
    expect(repo.comandos).toEqual(['npm install --package-lock-only'])
  })
})

describe('o comentário e o documento vivo (passo 5)', () => {
  const entradas: EntradaDeTeste[] = [
    { tipo: 'simbolo', de: 'AdaptadorFalso', para: 'FakeAdapter', arquivo: 'packages/shared/src/fila.ts' },
    { tipo: 'simbolo', de: 'Fila', para: 'Queue', arquivo: 'packages/shared/src/fila.ts' },
    { tipo: 'pasta', de: 'packages/shared/src/jobs', para: 'packages/shared/src/queue' },
  ]
  const TEXTO = 'O AdaptadorFalso.\nA `Fila` do BullMQ.\nVeja {@link Fila}.\nEm packages/shared/src/jobs/x.ts.\nFila de jobs em prosa.\n'
  const comDocumentos = (resto: Partial<Pick<Mapa, 'ocorrencias' | 'linha'>> = {}) =>
    mundo(
      {
        'packages/shared/src/fila.ts': 'export class AdaptadorFalso {}\nexport class Fila {}\n// A Fila de jobs e o AdaptadorFalso.\n',
        'packages/shared/src/jobs/x.ts': 'export const x = 1\n',
        'docs/guia.md': TEXTO,
        'CLAUDE.md': TEXTO,
        '.claude/rules/regra.md': TEXTO,
        'docs/decisoes.md': TEXTO,
        'docs/aia/ouro/README.md': TEXTO,
        'docs/aia/ouro-retido/README.md': TEXTO,
        'tasks/prd-antigo/prd.md': TEXTO,
        [`${PASTA_DO_PROTOTIPO}/LEIAME.md`]: TEXTO,
      },
      entradas,
      resto,
    )

  it('documento vivo, o composto: troca sozinho', { timeout: PRAZO }, () => {
    const repo = comDocumentos()
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('docs/guia.md').split('\n')[0]).toBe('O FakeAdapter.')
    expect(repo.ler('CLAUDE.md').split('\n')[0]).toBe('O FakeAdapter.')
    expect(repo.ler('.claude/rules/regra.md').split('\n')[0]).toBe('O FakeAdapter.')
  })

  it('documento vivo, entre crases e em {@link}: a palavra comum troca; em prosa, não', { timeout: PRAZO }, () => {
    const repo = comDocumentos()
    rodar(repo)
    expect(repo.ler('docs/guia.md').split('\n').slice(1, 3)).toEqual(['A `Queue` do BullMQ.', 'Veja {@link Queue}.'])
    expect(repo.ler('docs/guia.md').split('\n')[4]).toBe('Fila de jobs em prosa.')
  })

  it('documento vivo, o caminho: troca sozinho', { timeout: PRAZO }, () => {
    const repo = comDocumentos()
    rodar(repo)
    expect(repo.ler('docs/guia.md').split('\n')[3]).toBe('Em packages/shared/src/queue/x.ts.')
  })

  it('decisões, ouro, tasks/ e o protótipo: intactos', { timeout: PRAZO }, () => {
    const repo = comDocumentos()
    rodar(repo)
    for (const intacto of ['docs/decisoes.md', 'docs/aia/ouro/README.md', 'docs/aia/ouro-retido/README.md', 'tasks/prd-antigo/prd.md', `${PASTA_DO_PROTOTIPO}/LEIAME.md`]) {
      expect(repo.ler(intacto), intacto).toBe(TEXTO)
    }
  })

  it('palavra comum em comentário: fica, e vai para a troca à mão do relatório', { timeout: PRAZO }, () => {
    const repo = comDocumentos()
    const resultado = rodar(repo)
    expect(repo.ler('packages/shared/src/fila.ts')).toBe('export class FakeAdapter {}\nexport class Queue {}\n// A Fila de jobs e o FakeAdapter.\n')
    expect(resultado.relatorio).toContain('| packages/shared/src/fila.ts | Fila | 3 |')
    expect(resultado.relatorio).toContain('| docs/guia.md | Fila | 5 |')
    expect(repo.ler('tools/renomear/mapas/1.relatorio.md')).toContain('## Troca à mão')
  })

  it('mapa de linha: nenhum documento tocado, e o comentário do código muda', { timeout: PRAZO }, () => {
    const repo = comDocumentos({ linha: true })
    // a linha só tem símbolo: a pasta do mapa comum sai
    repo.escrever('tools/renomear/mapas/1.json', mapaDe(entradas.slice(0, 2), { linha: true }))
    expect(rodar(repo).recusas).toEqual([])
    for (const documento of ['docs/guia.md', 'CLAUDE.md', '.claude/rules/regra.md']) expect(repo.ler(documento), documento).toBe(TEXTO)
    expect(repo.ler('packages/shared/src/fila.ts')).toBe('export class FakeAdapter {}\nexport class Queue {}\n// A Fila de jobs e o FakeAdapter.\n')
  })
})

describe('as seis recusas, e a árvore sai igual', () => {
  const base = {
    'packages/shared/src/db.ts': 'export class Banco {}\n',
    'packages/shared/src/index.ts': "export { Banco } from './db.ts'\n",
    'apps/api/src/outro.ts': 'export class Database {}\n',
    'apps/api/src/b.ts': "import { Banco } from '@educa/shared'\nimport { Database } from './outro.ts'\nexport const a = [new Banco(), new Database()]\n",
    'tasks/prd-x/1_task.md': '# Tarefa 1.0\n\n## Arquivos previstos\n\n| Arquivo | Novo ou alterado |\n|---|---|\n| `packages/shared/` | alterado |\n| `tools/renomear/mapas/` | novo |\n',
  }
  const banco: EntradaDeTeste = { tipo: 'simbolo', de: 'Banco', para: 'Database', arquivo: 'packages/shared/src/db.ts' }

  /** A recusa não deixa um byte: nem o rename, nem o relatório. */
  const recusado = (repo: RepositorioDeTeste, opcoes: { escopo?: string } = {}) => {
    const resultado = rodar(repo, opcoes)
    expect(resultado.codigo).toBe(1)
    expect(repo.sujeira()).toBe('')
    expect(repo.existe('tools/renomear/mapas/1.relatorio.md')).toBe(false)
    return resultado.recusas.map((recusa) => recusa.codigo)
  }

  it('o de não existe no arquivo', { timeout: PRAZO }, () => {
    expect(recusado(mundo(base, [{ ...banco, de: 'Inexistente' }]))).toEqual(['de-inexistente'])
  })

  it('o alvo não existe: arquivo, pasta e pacote inexistentes são recusados', { timeout: PRAZO }, () => {
    expect(recusado(mundo(base, [{ ...banco, arquivo: 'packages/shared/src/nao-existe.ts' }]))).toEqual(['de-inexistente'])
    expect(recusado(mundo(base, [{ tipo: 'arquivo', de: 'packages/shared/src/nao-existe.ts', para: 'packages/shared/src/x.ts' }]))).toEqual(['de-inexistente'])
    expect(recusado(mundo(base, [{ tipo: 'pasta', de: 'packages/shared/src/nada', para: 'packages/shared/src/x' }]))).toEqual(['de-inexistente'])
    expect(recusado(mundo(base, [{ tipo: 'pacote', de: '@educa/inexistente', para: '@educa/x' }]))).toEqual(['de-inexistente'])
  })

  it('o destino de arquivo ou de pasta já existe: colisão', { timeout: PRAZO }, () => {
    const arquivos = { ...base, 'packages/shared/src/x/a.ts': 'export const a = 1\n', 'packages/shared/src/y/b.ts': 'export const b = 1\n' }
    expect(recusado(mundo(arquivos, [{ tipo: 'arquivo', de: 'packages/shared/src/x/a.ts', para: 'packages/shared/src/db.ts' }]))).toEqual(['colisao'])
    expect(recusado(mundo(arquivos, [{ tipo: 'pasta', de: 'packages/shared/src/x', para: 'packages/shared/src/y' }]))).toEqual(['colisao'])
  })

  it('o para colide no escopo de um arquivo que importa o nome, sem alias', { timeout: PRAZO }, () => {
    const repo = mundo(base, [banco])
    expect(recusado(repo)).toEqual(['colisao'])
  })

  it('o para colide, com alias: aceita, com o alias no import', { timeout: PRAZO }, () => {
    const repo = mundo(base, [{ ...banco, alias: 'CoreDatabase' }])
    expect(rodar(repo).recusas).toEqual([])
    expect(repo.ler('apps/api/src/b.ts')).toBe("import { Database as CoreDatabase } from '@educa/shared'\nimport { Database } from './outro.ts'\nexport const a = [new CoreDatabase(), new Database()]\n")
    expect(repo.ler('packages/shared/src/db.ts')).toBe('export class Database {}\n')
    expect(repo.ler('packages/shared/src/index.ts')).toBe("export { Database } from './db.ts'\n")
  })

  it('o para colide no próprio arquivo onde o nome é declarado: o alias não salva', { timeout: PRAZO }, () => {
    const repo = mundo({ ...base, 'packages/shared/src/db.ts': 'export class Banco {}\nexport class Database {}\n' }, [{ ...banco, alias: 'CoreDatabase' }])
    expect(recusado(repo)).toEqual(['colisao'])
  })

  it('a ocorrência sem a linha no formato certo: fica com travas.md, trava com inventario, e vazia', { timeout: PRAZO }, () => {
    const arquivos = { ...base, 'apps/api/src/c.ts': "export const nome = 'Banco'\n" }
    const com = (classe: 'fica' | 'trava', linha: string) =>
      mundo(arquivos, [{ ...banco, alias: 'CoreDatabase' }], { ocorrencias: [{ arquivo: 'apps/api/src/c.ts', de: 'Banco', classe, linha }] })
    expect(recusado(com('fica', 'travas.md:1'))).toEqual(['sem-linha-do-anexo'])
    expect(recusado(com('trava', 'inventario-x.md:1'))).toEqual(['sem-linha-do-anexo'])
    expect(recusado(com('fica', ''))).toEqual(['sem-linha-do-anexo'])
    expect(recusado(com('trava', ''))).toEqual(['sem-linha-do-anexo'])
    expect(rodar(com('trava', 'inventario-x.md:1')).recusas[0]?.detalhe).toContain('travas.md:<linha>')
    expect(rodar(com('fica', 'travas.md:1')).recusas[0]?.detalhe).toContain('inventario-<x>.md:<linha>')
    expect(rodar(com('fica', 'inventario-x.md:1')).recusas).toEqual([])
    expect(rodar(com('trava', 'travas.md:80')).recusas).toEqual([])
  })

  it('a linha de comando exige o --escopo, e com ele aplica', { timeout: PRAZO }, () => {
    const repo = mundo(base, [{ ...banco, alias: 'CoreDatabase' }])
    repo.escrever('tasks/prd-x/1_task.md', `${base['tasks/prd-x/1_task.md']}| \`apps/api/src/b.ts\` | alterado |\n`)
    const chamar = (...argumentos: string[]) => spawnSync('node', [join(import.meta.dirname, 'aplicar.ts'), ...argumentos], { cwd: repo.raiz, encoding: 'utf8' })
    const semEscopo = chamar('--mapa', 'tools/renomear/mapas/1.json')
    expect(semEscopo.status).toBe(2)
    expect(semEscopo.stderr).toContain('--escopo')
    expect(repo.sujeira()).toBe('M tasks/prd-x/1_task.md') // só o documento que o próprio caso escreveu
    const comEscopo = chamar('--mapa', 'tools/renomear/mapas/1.json', '--escopo', 'tasks/prd-x/1_task.md')
    expect(comEscopo.status).toBe(0)
    expect(repo.ler('apps/api/src/b.ts')).toContain('Database as CoreDatabase')
  })

  it('o de se repete', { timeout: PRAZO }, () => {
    expect(recusado(mundo(base, [banco, { ...banco, para: 'Outro' }]))).toEqual(['de-repetido'])
  })

  describe('o de de símbolo repetido', () => {
    const doApi = { tipo: 'simbolo' as const, de: 'Opcoes', para: 'ApiOptions', arquivo: 'apps/api/src/opcoes.ts' }
    const doWeb = { tipo: 'simbolo' as const, de: 'Opcoes', para: 'WebOptions', arquivo: 'apps/web/src/opcoes.ts' }
    const homonimos = {
      'apps/api/src/opcoes.ts': 'export interface Opcoes {\n  a: number\n}\n',
      'apps/api/src/uso.ts': "import type { Opcoes } from './opcoes.ts'\nexport const o: Opcoes = { a: 1 }\n",
      'apps/api/src/outro.ts': 'export interface Opcoes {\n  b: number\n}\n',
      'apps/web/src/opcoes.ts': 'export interface Opcoes {\n  w: number\n}\n',
      'apps/web/src/uso.ts': "import type { Opcoes } from './opcoes.ts'\nexport const o: Opcoes = { w: 1 }\n",
      // o caso real da 8.0: um pacote importa o homônimo do outro, com alias (`queue.fixture.ts` do worker)
      'apps/web/src/de-fora.ts': "import type { Opcoes as OpcoesDoApi } from '../../api/src/opcoes.ts'\nexport const f: OpcoesDoApi = { a: 1 }\n",
    }

    it('os dois arquivo em pacotes diferentes: cada declaração sai com o para da sua entrada, e quem a importa também', { timeout: PRAZO }, () => {
      const repo = mundo(homonimos, [doApi, doWeb])
      expect(rodar(repo).recusas).toEqual([])
      expect(repo.ler('apps/api/src/opcoes.ts')).toBe('export interface ApiOptions {\n  a: number\n}\n')
      expect(repo.ler('apps/api/src/uso.ts')).toBe("import type { ApiOptions } from './opcoes.ts'\nexport const o: ApiOptions = { a: 1 }\n")
      expect(repo.ler('apps/web/src/opcoes.ts')).toBe('export interface WebOptions {\n  w: number\n}\n')
      expect(repo.ler('apps/web/src/uso.ts')).toBe("import type { WebOptions } from './opcoes.ts'\nexport const o: WebOptions = { w: 1 }\n")
      expect(repo.ler('apps/api/src/outro.ts')).toBe(homonimos['apps/api/src/outro.ts'])
      // quem importa o homônimo do outro pacote segue a declaração certa: o do api sai ApiOptions, mesmo dentro do web
      expect(repo.ler('apps/web/src/de-fora.ts')).toBe("import type { ApiOptions as OpcoesDoApi } from '../../api/src/opcoes.ts'\nexport const f: OpcoesDoApi = { a: 1 }\n")
    })

    it('o de repetido em comentário e em documento: nenhum para é escolhido, os três vão para a troca à mão, e o símbolo de entrada única troca', { timeout: PRAZO }, () => {
      const unico = { tipo: 'simbolo' as const, de: 'UnicoDoMapa', para: 'SingleOfMap', arquivo: 'apps/api/src/unico.ts' }
      const comentarioDoApi = '// a `Opcoes` do api e a `UnicoDoMapa`\n'
      const comentarioDoWeb = '// a {@link Opcoes} do web e a `UnicoDoMapa`\n'
      const documento = 'A `Opcoes` e a `UnicoDoMapa`.\n'
      const repo = mundo(
        {
          ...homonimos,
          'apps/api/src/opcoes.ts': `${homonimos['apps/api/src/opcoes.ts']}${comentarioDoApi}`,
          'apps/web/src/uso.ts': `${homonimos['apps/web/src/uso.ts']}${comentarioDoWeb}`,
          'apps/api/src/unico.ts': 'export const UnicoDoMapa = 1\n',
          'docs/x.md': documento,
        },
        [doApi, doWeb, unico],
      )
      const resultado = rodar(repo)
      expect(resultado.recusas).toEqual([])
      expect(repo.ler('apps/api/src/opcoes.ts')).toBe(`export interface ApiOptions {\n  a: number\n}\n// a \`Opcoes\` do api e a \`SingleOfMap\`\n`)
      expect(repo.ler('apps/web/src/uso.ts')).toBe(`import type { WebOptions } from './opcoes.ts'\nexport const o: WebOptions = { w: 1 }\n// a {@link Opcoes} do web e a \`SingleOfMap\`\n`)
      expect(repo.ler('docs/x.md')).toBe('A `Opcoes` e a `SingleOfMap`.\n')
      const aMao = (resultado.relatorio ?? '').split('\n').filter((linha) => linha.includes('| Opcoes |'))
      expect(aMao).toEqual(['| apps/api/src/opcoes.ts | Opcoes | 4 |', '| apps/web/src/uso.ts | Opcoes | 3 |', '| docs/x.md | Opcoes | 1 |'])
    })

    it('o de repetido composto (o OpcoesDaMontagem da 8.0), solto na prosa de um comentário e de um documento: fica, e vai para a troca à mão', { timeout: PRAZO }, () => {
      const composto = (para: string, arquivo: string) => ({ tipo: 'simbolo' as const, de: 'OpcoesDaMontagem', para, arquivo })
      const unico = { tipo: 'simbolo' as const, de: 'UnicoDoMapa', para: 'SingleOfMap', arquivo: 'apps/api/src/unico.ts' }
      const repo = mundo(
        {
          'apps/api/src/montagem.ts': 'export interface OpcoesDaMontagem {\n  a: number\n}\n// a OpcoesDaMontagem do api\n',
          'apps/web/src/montagem.ts': 'export interface OpcoesDaMontagem {\n  w: number\n}\n// a OpcoesDaMontagem do web e o UnicoDoMapa\n',
          'apps/api/src/unico.ts': 'export const UnicoDoMapa = 1\n',
          'docs/y.md': 'A OpcoesDaMontagem solta e o UnicoDoMapa.\n',
        },
        [composto('ApiAssemblyOptions', 'apps/api/src/montagem.ts'), composto('WebAssemblyOptions', 'apps/web/src/montagem.ts'), unico],
      )
      const resultado = rodar(repo)
      expect(resultado.recusas).toEqual([])
      expect(repo.ler('apps/api/src/montagem.ts')).toBe('export interface ApiAssemblyOptions {\n  a: number\n}\n// a OpcoesDaMontagem do api\n')
      expect(repo.ler('apps/web/src/montagem.ts')).toBe('export interface WebAssemblyOptions {\n  w: number\n}\n// a OpcoesDaMontagem do web e o SingleOfMap\n')
      expect(repo.ler('docs/y.md')).toBe('A OpcoesDaMontagem solta e o SingleOfMap.\n')
      const aMao = (resultado.relatorio ?? '').split('\n').filter((linha) => linha.includes('| OpcoesDaMontagem |'))
      expect(aMao).toEqual(['| apps/api/src/montagem.ts | OpcoesDaMontagem | 4 |', '| apps/web/src/montagem.ts | OpcoesDaMontagem | 4 |', '| docs/y.md | OpcoesDaMontagem | 1 |'])
    })

    it('uma das entradas sem arquivo (vale em todo pacote): recusa, nas duas ordens', { timeout: PRAZO }, () => {
      const { arquivo: _arquivo, ...semArquivo } = doWeb
      expect(recusado(mundo(homonimos, [doApi, semArquivo]))).toEqual(['de-repetido'])
      expect(recusado(mundo(homonimos, [semArquivo, doApi]))).toEqual(['de-repetido'])
    })

    it('os dois arquivo no mesmo pacote: recusa, mesmo com destinos diferentes', { timeout: PRAZO }, () => {
      expect(recusado(mundo(homonimos, [doApi, { ...doWeb, arquivo: 'apps/api/src/outro.ts' }]))).toEqual(['de-repetido'])
    })

    // O `arquivo` numa entrada de tipo `arquivo` não existe num mapa real: está aqui para o caso alcançar a cláusula do tipo. Sem o campo,
    // a checagem de `arquivo` ausente já recusaria e a do tipo nunca seria exercida.
    it('o mesmo de em tipos diferentes (símbolo e arquivo): recusa', { timeout: PRAZO }, () => {
      expect(recusado(mundo(homonimos, [doApi, { tipo: 'arquivo', de: 'Opcoes', para: 'Outra', arquivo: 'apps/web/src/opcoes.ts' }]))).toEqual(['de-repetido'])
    })
  })

  it('falta a linha do anexo', { timeout: PRAZO }, () => {
    expect(recusado(mundo(base, [{ ...banco, linhaDoAnexo: '' }]))).toEqual(['sem-linha-do-anexo'])
    expect(recusado(mundo(base, [{ ...banco, linhaDoAnexo: 'qualquer coisa' }]))).toEqual(['sem-linha-do-anexo'])
  })

  it('a edição cai fora do --escopo', { timeout: PRAZO }, () => {
    const repo = mundo(base, [{ ...banco, alias: 'CoreDatabase' }])
    const resultado = rodar(repo, { escopo: 'tasks/prd-x/1_task.md' })
    expect(resultado.recusas.map((recusa) => recusa.codigo)).toEqual(['fora-do-escopo'])
    expect(resultado.recusas[0]?.detalhe).toContain('apps/api/src/b.ts')
    expect(repo.sujeira()).toBe('')
  })

  it('dentro do --escopo: aplica', { timeout: PRAZO }, () => {
    const repo = mundo(base, [{ ...banco, alias: 'CoreDatabase' }])
    repo.escrever('tasks/prd-x/1_task.md', `${base['tasks/prd-x/1_task.md']}| \`apps/api/src/b.ts\` | alterado |\n`)
    expect(rodar(repo, { escopo: 'tasks/prd-x/1_task.md' }).recusas).toEqual([])
  })

  it('sobra ocorrência sem classificação', { timeout: PRAZO }, () => {
    const repo = mundo({ ...base, 'apps/api/src/c.ts': "export const nome = 'Banco'\n" }, [{ ...banco, alias: 'CoreDatabase' }])
    expect(recusado(repo)).toEqual(['ocorrencia-sem-classificacao'])
  })

  it('a classificação vale só para o arquivo, o nome e o trecho que ela cita', { timeout: PRAZO }, () => {
    const arquivos = { ...base, 'apps/api/src/c.ts': "export const nome = 'Banco'\n" }
    const ocorrencia = { arquivo: 'apps/api/src/c.ts', de: 'Banco', classe: 'fica' as const, linha: 'inventario-core-shared.md:1' }
    const com = (outra: Record<string, unknown>) => mundo(arquivos, [{ ...banco, alias: 'CoreDatabase' }], { ocorrencias: [{ ...ocorrencia, ...outra }] })
    expect(recusado(com({ de: 'Outro' }))).toEqual(['ocorrencia-sem-classificacao'])
    expect(recusado(com({ arquivo: 'apps/api/src/d.ts' }))).toEqual(['ocorrencia-sem-classificacao'])
    expect(recusado(com({ arquivo: 'apps/web/' }))).toEqual(['ocorrencia-sem-classificacao'])
    expect(recusado(com({ trecho: 'não está na linha' }))).toEqual(['ocorrencia-sem-classificacao'])
    expect(rodar(com({ arquivo: 'apps/api/' })).recusas).toEqual([])
    expect(rodar(com({ trecho: 'Banco' })).recusas).toEqual([])
  })

  it('aplicar duas vezes: a segunda é recusada', { timeout: PRAZO }, () => {
    const repo = mundo(base, [{ ...banco, alias: 'CoreDatabase' }])
    expect(rodar(repo).codigo).toBe(0)
    expect(rodar(repo).recusas.map((recusa) => recusa.codigo)).toEqual(['de-inexistente'])
  })
})

describe('quem contorna é acusado: a ocorrência sem classificação', () => {
  const formas: Array<[string, Record<string, string>]> = [
    ['string', { 'apps/api/src/c.ts': "export const nome = 'esquemaTurma'\n" }],
    ['regex', { 'apps/api/src/c.ts': 'export const re = /^esquemaTurma$/\n' }],
    ['JSON', { 'apps/api/config.json': '{ "campo": "esquemaTurma" }\n' }],
    ['YAML', { '.github/workflows/ci.yml': 'jobs:\n  teste:\n    run: echo esquemaTurma\n' }],
    ['-w do package.json da raiz', { 'package.json': '{ "scripts": { "build": "npm run build -w @educa/nucleo" } }\n' }],
  ]
  it.each(formas)('em %s', { timeout: PRAZO }, (_forma, arquivos) => {
    const repo = mundo(
      { 'packages/shared/src/turma.ts': 'export const esquemaTurma = 1\n', 'packages/nucleo/package.json': pacoteDeTeste('@educa/nucleo'), ...arquivos },
      [
        { tipo: 'simbolo', de: 'esquemaTurma', para: 'turmaSchema', arquivo: 'packages/shared/src/turma.ts' },
        { tipo: 'pacote', de: '@educa/nucleo', para: '@educa/core' },
      ],
    )
    const resultado = rodar(repo)
    expect(resultado.recusas.map((recusa) => recusa.codigo)).toEqual(['ocorrencia-sem-classificacao'])
    expect(repo.sujeira()).toBe('')
    expect(resultado.relatorio).toContain('**Estado:** vermelho')
    expect(resultado.relatorio).toContain('## Sem classificação')
    expect(resultado.relatorio).toContain(`| ${Object.keys(arquivos)[0] ?? ''} | `)
  })
})
