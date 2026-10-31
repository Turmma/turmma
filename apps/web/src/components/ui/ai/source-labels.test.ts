import type { Citacao } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { fontesUnicas, MATERIAL_SEM_TITULO, nomeDoChip, resumoDasFontes, textoDoChip } from './source-labels'

const QUIMICA = '0190a1b2-0000-7000-8000-000000000001'
const FISICA = '0190a1b2-0000-7000-8000-000000000002'
const MATERIAIS = { [QUIMICA]: 'Química 2', [FISICA]: 'Física 1' }

function citacao(materialId: string, pagina: number, trecho = `trecho da página ${String(pagina)}`): Citacao {
  return { materialId, pagina, trecho }
}

describe('chip de fonte', () => {
  it('o chip diz a página, e o nome dele diz o material e termina com o texto que está na tela', () => {
    expect(textoDoChip(142)).toBe('p. 142')
    expect(nomeDoChip(citacao(QUIMICA, 142), MATERIAIS)).toBe('Fonte: Química 2, p. 142')
    expect(nomeDoChip(citacao(QUIMICA, 142), MATERIAIS).endsWith(textoDoChip(142))).toBe(true)
  })

  it('sem o título do material, a citação continua de pé, com a página', () => {
    expect(nomeDoChip(citacao(QUIMICA, 7), {})).toBe(`Fonte: ${MATERIAL_SEM_TITULO}, p. 7`)
  })
})

describe('lista de fontes', () => {
  it('conta e lista as páginas em ordem, com o material dito uma vez', () => {
    expect(resumoDasFontes([citacao(QUIMICA, 145), citacao(QUIMICA, 142), citacao(QUIMICA, 151)], MATERIAIS)).toBe('Fontes (3): Química 2, p. 142 · p. 145 · p. 151')
  })

  it('a mesma página citada em várias questões é uma fonte só, com o primeiro trecho', () => {
    const citacoes = [citacao(QUIMICA, 142, 'primeiro'), citacao(QUIMICA, 142, 'segundo'), citacao(QUIMICA, 145)]
    expect(fontesUnicas(citacoes)).toEqual([citacao(QUIMICA, 142, 'primeiro'), citacao(QUIMICA, 145)])
    expect(resumoDasFontes(citacoes, MATERIAIS)).toBe('Fontes (2): Química 2, p. 142 · p. 145')
  })

  it('a mesma página em materiais diferentes são duas fontes, cada uma com o material dela', () => {
    const citacoes = [citacao(QUIMICA, 12), citacao(FISICA, 12), citacao(QUIMICA, 9)]
    expect(fontesUnicas(citacoes)).toEqual([citacao(QUIMICA, 9), citacao(QUIMICA, 12), citacao(FISICA, 12)])
    expect(resumoDasFontes(citacoes, MATERIAIS)).toBe('Fontes (3): Química 2, p. 9 · p. 12 · Física 1, p. 12')
  })

  it('uma fonte só, e nenhuma', () => {
    expect(resumoDasFontes([citacao(QUIMICA, 142)], MATERIAIS)).toBe('Fontes (1): Química 2, p. 142')
    expect(fontesUnicas([])).toEqual([])
  })
})
