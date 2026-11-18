import {
  classificarSecoes,
  LLMError,
  requireEscolaId,
  SECOES_POR_EXECUCAO,
  textoDaSecao,
  type ClassificarSecoesInput,
  type CodigoDeFalhaDaExecucao,
  type Database,
  type DatabaseTransaction,
  type Meter,
  globalMeter,
} from '@educa/core'
import { ErrorCode, habilidadeEhCandidata, type ComponenteBncc, type ResultadoGravado, type SerieDoRecorte } from '@educa/shared'
import type { EntradaDaTarefa, ExecucaoCommand, ExecucaoLida, Preparado, SaidaDaTarefa } from '../ia/execucao-command.js'
import { MetricasDaExecucao } from '../ia/metricas-da-execucao.js'
import { SecoesRepository, type HabilidadeCandidata } from './secoes.repository.js'

/** O que o `preparar` leva ao `concluir`: se não há o que mandar ao modelo e, nesse caso, se foi por falta de candidata (a execução limpa as seções, P11) ou de seção viva (nada a fazer). */
export interface LidoDaClassificacao {
  readonly semCandidatas: boolean
  /** O recorte (componente e séries do material) de cada seção que foi ao modelo: o `concluir` só grava o código que é candidato do recorte da própria seção. */
  readonly recorteDaSecao: ReadonlyMap<string, RecorteDaSecao>
  /** As seções vivas sem recorte (material sem série, ou disciplina sem componente): não vão ao modelo e voltam a `nao_agendada`, como na execução sem candidata (P11). */
  readonly semRecorte: readonly string[]
}

/** O componente da disciplina e as séries do material de uma seção: o que decide quais habilidades da BNCC ela pode receber. */
export interface RecorteDaSecao {
  readonly componente: ComponenteBncc
  readonly series: readonly SerieDoRecorte[]
}

/**
 * A classificação do material pela BNCC (classificacao-bncc, tarefa 4.0; Tech Spec, seção 5 "Classificação"; PRD, RF5): o comando da tarefa `classificar_secoes`, da fila `lote`. **Da rotina**: a execução não tem
 * pessoa nem ano (`solicitada_por` nulo), e o contexto do job é só a escola. O `ExecucaoProcessor` a roda fora do horário letivo, confere a função suspensa antes de `rodando`, adia o que o provedor não atendeu e
 * soma `falhas_seguidas` quando a saída vem inválida (`aoFalharDefinitivo`).
 *
 * - `preparar`: lê só as seções **vivas** da execução (sem `corrigida_em`, material `pronto` e não excluído); monta o texto delas (título, começo e subtítulos, `textoDaSecao`) e as candidatas do recorte do material
 *   (componente da disciplina e séries). Sem seção viva, ou sem candidata, **conclui sem modelo e sem consumo**. A seção sem recorte não vai ao modelo e volta a `nao_agendada`. A execução é de um recorte (a 5.0 agrupa as
 *   seções por ele), mas o comando não confia: as candidatas dos recortes que vierem juntos são unidas **sem corte** (acima de 300 o gateway recusa a entrada, `IA_ENTRADA_INVALIDA`), e cada código só se grava se for candidato do recorte da própria seção.
 * - `concluir`: grava na transação em que a execução conclui (`SecoesRepository.gravarClassificacao`), e devolve quantas seções gravou.
 */
export class ClassificarSecoesCommand implements ExecucaoCommand<EntradaDaTarefa<typeof classificarSecoes>, SaidaDaTarefa<typeof classificarSecoes>, LidoDaClassificacao> {
  readonly tarefa = classificarSecoes
  readonly fila = 'lote' as const
  readonly daRotina = true as const
  readonly #metricas: MetricasDaExecucao

  constructor(
    private readonly banco: Database,
    medidor: Meter = globalMeter(),
  ) {
    this.#metricas = new MetricasDaExecucao(medidor)
  }

  async preparar(execucao: ExecucaoLida): Promise<Preparado<ClassificarSecoesInput, LidoDaClassificacao>> {
    const repositorio = new SecoesRepository(this.banco)
    const semModelo = (semCandidatas: boolean): Preparado<ClassificarSecoesInput, LidoDaClassificacao> => ({
      entrada: { candidatas: [], secoes: [] },
      lido: { semCandidatas, recorteDaSecao: new Map(), semRecorte: [] },
      semModelo: true,
    })
    const vivas = await repositorio.vivasDaExecucao(execucao.id, SECOES_POR_EXECUCAO)
    if (vivas.length === 0) return semModelo(false)

    const { candidatas, recorteDaSecao } = await this.#recortesDasVivas(repositorio, vivas)
    if (candidatas.size === 0) return semModelo(true)

    const secoes: ClassificarSecoesInput['secoes'] = []
    for (const secao of vivas.filter((viva) => recorteDaSecao.has(viva.secaoId))) {
      const { comeco, subtitulos } = textoDaSecao(await repositorio.paginasDaSecao(secao.materialId, secao.paginaInicial, secao.paginaFinal), secao.titulo)
      secoes.push({ secaoId: secao.secaoId, titulo: secao.titulo, comeco, subtitulos })
    }
    // A união dos recortes nunca é cortada: acima do teto do schema (300) o gateway recusa a entrada, `IA_ENTRADA_INVALIDA`, sem chamar o modelo.
    const ordenadas = [...candidatas.values()].sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
    const semRecorte = vivas.filter((viva) => !recorteDaSecao.has(viva.secaoId)).map((viva) => viva.secaoId)
    return { entrada: { candidatas: ordenadas, secoes }, lido: { semCandidatas: false, recorteDaSecao, semRecorte } }
  }

  /** O recorte de cada seção viva que tem um, e as candidatas de todos eles unidas; cada recorte distinto é lido uma vez. */
  async #recortesDasVivas(
    repositorio: SecoesRepository,
    vivas: Awaited<ReturnType<SecoesRepository['vivasDaExecucao']>>,
  ): Promise<{ candidatas: Map<string, HabilidadeCandidata>; recorteDaSecao: Map<string, RecorteDaSecao> }> {
    const recorte = await repositorio.recorteDosMateriais([...new Set(vivas.map((secao) => secao.disciplinaId))], [...new Set(vivas.map((secao) => secao.materialId))])
    const candidatas = new Map<string, HabilidadeCandidata>()
    const recorteDaSecao = new Map<string, RecorteDaSecao>()
    const recortesJaLidos = new Set<string>()
    for (const secao of vivas) {
      const componente: ComponenteBncc | null | undefined = recorte.componentes.get(secao.disciplinaId)
      const series: readonly SerieDoRecorte[] = recorte.series.get(secao.materialId) ?? []
      if (componente === null || componente === undefined || series.length === 0) continue
      recorteDaSecao.set(secao.secaoId, { componente, series })
      const chave = `${componente}|${series.map((serie) => `${serie.etapa}${String(serie.ano)}`).sort().join(',')}`
      if (recortesJaLidos.has(chave)) continue
      recortesJaLidos.add(chave)
      for (const candidata of await repositorio.candidatas(componente, series)) candidatas.set(candidata.codigo, candidata)
    }
    return { candidatas, recorteDaSecao }
  }

  async concluir(saida: SaidaDaTarefa<typeof classificarSecoes>, lido: LidoDaClassificacao, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> {
    for (const resposta of saida.secoes) {
      const recorte = lido.recorteDaSecao.get(resposta.secaoId)
      if (recorte === undefined || resposta.codigos.some((codigo) => !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new LLMError('IA_SAIDA_INVALIDA')
    }
    const repositorio = new SecoesRepository(tx)
    const gravadas = await repositorio.gravarClassificacao(execucaoId, saida.secoes)
    if (lido.semRecorte.length > 0) await repositorio.limparDaExecucao(execucaoId, lido.semRecorte)
    const escolaId = requireEscolaId()
    for (const gravada of gravadas) this.#metricas.esperaDaClassificacao(escolaId, gravada.segundosDesdeOEnvio)
    return { tipo: 'classificacao_do_material', secoes: gravadas.length }
  }

  /** Sem seção viva não há o que fazer; sem candidata, as seções não corrigidas da execução voltam a `nao_agendada` (P11). Nos dois, a execução conclui sem modelo e sem consumo. */
  async concluirSemModelo(lido: LidoDaClassificacao, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> {
    if (lido.semCandidatas) await new SecoesRepository(tx).limparDaExecucao(execucaoId)
    return { tipo: 'classificacao_do_material', secoes: 0 }
  }

  /** Só a saída inválida soma em `falhas_seguidas` (a interrompida, a suspensa e o tempo esgotado não são culpa da seção). Roda na transação da passagem a `falhou`. */
  async aoFalharDefinitivo(codigo: CodigoDeFalhaDaExecucao, tx: DatabaseTransaction, execucaoId: string): Promise<void> {
    if (codigo === ErrorCode.IA_SAIDA_INVALIDA) await new SecoesRepository(tx).somarFalha(execucaoId)
  }
}
