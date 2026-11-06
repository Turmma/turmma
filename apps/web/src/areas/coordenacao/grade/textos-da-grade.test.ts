import { describe, expect, it } from 'vitest'
import {
  AVISO_DA_DESCRICAO,
  AVISO_DA_SALA,
  ERROS_DA_LINHA_DO_CALENDARIO,
  INSTRUCAO_DA_GRADE,
  INSTRUCAO_DO_CALENDARIO,
  NOME_DO_TIPO_DE_EVENTO,
  TEXTO_DOS_MODELOS,
  textoDaConclusaoDaGrade,
  textoDaConclusaoDoCalendario,
  VAZIO_DA_GRADE,
  VAZIO_DO_CALENDARIO,
  VAZIO_DO_PAINEL_DA_GRADE,
  VAZIO_DO_PAINEL_DO_CALENDARIO,
} from './textos-da-grade'

describe('o que a aba Grade e calendário diz ao terminar (14.0)', () => {
  it('a grade conta as aulas (sempre, mesmo zero) e só diz o que houve: o que nasceu e o que saiu', () => {
    expect(textoDaConclusaoDaGrade({ aulas: 0 })).toBe('0 aulas gravadas.')
    expect(textoDaConclusaoDaGrade(null)).toBe('0 aulas gravadas.')
    expect(
      textoDaConclusaoDaGrade({ aulas: 12, aulas_removidas: 1, turmas_novas: 2, disciplinas_novas: 1, professores_novos: 3, vinculos_criados: 4, vinculos_encerrados: 1 }),
    ).toBe(
      '12 aulas gravadas. 1 aula saiu da grade. 2 turmas novas foram criadas. 1 disciplina nova foi criada. 3 professores novos foram cadastrados. 4 vínculos de professor esperam a confirmação deles. 1 vínculo de professor foi encerrado.',
    )
  })

  it('o calendário conta os eventos que entraram e, só quando houve, os que saíram', () => {
    expect(textoDaConclusaoDoCalendario({ entram: 3 })).toBe('3 eventos entraram no calendário.')
    expect(textoDaConclusaoDoCalendario({ entram: 1, eventos_removidos: 2 })).toBe('1 evento entrou no calendário. 2 eventos saíram do calendário.')
    expect(textoDaConclusaoDoCalendario(null)).toBe('0 eventos entraram no calendário.')
  })

  it('cada tipo de evento tem o nome em português, e as instruções dizem que importar de novo substitui', () => {
    expect(NOME_DO_TIPO_DE_EVENTO).toEqual({ feriado: 'Feriado', recesso: 'Recesso', evento: 'Evento' })
    expect(INSTRUCAO_DA_GRADE(3000)).toContain('substitui a grade do ano')
    expect(INSTRUCAO_DO_CALENDARIO(3000)).toContain('substitui os eventos do ano')
  })

  it('o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos', () => {
    expect(AVISO_DA_SALA).toMatch(/nunca o nome de uma pessoa/)
    expect(AVISO_DA_DESCRICAO).toMatch(/nunca o nome de uma pessoa/)
    expect(INSTRUCAO_DA_GRADE(3000)).toContain(AVISO_DA_SALA)
    expect(INSTRUCAO_DO_CALENDARIO(3000)).toContain(AVISO_DA_DESCRICAO)
    expect(VAZIO_DO_PAINEL_DA_GRADE).toContain(AVISO_DA_SALA)
    expect(VAZIO_DA_GRADE).toContain(AVISO_DA_SALA)
    expect(VAZIO_DO_PAINEL_DO_CALENDARIO).toContain(AVISO_DA_DESCRICAO)
    expect(VAZIO_DO_CALENDARIO).toContain(AVISO_DA_DESCRICAO)
    expect(TEXTO_DOS_MODELOS).toContain(AVISO_DA_SALA)
    expect(TEXTO_DOS_MODELOS).toContain(AVISO_DA_DESCRICAO)
  })

  it('o calendário diz o fim antes do início do jeito dele: o evento de um dia só é válido, e não fala em horário', () => {
    expect(ERROS_DA_LINHA_DO_CALENDARIO['fim_antes_do_inicio']).toBe('O fim vem antes do início. Confira as duas colunas: o evento de um dia só tem o mesmo dia nas duas.')
    expect(ERROS_DA_LINHA_DO_CALENDARIO['fim_antes_do_inicio']).not.toContain('horário')
  })
})
