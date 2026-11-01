import { describe, expect, it } from 'vitest'
import { lerMapaDoTexto, validarMapa } from './mapa.ts'

// O `validarMapa` pelo efeito: o texto JSON do mapa entra, e saem as recusas que o mapa dá sozinho, antes de olhar a árvore.

const ANEXO = 'inventario-web-e2e.md:384'

const simbolo = (campos: Record<string, unknown>): Record<string, unknown> => ({ tipo: 'simbolo', linhaDoAnexo: ANEXO, ...campos })

const recusas = (entradas: Array<Record<string, unknown>>): string[] =>
  validarMapa(lerMapaDoTexto(JSON.stringify({ entradas }), 'tools/renomear/mapas/1.json')).map((recusa) => recusa.codigo)

describe('validarMapa: o de repetido', () => {
  const doAssistente = simbolo({ de: 'portao', para: 'gate', arquivo: 'e2e/support/assistente.ts' })
  const doSino = simbolo({ de: 'portao', para: 'gate', arquivo: 'e2e/support/professor/sino.ts' })

  it('duas cópias do mesmo nome, com arquivo no mesmo pacote e o mesmo para, não se repetem', () => {
    expect(recusas([doAssistente, doSino])).toEqual([])
    expect(recusas([doAssistente, doSino, simbolo({ de: 'portao', para: 'gate', arquivo: 'e2e/aluno.spec.ts' })])).toEqual([])
  })

  it('o mesmo para em pacotes diferentes segue sem se repetir', () => {
    expect(recusas([doAssistente, simbolo({ de: 'portao', para: 'gate', arquivo: 'tools/processo/portao.ts' })])).toEqual([])
  })

  it('para diferente no mesmo pacote: segue recusado', () => {
    expect(recusas([doAssistente, { ...doSino, para: 'door' }])).toEqual(['de-repetido'])
  })

  it('uma das entradas sem arquivo: segue recusado, nas duas ordens', () => {
    const { arquivo: _arquivo, ...semArquivo } = doSino
    expect(recusas([doAssistente, semArquivo])).toEqual(['de-repetido'])
    expect(recusas([semArquivo, doAssistente])).toEqual(['de-repetido'])
  })

  it('o mesmo arquivo declarado duas vezes: segue recusado', () => {
    expect(recusas([doAssistente, { ...doAssistente }])).toEqual(['de-repetido'])
  })

  it('tipos diferentes com o mesmo de: segue recusado', () => {
    expect(recusas([doAssistente, { ...doSino, tipo: 'arquivo' }])).toEqual(['de-repetido'])
  })
})
