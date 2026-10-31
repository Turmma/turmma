import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { InvalidArgumentError } from './command.js'
import { executarOpsConviteCoordenador, lerPedidoDoConvite } from './convite-coordenador.js'
import { executarOpsRevogarConvite, lerConviteARevogar } from './revogar-convite.js'

const EMAIL = 'Renata.Coordenadora@Escola.Invalid'
const NOME = 'Renata Sintética'
const validos = ['--escola', 'colegio-horizonte', '--email', EMAIL, '--nome', NOME, '--saida', 'convite.txt']

function trocar(opcao: string, valor: string): string[] {
  const argumentos = [...validos]
  argumentos[argumentos.indexOf(opcao) + 1] = valor
  return argumentos
}

describe('ops:convite-coordenador: leitura do pedido', () => {
  it('vira o pedido, com o e-mail em minúsculas e a saída em caminho absoluto', () => {
    expect(lerPedidoDoConvite(validos)).toEqual({ slug: 'colegio-horizonte', email: 'renata.coordenadora@escola.invalid', nome: NOME, saida: resolve('convite.txt') })
  })

  it.each([
    ['endereço fora do formato', trocar('--escola', 'Colégio Horizonte'), '--escola'],
    ['e-mail inválido', trocar('--email', 'renata-sem-arroba'), '--email'],
    ['nome com quebra de linha', trocar('--nome', 'Renata\nSintética'), '--nome'],
    ['nome vazio', trocar('--nome', '   '), '--nome'],
    ['saída vazia', trocar('--saida', ' '), '--saida'],
    ['sem saída', validos.slice(0, 6), '--saida'],
  ])('%s é recusado pelo nome da opção, sem o valor', (_caso, argumentos, opcao) => {
    const pedido = () => lerPedidoDoConvite(argumentos)
    expect(pedido).toThrow(new InvalidArgumentError(opcao))
    for (const valor of argumentos.filter((argumento) => !argumento.startsWith('--') && argumento.trim().length > 2)) expect(pedido).not.toThrow(valor)
  })

  it('opção desconhecida é recusada sem repetir o que veio', () => {
    const pedido = () => lerPedidoDoConvite([...validos, '--token', 'valor-secreto'])
    expect(pedido).toThrow(InvalidArgumentError)
    expect(pedido).not.toThrow('valor-secreto')
  })

  it('sem OPERADOR, sai com 2 antes de abrir o banco e de criar o arquivo, sem e-mail nem nome no terminal', async () => {
    let saida = ''
    let erro = ''
    let abriu = false
    const codigo = await executarOpsConviteCoordenador(
      trocar('--saida', '/caminho/que/nao/existe/convite.txt'),
      {},
      { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) },
      () => {
        abriu = true
        throw new Error('não deveria abrir o banco')
      },
    )
    expect(codigo).toBe(2)
    expect(abriu).toBe(false)
    expect(saida).toBe('')
    expect(erro).toContain('OPERADOR')
    for (const proibido of [EMAIL, EMAIL.toLowerCase(), NOME]) expect(erro).not.toContain(proibido)
  })
})

describe('ops:revogar-convite: leitura do pedido', () => {
  it('aceita só o uuid do convite, em minúsculas', () => {
    expect(lerConviteARevogar(['--convite', '0190F5A0-0000-7000-8000-0000000000E1'])).toBe('0190f5a0-0000-7000-8000-0000000000e1')
  })

  it.each([[['--convite', 'colegio-horizonte']], [[]], [['--convite', '0190f5a0-0000-7000-8000-0000000000e1', '--escola', 'x']]])('%j é recusado com 2, sem abrir o banco', async (argumentos) => {
    let erro = ''
    const codigo = await executarOpsRevogarConvite(argumentos, { OPERADOR: 'operador-teste' }, { saida: () => undefined, erro: (texto) => (erro += texto) }, () => {
      throw new Error('não deveria abrir o banco')
    })
    expect(codigo).toBe(2)
    expect(erro).toBe('Opção inválida ou ausente: --convite\n')
  })
})
