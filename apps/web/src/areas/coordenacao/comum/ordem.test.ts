import { describe, expect, it } from 'vitest'
import { sortPeloNome, sortSeries, sortTurmas, sortVinculos } from './ordem'

const serie = (etapa: 'ef_anos_finais' | 'em', ano: number) => ({ etapa, ano })
const turma = (nome: string, etapa: 'ef_anos_finais' | 'em', ano: number) => ({ nome, serie: serie(etapa, ano) })

describe('a ordem das listas da Estrutura', () => {
  it('as séries: anos finais antes do Ensino Médio, cada etapa pelo ano', () => {
    const fora = [serie('em', 2), serie('ef_anos_finais', 9), serie('em', 1), serie('ef_anos_finais', 6), serie('em', 3), serie('ef_anos_finais', 7)]
    expect(sortSeries(fora)).toEqual([serie('ef_anos_finais', 6), serie('ef_anos_finais', 7), serie('ef_anos_finais', 9), serie('em', 1), serie('em', 2), serie('em', 3)])
    // A lista que chegou não muda de ordem: é a do cache da consulta.
    expect(fora[0]).toEqual(serie('em', 2))
  })

  it('o nome em português, e não pelo código do caractere (o acento e a minúscula não vão para o fim), e com o número como número', () => {
    const nomes = (lista: string[]) => sortPeloNome(lista.map((nome) => ({ nome }))).map((item) => item.nome)
    expect(nomes(['Química', 'Física', 'Ética', 'artes', 'Educação Física'])).toEqual(['artes', 'Educação Física', 'Ética', 'Física', 'Química'])
    expect(nomes(['10ºA', '7ºB', '7ºA'])).toEqual(['7ºA', '7ºB', '10ºA'])
  })

  it('as turmas: pela série e, dentro dela, pelo nome', () => {
    const fora = [turma('1ºA', 'em', 1), turma('7ºB', 'ef_anos_finais', 7), turma('6ºA', 'ef_anos_finais', 6), turma('7ºA', 'ef_anos_finais', 7)]
    expect(sortTurmas(fora).map((item) => item.nome)).toEqual(['6ºA', '7ºA', '7ºB', '1ºA'])
    // Pela série, e não só pelo nome: a "Turma A" do 9º ano vem depois da "Turma B" do 6º.
    expect(sortTurmas([turma('Turma A', 'ef_anos_finais', 9), turma('Turma B', 'ef_anos_finais', 6)]).map((item) => item.nome)).toEqual(['Turma B', 'Turma A'])
  })

  it('os vínculos: pela turma, depois pela disciplina, depois pelo professor', () => {
    const vinculo = (turma: string, disciplina: string | undefined, professor: string) => ({ turma: { nome: turma }, ...(disciplina === undefined ? {} : { disciplina: { nome: disciplina } }), professor })
    const fora = [vinculo('7ºB', 'Artes', 'Ana'), vinculo('7ºA', 'Ciências', 'Bruno'), vinculo('7ºA', 'Artes', 'Carla'), vinculo('7ºA', 'Artes', 'Ana'), vinculo('7ºA', undefined, 'Zeca')]
    expect(sortVinculos(fora, (item) => item.professor).map((item) => `${item.turma.nome} ${item.disciplina?.nome ?? '-'} ${item.professor}`)).toEqual([
      '7ºA - Zeca',
      '7ºA Artes Ana',
      '7ºA Artes Carla',
      '7ºA Ciências Bruno',
      '7ºB Artes Ana',
    ])
  })
})
