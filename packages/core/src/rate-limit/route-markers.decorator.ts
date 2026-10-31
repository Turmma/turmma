import { SetMetadata, type CustomDecorator } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'educa:rota-anonima'
export const SKIP_RATE_LIMIT_KEY = 'educa:sem-limite'
export const DOWNGRADE_RATE_LIMIT_KEY = 'educa:limite-que-rebaixa'

/**
 * Marca a rota, ou o controller inteiro, como acessível sem token. Toda outra rota exige token:
 * endpoint novo que esquece a marcação nasce fechado, não aberto.
 *
 * Sem token não há usuário nem escola, e a rota anônima é a única limitada por IP (`rl:ip:{ip}`),
 * com teto que comporta uma escola inteira atrás de um NAT (regra 80, item 1).
 */
export function Public(): CustomDecorator<string> {
  return SetMetadata(IS_PUBLIC_KEY, true)
}

/**
 * Tira a rota do rate limit. Só para a sonda da borda (`/prontidao`): ela não sai pela borda, não
 * consulta dependência, e um 429 nela tiraria as duas instâncias do balanceamento de uma vez.
 * Rota de cliente nunca leva esta marcação.
 */
export function SkipRateLimit(): CustomDecorator<string> {
  return SetMetadata(SKIP_RATE_LIMIT_KEY, true)
}

/**
 * A rota anônima de login por senha (e-mail e matrícula, identidade 15.0): o limite por IP dela não recusa. Acima dele,
 * a guarda só marca a requisição (`isOverIpLimit`), e o login manda a tentativa para o fim do balde dela no semáforo
 * do hash. A escola inteira sai por um IP: recusar ali seria bloquear os 400 alunos por causa de um script (regra 80,
 * item 1). O balde de contagem é próprio (`rl:ip-login`), e o login lotado não gasta o limite das outras rotas anônimas.
 */
export function DowngradeRateLimit(): CustomDecorator<string> {
  return SetMetadata(DOWNGRADE_RATE_LIMIT_KEY, true)
}

export const ACCEPTS_CHALLENGE_KEY = 'educa:aceita-desafio'

/**
 * A rota autenticada que também aceita o desafio de login no `Authorization`, no lugar do token de acesso: só
 * `POST /v1/sessao/escola` (tarefa 12.0), que recebe o desafio `escolher` ou o token de uma sessão de e-mail
 * (Tech Spec, seção 4).
 *
 * Com o desafio (`typ: desafio+jwt` no cabeçalho do JWT), as guardas tratam a requisição como anônima: limite por IP,
 * sem sessão no contexto e sem célula da matriz, e quem verifica o desafio inteiro (assinatura, `aud`, prazo, etapa e
 * uso único) é o service da rota. Qualquer outro bearer segue o caminho de toda rota autenticada, com `@RequirePermissao`.
 * Um cabeçalho que só diz ser desafio não abre nada: sem o desafio verificado, o service recusa.
 */
export function AcceptsChallenge(): CustomDecorator<string> {
  return SetMetadata(ACCEPTS_CHALLENGE_KEY, true)
}
