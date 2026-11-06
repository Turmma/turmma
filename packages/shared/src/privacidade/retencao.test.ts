import { describe, expect, it } from 'vitest'
import { CLASSIFICACAO_DAS_TABELAS } from './classificacao.js'
import { ajusteDeRetencaoCabe, CATEGORIAS_DE_RETENCAO, CHAVES_DE_PRAZO_FIXO, CHAVES_DE_RETENCAO, PRAZOS_FIXOS, retencaoDaEscola, TRAVAS_DE_RETENCAO } from './retencao.js'

describe('catálogo da retenção (F3, Tech Spec, seção 3)', () => {
  it('os valores aprovados em 05/10/2026: padrão, piso e teto de cada categoria, em meses', () => {
    expect(Object.fromEntries(CHAVES_DE_RETENCAO.map((categoria) => [categoria, [CATEGORIAS_DE_RETENCAO[categoria].padrao, CATEGORIAS_DE_RETENCAO[categoria].piso, CATEGORIAS_DE_RETENCAO[categoria].teto]]))).toEqual({
      conversa_tutor: [12, 6, 24],
      sinal_tutor: [12, 6, 24],
      conversa_professor: [12, 3, 24],
      execucao_agente: [12, 3, 24],
      texto_do_modelo: [12, 1, 12],
      consumo_por_aluno: [12, 3, 24],
      trabalho_do_aluno: [12, 6, 60],
      reivindicacao_decidida: [60, 12, 60],
      autoria_de_artefato: [60, 12, 60],
      material_excluido: [60, 12, 60],
      vinculo_encerrado: [60, 12, 60],
      pessoa_desativada: [60, 12, 60],
    })
  })

  it('as travas são as três da Tech Spec, e o padrão de cada categoria travada cabe na trava pelo padrão da mãe', () => {
    expect(TRAVAS_DE_RETENCAO).toEqual({ execucao_agente: 'conversa_professor', texto_do_modelo: 'conversa_professor', consumo_por_aluno: 'conversa_tutor' })
    for (const categoria of CHAVES_DE_RETENCAO) expect(ajusteDeRetencaoCabe(categoria, CATEGORIAS_DE_RETENCAO[categoria].padrao, []), categoria).toBe(true)
  })

  it('F2b: o registro da aula tem prazo fixo próprio, que acaba no encerramento do ano letivo, e todo prazo fixo da classificação está no catálogo', () => {
    expect(CHAVES_DE_PRAZO_FIXO).toContain('registro_da_aula')
    expect(PRAZOS_FIXOS.registro_da_aula.prazo).toMatch(/^até o encerramento do ano letivo/)
    for (const [tabela, classificada] of Object.entries(CLASSIFICACAO_DAS_TABELAS)) {
      if (classificada.classe === 'prazo_fixo') expect(CHAVES_DE_PRAZO_FIXO, tabela).toContain(classificada.prazo)
    }
  })

  it('nenhum prazo fixo tem o nome de uma categoria ajustável', () => {
    for (const fixo of CHAVES_DE_PRAZO_FIXO) expect(CHAVES_DE_RETENCAO as readonly string[]).not.toContain(fixo)
  })
})

describe('retencaoDaEscola: o prazo efetivo, com as travas', () => {
  it('sem ajuste, todas as categorias no padrão, de origem "padrao" e sem trava', () => {
    expect(retencaoDaEscola([])).toEqual(CHAVES_DE_RETENCAO.map((categoria) => ({ categoria, meses: CATEGORIAS_DE_RETENCAO[categoria].padrao, origem: 'padrao', limitadaPor: null })))
  })

  it('o ajuste vale só na categoria dele, com origem "ajustada"', () => {
    const lida = retencaoDaEscola([{ categoria: 'sinal_tutor', meses: 6 }])
    expect(lida.find((retencao) => retencao.categoria === 'sinal_tutor')).toEqual({ categoria: 'sinal_tutor', meses: 6, origem: 'ajustada', limitadaPor: null })
    expect(lida.filter((retencao) => retencao.origem === 'ajustada')).toHaveLength(1)
  })

  it('a mãe abaixo da travada encurta a travada e diz qual trava; a mãe acima não muda nada', () => {
    const lida = retencaoDaEscola([
      { categoria: 'conversa_professor', meses: 3 },
      { categoria: 'execucao_agente', meses: 12 },
      { categoria: 'conversa_tutor', meses: 24 },
      { categoria: 'consumo_por_aluno', meses: 18 },
    ])
    const de = (categoria: string) => lida.find((retencao) => retencao.categoria === categoria)
    expect(de('execucao_agente')).toEqual({ categoria: 'execucao_agente', meses: 3, origem: 'ajustada', limitadaPor: 'conversa_professor' })
    expect(de('texto_do_modelo')).toEqual({ categoria: 'texto_do_modelo', meses: 3, origem: 'padrao', limitadaPor: 'conversa_professor' })
    expect(de('consumo_por_aluno')).toEqual({ categoria: 'consumo_por_aluno', meses: 18, origem: 'ajustada', limitadaPor: null })
    // A mãe sem trava própria nunca é encurtada.
    expect(de('conversa_professor')).toEqual({ categoria: 'conversa_professor', meses: 3, origem: 'ajustada', limitadaPor: null })
  })

  it('a mãe igual à travada não conta como trava', () => {
    const lida = retencaoDaEscola([{ categoria: 'conversa_tutor', meses: 12 }])
    expect(lida.find((retencao) => retencao.categoria === 'consumo_por_aluno')).toEqual({ categoria: 'consumo_por_aluno', meses: 12, origem: 'padrao', limitadaPor: null })
  })
})

describe('ajusteDeRetencaoCabe: piso, teto, travas e prazos fixos', () => {
  it('o piso e o teto exatos cabem; um mês abaixo do piso e um acima do teto, não', () => {
    for (const categoria of CHAVES_DE_RETENCAO) {
      const { piso, teto } = CATEGORIAS_DE_RETENCAO[categoria]
      // Com a mãe no teto dela, a trava não interfere.
      const maes = [{ categoria: 'conversa_professor', meses: 24 } as const, { categoria: 'conversa_tutor', meses: 24 } as const]
      expect(ajusteDeRetencaoCabe(categoria, piso, maes), `${categoria} piso`).toBe(true)
      expect(ajusteDeRetencaoCabe(categoria, teto, maes), `${categoria} teto`).toBe(true)
      expect(ajusteDeRetencaoCabe(categoria, piso - 1, maes), `${categoria} piso - 1`).toBe(false)
      expect(ajusteDeRetencaoCabe(categoria, teto + 1, maes), `${categoria} teto + 1`).toBe(false)
    }
  })

  it('prazo fixo, nome fora do catálogo e mês fracionado nunca cabem', () => {
    for (const fixo of CHAVES_DE_PRAZO_FIXO) expect(ajusteDeRetencaoCabe(fixo, 12, []), fixo).toBe(false)
    expect(ajusteDeRetencaoCabe('apagar_tudo', 12, [])).toBe(false)
    expect(ajusteDeRetencaoCabe('conversa_tutor', 12.5, [])).toBe(false)
  })

  it('a travada acima da mãe (ajustada ou no padrão) não cabe; igual ou abaixo, cabe', () => {
    const professorEm6 = [{ categoria: 'conversa_professor', meses: 6 }] as const
    expect(ajusteDeRetencaoCabe('texto_do_modelo', 7, professorEm6)).toBe(false)
    expect(ajusteDeRetencaoCabe('texto_do_modelo', 6, professorEm6)).toBe(true)
    expect(ajusteDeRetencaoCabe('execucao_agente', 7, professorEm6)).toBe(false)
    // A mãe no padrão (12): o consumo por aluno em 13 passa do padrão da conversa do Tutor.
    expect(ajusteDeRetencaoCabe('consumo_por_aluno', 13, [])).toBe(false)
    expect(ajusteDeRetencaoCabe('consumo_por_aluno', 13, [{ categoria: 'conversa_tutor', meses: 24 }])).toBe(true)
    // A trava de uma mãe não alcança a travada da outra.
    expect(ajusteDeRetencaoCabe('consumo_por_aluno', 13, [{ categoria: 'conversa_professor', meses: 3 }, { categoria: 'conversa_tutor', meses: 24 }])).toBe(true)
  })

  it('baixar a mãe abaixo da travada ajustada cabe: o efetivo da travada acompanha', () => {
    expect(ajusteDeRetencaoCabe('conversa_professor', 3, [{ categoria: 'execucao_agente', meses: 12 }, { categoria: 'texto_do_modelo', meses: 12 }])).toBe(true)
    expect(ajusteDeRetencaoCabe('conversa_tutor', 6, [{ categoria: 'consumo_por_aluno', meses: 24 }])).toBe(true)
  })
})
