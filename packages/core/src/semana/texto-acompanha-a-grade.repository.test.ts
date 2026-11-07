import { describe, expect, it } from 'vitest'
import { parear, type AulaDaGrade } from './texto-acompanha-a-grade.repository.js'

const aula = (vinculoId: string, diaSemana: number, inicio: string, fim = '23:59'): AulaDaGrade => ({ vinculoId, diaSemana, inicio, fim })

describe('parear: a aula que sai e a que entra, do mesmo vínculo e dia, na ordem de início (F2b, 5.0)', () => {
  it('uma sai e uma entra: o par leva o início e o fim novos', () => {
    expect(parear({ saem: [aula('v', 1, '07:30')], entram: [aula('v', 1, '07:40', '08:30')] })).toEqual({
      pares: [{ vinculoId: 'v', diaSemana: 1, velho: '07:30', novo: '07:40', fimNovo: '08:30' }],
      sobras: [],
    })
  })

  it('aula dupla: a primeira que sai vai para a primeira que entra, e a segunda para a segunda, qualquer que seja a ordem de chegada', () => {
    const { pares } = parear({ saem: [aula('v', 1, '08:20'), aula('v', 1, '07:30')], entram: [aula('v', 1, '09:00', '09:50'), aula('v', 1, '08:10', '09:00')] })
    expect(pares.map(({ velho, novo }) => [velho, novo]).sort()).toEqual([['07:30', '08:10'], ['08:20', '09:00']])
  })

  it('aula dupla que chega em ordens diferentes: o par é o da posição por início, não o da ordem de chegada de cada lado', () => {
    const { pares } = parear({ saem: [aula('v', 1, '08:20'), aula('v', 1, '07:30')], entram: [aula('v', 1, '08:10', '09:00'), aula('v', 1, '09:00', '09:50')] })
    expect(pares.map(({ velho, novo }) => [velho, novo]).sort()).toEqual([['07:30', '08:10'], ['08:20', '09:00']])
  })

  it('saem duas e entra uma: a primeira re-chaveia e a segunda sai sem par', () => {
    const resultado = parear({ saem: [aula('v', 1, '07:30'), aula('v', 1, '08:20')], entram: [aula('v', 1, '07:40')] })
    expect(resultado.pares.map(({ velho, novo }) => [velho, novo])).toEqual([['07:30', '07:40']])
    expect(resultado.sobras).toEqual([{ vinculoId: 'v', diaSemana: 1, velho: '08:20' }])
  })

  it('entra mais do que sai: a que entra sem par não tem texto a receber', () => {
    expect(parear({ saem: [aula('v', 1, '07:30')], entram: [aula('v', 1, '07:40'), aula('v', 1, '08:30')] }).pares).toHaveLength(1)
  })

  it('dia diferente não é par: a que sai na terça fica sem par e a que entra na quarta não recebe nada', () => {
    expect(parear({ saem: [aula('v', 2, '07:30')], entram: [aula('v', 3, '07:30')] })).toEqual({ pares: [], sobras: [{ vinculoId: 'v', diaSemana: 2, velho: '07:30' }] })
  })

  it('vínculo diferente não é par: o substituto não herda o texto do antecessor', () => {
    expect(parear({ saem: [aula('antecessor', 1, '08:00')], entram: [aula('substituto', 1, '08:00')] })).toEqual({ pares: [], sobras: [{ vinculoId: 'antecessor', diaSemana: 1, velho: '08:00' }] })
  })
})
