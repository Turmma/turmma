import { describe, expect, it } from 'vitest'
import { CHAVES_DE_CATEGORIA_DO_SUBOPERADOR } from './suboperador.js'
import {
  CHAVES_DE_CATEGORIA_DO_INCIDENTE,
  incidenteDaEscolaSchema,
  incidentesResponseSchema,
  HORAS_PARA_A_ESCOLA_CONFIRMAR,
  MAXIMO_DE_TITULARES_ESTIMADOS,
  MAXIMO_DO_TEXTO_DO_INCIDENTE,
  RISCOS_DO_INCIDENTE,
  TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE,
} from './incidente.js'

const valido = {
  id: '0198a0c0-0000-7000-8000-000000000001',
  conhecidoEm: '2026-10-09T12:00:00.000Z',
  circunstancias: 'Acesso indevido.',
  categorias: ['cadastro'],
  titularesEstimados: 12,
  risco: 'relevante',
  contencao: 'Credencial revogada.',
  correcao: 'Rotação de credenciais.',
  avisadoEm: '2026-10-09T13:00:00.000Z',
  confirmadoEm: null,
}

describe('contrato do incidente (F3, 9.0)', () => {
  it('as categorias de dado do incidente são as do mapa de dados, as mesmas do suboperador', () => {
    expect([...CHAVES_DE_CATEGORIA_DO_INCIDENTE]).toEqual([...CHAVES_DE_CATEGORIA_DO_SUBOPERADOR])
  })

  it('o risco é a escala da ANPD, e o prazo da escola é de 24 h', () => {
    expect([...RISCOS_DO_INCIDENTE]).toEqual(['baixo', 'relevante', 'alto'])
    expect(HORAS_PARA_A_ESCOLA_CONFIRMAR).toBe(24)
    expect(TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE).toContain('3 dias úteis')
  })

  it('a seção da escola aceita o que a escola lê e recusa qualquer campo a mais: o id do incidente, quem registrou, as outras escolas', () => {
    expect(incidenteDaEscolaSchema.parse(valido)).toEqual(valido)
    for (const extra of [{ incidenteId: valido.id }, { registradoPor: 'ana' }, { escolas: [] }, { titulares: ['x'] }]) {
      expect(incidenteDaEscolaSchema.safeParse({ ...valido, ...extra }).success, Object.keys(extra)[0]).toBe(false)
    }
  })

  it('os limites: categoria fora da lista ou vazia, risco de fora, texto vazio ou longo, número negativo, quebrado ou grande demais', () => {
    const recusa = (resto: Record<string, unknown>) => incidenteDaEscolaSchema.safeParse({ ...valido, ...resto }).success
    expect(recusa({ categorias: [] })).toBe(false)
    expect(recusa({ categorias: ['diagnostico'] })).toBe(false)
    expect(recusa({ risco: 'critico' })).toBe(false)
    expect(recusa({ circunstancias: '' })).toBe(false)
    expect(recusa({ contencao: 'x'.repeat(MAXIMO_DO_TEXTO_DO_INCIDENTE + 1) })).toBe(false)
    expect(recusa({ contencao: 'x'.repeat(MAXIMO_DO_TEXTO_DO_INCIDENTE) })).toBe(true)
    expect(recusa({ titularesEstimados: -1 })).toBe(false)
    expect(recusa({ titularesEstimados: 1.5 })).toBe(false)
    expect(recusa({ titularesEstimados: MAXIMO_DE_TITULARES_ESTIMADOS + 1 })).toBe(false)
    expect(recusa({ titularesEstimados: 0 })).toBe(true)
    expect(recusa({ confirmadoEm: '2026-10-09T14:00:00.000Z' })).toBe(true)
  })

  it('a resposta traz a lista e o prazo legal, e nada mais', () => {
    expect(incidentesResponseSchema.parse({ incidentes: [valido], prazoLegal: TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE }).incidentes).toHaveLength(1)
    expect(incidentesResponseSchema.safeParse({ incidentes: [], prazoLegal: '' }).success).toBe(false)
    expect(incidentesResponseSchema.safeParse({ incidentes: [], prazoLegal: 'x', total: 0 }).success).toBe(false)
  })
})
