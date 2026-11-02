import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { PASTA_DO_PROTOTIPO } from './ast.ts'
import { reaplicar } from './reaplicar.ts'
import { apagarRepositoriosDeTeste, montarRepositorio, pacoteDeTeste, type RepositorioDeTeste } from './repositorio-de-teste.ts'

// O `reaplicar` depois do merge da `develop`: o repositório já tem as ondas aplicadas (o nome novo), e o merge trouxe código
// com o nome antigo. O que se prova é o efeito na árvore, e que rodar de novo não muda nada.

afterEach(apagarRepositoriosDeTeste)

const ANEXO = 'inventario-back.md:10'
const mapa = (entradas: Array<Record<string, unknown>>, linha = false) => JSON.stringify({ linha, entradas: entradas.map((e) => ({ linhaDoAnexo: ANEXO, ...e })) })

const BANCO = { tipo: 'simbolo', de: 'Banco', para: 'Database', arquivo: 'packages/shared/src/db.ts' }
const ADAPTADOR = { tipo: 'simbolo', de: 'AdaptadorFalso', para: 'FakeAdapter', arquivo: 'packages/shared/src/db.ts' }

/** Já na forma das ondas aplicadas: o `db.ts` declara o nome novo, e o merge acrescenta `novo.ts` com o antigo. */
function aposOMerge(arquivos: Record<string, string>, mapas: Record<string, string>): RepositorioDeTeste {
  return montarRepositorio({
    'packages/shared/package.json': pacoteDeTeste('@educa/shared'),
    'packages/shared/src/db.ts': 'export class Database {}\nexport class FakeAdapter {}\n',
    ...Object.fromEntries(Object.entries(mapas).map(([nome, conteudo]) => [`tools/renomear/mapas/${nome}.json`, conteudo])),
    ...arquivos,
  })
}

/** Uma impressão de tudo o que o disco guarda, para provar que a segunda rodada não muda nada. */
function impressao(repo: RepositorioDeTeste): string {
  const hash = createHash('sha256')
  for (const arquivo of repo.git('ls-files').split('\n')) hash.update(arquivo).update(repo.ler(arquivo))
  return hash.digest('hex')
}

describe('reaplicar', () => {
  it('o de já renomeado não é erro', () => {
    const repo = aposOMerge({ 'apps/api/src/b.ts': "import { Database } from '@educa/shared'\nexport const b = new Database()\n" }, { '4': mapa([BANCO]) })
    const antes = impressao(repo)
    const resultado = reaplicar(repo.raiz, { executar: repo.executar })
    expect(resultado.codigo).toBe(0)
    expect(impressao(repo)).toBe(antes)
  })

  it('a ocorrência nova é renomeada, e a chave da forma curta fica', () => {
    const repo = aposOMerge(
      {
        'apps/api/src/novo.ts':
          "import { Banco } from '@educa/shared'\nconst b = new Banco()\nexport const r = { Banco }\nexport const x = b.Banco\nconst texto = 'Banco'\nexport type T = Banco\n",
      },
      { '4': mapa([BANCO]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/novo.ts')).toBe(
      "import { Database } from '@educa/shared'\nconst b = new Database()\nexport const r = { Banco: Database }\nexport const x = b.Banco\nconst texto = 'Banco'\nexport type T = Database\n",
    )
  })

  it('o desestruturado de namespace: a chave fica e o local passa a ter o nome novo', () => {
    const repo = aposOMerge({ 'apps/api/src/novo.ts': "import * as todos from '@educa/shared'\nconst { Banco } = todos\nexport const y = Banco\n" }, { '4': mapa([BANCO]) })
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/novo.ts')).toBe("import * as todos from '@educa/shared'\nconst { Banco: Database } = todos\nexport const y = Database\n")
  })

  it('o apelido do import e a declaração local com o mesmo nome ficam', () => {
    const repo = aposOMerge({ 'apps/api/src/novo.ts': "import { Banco as B } from '@educa/shared'\nexport const f = (Banco: number) => B\n" }, { '4': mapa([BANCO]) })
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/novo.ts')).toBe("import { Database as B } from '@educa/shared'\nexport const f = (Banco: number) => B\n")
  })

  it('com dois mapas: aplica os dois, na ordem das ondas', () => {
    const repo = aposOMerge(
      { 'apps/api/src/novo.ts': "import { Banco, AdaptadorFalso } from '@educa/shared'\nexport const r = [new Banco(), new AdaptadorFalso()]\n" },
      { '7': mapa([ADAPTADOR], true), '4': mapa([BANCO]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/novo.ts')).toBe("import { Database, FakeAdapter } from '@educa/shared'\nexport const r = [new Database(), new FakeAdapter()]\n")
  })

  it('com dois mapas encadeados: a onda 4 vem antes da 10, e não pela ordem do texto', () => {
    const repo = aposOMerge(
      { 'apps/api/src/novo.ts': "import { Banco } from '@educa/shared'\nexport const r = new Banco()\n" },
      { '10': mapa([{ tipo: 'simbolo', de: 'Database', para: 'Repositorio', arquivo: 'packages/shared/src/db.ts' }], true), '4': mapa([BANCO]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/novo.ts')).toBe("import { Repositorio } from '@educa/shared'\nexport const r = new Repositorio()\n")
  })

  it('o membro sem arquivo: Modulo.com( e static com( do merge viram forRoot, e a variável com fica', () => {
    const repo = aposOMerge(
      {
        'apps/api/src/novo.ts':
          "import { Modulo } from '@educa/shared'\nexport class Outro {\n  static com(): number {\n    return 1\n  }\n}\nconst com = 1\nexport const r = [Modulo.com(), Outro.com(), com + 1, 'com']\n",
      },
      { '4': mapa([{ tipo: 'simbolo', de: 'com', para: 'forRoot' }]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/novo.ts')).toBe(
      "import { Modulo } from '@educa/shared'\nexport class Outro {\n  static forRoot(): number {\n    return 1\n  }\n}\nconst com = 1\nexport const r = [Modulo.forRoot(), Outro.forRoot(), com + 1, 'com']\n",
    )
  })

  it('o pacote e o subcaminho na ordem do mapa: o subcaminho muda antes, e o lock é refeito', () => {
    const repo = aposOMerge(
      {
        'packages/nucleo/package.json': JSON.stringify({ name: '@educa/core', type: 'module', exports: { './s3-file-storage': './src/s3.ts' } }, null, 2),
        'apps/api/package.json': JSON.stringify({ name: '@educa/api', type: 'module', dependencies: { '@educa/nucleo': '0.0.0' } }, null, 2),
        'apps/api/src/novo.ts': "import { x } from '@educa/nucleo'\nimport { s } from '@educa/nucleo/armazem-s3'\nexport const r = [x, s]\n",
      },
      {
        '5': mapa([
          { tipo: 'pacote', de: '@educa/nucleo', para: '@educa/core' },
          { tipo: 'pacote', de: '@educa/nucleo/armazem-s3', para: '@educa/core/s3-file-storage' },
        ]),
      },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/novo.ts')).toBe("import { x } from '@educa/core'\nimport { s } from '@educa/core/s3-file-storage'\nexport const r = [x, s]\n")
    expect((JSON.parse(repo.ler('apps/api/package.json')) as { dependencies: Record<string, string> }).dependencies).toEqual({ '@educa/core': '0.0.0' })
    expect(repo.comandos).toEqual(['npm install --package-lock-only'])
  })

  it('não toca fixture, protótipo, tasks/, docs/ nem a própria ferramenta, e toca o código do produto', () => {
    const antigo = "import { Banco } from '@educa/shared'\nexport const b = new Banco()\n"
    const intactos = ['tools/guardas/__fixtures__/x.ts', 'apps/web/fixtures/y.ts', `${PASTA_DO_PROTOTIPO}/src/a.tsx`, 'tasks/prd-x/z.ts', 'docs/exemplo.ts', 'tools/renomear/auxiliar.ts']
    const repo = aposOMerge({ 'apps/api/src/novo.ts': antigo, ...Object.fromEntries(intactos.map((caminho) => [caminho, antigo])) }, { '4': mapa([BANCO]) })
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/novo.ts')).toBe(antigo.replaceAll('Banco', 'Database'))
    for (const caminho of intactos) expect(repo.ler(caminho), caminho).toBe(antigo)
  })

  it('o mapa inválido lança, e a árvore sai igual', () => {
    const repo = aposOMerge({ 'apps/api/src/novo.ts': "import { Banco } from '@educa/shared'\n" }, { '4': JSON.stringify({ entradas: [{ ...BANCO }] }) })
    expect(() => reaplicar(repo.raiz, { executar: repo.executar })).toThrow(/mapa inválido/)
    expect(repo.sujeira()).toBe('')
  })

  it('o arquivo que o merge deixou no lugar antigo vai para o novo, e o que já tem destino não é sobrescrito', () => {
    const entrada = { tipo: 'arquivo', de: 'packages/shared/src/velho.ts', para: 'packages/shared/src/novo-nome.ts' }
    const sobrou = aposOMerge({ 'packages/shared/src/velho.ts': 'export const v = 1\n' }, { '4': mapa([entrada]) })
    reaplicar(sobrou.raiz, { executar: sobrou.executar })
    expect(sobrou.existe('packages/shared/src/velho.ts')).toBe(false)
    expect(sobrou.ler('packages/shared/src/novo-nome.ts')).toBe('export const v = 1\n')
    const comDestino = aposOMerge({ 'packages/shared/src/velho.ts': 'export const v = 1\n', 'packages/shared/src/novo-nome.ts': 'export const v = 2\n' }, { '4': mapa([entrada]) })
    reaplicar(comDestino.raiz, { executar: comDestino.executar })
    expect(comDestino.ler('packages/shared/src/velho.ts')).toBe('export const v = 1\n')
    expect(comDestino.ler('packages/shared/src/novo-nome.ts')).toBe('export const v = 2\n')
    const soNovo = aposOMerge({ 'packages/shared/src/novo-nome.ts': 'export const v = 2\n' }, { '4': mapa([entrada]) })
    expect(() => reaplicar(soNovo.raiz, { executar: soNovo.executar })).not.toThrow()
    const nenhum = aposOMerge({}, { '4': mapa([entrada]) })
    expect(() => reaplicar(nenhum.raiz, { executar: nenhum.executar })).not.toThrow()
  })

  it('com o mapas/13.json, o mapa de linha passa a valer também nos documentos', () => {
    const arquivos = { 'docs/guia.md': 'O AdaptadorFalso responde.\n', 'apps/api/src/novo.ts': '// Usa o AdaptadorFalso.\nexport const a = 1\n' }
    const semTreze = aposOMerge(arquivos, { '7': mapa([ADAPTADOR], true) })
    reaplicar(semTreze.raiz, { executar: semTreze.executar })
    expect(semTreze.ler('docs/guia.md')).toBe('O AdaptadorFalso responde.\n')
    expect(semTreze.ler('apps/api/src/novo.ts')).toBe('// Usa o FakeAdapter.\nexport const a = 1\n')
    const comTreze = aposOMerge(arquivos, { '7': mapa([ADAPTADOR], true), '13': mapa([{ tipo: 'pasta', de: 'docs/velho', para: 'docs/novo' }]) })
    reaplicar(comTreze.raiz, { executar: comTreze.executar })
    expect(comTreze.ler('docs/guia.md')).toBe('O FakeAdapter responde.\n')
  })

  it('o import relativo do código novo que cita a pasta antiga vai para a pasta nova', () => {
    const repo = aposOMerge(
      { 'packages/shared/src/queue/x.ts': 'export const x = 1\n', 'packages/shared/src/novo.ts': "import { x } from './fila/x.ts'\nexport const n = x\n", 'packages/shared/src/fila/solto.ts': 'export const s = 1\n' },
      { '5': mapa([{ tipo: 'pasta', de: 'packages/shared/src/fila', para: 'packages/shared/src/queue' }]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('packages/shared/src/novo.ts')).toBe("import { x } from './queue/x.ts'\nexport const n = x\n")
    // o arquivo novo que o merge pôs na pasta antiga acompanha a pasta
    expect(repo.existe('packages/shared/src/fila/solto.ts')).toBe(false)
    expect(repo.ler('packages/shared/src/queue/solto.ts')).toBe('export const s = 1\n')
  })

  describe('o filtro do arquivo da entrada', () => {
    const PORTAO = { tipo: 'simbolo', de: 'portao', para: 'gate', arquivo: 'e2e/support/checks.ts' }

    it('o homônimo de outra pasta, que não importa da entrada, fica: o portao de tools/processo não vira gate', () => {
      const repo = aposOMerge(
        {
          'e2e/support/checks.ts': 'export const gate = 1\n',
          'e2e/aluno.spec.ts': "import { portao } from './support/checks.ts'\nexport const a = portao\n",
          'tools/processo/revisoes.ts': 'export const portao = 1\n',
          'tools/processo/hook-revisoes.ts': "import { portao } from './revisoes.ts'\nexport const h = portao\n",
        },
        { '11': mapa([PORTAO], true) },
      )
      reaplicar(repo.raiz, { executar: repo.executar })
      expect(repo.ler('e2e/aluno.spec.ts')).toBe("import { gate } from './support/checks.ts'\nexport const a = gate\n")
      expect(repo.ler('tools/processo/hook-revisoes.ts')).toBe("import { portao } from './revisoes.ts'\nexport const h = portao\n")
      expect(repo.ler('tools/processo/revisoes.ts')).toBe('export const portao = 1\n')
    })

    it('o homônimo de um arquivo que importa de outro lugar do mesmo pacote de uso fica, e o que importa da entrada muda', () => {
      const repo = aposOMerge(
        {
          'apps/api/src/local.ts': 'export class Banco {}\n',
          'apps/api/src/usa-local.ts': "import { Banco } from './local.ts'\nexport const l = new Banco()\n",
          'apps/api/src/usa-shared.ts': "import { Banco } from '@educa/shared'\nexport const s = new Banco()\n",
        },
        { '4': mapa([BANCO]) },
      )
      reaplicar(repo.raiz, { executar: repo.executar })
      expect(repo.ler('apps/api/src/local.ts')).toBe('export class Banco {}\n')
      expect(repo.ler('apps/api/src/usa-local.ts')).toBe("import { Banco } from './local.ts'\nexport const l = new Banco()\n")
      expect(repo.ler('apps/api/src/usa-shared.ts')).toBe("import { Database } from '@educa/shared'\nexport const s = new Database()\n")
    })

    it('no pacote da entrada, o arquivo vizinho que usa o nome antigo muda; o import relativo de fora do pacote também', () => {
      const repo = aposOMerge(
        {
          'packages/shared/src/vizinho.ts': "import { Banco } from './db.ts'\nexport const v = new Banco()\n",
          'apps/api/src/por-caminho.ts': "import { Banco } from '../../../packages/shared/src/db.ts'\nexport const p = new Banco()\n",
        },
        { '4': mapa([BANCO]) },
      )
      reaplicar(repo.raiz, { executar: repo.executar })
      expect(repo.ler('packages/shared/src/vizinho.ts')).toBe("import { Database } from './db.ts'\nexport const v = new Database()\n")
      expect(repo.ler('apps/api/src/por-caminho.ts')).toBe("import { Database } from '../../../packages/shared/src/db.ts'\nexport const p = new Database()\n")
    })

    it('no pacote da entrada, o homônimo declarado em outro arquivo e quem o importa ficam; o barrel que reexporta a entrada e quem o usa mudam', () => {
      const repo = aposOMerge(
        {
          'packages/shared/src/Banco.ts': 'export class Banco {}\n',
          'packages/shared/src/usa-homonimo.ts': "import { Banco } from './Banco.ts'\nexport const h = new Banco()\n",
          'packages/shared/src/barrel.ts': "export { Banco } from './db.ts'\n",
          'packages/shared/src/usa-barrel.ts': "import { Banco } from './barrel.ts'\nexport const b = new Banco()\n",
        },
        { '4': mapa([BANCO]) },
      )
      reaplicar(repo.raiz, { executar: repo.executar })
      expect(repo.ler('packages/shared/src/Banco.ts')).toBe('export class Banco {}\n')
      expect(repo.ler('packages/shared/src/usa-homonimo.ts')).toBe("import { Banco } from './Banco.ts'\nexport const h = new Banco()\n")
      expect(repo.ler('packages/shared/src/barrel.ts')).toBe("export { Database } from './db.ts'\n")
      expect(repo.ler('packages/shared/src/usa-barrel.ts')).toBe("import { Database } from './barrel.ts'\nexport const b = new Database()\n")
    })

    it('o pacote já renomeado por uma onda seguinte: o import do nome antigo do pacote ainda leva o símbolo', () => {
      const repo = montarRepositorio({
        'packages/core/package.json': pacoteDeTeste('@educa/core'),
        'packages/core/src/db.ts': 'export class Database {}\n',
        'tools/renomear/mapas/4.json': mapa([{ tipo: 'simbolo', de: 'Banco', para: 'Database', arquivo: 'packages/nucleo/src/db.ts' }]),
        'tools/renomear/mapas/5.json': mapa([
          { tipo: 'pacote', de: '@educa/nucleo', para: '@educa/core' },
          { tipo: 'pasta', de: 'packages/nucleo', para: 'packages/core' },
        ]),
        'apps/api/src/novo.ts': "import { Banco } from '@educa/nucleo'\nexport const n = new Banco()\n",
      })
      reaplicar(repo.raiz, { executar: repo.executar })
      expect(repo.ler('apps/api/src/novo.ts')).toBe("import { Database } from '@educa/core'\nexport const n = new Database()\n")
    })

    it('o arquivo que importa outro nome do módulo da entrada e tem um homônimo local fica: o import de FakeAdapter não traz o Banco', () => {
      const repo = aposOMerge(
        {
          'apps/api/src/local.ts': 'export class Banco {}\n',
          'apps/api/src/misto.ts': "import { FakeAdapter } from '@educa/shared'\nimport { Banco } from './local.ts'\nexport const m = [new FakeAdapter(), new Banco()]\n",
        },
        { '4': mapa([BANCO]) },
      )
      reaplicar(repo.raiz, { executar: repo.executar })
      expect(repo.ler('apps/api/src/misto.ts')).toBe("import { FakeAdapter } from '@educa/shared'\nimport { Banco } from './local.ts'\nexport const m = [new FakeAdapter(), new Banco()]\n")
      expect(repo.ler('apps/api/src/local.ts')).toBe('export class Banco {}\n')
    })

    it('o arquivo da própria entrada, com o nome antigo que o merge trouxe, muda mesmo sem importar nada', () => {
      const repo = aposOMerge(
        { 'packages/shared/src/db.ts': 'export class Database {}\nexport class FakeAdapter {}\nexport const padrao = new Banco()\n' },
        { '4': mapa([BANCO]) },
      )
      reaplicar(repo.raiz, { executar: repo.executar })
      expect(repo.ler('packages/shared/src/db.ts')).toBe('export class Database {}\nexport class FakeAdapter {}\nexport const padrao = new Database()\n')
    })
  })

  it('o passo 5 nos documentos: o nome de arquivo e o domínio entre crases ficam, o identificador e o membro mudam', () => {
    const repo = aposOMerge(
      {
        'docs/guia.md':
          'Rode `node tools/processo/portao-local.ts` e abra `example.com`.\nO `portao` e o `Modulo.com()` mudam; `portao.ts` e `a-portao` não.\n',
      },
      {
        '11': mapa([{ tipo: 'simbolo', de: 'portao', para: 'gate', arquivo: 'e2e/support/checks.ts' }], true),
        '4': mapa([{ tipo: 'simbolo', de: 'com', para: 'forRoot' }]),
        '13': mapa([{ tipo: 'pasta', de: 'docs/velho', para: 'docs/novo' }]),
      },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('docs/guia.md')).toBe('Rode `node tools/processo/portao-local.ts` e abra `example.com`.\nO `gate` e o `Modulo.forRoot()` mudam; `portao.ts` e `a-portao` não.\n')
  })

  it('o que a onda classificou fica não se troca: nem no identificador do arquivo, nem na linha do documento', () => {
    const quatro = JSON.stringify({
      entradas: [{ linhaDoAnexo: ANEXO, ...BANCO }],
      ocorrencias: [
        { arquivo: 'packages/shared/src/mantido.ts', de: 'Banco', classe: 'fica', linha: ANEXO },
        { arquivo: 'docs/guia.md', de: 'Banco', classe: 'fica', linha: ANEXO, trecho: 'Banco` do mockup' },
      ],
    })
    const repo = aposOMerge(
      {
        'packages/shared/src/mantido.ts': "import { Banco } from './db.ts'\nexport const m = new Banco()\n",
        'packages/shared/src/novo.ts': "import { Banco } from './db.ts'\nexport const n = new Banco()\n",
        'docs/guia.md': 'O `Banco` do mockup fica.\nO `Banco` do código muda.\n',
      },
      { '4': quatro, '13': mapa([{ tipo: 'pasta', de: 'docs/velho', para: 'docs/novo' }]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('packages/shared/src/mantido.ts')).toBe("import { Banco } from './db.ts'\nexport const m = new Banco()\n")
    expect(repo.ler('packages/shared/src/novo.ts')).toBe("import { Database } from './db.ts'\nexport const n = new Database()\n")
    expect(repo.ler('docs/guia.md')).toBe('O `Banco` do mockup fica.\nO `Database` do código muda.\n')
  })

  it('a troca à mão que o relatório da onda registrou fica no documento, e o resto do arquivo muda', () => {
    const repo = aposOMerge(
      {
        'docs/guia.md': 'O `Banco` do serviço fica.\n',
        'docs/outro.md': 'O `Banco` muda.\n',
        'tools/renomear/mapas/4.relatorio.md': '## Troca à mão\n\n| Arquivo | Nome | Linhas |\n|---|---|---|\n| docs/guia.md | Banco | 1 |\n\n## Recusas\n',
      },
      { '4': mapa([BANCO]), '13': mapa([{ tipo: 'pasta', de: 'docs/velho', para: 'docs/novo' }]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('docs/guia.md')).toBe('O `Banco` do serviço fica.\n')
    expect(repo.ler('docs/outro.md')).toBe('O `Database` muda.\n')
  })

  it('o que a onda classificou fica não se troca no comentário de código: o comentário vizinho do mesmo arquivo muda', () => {
    const quatro = JSON.stringify({
      entradas: [{ linhaDoAnexo: ANEXO, ...BANCO }],
      ocorrencias: [{ arquivo: 'apps/api/src/c.ts', de: 'Banco', classe: 'fica', linha: ANEXO, trecho: 'Banco` do mockup' }],
    })
    const repo = aposOMerge(
      { 'apps/api/src/c.ts': '// O `Banco` do mockup fica.\nexport const a = 1\n// O `Banco` do código muda.\nexport const b = 2\n' },
      { '4': quatro },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/c.ts')).toBe('// O `Banco` do mockup fica.\nexport const a = 1\n// O `Database` do código muda.\nexport const b = 2\n')
  })

  it('a troca à mão que o relatório registrou fica no comentário de código, e o outro nome, no comentário vizinho, muda', () => {
    const repo = aposOMerge(
      {
        'apps/api/src/d.ts': '// O `Banco` do serviço fica.\nexport const a = 1\n// O `AdaptadorFalso` muda.\nexport const b = 2\n',
        'tools/renomear/mapas/4.relatorio.md': '## Troca à mão\n\n| Arquivo | Nome | Linhas |\n|---|---|---|\n| apps/api/src/d.ts | Banco | 1 |\n\n## Recusas\n',
      },
      { '4': mapa([BANCO, ADAPTADOR]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('apps/api/src/d.ts')).toBe('// O `Banco` do serviço fica.\nexport const a = 1\n// O `FakeAdapter` muda.\nexport const b = 2\n')
  })

  it('o caminho sem extensão não leva o nome de outro arquivo: estilos.css vira index.css e estilos.test.ts fica', () => {
    const repo = aposOMerge(
      { 'docs/guia.md': 'Veja `apps/web/src/estilos.css`, `apps/web/src/estilos.test.ts` e `apps/web/src/estilos`.\n' },
      { '6': mapa([{ tipo: 'arquivo', de: 'apps/web/src/estilos.css', para: 'apps/web/src/index.css' }]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('docs/guia.md')).toBe('Veja `apps/web/src/index.css`, `apps/web/src/estilos.test.ts` e `apps/web/src/index`.\n')
  })

  it('o README de código entra como documento vivo', () => {
    const repo = aposOMerge(
      { 'packages/shared/src/ia/README.md': 'O `AdaptadorFalso` responde.\n', 'README.md': 'Veja o `AdaptadorFalso`.\n' },
      { '7': mapa([ADAPTADOR], true), '13': mapa([{ tipo: 'pasta', de: 'docs/velho', para: 'docs/novo' }]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(repo.ler('packages/shared/src/ia/README.md')).toBe('O `FakeAdapter` responde.\n')
    expect(repo.ler('README.md')).toBe('Veja o `FakeAdapter`.\n')
  })

  it('duas vezes: a segunda não muda nada', () => {
    const repo = aposOMerge(
      { 'apps/api/src/novo.ts': "import { Banco } from '@educa/shared'\n// O Banco, ou o AdaptadorFalso.\nexport const b = new Banco()\n", 'docs/guia.md': 'O AdaptadorFalso.\n' },
      { '4': mapa([BANCO, ADAPTADOR]) },
    )
    reaplicar(repo.raiz, { executar: repo.executar })
    const depoisDaPrimeira = impressao(repo)
    reaplicar(repo.raiz, { executar: repo.executar })
    expect(impressao(repo)).toBe(depoisDaPrimeira)
    expect(repo.ler('docs/guia.md')).toBe('O FakeAdapter.\n')
  })

  it('sem mapa, falha alto', () => {
    const repo = aposOMerge({}, {})
    expect(() => reaplicar(repo.raiz, { executar: repo.executar })).toThrow(/não há mapa em tools\/renomear\/mapas/)
  })

  it('lista a referência por texto que nenhum mapa classifica', () => {
    const repo = aposOMerge({ 'apps/api/src/novo.ts': "export const nome = 'AdaptadorFalso'\n" }, { '7': mapa([ADAPTADOR], true) })
    const resultado = reaplicar(repo.raiz, { executar: repo.executar })
    expect(resultado.novas).toEqual(['apps/api/src/novo.ts:1 cita "AdaptadorFalso": AdaptadorFalso'])
  })

  it('o fica de uma onda num arquivo que uma onda seguinte moveu não é referência nova, e o arquivo que chegou ao caminho antigo é', () => {
    const quatro = JSON.stringify({ entradas: [{ linhaDoAnexo: ANEXO, ...BANCO }], ocorrencias: [{ arquivo: 'apps/api/src/a.ts', de: 'Banco', classe: 'fica', linha: ANEXO }] })
    const cinco = mapa([{ tipo: 'arquivo', de: 'apps/api/src/a.ts', para: 'apps/api/src/b.ts' }])
    const mapas = { '4': quatro, '5': cinco }
    const movido = aposOMerge({ 'apps/api/src/b.ts': "export const nome = 'Banco'\n" }, mapas)
    expect(reaplicar(movido.raiz, { executar: movido.executar }).novas).toEqual([])
    const chegou = aposOMerge({ 'apps/api/src/a.ts': "export const nome = 'Banco'\n", 'apps/api/src/b.ts': "export const nome = 'Banco'\n" }, mapas)
    expect(reaplicar(chegou.raiz, { executar: chegou.executar }).novas).toEqual(['apps/api/src/a.ts:1 cita "Banco": Banco'])
  })
})
