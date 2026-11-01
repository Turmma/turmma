import { useEffect, useRef, type RefObject } from 'react'
import { quandoNaoHouverPrioritario } from './priority-dialog'

/**
 * O que os dois `<dialog>` modais do produto, o `Dialog` e o `Sheet`, fazem do mesmo jeito: abrir com `showModal`,
 * prender o foco e devolvê-lo a quem abriu (Tech Spec da X1, seção 9, "Peças novas"). O navegador dá o Esc e deixa o
 * resto da página inerte; as outras duas coisas não, e por isso moram aqui, uma vez só, e não copiadas em cada peça.
 *
 * Fica fora das duas porque o `Dialog` é da entrada e o `Sheet` não: o que as duas dividem não pode morar numa
 * peça que a entrada não baixa (`apps/web/chunk-names.ts`).
 */

/** O que recebe foco dentro do diálogo, na ordem do Tab. */
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** O mínimo que a prisão lê de um evento de teclado: o que o React e o DOM entregam têm isto. */
export interface TeclaDoDialogo {
  readonly key: string
  readonly shiftKey: boolean
  preventDefault(): void
}

/**
 * O Tab que sairia do diálogo volta para dentro dele. No fim da ordem, o Tab do Chrome sai do `dialog` modal para a
 * barra do navegador; aqui ele volta ao primeiro controle, e o Shift+Tab no primeiro vai ao último.
 *
 * O foco pode estar fora da ordem do Tab — o título da etapa ou o miolo do painel, focados por código (`tabIndex={-1}`) —,
 * e então o limite não é "estar no primeiro", e sim "não haver controle antes" (ou depois) dele.
 */
export function trapFocus(evento: TeclaDoDialogo, raiz: HTMLElement | null): void {
  if (evento.key !== 'Tab' || raiz === null) return
  const focaveis = Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS))
  const primeiro = focaveis[0]
  const ultimo = focaveis.at(-1)
  const ativo = document.activeElement
  if (primeiro === undefined || ultimo === undefined || ativo === null) return
  const haAntes = focaveis.some((elemento) => (elemento.compareDocumentPosition(ativo) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
  const haDepois = focaveis.some((elemento) => (elemento.compareDocumentPosition(ativo) & Node.DOCUMENT_POSITION_PRECEDING) !== 0)
  if (evento.shiftKey && !haAntes) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && !haDepois) {
    evento.preventDefault()
    primeiro.focus()
  }
}

interface ModalDialogOptions {
  /**
   * Onde o foco começa. Sem isto, o navegador o põe no primeiro controle do diálogo, que numa confirmação é o botão que
   * confirma: um Enter a mais e a ação sai sem a pessoa ter lido o que ela faz (regra 50, item 8).
   */
  readonly focoInicial?: RefObject<HTMLElement | null> | undefined
  /**
   * Para onde o foco vai ao fechar quando quem abriu o diálogo já saiu da página: o "Revogar" da escola some quando a lista
   * recarrega com o convite revogado. Vale também para o diálogo que abre sem ninguém com o foco (o `body`), como o "Convidar alunos"
   * pedido pelo endereço. Sem isto, o foco cairia no `body` (regra 50, item 11).
   */
  readonly focoDeReserva?: (() => void) | undefined
  /**
   * O diálogo abre sozinho (o painel pelo endereço) e cede a vez ao diálogo prioritário, o aviso de incidente: enquanto houver um na
   * tela ele não chama `showModal`, porque o último modal a abrir cobriria o aviso e o deixaria inerte. Abre quando o último sai.
   * O diálogo que o toque da pessoa abre não precisa disto: a página está inerte atrás do aviso. Ver `priority-dialog.ts`.
   */
  readonly cedeAoPrioritario?: boolean | undefined
}

/**
 * Abre o `dialog` em modo modal na montagem, fecha na desmontagem e devolve o foco a quem abriu, por qualquer caminho.
 *
 * - **Quem fecha o `dialog` somos nós**, ao desmontar; o `close` que chega sem isso veio do navegador
 *   (`fechadoPeloNavegador`): o Chrome não deixa o `cancel` ser segurado duas vezes seguidas sem um gesto entre elas, e o
 *   segundo Esc fecha o `dialog` direto.
 * - **`showModal` duas vezes lança**: sob `StrictMode` o efeito roda de novo com o diálogo ainda aberto.
 * - **O gatilho que continua na página mas ficou desligado** (o "Aprovar" depois de aprovado) não aceita foco: vale como
 *   o que saiu da página, e o foco vai para a reserva.
 */
export function useModalDialog({ focoInicial, focoDeReserva, cedeAoPrioritario = false }: ModalDialogOptions) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const desmontando = useRef(false)
  // O `focoDeReserva` da última renderização: a limpeza do efeito roda uma vez só, ao desmontar.
  const reserva = useRef(focoDeReserva)
  useEffect(() => {
    reserva.current = focoDeReserva
  }, [focoDeReserva])

  useEffect(() => {
    const atual = dialogo.current
    if (atual === null) return
    // Quem abriu é quem tinha o foco antes do `showModal`: o clique e o Enter num botão deixam o foco nele. Se o diálogo espera o
    // prioritário, é quem tem o foco quando ele de fato abre.
    let quemAbriu: HTMLElement | undefined
    let abriu = false
    desmontando.current = false
    const abrir = () => {
      abriu = true
      // O `body` com o foco é ninguém: o diálogo que abre sozinho (pelo endereço) não tem a quem devolver o foco, e `body.focus()` não faz nada.
      quemAbriu = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : undefined
      if (!atual.open) atual.showModal()
      focoInicial?.current?.focus()
    }
    const desistir = cedeAoPrioritario ? quandoNaoHouverPrioritario(abrir) : (abrir(), undefined)
    return () => {
      desistir?.()
      desmontando.current = true
      if (atual.open) atual.close()
      if (quemAbriu?.isConnected === true && !quemAbriu.matches(':disabled')) quemAbriu.focus()
      else if (abriu) reserva.current?.()
    }
    // O `focoInicial` é um `useRef` de quem desenha o diálogo: o mesmo objeto enquanto o diálogo vive.
  }, [focoInicial, cedeAoPrioritario])

  /**
   * O `close` chega depois, numa tarefa à parte: sob `StrictMode` o efeito fecha e reabre, e o `close` do fechamento de
   * mentira encontra o diálogo aberto de novo. Só o que o deixou fechado é do navegador.
   */
  function fechadoPeloNavegador(): boolean {
    return !desmontando.current && dialogo.current?.open === false
  }

  return {
    dialogo,
    fechadoPeloNavegador,
    prender: (evento: TeclaDoDialogo) => trapFocus(evento, dialogo.current),
  }
}
