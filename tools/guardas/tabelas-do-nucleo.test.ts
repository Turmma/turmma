import { is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { TABELAS_DO_NUCLEO } from './tabelas-do-nucleo.mjs'

// A guarda `tabela-so-no-repository` lê esta lista porque o ESLint não carrega o núcleo. O que a mantém verdadeira é este teste,
// que a confere contra as exportações do pacote nos dois sentidos.

/** O que o `@educa/core` exporta. Import por variável: o tsconfig de tools não compila o código do núcleo, só o Vitest o carrega. */
async function exportacoesDoNucleo(): Promise<Record<string, unknown>> {
  const nucleo = '@educa/core'
  return (await import(nucleo)) as Record<string, unknown>
}

describe('a lista de tabelas do núcleo (guardas/tabela-so-no-repository)', () => {
  // O prazo de 60 s é do import: o índice do núcleo puxa o banco, a fila e o storage (mesmo caso do teste do redact).
  it('tem toda tabela que o núcleo exporta: tabela nova que ficar de fora escaparia da guarda', async () => {
    const exportadas = Object.entries(await exportacoesDoNucleo()).flatMap(([nome, valor]) => (is(valor, PgTable) ? [nome] : []))
    expect(exportadas.length, 'o núcleo deixou de exportar tabelas?').toBeGreaterThan(20)
    expect(exportadas.filter((nome) => !TABELAS_DO_NUCLEO.includes(nome))).toEqual([])
  }, 60_000)

  it('só tem nome que o núcleo exporta como tabela: o que não é tabela (uma função) reprovaria import legítimo, e o `schema` a guarda reprova à parte, pelo nome', async () => {
    const exportacoes = await exportacoesDoNucleo()
    expect(TABELAS_DO_NUCLEO.filter((nome) => !is(exportacoes[nome], PgTable))).toEqual([])
  }, 60_000)

  it('não repete nome', () => {
    expect(TABELAS_DO_NUCLEO.filter((nome, indice) => TABELAS_DO_NUCLEO.indexOf(nome) !== indice)).toEqual([])
  })
})
