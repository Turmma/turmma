import { nomeDaSerie, type ItemDaGovernanca } from '@educa/shared'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearch } from 'wouter'
import { errorMessage } from '../../../api/client'
import { consumoQueryOptions, resumoDaGovernancaQueryOptions, resumoPorEstadoQueryOptions } from './api/governanca'
import { COORDENACAO_ROUTES } from '../../../paths'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../../../components/ui/button-variants'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { ApprovalLine } from '../../../components/ui/ai/ApprovalLine'
import { StatCard } from '../../../components/ui/StatCard'
import { SegmentedControl } from '../../../components/ui/fields/SegmentedControl'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { SectionHeader } from '../../../components/ui/Page'
import { formatDateTime } from '../../../format'
import { enderecoComParametro } from '../comum/endereco-da-tela'
import {
  aprovacaoDoItem,
  ESPERANDO_O_PROFESSOR,
  estadoDoEndereco,
  type FiltroDeEstado,
  NOME_DO_TIPO_DE_ENTREGA,
  nomeDaFuncao,
  O_QUE_CHEGA_AO_ALUNO,
  OPCOES_DO_ESTADO,
  textoDoConsumo,
  textoDoCusto,
  textoDoPacoteDoTutor,
  VAZIO_DO_FILTRO,
} from './textos-da-governanca'

/**
 * As colunas de "O que a IA gerou e quem aprovou". **Não existe coluna de professor nem de turma**, e a tabela não tem
 * filtro nem ordenação por professor ou por turma: a API não os aceita (D45, D64). O único filtro é o estado da entrega. A última
 * coluna diz que uma pessoa decidiu e quando; quem foi está na auditoria.
 */
const COLUNAS: readonly [TableColumn<ItemDaGovernanca>, ...TableColumn<ItemDaGovernanca>[]] = [
  { chave: 'oQue', titulo: 'O que foi gerado', celula: (item) => NOME_DO_TIPO_DE_ENTREGA[item.tipo] },
  { chave: 'funcao', titulo: 'Agente e função', celula: (item) => nomeDaFuncao(item.funcao) },
  { chave: 'serie', titulo: 'Série', celula: (item) => <span className="inline-block min-w-28">{nomeDaSerie(item.serie)}</span> },
  { chave: 'quando', titulo: 'Gerado em', celula: (item) => formatDateTime(item.criadaEm) },
  { chave: 'decisao', titulo: 'Decisão', celula: (item) => <ApprovalLine aprovacao={aprovacaoDoItem(item)} espera={ESPERANDO_O_PROFESSOR} /> },
]

/**
 * Registros › IA, a Governança de IA (MVP, A5; X2, 10.0; `docs/interface.md` 3 e 11.7; D9, D45, D61, D64; regra 70, itens 6, 8 e 9):
 * é onde a coordenação abre em Registros. Quatro números, a tabela do que a IA gerou e se uma pessoa aprovou, com o filtro por
 * estado, e o consumo do mês por função ao lado dela (embaixo, no celular).
 *
 * - **Os quatro números são sempre os da escola inteira**, lidos da consulta sem filtro. A API devolve números em toda página,
 *   mas a tela não confia na resposta de um filtro para eles: escolher "Aprovados" muda as linhas, nunca os números.
 * - **O filtro é o endereço** (`?estado=aprovada`), com `replace`, e entra na chave da consulta. Valor desconhecido é ignorado. A
 *   resposta de um filtro, mesmo atrasada, nunca cai na lista de outro.
 * - **Sem professor e sem turma**: nem coluna, nem filtro, nem ordem, e nada disso vai à API (D45, D64).
 *
 * Tudo é agregado. O dado nominal de uma turma não abre aqui: mora no fim da página do Analista (telas da coordenação, 4.0).
 */
export default function Governanca() {
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const estado = estadoDoEndereco(busca)
  // A consulta sem filtro está sempre montada: os números e, sem filtro, as linhas. A do estado só existe com um estado no endereço.
  const todos = useInfiniteQuery(resumoDaGovernancaQueryOptions)
  const doEstado = useInfiniteQuery({ ...resumoPorEstadoQueryOptions(estado ?? 'pendente'), enabled: estado !== undefined })

  if (todos.isPending) {
    return <LoadingState rotulo="Carregando a governança…" />
  }
  if (todos.isError && todos.data === undefined) {
    return <ErrorState erro={todos.error} tentando={todos.isFetching} aoTentarDeNovo={() => void todos.refetch({ cancelRefetch: false })} />
  }

  const lista = estado === undefined ? todos : doEstado
  // Os números vêm em toda página: valem os da mais recente lida, da consulta sem filtro.
  const numeros = todos.data.pages.at(-1)?.numeros ?? { geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }
  const nadaGerado = numeros.geradoPorIa === 0 && numeros.aprovadoPorPessoa + numeros.rejeitado + numeros.esperando === 0
  const itens = lista.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const filtrar = (novo: FiltroDeEstado): void => navegar(enderecoComParametro(caminho, busca, 'estado', novo === 'todos' ? undefined : novo), { replace: true })

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col items-start gap-3">
        <p className="max-w-prose text-apoio">O que a IA produziu nesta escola no ano letivo, e o que as pessoas decidiram sobre isso. {O_QUE_CHEGA_AO_ALUNO}</p>
        {/* A porta para "Como cada IA trabalha" (X2, 3.0): sem ela a página dos agentes ficaria sem caminho depois que o item saiu da lateral. */}
        <Link to={COORDENACAO_ROUTES.agentes} className={SECONDARY_LINK_CLASSES}>
          Como cada IA trabalha
        </Link>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard rotulo="Gerado por IA" valor={numeros.geradoPorIa} apoio="Atividades, planos, versões adaptadas e correções" />
        <StatCard rotulo="Aprovado por gente" valor={numeros.aprovadoPorPessoa} apoio="Versões adaptadas e correções que um professor aprovou" />
        <StatCard rotulo="Esperando o professor" valor={numeros.esperando} apoio="Só valem depois da decisão dele" />
        <StatCard rotulo="Rejeitado" valor={numeros.rejeitado} apoio="O professor recusou, com justificativa" />
      </div>

      {/* Do computador largo para cima, o consumo fica ao lado da tabela; abaixo disso, embaixo dela. */}
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-registro">
          <SectionHeader id="titulo-registro" titulo="O que a IA gerou e quem aprovou" apoio="Da mais nova para a mais antiga. Cada linha diz o que foi gerado, por qual função, e se uma pessoa já decidiu." />
          <div className="max-w-3xl">
            <SegmentedControl rotulo="Estado" rotuloVisivel opcoes={OPCOES_DO_ESTADO} valor={estado ?? 'todos'} aoMudar={filtrar} emDuasColunasNoCelular />
          </div>
          {lista.isPending && <LoadingState rotulo="Carregando a lista…" />}
          {lista.isError && lista.data === undefined && <ErrorState erro={lista.error} tentando={lista.isFetching} aoTentarDeNovo={() => void lista.refetch({ cancelRefetch: false })} />}
          {lista.data !== undefined && (
            <>
              {/* A página seguinte que falhou: aviso com botão secundário, para a tela não ganhar um segundo primário ao lado do erro do consumo. */}
              {lista.isError && (
                <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-controle border border-erro bg-erro-cx p-3">
                  <p role="alert" className="min-w-0 flex-1 basis-56 break-words text-erro">
                    {errorMessage(lista.error)}
                  </p>
                  <Button variante="secundario" onClick={() => void lista.fetchNextPage()} disabled={lista.isFetchingNextPage}>
                    Tentar de novo
                  </Button>
                </div>
              )}
              {itens.length === 0 ? (
                estado === undefined ? (
                  <EmptyState
                    titulo={nadaGerado ? 'A IA ainda não gerou nada nesta escola' : 'Nenhuma linha para mostrar ainda'}
                    descricao={
                      nadaGerado
                        ? 'Quando um professor pedir uma versão adaptada ou encerrar uma atividade objetiva, a entrega aparece aqui, primeiro esperando o professor e depois com a decisão dele e a data.'
                        : 'Aqui entram as versões adaptadas e as correções de objetiva, das séries com dois ou mais professores. O que já foi gerado está contado nos números acima.'
                    }
                  />
                ) : (
                  <EmptyState titulo={VAZIO_DO_FILTRO[estado].titulo} descricao={VAZIO_DO_FILTRO[estado].descricao} />
                )
              ) : (
                <>
                  <Table rotulo="O que a IA gerou e quem aprovou" colunas={COLUNAS} linhas={itens} chaveDaLinha={(item) => item.id} />
                  {lista.hasNextPage && (
                    <div>
                      <Button variante="secundario" onClick={() => void lista.fetchNextPage()} disabled={lista.isFetchingNextPage}>
                        {lista.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <p className="max-w-prose text-sm text-sutil">
            A lista não mostra turma nem quem decidiu: quem aprovou cada entrega, e quando, fica na auditoria da escola. Entrega de série com um professor só conta nos números e não entra na lista, porque a linha diria o que ele fez.
          </p>
        </section>

        <Consumo />
      </div>
    </div>
  )
}

/** O consumo do mês por função, em barras neutras: o valor está no texto. Por função, nunca por pessoa (D64). */
function Consumo() {
  const consumo = useQuery(consumoQueryOptions)
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-consumo">
      <SectionHeader id="titulo-consumo" titulo="Consumo do mês por função" apoio="Quanto cada função da IA trabalhou neste mês. É somado por função: não existe consumo por professor nem por aluno." />
      {consumo.isPending && <LoadingState rotulo="Carregando o consumo…" />}
      {consumo.isError && <ErrorState erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch({ cancelRefetch: false })} />}
      {consumo.data !== undefined &&
        (consumo.data.porFuncao.length === 0 ? (
          <EmptyState titulo="Nenhuma função trabalhou neste mês" descricao="Quando um professor conversar com o Assistente, gerar uma atividade ou um aluno usar o Tutor, o consumo de cada função aparece aqui." />
        ) : (
          <div className="flex min-w-0 flex-col gap-4 rounded-cartao border border-linha bg-superficie p-4 lg:p-5">
            {consumo.data.porFuncao.map((linha) => (
              <ProgressBar
                key={linha.funcao}
                rotulo={nomeDaFuncao(linha.funcao)}
                valor={linha.tokensDeEntrada + linha.tokensDeSaida}
                maximo={Math.max(1, consumo.data.total.tokensDeEntrada + consumo.data.total.tokensDeSaida)}
                texto={textoDoConsumo(linha)}
              />
            ))}
            <ProgressBar
              rotulo="Trocas dos alunos com o Tutor"
              valor={consumo.data.tutor.trocasNoMes}
              maximo={Math.max(1, consumo.data.tutor.pacoteDoMes)}
              texto={textoDoPacoteDoTutor(consumo.data.tutor)}
              detalhe={`Pacote do mês: ${String(consumo.data.tutor.trocasPorMesPorAluno)} trocas por aluno, com freio de ${String(consumo.data.tutor.trocasPorDiaPorAluno)} por dia`}
            />
            <p className="text-sm text-sutil">{textoDoCusto(consumo.data.total)}</p>
          </div>
        ))}
    </section>
  )
}
