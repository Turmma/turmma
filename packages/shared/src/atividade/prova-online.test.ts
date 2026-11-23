import { describe, expect, it } from 'vitest'
import {
  acompanhamentoResponseSchema,
  aplicarAtividadeRequestSchema,
  atividadeAplicadaSchema,
  camposInvalidosDaProva,
  estenderTempoRequestSchema,
  mudarJanelaRequestSchema,
  segundaChamadaRequestSchema,
  SEM_EMBARALHAR,
  tempoAdicionalCabeNaJanela,
} from './atividade-aplicada.js'
import { comecarResponseSchema, provaAntesDeComecarResponseSchema, provaOnlineResponseSchema, registrarSaidaDaAbaRequestSchema, tempoResponseSchema } from './prova.js'

// Valores fixos e sintéticos: o pacote não tem os tipos do Node.
const ARTEFATO = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const TURMA = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c'
const ANA = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d'
const BIA = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e'
const ABRE = '2026-12-01T10:00:00.000Z'
const janelaDe = (minutos: number) => ({ abreEm: ABRE, fechaEm: new Date(Date.parse(ABRE) + minutos * 60_000).toISOString() })
const corpo = { artefatoId: ARTEFATO, turmaId: TURMA, avaliativa: true }
/** Um uuid v4 (o dígito da versão é 4) e um v7 (carrega o instante): só o primeiro é chave de saída da aba. */
const CHAVE_V4 = '3f1c2a4e-5b6d-4c8f-9a0b-1c2d3e4f5a6b'
const CHAVE_V7 = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'

describe('a janela, a duração e o tempo adicional que cabem (RF1, RF3)', () => {
  it('o tempo adicional cabe quando a janela comporta a duração com o maior percentual: 50 min não comportam 40 +50%, 60 min comportam', () => {
    expect(tempoAdicionalCabeNaJanela(janelaDe(50), 40, [50])).toBe(false)
    expect(tempoAdicionalCabeNaJanela(janelaDe(60), 40, [50])).toBe(true)
    // O maior percentual da lista decide; sem tempo adicional a conta nem é feita, e a janela de 10 min com duração de 40 cabe (quem começa tarde tem só o que sobra, RF1).
    expect(tempoAdicionalCabeNaJanela(janelaDe(70), 40, [25, 50])).toBe(true)
    expect(tempoAdicionalCabeNaJanela(janelaDe(79), 40, [25, 100])).toBe(false)
    expect(tempoAdicionalCabeNaJanela(janelaDe(80), 40, [25, 100])).toBe(true)
    expect(tempoAdicionalCabeNaJanela(janelaDe(10), 40, [])).toBe(true)
  })

  it('a conferência única diz o campo: fora de avaliativa nada de prova; duração sem janela; tempo adicional sem duração; o que não cabe é da janela', () => {
    const prova = { embaralhar: SEM_EMBARALHAR, tempoAdicional: [] as { alunoId: string; percentual: 25 | 50 | 100 }[] }
    expect(camposInvalidosDaProva({ ...prova, avaliativa: false, janela: janelaDe(60), duracaoMin: 40 })).toEqual(['janela', 'duracaoMin'])
    expect(camposInvalidosDaProva({ ...prova, avaliativa: false, embaralhar: { questoes: true, alternativas: false } })).toEqual(['embaralhar'])
    expect(camposInvalidosDaProva({ ...prova, avaliativa: false, embaralhar: { questoes: false, alternativas: true } })).toEqual(['embaralhar'])
    expect(camposInvalidosDaProva({ ...prova, avaliativa: false, tempoAdicional: [{ alunoId: ANA, percentual: 25 }] })).toEqual(['tempoAdicional'])
    expect(camposInvalidosDaProva({ ...prova, avaliativa: true, duracaoMin: 40 })).toEqual(['duracaoMin'])
    // Duração com tempo adicional e sem janela: só a duração é apontada, e a conta da janela não se faz sem janela.
    expect(camposInvalidosDaProva({ ...prova, avaliativa: true, duracaoMin: 40, tempoAdicional: [{ alunoId: ANA, percentual: 25 }] })).toEqual(['duracaoMin'])
    expect(camposInvalidosDaProva({ ...prova, avaliativa: true, janela: janelaDe(60), tempoAdicional: [{ alunoId: ANA, percentual: 25 }] })).toEqual(['tempoAdicional'])
    expect(camposInvalidosDaProva({ ...prova, avaliativa: true, janela: janelaDe(50), duracaoMin: 40, tempoAdicional: [{ alunoId: ANA, percentual: 50 }] })).toEqual(['janela'])
    expect(camposInvalidosDaProva({ ...prova, avaliativa: true, janela: janelaDe(60), duracaoMin: 40, tempoAdicional: [{ alunoId: ANA, percentual: 50 }] })).toEqual([])
    // Com janela e sem duração (a prova aberta, sem relógio por aluno) nada se aponta: não há o que conferir.
    expect(camposInvalidosDaProva({ ...prova, avaliativa: true, janela: janelaDe(60) })).toEqual([])
    // Até a 10.0 a avaliativa pode vir sem janela, como antes da F6.
    expect(camposInvalidosDaProva({ ...prova, avaliativa: true })).toEqual([])
  })
})

describe('aplicar com prova: o corpo é estrito e sem motivo', () => {
  const tempoAdicional = [{ alunoId: ANA, percentual: 25 }, { alunoId: BIA, percentual: 100 }]

  it('aceita a janela, a duração, o embaralhamento e o tempo adicional que cabem; o corpo antigo vale com o padrão', () => {
    const completo = { ...corpo, janela: janelaDe(90), duracaoMin: 40, embaralhar: { questoes: true, alternativas: true }, tempoAdicional }
    expect(aplicarAtividadeRequestSchema.safeParse(completo).success).toBe(true)
    expect(aplicarAtividadeRequestSchema.parse(corpo)).toEqual({ ...corpo, embaralhar: SEM_EMBARALHAR, tempoAdicional: [] })
  })

  it('recusa campo de motivo, percentual fora de 25, 50 e 100, aluno repetido, duração fora de 5 a 300 e janela invertida', () => {
    const valido = { ...corpo, janela: janelaDe(90), duracaoMin: 40 }
    for (const ruim of [
      { tempoAdicional: [{ alunoId: ANA, percentual: 25, motivo: 'laudo' }] },
      { tempoAdicional: [{ alunoId: ANA, percentual: 30 }] },
      { tempoAdicional: [{ alunoId: ANA, percentual: 25 }, { alunoId: ANA, percentual: 50 }] },
      { motivo: 'feriado' },
      { duracaoMin: 4 },
      { duracaoMin: 301 },
      { janela: { abreEm: janelaDe(90).fechaEm, fechaEm: ABRE } },
      { janela: { ...janelaDe(90), motivo: 'x' } },
    ]) {
      expect(aplicarAtividadeRequestSchema.safeParse({ ...valido, ...ruim }).success, JSON.stringify(ruim)).toBe(false)
    }
    expect(aplicarAtividadeRequestSchema.safeParse({ ...valido, tempoAdicional: [{ alunoId: ANA, percentual: 50 }] }).success).toBe(true)
  })

  it('a janela que não comporta o tempo adicional é recusada no campo da janela', () => {
    const resultado = aplicarAtividadeRequestSchema.safeParse({ ...corpo, janela: janelaDe(50), duracaoMin: 40, tempoAdicional: [{ alunoId: ANA, percentual: 50 }] })
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues.map((problema) => problema.path)).toEqual([['janela']])
  })
})

describe('mudar a janela, estender e a segunda chamada', () => {
  it('o PATCH é parcial e pede ao menos um campo; a lista inteira do tempo adicional vale, inclusive a vazia', () => {
    expect(mudarJanelaRequestSchema.safeParse({}).success).toBe(false)
    expect(mudarJanelaRequestSchema.safeParse({ janela: janelaDe(60) }).success).toBe(true)
    expect(mudarJanelaRequestSchema.safeParse({ duracaoMin: 30 }).success).toBe(true)
    expect(mudarJanelaRequestSchema.safeParse({ tempoAdicional: [] }).success).toBe(true)
    expect(mudarJanelaRequestSchema.safeParse({ duracaoMin: 30, motivo: 'x' }).success).toBe(false)
    expect(mudarJanelaRequestSchema.safeParse({ tempoAdicional: [{ alunoId: ANA, percentual: 25, motivo: 'x' }] }).success).toBe(false)
  })

  it('estender leva a chave da tela e de 1 a 120 minutos; a chave a mais ou sem uuid é recusada', () => {
    const chave = CHAVE_V4
    expect(estenderTempoRequestSchema.safeParse({ minutos: 10, chave }).success).toBe(true)
    expect(estenderTempoRequestSchema.safeParse({ alunoId: ANA, minutos: 120, chave }).success).toBe(true)
    for (const ruim of [{ minutos: 0, chave }, { minutos: 121, chave }, { minutos: 10 }, { minutos: 10, chave: 'abc' }, { minutos: 10, chave, motivo: 'x' }, { minutos: 1.5, chave }]) {
      expect(estenderTempoRequestSchema.safeParse(ruim).success, JSON.stringify(ruim)).toBe(false)
    }
  })

  it('a segunda chamada pede os convocados e a janela nova; o tempo adicional é só de quem foi convocado', () => {
    const base = { alunoIds: [ANA], janela: janelaDe(60), duracaoMin: 40 }
    expect(segundaChamadaRequestSchema.safeParse(base).success).toBe(true)
    expect(segundaChamadaRequestSchema.safeParse({ ...base, tempoAdicional: [{ alunoId: ANA, percentual: 25 }] }).success).toBe(true)
    expect(segundaChamadaRequestSchema.safeParse({ ...base, tempoAdicional: [{ alunoId: BIA, percentual: 25 }] }).success).toBe(false)
    expect(segundaChamadaRequestSchema.safeParse({ ...base, alunoIds: [] }).success).toBe(false)
    expect(segundaChamadaRequestSchema.safeParse({ ...base, alunoIds: [ANA, ANA] }).success).toBe(false)
  })
})

describe('a saída da aba e as respostas de tempo: sem hora, sem percentual, sem a contagem para quem não é do professor', () => {
  it('a chave da saída é uuid v4: o v7 traz o instante da saída e é recusado', () => {
    expect(registrarSaidaDaAbaRequestSchema.safeParse({ chave: CHAVE_V4 }).success).toBe(true)
    expect(registrarSaidaDaAbaRequestSchema.safeParse({ chave: CHAVE_V7 }).success).toBe(false)
    expect(registrarSaidaDaAbaRequestSchema.safeParse({ chave: CHAVE_V4, em: ABRE }).success).toBe(false)
    expect(registrarSaidaDaAbaRequestSchema.safeParse({}).success).toBe(false)
  })

  it('a atividade aplicada devolve só a contagem de quem tem tempo adicional, e nada com o percentual ou o aluno', () => {
    const lida = {
      id: ARTEFATO,
      artefatoId: ARTEFATO,
      turmaId: TURMA,
      titulo: 'Prova',
      avaliativa: true,
      estado: 'aberta',
      questoes: 5,
      aplicadaEm: ABRE,
      encerradaEm: null,
      janela: janelaDe(60),
      duracaoMin: 40,
      embaralhar: SEM_EMBARALHAR,
      segundaChamadaDe: null,
      comTempoAdicional: 2,
      participacao: { alunos: 3, iniciaram: 0, enviaram: 0 },
      entrega: null,
    }
    expect(atividadeAplicadaSchema.safeParse(lida).success).toBe(true)
    for (const extra of [{ tempoAdicional: [{ alunoId: ANA, percentual: 25 }] }, { percentual: 25 }, { saidasDaAba: 1 }]) {
      expect(atividadeAplicadaSchema.safeParse({ ...lida, ...extra }).success, JSON.stringify(extra)).toBe(false)
    }
  })

  it('o acompanhamento do professor não tem a contagem de saídas (D70, D88), e as respostas do aluno não dizem o percentual', () => {
    const linha = { alunoId: ANA, nome: 'Aluna Sintética Ana', situacao: 'fazendo', limiteEm: ABRE }
    const resposta = (alunos: unknown[]) => ({ atividadeAplicadaId: ARTEFATO, agora: ABRE, alunos })
    expect(acompanhamentoResponseSchema.safeParse(resposta([linha])).success).toBe(true)
    for (const campo of [{ saidasDaAba: 2 }, { saidas: 2 }, { percentual: 25 }, { tempoAdicional: 25 }]) {
      expect(acompanhamentoResponseSchema.safeParse(resposta([{ ...linha, ...campo }])).success, JSON.stringify(campo)).toBe(false)
    }
    // As três respostas do aluno (antes de começar, a prova em andamento e o tempo) são estritas: um campo de tempo adicional não passa.
    const antes = { comecou: false, atividadeAplicadaId: ARTEFATO, titulo: 'Prova', janela: janelaDe(60), duracaoMin: 60 }
    expect(provaAntesDeComecarResponseSchema.safeParse(antes).success).toBe(true)
    expect(provaOnlineResponseSchema.safeParse(antes).success).toBe(true)
    for (const campo of [{ tempoAdicional: 50 }, { percentual: 50 }, { saidasDaAba: 1 }]) {
      expect(provaAntesDeComecarResponseSchema.safeParse({ ...antes, ...campo }).success, JSON.stringify(campo)).toBe(false)
      expect(tempoResponseSchema.safeParse({ limiteEm: ABRE, agora: ABRE, envio: null, ...campo }).success, JSON.stringify(campo)).toBe(false)
    }
    expect(tempoResponseSchema.safeParse({ limiteEm: ABRE, agora: ABRE, envio: null }).success).toBe(true)
    expect(comecarResponseSchema.safeParse({ ...antes, tempo: { limiteEm: ABRE, agora: ABRE, envio: null } }).success).toBe(false)
  })
})
