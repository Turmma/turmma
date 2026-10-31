import { useLayoutEffect } from 'react'
import { Link, useLocation } from 'wouter'
import { estaNoItem, type ItemDaNavegacao } from '../areas/navigation'
import { Icone } from './ui/Icone'
import { Ladrilho } from './ui/Ladrilho'

/**
 * Quantos lugares cabem na barra de baixo do celular (`docs/interface.md` 11.1, R1): quatro, a 90 px cada um nos 360 px da
 * janela mais estreita. O papel que passa disso mantém os itens na gaveta (a coordenação tinha sete, até a X2).
 */
export const MAXIMO_NA_BARRA = 4

export type OndeFicamOsItens = 'barra' | 'gaveta'

/**
 * Onde os itens de navegação ficam abaixo de 768 px: na barra de baixo, quando são de um a quatro; na gaveta, quando são
 * mais (a coordenação) ou nenhum (o `/v1/eu` ainda não chegou: uma barra vazia seria uma faixa de 68 px sem nada).
 */
export function ondeFicamOsItens(itens: readonly ItemDaNavegacao[]): OndeFicamOsItens {
  return itens.length > 0 && itens.length <= MAXIMO_NA_BARRA ? 'barra' : 'gaveta'
}

/**
 * A pílula de 48 × 36 que segura o ícone, com a borda de 2 px que existe nos dois estados: acender não desloca nada. O
 * aceso tem a borda `azul-borda` e o fundo `azul-claro`, como o lugar da lateral (`itens-da-lateral.tsx`).
 */
const PILULA = 'flex h-9 w-12 shrink-0 items-center justify-center rounded-controle border-2'
const PILULA_ACESA = 'border-azul-borda bg-azul-claro'
const PILULA_APAGADA = 'border-transparent'

/**
 * O ícone de 28 px do lugar: o ilustrado, ou o do `lucide` no `Ladrilho` da família dele, o menor que a peça tem (32 px,
 * que é o miolo da pílula). Decoração: o rótulo está escrito embaixo.
 */
function IconeDaBarra({ item }: { item: ItemDaNavegacao }) {
  if ('lugar' in item.icone) return <Icone nome={item.icone.lugar} tamanho={28} />
  const Desenho = item.icone.lucide
  return (
    <Ladrilho familia={item.icone.familia} tamanho={32}>
      <Desenho strokeWidth={2.5} />
    </Ladrilho>
  )
}

/**
 * A barra de baixo do celular (`docs/interface.md` 11.1; D80; RF14): os itens de navegação do professor e do aluno, fixa
 * no pé da janela, com 68 px mais a área segura. Cada lugar é uma coluna: o ícone de 28 px na pílula de 48 × 36, e o
 * rótulo em 12 px, 700 e caixa-alta (o único 12 px do produto, 9.2), cortado com reticências quando não cabe.
 *
 * - **Existir é reservar o lugar dela.** Enquanto está na página, põe `data-barra-de-baixo` no `<html>`, e o CSS
 *   (`index.css`) declara a `--barra-baixo` com a altura dela. O `<main>` da casca e a `BarraPresa` leem a variável: o
 *   último botão da tela termina acima da barra, e a barra presa embaixo sobe para ficar acima dela. Fora do celular, ou
 *   para a coordenação, a variável é zero e nada muda.
 * - **Inerte com a gaveta aberta**: a gaveta é um `dialog` modal, e o navegador deixa inerte tudo que está fora dele, a
 *   barra inclusive. Por isso ela é irmã da gaveta, e não filha dela.
 * - O selecionado tem o `aria-current`, a borda e o fundo da pílula, e o texto `azul-texto`: a cor sozinha não é a pista.
 */
export function BarraDeBaixo({ itens }: { itens: readonly ItemDaNavegacao[] }) {
  const [caminho] = useLocation()

  // Antes da pintura, para o primeiro quadro já ter a reserva: o `<main>` não pula quando a barra aparece.
  useLayoutEffect(() => {
    const raiz = document.documentElement
    raiz.setAttribute('data-barra-de-baixo', '')
    return () => raiz.removeAttribute('data-barra-de-baixo')
  }, [])

  return (
    <nav aria-label="Seções" className="fixed inset-x-0 bottom-0 z-10 h-[var(--barra-baixo)] border-t-2 border-borda bg-lateral px-1 pb-[env(safe-area-inset-bottom,0px)]">
      <ul className="flex h-full">
        {itens.map((item) => {
          const aqui = estaNoItem(caminho, item)
          return (
            <li key={item.caminho} className="min-w-0 flex-1">
              <Link
                to={item.caminho}
                aria-current={aqui ? 'page' : undefined}
                className="flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-controle px-1 focus-visible:-outline-offset-3"
              >
                <span aria-hidden="true" data-pilula="" className={`${PILULA} ${aqui ? PILULA_ACESA : PILULA_APAGADA}`}>
                  <IconeDaBarra item={item} />
                </span>
                <span className={`block max-w-full truncate text-xs leading-4 font-bold tracking-[0.04em] uppercase ${aqui ? 'text-azul-texto' : 'text-sutil'}`}>{item.rotulo}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
