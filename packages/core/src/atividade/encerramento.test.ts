import { describe, expect, it } from 'vitest'
import { fimEfetivo, PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS, provaAbertaAlemDoFim } from './encerramento.js'

/**
 * A regra do fim efetivo da prova e a do alerta "Prova vencida ainda aberta" (avaliacao-e-correcao, 6.0; Tech Spec §5.6 e §7c), sem banco: o que a rotina e a medição comparam com o `now()`.
 */
const MIN = 60_000
const FECHA_EM = new Date('2026-11-26T10:00:00Z')
const depois = (base: Date, minutos: number): Date => new Date(base.getTime() + minutos * MIN)

describe('fimEfetivo: o do que vier depois, o fecha_em com as extensões da turma ou o limite do último aluno em andamento', () => {
  it('sem extensão e sem aluno em andamento, é o `fecha_em`', () => {
    expect(fimEfetivo(FECHA_EM, [], null)).toEqual(FECHA_EM)
  })

  it('a extensão da turma (aluno nulo) soma ao `fecha_em`, e a de cada aluno não: ela já está no limite dele', () => {
    const extensoes = [
      { alunoId: null, minutos: 10 },
      { alunoId: null, minutos: 5 },
      { alunoId: 'aluno-a', minutos: 60 },
    ]
    expect(fimEfetivo(FECHA_EM, extensoes, null)).toEqual(depois(FECHA_EM, 15))
  })

  it('o limite do aluno em andamento que passa do `fecha_em` é o fim, e o que não passa não muda nada', () => {
    expect(fimEfetivo(FECHA_EM, [], depois(FECHA_EM, 20))).toEqual(depois(FECHA_EM, 20))
    expect(fimEfetivo(FECHA_EM, [], depois(FECHA_EM, -5))).toEqual(FECHA_EM)
    expect(fimEfetivo(FECHA_EM, [{ alunoId: null, minutos: 30 }], depois(FECHA_EM, 20))).toEqual(depois(FECHA_EM, 30))
  })
})

describe('provaAbertaAlemDoFim: dispara 5 min depois do fim efetivo, e não pelo `fecha_em`', () => {
  it('o prazo do alerta é de 5 min', () => {
    expect(PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS).toBe(5 * MIN)
  })

  it('antes dos 5 min não dispara; nos 5 min e depois, dispara', () => {
    expect(provaAbertaAlemDoFim(depois(FECHA_EM, 4), FECHA_EM)).toBe(false)
    expect(provaAbertaAlemDoFim(depois(FECHA_EM, 5), FECHA_EM)).toBe(true)
    expect(provaAbertaAlemDoFim(depois(FECHA_EM, 30), FECHA_EM)).toBe(true)
  })

  it('com o aluno estendido, 10 min depois do `fecha_em` não dispara: o fim é o limite dele; só 5 min depois dele', () => {
    const limiteDoEstendido = depois(FECHA_EM, 20)
    const fim = fimEfetivo(FECHA_EM, [], limiteDoEstendido)
    expect(provaAbertaAlemDoFim(depois(FECHA_EM, 10), fim)).toBe(false)
    expect(provaAbertaAlemDoFim(depois(FECHA_EM, 24), fim)).toBe(false)
    expect(provaAbertaAlemDoFim(depois(FECHA_EM, 25), fim)).toBe(true)
    // Contado pelo `fecha_em`, dispararia aos 10 min: é o que a regra evita.
    expect(provaAbertaAlemDoFim(depois(FECHA_EM, 10), FECHA_EM)).toBe(true)
  })
})
