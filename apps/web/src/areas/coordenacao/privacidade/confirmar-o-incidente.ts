import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { confirmarIncidente, relerIncidentes } from './api/privacidade'
import { textoDaFalha } from '../../../components/error-text'

/**
 * A confirmação do recebimento do aviso de incidente (F3, 10.0; RF9), a mesma no diálogo da coordenação e na aba. O pedido só
 * termina depois de a lista ser relida (`relerIncidentes`): até lá o botão fica desligado, e o clique duplo não manda duas
 * confirmações (regra 80, item 7; a API também responde igual à segunda).
 *
 * Nada de otimismo: a data da confirmação é do servidor, e a tela só mostra "confirmado" com o que ele devolveu.
 */
export function useConfirmarIncidente() {
  const cliente = useQueryClient()
  // O estado da mutação chega à tela um tempo depois do clique (o TanStack notifica em outra tarefa), e no Chromebook lento o segundo
  // clique de um clique duplo cai antes de o botão desligar. Esta trava é síncrona: o segundo clique não manda outro pedido.
  const noAr = useRef(false)
  const confirmacao = useMutation({
    mutationFn: async (id: string) => {
      await confirmarIncidente(id)
      await relerIncidentes(cliente)
    },
  })
  return {
    /** Pede a confirmação. Devolve `true` quando o servidor confirmou, e `false` quando o pedido falhou (o texto está em `falha`) ou quando já havia outro no ar. */
    confirmar: (id: string) => {
      if (noAr.current) return Promise.resolve(false)
      noAr.current = true
      return confirmacao.mutateAsync(id).then(
        () => true,
        () => false,
      ).finally(() => {
        noAr.current = false
      })
    },
    /** O pedido está no ar: o id que está sendo confirmado, ou nada. */
    confirmando: confirmacao.isPending ? confirmacao.variables : undefined,
    /** O que deu errado e em qual aviso, já em português e dizendo o que fazer. Nunca o erro cru. Some quando um novo pedido sai. */
    falha: confirmacao.isError ? { id: confirmacao.variables, texto: textoDaFalha(confirmacao.error) } : undefined,
  }
}
