import { StatusBadge } from '../StatusBadge'
import { motivoDaRejeicao, textoDaAprovacao, type Aprovacao } from './approval'

export interface ApprovalLineProps {
  readonly aprovacao: Aprovacao
  /** O verbo da aprovada, com o gênero do que foi aprovado: "Aprovada por", "Validação registrada por". */
  readonly verbo?: string
  /** O que a pendente diz a quem não é o professor: na Governança, "Esperando o professor". */
  readonly espera?: string
}

/**
 * A linha da aprovação humana, a terceira parte do selo de IA (`docs/interface.md` 11.3): **"Aprovado por Camila Souza ·
 * 19/09, 10h42"**, em família `ok`. É a resposta da tela a "o que a IA gerou, quem aprovou e quando" (regra 70, item 6),
 * e metade do argumento do produto é que um humano aprovou.
 *
 * As outras duas situações usam a mesma linha: pendente ("Esperando você", em `pendente`) e rejeitada, em `erro`, com o
 * **motivo** logo embaixo. **É o selo de estado do produto** (`StatusBadge`), com o mesmo canto, o mesmo respiro e o mesmo
 * ícone: a aprovação não tem um desenho só dela. O que esta peça acrescenta é o texto certo — quem e quando — e o
 * motivo.
 */
export function ApprovalLine({ aprovacao, verbo, espera }: ApprovalLineProps) {
  const texto = textoDaAprovacao(aprovacao, { ...(verbo === undefined ? {} : { verbo }), ...(espera === undefined ? {} : { espera }) })
  const motivo = motivoDaRejeicao(aprovacao)
  return (
    <div data-aprovacao={aprovacao.estado} className="flex max-w-full min-w-0 flex-col items-start gap-1">
      {aprovacao.estado === 'pendente' ? <StatusBadge familia="pendente">{texto}</StatusBadge> : <StatusBadge familia={aprovacao.estado === 'aprovada' ? 'ok' : 'erro'}>{texto}</StatusBadge>}
      {motivo !== undefined && <p className="min-w-0 text-sm break-words text-apoio">{motivo}</p>}
    </div>
  )
}
