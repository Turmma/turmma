import {
  avisoEspacado,
  DONO_DAS_VAGAS_DO_SISTEMA,
  estaNaJanela,
  executarNoContexto,
  METRICAS,
  proximaAbertura,
  resumirErro,
  ROTULO_ESCOLA,
  type ConfiguracaoOperacional,
  type DespachoRepository,
  type JanelaLetiva,
  type LoggerBase,
  type MedicaoDeFalhos,
  type MedicaoDePendentes,
  type Meter,
  type Relogio,
  type VagasPorEscola,
} from '@educa/nucleo'
import type { QueueName } from '@educa/shared'
import { contextoDaEscola, FILA_QUE_SEGURA_NAO_URGENTE } from './despachante.js'

/** De quanto em quanto tempo o despachante mede as filas. A exportação lê a última medição. */
export const INTERVALO_MEDICAO_DA_FILA_MS = 5_000
/**
 * Por quanto tempo a série de uma escola que esvaziou a fila segue exportada em zero. Sem isto, a última
 * espera ficaria no Prometheus por cinco minutos depois de o job começar, e o alerta seguiria disparado.
 */
export const RETENCAO_DA_SERIE_ZERADA_MS = 10 * 60_000

export interface DependenciasDaMedicao {
  repositorio: Pick<DespachoRepository, 'medirPendentes' | 'medirFalhos'>
  vagas: Pick<VagasPorEscola, 'emUso'>
  /** Horário letivo da escola do contexto: o não urgente segurado nele não conta como espera (10.0). */
  janelaDaEscola: Pick<ConfiguracaoOperacional<JanelaLetiva>, 'daEscola'>
  relogio: Relogio
  logger: LoggerBase
  medidor: Meter
}

export interface OpcoesDaMedicao {
  intervaloMs?: number
  /** Relógio monotônico da retenção da série zerada. Só o teste troca. */
  agoraMs?: () => number
}

/** O que a medição exporta de uma fila numa escola. */
export interface SerieDaFila {
  fila: QueueName
  escolaId: string | null
  /** Segundos; `undefined` se nenhum job está esperando de fato (só ativos, ou só não urgentes segurados). */
  esperaS: number | undefined
  pendentes: number
  /** `undefined` se o Redis de fila não respondeu nesta medição. */
  vagasEmUso: number | undefined
}

/**
 * A espera do job mais antigo que ainda não começou, em segundos, contada no relógio do banco.
 *
 * Na fila de lote, o não urgente não espera enquanto a escola está em aula: ele está segurado de
 * propósito (10.0), e contá-lo faria o alerta de espera disparar todo dia letivo. Fora do horário, a
 * espera dele conta a partir de quando ele pôde sair (o fim do horário letivo do dia em que foi criado,
 * ou a própria criação, se foi criado fora dele), e não da criação.
 *
 * Nas outras filas não há não urgente segurado: vale o mais antigo dos dois.
 */
export function esperaDoMaisAntigo(medicao: MedicaoDePendentes, janela: { janela: JanelaLetiva; emAula: boolean } | undefined): number | undefined {
  const agoraMs = medicao.agora.getTime()
  const desde: number[] = []
  if (medicao.urgenteCriadoEm !== null) desde.push(medicao.urgenteCriadoEm.getTime())
  if (medicao.naoUrgenteCriadoEm !== null) {
    if (medicao.fila !== FILA_QUE_SEGURA_NAO_URGENTE) desde.push(medicao.naoUrgenteCriadoEm.getTime())
    else if (janela !== undefined && !janela.emAula) desde.push(proximaAbertura(janela.janela, medicao.naoUrgenteCriadoEm).getTime())
  }
  if (desde.length === 0) return undefined
  return Math.max(0, agoraMs - Math.min(...desde)) / 1_000
}

/**
 * Mede, a cada 5 s, cada fila de cada escola com job não terminado: `job.espera_mais_antiga_s`,
 * `job.pendentes` e `fila.vagas_em_uso`, com `fila` e `escola_id` (Tech Spec, seção 5). As duas primeiras
 * vêm só de `job_registro.criado_em`, então seguem subindo com o Redis de fila fora; as vagas vêm do
 * Redis, e somem da exportação enquanto ele não responde.
 *
 * Mede também `job.falhos{tipo}` (44.0): quantos jobs de cada tipo terminaram `falhou` e seguem em `job_registro`.
 * Só o tipo, nunca a escola nem o `dados`. É contado a cada medição do que está na tabela, e não guardado: o tipo cuja
 * última linha o expurgo levou deixa de ser exportado na medição seguinte, sem retenção de série zerada.
 *
 * A medição roda num laço próprio, fora da rodada de publicação: consulta lenta aqui não atrasa despacho,
 * e a rodada que para por Redis fora não para a medição. A exportação só lê o resultado guardado.
 *
 * Com o Postgres fora, a medição anterior sai da exportação: melhor sem dado que com uma espera parada no
 * tempo. Os dois despachantes exportam a mesma medição, cada um com a sua instância; o painel usa `max`.
 */
export class MedicaoDaFila {
  readonly #intervaloMs: number
  readonly #agoraMs: () => number
  readonly #series = new Map<string, SerieDaFila & { vistaEmMs: number }>()
  #falhos: MedicaoDeFalhos[] = []
  readonly #avisarFalha: (erro: unknown) => void
  readonly #observar: Parameters<Meter['addBatchObservableCallback']>[0]
  readonly #instrumentos: Parameters<Meter['addBatchObservableCallback']>[1]
  #ativa = false
  #laco: Promise<void> | undefined
  #encerrarEspera: (() => void) | undefined

  constructor(
    private readonly dependencias: DependenciasDaMedicao,
    opcoes: OpcoesDaMedicao = {},
  ) {
    this.#intervaloMs = opcoes.intervaloMs ?? INTERVALO_MEDICAO_DA_FILA_MS
    this.#agoraMs = opcoes.agoraMs ?? (() => performance.now())
    let ultimoErro: unknown
    const aviso = avisoEspacado(() => dependencias.logger.warn({ evento: 'despachante.medicao_indisponivel', erro: resumirErro(ultimoErro) }))
    this.#avisarFalha = (erro) => {
      ultimoErro = erro
      aviso()
    }
    const { medidor } = dependencias
    const espera = medidor.createObservableGauge(METRICAS.esperaMaisAntiga, { description: 'Segundos de espera do job mais antigo que ainda não começou' })
    const pendentes = medidor.createObservableGauge(METRICAS.pendentes, { description: 'Jobs que ainda não começaram' })
    const vagas = medidor.createObservableGauge(METRICAS.vagasEmUso, { description: 'Vagas tomadas agora' })
    const falhos = medidor.createObservableGauge(METRICAS.falhos, { description: 'Jobs que terminaram falhos e seguem em job_registro, por tipo' })
    this.#instrumentos = [espera, pendentes, vagas, falhos]
    this.#observar = (observador) => {
      for (const serie of this.#series.values()) {
        const rotulos = { fila: serie.fila, [ROTULO_ESCOLA]: serie.escolaId ?? DONO_DAS_VAGAS_DO_SISTEMA }
        observador.observe(pendentes, serie.pendentes, rotulos)
        if (serie.esperaS !== undefined) observador.observe(espera, serie.esperaS, rotulos)
        if (serie.vagasEmUso !== undefined) observador.observe(vagas, serie.vagasEmUso, rotulos)
      }
      for (const { tipo, falhos: total } of this.#falhos) observador.observe(falhos, total, { tipo })
    }
    medidor.addBatchObservableCallback(this.#observar, this.#instrumentos)
  }

  /** As séries da última medição, como a exportação as lê. */
  series(): SerieDaFila[] {
    return [...this.#series.values()].map(({ vistaEmMs: _vistaEmMs, ...serie }) => serie)
  }

  iniciar(): void {
    if (this.#ativa) return
    this.#ativa = true
    this.#laco = this.lacar()
  }

  async parar(): Promise<void> {
    this.#ativa = false
    this.#encerrarEspera?.()
    await this.#laco
    this.dependencias.medidor.removeBatchObservableCallback(this.#observar, this.#instrumentos)
  }

  /** Uma medição. Falha do Postgres esvazia a exportação; falha do Redis só tira as vagas. */
  async medir(): Promise<void> {
    await this.medirFalhos()
    let medicoes: MedicaoDePendentes[]
    try {
      medicoes = await this.dependencias.repositorio.medirPendentes()
    } catch (erro) {
      this.#avisarFalha(erro)
      this.#series.clear()
      return
    }
    const agoraMs = this.#agoraMs()
    const vistas = new Set<string>()
    let redisResponde = true
    for (const medicao of medicoes) {
      const chave = `${medicao.fila}:${medicao.escolaId ?? ''}`
      vistas.add(chave)
      let vagasEmUso: number | undefined
      if (redisResponde) {
        try {
          vagasEmUso = await this.dependencias.vagas.emUso(medicao.fila, medicao.escolaId)
        } catch (erro) {
          // Redis fora ou travado: não adianta perguntar pelas outras escolas nesta medição.
          redisResponde = false
          this.#avisarFalha(erro)
        }
      }
      const janela = await this.janelaSeSegura(medicao)
      this.#series.set(chave, {
        fila: medicao.fila,
        escolaId: medicao.escolaId,
        esperaS: esperaDoMaisAntigo(medicao, janela),
        pendentes: medicao.pendentes,
        vagasEmUso,
        vistaEmMs: agoraMs,
      })
    }
    for (const [chave, serie] of this.#series) {
      if (vistas.has(chave)) continue
      if (agoraMs - serie.vistaEmMs > RETENCAO_DA_SERIE_ZERADA_MS) {
        this.#series.delete(chave)
        continue
      }
      // A fila da escola esvaziou: zero, e não a última espera, até a retenção vencer.
      this.#series.set(chave, { ...serie, esperaS: 0, pendentes: 0, vagasEmUso: redisResponde ? 0 : undefined })
    }
  }

  /** Os falhos por tipo. Falha da consulta tira só `job.falhos` da exportação: a espera da fila não depende dela. */
  private async medirFalhos(): Promise<void> {
    try {
      this.#falhos = await this.dependencias.repositorio.medirFalhos()
    } catch (erro) {
      this.#avisarFalha(erro)
      this.#falhos = []
    }
  }

  /** O horário letivo da escola, só quando há não urgente no lote para decidir se está segurado. */
  private async janelaSeSegura(medicao: MedicaoDePendentes): Promise<{ janela: JanelaLetiva; emAula: boolean } | undefined> {
    if (medicao.fila !== FILA_QUE_SEGURA_NAO_URGENTE || medicao.naoUrgenteCriadoEm === null) return undefined
    const { janelaDaEscola, relogio } = this.dependencias
    const janela = await executarNoContexto(contextoDaEscola(medicao.escolaId), () => janelaDaEscola.daEscola())
    return { janela, emAula: estaNaJanela(janela, relogio.agora()) }
  }

  private async lacar(): Promise<void> {
    while (this.#ativa) {
      try {
        await this.medir()
      } catch (erro) {
        // Defeito fora do previsto (a janela da escola, por exemplo): a medição seguinte tenta de novo.
        this.#avisarFalha(erro)
      }
      if (!this.#ativa) return
      await new Promise<void>((resolver) => {
        const encerrar = (): void => {
          clearTimeout(prazo)
          this.#encerrarEspera = undefined
          resolver()
        }
        const prazo = setTimeout(encerrar, this.#intervaloMs)
        this.#encerrarEspera = encerrar
      })
    }
  }
}
