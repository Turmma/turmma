import type { AcompanhamentoResponse, AtividadeAplicada, SituacaoNoAcompanhamento } from '@educa/shared'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useId } from 'react'
import { acompanhamentoQueryOptions, INTERVALO_DO_ACOMPANHAMENTO_MS } from './api/acompanhamento'
import { Estender } from './Estender'
import { alunosDoAcompanhamento, hasAcompanhamento, textoDaSituacao, type AlunoComNomeNaTela } from './prova-online'
import { ErrorState, LoadingState } from '../../../components/states/index'
import { SectionHeader } from '../../../components/ui/Page'
import { StatusBadge, type StatusFamily } from '../../../components/ui/StatusBadge'

/** A família do selo de cada situação. O texto diz tudo, a família só repete; nenhuma é `erro`: esgotar o tempo é fato do relógio, e não falha de ninguém. */
const FAMILIA_DA_SITUACAO: Readonly<Record<SituacaoNoAcompanhamento, StatusFamily>> = {
  nao_comecou: 'info',
  fazendo: 'info',
  enviou: 'ok',
  tempo_esgotado: 'info',
}

/**
 * Quem ainda pode ganhar mais tempo: quem não enviou. O que enviou não tem o que estender. `tempo_esgotado` entra porque, **com a prova aberta**, quem esgotou o tempo ainda não tem
 * `enviada_em` (só o encerramento a grava), e a extensão reabre a tentativa; depois do encerramento ele conta como enviada em toda leitura (Tech Spec §5.5), e a seção nem oferece "Estender".
 */
const PODE_ESTENDER: Readonly<Record<SituacaoNoAcompanhamento, boolean>> = { nao_comecou: true, fazendo: true, enviou: false, tempo_esgotado: true }

interface PropsDoAcompanhamento {
  readonly aplicada: AtividadeAplicada
  readonly nomeDaTurma: string
  /** Onde o foco vai quando um diálogo fecha e o botão que o abriu saiu da tela (a prova encerrada tira os botões). */
  readonly focoDeReserva: () => void
}

interface PropsDaLista extends PropsDoAcompanhamento {
  readonly alunos: readonly AlunoComNomeNaTela[]
  readonly aberta: boolean
}

/** Um cartão por aluno: o nome, a situação em texto e, de quem ainda pode ganhar tempo, o "Estender". */
function ListaDoAcompanhamento({ alunos, aberta, aplicada, nomeDaTurma, focoDeReserva }: PropsDaLista) {
  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {alunos.map(({ aluno, nomeNaTela }) => (
        <li key={aluno.alunoId} data-aluno-da-prova={aluno.situacao} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-cartao border-2 border-borda bg-superficie p-3">
          <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
            <p className="min-w-0 font-medium break-words text-tinta">{nomeNaTela}</p>
            <div>
              <StatusBadge familia={FAMILIA_DA_SITUACAO[aluno.situacao]}>{textoDaSituacao(aluno)}</StatusBadge>
            </div>
          </div>
          {aberta && PODE_ESTENDER[aluno.situacao] && <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} aluno={{ aluno, nomeNaTela }} focoDeReserva={focoDeReserva} />}
        </li>
      ))}
    </ul>
  )
}

interface PropsDosEstados {
  readonly acompanhamento: UseQueryResult<AcompanhamentoResponse>
  readonly lido: boolean
  readonly alunos: readonly AlunoComNomeNaTela[]
}

/** Os estados de antes do dado (regra 50, item 5): carregando, erro (só sem leitura nenhuma) e vazio. */
function EstadosDaLeitura({ acompanhamento, lido, alunos }: PropsDosEstados) {
  return (
    <>
      {acompanhamento.isPending && <LoadingState rotulo="Carregando o acompanhamento da prova…" />}
      {acompanhamento.isError && !lido && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
      {lido && alunos.length === 0 && <p className="text-sm text-sutil">Esta turma ainda não tem alunos para acompanhar. Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome: quem entrar aparece aqui.</p>}
    </>
  )
}

/**
 * **Acompanhar a prova** (RF4; `cenarios.md` §4), no painel da atividade: um cartão por aluno da turma com o nome e a situação **em texto** ("Não começou", "Fazendo ·
 * termina às 10:42", "Enviou", "Tempo esgotado"), o horário no fuso da escola, e "Estender" em cada cartão que ainda pode ganhar tempo (mais "Estender a turma toda", na prova aberta).
 * **Só a prova com relógio** (avaliativa com janela) tem a seção: a atividade prática não a mostra.
 *
 * - **Uma leitura só** (`GET …/acompanhamento`), relida **a cada 15 s enquanto a prova está aberta e a janela está à vista**: com a aba escondida o TanStack Query pausa
 *   (`refetchIntervalInBackground: false`), e a prova encerrada não é relida. A leitura mora no painel da atividade, em Atividades: **nunca na tela da sala** (Hoje), que a
 *   professora projeta, porque ela traz nome de aluno (regra 50, item 10).
 * - **Só situação**: nenhuma contagem de saídas da aba (ela é do lote, D70 e D88), nenhum percentual de tempo adicional e nenhum "parado há X min" (regra 70, item 7). Os
 *   alunos seguem em ordem de nome, e não de quem acabou antes: a lista não é ranking.
 * - **Dois alunos com o mesmo nome** viram dois cartões, "(1 de 2)" e "(2 de 2)": o contrato traz só o nome, sem matrícula.
 * - **Os quatro estados**: carregando, erro com "Tentar de novo" (só quando não há leitura nenhuma: a releitura que falha deixa o último acompanhamento), vazio e com dado.
 */
export function Acompanhamento({ aplicada, nomeDaTurma, focoDeReserva }: PropsDoAcompanhamento) {
  if (!hasAcompanhamento(aplicada)) return null
  return <LeituraDoAcompanhamento aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} />
}

function LeituraDoAcompanhamento({ aplicada, nomeDaTurma, focoDeReserva }: PropsDoAcompanhamento) {
  const idDoTitulo = useId()
  const aberta = aplicada.estado === 'aberta'
  const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), ...(aberta ? { refetchInterval: INTERVALO_DO_ACOMPANHAMENTO_MS, refetchIntervalInBackground: false } : {}) })
  const alunos = alunosDoAcompanhamento(acompanhamento.data?.alunos ?? [])
  const lido = acompanhamento.data !== undefined

  return (
    <section data-acompanhamento="" aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      <SectionHeader id={idDoTitulo} titulo="Acompanhar" nivel={3} {...(aberta && lido && alunos.length > 0 ? { acao: <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} /> } : {})} />
      <EstadosDaLeitura acompanhamento={acompanhamento} lido={lido} alunos={alunos} />
      {alunos.length > 0 && <ListaDoAcompanhamento alunos={alunos} aberta={aberta} aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} />}
    </section>
  )
}
