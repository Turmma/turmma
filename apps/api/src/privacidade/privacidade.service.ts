import {
  FileStorageUnavailableError,
  ArquivoDoTitularRepository,
  Compartilhamento,
  DomainException,
  IncidenteDaEscolaRepository,
  AuditoriaRecorder,
  RetencaoDaEscolaRepository,
  SuboperadorDaEscolaRepository,
  DEFAULT_RETRY_AFTER_SECONDS,
  diaDeUso,
  requestIdentity,
  postgresErrorIn,
  systemClock,
  type FileStorage,
  type ArquivoLido,
  type Database,
  type JobOutbox,
  type Clock,
} from '@educa/nucleo'
import { CicloDeVidaService } from '@educa/nucleo/ciclo-de-vida'
import {
  CATEGORIAS_DE_RETENCAO,
  CHAVES_DE_PRAZO_FIXO,
  ErrorCode,
  pedidoDoTitularSchema,
  buscaDeTitularesResponseSchema,
  incidentesResponseSchema,
  pedidosResponseSchema,
  previaDoTitularResponseSchema,
  retencaoResponseSchema,
  suboperadoresResponseSchema,
  arquivoResponseSchema,
  meusDadosResponseSchema,
  FINALIDADE_DO_ARQUIVO_DO_PROPRIO_TITULAR,
  FINALIDADE_DO_ATENDIMENTO_DO_TITULAR,
  FINALIDADE_DO_REGISTRO_DE_INCIDENTE,
  nomeDoArquivoDoTitular,
  PRAZOS_FIXOS,
  retencaoDaEscola,
  TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE,
  TIPO_MONTAR_ARQUIVO,
  TIPOS_DE_PEDIDO_COM_ARQUIVO,
  VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS,
  type FinalidadeDoArquivo,
  type ItemDoPedido,
  type PaginationQuery,
  type PedidoDoTitular,
  type ArquivoResponse,
  type MeusDadosResponse,
  type VersaoDoArquivo,
  type RegistroDePedido,
  type BuscaDeTitularesResponse,
  type IncidentesResponse,
  type PedidosResponse,
  type PreviaDoTitularResponse,
  type RetencaoResponse,
  type SuboperadoresResponse,
} from '@educa/shared'
import { PedidosRepository, type PedidoAchado } from './pedidos.repository.js'
import { TitularesRepository, type TitularAchadoNoBanco, type TitularParaOPedido } from './titulares.repository.js'

const registro = new AuditoriaRecorder()

/** Quantos pedidos "Meus dados" lista: a pessoa tem poucos, e a lista é paginada pelo teto (regra 80, item 8). */
const PEDIDOS_EM_MEUS_DADOS = 50

/** O que o serviço precisa de fora do banco: a fila de jobs, o armazém do arquivo e o relógio (injetado nos testes). */
export interface DependenciasDoPrivacidadeService {
  readonly enfileirador: Pick<JobOutbox, 'enfileirar'>
  readonly armazem: Pick<FileStorage, 'existe' | 'urlDeDownload'>
  readonly relogio?: Clock
}

/** O erro do pedido que não está no estado que a ação pede: tipado, sem dizer o estado de quem (F3, RF16). */
const pedidoEmEstadoInvalido = (): DomainException => new DomainException(ErrorCode.PEDIDO_EM_ESTADO_INVALIDO)

/**
 * A privacidade da escola, para a coordenação (F3, RF3 e RF10 a RF13b). A retenção é o catálogo em código com os
 * ajustes da escola do token (`RetencaoDaEscolaRepository`), já com as travas: o prazo que o expurgo aplica. A busca,
 * a prévia e os pedidos do titular são lidos e gravados pelos repositórios daqui, com a escola do contexto, e cada
 * leitura de pessoa vai para a auditoria **na mesma transação**, com a finalidade fixa (regra 20, item 10).
 *
 * A resposta é montada campo a campo e conferida pelo schema estrito do contrato. O nome do titular só aparece
 * enquanto ele é `usuario` da escola; depois da eliminação, a lista e o detalhe mostram "Titular eliminado". **O
 * pedido sobre a própria pessoa** (o titular de quem pediu, pelo mesmo `conta_id`) responde como inexistente, em
 * qualquer rota, inclusive na lista: quem atende um pedido nunca é quem o pediu.
 */
export class PrivacidadeService {
  readonly #relogio: Clock

  constructor(
    private readonly banco: Database,
    private readonly dependencias: DependenciasDoPrivacidadeService,
  ) {
    this.#relogio = dependencias.relogio ?? systemClock
  }

  async retencao(): Promise<RetencaoResponse> {
    const categorias = retencaoDaEscola(await new RetencaoDaEscolaRepository(this.banco).ajustes())
    return retencaoResponseSchema.parse({
      categorias: categorias.map(({ categoria, meses, origem, limitadaPor }) => ({
        categoria,
        descricao: CATEGORIAS_DE_RETENCAO[categoria].descricao,
        contaDe: CATEGORIAS_DE_RETENCAO[categoria].contaDe,
        meses,
        origem,
        limitadaPor,
      })),
      prazosFixos: CHAVES_DE_PRAZO_FIXO.map((chave) => ({ chave, descricao: PRAZOS_FIXOS[chave].descricao, prazo: PRAZOS_FIXOS[chave].prazo })),
    })
  }

  /**
   * As empresas que recebem dado da escola do token, vigentes e passadas (F3, RF7), pelo `SuboperadorDaEscolaRepository`. A
   * resposta é montada campo a campo e conferida pelo schema estrito: não leva id, contrato, quem cadastrou nem as outras
   * escolas da lista.
   */
  async suboperadores(): Promise<SuboperadoresResponse> {
    const lidos = await new SuboperadorDaEscolaRepository(this.banco).daEscola()
    return suboperadoresResponseSchema.parse({
      suboperadores: lidos.map((lido) => ({
        chave: lido.chave,
        nome: lido.nome,
        finalidade: lido.finalidade,
        pais: lido.pais,
        categorias: lido.categorias,
        vedaTreinamento: lido.vedaTreinamento,
        inicio: lido.inicio.toISOString(),
        fim: lido.fim === null ? null : lido.fim.toISOString(),
      })),
    })
  }

  /**
   * Os incidentes que afetaram a escola do token (F3, RF9), pelo `IncidenteDaEscolaRepository`. A resposta é montada campo a campo
   * e conferida pelo schema estrito: só a seção da escola, com o id dela. Não leva quem registrou, o id do incidente, as outras
   * escolas nem os números delas.
   */
  async incidentes(): Promise<IncidentesResponse> {
    const lidos = await new IncidenteDaEscolaRepository(this.banco).daEscola()
    return incidentesResponseSchema.parse({
      incidentes: lidos.map((lido) => ({
        id: lido.id,
        conhecidoEm: lido.conhecidoEm.toISOString(),
        circunstancias: lido.circunstancias,
        categorias: lido.categorias,
        titularesEstimados: lido.titularesEstimados,
        risco: lido.risco,
        contencao: lido.contencao,
        correcao: lido.correcao,
        avisadoEm: lido.avisadoEm.toISOString(),
        confirmadoEm: lido.confirmadoEm === null ? null : lido.confirmadoEm.toISOString(),
      })),
      prazoLegal: TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE,
    })
  }

  /**
   * Confirma o recebimento do aviso e grava `incidente.confirmado`, na mesma transação, **só se esta chamada confirmou**: o `update
   * … where confirmado_em is null` decide a corrida no banco, a primeira fica, e a segunda (clique duplo, duas coordenações) acha a
   * seção já confirmada e responde igual, sem erro e sem segunda linha na auditoria. A seção de outra escola e a inexistente são
   * `NAO_ENCONTRADO`.
   */
  async confirmarIncidente(id: string): Promise<void> {
    await this.banco.transaction(async (tx) => {
      const incidentes = new IncidenteDaEscolaRepository(tx)
      if (await incidentes.confirmar(id)) {
        await registro.gravar(tx, 'incidente.confirmado', { entidadeId: id, finalidade: FINALIDADE_DO_REGISTRO_DE_INCIDENTE })
        return
      }
      if (!(await incidentes.existe(id))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    })
  }

  /**
   * `POST /v1/privacidade/titulares/busca` (F3, RF10): até 20 titulares cujo nome casa com o termo, com matrícula,
   * turmas e disciplinas, para a coordenação escolher a pessoa certa entre homônimos. A leitura é auditada com os ids
   * na mesma transação (`titular.buscado`), e **o termo nunca vai a log nem à auditoria**: é nome de pessoa (RF17).
   */
  async buscaDeTitulares(termo: string): Promise<BuscaDeTitularesResponse> {
    return this.banco.transaction(async (tx) => {
      const achados = await new TitularesRepository(tx).buscar(termo)
      await registro.gravar(tx, 'titular.buscado', { entidadeId: this.#escola(), depois: { ids: achados.map(({ id }) => id) }, finalidade: FINALIDADE_DO_ATENDIMENTO_DO_TITULAR })
      return buscaDeTitularesResponseSchema.parse({ titulares: achados })
    })
  }

  /**
   * `GET /v1/privacidade/titulares/:id/previa` (F3, RF10 e RF11; D64): o que a escola guarda do titular, antes de o
   * pedido existir. O aluno traz a contagem por categoria; o professor, **só as categorias de cadastro e vínculo, sem
   * contagem e sem período**, e a resposta é igual para quem usou e para quem não usou a IA. `homonimo` é a mesma
   * regra da troca de nome. Auditada como `titular.previa_lida`; o titular de outra escola, o de quem pediu e o
   * inexistente respondem igual.
   */
  async previaDoTitular(titularId: string): Promise<PreviaDoTitularResponse> {
    return this.banco.transaction(async (tx) => {
      const titulares = new TitularesRepository(tx)
      const titular = await this.#titularAlvo(titulares, titularId)
      await registro.gravar(tx, 'titular.previa_lida', { entidadeId: titular.id, finalidade: FINALIDADE_DO_ATENDIMENTO_DO_TITULAR })
      const base = { id: titular.id, nome: titular.nome, homonimo: await titulares.homonimo(titular.id) }
      if (titular.papel === 'professor') {
        return previaDoTitularResponseSchema.parse({ ...base, papel: 'professor', categorias: [...titulares.categoriasDoProfessor()] })
      }
      const contagens = await titulares.contagemPorCategoria(titular.id)
      return previaDoTitularResponseSchema.parse({ ...base, papel: 'aluno', categorias: contagens.map(({ categoria, quantidade }) => ({ categoria, quantidade })) })
    })
  }

  /**
   * `POST /v1/privacidade/pedidos` (F3, RF10): registra o pedido `recebido`, com a foto do compartilhamento calculada
   * no momento do registro (F3, tarefa 12.0) e o `homonimo`. **A chave de envio decide primeiro**: a mesma chave, com o
   * mesmo conteúdo e da mesma coordenação, devolve sempre o mesmo pedido, mesmo em paralelo; com outro titular, tipo,
   * solicitante ou chegada, ou de outra coordenação, responde `NAO_ENCONTRADO` sem gravar. Só quem gravou registra
   * `pedido.registrado`, na mesma transação. **A eliminação nasce `agendado`** (F3, tarefa 14.0): `eliminar_em` em 7 dias, o
   * acesso da pessoa suspenso e as sessões abertas dela encerradas, tudo na mesma transação do pedido, com `pedido.agendado`
   * depois do `pedido.registrado`. Uma segunda eliminação do mesmo titular, com outra chave, responde
   * `PEDIDO_EM_ESTADO_INVALIDO` (o único parcial decide a corrida). A chegada no futuro é recusada com
   * `ENTRADA_INVALIDA` antes de qualquer escrita, **pelo dia de São Paulo (`diaDeUso`)**; o check do banco, pelo
   * `current_date` da sessão, é só a segunda camada e mais frouxa.
   */
  async registrarPedido(pedido: RegistroDePedido): Promise<PedidoDoTitular> {
    if (pedido.chegouEm > diaDeUso(new Date())) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    return this.banco.transaction(async (tx) => {
      const titulares = new TitularesRepository(tx)
      const titular = await this.#titularAlvo(titulares, pedido.titularId)
      const homonimo = await titulares.homonimo(titular.id)
      const pedidos = new PedidosRepository(tx)
      const compartilhamento = await new Compartilhamento(tx).doTitular({ titularId: titular.id, papel: titular.papel })
      // Acesso e portabilidade geram arquivo: nascem `em_preparacao` e enfileiram o job **na mesma transação**, então o pedido
      // existe se, e somente se, o job existe. A eliminação nasce `agendado`, com o acesso suspenso na mesma transação (14.0).
      // Compartilhamento e correção não têm o que montar e nascem `recebido`.
      const geraArquivo = TIPOS_DE_PEDIDO_COM_ARQUIVO.some((tipo) => tipo === pedido.tipo)
      const estado = geraArquivo ? 'em_preparacao' : pedido.tipo === 'eliminacao' ? 'agendado' : 'recebido'
      const registrado = await this.#gravarPedido(pedidos, { ...pedido, papelTitular: titular.papel, homonimo, compartilhamento, estado })
      const id = registrado?.id
      if (registrado !== undefined) {
        if (geraArquivo) await this.dependencias.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId: registrado.id })
        await registro.gravar(tx, 'pedido.registrado', {
          entidadeId: registrado.id,
          depois: { titularId: titular.id, papelTitular: titular.papel, tipo: pedido.tipo, solicitante: pedido.solicitante, chegouEm: pedido.chegouEm },
        })
        if (registrado.eliminarEm !== null) {
          // Pedido → usuário, nesta ordem (a mesma do cancelar): o pedido acabou de ser inserido, e só então o usuário é travado.
          const { sessoesEncerradas } = await new CicloDeVidaService(this.banco).agendarEliminacao(titular.id, tx)
          await registro.gravar(tx, 'pedido.agendado', { entidadeId: registrado.id, depois: { eliminarEm: registrado.eliminarEm.toISOString(), sessoesEncerradas } })
        }
      }
      const lido = id === undefined ? await pedidos.daChave(pedido.chaveEnvio) : await pedidos.de(id)
      if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      // A chave que colide só devolve o pedido que é este mesmo: outro titular, tipo, solicitante ou chegada responde
      // como inexistente, e nada é gravado nem auditado (a transação não escreveu nada quando a chave já existia).
      if (id === undefined && (lido.titularId !== pedido.titularId || lido.tipo !== pedido.tipo || lido.solicitante !== pedido.solicitante || lido.chegouEm !== pedido.chegouEm)) {
        throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      }
      return this.#montarPedido(lido, await titulares.titularesParaOPedido([lido.titularId]))
    })
  }

  /**
   * `GET /v1/privacidade/pedidos` (F3, RF16): a página de pedidos da escola, com nome e turma enquanto o titular
   * existe. A lista audita `pedidos.listados` com os ids da página, na mesma transação da leitura; o pedido sobre a
   * própria pessoa não entra.
   */
  async pedidos(consulta: PaginationQuery): Promise<PedidosResponse> {
    return this.banco.transaction(async (tx) => {
      const titulares = new TitularesRepository(tx)
      const { usuarioId } = requestIdentity()
      const pedidos = await new PedidosRepository(tx).listar(consulta.pagina, consulta.limite, { usuarioId, contaId: await titulares.contaDeQuemPediu() })
      const daPágina = pedidos.slice(0, consulta.limite)
      await registro.gravar(tx, 'pedidos.listados', { entidadeId: this.#escola(), depois: { ids: daPágina.map(({ id }) => id) }, finalidade: FINALIDADE_DO_ATENDIMENTO_DO_TITULAR })
      const nomes = await titulares.titularesParaOPedido(daPágina.map(({ titularId }) => titularId))
      const itens: ItemDoPedido[] = daPágina.map((pedido) => {
        const { id, tipo, solicitante, chegouEm, estado } = this.#montarPedido(pedido, nomes)
        return { id, tipo, solicitante, chegouEm, estado, titular: this.#titularDe(pedido, nomes) }
      })
      return pedidosResponseSchema.parse({ itens, ...(pedidos.length > consulta.limite ? { proxima: daPágina.at(-1)?.id } : {}) })
    })
  }

  /** `GET /v1/privacidade/pedidos/:id` (F3, RF16): o detalhe, com a foto do compartilhamento, `nomeTrocado` e `homonimo`. Auditado como `pedido.lido`. */
  async pedido(id: string): Promise<PedidoDoTitular> {
    return this.banco.transaction(async (tx) => {
      const titulares = new TitularesRepository(tx)
      const pedidos = new PedidosRepository(tx)
      const pedido = await this.#pedidoAlvo(pedidos, titulares, id)
      await registro.gravar(tx, 'pedido.lido', { entidadeId: pedido.id, finalidade: FINALIDADE_DO_ATENDIMENTO_DO_TITULAR })
      return this.#montarPedido(pedido, await titulares.titularesParaOPedido([pedido.titularId]))
    })
  }

  /**
   * `POST /v1/privacidade/pedidos/:id/concluir` (F3, RF16): o atendimento do pedido de acesso, portabilidade,
   * compartilhamento ou correção terminou. A eliminação não conclui por aqui, e o pedido fechado responde
   * `PEDIDO_EM_ESTADO_INVALIDO`. O clique duplo decide no banco: a segunda chamada não conclui de novo nem audita.
   */
  async concluirPedido(id: string): Promise<void> {
    await this.banco.transaction(async (tx) => {
      const pedidos = new PedidosRepository(tx)
      const pedido = await this.#pedidoAlvo(pedidos, new TitularesRepository(tx), id)
      // O estado anterior vem do próprio `update`: o job do arquivo (13.0) passa `em_preparacao` para `pronto` por fora.
      const anterior = await pedidos.concluir(pedido.id)
      if (anterior === undefined) throw pedidoEmEstadoInvalido()
      await registro.gravar(tx, 'pedido.concluido', { entidadeId: pedido.id, antes: { estado: anterior }, depois: { estado: 'concluido' } })
    })
  }

  /**
   * `POST /v1/privacidade/pedidos/:id/cancelar` (F3, tarefa 14.0; RF14): a coordenação cancela a eliminação agendada, e o
   * acesso da pessoa volta com a mesma senha (as sessões que o registro encerrou não voltam: ela entra de novo). Só vale em
   * `agendado`, **antes de `eliminar_em` e antes de enfileirado**: o `where` do `update` decide, e fora disso (concluído, já
   * cancelado, depois do prazo, enfileirado, ou outro tipo de pedido) responde `PEDIDO_EM_ESTADO_INVALIDO`. A ordem das
   * travas é pedido → usuário, a do registro. O clique duplo não cancela nem audita de novo.
   */
  async cancelarPedido(id: string): Promise<void> {
    await this.banco.transaction(async (tx) => {
      const pedidos = new PedidosRepository(tx)
      const pedido = await this.#pedidoAlvo(pedidos, new TitularesRepository(tx), id)
      const cancelado = await pedidos.cancelar(pedido.id)
      if (cancelado === undefined) throw pedidoEmEstadoInvalido()
      const acessoDevolvido = await new CicloDeVidaService(this.banco).cancelarEliminacao(cancelado.titularId, tx)
      await registro.gravar(tx, 'pedido.cancelado', { entidadeId: pedido.id, antes: { estado: 'agendado' }, depois: { estado: 'cancelado', acessoDevolvido } })
    })
  }

  /**
   * `POST /v1/privacidade/pedidos/:id/corrigir-nome` (F3, RF13b): o nome novo do titular, só em pedido de correção
   * `recebido` ou `pronto`. Muda o `usuario` da escola e audita `pedido.nome_corrigido` **sem o nome**; o de outra
   * escola da mesma conta não muda. Fora daí, `PEDIDO_EM_ESTADO_INVALIDO`: o tipo e o estado são decididos no `where`
   * do `update`, que não muda o nome de um pedido que deixou de ser corrigível entre a leitura e a escrita.
   */
  async corrigirNomeDoPedido(id: string, nome: string): Promise<void> {
    await this.banco.transaction(async (tx) => {
      const pedidos = new PedidosRepository(tx)
      const pedido = await this.#pedidoAlvo(pedidos, new TitularesRepository(tx), id)
      if (!(await pedidos.corrigirNome(pedido.id, nome))) throw pedidoEmEstadoInvalido()
      await registro.gravar(tx, 'pedido.nome_corrigido', { entidadeId: pedido.id })
    })
  }

  /**
   * `POST /v1/privacidade/pedidos/:id/arquivo` (F3, tarefa 13.0; RF12 e RF17): a URL de 5 minutos da **versão da escola** do
   * arquivo, para a coordenação entregar a quem pediu. Só existe para o titular **sem conta ativa nesta escola**: com conta
   * ativa, ele baixa o próprio arquivo em "Meus dados", e a coordenação não tem caminho para a versão completa. A versão que
   * não existe, a vencida, a apagada, a de outra escola, a do pedido sobre quem pede e o id de ninguém respondem igual
   * (`NAO_ENCONTRADO`, regra 10, item 6). Auditada como `titular.arquivo_baixado`, com a finalidade, na mesma transação.
   */
  async arquivoDaEscola(pedidoId: string, finalidade: FinalidadeDoArquivo): Promise<ArquivoResponse> {
    // Leitura curta, sem transação: nenhuma conexão do pool fica presa enquanto o storage responde (regra 80, item 3).
    const pedido = await this.#pedidoAlvo(new PedidosRepository(this.banco), new TitularesRepository(this.banco), pedidoId)
    const arquivos = new ArquivoDoTitularRepository(this.banco)
    const arquivo = await arquivos.doPedido(pedido.id, 'coordenacao')
    const agora = this.#relogio.agora()
    // A versão da escola só vale enquanto o titular segue sem conta ativa: se ela voltou, ele baixa o dele.
    if (arquivo === undefined || !this.#vale(arquivo, agora) || (await arquivos.contaAtiva(pedido.titularId)) !== false) {
      throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    }
    const resposta = await this.#assinar(arquivo, agora)
    // A auditoria é a transação curta, e vem antes de a resposta sair: se ela falhar, a URL não sai.
    await this.banco.transaction(async (tx) => {
      await registro.gravar(tx, 'titular.arquivo_baixado', { entidadeId: pedido.id, depois: { versao: 'coordenacao' satisfies VersaoDoArquivo }, finalidade })
    })
    return resposta
  }

  /**
   * `GET /v1/meus-dados` (F3, tarefa 13.0; RF12 e RF20): os pedidos da própria pessoa na escola ativa, com o estado e a
   * validade do arquivo, e a contagem do que a escola guarda dela por categoria. Só o que é dela (`usuario_id` da sessão):
   * o pedido de um colega nunca entra. A leitura é da própria pessoa sobre si, e não vai para a auditoria.
   */
  async meusDados(): Promise<MeusDadosResponse> {
    const { usuarioId } = requestIdentity()
    const agora = this.#relogio.agora()
    const pedidos = await new ArquivoDoTitularRepository(this.banco).pedidosDoUsuario(usuarioId, PEDIDOS_EM_MEUS_DADOS)
    const categorias = await new TitularesRepository(this.banco).contagemPorCategoria(usuarioId)
    return meusDadosResponseSchema.parse({
      pedidos: pedidos.map(({ id, tipo, estado, chegouEm, arquivo }) => ({
        id,
        tipo,
        estado,
        chegouEm,
        arquivo: arquivo === null ? null : { situacao: arquivo.apagadoEm === null && arquivo.expiraEm > agora ? 'disponivel' : 'expirado', expiraEm: arquivo.expiraEm.toISOString() },
      })),
      categorias: categorias.map(({ categoria, quantidade }) => ({ categoria, quantidade })),
    })
  }

  /**
   * `POST /v1/meus-dados/:id/baixar` (F3, tarefa 13.0; RF12): a URL de 5 minutos da **versão completa** do arquivo do próprio
   * usuário. O pedido é o dele (`titular_id` da sessão): o do colega, o de outra escola e o inexistente respondem igual, e o
   * arquivo vencido ou apagado também. Quem pediu pelo titular (o responsável legal) recebe na conta do aluno: o arquivo é
   * sempre dele. Auditada como `titular.arquivo_baixado`.
   */
  async baixarMeuArquivo(pedidoId: string): Promise<ArquivoResponse> {
    const { usuarioId } = requestIdentity()
    // Leitura curta, sem transação: a consulta ao storage não segura conexão do pool (regra 80, item 3).
    const arquivo = await new ArquivoDoTitularRepository(this.banco).arquivoCompletoDoUsuario(usuarioId, pedidoId)
    const agora = this.#relogio.agora()
    if (arquivo === undefined || !this.#vale(arquivo, agora)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const resposta = await this.#assinar(arquivo, agora)
    await this.banco.transaction(async (tx) => {
      await registro.gravar(tx, 'titular.arquivo_baixado', {
        entidadeId: pedidoId,
        depois: { versao: 'completa' satisfies VersaoDoArquivo },
        finalidade: FINALIDADE_DO_ARQUIVO_DO_PROPRIO_TITULAR,
      })
    })
    return resposta
  }

  /**
   * Grava o pedido. A segunda eliminação `agendada` do mesmo titular (outra chave de envio) cai no único parcial e responde
   * `PEDIDO_EM_ESTADO_INVALIDO`, sem dizer o que existe. Qualquer outro erro do banco segue como veio.
   */
  async #gravarPedido(pedidos: PedidosRepository, pedido: Parameters<PedidosRepository['registrar']>[0]): ReturnType<PedidosRepository['registrar']> {
    try {
      return await pedidos.registrar(pedido)
    } catch (erro) {
      const doBanco = postgresErrorIn(erro)
      if (doBanco?.code === '23505' && doBanco.constraint === 'pedido_titular_agendado_unico') throw pedidoEmEstadoInvalido()
      throw erro
    }
  }

  /** O arquivo ainda vale: não foi apagado e não venceu. */
  #vale(arquivo: ArquivoLido, agora: Date): boolean {
    return arquivo.apagadoEm === null && arquivo.expiraEm > agora
  }

  /**
   * Confere que o objeto está no armazém e assina a URL de 5 minutos. Armazém fora, ou objeto que a linha diz que existe e o
   * storage não tem: `INDISPONIVEL_TENTE_DE_NOVO`, nunca o erro do SDK nem a chave do objeto. A chave não sai daqui.
   */
  async #assinar(arquivo: ArquivoLido, agora: Date): Promise<ArquivoResponse> {
    try {
      if (!(await this.dependencias.armazem.existe(arquivo.chaveObjeto))) throw new FileStorageUnavailableError()
      const nome = nomeDoArquivoDoTitular(diaDeUso(agora))
      const url = await this.dependencias.armazem.urlDeDownload(arquivo.chaveObjeto, { nome, validadeSegundos: VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS })
      return arquivoResponseSchema.parse({ url, nome, validaAte: new Date(agora.getTime() + VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS * 1_000).toISOString() })
    } catch (erro) {
      if (erro instanceof FileStorageUnavailableError) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
      throw erro
    }
  }

  /** O titular do pedido, ou `NAO_ENCONTRADO` como o inexistente: outra escola, o de quem pediu e o id de ninguém. */
  async #titularAlvo(titulares: TitularesRepository, titularId: string): Promise<TitularAchadoNoBanco> {
    const titular = await titulares.paraOPedido(titularId)
    if (titular === undefined || (await this.#ehDeQuemPediu(titulares, titular))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return titular
  }

  /** O pedido do id, ou `NAO_ENCONTRADO` como o inexistente: outra escola, o sobre quem pediu e o id de ninguém. */
  async #pedidoAlvo(pedidos: PedidosRepository, titulares: TitularesRepository, id: string): Promise<PedidoAchado> {
    const pedido = await pedidos.de(id)
    if (pedido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const { usuarioId } = requestIdentity()
    const contaDeQuemPediu = await titulares.contaDeQuemPediu()
    if (pedido.titularId === usuarioId || (pedido.contaDoTitular !== null && pedido.contaDoTitular === contaDeQuemPediu)) {
      throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    }
    return pedido
  }

  /** O pedido sobre a própria pessoa, pelo mesmo `conta_id` (ou pelo próprio id): quem atende não atende a si. */
  async #ehDeQuemPediu(titulares: TitularesRepository, titular: TitularAchadoNoBanco): Promise<boolean> {
    const { usuarioId } = requestIdentity()
    if (titular.id === usuarioId) return true
    return titular.contaId !== null && titular.contaId === (await titulares.contaDeQuemPediu())
  }

  #escola(): string {
    return requestIdentity().escolaId
  }

  #titularDe(pedido: PedidoAchado, titulares: ReadonlyMap<string, TitularParaOPedido>): PedidoDoTitular['titular'] {
    return titulares.get(pedido.titularId) ?? null
  }

  /** O pedido como a coordenação o lê: sem nome de quem registrou, sem matrícula e sem texto. */
  #montarPedido(pedido: PedidoAchado, titulares: ReadonlyMap<string, TitularParaOPedido>): PedidoDoTitular {
    return pedidoDoTitularSchema.parse({
      id: pedido.id,
      tipo: pedido.tipo,
      solicitante: pedido.solicitante,
      chegouEm: pedido.chegouEm,
      estado: pedido.estado,
      titular: this.#titularDe(pedido, titulares),
      homonimo: pedido.homonimo,
      nomeTrocado: pedido.nomeTrocado,
      compartilhamento: pedido.compartilhamento,
      concluidoEm: pedido.concluidoEm?.toISOString() ?? null,
    })
  }
}
