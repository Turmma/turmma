import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COMPONENTE_PELA_CHAVE_DO_NOME, COMPONENTES_BNCC, habilidadeEhCandidata, partesDoCodigoBncc, type SerieDoRecorte } from '@educa/shared'

/**
 * A carga do `bncc-dados` (`dados-2026.08.json`) contra o hash e as contagens do cabeçalho, contra o recorte do `COMPONENTES_BNCC` e contra a
 * migration `0059_habilidade_bncc` (classificacao-bncc, 1.0). Fica no `core` porque lê o JSON e o SQL do disco, e o `shared` não tem o Node.
 */
const raiz = fileURLToPath(new URL('../../../../..', import.meta.url))

const ef = (...anos: number[]): SerieDoRecorte[] => anos.map((ano) => ({ etapa: 'ef_anos_finais', ano }))
const em = (...anos: number[]): SerieDoRecorte[] => anos.map((ano) => ({ etapa: 'em', ano }))

interface DadosDaCarga {
  readonly versao: string
  readonly conferencia: { readonly sha256DasHabilidades: string; readonly contagens: { readonly total: number; readonly ensinoMedio: number; readonly anosFinais: number } }
  readonly habilidades: ReadonlyArray<{ readonly codigo: string; readonly descricao: string; readonly etapa: string; readonly componente: string | null; readonly area: string | null; readonly anos: number[] | null }>
}
const carga = JSON.parse(readFileSync(join(raiz, 'packages/core/src/db/bncc/dados-2026.08.json'), 'utf8')) as DadosDaCarga

describe('a carga contra o recorte dos componentes e a migration', () => {
  it('cada habilidade da carga é candidata de algum componente na sua própria série, e o Fundamental só na dos anos dela', () => {
    for (const habilidade of carga.habilidades) {
      const series = habilidade.etapa === 'em' ? em(1) : ef(...(habilidade.anos ?? []))
      const acha = COMPONENTES_BNCC.filter((componente) => habilidadeEhCandidata(habilidade.codigo, componente, series))
      expect(acha.length, habilidade.codigo).toBeGreaterThan(0)
      if (habilidade.etapa === 'ef_anos_finais') {
        // Nenhum ano fora dos da habilidade a alcança: a série do 1º ao 5º ano não existe no recorte, e o ano que o código não tem fica de fora.
        const foraDosAnos = [6, 7, 8, 9].filter((ano) => !(habilidade.anos ?? []).includes(ano))
        for (const ano of foraDosAnos) expect(COMPONENTES_BNCC.some((componente) => habilidadeEhCandidata(habilidade.codigo, componente, ef(ano))), `${habilidade.codigo} no ${String(ano)}º`).toBe(false)
      }
    }
  })

  it('a migration `0059_habilidade_bncc` repete a tabela de nomes em SQL, par a par, e o check lista os mesmos componentes', () => {
    const sql = readFileSync(join(raiz, 'packages/core/drizzle/0059_habilidade_bncc.sql'), 'utf8')
    const pares = [...sql.matchAll(/\('([a-z ]+)', '([a-z_]+)'\)/g)].map((par) => [par[1], par[2]])
    expect(pares.sort()).toEqual(Object.entries(COMPONENTE_PELA_CHAVE_DO_NOME).sort())
    const check = /"disciplina_componente_bncc_valido" CHECK \(([^;]*)\)/.exec(sql)?.[1] ?? ''
    expect([...check.matchAll(/'([a-z_]+)'/g)].map((c) => c[1]).sort()).toEqual([...COMPONENTES_BNCC].sort())
  })
})

describe('a carga do `bncc-dados` (dados-2026.08)', () => {
  it('o JSON bate com o hash do cabeçalho: editar uma descrição deixa este caso vermelho', () => {
    const hash = createHash('sha256').update(JSON.stringify(carga.habilidades)).digest('hex')
    expect(hash).toBe(carga.conferencia.sha256DasHabilidades)
  })

  it('tem as contagens conferidas contra o PDF (730 dos anos finais, 183 do Médio) e nenhuma de Computação nem dos anos iniciais', () => {
    expect(carga.conferencia.contagens).toMatchObject({ total: 913, ensinoMedio: 183, anosFinais: 730 })
    expect(carga.habilidades.filter((h) => h.etapa === 'em')).toHaveLength(183)
    expect(carga.habilidades.filter((h) => h.etapa === 'ef_anos_finais')).toHaveLength(730)
    expect(carga.habilidades.every((h) => partesDoCodigoBncc(h.codigo) !== null)).toBe(true)
    expect(carga.habilidades.some((h) => /^EF\d\dCO/.test(h.codigo))).toBe(false)
    expect(new Set(carga.habilidades.map((h) => h.codigo)).size).toBe(913)
  })

  it('cada linha do Fundamental tem componente e anos de 6 a 9, e a do Médio tem área e nenhum ano', () => {
    for (const h of carga.habilidades) {
      if (h.etapa === 'ef_anos_finais') {
        expect(h.componente, h.codigo).not.toBeNull()
        expect(h.area, h.codigo).toBeNull()
        expect((h.anos ?? []).every((ano) => ano >= 6 && ano <= 9) && (h.anos ?? []).length > 0, h.codigo).toBe(true)
      } else {
        expect(h.area, h.codigo).not.toBeNull()
        expect(h.anos, h.codigo).toBeNull()
      }
    }
  })
})
