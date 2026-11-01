import type { IncidenteDaEscola } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { incidentesQueryOptions } from './api/privacidade'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states'
import { Banner } from '../../../components/ui/Banner'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useConfirmarIncidente } from './confirmar-o-incidente'
import { DetalhesDoIncidente } from './DetalhesDoIncidente'
import { TEXTO_DO_QUE_CONFIRMAR_FAZ, textoDaConfirmacao, textoDoConhecimento } from './textos-dos-incidentes'

interface PropsDoCartao {
  readonly incidente: IncidenteDaEscola
  /** O id do aviso que está sendo confirmado agora. Com um no ar, todos os botões esperam: o clique duplo não manda dois pedidos. */
  readonly confirmando: string | undefined
  /** A falha do último pedido e de qual aviso ela é: só o cartão dele a mostra. */
  readonly falha: { readonly id: string; readonly texto: string } | undefined
  readonly aoConfirmar: (id: string) => Promise<boolean>
}

/**
 * Um incidente da escola, num `Card` (X2, 13.0): o estado, todos os campos e, se espera a confirmação, o botão oficial que a
 * dá. O cartão é uma região com o nome do aviso (`h3`), e é o título que recebe o foco quando o aviso passa a "confirmado".
 */
function CartaoDoIncidente({ incidente, confirmando, falha, aoConfirmar }: PropsDoCartao) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const pendente = incidente.confirmadoEm === null
  const esteConfirmando = confirmando === incidente.id
  return (
    <Card
      titulo={`Incidente conhecido em ${textoDoConhecimento(incidente)}`}
      nivel={3}
      refDoTitulo={titulo}
      acao={<StatusBadge familia={pendente ? 'pendente' : 'ok'}>{textoDaConfirmacao(incidente)}</StatusBadge>}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <DetalhesDoIncidente incidente={incidente} />
        {pendente && (
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-apoio">{TEXTO_DO_QUE_CONFIRMAR_FAZ}</p>
            <p role="alert" className="rounded-controle bg-erro-cx p-3 break-words text-erro empty:hidden">
              {falha?.id === incidente.id ? falha.texto : ''}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variante="oficial"
                disabled={confirmando !== undefined}
                onClick={() =>
                  void aoConfirmar(incidente.id).then((confirmou) => {
                    // O cartão continua na tela, mudado de "esperando" para "confirmado": o foco vai para o título dele, e não se perde com o botão que saiu.
                    if (confirmou) titulo.current?.focus()
                  })
                }
              >
                {esteConfirmando ? 'Confirmando…' : 'Confirmo que recebi'}
              </Button>
              <span role="status" className="sr-only">
                {esteConfirmando ? 'Confirmando…' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * A aba "Incidentes" (F3, 10.0; RF9 e RF20): os incidentes de segurança que afetaram a escola, só a seção dela, os que esperam
 * a confirmação primeiro, cada um com todos os campos e o prazo legal da escola em texto fixo. A coordenação que deixou o
 * diálogo para depois confirma aqui. Os quatro estados: carregando, erro com "Tentar de novo", vazio (nenhum incidente afetou
 * a escola) e o dado.
 *
 * **Sempre relê ao abrir** (`refetchOnMount: 'always'`): o aviso da coordenação lê uma vez por sessão, e outra pessoa da
 * coordenação pode ter confirmado desde então. A consulta é a mesma, e a faixa e o diálogo acompanham o que esta aba leu.
 */
export function Incidentes() {
  const consulta = useQuery({ ...incidentesQueryOptions, refetchOnMount: 'always' })
  const { confirmar, confirmando, falha } = useConfirmarIncidente()
  if (consulta.isPending) return <LoadingState rotulo="Carregando os incidentes…" />
  if (consulta.isError && consulta.data === undefined) {
    return <ErrorState erro={consulta.error} tentando={consulta.isFetching} aoTentarDeNovo={() => void consulta.refetch({ cancelRefetch: false })} />
  }

  const { incidentes, prazoLegal } = consulta.data
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Banner>{prazoLegal}</Banner>
      {incidentes.length === 0 ? (
        <EmptyState titulo="Nenhum incidente afetou esta escola" descricao="Se a Turmma registrar um incidente de segurança que alcance dados da escola, o aviso aparece aqui e ao entrar." />
      ) : (
        <ul className="flex min-w-0 flex-col gap-4">
          {incidentes.map((incidente) => (
            <li key={incidente.id} className="min-w-0">
              <CartaoDoIncidente incidente={incidente} confirmando={confirmando} falha={falha} aoConfirmar={confirmar} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
