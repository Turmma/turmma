import { useEffect, useRef, type ReactNode } from 'react'

interface PropsDaBarraPresa {
  /** O nome da barra para o leitor de tela: "Aprovação do lote", "Pedido ao Assistente". */
  readonly rotulo: string
  /**
   * O que explica a ação, à esquerda: o contador que diz por que o botão está desligado ("3 de 5 destaques abertos").
   * Na barra da conversa não há: a caixa de pedido ocupa a largura toda.
   */
  readonly informacao?: ReactNode
  /** As ações, à direita: o `oficial` da tela e a alternativa dele; ou a `CaixaPedido`. */
  readonly children: ReactNode
  /** O fio de 2 px de cima, que separa a barra da lista. A barra da caixa de pedido não leva: a caixa já tem a borda dela. */
  readonly semLinha?: boolean
  /**
   * Classes a mais, para a tela que solta a barra a partir de uma largura (`md:static`): a tela de trabalho do aluno põe "Anterior" e
   * "Próxima" na linha das outras ações em janela larga, onde a barra presa cobriria a ação (RF20). Sem a classe, a barra é a de sempre.
   */
  readonly className?: string
}

/** O bloco que rola em volta da barra: o ancestral mais próximo com rolagem vertical, ou a página. */
function blocoQueRola(elemento: HTMLElement): HTMLElement {
  for (let no = elemento.parentElement; no !== null && no !== document.body; no = no.parentElement) {
    const rolagem = getComputedStyle(no).overflowY
    if (rolagem === 'auto' || rolagem === 'scroll') return no
  }
  return document.documentElement
}

/**
 * A barra presa embaixo (`docs/interface.md` 11.1 e 11.5): a do Aprovar, com o contador e o botão `oficial`, e a da
 * caixa de pedido na conversa. Uma peça só para as duas.
 *
 * **Presa por `sticky`, e não por `fixed`**: ela é o último bloco da tela e gruda no pé da janela enquanto a lista rola
 * por trás. Por estar no fluxo, ocupa o lugar dela no fim da página, e **não cobre o último item da lista** — com
 * `fixed`, o último destaque ficaria embaixo do botão, que é justo o que a professora precisa abrir antes de aprovar.
 * Quem usa a põe como último filho do bloco que rola (a `Tela`, ou a coluna da conversa).
 *
 * **O que recebe foco não fica escondido atrás dela** (WCAG 2.4.11): no meio da lista, o Tab leva o foco a um controle
 * que o navegador rola até o pé do bloco, que é onde a barra está. A barra reserva a altura dela no bloco que rola
 * (`scroll-padding-bottom`, medido a cada mudança de tamanho, porque a 360 px ela tem duas linhas), e o navegador passa
 * a parar o controle focado acima dela. Ao sair da tela, o bloco volta a ser o que era.
 *
 * **Com a barra de baixo do celular** (`BarraDeBaixo`, RF23), ela sobe a altura da barra e fica acima dela: o `bottom` é a
 * `--barra-baixo`, que vale zero onde não há barra. A reserva do foco soma o quanto ela sobe à própria altura.
 *
 * A 360 px a informação e as ações quebram em duas linhas, e os botões continuam com 44 px. O fundo é cheio (`fundo`):
 * sem vidro fosco nem transparência, que custam quadro no Chromebook e deixariam o texto da lista vazar por trás. O fio
 * de cima é de 2 px em `borda`, como toda peça da D80. O degrau dos botões de dentro (4 px de sombra e de margem) fica
 * dentro da barra: ela cresce com a margem, e `scroll-padding-bottom` mede a altura que ficou.
 */
export function BarraPresa({ rotulo, informacao, children, semLinha = false, className = '' }: PropsDaBarraPresa) {
  const barra = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const elemento = barra.current
    if (elemento === null) return
    const bloco = blocoQueRola(elemento)
    const anterior = bloco.style.scrollPaddingBottom
    const reservar = () => {
      // O quanto ela sobe do pé da janela (`bottom`, que é a barra de baixo do celular, ou zero) também é espaço que o
      // foco não pode ocupar: com ela acima da barra, o controle parado só na altura dela ficaria atrás da barra.
      const sobe = Number.parseFloat(getComputedStyle(elemento).bottom)
      const altura = elemento.getBoundingClientRect().height + (Number.isFinite(sobe) ? sobe : 0)
      bloco.style.scrollPaddingBottom = `${String(Math.ceil(altura))}px`
    }
    reservar()
    const observador = new ResizeObserver(reservar)
    observador.observe(elemento)
    // A barra de baixo da casca nasce e some com a largura da janela e com a chegada do `/v1/eu`: muda o quanto esta sobe
    // sem mudar o tamanho dela, e o `ResizeObserver` não vê.
    const barraDeBaixo = new MutationObserver(reservar)
    barraDeBaixo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-barra-de-baixo'] })
    return () => {
      observador.disconnect()
      barraDeBaixo.disconnect()
      bloco.style.scrollPaddingBottom = anterior
    }
  }, [])

  return (
    <div ref={barra} role="group" aria-label={rotulo} data-barra-presa="" className={`sticky bottom-[var(--barra-baixo,0px)] z-10 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 bg-fundo py-3 ${semLinha ? '' : 'border-t-2 border-borda'} ${className}`.trimEnd()}>
      {informacao !== undefined && <div className="min-w-0 text-sm break-words text-apoio">{informacao}</div>}
      <div className={`flex min-w-0 flex-wrap items-center gap-3 ${informacao === undefined ? 'w-full' : 'ml-auto'}`}>{children}</div>
    </div>
  )
}
