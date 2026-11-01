import { Component, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useTituloDaAba } from '../document-title'
import { Button } from './ui/Button'
import { ContextoDaGaveta } from './drawer-context'

interface PropsDaFalha {
  /** O título da aba enquanto a falha está na tela: sem ele, a aba ficaria com o da página anterior. */
  readonly tituloDaAba: string
  /** O título da tela da falha: o que a pessoa esperava ver e não chegou. */
  readonly titulo: string
  /** O que não carregou e o que fazer, sem código nem status (regra 50, item 12). */
  readonly texto: string
  /**
   * Página inteira, com o próprio `<main>`, para a área que não tem casca em volta (a operação). Sem isto, a falha
   * ocupa o lugar do conteúdo dentro da casca da escola, e a lateral continua de pé para a pessoa ir a outro lugar.
   */
  readonly paginaInteira?: boolean
}

/**
 * A tela da falha. Ao aparecer:
 *
 * - põe o título da falha na aba pelo mesmo gancho das rotas (`useTituloDaAba`), e o devolve ao sair — quem sai da falha
 *   pelo "Sair" ou por outra rota não fica com uma aba dizendo que algo não carregou. Pelo gancho, e não no
 *   `componentDidCatch`: a rota de antes devolve o título dela no efeito de desmontagem, que roda depois do
 *   `componentDidCatch` e apagaria o da falha quando a área já tinha falhado antes e cai na fronteira de uma vez;
 * - fecha a gaveta da casca, se ela estava aberta, e leva o foco ao título da falha, nesta ordem: fechar o `dialog`
 *   devolve o foco a quem o abriu, e quem usa teclado ou leitor de tela ficaria sem saber que a tela atrás mudou.
 */
function Falha({ tituloDaAba, titulo, texto, paginaInteira = false }: PropsDaFalha) {
  useTituloDaAba(tituloDaAba)
  const { fechar } = useContext(ContextoDaGaveta)
  const tituloDaFalha = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    fechar()
    tituloDaFalha.current?.focus()
  }, [fechar])

  const conteudo = (
    <>
      <h1 ref={tituloDaFalha} tabIndex={-1} className="text-xl font-semibold sm:text-2xl">
        {titulo}
      </h1>
      <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
        {texto}
      </p>
      <Button className="self-start" onClick={() => window.location.reload()}>
        Tentar de novo
      </Button>
    </>
  )
  if (paginaInteira) return <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-fundo px-4 py-6 text-tinta sm:px-6">{conteudo}</main>
  return <div className="flex max-w-md flex-col gap-4">{conteudo}</div>
}

/**
 * A fronteira de erro de uma área carregada por `import()` (a operação e a área de cada papel da escola): o chunk que
 * não chega (rede da escola caindo, 3G no celular) não vira tela branca, e a falha aparece no lugar da área.
 *
 * "Tentar de novo" recarrega a página, porque o navegador e o `lazy` do React guardam a falha do módulo, e um segundo
 * `import()` do mesmo endereço devolveria a mesma falha. A tela que não carregou não tem o que perder na recarga.
 */
export class FronteiraDaArea extends Component<PropsDaFalha & { readonly children: ReactNode }, { falhou: boolean }> {
  override state = { falhou: false }

  static getDerivedStateFromError(): { falhou: boolean } {
    return { falhou: true }
  }

  override render() {
    const { children, ...falha } = this.props
    return this.state.falhou ? <Falha {...falha} /> : children
  }
}
