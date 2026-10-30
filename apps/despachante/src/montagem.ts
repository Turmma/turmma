import {
  avisoEspacado,
  ConfiguracaoOperacional,
  ConfiguracaoOperacionalRepository,
  criarBanco,
  criarClienteRedisDaFila,
  criarPool,
  DespachoRepository,
  nomeDaFilaBullMQ,
  observarPoolDoBanco,
  observarRedis,
  OuvinteDeJobs,
  relogioDoSistema,
  resolverJanela,
  resolverVagasDaEscola,
  VagasPorEscola,
  type Batimento,
  type DadosDoJobNaFila,
  type JanelaLetiva,
  type LoggerBase,
  type Meter,
  type Relogio,
  type VagasPorFila,
} from '@educa/nucleo'
import type { JobRegistry } from '@educa/shared'
import { Queue } from 'bullmq'
import type { ConfiguracaoDespachante } from './config.js'
import { Despachante } from './despachante.js'
import { PublicacaoBullMQ } from './fila-de-publicacao.js'
import { MedicaoDaFila } from './metricas-espera.js'
import { Reconciliacao } from './reconciliacao.js'

export interface OpcoesDaMontagem {
  /** Prefixo das chaves do BullMQ e das vagas. Só o teste troca, para não disputar a fila com outro teste. */
  prefixo?: string
  /** Intervalo da sondagem. Só o teste troca, para provar que o `NOTIFY` acorda o despachante antes dela. */
  intervaloMs?: number
  /** Intervalo da reconciliação. Só o teste troca, para provar que ela roda sozinha. */
  intervaloReconciliacaoMs?: number
  /** Troca as vagas. Só o teste usa, para simular outro despachante tomando a vaga no meio da rodada. */
  embrulharVagas?: (vagas: VagasPorEscola) => Pick<VagasPorEscola, 'membros' | 'manter' | 'livres' | 'tomar' | 'liberar'>
  /** Validade da vaga. Só o teste troca, para ver a vaga vencer sem esperar 60 s. */
  validadeDaVagaMs?: number
  /** Relógio do horário letivo. Só o teste troca, para ver o lote não urgente de terça às 10h sair às 18h. */
  relogio?: Relogio
  batimento?: Batimento
  /**
   * Medidor da telemetria. Com ele, o despachante mede as filas por escola, o pool e o Redis; sem ele (os
   * testes que não olham métrica), não mede nada.
   */
  medidor?: Meter
  /** Intervalo da medição das filas. Só o teste troca. */
  intervaloMedicaoMs?: number
  /** O registro de jobs que decide a fila e a retentativa de cada tipo. Só o teste troca, para ter uma retentativa curta ou um tipo seu. */
  definicoes?: JobRegistry
}

export interface DespachanteMontado {
  despachante: Despachante
  reconciliacao: Reconciliacao
  /** Só com `medidor`: a medição das filas por escola. */
  medicao?: MedicaoDaFila
  /**
   * Resolve quando o cliente de Redis fica de pé, quando ele erra (Redis fora de verdade) ou no teto
   * de espera, o que vier primeiro. Nunca rejeita.
   *
   * Quem liga o laço não precisa disto: uma rodada que sai antes da conexão termina em
   * `vaga_indisponivel` e a seguinte publica. Quem espera é o teste, que dirige rodada avulsa sem
   * laço atrás: sem isto, a rodada devolveria 0 por causa da conexão, e não do despacho.
   */
  pronto: Promise<void>
  /** Liga o laço de publicação e o de reconciliação. */
  iniciar(): void
  /** Para os laços e fecha fila, Redis e pool, nessa ordem. */
  encerrar(): Promise<void>
}

/**
 * Teto da espera de `pronto`: acima disto o Redis não está só conectando, está fora. É guarda contra
 * travamento, não comportamento esperado — o caminho normal resolve pelo `ready` ou pelo `error`.
 */
export const TETO_DA_ESPERA_DO_REDIS_MS = 5_000

/** Liga o despachante ao Postgres (pool próprio e `LISTEN`) e ao Redis de fila (filas e vagas). */
export function montarDespachante(config: Omit<ConfiguracaoDespachante, 'telemetria'>, logger: LoggerBase, opcoes: OpcoesDaMontagem = {}): DespachanteMontado {
  if (config.vagasPorEscolaDesligadas === true) {
    // Só o controle negativo do cenário de carga chega aqui, e ele precisa ficar visível no log de quem subiu assim.
    logger.warn({ evento: 'despachante.vagas_por_escola_desligadas' })
  }
  const pool = criarPool(config.banco, () => logger.warn({ evento: 'banco.conexao_ociosa_perdida' }))
  const redis = criarClienteRedisDaFila(
    config.redisFilaUrl,
    'despachante',
    avisoEspacado(() => logger.warn({ evento: 'despachante.redis_indisponivel' })),
  )
  const avisarErroDaFila = avisoEspacado(() => logger.warn({ evento: 'despachante.fila_com_erro' }))
  const fila = new PublicacaoBullMQ(
    (nome, executor) => {
      const queue = new Queue<DadosDoJobNaFila>(nomeDaFilaBullMQ(nome, executor), {
        connection: redis,
        ...(opcoes.prefixo === undefined ? {} : { prefix: opcoes.prefixo }),
      })
      queue.on('error', avisarErroDaFila)
      return queue
    },
    undefined,
    opcoes.definicoes,
  )
  const banco = criarBanco(pool)
  const repositorio = new DespachoRepository(banco)
  const vagasReais = new VagasPorEscola(redis, opcoes.prefixo, opcoes.validadeDaVagaMs)
  const vagas = opcoes.embrulharVagas?.(vagasReais) ?? vagasReais
  // Vagas e horário letivo saem da mesma linha: uma leitura por escola, guardada uma vez. Se a primeira
  // leitura da escola falha, valem as vagas e o horário padrão até a próxima tentativa, em 5 s.
  const avisarJanelaDescartada = avisoEspacado(() => logger.warn({ evento: 'despachante.janela_da_escola_invalida' }))
  const operacao = new ConfiguracaoOperacional<{ vagas: VagasPorFila; janela: JanelaLetiva }>(
    new ConfiguracaoOperacionalRepository(banco),
    (linha) => ({
      vagas: resolverVagasDaEscola(config.vagasPadrao, linha, config.vagasPorEscolaDesligadas === true),
      janela: resolverJanela(config.janelaPadrao, linha, avisarJanelaDescartada),
    }),
    { aoFalhar: avisoEspacado(() => logger.warn({ evento: 'despachante.configuracao_indisponivel' })) },
  )
  const vagasDaEscola = { daEscola: async () => (await operacao.daEscola()).vagas }
  const janelaDaEscola = { daEscola: async () => (await operacao.daEscola()).janela }

  // O aviso só chega depois de o laço abrir a escuta, e o laço só começa com o despachante construído.
  const ouvinte = new OuvinteDeJobs(
    pool,
    () => despachante.acordar(),
    avisoEspacado(() => logger.warn({ evento: 'despachante.escuta_indisponivel' })),
  )
  const despachante = new Despachante({
    repositorio,
    fila,
    vagas,
    vagasDaEscola,
    janelaDaEscola,
    relogio: opcoes.relogio ?? relogioDoSistema,
    logger,
    ouvinte,
    ...(opcoes.batimento === undefined ? {} : { batimento: opcoes.batimento }),
  }, opcoes.intervaloMs === undefined ? {} : { intervaloMs: opcoes.intervaloMs })
  const reconciliacao = new Reconciliacao(
    { repositorio, fila, vagas, vagasDaEscola, logger },
    opcoes.intervaloReconciliacaoMs === undefined ? {} : { intervaloMs: opcoes.intervaloReconciliacaoMs },
  )

  const { medidor } = opcoes
  let medicao: MedicaoDaFila | undefined
  if (medidor !== undefined) {
    observarPoolDoBanco(medidor, pool)
    observarRedis(medidor, { fila: [redis] })
    medicao = new MedicaoDaFila(
      { repositorio, vagas: vagasReais, janelaDaEscola, relogio: opcoes.relogio ?? relogioDoSistema, logger, medidor },
      opcoes.intervaloMedicaoMs === undefined ? {} : { intervaloMs: opcoes.intervaloMedicaoMs },
    )
  }

  const pronto = new Promise<void>((resolver) => {
    if (redis.status === 'ready') {
      resolver()
      return
    }
    const terminar = (): void => {
      clearTimeout(temporizador)
      redis.off('ready', terminar)
      redis.off('error', terminar)
      resolver()
    }
    // `unref`: esperar a conexão nunca segura o processo de pé por conta própria. O aviso é o que
    // impede este ramo de ser calado: quem espera pelo teto segue como se o Redis estivesse de pé.
    const temporizador = setTimeout(() => {
      logger.warn({ evento: 'despachante.redis_sem_resposta_na_montagem', tetoMs: TETO_DA_ESPERA_DO_REDIS_MS })
      terminar()
    }, TETO_DA_ESPERA_DO_REDIS_MS).unref()
    redis.on('ready', terminar)
    redis.on('error', terminar)
  })

  let encerramento: Promise<void> | undefined
  const encerrar = async (): Promise<void> => {
    await Promise.all([despachante.parar(), reconciliacao.parar(), medicao?.parar()])
    await ouvinte.fechar()
    await fila.fechar()
    await redis.quit().catch(() => redis.disconnect())
    await pool.end()
  }
  return {
    despachante,
    reconciliacao,
    ...(medicao === undefined ? {} : { medicao }),
    pronto,
    iniciar: () => {
      despachante.iniciar()
      reconciliacao.iniciar()
      medicao?.iniciar()
    },
    // Uma vez só: o SIGTERM e o fim do teste podem pedir o encerramento juntos.
    encerrar: () => (encerramento ??= encerrar()),
  }
}
