import { ErrorCode, PERCENTUAIS_DE_TEMPO_ADICIONAL, SEM_EMBARALHAR, type AcompanhamentoResponse, type AtividadeAplicada, type PercentualDeTempoAdicional, type SegundaChamadaRequest } from '@educa/shared'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { acompanhamentoQueryOptions, openSegundaChamada } from './api/acompanhamento'
import { atividadesAplicadasQueryOptions, recarregarAtividades } from './api/atividades'
import { CamposDaJanela } from './AplicacaoDoArtefato'
import { alunosDoAcompanhamento, conferirAProva, resumoDaProva, type AlunoComNomeNaTela, type CamposDaJanela as ValoresDaJanela, type ErrosDaProva, type PedidoDaProva } from './prova-online'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog, type ConfirmDialogRow } from '../../../components/ui/overlays/ConfirmDialog'
import { OptionCard } from '../../../components/ui/fields/OptionCard'
import { Select } from '../../../components/ui/fields/Select'
import { ErrorState, LoadingState } from '../../../components/states/index'
import { errorText } from '../../../components/error-text'
import { formatQuantity } from '../../../format'

interface PropsDaSegundaChamada {
  readonly aplicada: AtividadeAplicada
  /** O nome da turma, no resumo da confirmação. */
  readonly nomeDaTurma: string
  /** Onde o foco vai quando o diálogo fecha e o botão que o abriu saiu da tela. */
  readonly focoDeReserva: () => void
}

export const TEXTO_SEM_CONVOCADOS = 'Escolha quem faz a segunda chamada.'
export const TEXTO_DE_NINGUEM_PARA_CONVOCAR = 'Todos os alunos da turma já começaram ou enviaram a prova: esta tela oferece só quem não começou.'
const TEXTOS_DA_SEGUNDA_CHAMADA: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.ENTRADA_INVALIDA]: 'Algum aluno da lista não pode ser convocado: ele já enviou a prova ou saiu da turma, ou o tempo adicional não cabe na janela. Confira e tente de novo.',
  [ErrorCode.CONFLITO]: 'Já existe uma segunda chamada aberta para esta prova. Encerre a que está aberta antes de abrir outra.',
}

const OPCOES_DE_TEMPO_ADICIONAL = [
  { valor: '0', rotulo: 'Sem tempo adicional' },
  ...PERCENTUAIS_DE_TEMPO_ADICIONAL.map((percentual) => ({ valor: String(percentual), rotulo: `+${String(percentual)}%` })),
]

/**
 * Pode abrir a segunda chamada? Só a prova avaliativa com janela, **já encerrada**, que não é ela mesma uma segunda chamada (RF10; Tech Spec §5.9): a API recusa o resto
 * (`ENTRADA_INVALIDA`), e a tela nem oferece o botão.
 */
export function canAbrirSegundaChamada(aplicada: Pick<AtividadeAplicada, 'avaliativa' | 'estado' | 'janela' | 'segundaChamadaDe'>): boolean {
  return aplicada.avaliativa && aplicada.estado === 'encerrada' && aplicada.janela != null && aplicada.segundaChamadaDe == null
}

function camposIniciais(aplicada: AtividadeAplicada): ValoresDaJanela {
  return { abre: '', fecha: '', duracao: aplicada.duracaoMin == null ? '' : String(aplicada.duracaoMin) }
}

interface PropsDosConvocaveis {
  readonly elegiveis: readonly AlunoComNomeNaTela[]
  readonly convocados: readonly string[]
  readonly tempoAdicional: Readonly<Record<string, PercentualDeTempoAdicional>>
  readonly tentou: boolean
  readonly semConvocados: boolean
  readonly desligados: boolean
  readonly aoMarcar: (alunoId: string, marcada: boolean) => void
  readonly aoEscolherTempo: (alunoId: string, texto: string) => void
}

/** A lista de quem pode ser convocado, em uma coluna: o nome com a caixa de marcar e, só de quem foi marcado, o tempo adicional. */
function ConvocaveisDaTurma({ elegiveis, convocados, tempoAdicional, tentou, semConvocados, desligados, aoMarcar, aoEscolherTempo }: PropsDosConvocaveis) {
  const idDoGrupo = useId()
  const idDoErro = useId()
  return (
    <fieldset aria-describedby={tentou && semConvocados ? idDoErro : undefined} className="flex min-w-0 flex-col gap-2">
      <legend id={idDoGrupo} className="mb-2 font-medium">
        Quem faz a segunda chamada
      </legend>
      <ul className="flex min-w-0 flex-col gap-2">
        {elegiveis.map(({ aluno, nomeNaTela }) => {
          const marcada = convocados.includes(aluno.alunoId)
          return (
            <li key={aluno.alunoId} className="flex min-w-0 flex-col gap-2">
              <OptionCard tipo="checkbox" nome="convocados" valor={aluno.alunoId} rotulo={nomeNaTela} marcada={marcada} desligada={desligados} aoMudar={(nova) => aoMarcar(aluno.alunoId, nova)} />
              {marcada && (
                <Select
                  rotulo={`Tempo adicional de ${nomeNaTela}`}
                  opcoes={OPCOES_DE_TEMPO_ADICIONAL}
                  valor={String(tempoAdicional[aluno.alunoId] ?? 0)}
                  aoMudar={(texto) => aoEscolherTempo(aluno.alunoId, texto)}
                  desligada={desligados}
                />
              )}
            </li>
          )
        })}
      </ul>
      {tentou && semConvocados && (
        <p id={idDoErro} className="text-sm font-bold break-words text-vermelho-texto">
          {TEXTO_SEM_CONVOCADOS}
        </p>
      )}
    </fieldset>
  )
}

/** O erro do tempo adicional que não cabe na janela: só depois de a professora confirmar. */
function ErroDoTempoAdicional({ tentou, erros }: { readonly tentou: boolean; readonly erros: ErrosDaProva }) {
  return (
    <>
      {tentou && erros.tempoAdicional !== undefined && (
        <p role="alert" className="text-sm font-bold break-words text-vermelho-texto">
          {erros.tempoAdicional}
        </p>
      )}
    </>
  )
}

interface PropsDoCorpo extends PropsDosConvocaveis {
  readonly acompanhamento: UseQueryResult<AcompanhamentoResponse>
  readonly campos: ValoresDaJanela
  readonly aoMudarCampos: (campos: ValoresDaJanela) => void
  readonly erros: ErrosDaProva
}

/** O corpo do diálogo: os estados da leitura dos alunos, quem convocar, a janela nova e o erro do tempo adicional. */
function CorpoDaSegundaChamada({ acompanhamento, campos, aoMudarCampos, erros, ...convocaveis }: PropsDoCorpo) {
  const { elegiveis, tentou, desligados } = convocaveis
  const lida = acompanhamento.data !== undefined
  return (
    <div data-segunda-chamada="" className="flex min-w-0 flex-col gap-4">
      {acompanhamento.isPending && <LoadingState rotulo="Carregando os alunos da turma…" />}
      {acompanhamento.isError && !lida && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
      {lida && elegiveis.length === 0 && <p className="text-sm break-words text-apoio">{TEXTO_DE_NINGUEM_PARA_CONVOCAR}</p>}
      {elegiveis.length > 0 && <ConvocaveisDaTurma {...convocaveis} />}
      {elegiveis.length > 0 && <CamposDaJanela valor={campos} aoMudar={aoMudarCampos} erros={tentou ? erros : {}} desligados={desligados} />}
      <ErroDoTempoAdicional tentou={tentou} erros={erros} />
    </div>
  )
}

/** O resumo da confirmação: a atividade, a turma, **quem** é convocado (por nome) e, com a janela conferida, a prova nova (do tempo adicional, só quantos). */
function resumoDaSegundaChamada(aplicada: AtividadeAplicada, nomeDaTurma: string, escolhidos: readonly AlunoComNomeNaTela[], prova: PedidoDaProva | undefined): [ConfirmDialogRow, ...ConfirmDialogRow[]] {
  const resumo: [ConfirmDialogRow, ...ConfirmDialogRow[]] = [
    { rotulo: 'Atividade', valor: aplicada.titulo },
    { rotulo: 'Turma', valor: nomeDaTurma },
    { rotulo: 'Convocados', valor: escolhidos.length === 0 ? 'Ninguém escolhido ainda' : escolhidos.map(({ nomeNaTela }) => nomeNaTela).join(', ') },
  ]
  if (prova !== undefined) resumo.push({ rotulo: 'Prova', valor: resumoDaProva({ turma: nomeDaTurma, janela: prova.janela, duracaoMin: prova.duracaoMin, comTempoAdicional: prova.tempoAdicional.length }) })
  return resumo
}

interface PropsDaConfirmacaoDaSegundaChamada extends PropsDaSegundaChamada {
  /** A segunda chamada abriu: o aviso que fica ao lado do botão, e o diálogo fecha. */
  readonly aoAbrir: (aviso: string) => void
  readonly aoFechar: () => void
}

/** O diálogo nasce quando abre e morre quando fecha: quem foi convocado, o tempo adicional, a janela, a tentativa e a falha de cada abertura começam do zero. */
function DialogoDaSegundaChamada({ aplicada, nomeDaTurma, focoDeReserva, aoAbrir, aoFechar }: PropsDaConfirmacaoDaSegundaChamada) {
  const cliente = useQueryClient()
  const [convocados, definirConvocados] = useState<readonly string[]>([])
  const [tempoAdicional, definirTempoAdicional] = useState<Readonly<Record<string, PercentualDeTempoAdicional>>>({})
  const [campos, definirCampos] = useState<ValoresDaJanela>(() => camposIniciais(aplicada))
  const [tentou, definirTentou] = useState(false)
  const decidindo = useRef(false)
  const acompanhamento = useQuery(acompanhamentoQueryOptions(aplicada.id))
  const abrir = useMutation({
    mutationFn: (pedido: SegundaChamadaRequest) => openSegundaChamada(aplicada.id, pedido),
    onSuccess: async (_nova, pedido) => {
      recarregarAtividades(cliente)
      await cliente.invalidateQueries({ queryKey: atividadesAplicadasQueryOptions(aplicada.turmaId).queryKey })
      aoAbrir(`Segunda chamada aberta para ${formatQuantity(pedido.alunoIds.length, 'aluno', 'alunos')}. Ela aparece na lista de atividades da turma.`)
    },
    onSettled: () => (decidindo.current = false),
  })

  const elegiveis = alunosDoAcompanhamento((acompanhamento.data?.alunos ?? []).filter((aluno) => aluno.situacao === 'nao_comecou'))
  const escolhidos = elegiveis.filter(({ aluno }) => convocados.includes(aluno.alunoId))
  const doTempoAdicional = Object.entries(tempoAdicional)
    .filter(([alunoId]) => convocados.includes(alunoId))
    .map(([alunoId, percentual]) => ({ alunoId, percentual }))
  const { erros, pedido: prova } = conferirAProva({ ...campos, embaralhar: SEM_EMBARALHAR, tempoAdicional: Object.fromEntries(doTempoAdicional.map((item) => [item.alunoId, item.percentual])) })
  const semConvocados = convocados.length === 0
  const lida = acompanhamento.data !== undefined

  function marcar(alunoId: string, marcada: boolean): void {
    definirConvocados((atuais) => (marcada ? [...atuais, alunoId] : atuais.filter((id) => id !== alunoId)))
  }

  function escolherTempo(alunoId: string, texto: string): void {
    const { [alunoId]: _anterior, ...resto } = tempoAdicional
    const percentual = PERCENTUAIS_DE_TEMPO_ADICIONAL.find((opcao) => String(opcao) === texto)
    definirTempoAdicional(percentual === undefined ? resto : { ...resto, [alunoId]: percentual })
  }

  function confirmar(): void {
    definirTentou(true)
    if (prova === undefined || semConvocados || decidindo.current) return
    decidindo.current = true
    abrir.mutate({ alunoIds: [...convocados], janela: prova.janela, ...(prova.duracaoMin === undefined ? {} : { duracaoMin: prova.duracaoMin }), tempoAdicional: prova.tempoAdicional })
  }

  return (
    <ConfirmDialog
      titulo="Segunda chamada"
      familia="oficial"
      resumo={resumoDaSegundaChamada(aplicada, nomeDaTurma, escolhidos, prova)}
      efeito="A prova abre de novo, numa aplicação própria, só para os convocados, e a correção deles é um lote à parte. A prova de quem já enviou não muda."
      rotuloDeConfirmar="Abrir a segunda chamada"
      rotuloConfirmando="Abrindo…"
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
      confirmando={abrir.isPending}
      impedido={lida && elegiveis.length === 0}
      focoDeReserva={focoDeReserva}
      {...(abrir.isError ? { falha: errorText(abrir.error, TEXTOS_DA_SEGUNDA_CHAMADA) } : {})}
    >
      <CorpoDaSegundaChamada
        acompanhamento={acompanhamento}
        elegiveis={elegiveis}
        convocados={convocados}
        tempoAdicional={tempoAdicional}
        tentou={tentou}
        semConvocados={semConvocados}
        desligados={abrir.isPending}
        aoMarcar={marcar}
        aoEscolherTempo={escolherTempo}
        campos={campos}
        aoMudarCampos={definirCampos}
        erros={erros}
      />
    </ConfirmDialog>
  )
}

/**
 * **Segunda chamada** (RF10), no painel da prova encerrada: a professora escolhe, **por nome**, quem faz a prova de novo, a janela nova, a duração e o tempo adicional, e a
 * confirmação diz tudo isso antes de abrir (regra 50, item 8). A tela oferece só quem **não começou** a prova original (`nao_comecou`). A API aceita
 * também quem foi cortado pela professora antes do limite (a Tech Spec §5.5 e §5.9 o mantêm convocável), mas o acompanhamento o devolve como `enviou`, igual a quem enviou, e a tela não tem como
 * distingui-lo: é o subconjunto seguro, registrado nas divergências da tarefa (11.0). A lista é de **uma coluna**, a 360 px e no computador.
 *
 * O tempo adicional é por convocado, sem motivo, e a confirmação diz **quantos** o têm, e não quais (é adaptação, dado sensível, D35). O embaralhamento é o da original: o
 * corpo da rota não o traz. O pedido sai uma vez só (a trava `decidindo`); a falha fica no diálogo, em português.
 */
export function SegundaChamada({ aplicada, nomeDaTurma, focoDeReserva }: PropsDaSegundaChamada) {
  const [aberto, definirAberto] = useState(false)
  const [aviso, definirAviso] = useState('')

  return (
    <>
      {canAbrirSegundaChamada(aplicada) && (
        <Button
          variante="secundario"
          onClick={() => {
            definirAviso('')
            definirAberto(true)
          }}
        >
          Segunda chamada
        </Button>
      )}
      {aviso !== '' && (
        <p role="status" className="w-full rounded-controle bg-info-cx p-3 break-words text-info">
          {aviso}
        </p>
      )}
      {aberto && (
        <DialogoDaSegundaChamada
          aplicada={aplicada}
          nomeDaTurma={nomeDaTurma}
          focoDeReserva={focoDeReserva}
          aoAbrir={(texto) => {
            definirAviso(texto)
            definirAberto(false)
          }}
          aoFechar={() => definirAberto(false)}
        />
      )}
    </>
  )
}
