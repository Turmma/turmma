import type { ReactNode } from 'react'
// Só o tipo, que o compilador apaga: o `Contador` é peça fora da entrada, e o `Ladrilho` mora nela.
import type { FamiliaDeCor } from './Contador'

/** O lado do ladrilho, em px: de 32 a 56. O 36 é o da caixa do ícone na lateral (Tech Spec da X1, seção 9). */
export type TamanhoDoLadrilho = 32 | 36 | 40 | 44 | 48 | 56

/**
 * O fundo de cada família é o `claro` dela, e o texto, o `texto` dela: é o par que a tabela de contraste prova nos dois
 * temas, e é a cor com que o `currentColor` do `lucide` dentro do ladrilho se desenha. O mapa é literal, nome por nome: o
 * Tailwind só gera a classe que acha escrita por inteiro, e `bg-${familia}-claro` montada em tempo de execução ficaria sem
 * regra no CSS servido.
 */
const COR_DA_FAMILIA: Readonly<Record<FamiliaDeCor, string>> = {
  laranja: 'bg-laranja-claro text-laranja-texto',
  azul: 'bg-azul-claro text-azul-texto',
  verde: 'bg-verde-claro text-verde-texto',
  amarelo: 'bg-amarelo-claro text-amarelo-texto',
  vermelho: 'bg-vermelho-claro text-vermelho-texto',
  roxo: 'bg-roxo-claro text-roxo-texto',
  turquesa: 'bg-turquesa-claro text-turquesa-texto',
  anil: 'bg-anil-claro text-anil-texto',
  lima: 'bg-lima-claro text-lima-texto',
  rosa: 'bg-rosa-claro text-rosa-texto',
}

/** O lado, por classe literal, pelo mesmo motivo: `size-8`, `size-9`… e não `size-${n}`. */
const LADO: Readonly<Record<TamanhoDoLadrilho, string>> = {
  32: 'size-8',
  36: 'size-9',
  40: 'size-10',
  44: 'size-11',
  48: 'size-12',
  56: 'size-14',
}

interface Props {
  /** A família do fundo. Não diz nada sobre a coisa: cor é categoria, nunca julgamento (`docs/interface.md` 9.1). */
  readonly familia: FamiliaDeCor
  readonly tamanho: TamanhoDoLadrilho
  /** O nome, quando o ladrilho está sozinho. Sem ele (ou vazio) é decoração, e o rótulo está ao lado. */
  readonly rotulo?: string
  /** O ícone: um `Icone` ou um do `lucide`. Um só, sem nada clicável dentro. */
  readonly children: ReactNode
}

/**
 * O ladrilho da D80 (`docs/interface.md` 10.2): um quadrado de canto 12 com o fundo no `claro` da família e o ícone a 72%
 * do lado. Dá a moldura de família ao ícone ilustrado e ao do `lucide`, que sem ela ficariam de duas famílias na mesma
 * lista.
 *
 * - **O ícone preenche os 72%** por CSS (`[&>svg]:size-full`), seja o `Icone` ou o `lucide`: o `tamanho` que o filho
 *   declara é só reserva. O `lucide` desenha com `currentColor`, e o ladrilho põe nele o `texto` da família.
 * - **Nome, ou decoração.** Com `rotulo` é `role="img"` com esse nome, e o que está dentro vira parte da imagem (filho de
 *   `img` é apresentacional). Sem, é `aria-hidden`: o rótulo está escrito ao lado, e dizê-lo duas vezes é ruído.
 * - Parado, sem hover e sem foco: não é controle.
 */
export function Ladrilho({ familia, tamanho, rotulo, children }: Props) {
  const nomeado = rotulo !== undefined && rotulo !== ''
  return (
    <span
      data-ladrilho={familia}
      role={nomeado ? 'img' : undefined}
      aria-label={nomeado ? rotulo : undefined}
      aria-hidden={nomeado ? undefined : true}
      className={`inline-flex shrink-0 items-center justify-center rounded-controle ${LADO[tamanho]} ${COR_DA_FAMILIA[familia]}`}
    >
      <span className="flex size-[72%] items-center justify-center [&>svg]:size-full">{children}</span>
    </span>
  )
}
