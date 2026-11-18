import { describe, expect, it } from 'vitest'
import { situacaoDaSecao } from './material.js'

/** A situação de uma seção (classificacao-bncc, 7.0; Tech Spec, seção 7c, "Estados da seção"): da execução e das habilidades, e a correção da coordenação vence todas. */
describe('situacaoDaSecao', () => {
  const sem = { corrigida: false, habilidades: 0 }

  it('sem execução: `nao_agendada`, tenha ou não habilidade', () => {
    expect(situacaoDaSecao({ ...sem, estadoDaExecucao: null })).toBe('nao_agendada')
    expect(situacaoDaSecao({ ...sem, habilidades: 2, estadoDaExecucao: null })).toBe('nao_agendada')
  })

  it('execução `pendente` ou `rodando`: `aguardando`, um caso cada', () => {
    expect(situacaoDaSecao({ ...sem, estadoDaExecucao: 'pendente' })).toBe('aguardando')
    expect(situacaoDaSecao({ ...sem, estadoDaExecucao: 'rodando' })).toBe('aguardando')
  })

  it('execução `falhou`: `nao_classificada`', () => {
    expect(situacaoDaSecao({ ...sem, estadoDaExecucao: 'falhou' })).toBe('nao_classificada')
  })

  it('execução `concluida`: `classificada` com habilidade, `sem_habilidade` sem nenhuma', () => {
    expect(situacaoDaSecao({ ...sem, habilidades: 1, estadoDaExecucao: 'concluida' })).toBe('classificada')
    expect(situacaoDaSecao({ ...sem, estadoDaExecucao: 'concluida' })).toBe('sem_habilidade')
  })

  it('a correção vence a execução, seja qual for: `classificada` com código, `sem_habilidade` sem nenhum', () => {
    for (const estado of [null, 'pendente', 'rodando', 'falhou', 'concluida'] as const) {
      expect(situacaoDaSecao({ corrigida: true, habilidades: 3, estadoDaExecucao: estado }), `com ${String(estado)}`).toBe('classificada')
      expect(situacaoDaSecao({ corrigida: true, habilidades: 0, estadoDaExecucao: estado }), `sem código, com ${String(estado)}`).toBe('sem_habilidade')
    }
  })
})
