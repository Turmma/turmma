import { LIMIAR_DA_LACUNA_MS } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { pulsoEstaVelho } from './quedas-da-api.repository.js'

/**
 * O pulso velho (avaliacao-e-correcao, 6.0; Tech Spec §5.6), sem banco: a regra que impede a rotina de encerrar prova durante uma queda. O que o banco faz dela é o caso do pulso velho do job,
 * em `apps/worker/test/encerrar-provas.int.test.ts`.
 */
const AGORA = new Date('2026-11-26T10:00:00Z')
const pulsoComIdade = (ms: number) => ({ ultimoEm: new Date(AGORA.getTime() - ms), agora: AGORA })

describe('pulsoEstaVelho', () => {
  it('sem linha de pulso está velho: nada encerra sem saber se a API vive', () => {
    expect(pulsoEstaVelho(null)).toBe(true)
  })

  it('no limiar (30 s) o pulso ainda vale; um milissegundo depois, está velho', () => {
    expect(pulsoEstaVelho(pulsoComIdade(0))).toBe(false)
    expect(pulsoEstaVelho(pulsoComIdade(LIMIAR_DA_LACUNA_MS))).toBe(false)
    expect(pulsoEstaVelho(pulsoComIdade(LIMIAR_DA_LACUNA_MS + 1))).toBe(true)
  })
})
