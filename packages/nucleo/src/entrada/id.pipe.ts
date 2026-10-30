import { ErrorCode } from '@educa/shared'
import type { PipeTransform } from '@nestjs/common'
import { z } from 'zod'
import { DomainException } from '../erro/erro-de-dominio.js'

const esquemaId = z.uuid()

export interface IdPipeOptions {
  /** Id fora do formato devolve `undefined` em vez de lançar: o `redefinir-mfa` responde 202 sem efeito ao id inválido. */
  readonly invalidAsUndefined?: boolean
}

/**
 * O id do caminho, no molde do `ParseUUIDPipe`: `@Param('id', IdPipe)`. Aceita uuid em qualquer caixa e devolve em
 * minúsculas, que é como o banco o guarda. Fora do formato nenhum id existe assim, e a resposta é a do inexistente
 * (`NAO_ENCONTRADO`, o mesmo corpo do id de outra escola: regra 10, item 6), e não um 400 que confirmaria o formato.
 *
 * Sem `@Injectable()` de propósito: o Nest instancia sem argumentos a classe passada ao `@Param`, e com o decorator ele
 * tentaria injetar `opcoes` e derrubaria o boot.
 */
export class IdPipe implements PipeTransform<unknown, string | undefined> {
  constructor(private readonly opcoes: IdPipeOptions = {}) {}

  transform(valor: unknown): string | undefined {
    const lido = esquemaId.safeParse(valor)
    if (lido.success) return lido.data.toLowerCase()
    if (this.opcoes.invalidAsUndefined === true) return undefined
    throw new DomainException(ErrorCode.NAO_ENCONTRADO)
  }
}
