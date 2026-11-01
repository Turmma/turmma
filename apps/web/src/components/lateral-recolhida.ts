/**
 * A lateral recolhida por escolha, no computador, fica guardada neste navegador (`docs/interface.md` 11.1). É preferência
 * de tela, sem nada da pessoa nem da escola, e por isso pode ficar no `localStorage` (regra 50, item 7): o valor é só
 * `sim`, e a ausência da chave quer dizer aberta. A lista do que o navegador guarda é fechada, com a `educa.aparencia`
 * (Tech Spec da X1, seção 7), e esta chave **não muda**: quem já recolheu a lateral continua com ela recolhida.
 */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'educa.lateral-recolhida'

/**
 * A lateral está recolhida por escolha da pessoa? Sem acesso ao armazenamento (navegação anônima, política do
 * Chromebook gerenciado: o acesso à propriedade, `getItem` ou a leitura lançam), a lateral abre aberta, como na primeira
 * vez, e nenhum erro sai dali.
 */
export function lerRecolhida(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'sim'
  } catch {
    return false
  }
}

/**
 * Guarda a escolha: recolhida grava `sim`, e aberta apaga a chave (o armazenamento não guarda o padrão). Sem acesso a
 * ele, a escolha vale até a aba fechar, e a lateral continua funcionando: quem chama não vê falha.
 */
export function guardarRecolhida(recolhida: boolean): void {
  try {
    if (recolhida) window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'sim')
    else window.localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
  } catch {
    // Sem armazenamento, a escolha vale até a aba fechar: a lateral continua funcionando.
  }
}
