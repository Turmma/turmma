import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  atividadesAplicadasQuerySchema,
  aplicarAtividadeRequestSchema,
  mudarJanelaRequestSchema,
  estenderTempoRequestSchema,
  emptyOrMissingBodyRequestSchema,
  type AtividadesAplicadasQuery,
  type AplicarAtividadeLido,
  type MudarJanelaRequest,
  type EstenderTempoRequest,
  type AcompanhamentoResponse,
  type EmptyBodyRequest,
  type AtividadeAplicadaResponse,
  type AtividadeEncerradaResponse,
  type CorrecaoDoLoteResponse,
  type DestaqueAbertoResponse,
  type ListaDeAtividadesAplicadasResponse,
} from '@educa/shared'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common'
import { AtividadeAplicadaService } from './atividade-aplicada.service.js'
import { CorrecaoService } from '../correcao/correcao.service.js'
import { ExtensaoService } from './extensao.service.js'

/**
 * `/v1/atividades-aplicadas`, o lado da professora (MVP, A3): aplicar, listar, encerrar, mudar a janela da prova (antes de alguém começar), estender o tempo e acompanhar quem faz a prova, ler a correção do lote e abrir
 * destaque. Todas as células são `turma_vinculada`, só do professor: coordenação e aluno são recusados pela guarda. O
 * corpo e a consulta passam pelo contrato estrito (escola, ano ou pessoa no corpo é `ENTRADA_INVALIDA`), e o id fora do
 * formato responde como o inexistente. A correção nomeia alunos e tem o gabarito: toda leitura sai com `no-store`. A
 * entrada passa pelo `ZodValidationPipe` e pelo `IdPipe` no parâmetro (17.0).
 */
@Controller('v1/atividades-aplicadas')
export class AtividadeAplicadaController {
  constructor(
    private readonly atividades: AtividadeAplicadaService,
    private readonly correcoes: CorrecaoService,
    private readonly extensoes: ExtensaoService,
  ) {}

  @Post()
  @RequirePermissao('atividade_aplicada', 'aplicar')
  aplicar(@Body(new ZodValidationPipe(aplicarAtividadeRequestSchema)) pedido: AplicarAtividadeLido): Promise<AtividadeAplicadaResponse> {
    return this.atividades.aplicar(pedido)
  }

  @Get()
  @RequirePermissao('atividade_aplicada', 'listar')
  @Header('Cache-Control', 'no-store')
  list(@Query(new ZodValidationPipe(atividadesAplicadasQuerySchema)) consulta: AtividadesAplicadasQuery): Promise<ListaDeAtividadesAplicadasResponse> {
    return this.atividades.list(consulta)
  }

  @Post(':id/encerrar')
  @RequirePermissao('atividade_aplicada', 'encerrar')
  @HttpCode(HttpStatus.OK)
  encerrar(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(emptyOrMissingBodyRequestSchema)) _corpo: EmptyBodyRequest): Promise<AtividadeEncerradaResponse> {
    return this.atividades.encerrar(atividadeAplicadaId)
  }

  @Patch(':id/janela')
  @RequirePermissao('atividade_aplicada', 'janela')
  @Header('Cache-Control', 'no-store')
  mudarAJanela(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(mudarJanelaRequestSchema)) pedido: MudarJanelaRequest): Promise<AtividadeAplicadaResponse> {
    return this.atividades.mudarAJanela(atividadeAplicadaId, pedido)
  }

  @Post(':id/extensoes')
  @RequirePermissao('atividade_aplicada', 'estender')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  estender(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(estenderTempoRequestSchema)) pedido: EstenderTempoRequest): Promise<AcompanhamentoResponse> {
    return this.extensoes.estender(atividadeAplicadaId, pedido)
  }

  @Get(':id/acompanhamento')
  @RequirePermissao('atividade_aplicada', 'acompanhar')
  @Header('Cache-Control', 'no-store')
  acompanhar(@Param('id', IdPipe) atividadeAplicadaId: string): Promise<AcompanhamentoResponse> {
    return this.extensoes.acompanhar(atividadeAplicadaId)
  }

  @Get(':id/correcao')
  @RequirePermissao('correcao', 'ler')
  @Header('Cache-Control', 'no-store')
  correcao(@Param('id', IdPipe) atividadeAplicadaId: string): Promise<CorrecaoDoLoteResponse> {
    return this.correcoes.read(atividadeAplicadaId)
  }

  @Post(':id/correcao/destaques/:alunoId/abrir')
  @RequirePermissao('correcao', 'abrir_destaque')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  openDestaque(
    @Param('id', IdPipe) atividadeAplicadaId: string,
    @Param('alunoId', IdPipe) aluno: string,
    @Body(new ZodValidationPipe(emptyOrMissingBodyRequestSchema)) _corpo: EmptyBodyRequest,
  ): Promise<DestaqueAbertoResponse> {
    return this.correcoes.openDestaque(atividadeAplicadaId, aluno)
  }
}
