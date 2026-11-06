import { MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { TEXTO_DO_GRUPO_DE_MARCA } from '../importacao/previa-da-planilha'
import {
  ERROS_DA_LINHA_DE_PROFESSORES,
  FRASES_DO_RESUMO_DAS_MARCAS_DE_PROFESSORES,
  INSTRUCAO_DA_PLANILHA_DE_PROFESSORES,
  TEXTOS_DAS_MARCAS_DE_PROFESSORES,
  textoDaConclusaoDeProfessores,
} from './importar-professores'

/**
 * As palavras do painel "Importar professores" (F2, 15.0; RF4 e RF6): o teto de 300 linhas dito pelo contrato, os erros que a planilha
 * diz do jeito dela, a marca de desligar que diz "professor" e o que a tela conta ao terminar.
 */
describe('15.0 (unidade): o painel de importar professores em texto', () => {
  it('a instrução diz o teto do contrato (300 linhas, e não as 3.000 da de alunos), que quem entra fica com o convite em aberto e que só sai com a marca', () => {
    expect(MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES).toBe(300)
    expect(INSTRUCAO_DA_PLANILHA_DE_PROFESSORES).toContain('até 300 linhas')
    expect(INSTRUCAO_DA_PLANILHA_DE_PROFESSORES).not.toContain('3.000')
    expect(INSTRUCAO_DA_PLANILHA_DE_PROFESSORES).toMatch(/cadastrado com o convite em aberto/)
    expect(INSTRUCAO_DA_PLANILHA_DE_PROFESSORES).toMatch(/só sai com a sua marca/)
  })

  it('o nome vazio manda para a coluna "nome" (a da grade é "professor"), e a linha acima do teto diz o teto e o que fazer', () => {
    expect(ERROS_DA_LINHA_DE_PROFESSORES['nome_vazio']).toMatch(/Preencha a coluna "nome"/)
    expect(ERROS_DA_LINHA_DE_PROFESSORES['acima_do_teto']).toMatch(/até 300 linhas.*Divida em partes/)
  })

  it('a marca de desligar diz professor, e nenhum texto dela fala de aluno nem de e-mail', () => {
    const grupo = TEXTOS_DAS_MARCAS_DE_PROFESSORES.desligar
    expect(grupo).toBeDefined()
    expect(grupo).not.toEqual(TEXTO_DO_GRUPO_DE_MARCA.desligar)
    expect(grupo?.explicacao).toMatch(/professor desligado perde o acesso/)
    expect(grupo?.rotuloDoTodos).toBe('Marcar todos para desligar')
    const todos = [grupo?.titulo, grupo?.explicacao, grupo?.rotuloDoTodos, ...(FRASES_DO_RESUMO_DAS_MARCAS_DE_PROFESSORES.desligar ?? [])].join(' ')
    expect(todos).not.toMatch(/aluno/i)
    expect(todos).not.toMatch(/e-?mail/i)
  })

  it('ao terminar, "cadastrados" sempre aparece, mesmo zero; o que já estava e quem saiu só quando houve; e o link só é explicado a quem foi cadastrado', () => {
    expect(textoDaConclusaoDeProfessores({ entram: 2, ja_existem: 1, desligados: 1 })).toBe(
      '2 professores cadastrados, com o convite em aberto. 1 professor já estava na escola, e nada mudou. 1 professor foi desligado. Para pegar o link de cada um, abra o professor na lista e use “Refazer convite”: o link aparece uma vez.',
    )
    expect(textoDaConclusaoDeProfessores({ entram: 1 })).toBe(
      '1 professor cadastrado, com o convite em aberto. Para pegar o link de cada um, abra o professor na lista e use “Refazer convite”: o link aparece uma vez.',
    )
    expect(textoDaConclusaoDeProfessores({ entram: 0, ja_existem: 3, desligados: 0 })).toBe('0 professores cadastrados, com o convite em aberto. 3 professores já estavam na escola, e nada mudou.')
    expect(textoDaConclusaoDeProfessores(null)).toBe('0 professores cadastrados, com o convite em aberto.')
  })
})
