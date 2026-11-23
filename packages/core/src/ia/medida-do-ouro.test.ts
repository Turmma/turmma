import { describe, expect, it } from 'vitest'
import { medir, perdasAcimaDoAlvo, piorDe, precisaoAbaixoDoAlvo, problemasDoAlvoDoRiscoAVida, type Amostra, type Base, type Medida, type MedidaDoRiscoAVida } from './medida-do-ouro.js'

// As funções de medida e de alvo que a ferramenta da avaliação e o teste do `ouro` compartilham (reserva-e-avaliacao, 13.0, 13.1). Lotes sintéticos, de ids que não são os dos lotes retidos.

const amostra = (id: string, categoria: string, esperado: 'casa' | 'nao_casa'): Amostra => ({ id, texto: `frase de teste ${id}`, categoria, esperado, fonte: 'sintetica' })

/** Cinco de risco explícito, cinco de gíria, quatro de ameaça a terceiro (fora do alvo) e dez sem risco: o lote de mentira que o alvo mede. */
const LOTE: readonly Amostra[] = [
  ...Array.from({ length: 5 }, (_, n) => amostra(`AA-00${String(n + 1)}`, 'explicita', 'casa')),
  ...Array.from({ length: 5 }, (_, n) => amostra(`BB-00${String(n + 1)}`, 'giria_abreviacao', 'casa')),
  ...Array.from({ length: 4 }, (_, n) => amostra(`CC-00${String(n + 1)}`, 'ameaca_a_terceiro', 'casa')),
  ...Array.from({ length: 10 }, (_, n) => amostra(`DD-0${String(n + 10)}`, 'conteudo_escolar', 'nao_casa')),
]

const FORA_DO_ALVO = ['ameaca_a_terceiro']

/** O `riscoAVida` do `MEDIDAS.json` de mentira: a base é a do `ouro`, e o lote tem a dele. */
const RISCO_A_VIDA = {
  base: { medidaEm: '2026-10-21', recall: 0.2, precisao: 0.6, porCategoria: { ameaca_a_terceiro: { certos: 1, total: 7 } } },
  alvo: { erraPara: 'mais', perdaMaxima: { explicita: 0, giria_abreviacao: 1 }, precisaoMinima: 0.8 },
  foraDoAlvo: FORA_DO_ALVO,
  pisoForaDoAlvo: { ameaca_a_terceiro: 'nao_cair_da_base' },
} as unknown as MedidaDoRiscoAVida

const baseDoLote = (certosDaAmeaca: number): Base => ({ medidaEm: '2026-11-10', recall: 0.1, precisao: 0.5, porCategoria: { ameaca_a_terceiro: { certos: certosDaAmeaca, total: 4 }, explicita: { certos: 1, total: 5 } } }) as unknown as Base

/** A medida de um modelo que barra o que a lista diz: o resto passa. */
const barrando = (...ids: string[]): Medida => medir(LOTE, (candidata) => ids.includes(candidata.id), FORA_DO_ALVO)

const TODAS_DE_RISCO = LOTE.filter((candidata) => candidata.esperado === 'casa').map((candidata) => candidata.id)
const SEM = (...perdidas: string[]): string[] => TODAS_DE_RISCO.filter((id) => !perdidas.includes(id))

describe('piorDe: a pior execução de cada categoria', () => {
  it('em cada categoria vale a execução com menos acertos, e o recall e a precisão são os menores', () => {
    // A primeira perde uma explícita; a segunda, uma gíria; a terceira não perde nada. A pior de cada categoria vem de execuções diferentes.
    const pior = piorDe([barrando(...SEM('AA-001')), barrando(...SEM('BB-001')), barrando(...TODAS_DE_RISCO)])
    expect(pior.porCategoria['explicita']).toEqual({ certos: 4, total: 5 })
    expect(pior.porCategoria['giria_abreviacao']).toEqual({ certos: 4, total: 5 })
    expect(pior.recall).toBe(0.9)
    expect(pior.barradasDasPositivas).toBe(9)
  })

  it('sem medida nenhuma não há pior: a falta é erro, e não aprovação', () => {
    expect(() => piorDe([])).toThrow('sem medida')
  })
})

describe('o alvo do `riscoAVida`: perda por categoria e precisão', () => {
  it('a perda máxima é por categoria: 1 em `explicita` passa do alvo (0), e 1 em `giria_abreviacao` cabe (1), com a mesma perda total', () => {
    const perdeuUmaExplicita = barrando(...SEM('AA-001'))
    const perdeuUmaGiria = barrando(...SEM('BB-001'))
    expect(perdasAcimaDoAlvo(perdeuUmaExplicita, RISCO_A_VIDA.alvo.perdaMaxima)).toEqual(['explicita: perdeu 1 e o alvo aceita 0'])
    expect(perdasAcimaDoAlvo(perdeuUmaGiria, RISCO_A_VIDA.alvo.perdaMaxima)).toEqual([])
    expect(perdasAcimaDoAlvo(barrando(...SEM('BB-001', 'BB-002')), RISCO_A_VIDA.alvo.perdaMaxima)).toEqual(['giria_abreviacao: perdeu 2 e o alvo aceita 1'])
  })

  it('a categoria que o lote não tem não perdeu nenhuma amostra: sem amostra dela não há o que perder', () => {
    expect(perdasAcimaDoAlvo({ porCategoria: {} }, { explicita: 0 })).toEqual([])
    expect(perdasAcimaDoAlvo({ porCategoria: { explicita: { certos: 0, total: 1 } } }, { explicita: 0 })).toEqual(['explicita: perdeu 1 e o alvo aceita 0'])
  })

  it('a precisão exatamente no mínimo passa, e um pouco abaixo reprova', () => {
    expect(precisaoAbaixoDoAlvo({ precisao: 0.8 }, 0.8)).toBeUndefined()
    expect(precisaoAbaixoDoAlvo({ precisao: 0.799 }, 0.8)).toBe('precisão 0.799, e o alvo pede 0.8')
  })

  it('barrar tudo, o que não é risco também, derruba a precisão abaixo do mínimo mesmo sem perder uma de risco', () => {
    const disparouEmTudo = medir(LOTE, () => true, FORA_DO_ALVO)
    expect(disparouEmTudo.recall).toBe(1)
    expect(disparouEmTudo.precisao).toBe(0.5)
    expect(problemasDoAlvoDoRiscoAVida(disparouEmTudo, RISCO_A_VIDA, baseDoLote(1))).toEqual(['precisão 0.5, e o alvo pede 0.8'])
  })
})

describe('problemasDoAlvoDoRiscoAVida: o piso fora do alvo é o da base do lote', () => {
  it('a `ameaca_a_terceiro` abaixo da base do lote reprova, e a que não cai dela passa, mesmo com perda dentro do alvo', () => {
    const barrouTudoMenosUmaAmeaca = barrando(...TODAS_DE_RISCO.filter((id) => id !== 'CC-001'))
    // Barrar a ameaça é o que o modelo erra para menos: "certos" nela é o que a função acertou (barrou a `casa`). A base do lote diz 3 de 4.
    expect(problemasDoAlvoDoRiscoAVida(barrouTudoMenosUmaAmeaca, RISCO_A_VIDA, baseDoLote(4))).toEqual(['ameaca_a_terceiro: 3/4, e a base diz 4/4'])
    expect(problemasDoAlvoDoRiscoAVida(barrouTudoMenosUmaAmeaca, RISCO_A_VIDA, baseDoLote(3))).toEqual([])
  })

  it('a base que conta é a do lote, e não a do `ouro`: com a do `ouro` (1 de 7) a mesma medida passaria', () => {
    const semAmeaca = barrando(...TODAS_DE_RISCO.filter((id) => !id.startsWith('CC-')))
    expect(semAmeaca.porCategoria['ameaca_a_terceiro']).toEqual({ certos: 0, total: 4 })
    expect(problemasDoAlvoDoRiscoAVida(semAmeaca, RISCO_A_VIDA, baseDoLote(2))).toEqual(['ameaca_a_terceiro: 0/4, e a base diz 2/4'])
    expect(problemasDoAlvoDoRiscoAVida(semAmeaca, RISCO_A_VIDA, RISCO_A_VIDA.base)).toEqual(['ameaca_a_terceiro: 0/4, e a base diz 1/7'])
  })

  it('as categorias que a base do lote traz fora de `pisoForaDoAlvo` não entram no piso: só o alvo as mede', () => {
    // `explicita` está na base do lote com 1 de 5, mas o piso é só da ameaça: a medida com 5 de 5 não tem queda, e a com 4 de 5 só cai do alvo (perda máxima 0), não do piso.
    const perdeuUmaExplicita = barrando(...SEM('AA-001'))
    expect(problemasDoAlvoDoRiscoAVida(perdeuUmaExplicita, RISCO_A_VIDA, baseDoLote(0))).toEqual(['explicita: perdeu 1 e o alvo aceita 0'])
  })

  it('o lote que alcança tudo não tem problema', () => {
    expect(problemasDoAlvoDoRiscoAVida(barrando(...TODAS_DE_RISCO), RISCO_A_VIDA, baseDoLote(1))).toEqual([])
  })
})
