import { InvalidConfigError, DomainException, summarizeError } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { redefinirMfaPeloOperador } from '../sessao/index.js'
import { abrirBancoDeOperacao, ArgumentoInvalido, autorDoComando, lerOperador, OperadorRecusado, type BancoDoComando, type SaidaDoComando } from './comando.js'

/**
 * Redefinição do MFA pelo operador, a pedido formal da escola (PRD, caso de borda "Único coordenador perde o app
 * autenticador e os códigos"; Tech Spec, seção 5, "Operador"):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:redefinir-mfa -- --usuario <uuid> --pedido <número do pedido>
 *
 * - `OPERADOR` e os argumentos são conferidos antes de abrir o banco; com operador ativo (A0), o `OPERADOR` precisa ser
 *   um deles, conferido como primeira instrução da transação, antes de ler o usuário.
 * - A escola vem do usuário, nunca do argumento. O registro vai para a auditoria de cada escola em que a conta tem
 *   usuário ativo, com `autor_operador`, a finalidade `pedido_formal_da_escola` e o número do pedido.
 * - O pedido é um número (o protocolo do pedido formal da escola), nunca texto: a auditoria fica cinco anos e não
 *   aceita texto livre, que é onde o nome entra.
 * - Imprime só "ok" ou o código do erro. Nunca nome, e-mail nem escola: o operador não lê dado de pessoa (PRD, papel
 *   do operador).
 */

export interface PedidoDeRedefinicao {
  readonly usuarioId: string
  readonly pedido: number
}

const esquemaPedido = z.coerce.number().int().positive().max(2_147_483_647)

export function lerPedidoDeRedefinicao(argumentos: string[]): PedidoDeRedefinicao {
  let valores: { usuario?: string | undefined; pedido?: string | undefined }
  try {
    valores = parseArgs({ args: argumentos, options: { usuario: { type: 'string' }, pedido: { type: 'string' } }, strict: true, allowPositionals: false }).values
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new ArgumentoInvalido('--usuario ou --pedido')
  }
  const usuario = z.uuid().safeParse(valores.usuario)
  if (!usuario.success) throw new ArgumentoInvalido('--usuario')
  const pedido = /^\d{1,10}$/.test(valores.pedido ?? '') ? esquemaPedido.safeParse(valores.pedido) : undefined
  if (pedido?.success !== true) throw new ArgumentoInvalido('--pedido')
  return { usuarioId: usuario.data.toLowerCase(), pedido: pedido.data }
}

/**
 * Executa o comando e devolve o código de saída: 0 redefinido, 1 erro (`NAO_ENCONTRADO` ou `ERRO_INTERNO` resumido), 2
 * argumento ou ambiente inválido.
 */
export async function executarOpsRedefinirMfa(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: SaidaDoComando,
  abrirBanco: (ambiente: Record<string, string | undefined>) => BancoDoComando = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDeRedefinicao(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      await redefinirMfaPeloOperador(banco, autorDoComando(operador), pedido.usuarioId, pedido.pedido)
      terminal.saida('ok\n')
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (erro instanceof ArgumentoInvalido || erro instanceof InvalidConfigError || erro instanceof OperadorRecusado) {
      // Só o nome da opção ou da variável: nunca o valor.
      terminal.erro(`${erro.message}\n`)
      return 2
    }
    if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) {
      terminal.erro(`${ErrorCode.NAO_ENCONTRADO}\n`)
      return 1
    }
    // O erro cru do Postgres traz o valor da linha na mensagem e no `detail`: sai só o resumo seguro.
    terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(summarizeError(erro))}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsRedefinirMfa(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
