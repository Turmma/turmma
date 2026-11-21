import { describe, expect, it } from 'vitest'
import { chaveDoPreco, consumoEstimadoDaInterrompida, custoDaChamada, DURACAO_MAXIMA_DA_LINHA_MS, PRECO_DOS_MODELOS, precoDoModelo, type DestinoDoAdaptador, type TabelaDePrecos } from './consumo.js'
import { MODELO_FALSO, MODELO_FALSO_MENOR } from './fake-adapter.js'
import { proporFerramenta } from './tasks/propor-ferramenta.js'

const EXECUCAO = '1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6'
const DESTINO: DestinoDoAdaptador = { origem: 'falso', envio: { envioExterno: false, provedorId: null }, modeloDoPerfil: () => 'adaptador-falso' }
const duracaoDa = (duracaoMs: number): number => consumoEstimadoDaInterrompida({ tarefa: proporFerramenta, destino: DESTINO, execucaoId: EXECUCAO, duracaoMs, em: new Date('2026-11-16T10:00:00Z') }).duracaoMs

describe('consumoEstimadoDaInterrompida: a duração da linha', () => {
  it('cabe no `integer` de `consumo_ia.duracao_ms`: a execução esquecida há 40 dias leva o teto, e não um número que o `insert` recusa', () => {
    expect(DURACAO_MAXIMA_DA_LINHA_MS).toBe(2_147_483_647)
    expect(duracaoDa(40 * 24 * 3600 * 1000)).toBe(DURACAO_MAXIMA_DA_LINHA_MS)
    expect(duracaoDa(DURACAO_MAXIMA_DA_LINHA_MS + 1)).toBe(DURACAO_MAXIMA_DA_LINHA_MS)
  })

  it('abaixo do teto a duração é a medida, arredondada, e nunca negativa', () => {
    expect(duracaoDa(301_000.4)).toBe(301_000)
    expect(duracaoDa(DURACAO_MAXIMA_DA_LINHA_MS)).toBe(DURACAO_MAXIMA_DA_LINHA_MS)
    expect(duracaoDa(-5)).toBe(0)
  })
})

const AGORA = new Date('2026-11-20T12:00:00Z')
const ZERO = { entradaMicrosPorMilTokens: 0, saidaMicrosPorMilTokens: 0 }

describe('precoDoModelo: o que a subida conhece (49.0, D14)', () => {
  it('os dois do adaptador falso custam zero; modelo que não está na tabela não tem preço', () => {
    expect(precoDoModelo(chaveDoPreco('falso', MODELO_FALSO), AGORA)).toMatchObject(ZERO)
    expect(precoDoModelo(chaveDoPreco('falso', MODELO_FALSO_MENOR), AGORA)).toMatchObject(ZERO)
    expect(precoDoModelo(chaveDoPreco('falso', 'qwen-pequeno'), AGORA)).toBeUndefined()
    expect(Object.keys(PRECO_DOS_MODELOS).sort()).toEqual([chaveDoPreco('falso', MODELO_FALSO), chaveDoPreco('falso', MODELO_FALSO_MENOR)].sort())
  })

  it('o nome que existe em todo objeto (`constructor`, `toString`, `__proto__`) não é modelo com preço', () => {
    for (const nome of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(precoDoModelo(nome, AGORA), nome).toBeUndefined()
  })

  it('a constante: toda chave é `provedor:modelo`, cada vigência tem data e fonte, e a lista está em ordem de data sem repetir', () => {
    for (const [chave, vigencias] of Object.entries(PRECO_DOS_MODELOS)) {
      expect(chave, chave).toMatch(/^[a-z][a-z0-9_-]+:.+$/)
      expect(vigencias.length, chave).toBeGreaterThan(0)
      const datas = vigencias.map((vigencia) => Date.parse(vigencia.vigenteDesde))
      for (const vigencia of vigencias) {
        expect(Number.isNaN(Date.parse(vigencia.vigenteDesde)), `${chave} ${vigencia.vigenteDesde}`).toBe(false)
        expect(vigencia.fonte.trim().length, chave).toBeGreaterThan(0)
      }
      expect(datas, chave).toEqual([...new Set(datas)].sort((x, y) => x - y))
    }
  })
})

describe('precoDoModelo: o preço vigente no instante da chamada (RF6)', () => {
  const ANTIGO = { vigenteDesde: '2026-01-01T00:00:00Z', fonte: 'tabela de janeiro', entradaMicrosPorMilTokens: 1_300, saidaMicrosPorMilTokens: 5_200 }
  const NOVO = { vigenteDesde: '2026-11-01T03:00:00Z', fonte: 'tabela de novembro', entradaMicrosPorMilTokens: 2_000, saidaMicrosPorMilTokens: 8_000 }
  // Fora de ordem de propósito: quem escolhe é a data, e não a posição na lista.
  const TABELA: TabelaDePrecos = { [chaveDoPreco('maritaca', 'modelo-x')]: [NOVO, ANTIGO], [chaveDoPreco('outro', 'modelo-x')]: [{ ...ANTIGO, entradaMicrosPorMilTokens: 900, saidaMicrosPorMilTokens: 1_800 }] }
  const chave = chaveDoPreco('maritaca', 'modelo-x')

  it('cada chamada fica no preço da sua vigência: antes da troca o antigo, depois o novo', () => {
    expect(precoDoModelo(chave, new Date('2026-10-31T23:59:59Z'), TABELA)).toBe(ANTIGO)
    expect(precoDoModelo(chave, new Date('2026-11-20T12:00:00Z'), TABELA)).toBe(NOVO)
  })

  it('a lista em ordem de data: a mais recente que já começou vale, e não a primeira que começou', () => {
    const ordenada: TabelaDePrecos = { [chave]: [ANTIGO, NOVO] }
    expect(precoDoModelo(chave, new Date('2026-10-31T23:59:59Z'), ordenada)).toBe(ANTIGO)
    expect(precoDoModelo(chave, new Date('2026-11-20T12:00:00Z'), ordenada)).toBe(NOVO)
  })

  it('a vigência vale a partir do instante exato dela, e não do milissegundo anterior', () => {
    expect(precoDoModelo(chave, new Date('2026-11-01T03:00:00Z'), TABELA)).toBe(NOVO)
    expect(precoDoModelo(chave, new Date('2026-11-01T02:59:59.999Z'), TABELA)).toBe(ANTIGO)
  })

  it('antes da primeira vigência não há preço', () => {
    expect(precoDoModelo(chave, new Date('2025-12-31T23:59:59Z'), TABELA)).toBeUndefined()
  })

  it('o mesmo modelo em dois provedores tem dois preços: a chave leva o provedor', () => {
    expect(precoDoModelo(chaveDoPreco('maritaca', 'modelo-x'), AGORA, TABELA)).toMatchObject({ entradaMicrosPorMilTokens: 2_000 })
    expect(precoDoModelo(chaveDoPreco('outro', 'modelo-x'), AGORA, TABELA)).toMatchObject({ entradaMicrosPorMilTokens: 900 })
    expect(precoDoModelo('modelo-x', AGORA, TABELA)).toBeUndefined()
  })
})

describe('custoDaChamada: a conta em micros, para cima (D14)', () => {
  const PRECO = { entradaMicrosPorMilTokens: 1_300, saidaMicrosPorMilTokens: 5_200 }

  it('3.000 de entrada e 250 de saída a 1.300 e 5.200 micros por mil tokens: 5.200', () => {
    expect(custoDaChamada({ tokensDeEntrada: 3_000, tokensDeSaida: 250 }, PRECO)).toBe(5_200)
  })

  it('a entrada e a saída contam cada uma, no seu preço', () => {
    expect(custoDaChamada({ tokensDeEntrada: 1_000, tokensDeSaida: 0 }, PRECO)).toBe(1_300)
    expect(custoDaChamada({ tokensDeEntrada: 0, tokensDeSaida: 1_000 }, PRECO)).toBe(5_200)
  })

  it('a fração de micro arredonda para cima, nunca para baixo: 1.001 + 1 tokens e 1 token só', () => {
    // 1.001 × 1.300 + 1 × 5.200 = 1.306.500 ÷ 1.000 = 1.306,5 → 1.307
    expect(custoDaChamada({ tokensDeEntrada: 1_001, tokensDeSaida: 1 }, PRECO)).toBe(1_307)
    // 1 × 1.300 ÷ 1.000 = 1,3 → 2
    expect(custoDaChamada({ tokensDeEntrada: 1, tokensDeSaida: 0 }, PRECO)).toBe(2)
    // 0,4 de micro também sobe: nunca some uma chamada com custo.
    expect(custoDaChamada({ tokensDeEntrada: 1, tokensDeSaida: 0 }, { entradaMicrosPorMilTokens: 400, saidaMicrosPorMilTokens: 0 })).toBe(1)
  })

  it('a conta exata não ganha micro a mais, e sem tokens o custo é zero', () => {
    expect(custoDaChamada({ tokensDeEntrada: 5, tokensDeSaida: 0 }, { entradaMicrosPorMilTokens: 200, saidaMicrosPorMilTokens: 0 })).toBe(1)
    expect(custoDaChamada({ tokensDeEntrada: 0, tokensDeSaida: 0 }, PRECO)).toBe(0)
  })

  it('sem preço (o adaptador falso, o modelo local) o custo é zero', () => {
    expect(custoDaChamada({ tokensDeEntrada: 3_000, tokensDeSaida: 250 }, undefined)).toBe(0)
  })
})
