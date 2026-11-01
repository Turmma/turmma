import { ErrorCode } from '@educa/shared'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

/** Uma nova tentativa automática, um segundo depois; depois disso a tela mostra o erro e o botão. */
export const AUTO_RETRIES = 1
export const RETRY_DELAY_MS = 1_000

/**
 * Cliente do TanStack Query da web. Limite excedido não é repetido sozinho: repetir é o que o limite
 * pede para não fazer. Erro de 4xx que não muda com o tempo também não.
 */
export function shouldRetry(falhas: number, erro: unknown): boolean {
  if (falhas >= AUTO_RETRIES) return false
  if (!(erro instanceof ApiError)) return true
  return erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || erro.codigo === ErrorCode.TEMPO_ESGOTADO || erro.codigo === ErrorCode.ERRO_INTERNO
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: RETRY_DELAY_MS,
        staleTime: 30_000,
      },
    },
  })
}
