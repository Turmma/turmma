import {
  AgendamentoDaClassificacaoRepository,
  currentContext,
  EXECUCOES_POR_NOITE_DA_ESCOLA,
  requireEscolaId,
  runInContext,
  SECOES_POR_EXECUCAO,
  SECOES_POR_LOTE_DO_AGENDAMENTO,
  summarizeError,
  type Clock,
  type CronEscolasRepository,
  type Database,
  type JanelaLetiva,
  type JobOutbox,
  type JobProcessor,
  type LoggerBase,
  type OperationalSettings,
  JobFailureError,
} from '@educa/core'
import { InvariantException, JobFailureCode, TIPO_AGENDAR_CLASSIFICACAO, type TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { chaveDaNoite } from './expurgar-dado-pessoal.js'

/** O `statement_timeout` de cada lote: 500 seções leem e gravam em segundos, e a consulta que passa disso é cortada em vez de segurar a transação (Tech Spec, seção 7c, "Laços"). */
const PRAZO_DO_LOTE_MS = 20_000

export interface RotinaDaClassificacaoDependencies {
  escolas: Pick<CronEscolasRepository, 'listarIds'>
  banco: Database
  enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  /** O horário letivo da escola do contexto: dele sai o fuso da data local da chave. */
  janelaDaEscola: Pick<OperationalSettings<JanelaLetiva>, 'daEscola'>
  relogio: Clock
  logger: LoggerBase
}

/**
 * `sistema.agendar-classificacao` (classificacao-bncc, tarefa 5.0; Tech Spec, seção 5, "Agendar" (a)), às 19h: lista as escolas (`CronEscolasRepository`, a única consulta sem escopo da rotina) e, **no contexto de cada uma**,
 * grava um `material.agendar-classificacao` na fila de lote, não urgente, com a data local da noite no fuso dela por chave. Rodar duas vezes na mesma noite, ou duas réplicas ao mesmo tempo, dá um job por escola. Como a rotina
 * do expurgo, uma escola que falha não segura as outras: a rotina segue e, no fim, falha o job, para a fila tentar de novo (as já enfileiradas colidem na chave). Loga só contagens, e a escola que falhou pelo id.
 */
export function criarRotinaDaClassificacao({ escolas, banco, enfileirador, janelaDaEscola, relogio, logger }: RotinaDaClassificacaoDependencies): JobProcessor<typeof TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS> {
  return async () => {
    const contexto = currentContext()
    if (contexto?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
    const agora = relogio.agora()
    const ids = await escolas.listarIds()
    let enfileiradosTotal = 0
    let jaEnfileiradosTotal = 0
    let falhasTotal = 0
    for (const escolaId of ids) {
      try {
        const resultado = await runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, async () => {
          const { fuso } = await janelaDaEscola.daEscola()
          return banco.transaction((tx) => enfileirador.enfileirarUmaVez(tx, TIPO_AGENDAR_CLASSIFICACAO, {}, chaveDaNoite(fuso, agora)))
        })
        if (resultado.situacao === 'enfileirado') enfileiradosTotal += 1
        else jaEnfileiradosTotal += 1
      } catch (erro) {
        falhasTotal += 1
        logger.warn({ evento: 'classificacao.escola_nao_enfileirada', escolaId, erro: summarizeError(erro) })
      }
    }
    const escolasTotal = ids.length
    logger.info({ evento: 'classificacao.rotina_disparada', escolasTotal, enfileiradosTotal, jaEnfileiradosTotal, falhasTotal })
    if (falhasTotal > 0) throw new InvariantException('classificação não enfileirada em alguma escola')
  }
}

export interface AgendamentoDaClassificacaoDependencies {
  banco: Database
  enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  logger: LoggerBase
  /** Seções por lote. Só o teste troca. */
  lote?: number
  /** Execuções que a escola ganha numa noite. Só o teste troca. */
  limiteDeExecucoes?: number
}

/**
 * `material.agendar-classificacao` (classificacao-bncc, tarefa 5.0; Tech Spec, seções 5 "Agendar" (a) e 7c "Laços"): no contexto da escola do job, lê as seções que precisam de execução em **lotes de 500, cada um numa transação**
 * (`statement_timeout` de 20 s) e cria as execuções `classificar_secoes` e os jobs delas (`AgendamentoDaClassificacaoRepository`). Para entre dois lotes quando o `sinal` aborta (o prazo, o desligamento), sem deixar seção sem
 * execução no meio de um lote, quando a função está suspensa e quando a escola já ganhou o limite de execuções da noite (`EXECUCOES_POR_NOITE_DA_ESCOLA`): o resto sai na noite seguinte, pelo mesmo caminho. Cada lote começa
 * depois da última seção do anterior, então a seção que nenhum lote consegue agendar (a que o outro agendamento levou) não prende o laço. Loga só ids e contagens, nunca título, texto nem código.
 */
export function criarAgendamentoDaClassificacao({ banco, enfileirador, logger, lote = SECOES_POR_LOTE_DO_AGENDAMENTO, limiteDeExecucoes = EXECUCOES_POR_NOITE_DA_ESCOLA }: AgendamentoDaClassificacaoDependencies): JobProcessor<typeof TIPO_AGENDAR_CLASSIFICACAO> {
  return async (_dados, _execucao, sinal = new AbortController().signal) => {
    const escolaId = requireEscolaId()
    let cursor: string | undefined
    let lotesTotal = 0
    let execucoesTotal = 0
    let secoesTotal = 0
    let estado: 'fim' | 'suspensa' | 'limite' | 'sinal'
    for (;;) {
      if (sinal.aborted) {
        estado = 'sinal'
        break
      }
      if (execucoesTotal >= limiteDeExecucoes) {
        estado = 'limite'
        break
      }
      // O lote nunca passa do que ainda cabe no limite da noite: cada execução leva até 12 seções.
      const tamanho = Math.min(lote, (limiteDeExecucoes - execucoesTotal) * SECOES_POR_EXECUCAO)
      const feito = await banco.transaction(async (tx) => {
        await tx.execute(sql`select set_config('statement_timeout', ${String(PRAZO_DO_LOTE_MS)}, true)`)
        const repositorio = new AgendamentoDaClassificacaoRepository(tx)
        if (!(await repositorio.funcaoEstaAtiva())) return 'suspensa' as const
        const proximas = await repositorio.proximasSecoes(tamanho, cursor === undefined ? {} : { depoisDe: cursor })
        const ultima = proximas.at(-1)
        if (ultima === undefined) return 'fim' as const
        return { ultima: ultima.secaoId, agendado: await repositorio.agendar(proximas, enfileirador, limiteDeExecucoes - execucoesTotal) }
      })
      if (feito === 'suspensa' || feito === 'fim') {
        estado = feito
        break
      }
      cursor = feito.ultima
      lotesTotal += 1
      execucoesTotal += feito.agendado.execucoes
      secoesTotal += feito.agendado.secoes
    }
    logger.info({ evento: 'classificacao.agendada', escolaId, estado, lotesTotal, execucoesTotal, secoesTotal })
  }
}
