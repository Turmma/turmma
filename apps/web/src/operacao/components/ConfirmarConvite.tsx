import type { EscolaDoPainel } from '@educa/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Botao } from '../../components/ui/Botao'
import { CHAVE_DAS_ESCOLAS, revogarConviteNoPainel } from '../api/painel'
import { falhaDoConvite } from '../textos'
import { CLASSES_DO_BOTAO_SECUNDARIO } from '../../components/ui/button-variants'
import { DialogoDaOperacao } from './DialogoDaOperacao'

interface Props {
  readonly escola: Pick<EscolaDoPainel, 'nome'>
  /** O último convite de coordenação da escola, como a lista o trouxe. */
  readonly conviteId: string
  readonly aoFechar: () => void
  /**
   * O convite revogado. Roda mesmo com o diálogo já fechado (o pedido saiu e a pessoa cancelou antes da resposta): quem o
   * recebe fecha só a abertura em que o pedido saiu (`fecharSeAinda`), e nunca outro diálogo aberto depois.
   */
  readonly aoRevogar: () => void
  /** O foco ao fechar quando o "Revogar" que abriu já saiu da linha (a lista recarregou com o `CONFLITO`). */
  readonly focoDeReserva?: () => void
}

/**
 * Revogar o convite da coordenação (Tech Spec da A0b, seção 9; tarefa 7.0), com confirmação que diz o que acontece: o
 * link enviado deixa de valer na hora, e a escola fica sem convite até alguém convidar de novo (regra 50, item 8). O foco
 * começa no texto, e não no botão que revoga. "Revogar convite" e "Cancelar" do mesmo tamanho (D59).
 *
 * O `CONFLITO` (o convite mudou) e o `NAO_ENCONTRADO` (já revogado) têm o texto da W10 aqui dentro, onde o leitor de tela
 * o alcança com o diálogo modal aberto, e a lista recarrega; sobra só "Fechar".
 */
export function ConfirmarConvite({ escola, conviteId, aoFechar, aoRevogar, focoDeReserva }: Props) {
  // O pedido no ar, na hora: o segundo clique de um clique duplo chega antes do `isPending`.
  const noAr = useRef(false)
  const texto = useRef<HTMLParagraphElement>(null)
  const alerta = useRef<HTMLParagraphElement>(null)
  const clienteDeConsultas = useQueryClient()
  const revogar = useMutation({
    mutationFn: () => revogarConviteNoPainel(conviteId),
    onSuccess: aoRevogar,
    onSettled: () => clienteDeConsultas.invalidateQueries({ queryKey: CHAVE_DAS_ESCOLAS }),
  })
  const falha = revogar.isError ? falhaDoConvite('revogar', revogar.error) : undefined

  // A falha tira o foco do botão (desligado no pedido, ou fora da tela quando a lista mudou): ele vai para o alerta.
  useEffect(() => {
    if (revogar.error !== null) alerta.current?.focus()
  }, [revogar.error])

  function confirmar(): void {
    if (noAr.current) return
    noAr.current = true
    revogar.mutate(undefined, { onSettled: () => (noAr.current = false) })
  }

  return (
    <DialogoDaOperacao
      titulo="Revogar o convite"
      aoFechar={aoFechar}
      fecharAoClicarFora
      focoInicial={texto}
      {...(focoDeReserva === undefined ? {} : { focoDeReserva })}
    >
      <div className="mt-4 flex flex-col gap-4">
        <p ref={texto} tabIndex={-1} className="text-apoio">
          O convite da coordenação de <span className="font-medium text-tinta wrap-anywhere">{escola.nome}</span> deixa de valer na hora: o link
          mandado não entra mais. A escola fica sem convite até você convidar de novo.
        </p>
        {falha !== undefined && (
          <p ref={alerta} tabIndex={-1} role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
            {falha.texto}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {falha?.listaMudou !== true && (
            <Botao onClick={confirmar} disabled={revogar.isPending}>
              {revogar.isPending ? 'Revogando…' : 'Revogar convite'}
            </Botao>
          )}
          <button type="button" onClick={aoFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
            {falha?.listaMudou === true ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
        <span role="status" className="sr-only">
          {revogar.isPending ? 'Revogando o convite…' : ''}
        </span>
      </div>
    </DialogoDaOperacao>
  )
}
