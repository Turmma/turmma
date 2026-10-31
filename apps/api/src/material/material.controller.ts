import { IdPipe, RequirePermissao, ZodValidationPipe } from '@educa/core'
import {
  buscaDeMaterialQuerySchema,
  materiaisQuerySchema,
  enviarMaterialRequestSchema,
  type BuscaDeMaterialQuery,
  type MateriaisQuery,
  type EnviarMaterialRequest,
  type BuscaDeMaterialResponse,
  type ListaDeMateriaisResponse,
  type MaterialResponse,
} from '@educa/shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { MaterialService } from './material.service.js'
import { GuardaDoEnvio, RecebimentoDoMaterial } from './recebimento.js'

/**
 * `/v1/materiais` (MVP, A2; `docs/mvp-contratos.md`, seção 3): a coordenação envia, lista, lê e exclui o material da
 * escola da sessão; o professor lista, lê e busca o das disciplinas em que tem vínculo confirmado; o aluno, nada. Os
 * campos e a consulta passam pelo contrato estrito de `packages/shared` (campo a mais, como `escolaId`, é
 * `ENTRADA_INVALIDA`); id fora do formato, de outra escola ou inexistente responde o mesmo `NAO_ENCONTRADO`. A entrada passa
 * pelo `ZodValidationPipe` e pelo `IdPipe` no parâmetro (17.0).
 */
@Controller('v1/materiais')
export class MaterialController {
  constructor(private readonly materiais: MaterialService) {}

  /**
   * Multipart: os campos do contrato e o `arquivo`. Responde 201 com o material `processando`; a extração roda depois
   * (regra 00, item 4), e a tela consulta `GET /v1/materiais/:id` até o estado mudar. Os campos passam pelo
   * `ZodValidationPipe` ao lado do `@UploadedFile()`: campo fora do contrato é `ENTRADA_INVALIDA` e o service nem é chamado,
   * então o arquivo recebido não vai a lugar nenhum.
   */
  @Post()
  @RequirePermissao('material', 'enviar')
  @UseGuards(GuardaDoEnvio)
  @UseInterceptors(RecebimentoDoMaterial)
  enviar(@Body(new ZodValidationPipe(enviarMaterialRequestSchema)) campos: EnviarMaterialRequest, @UploadedFile() arquivo: unknown): Promise<MaterialResponse> {
    return this.materiais.enviar(campos, arquivo)
  }

  @Get()
  @RequirePermissao('material', 'listar')
  listar(@Query(new ZodValidationPipe(materiaisQuerySchema)) consulta: MateriaisQuery): Promise<ListaDeMateriaisResponse> {
    return this.materiais.listar(consulta)
  }

  /** Declarada antes de `:id`: `busca` não é id de material. */
  @Get('busca')
  @RequirePermissao('material', 'buscar')
  buscar(@Query(new ZodValidationPipe(buscaDeMaterialQuerySchema)) consulta: BuscaDeMaterialQuery): Promise<BuscaDeMaterialResponse> {
    return this.materiais.buscar(consulta)
  }

  @Get(':id')
  @RequirePermissao('material', 'ler')
  ler(@Param('id', IdPipe) materialId: string): Promise<MaterialResponse> {
    return this.materiais.ler(materialId)
  }

  @Delete(':id')
  @RequirePermissao('material', 'excluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  excluir(@Param('id', IdPipe) materialId: string): Promise<void> {
    return this.materiais.excluir(materialId)
  }
}
