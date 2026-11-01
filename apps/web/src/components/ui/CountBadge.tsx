/** As dez famílias de cor da D80 (`docs/interface.md` 9.1): a face de cada uma é um token, e o texto sobre ela é `sobre-cor`. */
export const COLOR_FAMILIES = ['laranja', 'azul', 'verde', 'amarelo', 'vermelho', 'roxo', 'turquesa', 'anil', 'lima', 'rosa'] as const
export type ColorFamily = (typeof COLOR_FAMILIES)[number]

/**
 * A face de cada família. O mapa é literal, nome por nome: o Tailwind só gera a classe que acha escrita por inteiro, e
 * `bg-${familia}` montada em tempo de execução ficaria sem regra nenhuma no CSS servido, e a pílula, sem fundo.
 */
const FACE_DA_FAMILIA: Readonly<Record<ColorFamily, string>> = {
  laranja: 'bg-laranja',
  azul: 'bg-azul',
  verde: 'bg-verde',
  amarelo: 'bg-amarelo',
  vermelho: 'bg-vermelho',
  roxo: 'bg-roxo',
  turquesa: 'bg-turquesa',
  anil: 'bg-anil',
  lima: 'bg-lima',
  rosa: 'bg-rosa',
}

interface Props {
  /** Quantos. Zero (ou menos) não desenha nada: o contador que diz "0 esperando você" é ruído, e não aviso. */
  readonly n: number
  /** O que o número conta, em texto: "pedidos de nome", "entregas esperando você". É o que o leitor de tela diz depois dele. */
  readonly oQueConta: string
  /** A face da pílula. Sem ela, laranja: é a cor de "pede a sua ação" (9.1). */
  readonly familia?: ColorFamily
  /** O número é um piso: a lista veio cheia e há mais. A pílula mostra "100+" e o leitor de tela ouve "100 ou mais". */
  readonly ouMais?: boolean
}

/**
 * O contador da D80 (`docs/interface.md` 10.2): uma pílula de 24 px na face da família, com o número em 700 e algarismos
 * tabulares, e o texto em `sobre-cor`, que é escuro nos dois temas (4,5:1 sobre cada face).
 *
 * - **O número diz o que conta, em texto**: o `oQueConta` vai escrito para o leitor de tela (`sr-only`), logo depois do
 *   número, e quem lê a tela ouve "2 pedidos de nome", e não "2". A cor da face não diz nada: ela é categoria, nunca
 *   julgamento (9.1), e por isso o nome da família não entra no que se lê.
 * - **Sem item, não aparece**, e **não pisca**: nenhuma animação, nem ao mudar o número (D59). O contador é leitura, não
 *   convite a abrir.
 * - **`ouMais`** é o número que é um piso (a página veio cheia e há outra): o sinal "+" fica só para a vista, e o texto escondido
 *   começa por "ou mais".
 * - Não é clicável e não leva ação: a aba ou a linha que o carrega é que age.
 */
export function CountBadge({ n, oQueConta, familia = 'laranja', ouMais = false }: Props) {
  if (!(n > 0)) return null
  return (
    <span data-contador className={`inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-sm leading-6 font-bold tabular-nums text-sobre-cor ${FACE_DA_FAMILIA[familia]}`}>
      {n}
      {ouMais && <span aria-hidden="true">+</span>}
      <span className="sr-only"> {ouMais ? 'ou mais ' : ''}{oQueConta}</span>
    </span>
  )
}
