import { describe, expect, it, vi } from 'vitest'
import { ArgumentoInvalido } from './command.js'
import { executarOpsRedefinirMfa, lerPedidoDeRedefinicao } from './redefinir-mfa.js'

const USUARIO = '0190f5a0-0000-7000-8000-0000000000d1'

describe('lerPedidoDeRedefinicao', () => {
  it('o usuário (em minúsculas) e o número do pedido', () => {
    expect(lerPedidoDeRedefinicao(['--usuario', USUARIO.toUpperCase(), '--pedido', '2026091801'])).toEqual({ usuarioId: USUARIO, pedido: 2_026_091_801 })
  })

  it.each([
    ['usuário que não é UUID', ['--usuario', '1837', '--pedido', '12'], '--usuario'],
    ['sem usuário', ['--pedido', '12'], '--usuario'],
    ['pedido em texto livre', ['--usuario', USUARIO, '--pedido', 'e-mail da diretora Renata'], '--pedido'],
    ['pedido zero', ['--usuario', USUARIO, '--pedido', '0'], '--pedido'],
    ['pedido negativo', ['--usuario', USUARIO, '--pedido=-5'], '--pedido'],
    ['pedido fracionário', ['--usuario', USUARIO, '--pedido', '1.5'], '--pedido'],
    ['pedido grande demais', ['--usuario', USUARIO, '--pedido', '99999999999'], '--pedido'],
    ['sem pedido', ['--usuario', USUARIO], '--pedido'],
    ['opção desconhecida', ['--usuario', USUARIO, '--pedido', '12', '--email', 'coordenacao@escola.invalid'], '--usuario ou --pedido'],
    ['posicional', ['redefinir', '--usuario', USUARIO, '--pedido', '12'], '--usuario ou --pedido'],
  ])('%s: recusa citando só a opção, sem o valor', (_caso, argumentos, opcao) => {
    const ler = () => lerPedidoDeRedefinicao(argumentos)
    expect(ler).toThrow(new ArgumentoInvalido(opcao))
    expect(ler).not.toThrow(/Renata|escola\.invalid/)
  })
})

describe('executarOpsRedefinirMfa: argumento e OPERADOR conferidos antes de abrir o banco', () => {
  it.each([
    ['argumento inválido', ['--usuario', 'x', '--pedido', '12'], { OPERADOR: 'joaquim' }],
    ['sem OPERADOR', ['--usuario', USUARIO, '--pedido', '12'], {}],
  ])('%s: sai com 2 e não abre o banco', async (_caso, argumentos, ambiente) => {
    const abrirBanco = vi.fn()
    let erro = ''
    const codigo = await executarOpsRedefinirMfa(argumentos, ambiente, { saida: () => undefined, erro: (texto) => (erro += texto) }, abrirBanco)
    expect(codigo).toBe(2)
    expect(abrirBanco).not.toHaveBeenCalled()
    expect(erro).not.toContain(USUARIO)
  })
})
