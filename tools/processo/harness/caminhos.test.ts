// Nada que o harness cita aponta para caminho que não existe (X7, RF24).
//
// Papel, regra e guarda mandam ler um arquivo, rodar um teste, abrir uma pasta. Quando o arquivo muda de lugar, o texto
// continua mandando ir para o lugar velho, e quem obedece perde tempo ou, pior, acha que a regra não vale mais. Foi o caso
// de `apps/api/src/ia/adapters`: a regra 30, o `llm-integrator` e a guarda de SDK de IA citavam a pasta que já não existia, e a
// guarda isentava um lugar vazio e vigiava o lugar onde os adaptadores estão de fato.
//
// A fronteira do que se confere: `.claude/agents/*.md`, `.claude/rules/*.md` e `tools/guardas/` sem os `*.test.ts` e sem
// `__fixtures__/` (as amostras erradas de propósito). A extração mora em `caminhos.ts` e devolve o token cru; cada conferência
// filtra o seu, e a 21.0 a reaproveita para a skill de receitas, com outro filtro. Os limites da extração estão lá; o teste prova
// que o caminho existe, não que o texto em volta ainda diz a verdade sobre ele.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ehCaminho, ehPasta, extrairCaminhos, PASTAS_DA_RAIZ, problemaDoCaminho } from './caminhos.ts'

const RAIZ = join(import.meta.dirname, '..', '..', '..')

const PASTAS_DOS_PAPEIS = ['.claude/agents', '.claude/rules']
const PASTA_DAS_GUARDAS = 'tools/guardas'
const MINIMO_DE_CAMINHOS = 100

/** Os arquivos de uma pasta, relativos à raiz; a pasta que não existe devolve lista vazia. */
function arquivosDe(raiz: string, pasta: string, recursivo: boolean): string[] {
  const dir = join(raiz, pasta)
  if (!ehPasta(dir)) return []
  return readdirSync(dir, { recursive: recursivo, withFileTypes: true })
    .filter((entrada) => entrada.isFile())
    .map((entrada) => join(relative(raiz, entrada.parentPath), entrada.name))
}

const ehAmostra = (arquivo: string): boolean => /\.test\.ts$/.test(arquivo) || arquivo.split('/').includes('__fixtures__')

/** Os arquivos dentro da fronteira, por pasta: `.claude/agents`, `.claude/rules` e `tools/guardas`, sem teste nem amostra. */
export function arquivosDaFronteira(raiz: string): Record<string, string[]> {
  const dosPapeis = Object.fromEntries(PASTAS_DOS_PAPEIS.map((pasta) => [pasta, arquivosDe(raiz, pasta, false).filter((arquivo) => arquivo.endsWith('.md'))]))
  return { ...dosPapeis, [PASTA_DAS_GUARDAS]: arquivosDe(raiz, PASTA_DAS_GUARDAS, true).filter((arquivo) => !ehAmostra(arquivo)) }
}

interface Conferencia {
  /** Uma frase por problema, com o arquivo que cita. */
  problemas: string[]
  /** Cada caminho conferido, com o arquivo que o cita. */
  conferidos: { arquivo: string; caminho: string }[]
}

/** Confere todo caminho citado dentro da fronteira sob `raiz`. Pasta da fronteira sem arquivo nenhum é problema: a conferência não vigiaria nada. */
export function conferir(raiz: string): Conferencia {
  const problemas: string[] = []
  const conferidos: Conferencia['conferidos'] = []
  for (const [pasta, arquivos] of Object.entries(arquivosDaFronteira(raiz))) {
    if (arquivos.length === 0) problemas.push(`${pasta}: nenhum arquivo para conferir`)
    for (const arquivo of arquivos) {
      const texto = readFileSync(join(raiz, arquivo), 'utf8')
      for (const caminho of extrairCaminhos(texto).filter(ehCaminho)) {
        conferidos.push({ arquivo, caminho })
        const problema = problemaDoCaminho(caminho, raiz)
        if (problema !== null) problemas.push(`${arquivo} cita ${caminho}: ${problema}`)
      }
    }
  }
  return { problemas, conferidos }
}

const pastas: string[] = []
afterEach(() => {
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true })
})

/** Uma amostra mínima em pasta temporária: um arquivo em cada pasta da fronteira, mais o que o caso acrescenta. Nome terminado em `/` é pasta vazia. */
function amostra(acrescenta: Record<string, string>): string {
  const raiz = mkdtempSync(join(tmpdir(), 'caminhos-'))
  pastas.push(raiz)
  const arquivos: Record<string, string> = {
    '.claude/rules/10-a.md': '# A regra\n',
    '.claude/agents/a.md': '# O papel\n',
    'tools/guardas/g.mjs': '// a guarda\n',
    'apps/api/src/existe.ts': 'export {}\n',
    ...acrescenta,
  }
  for (const [nome, texto] of Object.entries(arquivos)) {
    if (nome.endsWith('/')) {
      mkdirSync(join(raiz, nome), { recursive: true })
      continue
    }
    mkdirSync(join(raiz, dirname(nome)), { recursive: true })
    writeFileSync(join(raiz, nome), texto)
  }
  return raiz
}

const aCitar = (...caminhos: string[]): Record<string, string> => ({ '.claude/rules/10-a.md': `# A regra\n\n${caminhos.join('\n')}\n` })

describe('os caminhos que papel, regra e guarda citam (RF24)', () => {
  it('o repositório de hoje passa, com contagem mínima e ao menos um caminho em cada pasta da raiz', () => {
    const { problemas, conferidos } = conferir(RAIZ)
    expect(problemas).toEqual([])
    expect(conferidos.length).toBeGreaterThanOrEqual(MINIMO_DE_CAMINHOS)
    for (const pasta of PASTAS_DA_RAIZ) {
      expect(
        conferidos.filter(({ caminho }) => caminho.replace(/^\.\//, '').startsWith(pasta)).length,
        `nenhum caminho conferido em ${pasta}`,
      ).toBeGreaterThan(0)
    }
  })

  it('a fronteira de hoje enxerga as três pastas, e os testes e as amostras de tools/guardas ficam de fora', () => {
    const fronteira = arquivosDaFronteira(RAIZ)
    expect(Object.keys(fronteira).sort()).toEqual(['.claude/agents', '.claude/rules', 'tools/guardas'])
    expect(fronteira['.claude/rules']?.length).toBeGreaterThanOrEqual(9)
    expect(fronteira['.claude/agents']?.length).toBeGreaterThanOrEqual(10)
    const guardas = fronteira['tools/guardas'] ?? []
    expect(guardas).toContain('tools/guardas/regras-ia.mjs')
    expect(guardas.filter((arquivo) => arquivo.endsWith('.test.ts') || arquivo.includes('__fixtures__'))).toEqual([])
  })

  it('a guarda de SDK de IA, a regra 30 e o llm-integrator citam a mesma pasta dos adaptadores, e ela existe', () => {
    const pasta = 'packages/core/src/ia/*-adapter.ts'
    expect(readFileSync(join(RAIZ, 'tools/guardas/regras-ia.mjs'), 'utf8')).toContain(`PASTA_DOS_ADAPTADORES = '${pasta}'`)
    expect(readFileSync(join(RAIZ, '.claude/rules/30-camada-ia.md'), 'utf8')).toContain(`\`${pasta}\``)
    expect(readFileSync(join(RAIZ, '.claude/agents/llm-integrator.md'), 'utf8')).toContain(`\`${pasta}\``)
    expect(problemaDoCaminho(pasta, RAIZ)).toBeNull()
    for (const arquivo of [...PASTAS_DOS_PAPEIS.flatMap((pasta) => arquivosDe(RAIZ, pasta, false)), ...(arquivosDaFronteira(RAIZ)['tools/guardas'] ?? [])]) {
      expect(readFileSync(join(RAIZ, arquivo), 'utf8'), `${arquivo} ainda cita a pasta antiga`).not.toContain('apps/api/src/ia/adapters')
    }
  })

  it('amostra que cita apps/api/src/inexistente.ts: vermelho, com o arquivo e o caminho', () => {
    const { problemas } = conferir(amostra(aCitar('Leia `apps/api/src/inexistente.ts` antes.')))
    expect(problemas).toEqual(['.claude/rules/10-a.md cita apps/api/src/inexistente.ts: não existe'])
  })

  it('amostra que cita só o que existe: verde, e o caminho entra na contagem', () => {
    const { problemas, conferidos } = conferir(amostra(aCitar('Leia `apps/api/src/existe.ts` antes.')))
    expect(problemas).toEqual([])
    expect(conferidos).toEqual([{ arquivo: '.claude/rules/10-a.md', caminho: 'apps/api/src/existe.ts' }])
  })

  it.each([
    ['em papel', '.claude/agents/a.md'],
    ['em regra', '.claude/rules/10-a.md'],
    ['em guarda, num arquivo aninhado', 'tools/guardas/sub/g.mjs'],
  ])('o caminho que falta é acusado %s', (_onde, arquivo) => {
    const { problemas } = conferir(amostra({ [arquivo]: 'veja `docs/inexistente.md`\n' }))
    expect(problemas).toEqual([`${arquivo} cita docs/inexistente.md: não existe`])
  })

  it.each([
    ['crase', 'Leia `apps/api/src/inexistente.ts` antes.'],
    ['crase com ./', 'Leia `./apps/api/src/inexistente.ts` antes.'],
    ['aspas simples', "const PASTA = 'apps/api/src/inexistente.ts'"],
    ['aspas duplas', 'const PASTA = "apps/api/src/inexistente.ts"'],
    ['./ solto no texto', 'Leia ./apps/api/src/inexistente.ts antes.'],
  ])('quem contorna é acusado: o caminho escrito com %s', (_forma, linha) => {
    const { problemas } = conferir(amostra(aCitar(linha)))
    expect(problemas).toEqual(['.claude/rules/10-a.md cita ' + (linha.includes('./apps') ? './' : '') + 'apps/api/src/inexistente.ts: não existe'])
  })

  it('fora da fronteira: o caminho inexistente em um x.test.ts e em __fixtures__/ de tools/guardas fica de fora', () => {
    const { problemas } = conferir(
      amostra({
        'tools/guardas/x.test.ts': 'expect(`apps/api/src/inexistente.ts`)\n',
        'tools/guardas/__fixtures__/y.ts': "const a = 'apps/api/src/inexistente.ts'\n",
        'tools/guardas/__fixtures__/fundo/z.mjs': "const a = 'apps/api/src/inexistente.ts'\n",
      }),
    )
    expect(problemas).toEqual([])
  })

  it('fora da fronteira: o arquivo que não é .md em .claude/ e o texto fora das três pastas não contam', () => {
    const { problemas, conferidos } = conferir(
      amostra({ '.claude/rules/rascunho.txt': '`apps/api/src/inexistente.ts`\n', '.claude/skills/s/SKILL.md': '`apps/api/src/inexistente.ts`\n', 'docs/a.md': '`apps/api/src/inexistente.ts`\n' }),
    )
    expect(problemas).toEqual([])
    expect(conferidos).toEqual([])
  })

  it('o sufixo :<linha> e #<âncora> não conta, e o arquivo que falta continua acusado com ele', () => {
    expect(conferir(amostra(aCitar('`apps/api/src/existe.ts:42`', '`apps/api/src/existe.ts:10-20`', '`apps/api/src/existe.ts#cabecalho`'))).problemas).toEqual([])
    expect(conferir(amostra(aCitar('`apps/api/src/inexistente.ts:42`'))).problemas).toEqual(['.claude/rules/10-a.md cita apps/api/src/inexistente.ts:42: não existe'])
    expect(conferir(amostra(aCitar('`apps/api/src/inexistente.ts#x`'))).problemas).toEqual(['.claude/rules/10-a.md cita apps/api/src/inexistente.ts#x: não existe'])
  })

  it('glob: casa ao menos um arquivo; o que não casa nenhum é vermelho', () => {
    expect(conferir(amostra(aCitar('`apps/api/src/*.ts`', '`apps/*/src/existe.ts`'))).problemas).toEqual([])
    expect(conferir(amostra(aCitar('`apps/api/src/*.mjs`'))).problemas).toEqual(['.claude/rules/10-a.md cita apps/api/src/*.mjs: o padrão não casa com nenhum arquivo'])
  })

  it('placeholder: confere a pasta antes dele, para <...>, … e ${...}', () => {
    const ok = amostra({ ...aCitar('`apps/api/src/<modulo>/x.int.test.ts`', '`e2e/__fixtures__/…`', '`apps/<x>/y.ts`', '`apps/api/src/${nome}.ts`', '`apps/api/src/adaptador-<x>.ts`'), 'e2e/__fixtures__/': '' })
    expect(conferir(ok).problemas).toEqual([])
    expect(conferir(amostra(aCitar('`e2e/inexistente/…`'))).problemas).toEqual(['.claude/rules/10-a.md cita e2e/inexistente/…: a pasta e2e/inexistente/ não existe'])
    expect(conferir(amostra(aCitar('`apps/api/src/inexistente/<modulo>/x.ts`'))).problemas).toEqual([
      '.claude/rules/10-a.md cita apps/api/src/inexistente/<modulo>/x.ts: a pasta apps/api/src/inexistente/ não existe',
    ])
    expect(conferir(amostra(aCitar('`apps/api/src/existe.ts/x-<y>`'))).problemas).toEqual(['.claude/rules/10-a.md cita apps/api/src/existe.ts/x-<y>: a pasta apps/api/src/existe.ts não existe'])
    expect(conferir(amostra(aCitar('`packages/core/src/ia/adaptador-<x>.ts`'))).problemas).toEqual([
      '.claude/rules/10-a.md cita packages/core/src/ia/adaptador-<x>.ts: a pasta packages/core/src/ia não existe',
    ])
  })

  it('o ./ só conta solto: ../../ e a./ não são caminho, e não levam o que vem depois para a conferência', () => {
    const { problemas, conferidos } = conferir(amostra(aCitar("Leia '../../docs/inexistente.md' e a./docs/inexistente.md aqui.")))
    expect(problemas).toEqual([])
    expect(conferidos).toEqual([])
  })

  it('o que não começa por uma pasta da raiz não é conferido: fragmento, regra de lint, rota, glob sem pasta, token com espaço', () => {
    const { problemas, conferidos } = conferir(
      amostra(
        aCitar(
          '`componentes/dialogos.tsx` e `turma.ts`',
          '`guardas/log-sem-dado-pessoal`',
          '`/v1/disciplinas`',
          '`*.controller.ts`',
          '`<modulo>.module.ts`',
          '`apps/api/src/inexistente.ts --flag`',
          'apps/api/src/inexistente.ts solto, sem crase nem aspas',
        ),
      ),
    )
    expect(problemas).toEqual([])
    expect(conferidos).toEqual([])
  })

  it('pasta da fronteira sem arquivo nenhum: vermelho, porque a conferência não vigiaria nada', () => {
    const semRegras = amostra({})
    rmSync(join(semRegras, '.claude/rules/10-a.md'))
    expect(conferir(semRegras).problemas).toEqual(['.claude/rules: nenhum arquivo para conferir'])
    const semPapeis = amostra({})
    rmSync(join(semPapeis, '.claude/agents'), { recursive: true })
    expect(conferir(semPapeis).problemas).toEqual(['.claude/agents: nenhum arquivo para conferir'])
    const soAmostras = amostra({})
    rmSync(join(soAmostras, 'tools/guardas/g.mjs'))
    writeFileSync(join(soAmostras, 'tools/guardas/g.test.ts'), 'x\n')
    expect(conferir(soAmostras).problemas).toEqual(['tools/guardas: nenhum arquivo para conferir'])
    const vazia = amostra({ '.claude/rules/10-a.md': '# A regra\n' })
    rmSync(join(vazia, '.claude/rules'), { recursive: true })
    mkdirSync(join(vazia, '.claude/rules'))
    expect(conferir(vazia).problemas).toEqual(['.claude/rules: nenhum arquivo para conferir'])
  })
})

describe('a extração devolve o token cru', () => {
  it('com <...>, * e a / final, sem repetir', () => {
    expect(extrairCaminhos('`apps/api/src/<modulo>/x.ts` e `packages/*/src/` e `docs/` de novo `docs/`')).toEqual(['apps/api/src/<modulo>/x.ts', 'packages/*/src/', 'docs/'])
  })

  it('crase, aspas e ./: um token por forma, e o ./ solto não repete o que a crase já pegou', () => {
    expect(extrairCaminhos("`a/b.ts` 'c/d.ts' \"e/f.ts\" ./g/h.ts e `./i/j.ts`").sort()).toEqual(['./g/h.ts', './i/j.ts', 'a/b.ts', 'c/d.ts', 'e/f.ts'])
  })

  it('só é caminho o que, sem o ./, começa por uma pasta da raiz', () => {
    expect(['apps/a.ts', './apps/a.ts', 'packages/x', 'tools/x', 'e2e/x', 'infra/x', 'docs/x', '.claude/x'].every(ehCaminho)).toBe(true)
    expect(['a.ts', 'app/a.ts', 'src/apps/a.ts', '/apps/a.ts', 'guardas/x', '*.ts'].some(ehCaminho)).toBe(false)
  })
})
