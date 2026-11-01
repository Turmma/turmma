import { describe, expect, it, vi } from 'vitest'
import { downloadFromUrl } from './download-from-url'

/**
 * O download de um endereço assinado (F3, 17.0): a âncora temporária leva o endereço e o nome, é clicada uma vez e sai da
 * página. O documento é falso: o que se prova é o que a função faz com ele, e nunca guardar o endereço em outro lugar.
 */
function documentoFalso() {
  const ancora = {
    href: '',
    download: '',
    rel: '',
    hidden: false,
    click: vi.fn(),
    remove: vi.fn(),
  }
  const anexadas: unknown[] = []
  const documento = {
    createElement: vi.fn(() => ancora),
    body: { append: (item: unknown) => anexadas.push(item) },
  }
  return { ancora, anexadas, documento: documento as unknown as Document }
}

describe('baixarPorUrl', () => {
  it('clica uma âncora oculta com o endereço, o nome e o rel seguro, e a tira da página', () => {
    const { ancora, anexadas, documento } = documentoFalso()
    downloadFromUrl('http://127.0.0.1:28343/arquivos/x?assinatura=abc', 'meus-dados-2026-10-10.json', documento)

    expect(ancora.href).toBe('http://127.0.0.1:28343/arquivos/x?assinatura=abc')
    expect(ancora.download).toBe('meus-dados-2026-10-10.json')
    expect(ancora.rel).toBe('noopener noreferrer')
    expect(ancora.hidden).toBe(true)
    expect(anexadas).toEqual([ancora])
    expect(ancora.click).toHaveBeenCalledTimes(1)
    expect(ancora.remove).toHaveBeenCalledTimes(1)
  })

  it('clica depois de anexar e remove depois de clicar: a âncora fora da página não baixa', () => {
    const ordem: string[] = []
    const ancora = {
      href: '',
      download: '',
      rel: '',
      hidden: false,
      click: () => ordem.push('clicar'),
      remove: () => ordem.push('remover'),
    }
    const documento = {
      createElement: () => ancora,
      body: { append: () => ordem.push('anexar') },
    } as unknown as Document
    downloadFromUrl('http://127.0.0.1:28343/arquivos/x', 'arquivo.json', documento)

    expect(ordem).toEqual(['anexar', 'clicar', 'remover'])
  })
})
