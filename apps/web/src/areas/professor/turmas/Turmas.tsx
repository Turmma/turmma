import { NOME_DA_CONTESTACAO, NOME_DO_ESTADO_DE_VINCULO, type ContestacaoDeVinculo, type Vinculo } from '@educa/shared'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { errorMessage } from '../../../api/client'
import { confirmarVinculo, meusVinculosQueryOptions, contestarVinculo } from '../comum/api/vinculos'
import { caminhoDaTurmaDoProfessor } from '../../../paths'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../../../components/ui/button-variants'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Page } from '../../../components/ui/Page'
import { usePageTitle } from '../../../document-title'
import { enderecoDoConvite } from './acesso/acesso-da-turma'
import { esperaNaTurma, useFilaDoProfessor, type EsperaNaTurma } from '../inicio/fila-do-professor'
import PainelDaContestacao, { type ContestacaoEmAndamento } from './PainelDaContestacao'
import { LadrilhoDoVinculo, nomeDoVinculo } from './vinculo-na-tela'

/**
 * O selo do que espera a professora numa turma: o número, ou "Em dia" só quando a turma foi lida inteira. Turma que o sino não leu
 * (a leitura falhou, foi recusada por limite, veio truncada ou passou das 12) diz "Não lida", nunca "Em dia" (Tech Spec, seção 5);
 * o número de uma turma lida pela metade é um piso ("3 ou mais").
 */
function SeloDoQueEspera({ espera }: { readonly espera: EsperaNaTurma }) {
  if (espera.n > 0) return <StatusBadge familia="pendente">{`${String(espera.n)}${espera.ouMais ? ' ou mais' : ''} esperando você`}</StatusBadge>
  if (espera.leitura === 'lendo') return <StatusBadge familia="info">Lendo o que espera…</StatusBadge>
  if (espera.leitura === 'nao-lida') return <StatusBadge familia="info">Não lida</StatusBadge>
  return <StatusBadge familia="ok">Em dia</StatusBadge>
}

/**
 * "Turmas" do professor (D73; `docs/interface.md` 1): as turmas e disciplinas que a coordenação alocou na escola ativa,
 * no ano em curso (RF4, RF20 do F1; telas do professor, RF14). Um cartão por turma e disciplina: o professor que dá duas
 * disciplinas na mesma turma tem dois, e confirma ou contesta cada um separadamente.
 *
 * Os quatro estados (W4): carregando; erro com "Tentar de novo"; vazio, que diz que é a coordenação quem aloca; e com
 * dado, em dois grupos — **"Confirme suas turmas"**, uma faixa para cada vínculo que espera a decisão dela (só o pendente: o
 * contestado espera a coordenação e não é mais dela), com "Confirmar" e "Contestar", e **"Suas turmas"**, os cartões dos já
 * decididos. Sem confirmar, a turma não abre (E12, P2), e é por isso que as faixas vêm primeiro. Só o cartão do vínculo
 * confirmado leva à turma aberta (15.0): o contestado e o encerrado não a alcançam, e a tela não oferece o que a API recusaria.
 *
 * É aba de navegação: o `<h1>`, visível, é o título da tela, na `Page` (RF12; `docs/interface.md` 11.2).
 *
 * - **O estado aparece em texto**, e não só em cor (regra 50, item 11). **A série não entra no cartão**: o `Vinculo` não a traz
 *   (divergência da 9.0, Tech Spec, seção 9).
 * - **O que espera vem da fila do sino** (`useFilaDoProfessor`): as mesmas consultas, pelas mesmas chaves, e nenhuma leitura a mais.
 * - **Contestar abre num painel ao lado** (folha de baixo a 360 px) e mostra o que vai acontecer antes de enviar (regra 50, item
 *   8): a coordenação vê, e o vínculo não dá acesso à turma até ser corrigido. O complemento é texto livre que a coordenação lê, e
 *   por isso a tela avisa para não escrever nome de aluno ali (regra 20); ele nunca vai a log nem a endereço.
 * - **O que está sendo escrito mora aqui, na página**, e não no painel: a lista some e volta a cada recarga — e a sessão pode até
 *   vencer no meio —, e nada disso pode apagar o que a professora digitou (regra 80, item 6). Sai junto quando entra outra pessoa,
 *   porque a página sai.
 */
export default function Turmas() {
  usePageTitle('Turmas')
  const cliente = useQueryClient()
  const vinculos = useInfiniteQuery(meusVinculosQueryOptions)
  const fila = useFilaDoProfessor()
  const [contestacao, definirContestacao] = useState<ContestacaoEmAndamento | undefined>(undefined)
  const tituloDasTurmas = useRef<HTMLHeadingElement>(null)
  const tituloDaTela = useRef<HTMLHeadingElement>(null)
  const [pedidoDeFoco, definirPedidoDeFoco] = useState(0)
  // A turma que acabou de ser confirmada, para oferecer o acesso dos alunos. Mora na página: sai quando a professora sai de Turmas.
  const [confirmada, definirConfirmada] = useState<Vinculo['turma'] | undefined>(undefined)

  // A faixa decidida sai da lista, e com ela o botão que tinha o foco. O foco vai para o título de "Suas turmas", onde o cartão
  // entrou, assim que a lista relida está na tela (regra 50, item 11).
  useEffect(() => {
    if (pedidoDeFoco > 0) (tituloDasTurmas.current ?? tituloDaTela.current)?.focus()
  }, [pedidoDeFoco])

  const recarregar = () => cliente.invalidateQueries({ queryKey: meusVinculosQueryOptions.queryKey })

  const confirmar = useMutation({
    mutationFn: (vinculo: Vinculo) => confirmarVinculo(vinculo.id),
    onSuccess: async (_confirmado, vinculo) => {
      await recarregar()
      definirConfirmada(vinculo.turma)
      definirPedidoDeFoco((n) => n + 1)
    },
  })
  const contestar = useMutation({
    mutationFn: (pedido: ContestacaoEmAndamento & { codigo: ContestacaoDeVinculo }) => {
      const complemento = pedido.complemento.trim()
      return contestarVinculo(pedido.vinculoId, {
        contestacao: pedido.codigo,
        ...(complemento === '' ? {} : { complemento }),
      })
    },
    // O painel só fecha com a lista já relida: a faixa sai e o cartão entra de uma vez, e o foco tem para onde ir.
    onSuccess: async () => {
      await recarregar()
      definirContestacao(undefined)
    },
  })

  const itens = vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const paraConfirmar = itens.filter((vinculo) => vinculo.estado === 'pendente')
  const decididas = itens.filter((vinculo) => vinculo.estado !== 'pendente')
  // Uma decisão por vez: dois cliques seguidos no mesmo botão, ou em dois vínculos, são ação oficial repetida. O `disabled` dos botões
  // enquanto uma decisão corre é o que impede o clique repetido: a decisão é oficial e sai uma vez só.
  const decidindo = confirmar.isPending || contestar.isPending
  const doPainel = contestacao === undefined ? undefined : paraConfirmar.find((vinculo) => vinculo.id === contestacao.vinculoId)

  function aoContestar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    if (decidindo || contestacao === undefined || contestacao.codigo === '') return
    contestar.mutate({ ...contestacao, codigo: contestacao.codigo })
  }

  function abrirContestacao(id: string): void {
    // Uma contestação por vez. Se o painel está aberto, o resto da página está inerte e este clique não chega; o `contestar.reset`
    // tira o erro da tentativa anterior, que era de outro vínculo.
    contestar.reset()
    definirContestacao({ vinculoId: id, codigo: '', complemento: '' })
  }

  function faixa(vinculo: Vinculo) {
    return (
      <li key={vinculo.id} data-faixa-de-vinculo="" className="flex min-w-0 flex-col gap-3 rounded-controle border-2 border-amarelo-borda bg-amarelo-claro p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <LadrilhoDoVinculo vinculo={vinculo} tamanho={40} />
          <p className="min-w-0 font-medium break-words text-tinta">Confirme sua turma · {nomeDoVinculo(vinculo)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variante="oficial" onClick={() => confirmar.mutate(vinculo)} disabled={decidindo}>
            {confirmar.isPending && confirmar.variables.id === vinculo.id ? 'Confirmando…' : 'Confirmar'}
          </Button>
          <Button variante="secundario" onClick={() => abrirContestacao(vinculo.id)} disabled={decidindo}>
            Contestar
          </Button>
        </div>
        {confirmar.isError && confirmar.variables.id === vinculo.id && (
          <p role="alert" className="w-full rounded-controle border border-erro bg-erro-cx p-3 text-erro">
            {errorMessage(confirmar.error)}
          </p>
        )}
      </li>
    )
  }

  function cartao(vinculo: Vinculo) {
    return (
      <li key={vinculo.id} className="flex min-w-0 flex-col gap-3 rounded-cartao border-2 border-borda bg-superficie p-4">
        <div className="flex min-w-0 items-center gap-3">
          <LadrilhoDoVinculo vinculo={vinculo} tamanho={44} />
          <p className="t-cartao min-w-0 break-words text-tinta">{nomeDoVinculo(vinculo)}</p>
        </div>
        {/* O estado em texto: a cor sozinha não chega a quem não a distingue nem ao leitor de tela. */}
        <p className="text-apoio">
          {NOME_DO_ESTADO_DE_VINCULO[vinculo.estado]}
          {vinculo.contestacao !== undefined && ` · ${NOME_DA_CONTESTACAO[vinculo.contestacao]}`}
        </p>
        {vinculo.estado === 'confirmado' && (
          <div>
            <SeloDoQueEspera espera={esperaNaTurma(fila, vinculo.turma.id)} />
          </div>
        )}
        {vinculo.estado === 'confirmado' && (
          // Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela.
          <Link to={caminhoDaTurmaDoProfessor(vinculo.turma.id)} className={`self-start ${SECONDARY_LINK_CLASSES}`}>
            Abrir a turma<span className="sr-only"> {vinculo.turma.nome}</span>
          </Link>
        )}
      </li>
    )
  }

  return (
    <Page titulo="Turmas" idDoTitulo="titulo-turmas" refDoTitulo={tituloDaTela}>
      <section className="flex min-w-0 flex-col gap-6" aria-labelledby="titulo-turmas">
        {/* A região existe antes do texto, para o leitor de tela anunciar a turma confirmada quando o aviso aparece. */}
        <div role="status" className="empty:hidden">
          {confirmada !== undefined && (
            <Alert
              tom="certo"
              titulo={`Turma ${confirmada.nome} confirmada`}
              acao={
                // Relativo à área, como o link do cartão. O endereço leva só a aba e o pedido do diálogo.
                <Link to={enderecoDoConvite(caminhoDaTurmaDoProfessor(confirmada.id))} className={SECONDARY_LINK_CLASSES}>
                  Gerar o acesso
                </Link>
              }
            >
              Agora os alunos podem entrar nela: gere o link e o código para eles pedirem o nome.
            </Alert>
          )}
        </div>
        {vinculos.isPending && <LoadingState rotulo="Carregando as suas turmas…" />}
        {vinculos.isError && <ErrorState erro={vinculos.error} tentando={vinculos.isFetching} aoTentarDeNovo={() => void vinculos.refetch({ cancelRefetch: false })} />}
        {!vinculos.isPending && !vinculos.isError && itens.length === 0 && (
          <EmptyState titulo="A coordenação ainda não alocou você" descricao="Quem aloca o professor nas turmas é a coordenação. Quando ela alocar você, a turma aparece aqui para você confirmar; se você já deveria ter turmas neste ano, fale com ela." />
        )}

        {paraConfirmar.length > 0 && (
          <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-para-confirmar">
            <h2 id="titulo-para-confirmar" className="t-secao text-tinta">
              Confirme suas turmas
            </h2>
            <p className="text-apoio">A coordenação alocou você nestas turmas. Até você confirmar, a turma não abre para você; se algo estiver errado, conteste.</p>
            <ul className="flex flex-col gap-3">{paraConfirmar.map(faixa)}</ul>
          </section>
        )}

        {decididas.length > 0 && (
          <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-decididas">
            <h2 id="titulo-decididas" ref={tituloDasTurmas} tabIndex={-1} className="t-secao text-tinta">
              Suas turmas
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{decididas.map(cartao)}</ul>
          </section>
        )}

        {vinculos.hasNextPage && (
          <Button onClick={() => void vinculos.fetchNextPage()} disabled={vinculos.isFetchingNextPage} className="self-start">
            {vinculos.isFetchingNextPage ? 'Carregando…' : 'Ver mais turmas'}
          </Button>
        )}
      </section>

      {contestacao !== undefined && doPainel !== undefined && (
        <PainelDaContestacao
          key={doPainel.id}
          vinculo={doPainel}
          contestacao={contestacao}
          enviando={contestar.isPending}
          falha={contestar.isError ? contestar.error : undefined}
          aoMudar={definirContestacao}
          aoEnviar={aoContestar}
          aoFechar={() => definirContestacao(undefined)}
          focoDeReserva={() => (tituloDasTurmas.current ?? tituloDaTela.current)?.focus()}
        />
      )}
    </Page>
  )
}
