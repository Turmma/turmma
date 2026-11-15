import { DomainException, LLMError, adaptarAtividade, type Database, type DatabaseTransaction } from '@educa/core'
import { ErrorCode, conteudoDeAtividadeSchema, type AdaptacaoAplicada, type ConteudoDeAtividade, type ExecucaoInput, type ResultadoGravado } from '@educa/shared'
import { EntregaRepository } from '../entrega/entrega.repository.js'
import type { EntradaDaTarefa, ExecucaoCommand, ExecucaoLida, Preparado, SaidaDaTarefa } from '../ia/execucao-command.js'
import { ArtefatoRepository } from './artefato.repository.js'
import { atividadeOriginal, exigirAdaptacaoFiel, exigirMaterialEmUso } from './conferencia.js'

/** O que a execução leu antes de chamar o modelo, e que a conclusão confere: o original, o que a professora pediu e o artefato de que partiu. */
export interface LidoDaAdaptacao {
  readonly original: ConteudoDeAtividade
  readonly adaptacao: AdaptacaoAplicada
  readonly artefatoId: string
}

/**
 * Adaptar uma atividade (D35, D67): a versão adaptada e a entrega **`pendente`** nascem na mesma transação, depois de
 * conferido que o gabarito, as habilidades e as citações são os do original (regra 70, item 3). Aprovar é da pessoa, em
 * `POST /v1/entregas/:id/decidir`: nada aqui decide, e a execução não grava autor de decisão.
 */
export class AdaptarAtividadeCommand implements ExecucaoCommand<EntradaDaTarefa<typeof adaptarAtividade>, SaidaDaTarefa<typeof adaptarAtividade>, LidoDaAdaptacao> {
  readonly tarefa = adaptarAtividade
  readonly fila = 'ferramenta' as const

  constructor(private readonly banco: Database) {}

  /**
   * Relê pelo id da execução a entrada **gravada** (e não a do corpo de um reenvio) e o artefato dela no alcance: é `jsonb`
   * sem FK. Entre o `202` e a execução a licença pode vencer ou a edição ser trocada: o texto do material só vai ao
   * modelo se ainda estiver em uso.
   */
  async preparar(execucao: ExecucaoLida): Promise<Preparado<EntradaDaTarefa<typeof adaptarAtividade>, LidoDaAdaptacao>> {
    // O agendador já conferiu que a execução é da tarefa deste comando.
    const gravada = execucao.entrada as Extract<ExecucaoInput, { tarefa: 'adaptar_atividade' }>
    const origem = await new ArtefatoRepository(this.banco).porId(gravada.artefatoId)
    if (origem === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const adaptacao: AdaptacaoAplicada = { tipos: gravada.tipos, ...(gravada.tempoExtraPercentual === undefined ? {} : { tempoExtraPercentual: gravada.tempoExtraPercentual }) }
    const original = atividadeOriginal(origem)
    await exigirMaterialEmUso(new ArtefatoRepository(this.banco), original)
    return { entrada: { conteudo: original, adaptacao }, lido: { original, adaptacao, artefatoId: origem.id } }
  }

  async concluir(saida: SaidaDaTarefa<typeof adaptarAtividade>, lido: LidoDaAdaptacao, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> {
    const adaptada = conteudoDeAtividadeSchema.safeParse(saida)
    if (!adaptada.success) throw new LLMError('IA_SAIDA_INVALIDA')
    // O original relido dentro da transação: é a turma **dele**, e não a do pedido, que a versão e a entrega levam.
    const origem = await new ArtefatoRepository(tx).porId(lido.artefatoId)
    if (origem === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    exigirAdaptacaoFiel(atividadeOriginal(origem), adaptada.data, lido.adaptacao)
    const artefatoId = await new ArtefatoRepository(tx).criar({ turmaId: origem.turmaId, disciplinaId: origem.disciplinaId, conteudo: adaptada.data, execucaoId, origemId: origem.id })
    // A entrega nasce pendente, aqui, junto da versão: ou ficam as duas, ou nenhuma.
    const entregaId = await new EntregaRepository(tx).criarDaVersaoAdaptada({ turmaId: origem.turmaId, artefatoId, execucaoId })
    return { tipo: 'artefato', artefatoId, entregaId }
  }
}
