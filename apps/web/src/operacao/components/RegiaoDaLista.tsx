import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

/** O conteúdo do elemento passa do que ele mostra, no eixo dado? */
function passaDoQueMostra(alvo: HTMLElement, eixo: 'x' | 'y'): boolean {
  return eixo === 'x' ? alvo.scrollWidth > alvo.clientWidth : alvo.scrollHeight > alvo.clientHeight
}

/**
 * Se o conteúdo do elemento passa do que ele mostra, no eixo dado. Medido a cada renderização (o que há dentro mudou) e
 * quando ele ou um filho dele muda de tamanho (a janela, a fonte). Só o elemento que rola ganha foco: o que cabe não vira
 * uma parada a mais no Tab (a mesma regra da `Table`).
 */
export function useSobra(elemento: RefObject<HTMLElement | null>, eixo: 'x' | 'y'): boolean {
  const [sobra, definirSobra] = useState(false)
  // Medida a cada renderização: o que há dentro mudou (um erro que entrou na região), sem que ela mudasse de tamanho.
  useEffect(() => {
    const alvo = elemento.current
    if (alvo === null) return
    const medir = () => definirSobra(passaDoQueMostra(alvo, eixo))
    medir()
  })
  // E quando a janela, a fonte ou um filho mudam de tamanho.
  useEffect(() => {
    const alvo = elemento.current
    if (alvo === null) return
    const medir = () => definirSobra(passaDoQueMostra(alvo, eixo))
    const observador = new ResizeObserver(medir)
    observador.observe(alvo)
    for (const filho of alvo.children) observador.observe(filho)
    return () => observador.disconnect()
  }, [elemento, eixo])
  return sobra
}

interface PropsDaRegiao {
  /** O nome da região para o leitor de tela: "Lista de escolas", "Uso por escola". */
  readonly rotulo: string
  /** A página nova está a caminho, com a anterior na tela (`placeholderData`). */
  readonly ocupada: boolean
  /** O que fica preso no pé da região enquanto a lista rola: as páginas. */
  readonly pe: ReactNode
  readonly children: ReactNode
}

/**
 * A região da lista de uma tela da operação (RF23): a partir de 768 px ela ocupa o que sobra da janela e **rola por
 * dentro**, com as páginas coladas no pé, e a página inteira não rola a 1366 × 768. Abaixo disso, rola a página, como
 * qualquer outra. A região recebe o foco quando rola, para rolar pelo teclado, e só então.
 */
export function RegiaoDaLista({ rotulo, ocupada, pe, children }: PropsDaRegiao) {
  const regiao = useRef<HTMLElement>(null)
  const sobra = useSobra(regiao, 'y')
  return (
    <section
      ref={regiao}
      aria-label={rotulo}
      aria-busy={ocupada}
      {...(sobra ? { tabIndex: 0 } : {})}
      className="relative flex min-w-0 flex-col gap-4 md:min-h-40 md:flex-1 md:overflow-y-auto"
    >
      {/* `shrink-0`: o que está dentro (a tabela rola na horizontal, logo `overflow` não visível) não pode ser espremido
          pela região e rolar por conta própria, sem foco; quem rola na vertical é a região. E a região é `relative` para
          que o texto só de leitor de tela (`sr-only`, posição absoluta, como a legenda da tabela) fique no recorte dela:
          sem isso ele escapa da rolagem e estica a página. */}
      <div className="flex min-w-0 shrink-0 flex-col gap-4">{children}</div>
      <div className="md:sticky md:bottom-0 md:bg-fundo md:py-2">{pe}</div>
    </section>
  )
}
