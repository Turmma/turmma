import { describe, expect, it } from 'vitest'
import { MATERIAL_QUERY_KEY } from './api/material'
import { RESUMO_DO_MATERIAL_QUERY_KEY, resumoDoMaterialQueryOptions } from './api/resumo'
import { assinaturaDosEstados, avisoDaMigracao, linhasDoResumo, NOME_DA_LINHA_SEM_SERIE, resumoFicouParaTras } from './resumo-do-material'

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const FISICA = { id: id(501), nome: 'Física', area: null }
const QUIMICA = { id: id(500), nome: 'Química', area: null }
const SERIE_6 = { id: id(600), etapa: 'ef_anos_finais', ano: 6 } as const
const SERIE_9 = { id: id(603), etapa: 'ef_anos_finais', ano: 9 } as const
const SERIE_1EM = { id: id(610), etapa: 'em', ano: 1 } as const
const linha = (parte: Partial<{ disciplinaId: string; serieId: string | null; pronto: number; processando: number; falhou: number; recusados30Dias: number }>) => ({
  disciplinaId: QUIMICA.id,
  serieId: SERIE_6.id,
  pronto: 0,
  processando: 0,
  falhou: 0,
  recusados30Dias: 0,
  ...parte,
})

/**
 * O que o resumo do material desenha, sem React (ingestao-do-material, 11.0; RF18): a ordem das linhas, o nome do que a escola não tem na lista e o passo da releitura.
 */
describe('as linhas do resumo', () => {
  it('em ordem de disciplina, depois de série (o Fundamental antes do Médio), com o sem série no fim de cada disciplina', () => {
    const resumo = {
      linhas: [
        linha({ disciplinaId: QUIMICA.id, serieId: null }),
        linha({ disciplinaId: QUIMICA.id, serieId: SERIE_1EM.id }),
        linha({ disciplinaId: FISICA.id, serieId: SERIE_9.id }),
        linha({ disciplinaId: QUIMICA.id, serieId: SERIE_9.id }),
        linha({ disciplinaId: QUIMICA.id, serieId: SERIE_6.id }),
        linha({ disciplinaId: FISICA.id, serieId: null }),
      ],
      semSerie: 0,
    }
    expect(linhasDoResumo(resumo, [QUIMICA, FISICA], [SERIE_1EM, SERIE_9, SERIE_6]).map((linhaDoResumo) => `${linhaDoResumo.disciplina} · ${linhaDoResumo.serie}`)).toEqual([
      'Física · 9º ano do Ensino Fundamental',
      `Física · ${NOME_DA_LINHA_SEM_SERIE}`,
      'Química · 6º ano do Ensino Fundamental',
      'Química · 9º ano do Ensino Fundamental',
      'Química · 1º ano do Ensino Médio',
      `Química · ${NOME_DA_LINHA_SEM_SERIE}`,
    ])
  })

  it('a disciplina ou a série que a escola ainda não leu vira "Disciplina" ou "Série", e a linha não some', () => {
    const resumo = { linhas: [linha({ disciplinaId: id(999), serieId: id(998), pronto: 2 })], semSerie: 0 }
    expect(linhasDoResumo(resumo, [QUIMICA], [SERIE_6])).toEqual([{ chave: `${id(999)}:${id(998)}`, disciplina: 'Disciplina', serie: 'Série', pronto: 2, processando: 0, falhou: 0, recusados30Dias: 0 }])
  })

  it('a série que a escola ainda não leu vem depois das conhecidas e antes do "Sem série", dentro da disciplina', () => {
    const resumo = { linhas: [linha({ serieId: null }), linha({ serieId: id(998) }), linha({ serieId: SERIE_1EM.id }), linha({ serieId: SERIE_6.id })], semSerie: 0 }
    expect(linhasDoResumo(resumo, [QUIMICA], [SERIE_1EM, SERIE_6]).map((linhaDoResumo) => linhaDoResumo.serie)).toEqual(['6º ano do Ensino Fundamental', '1º ano do Ensino Médio', 'Série', NOME_DA_LINHA_SEM_SERIE])
  })
})

describe('a releitura do resumo', () => {
  const material = (n: number, estado: 'processando' | 'pronto' | 'falhou') => ({ id: id(n), estado })

  it('a assinatura muda quando um material muda de estado, entra ou sai, e não muda com a lista na ordem de outro envio', () => {
    const base = assinaturaDosEstados([material(1, 'processando'), material(2, 'pronto')])
    expect(assinaturaDosEstados([material(2, 'pronto'), material(1, 'processando')])).toBe(base)
    expect(assinaturaDosEstados([material(1, 'pronto'), material(2, 'pronto')])).not.toBe(base)
    expect(assinaturaDosEstados([material(1, 'falhou'), material(2, 'pronto')])).not.toBe(base)
    expect(assinaturaDosEstados([material(1, 'processando'), material(2, 'pronto'), material(3, 'pronto')])).not.toBe(base)
    expect(assinaturaDosEstados([material(1, 'processando')])).not.toBe(base)
    expect(assinaturaDosEstados([])).toBe('')
  })

  it('o resumo fica para trás quando ainda conta material `processando` e a lista não tem nenhum; nos outros casos não', () => {
    const comProcessando = { linhas: [linha({ pronto: 4 }), linha({ serieId: SERIE_9.id, processando: 1 })] }
    expect(resumoFicouParaTras(comProcessando, [material(1, 'pronto')])).toBe(true)
    expect(resumoFicouParaTras(comProcessando, [])).toBe(true)
    // A lista ainda tem material processando: o resumo está em dia, a assinatura é quem o avisará quando ele terminar.
    expect(resumoFicouParaTras(comProcessando, [material(1, 'processando')])).toBe(false)
    expect(resumoFicouParaTras({ linhas: [linha({ pronto: 4, falhou: 1 })] }, [material(1, 'pronto')])).toBe(false)
    expect(resumoFicouParaTras({ linhas: [] }, [])).toBe(false)
    expect(resumoFicouParaTras(undefined, [material(1, 'pronto')])).toBe(false)
  })

  it('a consulta do resumo não tem laço próprio: nenhum `refetchInterval`', () => {
    expect(resumoDoMaterialQueryOptions.refetchInterval).toBeUndefined()
  })
})

describe('a chave do resumo', () => {
  it('a chave do resumo fica sob a de Material: a pessoa seguinte esvazia as duas de uma vez (`main.tsx`), e o resumo da anterior não passa à seguinte', () => {
    expect(RESUMO_DO_MATERIAL_QUERY_KEY.slice(0, MATERIAL_QUERY_KEY.length)).toEqual([...MATERIAL_QUERY_KEY])
    expect(RESUMO_DO_MATERIAL_QUERY_KEY.length).toBeGreaterThan(MATERIAL_QUERY_KEY.length)
  })
})

describe('o aviso da migração', () => {
  it('sem material sem série e sem lista lida, não há aviso', () => {
    expect(avisoDaMigracao({ semSerie: 0 }, undefined, [SERIE_6, SERIE_9])).toBeUndefined()
  })

  it('material de todas as séries só avisa quando a escola tem mais de uma série', () => {
    expect(avisoDaMigracao({ semSerie: 0 }, [{ serieIds: [SERIE_6.id, SERIE_9.id] }], [SERIE_6, SERIE_9])).toMatch(/vale para todas as séries da escola/)
    expect(avisoDaMigracao({ semSerie: 0 }, [{ serieIds: [SERIE_6.id] }], [SERIE_6])).toBeUndefined()
    expect(avisoDaMigracao({ semSerie: 0 }, [{ serieIds: [SERIE_6.id] }], [SERIE_6, SERIE_9])).toBeUndefined()
  })

  it('o material sem série vence o outro aviso: diz quantos', () => {
    expect(avisoDaMigracao({ semSerie: 3 }, [{ serieIds: [SERIE_6.id, SERIE_9.id] }], [SERIE_6, SERIE_9])).toMatch(/^Séries atribuídas na migração: 3 materiais estão sem série/)
  })
})
