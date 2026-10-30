import {
  ConfiguracaoInvalida,
  lerConfiguracaoBanco,
  lerJanelaPadrao,
  lerConfiguracaoTelemetria,
  lerVagasPadrao,
  lerVagasPorEscolaDesligadas,
  validarAmbiente,
  type ConfiguracaoBanco,
  type ConfiguracaoTelemetria,
  type JanelaLetiva,
  type VagasPorFila,
} from '@educa/nucleo'
import { QUEUE_NAMES, type QueueName } from '@educa/shared'
import { z } from 'zod'

export { ConfiguracaoInvalida }

const inteiroPositivo = z.coerce.number().int().positive()

/** Variável do pool de cada fila: `WORKER_POOL_INTERATIVA`, `WORKER_POOL_NORMAL`, `WORKER_POOL_LOTE`. */
export function variavelDoPool(fila: QueueName): string {
  return `WORKER_POOL_${fila.toUpperCase()}`
}

const esquemaFilas = z.object({
  // `interativa,normal` no worker-interativo e `lote` no worker-lote: cada réplica atende só as filas dela.
  FILAS: z
    .string()
    .transform((texto) => texto.split(',').map((fila) => fila.trim()))
    .pipe(z.array(z.enum(QUEUE_NAMES)).min(1).refine((filas) => new Set(filas).size === filas.length, 'fila repetida')),
})

const esquemaAmbiente = z.object({
  REDIS_FILA_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/),
  WORKER_THREADS_MAXIMO: inteiroPositivo,
})

const esquemaStorage = z.object({
  STORAGE_URL: z.url({ protocol: /^https?$/ }),
  STORAGE_REGIAO: z.string().regex(/^[a-z0-9-]+$/),
  STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  STORAGE_CHAVE_ACESSO: z.string().min(1),
  STORAGE_CHAVE_SECRETA: z.string().min(1),
})

/**
 * Acesso ao storage S3-compatível. O worker-lote lista (a consolidação de uso mede os bytes de cada escola) e apaga (o
 * expurgo remove os arquivos do titular vencidos); o que atende a fila normal grava o arquivo do titular (F3, tarefa 13.0).
 */
export interface ConfiguracaoStorage {
  url: string
  regiao: string
  bucket: string
  chaveAcesso: string
  chaveSecreta: string
}

export interface ConfiguracaoWorker {
  /** Pool próprio, com o `statement_timeout` do ambiente. Cabe na soma dos pools das filas: cada job usa uma conexão por vez. */
  banco: ConfiguracaoBanco
  redisFilaUrl: string
  /** Jobs ao mesmo tempo nesta réplica, por fila atendida. Fila fora daqui não é consumida por esta réplica. */
  pools: Partial<Record<QueueName, number>>
  /** Vagas por fila da escola sem vagas próprias: o worker confere a vaga do job ao começar (D41). */
  vagasPadrao: VagasPorFila
  /**
   * Quantas threads do sandbox de CPU a réplica usa ao mesmo tempo (`processadores/sintetico.sandbox.ts`).
   * Coerente com a CPU do container: com uma thread por núcleo, e meio núcleo livre para o event loop, o
   * trabalho de CPU não atrasa a renovação de lock nem a troca de estado dos outros jobs.
   */
  threadsMaximo: number
  /**
   * Só no controle negativo do cenário de carga (`VAGAS_POR_ESCOLA_DESLIGADAS=true`): o worker não segura job
   * de escola acima do teto. Ausente é o normal. O boot recusa a flag com `AMBIENTE=producao`.
   */
  vagasPorEscolaDesligadas?: true
  /**
   * Só na réplica que atende o lote, onde rodam as rotinas do sistema (consolidação de uso e expurgo), ou a fila normal,
   * onde se monta o arquivo do titular (F3, tarefa 13.0). A que atende só a interativa não toca o storage e não precisa
   * da credencial.
   */
  storage?: ConfiguracaoStorage
  /**
   * Só na réplica que atende o lote: o horário letivo de toda escola sem horário próprio, o mesmo do despachante
   * (`JANELA_LETIVA_*`). O expurgo da escola confere a janela a cada lote e para quando ela abre, e a rotina noturna tira
   * do fuso da escola a data local da chave (F3, tarefa 3.0).
   */
  janelaPadrao?: JanelaLetiva
  /** Para onde e de quanto em quanto tempo as métricas vão. */
  telemetria: ConfiguracaoTelemetria
}

/** Lê e valida o ambiente do worker. Todos os problemas saem de uma vez, só pelo nome. */
export function lerConfiguracao(ambiente: Record<string, string | undefined>): ConfiguracaoWorker {
  const problemas: ConfiguracaoInvalida[] = []
  const ler = <T>(leitura: () => T): T | undefined => {
    try {
      return leitura()
    } catch (erro) {
      if (!(erro instanceof ConfiguracaoInvalida)) throw erro
      problemas.push(erro)
      return undefined
    }
  }
  const banco = ler(() => lerConfiguracaoBanco(ambiente))
  const proprio = ler(() => validarAmbiente(esquemaAmbiente, ambiente))
  const filas = ler(() => validarAmbiente(esquemaFilas, ambiente))
  // O pool só é exigido para as filas que a réplica atende.
  const esquemaPools = z.object(Object.fromEntries((filas?.FILAS ?? []).map((fila) => [variavelDoPool(fila), inteiroPositivo])))
  const pools = ler(() => validarAmbiente(esquemaPools, ambiente))
  const vagasPadrao = ler(() => lerVagasPadrao(ambiente))
  const vagasDesligadas = ler(() => lerVagasPorEscolaDesligadas(ambiente))
  const atendeLote = filas?.FILAS.includes('lote') === true
  const atendeStorage = atendeLote || filas?.FILAS.includes('normal') === true
  const storage = atendeStorage ? ler(() => validarAmbiente(esquemaStorage, ambiente)) : undefined
  const janelaPadrao = atendeLote ? ler(() => lerJanelaPadrao(ambiente)) : undefined
  const telemetria = ler(() => lerConfiguracaoTelemetria(ambiente))
  if (
    telemetria === undefined ||
    banco === undefined ||
    proprio === undefined ||
    filas === undefined ||
    pools === undefined ||
    vagasPadrao === undefined ||
    vagasDesligadas === undefined ||
    (atendeStorage && storage === undefined) ||
    (atendeLote && janelaPadrao === undefined)
  ) {
    throw new ConfiguracaoInvalida(problemas.flatMap((erro) => erro.variaveis).sort(), problemas.flatMap((erro) => erro.motivos))
  }
  return {
    banco,
    redisFilaUrl: proprio.REDIS_FILA_URL,
    pools: Object.fromEntries(filas.FILAS.map((fila) => [fila, Number(pools[variavelDoPool(fila)])])),
    vagasPadrao,
    threadsMaximo: proprio.WORKER_THREADS_MAXIMO,
    ...(vagasDesligadas ? { vagasPorEscolaDesligadas: true as const } : {}),
    telemetria,
    ...(janelaPadrao === undefined ? {} : { janelaPadrao }),
    ...(storage === undefined
      ? {}
      : {
          storage: {
            url: storage.STORAGE_URL,
            regiao: storage.STORAGE_REGIAO,
            bucket: storage.STORAGE_BUCKET,
            chaveAcesso: storage.STORAGE_CHAVE_ACESSO,
            chaveSecreta: storage.STORAGE_CHAVE_SECRETA,
          },
        }),
  }
}
