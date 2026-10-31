// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fecharSeAindaAberta, proximaAbertura, useDialogoDaTela } from './dialog-state'

describe('a resposta de um pedido fecha só a abertura em que ele saiu (correção 2026-09-25-resposta-atrasada-fecha-o-dialogo-reaberto)', () => {
  it('cancelar e reabrir o mesmo diálogo dá outra abertura, e a resposta da primeira não fecha a segunda', () => {
    const primeira = proximaAbertura('escola', 0)
    const segunda = proximaAbertura('escola', primeira.numero)
    expect(segunda.tipo).toBe(primeira.tipo)
    expect(segunda.numero).not.toBe(primeira.numero)
    expect(fecharSeAindaAberta(segunda, primeira)).toBe(segunda)
  })

  it('a resposta com outro diálogo aberto também não o fecha', () => {
    const escola = proximaAbertura('escola', 0)
    const rede = proximaAbertura('rede', escola.numero)
    expect(fecharSeAindaAberta<'escola' | 'rede'>(rede, escola)).toBe(rede)
  })

  it('a resposta com a própria abertura ainda aberta a fecha', () => {
    const aberta = proximaAbertura('rede', 3)
    expect(fecharSeAindaAberta(aberta, aberta)).toBeUndefined()
    // A mesma abertura vista por outro objeto (um render depois) continua sendo ela: vale o número.
    expect(fecharSeAindaAberta({ ...aberta }, aberta)).toBeUndefined()
  })

  it('com nada aberto, a resposta atrasada não abre nada', () => {
    expect(fecharSeAindaAberta(undefined, proximaAbertura('escola', 0))).toBeUndefined()
  })
})

describe('a abertura do convite leva a escola da linha (tarefa 7.0)', () => {
  it('o alvo fica preso à abertura: a de outra escola é outra abertura, e a resposta da primeira não a fecha', () => {
    const escolaA = { id: 'a', nome: 'Escola A' }
    const escolaB = { id: 'b', nome: 'Escola B' }
    const primeira = proximaAbertura('revogar', 0, escolaA)
    const segunda = proximaAbertura('revogar', primeira.numero, escolaB)
    expect(primeira.alvo).toBe(escolaA)
    expect(segunda.alvo).toBe(escolaB)
    expect(fecharSeAindaAberta(segunda, primeira)).toBe(segunda)
    // Sem alvo (Nova rede, Nova escola), a abertura não ganha o campo.
    expect(proximaAbertura('rede', 0)).toEqual({ tipo: 'rede', numero: 1 })
  })
})

describe('o diálogo aberto desde a montagem (telas do professor, 13.0)', () => {
  it('sem pedido, nada abre; com o tipo, a primeira renderização já o traz aberto, como a primeira abertura da tela', () => {
    expect(renderHook(() => useDialogoDaTela<'convidar'>()).result.current.aberta).toBeUndefined()
    expect(renderHook(() => useDialogoDaTela<'convidar'>(undefined)).result.current.aberta).toBeUndefined()
    expect(renderHook(() => useDialogoDaTela<'convidar'>('convidar')).result.current.aberta).toEqual({ tipo: 'convidar', numero: 1 })
  })

  it('a abertura seguinte conta a partir da de montagem: a resposta do pedido da primeira não fecha a segunda', () => {
    const { result } = renderHook(() => useDialogoDaTela<'convidar'>('convidar'))
    const primeira = result.current.aberta
    if (primeira === undefined) throw new Error('o diálogo da montagem não abriu')
    act(() => result.current.fechar())
    expect(result.current.aberta).toBeUndefined()
    act(() => result.current.abrir('convidar'))
    expect(result.current.aberta?.numero).toBe(2)
    act(() => result.current.fecharSeAinda(primeira))
    expect(result.current.aberta?.numero).toBe(2)
  })
})
