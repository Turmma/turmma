import { ErrorCode, type AtividadeAplicada, type EstenderTempoRequest } from '@educa/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { estenderTempo, guardarOAcompanhamento } from './api/acompanhamento'
import { efeitoDeEstender, minutosDaExtensao, TEXTO_DOS_MINUTOS_FORA, type AlunoComNomeNaTela } from './prova-online'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog, type ConfirmDialogRow } from '../../../components/ui/overlays/ConfirmDialog'
import { FormField } from '../../../components/ui/fields/FormField'
import { SegmentedControl } from '../../../components/ui/fields/SegmentedControl'
import { errorText } from '../../../components/error-text'

interface PropsDoEstender {
  readonly aplicada: AtividadeAplicada
  /** O nome da turma, no resumo da confirmação. */
  readonly nomeDaTurma: string
  /** O aluno do cartão. Sem ele, o botão é o da turma toda. */
  readonly aluno?: AlunoComNomeNaTela
  /** Onde o foco vai quando o diálogo fecha e o botão que o abriu saiu da tela (a prova encerrada tira os botões). */
  readonly focoDeReserva: () => void
}

type Escopo = 'aluno' | 'turma'

/** O que a tela diz quando a API recusa: a prova que encerrou com o diálogo aberto (o catálogo fala ao aluno, e este é o professor). */
const TEXTOS_DA_EXTENSAO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.ATIVIDADE_ENCERRADA]: 'A prova já foi encerrada, e não dá mais para estender o tempo.',
}

/** O pedido que já tem chave: a mesma chave serve ao mesmo pedido (alvo e minutos iguais), e outro pedido ganha outra, para a API não devolver o gravado do primeiro. */
interface PedidoComChave {
  readonly chave: string
  readonly minutos: number
  readonly alunoId: string | undefined
}

interface PropsDosCampos {
  readonly aluno: AlunoComNomeNaTela | undefined
  readonly escopo: Escopo
  readonly aoMudarEscopo: (escopo: Escopo) => void
  readonly minutos: string
  readonly aoMudarMinutos: (minutos: string) => void
  readonly erro: string | undefined
  readonly desligados: boolean
}

/** Os campos do diálogo: a escolha entre o aluno e a turma (só no cartão de um aluno) e "Mais quantos minutos?". */
function CamposDaExtensao({ aluno, escopo, aoMudarEscopo, minutos, aoMudarMinutos, erro, desligados }: PropsDosCampos) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {aluno !== undefined && (
        <SegmentedControl
          rotulo="Para quem"
          rotuloVisivel
          opcoes={[
            { valor: 'aluno', rotulo: aluno.nomeNaTela },
            { valor: 'turma', rotulo: 'A turma toda' },
          ]}
          valor={escopo}
          aoMudar={aoMudarEscopo}
        />
      )}
      <FormField
        rotulo="Mais quantos minutos?"
        type="number"
        inputMode="numeric"
        min={1}
        max={120}
        step={1}
        value={minutos}
        onChange={(evento) => aoMudarMinutos(evento.target.value)}
        dica="De 1 a 120 minutos."
        erro={erro}
        disabled={desligados}
      />
    </div>
  )
}

/** A chave do pedido: a mesma serve ao mesmo pedido (alvo e minutos iguais), e outro pedido ganha outra. */
function useChaveDoPedido(): (alunoId: string | undefined, minutosPedidos: number) => string {
  const pedidoComChave = useRef<PedidoComChave | undefined>(undefined)
  return (alunoId, minutosPedidos) => {
    const atual = pedidoComChave.current
    if (atual !== undefined && atual.alunoId === alunoId && atual.minutos === minutosPedidos) return atual.chave
    const nova = crypto.randomUUID()
    pedidoComChave.current = { chave: nova, minutos: minutosPedidos, alunoId }
    return nova
  }
}

interface PropsDaConfirmacaoDeEstender extends PropsDoEstender {
  readonly aoFechar: () => void
}

/** O diálogo nasce quando abre e morre quando fecha: o escopo, os minutos, a tentativa, a falha e a chave de cada abertura começam do zero. */
function DialogoDeEstender({ aplicada, nomeDaTurma, aluno, focoDeReserva, aoFechar }: PropsDaConfirmacaoDeEstender) {
  const cliente = useQueryClient()
  const [minutos, definirMinutos] = useState('')
  const [escopo, definirEscopo] = useState<Escopo>(aluno === undefined ? 'turma' : 'aluno')
  const [tentou, definirTentou] = useState(false)
  const decidindo = useRef(false)
  const chaveDoPedido = useChaveDoPedido()
  const estender = useMutation({
    mutationFn: (pedido: EstenderTempoRequest) => estenderTempo(aplicada.id, pedido),
    onSuccess: async (acompanhamento) => {
      await guardarOAcompanhamento(cliente, aplicada.id, acompanhamento)
      aoFechar()
    },
    onSettled: () => (decidindo.current = false),
  })

  const quantos = minutosDaExtensao(minutos)
  const doAluno = aluno !== undefined && escopo === 'aluno' ? aluno : undefined

  function confirmar(): void {
    definirTentou(true)
    if (quantos === undefined || decidindo.current) return
    decidindo.current = true
    const alunoId = doAluno?.aluno.alunoId
    estender.mutate({ ...(alunoId === undefined ? {} : { alunoId }), minutos: quantos, chave: chaveDoPedido(alunoId, quantos) })
  }

  const resumo: [ConfirmDialogRow, ...ConfirmDialogRow[]] = [
    { rotulo: 'Atividade', valor: aplicada.titulo },
    { rotulo: 'Turma', valor: nomeDaTurma },
    { rotulo: 'Para quem', valor: doAluno === undefined ? 'A turma toda' : doAluno.nomeNaTela },
  ]
  const efeito = efeitoDeEstender(doAluno === undefined ? { tipo: 'turma' } : { tipo: 'aluno', nome: doAluno.nomeNaTela, aluno: doAluno.aluno }, quantos)

  return (
    <ConfirmDialog
      titulo="Estender o tempo"
      familia="oficial"
      resumo={resumo}
      efeito={efeito}
      aviso="A extensão fica registrada com o seu nome. Quem já enviou a prova não é afetado."
      rotuloDeConfirmar="Estender o tempo"
      rotuloConfirmando="Estendendo…"
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
      confirmando={estender.isPending}
      focoDeReserva={focoDeReserva}
      {...(estender.isError ? { falha: errorText(estender.error, TEXTOS_DA_EXTENSAO) } : {})}
    >
      <CamposDaExtensao
        aluno={aluno}
        escopo={escopo}
        aoMudarEscopo={definirEscopo}
        minutos={minutos}
        aoMudarMinutos={definirMinutos}
        erro={tentou && quantos === undefined ? TEXTO_DOS_MINUTOS_FORA : undefined}
        desligados={estender.isPending}
      />
    </ConfirmDialog>
  )
}

/**
 * **Estender o tempo** (RF4), no cartão de um aluno ou para a turma toda: "Mais quantos minutos?" (1 a 120), a escolha entre o aluno e a turma, e **o efeito antes de
 * confirmar** ("Ana termina às 10:52 em vez de 10:42", no fuso da escola; regra 50, item 8). É ato do professor, registrado com o nome dele e sem motivo.
 *
 * - **A `chave` nasce uma vez por pedido**: o duplo clique em confirmar manda um pedido só (a trava `decidindo`), e o reenvio depois da falha leva a mesma chave, que a API
 *   reconhece (200, o gravado, sem segunda extensão). Mudar os minutos ou o alvo é outro pedido, com chave nova. Abrir o diálogo de novo começa outro pedido.
 * - **A resposta guarda o acompanhamento** no lugar da leitura que estava no ar (`guardarOAcompanhamento`): o limite velho que chega depois não cobre o novo.
 * - **A falha fica no diálogo, em português**, e sai quando ele é aberto de novo.
 */
export function Estender(props: PropsDoEstender) {
  const { aluno } = props
  const [aberto, definirAberto] = useState(false)

  return (
    <>
      <Button
        variante="secundario"
        tamanho="principal"
        onClick={() => definirAberto(true)}
        {...(aluno === undefined ? {} : { 'aria-label': `Estender o tempo de ${aluno.nomeNaTela}` })}
      >
        {aluno === undefined ? 'Estender a turma toda' : 'Estender'}
      </Button>
      {aberto && (
        <DialogoDeEstender {...props} aoFechar={() => definirAberto(false)} />
      )}
    </>
  )
}
