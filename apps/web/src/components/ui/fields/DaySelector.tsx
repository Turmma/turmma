import { useId, useRef, type KeyboardEvent } from 'react'

export interface DiaDoSeletor {
  /** O que o seletor devolve ao escolher: a data `AAAA-MM-DD`. */
  readonly valor: string
  /** Três letras: "Seg". */
  readonly rotulo: string
  /** O dia do mês, embaixo do rótulo: "10". */
  readonly diaDoMes: string
  /** O nome acessível, inteiro: "Terça, 10 de novembro". */
  readonly nome: string
  /** Hoje: a peça escreve "hoje" no botão, e a cor não é a única pista. */
  readonly hoje?: boolean
}

interface Props {
  /** O nome do grupo: é o que o leitor de tela diz antes dos dias ("Dia da semana"). */
  readonly rotulo: string
  /** De cinco a sete dias, na ordem em que aparecem. A peça não confere o número: uma semana de aula tem de 5 a 7. */
  readonly dias: readonly DiaDoSeletor[]
  readonly valor: string
  readonly aoMudar: (valor: string) => void
}

/**
 * Escolhe **um dia entre cinco e sete**, numa linha só, sem rolar a 360 px (`docs/interface.md` 10.2). É o que o
 * `SegmentedControl` não é: ele vai até quatro opções, e com cinco o que se escolhe é uma lista, e não um jeito de ver.
 *
 * É um grupo de rádio (`role="radiogroup"`), com **uma parada só** no Tab: o dia marcado, ou o primeiro quando o valor não
 * é de nenhum. As setas (as quatro), Home e End escolhem e levam o foco junto, como num rádio nativo. O dia marcado não é só
 * cor: leva a borda e o fundo que os outros não têm, e o `aria-checked`.
 *
 * O nome acessível é o inteiro ("Terça, 10 de novembro"), e o "hoje" escrito no botão é a descrição dele. O alvo tem 44 px
 * de altura em qualquer largura (regra 50, item 2a); na largura, 328 px ÷ 7 dias dão perto de 46 px por dia a 360 px.
 */
export function DaySelector({ rotulo, dias, valor, aoMudar }: Props) {
  const base = useId()
  const botoes = useRef<(HTMLButtonElement | null)[]>([])
  const marcado = dias.findIndex((dia) => dia.valor === valor)
  // Com o valor fora da lista nenhum está marcado, e o primeiro continua alcançável pelo Tab.
  const naOrdemDoTab = Math.max(marcado, 0)

  function escolher(indice: number): void {
    const dia = dias[indice]
    if (dia === undefined) return
    // Escolher o que já está marcado não é mudança: não avisa de novo, e o foco vai para ele do mesmo jeito.
    if (indice !== marcado) aoMudar(dia.valor)
    botoes.current[indice]?.focus()
  }

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    const total = dias.length
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
    <div role="radiogroup" aria-label={rotulo} style={{ gridTemplateColumns: `repeat(${String(dias.length)}, minmax(0, 1fr))` }} className="grid min-w-0 gap-1 rounded-controle border-2 border-borda bg-fundo p-1">
      {dias.map((dia, indice) => {
        const ativo = indice === marcado
        const idDoHoje = `${base}-hoje-${dia.valor}`
        return (
          <button
            key={dia.valor}
            ref={(botao) => {
              botoes.current[indice] = botao
            }}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={dia.nome}
            aria-describedby={dia.hoje === true ? idDoHoje : undefined}
            tabIndex={indice === naOrdemDoTab ? 0 : -1}
            onClick={() => escolher(indice)}
            onKeyDown={(evento) => aoTeclar(evento, indice)}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center rounded-linha border-2 px-0.5 text-sm font-semibold ${
              ativo ? 'border-azul-borda bg-azul-claro text-azul-texto' : 'border-fundo text-apoio hover:border-fundo-suave hover:bg-fundo-suave hover:text-tinta'
            }`}
          >
            <span aria-hidden="true">{dia.rotulo}</span>
            <span aria-hidden="true" className="text-base">
              {dia.diaDoMes}
            </span>
            {dia.hoje === true && (
              <span id={idDoHoje} className="text-xs leading-none font-bold">
                hoje
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
