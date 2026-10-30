import { describe, expect, it } from 'vitest'
import { provedoresDaEscolaRequestSchema, MAXIMO_DE_PROVEDORES_DA_ESCOLA, TENANT_DE_CONTA_PESSOAL_MICROSOFT } from './provedores.js'

const TENANT_SINTETICO = 'aaaaaaaa-0000-4000-8000-00000000000a'

const aceita = (provedores: unknown) => provedoresDaEscolaRequestSchema.safeParse({ provedores }).success

describe('contrato de PUT /v1/escola/provedores', () => {
  it('normaliza domínio e tenant em minúsculas, sem espaço nas pontas', () => {
    const lido = provedoresDaEscolaRequestSchema.parse({
      provedores: [
        { provedor: 'google', valor: ' Escola-A.Educa-Sintetica.TEST ' },
        { provedor: 'microsoft', valor: TENANT_SINTETICO.toUpperCase() },
      ],
    })
    expect(lido.provedores).toEqual([
      { provedor: 'google', valor: 'escola-a.educa-sintetica.test' },
      { provedor: 'microsoft', valor: TENANT_SINTETICO },
    ])
  })

  it('a lista vazia desliga o login pela conta da escola', () => {
    expect(aceita([])).toBe(true)
  })

  it('recusa o tenant de conta pessoal da Microsoft e o domínio do Gmail: abririam a escola a qualquer conta pessoal', () => {
    expect(aceita([{ provedor: 'microsoft', valor: TENANT_DE_CONTA_PESSOAL_MICROSOFT }])).toBe(false)
    expect(aceita([{ provedor: 'google', valor: 'gmail.com' }])).toBe(false)
  })

  it('recusa domínio sem formato, tenant que não é UUID e provedor desconhecido', () => {
    for (const item of [
      { provedor: 'google', valor: 'escola' },
      { provedor: 'google', valor: 'escola a.test' },
      { provedor: 'google', valor: 'https://escola.test' },
      { provedor: 'microsoft', valor: 'escola.test' },
      { provedor: 'github', valor: 'escola.test' },
    ]) {
      expect(aceita([item]), JSON.stringify(item)).toBe(false)
    }
  })

  it('recusa valor repetido (também depois de normalizar), campo a mais e lista acima do máximo', () => {
    expect(aceita([{ provedor: 'google', valor: 'escola.test' }, { provedor: 'google', valor: 'ESCOLA.test' }])).toBe(false)
    expect(aceita([{ provedor: 'google', valor: 'escola.test', escolaId: TENANT_SINTETICO }])).toBe(false)
    const muitos = Array.from({ length: MAXIMO_DE_PROVEDORES_DA_ESCOLA + 1 }, (_, indice) => ({ provedor: 'google', valor: `escola-${String(indice)}.test` }))
    expect(aceita(muitos)).toBe(false)
    expect(aceita(muitos.slice(1))).toBe(true)
  })
})
