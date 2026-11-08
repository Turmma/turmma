import type { EnviarConvitesResponse } from '@educa/shared'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useRef } from 'react'
import { ErrorAlert, useSingleSubmit } from '../../../components/dialogs'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES } from '../../../components/ui/button-variants'
import { Dialog } from '../../../components/ui/overlays/Dialog'
import { falhaDoEnvioDeConvites, textoDoEnvioFeito, TEXTO_DOS_LINKS_ANTERIORES, TEXTO_SEM_QUEM_ESPERE_O_CONVITE } from './envio-do-convite'

interface Props {
  /** "Enviar convites" (em lote) ou "Reenviar o convite" (um professor): o mesmo diálogo, com o texto de cada um. */
  readonly titulo: string
  /** Quem recebe, dito antes de confirmar (regra 50, item 8): a contagem, ou o nome. */
  readonly quemRecebe: string
  readonly rotuloDaAcao: string
  readonly rotuloEmAndamento: string
  /** As opções de `api/professores.ts`, sem nada por cima: é lá que o `gcTime: 0` tira o pedido do cache. */
  readonly mutacao: UseMutationOptions<EnviarConvitesResponse, Error, void>
  /** Ninguém espera o convite agora (a lista se releu com o diálogo aberto): nenhum pedido sai, e sobra só "Fechar". */
  readonly semDestinatario?: boolean
  readonly aoFechar: () => void
  readonly focoDeReserva: () => void
}

type Etapa = 'pergunta' | 'sem_destinatario' | 'feito'

/** Com o pedido no ar a tela segue como está; sem ele, a lista vazia não tem o que enviar: o `usuarioIds` vazio seria um 400. */
function etapaDoDialogo(feito: string | undefined, semDestinatario: boolean, pedidoNoAr: boolean): Etapa {
  if (feito !== undefined) return 'feito'
  return semDestinatario && !pedidoNoAr ? 'sem_destinatario' : 'pergunta'
}

function TextoDaEtapa({ etapa, quemRecebe, feito }: { readonly etapa: Etapa; readonly quemRecebe: string; readonly feito: string | undefined }) {
  if (etapa === 'sem_destinatario') return <p className="break-words text-tinta">{TEXTO_SEM_QUEM_ESPERE_O_CONVITE}</p>
  if (feito !== undefined) return <p className="break-words text-tinta">{feito}</p>
  return (
    <>
      <p className="break-words text-tinta">{quemRecebe}</p>
      <p className="break-words text-apoio">{TEXTO_DOS_LINKS_ANTERIORES}</p>
    </>
  )
}

/**
 * O diálogo do envio por e-mail (acesso-e-convites, 4.0; RF11): diz quantos recebem, e que os links enviados ou copiados antes deixam de
 * valer, antes de confirmar. O foco começa no texto, e não no botão que envia (regra 50, item 8), e "Cancelar" tem o tamanho do botão que envia
 * (D59). A falha — a cota de 300 por hora, a rede — aparece aqui dentro, com o foco nela, e a nova tentativa a apaga ao sair. Depois de
 * enfileirar, o diálogo diz quantos entraram e sobra só "Fechar": o e-mail sai pelo worker, e a lista mostra o estado de cada um.
 */
export function DialogoDeEnviarConvites({ titulo, quemRecebe, rotuloDaAcao, rotuloEmAndamento, mutacao, semDestinatario = false, aoFechar, focoDeReserva }: Props) {
  const inicio = useRef<HTMLDivElement>(null)
  const { enviar, mutacao: pedido } = useSingleSubmit(mutacao)
  const feito = pedido.isSuccess ? textoDoEnvioFeito(pedido.data) : undefined
  const etapa = etapaDoDialogo(feito, semDestinatario, pedido.isPending)
  return (
    <Dialog titulo={titulo} aoFechar={aoFechar} focoInicial={inicio} focoDeReserva={focoDeReserva}>
      <div className="mt-4 flex min-w-0 flex-col gap-4">
        <div ref={inicio} tabIndex={-1} className="flex min-w-0 flex-col gap-2">
          <TextoDaEtapa etapa={etapa} quemRecebe={quemRecebe} feito={feito} />
        </div>
        {pedido.isError && <ErrorAlert texto={falhaDoEnvioDeConvites(pedido.error)} />}
        <div className="flex flex-wrap justify-end gap-3">
          {etapa === 'pergunta' && (
            <Button onClick={() => enviar(undefined)} disabled={pedido.isPending}>
              {pedido.isPending ? rotuloEmAndamento : rotuloDaAcao}
            </Button>
          )}
          <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
            {etapa === 'pergunta' ? 'Cancelar' : 'Fechar'}
          </button>
        </div>
        <span role="status" className="sr-only">
          {pedido.isPending ? rotuloEmAndamento : ''}
        </span>
      </div>
    </Dialog>
  )
}
