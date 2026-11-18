import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CODIGO_DE_HABILIDADE_BNCC, CODIGOS_DA_BNCC } from '@educa/shared'

/**
 * A lista fechada que a auditoria aceita no lugar de texto livre (classificacao-bncc, 7.0) é a carga **vigente** da BNCC (o `dados-*.json` de versão mais alta da pasta), nos dois sentidos: código da carga que ficar de fora, ou código da lista que a carga não tem, reprova.
 */
describe('CODIGOS_DA_BNCC', () => {
  const vigente = readdirSync(new URL('.', import.meta.url))
    .filter((arquivo) => /^dados-\d{4}\.\d{2}\.json$/.test(arquivo))
    .sort()
    .at(-1)
  const carga = JSON.parse(readFileSync(new URL(vigente ?? 'sem-carga.json', import.meta.url), 'utf8')) as { habilidades: Array<{ codigo: string }> }

  it('é exatamente o conjunto de códigos da carga vigente, sem repetir', () => {
    const daCarga = carga.habilidades.map((habilidade) => habilidade.codigo).sort()
    expect([...CODIGOS_DA_BNCC]).toEqual(daCarga)
    expect(new Set(CODIGOS_DA_BNCC).size).toBe(CODIGOS_DA_BNCC.length)
  })

  it('todo código dela tem o formato do check da tabela', () => {
    for (const codigo of CODIGOS_DA_BNCC) expect(CODIGO_DE_HABILIDADE_BNCC.test(codigo), codigo).toBe(true)
  })
})
