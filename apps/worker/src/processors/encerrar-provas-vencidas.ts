import {
  currentContext,
  EncerramentoDaProvaRepository,
  encerrarPeloLimite,
  JobFailureError,
  ProvasVencidasRepository,
  requireEscolaId,
  runInContext,
  summarizeError,
  SuspensaoRepository,
  type Clock,
  type Database,
  type JobOutbox,
  type JobProcessor,
  type LoggerBase,
} from '@educa/core'
import { InvariantException, JobFailureCode, TIPO_ENCERRAR_PROVAS_VENCIDAS, type TIPO_ENCERRAR_PROVAS_VENCIDAS_DAS_ESCOLAS } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

/** Quantas provas o job de uma escola encerra por vez (Tech Spec §7c, "Laços"): o que passar disso sai na rodada do minuto seguinte, pelo mesmo caminho. */
export const PROVAS_POR_JOB = 200
/** O `statement_timeout` de cada aplicação: a corrida com a professora (que segura a trava) e a correção de uma turma cabem folgados, e a que passar disso é cortada em vez de segurar a transação. */
const PRAZO_DA_APLICACAO_MS = 20_000

/** A chave do minuto: o job de uma escola gravado duas vezes no mesmo minuto (o cron duplicado, duas réplicas) é um só. */
export function chaveDoMinuto(agora: Date): string {
  return agora.toISOString().slice(0, 16)
}

export interface RotinaDasProvasVencidasDependencies {
  provas: Pick<ProvasVencidasRepository, 'escolasComProvaVencida'>
  banco: Database
  enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  relogio: Clock
  logger: LoggerBase
}

/**
 * `sistema.encerrar-provas-vencidas` (avaliacao-e-correcao, 6.0; Tech Spec §5.6), por minuto: lista as escolas com prova vencida do ano em curso (`ProvasVencidasRepository`, a única consulta sem escopo da rotina,
 * que **não devolve nada com o pulso da API de mais de 30 s**) e, **no contexto de cada uma**, grava um `atividade.encerrar-vencidas` na fila de lote, com o minuto por chave: rodar duas vezes no mesmo
 * minuto, ou duas réplicas ao mesmo tempo, dá um job por escola. Como a rotina da classificação, a escola que falha não segura as outras: a rotina segue e, no fim, falha o job, para a fila tentar de novo
 * (as já enfileiradas colidem na chave). Loga só contagens, e a escola que falhou pelo id.
 */
export function createRotinaDasProvasVencidas({ provas, banco, enfileirador, relogio, logger }: RotinaDasProvasVencidasDependencies): JobProcessor<typeof TIPO_ENCERRAR_PROVAS_VENCIDAS_DAS_ESCOLAS> {
  return async () => {
    const contexto = currentContext()
    if (contexto?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
    const chave = chaveDoMinuto(relogio.agora())
    const ids = await provas.escolasComProvaVencida()
    let enfileiradosTotal = 0
    let jaEnfileiradosTotal = 0
    let falhasTotal = 0
    for (const escolaId of ids) {
      try {
        const resultado = await runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, () => banco.transaction((tx) => enfileirador.enfileirarUmaVez(tx, TIPO_ENCERRAR_PROVAS_VENCIDAS, {}, chave)))
        if (resultado.situacao === 'enfileirado') enfileiradosTotal += 1
        else jaEnfileiradosTotal += 1
      } catch (erro) {
        falhasTotal += 1
        logger.warn({ evento: 'prova.escola_nao_enfileirada', escolaId, erro: summarizeError(erro) })
      }
    }
    const escolasTotal = ids.length
    logger.info({ evento: 'prova.rotina_disparada', escolasTotal, enfileiradosTotal, jaEnfileiradosTotal, falhasTotal })
    if (falhasTotal > 0) throw new InvariantException('encerramento de prova não enfileirado em alguma escola')
  }
}

export interface EncerramentoDasProvasVencidasDependencies {
  banco: Database
  logger: LoggerBase
  /** Provas por job. Só o teste troca. */
  limite?: number
}

/**
 * `atividade.encerrar-vencidas` (6.0; Tech Spec §5.6 e §7c, "Laços"), o job de **uma escola**: lê no contexto dela, com o ano em curso, até 200 provas vencidas e encerra **cada uma numa transação**
 * (`encerrarPeloLimite`: `for update`, o pulso conferido de novo, o fim efetivo, a gravação da vencida, a auditoria e a correção, com a função suspensa conferida na escola do job). Os dados do job vêm vazios: a escola
 * é a da linha do outbox, e **nenhum id de prova entra pelo payload**, então o job de uma escola não toca a de outra. Com o pulso velho (a API sem pulsar há mais de 30 s) para o laço inteiro, porque nada encerra
 * durante uma queda. Para entre duas provas quando o `sinal` aborta. A prova que falha não segura as outras: o job segue e, no fim, falha, para a fila tentar de novo. Loga só ids e contagens.
 */
export function createEncerramentoDasProvasVencidas({ banco, logger, limite = PROVAS_POR_JOB }: EncerramentoDasProvasVencidasDependencies): JobProcessor<typeof TIPO_ENCERRAR_PROVAS_VENCIDAS> {
  return async (_dados, _execucao, sinal = new AbortController().signal) => {
    const escolaId = requireEscolaId()
    // O id da requisição segue para a auditoria e o log da prova; `requireEscolaId` já exigiu o contexto, e o sorteio é só para o tipo.
    const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
    const anoLetivoId = await new ProvasVencidasRepository(banco).anoEmCursoDaEscola()
    if (anoLetivoId === undefined) {
      logger.info({ evento: 'prova.encerramento_sem_ano_em_curso', escolaId })
      return
    }
    await runInContext({ requisicaoId, escolaId, anoLetivoId }, async () => {
      const vencidas = await new ProvasVencidasRepository(banco).vencidasDaEscola(limite)
      let encerradasTotal = 0
      let naoVencidasTotal = 0
      let falhasTotal = 0
      let estado: 'fim' | 'pulso_velho' | 'sinal' = 'fim'
      for (const { id } of vencidas) {
        if (sinal.aborted) {
          estado = 'sinal'
          break
        }
        try {
          const desfecho = await banco.transaction(async (tx) => {
            await tx.execute(sql`select set_config('statement_timeout', ${String(PRAZO_DA_APLICACAO_MS)}, true)`)
            const travada = await new EncerramentoDaProvaRepository(tx).lockDaRotina(id)
            if (travada === undefined) return 'nao_aplicavel' as const
            return encerrarPeloLimite(tx, travada, () => new SuspensaoRepository(tx).estaSuspensa('correcao_de_objetiva'))
          })
          if (desfecho === 'encerrada') encerradasTotal += 1
          if (desfecho === 'nao_vencida') naoVencidasTotal += 1
          if (desfecho === 'pulso_velho') {
            estado = 'pulso_velho'
            break
          }
        } catch (erro) {
          falhasTotal += 1
          logger.warn({ evento: 'prova.nao_encerrada', escolaId, atividadeAplicadaId: id, erro: summarizeError(erro) })
        }
      }
      const vencidasTotal = vencidas.length
      logger.info({ evento: 'prova.encerradas_pelo_limite', escolaId, estado, vencidasTotal, encerradasTotal, naoVencidasTotal, falhasTotal })
      if (falhasTotal > 0) throw new InvariantException('prova vencida não encerrada em alguma aplicação')
    })
  }
}
