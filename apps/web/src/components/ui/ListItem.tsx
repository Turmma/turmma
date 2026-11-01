import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'wouter'

interface ListItemCommonProps {
  /** O título, em texto: uma linha só, com reticências, e o `title` guarda o texto inteiro. Entra no nome acessível. */
  readonly titulo: string
  /** À esquerda: um `IconTile`, um avatar, um ícone. Decoração, sem nada clicável dentro. */
  readonly inicio?: ReactNode
  /** A segunda linha, em `t-apoio` e `sutil`: a data, a turma, o que falta. */
  readonly abaixo?: ReactNode
  /** À direita, antes do chevron: um selo de estado, um contador, um número. Sem nada clicável dentro. */
  readonly fim?: ReactNode
  /**
   * O título quebra em até duas linhas, em vez de uma só com reticências. Só para o título **fixo e curto**, que a tela não pode
   * deixar cortado em 360 px ("Rever a introdução", RF9): o que vem de dado (nome, atividade) segue em uma linha.
   */
  readonly tituloEmDuasLinhas?: boolean
}

/** Uma ação só: a linha é um link (`para`), um botão (`aoAcionar`) ou só de leitura (nenhum dos dois). */
type ListItemProps = ListItemCommonProps &
  (
    | { readonly para: string; readonly aoAcionar?: never }
    | { readonly aoAcionar: () => void; readonly para?: never }
    | { readonly para?: never; readonly aoAcionar?: never }
  )

const CAIXA = 'flex min-h-16 w-full min-w-0 items-center gap-3 px-4 py-2 text-left'

/**
 * Aciona a linha inteira, e o anel do foco é desenhado por dentro (`-outline-offset-3`, `docs/interface.md` 9.1 e 10.2):
 * a linha costuma ser o filho de uma moldura que corta o que passa dela, e um anel por fora ficaria sem metade.
 */
const CAIXA_QUE_ACIONA = `${CAIXA} hover:bg-fundo-suave focus-visible:-outline-offset-3`

/**
 * A linha de lista da D80 (`docs/interface.md` 10.2): **a linha inteira é um alvo só** — um `<a>` ou um `<button>`, e
 * nunca um clicável dentro de outro —, com 64 px de altura no mínimo, o título em `t-cartao` numa linha com reticências,
 * a segunda linha em `t-apoio` e, no fim, o chevron de 20 px, que é decoração (`aria-hidden`: o link já se anuncia como
 * link). Sem ação é um `div`, sem chevron e sem parada no Tab: ler não é acionar.
 *
 * `inicio`, `abaixo` e `fim` são conteúdo, e ficam dentro do alvo: **nada clicável vai neles**. O que a linha tem a dizer
 * (um selo "Esperando você", uma data) entra pelo nome acessível, junto do título. A partir de 640 px o `fim` fica à
 * direita do texto; abaixo disso desce para debaixo dele, para o selo não tomar a largura do título (a 360 px, com o
 * ícone e o chevron, sobrariam uns 90 px de título).
 *
 * O separador de 2 px entre uma linha e a de cima é de quem as junta, com `divide-y-2 divide-borda` na lista, dentro de
 * uma moldura de borda de 2 px e canto de 16: a linha sozinha não sabe se é a primeira. Cada linha vai no seu `<li>`.
 */
interface ListItemBodyProps extends ListItemCommonProps {
  /** Com ação (link ou botão) a linha leva o chevron; sem ela é só leitura, e não leva. */
  readonly acionavel: boolean
}

/** O que a linha mostra por dentro, igual nos três casos; só o chevron depende de a linha ter ação. */
function MioloDaLinha({ titulo, inicio, abaixo, fim, tituloEmDuasLinhas = false, acionavel }: ListItemBodyProps) {
  return (
    <>
      {inicio !== undefined && <span className="flex shrink-0 items-center">{inicio}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span title={titulo} className={`t-cartao text-tinta ${tituloEmDuasLinhas ? 'line-clamp-2 break-words' : 'truncate'}`}>
            {titulo}
          </span>
          {abaixo !== undefined && <span className="t-apoio break-words text-sutil">{abaixo}</span>}
        </span>
        {fim !== undefined && <span className="flex shrink-0 items-center gap-2 self-start sm:self-center">{fim}</span>}
      </span>
      {acionavel && <ChevronRight aria-hidden="true" focusable="false" className="size-5 shrink-0 text-apagado" />}
    </>
  )
}

export function ListItem({ para, aoAcionar, ...conteudo }: ListItemProps) {
  if (para !== undefined)
    return (
      <Link to={para} className={CAIXA_QUE_ACIONA}>
        <MioloDaLinha {...conteudo} acionavel />
      </Link>
    )
  if (aoAcionar !== undefined)
    return (
      <button type="button" onClick={aoAcionar} className={CAIXA_QUE_ACIONA}>
        <MioloDaLinha {...conteudo} acionavel />
      </button>
    )
  return (
    <div className={CAIXA}>
      <MioloDaLinha {...conteudo} acionavel={false} />
    </div>
  )
}
