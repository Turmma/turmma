import { IdPipe, TitularSearchRateLimit, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  baixarArquivoDaEscolaSchema,
  buscaDeTitularesSchema,
  paginationQuerySchema,
  correcaoDeNomeSchema,
  emptyBodyRequestSchema,
  registroDePedidoSchema,
  type BaixarArquivoDaEscola,
  type BuscaDeTitulares,
  type PaginationQuery,
  type CorrecaoDeNome,
  type EmptyBodyRequest,
  type RegistroDePedido,
  type BuscaDeTitularesResponse,
  type ArquivoResponse,
  type IncidentesResponse,
  type PedidosResponse,
  type PreviaDoTitularResponse,
  type RetencaoResponse,
  type SuboperadoresResponse,
  type PedidoDoTitular,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { PrivacidadeService } from './privacidade.service.js'

/**
 * `/v1/privacidade` (F3; Tech Spec do F3, seção 4): **só da coordenação**, que chega aqui só depois do segundo fator.
 * Professor e aluno recebem da guarda a resposta do inexistente; a rede, que ainda não tem usuário (F14), tem `nunca`
 * na matriz. O escopo é a escola do token. A entrada passa pelo `ZodValidationPipe` e pelo `IdPipe` no parâmetro (17.0), que
 * nunca levam o nome, o termo nem o valor recusado ao log nem à resposta (regra 20, itens 9 e 11).
 */
@Controller('v1/privacidade')
export class PrivacidadeController {
  constructor(private readonly privacidade: PrivacidadeService) {}

  /** Por quanto tempo a escola guarda cada dado: as categorias, com o prazo que vale e de onde vem, e os prazos fixos. */
  @Get('retencao')
  @RequirePermissao('privacidade_retencao', 'ler')
  @Header('Cache-Control', 'no-store')
  retencao(): Promise<RetencaoResponse> {
    return this.privacidade.retencao()
  }

  /** As empresas que recebem dado da escola: vigentes e passadas, com o que fazem, onde processam e o que recebem. */
  @Get('suboperadores')
  @RequirePermissao('privacidade_suboperadores', 'ler')
  @Header('Cache-Control', 'no-store')
  suboperadores(): Promise<SuboperadoresResponse> {
    return this.privacidade.suboperadores()
  }

  /** Os incidentes de segurança que afetaram a escola, só a seção dela: os sem confirmação primeiro, com o prazo legal dela em texto fixo. */
  @Get('incidentes')
  @RequirePermissao('privacidade_incidentes', 'ler')
  @Header('Cache-Control', 'no-store')
  incidentes(): Promise<IncidentesResponse> {
    return this.privacidade.incidentes()
  }

  /**
   * A coordenação confirma que recebeu o aviso. Quem e quando ficam na seção da escola; confirmar de novo não muda nada e responde
   * igual. O id de outra escola, o inexistente e o que nem é um id respondem o mesmo `NAO_ENCONTRADO` (regra 10, item 6).
   */
  @Post('incidentes/:id/confirmar')
  @RequirePermissao('privacidade_incidentes', 'confirmar')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmarIncidente(@Param('id', IdPipe) incidenteId: string, @Body(new ZodValidationPipe(emptyBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<void> {
    return this.privacidade.confirmarIncidente(incidenteId)
  }

  /**
   * A coordenação acha o titular antes de registrar o pedido (F3, RF10): até 20 resultados com nome, papel, matrícula,
   * turmas e disciplinas. O termo vai no corpo e nunca a log nem à auditoria; o limite próprio `rl:busca-titular` é
   * 30 por minuto por usuário, além do limite do F0 (`@TitularSearchRateLimit`). Só quem é `usuario` da escola é
   * achado: o aluno que só está na lista de nomes é atendido pela lista da turma (A1).
   */
  @Post('titulares/busca')
  @RequirePermissao('privacidade_titulares', 'buscar')
  @TitularSearchRateLimit()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  buscarTitulares(@Body(new ZodValidationPipe(buscaDeTitularesSchema)) busca: BuscaDeTitulares): Promise<BuscaDeTitularesResponse> {
    return this.privacidade.buscaDeTitulares(busca.termo)
  }

  /**
   * A prévia do titular, antes de o pedido existir (F3, RF10 e RF11; D64): o aluno traz a contagem por categoria; o
   * professor, só as categorias de cadastro e vínculo, sem contagem e sem período. Auditada, e igual para quem usou e
   * para quem não usou a IA. O titular de outra escola, o de quem pediu e o inexistente respondem como o id de ninguém.
   */
  @Get('titulares/:id/previa')
  @RequirePermissao('privacidade_titulares', 'previa')
  @Header('Cache-Control', 'no-store')
  previaDoTitular(@Param('id', IdPipe) titularId: string): Promise<PreviaDoTitularResponse> {
    return this.privacidade.previaDoTitular(titularId)
  }

  /**
   * O registro do pedido do titular (F3, RF10). A chave de envio decide primeiro: a mesma chave, com o mesmo conteúdo
   * e da mesma coordenação, devolve sempre o mesmo pedido, e só quem gravou registra o passo. O pedido sobre a própria
   * pessoa (mesma `conta_id` de quem pediu) responde como inexistente.
   */
  @Post('pedidos')
  @RequirePermissao('privacidade_pedidos', 'registrar')
  @Header('Cache-Control', 'no-store')
  registrarPedido(@Body(new ZodValidationPipe(registroDePedidoSchema)) registro: RegistroDePedido): Promise<PedidoDoTitular> {
    return this.privacidade.registrarPedido(registro)
  }

  /** A página de pedidos da escola, com nome e turma enquanto o titular existe e "Titular eliminado" depois. */
  @Get('pedidos')
  @RequirePermissao('privacidade_pedidos', 'listar')
  @Header('Cache-Control', 'no-store')
  pedidos(@Query(new ZodValidationPipe(paginationQuerySchema)) consulta: PaginationQuery): Promise<PedidosResponse> {
    return this.privacidade.pedidos(consulta)
  }

  /** O detalhe do pedido, com a foto do compartilhamento, `nomeTrocado` e `homonimo`. */
  @Get('pedidos/:id')
  @RequirePermissao('privacidade_pedidos', 'ler')
  @Header('Cache-Control', 'no-store')
  pedido(@Param('id', IdPipe) pedidoId: string): Promise<PedidoDoTitular> {
    return this.privacidade.pedido(pedidoId)
  }

  /** O fim do atendimento do pedido de acesso, portabilidade, compartilhamento ou correção. O clique duplo decide no banco. */
  @Post('pedidos/:id/concluir')
  @RequirePermissao('privacidade_pedidos', 'concluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  concluirPedido(@Param('id', IdPipe) pedidoId: string, @Body(new ZodValidationPipe(emptyBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<void> {
    return this.privacidade.concluirPedido(pedidoId)
  }

  /**
   * O cancelamento da eliminação agendada (F3, tarefa 14.0; RF14): o acesso volta com a mesma senha. Só em `agendado`, antes
   * de `eliminar_em` e antes de enfileirado; fora disso, `PEDIDO_EM_ESTADO_INVALIDO`. O pedido de outra escola e o inexistente
   * respondem `NAO_ENCONTRADO`.
   */
  @Post('pedidos/:id/cancelar')
  @RequirePermissao('privacidade_pedidos', 'cancelar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  cancelarPedido(@Param('id', IdPipe) pedidoId: string, @Body(new ZodValidationPipe(emptyBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<void> {
    return this.privacidade.cancelarPedido(pedidoId)
  }

  /** A correção do nome do titular, só em pedido de correção aberto, auditada sem o nome. */
  @Post('pedidos/:id/corrigir-nome')
  @RequirePermissao('privacidade_pedidos', 'corrigir_nome')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  corrigirNome(@Param('id', IdPipe) pedidoId: string, @Body(new ZodValidationPipe(correcaoDeNomeSchema)) correcao: CorrecaoDeNome): Promise<void> {
    return this.privacidade.corrigirNomeDoPedido(pedidoId, correcao.nome)
  }

  /**
   * A URL de 5 minutos da versão da escola do arquivo (F3, tarefa 13.0; RF12), para o titular **sem conta ativa** nesta
   * escola. Com conta ativa, a versão não existe e a resposta é a do id inexistente; a completa nunca sai por aqui.
   * Auditada com a finalidade, e a resposta nunca é guardada (`no-store`).
   */
  @Post('pedidos/:id/arquivo')
  @RequirePermissao('privacidade_pedidos', 'arquivo')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  arquivoDoPedido(@Param('id', IdPipe) pedidoId: string, @Body(new ZodValidationPipe(baixarArquivoDaEscolaSchema)) arquivo: BaixarArquivoDaEscola): Promise<ArquivoResponse> {
    return this.privacidade.arquivoDaEscola(pedidoId, arquivo.finalidade)
  }
}
