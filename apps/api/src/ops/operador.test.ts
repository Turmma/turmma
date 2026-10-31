import { InvalidConfigError } from '@educa/core'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { ArgumentoInvalido } from './comando.js'
import { executarOpsOperador, lerPedidoDeOperador } from './operador.js'

const NOME = 'Pessoa Sintética da Equipe'
const EMAIL = 'pessoa.sintetica@turmma.invalid'

describe('ops:operador: leitura do pedido (U1: o apelido segue o FORMATO_OPERADOR)', () => {
  it('criar, desativar e convite leem só as opções de cada um, com o e-mail em minúsculas e a saída absoluta', () => {
    expect(lerPedidoDeOperador(['criar', '--apelido', 'gabriel-s', '--nome', NOME, '--email', 'Pessoa.Sintetica@Turmma.invalid', '--saida', 'token.txt'])).toEqual({
      acao: 'criar',
      apelido: 'gabriel-s',
      nome: NOME,
      email: EMAIL,
      saida: resolve('token.txt'),
    })
    expect(lerPedidoDeOperador(['desativar', '--apelido', 'joaquim'])).toEqual({ acao: 'desativar', apelido: 'joaquim' })
    expect(lerPedidoDeOperador(['convite', '--apelido', 'joaquim', '--saida', 'novo.txt'])).toEqual({ acao: 'convite', apelido: 'joaquim', saida: resolve('novo.txt') })
  })

  it.each([
    ['maiúscula', 'Joaquim'],
    ['começa com número', '1joaquim'],
    ['um caractere só', 'j'],
    ['33 caracteres', `j${'a'.repeat(32)}`],
    ['espaço', 'joaquim paes'],
    ['e-mail', 'joaquim@turmma.com'],
    ['vazio', ''],
  ])('apelido fora do FORMATO_OPERADOR (%s) é recusado citando só a opção', (_caso, apelido) => {
    const ler = () => lerPedidoDeOperador(['desativar', '--apelido', apelido])
    expect(ler).toThrow(new ArgumentoInvalido('--apelido'))
    if (apelido !== '') expect(ler).not.toThrow(apelido)
  })

  it('o limite do formato passa: 2 e 32 caracteres, com hífen e número', () => {
    expect(lerPedidoDeOperador(['desativar', '--apelido', 'jo']).apelido).toBe('jo')
    expect(lerPedidoDeOperador(['desativar', '--apelido', `j${'a'.repeat(30)}-`]).apelido).toHaveLength(32)
  })

  it('"rotina" está no formato, mas é o autor reservado da eliminação e do expurgo e não vira apelido', () => {
    for (const acao of ['criar', 'desativar', 'convite']) {
      const resto = acao === 'criar' ? ['--nome', NOME, '--email', EMAIL, '--saida', 'x.txt'] : acao === 'convite' ? ['--saida', 'x.txt'] : []
      expect(() => lerPedidoDeOperador([acao, '--apelido', 'rotina', ...resto]), acao).toThrow(new ArgumentoInvalido('--apelido'))
    }
  })

  it('"bootstrap" está no formato, mas é o autor reservado do nascimento e não vira apelido', () => {
    expect(() => lerPedidoDeOperador(['criar', '--apelido', 'bootstrap', '--nome', NOME, '--email', EMAIL, '--saida', 'x.txt'])).toThrow(new ArgumentoInvalido('--apelido'))
  })

  it.each([
    ['sem subcomando', ['--apelido', 'joaquim'], 'comando (criar | desativar | convite)'],
    ['subcomando desconhecido', ['listar', '--apelido', 'joaquim'], 'comando (criar | desativar | convite)'],
    ['dois subcomandos', ['criar', 'desativar', '--apelido', 'joaquim'], 'comando (criar | desativar | convite)'],
    ['desativar com --saida', ['desativar', '--apelido', 'joaquim', '--saida', 'x.txt'], '--saida não vale para desativar'],
    ['convite com --email', ['convite', '--apelido', 'joaquim', '--saida', 'x.txt', '--email', EMAIL], '--email não vale para convite'],
    ['criar sem --saida', ['criar', '--apelido', 'joaquim', '--nome', NOME, '--email', EMAIL], '--saida'],
    ['criar sem --nome', ['criar', '--apelido', 'joaquim', '--email', EMAIL, '--saida', 'x.txt'], '--nome'],
    ['criar com e-mail inválido', ['criar', '--apelido', 'joaquim', '--nome', NOME, '--email', 'sem-arroba', '--saida', 'x.txt'], '--email'],
    ['convite sem --saida', ['convite', '--apelido', 'joaquim'], '--saida'],
  ])('%s: recusado pela opção', (_caso, argumentos, opcao) => {
    expect(() => lerPedidoDeOperador(argumentos)).toThrow(new ArgumentoInvalido(opcao))
  })

  it('opção desconhecida não repete o valor recebido', () => {
    const ler = () => lerPedidoDeOperador(['desativar', '--apelido', 'joaquim', '--senha', 'segredo_sintetico'])
    expect(ler).toThrow(ArgumentoInvalido)
    expect(ler).not.toThrow(/segredo_sintetico/)
  })
})

describe('executarOpsOperador: argumento e OPERADOR conferidos antes de abrir o banco e de criar o arquivo', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'ops-operador-'))
  afterAll(() => rmSync(pasta, { recursive: true, force: true }))

  it.each([
    ['sem OPERADOR', {}],
    ['OPERADOR fora do formato', { OPERADOR: 'Joaquim Paes <joaquim@turmma.com>' }],
  ])('%s: sai com 2, sem abrir o banco, sem arquivo e sem nome nem e-mail no terminal', async (_caso, ambiente) => {
    const abrirBanco = vi.fn()
    const saida = join(pasta, `token-${String(Math.random()).slice(2)}.txt`)
    let erro = ''
    const codigo = await executarOpsOperador(['criar', '--apelido', 'joaquim', '--nome', NOME, '--email', EMAIL, '--saida', saida], ambiente, { saida: () => undefined, erro: (texto) => (erro += texto) }, abrirBanco)
    expect(codigo).toBe(2)
    expect(erro).toBe(`${new InvalidConfigError(['OPERADOR']).message}\n`)
    expect(abrirBanco).not.toHaveBeenCalled()
    expect(existsSync(saida)).toBe(false)
    for (const proibido of [NOME, EMAIL, 'Joaquim Paes']) expect(erro).not.toContain(proibido)
  })
})
