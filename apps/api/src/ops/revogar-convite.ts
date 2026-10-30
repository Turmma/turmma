import { ConfiguracaoInvalida, ErroDeDominio, resumirErro } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { revogarConvitePeloOperador } from '../sessao/index.js'
import { abrirBancoDeOperacao, ArgumentoInvalido, autorDoComando, lerOperador, OperadorRecusado, type BancoDoComando, type SaidaDoComando } from './comando.js'

/**
 * A revogação do convite pelo operador (regra 20, item 8; RF19):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:revogar-convite -- --convite <uuid>
 *
 * - A escola vem do convite, nunca do argumento, e o registro `convite.revogado` vai para a auditoria dela, com
 *   `autor_operador`.
 * - É o mesmo caso de uso do revogar do painel da operação (A0b), com a trava da escola e a matriz estado × ação.
 * - Imprime só "ok" ou o código do erro. Convite inexistente, de outro tipo ou já revogado: `NAO_ENCONTRADO`. Convite que
 *   não é o último da escola, ou escola com coordenação ativa ou desativada depois do aceite: `CONFLITO`.
 */

export function lerConviteARevogar(argumentos: string[]): string {
  let valores: { convite?: string | undefined }
  try {
    valores = parseArgs({ args: argumentos, options: { convite: { type: 'string' } }, strict: true, allowPositionals: false }).values
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com a opção aceita.
    throw new ArgumentoInvalido('--convite')
  }
  const convite = z.uuid().safeParse(valores.convite)
  if (!convite.success) throw new ArgumentoInvalido('--convite')
  return convite.data.toLowerCase()
}

/** Executa o comando e devolve o código de saída: 0 revogado, 1 erro, 2 argumento ou ambiente inválido. */
export async function executarOpsRevogarConvite(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: SaidaDoComando,
  abrirBanco: (ambiente: Record<string, string | undefined>) => BancoDoComando = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const conviteId = lerConviteARevogar(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      await revogarConvitePeloOperador(banco, autorDoComando(operador), conviteId)
      terminal.saida('ok\n')
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (erro instanceof ArgumentoInvalido || erro instanceof ConfiguracaoInvalida || erro instanceof OperadorRecusado) {
      terminal.erro(`${erro.message}\n`)
      return 2
    }
    if (erro instanceof ErroDeDominio && (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.CONFLITO)) {
      terminal.erro(`${erro.codigo}\n`)
      return 1
    }
    terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(resumirErro(erro))}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsRevogarConvite(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
