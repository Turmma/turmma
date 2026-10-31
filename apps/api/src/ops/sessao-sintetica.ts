import { InvalidConfigError, createDatabase, createPool, DomainException, summarizeError, type Database } from '@educa/core'
import { ErrorCode, PAPEIS_DE_USUARIO, type PapelDeUsuario } from '@educa/shared'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { createSyntheticSessions, syntheticTokenIssuer, QUANTIDADE_MAXIMA_DE_SESSOES_SINTETICAS } from '../sessao/index.js'
import { InvalidArgumentError } from './command.js'
import { urlDoBancoDeOperacao } from './uso.js'

export { InvalidArgumentError }

/**
 * Sessão real para teste local, esteira e cenário de carga, na escola informada:
 *
 *   npm run -s ops:sessao-sintetica -- --escola <uuid> --papel aluno|professor|coordenador [--quantidade <n>]
 *
 * Cria `usuario` e `sessao` (e a conta sintética, para professor e coordenador) e imprime só os tokens, um por
 * linha, emitidos pelo `TokenIssuer`: valem 10 min, e a sessão, 12 h. Só roda com `AMBIENTE=local`, conferido
 * antes de abrir o banco. Nenhum dado de pessoa entra ou sai: o nome é fixo e sintético.
 */

export interface CommandOutput {
  saida: (texto: string) => void
  erro: (texto: string) => void
}

export interface CommandDatabase {
  banco: Database
  fechar: () => Promise<void>
}

/** Pool de uma conexão para o comando, com o banco do ambiente (`BANCO_URL` ou o Postgres da máquina). */
function abrirBancoDoAmbiente(ambiente: Record<string, string | undefined>): CommandDatabase {
  const pool = createPool({ ...urlDoBancoDeOperacao(ambiente), maximoConexoes: 1 }, () => undefined)
  return { banco: createDatabase(pool), fechar: () => pool.end() }
}

export interface CommandRequest {
  escolaId: string
  papel: PapelDeUsuario
  quantidade: number
}

export function lerPedidoDeSessao(argumentos: string[]): CommandRequest {
  let valores: { escola?: string; papel?: string; quantidade?: string }
  try {
    valores = parseArgs({
      args: argumentos,
      options: { escola: { type: 'string' }, papel: { type: 'string' }, quantidade: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }).values
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new InvalidArgumentError('--escola, --papel ou --quantidade')
  }
  if (valores.escola === undefined || !z.uuid().safeParse(valores.escola).success) throw new InvalidArgumentError('--escola')
  const papel = PAPEIS_DE_USUARIO.find((aceito) => aceito === valores.papel)
  if (papel === undefined) throw new InvalidArgumentError('--papel')
  const texto = valores.quantidade ?? '1'
  if (!/^[1-9][0-9]{0,3}$/.test(texto) || Number(texto) > QUANTIDADE_MAXIMA_DE_SESSOES_SINTETICAS) throw new InvalidArgumentError('--quantidade')
  return { escolaId: valores.escola.toLowerCase(), papel, quantidade: Number(texto) }
}

/**
 * Executa o comando e devolve o código de saída: 0 criado, 1 erro (`NAO_ENCONTRADO` para escola inexistente, ou
 * `ERRO_INTERNO` resumido), 2 argumento ou ambiente inválido, inclusive `AMBIENTE` diferente de `local` ou ausente.
 */
export async function executarOpsSessaoSintetica(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDoAmbiente,
): Promise<number> {
  try {
    const pedido = lerPedidoDeSessao(argumentos)
    // Antes de abrir o banco: fora do local, nem a conexão é aberta.
    syntheticTokenIssuer(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      const sessoes = await createSyntheticSessions(banco, ambiente, pedido)
      terminal.saida(`${sessoes.map((sessao) => sessao.token).join('\n')}\n`)
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError) {
      // Só o nome da opção ou da variável, e o motivo fixo nosso: nunca o valor, que pode ser a chave.
      terminal.erro(`${erro.message}\n`)
      return 2
    }
    if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) {
      terminal.erro(`${ErrorCode.NAO_ENCONTRADO}: escola não encontrada\n`)
      return 1
    }
    terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(summarizeError(erro))}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsSessaoSintetica(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
