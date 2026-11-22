import { describe, expect, it } from 'vitest'
import { chaveDoPreco, consumoEstimadoDaInterrompida, custoDaChamada, destinosDaInterrompida, DURACAO_MAXIMA_DA_LINHA_MS, PRECO_DOS_MODELOS, precoDoModelo, type DestinoDoAdaptador, type TabelaDePrecos } from './consumo.js'
import { MODELO_FALSO, MODELO_FALSO_MENOR } from './fake-adapter.js'
import type { ModeloAprovado } from './modelos-aprovados.js'
import { proporFerramenta } from './tasks/propor-ferramenta.js'

const EXECUCAO = '1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6'
const DESTINO: DestinoDoAdaptador = { origem: 'falso', envio: { envioExterno: false, provedorId: null }, identidade: 'falso', modeloDoPerfil: () => 'adaptador-falso' }
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
  it('os do adaptador falso, do principal e da reserva, custam zero; modelo que não está na tabela não tem preço, nem o mesmo modelo com a identidade do outro falso', () => {
    expect(precoDoModelo(chaveDoPreco('falso', MODELO_FALSO), AGORA)).toMatchObject(ZERO)
    expect(precoDoModelo(chaveDoPreco('falso', MODELO_FALSO_MENOR), AGORA)).toMatchObject(ZERO)
    expect(precoDoModelo(chaveDoPreco('falso-reserva', MODELO_FALSO), AGORA)).toMatchObject(ZERO)
    // A reserva falsa não tem modelo menor: o degrau é do principal.
    expect(precoDoModelo(chaveDoPreco('falso-reserva', MODELO_FALSO_MENOR), AGORA)).toBeUndefined()
    expect(precoDoModelo(chaveDoPreco('falso', 'qwen-pequeno'), AGORA)).toBeUndefined()
    expect(Object.keys(PRECO_DOS_MODELOS).sort()).toEqual([chaveDoPreco('falso', MODELO_FALSO), chaveDoPreco('falso', MODELO_FALSO_MENOR), chaveDoPreco('falso-reserva', MODELO_FALSO)].sort())
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

/** O principal e a reserva de teste: provedores e modelos que não são os do falso, cada um com a sua identidade. */
const PRINCIPAL: DestinoDoAdaptador = { origem: 'openai_compat', envio: { envioExterno: true, provedorId: 'principal-x' }, identidade: 'principal-x', modeloDoPerfil: (perfil) => `principal-${perfil}` }
const RESERVA: DestinoDoAdaptador = { origem: 'openai_compat', envio: { envioExterno: true, provedorId: 'reserva-y' }, identidade: 'reserva-y', modeloDoPerfil: (perfil) => `reserva-${perfil}` }
const aprovacao = (tarefa: ModeloAprovado['tarefa'], provedorId: string, modelo: string): ModeloAprovado => ({ tarefa, provedorId, modelo, relatorio: 'docs/avaliacao/teste/relatorio.md', sha256: 'sha-do-teste', aprovadoPor: 'teste', aprovadoEm: '2026-11-22' })

describe('destinosDaInterrompida: o principal sempre, a reserva se a tarefa tem aprovação para o provedor dela (F5b, 8.0, D14)', () => {
  it('sem reserva configurada: só o principal, mesmo com aprovação na lista', () => {
    expect(destinosDaInterrompida('propor_ferramenta', { principal: PRINCIPAL, aprovados: [aprovacao('propor_ferramenta', 'reserva-y', 'reserva-rapido')] })).toEqual([PRINCIPAL])
  })

  it('tarefa aprovada para o provedor da reserva configurada: o principal e a reserva, nessa ordem', () => {
    const destinos = destinosDaInterrompida('propor_ferramenta', { principal: PRINCIPAL, reserva: RESERVA, aprovados: [aprovacao('propor_ferramenta', 'reserva-y', 'reserva-rapido')] })
    expect(destinos).toEqual([PRINCIPAL, RESERVA])
  })

  it('a aprovação é de outro modelo que o da reserva no perfil da tarefa: as duas mesmo assim (o destino se superestima, sem comparar o modelo)', () => {
    // `reserva-rapido` é o modelo da reserva no perfil `rapido`; a aprovação é de `modelo-antigo`.
    expect(destinosDaInterrompida('propor_ferramenta', { principal: PRINCIPAL, reserva: RESERVA, aprovados: [aprovacao('propor_ferramenta', 'reserva-y', 'modelo-antigo')] })).toEqual([PRINCIPAL, RESERVA])
  })

  it('aprovação para outro provedor, com o mesmo modelo da reserva: só o principal', () => {
    expect(destinosDaInterrompida('propor_ferramenta', { principal: PRINCIPAL, reserva: RESERVA, aprovados: [aprovacao('propor_ferramenta', 'outro-provedor', 'reserva-rapido')] })).toEqual([PRINCIPAL])
  })

  it('tarefa sem aprovação, ou só com a de outra tarefa, ainda que a reserva esteja configurada: só o principal', () => {
    expect(destinosDaInterrompida('propor_ferramenta', { principal: PRINCIPAL, reserva: RESERVA, aprovados: [] })).toEqual([PRINCIPAL])
    expect(destinosDaInterrompida('propor_ferramenta', { principal: PRINCIPAL, reserva: RESERVA, aprovados: [aprovacao('turno_do_tutor', 'reserva-y', 'reserva-rapido')] })).toEqual([PRINCIPAL])
  })

  it('sem a lista injetada vale `MODELOS_APROVADOS`: a reserva falsa é aprovada em toda tarefa, e o provedor de teste não é', () => {
    const falsa: DestinoDoAdaptador = { origem: 'falso', envio: { envioExterno: false, provedorId: null }, identidade: 'falso-reserva', modeloDoPerfil: () => MODELO_FALSO }
    expect(destinosDaInterrompida('propor_ferramenta', { principal: DESTINO, reserva: falsa })).toEqual([DESTINO, falsa])
    expect(destinosDaInterrompida('propor_ferramenta', { principal: DESTINO, reserva: RESERVA })).toEqual([DESTINO])
  })
})

describe('consumoEstimadoDaInterrompida: o custo dos dois tetos ao preço do modelo do destino (F5b, 8.0, D14)', () => {
  // `propor_ferramenta`: entrada no teto de 18.200 e saída no teto de 800.
  const VIGENCIA = { vigenteDesde: '2026-01-01T00:00:00Z', fonte: 'tabela do teste' }
  const PRECOS: TabelaDePrecos = {
    [chaveDoPreco('principal-x', 'principal-rapido')]: [{ ...VIGENCIA, entradaMicrosPorMilTokens: 1_300, saidaMicrosPorMilTokens: 5_200 }],
    [chaveDoPreco('reserva-y', 'reserva-rapido')]: [{ ...VIGENCIA, entradaMicrosPorMilTokens: 2_000, saidaMicrosPorMilTokens: 8_000 }],
  }
  const estimar = (destino: DestinoDoAdaptador, precos?: TabelaDePrecos) =>
    consumoEstimadoDaInterrompida({ tarefa: proporFerramenta, destino, execucaoId: EXECUCAO, duracaoMs: 301_000, em: new Date('2026-11-22T12:00:00Z'), ...(precos === undefined ? {} : { precos }) })

  it('cada destino leva os dois tetos ao preço do seu modelo, com preços diferentes: 27.820 no principal e 42.800 na reserva', () => {
    const principal = estimar(PRINCIPAL, PRECOS)
    const reserva = estimar(RESERVA, PRECOS)
    // 18.200 × 1.300 + 800 × 5.200 = 27.820.000 ÷ 1.000; 18.200 × 2.000 + 800 × 8.000 = 42.800.000 ÷ 1.000.
    expect(principal).toMatchObject({ tokensDeEntrada: 18_200, tokensDeSaida: 800, custoMicros: 27_820, modelo: 'principal-rapido', provedorId: 'principal-x' })
    expect(reserva).toMatchObject({ tokensDeEntrada: 18_200, tokensDeSaida: 800, custoMicros: 42_800, modelo: 'reserva-rapido', provedorId: 'reserva-y' })
  })

  it('o custo é de mais de zero em cada linha e a da reserva não leva o preço do principal', () => {
    expect(estimar(PRINCIPAL, PRECOS).custoMicros).toBeGreaterThan(0)
    expect(estimar(RESERVA, PRECOS).custoMicros).toBeGreaterThan(estimar(PRINCIPAL, PRECOS).custoMicros)
  })

  it('a estimada leva a coluna da Operação falsa nos dois destinos: o que se conta são as chamadas enviadas', () => {
    expect(estimar(PRINCIPAL, PRECOS).peloProvedorDeReserva).toBe(false)
    expect(estimar(RESERVA, PRECOS).peloProvedorDeReserva).toBe(false)
  })

  it('o modelo sem preço na tabela custa zero, como na chamada de verdade; sem tabela vale a do produto, onde o falso é zero', () => {
    expect(estimar({ ...RESERVA, identidade: 'reserva-sem-preco' }, PRECOS).custoMicros).toBe(0)
    expect(estimar(DESTINO).custoMicros).toBe(0)
  })

  it('o preço é o da vigência do instante da linha: a vigência futura não vale', () => {
    const futura: TabelaDePrecos = { [chaveDoPreco('principal-x', 'principal-rapido')]: [{ vigenteDesde: '2027-01-01T00:00:00Z', fonte: 'daqui a um ano', entradaMicrosPorMilTokens: 9_000, saidaMicrosPorMilTokens: 9_000 }] }
    expect(estimar(PRINCIPAL, futura).custoMicros).toBe(0)
  })
})
