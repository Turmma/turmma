import { useQuery } from '@tanstack/react-query'
import { memoriaDoTutorQueryOptions } from '../../api/memoria-do-tutor'
import { LoadingState, ErrorState, EmptyState } from '../../components/states'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { SectionHeader } from '../../components/ui/Page'
import {
  DESCRICAO_DO_VAZIO,
  ROTULO_DAS_HABILIDADES,
  ROTULO_DO_CARREGANDO,
  TEXTO_DA_CONTESTACAO,
  textoDasCertas,
  TITULO_DE_COMO_ESTOU_INDO,
  TITULO_DO_VAZIO,
} from './como-estou-indo'

/**
 * "Como estou indo" em Eu (telas do aluno e primeiro acesso, 7.0; RF9, RF10, RF20): uma linha por tarefa de **correção
 * aprovada**, com "N de M certas" e as habilidades a rever, na ordem em que a API as mandou, em duas colunas a partir de 1024 px (RF20: duas
 * tarefas corrigidas cabem na janela de 1366 × 768 de Eu). Nos quatro estados — carregando,
 * vazio, erro com "Tentar de novo" e com dado — e **sem derrubar o resto de Eu**: a turma no cabeçalho e as linhas não dependem
 * desta leitura. Só o aluno da sessão, sem colega, média, posição nem sinal do Tutor (D66).
 */
export function ComoEstouIndo() {
  const memoria = useQuery(memoriaDoTutorQueryOptions)

  function conteudo() {
    if (memoria.isPending) return <LoadingState rotulo={ROTULO_DO_CARREGANDO} />
    if (memoria.isError) return <ErrorState erro={memoria.error} tentando={memoria.isFetching} aoTentarDeNovo={() => void memoria.refetch({ cancelRefetch: false })} />
    if (memoria.data.length === 0) return <EmptyState titulo={TITULO_DO_VAZIO} descricao={DESCRICAO_DO_VAZIO} />
    return (
      <>
        <ul className="grid gap-3 lg:grid-cols-2">
          {memoria.data.map(({ atividadeAplicadaId, titulo, resultado }) => (
            <li key={atividadeAplicadaId} className="rounded-cartao border border-linha bg-superficie p-4">
              <ProgressBar rotulo={titulo} valor={resultado.acertos} maximo={resultado.total} texto={textoDasCertas(resultado.acertos, resultado.total)} />
              {resultado.aReforcar.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-apoio">{ROTULO_DAS_HABILIDADES}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {resultado.aReforcar.map((habilidade) => (
                      <li key={habilidade.codigo} className="text-sm break-words text-tinta">
                        <span className="font-semibold">{habilidade.codigo}</span> · {habilidade.descricao}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="text-sm text-apoio">{TEXTO_DA_CONTESTACAO}</p>
      </>
    )
  }

  return (
    <section aria-labelledby="titulo-como-estou-indo" className="flex min-w-0 flex-col gap-3">
      <SectionHeader titulo={TITULO_DE_COMO_ESTOU_INDO} id="titulo-como-estou-indo" />
      {conteudo()}
    </section>
  )
}
