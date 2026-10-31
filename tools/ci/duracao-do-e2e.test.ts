import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  alteracoesDoArquivo,
  avisoDosCasosLentos,
  casosAlterados,
  casosLentos,
  casosMedidos,
  LIMITE_DO_CASO_DE_E2E_MS,
  limiteDoCaso,
  linhasDoDiff,
  motivoDaDuracaoDoE2e,
  PRAZO_PADRAO_DO_CASO_DE_E2E_MS,
  prazoContado,
  prazosDoHead,
  prazosDosCasos,
  relatoriosDoPlaywright,
  semComentarios,
  type CasoMedido,
  type RelatorioDoPlaywright,
} from './duracao-do-e2e.ts'
import { raizRepositorio } from './executar.ts'

const caso = (linha: number, duracaoMs: number, projeto = 'chromebook', arquivo = 'e2e/material.spec.ts', prazoMs = 30_000): CasoMedido => ({
  arquivo,
  linha,
  titulo: `caso da linha ${String(linha)}`,
  projeto,
  duracaoMs,
  prazoMs,
})

/** O formato do repórter `json` do Playwright: o arquivo vem sem o `e2e/`, e o `describe` é uma suíte filha. */
function relatorioDe(...casos: { linha: number; titulo: string; projeto: string; duracoes: number[]; status?: string; timeout?: number }[]): RelatorioDoPlaywright {
  return {
    suites: [
      {
        title: 'material.spec.ts',
        specs: [],
        suites: [
          {
            title: 'material da coordenação',
            specs: casos.map((c) => ({
              title: c.titulo,
              file: 'material.spec.ts',
              line: c.linha,
              tests: [
                {
                  projectName: c.projeto,
                  status: c.status ?? 'expected',
                  results: c.duracoes.map((duration) => ({ duration })),
                  ...(c.timeout === undefined ? {} : { timeout: c.timeout }),
                },
              ],
            })),
          },
        ],
      },
    ],
  }
}

describe('casosMedidos: lê o relatório do repórter json do Playwright', () => {
  it('devolve cada caso em cada projeto, com o arquivo no caminho do repositório e o título com o describe', () => {
    const relatorio = relatorioDe(
      { linha: 10, titulo: 'sobe o PDF', projeto: 'chromebook', duracoes: [4_000] },
      { linha: 10, titulo: 'sobe o PDF', projeto: 'celular', duracoes: [6_000] },
    )
    expect(casosMedidos(relatorio)).toEqual([
      { arquivo: 'e2e/material.spec.ts', linha: 10, titulo: 'material da coordenação › sobe o PDF', projeto: 'chromebook', duracaoMs: 4_000, prazoMs: 30_000 },
      { arquivo: 'e2e/material.spec.ts', linha: 10, titulo: 'material da coordenação › sobe o PDF', projeto: 'celular', duracaoMs: 6_000, prazoMs: 30_000 },
    ])
  })

  it('traz o prazo que a corrida deu ao caso (test.slow, test.setTimeout), e 30 s quando o relatório não o diz', () => {
    const relatorio = relatorioDe(
      { linha: 10, titulo: 'padrão', projeto: 'chromebook', duracoes: [1_000], timeout: 30_000 },
      { linha: 20, titulo: 'com test.slow()', projeto: 'chromebook', duracoes: [1_000], timeout: 90_000 },
      { linha: 30, titulo: 'com test.setTimeout(420_000)', projeto: 'chromebook', duracoes: [1_000], timeout: 420_000 },
      { linha: 40, titulo: 'relatório sem o campo', projeto: 'chromebook', duracoes: [1_000] },
    )
    expect(casosMedidos(relatorio).map((medido) => medido.prazoMs)).toEqual([30_000, 90_000, 420_000, PRAZO_PADRAO_DO_CASO_DE_E2E_MS])
  })

  it('soma as tentativas do mesmo caso e deixa de fora o caso pulado', () => {
    const relatorio = relatorioDe(
      { linha: 10, titulo: 'com nova tentativa', projeto: 'chromebook', duracoes: [9_000, 8_000] },
      { linha: 40, titulo: 'pulado', projeto: 'chromebook', duracoes: [0], status: 'skipped' },
    )
    expect(casosMedidos(relatorio).map((medido) => [medido.linha, medido.duracaoMs])).toEqual([[10, 17_000]])
  })
})

describe('casosLentos: passou de 15 s na máquina, o runner leva o dobro e o prazo é 30 s', () => {
  it('o limite é 15 s', () => {
    expect(LIMITE_DO_CASO_DE_E2E_MS).toBe(15_000)
  })

  it('15,001 s é lento e 15 s exatos ainda cabem; o mais lento vem primeiro', () => {
    const lentos = casosLentos([caso(1, 15_000), caso(2, 15_001), caso(3, 22_000), caso(4, 3_000)])
    expect(lentos.map((lento) => lento.linha)).toEqual([3, 2])
  })

  it('cada caso tem o seu limite: o mesmo tempo é lento para um e cabe em outro', () => {
    const limiteDe = (c: CasoMedido) => (c.linha === 1 ? 45_000 : LIMITE_DO_CASO_DE_E2E_MS)
    const lentos = casosLentos([caso(1, 40_000), caso(1, 45_001), caso(2, 16_000)], limiteDe)
    expect(lentos.map((lento) => [lento.linha, lento.duracaoMs])).toEqual([
      [1, 45_001],
      [2, 16_000],
    ])
  })
})

describe('prazosDosCasos: o prazo que o corpo do caso declara', () => {
  const prazos = (texto: string) => prazosDosCasos(texto).map((c) => [c.titulo, c.prazoMs])

  it('sem declaração é 30 s; test.slow() dá 90 s; test.setTimeout(n) dá n, com ou sem separador de milhar', () => {
    const texto = [
      "test('padrão', async () => {",
      '  await a()',
      '})',
      "test('lento', async () => {",
      '  test.slow()',
      '})',
      "test('de dez mil', async () => {",
      '  test.setTimeout(10_000)',
      '})',
      "test('de quatrocentos mil', async () => {",
      '  test.setTimeout(420000)',
      '})',
    ].join('\n')
    expect(prazos(texto)).toEqual([
      ['padrão', 30_000],
      ['lento', 90_000],
      ['de dez mil', 10_000],
      ['de quatrocentos mil', 420_000],
    ])
  })

  it('segue a ordem do Playwright: setTimeout e depois slow triplica, slow e depois setTimeout troca', () => {
    const texto = ["test('depois', async () => {", '  test.setTimeout(100_000)', '  test.slow()', '})', "test('antes', async () => {", '  test.slow()', '  test.setTimeout(100_000)', '})'].join('\n')
    expect(prazos(texto)).toEqual([
      ['depois', 300_000],
      ['antes', 100_000],
    ])
  })

  it('lê o título com aspas escapadas e o que o prettier pôs na linha de baixo; pula o título de modelo com ${}', () => {
    const texto = [
      "test('o caso d\\'aqui', async () => {",
      '  test.slow()',
      '})',
      'test(',
      "  'título na linha de baixo',",
      '  async () => {',
      '    test.slow()',
      '  },',
      ')',
      'test(`caso de ${nome}`, async () => {',
      '  test.slow()',
      '})',
    ].join('\n')
    expect(prazos(texto)).toEqual([
      ["o caso d'aqui", 90_000],
      ['título na linha de baixo', 90_000],
    ])
  })

  it('o que está depois de um beforeEach não é do caso de cima, e test.slow(condição) não é lido', () => {
    const texto = [
      "test('de cima', async () => {",
      '  await a()',
      '})',
      "test.beforeEach(async () => {",
      '  test.slow()',
      '})',
      "test('condicional', async ({ browserName }) => {",
      "  test.slow(browserName === 'chromium', 'lento no chromium')",
      '})',
    ].join('\n')
    expect(prazos(texto)).toEqual([
      ['de cima', 30_000],
      ['condicional', 30_000],
    ])
  })

  it('cada marcador que encerra o caso de cima (describe, ganchos, use) corta o texto antes do test.slow() que vem depois dele', () => {
    const marcadores = ['describe', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll', 'use']
    const texto = marcadores.flatMap((marcador) => [`test('de cima de ${marcador}', async () => {`, '  await a()', '})', `test.${marcador}(() => {`, '  test.slow()', '})']).join('\n')
    expect(prazos(texto)).toEqual(marcadores.map((marcador) => [`de cima de ${marcador}`, 30_000]))
  })

  it('test.only e test.fixme também abrem caso: o test.slow() deles não é do caso de cima', () => {
    const texto = ["test('de cima', async () => {", '  await a()', '})', "test.only('só este', async () => {", '  test.slow()', '})', "test.fixme('quebrado', async () => {", '  test.slow()', '})'].join('\n')
    expect(prazos(texto)).toEqual([
      ['de cima', 30_000],
      ['só este', 90_000],
      ['quebrado', 90_000],
    ])
  })

  it('lê test.setTimeout(CONSTANTE) com a constante do arquivo feita de números e *, e ignora a que não é', () => {
    const texto = [
      'const PRAZO_DO_ROTEIRO_MS = 8 * 60_000',
      'export const UM_MINUTO_MS = 60_000',
      'const DE_FORA_MS = calcular()',
      "test('roteiro', async () => {",
      '  test.setTimeout(PRAZO_DO_ROTEIRO_MS)',
      '})',
      "test('minuto, e depois slow', async () => {",
      '  test.setTimeout(UM_MINUTO_MS)',
      '  test.slow()',
      '})',
      "test('constante que não é número', async () => {",
      '  test.setTimeout(DE_FORA_MS)',
      '})',
      "test('constante que não existe', async () => {",
      '  test.setTimeout(NAO_EXISTE_MS)',
      '})',
      'const SOMADO_MS = 8 * 60_000 + 1',
      'const MINUTO_2 = 60_000',
      "test('constante com dígito no nome', async () => {",
      '  test.setTimeout(MINUTO_2)',
      '})',
      "test('constante somada', async () => {",
      '  test.setTimeout(SOMADO_MS)',
      '})',
      "test('constante de dentro de uma função', async () => {",
      '  const DE_DENTRO_MS = 60_000',
      '  test.setTimeout(DE_DENTRO_MS)',
      '})',
    ].join('\n')
    expect(prazos(texto)).toEqual([
      ['roteiro', 480_000],
      ['minuto, e depois slow', 180_000],
      ['constante que não é número', 30_000],
      ['constante que não existe', 30_000],
      ['constante com dígito no nome', 60_000],
      ['constante somada', 30_000],
      ['constante de dentro de uma função', 30_000],
    ])
  })

  it('o título entre aspas duplas abre caso; nome que só termina em test não abre caso, não declara prazo nem encerra o caso', () => {
    const texto = [
      'test("de aspas duplas", async () => {',
      "  await contest('falso')",
      '  meutest.slow()',
      '  meutest.setTimeout(100_000)',
      '  meutest.describe()',
      '  test.user()',
      '  test.slow()',
      '})',
    ].join('\n')
    expect(prazos(texto)).toEqual([['de aspas duplas', 90_000]])
  })

  it('o roteiro da demonstração, como está escrito no repositório, declara 8 min', () => {
    const roteiro = readFileSync(join(raizRepositorio, 'e2e/roteiro-da-demonstracao.spec.ts'), 'utf8')
    expect(prazosDosCasos(roteiro).map((c) => c.prazoMs)).toContain(480_000)
  })

  it('semComentarios tira o de linha e o de bloco, sem mexer no que está entre aspas', () => {
    expect(semComentarios("a /* x */ b // y\nc 'd // e' \"f /* g */\"")).toBe("a  b \nc 'd // e' \"f /* g */\"")
    expect(semComentarios('a /* sem fim')).toBe('a ')
    expect(semComentarios('a // sem fim de linha')).toBe('a ')
    expect(semComentarios('a `h // i` b')).toBe('a `h // i` b')
    expect(semComentarios('a / b /* c */ d')).toBe('a / b  d')
    expect(semComentarios('a /*/ b */ c')).toBe('a  c')
  })

  it('comentário não é declaração: o test.slow() e o test.setTimeout() citados em comentário não valem, e o que está entre aspas fica', () => {
    const texto = [
      "test('citado em comentário', async () => {",
      '  // limite do `test.slow()`',
      '  /* e test.setTimeout(100_000),',
      '     numa linha de baixo */',
      '  await a()',
      '})',
      "test('endereço com barras', async () => {",
      "  await page.goto('http://x.invalid/a'); test.slow()",
      '})',
      "test('aspa escapada', async () => {",
      "  await a('it\\'s'); // test.slow()",
      '})',
    ].join('\n')
    expect(prazos(texto)).toEqual([
      ['citado em comentário', 30_000],
      ['endereço com barras', 90_000],
      ['aspa escapada', 30_000],
    ])
  })
})

describe('prazoContado e limiteDoCaso: só o prazo que já estava no HEAD vale', () => {
  const noHead = new Map([['caso com prazo', 90_000]])
  const comPrazo = (prazoMs: number, titulo = 'caso com prazo'): CasoMedido => ({ ...caso(1, 1, 'chromebook', 'e2e/novo.spec.ts', prazoMs), titulo })

  it('sem prazo próprio o limite continua 15 s', () => {
    expect(limiteDoCaso(comPrazo(30_000), noHead)).toBe(LIMITE_DO_CASO_DE_E2E_MS)
    expect(limiteDoCaso(comPrazo(30_000), new Map())).toBe(15_000)
  })

  it('o prazo declarado que o HEAD já tinha dá limite de metade dele, também para o caso que mudou de arquivo e de describe', () => {
    expect(limiteDoCaso(comPrazo(90_000), noHead)).toBe(45_000)
    expect(limiteDoCaso({ ...comPrazo(90_000), titulo: 'outro describe › caso com prazo' }, noHead)).toBe(45_000)
  })

  it('o prazo posto agora não conta: caso que o HEAD não tinha, ou que o HEAD tinha sem prazo, mede 15 s', () => {
    expect(limiteDoCaso(comPrazo(90_000, 'caso novo'), noHead)).toBe(15_000)
    expect(limiteDoCaso(comPrazo(90_000, 'caso que estava no HEAD sem prazo'), new Map([['caso que estava no HEAD sem prazo', 30_000]]))).toBe(15_000)
  })

  it('o prazo maior de agora não passa o do HEAD, e o menor de agora vale', () => {
    expect(prazoContado(comPrazo(420_000), noHead)).toBe(90_000)
    expect(prazoContado(comPrazo(60_000), noHead)).toBe(60_000)
    expect(limiteDoCaso(comPrazo(10_000), noHead)).toBe(5_000)
  })

  it('declaração de menos de 30 s no HEAD não aperta o caso que a tirou: o piso é o prazo padrão', () => {
    expect(prazoContado(comPrazo(60_000, 'curto'), new Map([['curto', 10_000]]))).toBe(30_000)
  })

  it('o aviso diz o limite de cada caso e que o prazo posto agora não aumenta o limite', () => {
    const lento = { ...caso(7, 50_000, 'chromebook', 'e2e/a.spec.ts', 90_000), titulo: 'caso com prazo' }
    const aviso = avisoDosCasosLentos([lento], (c) => limiteDoCaso(c, noHead))
    expect(aviso).toContain('e2e/a.spec.ts:7 (chromebook) levou 50,0 s (limite 45,0 s)')
    expect(aviso).toContain('já estava no HEAD')
  })
})

describe('linhasDoDiff: as linhas do arquivo novo que o diff tocou', () => {
  it('lê o trecho de uma linha, o de várias e a remoção pura, que conta como a linha de cima', () => {
    const diff = ['@@ -5 +5 @@', '-a', '+b', '@@ -20,2 +20,3 @@', '-c', '-d', '+e', '+f', '+g', '@@ -40,2 +42,0 @@', '-x', '-y'].join('\n')
    expect([...linhasDoDiff(diff)].sort((a, b) => a - b)).toEqual([5, 20, 21, 22, 42])
  })
})

describe('casosAlterados: só o caso cujas linhas o diff tocou', () => {
  // Três casos, de 10 a 29, de 30 a 59 e de 60 em diante.
  const casos = [caso(10, 1), caso(30, 1), caso(60, 1)]
  const alterar = (...linhas: number[]) => casosAlterados(casos, () => new Set(linhas)).map((alterado) => alterado.linha)

  it('a linha de dentro do caso o altera, e só ele', () => {
    expect(alterar(35)).toEqual([30])
  })

  it('a primeira e a última linha do intervalo contam; a linha do caso seguinte já é dele', () => {
    expect(alterar(10)).toEqual([10])
    expect(alterar(29)).toEqual([10])
    expect(alterar(30)).toEqual([30])
    expect(alterar(100)).toEqual([60])
  })

  it('linha antes do primeiro caso (importação, ajudante do alto) não é de caso nenhum', () => {
    expect(alterar(3)).toEqual([])
  })

  it('o caso é alterado nos dois projetos', () => {
    const nosDois = [caso(30, 1, 'chromebook'), caso(30, 1, 'celular'), caso(60, 1, 'chromebook')]
    expect(casosAlterados(nosDois, () => new Set([31])).map((alterado) => alterado.projeto)).toEqual(['chromebook', 'celular'])
  })

  it('arquivo novo tem todos os casos alterados', () => {
    expect(casosAlterados(casos, () => 'tudo')).toHaveLength(3)
  })

  it('cada arquivo é conferido pela sua própria alteração', () => {
    const dois = [caso(10, 1, 'chromebook', 'e2e/a.spec.ts'), caso(10, 1, 'chromebook', 'e2e/b.spec.ts')]
    const alterados = casosAlterados(dois, (arquivo) => (arquivo === 'e2e/b.spec.ts' ? new Set([10]) : new Set<number>()))
    expect(alterados.map((alterado) => alterado.arquivo)).toEqual(['e2e/b.spec.ts'])
  })
})

describe('relatoriosDoPlaywright: o json só entra quando o portão pede', () => {
  it('sem o arquivo, a lista de sempre: list, e o github na esteira', () => {
    expect(relatoriosDoPlaywright(false, undefined)).toEqual([['list']])
    expect(relatoriosDoPlaywright(true, undefined)).toEqual([['list'], ['github']])
  })

  it('com o arquivo, acrescenta o json que grava nele, sem tirar os de sempre', () => {
    expect(relatoriosDoPlaywright(false, '/tmp/x.json')).toEqual([['list'], ['json', { outputFile: '/tmp/x.json' }]])
    expect(relatoriosDoPlaywright(true, '/tmp/x.json')).toEqual([['list'], ['github'], ['json', { outputFile: '/tmp/x.json' }]])
  })
})

describe('no repositório: o diff do git decide qual caso é alterado', () => {
  const pastas: string[] = []
  afterEach(() => {
    for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true })
  })

  const git = (raiz: string, ...argumentos: string[]) => execFileSync('git', argumentos, { cwd: raiz, encoding: 'utf8' })

  /** Um spec de três casos nas linhas 2, 7 e 13, já commitado. */
  function repositorioComSpec(): string {
    const raiz = mkdtempSync(join(tmpdir(), 'duracao-e2e-'))
    pastas.push(raiz)
    git(raiz, 'init', '-q')
    git(raiz, 'config', 'user.email', 'teste@educa.invalid')
    git(raiz, 'config', 'user.name', 'teste')
    // O repositório temporário herda o git global: numa máquina que assina todo commit, o `git commit` do teste falharia.
    git(raiz, 'config', 'commit.gpgsign', 'false')
    mkdirSync(join(raiz, 'e2e'))
    const linhas = [
      "import { test } from '@playwright/test'",
      "test('primeiro', async () => {",
      '  await a()',
      '  await b()',
      '  await c()',
      '})',
      "test('segundo', async () => {",
      '  await a()',
      '  await b()',
      '  await c()',
      '})',
      '',
      "test('terceiro', async () => {",
      '  await a()',
      '})',
      '',
    ]
    writeFileSync(join(raiz, 'e2e/material.spec.ts'), linhas.join('\n'))
    git(raiz, 'add', '.')
    git(raiz, 'commit', '-q', '-m', 'spec')
    return raiz
  }

  function relatorioNo(raiz: string): string {
    const relatorio = relatorioDe(
      { linha: 2, titulo: 'primeiro', projeto: 'chromebook', duracoes: [21_000] },
      { linha: 7, titulo: 'segundo', projeto: 'chromebook', duracoes: [19_000] },
      { linha: 13, titulo: 'terceiro', projeto: 'chromebook', duracoes: [2_000] },
    )
    const caminho = join(raiz, 'relatorio.json')
    writeFileSync(caminho, JSON.stringify(relatorio))
    return caminho
  }

  it('o caso lento que a tarefa não tocou não reprova; o que ela tocou, sim, com arquivo, linha, projeto e segundos', () => {
    const raiz = repositorioComSpec()
    const original = readFileSync(join(raiz, 'e2e/material.spec.ts'), 'utf8')
    writeFileSync(join(raiz, 'e2e/material.spec.ts'), original.replace('  await b()\n  await c()\n})\n\n', '  await b()\n  await d()\n})\n\n'))
    const motivo = motivoDaDuracaoDoE2e(raiz, relatorioNo(raiz))
    expect(motivo).toContain('e2e/material.spec.ts:7 (chromebook) levou 19,0 s')
    expect(motivo).not.toContain('e2e/material.spec.ts:2')
    expect(motivo).toContain('1 caso(s)')
  })

  it('caso alterado dentro dos 15 s passa, mesmo com o arquivo cheio de caso lento que ficou como estava', () => {
    const raiz = repositorioComSpec()
    const original = readFileSync(join(raiz, 'e2e/material.spec.ts'), 'utf8')
    writeFileSync(join(raiz, 'e2e/material.spec.ts'), original.replace("  await a()\n})\n", '  await z()\n})\n'))
    expect(motivoDaDuracaoDoE2e(raiz, relatorioNo(raiz))).toBeNull()
  })

  it('arquivo de e2e novo, ainda fora do git, tem todos os casos alterados', () => {
    const raiz = repositorioComSpec()
    const novo = readFileSync(join(raiz, 'e2e/material.spec.ts'), 'utf8')
    writeFileSync(join(raiz, 'e2e/novo.spec.ts'), novo)
    expect(alteracoesDoArquivo(raiz, 'e2e/novo.spec.ts')).toBe('tudo')
    const relatorio = relatorioDe({ linha: 2, titulo: 'lento e novo', projeto: 'celular', duracoes: [16_000] })
    const caminho = join(raiz, 'novo.json')
    writeFileSync(caminho, JSON.stringify(relatorio).replace(/material\.spec\.ts/g, 'novo.spec.ts'))
    expect(motivoDaDuracaoDoE2e(raiz, caminho)).toContain('e2e/novo.spec.ts:2 (celular) levou 16,0 s')
  })

  /** O relatório de um caso, com o prazo que a corrida lhe deu. */
  function relatorioDoCaso(raiz: string, arquivo: string, titulo: string, duracaoMs: number, timeout: number, linha = 2): string {
    const relatorio = relatorioDe({ linha, titulo, projeto: 'chromebook', duracoes: [duracaoMs], timeout })
    const caminho = join(raiz, `${titulo.replaceAll(/\W/g, '-')}.json`)
    writeFileSync(caminho, JSON.stringify(relatorio).replace(/material\.spec\.ts/g, arquivo))
    return caminho
  }

  /** Um HEAD com dois casos: `lento` declara `test.slow()` e `comum` não declara nada. */
  function repositorioComCasoLento(): string {
    const raiz = mkdtempSync(join(tmpdir(), 'duracao-e2e-prazo-'))
    pastas.push(raiz)
    git(raiz, 'init', '-q')
    git(raiz, 'config', 'user.email', 'teste@educa.invalid')
    git(raiz, 'config', 'user.name', 'teste')
    git(raiz, 'config', 'commit.gpgsign', 'false')
    mkdirSync(join(raiz, 'e2e'))
    const linhas = ["test('lento', async () => {", '  test.slow()', '  await a()', '})', "test('comum', async () => {", '  await a()', '})', '']
    writeFileSync(join(raiz, 'e2e/antigo.spec.ts'), linhas.join('\n'))
    git(raiz, 'add', '.')
    git(raiz, 'commit', '-q', '-m', 'spec')
    return raiz
  }

  it('prazosDoHead lê o prazo de cada título dos specs do HEAD, e fica vazio fora de um repositório com commit', () => {
    const raiz = repositorioComCasoLento()
    expect([...prazosDoHead(raiz)]).toEqual([
      ['lento', 90_000],
      ['comum', 30_000],
    ])
    // O mesmo título em dois specs: vale o menor prazo, e não o do último arquivo lido (`a-repetido` vem antes de `antigo`).
    writeFileSync(join(raiz, 'e2e/a-repetido.spec.ts'), ["test('lento', async () => {", '  await a()', '})', ''].join('\n'))
    // Só o `*.spec.ts` é caso: o ajudante em `__fixtures__` pode escrever `test(` sem ser um.
    mkdirSync(join(raiz, 'e2e/support'))
    writeFileSync(join(raiz, 'e2e/support/ajudante.ts'), ["test('só no ajudante', async () => {", '  test.slow()', '})', ''].join('\n'))
    // Só o que está em `e2e/`: um `*.spec.ts` de outra pasta não é caso do Playwright.
    mkdirSync(join(raiz, 'fora'))
    writeFileSync(join(raiz, 'fora/outro.spec.ts'), ["test('fora do e2e', async () => {", '  test.slow()', '})', ''].join('\n'))
    git(raiz, 'add', '.')
    git(raiz, 'commit', '-q', '-m', 'repetido')
    expect(prazosDoHead(raiz).get('lento')).toBe(30_000)
    expect(prazosDoHead(raiz).has('só no ajudante')).toBe(false)
    expect(prazosDoHead(raiz).has('fora do e2e')).toBe(false)
    const semGit = mkdtempSync(join(tmpdir(), 'duracao-e2e-sem-git-'))
    pastas.push(semGit)
    expect(prazosDoHead(semGit).size).toBe(0)
  })

  it('o caso que já tinha test.slow() e foi alterado mede contra 45 s: 40 s cabem e 46 s não', () => {
    const raiz = repositorioComCasoLento()
    const texto = readFileSync(join(raiz, 'e2e/antigo.spec.ts'), 'utf8')
    writeFileSync(join(raiz, 'e2e/antigo.spec.ts'), texto.replace('await a()\n})\n' + "test('comum'", 'await b()\n})\n' + "test('comum'"))
    expect(motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'antigo.spec.ts', 'lento', 40_000, 90_000, 1))).toBeNull()
    const motivo = motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'antigo.spec.ts', 'lento', 46_000, 90_000, 1))
    expect(motivo).toContain('e2e/antigo.spec.ts:1 (chromebook) levou 46,0 s (limite 45,0 s)')
  })

  it('o caso movido para um spec novo leva o prazo que tinha no HEAD, e o test.slow() posto agora num caso que o HEAD não tinha não conta', () => {
    const raiz = repositorioComCasoLento()
    writeFileSync(join(raiz, 'e2e/movido.spec.ts'), ["test('lento', async () => {", '  test.slow()', '})', "test('estreante', async () => {", '  test.slow()', '})', ''].join('\n'))
    expect(motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'movido.spec.ts', 'lento', 40_000, 90_000, 1))).toBeNull()
    const motivo = motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'movido.spec.ts', 'estreante', 20_000, 90_000, 4))
    expect(motivo).toContain('e2e/movido.spec.ts:4 (chromebook) levou 20,0 s (limite 15,0 s)')
  })

  describe('o caso retitulado (RF11): o título novo leva o prazo do caso de corpo idêntico', () => {
    const retitular = (raiz: string, de: string, para: string, arquivo = 'e2e/antigo.spec.ts') =>
      writeFileSync(join(raiz, arquivo), readFileSync(join(raiz, arquivo), 'utf8').replace(`test('${de}'`, `test('${para}'`))

    it('título novo e corpo idêntico ao do HEAD com test.slow() herda os 90 s: 40 s cabem e 46 s não', () => {
      const raiz = repositorioComCasoLento()
      retitular(raiz, 'lento', 'lento com outro nome')
      expect(prazosDoHead(raiz).get('lento com outro nome')).toBe(90_000)
      expect(motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'antigo.spec.ts', 'lento com outro nome', 40_000, 90_000, 1))).toBeNull()
      const motivo = motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'antigo.spec.ts', 'lento com outro nome', 46_000, 90_000, 1))
      expect(motivo).toContain('e2e/antigo.spec.ts:1 (chromebook) levou 46,0 s (limite 45,0 s)')
    })

    it('lê a árvore como ela está: spec novo fora do git conta, spec apagado, ignorado ou que não é *.spec.ts não derruba nem se mistura', () => {
      const raiz = repositorioComCasoLento()
      writeFileSync(join(raiz, 'e2e/apagado.spec.ts'), ["test('apagado', async () => {", '  await z()', '})', ''].join('\n'))
      git(raiz, 'add', '.')
      git(raiz, 'commit', '-q', '-m', 'apagado')
      rmSync(join(raiz, 'e2e/apagado.spec.ts'))
      // Os dois com o corpo do caso lento: se algum fosse lido como caso da árvore, o corpo teria duas cópias.
      const corpo = ["test('só no ajudante', async () => {", '  test.slow()', '  await a()', '})', ''].join('\n')
      mkdirSync(join(raiz, 'e2e/support'))
      writeFileSync(join(raiz, 'e2e/support/ajudante.ts'), corpo)
      writeFileSync(join(raiz, '.gitignore'), 'e2e/ignorado.spec.ts\n')
      writeFileSync(join(raiz, 'e2e/ignorado.spec.ts'), corpo.replace('só no ajudante', 'ignorado'))
      // O caso muda de nome e de arquivo, e o arquivo novo ainda está fora do git.
      writeFileSync(join(raiz, 'e2e/antigo.spec.ts'), ["test('comum', async () => {", '  await a()', '})', ''].join('\n'))
      writeFileSync(join(raiz, 'e2e/movido.spec.ts'), ["test('lento no arquivo novo', async () => {", '  test.slow()', '  await a()', '})', ''].join('\n'))
      expect(prazosDoHead(raiz).get('lento no arquivo novo')).toBe(90_000)
    })

    it('as pontas em branco não mudam o corpo: o último caso do spec, que perde o título e ganha linhas em branco no fim, ainda herda os 90 s', () => {
      const raiz = repositorioComCasoLento()
      writeFileSync(join(raiz, 'e2e/ultimo.spec.ts'), ["test('último lento', async () => {", '  test.slow()', '  await ultimo()', '})', ''].join('\n'))
      git(raiz, 'add', '.')
      git(raiz, 'commit', '-q', '-m', 'último')
      writeFileSync(join(raiz, 'e2e/ultimo.spec.ts'), ["test('último lento com outro nome', async () => {", '  test.slow()', '  await ultimo()', '})', '', '', ''].join('\n'))
      expect(prazosDoHead(raiz).get('último lento com outro nome')).toBe(90_000)
    })

    it('só mudar um comentário do corpo conta como corpo idêntico: o título novo herda os 90 s', () => {
      const raiz = repositorioComCasoLento()
      writeFileSync(join(raiz, 'e2e/comentado.spec.ts'), ["test('comentado lento', async () => {", '  test.slow()', '  // a primeira nota', '  await comentado()', '})', ''].join('\n'))
      git(raiz, 'add', '.')
      git(raiz, 'commit', '-q', '-m', 'comentado')
      writeFileSync(
        join(raiz, 'e2e/comentado.spec.ts'),
        ["test('comentado lento com outro nome', async () => {", '  test.slow()', '  // outra nota, bem mais comprida que a primeira', '  await comentado()', '})', ''].join('\n'),
      )
      expect(prazosDoHead(raiz).get('comentado lento com outro nome')).toBe(90_000)
    })

    it('título novo e corpo mudado não herda: o test.slow() do caso velho não cobre o que mudou', () => {
      const raiz = repositorioComCasoLento()
      const texto = readFileSync(join(raiz, 'e2e/antigo.spec.ts'), 'utf8')
      writeFileSync(join(raiz, 'e2e/antigo.spec.ts'), texto.replace("test('lento'", "test('lento mudado'").replace('  await a()\n})\ntest(\'comum', "  await b()\n})\ntest('comum"))
      expect(prazosDoHead(raiz).has('lento mudado')).toBe(false)
      const motivo = motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'antigo.spec.ts', 'lento mudado', 20_000, 90_000, 1))
      expect(motivo).toContain('e2e/antigo.spec.ts:1 (chromebook) levou 20,0 s (limite 15,0 s)')
    })

    it('dois corpos iguais no HEAD: nenhum herda, nem quando um deles sai da árvore', () => {
      const raiz = repositorioComCasoLento()
      writeFileSync(join(raiz, 'e2e/gemeo.spec.ts'), ["test('gêmeo lento', async () => {", '  test.slow()', '  await a()', '})', ''].join('\n'))
      git(raiz, 'add', '.')
      git(raiz, 'commit', '-q', '-m', 'gêmeo')
      retitular(raiz, 'lento', 'lento com outro nome')
      expect(prazosDoHead(raiz).has('lento com outro nome')).toBe(false)
      expect(motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'antigo.spec.ts', 'lento com outro nome', 20_000, 90_000, 1))).toContain('limite 15,0 s')
      // O gêmeo que sai de vez da árvore também não faz do que ficou o dono do corpo: o HEAD ainda tinha dois.
      rmSync(join(raiz, 'e2e/gemeo.spec.ts'))
      expect(prazosDoHead(raiz).has('lento com outro nome')).toBe(false)
    })

    it('o corpo copiado para um caso novo, com o título velho ainda lá, não herda; nem duas cópias do corpo de um que sumiu', () => {
      const raiz = repositorioComCasoLento()
      writeFileSync(join(raiz, 'e2e/copia.spec.ts'), ["test('cópia do lento', async () => {", '  test.slow()', '  await a()', '})', ''].join('\n'))
      expect(prazosDoHead(raiz).has('cópia do lento')).toBe(false)
      expect(motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'copia.spec.ts', 'cópia do lento', 20_000, 90_000, 1))).toContain('limite 15,0 s')
      // O velho muda de nome e a cópia aparece junto: são dois corpos iguais na árvore, e não dá para dizer qual é o retitulado.
      retitular(raiz, 'lento', 'lento com outro nome')
      expect(prazosDoHead(raiz).has('lento com outro nome')).toBe(false)
      expect(prazosDoHead(raiz).has('cópia do lento')).toBe(false)
    })
  })

  it('test.slow() posto agora num caso que o HEAD tinha sem prazo não aumenta o limite', () => {
    const raiz = repositorioComCasoLento()
    const texto = readFileSync(join(raiz, 'e2e/antigo.spec.ts'), 'utf8')
    writeFileSync(join(raiz, 'e2e/antigo.spec.ts'), texto.replace("test('comum', async () => {\n", "test('comum', async () => {\n  test.slow()\n"))
    expect(motivoDaDuracaoDoE2e(raiz, relatorioDoCaso(raiz, 'antigo.spec.ts', 'comum', 20_000, 90_000, 5))).toContain('levou 20,0 s (limite 15,0 s)')
  })

  it('sem o relatório, ou com ele ilegível, o portão reprova: não mediu nada', () => {
    const raiz = repositorioComSpec()
    expect(motivoDaDuracaoDoE2e(raiz, join(raiz, 'nao-existe.json'))).toContain('não deixou o relatório de duração')
    const quebrado = join(raiz, 'quebrado.json')
    writeFileSync(quebrado, '{ não é json')
    expect(motivoDaDuracaoDoE2e(raiz, quebrado)).toContain('não é um JSON legível')
  })
})

describe('as ligações que nenhuma função sozinha prova', () => {
  const ler = (arquivo: string) => readFileSync(join(raizRepositorio, arquivo), 'utf8')

  it('o playwright.config.ts monta os repórteres por relatoriosDoPlaywright, com a variável do portão', () => {
    const configuracao = ler('playwright.config.ts')
    expect(configuracao).toMatch(/reporter: relatoriosDoPlaywright\(process\.env\['CI'\] === 'true', process\.env\[VARIAVEL_DO_RELATORIO_DO_E2E\]\)/)
  })

  it('o portão da tarefa passa a variável só ao e2e e reprova pela duração antes das mutações', () => {
    const portao = ler('tools/processo/portao-local.ts')
    expect(portao).toMatch(/daTarefa && passo\.comando\.includes\('tools\/ci\/e2e\.ts'\) \? \{ \.\.\.ambiente, \[VARIAVEL_DO_RELATORIO_DO_E2E\]: relatorioDoE2e \}/)
    expect(portao).toMatch(/daTarefa && alvos\.e2e\.length > 0 \? motivoDaDuracaoDoE2e\(raiz, relatorioDoE2e\) : null/)
    // É a chamada que entrega a variável ao e2e, e o relatório da corrida anterior que sai antes dela: sem um dos dois o portão lê relatório velho.
    expect(portao).toContain('rodar(passo.comando, ambienteDoPasso(passo))')
    expect(portao).toMatch(/if \(daTarefa\) \{\n {2}rmSync\(relatorioDoE2e, \{ force: true \}\)/)
    expect(portao.indexOf('motivoDaDuracaoDoE2e(raiz, relatorioDoE2e)')).toBeLessThan(portao.indexOf('conferirMutacoesDoDocumento(raiz'))
  })

  it('o portão liga a sequência pura às suítes, aos serviços de job e às mutações de integração', () => {
    // `portao-local.ts` executa ao ser importado e não tem teste de unidade: o que ele entrega a `sequencia-do-portao.ts` só é
    // provado pelo texto. A ordem e o conteúdo da sequência são provados em `tools/processo/portao-local.test.ts`.
    const portao = ler('tools/processo/portao-local.ts')
    expect(portao).toContain("const suites = suitesDoPortao({ daTarefa, e2e: argumentos.includes('--e2e'), infra: argumentos.includes('--infra') })")
    expect(portao).toContain("const textoDoDocumento = documento ? readFileSync(join(raiz, documento), 'utf8') : null")
    expect(portao).toContain('const mutacoesDeIntegracao = textoDoDocumento !== null && mutacaoDeIntegracao(lerMutacoes(textoDoDocumento).mutacoes)')
    expect(portao).toContain(
      "const sequencia = sequenciaDoPortao(suites, { alvos, docker: ['docker', ...ARGUMENTOS_COMPOSE], servicosDeJob: servicosDeJob(), mutacoesDeIntegracao })",
    )
    expect(portao).toContain('if (documento && textoDoDocumento !== null) {')
    // O `stop` das mutações é um passo da sequência: ela e a leitura do documento vêm antes de qualquer mutação.
    expect(portao.indexOf('const mutacoesDeIntegracao')).toBeLessThan(portao.indexOf('const sequencia = sequenciaDoPortao'))
    expect(portao.indexOf('const sequencia = sequenciaDoPortao')).toBeLessThan(portao.indexOf('conferirMutacoesDoDocumento(raiz'))
  })
})
