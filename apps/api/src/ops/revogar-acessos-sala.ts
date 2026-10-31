import { InvalidConfigError, DomainException, runInContext, AuditoriaRecorder, summarizeError, type Database } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { AcessoDaTurmaRepository } from '../sala/acesso-da-turma/acesso-da-turma.repository.js'
import { AcessoDaEscolaRepository } from '../credencial/index.js'
import { abrirBancoDeOperacao, InvalidArgumentError, autorDoComando, lerOperador, OperadorRejectedError, type CommandDatabase, type CommandOutput } from './command.js'
import type { AuthorCheck } from '../sessao/index.js'

const registro = new AuditoriaRecorder()

/**
 * A resposta do operador ao alerta "Código da turma errado em massa numa escola" (A1, tarefa 9.0; Tech Spec da A1,
 * seções 6 e 7c; runbook, entrada de mesmo nome):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:revogar-acessos-sala -- --escola <escolaId do log sala.limite_atingido>
 *
 * - O id da escola é o `escolaId` que a linha `sala.limite_atingido` do log traz: o comando não lê IP, slug nem código.
 * - O contexto é o da escola do id, como os outros `ops:*`, e a revogação passa pelo `AcessoDaTurmaRepository`, com o
 *   escopo dela: nenhum `@Unscoped` novo.
 * - Revoga na hora todo link e código vigente da escola, de todas as turmas, e grava um `acesso_turma.revogado` por acesso
 *   na auditoria dela, com `autor_operador`, na mesma transação. Imprime só a contagem.
 * - A segunda execução revoga zero. Escola inexistente: `NAO_ENCONTRADO`. Id que não é UUID: `InvalidArgumentError`, saída 2.
 */

/** A opção do comando: é o nome do campo do log que o runbook manda copiar. */
export const OPCAO_DA_ESCOLA = 'escola'

export function lerEscolaARevogar(argumentos: string[]): string {
  let valores: { escola?: string | undefined }
  try {
    valores = parseArgs({ args: argumentos, options: { [OPCAO_DA_ESCOLA]: { type: 'string' } }, strict: true, allowPositionals: false }).values
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com a opção aceita.
    throw new InvalidArgumentError(`--${OPCAO_DA_ESCOLA}`)
  }
  const escola = z.uuid().safeParse(valores.escola)
  if (!escola.success) throw new InvalidArgumentError(`--${OPCAO_DA_ESCOLA}`)
  return escola.data.toLowerCase()
}

/**
 * Revoga os acessos vigentes da escola, numa transação que começa pela conferência do autor (Tech Spec da A0b, seção 7c,
 * "Autor ativo"): nada é lido nem gravado antes dela. Devolve quantos acessos caíram.
 */
export function revogarAcessosDaEscola(banco: Database, autor: AuthorCheck, escolaId: string): Promise<number> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      return runInContext({ requisicaoId, escolaId }, async () => {
        if ((await new AcessoDaEscolaRepository(tx).nome()) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        const revogados = await new AcessoDaTurmaRepository(tx).revogarVigentesDaEscola()
        for (const { id, turmaId } of revogados) await registro.gravar(tx, 'acesso_turma.revogado', { entidadeId: id, depois: { turmaId }, autorOperador })
        return revogados.length
      })
    }),
  )
}

/**
 * Executa o comando e devolve o código de saída: 0 revogado (também zero acessos), 1 escola inexistente ou erro, 2
 * argumento ou ambiente inválido, ou `OPERADOR` que não é operador ativo. Argumento e formato do `OPERADOR` são conferidos
 * antes de abrir o banco.
 */
export async function executarOpsRevogarAcessosSala(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const escolaId = lerEscolaARevogar(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      const revogados = await revogarAcessosDaEscola(banco, autorDoComando(operador), escolaId)
      terminal.saida(`${JSON.stringify({ revogados })}\n`)
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
      terminal.erro(`${erro.message}\n`)
      return 2
    }
    if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) {
      terminal.erro(`${erro.codigo}\n`)
      return 1
    }
    terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(summarizeError(erro))}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsRevogarAcessosSala(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
