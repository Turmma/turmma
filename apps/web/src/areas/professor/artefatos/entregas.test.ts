import { decidirEntregaRequestSchema, type Entrega } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { textoDaAprovacao, motivoDaRejeicao } from '../../../componentes/ui/ia/aprovacao'
import { problemaDoTexto } from '../../../componentes/ui/campos/texto-longo'
import { aprovacaoDaEntrega, avisoDaFuncaoSuspensa, decideAqui, podeRenomear, saidaEmPdf, entregasDoFiltro, falaDaEntrega, LIMITES_DA_JUSTIFICATIVA, resumoDaAprovacao, textoDaAdaptacao } from './entregas'

const TURMA = '0190f5a0-0000-7000-8000-00000000002b'
const AGORA = new Date('2026-10-05T12:00:00.000Z')

function entrega(final: string, campos: Partial<Entrega> = {}): Entrega {
  return {
    id: `0190f5a0-0000-7000-8000-0000000000${final}`,
    tipo: 'versao_adaptada',
    funcao: 'adaptacao',
    estado: 'pendente',
    turmaId: TURMA,
    titulo: 'Atividade de estequiometria (versão adaptada)',
    artefatoId: '0190f5a0-0000-7000-8000-0000000000a9',
    atividadeAplicadaId: null,
    criadaEm: '2026-10-05T13:40:00.000Z',
    decididaEm: null,
    decididaPor: null,
    justificativa: null,
    ...campos,
  }
}
const CAMILA = { id: '0190f5a0-0000-7000-8000-0000000000f1', nome: 'Camila Souza' }

describe('o texto de cada estado da entrega (regra 70, itens 3 e 6)', () => {
  const texto = (item: Entrega) => textoDaAprovacao(aprovacaoDaEntrega(item), { verbo: 'Aprovada por', fuso: 'America/Sao_Paulo', agora: AGORA })

  it('pendente diz que espera a professora, e não tem autor nem data', () => {
    expect(aprovacaoDaEntrega(entrega('01'))).toEqual({ estado: 'pendente' })
    expect(texto(entrega('01'))).toBe('Esperando você')
  })

  it('aprovada diz quem aprovou e quando', () => {
    const aprovada = entrega('02', { estado: 'aprovada', decididaEm: '2026-10-05T13:42:00.000Z', decididaPor: CAMILA })
    expect(texto(aprovada)).toBe('Aprovada por Camila Souza · 05/10, 10h42')
  })

  it('rejeitada diz quem rejeitou, quando e o motivo', () => {
    const rejeitada = entrega('03', { estado: 'rejeitada', decididaEm: '2026-10-05T13:50:00.000Z', decididaPor: CAMILA, justificativa: 'A questão 3 ficou sem o enunciado.' })
    expect(texto(rejeitada)).toBe('Camila Souza rejeitou · 05/10, 10h50')
    expect(motivoDaRejeicao(aprovacaoDaEntrega(rejeitada))).toBe('Motivo: A questão 3 ficou sem o enunciado.')
  })

  it('quem decidiu e saiu da escola deixa o registro, sem o nome', () => {
    expect(texto(entrega('04', { estado: 'aprovada', decididaEm: '2026-10-05T13:42:00.000Z' }))).toBe('Aprovada por pessoa que não está mais na escola · 05/10, 10h42')
  })

  it('a decidida sem data não é afirmada como aprovada', () => {
    expect(aprovacaoDaEntrega(entrega('05', { estado: 'aprovada', decididaPor: CAMILA }))).toEqual({ estado: 'pendente' })
  })
})

describe('a conversa de "O que o Assistente fez" (11.4)', () => {
  const lista = [
    entrega('01'),
    entrega('02', { estado: 'aprovada', decididaEm: '2026-10-05T13:42:00.000Z', decididaPor: CAMILA }),
    entrega('03', { tipo: 'lote_de_correcao', funcao: 'correcao_de_objetiva', artefatoId: null, atividadeAplicadaId: '0190f5a0-0000-7000-8000-0000000000b1' }),
  ]

  it('o filtro deixa passar tudo, só o que espera a professora, ou só uma função', () => {
    const finais = (filtro: Parameters<typeof entregasDoFiltro>[1]) => entregasDoFiltro(lista, filtro).map((item) => item.id.slice(-2))
    expect(finais('tudo')).toEqual(['01', '02', '03'])
    expect(finais('esperando')).toEqual(['01', '03'])
    expect(finais('adaptacao')).toEqual(['01', '02'])
    expect(finais('correcao_de_objetiva')).toEqual(['03'])
  })

  it('o Assistente diz o que fez e o que falta para valer, sem falar de aluno', () => {
    expect(falaDaEntrega(entrega('01'), '2ºB')).toBe('Preparei "Atividade de estequiometria (versão adaptada)" da turma 2ºB. Esta versão adaptada só pode ir aos alunos depois que você aprovar.')
    expect(falaDaEntrega(entrega('03', { tipo: 'lote_de_correcao', titulo: 'Atividade de estequiometria' }), undefined)).toBe('Corrigi "Atividade de estequiometria". O diagnóstico só chega aos alunos depois que você revisar os destaques e aprovar.')
  })

  it('só a versão adaptada pendente se decide por aqui: o lote de correção tem a tela dele, e a decidida não se decide de novo', () => {
    expect(decideAqui(entrega('01'))).toBe(true)
    expect(decideAqui(entrega('02', { estado: 'aprovada' }))).toBe(false)
    expect(decideAqui(entrega('02', { estado: 'rejeitada' }))).toBe(false)
    expect(decideAqui(entrega('03', { tipo: 'lote_de_correcao' }))).toBe(false)
  })

  it('D60: a entrega pendente de função suspensa diz que a função está suspensa e que a decisão continua dela; a decidida e a de função ativa não dizem nada', () => {
    expect(avisoDaFuncaoSuspensa(entrega('01'), true)).toBe('A coordenação suspendeu a função "Adaptação" nesta escola: o Assistente não prepara outra enquanto isso. Esta entrega continua esperando a sua decisão.')
    expect(avisoDaFuncaoSuspensa(entrega('01'), false)).toBeUndefined()
    expect(avisoDaFuncaoSuspensa(entrega('02', { estado: 'aprovada' }), true)).toBeUndefined()
    expect(avisoDaFuncaoSuspensa(entrega('02', { estado: 'rejeitada' }), true)).toBeUndefined()
  })

  it('a versão adaptada só sai limpa em PDF depois de aprovada: a pendente sai como rascunho, e a rejeitada não sai', () => {
    expect(saidaEmPdf(null)).toBe('limpa')
    expect(saidaEmPdf({ estado: 'aprovada' })).toBe('limpa')
    expect(saidaEmPdf({ estado: 'pendente' })).toBe('rascunho')
    expect(saidaEmPdf({ estado: 'rejeitada' })).toBe('nao_exporta')
  })

  it('a versão adaptada já decidida não muda de nome; a pendente e o artefato sem entrega mudam', () => {
    expect(podeRenomear(null)).toBe(true)
    expect(podeRenomear({ estado: 'pendente' })).toBe(true)
    expect(podeRenomear({ estado: 'aprovada' })).toBe(false)
    expect(podeRenomear({ estado: 'rejeitada' })).toBe(false)
  })

  it('o diálogo de aprovar diz o que é, de qual turma, e que foi a IA que fez', () => {
    expect(resumoDaAprovacao(entrega('01'), '2ºB')).toEqual([
      { rotulo: 'Versão adaptada', valor: 'Atividade de estequiometria (versão adaptada)' },
      { rotulo: 'Turma', valor: '2ºB' },
      { rotulo: 'Feita por', valor: 'Assistente de ensino, com IA' },
    ])
  })

  it('rejeitar exige justificativa de 8 a 500 caracteres, os limites do contrato, contados sem as pontas', () => {
    const problema = (justificativa: string) => problemaDoTexto(justificativa, LIMITES_DA_JUSTIFICATIVA)
    expect(LIMITES_DA_JUSTIFICATIVA).toEqual({ minimo: 8, maximo: 500 })
    expect(decidirEntregaRequestSchema.safeParse({ decisao: 'rejeitar', justificativa: '1234567' }).success).toBe(false)
    expect(problema('')).toBe('Escreva pelo menos 8 caracteres.')
    expect(problema('   curta   ')).toBe('Escreva pelo menos 8 caracteres: faltam 3.')
    expect(problema('12345678')).toBeUndefined()
    expect(problema('a'.repeat(500))).toBeUndefined()
    expect(problema('a'.repeat(501))).toBe('Use até 500 caracteres.')
  })

  it('a adaptação é dita pelos tipos, com o tempo extra junto do tipo dele', () => {
    expect(textoDaAdaptacao({ tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50 })).toBe('Fonte ampliada + Tempo adicional (50% a mais)')
    expect(textoDaAdaptacao({ tipos: ['linguagem_direta'] })).toBe('Linguagem direta')
  })
})
