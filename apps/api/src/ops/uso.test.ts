import { InvalidConfigError } from '@educa/core'
import { describe, expect, it, vi } from 'vitest'
import { ArgumentoInvalido as ArgumentoInvalidoDoComando } from './comando.js'
import { ArgumentoInvalido, executarOpsUso, lerPedidoDeUso, urlDoBancoDeOperacao } from './uso.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
// 01h de 01/01/2027 em São Paulo; em UTC já são 04h.
const relogio = { agora: () => new Date('2027-01-01T01:00:00-03:00') }

describe('lerPedidoDeUso', () => {
  it('sem --dia, vale o último dia fechado em São Paulo, e o mês dele', () => {
    expect(lerPedidoDeUso(['--escola', ESCOLA_A], relogio)).toEqual({ escolaId: ESCOLA_A, dia: '2026-12-31', mes: '2026-12' })
  })

  it('--dia e --mes escolhem o período, e a escola sai em minúsculas', () => {
    expect(lerPedidoDeUso(['--escola', ESCOLA_A.toUpperCase(), '--dia', '2026-09-15', '--mes', '2026-08'], relogio)).toEqual({
      escolaId: ESCOLA_A,
      dia: '2026-09-15',
      mes: '2026-08',
    })
  })

  it.each([
    ['sem --escola', [], '--escola'],
    ['escola que não é UUID', ['--escola', '1837'], '--escola'],
    ['dia inexistente', ['--escola', ESCOLA_A, '--dia', '2026-02-30'], '--dia'],
    ['dia em outro formato', ['--escola', ESCOLA_A, '--dia', '15/09/2026'], '--dia'],
    ['mês inválido', ['--escola', ESCOLA_A, '--mes', '2026-13'], '--mes'],
  ])('%s: recusa citando só a opção', (_caso, argumentos, opcao) => {
    expect(() => lerPedidoDeUso(argumentos, relogio)).toThrow(new ArgumentoInvalido(opcao))
  })

  it('o ArgumentoInvalido do uso é o de comando.ts, uma classe só, com a mensagem de sempre no terminal', () => {
    expect(ArgumentoInvalido).toBe(ArgumentoInvalidoDoComando)
    expect(() => lerPedidoDeUso([], relogio)).toThrow(ArgumentoInvalidoDoComando)
    expect(() => lerPedidoDeUso([], relogio)).toThrow('Opção inválida ou ausente: --escola')
  })

  it('opção desconhecida não repete o valor recebido na mensagem', () => {
    expect(() => lerPedidoDeUso(['--escola', ESCOLA_A, '--senha', 'segredo_sintetico'], relogio)).toThrow(ArgumentoInvalido)
    expect(() => lerPedidoDeUso(['--escola', ESCOLA_A, '--senha', 'segredo_sintetico'], relogio)).toThrow('Opção inválida ou ausente: --escola, --dia ou --mes')
    expect(() => lerPedidoDeUso(['--escola', ESCOLA_A, '--senha', 'segredo_sintetico'], relogio)).not.toThrow(/segredo_sintetico/)
  })
})

describe('urlDoBancoDeOperacao', () => {
  const prazos = { BANCO_TIMEOUT_CONEXAO_MS: '2000', BANCO_TIMEOUT_CONSULTA_MS: '2000' }

  it('no container usa o BANCO_URL do serviço', () => {
    expect(urlDoBancoDeOperacao({ ...prazos, BANCO_URL: 'postgres://educa:sintetica@postgres:5432/educa' }).url).toBe('postgres://educa:sintetica@postgres:5432/educa')
  })

  it('na máquina, com .env.example, monta a URL do Postgres local do compose', () => {
    const ambiente = { ...prazos, POSTGRES_USUARIO: 'educa', POSTGRES_SENHA: 'senha sintética', POSTGRES_BANCO: 'educa', POSTGRES_PORTA_HOST: '55432' }
    expect(urlDoBancoDeOperacao(ambiente).url).toBe('postgres://educa:senha%20sint%C3%A9tica@127.0.0.1:55432/educa')
  })

  it('sem nenhum dos dois, recusa pelo nome da variável, sem valor', () => {
    expect(() => urlDoBancoDeOperacao({ ...prazos, POSTGRES_SENHA: 'segredo_sintetico' })).toThrow(InvalidConfigError)
    expect(() => urlDoBancoDeOperacao({ ...prazos, POSTGRES_SENHA: 'segredo_sintetico' })).not.toThrow(/segredo_sintetico/)
  })
})

describe('executarOpsUso: desde a A0 lê o OPERADOR, conferido antes de abrir o banco', () => {
  it.each([
    ['sem OPERADOR', {}],
    ['OPERADOR fora do formato', { OPERADOR: 'Joaquim Paes' }],
  ])('%s: sai com 2 pelo nome da variável, sem abrir o banco', async (_caso, ambiente) => {
    const abrirBanco = vi.fn()
    let erro = ''
    const codigo = await executarOpsUso(['--escola', ESCOLA_A], ambiente, { saida: () => undefined, erro: (texto) => (erro += texto) }, abrirBanco)
    expect(codigo).toBe(2)
    expect(erro).toBe(`${new InvalidConfigError(['OPERADOR']).message}\n`)
    expect(abrirBanco).not.toHaveBeenCalled()
  })
})
