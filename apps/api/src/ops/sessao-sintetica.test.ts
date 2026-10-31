import { describe, expect, it } from 'vitest'
import { ArgumentoInvalido } from './command.js'
import { ArgumentoInvalido as ArgumentoInvalidoReexportado, lerPedidoDeSessao } from './sessao-sintetica.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'

describe('lerPedidoDeSessao', () => {
  it('a escola sai em minúsculas, e a quantidade padrão é uma', () => {
    expect(lerPedidoDeSessao(['--escola', ESCOLA_A.toUpperCase(), '--papel', 'aluno'])).toEqual({ escolaId: ESCOLA_A, papel: 'aluno', quantidade: 1 })
  })

  it.each([
    ['sem --escola', ['--papel', 'aluno'], '--escola'],
    ['papel fora da lista', ['--escola', ESCOLA_A, '--papel', 'diretor'], '--papel'],
    ['quantidade zero', ['--escola', ESCOLA_A, '--papel', 'aluno', '--quantidade', '0'], '--quantidade'],
    ['opção desconhecida', ['--escola', ESCOLA_A, '--papel', 'aluno', '--senha', 'segredo_sintetico'], '--escola, --papel ou --quantidade'],
  ])('%s: recusa citando só a opção, com o ArgumentoInvalido de comando.ts', (_caso, argumentos, opcao) => {
    expect(() => lerPedidoDeSessao(argumentos)).toThrow(ArgumentoInvalido)
    expect(() => lerPedidoDeSessao(argumentos)).toThrow(new ArgumentoInvalido(opcao))
    expect(() => lerPedidoDeSessao(argumentos)).not.toThrow(/segredo_sintetico/)
  })

  it('o ArgumentoInvalido reexportado é o de comando.ts: uma classe só', () => {
    expect(ArgumentoInvalidoReexportado).toBe(ArgumentoInvalido)
  })
})
