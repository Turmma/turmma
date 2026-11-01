import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useSearch } from 'wouter'
import { alunosDaTurmaQueryOptions } from '../../../api/alunos-da-turma'
import { desempenhoDaTurmaQueryOptions } from '../atividades/api/atividades'
import { Button } from '../../../components/ui/Button'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { ListaDePedidos } from '../../../components/pedidos/ListaDePedidos'
import { Table } from '../../../components/ui/Table'
import { SectionHeader } from '../../../components/ui/Page'
import { formatQuantity } from '../../../format'
import { convitePedido, enderecoSemOConvite, turmaIndisponivel } from './acesso/acesso-da-turma'
import { AcessoDaTurma } from './acesso/AcessoDaTurma'
import { montarLinhas, textoDosAcertos, textoPorHabilidade, type LeituraDosAcertos } from './alunos-da-turma'

type EscolaDaSessao = Parameters<typeof AcessoDaTurma>[0]['escola']

interface PropsDosAlunos {
  readonly turmaId: string
  readonly turmaNome: string
  readonly escola: EscolaDaSessao
  /** A leitura dos pedidos ou a da lista de nomes deixou de achar a turma: a página inteira sai, e quem a tira é a `Turma` (regra 10, item 6). */
  readonly aoPerderATurma: () => void
}

/**
 * A aba Alunos da turma aberta (`docs/interface.md` 11.1; telas do professor, 12.0 e 13.0; RF18, RF19, RF21; D34, D46, D69): o
 * acesso da sala (um resumo e o botão "Convidar alunos", que abre o diálogo), os pedidos de nome que a professora aprova ou
 * recusa e, abaixo, **os alunos da turma em ordem de nome, com os acertos de cada um nas correções aprovadas**.
 *
 * - **O endereço pode pedir o diálogo** (`?aba=alunos&convidar=1`, para onde "Gerar o acesso" leva depois de confirmar a turma): ele
 *   abre uma vez, e fechar tira o pedido do endereço (`replace`), sem passo no histórico. Sem o pedido, o botão abre o diálogo e o
 *   endereço não muda. O endereço nunca leva token, link nem código (regra 20, item 8).
 *
 * - **A lista de nomes** é `GET /v1/turmas/:id/alunos`, lida de cem em cem. A API a entrega em ordem de id, e a tela reordena por
 *   nome **tudo o que já foi lido**, também depois de "Ver mais". Dois alunos com o mesmo nome são duas linhas.
 * - **Os acertos** são os do desempenho, só de lote aprovado. O aluno sem correção aprovada diz isso ("Sem correção aprovada"), e
 *   não "0 de 0". Quem saiu da turma entre as duas leituras (transferido, ou com o acesso desativado) aparece como "Saiu da turma",
 *   sem número, e só quando a lista foi lida até o fim: antes disso ele pode estar numa página que não chegou.
 * - **Não é ranking, e a tela não ordena por acerto**: não há controle de ordem, nem situação, nem média, nem busca por nome, nem
 *   selo de adaptação por aluno, nem a conversa dele (F6, D35, D64, D70).
 * - A falha dos acertos não tira os nomes da tela: a lista é o que a professora veio ver, e o erro dos acertos vem sozinho, com o
 *   seu "Tentar de novo".
 */
export default function AlunosDaTurma({ turmaId, turmaNome, escola, aoPerderATurma }: PropsDosAlunos) {
  const tituloDoAcesso = useRef<HTMLHeadingElement>(null)
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const alunos = useInfiniteQuery(alunosDaTurmaQueryOptions(turmaId))
  const desempenho = useQuery(desempenhoDaTurmaQueryOptions(turmaId))
  const idDosAlunos = useId()
  const botaoDeVerMais = useRef<HTMLButtonElement>(null)
  const fimDaLista = useRef<HTMLParagraphElement>(null)
  // "Ver mais" já está no ar: o segundo clique no mesmo instante, antes de o botão desligar, não pede a mesma página outra vez.
  const lendoMais = useRef(false)
  // O que acorda o efeito do foco: só existe depois da leitura da página seguinte.
  const [pedidoDeFoco, definirPedidoDeFoco] = useState(0)

  const lidos = alunos.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const listaLida = alunos.data !== undefined
  const listaCompleta = listaLida && !alunos.hasNextPage
  const linhas = montarLinhas(lidos, desempenho.data, listaCompleta)
  const leituraDosAcertos: LeituraDosAcertos = desempenho.data !== undefined ? 'lida' : desempenho.isError ? 'falhou' : 'lendo'

  // A lista de nomes deixou de achar a turma: vale como a leitura dos pedidos que deixa de achá-la.
  const semATurma = turmaIndisponivel(alunos.error)
  useEffect(() => {
    if (semATurma) aoPerderATurma()
  }, [semATurma, aoPerderATurma])

  // "Ver mais" troca o botão por ele mesmo, ou pelo fim da lista: o foco não pode ficar no que saiu da tela (regra 50, item 11).
  // Na montagem ainda não há botão nem frase: não há o que focar.
  useEffect(() => {
    if (document.activeElement !== null && document.activeElement !== document.body) return
    ;(botaoDeVerMais.current ?? fimDaLista.current)?.focus()
  }, [pedidoDeFoco])

  async function verMais(): Promise<void> {
    if (lendoMais.current) return
    lendoMais.current = true
    try {
      await alunos.fetchNextPage()
    } finally {
      lendoMais.current = false
      definirPedidoDeFoco((n) => n + 1)
    }
  }

  // Os acertos só vão a um vazio quando chegaram: o aluno que o desempenho traz e a lista não pode ainda estar a caminho.
  const vazio = listaCompleta && linhas.length === 0 && !desempenho.isPending
  const quemSaiu = linhas.filter((linha) => linha.situacao === 'fora_da_turma').length

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AcessoDaTurma
        turmaId={turmaId}
        escola={escola}
        titulo={tituloDoAcesso}
        convidarPeloEndereco={convitePedido(busca)}
        aoFecharOConvite={() => {
          if (convitePedido(busca)) navegar(enderecoSemOConvite(caminho, busca), { replace: true })
        }}
      />
      <ListaDePedidos
        turma={{ id: turmaId, nome: turmaNome }}
        quem="professor"
        vazio={{
          titulo: 'Nenhum pedido esperando',
          descricao: 'Os pedidos aparecem aqui quando os alunos entram pelo link da sala ou pelo código da turma e pedem o nome. Confira se o acesso dos alunos está ativo.',
        }}
        aoPerderATurma={aoPerderATurma}
      />

      {alunos.isPending && <LoadingState rotulo="Carregando os alunos da turma…" />}
      {alunos.isError && !listaLida && <ErrorState erro={alunos.error} tentando={alunos.isFetching} aoTentarDeNovo={() => void alunos.refetch({ cancelRefetch: false })} />}
      {vazio && (
        <EmptyState
          titulo="A lista ainda não chegou"
          descricao="Os alunos aparecem aqui quando entram na turma e você aprova o nome deles. Se a coordenação ainda não montou a lista da turma, peça a ela."
        />
      )}

      {listaLida && linhas.length > 0 && (
        <section aria-labelledby={idDosAlunos} className="flex min-w-0 flex-col gap-3">
          <SectionHeader
            id={idDosAlunos}
            titulo="Por aluno"
            apoio={`${formatQuantity(linhas.length, 'aluno', 'alunos')}${listaCompleta ? '' : ' até aqui'}, em ordem de nome. Os acertos são os das correções aprovadas.`}
          />
          {desempenho.isError && desempenho.data === undefined && (
            <ErrorState erro={desempenho.error} tentando={desempenho.isFetching} aoTentarDeNovo={() => void desempenho.refetch({ cancelRefetch: false })} />
          )}
          <Table
            rotulo="Acertos por aluno"
            colunas={[
              { chave: 'nome', titulo: 'Aluno', celula: (linha) => linha.nome },
              // O aluno que ainda não tem correção aprovada vem sem número: a tela diz isso, em vez de "0 de 0".
              { chave: 'acertos', titulo: 'Acertos', celula: (linha) => textoDosAcertos(linha, leituraDosAcertos) },
              { chave: 'habilidades', titulo: 'Por habilidade', celula: (linha) => textoPorHabilidade(linha) },
            ]}
            linhas={linhas}
            chaveDaLinha={(linha) => linha.usuarioId}
          />
          {quemSaiu > 0 && <p className="t-apoio text-sutil">Quem saiu da turma (transferido, ou com o acesso desativado) aparece sem acertos.</p>}
          {alunos.hasNextPage ? (
            <Button ref={botaoDeVerMais} variante="secundario" onClick={() => void verMais()} disabled={alunos.isFetchingNextPage} className="self-start">
              {alunos.isFetchingNextPage ? 'Carregando…' : 'Ver mais'}
            </Button>
          ) : (
            <p ref={fimDaLista} tabIndex={-1} className="t-apoio text-sutil">
              Todos os alunos da turma estão na lista.
            </p>
          )}
          {alunos.isFetchNextPageError && <ErrorState erro={alunos.error} tentando={alunos.isFetchingNextPage} aoTentarDeNovo={() => void verMais()} />}
        </section>
      )}
    </div>
  )
}
