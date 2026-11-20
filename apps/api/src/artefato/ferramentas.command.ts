import { DomainException, LLMError, gerarAtividadeObjetiva, gerarPlanoDeAula, globalMeter, requireEscolaId, type Database, type DatabaseTransaction, type Meter } from '@educa/core'
import { ErrorCode, conteudoDoArtefatoSchema, QUESTOES_PADRAO_POR_ATIVIDADE, type ExecucaoInput, type ParametrosDeFerramenta, type ResultadoGravado, type ConteudoDoArtefato } from '@educa/shared'
import { exigirCitacoesEntregues } from '../assistente/citacoes.js'
import { TurmaDoProfessorRepository } from '../assistente/turma-do-professor.repository.js'
import { contextoDaTarefa } from '../ia/contexto-da-tarefa.js'
import type { EntradaDaTarefa, ExecucaoCommand, ExecucaoLida, Preparado, SaidaDaTarefa } from '../ia/execucao-command.js'
import { MetricasDaExecucao } from '../ia/metricas-da-execucao.js'
import type { TrechoComHabilidades, TrechoSearch } from '../material/trecho-search.js'
import { ArtefatoRepository } from './artefato.repository.js'
import { anularHabilidadesForaDaSecao, citacoesDoConteudo } from './conferencia.js'

/** Quantos trechos do material vão para a ferramenta (o teto das tarefas de geração). */
export const TRECHOS_NA_FERRAMENTA = 12
/**
 * A duração do plano de aula. O contrato da ferramenta não pede duração (turma, disciplina, tema e quantidade), e a
 * tarefa precisa de uma: vale a da aula comum, 50 minutos, até a ferramenta ganhar o campo.
 */
export const DURACAO_PADRAO_DO_PLANO_DE_AULA_MIN = 50

/** O que a execução leu antes de chamar o modelo: os parâmetros gravados, o contexto da turma e os trechos entregues, cada um com as habilidades da BNCC da seção da página (classificacao-bncc, 10.0). */
export interface LidoDaFerramenta {
  readonly parametros: ParametrosDeFerramenta
  readonly contexto: { serie: string; disciplina: string }
  readonly entregues: readonly TrechoComHabilidades[]
}

const trechosDaTarefa = (lido: LidoDaFerramenta) => lido.entregues.map(({ materialId, pagina, texto, habilidades }) => ({ materialId, pagina, texto, habilidades: habilidades.map(({ codigo, descricao }) => ({ codigo, descricao })) }))

/**
 * Relê, **pelo id da execução**, os parâmetros **gravados** (e não os do corpo de um reenvio), confere de novo o vínculo
 * e busca os trechos. Os ids dos parâmetros são `jsonb`, sem FK: é a releitura pelo repository, no escopo, que os confere.
 * Quem chama já conferiu que a execução é da tarefa deste comando (`ExecucaoScheduler`), por isso a entrada é a dela.
 */
async function readDaFerramenta(banco: Database, trechos: TrechoSearch, parametros: ParametrosDeFerramenta): Promise<LidoDaFerramenta> {
  const turma = await new TurmaDoProfessorRepository(banco).turmaComDisciplina(parametros.turmaId, parametros.disciplinaId)
  if (turma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  // A porta de trechos não confere papel: o vínculo confirmado na disciplina foi conferido logo acima.
  const achados = await trechos.findComHabilidades({ texto: parametros.tema, disciplinaId: parametros.disciplinaId, serieId: turma.serieId, limite: TRECHOS_NA_FERRAMENTA })
  if (achados.length === 0) throw new LLMError('MATERIAL_INSUFICIENTE')
  // A busca escolhe por relevância; a tarefa recebe as páginas escolhidas na ordem do material, como quem lê o capítulo.
  const entregues = [...achados].sort((a, b) => a.materialId.localeCompare(b.materialId) || a.pagina - b.pagina)
  return { parametros, contexto: contextoDaTarefa(turma), entregues }
}

/**
 * Na transação que conclui a execução: confere as citações contra o que foi entregue, valida o conteúdo, **anula a habilidade que não é da seção da página citada** (a questão fica sem habilidade, e `ia.habilidade_anulada`
 * soma) e grava o artefato.
 */
async function saveArtefato(saida: ConteudoDoArtefato, { parametros, entregues }: LidoDaFerramenta, tx: DatabaseTransaction, execucaoId: string, metricas: MetricasDaExecucao): Promise<ResultadoGravado> {
  const conteudo = conteudoDoArtefatoSchema.safeParse(saida)
  // A versão adaptada só nasce pela Adaptação, com entrega: a geração nunca grava conteúdo com `adaptacao`.
  if (!conteudo.success || (conteudo.data.tipo === 'atividade_objetiva' && conteudo.data.adaptacao !== undefined)) throw new LLMError('IA_SAIDA_INVALIDA')
  exigirCitacoesEntregues(citacoesDoConteudo(conteudo.data), entregues)
  const { conteudo: gravado, anuladas } = anularHabilidadesForaDaSecao(conteudo.data, entregues)
  if (anuladas > 0) metricas.habilidadeAnulada(requireEscolaId(), anuladas)
  const artefatoId = await new ArtefatoRepository(tx).create({ turmaId: parametros.turmaId, disciplinaId: parametros.disciplinaId, conteudo: gravado, execucaoId })
  return { tipo: 'artefato', artefatoId, entregaId: null }
}

/** Os parâmetros da execução gravada: o agendador já conferiu que ela é da tarefa deste comando. */
const parametrosGravados = (execucao: ExecucaoLida): ParametrosDeFerramenta => (execucao.entrada as Extract<ExecucaoInput, { parametros: ParametrosDeFerramenta }>).parametros

/**
 * Gerar a atividade objetiva (MVP, A2; D18, D74): o artefato nasce na **mesma transação** que conclui a execução, com o
 * conteúdo validado, e **só se toda citação apontar para um trecho que foi entregue à tarefa**. É rascunho da professora
 * (autonomia 1): não vai a aluno nenhum por aqui, e por isso não nasce com entrega.
 */
export class GerarAtividadeObjetivaCommand implements ExecucaoCommand<EntradaDaTarefa<typeof gerarAtividadeObjetiva>, SaidaDaTarefa<typeof gerarAtividadeObjetiva>, LidoDaFerramenta> {
  readonly tarefa = gerarAtividadeObjetiva
  readonly fila = 'ferramenta' as const
  readonly #metricas: MetricasDaExecucao

  constructor(
    private readonly banco: Database,
    private readonly trechos: TrechoSearch,
    medidor: Meter = globalMeter(),
  ) {
    this.#metricas = new MetricasDaExecucao(medidor)
  }

  async preparar(execucao: ExecucaoLida): Promise<Preparado<EntradaDaTarefa<typeof gerarAtividadeObjetiva>, LidoDaFerramenta>> {
    const lido = await readDaFerramenta(this.banco, this.trechos, parametrosGravados(execucao))
    return {
      lido,
      entrada: { tema: lido.parametros.tema, quantidade: lido.parametros.quantidade ?? QUESTOES_PADRAO_POR_ATIVIDADE, contexto: lido.contexto, trechos: trechosDaTarefa(lido) },
    }
  }

  concluir(saida: SaidaDaTarefa<typeof gerarAtividadeObjetiva>, lido: LidoDaFerramenta, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> {
    return saveArtefato(saida, lido, tx, execucaoId, this.#metricas)
  }
}

/** Gerar o plano de aula: o mesmo caso de uso da atividade, com a duração padrão da aula comum. */
export class GerarPlanoDeAulaCommand implements ExecucaoCommand<EntradaDaTarefa<typeof gerarPlanoDeAula>, SaidaDaTarefa<typeof gerarPlanoDeAula>, LidoDaFerramenta> {
  readonly tarefa = gerarPlanoDeAula
  readonly fila = 'ferramenta' as const
  readonly #metricas: MetricasDaExecucao

  constructor(
    private readonly banco: Database,
    private readonly trechos: TrechoSearch,
    medidor: Meter = globalMeter(),
  ) {
    this.#metricas = new MetricasDaExecucao(medidor)
  }

  async preparar(execucao: ExecucaoLida): Promise<Preparado<EntradaDaTarefa<typeof gerarPlanoDeAula>, LidoDaFerramenta>> {
    const lido = await readDaFerramenta(this.banco, this.trechos, parametrosGravados(execucao))
    return { lido, entrada: { tema: lido.parametros.tema, duracaoMinutos: DURACAO_PADRAO_DO_PLANO_DE_AULA_MIN, contexto: lido.contexto, trechos: trechosDaTarefa(lido) } }
  }

  concluir(saida: SaidaDaTarefa<typeof gerarPlanoDeAula>, lido: LidoDaFerramenta, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> {
    return saveArtefato(saida, lido, tx, execucaoId, this.#metricas)
  }
}
