import type { AcaoDe, Recurso } from '@educa/shared'
import { SetMetadata, type CustomDecorator } from '@nestjs/common'

export const PERMISSAO_KEY = 'educa:permite'

export interface PermittedCell {
  readonly recurso: Recurso
  readonly acao: string
}

/**
 * Declara qual célula da `MATRIZ` (`packages/shared`) a rota atende. A `PermissaoGuard` barra o papel cujo
 * alcance nessa célula é `nunca`, com a mesma resposta de rota inexistente (regra 10, item 6). O resto do alcance
 * (a turma dele, a própria pessoa) é conferido no repository, por objeto (regra 10, item 4).
 *
 * Toda rota autenticada precisa desta marcação, no método ou no controller: rota sem `@RequirePermissao` e sem
 * `@Public` derruba o boot da API (`PermissaoBootCheck`), e endpoint novo nasce fechado.
 */
export function RequirePermissao<R extends Recurso>(recurso: R, acao: AcaoDe<R>): CustomDecorator<string> {
  const celula: PermittedCell = { recurso, acao }
  return SetMetadata(PERMISSAO_KEY, celula)
}
