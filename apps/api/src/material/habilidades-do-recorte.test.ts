import type { BnccRepository, FiltroDeHabilidades, HabilidadeDaBncc } from '@educa/core'
import { describe, expect, it } from 'vitest'
import { candidatasDoRecorte, descricaoOficialDaHabilidade, descricoesDoDiagnostico } from './habilidades-do-recorte.js'

/** O `BnccRepository` que responde com a lista dada e guarda o filtro que recebeu: a regra do recorte se prova sem banco, e a leitura da tabela, no teste de integração do núcleo. */
function bnccComAsHabilidades(habilidades: readonly HabilidadeDaBncc[]): { bncc: BnccRepository; filtros: FiltroDeHabilidades[] } {
  const filtros: FiltroDeHabilidades[] = []
  const bncc = {
    habilidades: (filtro: FiltroDeHabilidades) => {
      filtros.push(filtro)
      return Promise.resolve([...habilidades])
    },
  } as unknown as BnccRepository
  return { bncc, filtros }
}

const habilidade = (codigo: string, grupo: HabilidadeDaBncc['grupo'], descricao = `Texto de ${codigo}`): HabilidadeDaBncc => ({ codigo, descricao, grupo })

describe('as habilidades candidatas de um recorte', () => {
  it('pede à BNCC as etapas das séries, sem repetir, e só devolve as que o componente e as séries aceitam', async () => {
    const { bncc, filtros } = bnccComAsHabilidades([habilidade('EF06CI01', 'ciencias'), habilidade('EF07CI01', 'ciencias'), habilidade('EF06MA01', 'matematica'), habilidade('EM13CNT101', 'ciencias_da_natureza')])
    const candidatas = await candidatasDoRecorte(bncc, 'ciencias', [
      { etapa: 'ef_anos_finais', ano: 6 },
      { etapa: 'ef_anos_finais', ano: 6 },
    ])
    expect(filtros).toEqual([{ etapas: ['ef_anos_finais'] }])
    expect(candidatas.map((candidata) => candidata.codigo)).toEqual(['EF06CI01'])
  })

  it('devolve só o código e o texto: o grupo da leitura não chega a quem consome a candidata', async () => {
    const { bncc } = bnccComAsHabilidades([habilidade('EF06CI01', 'ciencias', 'Texto oficial')])
    const [candidata] = await candidatasDoRecorte(bncc, 'ciencias', [{ etapa: 'ef_anos_finais', ano: 6 }])
    expect(candidata).toEqual({ codigo: 'EF06CI01', descricao: 'Texto oficial' })
  })

  it('sem série não há candidata, e a BNCC nem é consultada', async () => {
    const { bncc, filtros } = bnccComAsHabilidades([habilidade('EF06CI01', 'ciencias')])
    expect(await candidatasDoRecorte(bncc, 'ciencias', [])).toEqual([])
    expect(filtros).toEqual([])
  })
})

describe('o texto oficial de uma habilidade', () => {
  it('vai cortado no tamanho do contrato da geração, com reticências, quando passa de 300', async () => {
    const longo = 'palavra '.repeat(80)
    const { bncc, filtros } = bnccComAsHabilidades([habilidade('EF06CI01', 'ciencias', longo)])
    const descricao = await descricaoOficialDaHabilidade(bncc, 'EF06CI01')
    expect(filtros).toEqual([{ codigo: 'EF06CI01' }])
    expect(descricao?.length).toBeLessThanOrEqual(300)
    expect(descricao?.endsWith('…')).toBe(true)
  })

  it('o texto curto vai como está', async () => {
    const { bncc } = bnccComAsHabilidades([habilidade('EF06CI01', 'ciencias', 'Texto curto')])
    expect(await descricaoOficialDaHabilidade(bncc, 'EF06CI01')).toBe('Texto curto')
  })

  it('o código que a tabela não tem devolve `undefined`', async () => {
    const { bncc } = bnccComAsHabilidades([])
    expect(await descricaoOficialDaHabilidade(bncc, 'EF06CI99')).toBeUndefined()
  })
})

describe('o texto da habilidade no diagnóstico', () => {
  it('é o da tabela, pelos códigos gravados, e vence o que o conteúdo da questão guardava', async () => {
    const { bncc, filtros } = bnccComAsHabilidades([habilidade('EM13CNT101', 'ciencias_da_natureza', 'Texto oficial')])
    const descricoes = await descricoesDoDiagnostico(bncc, new Map([['EM13CNT101', 'Texto inventado pelo modelo']]))
    expect(filtros).toEqual([{ codigos: ['EM13CNT101'] }])
    expect(descricoes.get('EM13CNT101')).toBe('Texto oficial')
  })

  it('vai cortado no tamanho do contrato, como o que a gravação guarda', async () => {
    const { bncc } = bnccComAsHabilidades([habilidade('EM13CNT101', 'ciencias_da_natureza', 'palavra '.repeat(80))])
    const descricao = (await descricoesDoDiagnostico(bncc, new Map([['EM13CNT101', 'x']]))).get('EM13CNT101')
    expect(descricao?.length).toBeLessThanOrEqual(300)
    expect(descricao?.endsWith('…')).toBe(true)
  })

  it('o código que a tabela não tem, o do antigo catálogo, segue com o texto gravado', async () => {
    const { bncc } = bnccComAsHabilidades([habilidade('EM13CNT101', 'ciencias_da_natureza', 'Texto oficial')])
    const descricoes = await descricoesDoDiagnostico(bncc, new Map([['EM13CNT101', 'x'], ['QUI.EM.05', 'Reagente limitante']]))
    expect([...descricoes.entries()]).toEqual([['EM13CNT101', 'Texto oficial'], ['QUI.EM.05', 'Reagente limitante']])
  })

  it('sem habilidade gravada, a tabela nem é consultada', async () => {
    const { bncc, filtros } = bnccComAsHabilidades([habilidade('EM13CNT101', 'ciencias_da_natureza')])
    expect((await descricoesDoDiagnostico(bncc, new Map())).size).toBe(0)
    expect(filtros).toEqual([])
  })
})
