import { rotuloDoItem, type ItemDoDia } from '@educa/shared'
import { Link } from 'wouter'
import { AIBadge } from '../../../../components/ui/ai/AgentSignature'
import { enderecoDoItem, nomeDoItem } from './semana'

/**
 * O que aconteceu naquele dia na turma e na disciplina da professora (RF7): atividade aplicada, atividade encerrada e correção do Assistente,
 * com o estado de hoje da correção. Cada item é um **link**: a atividade abre o painel dela na turma, e a correção abre a revisão (o
 * endereço do "Revisar" do sino). O rótulo vem de `packages/shared` (`rotuloDoItem`), e esta tela não escreve nenhum.
 *
 * Sem nota, média, acerto nem nome de aluno (regra 70, item 7): o contrato do item não os traz. Estado nunca é só cor (regra 50, item 11):
 * o rótulo é texto. O nome acessível é `nomeDoItem` ("tipo · estado: título"; a correção diz também que é gerada por IA), e o alvo tem 44 px de altura. A correção leva o selo "IA" (saída do Assistente).
 */
export function ItensDoDia({ itens }: { readonly itens: readonly ItemDoDia[] }) {
  return (
    <ul aria-label="O que aconteceu neste dia" className="flex flex-col gap-2">
      {itens.map((item) => (
        <li key={`${item.tipo}-${item.atividadeAplicadaId}`} className="min-w-0">
          <Link
            to={enderecoDoItem(item)}
            aria-label={nomeDoItem(item)}
            className="flex min-h-11 w-full min-w-0 flex-col items-start justify-center gap-1 rounded-controle border-2 border-borda bg-superficie p-3 text-left hover:bg-fundo-suave"
          >
            <span aria-hidden="true" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="t-selo text-apoio">{rotuloDoItem(item)}</span>
              {/* A correção é saída do Assistente: o selo "IA", o mesmo de todo o produto (regra 70, item 4a; Decreto 12.880, art. 11). */}
              {item.tipo === 'correcao' && <AIBadge />}
            </span>
            <span aria-hidden="true" className="min-w-0 text-sm font-bold break-words text-tinta">
              {item.titulo}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
