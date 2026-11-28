import { ErrorCode, type ProvaAntesDeComecarResponse, type ProvaEmAndamentoResponse, type ProvaOnlineResponse } from '@educa/shared'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, Redirect, useLocation } from 'wouter'
import { comecarProva, provaEmFocoQueryOptions, provaLidaQueryOptions, provaSemOTempo, tempoDaProvaQueryOptions, tempoLido } from '../../api/atividades-do-aluno'
import { MINHAS_ATIVIDADES_QUERY_KEY } from '../../api/chaves-do-aluno'
import { ApiError, errorMessage } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Page } from '../../components/ui/Page'
import { EmptyState, LoadingState } from '../../components/states'
import { usePageTitle } from '../../document-title'
import { ALUNO_ROUTES, caminhoDaProvaDoAluno } from '../../paths'
import { textoDoErroDaProva } from './atividade'
import { diaEHoraNaEscola, horaNaEscola, situacaoDaJanela } from './atividades'
import Atividade from './Atividade'
import { useAgora } from './use-agora'

/**
 * "Antes de começar" e a porta de entrada da atividade (avaliacao-e-correcao, 12.0; RF7). **Ler a prova não grava nada** (Tech Spec §4): a porta lê `GET …/prova` e decide a tela pelo que veio.
 *
 * - **A prova que ainda não começou, com janela** (`comecou: false`): "Antes de começar", com a duração, o aviso de que sair da aba aparece para o professor (D70) e como sair. Só o "Começar" cria a
 *   tentativa; nenhuma questão aparece antes dele.
 * - **A prova em andamento**: a tela de foco. Voltar à atividade depois do "Sair da prova" leva de volta a ela, com o mesmo relógio.
 * - **Tudo o mais** (a atividade sem prova online, e a prova que já foi enviada ou encerrada) é a tela de hoje, `Atividade`.
 */

const VOLTAR = (
  <Link to={ALUNO_ROUTES.atividades} className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
    <ArrowLeft aria-hidden="true" size={18} />
    Voltar para Tarefas
  </Link>
)

/** O que a tela diz da janela, **pelo relógio deste computador** (o servidor tem a palavra final: `PROVA_FORA_DA_JANELA` diz o mesmo): "Esta prova abre em 24/11 às 10:00" ou "Esta prova fechou às 11:40". */
function textoDaJanela(janela: ProvaAntesDeComecarResponse['janela'], agora: number): string | undefined {
  if (janela === null) return undefined
  const situacao = situacaoDaJanela(janela, agora)
  if (situacao === 'antes') return `Esta prova abre em ${diaEHoraNaEscola(janela.abreEm)}`
  return situacao === 'depois' ? `Esta prova fechou às ${horaNaEscola(janela.fechaEm)}` : undefined
}

/** O que a recusa do servidor ao "Começar" diz: a janela e o encerramento têm texto próprio (e escondem o botão); o resto é "tente de novo". */
function textoDaRecusa(erro: unknown): { readonly aviso?: string; readonly falha?: string } {
  if (erro === null) return {}
  const codigo = erro instanceof ApiError ? erro.codigo : undefined
  if (codigo === ErrorCode.PROVA_FORA_DA_JANELA) return { aviso: 'Esta prova não está aberta agora.' }
  if (codigo === ErrorCode.ATIVIDADE_ENCERRADA) return { aviso: 'Quem dá a aula encerrou esta prova.' }
  return { falha: textoDoErroDaProva(erro) }
}

/** "Começar": cria a tentativa e abre a tela de foco com o que o `comecar` trouxe, sem ler de novo, e com o relógio do servidor desde o primeiro quadro. */
function useComecar(id: string) {
  const cliente = useQueryClient()
  const [, navegar] = useLocation()
  return useMutation({
    mutationFn: () => comecarProva(id),
    onSuccess: (resposta) => {
      if (!resposta.comecou) return
      cliente.setQueryData(provaEmFocoQueryOptions(id).queryKey, provaSemOTempo(resposta))
      cliente.setQueryData(tempoDaProvaQueryOptions(id).queryKey, tempoLido(resposta.tempo))
      void cliente.invalidateQueries({ queryKey: MINHAS_ATIVIDADES_QUERY_KEY })
      // `replace`: o "Voltar" do navegador não leva a "Antes de começar" de uma prova que já começou.
      navegar(caminhoDaProvaDoAluno(id), { replace: true })
    },
  })
}

export function AntesDeComecar({ antes }: { antes: ProvaAntesDeComecarResponse }) {
  const id = antes.atividadeAplicadaId
  usePageTitle(antes.titulo)
  const agora = useAgora()
  const comecar = useComecar(id)
  // A janela que o servidor recusou vale mais que a conta do computador: o texto dela é o mesmo, e o botão some.
  const recusa = textoDaRecusa(comecar.error)
  const janela = textoDaJanela(antes.janela, agora) ?? recusa.aviso
  const aberta = janela === undefined

  return (
    <Page titulo={antes.titulo} objeto antes={VOLTAR} largura="leitura">
      <Card titulo="Antes de começar" className="flex flex-col gap-3">
        {antes.duracaoMin !== null && <p className="text-base text-tinta">{`Esta prova tem ${String(antes.duracaoMin)} minutos, contados a partir de Começar.`}</p>}
        {antes.janela !== null && aberta && <p className="text-base text-tinta">{`Ela fecha às ${horaNaEscola(antes.janela.fechaEm)}.`}</p>}
        <p className="text-base text-tinta">Se você sair desta aba, isso aparece para o professor. Nada acontece com a sua prova.</p>
        <p className="text-base text-tinta">Para sair, use Sair da prova. O tempo continua.</p>
        {janela !== undefined && (
          <p role="status" className="rounded-controle bg-fundo-suave p-3 font-medium break-words text-tinta">
            {janela}
          </p>
        )}
        {aberta && (
          <Button variante="oficial" onClick={() => comecar.mutate()} disabled={comecar.isPending} className="self-start">
            {comecar.isPending ? 'Abrindo…' : 'Começar'}
          </Button>
        )}
        {recusa.falha !== undefined && (
          <p role="alert" className="rounded-controle bg-erro-cx p-3 break-words text-erro">
            {recusa.falha}
          </p>
        )}
      </Card>
    </Page>
  )
}

/** A porta ainda sem a prova lida: carregando, não disponível, ou erro com "Tentar de novo". O texto do erro é o de sempre da atividade (a porta também serve a atividade sem prova online). */
function PortaSemDados({ lida }: { lida: UseQueryResult<ProvaOnlineResponse, unknown> }) {
  const naoEncontrada = lida.error instanceof ApiError && lida.error.codigo === ErrorCode.NAO_ENCONTRADO
  return (
    <Page titulo="Atividade" antes={VOLTAR} largura="leitura">
      {lida.isPending && <LoadingState rotulo="Carregando a atividade…" />}
      {naoEncontrada && <EmptyState titulo="Esta atividade não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />}
      {lida.isError && !naoEncontrada && (
        <div className="rounded-cartao border-2 border-erro bg-erro-cx p-4">
          <p role="alert" className="t-apoio text-erro">
            {errorMessage(lida.error)}
          </p>
          <Button className="mt-3" onClick={() => void lida.refetch({ cancelRefetch: false })}>
            Tentar de novo
          </Button>
        </div>
      )}
    </Page>
  )
}

/** Em andamento e com tempo (a prova online) e ainda aberta: a tela de foco. Sem limite (a atividade de antes da prova online), enviada ou encerrada, a tela de hoje. */
function estaEmProva(dados: ProvaEmAndamentoResponse): boolean {
  return dados.tempo.limiteEm !== null && dados.enviadaEm === null && dados.estado === 'aberta'
}

/** A porta de entrada de `/aluno/atividades/:id` (a rota usa esta). */
export default function AbrirAtividade({ atividadeAplicadaId }: { atividadeAplicadaId: string }) {
  const lida = useQuery(provaLidaQueryOptions(atividadeAplicadaId))
  const dados = lida.data
  if (dados === undefined) return <PortaSemDados lida={lida} />
  if (!dados.comecou) return dados.janela === null ? <Atividade atividadeAplicadaId={atividadeAplicadaId} /> : <AntesDeComecar antes={dados} />
  return estaEmProva(dados) ? <Redirect to={caminhoDaProvaDoAluno(atividadeAplicadaId)} replace /> : <Atividade atividadeAplicadaId={atividadeAplicadaId} />
}
