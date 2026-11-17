import { describe, expect, it } from 'vitest'
import {
  COMPONENTE_PELA_CHAVE_DO_NOME,
  COMPONENTES_BNCC,
  componenteDoNomeDaDisciplina,
  habilidadeEhCandidata,
  NOME_DO_COMPONENTE,
  partesDoCodigoBncc,
  type ComponenteBncc,
  type SerieDoRecorte,
} from './componentes.js'

const ef = (...anos: number[]): SerieDoRecorte[] => anos.map((ano) => ({ etapa: 'ef_anos_finais', ano }))
const em = (...anos: number[]): SerieDoRecorte[] => anos.map((ano) => ({ etapa: 'em', ano }))

describe('as candidatas por série e componente (classificacao-bncc, 1.0; cenarios.md, "Tabela BNCC e componente")', () => {
  it('`EF69LP01` é candidata de Língua Portuguesa no 6º, no 7º, no 8º e no 9º, e não no 1º do Médio', () => {
    for (const ano of [6, 7, 8, 9]) expect(habilidadeEhCandidata('EF69LP01', 'lingua_portuguesa', ef(ano)), `${String(ano)}º`).toBe(true)
    expect(habilidadeEhCandidata('EF69LP01', 'lingua_portuguesa', em(1))).toBe(false)
    expect(habilidadeEhCandidata('EF69LP01', 'matematica', ef(6))).toBe(false)
  })

  it('`EF67EF` vale no 6º e no 7º, e `EF89EF` no 8º e no 9º', () => {
    expect([6, 7, 8, 9].map((ano) => habilidadeEhCandidata('EF67EF01', 'educacao_fisica', ef(ano)))).toEqual([true, true, false, false])
    expect([6, 7, 8, 9].map((ano) => habilidadeEhCandidata('EF89EF01', 'educacao_fisica', ef(ano)))).toEqual([false, false, true, true])
  })

  it('o código de um ano só (`EF07LP01`) vale só naquele ano', () => {
    expect([6, 7, 8, 9].map((ano) => habilidadeEhCandidata('EF07LP01', 'lingua_portuguesa', ef(ano)))).toEqual([false, true, false, false])
  })

  it('`EM13CNT301` é candidata de Química e de Física, e não de Matemática nem de Língua Portuguesa', () => {
    expect(habilidadeEhCandidata('EM13CNT301', 'quimica', em(1))).toBe(true)
    expect(habilidadeEhCandidata('EM13CNT301', 'fisica', em(2))).toBe(true)
    expect(habilidadeEhCandidata('EM13CNT301', 'matematica', em(1))).toBe(false)
    expect(habilidadeEhCandidata('EM13CNT301', 'lingua_portuguesa', em(1))).toBe(false)
  })

  it('Língua Portuguesa no Médio traz `EM13LP` e `EM13LGG`; Arte traz só `EM13LGG`', () => {
    expect(habilidadeEhCandidata('EM13LP05', 'lingua_portuguesa', em(1))).toBe(true)
    expect(habilidadeEhCandidata('EM13LGG101', 'lingua_portuguesa', em(1))).toBe(true)
    expect(habilidadeEhCandidata('EM13LGG101', 'arte', em(1))).toBe(true)
    expect(habilidadeEhCandidata('EM13LP05', 'arte', em(1))).toBe(false)
  })

  it('Arte, Educação Física e Ensino Religioso acham as do Fundamental pelas siglas `AR`, `EF` e `ER`, nos blocos e no ano', () => {
    expect(habilidadeEhCandidata('EF69AR01', 'arte', ef(8))).toBe(true)
    expect(habilidadeEhCandidata('EF67EF01', 'educacao_fisica', ef(6))).toBe(true)
    expect(habilidadeEhCandidata('EF08ER01', 'ensino_religioso', ef(8))).toBe(true)
    expect(habilidadeEhCandidata('EF08ER01', 'ensino_religioso', ef(7))).toBe(false)
    expect(habilidadeEhCandidata('EF08ER01', 'ensino_religioso', em(1, 2, 3))).toBe(false)
  })

  it('o material do 9º ano e do 1º do Médio traz a união das duas etapas', () => {
    const serie = [...ef(9), ...em(1)]
    expect(habilidadeEhCandidata('EF09CI01', 'ciencias', serie)).toBe(true)
    expect(habilidadeEhCandidata('EM13CNT101', 'ciencias', serie)).toBe(true)
    expect(habilidadeEhCandidata('EF06CI01', 'ciencias', serie)).toBe(false)
    // O material só do 9º do Fundamental não traz habilidade do Médio.
    expect(habilidadeEhCandidata('EM13CNT101', 'ciencias', ef(9))).toBe(false)
  })

  it('sem série não há candidata, e o código fora do recorte (`EF15AR01`, `EM13LP5`) nunca é candidato; o de Computação (`EF06CO01`, que o check aceita) não é de componente nenhum', () => {
    expect(habilidadeEhCandidata('EF69LP01', 'lingua_portuguesa', [])).toBe(false)
    for (const codigo of ['EF15AR01', 'EM13LP5', 'EM13LGG01', 'EF03CI03B', 'EF06LP']) {
      expect(partesDoCodigoBncc(codigo), codigo).toBeNull()
    }
    expect(habilidadeEhCandidata('EF15AR01', 'arte', ef(6, 7, 8, 9))).toBe(false)
    expect(COMPONENTES_BNCC.some((componente) => habilidadeEhCandidata('EF06CO01', componente, ef(6)))).toBe(false)
  })

  it('Biologia, Física e Química no Fundamental procuram em Ciências; Filosofia e Sociologia não têm candidata do Fundamental', () => {
    for (const componente of ['biologia', 'fisica', 'quimica'] as const) expect(habilidadeEhCandidata('EF09CI01', componente, ef(9)), componente).toBe(true)
    for (const componente of ['filosofia', 'sociologia'] as const) {
      expect(habilidadeEhCandidata('EF09HI01', componente, ef(9)), componente).toBe(false)
      expect(habilidadeEhCandidata('EM13CHS101', componente, em(1)), componente).toBe(true)
    }
  })
})

describe('o componente que o nome da disciplina diz', () => {
  it('"Química", "QUIMICA" e " química " são Química; "Português" é Língua Portuguesa', () => {
    expect(['Química', 'QUIMICA', ' química ', '  QUÍMICA', 'Português', 'LÍNGUA PORTUGUESA', 'Inglês', 'Artes'].map(componenteDoNomeDaDisciplina)).toEqual([
      'quimica',
      'quimica',
      'quimica',
      'quimica',
      'lingua_portuguesa',
      'lingua_portuguesa',
      'lingua_inglesa',
      'arte',
    ])
  })

  it('"Projeto de Vida" e "Robótica" ficam sem componente', () => {
    expect(['Projeto de Vida', 'Robótica', '', 'Química Orgânica'].map(componenteDoNomeDaDisciplina)).toEqual([null, null, null, null])
  })

  it('todo componente tem nome na tela e um nome que o casa', () => {
    expect(Object.keys(NOME_DO_COMPONENTE).sort()).toEqual([...COMPONENTES_BNCC].sort())
    const casados = new Set<ComponenteBncc>(Object.values(COMPONENTE_PELA_CHAVE_DO_NOME))
    expect([...casados].sort()).toEqual([...COMPONENTES_BNCC].sort())
  })
})
