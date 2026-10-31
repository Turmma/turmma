import { describe, expect, it } from 'vitest'
import { InvalidArgumentError } from './command.js'
import { executarOpsRevogarAcessosSala, lerEscolaARevogar } from './revogar-acessos-sala.js'

/**
 * O leitor de argumentos do `ops:revogar-acessos-sala` e as recusas antes do banco (A1, tarefa 9.0; E29 e L11 de
 * `tasks/prd-apresentacao-escola/cenarios.md`). A revogação no banco está em `apps/api/test/ops-revogar-acessos-sala.int.test.ts`;
 * a linha do log que entrega o id, em `infra/test/alertas.test.ts`.
 */

const ESCOLA = '0190f5a0-0000-7000-8000-00000000000a'

/** O banco que nenhum destes casos pode abrir: a recusa vem antes dele. */
const bancoProibido = () => {
  throw new Error('o comando abriu o banco antes de recusar')
}

async function rodar(argumentos: string[], ambiente: Record<string, string | undefined>) {
  let saida = ''
  let erro = ''
  const codigo = await executarOpsRevogarAcessosSala(argumentos, ambiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) }, bancoProibido)
  return { codigo, saida, erro }
}

describe('lerEscolaARevogar', () => {
  it('aceita o UUID da escola, em minúsculas, como o log o traz ou digitado em maiúsculas', () => {
    expect(lerEscolaARevogar(['--escola', ESCOLA])).toBe(ESCOLA)
    expect(lerEscolaARevogar(['--escola', ESCOLA.toUpperCase()])).toBe(ESCOLA)
  })

  it.each([
    ['sem --escola', []],
    ['escola que não é UUID', ['--escola', '1837']],
    ['o slug no lugar do id', ['--escola', 'colegio-sintetico']],
    ['argumento solto', [ESCOLA]],
  ])('%s: ArgumentoInvalido citando só a opção', (_caso, argumentos) => {
    expect(() => lerEscolaARevogar(argumentos)).toThrow(new InvalidArgumentError('--escola'))
  })

  it('opção desconhecida não repete o valor recebido na mensagem', () => {
    expect(() => lerEscolaARevogar(['--escola', ESCOLA, '--codigo', 'K7M2XQ9P'])).toThrow(InvalidArgumentError)
    expect(() => lerEscolaARevogar(['--escola', ESCOLA, '--codigo', 'K7M2XQ9P'])).not.toThrow(/K7M2XQ9P/)
  })
})

describe('executarOpsRevogarAcessosSala: recusa antes de tocar no banco', () => {
  it('sem OPERADOR, ou fora do formato, sai com 2 citando a variável, sem abrir o banco', async () => {
    for (const ambiente of [{}, { OPERADOR: 'Nome Com Espaço' }]) {
      const execucao = await rodar(['--escola', ESCOLA], ambiente)
      expect(execucao).toMatchObject({ codigo: 2, saida: '' })
      expect(execucao.erro).toContain('OPERADOR')
      expect(execucao.erro).not.toContain('Nome Com Espaço')
    }
  })

  it('id que não é UUID sai com 2, como os outros ops:*, sem abrir o banco nem repetir o valor', async () => {
    const execucao = await rodar(['--escola', 'nao-e-uuid'], { OPERADOR: 'joaquim' })
    expect(execucao).toEqual({ codigo: 2, saida: '', erro: 'Opção inválida ou ausente: --escola\n' })
  })
})
