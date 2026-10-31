import { DomainException, LLMError, gerarAtividadeObjetiva, gerarPlanoDeAula, type Database, type DatabaseTransaction } from '@educa/core'
import {
  ErrorCode,
  conteudoDoArtefatoSchema,
  QUESTOES_PADRAO_POR_ATIVIDADE,
  type ConteudoDoArtefato,
  type FerramentaGeradora,
  type Habilidade,
  type ParametrosDeFerramenta,
  type GerarComFerramentaRequest,
  type ExecucaoAceitaResponse,
  type ResultadoGravado,
} from '@educa/shared'
import { contextoDaTarefa } from '../assistente/assistente.service.js'
import { exigirCitacoesEntregues } from '../assistente/citacoes.js'
import { ExecucaoDoPedidoRepository } from '../assistente/execucao-do-pedido.repository.js'
import type { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { TurmaDoProfessorRepository } from '../assistente/turma-do-professor.repository.js'
import type { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import type { TrechoSearch, TrechoDoMaterial } from '../material/trecho-search.js'
import { ArtefatoRepository } from './artefato.repository.js'
import { citacoesDoConteudo, habilidadesParaOTema } from './conferencia.js'

/** Quantos trechos do material vão para a ferramenta (o teto das tarefas de geração). */
export const TRECHOS_NA_FERRAMENTA = 12
/**
 * A duração do plano de aula. O contrato da ferramenta não pede duração (turma, disciplina, tema e quantidade), e a
 * tarefa precisa de uma: vale a da aula comum, 50 minutos, até a ferramenta ganhar o campo.
 */
export const DURACAO_PADRAO_DO_PLANO_DE_AULA_MIN = 50

const TAREFA_DA_FERRAMENTA = { atividade_objetiva: 'gerar_atividade_objetiva', plano_de_aula: 'gerar_plano_de_aula' } as const

/** O que a execução leu antes de chamar o modelo: os parâmetros gravados, o contexto da turma, as habilidades e os trechos entregues. */
interface Preparado {
  readonly parametros: ParametrosDeFerramenta
  readonly contexto: { serie: string; disciplina: string }
  readonly habilidades: Habilidade[]
  readonly entregues: readonly TrechoDoMaterial[]
}

/**
 * Gerar com uma ferramenta (MVP, A2; D18, D74): **um caso de uso só**, o mesmo para o formulário de Ferramentas e para
 * o cartão que a conversa abre depois de o professor aceitar a proposta do Assistente. Não existe segundo caminho de
 * geração: o chat não gera, só pergunta.
 *
 * - O professor pede para **turma e disciplina em que tem vínculo confirmado**; as de outra pessoa respondem como
 *   inexistentes. O vínculo é conferido no `POST` e de novo quando a execução roda.
 * - Os trechos vêm do material **`pronto` e não excluído da disciplina, da escola do contexto**, pela busca do tema.
 *   **Sem trecho, a execução falha com `MATERIAL_INSUFICIENTE`**: sem página para citar, nada é gerado (regra 30, item 12).
 * - O artefato nasce na **mesma transação** que conclui a execução, com o conteúdo validado por
 *   `conteudoDoArtefatoSchema`, e **só se toda citação apontar para um trecho que foi entregue à tarefa**.
 * - O que se guarda em `execucao_agente.entrada` são os parâmetros da ferramenta. O artefato é rascunho do professor
 *   (autonomia 1): não vai a aluno nenhum por aqui, e por isso não nasce com entrega.
 */
export class FerramentasService {
  constructor(
    private readonly banco: Database,
    private readonly agendador: ExecucaoScheduler,
    private readonly limite: IaRequestRateLimit,
    private readonly trechos: TrechoSearch,
  ) {}

  async gerar(ferramenta: FerramentaGeradora, pedido: GerarComFerramentaRequest): Promise<ExecucaoAceitaResponse> {
    await this.limite.contar()
    const { chaveEnvio, ...resto } = pedido
    const parametros: ParametrosDeFerramenta = { ...resto, turmaId: resto.turmaId.toLowerCase(), disciplinaId: resto.disciplinaId.toLowerCase() }
    if ((await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(parametros.turmaId, parametros.disciplinaId)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)

    const tarefa = TAREFA_DA_FERRAMENTA[ferramenta]
    let preparado: Preparado | undefined
    const preparar = async (): Promise<Preparado> => {
      preparado = await this.#preparar(chaveEnvio, tarefa)
      return preparado
    }
    const aoConcluir = (saida: ConteudoDoArtefato, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> => {
      if (preparado === undefined) throw new LLMError('IA_ENTRADA_INVALIDA')
      return this.#gravar(saida, preparado, tx, execucaoId)
    }
    const trechosDaTarefa = (lido: Preparado) => lido.entregues.map(({ materialId, pagina, texto }) => ({ materialId, pagina, texto }))

    if (ferramenta === 'atividade_objetiva') {
      return this.agendador.agendar({
        tarefa: gerarAtividadeObjetiva,
        chaveEnvio,
        entradaDaExecucao: { tarefa: 'gerar_atividade_objetiva', parametros },
        entrada: async () => {
          const lido = await preparar()
          return { tema: lido.parametros.tema, quantidade: lido.parametros.quantidade ?? QUESTOES_PADRAO_POR_ATIVIDADE, contexto: lido.contexto, habilidades: lido.habilidades, trechos: trechosDaTarefa(lido) }
        },
        aoConcluir,
      })
    }
    return this.agendador.agendar({
      tarefa: gerarPlanoDeAula,
      chaveEnvio,
      entradaDaExecucao: { tarefa: 'gerar_plano_de_aula', parametros },
      entrada: async () => {
        const lido = await preparar()
        return { tema: lido.parametros.tema, duracaoMinutos: DURACAO_PADRAO_DO_PLANO_DE_AULA_MIN, contexto: lido.contexto, habilidades: lido.habilidades, trechos: trechosDaTarefa(lido) }
      },
      aoConcluir,
    })
  }

  /**
   * Roda depois do `202`, no contexto de quem pediu. Relê os parâmetros **gravados** com a execução (e não os do corpo
   * de um reenvio), confere de novo o vínculo, e busca os trechos. Os ids dos parâmetros são `jsonb`, sem FK: é a
   * releitura pelo repository, no escopo, que os confere.
   */
  async #preparar(chaveEnvio: string, tarefa: 'gerar_atividade_objetiva' | 'gerar_plano_de_aula'): Promise<Preparado> {
    const { parametros } = await new ExecucaoDoPedidoRepository(this.banco).entradaDaChave(chaveEnvio, tarefa)
    const turma = await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(parametros.turmaId, parametros.disciplinaId)
    if (turma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // A porta de trechos não confere papel: o vínculo confirmado na disciplina foi conferido logo acima.
    const achados = await this.trechos.buscar({ texto: parametros.tema, disciplinaId: parametros.disciplinaId, limite: TRECHOS_NA_FERRAMENTA })
    if (achados.length === 0) throw new LLMError('MATERIAL_INSUFICIENTE')
    // A busca escolhe por relevância; a tarefa recebe as páginas escolhidas na ordem do material, como quem lê o capítulo.
    const entregues = [...achados].sort((a, b) => a.materialId.localeCompare(b.materialId) || a.pagina - b.pagina)
    return { parametros, contexto: contextoDaTarefa(turma), habilidades: habilidadesParaOTema(turma.disciplina, turma.serie.etapa, parametros.tema), entregues }
  }

  /** Na transação que conclui a execução: confere as citações contra o que foi entregue, valida o conteúdo e grava o artefato. */
  async #gravar(saida: ConteudoDoArtefato, { parametros, entregues }: Preparado, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> {
    const conteudo = conteudoDoArtefatoSchema.safeParse(saida)
    // A versão adaptada só nasce pela Adaptação, com entrega: a geração nunca grava conteúdo com `adaptacao`.
    if (!conteudo.success || (conteudo.data.tipo === 'atividade_objetiva' && conteudo.data.adaptacao !== undefined)) throw new LLMError('IA_SAIDA_INVALIDA')
    exigirCitacoesEntregues(citacoesDoConteudo(conteudo.data), entregues)
    const artefatoId = await new ArtefatoRepository(tx).criar({ turmaId: parametros.turmaId, disciplinaId: parametros.disciplinaId, conteudo: conteudo.data, execucaoId })
    return { tipo: 'artefato', artefatoId, entregaId: null }
  }
}
