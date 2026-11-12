import { DomainException, runInContext, AuditoriaRecorder, ExtracaoDoMaterialRepository, JobOutboxRepository, chaveDoTemporario, type Database, type FileStorage } from '@educa/core'
import { ErrorCode, TIPO_EXTRAIR_PDF } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { JobsQueFalharamRepository } from '../operacao/jobs-que-falharam.repository.js'
import { abrirArmazemDeOperacao } from './armazem-de-operacao.js'
import { abrirBancoDeOperacao, autorDoComando, lerOperador, type CommandDatabase, type CommandOutput } from './command.js'
import { exigirJobDeEscola, lerPedidoDeJob, terminarComErro, type PedidoDeJob } from './jobs-que-falharam.js'
import type { AuthorCheck } from '../sessao/index.js'

const registro = new AuditoriaRecorder()

/** O que o descarte fez, para o terminal: o job e o tipo, e, no PDF, se o material fechou e se o objeto saiu do storage. */
export interface JobDescartado {
  readonly id: string
  readonly tipo: string
  readonly materialFechado: boolean
  readonly objetoApagado: boolean
}

/**
 * `ops:descartar-job <id> --chamado <n>` (ingestao-do-material, 3.0; onda 3b, 46.0): encerra de vez o job que falhou, e o alerta de job falhou de vez
 * se encerra com a linha.
 *
 * - Só o job `falhou`, travado (`for update`) e apagado com a condição do estado: o job que está `aguardando` ou `ativo` nunca é descartado, e a linha, o
 *   material e o objeto ficam como estavam.
 * - Recusa `ia.*` e `titular.*`. O do PDF (`material.extrair-pdf`) tem efeito: o material `processando` vira `falhou` (`extracao_falhou`) na mesma
 *   transação, e **depois do commit** o objeto sai do storage e a linha registra. Se o storage falha, o objeto fica para a varredura da 2.0, e o comando
 *   diz `objetoApagado: false`. Os outros (`retencao.*` e os demais de escola) só saem: voltam na próxima rodada, se forem de rotina.
 * - O `job.descartado` fica na auditoria da escola do job, com o chamado, na mesma transação. O job sem escola (`sistema.*`) é recusado antes de tocar a
 *   linha, até a 5.0 (`techspec.md` §11, linha "3.0").
 */
export async function descartarJob(banco: Database, autor: AuthorCheck, armazem: Pick<FileStorage, 'apagar'>, pedido: PedidoDeJob): Promise<JobDescartado> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, async () => {
    const decisao = await banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const linha = await new JobsQueFalharamRepository(tx).travarFalho(pedido.jobId)
      if (linha === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const { escolaId, tipo } = exigirJobDeEscola(linha, [])
      return runInContext({ requisicaoId, escolaId }, async () => {
        const materialId = tipo === TIPO_EXTRAIR_PDF ? linha.materialId : null
        const materialFechado = materialId === null ? false : await new ExtracaoDoMaterialRepository(tx).marcarFalhou(materialId, 'extracao_falhou')
        if (!(await new JobOutboxRepository(tx).descartarFalho(linha.id))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        await registro.gravar(tx, 'job.descartado', { entidadeId: linha.id, depois: { tipo, chamado: pedido.chamado }, autorOperador })
        return { id: linha.id, tipo, escolaId, materialId: materialFechado ? materialId : null }
      })
    })
    if (decisao.materialId === null) return { id: decisao.id, tipo: decisao.tipo, materialFechado: false, objetoApagado: false }
    const { materialId, escolaId } = decisao
    const objetoApagado = await runInContext({ requisicaoId, escolaId }, async () => {
      try {
        await armazem.apagar(chaveDoTemporario(materialId))
        await new ExtracaoDoMaterialRepository(banco).marcarObjetoApagado(materialId)
        return true
      } catch {
        // O objeto fica para a varredura da 2.0, e o terminal diz `objetoApagado: false`; o erro do storage pode trazer a chave e não sai daqui.
        return false
      }
    })
    return { id: decisao.id, tipo: decisao.tipo, materialFechado: true, objetoApagado }
  })
}

/**
 * Executa o comando e devolve o código de saída: 0 descartado, 1 recusa (tipo, job sem escola), `NAO_ENCONTRADO` ou `ERRO_INTERNO` resumido, 2 argumento
 * ou ambiente inválido, ou `OPERADOR` que não é operador ativo. O armazém só é aberto depois de o argumento e o `OPERADOR` serem conferidos.
 */
export async function executarOpsDescartarJob(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDeOperacao,
  abrirArmazem: (ambiente: Record<string, string | undefined>) => { armazem: Pick<FileStorage, 'apagar'>; encerrar: () => void } = abrirArmazemDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDeJob(argumentos)
    const operador = lerOperador(ambiente)
    const { armazem, encerrar } = abrirArmazem(ambiente)
    try {
      const { banco, fechar } = abrirBanco(ambiente)
      try {
        const descartado = await descartarJob(banco, autorDoComando(operador), armazem, pedido)
        terminal.saida(`${JSON.stringify({ descartado: descartado.id, tipo: descartado.tipo, chamado: pedido.chamado, materialFechado: descartado.materialFechado, objetoApagado: descartado.objetoApagado })}\n`)
        return 0
      } finally {
        await fechar()
      }
    } finally {
      encerrar()
    }
  } catch (erro) {
    return terminarComErro(erro, terminal)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsDescartarJob(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
