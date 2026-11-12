import { DomainException, runInContext, AuditoriaRecorder, JobOutboxRepository, type Database } from '@educa/core'
import { ErrorCode, TIPO_EXTRAIR_PDF } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { JobsQueFalharamRepository } from '../operacao/jobs-que-falharam.repository.js'
import { abrirBancoDeOperacao, urlDoRedisDeFilaDeOperacao, autorDoComando, lerOperador, type CommandDatabase, type CommandOutput } from './command.js'
import { abrirFilaDeOperacao, type FilaDeOperacao } from './fila-de-jobs.js'
import { exigirJobDeEscola, lerPedidoDeJob, terminarComErro, type PedidoDeJob } from './jobs-que-falharam.js'
import type { AuthorCheck } from '../sessao/index.js'

const registro = new AuditoriaRecorder()

/**
 * `ops:reprocessar-job <id> --chamado <n>` (ingestao-do-material, 3.0; onda 3b, 46.0): o job que falhou de vez volta à fila.
 *
 * - Só o job `falhou`: a transação o trava (`for update`) e a troca de estado é condicional ao `falhou`. Dois comandos sobre o mesmo job passam um
 *   de cada vez, e o segundo já não o acha.
 * - Recusa `ia.*`, `titular.*` e `material.extrair-pdf`: o do titular foi enfileirado uma vez só e tem o caminho dele, e do PDF "Tentar de novo é
 *   envio novo": o objeto já saiu do storage, e quem tenta de novo é a coordenação, enviando o arquivo outra vez.
 * - Tira a cópia `failed` do BullMQ **dentro da transação, com a linha travada**: sem isso o despachante publicaria o job com o mesmo id, a fila
 *   o ignoraria, e a reconciliação o daria por falho de novo. Depois, a linha volta a `aguardando` e o `job.reprocessado` fica na auditoria da
 *   escola, com o chamado. Se a fila falha, nada muda; se o commit falha depois, a cópia já saiu e o comando se repete sem efeito colateral.
 * - O job sem escola (`sistema.*`) é recusado antes de tocar a linha, até a 5.0 (`techspec.md` §11, linha "3.0").
 */
export function reprocessarJob(banco: Database, autor: AuthorCheck, fila: FilaDeOperacao, pedido: PedidoDeJob): Promise<{ id: string; tipo: string }> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const linha = await new JobsQueFalharamRepository(tx).travarFalho(pedido.jobId)
      if (linha === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const { escolaId, tipo } = exigirJobDeEscola(linha, [TIPO_EXTRAIR_PDF])
      return runInContext({ requisicaoId, escolaId }, async () => {
        await fila.tirarCopiaDaFalha({ id: linha.id, fila: linha.fila, tipo: linha.tipo })
        if (!(await new JobOutboxRepository(tx).reabrirFalho(linha.id))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        await registro.gravar(tx, 'job.reprocessado', { entidadeId: linha.id, depois: { tipo, chamado: pedido.chamado }, autorOperador })
        return { id: linha.id, tipo }
      })
    }),
  )
}

/**
 * Executa o comando e devolve o código de saída: 0 reprocessado, 1 recusa (tipo, job sem escola), `NAO_ENCONTRADO`, `CONFLITO` ou `ERRO_INTERNO`
 * resumido, 2 argumento ou ambiente inválido, ou `OPERADOR` que não é operador ativo. Argumento, `OPERADOR` e o endereço do Redis são conferidos
 * antes de abrir o banco.
 */
export async function executarOpsReprocessarJob(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDeOperacao,
  abrirFila: (ambiente: Record<string, string | undefined>) => FilaDeOperacao = (doAmbiente) => abrirFilaDeOperacao(urlDoRedisDeFilaDeOperacao(doAmbiente)),
): Promise<number> {
  try {
    const pedido = lerPedidoDeJob(argumentos)
    const operador = lerOperador(ambiente)
    const fila = abrirFila(ambiente)
    try {
      const { banco, fechar } = abrirBanco(ambiente)
      try {
        const reprocessado = await reprocessarJob(banco, autorDoComando(operador), fila, pedido)
        terminal.saida(`${JSON.stringify({ reprocessado: reprocessado.id, tipo: reprocessado.tipo, chamado: pedido.chamado })}\n`)
        return 0
      } finally {
        await fechar()
      }
    } finally {
      await fila.fechar()
    }
  } catch (erro) {
    return terminarComErro(erro, terminal)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsReprocessarJob(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
