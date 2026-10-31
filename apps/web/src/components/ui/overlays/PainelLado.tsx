import { X } from 'lucide-react'
import { useId, useRef, type ReactNode } from 'react'
import { Botao } from '../Botao'
import { useDialogoModal } from './modal-dialog'

export interface PropsDoPainelLado {
  readonly titulo: string
  /** Fechar: o "Fechar" do cabeçalho e o Esc. Quem fecha é quem desmonta, como no `Dialogo`. */
  readonly aoFechar: () => void
  readonly children: ReactNode
  /** Os botões do fim, à direita, sobre uma borda de 2 px. Sem isto, o painel não tem rodapé. */
  readonly rodape?: ReactNode
  /** O id do texto que descreve o painel, lido com o título ao abrir. */
  readonly descritoPor?: string
  /**
   * Para onde o foco vai ao fechar quando quem abriu o painel já saiu da página. Sem isto, o foco cairia no `body`
   * (regra 50, item 11).
   */
  readonly focoDeReserva?: () => void
}

/**
 * O painel que abre ao lado da tela (`docs/interface.md` 9.3 e 10.2; Tech Spec da X1, seção 9): a partir de 768 px, 480 px
 * colados à direita e na altura da janela; abaixo, folha de baixo com até 88% da altura (a borda de 2 px de cima já
 * dentro dos 88%), canto de 20 px em cima e a área segura do aparelho no pé. A tela por trás continua ali, escurecida pelo `veu`, mas inerte.
 *
 * É um `<dialog>` modal, como o `Dialogo`, e **o que é comum aos dois mora em `modal-dialog.ts`**: o `showModal`, a
 * prisão do foco e a devolução dele a quem abriu (ou ao `focoDeReserva`, quando esse saiu da página). O navegador dá o
 * Esc e o resto inerte.
 *
 * - **Cede a vez ao aviso de incidente** (`priority-dialog.ts`): o painel que abre pelo endereço espera, sem abrir, enquanto o
 *   aviso está na tela, e abre quando ele sai. Sem isso, o último modal a abrir o cobria e o deixava inerte.
 * - **O foco entra no miolo**, e não no "Fechar": quem abre o painel quer ler o que há nele, e o primeiro Tab já vai ao
 *   primeiro controle do conteúdo. O miolo é `tabIndex={0}`: recebe o foco inicial por código e fica no ciclo do Tab, porque é a
 *   região que rola (WCAG 2.1.1; o axe acusa `scrollable-region-focusable` quando o conteúdo passa da altura e não há controle
 *   dentro). Como o foco já está nele, o primeiro Tab continua indo ao primeiro controle do conteúdo.
 * - **Fecha pelo "Fechar" e pelo Esc, e só por eles.** O toque fora não fecha: ele apagaria o que foi digitado no painel
 *   de quem erra a borda com o dedo.
 * - **Não anima largura nem altura** (regra 50, item 1): ele aparece. Só `transform` e `opacity` poderiam animar, e nada
 *   aqui o faz.
 * - **O "Fechar" tem 44 px**, como todo alvo de toque da ação principal.
 *
 * Quem o usa: o sino da coordenação e os painéis das telas Turmas, Professores e Material (X2); a X3 traz os do professor.
 * Fica fora da entrada (`PECAS_FORA_DA_ENTRADA`), como as outras peças novas.
 */
export function PainelLado({ titulo, aoFechar, children, rodape, descritoPor, focoDeReserva }: PropsDoPainelLado) {
  const miolo = useRef<HTMLDivElement>(null)
  const { dialogo, fechadoPeloNavegador, prender } = useDialogoModal({ focoInicial: miolo, focoDeReserva, cedeAoPrioritario: true })
  const idDoTitulo = useId()
  return (
    <dialog
      ref={dialogo}
      data-painel-lado=""
      aria-labelledby={idDoTitulo}
      {...(descritoPor === undefined ? {} : { 'aria-describedby': descritoPor })}
      onCancel={(evento) => {
        evento.preventDefault()
        aoFechar()
      }}
      onClose={() => {
        if (fechadoPeloNavegador()) aoFechar()
      }}
      onKeyDown={prender}
      className="fixed inset-x-0 top-auto bottom-0 m-0 h-auto max-h-none w-full max-w-none overflow-hidden rounded-t-[20px] border-2 border-b-0 border-borda bg-superficie p-0 text-tinta md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[480px] md:rounded-none md:border-0 md:border-l-2"
    >
      <div className="flex max-h-[calc(88svh-2px)] min-h-0 flex-col pb-[env(safe-area-inset-bottom)] md:h-full md:max-h-none">
        <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b-2 border-borda px-5 md:px-6">
          <h2 id={idDoTitulo} className="t-secao min-w-0 break-words">
            {titulo}
          </h2>
          <Botao variante="discreto" tamanho="icone" aria-label="Fechar" onClick={aoFechar}>
            <X aria-hidden="true" size={20} strokeWidth={2.5} />
          </Botao>
        </div>
        <div ref={miolo} tabIndex={0} data-painel-miolo="" className="min-h-0 flex-1 overflow-y-auto p-5 -outline-offset-3 md:p-6">
          {children}
        </div>
        {rodape !== undefined && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t-2 border-borda px-5 py-3 md:px-6">{rodape}</div>
        )}
      </div>
    </dialog>
  )
}
