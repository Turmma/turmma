import { DomainException, type Database } from '@educa/core'
import { ErrorCode, type FerramentaGeradora, type ParametrosDeFerramenta, type GerarComFerramentaRequest, type ExecucaoAceitaResponse } from '@educa/shared'
import type { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { TurmaDoProfessorRepository } from '../assistente/turma-do-professor.repository.js'
import { ExecucaoDaSessaoRepository } from '../ia/execucao.repository.js'
import type { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import type { TrechoSearch } from '../material/trecho-search.js'

const TAREFA_DA_FERRAMENTA = { atividade_objetiva: 'gerar_atividade_objetiva', plano_de_aula: 'gerar_plano_de_aula' } as const

/**
 * Gerar com uma ferramenta (MVP, A2; D18, D74): **um caso de uso só**, o mesmo para o formulário de Ferramentas e para
 * o cartão que a conversa abre depois de o professor aceitar a proposta do Assistente. Não existe segundo caminho de
 * geração: o chat não gera, só pergunta.
 *
 * - O professor pede para **turma e disciplina em que tem vínculo confirmado**; as de outra pessoa respondem como
 *   inexistentes. O vínculo é conferido no `POST` e de novo quando a execução roda.
 * - O que roda depois do `202` é o comando da tarefa (`ferramentas.command.ts`): relê os parâmetros gravados com a execução,
 *   busca os trechos do material (sem trecho, `MATERIAL_INSUFICIENTE`) e grava o artefato, com toda citação apontando para
 *   um trecho entregue à tarefa.
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
    const daTurma = await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(parametros.turmaId, parametros.disciplinaId)
    if (daTurma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const tarefa = TAREFA_DA_FERRAMENTA[ferramenta]
    // O reenvio da chave que esta pessoa já teve aceita devolve a mesma execução, mesmo que o material tenha saído do alcance depois do `202`: o pedido existe, e quem decide o que ele vira é a execução.
    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(chaveEnvio))?.tarefa === tarefa
    // Antes do `202`: sem material da série (o único venceu, ou ainda está `processando`), não há execução, consumo nem chamada ao modelo (RF8).
    if (!reenvio && !(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId: parametros.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)

    return this.agendador.agendar({ comando: tarefa, chaveEnvio, entradaDaExecucao: { tarefa, parametros } })
  }
}
