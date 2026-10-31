import type { Page } from '@playwright/test'

/** Uma consulta do cache do TanStack Query da página: a chave e o dado que ela guarda agora. */
export interface ConsultaNoCache {
  readonly chave: unknown
  readonly dado: unknown
}

/**
 * O cache de consultas da página, lido de dentro dela (W3; A1, 12.0). A web não expõe o `QueryClient` — nada no
 * `window` —, e por isso o teste o acha pela árvore do React: a raiz que o `createRoot` marca no `#raiz` leva à fibra do
 * `QueryClientProvider`, cuja prop `client` é o cliente que a tela usa. É leitura de teste, sem nada no código de
 * produção para isso.
 */
export function cacheDeConsultas(page: Page): Promise<ConsultaNoCache[]> {
  return page.evaluate(() => {
    interface ConsultaDoReact {
      readonly queryKey: unknown
      readonly state: { readonly data: unknown }
    }
    interface Fibra {
      readonly memoizedProps?: { readonly client?: { readonly getQueryCache?: () => { getAll: () => ConsultaDoReact[] } } } | null
      readonly child: Fibra | null
      readonly sibling: Fibra | null
    }
    const raiz = document.getElementById('raiz') as (HTMLElement & Record<string, unknown>) | null
    if (raiz === null) throw new Error('a página não tem o #raiz')
    const marca = Object.keys(raiz).find((chave) => chave.startsWith('__reactContainer$'))
    if (marca === undefined) throw new Error('o #raiz não tem a raiz do React')
    const pendentes = [raiz[marca] as Fibra]
    for (let fibra = pendentes.pop(); fibra !== undefined; fibra = pendentes.pop()) {
      const obterCache = fibra.memoizedProps?.client?.getQueryCache
      if (typeof obterCache === 'function') {
        const cache = obterCache.call(fibra.memoizedProps?.client)
        return cache.getAll().map((consulta) => ({ chave: consulta.queryKey, dado: consulta.state.data }))
      }
      if (fibra.child !== null) pendentes.push(fibra.child)
      if (fibra.sibling !== null) pendentes.push(fibra.sibling)
    }
    throw new Error('o QueryClientProvider não está na árvore')
  })
}

/**
 * O texto de um valor da API ou do cache sem a lista `acessos` do `/v1/eu`: ela é o que o seletor mostra da própria
 * conta — o usuário, a escola, a rede e o papel de cada acesso —, e é a única parte da escola de destino que pode citar a
 * de origem (P30). Todo o resto não pode.
 */
export function semAcessosDaConta(valor: unknown): string {
  return JSON.stringify(valor, (chave, conteudo: unknown) => (chave === 'acessos' ? undefined : conteudo)) ?? ''
}
