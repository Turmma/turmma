import type { Vinculo } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { readContexto, turmaEscolhida, turmasDaProfessora, valorDoContexto } from './turmas-da-professora'

const TURMA_2B = '0190f5a0-0000-7000-8000-00000000002b'
const TURMA_1C = '0190f5a0-0000-7000-8000-00000000001c'
const QUIMICA = '0190f5a0-0000-7000-8000-0000000000c1'
const CIENCIAS = '0190f5a0-0000-7000-8000-0000000000c2'

let proximo = 0
function vinculo(turma: [string, string], disciplina: [string, string] | undefined, estado: Vinculo['estado']): Vinculo {
  proximo += 1
  return {
    id: `0190f5a0-0000-7000-8000-${String(proximo).padStart(12, '0')}`,
    turma: { id: turma[0], nome: turma[1] },
    ...(disciplina === undefined ? {} : { disciplina: { id: disciplina[0], nome: disciplina[1] } }),
    estado,
  }
}

describe('as turmas com que a professora pede ao Assistente', () => {
  it('só o vínculo confirmado, com disciplina, entra: pendente, contestado, encerrado e sem disciplina ficam de fora', () => {
    const turmas = turmasDaProfessora([
      vinculo([TURMA_2B, '2ºB'], [QUIMICA, 'Química'], 'confirmado'),
      vinculo([TURMA_1C, '1ºC'], [QUIMICA, 'Química'], 'pendente'),
      vinculo([TURMA_1C, '1ºC'], [CIENCIAS, 'Ciências'], 'contestado'),
      vinculo([TURMA_1C, '1ºC'], undefined, 'confirmado'),
      vinculo([TURMA_2B, '2ºB'], [CIENCIAS, 'Ciências'], 'encerrado'),
    ])
    expect(turmas).toEqual([{ valor: `${TURMA_2B}:${QUIMICA}`, turmaId: TURMA_2B, disciplinaId: QUIMICA, turmaNome: '2ºB', rotulo: '2ºB · Química' }])
  })

  it('a professora de duas disciplinas na mesma turma tem as duas, uma vez cada, em ordem de nome', () => {
    const turmas = turmasDaProfessora([
      vinculo([TURMA_2B, '2ºB'], [QUIMICA, 'Química'], 'confirmado'),
      vinculo([TURMA_2B, '2ºB'], [CIENCIAS, 'Ciências'], 'confirmado'),
      vinculo([TURMA_2B, '2ºB'], [QUIMICA, 'Química'], 'confirmado'),
      vinculo([TURMA_1C, '10ºA'], [QUIMICA, 'Química'], 'confirmado'),
    ])
    expect(turmas.map((turma) => turma.rotulo)).toEqual(['2ºB · Ciências', '2ºB · Química', '10ºA · Química'])
  })

  it('o valor do seletor vai e volta, e o que não é um valor não vira turma', () => {
    expect(readContexto(valorDoContexto(TURMA_2B, QUIMICA))).toEqual({ turmaId: TURMA_2B, disciplinaId: QUIMICA })
    expect(readContexto('')).toBeUndefined()
    expect(readContexto(TURMA_2B)).toBeUndefined()
    expect(readContexto(`${TURMA_2B}:`)).toBeUndefined()
    expect(readContexto(`${TURMA_2B}:${QUIMICA}:mais`)).toBeUndefined()
  })

  it('a turma escolhida que deixou de ser dela dá lugar à primeira, e sem turma não há escolhida', () => {
    const turmas = turmasDaProfessora([vinculo([TURMA_2B, '2ºB'], [QUIMICA, 'Química'], 'confirmado'), vinculo([TURMA_1C, '1ºC'], [QUIMICA, 'Química'], 'confirmado')])
    expect(turmaEscolhida(turmas, `${TURMA_2B}:${QUIMICA}`)?.rotulo).toBe('2ºB · Química')
    expect(turmaEscolhida(turmas, `${TURMA_2B}:${CIENCIAS}`)?.rotulo).toBe('1ºC · Química')
    expect(turmaEscolhida(turmas, undefined)?.rotulo).toBe('1ºC · Química')
    expect(turmaEscolhida([], `${TURMA_2B}:${QUIMICA}`)).toBeUndefined()
  })
})
