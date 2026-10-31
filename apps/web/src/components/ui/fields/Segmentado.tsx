import { useId, useRef, type KeyboardEvent } from 'react'

export interface OpcaoDoSegmentado<Valor extends string> {
  readonly valor: Valor
  readonly rotulo: string
}

/** De duas a quatro opções (`docs/interface.md` 10.2): com cinco, o que se escolhe é uma lista, e não um jeito de ver. */
export type OpcoesDoSegmentado<Valor extends string> =
  | readonly [OpcaoDoSegmentado<Valor>, OpcaoDoSegmentado<Valor>]
  | readonly [OpcaoDoSegmentado<Valor>, OpcaoDoSegmentado<Valor>, OpcaoDoSegmentado<Valor>]
  | readonly [OpcaoDoSegmentado<Valor>, OpcaoDoSegmentado<Valor>, OpcaoDoSegmentado<Valor>, OpcaoDoSegmentado<Valor>]

interface Props<Valor extends string> {
  /** O nome do grupo: é o que o leitor de tela diz antes das opções. */
  readonly rotulo: string
  /** Com `true`, o nome também aparece em texto, em cima do grupo, e o grupo é nomeado por ele. */
  readonly rotuloVisivel?: boolean
  readonly opcoes: OpcoesDoSegmentado<Valor>
  readonly valor: Valor
  readonly aoMudar: (valor: Valor) => void
  /**
   * Com quatro rótulos que não cabem em uma linha a 360 px ("Esperando o professor", "Rejeitados"), abaixo de 768 px as opções
   * ficam em **duas colunas**, duas por linha. Sem a prop, a linha única de sempre. A partir de 768 px é sempre uma linha só.
   */
  readonly emDuasColunasNoCelular?: boolean
}

/**
 * Troca o **jeito de ver**, e não o lugar: três ou quatro opções lado a lado, uma marcada (`docs/interface.md` 10.2). Não
 * é aba (a aba abre outro assunto) e não é lista de seleção.
 *
 * É um grupo de rádio (`role="radiogroup"`), com **uma parada só** no Tab: a opção marcada, ou a primeira quando o valor
 * não é de nenhuma. As setas (as quatro), Home e End escolhem e levam o foco junto, como num rádio nativo. A opção marcada
 * não é só cor: leva a borda e o fundo, que a desmarcada não tem, e o `aria-checked`.
 *
 * Alvo de 36 px no computador e de 44 px abaixo de 768 px (regra 50, item 2a): a peça não é a ação principal da tela.
 * `emDuasColunasNoCelular` é para quatro rótulos longos, que a 360 px não cabem lado a lado sem sair do botão (X2, 10.0).
 */
export function Segmentado<Valor extends string>({ rotulo, rotuloVisivel = false, opcoes, valor, aoMudar, emDuasColunasNoCelular = false }: Props<Valor>) {
  const idDoRotulo = useId()
  const botoes = useRef<(HTMLButtonElement | null)[]>([])
  const marcada = opcoes.findIndex((opcao) => opcao.valor === valor)
  // Com o valor fora da lista nenhuma está marcada, e a primeira continua alcançável pelo Tab.
  const naOrdemDoTab = Math.max(marcada, 0)

  function escolher(indice: number): void {
    const opcao = opcoes[indice]
    if (opcao === undefined) return
    // Escolher a que já está marcada não é mudança: não avisa de novo, e o foco vai para ela do mesmo jeito.
    if (indice !== marcada) aoMudar(opcao.valor)
    botoes.current[indice]?.focus()
  }

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    const total = opcoes.length
    let destino: number
    switch (evento.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        destino = (indice + 1) % total
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        destino = (indice - 1 + total) % total
        break
      case 'Home':
        destino = 0
        break
      case 'End':
        destino = total - 1
        break
      default:
        return
    }
    evento.preventDefault()
    escolher(destino)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {rotuloVisivel && (
        <span id={idDoRotulo} className="text-sm font-semibold">
          {rotulo}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={rotuloVisivel ? undefined : rotulo}
        aria-labelledby={rotuloVisivel ? idDoRotulo : undefined}
        className={`min-w-0 gap-1 rounded-controle border-2 border-borda bg-fundo p-1 ${emDuasColunasNoCelular ? 'grid grid-cols-2 md:flex' : 'flex'}`}
      >
        {opcoes.map((opcao, indice) => {
          const ativa = indice === marcada
          return (
            <button
              key={opcao.valor}
              ref={(botao) => {
                botoes.current[indice] = botao
              }}
              type="button"
              role="radio"
              aria-checked={ativa}
              tabIndex={indice === naOrdemDoTab ? 0 : -1}
              onClick={() => escolher(indice)}
              onKeyDown={(evento) => aoTeclar(evento, indice)}
              className={`min-h-11 min-w-0 flex-1 rounded-linha border-2 px-1 text-sm font-semibold md:min-h-9 ${
                ativa ? 'border-azul-borda bg-azul-claro text-azul-texto' : 'border-fundo text-apoio hover:border-fundo-suave hover:bg-fundo-suave hover:text-tinta'
              }`}
            >
              {opcao.rotulo}
            </button>
          )
        })}
      </div>
    </div>
  )
}
