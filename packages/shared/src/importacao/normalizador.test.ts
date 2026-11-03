import { describe, expect, it } from 'vitest'
import { chaveDaDisciplina, chaveDaTurma, serieDaChave } from './normalizador.js'

describe('a chave da turma casa as escritas da mesma turma (PRD, RF3)', () => {
  it('"8ºA", "8º A", "8A", "8a" e "8º ano A" dão a mesma chave', () => {
    const chaves = ['8ºA', '8º A', '8A', '8a', '8º ano A', '8 A', '8ª A', '8° a', ' 8o ano  a ', '8ºÁ'].map(chaveDaTurma)
    expect(new Set(chaves)).toEqual(new Set(['8a']))
  })

  it('a chave diferencia a letra e o dígito: "8B" e "9A" não são a "8A"', () => {
    expect(chaveDaTurma('8B')).toBe('8b')
    expect(chaveDaTurma('9A')).toBe('9a')
    expect([chaveDaTurma('8A'), chaveDaTurma('8B'), chaveDaTurma('9A')]).toEqual(['8a', '8b', '9a'])
  })

  it('"Turma Azul" e "10A" ficam sem chave: fora do padrão', () => {
    for (const nome of ['Turma Azul', '10A', '10º A', '8', 'A', '8ºAB', '8ano', '', '   ']) expect(chaveDaTurma(nome), nome).toBeNull()
  })

  it('"1ºA" do Ensino Médio e "6ºA" do Fundamental também têm chave', () => {
    expect([chaveDaTurma('1º A'), chaveDaTurma('6º ano C')]).toEqual(['1a', '6c'])
  })
})

describe('a série que a chave diz (D43)', () => {
  it('6 a 9 são do Ensino Fundamental e 1 a 3, do Médio', () => {
    expect(['6a', '7b', '8a', '9c'].map(serieDaChave)).toEqual([
      { etapa: 'ef_anos_finais', ano: 6 },
      { etapa: 'ef_anos_finais', ano: 7 },
      { etapa: 'ef_anos_finais', ano: 8 },
      { etapa: 'ef_anos_finais', ano: 9 },
    ])
    expect(['1a', '2b', '3c'].map(serieDaChave)).toEqual([
      { etapa: 'em', ano: 1 },
      { etapa: 'em', ano: 2 },
      { etapa: 'em', ano: 3 },
    ])
  })

  it('o dígito 0, 4 e 5 não tem série: a turma que não existe e não tem série é erro, nunca "turma nova"', () => {
    expect(['0a', '4a', '5b'].map(serieDaChave)).toEqual([null, null, null])
  })
})

describe('a chave da disciplina', () => {
  it('"Química", "  QUIMICA " e "química" são a mesma disciplina', () => {
    expect(new Set(['Química', '  QUIMICA ', 'química', 'Quimica'].map(chaveDaDisciplina))).toEqual(new Set(['quimica']))
  })

  it('espaço de dentro vira um só, e disciplinas diferentes continuam diferentes', () => {
    expect(chaveDaDisciplina('Língua   Portuguesa')).toBe('lingua portuguesa')
    expect(chaveDaDisciplina('Física')).not.toBe(chaveDaDisciplina('Química'))
  })
})
