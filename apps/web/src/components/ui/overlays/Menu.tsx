import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { buttonVariants } from '../button-variants'
import { estiloDoFlutuante, useFloating, useInertOutside } from './floating'
import { itemDaTecla, itemInicial } from './menu-keyboard'

export interface MenuItem {
  readonly id: string
  readonly rotulo: string
  /** Uma frase embaixo do rótulo: o que a ferramenta entrega. */
  readonly descricao?: string
  readonly icone?: LucideIcon
  /** Aparece, mas não dá para escolher. O foco pula. */
  readonly desabilitado?: boolean
  /** Ação de perigo (excluir, revogar): texto em `vermelho-texto`. A confirmação é de quem usa (`ConfirmDialog`). */
  readonly perigo?: boolean
}

interface MenuProps {
  /** O texto do botão que abre o menu, visível e lido: "Ferramenta", "2ºB · Química". */
  readonly rotulo: string
  /**
   * O que o leitor de tela ouve antes do rótulo, quando o rótulo sozinho não diz o que o botão faz: "Turma" antes de
   * "2ºB · Química". O texto visível continua dentro do nome (WCAG 2.5.3).
   */
  readonly prefixo?: string
  readonly icone?: LucideIcon
  /** O botão mostra só o ícone, e o rótulo fica para o leitor de tela: o "mais ações" de uma linha. */
  readonly soIcone?: boolean
  readonly itens: readonly MenuItem[]
  readonly aoEscolher: (id: string) => void
  /**
   * O item escolhido agora. Com ele, o menu é de escolha única (a ferramenta do pedido, a turma): os itens são
   * `menuitemradio`, o escolhido leva a marca, e o foco abre nele.
   */
  readonly escolhido?: string
  /** Um título dentro do menu, acima dos itens: "Ferramentas". */
  readonly titulo?: string
  readonly alinhamento?: 'inicio' | 'fim'
  /** `auto` abre para baixo e vira para cima quando a janela é baixa: é o caso da caixa de pedido presa embaixo. */
  readonly lado?: 'auto' | 'acima' | 'abaixo'
  /** O desenho do botão: contorno (`secundario`) ou sem fundo (`discreto`). Nunca `primario` nem `oficial`. */
  readonly variante?: 'secundario' | 'discreto'
  readonly desligado?: boolean
}

/** A altura máxima do menu: 292 px, e daí em diante ele rola por dentro (`docs/interface.md` 11.2). */
const ALTURA_DO_MENU = 292

/** Põe o foco no item de índice dado. Os itens são achados no DOM, na ordem em que estão na tela. */
function focarItem(lista: HTMLElement | null, indice: number | undefined): void {
  if (indice === undefined) return
  lista?.querySelectorAll<HTMLElement>('[data-item]')[indice]?.focus()
}

/**
 * O menu do produto, no padrão de botão de menu da WAI-ARIA, escrito à mão: o `@radix-ui/react-dropdown-menu` medido
 * neste build pesa perto de 30 kB em brotli, e o menu de ferramenta mora na caixa de pedido da Home, que é a primeira
 * tela da professora (regra 50, item 1). O que o Radix faria e aqui é feito: nome e estado no botão (`aria-haspopup`,
 * `aria-expanded`), foco no primeiro item ao abrir, setas, `Home`, `End` e letra, Esc e clique fora fechando, e o foco
 * de volta no botão ao fechar por qualquer caminho.
 *
 * - **Abre por clique, toque, Enter, Espaço e seta**. Nada só no hover, nada só no teclado (regra 50, item 2a).
 * - **Cada item tem 44 px**, com o rótulo e, se houver, o ícone e uma frase. A caixa é a da D80 (`docs/interface.md` 10.2):
 *   canto de 16 px, a borda de 2 px e o degrau sólido de 4 px em `borda` (`shadow-flutua`); o item, de canto 10, em 15 px
 *   e peso 500, realça em `fundo-suave`, e a ação de perigo escreve em `vermelho-texto`. O item desligado perde o
 *   realce e escreve em `sutil`, com `aria-disabled`: a cor sozinha não o diria.
 * - **Não passa da janela a 360 px**: a posição é medida na abertura (`floating.ts`).
 * - **O Tab fecha** e devolve o foco ao botão: o item que some com o foco em cima o jogaria no `body`.
 * - **A rolagem por fora fecha**, com o foco de volta no botão: o menu não corre atrás dele pela tela.
 * - **O toque fora fecha, e só fecha**: o que está embaixo do menu não é acionado pelo mesmo toque, e o resto da página
 *   fica inerte enquanto o menu está aberto.
 *
 * O menu fica no documento logo depois do botão, sem portal, e em **posição fixa na janela** (`floating.ts`): dentro de
 * uma tabela que rola, de um `Dialog` ou da lista da conversa ele não sai cortado. O limite está escrito lá: ancestral
 * com `transform` ou `filter` tira a posição do lugar.
 */
export function Menu({ rotulo, prefixo, icone: Icone, soIcone = false, itens, aoEscolher, escolhido, titulo, alinhamento = 'inicio', lado = 'auto', variante = 'secundario', desligado = false }: MenuProps) {
  const [aberto, definirAberto] = useState(false)
  // Por onde o foco entra na abertura que acabou de acontecer: o escolhido (ou o primeiro) pelo clique e pela seta para
  // baixo, o último pela seta para cima. Fica vazio depois de o foco entrar: a lista que muda com o menu aberto não tira
  // o foco de onde a pessoa está.
  const entradaPendente = useRef<'primeiro' | 'ultimo' | undefined>(undefined)
  const botao = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const idDoBotao = useId()
  const idDaLista = useId()
  const { ancora, posicao } = useFloating<HTMLSpanElement>({ aberto, aoFechar: fecharEVoltar, alinhamento, lado, altura: ALTURA_DO_MENU })
  useInertOutside(aberto, ancora)
  const deEscolha = escolhido !== undefined

  const medido = posicao !== undefined
  useEffect(() => {
    const ponta = entradaPendente.current
    // Só depois da medida: antes dela o menu existe sem aparecer, e o que não aparece não recebe foco.
    if (!aberto || !medido || ponta === undefined) return
    entradaPendente.current = undefined
    const doEscolhido = itens.findIndex((item) => item.id === escolhido && item.desabilitado !== true)
    focarItem(lista.current, ponta === 'primeiro' && doEscolhido !== -1 ? doEscolhido : itemInicial(itens, ponta))
  }, [aberto, medido, itens, escolhido])

  function abrir(ponta: 'primeiro' | 'ultimo'): void {
    entradaPendente.current = ponta
    definirAberto(true)
  }

  /**
   * Fecha e devolve o foco ao botão, por qualquer caminho: a escolha, o Esc, o Tab, o toque fora e a rolagem por fora. Sem
   * rolar a página até o botão: quem rolou para longe dele não é puxado de volta.
   */
  function fecharEVoltar(): void {
    definirAberto(false)
    botao.current?.focus({ preventScroll: true })
  }

  function teclaNoBotao(evento: KeyboardEvent<HTMLButtonElement>): void {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      abrir(evento.key === 'ArrowUp' ? 'ultimo' : 'primeiro')
    }
  }

  function teclaNaLista(evento: KeyboardEvent<HTMLDivElement>): void {
    if (evento.key === 'Escape' || evento.key === 'Tab') {
      evento.preventDefault()
      // O Esc é deste menu: dentro de um diálogo ou da gaveta, ele não fecha o que está em volta.
      evento.stopPropagation()
      fecharEVoltar()
      return
    }
    const atual = Array.from(lista.current?.querySelectorAll('[data-item]') ?? []).findIndex((item) => item === document.activeElement)
    const destino = itemDaTecla(itens, atual, evento.key, evento.ctrlKey || evento.metaKey || evento.altKey)
    if (destino === undefined) return
    evento.preventDefault()
    focarItem(lista.current, destino)
  }

  function escolher(item: MenuItem): void {
    if (item.desabilitado === true) return
    fecharEVoltar()
    aoEscolher(item.id)
  }

  return (
    <span ref={ancora} className="inline-flex max-w-full min-w-0">
      <button
        ref={botao}
        type="button"
        id={idDoBotao}
        disabled={desligado}
        aria-haspopup="menu"
        aria-expanded={aberto}
        {...(aberto ? { 'aria-controls': idDaLista } : {})}
        onClick={() => (aberto ? definirAberto(false) : abrir('primeiro'))}
        onKeyDown={teclaNoBotao}
        className={`${buttonVariants({ variante, tamanho: 'compacto' })} max-w-full`}
      >
        {Icone !== undefined && <Icone aria-hidden="true" size={soIcone ? 20 : 16} strokeWidth={1.75} className="shrink-0" />}
        {prefixo !== undefined && <span className="sr-only">{prefixo}: </span>}
        <span className={soIcone ? 'sr-only' : 'min-w-0 truncate'}>{rotulo}</span>
        {!soIcone && <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0" />}
      </button>
      {/*
        O fundo do menu aberto: transparente, por cima da tela inteira e por baixo do menu. O toque fora fecha o menu e
        **não aciona o que estava embaixo** — sem ele, quem erra o item por um dedo aprova, exclui ou troca de tela sem
        querer. O resto da página fica inerte enquanto isso (`useInertOutside`); o fundo é o que garante o mesmo no
        navegador antigo, que não conhece `inert`.
      */}
      {aberto && <span aria-hidden="true" data-fundo-do-menu="" onClick={fecharEVoltar} className="fixed inset-0 z-20" />}
      {aberto && (
        <div
          ref={lista}
          id={idDaLista}
          role="menu"
          aria-labelledby={idDoBotao}
          onKeyDown={teclaNaLista}
          style={{ ...estiloDoFlutuante(posicao), maxHeight: posicao?.alturaMaxima ?? ALTURA_DO_MENU }}
          className="fixed z-30 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-0.5 overflow-y-auto rounded-cartao bg-superficie p-1.5 text-left shadow-flutua"
        >
          {titulo !== undefined && (
            <p aria-hidden="true" className="t-selo px-2.5 pt-1.5 pb-1 text-sutil">
              {titulo}
            </p>
          )}
          {itens.map((item) => {
            const marcado = deEscolha && item.id === escolhido
            const ItemIcone = item.icone
            const desligadoAqui = item.desabilitado === true
            return (
              <button
                key={item.id}
                type="button"
                data-item=""
                role={deEscolha ? 'menuitemradio' : 'menuitem'}
                {...(deEscolha ? { 'aria-checked': marcado } : {})}
                {...(desligadoAqui ? { 'aria-disabled': true } : {})}
                // Os itens ligados ficam na ordem do teclado: o menu rola por dentro, e região que rola precisa de algo
                // alcançável pelo teclado dentro dela. O Tab não passeia por eles: ele fecha o menu (acima).
                tabIndex={desligadoAqui ? -1 : 0}
                onClick={() => escolher(item)}
                className={`t-apoio flex min-h-11 w-full min-w-0 shrink-0 items-center gap-3 rounded-linha px-2.5 py-2 text-left -outline-offset-2 ${
                  desligadoAqui ? 'text-sutil' : `hover:bg-fundo-suave focus-visible:bg-fundo-suave ${item.perigo === true ? 'text-vermelho-texto' : 'text-tinta'}`
                } ${marcado ? 'font-bold' : ''}`}
              >
                {ItemIcone !== undefined && <ItemIcone aria-hidden="true" size={18} strokeWidth={1.75} className={`shrink-0 ${item.perigo === true && !desligadoAqui ? '' : 'text-sutil'}`} />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words">{item.rotulo}</span>
                  {item.descricao !== undefined && <span className="text-sm font-medium break-words text-sutil">{item.descricao}</span>}
                </span>
                {marcado && <Check aria-hidden="true" size={16} strokeWidth={2.4} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </span>
  )
}
