import { describe, expect, it } from 'vitest'
import { enderecoDoLoginExterno } from './escola'
import { enderecoParaProvarAContaNaSala } from './salas'

/**
 * Para onde o botão "Entrar com a conta da escola" da sala leva (acesso-e-convites, 16.0): o `iniciar` do provedor com `intencao=reivindicar`, a sala e o token **ou** o código,
 * como o contrato da 14.0 pede. O que a API faz com ele é dela (`apps/api/test/reivindicacao-com-conta.int.test.ts`).
 */
describe('o endereço para provar a conta da escola na sala', () => {
  it('o link leva o token, o provedor escolhido e a intenção de reivindicar, e nada mais', () => {
    expect(enderecoParaProvarAContaNaSala('google', 'colegio-a', { token: 'token-do-link' })).toBe(`${enderecoDoLoginExterno('google', 'colegio-a')}&intencao=reivindicar&token=token-do-link`)
    expect(enderecoParaProvarAContaNaSala('microsoft', 'colegio-a', { token: 'token-do-link' })).toBe(`${enderecoDoLoginExterno('microsoft', 'colegio-a')}&intencao=reivindicar&token=token-do-link`)
  })

  it('o código leva `codigo=`, não `token=`', () => {
    const endereco = enderecoParaProvarAContaNaSala('google', 'colegio-a', { codigo: 'ABCD2345' })

    expect(endereco).toBe(`${enderecoDoLoginExterno('google', 'colegio-a')}&intencao=reivindicar&codigo=ABCD2345`)
    expect(endereco).not.toContain('token=')
  })

  it('o que não é seguro na consulta sai codificado: o token e o código não abrem outro parâmetro', () => {
    const doToken = new URL(enderecoParaProvarAContaNaSala('google', 'colegio-a', { token: 'a&intencao=ligar' }), 'http://x')
    const doCodigo = new URL(enderecoParaProvarAContaNaSala('google', 'colegio-a', { codigo: 'AB CD&x=1' }), 'http://x')

    expect(doToken.searchParams.get('intencao')).toBe('reivindicar')
    expect(doToken.searchParams.get('token')).toBe('a&intencao=ligar')
    expect(doCodigo.searchParams.get('codigo')).toBe('AB CD&x=1')
    expect(doCodigo.searchParams.has('x')).toBe(false)
  })
})
