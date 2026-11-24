import { describe, expect, it } from 'vitest'
import { duracaoDoAlunoEmMinutos, LIMIAR_DA_LACUNA_MS, limiteBaseDaTentativa, limiteDaTentativa, type EntradaDoLimite } from './limite-da-tentativa.js'

// Instantes fixos e sintéticos: a função é pura, e nenhum teste lê o relógio. A tentativa começa às 10:00 e a prova vai até as 10:40.
const ANA = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d'
const BIA = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e'
const ZERO = Date.parse('2026-12-01T10:00:00.000Z')
const minutos = (n: number): Date => new Date(ZERO + n * 60_000)
const segundos = (n: number): Date => new Date(ZERO + n * 1_000)

/** Uma tentativa de 40 min que começou às 10:00, sem extensão, sem queda e com o pulso em dia. */
function entrada(sobre: Partial<EntradaDoLimite> = {}): EntradaDoLimite {
  return { alunoId: ANA, iniciadaEm: minutos(0), limiteBase: minutos(40), extensoes: [], indisponibilidades: [], pulso: null, ...sobre }
}
const limite = (sobre?: Partial<EntradaDoLimite>): number | null => limiteDaTentativa(entrada(sobre))?.getTime() ?? null

describe('limiteDaTentativa: o limite sem queda', () => {
  it('sem duração nem janela (limite base nulo) não há limite, mesmo com extensão e queda', () => {
    expect(limite({ limiteBase: null, extensoes: [{ alunoId: null, minutos: 10 }], indisponibilidades: [{ inicio: minutos(5), fim: minutos(10) }] })).toBeNull()
  })

  it('sem extensão nem queda, o limite é o base', () => {
    expect(limite()).toBe(minutos(40).getTime())
  })

  it('a extensão do aluno e a da turma somam, e a de outro aluno não entra', () => {
    const extensoes = [
      { alunoId: ANA, minutos: 5 },
      { alunoId: null, minutos: 10 },
      { alunoId: BIA, minutos: 30 },
    ]
    expect(limite({ alunoId: ANA, extensoes })).toBe(minutos(55).getTime())
    // A Bia recebe a dela e a da turma, e não a da Ana.
    expect(limite({ alunoId: BIA, extensoes })).toBe(minutos(80).getTime())
  })
})

describe('limiteDaTentativa: a indisponibilidade fechada (RF6)', () => {
  it('uma de 5 min dentro da prova anda o limite 5 min; uma de 5 min depois do fim da prova, nada', () => {
    expect(limite({ indisponibilidades: [{ inicio: minutos(10), fim: minutos(15) }] })).toBe(minutos(45).getTime())
    expect(limite({ indisponibilidades: [{ inicio: minutos(50), fim: minutos(55) }] })).toBe(minutos(40).getTime())
  })

  it('uma de 5 min antes da tentativa começar não conta; a que atravessa o começo conta só o pedaço de dentro', () => {
    expect(limite({ indisponibilidades: [{ inicio: minutos(-10), fim: minutos(-5) }] })).toBe(minutos(40).getTime())
    expect(limite({ indisponibilidades: [{ inicio: minutos(-3), fim: minutos(2) }] })).toBe(minutos(42).getTime())
  })

  it('a que atravessa o fim conta o pedaço de dentro e, com o limite andado, o resto: a conta é de ponto fixo', () => {
    // Das 10:38 às 10:48: dentro dos 40 min, só 2; com os 2 a mais o limite vai a 10:42, e o pedaço de 10:40 a 10:42 também é prova: 4; e assim até 10:48.
    expect(limite({ indisponibilidades: [{ inicio: minutos(38), fim: minutos(48) }] })).toBe(minutos(50).getTime())
  })

  it('duas, a segunda dentro do limite já estendido pela primeira e fora do original: as duas contam, numa passada só', () => {
    // A primeira (10:30 a 10:40) leva o limite a 10:50. A segunda (10:42 a 10:47) está fora dos 40 min originais e dentro dos 50: conta.
    expect(
      limite({
        indisponibilidades: [
          { inicio: minutos(30), fim: minutos(40) },
          { inicio: minutos(42), fim: minutos(47) },
        ],
      }),
    ).toBe(minutos(55).getTime())
  })

  it('a ordem das indisponibilidades não muda o limite', () => {
    const primeira = { inicio: minutos(30), fim: minutos(40) }
    const segunda = { inicio: minutos(42), fim: minutos(47) }
    expect(limite({ indisponibilidades: [segunda, primeira] })).toBe(limite({ indisponibilidades: [primeira, segunda] }))
  })

  it('soma com a extensão: a queda dentro do limite estendido conta, e a extensão não é comida pela queda', () => {
    expect(limite({ extensoes: [{ alunoId: ANA, minutos: 10 }], indisponibilidades: [{ inicio: minutos(45), fim: minutos(48) }] })).toBe(minutos(53).getTime())
  })
})

describe('limiteDaTentativa: a lacuna aberta e o limiar de 30 s (§5.7)', () => {
  it('o limiar é de 30 s', () => {
    expect(LIMIAR_DA_LACUNA_MS).toBe(30_000)
  })

  it('pulso de 2 min atrás: o limite anda 2 min; de 20 s atrás, não anda', () => {
    expect(limite({ pulso: { ultimoEm: minutos(20), agora: minutos(22) } })).toBe(minutos(42).getTime())
    expect(limite({ pulso: { ultimoEm: minutos(20), agora: new Date(minutos(20).getTime() + 20_000) } })).toBe(minutos(40).getTime())
  })

  it('exatamente 30 s é atraso, não queda; 30 s e 1 ms já é', () => {
    expect(limite({ pulso: { ultimoEm: minutos(20), agora: new Date(minutos(20).getTime() + 30_000) } })).toBe(minutos(40).getTime())
    expect(limite({ pulso: { ultimoEm: minutos(20), agora: new Date(minutos(20).getTime() + 30_001) } })).toBe(minutos(40).getTime() + 30_001)
  })

  it('a lacuna aberta que começou depois do fim da prova não conta; a que começou dentro e continua conta até agora', () => {
    expect(limite({ pulso: { ultimoEm: minutos(50), agora: minutos(55) } })).toBe(minutos(40).getTime())
    expect(limite({ pulso: { ultimoEm: minutos(30), agora: minutos(70) } })).toBe(minutos(80).getTime())
  })

  it('a aberta soma com as fechadas, e a fechada sozinha não depende do pulso', () => {
    const fechada = { inicio: minutos(5), fim: minutos(8) }
    expect(limite({ indisponibilidades: [fechada], pulso: { ultimoEm: minutos(20), agora: minutos(22) } })).toBe(minutos(45).getTime())
    expect(limite({ indisponibilidades: [fechada] })).toBe(minutos(43).getTime())
  })

  it('o pulso de 40 min parado dá o mesmo que a indisponibilidade fechada de 40 min que o pulso gravaria ao voltar (sem teto em nenhuma)', () => {
    const aberta = limite({ pulso: { ultimoEm: minutos(10), agora: minutos(50) } })
    const fechada = limite({ indisponibilidades: [{ inicio: minutos(10), fim: minutos(50) }] })
    expect(aberta).toBe(fechada)
    expect(aberta).toBe(minutos(80).getTime())
  })

  it('trabalha em segundos: a lacuna aberta de 61 s anda o limite 61 s', () => {
    expect(limite({ pulso: { ultimoEm: segundos(600), agora: segundos(661) } })).toBe(minutos(40).getTime() + 61_000)
  })
})

describe('limiteBaseDaTentativa: o que vier antes, o começo mais a duração do aluno ou o fim da janela', () => {
  const FECHA = minutos(60)

  it('começando cedo, o limite é o começo mais a duração', () => {
    expect(limiteBaseDaTentativa({ agora: minutos(0), fechaEm: FECHA, duracaoMin: 40, percentual: null })?.getTime()).toBe(minutos(40).getTime())
  })

  it('começando a 10 min do fim com duração 40, o limite é o fim da janela', () => {
    expect(limiteBaseDaTentativa({ agora: minutos(50), fechaEm: FECHA, duracaoMin: 40, percentual: null })?.getTime()).toBe(FECHA.getTime())
  })

  it('o tempo adicional soma à duração do aluno: +50% sobre 40 é 60, e o fim da janela ainda corta', () => {
    expect(limiteBaseDaTentativa({ agora: minutos(0), fechaEm: minutos(120), duracaoMin: 40, percentual: 50 })?.getTime()).toBe(minutos(60).getTime())
    expect(limiteBaseDaTentativa({ agora: minutos(30), fechaEm: FECHA, duracaoMin: 40, percentual: 50 })?.getTime()).toBe(FECHA.getTime())
  })

  it('sem duração o limite é o fim da janela, e sem janela não há limite', () => {
    expect(limiteBaseDaTentativa({ agora: minutos(0), fechaEm: FECHA, duracaoMin: null, percentual: null })?.getTime()).toBe(FECHA.getTime())
    expect(limiteBaseDaTentativa({ agora: minutos(0), fechaEm: null, duracaoMin: 40, percentual: 50 })).toBeNull()
  })
})

describe('duracaoDoAlunoEmMinutos: a duração que o aluno lê, arredondada para cima', () => {
  it('sem tempo adicional é a da prova; com ele, a soma, sem dizer o percentual', () => {
    expect(duracaoDoAlunoEmMinutos(40, null)).toBe(40)
    expect(duracaoDoAlunoEmMinutos(40, 25)).toBe(50)
    expect(duracaoDoAlunoEmMinutos(40, 50)).toBe(60)
    expect(duracaoDoAlunoEmMinutos(40, 100)).toBe(80)
  })

  it('arredonda para cima, nunca para baixo: 45 min com +25% é 56,25, e o aluno lê 57', () => {
    expect(duracaoDoAlunoEmMinutos(45, 25)).toBe(57)
    expect(duracaoDoAlunoEmMinutos(5, 25)).toBe(7)
  })
})
