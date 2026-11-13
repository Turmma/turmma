import { InvalidConfigError, DomainException, runInContext, summarizeError, mapPostgresError, type Database } from '@educa/core'
import { ErrorCode, JOB_DEFINITIONS } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { JobsQueFalharamRepository, type JobQueFalhou } from '../operacao/jobs-que-falharam.repository.js'
import { abrirBancoDeOperacao, InvalidArgumentError, autorDoComando, lerOperador, OperadorRejectedError, type CommandDatabase, type CommandOutput } from './command.js'
import type { AuthorCheck } from '../sessao/index.js'

/**
 * Os jobs que falharam de vez, para a operação (ingestao-do-material, 3.0; onda 3b, 46.0), e o que os três comandos têm em comum
 * (`ops:jobs-que-falharam`, `ops:reprocessar-job` e `ops:descartar-job`):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:jobs-que-falharam
 *   OPERADOR=<pessoa da equipe> npm run -s ops:reprocessar-job -- <id do job> --chamado <n>
 *   OPERADOR=<pessoa da equipe> npm run -s ops:descartar-job -- <id do job> --chamado <n>
 *
 * - A lista traz id, escola, tipo, fila, código da falha e data. Nunca o `dados` (D76): ele pode trazer o id do material ou do pedido.
 * - `--chamado` é o número do chamado que pede a ação: inteiro positivo, nunca texto livre. Fora disso, o comando recusa antes de abrir o banco.
 * - Só se age no job `falhou`. O que não está nesse estado, ou não existe, dá `NAO_ENCONTRADO`, e nada é tocado.
 */

/** Os tipos que nenhum dos dois comandos mexe: a IA e o pedido do titular (que foi enfileirado uma vez só e tem o próprio caminho). */
export const PREFIXOS_QUE_A_OPERACAO_NAO_MEXE: readonly string[] = ['ia.', 'titular.']

const FORMATO_DO_CHAMADO = /^[1-9]\d{0,8}$/

export interface PedidoDeJob {
  readonly jobId: string
  readonly chamado: number
}

/** O job é de um tipo que o comando não aceita, ou não é um tipo que existe: a mensagem é fixa e diz o motivo, nunca o valor. */
export class JobRecusadoError extends Error {
  constructor(readonly motivo: string) {
    super(motivo)
    this.name = 'JobRecusadoError'
  }
}

/** `<id do job> --chamado <n>`: o UUID em minúsculas e o inteiro positivo. Ausente ou fora do formato, só a opção na mensagem. */
export function lerPedidoDeJob(argumentos: string[]): PedidoDeJob {
  let lido: ReturnType<typeof parseArgs<{ options: { chamado: { type: 'string' } }; allowPositionals: true }>>
  try {
    lido = parseArgs({ args: argumentos, options: { chamado: { type: 'string' } }, strict: true, allowPositionals: true })
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new InvalidArgumentError('<id do job> e --chamado')
  }
  const [jobId, ...sobra] = lido.positionals
  const id = z.uuid().safeParse(jobId)
  if (!id.success || sobra.length > 0) throw new InvalidArgumentError('<id do job>')
  if (lido.values.chamado === undefined || !FORMATO_DO_CHAMADO.test(lido.values.chamado)) throw new InvalidArgumentError('--chamado')
  return { jobId: id.data.toLowerCase(), chamado: Number(lido.values.chamado) }
}

/**
 * O job que a operação pode mexer: o tipo existe e não é de IA nem do titular. Devolve a escola da linha, ou `null` no job de rotina do sistema (`sistema.*`),
 * que não é de escola nenhuma: a auditoria dele fica sem escola, com `autor_operador` (`techspec.md` §11, linha "3.0"; ingestao-do-material, 5.0).
 */
export function exigirJobDaOperacao(linha: JobQueFalhou, tiposRecusados: readonly string[]): { escolaId: string | null; tipo: keyof typeof JOB_DEFINITIONS } {
  if (PREFIXOS_QUE_A_OPERACAO_NAO_MEXE.some((prefixo) => linha.tipo.startsWith(prefixo))) throw new JobRecusadoError('tipo de job que a operação não mexe: IA ou pedido do titular')
  if (tiposRecusados.includes(linha.tipo)) throw new JobRecusadoError('Tentar de novo é envio novo')
  const tipo = (Object.keys(JOB_DEFINITIONS) as Array<keyof typeof JOB_DEFINITIONS>).find((existente) => existente === linha.tipo)
  if (tipo === undefined) throw new JobRecusadoError('tipo de job desconhecido')
  return { escolaId: linha.escolaId, tipo }
}

/**
 * Roda `funcao` no contexto do job: o da escola da linha, ou o da rotina do sistema quando ele não tem escola (`escolaId` nulo). O contexto é o que o `JobOutboxRepository` lê para
 * escopar a linha (`jobScopeInContext`): o job de escola só alcança a da escola, e o de `sistema.*`, só as sem escola. A auditoria sai com a escola do contexto, ou sem escola e com o operador.
 */
export function noContextoDoJob<T>(requisicaoId: string, escolaId: string | null, funcao: () => T): T {
  return runInContext(escolaId === null ? { requisicaoId, rotinaDoSistema: true } : { requisicaoId, escolaId }, funcao)
}

/** Os jobs que falharam de vez, em todas as escolas, numa transação que começa pela conferência do autor. */
export function listarJobsQueFalharam(banco: Database, autor: AuthorCheck): Promise<JobQueFalhou[]> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      await autor(tx)
      return new JobsQueFalharamRepository(tx).listar()
    }),
  )
}

/** Texto fixo por código, sem nada do pedido. */
const MENSAGEM_DO_OPERADOR: Partial<Record<ErrorCode, string>> = {
  NAO_ENCONTRADO: 'job não encontrado entre os que falharam',
  CONFLITO: 'o job já existe em andamento, ou a fila ainda o tem como ativo',
}

/** O terminal do erro dos três comandos: 2 para argumento, ambiente ou operador, 1 para o resto. Nunca o valor da linha, do pedido ou do Postgres. */
export function terminarComErro(erro: unknown, terminal: CommandOutput): number {
  if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
    terminal.erro(`${erro.message}\n`)
    return 2
  }
  if (erro instanceof JobRecusadoError) {
    terminal.erro(`${erro.message}\n`)
    return 1
  }
  const doDominio = erro instanceof DomainException ? erro : mapPostgresError(erro)
  if (doDominio !== undefined && MENSAGEM_DO_OPERADOR[doDominio.codigo] !== undefined) {
    terminal.erro(`${doDominio.codigo}: ${MENSAGEM_DO_OPERADOR[doDominio.codigo]}\n`)
    return 1
  }
  terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(summarizeError(erro))}\n`)
  return 1
}

/** A linha que a lista imprime: o que a operação precisa para agir, e a data em ISO. */
function paraSaida(job: JobQueFalhou) {
  return { id: job.id, escolaId: job.escolaId, tipo: job.tipo, fila: job.fila, codigo: job.codigoFalha, concluidoEm: job.concluidoEm?.toISOString() ?? null }
}

/**
 * Executa a lista e devolve o código de saída: 0 listado (também vazio), 2 argumento ou ambiente inválido, ou `OPERADOR` que não é operador
 * ativo, 1 erro. Sem argumento: qualquer um é recusado antes de abrir o banco.
 */
export async function executarOpsJobsQueFalharam(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDeOperacao,
): Promise<number> {
  try {
    if (argumentos.length > 0) throw new InvalidArgumentError('nenhum argumento')
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      const jobs = await listarJobsQueFalharam(banco, autorDoComando(operador))
      terminal.saida(`${JSON.stringify({ jobs: jobs.map(paraSaida) })}\n`)
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    return terminarComErro(erro, terminal)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsJobsQueFalharam(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
