import { describe, expect, it } from 'vitest'
import { InvalidArgumentError } from './command.js'
import { executarOpsReclassificarEscola, lerPedidoDeReclassificacao } from './reclassificar-escola.js'

/**
 * Os argumentos do `ops:reclassificar-escola` e as recusas antes de abrir o banco (classificacao-bncc, 7.0; D76; Tech Spec, seção 5, "Suspensão"). O que o comando faz no banco (só a escola dada, a correção que fica,
 * a função suspensa, os lotes e o sinal) está em `apps/api/test/classificacao-da-coordenacao.int.test.ts`.
 */
const ESCOLA = '0196c0a8-7b2c-7000-8000-000000000001'

const proibido = (o: string) => () => {
  throw new Error(`não podia abrir ${o}`)
}

async function rodar(argumentos: string[], ambiente: Record<string, string | undefined>): Promise<{ codigo: number; saida: string; erro: string }> {
  let saida = ''
  let erro = ''
  const codigo = await executarOpsReclassificarEscola(argumentos, ambiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) }, proibido('o banco') as never)
  return { codigo, saida, erro }
}

describe('lerPedidoDeReclassificacao', () => {
  it('lê a escola em minúsculas e o chamado como inteiro positivo', () => {
    expect(lerPedidoDeReclassificacao(['--escola', ESCOLA.toUpperCase(), '--chamado', '4711'])).toEqual({ escolaId: ESCOLA, chamado: 4711 })
  })

  it.each([
    ['sem --chamado', ['--escola', ESCOLA], '--chamado'],
    ['--chamado zero', ['--escola', ESCOLA, '--chamado', '0'], '--chamado'],
    ['--chamado texto', ['--escola', ESCOLA, '--chamado', 'pedido da diretora'], '--chamado'],
    ['--chamado decimal', ['--escola', ESCOLA, '--chamado', '1.5'], '--chamado'],
    ['--chamado com zero à esquerda', ['--escola', ESCOLA, '--chamado', '007'], '--chamado'],
    ['--chamado vazio', ['--escola', ESCOLA, '--chamado', ''], '--chamado'],
    ['sem --escola', ['--chamado', '7'], '--escola'],
    ['--escola que não é UUID', ['--escola', '1837', '--chamado', '7'], '--escola'],
  ])('%s: InvalidArgumentError citando só a opção', (_caso, argumentos, opcao) => {
    expect(() => lerPedidoDeReclassificacao(argumentos)).toThrow(new InvalidArgumentError(opcao))
  })

  it('opção desconhecida não repete o valor recebido na mensagem', () => {
    expect(() => lerPedidoDeReclassificacao(['--escola', ESCOLA, '--chamado', '7', '--material', 'Apostila da Ana'])).toThrow(new InvalidArgumentError('--escola e --chamado'))
  })
})

describe('o comando recusa antes de abrir o banco', () => {
  it('sem chamado (D76), com chamado fora do formato, e com OPERADOR ausente ou fora do formato: saem com 2, sem repetir o valor', async () => {
    expect(await rodar(['--escola', ESCOLA], { OPERADOR: 'joaquim' })).toEqual({ codigo: 2, saida: '', erro: 'Opção inválida ou ausente: --chamado\n' })
    expect(await rodar(['--escola', ESCOLA, '--chamado', 'abc'], { OPERADOR: 'joaquim' })).toMatchObject({ codigo: 2, saida: '' })
    for (const ambiente of [{}, { OPERADOR: 'Nome Com Espaço' }]) {
      const execucao = await rodar(['--escola', ESCOLA, '--chamado', '7'], ambiente)
      expect(execucao).toMatchObject({ codigo: 2, saida: '' })
      expect(execucao.erro).toContain('OPERADOR')
      expect(execucao.erro).not.toContain('Nome Com Espaço')
    }
  })
})
