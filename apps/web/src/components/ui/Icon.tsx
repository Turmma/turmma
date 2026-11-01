import { PLACE_DRAWINGS, type PlaceName } from './icons/places'

/** Os tamanhos em que o ícone ilustrado aparece, em px: de 24 a 48 (`docs/interface.md` 9.4). */
export type IconSize = 24 | 28 | 32 | 40 | 48

interface Props {
  /** Qual lugar. É a chave de `icons/places.tsx`, e só existem os quatro que a X1 desenha. */
  readonly nome: PlaceName
  readonly tamanho: IconSize
  /**
   * O nome do ícone, quando ele está sozinho (um botão só de ícone, o trilho). Com ele o desenho é `role="img"` com esse
   * nome. Sem ele, ou vazio, é decoração e some da leitura de tela: o rótulo está escrito ao lado, e dizê-lo duas vezes
   * é ruído (`docs/interface.md` 9.4, "ícone sempre com rótulo").
   */
  readonly rotulo?: string
}

/**
 * O ícone ilustrado de um lugar da navegação (`docs/interface.md` 9.4; Tech Spec da X1, seção 9): um SVG de 48 por 48,
 * chapado, que lê as cores dos tokens e por isso acompanha o tema. **Mora na entrada**, com a casca (seção 7c): sem
 * `import()`, sem biblioteca, sem arquivo à parte.
 *
 * O desenho em si é de `icons/places.tsx`. Esta peça só dá a caixa, o `viewBox` e o nome. Dentro de um `IconTile`, o
 * tamanho é o do ladrilho (72% do lado, por CSS), e o `tamanho` daqui vira só o de reserva.
 */
export function Icon({ nome, tamanho, rotulo }: Props) {
  const Desenho = PLACE_DRAWINGS[nome]
  const nomeado = rotulo !== undefined && rotulo !== ''
  return (
    <svg
      data-icone={nome}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 48 48"
      focusable="false"
      role={nomeado ? 'img' : undefined}
      aria-label={nomeado ? rotulo : undefined}
      aria-hidden={nomeado ? undefined : true}
      className="block shrink-0"
    >
      <Desenho />
    </svg>
  )
}
