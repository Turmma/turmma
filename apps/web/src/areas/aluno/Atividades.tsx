import type { MinhaAtividade } from '@educa/shared'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { minhasAtividadesInfiniteQueryOptions } from '../../api/atividades-do-aluno'
import { caminhoDaAtividadeDoAluno } from '../../paths'
import { Button } from '../../components/ui/Button'
import { IconTile } from '../../components/ui/IconTile'
import { ListItem } from '../../components/ui/ListItem'
import { LoadingState, ErrorState, EmptyState } from '../../components/states'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { SectionHeader, Page } from '../../components/ui/Page'
import { usePageTitle } from '../../document-title'
import { textoDasQueAindaNaoChegaram } from './atividade'
import { AVISO_DA_AVALIACAO, detalheDaSituacao, estaParaResponder, resumoDaAtividade, separarAtividades, TEXTO_DA_SITUACAO, textoDaJanelaNaLista, VAZIO_DE_CADA_GRUPO } from './atividades'
import { assinarAsFilas, respostasQueNaoChegaram } from './fila-de-respostas'
import { caraDaMateria } from './materia'
import { useAgora } from './use-agora'

/** Uma tarefa na lista: a linha inteira é o link, com o ladrilho da matéria, o estado em texto no selo e o detalhe de hoje. `agora` é o relógio do computador, lido uma vez pela lista (um só intervalo no computador fraco). */
function LinhaDaTarefa({ atividade, agora }: { atividade: MinhaAtividade; agora: number }) {
  const { familia, Icone } = caraDaMateria(atividade.disciplina.nome)
  // As respostas que o servidor ainda não confirmou ficam na fila da aba, que segue depois do "Sair da prova": a lista as conta até a fila esvaziar.
  const naoChegaram = useSyncExternalStore(assinarAsFilas, () => respostasQueNaoChegaram(atividade.id))
  const janela = textoDaJanelaNaLista(atividade, agora)
  return (
    <li data-atividade={atividade.situacao} data-atividade-id={atividade.id}>
      <ListItem
        titulo={atividade.titulo}
        para={caminhoDaAtividadeDoAluno(atividade.id)}
        inicio={
          <IconTile familia={familia} tamanho={44}>
            <Icone aria-hidden="true" />
          </IconTile>
        }
        abaixo={
          <>
            <span className="block">{resumoDaAtividade(atividade)}</span>
            {janela !== undefined && <span className="block font-medium text-tinta">{janela}</span>}
            <span className="block">{detalheDaSituacao(atividade)}</span>
            {naoChegaram > 0 && (
              <span role="status" className="block font-medium text-erro">
                {textoDasQueAindaNaoChegaram(naoChegaram)}
              </span>
            )}
            {atividade.avaliativa && estaParaResponder(atividade) && <span className="block font-medium text-tinta">{AVISO_DA_AVALIACAO}</span>}
          </>
        }
        /* O estado em texto, no selo: `ok` só quando a correção foi aprovada; o resto é cinza, porque nada aqui é alarme. */
        fim={<StatusBadge familia={atividade.situacao === 'com_diagnostico' ? 'ok' : 'info'}>{TEXTO_DA_SITUACAO[atividade.situacao]}</StatusBadge>}
      />
    </li>
  )
}

interface PropsDoGrupo {
  readonly id: string
  readonly titulo: string
  readonly vazio: string
  readonly atividades: readonly MinhaAtividade[]
  readonly agora: number
}

/** Um grupo da lista: o título, as tarefas numa moldura só, ou a linha tracejada que diz que não há nenhuma. */
function GrupoDeTarefas({ id, titulo, vazio, atividades, agora }: PropsDoGrupo) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <SectionHeader id={id} titulo={titulo} />
      {atividades.length === 0 ? (
        <p className="flex min-w-0 items-center gap-2 rounded-cartao border-2 border-dashed border-borda bg-superficie p-4 text-apoio">
          <Check aria-hidden="true" size={20} className="shrink-0" />
          <span className="min-w-0 break-words">{vazio}</span>
        </p>
      ) : (
        <ul className="divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda bg-superficie">
          {atividades.map((atividade) => (
            <LinhaDaTarefa key={atividade.id} atividade={atividade} agora={agora} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * "Tarefas" do aluno (era "Atividades", MVP, A3; `docs/interface.md` 2 e 11.6): o que a professora atribuiu à turma dele, com o estado
 * de cada atividade em texto. É o segundo lugar do aluno: ele abre no Início (X4, 2.0) e chega aqui pela lateral.
 *
 * **Nenhum dado de colega** (regra 50, item 9): sem lista de quem entregou, sem média da turma, sem posição. O contrato
 * de `GET /v1/minhas-atividades` não traz nada disso. E nada aqui empurra (D59): sem contagem regressiva, sem "atrasada",
 * sem selo de conquista; o vazio diz que não há o que fazer agora, e pronto.
 *
 * É aba de navegação: o `<h1>`, visível, é o título da tela, na `Page` (RF12 da X1).
 */
export default function Atividades() {
  usePageTitle('Tarefas')
  const atividades = useInfiniteQuery(minhasAtividadesInfiniteQueryOptions)
  const agora = useAgora()
  const itens = atividades.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const { paraFazer, entregues, corrigidas } = separarAtividades(itens)
  const volteiDaProva = useRef(false)
  // Quem saiu da prova volta com o foco na linha dela (o "Sair da prova" leva o id no estado do histórico): sem isto o foco cairia no `body`.
  useEffect(() => {
    if (volteiDaProva.current || itens.length === 0) return
    const estado: unknown = window.history.state
    const id = typeof estado === 'object' && estado !== null && 'voltouDaProva' in estado ? estado.voltouDaProva : undefined
    if (typeof id !== 'string') return
    volteiDaProva.current = true
    for (const linha of document.querySelectorAll<HTMLElement>('[data-atividade-id]')) if (linha.dataset['atividadeId'] === id) linha.querySelector<HTMLElement>('a')?.focus()
  }, [itens.length])

  return (
    <Page titulo="Tarefas" largura="conversa">
      {atividades.isPending && <LoadingState rotulo="Carregando as suas atividades…" />}
      {atividades.isError && atividades.data === undefined && (
        <ErrorState erro={atividades.error} tentando={atividades.isFetching} aoTentarDeNovo={() => void atividades.refetch({ cancelRefetch: false })} />
      )}
      {atividades.data !== undefined && itens.length === 0 && (
        <EmptyState titulo="Nada para fazer agora" descricao="Quando quem dá a aula passar uma atividade para a turma, ela aparece aqui." />
      )}

      {itens.length > 0 && (
        <>
          <GrupoDeTarefas id="titulo-para-fazer" titulo="Para fazer" vazio={VAZIO_DE_CADA_GRUPO.paraFazer} atividades={paraFazer} agora={agora} />
          <GrupoDeTarefas id="titulo-entregues" titulo="Entregues" vazio={VAZIO_DE_CADA_GRUPO.entregues} atividades={entregues} agora={agora} />
          <GrupoDeTarefas id="titulo-corrigidas" titulo="Corrigidas" vazio={VAZIO_DE_CADA_GRUPO.corrigidas} atividades={corrigidas} agora={agora} />
        </>
      )}

      {/* A lista não rola sem fim: a página seguinte só vem quando o aluno pede (D59). */}
      {atividades.hasNextPage && (
        <Button variante="secundario" onClick={() => void atividades.fetchNextPage()} disabled={atividades.isFetchingNextPage} className="self-center">
          {atividades.isFetchingNextPage ? 'Carregando…' : 'Ver mais tarefas'}
        </Button>
      )}
    </Page>
  )
}
