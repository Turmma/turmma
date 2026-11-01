import type { MinhaAtividade } from '@educa/shared'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Link } from 'wouter'
import { minhasAtividadesInfiniteQueryOptions } from '../../api/atividades-do-aluno'
import { caminhoDoTutorNaAtividade } from '../../paths'
import { LoadingState, ErrorState, EmptyState } from '../../components/states'
import { Button } from '../../components/ui/Button'
import { SectionHeader } from '../../components/ui/Page'
import { AVISO_DA_AVALIACAO, estaParaResponder, resumoDaAtividade } from './atividades'

/** Uma atividade da escolha: o link inteiro leva ao Tutor dela, e a avaliação que espera resposta é avisada antes de abrir. */
function LinhaDaEscolha({ atividade }: { atividade: MinhaAtividade }) {
  const avisar = atividade.avaliativa && estaParaResponder(atividade)
  return (
    <li>
      <Link to={caminhoDoTutorNaAtividade(atividade.id)} className="flex min-h-11 min-w-0 items-center gap-3 rounded-cartao border border-linha bg-superficie p-4 text-tinta hover:bg-realce-suave">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="min-w-0 text-base font-semibold break-words">{atividade.titulo}</span>
          <span className="min-w-0 text-sm break-words text-sutil">{resumoDaAtividade(atividade)}</span>
          {avisar && <span className="min-w-0 text-sm break-words text-apoio">{AVISO_DA_AVALIACAO}</span>}
        </span>
        <ChevronRight aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0 text-sutil" />
      </Link>
    </li>
  )
}

/** A página seguinte só vem quando o aluno pede: a lista não rola sem fim (D59). */
function VerMais({ carregando, aoPedir }: { carregando: boolean; aoPedir: () => void }) {
  return (
    <Button variante="secundario" onClick={aoPedir} disabled={carregando} className="self-center">
      {carregando ? 'Carregando…' : 'Ver mais atividades'}
    </Button>
  )
}

/**
 * A escolha da atividade em que o aluno quer ajuda do Tutor: a conversa é por atividade, e por isso o aluno escolhe aqui
 * **em qual atividade quer ajuda**. Só as atividades dele, na ordem em que a API as entrega; sem sugestão, sem atalho que
 * se mexe. É o corpo do Início (telas do aluno e primeiro acesso, 2.0) e continua sendo o de `/aluno/tutor`.
 */
export function EscolhaDaAtividade() {
  const atividades = useInfiniteQuery(minhasAtividadesInfiniteQueryOptions)
  const itens = atividades.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  return (
    <>
      {atividades.isPending && <LoadingState rotulo="Carregando as suas atividades…" />}
      {atividades.isError && atividades.data === undefined && (
        <ErrorState erro={atividades.error} tentando={atividades.isFetching} aoTentarDeNovo={() => void atividades.refetch({ cancelRefetch: false })} />
      )}
      {atividades.data !== undefined && itens.length === 0 && (
        <EmptyState titulo="Nenhuma atividade para pedir ajuda agora" descricao="O Tutor ajuda nas atividades que quem dá a aula passa para a turma. Quando houver uma, ela aparece aqui." />
      )}
      {itens.length > 0 && (
        <section aria-labelledby="titulo-escolha" className="flex min-w-0 flex-col gap-3">
          <SectionHeader id="titulo-escolha" titulo="Em qual atividade você quer ajuda?" />
          <ul className="flex min-w-0 flex-col gap-2">
            {itens.map((atividade) => (
              <LinhaDaEscolha key={atividade.id} atividade={atividade} />
            ))}
          </ul>
        </section>
      )}
      {atividades.hasNextPage && <VerMais carregando={atividades.isFetchingNextPage} aoPedir={() => void atividades.fetchNextPage()} />}
    </>
  )
}
