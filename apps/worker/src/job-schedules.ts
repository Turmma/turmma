import { runInContext, type Database, type JobOutbox, type LoggerBase } from '@educa/core'
import { TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS, TIPO_CONSOLIDAR_USO, TIPO_ENCERRAR_PROVAS_VENCIDAS_DAS_ESCOLAS, TIPO_EXPURGAR_ACESSO, TIPO_EXPURGAR_DADO_PESSOAL, TIPO_EXPURGAR_JOBS, TIPO_VARRER_TEMPORARIOS_DE_MATERIAL, type JobType } from '@educa/shared'
import { UnrecoverableError, type Job, type Queue } from 'bullmq'
import { randomUUID } from 'node:crypto'

/**
 * A fila do BullMQ onde só moram os disparos agendados. O disparo não executa a rotina: grava o job
 * dela em `job_registro` pelo `JobOutbox`, e dali ela segue a trilha de todo job (despachante, vaga,
 * worker de lote, estado consultável).
 */
export const SCHEDULES_QUEUE = 'agendamentos'

/** O fuso do horário dos agendamentos: "2h" é 2h em São Paulo, e não em UTC. */
export const SCHEDULE_TIMEZONE = 'America/Sao_Paulo'

/** Os tipos que a rotina noturna dispara: os do sistema, sem escola e sem dados. */
export type ScheduledJobType = Extract<JobType, `sistema.${string}`>

export interface JobSchedule {
  /** O tipo do job gravado, que é também o id do agendador no BullMQ. */
  tipo: ScheduledJobType
  /** Cron, no fuso `SCHEDULE_TIMEZONE`. */
  padrao: string
}

/**
 * As rotinas do sistema, as noturnas fora do horário letivo e longe uma da outra (a das 19h é a da classificação). O job das noturnas nasce não urgente
 * na fila de lote: se o disparo atrasar até a manhã, ele fica segurado pela janela letiva padrão até
 * a aula acabar (regra 80, item 2). A rotina por minuto que encerra a prova vencida (avaliacao-e-correcao, 6.0) é a exceção: o job dela nasce urgente
 * (`naoUrgente: false`), na mesma fila, e a janela letiva não o segura, porque a prova acaba justamente dentro dela. O expurgo do acesso (17.0) fica às 4h30: uma hora depois do de jobs e duas e meia
 * antes do primeiro turno. O expurgo do dado pessoal (F3, tarefa 3.0) é o primeiro, à 1h: ele só grava um job por
 * escola, e o trabalho de cada uma, que é o mais longo da noite, tem as seis horas até a janela letiva abrir.
 */
export const JOB_SCHEDULES: readonly JobSchedule[] = [
  { tipo: TIPO_EXPURGAR_DADO_PESSOAL, padrao: '0 1 * * *' },
  { tipo: TIPO_CONSOLIDAR_USO, padrao: '0 2 * * *' },
  { tipo: TIPO_EXPURGAR_JOBS, padrao: '30 3 * * *' },
  { tipo: TIPO_EXPURGAR_ACESSO, padrao: '30 4 * * *' },
  // De hora em hora, no minuto 10 (longe do :00 e do :30 das outras): o PDF que sobrou no storage (ingestao-do-material, 2.0). Urgente, ao contrário das noturnas.
  { tipo: TIPO_VARRER_TEMPORARIOS_DE_MATERIAL, padrao: '10 * * * *' },
  // A classificação do material pela BNCC (classificacao-bncc, 5.0): às 19h, uma hora depois de a janela letiva padrão fechar (18h), para o job de cada escola e as execuções dele começarem com a aula acabada. A rotina só
  // grava um job por escola; o trabalho de cada uma tem as doze horas até a janela abrir às 7h.
  { tipo: TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS, padrao: '0 19 * * *' },
  // A prova vencida (avaliacao-e-correcao, 6.0): **a cada minuto**, dentro do horário letivo, que é quando ela vence. Urgente (`naoUrgente: false` no registro): a rotina só lista escolas e grava um job por escola, e a prova do aluno
  // não pode esperar as 18h. Com o pulso da API velho a rotina não lista nada (Tech Spec §5.6).
  { tipo: TIPO_ENCERRAR_PROVAS_VENCIDAS_DAS_ESCOLAS, padrao: '* * * * *' },
]

/**
 * Tentativas do disparo (gravar a linha no Postgres) com recuo exponencial a partir de 5 s: com o
 * Postgres fora na hora do disparo, ele tenta de novo por mais de uma hora antes de desistir da noite.
 */
export const SCHEDULE_ATTEMPTS = 10
const RECUO_DO_DISPARO_MS = 5_000
const UM_DIA_SEGUNDOS = 24 * 60 * 60

/**
 * Registra (ou atualiza) cada agendador no Redis de fila. É idempotente pelo id: as duas réplicas do
 * worker-lote registram o mesmo agendador, e o BullMQ gera um disparo só por horário.
 */
export async function registerJobSchedulers(fila: Pick<Queue, 'upsertJobScheduler'>, agendamentos: readonly JobSchedule[] = JOB_SCHEDULES): Promise<void> {
  for (const { tipo, padrao } of agendamentos) {
    await fila.upsertJobScheduler(
      tipo,
      { pattern: padrao, tz: SCHEDULE_TIMEZONE },
      {
        name: tipo,
        data: {},
        opts: {
          attempts: SCHEDULE_ATTEMPTS,
          backoff: { type: 'exponential', delay: RECUO_DO_DISPARO_MS },
          removeOnComplete: { age: UM_DIA_SEGUNDOS },
          removeOnFail: { age: 7 * UM_DIA_SEGUNDOS },
        },
      },
    )
  }
}

/**
 * O processador da fila de agendamentos: grava o job da rotina em `job_registro`, no contexto da
 * rotina do sistema (sem escola), e devolve o id dele. Tipo que não é um agendamento conhecido não
 * grava nada.
 *
 * Um disparo repetido (a fila entregou de novo) grava um segundo job da mesma rotina. Isso é aceito:
 * as duas rotinas toleram reexecução (D49), e a segunda não muda o que a primeira gravou.
 */
export function createScheduleProcessor(
  banco: Database,
  enfileirador: Pick<JobOutbox, 'enfileirar'>,
  logger: LoggerBase,
  agendamentos: readonly JobSchedule[] = JOB_SCHEDULES,
): (job: Pick<Job, 'name'>) => Promise<string> {
  return (job) => {
    const agendamento = agendamentos.find(({ tipo }) => tipo === job.name)
    if (agendamento === undefined) return Promise.reject(new UnrecoverableError('agendamento desconhecido'))
    const { tipo } = agendamento
    return runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, async () => {
      const jobId = await banco.transaction((tx) => enfileirador.enfileirar(tx, tipo, {}))
      logger.info({ evento: 'agendamento.disparado', tipo, jobId })
      return jobId
    })
  }
}
