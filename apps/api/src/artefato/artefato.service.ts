import { AuditoriaRecorder, AuditoriaRepository, DomainException, type Database, type DatabaseTransaction } from '@educa/core'
import {
  CODIGOS_DA_BNCC,
  ErrorCode,
  FUNCAO_DA_TAREFA_DE_IA,
  TITULO_DA_FONTE_SEM_LINHA,
  conteudoDoArtefatoSchema,
  habilidadeEhCandidata,
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
  type SecaoDaQuestao,
  type TrocarHabilidadeRequest,
} from '@educa/shared'
import type { IaRequestRateLimit } from '../assistente/ai-request-rate-limit.js'
import { paginar } from '../http/pagination.js'
import { ExecucaoDaSessaoRepository } from '../ia/execucao.repository.js'
import type { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import { SuspensaoRepository } from '../ia/suspensao.repository.js'
import { SecoesRepository } from '../material/secoes.repository.js'
import { ArtefatoRepository, type ArtefatoLido } from './artefato.repository.js'
import { atividadeOriginal, citacoesDoConteudo, exigirMaterialEmUso } from './conferencia.js'
import { generatePdfDoArtefato, nomeDoArquivoDoPdf } from './pdf-do-artefato.js'

const registro = new AuditoriaRecorder()

/** A janela dos tetos da troca da habilidade: uma hora, contada na auditoria (classificacao-bncc, 11.0; Tech Spec, seção 4). */
export const JANELA_DA_TROCA_DE_HABILIDADE_MS = 60 * 60_000
/** Trocas de habilidade de uma pessoa na janela: 100 por hora. */
export const TROCAS_POR_USUARIO_NA_JANELA = 100
/** Trocas de habilidade da escola inteira na janela, somando os professores: 300 por hora. */
export const TROCAS_POR_ESCOLA_NA_JANELA = 300

/** Os códigos da BNCC como a auditoria os aceita: o do catálogo antigo (D82) não está na lista. */
const CODIGOS_DA_LISTA: ReadonlySet<string> = new Set(CODIGOS_DA_BNCC)
const daLista = (codigo: string): codigo is (typeof CODIGOS_DA_BNCC)[number] => CODIGOS_DA_LISTA.has(codigo)

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
 * A seção da página que cada questão da atividade cita (classificacao-bncc, 11.0; RF9): uma posição por questão, `null` quando a página não tem seção (antes do primeiro capítulo, material que saiu). O plano de aula não tem questão:
 * lista vazia. **Só se chama com o artefato já achado no alcance**: a citação vem do `jsonb`, e a escola do contexto é o que prende a leitura.
 */
async function secoesDasQuestoesDoConteudo(banco: Database, conteudo: ConteudoDoArtefato): Promise<Array<SecaoDaQuestao | null>> {
  if (conteudo.tipo !== 'atividade_objetiva') return []
  const paginas = conteudo.questoes.map((questao) => ({ materialId: questao.citacao.materialId, pagina: questao.citacao.pagina }))
  const secoes = await new SecoesRepository(banco).daPagina(paginas)
  return paginas.map(({ materialId, pagina }) => secoes.get(`${materialId}:${String(pagina)}`) ?? null)
}

/**
 * O primeiro passo da troca da habilidade, já com o artefato travado (`for update`): o artefato é do professor da sessão
 * (`NAO_ENCONTRADO` para o do colega, o de outra escola, o de outro ano e o inexistente, que respondem igual) e é uma atividade
 * com aquela questão (`ENTRADA_INVALIDA`).
 */
async function lockArtefatoParaTrocar(tx: Database | DatabaseTransaction, id: string, indice: number) {
  const artefatos = new ArtefatoRepository(tx)
  const alvo = await artefatos.lockParaTrocar(id)
  if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  const secoes = new SecoesRepository(tx)
  const recorte = await secoes.recorteDoArtefato(id)
  if (recorte === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  const conteudo = conteudoDoArtefatoSchema.parse(alvo.conteudo)
  if (conteudo.tipo !== 'atividade_objetiva' || indice >= conteudo.questoes.length) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  return { artefatos, alvo, conteudo, recorte, secoes }
}

/**
 * O código pedido tem de ser do recorte da turma e da disciplina (sem componente na disciplina, só `null` vale), e a descrição
 * vem da tabela da BNCC, nunca do cliente. `undefined` é o pedido de deixar a questão sem habilidade.
 */
async function descricaoDaHabilidadeDoRecorte(secoes: SecoesRepository, recorte: NonNullable<Awaited<ReturnType<SecoesRepository['recorteDoArtefato']>>>, codigo: string | null): Promise<string | undefined> {
  if (codigo !== null && (recorte.componente === null || !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  const descricao = codigo === null ? undefined : await secoes.descricaoDaHabilidade(codigo)
  if (codigo !== null && descricao === undefined) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  return descricao
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

  async list(consulta: ArtefatosQuery): Promise<ListaDeArtefatosResponse> {
    const linhas = await new ArtefatoRepository(this.banco).list({ ...consulta, ...(consulta.turmaId === undefined ? {} : { turmaId: consulta.turmaId.toLowerCase() }) })
    const { itens, proxima } = paginar(linhas, consulta.limite)
    return listaDeArtefatosResponseSchema.parse({ itens: itens.map(resumido), ...(proxima === undefined ? {} : { proxima }) })
  }

  async read(id: string): Promise<ArtefatoResponse> {
    const artefatos = new ArtefatoRepository(this.banco)
    const lido = await artefatos.porId(id)
    if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // O conteúdo gravado é validado de novo na leitura (regra 30, item 7).
    const conteudo = conteudoDoArtefatoSchema.parse(lido.conteudo)
    const [versoes, aplicacoes, fontes, secoesDasQuestoes, classificacaoSuspensa] = await Promise.all([
      artefatos.versoesAdaptadas(id),
      artefatos.aplicacoes(id),
      fontesDoConteudo(artefatos, conteudo),
      secoesDasQuestoesDoConteudo(this.banco, conteudo),
      new SuspensaoRepository(this.banco).estaSuspensa(FUNCAO_DA_TAREFA_DE_IA.classificar_secoes),
    ])
    return artefatoResponseSchema.parse({
      ...resumido(lido),
      conteudo,
      fontes,
      versoesAdaptadas: versoes.map(resumido),
      aplicacoes: aplicacoes.map((aplicacao) => ({ id: aplicacao.id, turmaId: aplicacao.turmaId, estado: aplicacao.estado, aplicadaEm: aplicacao.aplicadaEm.toISOString() })),
      secoesDasQuestoes,
      classificacaoSuspensa,
    })
  }

  async renomear(id: string, pedido: RenomearArtefatoRequest): Promise<ArtefatoResponse> {
    const artefatos = new ArtefatoRepository(this.banco)
    if (!(await artefatos.renomear(id, pedido.titulo))) {
      // Não renomeou: ou o artefato não está no alcance, ou é versão adaptada com a entrega já decidida.
      throw new DomainException((await artefatos.porId(id)) === undefined ? ErrorCode.NAO_ENCONTRADO : ErrorCode.CONFLITO)
    }
    return this.read(id)
  }

  /**
   * O teto das trocas de habilidade antes de o corpo ser lido (`ArtefatoTrocarHabilidadeGuard`): 100 por hora por pessoa e 300 por escola, contados na auditoria (`artefato.habilidade_trocada`), nunca por IP (regra 80, itens 1 e 3).
   * A leitura é sem trava: protege do laço, e o excesso de pedidos que passam juntos pela contagem foi aceito, porque o teto não é cota. Acima dele, `LIMITE_EXCEDIDO` com o `Retry-After` da janela inteira.
   */
  async exigirTrocaDentroDosTetos(): Promise<void> {
    const feitas = await new AuditoriaRepository(this.banco).countDaEscolaEDaPessoaDesde('artefato.habilidade_trocada', new Date(Date.now() - JANELA_DA_TROCA_DE_HABILIDADE_MS))
    if (feitas.doUsuario >= TROCAS_POR_USUARIO_NA_JANELA || feitas.daEscola >= TROCAS_POR_ESCOLA_NA_JANELA) throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DA_TROCA_DE_HABILIDADE_MS / 1_000)
  }

  /**
   * `PATCH /v1/artefatos/:id/questoes/:indice/habilidade` (classificacao-bncc, 11.0; RF9; Tech Spec, seção 5, "Troca"): o professor dono do artefato troca a habilidade de uma questão, **antes de aplicar**, por outra do recorte
   * atual (o componente da disciplina e a série da turma) ou por nenhuma. A base da classificação não muda: o que muda é o conteúdo do artefato dele, e o diagnóstico passa a usar a trocada. A ordem das respostas é a regra
   * (Tech Spec, seção 4):
   *
   * 1. o artefato é do professor da sessão, com vínculo na turma e na disciplina, ou `NAO_ENCONTRADO` (de um colega, de outra escola, de outro ano e o inexistente respondem igual, antes de qualquer outra resposta);
   * 2. `ENTRADA_INVALIDA`: o artefato não é atividade, a questão não existe, ou o código não é do recorte atual (sem componente na disciplina, só `null` vale);
   * 3. `CONFLITO`: o artefato já foi aplicado, já tem versão adaptada, ou é ele mesmo a versão adaptada (que repete a habilidade do original, `exigirAdaptacaoFiel`).
   *
   * A transação trava o artefato (`for update`) **antes de ler** a aplicação, a versão e a questão: a aplicação e a adaptação tomam a mesma trava, então quem chega depois espera e lê o que a outra deixou (P6, P7, P8). O conteúdo
   * é lido e regravado sob a trava, e por isso duas trocas de questões diferentes ficam as duas. Grava `artefato.habilidade_trocada`, sem título nem texto. Devolve o artefato lido de novo.
   */
  async trocarHabilidade(id: string, indice: number, pedido: TrocarHabilidadeRequest): Promise<ArtefatoResponse> {
    await this.banco.transaction(async (tx) => {
      const { artefatos, alvo, conteudo, recorte, secoes } = await lockArtefatoParaTrocar(tx, id, indice)
      const { codigo } = pedido
      const descricao = await descricaoDaHabilidadeDoRecorte(secoes, recorte, codigo)
      if (alvo.origemId !== null || (await artefatos.hasAplicacaoOuVersao(id))) throw new DomainException(ErrorCode.CONFLITO)
      const antes = conteudo.questoes[indice]?.habilidade ?? null
      const questoes = conteudo.questoes.map((questao, posicao) => (posicao === indice ? { ...questao, habilidade: codigo === null || descricao === undefined ? null : { codigo, descricao } } : questao))
      await artefatos.saveConteudo(id, { ...conteudo, questoes })
      await registro.save(tx, 'artefato.habilidade_trocada', {
        entidadeId: id,
        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: antes !== null && !daLista(antes.codigo) },
        depois: { indice, codigo },
      })
    })
    return this.read(id)
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
    return { nome: nomeDoArquivoDoPdf(rascunho ? `rascunho ${conteudo.titulo}` : conteudo.titulo), bytes: await generatePdfDoArtefato(conteudo, new Map(fontes.map((fonte) => [fonte.materialId, fonte])), { rascunho }) }
  }

  async adaptar(id: string, pedido: AdaptarArtefatoRequest): Promise<ExecucaoAceitaResponse> {
    await this.limite.count()
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
