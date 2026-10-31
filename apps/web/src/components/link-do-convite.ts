/**
 * O link do convite, montado com a origem desta web e o token no fragmento (`/convite#<token>`, a tela do F1): o
 * navegador nunca manda o fragmento ao servidor, e a tela do convite o tira da barra antes da primeira chamada. Vale para
 * o convite da coordenação, que a operação gera (A0b), e para o do professor, que a coordenação gera (A1, 14.0).
 */
export function linkDoConvite(origem: string, caminhoDoConvite: string, token: string): string {
  return `${origem}${caminhoDoConvite}#${token}`
}

/** O que a área de transferência fez com o link: copiou, ou não há como, e a tela seleciona o campo e pede a cópia. */
export type ResultadoDaCopia = 'copiado' | 'selecionar'

/**
 * Copia o link pela área de transferência, quando o navegador a oferece (W9 da A0b). Sem ela — endereço fora de contexto
 * seguro, navegador antigo — ou com a escrita recusada (permissão negada), a resposta é `selecionar`: a tela seleciona o
 * campo e pede à pessoa que copie. Nunca diz "copiado" sem a escrita ter terminado.
 */
export async function copiarLink(link: string, area: Pick<Clipboard, 'writeText'> | undefined): Promise<ResultadoDaCopia> {
  if (area === undefined) return 'selecionar'
  try {
    await area.writeText(link)
    return 'copiado'
  } catch {
    return 'selecionar'
  }
}
