import { situacaoDaLicenca, type Licenca, type SituacaoDaLicenca } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import {
  CAMPOS_DA_LICENCA,
  dataDaLicenca,
  diaDeHojeEmSaoPaulo,
  diaEMesDaLicenca,
  efeitoDaVigencia,
  errosDaVigencia,
  errosDoRascunhoDaLicenca,
  FAMILIA_DA_SITUACAO_DA_LICENCA,
  pedidoDeRegistro,
  pedidoDeVigencia,
  RASCUNHO_DA_LICENCA_VAZIO,
  REFERENCIA_DA_MIGRACAO,
  registradaAntesDaF4,
  textoDaBuscaDaLicenca,
  textoDaSituacaoDaLicenca,
  textoDoEfeitoDaVigencia,
  textoDosMateriais,
  vigenciaDoRascunho,
} from './licencas'

/**
 * O que a aba Licenças decide sem React (ingestao-do-material, 6.0; RF16 e RF17): as datas por extenso, a situação em texto e em cor, o dia de
 * São Paulo, o que a vigência nova faz com a busca e o rascunho dos dois formulários. Puro: nenhum caso precisa de tela nem de rede.
 */

const HOJE = '2026-11-14'

const licenca = (parte: Partial<Licenca> = {}): Licenca => ({
  id: '0197a1c0-0000-7000-8000-000000000801',
  licenciante: 'Editora Sintética',
  cobertura: 'Coleção de Química',
  referencia: 'Contrato 123',
  vigenteDesde: '2026-01-01',
  vigenteAte: '2027-12-31',
  situacao: 'vigente',
  materiais: 3,
  registradaEm: '2026-01-01T12:00:00.000Z',
  alteradaEm: '2026-01-01T12:00:00.000Z',
  ...parte,
})

describe('as datas da licença', () => {
  it('dd/mm/aaaa pelo texto, sem passar pelo fuso: o dia 1 não volta para o dia anterior', () => {
    expect(dataDaLicenca('2026-03-01')).toBe('01/03/2026')
    expect(dataDaLicenca('2027-12-31')).toBe('31/12/2027')
  })

  it('dd/mm, para o aviso do sino', () => {
    expect(diaEMesDaLicenca('2026-12-14')).toBe('14/12')
  })

  it('o dia de hoje é o de São Paulo: às 23h30 do último dia ainda é ele; às 0h01 do seguinte, não', () => {
    expect(diaDeHojeEmSaoPaulo(new Date('2026-11-15T02:30:00Z'))).toBe('2026-11-14')
    expect(diaDeHojeEmSaoPaulo(new Date('2026-11-15T03:01:00Z'))).toBe('2026-11-15')
  })
})

describe('a situação da licença, em texto e em cor', () => {
  const casos: ReadonlyArray<readonly [SituacaoDaLicenca, Partial<Licenca>, string, 'ok' | 'pendente' | 'erro' | 'info']> = [
    ['vigente', { vigenteAte: null }, 'Vigente', 'ok'],
    ['vence_em_30_dias', { vigenteAte: '2026-12-14' }, 'Vence em 14/12/2026', 'pendente'],
    ['vencida', { vigenteAte: '2026-11-13' }, 'Vencida em 13/11/2026', 'erro'],
    ['futura', { vigenteDesde: '2026-12-01' }, 'Começa em 01/12/2026', 'info'],
  ]
  it.each(casos)('%s: o texto e a família que a tela mostra', (situacao, parte, texto, familia) => {
    expect(textoDaSituacaoDaLicenca(licenca({ situacao, ...parte }))).toBe(texto)
    expect(FAMILIA_DA_SITUACAO_DA_LICENCA[situacao]).toBe(familia)
  })

  it('cada situação tem uma família diferente: a cor distingue, e o texto diz', () => {
    expect(new Set(Object.values(FAMILIA_DA_SITUACAO_DA_LICENCA)).size).toBe(4)
  })

  it('a que a API dá para o dia de hoje é a de `packages/shared`: 30 dias do fim vence, 31 ainda é vigente', () => {
    expect(situacaoDaLicenca(HOJE, '2026-01-01', '2026-12-14')).toBe('vence_em_30_dias')
    expect(situacaoDaLicenca(HOJE, '2026-01-01', '2026-12-15')).toBe('vigente')
  })

  it('quantos materiais, por extenso, no singular e no plural', () => {
    expect([0, 1, 12].map(textoDosMateriais)).toEqual(['Nenhum material', '1 material', '12 materiais'])
  })

  it('o que a situação faz com a busca: a vencida diz que os materiais saíram, a futura que entram no dia do começo', () => {
    expect(textoDaBuscaDaLicenca({ situacao: 'vigente', materiais: 3 })).toBe('Os materiais dela estão na busca.')
    expect(textoDaBuscaDaLicenca({ situacao: 'vencida', materiais: 3 })).toMatch(/saíram da busca/)
    expect(textoDaBuscaDaLicenca({ situacao: 'futura', materiais: 3 })).toMatch(/entram na busca no dia em que ela começa/)
    expect(textoDaBuscaDaLicenca({ situacao: 'vencida', materiais: 0 })).toBe('Nenhum material depende desta licença.')
  })
})

describe('as licenças de antes da F4 (R6)', () => {
  it('só a referência que a migração escreveu a destaca', () => {
    expect(registradaAntesDaF4({ referencia: REFERENCIA_DA_MIGRACAO })).toBe(true)
    expect(registradaAntesDaF4({ referencia: 'Contrato 123' })).toBe(false)
    expect(registradaAntesDaF4({ referencia: 'registrada antes da F4 (revista)' })).toBe(false)
  })
})

describe('o que a vigência nova faz com a busca, antes de confirmar', () => {
  it('estava na busca e o fim passa para ontem: os materiais saem', () => {
    expect(efeitoDaVigencia(licenca({ situacao: 'vigente', materiais: 5 }), { vigenteDesde: '2026-01-01', vigenteAte: '2026-11-13' }, HOJE)).toEqual({ tipo: 'saem', materiais: 5 })
  })

  it('o fim de hoje ainda vale: o material sai só no dia seguinte, e nada muda agora', () => {
    expect(efeitoDaVigencia(licenca({ situacao: 'vigente', materiais: 5 }), { vigenteDesde: '2026-01-01', vigenteAte: HOJE }, HOJE).tipo).toBe('nenhum')
  })

  it('estava vencida e o fim vai para frente: os materiais voltam, sem reenviar', () => {
    expect(efeitoDaVigencia(licenca({ situacao: 'vencida', materiais: 2 }), { vigenteDesde: '2026-01-01', vigenteAte: null }, HOJE)).toEqual({ tipo: 'voltam', materiais: 2 })
  })

  it('estava vencida e o começo vai para trás de hoje (era futura): os materiais voltam', () => {
    expect(efeitoDaVigencia(licenca({ situacao: 'futura', materiais: 2 }), { vigenteDesde: '2026-11-01', vigenteAte: null }, HOJE).tipo).toBe('voltam')
  })

  it('vencida que continua vencida, e vigente que continua vigente: nenhum material muda de lugar', () => {
    expect(efeitoDaVigencia(licenca({ situacao: 'vencida', materiais: 2 }), { vigenteDesde: '2026-01-01', vigenteAte: '2026-11-01' }, HOJE).tipo).toBe('nenhum')
    expect(efeitoDaVigencia(licenca({ situacao: 'vigente', materiais: 2 }), { vigenteDesde: '2026-01-01', vigenteAte: null }, HOJE).tipo).toBe('nenhum')
  })

  it('o texto diz quantos, no singular e no plural, e o que acontece com o que já foi gerado', () => {
    expect(textoDoEfeitoDaVigencia({ tipo: 'saem', materiais: 5 })).toBe('5 materiais saem da busca do Assistente e do Tutor. O que já foi gerado continua citando a página.')
    expect(textoDoEfeitoDaVigencia({ tipo: 'saem', materiais: 1 })).toMatch(/^1 material sai da busca/)
    expect(textoDoEfeitoDaVigencia({ tipo: 'voltam', materiais: 2 })).toBe('2 materiais voltam à busca do Assistente e do Tutor, sem reenviar.')
    expect(textoDoEfeitoDaVigencia({ tipo: 'voltam', materiais: 1 })).toMatch(/^1 material volta à busca/)
    expect(textoDoEfeitoDaVigencia({ tipo: 'nenhum', materiais: 4 })).toMatch(/^4 materiais continuam onde estão na busca/)
    expect(textoDoEfeitoDaVigencia({ tipo: 'nenhum', materiais: 1 })).toMatch(/^1 material continua onde está na busca/)
  })

  it('sem material, a frase não promete saída nem volta: a vigência só vale para os que vierem', () => {
    expect(textoDoEfeitoDaVigencia({ tipo: 'saem', materiais: 0 })).toBe('Nenhum material usa esta licença ainda: a vigência só vale para os que vierem depois.')
  })
})

describe('os formulários', () => {
  const COMPLETO = { licenciante: 'Editora Sintética', cobertura: 'Coleção de Química', referencia: 'Contrato 123', vigenteDesde: '2026-03-01', vigenteAte: '2026-12-31' }

  it('vazio, falta cada campo, com a frase que diz o que fazer', () => {
    const erros = errosDoRascunhoDaLicenca(RASCUNHO_DA_LICENCA_VAZIO)
    expect(Object.keys(erros).sort()).toEqual(['cobertura', 'licenciante', 'referencia', 'vigenteDesde'])
    expect(erros.referencia).toMatch(/Não anexe o contrato/)
  })

  it('só espaços não é preenchido', () => {
    expect(Object.keys(errosDoRascunhoDaLicenca({ ...COMPLETO, licenciante: '   ', cobertura: ' ', referencia: '\t' })).sort()).toEqual(['cobertura', 'licenciante', 'referencia'])
  })

  it('o fim antes do começo é erro do campo do fim; o fim vazio (sem fim) não é', () => {
    expect(errosDoRascunhoDaLicenca({ ...COMPLETO, vigenteAte: '2026-02-28' })).toEqual({ vigenteAte: 'O fim da vigência não pode vir antes do começo.' })
    expect(errosDoRascunhoDaLicenca({ ...COMPLETO, vigenteAte: '' })).toEqual({})
    expect(errosDoRascunhoDaLicenca({ ...COMPLETO, vigenteAte: '2026-03-01' })).toEqual({})
  })

  it('o fim no mesmo dia do começo vale: o check do banco é `>=`', () => {
    expect(errosDaVigencia({ vigenteDesde: '2026-03-01', vigenteAte: '2026-03-01' })).toEqual({})
  })

  it('o pedido de registro segue o contrato: o fim vazio vai como nulo, e os textos vão aparados', () => {
    expect(pedidoDeRegistro({ ...COMPLETO, licenciante: '  Editora Sintética  ', vigenteAte: '' })).toEqual({ ...COMPLETO, licenciante: 'Editora Sintética', vigenteAte: null })
    expect(pedidoDeRegistro(RASCUNHO_DA_LICENCA_VAZIO)).toBeUndefined()
  })

  it('o pedido da vigência: o fim vazio tira o fim (nulo), e sem começo não há pedido', () => {
    expect(pedidoDeVigencia({ vigenteDesde: '2026-03-01', vigenteAte: '' })).toEqual({ vigenteDesde: '2026-03-01', vigenteAte: null })
    expect(pedidoDeVigencia({ vigenteDesde: '', vigenteAte: '' })).toBeUndefined()
  })

  it('a vigência do rascunho só existe completa e em ordem: é o que a conta do efeito lê', () => {
    expect(vigenciaDoRascunho({ vigenteDesde: '2026-03-01', vigenteAte: '' })).toEqual({ vigenteDesde: '2026-03-01', vigenteAte: null })
    expect(vigenciaDoRascunho({ vigenteDesde: '', vigenteAte: '2026-03-01' })).toBeUndefined()
    expect(vigenciaDoRascunho({ vigenteDesde: '2026-03-02', vigenteAte: '2026-03-01' })).toBeUndefined()
  })

  it('a lista de campos é a que o formulário percorre para pôr o foco no primeiro com erro', () => {
    expect(CAMPOS_DA_LICENCA).toEqual(['licenciante', 'cobertura', 'referencia', 'vigenteDesde', 'vigenteAte'])
  })
})
