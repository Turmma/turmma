import { describe, expect, it } from 'vitest'
import { capituloDaQuestao, paginasDaSecao, paginasDoCapitulo, textoDoLimiteDeAlteracoesSeguidas, tituloDaSecao, tituloDoCapitulo } from './nome-da-secao'

/** Como a tela diz o capítulo, as páginas e a espera do 429 (classificacao-bncc, 8.0 e 11.0): o painel do material e o artefato escrevem igual. */
describe('o nome do capítulo na tela', () => {
  it('as páginas: "Página 12" quando é uma só, "Páginas 12 a 20" quando são várias', () => {
    expect(paginasDoCapitulo({ paginaInicial: 12, paginaFinal: 12 })).toBe('Página 12')
    expect(paginasDoCapitulo({ paginaInicial: 12, paginaFinal: 20 })).toBe('Páginas 12 a 20')
  })

  it('o título leva o número que o PDF escreve, e o título sozinho quando ele não numera', () => {
    expect(tituloDoCapitulo({ numero: 3, titulo: 'Frações' })).toBe('Capítulo 3 · Frações')
    expect(tituloDoCapitulo({ numero: null, titulo: 'Frações' })).toBe('Frações')
  })

  it('o bloco de páginas (sem capítulo) se chama pelas páginas e não repete a linha delas; o capítulo as diz à parte', () => {
    const capitulo = { capitulo: { numero: 3, titulo: 'Frações' }, paginaInicial: 12, paginaFinal: 20 }
    const bloco = { capitulo: null, paginaInicial: 1, paginaFinal: 10 }
    expect(tituloDaSecao(capitulo)).toBe('Capítulo 3 · Frações')
    expect(paginasDaSecao(capitulo)).toBe('Páginas 12 a 20')
    expect(tituloDaSecao(bloco)).toBe('Páginas 1 a 10')
    expect(paginasDaSecao(bloco)).toBeUndefined()
  })

  it('a linha da questão junta o capítulo e as páginas, e o bloco de páginas fica só com elas', () => {
    expect(capituloDaQuestao({ capitulo: { numero: 3, titulo: 'Frações' }, paginaInicial: 12, paginaFinal: 20 })).toBe('Capítulo 3 · Frações (Páginas 12 a 20)')
    expect(capituloDaQuestao({ capitulo: null, paginaInicial: 4, paginaFinal: 6 })).toBe('Páginas 4 a 6')
  })

  it('a espera do 429: minutos para cima, no singular quando é um, e "em instantes" sem `Retry-After`', () => {
    expect(textoDoLimiteDeAlteracoesSeguidas(undefined)).toBe('Muitas alterações seguidas. Tente de novo em instantes.')
    expect(textoDoLimiteDeAlteracoesSeguidas(30)).toBe('Muitas alterações seguidas. Tente de novo em 1 minuto.')
    expect(textoDoLimiteDeAlteracoesSeguidas(61)).toBe('Muitas alterações seguidas. Tente de novo em 2 minutos.')
    expect(textoDoLimiteDeAlteracoesSeguidas(3_600)).toBe('Muitas alterações seguidas. Tente de novo em 60 minutos.')
  })
})
