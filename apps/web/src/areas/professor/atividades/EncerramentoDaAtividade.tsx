import type { AtividadeAplicada } from '@educa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { acompanhamentoQueryOptions } from './api/acompanhamento'
import { atividadesAplicadasQueryOptions, encerrarAtividade, recarregarAtividades } from './api/atividades'
import { avisoDeQuemAindaFaz, hasAcompanhamento } from './prova-online'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/overlays/ConfirmDialog'
import { errorText } from '../../../components/error-text'
import { EFEITO_DE_ENCERRAR, textoDeAlunos } from './aprovar'

interface PropsDoEncerramento {
  readonly aplicada: AtividadeAplicada
  /** O nome da turma, no resumo da confirmação. */
  readonly nomeDaTurma: string
  /**
   * Onde o foco vai quando o diálogo fecha e o botão que o abriu não existe mais (a atividade encerrada tira o botão da
   * tela). Quem usa a peça sabe qual é o bloco que continua lá.
   */
  readonly focoDeReserva: () => void
}

/** O aviso de "N alunos ainda estão fazendo": a leitura só sai com a confirmação aberta e na prova com relógio, e vale a relida de agora (`staleTime: 0`). */
function useAvisoDeQuemAindaFaz(aplicada: AtividadeAplicada, aberto: boolean): string | undefined {
  const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), staleTime: 0, enabled: aberto && aplicada.estado === 'aberta' && hasAcompanhamento(aplicada) })
  const fazendo = (acompanhamento.data?.alunos ?? []).filter((aluno) => aluno.situacao === 'fazendo').length
  return avisoDeQuemAindaFaz(fazendo)
}

/**
 * **Encerrar a atividade** (A3; telas do professor, 6.0): o botão e a confirmação que diz o que vai acontecer antes (regra 50,
 * item 8) — as respostas param, a correção é feita e fica esperando a professora —, com o resumo da atividade, da turma e de
 * quantos já enviaram. Extraída de `AplicacaoDoArtefato` sem mudar o que faz, para o painel da turma usar a mesma peça (11.0).
 *
 * - **Só a atividade aberta tem o botão.** A encerrada não se encerra de novo por aqui.
 * - **O pedido sai uma vez só**: o clique duplo em "Encerrar a atividade" do diálogo manda um pedido (regra 80, item 7). A
 *   trava é a `decidindo`, que vale dentro do mesmo instante, antes de o botão desligar; o desligamento é o aviso visual.
 * - **O diálogo sobrevive ao botão**: quando o pedido termina, a lista relê e a atividade passa a encerrada, e o botão sai. O
 *   diálogo é desta peça, e só fecha depois da releitura, para o foco ir ao `focoDeReserva` e não ao `body`.
 * - **A falha** fica no diálogo, em português; se a pessoa o fecha, a mensagem fica ao lado do botão.
 * - **Na prova com relógio, a confirmação diz quantos ainda fazem** (RF5; "3 alunos ainda estão fazendo. As respostas salvas deles vão para a correção."): o número vem do
 *   acompanhamento, relido quando o diálogo abre. Sem leitura (a rede falhou), a confirmação segue sem a frase, e com ninguém fazendo ela não diz zero.
 */
export function EncerramentoDaAtividade({ aplicada, nomeDaTurma, focoDeReserva }: PropsDoEncerramento) {
  const cliente = useQueryClient()
  // A atividade como estava quando a confirmação abriu: a releitura troca o `aplicada` por baixo dela, e o resumo não pisca.
  const [aberto, definirAberto] = useState<AtividadeAplicada | undefined>(undefined)
  const decidindo = useRef(false)
  const aviso = useAvisoDeQuemAindaFaz(aplicada, aberto !== undefined)
  const encerrar = useMutation({
    mutationFn: () => encerrarAtividade(aplicada.id),
    onSuccess: async () => {
      recarregarAtividades(cliente)
      await cliente.invalidateQueries({ queryKey: atividadesAplicadasQueryOptions(aplicada.turmaId).queryKey })
      definirAberto(undefined)
    },
    onSettled: () => (decidindo.current = false),
  })

  function confirmar(): void {
    if (decidindo.current) return
    decidindo.current = true
    encerrar.mutate()
  }

  return (
    <>
      {aplicada.estado === 'aberta' && (
        <Button
          variante="oficial"
          onClick={() => {
            encerrar.reset()
            definirAberto(aplicada)
          }}
        >
          Encerrar a atividade
        </Button>
      )}
      {encerrar.isError && aberto === undefined && (
        <p role="alert" className="w-full rounded-controle bg-erro-cx p-3 break-words text-erro">
          {errorText(encerrar.error)}
        </p>
      )}
      {aberto !== undefined && (
        <ConfirmDialog
          titulo="Encerrar a atividade"
          familia="oficial"
          resumo={[
            { rotulo: 'Atividade', valor: aberto.titulo },
            { rotulo: 'Turma', valor: nomeDaTurma },
            { rotulo: 'Já enviaram', valor: `${String(aberto.participacao.enviaram)} de ${textoDeAlunos(aberto.participacao.alunos)}` },
          ]}
          efeito={EFEITO_DE_ENCERRAR}
          {...(aviso === undefined ? {} : { aviso })}
          rotuloDeConfirmar="Encerrar a atividade"
          rotuloConfirmando="Encerrando…"
          aoConfirmar={confirmar}
          aoFechar={() => definirAberto(undefined)}
          confirmando={encerrar.isPending}
          focoDeReserva={focoDeReserva}
          {...(encerrar.isError ? { falha: errorText(encerrar.error) } : {})}
        />
      )}
    </>
  )
}
