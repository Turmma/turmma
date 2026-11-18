import { describe, expect, it } from 'vitest'
import { classificarSecoesInputSchema } from '../ia/tasks/classificar-secoes.js'
import { CARACTERES_DO_COMECO_DA_SECAO, CARACTERES_DOS_SUBTITULOS_DA_SECAO, cortarTexto, textoDaSecao } from './texto-das-secoes.js'

describe('o texto da seção que a classificação lê', () => {
  it('os tetos são os do schema da tarefa: um texto no teto passa, e um caractere a mais não', () => {
    const entrada = (comeco: string, subtitulos: string) => classificarSecoesInputSchema.safeParse({ candidatas: [{ codigo: 'EF07MA01', descricao: 'x' }], secoes: [{ secaoId: '0190f5a0-0000-7000-8000-0000000000c1', titulo: null, comeco, subtitulos }] }).success
    expect(entrada('a'.repeat(CARACTERES_DO_COMECO_DA_SECAO), 'b'.repeat(CARACTERES_DOS_SUBTITULOS_DA_SECAO))).toBe(true)
    expect(entrada('a'.repeat(CARACTERES_DO_COMECO_DA_SECAO + 1), '')).toBe(false)
    expect(entrada('', 'b'.repeat(CARACTERES_DOS_SUBTITULOS_DA_SECAO + 1))).toBe(false)
  })

  it('o começo é o texto das primeiras páginas, com espaço único, cortado no teto', () => {
    const { comeco } = textoDaSecao(['Os  átomos\nse ligam.', 'x'.repeat(2_000)], null)
    expect(comeco.startsWith('Os átomos se ligam. xxx')).toBe(true)
    expect(comeco).toHaveLength(CARACTERES_DO_COMECO_DA_SECAO)
  })

  it('os subtítulos são as linhas curtas sem pontuação final, sem o título do capítulo e sem repetir', () => {
    const pagina = ['Mol e massa molar', '1. A constante de Avogadro', 'O mol é a quantidade de matéria que contém 6,02 vezes dez elevado a vinte e três entidades, e é a unidade do SI.', 'curta.', '1. A constante de avogadro', 'minúscula no começo', 'Massa molar'].join('\n')
    expect(textoDaSecao([pagina], 'Mol e Massa Molar').subtitulos).toBe('1. A constante de Avogadro\nMassa molar')
  })

  it('os subtítulos param no teto sem cortar uma linha no meio', () => {
    const linhas = Array.from({ length: 100 }, (_, i) => `Subtítulo número ${String(i + 100)} do capítulo`)
    const { subtitulos } = textoDaSecao([linhas.join('\n')], null)
    expect(subtitulos.length).toBeLessThanOrEqual(CARACTERES_DOS_SUBTITULOS_DA_SECAO)
    expect(subtitulos.split('\n').every((linha) => linhas.includes(linha))).toBe(true)
  })

  it('a linha de subtítulo tem de 4 a 80 caracteres, com letra, sem pontuação final', () => {
    const subtitulos = (...linhas: string[]) => textoDaSecao([linhas.join('\n')], null).subtitulos
    expect(subtitulos('Mol')).toBe('')
    expect(subtitulos('Mols')).toBe('Mols')
    expect(subtitulos(`A${'b'.repeat(79)}`)).toBe(`A${'b'.repeat(79)}`)
    expect(subtitulos(`A${'b'.repeat(80)}`)).toBe('')
    expect(subtitulos('1234')).toBe('')
    for (const final of ['.', ',', ';', ':']) expect(subtitulos(`Quantidade de matéria${final}`), final).toBe('')
  })

  it('o título e a repetição se comparam sem acento, sem caixa e com espaço único', () => {
    expect(textoDaSecao(['Química geral'], 'Quimica   geral').subtitulos).toBe('')
    expect(textoDaSecao(['Química geral', 'QUIMICA GERAL'], null).subtitulos).toBe('Química geral')
    expect(textoDaSecao(['Mol e massa molar'], 'Mol\ne massa  molar').subtitulos).toBe('')
  })

  it('o teto dos subtítulos conta o separador: dez linhas de 50 caracteres não cabem em 500', () => {
    const linhas = Array.from({ length: 12 }, (_, i) => `S${'x'.repeat(47)}${String(i + 10)}`)
    const { subtitulos } = textoDaSecao([linhas.join('\n')], null)
    expect(subtitulos.split('\n')).toHaveLength(9)
    expect(subtitulos.length).toBeLessThanOrEqual(CARACTERES_DOS_SUBTITULOS_DA_SECAO)
  })

  it('a seção sem texto tem começo e subtítulos vazios', () => {
    expect(textoDaSecao([], 'Capítulo')).toEqual({ comeco: '', subtitulos: '' })
  })

  it('o corte não parte um par substituto ao meio', () => {
    expect(cortarTexto('ab😀', 3)).toBe('ab')
    expect(cortarTexto('ab😀', 4)).toBe('ab😀')
    expect(cortarTexto('ab😀c', 4)).toBe('ab😀')
    expect(cortarTexto('abcd', 3)).toBe('abc')
    // No teto, o texto vai inteiro, mesmo que termine numa metade de par: é o texto que já era, e não um corte nosso.
    expect(cortarTexto('ab\uD83D', 3)).toBe('ab\uD83D')
  })
})
