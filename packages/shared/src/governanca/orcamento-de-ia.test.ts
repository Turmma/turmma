import { describe, expect, it } from 'vitest'
import {
  avisoDaPorcentagem,
  diaDeSaoPaulo,
  mesDeSaoPaulo,
  orcamentoDoMes,
  orcamentoSemRetrato,
  orcamentoVigente,
  porcentagemDoOrcamento,
  TETO_PADRAO_PERCENTUAL,
  type RetratoDoOrcamento,
} from './orcamento-de-ia.js'

const REAIS = 1_000_000
const NADA = { valorPorAlunoMicros: null, tetoPercentual: null }

describe('o orçamento que vale: a escola, senão a rede, coluna a coluna (RF7)', () => {
  it('escola sem valor e rede com R$ 5: vale o da rede, e a origem diz "rede"; escola com R$ 3: vale 3, "escola"', () => {
    expect(orcamentoVigente(NADA, { valorPorAlunoMicros: 5 * REAIS, tetoPercentual: null })).toMatchObject({ valorPorAlunoMicros: 5 * REAIS, origemDoValor: 'rede' })
    expect(orcamentoVigente({ valorPorAlunoMicros: 3 * REAIS, tetoPercentual: null }, { valorPorAlunoMicros: 5 * REAIS, tetoPercentual: null })).toMatchObject({
      valorPorAlunoMicros: 3 * REAIS,
      origemDoValor: 'escola',
    })
  })

  it('escola com teto próprio e sem valor: o valor é o da rede e o teto é o da escola; a precedência é por coluna, não por linha', () => {
    expect(orcamentoVigente({ valorPorAlunoMicros: null, tetoPercentual: 150 }, { valorPorAlunoMicros: 5 * REAIS, tetoPercentual: 300 })).toEqual({
      valorPorAlunoMicros: 5 * REAIS,
      origemDoValor: 'rede',
      tetoPercentual: 150,
      origemDoTeto: 'escola',
    })
    // O contrário: valor da escola, teto da rede.
    expect(orcamentoVigente({ valorPorAlunoMicros: 2 * REAIS, tetoPercentual: null }, { valorPorAlunoMicros: 5 * REAIS, tetoPercentual: 300 })).toMatchObject({
      origemDoValor: 'escola',
      tetoPercentual: 300,
      origemDoTeto: 'rede',
    })
  })

  it('nada na escola nem na rede: sem valor, origem "nenhuma", e o teto é o padrão de 200%', () => {
    expect(TETO_PADRAO_PERCENTUAL).toBe(200)
    expect(orcamentoVigente(NADA, NADA)).toEqual({ valorPorAlunoMicros: null, origemDoValor: 'nenhuma', tetoPercentual: 200, origemDoTeto: 'padrao' })
  })
})

describe('a conta: valor por aluno × alunos ativos, e a porcentagem do custo (RF8)', () => {
  const retrato = (alunosAtivos: number, valorPorAlunoMicros: number | null = 5 * REAIS): RetratoDoOrcamento => ({
    alunosAtivos,
    valorPorAlunoMicros,
    tetoPercentual: 200,
    origemDoValor: valorPorAlunoMicros === null ? 'nenhuma' : 'escola',
  })

  it('100 alunos, R$ 5 e R$ 400 gastos: orçamento de R$ 500 e 80%, com o aviso de 80', () => {
    expect(orcamentoDoMes(retrato(100), 400 * REAIS, true)).toMatchObject({ situacao: 'definido', orcamentoMicros: 500 * REAIS, custoMicros: 400 * REAIS, porcentagem: 80, aviso: 80 })
  })

  it('a porcentagem é arredondada para baixo e o aviso vem a 80% exatos: 79,99% é 79 e sem aviso, 80% é 80 e avisa, 100% avisa 100', () => {
    expect(porcentagemDoOrcamento(399_999_999, 500 * REAIS)).toBe(79)
    expect(avisoDaPorcentagem(79)).toBeNull()
    expect(avisoDaPorcentagem(80)).toBe(80)
    expect(avisoDaPorcentagem(99)).toBe(80)
    expect(avisoDaPorcentagem(100)).toBe(100)
    expect(avisoDaPorcentagem(120)).toBe(100)
    expect(orcamentoDoMes(retrato(100), 399_999_999, true)).toMatchObject({ porcentagem: 79, aviso: null })
    expect(orcamentoDoMes(retrato(100), 500 * REAIS, true)).toMatchObject({ porcentagem: 100, aviso: 100 })
  })

  it('o mês fechado a 120% não traz aviso, mas traz a porcentagem', () => {
    expect(orcamentoDoMes(retrato(100), 600 * REAIS, false)).toMatchObject({ situacao: 'definido', porcentagem: 120, aviso: null })
  })

  it('a escola B do isolamento: 900 alunos, R$ 1 e R$ 1.000 gastos são 111%', () => {
    expect(orcamentoDoMes(retrato(900, 1 * REAIS), 1000 * REAIS, true)).toMatchObject({ orcamentoMicros: 900 * REAIS, porcentagem: 111, aviso: 100 })
  })

  it('sem valor: "sem_orcamento", sem porcentagem nem aviso, e o custo continua à vista; sem aluno ativo: "sem_aluno_ativo"; sem os dois, vale "sem_orcamento"', () => {
    expect(orcamentoDoMes(retrato(100, null), 40 * REAIS, true)).toEqual({
      situacao: 'sem_orcamento',
      valorPorAlunoMicros: null,
      origemDoValor: 'nenhuma',
      tetoPercentual: 200,
      alunosAtivos: 100,
      orcamentoMicros: null,
      custoMicros: 40 * REAIS,
      porcentagem: null,
      aviso: null,
    })
    expect(orcamentoDoMes(retrato(0), 40 * REAIS, true)).toMatchObject({ situacao: 'sem_aluno_ativo', orcamentoMicros: null, porcentagem: null, aviso: null, custoMicros: 40 * REAIS })
    expect(orcamentoDoMes(retrato(0, null), 40 * REAIS, true).situacao).toBe('sem_orcamento')
  })

  it('o mês fechado antes da medição: só o custo, "sem_retrato"', () => {
    expect(orcamentoSemRetrato(7 * REAIS)).toEqual({
      situacao: 'sem_retrato',
      valorPorAlunoMicros: null,
      origemDoValor: null,
      tetoPercentual: null,
      alunosAtivos: null,
      orcamentoMicros: null,
      custoMicros: 7 * REAIS,
      porcentagem: null,
      aviso: null,
    })
  })
})

describe('o mês e o dia de São Paulo', () => {
  it('31/03 às 23h30 (UTC-3) é de março e do dia 31, mesmo já sendo abril em UTC; um minuto depois da meia-noite é abril', () => {
    const noite = new Date('2026-03-31T23:30:00-03:00')
    expect(noite.toISOString()).toBe('2026-04-01T02:30:00.000Z')
    expect(mesDeSaoPaulo(noite)).toBe('2026-03')
    expect(diaDeSaoPaulo(noite)).toBe('2026-03-31')
    expect(mesDeSaoPaulo(new Date('2026-04-01T00:01:00-03:00'))).toBe('2026-04')
  })

  it('1º de janeiro às 00h30 de São Paulo é do ano novo, e 31/12 às 23h59 é do ano velho', () => {
    expect(mesDeSaoPaulo(new Date('2027-01-01T00:30:00-03:00'))).toBe('2027-01')
    expect(mesDeSaoPaulo(new Date('2026-12-31T23:59:00-03:00'))).toBe('2026-12')
  })
})
