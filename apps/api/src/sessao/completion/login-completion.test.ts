import { describe, expect, it } from 'vitest'
import { etapaDoLogin } from './login-completion.js'

describe('etapa do login depois da senha certa', () => {
  it('um professor só: pronta', () => {
    expect(etapaDoLogin([{ papel: 'professor' }], false)).toBe('pronta')
  })

  it('um coordenador só: configurar o MFA, ou informá-lo quando já tem; nunca pronta', () => {
    expect(etapaDoLogin([{ papel: 'coordenador' }], false)).toBe('configurar_mfa')
    expect(etapaDoLogin([{ papel: 'coordenador' }], true)).toBe('mfa')
  })

  it('um coordenador só, com o segundo fator já cumprido nesta entrada: pronta', () => {
    expect(etapaDoLogin([{ papel: 'coordenador' }], true, true)).toBe('pronta')
    expect(etapaDoLogin([{ papel: 'coordenador' }], true, false)).toBe('mfa')
  })

  it('usuário ativo em mais de uma escola: escolher, com ou sem coordenação entre elas', () => {
    expect(etapaDoLogin([{ papel: 'professor' }, { papel: 'professor' }], false)).toBe('escolher')
    expect(etapaDoLogin([{ papel: 'professor' }, { papel: 'coordenador' }], true)).toBe('escolher')
    expect(etapaDoLogin([{ papel: 'coordenador' }, { papel: 'coordenador' }], true, true)).toBe('escolher')
  })
})
