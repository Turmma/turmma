import { describe, expect, it } from 'vitest'
import { chaveDoCapituloEntreEdicoes, chaveDoTituloDoCapitulo, PAGINAS_POR_BLOCO_DE_SECAO, planejarSecoes, type CapituloGravado } from './secoes.js'

const capitulo = (ordem: number, numero: number | null, titulo: string, paginaInicial: number, paginaFinal: number): CapituloGravado => ({ id: `capitulo-${String(ordem)}`, ordem, numero, titulo, paginaInicial, paginaFinal })

describe('planejarSecoes (classificacao-bncc, 2.0; Tech Spec, seção 5, "Seções")', () => {
  it('uma seção por capítulo, na ordem dele, com o capítulo e a faixa de páginas', () => {
    expect(planejarSecoes(6, [capitulo(1, 1, 'Mol', 1, 2), capitulo(2, 2, 'Reações', 3, 4), capitulo(3, null, 'Soluções', 5, 6)])).toEqual([
      { capituloId: 'capitulo-1', ordem: 1, paginaInicial: 1, paginaFinal: 2 },
      { capituloId: 'capitulo-2', ordem: 2, paginaInicial: 3, paginaFinal: 4 },
      { capituloId: 'capitulo-3', ordem: 3, paginaInicial: 5, paginaFinal: 6 },
    ])
  })

  it('as páginas antes do primeiro capítulo não têm seção: a primeira começa onde o capítulo começa', () => {
    const secoes = planejarSecoes(8, [capitulo(1, 1, 'Mol', 3, 5), capitulo(2, 2, 'Reações', 6, 8)])
    expect(secoes.map(({ paginaInicial, paginaFinal }) => [paginaInicial, paginaFinal])).toEqual([[3, 5], [6, 8]])
  })

  it('sem capítulo, 25 páginas: 1–10, 11–20 e 21–25, sem capítulo, de 1 em diante', () => {
    expect(planejarSecoes(25, [])).toEqual([
      { capituloId: null, ordem: 1, paginaInicial: 1, paginaFinal: 10 },
      { capituloId: null, ordem: 2, paginaInicial: 11, paginaFinal: 20 },
      { capituloId: null, ordem: 3, paginaInicial: 21, paginaFinal: 25 },
    ])
  })

  it.each([
    [1, [[1, 1]]],
    [10, [[1, 10]]],
    [11, [[1, 10], [11, 11]]],
    [20, [[1, 10], [11, 20]]],
  ])('sem capítulo, %i página(s): o bloco é de %i páginas e o último leva as que sobram', (paginas, faixas) => {
    expect(PAGINAS_POR_BLOCO_DE_SECAO).toBe(10)
    expect(planejarSecoes(paginas, []).map(({ paginaInicial, paginaFinal }) => [paginaInicial, paginaFinal])).toEqual(faixas)
  })

  it('sem página e sem capítulo, não há seção', () => {
    expect(planejarSecoes(0, [])).toEqual([])
  })
})

describe('a chave do capítulo entre duas edições', () => {
  it('o título sem acento, sem caixa e com os espaços de dentro reduzidos a um', () => {
    expect(chaveDoTituloDoCapitulo('  CAPÍTULO  1:  Mol e Massa Molar ')).toBe('capitulo 1: mol e massa molar')
    expect(chaveDoTituloDoCapitulo('Reações químicas')).toBe('reacoes quimicas')
  })

  it('o número e o título juntos: o mesmo número com título diferente, ou o mesmo título com número diferente, é outra chave', () => {
    const mol = chaveDoCapituloEntreEdicoes(1, 'Capítulo 1: Mol')
    expect(chaveDoCapituloEntreEdicoes(1, 'CAPITULO 1:  mol')).toBe(mol)
    expect(chaveDoCapituloEntreEdicoes(1, 'Capítulo 1: Outro')).not.toBe(mol)
    expect(chaveDoCapituloEntreEdicoes(2, 'Capítulo 1: Mol')).not.toBe(mol)
  })

  it('o capítulo sem número não tem chave: nunca casa, nem com outro sem número', () => {
    expect(chaveDoCapituloEntreEdicoes(null, 'Soluções')).toBeNull()
  })
})
