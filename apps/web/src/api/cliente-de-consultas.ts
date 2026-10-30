import { ErrorCode } from '@educa/shared'
import { QueryClient } from '@tanstack/react-query'
import { ErroDaApi } from './cliente'

/** Uma nova tentativa automática, um segundo depois; depois disso a tela mostra o erro e o botão. */
export const TENTATIVAS_AUTOMATICAS = 1
export const ESPERA_ENTRE_TENTATIVAS_MS = 1_000

/**
 * Cliente do TanStack Query da web. Limite excedido não é repetido sozinho: repetir é o que o limite
 * pede para não fazer. Erro de 4xx que não muda com o tempo também não.
 */
export function deveTentarDeNovo(falhas: number, erro: unknown): boolean {
  if (falhas >= TENTATIVAS_AUTOMATICAS) return false
  if (!(erro instanceof ErroDaApi)) return true
  return erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || erro.codigo === ErrorCode.TEMPO_ESGOTADO || erro.codigo === ErrorCode.ERRO_INTERNO
}

export function criarClienteDeConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: deveTentarDeNovo,
        retryDelay: ESPERA_ENTRE_TENTATIVAS_MS,
        staleTime: 30_000,
      },
    },
  })
}
