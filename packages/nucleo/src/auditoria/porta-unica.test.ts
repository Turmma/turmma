import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as nucleo from '../index.js'
import { unscopedJustification } from '../db/sem-escopo.decorator.js'
import { AuditoriaRepository } from './auditoria.repository.js'

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const PASTAS_DE_CODIGO = ['apps', 'packages', 'infra', 'tools']
const MODULO_DA_INSERCAO = 'packages/nucleo/src/auditoria/insercao-de-auditoria.repository.ts'
const REGISTRO = 'packages/nucleo/src/auditoria/registro-de-auditoria.ts'

/** Todo `.ts` de código (sem teste, sem `dist`, sem `node_modules`), com o caminho a partir da raiz. */
function arquivosDeCodigo(): { caminho: string; texto: string }[] {
  return PASTAS_DE_CODIGO.flatMap((pasta) =>
    readdirSync(join(RAIZ, pasta), { recursive: true, encoding: 'utf8' })
      .filter((arquivo) => /\.(ts|tsx|mts)$/.test(arquivo) && !/\.test\.ts$/.test(arquivo))
      .filter((arquivo) => !arquivo.split(sep).some((parte) => parte === 'node_modules' || parte === 'dist'))
      .map((arquivo) => {
        const caminho = relative(RAIZ, join(RAIZ, pasta, arquivo)).split(sep).join('/')
        return { caminho, texto: readFileSync(join(RAIZ, caminho), 'utf8') }
      }),
  )
}

// Drizzle (`insert(auditoria)`, `delete(schema.auditoria)`) e SQL (`insert into auditoria`, `update public.auditoria`,
// `delete from "auditoria"`). Apagar registro de auditoria em silêncio é tão grave quanto gravar por fora: o
// expurgo por retenção (F3) entra com porta própria e acrescenta a exceção aqui.
const TABELA = String.raw`(?:"?public"?\.)?"?auditoria"?`
const ESCRITA_NA_AUDITORIA = new RegExp(
  String.raw`\b(?:insert|update|delete)\s*\(\s*(?:schema\.)?auditoria\b|\binsert\s+into\s+${TABELA}[\s(]|\bupdate\s+${TABELA}\s+set\b|\bdelete\s+from\s+${TABELA}\b`,
  'i',
)

/** Importa a tabela `auditoria` (e não só o `FORMATO_OPERADOR`) do arquivo de schema dela. */
const IMPORTA_A_TABELA = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*schema\/auditoria(?:\.js|\.ts)?['"]/g
const LEITURA = 'packages/nucleo/src/auditoria/auditoria.repository.ts'

/**
 * Importa o módulo de inserção: o nome está dentro de um literal de texto que vem logo depois de um `from` (também
 * `import type` e `export … from`), de um `import()`, de um `require()` ou de um `import`. A classe `[^'"`\n]*` é o que
 * mantém o nome dentro do mesmo literal, sem atravessar aspa nem linha; o `\1` só fecha com a aspa que abriu.
 * Citar o caminho como dado (uma lista, uma constante, um comentário) não é importar.
 *
 * Fica de fora, por decisão: importação dinâmica com o caminho montado (`import(base + 'insercao-de-auditoria')`),
 * porque não há literal inteiro a casar. Quem importar assim e gravar em `auditoria` é pego por `ESCRITA_NA_AUDITORIA`.
 */
const IMPORTA_O_MODULO_DE_INSERCAO = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"`])[^'"`\n]*insercao-de-auditoria[^'"`\n]*\1/

function importaOModuloDeInsercao(texto: string): boolean {
  return IMPORTA_O_MODULO_DE_INSERCAO.test(texto)
}

describe('auditoria: uma porta só de escrita', () => {
  it('a varredura enxerga o código: acha o próprio insert da auditoria', () => {
    const arquivos = arquivosDeCodigo()
    expect(arquivos.length).toBeGreaterThan(100)
    expect(arquivos.filter((arquivo) => ESCRITA_NA_AUDITORIA.test(arquivo.texto)).map((arquivo) => arquivo.caminho)).toContain(MODULO_DA_INSERCAO)
  })

  it('nenhum código fora do módulo de inserção escreve em auditoria, por Drizzle ou por SQL', () => {
    const fora = arquivosDeCodigo()
      .filter((arquivo) => arquivo.caminho !== MODULO_DA_INSERCAO && ESCRITA_NA_AUDITORIA.test(arquivo.texto))
      .map((arquivo) => arquivo.caminho)
    expect(fora).toEqual([])
  })

  it('só o RegistroDeAuditoria importa o módulo de inserção, e o pacote não o exporta', () => {
    const importam = arquivosDeCodigo()
      .filter((arquivo) => arquivo.caminho !== MODULO_DA_INSERCAO && importaOModuloDeInsercao(arquivo.texto))
      .map((arquivo) => arquivo.caminho)
    expect(importam).toEqual([REGISTRO])
    expect(Object.keys(nucleo)).not.toContain('insertAuditoria')
    expect(Object.keys(nucleo)).not.toContain('auditoria')
  })

  it('a tabela só é importada pelo módulo de inserção e pela leitura, e o schema exportado não a contém', () => {
    const importam = arquivosDeCodigo()
      .filter((arquivo) => [...arquivo.texto.matchAll(IMPORTA_A_TABELA)].some((importacao) => /\bauditoria\b/.test(importacao[1] ?? '')))
      .map((arquivo) => arquivo.caminho)
      .sort()
    expect(importam).toEqual([MODULO_DA_INSERCAO, LEITURA].sort())
    expect(Object.keys(nucleo.schema)).not.toContain('auditoria')
  })

  it('a varredura pega a escrita em qualquer forma', () => {
    for (const trecho of [
      'tx.insert(auditoria).values(linha)',
      'banco.update( schema.auditoria ).set({})',
      'tx.delete(auditoria).where(condicao)',
      "pool.query('INSERT INTO auditoria (acao) values ($1)')",
      'insert into public.auditoria(acao)',
      'update "auditoria" set depois = $1',
      'delete from "public"."auditoria" where em < now()',
    ]) {
      expect(ESCRITA_NA_AUDITORIA.test(trecho), trecho).toBe(true)
    }
    expect(ESCRITA_NA_AUDITORIA.test('new AuditoriaRepository(banco).listarDaEscola()')).toBe(false)
  })

  it('a varredura de importação pega cada forma de importar e deixa o caminho citado como dado', () => {
    for (const trecho of [
      "import { insertAuditoria } from './insercao-de-auditoria.repository.js'",
      "import type { Linha } from './insercao-de-auditoria.repository.js'",
      'import {\n  insertAuditoria,\n} from "../auditoria/insercao-de-auditoria.repository"',
      "export { insertAuditoria } from './insercao-de-auditoria.repository.js'",
      "export * from './insercao-de-auditoria.repository.js'",
      "const modulo = await import('./insercao-de-auditoria.repository.js')",
      "const modulo = require('./insercao-de-auditoria.repository')",
      "import './insercao-de-auditoria.repository.js'",
    ]) {
      expect(importaOModuloDeInsercao(trecho), trecho).toBe(true)
    }
    for (const trecho of [
      "    arquivo: 'packages/nucleo/src/auditoria/insercao-de-auditoria.repository.ts',",
      "const MODULO = 'packages/nucleo/src/auditoria/insercao-de-auditoria.repository.ts'",
      "import { outra } from './auditoria.repository.js' // não é o insercao-de-auditoria",
      "// a porta é o insercao-de-auditoria.repository, e só o registro a importa",
      "const texto = 'veio from ' + 'outra/insercao-de-auditoria'",
      "const modulo = import(base + 'insercao-de-auditoria')", // a forma que fica de fora, por decisão (ver o comentário do padrão)
    ]) {
      expect(importaOModuloDeInsercao(trecho), trecho).toBe(false)
    }
    // Erra para o lado seguro: um literal que traz `from` e, dentro dele, outro literal com o nome é acusado como importação.
    expect(importaOModuloDeInsercao(`const texto = "veio from 'outra/insercao-de-auditoria'"`)).toBe(true)
  })

  it('o AuditoriaRepository só lê, na escola do contexto: sem método de escrita e sem @SemEscopo', () => {
    const metodos = Object.getOwnPropertyNames(AuditoriaRepository.prototype).filter((nome) => nome !== 'constructor')
    expect(metodos).toEqual(['listarDaEscola'])
    expect(unscopedJustification(AuditoriaRepository, 'listarDaEscola')).toBeUndefined()
  })
})
