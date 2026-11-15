import { Component, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useTabTitle } from '../document-title'
import { ROUTES } from '../paths'
import { Button } from './ui/Button'
import { SECONDARY_LINK_CLASSES } from './ui/button-variants'
import { DrawerContext } from './drawer-context'

interface PropsDaFalha {
  /** O título da aba enquanto a falha está na tela: sem ele, a aba ficaria com o da página anterior. */
  readonly tituloDaAba: string
  /** O título da tela da falha: o que a pessoa esperava ver e não chegou. */
  readonly titulo: string
  /** O que não carregou e o que fazer, sem código nem status (regra 50, item 12). */
  readonly texto: string
  /**
   * Página inteira, com o próprio `<main>`, para a falha que não tem casca em volta: a da operação e a da fronteira de
   * fora do `AppRoutes` (a entrada, a sala pública, a troca da senha, o estado do sistema). Sem isto, a falha ocupa o
   * lugar do conteúdo dentro da casca da escola, e a lateral continua de pé para a pessoa ir a outro lugar.
   */
  readonly paginaInteira?: boolean
  /**
   * Para onde o "Voltar ao início" leva: a página inicial da escola (`/`), ou, na operação, o início dela. É um link
   * comum, que recarrega a página e por isso limpa a fronteira (o `state` dela só se desfaz com a página nova).
   */
  readonly voltarPara?: string
}

/**
 * A tela da falha. Ao aparecer:
 *
 * - põe o título da falha na aba pelo mesmo gancho das rotas (`useTabTitle`), e o devolve ao sair — quem sai da falha
 *   pelo "Sair" ou por outra rota não fica com uma aba dizendo que algo não carregou. Pelo gancho, e não no
 *   `componentDidCatch`: a rota de antes devolve o título dela no efeito de desmontagem, que roda depois do
 *   `componentDidCatch` e apagaria o da falha quando a área já tinha falhado antes e cai na fronteira de uma vez;
 * - fecha a gaveta da casca, se ela estava aberta, e leva o foco ao título da falha, nesta ordem: fechar o `dialog`
 *   devolve o foco a quem o abriu, e quem usa teclado ou leitor de tela ficaria sem saber que a tela atrás mudou.
 */
function Falha({ tituloDaAba, titulo, texto, paginaInteira = false, voltarPara = ROUTES.inicio }: PropsDaFalha) {
  useTabTitle(tituloDaAba)
  const { fechar } = useContext(DrawerContext)
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
      {/* Sair leva o mesmo número de passos que repetir (D59): um toque, e os dois de 44 px. Quebram em linha a 360 px sem cortar o texto. */}
      <div className="flex flex-wrap gap-3 self-start">
        <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
        <a href={voltarPara} className={SECONDARY_LINK_CLASSES}>
          Voltar ao início
        </a>
      </div>
    </>
  )
  if (paginaInteira) return <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-fundo px-4 py-6 text-tinta sm:px-6">{conteudo}</main>
  return <div className="flex max-w-md flex-col gap-4">{conteudo}</div>
}

/**
 * A fronteira de erro, em dois usos. (1) De uma área carregada por `import()` (a operação e a área de cada papel da
 * escola): o chunk que não chega (rede da escola caindo, 3G no celular) não vira tela branca, e a falha aparece no
 * lugar da área. (2) De fora, em volta das rotas sem área do `AppRoutes` (a entrada, a sala pública, a troca da senha,
 * o estado do sistema): o componente que lança não derruba a página, e a falha toma a página inteira.
 *
 * "Tentar de novo" e "Voltar ao início" recarregam a página, porque o navegador e o `lazy` do React guardam a falha do
 * módulo (um segundo `import()` do mesmo endereço devolveria a mesma falha) e porque é a página nova que limpa o
 * `state` desta fronteira. Na área, a tela que não carregou não tem o que perder na recarga; na troca da senha ou na
 * sala pública, o que a pessoa digitou na tela que quebrou se perde, e a tela diz o que fazer.
 *
 * O erro não é registrado de propósito: a mensagem da exceção pode carregar dado da tela (regra 20, item 9). Se um dia
 * entrar um `componentDidCatch` para telemetria, que leve só o id e o nome do componente.
 */
export class AreaErrorBoundary extends Component<PropsDaFalha & { readonly children: ReactNode }, { falhou: boolean }> {
  override state = { falhou: false }

  static getDerivedStateFromError(): { falhou: boolean } {
    return { falhou: true }
  }

  override render() {
    const { children, ...falha } = this.props
    return this.state.falhou ? <Falha {...falha} /> : children
  }
}
