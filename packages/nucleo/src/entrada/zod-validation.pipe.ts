import { ErrorCode } from '@educa/shared'
import type { PipeTransform } from '@nestjs/common'
import type { z } from 'zod'
import { ErroDeDominio } from '../erro/erro-de-dominio.js'

export interface OpcoesDoZodValidationPipe {
  /** O código do erro quando o valor não passa no esquema. Por padrão, `ENTRADA_INVALIDA`. */
  readonly errorCode?: ErrorCode
}

/**
 * A validação de entrada do padrão do NestJS ("Pipes" › *Object schema validation*): `@Body(new ZodValidationPipe(esquema))`
 * e `@Query(new ZodValidationPipe(esquema))`. Devolve o valor lido pelo esquema, com os `default` aplicados. O inválido
 * lança só o código, sem `issues`: elas repetem o valor que o cliente mandou, e a resposta e o log nunca o levam (regra 20,
 * itens 9 e 11). `errorCode: NAO_ENCONTRADO` serve ao parâmetro de caminho que não tem o formato de nenhum id existente,
 * que responde como o inexistente (regra 10, item 6).
 */
export class ZodValidationPipe<Esquema extends z.ZodType> implements PipeTransform<unknown, z.output<Esquema>> {
  constructor(
    private readonly esquema: Esquema,
    private readonly opcoes: OpcoesDoZodValidationPipe = {},
  ) {}

  transform(valor: unknown): z.output<Esquema> {
    const lido = this.esquema.safeParse(valor)
    if (!lido.success) throw new ErroDeDominio(this.opcoes.errorCode ?? ErrorCode.ENTRADA_INVALIDA)
    return lido.data
  }
}
