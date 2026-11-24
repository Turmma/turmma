import { SetMetadata, type CustomDecorator } from '@nestjs/common'

export const COMECAR_PROVA_RATE_LIMIT_KEY = 'educa:limite-do-comecar-da-prova'

/**
 * `POST /v1/atividades-aplicadas/:id/comecar` (avaliacao-e-correcao, 3.0): além do rate limit do F0, conta no balde próprio `rl:comecar-prova`, de 30 por minuto por usuário, e
 * acima dele responde `LIMITE_EXCEDIDO` (429). Cada chamada trava a aplicação e pode gravar a tentativa: o laço de reenvio de um aluno não esgota a cota dele nem a da escola.
 */
export function ComecarProvaRateLimit(): CustomDecorator<string> {
  return SetMetadata(COMECAR_PROVA_RATE_LIMIT_KEY, true)
}
