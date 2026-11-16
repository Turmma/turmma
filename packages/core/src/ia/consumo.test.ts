import { describe, expect, it } from 'vitest'
import { consumoEstimadoDaInterrompida, DURACAO_MAXIMA_DA_LINHA_MS, type DestinoDoAdaptador } from './consumo.js'
import { proporFerramenta } from './tasks/propor-ferramenta.js'

const EXECUCAO = '1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6'
const DESTINO: DestinoDoAdaptador = { origem: 'falso', envio: { envioExterno: false, provedorId: null }, modeloDoPerfil: () => 'adaptador-falso' }
const duracaoDa = (duracaoMs: number): number => consumoEstimadoDaInterrompida({ tarefa: proporFerramenta, destino: DESTINO, execucaoId: EXECUCAO, duracaoMs, em: new Date('2026-11-16T10:00:00Z') }).duracaoMs

describe('consumoEstimadoDaInterrompida: a duração da linha', () => {
  it('cabe no `integer` de `consumo_ia.duracao_ms`: a execução esquecida há 40 dias leva o teto, e não um número que o `insert` recusa', () => {
    expect(DURACAO_MAXIMA_DA_LINHA_MS).toBe(2_147_483_647)
    expect(duracaoDa(40 * 24 * 3600 * 1000)).toBe(DURACAO_MAXIMA_DA_LINHA_MS)
    expect(duracaoDa(DURACAO_MAXIMA_DA_LINHA_MS + 1)).toBe(DURACAO_MAXIMA_DA_LINHA_MS)
  })

  it('abaixo do teto a duração é a medida, arredondada, e nunca negativa', () => {
    expect(duracaoDa(301_000.4)).toBe(301_000)
    expect(duracaoDa(DURACAO_MAXIMA_DA_LINHA_MS)).toBe(DURACAO_MAXIMA_DA_LINHA_MS)
    expect(duracaoDa(-5)).toBe(0)
  })
})
