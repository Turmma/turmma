import { z } from 'zod'
import { syntheticJobDataSchema } from './synthetic-jobs.js'
import type { QueueName } from './jobs.js'

/**
 * O registro de jobs (reengenharia, RF8). Todo tipo de job que existe declara aqui a fila, o escopo, quem executa, o
 * esquema dos dados, a retentativa, o prazo e se é urgente. O `Enfileirador` lê esta tabela para recusar, antes de gravar,
 * o payload que ela não descreve (`packages/nucleo/src/fila/enfileirador.ts`), e tipo que não está aqui não compila.
 *
 * O nome do tipo é um só nos dois lados: a API e o worker importam a constante `TIPO_*` daqui, e nenhum processador declara a
 * dele.
 */

export const TIPO_MONTAR_ARQUIVO = 'titular.montar-arquivo'
export const TIPO_ELIMINAR_TITULAR = 'titular.eliminar'
export const TIPO_EXPURGAR_ESCOLA = 'retencao.expurgar-escola'
export const TIPO_CONSOLIDAR_USO = 'sistema.consolidar-uso'
export const TIPO_EXPURGAR_ACESSO = 'sistema.expurgar-acesso'
export const TIPO_EXPURGAR_JOBS = 'sistema.expurgar-jobs'
export const TIPO_EXPURGAR_DADO_PESSOAL = 'sistema.expurgar-dado-pessoal'
export const TIPO_JOB_SINTETICO = 'sintetico'

/**
 * `escola`: o job pertence a uma escola e nasce no contexto dela. `sistema`: rotina nossa, sem escola, e só nasce de rotina do
 * sistema. Casa com o check `job_registro_escola_ou_sistema` (`escola_id is not null or tipo like 'sistema.%'`): o escopo é
 * `sistema` se, e somente se, o tipo começa com `sistema.`.
 */
export type JobScope = 'escola' | 'sistema'

/** Quem executa o job: o worker de hoje, ou a API (os de IA e de PDF, onda 3). */
export type JobExecutor = 'worker' | 'api'

/** Como o BullMQ tenta de novo: o recuo exponencial a partir de `recuoMs`, com a fração `jitter` sorteada para baixo. */
export interface JobRetry {
  readonly tentativas: number
  readonly recuoMs: number
  readonly jitter: number
}

/**
 * Os dados do job são sempre um objeto estrito: chave que o esquema não conhece é recusada, e não ignorada. É o que impede
 * `escolaId`, nome ou resposta de entrar num job pela porta dos fundos (regras 10, item 3, e 20).
 */
export type JobDataSchema = z.ZodObject<z.core.$ZodLooseShape, z.core.$strict>

export interface JobDefinition<Dados extends JobDataSchema = JobDataSchema> {
  /** As filas em que o tipo pode nascer, a primeira é a padrão. Cada uma está no check `job_registro_fila_valida`. */
  readonly filas: readonly [QueueName, ...QueueName[]]
  readonly escopo: JobScope
  readonly executor: JobExecutor
  readonly dados: Dados
  readonly retentativa: JobRetry
  /** Quanto o worker espera uma tentativa. Aplicado na onda 3 (43.0); até lá, é o que o tipo declara. */
  readonly prazoMs: number
  /**
   * `true` ou `false`: fixo no tipo, e quem enfileira não o escolhe. `'do-pedido'`: vem de quem enfileira (só o sintético, em
   * que o corpo do `POST` decide).
   */
  readonly naoUrgente: boolean | 'do-pedido'
}

/**
 * O esquema aceita chave que não conhece (`z.looseObject`, `.catchall()`): a saída ganha um índice `[k: string]` de valor
 * que não é `never`. O objeto vazio estrito também tem índice, mas de valor `never` (`Record<string, never>`).
 */
type AceitaChaveLivre<Dados extends JobDataSchema> = string extends keyof z.output<Dados>
  ? [z.output<Dados>[string]] extends [never]
    ? false
    : true
  : false

/**
 * Declara um tipo de job. O que o tipo não impede, esta função confere ao carregar: o esquema precisa recusar chave a mais.
 * `z.object()` e `z.strictObject()` têm o mesmo tipo no zod, então só a leitura da definição os distingue.
 */
export function defineJob<const Definicao extends JobDefinition>(
  definicao: Definicao & (AceitaChaveLivre<Definicao['dados']> extends true ? { readonly dados: never } : unknown),
): Definicao {
  if (!strictSchema(definicao.dados)) throw new TypeError('os dados de um job são um objeto estrito: use z.strictObject ou .strict()')
  return definicao
}

/**
 * O esquema recusa chave que não conhece quando o `catchall` dele é `never` (`z.strictObject`, `.strict()`). É o único ponto
 * que lê `_zod.def`, campo interno do zod: se uma versão do zod o mudar, é aqui que quebra, e o teste
 * `definicoes-de-job.test.ts › recusa, ao carregar` o acusa.
 */
function strictSchema(esquema: JobDataSchema): boolean {
  return esquema._zod.def.catchall?._zod.def.type === 'never'
}

/** A mesma política de retentativa de todo job de hoje: cinco tentativas, recuo de 2 s e metade do recuo sorteada. */
const RETENTATIVA_DE_HOJE: JobRetry = { tentativas: 5, recuoMs: 2_000, jitter: 0.5 }

const pedidoSchema = z.strictObject({ pedidoId: z.uuid() })
const semDados = z.strictObject({})

/**
 * Os 8 tipos de hoje. `prazoMs` é o maior tempo que o tipo leva, arredondado para cima, e a 43.0 o confere.
 */
export const JOB_DEFINITIONS = {
  [TIPO_MONTAR_ARQUIVO]: defineJob({
    filas: ['normal'],
    escopo: 'escola',
    executor: 'worker',
    dados: pedidoSchema,
    retentativa: RETENTATIVA_DE_HOJE,
    prazoMs: 300_000,
    naoUrgente: false,
  }),
  [TIPO_ELIMINAR_TITULAR]: defineJob({
    filas: ['lote'],
    escopo: 'escola',
    executor: 'worker',
    dados: pedidoSchema,
    retentativa: RETENTATIVA_DE_HOJE,
    prazoMs: 600_000,
    naoUrgente: true,
  }),
  [TIPO_EXPURGAR_ESCOLA]: defineJob({
    filas: ['lote'],
    escopo: 'escola',
    executor: 'worker',
    dados: semDados,
    retentativa: RETENTATIVA_DE_HOJE,
    // O trabalho da escola tem as seis horas entre a rotina das 1h e a janela letiva (`agendamentos.ts`).
    prazoMs: 21_600_000,
    naoUrgente: true,
  }),
  [TIPO_CONSOLIDAR_USO]: defineJob({
    filas: ['lote'],
    escopo: 'sistema',
    executor: 'worker',
    dados: semDados,
    retentativa: RETENTATIVA_DE_HOJE,
    prazoMs: 600_000,
    naoUrgente: true,
  }),
  [TIPO_EXPURGAR_ACESSO]: defineJob({
    filas: ['lote'],
    escopo: 'sistema',
    executor: 'worker',
    dados: semDados,
    retentativa: RETENTATIVA_DE_HOJE,
    prazoMs: 600_000,
    naoUrgente: true,
  }),
  [TIPO_EXPURGAR_JOBS]: defineJob({
    filas: ['lote'],
    escopo: 'sistema',
    executor: 'worker',
    dados: semDados,
    retentativa: RETENTATIVA_DE_HOJE,
    prazoMs: 600_000,
    naoUrgente: true,
  }),
  [TIPO_EXPURGAR_DADO_PESSOAL]: defineJob({
    filas: ['lote'],
    escopo: 'sistema',
    executor: 'worker',
    dados: semDados,
    retentativa: RETENTATIVA_DE_HOJE,
    prazoMs: 600_000,
    naoUrgente: true,
  }),
  // O sintético é o job de teste de carga: a fila e o não urgente vêm do corpo do `POST`, e o prazo cobre o teto de CPU dele.
  [TIPO_JOB_SINTETICO]: defineJob({
    filas: ['interativa', 'normal', 'lote'],
    escopo: 'escola',
    executor: 'worker',
    dados: syntheticJobDataSchema,
    retentativa: RETENTATIVA_DE_HOJE,
    prazoMs: 90_000,
    naoUrgente: 'do-pedido',
  }),
} as const

export type JobType = keyof typeof JOB_DEFINITIONS

type DefinicaoDe<Tipo extends JobType> = (typeof JOB_DEFINITIONS)[Tipo]

/** O que quem enfileira passa em `dados`: a entrada do esquema do tipo, antes dos `default`. */
export type JobData<Tipo extends JobType> = z.input<DefinicaoDe<Tipo>['dados']>

/** O que o processador do tipo recebe: a saída do esquema, que o executor leu da linha (com os `default` aplicados). */
export type ParsedJobData<Tipo extends JobType> = z.output<DefinicaoDe<Tipo>['dados']>

/**
 * Um registro de definições por nome de tipo. `JOB_DEFINITIONS` é o de produção; o teste injeta o seu no despachante e no
 * worker (`fila-de-teste.ts`) para ter um tipo de dados próprios ou uma retentativa curta, sem tocar o registro real.
 */
export type JobRegistry = Readonly<Record<string, JobDefinition>>

/**
 * As escolhas de quem enfileira, e só as que a definição deixa: a fila, dentro das `filas` do tipo, e o `naoUrgente`, só no
 * tipo que o declara `'do-pedido'` (e então obrigatório).
 */
export type JobOptions<Tipo extends JobType> = { readonly fila?: DefinicaoDe<Tipo>['filas'][number] } & (DefinicaoDe<Tipo>['naoUrgente'] extends 'do-pedido'
  ? { readonly naoUrgente: boolean }
  : { readonly naoUrgente?: never })
