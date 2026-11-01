import { useId, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { useModalDialog } from './modal-dialog'

export interface DialogProps {
  readonly titulo: string
  /** Fechar: o "Cancelar", o Esc, e quem terminou o que o diálogo fazia. Quem fecha é quem desmonta. */
  readonly aoFechar: () => void
  /**
   * O clique (ou toque) fora da caixa, no fundo escurecido, também é um pedido de fechar, e vai ao `aoFechar`. Ligado só
   * no convite (tarefa 7.0), onde fechar por qualquer caminho pergunta antes; num diálogo de criação, o toque que erra a
   * caixa no celular apagaria o que foi digitado.
   */
  readonly fecharAoClicarFora?: boolean
  /**
   * O navegador fechou o diálogo sem passar pelo `aoFechar`: o Chrome não deixa o `cancel` ser segurado duas vezes seguidas
   * sem um gesto da pessoa entre elas, e o segundo Esc fecha o `dialog` direto. A tela precisa saber, para não ficar com
   * um diálogo que ela acha aberto e o navegador já fechou. Sem isto, vale o `aoFechar`.
   */
  readonly aoFecharPeloNavegador?: () => void
  /**
   * Onde o foco começa. Sem isto, o navegador o põe no primeiro controle do diálogo, que numa confirmação é o botão que
   * confirma: um Enter a mais e a ação sai sem a pessoa ter lido o que ela faz (regra 50, item 8).
   */
  readonly focoInicial?: RefObject<HTMLElement | null>
  /**
   * Para onde o foco vai ao fechar quando quem abriu o diálogo já saiu da página: o "Revogar" da escola some quando a lista
   * recarrega com o convite revogado. Sem isto, o foco cairia no `body` (regra 50, item 11).
   */
  readonly focoDeReserva?: () => void
  readonly children: ReactNode
  /**
   * O que a área põe no fim da caixa, depois do conteúdo: na operação, o aviso de inatividade, que fora do diálogo modal
   * ficaria inerte (`operacao/components/DialogoDaOperacao.tsx`). A escola não tem aviso: a sessão vencida abre o login
   * por cima (`LoginPorCima`), que é outro diálogo.
   */
  readonly rodape?: ReactNode
  /**
   * `alertdialog` é o diálogo que interrompe para pedir uma confirmação (a decisão oficial, a ação de perigo): o leitor de
   * tela o anuncia como alerta e lê a descrição junto do título. Sem isto, é o diálogo comum.
   */
  readonly papel?: 'alertdialog'
  /** O id do texto que descreve o diálogo, lido com o título ao abrir: "o que vai acontecer" na confirmação. */
  readonly descritoPor?: string
  /**
   * O diálogo ocupa a janela inteira (largura e altura), com o fundo `fundo` por classe de token e sem canto, borda nem degrau:
   * é o passo "Acesso gerado" do "Convidar alunos", que a professora projeta e atrás do qual nada pode ficar legível (telas do
   * professor, 13.0). A troca entre as duas caixas é na hora, sem transição, no mesmo `dialog`: o foco e o que está dentro
   * não saem do lugar. O véu do `::backdrop` não muda (a guarda de cor da X1 só aceita cor lá).
   */
  readonly inteira?: boolean
}

/** A caixa de sempre: 520 px, canto de 16 px, a borda de 2 px e o degrau (`docs/interface.md` 9.3 e 10.2). */
const CAIXA_DE_520 = 'max-h-[calc(100svh-2rem)] w-[min(32.5rem,calc(100%-2rem))] overflow-y-auto rounded-caixa bg-superficie p-5 text-tinta shadow-flutua sm:p-6'
/** A janela inteira: `m-0` tira a centralização do reset, e `max-w-none` e `max-h-none`, o teto que o navegador dá ao `dialog` modal. */
const CAIXA_INTEIRA = 'm-0 h-full max-h-none w-full max-w-none overflow-y-auto bg-fundo p-5 text-tinta sm:p-8'

/** A coluna do que está dentro da janela inteira: não estica de uma borda à outra, como o código que se projeta. */
const COLUNA_DA_INTEIRA = 'mx-auto w-full max-w-3xl'

/**
 * O diálogo das telas, no padrão do `LoginPorCima` do F1: o `dialog` nativo em modo modal, que deixa o resto da página
 * inerte. Nasceu na operação (Nova rede, Nova escola; Tech Spec da A0b, seção 9) e veio para `components/` na A1 (13.0,
 * antecipando a 14.1), para a Estrutura da coordenação usar o mesmo: importar de `src/operacao/` levaria o módulo para
 * um `parte-*` que a escola baixaria (B2, `apps/web/chunk-names.test.ts`). Nada da operação mora aqui; o aviso de
 * inatividade dela entra pelo `rodape`. Existe só enquanto está aberto: o que ele guarda (o id do pedido, o que foi
 * digitado) nasce na abertura e morre no fechamento.
 *
 * A caixa é a da D80 (`docs/interface.md` 9.3 e 10.2): canto de 16 px, a borda de 2 px e o degrau sólido de 4 px em
 * `borda` (`shadow-flutua`), sobre o véu `veu` que `index.css` põe no `::backdrop`. Os botões do fim ficam à direita
 * (cada diálogo os escreve, porque cada um tem os seus). Não há "X" no cabeçalho: ele seria o primeiro controle da ordem
 * do Tab e de quase todo diálogo já existe um "Cancelar" ou um "Fechar" (`docs/interface.md` 10.2, produto).
 *
 * Duas coisas o navegador não garante sozinho, e por isso estão em `modal-dialog.ts`, divididas com o `Sheet`
 * (cenário W8 da A0b, W12 da A1):
 * - **o foco preso**: no fim da ordem, o Tab do Chrome sai do diálogo para a barra do navegador; ali ele volta ao
 *   primeiro controle, e o Shift+Tab no primeiro vai ao último;
 * - **o foco devolvido** a quem abriu (o botão "Nova rede", por exemplo), ao fechar por qualquer caminho.
 *
 * O Esc fecha, como o "Cancelar": não há nada de irreversível em fechar um diálogo de criação, e o pedido que já saiu
 * volta sozinho pelo id, se a pessoa abrir de novo e repetir. No convite, o Esc e o clique fora vão ao `aoFechar` dele,
 * que pergunta antes de fechar sem o link copiado (tarefa 7.0).
 */
export function Dialog({ titulo, aoFechar, fecharAoClicarFora = false, aoFecharPeloNavegador, focoInicial, focoDeReserva, children, rodape, papel, descritoPor, inteira = false }: DialogProps) {
  const { dialogo, fechadoPeloNavegador, prender } = useModalDialog({ focoInicial, focoDeReserva })
  // Onde o botão do mouse (ou o dedo) desceu: o "fora" só vale se começou fora. Selecionar o link arrastando e soltar
  // fora da caixa não é pedido de fechar.
  const comecouFora = useRef(false)
  const idDoTitulo = useId()

  /** O ponto está fora da caixa do `dialog`? O clique no próprio `dialog` fora dela é o fundo. */
  function foraDaCaixa(evento: MouseEvent<HTMLDialogElement>): boolean {
    if (evento.target !== evento.currentTarget) return false
    const caixa = evento.currentTarget.getBoundingClientRect()
    return evento.clientX < caixa.left || evento.clientX > caixa.right || evento.clientY < caixa.top || evento.clientY > caixa.bottom
  }

  function clicarFora(evento: MouseEvent<HTMLDialogElement>): void {
    const comecou = comecouFora.current
    comecouFora.current = false
    if (fecharAoClicarFora && comecou && foraDaCaixa(evento)) aoFechar()
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idDoTitulo}
      {...(papel === undefined ? {} : { role: papel })}
      {...(descritoPor === undefined ? {} : { 'aria-describedby': descritoPor })}
      onCancel={(evento) => {
        evento.preventDefault()
        aoFechar()
      }}
      onClose={() => {
        if (fechadoPeloNavegador()) (aoFecharPeloNavegador ?? aoFechar)()
      }}
      onMouseDown={(evento) => (comecouFora.current = foraDaCaixa(evento))}
      onClick={clicarFora}
      onKeyDown={prender}
      className={inteira ? CAIXA_INTEIRA : CAIXA_DE_520}
    >
      {/* Sempre o mesmo `div`, com ou sem classe: trocar a caixa não pode remontar o que está dentro (o foco, o link copiado). Na janela
          inteira o título e o conteúdo ficam juntos numa coluna centralizada, e não o título no canto e o resto no meio. */}
      <div className={inteira ? COLUNA_DA_INTEIRA : undefined}>
        <h2 id={idDoTitulo} className="t-secao">
          {titulo}
        </h2>
        {children}
        {rodape}
      </div>
    </dialog>
  )
}
