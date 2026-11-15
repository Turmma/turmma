import { DomainException, type Database } from '@educa/core'
import {
  ErrorCode,
  TITULO_DA_FONTE_SEM_LINHA,
  conteudoDoArtefatoSchema,
  artefatoResponseSchema,
  listaDeArtefatosResponseSchema,
  type ArtefatosQuery,
  type AdaptarArtefatoRequest,
  type RenomearArtefatoRequest,
  type ArtefatoResponse,
  type ConteudoDoArtefato,
  type ExecucaoAceitaResponse,
  type FonteDoArtefato,
  type ListaDeArtefatosResponse,
} from '@educa/shared'
import type { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { paginar } from '../http/pagination.js'
import { ExecucaoDaSessaoRepository } from '../ia/execucao.repository.js'
import type { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { ArtefatoRepository, type ArtefatoLido } from './artefato.repository.js'
import { atividadeOriginal, citacoesDoConteudo, exigirMaterialEmUso } from './conferencia.js'
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

/**
 * Os materiais que o conteúdo cita, na ordem em que a primeira citação aparece, cada um com o título e a edição de agora e
 * se foi substituído (RF11). **Só se chama com o artefato já achado no alcance**: os ids vêm do conteúdo dele, e a escola
 * é a do contexto. O material que a linha não alcança (a do expurgo, a de outra escola que o `jsonb` citasse) vira
 * "material da escola", sem edição: a citação continua valendo, com a página.
 */
async function fontesDoConteudo(artefatos: ArtefatoRepository, conteudo: ConteudoDoArtefato): Promise<FonteDoArtefato[]> {
  const ids = [...new Set(citacoesDoConteudo(conteudo).map((citacao) => citacao.materialId))]
  const lidas = await artefatos.fontesDosMateriais(ids)
  return ids.map((materialId) => ({ materialId, ...(lidas.get(materialId) ?? { titulo: TITULO_DA_FONTE_SEM_LINHA, edicao: null, substituido: false }) }))
}

/**
 * O artefato do professor (MVP, A2; D63, D67): listar, abrir, renomear, exportar em PDF e pedir a versão adaptada.
 *
 * - **Só o professor com vínculo confirmado na turma e na disciplina do artefato** o alcança, e as duas são as do
 *   artefato lido do banco. O de outra turma, de outra disciplina da mesma turma, de outra escola e o inexistente
 *   respondem o mesmo `NAO_ENCONTRADO`. Coordenação e aluno não leem.
 * - **Renomear muda só o título**, na coluna e no conteúdo, juntos. A versão adaptada **já decidida** não se renomeia
 *   (`CONFLITO`): o que foi aprovado ou rejeitado fica como estava quando a professora decidiu.
 * - **As `fontes`** de `GET /:id` são o título, a edição e o "edição anterior" de cada material citado, lidos agora, e só do artefato
 *   que o professor alcança (ingestao-do-material, 10.0; RF11). O PDF as usa na linha "Fonte" de cada questão ou etapa.
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
    // O conteúdo gravado é validado de novo na leitura (regra 30, item 7).
    const conteudo = conteudoDoArtefatoSchema.parse(lido.conteudo)
    const [versoes, aplicacoes, fontes] = await Promise.all([artefatos.versoesAdaptadas(id), artefatos.aplicacoes(id), fontesDoConteudo(artefatos, conteudo)])
    return artefatoResponseSchema.parse({
      ...resumido(lido),
      conteudo,
      fontes,
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
    // O id do material vem do `jsonb`, sem FK: título e edição são relidos pela escola do contexto, e o que não for dela não aparece.
    const fontes = await fontesDoConteudo(new ArtefatoRepository(this.banco), conteudo)
    return { nome: nomeDoArquivoDoPdf(rascunho ? `rascunho ${conteudo.titulo}` : conteudo.titulo), bytes: await gerarPdfDoArtefato(conteudo, new Map(fontes.map((fonte) => [fonte.materialId, fonte])), { rascunho }) }
  }

  async adaptar(id: string, pedido: AdaptarArtefatoRequest): Promise<ExecucaoAceitaResponse> {
    await this.limite.contar()
    const lido = await new ArtefatoRepository(this.banco).porId(id)
    if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const original = atividadeOriginal(lido)
    // O reenvio da chave que esta pessoa já teve aceita devolve a mesma execução: quem decide o que o pedido vira é a execução, que confere de novo abaixo. A chave não é ligada ao `artefatoId`: o artefato do reenvio nunca é o que a execução lê (a entrada gravada manda), e a conferência dela vale para o gravado.
    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio))?.tarefa === 'adaptar_atividade'
    // Antes do `202`: sem material em uso, não há execução, consumo nem chamada ao modelo.
    if (!reenvio) await exigirMaterialEmUso(new ArtefatoRepository(this.banco), original)

    return this.agendador.agendar({
      comando: 'adaptar_atividade',
      chaveEnvio: pedido.chaveEnvio,
      entradaDaExecucao: { tarefa: 'adaptar_atividade', artefatoId: id, tipos: pedido.tipos, ...(pedido.tempoExtraPercentual === undefined ? {} : { tempoExtraPercentual: pedido.tempoExtraPercentual }) },
    })
  }
}
