import { describe, expect, it } from 'vitest'
import {
  alterarLicencaRequestSchema,
  DIAS_DO_AVISO_DE_VENCIMENTO,
  licencaSchema,
  registrarLicencaRequestSchema,
  SITUACOES_DA_LICENCA,
  situacaoDaLicenca,
  TAMANHO_MAXIMO_DA_COBERTURA,
  TAMANHO_MAXIMO_DA_REFERENCIA,
  vigenciaInvalida,
} from './licenca.js'
import { TAMANHO_MAXIMO_DO_LICENCIANTE } from './material.js'

const HOJE = '2026-11-12'

describe('situacaoDaLicenca: onde a licença está no dia de São Paulo', () => {
  it('o aviso é de 30 dias', () => {
    expect(DIAS_DO_AVISO_DE_VENCIMENTO).toBe(30)
  })

  it('`futura`: começa amanhã, e a que começa hoje já vale; a futura sem fim continua futura, e não `vigente`', () => {
    expect(situacaoDaLicenca(HOJE, '2026-11-13', null)).toBe('futura')
    expect(situacaoDaLicenca(HOJE, '2026-11-13', '2027-11-13')).toBe('futura')
    expect(situacaoDaLicenca(HOJE, HOJE, null)).toBe('vigente')
  })

  it('`vigente`: sem fim nunca vence, por mais antiga que seja', () => {
    expect(situacaoDaLicenca(HOJE, '2001-01-01', null)).toBe('vigente')
  })

  it('`vencida`: o fim de ontem já passou, e o de hoje ainda vale (o material sai da busca no dia seguinte)', () => {
    expect(situacaoDaLicenca(HOJE, '2026-01-01', '2026-11-11')).toBe('vencida')
    expect(situacaoDaLicenca(HOJE, '2026-01-01', HOJE)).toBe('vence_em_30_dias')
  })

  it('`vence_em_30_dias`: do dia 0 ao dia 30 antes do fim; no dia 31 ainda é `vigente`', () => {
    expect(situacaoDaLicenca(HOJE, '2026-01-01', '2026-12-12')).toBe('vence_em_30_dias')
    expect(situacaoDaLicenca(HOJE, '2026-01-01', '2026-12-13')).toBe('vigente')
    expect(situacaoDaLicenca(HOJE, '2026-01-01', '2026-11-20')).toBe('vence_em_30_dias')
  })

  it('o aviso atravessa a virada do ano e do mês pelo calendário, sem fuso', () => {
    expect(situacaoDaLicenca('2026-12-20', '2026-01-01', '2027-01-19')).toBe('vence_em_30_dias')
    expect(situacaoDaLicenca('2026-12-20', '2026-01-01', '2027-01-20')).toBe('vigente')
    expect(situacaoDaLicenca('2028-02-10', '2026-01-01', '2028-03-11')).toBe('vence_em_30_dias')
    expect(situacaoDaLicenca('2028-02-10', '2026-01-01', '2028-03-12')).toBe('vigente')
  })

  it('só devolve as quatro situações do contrato', () => {
    const todas = [
      situacaoDaLicenca(HOJE, '2026-11-13', null),
      situacaoDaLicenca(HOJE, '2026-01-01', null),
      situacaoDaLicenca(HOJE, '2026-01-01', '2026-11-11'),
      situacaoDaLicenca(HOJE, '2026-01-01', HOJE),
    ]
    expect([...todas].sort()).toEqual([...SITUACOES_DA_LICENCA].sort())
  })
})

describe('vigenciaInvalida: o fim não vem antes do começo', () => {
  it('antes é inválido; no mesmo dia, depois, sem fim e fim ausente são válidos', () => {
    expect(vigenciaInvalida('2026-11-12', '2026-11-11')).toBe(true)
    expect(vigenciaInvalida('2026-11-12', '2026-11-12')).toBe(false)
    expect(vigenciaInvalida('2026-11-12', '2026-11-13')).toBe(false)
    expect(vigenciaInvalida('2026-11-12', null)).toBe(false)
    expect(vigenciaInvalida('2026-11-12', undefined)).toBe(false)
  })
})

describe('registrarLicencaRequestSchema', () => {
  const valido = { licenciante: 'Editora Exemplo', cobertura: 'Coleção de Matemática, 6º ao 9º ano', referencia: 'Contrato 123/2026', vigenteDesde: '2026-02-01', vigenteAte: '2026-12-31' }

  it('aceita a licença com e sem fim, e tira os espaços das pontas dos textos', () => {
    expect(registrarLicencaRequestSchema.safeParse(valido).success).toBe(true)
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, vigenteAte: null }).success).toBe(true)
    const { vigenteAte: _semFim, ...semFim } = valido
    expect(registrarLicencaRequestSchema.safeParse(semFim).success).toBe(true)
    expect(registrarLicencaRequestSchema.parse({ ...valido, licenciante: '  Editora  ' }).licenciante).toBe('Editora')
  })

  it('o fim antes do começo é recusado, no campo do fim; no mesmo dia é aceito', () => {
    const recusada = registrarLicencaRequestSchema.safeParse({ ...valido, vigenteAte: '2026-01-31' })
    expect(recusada.success).toBe(false)
    expect(recusada.error?.issues[0]?.path).toEqual(['vigenteAte'])
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, vigenteAte: valido.vigenteDesde }).success).toBe(true)
  })

  it.each([
    ['licenciante', TAMANHO_MAXIMO_DO_LICENCIANTE],
    ['cobertura', TAMANHO_MAXIMO_DA_COBERTURA],
    ['referencia', TAMANHO_MAXIMO_DA_REFERENCIA],
  ] as const)('%s: de 1 ao teto de caracteres; vazio, só espaço e acima do teto são recusados', (campo, teto) => {
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, [campo]: 'a'.repeat(teto) }).success).toBe(true)
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, [campo]: 'a'.repeat(teto + 1) }).success).toBe(false)
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, [campo]: '' }).success).toBe(false)
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, [campo]: '   ' }).success).toBe(false)
  })

  it('data que não existe e campo de fora (a escola, o autor) são recusados', () => {
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, vigenteDesde: '2026-02-30' }).success).toBe(false)
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, vigenteDesde: '01/02/2026' }).success).toBe(false)
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, escolaId: '11111111-1111-4111-8111-111111111111' }).success).toBe(false)
    expect(registrarLicencaRequestSchema.safeParse({ ...valido, registradaPor: '11111111-1111-4111-8111-111111111111' }).success).toBe(false)
  })
})

describe('alterarLicencaRequestSchema', () => {
  it('aceita um campo só, e o fim nulo, que tira o fim', () => {
    expect(alterarLicencaRequestSchema.safeParse({ cobertura: 'Só o 6º ano' }).success).toBe(true)
    expect(alterarLicencaRequestSchema.safeParse({ vigenteAte: null }).success).toBe(true)
    expect(alterarLicencaRequestSchema.safeParse({ vigenteAte: '2027-12-31' }).success).toBe(true)
  })

  it('o corpo vazio, o licenciante (que não muda) e campo de fora são recusados', () => {
    expect(alterarLicencaRequestSchema.safeParse({}).success).toBe(false)
    expect(alterarLicencaRequestSchema.safeParse({ licenciante: 'Outra editora' }).success).toBe(false)
    expect(alterarLicencaRequestSchema.safeParse({ escolaId: '11111111-1111-4111-8111-111111111111' }).success).toBe(false)
  })

  it('começo e fim juntos: o fim antes do começo é recusado; o começo sozinho é conferido pelo serviço, com a linha travada', () => {
    expect(alterarLicencaRequestSchema.safeParse({ vigenteDesde: '2026-05-01', vigenteAte: '2026-04-30' }).success).toBe(false)
    expect(alterarLicencaRequestSchema.safeParse({ vigenteDesde: '2026-05-01', vigenteAte: '2026-05-01' }).success).toBe(true)
    expect(alterarLicencaRequestSchema.safeParse({ vigenteDesde: '2026-05-01', vigenteAte: null }).success).toBe(true)
    expect(alterarLicencaRequestSchema.safeParse({ vigenteDesde: '2026-05-01' }).success).toBe(true)
  })
})

describe('licencaSchema: o DTO de saída', () => {
  const licenca = {
    id: '11111111-1111-4111-8111-111111111111',
    licenciante: 'Editora',
    cobertura: 'Coleção',
    referencia: 'Contrato',
    vigenteDesde: '2026-02-01',
    vigenteAte: null,
    situacao: 'vigente',
    materiais: 0,
    registradaEm: '2026-02-01T10:00:00.000Z',
    alteradaEm: '2026-02-01T10:00:00.000Z',
  }

  it('aceita a licença do contrato e recusa quem a registrou, a escola e qualquer campo a mais', () => {
    expect(licencaSchema.safeParse(licenca).success).toBe(true)
    expect(licencaSchema.safeParse({ ...licenca, registradaPor: '22222222-2222-4222-8222-222222222222' }).success).toBe(false)
    expect(licencaSchema.safeParse({ ...licenca, escolaId: '22222222-2222-4222-8222-222222222222' }).success).toBe(false)
    expect(licencaSchema.safeParse({ ...licenca, situacao: 'quase_vencida' }).success).toBe(false)
  })
})
