import type { ErrorCode } from '@educa/shared'
import { ApiError, errorMessage } from '../api/client'

/**
 * O texto de uma falha, pelo código: o da tela quando ela tem um, senão o do catálogo (regra 50, item 12). É o único
 * jeito de escolher esse texto na web: a escola passa o mapa de cada ação, e a operação passa o dela
 * (`operacao/textos.ts`). Sem React aqui, para a regra de cada tela ter teste de unidade.
 */
export function errorText(erro: unknown, textos: Partial<Record<ErrorCode, string>> = {}): string {
  return (erro instanceof ApiError ? textos[erro.codigo] : undefined) ?? errorMessage(erro)
}

/** A falha mudou o que está na tela (o item saiu ou mudou): a lista recarrega, e o diálogo só oferece "Fechar". */
export function listChanged(erro: unknown, codigos: readonly ErrorCode[]): boolean {
  return erro instanceof ApiError && codigos.includes(erro.codigo)
}
