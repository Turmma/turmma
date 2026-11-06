import type { AulaDaGrade } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { montarGrade, NOME_DA_DISCIPLINA_QUE_SAIU } from './grade-da-turma'

const TURMA = '0190f5a0-0000-7000-8000-000000000001'
const aula = (n: number, extras: Partial<AulaDaGrade> = {}): AulaDaGrade => ({
  id: `0190f5a0-0000-7000-8000-00000000010${String(n)}`,
  turmaId: TURMA,
  disciplinaId: 'd-mat',
  professor: { usuarioId: '0190f5a0-0000-7000-8000-000000000201', nome: 'Ana Souza' },
  diaSemana: 1,
  inicio: '07:30',
  fim: '08:20',
  sala: null,
  ...extras,
})
const nomes = (id: string | null): string | undefined => ({ 'd-mat': 'Matemática', 'd-por': 'Português' })[id ?? '']

describe('a grade da turma, dias × horários (14.0; Tech Spec, seção 9)', () => {
  it('mostra segunda a sexta sempre, e sábado e domingo só quando há aula neles', () => {
    expect(montarGrade([], nomes).dias.map(({ nome }) => nome)).toEqual(['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'])
    expect(montarGrade([aula(1, { diaSemana: 6 })], nomes).dias.map(({ nome }) => nome)).toEqual(['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'])
    expect(montarGrade([aula(1, { diaSemana: 7 })], nomes).dias.map(({ numero }) => numero)).toEqual([1, 2, 3, 4, 5, 7])
  })

  it('um horário por par início-fim, do mais cedo ao mais tarde, sem repetir o que duas aulas dividem', () => {
    const grade = montarGrade([aula(1, { inicio: '09:00', fim: '09:50' }), aula(2, { diaSemana: 2 }), aula(3), aula(4, { inicio: '07:30', fim: '08:00', diaSemana: 3 })], nomes)
    expect(grade.horarios.map(({ inicio, fim }) => `${inicio}-${fim}`)).toEqual(['07:30-08:00', '07:30-08:20', '09:00-09:50'])
  })

  it('a aula cai no dia e no horário dela, com a disciplina pelo nome, o professor só pelo nome e a sala', () => {
    const grade = montarGrade([aula(1, { diaSemana: 3, sala: 'Lab 2' })], nomes)
    const [horario] = grade.horarios
    expect(horario).toBeDefined()
    if (horario === undefined) return
    expect(grade.aulasEm(3, horario)).toEqual([{ id: aula(1).id, disciplina: 'Matemática', professor: 'Ana Souza', sala: 'Lab 2' }])
    expect(grade.aulasEm(1, horario)).toEqual([])
    expect(grade.aulasEm(4, horario)).toEqual([])
  })

  it('duas aulas no mesmo dia e horário (turma dividida) aparecem juntas, pela disciplina', () => {
    const grade = montarGrade([aula(1, { disciplinaId: 'd-por' }), aula(2, { disciplinaId: 'd-mat', professor: { usuarioId: '0190f5a0-0000-7000-8000-000000000202', nome: 'Bia Lima' } })], nomes)
    const [horario] = grade.horarios
    if (horario === undefined) throw new Error('sem horário')
    expect(grade.aulasEm(1, horario).map(({ disciplina, professor }) => `${disciplina} · ${professor}`)).toEqual(['Matemática · Bia Lima', 'Português · Ana Souza'])
  })

  it('duas aulas da mesma disciplina no mesmo horário se desempatam pelo nome do professor', () => {
    const grade = montarGrade([aula(1, { professor: { usuarioId: '0190f5a0-0000-7000-8000-000000000203', nome: 'Carla Dias' } }), aula(2, { professor: { usuarioId: '0190f5a0-0000-7000-8000-000000000204', nome: 'Ana Souza' } })], nomes)
    const [horario] = grade.horarios
    if (horario === undefined) throw new Error('sem horário')
    expect(grade.aulasEm(1, horario).map(({ professor }) => professor)).toEqual(['Ana Souza', 'Carla Dias'])
  })

  it('a disciplina que a escola já não tem, ou a aula sem disciplina, diz isso em vez de ficar em branco', () => {
    const grade = montarGrade([aula(1, { disciplinaId: null }), aula(2, { disciplinaId: 'd-que-saiu', diaSemana: 2 })], nomes)
    const [horario] = grade.horarios
    if (horario === undefined) throw new Error('sem horário')
    expect(grade.aulasEm(1, horario)[0]?.disciplina).toBe(NOME_DA_DISCIPLINA_QUE_SAIU)
    expect(grade.aulasEm(2, horario)[0]?.disciplina).toBe(NOME_DA_DISCIPLINA_QUE_SAIU)
  })
})
