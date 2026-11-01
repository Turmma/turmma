import type { RetencaoResponse } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { retencaoQueryOptions } from './api/privacidade'
import { LoadingState, ErrorState } from '../../../components/states'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { SectionHeader } from '../../../components/ui/Page'
import { textoDaOrigem, textoDoPrazo } from './textos-da-retencao'

type CategoriaRow = RetencaoResponse['categorias'][number]
type PrazoFixoRow = RetencaoResponse['prazosFixos'][number]

const COLUNAS_DAS_CATEGORIAS: readonly [TableColumn<CategoriaRow>, ...TableColumn<CategoriaRow>[]] = [
  { chave: 'dado', titulo: 'Dado', celula: (linha) => linha.descricao },
  { chave: 'prazo', titulo: 'Prazo que vale', celula: (linha) => textoDoPrazo(linha.meses) },
  { chave: 'contagem', titulo: 'Quando começa a contar', celula: (linha) => linha.contaDe },
  { chave: 'origem', titulo: 'De onde vem', celula: (linha) => textoDaOrigem(linha) },
]

const COLUNAS_DOS_PRAZOS_FIXOS: readonly [TableColumn<PrazoFixoRow>, ...TableColumn<PrazoFixoRow>[]] = [
  { chave: 'dado', titulo: 'Dado', celula: (linha) => linha.descricao },
  { chave: 'prazo', titulo: 'Prazo', celula: (linha) => linha.prazo },
]

/**
 * A tela "Por quanto tempo guardamos", do seletor da Privacidade (F3, 6.0; X2, 13.0; RF20): o prazo que vale hoje para cada dado da escola, de onde ele vem, e
 * os prazos fixos, que a escola não ajusta. Só leitura: o ajuste é da operação, por comando (`ops:retencao`).
 *
 * Não tem estado vazio: toda escola tem todas as categorias, com o padrão quando não há ajuste. Os outros três estados
 * valem: carregando, erro com "Tentar de novo" e o dado.
 */
export function Retencao() {
  const retencao = useQuery(retencaoQueryOptions)
  if (retencao.isPending) return <LoadingState rotulo="Carregando os prazos de guarda…" />
  if (retencao.isError && retencao.data === undefined) {
    return <ErrorState erro={retencao.error} tentando={retencao.isFetching} aoTentarDeNovo={() => void retencao.refetch({ cancelRefetch: false })} />
  }

  const { categorias, prazosFixos } = retencao.data
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-das-categorias">
        <SectionHeader
          id="titulo-das-categorias"
          nivel={3}
          titulo="O que a escola guarda, e por quanto tempo"
          apoio="O prazo que vale hoje para cada dado de pessoa da escola, e de onde ele vem. É por esse prazo que o sistema apaga o dado."
        />
        <Table rotulo="O que a escola guarda, e por quanto tempo" colunas={COLUNAS_DAS_CATEGORIAS} linhas={categorias} chaveDaLinha={(linha) => linha.categoria} />
      </section>
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-dos-prazos-fixos">
        <SectionHeader
          id="titulo-dos-prazos-fixos"
          nivel={3}
          titulo="Prazos que não mudam"
          apoio="Vêm da lei ou de outra fase do sistema, e a escola não os ajusta. Aparecem aqui para a coordenação saber o que existe."
        />
        <Table rotulo="Prazos que não mudam" colunas={COLUNAS_DOS_PRAZOS_FIXOS} linhas={prazosFixos} chaveDaLinha={(linha) => linha.chave} />
      </section>
    </div>
  )
}
