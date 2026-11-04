import { SetMetadata, type CustomDecorator } from '@nestjs/common'

export const IMPORTACAO_RATE_LIMIT_KEY = 'educa:limite-da-importacao'

/**
 * A prévia e o gravar de planilha (`POST /v1/importacoes/:tipo/previa` e `POST /v1/importacoes/:tipo`, F2, tarefa 5.0): além do rate
 * limit do F0, contam no balde próprio `rl:importacao`, de 20 por minuto por usuário (os dois no mesmo balde), e acima dele
 * respondem `LIMITE_EXCEDIDO` (429). Cada chamada lê até 512 KB e classifica até 3.000 linhas, e o balde próprio impede que um laço
 * nelas esgote a cota de requisição da pessoa ou da escola.
 */
export function ImportacaoRateLimit(): CustomDecorator<string> {
  return SetMetadata(IMPORTACAO_RATE_LIMIT_KEY, true)
}
