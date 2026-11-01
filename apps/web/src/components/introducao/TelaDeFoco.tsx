import { useContext, type ReactNode } from 'react'
import { ContextoDaSaida } from '../sign-out-context'
import { Button } from '../ui/Button'

interface PropsDaTelaDeFoco {
  /** O passo de agora e quantos há, a partir de 1: a barra e o texto "Passo N de M" saem deles. */
  readonly passo: number
  readonly total: number
  /** O `id` do texto "Passo N de M", que a fala do passo aponta com `aria-describedby`. */
  readonly idDoPasso: string
  /** Só revendo a introdução, que já foi vista. Na primeira vez não há "Fechar": quem quer ir embora tem o "Sair". */
  readonly aoFechar?: () => void
  readonly children: ReactNode
  /** Os botões do pé: "Continuar" e "Pular". */
  readonly rodape: ReactNode
}

/**
 * A moldura de uma tela de foco (mockup 2.8; `ehTelaDeFoco`): no topo a barra do passo e o **"Sair", sempre à vista**, no
 * mesmo desenho do "Fechar" (D59: sair nunca é menor que seguir); no meio, a fala e o conteúdo; no pé, os botões. Não é
 * `<main>`: o da casca já envolve a tela (um por página). O "Sair" é o da casca (`ContextoDaSaida`), o mesmo da barra do
 * topo e do menu da pessoa, e por isso faz exatamente a mesma coisa.
 *
 * A barra é desenho: quem lê com leitor de tela ouve "Passo 2 de 4", no texto que a fala aponta, e a barra fica de fora.
 */
export function TelaDeFoco({ passo, total, idDoPasso, aoFechar, children, rodape }: PropsDaTelaDeFoco) {
  const { sair, saindo } = useContext(ContextoDaSaida)
  const cheio = Math.min(100, Math.max(0, (passo / total) * 100))
  return (
    <div data-tela-de-foco="" className="mx-auto flex w-full max-w-[560px] min-w-0 flex-1 flex-col gap-6">
      <header className="flex min-w-0 items-center gap-3">
        <svg aria-hidden="true" focusable="false" className="block h-4 min-w-0 flex-1" preserveAspectRatio="none">
          <rect width="100%" height="100%" rx="8" className="fill-ia-cx" />
          <rect data-barra-do-passo="" width={`${String(cheio)}%`} height="100%" rx="8" className="fill-sutil" />
        </svg>
        <p id={idDoPasso} className="sr-only">{`Passo ${String(passo)} de ${String(total)}`}</p>
        {aoFechar !== undefined && (
          <Button variante="secundario" onClick={aoFechar} className="shrink-0">
            Fechar
          </Button>
        )}
        <Button variante="secundario" onClick={sair} disabled={saindo} className="shrink-0">
          {saindo ? 'Saindo…' : 'Sair'}
        </Button>
      </header>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-5">{children}</div>
      <footer className="flex min-w-0 flex-wrap gap-3 pb-4">{rodape}</footer>
    </div>
  )
}
