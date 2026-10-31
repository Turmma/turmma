import { describe, expect, it } from 'vitest'
import { formatarBytes, formatarDia, formatarMedidaDoUso, formatarMesDeReferencia, formatarNumero, MEDIDAS_DO_USO, ROTULO_DO_USO } from './format'

/** W5: os formatos da tela Uso, com os textos exatos do cenário, escritos aqui por extenso. */
describe('W5: os formatos do uso por escola', () => {
  it('número pelo Intl pt-BR: zero, e o ponto de milhar', () => {
    expect(formatarNumero(0)).toBe('0')
    expect(formatarNumero(999)).toBe('999')
    expect(formatarNumero(1234)).toBe('1.234')
    expect(formatarNumero(1_234_567)).toBe('1.234.567')
  })

  it('bytes: zero e um em bytes, 1 023 ainda em bytes, e 1 024 vira 1 KB', () => {
    expect(formatarBytes(0)).toBe('0 bytes')
    expect(formatarBytes(1)).toBe('1 byte')
    expect(formatarBytes(1023)).toBe('1.023 bytes')
    expect(formatarBytes(1024)).toBe('1 KB')
    expect(formatarBytes(1536)).toBe('1,5 KB')
  })

  it('bytes: uma casa decimal com vírgula, e cada unidade na base 1024', () => {
    expect(formatarBytes(1_288_490_189)).toBe('1,2 GB')
    expect(formatarBytes(1024 ** 2)).toBe('1 MB')
    expect(formatarBytes(1024 ** 3)).toBe('1 GB')
    expect(formatarBytes(1024 ** 4 * 3.5)).toBe('3,5 TB')
    // 1.000.000 bytes não é 1 MB: a base é 1024, e não 1000.
    expect(formatarBytes(1_000_000)).toBe('976,6 KB')
  })

  it('bytes: na virada de unidade, o arredondamento que daria 1.024 sobe para a seguinte', () => {
    // 1.048.575 bytes são 1.023,999 KB: arredondados, dariam "1.024 KB".
    expect(formatarBytes(1024 ** 2 - 1)).toBe('1 MB')
    expect(formatarBytes(1024 ** 3 - 1)).toBe('1 GB')
    // Logo abaixo da virada, fica na unidade de baixo.
    expect(formatarBytes(1024 * 1023)).toBe('1.023 KB')
    // A última unidade não sobe: fica em PB, com o milhar.
    expect(formatarBytes(1024 ** 5 * 2000)).toBe('2.000 PB')
  })

  it('o dia de referência da API como se lê, sem fuso que o leve para o dia anterior', () => {
    expect(formatarDia('2026-09-23')).toBe('23/09/2026')
    expect(formatarDia('2027-01-01')).toBe('01/01/2027')
    expect(formatarDia('2026-12-31')).toBe('31/12/2026')
  })

  it('o mês de referência, até o último dia fechado, também na virada do ano', () => {
    expect(formatarMesDeReferencia({ mes: '2026-09', dia: '2026-09-23' })).toBe('setembro de 2026, até 23/09')
    // Em 1º de janeiro, a referência é o 31 de dezembro do ano anterior.
    expect(formatarMesDeReferencia({ mes: '2026-12', dia: '2026-12-31' })).toBe('dezembro de 2026, até 31/12')
    expect(formatarMesDeReferencia({ mes: '2027-01', dia: '2027-01-01' })).toBe('janeiro de 2027, até 01/01')
    // No dia 1, o mês é o anterior inteiro: fevereiro, até o 28.
    expect(formatarMesDeReferencia({ mes: '2027-02', dia: '2027-02-28' })).toBe('fevereiro de 2027, até 28/02')
  })

  it('uma referência fora do formato (o contrato a recusa antes) volta como veio, sem quebrar a tela', () => {
    expect(formatarDia('23/09/2026')).toBe('23/09/2026')
    expect(formatarMesDeReferencia({ mes: 'setembro', dia: '2026-09-23' })).toBe('setembro, até 23/09')
    // Com hífen, mas sem número de mês: o `Intl` lançaria `RangeError` com a data inválida.
    expect(formatarMesDeReferencia({ mes: '2026-xx', dia: '2026-09-23' })).toBe('2026-xx, até 23/09')
    expect(formatarMesDeReferencia({ mes: 'setembro-2026', dia: '2026-09-23' })).toBe('setembro-2026, até 23/09')
    expect(formatarMesDeReferencia({ mes: '2026-13', dia: '2026-09-23' })).toBe('2026-13, até 23/09')
  })

  it('os rótulos das três medidas, na ordem da tela, e o valor de cada uma no seu formato', () => {
    expect(MEDIDAS_DO_USO.map((medida) => ROTULO_DO_USO[medida])).toEqual(['requisições', 'tarefas em segundo plano', 'armazenamento'])
    expect(formatarMedidaDoUso('requisicoes', 1024)).toBe('1.024')
    expect(formatarMedidaDoUso('jobs', 1024)).toBe('1.024')
    expect(formatarMedidaDoUso('bytesStorage', 1024)).toBe('1 KB')
    expect(formatarMedidaDoUso('bytesStorage', 0)).toBe('0 bytes')
  })
})
