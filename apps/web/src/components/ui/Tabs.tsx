import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { CountBadge } from './CountBadge'
import { abaDaTecla, abaNaOrdemDoTab } from './tabs-keyboard'

export interface TabItem {
  readonly id: string
  readonly rotulo: string
  /** Um número ao lado do rótulo. Zero não aparece. */
  readonly contador?: number
  /** O que o número conta, para o leitor de tela: "pedidos", "sinais novos". Sem ele, "esperando você". */
  readonly oQueConta?: string
}

interface TabsProps {
  /** O nome da lista de abas para o leitor de tela: "Seções da turma". */
  readonly rotulo: string
  readonly abas: readonly TabItem[]
  readonly ativa: string
  readonly aoMudar: (id: string) => void
  /**
   * Classes a mais no painel da aba ativa. É por aqui que uma moldura faz só o miolo rolar (X2, 3.0): o painel já é uma região
   * com nome e `tabIndex={0}`, e por isso a rolagem dele se alcança pelo teclado.
   */
  readonly classeDoPainel?: string
  /** O conteúdo da aba ativa. */
  readonly children: ReactNode
}

/**
 * Abas, no padrão da WAI-ARIA, escritas à mão: o `@radix-ui/react-tabs` medido neste build pesa perto de 8 kB em brotli
 * para o que cabe em sessenta linhas, e o teto da área do professor inteira é 8 kB (regra 50, item 1).
 *
 * - **Uma parada só no Tab**: a aba ativa. As setas trocam de aba (e dão a volta), `Home` e `End` vão às pontas, e o
 *   Tab seguinte entra no painel.
 * - **Clique e toque** trocam do mesmo jeito: nada aqui depende de teclado nem de hover (regra 50, item 2a).
 * - **A ativa tem três pistas** (`docs/interface.md` 10.2): o texto em `azul-texto`, o sublinhado de 3 px em `azul` sobre
 *   o fio de 2 px da lista, e o `aria-selected`. Só a cor não diria nada num Chromebook de entrada, e por isso a forma
 *   (o sublinhado) e o estado (o ARIA) vão juntos.
 * - **A lista quebra de linha** quando não cabe: a 360 px todas as abas ficam à vista, em duas linhas se for preciso. A
 *   lista que rola de lado esconde a aba que ficou para fora, e nada diria que ela existe.
 * - **A ativa que não está na lista** (o id que veio errado do endereço) não deixa a lista sem parada no Tab: a primeira
 *   aba fica alcançável, e o painel fica sem dono até a pessoa escolher uma.
 * - **O número ao lado do rótulo** é o `CountBadge`: com o que ele conta escrito para o leitor de tela, e sem desenho
 *   nenhum quando é zero.
 *
 * 44 px de altura em todo tamanho de tela, no computador também: é a das abas da página (`AbasDaPagina` do mockup), que
 * levam o número, e é a que a 10.2 pede. Os 48 px são os da linha de abas solta do mockup, que esta peça não desenha.
 */
export function Tabs({ rotulo, abas, ativa, aoMudar, classeDoPainel = '', children }: TabsProps) {
  const base = useId()
  const lista = useRef<HTMLDivElement>(null)
  const idDaAba = (id: string) => `${base}-aba-${id}`
  const idDoPainel = `${base}-painel`
  const ids = abas.map((aba) => aba.id)
  const daParada = abaNaOrdemDoTab(ids, ativa)
  const ativaExiste = ids.includes(ativa)

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    // As setas partem da aba que tem a parada: é ela que tem o foco, mesmo quando a ativa não existe.
    const destino = abaDaTecla(ids, daParada ?? ativa, evento.key)
    if (destino === undefined) return
    evento.preventDefault()
    aoMudar(destino)
    // O foco acompanha a aba: sem isto, ele ficaria na aba que deixou de ser a ativa, que saiu da ordem do Tab.
    lista.current?.querySelector<HTMLElement>(`[id="${idDaAba(destino)}"]`)?.focus()
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div ref={lista} role="tablist" aria-label={rotulo} onKeyDown={aoTeclar} className="flex min-w-0 flex-wrap gap-x-1 border-b-2 border-borda">
        {abas.map((aba) => {
          const selecionada = aba.id === ativa
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={idDaAba(aba.id)}
              aria-selected={selecionada}
              aria-controls={idDoPainel}
              tabIndex={aba.id === daParada ? 0 : -1}
              onClick={() => aoMudar(aba.id)}
              className={`t-rotulo relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 whitespace-nowrap ${selecionada ? 'text-azul-texto' : 'text-sutil hover:text-tinta'}`}
            >
              {aba.rotulo}
              {aba.contador !== undefined && <CountBadge n={aba.contador} oQueConta={aba.oQueConta ?? 'esperando você'} />}
              {selecionada && <span aria-hidden="true" className="absolute inset-x-2 -bottom-0.5 h-0.75 rounded-full bg-azul" />}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={idDoPainel} {...(ativaExiste ? { 'aria-labelledby': idDaAba(ativa) } : { 'aria-label': rotulo })} tabIndex={0} className={`min-w-0 ${classeDoPainel}`.trim()}>
        {children}
      </div>
    </div>
  )
}
