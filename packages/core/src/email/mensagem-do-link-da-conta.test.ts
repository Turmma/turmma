import { describe, expect, it } from 'vitest'
import { mensagemDoLinkDaConta } from './mensagem-do-link-da-conta.js'

const DADOS = { urlDaWeb: 'https://app.turmma.example', para: 'professora@escola.invalid', token: 'AbC_123-token' } as const

describe('mensagemDoLinkDaConta', () => {
  it.each([
    ['redefinir', 'https://app.turmma.example/redefinir#AbC_123-token', '1 hora'],
    ['verificar', 'https://app.turmma.example/verificar#AbC_123-token', '24 horas'],
  ] as const)('%s: o link tem o token depois do #, nunca na consulta, e diz a validade', (finalidade, link, validade) => {
    const { para, texto, assunto } = mensagemDoLinkDaConta({ ...DADOS, finalidade })
    expect(para).toBe(DADOS.para)
    expect(texto).toContain(link)
    expect(texto).toContain(validade)
    expect(texto).not.toContain('?')
    expect(texto.split(DADOS.token)).toHaveLength(2)
    expect(assunto).not.toContain(DADOS.token)
  })

  it('não leva o endereço de quem recebe nem nome de escola no texto nem no assunto', () => {
    for (const finalidade of ['redefinir', 'verificar'] as const) {
      const { assunto, texto } = mensagemDoLinkDaConta({ ...DADOS, finalidade })
      expect(texto).not.toContain(DADOS.para)
      expect(assunto).not.toContain(DADOS.para)
      expect(texto.toLowerCase()).not.toContain('escola')
    }
  })
})
