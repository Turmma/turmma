import { SetMetadata, type CustomDecorator } from '@nestjs/common'

export const SAIDA_DA_ABA_RATE_LIMIT_KEY = 'educa:limite-da-saida-da-aba'

/**
 * `POST /v1/atividades-aplicadas/:id/saidas-da-aba` (avaliacao-e-correcao, 8.0): além do rate limit do F0, conta no balde próprio `rl:saida-da-aba`, de 30 por minuto por usuário, e
 * acima dele responde `LIMITE_EXCEDIDO` (429). A tela manda as saídas em série numa fila própria, e o 429 não para a fila das respostas (Tech Spec §5.8).
 */
export function SaidaDaAbaRateLimit(): CustomDecorator<string> {
  return SetMetadata(SAIDA_DA_ABA_RATE_LIMIT_KEY, true)
}
