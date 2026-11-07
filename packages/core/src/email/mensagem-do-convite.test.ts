import { describe, expect, it } from 'vitest'
import { mensagemDoConvite } from './mensagem-do-convite.js'

const DADOS = { escola: 'Escola Sintética Jardim', urlDaWeb: 'https://app.turmma.example', para: 'professora@escola.invalid', token: 'AbC_123-token' }

describe('mensagemDoConvite', () => {
  it('traz a escola e o link com o token depois do #, nunca na consulta', () => {
    const { assunto, texto, para } = mensagemDoConvite(DADOS)
    expect(para).toBe(DADOS.para)
    expect(assunto).toContain(DADOS.escola)
    expect(texto).toContain(DADOS.escola)
    expect(texto).toContain('https://app.turmma.example/convite#AbC_123-token')
    expect(texto).not.toContain('?')
    expect(texto.split(DADOS.token)).toHaveLength(2)
  })

  it('não leva o endereço de quem recebe no texto nem no assunto: a mensagem não tem nome de ninguém', () => {
    const { assunto, texto } = mensagemDoConvite(DADOS)
    expect(texto).not.toContain(DADOS.para)
    expect(assunto).not.toContain(DADOS.para)
    expect(texto).not.toContain('professora')
  })
})
