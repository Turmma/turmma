// O jeito certo de receber a entrada num controller dos módulos migrados (eslint.config.mjs, D81): o pipe no parâmetro.
// Nenhuma linha tem marca, e a regra `no-restricted-syntax` não pode acusar nenhuma.

import { ErrorCode } from '@educa/shared'
import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile } from '@nestjs/common'
import { z } from 'zod'
import { IdPipe, ZodValidationPipe } from '@educa/core'

const esquemaCorpo = z.strictObject({ nome: z.string() })
const esquemaConsulta = z.strictObject({ limite: z.coerce.number().default(20) })
const esquemaFerramenta = z.enum(['atividade', 'prova'])

@Controller('v1/exemplo')
export class ExemploController {
  @Post()
  criar(@Body(new ZodValidationPipe(esquemaCorpo)) corpo: z.infer<typeof esquemaCorpo>): unknown {
    return corpo
  }

  @Get()
  listar(@Query(new ZodValidationPipe(esquemaConsulta)) consulta: z.infer<typeof esquemaConsulta>): unknown {
    return consulta
  }

  @Get(':id')
  ler(@Param('id', IdPipe) id: string): string {
    return id
  }

  @Get('mfa/:id')
  redefinir(@Param('id', new IdPipe({ invalidAsUndefined: true })) id: string | undefined): string | undefined {
    return id
  }

  @Get('ferramentas/:ferramenta')
  ferramenta(@Param('ferramenta', new ZodValidationPipe(esquemaFerramenta, { errorCode: ErrorCode.NAO_ENCONTRADO })) ferramenta: string): string {
    return ferramenta
  }

  @Post('arquivo')
  enviar(@UploadedFile() arquivo: unknown, @Body(new ZodValidationPipe(esquemaCorpo)) corpo: z.infer<typeof esquemaCorpo>, @Res({ passthrough: true }) resposta: unknown): unknown {
    return [arquivo, corpo, resposta]
  }

  @Get('sem-entrada')
  semEntrada(): string {
    return 'ok'
  }
}
