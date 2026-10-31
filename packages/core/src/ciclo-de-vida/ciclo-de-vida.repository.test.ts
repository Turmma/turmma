import { describe, expect, it } from 'vitest'
import { unscopedJustification, TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO } from '../db/unscoped.decorator.js'
import { CicloDeVidaRepository } from './ciclo-de-vida.repository.js'
import { ContaGlobalRepository } from './conta-global.repository.js'

const metodosDe = (classe: { prototype: object }) => Object.getOwnPropertyNames(classe.prototype).filter((nome) => nome !== 'constructor').sort()

/**
 * As asserções que eram da resolução de tenant e do ciclo de vida em `apps/api/src/sessao`, no lugar novo
 * (F3, tarefa 1.0): a conta global continua com as mesmas três exceções, cada uma com a justificativa dela, e as escritas
 * da desativação e da eliminação continuam todas na escola do contexto.
 */
describe('ciclo de vida no nucleo: as exceções ao escopo são só as da conta global', () => {
  it('a ContaGlobalRepository tem só os três métodos da conta global, cada um com @SemEscopo e a justificativa da credencial global', () => {
    expect(metodosDe(ContaGlobalRepository)).toEqual(['encerrarSessoesDaConta', 'limparContaSemUso', 'travarConta'])
    for (const metodo of metodosDe(ContaGlobalRepository)) {
      const justificativa = unscopedJustification(ContaGlobalRepository, metodo)
      expect(justificativa?.length ?? 0, metodo).toBeGreaterThanOrEqual(TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO)
      expect(justificativa, metodo).toMatch(/credencial da equipe é global/)
    }
  })

  it('a desativação e a eliminação não saem sem escopo: o CicloDeVidaRepository usa a escola do contexto em todo método', () => {
    const metodos = metodosDe(CicloDeVidaRepository)
    expect(metodos.length).toBeGreaterThan(0)
    for (const metodo of metodos) expect(unscopedJustification(CicloDeVidaRepository, metodo), metodo).toBeUndefined()
  })
})
