import { InvalidConfigError } from '@educa/core'
import { describe, expect, it } from 'vitest'
import { ArgumentoInvalido, lerOperador, lerPedidoDoOperador } from './escola.js'

const REDE = '0190f5a0-0000-7000-8000-0000000000e1'

describe('lerPedidoDoOperador', () => {
  it('rede criar e escola criar viram o pedido, com o nome aparado e a rede em minúsculas', () => {
    expect(lerPedidoDoOperador(['rede', 'criar', '--nome', '  Rede Municipal Sintética ', '--tipo', 'prefeitura'])).toEqual({
      entidade: 'rede',
      nome: 'Rede Municipal Sintética',
      tipo: 'prefeitura',
    })
    expect(lerPedidoDoOperador(['escola', 'criar', '--rede', REDE.toUpperCase(), '--nome', 'Colégio Sintético', '--slug', 'colegio-horizonte-2'])).toEqual({
      entidade: 'escola',
      redeId: REDE,
      nome: 'Colégio Sintético',
      slug: 'colegio-horizonte-2',
    })
  })

  // O endereço da escola escrito de três jeitos, como a turma na planilha suja.
  it.each(['Colégio Horizonte', 'colegio_horizonte', 'COLEGIO-HORIZONTE', 'colegio--horizonte', 'colegio-', 'a'.repeat(64)])('slug "%s" é recusado, sem o valor na mensagem', (slug) => {
    const pedido = () => lerPedidoDoOperador(['escola', 'criar', '--rede', REDE, '--nome', 'Colégio Sintético', '--slug', slug])
    expect(pedido).toThrow(new ArgumentoInvalido('--slug'))
    expect(pedido).not.toThrow(slug)
  })

  it.each([
    ['tipo fora da lista', ['rede', 'criar', '--nome', 'Rede Sintética', '--tipo', 'municipal'], '--tipo'],
    ['rede sem nome', ['rede', 'criar', '--tipo', 'grupo'], '--nome'],
    ['nome em branco', ['rede', 'criar', '--nome', '   ', '--tipo', 'grupo'], '--nome'],
    ['nome com quebra de linha', ['rede', 'criar', '--nome', 'Rede\nSintética', '--tipo', 'grupo'], '--nome'],
    ['rede que não é UUID', ['escola', 'criar', '--rede', '1837', '--nome', 'Colégio Sintético', '--slug', 'colegio'], '--rede'],
    ['slug na rede', ['rede', 'criar', '--nome', 'Rede Sintética', '--tipo', 'grupo', '--slug', 'rede'], '--rede e --slug não valem para rede'],
    ['tipo na escola', ['escola', 'criar', '--rede', REDE, '--nome', 'Colégio Sintético', '--slug', 'colegio', '--tipo', 'grupo'], '--tipo não vale para escola'],
    ['comando desconhecido', ['escola', 'listar'], 'comando (rede criar | escola criar)'],
    ['sem comando', [], 'comando (rede criar | escola criar)'],
  ])('%s: recusa citando só a opção', (_caso, argumentos, opcao) => {
    expect(() => lerPedidoDoOperador(argumentos)).toThrow(new ArgumentoInvalido(opcao))
  })

  it('opção desconhecida não repete o valor recebido na mensagem', () => {
    const pedido = () => lerPedidoDoOperador(['rede', 'criar', '--nome', 'Rede Sintética', '--tipo', 'grupo', '--matricula', 'segredo_sintetico'])
    // A mensagem é a nossa, fixa: repassar a do parseArgs quebraria aqui.
    expect(pedido).toThrow(new ArgumentoInvalido('--nome, --tipo, --rede ou --slug'))
  })
})

describe('lerOperador', () => {
  it('aceita o identificador curto da pessoa da equipe', () => {
    expect(lerOperador({ OPERADOR: 'gabriel-s' })).toBe('gabriel-s')
  })

  it.each([undefined, '', 'Joaquim', 'joaquim@educa.ia', 'j', 'a'.repeat(33)])('"%s" é recusado pelo nome da variável, sem o valor', (operador) => {
    expect(() => lerOperador({ OPERADOR: operador })).toThrow(new InvalidConfigError(['OPERADOR']))
    if (operador !== undefined && operador !== '') expect(() => lerOperador({ OPERADOR: operador })).not.toThrow(operador)
  })
})
