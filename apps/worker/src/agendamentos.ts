import { runInContext, type Database, type JobOutbox, type LoggerBase } from '@educa/nucleo'
import { TIPO_CONSOLIDAR_USO, TIPO_EXPURGAR_ACESSO, TIPO_EXPURGAR_DADO_PESSOAL, TIPO_EXPURGAR_JOBS, type JobType } from '@educa/shared'
import { UnrecoverableError, type Job, type Queue } from 'bullmq'
import { randomUUID } from 'node:crypto'

/**
 * A fila do BullMQ onde só moram os disparos agendados. O disparo não executa a rotina: grava o job
 * dela em `job_registro` pelo `JobOutbox`, e dali ela segue a trilha de todo job (despachante, vaga,
 * worker de lote, estado consultável).
 */
export const FILA_DOS_AGENDAMENTOS = 'agendamentos'

/** O fuso do horário dos agendamentos: "2h" é 2h em São Paulo, e não em UTC. */
export const FUSO_DOS_AGENDAMENTOS = 'America/Sao_Paulo'

/** Os tipos que a rotina noturna dispara: os do sistema, sem escola e sem dados. */
export type TipoAgendado = Extract<JobType, `sistema.${string}`>

export interface Agendamento {
  /** O tipo do job gravado, que é também o id do agendador no BullMQ. */
  tipo: TipoAgendado
  /** Cron, no fuso `FUSO_DOS_AGENDAMENTOS`. */
  padrao: string
}

/**
 * As rotinas noturnas do sistema, fora do horário letivo e longe uma da outra. O job nasce não urgente
 * na fila de lote: se o disparo atrasar até a manhã, ele fica segurado pela janela letiva padrão até
 * a aula acabar (regra 80, item 2). O expurgo do acesso (17.0) fica às 4h30: uma hora depois do de jobs e duas e meia
 * antes do primeiro turno. O expurgo do dado pessoal (F3, tarefa 3.0) é o primeiro, à 1h: ele só grava um job por
 * escola, e o trabalho de cada uma, que é o mais longo da noite, tem as seis horas até a janela letiva abrir.
 */
export const AGENDAMENTOS: readonly Agendamento[] = [
  { tipo: TIPO_EXPURGAR_DADO_PESSOAL, padrao: '0 1 * * *' },
  { tipo: TIPO_CONSOLIDAR_USO, padrao: '0 2 * * *' },
  { tipo: TIPO_EXPURGAR_JOBS, padrao: '30 3 * * *' },
  { tipo: TIPO_EXPURGAR_ACESSO, padrao: '30 4 * * *' },
]

/**
 * Tentativas do disparo (gravar a linha no Postgres) com recuo exponencial a partir de 5 s: com o
 * Postgres fora na hora do disparo, ele tenta de novo por mais de uma hora antes de desistir da noite.
 */
export const TENTATIVAS_DO_DISPARO = 10
const RECUO_DO_DISPARO_MS = 5_000
const UM_DIA_SEGUNDOS = 24 * 60 * 60

/**
 * Registra (ou atualiza) cada agendador no Redis de fila. É idempotente pelo id: as duas réplicas do
 * worker-lote registram o mesmo agendador, e o BullMQ gera um disparo só por horário.
 */
export async function registrarAgendamentos(fila: Pick<Queue, 'upsertJobScheduler'>, agendamentos: readonly Agendamento[] = AGENDAMENTOS): Promise<void> {
  for (const { tipo, padrao } of agendamentos) {
    await fila.upsertJobScheduler(
      tipo,
      { pattern: padrao, tz: FUSO_DOS_AGENDAMENTOS },
      {
        name: tipo,
        data: {},
        opts: {
          attempts: TENTATIVAS_DO_DISPARO,
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
export function criarDisparoDeAgendamento(
  banco: Database,
  enfileirador: Pick<JobOutbox, 'enfileirar'>,
  logger: LoggerBase,
  agendamentos: readonly Agendamento[] = AGENDAMENTOS,
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
