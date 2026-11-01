import { describe, expect, it, vi } from 'vitest'
import { ROUTES } from '../paths'
import { copiarLink, linkDoConvite } from './link-do-convite'

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'

describe('o link do convite', () => {
  it('é a origem desta web, a tela do convite do F1 e o token no fragmento, nunca no caminho nem na consulta', () => {
    const link = linkDoConvite('http://127.0.0.1:5173', ROUTES.convite, TOKEN)
    expect(link).toBe(`http://127.0.0.1:5173/convite#${TOKEN}`)
    const lido = new URL(link)
    expect(lido.pathname).toBe('/convite')
    expect(lido.search).toBe('')
    expect(lido.hash).toBe(`#${TOKEN}`)
  })
})

describe('W9 da A0b: copiar o link', () => {
  it('com a área de transferência, escreve o link e diz "copiado" só depois de a escrita terminar', async () => {
    const writeText = vi.fn(async () => undefined)
    expect(await copiarLink('http://x/convite#t', { writeText })).toBe('copiado')
    expect(writeText).toHaveBeenCalledWith('http://x/convite#t')
  })

  it('sem a área de transferência, ou com a escrita recusada, pede para selecionar e copiar à mão', async () => {
    expect(await copiarLink('http://x/convite#t', undefined)).toBe('selecionar')
    expect(await copiarLink('http://x/convite#t', { writeText: () => Promise.reject(new DOMException('negado', 'NotAllowedError')) })).toBe('selecionar')
  })
})
