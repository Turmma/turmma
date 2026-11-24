import { ErrorCode, type AtividadeAplicada } from '@educa/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { atividadesAplicadasQueryOptions, mudarJanela, recarregarAtividades } from './api/atividades'
import { CamposDaJanela } from './AplicacaoDoArtefato'
import { conferirAMudancaDeJanela, paredeDaEscolaDoInstante, resumoDaProva, type CamposDaJanela as ValoresDaJanela } from './prova-online'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog, type ConfirmDialogRow } from '../../../components/ui/overlays/ConfirmDialog'
import { errorText } from '../../../components/error-text'

interface PropsDaMudancaDeJanela {
  readonly aplicada: AtividadeAplicada
  /** O nome da turma, no resumo da confirmação. */
  readonly nomeDaTurma: string
  /** Onde o foco vai quando o diálogo fecha e o botão que o abriu não existe mais (a mudança que fez alguém começar o tira da tela). */
  readonly focoDeReserva: () => void
}

export const TEXTO_DE_NINGUEM_COMECOU = 'Ninguém começou ainda'
export const TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO = 'A janela nova não comporta o tempo adicional que já está marcado. Aumente a janela ou diminua a duração.'

/** Pode mudar a janela? Só a prova avaliativa, aberta, com janela, e antes de alguém começar (RF2): depois disso o professor só estende. */
export function canMudarAJanela(aplicada: Pick<AtividadeAplicada, 'avaliativa' | 'estado' | 'janela' | 'participacao'>): boolean {
  return aplicada.avaliativa && aplicada.estado === 'aberta' && aplicada.janela != null && aplicada.participacao.iniciaram === 0
}

function camposDaJanelaGravada(aplicada: AtividadeAplicada): ValoresDaJanela {
  return {
    abre: aplicada.janela == null ? '' : paredeDaEscolaDoInstante(aplicada.janela.abreEm),
    fecha: aplicada.janela == null ? '' : paredeDaEscolaDoInstante(aplicada.janela.fechaEm),
    duracao: aplicada.duracaoMin == null ? '' : String(aplicada.duracaoMin),
  }
}

/**
 * **Mudar a janela** da prova (RF2), no painel da atividade: o botão só existe **antes do primeiro início** e a confirmação diz "Ninguém começou ainda" e
 * mostra a janela nova, no fuso da escola, antes de gravar (regra 50, item 8). Muda o horário e a duração; **o tempo adicional já marcado fica como está**
 * (a tela não o lê: é adaptação, dado sensível), e a API recusa a janela que não o comporta. Se alguém começou entre a abertura da tela e a confirmação, a
 * resposta é `PROVA_JA_COMECOU`, a lista é relida e o botão sai.
 *
 * O pedido sai uma vez só (a trava `decidindo`, como em `EncerramentoDaAtividade`); a falha fica no diálogo, em português.
 */
export function MudarJanela({ aplicada, nomeDaTurma, focoDeReserva }: PropsDaMudancaDeJanela) {
  const cliente = useQueryClient()
  const [aberto, definirAberto] = useState(false)
  const [campos, definirCampos] = useState<ValoresDaJanela>(() => camposDaJanelaGravada(aplicada))
  const [tentou, definirTentou] = useState(false)
  const decidindo = useRef(false)
  const mudar = useMutation({
    mutationFn: (pedido: Parameters<typeof mudarJanela>[1]) => mudarJanela(aplicada.id, pedido),
    onSuccess: async () => {
      recarregarAtividades(cliente)
      await cliente.invalidateQueries({ queryKey: atividadesAplicadasQueryOptions(aplicada.turmaId).queryKey })
      definirAberto(false)
    },
    // Recusada porque alguém já começou (ou a atividade mudou): a lista é relida, e o botão sai se for o caso.
    onError: () => recarregarAtividades(cliente),
    onSettled: () => (decidindo.current = false),
  })

  const { erros, pedido } = conferirAMudancaDeJanela(campos, aplicada.duracaoMin != null)
  const comTempoAdicional = aplicada.comTempoAdicional ?? 0

  function open(): void {
    mudar.reset()
    definirCampos(camposDaJanelaGravada(aplicada))
    definirTentou(false)
    definirAberto(true)
  }

  function confirmar(): void {
    definirTentou(true)
    if (pedido === undefined || decidindo.current) return
    decidindo.current = true
    mudar.mutate(pedido)
  }

  const resumo: [ConfirmDialogRow, ...ConfirmDialogRow[]] = [
    { rotulo: 'Atividade', valor: aplicada.titulo },
    { rotulo: 'Turma', valor: nomeDaTurma },
    { rotulo: 'Situação', valor: TEXTO_DE_NINGUEM_COMECOU },
  ]
  if (pedido !== undefined) resumo.push({ rotulo: 'Janela nova', valor: resumoDaProva({ turma: nomeDaTurma, janela: pedido.janela, duracaoMin: pedido.duracaoMin, comTempoAdicional }) })
  // A janela que não comporta o tempo adicional já marcado: a tela não sabe quais percentuais há, e a API recusa; o texto diz o que fazer.
  const falha = mudar.isError ? errorText(mudar.error, comTempoAdicional > 0 ? { [ErrorCode.ENTRADA_INVALIDA]: TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO } : {}) : undefined

  return (
    <>
      {canMudarAJanela(aplicada) && (
        <Button variante="secundario" onClick={open}>
          Mudar janela
        </Button>
      )}
      {aberto && (
        <ConfirmDialog
          titulo="Mudar a janela da prova"
          familia="oficial"
          resumo={resumo}
          efeito="Os alunos passam a começar a prova dentro da janela nova. Depois que o primeiro aluno começar, a janela não muda mais: só dá para estender o tempo."
          rotuloDeConfirmar="Mudar a janela"
          rotuloConfirmando="Mudando…"
          aoConfirmar={confirmar}
          aoFechar={() => definirAberto(false)}
          confirmando={mudar.isPending}
          focoDeReserva={focoDeReserva}
          {...(falha === undefined ? {} : { falha })}
        >
          <CamposDaJanela valor={campos} aoMudar={definirCampos} erros={tentou ? erros : {}} desligados={mudar.isPending} />
        </ConfirmDialog>
      )}
    </>
  )
}
