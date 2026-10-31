import { TAMANHO_MAXIMO_TOKEN_DE_CONVITE } from '@educa/shared'

/**
 * O token de um link que a escola manda — o do convite (F1, 14.0) e o da sala da turma (17.0) —, lido do fragmento `#` e
 * tirado da barra antes de qualquer chamada (regra 20, item 8).
 *
 * O fragmento nunca é mandado ao servidor pelo navegador, e por isso é onde o token do link vive; mas ele fica no
 * histórico do computador da escola, e é isso que o `history.replaceState` resolve. O token some da barra, do botão
 * Voltar e de qualquer captura de tela feita depois.
 *
 * `undefined` quando não há token: fragmento vazio, maior que o teto do contrato, ou com `%` solto (o link colado pela
 * metade), que não é token nenhum.
 */
export function tokenDoFragmento(): string | undefined {
  const bruto = window.location.hash.replace(/^#/, '')
  let token: string
  try {
    token = decodeURIComponent(bruto).trim()
  } catch {
    return undefined
  }
  return token === '' || token.length > TAMANHO_MAXIMO_TOKEN_DE_CONVITE ? undefined : token
}

/** Tira o fragmento da barra, sem recarregar e sem entrada nova no histórico. */
export function apagarFragmentoDaBarra(): void {
  if (window.location.hash !== '') window.history.replaceState(null, '', window.location.pathname + window.location.search)
}
