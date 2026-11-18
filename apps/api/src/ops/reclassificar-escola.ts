import {
  AgendamentoDaClassificacaoRepository,
  ANTES_DA_PRIMEIRA_SECAO,
  AuditoriaRecorder,
  DomainException,
  InvalidConfigError,
  JobOutbox,
  JobOutboxRepository,
  runInContext,
  SECOES_POR_LOTE_DO_AGENDAMENTO,
  summarizeError,
  type Database,
} from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { AcessoDaEscolaRepository } from '../credencial/index.js'
import { abrirBancoDeOperacao, InvalidArgumentError, autorDoComando, lerOperador, OperadorRejectedError, type CommandDatabase, type CommandOutput } from './command.js'
import { FORMATO_DO_CHAMADO } from './jobs-que-falharam.js'
import type { AuthorCheck } from '../sessao/index.js'

const registro = new AuditoriaRecorder()

/** O `statement_timeout` de cada lote: 500 seções leem e gravam em segundos, e a consulta que passa disso é cortada em vez de segurar a transação (Tech Spec, seção 7c, "Laços"). */
const PRAZO_DO_LOTE_MS = 20_000

/**
 * `ops:reclassificar-escola --escola <uuid> --chamado <n>` (classificacao-bncc, 7.0; D76; Tech Spec, seção 5, "Reclassificar" e "Suspensão"): a operação manda classificar de novo todo o material de **uma** escola, com chamado,
 * sem ler o texto do material.
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:reclassificar-escola -- --escola <uuid> --chamado <n>
 *
 * - `--chamado` é o número do chamado que pede a ação: inteiro positivo, nunca texto livre. Sem ele, ou com a opção fora do formato, o comando recusa **antes de abrir o banco** (D76).
 * - Com a função `classificacao_do_material` suspensa na escola, recusa (`FUNCAO_SUSPENSA`) e não toca nada; a escola que não existe, `NAO_ENCONTRADO`.
 * - Em lotes de 500 seções, **cada lote numa transação** que começa pela conferência do autor: as seções não corrigidas de material `pronto` ganham execução nova e job na fila `lote` (para fora do horário letivo), a que já espera
 *   a noite fica como está e a correção da coordenação nunca é tocada. Cada lote grava `escola.reclassificada` (o chamado e as contagens, com `autor_operador`) na escola dada, e só nela. Para entre dois lotes quando o `sinal` aborta
 *   (Ctrl+C, o desligamento), sem deixar seção sem execução no meio de um lote: o que faltou se repete rodando o comando de novo, e a seção já reclassificada espera a noite, sem execução nova.
 * - Imprime só contagens: nunca título, texto nem código.
 */

export interface PedidoDeReclassificacao {
  readonly escolaId: string
  readonly chamado: number
}

/** `--escola <uuid> --chamado <n>`: o UUID em minúsculas e o inteiro positivo. Ausente ou fora do formato, só a opção na mensagem. */
export function lerPedidoDeReclassificacao(argumentos: string[]): PedidoDeReclassificacao {
  let valores: { escola?: string | undefined; chamado?: string | undefined }
  try {
    valores = parseArgs({ args: argumentos, options: { escola: { type: 'string' }, chamado: { type: 'string' } }, strict: true, allowPositionals: false }).values
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new InvalidArgumentError('--escola e --chamado')
  }
  const escola = z.uuid().safeParse(valores.escola)
  if (!escola.success) throw new InvalidArgumentError('--escola')
  if (!FORMATO_DO_CHAMADO.test(String(valores.chamado))) throw new InvalidArgumentError('--chamado')
  return { escolaId: escola.data.toLowerCase(), chamado: Number(valores.chamado) }
}

export interface Reclassificada {
  /** Por que o laço parou: `fim` (não há mais seção a tratar) ou `sinal` (o desligamento, ou Ctrl+C: o que faltou se repete rodando o comando de novo). */
  readonly estado: 'fim' | 'sinal'
  readonly lotes: number
  readonly execucoes: number
  readonly secoes: number
}

/**
 * Reclassifica a escola do pedido, lote a lote. O autor é conferido como primeira instrução de cada transação (`autorDoComando`); a escola e o chamado vão à auditoria. A função suspensa, em qualquer lote, recusa com
 * `FUNCAO_SUSPENSA` (os lotes já feitos ficam, cada um com a sua auditoria). `lote` é só do teste.
 */
export async function reclassificarEscola(banco: Database, autor: AuthorCheck, pedido: PedidoDeReclassificacao, sinal: Pick<AbortSignal, 'aborted'>, lote = SECOES_POR_LOTE_DO_AGENDAMENTO): Promise<Reclassificada> {
  const requisicaoId = randomUUID()
  const enfileirador = new JobOutbox(new JobOutboxRepository(banco))
  let cursor = ANTES_DA_PRIMEIRA_SECAO
  let lotes = 0
  let execucoes = 0
  let secoes = 0
  for (;;) {
    if (sinal.aborted) return { estado: 'sinal', lotes, execucoes, secoes }
    const feito = await runInContext({ requisicaoId }, () =>
      banco.transaction(async (tx) => {
        const autorOperador = await autor(tx)
        await tx.execute(sql`select set_config('statement_timeout', ${String(PRAZO_DO_LOTE_MS)}, true)`)
        return runInContext({ requisicaoId, escolaId: pedido.escolaId }, async () => {
          if ((await new AcessoDaEscolaRepository(tx).nome()) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
          const agendamento = new AgendamentoDaClassificacaoRepository(tx)
          if (!(await agendamento.funcaoEstaAtiva())) throw new DomainException(ErrorCode.FUNCAO_SUSPENSA)
          const travadas = await agendamento.travarParaReclassificar({}, lote, cursor)
          if (travadas.ultima === undefined) return undefined
          const agendado = await agendamento.agendar(travadas.aReclassificar, enfileirador)
          await registro.gravar(tx, 'escola.reclassificada', { entidadeId: pedido.escolaId, depois: { chamado: pedido.chamado, secoes: agendado.secoes, execucoes: agendado.execucoes }, autorOperador })
          return { ultima: travadas.ultima, agendado }
        })
      }),
    )
    if (feito === undefined) return { estado: 'fim', lotes, execucoes, secoes }
    cursor = feito.ultima
    lotes += 1
    execucoes += feito.agendado.execucoes
    secoes += feito.agendado.secoes
  }
}

/**
 * Executa o comando e devolve o código de saída: 0 reclassificado (também zero seções, e o laço que parou no sinal), 1 escola inexistente, função suspensa ou erro, 2 argumento ou ambiente inválido, ou `OPERADOR` que não é operador
 * ativo. Argumento, `OPERADOR` e `--chamado` são conferidos antes de abrir o banco. `sinal` é o do desligamento do processo; o teste passa o dele.
 */
export async function executarOpsReclassificarEscola(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDeOperacao,
  sinal: AbortSignal = new AbortController().signal,
): Promise<number> {
  try {
    const pedido = lerPedidoDeReclassificacao(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      const resultado = await reclassificarEscola(banco, autorDoComando(operador), pedido, sinal)
      terminal.saida(`${JSON.stringify({ ...resultado, chamado: pedido.chamado })}\n`)
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
      // Só o nome da opção ou da variável: nunca o valor.
      terminal.erro(`${erro.message}\n`)
      return 2
    }
    if (erro instanceof DomainException && (erro.codigo === ErrorCode.NAO_ENCONTRADO || erro.codigo === ErrorCode.FUNCAO_SUSPENSA)) {
      terminal.erro(`${erro.codigo}\n`)
      return 1
    }
    terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(summarizeError(erro))}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const desligamento = new AbortController()
  for (const sinal of ['SIGINT', 'SIGTERM'] as const) process.once(sinal, () => desligamento.abort())
  process.exitCode = await executarOpsReclassificarEscola(
    process.argv.slice(2),
    process.env,
    { saida: (texto) => process.stdout.write(texto), erro: (texto) => process.stderr.write(texto) },
    abrirBancoDeOperacao,
    desligamento.signal,
  )
}
