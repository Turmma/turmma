import { adaptarAtividade, DomainException, LLMError, type Database } from '@educa/core'
import {
  ErrorCode,
  conteudoDeAtividadeSchema,
  conteudoDoArtefatoSchema,
  artefatoResponseSchema,
  listaDeArtefatosResponseSchema,
  type AdaptacaoAplicada,
  type ArtefatosQuery,
  type ConteudoDeAtividade,
  type AdaptarArtefatoRequest,
  type RenomearArtefatoRequest,
  type ArtefatoResponse,
  type ExecucaoAceitaResponse,
  type ListaDeArtefatosResponse,
} from '@educa/shared'
import { ExecucaoDoPedidoRepository } from '../assistente/execucao-do-pedido.repository.js'
import type { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { EntregaRepository } from '../entrega/entrega.repository.js'
import { paginar } from '../http/pagination.js'
import type { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { ArtefatoRepository, type ArtefatoLido } from './artefato.repository.js'
import { citacoesDoConteudo, exigirAdaptacaoFiel } from './conferencia.js'
import { gerarPdfDoArtefato, nomeDoArquivoDoPdf } from './pdf-do-artefato.js'

export interface PdfDoArtefato {
  readonly nome: string
  readonly bytes: Buffer
}

/** O artefato na listagem (DTO explícito; regra 20, item 4): a adaptação é sempre o tipo, nunca o motivo nem o aluno. */
function resumido(lido: ArtefatoLido): Record<string, unknown> {
  const conteudo = conteudoDoArtefatoSchema.parse(lido.conteudo)
  return {
    id: lido.id,
    tipo: lido.tipo,
    titulo: lido.titulo,
    turmaId: lido.turmaId,
    disciplinaId: lido.disciplinaId,
    origemId: lido.origemId,
    adaptacao: conteudo.tipo === 'atividade_objetiva' ? (conteudo.adaptacao ?? null) : null,
    entrega: lido.entregaId === null || lido.entregaEstado === null ? null : { id: lido.entregaId, estado: lido.entregaEstado, decididaEm: lido.entregaDecididaEm?.toISOString() ?? null },
    criadoEm: lido.criadoEm.toISOString(),
  }
}

/** A atividade que pode ser adaptada: objetiva, e que não é ela mesma uma versão adaptada. Fora disso, `CONFLITO`. */
function atividadeOriginal(lido: ArtefatoLido): ConteudoDeAtividade {
  const conteudo = conteudoDeAtividadeSchema.safeParse(lido.conteudo)
  if (lido.tipo !== 'atividade_objetiva' || lido.origemId !== null || !conteudo.success || conteudo.data.adaptacao !== undefined) throw new DomainException(ErrorCode.CONFLITO)
  return conteudo.data
}

/**
 * O artefato do professor (MVP, A2; D63, D67): listar, abrir, renomear, exportar em PDF e pedir a versão adaptada.
 *
 * - **Só o professor com vínculo confirmado na turma e na disciplina do artefato** o alcança, e as duas são as do
 *   artefato lido do banco. O de outra turma, de outra disciplina da mesma turma, de outra escola e o inexistente
 *   respondem o mesmo `NAO_ENCONTRADO`. Coordenação e aluno não leem.
 * - **Renomear muda só o título**, na coluna e no conteúdo, juntos. A versão adaptada **já decidida** não se renomeia
 *   (`CONFLITO`): o que foi aprovado ou rejeitado fica como estava quando a professora decidiu.
 * - **O PDF** é gerado na hora, sem guardar arquivo e sem dado de pessoa; não gera auditoria (contrato, decisão 24).
 *   **A versão adaptada sai limpa só com a entrega `aprovada`**; `pendente`, sai como rascunho marcado em toda página e
 *   sem a frase "revisado"; `rejeitada`, não sai (`VERSAO_ADAPTADA_NAO_APROVADA`).
 * - **A Adaptação recebe só os tipos e o tempo extra** (D35, D67): não existe campo de texto, e nada sobre aluno entra.
 *   Só atividade objetiva se adapta, e versão adaptada não se adapta de novo (`CONFLITO`). **A versão adaptada e a
 *   entrega `pendente` nascem na mesma transação**, depois de conferido que o gabarito, as habilidades e as citações
 *   são os do original (regra 70, item 3). Aprovar é da pessoa, em `POST /v1/entregas/:id/decidir`: nada aqui decide.
 */
export class ArtefatoService {
  constructor(
    private readonly banco: Database,
    private readonly agendador: ExecucaoScheduler,
    private readonly limite: IaRequestRateLimit,
  ) {}

  async listar(consulta: ArtefatosQuery): Promise<ListaDeArtefatosResponse> {
    const linhas = await new ArtefatoRepository(this.banco).listar({ ...consulta, ...(consulta.turmaId === undefined ? {} : { turmaId: consulta.turmaId.toLowerCase() }) })
    const { itens, proxima } = paginar(linhas, consulta.limite)
    return listaDeArtefatosResponseSchema.parse({ itens: itens.map(resumido), ...(proxima === undefined ? {} : { proxima }) })
  }

  async ler(id: string): Promise<ArtefatoResponse> {
    const artefatos = new ArtefatoRepository(this.banco)
    const lido = await artefatos.porId(id)
    if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const [versoes, aplicacoes] = await Promise.all([artefatos.versoesAdaptadas(id), artefatos.aplicacoes(id)])
    return artefatoResponseSchema.parse({
      ...resumido(lido),
      // O conteúdo gravado é validado de novo na leitura (regra 30, item 7).
      conteudo: conteudoDoArtefatoSchema.parse(lido.conteudo),
      versoesAdaptadas: versoes.map(resumido),
      aplicacoes: aplicacoes.map((aplicacao) => ({ id: aplicacao.id, turmaId: aplicacao.turmaId, estado: aplicacao.estado, aplicadaEm: aplicacao.aplicadaEm.toISOString() })),
    })
  }

  async renomear(id: string, pedido: RenomearArtefatoRequest): Promise<ArtefatoResponse> {
    const artefatos = new ArtefatoRepository(this.banco)
    if (!(await artefatos.renomear(id, pedido.titulo))) {
      // Não renomeou: ou o artefato não está no alcance, ou é versão adaptada com a entrega já decidida.
      throw new DomainException((await artefatos.porId(id)) === undefined ? ErrorCode.NAO_ENCONTRADO : ErrorCode.CONFLITO)
    }
    return this.ler(id)
  }

  async pdf(id: string): Promise<PdfDoArtefato> {
    const lido = await new ArtefatoRepository(this.banco).porId(id)
    if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // A versão adaptada só sai limpa depois de aprovada (regra 70, itens 3 e 6): pendente, sai como rascunho, para a
    // professora ver a fonte ampliada antes de decidir; rejeitada, ou sem entrega, não sai.
    const rascunho = lido.origemId !== null && lido.entregaEstado === 'pendente'
    if (lido.origemId !== null && lido.entregaEstado !== 'aprovada' && !rascunho) throw new DomainException(ErrorCode.VERSAO_ADAPTADA_NAO_APROVADA)
    const conteudo = conteudoDoArtefatoSchema.parse(lido.conteudo)
    // O id do material vem do `jsonb`, sem FK: o título é relido pela escola do contexto, e o que não for dela não aparece.
    const titulos = await new ArtefatoRepository(this.banco).titulosDosMateriais([...new Set(citacoesDoConteudo(conteudo).map((citacao) => citacao.materialId))])
    return { nome: nomeDoArquivoDoPdf(rascunho ? `rascunho ${conteudo.titulo}` : conteudo.titulo), bytes: await gerarPdfDoArtefato(conteudo, titulos, { rascunho }) }
  }

  async adaptar(id: string, pedido: AdaptarArtefatoRequest): Promise<ExecucaoAceitaResponse> {
    await this.limite.contar()
    const lido = await new ArtefatoRepository(this.banco).porId(id)
    if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    atividadeOriginal(lido)

    // O que a execução leu antes de chamar o modelo, e que a conclusão confere: só existe depois de `entrada` rodar.
    let lida: { original: ConteudoDeAtividade; adaptacao: AdaptacaoAplicada; artefatoId: string } | undefined
    return this.agendador.agendar({
      tarefa: adaptarAtividade,
      chaveEnvio: pedido.chaveEnvio,
      entradaDaExecucao: { tarefa: 'adaptar_atividade', artefatoId: id, tipos: pedido.tipos, ...(pedido.tempoExtraPercentual === undefined ? {} : { tempoExtraPercentual: pedido.tempoExtraPercentual }) },
      entrada: async () => {
        // A entrada gravada, e não a do corpo de um reenvio; e o artefato dela relido no alcance, que é `jsonb` sem FK.
        const gravada = await new ExecucaoDoPedidoRepository(this.banco).entradaDaChave(pedido.chaveEnvio, 'adaptar_atividade')
        const origem = await new ArtefatoRepository(this.banco).porId(gravada.artefatoId)
        if (origem === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        const adaptacao: AdaptacaoAplicada = { tipos: gravada.tipos, ...(gravada.tempoExtraPercentual === undefined ? {} : { tempoExtraPercentual: gravada.tempoExtraPercentual }) }
        lida = { original: atividadeOriginal(origem), adaptacao, artefatoId: origem.id }
        return { conteudo: lida.original, adaptacao }
      },
      aoConcluir: async (saida, tx, execucaoId) => {
        if (lida === undefined) throw new LLMError('IA_ENTRADA_INVALIDA')
        const adaptada = conteudoDeAtividadeSchema.safeParse(saida)
        if (!adaptada.success) throw new LLMError('IA_SAIDA_INVALIDA')
        // O original relido dentro da transação: é a turma **dele**, e não a do pedido, que a versão e a entrega levam.
        const origem = await new ArtefatoRepository(tx).porId(lida.artefatoId)
        if (origem === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        exigirAdaptacaoFiel(atividadeOriginal(origem), adaptada.data, lida.adaptacao)
        const artefatoId = await new ArtefatoRepository(tx).criar({ turmaId: origem.turmaId, disciplinaId: origem.disciplinaId, conteudo: adaptada.data, execucaoId, origemId: origem.id })
        // A entrega nasce pendente, aqui, junto da versão: ou ficam as duas, ou nenhuma.
        const entregaId = await new EntregaRepository(tx).criarDaVersaoAdaptada({ turmaId: origem.turmaId, artefatoId, execucaoId })
        return { tipo: 'artefato', artefatoId, entregaId }
      },
    })
  }
}
